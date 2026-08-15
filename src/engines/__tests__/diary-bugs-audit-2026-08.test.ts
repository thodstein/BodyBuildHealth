/**
 * diary-bugs-audit-2026-08.test.ts — регрессионные тесты аудита дневников (Aug 15 2026):
 *  - health-diary.engine: единый DESC-порядок + кап 365 САМЫХ НОВЫХ
 *  - diary-helpers: локальные ключи недель (UTC-баг группировки)
 *  - weight-insights: csvEscape защита от формульной инъекции (Excel)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUnifiedHealthEntries,
  saveUnifiedHealthEntries,
  addUnifiedHealthEntry,
  resetUnifiedHealthDiary,
  type UnifiedHealthEntry,
} from '../health-diary.engine';
import { buildWeeklyHistogram, groupEntriesByPeriod, toLocalIso } from '../../ui/screens/ProfileScreen_v2/diary-helpers';
import { csvEscape } from '../../ui/screens/ProfileScreen_v2/diaries/WeightDiary/weight-insights';

const mk = (date: string, painScore = 1): UnifiedHealthEntry => ({
  id: `id_${date}`,
  date,
  pain: { zones: { shoulders: painScore }, totalScore: painScore },
  symptoms: [],
  neuro: null,
  acne: null,
  hemato: null,
  createdAt: '',
  updatedAt: '',
});

describe('health-diary.engine — единый порядок DESC', () => {
  beforeEach(() => resetUnifiedHealthDiary());

  it('saveUnifiedHealthEntries нормализует ASC-массив в DESC', () => {
    saveUnifiedHealthEntries([mk('2026-01-01'), mk('2026-03-01'), mk('2026-02-01')]);
    const loaded = getUnifiedHealthEntries();
    expect(loaded.map((e) => e.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });

  it('getUnifiedHealthEntries возвращает DESC независимо от порядка хранения', () => {
    // Хранение вручную в ASC (имитация старого quick-add пути)
    localStorage.setItem('he_health_diary', JSON.stringify([mk('2026-01-01'), mk('2026-03-01')]));
    localStorage.setItem('he_health_diary_migrated_v1', '1');
    const loaded = getUnifiedHealthEntries();
    expect(loaded[0].date).toBe('2026-03-01');
  });

  it('кап 365: выбрасываются САМЫЕ СТАРЫЕ, новейшие сохраняются', () => {
    const many: UnifiedHealthEntry[] = [];
    const base = new Date(2025, 11, 1); // 1 декабря 2025
    for (let i = 0; i < 400; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      many.push(mk(date, 1));
    }
    // Порядок входа — DESC (как страница HealthDiary); кап должен оставить новейшие 365.
    many.sort((a, b) => b.date.localeCompare(a.date));
    saveUnifiedHealthEntries(many);
    const loaded = getUnifiedHealthEntries();
    expect(loaded.length).toBe(365);
    // Все оставшиеся — новейшие (последние 365 из 400)
    const newest = many.slice(0, 365).map((e) => e.date).sort().reverse();
    expect(loaded.map((e) => e.date)).toEqual(newest);
  });

  it('кап 365 с ASC-входом тоже оставляет новейшие', () => {
    const many: UnifiedHealthEntry[] = [];
    const base = new Date(2025, 11, 1);
    for (let i = 0; i < 400; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      many.push(mk(date, 1));
    }
    many.sort((a, b) => a.date.localeCompare(b.date)); // ASC (старый quick-add путь)
    saveUnifiedHealthEntries(many);
    const loaded = getUnifiedHealthEntries();
    expect(loaded.length).toBe(365);
    const newest = [...many].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365).map((e) => e.date);
    expect(loaded.map((e) => e.date)).toEqual(newest);
  });

  it('addUnifiedHealthEntry сохраняет DESC', () => {
    addUnifiedHealthEntry({ date: '2026-01-01', pain: null, symptoms: [], neuro: null, acne: null, hemato: null });
    addUnifiedHealthEntry({ date: '2026-01-03', pain: null, symptoms: [], neuro: null, acne: null, hemato: null });
    const loaded = getUnifiedHealthEntries();
    expect(loaded.map((e) => e.date)).toEqual(['2026-01-03', '2026-01-01']);
  });
});

describe('diary-helpers — локальные ключи недель (UTC-баг)', () => {
  it('toLocalIso форматирует локальную дату без UTC-сдвига', () => {
    // 17 августа 2026 — понедельник (зависит от локали TZ только в части getDay)
    expect(toLocalIso(new Date(2026, 7, 17, 3, 30))).toBe('2026-08-17');
    expect(toLocalIso(new Date(2026, 7, 17, 23, 59))).toBe('2026-08-17');
  });

  it('buildWeeklyHistogram: ключи недель — локальные понедельники, записи внутри своей недели', () => {
    const values = [
      { date: '2026-08-17', value: 80 }, // Пн
      { date: '2026-08-19', value: 81 }, // Ср
      { date: '2026-08-23', value: 82 }, // Вс
      { date: '2026-08-24', value: 83 }, // Пн (следующая неделя)
    ];
    const weeks = buildWeeklyHistogram(values);
    expect(weeks.length).toBe(2);
    for (const w of weeks) {
      // Ключ — локальный понедельник
      const d = new Date(`${w.weekStart}T00:00:00`);
      expect(d.getDay()).toBe(1);
    }
    expect(weeks[0].weekStart <= '2026-08-17').toBe(true);
    expect(weeks[1].weekStart > weeks[0].weekStart).toBe(true);
  });

  it('groupEntriesByPeriod: недели без сдвига в прошлую неделю (Пн в своей неделе)', () => {
    const entries = [
      { date: '2026-08-17', fields: [] }, // Пн
      { date: '2026-08-22', fields: [] }, // Сб
    ];
    const groups = groupEntriesByPeriod(entries as any);
    expect(groups.length).toBe(1);
    expect(groups[0].entries.length).toBe(2);
  });
});

describe('weight-insights csvEscape — защита от формульной инъекции', () => {
  it('обычные значения не меняются', () => {
    expect(csvEscape('81.2')).toBe('81.2');
    expect(csvEscape('заметка')).toBe('заметка');
  });
  it('поля с разделителями оборачиваются в кавычки', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });
  it('поля, начинающиеся с = + - @, получают префикс «\'»', () => {
    expect(csvEscape('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvEscape('+cmd')).toBe("'+cmd");
    expect(csvEscape('-1')).toBe("'-1");
    expect(csvEscape('@sum')).toBe("'@sum");
    expect(csvEscape('=1+1')).toBe("'=1+1");
  });
  it('null/undefined → пустая строка', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
});
