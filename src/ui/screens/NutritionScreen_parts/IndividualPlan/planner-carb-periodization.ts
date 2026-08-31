/**
 * planner-carb-periodization.ts — ЕДИНАЯ семантика периодизации углеводов (Эпик 1,
 * план NUTRITION-PROFESSIONAL-PLAN.md, Aug 31 2026).
 *
 * Историю: было 4 параллельных механизма (cyclingMode / dietPauseMode /
 * periodizationEnabled / carbPeriodization), которые ветвились в разных местах
 * генерации и отображались в разных карточках настроек. Пользователь выбирал
 * «БУЧ» в одном месте — генерация читала другое поле.
 *
 * Новая модель: один селектор `carbPeriodization` (8 режимов) → одна чистая
 * функция модов дня. Любое другое чтение этих полей в генерации запрещено
 * (grep-гейт в тестах).
 *
 * Моды дня (совместимы с legacy-значениями, зафиксированы тестами):
 *   none        — ровные КБЖУ каждый день (1.0/1.0)
 *   refeed      — 1 день/нед (сб): ккал ×1.12, угли ×2.2 (лептин/гликоген), остальные 0.85/0.6
 *   carb_cycle  — трен: ×1.15/×1.3 · отдых: ×0.85/×0.7
 *   butch       — трен: ×1.1/×1.4 (ВУ) · отдых: ×0.85/×0.4 (НУ)
 *   flex_80_20  — лёгкий профицит ×1.05 для adherence
 *   two_one     — 2 дня работы (×1.12/×1.25) + 1 день лёгкий (×0.85/×0.6)
 *   five_two    — 5 дней дефицит (×0.8/×0.7) + 2 дня maintenance (1.0/1.0)
 *   wave        — волна 2+1 по неделям плана: каждая 3-я неделя — поддержание
 *                 (×0.9/×0.85 — снимает профицит), рабочие недели 1.0/1.0.
 *
 * Чистая функция, детерминированная, тестируемая.
 */

import type { CarbPeriodization } from './types';

export interface CarbPeriodizationMods {
  dayKcalMod: number;
  dayCarbMod: number;
  /** Рефид-день: движок выбирает быстрые/низкоклетчаточные углеводы, жиры ниже. */
  isRefeedDay: boolean;
  /** Заметка недели (для wave: рабочая / поддержание) — в proNotes плана. */
  weekNote?: string;
}

export function applyCarbPeriodizationMods(
  mode: CarbPeriodization | undefined | null,
  offset: number,
  isTrain: boolean,
): CarbPeriodizationMods {
  const m = mode || 'none';
  switch (m) {
    case 'refeed': {
      const isRefeed = offset % 7 === 6; // суббота — рефид-день
      return isRefeed
        ? { dayKcalMod: 1.12, dayCarbMod: 2.2, isRefeedDay: true }
        : { dayKcalMod: 0.85, dayCarbMod: 0.6, isRefeedDay: false };
    }
    case 'carb_cycle':
      return isTrain
        ? { dayKcalMod: 1.15, dayCarbMod: 1.3, isRefeedDay: false }
        : { dayKcalMod: 0.85, dayCarbMod: 0.7, isRefeedDay: false };
    case 'butch':
      return isTrain
        ? { dayKcalMod: 1.1, dayCarbMod: 1.4, isRefeedDay: false }
        : { dayKcalMod: 0.85, dayCarbMod: 0.4, isRefeedDay: false };
    case 'flex_80_20':
      return { dayKcalMod: 1.05, dayCarbMod: 1.0, isRefeedDay: false };
    case 'two_one':
      return offset % 3 < 2
        ? { dayKcalMod: 1.12, dayCarbMod: 1.25, isRefeedDay: false }
        : { dayKcalMod: 0.85, dayCarbMod: 0.6, isRefeedDay: false };
    case 'five_two': {
      const isMaint = offset % 7 >= 5; // последние 2 дня недели — maintenance
      return isMaint
        ? { dayKcalMod: 1.0, dayCarbMod: 1.0, isRefeedDay: false }
        : { dayKcalMod: 0.8, dayCarbMod: 0.7, isRefeedDay: false };
    }
    case 'wave': {
      const weekOfPlan = Math.floor(offset / 7);
      if (weekOfPlan % 3 === 2) {
        return {
          dayKcalMod: 0.9, dayCarbMod: 0.85, isRefeedDay: false,
          weekNote: '📅 Неделя поддержания (волна 2+1) — калории к уровню поддержания, угли ниже.',
        };
      }
      return {
        dayKcalMod: 1.0, dayCarbMod: 1.0, isRefeedDay: false,
        weekNote: '📅 Рабочая неделя волны 2+1 — заданный профицит/дефицит.',
      };
    }
    case 'none':
    default:
      return { dayKcalMod: 1.0, dayCarbMod: 1.0, isRefeedDay: false };
  }
}

const CARB_PERIODIZATION_RU: Record<CarbPeriodization, string> = {
  none: 'Нет',
  refeed: 'Рефид 1×/нед',
  carb_cycle: 'Угл. цикл',
  butch: 'БУЧ',
  flex_80_20: '80/20',
  two_one: '2+1',
  five_two: '5:2',
  wave: 'Волна 2+1',
};

/** RU-лейбл для отчётов/UI (вместо legacy cyclingMode-маппинга). */
export function carbPeriodizationLabel(mode: CarbPeriodization | undefined | null): string {
  const m = mode || 'none';
  return CARB_PERIODIZATION_RU[m] || m;
}