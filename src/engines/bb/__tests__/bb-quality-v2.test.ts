import { describe, expect, it } from 'vitest';
import { bbPlanQualityV2, v2OnlyIssues, v2OverloadFix } from '../bb-quality-v2.engine';

function bbPlan(overrides: any = {}) {
  return {
    pattern: {},
    mrvByMuscle: undefined,
    weeks: [
      {
        week: 1, sessions: [
          {
            day: 1, weekOffset: 1, character: 'тяж',
            exercises: [
              { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', sets: 6, repsRange: [6, 8], rir: 2, workSets: [] },
              { muscle: 'chest', name: 'Разводка гантелей', role: 'accessory', sets: 4, repsRange: [10, 12], rir: 2, workSets: [] },
              { muscle: 'back', name: 'Тяга штанги в наклоне', role: 'primary', sets: 6, repsRange: [6, 8], rir: 2, workSets: [] },
              { muscle: 'back', name: 'Подтягивания', role: 'primary', sets: 4, repsRange: [8, 10], rir: 2, workSets: [] },
            ],
          },
          {
            day: 2, weekOffset: 1, character: 'памп',
            exercises: [
              { muscle: 'chest', name: 'Жим гантелей на наклонной', role: 'primary', sets: 4, repsRange: [8, 10], rir: 2, workSets: [] },
              { muscle: 'back', name: 'Тяга верхнего блока', role: 'primary', sets: 4, repsRange: [10, 12], rir: 2, workSets: [] },
            ],
          },
        ],
      },
      {
        week: 2, phase: 'deload', sessions: [
          {
            day: 1, weekOffset: 1, character: 'лёг',
            exercises: [
              { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', sets: 3, repsRange: [8, 10], rir: 4, workSets: [] },
              { muscle: 'back', name: 'Тяга штанги в наклоне', role: 'primary', sets: 3, repsRange: [8, 10], rir: 4, workSets: [] },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('bb-quality-v2: хороший план', () => {
  it('считает V2 без null, грейд и breakdown в сумме 100', () => {
    const v2 = bbPlanQualityV2(bbPlan() as any, { level: 'intermediate' })!;
    expect(v2).not.toBeNull();
    expect(v2.score).toBeGreaterThanOrEqual(65);
    expect(Object.values(v2.breakdown).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100);
    expect(v2.perMuscle.length).toBeGreaterThan(0);
  });
  it('де lod-призрак НЕ ловится на настоящем делоде', () => {
    const v2 = bbPlanQualityV2(bbPlan() as any, { level: 'intermediate' })!;
    expect(v2.issues.some(i => i.id === 'deload_ghost')).toBe(false);
  });
});

describe('bb-quality-v2: перегруз и session-кап', () => {
  const over = bbPlan({
    weeks: [
      {
        week: 1, sessions: [
          {
            day: 1, weekOffset: 1, character: 'тяж',
            exercises: [
              { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', sets: 14, repsRange: [6, 8], rir: 2, workSets: [] },
              { muscle: 'chest', name: 'Разводка гантелей', role: 'accessory', sets: 12, repsRange: [10, 12], rir: 0, workSets: [] },
            ],
          },
        ],
      },
    ],
  });
  it('перегруз бьёт volume-вес и попадает в overloadFix', () => {
    const v2 = bbPlanQualityV2(over as any, { level: 'intermediate' })!;
    expect(v2.issues.some(i => i.id === 'vol_over_chest')).toBe(true);
    expect(v2OverloadFix(v2).chest).toBe(v2.perMuscle.find(m => m.muscle === 'chest')!.mav);
  });
  it('session-кап 26 сетов в 1 сессии — в onlyIssues', () => {
    const v2 = bbPlanQualityV2(over as any, { level: 'intermediate' })!;
    const only = v2OnlyIssues(v2);
    expect(only.some(i => i.id === 'session_cap_chest')).toBe(true);
    // дубли объёма исключены
    expect(only.some(i => i.id === 'vol_over_chest')).toBe(false);
  });
});

describe('bb-quality-v2: RIR новичка и MV спец-блока', () => {
  it('новичок с отказом — critical в onlyIssues', () => {
    const p = bbPlan({
      weeks: [{
        week: 1, sessions: [{
          day: 1, weekOffset: 1, character: 'тяж',
          exercises: [
            { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', sets: 8, repsRange: [6, 8], rir: 0, workSets: [] },
            { muscle: 'back', name: 'Тяга штанги в наклоне', role: 'primary', sets: 8, repsRange: [6, 8], rir: 0, workSets: [] },
          ],
        }],
      }],
    });
    const v2 = bbPlanQualityV2(p as any, { level: 'beginner' })!;
    expect(v2OnlyIssues(v2).some(i => i.id === 'rir_beginner_failure')).toBe(true);
  });
  it('не-цель спец-блока на MV — maintenance без vol_low', () => {
    const p = bbPlan({
      weeks: [{
        week: 1, sessions: [{
          day: 1, weekOffset: 1, character: 'тяж',
          exercises: [
            { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', sets: 14, repsRange: [6, 8], rir: 2, workSets: [] },
            { muscle: 'back', name: 'Тяга штанги в наклоне', role: 'primary', sets: 5, repsRange: [6, 8], rir: 2, workSets: [] },
          ],
        }],
      }],
    });
    const v2 = bbPlanQualityV2(p as any, { level: 'intermediate', specTargets: ['chest'] })!;
    expect(v2.perMuscle.find(m => m.muscle === 'back')?.status).toBe('maintenance');
    expect(v2.issues.some(i => i.id === 'vol_low_back')).toBe(false);
  });
});

describe('bb-quality-v2: пустой/битый план — null', () => {
  it('без недель — null', () => {
    expect(bbPlanQualityV2({ weeks: [] } as any, { level: 'intermediate' })).toBeNull();
  });
  it('v2OnlyIssues/v2OverloadFix на null — пусто', () => {
    expect(v2OnlyIssues(null)).toEqual([]);
    expect(v2OverloadFix(null)).toEqual({});
  });
});
