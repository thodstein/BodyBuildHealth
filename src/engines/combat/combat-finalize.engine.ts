/**
 * combat-finalize.engine.ts — финальные проверки для единоборств.
 * Отдельно от ББ/ПЛ, не трогает их логику.
 */
import type { CombatPlan, CombatSession } from './combat.types';
import { isDayConflictWithOutside } from '../outside-load.engine';
import { getCombat } from './combat-volume';
import { inCombatGroup, weekGroupSets } from './combat-groups';
import { sessionLimitsForCombat, validateSyncCombat } from './combat-limits';
import { combatHrvReport } from './combat-monitoring.engine';
import { cbRuInterference } from './combat-builder.engine';

/** Порог «не трогать»: единственный стимул мышцы. */
const PROTECTED_SCORE = 100;

/** «Цена удаления» упражнения: чем выше, тем жальнее удалять.
 *  primary-база и последний стимул мышцы получают высокий балл (их не режем). */
function removalPriority(ex: any, muscleCounts: Map<string, number>): number {
  const grp = ex.group || '';
  let score = 0;
  if ((muscleCounts.get(grp) || 0) <= 1) score += PROTECTED_SCORE; // единственный стимул мышцы
  if (ex.role === 'primary') score += 50;                            // база
  if (ex.pattern === 'plyo') score += 20;                           // плиометрика: легко вернуть
  if (inCombatGroup(ex.id, 'neck')) score += 40;                     // шея — превенция травм
  if (inCombatGroup(ex.id, 'grip')) score += 30;
  if (ex.pattern === 'isolation') score += 10;
  score += (ex.sets || 0);                                           // многосетные сетим первыми
  return score;
}

/**
 * ПРИМЕНЯЕТ лимиты сессии: удаляет упражнения, пока не влезем в
 * maxSets/maxExercises. Возвращает число удалённых упражнений (0 = уже ок).
 * Раньше превышение только предупреждалось, и перегруженная сессия доходила
 * до пользователя и в печать как есть.
 */
export function enforceSessionBudget(
  sess: CombatSession,
  lim: { maxSets: number; maxExercises: number },
  totalSets?: number,
  note?: (msg: string) => void,
): number {
  const setsOf = (s: CombatSession) => s.exercises.reduce((a, e) => a + (e.sets || 0), 0);
  let total = typeof totalSets === 'number' ? totalSets : setsOf(sess);
  let removed = 0;
  const recount = () => {
    const counts = new Map<string, number>();
    for (const e of sess.exercises) counts.set(e.group || '', (counts.get(e.group || '') || 0) + 1);
    return counts;
  };
  const prune = (overEx: number, overSets: number) => {
    while (sess.exercises.length > overEx || total > overSets) {
      const counts = recount();
      // priority = «цена удаления» (чем ниже, тем легче жертвуем); берём минимальную
      const candidates = sess.exercises.map((ex, i) => ({ ex, i, p: removalPriority(ex, counts) }));
      if (!candidates.length) return;
      candidates.sort((a, b) => a.p - b.p);
      const victim = candidates[0];
      if (victim.p >= PROTECTED_SCORE) return; // всё защищено (единственные стимулы/база) — предупреждение ниже
      note?.(`удалён ${victim.ex.name} — ${sess.exercises.length} упр / ${total} сетов > лимита ${overEx} / ${overSets}.`);
      sess.exercises.splice(victim.i, 1);
      total = setsOf(sess);
      removed++;
    }
  };
  prune(lim.maxExercises, lim.maxSets);
  // Если упражнения кончились (всё — последние стимулы своих мышц), уменьшаем
  // СЕТЫ вместо нарушения лимита: лучше 2×6, чем 3×6 при бюджете 14.
  const setFloor = (ex: any) => (ex.role === 'primary' ? 2 : 1);
  while (total > lim.maxSets) {
    const counts = recount();
    const reducible = sess.exercises
      .map((ex, i) => ({ ex, i, p: removalPriority(ex, counts) }))
      .filter(c => (c.ex.sets || 0) > setFloor(c.ex))
      .sort((a, b) => a.p - b.p);
    if (!reducible.length) break;
    const target = reducible[0].ex;
    target.sets -= 1;
    target.workSets = target.workSets.slice(0, target.sets);
    total = setsOf(sess);
    note?.(`${target.name}: сеты ${target.sets + 1}→${target.sets} ради лимита ${lim.maxSets} (упражнения кончились).`);
  }
  if (sess.exercises.length > lim.maxExercises || total > lim.maxSets) {
    note?.(`не влезло в лимит (${lim.maxExercises} упр / ${lim.maxSets} сетов): осталось ${sess.exercises.length} / ${total} — только база и последние стимулы мышц, снизьте сеты вручную.`);
  }
  return removed;
}

