/**
 * annual-training-storage.ts — хранение годового плана (localStorage) + миграция
 * из существующих макро-хранилищ (he_pl_macro / he_bb_macro).
 *
 * Единый ключ: he_annual_training_plan_v1. План хранит состояния блоков
 * (конфиг конструктора + результат сборки). Макро-разметка остаётся в старых
 * ключах — план ссылается на неё через macroRef (сериализованный снимок).
 */
import type { AnnualTrainingPlan, AnnualBlockState, AnnualBlockKind } from './annual-training.types';
import { annualPlanFromMacro, stableHash } from './block-builders.engine';
import { deserializeMacro, deserializeBbMacro } from '../lms/macrocycle.engine';

export const ANNUAL_PLAN_KEY = 'he_annual_training_plan_v1';
export const ANNUAL_PLAN_VERSION = 1;

/** Валидация формы загруженного плана (защита от битых данных). */
export function isAnnualTrainingPlanShape(value: unknown): value is AnnualTrainingPlan {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.totalWeeks !== 'number') return false;
  if (!Array.isArray(o.blocks)) return false;
  return o.blocks.every(b => {
    if (!b || typeof b !== 'object') return false;
    const r = (b as any).ref;
    if (!r || typeof r.blockKey !== 'string' || typeof r.startWeek !== 'number' || typeof r.weeks !== 'number') return false;
    return ['unbuilt', 'built', 'stale', 'error'].includes((b as any).status);
  });
}

/** Сохранить годовой план. Возвращает сохранённый объект. */
export function saveAnnualTrainingPlan(plan: AnnualTrainingPlan): AnnualTrainingPlan {
  const stored = { ...plan, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(ANNUAL_PLAN_KEY, JSON.stringify(stored));
  } catch {
    /* quota — план остаётся в памяти */
  }
  window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', {
    detail: { planId: stored.id, status: stored.status, totalWeeks: stored.totalWeeks },
  }));
  return stored;
}

/** Загрузить годовой план (null — нет/повреждён). */
export function loadAnnualTrainingPlan(): AnnualTrainingPlan | null {
  try {
    const raw = localStorage.getItem(ANNUAL_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isAnnualTrainingPlanShape(parsed)) return null;
    return parsed as AnnualTrainingPlan;
  } catch {
    return null;
  }
}

/** Удалить годовой план. */
export function removeAnnualTrainingPlan(): void {
  try { localStorage.removeItem(ANNUAL_PLAN_KEY); } catch { /* ignore */ }
}

/**
 * Миграция: если годовой план отсутствует, а макро-хранилище есть —
 * создать план со всеми блоками 'unbuilt' (тип конструктора из kind блоков).
 * Приоритет: he_bb_macro для ББ-направления, иначе he_pl_macro.
 */
export function migrateAnnualPlanFromMacroStorage(
  plKey: string = 'he_pl_macro',
  bbKey: string = 'he_bb_macro',
): AnnualTrainingPlan | null {
  const existing = loadAnnualTrainingPlan();
  if (existing) return existing;
  try {
    const rawBB = localStorage.getItem(bbKey);
    if (rawBB) {
      const bbMacro = deserializeBbMacro(rawBB);
      if (bbMacro) return saveAnnualTrainingPlan(annualPlanFromMacro(bbMacro));
    }
    const rawPL = localStorage.getItem(plKey);
    if (rawPL) {
      const macro = deserializeMacro(rawPL);
      if (macro) return saveAnnualTrainingPlan(annualPlanFromMacro(macro));
    }
  } catch { /* ignore — нет валидного макро */ }
  return null;
}

/* ─────────── Кардио-циклы года (blockKey → cycleId библиотеки кардио) ─────────── */

export const ANNUAL_CARDIO_CYCLES_KEY = 'he_annual_cardio_cycles';

/** Валидация маппинга кардио-циклов года (защита от битых данных). */
export function isAnnualCardioMapShape(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([k, v]) => typeof k === 'string' && k.length > 0 && typeof v === 'string' && v.length > 0);
}

/** Сохранить маппинг blockKey → cycleId собранных кардио-циклов года. */
export function saveAnnualCardioCycles(map: Record<string, string>): Record<string, string> {
  try { localStorage.setItem(ANNUAL_CARDIO_CYCLES_KEY, JSON.stringify(map)); } catch { /* quota */ }
  return map;
}

/** Загрузить маппинг кардио-циклов года (пусто — нет/повреждён). */
export function loadAnnualCardioCycles(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ANNUAL_CARDIO_CYCLES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isAnnualCardioMapShape(parsed)) return {};
    return parsed;
  } catch { return {}; }
}

/** Удалить маппинг кардио-циклов года (циклы остаются в библиотеке). */
export function removeAnnualCardioCycles(): void {
  try { localStorage.removeItem(ANNUAL_CARDIO_CYCLES_KEY); } catch { /* ignore */ }
}

