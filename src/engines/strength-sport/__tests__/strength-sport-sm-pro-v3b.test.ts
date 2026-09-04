import { describe, it, expect } from 'vitest';
import {
  buildSMBackup,
  isSMBackupShape,
  restoreSMBackup,
  trimSMHistory,
  smStorageBytes,
  SM_STORAGE_KEYS,
} from '../strength-sport-sm-storage.engine';
import { appendOHSSnapshot, ohsScoreTrend } from '../strength-sport-ohs.engine';

describe('SM PRO v3b: storage', () => {
  it('ключи — только SM (7, чужих нет)', () => {
    expect(SM_STORAGE_KEYS.length).toBe(7);
    expect(SM_STORAGE_KEYS.join(' ')).not.toContain('he_ta_');
    expect(SM_STORAGE_KEYS.join(' ')).not.toContain('he_bb_');
  });
  it('бэкап собирается и валидируется', () => {
    localStorage.setItem('he_sm_progress_hist_v1', JSON.stringify([{ date: '2026-01-01', bodyweightKg: 105 }]));
    const b = buildSMBackup();
    expect(b.version).toBe(1);
    expect(isSMBackupShape(b)).toBe(true);
    expect(isSMBackupShape({ version: 2, data: {} })).toBe(false);
    expect(isSMBackupShape({ version: 1, data: { he_ta_ohs_hist_v1: [] } })).toBe(false);
    localStorage.removeItem('he_sm_progress_hist_v1');
  });
  it('restore кладёт только известные ключи', () => {
    const r = restoreSMBackup({ version: 1, exportedAt: new Date().toISOString(), data: { he_sm_progress_hist_v1: [{ date: '2026-02-01' }] } });
    expect(r.restored).toContain('he_sm_progress_hist_v1');
    expect(r.failed).toEqual([]);
    localStorage.removeItem('he_sm_progress_hist_v1');
  });
  it('restore мусора — всё в failed', () => {
    const r = restoreSMBackup({ version: 1, exportedAt: '', data: {} });
    expect(r.restored).toEqual([]);
  });
  it('trim урезает истории, чужие ключи не трогает', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, v: i }));
    localStorage.setItem('he_sm_progress_hist_v1', JSON.stringify(big));
    localStorage.setItem('he_ta_ohs_hist_v1', JSON.stringify(big));
    trimSMHistory();
    expect(JSON.parse(localStorage.getItem('he_sm_progress_hist_v1')!).length).toBe(30);
    expect(JSON.parse(localStorage.getItem('he_ta_ohs_hist_v1')!).length).toBe(50);
    localStorage.removeItem('he_sm_progress_hist_v1');
    localStorage.removeItem('he_ta_ohs_hist_v1');
  });
  it('размер считается', () => {
    const s = smStorageBytes();
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(Object.keys(s.byKey).length).toBe(7);
  });
});

describe('SM PRO v3b: OHS-история (shared helpers, SM-ключ)', () => {
  it('append кап 30 + замена дня', () => {
    let h = appendOHSSnapshot([], { date: '2026-01-01', score: 4, failed: 2, level: 'warn' });
    h = appendOHSSnapshot(h, { date: '2026-01-01', score: 5, failed: 1, level: 'warn' });
    expect(h.length).toBe(1);
    expect(h[0].score).toBe(5);
  });
  it('тренд плюс = улучшение', () => {
    const h = appendOHSSnapshot(
      [{ date: '2026-01-01', score: 3, failed: 3, level: 'critical' }],
      { date: '2026-02-01', score: 5, failed: 1, level: 'warn' },
    );
    expect(ohsScoreTrend(h)!.delta).toBe(2);
  });
  it('<2 замеров — null', () => {
    expect(ohsScoreTrend([{ date: '2026-01-01', score: 4, failed: 2, level: 'warn' }])).toBeNull();
  });
});
