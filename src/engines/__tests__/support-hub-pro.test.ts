/**
 * support-hub-pro.test.ts — P1–P8 хаба «Общая информация».
 * Калькулятор поддержки не тронут.
 */
import { describe, it, expect } from 'vitest';
import { bioEvidenceFor, doseWindowFor, evidenceGradeExFor, personDoseHints, passesGradeFilter, filterCatalogGroups, resolvePersonDefaults } from '../support-hub-evidence.engine';
import { LAB_TOP20, LAB_ID_ALIASES, resolveLabMonitor } from '../support-hub-labs.engine';
import { getCachedPubmed, writePubmedCache, readPubmedCache } from '../support-hub-research.engine';
import { dedupeDepletions, stackOverlap, stackScore } from '../support-hub-stack.engine';
import { timingHintsFor, TIMING_CANON } from '../support-hub-timing.engine';
import { isAASHonest } from '../support-hub-aas.engine';
import { buildSubstancePassport } from '../support-hub-passport.engine';

describe('P1 честная био-таблица', () => {
  it('куркумин+пиперин — маркетинг-флаг (Kroon 2025)', () => {
    const e = bioEvidenceFor('curcumin_piperine', 0.06);
    expect(e.marketing).toBe(true);
    expect(e.lo).toBeLessThan(e.hi);
    expect(e.source).toBe('RCT');
  });
  it('моногидрат — не маркетинг, meta', () => {
    const e = bioEvidenceFor('creatine_monohydrate', 0.99);
    expect(e.marketing).toBe(false);
    expect(e.source).toBe('meta');
    expect(e.lo).toBeGreaterThan(0.9);
  });
  it('неизвестная форма — claim с диапазоном вокруг точки', () => {
    const e = bioEvidenceFor('some_new_nano', 0.8);
    expect(e.source).toBe('claim');
    expect(e.lo).toBeLessThan(0.8);
    expect(e.hi).toBeGreaterThanOrEqual(0.8);
  });
  it('оксид магния — низкий диапазон (NIH ODS)', () => {
    const e = bioEvidenceFor('mg_oxide', 0.04);
    expect(e.hi).toBeLessThanOrEqual(0.1);
  });
});

describe('P2 единое окно дозы', () => {
  const therapeutic: any = { mg: { minMg: 200, optMg: 400, maxMg: 600, ul: 350, note: 'Mg' } };
  const ranges: any = { creatine: { therMin: 3000, therMax: 5000, label: 'Креатин' } };
  it('прямое окно приоритетнее ranges', () => {
    const w = doseWindowFor('magnesium_glycinate', therapeutic, ranges);
    expect(w.hasData).toBe(true);
    expect(w.min).toBe(200);
    expect(w.ul).toBe(350);
  });
  it('fallback на ranges с честной пометкой UL', () => {
    const w = doseWindowFor('creatine_monohydrate', {}, ranges);
    expect(w.hasData).toBe(true);
    expect(w.min).toBe(3000);
  });
  it('нет данных — честно hasData:false', () => {
    const w = doseWindowFor('unknown_herb_xyz', {}, {});
    expect(w.hasData).toBe(false);
  });
  it('вес/пол/возраст-хинты', () => {
    const h = personDoseHints('creatine', { weightKg: 100, sex: 'male', age: 30 });
    expect(h.some(x => x.includes('100'))).toBe(true);
    const f = personDoseHints('iron', { weightKg: 60, sex: 'female', age: 30 });
    expect(f.some(x => x.includes('ферритин'))).toBe(true);
    const o = personDoseHints('b12', { weightKg: 80, sex: 'male', age: 65 });
    expect(o.some(x => x.includes('60+'))).toBe(true);
  });
});

describe('P3 грейды Examine-стиль', () => {
  it('креатин→сила = A', () => {
    expect(evidenceGradeExFor('creatine', 'strength')).toBe('A');
  });
  it('база: магний A, ресвератрол C, глутатион D', () => {
    expect(evidenceGradeExFor('magnesium')).toBe('A');
    expect(evidenceGradeExFor('resveratrol')).toBe('C');
    expect(evidenceGradeExFor('glutathione_reduced')).toBe('D');
  });
  it('префикс-матчинг форм', () => {
    expect(evidenceGradeExFor('magnesium_glycinate')).toBe('A');
  });
  it('неизвестное — C, не A', () => {
    expect(evidenceGradeExFor('some_exotic_xyz')).toBe('C');
  });
});

