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
  /** Асимметрия: пометка «слабой рукой первой» в комментарий упражнения. */
  weakArmNote?: string | null;
  /** D17: порядок/размещение в дне — строкой в rationale плана. */
  orderNote?: string | null;
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
      const rawSets = Math.max(1, Math.min(6, Math.round(Number(t.sets) || 3)));
      // D12 E5: новичку −1 сет (минимум 1) — сухожилия адаптируются 8–12 нед.
      const lvl = String(opts.level || '').toLowerCase();
      const sets = lvl === 'beginner' ? Math.max(1, rawSets - 1) : rawSets;
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
      const weakNote = opts.weakArmNote ? ` · ${opts.weakArmNote}` : '';
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
        comment: `Армлифтинг-коррекция @${Math.round(intensityPct * 100)}%${weakNote}`,
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
  if (opts.orderNote) {
    copy.rationale = [...(copy.rationale || []), `Порядок в дне: ${opts.orderNote}`];
  }
  return { plan: copy, injected, skippedBudget, skippedDup, skippedDeload, notes };
}

/**
 * D16: интенсивность инъекции от причины (тяжесть дозы).
 * Боль/усталость/мобильность — щадяще 0.5; сила — 0.7; остальное — 0.65.
 */
export function intensityForCause(cause: string | null | undefined): number {
  const c = String(cause || '');
  if (c === 'pain' || c === 'fatigue' || c === 'mobility') return 0.5;
  if (c === 'max_strength') return 0.7;
  return 0.65;
}

/** Мост-обёртка: ranked-коррекции → injection items (топ-N). */
export function correctionsToInjectionItems(
  corrections: ArmliftCorrection[],
  n = 3,
  intensityPct = 0.65,
): ArmliftInjectionItem[] {
  const pct = Number.isFinite(Number(intensityPct)) ? Number(intensityPct) : 0.65;
  return (corrections || []).slice(0, n).map((c) => ({
    exId: c.exId, sets: c.sets, dayTag: c.dayTag, intensityPct: pct, rir: 2,
  }));
}

export interface ArmliftSpecWaveWeek {
  week: number;
  targetSets: Record<string, number>;
  dayMap: Record<string, string>;
}

/**
 * Волна спеца по неделям: первые 4 не-делод недели получают свои сеты
 * из targetSets (накопление/объём/интенс/делод). Возвращает merged-результат.
 */
export function applyArmliftSpecWave(
  plan: any,
  spec: ArmliftSpecWaveWeek[],
  baseItems: ArmliftInjectionItem[],
  opts: ArmliftInjectionOpts = {},
): ArmliftInjectionResult {
  const want = Math.min(6, Math.max(1, (spec || []).length || 4));
  const weeks: number[] = [];
  try {
    for (let i = 0; i < (plan?.weeks || []).length && weeks.length < want; i++) {
      if (!(plan.weeks[i] as any)?.deload) weeks.push(i);
    }
  } catch { /* noop */ }
  if (!weeks.length || !baseItems.length) {
    return injectArmliftCorrections(plan, [], opts);
  }
  let acc: ArmliftInjectionResult = {
    plan: JSON.parse(JSON.stringify(plan || {})),
    injected: 0, skippedBudget: 0, skippedDup: 0, skippedDeload: 0, notes: [],
  };
  (spec || []).slice(0, want).forEach((sw, k) => {
    const wi = weeks[k];
    if (wi == null) return;
    const items = baseItems.map((b) => {
      const s = sw?.targetSets?.[b.exId];
      return { ...b, sets: s != null && Number.isFinite(Number(s)) ? Math.max(1, Math.min(6, Math.round(Number(s)))) : b.sets };
    });
    const r = injectArmliftCorrections(acc.plan, items, { ...opts, weekIdxs: [wi] });
    acc = {
      plan: r.plan,
      injected: acc.injected + r.injected,
      skippedBudget: acc.skippedBudget + r.skippedBudget,
      skippedDup: acc.skippedDup + r.skippedDup,
      skippedDeload: acc.skippedDeload + r.skippedDeload,
      notes: [...acc.notes, ...r.notes],
    };
  });
  return acc;
}
