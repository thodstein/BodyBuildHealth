/**
 * planner-day-targets.test.ts — Эпик A (NUTRITION-PLANNER-QUALITY-PLAN, Aug 30 2026).
 * Инварианты единой целевой арифметики buildDayTargets:
 *  - наука (TDEE/surplus/фаза/фарма/weight-adapt) задаёт калораж;
 *  - пресет белка — оверрайд;
 *  - углеводы — остаток до калоража (диетпотолок);
 *  - manual/profile — обратно-совместимы.
 */
import { describe, it, expect } from 'vitest';
import { buildDayTargets } from '../planner-day-targets';
import type { PlannerTargets } from '../planner-targets';

const base = (over: Partial<PlannerTargets> = {}): PlannerTargets => ({
  bmr: 1700, tdee: 3000, kcal: 3000, protein: 180, fats: 80, carbs: 310, adjustment: 0, ...over,
});
const prof = (over: Partial<PlannerTargets> = {}): PlannerTargets => ({
  bmr: 1700, tdee: 2500, kcal: 2500, protein: 160, fats: 70, carbs: 280, adjustment: 0, ...over,
});
const IN = (over: Partial<Parameters<typeof buildDayTargets>[0]> = {}) => ({
  weightKg: 80, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto' as const,
  calcTargets: base(), profileTargets: prof(), goal: 'mass',
  trainingVolumeMinPerWeek: 360, budget: 'medium', insulinTotalUnits: 0,
  ...over,
});

describe('buildDayTargets — auto: наука задаёт калораж', () => {
  it('surplus 15% (ккал 3450) даёт больше углей/ккал, чем surplus 5% (3050) при том же белке', () => {
    const lo = buildDayTargets(IN({ calcTargets: base({ kcal: 3050 }) }));
    const hi = buildDayTargets(IN({ calcTargets: base({ kcal: 3450 }) }));
    expect(lo.protein).toBe(160); // пресет фиксирует белок
    expect(hi.protein).toBe(160);
    expect(hi.carbs).toBeGreaterThan(lo.carbs);
    expect(hi.kcal).toBeGreaterThan(lo.kcal);
    // разница калоража ≈ разница углей ×4 (остаток уходит в углеводы)
    const dKcal = hi.kcal - lo.kcal;
    const dCarbs = hi.carbs - lo.carbs;
    expect(Math.abs(dKcal - dCarbs * 4)).toBeLessThanOrEqual(6);
  });

  it('weight-adapt: сниженный calcTargets.kcal снижает цель (наука доезжает)', () => {
    const normal = buildDayTargets(IN({ calcTargets: base({ kcal: 3000 }) }));
    const adapted = buildDayTargets(IN({ calcTargets: base({ kcal: 2700 }) }));
    expect(adapted.kcal).toBeLessThan(normal.kcal);
    expect(adapted.carbs).toBeLessThan(normal.carbs);
  });

  it('AAS-белок выше пресета — пресет приоритетен, но breakdown предупреждает', () => {
    const r = buildDayTargets(IN({ calcTargets: base({ protein: 210 }) })); // 80 кг: 2.0 пресет = 160
    expect(r.protein).toBe(160);
    expect(r.breakdown.some(s => s.includes('выше пресета'))).toBe(true);
  });

  it('kcal = Atwater от фактических макросов (display == генерация)', () => {
    const r = buildDayTargets(IN());
    expect(r.kcal).toBe(Math.round(r.protein * 4 + r.fats * 9 + r.carbs * 4));
  });

  it('жиры: пол 0.8 г/кг применяется (64 г при 80 кг), если наука ниже', () => {
    const r = buildDayTargets(IN({ calcTargets: base({ fats: 50 }) }));
    expect(r.fats).toBe(64);
  });

  it('жиры: научный кап инсулина 0.5 г/кг сильнее пола', () => {
    const r = buildDayTargets(IN({ insulinTotalUnits: 10, calcTargets: base({ fats: 80 }) }));
    expect(r.fats).toBe(40); // 80 × 0.5
    expect(r.breakdown.some(s => s.includes('инсулин'))).toBe(true);
  });

  it('потолок углей не срезает bulk на 8 г/кг при большом объёме', () => {
    // 90 кг, bulk, 720 мин/нед → потолок 8 г/кг = 720 г
    const r = buildDayTargets(IN({
      weightKg: 90, goal: 'mass', trainingVolumeMinPerWeek: 720,
      calcTargets: base({ kcal: 4200, tdee: 3600 }),
    }));
    // raw = (4200 − 180×4 − 72×9)/4 = (4200 − 720 − 648)/4 = 708 → под потолком 720
    expect(r.carbs).toBeGreaterThan(650);
    expect(r.breakdown.some(s => s.includes('Потолок углей срезал'))).toBe(false);
  });

  it('cut: дефицитный калораж даёт меньше углей/ккал, чем mass, белок пресета удержан', () => {
    const cut = buildDayTargets(IN({ goal: 'fat_loss', calcTargets: base({ kcal: 2200, tdee: 3000 }) }));
    const mass = buildDayTargets(IN({ goal: 'mass', calcTargets: base({ kcal: 3400, tdee: 3000 }) }));
    expect(cut.protein).toBe(160);
    expect(cut.carbs).toBeLessThan(mass.carbs);
    expect(cut.kcal).toBeLessThan(mass.kcal);
  });

  it('breakdown непустой и упоминает TDEE и итог', () => {
    const r = buildDayTargets(IN());
    expect(r.breakdown.length).toBeGreaterThanOrEqual(4);
    expect(r.breakdown.some(s => s.includes('TDEE'))).toBe(true);
    expect(r.breakdown.some(s => s.startsWith('Итог дня'))).toBe(true);
  });

  it('детерминизм: одинаковый вход → одинаковый выход', () => {
    const a = buildDayTargets(IN());
    const b = buildDayTargets(IN());
    expect(a).toEqual(b);
  });
});

