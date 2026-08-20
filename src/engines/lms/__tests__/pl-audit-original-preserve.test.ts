import { describe, it, expect } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks } from '../lms-builder.engine';
import { buildPLTaperCurve, type TaperMode } from '../lms-taper.engine';
import { buildPLPeakBlockLayout } from '../lms-peak-block.engine';
import { applyMacroTaperToPLWeeks } from '../lms-macro-taper.engine';
import { buildPLPeakWeekCutProtocol } from '../lms-taper-coach.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_09K } from '../../../data/lms-cycles/cycle-09k';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import type { LMSPlanWeek } from '../lms-builder.engine';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

/**
 * КРИТИЧЕСКИЙ АУДИТ ПЛ-АВТО — инвариант «исходные ПЛ-циклы не трогать».
 *
 * Главное правило: СРЦ-циклы (lms-cycles/*) остаются как в оригинале.
 * Это гарантируется НЕ-мутацией входного шаблона во ВСЕХ путях сборки
 * (включая слабые группы, слабые точки, тапер) и байт-точной сборкой
 * в faithful-режиме.
 */

/** Глубокая копия без мутации исходного объекта. */
function snapshot<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function sourceLayouts(cycle: SRCycleTemplate) {
  return cycle.weeks && cycle.weeks.length > 0 ? cycle.weeks : [cycle.week1];
}

describe('ПЛ-авто: шаблон цикла НЕ мутируется ни одним путём сборки', () => {
  const cases: Array<[string, SRCycleTemplate]> = [
    ['CYCLE_01', CYCLE_01],
    ['CYCLE_09K', CYCLE_09K],
  ];

  for (const [label, cycle] of cases) {
    it(`${label}: faithful build не мутирует шаблон`, () => {
      const before = snapshot(cycle);
      buildLMSPlan({ template: cycle, pmMap, fallbackPm: 80, faithful: true, progressionEnabled: false, weeksOverride: cycle.meta.weeks });
      expect(cycle).toEqual(before);
    });

    it(`${label}: default build (саморасчёт) не мутирует шаблон`, () => {
      const before = snapshot(cycle);
      buildLMSPlan({ template: cycle, pmMap, fallbackPm: 80, faithful: false, progressionEnabled: false, weeksOverride: cycle.meta.weeks });
      expect(cycle).toEqual(before);
    });

    it(`${label}: build со слабыми группами/точками/диагностикой не мутирует шаблон`, () => {
      const before = snapshot(cycle);
      buildLMSPlan({
        template: cycle, pmMap, fallbackPm: 80,
        faithful: true, progressionEnabled: false,
        weakPoints: ['chest', 'back'],
        plWeakPoints: [{ lift: 'bench', weakPoint: 'lockout' }],
        diagnosticExerciseMap: { 'bench|lockout': ['Дожим с бруска'] },
      });
      expect(cycle).toEqual(before);
    });

    it(`${label}: appendPLTaperWeeks не мутирует шаблон и не мутирует базовые недели плана`, () => {
      const before = snapshot(cycle);
      const plan = buildLMSPlan({ template: cycle, pmMap, fallbackPm: 80, faithful: true, progressionEnabled: false, weeksOverride: cycle.meta.weeks });
      const baseWeeks = snapshot(plan.weeks);
      const baseRationale = plan.progressionRationale;
      const out = appendPLTaperWeeks(plan, 2, { reference: '2026-08-30', meetWeek: { strategy: 'balanced' }, postMeet: { volumeMult: 0.5 } });
      // Шаблон не тронут.
      expect(cycle).toEqual(before);
      // Исходные недели плана остались байт-в-байт (тапер добавлен, не переписан).
      expect(out.weeks.slice(0, plan.weeks.length)).toEqual(baseWeeks);
      expect(out.progressionRationale).toContain(baseRationale);
      expect(out.weeks.length).toBeGreaterThan(plan.weeks.length);
    });
  }
});

