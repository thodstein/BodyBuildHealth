/**
 * M3-остаток (план BB-AUTO-EXHAUSTIVE-PRO §8.3) — общие хелперы аудита выдачи
 * по ВСЕМ BB-циклам через реальный UI-путь «📋 ПРОФ-цикл»:
 *   cycleTemplateToFullProgram → programToBBPlan (adapt + faithful).
 *
 * Матрица разбита по файлам-уровням (beginner/intermediate/advanced/enhanced):
 * vitest исполняет тест-файлы параллельно, каждый файл остаётся в пределах
 * таймаута, а полный охват (38 циклов × 4 уровня × 2 пола × 2 цели) сохраняется.
 *
 * ⚠ Тяжёлый аудит (~190 сборок на уровень) — прогонять отдельно:
 *   npx vitest run src/engines/bb/__tests__/bb-cycle-audit-*.test.ts
 */
import { programToBBPlan, cycleTemplateToFullProgram } from '../../cycle-to-plan';
import { getCyclesByDirection } from '../../../../data/lms-cycles/lms-cycle-index';
import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../../bb-validator.engine';
import { aggregateBBVolume } from '../../bb-volume.engine';

export const CYCLE_AUDIT_WORKMAX = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};
export const CYCLE_AUDIT_MRV_TOLERANCE = 1.15;
export const CYCLE_AUDIT_LEVELS = ['beginner', 'intermediate', 'advanced', 'enhanced'] as const;
export type CycleAuditLevel = typeof CYCLE_AUDIT_LEVELS[number];
export const CYCLE_AUDIT_SEXES = ['male', 'female'] as const;
export const CYCLE_AUDIT_GOALS = ['mass', 'cut'] as const;
export const CYCLE_AUDIT_YEARS: Record<string, number> = { beginner: 0, intermediate: 3, advanced: 6, enhanced: 9 };

export const CYCLE_AUDIT_LEVEL_LABEL: Record<CycleAuditLevel, string> = {
  beginner: 'новичок', intermediate: 'любитель', advanced: 'продвинутый', enhanced: 'усиленный (PED-стаж)',
};

/** Все BB-циклы UI-селектора «ПРОФ-цикл» (без embed-* вливаний). */
export function bbAuditCycles() {
  return getCyclesByDirection('bodybuilding').filter(c => !c.meta.id.startsWith('embed-'));
}

const _progs = new Map<string, ReturnType<typeof cycleTemplateToFullProgram>>();
export function bbAuditProgramOf(id: string) {
  let prog = _progs.get(id);
  if (!prog) {
    const c = bbAuditCycles().find(x => x.meta.id === id);
    if (!c) throw new Error(`cycle not found: ${id}`);
    prog = cycleTemplateToFullProgram(c);
    _progs.set(id, prog);
  }
  return prog;
}

export type CycleAuditPlan = ReturnType<typeof programToBBPlan>;
const _cache = new Map<string, CycleAuditPlan>();

/** Сборка плана UI-путём; кэш по ключу (level×mode×sex×goal). */
export function bbAuditBuild(
  id: string,
  mode: 'adapt' | 'faithful',
  level: string,
  sex: 'male' | 'female',
  goal: 'mass' | 'cut',
  extra: Record<string, unknown> = {},
): CycleAuditPlan {
  const extraKey = Object.keys(extra).length ? `|${JSON.stringify(extra)}` : '';
  const key = `${id}|${mode}|${level}|${sex}|${goal}${extraKey}`;
  let plan = _cache.get(key);
  if (!plan) {
    plan = programToBBPlan(bbAuditProgramOf(id), {
      workMax: CYCLE_AUDIT_WORKMAX, level, trainingYears: CYCLE_AUDIT_YEARS[level], mode, sex, goal, ...extra,
    } as never);
    _cache.set(key, plan);
  }
  return plan;
}

export interface CycleAuditCell { key: string; plan: CycleAuditPlan; level: string }
const _adapt = new Map<string, CycleAuditCell[]>();
const _faithful = new Map<string, CycleAuditCell[]>();

