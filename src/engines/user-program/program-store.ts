/**
 * program-store.ts — хранилище и миграторы для UserProgram.
 *
 * localStorage 'he_user_programs' — массив UserProgram (CRUD).
 *  - ПЛ-циклы (LMS) — immutable: cloneFromCycle лишь ссылается на sourceCycleId,
 *    процентки цикла не копируются и не мутируются.
 *  - ББ-программы — полностью редактируемые (cloneFromLibrary / createFromBuild / createBlank).
 *
 * Миграторы:
 *  - cloneFromLibrary(FullProgram)  → editable BB-структура
 *  - cloneFromCycle(cycleId)        → PL-ссылка + пустой оверлей
 *  - createFromBuild(BBPlan, params)→ editable BB-структура из собранного плана
 *  - createBlank(direction)         → пустой стартер
 */
import type { FullProgram, ProgramWeek, ProgramDay } from '../complete-program-library.engine';
import { getCycleById } from '../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import type { BBPlan, BBWeek, BBSession, BBExercise, BBSet } from '../bb/bb-builder.engine';
import {
  type UserProgram, type ProgramMeta, type ProgramDirection, type ProgramSource,
  type BBProgramBody, type PLProgramBody, type UserWeek, type UserSession, type UserBlock,
  type UserSet, type VolumeBudget, type MicrocycleTemplate, type Phase,
  newId,
} from './user-program.types';

const KEY = 'he_user_programs';
const MAX_PROGRAMS = 30;

/* ───────────────────────── CRUD ───────────────────────── */

export function loadUserPrograms(): UserProgram[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as UserProgram[]) : [];
  } catch(_e) { return []; }
}

export function getUserProgram(id: string): UserProgram | null {
  return loadUserPrograms().find(p => p.meta.id === id) ?? null;
}

export function saveUserProgram(program: UserProgram, note?: string): UserProgram[] {
  const all = loadUserPrograms();
  const now = new Date().toISOString();
  const rev = note ? { ts: now, note } : undefined;
  const updated: UserProgram = {
    ...program,
    meta: {
      ...program.meta,
      updatedAt: now,
      revisions: rev ? [...(program.meta.revisions ?? []), rev].slice(-20) : program.meta.revisions,
    },
  };
  const idx = all.findIndex(p => p.meta.id === updated.meta.id);
  if (idx >= 0) all[idx] = updated; else all.unshift(updated);
  const capped = all.slice(0, MAX_PROGRAMS);
  try { localStorage.setItem(KEY, JSON.stringify(capped)); } catch(_e) { /* ignore */ }
  return capped;
}

