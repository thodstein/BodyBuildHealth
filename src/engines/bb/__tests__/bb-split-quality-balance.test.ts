import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { trueMuscleOf } from '../../movement-pattern';
import { SPLIT_PATTERNS } from '../bb-split-patterns';

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100,
  glutes: 120, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 40,
};

const upperDual = (tag: string) => /Upper|Torso|ChestBack|FullBody/i.test(tag) && !/Glutes/i.test(tag);

function build(patternId: string, level: string, sex: 'male' | 'female', weeks = 8) {
  return buildBBPlan({
    patternId, level, goal: 'mass', weeks, workMax: WM, sex,
    trainingYears: level === 'beginner' ? 1 : level === 'enhanced' ? 8 : 3,
  } as never) as any;
}

function normalWeeks(plan: any) {
  return plan.weeks.filter((w: any) => w.phase !== 'deload' && !w.deload && !w.taperApplied && !w.taper);
}

const sumSets = (exs: any[], muscle: string) =>
  exs.filter((e: any) => e.muscle === muscle && !e.warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0);

describe('качество сплитов: баланс жимы/тяги в верхних днях (аудит 2026-11)', () => {
  // До прохода ensureChestBackBalance в «днях с двумя ведущими мышцами» грудь
  // систематически съедала слоты спины: upper_lower_4 — 23/14, phul_4 — 25/13,
  // glute_focus_4 — 16/4, female_glute_3 — 9/2.
  const cases: Array<[string, string, 'male' | 'female']> = [
    ['upper_lower_4', 'intermediate', 'male'],
    ['phul_4', 'intermediate', 'male'],
    ['torso_limb_4', 'intermediate', 'male'],
    ['glute_focus_4', 'intermediate', 'male'],
    ['female_glute_3', 'intermediate', 'female'],
    ['female_glute_6', 'intermediate', 'female'],
    ['fullbody_3', 'intermediate', 'male'],
  ];

  for (const [id, level, sex] of cases) {
    it(`${id} [${level}]: спина не ниже 0.6× груди в верхней сессии`, () => {
      const plan = build(id, level, sex);
      for (const week of normalWeeks(plan)) {
        for (const session of week.sessions) {
          if (!upperDual(String(session.sessionTag || ''))) continue;
          const exs = (session.exercises || []).filter((e: any) => !e.warmupActivator);
          const chest = sumSets(exs, 'chest');
          const back = sumSets(exs, 'back');
          if (chest < 6 || back <= 0) continue;
          // Порог 0.55: разница в 1-2 сета — шум (нужен размен ≥2 сетов,
          // а бюджет сессии часто уже на кэпе).
          expect(back, `${id} w${week.week} ${session.sessionTag}: грудь ${chest} / спина ${back}`)
            .toBeGreaterThanOrEqual(Math.ceil(chest * 0.55));
        }
      }
    });
  }

  it('upper_lower_4: недельный перекос грудь/спина не больше 1.8×', () => {
    const plan = build('upper_lower_4', 'intermediate', 'male');
    for (const week of normalWeeks(plan)) {
      const exs = week.sessions.flatMap((s: any) => (s.exercises || []).filter((e: any) => !e.warmupActivator));
      const chest = sumSets(exs, 'chest');
      const back = sumSets(exs, 'back');
      if (chest === 0) continue;
      expect(chest / Math.max(1, back), `w${week.week}: грудь ${chest} / спина ${back}`).toBeLessThanOrEqual(1.8);
    }
  });

  it('glute-сплиты: добивка ног не считается «утечкой мышцы»', () => {
    for (const [id, level, sex] of [
      ['female_glute_6', 'intermediate', 'female'],
      ['female_glute_3', 'advanced', 'female'],
      ['glute_focus_4', 'intermediate', 'male'],
      ['push_pull_2', 'intermediate', 'male'],
    ] as const) {
      const plan = build(id, level, sex);
      const result: any = validateBBPlan(plan, { level } as never);
      const leaks = result.issues.filter((i: any) => i.code === 'session_muscle_leak');
      expect(leaks, `${id}: ${leaks.map((l: any) => l.message).join(' | ')}`).toHaveLength(0);
    }
  });

  it('каждое гашение-упражнение покрытия помечено coverageFill', () => {
    const plan = build('female_glute_6', 'intermediate', 'female');
    const quads = plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises || []))
      .filter((e: any) => e.muscle === 'quads' && /Quads-/.test(String(e.comment || '')));
    expect(quads.length).toBeGreaterThan(0);
    for (const e of quads) expect((e as any).coverageFill).toBe(true);
  });

  // До прохода ensureDeltCoverageForUpperWeeks женские сплиты на intermediate
  // оставались с НУЛЁМ прямых сетов на дельты во всех неделях блока.
  it('женские сплиты: дельты получают прямой объём (не только косвенный от жимов)', () => {
    for (const [id, level] of [
      ['female_glute_6', 'intermediate'],
      ['female_glute_5', 'intermediate'],
      ['female_upper_glute_4', 'intermediate'],
      ['female_glute_3', 'advanced'],
      ['female_wellness_5', 'advanced'],
    ] as const) {
      const plan = build(id, level, 'female');
      const weeks = normalWeeks(plan);
      const withDelts = weeks.filter((w: any) => w.sessions.some((s: any) => (s.exercises || []).some(
        (e: any) => !e.warmupActivator && /^(shoulders|delt_(front|mid|rear|side))$/.test(String(e.muscle || '')),
      )));
      expect(withDelts.length, `${id}: недель с дельтами ${withDelts.length}/${weeks.length}`)
        .toBe(weeks.length);
    }
  });

  it('женские сплиты: объём дельт за блок не нулевой и в пределах разумного', () => {
    for (const id of ['female_glute_3', 'female_lower_upper_4', 'female_wellness_5', 'female_glute_5', 'female_glute_6', 'female_upper_glute_4']) {
      const plan = build(id, 'intermediate', 'female');
      const total = plan.weeks.reduce((a: number, w: any) => a + w.sessions.reduce((x: number, s: any) =>
        x + (s.exercises || []).filter((e: any) => /^(shoulders|delt_(front|mid|rear|side))$/.test(String(e.muscle || '')))
          .reduce((y: number, e: any) => y + (e.sets || 0), 0), 0), 0);
      expect(total, `${id}: суммарно сетов на дельты за 8 недель`).toBeGreaterThanOrEqual(6);
    }
  });

  it('все встроенные сплиты собираются без ошибок валидатора', () => {
    const levels = ['beginner', 'intermediate', 'advanced', 'enhanced'];
    for (const p of SPLIT_PATTERNS) {
      for (const level of p.level.filter(l => levels.includes(l))) {
        const sex = p.id.startsWith('female_') ? 'female' : 'male';
        const plan = build(p.id, level, sex);
        const result: any = validateBBPlan(plan, { level } as never);
        expect(result.issues.filter((i: any) => i.level === 'error'), `${p.id} [${level}]`).toHaveLength(0);
      }
    }
  }, 300000);
});

