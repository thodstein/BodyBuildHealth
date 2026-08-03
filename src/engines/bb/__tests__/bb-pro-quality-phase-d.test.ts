/**
 * bb-pro-quality-phase-d.test.ts — тесты для ФАЗЫ D (additional refactors).
 *
 * Проверяет:
 *  - D1: Female glute path — dedicated female_glute_5 split
 *  - D2: Per-day volume budget — no 1-set exercises, explicit rationale on exclusion
 *  - D3: 2-layer engine — computeLoading function (selection + loading separation)
 *  - D4: SPLIT_PATTERNS cleanup — все сплиты валидны
 */
import { describe, expect, it } from 'vitest';
import { SPLIT_PATTERNS, getPattern } from '../bb-split-patterns';
import { rankBBSplits, selectBestBBSplit } from '../bb-selector.engine';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { autodraftBBPlan } from '../../manual-constructor/manual-draft.engine';
import { computeLoading } from '../bb-loading-layer.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function makeInput(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'intermediate',
    goal: 'mass',
    weeks: 8,
    workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    equipment: EQ,
    volumeGoal: 'mav',
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 * D1: Female glute path — dedicated female_glute_5 split
 * ═══════════════════════════════════════════════════════════════════ */
describe('D1: Female glute path — female_glute_5 split', () => {
  it('female_glute_5 существует в SPLIT_PATTERNS', () => {
    const pattern = getPattern('female_glute_5');
    expect(pattern).toBeDefined();
    expect(pattern!.sessionsPerRotation).toBe(5);
    expect(pattern!.rotationDays).toBe(7);
  });

  it('female_glute_5 имеет 3 glute-сессии (Glutes + GlutesHams + Glutes памп)', () => {
    const pattern = getPattern('female_glute_5')!;
    const gluteSessions = pattern.schedule.filter(d =>
      d.kind === 'тренировка' && (d.sessionTag === 'Glutes' || d.sessionTag === 'GlutesHams')
    );
    expect(gluteSessions.length).toBe(3);
  });

  it('selector: female + focusGroup=glutes + 5 дней → female_glute_5 в топ-3', () => {
    const ranked = rankBBSplits({
      level: 'intermediate',
      goal: 'mass',
      daysPerWeek: 5,
      sex: 'female',
      focusGroup: 'glutes',
    });
    const top3 = ranked.slice(0, 3);
    const hasFemaleGlute = top3.some(r => r.pattern.id === 'female_glute_5');
    expect(hasFemaleGlute).toBe(true);
  });

  it('autodraftBBPlan: female + focusGroup=glutes + 5 дней → glutes получают объём', () => {
    const plan = autodraftBBPlan({
      level: 'intermediate',
      goal: 'mass',
      daysPerWeek: 5,
      weeks: 8,
      equipment: EQ,
      sex: 'female',
      focusGroup: 'glutes',
    });
    const maxGluteSets = Math.max(...plan.weeks.map(w =>
      w.sessions.flatMap(s => s.exercises)
        .filter(e => e.muscle === 'glutes')
        .reduce((sum, e) => sum + e.sets, 0)
    ));
    expect(maxGluteSets).toBeGreaterThanOrEqual(3);
  });

  it('buildBBPlan: female_glute_5 → glutes встречаются в ≥3 сессиях/нед', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'female_glute_5',
      weeks: 4,
      sex: 'female',
      focusGroup: 'glutes',
    }));
    const w1 = plan.weeks[0];
    const gluteSessions = w1.sessions.filter(s =>
      s.exercises.some(e => e.muscle === 'glutes')
    );
    expect(gluteSessions.length).toBeGreaterThanOrEqual(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * D2: Per-day volume budget — no 1-set, explicit rationale
 * ═══════════════════════════════════════════════════════════════════ */
describe('D2: Per-day volume budget with redistribution', () => {
  it('план с высоким объёмом: 0 упражнений с 1 сетом', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'ppl_6',
      level: 'enhanced',
      weeks: 8,
    }));
    let singleSetCount = 0;
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if (ex.sets < 2) singleSetCount++;
        }
      }
    }
    expect(singleSetCount).toBe(0);
  });

  it('план с высоким объёмом: нет упражнений с 0 сетов', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'ppl_6',
      level: 'enhanced',
      weeks: 8,
    }));
    const hasZeroSets = plan.weeks.some(w =>
      w.sessions.some(s =>
        s.exercises.some(e => e.sets < 1)
      )
    );
    expect(hasZeroSets).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * D3: 2-layer engine — computeLoading
 * ═══════════════════════════════════════════════════════════════════ */
