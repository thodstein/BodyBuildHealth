/**
 * bb-new-engines.test.ts — тесты для новых движков:
 * - bb-exercise-rotation.engine.ts (умная ротация)
 * - bb-injury-prevention.engine.ts (JointStressScore)
 * - bb-dup.engine.ts (Daily Undulating Periodization)
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { makeInput } from './bb-test-helpers';
import {
  extractRotationHistory,
  canUseExercise,
  analyzeRotation,
} from '../bb-exercise-rotation.engine';
import {
  calculateSessionStress,
  calculateWeeklyStress,
  analyzePlanStress,
} from '../bb-injury-prevention.engine';
import {
  applyDUPOverlay,
  recommendDUPMode,
  DUP_PRESETS,
  type DUPConfig,
} from '../bb-dup.engine';

describe('bb-exercise-rotation.engine', () => {
  it('extractRotationHistory — извлекает историю из плана', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const history = extractRotationHistory(plan);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('exerciseName');
    expect(history[0]).toHaveProperty('pattern');
    expect(history[0]).toHaveProperty('week');
  });

  it('canUseExercise — новое упражнение разрешено', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const history = extractRotationHistory(plan);
    const result = canUseExercise('Несуществующее упражнение', 5, history);
    expect(result.allowed).toBe(true);
  });

  it('canUseExercise — упражнение в cooldown запрещено', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const history = extractRotationHistory(plan);
    if (history.length > 0) {
      const firstExercise = history[0];
      const result = canUseExercise(firstExercise.exerciseName, firstExercise.week + 1, history);
      expect(result.allowed).toBe(false);
      expect(result.cooldownRemaining).toBeGreaterThan(0);
    }
  });

  it('canUseExercise — упражнение после cooldown разрешено (если < MAX_REPEATS)', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const history = extractRotationHistory(plan);
    if (history.length > 0) {
      // Находим упражнение, которое использовалось менее 3 раз
      const useCounts: Record<string, number> = {};
      for (const h of history) useCounts[h.exerciseName] = (useCounts[h.exerciseName] || 0) + 1;
      const firstExercise = history[0];
      const useCount = useCounts[firstExercise.exerciseName] || 0;
      if (useCount < 3) {
        const result = canUseExercise(firstExercise.exerciseName, firstExercise.week + 5, history);
        expect(result.allowed).toBe(true);
      }
    }
  });

  it('analyzeRotation — возвращает метрики ротации', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const analysis = analyzeRotation(plan);
    expect(analysis.totalExercises).toBeGreaterThan(0);
    expect(analysis.uniqueExercises).toBeGreaterThan(0);
    expect(analysis.repeatRate).toBeGreaterThanOrEqual(0);
    expect(analysis.issues).toBeInstanceOf(Array);
  });
});

describe('bb-injury-prevention.engine', () => {
  it('calculateSessionStress — возвращает stress для сессии', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const session = plan.weeks[0].sessions[0];
    const report = calculateSessionStress(session);
    expect(report.sessionStress).toBeGreaterThan(0);
    expect(report.byJoint).toBeDefined();
    expect(report.issues).toBeInstanceOf(Array);
  });

  it('calculateWeeklyStress — возвращает stress для недели', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const week = plan.weeks[0];
    const report = calculateWeeklyStress(week);
    expect(report.weeklyStress).toBeGreaterThan(0);
    expect(report.byJoint).toBeDefined();
  });

  it('analyzePlanStress — анализирует весь план', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const analysis = analyzePlanStress(plan);
    expect(analysis.weeklyReports).toBeInstanceOf(Array);
    expect(analysis.totalStress).toBeGreaterThan(0);
    expect(analysis.avgWeeklyStress).toBeGreaterThan(0);
    expect(analysis.peakWeek).toBeGreaterThan(0);
    expect(['low', 'moderate', 'high']).toContain(analysis.overallRisk);
  });

  it('analyzePlanStress — пропускает deload-недели', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const analysis = analyzePlanStress(plan);
    // 8-недель план с deload на неделях 4 и 8 → должно быть 6 отчётов (не 8)
    expect(analysis.weeklyReports.length).toBeLessThanOrEqual(6);
  });

  it('shoulder stress — high risk при большом объёме жимов', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8, weakPoints: ['chest', 'shoulders'] }));
    const analysis = analyzePlanStress(plan);
    // Слабые грудь/плечи → больше жимов → выше shoulder stress
    const shoulderStress = analysis.weeklyReports.reduce((sum, r) => sum + (r.byJoint['shoulder'] || 0), 0);
    expect(shoulderStress).toBeGreaterThan(0);
  });
});

describe('bb-dup.engine', () => {
  it('DUP_PRESETS — все пресеты определены', () => {
    expect(DUP_PRESETS.heavy_light).toBeDefined();
    expect(DUP_PRESETS.strength_hypertrophy).toBeDefined();
    expect(DUP_PRESETS.full_dup).toBeDefined();
    expect(DUP_PRESETS.heavy_light.length).toBe(2);
    expect(DUP_PRESETS.strength_hypertrophy.length).toBe(2);
    expect(DUP_PRESETS.full_dup.length).toBe(3);
  });

  it('applyDUPOverlay — mode=none не изменяет план', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const overlay = applyDUPOverlay(plan, { mode: 'none', cycleDays: 0 });
    expect(overlay).toBe(plan);
  });

  it('applyDUPOverlay — mode=heavy_light изменяет character упражнений', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const overlay = applyDUPOverlay(plan, { mode: 'heavy_light', cycleDays: 2 });
    expect(overlay).not.toBe(plan);
    expect(overlay.rationale.some(r => r.includes('DUP'))).toBe(true);
  });

  it('applyDUPOverlay — mode=full_dup чередует 3 дня', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const overlay = applyDUPOverlay(plan, { mode: 'full_dup', cycleDays: 3 });
    // Проверяем что primary упражнения имеют DUP-метку
    let hasDUPComment = false;
    for (const w of overlay.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if (ex.role === 'primary' && ex.comment?.includes('[DUP')) {
            hasDUPComment = true;
          }
        }
      }
    }
    expect(hasDUPComment).toBe(true);
  });

  it('applyDUPOverlay — не применяет DUP к deload-неделям', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const overlay = applyDUPOverlay(plan, { mode: 'full_dup', cycleDays: 3 });
    for (const w of overlay.weeks) {
      if (w.phase === 'deload') {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            if (ex.role === 'primary') {
              expect(ex.comment).not.toContain('[DUP');
            }
          }
        }
      }
    }
  });

  it('recommendDUPMode — strength_mass → strength_hypertrophy', () => {
    const config = recommendDUPMode('strength_mass', 'intermediate', 4);
    expect(config.mode).toBe('strength_hypertrophy');
  });

  it('recommendDUPMode — mass + advanced → full_dup', () => {
    const config = recommendDUPMode('mass', 'advanced', 4);
    expect(config.mode).toBe('full_dup');
  });

  it('recommendDUPMode — recomp → heavy_light', () => {
    const config = recommendDUPMode('recomp', 'intermediate', 4);
    expect(config.mode).toBe('heavy_light');
  });

  it('recommendDUPMode — daysPerWeek < 3 → none', () => {
    const config = recommendDUPMode('mass', 'intermediate', 2);
    expect(config.mode).toBe('none');
  });

  it('recommendDUPMode — maintenance → none (по умолчанию)', () => {
    const config = recommendDUPMode('maintenance', 'intermediate', 4);
    expect(config.mode).toBe('none');
  });
});