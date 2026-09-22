/**
 * taper-state.test.tsx — usePLTaperState + PLTaperContext: инициализация из
 * сохранённой сессии, meet-логика (add/remove/applyMain), fallback вне провайдера.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PLTaperProvider, usePLTaper } from '../taper-state';

/** Компонент-потребитель: читает state из контекста и показывает значения. */
const Consumer: React.FC<{ saved?: any }> = ({ saved }) => {
  const tp = usePLTaper();
  return (
    <div>
      <span data-testid="bw">{tp.bw}</span>
      <span data-testid="strategy">{tp.attemptStrategy}</span>
      <span data-testid="meets">{tp.meetList.map(m => m.name).join(',')}</span>
      <span data-testid="main">{tp.mainMeetId}</span>
      <button onClick={() => tp.addMeet()}>add</button>
      <button onClick={() => tp.removeMeet('m1')}>remove</button>
      <button onClick={() => tp.applyMainMeet({ id: 'm2', name: 'Старт 2', weeksToStart: 6, fed: 'ipf', plannedPm: { 'Присед': 200 }, strategy: 'aggressive' })}>apply2</button>
      <span data-testid="weeks">{tp.weeksToMeet}</span>
      <span data-testid="strategyAfter">{tp.attemptStrategy}</span>
    </div>
  );
};

describe('usePLTaper / PLTaperProvider', () => {
  it('fallback вне провайдера: дефолтные значения (без краха)', () => {
    render(<Consumer />);
    expect(screen.getByTestId('bw').textContent).toBe('85');
    expect(screen.getByTestId('strategy').textContent).toBe('balanced');
    expect(screen.getByTestId('meets').textContent).toBe('Соревнование 1');
  });

  it('провайдер инициализирует state из сохранённой сессии', () => {
    const saved = {
      plBw: 92, plAttemptStrategy: 'aggressive', plWeeksToMeet: 6,
      plMeetList: [{ id: 'm1', name: 'Шоу', weeksToStart: 8, fed: 'fpr', plannedPm: {}, strategy: 'balanced' }],
      plMainMeetId: 'm1',
    };
    render(<PLTaperProvider saved={saved}><Consumer /></PLTaperProvider>);
    expect(screen.getByTestId('bw').textContent).toBe('92');
    expect(screen.getByTestId('strategy').textContent).toBe('aggressive');
    expect(screen.getByTestId('weeks').textContent).toBe('6');
    expect(screen.getByTestId('meets').textContent).toBe('Шоу');
  });

  it('addMeet/removeMeet/applyMainMeet работают через контекст', () => {
    const saved = {
      plMeetList: [
        { id: 'm1', name: 'Шоу 1', weeksToStart: 8, fed: 'ipf', plannedPm: {}, strategy: 'balanced' },
        { id: 'm2', name: 'Шоу 2', weeksToStart: 14, fed: 'ipf', plannedPm: {}, strategy: 'balanced' },
      ],
      plMainMeetId: 'm1',
    };
    render(<PLTaperProvider saved={saved}><Consumer /></PLTaperProvider>);
    expect(screen.getByTestId('meets').textContent).toBe('Шоу 1,Шоу 2');
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('meets').textContent).toBe('Шоу 1,Шоу 2,Соревнование 3');
    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('meets').textContent).toBe('Шоу 2,Соревнование 3');
    // applyMainMeet синхронизирует поля главного соревнования
    fireEvent.click(screen.getByText('apply2'));
    expect(screen.getByTestId('weeks').textContent).toBe('6');
    expect(screen.getByTestId('strategyAfter').textContent).toBe('aggressive');
  });
});

// P2-1: черновики тапера переживают F5 — taperPlan/taperAttemptOverride восстанавливаются
// из he_pl_session (валидная форма); битый/чужой стор → честно пусто.
const TAPER_PLAN = {
  template: { meta: { id: 'taper-test', title: 'Тапер-тест' } },
  progressionRationale: '',
  cycleMetrics: {},
  weeks: [{ week: 1, pmRow: {}, days: [{ exercises: [] }] }],
};

/** Потребитель: показывает наличие тапер-плана и прикидов. */
const PlanConsumer: React.FC = () => {
  const tp = usePLTaper();
  return (
    <div>
      <span data-testid="plan">{tp.taperPlan ? `${tp.taperPlan.weeks.length} нед` : 'нет'}</span>
      <span data-testid="ov">{JSON.stringify(tp.taperAttemptOverride)}</span>
    </div>
  );
};

describe('P2-1: персист черновиков тапера (taperPlan/attemptOverride)', () => {
  it('ремаунт провайдера видит план и прикиды из сохранённой сессии', () => {
    const saved = {
      plTaperPlan: TAPER_PLAN,
      plTaperAttemptOverride: { 'Присед': [180, 190, 200] },
    };
    const { unmount } = render(<PLTaperProvider saved={saved}><PlanConsumer /></PLTaperProvider>);
    expect(screen.getByTestId('plan').textContent).toBe('1 нед');
    expect(screen.getByTestId('ov').textContent).toContain('Присед');
    unmount();
    // Ремаунт (условный F5): те же данные сессии → та же карточка «📋 Тапер-план».
    render(<PLTaperProvider saved={saved}><PlanConsumer /></PLTaperProvider>);
    expect(screen.getByTestId('plan').textContent).toBe('1 нед');
    expect(screen.getByTestId('ov').textContent).toBe('{"Присед":[180,190,200]}');
  });

  it('битый стор → честно пусто (план без weeks, прикиды не-числа)', () => {
    const saved = {
      plTaperPlan: { weeks: 'oops', template: null },
      plTaperAttemptOverride: { 'Присед': ['a', 'b'], 'Жим лежа': [100, 105, 'x'], 'Становая тяга': [0, 200] },
    };
    render(<PLTaperProvider saved={saved}><PlanConsumer /></PLTaperProvider>);
    expect(screen.getByTestId('plan').textContent).toBe('нет');
    // Нечисловые массивы отброшены, валидный сохранён (округлён).
    expect(screen.getByTestId('ov').textContent).toBe('{"Становая тяга":[0,200]}');
  });

  it('отсутствие черновиков — пусто (обратная совместимость)', () => {
    render(<PLTaperProvider saved={{ plBw: 90 }}><PlanConsumer /></PLTaperProvider>);
    expect(screen.getByTestId('plan').textContent).toBe('нет');
    expect(screen.getByTestId('ov').textContent).toBe('{}');
  });
});
