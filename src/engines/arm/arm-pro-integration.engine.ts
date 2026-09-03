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
