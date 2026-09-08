/**
 * TzWeeklyTail.test.tsx — guard на баг: график динамики обрезался фиксированными
 * +4 неделями после конца курса, хвост смыва длинных эфиров не влезал
 * (энантат T½~2 нед → +6 нед хвоста: было видно до 16-й, надо до 18-й).
 * После фикса — хвост 3 полувыведения на препарат, как maxEnd движка.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

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

describe('RiskSpecMethod weekly tail', () => {
  it('1. хвост смыва энантата виден до 18-й недели (12 + 3×T½)', () => {
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).toContain('Динамика риска по неделям');
    expect(container.textContent).toContain('Нед 18');
  });
});
