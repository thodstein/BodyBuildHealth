/**
 * combat-specialization.ts — специализация единоборств (изолировано).
 * Дисциплина определяет акценты зала.
 */
export type Discipline = 'boxing' | 'mma' | 'wrestling' | 'kickboxing' | 'general';

export function accentForDiscipline(d: Discipline): Record<string, number> {
  // множитель объёма по группам
  if (d==='boxing') return { neck: 1.2, rotational: 1.25, legs: 0.85, grip: 1.0, push: 1.1 };
  if (d==='mma') return { neck: 1.2, grip: 1.25, rotational: 1.15, legs: 1.0, pull: 1.1 };
  if (d==='wrestling') return { neck: 1.3, grip: 1.3, legs: 1.2, rotational: 1.0, pull: 1.15 };
  if (d==='kickboxing') return { rotational: 1.25, legs: 1.15, neck: 1.1, grip: 0.9 };
  return { neck: 1.0, grip: 1.0, rotational: 1.0, legs: 1.0, push: 1.0, pull: 1.0 };
}

export function ensureMandatory(plan: any): void {
  // заглушка: проверка что neck/grip покрыты — используется в finalize
}
