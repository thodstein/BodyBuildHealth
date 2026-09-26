/**
 * cardio-import-provenance.test.ts — импорт не теряет дисциплину и provenance.
 *
 * P2-аудит: спринт 5 добавил sport/source по всей цепочке (парсеры → журнал → UI),
 * но запись в журнал шла через ручную сборку объекта в CardioImportPanel:
 *  - `sport` из файла ВЫБРАСЫВАЛИ → импорт велосипеда сохранялся как 'run';
 *  - `source` не ставился → чип «Импорт» не появлялся (load нормализовал в 'manual');
 *  - saveAll делал N полных перезаписей журнала вместо одного атомарного write.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  importCardioEntries,
  loadCardioLog,
  saveCardioLogEntry,
  type CardioLogEntry,
} from '../cardio-diary.engine';

beforeEach(() => localStorage.clear());

const entry = (over: Partial<CardioLogEntry> = {}): CardioLogEntry => ({
  id: Math.random().toString(36).slice(2),
  date: '2026-09-20',
  type: 'zone2',
  durationMin: 40,
  completed: true,
  ...over,
});

describe('importCardioEntries — граница импорта', () => {
  it('проставляет source=import и updatedAt, даже если их не было', () => {
    importCardioEntries([entry()]);
    const [e] = loadCardioLog();
    expect(e.source).toBe('import');
    expect(typeof e.updatedAt).toBe('string');
    expect(e.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('СОХРАНЯЕТ дисциплину из файла (bike не превращается в run)', () => {
    importCardioEntries([entry({ sport: 'bike' }), entry({ sport: 'row', date: '2026-09-21' })]);
    const sports = loadCardioLog().map(e => e.sport);
    expect(sports).toContain('bike');
    expect(sports).toContain('row');
    expect(sports).not.toContain('run');   // дефект: был бы 'run' по умолчанию
  });

  it('санитизирует мусорную дисциплину (не пишет в журнал сырое значение)', () => {
    importCardioEntries([entry({ sport: 'B I K E!!' as any })]);
    const [e] = loadCardioLog();
    expect(['run', 'bike', 'row', 'other']).toContain(e.sport);
  });

  it('не затирает чужой source=wearable (носимое устройство важнее импорта)', () => {
    importCardioEntries([entry({ source: 'wearable' })]);
    expect(loadCardioLog()[0].source).toBe('wearable');
  });

  it('не переписывает уже проставленный updatedAt (история правок не подменяется)', () => {
    importCardioEntries([entry({ updatedAt: '2026-01-01' })]);
    expect(loadCardioLog()[0].updatedAt).toBe('2026-01-01');
  });

  it('атомарно: один write на всю пачку (localStorage.setItem вызван 1 раз)', () => {
    // В тестовом env localStorage — мок-объект, поэтому шпионим за ЭКЗЕМПЛЯРОМ,
    // а не за Storage.prototype (иначе всегда 0 вызовов — ложный «атомарно»).
    const inst = window.localStorage as unknown as { setItem: (k: string, v: string) => void };
    const spy = vi.spyOn(inst, 'setItem');
    importCardioEntries([entry(), entry({ date: '2026-09-21' }), entry({ date: '2026-09-22' })]);
    const writes = spy.mock.calls.filter(c => c[0] === 'he_cardio_sessions');
    expect(writes).toHaveLength(1);
    spy.mockRestore();
  });

  it('не плодит дубли при повторном импорте того же файла', () => {
    importCardioEntries([entry()]);
    importCardioEntries([entry({ id: 'other-id' })]);
    expect(loadCardioLog()).toHaveLength(1);
  });

  it('сохраняет ручную запись в журнале (import не стирает историю)', () => {
    saveCardioLogEntry(entry({ date: '2026-09-01', source: 'manual' }));
    importCardioEntries([entry({ date: '2026-09-20' })]);
    const log = loadCardioLog();
    expect(log).toHaveLength(2);
    expect(log.find(e => e.date === '2026-09-01')?.source).toBe('manual');
  });

  it('мусор на входе не роняет импорт (пропускаем, а не падаем)', () => {
    const res = importCardioEntries([null as any, undefined as any, entry()]);
    expect(res).toHaveLength(1);
  });
});
