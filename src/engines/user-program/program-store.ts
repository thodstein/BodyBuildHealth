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
  } catch { return []; }
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
  try { localStorage.setItem(KEY, JSON.stringify(capped)); } catch { /* ignore */ }
  return capped;
}

export function deleteUserProgram(id: string): UserProgram[] {
  const all = loadUserPrograms().filter(p => p.meta.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return all;
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