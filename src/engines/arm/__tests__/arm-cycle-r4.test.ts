import { describe, it, expect } from 'vitest';
import { buildArmBlock } from '../arm-annual';

describe('arm-cycle-r4 (annual block + named cycle)', () => {
  it('блок с toproll_6: пресет 0.9/0.7 главнее годовой классики', () => {
    const res: any = buildArmBlock(
      { blockKey: 'cycle-top', weeks: 6, phase: 'peaking' },
      { level: 'intermediate', cycleId: 'toproll_6', taperEnabled: true, taperWeeks: 2 } as any,
    );
    expect(res.taperApplied).toBe(true);
    expect(res.armPlan.inputSnapshot.cycleId).toBe('toproll_6');
    const notes = res.armPlan.weeks.map((w: any) => String(w.note || ''));
    // хвост размечен пресетом цикла, а НЕ классикой 0.65/0.45
    expect(notes[4]).toMatch('[arm-taper:0.9]');
    expect(notes[5]).toMatch('[arm-taper:0.7]');
    expect(notes.join(' ')).not.toMatch('[arm-taper:0.65]');
    expect(notes.join(' ')).not.toMatch('[arm-taper:0.45]');
  });
  it('блок со strengthlog_8 (classic): годовая классика как раньше', () => {
    const res: any = buildArmBlock(
      { blockKey: 'cycle-classic', weeks: 8, phase: 'peaking' },
      { level: 'intermediate', cycleId: 'strengthlog_8', taperEnabled: true, taperWeeks: 2 } as any,
    );
    expect(res.taperApplied).toBe(true);
    const notes = res.armPlan.weeks.map((w: any) => String(w.note || ''));
    expect(notes[6]).toMatch('[arm-taper:0.65]');
    expect(notes[7]).toMatch('[arm-taper:0.45]');
  });
  it('блок без цикла: поведение байт-в-байт (классика при taperEnabled)', () => {
    const res: any = buildArmBlock(
      { blockKey: 'plain', weeks: 4, phase: 'peaking' },
      { level: 'intermediate', taperEnabled: true, taperWeeks: 2 } as any,
    );
    const notes = res.armPlan.weeks.map((w: any) => String(w.note || ''));
    expect(notes[2]).toMatch('[arm-taper:0.65]');
    expect(notes[3]).toMatch('[arm-taper:0.45]');
  });
  it('passthrough: correctionPct/medley/coc доходят до inputSnapshot', () => {
    const res: any = buildArmBlock(
      { blockKey: 'pass', weeks: 4, phase: 'strength' },
      { level: 'intermediate', correctionPct: 0.5, medleyId: 'rt_saxon_hub', cocWorking: 'no1' } as any,
    );
    expect(res.armPlan.inputSnapshot.correctionPct).toBe(0.5);
    expect(res.armPlan.inputSnapshot.medleyId).toBe('rt_saxon_hub');
    expect(res.armPlan.inputSnapshot.cocWorking).toBe('no1');
  });
});
