/**
 * combat-specialization.ts — специализация единоборств (изолировано).
 * Дисциплина определяет акценты зала.
 */
export type Discipline = 'boxing' | 'mma' | 'wrestling' | 'kickboxing' | 'general';

export function accentForDiscipline(d: Discipline): Record<string, number> {
  // множитель объёма по группам — базовый дисциплинарный
  if (d==='boxing') return { neck: 1.2, rotational: 1.25, legs: 0.85, grip: 1.0, push: 1.1, pull: 1.05, plyo: 1.1 };
  if (d==='mma') return { neck: 1.2, grip: 1.25, rotational: 1.15, legs: 1.0, pull: 1.1, plyo: 1.05 };
  if (d==='wrestling') return { neck: 1.3, grip: 1.3, legs: 1.2, rotational: 1.0, pull: 1.15, unilateral: 1.2 };
  if (d==='kickboxing') return { rotational: 1.25, legs: 1.15, neck: 1.1, grip: 0.9, plyo: 1.15, unilateral: 1.1 };
  return { neck: 1.0, grip: 1.0, rotational: 1.0, legs: 1.0, push: 1.0, pull: 1.0, plyo: 1.0, unilateral: 1.0 };
}

export type FightStyle = 'striker' | 'grappler' | 'hybrid';
export function accentForFightStyle(style: FightStyle | undefined, discipline: Discipline): Record<string, number> {
  if (!style || style==='hybrid') return { rotational: 1.0, neck: 1.0, grip: 1.0, legs: 1.0, plyo: 1.0 };
  if (style==='striker') return { rotational: 1.2, plyo: 1.15, legs: 1.05, neck: 1.0, grip: 0.95 };
  if (style==='grappler') return { neck: 1.15, grip: 1.15, legs: 1.1, unilateral: 1.15, pull: 1.1, rotational: 0.95 };
  return { rotational: 1.0, neck: 1.0, grip: 1.0 };
}
export function styleNarrative(style: FightStyle | undefined, discipline: Discipline): string {
  if (style==='striker') return 'Striker: ротация+плио+contrast — удар, скорость, анти-ротация кора';
  if (style==='grappler') return 'Grappler: шея/хват+унилатеральные ноги+тяги — клинч, партер, борьба';
  return 'Hybrid: баланс удар/борьба — упор на дисциплину';
}

export function ensureMandatory(plan: any): void {
  // заглушка: проверка что neck/grip покрыты — используется в finalize
}