/** Пересчёт агрегатов недели. Вызывается для КАЖДОЙ недели (в т.ч. деload/тапер) —
 * иначе срезанные сеты не попадают в totalSets/tonnage и печать/XLSX/год врут. */
function recomputeWeekAggregates(wk: CombatPlan['weeksData'][number]): void {
  wk.totalSets = wk.sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.sets, 0), 0);
  (wk as any).totalTonnage = wk.sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.weight * ws.reps, 0), 0), 0);
}

export function finalizeCombatPlan(plan: CombatPlan): CombatPlan {
  const warnings = [...(plan.validation?.warnings || [])];
  const errors = [...(plan.validation?.errors || [])];

  const onCourse = Array.isArray(plan.inputSnapshot?.peds) && (plan.inputSnapshot!.peds!.length > 0);
  const lim = sessionLimitsForCombat(plan.level, onCourse);
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
          warnings.push(`Нед ${wk.week} ${ex.name}: workSets ${ex.workSets.length} != sets ${ex.sets}`);
          ex.workSets = ex.workSets.slice(0, ex.sets);
          while (ex.workSets.length < ex.sets) ex.workSets.push({ reps: 5, rir: 2, weight: ex.weight } as any);
        }
        totalSets += ex.sets;
      }
      // Бюджет сессии ПРИМЕНЯЕТСЯ: лишние упражнения удаляются, а не только
      // предупреждаются. Порядок удаления — необязательные и мелкие первыми,
      // базу (lead/compound) и последний стимул мышцы не трогаем.
      let removed = enforceSessionBudget(sess, lim, totalSets, (msg) => warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${msg}`));
      if (removed) totalSets = sess.exercises.reduce((s, e) => s + e.sets, 0);
      if (totalSets > lim.maxSets) warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${totalSets} сетов > лимита ${lim.maxSets}`);
      if (sess.exercises.length > lim.maxExercises) warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${sess.exercises.length} упр > лимита ${lim.maxExercises}`);
    }
  }
  for (const e of validateSyncCombat(plan)) warnings.push(e);

  // Группы vs landmarks + кап + auto-trim до MRV (единый классификатор combat-groups)
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    const neckSets = weekGroupSets(wk.sessions, 'neck');
    const gripSets = weekGroupSets(wk.sessions, 'grip');
    const rotSets = weekGroupSets(wk.sessions, 'rotational');
    const plyoSets = weekGroupSets(wk.sessions, 'plyo');
    const uniSets = weekGroupSets(wk.sessions, 'unilateral');
    const coreAnti = weekGroupSets(wk.sessions, 'core_anti') + (wk.sessions.reduce((a, s) => a + s.exercises.filter(e => e.id === 'suitcase_carry').reduce((x, e) => x + e.sets, 0), 0));
    const lmN = getCombat(plan.level, 'neck');
    const lmG = getCombat(plan.level, 'grip');
    const lmR = getCombat(plan.level, 'rotational');
    const lmP = getCombat(plan.level, 'plyo');
    const lmU = getCombat(plan.level, 'unilateral');

    /**
     * Мягкий авто-трим группы до MRV. Упражнения берутся «самые объёмные первыми»
     * в пределах своей сессии, поэтому сет не срезается у сессии, уже стоящей
     * на своём maxSets. Пол — 2 сета (ниже не режем: ниже 2 упражнение не работает).
     * Границ прохода нет: каждое упражнение уменьшается максимум до 2, суммарно
     * конечное число итераций = Σ(sets−2), что всегда конечно.
     */
    const trimToMRV = (group: string, mrv: number) => {
      let total = weekGroupSets(wk.sessions, group);
      if (total <= mrv) return total;
      for (const sess of wk.sessions) {
        const exs = sess.exercises.filter(e => inCombatGroup(e.id, group)).sort((a, b) => b.sets - a.sets);
        for (const ex of exs) {
          while (ex.sets > 2 && total > mrv) {
            ex.sets -= 1;
            ex.workSets = ex.workSets.slice(0, ex.sets);
            while (ex.workSets.length < ex.sets) ex.workSets.push({ reps: 5, rir: 2, weight: ex.weight } as any);
            total -= 1;
          }
        }
      }
      return total;
    };

    if (lmN && neckSets > lmN.mrv) {
      const after = trimToMRV('neck', lmN.mrv);
      if (after > lmN.mrv) warnings.push(`Нед ${wk.week}: шея ${after} > MRV ${lmN.mrv} — снизьте вручную (все упражнения на полу 2 сета).`);
      else warnings.push(`Нед ${wk.week}: шея срезана ${neckSets}→${after} до MRV ${lmN.mrv}.`);
    }
    if (lmG && gripSets > lmG.mrv) {
      const after = trimToMRV('grip', lmG.mrv);
      if (after > lmG.mrv) warnings.push(`Нед ${wk.week}: хват ${after} > MRV ${lmG.mrv} — снизьте вручную.`);
    }
    if (lmR && rotSets > lmR.mrv) {
      const after = trimToMRV('rotational', lmR.mrv);
      if (after > lmR.mrv) warnings.push(`Нед ${wk.week}: ротация ${after} > MRV ${lmR.mrv} — снизьте вручную.`);
    }
    if (lmP && plyoSets > lmP.mrv) {
      const after = trimToMRV('plyo', lmP.mrv);
      if (after > lmP.mrv) warnings.push(`Нед ${wk.week}: плиометрика ${after} > MRV ${lmP.mrv} — снизьте вручную.`);
      else warnings.push(`Нед ${wk.week}: плиометрика срезана ${plyoSets}→${after} до MRV ${lmP.mrv}.`);
    }
    if (lmU && uniSets > lmU.mrv) {
      const after = trimToMRV('unilateral', lmU.mrv);
      if (after > lmU.mrv) warnings.push(`Нед ${wk.week}: унилатераль ${after} > MRV ${lmU.mrv} — снизьте вручную.`);
      else warnings.push(`Нед ${wk.week}: унилатераль срезана ${uniSets}→${after} до MRV ${lmU.mrv}.`);
    }
    // пересчёт totalSets/tonnage после trim (для не-деload; деload/тапер — в финальном проходе ниже)
    recomputeWeekAggregates(wk);
    const neckAfter = weekGroupSets(wk.sessions, 'neck');
    const gripAfter = weekGroupSets(wk.sessions, 'grip');
    if (lmN && neckAfter < lmN.mev) warnings.push(`Нед ${wk.week}: шея ${neckAfter} < MEV ${lmN.mev} — недобор (Collins: +0.45кг шеи = −5% сотряс).`);
    if (lmG && gripAfter < (lmG.mev || 4)) warnings.push(`Нед ${wk.week}: хват ${gripAfter} < MEV ${lmG.mev} — добавьте хват.`);
    if (neckAfter > 14) warnings.push(`Нед ${wk.week}: шея ${neckAfter} сетов >14 — риск перегруза, оставьте изометрию.`);
    // шея 4 плоскости: флексия/экстензия/латераль/ротация — проверка мультипланарности (BJSM Delphi)
    const neckIds = wk.sessions.flatMap(s => s.exercises.filter(e => inCombatGroup(e.id, 'neck')).map(e => e.id));
    const hasFlex = neckIds.some(id => ['neck_flexion', 'neck_isometric_front', 'neck_eccentric_flexion'].includes(id));
    const hasExt = neckIds.some(id => ['neck_harness_ext', 'neck_bridge_wrestler', 'neck_isometric_back'].includes(id));
    const hasLat = neckIds.some(id => ['neck_lateral_flex', 'neck_isometric_side'].includes(id));
    const hasRot = neckIds.some(id => ['neck_rotation', 'neck_harness_rotation', 'neck_band_rotation_isometric'].includes(id));
    if (!hasFlex || !hasExt || !hasLat || !hasRot) warnings.push(`Нед ${wk.week}: шея не мультипланарна (flex:${hasFlex ? '✓' : '✗'} ext:${hasExt ? '✓' : '✗'} lat:${hasLat ? '✓' : '✗'} rot:${hasRot ? '✓' : '✗'}) — добавьте изометрию 4 плоскости (Iron Neck).`);
    if (coreAnti < 4) warnings.push(`Нед ${wk.week}: core anti <4 сетов (${coreAnti}) — добавьте deadbug/side plank/pallof.`);
    // prehab: auto-добавка если <3 сетов на upper — вставляем face_pull 3×15 в первую upper/full сессию (изолировано, не ломает бюджет)
    const hasUpper = wk.sessions.some(s=> s.sessionTag.includes('upper') || s.sessionTag.includes('full_power'));
    if (hasUpper) {
      const prehab = weekGroupSets(wk.sessions, 'prehab');
      if (prehab < 3) {
        const target = wk.sessions.find(s=> s.sessionTag.includes('upper_power')) || wk.sessions.find(s=> s.sessionTag.includes('full_power'));
        // №1: face_pull уже в целевой сессии (напр. 2 сета из пула) — второй экземпляр дал бы
        // дубль key={ex.id} в рендере; не пушим, а честно просим добить вручную
        if (target && target.exercises.some(e => e.id === 'face_pull')) {
          warnings.push(`Нед ${wk.week}: prehab <3 сетов (${prehab}), face_pull уже в плане — добейте его до 3×15 вручную (дубль не вставляем).`);
        } else {
          warnings.push(`Нед ${wk.week}: prehab <3 сетов (${prehab}) — авто-добавлен face_pull 3×15 для плеча.`);
          if (target && target.exercises.length < lim.maxExercises && target.exercises.reduce((a,e)=>a+e.sets,0) + 3 <= lim.maxSets) {
            const prePerEx = Math.min(3, lim.perExerciseCap);
            target.exercises.push({ id:'face_pull', name:'Тяга к лицу', group:'shoulders', pattern:'isolation', role:'accessory', character:'памп', sets: prePerEx, reps:'12-15', rir:3, weight: 15, workSets: Array.from({length:prePerEx},()=>({reps:13, rir:3, weight:15, tempo:'2-0-1-0', restSeconds:60})), tempo:'2-0-1-0', restSeconds:60, comment:'Prehab: скапула/ротаторы — авто' } as any);
            target.durationMin = (target.durationMin||0)+6;
          }
        }
      }
    }
    // баланс push/pull общий
    const push = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['bench_bar','ohp','push_press','landmine_press'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
    const pull = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['row_bar','pullup','gi_grip_pullup','fat_bar_row','single_arm_row','towel_pullup','rope_climb','high_pull'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
    if (push>0 && pull>0) {
      const r = push / Math.max(1,pull);
      if (r > 1.8 || r < 0.55) warnings.push(`Нед ${wk.week}: дисбаланс push ${push} / pull ${pull} = ${r.toFixed(2)} — выровняйте.`);
    }
    // горизонт vs вертикаль
    const pushH = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['bench_bar'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
    const pullH = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['row_bar','fat_bar_row','single_arm_row'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
    if (pushH>0 && pullH>0) {
      const rh = pushH / Math.max(1,pullH);
      if (rh > 1.8 || rh < 0.55) warnings.push(`Нед ${wk.week}: дисбаланс horiz push ${pushH}/pull ${pullH}=${rh.toFixed(2)}`);
    }
    const pushV = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['ohp','push_press','landmine_press'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
    const pullV = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['pullup','gi_grip_pullup','towel_pullup','rope_climb','high_pull'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
    if (pushV>0 && pullV>0) {
      const rv = pushV / Math.max(1,pullV);
      if (rv > 1.8 || rv < 0.55) warnings.push(`Нед ${wk.week}: дисбаланс vert push ${pushV}/pull ${pullV}=${rv.toFixed(2)}`);
    }
    // унилатеральные ноги vs билатеральные
    const uni = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['bulgarian_split_heavy','single_leg_rdl_combat','cossack_squat','step_up'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
    const bi = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['squat','front_squat','trap_bar_dead','zercher_squat'].includes(e.id))).reduce((a,e)=>a+e.sets,0);
    if (wk.sessions.some(s=> s.sessionTag==='lower_power' || s.sessionTag==='full_power')) {
      if (uni===0) warnings.push(`Нед ${wk.week}: нет унилатеральных ног — добавьте болгарский/казачий/step-up для баланса.`);
      if (bi===0 && uni>0) warnings.push(`Нед ${wk.week}: нет билатеральных ног — добавьте присед/тягу.`);
    }
  }

  // Фактические агрегаты для КАЖДОЙ недели (в т.ч. деload/тапер) — честные числа
  // для UI/печати/XLSX/года. Срезы per-exercise cap и MRV-трим уже применены выше.
  for (const wk of plan.weeksData) recomputeWeekAggregates(wk);

  // outside конфликт — уже в builder, дублируем проверку
  const out = plan.inputSnapshot?.outsideLoad;
  if (out?.highIntensityDays?.length) {
    for (const wk of plan.weeksData) {
      for (const sess of wk.sessions) {
        const isLeg = sess.sessionTag === 'lower_power' || sess.sessionTag === 'full_power';
        if (isLeg && sess.character === 'тяж' && isDayConflictWithOutside(sess.day - 1, out as any)) {
          // уже помечено в builder, но добавим warning если не помечено
          if (!sess.exercises.some(e => e.comment?.includes('внезальная'))) {
            warnings.push(`Нед ${wk.week} день ${sess.day}: тяж ноги накануне высокой внезальной.`);
          }
        }
      }
    }
  }

  // HRV — если есть история, добавляем градацию
  try {
    const hrv = combatHrvReport();
    if (hrv && hrv.grade !== 'optimal') warnings.push(`HRV ${hrv.last}мс (ср ${hrv.mean}±${hrv.sd}): ${hrv.note}`);
  } catch {}

  // Весогонка: проверка дефицита
  if (plan.inputSnapshot?.weightCutKg && plan.inputSnapshot.weightCutKg > 0 && plan.goal !== 'weight_cut') {
    warnings.push('Весогонка задана, но цель не weight_cut — объём зала не снижен должным образом.');
  }

  // rationale строится из ДЕДУПленных предупреждений (иначе каждое нарушение
  // видно дважды — в rationale и в validation.warnings, т.к. buildCombatReport
  // читает оба источника). Повторная финализация не дублирует строки.
  const uniq = [...new Set(warnings)];
  plan.validation = { ok: errors.length === 0, warnings: uniq, errors };
  const already = new Set(plan.rationale.map(r => r.replace(/^[⚠•]\s*/, '')));
  plan.rationale = [...plan.rationale, ...uniq.filter(w => !already.has(w)).map(w => `⚠ ${w}`)];
  return plan;
}

/**
 * Канон «заблокированности» плана: один источник для гейтов UI (кнопки экспорта)
 * и прямых вызовов (exportToUserProgram). UI дублировать проверку inline запрещено.
 */
export function isCombatPlanBlocked(plan: CombatPlan | null | undefined): boolean {
  if (!plan) return false;
  return (plan.validation?.errors?.length || 0) > 0;
}

export function buildCombatReport(plan: CombatPlan): string {
  const lines: string[] = [];
  lines.push(`Единоборства: ${plan.discipline} · ${plan.goal} · ${plan.level} · ${plan.weeks} нед · ${plan.patternId}`);
  if (plan.inputSnapshot?.methodology || plan.inputSnapshot?.dupMode || plan.inputSnapshot?.intensityTech) lines.push(`Методика: ${plan.inputSnapshot.methodology || 'compound_first'} · DUP: ${plan.inputSnapshot.dupMode || 'off'} · Техника: ${plan.inputSnapshot.intensityTech || 'none'}`);
  lines.push(`Сеты/нед: ${plan.weeksData.map(w => `Н${w.week}:${w.totalSets}${w.deload?' (делод)':''}`).join(' | ')}`);
  for (const wk of plan.weeksData) {
    const neck = wk.sessions.reduce((a,s)=> a + s.exercises.filter(e=> e.id.includes('neck')).reduce((x,e)=> x+e.sets,0),0);
    const grip = wk.sessions.reduce((a,s)=> a + s.exercises.filter(e=> e.id.includes('grip')||e.id.includes('pinch')||e.id.includes('wrist')).reduce((x,e)=> x+e.sets,0),0);
    lines.push(`Нед ${wk.week} ${wk.phase}: шея ${neck} сетов, хват ${grip}, ${wk.sessions.length} сессий`);
  }
  if (plan.outsideMetrics) lines.push(`Вне зала: ${plan.outsideMetrics.weeklyLoad} load → ×${plan.outsideMetrics.volumeMultiplier} (${cbRuInterference(plan.outsideMetrics.interference)}) ${plan.outsideMetrics.rationale.join(' | ')}`);
  lines.push(`Rationale: ${plan.rationale.slice(0,5).join(' | ')}`);
  if (plan.validation?.warnings.length) lines.push(`Предупреждения (${plan.validation.warnings.length}): ${plan.validation.warnings.slice(0,5).join(' | ')}`);
  if (plan.validation && !plan.validation.ok) lines.push(`Ошибки: ${plan.validation.errors.join(' | ')}`);
  return lines.join('\n');
}
