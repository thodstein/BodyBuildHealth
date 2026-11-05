import { describe, expect, it } from 'vitest';
import {
  COACH_AUDIT_KEY,
  COACH_AUDIT_MAX,
  addCoachAuditEvent,
  auditLabel,
  emptyCoachAudit,
  mergeCoachAudit,
  parseCoachAudit,
  readCoachAudit,
  recentAudit,
  writeCoachAudit,
} from '../coach-audit.engine';

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    dump: () => map,
  };
};

describe('журнал действий', () => {
  it('пишет только вид события, время и id атлета — без имён и текстов', () => {
    const store = addCoachAuditEvent(emptyCoachAudit(), 'program-issued', {
      athleteId: 'a1',
      id: 'e1',
      now: '2026-11-05T10:00:00.000Z',
    });
    expect(store.items).toEqual([
      { id: 'e1', kind: 'program-issued', at: '2026-11-05T10:00:00.000Z', athleteId: 'a1' },
    ]);
    const json = JSON.stringify(store);
    expect(json).not.toContain('Иван');
  });

  it('последние события идут первыми', () => {
    let s = emptyCoachAudit();
    s = addCoachAuditEvent(s, 'athlete-added', { id: 'e1', now: '2026-11-01T10:00:00.000Z' });
    s = addCoachAuditEvent(s, 'program-issued', { id: 'e2', now: '2026-11-02T10:00:00.000Z' });
    expect(recentAudit(s).map(e => e.id)).toEqual(['e2', 'e1']);
  });

  it('хвост ограничен: старые события вытесняются, свежие остаются', () => {
    let s = emptyCoachAudit();
    for (let i = 0; i < COACH_AUDIT_MAX + 3; i++) {
      s = addCoachAuditEvent(s, 'locked', { id: `e${i}`, now: `2026-11-05T10:00:${String(i % 60).padStart(2, '0')}.000Z` });
    }
    expect(s.items).toHaveLength(COACH_AUDIT_MAX);
    expect(s.items[s.items.length - 1].id).toBe(`e${COACH_AUDIT_MAX + 2}`);
  });

  it('битый JSON и неизвестные события не ломают чтение', () => {
    expect(parseCoachAudit('{oops').items).toEqual([]);
    const parsed = parseCoachAudit(
      JSON.stringify({ version: 1, items: [{ id: 'x', kind: 'unknown', at: '' }, { id: 'y', kind: 'locked', at: 't' }] }),
    );
    expect(parsed.items.map(e => e.id)).toEqual(['y']);
  });

  it('запись/чтение через хранилище и отказ хранилища не роняют экран', () => {
    const storage = memory();
    writeCoachAudit(storage, addCoachAuditEvent(emptyCoachAudit(), 'locked', { id: 'e1' }));
    expect(storage.dump().has(COACH_AUDIT_KEY)).toBe(true);
    expect(readCoachAudit(storage).items).toHaveLength(1);
    const throwing = { setItem: () => { throw new Error('quota'); }, getItem: () => { throw new Error('boom'); } };
    expect(() => writeCoachAudit(throwing, emptyCoachAudit())).not.toThrow();
    expect(readCoachAudit(throwing).items).toEqual([]);
  });

  it('подписи событий человеческие', () => {
    expect(auditLabel('copy-imported')).toContain('восстановлен');
    expect(auditLabel('pin-enabled')).toContain('PIN');
  });
});

describe('слияние журналов с двух устройств', () => {
  const one = (id: string, at: string) => ({ id, kind: 'locked' as const, at, athleteId: null });

  it('объединяет события без дублей и сортирует по времени', () => {
    const local = JSON.stringify({ version: 1, items: [one('e2', '2026-11-05T11:00:00.000Z'), one('e1', '2026-11-05T10:00:00.000Z')] });
    const remote = JSON.stringify({ version: 1, items: [one('e3', '2026-11-05T12:00:00.000Z'), one('e2', '2026-11-05T11:00:00.000Z')] });
    const merged = mergeCoachAudit(local, remote);
    expect(merged.items.map(e => e.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('битая сторона не мешает второй', () => {
    const remote = JSON.stringify({ version: 1, items: [one('e9', '2026-11-05T12:00:00.000Z')] });
    expect(mergeCoachAudit('{oops', remote).items.map(e => e.id)).toEqual(['e9']);
    expect(mergeCoachAudit(null, null).items).toEqual([]);
  });

  it('объединённый журнал держит потолок, отбрасывая самые старые', () => {
    const many = (prefix: string, from: number) =>
      JSON.stringify({
        version: 1,
        items: Array.from({ length: COACH_AUDIT_MAX }, (_, i) => one(`${prefix}${i}`, `2026-11-05T${String(Math.floor((from + i) / 3600) % 24).padStart(2, '0')}:${String(Math.floor(((from + i) % 3600) / 60)).padStart(2, '0')}:00.000Z`)),
      });
    const merged = mergeCoachAudit(many('a', 0), many('b', COACH_AUDIT_MAX));
    expect(merged.items).toHaveLength(COACH_AUDIT_MAX);
    expect(merged.items[merged.items.length - 1].id).toBe(`b${COACH_AUDIT_MAX - 1}`);
  });
});
