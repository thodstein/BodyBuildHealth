import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import type { FullProgram } from '../../complete-program-library.engine';

/* ═══════════════════════════════════════════════════════════════════
 * Строгий A/B (флаг вкл = выбор пользователя за ротацию):
 *  - sibling-сессии несут stash'нутый avoid (abAvoidPatterns);
 *  - ensureWeakPatternCoverage и фидеры его уважают (ротация побеждает
 *    в sibling-сессии, первая сессия тега гарантию держит);
 *  - без флага — legacy 1-в-1 (weak-need побеждает везде).
 * Без флага все планы байт-в-байт прежние (флаг opt-in, дефолт выкл).
 * ═══════════════════════════════════════════════════════════════════ */

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];
// Локальная копия WEAK_PATTERN_REQ.chest_upper (константа не экспортирована).
const INCLINE_RE = /жим.*(наклонн|incline)|(наклонн|incline).*жим/i;

function base(over: any = {}): any {
  return { patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, equipment: EQ, volumeGoal: 'mav', ...over };
}

// upper_lower_4: Upper×2 (тяж + памп) — sibling-сессии без PPL-мандатов
// (ensurePPLChest раздувал бы sibling обратно; PPL-инвариант exempt).
function ulBase(over: any = {}): any {
  return { patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, equipment: EQ, volumeGoal: 'mav', ...over };
}

function pushes(plan: any): any[] {
  return plan.weeks[0].sessions.filter((s: any) => s.sessionTag === 'Push');
}

function uppers(plan: any): any[] {
  return plan.weeks[0].sessions.filter((s: any) => s.sessionTag === 'Upper');
}

function chestNames(s: any): string[] {
  return (s.exercises as any[]).filter(e => !e.warmupActivator && e.muscle === 'chest').map(e => e.name);
}

