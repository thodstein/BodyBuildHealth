import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

/**
 * Аудит 2026-10 — ББ-авто: фаз-гейт DC и taper коротких планов.
 *
 * 1) DC Rest-Pause (DoggCrapp, `dc_rp`) — методика ИНТЕНСИФИКАЦИИ. План с
 *    intensification в хвосте выбирал схему по «репрезентативной» фазе и
 *    накладывал её на ВСЕ недели: accumulation W1–W3 получали DC-структуру.
 *    Теперь `applySchemeToPlan` уважает `scheme.phaseGate` (dc_rp →
 *    intensification, cluster → peaking). DC = «1 рабочий слот» (RP 7+4+3),
 *    покрывает ВСЕ primary дня (тяж и памп) — «4-й pamp-primary» больше не
 *    остаётся урезанным без метки.
 *
 * 2) Taper коротких планов (≤4 нед): окно [0..taperEnd) покрывало все рабочие
 *    недели — accumulation/intensification не оставалось. Теперь длина окна
 *    ≤ taperEnd−1 (≥1 рабочая неделя до taper), профиль берётся с конца
 *    (глубокая ×0.50 — всегда последняя неделя перед делодом).
 */

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

/** Проба из задачи: enhanced + AAS500/GH4/insulin10, upper_lower_6. */
function dcProbe(): any {
  return buildBBPlan({
    patternId: 'upper_lower_6', weeks: 8, level: 'enhanced', trainingYears: 9, goal: 'mass',
    workMax: WM, sex: 'male',
    peds: ['AAS', 'GH', 'insulin'], pedDoses: { AAS: 500, GH: 4, insulin: 10 }, courseIntensity: 'moderate',
  } as never);
}

const isDc = (e: any) => /DC Rest-Pause/i.test(String(e?.comment || ''));
const working = (w: any) => !(w.phase === 'deload' || w.deload === true);

describe('BB-auto: DC Rest-Pause — фаз-гейт (аудит 2026-10)', () => {
  it('accumulation: DC-1-сетов НЕТ (dc_rp гейтится intensification)', () => {
    const plan = dcProbe();
    const acc = plan.weeks.filter((w: any) => w.phase === 'accumulation');
    expect(acc.length).toBeGreaterThan(0);
    let prim = 0;
    for (const w of acc) for (const s of w.sessions) for (const e of s.exercises) {
      if (e.warmupActivator || e.role !== 'primary') continue;
      prim++;
      expect(isDc(e), `accumulation W${w.week}: ${e.name} не должен быть DC`).toBe(false);
    }
    expect(prim).toBeGreaterThan(0);
  });

  it('intensification: DC есть, КАЖДЫЙ primary помечен и сокращён до 1 сета', () => {
    const plan = dcProbe();
    const int = plan.weeks.filter((w: any) => w.phase === 'intensification');
    expect(int.length).toBeGreaterThan(0);
    let prim = 0, dc = 0;
    for (const w of int) for (const s of w.sessions) for (const e of s.exercises) {
      if (e.warmupActivator || e.role !== 'primary') continue;
      prim++;
      expect(isDc(e), `intensification W${w.week}: ${e.name} (${e.character}) без DC-метки`).toBe(true);
      // DC = «1 рабочий слот» (RP 7+4+3), не single-set-регресс-мусор.
      expect(e.sets, `W${w.week}: ${e.name} — DC держит 1 рабочий слот`).toBe(1);
      expect((e.workSets || []).length, `W${w.week}: ${e.name} sets vs workSets`).toBe(e.sets);
      dc++;
    }
    expect(prim).toBeGreaterThan(0);
    expect(dc).toBe(prim);
  });

  it('без PED (натурал) DC не появляется нигде', () => {
    const plan: any = buildBBPlan({
      patternId: 'upper_lower_6', weeks: 8, level: 'advanced', trainingYears: 5, goal: 'mass',
      workMax: WM, sex: 'male',
    } as never);
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if (e.warmupActivator) continue;
      expect(isDc(e), `натурал W${w.week}: ${e.name}`).toBe(false);
    }
  });

  it('выборка сплитов: DC только в intensification (нет утечки в accumulation/делод/тапер)', () => {
    const sample = ['ppl_6', 'fullbody_3', 'bro_5', 'upper_lower_4', 'arnold_6', 'phul_4'];
    for (const patternId of sample) {
      const plan: any = buildBBPlan({
        patternId, weeks: 8, level: 'enhanced', trainingYears: 9, goal: 'mass',
        workMax: WM, sex: 'male',
        peds: ['AAS', 'GH', 'insulin'], pedDoses: { AAS: 500, GH: 4, insulin: 10 }, courseIntensity: 'moderate',
      } as never);
      for (const w of plan.weeks) {
        const hasDc = w.sessions.some((s: any) => s.exercises.some((e: any) => isDc(e)));
        if (hasDc) {
          expect(w.phase, `${patternId} W${w.week}: DC вне intensification (phase=${w.phase})`).toBe('intensification');
        }
      }
    }
  });
});

describe('BB-auto: taper коротких планов (аудит 2026-10)', () => {
  it('fullbody_3 / 4 нед: taper НЕ покрывает весь план (≥1 рабочая неделя)', () => {
    const plan: any = buildBBPlan({
      patternId: 'fullbody_3', weeks: 4, level: 'intermediate', trainingYears: 3, goal: 'mass',
      workMax: WM, sex: 'male',
    } as never);
    const work = plan.weeks.filter(working);
    expect(work.length).toBeGreaterThanOrEqual(2);
    const tapered = work.filter((w: any) => w.taperApplied === true);
    expect(tapered.length, 'taper покрыл все рабочие недели').toBeLessThan(work.length);
    // Первая рабочая неделя — не taper (accumulation/intensification сохранена).
    expect(work[0].taperApplied === true, 'W1 не должна быть taper').toBe(false);
  });

  it('8-нед план: taper-окно прежнее (профиль с конца, последняя неделя ×0.50)', () => {
    const plan: any = buildBBPlan({
      patternId: 'fullbody_3', weeks: 8, level: 'intermediate', trainingYears: 3, goal: 'mass',
      workMax: WM, sex: 'male',
    } as never);
    const tapered = plan.weeks.filter((w: any) => w.taperApplied === true);
    // 8-нед с финальным делодом → 3 taper-недели (W5–W7) — как было.
    expect(tapered.length).toBe(3);
    // Глубокая неделя — последняя перед делодом (объём меньше предыдущей taper-недели).
    const setsOf = (w: any) => w.sessions.flatMap((s: any) => s.exercises).reduce((a: number, e: any) => a + (e.sets || 0), 0);
    const t = tapered.map((w: any) => setsOf(w));
    expect(t[t.length - 1]).toBeLessThan(t[t.length - 2]);
  });
});
