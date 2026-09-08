/**
 * risk-coverage-double.test.tsx — P0: RiskOverview двойной учёт поддержки
 * До: riskVal=net(30) * (1-0.5)=15 → показывал 30→15 (×2)
 * После: raw 60 → net 30
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskOverview } from '../screens/RiskScreen_parts/RiskOverview';

const mockRiskResult: any = {
  overallRaw: 40,
  overallNet: 30,
  systemBreakdown: {
    cardio: { raw: 60, net: 30 },
    hepatic: { raw: 40, net: 20 },
    renal: { raw: 20, net: 20 },
  },
  coverageMap: { cardio: 0.5, hepatic: 0.5, renal: 0 },
};

describe('RiskOverview coverage P0', () => {
  it('баг: net*(1-coverage) давал 15 вместо 30', () => {
    const riskVal = 30;
    const coverage = 0.5;
    const buggy = Math.max(0, riskVal * (1 - coverage));
    expect(buggy).toBe(15);
    const raw = 60;
    const fixed = 30; // raw*(1-0.5)
    expect(fixed).toBe(30);
    expect(buggy).not.toBe(fixed);
  });

  it('фикс: показывает raw→net 60→30, а не 30→15', () => {
    const { container } = render(
      <RiskOverview
        riskResult={mockRiskResult}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
        aggregatedRisk={null}
        weeklyDynamics={null}
      />,
    );
    // cardio should show 60→30
    expect(container.textContent).toContain('60% → 30%');
    expect(container.textContent).not.toContain('30% → 15%');
  });
});