export function deleteUserProgram(id: string): UserProgram[] {
  const all = loadUserPrograms().filter(p => p.meta.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch(_e) { /* ignore */ }
  return all;
}

/** Удалить одну запись из meta.revisions (по индексу). Пересохраняет программу без неё. */
export function deleteRevision(id: string, revIdx: number): UserProgram | null {
  const all = loadUserPrograms();
  const idx = all.findIndex(p => p.meta.id === id);
  if (idx < 0) return null;
  const prog = all[idx];
  const revs = (prog.meta.revisions ?? []).slice();
  if (revIdx < 0 || revIdx >= revs.length) return prog;
  revs.splice(revIdx, 1);
  const updated: UserProgram = { ...prog, meta: { ...prog.meta, revisions: revs } };
  all[idx] = updated;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch(_e) { /* ignore */ }
  return updated;
}

/* ───────────────────────── Миграторы ───────────────────────── */

function baseMeta(partial: Partial<ProgramMeta> & { direction: ProgramDirection; source: ProgramSource; title: string; weeks: number; daysPerWeek: number }): ProgramMeta {
  const now = new Date().toISOString();
  return {
    id: newId('prog'),
    author: partial.author ?? 'Моя программа',
    goal: partial.goal ?? 'hypertrophy',
    level: partial.level ?? 'intermediate',
    createdAt: now,
    updatedAt: now,
    tags: partial.tags ?? [],
    ...partial,
  } as ProgramMeta;
}

/** Клонировать программу из библиотеки (FullProgram) → редактируемая ББ-структура. */
export function cloneFromLibrary(program: FullProgram): UserProgram {
  const weeks = (program.weeks ?? []).map((w, wi) => weekFromLibrary(w, wi));
  const microcycle = microcycleFromLibrary(program);
  const body: BBProgramBody = {
    direction: 'bb',
    microcycleTemplate: microcycle,
    weeks,
    volumeBudget: {},
    progression: {
      loadStrategy: 'double_progression',
      deloadProtocol: 'pump',
      intensityTechniques: ['none'],
    },
    constraints: { equipment: program.equipmentNeeded ?? [] },
  };
  const meta = baseMeta({
    title: program.name + ' (копия)',
    author: program.author,
    goal: program.goal,
    level: program.level,
    daysPerWeek: program.daysPerWeek,
    weeks: program.durationWeeks,
    direction: 'bb',
    source: 'cloned_library',
    parentId: program.id,
    tags: [program.type],
  });
  return { meta, bb: body };
}

function weekFromLibrary(w: ProgramWeek, wi: number): UserWeek {
  const phase = (w.phase as Phase) ?? 'accumulation';
  return {
    week: w.week ?? wi + 1,
    phase,
    deload: !!w.deload,
    sessions: (w.days ?? []).map((d, di) => sessionFromLibrary(d, di)),
  };
}

function sessionFromLibrary(d: ProgramDay, di: number): UserSession {
  return {
    id: newId('ses'),
    name: d.name ?? `День ${d.day ?? di + 1}`,
    focus: d.focus ?? '',
    blocks: (d.exercises ?? []).map((e, ei) => blockFromLibrary(e, ei)),
    warmup: d.warmup,
    cooldown: d.cooldown,
  };
}

function blockFromLibrary(e: { name: string; sets: number; reps: string; rpe: number; rir: number; restSec: number; notes: string; progression: string }, ei: number): UserBlock {
  const repsNum = parseInt(String(e.reps), 10);
  const reps: number | string = isNaN(repsNum) ? e.reps : repsNum;
  const sets: UserSet[] = Array.from({ length: e.sets ?? 0 }, () => ({
    reps, rir: e.rir ?? 2, restSec: e.restSec, note: e.notes,
  }));
  return {
    id: newId('blk'),
    type: ei === 0 ? 'compound' : 'accessory',
    exerciseName: e.name,
    muscle: '',
    role: ei === 0 ? 'primary' : 'accessory',
    sets,
    note: e.progression,
  };
}

function microcycleFromLibrary(program: FullProgram): MicrocycleTemplate {
  const firstWeek = program.weeks?.[0];
  const days = firstWeek?.days ?? [];
  return {
    daySlots: days.map((d, i) => ({
      day: i + 1,
      label: d.name ?? `День ${i + 1}`,
      muscles: (d.focus ?? '').split(/[,/+&]/).map(s => s.trim()).filter(Boolean).map(m => ({ muscle: m, role: 'primary' as const })),
    })),
  };
}

/** Клонировать ПЛ-цикл (LMS) → ссылка + пустой оверлей. Цикл immutable. */
export function cloneFromCycle(cycleId: string): UserProgram | null {
  const cycle = getCycleById(cycleId);
  if (!cycle) return null;
  const meta = baseMeta({
    title: cycle.meta.title + ' (моя копия)',
    author: 'LMS/PROF',
    goal: cycle.meta.period === 'strength' ? 'powerlifting' : 'hypertrophy',
    level: cycle.meta.level === 'novice' ? 'beginner' : cycle.meta.level === 'KMS-MS' || cycle.meta.level === 'MS-MSMK' ? 'advanced' : 'intermediate',
    daysPerWeek: cycle.meta.sessionsPerWeek,
    weeks: cycle.meta.weeks,
    direction: 'pl',
    source: 'cloned_cycle',
    parentId: cycle.meta.id,
    tags: [cycle.meta.direction, cycle.meta.period],
  });
  const body: PLProgramBody = {
    direction: 'pl',
    sourceCycleId: cycle.meta.id,
    schedule: Array.from({ length: cycle.meta.sessionsPerWeek }, (_, i) => ({ sessionIdx: i, dayOfWeek: i })),
    weakPoints: [],
    notes: '',
    workMax: {},
  };
  return { meta, pl: body };
}

/** Создать UserProgram из собранного ББ-плана (BBPlan). */
export function createFromBuild(plan: BBPlan, params: { title?: string; goal?: string; level?: string; weakPoints?: string[]; equipment?: string[] }): UserProgram {
  const weeks = (plan.weeks ?? []).map((w) => weekFromBuild(w));
  const microcycle: MicrocycleTemplate = {
    daySlots: (plan.pattern?.schedule ?? []).filter(d => d.kind === 'тренировка').map((d, i) => ({
      day: i + 1,
      label: d.sessionTag ?? ('День ' + (i + 1)),
      muscles: [],
    })),
  };
  const body: BBProgramBody = {
    direction: 'bb',
    microcycleTemplate: microcycle,
    weeks,
    volumeBudget: {},
    progression: {
      loadStrategy: 'double_progression',
      deloadProtocol: 'pump',
      intensityTechniques: ['none'],
    },
    constraints: { equipment: params.equipment ?? [] },
  };
  const meta = baseMeta({
    title: params.title ?? (plan.pattern?.name ?? 'ББ-программа') + ' (из сборки)',
    goal: params.goal ?? 'hypertrophy',
    level: params.level ?? 'intermediate',
    daysPerWeek: weeks[0]?.sessions.length ?? 4,
    weeks: weeks.length,
    direction: 'bb',
    source: 'from_build',
    tags: ['from_build'],
  });
  return { meta, bb: body };
}

function weekFromBuild(w: BBWeek): UserWeek {
  return {
    week: w.week,
    phase: 'accumulation',
    deload: false,
    sessions: (w.sessions ?? []).map((s, si) => sessionFromBuild(s, si)),
  };
}

function sessionFromBuild(s: BBSession, si: number): UserSession {
  return {
    id: newId('ses'),
    name: `День ${s.day ?? si + 1}`,
    focus: s.sessionTag ?? '',
    blocks: (s.exercises ?? []).map((e, ei) => blockFromBuild(e, ei)),
  };
}

function blockFromBuild(e: BBExercise, ei: number): UserBlock {
  const sets: UserSet[] = (e.workSets ?? []).map((ws) => ({
    reps: ws.reps, rir: ws.rir, weight: ws.weight,
    technique: ws.technique as UserSet['technique'], tempo: ws.tempo, restSec: ws.restSeconds,
  }));
  return {
    id: newId('blk'),
    type: e.role === 'primary' ? 'compound' : 'accessory',
    exerciseName: e.name ?? e.exerciseName ?? '',
    muscle: e.muscle ?? '',
    role: e.role === 'primary' ? 'primary' : 'accessory',
    sets,
    rationale: e.rationale,
  };
}

/** Пустой стартер для создания с нуля. */
export function createBlank(direction: ProgramDirection): UserProgram {
  const now = new Date().toISOString();
  if (direction === 'pl') {
    return {
      meta: baseMeta({
        title: 'Новая ПЛ-программа', goal: 'powerlifting', level: 'intermediate',
        daysPerWeek: 3, weeks: 12, direction: 'pl', source: 'custom', tags: ['custom'],
      }),
      pl: { direction: 'pl', sourceCycleId: '', schedule: [], weakPoints: [], notes: '', workMax: {} },
    };
  }
  if (direction === 'hybrid') {
    return {
      meta: baseMeta({
        title: 'Новый powerbuilder-план', goal: 'powerbuilding', level: 'intermediate',
        daysPerWeek: 4, weeks: 8, direction: 'hybrid', source: 'custom', tags: ['custom', 'powerbuilder'],
      }),
      hybrid: { direction: 'hybrid', plRef: { sourceCycleId: '', sessionIndices: [] }, bbWeeks: [], notes: '' },
    };
  }
  return {
    meta: baseMeta({
      title: 'Новая ББ-программа', goal: 'hypertrophy', level: 'intermediate',
      daysPerWeek: 4, weeks: 6, direction: 'bb', source: 'custom', tags: ['custom'],
    }),
    bb: {
      direction: 'bb',
      microcycleTemplate: { daySlots: [{ day: 1, label: 'День 1', muscles: [] }] },
      weeks: [],
      volumeBudget: {},
      progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] },
      constraints: { equipment: [] },
    },
  };
}

