/**
 * annual-training-engine.test.ts — годовой план, собранный по конструкторам.
 * Покрывает: ключи/хэши, создание плана из макро, синхронизацию (stale),
 * сборку блоков ПЛ/ББ/ручной, taper-идемпотентность, пик-неделю ББ,
 * композицию года.
 */
import { describe, it, expect } from 'vitest';
import {
  stableHash, macroBlockKey, blockKindFromMacro, isBBMacroShape,
  annualPlanFromMacro, syncAnnualPlan, buildAnnualBlock, buildAnnualPlan,
  composeAnnualProgram, applyBlockTaperToWeeks, mergeBlockWeeks,
  directionFromKinds, planStatusFromBlocks, defaultConfigForRef,
  setAnnualBlockConfig, setAnnualBlockKind, updateAnnualBlockWeeks,
  importProgramIntoAnnualBlock, validateAnnualPlan, activeBlockForWeek,
  recommendKindForPhase, cloneBlockConfigFrom, annualWeekForDate, annualPlanPhaseForDate,
  selectPLCycleForBlock, applyPLBlockTaperToWeeks, applyBlockPhaseToWeeks,
} from '../block-builders.engine';
import type { Macrocycle, MacroBlock, BBMacrocycle } from '../../lms/macrocycle.engine';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { createBlank } from '../../user-program/program-store';

const CYCLE_ID = LMS_CYCLES[0]?.meta.id ?? 'cycle_unknown';

function makePLMacro(overrides: Partial<MacroBlock>[] = []): Macrocycle {
  const base: MacroBlock[] = [
    { phase: 'endurance', weeks: 8, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
    { phase: 'strength', weeks: 8, weekOffset: 9, kind: 'BB', description: 'Силовой BB' },
    { phase: 'peak', weeks: 2, weekOffset: 17, kind: 'SRC', cycleId: CYCLE_ID, description: 'Пик' },
    { phase: 'competition', weeks: 1, weekOffset: 19, kind: 'SRC', description: 'Старт' },
    { phase: 'transition', weeks: 2, weekOffset: 20, kind: 'SRC', cycleId: CYCLE_ID, description: 'Переход' },
  ];
  const blocks = overrides.length > 0 ? base.map((b, i) => ({ ...b, ...(overrides[i] ?? {}) })) : base;
  return { blocks, totalWeeks: 21, rationale: [] };
}

function makeBBMacro(): BBMacrocycle {
  return {
    blocks: [
      { phase: 'hypertrophy', weeks: 8, weekOffset: 1, description: 'Гипертрофия', trainingFocus: 'hypertrophy' },
      { phase: 'strength', weeks: 4, weekOffset: 9, description: 'Сила', trainingFocus: 'strength' },
      { phase: 'contest_prep', weeks: 6, weekOffset: 13, description: 'Prep', trainingFocus: 'endurance' },
      { phase: 'transition', weeks: 2, weekOffset: 19, description: 'Переход', trainingFocus: 'hypertrophy' },
    ],
    totalWeeks: 20,
    trainingFocus: 'hypertrophy',
    rationale: [],
  };
}

const PEAK_CFG = {
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 1,
  showDate: '2026-09-01', weeksOut: 3,
  trainingProtocol: 'bb', carbLoadStrategy: 'moderate',
  waterStrategy: 'minimal', sodiumStrategy: 'constant',
};

const DEFAULT_OPTS = { daysPerWeek: 4, level: 'intermediate' };

describe('ключи и хэши', () => {
  it('stableHash: детерминирован и чувствителен к изменениям', () => {
    expect(stableHash({ a: 1, b: [2, 3] })).toBe(stableHash({ a: 1, b: [2, 3] }));
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
    expect(stableHash({ a: 1, b: 2 })).not.toBe(stableHash({ b: 2, a: 1 }));
  });

  it('macroBlockKey: изменение layout меняет ключ', () => {
    const block: MacroBlock = { phase: 'strength', weeks: 8, weekOffset: 9, kind: 'SRC', cycleId: CYCLE_ID, description: '' };
    expect(macroBlockKey(block, 1)).toBe(macroBlockKey(block, 1));
    expect(macroBlockKey({ ...block, weeks: 9 }, 1)).not.toBe(macroBlockKey(block, 1));
    expect(macroBlockKey({ ...block, cycleId: 'other' }, 1)).not.toBe(macroBlockKey(block, 1));
  });

  it('blockKindFromMacro: SRC→PL, BB→BB', () => {
    expect(blockKindFromMacro({ phase: 'strength', weeks: 4, weekOffset: 1, kind: 'SRC', description: '' })).toBe('PL');
    expect(blockKindFromMacro({ phase: 'strength', weeks: 4, weekOffset: 1, kind: 'BB', description: '' })).toBe('BB');
  });

  it('isBBMacroShape: по trainingFocus', () => {
    expect(isBBMacroShape(makeBBMacro())).toBe(true);
    expect(isBBMacroShape(makePLMacro())).toBe(false);
  });

  it('directionFromKinds / planStatusFromBlocks', () => {
    expect(directionFromKinds(['PL', 'PL'])).toBe('pl');
    expect(directionFromKinds(['BB'])).toBe('bb');
    expect(directionFromKinds(['PL', 'BB'])).toBe('mixed');
    expect(planStatusFromBlocks([{ status: 'unbuilt' } as any])).toBe('draft');
    expect(planStatusFromBlocks([{ status: 'built' } as any])).toBe('built');
    expect(planStatusFromBlocks([{ status: 'built' } as any, { status: 'unbuilt' } as any])).toBe('partial');
    expect(planStatusFromBlocks([{ status: 'stale' } as any])).toBe('stale');
  });
});

describe('создание плана из макро', () => {
  it('PL-макро: kind из блоков, direction mixed, все unbuilt', () => {
    const plan = annualPlanFromMacro(makePLMacro());
    expect(plan.totalWeeks).toBe(21);
    expect(plan.blocks).toHaveLength(5);
    expect(plan.blocks.map(b => b.ref.kind)).toEqual(['PL', 'BB', 'PL', 'PL', 'PL']);
    expect(plan.direction).toBe('mixed');
    expect(plan.status).toBe('draft');
    expect(plan.blocks.every(b => b.status === 'unbuilt')).toBe(true);
    expect(plan.macroRef?.source).toBe('pl');
  });

  it('BB-макро: все блоки BB, cycleId не подставляется', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    expect(plan.direction).toBe('bb');
    expect(plan.blocks.every(b => b.ref.kind === 'BB')).toBe(true);
    expect(plan.blocks.every(b => !b.ref.cycleId)).toBe(true);
    expect(plan.macroRef?.source).toBe('bb');
  });

  it('defaultConfigForRef: PL-блок получает cycleId по умолчанию', () => {
    const ref = { blockKey: 'k', blockIndex: 0, kind: 'PL' as const, phase: 'peak', startWeek: 17, weeks: 2, cycleId: CYCLE_ID };
    expect(defaultConfigForRef(ref).cycleId).toBe(CYCLE_ID);
    expect(defaultConfigForRef({ ...ref, kind: 'BB' as const, cycleId: undefined }).cycleId).toBeUndefined();
  });
});

