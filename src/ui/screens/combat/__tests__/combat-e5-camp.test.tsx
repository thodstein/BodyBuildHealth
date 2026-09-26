/**
 * combat-e5-camp.test.tsx — локи E5 «календарь лагеря + чистый год».
 *
 * Неделя цикла была пассивным чипом: нельзя было перейти к неделе и увидеть
 * траекторию нагрузки. Год нельзя было удалить, а фаза недели и остаток
 * макроцикла по Issurin считались движком вхолостую.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CampStrip } from '../cb-camp-strip';
import { AnnualCard } from '../combat-annual-card';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { buildAnnualATR, annualCBPhaseForWeek, annualResidualNote, removeCompetitionFromAnnual, addCompetitionToAnnual, saveAnnualCB, loadAnnualCB } from '../../../../engines/combat/combat-annual';

beforeEach(() => localStorage.clear());

const mkPlan = (over: any = {}) =>
  finalizeCombatPlan(buildCombatPlan({
    discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, bodyweight: 80, ...over,
  } as any));

describe('E5.1 — неделя цикла навигируема', () => {
  it('каждая нед��ля — кнопка с aria-label и кликом', () => {
    const plan = mkPlan();
    const onPick = vi.fn();
    render(<CampStrip plan={plan} expandedWeek={null} onPickWeek={onPick} />);
    const w1 = screen.getByRole('button', { name: /Неделя 1,/ });
    fireEvent.click(w1);
    expect(onPick).toHaveBeenCalledWith(0);
  });

  it('повторный клик по активной неделе сбрасывает выбор', () => {
    const onPick = vi.fn();
    render(<CampStrip plan={mkPlan()} expandedWeek={0} onPickWeek={onPick} />);
    const w1 = screen.getByRole('button', { name: /Неделя 1,/ });
    expect(w1.getAttribute('aria-current')).toBe('true');
    fireEvent.click(w1);
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('полоса объёма нормирована по максимуму (не абсолютные числа)', () => {
    const plan = mkPlan();
    const max = Math.max(...plan.weeksData.map(w => w.totalSets || 0));
    render(<CampStrip plan={plan} expandedWeek={null} onPickWeek={() => {}} />);
    // у самой нагруженной недели полоса = 100%
    const heavy = plan.weeksData.reduce((a, b) => ((b.totalSets || 0) > (a.totalSets || 0) ? b : a));
    const btn = screen.getByRole('button', { name: new RegExp(`Неделя ${heavy.week},`) });
    const bar = btn.querySelector('span span') as HTMLElement;
    expect(bar.style.width).toBe('100%');
    expect(max).toBeGreaterThan(0);
  });
});

describe('E5.2 — траектория нагрузки лагеря', () => {
  it('разница объёмов первой и последней недели показана', () => {
    const plan = mkPlan();
    const delta = (plan.weeksData[0].totalSets || 0) - (plan.weeksData[plan.weeksData.length - 1].totalSets || 0);
    render(<CampStrip plan={{ ...plan, inputSnapshot: { ...(plan.inputSnapshot as any), heatSessions: true, heatSessionsCount: 3 } } as any} expandedWeek={null} onPickWeek={() => {}} />);
    expect(screen.getByText(new RegExp(`нагрузка падает по неделям на ${delta} сетов`))).toBeTruthy();
  });

  it('без тепловой адаптации блока нет (не показываем пустую строку)', () => {
    render(<CampStrip plan={mkPlan()} expandedWeek={null} onPickWeek={() => {}} />);
    expect(screen.queryByText(/Тепловая адаптация/)).toBeNull();
  });
});

describe('E5.3 — год: фаза недели и остаток Issurin', () => {
  it('строка фазы/остатка на экране совпадает с движком', () => {
    const annual = buildAnnualATR('mma', 24, null, { cycles: 2 } as any);
    const ref = 12;
    const phase = annualCBPhaseForWeek(annual, ref)!;
    render(<AnnualCard annual={annual} annualCyclesHint={2} onBuildATR={() => {}} />);
    expect(screen.getByText(/Ориентир недели 12/)).toBeTruthy();
    expect(screen.getByText(new RegExp(annualResidualNote(2).slice(0, 18).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
    expect(phase).toBeTruthy();
  });
});

describe('E5.4 — год можно удалить', () => {
  it('кнопка удаления года есть и зовёт обработчик', () => {
    const annual = buildAnnualATR('mma', 12, null, { cycles: 1 } as any);
    const onRemove = vi.fn();
    render(<AnnualCard annual={annual} onBuildATR={() => {}} onRemoveAnnual={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить годовой ATR' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('без обработчика кнопки удаления нет (не мёртвый контрол)', () => {
    const annual = buildAnnualATR('mma', 12, null, { cycles: 1 } as any);
    render(<AnnualCard annual={annual} onBuildATR={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Удалить годовой ATR' })).toBeNull();
  });
});

describe('E5.5 — удаление боя сносит его тапер-блок', () => {
  it('год не разъезжается после удаления боя', () => {
    const annual = buildAnnualATR('mma', 24, '2026-01-05', { cycles: 1 } as any);
    const before = annual.blocks.length;
    const withFight = addCompetitionToAnnual(annual, { id: 'c1', name: 'Бой', date: '2026-03-01', priority: 'main' } as any, '2026-01-05');
    expect(withFight.blocks.length).not.toBe(before);
    const after = removeCompetitionFromAnnual(withFight, 'c1');
    expect(after.competitions.length).toBe(0);
    // номера недель снова подряд 1..N и без дыр
    let cur = 1;
    for (const b of after.blocks) { expect(b.startWeek).toBe(cur); cur += b.weeks; }
    expect(after.totalWeeks).toBe(cur - 1);
  });
});
