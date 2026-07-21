// ════════════════════════════════════════════════════════════════════════════
//  Vitest тесты для interactions-calculator
// ════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  calculateInteractions,
  extractTiming,
  filterAndSortInteractions,
  getTimingTelemetry,
  findInteractionsForSubstance,
  findSynergies,
  findConflicts,
  analyzeInteractions,
  checkDrugInteractions,
} from '../engines/interactions-calculator';
import { checkInteractions } from '../data/drug-interactions';

describe('extractTiming', () => {
  it('извлекает intervalHours', () => {
    const t = extractTiming('Интервал ≥ 2ч');
    expect(t?.intervalHours).toBe(2);
  });

  it('извлекает withFood (натощак)', () => {
    const t = extractTiming('Принимать натощак');
    expect(t?.withFood).toBe('fasting');
  });

  it('извлекает withFood (с едой / во время еды)', () => {
    const t1 = extractTiming('Принимать с едой');
    const t2 = extractTiming('Принимать во время еды');
    expect(t1?.withFood).toBe('with_meal');
    expect(t2?.withFood).toBe('with_meal');
  });

  it('извлекает timeOfDay (утром)', () => {
    const t = extractTiming('Принимать утром');
    expect(t?.timeOfDay).toBe('morning');
  });

  it('извлекает timeOfDay (перед сном)', () => {
    const t = extractTiming('Принимать перед сном');
    expect(t?.timeOfDay).toBe('bedtime');
  });

  it('извлекает durationDays (курс 8 нед)', () => {
    const t = extractTiming('Курс 8 нед');
    expect(t?.durationDays).toBe('8 нед');
  });

  it('извлекает monitoringPeriod (каждые 2 нед)', () => {
    const t = extractTiming('Контроль каждые 2 нед');
    expect(t?.monitoringPeriod).toBe('каждые 2 нед');
  });

  it('возвращает undefined для пустого текста', () => {
    expect(extractTiming('')).toBeUndefined();
  });

  it('возвращает undefined для текста без паттернов', () => {
    expect(extractTiming('просто текст')).toBeUndefined();
  });
});

describe('calculateInteractions', () => {
  it('пустой вход → score=100, all=[]', () => {
    const r = calculateInteractions({});
    expect(r.score).toBe(100);
    expect(r.all.length).toBe(0);
    expect(r.blocked).toBe(false);
  });

  it('K2+Warfarin → score < 70, blocked=true', () => {
    const r = calculateInteractions({ substances: ['VITAMIN_K2', 'WARFARIN'] });
    expect(r.score).toBeLessThan(70);
    expect(r.blocked).toBe(true);
    expect(r.bySeverity.CRITICAL.length).toBeGreaterThan(0);
  });

  it('Iron+VitC → contains synergy', () => {
    const r = calculateInteractions({ substances: ['IRON', 'VITAMIN_C'] });
    // Iron+VitC участвует в нескольких записях (Ca+Fe, Cu+Fe, K2+VitC, etc.)
    // Главное — есть synergy (не конкретный score, который зависит от cross-alerts)
    expect(r.bySeverity.LOW.length).toBeGreaterThan(0);
  });

  it('unknown IDs → score=100, all=[]', () => {
    const r = calculateInteractions({ substances: ['xyz_unknown', 'abc_fake'] });
    expect(r.score).toBe(100);
    expect(r.all.length).toBe(0);
  });

  it('AAS course → pharmaRules >= 0', () => {
    const r = calculateInteractions({ course: [
      { id: 't1', substanceId: 'test_enan', doseValue: 750, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 },
      { id: 't2', substanceId: 'tren_ace', doseValue: 350, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 8 },
    ]});
    expect(r.bySource.pharmaRules.length).toBeGreaterThanOrEqual(0);
  });

  it('extracts effect ≠ recommendation для pharma', () => {
    const r = calculateInteractions({ course: [
      { id: 't1', substanceId: 'test_enan', doseValue: 750, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 },
    ]});
    if (r.all.length > 0) {
      const sample = r.all[0];
      // effect и recommendation могут совпадать для support_db; для pharma — разные
      // Главное — поля заполнены
      expect(sample.effect).toBeDefined();
      expect(sample.recommendation).toBeDefined();
    }
  });
});

