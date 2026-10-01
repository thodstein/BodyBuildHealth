import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { ARM_EXERCISES, validateArmCatalog } from '../../../core/exercise-catalog-arm';
import { buildArmPlanCsv } from '../arm-export.engine';

/** Вес первого сета упражнения мышцы в неделе (0 если нет). */
function weightOf(plan: any, week: number, muscle: string): number {
  const wk = plan.weeks.find((w: any) => w.week === week);
  for (const s of wk?.sessions || []) for (const e of s.exercises || []) {
    if (e.muscle === muscle && e.workSets?.[0]) return Number(e.workSets[0].weight) || 0;
  }
  return 0;
}
function repsRangeOf(plan: any, week: number, muscle: string): [number, number] | null {
  const wk = plan.weeks.find((w: any) => w.week === week);
  for (const s of wk?.sessions || []) for (const e of s.exercises || []) {
    if (e.muscle === muscle) return [e.repsRange[0], e.repsRange[1]];
  }
  return null;
}
function totalSets(plan: any, week: number): number {
  const wk = plan.weeks.find((w: any) => w.week === week);
  let n = 0;
  for (const s of wk?.sessions || []) for (const e of s.exercises || []) n += e.sets || 0;
  return n;
}
function allIds(plan: any): string[] {
  const out: string[] = [];
  for (const w of plan.weeks || []) for (const s of w.sessions || []) for (const e of s.exercises || []) if (e.exerciseId) out.push(e.exerciseId);
  return out;
}
function topWeightOf(plan: any, muscle: string): number {
  let m = 0;
  for (const w of plan.weeks || []) for (const s of w.sessions || []) for (const e of s.exercises || []) {
    if (e.muscle === muscle) for (const ws of e.workSets || []) m = Math.max(m, Number(ws.weight) || 0);
  }
  return m;
}
function exNameOf(plan: any, muscle: string): string {
  for (const w of plan.weeks || []) for (const s of w.sessions || []) for (const e of s.exercises || []) if (e.muscle === muscle) return String(e.name);
  return '';
}
const todayIso = new Date().toISOString().slice(0, 10);
const isoInWeeks = (n: number) => new Date(Date.now() + n * 7 * 86400000).toISOString().slice(0, 10);
const BASE = {
  discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'toproll',
  weeks: 8, workMax: { wrist_flexors: 100, pronators: 80, brachialis: 80, back_pressure: 80, grip_support: 80, core_anchor: 80, default: 50 },
} as any;

describe('arm-planner PRO: мезо-блоки и прогрессия цикла', () => {
  it('без цикла/ставки — backward-compatible: множитель 1.0, без строки прогрессии', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE }), { level: 'intermediate' });
    expect(weightOf(plan, 5, 'wrist_flexors')).toBe(weightOf(plan, 1, 'wrist_flexors'));
    expect(plan.rationale.some((l: string) => /Прогрессия весов/.test(l))).toBe(false);
    expect(plan.progressionStyle).toBe('auto');
    expect((plan.blocks || []).length).toBeGreaterThan(0);
    expect(String(plan.weeks[0].block || '')).toContain('База');
  });
  it('цикл strengthlog_8: дефолт 0.5%/нед реально растёт (было — игнор correctionPctDefault)', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE, cycleId: 'strengthlog_8' } as any), { level: 'intermediate' });
    expect(plan.rationale.some((l: string) => /дефолт цикла/.test(l))).toBe(true);
    expect(weightOf(plan, 5, 'wrist_flexors')).toBeGreaterThan(weightOf(plan, 1, 'wrist_flexors'));
  });
  it('явная ставка cyclePctPerWeek приоритетнее дефолта цикла', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE, cycleId: 'strengthlog_8', cyclePctPerWeek: 2 } as any), { level: 'intermediate' });
    expect(plan.rationale.some((l: string) => /\+2%/.test(l))).toBe(true);
    expect(plan.rationale.some((l: string) => /дефолт цикла/.test(l))).toBe(false);
  });
  it('double: повторы растут внутри блока, вес между блоками', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE, progressionStyle: 'double', weeks: 8 } as any), { level: 'intermediate' });
    const w1 = repsRangeOf(plan, 1, 'wrist_flexors')!;
    const w3 = repsRangeOf(plan, 3, 'wrist_flexors')!;
    expect(w3[0]).toBe(w1[0] + 2);
    expect(w3[1]).toBe(w1[1] + 2);
    // блок 2 (после делода Н4) получает шаг веса +2.5%
    expect(weightOf(plan, 5, 'wrist_flexors')).toBeGreaterThan(weightOf(plan, 1, 'wrist_flexors'));
    expect(plan.rationale.some((l: string) => /Прогрессия double/.test(l))).toBe(true);
  });
  it('wave: тяжёлая/лёгкая недели внутри блока', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE, progressionStyle: 'wave' } as any), { level: 'intermediate' });
    expect(weightOf(plan, 2, 'wrist_flexors')).toBeLessThan(weightOf(plan, 1, 'wrist_flexors'));
    expect(plan.rationale.some((l: string) => /Прогрессия wave/.test(l))).toBe(true);
  });
});