/** Adapt-ячейки уровня: все циклы × 2 пола × 2 цели. */
export function bbAuditAdaptCells(level: CycleAuditLevel): CycleAuditCell[] {
  let cells = _adapt.get(level);
  if (!cells) {
    cells = [];
    for (const c of bbAuditCycles()) {
      for (const sex of CYCLE_AUDIT_SEXES) {
        for (const goal of CYCLE_AUDIT_GOALS) {
          cells.push({ key: `${c.meta.id}/${level}/${sex}/${goal}`, plan: bbAuditBuild(c.meta.id, 'adapt', level, sex, goal), level });
        }
      }
    }
    _adapt.set(level, cells);
  }
  return cells;
}

/** Faithful-ячейки уровня (faithful читает только level — пол/цель дословны). */
export function bbAuditFaithfulCells(level: CycleAuditLevel): CycleAuditCell[] {
  let cells = _faithful.get(level);
  if (!cells) {
    cells = [];
    for (const c of bbAuditCycles()) {
      cells.push({ key: `${c.meta.id}/${level}/faithful`, plan: bbAuditBuild(c.meta.id, 'faithful', level, 'male', 'mass'), level });
    }
    _faithful.set(level, cells);
  }
  return cells;
}

/* ── хелперы-инварианты ──────────────────────────────────────────────────── */

export const cycleAuditPush = (arr: string[], msg: string, cap = 12) => { if (arr.length < cap) arr.push(msg); };
export const cycleAuditAllEx = (p: any) => p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises);
export const cycleAuditWorkSets = (p: any) => cycleAuditAllEx(p).flatMap((e: any) => e.workSets || []);
export const cycleAuditWeekSets = (w: any) => w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
export const cycleAuditMeanWeight = (w: any) => {
  const xs = w.sessions.flatMap((s: any) => s.exercises.flatMap((e: any) => (e.workSets || []).map((x: any) => x.weight || 0))).filter((x: number) => x > 0);
  return xs.length ? xs.reduce((a: number, b: number) => a + b, 0) / xs.length : 0;
};
export const cycleAuditMinRir = (w: any) => {
  const vals = w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.rir)).filter((x: any) => Number.isFinite(x));
  return vals.length ? Math.min(...vals) : 99;
};
export const cycleAuditSig = (p: any): string => JSON.stringify(p.weeks.map((w: any) => w.sessions.map((s: any) => s.exercises.map((e: any) => ({
  n: e.exerciseName || e.name, role: e.role, sets: e.sets, rir: e.rir,
  ws: (e.workSets || []).map((x: any) => [x.reps, x.rir, x.weight, x.technique || '', x.tempo || '']),
})))));
export const cycleAuditComments = (p: any) => cycleAuditAllEx(p).map((e: any) => e.comment || '').join(' | ');

export interface CycleAuditBuckets {
  weeks: string[]; phases: string[]; nan: string[]; setsShape: string[]; reps: string[];
  rir: string[]; weight: string[]; dupes: string[]; empty: string[];
}

export const emptyCycleAuditBuckets = (): CycleAuditBuckets => ({
  weeks: [], phases: [], nan: [], setsShape: [], reps: [], rir: [], weight: [], dupes: [], empty: [],
});

