/**
 * strength-sport-finalize.engine.ts — финальные проверки/баланс.
 * Аналог bb-finalize: капы, баланс, недели делода, outside-конфликты.
 */
import type { StrengthSportPlan } from './strength-sport.types';
import { getWL, getStrong } from './strength-sport-volume';
import { sessionLimitsFor, validateSync } from './strength-sport-limits';

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
      let totalSets = 0;
      for (const ex of sess.exercises) {
        if (ex.sets > lim.perExerciseCap) {
          warnings.push(`Нед ${wk.week} ${sess.sessionTag} ${ex.name}: ${ex.sets} > cap ${lim.perExerciseCap} — срезано.`);
          ex.sets = lim.perExerciseCap;
          ex.workSets = ex.workSets.slice(0, lim.perExerciseCap);
        }
        if (ex.workSets.length !== ex.sets) {
          warnings.push(`Нед ${wk.week} ${ex.name}: workSets ${ex.workSets.length} != sets ${ex.sets} — синхронизировано.`);
          ex.workSets = ex.workSets.slice(0, ex.sets);
          while (ex.workSets.length < ex.sets) ex.workSets.push({ reps: 3, rir: 2, weight: ex.weight, pct: 75, tempo: ex.tempo, restSeconds: ex.restSeconds } as any);
        }
        totalSets += ex.sets;
      }
      if (totalSets > lim.maxSets) warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${totalSets} сетов > лимита сессии ${lim.maxSets}`);
      if (sess.exercises.length > lim.maxExercises) warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${sess.exercises.length} упр > лимита ${lim.maxExercises}`);
    }
  }
  const syncErrs = validateSync(plan);
  for (const e of syncErrs) warnings.push(e);

  // outside highDays конфликт: тяж ноги накануне high вне зала → soft warning
  const out = opts?.outsideLoad || plan.inputSnapshot?.outsideLoad;
  const highDays: number[] = Array.isArray(out?.highIntensityDays) ? out.highIntensityDays : [];
  if (highDays.length) {
    for (const wk of plan.weeksData) {
      for (const sess of wk.sessions) {
        const dayIdx = sess.day - 1; // 0-6
        const tomorrow = (dayIdx + 1) % 7;
        const isLegHeavy = sess.sessionTag === 'squat_day' || sess.sessionTag === 'deadlift_day' || sess.sessionTag === 'strength_day';
        if (isLegHeavy && highDays.includes(tomorrow)) {
          warnings.push(`Нед ${wk.week} день ${sess.day} (${sess.sessionTag}) — тяж ноги за день до внезальной высокой нагрузки (день ${tomorrow + 1}). Рекомендуем сдвинуть.`);
        }
      }
    }
  }

  // Deload — проверка объёма срезан
  for (const wk of plan.weeksData) {
    if (wk.deload) {
      const avg = plan.weeksData.filter(w => !w.deload).reduce((s, w) => s + (w.totalSets || 0), 0) / Math.max(1, plan.weeksData.filter(w => !w.deload).length);
      if ((wk.totalSets || 0) > avg * 0.7) {
        warnings.push(`Делод нед ${wk.week}: объём ${wk.totalSets} > 70% среднего ${Math.round(avg)} — делод должен быть легче.`);
      }
    }
  }

  // Объём per-lift vs landmarks (зальный)
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    const liftsSnatch = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch','hang_snatch','power_snatch','muscle_snatch'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
    const liftsClean = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['clean_and_jerk','hang_clean','power_clean','muscle_clean','push_jerk','split_jerk'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
    const lvl = plan.level;
    const lmS = getWL(lvl,'snatch');
    const lmC = getWL(lvl,'cleanJerk');
    if (lmS && liftsSnatch > lmS.mrv) warnings.push(`Нед ${wk.week}: рывок ${liftsSnatch} подъёмов > MRV ${lmS.mrv} — перебор.`);
    if (lmC && liftsClean > lmC.mrv) warnings.push(`Нед ${wk.week}: толчок ${liftsClean} подъёмов > MRV ${lmC.mrv}.`);
    if (lmS && liftsSnatch < lmS.mev) warnings.push(`Нед ${wk.week}: рывок ${liftsSnatch} < MEV ${lmS.mev} — недобор объёма.`);
    // баланс push/pull
    const push = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['bench_bar','ohp','push_press','log_press','circus_db_press','push_jerk','split_jerk','db_press'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
    const pull = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['deadlift','sumo_dl','axle_deadlift','row_bar','row_db','pullup','snatch_pull','clean_pull'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
    if (push>0 && pull>0) {
      const ratio = push / Math.max(1, pull);
      if (ratio > 1.8 || ratio < 0.55) warnings.push(`Нед ${wk.week}: дисбаланс push ${push} / pull ${pull} = ${ratio.toFixed(2)} — выровняйте тяги/жимы.`);
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
