import { describe, expect, it } from 'vitest';
import { ARM_BODY_REGION_THRESHOLDS, armBodyRegionGate, armBodyRegionsForExercise, armBodyRegionsForValue, normalizeArmBodyRegion } from '../arm-body-region.engine';
import { estimateArmPlanDuration, estimateArmSessionDuration, resolveArmSessionDuration } from '../arm-duration.engine';
import { assessArmReadiness } from '../arm-readiness.engine';
import { resolveArmReturnToLoad } from '../arm-return-to-load.engine';
import { ARM_TENDON_MUSCLES, armTendonSet, armTendonSetForExercises, canonicalizeArmTendonMuscle, countArmTendonSets } from '../arm-tendon-sets.engine';
import { aggregateArmVolume } from '../arm-volume.engine';
import { isTendonSession } from '../arm-acwr.engine';
import { mobilityBlockReason } from '../arm-injury-guard.engine';
import { refreshArmPlanSnapshot } from '../arm-plan-snapshot.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { tableTimeSummary } from '../arm-table.engine';

const durationExercise = {
  sets: 2,
  repsRange: [8, 10] as [number, number],
  workSets: [
    { reps: 10, restSeconds: 60, tempo: '2-0-0-0', holdSeconds: 5 },
    { reps: 10, restSeconds: 60, tempo: '2-0-0-0' },
  ],
};

describe('ARM PRO-7 duration', () => {
  it('детерминирован и считает верхний диапазон повторов', () => {
    const session = { exercises: [durationExercise] };
    const options = { warmupMinutes: 0, exerciseSetupSeconds: 0, exerciseTransitionSeconds: 0 };
    const first = estimateArmSessionDuration(session, options);
    const second = estimateArmSessionDuration(session, options);
    expect(first).toEqual(second);
    expect(first.totalSeconds).toBe(105);
    expect(first.durationMin).toBeCloseTo(105 / 60);
    expect(first.holdSeconds).toBe(5);
  });

  it('разделяет work, hold и rest', () => {
    const result = estimateArmSessionDuration({ exercises: [durationExercise] }, {
      warmupMinutes: 0,
      exerciseSetupSeconds: 0,
      exerciseTransitionSeconds: 0,
    });
    expect(result.workSeconds).toBe(45);
    expect(result.dynamicSeconds).toBe(40);
    expect(result.restSeconds).toBe(60);
  });

  it('не меняет явно заданную длительность', () => {
    const result = resolveArmSessionDuration({ durationMin: 47, exercises: [] }, { warmupMinutes: 0 });
    expect(result.source).toBe('provided');
    expect(result.durationMin).toBe(47);
  });

  it('суммирует недели и сессии без случайности', () => {
    const weeks = [{ sessions: [{ exercises: [durationExercise] }, { exercises: [] }] }];
    const result = estimateArmPlanDuration(weeks, { warmupMinutes: 0, exerciseSetupSeconds: 0, exerciseTransitionSeconds: 0 });
    expect(result.durationMin).toBeCloseTo(105 / 60);
    expect(result.byWeek[1]).toBeCloseTo(105 / 60);
    expect(result.bySession[0]).toBeCloseTo(105 / 60);
  });

  it('билдер проставляет длительность каждой сессии (ACWR/table видят минуты)', () => {
    const plan = buildArmPlan({ discipline: 'armwrestling', level: 'intermediate', weeks: 2 } as any);
    const sessions = plan.weeks.flatMap(w => w.sessions);
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      expect(Number.isFinite(Number(session.durationMin))).toBe(true);
      expect(Number(session.durationMin)).toBeGreaterThan(0);
    }
    const table = tableTimeSummary(plan.weeks as any);
    expect(table.tableMinutesShare).not.toBeNull();
  });
});

