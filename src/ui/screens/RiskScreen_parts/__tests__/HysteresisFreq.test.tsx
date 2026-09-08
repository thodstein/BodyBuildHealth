/**
 * HysteresisFreq.test.tsx — guard на баг: интервал симуляции считался как
 * `freq > 1 ? 24 : 168` от parseFloat. Для продовых форматов это врало:
 * '2x/wk' → 24ч (надо 84ч), 'daily' → 168ч (надо 24ч), 'eod' → 168ч (надо 48ч).
 * После фикса — честный парсинг в инъекции/нед, интервал 168/n.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

let mockCourse: any[] = [
  { substanceId: 'test_enan', doseValue: 250, frequency: '2x/wk', startWeek: 1, endWeek: 12 },
];
let captured: any = null;

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({ course: mockCourse }),
  notifyDataChange: () => {},
}));

vi.mock('../../../../engines/pharma-hysteresis.engine', async (importOriginal) => {
  const mod: any = await importOriginal();
  return {
    ...mod,
    simulateHysteresis: (args: any) => {
      captured = args;
      return mod.simulateHysteresis(args);
    },
  };
});

import { injectionsPerWeek, HysteresisChart } from '../HysteresisChart';

afterEach(() => {
  cleanup();
});

describe('injectionsPerWeek', () => {
  it('1. числа — разы в неделю (паритет старого поведения для 1 и 7)', () => {
    expect(injectionsPerWeek(1)).toBe(1);
    expect(injectionsPerWeek(7)).toBe(7);
    expect(injectionsPerWeek(2)).toBe(2);
  });

  it('2. строковые форматы курса', () => {
    expect(injectionsPerWeek('2x/wk')).toBe(2);
    expect(injectionsPerWeek('2x/week')).toBe(2);
    expect(injectionsPerWeek('3x/week')).toBe(3);
    expect(injectionsPerWeek('daily')).toBe(7);
    expect(injectionsPerWeek('eod')).toBe(3.5);
    expect(injectionsPerWeek('1x/week')).toBe(1);
  });

  it('3. интервалы симуляции: 2x/wk → 84ч, daily → 24ч, eod → 48ч', () => {
    expect(168 / injectionsPerWeek('2x/wk')).toBe(84);
    expect(168 / injectionsPerWeek('daily')).toBe(24);
    expect(168 / injectionsPerWeek('eod')).toBe(48);
    expect(168 / injectionsPerWeek(1)).toBe(168);
  });

  it('4. мусор и пусто — безопасный дефолт 1 раз/нед', () => {
    expect(injectionsPerWeek(undefined)).toBe(1);
    expect(injectionsPerWeek('')).toBe(1);
    expect(injectionsPerWeek('prn')).toBe(1);
  });
});

describe('HysteresisChart wiring', () => {
  it('5. курс 2x/wk симулируется с интервалом 84ч (было 24ч)', () => {
    const { container } = render(<HysteresisChart />);
    expect(captured).not.toBeNull();
    expect(captured.dosingIntervalHours).toBe(84);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('6. id в другом регистре не выпадает из симуляции', () => {
    const prev = mockCourse;
    mockCourse = [
      { substanceId: 'TEST_ENAN', doseValue: 250, frequency: '2x/wk', startWeek: 1, endWeek: 12 },
    ];
    try {
      captured = null;
      const { container } = render(<HysteresisChart />);
      expect(captured).not.toBeNull();
      expect(container.querySelector('svg')).not.toBeNull();
    } finally {
      mockCourse = prev;
    }
  });

  it('7. явно введённая доза 0 не подменяется выдуманными 100 мг', () => {
    const prev = mockCourse;
    mockCourse = [
      { substanceId: 'test_enan', doseValue: 0, frequency: '1x/week', startWeek: 1, endWeek: 12 },
    ];
    try {
      captured = null;
      render(<HysteresisChart />);
      expect(captured).not.toBeNull();
      expect(captured.doseMg).toBe(0);
    } finally {
      mockCourse = prev;
    }
  });
});
