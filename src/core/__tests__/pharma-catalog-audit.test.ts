/** pharma-catalog-audit.test.ts — аудит каталога фармакологии:
 *  категории (class) всех 40 препаратов в соответствии с новой классификацией,
 *  реалистичность фармакологических параметров (pd), полнота описаний. */
import { describe, it, expect } from 'vitest';
import { PHARMA_DB, getPharmaDetail, PHARMA_CLASSES } from '../../core/pharma-database';
import { CLASS_DEFAULTS } from '../../core/pharma-db/class-defaults';
import { resolvePedAlias } from '../../data/ped-alias-map';

describe('категории препаратов (class) — соответствие новой классификации', () => {
  const expected: Record<string, string> = {
    test_prop: 'testosterone', test_enan: 'testosterone', test_cyp: 'testosterone', test_undec: 'testosterone',
    test_susp: 'testosterone', sustanon: 'testosterone',
    tren_acet: 'trenbolone', tren_enan: 'trenbolone', tren_hex: 'trenbolone',
    npp: 'nandrolone', deca: 'nandrolone', trest_acet: 'nandrolone', trest_enan: 'nandrolone',
    dhb: 'dht_inject', dhb_acetate: 'dht_inject', dhb_propionate: 'dht_inject', dhb_cyp: 'dht_inject',
    bold_undec: 'boldenone',
    prim_enan: 'primobolan', methenolone_acetate: 'primobolan',
    drostanolone_prop: 'drostanolone', drostanolone_enan: 'drostanolone',
    mesterolone: 'dht_derivative',
    methand: 'oral_17aa', oxan: 'oral_17aa', stan: 'oral_17aa', trena: 'oral_17aa', halo: 'oral_17aa', superdrol: 'oral_17aa', anadrol: 'oral_17aa',
    ostarine: 'sarm', lgd: 'sarm', rad140: 'sarm', s23: 'sarm',
    cjc1295: 'peptide_ghrh', ghrp6: 'peptide_ghrp', ipamorelin: 'peptide_ghrp', mk677: 'peptide_ghrh',
    igf1_lr3: 'igf1', igf1_des: 'igf1', mgf: 'mgf',
    ins_short: 'insulin', ins_long: 'insulin', ins_aspart: 'insulin', ins_detemir: 'insulin',
    semaglutide: 'glp1', tirzepatide: 'glp1', hgh: 'gh', clenbuterol: 'clenbuterol', t3: 'thyroid', t4: 'thyroid',
  };
  for (const [id, cls] of Object.entries(expected)) {
    it(`${id} → ${cls}`, () => {
      expect(PHARMA_DB[id]?.class).toBe(cls);
    });
  }

  it('все классы препаратов есть в PHARMA_CLASSES (каталог показывает все категории)', () => {
    const classes = new Set(Object.values(PHARMA_DB).map(s => s.class));
    for (const c of classes) expect(PHARMA_CLASSES).toContain(c);
  });

  it('все препараты PED_LIST/фармакологии присутствуют в каталоге (включая DHB, GH, клен, T3/T4, GLP-1, сустанон)', () => {
    const pedIds = ['test_susp','sustanon','methenolone_acetate','semaglutide','tirzepatide','somatropin','clenbuterol','t3','t4','dhb','dhb_acetate','dhb_propionate','dhb_cyp','tren_hex','superdrol','mesterolone','ostarine','lgd','rad140','s23','mk677','cjc1295','ghrp6','ipamorelin','igf1_des'];
    for (const id of pedIds) {
      const canon = resolvePedAlias(id);
      expect(PHARMA_DB[canon] || PHARMA_DB[id], `каталог: ${id} (→ ${canon})`).toBeTruthy();
    }
    // DHB в каталоге виден под своим именем
    expect(PHARMA_DB.dhb?.name).toContain('Дигидроболденон');
  });
});

