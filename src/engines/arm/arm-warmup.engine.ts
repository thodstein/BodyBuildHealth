/**
 * arm-warmup.engine.ts — TOP T6b: арм-разминка генератор.
 *
 * Источники: StrengthLog (динамика плечи/локти/кисти + band traction +
 * лёгкие ротации), GoldenGrip (rice-bucket/band/iso + 30% ready-go репетиция).
 * Выдаёт чеклист под сессию (тяж/памп/техника/стол), 8–12 мин.
 * Чистый модуль.
 */

export type WarmupSessionKind = 'heavy' | 'pump' | 'tech' | 'table' | 'grip';

export interface ArmWarmupStep {
  title: string;
  dose: string;
}

export interface ArmWarmup {
  minutes: number;
  steps: ArmWarmupStep[];
  readyGoRehearsal: boolean;
  note: string;
}

export function buildArmWarmup(kind: string = 'heavy'): ArmWarmup {
  const k = String(kind).toLowerCase();
  const base: ArmWarmupStep[] = [
    { title: 'Кардио 3–5 мин', dose: 'лёгкое, до тепла' },
    { title: 'Плечи: махи + вращения + band traction', dose: '2×15' },
    { title: 'Локти: сгибания/разгибания лёгкие', dose: '2×20' },
    { title: 'Кисти: вращения + сгибания/разгибания', dose: '2×20' },
    { title: 'Пронация/супинация с резинкой', dose: '2×15 каждая' },
  ];
  if (k === 'table') {
    return {
      minutes: 12,
      steps: [...base, { title: 'Изометрия у стола 50%', dose: '3×10с' }, { title: 'Ready-go репетиция 30%', dose: '6×3с (только тайминг)' }],
      readyGoRehearsal: true,
      note: 'Стол: 12 мин + iso + 30% ready-go. Без борьбы на разминке.',
    };
  }
  if (k === 'grip') {
    return {
      minutes: 10,
      steps: [...base, { title: 'Rice-bucket', dose: '1 мин' }, { title: 'Рабочий имплемент 50%', dose: '2×8 легко' }],
      readyGoRehearsal: false,
      note: 'Хват: rice-bucket + лёгкий имплемент, экстензоры в конце сессии.',
    };
  }
  if (k === 'tech') {
    return {
      minutes: 8,
      steps: [...base.slice(0, 5)],
      readyGoRehearsal: true,
      note: 'Техника: 8 мин, затем 3–4 спец-дрилла перед базой (StrengthLog).',
    };
  }
  return {
    minutes: 10,
    steps: [...base, { title: 'Разминочные подходы первого упражнения', dose: '2–5 подходов (wrist curl — до 5)' }],
    readyGoRehearsal: false,
    note: 'Тяж/памп: 10 мин + 2–5 разминочных подходов.',
  };
}
