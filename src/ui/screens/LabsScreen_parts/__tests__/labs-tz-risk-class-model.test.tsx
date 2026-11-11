/**
 * labs-tz-risk-class-model.test.tsx — guard на «0% как безопасный курс».
 *
 * Вкладка «Риски (ТЗ)» в лабораториях считала механизм-модель с
 * `drugName:'custom'`. Записи `custom` в `DRUG_DB` нет → все веса 28 механизмов
 * равны 0 → экран показывал «0% → 0%» без единого предупреждения, то есть
 * выдуманное «всё безопасно». Теперь классу соответствует реальный препарат
 * (`REP_DRUG`), и он обязан существовать в `DRUG_DB` с механизмами.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    profile: { settings: { personal: { sex: 'male' } } },
    labs: [],
    course: [],
  }),
  notifyDataChange: () => {},
}));

import { LabsTzRiskTab, REP_DRUG } from '../LabsTzRiskTab';
import { DRUG_DB } from '../../../../data/support-db';

afterEach(() => cleanup());

describe('LabsTzRiskTab: препарат-модель класса', () => {
  it('каждый REP_DRUG есть в DRUG_DB и имеет веса механизмов', () => {
    for (const rep of Object.values(REP_DRUG)) {
      const entry = (DRUG_DB as any)[rep.id];
      expect(entry, `нет ${rep.id} в DRUG_DB`).toBeDefined();
      expect(Object.keys(entry.mechanismWeights || {}).length, `пустые веса ${rep.id}`).toBeGreaterThan(0);
    }
  });

  it('ААС-модель — тестостерон энантат, инсулин — не пустой класс', () => {
    expect(REP_DRUG.aas.id).toBe('test_enan');
    expect(REP_DRUG.gh.id).toBe('hgh');
    expect(REP_DRUG.insulin.id).toMatch(/^ins_/);
  });

  it('расчёт по классу даёт ненулевой риск, а не «НЕ рассчитан»', () => {
    const { container, getByText } = render(<LabsTzRiskTab />);
    expect(container.textContent).toContain('Модель класса');
    fireEvent.click(getByText(/Рассчитать/));

    expect(container.textContent).not.toContain('Риск НЕ рассчитан');
    const m = container.textContent?.match(/Без поддержки\s*(\d+(?:\.\d+)?)%/);
    expect(m, 'итоговый риск «без поддержки» не найден').not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(0);
  });
});
