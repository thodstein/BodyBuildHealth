/**
 * bb-wave0-validation-contract.test.ts — Волна 0 аудита ББ-авто (2026-09),
 * кластер валидации: 0.3 (единые опции/капы), 0.4 (снимок после мутаций),
 * 0.6 (тейпер сравнивается с базой серии, а не с делодом).
 *
 * Каждый лок поведенческий и мутационно проверяемый: возврат старой строки
 * роняет ровно нужный тест (см. §11 плана).
 */
import { describe, expect, it } from 'vitest';
import { validateBBPlan, sessionLimitsFor } from '../bb-validator.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { finalizeBBPlan } from '../bb-finalize.engine';
import { aggregateBBVolume } from '../bb-volume.engine';

const WM = {
  chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140,
  hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40,
};

const ex = (over: Record<string, any> = {}) => ({
  muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж',
  sets: 4, repsRange: [6, 8], rir: 2,
  workSets: Array.from({ length: over.sets ?? 4 }, () => ({ reps: 8, rir: 2, weight: 100 })),
  ...over,
});

const session = (exercises: any[], tag = 'Push') => ({
  day: 1, weekOffset: 1, character: 'тяж', sessionTag: tag, exercises,
});

const planOf = (weeks: any[]) => ({ pattern: {} as any, weeks, rotationMuscleVolume: {}, rationale: [] } as any);

const codes = (issues: any[]) => issues.map((i: any) => i.code);

