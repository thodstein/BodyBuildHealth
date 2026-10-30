/**
 * planner-carb-cap-source.test.ts — B32/B33 (аудит 2026-10).
 *
 * B32: баннер «углеводы ограничены потолком» и кнопка «Снять потолок» показывали
 * число из `calcTargets/profileTargets` — ДРУГОГО источника, чем тот, к которому
 * движок реально применил кап. В auto-режиме `calcTargets.carbs` — это остаток
 * научной цепи ДО правок ББ-плана и стиля питания, поэтому «цель N г/кг > потолка»
 * могла не совпадать с реально срезанным значением.
 *
 * Замок: `buildDayTargets` возвращает `carbsBeforeCap` — ровно то число, к которому
 * был применён потолок, и `carbCapClipped` считается по нему же. UI берёт «до капа»
 * только отсюда.
 *
 * B33: `he_planner_cap_override` читался из localStorage прямо в теле рендера, без
 * подписки; после переключения тумблера UI обновлялся лишь при следующем рендере
 * по другой причине. Теперь флаг — состояние + подписка на `storage`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDayTargets } from '../planner-day-targets';

const targets = (over: Partial<{ kcal: number; protein: number; fats: number; carbs: number }> = {}) => ({
  bmr: 1800, tdee: 3000, kcal: 4000, protein: 160, fats: 80, carbs: 660, adjustment: 0, ...over,
});

const baseInput = (over: any = {}) => ({
  weightKg: 80,
  presetGPerKg: 2.0,
  fatFloorGPerKg: 0.8,
  kbjuMode: 'auto' as const,
  calcTargets: targets(),
  profileTargets: targets({ kcal: 3200, protein: 150, fats: 70, carbs: 700 }),
  goal: 'fat_loss',
  ...over,
});

describe('B32: «до потолка» приходит из того же расчёта, что и потолок', () => {
  it('auto: carbsBeforeCap — остаток ДО капа, carbs — после', () => {
    const r = buildDayTargets(baseInput());
    // 4000 ккал, Б160/Ж80 → остаток (4000−640−720)/4 = 660 г;
    // потолок на сушке 5 г/кг × 80 кг = 400 г.
    expect(r.carbsBeforeCap).toBe(660);
    expect(r.carbs).toBe(400);
    expect(r.carbCapClipped).toBe(true);
    expect(r.carbsBeforeCap).toBeGreaterThan(r.carbs);
  });

  it('auto: без капа carbsBeforeCap равен итоговым углям', () => {
    const r = buildDayTargets(baseInput({
      calcTargets: targets({ kcal: 2600, protein: 160, fats: 70 }),
    }));
    expect(r.carbCapClipped).toBe(false);
    expect(r.carbsBeforeCap).toBe(r.carbs);
  });

  it('явное «снять потолок» (carbCapGPerKg: 0) — капа нет, «до» == «после»', () => {
    const r = buildDayTargets(baseInput({ carbCapGPerKg: 0 }));
    expect(r.carbCapClipped).toBe(false);
    expect(r.carbs).toBe(r.carbsBeforeCap);
  });

  it('profile: carbsBeforeCap — сырые угли профиля, а не пересчёт', () => {
    const r = buildDayTargets(baseInput({ kbjuMode: 'profile' }));
    expect(r.carbsBeforeCap).toBe(700);
    expect(r.carbs).toBeLessThanOrEqual(r.carbsBeforeCap);
  });

  it('manual: пользовательские угли не капятся, «до» == итог', () => {
    const r = buildDayTargets(baseInput({
      kbjuMode: 'manual',
      manual: { kcal: 3000, p: 180, f: 80, c: 500 },
    }));
    expect(r.carbs).toBe(500);
    expect(r.carbsBeforeCap).toBe(500);
    expect(r.carbCapClipped).toBeUndefined();
  });

  it('UI: «до капа» берётся из dayTargets, а не из calcTargets/profileTargets', () => {
    const ctx = readFileSync(join(__dirname, '..', 'IndividualPlanContext.tsx'), 'utf8');
    expect(ctx).toMatch(/dayTargets\.carbsBeforeCap/);
    expect(ctx).not.toMatch(/const _rawCForCap = kbjuMode === 'manual' \? dayTargets\.carbs : kbjuMode === 'profile' \? profileTargets\.carbs : calcTargets\.carbs/);
  });
});

describe('B33: оверрайд потолка — состояние + подписка, а не чтение в рендере', () => {
  const ctx = () => readFileSync(join(__dirname, '..', 'IndividualPlanContext.tsx'), 'utf8');

  it('нет синхронного чтения he_planner_cap_override в теле рендера', () => {
    expect(ctx()).not.toMatch(/const _capOverride = \(\(\) => \{ try \{ return localStorage\.getItem\('he_planner_cap_override'\)/);
  });

  it('оба потребителя флага используют состояние carbCapOverride', () => {
    const src = ctx();
    expect(src).toMatch(/if \(carbCapOverride \|\| kbjuMode === 'manual'\) return false;/);
    expect(src).toMatch(/carbCapGPerKg: \(carbCapOverride \|\| kbjuMode === 'manual'\) \? 0 : undefined/);
    expect(src).not.toMatch(/_capOverride/);
  });

  it('есть подписка на storage для синхронизации между вкладками', () => {
    const src = ctx();
    expect(src).toMatch(/addEventListener\('storage', onStorage\)/);
    expect(src).toMatch(/e\.key !== 'he_planner_cap_override'/);
  });
});
