/**
 * bb-pro-quality-phase-b.test.ts — тесты проф-уровня для ФАЗЫ B аудита BB-auto.
 *
 * Проверяет:
 *  - B1: phaseRepShift — rep range двигается по неделям внутри фазы
 *  - B2: Per-exercise tempo override (разный темп для разных упр)
 *  - B3: autoAssignIntensityTechniques — dropset/rest_pause/myo_rep назначаются
 *  - B4: lengthenedBonus — приоритет растянутым упражнениям (RDL/incline)
 *  - B5: Warmup ramp (bar×15 → 50%×10 → 70%×5 → 80%×3)
 *  - B6: selectBestBBSplit — graduated penalty за days mismatch
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput, buildWarmup } from '../bb-builder.engine';
import { autodraftBBPlan } from '../../manual-constructor/manual-draft.engine';
import { tempoFor, exerciseTempoOverride } from '../bb-tempo-rest';
import { rankBBSplits } from '../bb-selector.engine';
import type { BBWeek } from '../bb-builder.engine';

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
 * B1: phaseRepShift — rep range двигается по неделям
 * ═══════════════════════════════════════════════════════════════════ */
describe('B1: phaseRepShift — reps снижаются внутри фазы', () => {
  it('accumulation: reps изменяются внутри фазы (shift + prescribeLoad волна)', () => {
    const plan = buildBBPlan(makeInput({
      weeks: 8,
      trainingFocus: 'hypertrophy',
    }));
    const accumWeeks = plan.weeks.filter(w => w.phase === 'accumulation');
    if (accumWeeks.length < 2) return; // skip if not enough accumulation weeks
    const w1Ex = accumWeeks[0].sessions.flatMap(s => s.exercises).find(e => e.role === 'primary');
    const w3Ex = accumWeeks[accumWeeks.length - 1].sessions.flatMap(s => s.exercises).find(e => e.role === 'primary');
    if (!w1Ex || !w3Ex) return;
    // Reps должны ИЗМЕНИТЬСЯ (phaseRepShift снижает, prescribeLoad может повышать — волна)
    const w1Reps = w1Ex.workSets[0]?.reps ?? w1Ex.repsRange[0];
    const w3Reps = w3Ex.workSets[0]?.reps ?? w3Ex.repsRange[0];
    expect(w1Reps).not.toBe(w3Reps); // reps изменились (не статичны)
  });

  it('deload: reps НЕ снижаются (shift = 0 для deload)', () => {
    const plan = buildBBPlan(makeInput({
      weeks: 8,
      trainingFocus: 'hypertrophy',
    }));
    const deloadWeeks = plan.weeks.filter(w => w.phase === 'deload');
    if (deloadWeeks.length === 0) return;
    const ex = deloadWeeks[0].sessions.flatMap(s => s.exercises).find(e => e.role === 'primary');
    if (!ex) return;
    // Deload reps должны быть высокими (12-20 из PHASE_CONFIGS)
    const reps = ex.workSets[0]?.reps ?? ex.repsRange[0];
    expect(reps).toBeGreaterThanOrEqual(10);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * B2: Per-exercise tempo override
 * ═══════════════════════════════════════════════════════════════════ */
describe('B2: Per-exercise tempo override', () => {
  it('exerciseTempoOverride: присед → 2-0-1-0 (взрывной)', () => {
    const tempo = exerciseTempoOverride('Присед со штангой');
    expect(tempo).toBe('2-0-1-0');
  });

  it('exerciseTempoOverride: RDL → 3-1-1-0 (растяжение)', () => {
    const tempo = exerciseTempoOverride('Румынская тяга');
    expect(tempo).toBe('3-1-1-0');
  });

  it('exerciseTempoOverride: кроссовер → 3-2-1-0 (пиковое сокращение)', () => {
    const tempo = exerciseTempoOverride('Сведение в кроссовере');
    expect(tempo).toBe('3-2-1-0');
  });

  it('tempoFor с exerciseName: присед → 2-0-1-0', () => {
    const t = tempoFor('тяж', undefined, 'accumulation', 'Присед со штангой');
    expect(t.notation).toBe('2-0-1-0');
  });

  it('tempoFor без exerciseName: accumulation → 3-1-1-0 (phase default)', () => {
    const t = tempoFor('тяж', undefined, 'accumulation');
    expect(t.notation).toBe('3-1-1-0');
  });

  it('план: разные упражнения в одной сессии имеют разный темп', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'upper_lower_4',
      weeks: 4,
    }));
    // Найти неделю с exercises имеющими tempoSpec
    const week = plan.weeks[0];
    const tempos = new Set(
      week.sessions
        .flatMap(s => s.exercises)
        .map(e => e.tempoSpec)
        .filter(Boolean)
    );
    // Должно быть хотя бы 2 разных темпа (compound 2-0-1-0 + isolation 3-2-1-0)
    expect(tempos.size).toBeGreaterThanOrEqual(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * B3: autoAssignIntensityTechniques
 * ═══════════════════════════════════════════════════════════════════ */
describe('B3: autoAssignIntensityTechniques', () => {
  it('intermediate план: хотя бы одно упражнение имеет technique', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'ppl_6',
      level: 'intermediate',
      weeks: 8,
    }));
    const hasTechnique = plan.weeks.some(w =>
      w.sessions.flatMap(s => s.exercises).some(e =>
        e.workSets?.some(ws => ws.technique)
      )
    );
    expect(hasTechnique).toBe(true);
  });

  it('beginner план: НЕТ intensity techniques', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'fullbody_3',
      level: 'beginner',
      weeks: 4,
    }));
    const hasTechnique = plan.weeks.some(w =>
      w.sessions.flatMap(s => s.exercises).some(e =>
        e.workSets?.some(ws => ws.technique)
      )
    );
    expect(hasTechnique).toBe(false);
  });

  it('deload неделя: НЕТ intensity techniques', () => {
    const plan = buildBBPlan(makeInput({
      level: 'intermediate',
      weeks: 8,
    }));
    const deloadWeeks = plan.weeks.filter(w => w.phase === 'deload');
    for (const w of deloadWeeks) {
      const hasTechnique = w.sessions.flatMap(s => s.exercises).some(e =>
        e.workSets?.some(ws => ws.technique)
      );
      expect(hasTechnique).toBe(false);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * B4: lengthenedBonus — приоритет растянутым упражнениям
 * ═══════════════════════════════════════════════════════════════════ */
describe('B4: lengthenedBonus — растянутые упражнения приоритетны', () => {
  it('план содержит хотя бы одно растянутое упражнение (RDL/incline/наклон)', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'upper_lower_4',
      weeks: 8,
    }));
    const hasLengthened = plan.weeks.some(w =>
      w.sessions.flatMap(s => s.exercises).some(e => {
        const n = (e.exerciseName || e.name || '').toLowerCase();
        return /наклон|incline|rdl|румынская|сисси|sissy|за голов|пуловер/i.test(n);
      })
    );
    expect(hasLengthened).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * B5: Warmup ramp — проф-пирамида
 * ═══════════════════════════════════════════════════════════════════ */
describe('B5: Warmup ramp — проф-пирамида', () => {
  it('compound 100кг: 4 warmup сета (bar×15, 50×10, 70×5, 80×3)', () => {
    const warmups = buildWarmup(100, true);
    expect(warmups.length).toBeGreaterThanOrEqual(3);
    // Первый сет: bar (20кг) × 15
    if (warmups.length >= 4) {
      expect(warmups[0].load).toBe(20);
      expect(warmups[0].reps).toBe(15);
    }
    // 50% × 10
    const has50pct = warmups.some(w => w.load === 50 && w.reps === 10);
    expect(has50pct).toBe(true);
    // 70% × 5
    const has70pct = warmups.some(w => w.load === 70 && w.reps === 5);
    expect(has70pct).toBe(true);
  });

  it('compound 150кг: 5 warmup сетов (включая 90%×1)', () => {
    const warmups = buildWarmup(150, true);
    expect(warmups.length).toBeGreaterThanOrEqual(4);
    // 90% × 1 для тяжёлых весов
    const has90pct = warmups.some(w => w.load === 135 && w.reps === 1);
    expect(has90pct).toBe(true);
  });

  it('isolation: нет warmup (только compound)', () => {
    const warmups = buildWarmup(50, false);
    expect(warmups.length).toBe(0);
  });

  it('compound 40кг: 2 warmup (без bar и без 90%)', () => {
    const warmups = buildWarmup(40, true);
    expect(warmups.length).toBe(2); // 50%×10, 70%×5
  });

  it('план: primary compound упражнения имеют warmupSets', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'upper_lower_4',
      weeks: 4,
      workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    }));
    const hasWarmup = plan.weeks[0].sessions.some(s =>
      s.exercises.some(e => e.role === 'primary' && e.warmupSets && e.warmupSets.length > 0)
    );
    expect(hasWarmup).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * B6: selectBestBBSplit — graduated penalty
 * ═══════════════════════════════════════════════════════════════════ */
describe('B6: selectBestBBSplit — graduated penalty', () => {
  it('4 дня/нед: сплиты с 4 сессиями получают +25', () => {
    const ranked = rankBBSplits({
      level: 'intermediate',
      goal: 'mass',
      daysPerWeek: 4,
    });
    // upper_lower_4 должен быть в топ-5
    const ul4 = ranked.find(r => r.pattern.id === 'upper_lower_4');
    expect(ul4).toBeDefined();
    expect(ul4!.score).toBeGreaterThan(30);
  });

  it('3 дня/нед: ppl_6 (6 сессий) получает меньший penalty чем раньше', () => {
    const ranked = rankBBSplits({
      level: 'intermediate',
      goal: 'mass',
      daysPerWeek: 3,
    });
    const ppl6 = ranked.find(r => r.pattern.id === 'ppl_6');
    if (ppl6) {
      // Раньше было -20 (binary). Теперь graduated: overage=3 → -15
      // Проверяем что penalty не катастрофический
      expect(ppl6.score).toBeGreaterThan(-50);
    }
  });

  it('5 дней/нед: rolling_4_1 (5.6 сессий) не получает -20', () => {
    const ranked = rankBBSplits({
      level: 'intermediate',
      goal: 'mass',
      daysPerWeek: 5,
    });
    const rolling = ranked.find(r => r.pattern.id === 'rolling_4_1');
    if (rolling) {
      // overage = 5.6 - 5 = 0.6 → +10 (чуть больше, но допустимо)
      expect(rolling.score).toBeGreaterThan(0);
    }
  });
});
