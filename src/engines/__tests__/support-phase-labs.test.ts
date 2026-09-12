/**
 * support-phase-labs.test.ts — карточки анализов K0–K10 + аддоны классов + тайминг.
 * Канон: docs/SUPPORT-PHASE-LABS-PLAN.md (§3–§4, §7).
 */
import { describe, it, expect } from 'vitest';
import {
  PHASE_LAB_CARDS, CLASS_LAB_ADDONS, phaseLabCardById,
  phaseCardsFor, addonsFor, labTimingFor, pctVariantFor, needsLpaBaseline,
  isLongEsterHalfLife, isInjectableCourse, mergeMonitoringLists,
  matrixAddonKeys, matrixAddons,
} from '../support-phase-labs.engine';
import { PED_CLASS_MATRIX } from '../../data/ped-class-matrix';

const ids = (cards: Array<{ id: string }>) => cards.map(c => c.id);

describe('реестр карточек K0–K10', () => {
  it('11 карточек с уникальными id', () => {
    expect(PHASE_LAB_CARDS).toHaveLength(11);
    expect(new Set(ids(PHASE_LAB_CARDS)).size).toBe(11);
  });
  it('все id K0–K10 находятся', () => {
    for (const id of ['K0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9', 'K10']) {
      expect(phaseLabCardById(id)?.id).toBe(id);
    }
    expect(phaseLabCardById('K99')).toBeNull();
  });
  it('K0 содержит ОАК/HCT, липиды+АпоВ+Лп(a), UACR, гормоны, Hcy, PSA', () => {
    const all = JSON.stringify(phaseLabCardById('K0'));
    for (const s of ['HCT', 'АпоВ', 'Лп(a)', 'UACR', 'SHBG', 'Гомоцистеин', 'PSA', 'ИФР-1']) {
      expect(all).toContain(s);
    }
  });
  it('K6 содержит обе ветки эфиров (hCG-bridge + SERM-сразу)', () => {
    const all = JSON.stringify(phaseLabCardById('K6'));
    expect(all).toContain('hCG-bridge');
    expect(all).toContain('SERM сразу');
  });
  it('K9 содержит биотин-washout и 7 дней без тренировок', () => {
    const all = JSON.stringify(phaseLabCardById('K9'));
    expect(all).toContain('Биотин');
    expect(all).toContain('7 дней');
  });
  it('K10 — BBV: HIV + гепатиты + вакцинация', () => {
    const all = JSON.stringify(phaseLabCardById('K10'));
    expect(all).toContain('HIV');
    expect(all).toContain('HBV');
  });
});

describe('phaseCardsFor — выбор по фазе', () => {
  const on = { hasAAS: true };
  it('lock: без флагов — только K0 + K9', () => {
    expect(ids(phaseCardsFor(null, 'course'))).toEqual(['K0', 'K9']);
    expect(ids(phaseCardsFor({}, 'course'))).toEqual(['K0', 'K9']);
    expect(ids(phaseCardsFor(undefined, 'course'))).toEqual(['K0', 'K9']);
  });
  it('course — K1/K2/K3 + K8', () => {
    const got = ids(phaseCardsFor(on, 'course'));
    for (const k of ['K0', 'K1', 'K2', 'K3', 'K8', 'K9']) expect(got).toContain(k);
    expect(got).not.toContain('K6');
    expect(got).not.toContain('K5');
  });
  it('pct — K6 + K8, без недельных course-карточек', () => {
    const got = ids(phaseCardsFor(null, 'pct'));
    expect(got).toContain('K6');
    expect(got).toContain('K8');
    expect(got).not.toContain('K2');
    expect(got).not.toContain('K3');
  });
  it('bridge — K4; fertility — K7+K6; trt — K5', () => {
    expect(ids(phaseCardsFor(on, 'bridge'))).toContain('K4');
    const f = ids(phaseCardsFor(on, 'fertility'));
    expect(f).toContain('K7');
    expect(f).toContain('K6');
    expect(ids(phaseCardsFor(on, 'trt'))).toContain('K5');
  });
  it('injectable добавляет K10, без флага — нет', () => {
    expect(ids(phaseCardsFor(on, 'course', { injectable: true }))).toContain('K10');
    expect(ids(phaseCardsFor(on, 'course'))).not.toContain('K10');
  });
  it('GH-флаги тоже включают course-карточки (не только AAS)', () => {
    expect(ids(phaseCardsFor({ hasGH: true }, 'course'))).toContain('K2');
    expect(ids(phaseCardsFor({ hasInsulin: true }, 'course'))).toContain('K2');
  });
});

