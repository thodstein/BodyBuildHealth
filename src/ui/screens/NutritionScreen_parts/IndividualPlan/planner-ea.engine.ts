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
  /**
   * B16 (аудит 2026-10): % жира НЕ известен, `bodyFatPct` — заглушка.
   * Раньше в FFM уходили условные 15%/22%, и EA получалась ЗАВЫШЕННОЙ →
   * ложное «optimal» при фактическом дефиците (ложно-отрицательный RED-S).
   * При `true` FFM считается по весу (верхняя граница) — оценка консервативная.
   */
  bodyFatEstimated?: boolean;
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
    if (input.bodyFatEstimated) {
      // B16: данных о составе тела нет → КОНСЕРВАТИВНО считаем всю массу тощей
      // (FFM = вес). Это даёт НИЖНЮЮ границу EA, то есть повод проверить раньше,
      // а не ложное «optimal» на заниженном FFM.
      ffm = w;
    } else if (typeof input.bodyFatPct === 'number' && input.bodyFatPct > 3 && input.bodyFatPct < 60) {
      ffm = w * (1 - input.bodyFatPct / 100);
    } else {
      ffm = w * 0.85;
    }
  }
  ffm = Math.max(1, ffm);
  const mets = input.trainIntensity === 'high' ? 7 : input.trainIntensity === 'medium' ? 6 : 5;
  const hours = input.isTrainingDay ? (Math.max(0, Number(input.trainDurationMin) || 0) / 60) : 0;
  const eee = Math.round(mets * w * hours);
  // P1-фикс: NaN/Infinity из intake молча давал status 'optimal' (все сравнения false) —
  // на человеческом плане это ложное «зелёное». Нет данных → честный null-режим.
  const _eaRaw = (input.intakeKcal - eee) / ffm;
  const eaFinite = Number.isFinite(_eaRaw);
  const ea = eaFinite ? Math.round(_eaRaw) : 0;
  let status: EAStatus = 'optimal';
  let note: string | null = null;
  let zoneLabel = '✅ EA optimal ≥45';
  if (!eaFinite) {
    status = 'optimal';
    zoneLabel = '⚪ EA нет данных';
    note = null;
    return { ea: 0, ffm: Math.round(ffm), eee, status, note, zoneLabel };
  }
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
  // B16: без % жира статус «optimal» не должен выглядеть как измеренный факт.
  if (input.bodyFatEstimated) {
    const caution = '⚪ EA посчитана по весу: % жира не указан, оценка КОНСЕРВАТИВНАЯ (FFM = вес). Укажите % жира для точности.';
    note = note ? `${caution}\n${note}` : caution;
    if (status === 'optimal') zoneLabel = '⚪ EA optimal (оценка по весу)';
  }
  return { ea, ffm: Math.round(ffm), eee, status, note, zoneLabel };
}
