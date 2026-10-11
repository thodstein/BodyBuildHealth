/**
 * arm-report.engine.ts — отчёт по арм-плану (как bb-report).
 */
import type { ArmPlan, ArmReport } from './arm-types';
import { calcArmMetrics, armMetricsSummary } from './arm-metrics.engine';
import { isArmTendonMuscle } from './arm-tendon-sets.engine';
import { aggregateArmVolume } from './arm-volume.engine';
import { getArmLandmarks } from './arm-volume-landmarks.engine';

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
  gripRationale.push(`Table sessions: ${(metrics.tableSessionShare * 100).toFixed(0)}% · table minutes: ${metrics.tableMinutesShare == null ? 'нет данных' : `${(metrics.tableMinutesShare * 100).toFixed(0)}%`} · table volume: ${(metrics.tableVolumeShare * 100).toFixed(0)}%.`);
  gripRationale.push(`Политика стола: target — доля сессий; минуты отображаются только при наличии длительностей.`);

  const warnings: string[] = [];
  // 26.10.2026 было→стало: пороги сравнивали СУММУ всех недель плана с недельными
  // гардами (humerus 6/9, tendon 22/18/12). 8–12-недельный план с нормой 8 tendon-
  // сетов/нед получал «Tendon load 96 — много» — ложная тревога. Теперь считаем
  // МАКСИМУМ по неделям (как недельные гарды) и добавляем среднее как контекст.
  let maxTendon = 0, maxSide = 0;
  for (const wk of plan.weeks) {
    const perWeek: Record<string, number> = {};
    for (const sess of wk.sessions) for (const ex of sess.exercises) perWeek[ex.muscle] = (perWeek[ex.muscle] || 0) + ex.sets;
    const wkTendon = Object.entries(perWeek).filter(([m]) => isArmTendonMuscle(m)).reduce((s, [, v]) => s + v, 0);
    const wkSide = perWeek['side_pressure'] || 0;
    if (wkTendon > maxTendon) maxTendon = wkTendon;
    if (wkSide > maxSide) maxSide = wkSide;
  }
  if (maxTendon > 22) warnings.push(`Tendon load ${maxTendon} сетов/нед (пиковая неделя) — много сухожильной работы, добавить восстановление`);
  if (maxSide > 9) warnings.push(`Side pressure ${maxSide} сетов/нед (пиковая неделя) — проверить humerus guard`);
  if (metrics.tableSessionShare < 0.4 && plan.discipline === 'armwrestling') warnings.push('Table sessions <40% — для армрестлинга мало стола');

  // 26.10.2026 (§7 плана): пиковый перебор MRV с РАЗБИВКОЙ прямой/косвенной.
  // Было: валидатор говорил только «N сетов > MRV» — непонятно, прямая работа или
  // косвенная (compound-нагрузка). Теперь в каждой строке — direct/effective.
  const level = plan.level || 'intermediate';
  const agg = aggregateArmVolume(plan.weeks as any);
  const weekCount = Math.max(1, plan.weeks.length);
  for (const [muscle, v] of Object.entries(agg)) {
    const directPerWeek = v.directSets / weekCount;
    const effectivePerWeek = v.effectiveSets / weekCount;
    if (effectivePerWeek <= 0) continue;
    const mrv = plan.mrvByMuscle?.[muscle] ?? getArmLandmarks(level, muscle).mrv;
    if (!Number.isFinite(mrv) || mrv <= 0 || effectivePerWeek <= mrv * 1.15 + 1e-9) continue;
    const r1 = (x: number) => Math.round(x * 10) / 10;
    const directShare = effectivePerWeek > 0 ? Math.round((directPerWeek / effectivePerWeek) * 100) : 0;
    warnings.push(
      `Н{пик} ${muscle}: эффективно ${r1(effectivePerWeek)}/нед (прямые ${r1(directPerWeek)} · косвенные ${r1(effectivePerWeek - directPerWeek)} = ${directShare}% прямых) > MRV ${mrv}×1.15 — перебор в основном ${directShare >= 70 ? 'прямой работой' : 'косвенной нагрузкой'}.`
    );
  }

  return { summary, phaseRationale, volumeSummary, techniqueRationale, gripRationale, warnings };
}
