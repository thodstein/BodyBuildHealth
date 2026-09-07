/**
 * TzSnapshotRefresh.test.tsx — guard на баг: снапшот калькулятора читался
 * через useMemo([]) один раз при монтировании. Калькулятор, сохранивший
 * свежий снапшот ПОЗЖЕ, игнорировался (а снапшот приоритетнее живых данных).
 * После фикса — state + storage/focus слушатели.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const stableProfile = { settings: {} };
const stableLabs: any[] = [];
const stableCourse = [
  { substanceId: 'test_enan', doseValue: 500, startWeek: 0, endWeek: 12 },
];

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    profile: stableProfile,
    labs: stableLabs,
    course: stableCourse,
  }),
  notifyDataChange: () => {},
}));

import { RiskSpecMethod } from '../RiskSpecMethod';

const SNAP_INPUT = {
  drugClass: 'aas',
  drugName: 'test_enan',
  dose: 500,
  duration: 12,
  form: 'inject',
  combinations: 1,
  labCoverage: 0.5,
  labValues: {},
  supportSubstances: [],
  drugs: [{ drugClass: 'aas', drugName: 'test_enan', dose: 500, form: 'inject' }],
};

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('RiskSpecMethod snapshot refresh', () => {
  it('1. без снапшота — предупреждение о невыбранной поддержке', () => {
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).toContain('Поддержка не выбрана');
  });

  it('2. снапшот, сохранённый после монтирования, подхватывается по focus', () => {
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).toContain('Поддержка не выбрана');
    localStorage.setItem(
      'he_calc_tz_input',
      JSON.stringify({ input: SNAP_INPUT, ts: Date.now() }),
    );
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(container.textContent).toContain('Цифры идентичны калькулятору');
  });
});
