/**
 * combat-variants.ts — A/B варианты плана (E6).
 *
 * В боевом конструкторе нельзя было ни сохранить «два варианта сборки», ни
 * сравнить их, ни вернуться к вчерашнему решению, не пересобирая всё заново.
 * Вариант = снимок плана + ключевые входы; хранится отдельно от плана,
 * чтобы сборка не затирала историю решений.
 */
import type { CombatPlan, CombatInput } from './combat.types';

export const COMBAT_VARIANTS_KEY = 'he_combat_variants_v1';
export const COMBAT_VARIANTS_CAP = 10;

export interface CombatVariant {
  id: string;
  name: string;
  createdAt: string;
  /** Снимок плана для сравнения и возврата. */
  plan: CombatPlan;
  /** Ключевые входы — по ним строится diff «почему варианты разные». */
  inputs: {
    discipline: string;
    goal: string;
    level: string;
    weeks: number;
    daysPerWeek: number;
    patternId: string;
  };
  totalSets: number;
  tonnage: number;
  hasFight: boolean;
  hasWeightCut: boolean;
}

/** Ключевые входы плана — единственный источник для diff. */
export function variantInputs(plan: CombatPlan | null | undefined): CombatVariant['inputs'] {
  const s: any = plan?.inputSnapshot || {};
  return {
    discipline: s.discipline || plan?.discipline || '—',
    goal: s.goal || plan?.goal || '—',
    level: s.level || plan?.level || '—',
    weeks: num(s.weeks ?? plan?.weeks),
    daysPerWeek: num(s.daysPerWeek),
    patternId: s.patternId || plan?.patternId || '—',
  };
}

function num(v: any): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function planTotals(plan: CombatPlan): { sets: number; tonnage: number } {
  let sets = 0, tonnage = 0;
  for (const w of plan.weeksData || []) {
    sets += num(w.totalSets);
    tonnage += num((w as any).totalTonnage);
  }
  return { sets, tonnage };
}

export function variantFromPlan(plan: CombatPlan, name: string, now = new Date().toISOString()): CombatVariant {
  const { sets, tonnage } = planTotals(plan);
  const s: any = plan?.inputSnapshot || {};
  return {
    // id детерминирован по содержимому: повторное сохранение того же плана
    // не плодит дубли, и вариант переживает перезагрузку
    id: `cv_${planTotals(plan).sets}_${planTotals(plan).tonnage}_${s.patternId || plan.patternId || 'x'}_${s.daysPerWeek || 0}`,
    name: (name || '').trim() || `Вариант ${plan.weeks}нд`,
    createdAt: now,
    plan,
    inputs: variantInputs(plan),
    totalSets: sets,
    tonnage,
    hasFight: typeof s.fightDate === 'string' && !!s.fightDate,
    hasWeightCut: num(s.weightCutKg) > 0 || !!s.weightCutProtocol,
  };
}

export function isCombatVariantShape(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (typeof raw.id !== 'string' || !raw.id) return false;
  if (typeof raw.name !== 'string') return false;
  if (!raw.plan || typeof raw.plan !== 'object') return false;
  if (!Array.isArray(raw.plan.weeksData)) return false;
  if (!raw.inputs || typeof raw.inputs !== 'object') return false;
  return true;
}

export function loadCombatVariants(): CombatVariant[] {
  try {
    const raw = localStorage.getItem(COMBAT_VARIANTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCombatVariantShape).slice(-COMBAT_VARIANTS_CAP);
  } catch {
    return [];
  }
}

export function saveCombatVariants(list: CombatVariant[]): boolean {
  try {
    localStorage.setItem(COMBAT_VARIANTS_KEY, JSON.stringify(list.slice(-COMBAT_VARIANTS_CAP)));
    return true;
  } catch {
    return false;
  }
}

/** Добавить/заменить вариант. Один и тот же id перезаписывается, кап 10. */
export function addCombatVariant(plan: CombatPlan, name: string, now?: string): CombatVariant[] {
  const v = variantFromPlan(plan, name, now);
  const list = loadCombatVariants().filter(x => x.id !== v.id);
  list.push(v);
  return saveCombatVariants(list) ? list : loadCombatVariants();
}

export function removeCombatVariant(id: string): CombatVariant[] {
  const list = loadCombatVariants().filter(x => x.id !== id);
  saveCombatVariants(list);
  return list;
}

export interface VariantDiffRow {
  key: keyof CombatVariant['inputs'] | 'totalSets' | 'tonnage' | 'fight' | 'weightCut';
  label: string;
  a: string;
  b: string;
  changed: boolean;
}

const INPUT_LABELS: Record<string, string> = {
  discipline: 'Вид спорта',
  goal: 'Цель',
  level: 'Уровень',
  weeks: 'Недели',
  daysPerWeek: 'Дней/нед',
  patternId: 'Сплит',
};

/**
 * Diff двух вариантов. Возвращает ТОЛЬКО изменившиеся строки + ключевые
 * метрики; полная таблица одинаковых строк засоряла бы экран.
 */
export function diffCombatVariants(a: CombatVariant, b: CombatVariant): VariantDiffRow[] {
  const rows: VariantDiffRow[] = [];
  for (const k of Object.keys(INPUT_LABELS) as (keyof CombatVariant['inputs'])[]) {
    const av = String(a.inputs?.[k] ?? '—');
    const bv = String(b.inputs?.[k] ?? '—');
    rows.push({ key: k, label: INPUT_LABELS[k], a: av, b: bv, changed: av !== bv });
  }
  const push = (key: any, label: string, av: any, bv: any) =>
    rows.push({ key, label, a: String(av), b: String(bv), changed: String(av) !== String(bv) });
  push('totalSets', 'Сетов за цикл', a.totalSets, b.totalSets);
  push('tonnage', 'Тоннаж, кг', a.tonnage, b.tonnage);
  push('fight', 'Бой', a.hasFight ? 'да' : 'нет', b.hasFight ? 'да' : 'нет');
  push('weightCut', 'Сгон', a.hasWeightCut ? 'да' : 'нет', b.hasWeightCut ? 'да' : 'нет');
  return rows;
}

export function variantChangedRows(a: CombatVariant, b: CombatVariant): VariantDiffRow[] {
  return diffCombatVariants(a, b).filter(r => r.changed);
}
