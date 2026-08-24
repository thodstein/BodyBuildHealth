/**
 * combat-finalize.engine.ts — финальные проверки для единоборств.
 * Отдельно от ББ/ПЛ, не трогает их логику.
 */
import type { CombatPlan } from './combat.types';
import { isDayConflictWithOutside } from '../outside-load.engine';

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

  // Шея: не более 12 сетов/нед (травмоопасно)
  for (const wk of plan.weeksData) {
    const neckSets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('neck')).reduce((a, e) => a + e.sets, 0), 0);
    if (neckSets > 12) warnings.push(`Нед ${wk.week}: шея ${neckSets} сетов > 12 — снизьте (риск).`);
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
