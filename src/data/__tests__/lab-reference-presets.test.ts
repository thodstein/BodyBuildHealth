/**
 * Проход 208 — гард пресетов лабораторий.
 *
 * Пресет — это число, которое приложение подставит в вердикт вместо своей нормы.
 * Значит он обязан быть проверяемым: код существует в каталоге, единица совпадает
 * с каталогом (иначе сравнение числа с границей бессмысленно), а рядом записана
 * страница лаборатории, откуда число взято. Без URL строка — выдуманное число,
 * и такой пресет в приложении стоять не должен.
 */
import { describe, it, expect } from 'vitest';
import { UCUM_MAP } from '../../core/constants';
import {
  LAB_SOURCES,
  LAB_REFERENCE_PRESETS,
  blankRange,
  labPreset,
  labsWithPresets,
  presetForEntry,
  refSourceLabel,
  type LabId,
} from '../lab-reference-presets';

/** Дом, на котором живёт число каждой лаборатории. */
const LAB_HOST: Record<LabId, RegExp> = {
  helix: /^https:\/\/helix\.ru\/kb\/item\/\d{2}-\d{3}$/,
  invitro: /^https:\/\/www\.invitro\.ru\//,
  gemotest: /^https:\/\/gemotest\.ru\//,
  kdl: /^https:\/\/www\.kdlmed\.ru\//,
  cmd: /^https:\/\/www\.cmd-online\.ru\//,
};

describe('проход 208: пресеты референсов лабораторий', () => {
  it('каждая лаборатория из списка имеет таблицу пресетов', () => {
    for (const s of LAB_SOURCES) {
      expect(LAB_REFERENCE_PRESETS[s.id], `нет таблицы для ${s.id}`).toBeTruthy();
    }
  });

  it('код каждого пресета есть в каталоге, единица совпадает с каталогом', () => {
    for (const [lab, rows] of Object.entries(LAB_REFERENCE_PRESETS) as [LabId, Record<string, any>][]) {
      for (const [code, row] of Object.entries(rows)) {
        const cat = UCUM_MAP[code];
        expect(cat, `${lab}/${code}: кода нет в UCUM_MAP`).toBeTruthy();
        expect(row.unit, `${lab}/${code}: единица пресета ≠ единица каталога`).toBe(cat.prefUnit);
      }
    }
  });

  it('границы пресета — числа, нижняя меньше верхней', () => {
    for (const rows of Object.values(LAB_REFERENCE_PRESETS)) {
      for (const [code, row] of Object.entries(rows as Record<string, any>)) {
        expect(Number.isFinite(row.lln), code).toBe(true);
        expect(Number.isFinite(row.uln), code).toBe(true);
        expect(row.lln, code).toBeGreaterThanOrEqual(0);
        expect(row.uln, `${code}: нижняя ≥ верхней`).toBeGreaterThan(row.lln);
      }
    }
  });

  it('у каждого пресета есть цитата и страница той же лаборатории', () => {
    for (const [lab, rows] of Object.entries(LAB_REFERENCE_PRESETS) as [LabId, Record<string, any>][]) {
      for (const [code, row] of Object.entries(rows)) {
        expect(String(row.source || ''), `${lab}/${code}: нет цитаты`).toMatch(/[«»]/);
        expect(String(row.sourceUrl || ''), `${lab}/${code}: URL чужой лаборатории`).toMatch(LAB_HOST[lab]);
      }
    }
  });

  it('список лабораторий с пресетами непуст и совпадает с таблицей', () => {
    const withRows = labsWithPresets();
    expect(withRows.length).toBeGreaterThan(0);
    for (const id of withRows) {
      expect(Object.keys(LAB_REFERENCE_PRESETS[id]).length).toBeGreaterThan(0);
    }
  });

  it('пресет находится по написанию бланка, а не только по канону каталога', () => {
    // Человек печатает «K» и «PTH» — бланк не подписывает «POTASSIUM» и «PARATHYROID».
    expect(labPreset('helix', 'K')?.lln).toBe(3.5);
    expect(labPreset('helix', 'potassium')?.lln).toBe(3.5);
    expect(labPreset('helix', 'TIBC')?.uln).toBe(77.1);
    expect(labPreset('helix', 'PTH')?.uln).toBe(88);
    expect(labPreset('helix', 'PARATHYROID')?.uln).toBe(88);
    expect(labPreset('helix', 'АЛТ')).toBeNull();
    expect(labPreset('cmd', 'HOMOCYSTEINE')).toBeNull();
    expect(labPreset(null, 'POTASSIUM')).toBeNull();
  });

  it('Гемотест: калий 3,5–5,1 ммоль/л найден по коду бланка «K»', () => {
    const row = labPreset('gemotest', 'K');
    expect(row).toMatchObject({ lln: 3.5, uln: 5.1, unit: 'mmol/L' });
    // Канонический код UCUM_MAP — POTASSIUM; бланк печатает K.
    expect(labPreset('gemotest', 'POTASSIUM')).toMatchObject({ lln: 3.5, uln: 5.1, unit: 'mmol/L' });
    expect(row?.sourceUrl).toMatch(/^https:\/\/gemotest\.ru\//);
    expect(refSourceLabel('gemotest', 'K')).toContain('Гемотест');
  });

  it('ПТГ: норма приложения и пресет различаются, но код один', () => {
    // Один анализ — один код (`PARATHYROID`); «PTH» — написание поля и бланка.
    expect(UCUM_MAP.PARATHYROID).toBeTruthy();
    expect(UCUM_MAP.PTH).toBeUndefined();
    expect(UCUM_MAP.PARATHYROID.lln).toBe(15);
    expect(UCUM_MAP.PARATHYROID.uln).toBe(65);
    const preset = labPreset('helix', 'PTH');
    expect(preset).toMatchObject({ lln: 12, uln: 88, unit: 'pg/mL' });
  });

  it('нет пресета — названная причина, а не подмена нормой приложения', () => {
    const none = presetForEntry('HOMOCYSTEINE', 'cmd', 'umol/L');
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.reason).toContain('CMD');
    const unknown = presetForEntry('POTASSIUM', 'helix', 'mmol/L');
    expect(unknown.ok).toBe(true);
  });

  it('единица бланка не совпала с единицей пресета — отказ, а не молчаливый пересчёт', () => {
    const r = presetForEntry('POTASSIUM', 'helix', 'mg/dL');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('не совпадает');
    // Пустая единица подставляется из пресета.
    const empty = presetForEntry('POTASSIUM', 'helix', '');
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.unit).toBe('mmol/L');
  });

  it('границы бланка — только пара чисел, по порядку', () => {
    expect(blankRange('', '')).toEqual({ ok: false, reason: 'введите обе границы из бланка' });
    expect(blankRange('3.5', '')).toEqual({ ok: false, reason: 'нужны обе границы: нижняя и верхняя' });
    expect(blankRange('5.1', '3.5').ok).toBe(false);
    expect(blankRange('3,5', '5,1')).toEqual({ ok: true, refLow: 3.5, refHigh: 5.1 });
    expect(blankRange('abc', '5')).toEqual({ ok: false, reason: 'нужны обе границы: нижняя и верхняя' });
  });

  it('подпись источника не выдаёт пресет за норму приложения', () => {
    expect(refSourceLabel('app', 'POTASSIUM')).toBe('норма приложения');
    expect(refSourceLabel('blank', 'POTASSIUM')).toBe('границы из бланка');
    expect(refSourceLabel('helix', 'POTASSIUM')).toContain('Хеликс 06-064');
    expect(refSourceLabel('kdl', 'POTASSIUM')).toContain('КДЛ');
    expect(refSourceLabel('cmd', 'HOMOCYSTEINE')).toContain('пресета нет');
  });
});

