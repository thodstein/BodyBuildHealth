/**
 * risk-spec-honesty.test.tsx — guard: механизм-модель в «Рисках» честно
 * сообщает, что часть препаратов не смоделирована.
 *
 * Аудит 2026-11: `calculateTzSpecRisk` давно возвращает `riskStatus` и
 * `unmodeledDrugs` (препарат без записи в `DRUG_DB` не даёт вклада), но экран
 * показывал только проценты — «риск 0 %» читался как «всё безопасно».
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const courseBox: { current: any[] } = { current: [] };

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    course: courseBox.current,
    labs: [],
    profile: { settings: { weight: 85 } },
  }),
}));

import { RiskSpecMethod } from '../RiskSpecMethod';

const KNOWN = { id: '1', substanceId: 'test_enan', doseValue: 500, frequency: '2x/wk', startWeek: 1, endWeek: 12 };
const UNKNOWN = { id: '2', substanceId: 'unknown_peptide_xyz', doseValue: 10, frequency: 'daily', startWeek: 1, endWeek: 4 };

describe('RiskSpecMethod: честность расчёта', () => {
  beforeEach(() => {
    localStorage.clear();
    courseBox.current = [];
  });

  it('неизвестный препарат → красная плашка «НЕ рассчитан» + список', () => {
    courseBox.current = [UNKNOWN];
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).toContain('НЕ рассчитан');
    expect(container.textContent).toContain('unknown_peptide_xyz');
  });

  it('смешанный курс → «Расчёт неполный», список не смоделированных', () => {
    courseBox.current = [KNOWN, UNKNOWN];
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).toContain('Расчёт неполный');
    expect(container.textContent).toContain('unknown_peptide_xyz');
  });

  it('все препараты известны → плашек о неполноте нет', () => {
    courseBox.current = [KNOWN];
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).not.toContain('НЕ рассчитан');
    expect(container.textContent).not.toContain('Расчёт неполный');
  });

  it('покрытие механизмов рядом с Kp: «Механизмы: c/t закрыто»', () => {
    courseBox.current = [KNOWN];
    const { container } = render(<RiskSpecMethod />);
    // Механизмы риска у курса есть; без поддержки закрытых 0 — но цифра честная.
    expect(container.textContent).toMatch(/Механизмы: \d+\/\d+ закрыто/);
    // Это отдельная метрика, Kp никуда не исчез.
    expect(container.textContent).toContain('Kp =');
  });
});
