/**
 * planner-ea.engine.ts — Energy Availability (EA) for RED-S screening.
 *
 * Mountjoy 2018 IOC RED-S: EA = (EI - EEE) / FFM
 *   ≥45 optimal, 30-45 reduced/at-risk, <30 RED-S risk, <20 severe
 * Sex-specific notes: female → amenorrhea/bone, male → T/recovery
 * Pure function, testable.
 */

export type EAStatus = 'optimal' | 'reduced' | 'risk' | 'severe';

export interface EAInput {
  intakeKcal: number;
  weightKg: number;
  lbmKg: number; // if 0, derived from bodyFatPct or 0.85*weight
  bodyFatPct?: number;
  isTrainingDay: boolean;
  trainDurationMin?: number; // 0 if rest
  trainIntensity?: 'low' | 'medium' | 'high';
  sex?: 'male' | 'female';
  goalKcal?: number; // optional for context in note
}

export interface EAResult {
  ea: number; // kcal/kg FFM/day
  ffm: number;
  eee: number; // exercise EE kcal
  status: EAStatus;
  note: string | null;
  zoneLabel: string;
}

export function computeEA(input: EAInput): EAResult {
  const w = Math.max(30, Number(input.weightKg) || 80);
  let ffm = Number(input.lbmKg) || 0;
  if (!ffm || ffm <= 0) {
    if (typeof input.bodyFatPct === 'number' && input.bodyFatPct > 3 && input.bodyFatPct < 60) {
      ffm = w * (1 - input.bodyFatPct / 100);
    } else {
      ffm = w * 0.85;
    }
  }
  ffm = Math.max(1, ffm);
  const mets = input.trainIntensity === 'high' ? 7 : input.trainIntensity === 'medium' ? 6 : 5;
  const hours = input.isTrainingDay ? (Math.max(0, Number(input.trainDurationMin) || 0) / 60) : 0;
  const eee = Math.round(mets * w * hours);
  const ea = Math.round((input.intakeKcal - eee) / ffm);
  let status: EAStatus = 'optimal';
  let note: string | null = null;
  let zoneLabel = '✅ EA optimal ≥45';
  if (ea < 20) {
    status = 'severe';
    zoneLabel = '⛔ EA severe <20';
    note = `⛔ RED-S SEVERE: EA ${ea} ккал/кг FFM/день (<20). Критический дефицит — немедленное ↑ккал +500-700 или ↓EEE. Риск: кости, гормоны, иммунитет, MPS.`;
  } else if (ea < 30) {
    status = 'risk';
    zoneLabel = '🔴 EA risk <30';
    const eff = input.sex === 'female' ? 'аменорея/потеря костей/метаболическое замедление' : 'снижение тестостерона/восстановления/иммунитета';
    note = `🔴 RED-S риск: EA ${ea} ккал/кг FFM/день (<30). Дефицит слишком глубокий относительно нагрузки — ${eff}. Увеличьте ккал на +300-500 или снизьте объём. Целевой EA 40-45.`;
  } else if (ea < 45) {
    status = 'reduced';
    zoneLabel = '🟡 EA reduced 30-45';
    note = `🟡 EA ${ea} ккал/кг FFM/день (30-45, сниженная зона). Контролируйте восстановление/цикл/либидо; не задерживайтесь долго. Цель ≥45.`;
  }
  return { ea, ffm: Math.round(ffm), eee, status, note, zoneLabel };
}

export function eaZoneColor(status: EAStatus): string {
  switch (status) {
    case 'optimal': return '#22c55e';
    case 'reduced': return '#f59e0b';
    case 'risk': return '#ef4444';
    case 'severe': return '#7f1d1d';
  }
}
