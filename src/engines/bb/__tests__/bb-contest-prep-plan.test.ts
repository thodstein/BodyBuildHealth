/**
 * bb-contest-prep-plan.test.ts — тесты единой версионированной модели contest prep
 * (Этапы 2-7): BBContestPrepPlan, фазы, перенос даты, расширение подготовки,
 * taper по новой философии (объём ↓ / интенсивность ↑ / RIR 2-4), безопасность,
 * питание по дням, test peak week, обратная совместимость.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildBBContestPrepPlan,
  computePrepPhaseRanges,
  shiftBBContestPrepShowDate,
  addPrepWeeks,
  replanBBContestPrep,
  prepPhaseForWeek,
  prepPhaseForDate,
  nutritionTargetsForPrepDate,
  prepToMealPlanInput,
  scoreTestPeakWeek,
  saveTestPeakWeekResult,
  latestTestPeakWeek,
  resolvePeakStrategy,
  applyContestPrepToBBPlan,
  applyTrainingTaperToBBPlan,
  extendBBPlanPreparation,
  serializeBBContestPrepPlan,
  deserializeBBContestPrepPlan,
  planFromStored,
  estimatePrepCalories,
  professionalReviewConditions,
  PREP_PHASE_LABELS,
  TEST_PEAK_WEEK_STORAGE_KEY,
  buildShowTimeline,
  configFromPlan,
  prepWeightAdvice,
  buildPostShowPlan,
  buildContestPrepPrintHtml,
  buildPeakWeek,
  recordPrepAdjustment,
  buildPrepIcs,
  buildPrepCoachJson,
  prepTrainingCompliance,
  type BBContestPrepConfig,
  type BBContestPrepPlan,
  type BBPlanWithPrep,
} from '../bb-contest-prep.engine';
import type { BBPlan } from '../bb-builder.engine';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { applyTaperToFinalWeeks } from '../bb-autocoach.engine';
import { finalizeBBPlan } from '../bb-finalize.engine';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function baseConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: addDaysIso(todayIso(), 90),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
    ...over,
  };
}

function makeExercise(sets = 4, weight = 60, rir = 2, muscle = 'chest'): any {
  return {
    muscle,
    name: muscle === 'chest' ? 'Жим лёжа' : muscle === 'back' ? 'Тяга в наклоне' : 'Жим стоя',
    role: 'primary',
    character: 'тяж',
    sets,
    repsRange: [8, 12] as [number, number],
    rir,
    workSets: Array.from({ length: sets }, () => ({ reps: 10, rir, weight })),
    comment: '',
  };
}

function makeWeek(week: number, sessionsCount = 4, sets = 4): any {
  return {
    week,
    phase: 'accumulation',
    deload: false,
    sessions: Array.from({ length: sessionsCount }, (_, i) => ({
      day: i + 1,
      weekOffset: week * 7 + i,
      character: 'тяж',
      exercises: [
        makeExercise(sets),
        makeExercise(sets, 40, 2, 'back'),
        makeExercise(sets, 20, 3, 'shoulders'),
      ],
    })),
  };
}

function makePlan(weeksCount = 12): BBPlan {
  return {
    pattern: {} as any,
    weeks: Array.from({ length: weeksCount }, (_, i) => makeWeek(i + 1, 4, 10)),
    rotationMuscleVolume: {},
    rationale: ['Тестовый план'],
  };
}

beforeEach(() => {
  try { localStorage.removeItem(TEST_PEAK_WEEK_STORAGE_KEY); } catch { /* ignore */ }
});

describe('BBContestPrepPlan — единая модель (Этап 2)', () => {
  it('строит план с версиями, статусом и разделением подготовка/тапер/пик/шоу', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 12, taperWeeks: 2 });
    expect(plan.id).toBeTruthy();
    expect(plan.version).toBeGreaterThanOrEqual(1);
    expect(plan.algorithmVersion).toBeGreaterThanOrEqual(1);
    expect(plan.status).toBe('active');
    expect(plan.createdAt).toBeTruthy();
    expect(plan.updatedAt).toBeTruthy();
    expect(plan.source).toBe('bb_auto');
    expect(plan.preparation.weeks).toBe(12);
    expect(plan.preparation.finalWeeks).toBe(2);
    expect(plan.taper.weeks).toBe(2);
    expect(plan.taper.enabled).toBe(true);
    expect(plan.peakWeek.enabled).toBe(true);
    expect(plan.phases.length).toBeGreaterThan(0);
  });

  it('фазы: подготовка → финальная → taper → peak week → show day → post-show', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 12, taperWeeks: 2 });
    const keys = plan.phases.map(p => p.key);
    expect(keys).toEqual(['preparation', 'final_preparation', 'taper', 'peak_week', 'show_day', 'post_show']);
    const prep = plan.phases[0];
    expect(prep.weekStart).toBe(1);
    expect(prep.weekEnd).toBe(10);
    const taper = plan.phases[2];
    expect(taper.weekStart).toBe(13);
    expect(taper.weekEnd).toBe(14);
    const peak = plan.phases[3];
    expect(peak.weekStart).toBe(15);
    expect(peak.weekEnd).toBe(15);
    // Пик-неделя привязана к дате шоу: последний день peak = showDate.
    expect(peak.dateEnd).toBe(plan.showDate);
  });

  it('генерация на 8/12/16/20 недель подготовки — целостные диапазоны', () => {
    for (const pw of [8, 12, 16, 20]) {
      const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: pw, taperWeeks: 2 });
      const prep = plan.phases.find(p => p.key === 'preparation')!;
      expect(prep.weekStart).toBe(1);
      const final = plan.phases.find(p => p.key === 'final_preparation')!;
      expect(final.weekEnd).toBe(pw);
      expect(prep.weekEnd).toBe(pw - 2);
      const taper = plan.phases.find(p => p.key === 'taper')!;
      expect(taper.weekStart).toBe(pw + 1);
      expect(taper.weekEnd).toBe(pw + 2);
      const peak = plan.phases.find(p => p.key === 'peak_week')!;
      expect(peak.weekStart).toBe(pw + 3);
      // Даты непрерывны: каждая следующая фаза начинается на следующий день после конца предыдущей.
      // (show_day — сам день шоу, лежит ВНУТРИ пик-недели: dateStart = dateEnd = peak.dateEnd.)
      let prevEnd = '';
      for (const p of plan.phases) {
        if (p.key === 'show_day') continue;
        if (prevEnd) expect(p.dateStart).toBe(addDaysIso(prevEnd, 1));
        prevEnd = p.dateEnd;
      }
    }
  });

  it('невалидный конфиг → throw с понятным сообщением', () => {
    expect(() => buildBBContestPrepPlan(baseConfig({ showDate: 'bad-date' }))).toThrow(/showDate|дата шоу/i);
  });

  it('сериализация round-trip сохраняет модель', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 12, taperWeeks: 3 });
    const back = deserializeBBContestPrepPlan(serializeBBContestPrepPlan(plan));
    expect(back).not.toBeNull();
    expect(back!.id).toBe(plan.id);
    expect(back!.preparation.weeks).toBe(12);
    expect(back!.taper.weeks).toBe(3);
    expect(back!.phases).toHaveLength(plan.phases.length);
  });

  it('deserialize отсеивает мусор', () => {
    expect(deserializeBBContestPrepPlan(null)).toBeNull();
    expect(deserializeBBContestPrepPlan('{')).toBeNull();
    expect(deserializeBBContestPrepPlan(JSON.stringify({ id: 'x' }))).toBeNull();
    expect(deserializeBBContestPrepPlan('"string"')).toBeNull();
  });
});