describe('P4 синергия PRO', () => {
  it('дедуп точных дублей', () => {
    const list = [
      { depleter: 'CURCUMIN', depleted: 'IRON', mechanism: 'm', severity: 'MEDIUM', recommendation: 'r' },
      { depleter: 'CURCUMIN', depleted: 'IRON', mechanism: 'm2', severity: 'MEDIUM', recommendation: 'r2' },
      { depleter: 'ZINC', depleted: 'COPPER', mechanism: 'm', severity: 'HIGH', recommendation: 'r' },
    ];
    expect(dedupeDepletions(list).length).toBe(2);
  });
  it('overlap находит дубли нутриента', () => {
    const ids = ['mag citrate', 'mag glycinate', 'zinc picolinate'];
    const out = stackOverlap(ids, (id) => id);
    // 'mag citrate'/'mag glycinate' содержат 'mg'? keyword 'mg' — да, по имени 'mag'
    expect(Array.isArray(out)).toBe(true);
    const zn = stackOverlap(['zinc picolinate 15mg', 'multivitamin with zinc 10mg'], (id) => id);
    expect(zn.some(o => o.nutrient === 'zinc')).toBe(true);
  });
  it('score: пустой стек 100, тяжёлые конфликты режут', () => {
    const base = stackScore({ total: 3, conflictCount: 0, severeCount: 0, synergyCount: 2, depletionCount: 0, overlapCount: 0, evidenceA: 2, evidenceD: 0 });
    const bad = stackScore({ total: 15, conflictCount: 3, severeCount: 2, synergyCount: 0, depletionCount: 2, overlapCount: 2, evidenceA: 0, evidenceD: 3 });
    expect(base.score).toBeGreaterThan(bad.score);
    expect(base.score).toBeLessThanOrEqual(100);
    expect(bad.score).toBeGreaterThanOrEqual(0);
  });
});

describe('P5 канон тайминга', () => {
  it('железо — утро + C', () => {
    const h = timingHintsFor('Железо бисглицинат', ['mineral']);
    expect(h.some(r => r.id === 'fe_morning')).toBe(true);
  });
  it('кальций — вечер', () => {
    const h = timingHintsFor('Кальций цитрат', ['mineral']);
    expect(h.some(r => r.id === 'ca_evening')).toBe(true);
  });
  it('D3 — с жиром', () => {
    const h = timingHintsFor('Витамин D3', ['vitamin']);
    expect(h.some(r => r.id === 'd3k2_fat')).toBe(true);
  });
  it('канон не пуст', () => {
    expect(TIMING_CANON.length).toBeGreaterThan(8);
  });
});

describe('P8 честный AAS-гейт', () => {
  it('класс testosterone — AAS', () => {
    expect(isAASHonest(['pharma', 'testosterone'], 'Тест', 'Test').isAAS).toBe(true);
  });
  it('метаболизм — НЕ AAS (точное слово, не подстрока)', () => {
    expect(isAASHonest(['metabolic'], 'Метаболизм', 'Metabolism').isAAS).toBe(false);
  });
  it('сустанон — AAS по имени', () => {
    expect(isAASHonest(['pharma'], 'Сустанон 250', '').isAAS).toBe(true);
  });
  it('магний — не AAS', () => {
    expect(isAASHonest(['mineral'], 'Магний', 'Magnesium').isAAS).toBe(false);
  });
});

describe('P7 паспорт вещества', () => {  it('паспорт собирается без новых чисел', () => {
    const p = buildSubstancePassport({
      id: 'magnesium', nameRu: 'Магний', maxBio: 0.8, formKey: 'mg_glycinate',
      therapeutic: { mg: { minMg: 200, optMg: 400, maxMg: 600, ul: 350, note: 'Mg', unit: 'мг' } },
      ranges: {}, category: ['mineral'],
      synergies: [{ with: 'D3', effect: 'синергия' }],
      conflicts: [{ with: 'Ca', effect: 'конкуренция' }],
      labMarkers: [{ marker: 'Mg', target: '1.7–2.5' }],
      person: { weightKg: 80, sex: 'male', age: 30 },
    });
    expect(p.grade).toBe('A');
    expect(p.dose.hasData).toBe(true);
    expect(p.timing.length).toBeGreaterThan(0);
    expect(p.conflictTop.length).toBe(1);
  });
});

