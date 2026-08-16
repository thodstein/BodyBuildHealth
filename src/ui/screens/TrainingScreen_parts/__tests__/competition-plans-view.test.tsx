/**
 * competition-plans-view.test.tsx — рендер-проверка подвкладки «🏁 Соревнования»
 * дневника: пустое состояние, сохранение/удаление записей, вывод прикидов
 * и состава мезоцикла (тапер/mock/соревнования).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  CompetitionPlansView,
  saveCompetitionPlan,
  loadCompetitionPlans,
  removeCompetitionPlan,
  COMPETITION_PLANS_CAP,
  type CompetitionPlanRecord,
} from '../CompetitionPlansView';
import { CYCLE_01 } from '../../../../engines/lms/lms-builder.engine';
import type { LMSBuildOutput } from '../../../../engines/lms/lms-builder.engine';

function makePlan(weekCount = 8): LMSBuildOutput {
  return {
    template: CYCLE_01 as never,
    progressionRationale: 'test',
    cycleMetrics: { tonnage: 0, kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0, sessions: 0, perSession: [] },
    weeks: Array.from({ length: weekCount }, (_, i) => ({
      week: i + 1,
      pmRow: { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 },
      days: [],
      taperWeek: i >= weekCount - 2,
      meetWeek: i === weekCount - 1,
      meetAttempts: i === weekCount - 1
        ? { strategy: 'aggressive', lifts: [{ name: 'Присед', opener: 167.5, second: 175, third: 190, target: 190 }] }
        : undefined,
    })),
  } as LMSBuildOutput;
}

function makeRecord(over: Partial<CompetitionPlanRecord> = {}): CompetitionPlanRecord {
  return {
    id: 'comp-1',
    savedAt: '2026-08-14T10:00:00.000Z',
    cycleTitle: 'Соревновательный цикл 12 недель',
    cycleId: 'cycle-01',
    strategy: 'aggressive',
    weekCount: 10,
    taperWeeks: 2,
    mockMeet: true,
    meetWeek: true,
    weights: { squat: 180, bench: 120, deadlift: 220 },
    meetAttempts: [{ name: 'Присед', opener: 167.5, second: 175, third: 190, target: 190 }],
    plan: makePlan(10),
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('CompetitionPlansView — подвкладка «Соревнования»', () => {
  it('пустое состояние: подсказка как сохранить цикл', () => {
    render(<CompetitionPlansView />);
    expect(screen.getByText(/Пока нет сохранённых соревновательных циклов/)).toBeTruthy();
  });

  it('список: карточка сохранённого цикла (заголовок, прикиды 93/97/105%, чипы тапера)', () => {
    saveCompetitionPlan(makeRecord());
    render(<CompetitionPlansView />);
    expect(screen.getByText(/Соревновательный цикл 12 недель/)).toBeTruthy();
    expect(screen.getByText(/прикиды 93\/97\/105%/)).toBeTruthy();
    expect(screen.getByText(/тапер ×2/)).toBeTruthy();
    expect(screen.getByText(/mock meet/)).toBeTruthy();
  });

  it('тренерский score: бейдж 🧠 N/100 у сохранённого плана', () => {
    saveCompetitionPlan(makeRecord());
    render(<CompetitionPlansView />);
    const badge = screen.getByText(/🧠 \d+\/100/);
    expect(badge).toBeTruthy();
  });

  it('тренерский score: план без тапера получает низкий вердикт (danger)', () => {
    const plain = makePlan(10);
    plain.weeks = plain.weeks.map(w => ({ ...w, taperWeek: false, meetWeek: false, meetAttempts: undefined }));
    saveCompetitionPlan(makeRecord({ plan: plain }));
    render(<CompetitionPlansView />);
    const badge = screen.getByText(/🧠 \d+\/100/);
    const score = Number(badge.textContent?.match(/(\d+)\/100/)?.[1] ?? '0');
    expect(score).toBeLessThan(85);
  });

  it('разворот «Прикиды»: подходы из карточек (опенер/вторая/третья, ×1 сингл)', () => {
    saveCompetitionPlan(makeRecord());
    render(<CompetitionPlansView />);
    fireEvent.click(screen.getByText('Прикиды'));
    expect(screen.getByText('167.5')).toBeTruthy();
    expect(screen.getByText('190')).toBeTruthy();
    expect(screen.getByText(/×1 сингл · RIR 2\/1\/0/)).toBeTruthy();
    expect(screen.getByText(/Состав мезоцикла/)).toBeTruthy();
    expect(screen.getAllByText(/📉 Тапер/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/🏁 Соревнования/).length).toBeGreaterThan(0);
  });

  it('удаление записи убирает карточку', () => {
    saveCompetitionPlan(makeRecord());
    render(<CompetitionPlansView />);
    fireEvent.click(screen.getByText('🗑'));
    expect(screen.queryByText(/Соревновательный цикл 12 недель/)).toBeNull();
  });

  it('хранилище: кап записей (новые вытесняют старые)', () => {
    for (let i = 0; i < COMPETITION_PLANS_CAP + 3; i++) {
      saveCompetitionPlan(makeRecord({ id: 'comp-' + i, savedAt: '2026-08-' + String(10 + i).padStart(2, '0') + 'T10:00:00.000Z' }));
    }
    const plans = loadCompetitionPlans();
    expect(plans.length).toBe(COMPETITION_PLANS_CAP);
    expect(plans[0].id).toBe('comp-' + (COMPETITION_PLANS_CAP + 2)); // самая свежая первой
  });

  it('удаление: removeCompetitionPlan фильтрует по id', () => {
    saveCompetitionPlan(makeRecord());
    saveCompetitionPlan(makeRecord({ id: 'comp-2' }));
    removeCompetitionPlan('comp-1');
    expect(loadCompetitionPlans().map(p => p.id)).toEqual(['comp-2']);
  });
});
