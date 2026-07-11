import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-bb-07.ts — PHAT 5x/нед (Power Hypertrophy Adaptive Training).
 * 10 недель, 5 тренировок/нед. Пн: Upper Body Power (3-5 повт). Вт: Lower Body Power (3-5 повт).
 * Ср: отдых. Чт: Back+Shoulders Hyp (8-12). Пт: Legs+Abs Hyp (10-15). Сб: Chest+Arms Hyp (8-12).
 * Вс: отдых. Сочетает силовой блок (2 дня) + гипертрофийный (3 дня).
 * Прогрессия 0.4%/нед — умеренная из-за гибридного характера.
 */
export const CYCLE_BB_07: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-07',
  title: 'PHAT 5x/нед (Power Hypertrophy Adaptive Training)',
  direction: 'bodybuilding',
   level: 'KMS-MS',
  period: 'mixed',
  sessionsPerWeek: 5,
  weeks: 10,
  correctionPct: 0.004,
  description: '10-недельный PHAT (Layne Norton): 5 тренировок/нед — 2 силовых + 3 гипертрофийных. Upper Power: жим лёжа 3×5, тяга штанги 3×5, жим стоя 3×5. Lower Power: присед 3×5, становая 2×5. Back+Shoulders Hyp: объём спины 12-15, дельты 12-15. Legs+Abs Hyp: ноги 10-15, икры/пресс 15-20. Chest+Arms Hyp: грудные 10-12, руки 12-15. Прогрессия 0.4%/нед. Боковая дельта, задняя дельта, икры, пресс — на гипертрофийных днях.',
  howItWorks: 'PHAT 5x/нед (Power Hypertrophy Adaptive Training). Направление: бодибилдинг + сила; уровень: КМС — МС. 10-недельный гибрид: 2 силовых (3-5 повторов, RIR 1-2, отдых 3 мин) + 3 гипертрофийных (8-15 повторов, RIR 2-3, отдых 60-90с). День 1: Upper Power — жим лёжа + тяга штанги + жим стоя + вспомогательные. День 2: Lower Power — присед + становая + ноги. День 4: Back+Shoulders Hyp — тяги + разведения + дельты. День 5: Legs+Abs Hyp — приседания + разгибания/сгибания + икры + пресс. День 6: Chest+Arms Hyp — жимы + разведения + бицепс + трицепс. Прогрессия 0.4%/нед. Объём: 5 тренировок/нед, 10 недель.',
  conditions: [
   'Для продвинутых атлетов (2+ года стажа).',
   'Сплит: Пн Upper Power / Вт Lower Power / Чт Back+Shoulders / Пт Legs+Abs / Сб Chest+Arms.',
   'Силовые дни: отдых 3 мин на compounds, 2 мин на вспомогательные. Вес 85-95% от ПМ.',
   'Hyperтрофийные дни: отдых 60-90с, диапазон 8-15 повторов, RIR 2-3.',
   'Боковая дельта — на Back+Shoulders день вместе с задней дельтой, не заменять.',
   'Икры — на Legs день после основных движений, не переставлять.',
   'При нехватке восстановления (сон <7ч, усталость) — заменить Chest+Arms на лёгкий памп 45 мин.',
   'Креатин 5 г/день, цитруллин 6 г перед силовыми днями.',
  ],
 },
 week1: [
  {
   exercises: [
    { name: 'Жим лежа', group: 'Грудь', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.75,reps:5,sets:3}] },
    { name: 'Тяга штанги в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.72,reps:5,sets:3}] },
    { name: 'Жим стоя', group: 'Плечи', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:5,sets:3}] },
    { name: 'Тяга верхнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.50,reps:8,sets:3}] },
    { name: 'Французский жим', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.42,reps:8,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.72,reps:5,sets:3}] },
    { name: 'Становая тяга', group: 'Спина', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.70,reps:5,sets:2}] },
    { name: 'Тяга на прямых ногах', group: 'Ноги', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.50,reps:8,sets:3}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:10,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Тяга гантели в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.50,reps:12,sets:4}] },
    { name: 'Тяга верхнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3}] },
    { name: 'Тяга нижнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.42,reps:15,sets:3}] },
    { name: 'Подъем гантелей в стороны', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:4}] },
    { name: 'Разведение гантелей в наклоне', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:15,sets:3}] },
    { name: 'Жим гантелей', group: 'Плечи', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:10,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
    { name: 'Разгибания ног', group: 'Ноги', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.38,reps:15,sets:4}] },
    { name: 'Сгибания ног', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:15,sets:4}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:4}] },
    { name: 'Подъем на носки сидя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:20,sets:3}] },
    { name: 'Пресс в тренажере (скручивания)', group: 'Пресс', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:20,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Жим гантелей на наклонной', group: 'Грудь', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    { name: 'Жим на наклонной', group: 'Грудь', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:12,sets:3}] },
    { name: 'Кроссовер', group: 'Грудь', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:3}] },
    { name: 'Подъем штанги на бицепс', group: 'Руки', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.38,reps:12,sets:4}] },
    { name: 'Молотковые сгибания', group: 'Руки', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.32,reps:12,sets:3}] },
    { name: 'Разгибания с гантелью из-за головы', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.30,reps:12,sets:4}] },
    { name: 'Разгибания на блоке стоя', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:3}] },
   ],
  },
 ],
};
