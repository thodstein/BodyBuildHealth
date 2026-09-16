import { describe, it, expect } from 'vitest';
import {
  painMonitorVerdict,
  painMonitorLine,
  painLocationLabel,
  provocationFor,
  PAIN_LOCATIONS,
  PAIN_MONITOR_DISCLAIMER,
} from '../bb-pain-monitor.engine';

describe('bb-pain-monitor R2 — правило Silbernagel', () => {
  it('зелёный на границе: 5 днём, 4 утром', () => {
    const v = painMonitorVerdict({ during010: 5, nextMorning010: 4 });
    expect(v.level).toBe('green');
    expect(v.text).toMatch(/зелёный/);
  });
  it('жёлтый: утро = 5 (порог <5)', () => {
    const v = painMonitorVerdict({ during010: 3, nextMorning010: 5 });
    expect(v.level).toBe('yellow');
  });
  it('жёлтый: боль растёт по неделям', () => {
    expect(painMonitorVerdict({ during010: 3, nextMorning010: 2, weeksRising: true }).level).toBe('yellow');
  });
  it('красный: днём >5', () => {
    const v = painMonitorVerdict({ during010: 6, nextMorning010: 2 });
    expect(v.level).toBe('red');
    expect(v.advice).toMatch(/≤3/);
  });
  it('красный: утро >6', () => {
    expect(painMonitorVerdict({ during010: 4, nextMorning010: 7 }).level).toBe('red');
  });
  it('красный: ночная/резкая боль — до цифр', () => {
    expect(painMonitorVerdict({ during010: 1, nextMorning010: 1, nightPain: true }).level).toBe('red');
    expect(painMonitorVerdict({ sharp: true }).level).toBe('red');
  });
  it('«во время» не замерено — жёлтый с честной строкой', () => {
    const v = painMonitorVerdict({ nextMorning010: 2 });
    expect(v.level).toBe('yellow');
    expect(v.advice).toMatch(/Замерь/);
  });
  it('не заполнено — not_tested, line пустая', () => {
    const v = painMonitorVerdict({});
    expect(v.tested).toBe(false);
    expect(painMonitorLine({})).toBe('');
  });
  it('line формат: локация + 0–10 + порог', () => {
    const line = painMonitorLine({ location: 'elbow', during010: 7, nextMorning010: 4 });
    expect(line).toMatch(/Боль \[Локоть/);
    expect(line).toMatch(/7\/10 днём, 4\/10 утром/);
    expect(line).toMatch(/красный/);
  });
  it('значения >10 клампятся (12 → red, не ломает)', () => {
    expect(painMonitorVerdict({ during010: 12 }).level).toBe('red');
  });
  it('локации: подписи и провокации заполнены', () => {
    for (const p of PAIN_LOCATIONS) {
      expect(p.label.length).toBeGreaterThan(3);
      expect(p.provocation.length).toBeGreaterThan(10);
      expect(painLocationLabel(p.id)).toBe(p.label);
      expect(provocationFor(p.id)).toBe(p.provocation);
    }
    expect(painLocationLabel('')).toBe('Боль');
    expect(provocationFor('мусор' as any)).toMatch(/воспроизводит/);
  });
  it('дисклеймер: не диагноз + маршрут к врачу', () => {
    expect(PAIN_MONITOR_DISCLAIMER).toMatch(/не диагноз/);
    expect(PAIN_MONITOR_DISCLAIMER).toMatch(/врачу/);
  });
});