describe('pctVariantFor', () => {
  it('длинные эфиры — hCG-bridge; короткие — SERM-сразу; неизвестно — unknown', () => {
    expect(pctVariantFor(true)).toBe('hcg-bridge');
    expect(pctVariantFor(false)).toBe('serm-direct');
    expect(pctVariantFor(undefined)).toBe('unknown');
  });
});

describe('addonsFor — аддоны классов', () => {
  it('пусто — пусто (lock)', () => {
    expect(addonsFor([])).toEqual([]);
    expect(addonsFor([null, undefined])).toEqual([]);
  });
  it('test_enan → testosterone (E2/HCT/PSA)', () => {
    const a = addonsFor(['test_enan']);
    expect(a.some(x => x.key === 'testosterone')).toBe(true);
    expect(JSON.stringify(a)).toContain('HCT');
  });
  it('tren_acet → trenbolone (PRL/почки, префиксный матч)', () => {
    const a = addonsFor(['tren_acet']);
    expect(a.some(x => x.key === 'trenbolone')).toBe(true);
  });
  it('алиас anastro → pct_ai; dbol → oral_17aa (стоп при АЛТ>2×ULN)', () => {
    expect(addonsFor(['anastro']).some(x => x.key === 'pct_ai')).toBe(true);
    const oral = addonsFor(['dbol']);
    expect(oral.some(x => x.key === 'oral_17aa')).toBe(true);
    expect(JSON.stringify(oral)).toContain('2×ULN');
  });
  it('регистр не важен (TEST_ENAN)', () => {
    expect(addonsFor(['TEST_ENAN']).some(x => x.key === 'testosterone')).toBe(true);
  });
  it('sarm/GLP-1/clen/thyroid — свои триггеры', () => {
    expect(addonsFor(['ostarine']).some(x => x.key === 'sarm')).toBe(true);
    expect(JSON.stringify(addonsFor(['ostarine']))).toContain('>100 — стоп');
    expect(addonsFor(['semaglutide']).some(x => x.key === 'glp1')).toBe(true);
    expect(JSON.stringify(addonsFor(['clenbuterol']))).toContain('Mg');
    expect(addonsFor(['t3']).some(x => x.key === 'thyroid')).toBe(true);
  });
  it('стек собирается аддитивно (test + tren + oral)', () => {
    const keys = addonsFor(['test_enan', 'tren_acet', 'dbol']).map(x => x.key);
    expect(keys).toContain('testosterone');
    expect(keys).toContain('trenbolone');
    expect(keys).toContain('oral_17aa');
  });
});

describe('labTimingFor', () => {
  it('Hcy, Лп(a), АпоВ, E2, HCT, спермограмма', () => {
    expect(labTimingFor('Гомоцистеин')).toContain('K3');
    expect(labTimingFor('Лп(a)')).toContain('Один раз');
    expect(labTimingFor('АпоВ')).toContain('K3');
    expect(labTimingFor('Эстрадиол')).toContain('48 ч');
    expect(labTimingFor('HCT')).toContain('K2');
    expect(labTimingFor('Спермограмма')).toContain('K7');
  });
  it('неизвестный маркер и пусто — честно null', () => {
    expect(labTimingFor('Какой-то новый маркер XYZ')).toBeNull();
    expect(labTimingFor('')).toBeNull();
  });
});

