/**
 * cycle-catalog-arm-ss.test.tsx — арм + ТА/стронг в каталоге циклов:
 *  - разделы «Арм» (19 именных) и «ТА·Стронг» (15 SS) на месте;
 *  - «Все» показывает все три библиотеки;
 *  - поиск/фильтры/избранное (префиксы arm:/ss:) работают;
 *  - SSCycleLayoutView и ArmPhaseStrip рендерятся без крашей.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import {
  CycleCatalog,
  SSCycleLayoutView,
  ArmPhaseStrip,
  matchArmLevel,
  matchSSLevel,
  matchSSPeriod,
} from '../CycleCatalog';
import { ARM_CYCLE_LIBRARY } from '../../../../engines/arm/arm-cycle-library.engine';
import { SS_CYCLES } from '../../../../data/ss-cycles/ss-cycle-index';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';

const PROPS = { goal: 'strength', level: 'II-KMS', daysPerWeek: 3 };

describe('CycleCatalog — арм + ТА/стронг', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('библиотеки содержат ожидаемое число циклов', () => {
    expect(ARM_CYCLE_LIBRARY.length).toBe(19);
    expect(SS_CYCLES.length).toBe(15);
    expect(LMS_CYCLES.length).toBeGreaterThan(0);
  });

  it('«Все» показывает заголовки всех трёх библиотек со счётчиками', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    const armHead = container.querySelector('.lib-arm-group')?.textContent || '';
    const strongHead = container.querySelector('.lib-strong-group')?.textContent || '';
    expect(armHead).toContain('Армрестлинг / армлифтинг');
    expect(armHead).toContain(String(ARM_CYCLE_LIBRARY.length));
    expect(strongHead).toContain('Тяжёлая атлетика / стронг');
    expect(strongHead).toContain(String(SS_CYCLES.length));
  });

  it('раздел «Арм» показывает именные циклы и прячет LMS', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Арм'));
    expect(screen.getByText('KTA singles (Kinney/Horne, 6д/нед)')).toBeTruthy();
    expect(screen.getByText('StrengthLog 8-week (стол + база)')).toBeTruthy();
    expect(screen.queryByText('Силовой цикл 1 (троеборье)')).toBeNull();
  });

  it('раздел «ТА·Стронг» показывает SS-циклы и прячет LMS', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('ТА·Стронг'));
    expect(screen.getByText('ТА общая база — 8 недель (5 д/нед)')).toBeTruthy();
    expect(screen.getByText('Стронг старт — 12 недель (3→4 д/нед)')).toBeTruthy();
    expect(screen.queryByText('Силовой цикл 1 (троеборье)')).toBeNull();
  });

  it('поиск фильтрует арм-раздел', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Арм'));
    const search = container.querySelector('.lib-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'kta' } });
    expect(screen.getByText('KTA singles (Kinney/Horne, 6д/нед)')).toBeTruthy();
    expect(screen.queryByText('StrengthLog 8-week (стол + база)')).toBeNull();
    const armHead = container.querySelector('.lib-arm-group')?.textContent || '';
    expect(armHead).toContain('1');
  });

  it('фокус «Армлифтинг» оставляет только armlifting-циклы', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Арм'));
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    fireEvent.click(within(filters).getByText('Армлифтинг'));
    expect(screen.getByText('KTA singles (Kinney/Horne, 6д/нед)')).toBeTruthy();
    expect(screen.queryByText('StrengthLog 8-week (стол + база)')).toBeNull();
  });

  it('⭐ арм-цикла пишется с префиксом arm: и видна в избранном', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('Арм'));
    fireEvent.click(screen.getByLabelText('В избранное KTA singles (Kinney/Horne, 6д/нед)'));
    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).toContain('arm:kta_singles');
    expect(screen.getByText('⭐ Избранные циклы (1)')).toBeTruthy();
  });

  it('⭐ SS-цикла пишется с префиксом ss: и видна в избранном', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByText('ТА·Стронг'));
    fireEvent.click(screen.getByLabelText('В избранное ТА общая база — 8 недель (5 д/нед)'));
    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).toContain('ss:ss-ta-general-8');
    expect(screen.getByText('⭐ Избранные циклы (1)')).toBeTruthy();
  });

  it('LMS-избранное не ломается префиксами (без коллизий id)', () => {
    render(<CycleCatalog {...PROPS} />);
    fireEvent.click(screen.getByLabelText('В избранное Силовой цикл 1 (троеборье)'));
    const favs = JSON.parse(localStorage.getItem('he_cycle_fav') || '[]');
    expect(favs).toContain('cycle-01');
    expect(favs).not.toContain('arm:cycle-01');
  });

  it('matchArmLevel/matchSSLevel/matchSSPeriod маппят LMS-фильтры', () => {
    const kta = ARM_CYCLE_LIBRARY.find(c => c.id === 'kta_singles')!;
    expect(matchArmLevel(kta, 'all')).toBe(true);
    expect(matchArmLevel(kta, 'MS-MSMK')).toBe(true);
    expect(matchArmLevel(kta, 'novice')).toBe(false);
    const horne = ARM_CYCLE_LIBRARY.find(c => c.id === 'horne_basic_12')!;
    expect(matchArmLevel(horne, 'novice')).toBe(true);
    const taBase = SS_CYCLES.find(c => c.meta.id === 'ss-ta-general-8')!;
    expect(matchSSLevel(taBase, 'all')).toBe(true);
    expect(matchSSLevel(taBase, 'MS-MSMK')).toBe(true);
    const taBulg = SS_CYCLES.find(c => c.meta.id === 'ss-ta-bulgarian')!;
    expect(matchSSLevel(taBulg, 'novice')).toBe(false);
    expect(matchSSLevel(taBulg, 'MS-MSMK')).toBe(true);
    expect(matchSSPeriod(taBase, 'all')).toBe(true);
    expect(matchSSPeriod(taBase, 'strength')).toBe(true);
    expect(matchSSPeriod(taBase, 'peak')).toBe(false);
    const taPeak = SS_CYCLES.find(c => c.meta.id === 'ss-ta-peak-4')!;
    expect(matchSSPeriod(taPeak, 'peak')).toBe(true);
  });

  it('SSCycleLayoutView рендерит дни и подходы всех SS-циклов без крашей', () => {
    for (const cycle of SS_CYCLES) {
      const { unmount } = render(<SSCycleLayoutView cycle={cycle} />);
      expect(cycle.weeks.length).toBeGreaterThan(0);
      unmount();
    }
    render(<SSCycleLayoutView cycle={SS_CYCLES[0]} />);
    expect(screen.getByText('День 1 · тяж')).toBeTruthy();
  });

  it('ArmPhaseStrip рендерит ячейку на каждую неделю цикла', () => {
    const { container } = render(<ArmPhaseStrip cycle={ARM_CYCLE_LIBRARY[0]} />);
    const strip = container.querySelector('.lib-phase-strip');
    expect(strip).not.toBeNull();
    expect(strip?.children.length).toBe(ARM_CYCLE_LIBRARY[0].weeks);
  });
});
