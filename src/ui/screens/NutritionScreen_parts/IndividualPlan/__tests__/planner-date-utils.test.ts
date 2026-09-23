/**
 * planner-date-utils.test.ts — P1-fix: локальные ISO-даты планировщика (без UTC-сдвига).
 * Раньше `dt.setDate(...)` + `toISOString()` в UTC+ до ~03:00 отдавал вчерашний день —
 * раскладка недели в дневник/брифинг/файл тренеру съезжали на −1.
 */
import { describe, it, expect } from 'vitest';
import { localIsoDate } from '../planner-date-utils';

describe('localIsoDate: локальные даты без UTC-сдвига', () => {
  it('формат YYYY-MM-DD с нулями', () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('использует ЛОКАЛЬНЫЕ геттеры (совпадает с компонентами даты)', () => {
    const d = new Date(2026, 5, 15, 23, 59, 59);
    const [y, m, day] = localIsoDate(d).split('-').map(Number);
    expect(y).toBe(d.getFullYear());
    expect(m).toBe(d.getMonth() + 1);
    expect(day).toBe(d.getDate());
  });

  it('перенос через границу месяца (setDate) не съезжает', () => {
    const d = new Date(2026, 0, 31);
    d.setDate(d.getDate() + 1);
    expect(localIsoDate(d)).toBe('2026-02-01');
  });

  it('полночь и конец суток — та же календарная дата', () => {
    expect(localIsoDate(new Date(2026, 2, 10, 0, 0))).toBe('2026-03-10');
    expect(localIsoDate(new Date(2026, 2, 10, 23, 59))).toBe('2026-03-10');
  });
});
