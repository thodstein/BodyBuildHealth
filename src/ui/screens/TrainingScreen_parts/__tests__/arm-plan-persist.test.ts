import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { persistArmPlan } from '../ArmAutoConstructor';

const SRC = readFileSync(resolve(__dirname, '../ArmAutoConstructor.tsx'), 'utf8');

describe('ROUND-10: конструктор арма пишет план в ключи, которые читают хабы', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* noop */
    }
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
    const h = () => {
      fired++;
    };
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

  it('source-guard: blocked-план блокирует экспорт/скачивание, но не загрузку сохранённого варианта', () => {
    // было→стало (P1-6): exportBlocked гейтит «Скачать/Pdf/ICS», но НЕ «Загрузить/Импорт» —
    // иначе из blocked-плана нельзя выйти, загрузив валидный вариант.
    // Регэкспы терпимы к переносу атрибутов (файл проходит Prettier).
    expect(SRC).toMatch(/<AdBtn\s+variant="primary"\s+disabled=\{exportBlocked\}/);
    expect(SRC).toContain('💾 Сохранить вариант');
    expect(SRC).toMatch(
      /<AdBtn\s+variant="ghost"\s+disabled=\{exportBlocked\}\s+aria-label=\{`Скачать \$\{v\.name\} JSON`\}/,
    );
    expect(SRC).not.toMatch(/disabled=\{exportBlocked\}\s*aria-label=\{`Загрузить/);
    expect(SRC).toMatch(/aria-label=\{`Загрузить \$\{v\.name\}`\}/);
    expect(SRC).not.toMatch(/<input\s+type="file"\s+accept="application\/json,\.json"\s+disabled=\{exportBlocked\}/);
    expect(SRC).toMatch(
      /<input\s+type="file"\s+accept="application\/json,\.json"[\s\S]{0,220}aria-label="Импорт варианта JSON"/,
    );
  });
});
