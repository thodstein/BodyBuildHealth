/**
 * arm-pro-integration.engine.ts — PRO-оркестратор A–J (эпик-связка).
 *
 * Единая точка: ArmBuilderInput (PRO-поля) → { rationale[], warnings[],
 * volumeMult, rirShift, replaceSideWithIso, replaceHeavyPronWithPulses,
 * workMaxPatch, legsAnchor, wafCard, supermatch, strap, sparring, video }.
 * Билдер вызывает ОДНУ функцию и применяет результат — инварианты ядра целы.
 */
import { buildWafStartCard } from './arm-waf.engine';
import { planBilateralVolume } from './arm-bilateral.engine';
import { buildSupermatchPlan } from './arm-supermatch.engine';
import { buildStrapSession } from './arm-start-strap.engine';
import { planSparring } from './arm-sparring.engine';
import { workMaxFromBenchmarks, ensureRadialFingers } from './arm-load-quant.engine';
import { autoregArmFromDiary } from './arm-diary-autoreg.engine';
import { planWeightCut, weeksUntilStart, prepPhaseForWeeksOut, legsAnchorBlock } from './arm-competition-prep.engine';
import { parseArmTrackCsv, armPathMetrics, classifyArmTrajectory } from './arm-video-analysis.engine';
import { planAttempts, platformWrFor } from './arm-platform.engine';
import { profileOpponent } from './arm-matchup.engine';
import { buildRfdSession } from './arm-rfd.engine';
import { buildGripRpe } from './arm-grip-rpe.engine';
import { ladderAdvice } from './arm-implement-ladder.engine';
import { buildContestSimWeek } from './arm-contest-sim.engine';
import { buildLongevityPlan } from './arm-longevity.engine';
import { buildTendonFuel } from './arm-tendon-fuel.engine';
import { buildArmWarmup } from './arm-warmup.engine';
import { checkCnsGuard, cnsFromDiary } from './arm-cns-guard.engine';
import { planLrSplit } from './arm-lr-split.engine';
import { analyzeTableIq } from './arm-table-iq.engine';
import { buildArmCalendar } from './arm-calendar.engine';
import { getArmCycle, fitCycleToWeeks } from './arm-cycle-library.engine';
import { planCocTriple, cocWeekProtocol } from './arm-coc-ladder.engine';
import { flatPyramidFrom5Rm, flatPyramidStep } from './arm-flat-pyramid.engine';
import { planArmRegimen } from './arm-regimen.engine';
import { checkHumerusAxis } from './arm-humerus-axis.engine';
import { getMedley, simulateMedley, medleyRotationForWeek } from './arm-medley.engine';
import { buildForWeek, forGate } from './arm-for.engine';
import type { ArmBuilderInput } from './arm-types';

export interface ArmProResult {
  rationale: string[];
  warnings: string[];
  volumeMult: number;
  rirShift: number;
  replaceSideWithIso: boolean;
  replaceHeavyPronWithPulses: boolean;
  workMaxPatch: Record<string, number>;
  wafLine: string | null;
  supermatchLine: string | null;
  sparringLine: string | null;
  videoLine: string | null;
  cutLine: string | null;
  bilateralLine: string | null;
  legsAnchorSets: number;
  matchupLine: string | null;
  rfdLine: string | null;
  gripRpeLine: string | null;
  ladderLine: string | null;
  simLine: string | null;
  longevityLine: string | null;
  fuelLine: string | null;
  cnsLine: string | null;
  lrLine: string | null;
  iqLine: string | null;
  calendarLine: string | null;
  cycleLine: string | null;
  cocLine: string | null;
  pyramidLine: string | null;
  regimenLine: string | null;
  axisLine: string | null;
  medleyLine: string | null;
  forLine: string | null;
}