describe('arm-planner PRO: мульти-старты внутри плана', () => {
  it('A-старт Н6: тейпер-окно 4-6, восстановление Н7, маркеры недель', () => {
    const plan = finalizeArmPlan(
      buildArmPlan({ ...BASE, weeks: 10, patternId: 'arm_4_upper_lower', peaks: [{ week: 6, priority: 'A', name: 'Финал' }] } as any),
      { level: 'intermediate' },
    );
    expect(plan.weeks[5].peak).toMatchObject({ priority: 'A', name: 'Финал' });
    expect(plan.weeks[5].phase).toBe('peaking');
    expect(plan.weeks[5].taper).toBe(true);
    expect(plan.weeks[4].taper).toBe(true); // Н5 — тейпер-окно
    expect(plan.weeks[6].phase).toBe('deload'); // Н7 — восстановление после старта
    expect(totalSets(plan, 6)).toBeLessThan(totalSets(plan, 5)); // 0.45 < 0.65
    expect(plan.peakWindows?.length).toBe(1);
    expect(plan.rationale.some((l: string) => /🏁 Старт \(A\)/.test(l))).toBe(true);
  });
  it('C-старт: шарпенинг без перевода фазы в peaking (не режет до 45%)', () => {
    const plan = finalizeArmPlan(
      buildArmPlan({ ...BASE, weeks: 8, peaks: [{ week: 6, priority: 'C' }] } as any),
      { level: 'intermediate' },
    );
    expect(plan.weeks[5].peak?.priority).toBe('C');
    expect(plan.weeks[5].phase).not.toBe('peaking');
    expect(totalSets(plan, 6)).toBeGreaterThan(0);
  });
});

describe('arm-planner PRO: дневниковая разгрузка и частота', () => {
  it('ACWR danger по sRPE → первая неделя разгрузочная (вместо только MRV-множителя)', () => {
    const diary = [
      ...Array.from({ length: 5 }, (_, i) => ({ dateIso: `2026-09-0${i + 1}`, srpe: 2, durationMin: 60 })),
      ...Array.from({ length: 7 }, (_, i) => ({ dateIso: `2026-09-${10 + i}`, srpe: 10, durationMin: 60 })),
    ];
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE, diary } as any), { level: 'intermediate' });
    expect(plan.weeks[0].phase).toBe('deload');
    expect(plan.rationale.some((l: string) => /ACWR danger/.test(l) && /первая неделя/.test(l))).toBe(true);
  });
  it('daysPerWeek расходится со сплитом → честная строка', () => {
    // arm_5_specialized ≈5×/нед vs заявленные 2 — расхождение ≥1.5
    const plan = buildArmPlan({ ...BASE, patternId: 'arm_5_specialized', daysPerWeek: 2 } as any);
    expect(plan.rationale.some((l: string) => /дней\/нед 2/.test(l))).toBe(true);
  });
});

