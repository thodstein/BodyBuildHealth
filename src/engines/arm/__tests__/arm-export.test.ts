import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { buildArmPrintHtml, buildArmIcs } from '../arm-export.engine';

describe('arm-export', () => {
  const plan: any = (() => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    return p;
  })();
  it('print html contains plan name and weeks', () => {
    const html = buildArmPrintHtml(plan);
    expect(html).toContain(plan.pattern.name);
    expect(html).toContain('Неделя 1');
    expect(html).toContain('PRO:');
  });
  it('ics contains VCALENDAR and events', () => {
    const ics = buildArmIcs(plan, '2026-09-01');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART');
    expect(ics).toContain('Арм Н1');
  });
  it('ics escaping', () => {
    const ics = buildArmIcs(plan);
    expect(ics).not.toContain('\n\n');
  });
});
