/**
 * Тесты восстановления дневников из бэкапа (diary-backup.engine.ts):
 * мерж по ключу, только отсутствующие записи, мусорные данные пропускаются.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { restoreDiaryExtras } from '../diary-backup.engine';
import { loadWarmupLog, upsertWarmupLog, warmupLogForDate } from '../warmup.engine';
import { loadCooldownLog, upsertCooldownLog, cooldownLogForDate } from '../cooldown.engine';
import { loadCheckins, upsertCheckin } from '../mindset-protocol.engine';
import { loadMobilityCheckins, upsertMobilityCheckin } from '../mobility-protocol.engine';

describe('restoreDiaryExtras', () => {
  beforeEach(() => localStorage.clear());

  it('пустой бэкап → 0 везде', () => {
    expect(restoreDiaryExtras({})).toEqual({ warmup: 0, cooldown: 0, mind: 0, mob: 0 });
  });

  it('восстанавливает разминку/заминку/психо/мобильность из бэкапа', () => {
    const counts = restoreDiaryExtras({
      warmupDiary: [{ date: '2026-07-01', done: true, quality: 4 }, { date: '2026-07-02', done: false, skippedReason: 'устал' }],
      cooldownDiary: [{ date: '2026-07-01', done: true, quality: 5 }],
      mindsetChecks: [{ date: '2026-07-01', confidence: 4, arousal: 3, focus: 5, protocolFollowed: true }],
      mobilityChecks: [{ date: '2026-07-01', done: true, romScore: 4 }],
    });
    expect(counts).toEqual({ warmup: 2, cooldown: 1, mind: 1, mob: 1 });
    expect(loadWarmupLog().length).toBe(2);
    expect(warmupLogForDate('2026-07-02')?.skippedReason).toBe('устал');
    expect(loadCooldownLog().length).toBe(1);
    expect(cooldownLogForDate('2026-07-01')?.quality).toBe(5);
    expect(loadCheckins().length).toBe(1);
    expect(loadMobilityCheckins().length).toBe(1);
  });

  it('существующие записи не дублируются (мерж по ключу)', () => {
    upsertWarmupLog({ date: '2026-07-01', done: true, quality: 3 });
    upsertCooldownLog({ date: '2026-07-01', done: true, quality: 3 });
    upsertCheckin({ date: '2026-07-01', confidence: 2, arousal: 2, focus: 2, protocolFollowed: null });
    upsertMobilityCheckin({ date: '2026-07-01', done: true, romScore: 3 });
    const counts = restoreDiaryExtras({
      warmupDiary: [{ date: '2026-07-01', done: true, quality: 5 }, { date: '2026-07-02', done: true, quality: 4 }],
      cooldownDiary: [{ date: '2026-07-01', done: true, quality: 5 }, { date: '2026-07-02', done: true, quality: 4 }],
      mindsetChecks: [{ date: '2026-07-01', sessionId: 'w1', confidence: 4, arousal: 3, focus: 4, protocolFollowed: true }, { date: '2026-07-01', confidence: 2, arousal: 2, focus: 2, protocolFollowed: null }],
      mobilityChecks: [{ date: '2026-07-01', done: true, romScore: 5 }],
    });
    // добавлены: разминка 07-02 (1), заминка 07-02 (1), психо с sessionId w1 (1), мобильность — нет новых
    expect(counts).toEqual({ warmup: 1, cooldown: 1, mind: 1, mob: 0 });
    expect(loadWarmupLog().length).toBe(2);
    expect(warmupLogForDate('2026-07-01')?.quality).toBe(3); // оригинал не перезаписан
    expect(loadCooldownLog().length).toBe(2);
    expect(cooldownLogForDate('2026-07-01')?.quality).toBe(3);
    expect(loadCheckins().length).toBe(2);
    expect(loadMobilityCheckins().length).toBe(1);
  });

  it('мусорные/невалидные записи пропускаются', () => {
    const counts = restoreDiaryExtras({
      warmupDiary: [null, { date: 'не дата', done: true }, { date: '2026-07-01', done: true }],
      cooldownDiary: [null, { date: 'не дата', done: true }, { date: '2026-07-01', done: true }],
      mindsetChecks: [42, { date: '2026-07-01', confidence: 'x' as any, arousal: 3, focus: 4, protocolFollowed: true }],
      mobilityChecks: [{ date: '2026-07-01', done: true }, { date: '2026-07-01', done: false }],
    });
    expect(counts.warmup).toBe(1);
    expect(counts.cooldown).toBe(1);
    expect(counts.mind).toBe(1);
    expect(counts.mob).toBe(1);
    expect(loadCheckins()[0].confidence).toBe(3); // fallback при невалидном
  });
});
