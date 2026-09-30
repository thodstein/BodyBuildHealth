/**
 * Волна 0, п. 0.2 — исполнение валидатора при сохранении BB-плана.
 *
 * Раньше кнопки сохранения (he_bb_plan_saved / Мои тренировки / вариант)
 * показывали предупреждение, но запись всё равно проходила: план с
 * error-ами валидации (например sets_mismatch) или SafetyScore < 60
 * достигал хранилища и мог быть исполнен по дневнику.
 *
 * Канон: небезопасный план НЕ сохраняется — возвращаем честную причину
 * (её показывает flash), либо null, если сохранять можно.
 */
import type { PlanSafetyScore } from '../../../engines/bb/bb-safety-score.engine';

export interface BBPlanSaveCheckPlan {
  validation?: {
    valid?: boolean;
    issues?: Array<{ level?: string; message?: string }>;
  } | null;
}

/** Причина блокировки сохранения или null (можно сохранять). */
export function bbPlanSaveBlockReason(
  plan: BBPlanSaveCheckPlan | null | undefined,
  safety: Pick<PlanSafetyScore, 'score' | 'riskLevel' | 'recommendations'> | null | undefined,
): string | null {
  if (!plan) return 'План не собран';
  if (!plan.validation?.valid) {
    const first = plan.validation?.issues?.find(i => i.level === 'error')?.message;
    return `⛔ План не сохранён: ошибки валидации${first ? ` — ${first}` : ''}. Исправьте в «Коррекции».`;
  }
  if (safety && safety.riskLevel === 'dangerous') {
    return `⛔ План не сохранён: SafetyScore ${safety.score}/100 (<60 — критические риски). ${safety.recommendations?.[0] || ''}`.trim();
  }
  return null;
}