describe('buildDayTargets — manual (явные граммы пользователя)', () => {
  // FIX B19/B20 (аудит 2026-10): контракт ручного режима изменён осознанно.
  //  • граммы Б/Ж/У пользователя — закон; диетологический пол жира их не переписывает
  //    (остаётся только физиологический минимум незаменимых ЖК 0.3 г/кг);
  //  • ккал НЕ может противоречить БЖУ: если заданы все три макроса, калорийность
  //    приводится к 4Б+4У+9Ж (иначе набор целей недостижим и сходимость ≤3% невозможна);
  //  • если цели пусты — берутся нейтральные цели профиля (а не нули).
  it('все ручные значения заданы — граммы как есть, ккал приведён к БЖУ', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 3200, p: 180, f: 90, c: 330 } }));
    const aw = 180 * 4 + 90 * 9 + 330 * 4; // 2850
    expect(r).toMatchObject({ protein: 180, fats: 90, carbs: 330 });
    expect(r.kcal).toBe(aw); // введённые 3200 противоречат БЖУ (10.9%) → цель по ккал приводится
    expect(r.breakdown.join(' ')).toContain('приведена к БЖУ');
  });

  it('manualC = null → угли выводятся из manualKcal − Б − Ж', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 3000, p: 170, f: 80, c: null } }));
    expect(r.carbs).toBe(Math.round((3000 - 170 * 4 - 80 * 9) / 4));
  });

  it('B19: ручной жир НЕ поднимается диетологическим полом 0.8 г/кг', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 2800, p: 180, f: 30, c: 200 } }));
    // 30 г > физиологического минимума (0.3 г/кг = 24 г) → остаётся ровно 30
    expect(r.fats).toBe(30);
    expect(r.breakdown.join(' ')).not.toContain('физиологического минимума');
  });

  it('B19: ниже физиологического минимума — поднимается до 0.3 г/кг и это сказано в разборе', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 2800, p: 180, f: 5, c: 200 } }));
    expect(r.fats).toBe(Math.max(15, Math.round(80 * 0.3))); // 24
    expect(r.breakdown.join(' ')).toContain('физиологического минимума');
  });

  it('manual: ккал + белок без жиров/углей — жир по полу, угли остатком', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 2000, p: 160, f: 0, c: null } }));
    expect(r).toMatchObject({ protein: 160, fats: 64, carbs: 196 });
    expect(r.kcal).toBe(2000);
  });

  it('manual: ручные углы ниже 50 г не повышаются скрытым диетологическим полом', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 1000, p: 100, f: 40, c: 10 } }));
    expect(r.carbs).toBe(10);
  });

  it('B20: пустые цели → нейтральные цели профиля, а не нули (рацион собирается)', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: {} }));
    expect(r.protein).toBeGreaterThan(0);
    expect(r.fats).toBeGreaterThan(0);
    expect(r.carbs).toBeGreaterThan(0);
    expect(r.kcal).toBeGreaterThan(0);
    expect(r.breakdown.join(' ')).toContain('цели не заданы');
  });

  it('carbCapOverride снимает контекстный потолок, но не ручные значения', () => {
    const capped = buildDayTargets(IN({ goal: 'fat_loss', calcTargets: base({ kcal: 3000 }) }));
    const uncapped = buildDayTargets(IN({ goal: 'fat_loss', calcTargets: base({ kcal: 3000 }), carbCapGPerKg: 0 }));
    expect(uncapped.carbs).toBeGreaterThan(capped.carbs);
  });

  it('keto без инсулина сохраняет собственный низкий углеводный cap', () => {
    const r = buildDayTargets(IN({ dietStyle: 'keto', calcTargets: base({ kcal: 2200, tdee: 2200 }) }));
    expect(r.carbs).toBeLessThanOrEqual(60);
    expect(r.breakdown.join(' ')).toContain('Кето');
  });

  it('keto + инсулин честно сообщает о конфликте гликемического пола', () => {
    const r = buildDayTargets(IN({ dietStyle: 'keto', insulinTotalUnits: 10, calcTargets: base({ kcal: 2200, tdee: 2200 }) }));
    expect(r.breakdown.join(' ')).toContain('Конфликт');
  });
});