describe('Этап 3 — динамические недели и перенос даты', () => {
  it('addPrepWeeks меняет только подготовительный блок (пик привязан к шоу)', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 10, taperWeeks: 2 });
    const grown = addPrepWeeks(plan, 3);
    expect(grown.preparation.weeks).toBe(13);
    expect(grown.taper.weeks).toBe(2);
    const peak = grown.phases.find(p => p.key === 'peak_week')!;
    expect(peak.dateEnd).toBe(plan.showDate); // пик не сдвинулся
    expect(grown.preparation.startDate).toBe(addDaysIso(plan.preparation.startDate, -21));
  });

  it('addPrepWeeks не уходит ниже 1 недели', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 2, taperWeeks: 1 });
    const shrunk = addPrepWeeks(plan, -10);
    expect(shrunk.preparation.weeks).toBe(1);
  });

  it('перенос даты шоу пересчитывает фазы без дублирования taper', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ showDate: addDaysIso(todayIso(), 90) }), { prepWeeks: 10, taperWeeks: 2 });
    const newDate = addDaysIso(plan.showDate, 14);
    const { plan: moved, changedFrozen, warnings } = shiftBBContestPrepShowDate(plan, newDate);
    expect(moved.showDate).toBe(newDate);
    expect(changedFrozen).toBe(false);
    expect(warnings).toEqual([]);
    expect(moved.phases.filter(p => p.key === 'taper').length).toBe(1); // без дублей
    const peak = moved.phases.find(p => p.key === 'peak_week')!;
    expect(peak.dateEnd).toBe(newDate);
  });

  it('дата в прошлом → план не изменяется', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const past = addDaysIso(todayIso(), -30);
    const { plan: moved, warnings } = shiftBBContestPrepShowDate(plan, past);
    expect(moved.showDate).toBe(plan.showDate);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('завершённые недели (frozenWeeks) помечаются при переносе, меняющем фазы', () => {
    const plan: BBContestPrepPlan = {
      ...buildBBContestPrepPlan(baseConfig(), { prepWeeks: 10, taperWeeks: 2 }),
      frozenWeeks: 6,
    };
    const { changedFrozen } = shiftBBContestPrepShowDate(plan, addDaysIso(plan.showDate, 28));
    expect(changedFrozen).toBe(true);
  });

  it('prepPhaseForWeek / prepPhaseForDate отвечают корректно', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 6, taperWeeks: 2 });
    expect(prepPhaseForWeek(plan, 1)?.key).toBe('preparation');
    expect(prepPhaseForWeek(plan, 6)?.key).toBe('final_preparation');
    expect(prepPhaseForWeek(plan, 7)?.key).toBe('taper');
    expect(prepPhaseForWeek(plan, 9)?.key).toBe('peak_week');
    expect(prepPhaseForWeek(plan, 99)).toBeNull();
    const peak = plan.phases.find(p => p.key === 'peak_week')!;
    expect(prepPhaseForDate(plan, peak.dateStart)?.key).toBe('peak_week');
  });
});

