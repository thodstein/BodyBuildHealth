/**
 * peak-week-pro-ui.test.tsx — PRO-4 UI: монитор пик-недели (чек-ин → история),
 * экстренная карточка (контакт persist), лабы-чекпоинт (дата persist),
 * серия шоу (окна + overreach), коуч-проверка (score + патч).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  buildBBContestPrepPlan, buildPeakWeek, configFromPlan, isoAddDays, isoToday,
  type BBContestPrepConfig,
} from '../../../../engines/bb/bb-contest-prep.engine';
import {
  PeakWeekMonitorCard, ShowDayEmergencyCard, PrepLabsCard, ShowSeriesCard, ShowCoachCard,
} from '../PeakWeekProCard';

function baseConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: isoAddDays(isoToday(), 30),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'stable',
    sodiumStrategy: 'stable',
    ...over,
  };
}

const plan = buildBBContestPrepPlan(baseConfig());
const peakDays = buildPeakWeek(configFromPlan(plan), plan.peakWeek?.carbDoseGPerKg != null ? { carbDoseGPerKg: plan.peakWeek.carbDoseGPerKg } : undefined);

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

describe('PRO-4 UI — монитор пик-недели', () => {
  it('без плана — честная подсказка, без формы', () => {
    render(<PeakWeekMonitorCard planId="" peakDays={[]} plan={null} />);
    const card = document.querySelector('[data-bb="peak-monitor"]')!;
    expect(card.textContent).toMatch(/Соберите и примените план/);
    expect(document.querySelector('[data-bb="pm-save"]')).toBeNull();
  });

  it('сохраняет чек-ин сегодня → появляется в истории + адгеренс', () => {
    render(<PeakWeekMonitorCard planId={plan.id} peakDays={peakDays} plan={plan} />);
    const todayInWindow = peakDays.some(d => d.date === isoToday());
    if (todayInWindow) {
      fireEvent.change(document.querySelector('[data-bb="pm-weight"]')!, { target: { value: '80.4' } });
      fireEvent.change(document.querySelector('[data-bb="pm-water"]')!, { target: { value: '2.5' } });
      fireEvent.click(document.querySelector('[data-bb="pm-visual-ontrack"]')!);
      fireEvent.click(document.querySelector('[data-bb="pm-well-4"]')!);
      fireEvent.click(document.querySelector('[data-bb="pm-save"]')!);
      const raw = localStorage.getItem('he_prep_peak_days_v1') || '';
      expect(raw).toContain('80.4');
      expect(screen.getAllByText(/80\.4 кг/).length).toBeGreaterThan(0);
      expect(document.querySelector('[data-bb="pm-history-row"]')).toBeTruthy();
    } else {
      // Дни вне окна: карточка всё равно рисует тренд/дисклеймер
      expect(document.querySelector('[data-bb="pm-trend"]')).toBeTruthy();
    }
  });

  it('тренд-совет для двух «плоско» (через сохранённый лог)', () => {
    const d0 = peakDays[0].date;
    const d1 = peakDays[1].date;
    localStorage.setItem('he_prep_peak_days_v1', JSON.stringify({
      [plan.id]: [
        { date: d0, visual: 'flat', at: 'x' },
        { date: d1, visual: 'flat', at: 'x' },
      ],
    }));
    render(<PeakWeekMonitorCard planId={plan.id} peakDays={peakDays} plan={plan} />);
    const trend = document.querySelector('[data-bb="pm-trend"]')!;
    expect(trend.textContent).toMatch(/плоский/);
    expect(trend.textContent).toMatch(/ВОДА/i);
  });

  it('женский план → блок цикла (Цикл и вода) с фазой шоу', () => {
    const femCfg = baseConfig({ sex: 'female', category: 'bikini' });
    const femPlan = buildBBContestPrepPlan(femCfg);
    const femDays = buildPeakWeek(configFromPlan(femPlan));
    localStorage.setItem('he_cycle_log', JSON.stringify([isoAddDays(femPlan.showDate, -28)]));
    render(<PeakWeekMonitorCard planId={femPlan.id} peakDays={femDays} plan={femPlan} />);
    const block = document.querySelector('[data-bb="female-peak"]')!;
    expect(block).toBeTruthy();
    expect(block.textContent).toMatch(/Цикл и вода/);
    expect(block.textContent).toMatch(/день 1/);
  });
});

describe('PRO-4 UI — экстренная карточка', () => {
  it('6 сценариев и сохранение контакта', () => {
    render(<ShowDayEmergencyCard />);
    expect(document.querySelectorAll('[data-bb="em-scenario"]').length).toBe(6);
    fireEvent.change(document.querySelector('[data-bb="em-name"]')!, { target: { value: 'Тренер' } });
    fireEvent.change(document.querySelector('[data-bb="em-phone"]')!, { target: { value: '112' } });
    fireEvent.click(document.querySelector('[data-bb="em-save"]')!);
    const saved = JSON.parse(localStorage.getItem('he_prep_emergency_v1') || '{}');
    expect(saved.name).toBe('Тренер');
    expect(saved.phone).toBe('112');
  });
});

describe('PRO-4 UI — лабы-чекпоинт', () => {
  it('дата последних анализов персистится и меняет статусы', () => {
    render(<PrepLabsCard planId={plan.id} showDate={plan.showDate} />);
    expect(document.querySelector('[data-bb="prep-labs"]')).toBeTruthy();
    fireEvent.change(document.querySelector('[data-bb="labs-date"]')!, { target: { value: '2026-08-05' } });
    const store = JSON.parse(localStorage.getItem('he_prep_labs_v1') || '{}');
    expect(store[plan.id]).toBe('2026-08-05');
  });
});

describe('PRO-4 UI — серия шоу', () => {
  it('окна и предупреждения для двух стартов; пусто — карточка не рендерится', () => {
    const { container } = render(<ShowSeriesCard shows={[
      { id: 'a', name: 'Кубок', date: '2026-10-10', priority: 'A' },
      { id: 'b', name: 'Локальный', date: '2026-10-31', priority: 'B' },
    ]} />);
    const card = container.querySelector('[data-bb="show-series"]')!;
    expect(card.textContent).toMatch(/Кубок/);
    expect(card.textContent).toMatch(/taper 2 нед/);
    expect(card.textContent).toMatch(/4 нед|trial/i);
    cleanup();
    const empty = render(<ShowSeriesCard shows={[]} />);
    expect(empty.container.querySelector('[data-bb="show-series"]')).toBeNull();
  });

  it('overreach-кнопка применяет planTwoShowSequence к плану', () => {
    const mkWeek = (week: number) => ({
      week,
      sessions: [{ exercises: [{ sets: 5, workSets: [{ reps: 8, rir: 2, weight: 100 }] }] }],
    });
    const builtPlan: any = { weeks: [mkWeek(1), mkWeek(2), mkWeek(3), mkWeek(4), { week: 5, peakWeek: true, sessions: [] }] };
    const onPlanChange = vi.fn();
    const flash = vi.fn();
    render(<ShowSeriesCard
      shows={[{ id: 'a', name: 'Кубок', date: '2026-10-10', priority: 'A' }]}
      builtPlan={builtPlan}
      onPlanChange={onPlanChange}
      flash={flash}
    />);
    fireEvent.click(document.querySelector('[data-bb="series-overreach"]')!);
    expect(onPlanChange).toHaveBeenCalledTimes(1);
    const next = onPlanChange.mock.calls[0][0];
    // Overreach применяется к неделе wi+3===5 → индексу 2 (week 3): объём вырос (5 → 6).
    expect(next.weeks[2].sessions[0].exercises[0].sets).toBeGreaterThan(5);
    expect(String(next.weeks[2].sessions[0].exercises[0].comment)).toMatch(/Overreach/);
    expect(flash).toHaveBeenCalled();
  });
});

describe('PRO-4 UI — коуч-проверка', () => {
  const weakPlan: any = {
    id: 'p', version: 2, algorithmVersion: 2, status: 'draft', createdAt: 'x', updatedAt: 'x', source: 'bb_auto',
    showDate: isoAddDays(isoToday(), 40), category: 'mens_physique', sex: 'male',
    preparation: { startDate: 'x', weeks: 4, finalWeeks: 2, targetRatePctPerWeek: 0.9, startingWeightKg: 80, currentCalories: 2000, stepsPerDay: 8000, cardioMinutesPerWeek: 120 },
    taper: { enabled: false, weeks: 0, volumeProfile: [1], intensityProfile: [1], rirProfile: [[2, 4]] },
    peakWeek: { enabled: false, strategy: 'conservative', waterMode: 'stable', sodiumMode: 'stable', carbMode: 'conservative' },
    phases: [], safety: { contraindications: [], warnings: [], requiresReview: false, blockedProtocol: false },
  };

  it('рендерит score/заметки и патч-кнопку (onApply)', () => {
    const onApply = vi.fn();
    render(<ShowCoachCard plan={weakPlan} onApply={onApply} />);
    const card = document.querySelector('[data-bb="show-coach"]')!;
    expect(card.textContent).toMatch(/Коуч-проверка/);
    expect(card.textContent).toMatch(/Безопасный патч/);
    fireEvent.click(document.querySelector('[data-bb="coach-apply"]')!);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toHaveProperty('waterStrategy', 'stable');
  });

  it('без плана — карточка не рендерится', () => {
    const { container } = render(<ShowCoachCard plan={null} />);
    expect(container.querySelector('[data-bb="show-coach"]')).toBeNull();
  });
});
