/**
 * combat-finalize.engine.ts — финальные проверки для единоборств.
 * Отдельно от ББ/ПЛ, не трогает их логику.
 */
import type { CombatPlan } from './combat.types';
import { isDayConflictWithOutside } from '../outside-load.engine';
import { getCombat } from './combat-volume';

export function finalizeCombatPlan(plan: CombatPlan): CombatPlan {
  const warnings = [...(plan.validation?.warnings || [])];
  const errors = [...(plan.validation?.errors || [])];

  // Кап сетов на упражнение
  for (const wk of plan.weeksData) {
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        if (ex.sets > 5) {
          warnings.push(`Нед ${wk.week} ${sess.sessionTag} ${ex.name}: ${ex.sets} > 5 — срезано.`);
          ex.sets = 5;
          ex.workSets = ex.workSets.slice(0, 5);
        }
      }
    }
  }

  // Шея/хват/ротация vs landmarks + кап
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    const neckSets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('neck')).reduce((a, e) => a + e.sets, 0), 0);
    const gripSets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('grip')||e.id.includes('pinch')||e.id.includes('wrist')).reduce((a, e) => a + e.sets, 0), 0);
    const rotSets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('landmine')||e.id.includes('pallof')||e.id.includes('med_ball')).reduce((a, e) => a + e.sets, 0), 0);
    const lmN = getCombat(plan.level,'neck');
    const lmG = getCombat(plan.level,'grip');
    const lmR = getCombat(plan.level,'rotational');
    if (lmN && neckSets > lmN.mrv) warnings.push(`Нед ${wk.week}: шея ${neckSets} > MRV ${lmN.mrv} — снизьте.`);
    if (lmN && neckSets < lmN.mev) warnings.push(`Нед ${wk.week}: шея ${neckSets} < MEV ${lmN.mev} — недобор.`);
    if (lmG && gripSets > lmG.mrv) warnings.push(`Нед ${wk.week}: хват ${gripSets} > MRV ${lmG.mrv}.`);
    if (lmR && rotSets > lmR.mrv) warnings.push(`Нед ${wk.week}: ротация ${rotSets} > MRV ${lmR.mrv}.`);
    if (neckSets > 12) warnings.push(`Нед ${wk.week}: шея ${neckSets} сетов > 12 — риск.`);
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
  lines.push(`Единоборства: ${plan.discipline} · ${plan.goal} · ${plan.weeks} нед · ${plan.patternId}`);
  lines.push(`Сеты/нед: ${plan.weeksData.map(w => `Н${w.week}:${w.totalSets}`).join(' ')}`);
  if (plan.outsideMetrics) lines.push(`Вне зала: ${plan.outsideMetrics.weeklyLoad} load → ×${plan.outsideMetrics.volumeMultiplier} (${plan.outsideMetrics.interference})`);
  if (plan.validation?.warnings.length) lines.push(`Предупреждения: ${plan.validation.warnings.join(' | ')}`);
  return lines.join('\n');
}
