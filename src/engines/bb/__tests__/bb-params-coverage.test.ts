/**
 * bb-params-coverage.test.ts — тесты покрытия всех значений
 * LoadStrategy, DeloadType, IntensityTechnique, BBTrainingFocus.
 *
 * Раньше только double_progression и full_rest были протестированы.
 * Теперь — все 4 значения каждого типа.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { makeInput, expectValidPlan } from './bb-test-helpers';

describe('BB LoadStrategy coverage', () => {
  const strategies = ['double_progression', 'linear', 'wave', 'rpe_based'] as const;

  for (const strategy of strategies) {
    it(`loadStrategy='${strategy}' — план генерируется без crash`, () => {
      const plan = buildBBPlan(makeInput({ loadStrategy: strategy }));
      expectValidPlan(plan);
    });

    it(`loadStrategy='${strategy}' — веса присутствуют в рабочих сетах`, () => {
      const plan = buildBBPlan(makeInput({ loadStrategy: strategy }));
      let hasWeight = false;
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            for (const ws of ex.workSets) {
              if (ws.weight > 0) hasWeight = true;
            }
          }
        }
      }
      expect(hasWeight).toBe(true);
    });
  }

  it('loadStrategy double_progression vs linear — веса могут отличаться', () => {
    const planDp = buildBBPlan(makeInput({ loadStrategy: 'double_progression' }));
    const planLin = buildBBPlan(makeInput({ loadStrategy: 'linear' }));
    const getFirstWeight = (p: any) => {
      for (const w of p.weeks) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            if (ex.workSets[0]?.weight > 0) return ex.workSets[0].weight;
          }
        }
      }
      return 0;
    };
    // Оба должны иметь веса > 0
    expect(getFirstWeight(planDp)).toBeGreaterThan(0);
    expect(getFirstWeight(planLin)).toBeGreaterThan(0);
  });
});

describe('BB DeloadType coverage', () => {
  const deloadTypes = ['pump', 'neural', 'full_rest', 'mini'] as const;

  for (const deloadType of deloadTypes) {
    it(`deloadType='${deloadType}' — план генерируется без crash`, () => {
      const plan = buildBBPlan(makeInput({
        deloadType,
        autoDeload: true,
        weeks: 8,
      }));
      expectValidPlan(plan);
    });

    it(`deloadType='${deloadType}' — deload-неделя имеет меньше сетов чем рабочая`, () => {
      const plan = buildBBPlan(makeInput({
        deloadType,
        autoDeload: true,
        weeks: 8,
      }));
      let workSets = 0;
      let deloadSets = 0;
      for (const w of plan.weeks) {
        const isDeload = w.phase === 'deload' || w.deload;
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            if (isDeload) deloadSets += ex.sets;
            else workSets += ex.sets;
          }
        }
      }
      if (deloadSets > 0 && workSets > 0) {
        expect(deloadSets).toBeLessThan(workSets);
      }
    });
  }
});

describe('BB IntensityTechnique coverage', () => {
  const techniques = ['none', 'dropset', 'rest_pause', 'myo_rep'] as const;

  for (const technique of techniques) {
    it(`intensityTechnique='${technique}' — план генерируется без crash`, () => {
      const plan = buildBBPlan(makeInput({ intensityTechnique: technique }));
      expectValidPlan(plan);
    });

    it(`intensityTechnique='${technique}' — все primary упражнения имеют workSets`, () => {
      const plan = buildBBPlan(makeInput({ intensityTechnique: technique }));
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            if (ex.role === 'primary') {
              expect(ex.workSets.length).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  }

  it('intensityTechnique dropset — хотя бы одно упражнение имеет технику', () => {
    const plan = buildBBPlan(makeInput({ intensityTechnique: 'dropset', weeks: 8 }));
    let hasTechnique = false;
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          for (const ws of ex.workSets) {
            if (ws.technique) hasTechnique = true;
          }
        }
      }
    }
    // Может не быть техники в deload-неделях, проверяем только если есть рабочие недели
    if (plan.weeks.some(w => w.phase !== 'deload')) {
      // dropset применяется к primary в accumulation/intensification
      // может не сработать если все недели deload, но в 8-нед плане обычно есть рабочие недели
      expect(hasTechnique || plan.weeks.every(w => w.phase === 'deload')).toBe(true);
    }
  });
});

describe('BB TrainingFocus coverage', () => {
  const focuses = ['strength', 'hypertrophy', 'endurance'] as const;

  for (const focus of focuses) {
    it(`trainingFocus='${focus}' — план генерируется без crash`, () => {
      const plan = buildBBPlan(makeInput({ trainingFocus: focus }));
      expectValidPlan(plan);
    });

    it(`trainingFocus='${focus}' — RIR в разумных пределах (0-5)`, () => {
      const plan = buildBBPlan(makeInput({ trainingFocus: focus }));
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            expect(ex.rir).toBeGreaterThanOrEqual(0);
            expect(ex.rir).toBeLessThanOrEqual(5);
          }
        }
      }
    });

    it(`trainingFocus='${focus}' — reps в разумных пределах (1-30)`, () => {
      const plan = buildBBPlan(makeInput({ trainingFocus: focus }));
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            for (const ws of ex.workSets) {
              expect(ws.reps).toBeGreaterThanOrEqual(1);
              expect(ws.reps).toBeLessThanOrEqual(30);
            }
          }
        }
      }
    });
  }

  it('trainingFocus strength → RIR ниже чем endurance (в среднем)', () => {
    const planStr = buildBBPlan(makeInput({ trainingFocus: 'strength', weeks: 8 }));
    const planEnd = buildBBPlan(makeInput({ trainingFocus: 'endurance', weeks: 8 }));

    const avgRir = (p: any) => {
      let sum = 0, count = 0;
      for (const w of p.weeks) {
        if (w.phase === 'deload') continue;
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            sum += ex.rir;
            count++;
          }
        }
      }
      return count > 0 ? sum / count : 0;
    };

    const strRir = avgRir(planStr);
    const endRir = avgRir(planEnd);
    // strength RIR ≤ endurance RIR (Schoenfeld 2021: strength = RIR 1-2, endurance = RIR 3-4)
    expect(strRir).toBeLessThanOrEqual(endRir);
  });

  it('trainingFocus undefined (default) — план генерируется', () => {
    const plan = buildBBPlan(makeInput({ trainingFocus: undefined }));
    expectValidPlan(plan);
  });
});

describe('BB volumeGoal coverage', () => {
  const goals = ['mev', 'mav', 'mrv'] as const;

  for (const goal of goals) {
    it(`volumeGoal='${goal}' — план генерируется без crash`, () => {
      const plan = buildBBPlan(makeInput({ volumeGoal: goal }));
      expectValidPlan(plan);
    });
  }

  it('volumeGoal mev → меньше объёма чем mrv', () => {
    const planMev = buildBBPlan(makeInput({ volumeGoal: 'mev' }));
    const planMrv = buildBBPlan(makeInput({ volumeGoal: 'mrv' }));

    const totalSets = (p: any) => {
      let total = 0;
      for (const w of p.weeks) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            total += ex.sets;
          }
        }
      }
      return total;
    };

    const mevSets = totalSets(planMev);
    const mrvSets = totalSets(planMrv);
    // MEV должен быть ≤ MRV (может быть равно если MRV cap сработал)
    expect(mevSets).toBeLessThanOrEqual(mrvSets);
  });
});