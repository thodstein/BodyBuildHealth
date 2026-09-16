import { describe, it, expect, beforeEach } from 'vitest';
import { armliftMovementFlashLines, readArmliftMovementPack, ARMLIFT_MOVEMENT_PACK_KEY } from '../armlift-movement-lines.engine';

const full = () => ({
  diagTimelinePhase: { id: 'mid', label: 'Протяжка', weakLinks: ['fingers'] },
  diagAttemptPlan: { implement: 'rolling_thunder', opener: 92.5, second: 97.5, third: 102.5 },
  diagHandNote: 'Размах <20 см — RT 60 мм дорогие',
  diagHoldCurve: { curve: 'peak_gap', note: 'Пик плывёт' },
  diagConditionsNote: 'Замер тренировочный: жидкий мел',
  diagVideoNote: 'Трек: гуляние 12 см — протяжка',
  diagPainZones: ['thumb'],
  diagPainNote: 'Большой болит: щипок стоп, support и crush можно',
});

describe('PRO-6 M10: строки движения из моста', () => {
  it('пусто/мусор — тихо', () => {
    expect(armliftMovementFlashLines(null)).toEqual({ lines: [], painStop: false });
    expect(armliftMovementFlashLines({})).toEqual({ lines: [], painStop: false });
    expect(armliftMovementFlashLines('zzz')).toEqual({ lines: [], painStop: false });
  });
  it('полный пейлоад — 7 строк', () => {
    const r = armliftMovementFlashLines(full());
    expect(r.lines.length).toBe(7);
    expect(r.lines[0]).toBe('фаза срыва: Протяжка');
    expect(r.lines[1]).toBe('попытки: 92.5/97.5/102.5');
    expect(r.painStop).toBe(false);
  });
  it('красные флаги — painStop + ⛔', () => {
    const r = armliftMovementFlashLines({ diagPainNote: 'Стоп: онемение — к врачу' });
    expect(r.painStop).toBe(true);
    expect(r.lines).toEqual(['⛔ Стоп: онемение — к врачу']);
  });
  it('битые попытки (нули/мусор) — тихо', () => {
    expect(armliftMovementFlashLines({ diagAttemptPlan: { opener: 0, second: 'x', third: null } }).lines).toEqual([]);
  });
  it('фаза без label — тихо', () => {
    expect(armliftMovementFlashLines({ diagTimelinePhase: { id: 'mid' } }).lines).toEqual([]);
  });
  it('пустые строки игнорятся', () => {
    expect(armliftMovementFlashLines({ diagHandNote: '   ', diagVideoNote: '' }).lines).toEqual([]);
  });
});

describe('PRO-6 M12: единый ридер пака', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });
  it('нет ключа — []', () => {
    expect(readArmliftMovementPack()).toEqual([]);
  });
  it('пак со строками — строки (кап 8)', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `строка ${i}`);
    localStorage.setItem(ARMLIFT_MOVEMENT_PACK_KEY, JSON.stringify({ items: [], spec: [], movement: { lines } }));
    const got = readArmliftMovementPack();
    expect(got.length).toBe(8);
    expect(got[0]).toBe('строка 0');
  });
  it('битый стор/мусор — []', () => {
    localStorage.setItem(ARMLIFT_MOVEMENT_PACK_KEY, 'битое{{{');
    expect(readArmliftMovementPack()).toEqual([]);
    localStorage.setItem(ARMLIFT_MOVEMENT_PACK_KEY, JSON.stringify({ movement: { lines: ['ok', 42, '', null] } }));
    expect(readArmliftMovementPack()).toEqual(['ok']);
  });
});
