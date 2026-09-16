/**
 * bb-movement-to-plan.engine.ts — D5: матрица «драйвер → замены упражнений» +
 * правило приоритета асимметрий + честные дисклеймеры (чистые функции, без стора).
 * Сборку НЕ меняет — отдаёт строки-подсказки для rationale/моста (решение §9.2:
 * приёмник пишет инфо, не перестраивает план).
 * Канон: длина+момент (Wolf/Pedrosa: момент в растянутой обязателен), NASM re-test,
 * PoinT GO «асимметрия важнее композита», FMS AUC 0.587 — не прогноз травм.
 */

export const SCREENING_DISCLAIMER =
  'Скрининг движений — приоритизация коррекций, а не прогноз травм (FMS AUC ~0.59, чувствительность ~25%): чиним паттерн, тренируемся дальше';

export const VIDEO_GUIDE =
  'Видео-стандарт: 5 повторов, босиком, спереди + сбоку, телефон на штативе на высоте таза; глубину и вальгус смотреть покадрово';

export type PlanDriver =
  | 'ankle'
  | 'hip'
  | 'thoracic'
  | 'shoulder'
  | 'core'
  | 'none';

export interface DriverSubs {
  avoid: string[];
  prefer: string[];
  note: string;
}

/** Замены уважают ББ-специфику: убираем то, что ломает паттерн, даём то, что грузит мышцу в длине с моментом. */
const MATRIX: Record<PlanDriver, DriverSubs> = {
  ankle: {
    avoid: ['присед со штангой в пол', 'фронтальный присед в пол'],
    prefer: ['гоблет-присед с пяткой 2.5 см', 'жим ногами', 'болгарский сплит-присед'],
    note: 'Голеностоп: глубина через пятку/гоблет, момент в длине — жим ногами и сплит',
  },
  hip: {
    avoid: ['тяжёлый присед в отказ при вальгусе'],
    prefer: ['сплит-присед с темпом 3-1-1', 'кламшеллы/отведения + голеностоп дистально', 'ягодичный мост с паузой'],
    note: 'ТБС: комплекс 8 нед (ягодица + ротаторы + стопа), cue «раздвинь пол стопами»',
  },
  thoracic: {
    avoid: ['жим стоя со штангой', 'присед со штангой при завале корпуса'],
    prefer: ['жим гантелями сидя с опорой', 'тяга верхнего блока', 'гоблет-присед'],
    note: 'Грудной: экстензия на ролле T4–T10 + thread-the-needle, штангу над головой — после чистого теста',
  },
  shoulder: {
    avoid: ['жим штанги над головой', 'тяга за голову'],
    prefer: ['жим гантелей нейтральным хватом', 'тяга к груди с паузой в растянутой', 'пуловер с рёбрами вниз'],
    note: 'Плечо/широчайшие: длина широчайших у рамы + нейтральный хват, без жимов над головой до чистого теста',
  },
  core: {
    avoid: ['становая в отказ', 'присед в отказ при гуляющей пояснице'],
    prefer: ['гоблет-присед с паузой 3 с', 'мёртвый жук/планка с дыханием', 'румынская выше колен'],
    note: 'Кор: стабильность первична — паузы и дыхание, осевую в отказ — нет',
  },
  none: {
    avoid: [],
    prefer: [],
    note: 'Паттерн чистый — поддерживающий объём + перепроверка через 6–8 нед',
  },
};

export function substitutesForDriver(driver: string | null | undefined): DriverSubs {
  const d = (driver || 'none') as PlanDriver;
  return MATRIX[d] || MATRIX.none;
}

export interface AsymSignals {
  ktwGapCm: number | null; // ≥2 — значимо
  fppaGapDeg: number | null; // ≥10 — watch
  ybtAsymCm: number | null; // >4 — warn
  rotGapDeg: number | null; // ≥10 — watch
}

/** Асимметрия важнее композита: возвращаем только значимые, сортированные по величине эффекта. */
export function asymPriority(s: AsymSignals): string[] {
  const out: string[] = [];
  if (s.ktwGapCm != null && s.ktwGapCm >= 2) out.push(`голеностоп ${s.ktwGapCm} см (≥2)`);
  if (s.ybtAsymCm != null && s.ybtAsymCm > 4) out.push(`YBT-anterior ${s.ybtAsymCm} см (>4)`);
  if (s.fppaGapDeg != null && s.fppaGapDeg >= 10) out.push(`FPPA ${s.fppaGapDeg}° (≥10)`);
  if (s.rotGapDeg != null && s.rotGapDeg >= 10) out.push(`ротация грудного ${s.rotGapDeg}° (≥10)`);
  return out;
}

export function asymPriorityText(s: AsymSignals): string {
  const list = asymPriority(s);
  if (!list.length) return 'Асимметрии: значимых нет — работаем по драйверу';
  return `Асимметрии (важнее композита): ${list.join(' · ')} — слабую сторону первой в сессии, перепроверка через 2–4 нед`;
}
