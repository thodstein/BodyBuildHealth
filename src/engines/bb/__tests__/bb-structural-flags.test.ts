/**
 * Волна 5.3 (BB-AUTO-EXHAUSTIVE-PRO): структурные флаги вместо комментариев-эвристик.
 *
 * До: делод-подобность определялась ТЕКСТОМ комментария в 4 сайтах финализатора
 * (`/разгруз|deload/i.test(exercise.comment)`), widowmaker — `comment.includes('widowmaker')`
 * (finalize ×2 + rep-schemes). Комментарий — UI-канал: правка текста или локализация
 * молча ломала учёт (fill/MEV-repair/перераспределение заползали в разгрузку).
 *
 * После: `week.isDeloadLike` / `ex.techniqueTag='widowmaker'` пишутся там же, где
 * комментарии (builder weeks.push / cycle-to-plan / applyPostPhaseProcessing /
 * overreaching-проход / widowmaker-пасс финализатора); потребители читают флаг через
 * `isDeloadLikeWeek` / `isWidowmakerExercise` (комментарий — только legacy-фолбэк для
 * планов из storage); комментарий остаётся для UI/печати.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { convertCycleToBBPlan, cycleTemplateToFullProgram, programToBBPlan } from '../cycle-to-plan';
import { getCyclesByDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { isDeloadLikeWeek } from '../bb-autocoach.engine';
import { isWidowmakerExercise } from '../bb-rep-schemes.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];
const WM = { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50, glutes: 160, hamstrings: 90, quads: 120 };

function makeInput(over: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'push_pull_legs_4',
    level: 'intermediate',
    goal: 'mass',
    weeks: 8,
    workMax: WM,
    equipment: EQ,
    volumeGoal: 'mav',
    sex: 'male',
    ...over,
  };
}

function makeWeek(over: Record<string, unknown> = {}): any {
  return {
    week: 2,
    sessions: [{ day: 1, weekOffset: 2, character: 'тяж', exercises: [{ muscle: 'chest', name: 'Жим лёжа', comment: '', sets: 3, workSets: [] }] }],
    ...over,
  };
}

const hasDeloadComment = (w: any): boolean =>
  (w.sessions || []).some((s: any) => (s.exercises || []).some((e: any) => /разгруз|deload/i.test(String(e.comment || ''))));

describe('5.3: isDeloadLikeWeek — структурный признак + legacy-фолбэк', () => {
  it('структурный флаг isDeloadLike (без фазы/делода/комментариев)', () => {
    expect(isDeloadLikeWeek(makeWeek({ isDeloadLike: true }))).toBe(true);
  });

  it('deload-флаг и phase=deload (любой регистр)', () => {
    expect(isDeloadLikeWeek(makeWeek({ deload: true }))).toBe(true);
    expect(isDeloadLikeWeek(makeWeek({ phase: 'deload' }))).toBe(true);
    expect(isDeloadLikeWeek(makeWeek({ phase: 'DELOAD' }))).toBe(true);
  });

  it('legacy-фолбэк: план из storage с одним комментарием (без флага)', () => {
    const legacy = makeWeek();
    legacy.sessions[0].exercises[0].comment = 'Накопление, RIR 4 (памп) · Разгрузка — нед 4';
    expect(isDeloadLikeWeek(legacy)).toBe(true);
  });

  it('обычная рабочая неделя — false', () => {
    expect(isDeloadLikeWeek(makeWeek())).toBe(false);
    expect(isDeloadLikeWeek(makeWeek({ phase: 'accumulation' }))).toBe(false);
  });
});

describe('5.3: свежие планы несут структурный признак (комментарий — не единственный сигнал)', () => {
  it('generic: каждая deload-неделя имеет isDeloadLike, флаг согласован с комментарием/фазой', () => {
    const plan = buildBBPlan(makeInput());
    const deloads = plan.weeks.filter(w => w.phase === 'deload' || (w as any).deload);
    expect(deloads.length).toBeGreaterThan(0);
    for (const w of plan.weeks) {
      // «флаг и комментарий согласованы»: isDeloadLike ⇔ (фаза/делод/делод-комментарий)
      const structural = w.phase === 'deload' || (w as any).deload === true || hasDeloadComment(w);
      expect(Boolean(w.isDeloadLike), `нед ${w.week}`).toBe(structural);
    }
  });

  it('cycle-путь: deload-недели несут isDeloadLike', () => {
    const cycle: any = getCyclesByDirection('bodybuilding').find(c => !c.meta.id.startsWith('embed-') && c.meta.weeks >= 8);
    expect(cycle).toBeDefined();
    const plan = convertCycleToBBPlan({ cycle, workMax: WM, level: 'intermediate', equipment: EQ, mode: 'adapt', sex: 'male', goal: 'mass' } as any);
    const deloads = plan.weeks.filter(w => w.phase === 'deload' || (w as any).deload);
    expect(deloads.length).toBeGreaterThan(0);
    expect(deloads.every(w => w.isDeloadLike === true), cycle.meta.id).toBe(true);
  });

  it('program-путь (UI «ПРОФ-цикл»): deload-недели несут структурный признак', () => {
    const cycle: any = getCyclesByDirection('bodybuilding').find(c => !c.meta.id.startsWith('embed-') && (c.meta.deloadWeeks?.length || 0) > 0);
    expect(cycle).toBeDefined();
    const program = cycleTemplateToFullProgram(cycle);
    const plan = programToBBPlan(program, { workMax: WM, level: 'intermediate', trainingYears: 3, mode: 'adapt', sex: 'male', goal: 'mass' } as any);
    const deloads = plan.weeks.filter(w => w.phase === 'deload' || (w as any).deload);
    expect(deloads.length).toBeGreaterThan(0);
    expect(deloads.every(w => w.isDeloadLike === true || w.phase === 'deload'), cycle.meta.id).toBe(true);
  });

  it('overreaching: вторая разгрузка помечена флагом и комментарием', () => {
    const plan = buildBBPlan(makeInput({ deloadReadiness: { before: 40, after: 35 } }));
    const marked = plan.weeks.filter(w => w.sessions.some(s => s.exercises.some(e => /Overreaching/.test(e.comment || ''))));
    expect(marked.length).toBeGreaterThan(0);
    for (const w of marked) {
      expect(w.isDeloadLike, `нед ${w.week}`).toBe(true);
      expect(hasDeloadComment(w)).toBe(true); // «вторая разгрузка» — тот же текст
    }
  });
});

describe('5.3: widowmaker — тег вместо парсинга комментария', () => {
  it('isWidowmakerExercise: тег / legacy-комментарий / обычное упражнение', () => {
    expect(isWidowmakerExercise({ techniqueTag: 'widowmaker', comment: '' })).toBe(true);
    expect(isWidowmakerExercise({ comment: '… 💀 DC widowmaker 1×20 @77кг …' })).toBe(true);
    expect(isWidowmakerExercise({ comment: 'Накопление, RIR 2' })).toBe(false);
    expect(isWidowmakerExercise({})).toBe(false);
  });

  it('dcMode-план: host несёт techniqueTag и комментарий; без dcMode тега нет', () => {
    const gated: BBBuilderInput = makeInput({
      level: 'enhanced', trainingYears: 4, onCourse: true, dcMode: true,
      pedDoses: { AAS: 1000 } as any,
    });
    const plan = buildBBPlan(gated);
    const hosts = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter((e: any) => e.techniqueTag === 'widowmaker');
    expect(hosts.length).toBeGreaterThan(0);
    for (const h of hosts) {
      expect(h.muscle).toBe('quads');
      expect(String(h.comment || '')).toContain('widowmaker');
      expect(h.workSets.some((ws: any) => ws.reps === 20)).toBe(true);
    }
    const plain = buildBBPlan(makeInput({ level: 'enhanced', trainingYears: 4, onCourse: true, pedDoses: { AAS: 1000 } as any }));
    expect(plain.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).some((e: any) => e.techniqueTag === 'widowmaker')).toBe(false);
  });
});

describe('5.3: source-guard — потребители не парсят комментарии', () => {
  const finalizeSrc = readFileSync(resolve(__dirname, '..', 'bb-finalize.engine.ts'), 'utf8');
  const repSchemesSrc = readFileSync(resolve(__dirname, '..', 'bb-rep-schemes.engine.ts'), 'utf8');
  const builderSrc = readFileSync(resolve(__dirname, '..', 'bb-builder.engine.ts'), 'utf8');
  const autocoachSrc = readFileSync(resolve(__dirname, '..', 'bb-autocoach.engine.ts'), 'utf8');
  const cycleSrc = readFileSync(resolve(__dirname, '..', 'cycle-to-plan.ts'), 'utf8');

  it('bb-finalize: ноль regex/includes-эвристик, потребители читают helper', () => {
    expect(finalizeSrc).not.toMatch(/\/разгруз\|deload\/i/);
    expect(finalizeSrc).not.toMatch(/includes\('widowmaker'\)/);
    expect(finalizeSrc).toContain('isDeloadLikeWeek');
    expect(finalizeSrc).toContain('isWidowmakerExercise');
  });

  it('bb-rep-schemes: парсинг комментария ровно в одном месте — helper', () => {
    const matches = repSchemesSrc.match(/includes\('widowmaker'\)/g) || [];
    expect(matches.length).toBe(1);
    expect(repSchemesSrc).toContain("ex?.techniqueTag === 'widowmaker'");
    expect(repSchemesSrc).toContain('isWidowmakerExercise(ex)');
  });

  it('писатели: флаг ставится в builder / cycle-to-plan / autocoach / overreaching', () => {
    expect(builderSrc).toContain('isDeloadLike: phase ===');
    expect(builderSrc).toContain('(target as any).isDeloadLike = true;');
    expect(autocoachSrc).toContain("(w as any).isDeloadLike = true;");
    expect(cycleSrc).toContain('isDeloadLike: isDeload');
    expect(cycleSrc).toContain("...(normPhase === 'deload' ? { isDeloadLike: true } : {})");
  });
});
