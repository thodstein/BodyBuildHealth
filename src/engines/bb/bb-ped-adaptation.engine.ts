/**
 * bb-ped-adaptation.engine.ts — адаптация BB-плана под фармакологию (Этап BB15/BB15b).
 * PED: ААС + ИНСУЛИН + MGF + IGF-1 + ГР. Каждое вещество по-своему влияет на
 * MRV/частоту/объём/восстановление/пери-тренировочное питание.
 *
 * Данные PED берутся из pharma-database/course (READ-only, не модифицируем —
 * параллельный агент владеет фарма-блоком). Здесь — только логика адаптации тренировки.
 */

export type PED = 'AAS' | 'insulin' | 'MGF' | 'IGF1' | 'GH';

export interface PEDEffect {
  ped: PED;
  mrvMultiplier: number;      // множитель MRV (толерантность к объёму)
  frequencyBonus: number;     // +сессий/нед допустимо
  recoveryMultiplier: number; // скорость восстановления
  periWorkoutCarbs?: 'high' | 'moderate' | 'low'; // углеводы вокруг тренировки
  notes: string;
}

/** Матрица эффектов PED на тренировочные параметры (Этап BB15b). */
export const PED_EFFECTS: Record<PED, PEDEffect> = {
  AAS: {
    ped: 'AAS',
    mrvMultiplier: 1.20, frequencyBonus: 1, recoveryMultiplier: 1.25,
    notes: 'Анаболические стероиды: MRV↑↑, восстановление↑, можно больше тяж-дней и частоты.',
  },
  insulin: {
    ped: 'insulin',
    mrvMultiplier: 1.15, frequencyBonus: 0, recoveryMultiplier: 1.15,
    periWorkoutCarbs: 'high',
    notes: 'Инсулин: гликоген-суперкомпенсация, питательные вещества в клетку. Требует высоких пери-WO углеводов. Риск гипогликемии.',
  },
  MGF: {
    ped: 'MGF',
    mrvMultiplier: 1.10, frequencyBonus: 0, recoveryMultiplier: 1.10,
    notes: 'Mechano Growth Factor: локальный ремонт мышц, отклик на механическую нагрузку → поддерживает высокий локальный объём.',
  },
  IGF1: {
    ped: 'IGF1',
    mrvMultiplier: 1.12, frequencyBonus: 0, recoveryMultiplier: 1.15,
    notes: 'IGF-1: системный анаболизм, восстановление, гипертрофия.',
  },
  GH: {
    ped: 'GH',
    mrvMultiplier: 1.15, frequencyBonus: 1, recoveryMultiplier: 1.20,
    notes: 'Гормон роста: ремонт тканей/коллаген, липолиз (рельеф), объём↑. На массе — синергия с инсулином. Инсулинорезистентность при длительном.',
  },
};

export interface PEDAdaptation {
  activePEDs: PED[];
  combinedMrvMultiplier: number;
  combinedFrequencyBonus: number;
  combinedRecoveryMultiplier: number;
  periWorkoutCarbs: 'high' | 'moderate' | 'low';
  adjustedMrv: Record<string, number>; // muscle -> скорректированный MRV
  rationale: string[];
  risks: string[];
}

/**
 * Рассчитать адаптацию по активным PED.
 * @param activePEDs — список активных веществ
 * @param baseMrv — базовый MRV по мышцам (из volume-landmarks)
 */
export function adaptForPEDs(activePEDs: PED[], baseMrv: Record<string, number>): PEDAdaptation {
  let mrvMult = 1, freqBonus = 0, recMult = 1;
  let carbs: 'high' | 'moderate' | 'low' = 'moderate';
  const rationale: string[] = [];
  const risks: string[] = [];
  for (const ped of activePEDs) {
    const e = PED_EFFECTS[ped];
    if (!e) continue;
    // комбинирование с убывающей отдачей (diminishing returns)
    mrvMult += (e.mrvMultiplier - 1) * 0.7;
    freqBonus += e.frequencyBonus;
    recMult += (e.recoveryMultiplier - 1) * 0.7;
    if (e.periWorkoutCarbs === 'high') carbs = 'high';
    rationale.push(`${ped}: MRV×${e.mrvMultiplier}, восст×${e.recoveryMultiplier} — ${e.notes}`);
  }
  // суммарный MRV множитель ограничен (нельзя бесконечно)
  mrvMult = Math.min(mrvMult, 1.6);
  const adjustedMrv: Record<string, number> = {};
  for (const m of Object.keys(baseMrv)) adjustedMrv[m] = Math.round(baseMrv[m] * mrvMult);

  // риски (BB15c — интеграция с risk-engine/pharma-interactions)
  if (activePEDs.includes('insulin')) risks.push('Инсулин: риск гипогликемии — контроль глюкозы, достаточные углеводы вокруг тренировки.');
  if (activePEDs.includes('GH')) risks.push('ГР: инсулинорезистентность при длительном использовании, возможны отёки.');
  if (activePEDs.includes('insulin') && activePEDs.includes('GH')) risks.push('Инсулин + ГР: синергия, но рост риска гипогликемии и инсулинорезистентности.');
  if (activePEDs.includes('AAS')) risks.push('ААС: контроль гематокрита, эстрадиола, липидов, оси HPTA.');

  return {
    activePEDs, combinedMrvMultiplier: mrvMult, combinedFrequencyBonus: freqBonus,
    combinedRecoveryMultiplier: recMult, periWorkoutCarbs: carbs, adjustedMrv, rationale, risks,
  };
}

/** Описание для UI. */
export function explainPEDAdaptation(a: PEDAdaptation): string {
  const lines = [
    `Активные PED: ${a.activePEDs.join(', ') || 'нет (натурал)'}`,
    `Суммарный MRV×${a.combinedMrvMultiplier.toFixed(2)}, восстановление×${a.combinedRecoveryMultiplier.toFixed(2)}, +${a.combinedFrequencyBonus} сессий/нед`,
    `Пери-WO углеводы: ${a.periWorkoutCarbs}`,
    ...a.rationale.map(x => '✓ ' + x),
    ...a.risks.map(x => '! ' + x),
  ];
  return lines.join('\n');
}