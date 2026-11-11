/**
 * tz-risk-card-derived.test.tsx — guard честности покрытия в карточке риска.
 *
 * У части каталога (521 вещество) нет кураторской записи механизмов: они
 * выводятся из токенов каталога (`deriveFromCatalog`, q='C', k ≤ 0.12).
 * Такая поддержка влияет на процент, но это ОЦЕНКА, а не доказательная база.
 * Карточка обязана подписать её словами — иначе «Kp = N%» выглядит как
 * посчитанный по ТЗ-таблице.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TzRiskCard } from '../TzRiskCard';
import type { TzSpecResult } from '../../../../engines/risk-engine-tz-spec';

function makeTz(extra: Partial<TzSpecResult> = {}): TzSpecResult {
  return {
    organs: [],
    overallRaw: 40,
    overallAfter: 30,
    overallCategory: 'умеренный',
    k_protect_overall: 20,
    d_cov: 0.5,
    u_i: 1.1,
    supportCount: 1,
    explanation: '',
    overallVerification: 0.5,
    riskStatus: 'ok',
    unmodeledDrugs: [],
    unmappedSupport: [],
    derivedSupport: [],
    ...extra,
  } as TzSpecResult;
}

afterEach(() => cleanup());

describe('TzRiskCard: оценочное покрытие', () => {
  it('derivedSupport → строка «Оценочно» со списком веществ', () => {
    const { container } = render(
      <TzRiskCard tz={makeTz({ derivedSupport: ['ginger', 'berberine'] })} before={40} after={30} />,
    );
    expect(container.textContent).toContain('Оценочно');
    expect(container.textContent).toContain('ginger');
    expect(container.textContent).toContain('berberine');
  });

  it('без производных веществ строки нет', () => {
    const { container } = render(<TzRiskCard tz={makeTz()} before={40} after={30} />);
    expect(container.textContent).not.toContain('Оценочно');
  });

  it('кураторская поддержка без производных — нет ложной подписи', () => {
    const { container } = render(
      <TzRiskCard tz={makeTz({ supportCount: 2 })} before={40} after={30} />,
    );
    expect(container.textContent).toContain('Поддержка: 2 веществ');
    expect(container.textContent).not.toContain('Оценочно');
  });
});
