import { describe, it, expect } from 'vitest';
import { injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { isPoolAllowed } from '../bb-exercise-levels.engine';
import { isBBJunk } from '../bb-builder.engine';
import { isMobilityRestricted } from '../bb-mobility.engine';
import { isAxialLoadExercise } from '../../exercise-selector.engine';
import type { BBPlan } from '../bb-builder.engine';

/**
 * K4 (BB-CORRECTIVE-HUB-PRO-PLAN): гейты вставки коррекции канонами билдера.
 * Кандидат, отсеянный гейтом (уровень/оборудование/мобильность/осевая/junk),
 * уступает следующему; все отсеяны — честный ⊘ без вставки.
 */
const cat = (id: string) => (EXERCISE_CATALOG as any[]).find((c) => String(c.id).toLowerCase() === id.toLowerCase());
function mockPlan(): BBPlan {
  return {
    pattern: { id: 'test', name: 'Test', sessionsPerRotation: 4 } as any,
    weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 0, character: 'heavy' as any, exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary' as const, exerciseName: 'bench_bar', workSets: [] } as any] } as any] } as any],
    rationale: [],
    level: 'intermediate',
  } as any;
}
const injectedEx = (res: any) => (res.plan.weeks[0].sessions as any[]).flatMap((s) => s.exercises || []).filter((e: any) => String(e.comment || '').includes('ББ-диагностика'));
const injectedId = (res: any) => injectedEx(res).map((e: any) => String(e.exerciseName || ''))[0];

describe('bb-corrective K4: гейты инъекции', () => {
  it('уровень: новичку HARD/интермедиат-кандидат уступает следующему', () => {
    const blocked = (EXERCISE_CATALOG as any[]).find((c) => !isPoolAllowed('beginner', c) && c.id !== 'goblet_squat');
    expect(blocked, 'каталог должен содержать HARD-упражнение для новичка').toBeTruthy();
    const res = injectBBWeakPoints(mockPlan(), ['chest'], {
      budget: 500, level: 'beginner',
      correctiveCandidates: { chest: [{ exerciseId: blocked!.id, allowJunk: true }, { exerciseId: 'goblet_squat', allowJunk: true }] },
    });
    expect(injectedId(res)).toBe('goblet_squat');
    expect(res.notes.join(' ')).toMatch(/заменено гейтами/);
  });
  it('оборудование: cable/machine отсекаются при dumbbell-зале, гантель проходит', () => {
    const res = injectBBWeakPoints(mockPlan(), ['chest'], {
      budget: 500, equipment: ['dumbbell', 'bodyweight'],
      correctiveCandidates: { chest: [{ exerciseId: 'cable_fly_low' }, { exerciseId: 'pec_deck' }, { exerciseId: 'fly_db' }] },
    });
    expect(injectedId(res)).toBe('fly_db');
    expect(res.notes.join(' ')).toMatch(/cable_fly_low \(оборудование\)/);
  });
  it('мобильность: жим стоя отсекается при shoulder-ограничении', () => {
    expect(isMobilityRestricted(cat('ohp'), ['shoulder'])).toBe(true);
    const res = injectBBWeakPoints(mockPlan(), ['chest'], {
      budget: 500, mobilityRestrictions: ['shoulder'],
      correctiveCandidates: { chest: [{ exerciseId: 'ohp' }, { exerciseId: 'db_press' }] },
    });
    expect(injectedId(res)).toBe('db_press');
    expect(res.notes.join(' ')).toMatch(/мобильность/);
  });
  it('осевая: при avoidAxialLoad трап/становая уступают', () => {
    expect(isAxialLoadExercise(cat('deadlift'))).toBe(true);
    const res = injectBBWeakPoints(mockPlan(), ['chest'], {
      budget: 500, avoidAxialLoad: true,
      correctiveCandidates: { chest: [{ exerciseId: 'deadlift', allowJunk: true }, { exerciseId: 'goblet_squat', allowJunk: true }] },
    });
    expect(injectedId(res)).toBe('goblet_squat');
    expect(res.notes.join(' ')).toMatch(/осевая/);
  });
  it('junk: дрилл (wall slide) проходит только осознанным allowlist', () => {
    expect(isBBJunk(cat('wall_slide'))).toBe(true);
    const withAllow = injectBBWeakPoints(mockPlan(), ['chest'], { budget: 500, correctiveCandidates: { chest: [{ exerciseId: 'wall_slide', allowJunk: true }] } });
    expect(injectedId(withAllow)).toBe('wall_slide');
    const noAllow = injectBBWeakPoints(mockPlan(), ['chest'], { budget: 500, correctiveCandidates: { chest: [{ exerciseId: 'wall_slide', allowJunk: false }, { exerciseId: 'scaption', allowJunk: true }] } });
    expect(injectedId(noAllow)).toBe('scaption');
    expect(noAllow.notes.join(' ')).toMatch(/junk-дрилл/);
  });
  it('bodyweight-упражнение не блокируется отсутствием снаряда', () => {
    const res = injectBBWeakPoints(mockPlan(), ['chest'], { budget: 500, equipment: ['barbell'], correctiveCandidates: { chest: [{ exerciseId: 'pushup', allowJunk: true }] } });
    expect(injectedId(res)).toBe('pushup');
  });
  it('все кандидаты отсеяны — ⊘ без вставки (не «skippedDup»)', () => {
    const res = injectBBWeakPoints(mockPlan(), ['chest'], {
      budget: 500, equipment: ['dumbbell'],
      correctiveCandidates: { chest: [{ exerciseId: 'cable_fly_low' }, { exerciseId: 'pec_deck' }] },
    });
    expect(res.injected).toBe(0);
    expect(res.notes.join(' ')).toMatch(/все кандидаты отсеяны/);
  });
});
