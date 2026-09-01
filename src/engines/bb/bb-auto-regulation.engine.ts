/**
 * bb-auto-regulation.engine.ts — Auto-Regulation 2.0.
 *
 * Авто-детекция перетренированности по комплексным метрикам:
 * - HRV (Heart Rate Variability) — снижение >10% от базы = перетрен
 * - Sleep hours — <6ч три дня подряд = перетрен
 * - ACWR >1.5 = опасная зона
 * - Stress level >7 = высокий стресс
 * - Subjective readiness (1-10) — <4 = skip training
 *
 * Helms 2022, Plews 2022, Kreher 2022.
 */
import { acuteChronicRatio, toDailyLoads } from '../pro/training-load.engine';
import { loadSRPESessions } from '../pro/srpe-store';

export type ReadinessLevel = 'optimal' | 'moderate' | 'low' | 'critical';
export type TrainingAction = 'train' | 'reduced' | 'active_recovery' | 'rest';

export interface ReadinessAssessment {
  level: ReadinessLevel;
  action: TrainingAction;
  score: number;
  factors: {
    hrv: 'good' | 'moderate' | 'low' | 'unknown';
    sleep: 'good' | 'moderate' | 'low' | 'unknown';
    acwr: 'optimal' | 'caution' | 'dangerous' | 'unknown';
    stress: 'low' | 'moderate' | 'high' | 'unknown';
  };
  recommendations: string[];
}

export interface AutoRegulationOverride {
  volumeMultiplier: number;
  intensityMultiplier: number;
  rirShift: number;
  reason: string;
}

export function assessReadiness(input: {
  hrvMs?: number;
  hrvBaseline?: number;
  sleepHours?: number;
  sleepDays?: number[];
  stressLevel?: number;
  subjectiveReadiness?: number;
  /** Текущий ACWR (acute:chronic workload ratio). Если не передан — вычисляется из дневника. */
  acwrRatio?: number;
}): ReadinessAssessment {
  let score = 100;
  const factors: ReadinessAssessment['factors'] = {
    hrv: 'unknown',
    sleep: 'unknown',
    acwr: 'unknown',
    stress: 'unknown',
  };
  const recommendations: string[] = [];

  // ACWR — вычисляем, если не передан. Фаза 1.2: фактор больше не «мёртвый».
  let acwr: number | undefined = input.acwrRatio;
  if (acwr == null || !Number.isFinite(acwr)) {
    try {
      const r = calculateACWR();
      if (Number.isFinite(r) && r !== 1.0) acwr = r;
    } catch { /* ignore */ }
  }
  if (acwr != null) {
    if (acwr > 1.5) {
      factors.acwr = 'dangerous';
      score -= 25;
      recommendations.push(`ACWR ${acwr.toFixed(2)} (>1.5) — опасная зона: объём растёт быстрее восстановления, необходима разгрузка.`);
    } else if (acwr > 1.3) {
      factors.acwr = 'caution';
      score -= 15;
      recommendations.push(`ACWR ${acwr.toFixed(2)} (1.3-1.5) — зона осторожности: снизьте объём.`);
    } else if (acwr >= 0.8) {
      factors.acwr = 'optimal';
    } else {
      factors.acwr = 'optimal';
      recommendations.push(`ACWR ${acwr.toFixed(2)} (<0.8) — недогруз: окно для прогрессии объёма.`);
    }
  }

  // HRV
  if (Number.isFinite(input.hrvMs) && Number.isFinite(input.hrvBaseline) && (input.hrvBaseline as number) > 0) {
    const hrvRatio = (input.hrvMs as number) / (input.hrvBaseline as number);
    if (hrvRatio > 0.9) {
      factors.hrv = 'good';
    } else if (hrvRatio > 0.8) {
      factors.hrv = 'moderate';
      score -= 10;
      recommendations.push('HRV немного ниже базы — мониторьте восстановление.');
    } else {
      factors.hrv = 'low';
      score -= 25;
      recommendations.push('HRV значительно ниже базы (>10%) — признак перетренированности.');
    }
  }

  // Sleep
  if (Number.isFinite(input.sleepHours)) {
    const sleep = input.sleepHours as number;
    if (sleep >= 7) {
      factors.sleep = 'good';
    } else if (sleep >= 6) {
      factors.sleep = 'moderate';
      score -= 5;
    } else {
      factors.sleep = 'low';
      score -= 20;
      recommendations.push(`Сон ${sleep}ч — недостаточно для восстановления (<6ч).`);
    }
  }

  // Consecutive bad sleep nights
  if (input.sleepDays && input.sleepDays.length >= 3) {
    const badNights = input.sleepDays.filter(h => Number.isFinite(h) && h < 6).length;
    if (badNights >= 3) {
      score -= 15;
      recommendations.push(`${badNights} ночей с недостаточным сном подряд — критическое снижение восстановления.`);
    }
  }

  // Stress
  if (Number.isFinite(input.stressLevel)) {
    const stress = input.stressLevel as number;
    if (stress < 4) {
      factors.stress = 'low';
    } else if (stress < 7) {
      factors.stress = 'moderate';
      score -= 5;
    } else {
      factors.stress = 'high';
      score -= 15;
      recommendations.push(`Высокий стресс (${stress}/10) — снижение тренировочного стимула.`);
    }
  }

  // Subjective readiness
  if (Number.isFinite(input.subjectiveReadiness)) {
    const readiness = input.subjectiveReadiness as number;
    if (readiness < 4) {
      score -= 20;
      recommendations.push(`Субъективная готовность ${readiness}/10 — очень низкая.`);
    } else if (readiness < 6) {
      score -= 10;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: ReadinessLevel;
  let action: TrainingAction;

  if (score >= 80) {
    level = 'optimal';
    action = 'train';
  } else if (score >= 60) {
    level = 'moderate';
    action = 'reduced';
    recommendations.unshift('Умеренная готовность — снизьте объём на 20%.');
  } else if (score >= 40) {
    level = 'low';
    action = 'active_recovery';
    recommendations.unshift('Низкая готовность — активное восстановление (лёгкая растяжка, МФР).');
  } else {
    level = 'critical';
    action = 'rest';
    recommendations.unshift('🚨 Критическая готовность — полный отдых. Тренировка противопоказана.');
  }

  return { level, action, score, factors, recommendations };
}

export function getAutoRegulationOverride(
  readiness: ReadinessAssessment,
): AutoRegulationOverride {
  switch (readiness.action) {
    case 'train':
      return { volumeMultiplier: 1.0, intensityMultiplier: 1.0, rirShift: 0, reason: 'Полная тренировка' };
    case 'reduced':
      return { volumeMultiplier: 0.8, intensityMultiplier: 0.95, rirShift: 1, reason: 'Сниженная тренировка: объём -20%, RIR +1' };
    case 'active_recovery':
      return { volumeMultiplier: 0.4, intensityMultiplier: 0.6, rirShift: 3, reason: 'Активное восстановление: объём -60%, RIR +3' };
    case 'rest':
      return { volumeMultiplier: 0, intensityMultiplier: 0, rirShift: 0, reason: 'Отдых — тренировка пропускается' };
  }
}

export function calculateACWR(): number {
  try {
    const srpe = loadSRPESessions();
    if (srpe.length < 4) return 1.0;
    const daily = toDailyLoads(srpe);
    const ratio = acuteChronicRatio(daily);
    return ratio.ratio;
  } catch {
    return 1.0;
  }
}