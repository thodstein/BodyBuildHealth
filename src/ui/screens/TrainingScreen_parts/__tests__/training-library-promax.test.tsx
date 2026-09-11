/**
 * training-library-promax.test.tsx — guard-хуки PRO-MAX визуала библиотеки:
 *  - сегменты каталога/галереи несут data-active + aria-pressed;
 *  - звёзды избранного несут data-fav;
 *  - карточки циклов — .pl-expandcard внутри .train-library;
 *  - строки каталога упражнений несут data-sel.
 * Логика/тексты не меняются — только наличие хуков для APK-CSS (§88).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CycleCatalog } from '../CycleCatalog';
import { ManualLibraryGallery } from '../ManualLibraryGallery';
import ExerciseLabCatalog from '../ExerciseLabCatalog';

const PROPS = { goal: 'strength', level: 'II-KMS', daysPerWeek: 3 };

describe('Библиотека PRO-MAX — хуки', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('сегменты каталога: data-active на активном + переключение', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    const seg = container.querySelector('.lib-seg') as HTMLElement;
    const btns = within(seg).getAllByRole('button');
    // 6 сегментов: Все/Силовые/Бодибилдинг/Арм/ТА·Стронг/Кардио (кардио-таб добавлен позже теста)
    expect(btns.length).toBe(6);
    expect(btns[0].getAttribute('data-active')).toBe('true');
    expect(btns[0].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(seg).getByText('Арм'));
    const after = within(container.querySelector('.lib-seg') as HTMLElement).getAllByRole('button');
    expect(after[0].getAttribute('data-active')).toBe('false');
    expect(after[3].getAttribute('data-active')).toBe('true');
  });

  it('звёзды избранного: data-fav отражает состояние', () => {
    render(<CycleCatalog {...PROPS} />);
    const favBtn = screen.getByLabelText('В избранное Силовой цикл 1 (троеборье)');
    expect(favBtn.getAttribute('data-fav')).toBe('false');
    fireEvent.click(favBtn);
    expect(screen.getAllByLabelText('Убрать из избранного Силовой цикл 1 (троеборье)')[0].getAttribute('data-fav')).toBe('true');
  });

  it('карточки циклов — .pl-expandcard внутри .train-library', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    const root = container.querySelector('.train-library, .lib-cycles, .train-cycles');
    expect(root).not.toBeNull();
    expect(container.querySelectorAll('.pl-expandcard').length).toBeGreaterThan(0);
  });

  it('галерея: сегменты с data-active', () => {
    const noop = () => undefined;
    const { container } = render(
      <ManualLibraryGallery bbPrograms={[]} plCycles={[]} onSelectBB={noop} onSelectPL={noop} />,
    );
    const seg = container.querySelector('.lib-manlib .lib-seg') as HTMLElement;
    expect(seg).not.toBeNull();
    // Табы галереи несут role="tab" (a11y), а не role="button"
    const btns = within(seg).getAllByRole('tab');
    expect(btns[0].getAttribute('data-active')).toBe('true');
    expect(btns[1].getAttribute('data-active')).toBe('false');
  });

  it('каталог упражнений: строки с data-sel, выбор переворачивает флаг', () => {
    const { container } = render(<ExerciseLabCatalog />);
    const cards = container.querySelectorAll('.lib-excard');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].getAttribute('data-sel')).toBe('false');
    fireEvent.click(cards[0]);
    expect(container.querySelectorAll('.lib-excard[data-sel=\'true\']').length).toBe(1);
  });
});