describe('ПЛ-авто: faithful = исходный цикл байт-в-байт (pct/reps/число set-блоков)', () => {
  it('каждый source set-блок сохраняет pct/reps/sets и число блоков', () => {
    const plan = buildLMSPlan({ template: CYCLE_09K, pmMap, fallbackPm: 80, faithful: true, progressionEnabled: false, weeksOverride: CYCLE_09K.meta.weeks });
    const layouts = sourceLayouts(CYCLE_09K);
    for (let wi = 0; wi < layouts.length; wi++) {
      const srcWeek = layouts[wi];
      const pWeek = plan.weeks[wi];
      expect(pWeek.days.length).toBe(srcWeek.length);
      for (let di = 0; di < srcWeek.length; di++) {
        const srcDay = srcWeek[di];
        const pDay = pWeek.days[di];
        for (let ei = 0; ei < srcDay.exercises.length; ei++) {
          const se = srcDay.exercises[ei];
          const pe = pDay.exercises[ei];
          // Число set-блоков не должно схлопываться.
          expect(pe.workSets.length).toBe(se.sets.length);
          for (let si = 0; si < se.sets.length; si++) {
            expect(pe.workSets[si].pct).toBe(se.sets[si].pct);
            expect(pe.workSets[si].reps).toBe(se.sets[si].reps);
            expect(pe.workSets[si].sets).toBe(se.sets[si].sets);
          }
        }
      }
    }
  });

  it('faithful + слабые точки: source-упражнения не тронуты, ассистенты добавлены СВЕРХУ (хвостом)', () => {
    const plan = buildLMSPlan({
      template: CYCLE_09K, pmMap, fallbackPm: 80,
      faithful: true, progressionEnabled: false,
      plWeakPoints: [{ lift: 'bench', weakPoint: 'lockout' }],
    });
    const layouts = sourceLayouts(CYCLE_09K);
    // Источник (первые N упражнений каждого дня) не изменился.
    for (let wi = 0; wi < layouts.length; wi++) {
      const srcWeek = layouts[wi];
      const pWeek = plan.weeks[wi];
      for (let di = 0; di < srcWeek.length; di++) {
        const srcDay = srcWeek[di];
        const pDay = pWeek.days[di];
        expect(pDay.exercises.length).toBeGreaterThanOrEqual(srcDay.exercises.length);
        for (let ei = 0; ei < srcDay.exercises.length; ei++) {
          const se = srcDay.exercises[ei];
          const pe = pDay.exercises[ei];
          expect(pe.name).toBe(se.name);
          expect(pe.workSets.length).toBe(se.sets.length);
          for (let si = 0; si < se.sets.length; si++) {
            expect(pe.workSets[si].pct).toBe(se.sets[si].pct);
            expect(pe.workSets[si].reps).toBe(se.sets[si].reps);
            expect(pe.workSets[si].sets).toBe(se.sets[si].sets);
          }
        }
      }
    }
    // Ассистент реально добавлен куда-то (всего упражнений больше, чем в источнике).
    const totalPlan = plan.weeks.reduce((s, w) => s + w.days.reduce((ss, d) => ss + d.exercises.length, 0), 0);
    const totalSrc = layouts.reduce((s, w) => s + w.reduce((ss, d) => ss + d.exercises.length, 0), 0);
    expect(totalPlan).toBeGreaterThan(totalSrc);
  });
});

