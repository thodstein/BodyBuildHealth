/**
 * lab-coverage-honest.test.ts — проход 140: карта «поле заполнено, но расчёт его
 * не читает» не врёт.
 *
 * Проверка не читает таблицу и не верит комментариям: для каждого поля
 * `FULL_PANELS` (проход 196: 89, с ретикулоцитами; проход 203: 91, со СКФ и
 * цистатином C; проход 205: 92, с ЩФ) она заполняет **только это поле** и
 * смотрит, меняется ли хоть один контур:
 *  - риск-модель (`calculateTzSpecRisk` — органы/механизмы/итог; доля
 *    «проверено анализами» исключена: она растёт от одного факта заполнения);
 *  - мост механизмов (`getActivatedTzMechs`);
 *  - ступени и советы (`computeTierAdjustments`);
 *  - шкала ступеней (`getLabEntry`) и справочная граница (`labSeverityCut`);
 *  - авто-вывод анкеты (`deriveStateFromLabs`).
 *
 * Если ни один контур не шевельнулся — поле обязано быть в `LAB_FIELD_UNUSED_REASON`
 * (и наоборот). Так таблица не может «протухнуть»: как только поле начинают
 * читать, гард падает и требует убрать пометку «не входит в расчёт».
 */
import { describe, it, expect } from 'vitest';
import { labSliceToValues } from '../../../../engines/support-plan/mapper-ctx';
import { buildTzInput } from '../../../../engines/support-plan/engine-helpers';
import { getActivatedTzMechs } from '../../../../engines/tz-bridge-marker';
import { computeTierAdjustments } from '../../../../data/lab-tier-recommendations';
import { getLabEntry } from '../../../../data/lab-tier-ranges';
import { labSeverityCut } from '../../../../engines/tz-mapper-engine';
import { calculateTzSpecRisk } from '../../../../engines/risk-engine-tz-spec';
import { labMarkerCanon } from '../../../../engines/support-plan/lab-marker-name';
import { deriveStateFromLabs } from '../Calc.labs-derived';
import { FULL_PANELS, labBoundNotes } from '../Calc.lab';
import { DEFAULT_STATE } from '../Calc.types';
import { LAB_FIELD_UNUSED_REASON, unusedLabFields, labUnreadNotes } from '../Calc.lab-coverage';

const stateWith = (slice: any) => ({
  ...DEFAULT_STATE,
  profile: { ...DEFAULT_STATE.profile, sex: 'male' as const, age: 30 },
  pharma: { ...DEFAULT_STATE.pharma, aas: [{ id: 'test_e', doseMgWeek: 500, weeks: 12 }] as any },
  labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: slice },
} as any);

/** Подпись риск-результата без «доли проверенных анализами». */
function riskSignature(r: any): string {
  const { overallVerification, explanation, ...rest } = r;
  return JSON.stringify(rest);
}

/** Меняется ли хоть один контур, если заполнить только это поле. */
function fieldIsRead(panel: string, marker: string): boolean {
  const slice = { date: '', [panel]: { [marker]: '5' } };
  const canon = labMarkerCanon(marker, panel);

  const tz = buildTzInput(stateWith(slice), []);
  const baseTz = buildTzInput(stateWith({ date: '' }), []);
  if (!tz || !baseTz) throw new Error('buildTzInput вернул null — курс-заглушка не собрался');
  if (riskSignature(calculateTzSpecRisk(tz)) !== riskSignature(calculateTzSpecRisk(baseTz))) return true;

  const planLabs = labSliceToValues(slice as any, 'male');
  if (getActivatedTzMechs(planLabs as any).length > 0) return true;

  const adj = computeTierAdjustments(planLabs, 'male');
  if (adj.alerts.length + adj.addSubs.length + adj.nutrition.length + adj.tierSummary.length > 0) return true;

  // Шкала и справочная граница — «поле известно модели» даже если при значении 5
  // ступень нулевая (например, Lp(a) 5 мг/дл — норма, но шкала есть).
  if (getLabEntry(canon)) return true;
  if (labSeverityCut(canon) !== null) return true;

  if (deriveStateFromLabs(slice as any, 'male').derivedFields.length > 0) return true;

  return false;
}

