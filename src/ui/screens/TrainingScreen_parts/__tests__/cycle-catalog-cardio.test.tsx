/**
 * cycle-catalog-cardio.test.tsx — кардио в общем каталоге циклов:
 *  - раздел «Кардио» (35 именных) на месте; «Все» показывает 4 библиотеки;
 *  - поиск/вид/уровень/избранное (префикс cardio:) работают;
 *  - кнопка моста пишет cardio-template-pending + трек cardio + событие + баннер;
 *  - matchCardioLevel/matchCardioPeriod маппят LMS-фильтры.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import {
  CycleCatalog,
  matchCardioLevel,
  matchCardioPeriod,
} from '../CycleCatalog';
import { CARDIO_CYCLES } from '../../../../data/cardio-cycles/cardio-cycle-index';
import { consumeCardioTemplatePending } from '../../../../engines/lms/cardio-cycle-bridge';

const PROPS = { goal: 'strength', level: 'II-KMS', daysPerWeek: 3 };

describe('CycleCatalog — кардио', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('библиотека содержит 35 циклов', () => {
    expect(CARDIO_CYCLES.length).toBe(35);
  });

  it('«Все» показывает заголовок кардио со счётчиком', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    const head = container.querySelector('.lib-cardio-group')?.textContent || '';
    expect(head).toContain('Кардио');
    expect(head).toContain(String(CARDIO_CYCLES.length));
  });

  it('раздел «Кардио» показывает именные циклы и прячет LMS', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Кардио'));
    expect(screen.getByText('Хигдон Half Novice 1 — 12 недель (первый полумарафон)')).toBeTruthy();
    expect(screen.getByText('Pete Plan — 12 недель (гребля на результат)')).toBeTruthy();
    expect(screen.queryByText('Силовой цикл 1 (троеборье)')).toBeNull();
  });

  it('поиск фильтрует кардио-раздел', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Кардио'));
    const search = container.querySelector('.lib-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'half novice 1' } });
    expect(screen.getByText('Хигдон Half Novice 1 — 12 недель (первый полумарафон)')).toBeTruthy();
    expect(screen.queryByText('Pete Plan — 12 недель (гребля на результат)')).toBeNull();
  });

  it('вид «Гребля» оставляет только row-циклы', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Кардио'));
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    fireEvent.click(within(filters).getByText('Гребля'));
    expect(screen.getByText('Pete Plan — 12 недель (гребля на результат)')).toBeTruthy();
    expect(screen.queryByText('Хигдон Half Novice 1 — 12 недель (первый полумарафон)')).toBeNull();
  });

  it('⭐ кардио-цикла пишется с префиксом cardio: и видна в избранном', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Кардио'));
    fireEvent.click(screen.getByLabelText('В избранное Pete Plan — 12 недель (гребля на результат)'));
    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).toContain('cardio:cardio-pro-pete-full-12');
    expect(screen.getByText('⭐ Избранные циклы (1)')).toBeTruthy();
  });

  it('карточка отправляет мост в кардио-конструктор: pending + трек + событие + баннер', () => {
    let detail: unknown = null;
    const h = (e: Event) => { detail = (e as CustomEvent).detail; };
    window.addEventListener('planning-track-open', h);
    try {
      render(<CycleCatalog {...PROPS} />);
      fireEvent.click(screen.getByText('Кардио'));
      fireEvent.click(screen.getByText('Pete Plan — 12 недель (гребля на результат)'));
      fireEvent.click(screen.getByText('🏃 Собрать в кардио-конструкторе →'));
      expect(consumeCardioTemplatePending()).toBe('cardio-pro-pete-full-12');
      expect(localStorage.getItem('he_training_planning_track')).toBe('cardio');
      expect(detail).toBe('cardio');
      expect(screen.getByRole('status').textContent).toContain('кардио-конструктор');
    } finally {
      window.removeEventListener('planning-track-open', h);
    }
  });

  it('matchCardioLevel/matchCardioPeriod маппят LMS-фильтры', () => {
    const c25k = CARDIO_CYCLES.find(c => c.meta.id === 'cardio-run-c25k-9')!;
    expect(matchCardioLevel(c25k, 'all')).toBe(true);
    expect(matchCardioLevel(c25k, 'novice')).toBe(true);
    expect(matchCardioLevel(c25k, 'MS-MSMK')).toBe(false);
    const daniels = CARDIO_CYCLES.find(c => c.meta.id === 'cardio-pro-daniels-5k-24')!;
    expect(matchCardioLevel(daniels, 'MS-MSMK')).toBe(true);
    expect(matchCardioLevel(daniels, 'novice')).toBe(false);
    expect(matchCardioPeriod(c25k, 'all')).toBe(true);
    expect(matchCardioPeriod(c25k, 'endurance')).toBe(true);
    expect(matchCardioPeriod(c25k, 'peak')).toBe(false);
    const peak = CARDIO_CYCLES.find(c => c.meta.id === 'cardio-pro-tri-sprint-8')!;
    expect(matchCardioPeriod(peak, 'mixed')).toBe(true);
  });
});
