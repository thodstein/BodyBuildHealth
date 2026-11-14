/**
 * protocol-export-labs.test.ts — печать берёт карточки фаз K0–K10 (единый перечень),
 * а не график фазы: в PDF анализа не должно быть дважды (аудит «Мониторинг =
 * врачебный протокол = K0–K10», проходы 54–56).
 */
import { describe, it, expect } from 'vitest';
import { buildExportDataFromRec } from '../ProtocolExport';

const patient = { name: 'T', age: 30, weight: 90, height: 180, sex: 'm' };
const course = { drugs: ['test_enan'], peds: ['test_enan'], weeks: 12, phase: 'course' };

function recWith(schedule: any[], phase = 'course'): any {
  return {
    subs: [],
    pedFlags: { hasAAS: true },
    phase,
    monitoringSchedule: schedule,
    monitoringPlan: 'line1\nline2',
    protocolWarnings: [],
  };
}

const markerText = (data: any) => data.labSchedule.map((l: any) => l.marker).join(' | ');

describe('buildExportDataFromRec — labSchedule = карточки фаз (один перечень)', () => {
  it('печать берёт K0–K10 и не дублирует график фазы', () => {
    const data = buildExportDataFromRec(recWith([
      { id: 'baseline', label: 'До курса (исходно)', period: '0 нед', items: [{ marker: 'ОАК с СОЭ', reason: 'r', target: 'HCT<50%' }] },
    ]), patient, course);
    const all = JSON.stringify(data.labSchedule);
    expect(all).toContain('K0 · ');          // карточка фазы
    expect(all).toContain('Гомоцистеин');    // персональный пункт карточки
    expect(all).toContain('Биотин-стоп');    // K9 (преаналитика)
    expect(all).not.toContain('[До курса');  // второй перечень из графика не печатается
  });

  it('состав карточек зависит от фазы: PCT → K6, курс → K1', () => {
    const pct = buildExportDataFromRec(recWith([], 'pct'), patient, course);
    expect(markerText(pct)).toContain('K6 · ');
    expect(markerText(pct)).not.toContain('K1 · ');
    const on = buildExportDataFromRec(recWith([], 'course'), patient, course);
    expect(markerText(on)).toContain('K1 · ');
  });

  it('аддоны класса печатаются строкой 💊 (не теряются при отказе от графика)', () => {
    const data = buildExportDataFromRec(recWith([]), patient, course);
    expect(markerText(data)).toContain('💊 ');
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
  it('♀: E2 «по фазе цикла» из FEMALE_HORMONE_BANDS, женские пометки карточек в примечаниях, стоп HCT 52 / АЛТ 78', () => {
    const fem = buildExportDataFromRec(recWith([]), { ...patient, sex: 'female' }, course);
    const all = JSON.stringify(fem.labSchedule);
    expect(all).toContain('по фазе цикла');
    expect(all).toContain('40–200 (фолл.)');   // фазовая модель из женского протокола
    expect(all).not.toContain('20–40 пг/мл');  // мужской цели в женской печати нет
    expect(fem.protocol.clinicalNotes.join(' ')).toContain('♀');
    expect(fem.protocol.stopCriteria.join(' ')).toContain('>52%');
    expect(fem.protocol.stopCriteria.join(' ')).toContain('>78');
  });

  it('♂ (и legacy sex=m): мужская цель E2 из карточек, без ♀-пометок, стоп HCT 54 / АЛТ 200', () => {
    const male = buildExportDataFromRec(recWith([]), patient, course);
    const all = JSON.stringify(male.labSchedule);
    expect(all).toContain('20–40 пг/мл');
    expect(all).not.toContain('по фазе цикла');
    expect(male.protocol.stopCriteria.join(' ')).toContain('>54%');
    expect(male.protocol.stopCriteria.join(' ')).toContain('>200');
    expect(male.protocol.clinicalNotes.join(' ')).not.toContain('♀');
  });

  it('карточки печатают оба пола в целях (мужской порог не выдаётся за общий)', () => {
    const male = buildExportDataFromRec(recWith([]), patient, course);
    const all = JSON.stringify(male.labSchedule);
    expect(all).toContain('♀ <48%');
    expect(all).toContain('♀ <31');
  });
});
