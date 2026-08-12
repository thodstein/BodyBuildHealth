/**
 * pl-taper-append.test.ts — тесты:
 * 1. appendPLTaperWeeks(plan, n) — реальное добавление тапер-недель к активному циклу.
 * 2. recommendWeightCut — рекомендации по сбросу веса перед соревнованием.
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks, type LMSBuildOutput } from '../lms-builder.engine';
import { recommendWeightCut } from '../../gym-competition.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildBase(weeksOverride = 8): LMSBuildOutput {
  return buildLMSPlan({
    template: CYCLE_01 as never,
    pmMap,
    fallbackPm: 80,
    mode: 'natural',
    weeksOverride,
    faithful: true,
  } as never);
}

const weekVolume = (wk: LMSBuildOutput['weeks'][number]): number => {
  let v = 0;
  for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
  return v;
};

describe('appendPLTaperWeeks', () => {
  it('добавляет 2 тапер-недели в конец активного плана', () => {
    const plan = buildBase(6);
    const before = plan.weeks.length;
    const next = appendPLTaperWeeks(plan, 2);
    expect(next.weeks.length).toBe(before + 2);
    expect(next.weeks[before - 1].week).toBe(plan.weeks[before - 1].week);
    expect(next.weeks[before].week).toBe(plan.weeks[before - 1].week + 1);
    expect(next.weeks[before + 1].week).toBe(plan.weeks[before - 1].week + 2);
  });

  it('снижает объём в добавленных неделях: N-1 ×0.65, N ×0.45', () => {
    const plan = buildBase(6);
    const ref = Math.max(weekVolume(plan.weeks[5]), weekVolume(plan.weeks[4]));
    const next = appendPLTaperWeeks(plan, 2);
    const vPrev = weekVolume(next.weeks[next.weeks.length - 2]);
    const vLast = weekVolume(next.weeks[next.weeks.length - 1]);
    expect(vPrev).toBeLessThanOrEqual(Math.ceil(ref * 0.7));
    expect(vLast).toBeLessThanOrEqual(Math.ceil(ref * 0.55));
    expect(vLast).toBeLessThan(vPrev);
  });

  it('увеличивает RIR в тапер-неделях (+1 предпоследняя, +2 последняя)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    const prev = next.weeks[next.weeks.length - 2];
    const last = next.weeks[next.weeks.length - 1];
    const baseRir = plan.weeks[plan.weeks.length - 1].days[0]?.exercises[0]?.rir ?? 2;
    expect(prev.days[0].exercises[0].rir).toBeGreaterThanOrEqual(baseRir + 1);
    expect(last.days[0].exercises[0].rir).toBeGreaterThanOrEqual(prev.days[0].exercises[0].rir);
  });

  it('сохраняет вес (интенсивность) — меняется только объём', () => {
    const plan = buildBase(6);
    const baseW = plan.weeks[plan.weeks.length - 1].days[0].exercises[0].workSets[0].weight;
    const next = appendPLTaperWeeks(plan, 2);
    const lastW = next.weeks[next.weeks.length - 1].days[0].exercises[0].workSets[0].weight;
    expect(lastW).toBe(baseW);
  });

  it('помечает добавленные недели sourcePhase=peak и macroPhase=competition', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    for (const wk of next.weeks.slice(-2)) {
      expect(wk.sourcePhase).toBe('peak');
      expect(wk.macroPhase).toBe('competition');
    }
  });

  it('не ломает план: 1 неделя → 1 тапер-неделя (×0.45, RIR+2)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 1);
    expect(next.weeks.length).toBe(plan.weeks.length + 1);
    const last = next.weeks[next.weeks.length - 1];
    expect(last.macroPhase).toBe('competition');
    expect(last.days[0].exercises[0].rir).toBeGreaterThan(plan.weeks[plan.weeks.length - 1].days[0].exercises[0].rir);
  });

  it('поддерживает 3+ тапер-недели с мягкой кривой объёма', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 3);
    expect(next.weeks.length).toBe(plan.weeks.length + 3);
    const vols = next.weeks.slice(-3).map(w => weekVolume(w));
    expect(vols[2]).toBeLessThan(vols[1]);
    expect(vols[1]).toBeLessThanOrEqual(vols[0]);
  });

  it('пересчитывает cycleMetrics (sessions выросли)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    expect(next.cycleMetrics.sessions).toBeGreaterThan(plan.cycleMetrics.sessions);
  });

  it('добавляет пояснение в progressionRationale', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    expect(next.progressionRationale).toContain('Тапер');
    expect(next.progressionRationale).toContain('+2');
  });

  it('не мутирует исходный план (иммутабельность)', () => {
    const plan = buildBase(6);
    const before = plan.weeks.length;
    appendPLTaperWeeks(plan, 2);
    expect(plan.weeks.length).toBe(before);
  });

  it('guards: taperWeeks<1 и пустой план → без изменений', () => {
    const plan = buildBase(6);
    expect(appendPLTaperWeeks(plan, 0).weeks.length).toBe(plan.weeks.length);
    expect(appendPLTaperWeeks({ ...plan, weeks: [] } as LMSBuildOutput, 2).weeks.length).toBe(0);
  });
});

describe('recommendWeightCut', () => {
  it('уже в категории → toCut=0, без дефицита', () => {
    const rec = recommendWeightCut(80, 83, 8);
    expect(rec.toCut).toBe(0);
    expect(rec.feasible).toBe(true);
    expect(rec.dailyDeficitKcal).toBe(0);
    expect(rec.recommendations[0]).toContain('уже в категории');
  });

  it('сброс 5 кг за 10 недель → безопасный темп, дефицит ~550 ккал/день', () => {
    const rec = recommendWeightCut(85, 80, 10);
    expect(rec.toCut).toBe(5);
    expect(rec.feasible).toBe(true);
    expect(rec.weeklyDeficitKcal).toBe(3850); // 0.5 кг/нед × 7700
    expect(rec.dailyDeficitKcal).toBe(550);
    expect(rec.timeline.length).toBe(10);
    expect(rec.timeline[9].weight).toBe(80);
  });

  it('сброс 10 кг за 4 недели → не безопасно (feasible=false)', () => {
    const rec = recommendWeightCut(90, 80, 4);
    expect(rec.toCut).toBe(10);
    expect(rec.feasible).toBe(false);
    expect(rec.recommendations.some(r => r.startsWith('❌'))).toBe(true);
  });

  it('крайний сброс малый: 1.5 кг за 3 нед → лёгкая сушка, рекомендации присутствуют', () => {
    const rec = recommendWeightCut(84, 82.5, 3);
    expect(rec.toCut).toBeCloseTo(1.5);
    expect(rec.feasible).toBe(true);
    expect(rec.recommendations.some(r => r.includes('Лёгкая сушка'))).toBe(true);
  });

  it('темп выше безопасного → предупреждение ⚠', () => {
    // 82 → 74 = 8 кг за 6 недель = 1.33 кг/нед > 0.61 безопасного
    const rec = recommendWeightCut(82, 74, 6);
    expect(rec.feasible).toBe(false);
  });

  it('таймлайн: последняя неделя — взвешивание, без дефицита', () => {
    const rec = recommendWeightCut(85, 80, 4);
    const last = rec.timeline[3];
    expect(last.note).toContain('Взвешивание');
  });

  it('большой сброс → рекомендация по белку', () => {
    const rec = recommendWeightCut(90, 80, 12);
    expect(rec.toCut).toBe(10);
    expect(rec.recommendations.some(r => r.includes('Белок 2.2'))).toBe(true);
  });

  it('weeksToMeet=0 → нет деления на ноль', () => {
    const rec = recommendWeightCut(85, 80, 0);
    expect(Number.isFinite(rec.dailyDeficitKcal)).toBe(true);
    expect(rec.timeline.length).toBe(0);
  });

  it('целевой вес выше текущего → toCut=0', () => {
    const rec = recommendWeightCut(75, 83, 8);
    expect(rec.toCut).toBe(0);
  });

  it('типаж: все поля возвращаются', () => {
    const rec = recommendWeightCut(85, 80, 8);
    expect(rec.currentWeight).toBe(85);
    expect(rec.targetWeight).toBe(80);
    expect(typeof rec.safeWeeklyRate).toBe('number');
    expect(typeof rec.weeksNeeded).toBe('number');
    expect(Array.isArray(rec.recommendations)).toBe(true);
    expect(Array.isArray(rec.timeline)).toBe(true);
  });
});