describe('needsLpaBaseline', () => {
  it('не сдан — нужен; сдан — не повторять', () => {
    expect(needsLpaBaseline(false)).toBe(true);
    expect(needsLpaBaseline(undefined)).toBe(true);
    expect(needsLpaBaseline(true)).toBe(false);
  });
});

describe('isLongEsterHalfLife / isInjectableCourse', () => {
  it('энантат/дека — длинные; пропионат — короткий', () => {
    expect(isLongEsterHalfLife(336)).toBe(true);
    expect(isLongEsterHalfLife(1200)).toBe(true);
    expect(isLongEsterHalfLife(48)).toBe(false);
    expect(isLongEsterHalfLife(undefined)).toBe(false);
  });
  it('form inject — да; все oral — нет; без form + AAS — да', () => {
    expect(isInjectableCourse([{ form: 'inject', id: 'test_enan' }])).toBe(true);
    expect(isInjectableCourse([{ form: 'oral', id: 'methand' }, { form: 'oral', id: 'stan' }])).toBe(false);
    expect(isInjectableCourse([{ id: 'test_enan' }], { hasAAS: true })).toBe(true);
    expect(isInjectableCourse([], { hasAAS: true })).toBe(false);
    expect(isInjectableCourse(null)).toBe(false);
  });
});

describe('mergeMonitoringLists — дедуп трех источников (§2-дефект №8)', () => {
  it('приоритет первого списка, пустые when/target добиваются', () => {
    const out = mergeMonitoringLists(
      [{ what: 'АЛТ', when: 'Каждые 4 нед', target: '' }],
      [{ what: 'алт', when: 'Каждые 2 нед', target: '<40' }],
      [{ what: 'АЛТ', when: '', target: '<50' }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].when).toBe('Каждые 4 нед');
    expect(out[0].target).toBe('<40');
  });
  it('разные маркеры не сливаются, пустые отбрасываются', () => {
    const out = mergeMonitoringLists(
      [{ what: 'АЛТ', when: 'w4', target: 't' }],
      [{ what: 'АСТ', when: 'w4', target: 't' }, { what: '  ', when: 'x', target: 'y' }],
    );
    expect(out.map(m => m.what)).toEqual(['АЛТ', 'АСТ']);
  });
  it('пустые входы — пустой выход', () => {
    expect(mergeMonitoringLists([], [])).toEqual([]);
  });
});

describe('matrixAddonKeys — мост к фарм-матрице классов (lock против дрейфа)', () => {
  it('каждый класс матрицы имеет ≥1 аддон', () => {
    for (const e of PED_CLASS_MATRIX) {
      expect(matrixAddonKeys(e.id).length).toBeGreaterThan(0);
    }
    expect(matrixAddonKeys('unknown_class_xyz')).toEqual([]);
  });
  it('dht_inject покрывает мастерон/DHB/приму (3 аддона)', () => {
    expect(matrixAddonKeys('dht_inject')).toEqual(['dht', 'boldenone', 'primobolan']);
  });
  it('ключевые маркеры матрицы есть в текстах аддонов', () => {
    const text = (keys: string[]) =>
      JSON.stringify(matrixAddons(keys[0]).flatMap(a => a.items.map(i => `${i.marker} ${i.target || ''} ${i.red || ''}`)));
    expect(text(['testosterone'])).toContain('HCT');
    expect(text(['testosterone'])).toContain('PSA');
    expect(text(['trenbolone'])).toContain('PRL');
    expect(text(['trenbolone'])).toContain('UACR');
    expect(text(['oral17'])).toContain('2×ULN');
    expect(text(['clenbuterol'])).toContain('Mg');
    expect(text(['glp1'])).toContain('HbA1c');
    expect(text(['sarm'])).toContain('>100 — стоп');
  });
});
