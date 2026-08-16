import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createBlank } from '../../../../engines/user-program/program-store';
import {
  applyBridgePayloadDispatch,
  completeAnnualBlockImport, getPendingAnnualBlock, ANNUAL_BLOCK_PENDING_KEY, CARDIO_KCAL_NOTE_KEY,
  type BridgeCtx,
} from '../planner-bridge-handlers';
import type { PlannerApply } from '../planner-bridge';
import { annualPlanFromMacro, buildAnnualBlock } from '../../../../engines/annual-training/block-builders.engine';
import { saveAnnualTrainingPlan, loadAnnualTrainingPlan } from '../../../../engines/annual-training/annual-training-storage';
import type { Macrocycle } from '../../../../engines/lms/macrocycle.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import { buildCardioCycle, saveCardioCycle, setActiveCardioCycle } from '../../../../engines/lms/cardio.engine';

function payload(kind: PlannerApply['kind'], data: Record<string, unknown>): PlannerApply {
  return { kind, label: 'test', data, ts: 1 };
}

function context(dir: string, update = vi.fn()): BridgeCtx {
  return {
    program: createBlank('bb'),
    dir,
    update,
    onChange: vi.fn(),
    showToast: vi.fn(),
    tprofile: {} as BridgeCtx['tprofile'],
  };
}

function seedBlock(ctx: BridgeCtx): void {
  ctx.program.bb!.weeks = [{
    week: 1,
    phase: 'accumulation',
    deload: false,
    sessions: [{
      id: 'session-1', name: 'День 1', focus: '',
      blocks: [{ id: 'block-1', type: 'compound', exerciseName: 'Жим', muscle: 'chest', role: 'primary', sets: [] }],
    }],
  } as any];
}

