import { describe, expect, it } from 'vitest';
import {
  minLevelFor, isLevelAllowed, isLevelAllowedRank, maxLevelRankFor,
  regressionFor, swapExerciseForLevel,
} from '../bb-exercise-levels.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { trueMuscleOf } from '../../movement-pattern';

/* ═══════════════════════════════════════════════════════════════════
 * Гейт уровней: minLevel якоря/правила, ранги, регрессии, своп.
 * Источники: Kompf et al. 2022 (Delphi, PMC11873903), NSCA PTQ 2023,
 * Aerenhouts 2020 (RCT), лесенки StrengthLog/OPEX/StrongFirst.
 * ═══════════════════════════════════════════════════════════════════ */

/** Резолв записи каталога (реальный путь: difficulty + оверрайды). */
function byId(id: string): any {
  const found = (EXERCISE_CATALOG as any[]).find(e => e.id === id);
  expect(found, `id ${id} в каталоге`).toBeTruthy();
  return found;
}

describe('minLevelFor — якоря', () => {
  it('штанговый присед/становая/гудморнинг — advanced', () => {
    for (const id of ['squat_bar', 'squat_back', 'deadlift', 'sumo_dl', 'good_morning', 'good_morning_v2']) {
      expect(minLevelFor(byId(id)), id).toBe('advanced');
    }
    // Имя без каталога: оверрайд по имени тоже ловит.
    expect(minLevelFor({ name: 'Приседания со штангой на спине' })).toBe('advanced');
  });

  it('скилл/плио/взвешенные — advanced', () => {
    for (const id of ['pistol_squat', 'shrimp_squat', 'jump_squat', 'jump_lunge', 'pullup_weighted', 'ohp_behind_neck', 'push_press']) {
      expect(minLevelFor(byId(id)), id).toBe('advanced');
    }
  });

  it('база новичка — beginner', () => {
    for (const id of ['goblet_squat', 'leg_press', 'pulldown', 'machine_chest_press', 'bench_dips', 'face_pull', 'leg_curl', 'pushup']) {
      expect(minLevelFor(byId(id)), id).toBe('beginner');
    }
  });

  it('середина — intermediate (каталог уважаем)', () => {
    for (const id of ['bench_bar', 'ohp_bar', 'rdl', 'row_bar', 'pullup', 'dips_tricep']) {
      expect(minLevelFor(byId(id)), id).toBe('intermediate');
    }
  });

  it('даунгрейды по доказательствам: трап-гриф и австралийские — beginner', () => {
    expect(minLevelFor(byId('deadlift_trapbar'))).toBe('beginner');
    expect(minLevelFor(byId('row_inverted'))).toBe('beginner');
  });

  it('неизвестное без difficulty — intermediate (не бан и не вседозволенность)', () => {
    expect(minLevelFor({ id: 'no_such_lift_xyz' })).toBe('intermediate');
  });
});

describe('ранги доступа', () => {
  it('beginner: только beginner; intermediate: +intermediate; advanced/enhanced/пусто: всё', () => {
    const adv = byId('deadlift');
    const mid = byId('bench_bar');
    const beg = byId('goblet_squat');
    expect(isLevelAllowed('beginner', adv)).toBe(false);
    expect(isLevelAllowed('beginner', mid)).toBe(false);
    expect(isLevelAllowed('beginner', beg)).toBe(true);
    expect(isLevelAllowed('intermediate', adv)).toBe(false);
    expect(isLevelAllowed('intermediate', mid)).toBe(true);
    expect(isLevelAllowed('advanced', adv)).toBe(true);
    expect(isLevelAllowed('enhanced', adv)).toBe(true);
    expect(isLevelAllowed(undefined, adv)).toBe(true);
  });

  it('maxLevelRankFor: релакс новичка — intermediate, но никогда advanced', () => {
    expect(maxLevelRankFor('beginner', false)).toBe(0);
    expect(maxLevelRankFor('beginner', true)).toBe(1);
    expect(maxLevelRankFor('intermediate', false)).toBe(1);
    expect(isLevelAllowedRank({ id: 'deadlift' }, maxLevelRankFor('beginner', true))).toBe(false);
  });
});

describe('regressionFor — лесенки', () => {
  it('якоря ведут на существующие в каталоге регрессии', () => {
    const ids = new Set((EXERCISE_CATALOG as any[]).map(e => e.id));
    for (const anchor of ['squat_bar', 'deadlift', 'pullup', 'dips_chest', 'ohp', 'bench_bar', 'good_morning', 'pistol_squat']) {
      const regs = regressionFor(anchor);
      expect(regs.length, anchor).toBeGreaterThan(0);
      for (const r of regs) expect(ids.has(r), `${anchor} → ${r}`).toBe(true);
    }
  });

  it('неизвестный якорь — пусто', () => {
    expect(regressionFor('no_such_lift_xyz')).toEqual([]);
  });
});

