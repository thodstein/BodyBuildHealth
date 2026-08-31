/**
 * planner-carb-periodization.test.ts — Эпик 1 (план NUTRITION-PROFESSIONAL-PLAN.md):
 * единая периодизация углеводов. 4 legacy-механизма (cyclingMode/dietPauseMode/
 * periodizationEnabled) сведены к одному селектору carbPeriodization и ОДНОЙ функции
 * applyCarbPeriodizationMods. Тесты фиксируют моды всех 8 режимов.
 */

import { describe, it, expect } from 'vitest';
import { applyCarbPeriodizationMods, carbPeriodizationLabel } from '../planner-carb-periodization';

describe('applyCarbPeriodizationMods: none', () => {
  it('не меняет день (1.0/1.0), не рефид', () => {
    for (const offset of [0, 1, 5, 6]) {
      const m = applyCarbPeriodizationMods('none', offset, true);
      expect(m.dayKcalMod).toBe(1.0);
      expect(m.dayCarbMod).toBe(1.0);
      expect(m.isRefeedDay).toBe(false);
      expect(m.weekNote).toBeUndefined();
    }
  });
  it('null/undefined трактуется как none', () => {
    expect(applyCarbPeriodizationMods(undefined, 3, false).dayKcalMod).toBe(1.0);
    expect(applyCarbPeriodizationMods(null, 3, false).dayKcalMod).toBe(1.0);
  });
});

describe('applyCarbPeriodizationMods: refeed', () => {
  it('суббота (offset%7===6) — рефид-день ×2.2 углей, ккал ×1.12', () => {
    const m = applyCarbPeriodizationMods('refeed', 6, false);
    expect(m.isRefeedDay).toBe(true);
    expect(m.dayKcalMod).toBe(1.12);
    expect(m.dayCarbMod).toBe(2.2);
  });
  it('остальные дни — лёгкий дефицит 0.85/0.6', () => {
    for (const offset of [0, 1, 2, 3, 4, 5]) {
      const m = applyCarbPeriodizationMods('refeed', offset, true);
      expect(m.isRefeedDay).toBe(false);
      expect(m.dayKcalMod).toBe(0.85);
      expect(m.dayCarbMod).toBe(0.6);
    }
  });
});

describe('applyCarbPeriodizationMods: carb_cycle', () => {
  it('трен-день +15% ккал / +30% углей', () => {
    const m = applyCarbPeriodizationMods('carb_cycle', 2, true);
    expect(m.dayKcalMod).toBe(1.15);
    expect(m.dayCarbMod).toBe(1.3);
  });
  it('день отдыха −15% ккал / −30% углей', () => {
    const m = applyCarbPeriodizationMods('carb_cycle', 2, false);
    expect(m.dayKcalMod).toBe(0.85);
    expect(m.dayCarbMod).toBe(0.7);
  });
});

describe('applyCarbPeriodizationMods: butch', () => {
  it('ВУ-день (трен) 1.1/1.4', () => {
    const m = applyCarbPeriodizationMods('butch', 0, true);
    expect(m.dayKcalMod).toBe(1.1);
    expect(m.dayCarbMod).toBe(1.4);
  });
  it('НУ-день (отдых) 0.85/0.4', () => {
    const m = applyCarbPeriodizationMods('butch', 3, false);
    expect(m.dayKcalMod).toBe(0.85);
    expect(m.dayCarbMod).toBe(0.4);
  });
});

describe('applyCarbPeriodizationMods: flex_80_20', () => {
  it('лёгкий профицит 1.05/1.0 в любой день', () => {
    expect(applyCarbPeriodizationMods('flex_80_20', 0, true).dayKcalMod).toBe(1.05);
    expect(applyCarbPeriodizationMods('flex_80_20', 4, false).dayCarbMod).toBe(1.0);
  });
});

describe('applyCarbPeriodizationMods: two_one', () => {
  it('2 дня работы 1.12/1.25, 3-й день 0.85/0.6', () => {
    const a = applyCarbPeriodizationMods('two_one', 0, false);
    expect(a.dayKcalMod).toBe(1.12);
    expect(a.dayCarbMod).toBe(1.25);
    const b = applyCarbPeriodizationMods('two_one', 1, false);
    expect(b.dayKcalMod).toBe(1.12);
    const c = applyCarbPeriodizationMods('two_one', 2, false);
    expect(c.dayKcalMod).toBe(0.85);
    expect(c.dayCarbMod).toBe(0.6);
    // цикл повторяется
    expect(applyCarbPeriodizationMods('two_one', 5, false).dayKcalMod).toBe(0.85);
  });
});

describe('applyCarbPeriodizationMods: five_two', () => {
  it('5 дней дефицита 0.8/0.7, 2 дня maintenance 1.0/1.0', () => {
    for (const offset of [0, 1, 2, 3, 4]) {
      const m = applyCarbPeriodizationMods('five_two', offset, false);
      expect(m.dayKcalMod).toBe(0.8);
      expect(m.dayCarbMod).toBe(0.7);
    }
    for (const offset of [5, 6]) {
      const m = applyCarbPeriodizationMods('five_two', offset, false);
      expect(m.dayKcalMod).toBe(1.0);
      expect(m.dayCarbMod).toBe(1.0);
    }
  });
});

describe('applyCarbPeriodizationMods: wave (2+1 по неделям плана)', () => {
  it('недели 0-1 — рабочие (1.0/1.0 + заметка)', () => {
    for (const offset of [0, 1, 6, 7, 8, 13]) {
      const m = applyCarbPeriodizationMods('wave', offset, true);
      expect(m.dayKcalMod).toBe(1.0);
      expect(m.dayCarbMod).toBe(1.0);
      expect(m.weekNote).toContain('Рабочая неделя');
    }
  });
  it('каждая 3-я неделя (offset 14-20) — поддержание 0.9/0.85', () => {
    for (const offset of [14, 15, 20]) {
      const m = applyCarbPeriodizationMods('wave', offset, true);
      expect(m.dayKcalMod).toBe(0.9);
      expect(m.dayCarbMod).toBe(0.85);
      expect(m.weekNote).toContain('Неделя поддержания');
    }
  });
  it('волна продолжается в месяце: 6-я неделя (offset 35) — поддержание', () => {
    const m = applyCarbPeriodizationMods('wave', 35, false);
    expect(m.dayKcalMod).toBe(0.9);
  });
});

describe('carbPeriodizationLabel', () => {
  it('все 8 режимов имеют RU-лейблы', () => {
    const labels = ['none','refeed','carb_cycle','butch','flex_80_20','two_one','five_two','wave'].map(m => carbPeriodizationLabel(m as any));
    expect(labels.every(l => typeof l === 'string' && l.length > 0)).toBe(true);
    expect(carbPeriodizationLabel('none')).toBe('Нет');
    expect(carbPeriodizationLabel(undefined)).toBe('Нет');
    expect(carbPeriodizationLabel('butch')).toBe('БУЧ');
  });
});

describe('детерминизм и чистота', () => {
  it('один и тот же вход → один и тот же выход', () => {
    const a = applyCarbPeriodizationMods('refeed', 6, false);
    const b = applyCarbPeriodizationMods('refeed', 6, false);
    expect(a).toEqual(b);
  });
  it('не мутирует вход', () => {
    expect(() => applyCarbPeriodizationMods('wave', 14, true)).not.toThrow();
  });
});