/**
 * injection-diary-improvements.test.ts — тесты улучшений дневника инъекций:
 * zone в аномалиях, fever, getSuggestedZoneSide, совместимость зоны/объёма,
 * суммарные дозы, replaceInjectionDiary (undo с сохранением id).
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
  todayLocalStr,
  localDateDaysAgo,
  detectInjectionAnomalies,
  getInjectionRecommendations,
  getSuggestedZoneSide,
  getZoneCompatibilityIssues,
  getDoseSummary,
  replaceInjectionDiary,
  migrateLegacyEntry,
  type InjectionEntry,
} from '../injection-diary.engine';

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
    notes: '',
    ...overrides,
  };
}

beforeEach(() => {
  localStorageMock.clear();
});

describe('injection-diary improvements', () => {
  describe('InjectionAnomaly.zone', () => {
    it('pip-аномалия несёт зону', () => {
      const a = detectInjectionAnomalies([mockEntry({ pipLevel: 8, zone: 'deltoid_l' })]);
      expect(a[0].zone).toBe('deltoid_l');
    });

    it('swelling/pain-аномалии несут зону', () => {
      const a = detectInjectionAnomalies([
        mockEntry({ swelling: 6, zone: 'quadriceps_l' }),
        mockEntry({ painLevel: 8, zone: 'quadriceps_l' }),
      ]);
      expect(a.every((x) => x.zone === 'quadriceps_l')).toBe(true);
    });

    it('infection-аномалия несёт зону', () => {
      const a = detectInjectionAnomalies([mockEntry({ redness: true, lump: true, zone: 'pectoral_l' })]);
      expect(a.find((x) => x.category === 'infection')?.zone).toBe('pectoral_l');
    });

    it('rotation/frequency-аномалии несут зону', () => {
      const a = detectInjectionAnomalies([
        mockEntry({ zone: 'glute_dorsal', date: localDateDaysAgo(15) }),
        mockEntry({ zone: 'deltoid_l', date: todayLocalStr() }),
        mockEntry({ zone: 'deltoid_l', date: todayLocalStr() }),
        mockEntry({ zone: 'deltoid_l', date: todayLocalStr() }),
      ]);
      const rotation = a.find((x) => x.category === 'rotation');
      const frequency = a.find((x) => x.category === 'frequency');
      expect(rotation?.zone).toBe('glute_dorsal');
      expect(frequency?.zone).toBe('deltoid_l');
    });
  });

  describe('Fever (температура)', () => {
    it('fever + покраснение/уплотнение → danger infection', () => {
      const a = detectInjectionAnomalies([mockEntry({ fever: true, redness: true, zone: 'glute_dorsal' })]);
      const inf = a.find((x) => x.category === 'infection');
      expect(inf).toBeTruthy();
      expect(inf!.severity).toBe('danger');
      expect(inf!.message).toMatch(/Температура/);
    });

    it('только fever → warn infection', () => {
      const a = detectInjectionAnomalies([mockEntry({ fever: true })]);
      const inf = a.find((x) => x.category === 'infection');
      expect(inf).toBeTruthy();
      expect(inf!.severity).toBe('warn');
      expect(inf!.zone).toBe('glute_dorsal');
    });

    it('без fever нет инфекционных аномалий', () => {
      const a = detectInjectionAnomalies([mockEntry({ redness: true })]);
      expect(a.some((x) => x.category === 'infection' && x.message.includes('Температура'))).toBe(false);
    });

    it('migrateLegacyEntry ставит fever=false', () => {
      const m = migrateLegacyEntry({ date: '2024-01-01', substance: 'Тест', dose: '1 мл', site: 'Ягодица (дорсальная)' });
      expect(m.fever).toBe(false);
    });
  });

  describe('Рекомендации: инфекция по зонам (баг date вместо zone)', () => {
    it('сообщение содержит название зоны, а не дату', () => {
      const recs = getInjectionRecommendations([
        mockEntry({ redness: true, lump: true, zone: 'glute_dorsal' }),
      ]);
      const rec = recs.find((r) => r.category === 'safety' && r.priority === 'high');
      expect(rec).toBeTruthy();
      expect(rec!.message).toMatch(/Ягодица/);
      expect(rec!.message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('getSuggestedZoneSide', () => {
    it('пустой дневник → первая безопасная зона (glute_dorsal, left)', () => {
      const s = getSuggestedZoneSide([]);
      expect(s?.zone).toBe('glute_dorsal');
      expect(s?.side).toBe('left');
    });

    it('предпочитает отдохнувшую использованную зону', () => {
      const s = getSuggestedZoneSide([
        mockEntry({ zone: 'glute_dorsal', side: 'left', date: localDateDaysAgo(20) }),
        mockEntry({ zone: 'deltoid_l', date: todayLocalStr() }),
      ]);
      expect(s?.zone).toBe('glute_dorsal');
      expect(s?.side).toBe('left');
      expect(s?.days).toBeGreaterThanOrEqual(14);
    });

    it('не предлагает свежие зоны (использованные сегодня)', () => {
      const s = getSuggestedZoneSide([
        mockEntry({ zone: 'glute_dorsal', side: 'left', date: todayLocalStr() }),
        mockEntry({ zone: 'glute_dorsal', side: 'right', date: todayLocalStr() }),
      ]);
      expect(s?.zone).not.toBe('glute_dorsal');
      expect(['glute_ventral', 'quadriceps_l', 'quadriceps_r']).toContain(s?.zone);
    });

    it('все зоны свежие → самая долго отдыхавшая пара', () => {
      const s = getSuggestedZoneSide([
        mockEntry({ zone: 'glute_dorsal', side: 'left', date: localDateDaysAgo(1) }),
        mockEntry({ zone: 'quadriceps_l', date: localDateDaysAgo(3) }),
        mockEntry({ zone: 'deltoid_l', date: todayLocalStr() }),
      ]);
      expect(['glute_dorsal_right', 'quadriceps_r']).toContain(`${s?.zone}_${s?.side}`);
    });

    it('не возвращает зоны, использованные сегодня', () => {
      const s = getSuggestedZoneSide([
        mockEntry({ zone: 'glute_ventral', side: 'left', date: localDateDaysAgo(30) }),
        mockEntry({ zone: 'glute_ventral', side: 'right', date: todayLocalStr() }),
      ]);
      expect(`${s?.zone}_${s?.side}`).not.toBe('glute_ventral_right');
    });
  });

  describe('getZoneCompatibilityIssues', () => {
    it('бицепс + масляный в/м → предупреждение (только вода)', () => {
      const issues = getZoneCompatibilityIssues('biceps_l', 'im', 1);
      expect(issues.some((i) => i.includes('только водные'))).toBe(true);
    });

    it('объём выше максимума зоны → предупреждение', () => {
      const issues = getZoneCompatibilityIssues('deltoid_l', 'im', 3);
      expect(issues.some((i) => i.includes('превышает максимум 2 мл'))).toBe(true);
    });

    it('валидная комбинация → нет проблем', () => {
      expect(getZoneCompatibilityIssues('glute_dorsal', 'im', 1)).toEqual([]);
      expect(getZoneCompatibilityIssues('abdominal', 'subq', 1)).toEqual([]);
    });

    it('неизвестная зона → нет проблем', () => {
      expect(getZoneCompatibilityIssues('unknown_zone', 'im', 5)).toEqual([]);
    });
  });

  describe('getDoseSummary', () => {
    it('суммирует дозы по препаратам и единицам', () => {
      const rows = getDoseSummary([
        mockEntry({ substance: 'Тест энантат', dose: '250 мг', date: todayLocalStr() }),
        mockEntry({ substance: 'Тест энантат', dose: '250 мг', date: todayLocalStr() }),
        mockEntry({ substance: 'GH', dose: '4 IU', date: todayLocalStr() }),
      ], 7);
      const test = rows.find((r) => r.substance === 'Тест энантат');
      const gh = rows.find((r) => r.substance === 'GH');
      expect(test?.total).toBe(500);
      expect(test?.count).toBe(2);
      expect(test?.avg).toBe(250);
      expect(gh?.total).toBe(4);
      expect(gh?.unit).toBe('IU');
    });

    it('игнорирует записи вне окна и неразбираемые дозы', () => {
      const rows = getDoseSummary([
        mockEntry({ dose: '250 мг', date: localDateDaysAgo(30) }),
        mockEntry({ dose: 'по инструкции', date: todayLocalStr() }),
      ], 7);
      expect(rows).toEqual([]);
    });
  });

  describe('replaceInjectionDiary', () => {
    it('сохраняет id записей (undo без перегенерации)', () => {
      const a = mockEntry({ id: 'keep_1' });
      const b = mockEntry({ id: 'keep_2' });
      replaceInjectionDiary([a, b]);
      const diary = getInjectionDiary();
      expect(diary.map((e) => e.id)).toEqual(['keep_1', 'keep_2']);
    });

    it('отфильтровывает невалидные записи', () => {
      const valid = mockEntry({ id: 'ok' });
      replaceInjectionDiary([valid, { id: 'bad', date: '', substance: '', zone: '' } as unknown as InjectionEntry]);
      expect(getInjectionDiary()).toHaveLength(1);
      expect(getInjectionDiary()[0].id).toBe('ok');
    });

    it('перезаписывает существующий дневник', () => {
      addInjection(mockEntry({ id: 'old' }));
      replaceInjectionDiary([mockEntry({ id: 'new' })]);
      expect(getInjectionDiary().map((e) => e.id)).toEqual(['new']);
    });
  });
});
