/**
 * mmc-tracking-sync.test.ts — тесты sync-слоя MMC-движка:
 * hasMMCValues, recordMMCFromPartial (upsert + дефолты + кламп), mergeMMCLog (дедуп/кап).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadMMCLog, clearMMCLog, recordMMCFromPartial, mergeMMCLog, hasMMCValues,
  type MMCPartial, type MMCSetEntry,
} from '../mmc-tracking.engine';

beforeEach(() => clearMMCLog());

describe('hasMMCValues', () => {
  it('null/undefined/пустой объект → false', () => {
    expect(hasMMCValues(null)).toBe(false);
    expect(hasMMCValues(undefined)).toBe(false);
    expect(hasMMCValues({})).toBe(false);
  });

  it('одно заполненное поле → true', () => {
    expect(hasMMCValues({ mmc: 7 })).toBe(true);
    expect(hasMMCValues({ pump: 3 })).toBe(true);
    expect(hasMMCValues({ jointDiscomfort: 8 })).toBe(true);
    expect(hasMMCValues({ energy: 4 })).toBe(true);
  });
});

describe('recordMMCFromPartial', () => {
  it('пустой ввод → не пишет, возвращает false', () => {
    expect(recordMMCFromPartial('2026-08-13', 'bench', 'Жим', 1, undefined)).toBe(false);
    expect(recordMMCFromPartial('2026-08-13', 'bench', 'Жим', 1, {})).toBe(false);
    expect(loadMMCLog()).toHaveLength(0);
  });

  it('пишет запись с дефолтами для незаполненных полей (mmc/pump/energy=5, joint=0)', () => {
    const ok = recordMMCFromPartial('2026-08-13', 'bench', 'Жим лёжа', 2, { mmc: 8 });
    expect(ok).toBe(true);
    const log = loadMMCLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      date: '2026-08-13', exerciseId: 'bench', exerciseName: 'Жим лёжа', setNumber: 2,
      mmc: 8, pump: 5, jointDiscomfort: 0, energy: 5,
    });
  });

  it('кламп значений за пределы 0-10', () => {
    recordMMCFromPartial('2026-08-13', 'x', 'Упражнение', 1, { mmc: 99, pump: -5, jointDiscomfort: 12, energy: 0 });
    const [e] = loadMMCLog();
    expect(e.mmc).toBe(10);
    expect(e.pump).toBe(0);
    expect(e.jointDiscomfort).toBe(10);
    expect(e.energy).toBe(0);
  });

  it('upsert: повторная запись того же (дата+упражнение+подход) заменяет, не дублирует', () => {
    recordMMCFromPartial('2026-08-13', 'bench', 'Жим лёжа', 1, { mmc: 6, pump: 7 });
    const ok = recordMMCFromPartial('2026-08-13', 'bench', 'Жим лёжа', 1, { jointDiscomfort: 4 });
    expect(ok).toBe(true);
    const log = loadMMCLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ mmc: 5, pump: 5, jointDiscomfort: 4, energy: 5 });
  });

  it('другой подход или другое упражнение — отдельные записи', () => {
    recordMMCFromPartial('2026-08-13', 'bench', 'Жим лёжа', 1, { mmc: 6 });
    recordMMCFromPartial('2026-08-13', 'bench', 'Жим лёжа', 2, { mmc: 7 });
    recordMMCFromPartial('2026-08-13', 'pull', 'Тяга', 1, { mmc: 5 });
    expect(loadMMCLog()).toHaveLength(3);
  });
});

describe('mergeMMCLog', () => {
  const mk = (date: string, name: string, setNumber: number, mmc: number): MMCSetEntry => ({
    date, exerciseId: 'id', exerciseName: name, setNumber, mmc, pump: 5, jointDiscomfort: 0, energy: 5,
  });

  it('null/пустой массив → 0 добавленных', () => {
    expect(mergeMMCLog(null)).toBe(0);
    expect(mergeMMCLog(undefined)).toBe(0);
    expect(mergeMMCLog([])).toBe(0);
  });

  it('добавляет новые записи и возвращает их число', () => {
    recordMMCFromPartial('2026-08-13', 'id', 'Жим', 1, { mmc: 6 });
    const added = mergeMMCLog([mk('2026-08-13', 'Жим', 2, 8), mk('2026-08-13', 'Тяга', 1, 4)]);
    expect(added).toBe(2);
    expect(loadMMCLog()).toHaveLength(3);
  });

  it('дедуп: существующие (дата+упражнение+подход) не дублируются', () => {
    recordMMCFromPartial('2026-08-13', 'id', 'Жим', 1, { mmc: 6 });
    const added = mergeMMCLog([
      mk('2026-08-13', 'Жим', 1, 9),
      mk('2026-08-13', 'Жим', 2, 8),
    ]);
    expect(added).toBe(1);
    const log = loadMMCLog();
    expect(log).toHaveLength(2);
    expect(log.find(e => e.setNumber === 1)!.mmc).toBe(6);
  });

  it('битые записи без date/exerciseName отбрасываются', () => {
    const added = mergeMMCLog([{ ...mk('2026-08-13', 'Жим', 1, 7), date: '' }]);
    expect(added).toBe(0);
    expect(loadMMCLog()).toHaveLength(0);
  });
});