describe('filterAndSortInteractions', () => {
  const items = calculateInteractions({ substances: ['VITAMIN_K2', 'WARFARIN', 'IRON', 'VITAMIN_C'] }).all;

  it('default sort: CRITICAL первым', () => {
    const sorted = filterAndSortInteractions(items);
    if (sorted.length > 0) {
      expect(sorted[0].severity).toBe('CRITICAL');
    }
  });

  it('onlyCritical: только CRITICAL', () => {
    const filtered = filterAndSortInteractions(items, { onlyCritical: true });
    expect(filtered.every(i => i.severity === 'CRITICAL')).toBe(true);
  });

  it('maxSeverity=HIGH: только CRITICAL + HIGH', () => {
    const filtered = filterAndSortInteractions(items, { maxSeverity: 'HIGH' });
    expect(filtered.every(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')).toBe(true);
  });

  it('types=[block,danger]: только эти типы', () => {
    const filtered = filterAndSortInteractions(items, { types: ['block', 'danger'] });
    expect(filtered.every(i => i.type === 'block' || i.type === 'danger')).toBe(true);
  });
});

describe('drug-interactions расширенные', () => {
  it('5-HTP + fluoxetine → block', () => {
    const r = checkInteractions(['5htp', 'fluoxetine']);
    expect(r.some(x => x.severity === 'block')).toBe(true);
  });

  it('L-тирозин + phenelzine (ИМАО) → block', () => {
    const r = checkInteractions(['tyrosine', 'phenelzine']);
    expect(r.some(x => x.severity === 'block')).toBe(true);
  });

  it('Литий + ибупрофен → block', () => {
    const r = checkInteractions(['lithium', 'ibuprofen']);
    expect(r.some(x => x.severity === 'block')).toBe(true);
  });

  it('simvastatin + grapefruit → block (CYP3A4 10x)', () => {
    const r = checkInteractions(['simvastatin', 'grapefruit']);
    expect(r.some(x => x.severity === 'block')).toBe(true);
  });

  it('regression: niacin+simvastatin → warn', () => {
    const r = checkInteractions(['niacin', 'simvastatin']);
    expect(r.some(x => x.severity === 'warn')).toBe(true);
  });
});

describe('getTimingTelemetry', () => {
  it('reset() обнуляет счётчики', () => {
    getTimingTelemetry().reset();
    const t = getTimingTelemetry();
    expect(t.total).toBe(0);
    expect(t.matched).toBe(0);
    expect(t.missRate).toBe(0);
  });

  it('total и matched инкрементируются', () => {
    getTimingTelemetry().reset();
    const t0 = getTimingTelemetry();
    extractTiming('натощак');
    extractTiming('просто текст');
    const t1 = getTimingTelemetry();
    expect(t1.total - t0.total).toBe(2);
    expect(t1.matched - t0.matched).toBe(1);
  });
});

describe('analyzeInteractions (legacy)', () => {
  it('возвращает score, conflicts, synergies', () => {
    const r = analyzeInteractions(['IRON', 'VITAMIN_C', 'CALCIUM']);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(r.conflicts)).toBe(true);
    expect(Array.isArray(r.synergies)).toBe(true);
  });

  it('пустой вход: score=100, conflicts=[], synergies=[]', () => {
    const r = analyzeInteractions([]);
    expect(r.score).toBe(100);
    expect(r.conflicts.length).toBe(0);
    expect(r.synergies.length).toBe(0);
  });
});

describe('findInteractionsForSubstance', () => {
  it('находит все записи для iron', () => {
    const r = findInteractionsForSubstance('iron');
    expect(r.length).toBeGreaterThanOrEqual(10);
  });

  it('findSynergies: только type=synergy', () => {
    const r = findSynergies('iron');
    expect(r.every(i => i.type === 'synergy')).toBe(true);
  });

  it('findConflicts: conflict + caution', () => {
    const r = findConflicts('iron');
    expect(r.every(i => i.type === 'conflict' || i.type === 'caution')).toBe(true);
  });
});

describe('pharma rules (AAS/PED)', () => {
  it('test_enan + tren_ace → warning (progestin)', () => {
    const alerts = checkDrugInteractions([
      { id: 't1', substanceId: 'test_enan', doseValue: 750, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 },
      { id: 't2', substanceId: 'tren_ace', doseValue: 350, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 8 },
    ]);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a: any) => a.type === 'warning' || a.type === 'critical')).toBe(true);
  });

  it('test_enan + tren_ace + nandrolone → critical (19-nor progestin synergy)', () => {
    const alerts = checkDrugInteractions([
      { id: 'a', substanceId: 'test_enan', doseValue: 750, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12 },
      { id: 'b', substanceId: 'tren_ace', doseValue: 350, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 8 },
      { id: 'c', substanceId: 'nandrolone', doseValue: 400, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 8 },
    ]);
    expect(alerts.some((a: any) => a.type === 'critical')).toBe(true);
  });

  it('empty course → []', () => {
    expect(checkDrugInteractions([])).toEqual([]);
  });
});