/** Получить иммутабельный LMS-цикл, на который ссылается ПЛ-программа (для рендера). */
export function getReferencedCycle(program: UserProgram): SRCycleTemplate | undefined {
  if (program.pl?.sourceCycleId) return getCycleById(program.pl.sourceCycleId);
  return undefined;
}

/* ───────────────────────── Конвертер в BBPlan (для VolumeBudgetCard) ───────────────────────── */

/** Свести любой ключ мышцы к каноническому (delt_*→shoulders, fore/back→...); fallback — 'other'. */
function collapseMuscleKey(muscle: string): string {
  if (!muscle) return 'other';
  const m = muscle.toLowerCase();
  if (m.startsWith('delt_') || m === 'shoulders') return 'shoulders';
  if (m === 'forearms') return 'arms';
  if (m === 'core' || m === 'abs') return 'core';
  return m;
}

/** Характер упражнения по RIR-схеме (RIR<2 — тяж, ≤2 — лёг, иначе памп). */
function characterFromRir(rir: number, isCompound: boolean): 'тяж' | 'памп' | 'лёг' {
  if (isCompound) return rir <= 1 ? 'тяж' : 'лёг';
  if (rir <= 1) return 'тяж';
  if (rir <= 3) return 'памп';
  return 'лёг';
}

