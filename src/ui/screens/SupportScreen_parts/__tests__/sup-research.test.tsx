/**
 * sup-research.test.tsx — «Исследования»: клики и поиск по всем источникам.
 *
 * Классы багов:
 * 1. Чипы-пресеты звали setQuery + handler подряд — handler читал СТАРЫЙ
 *    запрос из стейта (на пустом поле — вообще ничего не происходило).
 *    Фикс: хендлеры принимают явный q, чипы передают свой запрос.
 * 2. На табе Scholar кнопка поиска была no-op; на табе Каталог общий
 *    поиск дублировал живой поиск и тоже ничего не делал.
 * 3. Результаты Каталога кликались только для PHARMA_DB, остальные молча.
 * 4. Записи базы исследований — некликаемые div без ссылки на источник.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportResearch } from '../SupportResearch';

const noop = () => {};

function researchMocks(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pubMedQuery: '', setPubMedQuery: noop,
    pubMedResults: [], setPubMedResults: noop, pubMedLoading: false, setPubMedLoading: noop,
    pubMedError: null, pubchemResults: [], setPubchemResults: noop,
    pubchemLoading: false, setPubchemLoading: noop, pubchemError: null,
    fdaResults: [], setFdaResults: noop, fdaLoading: false, setFdaLoading: noop, fdaError: null,
    pharmaSearchQ: '', pharmaSearchResults: [], researchSource: 'pubmed', setResearchSource: noop,
    setTab: noop, setSearchQuery: noop,
    handlePubMedSearch: noop, doPharmaSearch: noop, handlePubchemSearch: noop, handleFDASearch: noop,
    ...over,
  };
}

describe('SUP research sources', () => {
  const realOpen = window.open;
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
    window.open = realOpen;
  });

  it('пресет PubMed ищет СВОЙ запрос, а не stale-стейт', () => {
    const handlePubMedSearch = vi.fn();
    const { getByText } = render(
      <SupportResearch s={researchMocks({ handlePubMedSearch })} />,
    );
    fireEvent.click(getByText('Креатин'));
    expect(handlePubMedSearch).toHaveBeenCalledWith('creatine supplementation strength performance');
  });

  it('пресеты PubChem/FDA/тем ищут свой запрос', () => {
    const handlePubchemSearch = vi.fn();
    const r1 = render(<SupportResearch s={researchMocks({ researchSource: 'pubchem', handlePubchemSearch })} />);
    fireEvent.click(r1.getByText('Кофеин'));
    expect(handlePubchemSearch).toHaveBeenCalledWith('caffeine');
    r1.unmount();

    const handleFDASearch = vi.fn();
    const r2 = render(<SupportResearch s={researchMocks({ researchSource: 'fda', handleFDASearch })} />);
    fireEvent.click(r2.getByText('Аспирин'));
    expect(handleFDASearch).toHaveBeenCalledWith('aspirin');
    r2.unmount();

    const handlePubMedSearch = vi.fn();
    const r3 = render(<SupportResearch s={researchMocks({ handlePubMedSearch })} />);
    fireEvent.click(r3.getByText('Магний и сон'));
    expect(handlePubMedSearch).toHaveBeenCalledWith('magnesium glycinate sleep quality anxiety');
    r3.unmount();
  });

  it('scholar: кнопка открывает Scholar с запросом, а не молчит', () => {
    const open = vi.fn();
    window.open = open as never;
    const { container } = render(
      <SupportResearch s={researchMocks({ researchSource: 'scholar', pubMedQuery: 'magnesium sleep' })} />,
    );
    const btn = container.querySelector('[data-sup-io="research-search"]') as HTMLElement;
    expect(btn, 'shared search btn').not.toBeNull();
    fireEvent.click(btn);
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toContain('scholar.google.com/scholar?q=');
    expect(String(open.mock.calls[0][0])).toContain(encodeURIComponent('magnesium sleep'));
  });

  it('каталог: общий мёртвый поиск скрыт, свой живой на месте', () => {
    const { container, queryByPlaceholderText } = render(
      <SupportResearch s={researchMocks({ researchSource: 'pharma' })} />,
    );
    expect(container.querySelector('[data-sup-io="research-search"]'), 'no shared btn').toBeNull();
    expect(queryByPlaceholderText(/Поиск по названию/), 'pharma input').not.toBeNull();
  });

  it('клик по результату каталога ведёт в каталог с поиском', () => {
    const setSearchQuery = vi.fn();
    const setTab = vi.fn();
    const { getByText } = render(
      <SupportResearch
        s={researchMocks({
          researchSource: 'pharma', pharmaSearchQ: 'тест', setSearchQuery, setTab,
          pharmaSearchResults: [{ id: 'test_x', name: 'Тест-препарат', cls: 'supplement', desc: '' }],
        })}
      />,
    );
    fireEvent.click(getByText('Тест-препарат'));
    expect(setSearchQuery).toHaveBeenCalledWith('Тест-препарат');
    expect(setTab).toHaveBeenCalledWith('catalog');
  });

  it('база исследований: записи — ссылки в PubMed', () => {
    const { container } = render(
      <SupportResearch s={researchMocks({ researchSource: 'researchDb' })} />,
    );
    const links = Array.from(container.querySelectorAll('.sup-research a[href*="pubmed.ncbi.nlm.nih.gov"]')) as HTMLAnchorElement[];
    expect(links.length > 0, 'pubmed links exist').toBe(true);
    for (const a of links.slice(0, 5)) {
      expect(a.getAttribute('target')).toBe('_blank');
    }
  });

  it('чипы-пресеты — тапы 40px+', () => {
    const { container } = render(<SupportResearch s={researchMocks()} />);
    const chips = Array.from(container.querySelectorAll('.sup-research button')).filter((b) =>
      /Креатин|Протеин|Бета-аланин/.test((b.textContent || '')),
    ) as HTMLElement[];
    expect(chips.length, 'preset chips').toBeGreaterThan(0);
    for (const c of chips) {
      const m = String(c.style.minHeight || '').match(/^(\d+(?:\.\d+)?)px$/);
      expect(m && parseFloat(m[1]) >= 40, `chip "${(c.textContent || '').slice(0, 16)}" minHeight=${c.style.minHeight}`).toBeTruthy();
    }
  });
});
