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
  recoveryMultiplier: number; // скорость восстановления
  periWorkoutCarbs?: 'high' | 'moderate' | 'low'; // углеводы вокруг тренировки
  notes: string;
}

/** Матрица эффектов PED на тренировочные параметры (ББ-специфичные, клинические данные + RP). */
export const PED_EFFECTS: Record<PED, PEDEffect> = {
  AAS: {
    ped: 'AAS',
    mrvMultiplier: 1.35, recoveryMultiplier: 1.35,
    periWorkoutCarbs: 'moderate',
    notes: 'ААС (500 мг тест/нед): синтез белка ×2-3, восстановление ↑↑, MRV +35% (Israetel enhanced). Каждые +250 мг ≈ +5% к MRV.',
  },
  insulin: {
    ped: 'insulin',
    mrvMultiplier: 1.28, recoveryMultiplier: 1.25,
    periWorkoutCarbs: 'high',
    notes: 'Инсулин: суперкомпенсация гликогена, шунт нутриентов в клетку, +28% работоспособности. Требует высоких углеводов вокруг тренировки.',
  },
  MGF: {
    ped: 'MGF',
    mrvMultiplier: 1.10, recoveryMultiplier: 1.12,
    notes: 'MGF (PEG-MGF): локальная активация сателлитных клеток, +10% локального объёма. Эффект ограничен тренируемыми мышцами.',
  },
  IGF1: {
    ped: 'IGF1',
    mrvMultiplier: 1.18, recoveryMultiplier: 1.18,
    notes: 'IGF-1 LR3: системный анаболизм, гиперплазия, +18% MRV.',
  },
  GH: {
    ped: 'GH',
    mrvMultiplier: 1.22, recoveryMultiplier: 1.25,
    notes: 'ГР (4 МЕ/день): ремонт соединительной ткани, липолиз, +22% MRV. Синергия с инсулином (IGF-1↑).',
  },
};

export interface PEDAdaptation {
  activePEDs: PED[];
  combinedMrvMultiplier: number;
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
  let mrvMult = 1, recMult = 1;
  let carbs: 'high' | 'moderate' | 'low' = 'moderate';
  const rationale: string[] = [];
  const risks: string[] = [];
  for (const ped of activePEDs) {
    const e = PED_EFFECTS[ped];
    if (!e) continue;
    // Комбинирование с убывающей отдачей (ББ-специфичный diminishing 0.80).
    // Каждый следующий препарат даёт 80% от своего соло-эффекта.
    mrvMult += (e.mrvMultiplier - 1) * 0.80;
    recMult += (e.recoveryMultiplier - 1) * 0.80;
    if (e.periWorkoutCarbs === 'high') carbs = 'high';
    rationale.push(`${ped}: MRV ×${e.mrvMultiplier.toFixed(2)}, восст ×${e.recoveryMultiplier.toFixed(2)} — ${e.notes}`);
  }
  // Суммарный множитель: натурал = 1.0, соло-ААС = ~1.28, полный стек до 1.80
  mrvMult = Math.min(mrvMult, 1.80);
  const adjustedMrv: Record<string, number> = {};
  for (const m of Object.keys(baseMrv)) adjustedMrv[m] = Math.round(baseMrv[m] * mrvMult);

  // риски (BB15c — интеграция с risk-engine/pharma-interactions)
  if (activePEDs.includes('insulin')) risks.push('Инсулин: риск гипогликемии — контроль глюкозы, достаточные углеводы вокруг тренировки.');
  if (activePEDs.includes('GH')) risks.push('ГР: инсулинорезистентность при длительном использовании, возможны отёки.');
  if (activePEDs.includes('insulin') && activePEDs.includes('GH')) risks.push('Инсулин + ГР: синергия, но рост риска гипогликемии и инсулинорезистентности.');
  if (activePEDs.includes('AAS')) risks.push('ААС: контроль гематокрита, эстрадиола, липидов, оси HPTA.');

  return {
    activePEDs, combinedMrvMultiplier: mrvMult,
    combinedRecoveryMultiplier: recMult, periWorkoutCarbs: carbs, adjustedMrv, rationale, risks,
  };
}

/** Описание для UI. */
export function explainPEDAdaptation(a: PEDAdaptation): string {
  const lines = [
    `Активные PED: ${a.activePEDs.join(', ') || 'нет (натурал)'}`,
    `Суммарный MRV×${a.combinedMrvMultiplier.toFixed(2)}, восстановление×${a.combinedRecoveryMultiplier.toFixed(2)}`,
    `Пери-WO углеводы: ${a.periWorkoutCarbs}`,
    ...a.rationale.map(x => '✓ ' + x),
    ...a.risks.map(x => '! ' + x),
  ];
  return lines.join('\n');
}