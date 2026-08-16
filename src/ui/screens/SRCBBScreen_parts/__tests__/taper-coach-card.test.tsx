/**
 * taper-coach-card.test.tsx — смоук-тест TaperCoachCard (вынесенная тренерская
 * карточка ПЛ-авто): рендер без плана, рендер с тапер-планом (вердикт),
 * кнопки действий присутствуют.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaperCoachCard } from '../TaperCoachCard';
import type { TaperCoachCtx } from '../../../../engines/lms/lms-taper-coach.engine';
import type { LMSBuildOutput } from '../../../../engines/lms/lms-builder.engine';

const ctx = (): TaperCoachCtx => ({
  fatigue: 55,
  acwr: { ratio: 1.2, zone: 'optimal' },
  currentWeight: 82,
  targetWeight: 80,
  forecastPm: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 },
  weeksToMeet: 4,
  weeklyK: 0.01,
});

const mkWeek = (week: number, taper = false, meet = false) => ({
  week,
  pmRow: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 },
  days: [{
    exercises: [
      { name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, pm: 200, rir: 2, load: 'main', workSets: [{ pct: 0.8, reps: 3, sets: 3, weight: 160, rir: 2 }] },
      { name: 'Тяга', group: 'ТГ', coef: 1, mnosz: 1, pm: 200, rir: 2, workSets: [{ pct: 0.7, reps: 5, sets: 3, weight: 140, rir: 2 }] },
    ],
    metrics: { tonnage: 0, kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0 } as never,
  }],
  ...(taper ? { taperWeek: true } : {}),
  ...(meet ? { meetWeek: true, meetAttempts: { strategy: 'balanced' as const, lifts: [{ name: 'Присед', opener: 185, second: 192.5, third: 202.5, target: 202.5, warmup: [{ pct: 0.4, weight: 75, reps: 5 }] }] } } : {}),
});

const plan = (): LMSBuildOutput => ({
  template: { meta: { correctionPct: 0.005 } } as never,
  progressionRationale: '',
  cycleMetrics: {} as never,
  weeks: [mkWeek(1), mkWeek(2), mkWeek(7, true), mkWeek(8, true), mkWeek(9, false, true)],
});

const baseProps = {
  builtSrc: null as LMSBuildOutput | null,
  hasTaper: false,
  buildCtx: ctx,
  applyRecommendation: () => {},
  attemptStrategy: 'balanced' as const,
  onStrategyChange: () => {},
  diarySessions: [] as unknown[],
  onNote: () => {},
};

describe('TaperCoachCard', () => {
  it('рендерится без плана (кнопка авто-подбора)', () => {
    render(<TaperCoachCard {...baseProps} />);
    expect(screen.getByText(/Тренерская работа/)).toBeTruthy();
    expect(screen.getByText(/Подобрать тапер автоматически/)).toBeTruthy();
  });

  it('с тапер-планом показывает вердикт и сравнение сценариев', () => {
    render(<TaperCoachCard {...baseProps} builtSrc={plan()} hasTaper />);
    expect(screen.getByText(/Готов к старту|правки|корректировки|подготовку/)).toBeTruthy();
    expect(screen.getByText(/Сравнение сценариев/)).toBeTruthy();
    expect(screen.getByText(/Копировать вердикт/)).toBeTruthy();
    expect(screen.getByText(/Применить рекомендации тренера/)).toBeTruthy();
  });
});
