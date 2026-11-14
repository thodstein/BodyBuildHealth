import { describe, expect, it } from 'vitest';
import { buildBBPlan, buildExercisePool, applyPreExhaustLoads } from '../bb-builder.engine';
import { musclesForRole } from '../../movement-pattern';
import { orderSessionExercises, isCompoundEx } from '../bb-session-order.engine';
import { getPattern, SPLIT_PATTERNS } from '../bb-split-patterns';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { BBExercise } from '../bb-builder.engine';

const WM = {
  chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60,
  quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60,
  traps: 80, forearms: 40,
};

function ex(partial: Partial<BBExercise>): BBExercise {
  return {
    muscle: 'glutes', name: 'Упражнение', role: 'accessory', character: 'тяж',
    sets: 3, repsRange: [8, 12], rir: 2,
    workSets: [{ reps: 10, rir: 2, weight: 60 }],
    ...partial,
  } as BBExercise;
}

function plan(patternId: string, level: 'beginner' | 'intermediate', goal: 'mass' | 'cut' | 'recomp' | 'strength_mass', sex: 'male' | 'female' = 'male', weeks = 1) {
  return buildBBPlan({ patternId, level, goal, weeks, workMax: WM, sex } as any);
}

function working(session: any) {
  return (session.exercises || []).filter((e: any) => !e.warmupActivator);
}