describe('Этап 4 — taper: объём ↓, интенсивность сохраняется, RIR 2-4', () => {
  it('применение к плану размечает фазы недель и режет объём без обнуления интенсивности', () => {
    const plan = makePlan(12);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 9, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(out.weeks[11].contestPhase).toBe('peak_week');
    expect(out.weeks[10].contestPhase).toBe('taper');
    expect(out.weeks[9].contestPhase).toBe('taper');
    expect(out.weeks[8].contestPhase).toBe('final_preparation');
    expect(out.weeks[0].contestPhase).toBe('preparation');
    const taperWk = out.weeks[9];
    const baseWk = plan.weeks[9];
    for (let s = 0; s < taperWk.sessions.length; s++) {
      for (let e = 0; e < taperWk.sessions[s].exercises.length; e++) {
        const ex = taperWk.sessions[s].exercises[e];
        const orig = baseWk.sessions[s].exercises[e];
        expect(ex.sets).toBeLessThan(orig.sets);          // объём ↓
        expect(ex.workSets[0].weight).toBeGreaterThan(orig.workSets[0].weight * 0.8); // интенсивность сохраняется
        expect(ex.rir).toBeGreaterThanOrEqual(2);          // RIR 2-4, никакого авто-RIR 0
      }
    }
  });

  it('идентичен при повторном применении (идемпотентность)', () => {
    const plan = makePlan(12);
    const once = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 9, taperWeeks: 2 }) as BBPlanWithPrep;
    const twice = applyContestPrepToBBPlan(once, baseConfig(), { prepWeeks: 9, taperWeeks: 2 }) as BBPlanWithPrep;
    expect((twice.contestPrep?.appliedWeeks ?? []).length).toBe((once.contestPrep?.appliedWeeks ?? []).length);
    expect(twice.weeks[11].peakWeek).toBe(true);
  });

  it('план короче подготовки → НЕ достраивается (весь цикл не переделывается): warning + усечённая подготовка', () => {
    const plan = makePlan(6);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 12, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(out.weeks.length).toBe(6); // длина не изменилась
    const warnings = (out as any).contestPrep?.warnings ?? [];
    expect(warnings.some(w => w.includes('усечена'))).toBe(true);
  });

  it('taper НАКЛАДЫВАЕТСЯ ПОВЕРХ короткого плана: подготовка не тронута, пик на последней неделе', () => {
    const plan = makePlan(6);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 8, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(out.weeks.length).toBe(6);
    // Неделя 0 — подготовка, 1..2 — финальная, 3..4 — taper, 5 — пик.
    expect(out.weeks[0].contestPhase).toBe('preparation');
    expect(out.weeks[2].contestPhase).toBe('final_preparation');
    expect(out.weeks[3].contestPhase).toBe('taper');
    expect(out.weeks[4].contestPhase).toBe('taper');
    expect(out.weeks[5].contestPhase).toBe('peak_week');
    expect(out.weeks[5].peakWeek).toBe(true);
    // Объём подготовки не изменён.
    expect(out.weeks[0].sessions[0].exercises[0].sets).toBe(plan.weeks[0].sessions[0].exercises[0].sets);
    // Объём taper-зоны снижен.
    expect(out.weeks[4].sessions[0].exercises[0].sets).toBeLessThan(plan.weeks[4].sessions[0].exercises[0].sets);
    // Недели перенумерованы не были (никакого сдвига цикла).
    expect(out.weeks[out.weeks.length - 1].week).toBe(6);
  });

  it('финальная подготовка: объём ×0.9, RIR ≥ 2, интенсивность сохраняется', () => {
    const plan = makePlan(6);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 8, taperWeeks: 2 }) as BBPlanWithPrep;
    const finalWk = out.weeks[2]; // последняя неделя финальной подготовки (план не достраивается)
    const baseWk = plan.weeks[2];
    expect(finalWk.contestPhase).toBe('final_preparation');
    for (let s = 0; s < finalWk.sessions.length; s++) {
      for (let e = 0; e < finalWk.sessions[s].exercises.length; e++) {
        const ex = finalWk.sessions[s].exercises[e];
        const orig = baseWk.sessions[s].exercises[e];
        expect(ex.sets).toBeLessThanOrEqual(Math.round(orig.sets * 0.9) + 1); // ×0.9 (округление)
        expect(ex.sets).toBeGreaterThanOrEqual(2);
        expect(ex.rir).toBeGreaterThanOrEqual(2);
        expect(ex.workSets[0].weight).toBe(orig.workSets[0].weight); // вес сохраняется
      }
    }
  });

  it('подготовка: объём не изменён (100%)', () => {
    const plan = makePlan(6);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 8, taperWeeks: 2 }) as BBPlanWithPrep;
    const prepWk = out.weeks[0];
    const baseWk = plan.weeks[0];
    expect(prepWk.sessions[0].exercises[0].sets).toBe(baseWk.sessions[0].exercises[0].sets);
    expect(prepWk.sessions[0].exercises[0].rir).toBe(baseWk.sessions[0].exercises[0].rir);
  });

  it('стратегия пик-недели зависит от опыта: новичок → conservative, продвинутый с опытом пиков → moderate', () => {
    const beginner = buildBBContestPrepPlan(baseConfig({ experienceLevel: 'beginner', prepCount: 0 }));
    expect(beginner.peakWeek.strategy).toBe('conservative');
    const advanced = buildBBContestPrepPlan(baseConfig({ experienceLevel: 'advanced', prepCount: 3 }));
    expect(advanced.peakWeek.strategy).toBe('moderate');
    const intermediateFirst = buildBBContestPrepPlan(baseConfig({ experienceLevel: 'intermediate', prepCount: 0 }));
    expect(intermediateFirst.peakWeek.strategy).toBe('conservative');
  });

  it('РЕЖИМ ПОДГОТОВКИ: недели подготовки получают RIR 1–3 (не RIR 0), отказные техники убраны, веса сохранены', () => {
    const plan = makePlan(8);
    // Интенсификационные недели с RIR 0 и dropset-техникой на последнем сете.
    plan.weeks.forEach((w: any, wi: number) => {
      if (wi < 4) return;
      w.sessions.forEach((s: any) => s.exercises.forEach((e: any) => {
        e.rir = 0;
        if (e.workSets?.length) e.workSets[e.workSets.length - 1].technique = 'dropset';
      }));
    });
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 5, taperWeeks: 2 }) as BBPlanWithPrep;
    // План 8: prep 0..2 (3 недели), финальная 3..4, taper 5..6, пик 7.
    for (let wi = 0; wi < 3; wi++) {
      const w = out.weeks[wi];
      const ps = plan.weeks[wi] as any;
      for (let si = 0; si < w.sessions.length; si++) {
        const s = w.sessions[si];
        for (let ei = 0; ei < s.exercises.length; ei++) {
          const e = s.exercises[ei];
          expect(e.rir).toBeGreaterThanOrEqual(1);
          expect(e.rir).toBeLessThanOrEqual(3);
          for (const ws of e.workSets || []) expect((ws as any).technique).toBeUndefined();
          expect(e.workSets[0].weight).toBe(ps.sessions[si].exercises[ei].workSets[0].weight);
        }
      }
      expect(String(w.prepProtocol || '')).toMatch(/Подготовка/);
    }
  });

  it('РЕЖИМ ПОДГОТОВКИ поддерживающий: prepVolumeMult 0.85 режет объём от базы (без накопления при повторном force)', () => {
    const plan = makePlan(8);
    const out1 = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 5, taperWeeks: 2, prepVolumeMult: 0.85 }) as BBPlanWithPrep;
    const ex1 = out1.weeks[0].sessions[0].exercises[0];
    expect(ex1.sets).toBe(Math.max(2, Math.round(plan.weeks[0].sessions[0].exercises[0].sets * 0.85)));
    // Повторный force-пересбор: объём НЕ накапливается (от базы _baseSets).
    const out2 = applyContestPrepToBBPlan(out1, baseConfig(), { prepWeeks: 5, taperWeeks: 2, prepVolumeMult: 0.85, force: true }) as BBPlanWithPrep;
    expect(out2.weeks[0].sessions[0].exercises[0].sets).toBe(ex1.sets);
  });

  it('РЕЖИМ ПОДГОТОВКИ: deload-недели подготовки не трогаются', () => {
    const plan = makePlan(8);
    plan.weeks[1] = { ...plan.weeks[1], deload: true, phase: 'deload' } as any;
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 5, taperWeeks: 2 }) as BBPlanWithPrep;
    const deloadWk = out.weeks[1];
    expect(deloadWk.prepProtocol).toBeFalsy();
    expect(deloadWk.sessions[0].exercises[0].sets).toBe(plan.weeks[1].sessions[0].exercises[0].sets);
  });

  it('taper НЕ переделывает весь цикл: чистая подготовка идентична исходной (объём/веса/RIR/упражнения), меняются только финальная/taper/пик', () => {
    const plan = makePlan(12);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 9, taperWeeks: 2 }) as BBPlanWithPrep;
    // prep 0..6 (чистая), финальная 7..8 (×0.9 — ожидаемо), taper 9..10, пик 11.
    expect(out.weeks.length).toBe(12);
    for (let wi = 0; wi < 7; wi++) {
      const w = out.weeks[wi];
      const orig = plan.weeks[wi];
      expect(w.sessions.length).toBe(orig.sessions.length);
      for (let si = 0; si < w.sessions.length; si++) {
        expect(w.sessions[si].exercises.length).toBe(orig.sessions[si].exercises.length);
        for (let ei = 0; ei < w.sessions[si].exercises.length; ei++) {
          const ex = w.sessions[si].exercises[ei];
          const ox = orig.sessions[si].exercises[ei];
          expect(ex.name).toBe(ox.name);
          expect(ex.sets).toBe(ox.sets);
          expect(ex.rir).toBe(ox.rir);
          if (ex.workSets?.[0] && ox.workSets?.[0]) {
            expect(ex.workSets[0].weight).toBe(ox.workSets[0].weight);
            expect(ex.workSets[0].reps).toBe(ox.workSets[0].reps);
          }
        }
      }
    }
    // Финальная подготовка: объём ×0.9 (ожидаемое изменение).
    expect(out.weeks[7].sessions[0].exercises[0].sets).toBe(Math.max(2, Math.round(plan.weeks[7].sessions[0].exercises[0].sets * 0.9)));
    // Taper-зона действительно изменилась (объём меньше исходного).
    const taperWk = out.weeks[9];
    expect(taperWk.sessions[0].exercises[0].sets).toBeLessThan(plan.weeks[9].sessions[0].exercises[0].sets);
    // Пик-неделя.
    expect(out.weeks[11].peakWeek).toBe(true);
  });

  it('РЕАЛЬНЫЙ план: buildBBPlan + prep — чистая подготовка не тронута, меняются только финальная/taper/пик', () => {
    const makeInput = (over: Partial<BBBuilderInput> = {}): BBBuilderInput => ({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 12,
      workMax: { chest: 100, back: 120, shoulders: 70, quads: 140, hamstrings: 100, glutes: 150, biceps: 45, triceps: 50 },
      weakPoints: [],
      equipment: [],
      autoDeload: true,
      ...over,
    });
    const plan = buildBBPlan(makeInput());
    expect(plan.weeks.length).toBe(12);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 9, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(out.weeks.length).toBe(12);
    // Чистая подготовка 0..6: полная идентичность (без достройки план не сдвигается).
    for (let wi = 0; wi < 7; wi++) {
      const w = out.weeks[wi];
      const orig = plan.weeks[wi];
      expect(w.sessions.length).toBe(orig.sessions.length);
      for (let si = 0; si < w.sessions.length; si++) {
        expect(w.sessions[si].exercises.length).toBe(orig.sessions[si].exercises.length);
        for (let ei = 0; ei < w.sessions[si].exercises.length; ei++) {
          const ex = w.sessions[si].exercises[ei];
          const ox = orig.sessions[si].exercises[ei];
          expect(ex.name).toBe(ox.name);
          expect(ex.sets).toBe(ox.sets);
          expect(ex.workSets?.[0]?.weight).toBe(ox.workSets?.[0]?.weight);
        }
      }
    }
    // Разметка фаз корректна.
    expect(out.weeks[0].contestPhase).toBe('preparation');
    expect(out.weeks[6].contestPhase).toBe('preparation');
    expect(out.weeks[8].contestPhase).toBe('final_preparation');
    expect(out.weeks[9].contestPhase).toBe('taper');
    expect(out.weeks[10].contestPhase).toBe('taper');
    expect(out.weeks[11].contestPhase).toBe('peak_week');
  });

  it('повторное применение не расширяет план (идемпотентность длины)', () => {
    const plan = makePlan(6);
    const once = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 8, taperWeeks: 2 }) as BBPlanWithPrep;
    const twice = applyContestPrepToBBPlan(once, baseConfig(), { prepWeeks: 8, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(twice.weeks.length).toBe(once.weeks.length);
    expect(twice.weeks[twice.weeks.length - 1].peakWeek).toBe(true);
  });

  it('force=true пересобирает границы фаз БЕЗ накопления кривой (недели с нашим prepProtocol не режутся повторно)', () => {
    const plan = makePlan(10);
    const v2 = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 7, taperWeeks: 2 }) as BBPlanWithPrep;
    // Без force: те же настройки → наборы не меняются (недели пропущены).
    const same = applyContestPrepToBBPlan(v2, baseConfig(), { prepWeeks: 7, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(same.weeks[8].sessions[0].exercises[0].sets).toBe(v2.weeks[8].sessions[0].exercises[0].sets);
    // С force: taperWeeks 2→3 — неделя 7 (0-index) попадает в taper-окно и получает
    // канонический taper (была «Финальная подготовка»); неделя 8 (уже taper) НЕ накапливает.
    const v3 = applyContestPrepToBBPlan(v2, baseConfig(), { prepWeeks: 6, taperWeeks: 3, force: true }) as BBPlanWithPrep;
    expect(v3.weeks.length).toBe(v2.weeks.length);
    expect(v3.weeks[7].contestPhase).toBe('taper');
    expect(String(v3.weeks[7].prepProtocol || '')).toMatch(/— (Taper|Финал|Подводящая)/);
    expect(v3.weeks[7].sessions[0].exercises[0].rir).toBeGreaterThanOrEqual(2);
    // Неделя 8: была taper (0.85×10=9) — не умножена повторно (осталась 9, а не 0.7×9).
    expect(v3.weeks[8].sessions[0].exercises[0].sets).toBe(v2.weeks[8].sessions[0].exercises[0].sets);
    // Пик-неделя пересобрана и привязана к концу.
    expect(v3.weeks[v3.weeks.length - 1].peakWeek).toBe(true);
    expect(v3.weeks[v3.weeks.length - 1].contestPhase).toBe('peak_week');
  });

  it('пик-неделя остаётся привязанной к концу плана', () => {
    const plan = makePlan(4);
    const cfg = baseConfig();
    const out = applyContestPrepToBBPlan(plan, cfg, { prepWeeks: 6, taperWeeks: 3 }) as BBPlanWithPrep;
    expect(out.weeks.length).toBe(4); // без достройки
    const last = out.weeks[3];
    expect(last.contestPhase).toBe('peak_week');
    expect(last.peakWeek).toBe(true);
    const meta = (out as any).contestPrep as { phases?: Array<{ key: string; dateEnd: string }> };
    expect(meta?.phases?.find(p => p.key === 'peak_week')?.dateEnd).toBe(cfg.showDate);
  });

  it("авто-taper'нутые недели финализатора не режутся повторно и не помечаются как «разгрузка»", () => {
    // Имитация плана, где applyTaperToFinalWeeks уже порезал последние 2 недели
    // (объём 0.5/0.75, метка taper:true, БЕЗ deload-флага и prepProtocol).
    const plan = makePlan(8);
    const weeks = plan.weeks.map((w, i) => {
      if (i < 6) return w;
      return {
        ...w,
        taper: true,
        sessions: w.sessions.map(s => ({
          ...s,
          exercises: s.exercises.map((e: any) => ({ ...e, sets: Math.max(2, Math.round((e.sets || 10) * (i === 7 ? 0.5 : 0.75))), rir: Math.min(5, (e.rir ?? 2) + (i === 7 ? 2 : 1)) })),
        })),
      };
    });
    const setsBefore = (weeks[6] as any).sessions[0].exercises[0].sets;
    const out = applyTrainingTaperToBBPlan({ ...plan, weeks } as any, baseConfig({ weeksOut: 2 })) as BBPlanWithPrep;
    // Объём авто-taper'нутой недели 6 (не последняя) не изменился — не режем поверх уже порезанного.
    expect(out.weeks[6].sessions[0].exercises[0].sets).toBe(setsBefore);
    // Она НЕ помечается как «Пропущена (разгрузка)» — это не deload, а готовый taper.
    expect(out.weeks[6].prepProtocol).toBeFalsy();
    // Последняя неделя окна по-прежнему превращается в пик-неделю.
    expect(out.weeks[7].peakWeek).toBe(true);
  });

  it('applyTaperToFinalWeeks НЕ режет prep-размеченные планы (защита от двойного taper при повторной финализации)', () => {
    const plan = makePlan(10);
    const prepped = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 7, taperWeeks: 2 }) as BBPlanWithPrep;
    const setTotal = (p: any) => p.weeks.reduce((a: number, w: any) => a + w.sessions.reduce((b: number, s: any) => b + s.exercises.reduce((c: number, e: any) => c + (e.sets || 0), 0), 0), 0);
    const before = setTotal(prepped);
    const after = applyTaperToFinalWeeks(prepped as any, prepped.weeks.length);
    expect(setTotal(after)).toBe(before); // объём не изменился
    // Обычный план (без prep-разметки) по-прежнему taper'ится финализатором.
    const plain = makePlan(8);
    const plainAfter = applyTaperToFinalWeeks(plain, 8);
    expect(setTotal(plainAfter)).toBeLessThan(setTotal(plain));
  });

  it('finalizeBBPlan (revalidate) НЕ раздувает taper/пик-недели prep-плана (leg/feeders/back-аллокации пропущены)', () => {
    const plan = makePlan(12) as any;
    const prepped = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 9, taperWeeks: 2 }) as BBPlanWithPrep;
    const weekSets = (p: any, idx: number) => p.weeks[idx].sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
    const taperIdx = 9; // первая taper-неделя (0-index)
    const peakIdx = 11;
    const taperBefore = weekSets(prepped, taperIdx);
    const peakBefore = weekSets(prepped, peakIdx);
    const revalidated = finalizeBBPlan(prepped as any, {
      level: 'enhanced', trainingYears: 5, reorder: false, phaseSafety: true,
      methodology: 'compound_first', volumeGoal: 'mav' as any,
      equipment: [], excludedExercises: [], excludedMuscles: [], avoidAxialLoad: false,
    });
    // Объём taper/пик недель не вырос (guard), авто-taper не сработал.
    expect(weekSets(revalidated, taperIdx)).toBeLessThanOrEqual(taperBefore + 1);
    expect(weekSets(revalidated, peakIdx)).toBeLessThanOrEqual(peakBefore + 1);
    // Пик-неделя осталась пик-неделей.
    expect((revalidated.weeks[peakIdx] as any).peakWeek).toBe(true);
    expect((revalidated.weeks[peakIdx] as any).contestPhase).toBe('peak_week');
  });

  it('extendBBPlanPreparation вставляет недели только в подготовку (тапер не трогается)', () => {
    const plan = makePlan(10);
    const prepped = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 7, taperWeeks: 2 }) as BBPlanWithPrep;
    const extended = extendBBPlanPreparation(prepped, 2) as BBPlanWithPrep;
    expect(extended.weeks.length).toBe(12);
    const prepCount = extended.weeks.filter((w: any) => w.contestPhase === 'preparation').length;
    expect(prepCount).toBeGreaterThanOrEqual(7);
    const taperIdx = extended.weeks.length - 3; // taper начинается за 2 недели до конца
    expect(extended.weeks[taperIdx].contestPhase).toBe('taper');
    expect(extended.weeks[extended.weeks.length - 1].contestPhase).toBe('peak_week');
    // Недели перенумерованы
    expect(extended.weeks[extended.weeks.length - 1].week).toBe(12);
  });

  it('extendBBPlanPreparation работает на плане короче подготовки (минимум: taper+пик)', () => {
    const plan = makePlan(3);
    const prepped = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 5, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(prepped.weeks.length).toBe(3); // план не достраивается автоматически
    const extended = extendBBPlanPreparation(prepped, 3) as BBPlanWithPrep;
    expect(extended.weeks.length).toBe(6); // +3 по явному расширению
    expect(extended.weeks[extended.weeks.length - 1].contestPhase).toBe('peak_week');
    for (let i = 1; i <= extended.weeks.length; i++) {
      expect(extended.weeks[i - 1].week).toBe(i);
    }
  });

  it('applyContestPrepToBBPlan на минимальном плане (taper+пик) не падает', () => {
    const plan = makePlan(3);
    const out = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 1, taperWeeks: 2 }) as BBPlanWithPrep;
    expect(out.weeks.length).toBe(3); // без достройки
    expect(out.weeks[2].contestPhase).toBe('peak_week');
    expect(out.weeks[0].contestPhase).toBe('taper');
    expect(out.weeks[1].contestPhase).toBe('taper');
  });
});

