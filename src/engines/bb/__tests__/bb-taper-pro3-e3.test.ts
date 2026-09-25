/**
 * bb-taper-pro3-e3.test.ts — PRO-3 Э3 «безопасность пика»:
 *   пол ккал пик-дня (Ж 1200 / М 1400, масштаб 20 ккал/кг) + формула ккал;
 *   RED-S (женщина, %жира <14) → requiresReview + warning;
 *   гейт high-water встроен в оверлеи тапера и пик-недели (SRCBB/Macrocycle пути).
 */
import { describe, it, expect } from 'vitest';
import {
  buildPeakWeek,
  buildBBContestPrep,
  buildBBContestPrepPlan,
  applyTrainingTaperToBBPlan,
  applyPeakWeekOverlayToBBPlan,
  manipulationLockedFor,
  type BBContestPrepConfig,
} from '../bb-contest-prep.engine';
import type { BBPlan } from '../bb-builder.engine';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const baseConfig = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'advanced', enhanced: false, prepCount: 2,
  showDate: addDaysIso(todayIso(), 30), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});

function makeExercise(muscle = 'chest', sets = 4, weight = 60): any {
  return {
    muscle, name: muscle === 'chest' ? 'Жим лёжа' : 'Тяга в наклоне', role: 'primary',
    character: 'тяж', sets, repsRange: [8, 12], rir: 2,
    workSets: Array.from({ length: sets }, () => ({ reps: 10, rir: 2, weight })), comment: '',
  };
}
function makePlan(weeksCount = 8): BBPlan {
  return {
    pattern: {} as any,
    weeks: Array.from({ length: weeksCount }, (_, i) => ({
      week: i + 1, phase: 'accumulation', deload: false,
      sessions: Array.from({ length: 2 }, (_, s) => ({
        day: s + 1, weekOffset: i * 7 + s, character: 'тяж',
        exercises: [makeExercise('chest'), makeExercise('back'), makeExercise('shoulders')],
      })),
    })),
    rotationMuscleVolume: {}, rationale: [],
  } as any;
}

describe('PRO-3 Э3 — пол ккал пик-дня', () => {
  it('лёгкая женщина (50 кг): шоу/D-1 ≥ 1200 ккал, формула цела, деплеция — без пола (бюджет цел)', () => {
    const cfg = baseConfig({ sex: 'female', category: 'bikini', weightKg: 50, experienceLevel: 'intermediate', prepCount: 0 });
    const days = buildPeakWeek(cfg);
    const stage = days.filter(d => d.phase === 'show' || d.phase === 'peak');
    for (const d of stage) expect(d.kcal).toBeGreaterThanOrEqual(1200);
    for (const d of days) expect(d.kcal).toBe(d.proteinG * 4 + d.carbsG * 4 + d.fatG * 9);
    expect(days.some(d => d.kcalFloorApplied === true)).toBe(true);
    expect(days.find(d => d.phase === 'show')!.kcalFloorApplied).toBe(true);
    // деплеция — плановый дефицит без пола (иначе карб-бюджет категории разъезжается)
    expect(days.filter(d => d.phase.startsWith('deplete')).every(d => d.kcalFloorApplied !== true)).toBe(true);
    const t = buildBBContestPrep(cfg);
    expect(t.warnings.join(' ')).toMatch(/Пол ккал|безопасного минимума/);
  });

  it('80 кг мужчина: шоу/D-1 ≥ max(1400, 20×вес); формула держится', () => {
    const cfg = baseConfig({ weightKg: 80 });
    const days = buildPeakWeek(cfg);
    for (const d of days.filter(x => x.phase === 'show' || x.phase === 'peak')) {
      expect(d.kcal).toBeGreaterThanOrEqual(Math.max(1400, 80 * 20));
    }
    for (const d of days) expect(d.kcal).toBe(d.proteinG * 4 + d.carbsG * 4 + d.fatG * 9);
    expect(days.some(d => d.kcalFloorApplied === true)).toBe(true);
  });
});

describe('PRO-3 Э3 — RED-S-гейт', () => {
  it('женщина %жира 12 → requiresReview + RED-S warning; %жира 16 — нет', () => {
    const risky = buildBBContestPrepPlan(baseConfig({ sex: 'female', category: 'figure', bodyFatPct: 12 }), { prepWeeks: 8, taperWeeks: 2 });
    expect(risky.safety.requiresReview).toBe(true);
    expect(risky.safety.warnings.join(' ')).toMatch(/RED-S/);
    const ok = buildBBContestPrepPlan(baseConfig({ sex: 'female', category: 'figure', bodyFatPct: 16 }), { prepWeeks: 8, taperWeeks: 2 });
    expect(ok.safety.requiresReview).toBe(false);
    expect(ok.safety.warnings.join(' ')).not.toMatch(/RED-S/);
  });

  it('мужчина %жира 10 → RED-S-правило не применяется (женский контур)', () => {
    const p = buildBBContestPrepPlan(baseConfig({ sex: 'male', bodyFatPct: 10 }), { prepWeeks: 8, taperWeeks: 2 });
    expect(p.safety.warnings.join(' ')).not.toMatch(/RED-S/);
  });
});

describe('PRO-3 Э3 — гейт high-water в оверлеях', () => {
  it('тапер-оверлей: high без trial/confirm → stable + rationale-замок; с обоими — без замка', () => {
    const plan = makePlan(8);
    const lockedCfg = baseConfig({ waterStrategy: 'high' });
    expect(manipulationLockedFor(lockedCfg)).toBe(true);
    const out = applyTrainingTaperToBBPlan(plan, lockedCfg) as any;
    expect(out.rationale.join(' ')).toMatch(/🔒|Safety gate/);
    // cfg не мутирован
    expect(lockedCfg.waterStrategy).toBe('high');
    // успешный trial и подтверждение вместе разблокируют
    const unlocked = applyTrainingTaperToBBPlan(makePlan(8), baseConfig({ waterStrategy: 'high', hasTrialPeak: true, confirmedManipulation: true })) as any;
    expect(unlocked.rationale.join(' ')).not.toMatch(/🔒|Safety gate/);
  });

  it('пик-оверлей (Macrocycle/годовой путь): та же блокировка', () => {
    const locked = applyPeakWeekOverlayToBBPlan(makePlan(6), baseConfig({ waterStrategy: 'high' })) as any;
    expect(locked.rationale.join(' ')).toMatch(/🔒|Safety gate/);
    const unlocked = applyPeakWeekOverlayToBBPlan(makePlan(6), baseConfig({ waterStrategy: 'high', hasTrialPeak: true, confirmedManipulation: true })) as any;
    expect(unlocked.rationale.join(' ')).not.toMatch(/🔒|Safety gate/);
  });
});