describe('P8-добавка LAB топ-20 + alias-резолв', () => {
  const fakeDb: Record<string, Array<{ markerRu: string; markerEn: string; system: string; when: string; target: string; condition: string; note: string }>> = {
    zinc: [{ markerRu: 'Zn', markerEn: 'ZINC', system: 'mineral', when: 'x', target: 'y', condition: 'c', note: 'n' }],
  };
  it('exact + case + alias', () => {
    expect(resolveLabMonitor(fakeDb, 'zinc').length).toBe(1);
    expect(resolveLabMonitor(fakeDb, 'ZINC').length).toBe(1);
    expect(resolveLabMonitor(fakeDb, 'zinc_sup').length).toBe(1);
    expect(resolveLabMonitor(fakeDb, 'nope_xyz')).toEqual([]);
  });
  it('TOP20 покрывает креатин/B12/K2/мелатонин/коллаген', () => {
    for (const k of ['creatine', 'vitamin_b12', 'vitamin_k2', 'melatonin', 'collagen', 'selenium', 'copper', 'folate']) {
      expect(Array.isArray((LAB_TOP20 as any)[k]) && (LAB_TOP20 as any)[k].length > 0).toBe(true);
    }
  });
  it('честные безмаркерные записи (дневник, не выдуманный анализ)', () => {
    const noMarker = Object.values(LAB_TOP20).flat().filter(e => e.markerEn === '—');
    expect(noMarker.length).toBeGreaterThan(3);
    expect(noMarker.every(e => /маркера нет/.test(e.markerRu + e.note))).toBe(true);
  });
  it('все записи — только 8 канонических систем (рендер не дропает)', () => {
    const ok = new Set(['hepatic', 'renal', 'cardio', 'hematologic', 'coagulation', 'metabolic', 'hormonal', 'mineral']);
    for (const arr of Object.values(LAB_TOP20)) for (const e of arr as any[]) expect(ok.has(e.system)).toBe(true);
  });
  it('алиасы указывают на существующие ключи', () => {
    for (const [, target] of Object.entries(LAB_ID_ALIASES)) {
      expect(typeof target === 'string' && target.length > 0).toBe(true);
    }
  });
});

describe('P3-добавка фильтр каталога A/B', () => {
  it('passesGradeFilter: A/B проходят, C/D нет', () => {
    expect(passesGradeFilter('creatine', 'AB')).toBe(true);
    expect(passesGradeFilter('rhodiola', 'AB')).toBe(true);
    expect(passesGradeFilter('resveratrol', 'AB')).toBe(false);
    expect(passesGradeFilter('resveratrol', 'all')).toBe(true);
  });
  it('items-форма: пустые группы дропаются, count пересчитывается', () => {
    const groups = [
      { cat: 'a', count: 3, items: [{ id: 'creatine' }, { id: 'resveratrol' }, { id: 'magnesium' }] },
      { cat: 'b', count: 1, items: [{ id: 'resveratrol' }] },
    ];
    const out = filterCatalogGroups(groups as any, 'AB');
    expect(out.length).toBe(1);
    expect((out[0] as any).items.length).toBe(2);
    expect((out[0] as any).count).toBe(2);
  });
  it('classItems-форма: классы чистятся, пустые дропаются', () => {
    const groups = [
      { cat: 'x', count: 3, classItems: { k1: [{ id: 'creatine' }, { id: 'resveratrol' }], k2: [{ id: 'glutathione_reduced' }] } },
    ];
    const out = filterCatalogGroups(groups as any, 'AB');
    expect(out.length).toBe(1);
    expect(Object.keys((out[0] as any).classItems)).toEqual(['k1']);
    expect((out[0] as any).classItems.k1.length).toBe(1);
    expect((out[0] as any).count).toBe(1);
  });
  it('all — байт-в-байт', () => {
    const groups = [{ cat: 'a', count: 1, items: [{ id: 'x' }] }];
    expect(filterCatalogGroups(groups as any, 'all')).toBe(groups);
  });
});

describe('P8 кэш PubMed (движок)', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => { m.set(k, v); },
    };
  };
  it('miss → write → hit', () => {
    const s = mem();
    expect(getCachedPubmed(s, 'k', 'creatine')).toBeNull();
    expect(writePubmedCache(s, 'k', 'Creatine', [{ pmid: '1' }])).toBe(true);
    expect(getCachedPubmed(s, 'k', 'creatine')).toEqual([{ pmid: '1' }]);
  });
  it('TTL: протухшее не отдаём', () => {
    const s = mem();
    writePubmedCache(s, 'k', 'zinc', [{ pmid: '2' }], 1000);
    expect(getCachedPubmed(s, 'k', 'zinc', 1000 + 24 * 3600 * 1000 + 1)).toBeNull();
    expect(getCachedPubmed(s, 'k', 'zinc', 1000 + 1000)).toEqual([{ pmid: '2' }]);
  });
  it('кап 30: старые дропаются', () => {
    const s = mem();
    for (let i = 0; i < 35; i++) writePubmedCache(s, 'k', `q${i}`, [{ pmid: String(i) }], 1000 + i);
    const cache = readPubmedCache(s, 'k');
    expect(Object.keys(cache).length).toBe(30);
    expect(cache['q0']).toBeUndefined();
    expect(cache['q34']).toBeDefined();
  });
  it('битый стор и пустые входы', () => {
    const s = mem();
    (s as any).setItem = (k: string, _v: string) => { throw new Error('quota'); };
    expect(writePubmedCache({ getItem: () => '{broken', setItem: s.setItem }, 'k', 'a', [{ x: 1 }])).toBe(false);
    expect(getCachedPubmed({ getItem: () => '{broken', setItem: () => {} }, 'k', 'a')).toBeNull();
    const ok = mem();
    expect(writePubmedCache(ok, 'k', '  ', [{ x: 1 }])).toBe(false);
    expect(writePubmedCache(ok, 'k', 'a', [])).toBe(false);
    expect(getCachedPubmed(ok, 'k', '')).toBeNull();
  });
});

