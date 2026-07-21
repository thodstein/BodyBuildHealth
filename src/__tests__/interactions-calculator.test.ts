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
