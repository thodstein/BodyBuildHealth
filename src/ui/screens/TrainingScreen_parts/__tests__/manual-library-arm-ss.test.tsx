/**
 * manual-library-arm-ss.test.tsx — арм (19) + ТА/стронг (15) в библиотеке ручного планировщика.
 * - 4 таба с живыми счётчиками;
 * - мост arm_cycle/ss_cycle (payload + трек + событие + баннер role=status);
 * - избранное с префиксами arm:/ss: в общем he_cycle_fav;
 * - поиск скрывает всё.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  ManualLibraryGallery, plCycleMatchesLevel, proCycleMatchesLevel, matchesDays,
} from '../ManualLibraryGallery';
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

describe('Ручная библиотека: маппинг фильтров (все циклы достижимы)', () => {
  it('plCycleMatchesLevel: шкала LMS целиком покрыта', () => {
    expect(plCycleMatchesLevel('novice', 'beginner')).toBe(true);
    expect(plCycleMatchesLevel('intermediate', 'intermediate')).toBe(true);
    expect(plCycleMatchesLevel('II-KMS', 'intermediate')).toBe(true);
    for (const l of ['KMS-MS', 'MS-MSMK', 'KMS-MSMK', 'II-MS']) expect(plCycleMatchesLevel(l, 'advanced')).toBe(true);
    expect(plCycleMatchesLevel('novice', 'advanced')).toBe(false);
    expect(plCycleMatchesLevel('MS-MSMK', 'beginner')).toBe(false);
  });

  it('уровень Новичок/Опытный больше не даёт 0 ПЛ-циклов', () => {
    const beg = LMS_CYCLES.filter(c => plCycleMatchesLevel(c.meta.level, 'beginner'));
    const adv = LMS_CYCLES.filter(c => plCycleMatchesLevel(c.meta.level, 'advanced'));
    // 12 = 9 базовых novice + cycle-bb-f-beginner-6 (P2-13) + glute-2d-6 и
    // beginner-ul-8 (вторая волна Ф4, CYCLE-SYSTEM-FULL-AUDIT)
    expect(beg.length).toBe(12);
    // 66 = 59 базовых + Ф4 (pec-8/back-10/glute-adv-12) + топ-волна (arms-8/shoulders-8/legs-10)
    // + сцена (bodyfitness-12, KMS-MS)
    expect(adv.length).toBe(66);
    expect(beg.length + adv.length + LMS_CYCLES.filter(c => plCycleMatchesLevel(c.meta.level, 'intermediate') && !beg.includes(c) && !adv.includes(c)).length).toBeGreaterThanOrEqual(LMS_CYCLES.length - 3);
  });

  it('proCycleMatchesLevel: advanced забирает enhanced', () => {
    expect(proCycleMatchesLevel(['enhanced'], 'advanced')).toBe(true);
    expect(proCycleMatchesLevel(['beginner'], 'advanced')).toBe(false);
    expect(proCycleMatchesLevel(['beginner'], 'beginner')).toBe(true);
  });

  it('matchesDays: 2д и 7+ покрывают края раскладки', () => {
    expect(LMS_CYCLES.filter(c => matchesDays(c.meta.sessionsPerWeek, '2')).length).toBe(12);
    expect(LMS_CYCLES.filter(c => matchesDays(c.meta.sessionsPerWeek, '7plus')).length).toBe(1);
    expect(matchesDays(3, '3')).toBe(true);
    expect(matchesDays(4, '3')).toBe(false);
  });

  it('фильтр уровня в UI: таб ПЛ + Новичок показывает novice-циклы', () => {
    render(
      <ManualLibraryGallery
        bbPrograms={[]}
        plCycles={LMS_CYCLES as any}
        onSelectBB={() => {}}
        onSelectPL={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /ПЛ \(/ }));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'beginner' } });
    // 12 novice-циклов: 9 базовых + женский стартовый (P2-13) + 2 второй волны (Ф4)
    expect(screen.getByRole('tab', { name: /ПЛ \(12\)/ })).toBeInTheDocument();
  });
});
