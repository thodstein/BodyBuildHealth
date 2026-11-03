/**
 * pl-season-builder-empty-weeks.test.tsx — P2-6 (аудит 2026-11): неделя без
 * тренировочного блока не должна выдаваться за план. Карточка сезона обязана
 * (1) показать предупреждение со списком таких недель и (2) НЕ собирать план.
 *
 * Движок подменён: сценарий «нет подходящего цикла на пролёт» зависит от базы
 * циклов и от уровня атлета, поэтому проверяем именно UI-страж на результат.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const emptyBlockWeek = (week: number) => ({
  week, pmRow: {}, days: [], macroPhase: 'endurance',
  emptyBlock: true, blockNote: 'к «Старт 2» не подобран цикл (окно 0 нед)',
});

vi.mock('../../../../engines/lms/lms-comp-gap.engine', () => ({
  planBetweenCompetitions: () => ({
    segments: [{
      meetId: 'm2', meetName: 'Старт 2', meetWeek: 9, startWeek: 8, endWeek: 9,
      availableWeeks: 0, cycleId: '', cycleTitle: 'Нет подходящего цикла', cycleWeeks: 0,
      fitWeeks: null, fitMode: 'skip', needsConsent: false, fittedCycle: null, taperWeeks: 0,
      candidates: [], notes: [],
    }],
    totalPlanWeeks: 3,
    weeks: [
      emptyBlockWeek(1),
      emptyBlockWeek(2),
      { week: 3, pmRow: {}, days: [{ exercises: [] }], macroPhase: 'endurance' },
    ],
    notes: ['⚠ Без тренировочного блока: нед 1–2 — выберите цикл для пролёта или сдвиньте старт.'],
    emptyWeeks: [1, 2],
    trainingWeeks: 1,
  }),
}));

// Сезонные СЛОТЫ в этом тесте не проходят (иначе кнопка «Собрать» заблокирована
// несогласованными слотами, и страж P2-6 не проверяется). Оставляем движок
// настоящим, подменяем только planSeason → пустой сезон слотов.
vi.mock('../../../../engines/lms/lms-season.engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../engines/lms/lms-season.engine')>();
  return {
    ...actual,
    planSeason: () => ({ segments: [], totalWeeks: 0, notes: [], cycleIds: [] }),
  };
});

import { PLSeasonBuilder } from '../PLSeasonBuilder';

const selector = { goal: 'strength', level: 'II-KMS', bodyWeight: 90, daysPerWeek: 4, direction: 'powerlifting', mode: 'natural' } as never;

const baseProps = {
  selector,
  meets: [
    { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
    { id: 'm2', name: 'Старт 2', weeksToStart: 9 },
  ],
  taper: { mode: 'classic' as const, mockMeet: false, postMeet: false },
  buildOpts: { pmMap: { 'Присес': 180 }, fallbackPm: 80 } as never,
  onNavigatePlan: () => {},
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  try { localStorage.setItem('he_pl_session', JSON.stringify({ season: { mode: 'season' } })); } catch { /* ignore */ }
});

describe('PLSeasonBuilder: недели без тренировочного блока (P2-6)', () => {
  it('показывает честное предупреждение вместо «итого N нед плана»', () => {
    render(<PLSeasonBuilder {...baseProps} onBuilt={() => {}} />);
    const warn = document.querySelector('[data-pl="season-empty-weeks"]');
    expect(warn).not.toBeNull();
    expect(warn!.textContent).toContain('нед 1, 2');
    expect(warn!.textContent).toContain('1 из 3');
  });

  it('«Собрать сезон» НЕ отдаёт план с дырами — только причину', () => {
    const built: unknown[] = [];
    const notes: string[][] = [];
    render(<PLSeasonBuilder
      {...baseProps}
      onBuilt={(out, n) => { built.push(out); notes.push(n || []); }}
    />);
    fireEvent.click(screen.getByText(/Собрать сезон/));
    expect(built[built.length - 1]).toBeNull();
    expect((notes[notes.length - 1] || []).join(' ')).toContain('без тренировочного блока');
  });
});
