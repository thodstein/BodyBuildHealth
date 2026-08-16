/**
 * Тесты сессий растяжки (stretch-session.engine.ts): генератор по фокусу,
 * лимит времени, типы подходов, лог и статистика.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  STRETCH_FOCUSES, buildStretchSession, stretchExerciseLabel,
  loadStretchLog, upsertStretchLog, stretchLogForDate, stretchStats, sanitizeStretchLog,
  STRETCH_LOG_KEY,
} from '../stretch-session.engine';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

describe('STRETCH_FOCUSES и buildStretchSession', () => {
  it('5 фокусов с подписями и группами', () => {
    expect(STRETCH_FOCUSES.length).toBe(5);
    for (const f of STRETCH_FOCUSES) {
      expect(f.label).toBeTruthy();
      expect(f.groups.length).toBeGreaterThan(0);
    }
  });

  it('всё тело 15 мин: блоки с подходами и типами', () => {
    const plan = buildStretchSession('fullbody', 15);
    expect(plan.blocks.length).toBeGreaterThan(3);
    expect(plan.focusLabel).toBe('Всё тело');
    const ex = plan.blocks[0].exercises[0];
    expect(ex.sets).toBeGreaterThan(0);
    expect(['static', 'pnf']).toContain(ex.type);
    expect(plan.totalSec).toBeLessThanOrEqual(16 * 60);
    expect(plan.totalSec).toBeGreaterThan(5 * 60);
  });

  it('ноги: содержит квадрицепс и икры; верх: грудь', () => {
    const legs = buildStretchSession('legs', 15);
    const legIds = legs.blocks.map(b => b.exercises[0].id);
    expect(legIds).toContain('quad_stretch');
    expect(legIds).toContain('calf_stretch');
    const upper = buildStretchSession('upper', 15);
    expect(upper.blocks.map(b => b.exercises[0].id)).toContain('chest_stretch');
  });

  it('длительность ограничивает объём (10 < 20 мин)', () => {
    const s10 = buildStretchSession('fullbody', 10);
    const s20 = buildStretchSession('fullbody', 20);
    expect(s10.blocks.length).toBeLessThanOrEqual(s20.blocks.length);
    expect(s10.totalSec).toBeLessThanOrEqual(s20.totalSec);
    expect(Math.round(s10.totalSec / 60)).toBeLessThanOrEqual(11);
    expect(Math.round(s20.totalSec / 60)).toBeLessThanOrEqual(21);
  });

  it('stretchExerciseLabel — русское название с fallback', () => {
    expect(stretchExerciseLabel('quad_stretch')).toContain('квадрицепса');
    expect(stretchExerciseLabel('нет_такого')).toBe('нет_такого');
  });
});

describe('Лог сессий растяжки', () => {
  beforeEach(() => localStorage.clear());

  it('upsert по дате: добавляет и заменяет', () => {
    upsertStretchLog({ date: daysAgo(1), focus: 'fullbody', durationMin: 15, done: true, quality: 4 });
    expect(loadStretchLog().length).toBe(1);
    upsertStretchLog({ date: daysAgo(1), focus: 'legs', durationMin: 20, done: true, quality: 5 });
    const list = loadStretchLog();
    expect(list.length).toBe(1);
    expect(list[0].focus).toBe('legs');
    expect(list[0].durationMin).toBe(20);
    expect(stretchLogForDate(daysAgo(1))?.quality).toBe(5);
  });

  it('устойчив к битому JSON; sanitize отбрасывает мусор', () => {
    localStorage.setItem(STRETCH_LOG_KEY, '{"broken":');
    expect(loadStretchLog()).toEqual([]);
    expect(sanitizeStretchLog(null)).toBeNull();
    expect(sanitizeStretchLog({ date: 'вчера', done: true })).toBeNull();
    expect(sanitizeStretchLog({ date: '2026-01-01', focus: 'неизвестно', done: true })?.focus).toBe('fullbody');
  });

  it('stretchStats: счётчик, суммарные минуты, минуты недели', () => {
    const empty = stretchStats();
    expect(empty.count).toBe(0);
    upsertStretchLog({ date: daysAgo(1), focus: 'fullbody', durationMin: 15, done: true, quality: 4 });
    upsertStretchLog({ date: daysAgo(2), focus: 'legs', durationMin: 10, done: true, quality: 3 });
    upsertStretchLog({ date: daysAgo(3), focus: 'upper', durationMin: 20, done: false, quality: null });
    const s = stretchStats();
    expect(s.count).toBe(2); // только выполненные
    expect(s.totalMin).toBe(25);
    expect(s.weekMin).toBe(25); // всё в текущей неделе
    expect(s.lastDate).toBe(daysAgo(1));
  });
});
