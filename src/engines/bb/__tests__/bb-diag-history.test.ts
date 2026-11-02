/**
 * bb-diag-history.test.ts — BB-D-39: история балла диагностики.
 *
 * Локи: дедуп по дате (не раздувается от ре-рендеров), тренд честный (без
 * второго замера — «мало данных», а не «±0»), закрытые/новые floor-ы видны.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DIAG_HISTORY_KEY, DIAG_HISTORY_MAX,
  readDiagHistory, appendDiagHistory, diagHistoryTrend,
} from '../bb-diag-history.engine';

const e = (date: string, score: number, floors: string[] = []) => ({
  date, score, level: score >= 80 ? 'ok' : 'warn', floors, weakZones: [],
});

describe('BB-D-39 история диагностики', () => {
  beforeEach(() => { localStorage.clear(); });

  it('запись за тот же день перезаписывается, а не дублируется', () => {
    appendDiagHistory(e('2026-11-01', 62));
    appendDiagHistory(e('2026-11-01', 71));
    const list = readDiagHistory();
    expect(list).toHaveLength(1);
    expect(list[0].score).toBe(71);
  });

  it('история ограничена 60 записями (старое уходит, свежее остаётся)', () => {
    for (let i = 1; i <= DIAG_HISTORY_MAX + 10; i++) {
      const d = `2026-${String(Math.ceil(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      appendDiagHistory(e(d, 50 + (i % 30)));
    }
    expect(readDiagHistory().length).toBeLessThanOrEqual(DIAG_HISTORY_MAX);
  });

  it('битые записи отбрасываются (не ломают тренд)', () => {
    localStorage.setItem(DIAG_HISTORY_KEY, JSON.stringify([{ date: '2026-11-01', score: 60 }, { foo: 1 }, 'x', null, { date: 'bad', score: 70 }]));
    const list = readDiagHistory();
    expect(list).toHaveLength(1);
    expect(list[0].date).toBe('2026-11-01');
  });

  it('без истории — «пусто», с одной записью — «первый замер», без дельты', () => {
    expect(diagHistoryTrend([]).delta).toBeNull();
    expect(diagHistoryTrend([]).text).toMatch(/пусто/);
    const one = diagHistoryTrend([e('2026-11-01', 64)]);
    expect(one.delta).toBeNull();
    expect(one.text).toMatch(/первый замер/);
  });

  it('тренд: дельта к предыдущему замеру + закрытые и новые floor-ы', () => {
    const t = diagHistoryTrend([e('2026-10-01', 58, ['ACWR']), e('2026-11-01', 71, ['Сон'])]);
    expect(t.delta).toBe(13);
    expect(t.closedFloors).toEqual(['ACWR']);
    expect(t.newFloors).toEqual(['Сон']);
    expect(t.text).toContain('71/100');
    expect(t.text).toContain('+13');
    expect(t.text).toContain('закрыто: ACWR');
    expect(t.text).toContain('новые ограничения: Сон');
  });

  it('равный балл — «±0», а не «+0» и не пусто', () => {
    const t = diagHistoryTrend([e('2026-10-01', 70), e('2026-11-01', 70)]);
    expect(t.delta).toBe(0);
    expect(t.text).toContain('±0');
  });
});
