import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { BB_CORRECTIVES, correctiveExportLines } from '../bb-corrective.engine';
import { BB_WEAK_CORRECTION, injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import { prescribeCorrections } from '../bb-exercise-correction.engine';
import { diagnoseExercise } from '../bb-exercise-diagnosis.engine';
import type { BBPlan } from '../bb-builder.engine';

/**
 * K6 (BB-CORRECTIVE-HUB-PRO-PLAN): гигиена — битые fallback-id заменены, мёртвые поля
 * (equipmentAlt/regression) оживлены, пустые if-фильтры стали реальными, дубль benchWatch убран.
 */
const IDS = new Set((EXERCISE_CATALOG as any[]).map((c) => String(c.id).toLowerCase()));
const CORR_SRC = readFileSync(resolve(__dirname, '..', 'bb-corrective.engine.ts'), 'utf8');
const EX_CORR_SRC = readFileSync(resolve(__dirname, '..', 'bb-exercise-correction.engine.ts'), 'utf8');

function mockPlan(): BBPlan {
  return {
    pattern: { id: 'test', name: 'Test', sessionsPerRotation: 4 } as any,
    weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 0, character: 'heavy' as any, exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary' as const, exerciseName: 'bench_bar', workSets: [] } as any] } as any] } as any],
    rationale: [],
    level: 'intermediate',
  } as any;
}
const injectedId = (res: any) => (res.plan.weeks[0].sessions as any[]).flatMap((s) => s.exercises || []).filter((e: any) => String(e.comment || '').includes('ББ-диагностика')).map((e: any) => String(e.exerciseName || ''))[0];

describe('bb-corrective K6: гигиена и мёртвый код', () => {
  it('fallback-пул: все id реальны, битые заменены', () => {
    const miss: string[] = [];
    for (const [zone, list] of Object.entries(BB_WEAK_CORRECTION)) for (const id of list) if (!IDS.has(id.toLowerCase())) miss.push(`${zone}→${id}`);
    expect(miss).toEqual([]);
    expect(JSON.stringify(BB_WEAK_CORRECTION)).not.toMatch(/lying_tricep_extension|hanging_leg_raise/);
  });
  it('forearms-фолбэк ведёт на предплечья, а не на бицепс', () => {
    expect(BB_WEAK_CORRECTION.forearms[0]).toBe('wrist_curl_db');
    expect(BB_WEAK_CORRECTION.forearms).toContain('reverse_curl_cable');
    expect(BB_WEAK_CORRECTION.forearms).not.toContain('hammer_curl');
    expect(BB_WEAK_CORRECTION.forearms).not.toContain('curl_bar');
  });
  it('benchWatch-дубль удалён (тег ставится из benchLevel)', () => {
    expect(CORR_SRC.includes('benchWatch?')).toBe(false);
    expect(CORR_SRC.includes('s.benchWatch')).toBe(false);
    expect(CORR_SRC).toMatch(/benchLevel === 'watch'/);
  });
  it('шапка библиотеки не врёт числом записей', () => {
    expect(CORR_SRC.slice(0, 2000)).not.toMatch(/~\s*50\s+записей/);
    expect(CORR_SRC).toMatch(/BB_CORRECTIVE_COUNT/);
    expect(BB_CORRECTIVES.length).toBeGreaterThanOrEqual(40);
  });
  it('регрессия и оборудование записи выведены (exportLines/данные живы)', () => {
    for (const c of BB_CORRECTIVES) expect(c.regression.length).toBeGreaterThan(0);
    const withAlt = BB_CORRECTIVES.filter((c) => c.equipmentAlt.length > 0);
    expect(withAlt.length).toBeGreaterThan(10);
    const lines = correctiveExportLines(BB_CORRECTIVES[0], null);
    expect(lines.length).toBe(3);
  });
  it('equipmentAlt работает в инъекции: отказ по оборудованию → альтернатива записи', () => {
    const res = injectBBWeakPoints(mockPlan(), ['chest'], {
      budget: 500, equipment: ['dumbbell'],
      correctiveCandidates: { chest: [{ exerciseId: 'cable_fly_low', equipmentAlt: ['fly_db'], allowJunk: true }] },
    });
    expect(injectedId(res)).toBe('fly_db');
    expect(res.notes.join(' ')).toMatch(/оборудование → fly_db/);
  });
  it('пустые if-фильтры исправлены: реальные equipment/mobility в fallback-подборе', () => {
    expect(EX_CORR_SRC.includes('упростим не отсекаем')).toBe(false);
    expect(EX_CORR_SRC).toMatch(/machineAlways: false/);
    expect(EX_CORR_SRC).toMatch(/isMobilityRestricted\(c, ctx\.mobilityRestrictions\)/);
    // поведенчески: при bodyweight-only зале fallback не предлагает machine (ranked-путь тоже режет)
    const d = diagnoseExercise((EXERCISE_CATALOG as any[]).find((c) => c.id === 'bench_bar')!, { goal: 'hypertrophy' });
    const actions = prescribeCorrections(d, (EXERCISE_CATALOG as any[]).find((c) => c.id === 'bench_bar')!, { muscle: 'chest', equipment: ['bodyweight'] });
    for (const a of actions) {
      if (!a.targetId) continue;
      const t = (EXERCISE_CATALOG as any[]).find((c) => c.id === a.targetId);
      if (t) expect(String(t.equipment)).not.toBe('machine');
    }
  });
});
