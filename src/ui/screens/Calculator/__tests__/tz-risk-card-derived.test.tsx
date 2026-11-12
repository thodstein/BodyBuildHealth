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

describe('TzRiskCard: непокрытое разделено на «пробел» и «сопутствующий препарат»', () => {
  it('вещество поддержки без механизмов — «не участвуют в покрытии»', () => {
    const { container } = render(
      <TzRiskCard tz={makeTz({ unmappedSupport: ['some_unknown_herb'] })} before={40} after={30} />,
    );
    expect(container.textContent).toContain('Не участвуют в покрытии');
    expect(container.textContent).toContain('some_unknown_herb');
    expect(container.textContent).not.toContain('Сопутствующие препараты');
  });

  it('НПВС/ГКС подписаны как сопутствующие, а не как дыра в данных', () => {
    const { container } = render(
      <TzRiskCard tz={makeTz({ unmappedSupport: ['ibuprofen', 'prednisone'] })} before={40} after={30} />,
    );
    expect(container.textContent).toContain('Сопутствующие препараты');
    expect(container.textContent).toContain('ibuprofen');
    expect(container.textContent).toContain('prednisone');
    // «Не участвуют в покрытии (нет привязки к 28 механизмам)» — не про них.
    expect(container.textContent).not.toContain('Не участвуют в покрытии');
  });

  it('смешанный список показывает обе строки', () => {
    const { container } = render(
      <TzRiskCard tz={makeTz({ unmappedSupport: ['ibuprofen', 'some_unknown_herb'] })} before={40} after={30} />,
    );
    expect(container.textContent).toContain('Не участвуют в покрытии');
    expect(container.textContent).toContain('Сопутствующие препараты');
  });
});

describe('TzRiskCard: покрытие механизмов отдельно от «100 − риск»', () => {
  const mech = (id: string, raw: number, k_used: number) => ({
    id, name: id, weight: 1, m_i: 1, E_i: 1, raw, afterSupport: raw, k_used,
    q_label: '', rawPercent: raw, afterPercent: raw,
  });

  it('считает только механизмы с риском и подписывает числитель/знаменатель', () => {
    const tz = makeTz({
      organs: [
        { id: 'cardio', label: 'Сердце', maxRaw: 100, rawScore: 10, rawPercent: 10, afterScore: 5, afterPercent: 5, k_protect: 50,
          mechanisms: [mech('cv1', 5, 40), mech('cv2', 3, 0), mech('cv3', 0, 0)] } as any,
      ],
    });
    const { container } = render(<TzRiskCard tz={tz} before={40} after={30} />);
    expect(container.textContent).toContain('Механизмы: 1/2 закрыто');
  });

  it('нет механизмов риска (например, no_data) — строки нет', () => {
    const { container } = render(<TzRiskCard tz={makeTz({ riskStatus: 'no_data' })} before={0} after={0} />);
    expect(container.textContent).not.toContain('Механизмы:');
  });
});
