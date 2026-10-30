/**
 * planner-train-type.ts — B22 (аудит 2026-10).
 *
 * Находка: `trainType` НЕ сохранялся в профиль, а при загрузке профиля выводился
 * из количества тренировок:
 *
 * ```ts
 * if (s.training.daysPerWeek) setTrainType(s.training.daysPerWeek >= 5 ? 'strength' : ... : 'cardio');
 * ```
 *
 * Поэтому выбор пользователя затирался при каждом открытии экрана: 3 дня в неделю
 * всегда давали «mixed», даже если человек занимается только силовыми. Тип тренинга
 * участвует в расчёте PAL/рекомендаций, то есть ошибка попадала в цифры.
 *
 * Теперь тип сохраняется, а эвристика по дням используется ТОЛЬКО для старых
 * профилей, где поля ещё нет.
 */

export type TrainType = 'strength' | 'cardio' | 'mixed' | 'hiit';

const VALID: readonly TrainType[] = ['strength', 'cardio', 'mixed', 'hiit'];

export function isTrainType(v: unknown): v is TrainType {
  return typeof v === 'string' && (VALID as readonly string[]).includes(v);
}

/**
 * Тип тренинга для загрузки профиля.
 * Приоритет: сохранённое значение → эвристика по дням (обратная совместимость).
 */
export function resolveTrainType(saved: unknown, daysPerWeek: unknown): TrainType {
  if (isTrainType(saved)) return saved;
  const n = Number(daysPerWeek);
  if (!Number.isFinite(n) || n <= 0) return 'mixed';
  if (n >= 5) return 'strength';
  if (n >= 3) return 'mixed';
  return 'cardio';
}
