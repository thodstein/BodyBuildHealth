/**
 * weekly-plan-mech-coverage.test.tsx — guard честности блока «Механизмы».
 *
 * Раньше блок назывался «Механизмы с покрытием (N)» и выводил ВСЕ механизмы
 * (включая непокрытые) сырыми ключами `cardio.cv1`. Непокрытые механизмы
 * вообще не выводились, хотя `uncoveredMechanisms` движок считал.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { WeeklyPlanView } from '../WeeklyPlanView';
import type { PlanResult } from '../../../../engines/support-plan';

const mech = (id: string, label: string, covered: boolean, risk = 10) => ({
  mechKey: id, mechLabel: label, systemLabel: 'Сердечно-сосудистая',
  substances: covered ? ['omega3'] : [], riskBefore: risk, riskAfter: covered ? risk - 3 : risk,
  covered,
});

function makePlan(over: Partial<PlanResult> = {}): PlanResult {
  return {
    substances: [], dosages: {}, schedule: [], systems: {}, mechanisms: [],
    coveragePercent: 60, synergyComment: '', monitoring: [], specialInstructions: [],
    riskDynamics: [], overallRiskBefore: 40, overallRiskAfter: 25, labFindings: [],
    uncoveredMechanisms: [], coverageGaps: [], weekScale: 1, stackRecommendations: [],
    conflicts: [], riskBreakdown: {},
    pillBurden: { totalSubstances: 0, estimatedPillsPerDay: 0, morningPills: 0, afternoonPills: 0, eveningPills: 0, feasibility: 'unknown', message: '' },
    ...over,
  } as unknown as PlanResult;
}

afterEach(() => cleanup());

describe('WeeklyPlanView: механизмы закрыты/не закрыты честно', () => {
  it('пишет «Закрыто X из N» и не выдаёт непокрытые за покрытые', () => {
    const plan = makePlan({
      mechanisms: [
        mech('cv1', 'Фиброз миокарда', true),
        mech('cv2', 'Дислипидемия', true),
        mech('cv3', 'Задержка натрия', false),
      ],
      uncoveredMechanisms: [{ mechKey: 'cv3', mechLabel: 'Задержка натрия', systemLabel: 'Сердечно-сосудистая', risk: 22 }],
    });
    const { container } = render(<WeeklyPlanView planResult={plan} courseWeek={4} />);
    expect(container.textContent).toContain('Закрыто 2 из 3 механизмов риска (67%)');
    expect(container.textContent).toContain('Фиброз миокарда');
    expect(container.textContent).toContain('Дислипидемия');
    // Непокрытый — в отдельном блоке с риском, а не среди «закрытых» чипов.
    expect(container.textContent).toContain('Не закрыто (1)');
    expect(container.textContent).toContain('Задержка натрия · 22');
  });

  it('сырые ключи механизмов не показываются', () => {
    const plan = makePlan({
      mechanisms: [mech('cv1', 'Фиброз миокарда', true)],
    });
    const { container } = render(<WeeklyPlanView planResult={plan} courseWeek={4} />);
    expect(container.textContent).not.toContain('cv1');
  });

  it('всё закрыто — блока «Не закрыто» нет', () => {
    const plan = makePlan({
      mechanisms: [mech('cv1', 'Фиброз миокарда', true)],
      uncoveredMechanisms: [],
    });
    const { container } = render(<WeeklyPlanView planResult={plan} courseWeek={4} />);
    expect(container.textContent).toContain('Закрыто 1 из 1 механизмов риска (100%)');
    expect(container.textContent).not.toContain('Не закрыто');
  });

  it('больше 8 непокрытых — список усечён с «+N ещё»', () => {
    const uncovered = Array.from({ length: 10 }, (_, i) => ({
      mechKey: `m${i}`, mechLabel: `Механизм ${i}`, systemLabel: 'Печень', risk: 30 - i,
    }));
    const plan = makePlan({
      mechanisms: uncovered.map((u, i) => mech(u.mechKey, u.mechLabel, i === 0)),
      uncoveredMechanisms: uncovered.slice(1),
    });
    const { container } = render(<WeeklyPlanView planResult={plan} courseWeek={4} />);
    // 9 непокрытых, показаны 8
    expect(container.textContent).toContain('Не закрыто (9)');
    expect(container.textContent).toContain('+1 ещё');
  });
});