/** Структурный аудит одного плана — нарушения копятся в бакеты (один прогон = все классы). */
export function auditCycleStructure(key: string, plan: any, b: CycleAuditBuckets): number {
  let cells = 0;
  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) { cycleAuditPush(b.weeks, `${key}: нет недель`); return 0; }
  for (const w of plan.weeks) {
    if (!Number.isFinite(w.week)) cycleAuditPush(b.weeks, `${key}: week=${w.week}`);
    if (!String(w.phase || '')) cycleAuditPush(b.phases, `${key} W${w.week}`);
    if (!Array.isArray(w.sessions) || w.sessions.length === 0) { cycleAuditPush(b.empty, `${key} W${w.week}: нет сессий`); continue; }
    for (const s of w.sessions) {
      if (!Array.isArray(s.exercises) || s.exercises.length === 0) { cycleAuditPush(b.empty, `${key} W${w.week} D${s.day}: пустая сессия`); continue; }
      const names = new Set<string>();
      for (const e of s.exercises) {
        const tag = `${key} W${w.week} D${s.day}`;
        const nm = String(e.exerciseName || e.name || '');
        if (!nm) cycleAuditPush(b.nan, `${tag}: пустое имя`);
        if (names.has(nm)) cycleAuditPush(b.dupes, `${tag}: ${nm}`);
        names.add(nm);
        cells++;
        if (!Number.isFinite(e.sets)) cycleAuditPush(b.nan, `${tag} ${nm}: sets=${e.sets}`);
        if (!Number.isFinite(e.rir) || e.rir < 0 || e.rir > 6) cycleAuditPush(b.rir, `${tag} ${nm}: rir=${e.rir}`);
        const wsLen = Array.isArray(e.workSets) ? e.workSets.length : -1;
        if (!Number.isFinite(e.sets) || Math.abs(e.sets - wsLen) > 0.01) cycleAuditPush(b.setsShape, `${tag} ${nm}: sets=${e.sets} ws=${wsLen}`);
        for (const x of e.workSets || []) {
          if (!Number.isFinite(x.reps) || x.reps < 1 || x.reps > 30) cycleAuditPush(b.reps, `${tag} ${nm}: reps=${x.reps}`);
          if (!Number.isFinite(x.rir) || x.rir < 0 || x.rir > 6) cycleAuditPush(b.rir, `${tag} ${nm}: ws.rir=${x.rir}`);
          if (!Number.isFinite(x.weight) || x.weight < 0) cycleAuditPush(b.weight, `${tag} ${nm}: weight=${x.weight}`);
        }
      }
    }
  }
  return cells;
}

export const cycleAuditBucketReport = (b: CycleAuditBuckets) =>
  Object.entries(b).filter(([, arr]) => arr.length > 0).map(([k, arr]) => `${k} ×{${arr.length}}: ${arr.slice(0, 5).join(' ;; ')}`);

/**
 * Полная матрица уровней (38 циклов × 2 пола × 2 цели × 4 уровня ≈ 760 сборок,
 * ~20 мин CPU) — тяжёлый аудит, который прогоняется ОТДЕЛЬНО:
 *   PowerShell:  $env:BB_CYCLE_AUDIT_FULL='1'; npx vitest run src/engines/bb/__tests__/bb-cycle-audit-*.test.ts
 *   bash:        BB_CYCLE_AUDIT_FULL=1 npx vitest run src/engines/bb/__tests__/bb-cycle-audit-*.test.ts
 * В общем круге (`npx vitest run src/engines/bb`) уровни скипаются, чтобы круг
 * оставался ~8–10 мин; лёгкая часть (библиотека/паритет/маркеры) живёт в
 * `bb-cycle-audit-library.test.ts` и идёт всегда.
 */
export const BB_CYCLE_AUDIT_FULL = process.env.BB_CYCLE_AUDIT_FULL === '1';

/**
 * Регистрирует полный аудит одного уровня (структура/MRV/валидатор/делод/faithful).
 * Каждый уровень — отдельный файл, чтобы vitest исполнял их параллельно.
 */