describe('Этап 5 — питание по дням (план vs факт)', () => {
  const base = { kcal: 2400, proteinG: 160, fatG: 60, carbsG: 260, waterMl: 3000, sodiumMg: 2800 };

  it('в подготовке: дефицит-калории, стабильные вода/натрий, белок ≥ 2 г/кг', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2 });
    const t = nutritionTargetsForPrepDate(plan.phases[0].dateStart, plan, base);
    expect(t.phase).toBeNull();
    expect(t.waterMl).toBe(3000);
    expect(t.sodiumMg).toBe(2800);
    expect(t.proteinG).toBeGreaterThanOrEqual(160);
    expect(t.kcal).toBeLessThan(plan.preparation.currentCalories + 1);
    expect(t.carbsG).toBeGreaterThan(0);
  });

  it('в пик-неделе: абсолютные цели дня (фаза, карб-загрузка)', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const peakStart = plan.phases.find(p => p.key === 'peak_week')!.dateStart;
    const t = nutritionTargetsForPrepDate(peakStart, plan, base);
    expect(t.phase).toBe('deplete_1');
    expect(t.kcal).toBeGreaterThan(0);
  });

  it('вне окна подготовки: база без изменений', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const far = addDaysIso(plan.showDate, 60);
    const t = nutritionTargetsForPrepDate(far, plan, base);
    expect(t.kcal).toBe(base.kcal);
    expect(t.carbsG).toBe(base.carbsG);
    expect(t.note).toBe('');
  });

  it('после шоу (post_show): поддержание, не дефицит подготовки', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const postDay = addDaysIso(plan.showDate, 3);
    const t = nutritionTargetsForPrepDate(postDay, plan, base);
    expect(t.phaseLabel).toBe('Post-show');
    expect(t.kcal).toBeGreaterThan(plan.preparation.currentCalories);
    expect(t.note).toMatch(/Post-show|поддерживающем/i);
  });

  it('prepToMealPlanInput → целевые макросы генератора меню', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const t = nutritionTargetsForPrepDate(plan.phases[0].dateStart, plan, base);
    const input = prepToMealPlanInput(t, { days: 3, excludePork: true });
    expect(input.targetKcal).toBe(t.kcal);
    expect(input.targetProtein).toBe(t.proteinG);
    expect(input.targetFat).toBe(t.fatG);
    expect(input.targetCarbs).toBe(t.carbsG);
    expect(input.days).toBe(3);
    expect(input.preferences.excludePork).toBe(true);
  });

  it('в taper-фазе калории стабильны (не меньше подготовки), вода/натрий не трогаются', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const prepDay = nutritionTargetsForPrepDate(plan.phases[0].dateStart, plan, base);
    const taperDay = nutritionTargetsForPrepDate(plan.phases.find(p => p.key === 'taper')!.dateStart, plan, base);
    expect(taperDay.kcal).toBeGreaterThanOrEqual(prepDay.kcal);
    expect(taperDay.waterMl).toBe(base.waterMl);
    expect(taperDay.sodiumMg).toBe(base.sodiumMg);
    expect(taperDay.proteinG).toBeGreaterThanOrEqual(prepDay.proteinG * 0.95);
  });
});

