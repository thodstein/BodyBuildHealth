/**
 * cardio-red-flags.engine.ts — медицинский скрининг кардио (P4 PRO-2).
 * Скрининг, не диагноз: любой красный флаг → только Z2/recovery
 * до очной консультации врача. Чистые функции, без IO.
 */

export type CardioRedFlagId =
  | 'chest_pain'
  | 'syncope'
  | 'known_cardio'
  | 'family_scd'
  | 'uncontrolled_hbp';

export interface CardioRedFlag {
  id: CardioRedFlagId;
  label: string;
  hint: string;
}

export const CARDIO_RED_FLAGS: CardioRedFlag[] = [
  { id: 'chest_pain', label: 'Боль/давление в груди при нагрузке', hint: 'Прекратить интенсив, к врачу.' },
  { id: 'syncope', label: 'Обморок/предобморок на нагрузке', hint: 'Стоп-интенсив, к врачу.' },
  { id: 'known_cardio', label: 'Известная болезнь сердца', hint: 'Только по допуску врача.' },
  { id: 'family_scd', label: 'ВСС у родственников <50 лет', hint: 'Скрининг у кардиолога.' },
  { id: 'uncontrolled_hbp', label: 'Неконтролируемая гипертония', hint: 'Сначала контроль АД.' },
];

export interface CardioRedFlagScreen {
  /** HIIT/MISS запрещены, только Z2/recovery. */
  blockHiit: boolean;
  /** Подросток 14–15: щадящий режим независимо от флагов. */
  teen: boolean;
  /** Строка для rationale/бана («к врачу», не диагноз). */
  doctorNote: string | null;
}

function normFlags(flags?: Array<string | null | undefined>): CardioRedFlagId[] {
  if (!Array.isArray(flags)) return [];
  const known = new Set(CARDIO_RED_FLAGS.map(f => f.id));
  const out: CardioRedFlagId[] = [];
  for (const f of flags) {
    if (typeof f === 'string' && known.has(f as CardioRedFlagId) && !out.includes(f as CardioRedFlagId)) {
      out.push(f as CardioRedFlagId);
    }
  }
  return out;
}

/**
 * Скрининг. Возраст: 14–15 → teen-режим; <14 — тоже teen (консервативно).
 * 40+ без флага — НЕ блочит (честно: возраст сам по себе не болезнь).
 */
export function screenCardioRedFlags(
  flags?: Array<string | null | undefined>,
  age?: number,
): CardioRedFlagScreen {
  const clean = normFlags(flags);
  const teen = typeof age === 'number' && Number.isFinite(age) && age >= 0 && age < 16 && age >= 14;
  const child = typeof age === 'number' && Number.isFinite(age) && age >= 0 && age < 14;
  const blockHiit = clean.length > 0 || teen || child;
  if (!blockHiit) return { blockHiit: false, teen: false, doctorNote: null };
  if (teen || child) {
    return {
      blockHiit: true,
      teen: true,
      doctorNote: 'Возраст 14–15 (или младше): только Z2/recovery, без отказов — к врачу/тренеру за допуском.',
    };
  }
  const labels = clean
    .map(id => CARDIO_RED_FLAGS.find(f => f.id === id)?.label ?? id)
    .join('; ');
  return {
    blockHiit: true,
    teen: false,
    doctorNote: `Красные флаги (${labels}): HIIT/MISS запрещены до очной консультации врача — только Z2/recovery. Скрининг, не диагноз.`,
  };
}

/** Нужен ли мед-блок сборке (единая точка для build + validator). */
export function needsMedicalBlock(flags?: Array<string | null | undefined>, age?: number): boolean {
  return screenCardioRedFlags(flags, age).blockHiit;
}
