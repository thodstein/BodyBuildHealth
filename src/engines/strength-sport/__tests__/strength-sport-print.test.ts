import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { buildStrengthPrintHtml, buildStrengthCsv } from '../strength-sport-export';

describe('PrintLayout header/QR/Gantt + medley без хака', () => {
  it('header/logo/QR present', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ yokeWalk:200 } } as any);
    const html = buildStrengthPrintHtml(p);
    expect(html).toContain('BodyBuildHealth');
    expect(html).toContain('QR');
    expect(html).toContain('🏋️');
    expect(html).toContain(p.patternId);
  });
  it('Gantt phase/taper отдельно', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'peaking', level:'intermediate', weeks:4, daysPerWeek:3, workMax:{ snatch:80 }, competitionDate:'2026-10-01', taperWeeks:2 } as any);
    // ensure taper flag for Gantt
    const html = buildStrengthPrintHtml(p);
    expect(html).toContain('Gantt');
    // at least one phase color present
    expect(html).toMatch(/#0A84FF|#FF9F0A|#30D158/);
  });
  it('medley секция без хака <h3>Medley цепь</h3>', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:250, farmersWalk:140 }, equipment:['barbell','other'] } as any);
    const html = buildStrengthPrintHtml(p);
    expect(html).toContain('Medley');
    // new section uses <section> and h3 with ⛓️, not old hack
    expect(html).toContain('⛓️ Medley');
    expect(html).not.toContain('<h3 style="margin:10px 0 4px">Medley цепь</h3>');
  });
  it('@media print Gantt break-inside', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    const html = buildStrengthPrintHtml(p);
    expect(html).toContain('@media print');
    expect(html).toContain('break-inside');
  });
  it('CSV 16 колонок дист/cap', () => {
    const p = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    const csv = buildStrengthCsv(p);
    const header = csv.split('\n')[0];
    expect(header.split(';').length).toBe(16);
    expect(header).toContain('Дист');
  });
});
