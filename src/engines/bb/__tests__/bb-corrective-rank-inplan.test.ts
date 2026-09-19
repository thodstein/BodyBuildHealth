import { describe, it, expect } from 'vitest';
import { rankCorrectives, correctiveById } from '../bb-corrective.engine';
import { injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import { equipmentAllows } from '../bb-correction-rank.engine';
import type { BBPlan } from '../bb-builder.engine';

/**
 * K5 (BB-CORRECTIVE-HUB-PRO-PLAN): библиотечный ранжир знает план (inPlan) и не отдаёт дубль;
 * политика оборудования библиотеки строже каталожной (machine — только при явном тренажёре).
 */
function mockPlan(): BBPlan {
  return {
    pattern: { id: 'test', name: 'Test', sessionsPerRotation: 4 } as any,
    weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 0, character: 'heavy' as any, exercises: [{ muscle: 'quads', name: 'Гоблет-присед', sets: 3, role: 'primary' as const, exerciseName: 'goblet_squat', workSets: [] } as any] } as any] } as any],
    rationale: [],
    level: 'intermediate',
  } as any;
}
const injectedId = (res: any) => (res.plan.weeks[0].sessions as any[]).flatMap((s) => s.exercises || []).filter((e: any) => String(e.comment || '').includes('ББ-диагностика')).map((e: any) => String(e.exerciseName || ''))[0];

describe('bb-corrective K5: inPlan-альтернатива и единое оборудование', () => {
  it('топ библиотеки исключается, если упражнение уже в плане (альтернатива вместо skippedDup)', () => {
    const base = rankCorrectives({ zones: ['quads'] });
    const topId = base[0].corr.exerciseId;
    const withPlan = rankCorrectives({ zones: ['quads'], inPlanIds: [topId] });
    expect(withPlan.map((x) => x.corr.exerciseId)).not.toContain(topId);
    expect(withPlan.length).toBeGreaterThan(0);
  });
  it('инъекция: зона с топ-1 в плане вставляет альтернативу, а не skippedDup', () => {
    const plan = mockPlan();
    expect((plan.weeks[0].sessions[0] as any).exercises[0].exerciseName).toBe('goblet_squat');
    const ranked = rankCorrectives({ zones: ['quads'], inPlanIds: ['goblet_squat'] });
    expect(ranked.map((x) => x.corr.exerciseId)).not.toContain('goblet_squat');
    const res = injectBBWeakPoints(plan, ['quads'], {
      budget: 500,
      correctiveCandidates: { quads: ranked.slice(0, 3).map((x) => ({ exerciseId: x.corr.exerciseId, allowJunk: true })) },
    });
    expect(res.injected).toBe(1);
    expect(injectedId(res)).not.toBe('goblet_squat');
  });
  it('оборудование библиотеки: dumbbell-only зал не получает тренажёрных коррекций', () => {
    const ids = rankCorrectives({ zones: ['quads'], equipment: ['dumbbell', 'bodyweight'] }).map((x) => x.corr.exerciseId);
    expect(ids).toContain('goblet_squat');
    expect(ids).not.toContain('leg_press');
    expect(ids).not.toContain('leg_ext');
    // каталожный дефолт (calibrated-лок max-pro) сохраняет machine-доступность — политика вызывается с опцией
    expect(equipmentAllows('machine', ['dumbbell'])).toBe(true);
    expect(equipmentAllows('machine', ['dumbbell'], { machineAlways: false })).toBe(false);
  });
  it('гейт машины держится и при явном preferred (инъекция строже каталожного ранжира)', () => {
    const res = injectBBWeakPoints(mockPlan(), ['quads'], { budget: 500, preferredIds: { quads: 'leg_press' }, equipment: ['dumbbell'] });
    expect(res.injected).toBe(0);
    expect(res.notes.join(' ')).toMatch(/leg_press отсеян \(оборудование\)/);
  });
  it('запись библиотеки с inPlan не теряет другие зоны (ротация альтернатив)', () => {
    const all = rankCorrectives({ zones: ['delt_mid'] }).map((x) => x.corr.exerciseId);
    expect(all.length).toBeGreaterThan(1);
    const without = rankCorrectives({ zones: ['delt_mid'], inPlanIds: [all[0]] }).map((x) => x.corr.exerciseId);
    expect(without).not.toContain(all[0]);
    expect(without.length).toBeGreaterThan(0);
    expect(correctiveById('dm-lateral-pause')).toBeTruthy();
  });
});
