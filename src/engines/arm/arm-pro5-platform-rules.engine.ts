/**
 * arm-pro5-platform-rules.engine.ts — PRO-5 P2 правила снарядов 2026 + LMS-формат.
 *
 * Источники: Armlifting USA 2026 (Worlds/Arnold/Super Series кейсы), IronMind
 * RT/Hub rules (проворот/центр/thumbless/1с контроль/down-signal, только мел).
 * Честно: у Raptor 1.75" и Fat Gripz DOH верифицированного WR нет — % не
 * считается, только кг + правила (факт без %). PLATFORM_WR не трогаем.
 */

export interface ImplementRule {
  implement: string;
  name: string;
  grip: string;
  timing: string;
  attempts: string;
  fouls: string[];
  wrNote: string; // честно: WR или «ориентира нет»
}

export const PLATFORM_RULES_2026: ImplementRule[] = [
  {
    implement: 'rolling_thunder', name: 'Rolling Thunder (60мм, 2 3/8")',
    grip: 'Центр ручки, thumbless запрещён; рука/ручка не касаются тела',
    timing: '60с с объявления, попыток внутри минуты — без лимита; 1с контроль + down-signal',
    attempts: 'До 4 заявок, только вверх (last-man-standing)',
    fouls: ['Касание тела/проводка по ноге', 'Непараллельная ручка', 'Ранний сброс до сигнала'],
    wrNote: 'WR 130.5/77.2 (верифицирован)',
  },
  {
    implement: 'apollon_axle', name: 'Apollon Axle (58мм)',
    grip: 'Только DOH, без лямок/разнохвата/замка; сумо разрешено',
    timing: '60с с загрузки; 1с контроль + down-signal, хват до касания пола',
    attempts: 'До 4 заявок, шаг ≥5/10 кг, только вверх',
    fouls: ['Отдых на бёдрах', 'Движение вниз', 'Сброс до сигнала'],
    wrNote: 'WR 237.5/137.9 (верифицирован)',
  },
  {
    implement: 'saxon_bar', name: 'Saxon Bar (3" / 3"×4")',
    grip: 'Двуручный щипок прямоугольника, thumbless запрещён, только мел',
    timing: '60с; rising-bar или medley по регламенту этапа',
    attempts: 'Rising-bar шагом 2.5 кг / medley лесенкой',
    fouls: ['Лямки/крюки', 'Перехват со сбросом', 'Касание стойки'],
    wrNote: 'Внутренний ориентир 133 (единого WR нет — классы/лидерборды)',
  },
  {
    implement: 'hub', name: 'IronMind Hub',
    grip: 'Все 5 пальцев на базе Hub, «дверная ручка» запрещена; ‖ полу',
    timing: '60с; 1с контроль + down-signal',
    attempts: 'До 4 заявок, только вверх',
    fouls: ['Хват ручкой сверху', 'Касание тела', 'Наклон Hub'],
    wrNote: 'WR 44.8/28.51 (верифицирован)',
  },
  {
    implement: 'raptor_1h', name: 'Raptor 1.75" (1H)',
    grip: 'Одноручный хват по центру, без лямок, только мел',
    timing: '60с с объявления (Super Series Stage-1 формат)',
    attempts: 'Last-man-standing, только вверх',
    fouls: ['Вторая рука/тело', 'Сброс до сигнала'],
    wrNote: 'Ориентира нет — только кг, % не считается (честно)',
  },
  {
    implement: 'grandfather_clock', name: 'Grandfather Clock',
    grip: 'Хват скобы сверху, без лямок',
    timing: '60с; удержание/тяга по регламенту (Arnold)',
    attempts: 'Rising-bar шагом 2.5 кг',
    fouls: ['Рывок со стойки', 'Касание тела'],
    wrNote: 'Внутренний ориентир (только лидерборды)',
  },
  {
    implement: 'anvil', name: 'SSE Anvil (Staniewicz)',
    grip: 'Щипок наковальни сверху, мел; без лямок',
    timing: '60с с объявления (Worlds max)',
    attempts: 'До 4 заявок, только вверх',
    fouls: ['Подхват снизу', 'Касание тела'],
    wrNote: 'Внутренний ориентир (только лидерборды)',
  },
  {
    implement: 'country_crush', name: 'Country Crush 2H',
    grip: 'Двуручный DOH, без лямок',
    timing: '60с; 2 платформы (лёгкая/тяжёлая) по весу атлета',
    attempts: 'Шаг 2.5/5 кг по платформе',
    fouls: ['Разнохват', 'Отдых на бёдрах'],
    wrNote: 'Внутренний ориентир (лучший известный ~198 — выше, не WR)',
  },
  {
    implement: 'fat_gripz_doh', name: 'Fat Gripz DOH DL',
    grip: 'DOH на толстых накладках, без лямок (дешёвый старт хвата)',
    timing: '60с; Super Series Stage-2 формат',
    attempts: 'Rising-bar, только вверх',
    fouls: ['Лямки', 'Сброс до сигнала'],
    wrNote: 'Ориентира нет — тренажёрный снаряд, только кг (честно)',
  },
];

export function platformRuleFor(implement: string): ImplementRule | undefined {
  return PLATFORM_RULES_2026.find((r) => r.implement === String(implement || '').toLowerCase());
}

/** Канон LMS-формата 2026 одной строкой. */
export const LMS_RULES_2026 =
  'LMS 2026: 60с с объявления, попыток внутри минуты без лимита; заявки только вверх (шаг 2.5/5 кг); промах = выбыл из события; вниз вернуться нельзя; только мел (жидкий запрещён); down-signal + 1с контроль.';

/** LMS-лесенка до цели (паритет planLastManStanding, без импорта): только вверх. */
export function lmsLadderTo(targetKg: number): number[] {
  const t = Number(targetKg);
  if (!Number.isFinite(t) || t <= 0) return [];
  const step = t >= 100 ? 5 : 2.5;
  const out: number[] = [];
  let w = Math.round(t * 0.85 * 2) / 2;
  if (w < 2.5) w = 2.5;
  let guard = 0;
  while (w < t && guard++ < 12) {
    out.push(w);
    w = Math.round((w + step) * 2) / 2;
  }
  out.push(Math.round(t * 2) / 2);
  return out;
}
