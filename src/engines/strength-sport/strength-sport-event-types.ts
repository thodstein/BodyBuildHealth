/**
 * strength-sport-event-types.ts — таксономия стронг-ивентов (PRO).
 * Различает классы: max / reps_60s / medley_distance / medley_time / loading_race / hold
 * + мета: дистанция, timeCap, шаг веса, коэфф замены.
 */

export type EventClass = 'max' | 'reps_60s' | 'medley_distance' | 'medley_time' | 'loading_race' | 'hold' | 'carry';

export interface EventMeta {
  label: string;
  class: EventClass;
  stepKg: number;
  defaultDistanceM?: number;
  defaultTimeCapS?: number;
  implements?: string[];
  description?: string;
}

export const EVENT_META: Record<string, EventMeta> = {
  log_press: { label: 'Лог-пресс', class: 'max', stepKg: 2.5, description: 'Максимум над головой из стоек' },
  axle_press: { label: 'Аксель-пресс', class: 'max', stepKg: 2.5 },
  circus_db_press: { label: 'Циркум-гантель', class: 'max', stepKg: 2.5 },
  circus_db_clean: { label: 'Циркум-подъём', class: 'max', stepKg: 2.5 },
  viking_press: { label: 'Викинг-пресс', class: 'reps_60s', stepKg: 5, defaultTimeCapS: 60, description: 'Вертикальный жим машины — reps 60-75с' },
  yoke_walk: { label: 'Йок', class: 'medley_distance', stepKg: 10, defaultDistanceM: 20, defaultTimeCapS: 60 },
  farmers_walk_heavy: { label: 'Фермер', class: 'medley_distance', stepKg: 5, defaultDistanceM: 40, defaultTimeCapS: 60 },
  frame_carry: { label: 'Рама', class: 'medley_distance', stepKg: 10, defaultDistanceM: 20, defaultTimeCapS: 60 },
  husafell_carry: { label: 'Хусафелл', class: 'carry', stepKg: 5, defaultDistanceM: 40, defaultTimeCapS: 75 },
  conan_wheel: { label: 'Колесо Конана', class: 'hold', stepKg: 5, defaultDistanceM: 30, defaultTimeCapS: 90, description: 'Удержание круга на груди — дистанция/время' },
  shield_carry: { label: 'Щит Конана', class: 'carry', stepKg: 5, defaultDistanceM: 20, defaultTimeCapS: 60 },
  duck_walk: { label: 'Утиная походка', class: 'carry', stepKg: 5, defaultDistanceM: 20, defaultTimeCapS: 60 },
  zercher_carry: { label: 'Зерчер', class: 'carry', stepKg: 5, defaultDistanceM: 20, defaultTimeCapS: 60 },
  sandbag_carry: { label: 'Мешок переноска', class: 'carry', stepKg: 5, defaultDistanceM: 30, defaultTimeCapS: 60 },
  truck_pull: { label: 'Тяга грузовика', class: 'medley_distance', stepKg: 10, defaultDistanceM: 20, defaultTimeCapS: 90, description: 'Канат/упряжь — тяга техники' },
  arm_over_arm: { label: 'К руке', class: 'medley_distance', stepKg: 5, defaultDistanceM: 20, defaultTimeCapS: 60 },
  sandbag_load: { label: 'Мешок загрузка', class: 'loading_race', stepKg: 5, defaultDistanceM: 0, defaultTimeCapS: 60 },
  sandbag_over_bar: { label: 'Мешок через планку', class: 'loading_race', stepKg: 5, defaultTimeCapS: 60 },
  sandbag_to_shoulder_ladder: { label: 'Мешок лестница', class: 'loading_race', stepKg: 5, defaultTimeCapS: 75 },
  atlas_stone_load: { label: 'Атлас-камень', class: 'loading_race', stepKg: 5, defaultDistanceM: 0, defaultTimeCapS: 60 },
  atlas_stone_over_bar: { label: 'Камень через планку', class: 'loading_race', stepKg: 5, defaultTimeCapS: 60 },
  stone_lift: { label: 'Камень на платформу', class: 'loading_race', stepKg: 5 },
  natural_stone_shoulder: { label: 'Натуральный камень', class: 'loading_race', stepKg: 5, defaultTimeCapS: 60 },
  sandbag_shoulder: { label: 'Мешок на плечо', class: 'loading_race', stepKg: 5 },
  keg_over_bar: { label: 'Бочка через планку', class: 'loading_race', stepKg: 2, defaultTimeCapS: 60 },
  keg_load: { label: 'Бочка загрузка', class: 'loading_race', stepKg: 2, defaultTimeCapS: 60 },
  tire_flip: { label: 'Покрышка', class: 'reps_60s', stepKg: 0, defaultTimeCapS: 60 },
  sled_push_sprint: { label: 'Сани спринт', class: 'medley_time', stepKg: 5, defaultDistanceM: 25, defaultTimeCapS: 30 },
  car_deadlift_18: { label: 'Автодедлифт 18″', class: 'reps_60s', stepKg: 10 },
  car_deadlift_side: { label: 'Автодедлифт боковой', class: 'reps_60s', stepKg: 10 },
  axle_deadlift: { label: 'Аксель-тяга', class: 'max', stepKg: 5 },
  deadlift: { label: 'Становая', class: 'max', stepKg: 5 },
  deadlift_max: { label: 'Тяга макс', class: 'max', stepKg: 5 },
  keg_toss: { label: 'Бросок бочки', class: 'reps_60s', stepKg: 2 },
  sandbag_toss: { label: 'Бросок мешка', class: 'reps_60s', stepKg: 2 },
  sled_drag: { label: 'Тяга саней', class: 'medley_distance', stepKg: 5, defaultDistanceM: 20 },
  sled_push: { label: 'Толкание саней', class: 'medley_distance', stepKg: 5, defaultDistanceM: 20 },
  circus_db_medley: { label: 'Гантели медили', class: 'loading_race', stepKg: 2.5, defaultTimeCapS: 75 },
};

