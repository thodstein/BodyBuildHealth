/**
 * tz-snapshot.test.ts — guard снапшота входа механизм-модели.
 *
 * Аудит 2026-11 (P0): «Риски» 24 часа предпочитали снапшот живым данным и
 * после смены курса показывали СТАРЫЙ набор препаратов. Подпись `sig`
 * (id + доза, без порядка) отсекает чужой снапшот, но старый формат без `sig`
 * обязан приниматься — иначе ломается TzSnapshotRefresh.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  courseSignature,
  readCalcSnapshot,
  writeCalcSnapshot,
  TZ_INPUT_KEY,
  SNAPSHOT_TTL_MS,
} from '../tz-snapshot';
import type { TzSpecInput } from '../risk-engine-tz-spec';

const input = (): TzSpecInput => ({ drugs: [{ drugClass: 'aas', drugName: 'testosterone', dose: 500 }] } as TzSpecInput);

describe('courseSignature', () => {
  it('порядок и дубли не меняют подпись', () => {
    const a = courseSignature([{ id: 'testosterone', dose: 500 }, { id: 'nandrolone', dose: 200 }]);
    const b = courseSignature([{ id: 'nandrolone', dose: 200 }, { id: 'testosterone', dose: 500 }, { id: 'testosterone', dose: 500 }]);
    expect(a).toBe(b);
  });

  it('доза входит в подпись', () => {
    expect(courseSignature([{ id: 'testosterone', dose: 500 }]))
      .not.toBe(courseSignature([{ id: 'testosterone', dose: 250 }]));
  });

  it('алиасы канонизируются: sustanon_250 и sustanon совпадают', () => {
    const a = courseSignature([{ id: 'sustanon_250', dose: 500 }]);
    const b = courseSignature([{ id: 'sustanon', dose: 500 }]);
    expect(a).toBe(b);
  });
});

describe('writeCalcSnapshot / readCalcSnapshot', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('принимает снапшот с совпадающей подписью', () => {
    const sig = courseSignature([{ id: 'testosterone', dose: 500 }]);
    writeCalcSnapshot(input(), sig);
    expect(readCalcSnapshot(sig)).toBeTruthy();
  });

  it('отвергает снапшот другого состава курса', () => {
    writeCalcSnapshot(input(), courseSignature([{ id: 'testosterone', dose: 500 }]));
    const other = courseSignature([{ id: 'trenbolone', dose: 300 }]);
    expect(readCalcSnapshot(other)).toBeNull();
  });

  it('принимает старый формат без sig (обратная совместимость)', () => {
    localStorage.setItem(TZ_INPUT_KEY, JSON.stringify({ input: input(), ts: Date.now() }));
    expect(readCalcSnapshot('любая-подпись')).toBeTruthy();
  });

  it('отвергает протухший снапшот (TTL 24 ч)', () => {
    const sig = courseSignature([{ id: 'testosterone', dose: 500 }]);
    writeCalcSnapshot(input(), sig);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + SNAPSHOT_TTL_MS + 1000);
    expect(readCalcSnapshot(sig)).toBeNull();
  });

  it('не падает на мусоре в хранилище', () => {
    localStorage.setItem(TZ_INPUT_KEY, '{not json');
    expect(readCalcSnapshot('x')).toBeNull();
  });
});
