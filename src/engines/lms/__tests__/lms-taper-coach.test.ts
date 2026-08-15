/**
 * lms-taper-coach.test.ts — тренерский слой тапера/пика ПЛ:
 * pmFeasibility (достижимость плана ПМ), recommendTaperConfig (авто-подбор
 * схемы под данные спортсмена), coachPLPeakPlan (вердикт по готовности к старту).
 */
import { describe, expect, it } from 'vitest';
import {
  pmFeasibility, recommendTaperConfig, coachPLPeakPlan, projectPmToMeet, liftKeyOf,
} from '../lms-taper-coach.engine';
import type { LMSBuildOutput, LMSPlanWeek } from '../lms-builder.engine';

const mkEx = (name: string, pct: number, sets: number, load?: string, reps = 3) => ({
  name, group: 'Грудь', coef: 1, mnosz: 1, pm: 200, rir: 2,
  ...(load ? { load } : {}),
  workSets: [{ pct, reps, sets, weight: 140, rir: 2 }],
});

const mkDay = (mainPct: number, mainSets: number, accSets: number) => ({
  exercises: [
    mkEx('Присед', mainPct, mainSets, 'main'),
    mkEx('Жим лежа', mainPct, mainSets, 'main'),
    mkEx('Тяга к поясу', 0.7, accSets),
    mkEx('Разгибание', 0.7, accSets),
  ],
  metrics: { tonnage: 0, kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0 } as any,
});

const mkWeek = (week: number, taper?: boolean, meet?: boolean, post?: boolean, mock?: boolean): LMSPlanWeek => ({
  week,
  pmRow: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 },
  days: [mkDay(taper ? 0.8 : 0.85, taper ? 2 : 3, taper ? 2 : 4), mkDay(taper ? 0.8 : 0.85, taper ? 2 : 3, taper ? 2 : 4)],
  ...(taper ? { taperWeek: true, sourcePhase: 'peak' as const } : {}),
  ...(meet ? { meetWeek: true, meetAttempts: { strategy: 'balanced' as const, lifts: [{ name: 'Присед', opener: 185, second: 192.5, third: 202.5, target: 202.5, warmup: [{ pct: 0.4, weight: 75, reps: 5 }] }] } } : {}),
  ...(post ? { postMeet: true, sourcePhase: 'deload' as const } : {}),
  ...(mock ? { mockMeet: true } : {}),
});

/** Сбалансированный план: 6 недель цикла → 2 тапер (×0.5 от пика) → meet → post. */
const balancedPlan = (): LMSBuildOutput => {
  const weeks = [
    mkWeek(1), mkWeek(2), mkWeek(3), mkWeek(4), mkWeek(5), mkWeek(6),
    mkWeek(7, true), mkWeek(8, true), mkWeek(9, false, true), mkWeek(10, false, false, true),
  ];
  return { template: {} as any, progressionRationale: '', weeks, cycleMetrics: {} as any };
};

const baseCtx = () => ({
  fatigue: 55,
  acwr: { ratio: 1.2, zone: 'optimal' as const },
  currentWeight: 82,
  targetWeight: 80,
  forecastPm: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 },
  actualPm: { 'Присед': 198, 'Жим лежа': 138, 'Становая тяга': 238 },
  weeksToMeet: 4,
  weeklyK: 0.01,
});

describe('pmFeasibility', () => {
  it('план ниже прогноза — реалистично', () => {
    const f = pmFeasibility({ ...baseCtx(), plannedPm: { 'Присед': 190, 'Жим лежа': 130 } });
    expect(f.status).toBe('realistic');
    expect(f.lifts.every(l => l.feasible)).toBe(true);
  });

  it('план чуть выше прогноза — на грани (tight)', () => {
    // База приседа — фактический ПМ 198; прогноз к старту ≈ 198×1.01^4 ≈ 206.
    // План 210 требует ещё ~2 нед прогрессии — впритык к 4 неделям → tight.
    const f = pmFeasibility({ ...baseCtx(), plannedPm: { 'Присед': 210 } });
    expect(f.status).toBe('tight');
    const l = f.lifts[0];
    expect(l.feasible).toBe(false);
    expect(l.weeksNeeded).toBeLessThanOrEqual(4);
  });

  it('план сильно выше прогноза — нереалистично', () => {
    const f = pmFeasibility({ ...baseCtx(), plannedPm: { 'Присед': 240 } });
    expect(f.status).toBe('unrealistic');
    expect(f.summary).toContain('нереалистичен');
  });

  it('без плана федерации — реалистично с пояснением', () => {
    const f = pmFeasibility(baseCtx());
    expect(f.status).toBe('realistic');
    expect(f.summary).toContain('не задан');
  });
});