/** Конвертировать одну неделю UserProgram → минимальный BBPlan, пригодный для calcBBPlanMetrics. */
export function userWeekToBBPlan(week: UserWeek, level: string): BBPlan {
  const bbPlan: BBPlan = {
    pattern: {} as BBPlan['pattern'],
    weeks: [],
    rotationMuscleVolume: {},
    rationale: ['user-program editor'],
  };
  // level не входит в BBPlan, но calcBBPlanMetrics читает (plan as any).level
  (bbPlan as any).level = level;
  const bbWeek: BBWeek = {
    week: week.week,
    sessions: (week.sessions ?? []).map((s, si) => {
      const exercises: BBExercise[] = (s.blocks ?? []).map((b) => {
        const isCompound = b.type === 'compound' || b.type === 'power_main';
        const rir0 = b.sets?.[0]?.rir ?? 2;
        const reps0Raw = b.sets?.[0]?.reps;
        const reps0 = typeof reps0Raw === 'number' ? reps0Raw : 10;
        const workSets: BBSet[] = (b.sets ?? []).map((us) => ({
          reps: typeof us.reps === 'number' ? us.reps : 10,
          rir: us.rir ?? 2,
          weight: us.weight ?? 0,
          restSeconds: us.restSec,
          tempo: us.tempo,
          technique: us.technique && us.technique !== 'none' ? us.technique : undefined,
        }));
        return {
          muscle: collapseMuscleKey(b.muscle || 'other'),
          name: b.exerciseName || '—',
          exerciseName: b.exerciseName,
          role: b.role === 'primary' ? 'primary' : 'accessory',
          character: characterFromRir(rir0, isCompound),
          sets: b.sets?.length ?? 0,
          repsRange: [reps0, reps0] as [number, number],
          rir: rir0,
          workSets,
          restSeconds: b.sets?.[0]?.restSec,
          rationale: b.rationale,
        } as BBExercise;
      });
      return {
        day: si + 1,
        weekOffset: si,
        character: exercises.some((e) => e.character === 'тяж') ? 'тяж' : (exercises[0]?.character ?? 'лёг'),
        sessionTag: s.focus || s.name,
        exercises,
      } as BBSession;
    }),
  };
  const pattern: BBPlan['pattern'] = {
    id: 'user-program',
    name: 'User Program',
    rotationDays: 7,
    sessionsPerRotation: bbWeek.sessions.length,
    schedule: [],
    level: [level],
    description: 'User-edited program (для VolumeBudgetCard)',
  };
  bbPlan.pattern = pattern;
  bbPlan.weeks = [bbWeek];
  return bbPlan;
}