describe('ARM PRO-7 readiness', () => {
  it('пустые сигналы дают unknown', () => {
    const result = assessArmReadiness();
    expect(result.status).toBe('unknown');
    expect(result.action).toBe('hold');
    expect(result.adjustmentApplied).toBe(false);
  });

  it('нормальный дневник даёт green без множителя', () => {
    const result = assessArmReadiness({ diary: [{ dateIso: '2026-01-01', srpe: 6, elbowPain: 1, wristPain: 0, velocityLossPct: 4 }] });
    expect(result.status).toBe('green');
    expect(result.action).toBe('proceed');
    expect(result.adjustment.volumeMult).toBe(1);
    expect(result.adjustment.rirShift).toBe(0);
  });

  it('сохраняет уже готовые сигналы без повторной оценки', () => {
    const base = assessArmReadiness({ diary: [{ srpe: 9 }] });
    const result = assessArmReadiness({ readiness: base });
    expect(result.status).toBe('red');
    expect(result.signals.some((signal) => signal.name === 'sRPE')).toBe(true);
    expect(result.adjustmentApplied).toBe(false);
  });

  it('srpe, боль и velocity дают yellow', () => {
    expect(assessArmReadiness({ diary: [{ dateIso: '2026-01-01', srpe: 8 }] }).status).toBe('yellow');
    expect(assessArmReadiness({ diary: [{ dateIso: '2026-01-01', elbowPain: 4 }] }).status).toBe('yellow');
    expect(assessArmReadiness({ diary: [{ dateIso: '2026-01-01', velocityLossPct: 20 }] }).status).toBe('yellow');
  });

  it('красный сигнал имеет приоритет и не применяет adjustment', () => {
    const result = assessArmReadiness({
      diary: [{ dateIso: '2026-01-01', srpe: 9, wristPain: 7, velocityLossPct: 35 }],
      profile: { sleepHours: 8, hrvMs: 50, stressLevel: 2 },
    });
    expect(result.status).toBe('red');
    expect(result.action).toBe('hold');
    expect(result.adjustment).toEqual({ volumeMult: 1, rirShift: 0, restDays: 0 });
  });

  it('профиль и ACWR используют явные пороги', () => {
    expect(assessArmReadiness({ profile: { sleepHours: 5, hrvMs: 30, stressLevel: 8 }, acwrRatio: 1.5 }).status).toBe('red');
    expect(assessArmReadiness({ profile: { sleepHours: 5.5, hrvMs: 35, stressLevel: 6 }, acwrRatio: 1.3 }).status).toBe('yellow');
    expect(assessArmReadiness({ profile: { sleepHours: 6, hrvMs: 40, stressLevel: 5 }, acwrRatio: 1.2 }).status).toBe('green');
  });

  it('региональный caution попадает в readiness', () => {
    const result = assessArmReadiness({ regions: [{ region: 'elbow', repsMax: ARM_BODY_REGION_THRESHOLDS.elbow.maxReps + 1, rir: 2 }] });
    expect(result.status).toBe('yellow');
    expect(result.signals.some((signal) => signal.source === 'region')).toBe(true);
  });
});

describe('ARM PRO-7 body regions', () => {
  it('канонически разворачивает мышцу в регионы', () => {
    expect(armBodyRegionsForValue('wrist_flexors')).toEqual(['wrist', 'hand']);
    expect(normalizeArmBodyRegion('предплечье')).toBe('forearm');
    expect(armBodyRegionsForExercise({ muscle: 'side_pressure', name: 'Боковое давление' })).toEqual(['elbow', 'shoulder']);
  });

  it('allow, caution и block разделены', () => {
    expect(armBodyRegionGate({ region: 'wrist', rir: 2, repsMax: 20 }).status).toBe('allow');
    expect(armBodyRegionGate({ region: 'wrist', repsMax: 30, rir: 2 }).status).toBe('caution');
    expect(armBodyRegionGate({ region: 'elbow', pain: 8 }).status).toBe('block');
    expect(armBodyRegionGate({ region: 'forearm', rir: 0 }).status).toBe('block');
  });

  it('новые hand restrictions используются в injury guard', () => {
    expect(mobilityBlockReason({ muscle: 'risers' }, ['hand'])).toBe('hand');
    expect(mobilityBlockReason({ muscle: 'shoulder_stab' }, ['shoulder'])).toBe('shoulder');
  });
});

