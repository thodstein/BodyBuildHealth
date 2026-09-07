/**
 * RiskDetails.test.tsx — Детали рисков: кнопки «Развернуть все / Свернуть».
 * Только подача (8 систем, 44px, белый текст), логика движков не тронута.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { RiskDetails } from '../RiskDetails';
import type { RiskResult } from '../../../core/types';

const CORES = [
  'cardio',
  'hepatic',
  'renal',
  'neuro',
  'endocrine',
  'hematologic',
  'reproductive',
  'musculoskeletal',
];

function mockResult(): RiskResult {
  const systemBreakdown: Record<string, { raw: number; net: number }> = {};
  for (const s of CORES) systemBreakdown[s] = { raw: 30, net: 30 };
  return {
    overallRaw: 30,
    overallNet: 30,
    systemBreakdown,
  } as unknown as RiskResult;
}

afterEach(() => {
  cleanup();
});

describe('RiskDetails expand-all', () => {
  it('1. по умолчанию раскрыта только первая система', () => {
    const { getAllByText } = render(
      <RiskDetails
        riskResult={mockResult()}
        labRiskContributions={null}
        isSyntheticLab={false}
      />,
    );
    // «⚙️ Механизмы» рендерится только внутри раскрытой системы (cardio)
    expect(getAllByText('⚙️ Механизмы').length).toBe(1);
  });

  it('2. «Развернуть все» раскрывает 8 систем, «Свернуть» закрывает', () => {
    const { getAllByText, queryAllByText, getByText } = render(
      <RiskDetails
        riskResult={mockResult()}
        labRiskContributions={null}
        isSyntheticLab={false}
      />,
    );
    fireEvent.click(getByText('▼ Развернуть все'));
    expect(getAllByText('⚙️ Механизмы').length).toBe(8);
    fireEvent.click(getByText(/▲ Свернуть/));
    expect(queryAllByText('⚙️ Механизмы').length).toBe(0);
  });
});
