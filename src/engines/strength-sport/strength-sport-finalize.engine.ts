/**
 * strength-sport-finalize.engine.ts — финальные проверки/баланс.
 * Аналог bb-finalize: капы, баланс, недели делода, outside-конфликты.
 */
import type { StrengthSportPlan } from './strength-sport.types';
import { getWL, getStrong } from './strength-sport-volume';
import { sessionLimitsFor, validateSync } from './strength-sport-limits';
import { calcDOTS, calcWilks, calcIPFGL } from '../pl-points.engine';
import { outsideVolumeMultiplier } from '../outside-load.engine';

// Sinclair 2024 (IWF 01.06.2025) — обновлённые коэффициенты, fallback 2017 для сравнения
export const SINCLAIR_2024 = {
  male: { A: 0.722762521, b: 193.609 },
  female: { A: 0.787004341, b: 153.757 },
};
export const SINCLAIR = SINCLAIR_2024;
// Robi points (IWF) — A_m 1000, B_m, C_m для сравнения
export const ROBI_COEFF = {
  male: { A: 1000, B: 1.038, C: 0.009 },
  female: { A: 1000, B: 0.829, C: 0.011 },
};
export function calcSinclair(total: number, bw: number, sex: string, use2024 = true): number {
  if (total <= 0 || bw <= 0) return 0;
  const s = (use2024 ? SINCLAIR_2024 : { male: { A: 0.751945030, b: 175.508 }, female: { A: 0.783497476, b: 153.655 } })[sex === 'female' ? 'female' : 'male'];
  const log = Math.log10(bw / s.b);
  const coeff = Math.pow(10, s.A * log * log);
  return Math.round(total * coeff);
}
export function calcRobi(total: number, bw: number, sex: string): number {
  if (total <= 0 || bw <= 0) return 0;
  // IWF Robi simplified: A * total / (B*BW + C*BW^2) — для сравнения
  const c = sex === 'female' ? ROBI_COEFF.female : ROBI_COEFF.male;
  const denom = c.B * bw + c.C * bw * bw;
  return Math.round((c.A * total) / denom);
}
export function getIWFCategory(bw: number, sex: string): string {
  // IWF 2025 новые категории (с 01.06.2025): M 60/65/71/79/88/98/110/110+, W 48/53/58/63/69/77/86/86+
  const catsM = [60, 65, 71, 79, 88, 98, 110];
  const catsF = [48, 53, 58, 63, 69, 77, 86];
  const cats = sex === 'female' ? catsF : catsM;
  for (const c of cats) if (bw <= c) return `${c}`;
  return `+${cats[cats.length - 1]}`;
}
export function getMastersFactor(age: number): number {
  if (!age || age < 35) return 1;
  if (age < 40) return 1.02;
  if (age < 45) return 1.05;
  if (age < 50) return 1.09;
  if (age < 55) return 1.14;
  return 1.20;
}

export interface FinalizeOptions {
  outsideLoad?: any;
}