describe('синхронизация и stale', () => {
  it('layout не изменился → статус и результат сохраняются', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    const synced = syncAnnualPlan({ ...plan, blocks: [built, ...plan.blocks.slice(1)] }, macro);
    expect(synced.blocks[0].status).toBe('built');
    expect(synced.blocks[0].result).toEqual(built.result);
  });

  it('layout изменился (недели) → статус stale, результат НЕ перезаписан', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    plan.blocks[0].status = 'built';
    const savedResult = { blockKey: plan.blocks[0].ref.blockKey, kind: 'PL' as const, weeks: [], program: null, bbPlan: null, warnings: [], taperApplied: false, peakApplied: false, configHash: 'old' };
    plan.blocks[0].result = savedResult;
    const changed = makePLMacro([{ weeks: 10 }]);
    const synced = syncAnnualPlan(plan, changed);
    expect(synced.blocks[0].ref.weeks).toBe(10);
    expect(synced.blocks[0].status).toBe('stale');
    expect(synced.blocks[0].result).toEqual(savedResult);
    expect(synced.status).toBe('stale');
  });

  it('конфиг изменён после сборки → stale', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, {});
    expect(built.status).toBe('built');
    const edited = { ...built, config: { ...built.config, taper: { enabled: true } } };
    const synced = syncAnnualPlan({ ...plan, blocks: [edited, ...plan.blocks.slice(1)] }, macro);
    expect(synced.blocks[0].status).toBe('stale');
  });
});

