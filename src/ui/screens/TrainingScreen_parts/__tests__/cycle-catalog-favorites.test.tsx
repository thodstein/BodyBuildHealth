/**
 * cycle-catalog-favorites.test.tsx — ⭐ избранное в каталоге циклов:
 *  - добавление/удаление через кнопку на карточке (he_cycle_fav);
 *  - секция «⭐ Избранные циклы»;
 *  - чип-фильтр «⭐ Избранное (N)» показывает только избранное.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CycleCatalog } from '../CycleCatalog';

const PROPS = { goal: 'strength', level: 'II-KMS', daysPerWeek: 3 };

describe('CycleCatalog — избранное', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('⭐ на карточке добавляет цикл в избранное (he_cycle_fav)', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByLabelText('В избранное Силовой цикл 1 (троеборье)'));

    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).toContain('cycle-01');

    // Секция избранного и счётчик в чипе
    expect(screen.getByText('⭐ Избранные циклы (1)')).toBeTruthy();
    expect(screen.getByText('⭐ Избранное (1)')).toBeTruthy();
  });

  it('повторный клик убирает из избранного', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByLabelText('В избранное Силовой цикл 1 (троеборье)'));
    fireEvent.click(screen.getAllByLabelText('Убрать из избранного Силовой цикл 1 (троеборье)')[0]);

    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).not.toContain('cycle-01');
    expect(screen.queryByText('⭐ Избранные циклы (1)')).toBeNull();
  });

  it('чип-фильтр «⭐ Избранное» показывает только избранные циклы', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByLabelText('В избранное Силовой цикл 1 (троеборье)'));
    fireEvent.click(screen.getByText('⭐ Избранное (1)'));

    // Избранный цикл виден (карточка в списке или в секции избранного)
    expect(screen.getAllByText('Силовой цикл 1 (троеборье)').length).toBeGreaterThan(0);
    // Неизбранный цикл («Силовой цикл 2») не отображается
    expect(screen.queryAllByText('Силовой цикл 2 (троеборье)').length).toBe(0);
  });
});
