import { describe, it, expect } from 'vitest';
import { getVolumeByMuscle, getVolumeReferences } from '../training-methodology.engine';
import { getSubstitutes, canReplace, getExerciseById } from '../../core/exercise-catalog';
import { generatePeriodization } from '../cycle-periodization.engine';

describe('getVolumeByMuscle (MEV/MAV/MRV)', () => {
  it('разрешает английские групповые имена (chest/back/legs/...)', () => {
    const chest = getVolumeByMuscle('chest');
    expect(chest).toBeDefined();
    expect(chest!.beginner.mev).toBe(6);
    expect(chest!.beginner.mav).toBe(10);
    expect(chest!.beginner.mrv).toBe(15);
    expect(getVolumeByMuscle('back')).toBeDefined();
    expect(getVolumeByMuscle('legs')).toBeDefined();
    expect(getVolumeByMuscle('shoulders')).toBeDefined();
    expect(getVolumeByMuscle('arms')).toBeDefined();
    expect(getVolumeByMuscle('core')).toBeDefined();
  });

  it('сохраняет русские названия', () => {
    expect(getVolumeByMuscle('Грудь')).toBeDefined();
    expect(getVolumeByMuscle('Грудь')!.advanced.mev).toBe(10);
  });

  it('соблюдает порядок MEV <= MAV <= MRV', () => {
    getVolumeReferences().forEach(ref => {
      ['beginner', 'intermediate', 'advanced'].forEach(lvl => {
        const d = (ref as any)[lvl];
        expect(d.mev).toBeLessThanOrEqual(d.mav);
        expect(d.mav).toBeLessThanOrEqual(d.mrv);
      });
    });
  });

  it('возвращает undefined для несуществующей группы', () => {
    expect(getVolumeByMuscle('несуществующая_группа_xyz')).toBeUndefined();
  });
});

describe('Подбор замен (getSubstitutes / canReplace)', () => {
  it('возвращает список замен для жима лёжа', () => {
    const sub = getSubstitutes('bench_bar');
    expect(sub).toBeDefined();
    expect(sub!.substitutes.length).toBeGreaterThan(0);
  });

  it('canReplace: допустимая замена проходит, запретная — нет', () => {
    expect(canReplace('bench_bar', 'bench_db')).toBe(true);
    expect(canReplace('bench_bar', 'cable_fly')).toBe(false); // изоляция, в cannotReplace
  });

  it('getExerciseById находит по id', () => {
    const ex = getExerciseById('bench_bar');
    expect(ex).toBeDefined();
    expect(ex!.name).toBeTruthy();
  });
});

describe('generatePeriodization (планер микроциклов)', () => {
  it('12 недель: сумма недель по фазам = 12, первая фаза — накопление', () => {
    const res = generatePeriodization(12, 'hypertrophy');
    const total = res.phases.reduce((s, p) => s + p.weeks, 0);
    expect(total).toBe(12);
    expect(res.phases[0].phase).toBe('accumulation');
    expect(res.phases.length).toBeGreaterThan(1);
  });

  it('4 недели: одна фаза', () => {
    const res = generatePeriodization(4, 'strength');
    expect(res.phases.length).toBe(1);
    expect(res.phases[0].weeks).toBe(4);
  });

  it('8 недель: накопление + делод', () => {
    const res = generatePeriodization(8, 'hypertrophy');
    const total = res.phases.reduce((s, p) => s + p.weeks, 0);
    expect(total).toBe(8);
    expect(res.phases.some(p => p.phase === 'deload')).toBe(true);
  });
});