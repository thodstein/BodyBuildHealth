/**
 * strength-sport-day-types.ts — мышцы/слоты по дням для ТА/стронга.
 * Аналог bb-day-types: TAG_MUSCLES + ROTATION logic.
 */

export const SS_TAG_MUSCLES: Record<string, string[]> = {
  // Weightlifting
  snatch_day: ['quads', 'hamstrings', 'back', 'shoulders', 'traps'],
  clean_day: ['quads', 'hamstrings', 'back', 'shoulders', 'traps'],
  strength_day: ['quads', 'hamstrings', 'glutes', 'back', 'chest'],
  technique_day: ['quads', 'shoulders', 'back', 'traps'],
  pull_day: ['back', 'hamstrings', 'traps', 'forearms'],
  accessory_day: ['shoulders', 'back', 'abs', 'forearms'],
  // Strongman
  overhead_day: ['shoulders', 'triceps', 'chest', 'traps', 'abs'],
  deadlift_day: ['back', 'hamstrings', 'glutes', 'forearms', 'traps'],
  squat_day: ['quads', 'hamstrings', 'glutes', 'abs'],
  event_day: ['back', 'shoulders', 'forearms', 'traps', 'calves'],
  // Hybrid
  oly_day: ['quads', 'hamstrings', 'back', 'shoulders'],
};

export const SS_SESSION_FOCUS: Record<string, string> = {
  snatch_day: 'Рывок + тяги + присед оверхед',
  clean_day: 'Толчок + фронт-присед + жим',
  strength_day: 'Присед + тяга + жим',
  technique_day: 'Техника 50-70% — рывок/толчок по 1-2 повт',
  pull_day: 'Тяги рывковые/толчковые + шраги + хват',
  accessory_day: 'Плечи/спина/кор — памп',
  overhead_day: 'Лог/швунг/жим стоя + трицепс',
  deadlift_day: 'Становая/сумо + фермер/йок-замены',
  squat_day: 'Присед/фронт + выпады + икры',
  event_day: 'Фермер/йок/камни/сани — замены если нет снарядов',
  oly_day: 'Рывок+толчок-лайт + тяги',
};

export function tagMuscles(tag: string): string[] {
  return SS_TAG_MUSCLES[tag] || ['quads', 'back', 'shoulders'];
}

/** Селект упражнений по тегу — какие группы в фокусе как primary */
export function isPrimaryForTag(muscle: string, tag: string): boolean {
  const primaries: Record<string, string[]> = {
    snatch_day: ['quads', 'hamstrings', 'shoulders', 'traps'],
    clean_day: ['quads', 'hamstrings', 'shoulders', 'back'],
    strength_day: ['quads', 'hamstrings', 'back'],
    overhead_day: ['shoulders', 'triceps'],
    deadlift_day: ['back', 'hamstrings', 'glutes'],
    squat_day: ['quads', 'glutes'],
    event_day: ['back', 'forearms', 'traps'],
    oly_day: ['quads', 'hamstrings'],
  };
  const list = primaries[tag];
  if (!list) return true;
  return list.includes(muscle);
}