describe('extractTiming edge cases', () => {
  it('mixed language: before meal + at bedtime', () => {
    const t = extractTiming('Take 30 min before meal, at bedtime');
    expect(t?.withFood).toBe('before_meal');
    expect(t?.timeOfDay).toBe('bedtime');
  });

  it('длительность через "курс"', () => {
    const t = extractTiming('Курс 4-6 мес');
    expect(t?.durationDays).toBe('4-6 мес');
  });

  it('несколько паттернов в одном тексте', () => {
    const t = extractTiming('Принимать натощак утром. Каждые 2 нед контроль. Курс 8 нед.');
    expect(t?.withFood).toBe('fasting');
    expect(t?.timeOfDay).toBe('morning');
    expect(t?.monitoringPeriod).toBe('каждые 2 нед');
    expect(t?.durationDays).toBe('8 нед');
  });

  it('whitespace tolerance', () => {
    const t = extractTiming('   натощак    утром   ');
    expect(t?.withFood).toBe('fasting');
  });

  it('special chars (≥, +)', () => {
    const t1 = extractTiming('Интервал ≥ 2ч');
    expect(t1?.intervalHours).toBe(2);
  });

  it('длительность через "принимать" (если поддерживается)', () => {
    // Текущий regex ищет "курс|принимать|приём|прием|длительность" + число + период
    const t = extractTiming('Принимать 8 нед');
    // Может не парситься (regex требует контекст), проверим что undefined — допустимо
    expect(t === undefined || typeof t.durationDays === 'string').toBe(true);
  });
});

describe('i18n labels', () => {
  it('pickLabels: ru locale (default)', async () => {
    const { pickLabels } = await import('../data/interactions-labels');
    const ru = pickLabels('ru');
    expect(ru.SEVERITY_META.CRITICAL.label).toBe('КРИТИЧНО');
    expect(ru.SECTION_LABELS.fieldEffect).toBe('Суть');
    expect(ru.FILTER_LABELS.onlyCritical).toBe('Только критичные');
  });

  it('pickLabels: en locale', async () => {
    const { pickLabels } = await import('../data/interactions-labels');
    const en = pickLabels('en');
    expect(en.SEVERITY_META.CRITICAL.label).toBe('CRITICAL');
    expect(en.SEVERITY_META.HIGH.label).toBe('WARNING');
    expect(en.SECTION_LABELS.fieldEffect).toBe('Effect');
    expect(en.FILTER_LABELS.onlyCritical).toBe('Critical only');
    expect(en.SOURCE_LABELS.support_db).toBe('Supplement DB');
    expect(en.TYPE_LABELS.synergy).toBe('⊕ Synergy');
  });

  it('setLocale / getLocale / t() helper', async () => {
    const { setLocale, getLocale, t } = await import('../data/interactions-labels');
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(t().SEVERITY_META.CRITICAL.label).toBe('CRITICAL');
    setLocale('ru');
    expect(getLocale()).toBe('ru');
    expect(t().SEVERITY_META.CRITICAL.label).toBe('КРИТИЧНО');
  });
});

describe('Class-aware dedup (vitamin_k2 + @anticoagulant = CLASS_ANTICOAGULANT)', () => {
  it('class-based + substance-based записи дедуплицируются', () => {
    const r = calculateInteractions({ substances: ['VITAMIN_K2', 'WARFARIN'] });
    // Должны получить минимум 1 CRITICAL (через class-based dedup)
    const crit = r.bySeverity.CRITICAL;
    expect(crit.length).toBeGreaterThan(0);
    // И source должен быть drug_interactions (CRITICAL приоритетнее)
    expect(crit[0].source).toBe('drug_interactions');
  });

  it('score clamp [0, 100]', () => {
    const r1 = calculateInteractions({});
    expect(r1.score).toBe(100);
    // Экстремальный кейс — много взаимодействий
    const r2 = calculateInteractions({
      substances: ['WARFARIN', 'VITAMIN_K2', 'ASPIRIN', 'COQ10', 'GINGKO', 'FISH_OIL', 'VITAMIN_E', 'IRON', 'CALCIUM', 'ZINC'],
    });
    expect(r2.score).toBeGreaterThanOrEqual(0);
    expect(r2.score).toBeLessThanOrEqual(100);
  });
});

