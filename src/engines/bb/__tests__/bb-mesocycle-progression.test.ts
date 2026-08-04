/**
 * bb-mesocycle-progression.test.ts — тесты cross-mesocycle continuity.
 *
 * Проверяет:
 *  - extractMesocycleProgression: извлечение peak weights, volume, exercises из предыдущего плана
 *  - applyWeightProgression: веса +2.5/5 кг в зависимости от level
 *  - applyVolumeProgression: +1-2 сета per muscle
 *  - wasInPreviousMeso: проверка ротации упражнений
 *  - buildBBPlan с previousPlan: веса и объём прогрессируют
 *  - needsDeload: длинный/объёмный предыдущий план → рекомендация deload
 */
import { describe, expect, it } from 'vitest';
import {
  extractMesocycleProgression,
  applyWeightProgression,
  applyVolumeProgression,
  wasInPreviousMeso,
} from '../bb-mesocycle-progression.engine';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from '../bb-builder.engine';

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

function makeMockPreviousPlan(): BBPlan {
  // Создаём минимальный mock предыдущего плана
  const plan = buildBBPlan(makeInput({ weeks: 8 }));
  return plan;
}

/* ═══════════════════════════════════════════════════════════════════
 * Section A: extractMesocycleProgression
 * ═══════════════════════════════════════════════════════════════════ */
