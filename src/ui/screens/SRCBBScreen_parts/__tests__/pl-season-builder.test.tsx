/**
 * pl-season-builder.test.tsx — ПЛ-сезон по микроциклам (Фаза 3, UI): режим
 * одиночный/сезон, слоты, авто/ручной подбор, «циклы между соревнованиями»,
 * сборка сезона + переход к плану.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PLSeasonBuilder } from '../PLSeasonBuilder';
import type { LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';

const selector = { goal: 'strength', level: 'II-KMS', bodyWeight: 90, daysPerWeek: 4, direction: 'powerlifting', mode: 'natural' } as never;

const buildOpts = {
  pmMap: { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 },
  fallbackPm: 80,
} as never;

beforeEach(() => {
  try { localStorage.removeItem('he_pl_session'); } catch { /* ignore */ }
});

function props(overrides: Partial<Parameters<typeof PLSeasonBuilder>[0]> = {}) {
  return {
    selector,
    meets: [],
    taper: { mode: 'classic' as const, mockMeet: false, postMeet: false },
    buildOpts,
    onBuilt: () => {},
    onNavigatePlan: () => {},
    ...overrides,
  };
}

function seedSeasonMode(mode: 'single' | 'season') {
  try { localStorage.setItem('he_pl_session', JSON.stringify({ season: { mode } })); } catch { /* ignore */ }
}

