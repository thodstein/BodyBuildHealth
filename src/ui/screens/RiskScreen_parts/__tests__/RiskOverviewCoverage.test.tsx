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
    const { container } = render(
      <RiskOverview
        riskResult={mockResult({ cardio: 0.8, hepatic: 0 })}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
      />,
    );
    // Секция открыта по умолчанию — без кликов.
    expect(container.textContent).toContain('80%');
  });

  it('2. без покрытия — честные нули, а не мусор', () => {
    const { container } = render(
      <RiskOverview
        riskResult={mockResult({})}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
      />,
    );
    expect(container.textContent).toContain('0%');
    expect(container.textContent).not.toContain('NaN');
  });

  it('3. секция сворачивается по клику', () => {
    const { getByText, queryByText } = render(
      <RiskOverview
        riskResult={mockResult({ cardio: 0.8 })}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
      />,
    );
    expect(queryByText(/Сердце/)).not.toBeNull();
    // Заголовок — «Снижение риска поддержкой»: число здесь = доля снижения
    // риска по системе, а не доля закрытых механизмов (аудит 2026-11).
    fireEvent.click(getByText('Снижение риска поддержкой'));
    expect(queryByText(/Сердце/)).toBeNull();
  });

  it('4. покрытие механизмов — отдельной строкой, не вместо «снижения риска»', () => {
    const { container } = render(
      <RiskOverview
        riskResult={mockResult({ cardio: 0.8 })}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
        mechanismCoverage={{ covered: 3, total: 6, percent: 50 }}
      />,
    );
    expect(container.textContent).toContain('Механизмы риска: закрыто 3 из 6 (50%)');
    expect(container.textContent).toContain('80%'); // снижение риска по cardio не подменяется
  });

  it('5. без покрытия механизмов строки нет, «0 из 0» не выводится', () => {
    const { container } = render(
      <RiskOverview
        riskResult={mockResult({})}
        globalNoLabs={false}
        noLabsSystems={[]}
        labRiskContributions={null}
        mechanismCoverage={{ covered: 0, total: 0, percent: 0 }}
      />,
    );
    expect(container.textContent).not.toContain('Механизмы риска');
  });
});
