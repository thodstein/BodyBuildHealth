/**
 * period-labels.ts — единый словарь перевода периодов/направлений СРЦ-циклов на русский.
 * Источник правды для UI (выбор циклов, каталог, годовой план, rationale).
 * Не меняет движок — только отображение.
 */

export const PERIOD_LABEL_RU: Record<string, string> = {
  strength: 'Сила',
  endurance: 'Выносливость',
  peak: 'Выход на пик',
  mass: 'Масса',
  mixed: 'Смешанный',
  // для lms-season слотов (speed не хранится в SRPeriod, но используется в UI сезонов)
  speed: 'Скорость/координация',
};

export const PERIOD_LABEL_RU_SHORT: Record<string, string> = {
  strength: 'Сила',
  endurance: 'Выносливость',
  peak: 'Пик',
  mass: 'Масса',
  mixed: 'Смешанный',
  speed: 'Скорость',
};

/** Full period description for tooltips/chips: strength → 'Сила', etc. */
export function periodLabelRu(period: string | undefined | null): string {
  if (!period) return '—';
  return PERIOD_LABEL_RU[period] ?? period;
}

export function periodLabelRuShort(period: string | undefined | null): string {
  if (!period) return '—';
  return PERIOD_LABEL_RU_SHORT[period] ?? period;
}

export const DIRECTION_LABEL_RU: Record<string, string> = {
  powerlifting: 'Троеборье',
  bench: 'Жим лёжа',
  deadlift_bench: 'Тяга+Жим',
  deadlift_squat: 'Тяга+Присед',
  squat_bench: 'Присед+Жим',
  armwrestling: 'Армрестлинг',
  bodybuilding: 'Бодибилдинг',
  weightlifting: 'Тяжёлая атлетика',
  peaking_pl: 'Пик — троеборье',
  peaking_bench: 'Пик — жим',
  peaking_deadlift: 'Пик — тяга',
  peaking_bb: 'Пик — ББ',
  competition: 'Соревнования',
  hypertrophy: 'Гипертрофия',
  cutting: 'Сушка',
  contest_prep: 'Подготовка к сцене',
};

export function directionLabelRu(dir: string | undefined | null): string {
  if (!dir) return '—';
  return DIRECTION_LABEL_RU[dir] ?? dir;
}

/** Объединённая строка для дропдауна: направление · период · уровень · недели */
export function cycleShortRu(c: { direction: string; period: string; level: string; weeks: number }): string {
  return `${directionLabelRu(c.direction)} · ${periodLabelRu(c.period)} · ${c.level} · ${c.weeks} нед`;
}