describe('planner bridge handlers', () => {
  it('split for a non-BB direction is a safe no-op', () => {
    const ctx = context('pl');
    expect(() => applyBridgePayloadDispatch(payload('split', { cycle: [['chest']] }), ctx)).not.toThrow();
    expect(ctx.update).not.toHaveBeenCalled();
  });

  it('split replaces the stale microcycle template when applied to BB', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    expect(applyBridgePayloadDispatch(payload('split', { cycle: [['chest'], ['back']] }), ctx)).toBe(true);
    const patch = update.mock.calls[0][0];
    expect(patch.bb.microcycleTemplate).toEqual({ daySlots: [] });
    expect(patch.bb.weeks).toHaveLength(ctx.program.meta.weeks);
    expect(ctx.showToast).toHaveBeenCalled();
  });

  it('unknown kind returns false and reports a toast', () => {
    const ctx = context('bb');
    const unknown = payload('split', {});
    unknown.kind = 'unknown-kind' as PlannerApply['kind'];
    expect(applyBridgePayloadDispatch(unknown, ctx)).toBe(false);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('не применима'));
  });

  it('readiness volume multiplier changes set count, not load', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    const program = ctx.program;
    program.bb!.weeks[0].sessions[0].blocks[0].sets = [
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
    ];
    ctx.program = program;
    applyBridgePayloadDispatch(payload('pri', { volumeMult: 0.5, rirShift: 1 }), ctx);
    const patch = update.mock.calls[0][0];
    const sets = patch.bb.weeks[0].sessions[0].blocks[0].sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].weight).toBe(100);
    expect(sets[0].rir).toBe(3);
  });

  it('deload applies both volume and intensity reduction', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks[0].sessions[0].blocks[0].sets = [
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
      { reps: 8, rir: 2, weight: 100, restSec: 120 },
    ];
    applyBridgePayloadDispatch(payload('deload', { weeks: [1] }), ctx);
    const patch = update.mock.calls[0][0];
    const week = patch.bb.weeks[0];
    expect(week.deload).toBe(true);
    expect(week.sessions[0].blocks[0].sets).toHaveLength(3);
    expect(week.sessions[0].blocks[0].sets[0].weight).toBe(60);
    expect(week.sessions[0].blocks[0].sets[0].rir).toBe(4);
  });

  it('MRV recommendation reduces non-deload weekly muscle volume', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks[0].sessions[0].blocks[0].sets = Array.from({ length: 8 }, () => ({ reps: 8, rir: 2, weight: 100, restSec: 120 }));
    applyBridgePayloadDispatch(payload('mrv', { mrv: 4 }), ctx);
    const patch = update.mock.calls[0][0];
    expect(patch.bb.weeks[0].sessions[0].blocks[0].sets).toHaveLength(4);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('MRV применён'));
  });

  it('MRV recommendation rejects invalid values without changing the plan', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    applyBridgePayloadDispatch(payload('mrv', { mrv: 0 }), ctx);
    expect(update).not.toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('положительным'));
  });

  it('volume adds one accessory block with the requested set count', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    applyBridgePayloadDispatch(payload('volume', { sets: { shoulders: 4 } }), ctx);
    const patch = update.mock.calls[0][0];
    const blocks = patch.bb.weeks[0].sessions[0].blocks;
    const added = blocks.find((block: any) => block.muscle === 'shoulders');
    expect(added).toBeDefined();
    expect(added.sets).toHaveLength(4);
    expect(blocks.filter((block: any) => block.muscle === 'shoulders')).toHaveLength(1);
  });

  it('peak reduces sets and preserves load while setting peaking RIR', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks.push({ ...ctx.program.bb!.weeks[0], week: 2 });
    ctx.program.bb!.weeks[1].sessions[0].blocks[0].sets = Array.from({ length: 4 }, () => ({
      reps: 3, rir: 2, weight: 140, restSec: 180,
    }));
    applyBridgePayloadDispatch(payload('peak', { volumeMult: 0.5, rirTarget: 1 }), ctx);
    const patch = update.mock.calls[0][0];
    const finalWeek = patch.bb.weeks[1];
    const sets = finalWeek.sessions[0].blocks[0].sets;
    expect(finalWeek.phase).toBe('peaking');
    expect(sets).toHaveLength(2);
    expect(sets.every((set: any) => set.weight === 140 && set.rir === 1)).toBe(true);
    expect(patch.bb.weeks[0].phase).toBe('accumulation');
  });

  it('rir and tempo handlers update all sets without changing unrelated fields', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    ctx.program.bb!.weeks[0].sessions[0].blocks[0].sets = [{ reps: 8, rir: 2, weight: 80, restSec: 90 }];
    applyBridgePayloadDispatch(payload('rir', { rirShift: 2 }), ctx);
    let patch = update.mock.calls[0][0];
    expect(patch.bb.weeks[0].sessions[0].blocks[0].sets[0]).toMatchObject({ reps: 8, weight: 80, rir: 4 });

    ctx.program = patch;
    applyBridgePayloadDispatch(payload('tempo', { label: '3-1-1-0' }), ctx);
    patch = update.mock.calls[1][0];
    expect(patch.bb.weeks[0].sessions[0].blocks[0].sets[0]).toMatchObject({ tempo: '3-1-1-0', weight: 80 });
  });

  it('methodology updates progression and malformed payload does not throw', () => {
    const update = vi.fn();
    const ctx = context('bb', update);
    seedBlock(ctx);
    expect(() => applyBridgePayloadDispatch(payload('methodology', { methodName: 'double_progression' }), ctx)).not.toThrow();
    expect(update.mock.calls[0][0].bb.progression.loadStrategy).toBe('double_progression');
    expect(() => applyBridgePayloadDispatch(payload('volume', { sets: null as any }), ctx)).not.toThrow();
  });

  it('program handler принимает готовую UserProgram из «Сборки цикла»', () => {
    const ctx = context('bb');
    const built = createBlank('bb');
    built.meta.title = 'Сборка цикла ББ: тест';
    built.bb!.weeks = [{ week: 1, phase: 'accumulation', deload: false, sessions: [] } as any];
    const ok = applyBridgePayloadDispatch(payload('program', { program: built }), ctx);
    expect(ok).toBe(true);
    expect(ctx.onChange).toHaveBeenCalledWith(built);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('Собранный цикл'));
  });

  it('program handler без готовой программы падает на cycleId', () => {
    const ctx = context('bb');
    const ok = applyBridgePayloadDispatch(payload('program', { id: 'cycle-01' }), ctx);
    expect(ok).toBe(true);
    expect(ctx.onChange).toHaveBeenCalled();
  });

  it('weakpoints + диагностика: упражнения попадают в custom-ПЛ неделю 1', () => {
    const ctx = context('pl');
    ctx.program = createBlank('pl');
    applyBridgePayloadDispatch(payload('weakpoints', {
      groups: ['chest'],
      plWeakPoints: [{ lift: 'bench', weakPoint: 'lockout', days: [1] }],
      diagnosticExerciseMap: { 'bench|barpath|forward_drift': ['Мой ассистент'] },
      diagnosticDayMap: { 'bench|barpath|forward_drift': [3] },
    }), ctx);
    const applied = ctx.onChange.mock.calls[0][0];
    expect(applied.pl.weakPoints).toEqual(['chest']);
    const week1 = applied.pl.customWeeks[0];
    const allNames = week1.days.flatMap((d: any) => d.exercises.map((e: any) => e.name));
    expect(allNames).toContain('Мой ассистент');
    // «Мой ассистент» — в указанный день 3
    expect(week1.days[2].exercises.map((e: any) => e.name)).toContain('Мой ассистент');
    // Слабые точки дают тяжёлый + памп ассистенты из диагностики
    expect(allNames.length).toBeGreaterThan(2);
  });

  it('weakpoints + диагностика: программа из каталога циклов — упражнения пропущены с предупреждением', () => {
    const ctx = context('pl');
    const prog = createBlank('pl');
    prog.pl!.sourceCycleId = 'cycle-01';
    prog.pl!.customWeeks = undefined as any;
    ctx.program = prog;
    applyBridgePayloadDispatch(payload('weakpoints', {
      groups: ['back'],
      diagnosticExerciseMap: { 'bench|barpath|forward_drift': ['Мой ассистент'] },
    }), ctx);
    const applied = ctx.onChange.mock.calls[0][0];
    expect(applied.pl.weakPoints).toEqual(['back']);
    expect(applied.pl.customWeeks).toBeUndefined();
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('пропущены'));
  });

  it('weakpoints без диагностики сохраняет прежнее поведение (только группы)', () => {
    const ctx = context('pl');
    ctx.program = createBlank('pl');
    applyBridgePayloadDispatch(payload('weakpoints', { groups: ['legs'] }), ctx);
    const applied = ctx.onChange.mock.calls[0][0];
    expect(applied.pl.weakPoints).toEqual(['legs']);
    expect(ctx.showToast).toHaveBeenCalledWith('🔗 Слабые группы: legs');
  });
});

