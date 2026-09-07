/**
 * RiskOverviewCoverage.test.tsx — guard на баг: riskResult собирался без
 * coverageMap (data-link считает покрытие, но RiskScreen его не прокидывал) →
 * секция «Покрытие поддержкой» всегда показывала 0% при любой поддержке.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { RiskOverview } from '../RiskOverview';
import type { RiskResult } from '../../../core/types';

afterEach(() => {
  cleanup();
});

function mockResult(coverageMap: Record<string, number>): RiskResult {
  return {
    overallRaw: 30,
    overallNet: 25,
    systemBreakdown: {},
    coverageMap,
  } as unknown as RiskResult;
}

describe('RiskOverview support coverage', () => {
  it('1. покрытие из coverageMap отображается (0.8 → 80%)', () => {
    const { getByText, container } = render(
      <RiskOverview
        riskResult={mockResult({ cardio: 0.8, hepatic: 0 })}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
      />,
    );
    fireEvent.click(getByText('Покрытие поддержкой'));
    expect(container.textContent).toContain('80%');
  });

  it('2. без покрытия — честные нули, а не мусор', () => {
    const { getByText, container } = render(
      <RiskOverview
        riskResult={mockResult({})}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
      />,
    );
    fireEvent.click(getByText('Покрытие поддержкой'));
    expect(container.textContent).toContain('0%');
    expect(container.textContent).not.toContain('NaN');
  });
});
