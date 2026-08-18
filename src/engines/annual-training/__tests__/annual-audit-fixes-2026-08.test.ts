/**
 * annual-audit-fixes-2026-08.test.ts — регрессионные тесты фиксов аудита
 * годового планировщика (Aug 18 2026):
 *  - P0-1: компактное хранение (bbPlan/program BB не пишутся), размер, quota-событие;
 *  - P1-1: композиция года с несобранными блоками — скелеты вместо обрезки;
 *  - P1-2: пик-неделя BB не режется generic-тапером;
 *  - P1-3: roundtrip длиннее блока — явное предупреждение;
 *  - P2: weekForDate-канон, direction selectPLCycleForBlock, shape-валидация.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  annualPlanFromMacro, buildAnnualPlan, buildAnnualBlock, composeAnnualProgram,
  setAnnualBlockConfig, updateAnnualBlockWeeks, selectPLCycleForBlock,
  weekForDate, annualWeekForDate,
} from '../block-builders.engine';
import {
  ANNUAL_PLAN_KEY, saveAnnualTrainingPlan, loadAnnualTrainingPlan, toStoredPlan,
  annualPlanStorageBytes, saveAnnualScenario, isAnnualTrainingPlanShape,
} from '../annual-training-storage';
import { serializeMacro, deserializeMacro, type Macrocycle, type BBMacrocycle } from '../../lms/macrocycle.engine';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';

const CYCLE_ID = LMS_CYCLES[0]?.meta.id ?? 'cycle_unknown';

const PEAK_CFG = {
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 1,
  showDate: '2026-09-01', weeksOut: 3,
  trainingProtocol: 'bb', carbLoadStrategy: 'moderate',
  waterStrategy: 'minimal', sodiumStrategy: 'constant',
};

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

function makePLMacro(): Macrocycle {
  return {
    blocks: [
      { phase: 'endurance', weeks: 8, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'strength', weeks: 8, weekOffset: 9, kind: 'BB', description: 'Силовой BB' },
      { phase: 'peak', weeks: 2, weekOffset: 17, kind: 'SRC', cycleId: CYCLE_ID, description: 'Пик' },
      { phase: 'competition', weeks: 1, weekOffset: 19, kind: 'SRC', description: 'Старт' },
      { phase: 'transition', weeks: 2, weekOffset: 20, kind: 'SRC', cycleId: CYCLE_ID, description: 'Переход' },
    ],
    totalWeeks: 21,
    rationale: [],
  };
}

const setSets = (w: any): number => w.sessions.reduce((a: number, s: any) => a + s.blocks.reduce((b2: number, bl: any) => b2 + bl.sets.length, 0), 0);

afterEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

describe('P0-1: компактное хранение', () => {
  it('toStoredPlan: bbPlan/program BB-блоков → null, PL program сохраняется', () => {
    const plan = annualPlanFromMacro(makePLMacro());
    const outcome = buildAnnualPlan(plan, makePLMacro(), { daysPerWeek: 4, level: 'intermediate' });
    const stored = toStoredPlan(outcome.plan);
    const bb = stored.blocks.find(b => b.ref.kind === 'BB')!;
    expect(bb.result!.bbPlan).toBeNull();
    expect(bb.result!.program).toBeNull();
    const pl = stored.blocks.find(b => b.ref.kind === 'PL')!;
    expect(pl.result!.program).toBeTruthy();
    expect(pl.result!.program!.pl?.sourceCycleId).toBeTruthy();
  });

  it('save → load roundtrip: компактная форма, план валиден', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    const outcome = buildAnnualPlan(plan, makeBBMacro(), { daysPerWeek: 4, level: 'intermediate' });
    const saved = saveAnnualTrainingPlan(outcome.plan);
    expect(saved.blocks.every(b => b.result && b.result.bbPlan !== null)).toBe(true); // память полная
    const loaded = loadAnnualTrainingPlan();
    expect(loaded).toBeTruthy();
    expect(loaded!.blocks.every(b => !b.result || b.result.bbPlan === null)).toBe(true); // storage компактный
    expect(loaded!.status).toBe('built');
  });

  it('год 52 нед в компактной форме < 2 МБ (было 6.5 МБ)', () => {
    const macro: BBMacrocycle = {
      blocks: [
        { phase: 'hypertrophy', weeks: 20, weekOffset: 1, description: 'A', trainingFocus: 'hypertrophy' },
        { phase: 'strength', weeks: 12, weekOffset: 21, description: 'B', trainingFocus: 'strength' },
        { phase: 'contest_prep', weeks: 12, weekOffset: 33, description: 'C', trainingFocus: 'endurance' },
        { phase: 'transition', weeks: 8, weekOffset: 45, description: 'D', trainingFocus: 'hypertrophy' },
      ],
      totalWeeks: 52,
      trainingFocus: 'hypertrophy',
      rationale: [],
    };
    const outcome = buildAnnualPlan(annualPlanFromMacro(macro), macro, { daysPerWeek: 4, level: 'intermediate' });
    const kb = annualPlanStorageBytes(outcome.plan) / 1024;
    expect(kb).toBeLessThan(2000);
  });

  it('quota: переполнение → план в памяти, событие he-annual-plan-quota-error', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    const outcome = buildAnnualPlan(plan, makeBBMacro(), { daysPerWeek: 4, level: 'intermediate' });
    const fired: boolean[] = [];
    window.addEventListener('he-annual-plan-quota-error', () => fired.push(true), { once: true });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const saved = saveAnnualTrainingPlan(outcome.plan);
    expect(saved.blocks.length).toBe(4); // план остаётся в памяти
    expect(fired.length).toBe(1);
    expect(loadAnnualTrainingPlan()).toBeNull(); // в storage ничего не записалось
  });

  it('saveAnnualScenario хранит компактную форму (bbPlan null)', () => {
    const outcome = buildAnnualPlan(annualPlanFromMacro(makeBBMacro()), makeBBMacro(), { daysPerWeek: 4, level: 'intermediate' });
    saveAnnualScenario(outcome.plan, 'Тест');
    const raw = localStorage.getItem('he_annual_scenarios')!;
    const list = JSON.parse(raw);
    expect(list[0].plan.blocks.every((b: any) => !b.result || b.result.bbPlan === null)).toBe(true);
  });

  it('isAnnualTrainingPlanShape: невалидный kind / дубль blockKey → false', () => {
    const plan = annualPlanFromMacro(makePLMacro());
    expect(isAnnualTrainingPlanShape(plan)).toBe(true);
    const badKind = JSON.parse(JSON.stringify(plan));
    badKind.blocks[0].ref.kind = 'UNKNOWN';
    expect(isAnnualTrainingPlanShape(badKind)).toBe(false);
    const dup = JSON.parse(JSON.stringify(plan));
    dup.blocks[1].ref.blockKey = dup.blocks[0].ref.blockKey;
    expect(isAnnualTrainingPlanShape(dup)).toBe(false);
  });
});

describe('P1-1: композиция года с несобранными блоками', () => {
  it('BB-год: несобранные блоки → скелеты, длина = totalWeeks, предупреждения в notes', () => {
    const macro = makeBBMacro();
    const plan = annualPlanFromMacro(macro);
    const first = buildAnnualBlock(plan.blocks[0], plan, macro, { daysPerWeek: 3, level: 'intermediate' });
    const partial = { ...plan, blocks: plan.blocks.map((b, i) => (i === 0 ? first : b)) };
    const prog = composeAnnualProgram(partial)!;
    expect(prog.meta.weeks).toBe(20);
    expect(prog.bb!.weeks!.length).toBe(20); // длина года НЕ урезана
    expect(prog.meta.notes).toContain('не собран');
    // Скелетные недели пустые, собранные — с контентом.
    const builtSets = setSets(prog.bb!.weeks![0]);
    expect(builtSets).toBeGreaterThan(0);
    expect(setSets(prog.bb!.weeks![8])).toBe(0); // 9-я неделя — скелет блока 2
  });

  it('hybrid: bbWeeks = только не-PL блоки (собранные + скелеты)', () => {
    const macro = makePLMacro();
    const plan = annualPlanFromMacro(macro);
    const bbIdx = plan.blocks.findIndex(b => b.ref.kind === 'BB');
    const plIdx = plan.blocks.findIndex(b => b.ref.kind === 'PL');
    const bb = buildAnnualBlock(plan.blocks[bbIdx], plan, macro, { daysPerWeek: 3, level: 'intermediate' });
    const pl = buildAnnualBlock(plan.blocks[plIdx], plan, macro, { daysPerWeek: 3, level: 'intermediate' });
    const partial = { ...plan, blocks: plan.blocks.map((b, i) => (i === bbIdx ? bb : i === plIdx ? pl : b)) };
    const prog = composeAnnualProgram(partial)!;
    expect(prog.meta.direction).toBe('hybrid');
    expect(prog.hybrid!.bbWeeks!.length).toBe(8); // только BB-блок, без PL
    expect(prog.hybrid!.plRef.sourceCycleId).toBeTruthy();
    expect(prog.meta.notes).toContain('не собран');
  });
});

describe('P1-2: пик-неделя BB не режется generic-тапером', () => {
  it('peak+taper: последняя неделя идентична peak-only (нет двойной резки)', () => {
    const macro = makeBBMacro();
    const plan = annualPlanFromMacro(macro);
    const k = plan.blocks[2].ref.blockKey; // contest_prep
    const onlyPeak = buildAnnualPlan(
      setAnnualBlockConfig(plan, k, { peakWeek: true, peakConfig: PEAK_CFG as unknown as Record<string, unknown> }),
      macro, { daysPerWeek: 4, level: 'intermediate' });
    const both = buildAnnualPlan(
      setAnnualBlockConfig(plan, k, { peakWeek: true, peakConfig: PEAK_CFG as unknown as Record<string, unknown>, taper: { enabled: true, weeks: 2 } }),
      macro, { daysPerWeek: 4, level: 'intermediate' });
    const bPeak = onlyPeak.plan.blocks.find(b => b.ref.blockKey === k)!;
    const bBoth = both.plan.blocks.find(b => b.ref.blockKey === k)!;
    const lastPeak = bPeak.result!.weeks[bPeak.result!.weeks.length - 1];
    const lastBoth = bBoth.result!.weeks[bBoth.result!.weeks.length - 1];
    expect(setSets(lastBoth)).toBe(setSets(lastPeak)); // пик-неделя НЕ тронута тапером
    expect(bBoth.result!.warnings.some(w => w.includes('не применён'))).toBe(true);
    expect(bBoth.result!.taperApplied).toBe(false);
    // Без пика generic-taper работает как раньше.
    const onlyTaper = buildAnnualPlan(
      setAnnualBlockConfig(plan, k, { taper: { enabled: true, weeks: 2 } }),
      macro, { daysPerWeek: 4, level: 'intermediate' });
    const bTaper = onlyTaper.plan.blocks.find(b => b.ref.blockKey === k)!;
    expect(bTaper.result!.taperApplied).toBe(true);
  });
});

describe('P1-3: roundtrip длиннее блока — явное предупреждение', () => {
  it('12 недель в 8-нед блок → warning + обрезка до 8 (не молча)', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    const k = plan.blocks[0].ref.blockKey;
    const wide = Array.from({ length: 12 }, (_, i) => ({
      week: i + 1, phase: 'accumulation' as const, deload: false,
      sessions: [{ id: 's' + i, name: 'День', dayOfWeek: 0, focus: '', blocks: [{ id: 'b' + i, type: 'compound' as const, exerciseName: 'X', muscle: '', role: 'primary' as const, sets: [{ reps: 10, rir: 2 }] }] }],
    }));
    const next = updateAnnualBlockWeeks(plan, k, wide);
    const got = next.blocks.find(b => b.ref.blockKey === k)!;
    expect(got.result!.weeks.length).toBe(8);
    expect(got.result!.warnings.some(w => w.includes('длиннее блока'))).toBe(true);
  });

  it('4 недели в 8-нед блок → warning о короткой программе', () => {
    const plan = annualPlanFromMacro(makeBBMacro());
    const k = plan.blocks[0].ref.blockKey;
    const short = Array.from({ length: 4 }, (_, i) => ({
      week: i + 1, phase: 'accumulation' as const, deload: false, sessions: [],
    }));
    const next = updateAnnualBlockWeeks(plan, k, short);
    const got = next.blocks.find(b => b.ref.blockKey === k)!;
    expect(got.result!.weeks.length).toBe(8);
    expect(got.result!.warnings.some(w => w.includes('короче блока'))).toBe(true);
  });
});

describe('P2: канон и валидации', () => {
  it('weekForDate — единая реализация (алиас annualWeekForDate)', () => {
    expect(weekForDate('2026-01-08', '2026-01-01')).toBe(2);
    expect(annualWeekForDate('2026-01-08', '2026-01-01')).toBe(2);
    expect(weekForDate('не дата', '2026-01-01')).toBeNull();
  });

  it('selectPLCycleForBlock: default подбирает strength-циклы; general — любые', () => {
    const strengthOnly = selectPLCycleForBlock(undefined, 'endurance', 8, 'intermediate');
    const cycle = LMS_CYCLES.find(c => c.meta.id === strengthOnly.cycleId)!;
    expect(normalizeCycleDirection(cycle.meta.direction)).toBe('strength');
    const general = selectPLCycleForBlock(undefined, 'endurance', 8, 'intermediate', true, 'general');
    expect(general.cycleId).toBeTruthy();
    const byDir = LMS_CYCLES.find(c => c.meta.id === general.cycleId)!;
    // general может выбрать и не-strength (в каталоге есть non-strength endurance-циклы).
    expect(normalizeCycleDirection(byDir.meta.direction)).toBeTruthy();
  });

  it('сериализация макро с соревнованием переживает roundtrip (регрессия storage)', () => {
    const macro = makePLMacro();
    macro.competitions = [{ id: 'c1', name: 'Шоу', week: 19, priority: 'A' }];
    const s = serializeMacro(macro);
    const back = deserializeMacro(s)!;
    expect(back.competitions?.length).toBe(1);
    expect(back.blocks.length).toBe(5);
  });
});
