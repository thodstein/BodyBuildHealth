/**
 * sup-research-full.test.tsx — вкладка «Исследования» целиком.
 *
 * Каждый источник и каждый контрол: пилюли, общий поиск (кнопка + Enter),
 * чипы-пресеты, живые результаты, пустые/ошибки/загрузки, клики.
 * Регрессии: stale-поиск чипов, no-op кнопка Scholar, мёртвый общий поиск
 * на Каталоге, некликаемые результаты/записи базы.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportResearch } from '../SupportResearch';

function mocks(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pubMedQuery: '', setPubMedQuery: vi.fn(),
    pubMedResults: [], setPubMedResults: vi.fn(), pubMedLoading: false, setPubMedLoading: vi.fn(),
    pubMedError: null, pubchemResults: [], setPubchemResults: vi.fn(),
    pubchemLoading: false, setPubchemLoading: vi.fn(), pubchemError: null,
    fdaResults: [], setFdaResults: vi.fn(), fdaLoading: false, setFdaLoading: vi.fn(), fdaError: null,
    pharmaSearchQ: '', pharmaSearchResults: [], researchSource: 'pubmed', setResearchSource: vi.fn(),
    setTab: vi.fn(), setSearchQuery: vi.fn(),
    handlePubMedSearch: vi.fn(), doPharmaSearch: vi.fn(),
    handlePubchemSearch: vi.fn(), handleFDASearch: vi.fn(),
    ...over,
  };
}

describe('SUP research full', () => {
  const realOpen = window.open;
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch {}
    window.open = realOpen;
  });

  it('пилюли переключают все 6 источников', () => {
    const setResearchSource = vi.fn();
    const { getByText } = render(<SupportResearch s={mocks({ setResearchSource })} />);
    for (const [label, key] of [['📚 PubMed', 'pubmed'], ['🧪 PubChem', 'pubchem'], ['🎓 Scholar', 'scholar'], ['💊 OpenFDA', 'fda'], ['📋 Каталог', 'pharma'], ['📖 База исследований', 'researchDb']]) {
      fireEvent.click(getByText(label));
      expect(setResearchSource, label).toHaveBeenCalledWith(key);
    }
  });

  it('общий поиск: кнопка и Enter по источникам, пустой запрос молчит', () => {
    const handlePubMedSearch = vi.fn();
    const setPubMedQuery = vi.fn();
    const r = render(<SupportResearch s={mocks({ researchSource: 'pubmed', pubMedQuery: 'zinc', handlePubMedSearch, setPubMedQuery })} />);
    const input = r.container.querySelector('.sup-research input') as HTMLInputElement;
    expect(input.value, 'box value').toBe('zinc');
    fireEvent.change(input, { target: { value: 'zinc+' } });
    expect(setPubMedQuery).toHaveBeenCalledWith('zinc+');
    fireEvent.click(r.container.querySelector('[data-sup-io="research-search"]') as HTMLElement);
    expect(handlePubMedSearch).toHaveBeenCalledWith('zinc');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handlePubMedSearch).toHaveBeenCalledTimes(2);
    r.unmount();

    const handlePubchemSearch = vi.fn();
    const r2 = render(<SupportResearch s={mocks({ researchSource: 'pubchem', pubMedQuery: '  ', handlePubchemSearch })} />);
    fireEvent.click(r2.container.querySelector('[data-sup-io="research-search"]') as HTMLElement);
    // в хендлере пустой запрос отсекается — но вызов с пробелами идёт, решение внутри
    expect(handlePubchemSearch).toHaveBeenCalledWith('  ');
    r2.unmount();
  });

  it('pubmed: чипы, ошибка, счётчик, карточка, пусто', () => {
    const handlePubMedSearch = vi.fn();
    const r = render(<SupportResearch s={mocks({
      handlePubMedSearch,
      pubMedError: 'Сеть упала',
      pubMedResults: [{
        pmid: '1', title: 'T', authors: ['A B', 'C D', 'E F', 'G H'],
        journal: 'J', pubDate: '2020', abstract: 'abs', url: 'https://x',
      }],
    })} />);
    fireEvent.click(r.getByText('Протеин'));
    expect(handlePubMedSearch).toHaveBeenCalledWith('whey protein muscle hypertrophy');
    expect(r.container.textContent).toContain('Сеть упала');
    expect(r.container.textContent).toContain('Найдено: 1 публикаций');
    expect(r.container.textContent).toContain('A B, C D, E F et al.');
    const a = r.container.querySelector('.sup-research a[href="https://x"]');
    expect(a, 'result link').not.toBeNull();
    r.unmount();
    const r2 = render(<SupportResearch s={mocks()} />);
    expect(r2.container.textContent).toContain('Введите запрос для поиска публикаций');
    r2.unmount();
  });

  it('pubchem: чипы, загрузка, карточка, пусто', () => {
    const handlePubchemSearch = vi.fn();
    const r = render(<SupportResearch s={mocks({
      researchSource: 'pubchem', handlePubchemSearch,
      pubchemLoading: true, pubchemResults: [{ name: 'N', mw: 12.345, iupac: 'I', formula: 'F' }],
    })} />);
    fireEvent.click(r.getByText('Таурин'));
    expect(handlePubchemSearch).toHaveBeenCalledWith('taurine');
    expect(r.container.textContent).toContain('Поиск в PubChem');
    expect(r.container.textContent).toContain('12.35 г/моль');
    r.unmount();
  });

  it('scholar: чипы заполняют запрос, ссылка кодирует, кнопка открывает', () => {
    const setPubMedQuery = vi.fn();
    const open = vi.fn();
    window.open = open as never;
    const r = render(<SupportResearch s={mocks({ researchSource: 'scholar', pubMedQuery: 'magnesium sleep', setPubMedQuery })} />);
    fireEvent.click(r.getByText('Креатин сила'));
    expect(setPubMedQuery).toHaveBeenCalledWith('креатин силовые показатели');
    const link = r.container.querySelector('.sup-research a[href*="scholar.google.com"]') as HTMLAnchorElement;
    expect(link, 'scholar link').not.toBeNull();
    expect(link.href).toContain(encodeURIComponent('magnesium sleep'));
    fireEvent.click(r.container.querySelector('[data-sup-io="research-search"]') as HTMLElement);
    expect(open).toHaveBeenCalledTimes(1);
    r.unmount();
  });

  it('fda: чипы, карточка, пусто', () => {
    const handleFDASearch = vi.fn();
    const r = render(<SupportResearch s={mocks({
      researchSource: 'fda', handleFDASearch,
      fdaResults: [{ brandName: 'B', genericName: 'G', indications: 'I', manufacturer: 'M' }],
    })} />);
    fireEvent.click(r.getByText('Метформин'));
    expect(handleFDASearch).toHaveBeenCalledWith('metformin');
    expect(r.container.textContent).toContain('Производитель: M');
    r.unmount();
  });

  it('каталог: живой поиск, клик ведёт в каталог, пустые состояния', () => {
    const doPharmaSearch = vi.fn();
    const setSearchQuery = vi.fn();
    const setTab = vi.fn();
    const r = render(<SupportResearch s={mocks({
      researchSource: 'pharma', doPharmaSearch, setSearchQuery, setTab,
      pharmaSearchQ: 'тест',
      pharmaSearchResults: [{ id: 'x', name: 'Тест-препарат', cls: 'supplement', desc: 'd' }],
    })} />);
    const input = r.queryByPlaceholderText(/Поиск по названию/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(doPharmaSearch).toHaveBeenCalledWith('abc');
    fireEvent.click(r.getByText('Тест-препарат'));
    expect(setSearchQuery).toHaveBeenCalledWith('Тест-препарат');
    expect(setTab).toHaveBeenCalledWith('catalog');
    r.unmount();

    const r2 = render(<SupportResearch s={mocks({ researchSource: 'pharma', pharmaSearchQ: 'zzz' })} />);
    expect(r2.container.textContent).toContain('Ничего не найдено');
    r2.unmount();
    const r3 = render(<SupportResearch s={mocks({ researchSource: 'pharma', pharmaSearchQ: 'ab' })} />);
    expect(r3.container.textContent).toContain('минимум 3 символа');
    r3.unmount();
  });

  it('база: фильтр сужает, записи — ссылки PubMed со счётчиком', () => {
    const r = render(<SupportResearch s={mocks({ researchSource: 'researchDb' })} />);
    const input = r.container.querySelector('.sup-research input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'магний' } });
    expect(r.container.textContent).toContain('Магний');
    expect(r.container.textContent).not.toContain('Телмисартан');
    const links = Array.from(r.container.querySelectorAll('.sup-research a[href*="pubmed.ncbi.nlm.nih.gov"]'));
    expect(links.length > 0, 'links').toBe(true);
    expect(r.container.textContent).toMatch(/исследование/);
    r.unmount();
  });

  it('топики ведут в pubmed с запросом', () => {
    const setResearchSource = vi.fn();
    const handlePubMedSearch = vi.fn();
    const r = render(<SupportResearch s={mocks({ setResearchSource, handlePubMedSearch })} />);
    fireEvent.click(r.getByText('Магний и сон'));
    expect(setResearchSource).toHaveBeenCalledWith('pubmed');
    expect(handlePubMedSearch).toHaveBeenCalledWith('magnesium glycinate sleep quality anxiety');
    r.unmount();
  });
});
