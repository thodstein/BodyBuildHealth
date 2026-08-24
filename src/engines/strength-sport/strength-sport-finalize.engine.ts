/**
 * strength-sport-finalize.engine.ts — финальные проверки/баланс.
 * Аналог bb-finalize: капы, баланс, недели делода, outside-конфликты.
 */
import type { StrengthSportPlan } from './strength-sport.types';
import { outsideVolumeMultiplier } from '../outside-load.engine';

export interface FinalizeOptions {
  outsideLoad?: any;
}

export function finalizeStrengthSportPlan(plan: StrengthSportPlan, opts?: FinalizeOptions): StrengthSportPlan {
  const warnings = [...(plan.validation?.warnings || [])];
  const errors = [...(plan.validation?.errors || [])];

  // Кап сетов на упражнение (про-правило)
  for (const wk of plan.weeksData) {
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        if (ex.sets > 6) {
          warnings.push(`Нед ${wk.week} ${sess.sessionTag} ${ex.name}: ${ex.sets} сетов > 6 — срезано до 6.`);
          ex.sets = 6;
          ex.workSets = ex.workSets.slice(0, 6);
        }
      }
    }
  }

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

  plan.validation = { ok: errors.length === 0, warnings: [...new Set(warnings)], errors };
  plan.rationale = [...plan.rationale, ...warnings.map(w => `⚠ ${w}`)];
  return plan;
}

export function buildStrengthSportReport(plan: StrengthSportPlan): string {
  const lines: string[] = [];
  lines.push(`Силовой экстрим/ТА: ${plan.mode} · ${plan.goal} · ${plan.weeks} нед · ${plan.patternId}`);
  lines.push(`Сеты/нед: ${plan.weeksData.map(w => `Н${w.week}:${w.totalSets}`).join(' ')}`);
  lines.push(`Тоннаж/нед: ${plan.weeksData.map(w => `Н${w.week}:${Math.round((w.totalTonnage || 0)/1000)}т`).join(' ')}`);
  if (plan.outsideMetrics) lines.push(`Вне зала: ${plan.outsideMetrics.weeklyLoad} load → ×${plan.outsideMetrics.volumeMultiplier}`);
  if (plan.validation?.warnings.length) lines.push(`Предупреждения: ${plan.validation.warnings.join(' | ')}`);
  return lines.join('\n');
}
