import { describe, expect, it } from 'vitest';
import {
  PRILEPIN_TABLE,
  prilepinZoneFor,
  inolForReps,
  inolForSet,
  verdictForInol,
  inolScopeVerdict,
  tonnageRowResult,
  bodyweightLoad,
  patternOf,
  isDeadliftLike,
  vbtLiftForExercise,
  estimatedMpv,
  INOL_OPT_EXERCISE,
} from '../tonnage-prilepin.engine';

describe('tonnage-prilepin: таблица Прилепина', () => {
  it('4 зоны с каноническими оптимумами 24/18/15/7', () => {
    expect(PRILEPIN_TABLE.map(z => z.optimalTotal)).toEqual([24, 18, 15, 7]);
  });
  it('зоны по %1RM: 65→tech, 75→hyper, 85→strength, 95→max', () => {
    expect(prilepinZoneFor(65).id).toBe('tech');
    expect(prilepinZoneFor(75).id).toBe('hypertrophy');
    expect(prilepinZoneFor(85).id).toBe('strength');
    expect(prilepinZoneFor(95).id).toBe('max');
  });
});

describe('tonnage-prilepin: INOL', () => {
  it('оптимум упражнения 0.8: 5×3 @85% = 15/15 = 1.0 (в зоне 0.4–1.2)', () => {
    expect(INOL_OPT_EXERCISE).toBe(0.8);
    const inol = inolForSet(5, 3, 85);
    expect(inol).toBeCloseTo(1.0, 2);
    expect(verdictForInol(inol, { label: 'Присед' }).kind).toBe('optimal');
  });
  it('перебор: 8×3 @90% = 2.4 → over', () => {
    expect(verdictForInol(inolForSet(8, 3, 90), { label: 'Жим' }).kind).toBe('over');
  });
  it('недобор: 2×5 @70% = 0.33 → below', () => {
    expect(verdictForInol(inolForReps(10, 70), { label: 'Тяга' }).kind).toBe('below');
  });
  it('становая: оптимум ×0.75 — 15 повторов @85% уже high', () => {
    const v = verdictForInol(1.0, { isDeadlift: true, label: 'Становая' });
    expect(v.kind).toBe('high');
    expect(isDeadliftLike('Становая тяга сумо')).toBe(true);
  });
  it('аксессуар: перебор — info-ориентир, не гейт', () => {
    const v = verdictForInol(2.5, { isAccessory: true, label: 'Махи' });
    expect(v.kind).toBe('over');
    expect(v.message).toContain('ориентир');
  });
});

describe('tonnage-prilepin: INOL дня/недели (Hristov 2.4/7.2)', () => {
  it('день 2.4 — optimal; 1.0 — below; 5.0 — high; 7.0 — over', () => {
    expect(inolScopeVerdict(2.4, 'day').kind).toBe('optimal');
    expect(inolScopeVerdict(1.0, 'day').kind).toBe('below');
    expect(inolScopeVerdict(5.0, 'day').kind).toBe('high');
    expect(inolScopeVerdict(7.0, 'day').kind).toBe('over');
  });
  it('неделя 7.2 — optimal; 20 — over', () => {
    expect(inolScopeVerdict(7.2, 'week').kind).toBe('optimal');
    expect(inolScopeVerdict(20, 'week').kind).toBe('over');
  });
});

describe('tonnage-prilepin: VBT-линк (Ж1, reuse LVP)', () => {
  it('присед/жим/становая/армейский/тяга → канон; инклайн/сумо/пулдаун → estimate', () => {
    expect(vbtLiftForExercise('Приседания со штангой')).toEqual({ lift: 'squat', isEstimate: false });
    expect(vbtLiftForExercise('Жим штанги лёжа')).toEqual({ lift: 'bench', isEstimate: false });
    expect(vbtLiftForExercise('Становая тяга')).toEqual({ lift: 'deadlift', isEstimate: false });
    expect(vbtLiftForExercise('Жим гантелей на наклонной')).toEqual({ lift: 'bench', isEstimate: true });
    expect(vbtLiftForExercise('Становая сумо')).toEqual({ lift: 'deadlift', isEstimate: true });
    expect(vbtLiftForExercise('Тяга верхнего блока')).toEqual({ lift: 'row', isEstimate: true });
  });
  it('изоляция — null (VBT невалиден, честно молчим)', () => {
    expect(vbtLiftForExercise('Сгибания рук с гантелями')).toBeNull();
    expect(vbtLiftForExercise('Махи гантелей')).toBeNull();
  });
  it('85% приседа → 0.55 м/с (таблица Gonzalez-Badillo)', () => {
    const v = estimatedMpv('Присед', 85)!;
    expect(v.velocity).toBeCloseTo(0.55, 2);
    expect(v.mvt).toBeCloseTo(0.25, 2);
  });
  it('без %1RM — null', () => {
    expect(estimatedMpv('Присед', 0)).toBeNull();
  });
});

describe('tonnage-prilepin: строка целиком', () => {
  it('жим 80×5×4 @100 → зона strength, INOL 1.0, вердикт optimal', () => {
    const r = tonnageRowResult({ exerciseId: 'bench_bar', name: 'Жим штанги лёжа', weight: 80, reps: 5, sets: 4, oneRM: 100 });
    expect(r.tonnage).toBe(1600);
    expect(r.zone!.id).toBe('strength');
    expect(r.inol).toBeCloseTo(1.0, 2);
    expect(r.verdict!.kind).toBe('optimal');
  });
  it('вес тела: подтягивания +0 кг при BW 80 → нагрузка 52/повтор', () => {
    const r = tonnageRowResult({ exerciseId: 'pullup', name: 'Подтягивания', weight: 0, reps: 8, sets: 3, oneRM: 0, bodyweightKg: 80 });
    expect(r.loadPerRep).toBeCloseTo(52, 1);
    expect(r.intensityPct).toBeNull();
    expect(r.verdict).toBeNull();
  });
  it('без 1RM — честно null, без выдуманного вердикта', () => {
    const r = tonnageRowResult({ exerciseId: 'x', name: 'Жим', weight: 60, reps: 8, sets: 3, oneRM: 0 });
    expect(r.zone).toBeNull();
    expect(r.inol).toBeNull();
  });
  it('bodyweightLoad: 10 + 0.65×80 = 62', () => {
    expect(bodyweightLoad(10, 80)).toBeCloseTo(62, 6);
  });
  it('pattern: становая barbell, махи isolation, рывок olympic', () => {
    expect(patternOf('Становая тяга')).toBe('barbell');
    expect(patternOf('Махи гантелей')).toBe('isolation');
    expect(patternOf('Рывок')).toBe('olympic');
  });
});
