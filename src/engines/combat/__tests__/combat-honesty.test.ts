/**
 * combat-honesty.test.ts — локи E1: числа перестают врать.
 * Каждый тест падал бы на коде ДО раунда E1.
 */
import { describe, it, expect } from 'vitest';
import { buildCombatPlan, combatPlanId, validateCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan, enforceSessionBudget } from '../combat-finalize.engine';
import { COMBAT_LANDMARKS, getCombat } from '../combat-volume';
import { inCombatGroup, weekGroupSets } from '../combat-groups';
import type { CombatInput, CombatSession } from '../combat.types';

const base: CombatInput = {
  discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 8, daysPerWeek: 4,
  workMax: { chest: 100, back: 140, legs: 180, shoulders: 50, arms: 40 } as any,
} as CombatInput;

const build = (over: Partial<CombatInput> = {}) => finalizeCombatPlan(buildCombatPlan({ ...base, ...over } as CombatInput));

describe('E1.1 totalSets честны на деload/тапер-неделях', () => {
  it('sum(ex.sets) === wk.totalSets на КАЖДОЙ неделе, включая деload', () => {
    const plan = build();
    expect(plan.weeksData.length).toBe(8);
    for (const wk of plan.weeksData) {
      const fact = wk.sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.sets, 0), 0);
      expect(wk.totalSets, `нед ${wk.week} deload=${!!wk.deload}`).toBe(fact);
    }
  });

  it('есть хотя бы одна деload-неделя (иначе тест вакуумный)', () => {
    const plan = build();
    expect(plan.weeksData.some(w => w.deload)).toBe(true);
  });

  it('totalTonnage не undefined и считается по workSets', () => {
    const plan = build();
    for (const wk of plan.weeksData) {
      expect(wk.totalTonnage).toBeGreaterThan(0);
      const fact = wk.sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) =>
        a + e.workSets.reduce((x, ws) => x + ws.weight * ws.reps, 0), 0), 0);
      expect(Math.round(wk.totalTonnage as number)).toBe(Math.round(fact));
    }
  });

  it('sets === workSets.length на КАЖДОМ упражнении (в т.ч. после тримов)', () => {
    const plan = build({ level: 'enhanced', weeks: 12 });
    for (const wk of plan.weeksData) for (const sess of wk.sessions) for (const ex of sess.exercises) {
      expect(ex.workSets.length, `нед ${wk.week} ${ex.id}`).toBe(ex.sets);
    }
  });
});

describe('E1.2 plyo/unilateral имеют лендмарки (потолок объёма)', () => {
  it('у каждого уровня есть plyo и unilateral', () => {
    for (const lvl of ['beginner', 'intermediate', 'advanced', 'enhanced'] as const) {
      expect(COMBAT_LANDMARKS[lvl].plyo, lvl).toBeDefined();
      expect(COMBAT_LANDMARKS[lvl].unilateral, lvl).toBeDefined();
      expect(getCombat(lvl, 'plyo'), lvl).not.toBeNull();
      expect(getCombat(lvl, 'unilateral'), lvl).not.toBeNull();
    }
  });

  it('лендмарки упорядочены mev ≤ mav ≤ mrv во всех группах и уровнях', () => {
    for (const [lvl, groups] of Object.entries(COMBAT_LANDMARKS)) {
      for (const [g, lm] of Object.entries(groups)) {
        expect(lm.mev, `${lvl}.${g}`).toBeLessThanOrEqual(lm.mav);
        expect(lm.mav, `${lvl}.${g}`).toBeLessThanOrEqual(lm.mrv);
        expect(lm.mrv, `${lvl}.${g}`).toBeGreaterThan(0);
      }
    }
  });

  it('объём plyo-группы не превышает MRV (боксёр с акцентом striker)', () => {
    const plan = build({ discipline: 'boxing', fightStyle: 'striker', level: 'advanced', weeks: 10 });
    const lm = getCombat(plan.level, 'plyo')!;
    for (const wk of plan.weeksData) {
      expect(weekGroupSets(wk.sessions, 'plyo')).toBeLessThanOrEqual(lm.mrv);
    }
  });

  it('объём unilateral-группы не превышает MRV (борец)', () => {
    const plan = build({ discipline: 'wrestling', level: 'advanced', weeks: 8 });
    const lm = getCombat(plan.level, 'unilateral')!;
    for (const wk of plan.weeksData) {
      expect(weekGroupSets(wk.sessions, 'unilateral')).toBeLessThanOrEqual(lm.mrv);
    }
  });

  it('inCombatGroup различает группы (plliо ≠ unilateral ≠ neck)', () => {
    expect(inCombatGroup('box_jump', 'plyo')).toBe(true);
    expect(inCombatGroup('box_jump', 'unilateral')).toBe(false);
    expect(inCombatGroup('bulgarian_split_heavy', 'unilateral')).toBe(true);
    expect(inCombatGroup('bulgarian_split_heavy', 'plyo')).toBe(false);
    expect(inCombatGroup('neck_harness_ext', 'neck')).toBe(true);
    expect(inCombatGroup('bench_bar', 'neck')).toBe(false);
  });
});

