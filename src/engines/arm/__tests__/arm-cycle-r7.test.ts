import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { buildArmPrintHtml } from '../arm-export.engine';
import { buildArmProSummary } from '../arm-pro-integration.engine';

const BASE: any = { discipline: 'armlifting', patternId: 'grip_3_support', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 3 };

describe('arm-cycle-r7 (print summary chain + medley notes)', () => {
  it('медли ротируется по неделям в note (support→pinch→hub)', () => {
    const p: any = buildArmPlan({ ...BASE, medleyId: 'rt_saxon_hub' });
    expect(p.weeks[0].note).toMatch('rolling_thunder');
    expect(p.weeks[1].note).toMatch('saxon_bar');
    expect(p.weeks[2].note).toMatch('hub');
  });
  it('без медли и без тейпера — заметок недель нет', () => {
    const p: any = buildArmPlan({ ...BASE });
    expect(p.weeks.every((w: any) => !w.note)).toBe(true);
  });
  it('битый medleyId — тишина (без fallback-спама)', () => {
    const p: any = buildArmPlan({ ...BASE, medleyId: 'nope' });
    expect(p.weeks.every((w: any) => !w.note)).toBe(true);
  });
  it('цепочка UI: summary из inputSnapshot → печать со сводкой', () => {
    const p: any = buildArmPlan({ ...BASE, weeks: 12, cycleId: 'coc_12', cocWorking: 'no1', medleyId: 'rt_saxon_hub' } as any);
    expect(p.inputSnapshot.cycleId).toBe('coc_12');
    const s: any = buildArmProSummary(p.inputSnapshot);
    expect(s.cycle?.id).toBe('coc_12');
    const html = buildArmPrintHtml(p, undefined, s);
    expect(html).toContain('PRO-сводка тренера');
    expect(html).toContain('CoC 12-week');
    expect(html).toContain('🎯 Медли-фокус');
  });
});
