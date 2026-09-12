/**
 * protocol-export-labs.test.ts — печать берёт персональный график, а не статику.
 */
import { describe, it, expect } from 'vitest';
import { buildExportDataFromRec } from '../ProtocolExport';

const patient = { name: 'T', age: 30, weight: 90, height: 180, sex: 'm' };
const course = { drugs: ['test_enan'], peds: ['test_enan'], weeks: 12, phase: 'course' };

function recWith(schedule: any[], phase = 'course'): any {
  return {
    subs: [],
    phase,
    monitoringSchedule: schedule,
    monitoringPlan: 'line1\nline2',
    protocolWarnings: [],
  };
}

describe('buildExportDataFromRec — labSchedule из движка', () => {
  it('персональные пункты (Hcy, преаналитика) попадают в печать', () => {
    const data = buildExportDataFromRec(recWith([
      { id: 'baseline', label: 'До курса', period: '0 нед', items: [{ marker: 'Гомоцистеин + B12', reason: 'r', target: 'Hcy<10', escalation: 'Hcy>15 — врач' }] },
      { id: 'preanalytics', label: 'Преаналитика', period: 'всегда', items: [{ marker: 'Биотин-стоп', reason: 'r' }] },
    ]), patient, course);
    const all = JSON.stringify(data.labSchedule);
    expect(all).toContain('Гомоцистеин');
    expect(all).toContain('[До курса]');
    expect(all).toContain('Биотин-стоп');
    expect(data.labSchedule[0].criticalThreshold).toBe('Hcy>15 — врач');
  });
  it('без графика — честный статический fallback (14 строк)', () => {
    const data = buildExportDataFromRec(recWith([]), patient, course);
    expect(data.labSchedule).toHaveLength(14);
    expect(data.labSchedule.some(l => l.marker === 'АЛТ')).toBe(true);
  });
  it('дельта-правила — только на курсе/мосту/TRT, не в PCT', () => {
    const on = buildExportDataFromRec(recWith([], 'course'), patient, course);
    expect(on.protocol.clinicalNotes.join(' ')).toContain('Дельта-правила');
    const pct = buildExportDataFromRec(recWith([], 'pct'), patient, course);
    expect(pct.protocol.clinicalNotes.join(' ')).not.toContain('Дельта-правила');
  });
});
