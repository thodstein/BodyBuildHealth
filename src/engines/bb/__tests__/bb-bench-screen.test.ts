import { describe, it, expect } from 'vitest';
import {
  benchGripBaw,
  benchScreenVerdict,
  benchCorrections,
  BENCH_DISCLAIMER,
  BENCH_GRIP_BAW_MAX,
  BENCH_GRIP_BAW_MIN,
} from '../bb-bench-screen.engine';

describe('bb-bench-screen R1 — хват в BAW', () => {
  it('BAW: расчёт из см и мусор → null', () => {
    expect(benchGripBaw(60, 40)).toBe(1.5);
    expect(benchGripBaw(48, 40)).toBe(1.2);
    expect(benchGripBaw(0, 40)).toBeNull();
    expect(benchGripBaw('мусор' as any, 40)).toBeNull();
    expect(benchGripBaw(60, null)).toBeNull();
  });
  it('широкий хват >1.5 BAW — fix «сузь»', () => {
    const v = benchScreenVerdict({ gripBaw: 1.8 });
    expect(v.level).toBe('fix');
    expect(v.text).toMatch(/сузь/);
    expect(benchCorrections(v).length).toBeGreaterThan(0);
  });
  it('границы: 1.5 — ок, 1.5+ — fix, <1.0 — fix «узко», 1.0–1.2 — watch', () => {
    expect(benchScreenVerdict({ gripBaw: BENCH_GRIP_BAW_MAX }).level).toBe('ok');
    expect(benchScreenVerdict({ gripBaw: 1.51 }).level).toBe('fix');
    expect(benchScreenVerdict({ gripBaw: 0.9 }).level).toBe('fix');
    expect(benchScreenVerdict({ gripBaw: 0.9 }).text).toMatch(/узко/);
    const w = benchScreenVerdict({ gripBaw: BENCH_GRIP_BAW_MIN - 0.1 });
    expect(w.level).toBe('watch');
  });
  it('хват без ширины плеч — честный watch (BAW не посчитан)', () => {
    const v = benchScreenVerdict({ gripCm: 60 });
    expect(v.level).toBe('watch');
    expect(v.text).toMatch(/плеч/);
    expect(v.gripBaw).toBeNull();
  });
  it('касание: шея — fix, живот — watch, соски — тихо', () => {
    expect(benchScreenVerdict({ touchPoint: 'neck' }).level).toBe('fix');
    expect(benchScreenVerdict({ touchPoint: 'upper_abs' }).level).toBe('watch');
    expect(benchScreenVerdict({ touchPoint: 'nipple' }).level).toBe('ok');
  });
  it('лопатки: released — fix, neutral — watch, retracted — тихо', () => {
    expect(benchScreenVerdict({ scapula: 'released' }).level).toBe('fix');
    expect(benchScreenVerdict({ scapula: 'neutral' }).level).toBe('watch');
    expect(benchScreenVerdict({ scapula: 'retracted' }).level).toBe('ok');
  });
  it('отведение >80 и <30 — watch, 45–70 — тихо', () => {
    expect(benchScreenVerdict({ abductionDeg: 85 }).text).toMatch(/80/);
    expect(benchScreenVerdict({ abductionDeg: 20 }).text).toMatch(/<30|узко/);
    expect(benchScreenVerdict({ abductionDeg: 60 }).level).toBe('ok');
  });
  it('локоть ниже скамьи и боль — fix-строки', () => {
    const v = benchScreenVerdict({ elbowsBelowBench: true, pain: true });
    expect(v.level).toBe('fix');
    expect(v.fixes.join(' ')).toMatch(/ниже скамьи/);
    expect(v.fixes.join(' ')).toMatch(/Боль/);
  });
  it('пусто — not_tested, правок нет', () => {
    const v = benchScreenVerdict({});
    expect(v.tested).toBe(false);
    expect(v.level).toBe('not_tested');
    expect(benchCorrections(v)).toEqual([]);
  });
  it('дисклеймер честный (не диагноз)', () => {
    expect(BENCH_DISCLAIMER).toMatch(/не диагноз/);
  });
});
