/**
 * combat-female-travel.engine.ts — женские нормы + RED-S + travel-режим (P5 PRO).
 * Чистые функции; сборка решает rationale vs warnings vs errors.
 * Источники: BB-prep женская подготовка (RED-S floor 1400, жиры ≥0.8, железо/кальций,
 * лютеиновая задержка +0.5–1кг, темп 0.4%/нед), ISSN-16 (полы), hotel-прецедент ББ.
 */

/** Дефолтный темп длительной сгонки (%/нед): Ж 0.4 (меньше жировой ткани, риск RED-S), М 0.5. */
export function femaleCutTempoDefault(sex: 'male' | 'female' | null | undefined): 0.4 | 0.5 {
  return sex === 'female' ? 0.4 : 0.5;
}

/** Женские примечания питания/цикла (только строки — цифр новых ноль, всё из weight-cut движка). */
export function femaleCombatNotes(input: {
  sex?: string | null;
  lutealPhase?: boolean;
  weightCutKg?: number | null;
  bodyweightKg?: number | null;
}): string[] {
  if (input.sex !== 'female') return [];
  const notes: string[] = [
    'Железо: красное мясо/печень/шпинат — дефицит типичен для женской сушки',
    'Кальций 1000–1200 мг — защита костей при низком % жира',
    'Жиры ≥0.8 г/кг (мин 40 г), пол 1400 ккал (RED-S) — ниже нельзя',
  ];
  if (input.lutealPhase) {
    notes.push('Лютеиновая фаза: задержка воды +0.5–1 кг — не паниковать, анализ по среднему за 7 дней');
  }
  if (typeof input.weightCutKg === 'number' && input.weightCutKg > 0) {
    notes.push('Темп сгонки 0.4%/нед (медленнее мужского 0.5%/нед — меньше жировой ткани, риск RED-S)');
  }
  return notes;
}

/** Отельный пул: только свой вес (турник/зал отсутствуют). Верх ограничен честно. */
export const HOTEL_POOL: string[] = [
  'neck_isometric_front',
  'neck_isometric_back',
  'neck_isometric_side',
  'neck_band_rotation_isometric',
  'deadbug',
  'hollow_hold',
  'side_plank',
  'copenhagen_plank',
  'bulgarian_split_heavy',
  'single_leg_rdl_combat',
  'cossack_squat',
  'step_up',
  'hip_thrust',
  'calf_raise',
];

/** Hotel-фильтр пула: пересечение с HOTEL_POOL; пусто → deadbug/side_plank (доступны всегда). */
export function travelPoolFilter(pool: string[], travelMode: string | null | undefined): string[] {
  if (travelMode !== 'hotel') return pool;
  const out = pool.filter(id => HOTEL_POOL.includes(id));
  return out.length ? out : ['deadbug', 'side_plank'];
}

/** Мультипликатор объёма в дороге: hotel ×0.9 (поддержание, без зала). */
export function travelVolumeMult(travelMode: string | null | undefined): number {
  return travelMode === 'hotel' ? 0.9 : 1;
}

/** Сдвиг тапера при перелёте: бой + дорога → +2–3 дня (строкой в rationale, без выдуманной математики). */
export function travelTaperNote(travelMode: string | null | undefined, hasFightDate: boolean): string | null {
  if (travelMode === 'hotel' && hasFightDate) {
    return 'Перелёт + бой: добавьте 2–3 дня к таперу (джетлаг/сон) — лёгкая аэробка по прилёту, тренировка по самочувствию';
  }
  if (travelMode === 'hotel') {
    return 'Отель: только свой вес — верх ограничен, режим поддержания (объём ×0.9)';
  }
  return null;
}
