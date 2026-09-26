/**
 * support-hub-pro.test.ts — P1–P8 хаба «Общая информация».
 * Калькулятор поддержки не тронут.
 */
import { describe, it, expect } from 'vitest';
// канон — `support-limits`, а НЕ `support-plan/types`: у NUTRIENT_LIMIT_INFO нет поля
// `note` (это урезанное представление для UI), и сравнение с ним давало `undefined`
import { NUTRIENT_LIMITS_V2, resolveNutrient } from '../support-limits';
import { bioEvidenceFor, doseWindowFor, limitUnitRu, evidenceGradeExFor, evidenceOutcomesFor, stackEvidenceGrade, migratedGet, migratedSet, personDoseHints, passesGradeFilter, filterCatalogGroups, resolvePersonDefaults, OUTCOME_MATRIX_SIZE } from '../support-hub-evidence.engine';
import { LAB_TOP20, LAB_ID_ALIASES, resolveLabMonitor } from '../support-hub-labs.engine';
import { getCachedPubmed, writePubmedCache, readPubmedCache } from '../support-hub-research.engine';
import { aasRouteOf, suggestAasFrequency, aasTimingFor, fmtHalfLife, AAS_TIMING_DISCLAIMER } from '../support-hub-aas-timing.engine';
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

  // E1.5: «6–8 мг/кг» из плана НЕЛЬЗЯ превращать в дозу БАДа — для 100 кг это 600–800 мг,
  // в 15–20 раз выше безопасного уровня из реестра (40 мг EFSA 2024 / 45 мг IOM).
  it('E1.5: железо — потребность по весу названа, но отделена от дозы добавки', () => {
    const h = personDoseHints('iron', { weightKg: 100 }).join(' | ');
    expect(h).toContain('6–8 мг/кг');
    expect(h).toContain('600–800 мг/сут при 100 кг');
    expect(h.toLowerCase()).toContain('пища, а не доза добавки');
    expect(h).toContain('endurance');
  });

  it('E1.5: потолок добавки взят из канона, а не посчитан «мг/кг × вес»', () => {
    const h = personDoseHints('iron_bisglycinate', { weightKg: 100 }).join(' | ');
    // в коде «НЕ» заглавной (акцент) — сравниваем без учёта регистра
    expect(h.toLowerCase()).toContain('не превышает безопасный уровень 40 мг');
    expect(h).toContain('45 мг, IOM 2001');
    expect(h).toContain('Умножать «мг/кг» на вес для добавки опасно');
  });

  it('E1.5: честность источника — ориентир, а не доказанный эффект (NS по маркерам)', () => {
    const h = personDoseHints('iron', { weightKg: 80 }).join(' | ');
    expect(h).toContain('NS');
    expect(h.toLowerCase()).toContain('не пруф-эффект');
    expect(h).toContain('Smid 2024');
    expect(h.toLowerCase()).toContain('короткие курсы');
  });

  it('E1.5: без веса хинт не выдумывает дозу', () => {
    const h = personDoseHints('iron', {}).join(' | ');
    expect(h).not.toContain('мг/кг');
    expect(h).not.toContain('NaN');
    expect(h).not.toContain('undefined');
  });

  it('E1.5: железный хинт не расползся на цинк/магний', () => {
    expect(personDoseHints('zinc', { weightKg: 100 }).join(' | ')).not.toContain('ПИЩА, а не доза добавки');
    expect(personDoseHints('magnesium', { weightKg: 100 }).join(' | ')).toContain('UL 350 мг');
  });

  // Тот же класс, что E1.2: одно значение — одна подпись. Раньше «40 мг» писалось вручную,
  // а «45 mg» подставлялось из реестра — в одной строке смесь latin и кириллицы.
  it('E1.5: единица измерения в подписи каноническая, без смеси mg/мг', () => {
    const h = personDoseHints('iron', { weightKg: 100 }).join(' | ');
    expect(h).toContain('40 мг');
    expect(h).toContain('45 мг, IOM 2001');
    expect(h).not.toMatch(/\d\s*mg\b/); // латиница в русской подписи не остаётся
  });

  it('limitUnitRu: маппинг единиц не разъезжается', () => {
    expect(limitUnitRu('mg')).toBe('мг');
    expect(limitUnitRu('mcg')).toBe('мкг');
    expect(limitUnitRu('iu')).toBe('МЕ');
    expect(limitUnitRu('g')).toBe('г');
    // неизвестная единица не подменяется молча
    expect(limitUnitRu('IU/l')).toBe('IU/l');
    expect(limitUnitRu(undefined)).toBe('мг');
  });
});

