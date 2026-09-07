/**
 * fav-plan-source.test.tsx — таб «План» читает посчитанный движком план
 * (effectiveLevel), а не пустой SUPPORT_LEVELS. Раньше таб был вечно пуст,
 * «Из моих стеков» мутировал in-memory объект + reload (всё терялось),
 * удаления дёргали location.reload, валидации орали через alert().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportFavoritesView } from '../SupportFavoritesView';
import { SupportStacksView } from '../SupportStacksView';

const noop = () => {};

function planMocks(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    catalogSubstances: [
      { id: 'sub_a', name: 'A-витамин' },
      { id: 'sub_b', name: 'B-минерал' },
      { id: 'sub_c', name: 'C-добавка' },
    ],
    favTab: 'plan',
    setFavTab: noop,
    favSearch: '',
    setFavSearch: noop,
    favRefresh: 0,
    setFavRefresh: noop,
    SUPPORT_LEVELS: {},
    supportLevel: 'mid',
    calcSupport: noop,
    setPlanSaved: noop,
    planSubTab: 'active',
    setPlanSubTab: noop,
    archivedPlans: [],
    setArchivedPlans: noop,
    expandedArchiveId: null,
    setExpandedArchiveId: noop,
    cartItems: [],
    setCartItems: noop,
    setCalcResult: noop,
    setCalcDone: noop,
    setSupportLevel: noop,
    setCourseWeekState: noop,
    setBoostEnabled: noop,
    setJointMode: noop,
    setEnhancedSubs: noop,
    setMyPlansRefresh: noop,
    reportGenerated: false,
    setReportGenerated: noop,
    mixGoals: [],
    setMixGoals: noop,
    mixWorkoutType: 'moderate',
    setMixWorkoutType: noop,
    mixTimeOfDay: 'morning',
    setMixTimeOfDay: noop,
    setSection: noop,
    setTab: noop,
    setSupportView: noop,
    setCalcView: noop,
    linked: {},
    effectiveLevel: {
      subs: ['sub_a', 'sub_b'],
      dosages: { sub_a: { mg: 100, timing: 'утро' }, sub_b: { mg: 250, timing: 'вечер' } },
    },
    enhancedSubs: [],
    showToast: noop,
    ...over,
  };
}

describe('fav plan source', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
  });

  it('действующий план показывает вещества и дозы из движка', () => {
    const { container, queryByText } = render(<SupportFavoritesView s={planMocks()} />);
    expect(container.textContent).toContain('A-витамин');
    expect(container.textContent).toContain('B-минерал');
    expect(container.textContent).toContain('100мг');
    expect(container.textContent).toContain('вечер');
    expect(queryByText(/Нет препаратов в плане/)).toBeNull();
  });

  it('пустой план движка — честное пустое состояние', () => {
    const { container } = render(
      <SupportFavoritesView s={planMocks({ effectiveLevel: { subs: [], dosages: {} } })} />,
    );
    expect(container.textContent).toContain('Нет препаратов в плане');
  });

  it('добавление стека идёт через setEnhancedSubs, без reload', () => {
    localStorage.setItem(
      'savedStacks',
      JSON.stringify([{ id: 'st1', name: 'Тестовый стек', subs: ['sub_a', 'sub_c'], dosages: {} }]),
    );
    const setEnhancedSubs = vi.fn();
    const showToast = vi.fn();
    const { getByText } = render(
      <SupportFavoritesView s={planMocks({ setEnhancedSubs, showToast })} />,
    );
    fireEvent.click(getByText('📦 Из моих стеков'));
    expect(getByText('Тестовый стек')).not.toBeNull();
    fireEvent.click(getByText(/Добавить \(1\)/));
    // sub_a уже в плане — добавляется только sub_c
    expect(setEnhancedSubs).toHaveBeenCalledWith(['sub_c']);
    expect(showToast).toHaveBeenCalledWith('✅ В план добавлено: 1');
  });

  it('удаление сохранённого плана чистит стор тиком, без reload', () => {
    localStorage.setItem(
      'he_my_plans',
      JSON.stringify([{ id: 7, name: 'P', date: new Date().toISOString(), subs: [] }]),
    );
    const setMyPlansRefresh = vi.fn();
    const { getByText } = render(
      <SupportFavoritesView s={planMocks({ planSubTab: 'myplans', setMyPlansRefresh })} />,
    );
    fireEvent.click(getByText('🗑'));
    expect(JSON.parse(localStorage.getItem('he_my_plans') || '[]')).toEqual([]);
    expect(setMyPlansRefresh).toHaveBeenCalled();
  });
});

describe('stacks view save source', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
  });

  function stacksMocks(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      stackName: 'Мой стек',
      setStackName: noop,
      SUPPORT_LEVELS: {},
      supportLevel: 'mid',
      savedStacks: [],
      setSavedStacks: noop,
      expandedStack: null,
      setExpandedStack: noop,
      getStackDisplayName: (st: { name?: string; id: string }) => st.name || st.id,
      catalogSubstances: [],
      effectiveLevel: { subs: ['x1'], dosages: { x1: { mg: 50, timing: 'вечер' } } },
      showToast: noop,
      ...over,
    };
  }

  it('сохранение пишет живой план в стор и персистит', () => {
    const setSavedStacks = vi.fn();
    const showToast = vi.fn();
    const { getByText } = render(
      <SupportStacksView s={stacksMocks({ setSavedStacks, showToast })} />,
    );
    fireEvent.click(getByText('Сохранить'));
    expect(setSavedStacks).toHaveBeenCalledTimes(1);
    const saved = setSavedStacks.mock.calls[0][0];
    expect(saved[0].subs).toEqual(['x1']);
    expect(saved[0].dosages).toEqual({ x1: { mg: 50, timing: 'вечер' } });
    const persisted = JSON.parse(localStorage.getItem('savedStacks') || '[]');
    expect(persisted[0].subs).toEqual(['x1']);
    expect(showToast).toHaveBeenCalledWith('✅ Стек сохранён');
  });

  it('пустой план — тост вместо пустого стека', () => {
    const setSavedStacks = vi.fn();
    const showToast = vi.fn();
    const { getByText } = render(
      <SupportStacksView
        s={stacksMocks({
          setSavedStacks,
          showToast,
          effectiveLevel: { subs: [], dosages: {} },
        })}
      />,
    );
    fireEvent.click(getByText('Сохранить'));
    expect(setSavedStacks).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Нет препаратов в калькуляторе');
  });
});
