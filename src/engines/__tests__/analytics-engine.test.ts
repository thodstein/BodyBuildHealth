// Тесты analytics-engine: группировка по актуальным id каталога, честный «объём/нед»,
// отсутствие фабрикованного RPE и отсутствие NaN/деления на ноль.
import { describe, it, expect } from 'vitest';
import {
  computeVolume,
  computeIntensity,
  computeAnalytics,
  type SetLogEntry,
  type SessionLogEntry,
} from '../analytics-engine';

const NOW = Date.parse('2026-11-23T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => new Date(NOW + offset * DAY).toISOString().slice(0, 10);

function mkSet(exerciseId: string, weight: number, reps: number, extra: Partial<SetLogEntry> = {}): SetLogEntry {
  return {
    exerciseId,
    exerciseName: exerciseId,
    reps,
    weight,
    rpe: 0,
    rir: 0,
    date: day(0),
    setIndex: 0,
    ...extra,
  };
}

function mkSession(sets: SetLogEntry[], date = day(0)): SessionLogEntry {
  return { sessionId: `s_${date}_${sets.length}`, date, focus: 'fullbody', durationMin: 60, sets };
}

describe('analytics-engine: группы мышц по актуальным id каталога', () => {
  it('bench_bar/squat/row_bar/pullup/pulldown/leg_ext/rdl/curl_bar/tricep_cable/ohp не уходят в other', () => {
    const sets = [
      mkSet('bench_bar', 100, 5),
      mkSet('squat', 100, 5),
      mkSet('row_bar', 100, 5),
      mkSet('pullup', 100, 5),
      mkSet('pulldown', 100, 5),
      mkSet('leg_ext', 100, 5),
      mkSet('rdl', 100, 5),
      mkSet('curl_bar', 100, 5),
      mkSet('tricep_cable', 100, 5),
      mkSet('ohp', 100, 5),
    ];
    const v = computeVolume([mkSession(sets)], [], NOW);

    expect(v.volumeByGroup).toEqual({
      chest: 500,
      quads: 1000,
      back: 1500,
      hamstrings: 500,
      arms: 1000,
      shoulders: 500,
    });
    expect(v.volumeByGroup.other).toBeUndefined();
  });

  it('паттерны движений тоже маппятся для актуальных id', () => {
    const sets = [
      mkSet('squat', 100, 5),
      mkSet('bench_bar', 100, 5),
      mkSet('row_bar', 100, 5),
      mkSet('pullup', 100, 5),
      mkSet('rdl', 100, 5),
      mkSet('ohp', 100, 5),
      mkSet('curl_bar', 100, 5),
    ];
    const v = computeVolume([mkSession(sets)], [], NOW);

    expect(v.volumeByPattern.squat).toBe(500);
    expect(v.volumeByPattern.horizontal_push).toBe(500);
    expect(v.volumeByPattern.horizontal_pull).toBe(500);
    expect(v.volumeByPattern.vertical_pull).toBe(500);
    expect(v.volumeByPattern.hinge).toBe(500);
    expect(v.volumeByPattern.vertical_push).toBe(500);
    expect(v.volumeByPattern.accessory).toBe(500);
  });

  it('легаси-ключи продолжают работать', () => {
    const sets = [
      mkSet('bench_press', 100, 5),
      mkSet('back_squat', 100, 5),
      mkSet('romanian_deadlift', 100, 5),
      mkSet('bicep_curl', 100, 5),
    ];
    const v = computeVolume([mkSession(sets)], [], NOW);
    expect(v.volumeByGroup).toEqual({ chest: 500, quads: 500, hamstrings: 500, arms: 500 });
  });

  it('неизвестный id берёт muscleGroup из записи, а не молча other', () => {
    const v = computeVolume([mkSession([mkSet('custom_exercise', 50, 10, { muscleGroup: 'glutes' })])], [], NOW);
    expect(v.volumeByGroup.glutes).toBe(500);
    expect(v.volumeByGroup.other).toBeUndefined();
  });
});

describe('analytics-engine: weeklyVolumeKg — действительно последние 7 дней', () => {
  it('считает тоннаж только последней недели, а не сумму всей истории', () => {
    const sessions = [
      mkSession([mkSet('bench_bar', 100, 10, { date: day(-10) })], day(-10)), // 1000 кг, вне недели
      mkSession([mkSet('squat', 100, 10, { date: day(-6) })], day(-6)), // 1000 кг, в неделе
      mkSession([mkSet('row_bar', 100, 10, { date: day(-1) })], day(-1)), // 1000 кг, в неделе
    ];
    const v = computeVolume(sessions, [], NOW);

    expect(v.weeklyVolumeKg).toBe(2000);
    expect(v.weeklySets).toBe(2);
    expect(v.weeklyReps).toBe(20);
    // Средний объём за сессию — по всей переданной истории.
    expect(v.avgVolumePerSession).toBe(1000);
  });

  it('computeAnalytics прокидывает now и даёт тот же честный объём', () => {
    const sessions = [
      mkSession([mkSet('bench_bar', 100, 10, { date: day(-10) })], day(-10)),
      mkSession([mkSet('squat', 100, 10, { date: day(-1) })], day(-1)),
    ];
    const snap = computeAnalytics({ sessions, weeks: 4, now: NOW });
    expect(snap.volume.weeklyVolumeKg).toBe(1000);
  });

  it('тренд сравнивает предыдущее 7-дневное окно с текущим', () => {
    const current = mkSession([mkSet('squat', 100, 10, { date: day(-1) })], day(-1)); // 1000
    const prev = mkSession([mkSet('squat', 100, 5, { date: day(-10) })], day(-10)); // 500
    const v = computeVolume([current], [prev], NOW);
    expect(v.volumeTrend).toBe(100);
  });
});

describe('analytics-engine: RPE не фабрикуется', () => {
  it('подходы без RPE не дают средний RPE', () => {
    const m = computeIntensity([mkSession([mkSet('bench_bar', 100, 5), mkSet('squat', 100, 5)])]);
    expect(m.avgRPE).toBe(0);
    expect(m.rpeDistribution).toEqual({});
  });

  it('учитывается только реально записанный RPE', () => {
    const m = computeIntensity([mkSession([mkSet('bench_bar', 100, 5, { rpe: 8 }), mkSet('squat', 100, 5)])]);
    expect(m.avgRPE).toBe(8);
    expect(m.rpeDistribution).toEqual({ '8': 1 });
  });
});

describe('analytics-engine: нет NaN/Infinity при пустых данных и duration=0', () => {
  it('пустая история не делит на ноль', () => {
    const v = computeVolume([], [], NOW);
    expect(v.weeklyVolumeKg).toBe(0);
    expect(v.avgVolumePerSession).toBe(0);
    expect(Number.isFinite(v.volumeTrend)).toBe(true);
  });

  it('сессия с duration=0 и нулевыми сетами не даёт NaN/Infinity', () => {
    const session: SessionLogEntry = {
      sessionId: 'zero',
      date: day(0),
      focus: 'fullbody',
      durationMin: 0,
      sets: [mkSet('bench_bar', 0, 0)],
    };
    const snap = computeAnalytics({ sessions: [session], weeks: 4, now: NOW });
    const numbers = [
      snap.volume.weeklyVolumeKg,
      snap.volume.weeklySets,
      snap.volume.weeklyReps,
      snap.volume.avgVolumePerSession,
      snap.volume.volumeTrend,
      snap.intensity.avgIntensity,
      snap.intensity.avgRPE,
      snap.fatigue.sessionFatigue,
      snap.fatigue.weeklyFatigue,
      snap.fatigue.monotony,
      snap.fatigue.strain,
      snap.fatigue.cnsFatigue,
      snap.recovery.recoveryScore,
      snap.recovery.readinessEstimate,
      snap.technique.avgTechniqueScore,
      snap.velocity.avgVelocity,
    ];
    for (const n of numbers) expect(Number.isFinite(n)).toBe(true);
    expect(JSON.stringify(snap)).not.toMatch(/NaN|Infinity/);
  });
});
