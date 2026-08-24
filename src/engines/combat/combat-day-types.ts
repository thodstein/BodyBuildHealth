/**
 * combat-day-types.ts — TAG_MUSCLES для единоборств.
 * Приоритеты: шея, хват, ротация кора, односторонние ноги, тяги.
 */

export const COMBAT_TAG_MUSCLES: Record<string, string[]> = {
  upper_power: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'neck', 'forearms'],
  lower_power: ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'neck'],
  full_power: ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'neck', 'forearms', 'abs'],
  full_conditioning: ['neck', 'forearms', 'abs', 'shoulders', 'back', 'quads', 'hamstrings'],
  neck_grip: ['neck', 'traps', 'forearms', 'shoulders'],
};

export const COMBAT_SESSION_FOCUS: Record<string, string> = {
  upper_power: 'Жим/Тяга/Плечи + шея/хват',
  lower_power: 'Присед/Тяга/Выпады + икры/кор',
  full_power: 'Фулбоди тяж — база',
  full_conditioning: 'Шея/Хват/Кор ротация + памп',
  neck_grip: 'Шея + трапеции + хват',
};

export function combatTagMuscles(tag: string): string[] {
  return COMBAT_TAG_MUSCLES[tag] || COMBAT_TAG_MUSCLES.full_power;
}

/** Для combat шея и хват — обязательны каждую неделю */
export const COMBAT_MANDATORY_MUSCLES: string[] = ['neck', 'forearms', 'abs'];

/** Запрет тяжёлых ног за день до high внезальной — проверка в builder */
export function combatNeedsLightLegs(goal: string): boolean {
  return goal === 'weight_cut' || goal === 'camp';
}