describe('Строгий A/B: avoid stashится и уважается', () => {
  it('sibling-сессии несут abAvoidPatterns, первая — нет; без флага stash нигде', () => {
    const on = buildBBPlan(base({ abPatternRotation: true }));
    const [p0, p1] = pushes(on);
    expect(p0 && p1, 'ppl_6 даёт 2 Push').toBeTruthy();
    expect((p0 as any).abAvoidPatterns ?? []).toHaveLength(0);
    expect(((p1 as any).abAvoidPatterns || []).length).toBeGreaterThanOrEqual(1);
    const off = buildBBPlan(base({}));
    for (const s of off.weeks[0].sessions) {
      expect((s as any).abAvoidPatterns ?? []).toHaveLength(0);
    }
  });

  it('флаг вкл + weak chest_upper: неделя держит наклонный жим, sibling-сессии различаются', () => {
    const on = buildBBPlan(ulBase({ abPatternRotation: true, weakPoints: ['chest_upper'] }));
    const [u0, u1] = uppers(on);
    expect(u0 && u1, 'upper_lower_4 даёт 2 Upper').toBeTruthy();
    // Недельное покрытие слабой подгруппы цело (первая сессия гарантию держит).
    const weekIncline = uppers(on).some(s => chestNames(s).some(n => INCLINE_RE.test(n)));
    expect(weekIncline, 'наклонный жим есть в неделе').toBe(true);
    // Ротация не сломана weak-гарантией: составы различаются.
    const n0 = new Set((u0.exercises as any[]).map(e => e.name));
    const n1 = new Set((u1.exercises as any[]).map(e => e.name));
    const diff = [...n0].filter(n => !n1.has(n)).length + [...n1].filter(n => !n0.has(n)).length;
    expect(diff).toBeGreaterThanOrEqual(1);
    // План валиден: без overflow (ротация не ломает модель).
    const v = validateBBPlan(on, { level: 'intermediate' });
    expect(v.issues.filter(i => i.code === 'effective_mrv_overflow')).toHaveLength(0);
  });

  it('флаг вкл + weak chest_upper: sibling не форсирует weak-required паттерн (лид exempt)', () => {
    const on = buildBBPlan(ulBase({ abPatternRotation: true, weakPoints: ['chest_upper'] }));
    const [u0, u1] = uppers(on);
    const avoid: string[] = (u1 as any).abAvoidPatterns || [];
    expect(avoid.length).toBeGreaterThanOrEqual(1);
    // Лид-компаунд exempt (стабильность прогрессии), но weak-required
    // наклонный жим weak-гарантией/фидерами/строгими группами в sibling
    // не форсируется: первая сессия покрытие держит (см. тест выше).
    const sibNonLead = chestNames(u1).slice(1);
    // Re-baseline Ф1.1 (CYCLE-SYSTEM-FULL-AUDIT): пул груди исправлен —
    // «Жим ногами (45°)» больше не мирился в horizontal_push/chest
    // (movement-pattern: leg press → squat/quads); освободившийся слот
    // заполняет обязательная strict-группа chest_incline — наклонный в
    // sibling легитимен (coverage группы, не форс weak-паттерна лида).
    // Инвариант A/B: в sibling остаётся НЕ-наклонная грудь (avoid паттерна
    // лида не затёр весь слот — разнообразие углов сохранено).
    expect(sibNonLead.some(n => !INCLINE_RE.test(n)), 'sibling держит не-наклонную грудь (avoid лида уважен)').toBe(true);
  });

  it('флаг выкл (legacy): weak chest_upper enforced в ОБЕИХ Upper-сессиях', () => {
    const off = buildBBPlan(ulBase({ weakPoints: ['chest_upper'] }));
    const us = uppers(off);
    expect(us.length).toBeGreaterThanOrEqual(2);
    for (const s of us) {
      expect(chestNames(s).some(n => INCLINE_RE.test(n)), 'legacy: наклонный в каждой Upper').toBe(true);
    }
  });

  it('флаг вкл без weak: объёмы груди недели на месте, все группы присутствуют', () => {
    const on = buildBBPlan(base({ abPatternRotation: true }));
    const muscles = new Set<string>();
    let chestSets = 0;
    for (const w of on.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator) continue;
      muscles.add((e as any).muscle);
      if ((e as any).muscle === 'chest') chestSets += (e as any).workSets?.length || (e as any).sets || 0;
    }
    for (const m of ['chest', 'back', 'quads', 'hamstrings', 'biceps', 'triceps']) {
      expect(muscles.has(m), `мышца ${m} в плане`).toBe(true);
    }
    expect(chestSets).toBeGreaterThan(0);
    const v = validateBBPlan(on, { level: 'intermediate' });
    expect(v.issues.filter(i => i.code === 'effective_mrv_overflow')).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * A/B в cycle/program adapt-путях (выбора упражнений там нет — состав
 * задаёт источник): флаг stash'ит avoid на sibling-сессии, финализатор
 * его уважает. Faithful дословно — флаг игнится (паритет без флага).
 * ═══════════════════════════════════════════════════════════════════ */

const AB_CYCLE: SRCycleTemplate = {
  meta: {
    id: 'test-ab-cycle', title: 'AB cycle', direction: 'bodybuilding', level: 'intermediate', period: 'mass',
    sessionsPerWeek: 3, weeks: 1, correctionPct: 0,
  },
  week1: [
    { exercises: [
      { name: 'Жим штанги лёжа', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] },
      { name: 'Французский жим лёжа', group: 'Трицепс', coef: 1, mnosz: 1, load: 'Лёгкая', sets: [{ pct: 0.5, reps: 12, sets: 2, rir: 3 }] },
    ] },
    { exercises: [
      { name: 'Жим гантелей лёжа', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] },
      { name: 'Разгибание рук на блоке', group: 'Трицепс', coef: 1, mnosz: 1, load: 'Лёгкая', sets: [{ pct: 0.5, reps: 12, sets: 2, rir: 3 }] },
    ] },
    { exercises: [
      { name: 'Присед со штангой', group: 'Ноги', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] },
    ] },
  ],
};

function abProgram(): FullProgram {
  const day = (d: number, exs: Array<[string, number, string]>) => ({
    day: d, name: `День ${d}`, focus: d === 3 ? 'legs' : 'chest', warmup: '',
    exercises: exs.map(([name, sets, reps]) => ({ name, sets, reps, rir: 2 })),
  });
  return {
    id: 'test-ab-program', name: 'AB program', author: 'test', type: 'bodybuilding', goal: 'bodybuilding',
    direction: 'bodybuilding', level: 'intermediate', durationWeeks: 1, daysPerWeek: 3, sessionTimeMin: '60',
    description: '', targetAudience: '', equipmentNeeded: [],
    weeks: [{ week: 1, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false, days: [
      day(1, [['Жим штанги лёжа', 3, '8'], ['Французский жим лёжа', 2, '12']]),
      day(2, [['Жим гантелей лёжа', 3, '8'], ['Разгибание рук на блоке', 2, '12']]),
      day(3, [['Присед со штангой', 3, '8']]),
    ] }],
    progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
  };
}