describe('annual_block bridge (блок года → редактор → обратно)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  const CYCLE_ID = LMS_CYCLES[0]?.meta.id ?? 'cycle-01';
  const macro: Macrocycle = {
    blocks: [{ phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Тест' }],
    totalWeeks: 6, rationale: [],
  };

  it('annual_block с программой: загружает в редактор и ставит pending-ссылку', () => {
    const ctx = context('bb');
    const prog = createBlank('bb');
    prog.meta.title = 'Блок для правки';
    const ok = applyBridgePayloadDispatch(payload('annual_block', { blockKey: 'blk-1', program: prog }), ctx);
    expect(ok).toBe(true);
    expect(ctx.onChange).toHaveBeenCalledWith(prog);
    expect(getPendingAnnualBlock()?.blockKey).toBe('blk-1');
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('вернутся в блок'));
  });

  it('annual_block без программы: предупреждение, pending не ставится', () => {
    const ctx = context('bb');
    const ok = applyBridgePayloadDispatch(payload('annual_block', { blockKey: 'blk-1' }), ctx);
    expect(ok).toBe(true);
    expect(ctx.onChange).not.toHaveBeenCalled();
    expect(getPendingAnnualBlock()).toBeNull();
  });

  it('completeAnnualBlockImport: сохранение программы возвращает её в блок года', () => {
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, { daysPerWeek: 4 });
    saveAnnualTrainingPlan({ ...plan, blocks: [built] });
    localStorage.setItem(ANNUAL_BLOCK_PENDING_KEY, JSON.stringify({ blockKey: built.ref.blockKey, ts: 1 }));
    const prog = createBlank('bb');
    prog.meta.title = 'Отредактировано в редакторе';
    prog.bb!.weeks = built.result!.weeks;
    const done = completeAnnualBlockImport(prog);
    expect(done).toBe(true);
    expect(getPendingAnnualBlock()).toBeNull();
    const stored = loadAnnualTrainingPlan();
    expect(stored!.blocks[0].status).toBe('built');
    expect(stored!.blocks[0].result!.program?.meta.title).toBe('Отредактировано в редакторе');
  });

  it('completeAnnualBlockImport без pending → false, план не трогается', () => {
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, { daysPerWeek: 4 });
    saveAnnualTrainingPlan({ ...plan, blocks: [built] });
    expect(completeAnnualBlockImport(createBlank('bb'))).toBe(false);
    expect(loadAnnualTrainingPlan()!.blocks[0].result!.program?.meta.title).not.toBe('x');
  });
});

describe('planner bridge � cardio handler (���� ���� � �������)', () => {
  const CYCLE_KEY = 'he_cardio_cycles';
  const ACTIVE_KEY = 'he_active_cardio_cycle';

  beforeEach(() => {
    try {
      localStorage.removeItem(CYCLE_KEY);
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(CARDIO_KCAL_NOTE_KEY);
    } catch { /* ignore */ }
  });

  it('cardio: активный цикл → заметка в localStorage + toast с ккал/нед', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, id: 'cc-nut' });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    const ctx = context('bb');
    expect(applyBridgePayloadDispatch(payload('cardio', {}), ctx)).toBe(true);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('ккал/нед'));
    const note = JSON.parse(localStorage.getItem(CARDIO_KCAL_NOTE_KEY) ?? 'null');
    expect(note?.cycleId).toBe('cc-nut');
    expect(note?.avgKcalPerWeek).toBeGreaterThan(0);
  });

  it('cardio: по cycleId из payload', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'cc-nut2' });
    saveCardioCycle(c);
    const ctx = context('bb');
    applyBridgePayloadDispatch(payload('cardio', { cycleId: 'cc-nut2' }), ctx);
    const note = JSON.parse(localStorage.getItem(CARDIO_KCAL_NOTE_KEY) ?? 'null');
    expect(note?.cycleId).toBe('cc-nut2');
  });

  it('cardio: без цикла → предупреждение, заметка не пишется', () => {
    const ctx = context('bb');
    expect(applyBridgePayloadDispatch(payload('cardio', {}), ctx)).toBe(true);
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('не найден'));
    expect(localStorage.getItem(CARDIO_KCAL_NOTE_KEY)).toBeNull();
  });
});
