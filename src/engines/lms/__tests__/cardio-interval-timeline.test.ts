/**
 * cardio-interval-timeline.test.ts — интервальный таймлайн (аудит 2026-11, ч.2).
 *
 * Дефект, который здесь зафиксирован: `structured` (работа/отдых/подходы) в
 * данных был, но таймер вёл сессию ОДНИМ обратным отсчётом. Теперь структура
 * разворачивается в шаги, и главное правило: таймлайн никогда не длиннее плана
 * (нельзя «съесть» план разминкой), а без структуры интервалы не выдумываются.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCardioIntervalPlan, cardioIntervalStepAt, cardioIntervalDoneWork,
} from '../cardio.engine';

const session = (durationMin: number, structured?: { workSec: number; restSec: number; reps: number }[]) => ({
  type: structured ? ('hiit' as const) : ('zone2' as const),
  durationMin,
  structured,
});

describe('buildCardioIntervalPlan', () => {
  it('без structured интервального режима нет (ничего не выдумываем)', () => {
    expect(buildCardioIntervalPlan(session(40))).toBeNull();
    expect(buildCardioIntervalPlan(session(40, []))).toBeNull();
  });

  it('8×(1/1) при 40 мин: разминка и заминка делят остаток, сумма = план', () => {
    const plan = buildCardioIntervalPlan(session(40, [{ workSec: 60, restSec: 60, reps: 8 }]))!;
    expect(plan.workSteps).toBe(8);
    expect(plan.mainSec).toBe(960);           // 8 × (60+60)
    expect(plan.budgetSec).toBe(2400);
    expect(plan.warmupSec).toBe(720);          // остаток 1440 → 12/12
    expect(plan.cooldownSec).toBe(720);
    expect(plan.totalSec).toBe(2400);          // ровно план, не больше
    expect(plan.steps[0].kind).toBe('warmup');
    expect(plan.steps[plan.steps.length - 1].kind).toBe('cooldown');
  });

  it('шаги идут парами «работа → отдых», номера подходов сквозные', () => {
    const plan = buildCardioIntervalPlan(session(40, [{ workSec: 60, restSec: 60, reps: 3 }]))!;
    const works = plan.steps.filter(s => s.kind === 'work');
    expect(works.map(s => s.label)).toEqual(['Работа 1/3', 'Работа 2/3', 'Работа 3/3']);
    expect(plan.steps.filter(s => s.kind === 'rest').map(s => s.rep)).toEqual([1, 2, 3]);
  });

  it('restSec = 0 → нет шагов «отдых» (непрерывный тест)', () => {
    const plan = buildCardioIntervalPlan(session(45, [{ workSec: 1200, restSec: 0, reps: 1 }]))!;
    expect(plan.steps.filter(s => s.kind === 'rest')).toHaveLength(0);
    expect(plan.workSteps).toBe(1);
    expect(plan.totalSec).toBeLessThanOrEqual(45 * 60);
  });

  it('структура длиннее плана: разминки/заминки нет, таймлайн = структура', () => {
    const plan = buildCardioIntervalPlan(session(20, [{ workSec: 600, restSec: 60, reps: 4 }]))!;
    expect(plan.warmupSec).toBe(0);
    expect(plan.cooldownSec).toBe(0);
    expect(plan.totalSec).toBe(2640);          // 44 мин: данные важнее плана
    expect(plan.totalSec).toBeGreaterThan(20 * 60);
  });

  it('разминка/заминка ограничены 20 мин каждая (остаток не «раздувает» их)', () => {
    const plan = buildCardioIntervalPlan(session(90, [{ workSec: 10, restSec: 0, reps: 1 }]))!;
    expect(plan.warmupSec).toBe(1200);
    expect(plan.cooldownSec).toBe(1200);
    expect(plan.totalSec).toBe(2410);
    expect(plan.totalSec).toBeLessThan(90 * 60);
  });

  it('несколько блоков раскладываются подряд (2×(5/2.5) дважды)', () => {
    const plan = buildCardioIntervalPlan(session(60, [
      { workSec: 300, restSec: 150, reps: 2 },
      { workSec: 300, restSec: 150, reps: 2 },
    ]))!;
    expect(plan.workSteps).toBe(4);
    expect(plan.mainSec).toBe(1800);
    expect(plan.steps.filter(s => s.kind === 'work').map(s => s.sec)).toEqual([300, 300, 300, 300]);
  });
});

describe('cardioIntervalStepAt', () => {
  const plan = buildCardioIntervalPlan(session(20, [{ workSec: 60, restSec: 30, reps: 2 }]))!;

  it('начало — разминка', () => {
    const at = cardioIntervalStepAt(plan, 0);
    expect(at.step.kind).toBe('warmup');
    expect(at.stepRemainingSec).toBe(plan.warmupSec);
  });

  it('граница шага: ровно на границе — уже следующий шаг', () => {
    const first = cardioIntervalStepAt(plan, plan.warmupSec);
    expect(first.step.kind).toBe('work');
    expect(first.step.rep).toBe(1);
    const rest = cardioIntervalStepAt(plan, plan.warmupSec + 60);
    expect(rest.step.kind).toBe('rest');
    expect(rest.stepRemainingSec).toBe(30);
  });

  it('после конца — последний шаг, остаток 0', () => {
    const at = cardioIntervalStepAt(plan, plan.totalSec + 500);
    expect(at.stepRemainingSec).toBe(0);
    expect(at.step.kind).toBe('cooldown');
  });
});

describe('cardioIntervalDoneWork', () => {
  const plan = buildCardioIntervalPlan(session(20, [{ workSec: 60, restSec: 30, reps: 3 }]))!;

  it('середина второго подхода — сделан один', () => {
    expect(cardioIntervalDoneWork(plan, plan.warmupSec + 60 + 30 + 30)).toBe(1);
  });

  it('до конца дошли — все подходы', () => {
    expect(cardioIntervalDoneWork(plan, plan.totalSec)).toBe(3);
  });

  it('раннее завершение не засчитывает недоделанный подход', () => {
    // первый подход закрыт, второй — только начат
    expect(cardioIntervalDoneWork(plan, plan.warmupSec + 60 + 30 + 10)).toBe(1);
  });
});
