/**
 * favorites-nav-p0.test.tsx — P0-2 аудита калькулятора: навигация из «Избранного».
 *
 * Было: «🧮 В калькулятор» вёл в section='info' (гейт калькулятора не проходил),
 * «📂» комплект — в несуществующий calcView='mixcalc' (пустой экран), настройки микса
 * никто не читал. Стало: оба ведут в калькулятор (section='generator'+tab='calculator'),
 * комплект при этом ставит свои вещества в очередь плана поддержки.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportFavoritesView } from '../SupportFavoritesView';

const noop = () => {};

function planMocks(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    catalogSubstances: [],
    favTab: 'favorites',
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
    setGenTab: noop,
    linked: {},
    jointMode: false,
    boostEnabled: false,
    setShowModal: noop,
    effectiveLevel: { subs: [], dosages: {} },
    enhancedSubs: [],
    showToast: noop,
    ...over,
  };
}

beforeEach(() => {
  try { localStorage.clear(); } catch {}
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch {}
});

describe('favorites-nav-p0', () => {
  it('«В калькулятор» из рекомендации: очередь + правильная навигация (generator/calculator)', () => {
    localStorage.setItem(
      'he_support_fav_recommendations',
      JSON.stringify([
        {
          id: 'r1', title: 'Микс X', kind: 'mix', goal: 'pump',
          substances: [{ id: 'magnesium', found: true }, { id: 'taurine', found: true }],
          interactions: [], general: [], ts: Date.now(),
        },
      ]),
    );
    const setSection = vi.fn();
    const setTab = vi.fn();
    const setGenTab = vi.fn();
    const setCalcView = vi.fn();
    const setSupportView = vi.fn();
    const { getByText } = render(
      <SupportFavoritesView s={planMocks({ setSection, setTab, setGenTab, setCalcView, setSupportView })} />,
    );
    fireEvent.click(getByText('🧮 В калькулятор'));
    expect(setSection).toHaveBeenCalledWith('generator');
    expect(setTab).toHaveBeenCalledWith('calculator');
    expect(setGenTab).toHaveBeenCalledWith('calculator');
    expect(setCalcView).toHaveBeenCalledWith('calculator');
    expect(setSupportView).toHaveBeenCalledWith('calc');
    const q = JSON.parse(localStorage.getItem('he_training_mix_plan_queue') || '[]');
    expect(q.length).toBe(1);
    expect(q[0].ids).toEqual(['magnesium', 'taurine']);
  });

  it('«📂» комплект: вещества (mg≠0) в очередь + навигация в калькулятор, без mixcalc', () => {
    localStorage.setItem(
      'he_saved_calc_results',
      JSON.stringify([
        {
          id: 99, type: 'mix', goal: 'pump', timing: 'pre', workoutType: 'moderate', timeOfDay: 'morning',
          stack: [{ id: 'magnesium', mg: 100 }, { id: 'water', mg: 0 }, { id: 'taurine', mg: 500 }],
          date: new Date().toISOString(),
        },
      ]),
    );
    const setSection = vi.fn();
    const setTab = vi.fn();
    const setGenTab = vi.fn();
    const setCalcView = vi.fn();
    const setPlanSaved = vi.fn();
    const { getByText } = render(
      <SupportFavoritesView s={planMocks({ favTab: 'mixes', setSection, setTab, setGenTab, setCalcView, setPlanSaved })} />,
    );
    fireEvent.click(getByText('📂'));
    expect(setSection).toHaveBeenCalledWith('generator');
    expect(setTab).toHaveBeenCalledWith('calculator');
    expect(setGenTab).toHaveBeenCalledWith('calculator');
    expect(setCalcView).toHaveBeenCalledWith('calculator');
    expect(setCalcView).not.toHaveBeenCalledWith('mixcalc');
    expect(setPlanSaved).toHaveBeenCalledWith('✅ Комплект в очереди калькулятора (2)');
    const q = JSON.parse(localStorage.getItem('he_training_mix_plan_queue') || '[]');
    expect(q.length).toBe(1);
    expect(q[0].ids).toEqual(['magnesium', 'taurine']);
  });

  it('«📂» пустой комплект: честное предупреждение, навигация всё равно в калькулятор', () => {
    localStorage.setItem(
      'he_saved_calc_results',
      JSON.stringify([
        { id: 100, type: 'mix', goal: 'pump', statck: [], stack: [], date: new Date().toISOString() },
      ]),
    );
    const setSection = vi.fn();
    const setPlanSaved = vi.fn();
    const { getByText } = render(
      <SupportFavoritesView s={planMocks({ favTab: 'mixes', setSection, setPlanSaved })} />,
    );
    fireEvent.click(getByText('📂'));
    expect(setPlanSaved).toHaveBeenCalledWith('⚠ В комплекте нет распознанных веществ');
    expect(setSection).toHaveBeenCalledWith('generator');
    const q = JSON.parse(localStorage.getItem('he_training_mix_plan_queue') || '[]');
    expect(q.length).toBe(0);
  });
});
