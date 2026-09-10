import { describe, it, expect } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { validateBBPlan } from '../bb-validator.engine';
import { aggregateBBVolume } from '../bb-volume.engine';

/**
 * Ф1.1 (план CYCLE-SYSTEM-FULL-AUDIT): BB-матрица циклов.
 * 21 ББ-цикл × {male, female} × {mass, cut} — 84 сборки, на каждой:
 *   - 0 error-уровня валидатора;
 *   - фазы на всех неделях, deload-недели объёмом ≤75% предыдущей (или
 *     pump-семантика: вес ≤0.8× и RIR ≥3);
 *   - эффективный объём мышцы ≤ plan.mrvByMuscle × 1.15 (без overflow);
 *   - sets === workSets.length;
 *   - single-work-set допустим только у циклов с авторской понедельной
 *     раскладкой (sourceWeeks — пирамидальные недели дизайнера).
 */

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 120, calves: 80, abs: 60, traps: 80, forearms: 40 };
const bbCycles = LMS_CYCLES.filter(c => String(c.meta.direction) === 'bodybuilding');
const MRV_TOLERANCE = 1.15;

// Кэш сборок: ~96 полных конвертаций — дорогой прогон, строим один раз.
let _cache: { key: string; plan: ReturnType<typeof convertCycleToBBPlan> }[] | null = null;
function allBuilds() {
  if (_cache) return _cache;
  _cache = [];
  for (const c of bbCycles) {
    // Ф4: женские глут-циклы специализации — только female-строки (male-конверсия
    // вне семантики: 16+ прямых сетов глут превышают мужской MRV-кап по построению).
    const femaleOnly = c.meta.tags?.includes('female') && c.meta.tags?.includes('glutes');
    for (const sex of ['male', 'female'] as const) {
      if (femaleOnly && sex === 'male') continue;
      for (const goal of ['mass', 'cut'] as const) {
        const plan = convertCycleToBBPlan({ cycle: c, workMax, level: 'intermediate', mode: 'adapt', sex, goal } as any);
        _cache.push({ key: `${c.meta.id}/${sex}/${goal}`, plan });
      }
    }
  }
  return _cache;
}

describe('Ф1.1: BB-матрица циклов (25 × {male, female} × {mass, cut})', () => {
  it('все 84 сборки проходят валидатор без error-уровня', () => {
    for (const { key, plan } of allBuilds()) {
      const r = validateBBPlan(plan as any, { level: 'intermediate' });
      const errors = r.issues.filter((i: any) => i.level === 'error');
      expect(errors.map((e: any) => e.message), key).toHaveLength(0);
    }
  });

  it('шум-отчёт: категории taper_volume_increased и deload_volume_not_reduced отсутствуют (Ф1.1-гард)', () => {
    const counts: Record<string, number> = {};
    for (const { key, plan } of allBuilds()) {
      const r = validateBBPlan(plan as any, { level: 'intermediate' });
      for (const i of r.issues) counts[i.code] = (counts[i.code] || 0) + 1;
    }
    expect(counts['taper_volume_increased'] ?? 0, JSON.stringify(counts)).toBe(0);
    expect(counts['deload_volume_not_reduced'] ?? 0, JSON.stringify(counts)).toBe(0);
  });

  it('фазы на всех неделях; делод-недели снижены (объём ≤75% пред. или pump-семантика)', () => {
    for (const { key, plan } of allBuilds()) {
      const weeks = (plan as any).weeks as any[];
      for (const w of weeks) {
        expect(String(w.phase || ''), `${key} W${w.week}`).not.toBe('');
      }
      for (let i = 1; i < weeks.length; i++) {
        const w = weeks[i];
        if (w.phase !== 'deload' && w.deload !== true) continue;
        const sets = w.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0);
        const prevSets = weeks[i - 1].sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0);
        const meanW = (ww: any) => {
          const xs = ww.sessions.flatMap((ss: any) => ss.exercises.flatMap((e: any) => (e.workSets || []).map((x: any) => x.weight || 0))).filter((x: number) => x > 0);
          return xs.length ? xs.reduce((a: number, b: number) => a + b, 0) / xs.length : 0;
        };
        const minRir = Math.min(...w.sessions.flatMap((ss: any) => ss.exercises.map((e: any) => e.rir)).filter((x: any) => Number.isFinite(x)));
        const effortDeload = meanW(w) > 0 && meanW(w) <= meanW(weeks[i - 1]) * 0.8 && minRir >= 3;
        expect(sets <= Math.ceil(prevSets * 0.75) || effortDeload, `${key} W${w.week}: ${sets} vs ${prevSets}`).toBe(true);
      }
    }
  });

  it('эффективный объём мышцы ≤ mrvByMuscle × 1.15 (недельный MRV-кап конверт-пути)', () => {
    let checked = 0;
    for (const { key, plan } of allBuilds()) {
      const caps = (plan as any).mrvByMuscle as Record<string, number> | undefined;
      if (!caps) continue;
      for (const w of (plan as any).weeks) {
        const vol = aggregateBBVolume(w.sessions);
        for (const [muscle, values] of Object.entries(vol)) {
          const cap = caps[muscle];
          if (!cap) continue;
          checked++;
          expect(values.effectiveSets, `${key} W${w.week} ${muscle}`).toBeLessThanOrEqual(cap * MRV_TOLERANCE + 0.01);
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('sets === workSets.length; single-set только у sourceWeeks-циклов', () => {
    for (const { key, plan } of allBuilds()) {
      const srcManaged = Boolean((plan as any).pattern && (plan as any).pattern.id && String((plan as any).pattern.id).length > 0);
      for (const w of (plan as any).weeks) {
        for (const s of w.sessions) {
          for (const e of s.exercises) {
            const wsLen = (e.workSets || []).length;
            expect(Math.abs((e.sets || 0) - wsLen), `${key} W${w.week} ${e.name}`).toBeLessThanOrEqual(0.01);
            if (wsLen < 2 && w.phase !== 'deload') {
              // Авторская пирамида sourceWeeks (cycle-08 и др.) — допускается.
              expect(srcManaged, `${key} W${w.week} ${e.name} 1 сет вне авторской раскладки`).toBe(true);
            }
          }
        }
      }
    }
  });
});
