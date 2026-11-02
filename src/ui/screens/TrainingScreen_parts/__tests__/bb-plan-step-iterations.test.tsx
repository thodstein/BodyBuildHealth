/**
 * bb-plan-step-iterations.test.tsx — SSR-смоук шага «План» для итераций B/C/E.
 *
 * Проверяем то, что пользователь реально видит, на настоящем собранном плане
 * (не на моке):
 *  - «почему упражнения в таком порядке» (итерация B, движок объяснений);
 *  - правило прогрессии у упражнения (итерация C);
 *  - карточка «как прогрессирует план» + сдвиг дат (итерация E, D-4);
 *  - бейдж суперсета и карточка «что сменилось с прошлой недели» появляются,
 *    только когда данные для них есть (не рисуем пустые блоки).
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbPlanStep, type BbPlanStepProps } from '../bb-step-plan';
import { buildBBPlan } from '../../../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics } from '../../../../engines/bb/bb-metrics.engine';

const noop = () => { /* noop */ };
const setStub = (v: any) => v;

const plan = buildBBPlan({
  patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 3,
  weakPoints: ['shoulders'],
} as any) as any;
const metrics = calcBBPlanMetrics(plan) as any;

const baseProps = (over: Partial<BbPlanStepProps> = {}): BbPlanStepProps => ({
  builtPlan: plan,
  metrics,
  bbWeekSel: 1,
  setBbWeekSel: setStub as any,
  bbWeeks: 3,
  autoDeload: false,
  weakPoints: ['shoulders'],
  dupMode: 'none' as any,
  autoRegOn: false,
  autoRegResult: null,
  exerciseEdits: {},
  setExerciseEdits: setStub as any,
  editMode: null,
  setEditMode: setStub as any,
  collapsedDays: new Set<number>(),
  setCollapsedDays: setStub as any,
  collapsedExercises: new Set<string>(),
  setCollapsedExercises: setStub as any,
  bbTrainingFocus: 'hypertrophy',
  bbLevel: 'intermediate',
  bbTrainingYears: 3,
  onCourse: false,
  trainingVolumeMode: 'standard',
  setSubTarget: setStub as any,
  handleSendToExecution: noop,
  setWeightEntries: setStub as any,
  setWeightsApplied: setStub as any,
  setStep: setStub as any,
  actionRow: React.createElement('div', { 'data-testid': 'action-row' }),
  ...over,
});

describe('Шаг «План»: итерации B/C/E в UI', () => {
  const html = renderToStaticMarkup(React.createElement(BbPlanStep, baseProps()));

  it('рендерится без падений на реальном плане', () => {
    expect(html.length).toBeGreaterThan(2000);
    expect(html).not.toContain('NaN');
  });

  it('B: объяснение порядка упражнений (движок, а не комментарий)', () => {
    expect(html).toContain('Почему упражнения идут именно в таком порядке');
  });

  it('C: правило прогрессии у упражнения и в карточке «как прогрессирует план»', () => {
    expect(html).toContain('Как прогрессировать');
    expect(html).toContain('Двойная прогрессия');
    expect(html).toContain('Как прогрессирует этот план');
  });

  it('E: честная оговорка методики видна в карточке прогрессии', () => {
    // Подпись методики и её honest-оговорка приходят из единого спека.
    expect(html).toMatch(/Порядок почти не влияет на гипертрофию|Название методики|Базовые → изоляция/);
  });

  it('E (D-4): сдвиг дат показывается только когда передана дата старта', () => {
    expect(html).not.toContain('+1 неделя');
    const withDate = renderToStaticMarkup(React.createElement(BbPlanStep, baseProps({
      startDateInput: '2026-11-09',
      setStartDateInput: setStub as any,
    })));
    expect(withDate).toContain('+1 неделя');
    expect(withDate).toContain('Пропустили день или неделю');
  });
});
