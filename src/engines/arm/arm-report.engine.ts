/**
 * arm-report.engine.ts — отчёт по арм-плану (как bb-report).
 */
import type { ArmPlan, ArmReport } from './arm-types';
import { calcArmMetrics, armMetricsSummary } from './arm-metrics.engine';

export function buildArmReport(plan: ArmPlan): ArmReport {
  const metrics = calcArmMetrics(plan);
  const summary = `Арм-план: ${plan.discipline || 'armwrestling'} / ${plan.technique || 'balanced'} / ${plan.goal || 'strength'} — ${plan.weeks.length} нед, сплит ${plan.pattern.name}`;
  const phaseRationale: string[] = [];
  const byPhase: Record<string, number> = {};
  for (const wk of plan.weeks) byPhase[wk.phase] = (byPhase[wk.phase] || 0) + 1;
  for (const [ph, cnt] of Object.entries(byPhase)) phaseRationale.push(`${ph}: ${cnt} нед`);

  const volumeSummary = armMetricsSummary(metrics);

  const techniqueRationale: string[] = [];
  if (plan.technique === 'hook') techniqueRationale.push('Хук: акцент супинация + брахиалис + cup + back pressure. Супинация ставьте первой.');
  else if (plan.technique === 'toproll') techniqueRationale.push('Топролл: пронация + rising + brachioradialis + back pressure. Rising — каждый стол-день.');
  else if (plan.technique === 'press') techniqueRationale.push('Пресс: боковое + грудь/трицепс + плечо. Контроль кисти обязателен, не на блоке.');
  else techniqueRationale.push('Сбалансировано: пронация/супинация, cup/rising, side/back — равномерно.');

  const gripRationale: string[] = [];
  if (plan.discipline === 'armlifting' || plan.discipline === 'hybrid') {
    gripRationale.push('Армлифтинг: поддержка (Rolling Thunder/Axle) + щипок (Saxon/Hub) + дробление (CoC) — не смешивать.');
    if (plan.inputSnapshot?.gripImplement) gripRationale.push(`Имплемент: ${plan.inputSnapshot.gripImplement}`);
  }
  gripRationale.push(`Table time: ${(metrics.tableTimePct*100).toFixed(0)}% — цель ≥50% для армрестлинга (Кузнецов VIII).`);

  const warnings: string[] = [];
  if (metrics.tendonLoad > 80) warnings.push(`Tendon load ${metrics.tendonLoad} — много сухожильной работы, добавить восстановление`);
  if (metrics.sidePressureLoad > 20) warnings.push(`Side pressure ${metrics.sidePressureLoad} — проверить humerus guard`);
  if (metrics.tableTimePct < 0.4 && plan.discipline === 'armwrestling') warnings.push('Table time <40% — для армрестлинга мало стола');

  return { summary, phaseRationale, volumeSummary, techniqueRationale, gripRationale, warnings };
}
