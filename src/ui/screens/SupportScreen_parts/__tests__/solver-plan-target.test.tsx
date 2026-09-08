/**
 * solver-plan-target.test.tsx — солвер кладёт вещества в живой план
 * (enhancedSubs), а не в препараты курса (supportDrugs): те синкаются из
 * linked.course (затирают чужое) и портят автовыбор уровня и drugLoads.
 *
 * Выбор симптома — программный (первый с кнопочным решением в проблеме 0),
 * без зависимости от порядка БД.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SymptomSolverTab } from '../SymptomSolverTab';
import { SYMPTOM_DB } from '../../../../engines/symptom-solver.engine';
import { resolveCatalogId, getCatalogEntryForSymptomSolution } from '../../../../engines/symptom-catalog-bridge';

const noop = () => {};

function solverMocks(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    supportDrugs: [],
    setSupportDrugs: noop,
    enhancedSubs: [],
    setEnhancedSubs: noop,
    effectiveLevel: { subs: [], dosages: {} },
    supportLevel: 'mid',
    calcSupport: noop,
    ...over,
  };
}

/** Первый симптом, у которого в проблеме 0 есть решение с кнопкой «➕ В план». */
function pickTarget() {
  for (const s of SYMPTOM_DB) {
    const p = s.problems[0];
    if (!p) continue;
    // точное условие кнопки в UI: не lifestyle + есть запись каталога
    const sol = p.solutions.find(
      (x) => x.type !== 'lifestyle' && getCatalogEntryForSymptomSolution(x.substanceId),
    );
    if (sol) return { symptom: s, solution: sol };
  }
  throw new Error('no button-eligible solution in SYMPTOM_DB');
}

describe('solver plan target', () => {
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
    vi.useRealTimers();
  });

  it('«➕ В план» пишет в enhancedSubs, а не в препараты курса', () => {
    vi.useFakeTimers();
    const setEnhancedSubs = vi.fn();
    const setSupportDrugs = vi.fn();
    const calcSupport = vi.fn();
    const { symptom, solution } = pickTarget();
    const expectedId = resolveCatalogId(solution.substanceId);
    expect(expectedId, 'solution resolves to catalog').toBeTruthy();
    const { getByText, getAllByText, queryByText } = render(
      <SymptomSolverTab s={solverMocks({ setEnhancedSubs, setSupportDrugs, calcSupport })} />,
    );
    fireEvent.click(getByText(symptom.symptom));
    fireEvent.click(getAllByText('➕ В план')[0]);
    expect(setSupportDrugs, 'course list untouched').not.toHaveBeenCalled();
    expect(setEnhancedSubs, 'live plan updated').toHaveBeenCalledTimes(1);
    expect(setEnhancedSubs).toHaveBeenCalledWith([expectedId]);
    // пересчёт рисков идёт отложенно (100мс) — крутим таймеры
    expect(calcSupport).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(calcSupport, 'risks recalculated').toHaveBeenCalledTimes(1);
    expect(queryByText(/добавлен в план/i)).not.toBeNull();
  });

  it('повторное добавление того же вещества — тост «уже в плане», без дубля', () => {
    const setEnhancedSubs = vi.fn();
    const { symptom } = pickTarget();
    const { solution } = pickTarget();
    const solId = resolveCatalogId(solution.substanceId) as string;
    const { getByText, getAllByText, queryByText } = render(
      <SymptomSolverTab
        s={solverMocks({
          setEnhancedSubs,
          enhancedSubs: [solId],
          effectiveLevel: { subs: [solId], dosages: {} },
        })}
      />,
    );
    fireEvent.click(getByText(symptom.symptom));
    fireEvent.click(getAllByText('➕ В план')[0]);
    expect(setEnhancedSubs, 'no duplicate write').not.toHaveBeenCalled();
    expect(queryByText(/уже в плане/i)).not.toBeNull();
  });
});
