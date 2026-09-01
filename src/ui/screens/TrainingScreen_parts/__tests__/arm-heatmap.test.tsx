import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ArmHeatmap } from '../ArmHeatmap';
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
});
