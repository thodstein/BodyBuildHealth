/**
 * goals.ts — единый реестр целей программ (BB / PL / Hybrid + legacy).
 * Убирает дубли GOAL_OPTS_BB/PL/HYBRID из ProgramManagerPanel/ProgramEditorView/manual-draft.
 */

export const GOAL_OPTS_BB: Array<{ id: string; label: string }> = [
  { id: 'hypertrophy', label: 'Масса (гипертрофия)' },
  { id: 'cut', label: 'Сушка' },
  { id: 'recomp', label: 'Рекомпозиция' },
  { id: 'maintenance', label: 'Поддержание' },
  { id: 'strength_mass', label: 'Сила+Масса' },
  { id: 'rehab', label: 'Реабилитация' },
];

export const GOAL_OPTS_PL: Array<{ id: string; label: string }> = [
  { id: 'pl_endurance', label: 'Выносливость (GPP)' },
  { id: 'pl_strength', label: 'Сила' },
  { id: 'pl_speed', label: 'Скорость/Координация' },
  { id: 'pl_peaking', label: 'Выход на пик' },
  { id: 'rehab', label: 'Реабилитация' },
];

export const GOAL_OPTS_HYBRID: Array<{ id: string; label: string }> = [
  { id: 'pb_endurance', label: 'Выносливость (функц.)' },
  { id: 'pb_strength', label: 'Сила (ПЛ+ББ)' },
  { id: 'pb_mass', label: 'Масса (гипертрофия+база)' },
  { id: 'pb_peaking', label: 'Пик (сила+сушка)' },
  { id: 'rehab', label: 'Реабилитация' },
];

// Legacy для отображения старых программ
const LEGACY_OPTS: Array<{ id: string; label: string }> = [
  { id: 'powerlifting', label: 'Сила (ПЛ, legacy)' },
  { id: 'peaking', label: 'Пик/сушка (legacy)' },
  { id: 'mass', label: 'Масса (legacy)' },
  { id: 'bulk', label: 'Масса (legacy bulk)' },
  { id: 'bodybuilding', label: 'Бодибилдинг (legacy)' },
  { id: 'strength', label: 'Сила (legacy)' },
];

const ALL_OPTS: Array<{ id: string; label: string }> = [
  ...GOAL_OPTS_BB,
  ...GOAL_OPTS_PL.filter(o => !GOAL_OPTS_BB.some(b => b.id === o.id)),
  ...GOAL_OPTS_HYBRID.filter(o => !GOAL_OPTS_BB.some(b => b.id === o.id) && !GOAL_OPTS_PL.some(b => b.id === o.id)),
  ...LEGACY_OPTS,
];

export function goalLabelOf(id: string): string {
  return ALL_OPTS.find(g => g.id === id)?.label ?? id;
}

/** Канонизация BB-цели для движка (hypertrophy ↔ mass — синонимы). */
export function canonicalBBGoal(g?: string): string {
  if (!g) return 'hypertrophy';
  const m: Record<string, string> = {
    hypertrophy: 'hypertrophy',
    mass: 'hypertrophy',
    bulk: 'hypertrophy',
    bodybuilding: 'hypertrophy',
    strength: 'strength_mass',
    strength_mass: 'strength_mass',
    cut: 'cut',
    recomp: 'recomp',
    maintenance: 'maintenance',
    rehab: 'rehab',
  };
  return m[g] ?? g;
}

/** Маппинг цели UserProgram → цель MacrocyclePanel. */
export function mapGoalToMacro(g: string): 'powerlifting' | 'bodybuilding' | 'general' {
  if (g === 'powerlifting' || g === 'peaking' || g === 'strength' || g === 'pl_strength' || g === 'pl_peaking') return 'powerlifting';
  if (g === 'hypertrophy' || g === 'bodybuilding' || g === 'mass' || g === 'bulk' || g === 'cut' || g === 'recomp' || g === 'strength_mass') return 'bodybuilding';
  return 'general';
}

/** BBGoal для bb-builder: mass/hypertrophy → mass, strength → strength_mass. */
export function toBBGoal(g: string): string {
  const canon = canonicalBBGoal(g);
  if (canon === 'hypertrophy') return 'mass';
  if (canon === 'strength_mass') return 'strength_mass';
  return canon;
}

export const BB_GOALS_CANON = ['mass','strength','cut','recomp','maintenance','strength_mass','hypertrophy','bodybuilding','athletic'] as const;
