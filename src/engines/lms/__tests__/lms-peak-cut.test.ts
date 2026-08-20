/**
 * lms-peak-cut.test.ts — P2-5: сгонка веса к категории в пик-неделе (вода/натрий/карбы).
 */
import { describe, expect, it } from 'vitest';
import { buildPLPeakWeekCutProtocol } from '../lms-taper-coach.engine';

describe('buildPLPeakWeekCutProtocol', () => {
  it('не нужна сгонка, если вес уже в категории — протокол деплеции пуст (A1)', () => {
    const p = buildPLPeakWeekCutProtocol(80, 80);
    expect(p.needed).toBe(false);
    // A1-fix: при needed=false не отдаём агрессивный протокол вода/натрий/карбы
    // (показ манипуляции без необходимости вводит в заблуждение и опасен).
    expect(p.days.length).toBe(0);
    expect(p.summary).toContain('не требуется');
  });

  it('нужна сгонка: 7-дневный протокол вода/натрий/карбы, вода ↓ к старту', () => {
    const p = buildPLPeakWeekCutProtocol(82, 80);
    expect(p.needed).toBe(true);
    expect(p.toCutKg).toBeCloseTo(2, 5);
    expect(p.days).toHaveLength(7);
    // Вода снижается от дня 1 к дню старта.
    const day1 = p.days[0];
    const day6 = p.days[5];
    expect(day1.day).toBe(1);
    expect(day6.day).toBe(6);
    expect(p.days[6].day).toBe(7); // день старта
  });

  it('предупреждение, если нужно согнать больше, чем даёт пик-неделя (~2%)', () => {
    const p = buildPLPeakWeekCutProtocol(100, 90);
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.warnings[0]).toContain('ранней сгонкой');
  });

  it('малый дифферент (<0.3 кг) — подсказка, что манипуляция может не понадобиться', () => {
    const p = buildPLPeakWeekCutProtocol(80.2, 80);
    expect(p.warnings.some(w => w.includes('0.3 кг'))).toBe(true);
  });

  it('summary содержит ключевые цифры протокола', () => {
    const p = buildPLPeakWeekCutProtocol(82, 80);
    expect(p.summary).toContain('2.0 кг');
    expect(p.summary).toContain('вода');
  });
});