/* ─────────── Снапшоты сборки года (сценарии: сохранить/сравнить/восстановить) ── */

export const ANNUAL_SCENARIOS_KEY = 'he_annual_scenarios';
export const ANNUAL_SCENARIOS_CAP = 6;

/** Снапшот годового плана (полная копия: конфиги + результаты сборки). */
export interface AnnualScenario {
  id: string;
  label: string;
  ts: number;
  plan: AnnualTrainingPlan;
}

function scenarioStorage(): AnnualScenario[] {
  try {
    const v = JSON.parse(localStorage.getItem(ANNUAL_SCENARIOS_KEY) || '[]');
    return Array.isArray(v) ? v.filter((s: unknown) => s && (s as AnnualScenario).plan?.blocks?.length) : [];
  } catch { return []; }
}

/** Сохранить снимок сборки (кап 6, новые первыми). */
export function saveAnnualScenario(plan: AnnualTrainingPlan, label: string): AnnualScenario[] {
  const list: AnnualScenario[] = [{
    id: 'asc_' + Date.now().toString(36),
    label: label || `Снапшот ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
    ts: Date.now(),
    plan: JSON.parse(JSON.stringify(plan)) as AnnualTrainingPlan,
  }, ...scenarioStorage()].slice(0, ANNUAL_SCENARIOS_CAP);
  try { localStorage.setItem(ANNUAL_SCENARIOS_KEY, JSON.stringify(list)); } catch { /* quota */ }
  return list;
}

export function loadAnnualScenarios(): AnnualScenario[] {
  return scenarioStorage();
}

export function removeAnnualScenario(id: string): AnnualScenario[] {
  const next = scenarioStorage().filter(s => s.id !== id);
  try { localStorage.setItem(ANNUAL_SCENARIOS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

/** Восстановить снимок: вернуть глубокую копию плана (панель решает, сохранять ли). */
export function restoreAnnualScenario(id: string): AnnualTrainingPlan | null {
  const sc = scenarioStorage().find(s => s.id === id);
  if (!sc) return null;
  return JSON.parse(JSON.stringify(sc.plan)) as AnnualTrainingPlan;
}

/** Дифф блока между двумя снапшотами (по blockKey — тот же layout). */
export interface AnnualScenarioDiff {
  blockKey: string;
  startWeek: number;
  phase: string;
  kindA?: AnnualBlockKind;
  kindB?: AnnualBlockKind;
  statusA?: string;
  statusB?: string;
  configChanged: boolean;
  resultChanged: boolean;
}

function diffBlock(a: AnnualBlockState | undefined, b: AnnualBlockState | undefined): AnnualScenarioDiff | null {
  const base: AnnualScenarioDiff = {
    blockKey: (a ?? b)!.ref.blockKey,
    startWeek: (a ?? b)!.ref.startWeek,
    phase: (a ?? b)!.ref.phase,
    configChanged: false,
    resultChanged: false,
  };
  if (a && b) {
    base.kindA = a.ref.kind; base.kindB = b.ref.kind;
    base.statusA = a.status; base.statusB = b.status;
    base.configChanged = stableHash(a.config) !== stableHash(b.config);
    base.resultChanged = (a.result?.configHash ?? '') !== (b.result?.configHash ?? '')
      || (a.status === 'built') !== (b.status === 'built');
    if (!base.configChanged && !base.resultChanged && a.ref.kind === b.ref.kind && a.status === b.status) return null;
  } else {
    base.configChanged = true;
    base.resultChanged = true;
  }
  return base;
}

/** Сравнить два снапшота: дифф по блокам + сводная строка. */
export function compareAnnualScenarios(a: AnnualScenario, b: AnnualScenario): {
  diffs: AnnualScenarioDiff[];
  summary: string;
} {
  const mapA = new Map(a.plan.blocks.map(x => [x.ref.blockKey, x]));
  const mapB = new Map(b.plan.blocks.map(x => [x.ref.blockKey, x]));
  const keys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  const diffs = keys
    .map(k => diffBlock(mapA.get(k), mapB.get(k)))
    .filter((d): d is AnnualScenarioDiff => d !== null)
    .sort((x, y) => x.startWeek - y.startWeek);
  const kindChanges = diffs.filter(d => d.kindA && d.kindB && d.kindA !== d.kindB).length;
  const statusChanges = diffs.filter(d => d.statusA && d.statusB && d.statusA !== d.statusB).length;
  const configChanges = diffs.filter(d => d.configChanged).length;
  const summary = diffs.length === 0
    ? 'Снапшоты идентичны'
    : `изменено блоков: ${diffs.length} (конфиг ${configChanges} · статус ${statusChanges} · конструктор ${kindChanges})`;
  return { diffs, summary };
}
