import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-bb-06.ts — PHUL 4x/нед (Power Hypertrophy Upper Lower).
 * 9 недель, 4 тренировки/нед. Первая половина недели — силовая (1-5 повторов, 85-95%).
 * Вторая половина — гипертрофийная (8-15 повторов, 65-80%).
 * Верх/Низ: верх сила + низ сила + верх гипертрофия + низ гипертрофия.
 * Боковая дельта и задняя дельта — в гипертрофийные дни. Икры и пресс — в нижние дни.
 */
export const CYCLE_BB_06: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-06',
  title: 'PHUL 4x/нед (Power Hypertrophy Upper Lower)',
  direction: 'bodybuilding',
  level: 'II-KMS',
  period: 'mixed',
  sessionsPerWeek: 4,
  weeks: 9,
  correctionPct: 0.005,
  description: '9-недельный PHUL: 4 тренировки/нед с разделением на силовые (Пн/Вт — 3-5 повторов) и гипертрофийные (Чт/Пт — 8-15) дни. Верх сила: жим лёжа 4×5, тяга штанги 4×5, жим стоя 3×5. Низ сила: присед 4×5, становая 3×5. Верх гипертрофия: жимы 8-12, разведения, дельты/руки 10-15. Низ гипертрофия: присед 10-12, румынская, разгибания/сгибания. Прогрессия 0.4%/нед.',
  howItWorks: 'PHUL 4x/нед (Power Hypertrophy Upper Lower). Направление: бодибилдинг + сила; уровень: II разряд — КМС. 9-недельный цикл: силовые дни (3-5 повторов, отдых 3 мин) + гипертрофийные (8-15 повторов, отдых 60-90с). День 1: Upper Power — жим лёжа 4×5, тяга штанги 4×5, жим стоя 3×5, тяга верхнего блока 3×8. День 2: Lower Power — присед 4×5, становая 3×5, подъём на носки 4×8. День 3: Upper Hyp — жим гантелей 4×10, тяга гантели 4×10, разведения 3×15, дельты+руки. День 4: Lower Hyp — присед 3×12, румынская 3×12, разгибания/сгибания 3×15. Прогрессия 0.4%/нед. Объём: 4 тренировки/нед, 9 недель.',
  conditions: [
   'Для атлетов среднего уровня (1.5+ года стажа).',
   'Сплит: Пн Upper Power / Вт Lower Power / Чт Upper Hyp / Пт Lower Hyp.',
   'Upper Power: отдых 3 мин между подходами базы, 1.5-2 мин на вспомогательных.',
   'Upper Hyp: отдых 60-90с, цель — метаболический стресс и памп.',
   'Дельты: боковая (махи в стороны) — только в гип-дни, не заменять на жимы.',
   'Икры и пресс — строго финишерами в Lower дни.',
   'Каждые 3-4 недели — микро-разгрузка (-20% объёма, те же веса).',
  ],
 },
 week1: [
  {
   exercises: [
    { name: 'Жим лежа', group: 'Грудь', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.72,reps:5,sets:4}] },
    { name: 'Тяга штанги в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:5,sets:4}] },
    { name: 'Жим стоя', group: 'Плечи', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:5,sets:3}] },
    { name: 'Тяга верхнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:8,sets:3}] },
    { name: 'Французский жим', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.42,reps:8,sets:3}] },
    { name: 'Подъем штанги на бицепс', group: 'Руки', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.38,reps:8,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.70,reps:5,sets:4}] },
    { name: 'Становая тяга', group: 'Спина', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:5,sets:3}] },
    { name: 'Тяга на прямых ногах', group: 'Ноги', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:8,sets:3}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.32,reps:8,sets:4}] },
    { name: 'Пресс в тренажере (скручивания)', group: 'Пресс', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:12,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Жим гантелей на наклонной', group: 'Грудь', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:10,sets:4}] },
    { name: 'Тяга гантели в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.50,reps:10,sets:4}] },
    { name: 'Разведения гантелей', group: 'Грудь', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:3}] },
    { name: 'Подъем гантелей в стороны', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:4}] },
    { name: 'Разведение гантелей в наклоне', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:15,sets:3}] },
    { name: 'Молотковые сгибания', group: 'Руки', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:3}] },
    { name: 'Разгибания с гантелью из-за головы', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.30,reps:12,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
    { name: 'Тяга на прямых ногах', group: 'Ноги', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3}] },
    { name: 'Разгибания ног', group: 'Ноги', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:15,sets:3}] },
    { name: 'Сгибания ног', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.32,reps:15,sets:3}] },
    { name: 'Подъем на носки сидя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:4}] },
    { name: 'Скручивания на пресс', group: 'Пресс', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:20,sets:3}] },
   ],
  },
 ],
};