describe('Этап 6 — безопасность', () => {
  it('стабильные вода/натрий по умолчанию', () => {
    const plan = buildBBContestPrepPlan(baseConfig());
    expect(plan.peakWeek.waterMode).toBe('stable');
    expect(plan.peakWeek.sodiumMode).toBe('stable');
  });

  it('умеренная модуляция без подтверждения → стабильная (warning)', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ waterStrategy: 'moderate', sodiumStrategy: 'cut_2d' }));
    expect(plan.peakWeek.waterMode).toBe('stable');
    expect(plan.peakWeek.sodiumMode).toBe('stable');
    expect(plan.safety.warnings.some(w => w.includes('подтверждения'))).toBe(true);
  });

  it('подтверждение разрешает умеренную модуляцию', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ waterStrategy: 'moderate', sodiumStrategy: 'cut_2d', confirmedManipulation: true }));
    expect(plan.peakWeek.waterMode).toBe('moderate');
    expect(plan.peakWeek.sodiumMode).toBe('moderate');
  });

  it('противопоказания → requiresReview; +агрессивные моды → blockedProtocol', () => {
    const review = buildBBContestPrepPlan(baseConfig({ contraindications: ['kidney', 'hypertension'] }));
    expect(review.safety.requiresReview).toBe(true);
    expect(review.safety.blockedProtocol).toBe(false);
    expect(professionalReviewConditions(['kidney'])).toEqual(['заболевания почек']);

    // diabetes НЕ входит в KNOWN_CONTRAINDICATIONS validate (не форсится), но требует review —
    // при запрошенной модуляции воды протокол блокируется.
    const blocked = buildBBContestPrepPlan(baseConfig({ contraindications: ['diabetes'], waterStrategy: 'moderate' }));
    expect(blocked.safety.requiresReview).toBe(true);
    expect(blocked.safety.blockedProtocol).toBe(true);
    expect(blocked.peakWeek.waterMode).toBe('stable');
    expect(blocked.safety.warnings.some(w => w.includes('ограничен'))).toBe(true);

    // kidney форсится самим validate (minimal/constant) — протокол и так безопасен.
    const forcedSafe = buildBBContestPrepPlan(baseConfig({ contraindications: ['kidney'], waterStrategy: 'moderate', sodiumStrategy: 'cut_3d' }));
    expect(forcedSafe.safety.blockedProtocol).toBe(false);
    expect(forcedSafe.peakWeek.waterMode).toBe('stable');
    expect(forcedSafe.peakWeek.sodiumMode).toBe('stable');
  });

  it('жиры не обнуляются: безопасный минимум по полу', () => {
    const male = buildBBContestPrepPlan(baseConfig());
    const female = buildBBContestPrepPlan(baseConfig({ sex: 'female', category: 'bikini' }));
    const baseFor = (p: BBContestPrepPlan) => ({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, waterMl: 3000, sodiumMg: 2800 });
    const tMale = nutritionTargetsForPrepDate(male.phases[0].dateStart, male, baseFor(male));
    const tFemale = nutritionTargetsForPrepDate(female.phases[0].dateStart, female, baseFor(female));
    expect(tMale.fatG).toBeGreaterThanOrEqual(Math.round(80 * 0.6));
    expect(tFemale.fatG).toBeGreaterThanOrEqual(Math.round(80 * 0.8));
  });
});

describe('Этап 7 — Test Peak Week', () => {
  it('scoreTestPeakWeek: стабильный прогон → tested_ok, залив → adjust', () => {
    const ok = scoreTestPeakWeek({ carbTolerance: 4, digestion: 4, fullness: 4, waterRetention: 4, pump: 4, sleep: 4 }, 0.5);
    expect(ok.verdict).toBe('tested_ok');
    const bad = scoreTestPeakWeek({ carbTolerance: 2, digestion: 2, fullness: 2, waterRetention: 1, pump: 2, sleep: 2 }, 3);
    expect(bad.verdict).toBe('adjust');
  });

  it('saveTestPeakWeekResult сохраняет и отдаёт последний тест', () => {
    const planId = 'bbprep_test1';
    saveTestPeakWeekResult(planId, todayIso(), { carbTolerance: 4, digestion: 4, fullness: 4, waterRetention: 4, pump: 4, sleep: 4 }, 0.5);
    const latest = latestTestPeakWeek(planId);
    expect(latest).not.toBeNull();
    expect(latest!.verdict).toBe('tested_ok');
    expect(latest!.id).toBeTruthy();
  });

  it('resolvePeakStrategy: tested_ok → tested, adjust → conservative', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    saveTestPeakWeekResult(plan.id, plan.showDate, { carbTolerance: 4, digestion: 4, fullness: 4, waterRetention: 4, pump: 4, sleep: 4 }, 0.5);
    expect(resolvePeakStrategy({ ...plan, testPeakWeekId: 'x' })).toBe('tested');
    saveTestPeakWeekResult(plan.id, plan.showDate, { carbTolerance: 1, digestion: 1, fullness: 1, waterRetention: 1, pump: 1, sleep: 1 }, 4);
    expect(resolvePeakStrategy({ ...plan, testPeakWeekId: 'x' })).toBe('conservative');
    expect(resolvePeakStrategy(plan)).toBe(plan.peakWeek.strategy);
  });

  it('resolvePeakStrategy: testPeakWeekId задан, но тест не найден → консервативный дефолт', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const withId = { ...plan, testPeakWeekId: 'missing-test' };
    expect(resolvePeakStrategy(withId)).toBe('conservative');
  });

  it('addPrepWeeks сохраняет статус/тест/frozenWeeks и пересчитывает updatedAt', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const grown = addPrepWeeks({ ...plan, status: 'draft' as const, testPeakWeekId: 't1', frozenWeeks: 4 }, 2);
    expect(grown.status).toBe('draft');
    expect(grown.testPeakWeekId).toBe('t1');
    expect(grown.frozenWeeks).toBe(4);
    expect(grown.updatedAt >= plan.updatedAt).toBe(true);
  });
});

describe('Обратная совместимость и вспомогательные функции', () => {
  it('planFromStored: новый план → legacy конфиг → legacy поля профиля', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 10, taperWeeks: 2 });
    const fromPlan = planFromStored(serializeBBContestPrepPlan(plan), null);
    expect(fromPlan?.id).toBe(plan.id);

    const cfg = baseConfig({ showDate: addDaysIso(todayIso(), 45), weeksOut: 3 });
    const fromCfg = planFromStored(null, JSON.stringify(cfg), null, { weight: 80, sex: 'male' });
    expect(fromCfg?.showDate).toBe(cfg.showDate);
    expect(fromCfg!.taper.weeks).toBe(3);

    const fromLegacy = planFromStored(null, null, { peakWeek: true, peakShowDay: addDaysIso(todayIso(), 30), bbCategory: 'bikini' }, { weight: 55, sex: 'female' });
    expect(fromLegacy).not.toBeNull();
    expect(fromLegacy!.category).toBe('bikini');
    expect(fromLegacy!.peakWeek.waterMode).toBe('stable');
    expect(fromLegacy!.peakWeek.sodiumMode).toBe('stable');
  });

  it('planFromStored: новый план имеет приоритет над legacy конфигом', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ showDate: addDaysIso(todayIso(), 60) }), { prepWeeks: 12, taperWeeks: 3 });
    const oldCfg = baseConfig({ showDate: addDaysIso(todayIso(), 45), weeksOut: 2 });
    const result = planFromStored(
      serializeBBContestPrepPlan(plan),
      JSON.stringify(oldCfg),
      { peakWeek: true, peakShowDay: addDaysIso(todayIso(), 30) },
      { weight: 80, sex: 'male' },
    );
    expect(result?.id).toBe(plan.id);
    expect(result?.showDate).toBe(plan.showDate);
    expect(result!.taper.weeks).toBe(3);
  });

  it('estimatePrepCalories учитывает темп снижения', () => {
    const slow = estimatePrepCalories(80, 0.25);
    const fast = estimatePrepCalories(80, 0.75);
    expect(slow).toBeGreaterThan(fast);
    expect(slow).toBeGreaterThan(1200);
  });

  it('PREP_PHASE_LABELS покрывает все фазы', () => {
    for (const key of ['preparation', 'final_preparation', 'taper', 'peak_week', 'show_day', 'post_show']) {
      expect(PREP_PHASE_LABELS[key as keyof typeof PREP_PHASE_LABELS]).toBeTruthy();
    }
  });

  it('computePrepPhaseRanges: без пика — нет peak/show фаз', () => {
    const ranges = computePrepPhaseRanges(8, 2, addDaysIso(todayIso(), 60), false);
    expect(ranges.some(p => p.key === 'peak_week')).toBe(false);
    expect(ranges.some(p => p.key === 'show_day')).toBe(false);
    expect(ranges.some(p => p.key === 'taper')).toBe(true);
  });

  it('buildShowTimeline(configFromPlan) — таймлайн дня шоу из единого плана', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const timeline = buildShowTimeline(configFromPlan(plan));
    expect(timeline.length).toBeGreaterThanOrEqual(6);
    expect(timeline[0].action).toMatch(/Подъём|завтрак|подъё/i);
    expect(timeline[timeline.length - 1].action).toMatch(/Выход/);
    // Времена убывают к выходу на сцену (12:00 по умолчанию) — последний шаг раньше старта.
    expect(timeline[timeline.length - 1].time <= '12:00').toBe(true);
  });
});