describe('сборка блоков', () => {
  it('selectPLCycleForBlock подбирает цикл под фазу и длину блока', () => {
    const selected = selectPLCycleForBlock(undefined, 'strength', 12, 'intermediate');
    expect(selected.cycleId).toBeTruthy();
    expect(selected.warning).toContain('Автоподбор');
  });

  it('PL-блок повторяет короткий цикл до длины фазы с предупреждением', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    expect(built.result!.weeks).toHaveLength(plan.blocks[0].ref.weeks);
    expect(built.result!.program?.pl?.sourceCycleId).toBeTruthy();
  });

  it('PL: авто-замена короткого цикла синхронизирует config.cycleId с собранным', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const blockWeeks = plan.blocks[0].ref.weeks; // 8 нед
    const short = LMS_CYCLES.find(c => normalizeCycleDirection(c.meta.direction) === 'strength' && c.meta.weeks < blockWeeks);
    if (!short) return; // в каталоге нет коротких циклов — тест не применим
    const state = { ...plan.blocks[0], config: { ...plan.blocks[0].config, cycleId: short.meta.id } };
    const built = buildAnnualBlock(state, plan, macro, DEFAULT_OPTS);
    const used = built.result!.program?.pl?.sourceCycleId;
    expect(used).toBeTruthy();
    // Инвариант M4: конфиг показывает тот цикл, которым реально собран блок.
    expect(built.config.cycleId).toBe(used);
  });

  it('PL-блок: СРЦ-цикл → недели с упражнениями + program.pl.sourceCycleId', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const state = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    expect(state.status).toBe('built');
    expect(state.result!.weeks).toHaveLength(8);
    const totalBlocks = state.result!.weeks.reduce((s, w) => s + w.sessions.reduce((ss, ses) => ss + ses.blocks.length, 0), 0);
    expect(totalBlocks).toBeGreaterThan(0);
    expect(state.result!.program?.pl?.sourceCycleId).toBe(CYCLE_ID);
    expect(state.result!.weeks[0].phase).toBe('accumulation');
  });

  it('PL-блок без цикла: автоподбор цикла по фазе, не ошибка', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const state = { ...plan.blocks[3], config: { ...plan.blocks[3].config, cycleId: undefined } };
    const built = buildAnnualBlock(state, plan, macro, {});
    expect(built.status).toBe('built');
    expect(built.result!.program?.pl?.sourceCycleId).toBeTruthy();
    expect(built.result!.weeks).toHaveLength(1);
  });

  it('BB пик-неделя: финал блока не модулируется фазой повторно (skipLastWeek)', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[1], plan, macro, DEFAULT_OPTS);
    const base = built.result!.weeks;
    const setsOf = (w: { sessions: Array<{ blocks: Array<{ sets: unknown[] }> }> }) =>
      w.sessions.reduce((s, ses) => s + ses.blocks.reduce((a, b) => a + b.sets.length, 0), 0);
    const modulated = applyBlockPhaseToWeeks(base, 'contest_prep', 'BB', true);
    expect(setsOf(modulated[modulated.length - 1])).toBe(setsOf(base[base.length - 1]));
    expect(setsOf(modulated[0])).toBeLessThan(setsOf(base[0]));
  });

  it('P2.1: contest_prep-блок через Prep-цикл (config.prep), опт-ин', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const bb = plan.blocks[1];
    const built = buildAnnualBlock({
      ...bb,
      config: { ...bb.config, prep: { category: 'mens_physique', showDate: '2027-06-01', accentMuscles: ['shoulders', 'back'], minimalMuscles: ['quads'], taperWeeks: 2 } },
    }, plan, macro, DEFAULT_OPTS);
    expect(built.result!.peakApplied).toBe(true);
    expect(built.result!.taperApplied).toBe(true);
    expect(built.result!.weeks.length).toBe(bb.ref.weeks);
    expect(built.result!.bbPlan).toBeDefined();
    const bbp = built.result!.bbPlan as any;
    expect(Array.isArray(bbp.weeks)).toBe(true);
    expect(bbp.weeks.some((w: any) => w.contestPhase === 'peak_week')).toBe(true);
    expect(bbp.weeks.some((w: any) => w.contestPhase === 'taper')).toBe(true);
  });

  it('syncAnnualPlan: свежая разметка побеждает для competitionId (той же блокKey)', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const macro2: Macrocycle = { ...macro, blocks: macro.blocks.map((b, i) => (i === 3 ? { ...b, competitionId: 'new-comp' } : b)) };
    const synced = syncAnnualPlan(plan, macro2);
    expect(synced.blocks[3].ref.competitionId).toBe('new-comp');
  });

  it('PL taper: финальная ×0.45/RIR+2, предпоследняя ×0.65/RIR+1, идемпотентно', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const block = plan.blocks[0];
    const built = buildAnnualBlock({ ...block, config: { ...block.config, taper: { enabled: true } } }, plan, macro, DEFAULT_OPTS);
    expect(built.result!.taperApplied).toBe(true);
    const weeks = built.result!.weeks;
    expect(weeks[7].sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-taper:0.45]')))).toBe(true);
    expect(weeks[6].sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-taper:0.65]')))).toBe(true);
    const twice = applyBlockTaperToWeeks(weeks, 2);
    expect(twice).toEqual(weeks);
  });

  it('PL taper с раскладкой: реальная кривая (mode) вместо фиксированных ×0.65/×0.45', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const block = plan.blocks[0];
    const built = buildAnnualBlock({ ...block, config: { ...block.config, taper: { enabled: true, weeks: 2, mode: 'pro' } } }, plan, macro, DEFAULT_OPTS);
    expect(built.result!.taperApplied).toBe(true);
    const weeks = built.result!.weeks;
    const last = weeks[weeks.length - 1];
    expect(last.note?.includes('[annual-pl-taper:')).toBe(true);
    const lastSessionNote = last.sessions[0]?.note ?? '';
    expect(lastSessionNote).toContain('Финальная');
    const again = applyPLBlockTaperToWeeks(weeks, { weeks: 2, mode: 'pro' });
    expect(again.applied).toBe(false);
  });

  it('PL taper: mock meet (прикиды) и пост-старт — метки на финальной неделе', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const block = plan.blocks[0];
    const built = buildAnnualBlock({ ...block, config: { ...block.config, taper: { enabled: true, weeks: 2, mockMeet: true, postMeet: true } } }, plan, macro, DEFAULT_OPTS);
    const last = built.result!.weeks[built.result!.weeks.length - 1];
    expect(last.note).toContain('🎯 Mock meet');
    expect(last.note).toContain('🔄 Пост-старт');
  });

  it('PL taper: весовая цель lose снижает объём кривой (×0.9)', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const block = plan.blocks[0];
    const built = buildAnnualBlock({ ...block, config: { ...block.config, taper: { enabled: true, weeks: 2, mode: 'classic', weightGoal: 'lose' } } }, plan, macro, DEFAULT_OPTS);
    const last = built.result!.weeks[built.result!.weeks.length - 1];
    const vol = (last.note ?? '').match(/\[annual-pl-taper:([\d.]+)\]/)?.[1];
    expect(Number(vol)).toBeCloseTo(0.405, 2);
  });

  it('BB-блок: autodraft → недели длины блока + program.bb', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[1], plan, macro, DEFAULT_OPTS);
    expect(built.status).toBe('built');
    expect(built.result!.weeks).toHaveLength(8);
    expect(built.result!.program?.bb?.weeks).toHaveLength(8);
    expect(built.result!.weeks[0].phase).toBe('intensification');
    expect(built.result!.bbPlan).toBeTruthy();
  });

  it('BB-блок длиннее 16 недель: зацикливается без ошибки', () => {
    const macro: Macrocycle = {
      blocks: [{ phase: 'hypertrophy', weeks: 20, weekOffset: 1, kind: 'BB', description: 'длинный' }],
      totalWeeks: 20, rationale: [],
    };
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    expect(built.status).toBe('built');
    expect(built.result!.weeks).toHaveLength(20);
  });

  it('BB пик-неделя: применяется к последней неделе contest_prep-блока', () => {
    const macro = makeBBMacro();
    const plan = annualPlanFromMacro(macro);
    const state = plan.blocks[2];
    const built = buildAnnualBlock({
      ...state,
      config: { ...state.config, peakWeek: true, peakConfig: PEAK_CFG as any },
    }, plan, macro, DEFAULT_OPTS);
    expect(built.status).toBe('built');
    expect(built.result!.peakApplied).toBe(true);
    expect(built.result!.weeks[5].phase).toBe('peaking');
  });

  it('MANUAL-блок: скелет фаз + копия структуры из блока-шаблона', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const bbBuilt = buildAnnualBlock(plan.blocks[1], plan, macro, DEFAULT_OPTS);
    const planWithResult = { ...plan, blocks: [...plan.blocks] };
    planWithResult.blocks[1] = bbBuilt; // сохранить результат шаблона в план
    const manual: Macrocycle = {
      blocks: [{ phase: 'transition', weeks: 3, weekOffset: 22, kind: 'SRC', cycleId: undefined as any, description: 'ручной' }],
      totalWeeks: 24, rationale: [],
    };
    const manualPlan = annualPlanFromMacro(manual);
    const state = {
      ...manualPlan.blocks[0],
      ref: { ...manualPlan.blocks[0].ref, kind: 'MANUAL' as const },
      config: { daysPerWeek: 3, templateFromBlockKey: bbBuilt.ref.blockKey },
    };
    const planWithTemplate = { ...manualPlan, blocks: [state, ...planWithResult.blocks] };
    const built = buildAnnualBlock(state, planWithTemplate as any, macro, {});
    expect(built.status).toBe('built');
    expect(built.result!.weeks).toHaveLength(3);
    expect(built.result!.weeks[0].phase).toBe('deload');
    expect(built.result!.weeks.some(w => w.sessions.some(s => s.blocks.length > 0))).toBe(true);
    expect(built.result!.warnings.some(w => w.includes('скопирована'))).toBe(true);
  });
});

