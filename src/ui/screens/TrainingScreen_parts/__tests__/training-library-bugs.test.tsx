/**
 * training-library-bugs.test.tsx — guard-тесты раунда «Библиотека PRO»:
 *  - B1: фильтр частоты каталога обязан включать 5 дн/нед;
 *  - B3: safeE1rm без Infinity/отрицательных + ISO-ключи недель;
 *  - B4: PL-фильтр цели реально маппится на период (не no-op);
 *  - хуки lib-* на месте, дубль-hero каталога удалён.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CycleCatalog, CYCLE_FREQ_OPTS, readCycleFavs } from '../CycleCatalog';
import { safeE1rm, weekKeyForDate } from '../MyTrainingTab';
import { plCycleMatchesGoal } from '../ManualLibraryGallery';
import { LibraryZone } from '../LibraryZone';

describe('Библиотека PRO — багфиксы', () => {
  it('B1: частота 5 дн/нед доступна в фильтре', () => {
    expect(CYCLE_FREQ_OPTS).toContain('5');
    expect(CYCLE_FREQ_OPTS).toEqual(['2', '3', '4', '5', '6']);
  });

  it('B3: safeE1rm считает Эпли и отсекает мусор', () => {
    expect(safeE1rm(100, 5)).toBe(120);
    expect(safeE1rm(80, 10)).toBe(120);
    expect(safeE1rm(100, 30)).toBeNull();
    expect(safeE1rm(100, 40)).toBeNull();
    expect(safeE1rm(0, 5)).toBeNull();
    expect(safeE1rm(100, 0)).toBeNull();
    expect(safeE1rm(Number.NaN, 5)).toBeNull();
  });

  it('B3: weekKeyForDate — ISO-недели, мусор → null', () => {
    expect(weekKeyForDate('2026-09-07')).toBe('2026-W37');
    expect(weekKeyForDate('2026-09-14')).toBe('2026-W38');
    expect(weekKeyForDate('2026-01-01')).toBe('2026-W01');
    expect(weekKeyForDate('2025-12-29')).toBe('2026-W01');
    expect(weekKeyForDate('')).toBeNull();
    expect(weekKeyForDate('not-a-date')).toBeNull();
    expect(weekKeyForDate('2026-13-99')).toBeNull();
  });

  it('B4: PL-цель маппится на период цикла', () => {
    expect(plCycleMatchesGoal('strength', 'strength')).toBe(true);
    expect(plCycleMatchesGoal('peak', 'strength')).toBe(true);
    expect(plCycleMatchesGoal('mass', 'strength')).toBe(false);
    expect(plCycleMatchesGoal('mass', 'bodybuilding')).toBe(true);
    expect(plCycleMatchesGoal('mixed', 'athletic')).toBe(true);
    expect(plCycleMatchesGoal('strength', 'all')).toBe(true);
  });

  it('хуки lib-* на месте, дубль-hero удалён', () => {
    const { container } = render(<CycleCatalog goal="strength" level="II-KMS" daysPerWeek={3} />);
    expect(container.querySelector('.lib-seg')).not.toBeNull();
    expect(container.querySelector('.lib-search')).not.toBeNull();
    expect(container.querySelector('.lib-filters')).not.toBeNull();
    expect(container.querySelector('.lib-rec')).not.toBeNull();
    expect(screen.queryByText('📖 Каталог тренировочных циклов')).toBeNull();
  });

  it('B6: битый he_cycle_fav не роняет каталог', () => {
    for (const bad of ['{"a":1}', '"just-string"', '123', 'not-json{']) {
      try { localStorage.setItem('he_cycle_fav', bad); } catch { /* ignore */ }
      expect(readCycleFavs()).toEqual([]);
    }
    try { localStorage.removeItem('he_cycle_fav'); } catch { /* ignore */ }
  });

  it('B6: favOnly-ловушка — пустое состояние с кнопкой «Показать всё»', () => {
    try { localStorage.removeItem('he_cycle_fav'); } catch { /* ignore */ }
    render(<CycleCatalog goal="strength" level="II-KMS" daysPerWeek={3} />);
    fireEvent.click(screen.getByText(/Избранное \(0\)/));
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    const showAll = screen.getByText(/Показать всё \(/);
    expect(showAll).toBeTruthy();
    fireEvent.click(showAll);
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
    expect(document.querySelector('.lib-empty')).toBeNull();
    cleanup();
  });

  it('LibraryZone — корень .train-library с data-lib-tab', () => {
    const noop = () => undefined;
    const { container } = render(
      <LibraryZone
        tab="library"
        linked={{} as never}
        trainingOutput={null}
        diaryStats={[]}
        historyWorkouts={[]}
        goal="strength"
        level="II-KMS"
        daysPerWeek={3}
        recovery={70}
        fatigue={20}
        appliedMethods={{}}
        setAppliedMethods={(() => undefined) as never}
        applyMethodComposition={noop}
        goPlannerManual={noop}
        selectedProgram={null}
        setSelectedProgram={noop}
        customExercises={[]}
        setCustomExercises={(() => undefined) as never}
        mesoLength={8}
      />,
    );
    const root = container.querySelector('.train-library');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-lib-tab')).toBe('library');
    expect(root?.querySelector('.lib-hero')).not.toBeNull();
  });
});