describe('arm-planner PRO: база-якорь', () => {
  it('LegsCore-сессия реально добавляется (кроме делода), вес от workMax носителей', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE, legsAnchor: true } as any), { level: 'intermediate' });
    const w1 = plan.weeks.find((w: any) => w.week === 1)!;
    const anchor = w1.sessions.find((s: any) => s.sessionTag === 'LegsCore');
    expect(anchor, 'LegsCore в неделе 1').toBeTruthy();
    expect(anchor!.exercises.map((e: any) => e.name)).toContain('Присед со штангой (якорь)');
    expect(anchor!.exercises.every((e: any) => (e.workSets || []).length === e.sets)).toBe(true);
    const w4 = plan.weeks.find((w: any) => w.week === 4)!;
    expect(w4.sessions.some((s: any) => s.sessionTag === 'LegsCore'), 'делод без якоря').toBe(false);
    expect(plan.rationale.some((l: string) => /База-якорь/.test(l))).toBe(true);
    // якорь не должен ловить ложный «чужеродный пул» (sg выставлен носителям)
    expect((plan.safetyWarnings || []).join(' ')).not.toContain('вне своей группы');
    const val = validateArmPlan(plan, 'intermediate');
    expect(val.errors.length, JSON.stringify(val.errors)).toBe(0);
    expect((val.warnings || []).join(' ')).not.toContain('вне своей группы');
  });
});

describe('arm-planner PRO: P0 — факт дневника, разминка, авто-пик, блоки', () => {
  it('разминка-рампа у всех тяжёлых упражнений с весом (ступени возрастают)', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE }), { level: 'intermediate' });
    const heavy = plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
      .filter((e: any) => e.character === 'тяж' && (e.workSets?.[0]?.weight || 0) > 0);
    expect(heavy.length).toBeGreaterThan(0);
    for (const e of heavy) {
      expect(Array.isArray(e.warmupSets) && e.warmupSets!.length > 0, `${e.name}: разминка`).toBe(true);
      const w = e.warmupSets!;
      for (let i = 1; i < w.length; i++) expect(w[i].load).toBeGreaterThan(w[i - 1].load);
    }
  });
  it('план ↔ факт: stalled → −2% с нотами/варнингом, beat → ставка', () => {
    const prev = finalizeArmPlan(buildArmPlan({ ...BASE }), { level: 'intermediate' });
    const sessions = [{
      date: todayIso,
      exercises: [
        { exerciseName: exNameOf(prev, 'pronators'), sets: [{ weightKg: topWeightOf(prev, 'pronators') * 0.8, reps: 8 }] },
        { exerciseName: exNameOf(prev, 'wrist_flexors'), sets: [{ weightKg: topWeightOf(prev, 'wrist_flexors') * 1.1, reps: 8 }] },
      ],
    }];
    const plan = buildArmPlan({ ...BASE, previousPlan: prev, diarySessions: sessions } as any);
    expect(plan.rationale.some((l: string) => /План vs факт/.test(l))).toBe(true);
    expect(plan.rationale.some((l: string) => /Плато по факту/.test(l))).toBe(true);
    expect((plan.safetyWarnings || []).join(' ')).toContain('Плато факта');
    expect(plan.rationale.some((l: string) => /Факт превысил план/.test(l))).toBe(true);
  });
  it('без diarySessions — прежнее поведение (нет факт-строк)', () => {
    const prev = finalizeArmPlan(buildArmPlan({ ...BASE }), { level: 'intermediate' });
    const plan = buildArmPlan({ ...BASE, previousPlan: prev } as any);
    expect(plan.rationale.some((l: string) => /План vs факт/.test(l))).toBe(false);
  });
  it('авто-пик из даты старта: пик на неделе 10−5, A по календарю', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE, weeks: 10, competitionDateIso: isoInWeeks(5), calPriority: 'A' } as any), { level: 'intermediate' });
    expect(plan.peakWindows?.length).toBe(1);
    expect(plan.peakWindows![0].week).toBe(5);
    expect(plan.peakWindows![0].priority).toBe('A');
    expect(plan.rationale.some((l: string) => /Старт из даты/.test(l))).toBe(true);
  });
  it('дата старта вне окна плана — без пика, честная строка', () => {
    const plan = buildArmPlan({ ...BASE, weeks: 8, competitionDateIso: isoInWeeks(20) } as any);
    expect(plan.peakWindows?.length ?? 0).toBe(0);
    expect(plan.rationale.some((l: string) => /вне окна плана/.test(l))).toBe(true);
  });
  it('блоки специализации: два блока по неделям + донорское перераспределение', () => {
    const plan = finalizeArmPlan(buildArmPlan({
      ...BASE, weeks: 8, specialization: true, weakPoints: ['pronators', 'risers'],
      specializationSchedule: [
        { id: 'b1', weekStart: 1, weekEnd: 4, targets: ['pronators'], tradeoff: { mode: 'reduce_direct_to_floor', donorMuscles: ['wrist_flexors'] } },
        { id: 'b2', weekStart: 5, weekEnd: 8, targets: ['risers'] },
      ],
    } as any), { level: 'intermediate' });
    expect(String(plan.specializationSchedule?.rationale || '')).toContain('нед 1-4: [pronators]');
    expect(String(plan.specializationSchedule?.rationale || '')).toContain('нед 5-8: [risers]');
    expect(plan.rationale.some((l: string) => /Донорское перераспределение/.test(l))).toBe(true);
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      expect(e.sets, `${e.name}: sets=workSets`).toBe(e.workSets.length);
    }
  });
});

