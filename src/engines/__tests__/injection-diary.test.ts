/**
 * injection-diary.engine.test.ts — тесты движка дневника инъекций.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);
import {
  getInjectionDiary,
  addInjection,
  updateInjection,
  deleteInjection,
  clearInjectionDiary,
  todayLocalStr,
  zoneLabel,
  techniqueLabel,
  getEntriesForZone,
  getDaysSinceLastInjection,
  getRotationWarnings,
  getSuggestedZone,
  computeInjectionStats,
  detectInjectionAnomalies,
  getWeeklyFrequency,
  parseDose,
  migrateLegacyEntry,
  migrateAllLegacyEntries,
  getInjectionTrend,
  getZoneTechniqueMatrix,
  getLastInjection,
  localDateDaysAgo,
  getRotationRecommendations,
  suggestBetterTechnique,
  getInjectionRecommendations,
  getZoneTechniqueAdvice,
  getSubstanceInjectionAdvice,
  INJECTION_ZONES,
  NEEDLE_GAUGES,
  TECHNIQUES,
  type InjectionEntry,
  type InjectionRecommendation,
} from '../injection-diary.engine';

const STORAGE_KEY = 'he_injection_diary';

function mockEntry(overrides: Partial<InjectionEntry> = {}): InjectionEntry {
  return {
    id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: todayLocalStr(),
    substance: 'Тест энантат',
    dose: '250 мг',
    zone: 'glute_dorsal',
    side: 'left',
    volumeMl: 1,
    needleGauge: '23G',
    technique: 'im',
    painLevel: 0,
    pipLevel: 0,
    swelling: 0,
    redness: false,
    lump: false,
    bruise: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorageMock.clear();
});

describe('injection-diary.engine', () => {
  describe('CRUD', () => {
    it('empty diary on first load', () => {
      expect(getInjectionDiary()).toEqual([]);
    });

    it('addInjection stores entry with generated id', () => {
      const entry = mockEntry({ substance: 'Нандролон', dose: '200 мг' });
      const updated = addInjection(entry);
      expect(updated).toHaveLength(1);
      expect(updated[0].substance).toBe('Нандролон');
      expect(updated[0].id).toBeTruthy();
      expect(updated[0].date).toBe(todayLocalStr());
    });

    it('addInjection sorts by date', () => {
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
      const e1 = mockEntry({ date: yesterday, substance: 'Станозолол' });
      const e2 = mockEntry({ substance: 'Тест энантат' });
      addInjection(e1);
      addInjection(e2);
      const diary = getInjectionDiary();
      expect(diary[0].date).toBe(yesterday);
      expect(diary[1].date).toBe(todayLocalStr());
    });

    it('updateInjection patches entry by id', () => {
      const updated = addInjection(mockEntry());
      const id = updated[0].id;
      const patched = updateInjection(id, { painLevel: 5, swelling: 3 });
      expect(patched).toHaveLength(1);
      expect(patched[0].painLevel).toBe(5);
      expect(patched[0].swelling).toBe(3);
      expect(patched[0].substance).toBe('Тест энантат');
    });

    it('deleteInjection removes entry by id', () => {
      const updated = addInjection(mockEntry({ substance: 'УДАЛИТЬ' }));
      addInjection(mockEntry({ substance: 'Оставить' }));
      const deleted = deleteInjection(updated[0].id);
      expect(deleted).toHaveLength(1);
      expect(deleted[0].substance).toBe('Оставить');
    });

    it('clearInjectionDiary empties storage', () => {
      addInjection(mockEntry());
      addInjection(mockEntry());
      const cleared = clearInjectionDiary();
      expect(cleared).toEqual([]);
      expect(getInjectionDiary()).toEqual([]);
    });
  });

  describe('Helpers', () => {
    it('todayLocalStr returns YYYY-MM-DD', () => {
      const today = todayLocalStr();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('zoneLabel returns human-readable name', () => {
      expect(zoneLabel('glute_dorsal')).toBe('Ягодица (дорсальная)');
      expect(zoneLabel('unknown_zone')).toBe('unknown_zone');
    });

    it('techniqueLabel returns human-readable name', () => {
      expect(techniqueLabel('im')).toBe('В/м (масло)');
      expect(techniqueLabel('unknown')).toBe('unknown');
    });

    it('getEntriesForZone filters correctly', () => {
      addInjection(mockEntry({ zone: 'glute_dorsal' }));
      addInjection(mockEntry({ zone: 'deltoid_l' }));
      addInjection(mockEntry({ zone: 'glute_dorsal' }));
      const glute = getEntriesForZone('glute_dorsal', getInjectionDiary());
      expect(glute).toHaveLength(2);
      const deltoid = getEntriesForZone('deltoid_l', getInjectionDiary());
      expect(deltoid).toHaveLength(1);
    });

    it('getDaysSinceLastInjection calculates correctly', () => {
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
      addInjection(mockEntry({ zone: 'glute_dorsal', date: yesterday }));
      const days = getDaysSinceLastInjection('glute_dorsal', getInjectionDiary(), todayLocalStr());
      expect(days).toBe(1);
    });

    it('getDaysSinceLastInjection returns null for empty zone', () => {
      expect(getDaysSinceLastInjection('glute_dorsal', [])).toBeNull();
    });
  });

  describe('Rotation warnings', () => {
    it('warns when zone not used for >= 7 days', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
      addInjection(mockEntry({ zone: 'glute_dorsal', date: tenDaysAgo }));
      const warnings = getRotationWarnings(getInjectionDiary());
      expect(warnings.length).toBe(1);
      expect(warnings[0].zone).toBe('glute_dorsal');
      expect(warnings[0].daysSince).toBeGreaterThanOrEqual(7);
      expect(warnings[0].severity).toBe('warn');
    });

    it('danger when zone not used for >= 14 days', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
      addInjection(mockEntry({ zone: 'deltoid_l', date: fifteenDaysAgo }));
      const warnings = getRotationWarnings(getInjectionDiary());
      expect(warnings.length).toBe(1);
      expect(warnings[0].severity).toBe('danger');
    });

    it('no warnings for recently used zones', () => {
      addInjection(mockEntry({ zone: 'glute_dorsal' }));
      const warnings = getRotationWarnings(getInjectionDiary());
      expect(warnings.filter(w => w.zone === 'glute_dorsal')).toHaveLength(0);
    });
  });

  describe('Suggested zone', () => {
    it('suggests zone not used today', () => {
      addInjection(mockEntry({ zone: 'glute_dorsal' }));
      const suggested = getSuggestedZone(getInjectionDiary());
      expect(suggested).not.toBe('glute_dorsal');
    });

    it('suggests zone with longest rest', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
      addInjection(mockEntry({ zone: 'glute_dorsal', date: fiveDaysAgo }));
      addInjection(mockEntry({ zone: 'deltoid_l' }));
      const suggested = getSuggestedZone(getInjectionDiary());
      expect(['glute_dorsal', 'glute_ventral', 'quadriceps_l', 'quadriceps_r']).toContain(suggested);
    });
  });

  describe('Statistics', () => {
    it('returns zeros for empty diary', () => {
      const stats = computeInjectionStats([]);
      expect(stats.totalInjections).toBe(0);
      expect(stats.avgPain).toBeNull();
      expect(stats.zoneStats).toEqual([]);
    });

    it('computes averages and counts', () => {
      addInjection(mockEntry({ painLevel: 2, pipLevel: 1, redness: true, lump: false, bruise: false }));
      addInjection(mockEntry({ painLevel: 8, pipLevel: 5, redness: false, lump: true, bruise: false, swelling: 3 }));
      const stats = computeInjectionStats(getInjectionDiary());
      expect(stats.totalInjections).toBe(2);
      expect(stats.avgPain).toBe(5);
      expect(stats.avgPip).toBe(3);
      expect(stats.lumpCount).toBe(1);
      expect(stats.rednessCount).toBe(1);
      expect(stats.bruiseCount).toBe(0);
      expect(stats.complicationRate).toBe(100);
    });

    it('computes zone stats sorted by count', () => {
      addInjection(mockEntry({ zone: 'glute_dorsal' }));
      addInjection(mockEntry({ zone: 'glute_dorsal' }));
      addInjection(mockEntry({ zone: 'deltoid_l' }));
      const stats = computeInjectionStats(getInjectionDiary());
      expect(stats.zoneStats[0].zone).toBe('glute_dorsal');
      expect(stats.zoneStats[0].count).toBe(2);
      expect(stats.zoneStats[1].zone).toBe('deltoid_l');
      expect(stats.zoneStats[1].count).toBe(1);
    });

    it('computes substance stats', () => {
      addInjection(mockEntry({ substance: 'Тест энантат' }));
      addInjection(mockEntry({ substance: 'Тест энантат' }));
      addInjection(mockEntry({ substance: 'Нандролон' }));
      const stats = computeInjectionStats(getInjectionDiary());
      expect(stats.substanceStats).toHaveLength(2);
      expect(stats.substanceStats[0].substance).toBe('Тест энантат');
      expect(stats.substanceStats[0].count).toBe(2);
    });

    it('computes last7 stats', () => {
      addInjection(mockEntry({ painLevel: 3 }));
      const stats = computeInjectionStats(getInjectionDiary());
      expect(stats.last7).not.toBeNull();
      expect(stats.last7!.count).toBe(1);
    });
  });

  describe('Anomaly detection', () => {
    it('returns empty for empty diary', () => {
      expect(detectInjectionAnomalies([])).toEqual([]);
    });

    it('detects high PIP', () => {
      const anomalies = detectInjectionAnomalies([
        mockEntry({ pipLevel: 8, zone: 'glute_dorsal' }),
      ]);
      expect(anomalies.length).toBeGreaterThanOrEqual(1);
      expect(anomalies[0].category).toBe('pip');
      expect(anomalies[0].severity).toBe('danger');
    });

    it('detects moderate PIP', () => {
      const anomalies = detectInjectionAnomalies([
        mockEntry({ pipLevel: 5 }),
      ]);
      expect(anomalies.some(a => a.category === 'pip' && a.severity === 'warn')).toBe(true);
    });

    it('detects swelling', () => {
      const anomalies = detectInjectionAnomalies([
        mockEntry({ swelling: 6 }),
      ]);
      expect(anomalies.some(a => a.category === 'swelling')).toBe(true);
    });

    it('detects infection signs (redness + lump)', () => {
      const anomalies = detectInjectionAnomalies([
        mockEntry({ redness: true, lump: true }),
      ]);
      expect(anomalies.some(a => a.category === 'infection' && a.severity === 'danger')).toBe(true);
    });

    it('detects rotation warnings', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
      const anomalies = detectInjectionAnomalies([
        mockEntry({ zone: 'glute_dorsal', date: fifteenDaysAgo }),
      ]);
      expect(anomalies.some(a => a.category === 'rotation')).toBe(true);
    });

    it('detects high frequency (3+ per zone per week)', () => {
      const today = todayLocalStr();
      const anomalies = detectInjectionAnomalies([
        mockEntry({ zone: 'glute_dorsal', date: today }),
        mockEntry({ zone: 'glute_dorsal', date: today }),
        mockEntry({ zone: 'glute_dorsal', date: today }),
      ]);
      expect(anomalies.some(a => a.category === 'frequency')).toBe(true);
    });

    it('sorts by severity then date', () => {
      const anomalies = detectInjectionAnomalies([
        mockEntry({ painLevel: 2 }),
        mockEntry({ pipLevel: 8 }),
        mockEntry({ redness: true, lump: true }),
      ]);
      expect(anomalies[0].severity).toBe('danger');
    });
  });

  describe('Weekly frequency', () => {
    it('returns 4 weeks of data', () => {
      const result = getWeeklyFrequency([], 4);
      expect(result).toHaveLength(4);
    });

    it('counts entries per week', () => {
      const today = todayLocalStr();
      addInjection(mockEntry({ date: today }));
      addInjection(mockEntry({ date: today }));
      const result = getWeeklyFrequency(getInjectionDiary(), 1);
      expect(result[0].count).toBe(2);
    });
  });

  describe('Dose parsing', () => {
    it('parses ml doses', () => {
      expect(parseDose('0.5 мл')).toEqual({ value: 0.5, unit: 'мл' });
    });

    it('parses mg doses', () => {
      expect(parseDose('250 мг')).toEqual({ value: 250, unit: 'мг' });
    });

    it('parses IU doses', () => {
      expect(parseDose('150 IU')).toEqual({ value: 150, unit: 'IU' });
    });

    it('handles Russian decimal comma', () => {
      expect(parseDose('1,5 мл')).toEqual({ value: 1.5, unit: 'мл' });
    });

    it('returns null for invalid input', () => {
      expect(parseDose('')).toBeNull();
      expect(parseDose('abc')).toBeNull();
      expect(parseDose('0')).toBeNull();
    });
  });

  describe('Migration', () => {
    it('migrates legacy 5-field entry', () => {
      const legacy = { date: '2024-01-15', substance: 'Тест', dose: '1 мл', site: 'Дельта', notes: 'test' };
      const migrated = migrateLegacyEntry(legacy);
      expect(migrated.substance).toBe('Тест');
      expect(migrated.dose).toBe('1 мл');
      expect(migrated.zone).toBe('glute_dorsal');
      expect(migrated.side).toBe('left');
      expect(migrated.volumeMl).toBe(1);
      expect(migrated.needleGauge).toBe('23G');
      expect(migrated.technique).toBe('im');
      expect(migrated.painLevel).toBe(0);
      expect(migrated.notes).toBe('test');
    });

    it('migrates legacy entries in storage', () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify([
        { date: '2024-01-15', substance: 'Тест', dose: '1 мл', site: 'Дельта' },
      ]));
      const migrated = migrateAllLegacyEntries();
      expect(migrated).toHaveLength(1);
      expect(migrated[0].zone).toBe('glute_dorsal');
      expect(migrated[0].id).toContain('legacy_');
    });

    it('does not re-migrate already-migrated entries', () => {
      const entry = mockEntry();
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify([entry]));
      const migrated = migrateAllLegacyEntries();
      expect(migrated).toHaveLength(1);
      expect(migrated[0].id).toBe(entry.id);
    });
  });

  describe('Constants', () => {
    it('INJECTION_ZONES has 15 zones with sides', () => {
      expect(INJECTION_ZONES.length).toBeGreaterThanOrEqual(10);
      const withSide = INJECTION_ZONES.filter(z => z.side !== 'any');
      expect(withSide.length).toBeGreaterThanOrEqual(8);
    });

    it('NEEDLE_GAUGES has common gauges', () => {
      expect(NEEDLE_GAUGES).toContain('23G');
      expect(NEEDLE_GAUGES).toContain('25G');
      expect(NEEDLE_GAUGES).toContain('29G');
    });

    it('TECHNIQUES has IM and subq', () => {
      expect(TECHNIQUES.map(t => t.id)).toContain('im');
      expect(TECHNIQUES.map(t => t.id)).toContain('subq');
    });
  });

  describe('Trend analysis', () => {
    it('returns null for <2 entries', () => {
      expect(getInjectionTrend([mockEntry()])).toBeNull();
      expect(getInjectionTrend([])).toBeNull();
    });

    it('computes trend direction up/down/stable', () => {
      const now = todayLocalStr();
      const old = new Date();
      old.setDate(old.getDate() - 10);
      const oldDate = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}-${String(old.getDate()).padStart(2, '0')}`;
      addInjection(mockEntry({ date: oldDate, pipLevel: 1, painLevel: 1 }));
      addInjection(mockEntry({ date: now, pipLevel: 8, painLevel: 7 }));
      const trend = getInjectionTrend(getInjectionDiary(), 7);
      expect(trend).not.toBeNull();
      expect(trend!.direction).toBe('up');
      expect(trend!.avgPip).toBeGreaterThan(0);
    });

    it('returns stable when delta <0.5', () => {
      const now = todayLocalStr();
      const old = new Date();
      old.setDate(old.getDate() - 14);
      const mid = new Date();
      mid.setDate(mid.getDate() - 7);
      const oldDate = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}-${String(old.getDate()).padStart(2, '0')}`;
      const midDate = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}-${String(mid.getDate()).padStart(2, '0')}`;
      addInjection(mockEntry({ date: oldDate, pipLevel: 3, painLevel: 2 }));
      addInjection(mockEntry({ date: midDate, pipLevel: 3, painLevel: 2 }));
      const trend = getInjectionTrend(getInjectionDiary(), 7);
      expect(trend!.direction).toBe('stable');
    });
  });

  describe('Zone technique matrix', () => {
    it('returns empty for no entries', () => {
      expect(getZoneTechniqueMatrix([])).toEqual([]);
    });

    it('groups by zone and technique', () => {
      addInjection(mockEntry({ zone: 'glute_dorsal', technique: 'im', pipLevel: 2 }));
      addInjection(mockEntry({ zone: 'glute_dorsal', technique: 'im', pipLevel: 4 }));
      addInjection(mockEntry({ zone: 'glute_dorsal', technique: 'subq', pipLevel: 1 }));
      const matrix = getZoneTechniqueMatrix(getInjectionDiary());
      expect(matrix).toHaveLength(2);
      const imRow = matrix.find(r => r.technique === 'im');
      expect(imRow!.avgPip).toBe(3);
      expect(imRow!.count).toBe(2);
    });

    it('sorts by avgPip descending', () => {
      addInjection(mockEntry({ zone: 'deltoid_l', technique: 'im', pipLevel: 8 }));
      addInjection(mockEntry({ zone: 'glute_dorsal', technique: 'im', pipLevel: 1 }));
      const matrix = getZoneTechniqueMatrix(getInjectionDiary());
      expect(matrix[0].avgPip).toBeGreaterThan(matrix[1].avgPip!);
    });
  });

  describe('Repeat last suggestion', () => {
    it('returns null for empty diary', () => {
      expect(getLastInjection([])).toBeNull();
    });

    it('returns last entry fields', () => {
      addInjection(mockEntry({ substance: 'Нандролон', dose: '200 мг', zone: 'deltoid_l' }));
      const last = getLastInjection(getInjectionDiary());
      expect(last!.substance).toBe('Нандролон');
      expect(last!.zone).toBe('deltoid_l');
      expect(last!.volumeMl).toBe(1);
    });
  });

  describe('Storage quota handling', () => {
    it('writeStorage handles quota exceeded by trimming old entries', () => {
      for (let i = 0; i < 400; i++) {
        addInjection(mockEntry({ date: localDateDaysAgo(i % 365), substance: `Sub${i}`, dose: `${i}мг` }));
      }
      expect(getInjectionDiary().length).toBeLessThanOrEqual(365);
    });
  });

  describe('Local date helpers', () => {
    it('localDateDaysAgo returns correct date string', () => {
      const d = localDateDaysAgo(0);
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Injection recommendations', () => {
    it('returns general recommendation for empty diary', () => {
      const recs = getInjectionRecommendations([]);
      expect(recs.length).toBeGreaterThanOrEqual(1);
      expect(recs[0].category).toBe('general');
      expect(recs[0].priority).toBe('low');
    });

    it('flags high infection signs', () => {
      const recs = getInjectionRecommendations([
        mockEntry({ redness: true, lump: true }),
        mockEntry({ redness: true, lump: true }),
      ]);
      expect(recs.some(r => r.category === 'safety' && r.priority === 'high')).toBe(true);
    });

    it('flags high complication rate', () => {
      const entries = Array.from({ length: 10 }, () => mockEntry({ redness: true, lump: false }));
      const recs = getInjectionRecommendations(entries);
      expect(recs.some(r => r.category === 'safety' && r.message.includes('осложнений'))).toBe(true);
    });

    it('flags high PIP zones', () => {
      const recs = getInjectionRecommendations([
        mockEntry({ zone: 'glute_dorsal', pipLevel: 8 }),
        mockEntry({ zone: 'glute_dorsal', pipLevel: 9 }),
      ]);
      expect(recs.some(r => r.category === 'technique' && r.priority === 'high')).toBe(true);
    });

    it('flags long rest zones', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
      const recs = getInjectionRecommendations([mockEntry({ zone: 'glute_dorsal', date: fifteenDaysAgo })]);
      expect(recs.some(r => r.category === 'rotation' && r.message.includes('≥14 дней'))).toBe(true);
    });

    it('flags overused zones', () => {
      const today = todayLocalStr();
      const recs = getInjectionRecommendations([
        mockEntry({ zone: 'glute_dorsal', date: today }),
        mockEntry({ zone: 'glute_dorsal', date: today }),
        mockEntry({ zone: 'glute_dorsal', date: today }),
      ]);
      expect(recs.some(r => r.category === 'rotation' && r.message.includes('переиспользуются'))).toBe(true);
    });

    it('flags rising PIP trend', () => {
      const now = todayLocalStr();
      const old = new Date();
      old.setDate(old.getDate() - 10);
      const oldDate = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}-${String(old.getDate()).padStart(2, '0')}`;
      const recs = getInjectionRecommendations([
        mockEntry({ date: oldDate, pipLevel: 1 }),
        mockEntry({ date: now, pipLevel: 8 }),
      ]);
      expect(recs.some(r => r.category === 'technique' && r.message.toLowerCase().includes('тренд pip растёт'))).toBe(true);
    });

    it('suggests technique improvement when available', () => {
      const recs = getInjectionRecommendations([
        mockEntry({ zone: 'glute_dorsal', technique: 'im', pipLevel: 8 }),
        mockEntry({ zone: 'glute_dorsal', technique: 'im', pipLevel: 9 }),
        mockEntry({ zone: 'glute_dorsal', technique: 'subq', pipLevel: 2 }),
        mockEntry({ zone: 'glute_dorsal', technique: 'subq', pipLevel: 1 }),
      ]);
      expect(recs.some(r => r.category === 'technique' && r.message.includes('техника'))).toBe(true);
    });

    it('flags too many injections today', () => {
      const today = todayLocalStr();
      const entries = Array.from({ length: 3 }, (_, i) => mockEntry({ date: today, zone: `zone_${i}` }));
      const recs = getInjectionRecommendations(entries);
      expect(recs.some(r => r.category === 'schedule' && r.message.includes('сегодня'))).toBe(true);
    });

    it('flags narrow zone usage over time', () => {
      const entries = Array.from({ length: 30 }, () => mockEntry({ zone: 'glute_dorsal' }));
      const recs = getInjectionRecommendations(entries);
      expect(recs.some(r => r.category === 'rotation' && r.message.toLowerCase().includes('используются только'))).toBe(true);
    });

    it('returns positive message when no issues', () => {
      const recs = getInjectionRecommendations([mockEntry({ painLevel: 1, pipLevel: 1 })]);
      expect(recs.some(r => r.message.includes('адекватная'))).toBe(true);
    });

    it('sorts high priority first', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
      const recs = getInjectionRecommendations([
        mockEntry({ zone: 'glute_dorsal', date: fifteenDaysAgo }),
        mockEntry({ redness: true, lump: true }),
      ]);
      expect(recs[0].priority).toBe('high');
    });
  });

  describe('Zone technique advice', () => {
    it('returns null for unknown zone', () => {
      expect(getZoneTechniqueAdvice('unknown_zone')).toBeNull();
    });

    it('returns advice for glute_dorsal', () => {
      const advice = getZoneTechniqueAdvice('glute_dorsal');
      expect(advice).not.toBeNull();
      expect(advice!.needleGauge).toBe('21-23G');
      expect(advice!.needleLength).toBe('1.5" (38 мм)');
      expect(advice!.maxVolumeMl).toBe(5);
      expect(advice!.risk).toBe('Низкий');
    });

    it('returns advice for deltoid_l', () => {
      const advice = getZoneTechniqueAdvice('deltoid_l');
      expect(advice).not.toBeNull();
      expect(advice!.needleGauge).toBe('25-27G');
      expect(advice!.maxVolumeMl).toBe(2);
    });

    it('returns advice for biceps with high risk warning', () => {
      const advice = getZoneTechniqueAdvice('biceps_l');
      expect(advice).not.toBeNull();
      expect(advice!.risk).toBe('Очень высокий');
      expect(advice!.warnings.some(w => w.includes('ОЧЕНЬ ОПАСНО'))).toBe(true);
    });

    it('returns advice for calves with oil warning', () => {
      const advice = getZoneTechniqueAdvice('calves_l');
      expect(advice).not.toBeNull();
      expect(advice!.tips.some(t => t.includes('масляные'))).toBe(true);
    });
  });

  describe('Substance injection advice', () => {
    it('returns null for unknown substance', () => {
      expect(getSubstanceInjectionAdvice('Неизвестный препарат')).toBeNull();
    });

    it('returns advice for BPC-157', () => {
      const advice = getSubstanceInjectionAdvice('BPC-157');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
      expect(advice!.needle).toContain('29-31G');
    });

    it('returns advice for TB-500', () => {
      const advice = getSubstanceInjectionAdvice('TB-500');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
    });

    it('returns advice for GHRP-6', () => {
      const advice = getSubstanceInjectionAdvice('GHRP-6');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
    });

    it('returns advice for CJC-1295', () => {
      const advice = getSubstanceInjectionAdvice('CJC-1295');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
    });

    it('returns advice for Ipamorelin', () => {
      const advice = getSubstanceInjectionAdvice('Ipamorelin');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
    });

    it('returns advice for Semax (intranasal)', () => {
      const advice = getSubstanceInjectionAdvice('Semax');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('интраназально');
    });

    it('returns advice for Cerebrolysin (IV)', () => {
      const advice = getSubstanceInjectionAdvice('Cerebrolysin');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('в/в капельно');
    });

    it('returns advice for Thymalin', () => {
      const advice = getSubstanceInjectionAdvice('Thymalin');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('в/м');
    });

    it('returns advice for Epitalon', () => {
      const advice = getSubstanceInjectionAdvice('Epitalon');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('в/м');
    });

    it('returns advice for GLP-1 agonist', () => {
      const advice = getSubstanceInjectionAdvice('Семаглутид');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
    });

    it('returns advice for Insulin', () => {
      const advice = getSubstanceInjectionAdvice('Инсулин');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
    });

    it('returns advice for HCG', () => {
      const advice = getSubstanceInjectionAdvice('HCG');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к или в/м');
    });

    it('returns advice for emergency adrenaline', () => {
      const advice = getSubstanceInjectionAdvice('Адреналин');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('в/м');
      expect(advice!.notes).toContain('анафилаксии');
    });

    it('returns advice for IV magnesium', () => {
      const advice = getSubstanceInjectionAdvice('Магний в/в');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('в/в');
    });

    it('handles case-insensitive matching', () => {
      const advice = getSubstanceInjectionAdvice('bpc-157');
      expect(advice).not.toBeNull();
      expect(advice!.technique).toBe('п/к');
    });
  });
});
