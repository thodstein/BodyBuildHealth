import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ArmHeatmap, colorFor } from '../ArmHeatmap';
import { buildArmPlan } from '../../../../engines/arm/arm-builder.engine';
import { finalizeArmPlan } from '../../../../engines/arm/arm-finalize.engine';

describe('ArmHeatmap', () => {
  it('renders weeks and muscles', () => {
    let plan: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 });
    plan = finalizeArmPlan(plan,{level:'intermediate'});
    plan.level='intermediate';
    const { container } = render(<ArmHeatmap plan={plan} />);
    expect(container.textContent).toContain('Тепловая карта');
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('empty plan null', () => {
    const { container } = render(<ArmHeatmap plan={{ weeks:[] } as any} />);
    expect(container.innerHTML).toBe('');
  });
  it('ровно MAV — ещё зелёный, амбер только выше MAV (канон volumeStatusOf)', () => {
    const lm = { mev: 4, mav: 8, mrv: 14 };
    expect(colorFor(8, lm)).toBe('rgba(34,197,94,0.5)');
    expect(colorFor(8.1, lm)).toBe('rgba(245,158,11,0.7)');
    expect(colorFor(14, lm)).toBe('rgba(245,158,11,0.7)');
    expect(colorFor(14.1, lm)).toBe('rgba(239,68,68,0.7)');
    expect(colorFor(4, lm)).toBe('rgba(34,197,94,0.5)');
    expect(colorFor(3, lm)).toBe('rgba(96,165,250,0.4)');
  });
});
