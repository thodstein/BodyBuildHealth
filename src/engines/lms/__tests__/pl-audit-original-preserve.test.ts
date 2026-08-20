import { describe, it, expect } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks } from '../lms-builder.engine';
import { buildPLTaperCurve, type TaperMode } from '../lms-taper.engine';
import { buildPLPeakBlockLayout } from '../lms-peak-block.engine';
import { applyMacroTaperToPLWeeks } from '../lms-macro-taper.engine';
import { buildPLPeakWeekCutProtocol, pmFeasibility, coachPLPeakPlan, sRPEAdjustment, evaluateMeetAttemptsFromDiary } from '../lms-taper-coach.engine';
import type { MeetAttemptsInfo } from '../competition-attempts';
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

describe('ПЛ-тапер: тренерские проверки (B3-B6)', () => {
  it('B3: неделя соревнований есть, а тапер отсутствует → danger-предупреждение', () => {
    const plan = buildLMSPlan({ template: CYCLE_09K, pmMap, fallbackPm: 80, faithful: true, progressionEnabled: false, weeksOverride: CYCLE_09K.meta.weeks });
    // Только meet-неделя, без тапер-недель.
    plan.weeks[plan.weeks.length - 1] = { ...plan.weeks[plan.weeks.length - 1], meetWeek: true };
    const v = coachPLPeakPlan(plan);
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('тапер отсутствует'))).toBe(true);
    expect(v.score).toBeLessThan(100);
  });

  it('B3: score клампится в [0,100] даже при крайних условиях', () => {
    // Пустой план → score 0 (минимальный).
    const v = coachPLPeakPlan({ weeks: [] } as any);
    expect(v.score).toBe(0);
    // Полный сбалансированный вердикт не превышает 100.
    const plan = buildLMSPlan({ template: CYCLE_09K, pmMap, fallbackPm: 80, faithful: true, progressionEnabled: false, weeksOverride: CYCLE_09K.meta.weeks });
    const ok = coachPLPeakPlan(plan);
    expect(ok.score).toBeGreaterThanOrEqual(0);
    expect(ok.score).toBeLessThanOrEqual(100);
  });

  it('B4: без базы прогноза (нет факта и прогноза ПМ) → unrealistic, а не ложный tight', () => {
    const f = pmFeasibility({ weeklyK: 0.005, weeksToMeet: 8, plannedPm: { 'Присед': 240 } });
    expect(f.status).toBe('unrealistic');
    expect(f.lifts[0].weeksNeeded).toBe(Number.POSITIVE_INFINITY);
    expect(f.summary).toContain('нет базы для прогноза');
  });

  it('B4: база есть, цель достижима → realistic', () => {
    const f = pmFeasibility({ weeklyK: 0.01, weeksToMeet: 8, forecastPm: { 'Присед': 220 }, plannedPm: { 'Присед': 230 } });
    // 220 × 1.01^8 ≈ 238 ≥ 230 → достижимо.
    expect(f.status).toBe('realistic');
    expect(f.lifts[0].feasible).toBe(true);
  });

  it('B5: нагрузка ровно 14 дней назад относится к prev (не recent)', () => {
    const day = (n: number, rpe: number, dur = 60) => {
      const d = new Date('2026-08-16T00:00:00');
      d.setDate(d.getDate() - n);
      return { date: d.toISOString().slice(0, 10), sRPE: rpe, durationMin: dur };
    };
    // recent = сегодня (лёгкая), prev = ровно 14 и 15 дней назад (тяжёлая).
    // Если бы -14 попал в recent, ratio ≈ 1.25 → delta 0. Ожидаем delta -1 (недогруз),
    // значит -14 корректно в prev.
    const sessions = [day(0, 2), day(14, 8), day(15, 8)];
    const adj = sRPEAdjustment(sessions);
    expect(adj.taperWeeksDelta).toBe(-1);
  });

  it('B5: нагрузка ровно 28 дней назад не входит ни в recent, ни в prev', () => {
    const day = (n: number, rpe: number, dur = 60) => {
      const d = new Date('2026-08-16T00:00:00');
      d.setDate(d.getDate() - n);
      return { date: d.toISOString().slice(0, 10), sRPE: rpe, durationMin: dur };
    };
    // recent = сегодня, prev = -14, -28 ровно → вне окон. recent == prev → ratio 1 → delta 0.
    const sessions = [day(0, 8), day(14, 8), day(28, 8)];
    const adj = sRPEAdjustment(sessions);
    expect(adj.taperWeeksDelta).toBe(0);
    expect(adj.note).toBeNull();
  });

  it('B6: три-вэй разброс вердиктов прикидов → nextStrategy balanced', () => {
    const attempts: MeetAttemptsInfo = {
      strategy: 'balanced',
      lifts: [
        { name: 'Присед', opener: 180, second: 190, third: 200, target: 200, warmup: [] },
        { name: 'Жим лежа', opener: 110, second: 115, third: 120, target: 120, warmup: [] },
        { name: 'Становая тяга', opener: 200, second: 210, third: 220, target: 220, warmup: [] },
      ],
    };
    const sessions = [
      { date: '2026-08-10', exercises: [{ name: 'Присед', sets: [{ weightKg: 205, reps: 1 }] }] },        // made third → conservative
      { date: '2026-08-10', exercises: [{ name: 'Жим лежа', sets: [{ weightKg: 115, reps: 1 }] }] },       // made second → optimal
      { date: '2026-08-10', exercises: [{ name: 'Становая тяга', sets: [{ weightKg: 190, reps: 1 }] }] },  // made none → aggressive
    ];
    const evalRes = evaluateMeetAttemptsFromDiary(attempts, sessions);
    expect(evalRes).not.toBeNull();
    expect(evalRes!.lifts.map(l => l.verdict).sort()).toEqual(['aggressive', 'conservative', 'optimal']);
    expect(evalRes!.nextStrategy).toBe('balanced');
  });
});

