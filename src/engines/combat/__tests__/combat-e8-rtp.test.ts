/**
 * combat-e8-rtp.test.ts — 8.6 градуированный RTP после сотрясения.
 *
 * Ключевое: числа привязаны к PMID, а последовательность ступеней честно
 * помечена как структура приложения — потому что для единоборств
 * опубликованных ступеней нет (PMID 28152320 документирует этот пробел).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  RTP_EARLY_AEROBIC_FROM_H, RTP_EARLY_AEROBIC_TO_H, RTP_TYPICAL_RECOVERY_D,
  RTP_DURATION_MIN_D, RTP_DURATION_TYPICAL_D, RTP_DURATION_MAX_D, RTP_SOURCE,
  RTP_STAGES, RTP_STAGE_BY_ID, COMBAT_RTP_KEY, COMBAT_RTP_CAP, RtpLog,
  normalizeRtp, loadRtp, addRtp, removeRtp, rtpSummary,
} from '../combat-measurements.engine';

const l = (date: string, stage: any, symptomsFree = true): RtpLog => ({ date, stage, symptomsFree });

beforeEach(() => localStorage.clear());

describe('E8.6.1 — константы совпадают с публикациями', () => {
  it('24–72 ч ранняя аэробная (PMID 42379672)', () => {
    expect(RTP_EARLY_AEROBIC_FROM_H).toBe(24);
    expect(RTP_EARLY_AEROBIC_TO_H).toBe(72);
  });

  it('~14 сут восстановление взрослых (PMID 42379672)', () => {
    expect(RTP_TYPICAL_RECOVERY_D).toBe(14);
  });

  it('5–21 сут протокола, типичная 7 (PMID 41557117)', () => {
    expect(RTP_DURATION_MIN_D).toBe(5);
    expect(RTP_DURATION_MAX_D).toBe(21);
    expect(RTP_DURATION_TYPICAL_D).toBe(7);
    expect(RTP_DURATION_MIN_D).toBeLessThan(RTP_DURATION_TYPICAL_D);
    expect(RTP_DURATION_TYPICAL_D).toBeLessThan(RTP_DURATION_MAX_D);
  });

  it('в источнике названы все три PMID, включая пробел по единоборствам', () => {
    expect(RTP_SOURCE).toContain('28152320');
    expect(RTP_SOURCE).toContain('42379672');
    expect(RTP_SOURCE).toContain('41557117');
    expect(RTP_SOURCE).toMatch(/нет — документированный пробел/);
  });
});

describe('E8.6.2 — ступени: структура приложения, а не цитата', () => {
  it('ступени идут от покоя к полному контакту', () => {
    expect(RTP_STAGES.map((s) => s.id)).toEqual([
      'rest_light', 'aerobic', 'strength', 'tech', 'light_contact', 'full',
    ]);
    expect(RTP_STAGE_BY_ID.full.label).toBe('Полный контакт');
  });

  it('у каждой ступени есть подпись и минимальный срок', () => {
    for (const s of RTP_STAGES) {
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.minDays).toBeGreaterThanOrEqual(1);
    }
  });

  it('комментарий в коде прямо признаёт: ступни — структура приложения', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/engines/combat/combat-measurements.engine.ts', 'utf8'));
    const block = src.slice(src.indexOf('8.6 Градуированный RTP'), src.indexOf('8.4 Скрининг'));
    expect(block).toMatch(/СТРУКТУРА ПРИЛОЖЕНИЯ/);
    expect(block).toMatch(/не опубликованы/);
  });
});

describe('E8.6.3 — журнал', () => {
  it('мусор отбрасывается, ступень в норме', () => {
    const out = normalizeRtp([
      l('2026-09-01', 'aerobic'),
      { date: 'bad', stage: 'aerobic' },
      { date: '2026-09-02', stage: 'нет-такой' },
      null,
    ] as any);
    expect(out).toHaveLength(1);
    expect(out[0].stage).toBe('aerobic');
  });

  it('одна дата+ступень = одна запись', () => {
    const out = normalizeRtp([l('2026-09-01', 'aerobic', true), l('2026-09-01', 'aerobic', false)] as any);
    expect(out).toHaveLength(1);
    expect(out[0].symptomsFree).toBe(false);
  });

  it('кап соблюдается и сортировка по дате', () => {
    const many = Array.from({ length: COMBAT_RTP_CAP + 10 }, (_, i) =>
      l(`2026-09-${String((i % 28) + 1).padStart(2, '0')}`, 'aerobic'));
    const out = normalizeRtp(many);
    expect(out.length).toBeLessThanOrEqual(COMBAT_RTP_CAP);
    for (let i = 1; i < out.length; i++) expect(out[i].date >= out[i - 1].date).toBe(true);
  });

  it('запись долетает до хранилища и удаляется по дате+ступени', () => {
    expect(addRtp('2026-09-01', 'rest_light', true)).toBe(true);
    expect(addRtp('2026-09-01', 'aerobic', true)).toBe(true);
    expect(JSON.parse(localStorage.getItem(COMBAT_RTP_KEY)!).length).toBe(2);
    expect(removeRtp('2026-09-01', 'rest_light')).toBe(true);
    expect(loadRtp().map((r) => r.stage)).toEqual(['aerobic']);
  });

  it('битое хранилище не ломает чтение и запись', () => {
    localStorage.setItem(COMBAT_RTP_KEY, '{oops');
    expect(loadRtp()).toEqual([]);
    expect(addRtp('2026-09-02', 'aerobic', true)).toBe(true);
  });
});

describe('E8.6.4 — гейты прогрессии', () => {
  it('без записей — честно предлагает начать с покоя', () => {
    const s = rtpSummary([], '2026-09-05');
    expect(s.status).toBe('no_log');
    expect(s.currentStage?.id).toBe('rest_light');
    expect(s.blocked).toMatch(/покоя/);
  });

  it('пройденная ступень открывает следующую', () => {
    const s = rtpSummary([l('2026-09-01', 'rest_light')], '2026-09-03');
    expect(s.passedStage?.id).toBe('rest_light');
    expect(s.currentStage?.id).toBe('aerobic');
    expect(s.canPass).toBe(true);
  });

  it('нельзя закрыть ступень в тот же день (PMID 41557117)', () => {
    const s = rtpSummary([l('2026-09-01', 'rest_light')], '2026-09-01');
    expect(s.status).toBe('no_same_day');
    expect(s.canPass).toBe(false);
    expect(s.blocked).toMatch(/тот же день/);
  });

  it('симптомы держат текущую ступень', () => {
    const s = rtpSummary([
      l('2026-09-01', 'rest_light', true),
      l('2026-09-03', 'aerobic', false),
    ], '2026-09-05');
    expect(s.status).toBe('symptoms');
    expect(s.canPass).toBe(false);
    expect(s.blocked).toMatch(/симптом/i);
  });

  it('симптомы на одной ступени не закрывают её — ступень остаётся', () => {
    const s = rtpSummary([l('2026-09-01', 'aerobic', false)], '2026-09-05');
    expect(s.status).toBe('symptoms');
    expect(s.passedStage).toBeNull();
    expect(s.currentStage?.id).toBe('rest_light');
  });

  it('пройдены все ступени, кроме последней — ещё есть куда идти', () => {
    const rows = RTP_STAGES.slice(0, -1).map((s, i) =>
      l(`2026-09-${String(i + 1).padStart(2, '0')}`, s.id));
    const s = rtpSummary(rows, '2026-09-20');
    expect(s.status).toBe('stage');
    expect(s.currentStage?.id).toBe('full');
  });

  it('пройден и полный контакт — протокол закрыт', () => {
    const rows = RTP_STAGES.map((s, i) =>
      l(`2026-09-${String(i + 1).padStart(2, '0')}`, s.id));
    const s = rtpSummary(rows, '2026-09-20');
    expect(s.status).toBe('complete');
    expect(s.currentStage).toBeNull();
    expect(s.blocked).toMatch(/пройден/i);
  });

  it('в сводке всегда видно окно протокола и источник', () => {
    const s = rtpSummary([], '2026-09-05');
    expect(s.windowNote).toMatch(/5–21/);
    expect(s.windowNote).toMatch(/~14/);
    expect(s.source).toBe(RTP_SOURCE);
  });
});
