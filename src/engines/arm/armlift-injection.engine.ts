/**
 * armlift-injection.engine.ts — инъекция grip-коррекций армлифтинга в недели плана (PRO-5, real).
 * Только армлифтинг-домен: упражнения exercise-catalog-arm по exId, сессии SupportGrip /
 * PinchGrip / CrushGrip / GripHeavy. Точек стола (12 ArmWeakPoint), ARM_CORRECTIONS,
 * injectArmCorrections — не касается: хабы раздельные.
 * Правила: per-day dedup (exId@sessionTag), бюджет недели, кап сессии 8, скип делода,
 * вес из workMax (grip_support/grip_pinch), холды для статики, rationale-строка.
 * Чистые функции (план клонируется).
 */
import { getArmExercises } from '../../core/exercise-catalog-arm';
import type { ArmliftCorrection } from './armlift-correction.engine';

export interface ArmliftInjectionItem {
  exId: string;
  sets: number;
  /** День плана (сессия). Пусто = подбор по substitutionGroup. */
  dayTag?: string;
  intensityPct?: number;
  rir?: number;
}

export interface ArmliftInjectionOpts {
  level?: string;
  workMax?: Record<string, number>;
  budget?: number;
  weekIdxs?: number[];
}

export interface ArmliftInjectionResult {
  plan: any;
  injected: number;
  skippedBudget: number;
  skippedDup: number;
  skippedDeload: number;
  notes: string[];
}

const BUDGET: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };

const DAY_BY_SG: Record<string, string[]> = {
  grip_support: ['SupportGrip', 'GripHeavy', 'Support'],
  grip_pinch: ['PinchGrip', 'GripHeavy', 'Support'],
  grip_crush: ['CrushGrip', 'GripHeavy', 'Support'],
  wrist_ext: ['SupportGrip', 'GripHeavy', 'Support'],
  reverse_curl: ['SupportGrip', 'GripHeavy', 'Support'],
  cup_iso: ['SupportGrip', 'Support'],
};

const MUSCLE_BY_SG: Record<string, string> = {
  grip_support: 'grip_support',
  grip_pinch: 'grip_pinch',
  grip_crush: 'grip_crush',
  wrist_ext: 'wrist_extensors',
  reverse_curl: 'brachioradialis',
  cup_iso: 'wrist_flexors',
};

function catalogById(exId: string): any {
  try { return getArmExercises().find((e: any) => e.id === exId); } catch { return undefined; }
}

function findSession(week: any, item: ArmliftInjectionItem, cat: any): any {
  const sessions: any[] = week?.sessions || [];
  if (!sessions.length) return null;
  if (item.dayTag) {
    const s = sessions.find((x: any) => x.sessionTag === item.dayTag);
    if (s) return s;
  }
  for (const tag of DAY_BY_SG[String(cat?.substitutionGroup || '')] || []) {
    const s = sessions.find((x: any) => x.sessionTag === tag);
    if (s) return s;
  }
  // fallback — первая не-столовая сессия
  return sessions.find((x: any) => !x.tableTime) || sessions[0] || null;
}

function weightFor(cat: any, workMax: Record<string, number>, intensityPct: number): number {
  const sg = String(cat?.substitutionGroup || '');
  const key = sg === 'grip_pinch' ? 'grip_pinch' : sg === 'grip_crush' ? 'grip_crush' : 'grip_support';
  const base = Number(workMax[key]) > 0 ? Number(workMax[key])
    : Number(workMax.grip_support) > 0 ? Number(workMax.grip_support)
      : sg === 'grip_pinch' ? 20 : 60;
  return Math.round(base * intensityPct * 2) / 2;
}