describe('Этап 3.2-3.3 — ступенчатая адаптация подготовки по весу', () => {
  const w = (startIso: string, weights: number[]): Array<{ date: string; weight: number }> =>
    weights.map((weight, i) => ({ date: addDaysIso(startIso, i * 1), weight }));

  function makePlanNear(refIso: string): BBContestPrepPlan {
    const showDate = addDaysIso(refIso, 60);
    return buildBBContestPrepPlan(baseConfig({ showDate, weightKg: 80 }), { prepWeeks: 6, taperWeeks: 2 });
  }

  it('нет данных → no_data с подсказкой записывать вес', () => {
    const plan = makePlanNear(todayIso());
    const advice = prepWeightAdvice([], plan);
    expect(advice.status).toBe('no_data');
    expect(advice.lastWeight).toBeNull();
    expect(advice.recommendation).toMatch(/записывайте вес/i);
    expect(advice.adjustCalories).toBe(0);
  });

  it('недостаточно замеров (1 запись) → no_data', () => {
    const plan = makePlanNear(todayIso());
    const advice = prepWeightAdvice(w(todayIso(), [80]), plan);
    expect(advice.status).toBe('no_data');
    expect(advice.measurements).toBe(1);
  });

  it('темп в цели (0.5%/нед) → on_track, коррекции нет', () => {
    const plan = makePlanNear(todayIso());
    const ref = todayIso();
    // 0.5 кг/нед при 80 кг = 0.625%/нед — в диапазоне.
    const log = [
      ...w(addDaysIso(ref, -13), [80.5, 80.4, 80.3]),
      ...w(addDaysIso(ref, -6), [80.0, 80.1, 79.9, 80.0]),
    ];
    const advice = prepWeightAdvice(log, plan, { referenceDate: ref });
    expect(advice.status).toBe('on_track');
    expect(advice.delta7d).toBeLessThan(0);
    expect(advice.adjustCalories).toBe(0);
    expect(advice.adjustCardioMin).toBe(0);
  });

  it('плато 2+ недели → too_slow, калории −175 ИЛИ кардио +20 (не вместе)', () => {
    const plan = makePlanNear(todayIso());
    const ref = todayIso();
    const log = [
      ...w(addDaysIso(ref, -13), [80, 80.1, 80]),
      ...w(addDaysIso(ref, -6), [80, 79.9, 80, 80.1]),
    ];
    const advice = prepWeightAdvice(log, plan, { referenceDate: ref });
    expect(advice.status).toBe('too_slow');
    expect(advice.adjustCalories).toBe(-175);
    expect(advice.adjustCardioMin).toBe(20);
    expect(advice.recommendation).toMatch(/одну переменную|ОДНУ переменную/i);
  });

  it('слишком быстрый темп (>1.3× цели) → too_fast, +150 ккал ИЛИ −20 мин кардио', () => {
    const plan = makePlanNear(todayIso());
    const ref = todayIso();
    // 1.5 кг/нед при 80 кг ≈ 1.9%/нед — много быстрее 0.5%.
    const log = [
      ...w(addDaysIso(ref, -13), [83, 83, 82.9]),
      ...w(addDaysIso(ref, -6), [81.5, 81.4, 81.3, 81.4]),
    ];
    const advice = prepWeightAdvice(log, plan, { referenceDate: ref });
    expect(advice.status).toBe('too_fast');
    expect(advice.adjustCalories).toBe(150);
    expect(advice.adjustCardioMin).toBe(-20);
  });

  it('в taper-фазе — статус taper, коррекции нулевые', () => {
    const plan = makePlanNear(todayIso());
    const taperStart = plan.phases.find(p => p.key === 'taper')!.dateStart;
    const log = [
      ...w(addDaysIso(taperStart, -13), [80, 80, 80]),
      ...w(addDaysIso(taperStart, -6), [80, 80, 80]),
    ];
    const advice = prepWeightAdvice(log, plan, { referenceDate: taperStart });
    expect(advice.status).toBe('taper');
    expect(advice.adjustCalories).toBe(0);
    expect(advice.adjustCardioMin).toBe(0);
    expect(advice.phase).toBe('taper');
  });

  it('прогресс к целевому весу считается от старта подготовки', () => {
    const plan = makePlanNear(todayIso());
    const ref = todayIso();
    const log = [
      ...w(addDaysIso(ref, -13), [82, 81.9, 82]),
      ...w(addDaysIso(ref, -6), [80.5, 80.6, 80.4]),
    ];
    const advice = prepWeightAdvice(log, plan, { referenceDate: ref, targetWeightKg: 76 });
    // старт 80 → цель 76 (4 кг); сейчас ~80.5 → прогресс ≈ 0%
    expect(advice.progressToTargetPct).not.toBeNull();
    expect(advice.progressToTargetPct!).toBeGreaterThanOrEqual(0);
  });

  it('устойчив к любому порядку лога и мусору', () => {
    const plan = makePlanNear(todayIso());
    const ref = todayIso();
    const log = [
      { date: addDaysIso(ref, -3), weight: 80 },
      { date: 'bad-date', weight: 70 },
      { date: addDaysIso(ref, -8), weight: 80.5 },
      { date: addDaysIso(ref, -13), weight: 80.6 },
      { date: addDaysIso(ref, -2), weight: 80.1 },
    ];
    const advice = prepWeightAdvice(log, plan, { referenceDate: ref });
    expect(advice.status).not.toBe('no_data');
    expect(advice.measurements).toBeGreaterThanOrEqual(3);
  });
});

describe('Post-show — контроль восстановления после шоу', () => {
  it('строит поддерживающий план: калории выше дефицита, белок ~2 г/кг, стабильные вода/натрий', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2 });
    const post = buildPostShowPlan(plan);
    expect(post.durationDays).toBe(7);
    expect(post.kcal).toBeGreaterThan(plan.preparation.currentCalories);
    expect(post.proteinG).toBeGreaterThanOrEqual(Math.round(80 * 2.0) - 1);
    expect(post.waterLiters).toBeGreaterThanOrEqual(2.5);
    expect(post.notes.some(n => n.includes('стабильны'))).toBe(true);
    expect(post.training.some(t => t.includes('full-body'))).toBe(true);
    expect(post.weightCheck).toMatch(/\+1–2 кг/);
  });

  it('учитывает referenceCalories для поддержания', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const post = buildPostShowPlan(plan, { referenceCalories: 3000 });
    expect(post.kcal).toBe(3300);
  });

  it('не содержит агрессивных манипуляций (вода/натрий не режутся)', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const post = buildPostShowPlan(plan);
    const text = [...post.notes, ...post.training, post.weightCheck].join(' ').toLowerCase();
    expect(text).not.toMatch(/диуретик|0\.5 ?л|0\.25 ?л/);
  });
});

