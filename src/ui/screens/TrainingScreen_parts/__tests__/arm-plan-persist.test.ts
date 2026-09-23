import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { persistArmPlan } from '../ArmAutoConstructor';

const SRC = readFileSync(resolve(__dirname, '../ArmAutoConstructor.tsx'), 'utf8');

describe('ROUND-10: конструктор арма пишет план в ключи, которые читают хабы', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* noop */ }
  });

  it('persistArmPlan пишет оба ключа (хабы читают he_arm_plan_saved)', () => {
    const plan = { pattern: { id: 'p' }, weeks: [{ week: 1 }] };
    persistArmPlan(plan);
    const last = localStorage.getItem('he_arm_last_plan');
    const saved = localStorage.getItem('he_arm_plan_saved');
    expect(last).toBeTruthy();
    expect(saved).toBe(last);
    expect(JSON.parse(saved!)).toEqual(plan);
  });

  it('persistArmPlan шлёт событие he-arm-plan-saved (живой аудит хаба)', () => {
    let fired = 0;
    const h = () => { fired++; };
    window.addEventListener('he-arm-plan-saved', h);
    try {
      persistArmPlan({ weeks: [] });
      expect(fired).toBe(1);
    } finally {
      window.removeEventListener('he-arm-plan-saved', h);
    }
  });

  it('source-guard: запись плана — только через persistArmPlan (нет голого he_arm_last_plan)', () => {
    expect(SRC).toMatch(/export function persistArmPlan/);
    expect(SRC).toMatch(/setItem\('he_arm_plan_saved'/);
    expect(SRC).toMatch(/dispatchEvent\(new Event\('he-arm-plan-saved'\)\)/);
    // ровно один прямой setItem — внутри самого persistArmPlan (иначе снова «план не доходит до хабов»)
    expect((SRC.match(/setItem\('he_arm_last_plan'/g) || []).length).toBe(1);
    expect(SRC).not.toMatch(/setItem\('he_arm_last_plan', JSON\.stringify/);
    expect((SRC.match(/persistArmPlan\(/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