export function injectArmliftCorrections(plan: any, items: ArmliftInjectionItem[], opts: ArmliftInjectionOpts = {}): ArmliftInjectionResult {
  const copy: any = JSON.parse(JSON.stringify(plan || {}));
  const notes: string[] = [];
  let injected = 0, skippedBudget = 0, skippedDup = 0, skippedDeload = 0;
  const list = (Array.isArray(items) ? items : []).filter((t) => t && typeof t.exId === 'string').slice(0, 3);
  if (!list.length || !Array.isArray(copy.weeks)) {
    return { plan: copy, injected, skippedBudget, skippedDup, skippedDeload, notes };
  }
  const level = String(opts.level || copy.level || 'intermediate');
  const budget = opts.budget ?? BUDGET[level] ?? 85;
  const workMax: Record<string, number> = opts.workMax ?? copy.workMax ?? copy.inputSnapshot?.workMax ?? {};
  const allIdx = copy.weeks.map((_: any, i: number) => i);
  const weekIdxs = Array.isArray(opts.weekIdxs) && opts.weekIdxs.length
    ? opts.weekIdxs.filter((i) => i >= 0 && i < allIdx.length)
    : [0];
  for (const wi of weekIdxs) {
    const week = copy.weeks[wi];
    if (!week || (week as any).deload) {
      for (const t of list) notes.push(`⊘ ${t.exId} — нед ${wi + 1} делод, пропуск`);
      skippedDeload += list.length;
      continue;
    }
    const seen = new Set<string>();
    for (const sess of week.sessions) for (const ex of sess.exercises || []) {
      if (ex?.exerciseId) seen.add(`${ex.exerciseId}@${sess.sessionTag}`);
    }
    for (const t of list) {
      const cat = catalogById(t.exId);
      if (!cat) { notes.push(`⚠ ${t.exId} — нет в каталоге`); continue; }
      const target = findSession(week, t, cat);
      if (!target) { notes.push(`⚠ ${t.exId} — нет сессии (нед ${wi + 1})`); continue; }
      const dk = `${t.exId}@${target.sessionTag}`;
      if (seen.has(dk) || (target.exercises || []).some((e: any) => e.exerciseId === t.exId)) {
        skippedDup++; notes.push(`⊘ ${t.exId} уже есть в ${target.sessionTag} (нед ${wi + 1})`); continue;
      }
      const sets = Math.max(1, Math.min(6, Math.round(Number(t.sets) || 3)));
      const weeklySets = week.sessions.reduce((a: number, s: any) =>
        a + (s.exercises || []).reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
      if (weeklySets + sets > budget) {
        skippedBudget++; notes.push(`⊘ ${t.exId} превысит budget ${budget} (нед ${wi + 1}: ${weeklySets}+${sets})`); continue;
      }
      let sess = target;
      if ((sess.exercises || []).length >= 8) {
        sess = (week.sessions || []).find((x: any) => (x.exercises || []).length < 8) || null;
        if (!sess) { skippedBudget++; notes.push(`⊘ ${t.exId} — сессии переполнены (8, нед ${wi + 1})`); continue; }
      }
      const intensityPct = Number.isFinite(Number(t.intensityPct)) ? Number(t.intensityPct) : 0.65;
      const weight = weightFor(cat, workMax, intensityPct);
      const isHold = /hold|pinch|hub|silver/i.test(t.exId) || cat?.movementPattern === 'grip_pinch';
      const rir = Number.isFinite(Number(t.rir)) ? Number(t.rir) : 2;
      const sg = String(cat.substitutionGroup || '');
      const muscle = MUSCLE_BY_SG[sg] || 'grip_support';
      const repsAvg = isHold ? 1 : 5;
      const newEx: any = {
        muscle,
        name: cat.name,
        role: 'accessory',
        character: 'техника',
        sets,
        repsRange: isHold ? [1, 1] : [3, 8],
        rir,
        workSets: Array.from({ length: sets }, () => ({
          reps: repsAvg, rir, weight,
          restSeconds: 120, tempo: '2-1-1-0',
          ...(isHold ? { holdSeconds: 20 } : {}),
        })),
        isTable: false,
        isStatic: isHold,
        ...(isHold ? { holdSeconds: 20 } : {}),
        movementPattern: cat.movementPattern,
        substitutionGroup: cat.substitutionGroup,
        exerciseId: t.exId,
        equipment: cat.equipment,
        comment: `Армлифтинг-коррекция @${Math.round(intensityPct * 100)}%`,
        rationale: `Коррекция слабого звена хвата: ${cat.name} ${sets}×${isHold ? 'холд' : 'повт'} (${(cat as any).technique || ''})`.slice(0, 140),
      };
      sess.exercises.push(newEx);
      seen.add(`${t.exId}@${sess.sessionTag}`);
      injected++;
      notes.push(`✓ ${t.exId} → ${sess.sessionTag} ${sets}×${isHold ? 'холд' : 'повт'} @${weight}кг (нед ${wi + 1})`);
    }
  }
  if (injected > 0) {
    copy.rationale = [...(copy.rationale || []), `Армлифтинг-диагностика: инъецировано ${injected} коррекций хвата`];
  }
  return { plan: copy, injected, skippedBudget, skippedDup, skippedDeload, notes };
}

/** Мост-обёртка: ranked-коррекции → injection items (топ-N). */
export function correctionsToInjectionItems(corrections: ArmliftCorrection[], n = 3): ArmliftInjectionItem[] {
  return (corrections || []).slice(0, n).map((c) => ({
    exId: c.exId, sets: c.sets, dayTag: c.dayTag, intensityPct: 0.65, rir: 2,
  }));
}
