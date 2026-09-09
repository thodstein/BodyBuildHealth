/**
 * manual-library-arm-ss.test.tsx — арм (19) + ТА/стронг (15) в библиотеке ручного планировщика.
 * - 4 таба с живыми счётчиками;
 * - мост arm_cycle/ss_cycle (payload + трек + событие + баннер role=status);
 * - избранное с префиксами arm:/ss: в общем he_cycle_fav;
 * - поиск скрывает всё.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ManualLibraryGallery } from '../ManualLibraryGallery';
import { getAllPrograms } from '../../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import { ARM_CYCLE_LIBRARY } from '../../../../engines/arm/arm-cycle-library.engine';
import { SS_CYCLES } from '../../../../data/ss-cycles/ss-cycle-index';

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
    localStorage.removeItem('he_cycle_fav');
    localStorage.removeItem('he_program_fav');
    localStorage.removeItem('he_planner_apply');
    localStorage.removeItem('he_training_planning_track');
  } catch { /* ignore */ }
});

describe('Ручная библиотека: арм + ТА/стронг', () => {
  it('4 таба с живыми счётчиками (19 арм + 15 SS)', () => {
    renderGallery();
    expect(screen.getByRole('tab', { name: new RegExp(`Арм \\(${ARM_CYCLE_LIBRARY.length}\\)`) })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(`ТА·Стронг \\(${SS_CYCLES.length}\\)`) })).toBeInTheDocument();
    expect(ARM_CYCLE_LIBRARY.length).toBe(19);
    expect(SS_CYCLES.length).toBe(15);
  });

  it('таб Арм: карточка + мост arm_cycle (payload + трек + событие + баннер)', () => {
    renderGallery();
    let track = '';
    const h = (e: Event) => { track = (e as CustomEvent).detail as string; };
    window.addEventListener('planning-track-open', h);
    try {
      fireEvent.click(screen.getByRole('tab', { name: /Арм \(/ }));
      const first = ARM_CYCLE_LIBRARY[0];
      expect(screen.getByText(first.name)).toBeInTheDocument();
      fireEvent.click(screen.getAllByText(/Собрать в конструкторе →/)[0]);
      const saved = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
      expect(saved.kind).toBe('arm_cycle');
      expect(saved.data.cycleId).toBe(first.id);
      expect(localStorage.getItem('he_training_planning_track')).toBe('arm');
      expect(track).toBe('arm');
      expect(screen.getByRole('status')).toHaveTextContent(/арм-конструктор/);
    } finally {
      window.removeEventListener('planning-track-open', h);
    }
  });

  it('таб ТА·Стронг: карточка + мост ss_cycle', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('tab', { name: /ТА·Стронг \(/ }));
    const first = SS_CYCLES[0];
    expect(screen.getByText(first.meta.title)).toBeInTheDocument();
    fireEvent.click(screen.getAllByText(/Собрать в конструкторе →/)[0]);
    const saved = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
    expect(saved.kind).toBe('ss_cycle');
    expect(saved.data.cycleId).toBe(first.meta.id);
    expect(localStorage.getItem('he_training_planning_track')).toBe('strength');
    expect(screen.getByRole('status')).toHaveTextContent(/ТА\/стронга/);
  });

  it('⭐ арм-карточки пишет arm:<id> в общий he_cycle_fav', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('tab', { name: /Арм \(/ }));
    const card = screen.getByText(ARM_CYCLE_LIBRARY[0].name).closest('.lib-arm-card')!;
    const star = within(card as HTMLElement).getByRole('button', { name: /В избранное/ });
    fireEvent.click(star);
    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).toContain(`arm:${ARM_CYCLE_LIBRARY[0].id}`);
    expect(star).toHaveAttribute('data-fav', 'true');
  });

  it('поиск скрывает арм-список целиком', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('tab', { name: /Арм \(/ }));
    fireEvent.change(screen.getByPlaceholderText(/Поиск по названию/), { target: { value: 'несуществующий_запрос_12345' } });
    expect(screen.getByText(/Ничего не найдено/)).toBeInTheDocument();
  });
});