describe('ARM PRO-7 return to load', () => {
  it('нет данных и острые симптомы ведут в hold', () => {
    expect(resolveArmReturnToLoad().phase).toBe('hold');
    expect(resolveArmReturnToLoad({ painFreeDays: 30, readiness: 'green', acuteSymptoms: true }).phase).toBe('hold');
  });

  it('прогрессирует только после безболевого окна', () => {
    expect(resolveArmReturnToLoad({ painFreeDays: 8, readiness: 'green' }).phase).toBe('isometric');
    expect(resolveArmReturnToLoad({ painFreeDays: 14, readiness: 'green' }).phase).toBe('build');
    expect(resolveArmReturnToLoad({ painFreeDays: 30, readiness: 'green' }).phase).toBe('load');
  });

  it('yellow ограничивает фазу, red останавливает', () => {
    expect(resolveArmReturnToLoad({ painFreeDays: 30, readiness: 'yellow' }).phase).toBe('low_load');
    expect(resolveArmReturnToLoad({ painFreeDays: 30, readiness: 'red' }).phase).toBe('hold');
    expect(resolveArmReturnToLoad({ painFreeDays: 30, readiness: 'green', acwrRatio: 1.3 }).phase).toBe('low_load');
  });

  it('regional block не обходится большим числом дней', () => {
    const result = resolveArmReturnToLoad({ painFreeDays: 60, readiness: 'green', regionGate: { region: 'hand', pain: 8 } });
    expect(result.phase).toBe('hold');
    expect(result.allowed).toBe(false);
  });
});

describe('ARM PRO-7 tendon canonicalization', () => {
  it('один canonical set включает все восемь групп', () => {
    expect(ARM_TENDON_MUSCLES).toHaveLength(8);
    expect(canonicalizeArmTendonMuscle('pronation')).toBe('pronators');
    expect(armTendonSet(['wrist', 'ulnar_deviation', 'wrist', 'thumb', 'brachialis'])).toEqual(['wrist_flexors', 'ulnar_deviators', 'thumb']);
  });

  it('aliases and set counts converge across volume surfaces', () => {
    const exercises = ARM_TENDON_MUSCLES.map((muscle, index) => ({ muscle: index % 2 === 0 ? muscle : muscle.replace('_', '-'), sets: index + 1 }));
    const count = countArmTendonSets(exercises);
    const volume = aggregateArmVolume([{ sessions: [{ exercises }] }]);
    expect(count).toBe(36);
    expect(Object.values(volume).reduce((sum, value) => sum + value.tendonSets, 0)).toBe(36);
    expect(isTendonSession([{ muscle: 'ulnar_deviators' }])).toBe(true);
    expect(armTendonSetForExercises([{ muscle: 'wrist_extensors', sets: 2 }, { muscle: 'wrist-extension', sets: 3 }]).totalSets).toBe(5);
  });

  it('builder и snapshot используют один tendon count', () => {
    const plan: any = buildArmPlan({
      discipline: 'armwrestling',
      patternId: 'arm_3_full',
      level: 'intermediate',
      goal: 'strength',
      technique: 'balanced',
      weeks: 1,
    });
    const refreshed = refreshArmPlanSnapshot(plan, 'intermediate');
    const week = refreshed.weeks[0];
    const expected = countArmTendonSets(week.sessions.flatMap((session: any) => session.exercises));
    const actual = Object.values(refreshed.weeklyVolume?.[week.week] || {}).reduce((sum: number, item: any) => sum + (item.tendonSets || 0), 0);
    expect(actual).toBe(expected);
  });
});
