import type { TrainingSafetyReport } from './training-safety.types';

export interface SafetyGateDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  message: string;
}

/** Pure save/export policy shared by BB, PL, cardio and manual builders. */
export function trainingSafetyGate(report: TrainingSafetyReport, confirmedDanger = false): SafetyGateDecision {
  if (report.level === 'blocked') {
    return { allowed: false, requiresConfirmation: false, message: 'Сохранение заблокировано: устраните критические ограничения безопасности.' };
  }
  if (report.level === 'dangerous' && !confirmedDanger) {
    return { allowed: false, requiresConfirmation: true, message: 'План опасен: подтвердите сохранение после проверки рекомендаций.' };
  }
  if (report.level === 'dangerous') {
    return { allowed: true, requiresConfirmation: false, message: 'Опасный план сохранён после явного подтверждения.' };
  }
  if (report.level === 'caution') {
    return { allowed: true, requiresConfirmation: false, message: 'План сохранён с предупреждениями безопасности.' };
  }
  return { allowed: true, requiresConfirmation: false, message: 'План безопасен и может быть сохранён.' };
}