export function getEventMeta(id: string): EventMeta | null {
  return EVENT_META[id] || null;
}

export function isCarry(id: string): boolean {
  const m = EVENT_META[id];
  if (!m) return id.includes('farmers') || id.includes('yoke') || id.includes('carry') || id.includes('sled') || id.includes('husafell') || id.includes('frame');
  return m.class === 'carry' || m.class === 'medley_distance' || m.class === 'medley_time';
}

export function isLoading(id: string): boolean {
  const m = EVENT_META[id];
  if (!m) return id.includes('stone') || id.includes('sandbag');
  return m.class === 'loading_race';
}

// Коэффициенты замены веса при отсутствии снаряда (относительно оригинала)
export const STRONG_FALLBACK_COEFF: Record<string, number> = {
  yoke_walk: 0.73, // йок 300 → фермер 2×110 ≈0.73 суммарно
  farmers_walk_heavy: 1.0,
  frame_carry: 0.80,
  husafell_carry: 0.85,
  conan_wheel: 0.75,
  shield_carry: 0.78,
  duck_walk: 0.80,
  truck_pull: 0.85,
  arm_over_arm: 0.85,
  log_press: 0.95, // лог 100 → аксель 95
  axle_press: 0.98,
  viking_press: 0.92,
  atlas_stone_load: 0.66, // камень 120 → мешок 80
  atlas_stone_over_bar: 0.66,
  stone_lift: 0.66,
  natural_stone_shoulder: 0.68,
  sandbag_shoulder: 1.0,
  sandbag_load: 1.0,
  sandbag_carry: 1.0,
  sandbag_over_bar: 1.0,
  sandbag_toss: 1.0,
  keg_toss: 1.0,
  keg_over_bar: 1.0,
  keg_load: 1.0,
  car_deadlift_18: 0.90,
  car_deadlift_side: 0.88,
  axle_deadlift: 1.0,
  circus_db_medley: 0.95,
};