describe('ПЛ-авто: UI-путь buildSrc (faithful + авторегуляция + ACWR + слабые группы)', () => {
  // Воспроизводит реальный путь SRCBBScreen.buildSrc (faithful:true, progressionEnabled:true,
  // авторегуляция/ACWR/слабые группы/точки) и проверяет главное правило: исходный цикл
  // сохраняется (pct/reps/порядок), ассистенты — только сверху, авто-тапер выключен.
  it('исходные упражнения сохраняют pct/reps/порядок даже при активных autoReg + ACWR-danger', () => {
    const before = JSON.parse(JSON.stringify(CYCLE_09K));
    const plan = buildLMSPlan({
      template: CYCLE_09K, pmMap, fallbackPm: 80,
      faithful: true,
      progressionEnabled: true,
      weakPoints: ['chest', 'back'],
      plWeakPoints: [{ lift: 'bench', weakPoint: 'lockout' }],
      autoReg: { topSetPctMultiplier: 0.92, volumeMultiplier: 0.8, rirShift: 1, deload: true },
      acwr: { ratio: 1.6, zone: 'dangerous' },
    });
    // Шаблон не мутирован.
    expect(CYCLE_09K).toEqual(before);
    const layouts = CYCLE_09K.weeks && CYCLE_09K.weeks.length > 0 ? CYCLE_09K.weeks : [CYCLE_09K.week1];
    for (let wi = 0; wi < layouts.length; wi++) {
      const srcWeek = layouts[wi];
      const pWeek = plan.weeks[wi];
      for (let di = 0; di < srcWeek.length; di++) {
        const srcDay = srcWeek[di];
        const pDay = pWeek.days[di];
        // Слабые группы добавляются СВЕРХУ — source-упражнения в начале дня не тронуты.
        expect(pDay.exercises.length).toBeGreaterThanOrEqual(srcDay.exercises.length);
        for (let ei = 0; ei < srcDay.exercises.length; ei++) {
          const se = srcDay.exercises[ei];
          const pe = pDay.exercises[ei];
          expect(pe.name).toBe(se.name);
          expect(pe.workSets.length).toBe(se.sets.length);
          for (let si = 0; si < se.sets.length; si++) {
            // pct и reps — байт-в-байт, несмотря на autoReg/ACWR.
            expect(pe.workSets[si].pct).toBe(se.sets[si].pct);
            expect(pe.workSets[si].reps).toBe(se.sets[si].reps);
          }
        }
      }
    }
    // Ассистенты реально добавлены (всего упражнений больше).
    const totalPlan = plan.weeks.reduce((s, w) => s + w.days.reduce((ss, d) => ss + d.exercises.length, 0), 0);
    const totalSrc = layouts.reduce((s, w) => s + w.reduce((ss, d) => ss + d.exercises.length, 0), 0);
    expect(totalPlan).toBeGreaterThan(totalSrc);
    // Авто-тапер при faithful НЕ применяется (финальная неделя не помечена taperWeek).
    expect(plan.weeks.every(w => !w.taperWeek)).toBe(true);
  });

  it('appendPLTaperWeeks (UI-путь тапера) не меняет исходные недели плана', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, faithful: true, progressionEnabled: false, weeksOverride: CYCLE_01.meta.weeks });
    const base = JSON.parse(JSON.stringify(plan.weeks));
    const out = appendPLTaperWeeks(plan, 2, {
      reference: '2026-08-30',
      windowWeeks: 4,
      mockMeet: { strategy: 'balanced' },
      meetWeek: { strategy: 'balanced' },
      postMeet: { volumeMult: 0.5 },
      meetData: { actualPm: { 'Присед': 150 }, plannedPm: { 'Присед': 160 } },
    });
    // Исходные недели плана байт-в-байт (тапер добавлен, не переписан).
    expect(out.weeks.slice(0, plan.weeks.length)).toEqual(base);
    // Блок добавлен (ramp + taper + mock + meet + post), у финальной — прикиды.
    expect(out.weeks.length).toBeGreaterThan(plan.weeks.length);
    const tail = out.weeks.slice(plan.weeks.length);
    expect(tail.some(w => w.meetWeek)).toBe(true);
    expect(tail.some(w => w.postMeet)).toBe(true);
  });
});
