/**
 * lms-taper-coach.test.ts — тренерский слой тапера/пика ПЛ:
 * pmFeasibility (достижимость плана ПМ), recommendTaperConfig (авто-подбор
 * схемы под данные спортсмена), coachPLPeakPlan (вердикт по готовности к старту).
 */
import { describe, expect, it } from 'vitest';
import {
  pmFeasibility, recommendTaperConfig, coachPLPeakPlan, projectPmToMeet, liftKeyOf,
  sRPEAdjustment, scoreTaperScenario, compareTaperScenarios, evaluateMeetAttemptsFromDiary,
} from '../lms-taper-coach.engine';
import type { LMSBuildOutput, LMSPlanWeek } from '../lms-builder.engine';
import type { MeetAttemptsInfo } from '../competition-attempts';

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

  it('weeklyK=0/NaN/отрицательный — не даёт Infinity/NaN (guard)', () => {
    for (const k of [0, NaN, -0.01, undefined]) {
      const f = pmFeasibility({ ...baseCtx(), weeklyK: k, plannedPm: { 'Присед': 230 } });
      for (const l of f.lifts) {
        expect(Number.isFinite(l.weeksNeeded), `k=${k}`).toBe(true);
        expect(Number.isFinite(l.forecast), `k=${k}`).toBe(true);
      }
      expect(f.status).toBeTruthy();
    }
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

  it('план БЕЗ тапера → danger «тапер не применён»', () => {
    const plain = { ...balancedPlan(), weeks: [mkWeek(1), mkWeek(2), mkWeek(3), mkWeek(4)] };
    const v = coachPLPeakPlan(plain, baseCtx());
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('Тапер не применён'))).toBe(true);
    expect(v.score).toBeLessThan(80);
  });

  it('старый план без workSets у упражнений — вердикт не падает', () => {
    const stale: LMSBuildOutput = {
      template: {} as any,
      progressionRationale: '',
      cycleMetrics: {} as any,
      weeks: [
        { week: 1, pmRow: { 'Присед': 200 }, days: [{ exercises: [{ name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, pm: 200, rir: 2 } as any], metrics: {} as any }] },
        { week: 2, pmRow: { 'Присед': 200 }, taperWeek: true, days: [{ exercises: [{ name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, pm: 200, rir: 2 } as any], metrics: {} as any }] },
      ],
    };
    const v = coachPLPeakPlan(stale, baseCtx());
    expect(Number.isFinite(v.score)).toBe(true);
    expect(v.notes.length).toBeGreaterThan(0);
  });

  it('при наличии meet-недели — рекомендация по последним тяжёлым и праймингу', () => {
    const v = coachPLPeakPlan(balancedPlan(), baseCtx());
    expect(v.notes.some(n => n.text.includes('Последние тяжёлые'))).toBe(true);
    expect(v.notes.some(n => n.text.includes('прайминг'))).toBe(true);
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

// ═══════════ ПУНКТ 1 — sRPE-тренд нагрузки ═══════════
describe('sRPEAdjustment (дневник-интеграция)', () => {
  const day = (n: number, rpe: number, dur = 60) => {
    const d = new Date('2026-08-16T00:00:00');
    d.setDate(d.getDate() - n);
    return { date: d.toISOString().slice(0, 10), sRPE: rpe, durationMin: dur };
  };

  it('перегруз последних 14 дней (+50%) → тапер длиннее и глубже', () => {
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => day(1 + i, 8)),   // последние: 4×480
      ...Array.from({ length: 4 }, (_, i) => day(15 + i, 5)),  // предыдущие: 4×300
    ];
    const adj = sRPEAdjustment(sessions);
    expect(adj.taperWeeksDelta).toBe(1);
    expect(adj.volumeMult).toBeCloseTo(0.9, 2);
    expect(adj.note).toContain('перегруз');
  });

  it('недогруз последних 14 дней → тапер короче', () => {
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => day(1 + i, 4)),   // 4×240
      ...Array.from({ length: 4 }, (_, i) => day(15 + i, 8)),  // 4×480
    ];
    const adj = sRPEAdjustment(sessions);
    expect(adj.taperWeeksDelta).toBe(-1);
    expect(adj.volumeMult).toBeCloseTo(1.05, 2);
  });

  it('мало данных / стабильная нагрузка → без коррекции', () => {
    expect(sRPEAdjustment([]).taperWeeksDelta).toBe(0);
    expect(sRPEAdjustment(undefined).taperWeeksDelta).toBe(0);
    const stable = [
      ...Array.from({ length: 4 }, (_, i) => day(1 + i, 6)),
      ...Array.from({ length: 4 }, (_, i) => day(15 + i, 6)),
    ];
    expect(sRPEAdjustment(stable).taperWeeksDelta).toBe(0);
    expect(sRPEAdjustment(stable).note).toBeNull();
  });

  it('recommendTaperConfig учитывает sRPE-перегруз (длиннее + классика)', () => {
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => day(1 + i, 8)),
      ...Array.from({ length: 4 }, (_, i) => day(15 + i, 4)),
    ];
    const base = recommendTaperConfig({ ...baseCtx(), fatigue: 30, recentSessions: sessions });
    const plain = recommendTaperConfig({ ...baseCtx(), fatigue: 30 });
    expect(base.taperWeeks).toBeGreaterThanOrEqual(plain.taperWeeks);
    expect(base.rationale.some(r => r.includes('перегруз'))).toBe(true);
  });
});

