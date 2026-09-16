/**
 * planner-manual-kbju.test.tsx — lock: РУЧНОЙ ввод КБЖУ — источник правды.
 *
 * 1) цели дня = ровно введённые значения (ветка `manual` в buildDayTargets), бейдж «Ручной режим»;
 * 2) ББ-план (he_bb_nutrition_note: kcal + трен-дни) НЕ сдвигает БЖУ и НЕ подменяет калораж;
 * 3) потолок углеводов (8–10 г/кг) в ручном режиме НЕ применяется — пользователь выше потолка;
 * 4) сгенерированный день реально сходится к РУЧНЫМ целям, а не к авто.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

// 80 кг: ручные У 900 = 11.25 г/кг — выше любого авто-потолка (8–10 г/кг).
const MAN = { kcal: 5040, p: 180, f: 80, c: 900 }; // Atwater = 180*4 + 80*9 + 900*4 = 5040

const seed = () => {
  try {
    localStorage.setItem('he_planner_mode', 'pro');
    localStorage.setItem('he_kbju_mode', 'manual');
    localStorage.setItem('he_manual_kcal', String(MAN.kcal));
    localStorage.setItem('he_manual_p', String(MAN.p));
    localStorage.setItem('he_manual_f', String(MAN.f));
    localStorage.setItem('he_manual_c', String(MAN.c));
    // «Враждебный» ББ-план: каждый день трен-день + чужой калораж — в ручном режиме должен молчать.
    localStorage.setItem('he_bb_nutrition_note', JSON.stringify({ kcal: 6300, trainDays: [1, 2, 3, 4, 5, 6, 7], weeklySets: 120 }));
    localStorage.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80, height: 180, age: 30, sex: 'male', bodyFat: 14 },
        training: { primaryGoal: 'mass' },
        pharma: { phase: 'course' },
        nutrition: {},
      },
    }));
  } catch {}
};

const hasText = (re: RegExp) => !!(document.body.textContent || '').match(re);
const clickBtn = (re: RegExp) => {
  const found = Array.from(document.querySelectorAll('button')).filter((b) => re.test(b.textContent || ''));
  if (found.length === 0) throw new Error(`button not found: ${re}`);
  fireEvent.click(found[found.length - 1]);
};

describe('Ручной КБЖУ: цели дня и генерация по ним', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
    cleanup();
    seed();
  });

  it('цели дня = ручным, ББ-план не подменяет калораж/углеводы', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    // Карточка целей показывает ровно ручные значения (5040/180/80/900).
    expect(hasText(/🎯 Цель5040 ккал/) || hasText(/Цель\s*5040\s*ккал/), 'нет цели 5040').toBe(true);
    expect(hasText(/5040/)).toBe(true);
    expect(hasText(/900/)).toBe(true);
    // «Враждебный» ББ-план (6300 ккал + все дни трен) не подменил цель и не сдвинул углеводы.
    expect(hasText(/Цель\s*6300\s*ккал/)).toBe(false);
    expect(hasText(/углеводы \+30 г/)).toBe(false);
  });

  it('генерация дня: день идёт к ручным целям (У выше авто-базы), не к авто', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickBtn(/✨ Сгенерировать план питания/);
    // Ждём план (метка «Завтрак» в списке приёмов).
    const started = Date.now();
    return new Promise<void>((resolve, reject) => {
      const tick = () => {
        const t = document.body.textContent || '';
        if (/Завтрак/.test(t) && /ккал/.test(t)) {
          try {
            // День должен нести объём углеводов, невозможный для авто-базы (~300–400 г),
            // т.е. реально считаться по ручным 900 г (ёмкость тарелок ~600–800 г/день).
            const m = t.match(/Углеводы[\s\S]{0,60}?(\d{3,4})\s*г/);
            const dayCarbs = m ? Number(m[1]) : NaN;
            expect(Number.isFinite(dayCarbs), 'не нашли углеводы дня').toBe(true);
            expect(dayCarbs, `угли дня ${dayCarbs} г`).toBeGreaterThan(600);
            resolve();
          } catch (e) { reject(e); }
          return;
        }
        if (Date.now() - started > 30000) { reject(new Error('план не сгенерировался за 30с')); return; }
        setTimeout(tick, 250);
      };
      tick();
    });
  }, 60000);
});