describe('PLSeasonBuilder', () => {
  it('рендерит карточку сезона с переключателем режима', () => {
    render(<PLSeasonBuilder {...props()} />);
    expect(screen.getByText(/Сезон по микроциклам/)).toBeTruthy();
    expect(screen.getByText('🎯 Одиночный цикл')).toBeTruthy();
    expect(screen.getByText('🧩 Сезон')).toBeTruthy();
  });

  it('в сезонном режиме — 4 слота-периода (выносливость/сила/скорость/пик)', () => {
    seedSeasonMode('season');
    render(<PLSeasonBuilder {...props()} />);
    expect(screen.getAllByText(/Выносливость/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Скорость\/координация/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Выход на пик/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('🤖 Авто-подбор циклов').length).toBeGreaterThan(0);
    expect(screen.getAllByText('👆 Выбрать вручную').length).toBeGreaterThan(0);
  });

  it('авто-режим показывает «🏆 Рекомендован» для слота', () => {
    seedSeasonMode('season');
    render(<PLSeasonBuilder {...props()} />);
    expect(screen.getAllByText(/Рекомендован:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/📅 Сезон:/).length).toBeGreaterThan(0);
  });

  it('ручной режим показывает select выбора цикла для слота', () => {
    seedSeasonMode('season');
    render(<PLSeasonBuilder {...props()} />);
    fireEvent.click(screen.getByText('👆 Выбрать вручную'));
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(4);
  });

  it('«Собрать сезон» → onBuilt с планом + переход к плану', () => {
    let built: LMSBuildOutput | null = null;
    let navigated = false;
    seedSeasonMode('season');
    render(<PLSeasonBuilder {...props({ onBuilt: (o) => { built = o; }, onNavigatePlan: () => { navigated = true; } })} />);
    fireEvent.click(screen.getByText(/Собрать сезон/));
    expect(built).not.toBeNull();
    expect(Array.isArray(built!.weeks) && built!.weeks.length > 0).toBe(true);
    expect(navigated).toBe(true);
  });

  it('режим сезона сохраняется в he_pl_session (roundtrip)', () => {
    seedSeasonMode('single');
    render(<PLSeasonBuilder {...props()} />);
    fireEvent.click(screen.getByText('🧩 Сезон'));
    fireEvent.click(screen.getByText(/Собрать сезон/));
    const saved = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
    expect(saved.season && saved.season.mode).toBe('season');
  });

  it('карточка «Циклы между соревнованиями» появляется при ≥2 соревнованиях и собирает сезон с пиками', () => {
    let built: LMSBuildOutput | null = null;
    let segments: import('../PLSeasonBuilder').SeasonBuildInfo[] = [];
    seedSeasonMode('season');
    render(<PLSeasonBuilder {...props({
      meets: [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      taper: { mode: 'classic' as const, mockMeet: true, postMeet: true, windowWeeks: 2 },
      onBuilt: (o, _n, segs) => { built = o; segments = segs || []; },
    })} />);
    expect(screen.queryByText(/Циклы между соревнованиями/)).not.toBeNull();
    expect(screen.queryByText(/Старт 1 \(нед 8\)/)).not.toBeNull();
    expect(screen.queryByText(/Старт 2 \(нед 20\)/)).not.toBeNull();
    // Ручной выбор цикла на пролёт (второй «👆 Выбрать вручную» — карточка пролётов),
    // выбираем 12-нед цикл в 8-нед окно → бейдж «⬇ сжат».
    const manualBtns = screen.getAllByText('👆 Выбрать вручную');
    fireEvent.click(manualBtns[manualBtns.length - 1]);
    const gapSelect = screen.getByLabelText(/пролёта к «Старт 2»/);
    fireEvent.change(gapSelect, { target: { value: 'cycle-01' } });
    expect(screen.getAllByText(/⬇ сжат/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/Собрать сезон/));
    expect(built).not.toBeNull();
    expect(Array.isArray(built!.weeks) && built!.weeks.length > 20).toBe(true);
    // Агрегированные метрики сезона валидны (PLPlanView вызывает tonnage.toFixed — не должно упасть).
    expect(Number.isFinite(built!.cycleMetrics.tonnage)).toBe(true);
    expect(built!.cycleMetrics.tonnage).toBeGreaterThan(0);
    // Сводка сегментов сезона передана в родителя (для вкладки «План» и печати).
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments.some(s => s.fitMode === 'shrink' && s.cycleWeeks > s.weeks)).toBe(true);
  });

  it('SSR-рендер карточки не падает', () => {
    const html = renderToStaticMarkup(<PLSeasonBuilder {...props()} />);
    expect(html).toContain('Сезон по микроциклам');
  });

  it('управляемый режим: mode/onModeChange пробрасываются в родителя', () => {
    const changes: ('single' | 'season')[] = [];
    render(<PLSeasonBuilder {...props({ mode: 'season', onModeChange: (m) => changes.push(m) })} />);
    // Управляемый режим 'season' — слоты видны сразу.
    expect(screen.getAllByText(/Выносливость/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('🎯 Одиночный цикл'));
    expect(changes).toEqual(['single']);
  });

  it('один старт в сезоне — пик/тапер применяется поверх (buildPLSeasonPeaks через assembleSeasonPlan)', () => {
    let built: LMSBuildOutput | null = null;
    seedSeasonMode('season');
    render(<PLSeasonBuilder {...props({
      meets: [{ id: 'm1', name: 'Старт', weeksToStart: 20 }],
      taper: { mode: 'classic' as const, mockMeet: true, meetWeek: true, postMeet: true, windowWeeks: 2 },
      onBuilt: (o) => { built = o; },
    })} />);
    fireEvent.click(screen.getByText(/Собрать сезон/));
    expect(built).not.toBeNull();
    expect(built!.weeks.some(w => w.meetWeek)).toBe(true);
    expect(built!.weeks.length).toBeGreaterThan(20);
  });

  it('ручные выборы (pickMode/selections) восстанавливаются из сессии', () => {
    localStorage.setItem('he_pl_session', JSON.stringify({
      season: { mode: 'season', slots: undefined, pickMode: 'manual', selections: { 0: 'cycle-01' }, compPickMode: 'manual', compSelections: { 0: 'cycle-03' } },
    }));
    render(<PLSeasonBuilder {...props()} />);
    expect(screen.getAllByText('👆 Выбрать вручную').length).toBeGreaterThan(0);
    const slotSelect = screen.getByLabelText(/Выбор цикла для периода «Выносливость»/);
    expect((slotSelect as HTMLSelectElement).value).toBe('cycle-01');
  });
});