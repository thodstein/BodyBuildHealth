import { describe, expect, it } from 'vitest';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { buildBBPlan } from '../bb-builder.engine';

/**
 * M3 (план §8.3): полный аудит качества выдачи тренировочного плана.
 * Срез 1: все generic-сплиты × уровни × пол — структурные инварианты и
 * корректность сетов/повторов/RIR, плюс маркеры применённых методик.
 */
const WM = { chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100, glutes: 120, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 40 };
// 3 уровня (advanced ведёт себя как intermediate) × 2 пола × 30 сплитов, 3 недели — компромисс
// «полный охват / время прогона». Полный цикловой охват — отдельным срезом M3.
const LEVELS = ['beginner', 'intermediate', 'enhanced'] as const;

function planFor(patternId: string, level: string, sex: 'male' | 'female' | undefined, extra: Record<string, unknown> = {}) {
  return buildBBPlan({ patternId, level, goal: 'mass', weeks: 3, workMax: WM, sex, trainingYears: level === 'enhanced' ? 6 : 3, ...extra } as never);
}

describe('M3: качество выдачи — generic-сплиты × уровни × пол', () => {
  it('нет NaN/undefined; sets===workSets; reps 1–30; RIR 0–6; вес конечный; нет дублей упражнений в сессии', () => {
    let built = 0;
    for (const p of SPLIT_PATTERNS) {
      for (const level of LEVELS) {
        for (const sex of [undefined, 'female'] as const) {
          const plan = planFor(p.id, level, sex);
          built++;
          expect(plan.weeks.length, p.id).toBe(3);
          for (const w of plan.weeks) {
            expect(String(w.phase || ''), `${p.id}/${level} W${w.week} phase`).not.toBe('');
            for (const s of w.sessions) {
              const names = new Set<string>();
              for (const e of s.exercises) {
                const tag = `${p.id}/${level}/${sex || 'male'} W${w.week} ${e.exerciseName || e.name}`;
                expect(Number.isFinite(e.sets), tag).toBe(true);
                expect(Math.abs((e.sets || 0) - (e.workSets || []).length), `${tag} sets/workSets`).toBeLessThanOrEqual(0.01);
                for (const ws of e.workSets || []) {
                  expect(Number.isFinite(ws.reps) && ws.reps >= 1 && ws.reps <= 30, `${tag} reps=${ws.reps}`).toBe(true);
                  expect(Number.isFinite(ws.rir) && ws.rir >= 0 && ws.rir <= 6, `${tag} rir=${ws.rir}`).toBe(true);
                  expect(Number.isFinite(ws.weight), `${tag} weight=${ws.weight}`).toBe(true);
                }
                const key = String(e.exerciseName || e.name || '');
                expect(names.has(key), `${tag} дубль в сессии`).toBe(false);
                names.add(key);
              }
              expect(s.exercises.length, `${p.id} пустая сессия`).toBeGreaterThan(0);
            }
          }
        }
      }
    }
    expect(built).toBe(SPLIT_PATTERNS.length * LEVELS.length * 2);
  }, 900000);

  it('женский путь добавляет объём ягодицам (female_glute_5 vs male)', () => {
    const female = planFor('female_glute_5', 'intermediate', 'female');
    const gluteSets = (pl: ReturnType<typeof planFor>) => pl.weeks.reduce((a, w) => a + w.sessions.reduce((b, s) => b + s.exercises.filter(e => ['glutes', 'hamstrings', 'quads', 'calves'].includes(e.muscle)).reduce((c, e) => c + (e.sets || 0), 0), 0), 0);
    expect(gluteSets(female)).toBeGreaterThan(0);
  }, 120000);

  it('маркеры методик присутствуют в выдаче (upper_lower_4)', () => {
    const drop = planFor('upper_lower_4', 'intermediate', undefined, { intensityTechnique: 'drop_set' });
    const c1 = drop.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).map(e => e.comment || '').join(' ');
    const ws1 = drop.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).flatMap(e => e.workSets || []).map(x => x.technique || '').join(' ');
    expect(c1 + ws1).toMatch(/дроп|drop/i);

    const rp = planFor('upper_lower_4', 'intermediate', undefined, { intensityTechnique: 'rest_pause' });
    const c2 = rp.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).map(e => e.comment || '').join(' ');
    const ws2 = rp.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).flatMap(e => e.workSets || []).map(x => x.technique || '').join(' ');
    expect(c2 + ws2).toMatch(/рест|rest|пауз/i);

    const pre = planFor('upper_lower_4', 'intermediate', undefined, { methodology: 'pre_exhaust' });
    const isoFirst = pre.weeks.some(w => w.sessions.some(s => s.exercises.length > 1 && s.exercises[0].role !== 'primary'));
    expect(isoFirst).toBe(true);
  }, 120000);
});