export function applyArmPro(input: ArmBuilderInput): ArmProResult {
  const rationale: string[] = [];
  const warnings: string[] = [];
  let volumeMult = 1;
  let rirShift = 0;
  let replaceSideWithIso = false;
  let replaceHeavyPronWithPulses = false;
  let workMaxPatch: Record<string, number> = {};
  let wafLine: string | null = null;
  let supermatchLine: string | null = null;
  let sparringLine: string | null = null;
  let videoLine: string | null = null;
  let cutLine: string | null = null;
  let bilateralLine: string | null = null;
  let matchupLine: string | null = null;
  let rfdLine: string | null = null;
  let gripRpeLine: string | null = null;
  let ladderLine: string | null = null;
  let simLine: string | null = null;
  let longevityLine: string | null = null;
  let fuelLine: string | null = null;
  let cnsLine: string | null = null;
  let lrLine: string | null = null;
  let iqLine: string | null = null;
  let calendarLine: string | null = null;
  let cycleLine: string | null = null;
  let cocLine: string | null = null;
  let pyramidLine: string | null = null;
  let regimenLine: string | null = null;
  let axisLine: string | null = null;
  let medleyLine: string | null = null;
  let forLine: string | null = null;

  // A. WAF-карточка (при наличии веса/возраста)
  try {
    if (input.bodyWeightKg != null || input.ageYears != null || input.arm) {
      const card = buildWafStartCard({
        sex: input.sex,
        ageYears: input.ageYears ?? 30,
        bodyWeightKg: input.bodyWeightKg ?? 80,
        arm: input.arm ?? 'both',
        para: (input.paraClass as never) ?? 'none',
        strapExpected: input.strapExpected,
      });
      wafLine = `WAF ${card.ageGroup} · кат. ${card.weightClass.label} кг · зачётов: ${card.entriesCount} (${card.arms.join('+')}) · ${card.weighInNote}`;
      rationale.push(wafLine);
      if (!card.weightClass.fits) warnings.push(`WAF: перевес ${Math.abs(card.weightClass.deltaKg).toFixed(1)} кг — см. весогонку.`);
      else if (card.weightClass.label !== 'Open' && card.weightClass.deltaKg < 1)
        warnings.push(`WAF: запас всего ${card.weightClass.deltaKg.toFixed(1)} кг до ${card.weightClass.label} — контроль веса.`);
    }
  } catch { /* WAF опционален */ }

  // B. Двусторонность
  try {
    if (input.leftKg != null || input.rightKg != null) {
      const b = planBilateralVolume({
        leftKg: input.leftKg,
        rightKg: input.rightKg,
        dominantArm: input.dominantArm,
        baseSets: 10,
        mrvSets: 16,
      });
      bilateralLine = `L/R: ${b.note} (слабая ${b.weakArm} ${b.weakSets} / сильная ${b.strongSets})`;
      rationale.push(bilateralLine);
      if (b.asymmetryPct != null && b.asymmetryPct >= 12) warnings.push(`Асимметрия ${b.asymmetryPct}% — добивка слабой руки.`);
    }
  } catch { /* опционально */ }

  // F. Бенчи → workMax (оценочно, не затирает явный workMax билдера)
  try {
    if (input.bench && Object.keys(input.bench).length > 0) {
      workMaxPatch = workMaxFromBenchmarks(input.bench);
      const keys = Object.keys(workMaxPatch);
      if (keys.length) rationale.push(`Бенчи → веса: ${keys.map((k) => `${k}=${workMaxPatch[k]}`).join(', ')}`);
    }
  } catch { /* опционально */ }

  // G. Дневник → авторегуляция
  try {
    if (input.diary && input.diary.length > 0) {
      const auto = autoregArmFromDiary(input.diary);
      volumeMult = Math.min(volumeMult, auto.volumeMult);
      rirShift = Math.max(rirShift, auto.rirShift);
      replaceSideWithIso = replaceSideWithIso || auto.replaceSideWithIso;
      replaceHeavyPronWithPulses = replaceHeavyPronWithPulses || auto.replaceHeavyPronWithPulses;
      rationale.push(`Дневник: ${auto.note}`);
      if (auto.volumeMult < 1) warnings.push(`Авторегуляция: объём ×${auto.volumeMult}, RIR+${auto.rirShift}.`);
      // TOP wave-4: CNS-автоподсчёт тяжёлых из дневника (2+ RPE≥8 → ×0.8)
      try {
        const cns = cnsFromDiary(input.diary);
        if (cns.note) {
          volumeMult = Math.min(volumeMult, cns.volumeMult);
          rationale.push(cns.note);
          warnings.push(`CNS: ${cns.heavyDays} тяжёлых за 7 дней — план ×${cns.volumeMult}.`);
          if (!cnsLine) cnsLine = cns.note;
        }
      } catch { /* опционально */ }
    }
  } catch { /* опционально */ }

  // C. Суперматч
  try {
    if (input.supermatch || (input.goal as string) === 'supermatch' || (input.goal as string) === 'endurance') {
      const sm = buildSupermatchPlan({ level: input.level, baseSets: 12 });
      supermatchLine = `Суперматч: ${sm.rounds.length} раундов, TUT ${sm.totalTimeUnderTensionSec}с — ${sm.note}`;
      rationale.push(supermatchLine);
    }
  } catch { /* опционально */ }

  // D. Ремень
  try {
    if (input.strapExpected) {
      const strap = buildStrapSession(input.level);
      rationale.push(`Ремень: ${strap.totalHolds} удержаний — ${strap.note}`);
    }
  } catch { /* опционально */ }

  // E. Спарринг-гейт
  try {
    if (input.sparring && input.sparring.intensityPct != null) {
      const sp = planSparring({
        intensityPct: input.sparring.intensityPct,
        level: input.level,
        partnerDeltaKg: input.sparring.partnerDeltaKg ?? 0,
        sessionsThisWeek: input.sparring.sessionsThisWeek ?? 0,
      });
      sparringLine = `Спарринг ${sp.intensityPct}%: ${sp.rounds}×${sp.roundSec}с, партнёр ${sp.partnerDeltaKg >= 0 ? '+' : ''}${sp.partnerDeltaKg} кг — ${sp.allowed ? 'допущен' : 'ЗАПРЕЩЁН'}`;
      rationale.push(sparringLine);
      if (!sp.allowed) warnings.push(...sp.warnings.map((w) => `Спарринг: ${w}`));
    }
  } catch { /* опционально */ }

  // H. Весогонка + календарь + ноги-якорь
  let legsAnchorSets = 0;
  try {
    if (input.competitionDateIso || input.targetWeightKg != null) {
      const weeksOut = weeksUntilStart(undefined, input.competitionDateIso);
      const phase = prepPhaseForWeeksOut(weeksOut);
      const bw = input.bodyWeightKg ?? 80;
      const cut = planWeightCut({ startKg: bw, targetKg: input.targetWeightKg ?? bw, weeksOut, sex: input.sex || 'male' });
      cutLine = `До старта ${weeksOut} нед (${phase}) · ${cut.note}`;
      rationale.push(cutLine);
      if (cut.status === 'too_fast') warnings.push(`Сгонка: ${cut.note}`);
      // тейпер-подсказка при близком старте
      if (phase === 'peak' || phase === 'taper') rationale.push('Близкий старт — держите side минимум, только техника+изометрия.');
    }
    // ноги-якорь всегда считаем (мини-блок дешёвый)
    const legs = legsAnchorBlock(input.level);
    legsAnchorSets = legs.reduce((s, e) => s + e.sets, 0);
  } catch { /* опционально */ }

  // I. Видео-трек
  try {
    if (input.trackCsv) {
      const pts = parseArmTrackCsv(input.trackCsv);
      const m = armPathMetrics(pts);
      const traj = classifyArmTrajectory(pts);
      if (m && traj) {
        videoLine = `Видео: ${m.points} точек, xLoop ${m.xLoop}, тип ${traj === 'inside_hook' ? 'хук (внутрь)' : traj === 'outside_toproll' ? 'топролл (наружу)' : 'пресс (прямо)'}`;
        rationale.push(videoLine);
      }
    }
  } catch { /* опционально */ }

  // J. Помост-подсказка для армлифтинга (план попыток по RT-цели из workMax)
  try {
    if ((input.discipline as string) === 'armlifting' && input.workMax) {
      const rt = (input.workMax as Record<string, number>)['grip_support'] ?? workMaxPatch['grip_support'];
      if (Number.isFinite(Number(rt)) && Number(rt) > 0) {
        const att = planAttempts(Number(rt));
        if (att.length === 3) rationale.push(`Помост RT: попытки ${att.join(' / ')} кг (90/96/102% цели).`);
      }
    }
  } catch { /* опционально */ }

  // TOP T1–T8: аддитивная связка (всё try/catch, вход — через as any чтобы не менять ArmBuilderInput)
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['oppStyle'] != null || ex['oppHand'] != null || ex['weightDeltaKg'] != null) {
      const mp = profileOpponent({
        myTechnique: String((input as { technique?: string }).technique ?? 'balanced'),
        oppStyle: ex['oppStyle'] as string,
        oppHand: ex['oppHand'] as string,
        weightDeltaKg: Number(ex['weightDeltaKg'] ?? 0),
        strapExpected: !!(input as { strapExpected?: boolean }).strapExpected,
      });
      matchupLine = `Матчап: ${mp.note}`;
      rationale.push(matchupLine);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['explosivePct'] != null || ex['rfd'] === true) {
      const rfd = buildRfdSession({
        explosivePct: Number(ex['explosivePct'] ?? NaN),
        fastPct: Number(ex['fastPct'] ?? NaN),
        slowIndex: Number(ex['slowIndex'] ?? NaN),
        level: String((input as { level?: string }).level ?? 'intermediate'),
      });
      rfdLine = `RFD: ${rfd.note}`;
      rationale.push(rfdLine);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['gripWeek'] != null || ex['gripPhase'] != null || ex['gripAuto'] === true) {
      const g = buildGripRpe({ week: Number(ex['gripWeek'] ?? 1), phase: ex['gripPhase'] as string });
      gripRpeLine = `Grip-RPE: ${g.note}${ex['gripAuto'] === true && ex['gripWeek'] == null && ex['gripPhase'] == null ? ' (авто-волна по неделям плана)' : ''}`;
      rationale.push(gripRpeLine);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['ladderFrom'] != null) {
      ladderLine = ladderAdvice(String(ex['ladderFrom']), Number(ex['ladderValue'] ?? 0), String((input as { sex?: string }).sex ?? 'male'));
      rationale.push(ladderLine);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['contestSim'] === true) {
      const sim = buildContestSimWeek({
        level: String((input as { level?: string }).level ?? 'intermediate'),
        discipline: String((input as { discipline?: string }).discipline ?? 'armwrestling'),
        strapExpected: !!(input as { strapExpected?: boolean }).strapExpected,
        foulIds: ex['foulIds'] as string[],
        targetKg: Number(ex['simTargetKg'] ?? NaN),
        supermatch: !!(input as { supermatch?: boolean }).supermatch,
      });
      simLine = sim.note;
      rationale.push(`Contest-sim: ${sim.note}`);
    }
  } catch { /* опционально */ }
  try {
    if ((input as { ageYears?: number }).ageYears != null && Number((input as { ageYears?: number }).ageYears) >= 40) {
      const lon = buildLongevityPlan({ ageYears: Number((input as { ageYears?: number }).ageYears) });
      longevityLine = lon.note;
      rationale.push(longevityLine);
      volumeMult = Math.min(volumeMult, lon.volumeMult);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['tableSession'] != null || ex['tendonFuel'] === true) {
      const f = buildTendonFuel({ bodyWeightKg: Number((input as { bodyWeightKg?: number }).bodyWeightKg ?? 80), tableSession: ex['tableSession'] !== false });
      fuelLine = f.note;
      rationale.push(fuelLine);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['cnsCheck'] === true) {
      const c = checkCnsGuard({
        heavyGripThisWeek: Number(ex['heavyGripThisWeek'] ?? 0),
        plannedHeavy: ex['plannedHeavy'] !== false,
        hoursSinceHeavyPull: Number(ex['hoursSinceHeavyPull'] ?? 72),
      });
      cnsLine = c.note;
      rationale.push(`CNS: ${c.note}`);
      volumeMult = Math.min(volumeMult, c.volumeMult);
      if (!c.allowed) warnings.push(`CNS: ${c.rules.join(' ')}`);
    }
  } catch { /* опционально */ }
  try {
    if ((input as { leftKg?: number }).leftKg != null || (input as { rightKg?: number }).rightKg != null) {
      const lr = planLrSplit({ leftKg: Number((input as { leftKg?: number }).leftKg), rightKg: Number((input as { rightKg?: number }).rightKg) });
      lrLine = lr.note;
      if (lr.asymmetryPct != null && lr.asymmetryPct >= 7) rationale.push(`L/R сплит: ${lr.note}`);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (Array.isArray(ex['bouts'])) {
      const iq = analyzeTableIq({ bouts: ex['bouts'] as never });
      iqLine = iq.note;
      rationale.push(`Table-IQ: ${iq.note}`);
      for (const l of iq.levers.slice(0, 1)) rationale.push(`Table-IQ рычаг: ${l}`);
    }
  } catch { /* опционально */ }
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['calStartIso'] != null) {
      const cal = buildArmCalendar({
        startIso: ex['calStartIso'] as string,
        priority: (ex['calPriority'] as string) ?? 'B',
        series: (ex['calSeries'] as string) ?? 'local',
        startKg: Number((input as { bodyWeightKg?: number }).bodyWeightKg ?? 0),
        targetKg: Number((input as { targetWeightKg?: number }).targetWeightKg ?? 0),
        sex: String((input as { sex?: string }).sex ?? 'male'),
      });
      calendarLine = cal.note;
      rationale.push(`Календарь: ${cal.note}`);
    }
  } catch { /* опционально */ }
  // CYCLES: именной цикл (библиотека) — строка + fit-предупреждение без согласия
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (typeof ex['cycleId'] === 'string' && ex['cycleId']) {
      const c = getArmCycle(String(ex['cycleId']));
      if (c) {
        const fit = fitCycleToWeeks(c.id, Number((input as { weeks?: number }).weeks || 8));
        cycleLine = `Цикл: ${c.name} (${fit.fit}) — ${c.rpe}. ${c.deloadRule}`;
        rationale.push(cycleLine);
        if (fit.needsConsent && !(ex as Record<string, unknown>)['cycleConsent']) warnings.push(`Цикл: ${fit.note}`);
      }
    }
  } catch { /* опционально */ }
  // CoC-лестница IronMind (при заданном рабочем уровне)
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (typeof ex['cocWorking'] === 'string' && ex['cocWorking']) {
      const t = planCocTriple(String(ex['cocWorking']));
      cocLine = `CoC: ${t.note}`;
      rationale.push(cocLine);
      try {
        const ph = String((input as { goal?: string }).goal || 'strength');
        const wp = cocWeekProtocol(ph === 'peaking' ? 'peaking' : ph === 'strength' ? 'intensification' : 'accumulation', String(ex['cocWorking']));
        rationale.push(`CoC-неделя: ${wp.sets} — ${wp.note}`);
      } catch { /* опционально */ }
    }
  } catch { /* опционально */ }
  // Flat pyramid Bompa (при явном включении)
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['flatPyramid'] === true) {
      const st = flatPyramidFrom5Rm(Number(ex['flatPyramidWeightKg'] || 40), 1);
      const adv = flatPyramidStep({ ...st, sets: 3 }, true);
      pyramidLine = `Flat pyramid: ${adv.prescription}. ${adv.note}`;
      rationale.push(pyramidLine);
    }
  } catch { /* опционально */ }
  // Режимы школ Larratt/Brzenk/Акимов
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['bloodflow'] === true || ex['heavySingles'] === true || ex['pumpkinArm'] != null || ex['neverFail'] === true || ex['brzenkMode'] === true || ex['akimovHook'] === true) {
      const r = planArmRegimen({
        bloodflow: ex['bloodflow'] === true,
        pumpkinArm: (ex['pumpkinArm'] === 'left' || ex['pumpkinArm'] === 'right' ? ex['pumpkinArm'] : null) as 'left' | 'right' | null,
        neverFail: ex['neverFail'] === true,
        heavySingles: ex['heavySingles'] === true,
        brzenkMode: ex['brzenkMode'] === true,
        akimovHook: ex['akimovHook'] === true,
        compPeriod: ex['compPeriod'] === true,
        level: String((input as { level?: string }).level ?? 'intermediate'),
      });
      volumeMult = Math.min(volumeMult, r.volumeMult);
      rirShift = Math.max(rirShift, r.rirShift);
      for (const l of r.lines) rationale.push(l);
      for (const wmsg of r.warnings) warnings.push(`Режим: ${wmsg}`);
      regimenLine = r.lines[0] || null;
    }
  } catch { /* опционально */ }
  // Humerus-axis 2026 (при явном чек-листе позиции)
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['axisCheck'] != null && typeof ex['axisCheck'] === 'object') {
      const a = checkHumerusAxis(ex['axisCheck'] as never);
      axisLine = `Ось: риск ${a.risk} (${a.score} флага). ${a.cues[0] || ''}`;
      rationale.push(axisLine);
      for (const wmsg of a.warnings) warnings.push(`Ось: ${wmsg}`);
    }
  } catch { /* опционально */ }
  // Медли ArmliftingUSA
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (typeof ex['medleyId'] === 'string' && ex['medleyId']) {
      const m = getMedley(String(ex['medleyId']));
      if (m) {
        const rot = medleyRotationForWeek(m.id, Number((input as { weeks?: number }).weeks || 1));
        medleyLine = `Медли: ${m.note} Ротация недели → ${rot}.`;
        rationale.push(medleyLine);
        void simulateMedley;
      }
    }
  } catch { /* опционально */ }
  // FOR-7 (гейт уровня/CNS)
  try {
    const ex = input as unknown as Record<string, unknown>;
    if (ex['forMode'] === true) {
      const g = forGate({ level: String((input as { level?: string }).level ?? 'intermediate') });
      const p = buildForWeek((ex['forSpecialization'] as never) || 'support');
      forLine = p.note;
      rationale.push(`FOR-7: ${p.note}`);
      rationale.push(`FOR rebound: ${p.rebound} ${p.retest}`);
      if (!g.allowed) for (const wmsg of g.warnings) warnings.push(`FOR: ${wmsg}`);
    }
  } catch { /* опционально */ }
  try {
    const w = buildArmWarmup(String((input as { discipline?: string }).discipline ?? 'heavy'));
    rationale.push(`Разминка: ${w.note}`);
  } catch { /* опционально */ }

  // F-добавка: radial/fingers напоминалка (сам пул правит билдер через ensureRadialFingers в FullArm)
  try {
    void ensureRadialFingers;
  } catch { /* noop */ }

  return {
    rationale,
    warnings,
    volumeMult: Math.round(volumeMult * 100) / 100,
    rirShift,
    replaceSideWithIso,
    replaceHeavyPronWithPulses,
    workMaxPatch,
    wafLine,
    supermatchLine,
    sparringLine,
    videoLine,
    cutLine,
    bilateralLine,
    legsAnchorSets,
    matchupLine,
    rfdLine,
    gripRpeLine,
    ladderLine,
    simLine,
    longevityLine,
    fuelLine,
    cnsLine,
    lrLine,
    iqLine,
    calendarLine,
    cycleLine,
    cocLine,
    pyramidLine,
    regimenLine,
    axisLine,
    medleyLine,
    forLine,
  };
}