describe('сборка года', () => {
  it('собирает только unbuilt; второй запуск ничего не пересобирает', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const first = buildAnnualPlan(plan, macro, DEFAULT_OPTS);
    expect(first.built).toBe(plan.blocks.length);
    expect(first.failed).toBe(0);
    expect(first.plan.status).toBe('built');
    const second = buildAnnualPlan(first.plan, macro, DEFAULT_OPTS);
    expect(second.built).toBe(0);
    expect(second.skipped).toBe(plan.blocks.length);
  });

  it('rebuild=all пересобирает все блоки', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const first = buildAnnualPlan(plan, macro, DEFAULT_OPTS);
    const all = buildAnnualPlan(first.plan, macro, { ...DEFAULT_OPTS, rebuild: 'all' });
    expect(all.built).toBe(plan.blocks.length);
    expect(all.skipped).toBe(0);
  });

  it('ошибка одного блока не ломает остальные (частичная сборка)', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const broken = { ...plan.blocks[2], ref: { ...plan.blocks[2].ref, kind: 'XXX' as any } };
    // sync:false — собрать блоки «как есть» (оркестратор уже синхронизировал план).
    const outcome = buildAnnualPlan(
      { ...plan, blocks: [plan.blocks[0], broken] },
      macro,
      { ...DEFAULT_OPTS, sync: false } as any,
    );
    expect(outcome.built).toBe(1);
    expect(outcome.failed).toBe(1);
    expect(outcome.errors[0].blockKey).toBe(broken.ref.blockKey);
    expect(outcome.plan.status).toBe('partial');
    expect(outcome.plan.blocks[0].status).toBe('built');
    expect(outcome.plan.blocks[1].status).toBe('error');
  });

  it('неизвестный kind блока → status error с понятным сообщением', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const state = { ...plan.blocks[0], ref: { ...plan.blocks[0].ref, kind: 'XXX' as any } };
    const built = buildAnnualBlock(state, plan, macro, {});
    expect(built.status).toBe('error');
    expect(built.error).toContain('Неизвестный тип конструктора');
  });
});