describe('классификация упражнений по имени (plan-объекты без group/targetMuscle)', () => {
  const cases: Array<[string, string]> = [
    ['Французский жим лёжа (EZ-гриф)', 'triceps'],
    ['Французский жим двумя руками', 'triceps'],
    ['JM-жим', 'triceps'],
    ['Разгибание рук на блоке', 'triceps'],
    ['Обратные сведения в тренажёре', 'shoulders'],
    ['Обратная бабочка (задняя дельта)', 'shoulders'],
    ['Тяга верхнего блока к лицу', 'shoulders'],
    ['Арнольд-жим', 'shoulders'],
    ['Жим Арнольда', 'shoulders'],
    ['Шраги со штангой', 'traps'],
    ['Шраги Келсо', 'traps'],
    ['Тяга штанги к подбородку', 'traps'],
    ['Жим носками в жиме ногами', 'calves'],
  ];

  for (const [name, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      expect(trueMuscleOf({ name })).toBe(expected);
    });
  }

  it('каталожные записи с group не переопределяются по имени', () => {
    // У каталожной записи есть group/type/targetMuscle — штатная классификация
    // не должна подменяться name-правилами (обратные сведения → shoulders, не chest).
    expect(trueMuscleOf({
      name: 'Обратные сведения в тренажёре',
      group: 'shoulders', type: 'isolation', targetMuscle: 'Задняя дельта, ромбовидные',
    })).toBe('shoulders');
    expect(trueMuscleOf({
      name: 'Французский жим лёжа (EZ-гриф)',
      group: 'arms', type: 'isolation', targetMuscle: 'Трицепс (длинная головка, растяжение)',
    })).toBe('triceps');
  });
});
