/**
 * training-library-filter-guards.test.tsx — guard-тесты «пусто по фильтрам»:
 *  - в разделе ТА·Стронг нет опций, гарантирующих пусто (Выносливость / 2 дн/нед / 13+ нед);
 *  - несочетаемые остатки фильтров клампятся при смене раздела (а не дают «Ничего не найдено»).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CycleCatalog } from '../CycleCatalog';

const PROPS = { goal: 'strength', level: 'II-KMS', daysPerWeek: 3 };

/** Клик по чипу фильтра (тексты чипов дублируются мета-чипами карточек — скоупим на .lib-filters). */
function clickFilterChip(container: HTMLElement, label: string): void {
  const filters = container.querySelector('.lib-filters');
  if (!filters) throw new Error('.lib-filters not found');
  fireEvent.click(within(filters as HTMLElement).getByText(label));
}

describe('Библиотека — фильтры без гарантированного пусто', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('ТА·Стронг не предлагает пустые опции (период/частота/длительность)', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('ТА·Стронг'));
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    expect(filters.textContent).not.toContain('Выносливость');
    expect(filters.textContent).not.toContain('2 дн/нед');
    expect(filters.textContent).not.toContain('13+ нед');
    // Валидные опции на месте
    expect(filters.textContent).toContain('3 дн/нед');
    expect(filters.textContent).toContain('9–12 нед');
    cleanup();
  });

  it('Арм показывает полные шкалы частоты и длительности', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Арм'));
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    expect(filters.textContent).toContain('2 дн/нед');
    expect(filters.textContent).toContain('13+ нед');
    cleanup();
  });

  it('stale «Выносливость» клампится при переходе в ТА·Стронг', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    clickFilterChip(container, 'Выносливость');
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    fireEvent.click(screen.getByText('ТА·Стронг'));
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(container.querySelector('.lib-strong-group')).not.toBeNull();
    cleanup();
  });

  it('stale «2 дн/нед» клампится при переходе в ТА·Стронг', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    clickFilterChip(container, '2 дн/нед');
    fireEvent.click(screen.getByText('ТА·Стронг'));
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(container.querySelector('.lib-strong-group')).not.toBeNull();
    cleanup();
  });

  it('stale «13+ нед» клампится при переходе в ТА·Стронг', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    clickFilterChip(container, '13+ нед');
    fireEvent.click(screen.getByText('ТА·Стронг'));
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(container.querySelector('.lib-strong-group')).not.toBeNull();
    cleanup();
  });

  it('сочетаемый фильтр переживает смену раздела (5 дн/нед → ТА·Стронг)', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    clickFilterChip(container, '5 дн/нед');
    fireEvent.click(screen.getByText('ТА·Стронг'));
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(container.querySelector('.lib-strong-group')).not.toBeNull();
    cleanup();
  });
});