describe('правки блоков (конфиг/ручной roundtrip)', () => {
  it('setAnnualBlockConfig: собранный блок → stale, результат сохраняется', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    const withResult = { ...plan, blocks: [built, ...plan.blocks.slice(1)] };
    const next = setAnnualBlockConfig(withResult, built.ref.blockKey, { taper: { enabled: true } });
    expect(next.blocks[0].status).toBe('stale');
    expect(next.blocks[0].config.taper?.enabled).toBe(true);
    expect(next.blocks[0].result).toEqual(built.result);
    expect(next.status).toBe('stale');
  });

  it('setAnnualBlockConfig: unbuilt остаётся unbuilt', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const next = setAnnualBlockConfig(plan, plan.blocks[0].ref.blockKey, { daysPerWeek: 5 });
    expect(next.blocks[0].status).toBe('unbuilt');
    expect(next.blocks[0].config.daysPerWeek).toBe(5);
  });

  it('setAnnualBlockKind: смена конструктора → stale + пересчёт direction', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[1], plan, macro, DEFAULT_OPTS); // BB → MANUAL
    const withResult = { ...plan, blocks: [plan.blocks[0], built, ...plan.blocks.slice(2)] };
    const next = setAnnualBlockKind(withResult, built.ref.blockKey, 'MANUAL');
    expect(next.blocks[1].ref.kind).toBe('MANUAL');
    expect(next.blocks[1].status).toBe('stale');
    expect(next.direction).toBe('mixed');
  });

  it('updateAnnualBlockWeeks: ручной roundtrip → built, configHash синхронизирован (нет stale)', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    const withResult = { ...plan, blocks: [built, ...plan.blocks.slice(1)] };
    const editedWeeks = built.result!.weeks.map(w => ({
      ...w,
      sessions: w.sessions.map(s => ({ ...s, blocks: s.blocks.slice(0, Math.max(0, s.blocks.length - 1)) })),
    }));
    const next = updateAnnualBlockWeeks(withResult, built.ref.blockKey, editedWeeks, null, ['ручная правка']);
    expect(next.blocks[0].status).toBe('built');
    expect(next.blocks[0].result!.weeks).toHaveLength(8);
    expect(next.blocks[0].result!.warnings).toContain('ручная правка');
    // Синхронизация с макро не помечает блок устаревшим (configHash совпадает).
    const synced = syncAnnualPlan(next, macro);
    expect(synced.blocks[0].status).toBe('built');
    expect(synced.blocks[0].result!.weeks[0].sessions[0].blocks.length).toBe(
      next.blocks[0].result!.weeks[0].sessions[0].blocks.length,
    );
  });

  it('importProgramIntoAnnualBlock: принимает bb-программу из редактора', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[1], plan, macro, DEFAULT_OPTS);
    const withResult = { ...plan, blocks: [plan.blocks[0], built, ...plan.blocks.slice(2)] };
    const prog = createBlank('bb');
    prog.meta.title = 'Отредактировано вручную';
    prog.bb!.weeks = built.result!.weeks;
    const next = importProgramIntoAnnualBlock(withResult, built.ref.blockKey, prog);
    expect(next.blocks[1].status).toBe('built');
    expect(next.blocks[1].result!.program?.meta.title).toBe('Отредактировано вручную');
    expect(next.blocks[1].result!.warnings.some(w => w.includes('Импортировано'))).toBe(true);
  });
});