describe('A: extractMesocycleProgression', () => {
  it('извлекает peakWeights из предыдущего плана', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    expect(Object.keys(prog.peakWeights).length).toBeGreaterThan(0);
    // Chest должен иметь peak weight > 0
    expect(prog.peakWeights['chest']).toBeGreaterThan(0);
  });

  it('извлекает previousVolume (per-muscle total sets)', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    expect(Object.keys(prog.previousVolume).length).toBeGreaterThan(0);
    expect(prog.previousVolume['chest']).toBeGreaterThan(0);
  });

  it('извлекает previousExercises (имена)', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    expect(prog.previousExercises.length).toBeGreaterThan(0);
  });

  it('intermediate + mass → weightDelta = 2.5 кг', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    for (const muscle of Object.keys(prog.peakWeights)) {
      expect(prog.weightProgression[muscle]).toBe(2.5);
    }
  });

  it('enhanced + mass → weightDelta = 5 кг', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'enhanced', 'mass');
    for (const muscle of Object.keys(prog.peakWeights)) {
      expect(prog.weightProgression[muscle]).toBe(5);
    }
  });

  it('cut → weightDelta = 0 (сохранение, не рост)', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'cut');
    for (const muscle of Object.keys(prog.peakWeights)) {
      expect(prog.weightProgression[muscle]).toBe(0);
    }
  });

  it('volumeDelta: intermediate + mass → +1 сет', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    for (const muscle of Object.keys(prog.previousVolume)) {
      expect(prog.volumeDelta[muscle]).toBe(1);
    }
  });

  it('enhanced + mass → +2 сета', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'enhanced', 'mass');
    for (const muscle of Object.keys(prog.previousVolume)) {
      expect(prog.volumeDelta[muscle]).toBe(2);
    }
  });

  it('needsDeload: план ≥12 нед → true', () => {
    const prev = buildBBPlan(makeInput({ weeks: 12 }));
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    expect(prog.needsDeload).toBe(true);
  });

  it('needsDeload: план 8 нед → false', () => {
    const prev = buildBBPlan(makeInput({ weeks: 8 }));
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    expect(prog.needsDeload).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section B: applyWeightProgression
 * ═══════════════════════════════════════════════════════════════════ */
describe('B: applyWeightProgression', () => {
  it('пустой workMax → заполняется из peakWeights + delta', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    const result = applyWeightProgression({}, prog);
    expect(result['chest']).toBeGreaterThan(0);
    // peak + 2.5
    expect(result['chest']).toBeCloseTo(prog.peakWeights['chest'] + 2.5, 1);
  });

  it('существующий workMax не снижается', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    const result = applyWeightProgression({ chest: 200 }, prog);
    // 200 > peak + 2.5 → остаётся 200
    expect(result['chest']).toBe(200);
  });

  it('progression повышает вес при peak < workMax', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    const result = applyWeightProgression({ chest: 50 }, prog);
    // 50 < peak + 2.5 → повышается до peak + 2.5
    expect(result['chest']).toBeGreaterThan(50);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section C: applyVolumeProgression
 * ═══════════════════════════════════════════════════════════════════ */
describe('C: applyVolumeProgression', () => {
  it('base + delta = target volume', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    const result = applyVolumeProgression('chest', 20, prog);
    expect(result).toBe(21); // 20 + 1
  });

  it('unknown muscle → base (no delta)', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    const result = applyVolumeProgression('unknown_muscle', 20, prog);
    expect(result).toBe(20);
  });

  it('enhanced → +2 сета', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'enhanced', 'mass');
    const result = applyVolumeProgression('chest', 20, prog);
    expect(result).toBe(22); // 20 + 2
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section D: wasInPreviousMeso
 * ═══════════════════════════════════════════════════════════════════ */
describe('D: wasInPreviousMeso — exercise rotation', () => {
  it('упражнение из предыдущего мезо → true', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    // Берём первое упражнение из previousExercises
    const exName = prog.previousExercises[0];
    expect(wasInPreviousMeso(exName, prog)).toBe(true);
  });

  it('новое упражнение → false', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    expect(wasInPreviousMeso('Совершенно новое упражнение', prog)).toBe(false);
  });

  it('partial match → true (Жим лёжа vs Жим штанги лёжа)', () => {
    const prev = makeMockPreviousPlan();
    const prog = extractMesocycleProgression(prev, 'intermediate', 'mass');
    // Если в previousExercises есть "Жим штанги лёжа", то "Жим лёжа" должен match
    if (prog.previousExercises.some(e => e.toLowerCase().includes('жим'))) {
      expect(wasInPreviousMeso('Жим', prog)).toBe(true);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section E: buildBBPlan с previousPlan — интеграция
 * ═══════════════════════════════════════════════════════════════════ */
describe('E: buildBBPlan с previousPlan', () => {
  it('план с previousPlan генерируется без crash', () => {
    const prev = makeMockPreviousPlan();
    const plan = buildBBPlan(makeInput({ previousPlan: prev }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });

  it('план с previousPlan содержит cross-mesocycle rationale', () => {
    const prev = makeMockPreviousPlan();
    const plan = buildBBPlan(makeInput({ previousPlan: prev }));
    const hasCrossMeso = plan.rationale.some(r => r.includes('Cross-mesocycle'));
    expect(hasCrossMeso).toBe(true);
  });

  it('план без previousPlan НЕ содержит cross-mesocycle rationale', () => {
    const plan = buildBBPlan(makeInput());
    const hasCrossMeso = plan.rationale.some(r => r.includes('Cross-mesocycle'));
    expect(hasCrossMeso).toBe(false);
  });

  it('веса с previousPlan ≥ веса без previousPlan (progression)', () => {
    const prev = makeMockPreviousPlan();
    const withPrev = buildBBPlan(makeInput({
      previousPlan: prev,
      workMax: { chest: 50, back: 60, legs: 70, shoulders: 40, arms: 30 },
    }));
    const withoutPrev = buildBBPlan(makeInput({
      workMax: { chest: 50, back: 60, legs: 70, shoulders: 40, arms: 30 },
    }));
    // С previousPlan веса должны быть ≥ (peak + delta > 50 → повышаются)
    const wPrevWeight = withPrev.weeks[0].sessions[0].exercises[0]?.workSets?.[0]?.weight || 0;
    const woPrevWeight = withoutPrev.weeks[0].sessions[0].exercises[0]?.workSets?.[0]?.weight || 0;
    // Если peak > 50, то withPrev получит peak + 2.5, без prev — 50
    expect(wPrevWeight).toBeGreaterThanOrEqual(woPrevWeight);
  });

  it('needsDeload → rationale содержит предупреждение', () => {
    const prev = buildBBPlan(makeInput({ weeks: 12 }));
    const plan = buildBBPlan(makeInput({ previousPlan: prev, weeks: 8 }));
    const hasDeloadWarning = plan.rationale.some(r => r.includes('рекомендуется deload'));
    expect(hasDeloadWarning).toBe(true);
  });
});
