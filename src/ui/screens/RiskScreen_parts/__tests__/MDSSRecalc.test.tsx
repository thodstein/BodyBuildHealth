/**
 * MDSSRecalc.test.tsx — guard на баг: useEffect авто-режима висел на
 * [autoRun, tWeeks, genetics, weeksSinceLab] без labs → правка анализов при
 * включённом авто-режиме молча оставляла старый расчёт. После фикса labs в deps.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Стабильные ссылки (как стор в проде) + мутабельные анализы.
const stableProfile = { settings: {} };
const stableCourse: any[] = [];
let mockLabs: any[] = [];

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    profile: stableProfile,
    labs: mockLabs,
    course: stableCourse,
  }),
  notifyDataChange: () => {},
}));

import { MDSSRiskDisplay } from '../../RiskScreen';

beforeEach(() => {
  mockLabs = [];
});

afterEach(() => {
  cleanup();
});

const EXTREME_LABS = [
  { code: 'ALT', name: 'ALT', value: 150, unit: 'U/L', date: '2026-09-01' },
  { code: 'AST', name: 'AST', value: 120, unit: 'U/L', date: '2026-09-01' },
  { code: 'GGT', name: 'GGT', value: 200, unit: 'U/L', date: '2026-09-01' },
  { code: 'Creatinine', name: 'Creatinine', value: 150, unit: 'umol/L', date: '2026-09-01' },
  { code: 'PSA', name: 'PSA', value: 5, unit: 'ng/mL', date: '2026-09-01' },
  { code: 'LH', name: 'LH', value: 0.5, unit: 'IU/L', date: '2026-09-01' },
  { code: 'HDL', name: 'HDL', value: 30, unit: 'mg/dL', date: '2026-09-01' },
  { code: 'hsCRP', name: 'hsCRP', value: 8, unit: 'mg/L', date: '2026-09-01' },
];

describe('MDSSRiskDisplay auto-recalc', () => {
  it('1. смена анализов в авто-режиме пересчитывает результат', async () => {
    const { container, rerender } = render(<MDSSRiskDisplay />);
    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Запустить анализ'),
      ) as HTMLElement,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Максимальный риск');
    });
    const before = container.textContent;
    mockLabs = [...EXTREME_LABS];
    rerender(<MDSSRiskDisplay />);
    await waitFor(() => {
      expect(container.textContent).not.toBe(before);
    });
  });
});