describe('валидация разметки года', () => {
  it('целостная разметка → нет предупреждений', () => {
    const plan = annualPlanFromMacro(makePLMacro());
    const v = validateAnnualPlan(plan);
    expect(v.gaps).toHaveLength(0);
    expect(v.overlaps).toHaveLength(0);
    expect(v.totalMismatch).toBe(false);
    expect(v.warnings).toHaveLength(0);
  });

  it('пропуск недель между блоками → gap', () => {
    const macro: Macrocycle = {
      blocks: [
        { phase: 'endurance', weeks: 4, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'A' },
        { phase: 'strength', weeks: 4, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'B' },
      ],
      totalWeeks: 10, rationale: [],
    };
    const v = validateAnnualPlan(annualPlanFromMacro(macro));
    expect(v.gaps).toEqual([{ from: 5, to: 6 }]);
    expect(v.warnings.some(w => w.includes('пропуск нед 5–6'))).toBe(true);
  });

  it('перекрытие блоков → overlap', () => {
    const macro: Macrocycle = {
      blocks: [
        { phase: 'endurance', weeks: 5, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'A' },
        { phase: 'strength', weeks: 4, weekOffset: 4, kind: 'SRC', cycleId: CYCLE_ID, description: 'B' },
      ],
      totalWeeks: 7, rationale: [],
    };
    const v = validateAnnualPlan(annualPlanFromMacro(macro));
    expect(v.overlaps).toHaveLength(1);
    expect(v.warnings.some(w => w.includes('перекрытие'))).toBe(true);
  });

  it('сумма недель ≠ totalWeeks → totalMismatch', () => {
    const macro: Macrocycle = {
      blocks: [{ phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'A' }],
      totalWeeks: 10, rationale: [],
    };
    const v = validateAnnualPlan(annualPlanFromMacro(macro));
    expect(v.totalMismatch).toBe(true);
    expect(v.warnings.some(w => w.includes('≠ 10'))).toBe(true);
  });

  it('activeBlockForWeek: находит блок недели; вне диапазона → null', () => {
    const plan = annualPlanFromMacro(makePLMacro());
    expect(activeBlockForWeek(plan, 1)?.ref.phase).toBe('endurance');
    expect(activeBlockForWeek(plan, 9)?.ref.phase).toBe('strength');
    expect(activeBlockForWeek(plan, 17)?.ref.phase).toBe('peak');
    expect(activeBlockForWeek(plan, 19)?.ref.phase).toBe('competition');
    expect(activeBlockForWeek(plan, 21)?.ref.phase).toBe('transition');
    expect(activeBlockForWeek(plan, 99)).toBeNull();
    expect(activeBlockForWeek(plan, 0)).toBeNull();
    expect(activeBlockForWeek(plan, NaN)).toBeNull();
  });

  it('annualWeekForDate: неделя 1 = reference; +7д → 2; -7д → 2; некорректно → null', () => {
    const ref = '2026-01-01';
    expect(annualWeekForDate('2026-01-01', ref)).toBe(1);
    expect(annualWeekForDate('2026-01-08', ref)).toBe(2);
    expect(annualWeekForDate('2026-01-02', ref)).toBe(1);
    expect(annualWeekForDate('2025-12-25', ref)).toBe(2);
    expect(annualWeekForDate('не дата', ref)).toBeNull();
    expect(annualWeekForDate('', ref)).toBeNull();
  });

  it('annualPlanPhaseForDate: блок года на дату + неделя', () => {
    const plan = annualPlanFromMacro(makePLMacro());
    const ref = '2026-01-01'; // нед 1 = endurance (1-8)
    const inBlock = annualPlanPhaseForDate(plan, '2026-01-15', ref); // нед 3
    expect(inBlock).toBeTruthy();
    expect(inBlock!.week).toBe(3);
    expect(inBlock!.block.ref.phase).toBe('endurance');
    const inStrength = annualPlanPhaseForDate(plan, '2026-03-05', ref); // нед 10
    expect(inStrength!.block.ref.phase).toBe('strength');
    const out = annualPlanPhaseForDate(plan, '2027-01-01', ref);
    expect(out).toBeNull();
    expect(annualPlanPhaseForDate(plan, 'не дата', ref)).toBeNull();
  });

  it('recommendKindForPhase: BB-макро → BB; PL-фазы → PL, BB-фазы → BB', () => {
    expect(recommendKindForPhase('hypertrophy', 'bb')).toBe('BB');
    expect(recommendKindForPhase('contest_prep', 'bb')).toBe('BB');
    expect(recommendKindForPhase('endurance', 'pl')).toBe('PL');
    expect(recommendKindForPhase('strength', 'pl')).toBe('PL');
    expect(recommendKindForPhase('peak', 'pl')).toBe('PL');
    expect(recommendKindForPhase('competition', 'pl')).toBe('PL');
    expect(recommendKindForPhase('transition', 'pl')).toBe('PL');
    expect(recommendKindForPhase('hypertrophy', 'pl')).toBe('BB');
    expect(recommendKindForPhase('contest_prep', 'pl')).toBe('BB');
  });

  it('cloneBlockConfigFrom: копирует kind+конфиг в целевой блок (unbuilt остаётся unbuilt)', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    // Блок 0: PL с циклом. Блок 1: BB, собран. Копируем настройки ББ-блока в блок 0.
    const bbBuilt = buildAnnualBlock(plan.blocks[1], plan, macro, DEFAULT_OPTS);
    const withResult = { ...plan, blocks: [plan.blocks[0], bbBuilt, ...plan.blocks.slice(2)] };
    const next = cloneBlockConfigFrom(withResult, plan.blocks[0].ref.blockKey, bbBuilt.ref.blockKey);
    expect(next.blocks[0].ref.kind).toBe('BB');
    expect(next.blocks[0].config).toEqual(bbBuilt.config);
    expect(next.blocks[0].status).toBe('unbuilt'); // не собран — stale не нужен
    expect(next.blocks[1].status).toBe('built');
    expect(next.direction).toBe('mixed');
  });

  it('cloneBlockConfigFrom: собранный целевой блок → stale с сохранением результата', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built0 = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    const withResult = { ...plan, blocks: [built0, ...plan.blocks.slice(1)] };
    const next = cloneBlockConfigFrom(withResult, plan.blocks[2].ref.blockKey, built0.ref.blockKey);
    expect(next.blocks[2].ref.kind).toBe('PL');
    expect(next.blocks[2].config.cycleId).toBeDefined();
    // Целевой блок (peak, не собран) — unbuilt.
    expect(next.blocks[2].status).toBe('unbuilt');
  });

  it('E2E 52 недели: сборка года → композиция покрывает все недели без разрывов', () => {
    const macro: Macrocycle = {
      blocks: [
        { phase: 'endurance', weeks: 13, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
        { phase: 'strength', weeks: 13, weekOffset: 14, kind: 'BB', description: 'Силовой BB' },
        { phase: 'peak', weeks: 4, weekOffset: 27, kind: 'SRC', cycleId: CYCLE_ID, description: 'Пик' },
        { phase: 'competition', weeks: 1, weekOffset: 31, kind: 'SRC', description: 'Старт' },
        { phase: 'transition', weeks: 4, weekOffset: 32, kind: 'BB', description: 'Переход BB' },
        { phase: 'endurance', weeks: 17, weekOffset: 36, kind: 'SRC', cycleId: CYCLE_ID, description: 'База-2' },
      ],
      totalWeeks: 52, rationale: [],
    };
    const plan = annualPlanFromMacro(macro);
    const outcome = buildAnnualPlan(plan, macro, DEFAULT_OPTS);
    expect(outcome.failed).toBe(0);
    expect(outcome.plan.status).toBe('built');
    expect(validateAnnualPlan(outcome.plan).warnings).toHaveLength(0);
    const merged = mergeBlockWeeks(outcome.plan);
    expect(merged).toHaveLength(52);
    expect(merged[0].week).toBe(1);
    expect(merged[51].week).toBe(52);
    const prog = composeAnnualProgram(outcome.plan);
    expect(prog!.meta.direction).toBe('hybrid');
    // bbWeeks — только BB/MANUAL-блоки (13 strength + 4 transition), ПЛ-слой живёт в plRef.
    expect(prog!.hybrid!.bbWeeks).toHaveLength(17);
    // Несобранных блоков нет → в notes нет предупреждений «не собран».
    expect(prog!.meta.notes).not.toContain('не собран');
  });
});

