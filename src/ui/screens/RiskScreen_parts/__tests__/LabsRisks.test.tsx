/**
 * LabsRisks.test.tsx — guard на P0-баг: LAB_SYSTEM_GROUPS объявлялась ПОСЛЕ
 * labRisks-useMemo → TDZ ReferenceError глотался try/catch → при реальных
 * анализах секции показывали «всё в норме». После фикса — честный разбор.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    profile: { settings: { phase: 'on_cycle' } },
    labs: [{ code: 'ALT', name: 'АЛТ', value: 120, unit: 'U/L', date: '2026-09-01' }],
    course: [],
  }),
  notifyDataChange: () => {},
}));

import { LabsRisksTab } from '../../RiskScreen';

afterEach(() => {
  cleanup();
});

describe('LabsRisksTab с реальными анализами', () => {
  it('1. отклонённый маркер виден, а не «все маркеры в норме»', () => {
    const { getByText, queryByText, container } = render(<LabsRisksTab />);
    expect(getByText('Маркеры с отклонениями')).not.toBeNull();
    // АЛТ 120 при норме 7–40 → +200%
    expect(container.textContent).toContain('АЛТ');
    expect(container.textContent).toContain('↑200%');
    expect(queryByText('Все маркеры в норме')).toBeNull();
  });

  it('2. система-печень не притворяется «всё в норме» без данных', () => {
    const { getByText } = render(<LabsRisksTab />);
    expect(getByText('Риски по системам организма')).not.toBeNull();
  });
});