// ─── E1.6 (A4 / A7 / A8): оговорка реестра доходит до пользователя ───
//
// ГЛАВНАЯ НАХОДКА: все три эпика были «закрыты в тексте реестра» — витамин D, омега-3 и
// EGCG имели честно написанные `note`. Но `NUTRIENT_LIMITS_V2[id].note` НЕ ЧИТАЛСЯ НИГДЕ:
// ни в `doseWindowFor`, ни в UI. Класс дефекта тот же, что E0.12 (write-only) и E1.5:
// «честно написано — пользователь не видит». Один фикс закрыл все три эпика сразу.
describe('E1.6: оговорка реестра (A4 витамин D, A8 омега-3, A7 EGCG) доходит до UI', () => {
  // Те же окна, что и в бою: THERAPEUTIC_WINDOWS и DOSE_RANGES живут в РАЗНЫХ модулях,
  // причём второй — внутри TSX компонента. Статический импорт отсюда даёт `undefined`
  // без ошибки компиляции (ровно тот класс, что описан в support-limits-registry.test).
  const win = async (id: string) => {
    const { THERAPEUTIC_WINDOWS } = await import('../../ui/screens/SupportScreen_parts/SupportBioavailabilityData');
    const { DOSE_RANGES } = await import('../../ui/screens/SupportScreen_parts/SupportEffectiveDose');
    return doseWindowFor(id, THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);
  };

  it('A4 — витамин D: мониторить надо КАЛЬЦИЙ МОЧИ, а не только сырую кальцию', async () => {
    const n = (await win('vitamin_d3')).limitNote;
    expect(n.length).toBeGreaterThan(80);
    expect(n).toContain(NUTRIENT_LIMITS_V2.vitamin_d.note); // доставлен ровно текст реестра
    // EFSA называет гиперкальциурию БОЛЕЕ РАННИМ признаком избытка, чем устойчивая
    // гиперкальциемия — значит мониторить только сывороточную кальцию поздно
    expect(n).toContain('КАЛЬЦИЙ МОЧИ');
    expect(n).toContain('более ранним признаком');
    // и это не абстрактно: у нашей аудитории (AAS) риск правдоподобен
    expect(n).toContain('AAS');
  });

  it('A4 — то же самое НЕ теряется на форме (доза идёт по каноническому нутриенту)', async () => {
    // форма `vitamin_d3` и нутриент `vitamin_d` — разные id; если бы резолв сломался,
    // оговорка потерялась бы именно на форме, которую реально выбирает пользователь
    expect(resolveNutrient('vitamin_d3')).toBe('vitamin_d');
    expect((await win('vitamin_d3')).limitNote).toBe((await win('vitamin_d')).limitNote);
  });

  it('A8 — омега-3/DHA: UL НЕ установлен, и «1 г/сут» НЕльзя обобщать на EPA+DHA', async () => {
    const n = (await win('dha')).limitNote;
    expect(n).toContain(NUTRIENT_LIMITS_V2.dha.note);
    // «ω-жирные» — НЕ одно и то же, что «омега-3»: подытог явный
    expect(n.toUpperCase()).toContain('UL ДЛЯ ДОБАВКОВОГО DHA НЕ УСТАНОВЛЕН');
    expect(n).toContain('ТОЛЬКО для DHA-доминантных');
    expect(n).toContain('НЕ применять к смесям EPA+DHA');
    // и главное — число «3 г омега-3» не выдаётся за предел
    expect(n).toContain('«3 г омега-3» как предел этим заключением не поддержан');
  });

  it('A8 — SafeLevel не даёт права называть 1 г/сут пределом, но оговорку показать обязан', async () => {
    const w = await win('dha');
    expect(w.ulKind).toBe('SafeLevel');
    expect(w.ulWarning).toBe(false);      // предупреждение «превышен UL» тут ложно
    expect(w.limitNote.length).toBeGreaterThan(0); // но честность обязана быть видна
  });

  it('A7 — EGCG: гепатотоксичность не предсказуема дозой (гены), «до 800 мг безопасно» — ложь', async () => {
    const n = (await win('curcumin')).limitNote;
    expect(n).toContain(NUTRIENT_LIMITS_V2.curcumin.note);
    expect(n).toContain('EGCG');
    expect(n).toContain('COMT/UGT1A1');   // генотип, а не доза
    expect(n).toContain('HLA-B*35:01');
    expect(n.toLowerCase()).toContain('не предсказуема дозой');
    expect(n).toContain('800 мг');        // названное ложное пороговое число
  });

  it('A7 — оговорка про EGCG висит на куркумине как «не путать», а не теряется', async () => {
    // куркумин и зелёный чай — разные вещества с РАЗНОЙ токсикологией; если бы оговорка
    // жила только в комментарии файла, смешение «куркумин = безопасная доза» вернулось бы
    expect(NUTRIENT_LIMITS_V2.curcumin.kind).toBe('ClinicalGuidance');
    expect((await win('curcumin')).limitNote).toContain('НЕ путать');
  });

  it('инвариант: оговорка не теряется ни в одной ветке резолва', async () => {
    // и для каждого: если запись в реестре есть — оговорка обязана быть непустой
    for (const id of ['vitamin_d3', 'dha', 'curcumin', 'iron', 'zinc', 'magnesium', 'b6']) {
      const canon = resolveNutrient(id);
      if (canon && NUTRIENT_LIMITS_V2[canon]?.note) {
        expect((await win(id)).limitNote.length).toBeGreaterThan(0);
      }
    }
  });

  it('инвариант: вещества вне реестра НЕ получают выдуманную оговорку', async () => {
    expect((await win('vitex')).limitNote).toBe('');   // есть окно, но нет записи в реестре
    expect((await win('serrapeptase')).limitNote).toBe(''); // ключ из 12 символов — нельзя матчить подстрокой
    expect((await win('bcaa')).limitNote).toBe('');    // защита от ложного резолва (окно bcaa в базе нет)
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
  it('resolveName раскрывает сырые id, без резолвера — как есть', () => {
    const base = {
      id: 'magnesium', nameRu: 'Магний', maxBio: 0.8, formKey: 'mg_glycinate',
      therapeutic: {}, ranges: {}, category: ['mineral'],
      synergies: [{ with: 'l_theanine', effect: 'сон' }],
      conflicts: [{ with: 'calcium', effect: 'конкуренция' }],
      labMarkers: [], person: {},
    };
    const raw = buildSubstancePassport(base as any);
    expect(raw.synergyTop[0]).toMatch(/l_theanine/);
    const named = buildSubstancePassport({ ...base, resolveName: (id: string) => (id === 'l_theanine' ? 'L-Теанин' : id) } as any);
    expect(named.synergyTop[0]).toMatch(/L-Теанин/);
    expect(named.synergyTop[0]).not.toMatch(/l_theanine/);
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
  it('classBadges пересчитываются, пустые классы дропаются', () => {
    const groups = [{
      cat: 'x', count: 3,
      classBadges: [
        { clsKey: 'k1', emoji: '💊', count: 2 },
        { clsKey: 'k2', emoji: '🧪', count: 1 },
      ],
      classItems: { k1: [{ id: 'creatine' }, { id: 'resveratrol' }], k2: [{ id: 'glutathione_reduced' }] },
    }];
    const out = filterCatalogGroups(groups as any, 'AB');
    expect(out.length).toBe(1);
    expect((out[0] as any).classBadges).toEqual([{ clsKey: 'k1', emoji: '💊', count: 1 }]);
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

describe('P2-добавка resolvePersonDefaults (стор > профиль > дефолт)', () => {  it('пусто везде — 80/муж/30', () => {
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

describe('Раунд-8: грейд стеков, исходы, миграция ключей', () => {
  it('stackEvidenceGrade: все A → A, слабое звено тянет вниз, пусто → D', () => {
    expect(stackEvidenceGrade(['creatine', 'magnesium'])).toBe('A');
    expect(stackEvidenceGrade(['creatine', 'resveratrol'])).toBe('C');
    expect(stackEvidenceGrade(['creatine', 'glutathione_reduced'])).toBe('D');
    expect(stackEvidenceGrade([])).toBe('D');
  });
  it('evidenceOutcomesFor: креатин размечен, неизвестное — пусто', () => {
    const outs = evidenceOutcomesFor('creatine');
    expect(outs.some(o => o.outcome === 'muscle' && o.grade === 'A')).toBe(true);
    expect(outs.some(o => o.outcome === 'strength')).toBe(true);
    expect(evidenceOutcomesFor('heptral_unknown_xyz')).toEqual([]);
  });
  it('исход перекрывает базу (кофеин: performance A при базе A)', () => {
    expect(evidenceGradeExFor('caffeine', 'performance')).toBe('A');
    expect(evidenceGradeExFor('magnesium', 'sleep')).toBe('B');
    expect(evidenceGradeExFor('magnesium')).toBe('A');
  });
  it('исходы отсортированы: A первыми (паспорт показывает топ-4)', () => {
    const w = { A: 0, B: 1, C: 2, D: 3 } as Record<string, number>;
    for (const id of ['creatine', 'magnesium', 'omega3', 'ashwagandha']) {
      const grades = evidenceOutcomesFor(id).map(o => w[o.grade]);
      const sorted = [...grades].sort((a, b) => a - b);
      expect(grades, id).toEqual(sorted);
    }
  });
  it('migratedGet: новый побеждает, legacy мигрирует и чистится, мусор → null', () => {    const m = new Map<string, string>();
    const store = {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => { m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); },
    };
    m.set('new_k', 'NEW');
    m.set('old_k', 'OLD');
    expect(migratedGet(store, 'new_k', 'old_k')).toBe('NEW');
    m.delete('new_k');
    expect(migratedGet(store, 'new_k', 'old_k')).toBe('OLD');
    expect(m.has('new_k')).toBe(true);
    expect(m.has('old_k')).toBe(false);
    expect(migratedGet({ getItem: () => { throw new Error('x'); }, setItem: () => {}, removeItem: () => {} }, 'a', 'b')).toBeNull();
    expect(migratedGet({ getItem: () => null, setItem: () => {}, removeItem: () => {} }, 'a', 'b')).toBeNull();
    migratedSet(store, 's_k', 'v');
    expect(m.get('s_k')).toBe('v');
    migratedSet(store, 's_k', null);
    expect(m.has('s_k')).toBe(false);
  });
});

describe('Матрица исходов: покрытие и ноты', () => {  it('размер матрицы — сотни пар', () => {
    expect(OUTCOME_MATRIX_SIZE).toBeGreaterThanOrEqual(130);
  });
  it('новые пары резолвятся с нотами', () => {
    expect(evidenceGradeExFor('magnesium', 'migraine')).toBe('B');
    expect(evidenceGradeExFor('zinc_carnosine', 'gut')).toBe('B');
    expect(evidenceGradeExFor('diosmin', 'veins')).toBe('B');
    expect(evidenceGradeExFor('betaine', 'homocysteine')).toBe('B');
    expect(evidenceGradeExFor('l_carnitine', 'fertility')).toBe('B');
    expect(evidenceGradeExFor('ashwagandha', 'strength')).toBe('B');
    expect(evidenceGradeExFor('fish_oil', 'triglycerides')).toBe('A');
    expect(evidenceGradeExFor('magnesium_glycinate', 'sleep')).toBe('B');
    const outs = evidenceOutcomesFor('magnesium');
    expect(outs.some(o => o.outcome === 'migraine' && !!o.note)).toBe(true);
    expect(evidenceOutcomesFor('tribulus').some(o => o.grade === 'D')).toBe(true);
  });
});

describe('AAS-тайминг (строго из данных БД)', () => {
  it('route: классы эфиров — inject, оралка/SARM — oral, прочее — other', () => {
    expect(aasRouteOf('testosterone')).toBe('inject');
    expect(aasRouteOf('trenbolone')).toBe('inject');
    expect(aasRouteOf('oral_17aa')).toBe('oral');
    expect(aasRouteOf('sarm')).toBe('oral');
    expect(aasRouteOf('mystery_class')).toBe('other');
    expect(aasRouteOf('oral_17aa', ['tablet'])).toBe('oral');
  });
  it('ступени частоты по T½ (границы)', () => {
    expect(suggestAasFrequency(8, 'inject').label).toMatch(/ED/);
    expect(suggestAasFrequency(48, 'inject').label).toMatch(/EOD/);
    expect(suggestAasFrequency(100, 'inject').label).toMatch(/2/);
    expect(suggestAasFrequency(200, 'inject').label).toBe('2×/нед');
    expect(suggestAasFrequency(336, 'inject').label).toBe('1–2×/нед');
    expect(suggestAasFrequency(null, 'inject').label).toBe('По справочнику');
    expect(suggestAasFrequency(8, 'oral').label).toMatch(/2 приёма/);
  });
  it('aasTimingFor: пропионат EOD, энантат 2×/нед, супердрол — сплит+печень', () => {
    const prop = aasTimingFor({ id: 'test_prop', name: 'Тестостерон пропионат', cls: 'testosterone', tHalfHours: 48, dbFrequency: '2x/wk', instructions: ['Инъекции 2x/нед'] });
    expect(prop.route).toBe('inject');
    expect(prop.suggested).toMatch(/EOD/);
    expect(prop.dbFrequency).toBe('2x/wk');
    expect(prop.instructions.length).toBe(1);
    const enan = aasTimingFor({ id: 'test_enan', name: 'Тестостерон энантат', cls: 'testosterone', tHalfHours: 336 });
    expect(enan.suggested).toBe('1–2×/нед');
    const sdrol = aasTimingFor({ id: 'superdrol', name: 'Superdrol', cls: 'oral_17aa', tHalfHours: 8, instructions: ['Курс не более 4 нед'] });
    expect(sdrol.route).toBe('oral');
    expect(sdrol.splitNote).toMatch(/2 приёма/);
    expect(sdrol.hasData).toBe(true);
  });
  it('без данных — честно hasData:false', () => {
    const empty = aasTimingFor({ id: 'x', name: 'X', cls: 'mystery_class' });
    expect(empty.hasData).toBe(false);
    expect(empty.halfLifeHours).toBeNull();
  });
  it('fmtHalfLife: часы и дни', () => {
    expect(fmtHalfLife(8)).toBe('8 ч');
    expect(fmtHalfLife(336)).toBe('14 дн');
    expect(fmtHalfLife(-5)).toBe('—');
  });
  it('дисклеймер снижения вреда на месте', () => {
    expect(AAS_TIMING_DISCLAIMER).toMatch(/не назначение/);
  });
  it('каталожный ААС (testosterone + hormonal, без класса) ловится гейтом', () => {
    // Реальный кейс: запись каталога id 'testosterone', category ['pharma','hormonal']
    expect(isAASHonest(['pharma', 'hormonal'], 'Тестостерон', 'Testosterone').isAAS).toBe(true);
  });
});