describe('recommendTaperConfig', () => {
  it('высокая усталость + опасный ACWR → classic, длиннее, консервативные прикиды', () => {
    const r = recommendTaperConfig({ ...baseCtx(), fatigue: 80, acwr: { ratio: 1.7, zone: 'dangerous' } });
    expect(r.mode).toBe('classic');
    expect(r.taperWeeks).toBeGreaterThanOrEqual(3);
    expect(r.strategy).toBe('conservative');
    expect(r.rationale.some(x => x.includes('ACWR'))).toBe(true);
  });

  it('цель PR при низкой усталости → ПЛ-пик-протокол + агрессивные прикиды', () => {
    const r = recommendTaperConfig({ ...baseCtx(), fatigue: 30, plannedPm: { 'Присед': 220, 'Жим лежа': 155, 'Становая тяга': 250 } });
    expect(r.mode).toBe('pl');
    expect(r.strategy).toBe('aggressive');
  });

  it('низкая усталость без цели PR → про-тапер', () => {
    const r = recommendTaperConfig({ ...baseCtx(), fatigue: 20, plannedPm: {} });
    expect(r.mode).toBe('pro');
  });

  it('недогруз (undertrained) → тапер короче', () => {
    const r = recommendTaperConfig({ ...baseCtx(), fatigue: 20, acwr: { ratio: 0.6, zone: 'undertrained' } });
    expect(r.taperWeeks).toBeLessThan(3);
  });

  it('весовая цель: сгонка → lose, набор → gain', () => {
    expect(recommendTaperConfig({ ...baseCtx(), currentWeight: 88, targetWeight: 80 }).weightGoal).toBe('lose');
    expect(recommendTaperConfig({ ...baseCtx(), currentWeight: 74, targetWeight: 80 }).weightGoal).toBe('gain');
    expect(recommendTaperConfig({ ...baseCtx(), currentWeight: 80, targetWeight: 80 }).weightGoal).toBe('maintain');
  });

  it('mock meet недоступен при малом времени до старта', () => {
    const r = recommendTaperConfig({ ...baseCtx(), weeksToMeet: 2 });
    expect(r.mockMeet).toBe(false);
    expect(r.postMeet).toBe(true);
  });
});

describe('coachPLPeakPlan', () => {
  it('пустой план → score 0 и danger-заметка', () => {
    const v = coachPLPeakPlan({ template: {} as any, progressionRationale: '', weeks: [], cycleMetrics: {} as any });
    expect(v.score).toBe(0);
    expect(v.notes.some(n => n.severity === 'danger')).toBe(true);
  });

  it('сбалансированный план → высокая готовность, без danger', () => {
    const v = coachPLPeakPlan(balancedPlan(), baseCtx());
    expect(v.score).toBeGreaterThanOrEqual(70);
    expect(v.notes.some(n => n.severity === 'danger')).toBe(false);
    expect(v.notes.some(n => n.icon === '✅')).toBe(true);
  });

  it('тяжёлые рабочие сеты в финальной тапер-неделе → danger', () => {
    const plan = balancedPlan();
    // Финальная тапер-неделя (нед 8): основные — тяжёлые сеты 90% × 3 сета
    plan.weeks[7] = { ...plan.weeks[7], days: [mkDay(0.9, 3, 2), mkDay(0.9, 3, 2)] };
    const v = coachPLPeakPlan(plan, baseCtx());
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('тяжёлые'))).toBe(true);
    expect(v.score).toBeLessThan(80);
  });

  it('нет mock meet и пост-недели → info-заметки, ACWR dangerous → danger', () => {
    const plan = balancedPlan();
    const withoutMock = { ...plan, weeks: plan.weeks.filter(w => !w.mockMeet) };
    const v = coachPLPeakPlan(withoutMock, { ...baseCtx(), acwr: { ratio: 1.7, zone: 'dangerous' } });
    expect(v.notes.some(n => n.text.includes('Mock meet'))).toBe(true);
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('ACWR'))).toBe(true);
  });

  it('тапер поверх deload-фазы → warn о двойной разгрузке', () => {
    const plan = balancedPlan();
    plan.weeks[6] = { ...plan.weeks[6], taperWeek: true, sourcePhase: 'deload' };
    const v = coachPLPeakPlan(plan, baseCtx());
    expect(v.notes.some(n => n.severity === 'warn' && n.text.includes('двойная'))).toBe(true);
  });

  it('нереалистичный план ПМ → danger-заметка по достижимости', () => {
    const v = coachPLPeakPlan(balancedPlan(), { ...baseCtx(), plannedPm: { 'Присед': 240 } });
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('нереалистичен'))).toBe(true);
  });

  it('вердикт несёт конкретные действия (auto-подбор)', () => {
    const v = coachPLPeakPlan(balancedPlan(), baseCtx());
    expect(v.actions).toBeTruthy();
    expect(v.actions!.mode).toBeTruthy();
    expect(v.actions!.taperWeeks).toBeGreaterThan(0);
  });
});

describe('вспомогательные', () => {
  it('projectPmToMeet — прогноз с учётом прогрессии', () => {
    const p = projectPmToMeet({ 'Присед': 200 }, 0.01, 4);
    expect(p['Присед']).toBeCloseTo(208.1, 0);
  });

  it('liftKeyOf — распознавание лифтов', () => {
    expect(liftKeyOf('Присед со штангой')).toBe('squat');
    expect(liftKeyOf('Жим штанги лёжа')).toBe('bench');
    expect(liftKeyOf('Жим ногами')).toBeNull();
    expect(liftKeyOf('Становая тяга')).toBe('deadlift');
    expect(liftKeyOf('Тяга к поясу')).toBeNull();
  });
});
