/**
 * combat-split-patterns.ts — сплиты для единоборств (зал 2-4×/нед).
 * При высокой внезальной нагрузке (4-5×/нед) частота зала снижается.
 */
export interface ScheduleDay { kind: 'тренировка' | 'отдых'; character: 'тяж' | 'памп' | 'лёг' | null; sessionTag?: string; }
export interface CombatPattern {
  id: string;
  name: string;
  rotationDays: number;
  sessionsPerRotation: number;
  schedule: ScheduleDay[];
  level: string[];
  description: string;
}

export const COMBAT_PATTERNS: CombatPattern[] = [
  {
    id: 'combat_2a',
    name: '2×/нед — Верх/Низ',
    rotationDays: 7, sessionsPerRotation: 2,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'upper_power' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'lower_power' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    description: 'Минимум для кэмпа с 5× вне зала. Верх (жим/тяга/шея) + Низ (присед/тяга/хват).',
  },
  {
    id: 'combat_2b',
    name: '2×/нед — Фулбоди',
    rotationDays: 7, sessionsPerRotation: 2,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'full_power' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'full_power' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    description: 'Два фулбоди тяж — универсально при высокой внезальной.',
  },
  {
    id: 'combat_3',
    name: '3×/нед — Верх/Низ/Фул',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'upper_power' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'lower_power' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'full_conditioning' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    description: 'Оптимум: верх тяж → низ тяж → фул памп (шея/кор/ротация/хват).',
  },
  {
    id: 'combat_3b',
    name: '3×/нед — Ротация тяж/памп',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'full_power' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'full_power' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'full_power' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Тяж/памп/тяж — волны для единоборств с акцентом на восстановление.',
  },
  {
    id: 'combat_4',
    name: '4×/нед — Верх/Низ ×2',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'upper_power' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'lower_power' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'upper_power' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'lower_power' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Только при внезальной ≤3×/нед. Два тяж + два памп.',
  },
];

export function getCombatPattern(id: string): CombatPattern | undefined {
  return COMBAT_PATTERNS.find(p => p.id === id);
}

export function recommendCombatPattern(daysPerWeek: number, outsideSessions: number, level: string): CombatPattern {
  // при высокой внезальной — не рекомендуем 4×
  if (outsideSessions >= 4 && daysPerWeek >= 4) daysPerWeek = 3;
  const byDays = COMBAT_PATTERNS.filter(p => p.sessionsPerRotation === daysPerWeek);
  if (byDays.length) {
    const byLevel = byDays.find(p => p.level.includes(level));
    if (byLevel) return byLevel;
    return byDays[0];
  }
  // fallback ближайший
  let best = COMBAT_PATTERNS[0];
  let bestDiff = Math.abs(best.sessionsPerRotation - daysPerWeek);
  for (const p of COMBAT_PATTERNS) {
    const d = Math.abs(p.sessionsPerRotation - daysPerWeek);
    if (d < bestDiff) { best = p; bestDiff = d; }
  }
  return best;
}

export function validateCombatPatterns(): string[] {
  const errs: string[] = [];
  for (const p of COMBAT_PATTERNS) {
    if (p.schedule.length !== p.rotationDays) errs.push(`${p.id}: schedule.length ${p.schedule.length} !== rotationDays ${p.rotationDays}`);
    const t = p.schedule.filter(d => d.kind === 'тренировка').length;
    if (t !== p.sessionsPerRotation) errs.push(`${p.id}: training ${t} !== sessionsPerRotation ${p.sessionsPerRotation}`);
  }
  return errs;
}