describe('swapExerciseForLevel', () => {
  const tm = (ex: any) => { try { return trueMuscleOf(ex); } catch { return null; } };

  it('присед новичку → гоблет с понижающим коэффициентом', () => {
    const s = swapExerciseForLevel(byId('squat_bar'), 'beginner', tm, EXERCISE_CATALOG as any, { equipment: ['barbell', 'dumbbell', 'machine'] });
    expect(s).not.toBeNull();
    expect(s!.name).toBe(byId('goblet_squat').name);
    expect(s!.loadRatio).toBeLessThan(1);
  });

  it('разрешённое не трогаем на уровне swap (проверяется вызывающим)', () => {
    const s = swapExerciseForLevel({ id: 'leg_press', name: 'Жим ногами' }, 'intermediate', tm, EXERCISE_CATALOG as any, {});
    expect(s).not.toBeNull();
  });

  it('без кандидата — null (объём не трогаем никогда)', () => {
    const s = swapExerciseForLevel({ id: 'squat_bar', name: 'Присед' }, 'beginner', tm, [], {});
    expect(s).toBeNull();
  });
});

describe('isHardAdvanced/isPoolAllowed — ядро гейта', () => {
  it('hard: присед/становая/гудморнинг/пистолетик/плио', async () => {
    const { isHardAdvanced } = await import('../bb-exercise-levels.engine');
    for (const id of ['squat_bar', 'deadlift', 'good_morning', 'pistol_squat', 'jump_squat', 'push_press']) {
      expect(isHardAdvanced({ id }), id).toBe(true);
    }
    expect(isHardAdvanced({ id: 'goblet_squat' })).toBe(false);
    expect(isHardAdvanced({ id: 'bench_bar' })).toBe(false);
    expect(isHardAdvanced({ id: 'leg_press' })).toBe(false);
  });

  it('пул: новичку и любителю запрещён только hard', async () => {
    const { isPoolAllowed } = await import('../bb-exercise-levels.engine');
    expect(isPoolAllowed('beginner', { id: 'squat_bar' })).toBe(false);
    expect(isPoolAllowed('intermediate', { id: 'deadlift' })).toBe(false);
    expect(isPoolAllowed('beginner', { id: 'bench_bar' })).toBe(true);
    expect(isPoolAllowed('beginner', { id: 'goblet_squat' })).toBe(true);
    expect(isPoolAllowed('advanced', { id: 'squat_bar' })).toBe(true);
    expect(isPoolAllowed('enhanced', { id: 'deadlift' })).toBe(true);
  });
});

describe('интеграция: планы по уровням', () => {
  const WM = { chest: 80, back: 90, quads: 110, hamstrings: 70, shoulders: 50, biceps: 40, triceps: 45, glutes: 120, calves: 80, abs: 50 };
  const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

  /** Имена hard-движений в плане (без разминки) — их быть не должно. */
  async function hardInPlan(patternId: string, level: string): Promise<string[]> {
    const { buildBBPlan } = await import('../bb-builder.engine');
    const { isHardAdvanced } = await import('../bb-exercise-levels.engine');
    const plan = buildBBPlan({ patternId, level, goal: 'mass', weeks: 4, workMax: WM, equipment: EQ, volumeGoal: 'mav' } as any);
    const bad: string[] = [];
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator) continue;
      const cat = (EXERCISE_CATALOG as any[]).find(c => c.name === (e as any).name || c.id === (e as any).exerciseName);
      if (isHardAdvanced({ id: (cat as any)?.id || (e as any).exerciseName, name: (e as any).name })) bad.push((e as any).name);
    }
    return [...new Set(bad)];
  }

  it('новичок upper_lower_4: ноль hard-движений', async () => {
    expect(await hardInPlan('upper_lower_4', 'beginner')).toEqual([]);
  });

  it('любитель ppl_6: ноль hard-движений', async () => {
    expect(await hardInPlan('ppl_6', 'intermediate')).toEqual([]);
  });

  it('новичок upper_lower_4: intermediate-движения разрешены (скамья/тяги/жим)', async () => {
    const { buildBBPlan } = await import('../bb-builder.engine');
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'beginner', goal: 'mass', weeks: 4, workMax: WM, equipment: EQ, volumeGoal: 'mav' } as any);
    const names = new Set<string>();
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) names.add((e as any).name);
    // Жим лёжа со штангой — канон новичка по Starting Strength, гейт его не банит.
    expect([...names].some(n => /жим.*лёжа|bench.*press/i.test(n))).toBe(true);
  });

  it('новичок: штангового приседа нет, след регрессии — гоблет/жим ногами/сплит', async () => {
    const { buildBBPlan } = await import('../bb-builder.engine');
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'beginner', goal: 'mass', weeks: 4, workMax: WM, equipment: EQ, volumeGoal: 'mav' } as any);
    const names = new Set<string>();
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) names.add((e as any).name);
    const hasBackSquat = [...names].some(n => /присед.*штанг|back.?squat/i.test(n) && !/фронт|гоблет|кубк|goblet|болгар|сплит/i.test(n));
    expect(hasBackSquat).toBe(false);
  });
});

describe('инвентарь каталога', () => {
  it('каждая запись резолвит minLevel без исключений', () => {
    for (const e of EXERCISE_CATALOG as any[]) {
      expect(() => minLevelFor(e)).not.toThrow();
      expect(['beginner', 'intermediate', 'advanced']).toContain(minLevelFor(e));
    }
  });

  it('дубли id консистентны по уровню', () => {
    const byId = new Map<string, Set<string>>();
    for (const e of EXERCISE_CATALOG as any[]) {
      if (!byId.has(e.id)) byId.set(e.id, new Set());
      byId.get(e.id)!.add(minLevelFor(e));
    }
    for (const [id, levels] of byId) {
      expect([...levels], id).toHaveLength(1);
    }
  });
});