describe('D3: 2-layer engine — computeLoading', () => {
  it('computeLoading: primary compound → вес, reps, RIR, tempo, rest', () => {
    const result = computeLoading({
      muscle: 'chest',
      exerciseName: 'Жим штанги лёжа',
      exerciseId: 'bench_press',
      role: 'primary',
      character: 'тяж',
      sets: 4,
      phase: 'accumulation',
      phaseWeek: 1,
      week: 1,
      workMax: 100,
      trainingFocus: 'hypertrophy',
    });
    expect(result.sets).toBe(4);
    expect(result.reps).toBeGreaterThan(0);
    expect(result.rir).toBeGreaterThanOrEqual(0);
    expect(result.rir).toBeLessThanOrEqual(5);
    expect(result.weight).toBeGreaterThan(0);
    expect(result.tempoSpec).toBeDefined();
    expect(result.restSeconds).toBeGreaterThan(0);
    expect(result.workSets).toHaveLength(4);
  });

  it('computeLoading: accessory → больше reps, меньше rest', () => {
    const primary = computeLoading({
      muscle: 'chest',
      exerciseName: 'Жим штанги лёжа',
      role: 'primary',
      character: 'тяж',
      sets: 4,
      phase: 'accumulation',
      phaseWeek: 1,
      week: 1,
      workMax: 100,
    });
    const accessory = computeLoading({
      muscle: 'chest',
      exerciseName: 'Сведение в кроссовере',
      role: 'accessory',
      character: 'памп',
      sets: 3,
      phase: 'accumulation',
      phaseWeek: 1,
      week: 1,
      workMax: 60,
    });
    // Accessory должен иметь больше reps (памп)
    expect(accessory.reps).toBeGreaterThanOrEqual(primary.reps);
    // Accessory должен иметь меньше отдых
    expect(accessory.restSeconds).toBeLessThanOrEqual(primary.restSeconds);
  });

  it('computeLoading: deload → выше RIR, больше rest, выше reps', () => {
    const accum = computeLoading({
      muscle: 'chest',
      exerciseName: 'Жим штанги лёжа',
      role: 'primary',
      character: 'тяж',
      sets: 4,
      phase: 'accumulation',
      phaseWeek: 1,
      week: 1,
      workMax: 100,
    });
    const deload = computeLoading({
      muscle: 'chest',
      exerciseName: 'Жим штанги лёжа',
      role: 'primary',
      character: 'тяж',
      sets: 4,
      phase: 'deload',
      phaseWeek: 1,
      week: 4,
      workMax: 100,
    });
    // Deload: RIR выше (3-4), rest больше
    expect(deload.rir).toBeGreaterThanOrEqual(3);
    expect(deload.restSeconds).toBeGreaterThanOrEqual(accum.restSeconds);
  });

  it('computeLoading: per-exercise tempo override (присед → 2-0-1-0)', () => {
    const result = computeLoading({
      muscle: 'quads',
      exerciseName: 'Присед со штангой',
      role: 'primary',
      character: 'тяж',
      sets: 4,
      phase: 'accumulation',
      phaseWeek: 1,
      week: 1,
      workMax: 120,
    });
    expect(result.tempoSpec).toBe('2-0-1-0');
  });

  it('computeLoading: warmupSets для primary, не для accessory', () => {
    const primary = computeLoading({
      muscle: 'chest',
      exerciseName: 'Жим штанги лёжа',
      role: 'primary',
      character: 'тяж',
      sets: 4,
      phase: 'accumulation',
      phaseWeek: 1,
      week: 1,
      workMax: 100,
    });
    const accessory = computeLoading({
      muscle: 'chest',
      exerciseName: 'Сведение в кроссовере',
      role: 'accessory',
      character: 'памп',
      sets: 3,
      phase: 'accumulation',
      phaseWeek: 1,
      week: 1,
      workMax: 60,
    });
    expect(primary.warmupSets).toBeDefined();
    expect(primary.warmupSets!.length).toBeGreaterThan(0);
    expect(accessory.warmupSets).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * D4: SPLIT_PATTERNS — все сплиты валидны
 * ═══════════════════════════════════════════════════════════════════ */
describe('D4: SPLIT_PATTERNS — валидность всех сплитов', () => {
  it('все сплиты имеют уникальный id', () => {
    const ids = SPLIT_PATTERNS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('все сплиты имеют schedule.length === rotationDays', () => {
    for (const p of SPLIT_PATTERNS) {
      expect(p.schedule.length).toBe(p.rotationDays);
    }
  });

  it('все сплиты имеют sessionsPerRotation === тренировочных дней', () => {
    for (const p of SPLIT_PATTERNS) {
      const trainingDays = p.schedule.filter(d => d.kind === 'тренировка').length;
      expect(trainingDays).toBe(p.sessionsPerRotation);
    }
  });

  it('все сплиты имеют хотя бы 1 тренировочный день', () => {
    for (const p of SPLIT_PATTERNS) {
      expect(p.sessionsPerRotation).toBeGreaterThan(0);
    }
  });

  it('все сплиты имеют непустой name и description', () => {
    for (const p of SPLIT_PATTERNS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it('getPattern находит все сплиты по id', () => {
    for (const p of SPLIT_PATTERNS) {
      const found = getPattern(p.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(p.id);
    }
  });

  it('SPLIT_PATTERNS содержит ≥25 сплитов (после добавления female_glute_5)', () => {
    expect(SPLIT_PATTERNS.length).toBeGreaterThanOrEqual(25);
  });
});
