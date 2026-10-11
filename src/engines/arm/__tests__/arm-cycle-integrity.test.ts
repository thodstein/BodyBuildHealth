/**
 * arm-cycle-integrity.test.ts — постоянный lock целостности именных циклов.
 * Первая версия (проба Oct-2026) нашла 5 реальных дефектов данных:
 * cycles 8+ недель без единой разгрузки (strengthlog_8, ivakin, levan),
 * dobrorezov_44 без рабочих разгрузок (maxRun=23) и kuznica без разгрузки
 * между блоками. Тест стережёт и структуру, и каденс.
 */
import { describe, it, expect } from 'vitest';
import { ARM_CYCLE_LIBRARY } from '../arm-cycle-library.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';

/** Циклы, у которых разгрузка в фазовой карте не предусмотрена ИСТОЧНИКОМ. */
const DELOAD_FREE_BY_SOURCE = new Set([
  'larratt_table_bloodflow', // Larratt: «без PR в цикле», 17-18 heavy singles
  'toproll_6',               // разгрузка вынесена на 7-ю неделю (после цикла)
]);

describe('arm-cycle integrity: фазовая карта', () => {
  it('каждая неделя 1..weeks покрыта фазой (нет дыр)', () => {
    for (const c of ARM_CYCLE_LIBRARY) {
      const missing: number[] = [];
      for (let w = 1; w <= c.weeks; w++) if (!c.phases[w]) missing.push(w);
      expect(missing, `${c.id}: недели без фазы ${missing.join(',')}`).toEqual([]);
    }
  });

  it('каждый цикл ≥8 нед несёт разгрузку (кроме документированных исключений)', () => {
    for (const c of ARM_CYCLE_LIBRARY) {
      if (c.weeks < 8) continue;
      if (DELOAD_FREE_BY_SOURCE.has(c.id)) continue;
      const deloads = Object.values(c.phases).filter((p) => p === 'deload').length;
      expect(deloads, `${c.id}: ${c.weeks} нед без разгрузки`).toBeGreaterThan(0);
    }
  });

  it('нет фаза-ранов длиннее 6 недель (долгий моноблок = непериодизованность)', () => {
    for (const c of ARM_CYCLE_LIBRARY) {
      if (DELOAD_FREE_BY_SOURCE.has(c.id)) continue; // документированный моноблок источника
      let run = 1;
      let maxRun = 1;
      let prev = '';
      for (let w = 1; w <= c.weeks; w++) {
        const ph = c.phases[w] || '';
        run = ph === prev ? run + 1 : 1;
        if (run > maxRun) maxRun = run;
        prev = ph;
      }
      expect(maxRun, `${c.id}: run ${maxRun} недель одной фазы`).toBeLessThanOrEqual(6);
    }
  });

  it('dobrorezov_44: разгрузка каждую 4-ю неделю, как объявляет deloadRule', () => {
    const c = ARM_CYCLE_LIBRARY.find((x) => x.id === 'dobrorezov_44')!;
    const deloads = Object.entries(c.phases).filter(([, p]) => p === 'deload').map(([w]) => Number(w));
    expect(deloads).toEqual([4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44]);
  });

  it('исключения по источнику реально существуют и документированы в deloadRule', () => {
    const larratt = ARM_CYCLE_LIBRARY.find((x) => x.id === 'larratt_table_bloodflow')!;
    expect(larratt.deloadRule).toMatch(/PR/i); // «без PR в цикле»
    const toproll = ARM_CYCLE_LIBRARY.find((x) => x.id === 'toproll_6')!;
    expect(toproll.deloadRule).toMatch(/7/i); // «на 7-й неделе (после цикла)»
  });
});

describe('arm-cycle integrity: сборка и валидация всех циклов', () => {
  it('все 27 циклов собираются с согласием и дают 0 errors валидатора', () => {
    for (const c of ARM_CYCLE_LIBRARY) {
      const level = (c.level[0] || 'intermediate') as any;
      let plan: any = null;
      try {
        plan = buildArmPlan({
          discipline: 'armwrestling', patternId: 'arm_3_full', level,
          goal: 'strength', technique: 'balanced', weeks: c.weeks,
          cycleId: c.id, cycleConsent: true,
        });
        plan = finalizeArmPlan(plan, { level });
      } catch (e: any) {
        throw new Error(`${c.id}: build threw ${e?.message || e}`);
      }
      const v = validateArmPlan(plan, level);
      expect(v.errors, `${c.id}: ${v.errors.slice(0, 3).join(' | ')}`).toEqual([]);
      expect(plan.weeks.length).toBe(c.weeks);
    }
  });
});
