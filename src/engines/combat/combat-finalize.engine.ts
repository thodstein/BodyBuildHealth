/**
 * combat-finalize.engine.ts — финальные проверки для единоборств.
 * Отдельно от ББ/ПЛ, не трогает их логику.
 */
import type { CombatPlan } from './combat.types';
import { isDayConflictWithOutside } from '../outside-load.engine';
import { getCombat } from './combat-volume';
import { sessionLimitsForCombat, validateSyncCombat } from './combat-limits';

export function finalizeCombatPlan(plan: CombatPlan): CombatPlan {
  const warnings = [...(plan.validation?.warnings || [])];
  const errors = [...(plan.validation?.errors || [])];

  const onCourse = Array.isArray(plan.inputSnapshot?.peds) && (plan.inputSnapshot!.peds!.length>0);
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
      if (totalSets > lim.maxSets) warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${totalSets} сетов > лимита ${lim.maxSets}`);
      if (sess.exercises.length > lim.maxExercises) warnings.push(`Нед ${wk.week} ${sess.sessionTag}: ${sess.exercises.length} упр > лимита ${lim.maxExercises}`);
    }
  }
  for (const e of validateSyncCombat(plan)) warnings.push(e);

  // Шея/хват/ротация vs landmarks + кап
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    const neckSets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('neck')).reduce((a, e) => a + e.sets, 0), 0);
    const gripSets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('grip')||e.id.includes('pinch')||e.id.includes('wrist')||e.id.includes('farmer')||e.id.includes('towel')).reduce((a, e) => a + e.sets, 0), 0);
    const rotSets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('landmine')||e.id.includes('pallof')||e.id.includes('med_ball')||e.id.includes('sledge')||e.id.includes('battle')).reduce((a, e) => a + e.sets, 0), 0);
    const coreAnti = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => ['deadbug','hollow_hold','side_plank','ab_wheel','copenhagen_plank','pallof_rotation_press','suitcase_carry'].includes(e.id)).reduce((a,e)=>a+e.sets,0),0);
    const lmN = getCombat(plan.level,'neck');
    const lmG = getCombat(plan.level,'grip');
    const lmR = getCombat(plan.level,'rotational');
    if (lmN && neckSets > lmN.mrv) warnings.push(`Нед ${wk.week}: шея ${neckSets} > MRV ${lmN.mrv} — снизьте.`);
    if (lmN && neckSets < lmN.mev) warnings.push(`Нед ${wk.week}: шея ${neckSets} < MEV ${lmN.mev} — недобор.`);
    if (lmG && gripSets > lmG.mrv) warnings.push(`Нед ${wk.week}: хват ${gripSets} > MRV ${lmG.mrv}.`);
    if (lmG && gripSets < (lmG.mev||4)) warnings.push(`Нед ${wk.week}: хват ${gripSets} < MEV ${lmG.mev} — добавьте хват.`);
    if (lmR && rotSets > lmR.mrv) warnings.push(`Нед ${wk.week}: ротация ${rotSets} > MRV ${lmR.mrv}.`);
    if (neckSets > 12) warnings.push(`Нед ${wk.week}: шея ${neckSets} сетов > 12 — риск.`);
    if (coreAnti < 4) warnings.push(`Нед ${wk.week}: core anti <4 сетов (${coreAnti}) — добавьте deadbug/side plank/pallof.`);
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

  // Весогонка: проверка дефицита
  if (plan.inputSnapshot?.weightCutKg && plan.inputSnapshot.weightCutKg > 0 && plan.goal !== 'weight_cut') {
    warnings.push('Весогонка задана, но цель не weight_cut — объём зала не снижен должным образом.');
  }

  plan.validation = { ok: errors.length === 0, warnings: [...new Set(warnings)], errors };
  plan.rationale = [...plan.rationale, ...warnings.map(w => `⚠ ${w}`)];
  return plan;
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
  if (plan.outsideMetrics) lines.push(`Вне зала: ${plan.outsideMetrics.weeklyLoad} load → ×${plan.outsideMetrics.volumeMultiplier} (${plan.outsideMetrics.interference}) ${plan.outsideMetrics.rationale.join(' | ')}`);
  lines.push(`Rationale: ${plan.rationale.slice(0,5).join(' | ')}`);
  if (plan.validation?.warnings.length) lines.push(`Предупреждения (${plan.validation.warnings.length}): ${plan.validation.warnings.slice(0,5).join(' | ')}`);
  if (plan.validation && !plan.validation.ok) lines.push(`Ошибки: ${plan.validation.errors.join(' | ')}`);
  return lines.join('\n');
}
