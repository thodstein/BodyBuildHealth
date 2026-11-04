/**
 * Календарные артефакты: правила RFC 5545 в одном месте + человеческие подписи.
 *
 * Замеры до правки:
 *  - календарь спец-блока печатал СЫРЫЕ ключи мышц: 24 вхождения на один блок
 *    (`SUMMARY:ББ спец-блок: нед 1 — delt_mid 10\, biceps 9`,
 *     `DESCRIPTION:… Цели: delt_mid\, biceps`);
 *  - 6 из 46 физических строк были длиннее 75 октетов (складывания не было);
 *  - экранирование жило локальными копиями в каждом движке.
 */
import { describe, it, expect } from 'vitest';
import { buildSpecBlock } from '../bb-spec-block.engine';
import { buildBBSpecIcs } from '../bb-spec-ics.engine';
import { icsEscape, icsFoldLine, icsProperty, icsUnfold } from '../../ics-format';

const MUSCLE_KEYS = [
  'chest', 'back', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps', 'forearms',
  'shoulders', 'biceps', 'triceps', 'delt_front', 'delt_mid', 'delt_rear', 'chest_upper', 'chest_lower',
];

const octets = (s: string) => new TextEncoder().encode(s).length;

describe('ics-format: единые правила календаря', () => {
  it('экранирует \\ ; , и переводы строк', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('складывает по 75 октетов, не рвя многобайтные символы, и разворачивается обратно', () => {
    const text = `SUMMARY:${'Ж'.repeat(80)}`;
    const folded = icsFoldLine(text);
    const physical = folded.split('\r\n');
    expect(physical.length).toBeGreaterThan(1);
    for (const line of physical) expect(octets(line)).toBeLessThanOrEqual(75);
    // Продолжения начинаются с пробела (RFC 5545 §3.1).
    for (const line of physical.slice(1)) expect(line.startsWith(' ')).toBe(true);
    expect(icsUnfold(folded)).toBe(text);
  });

  it('icsProperty экранирует и складывает вместе', () => {
    const prop = icsProperty('DESCRIPTION', `${'Сет'.repeat(40)}, хвост`);
    for (const line of prop.split('\r\n')) expect(octets(line)).toBeLessThanOrEqual(75);
    expect(icsUnfold(prop)).toBe(`DESCRIPTION:${'Сет'.repeat(40)}\\, хвост`);
  });
});

describe('календарь спец-блока: подписи и строки', () => {
  function buildIcs() {
    const block = buildSpecBlock({ weakZones: ['delt_mid', 'biceps'], factSets: { delt_mid: 6, biceps: 5 }, level: 'intermediate', weeks: 6 });
    return buildBBSpecIcs(
      { weeks: block.weeks.map((w) => ({ week: w.week, targetSets: w.targetSets, note: w.note })), weakZones: ['delt_mid', 'biceps'] },
      { startDate: '2026-11-02', title: 'ББ спец-блок' },
    )!;
  }

  it('не печатает сырые ключи мышц', () => {
    const ics = buildIcs();
    const flat = icsUnfold(ics);
    for (const key of MUSCLE_KEYS) {
      expect(flat, `сырой ключ '${key}' в календаре`).not.toMatch(new RegExp(`(^|[^a-z_])${key}([^a-z_]|$)`));
    }
    // Подписи реально есть (иначе «нет ключей» прошло бы на пустом тексте).
    expect(flat).toMatch(/Средняя дельта/);
    expect(flat).toMatch(/Бицепс/);
  });

  it('все физические строки ≤ 75 октетов и читаются после разворота', () => {
    const ics = buildIcs();
    for (const line of ics.split('\r\n')) {
      expect(octets(line), `строка длиннее 75 октетов: ${line}`).toBeLessThanOrEqual(75);
    }
    const flat = icsUnfold(ics);
    expect(flat).toMatch(/SUMMARY:ББ спец-блок: нед 1 — /);
    expect(flat).toMatch(/DESCRIPTION:.*Цели: /);
    // Экранирование не потеряно: запятая в тексте — как \, а не как разделитель.
    expect(flat).toMatch(/\\,/);
  });
});