describe('ПЛ-тапер: кривая не нарушает границы', () => {
  it('taperWeeks клампится в [1,4] для pl/wf, [1,3] для pro, [1,12] для classic', () => {
    const upperByMode: Record<TaperMode, number> = { classic: 12, pl: 4, pro: 3, wf: 4 };
    const modes: TaperMode[] = ['classic', 'pl', 'pro', 'wf'];
    for (const mode of modes) {
      expect(buildPLTaperCurve({ taperWeeks: 0, mode }).length).toBe(1);
      expect(buildPLTaperCurve({ taperWeeks: 99, mode }).length).toBe(upperByMode[mode]);
    }
  });

  it('кривая монотонно не растёт к финалу (финал — самый глубокий)', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 4, mode: 'classic' });
    const vols = curve.map(p => p.volumePct);
    for (let i = 1; i < vols.length; i++) expect(vols[i]).toBeLessThanOrEqual(vols[i - 1] + 1e-9);
    expect(vols[vols.length - 1]).toBeLessThan(vols[0]);
  });

  it('весовая цель lose: объём ×0.9 от maintain на всех точках кривой', () => {
    const a = buildPLTaperCurve({ taperWeeks: 2, mode: 'classic', weightGoal: 'maintain' });
    const b = buildPLTaperCurve({ taperWeeks: 2, mode: 'classic', weightGoal: 'lose' });
    for (let i = 0; i < a.length; i++) {
      // lose = ×0.9 затем округление к 2 знакам (канон r2 в buildPLTaperCurve).
      const expected = Math.round(a[i].volumePct * 0.9 * 100) / 100;
      expect(b[i].volumePct).toBe(expected);
    }
  });
});

describe('ПЛ-пик-блок: окно до старта уважает длину', () => {
  it('тапер длиннее окна → клампится, предупреждение', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 2, taperWeeks: 4, mockMeet: true, meetWeek: true });
    // mock(1) + meet(1) забирают окно; доступно под кривую = 1
    expect(l.taperWeeks).toBeLessThanOrEqual(1);
    expect(l.warnings.length).toBeGreaterThan(0);
  });

  it('длина блока = окно + пост', () => {
    const l = buildPLPeakBlockLayout({ windowWeeks: 8, taperWeeks: 2, mockMeet: true, meetWeek: true, postMeet: true });
    expect(l.totalWeeks).toBe(8 + 1);
    // ramp + taper покрывают доступные недели окна (8 - mock - meet = 6)
    expect(l.rampWeeks + l.taperWeeks).toBe(6);
  });
});

describe('ПЛ-тапер: краевые кейсы (A1/A2)', () => {
  it('A1: протокол сгонки пуст, когда вес уже в категории (манипуляция не нужна)', () => {
    const p = buildPLPeakWeekCutProtocol(80, 80);
    expect(p.needed).toBe(false);
    expect(p.days).toHaveLength(0);
    // Агрессивная деплеция (вода ↓, натрий 4→0.5 г) не должна показываться без необходимости.
    expect(p.days.map(d => d.waterMl)).not.toContain('6 л');
  });

  it('A1: при нужной сгонке протокол дней полный (7 дней вода/натрий/карбы)', () => {
    const p = buildPLPeakWeekCutProtocol(85, 80);
    expect(p.needed).toBe(true);
    expect(p.days).toHaveLength(7);
    expect(p.days[0].day).toBe(1);
    expect(p.days[6].day).toBe(7);
  });

  it('A2: старт сразу после предыдущего соревнования → предупреждение о пустом тапере', () => {
    const base = buildLMSPlan({ template: CYCLE_09K, pmMap, fallbackPm: 80, faithful: true, progressionEnabled: false, weeksOverride: CYCLE_09K.meta.weeks });
    // Спаренные старты: competition на неделе 4 и 5 (вплотную, без промежуточной недели).
    const weeks: LMSPlanWeek[] = base.weeks.slice(0, 7).map((w, i) => {
      const macroPhase = (i + 1) === 4 || (i + 1) === 5 ? 'competition' : (i + 1) === 3 ? 'peak' : undefined;
      return { ...w, macroPhase: macroPhase as LMSPlanWeek['macroPhase'] };
    });
    const res = applyMacroTaperToPLWeeks(weeks, { mode: 'classic', taperWeeksPerBlock: 2 });
    // Второй старт (нед 5) не имеет недель под тапер — есть честное предупреждение.
    expect(res.notes.some(n => n.includes('сразу после предыдущего соревнования'))).toBe(true);
  });
});