/** Группировка сессий недели по тегу; возвращает первый тег с 2+ сессиями. */
function siblingPair(plan: any): [any, any] {
  const byTag = new Map<string, any[]>();
  for (const s of plan.weeks[0].sessions) {
    const t = (s as any).sessionTag || '';
    byTag.set(t, [...(byTag.get(t) || []), s]);
  }
  for (const [, arr] of byTag) {
    if (arr.length >= 2) return [arr[0], arr[1]];
  }
  throw new Error('нет sibling-сессий одного тега: ' + [...byTag.keys()].join(','));
}

describe('A/B в cycle/program adapt-путях', () => {
  it('adapt cycle + флаг: sibling несёт stash, план валиден', () => {
    const plan = convertCycleToBBPlan({ cycle: AB_CYCLE, workMax: WM, level: 'intermediate', mode: 'adapt', abPatternRotation: true } as any);
    const [first, second] = siblingPair(plan);
    expect(((first as any).abAvoidPatterns || []).length).toBe(0);
    expect(((second as any).abAvoidPatterns || []).length).toBeGreaterThanOrEqual(1);
    const v = validateBBPlan(plan, { level: 'intermediate' });
    expect(v.issues.filter(i => i.level === 'error')).toHaveLength(0);
  });

  it('faithful cycle + флаг: stash нигде (флаг игнится, дословно)', () => {
    const plan = convertCycleToBBPlan({ cycle: AB_CYCLE, workMax: WM, level: 'intermediate', mode: 'faithful', abPatternRotation: true } as any);
    for (const s of plan.weeks[0].sessions) {
      expect(((s as any).abAvoidPatterns || []).length).toBe(0);
    }
  });

  it('adapt program + флаг: sibling несёт stash, план валиден', () => {
    const plan = programToBBPlan(abProgram(), { workMax: WM, level: 'intermediate', mode: 'adapt', abPatternRotation: true } as any);
    const [first, second] = siblingPair(plan);
    expect(((first as any).abAvoidPatterns || []).length).toBe(0);
    expect(((second as any).abAvoidPatterns || []).length).toBeGreaterThanOrEqual(1);
    const v = validateBBPlan(plan, { level: 'intermediate' });
    expect(v.issues.filter(i => i.level === 'error')).toHaveLength(0);
  });

  it('faithful program + флаг: stash нигде (флаг игнится, дословно)', () => {
    const plan = programToBBPlan(abProgram(), { workMax: WM, level: 'intermediate', mode: 'faithful', abPatternRotation: true } as any);
    for (const s of plan.weeks[0].sessions) {
      expect(((s as any).abAvoidPatterns || []).length).toBe(0);
    }
  });

  it('adapt без флага: stash нигде (legacy 1-в-1)', () => {
    const c = convertCycleToBBPlan({ cycle: AB_CYCLE, workMax: WM, level: 'intermediate', mode: 'adapt' } as any);
    const p = programToBBPlan(abProgram(), { workMax: WM, level: 'intermediate', mode: 'adapt' } as any);
    for (const s of [...c.weeks[0].sessions, ...p.weeks[0].sessions]) {
      expect(((s as any).abAvoidPatterns || []).length).toBe(0);
    }
  });

  it('inputSnapshot несёт флаг во всех путях (отчёт = реальные настройки)', () => {
    const cOn = convertCycleToBBPlan({ cycle: AB_CYCLE, workMax: WM, level: 'intermediate', mode: 'adapt', abPatternRotation: true } as any);
    expect((cOn as any).inputSnapshot.abPatternRotation).toBe(true);
    const pOn = programToBBPlan(abProgram(), { workMax: WM, level: 'intermediate', mode: 'adapt', abPatternRotation: true } as any);
    expect((pOn as any).inputSnapshot.abPatternRotation).toBe(true);
    const cOff = convertCycleToBBPlan({ cycle: AB_CYCLE, workMax: WM, level: 'intermediate', mode: 'adapt' } as any);
    expect((cOff as any).inputSnapshot.abPatternRotation).toBeUndefined();
    const pOff = programToBBPlan(abProgram(), { workMax: WM, level: 'intermediate', mode: 'adapt' } as any);
    expect((pOff as any).inputSnapshot.abPatternRotation).toBeUndefined();
  });
});