describe('E1.3 validateCombatPlan пересчитывает, а не отдаёт сохранённое', () => {
  it('ловит мутацию totalSets (старый код молчал бы)', () => {
    const plan = build();
    plan.weeksData[0].totalSets = 999;
    const v = validateCombatPlan(plan);
    expect(v.errors.some(e => e.includes('totalSets'))).toBe(true);
    expect(v.ok).toBe(false);
  });

  it('ловит рассинхрон workSets/sets', () => {
    const plan = build();
    const ex = plan.weeksData[0].sessions[0].exercises[0];
    ex.workSets = ex.workSets.slice(0, 1);
    const v = validateCombatPlan(plan);
    expect(v.errors.some(e => e.includes('workSets'))).toBe(true);
  });

  it('ловит потерю недели', () => {
    const plan = build();
    plan.weeksData.pop();
    expect(validateCombatPlan(plan).errors.length).toBeGreaterThan(0);
  });

  it('чистый план проходит', () => {
    expect(validateCombatPlan(build()).ok).toBe(true);
  });
});

describe('E1.4 идентификатор плана детерминирован', () => {
  it('одинаковый вход → одинаковый id', () => {
    const a = buildCombatPlan({ ...base } as CombatInput);
    const b = buildCombatPlan({ ...base } as CombatInput);
    expect(a.id).toBe(b.id);
  });

  it('смена fightDate → другой id', () => {
    const a = buildCombatPlan({ ...base, fightDate: '2026-11-01' } as CombatInput);
    const b = buildCombatPlan({ ...base, fightDate: '2026-12-01' } as CombatInput);
    expect(a.id).not.toBe(b.id);
  });

  it('id не содержит Date.now (нет временно́й метки)', () => {
    const a = buildCombatPlan({ ...base } as CombatInput);
    expect(a.id).toMatch(/^cb_[0-9a-z]+$/);
    expect(a.id).not.toMatch(/cb_17/);
  });

  it('combatPlanId чистый детерминированный', () => {
    expect(combatPlanId({ discipline: 'mma', weeks: 8 })).toBe(combatPlanId({ discipline: 'mma', weeks: 8 }));
    expect(combatPlanId({ discipline: 'mma', weeks: 8 })).not.toBe(combatPlanId({ discipline: 'boxing', weeks: 8 }));
  });

  it('РЕГРЕСС: вес тела доезжает до снимка — иначе планы разного веса делят id', () => {
    // было `bodybodyKg` (поля нет) → вес выпадал из снимка и из id
    const light = buildCombatPlan({ ...base, bodyweight: 70 } as CombatInput);
    const heavy = buildCombatPlan({ ...base, bodyweight: 95 } as CombatInput);
    expect((light.inputSnapshot as any).bodyweightKg).toBe(70);
    expect((heavy.inputSnapshot as any).bodyweightKg).toBe(95);
    expect(light.id).not.toBe(heavy.id);
  });

  it('смена веса тела меняет id плана', () => {
    expect(combatPlanId({ discipline: 'mma', weeks: 8, bodyweight: 70 } as any))
      .not.toBe(combatPlanId({ discipline: 'mma', weeks: 8, bodyweight: 95 } as any));
  });
});

