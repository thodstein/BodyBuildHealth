/**
 * V7WeeklyScale.test.tsx — guard на P1-баг: weeklyGlobalData.raw — доля 0–1
 * (выход sigmoid), а шапка среза форматировала её как проценты 0–100
 * (fmtPct100 вместо fmtPct01): при raw 0.45 показывало «0%» вместо «45%».
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { V7RiskDisplay } from '../V7RiskDisplay';

afterEach(() => {
  cleanup();
});

const MOCK_RESULT = {
  matrix: { systems: {}, overallNet: 40 },
  organSummary: {
    heart: { meanS: 0.5, acute: 0.1, chronic: 0.1, fibrosis: 0.1, mechanisms: {} },
  },
  globalRiskRaw: 45,
  globalRiskNet: 40,
  globalPEvent: 0.2,
  dataQuality: 0.8,
  organs: [],
  mcResult: null,
  pkTimeSeries: {},
  weeklyOrganData: { heart: [0.4, 0.5, 0.6] },
  weeklyGlobalData: [
    { raw: 0.4, net: 40 },
    { raw: 0.45, net: 45 },
    { raw: 0.5, net: 50 },
  ],
} as any;

describe('V7RiskDisplay weekly raw scale', () => {
  it('1. срез недели показывает raw как проценты доли (0.45 → 45%)', () => {
    const { container } = render(
      <V7RiskDisplay result={MOCK_RESULT} organWeek={2} onWeekChange={() => {}} />,
    );
    const rawLine = Array.from(container.querySelectorAll('div')).find((d) =>
      d.textContent?.startsWith('Общий риск (raw):'),
    );
    expect(rawLine).not.toBeUndefined();
    expect(rawLine?.textContent).toContain('45%');
  });
});
