/**
 * weekly-plan-ul-warnings.test.tsx — guard: недельный план показывает UL
 * по фактическим дозам, а не молчит.
 *
 * Движок считал `ulWarnings` (после нормализации по весу и UL-капа), но
 * `WeeklyPlanView` его не выводил: пользователь видел дозу 4000 МЕ и не знал,
 * что расчёт давал 5960 МЕ и дозу срезал предел.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { WeeklyPlanView } from '../WeeklyPlanView';
import type { PlanResult } from '../../../../engines/support-plan';

function makePlan(over: Partial<PlanResult> = {}): PlanResult {
  return {
    substances: [{ id: 'vitamin_d3', name: 'Витамин D3' }],
    dosages: {}, schedule: [], systems: {}, mechanisms: [],
    coveragePercent: 60, synergyComment: '', monitoring: [], specialInstructions: [],
    riskDynamics: [], overallRiskBefore: 40, overallRiskAfter: 25, labFindings: [],
    uncoveredMechanisms: [], coverageGaps: [], weekScale: 1, stackRecommendations: [],
    conflicts: [], riskBreakdown: {},
    pillBurden: { totalSubstances: 1, estimatedPillsPerDay: 1, morningPills: 1, afternoonPills: 0, eveningPills: 0, feasibility: 'ok', message: '' },
    ...over,
  } as unknown as PlanResult;
}

afterEach(() => cleanup());

describe('WeeklyPlanView: UL по фактическим дозам', () => {
  it('показывает расчётную дозу, кап и процент от UL с единицей вещества', () => {
    const plan = makePlan({
      ulWarnings: [{
        substanceId: 'vitamin_d3',
        currentDoseMg: 149,
        ulMg: 100,
        percentUL: 149,
        risk: 'Превышение UL',
        recommendation: '…',
        appliedDoseMg: 100,
      }],
    });
    const { container } = render(<WeeklyPlanView planResult={plan} courseWeek={4} />);
    const text = container.textContent || '';
    expect(text).toContain('Пределы доз (UL) по фактическим дозам плана (1)');
    expect(text).toContain('Витамин D3');
    expect(text).toContain('5960 МЕ');   // расчётная доза (149 мкг × 40)
    expect(text).toContain('4000 МЕ');   // UL и кап (100 мкг × 40)
    expect(text).toContain('149% от UL');
    expect(text).toContain('ограничено до');
  });

  it('без предупреждений блока нет (и «лишних» нулей тоже)', () => {
    const { container } = render(<WeeklyPlanView planResult={makePlan()} courseWeek={4} />);
    expect(container.textContent).not.toContain('Пределы доз (UL)');
  });

  it('не подписывает микродозы как «мг»', () => {
    const plan = makePlan({
      ulWarnings: [{
        substanceId: 'selenium', currentDoseMg: 300, ulMg: 255, percentUL: 118,
        risk: 'Превышение UL', recommendation: '…', appliedDoseMg: 255,
      }],
    });
    const { container } = render(<WeeklyPlanView planResult={plan} courseWeek={4} />);
    const text = container.textContent || '';
    expect(text).toContain('300 мкг');
    expect(text).toContain('255 мкг');
    expect(text).not.toContain('300 мг');
  });
});
