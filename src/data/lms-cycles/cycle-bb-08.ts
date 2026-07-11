import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-bb-08.ts — Arnold Split 6x/нед (ПРОФ, продвинутый).
 * 9 недель: грудь+спина / плечи+руки / ноги ×2.
 * Каждая группа 2x/нед. 6 тренировок в неделю.
 * Первый проход грудь+спина/плечи+руки — тяжёлый (6-8 повторов).
 * Второй — памп-день (12-15 повторов) для плеч+рук.
 * Ноги всегда тяжёлые (оба дня).
 */
export const CYCLE_BB_08: SRCycleTemplate = {
 meta: {
  id: 'cycle-bb-08',
  title: 'Arnold Split 6x/нед (ПРОФ)',
  direction: 'bodybuilding',
   level: 'KMS-MS',
  period: 'mass',
  sessionsPerWeek: 6,
  weeks: 9,
  correctionPct: 0.004,
  description: '9-недельный Arnold-сплит 6x/нед. Грудь+спина (тяж/тяж), плечи+руки (тяж/памп), ноги (тяж/тяж). Основа: жим лёжа + тяга штанги в один день 4×8 — суперсет антагонистов. Плечи+руки: жим стоя + подъёмы гантелей + бицепс/трицепс 4×10. Ноги: присед + становая + румынская. Прогрессия 1%/нед — ускоренная для продвинутых.',
  howItWorks: 'Arnold Split 6x/нед (ПРОФ). Направление: бодибилдинг; уровень: КМС — МС. 9-недельный сплит Арнольда: 6 тренировок/нед. Пн Chest+Back 4×8 (жим+тяга+разводка+пуловер). Вт Shoulders+Arms 4×10 (жим+махи+бицепс+трицепс). Ср Legs 4×8 (присед+румынская+разгибания+икры). Чт Chest+Back (тяж/памп — тяга блока+кроссовер+жим в раме). Пт Shoulders+Arms Pump (12-15 повторов, отдых 45с). Сб Legs (присед+становая+сгибания+икры). Прогрессия 0.4%/нед. Суперсеты: грудь+спина в один день — антагонистическая синергия.',
  conditions: [
   'ТОЛЬКО для продвинутых (2+ года стажа). 6 тренировок/нед — экстремальный объём.',
   'Сплит: Пн Chest+Back / Вт Shoulders+Arms / Ср Legs / Чт Chest+Back / Пт Shoulders+Arms / Сб Legs.',
   'Пн/Чт — антагонистические суперсеты: жим лёжа + тяга штанги без отдыха. 90с после пары.',
   'Второй Shoulders+Arms — памп-режим: 12-15 повторов, отдых 45с, дроп-сеты на финише.',
   'Боковая дельта (гантели в стороны) — каждый день плеч, обязательно для ширины.',
   'Ноги оба дня тяжёлые: Пн — квадрицепс (присед), Чт — задняя цепь (становая+румынская+сгибания).',
   'Каждые 3-4 недели — разгрузочная микронеделя (-40% объёма, RIR 4).',
   'BCAA 10 г/тренировку, креатин 5 г/день, Омега-3 3 г/день.',
  ],
 },
 week1: [
  {
   exercises: [
    { name: 'Жим лежа', group: 'Грудь', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.62,reps:8,sets:4}] },
    { name: 'Тяга штанги в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.60,reps:8,sets:4}] },
    { name: 'Жим гантелей на наклонной', group: 'Грудь', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:10,sets:3}] },
    { name: 'Тяга гантели в наклоне', group: 'Спина', coef: 1.0, mnosz: 1, load: 'Средняя', sets: [{pct:0.50,reps:10,sets:3}] },
    { name: 'Разведения гантелей', group: 'Грудь', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:3}] },
    { name: 'Тяга верхнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.30,reps:12,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Жим стоя', group: 'Плечи', coef: 0.8, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.60,reps:8,sets:4}] },
    { name: 'Подъем гантелей в стороны', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:12,sets:4}] },
    { name: 'Разведение гантелей в наклоне', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:12,sets:3}] },
    { name: 'Подъем штанги на бицепс', group: 'Руки', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.40,reps:10,sets:4}] },
    { name: 'Жим лежа узким хватом', group: 'Руки', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.48,reps:10,sets:4}] },
    { name: 'Молотковые сгибания', group: 'Руки', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:3}] },
    { name: 'Разгибания на блоке стоя', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.30,reps:12,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.62,reps:8,sets:4}] },
    { name: 'Тяга на прямых ногах', group: 'Ноги', coef: 1.0, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.48,reps:10,sets:4}] },
    { name: 'Разгибания ног', group: 'Ноги', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.38,reps:12,sets:4}] },
    { name: 'Сгибания ног', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:4}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:4}] },
    { name: 'Скручивания на пресс', group: 'Пресс', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:15,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Жим гантелей на наклонной', group: 'Грудь', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:10,sets:4}] },
    { name: 'Тяга верхнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.50,reps:10,sets:4}] },
    { name: 'Кроссовер', group: 'Грудь', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:3}] },
    { name: 'Тяга нижнего блока', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3}] },
    { name: 'Пуловер с гантелью', group: 'Грудь', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:12,sets:3}] },
    { name: 'Шраги с гантелями', group: 'Спина', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:3}] },
    { name: 'Подъем на носки сидя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Жим гантелей', group: 'Плечи', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.48,reps:12,sets:4}] },
    { name: 'Подъем гантелей в стороны', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:4}] },
    { name: 'Разведение гантелей в наклоне', group: 'Плечи', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.22,reps:15,sets:3}] },
    { name: 'Сгибания с гантелью на бицепс сидя', group: 'Руки', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:4}] },
    { name: 'Французский жим лежа', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.32,reps:12,sets:4}] },
    { name: 'Концентрированный подъем', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:3}] },
    { name: 'Разгибания с гантелью из-за головы', group: 'Руки', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.25,reps:15,sets:3}] },
   ],
  },
  {
   exercises: [
    { name: 'Присед на груди', group: 'Ноги', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:4}] },
    { name: 'Становая тяга', group: 'Спина', coef: 1.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.60,reps:6,sets:3}] },
    { name: 'Сгибания ног', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:4}] },
    { name: 'Разгибания ног', group: 'Ноги', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.35,reps:12,sets:3}] },
    { name: 'Подъем на носки стоя', group: 'Ноги', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.28,reps:15,sets:4}] },
    { name: 'Наклоны стоя', group: 'Спина', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.32,reps:12,sets:3}] },
   ],
  },
 ],
};