// ─────────────────────────────────────────────────────────────────────────────
describe('0.6 — taper_volume_increased: база серии, а не предыдущая неделя', () => {
  /** Неделя с РОВНО totalSets рабочими сетами (по 4 на упражнение + хвост). */
  const w = (n: number, totalSets: number, extra: any = {}) => {
    const full = Math.floor(totalSets / 4);
    const rest = totalSets % 4;
    const exercises: any[] = Array.from({ length: full }, () => ex());
    if (rest) exercises.push(ex({ sets: rest, workSets: Array.from({ length: rest }, () => ({ reps: 8, rir: 2, weight: 100 })) }));
    return { week: n, ...extra, sessions: [{ day: 1, weekOffset: n, character: 'тяж', sessionTag: 'Push', exercises }] };
  };

  it('монотонный тейпер после делода НЕ флагуется (было ложное срабатывание в 192/192)', () => {
    // Нед.4 — делод (8 сетов), нед.5-6 — тейпер 12 и 10 сетов. Тейпер легче
    // делода, но обе его недели НИЖЕ своей базы (нед.3 = 20 сетов) — монотонный
    // тейпер. Старый код сравнивал нед.5 только с нед.4 и кричал «тейпер вырос».
    const plan = planOf([w(1, 20), w(2, 20), w(3, 20), w(4, 8, { phase: 'deload' }), w(5, 12, { taper: true }), w(6, 10, { taper: true })]);
    const result = validateBBPlan(plan);
    expect(codes(result.issues)).not.toContain('taper_volume_increased');
  });

  it('тейпер, выросший ПРОТИВ своей базы (нед.3 = 20 сетов), — флагуется', () => {
    const plan = planOf([w(1, 20), w(2, 20), w(3, 20), w(4, 8, { phase: 'deload' }), w(5, 24, { taper: true })]);
    const result = validateBBPlan(plan);
    const hit = result.issues.filter((i: any) => i.code === 'taper_volume_increased');
    expect(hit).toHaveLength(1);
    // В сообщении должна быть именно БАЗА тейпера (20), а не неделя делода (8).
    expect(hit[0].message).toContain('базой тейпера');
    expect(hit[0].message).toContain('20');
    expect(hit[0].message).not.toContain('выше 8.');
  });

  it('внутри серии тейпера рост флагуется относительно предыдущей недели тейпера', () => {
    const plan = planOf([w(1, 20), w(2, 20), w(3, 20), w(4, 10, { taper: true }), w(5, 14, { taper: true })]);
    const result = validateBBPlan(plan);
    const hit = result.issues.filter((i: any) => i.code === 'taper_volume_increased');
    expect(hit).toHaveLength(1);
    expect(hit[0].message).toContain('предыдущей неделей тейпера');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('0.3 — валидатор считает по тем же капам, что применил сборщик', () => {
  const setsPlan = (totalSets: number) => planOf([{
    week: 1,
    sessions: [session(Array.from({ length: 3 }, () => ex({ sets: Math.ceil(totalSets / 3), name: 'Жим штанги лёжа' })), 'Push')],
  }]);

  it('явные капы сборщика имеют приоритет над вычисленными (кап 36 — 30 сетов чисто)', () => {
    const plan = setsPlan(30);
    const withCaps = validateBBPlan(plan, { level: 'intermediate', maxWorkingSets: 36, maxExercises: 11 });
    expect(codes(withCaps.issues)).not.toContain('session_working_set_cap');
    // Те же 30 сетов при дефолтном капе 24 — уже нарушение.
    const withoutCaps = validateBBPlan(plan, { level: 'intermediate' });
    expect(codes(withoutCaps.issues)).toContain('session_working_set_cap');
  });

  it('контекст курса доезжает до капа: intermediate+6 лет на курсе = 60/16, а не 24/10', () => {
    // Re-baseline (аудит-2, потолок ПРО НА ПЕД): 44/16 → 60/16. 60 сетов —
    // канон владельца для про на ПЕД (спина 60/нед ÷ 2 стимула = 30/сессию
    // + руки/трапы/задняя дельта); 44 физически не вмещали недельный рецепт.
    // 16 упражнений — потолок «ни одной сессии >16–17».
    expect(sessionLimitsFor({ level: 'intermediate', trainingYears: 6, onCourse: true })).toEqual({ maxWorkingSets: 60, maxExercises: 16 });
    // Без onCourse тот же уровень = натуральный кап.
    expect(sessionLimitsFor({ level: 'intermediate', trainingYears: 6 })).toEqual({ maxWorkingSets: 24, maxExercises: 10 });
  });

  it('высокообъёмный режим доезжает до капа (не был виден валидатору)', () => {
    const base = sessionLimitsFor({ level: 'intermediate', trainingYears: 3 });
    const high = sessionLimitsFor({ level: 'intermediate', trainingYears: 3, trainingVolumeMode: 'high' });
    expect(high.maxWorkingSets).toBeGreaterThan(base.maxWorkingSets);
    expect(sessionLimitsFor({ level: 'intermediate', trainingYears: 3, onCourse: true, trainingVolumeMode: 'high' }).maxWorkingSets)
      .toBeGreaterThanOrEqual(high.maxWorkingSets);
  });

  it('PPL-повышение капа доезжает до валидатора через patternId', () => {
    expect(sessionLimitsFor({ level: 'intermediate', patternId: 'ppl_6' })).toEqual({ maxWorkingSets: 36, maxExercises: 11 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('0.4 — plan.validation описывает ФИНАЛЬНЫЙ план', () => {
  const build = (over: any = {}) => buildBBPlan({
    patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, weeks: 8, workMax: WM, ...over,
  } as any);

  it('снимок равен СВЕЖЕЙ валидации плана в момент его возврата', () => {
    // Финализатор применяет РОВНО эти опции — значит и валидатор обязан считать
    // по ним. Иначе снимок описывает другую версию плана.
    const finalizeOptions: any = {
      level: 'intermediate', trainingYears: 3, reorder: true, checkOrder: true,
      maxWorkingSets: 36, maxExercises: 11,
    };
    const plan = finalizeBBPlan(JSON.parse(JSON.stringify(build())), finalizeOptions);
    const fresh = validateBBPlan(plan, {
      level: 'intermediate', trainingYears: 3, checkOrder: true,
      maxWorkingSets: 36, maxExercises: 11,
    });
    expect(codes(plan.validation!.issues).sort()).toEqual(codes(fresh.issues).sort());
    expect(plan.validation!.valid).toBe(fresh.valid);
  });

  it('снимок не содержит sets_mismatch у плана, где инвариант держится', () => {
    // До правки снимок снимался ДО syncBBPlanSetShape/enforceSessionRealism,
    // поэтому мог нести ошибку, которую финализатор тут же починил.
    const plan = build();
    const mismatched = plan.weeks.some(w => w.sessions.some(s => s.exercises.some(e => (e.workSets?.length || 0) !== e.sets)));
    expect(mismatched).toBe(false);
    expect(codes(plan.validation!.issues)).not.toContain('sets_mismatch');
  });

  it('weeklyVolume — по ФИНАЛЬНЫМ сетам, а не по снимку до последних проходов', () => {
    const plan = finalizeBBPlan(JSON.parse(JSON.stringify(build())), {
      level: 'intermediate', trainingYears: 3, reorder: true,
      maxWorkingSets: 36, maxExercises: 11,
    } as any);
    for (const week of plan.weeks) {
      const declared = (plan.weeklyVolume as any)?.[week.week];
      if (!declared) continue;
      // Считаем ровно тем же каноном, что и weeklyVolume — сравнение «снимок
      // vs пересчёт после мутаций» (до правки они расходились).
      expect(declared).toEqual(aggregateBBVolume(week.sessions));
    }
  });
});