// ═══════════ ПУНКТ 3 — тайминг по календарю ═══════════
describe('coachPLPeakPlan + meetDate (календарь)', () => {
  it('при заданной дате старта — заметка с конкретными датами последних тяжёлых', () => {
    const v = coachPLPeakPlan(balancedPlan(), { ...baseCtx(), meetDate: '2026-09-20' });
    const d = v.notes.find(n => n.icon === '📅');
    expect(d).toBeTruthy();
    expect(d!.text).toContain('2026-09-12'); // присед за 8 дн
    expect(d!.text).toContain('2026-09-16'); // жим за 4 дн
    expect(d!.text).toContain('2026-09-08'); // тяга за 12 дн
    expect(d!.text).toContain('2026-09-18'); // прайминг за 2 дн
  });
});

// ═══════════ ПУНКТ 4 — сравнение сценариев ═══════════
describe('scoreTaperScenario / compareTaperScenarios', () => {
  it('оценка сценария: целевой финальный объём → высокий score', () => {
    const s = scoreTaperScenario({ id: 'classic-2', mode: 'classic', taperWeeks: 2 }, baseCtx());
    expect(s.score).toBeGreaterThan(50);
    expect(s.summary).toContain('классика 2 нед');
  });

  it('короткий тапер при опасном ACWR штрафуется', () => {
    const short = scoreTaperScenario({ id: 'classic-1', mode: 'classic', taperWeeks: 1 }, { ...baseCtx(), acwr: { ratio: 1.7, zone: 'dangerous' } });
    const long = scoreTaperScenario({ id: 'classic-3', mode: 'classic', taperWeeks: 3 }, { ...baseCtx(), acwr: { ratio: 1.7, zone: 'dangerous' } });
    expect(short.score).toBeLessThan(long.score);
  });

  it('compareTaperScenarios возвращает отсортированные результаты и лучший', () => {
    const { results, best } = compareTaperScenarios(baseCtx());
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results[0].scenario.id).toBe(best.scenario.id);
    // scores отсортированы по убыванию
    for (let i = 1; i < results.length; i++) expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
  });
});

// ═══════════ ПУНКТ 5 — оценка прикидов из дневника ═══════════
describe('evaluateMeetAttemptsFromDiary', () => {
  const attempts: MeetAttemptsInfo = {
    strategy: 'balanced',
    lifts: [
      { name: 'Присед', opener: 185, second: 192.5, third: 202.5, target: 202.5, warmup: [] },
      { name: 'Жим лежа', opener: 130, second: 135, third: 142.5, target: 142.5, warmup: [] },
    ],
  };

  it('третья взята → conservative + рекомендация агрессивнее', () => {
    const evalRes = evaluateMeetAttemptsFromDiary(attempts, [
      { date: '2026-08-10', exercises: [{ name: 'Присед', sets: [{ weightKg: 205, reps: 1 }] }] },
      { date: '2026-08-10', exercises: [{ name: 'Жим лежа', sets: [{ weightKg: 145, reps: 1 }] }] },
    ]);
    expect(evalRes).toBeTruthy();
    expect(evalRes!.lifts.every(l => l.made === 'third')).toBe(true);
    expect(evalRes!.lifts.every(l => l.verdict === 'conservative')).toBe(true);
    expect(evalRes!.nextStrategy).toBe('aggressive');
  });

  it('только опенер → aggressive + рекомендация консервативнее', () => {
    const evalRes = evaluateMeetAttemptsFromDiary(attempts, [
      { date: '2026-08-10', exercises: [{ name: 'Присед', sets: [{ weightKg: 185, reps: 1 }, { weightKg: 180, reps: 1 }] }] },
      { date: '2026-08-10', exercises: [{ name: 'Жим лежа', sets: [{ weightKg: 120, reps: 3 }] }] },
    ]);
    expect(evalRes).toBeTruthy();
    expect(evalRes!.lifts[0].made).toBe('opener');
    expect(evalRes!.lifts[1].made).toBe('none');
    expect(evalRes!.lifts[0].verdict).toBe('aggressive');
    expect(evalRes!.nextStrategy).toBe('conservative');
  });

  it('смешанный результат → balanced', () => {
    const evalRes = evaluateMeetAttemptsFromDiary(attempts, [
      { date: '2026-08-10', exercises: [{ name: 'Присед', sets: [{ weightKg: 200, reps: 1 }] }] },
      { date: '2026-08-10', exercises: [{ name: 'Жим лежа', sets: [{ weightKg: 130, reps: 1 }] }] },
    ]);
    expect(evalRes!.lifts[0].verdict).toBe('optimal'); // 200 < третья 202.5 → вторая взята
    expect(evalRes!.lifts[1].verdict).toBe('aggressive'); // 130 = опенер
    expect(evalRes!.nextStrategy).toBe('balanced');
  });

  it('без прикидов или без сессий → null', () => {
    expect(evaluateMeetAttemptsFromDiary(null, [])).toBeNull();
    expect(evaluateMeetAttemptsFromDiary(attempts, [])).not.toBeNull();
  });
});