describe('buildDayTargets — manual: незаполненные параметры считаются автоматически', () => {
  // Требование (2026-10-30): любой НЕ введённый пользователем параметр в ручном
  // режиме считается автоматически. Было: ввёл только белок → день 720 ккал,
  // Ж 0, У 0 (рацион не собирается); пустой ввод → «нейтральный профиль» в обход науки.
  const auto = () => buildDayTargets(IN());
  const manual = (m: any) => buildDayTargets(IN({ kbjuMode: 'manual', manual: m }));
  const aw = (r: { protein: number; fats: number; carbs: number }) => Math.round(r.protein * 4 + r.fats * 9 + r.carbs * 4);

  it('введён ТОЛЬКО белок — жир и углеводы считаются автоматически', () => {
    const r = manual({ p: 180 });
    expect(r.protein).toBe(180);
    expect(r.fats).toBeGreaterThan(0);
    expect(r.carbs).toBeGreaterThan(0);
    expect(r.fats).toBe(auto().fats);   // норма жира из авто-цели
    expect(r.carbs).toBe(auto().carbs); // углеводы с диетпотолком/стилем
    expect(r.kcal).toBe(aw(r));
    expect(r.breakdown.join(' ')).toContain('жир не задан — посчитан автоматически');
    expect(r.breakdown.join(' ')).toContain('углеводы не заданы');
  });

  it('введён ТОЛЬКО жир — белок и углеводы считаются автоматически', () => {
    const r = manual({ f: 100 });
    expect(r.fats).toBe(100);
    expect(r.protein).toBe(auto().protein);
    expect(r.carbs).toBeGreaterThan(0);
    expect(r.kcal).toBe(aw(r));
  });

  it('введены ТОЛЬКО углеводы — белок и жир считаются автоматически', () => {
    const r = manual({ c: 300 });
    expect(r.carbs).toBe(300);
    expect(r.protein).toBe(auto().protein);
    expect(r.fats).toBe(auto().fats);
    expect(r.kcal).toBe(aw(r));
  });

  it('не введено ничего — полный авто-расчёт, а не «нейтральный профиль»', () => {
    const r = manual({});
    const a = auto();
    expect([r.protein, r.fats, r.carbs, r.kcal]).toEqual([a.protein, a.fats, a.carbs, a.kcal]);
    expect(r.breakdown.join(' ')).toContain('посчитаны автоматически');
  });

  it('ккал + только жир: белок и углеводы делятся в авто-пропорции (белок не съедает день)', () => {
    const r = manual({ kcal: 2400, f: 80 });
    expect(r.fats).toBe(80);
    expect(r.protein).toBeGreaterThan(0);
    expect(r.carbs).toBeGreaterThan(0);
    // Углеводы не обнулены и день сходится к введённым ккал (в пределах округления).
    expect(Math.abs(r.kcal - 2400) / 2400).toBeLessThanOrEqual(0.02);
    expect(Math.abs(r.kcal - aw(r)) / r.kcal).toBeLessThanOrEqual(0.03);
  });

  it('ккал + только углеводы: белок и жир делятся в авто-пропорции', () => {
    const r = manual({ kcal: 2400, c: 250 });
    expect(r.carbs).toBe(250);
    expect(r.protein).toBeGreaterThan(0);
    expect(r.fats).toBeGreaterThanOrEqual(24); // пол незаменимых ЖК
    expect(Math.abs(r.kcal - 2400) / 2400).toBeLessThanOrEqual(0.03);
    expect(Math.abs(r.kcal - aw(r)) / r.kcal).toBeLessThanOrEqual(0.03);
  });

  it('инвариант: ккал и БЖУ согласованы в пределах канона 3% для любой комбинации', () => {
    const cases: any[] = [
      { p: 150 }, { f: 70 }, { c: 200 }, { kcal: 2000 },
      { kcal: 2000, p: 150 }, { kcal: 2000, f: 60 }, { kcal: 2000, c: 200 },
      { kcal: 2000, p: 150, f: 60 }, { kcal: 2000, p: 150, c: 200 }, { kcal: 2000, f: 60, c: 200 },
      { p: 150, f: 60 }, { p: 150, c: 200 }, { f: 60, c: 200 },
      { p: 150, f: 60, c: 200 }, { p: 150, f: 60, c: 200, kcal: 2000 }, {},
    ];
    for (const m of cases) {
      const r = manual(m);
      expect(r.kcal, `набор ${JSON.stringify(m)}`).toBeGreaterThan(0);
      expect(Math.abs(r.kcal - aw(r)) / r.kcal, `согласованность ${JSON.stringify(m)}`).toBeLessThanOrEqual(0.03);
      expect(r.protein, `Б в ${JSON.stringify(m)}`).toBeGreaterThan(0);
      expect(r.fats, `Ж в ${JSON.stringify(m)}`).toBeGreaterThan(0);
      expect(r.carbs, `У в ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('все три макроса заданы — ккал ровно по Атwater (введённый ккал уступает)', () => {
    const r = manual({ kcal: 2000, p: 150, f: 60, c: 200 });
    expect(r.kcal).toBe(aw(r)); // 150*4 + 60*9 + 200*4 = 1940
    expect(r.kcal).toBe(1940);
  });
});

describe('buildDayTargets — profile', () => {
  it('нейтральные цели профиля + диетпотолок', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'profile' }));
    expect(r.protein).toBe(160);
    expect(r.fats).toBe(Math.max(64, 70));
    expect(r.kcal).toBe(Math.round(r.protein * 4 + r.fats * 9 + r.carbs * 4));
  });
});