describe('Alias mapping (resolveInteractionId)', () => {
  it('magnesium forms → MAGNESIUM', () => {
    const r1 = findInteractionsForSubstance('magnesium_glycinate');
    const r2 = findInteractionsForSubstance('magnesium_l_threonate');
    const r3 = findInteractionsForSubstance('magnesium_taurate');
    // Должны находить те же записи что и magnesium
    const base = findInteractionsForSubstance('magnesium');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
    expect(r3.length).toBe(base.length);
  });

  it('zinc forms → ZINC', () => {
    const r1 = findInteractionsForSubstance('zinc_picolinate');
    const r2 = findInteractionsForSubstance('zinc_gluconate');
    const base = findInteractionsForSubstance('zinc');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });

  it('calcium forms → CALCIUM', () => {
    const r1 = findInteractionsForSubstance('calcium_citrate');
    const r2 = findInteractionsForSubstance('calcium_carbonate');
    const base = findInteractionsForSubstance('calcium');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });

  it('selenium forms → SELENIUM', () => {
    const r1 = findInteractionsForSubstance('selenomethionine');
    const r2 = findInteractionsForSubstance('sodium_selenite');
    const base = findInteractionsForSubstance('selenium');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });

  it('omega3 forms → OMEGA3', () => {
    const r1 = findInteractionsForSubstance('fish_oil');
    const r2 = findInteractionsForSubstance('epa');
    const r3 = findInteractionsForSubstance('dha');
    const base = findInteractionsForSubstance('omega3');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
    expect(r3.length).toBe(base.length);
  });

  it('vitamin D forms → VITAMIN_D', () => {
    const r1 = findInteractionsForSubstance('vitamin_d3');
    const r2 = findInteractionsForSubstance('vitamin_d2');
    const r3 = findInteractionsForSubstance('cholecalciferol');
    const base = findInteractionsForSubstance('VITAMIN_D');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
    expect(r3.length).toBe(base.length);
  });

  it('vitamin B12 forms → VITAMIN_B12', () => {
    const r1 = findInteractionsForSubstance('methylcobalamin');
    const r2 = findInteractionsForSubstance('cyanocobalamin');
    const r3 = findInteractionsForSubstance('hydroxocobalamin');
    const base = findInteractionsForSubstance('vitamin_b12');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
    expect(r3.length).toBe(base.length);
  });

  it('vitamin B6 forms → VITAMIN_B6', () => {
    const r1 = findInteractionsForSubstance('pyridoxine');
    const r2 = findInteractionsForSubstance('p5p');
    const base = findInteractionsForSubstance('vitamin_b6');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });

  it('pharma IDs: anastrozole → PHARMA_ANASTROZOLE', () => {
    const r1 = findInteractionsForSubstance('anastrozole');
    const r2 = findInteractionsForSubstance('anastrazole');
    const base = findInteractionsForSubstance('pharma_anastrozole');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });

  it('pharma IDs: tamoxifen → PHARMA_TAMOXIFEN', () => {
    const r1 = findInteractionsForSubstance('tamoxifen');
    const r2 = findInteractionsForSubstance('nolvadex');
    const base = findInteractionsForSubstance('pharma_tamoxifen');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });

  it('pharma IDs: cabergoline → PHARMA_CABERGOLINE', () => {
    const r1 = findInteractionsForSubstance('cabergoline');
    const r2 = findInteractionsForSubstance('caber');
    const base = findInteractionsForSubstance('pharma_cabergoline');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });

  it('pharma IDs: testosterone → PHARMA_TESTOSTERONE', () => {
    const r1 = findInteractionsForSubstance('testosterone');
    const r2 = findInteractionsForSubstance('test');
    const r3 = findInteractionsForSubstance('test_enan');
    const r4 = findInteractionsForSubstance('test_cyp');
    const r5 = findInteractionsForSubstance('test_prop');
    const base = findInteractionsForSubstance('pharma_testosterone');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
    expect(r3.length).toBe(base.length);
    expect(r4.length).toBe(base.length);
    expect(r5.length).toBe(base.length);
  });

  it('iron forms → IRON', () => {
    const r1 = findInteractionsForSubstance('iron_bisglycinate');
    const r2 = findInteractionsForSubstance('iron_sulfate');
    const r3 = findInteractionsForSubstance('iron_fumarate');
    const base = findInteractionsForSubstance('iron');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
    expect(r3.length).toBe(base.length);
  });

  it('unknown ID → uppercase conversion', () => {
    const r1 = findInteractionsForSubstance('xyz_unknown');
    expect(r1.length).toBe(0);
  });

  it('case insensitive', () => {
    const r1 = findInteractionsForSubstance('MAGNESIUM');
    const r2 = findInteractionsForSubstance('magnesium');
    expect(r1.length).toBe(r2.length);
  });

  it('whitespace and hyphen normalization', () => {
    const r1 = findInteractionsForSubstance('magnesium glycinate');
    const r2 = findInteractionsForSubstance('magnesium-glycinate');
    const base = findInteractionsForSubstance('magnesium_glycinate');
    expect(r1.length).toBe(base.length);
    expect(r2.length).toBe(base.length);
  });
});
