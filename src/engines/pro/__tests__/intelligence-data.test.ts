import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadSRPESessions,
  saveSRPESession,
  updateSRPESession,
  deleteSRPESession,
  importSRPEFromDiary,
} from '../srpe-store';
import { buildIntelCsv, buildIntelHtml, buildIntelDeloadIcs, csvCell } from '../intelligence-export.engine';

beforeEach(() => { try { localStorage.removeItem('he_srpe_sessions'); } catch { /* noop */ } });

describe('P5 sRPE: правка/удаление/импорт', () => {
  it('update правит запись с тем же клампом, что save', () => {
    saveSRPESession({ date: '2026-07-01', sRPE: 7, durationMin: 60 });
    const arr = updateSRPESession(0, { sRPE: 99, durationMin: -5 });
    expect(arr[0]).toEqual({ date: '2026-07-01', sRPE: 10, durationMin: 1 });
    expect(loadSRPESessions()[0].sRPE).toBe(10);
  });

  it('update мимо индекса — массив цел', () => {
    saveSRPESession({ date: '2026-07-01', sRPE: 7, durationMin: 60 });
    expect(updateSRPESession(5, { sRPE: 9 })).toHaveLength(1);
    expect(loadSRPESessions()[0].sRPE).toBe(7);
  });

  it('delete удаляет ровно одну', () => {
    saveSRPESession({ date: '2026-07-01', sRPE: 7, durationMin: 60 });
    saveSRPESession({ date: '2026-07-02', sRPE: 8, durationMin: 60 });
    expect(deleteSRPESession(0)).toHaveLength(1);
    expect(loadSRPESessions()[0].date).toBe('2026-07-02');
  });

  it('import из дневника: дедуп + пропуск мусора', () => {
    saveSRPESession({ date: '2026-07-01', sRPE: 7, durationMin: 60 });
    const { added, sessions } = importSRPEFromDiary([
      { date: '2026-07-01', overallRPE: 7, durationMin: 60 }, // дубль
      { date: '2026-07-02', overallRPE: 8, durationMin: 75 },
      { date: '', overallRPE: 8, durationMin: 60 }, // мусор
      { date: '2026-07-03', durationMin: 60 }, // без RPE
    ]);
    expect(added).toBe(1);
    expect(sessions).toHaveLength(2);
    expect(sessions[1]).toEqual({ date: '2026-07-02', sRPE: 8, durationMin: 75 });
  });
});

describe('P5 экспорт', () => {
  const sessions = [{ date: '2026-07-01', sRPE: 7, durationMin: 60 }];
  const summary = { acwr: '1.10', acwrZone: 'Оптимум', recovery: '70 · Хорошо', pri: '75 · Хорошее', volumeMult: 1, rirShift: 0, deload: false, forecast: '72', generatedAt: '2026-09-12' };

  it('CSV: BOM + шапка + AU', () => {
    const csv = buildIntelCsv(sessions);
    expect(csv.startsWith('\uFEFFdate,sRPE')).toBe(true);
    expect(csv).toContain('2026-07-01,7,60,420');
  });

  it('csvCell гасит формульные инъекции', () => {
    expect(csvCell('=cmd|calc')).toBe("'=cmd|calc");
    expect(csvCell('норма')).toBe('норма');
  });

  it('HTML: сводка + таблица + XSS-эскейп', () => {
    const html = buildIntelHtml(sessions, { ...summary, acwrZone: '<Оптимум>' });
    expect(html).toContain('ACWR 1.10');
    expect(html).toContain('&lt;Оптимум&gt;');
    expect(html).not.toContain('<Оптимум>');
  });

  it('ICS: только при deload, понедельник-воскресенье', () => {
    expect(buildIntelDeloadIcs(false)).toBeNull();
    const ics = buildIntelDeloadIcs(true, new Date('2026-09-12T12:00:00'))!;
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('Deload');
  });
});