describe('2026-11: beginner selection + goal-aware ordering', () => {
  it('Glutes/GlutesHams: ягодицы ведут день даже при тяжёлых хамстрингах', () => {
    const ordered = orderSessionExercises([
      ex({ muscle: 'hamstrings', name: 'Сгибания ног лёжа', role: 'accessory', sets: 6 }),
      ex({ muscle: 'glutes', name: 'Ягодичный мост со штангой', role: 'primary', character: 'тяж', sets: 2 }),
    ], { sessionTag: 'GlutesHams' });
    expect(ordered[0].muscle).toBe('glutes');
  });

  it('strength_mass: ПЛ-специфика ведёт compounds, mass — обычный primary', () => {
    const list = () => [
      ex({ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3 }),
      ex({ muscle: 'chest', name: 'Жим лёжа с паузой', role: 'accessory', character: 'тяж', sets: 3 }),
    ];
    const strength = orderSessionExercises(list(), { sessionTag: 'ChestBack', goal: 'strength_mass' });
    expect(strength[0].name).toContain('паузой');
    const mass = orderSessionExercises(list(), { sessionTag: 'ChestBack', goal: 'mass' });
    expect(mass[0].name).toBe('Жим лёжа');
  });

  it('cut: тяжёлое осевое движение раньше при равном tier', () => {
    const list = () => [
      ex({ muscle: 'glutes', name: 'Ягодичный мост на полу', role: 'primary', character: 'тяж', sets: 3, workSets: [{ reps: 10, rir: 2, weight: 120 }] }),
      ex({ muscle: 'glutes', name: 'Ягодичный мост со штангой (hip thrust)', role: 'primary', character: 'тяж', sets: 3, workSets: [{ reps: 10, rir: 2, weight: 80 }] }),
    ];
    const cut = orderSessionExercises(list(), { sessionTag: 'Glutes', goal: 'cut', axialAware: true });
    expect(cut[0].name).toContain('hip thrust');
    const mass = orderSessionExercises(list(), { sessionTag: 'Glutes', goal: 'mass', axialAware: true });
    expect(mass[0].name).toContain('полу');
  });

  it('новичок: в пуле груди машина/тренажёр обгоняет свободную штангу', () => {
    const opts = {
      level: 'beginner', roleMuscles: musclesForRole('chest'), sessionTag: 'Upper',
      allowExotic: false, isPurePull: false, equipmentList: [], excludeIds: [],
      favoriteIds: [], muscle: 'chest', weakPoints: [], goal: 'cut' as const,
    };
    const pool = buildExercisePool('chest', 'primary', opts as any);
    const machine = pool.find(e => /Жим в грудном тренажёре|Жим в тренажёре на наклонной/i.test(e.name || ''));
    const barbell = pool.find(e => /Жим штанги на наклонной/i.test(e.name || ''));
    expect(machine).toBeDefined();
    expect(barbell).toBeDefined();
    expect(Number(machine?._score || 0)).toBeGreaterThan(Number(barbell?._score || 0));
  });

  it.each(['female_glute_3', 'female_glute_5', 'female_lower_upper_4', 'female_upper_glute_4'])(
    '%s: каждая glute-сессия начинается с ягодиц и имеет hip-thrust якорь',
    (patternId) => {
      expect(getPattern(patternId)).toBeDefined();
      const p = plan(patternId, 'beginner', 'cut', 'female');
      const gluteSessions = p.weeks[0].sessions.filter((s: any) => /Glutes/i.test(s.sessionTag || ''));
      expect(gluteSessions.length).toBeGreaterThan(0);
      for (const s of gluteSessions) {
        const list = working(s);
        expect(list.length).toBeGreaterThan(0);
        expect(list[0].muscle).toBe('glutes');
        expect(list.some((e: any) => /мост|hip.?thrust|bridge/i.test(e.name || '') || /мост|hip.?thrust|bridge/i.test(e.exerciseName || ''))).toBe(true);
        // Новичку в главном движении glute-дня — двусторонний вариант, не B-stance.
        expect(list.some((e: any) => /b-?stance|одна нога|одной ног|single.?leg|one.?leg/i.test(e.name || ''))).toBe(false);
      }
    },
  );

  it('новичок: primary крупной мышцы — компаунд, не единственная изоляция', () => {
    for (const patternId of ['fullbody_3', 'upper_lower_4', 'ppl_6', 'female_glute_5']) {
      const p = plan(patternId, 'beginner', 'cut', patternId.startsWith('female_') ? 'female' : 'male');
      for (const s of p.weeks[0].sessions) {
        const primaries = working(s).filter((e: any) => e.role === 'primary');
        const big = primaries.filter((e: any) => ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'triceps'].includes(e.muscle));
        const byMuscle = new Map<string, any[]>();
        for (const e of big) byMuscle.set(e.muscle, [...(byMuscle.get(e.muscle) || []), e]);
        for (const [, list] of byMuscle) {
          expect(list.some((e: any) => isCompoundEx(e))).toBe(true);
        }
      }
    }
  });

  it('новичок без bodyweightCapability: никаких подтягиваний, разминка легче рабочего сета', () => {
    for (const patternId of ['fullbody_3', 'upper_lower_4', 'ppl_6', 'female_glute_5']) {
      const p = plan(patternId, 'beginner', 'cut', patternId.startsWith('female_') ? 'female' : 'male');
      for (const s of p.weeks[0].sessions) {
        const all = s.exercises as any[];
        expect(all.some(e => /подтяг|pull.?up|chin.?up/i.test(String(e.name || '')))).toBe(false);
        for (const warm of all.filter(e => e.warmupActivator)) {
          const work = all.filter(e => !e.warmupActivator && e.muscle === warm.muscle && Number(e.workSets?.[0]?.weight) > 0);
          if (!work.length) continue;
          const minWork = Math.min(...work.map(e => Number(e.workSets[0].weight)));
          expect(Number(warm.workSets?.[0]?.weight || 0)).toBeLessThan(minWork);
        }
      }
    }
  });

  it('новичок: каталожно advanced-движения не попадают в рабочие слоты', () => {
    const difficulty = new Map(
      EXERCISE_CATALOG.map((e: any) => [String(e.name || ''), String(e.difficulty || 'beginner')]),
    );
    const found: string[] = [];
    const goals: Array<'mass' | 'cut' | 'recomp' | 'strength_mass'> = ['mass', 'cut', 'recomp', 'strength_mass'];
    for (const sp of SPLIT_PATTERNS) {
      const sex = sp.id.startsWith('female_') ? 'female' : 'male';
      for (const goal of goals) {
        const p = plan(sp.id, 'beginner', goal, sex, 8);
        for (const w of p.weeks) {
          for (const s of w.sessions) {
            for (const e of working(s)) {
              if (difficulty.get(String(e.name || '')) === 'advanced') {
                found.push(`${sp.id}/${goal}/w${w.week}/${s.sessionTag}: ${e.name}`);
              }
            }
          }
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('финальные метаданные: Butterfly — isolation и не второй primary', () => {
    const p = plan('fullbody_3', 'beginner', 'cut');
    const butterfly = p.weeks[0].sessions.flatMap((s: any) => s.exercises)
      .find((e: any) => /Butterfly/i.test(String(e.name || '')));
    expect(butterfly).toBeDefined();
    expect(butterfly.exerciseType || butterfly.type).toBe('isolation');
    expect(butterfly.role).toBe('accessory');
  });

  it('female_bikini_5 ShouldersArms: после разминки первым идёт жим, не махи', () => {
    const p = plan('female_bikini_5', 'beginner', 'cut', 'female');
    const s = p.weeks[0].sessions.find((x: any) => x.sessionTag === 'ShouldersArms');
    expect(s).toBeDefined();
    const work = working(s);
    expect(work[0].muscle).toBe('shoulders');
    expect(work[0].exerciseType || work[0].type).toBe('compound');
  });

  it('pre_exhaust: −10 % только у compound после реальной изоляции-праймера', () => {
    const mk = (o: Partial<BBExercise>) => ex({
      role: 'primary', character: 'тяж', rir: 2,
      workSets: [{ reps: 8, rir: 2, weight: 100 }],
      warmupSets: [{ load: 80, reps: 5 }],
      comment: '🎯 Основное: chest. Накопление, RIR 2 — 3×8 @ 100 кг',
      ...o,
    } as any);
    const chestCompound = () => mk({ muscle: 'chest', name: 'Жим штанги лёжа', exerciseType: 'compound' } as any);
    const chestFly = () => mk({ muscle: 'chest', name: 'Разводка гантелей', exerciseType: 'isolation', workSets: [{ reps: 12, rir: 2, weight: 30 }], warmupSets: [], comment: '🎯 Основное: chest. 3×12 @ 30 кг' } as any);

    const compound = chestCompound();
    const fly = chestFly();
    applyPreExhaustLoads([fly, compound]);
    expect(compound.workSets[0].weight).toBe(90);
    expect(compound.warmupSets![0].load).toBe(72);
    expect(compound.comment).toContain('@ 90 кг');
    // Сама изоляция-праймер не утяжеляется и не облегчается методикой.
    expect(fly.workSets[0].weight).toBe(30);
    expect(fly.comment).toContain('@ 30 кг');

    // Нет праймера — нет скидки (раньше это был скрытый −10 % для всех primary).
    const noPrimer = chestCompound();
    applyPreExhaustLoads([noPrimer]);
    expect(noPrimer.workSets[0].weight).toBe(100);
    expect(noPrimer.comment).toContain('@ 100 кг');

    // Праймер после compound — это уже не pre-exhaust.
    const beforePrimer = chestCompound();
    applyPreExhaustLoads([beforePrimer, chestFly()]);
    expect(beforePrimer.workSets[0].weight).toBe(100);

    // Изоляция другой мышцы не является праймером для груди.
    const backIso = mk({ muscle: 'back', name: 'Тяга верхнего блока', exerciseType: 'isolation', workSets: [{ reps: 12, rir: 2, weight: 40 }], warmupSets: [] } as any);
    const crossMuscle = chestCompound();
    applyPreExhaustLoads([backIso, crossMuscle]);
    expect(crossMuscle.workSets[0].weight).toBe(100);
  });

  it('compound-first: изоляция не ведёт день, если есть компаунд крупной мышцы', () => {
    const major = new Set(['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders']);
    const check = (patternId: string, level: 'beginner' | 'intermediate', goal: 'mass' | 'cut', sessionTag?: string) => {
      const p = plan(patternId, level, goal);
      const sessions = p.weeks[0].sessions.filter((s: any) => !sessionTag || s.sessionTag === sessionTag);
      expect(sessions.length).toBeGreaterThan(0);
      for (const s of sessions) {
        const list = working(s);
        const hasMajorCompound = list.some((e: any) => e.exerciseType === 'compound' && major.has(e.muscle));
        if (hasMajorCompound) {
          expect(list[0].exerciseType, `${patternId}/${level}/${goal}/${s.sessionTag}: first=${list[0].name}`).toBe('compound');
        }
      }
    };
    check('fullbody_3', 'beginner', 'mass');
    check('bro_5', 'intermediate', 'mass', 'Legs');
  });

  it('pre_exhaust сохраняет изоляцию первой (исключение из compound-first)', () => {
    const ordered = orderSessionExercises([
      ex({ muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 3 }),
      ex({ muscle: 'chest', name: 'Разводка гантелей лёжа', role: 'accessory', character: 'памп', sets: 3 }),
    ], { sessionTag: 'ChestBack', methodology: 'pre_exhaust' });
    expect(ordered[0].name).toContain('Разводка');
  });
});
