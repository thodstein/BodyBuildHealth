/**
 * manual-library-cardio.test.tsx — кардио (35) в библиотеке ручного планировщика.
 * - таб «Кардио» с живым счётчиком;
 * - мост в кардио-конструктор (pending + трек + событие + баннер role=status);
 * - избранное с префиксом cardio: в общем CYCLE_FAV;
 * - поиск скрывает всё.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManualLibraryGallery } from '../ManualLibraryGallery';
import { getAllPrograms } from '../../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import { CARDIO_CYCLES } from '../../../../data/cardio-cycles/cardio-cycle-index';
import { consumeCardioTemplatePending } from '../../../../engines/lms/cardio-cycle-bridge';
import { MANUAL_STORAGE_KEYS } from '../../../../engines/manual-constructor/manual-storage';

function renderGallery() {
  return render(
    <ManualLibraryGallery
      bbPrograms={getAllPrograms().slice(0, 2)}
      plCycles={LMS_CYCLES.slice(0, 2) as any}
      onSelectBB={() => {}}
      onSelectPL={() => {}}
    />,
  );
}

beforeEach(() => {
  try {
    localStorage.removeItem(MANUAL_STORAGE_KEYS.CYCLE_FAV);
    localStorage.removeItem('he_cardio_template_pending');
    localStorage.removeItem('he_training_planning_track');
  } catch { /* ignore */ }
});

describe('Ручная библиотека: кардио', () => {
  it('таб Кардио с живым счётчиком (35)', () => {
    renderGallery();
    expect(screen.getByRole('tab', { name: new RegExp(`Кардио \\(${CARDIO_CYCLES.length}\\)`) })).toBeInTheDocument();
    expect(CARDIO_CYCLES.length).toBe(35);
  });

  it('таб Кардио: карточка + мост (pending + трек + событие + баннер)', () => {
    renderGallery();
    let track = '';
    const h = (e: Event) => { track = (e as CustomEvent).detail as string; };
    window.addEventListener('planning-track-open', h);
    try {
      fireEvent.click(screen.getByRole('tab', { name: /Кардио \(/ }));
      const first = CARDIO_CYCLES[0];
      expect(screen.getByText(first.meta.title)).toBeInTheDocument();
      fireEvent.click(screen.getAllByText(/Собрать в конструкторе →/)[0]);
      expect(consumeCardioTemplatePending()).toBe(first.meta.id);
      expect(localStorage.getItem('he_training_planning_track')).toBe('cardio');
      expect(track).toBe('cardio');
      expect(screen.getByRole('status')).toHaveTextContent(/кардио-конструктор/);
    } finally {
      window.removeEventListener('planning-track-open', h);
    }
  });

  it('⭐ кардио-карточки пишет cardio:<id> в избранное', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('tab', { name: /Кардио \(/ }));
    const card = screen.getByText(CARDIO_CYCLES[0].meta.title).closest('.lib-cardio-card')!;
    const star = (card as HTMLElement).querySelector('button[aria-label^="В избранное"]') as HTMLButtonElement;
    fireEvent.click(star);
    const favs = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEYS.CYCLE_FAV) || '[]');
    expect(favs).toContain(`cardio:${CARDIO_CYCLES[0].meta.id}`);
    expect(star).toHaveAttribute('data-fav', 'true');
  });

  it('поиск скрывает кардио-список целиком', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('tab', { name: /Кардио \(/ }));
    fireEvent.change(screen.getByPlaceholderText(/Поиск по названию/), { target: { value: 'несуществующий_запрос_12345' } });
    expect(screen.getByText(/Ничего не найдено/)).toBeInTheDocument();
  });
});
