/**
 * planner-ab-compare.test.ts — волна-3: A/B двух планов питания.
 * Снапшот дня (meals/totals/notes) → localStorage (слот A/B) → diff B относительно A:
 * КБЖУ-дельты, приёмы (по подписи), состав (+, −), заметки движка. Битый сторедж — пусто.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  snapshotFromDayPlan, loadAbSnapshots, saveAbSnapshot, removeAbSnapshot,
  diffAbSnapshots, AB_STORAGE_KEY,
} from '../planner-ab-compare';

const makeStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    _map: m,
  };
};

const plan = (over: any = {}) => ({
  totals: { kcal: 3000, p: 180, f: 80, c: 400, fiber: 35 },
  meals: [
    {
      label: 'Завтрак', type: 'breakfast', time: '08:00',
      totals: { kcal: 600, p: 40, f: 20, c: 70 },
      items: [
        { id: 'oats_dry', name: 'Овсянка', amount: 80, p: 10, f: 5, c: 48, kcal: 300 },
        { id: 'egg_whole', name: 'Яйцо', amount: 60, p: 8, f: 7, c: 1, kcal: 96 },
      ],
    },
    {
      label: 'Обед', type: 'lunch', time: '13:00',
      totals: { kcal: 900, p: 60, f: 25, c: 110 },
      items: [
        { id: 'chicken_breast', name: 'Курица', amount: 150, p: 36, f: 3, c: 0, kcal: 170 },
        { id: 'rice_white', name: 'Рис', amount: 250, p: 7, f: 1, c: 70, kcal: 325 },
      ],
    },
  ],
  notes: ['✅ Клетчатка: 35г / 35г', '➕ Финальный добор сходимости: +100 ккал'],
  ...over,
});

describe('snapshotFromDayPlan', () => {
  it('снимает тоталы/приёмы/позиции/заметки', () => {
    const snap = snapshotFromDayPlan('A', plan() as any, { name: 'День 1' })!;
    expect(snap.slot).toBe('A');
    expect(snap.name).toBe('День 1');
    expect(snap.totals.kcal).toBe(3000);
    expect(snap.meals).toHaveLength(2);
    expect(snap.meals[0].items[0].id).toBe('oats_dry');
    expect(snap.notes.length).toBe(2);
    expect(snap.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('пустой/битый день → null (нет снапшота-призрака)', () => {
    expect(snapshotFromDayPlan('A', null)).toBeNull();
    expect(snapshotFromDayPlan('A', { meals: [] } as any)).toBeNull();
    expect(snapshotFromDayPlan('A', { meals: [{ label: 'X', items: [] }], totals: {} } as any)).toBeNull();
  });
});

describe('хранение A/B', () => {
  beforeEach(() => { localStorage.clear(); });

  it('roundtrip: save → load → remove', () => {
    const store = makeStore();
    const snapA = snapshotFromDayPlan('A', plan() as any)!;
    expect(saveAbSnapshot(snapA, store)).toBe(true);
    const loaded = loadAbSnapshots(store);
    expect(loaded.A?.totals.c).toBe(400);
    expect(loaded.B).toBeUndefined();
    removeAbSnapshot('A', store);
    expect(loadAbSnapshots(store).A).toBeUndefined();
    expect(store._map.has(AB_STORAGE_KEY)).toBe(true);
  });

  it('слоты независимы (A и B живут вместе)', () => {
    const store = makeStore();
    saveAbSnapshot(snapshotFromDayPlan('A', plan() as any)!, store);
    saveAbSnapshot(snapshotFromDayPlan('B', plan({ totals: { kcal: 2500, p: 170, f: 70, c: 300, fiber: 30 } } as any) as any)!, store);
    const loaded = loadAbSnapshots(store);
    expect(loaded.A!.totals.kcal).toBe(3000);
    expect(loaded.B!.totals.kcal).toBe(2500);
  });

  it('битый JSON/чужая форма → пусто, не падаем', () => {
    const store = makeStore();
    store.setItem(AB_STORAGE_KEY, '{broken');
    expect(loadAbSnapshots(store)).toEqual({});
    store.setItem(AB_STORAGE_KEY, JSON.stringify({ A: { meals: 'no' } }));
    expect(loadAbSnapshots(store)).toEqual({});
    store.setItem(AB_STORAGE_KEY, JSON.stringify({ A: { meals: [], totals: {} } }));
    expect(loadAbSnapshots(store)).toEqual({});
  });
});

describe('diffAbSnapshots', () => {
  const a = snapshotFromDayPlan('A', plan() as any)!;
  const b = snapshotFromDayPlan('B', plan({
    totals: { kcal: 3300, p: 200, f: 70, c: 450, fiber: 30 },
    meals: [
      {
        label: 'Завтрак', type: 'breakfast', time: '08:00',
        totals: { kcal: 700, p: 50, f: 25, c: 70 },
        items: [
          { id: 'oats_dry', name: 'Овсянка', amount: 100, p: 13, f: 6, c: 60, kcal: 380 },
          { id: 'whey_isolate', name: 'Изолят', amount: 20, p: 18, f: 0, c: 0, kcal: 72 },
        ],
      },
      {
        label: 'Обед', type: 'lunch', time: '13:00',
        totals: { kcal: 900, p: 60, f: 25, c: 110 },
        items: [
          { id: 'chicken_breast', name: 'Курица', amount: 150, p: 36, f: 3, c: 0, kcal: 170 },
          { id: 'rice_white', name: 'Рис', amount: 250, p: 7, f: 1, c: 70, kcal: 325 },
        ],
      },
    ],
    notes: ['✅ Клетчатка: 40г / 35г', '🍎 Фруктовый кап (≤4 приёма): фрукт убран'],
  } as any) as any)!;

  it('дельты КБЖУ: знак, проценты, дельта клетчатки', () => {
    const d = diffAbSnapshots(a, b);
    const kcal = d.rows.find(r => r.key === 'kcal')!;
    expect(kcal.delta).toBe(300);
    expect(kcal.deltaPct).toBe(10);
    const p = d.rows.find(r => r.key === 'p')!;
    expect(p.delta).toBe(20);
    const fib = d.rows.find(r => r.key === 'fiber')!;
    expect(fib.delta).toBe(-5);
    expect(d.summary).toMatch(/\+300 ккал/);
    expect(d.summary).toMatch(/\+20 г Б/);
  });

  it('приёмы: матч по подписи, добавленные/убранные позиции', () => {
    const d = diffAbSnapshots(a, b);
    const breakfast = d.meals.find(m => m.label === 'Завтрак')!;
    expect(breakfast.deltaKcal).toBe(100);
    expect(breakfast.deltaP).toBe(10);
    expect(breakfast.added.join(' ')).toMatch(/Изолят/);
    expect(breakfast.removed.join(' ')).toMatch(/Яйцо/);
    const lunch = d.meals.find(m => m.label === 'Обед')!;
    expect(lunch.deltaKcal).toBe(0);
    expect(lunch.added).toHaveLength(0);
    expect(lunch.removed).toHaveLength(0);
  });

  it('состав дня: added/removed по id, заметки: +/−', () => {
    const d = diffAbSnapshots(a, b);
    expect(d.foodAdded).toContain('Изолят');
    expect(d.foodRemoved).toContain('Яйцо');
    expect(d.notesAdded.join(' ')).toMatch(/Фруктовый кап/);
    expect(d.notesRemoved.join(' ')).toMatch(/Финальный добор/);
  });

  it('идентичные планы: нули и «макросы совпали»', () => {
    const d = diffAbSnapshots(a, snapshotFromDayPlan('B', plan() as any)!);
    expect(d.rows.every(r => r.delta === 0)).toBe(true);
    expect(d.summary).toMatch(/макросы совпали/);
    expect(d.foodAdded).toHaveLength(0);
    expect(d.foodRemoved).toHaveLength(0);
  });
});