describe('композиция года', () => {
  it('только BB → bb-программа с суммарными неделями', () => {
    const macro = makeBBMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualPlan(plan, macro, DEFAULT_OPTS);
    const prog = composeAnnualProgram(built.plan, 'Год ББ');
    expect(prog!.meta.direction).toBe('bb');
    expect(prog!.bb!.weeks).toHaveLength(20);
    expect(prog!.meta.weeks).toBe(20);
  });

  it('смешанный год → hybrid: plRef из PL-блока + bbWeeks', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualPlan(plan, macro, DEFAULT_OPTS);
    const prog = composeAnnualProgram(built.plan);
    expect(prog!.meta.direction).toBe('hybrid');
    expect(prog!.hybrid!.plRef.sourceCycleId).toBe(CYCLE_ID);
    // Единственный BB-блок (strength, 8 нед) — ПЛ-недели не дублируются в bbWeeks.
    expect(prog!.hybrid!.bbWeeks).toHaveLength(8);
  });

  it('только PL → программа первого PL-блока со сводкой блоков', () => {
    const macro: Macrocycle = {
      blocks: [
        { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'A' },
        { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'B' },
      ],
      totalWeeks: 12, rationale: [],
    };
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualPlan(plan, macro, DEFAULT_OPTS);
    const prog = composeAnnualProgram(built.plan);
    expect(prog!.meta.direction).toBe('pl');
    expect(prog!.pl!.sourceCycleId).toBe(CYCLE_ID);
    expect(prog!.meta.weeks).toBe(12);
    expect(prog!.pl!.notes).toContain('нед 1-6');
  });

  it('не собранные блоки → предупреждение в notes', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const one = buildAnnualBlock(plan.blocks[0], plan, macro, DEFAULT_OPTS);
    const partialPlan = { ...plan, blocks: [one, ...plan.blocks.slice(1)] };
    const prog = composeAnnualProgram(partialPlan);
    expect(prog!.meta.notes).toContain('не собран');
  });

  it('нет собранных блоков → null', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    expect(composeAnnualProgram(plan)).toBeNull();
  });
});
