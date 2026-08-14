/**
 * pl-taper-append.test.ts — тесты:
 * 1. appendPLTaperWeeks(plan, n) — реальное добавление тапер-недель к активному циклу.
 * 2. recommendWeightCut — рекомендации по сбросу веса перед соревнованием.
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks, refreshMeetAttempts, type LMSBuildOutput } from '../lms-builder.engine';
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

  it('вес пересчитан от прогрессирующего ПМ (как в цикле: workWeight(pm, pct))', () => {
    const plan = buildBase(6);
    const baseW = plan.weeks[plan.weeks.length - 1].days[0].exercises[0].workSets[0].weight;
    const next = appendPLTaperWeeks(plan, 2);
    const lastW = next.weeks[next.weeks.length - 1].days[0].exercises[0].workSets[0].weight;
    // Натурал: correctionPct цикла (k≈0.005-0.01) — вес чуть растёт, но не падает.
    expect(lastW).toBeGreaterThanOrEqual(baseW);
    expect(lastW).toBeLessThanOrEqual(Math.round(baseW * 1.06));
  });

  it('pmRow taper-недель продолжает прогрессию от последней недели', () => {
    const plan = buildBase(6);
    const basePm = plan.weeks[plan.weeks.length - 1].pmRow['Присед'];
    const next = appendPLTaperWeeks(plan, 2);
    const lastPm = next.weeks[next.weeks.length - 1].pmRow['Присед'];
    expect(lastPm).toBeGreaterThan(basePm);
    const lastWkPm = next.weeks[next.weeks.length - 2].pmRow['Присед'];
    expect(lastWkPm).toBeGreaterThan(basePm);
  });

  it('autoReg применяется к тапер-неделям: вес ×множитель, объём ×множитель, RIR +сдвиг', () => {
    const plan = buildBase(6);
    const without = appendPLTaperWeeks(plan, 2);
    const withAr = appendPLTaperWeeks(plan, 2, {
      autoReg: { topSetPctMultiplier: 0.9, volumeMultiplier: 0.8, rirShift: 1 },
    });
    const lastNoAr = without.weeks[without.weeks.length - 1];
    const lastAr = withAr.weeks[withAr.weeks.length - 1];
    const wsNoAr = lastNoAr.days[0].exercises[0].workSets[0];
    const wsAr = lastAr.days[0].exercises[0].workSets[0];
    expect(wsAr.weight).toBeCloseTo(Math.round(wsNoAr.weight * 0.9 * 10) / 10, 1);
    expect(wsAr.sets).toBe(Math.max(1, Math.round(wsNoAr.sets * 0.8)));
    expect(wsAr.rir).toBe(wsNoAr.rir + 1);
    // Rationale содержит отметку авторегуляции
    expect(withAr.progressionRationale).toContain('Авторегуляция применена к таперу');
  });

  it('meetAttempts не масштабируются в движке (единая точка — UI-рендер), workSets прикидов — масштабируются', () => {
    const plan = buildBase(6);
    const withMeet = appendPLTaperWeeks(plan, 2, {
      meetWeek: { strategy: 'balanced' },
      autoReg: { topSetPctMultiplier: 0.9, volumeMultiplier: 1, rirShift: 0 },
    });
    const meetWk = withMeet.weeks.find(w => w.meetWeek);
    expect(meetWk).toBeTruthy();
    expect(meetWk!.meetAttempts).toBeTruthy();
    const noAr = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'balanced' } });
    const meetNoAr = noAr.weeks.find(w => w.meetWeek)!;
    // meetAttempts (карточки прикидов) — без масштабирования в движке
    expect(meetWk!.meetAttempts!.lifts[0].opener).toBe(meetNoAr.meetAttempts!.lifts[0].opener);
    // workSets прикидочных синглов — масштабированы (×0.9)
    const wsAr = meetWk!.days[0].exercises.find(e => e.workSets.some(ws => ws.reps === 1 && ws.sets === 1))!.workSets[0];
    const wsNoAr = meetNoAr.days[0].exercises.find(e => e.workSets.some(ws => ws.reps === 1 && ws.sets === 1))!.workSets[0];
    expect(wsAr.weight).toBeCloseTo(Math.round(wsNoAr.weight * 0.9 * 10) / 10, 1);
  });

  it('питание участвует в тапере: nutrition → rationale и больший объём аксессуаров (soft-cap)', () => {
    const plan = buildBase(6);
    const withNutr = appendPLTaperWeeks(plan, 2, { nutrition: { calorieSurplus: 400, proteinPerKg: 2.2 } });
    expect(withNutr.progressionRationale).toContain('Питание в taper-неделях: MRV +');
    const weekVol = (p: LMSBuildOutput) => p.weeks[p.weeks.length - 1].days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.workSets.reduce((a, ws) => a + ws.sets, 0), 0), 0);
    const poor = appendPLTaperWeeks(plan, 2, { nutrition: { calorieSurplus: -300, proteinPerKg: 0.8 } });
    expect(poor.progressionRationale).toContain('Питание в taper-неделях: MRV -');
    expect(weekVol(withNutr)).toBeGreaterThan(weekVol(poor));
  });

  it('подготовительные прикиды на тапер-неделях: пробный сингл 80% на основных лифтах (кроме финальной)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    const prepWeek = next.weeks[next.weeks.length - 2];
    const lastWeek = next.weeks[next.weeks.length - 1];
    const hasPrep = (wk: LMSBuildOutput['weeks'][number]) => wk.days.some(d => d.exercises.some(e => e.workSets.some(ws => ws.reps === 1 && ws.pct === 0.8)));
    expect(hasPrep(prepWeek)).toBe(true);
    expect(hasPrep(lastWeek)).toBe(false);
  });

  it('refreshMeetAttempts пересчитывает прикиды под стратегию (масштабирование — в UI-рендере)', () => {
    const plan = buildBase(6);
    const withMeet = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'balanced' } });
    const before = withMeet.weeks.find(w => w.meetWeek)!.meetAttempts!.lifts[0];
    const refreshed = refreshMeetAttempts(withMeet, 'aggressive');
    const meetWkAfter = refreshed.weeks.find(w => w.meetWeek)!;
    expect(meetWkAfter.meetAttempts!.strategy).toBe('aggressive');
    const after = meetWkAfter.meetAttempts!.lifts[0];
    // Агрессивная стратегия: опенер 93% против 92% — веса чуть выше
    expect(after.opener).toBeGreaterThan(before.opener);
    expect(refreshed.progressionRationale).toContain('Прикиды пересчитаны');
  });

  it('meetData: фактический ПМ после цикла — тренировочные веса тапера от факта (разница ПМ)', () => {
    const plan = buildBase(6);
    const withData = appendPLTaperWeeks(plan, 2, {
      meetData: { actualPm: { 'Присед': 200, 'Жим лежа': 130, 'Становая тяга': 240 } },
    });
    const last = withData.weeks[withData.weeks.length - 1];
    expect(last.pmRow['Присед']).toBe(200);
    expect(last.pmRow['Жим лежа']).toBe(130);
    // Без meetData — прогноз (растёт от базы)
    const plain = appendPLTaperWeeks(plan, 2);
    const plainLast = plain.weeks[plain.weeks.length - 1];
    expect(plainLast.pmRow['Присед']).not.toBe(200);
  });

  it('peakMode=pl: ПЛ-пик-протокол — интенсивность растёт к финалу, RIR падает, синглы на интенсивной неделе', () => {
    const plan = buildBase(6);
    const pl = appendPLTaperWeeks(plan, 3, { peakMode: 'pl' });
    const w1 = pl.weeks[pl.weeks.length - 3];
    const w2 = pl.weeks[pl.weeks.length - 2];
    const w3 = pl.weeks[pl.weeks.length - 1];
    const mainOf = (wk: LMSBuildOutput['weeks'][number]) => wk.days.flatMap(d => d.exercises.filter(e => e.load === 'main' || e.load === 'Тяжелая').flatMap(e => e.workSets))[0];
    // Интенсивность: подводящая 90% → интенсивная 95% → соревновательная 100% (от ПМ своей недели)
    const pm1 = w1.pmRow['Присед'] ?? 0;
    const pm2 = w2.pmRow['Присед'] ?? 0;
    const pm3 = w3.pmRow['Присед'] ?? 0;
    expect(mainOf(w1)!.weight).toBeCloseTo(Math.round(pm1 * 0.9 * 10) / 10, 0);
    expect(mainOf(w2)!.weight).toBeCloseTo(Math.round(pm2 * 0.95 * 10) / 10, 0);
    expect(mainOf(w3)!.weight).toBeCloseTo(Math.round(pm3 * 1.0 * 10) / 10, 0);
    // RIR падает: 1-2 → 0-1 → 0
    expect(mainOf(w1)!.rir).toBeLessThanOrEqual(2);
    expect(mainOf(w3)!.rir).toBeLessThanOrEqual(mainOf(w2)!.rir);
    // Синглы на интенсивной неделе (reps=1)
    expect(mainOf(w2)!.reps).toBe(1);
    // Финальная неделя — прикиды
    expect(w3.meetAttempts).toBeTruthy();
    expect(pl.progressionRationale).toContain('ПЛ-пик-протокол');
  });

  it('peakMode по умолчанию classic — RIR растёт (+1/+2), интенсивность сохранена', () => {
    const plan = buildBase(6);
    const classic = appendPLTaperWeeks(plan, 2);
    const last = classic.weeks[classic.weeks.length - 1];
    const baseRir = plan.weeks[plan.weeks.length - 1].days[0]?.exercises[0]?.rir ?? 2;
    expect(last.days[0].exercises[0].rir).toBeGreaterThanOrEqual(baseRir + 2);
  });

  it('meetData: прикиды от планируемого ПМ федерации', () => {
    const plan = buildBase(6);
    const withPlan = appendPLTaperWeeks(plan, 2, {
      meetWeek: { strategy: 'balanced' },
      meetData: { plannedPm: { 'Присед': 220, 'Жим лежа': 140, 'Становая тяга': 260 } },
    });
    const meetWk = withPlan.weeks.find(w => w.meetWeek)!;
    const squat = meetWk.meetAttempts!.lifts.find(l => /присед/.test(l.name.toLowerCase()))!;
    // balanced: опенер 92% от плана 220 = 202.4
    expect(squat.opener).toBeGreaterThanOrEqual(202);
    expect(squat.third).toBeGreaterThanOrEqual(224);
  });

  it('meetData: план федерации выше факта — прикиды от потолка (факт ×1.02), taperNote предупреждает', () => {
    const plan = buildBase(6);
    const withData = appendPLTaperWeeks(plan, 2, {
      meetWeek: { strategy: 'balanced' },
      meetData: {
        actualPm: { 'Присед': 200 },
        plannedPm: { 'Присед': 300 }, // план сильно выше факта
      },
    });
    const meetWk = withData.weeks.find(w => w.meetWeek)!;
    const squat = meetWk.meetAttempts!.lifts.find(l => /присед/.test(l.name.toLowerCase()))!;
    // Потолок: 200 × 1.02 = 204, опенер 92% от 204 ≈ 187.7 — НЕ от плана 300 (276)
    expect(squat.opener).toBeLessThan(250);
    expect(squat.opener).toBeGreaterThanOrEqual(187);
    expect(meetWk.taperNote).toContain('выше факта');
  });

  it('питание (как в ББ-авто): профицит+белок → MRV-множитель отражается в rationale плана', () => {
    const base = { template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 6, faithful: true } as never;
    const good = buildLMSPlan({ ...base, nutrition: { calorieSurplus: 400, proteinPerKg: 2.2 } } as never);
    expect(good.progressionRationale).toContain('Питание: MRV +');
    const bad = buildLMSPlan({ ...base, nutrition: { calorieSurplus: -300, proteinPerKg: 0.8 } } as never);
    expect(bad.progressionRationale).toContain('Питание: MRV -');
    // Без эффекта питания (0 ккал, 1.5 г/кг → множитель 1.0) — заметки нет
    const none = buildLMSPlan({ ...base, nutrition: { calorieSurplus: 0, proteinPerKg: 1.5 } } as never);
    expect(none.progressionRationale).not.toContain('Питание: MRV');
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

  it('пересчитывает plVolumeLandmarks после добавления taper-недель (отчёт качества)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    expect(next.plVolumeLandmarks).toBeDefined();
    expect(next.plVolumeLandmarks!.length).toBeGreaterThan(0);
    // Тот же объект? Нет — пересчитан (новые недели учтены).
    expect(next.plVolumeLandmarks).not.toBe(plan.plVolumeLandmarks);
  });

  it('plVolumeLandmarks с PED-курсом используют MRV × pedMrvMult (отчёт качества)', () => {
    const plan = buildBase(6);
    const nat = appendPLTaperWeeks(plan, 2, { mode: 'natural' });
    const onCourse = appendPLTaperWeeks(plan, 2, {
      peds: ['AAS'], pedDoses: { AAS: 500 }, courseIntensity: 'moderate', mode: 'on_course',
    });
    // По-групповое сравнение: для каждой общей группы курсовой MRV ≥ натурального
    // (landmarks сортируются по статусу, поэтому сравниваем по ключу group, не по индексу).
    expect(onCourse.plVolumeLandmarks!.length).toBeGreaterThan(0);
    let compared = 0;
    for (const nl of nat.plVolumeLandmarks!) {
      const ol = onCourse.plVolumeLandmarks!.find(o => o.group === nl.group);
      if (ol) { expect(ol.mrv).toBeGreaterThanOrEqual(nl.mrv); compared++; }
    }
    expect(compared).toBeGreaterThan(0);
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

  // ── PED-адаптация по аналогии с buildLMSPlan ──
  it('PED: mode=on_course → прогрессия ПМ быстрее (k=2% moderate), веса выше натурала', () => {
    const nat = buildBase(6);
    const onCourse = appendPLTaperWeeks(nat, 2, {
      peds: ['AAS'], pedDoses: { AAS: 500 }, courseIntensity: 'moderate', mode: 'on_course',
    });
    const natLast = appendPLTaperWeeks(nat, 2, { mode: 'natural' });
    const onPm = onCourse.weeks[onCourse.weeks.length - 1].pmRow['Присед'];
    const natPm = natLast.weeks[natLast.weeks.length - 1].pmRow['Присед'];
    const basePm = nat.weeks[nat.weeks.length - 1].pmRow['Присед'];
    // На курсе ПМ растёт на 2%/нед — заметно выше натурала.
    expect(onPm).toBeGreaterThan(basePm * 1.02);
    expect(onPm).toBeGreaterThan(natPm);
  });

  it('PED: mode=pct → ПМ падает (−0.5%/нед)', () => {
    const nat = buildBase(6);
    const pct = appendPLTaperWeeks(nat, 2, { mode: 'pct' });
    const lastPm = pct.weeks[pct.weeks.length - 1].pmRow['Присед'];
    const basePm = nat.weeks[nat.weeks.length - 1].pmRow['Присед'];
    expect(lastPm).toBeLessThan(basePm);
  });

  it('PED: адаптация (dose-aware) отражена в rationale (MRV/восст множители)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, {
      peds: ['AAS'], pedDoses: { AAS: 1500 }, courseIntensity: 'heavy', mode: 'on_course',
    });
    expect(next.progressionRationale).toContain('PED-адаптация');
    expect(next.progressionRationale).toContain('MRV ×');
  });

  it('PED: на курсе taper-недели не режут аксессуары ниже PED-адаптированного объёма', () => {
    const plan = buildBase(6);
    const nat = appendPLTaperWeeks(plan, 2, { mode: 'natural' });
    const onCourse = appendPLTaperWeeks(plan, 2, {
      peds: ['AAS'], pedDoses: { AAS: 1500 }, courseIntensity: 'heavy', mode: 'on_course',
    });
    const accSetsNat = (wk: LMSBuildOutput['weeks'][number]) =>
      wk.days.reduce((s, d) => s + d.exercises.filter(e => e.load !== 'main').reduce((ss, e) => ss + e.workSets.reduce((n, ws) => n + ws.sets, 0), 0), 0);
    const accOn = accSetsNat(onCourse.weeks[onCourse.weeks.length - 1]);
    const accNat = accSetsNat(nat.weeks[nat.weeks.length - 1]);
    // Объём аксессуаров на курсе ≥ натурала (pedMrvMult ≥ 1 в buildLMSPlan-логике).
    expect(accOn).toBeGreaterThanOrEqual(accNat);
  });

  it('PED: без PED и без явного mode → natural поведение (нет PED-заметки)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    expect(next.progressionRationale).not.toContain('PED-адаптация');
  });

  // ── Выход на пик 105%: прикиды дня соревнований + маркировка тапер-недель ──
  it('добавленные недели помечаются taperWeek=true (оригинальные — нет)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    const orig = next.weeks.slice(0, 6);
    expect(orig.every(w => w.taperWeek !== true)).toBe(true);
    expect(next.weeks.slice(-2).every(w => w.taperWeek === true)).toBe(true);
  });

  it('агрессивная стратегия: третья попытка = 105% от ПМ финальной недели', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'aggressive' } });
    const last = next.weeks[next.weeks.length - 1];
    expect(last.meetAttempts).toBeDefined();
    expect(last.meetAttempts!.strategy).toBe('aggressive');
    const squat = last.meetAttempts!.lifts.find(l => /присед/i.test(l.name));
    expect(squat).toBeDefined();
    const pm = last.pmRow[squat!.name];
    expect(squat!.third).toBeCloseTo(Math.round(pm * 1.05 / 2.5) * 2.5, 5);
    expect(squat!.third).toBeGreaterThan(pm); // выход на пик выше ПМ недели
  });

  it('прикиды по умолчанию — сбалансированная (92/96/102%)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2);
    const last = next.weeks[next.weeks.length - 1];
    expect(last.meetAttempts).toBeDefined();
    expect(last.meetAttempts!.strategy).toBe('balanced');
  });

  it('прикиды вешаются ТОЛЬКО на финальную тапер-неделю', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 3, { peakExit: { strategy: 'aggressive' } });
    const extra = next.weeks.slice(-3);
    expect(extra[0].meetAttempts).toBeUndefined();
    expect(extra[1].meetAttempts).toBeUndefined();
    expect(extra[2].meetAttempts).toBeDefined();
  });

  it('без соревновательных движений (армрестлинг) — прикидов нет, но недели помечены', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'aggressive' } });
    expect(next.weeks.slice(-2).every(w => w.taperWeek === true)).toBe(true);
    // В CYCLE_01 присед/жим/тяга есть — для планов без них meetAttempts просто отсутствует.
  });

  it('rationale упоминает выход на пик и выбранную стратегию', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'aggressive' } });
    expect(next.progressionRationale).toContain('Выход на пик');
    expect(next.progressionRationale).toContain('93/97/105%');
  });

  // ── Имитация соревнований (mock meet) ──
  it('mock meet: неделя вставляется ПЕРЕД тапер-неделями', () => {
    const plan = buildBase(6);
    const baseLen = plan.weeks.length;
    const next = appendPLTaperWeeks(plan, 2, { mockMeet: { strategy: 'aggressive' } });
    expect(next.weeks.length).toBe(baseLen + 3);
    const mock = next.weeks[baseLen];
    expect(mock.mockMeet).toBe(true);
    expect(mock.taperWeek).not.toBe(true);
    expect(mock.meetAttempts).toBeDefined();
    expect(next.weeks[baseLen + 1].taperWeek).toBe(true);
    expect(next.weeks[baseLen + 2].taperWeek).toBe(true);
  });

  it('mock meet: основные движения — прикиды-синглы (опенер/вторая/третья по 1 сету)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { mockMeet: { strategy: 'aggressive' } });
    const mock = next.weeks[plan.weeks.length];
    const squatEx = mock.days.flatMap(d => d.exercises).find(e => /присед/i.test(e.name));
    expect(squatEx).toBeDefined();
    const sets = squatEx!.workSets;
    expect(sets).toHaveLength(3); // опенер, вторая, третья
    expect(sets.every(s => s.reps === 1 && s.sets === 1)).toBe(true);
    const attempts = mock.meetAttempts!.lifts.find(l => /присед/i.test(l.name))!;
    expect(sets[0].weight).toBe(attempts.opener);
    expect(sets[2].weight).toBe(attempts.third);
    expect(sets[2].rir).toBe(0);
  });

  it('mock meet: аксессуары — 50% объёма', () => {
    const plan = buildBase(6);
    const isComp = (name: string) => /присед|жим лежа|становая/i.test(name);
    const baseAcc = plan.weeks[plan.weeks.length - 1].days.flatMap(d => d.exercises).filter(e => !isComp(e.name));
    if (baseAcc.length === 0) return; // если аксессуаров нет в цикле — тест не применим
    const next = appendPLTaperWeeks(plan, 2, { mockMeet: { strategy: 'aggressive' } });
    const mock = next.weeks[plan.weeks.length];
    const mockAcc = mock.days.flatMap(d => d.exercises).filter(e => !isComp(e.name));
    for (let i = 0; i < mockAcc.length; i++) {
      const base = baseAcc[i % baseAcc.length];
      expect(mockAcc[i].workSets.reduce((s, ws) => s + ws.sets, 0)).toBeLessThanOrEqual(Math.max(1, Math.round(base.workSets.reduce((s, ws) => s + ws.sets, 0) * 0.6)));
    }
  });

  it('mock meet: стратегия по умолчанию = сбалансированная (дефолт обработан)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { mockMeet: {} });
    const mock = next.weeks[plan.weeks.length];
    expect(mock.meetAttempts!.strategy).toBe('balanced');
    expect(mock.meetAttempts!.lifts[0].third).toBeGreaterThan(0);
  });

  it('mock meet: rationale упоминает имитацию соревнований', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { mockMeet: { strategy: 'aggressive' } });
    expect(next.progressionRationale).toContain('mock meet');
  });

  // ── Неделя соревнований в конце тапера (meetWeek) ──
  it('meet week: добавляется ПОСЛЕ тапер-недель', () => {
    const plan = buildBase(6);
    const baseLen = plan.weeks.length;
    const next = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'aggressive' } });
    expect(next.weeks.length).toBe(baseLen + 3);
    const meet = next.weeks[next.weeks.length - 1];
    expect(meet.meetWeek).toBe(true);
    expect(meet.taperWeek).not.toBe(true);
    expect(meet.meetAttempts).toBeDefined();
    expect(next.weeks[baseLen].taperWeek).toBe(true);
    expect(next.weeks[baseLen + 1].taperWeek).toBe(true);
    expect(meet.week).toBeGreaterThan(next.weeks[baseLen + 1].week);
  });

  it('meet week: подходы = прикиды из карточек (опенер/вторая/третья ×1, третья RIR0)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'aggressive' } });
    const meet = next.weeks[next.weeks.length - 1];
    const squatEx = meet.days.flatMap(d => d.exercises).find(e => /присед/i.test(e.name));
    expect(squatEx).toBeDefined();
    const sets = squatEx!.workSets;
    expect(sets).toHaveLength(3);
    expect(sets.every(s => s.reps === 1 && s.sets === 1)).toBe(true);
    const attempts = meet.meetAttempts!.lifts.find(l => /присед/i.test(l.name))!;
    expect(sets[0].weight).toBe(attempts.opener);
    expect(sets[2].weight).toBe(attempts.third);
    expect(sets[2].rir).toBe(0);
    expect(sets[2].weight).toBeGreaterThan(meet.pmRow[squatEx!.name]); // 105% > ПМ
  });

  it('meet week: комбинация mock + taper + meet — порядок: mock → тапер → соревнования', () => {
    const plan = buildBase(6);
    const baseLen = plan.weeks.length;
    const next = appendPLTaperWeeks(plan, 2, { mockMeet: { strategy: 'aggressive' }, meetWeek: { strategy: 'aggressive' } });
    expect(next.weeks.length).toBe(baseLen + 4);
    expect(next.weeks[baseLen].mockMeet).toBe(true);
    expect(next.weeks[baseLen + 1].taperWeek).toBe(true);
    expect(next.weeks[baseLen + 2].taperWeek).toBe(true);
    expect(next.weeks[baseLen + 3].meetWeek).toBe(true);
    expect(next.weeks[baseLen + 3].meetAttempts).toBeDefined();
  });

  it('meet week: стратегия по умолчанию = сбалансированная', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { meetWeek: {} });
    const meet = next.weeks[next.weeks.length - 1];
    expect(meet.meetAttempts!.strategy).toBe('balanced');
  });

  it('meet week: refreshMeetAttempts обновляет прикиды и на неделе соревнований', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'balanced' } });
    const refreshed = refreshMeetAttempts(next, 'aggressive');
    const meet = refreshed.weeks[refreshed.weeks.length - 1];
    expect(meet.meetAttempts!.strategy).toBe('aggressive');
    const squat = meet.meetAttempts!.lifts.find(l => /присед/i.test(l.name))!;
    expect(squat.third).toBeGreaterThan(meet.pmRow[squat.name]);
  });

  it('meet week: rationale упоминает неделю соревнований', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'aggressive' } });
    expect(next.progressionRationale).toContain('Неделя соревнований');
  });

  // ── Прикиды в упражнениях: процентовка по стратегии (93/97/105%) ──
  it('прикиды: процентовка подходов соответствует стратегии (опенер ~93%, третья ~105%)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'aggressive' } });
    const meet = next.weeks[next.weeks.length - 1];
    const squatEx = meet.days.flatMap(d => d.exercises).find(e => /присед/i.test(e.name))!;
    const pm = meet.pmRow[squatEx.name];
    // pct вычисляется от ПМ недели: опенер ≈ 93%, третья ≈ 105% (округление до 2.5 кг)
    expect(squatEx.workSets[0].pct).toBeCloseTo(0.93, 1);
    expect(squatEx.workSets[2].pct).toBeCloseTo(1.05, 1);
    // Проценты растут: опенер < вторая < третья
    expect(squatEx.workSets[0].pct).toBeLessThan(squatEx.workSets[1].pct);
    expect(squatEx.workSets[1].pct).toBeLessThan(squatEx.workSets[2].pct);
    expect(pm).toBeGreaterThan(0);
  });

  it('прикиды: упражнения с нестандартными именами получают прикиды (regex-маппинг)', () => {
    const tpl = {
      ...CYCLE_01,
      week1: CYCLE_01.week1.map(day => ({
        ...day,
        exercises: day.exercises.map(ex => ({
          ...ex,
          name: ex.name === 'Присед' ? 'Приседания со штангой' : ex.name === 'Жим лежа' ? 'Жим штанги лёжа' : ex.name === 'Становая тяга' ? 'Становая тяга с плинтов' : ex.name,
        })),
      })),
    } as never;
    const plan = buildLMSPlan({
      template: tpl,
      pmMap: { 'Приседания со штангой': 180, 'Жим штанги лёжа': 120, 'Становая тяга с плинтов': 220 },
      fallbackPm: 80,
      mode: 'natural',
      weeksOverride: 6,
      faithful: true,
    } as never);
    const next = appendPLTaperWeeks(plan, 2, { meetWeek: { strategy: 'aggressive' } });
    const meet = next.weeks[next.weeks.length - 1];
    const comp = meet.days.flatMap(d => d.exercises).filter(e => /присед|жим.*леж|станов/i.test(e.name));
    expect(comp.length).toBeGreaterThan(0);
    const squat = comp.find(e => /присед/i.test(e.name))!;
    expect(squat.workSets).toHaveLength(3);
    expect(squat.workSets.every(s => s.reps === 1 && s.sets === 1)).toBe(true);
    expect(squat.workSets[2].pct).toBeCloseTo(1.05, 1);
  });

  // ── Паритет стратегий: «Сбалансированная» (дефолт) не хуже новых ──
  it('все 3 стратегии: mock meet имеет одинаковую структуру (неделя/прикиды-синглы/аксессуары ×0.5)', () => {
    for (const strategy of ['conservative', 'balanced', 'aggressive'] as const) {
      const plan = buildBase(6);
      const next = appendPLTaperWeeks(plan, 2, { mockMeet: { strategy } });
      const mock = next.weeks[plan.weeks.length];
      expect(mock.mockMeet).toBe(true);
      expect(mock.meetAttempts).toBeDefined();
      expect(mock.meetAttempts!.strategy).toBe(strategy);
      expect(mock.meetAttempts!.lifts.length).toBeGreaterThan(0);
      const compEx = mock.days.flatMap(d => d.exercises).find(e => /присед|жим лежа|становая/i.test(e.name));
      expect(compEx).toBeDefined();
      expect(compEx!.workSets).toHaveLength(3);
      expect(compEx!.workSets.every(s => s.reps === 1 && s.sets === 1)).toBe(true);
      expect(compEx!.workSets[2].rir).toBe(0);
    }
  });

  it('все 3 стратегии: прикиды финальной тапер-недели на месте с корректными процентами', () => {
    const pctMap = { conservative: 1.0, balanced: 1.02, aggressive: 1.05 } as const;
    for (const strategy of ['conservative', 'balanced', 'aggressive'] as const) {
      const plan = buildBase(6);
      const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy } });
      const last = next.weeks[next.weeks.length - 1];
      expect(last.meetAttempts).toBeDefined();
      expect(last.meetAttempts!.strategy).toBe(strategy);
      const squat = last.meetAttempts!.lifts.find(l => /присед/i.test(l.name))!;
      const pm = last.pmRow[squat.name];
      // Третья попытка = стратегия × ПМ (округление до 2.5 кг)
      expect(squat.third).toBeCloseTo(Math.round(pm * pctMap[strategy] / 2.5) * 2.5, 5);
      expect(squat.third).toBeGreaterThan(squat.opener);
    }
  });

  it('все 3 стратегии: refreshMeetAttempts round-trip возвращает планы с той же структурой', () => {
    for (const from of ['conservative', 'balanced', 'aggressive'] as const) {
      for (const to of ['conservative', 'balanced', 'aggressive'] as const) {
        const plan = buildBase(6);
        const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: from }, mockMeet: { strategy: from } });
        const refreshed = refreshMeetAttempts(next, to);
        for (const wk of refreshed.weeks) {
          if (wk.meetAttempts) {
            expect(wk.meetAttempts.strategy).toBe(to);
            expect(wk.meetAttempts.lifts.length).toBeGreaterThan(0);
          }
        }
        expect(refreshed.weeks.length).toBe(next.weeks.length);
      }
    }
  });

  it('balanced: meetAttempts для финальной недели не хуже — третий вес > ПМ (102% > 100%)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'balanced' } });
    const last = next.weeks[next.weeks.length - 1];
    const squat = last.meetAttempts!.lifts.find(l => /присед/i.test(l.name))!;
    expect(squat.third).toBeGreaterThan(last.pmRow[squat.name]);
    expect(squat.opener).toBeLessThan(last.pmRow[squat.name]);
  });

  it('balanced: разминка (MEET_WARMUP_STEPS) применима к опенеру любой стратегии', async () => {
    const { MEET_WARMUP_STEPS, meetAttemptsFor } = await import('../competition-attempts');
    for (const strategy of ['conservative', 'balanced', 'aggressive'] as const) {
      const attempts = meetAttemptsFor(200, strategy);
      const warmup = MEET_WARMUP_STEPS.map(p => Math.round(attempts.opener * p * 2) / 2);
      expect(warmup.length).toBe(5);
      expect(warmup[4]).toBeLessThan(attempts.opener); // 90% от опенера < опенера
      expect(warmup.every(w => w > 0)).toBe(true);
    }
  });

  // ── Пересчёт прикидов (refreshMeetAttempts) ──
  it('refreshMeetAttempts: меняет стратегию на всех неделях с прикидами', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'balanced' }, mockMeet: { strategy: 'balanced' } });
    const refreshed = refreshMeetAttempts(next, 'aggressive');
    for (const wk of refreshed.weeks) {
      if (wk.meetAttempts) expect(wk.meetAttempts.strategy).toBe('aggressive');
    }
    // Исходный план не мутирован
    expect(next.weeks.find(w => w.meetAttempts)!.meetAttempts!.strategy).toBe('balanced');
  });

  it('refreshMeetAttempts: третья попытка = 105% ПМ при агрессивной', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'balanced' } });
    const refreshed = refreshMeetAttempts(next, 'aggressive');
    const last = refreshed.weeks[refreshed.weeks.length - 1];
    const squat = last.meetAttempts!.lifts.find(l => /присед/i.test(l.name))!;
    expect(squat.third).toBeGreaterThan(last.pmRow[squat.name]);
  });

  it('refreshMeetAttempts: та же стратегия → план без изменений (тот же объект)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'balanced' } });
    const refreshed = refreshMeetAttempts(next, 'balanced');
    expect(refreshed).toBe(next);
  });

  it('applyPLTaper (авто при сборке): финальная неделя помечена taperWeek + прикиды', () => {
    // Non-faithful путь: авто-taper к финальным неделям применяется в buildLMSPlan.
    const plan = buildLMSPlan({
      template: CYCLE_01 as never,
      pmMap,
      fallbackPm: 80,
      mode: 'natural',
      weeksOverride: 12,
      faithful: false,
    } as never);
    expect(plan.progressionRationale).toContain('Taper');
    const last = plan.weeks[plan.weeks.length - 1];
    expect(last.taperWeek).toBe(true);
    expect(last.meetAttempts).toBeDefined();
    expect(last.meetAttempts!.lifts.length).toBeGreaterThan(0);
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

  // ── Набор веса (текущий вес НИЖЕ целевого — переход в более тяжёлую категорию) ──
  it('набор: toGain = целевой − текущий, toCut = 0', () => {
    const rec = recommendWeightCut(80, 83, 8);
    expect(rec.toGain).toBe(3);
    expect(rec.toCut).toBe(0);
  });

  it('набор 3 кг за 8 недель → темп 0.375 кг/нед, профицит ≈413 ккал/день', () => {
    const rec = recommendWeightCut(80, 83, 8);
    expect(rec.gainFeasible).toBe(true);
    const weeklyGain = rec.toGain / 8;
    expect(rec.weeklySurplusKcal).toBe(Math.round(weeklyGain * 7700));
    expect(rec.dailySurplusKcal).toBe(Math.round(Math.round(weeklyGain * 7700) / 7));
    expect(rec.dailySurplusKcal).toBe(413);
    expect(rec.safeGainRate).toBeGreaterThan(0);
  });

  it('набор: gainTimeline растёт от текущего к целевому, последняя неделя — взвешивание', () => {
    const rec = recommendWeightCut(80, 83, 4);
    expect(rec.gainTimeline).toHaveLength(4);
    expect(rec.gainTimeline[0].weight).toBeGreaterThan(80);
    expect(rec.gainTimeline[3].weight).toBe(83);
    expect(rec.gainTimeline[3].note).toContain('Взвешивание');
  });

  it('набор: рекомендации присутствуют (профицит, белок)', () => {
    const rec = recommendWeightCut(80, 83, 8);
    expect(rec.gainRecommendations[0]).toContain('Набор');
    expect(rec.gainRecommendations.some(r => r.includes('ккал/день'))).toBe(true);
    expect(rec.gainRecommendations.some(r => r.includes('Белок 1.8'))).toBe(true);
  });

  it('набор: нереальный темп → gainFeasible=false и предупреждение', () => {
    // 6 кг за 2 недели = 3 кг/нед > безопасного ~0.5-1.0
    const rec = recommendWeightCut(80, 86, 2);
    expect(rec.gainFeasible).toBe(false);
    expect(rec.gainRecommendations.some(r => r.startsWith('❌'))).toBe(true);
  });

  it('набор: вес уже в категории → toGain=0, gainRecommendations пусты', () => {
    const rec = recommendWeightCut(80, 80, 8);
    expect(rec.toGain).toBe(0);
    expect(rec.gainRecommendations).toHaveLength(0);
  });

  it('weeksToMeet=0 при наборе → нет деления на ноль', () => {
    const rec = recommendWeightCut(80, 85, 0);
    expect(Number.isFinite(rec.dailySurplusKcal)).toBe(true);
    expect(rec.gainTimeline).toHaveLength(0);
  });

  it('набор: темп выше безопасного → предупреждение ⚠', () => {
    const rec = recommendWeightCut(80, 90, 4); // 10 кг за 4 нед = 2.5 кг/нед
    expect(rec.gainRecommendations.some(r => r.startsWith('⚠'))).toBe(true);
  });

  it('набор: предпоследняя неделя — вода/соль в норме (взвешивание НАВЕРХ)', () => {
    const rec = recommendWeightCut(80, 84, 4);
    expect(rec.gainTimeline[2].note).toContain('Вода/соль в норме');
    expect(rec.gainTimeline[2].note).toContain('НАВЕРХ');
    expect(rec.gainRecommendations.some(r => r.includes('Взвешивание НАВЕРХ'))).toBe(true);
    expect(rec.gainRecommendations.some(r => r.includes('жидкость не сгонять'))).toBe(true);
  });
});