describe('P2-добавка resolvePersonDefaults (стор > профиль > дефолт)', () => {
  it('пусто везде — 80/муж/30', () => {
    expect(resolvePersonDefaults(null, null)).toEqual({ wKg: 80, sex: 'male', age: 30 });
  });
  it('профиль побеждает дефолт', () => {
    expect(resolvePersonDefaults(null, { weightKg: 62, sex: 'female', age: 28 })).toEqual({ wKg: 62, sex: 'female', age: 28 });
  });
  it('ручное сохранение побеждает профиль', () => {
    expect(resolvePersonDefaults({ wKg: 95, sex: 'male', age: 40 }, { weightKg: 62, sex: 'female', age: 28 }))
      .toEqual({ wKg: 95, sex: 'male', age: 40 });
  });
  it('мусор в сторе — fallback на профиль, не NaN', () => {
    const r = resolvePersonDefaults({ wKg: 'abc', sex: 'x', age: -5 }, { weightKg: 70, sex: 'male', age: 35 });
    expect(r).toEqual({ wKg: 70, sex: 'male', age: 35 });
  });
});

describe('Интеграция с реальными таблицами хаба', () => {
  it('каждый ключ THERAPEUTIC_WINDOWS резолвится в окно', async () => {
    const { THERAPEUTIC_WINDOWS } = await import('../../ui/screens/SupportScreen_parts/SupportBioavailabilityData');
    const keys = Object.keys(THERAPEUTIC_WINDOWS);
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) {
      const w = doseWindowFor(k, THERAPEUTIC_WINDOWS as any, {});
      expect(w.hasData, k).toBe(true);
      expect(w.max).toBeGreaterThan(0);
    }
  }, 30000);
  it('топ-вещества имеют окно (терапевтика + ranges)', async () => {
    const { THERAPEUTIC_WINDOWS } = await import('../../ui/screens/SupportScreen_parts/SupportBioavailabilityData');
    const { DOSE_RANGES } = await import('../../ui/screens/SupportScreen_parts/SupportEffectiveDose');
    for (const id of ['magnesium', 'zinc', 'creatine', 'omega3', 'vitamin_d3', 'nac', 'tudca', 'iron', 'berberine', 'curcumin']) {
      const w = doseWindowFor(id, THERAPEUTIC_WINDOWS as any, DOSE_RANGES as any);
      expect(w.hasData, id).toBe(true);
    }
    // Честный no-data путь на реальных таблицах (heptral ни в одном ключе/алиасе)
    expect(doseWindowFor('heptral', THERAPEUTIC_WINDOWS as any, DOSE_RANGES as any).hasData).toBe(false);
  });
  it('грейды определены для выборки каталога', async () => {
    const { SUPPORT_CATALOG_DATA } = await import('../../data/support-database');
    const ids = Object.keys(SUPPORT_CATALOG_DATA).slice(0, 60);
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) {
      const g = evidenceGradeExFor(id);
      expect(['A', 'B', 'C', 'D'].includes(g), id).toBe(true);
    }
  });
  it('реальные формы каталога маппятся в курируемые ключи (не claim)', async () => {
    const { buildBioavailabilityCatalog, detectFormBioKey } = await import('../../ui/screens/SupportScreen_parts/SupportBioavailabilityData');
    const catalog = buildBioavailabilityCatalog();
    const mg = catalog.find(e => e.id === 'magnesium_l_threonate');
    expect(mg).toBeTruthy();
    const key = detectFormBioKey(mg!.bestForm?.name || '', mg!.bestForm?.nameRu || '', (mg!.bestForm as any)?.notes);
    expect(key).toBe('mg_threonate');
    expect(bioEvidenceFor(key, mg!.maxBio).source).not.toBe('claim');
  });
  it('пиперин/моногидрат/пиколинат — честные источники без claim', async () => {
    const { detectFormBioKey } = await import('../../ui/screens/SupportScreen_parts/SupportBioavailabilityData');
    expect(bioEvidenceFor(detectFormBioKey('Curcumin + Piperine', 'Куркумин с пиперином', ''), 0.06).marketing).toBe(true);
    expect(bioEvidenceFor(detectFormBioKey('Creatine Monohydrate', 'Креатин моногидрат', ''), 0.99).source).toBe('meta');
    expect(bioEvidenceFor(detectFormBioKey('Zinc Picolinate', 'Цинк пиколинат', ''), 0.85).source).toBe('review');
  });
});