describe('проход 140: карта «не входит в расчёт» совпадает с измерением', () => {
  const fields = FULL_PANELS.flatMap(p => p.markers.map(m => ({ panel: p.key as string, marker: m })));

  it('форма теперь 92 поля — иначе список надо пересматривать', () => {
    // 140: 88 полей. 196: + ретикулоциты (проценты/промилле бланка) — поле
    // читается ступенями `TIER_RULES.RETICULOCYTES`, поэтому в таблице
    // «не входит в расчёт» его быть не должно.
    // 203: + СКФ (`eGFR`) и цистатин C — читаются риск-моделью/планом
    // поддержки и лестницей ступеней почки.
    // 205: + ЩФ (`ALP`) — ветка «Холестаза» читала `l.ALP`, которого форма не
    // давала: шкала и совет были, ввести было некуда.
    expect(fields).toHaveLength(92);
  });

  it('каждое поле либо читается, либо названо в таблице', () => {
    const measuredUnused: string[] = [];
    for (const f of fields) {
      if (!fieldIsRead(f.panel, f.marker)) measuredUnused.push(`${f.panel}|${f.marker}`);
    }
    const tableKeys = Object.keys(LAB_FIELD_UNUSED_REASON).sort();
    expect(measuredUnused.sort()).toEqual(tableKeys);
  });

  it('в таблице нет полей, которых нет в форме, и у каждой строки есть причина', () => {
    const formKeys = new Set(fields.map(f => `${f.panel}|${f.marker}`));
    for (const [key, reason] of Object.entries(LAB_FIELD_UNUSED_REASON)) {
      expect(formKeys.has(key), `нет такого поля формы: ${key}`).toBe(true);
      expect(reason.trim().length, `пустая причина у ${key}`).toBeGreaterThan(3);
    }
  });

  it('баннер считает только заполненные поля и не называет прочитанные', () => {
    const filled = {
      date: '2026-10-01',
      panelHematology: { Neutrophils: '4.2', HCT: '46' },
      panelTumor: { CEA: '1.1' },
      panelUrinalysis: { Nitrite: 'отр.' },
    } as any;
    const rows = unusedLabFields(filled);
    expect(rows.map(r => r.key).sort()).toEqual([
      'panelHematology|Neutrophils',
      'panelTumor|CEA',
      'panelUrinalysis|Nitrite',
    ]);
    // Прочитанное поле не попадает в список, даже если заполнено.
    expect(rows.some(r => r.marker === 'HCT')).toBe(false);
  });

  it('пустой бланк — пустой список (не «всё не читается»)', () => {
    expect(unusedLabFields(null)).toHaveLength(0);
    expect(unusedLabFields({ date: '' } as any)).toHaveLength(0);
  });
});

describe('проход 141: запись без числа называет себя', () => {
  it('текст в числовом поле — пометка с причиной', () => {
    const rows = labUnreadNotes({ date: '', panelBiochem: { ALT: 'повышен' } } as any);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('panelBiochem|ALT');
    expect(rows[0].text).toBe('повышен');
    expect(rows[0].hint).toMatch(/не число/);
  });

  it('полоска белка мочи — не концентрация, а «1+»', () => {
    const rows = labUnreadNotes({ date: '', panelUrinalysis: { Protein: '1+' } } as any);
    expect(rows.map(r => r.key)).toEqual(['panelUrinalysis|Protein']);
    expect(rows[0].hint).toMatch(/полоска/);
  });

  it('«отр.» в моче не задваивается: причина уже в списке прохода 140', () => {
    const slice = { date: '', panelUrinalysis: { Nitrite: 'отр.' } } as any;
    expect(unusedLabFields(slice).map(r => r.marker)).toEqual(['Nitrite']);
    expect(labUnreadNotes(slice)).toHaveLength(0);
  });

  it('граница и число — не «запись без числа», и баннер печатает число движка', () => {
    const slice = { date: '', panelIron: { Ferritin: '>1 000' }, panelBiochem: { ALT: '45' } } as any;
    expect(labUnreadNotes(slice)).toHaveLength(0);
    // Проход 141: «>1 000» — это 1000 и для движка, и для баннера (раньше баннер печатал 1).
    expect(labBoundNotes(slice)[0].text).toMatch(/→ 1000$/);
  });

  it('пустое поле — без пометок', () => {
    expect(labUnreadNotes(null)).toHaveLength(0);
    expect(labUnreadNotes({ date: '', panelBiochem: { ALT: '' } } as any)).toHaveLength(0);
  });
});