/**
 * Проход 209 (по ревью): код обязан находиться в ЛЮБОМ написании.
 *
 * Ключи таблиц — каноны каталога, но часть из них смешанного регистра
 * (`HbA1c`). Поиск делал `code.toUpperCase()` и сравнивал с ключом напрямую,
 * поэтому пресет КДЛ `HbA1c` физически не применялся: интерфейс отвечал
 * «пресета нет — введите границы из бланка», хотя строка 4.8–5.9 % лежала в
 * таблице. Тот же класс промаха, который проход 174 закрыл для каталога
 * (`ucumKey`), поэтому теперь поиск идёт тем же правилом.
 */
describe('labPreset: код находится в нативном, верхнем и нижнем написании', () => {
  it('каждый ключ каждой таблицы резолвится во всех трёх написаниях', () => {
    for (const lab of Object.keys(LAB_REFERENCE_PRESETS) as LabId[]) {
      for (const key of Object.keys(LAB_REFERENCE_PRESETS[lab])) {
        const row = LAB_REFERENCE_PRESETS[lab][key];
        for (const spelling of [key, key.toUpperCase(), key.toLowerCase()]) {
          expect(labPreset(lab, spelling), `${lab}/${key} в написании «${spelling}»`).toBe(row);
        }
      }
    }
  });

  it('HbA1c КДЛ достижим и применим — это и был молчаливый промах', () => {
    const row = LAB_REFERENCE_PRESETS.kdl.HbA1c;
    expect(row, 'строка кода HbA1c в таблице КДЛ').toBeTruthy();
    expect(labPreset('kdl', 'HbA1c')).toBe(row);
    expect(labPreset('kdl', 'HbA1c'.toUpperCase())).toBe(row);
    expect(labPreset('kdl', 'hba1c')).toBe(row);
    expect(presetForEntry('HbA1c', 'kdl', '%')).toEqual({
      ok: true,
      lln: 4.8,
      uln: 5.9,
      unit: '%',
      source: row.source,
    });
  });
});
