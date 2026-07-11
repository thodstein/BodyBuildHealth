import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-bb-04.ts — PPL 2x/нед Heavy+Pump 6x/нед (ПРОФ, продвинутый).
 * 8 недель, Push/Pull/Legs ×2: тяжёлый день (6-8 повторений, 60-75% ПМ) + пампинг-день
 * (12-15 повторений, 40-55% ПМ). Все сессии 18-20 рабочих подходов.
 * Heavy дни: механическое напряжение, миофибриллярная гипертрофия.
 * Pump дни: метаболический стресс, саркоплазматическая гипертрофия, гликоген.
 * Впервые добавлены: боковая дельта на Push* (тяжёлый+памп), задняя дельта на Pull Pump,
 * икры на оба Legs дня, пресс на Pull Pump.
 * Убран бицепс из Push Pump (анатомически неверно), убраны лишние сгибания/наклоны.
 * Снижен объём Legs Heavy с 20 до 18 подходов, Legs Pump с 20 до 18.
 * Прогрессия 0.4%/нед.
 */
export const CYCLE_BB_04: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-04',
  title: 'PPL Heavy+Pump 6x/нед (ПРОФ, продвинутый)',
  direction: 'bodybuilding',
  level: 'KMS-MSMK',
  period: 'mass',
  sessionsPerWeek: 6,
  weeks: 8,
  correctionPct: 0.004,
  description: '8-недельный ПРОФ-цикл PPL 2x/нед Heavy+Pump. Тяжёлые дни: жим лёжа 4×6, становая 4×6, присед 4×6 — механическое напряжение. Памп-дни: 12-15 повторений, 45-60с отдых — метаболический стресс. Впервые: боковая дельта на оба Push дня, задняя дельта на Pull Pump, икры на оба Legs дня, пресс на Pull Pump. Убран бицепс из Push Pump. Снижен объём до 18-20 подходов за сессию. Прогрессия 0.4%/нед.',
  howItWorks: 'PPL Heavy+Pump 6x/нед (ПРОФ, продвинутый). Направление: бодибилдинг; уровень: КМС — МСМК; период: специализированная гипертрофия. 8-недельный сплит Push/Pull/Legs с чередованием Heavy/Pump дней. Heavy: 6-8 повторений, 60-75% ПМ, отдых 2-3 мин — акцент на миофибриллярную гипертрофию. Pump: 12-15 повторений, 40-55% ПМ, отдых 45-60с — акцент на саркоплазматическую гипертрофию. Прогрессия 0.4%/нед — умеренная для контроля кумулятивной усталости при 6 тренировках. Объём: 6 тренировок/нед, 8 недель.',
  conditions: [
   'ТОЛЬКО для продвинутых атлетов (КМС — МСМК) с 3+ года стажа.',
   '6 тренировок/нед — экстремальный объём. Требуется 8-10 ч сна, профицит калорий.',
   'Сплит: Пн Push Heavy / Вт Pull Heavy / Ср Legs Heavy / Чт Push Pump / Пт Pull Pump / Сб Legs Pump.',
   'Heavy дни — отдых 2-3 мин между подходами базы, 1.5 мин на изоляции.',
   'Pump дни — отдых 45-60с, цель — жжение и памп, не максимальный вес.',
   'Каждые 4 недели — разгрузочная микронеделя (-50% объёма, те же веса).',
   'Боковая дельта (гантели в стороны) — в каждый Push день, обязательное упражнение.',
   'Задняя дельта — только на Pull Pump, в тяжёлый Pull день заменена рядовым.',
  ],
 },
 week1: [
  {
   exercises: [
    { name: 'Жим лежа', group: 'Грудь', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.68,reps:6,sets:4}] },
    { name: 'Жим на наклонной', group: 'Грудь', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:8,sets:4}] },
    { name: 'Жим стоя', group: 'Плечи', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:6,sets:3}] },
    { name: 'Подъем гантелей в стороны', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:12,sets:3}] },
    { name: 'Французский жим', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.42,reps:8,sets:4}] },
   ],
  },
  {
   exercises: [
    { name: 'Становая тяга', group: 'Спина', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:6,sets:4}] },
    { name: 'Тяга гантели в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.58,reps:8,sets:4}] },
    { name: 'Тяга верхнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:8,sets:3}] },
    { name: 'Бицепс стоя', group: 'Руки', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.42,reps:8,sets:4}] },
    { name: 'Наклоны стоя', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.35,reps:8,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.65,reps:6,sets:4}] },
    { name: 'Присед на груди', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:8,sets:3}] },
    { name: 'Тяга на прямых ногах', group: 'Ноги', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.48,reps:8,sets:4}] },
    { name: 'Разгибания ног', group: 'Ноги', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.38,reps:10,sets:3}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:12,sets:4}] },
   ],
  },
  {
   exercises: [
    { name: 'Жим гантелей на наклонной', group: 'Грудь', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:4}] },
    { name: 'Кроссовер', group: 'Грудь', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:3}] },
    { name: 'Подъем гантелей в стороны', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:15,sets:4}] },
    { name: 'Разгибания с гантелью из-за головы', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:4}] },
    { name: 'Французский жим лежа', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Тяга верхнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.40,reps:15,sets:4}] },
    { name: 'Тяга гантели в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.42,reps:15,sets:4}] },
    { name: 'Разведение гантелей в наклоне', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:15,sets:3}] },
    { name: 'Молотковые сгибания', group: 'Руки', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.30,reps:15,sets:4}] },
    { name: 'Пресс в тренажере (скручивания)', group: 'Пресс', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.20,reps:20,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:12,sets:4}] },
    { name: 'Разгибания ног', group: 'Ноги', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.30,reps:15,sets:4}] },
    { name: 'Тяга на прямых ногах', group: 'Ноги', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.38,reps:12,sets:3}] },
    { name: 'Сгибания ног', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.30,reps:15,sets:3}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:15,sets:4}] },
   ],
  },
 ],
};
