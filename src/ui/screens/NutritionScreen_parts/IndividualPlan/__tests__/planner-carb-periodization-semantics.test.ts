/**
 * planner-carb-periodization-semantics.test.ts — §4.3 семантика two_one:
 *
 * Дефект (docs/NUTRITION-PLANNER-PRO-AUDIT-2026-10.md): режим `two_one` был
 * ПОДПИСАН как 3-недельный цикл («2 нед дефицит → 1 нед поддержание»), а
 * РЕАЛИЗОВАН как 3-дневный (offset % 3: 2 дня ×1.12 → 1 день ×0.85).
 * Недельный цикл в проекте уже есть — это `wave` (offset/7 % 3).
 *
 * Решение: реализация (3-дневный цикл) — рабочий контракт (он закрыт тестами и
 * дополняет butch/carb_cycle/five_two/wave); исправлена ПОДПИСЬ в types.ts.
 * Лок выводит период из движка и сверяет его с описанием — «показано = работает».
 */
import { describe, it, expect } from 'vitest';
import { applyCarbPeriodizationMods } from '../planner-carb-periodization';
import { CARB_PERIODIZATION_OPTIONS, type CarbPeriodization } from '../types';

const descOf = (id: CarbPeriodization): string =>
  (CARB_PERIODIZATION_OPTIONS.find(o => o.id === id) || {}).desc || '';

// Период последовательности модов (движок) при чередовании трен/отдых.
const periodOf = (mode: CarbPeriodization): number => {
  const seq: number[] = [];
  for (let i = 0; i < 42; i++) seq.push(applyCarbPeriodizationMods(mode, i, i % 2 === 0).dayKcalMod);
  for (let p = 1; p <= 21; p++) {
    let ok = true;
    for (let i = 0; i + p < 42; i++) if (seq[i] !== seq[i + p]) { ok = false; break; }
    if (ok) return p;
  }
  return 0;
};

describe('§4.3 two_one — семантика решена: 3-ДНЕВНЫЙ цикл (не недельный)', () => {
  it('движок: период последовательности = 3 дня', () => {
    expect(periodOf('two_one')).toBe(3);
  });

  it('подпись описывает 3-дневный цикл и не врёт про недели', () => {
    const d = descOf('two_one');
    expect(d).toMatch(/3-дневный/);
    expect(d).not.toMatch(/нед/); // «2 нед дефицит → 1 нед поддержание» убрано
    expect(d).toMatch(/1\.12/);   // фактические множители из движка
    expect(d).toMatch(/0\.85/);
  });

  it('ДВА высоких дня + один низкий (контракт реализации сохранён)', () => {
    for (const offset of [0, 1, 3, 4]) {
      const m = applyCarbPeriodizationMods('two_one', offset, false);
      expect(m.dayKcalMod).toBe(1.12);
      expect(m.dayCarbMod).toBe(1.25);
    }
    for (const offset of [2, 5, 8]) {
      const m = applyCarbPeriodizationMods('two_one', offset, false);
      expect(m.dayKcalMod).toBe(0.85);
      expect(m.dayCarbMod).toBe(0.6);
    }
  });

  it('не путается с недельной волной: wave — 21 день, two_one — 3', () => {
    expect(periodOf('wave')).toBe(21);
    expect(periodOf('two_one')).toBe(3);
  });
});

describe('§4.3 подписи всех режимов сверены с реализацией', () => {
  it('refeed — 7-дневный цикл, подпись говорит про день/неделю', () => {
    expect(periodOf('refeed')).toBe(7);
    expect(descOf('refeed')).toMatch(/день/);
    expect(descOf('refeed')).toMatch(/нед/);
  });

  it('five_two — 7-дневный (5 рабочих + 2 maintenance)', () => {
    expect(periodOf('five_two')).toBe(7);
    expect(descOf('five_two')).toMatch(/5/);
    expect(descOf('five_two')).toMatch(/2/);
  });

  it('wave — 21-дневный (2 нед работа + 1 нед поддержание)', () => {
    expect(periodOf('wave')).toBe(21);
    expect(descOf('wave')).toMatch(/2 нед/);
    expect(descOf('wave')).toMatch(/1 нед/);
  });

  it('carb_cycle/butch — режим по расписанию тренировок (подпись честна)', () => {
    // Моды зависят от isTrain, а не от offset — период фиксированным не является.
    const train = applyCarbPeriodizationMods('carb_cycle', 0, true);
    const rest = applyCarbPeriodizationMods('carb_cycle', 0, false);
    expect(train.dayKcalMod).toBeGreaterThan(rest.dayKcalMod);
    expect(descOf('carb_cycle')).toMatch(/Трен/);
    expect(descOf('butch')).toMatch(/трен/);
  });

  it('none/flex_80_20 — ровные/аддитивные, без дневного цикла', () => {
    expect(periodOf('none')).toBe(1);
    expect(periodOf('flex_80_20')).toBe(1);
    expect(descOf('flex_80_20')).toMatch(/цельные/);
  });

  it('все 8 режимов имеют sub-pись и RU-лейбл', () => {
    expect(CARB_PERIODIZATION_OPTIONS.length).toBe(8);
    for (const o of CARB_PERIODIZATION_OPTIONS) {
      expect(o.desc.length, o.id).toBeGreaterThan(5);
      expect(o.label.length, o.id).toBeGreaterThan(0);
    }
  });
});