describe('реалистичность фармакологических параметров (pd)', () => {
  it('DHB: слабее тестостерона по AR, не ароматизирует, не прогестин, не 17α', () => {
    for (const id of ['dhb', 'dhb_acetate', 'dhb_propionate', 'dhb_cyp']) {
      const pd = PHARMA_DB[id]!.pd!;
      expect(pd.AR_affinity).toBeLessThan(1);       // 1-тестостерон слабее тестостерона
      expect(pd.aromatization).toBe(0);
      expect(pd.progestogenic).toBe(0);
      expect(pd.hepatotoxicity).toBeLessThan(0.2);  // не 17α-алкил
    }
  });

  it('тренболон: AR в 3 раза выше тестостерона (соответствует описанию «3-5 раз»)', () => {
    expect(PHARMA_DB.tren_acet!.pd!.AR_affinity).toBe(3.0);
  });

  it('17α-оралы без 5α-редукции (уже 5α-восстановлены): oxan/stan/superdrol', () => {
    expect(PHARMA_DB.oxan!.pd!.five_alpha_reduction).toBe(0);
    expect(PHARMA_DB.stan!.pd!.five_alpha_reduction).toBe(0);
    expect(PHARMA_DB.superdrol!.pd!.five_alpha_reduction).toBe(0);
  });

  it('анадрол: не ароматизирует, прогестин', () => {
    expect(PHARMA_DB.anadrol!.pd!.aromatization).toBeLessThanOrEqual(0.05);
    expect(PHARMA_DB.anadrol!.pd!.progestogenic).toBeGreaterThanOrEqual(0.2);
  });

  it('мастерон/примоболан/местеролон — мягкие: низкие hct/гепато', () => {
    expect(PHARMA_DB.drostanolone_prop!.pd!.hepatotoxicity).toBe(0);
    expect(PHARMA_DB.prim_enan!.pd!.hepatotoxicity).toBe(0);
    expect(PHARMA_DB.mesterolone!.pd!.aromatization).toBe(0);
  });
});

describe('полнота описаний (CLASS_DEFAULTS + getPharmaDetail)', () => {
  it('класс dht_inject имеет полное описание (DHB не остаётся без текста)', () => {
    const d = CLASS_DEFAULTS.dht_inject;
    expect(d).toBeTruthy();
    expect(d.description!.length).toBeGreaterThan(150);
    expect(d.sideEffects!.length).toBeGreaterThanOrEqual(3);
    expect(d.dosageRange).toBeTruthy();
  });

  it('getPharmaDetail для DHB и эфиров возвращает описание класса', () => {
    for (const id of ['dhb', 'dhb_acetate', 'dhb_propionate', 'dhb_cyp']) {
      const detail = getPharmaDetail(id);
      expect(detail).toBeTruthy();
      expect((detail!.description || '').length).toBeGreaterThan(100);
      expect(detail!.sideEffects!.length).toBeGreaterThan(0);
      expect(detail!.contraindications!.length).toBeGreaterThan(0);
    }
  });

  it('каждый препарат имеет эффекты, риски, targetSystems и targetMechanisms', () => {
    for (const [id, s] of Object.entries(PHARMA_DB)) {
      expect((s.effects || []).length, `${id}: effects`).toBeGreaterThan(0);
      expect((s.risks || []).length, `${id}: risks`).toBeGreaterThan(0);
      expect((s.targetSystems || []).length, `${id}: targetSystems`).toBeGreaterThan(0);
      expect((s.targetMechanisms || []).length, `${id}: targetMechanisms`).toBeGreaterThan(0);
    }
  });

  it('DHB-эфиры имеют полные описания (эффекты ≥3, риски ≥3)', () => {
    for (const id of ['dhb_acetate', 'dhb_propionate']) {
      expect((PHARMA_DB[id]!.effects || []).length).toBeGreaterThanOrEqual(3);
      expect((PHARMA_DB[id]!.risks || []).length).toBeGreaterThanOrEqual(3);
    }
  });
});