export function finalizeStrengthSportPlan(plan: StrengthSportPlan, opts?: FinalizeOptions): StrengthSportPlan {
  const warnings = [...(plan.validation?.warnings || [])];
  const errors = [...(plan.validation?.errors || [])];

  const onCourse = Array.isArray(plan.inputSnapshot?.peds) && (plan.inputSnapshot!.peds!.length>0);
  const lim = sessionLimitsFor(plan.level, plan.inputSnapshot?.trainingYears, onCourse);
  for (const wk of plan.weeksData) {
    for (const sess of wk.sessions) {
      // P0-9: per-exercise cap enforce
      for (const ex of sess.exercises) {
        if (ex.sets > lim.perExerciseCap) {
          warnings.push(`Нед ${wk.week} ${sess.sessionTag} ${ex.name}: ${ex.sets} > cap ${lim.perExerciseCap} — срезано.`);
          ex.sets = lim.perExerciseCap;
          ex.workSets = ex.workSets.slice(0, lim.perExerciseCap);
        }
        if (ex.workSets.length !== ex.sets) {
          // не всегда warning — тихо синхронизируем если расхождение 1 сет из-за deload
          ex.workSets = ex.workSets.slice(0, ex.sets);
          while (ex.workSets.length < ex.sets) ex.workSets.push({ reps: 3, rir: 2, weight: ex.weight, pct: 75, tempo: ex.tempo, restSeconds: ex.restSeconds } as any);
        }
      }
      // P0-9: enforce maxSets — режем accessory первыми
      let totalSets = sess.exercises.reduce((a, e) => a + e.sets, 0);
      if (totalSets > lim.maxSets) {
        warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${totalSets} сетов > лимита ${lim.maxSets} — срезано по accessory.`);
        // сортируем по приоритету: accessory с конца, но не трогаем последнюю primary если это единственная
        const priFirst = [...sess.exercises].sort((a, b) => (a.role === 'primary' ? -1 : 1));
        // фактически режем с конца accessory
        for (let i = sess.exercises.length - 1; i >= 0 && totalSets > lim.maxSets; i--) {
          const ex = sess.exercises[i];
          if (ex.role === 'accessory' || sess.exercises.filter(e => e.role === 'primary').length > 1 || ex.role !== 'primary') {
            if (ex.sets > 2) { ex.sets -= 1; ex.workSets = ex.workSets.slice(0, ex.sets); totalSets -= 1; }
          }
        }
        // если всё ещё превышает — режем любые с 3+ до 2
        for (let i = sess.exercises.length - 1; i >= 0 && totalSets > lim.maxSets; i--) {
          const ex = sess.exercises[i];
          if (ex.sets > 2) { ex.sets -= 1; ex.workSets = ex.workSets.slice(0, ex.sets); totalSets -= 1; }
        }
      }
      // P0-9: enforce maxExercises — убираем лишние accessory
      if (sess.exercises.length > lim.maxExercises) {
        warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${sess.exercises.length} упр > лимита ${lim.maxExercises} — убраны лишние accessory.`);
        // сохраняем primary, удаляем последние accessory
        const keep: typeof sess.exercises = [];
        const remove: typeof sess.exercises = [];
        for (const ex of sess.exercises) {
          if (ex.role === 'primary' || keep.length < lim.maxExercises) keep.push(ex);
          else remove.push(ex);
        }
        // если всё ещё много — срезаем с конца keep accessory (совместимость без findLastIndex)
        while (keep.length > lim.maxExercises) {
          let idx = -1;
          for (let i = keep.length - 1; i >= 0; i--) if ((keep[i] as any).role === 'accessory') { idx = i; break; }
          if (idx >= 0) keep.splice(idx, 1); else keep.pop();
        }
        sess.exercises = keep;
      }
    }
  }
  const syncErrs = validateSync(plan);
  for (const e of syncErrs) warnings.push(e);

  // outside highDays конфликт: тяж ноги накануне high вне зала → soft warning (+ P0-8: учитываем squat_day/deadlift_day/strength_day/event_day тяж)
  const out = opts?.outsideLoad || plan.inputSnapshot?.outsideLoad;
  const highDays: number[] = Array.isArray(out?.highIntensityDays) ? out.highIntensityDays : [];
  if (highDays.length) {
    for (const wk of plan.weeksData) {
      for (const sess of wk.sessions) {
        const dayIdx = sess.day - 1; // 0-6
        const tomorrow = (dayIdx + 1) % 7;
        const isLegHeavy = sess.sessionTag === 'squat_day' || sess.sessionTag === 'deadlift_day' || sess.sessionTag === 'strength_day' || sess.sessionTag === 'event_day';
        if (isLegHeavy && highDays.includes(tomorrow)) {
          warnings.push(`Нед ${wk.week} день ${sess.day} (${sess.sessionTag}) — тяж ноги/ивенты за день до внезальной высокой нагрузки (день ${tomorrow + 1}). Рекомендуем сдвинуть.`);
        }
      }
    }
  }

  // Deload — Helms: объём делода 45-50% среднего — enforce до 50% если перебор
  for (const wk of plan.weeksData) {
    if (wk.deload) {
      const avg = plan.weeksData.filter(w => !w.deload).reduce((s, w) => s + (w.totalSets || 0), 0) / Math.max(1, plan.weeksData.filter(w => !w.deload).length);
      if ((wk.totalSets || 0) > avg * 0.60) {
        warnings.push(`Делод нед ${wk.week}: объём ${wk.totalSets} > 60% среднего ${Math.round(avg)} — делод должен быть легче (Helms 45-50%).`);
      }
      // enforce: если делод >50% среднего — режем accessory до 50%
      const target = Math.round(avg * 0.50);
      if (avg > 0 && (wk.totalSets || 0) > target) {
        let cur = wk.totalSets || 0;
        for (const sess of wk.sessions) {
          for (let i = sess.exercises.length - 1; i >= 0 && cur > target; i--) {
            const ex = sess.exercises[i];
            if (ex.sets > 2) { ex.sets -= 1; ex.workSets = ex.workSets.slice(0, ex.sets); cur -= 1; }
          }
        }
        wk.totalSets = wk.sessions.reduce((a, s) => a + s.exercises.reduce((x, e) => x + e.sets, 0), 0);
      }
    }
  }

  // Объём per-lift vs landmarks (зальный) — P0-4 расширение
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    const liftsSnatch = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch','hang_snatch','power_snatch','muscle_snatch','snatch_balance','overhead_squat_v2'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
    const liftsClean = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['clean_and_jerk','hang_clean','power_clean','muscle_clean','push_jerk','split_jerk','clean_pull'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
    const liftsSquat = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['back_squat','front_squat','squat','hack_squat','front_squat_clean_grip','overhead_squat_v2'].includes(e.id))).reduce((a,e)=> a + e.sets,0);
    const liftsPull = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch_pull','clean_pull','rdl','deadlift','sumo_dl','axle_deadlift'].includes(e.id))).reduce((a,e)=> a + e.sets,0);
    const liftsOverhead = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['log_press','axle_press','push_press','ohp','circus_db_press','push_jerk','split_jerk','db_press','bench_bar'].includes(e.id))).reduce((a,e)=> a + e.sets,0);
    // carry дистанция из EVENT_META + fallback
    const CARRY_DIST: Record<string, number> = { yoke_walk:20, farmers_walk_heavy:40, frame_carry:20, husafell_carry:40, zercher_carry:20, sled_push_sprint:25, sled_push:20, tire_flip:15, sandbag_shoulder:15, sandbag_carry:30, sandbag_load:0, keg_toss:0, car_deadlift_18:0 };
    const carryIds = ['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry','zercher_carry','sled_push_sprint','tire_flip','sandbag_shoulder','sandbag_carry','sled_push','sled_drag'];
    const carrySets = wk.sessions.flatMap(s=> s.exercises.filter(e=> carryIds.includes(e.id))).reduce((a,e)=> a+e.sets,0);
    const carryMeters = wk.sessions.flatMap(s=> s.exercises.filter(e=> carryIds.includes(e.id))).reduce((a,e)=> {
      const d = (e.workSets[0] as any)?.distanceM ?? CARRY_DIST[e.id] ?? 20;
      return a + e.sets * d;
    }, 0);
    const stoneIds = ['atlas_stone_load','stone_lift','sandbag_shoulder','sandbag_load','tire_flip','keg_toss'];
    const stoneLifts = wk.sessions.flatMap(s=> s.exercises.filter(e=> stoneIds.includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
    const gripIds = ['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry','zercher_carry','sandbag_carry','farmers_walk'];
    const gripSets = wk.sessions.flatMap(s=> s.exercises.filter(e=> gripIds.includes(e.id))).reduce((a,e)=> a+e.sets,0);
    const lvl = plan.level;
    const lmS = getWL(lvl,'snatch');
    const lmC = getWL(lvl,'cleanJerk');
    const lmSq = plan.mode === 'strongman' ? getStrong(lvl,'squat') : getWL(lvl,'squat');
    const lmPull = getWL(lvl,'pull');
    const lmPress = plan.mode === 'strongman' ? getStrong(lvl,'overhead') : getWL(lvl,'press');
    const lmCarry = getStrong(lvl,'carry');
    const lmStone = getStrong(lvl,'stone');
    const lmGrip = getStrong(lvl,'grip');
    if (lmS && liftsSnatch > lmS.mrv) warnings.push(`Нед ${wk.week}: рывок ${liftsSnatch} подъёмов > MRV ${lmS.mrv} — перебор.`);
    if (lmC && liftsClean > lmC.mrv) warnings.push(`Нед ${wk.week}: толчок ${liftsClean} подъёмов > MRV ${lmC.mrv}.`);
    if (lmS && liftsSnatch < lmS.mev && plan.mode !== 'strongman') warnings.push(`Нед ${wk.week}: рывок ${liftsSnatch} < MEV ${lmS.mev} — недобор объёма.`);
    if (lmSq && liftsSquat > lmSq.mrv) warnings.push(`Нед ${wk.week}: присед ${liftsSquat} сетов > MRV ${lmSq.mrv}.`);
    if (lmPull && liftsPull > lmPull.mrv) warnings.push(`Нед ${wk.week}: тяги ${liftsPull} сетов > MRV ${lmPull.mrv}.`);
    if (lmPress && liftsOverhead > lmPress.mrv) warnings.push(`Нед ${wk.week}: жим/лог ${liftsOverhead} сетов > MRV ${lmPress.mrv}.`);
    if (lmCarry && carryMeters > lmCarry.mrv) warnings.push(`Нед ${wk.week}: переноски ${carryMeters}м > MRV ${lmCarry.mrv}м.`);
    if (lmStone && stoneLifts > lmStone.mrv) warnings.push(`Нед ${wk.week}: камни ${stoneLifts} подъёмов > MRV ${lmStone.mrv}.`);
    if (lmGrip && gripSets > lmGrip.mrv) warnings.push(`Нед ${wk.week}: хват ${gripSets} сетов > MRV ${lmGrip.mrv} — перебор (фермер+йок+рама).`);
    // PRO enforce: если перебор > MRV — режем accessory до MRV (как BB normalizeWeekMrv)
    const enforceCategory = (ids: string[], current: number, mrv: number, isLifts: boolean) => {
      if (current <= mrv) return;
      let over = current - mrv;
      for (const sess of wk.sessions) {
        for (let i = sess.exercises.length - 1; i >= 0 && over > 0; i--) {
          const ex = sess.exercises[i];
          if (!ids.includes(ex.id)) continue;
          if (ex.role !== 'accessory' && sess.exercises.filter(e => ids.includes(e.id) && e.role === 'primary').length <= 1) continue;
          if (isLifts) {
            // lifts — уменьшаем reps на 1 на сет (снижает lifts на sets)
            for (const ws of ex.workSets) { if (ws.reps > 1) { ws.reps -= 1; over -= 1; if (over <= 0) break; } }
            ex.reps = `${ex.workSets[0]?.reps || 1}-${ex.workSets[0]?.reps || 1}`;
          } else {
            if (ex.sets > 2) { ex.sets -= 1; ex.workSets = ex.workSets.slice(0, ex.sets); over -= 1; }
          }
        }
      }
      wk.totalSets = wk.sessions.reduce((a,s)=> a + s.exercises.reduce((x,e)=> x+e.sets,0),0);
    };
    if (lmSq && liftsSquat > lmSq.mrv) enforceCategory(['back_squat','front_squat','squat','hack_squat','front_squat_clean_grip','overhead_squat_v2','pause_squat','tempo_squat'], liftsSquat, lmSq.mrv, false);
    if (lmPull && liftsPull > lmPull.mrv) enforceCategory(['snatch_pull','clean_pull','rdl','deadlift','sumo_dl','axle_deadlift','car_deadlift_18','deficit_pull','pause_pull'], liftsPull, lmPull.mrv, false);
    if (lmPress && liftsOverhead > lmPress.mrv) enforceCategory(['log_press','axle_press','push_press','ohp','circus_db_press','push_jerk','split_jerk','db_press','bench_bar','pin_press'], liftsOverhead, lmPress.mrv, false);
    if (lmCarry && carryMeters > lmCarry.mrv) enforceCategory(['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry','zercher_carry','sled_push_sprint','sandbag_carry','sled_push'], carrySets, Math.round(lmCarry.mrv / 25), false);
    if (lmGrip && gripSets > lmGrip.mrv) enforceCategory(['farmers_walk_heavy','yoke_walk','frame_carry','husafell_carry','zercher_carry','sandbag_carry'], gripSets, lmGrip.mrv, false);
    if (lmS && liftsSnatch > lmS.mrv) enforceCategory(['snatch','hang_snatch','power_snatch','muscle_snatch','snatch_balance','overhead_squat_v2','deficit_snatch','block_snatch','pause_snatch'], liftsSnatch, lmS.mrv, true);
    if (lmC && liftsClean > lmC.mrv) enforceCategory(['clean_and_jerk','hang_clean','power_clean','muscle_clean','push_jerk','split_jerk','clean_pull','deficit_clean','block_clean','pause_clean'], liftsClean, lmC.mrv, true);
    // Weekly axial load score (High axial: yoke, stone, squat, dead) — Winwood
    const maxYokeAll = Math.max(0, ...wk.sessions.flatMap(s=> s.exercises.filter(e=> ['yoke_walk','frame_carry'].includes(e.id)).flatMap(e=> e.workSets.map(ws=> ws.weight))));
    const maxStoneAll = Math.max(0, ...wk.sessions.flatMap(s=> s.exercises.filter(e=> ['atlas_stone_load','sandbag_load','stone_lift'].includes(e.id)).flatMap(e=> e.workSets.map(ws=> ws.weight))));
    const axialSets = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['yoke_walk','frame_carry','atlas_stone_load','sandbag_load','back_squat','deadlift','car_deadlift_18'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
    if (axialSets >= 12 && (carryMeters > 300 || stoneLifts > 18)) {
      const axWarn = `Нед ${wk.week}: осевая недельная ${axialSets} сетов + ${carryMeters}м + ${stoneLifts} камней — высокая компрессия, добавьте кор 2× и +1 отдых.`;
      if (!warnings.includes(axWarn)) warnings.push(axWarn);
    }
    // Grip prehab auto — если перебор хвата >12 сетов
    if (gripSets > 12 && plan.mode === 'strongman') {
      const hasGripPrehab = wk.sessions.some(s=> s.exercises.some(e=> e.id.includes('wrist') || e.id.includes('hang')));
      if (!hasGripPrehab) warnings.push(`Нед ${wk.week}: хват ${gripSets} сетов — добавьте wrist_curl 2×15 + вис 30с.`);
    }
    // P2: Joint JSI — тяжёлые йок/лог >2.2×BW риск поясницы/плеча
    const bwAny = (plan.inputSnapshot as any)?.bodyweight as number | undefined;
    if (typeof bwAny === 'number' && bwAny > 0) {
      const maxYoke = Math.max(0, ...wk.sessions.flatMap(s=> s.exercises.filter(e=> e.id==='yoke_walk').flatMap(e=> e.workSets.map(ws=> ws.weight))));
      const maxLog = Math.max(0, ...wk.sessions.flatMap(s=> s.exercises.filter(e=> ['log_press','circus_db_press'].includes(e.id)).flatMap(e=> e.workSets.map(ws=> ws.weight))));
      const maxStone = Math.max(0, ...wk.sessions.flatMap(s=> s.exercises.filter(e=> ['atlas_stone_load','stone_lift'].includes(e.id)).flatMap(e=> e.workSets.map(ws=> ws.weight))));
      if (maxYoke > bwAny * 2.5) warnings.push(`Нед ${wk.week}: йок ${maxYoke}кг >2.5×BW — высокий стресс поясницы/колен, добавьте кор и +отдых.`);
      if (maxLog > bwAny * 0.9) warnings.push(`Нед ${wk.week}: лог ${maxLog}кг ~${Math.round(maxLog/bwAny*100)}% BW — контроль плеча, добавьте стабилизацию.`);
      if (maxStone > bwAny * 1.2) warnings.push(`Нед ${wk.week}: камень ${maxStone}кг >1.2×BW — поясница, используйте пояс и технику.`);
    }
    // P1 VBT — потеря скорости >20% (если передана)
    const vLoss = (plan.inputSnapshot as any)?.velocityLossPct as number | undefined;
    if (typeof vLoss === 'number' && vLoss > 20) {
      warnings.push(`Нед ${wk.week}: VBT потеря ${vLoss}% >20% — снизьте объём 10%, +1 RIR (усталость ЦНС).`);
    }
    // Full volume комбо: outside high + ACWR dangerous + VBT 30%
    const outM2 = out ? outsideVolumeMultiplier(out as any) : 1;
    const acwr2 = (plan.inputSnapshot as any)?.acwr as any;
    if (outM2 < 0.75 && acwr2?.zone === 'dangerous' && typeof vLoss === 'number' && vLoss >= 30) {
      warnings.push(`Нед ${wk.week}: комбо outside×${outM2.toFixed(2)} + ACWR dangerous + VBT ${vLoss}% — полный объём ×${(outM2*0.60*0.90).toFixed(2)}, RIR+3.`);
    }
    // P2 cardio для ТА — 1× zone2 30 мин для восстановления
    if (plan.mode === 'weightlifting' && !plan.outsideMetrics && wk.week === 1 && !(plan.inputSnapshot as any)?.cardioSuggested) {
      // soft рекомендация — не каждый план, только первая неделя
      if ((liftsSnatch + liftsClean) > 60) warnings.push(`Рекомендация: 1×/нед zone2 25-30 мин для активного восстановления (не мешает ТА, улучшает лактат).`);
    }
    // баланс push/pull — только для wl/hybrid; для strongman отдельно overhead vs carry?
    const push = liftsOverhead;
    const pull = liftsPull + wk.sessions.flatMap(s=> s.exercises.filter(e=> ['row_bar','row_db','pullup'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
    if (push>0 && pull>0 && plan.mode !== 'strongman') {
      const ratio = push / Math.max(1, pull);
      if (ratio > 1.8 || ratio < 0.55) warnings.push(`Нед ${wk.week}: дисбаланс push ${push} / pull ${pull} = ${ratio.toFixed(2)} — выровняйте тяги/жимы.`);
    }
    if (plan.mode === 'strongman' && carryMeters>0 && stoneLifts>0) {
      // стронг: carry vs stone баланс soft check
      if (carrySets > stoneLifts * 2) warnings.push(`Нед ${wk.week}: перекос в переноски ${carrySets} сетов vs камни ${stoneLifts} — добавьте камни.`);
    }
  }

  plan.validation = { ok: errors.length === 0, warnings: [...new Set(warnings)], errors };
  plan.rationale = [...plan.rationale, ...warnings.map(w => `⚠ ${w}`)];
  return plan;
}

export function buildStrengthSportReport(plan: StrengthSportPlan): string {
  const lines: string[] = [];
  lines.push(`Силовой экстрим/ТА: ${plan.mode} · ${plan.goal} · ${plan.level} · ${plan.weeks} нед · ${plan.patternId}`);
  if (plan.inputSnapshot?.focus) lines.push(`Фокус: ${plan.inputSnapshot.focus} · Методика: ${plan.inputSnapshot.methodology || 'compound_first'} · DUP: ${plan.inputSnapshot.dupMode || 'off'} · Техника: ${plan.inputSnapshot.intensityTech || 'none'}`);
  // P1/P3: Wilks/DOTS/IPF GL + Sinclair для ТА + IWF категория + Masters
  const bw = (plan.inputSnapshot as any)?.bodyweight as number | undefined;
  const sex = (plan.inputSnapshot as any)?.sex as string | undefined;
  const age = (plan.inputSnapshot as any)?.age as number | undefined;
  if (typeof bw === 'number' && bw > 30) {
    const wm = plan.workMax || {};
    let total = 0;
    if (plan.mode === 'weightlifting') total = (wm.snatch||0) + (wm.cleanJerk||wm.clean||0);
    else if (plan.mode === 'strongman') total = (wm.deadlift||0) + (wm.logPress||wm.overheadPress||0) + (wm.backSquat||0);
    else total = (wm.snatch||0) + (wm.cleanJerk||0) + (wm.backSquat||0);
    if (total > 0) {
      const dots = calcDOTS(bw, total);
      const wilks = calcWilks(bw, total);
      const ipf = calcIPFGL(bw, total);
      if (plan.mode === 'weightlifting') {
        const sinclair = calcSinclair(total, bw, sex||'male');
        const cat = getIWFCategory(bw, sex||'male');
        const masters = getMastersFactor(age||0);
        const sinM = Math.round(sinclair * masters);
        lines.push(`Вес: ${bw}кг ${sex||''} кат. ${cat} · Тотал ~${total}кг · Sinclair ${sinclair}${masters!==1?` (Masters ${sinM})`:''} · DOTS ${dots} · Wilks ${wilks}`);
      } else {
        lines.push(`Вес: ${bw}кг${sex?' '+sex:''} · Тотал ~${total}кг · DOTS ${dots} · Wilks ${wilks} · IPF GL ${ipf}`);
      }
    }
  }
  lines.push(`Сеты/нед: ${plan.weeksData.map(w => `Н${w.week}:${w.totalSets}${w.deload?' (делод)':''}`).join(' | ')}`);
  lines.push(`Тоннаж/нед: ${plan.weeksData.map(w => `Н${w.week}:${Math.round((w.totalTonnage || 0)/1000)}т`).join(' | ')}`);
  // heatmap per lift
  for (const wk of plan.weeksData) {
    const sn = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch','hang_snatch','power_snatch','muscle_snatch'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
    const sq = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['back_squat','front_squat','squat','hack_squat'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
    lines.push(`Нед ${wk.week} ${wk.phase}: рывок ${sn} подъёмов, присед ${sq} сетов, ${wk.sessions.length} сессий`);
  }
  if (plan.outsideMetrics) lines.push(`Вне зала: ${plan.outsideMetrics.weeklyLoad} load → ×${plan.outsideMetrics.volumeMultiplier} (${plan.outsideMetrics.interference}) ${plan.outsideMetrics.rationale.join(' | ')}`);
  lines.push(`Rationale: ${plan.rationale.slice(0,5).join(' | ')}`);
  if (plan.validation?.warnings.length) lines.push(`Предупреждения (${plan.validation.warnings.length}): ${plan.validation.warnings.slice(0,5).join(' | ')}`);
  if (plan.validation && !plan.validation.ok) lines.push(`Ошибки: ${plan.validation.errors.join(' | ')}`);
  return lines.join('\n');
}