describe('E1.5 предупреждения не дублируются в rationale', () => {
  it('каждое предупреждение валидации встречается в rationale ровно один раз', () => {
    const plan = build({ level: 'enhanced', weeks: 12 });
    for (const w of plan.validation!.warnings) {
      const n = plan.rationale.filter(r => r.replace(/^[⚠•]\s*/, '') === w).length;
      expect(n, w).toBeLessThanOrEqual(1);
    }
  });

  it('повторная финализация не плодит дубли', () => {
    const once = build();
    const twice = finalizeCombatPlan(once);
    const countOf = (p: any, s: string) => p.rationale.filter((r: string) => r === s).length;
    for (const line of once.rationale) {
      if (!line.startsWith('⚠')) continue;
      expect(countOf(twice, line), line).toBeLessThanOrEqual(1);
    }
  });

  it('в warnings нет дублей', () => {
    const w = build().validation!.warnings;
    expect(new Set(w).size).toBe(w.length);
  });
});

describe('E1.6 бюджет сессии ПРИМЕНЯЕТСЯ, а не только предупреждается', () => {
  const sess = (): CombatSession => ({
    day: 1, week: 1, sessionTag: 'full_power', character: 'тяж',
    exercises: [
      { id: 'squat', name: 'Присед', group: 'legs', pattern: 'squat', role: 'primary', character: 'тяж', sets: 4, reps: '5', rir: 2, weight: 120, workSets: Array.from({ length: 4 }, () => ({ reps: 5, rir: 2, weight: 120 })) },
      { id: 'bench_bar', name: 'Жим', group: 'chest', pattern: 'horizontal_push', role: 'primary', character: 'тяж', sets: 4, reps: '5', rir: 2, weight: 80, workSets: Array.from({ length: 4 }, () => ({ reps: 5, rir: 2, weight: 80 })) },
      { id: 'row_bar', name: 'Тяга', group: 'back', pattern: 'horizontal_pull', role: 'primary', character: 'тяж', sets: 4, reps: '5', rir: 2, weight: 90, workSets: Array.from({ length: 4 }, () => ({ reps: 5, rir: 2, weight: 90 })) },
      ...['lat_raise', 'front_raise', 'lateral_raise_w', 'rear_delt', 'curl_bar', 'pushdown', 'pallof', 'deadbug'].map((id, i) => ({
        id, name: 'acc' + i, group: i % 2 ? 'arms' : 'shoulders', pattern: 'isolation', role: 'accessory' as const,
        character: 'памп' as const, sets: 3, reps: '12', rir: 3, weight: 15,
        workSets: Array.from({ length: 3 }, () => ({ reps: 12, rir: 3, weight: 15 })),
      })),
    ],
  });

  it('перегруженная сессия урезается по maxExercises', () => {
    const s = sess();
    const removed = enforceSessionBudget(s, { maxSets: 30, maxExercises: 8 });
    expect(removed).toBeGreaterThan(0);
    expect(s.exercises.length).toBeLessThanOrEqual(8);
  });

  it('перегруженная сессия урезается по maxSets', () => {
    const s = sess();
    enforceSessionBudget(s, { maxSets: 14, maxExercises: 10 });
    expect(s.exercises.reduce((a, e) => a + e.sets, 0)).toBeLessThanOrEqual(14);
  });

  it('база (primary) не удаляется первой', () => {
    const s = sess();
    enforceSessionBudget(s, { maxSets: 16, maxExercises: 6 });
    const ids = s.exercises.map(e => e.id);
    expect(ids).toContain('squat');
    expect(ids).toContain('bench_bar');
  });

  it('уже-нормальная сессия не трогается', () => {
    const s = sess();
    s.exercises = s.exercises.slice(0, 4);
    const before = s.exercises.length;
    expect(enforceSessionBudget(s, { maxSets: 30, maxExercises: 8 })).toBe(0);
    expect(s.exercises.length).toBe(before);
  });

  it('после финализации ни одна сессия не превышает лимиты', () => {
    for (const level of ['beginner', 'intermediate', 'advanced', 'enhanced'] as const) {
      const plan = build({ level, weeks: 8, daysPerWeek: 4 });
      const lim = { maxSets: level === 'beginner' ? 18 : level === 'intermediate' ? 22 : level === 'advanced' ? 26 : 30, maxExercises: level === 'beginner' ? 6 : level === 'intermediate' ? 8 : level === 'advanced' ? 9 : 10 };
      for (const wk of plan.weeksData) for (const s of wk.sessions) {
        expect(s.exercises.length, `${level} нед ${wk.week}`).toBeLessThanOrEqual(lim.maxExercises);
        expect(s.exercises.reduce((a, e) => a + e.sets, 0), `${level} нед ${wk.week}`).toBeLessThanOrEqual(lim.maxSets);
      }
    }
  });
});