// ── Структурированная PRO-сводка для тренера (JSON-экспорт, печать, UI) ──

export interface ArmProSummary {
  waf: { ageGroup: string; weightClass: string; entries: number; weighInNote: string } | null;
  bilateral: { asymmetryPct: number; weakArm: string; weakSets: number; strongSets: number } | null;
  cut: { weeksOut: number; phase: string; status: string; note: string } | null;
  supermatch: { rounds: number; tutSec: number } | null;
  sparring: { intensityPct: number; allowed: boolean; warnings: string[] } | null;
  attempts: { implement: string; attempts: number[]; wrPct: number } | null;
  video: { points: number; xLoop: number; trajectory: string } | null;
  autoreg: { volumeMult: number; rirShift: number; note: string } | null;
  cns: { heavyDays: number; volumeMult: number; note: string } | null;
}

/** Чистая сводка: те же движки, что в applyArmPro, но структурой (не строками). */
export function buildArmProSummary(input: ArmBuilderInput): ArmProSummary {
  const out: ArmProSummary = {
    waf: null,
    bilateral: null,
    cut: null,
    supermatch: null,
    sparring: null,
    attempts: null,
    video: null,
    autoreg: null,
    cns: null,
  };
  try {
    if (input.bodyWeightKg != null || input.ageYears != null || input.arm) {
      const card = buildWafStartCard({
        sex: input.sex,
        ageYears: input.ageYears ?? 30,
        bodyWeightKg: input.bodyWeightKg ?? 80,
        arm: input.arm ?? 'both',
        para: (input.paraClass as never) ?? 'none',
        strapExpected: input.strapExpected,
      });
      out.waf = { ageGroup: card.ageGroup, weightClass: card.weightClass.label, entries: card.entriesCount, weighInNote: card.weighInNote };
    }
  } catch { /* опционально */ }
  try {
    if (input.leftKg != null || input.rightKg != null) {
      const b = planBilateralVolume({ leftKg: input.leftKg, rightKg: input.rightKg, dominantArm: input.dominantArm, baseSets: 10, mrvSets: 16 });
      if (b.asymmetryPct != null && b.weakArm) out.bilateral = { asymmetryPct: b.asymmetryPct, weakArm: b.weakArm, weakSets: b.weakSets, strongSets: b.strongSets };
    }
  } catch { /* опционально */ }
  try {
    if (input.competitionDateIso || input.targetWeightKg != null) {
      const weeksOut = weeksUntilStart(undefined, input.competitionDateIso);
      const bw = input.bodyWeightKg ?? 80;
      const cut = planWeightCut({ startKg: bw, targetKg: input.targetWeightKg ?? bw, weeksOut, sex: input.sex || 'male' });
      out.cut = { weeksOut, phase: prepPhaseForWeeksOut(weeksOut), status: cut.status, note: cut.note };
    }
  } catch { /* опционально */ }
  try {
    if (input.supermatch || (input.goal as string) === 'supermatch' || (input.goal as string) === 'endurance') {
      const sm = buildSupermatchPlan({ level: input.level, baseSets: 12 });
      out.supermatch = { rounds: sm.rounds.length, tutSec: sm.totalTimeUnderTensionSec };
    }
  } catch { /* опционально */ }
  try {
    if (input.sparring && input.sparring.intensityPct != null) {
      const sp = planSparring({ intensityPct: input.sparring.intensityPct, level: input.level, partnerDeltaKg: input.sparring.partnerDeltaKg ?? 0, sessionsThisWeek: input.sparring.sessionsThisWeek ?? 0 });
      out.sparring = { intensityPct: sp.intensityPct, allowed: sp.allowed, warnings: sp.warnings };
    }
  } catch { /* опционально */ }
  try {
    if (input.trackCsv) {
      const pts = parseArmTrackCsv(input.trackCsv);
      const m = armPathMetrics(pts);
      const traj = classifyArmTrajectory(pts);
      if (m && traj) out.video = { points: m.points, xLoop: m.xLoop, trajectory: traj };
    }
  } catch { /* опционально */ }
  try {
    if (input.diary && input.diary.length > 0) {
      const auto = autoregArmFromDiary(input.diary);
      out.autoreg = { volumeMult: auto.volumeMult, rirShift: auto.rirShift, note: auto.note };
      const cns = cnsFromDiary(input.diary);
      if (cns.note) out.cns = { heavyDays: cns.heavyDays, volumeMult: cns.volumeMult, note: cns.note };
    }
  } catch { /* опционально */ }
  try {
    if ((input.discipline as string) === 'armlifting') {
      const merged: Record<string, number> = { ...workMaxFromBenchmarks(input.bench || {}), ...(input.workMax || {}) };
      const rt = merged['grip_support'];
      if (Number.isFinite(Number(rt)) && Number(rt) > 0) {
        const att = planAttempts(Number(rt));
        if (att.length === 3) {
          const wr = platformWrFor('rolling_thunder', input.sex || 'male');
          out.attempts = { implement: 'rolling_thunder', attempts: att, wrPct: Math.round((Number(rt) / wr) * 1000) / 10 };
        }
      }
    }
  } catch { /* опционально */ }
  return out;
}