export function registerCycleAuditSuite(level: CycleAuditLevel): void {
  describe.skipIf(!BB_CYCLE_AUDIT_FULL)(`M3-остаток: выдача BB-циклов — ${CYCLE_AUDIT_LEVEL_LABEL[level]} (UI-путь ПРОФ-цикл)`, () => {
    it('adapt: структура (все циклы × 2 пола × 2 цели)', () => {
      const b = emptyCycleAuditBuckets();
      let cells = 0;
      for (const { key, plan } of bbAuditAdaptCells(level)) cells += auditCycleStructure(key, plan, b);
      expect(cells).toBeGreaterThan(2000);
      expect(cycleAuditBucketReport(b)).toEqual([]);
    }, 900000);

    it('adapt: effectiveSets ≤ mrvByMuscle × 1.15', () => {
      const b: string[] = [];
      let checked = 0;
      for (const { key, plan } of bbAuditAdaptCells(level)) {
        const mrvBy = (plan as any).mrvByMuscle as Record<string, number> | undefined;
        // Program-путь adapt обязан нести честный mrvByMuscle (паритет с convert/generic).
        if (!mrvBy || Object.keys(mrvBy).length === 0) { cycleAuditPush(b, `${key}: нет mrvByMuscle на плане`); continue; }
        for (const w of (plan as any).weeks) {
          const vol = aggregateBBVolume(w.sessions);
          for (const [muscle, values] of Object.entries(vol)) {
            const cap = mrvBy[muscle];
            if (!cap) continue;
            checked++;
            if (values.effectiveSets > cap * CYCLE_AUDIT_MRV_TOLERANCE + 0.01) {
              cycleAuditPush(b, `${key} W${w.week} ${muscle}: ${Math.round(values.effectiveSets * 10) / 10} > ${cap}×1.15`);
            }
          }
        }
      }
      expect(checked).toBeGreaterThan(5000);
      expect(b).toEqual([]);
    }, 900000);

    it('adapt: валидатор — 0 error; overflow не в рабочие недели', () => {
      const errors: string[] = [];
      const workingWeekNoise: string[] = [];
      for (const { key, plan } of bbAuditAdaptCells(level)) {
        const r = validateBBPlan(plan as any, { level, trainingYears: CYCLE_AUDIT_YEARS[level] });
        for (const i of r.issues) {
          if (i.level === 'error') cycleAuditPush(errors, `${key}: [${i.code}] ${i.message}`);
          const w = (plan as any).weeks.find((ww: any) => ww.week === i.week);
          const isDeload = w ? (w.phase === 'deload' || w.deload === true) : false;
          if (isDeload) continue;
          if (i.code === 'effective_mrv_overflow') cycleAuditPush(workingWeekNoise, `${key}: [${i.code}] ${i.message}`);
          // `target_volume_deficit` (warning) — осознанное поведение движка:
          // одинаковые дефициты даёт и convert-путь (авторский состав цикла:
          // arms-8 → chest 4<6, hotel-4 → hamstrings 2<4), и generic на enhanced
          // (дамп 29/30 сплитов). Аудит ловит только ERROR-уровень дефицита
          // («effective volume 0») — он в errors выше.
        }
      }
      expect({ errors, workingWeekNoise }).toEqual({ errors: [], workingWeekNoise: [] });
    }, 900000);

    it('adapt: делод/тапер снижают объём', () => {
      const b: string[] = [];
      for (const { key, plan } of bbAuditAdaptCells(level)) {
        const weeks = (plan as any).weeks as any[];
        for (let i = 1; i < weeks.length; i++) {
          const w = weeks[i];
          const isDeload = w.phase === 'deload' || w.deload === true;
          const isTaper = /taper|тапер/i.test(String(w.prepProtocol || w.note || ''));
          if (!isDeload && !isTaper) continue;
          const sets = cycleAuditWeekSets(w);
          const prev = cycleAuditWeekSets(weeks[i - 1]);
          const effortDeload = cycleAuditMeanWeight(w) > 0 && cycleAuditMeanWeight(w) <= cycleAuditMeanWeight(weeks[i - 1]) * 0.8 && cycleAuditMinRir(w) >= 3;
          if (!(sets <= Math.ceil(prev * 0.75) || effortDeload)) {
            cycleAuditPush(b, `${key} W${w.week}${isTaper ? ' (taper)' : ''}: ${sets} vs ${prev}`);
          }
        }
      }
      expect(b).toEqual([]);
    }, 900000);

    it('faithful: структура + 0 error валидатора (все циклы)', () => {
      const b = emptyCycleAuditBuckets();
      const errors: string[] = [];
      let cells = 0;
      for (const { key, plan } of bbAuditFaithfulCells(level)) {
        cells += auditCycleStructure(key, plan, b);
        const r = validateBBPlan(plan as any, { level, trainingYears: CYCLE_AUDIT_YEARS[level] });
        for (const i of r.issues) if (i.level === 'error') cycleAuditPush(errors, `${key}: [${i.code}] ${i.message}`);
      }
      expect(cells).toBeGreaterThan(500);
      expect({ structure: cycleAuditBucketReport(b), errors }).toEqual({ structure: [], errors: [] });
    }, 900000);
  });
}
