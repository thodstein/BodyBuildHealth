/**
 * bb-cycle.engine.ts — P1: женский цикл во вне-соревновательный период.
 *
 * Фаза менструального цикла влияет на готовность/объём (лютеиновая фаза — задержка
 * воды +0.5-1 кг, снижение силы/восстановления). Здесь — лёгкая модуляция объёма
 * в лютеиновую фазу (×0.95) для женщин вне prep (в prep это уже моделируется отдельно).
 *
 * Капы не меняются — мягкий флор-множитель внутри существующих лимитов.
 */

/** Фазы цикла (по дню цикла, длина по умолчанию 28). */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export function cyclePhaseForDay(cycleDay: number, cycleLength = 28): CyclePhase {
  const d = Math.max(1, Math.round(cycleDay));
  const len = cycleLength > 0 ? cycleLength : 28;
  if (d <= Math.round(len * 0.15)) return 'menstrual'; // ~дни 1-4
  if (d <= Math.round(len * 0.4)) return 'follicular';
  if (d <= Math.round(len * 0.55)) return 'ovulatory';
  return 'luteal';
}

/** Множитель объёма по фазе: лютеиновая — лёгкое снижение (×0.95), остальные ×1.0. */
export function cycleVolumeFactor(cycleDay: number | undefined, cycleLength = 28, sex: string = 'male'): number {
  if (sex !== 'female' || !Number.isFinite(cycleDay)) return 1.0;
  const phase = cyclePhaseForDay(cycleDay, cycleLength);
  return phase === 'luteal' ? 0.95 : 1.0;
}

/** RU-подпись фазы для UI/рационала. */
export function cyclePhaseLabel(phase: CyclePhase): string {
  return { menstrual: 'Менструальная', follicular: 'Фолликулярная', ovulatory: 'Овуляторная', luteal: 'Лютеиновая' }[phase];
}