describe('Женская подготовка — грамотность питания', () => {
  const base = { kcal: 2000, proteinG: 130, fatG: 55, carbsG: 240, waterMl: 3000, sodiumMg: 2800 };

  it('калорийный пол 1400 ккал (RED-S), жиры ≥ 0.8 г/кг, женские примечания в подготовке', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ sex: 'female', category: 'bikini', weightKg: 55 }), { prepWeeks: 8, taperWeeks: 2 });
    // Дефолтный женский темп осторожнее.
    expect(plan.preparation.targetRatePctPerWeek).toBe(0.4);
    const t = nutritionTargetsForPrepDate(plan.phases[0].dateStart, plan, base);
    expect(t.kcal).toBeGreaterThanOrEqual(1400);
    expect(t.fatG).toBeGreaterThanOrEqual(Math.round(55 * 0.8));
    expect(t.note).toMatch(/RED-S|энергетической доступности/i);
    expect(t.note).toMatch(/Железо/i);
    expect(t.note).toMatch(/Кальций/i);
    expect(t.note).toMatch(/лютеиновую/i);
  });

  it('пик-неделя женщины: натрий ≥ 800 мг, вода в день шоу ≥ 0.5 л, женские mealNotes (железо/кальций/цикл)', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ sex: 'female', category: 'bikini', weightKg: 55 }), { prepWeeks: 8, taperWeeks: 2 });
    const peak = buildPeakWeek(configFromPlan(plan));
    expect(peak.length).toBe(7);
    for (const d of peak) expect(d.sodiumMg).toBeGreaterThanOrEqual(800);
    expect(peak[6].waterLiters).toBeGreaterThanOrEqual(0.5);
    const allNotes = peak.flatMap(d => d.mealNotes).join(' ');
    expect(allNotes).toMatch(/железо/i);
    expect(allNotes).toMatch(/кальций/i);
    expect(allNotes).toMatch(/лютеиновую/i);
    // Карб-загрузка женской лёгкой категории ниже мужской тяжёлой.
    const male = buildBBContestPrepPlan(baseConfig({ sex: 'male', category: 'mens_bb', weightKg: 90 }), { prepWeeks: 8, taperWeeks: 2 });
    const malePeak = buildPeakWeek(configFromPlan(male));
    const femaleLoad = peak.find(d => d.phase.startsWith('load'))!;
    const maleLoad = malePeak.find(d => d.phase.startsWith('load'))!;
    expect(femaleLoad.carbsG).toBeLessThan(maleLoad.carbsG);
  });

  it('мужская подготовка: калорийный пол 1200, жиры ≥ 0.6 г/кг, без женских нот', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ sex: 'male', category: 'mens_physique', weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2 });
    expect(plan.preparation.targetRatePctPerWeek).toBe(0.5);
    const t = nutritionTargetsForPrepDate(plan.phases[0].dateStart, plan, { ...base, kcal: 1100 });
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
    expect(t.fatG).toBeGreaterThanOrEqual(Math.round(80 * 0.6));
    expect(t.note).not.toMatch(/лютеиновую/i);
  });

  it('адаптация по весу: женская too_fast-рекомендация учитывает фазу цикла', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ sex: 'female', category: 'bikini', weightKg: 55, showDate: addDaysIso(todayIso(), 60) }), { prepWeeks: 6, taperWeeks: 2 });
    const ref = todayIso();
    const wl = (startIso: string, weights: number[]): Array<{ date: string; weight: number }> =>
      weights.map((weight, i) => ({ date: addDaysIso(startIso, i * 1), weight }));
    const log = [
      ...wl(addDaysIso(ref, -13), [58, 58, 57.9]),
      ...wl(addDaysIso(ref, -6), [56.5, 56.4, 56.3]),
    ];
    const advice = prepWeightAdvice(log, plan, { referenceDate: ref });
    expect(advice.status).toBe('too_fast');
    expect(advice.recommendation).toMatch(/цикла/i);
  });
});

describe('Печать сводки contest prep (buildContestPrepPrintHtml)', () => {  it('содержит фазы, taper-кривую, пик-неделю, таймлайн, post-show и предупреждения', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ contraindications: ['diabetes'] }), { prepWeeks: 8, taperWeeks: 2 });
    const html = buildContestPrepPrintHtml(plan);
    expect(html).toMatch(/<!DOCTYPE html>/);
    expect(html).toContain('Подготовка');
    expect(html).toContain('Кривая taper');
    expect(html).toContain('Пик-неделя');
    expect(html).toContain('Таймлайн Show Day');
    expect(html).toContain('Post-show');
    expect(html).toContain('Требуется профессиональное сопровождение');
    expect(html).toContain(plan.showDate);
  });

  it('XSS-безопасен: пользовательские строки экранируются', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ contraindications: ['kidney', '<script>alert(1)</script>'] }), { prepWeeks: 8, taperWeeks: 2 });
    const html = buildContestPrepPrintHtml(plan);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('с compliance: секция «Выполнение тренировок» с планом/фактом/итогом', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const compliance = prepTrainingCompliance(
      plan,
      Array.from({ length: 11 }, (_, i) => ({ week: i + 1, plannedSets: 20 })),
      [],
    );
    const html = buildContestPrepPrintHtml(plan, { compliance });
    expect(html).toContain('Выполнение тренировок');
    expect(html).toContain('Итого: 0% от плана');
    expect(html).toContain('upcoming');
  });
});

describe('E2E-путь пользователя: buildBBPlan → prep → режим → revalidate (ручная коррекция)', () => {
  const makeInput = (over: Partial<BBBuilderInput> = {}): BBBuilderInput => ({
    patternId: 'upper_lower_4',
    level: 'intermediate',
    goal: 'mass',
    weeks: 12,
    workMax: { chest: 100, back: 120, shoulders: 70, quads: 140, hamstrings: 100, glutes: 150, biceps: 45, triceps: 50 },
    weakPoints: [],
    equipment: [],
    autoDeload: true,
    ...over,
  });

  it('полный путь: сборка → prep (режим 1.0) → финализация после правок → подготовка не тронута, taper цел', () => {
    const plan = buildBBPlan(makeInput());
    const prepped = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 9, taperWeeks: 2, prepVolumeMult: 1.0 }) as BBPlanWithPrep;
    // Диагностика: prep не должен менять состав подготовки.
    expect(prepped.weeks[0].sessions[0].exercises[0].name, `prep: plan=${plan.weeks[0].sessions[0].exercises[0].name} vs prepped=${prepped.weeks[0].sessions[0].exercises[0].name}`).toBe(plan.weeks[0].sessions[0].exercises[0].name);
    // Имитация ручной коррекции: revalidate (finalizeBBPlan, как в «Коррекции»).
    const revalidated = finalizeBBPlan(prepped as any, {
      level: 'intermediate', trainingYears: 3, reorder: false, phaseSafety: true,
      methodology: 'compound_first', volumeGoal: 'mav' as any,
      equipment: [], excludedExercises: [], excludedMuscles: [], avoidAxialLoad: false,
    }) as BBPlanWithPrep;
    // Подготовка (0..6) побайтово идентична исходному плану (объём 100%, RIR 1–3 режим).
    for (let wi = 0; wi < 7; wi++) {
      const a = revalidated.weeks[wi];
      const b = plan.weeks[wi];
      expect(a.sessions.length).toBe(b.sessions.length);
      for (let si = 0; si < a.sessions.length; si++) {
        expect(a.sessions[si].exercises.length).toBe(b.sessions[si].exercises.length);
        for (let ei = 0; ei < a.sessions[si].exercises.length; ei++) {
          expect(a.sessions[si].exercises[ei].name, `week ${wi} si ${si} ei ${ei}: plan=${b.sessions[si].exercises[ei]?.name} vs reval=${a.sessions[si].exercises[ei]?.name} (phase=${a.phase}, contestPhase=${a.contestPhase})`).toBe(b.sessions[si].exercises[ei].name);
          expect(a.sessions[si].exercises[ei].sets).toBe(b.sessions[si].exercises[ei].sets);
          expect(a.sessions[si].exercises[ei].workSets?.[0]?.weight).toBe(b.sessions[si].exercises[ei].workSets?.[0]?.weight);
        }
      }
    }
    // Taper-зона цела после revalidate: недели 9..10 — taper (наши или авто-taper
    // финализатора, оба по Bosquet: объём ≤ исходного, RIR ≥ 2), пик 11 — памп.
    expect(revalidated.weeks[9].contestPhase).toBe('taper');
    expect(revalidated.weeks[10].contestPhase).toBe('taper');
    expect(revalidated.weeks[9].sessions[0].exercises[0].sets).toBeLessThanOrEqual(plan.weeks[9].sessions[0].exercises[0].sets);
    expect(revalidated.weeks[9].sessions[0].exercises[0].rir).toBeGreaterThanOrEqual(1);
    expect(revalidated.weeks[11].peakWeek).toBe(true);
    // Пик-неделя — памп-режим (3 памп-сессии, суммарно до ~100 сетов — норм для пампа);
    // финализатор не должен раздувать её сверх памп-протокола.
    const peakSets = (revalidated.weeks[11] as any).sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
    expect(peakSets).toBeLessThan(100);
  });

  it('E2E с режимом ×0.85: подготовка ×0.85 от базы, revalidate не накапливает', () => {
    const plan = buildBBPlan(makeInput());
    const prepped = applyContestPrepToBBPlan(plan, baseConfig(), { prepWeeks: 9, taperWeeks: 2, prepVolumeMult: 0.85 }) as BBPlanWithPrep;
    const baseSets = plan.weeks[0].sessions[0].exercises[0].sets;
    const prepSets = prepped.weeks[0].sessions[0].exercises[0].sets;
    expect(prepSets).toBe(Math.max(2, Math.round(baseSets * 0.85)));
    // Повторный force — без накопления.
    const again = applyContestPrepToBBPlan(prepped, baseConfig(), { prepWeeks: 9, taperWeeks: 2, prepVolumeMult: 0.85, force: true }) as BBPlanWithPrep;
    expect(again.weeks[0].sessions[0].exercises[0].sets).toBe(prepSets);
  });
});

