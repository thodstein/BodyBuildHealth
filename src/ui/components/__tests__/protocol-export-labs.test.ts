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

describe('buildExportDataFromRec — доза и МНН из плана, а не из прозы', () => {
  const recSub = (reason: string): any => ({
    subs: [{ substanceId: 'selenium', reason, category: 'mineral' }],
    phase: 'course',
    monitoringSchedule: [],
    protocolWarnings: [],
  });

  it('доза берётся из карточки плана (resolvePlanDose), числа из reason игнорируются', () => {
    const data = buildExportDataFromRec(
      recSub('Антиоксидант: 5000 МЕ — глутатионпероксидаза'),
      patient,
      course,
      [{ id: 'selenium', name: 'Селен', doseDisplay: '200 мкг', timing: 'с едой' }],
    );
    const s = data.protocol.substances[0];
    expect(s.mnn).toBe('Селен');
    expect(s.dose).toBe('200 мкг');
    expect(s.frequency).toBe('с едой');
    expect(s.mechanism).toContain('глутатионпероксидаза'); // обоснование — в «Механизм», не в «Дозу»
  });

  it('без плана доза не выдумывается: «—», название из каталога', () => {
    const data = buildExportDataFromRec(recSub('Селен 5000 МЕ'), patient, course);
    const s = data.protocol.substances[0];
    expect(s.dose).toBe('—');
    expect(s.frequency).toBe('—');
    expect(s.mnn).toBe('Селен');
  });
});

describe('buildExportDataFromRec — пороги по полу', () => {
  const byMarker = (data: any, marker: string) => data.labSchedule.find((l: any) => l.marker === marker);

  it('♀ fallback: HCT 48/52, АЛТ 31/78, креатинин 97, без ПСА', () => {
    const fem = buildExportDataFromRec(recWith([]), { ...patient, sex: 'female' }, course);
    expect(byMarker(fem, 'Гематокрит').target).toBe('<48%');
    expect(byMarker(fem, 'Гематокрит').criticalThreshold).toContain('>52%');
    expect(byMarker(fem, 'АЛТ').target).toBe('<31 Ед/л');
    expect(byMarker(fem, 'АЛТ').criticalThreshold).toContain('>78');
    expect(byMarker(fem, 'Креатинин').target).toBe('<97 мкмоль/л');
    expect(byMarker(fem, 'ПСА')).toBeUndefined();
    expect(fem.protocol.stopCriteria.join(' ')).toContain('>52%');
    expect(fem.protocol.clinicalNotes.join(' ')).toContain('♀');
  });

  it('♂ (и legacy sex=m) — мужской путь байт-в-байт: HCT 54, АЛТ 200, ПСА есть', () => {
    const male = buildExportDataFromRec(recWith([]), patient, course);
    expect(byMarker(male, 'Гематокрит').criticalThreshold).toBe('>54% (флеботомия)');
    expect(byMarker(male, 'АЛТ').criticalThreshold).toBe('>200 (стоп курс)');
    expect(byMarker(male, 'ПСА')).toBeDefined();
    expect(male.protocol.stopCriteria.join(' ')).toContain('>54%');
    expect(male.protocol.clinicalNotes.join(' ')).not.toContain('♀');
  });
});