describe('arm-planner PRO: каталог и CSV', () => {
  it('каталог: 91 упражнение, валидный, новые группы закрыты', () => {
    expect(ARM_EXERCISES.length).toBe(91); // было 73 → 91 (PRO-PLAN: +18)
    expect(validateArmCatalog()).toEqual([]);
    const ids = new Set(ARM_EXERCISES.map((e) => e.id));
    for (const id of ['kingsmove_wrist_back', 'kingsmove_hold_iso', 'wrist_ext_db', 'wrist_ext_band', 'riser_lift_db', 'rising_hold_iso', 'finger_containment_hold', 'scott_hook_curl', 'hook_hold_iso', 'side_press_db_bench', 'side_hold_iso_pulley', 'back_pressure_low_row', 'back_hold_table_iso', 'machine_wrist_curl', 'machine_reverse_curl', 'press_chain_pushdown', 'kettlebell_hold', 'bodyweight_dead_hang']) {
      expect(ids.has(id), id).toBe(true);
    }
  });
  it('новичок не получает advanced-упражнения (kingsmove) — гейт сложности', () => {
    const plan = buildArmPlan({ ...BASE, discipline: 'armlifting', patternId: 'grip_3_support', level: 'beginner', technique: 'balanced' } as any);
    const ids = allIds(plan);
    expect(ids).not.toContain('kingsmove_wrist_back');
    expect(ids).not.toContain('kingsmove_hold_iso');
  });
  it('CSV: BOM, шапка, строки недель + защита от формул', () => {
    const plan = finalizeArmPlan(buildArmPlan({ ...BASE }), { level: 'intermediate' });
    const csv = buildArmPlanCsv(plan);
    expect(csv.charCodeAt(0)).toBe(65279);
    expect(csv).toContain('"Неделя";"Блок";"Фаза"');
    expect(csv).toContain('"TableHeavy"');
    const mutated = JSON.parse(JSON.stringify(plan));
    mutated.weeks[0].sessions[0].exercises[0].comment = '=SUM(A1)';
    const csv2 = buildArmPlanCsv(mutated);
    expect(csv2).toContain("\"'=SUM(A1)\"");
  });
});