describe('История корректировок и экспорт (P2/P3)', () => {
  it('recordPrepAdjustment добавляет запись с датой/причиной/источником и кап 20', () => {
    let plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    plan = recordPrepAdjustment(plan, { reason: 'Плато 2 недели', caloriesDelta: -175, cardioDelta: 0, weightStatus: 'too_slow', source: 'user' });
    expect(plan.adjustments?.length).toBe(1);
    expect(plan.adjustments![0].caloriesDelta).toBe(-175);
    expect(plan.adjustments![0].date).toBeTruthy();
    expect(plan.updatedAt >= plan.createdAt).toBe(true);
    for (let i = 0; i < 25; i++) {
      plan = recordPrepAdjustment(plan, { reason: `корр ${i}`, caloriesDelta: 0, cardioDelta: 20, weightStatus: 'on_track', source: 'user' });
    }
    expect(plan.adjustments!.length).toBeLessThanOrEqual(20);
  });

  it('buildPrepIcs: события фаз + show day, ICS-экранирование', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ contraindications: ['kidney'] }), { prepWeeks: 8, taperWeeks: 2 });
    const ics = buildPrepIcs(plan);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:🎬 Show day');
    expect(ics).toContain('DTSTART;VALUE=DATE:' + plan.showDate.replace(/-/g, ''));
    // Экранирование запрещённых символов в описаниях (запятые/точки с запятой).
    expect(ics).not.toContain('CONTRAIND');
  });

  it('buildPrepCoachJson: компактный снапшот с фазами и корректировками', () => {
    let plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    plan = recordPrepAdjustment(plan, { reason: 'test', caloriesDelta: 150, cardioDelta: 0, weightStatus: 'too_fast', source: 'user' });
    const json = JSON.parse(buildPrepCoachJson(plan));
    expect(json.id).toBe(plan.id);
    expect(json.phases.length).toBeGreaterThan(0);
    expect(json.adjustments.length).toBe(1);
    expect(json.preparation.weeks).toBe(8);
  });
});

describe('План vs Факт тренировок (prepTrainingCompliance)', () => {
  const mkPlan = (): BBContestPrepPlan => buildBBContestPrepPlan(
    baseConfig({ showDate: addDaysIso(todayIso(), 40) }),
    { prepWeeks: 4, taperWeeks: 2 },
  );
  const mkWeeks = (n: number): Array<{ week: number; contestPhase?: string; plannedSets: number }> =>
    Array.from({ length: n }, (_, i) => ({ week: i + 1, plannedSets: 20 }));

  it('прошедшие недели считаются по датам сессий; будущие — upcoming', () => {
    const plan = mkPlan();
    const weeks = mkWeeks(7);
    // Неделя 1 (диапазон [dateStart..+6]) — 20 сетов; неделя 2 (+7..+13) — 10 из 20.
    const w1 = plan.phases.find(p => p.key === 'preparation')!;
    const sessions = [
      { date: w1.dateStart, totalSets: 15 },
      { date: addDaysIso(w1.dateStart, 3), totalSets: 5 },
      { date: addDaysIso(w1.dateStart, 7), totalSets: 10 },
    ];
    const res = prepTrainingCompliance(plan, weeks, sessions);
    expect(res.weeks.length).toBe(7);
    const wk1 = res.weeks.find(w => w.week === 1)!;
    expect(wk1.status).toBe('done');
    expect(wk1.actualSets).toBe(20);
    expect(wk1.pct).toBe(1);
    const wk2 = res.weeks.find(w => w.week === 2)!;
    expect(wk2.actualSets).toBe(10);
    expect(wk2.status).toBe('partial');
    // Последняя неделя (пик) — в будущем → upcoming.
    expect(res.weeks[res.weeks.length - 1].status).toBe('upcoming');
    // overall по прошедшим неделям (1 и 2): 30/40 = 0.75.
    expect(res.overallPct).toBe(0.75);
    expect(res.elapsedWeeks).toBe(2);
    expect(res.completedWeeks).toBe(1);
  });

  it('полное выполнение → recommendation «по графику», пропуски → «вернитесь к плану»', () => {
    const plan = mkPlan();
    const weeks = mkWeeks(7);
    const w1 = plan.phases.find(p => p.key === 'preparation')!;
    // Прошедшие недели 1 и 2: по 20 сетов каждая.
    const full = prepTrainingCompliance(plan, weeks, [
      { date: w1.dateStart, totalSets: 20 },
      { date: addDaysIso(w1.dateStart, 7), totalSets: 20 },
    ]);
    expect(full.overallPct).toBe(1);
    expect(full.recommendation).toMatch(/по графику/);
    const missed = prepTrainingCompliance(plan, weeks, []);
    expect(missed.overallPct).toBe(0);
    expect(missed.recommendation).toMatch(/вернитесь к плану/);
  });

  it('пустой дневник и будущая подготовка → «ещё не началась»', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ showDate: addDaysIso(todayIso(), 400) }), { prepWeeks: 8, taperWeeks: 2 });
    const res = prepTrainingCompliance(plan, mkWeeks(11), []);
    expect(res.weeks.every(w => w.status === 'upcoming')).toBe(true);
    expect(res.recommendation).toMatch(/ещё не началась/);
    expect(res.overallPct).toBe(0);
  });
});

describe('Матрица категорий (P2): 4 мужских + 5 женских', () => {
  const CATS: Array<{ cat: string; sex: 'male' | 'female' }> = [
    { cat: 'mens_physique', sex: 'male' }, { cat: 'classic_physique', sex: 'male' },
    { cat: 'mens_bb', sex: 'male' }, { cat: 'bb_212', sex: 'male' },
    { cat: 'bikini', sex: 'female' }, { cat: 'wellness', sex: 'female' },
    { cat: 'figure', sex: 'female' }, { cat: 'womens_physique', sex: 'female' },
    { cat: 'womens_bb', sex: 'female' },
  ];

  it.each(CATS)('категория $cat: план строится, питание консистентно (ккал = Б×4+У×4+Ж×9, жиры ≥ пол, натрий ≥ пол)', ({ cat, sex }) => {
    const weightKg = sex === 'female' ? 55 : 80;
    const plan = buildBBContestPrepPlan(baseConfig({ sex, category: cat as any, weightKg }), { prepWeeks: 8, taperWeeks: 2 });
    expect(plan.category).toBe(cat);
    // Пик-неделя: ккал = сумма макросов, жиры/натрий/вода по полу.
    const peak = buildPeakWeek(configFromPlan(plan));
    for (const d of peak) {
      expect(d.kcal).toBe(d.proteinG * 4 + d.carbsG * 4 + d.fatG * 9);
      expect(d.fatG).toBeGreaterThanOrEqual(sex === 'female' ? 30 : 30);
      expect(d.sodiumMg).toBeGreaterThanOrEqual(sex === 'female' ? 800 : 0);
      if (d.day === 7 && sex === 'female') expect(d.waterLiters).toBeGreaterThanOrEqual(0.5);
    }
    // Подготовка: калорийный пол и жиры.
    const t = nutritionTargetsForPrepDate(plan.phases[0].dateStart, plan, { kcal: 1000, proteinG: 100, fatG: 30, carbsG: 100, waterMl: 3000, sodiumMg: 2800 });
    expect(t.kcal).toBeGreaterThanOrEqual(sex === 'female' ? 1400 : 1200);
    expect(t.fatG).toBeGreaterThanOrEqual(Math.round(weightKg * (sex === 'female' ? 0.8 : 0.6)));
    // Без женских нот для мужских категорий.
    if (sex === 'male') expect(t.note).not.toMatch(/лютеиновую/i);
  });

  it.each([
    ['beginner', 1, 0], ['intermediate', 3, 1], ['advanced', 7, 3],
  ] as Array<['beginner' | 'intermediate' | 'advanced', number, number]>)('уровень %s (лет %i, пиков %i) — стратегия пик-недели и предупреждения', (level, years, prepCount) => {
    const plan = buildBBContestPrepPlan(baseConfig({ experienceLevel: level, prepCount }), { prepWeeks: 8, taperWeeks: 2 });
    const expected = level === 'advanced' && prepCount > 0 ? 'moderate' : 'conservative';
    expect(plan.peakWeek.strategy).toBe(expected);
    if (level === 'beginner' || prepCount === 0) {
      expect(plan.safety.warnings.some(w => /первый пик/i.test(w))).toBe(true);
    }
  });
});
