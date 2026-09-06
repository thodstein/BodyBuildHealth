/**
 * ArmAutoConstructor.tsx — PRO-конструктор армрестлинг/армлифтинг.
 * Изолирован, как BbAutoConstructor, но для arm-движка.
 * 6 шагов: params → grip → split → plan → quality → export.
 * Редизайн на arm-design-system; логика, строки и aria 1-в-1.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { buildArmPlan } from '../../../engines/arm/arm-builder.engine';
import { finalizeArmPlan } from '../../../engines/arm/arm-finalize.engine';
import { rankArmSplits, selectBestArmSplit } from '../../../engines/arm/arm-selector.engine';
import { buildArmSchedule } from '../../../engines/arm/arm-specialization.engine';
import { validateArmPlan } from '../../../engines/arm/arm-validator.engine';
import { calcArmMetrics } from '../../../engines/arm/arm-metrics.engine';
import { buildArmReport } from '../../../engines/arm/arm-report.engine';
import { buildArmPrintHtml, buildArmIcs } from '../../../engines/arm/arm-export.engine';
import { ARM_SPLIT_PATTERNS } from '../../../engines/arm/arm-split-patterns';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';
import { injectArmCorrections } from '../../../engines/arm/arm-diagnostics-injection.engine';
import { buildWafStartCard } from '../../../engines/arm/arm-waf.engine';
import { PLATFORM_WR, planAttempts, platformWrFor } from '../../../engines/arm/arm-platform.engine';
import { WAF_FOULS, WAF_FOULS_OUT_AFTER } from '../../../engines/arm/arm-start-strap.engine';
import { buildSupermatchPlan } from '../../../engines/arm/arm-supermatch.engine';
import { profileOpponent } from '../../../engines/arm/arm-matchup.engine';
import { ladderAdvice } from '../../../engines/arm/arm-implement-ladder.engine';
import { buildArmCalendar, superSeriesYear } from '../../../engines/arm/arm-calendar.engine';
import { buildContestSimWeek } from '../../../engines/arm/arm-contest-sim.engine';
import { buildGripRpe } from '../../../engines/arm/arm-grip-rpe.engine';
import { ARM_CYCLE_LIBRARY, fitCycleToWeeks } from '../../../engines/arm/arm-cycle-library.engine';
import { ARM_MEDLEYS, getMedley } from '../../../engines/arm/arm-medley.engine';
import { buildArmProSummary } from '../../../engines/arm/arm-pro-integration.engine';
import { planBilateralVolume } from '../../../engines/arm/arm-bilateral.engine';
import { planWeightCut, weeksUntilStart } from '../../../engines/arm/arm-competition-prep.engine';
import { loadForceTrials, buildWeeklyStats, fatigueTrend, forceTrend } from '../../../engines/arm/arm-force-history.store';
import type { ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';
import { ArmTechniqueCard } from './ArmTechniqueCard';
import { ArmGripCard } from './ArmGripCard';
import { ArmHeatmap } from './ArmHeatmap';
import { AdRoot, AdHead, AdSteps, AdCard, AdSec, AdGrid, AdField, AdCheck, AdChip, AdBtn, AdBanner, type AdStepDef } from './arm-design-system';
import { useDataLink } from '../../../core/data-link';
import { subscribePlannerApply, getPlannerApply } from './planner-bridge';

type Step = 'params'|'grip'|'split'|'plan'|'quality'|'weights';

const LEVELS = ['beginner','intermediate','advanced','enhanced'] as const;
const GOALS = [
  { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Масса предплечья' },
  { id: 'peaking', label: 'Пик к старту' },
  { id: 'endurance', label: 'Выносливость' },
  { id: 'maintenance', label: 'Поддержание' },
] as const;
const TECHNIQUES = [
  { id: 'balanced', label: 'Сбалансировано' },
  { id: 'hook', label: 'Хук' },
  { id: 'toproll', label: 'Топролл' },
  { id: 'press', label: 'Пресс' },
] as const;
const DISCIPLINES = [
  { id: 'armwrestling', label: 'Армрестлинг' },
  { id: 'armlifting', label: 'Армлифтинг' },
  { id: 'hybrid', label: 'Гибрид' },
] as const;
const GRIP_FOCI = [
  { id: 'support', label: 'Поддержка (RT/Axle)' },
  { id: 'pinch', label: 'Щипок (Saxon/Hub)' },
  { id: 'crush', label: 'Дробление (CoC)' },
  { id: 'hub', label: 'Hub' },
] as const;

const STEP_DEFS: AdStepDef[] = [
  { id: 'params', label: '🎛 Параметры' },
  { id: 'grip', label: '✊ Хват' },
  { id: 'split', label: '🗓 Сплит' },
  { id: 'plan', label: '📋 План' },
  { id: 'quality', label: '📊 Качество' },
  { id: 'weights', label: '🏋️ Веса' },
];

export function ArmAutoConstructor() {
  const [step, setStep] = useState<Step>('params');
  const [discipline, setDiscipline] = useState<string>('armwrestling');
  const [technique, setTechnique] = useState<string>('balanced');
  const [gripFocus, setGripFocus] = useState<string>('support');
  const [level, setLevel] = useState<string>('intermediate');
  const [goal, setGoal] = useState<string>('strength');
  const [weeks, setWeeks] = useState<number>(8);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [diagWeakPoints, setDiagWeakPoints] = useState<ArmWeakPoint[]>([]);
  const [focusGroup, setFocusGroup] = useState<string>('');
  const [specialization, setSpecialization] = useState<boolean>(false);
  const [patternId, setPatternId] = useState<string>('');
  const [builtPlan, setBuiltPlan] = useState<any>(null);
  const [weekSel, setWeekSel] = useState<number>(1);
  const [msg, setMsg] = useState<string>('');
  const linked: any = (() => { try { return (useDataLink as any)(); } catch { return {}; } })();
  const [pedDoses, setPedDoses] = useState<Record<string, number>>({});
  const [courseIntensity, setCourseIntensity] = useState<'mild'|'moderate'|'heavy'>('moderate');
  const [showPed, setShowPed] = useState(false);
  const [workMaxEdit, setWorkMaxEdit] = useState<Record<string, string>>({});
  // PRO A–J: старт/руки/бенчи/дневник/спарринг (всё опционально)
  const [proBw, setProBw] = useState<string>('');
  const [proAge, setProAge] = useState<string>('');
  const [proArm, setProArm] = useState<string>('both');
  const [proDate, setProDate] = useState<string>('');
  const [proTargetW, setProTargetW] = useState<string>('');
  const [proLeft, setProLeft] = useState<string>('');
  const [proRight, setProRight] = useState<string>('');
  const [proBenchRt, setProBenchRt] = useState<string>('');
  const [proBenchWristLb, setProBenchWristLb] = useState<string>('');
  const [proBenchPron, setProBenchPron] = useState<string>('');
  const [proBenchSide, setProBenchSide] = useState<string>('');
  const [proSrpe, setProSrpe] = useState<string>('');
  const [proElbow, setProElbow] = useState<string>('');
  const [proSpar, setProSpar] = useState<string>('off');
  const [proSparDelta, setProSparDelta] = useState<string>('0');
  const [proSupermatch, setProSupermatch] = useState<boolean>(false);
  const [proStrap, setProStrap] = useState<boolean>(false);
  const [proPlatImpl, setProPlatImpl] = useState<string>('rolling_thunder');
  const [proPlatTarget, setProPlatTarget] = useState<string>('');
  // TOP T1–T8: матчап/скорость/лестница/sim/календарь (всё опционально)
  const [topOpp, setTopOpp] = useState<string>('unknown');
  const [topOppHand, setTopOppHand] = useState<string>('unknown');
  const [topWD, setTopWD] = useState<string>('');
  const [topRfd, setTopRfd] = useState<boolean>(false);
  const [topLadder, setTopLadder] = useState<string>('');
  const [topLadderVal, setTopLadderVal] = useState<string>('');
  const [topSim, setTopSim] = useState<boolean>(false);
  const [topCalPrio, setTopCalPrio] = useState<string>('B');
  const [topCalSeries, setTopCalSeries] = useState<string>('local');
  const [topGripWeek, setTopGripWeek] = useState<string>('');
  const [topGripPhase, setTopGripPhase] = useState<string>('auto');
  const [topHeavy, setTopHeavy] = useState<string>('');
  const [topPullH, setTopPullH] = useState<string>('');
  const [topContinuity, setTopContinuity] = useState<boolean>(false);
  const [topGripAuto, setTopGripAuto] = useState<boolean>(false);
  const [topExpl, setTopExpl] = useState<string>('');
  // CYCLES (интернет-библиотека, всё опционально — пусто = как раньше)
  const [cycId, setCycId] = useState<string>('');
  const [cycConsent, setCycConsent] = useState<boolean>(false);
  const [cycCorr, setCycCorr] = useState<string>('');
  const [cycCoc, setCycCoc] = useState<string>('');
  const [cycFlat, setCycFlat] = useState<boolean>(false);
  const [cycBlood, setCycBlood] = useState<boolean>(false);
  const [cycNever, setCycNever] = useState<boolean>(false);
  const [cycSingles, setCycSingles] = useState<boolean>(false);
  const [cycPumpkin, setCycPumpkin] = useState<string>('');
  const [cycBrzenk, setCycBrzenk] = useState<boolean>(false);
  const [cycAkimov, setCycAkimov] = useState<boolean>(false);
  const [cycComp, setCycComp] = useState<boolean>(false);
  const [cycMedley, setCycMedley] = useState<string>('');
  const [cycFor, setCycFor] = useState<boolean>(false);
  const [cycForSpec, setCycForSpec] = useState<string>('support');
  // R8: ось humerus-2026 + попытки медли (опционально, пусто = как раньше)
  const [cycAxisOn, setCycAxisOn] = useState<boolean>(false);
  const [axTrunk, setAxTrunk] = useState<boolean>(false);
  const [axMisalign, setAxMisalign] = useState<boolean>(false);
  const [axBehind, setAxBehind] = useState<boolean>(false);
  const [axDorsal, setAxDorsal] = useState<boolean>(false);
  const [axCold, setAxCold] = useState<boolean>(false);
  const [axDefense, setAxDefense] = useState<boolean>(false);
  const [axSideMax, setAxSideMax] = useState<boolean>(false);
  const [medAttKg, setMedAttKg] = useState<string[]>(['', '', '']);
  const [medAttOk, setMedAttOk] = useState<boolean[]>([true, true, true]);

  // TOP wave-13: автоподстановка веса/возраста из профиля (только пустые поля)
  useEffect(() => {
    try {
      const p: any = linked?.profile ?? {};
      const per: any = p?.settings?.personal ?? p?.personal ?? {};
      if (per && typeof per === 'object') {
        if (Number(per.weight) > 0) setProBw((prev) => (prev === '' ? String(per.weight) : prev));
        if (Number(per.age) > 0) setProAge((prev) => (prev === '' ? String(per.age) : prev));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workMax = useMemo(() => {
    try {
      const pm: any = linked?.profile?.personal ?? {};
      const wm: Record<string, number> = {};
      if (pm.weight) wm['default'] = Number(pm.weight) || 50;
      // editable overrides
      for (const [k,v] of Object.entries(workMaxEdit)) {
        const n = parseFloat(v);
        if (Number.isFinite(n) && n>0) wm[k] = n;
      }
      return wm;
    } catch { return {}; }
  }, [linked, workMaxEdit]);

  // Приём из хаба диагностики (Интеллект → Арм-диагностика → Применить в Арм-конструктор) — PRO MAX v3 (12 мёртвых точек)
  useEffect(() => {
    const apply = (payload: any) => {
      if (!payload || payload.kind !== 'weakpoints') return;
      const groups: string[] | undefined = payload.data?.groups;
      const wp: string[] | undefined = payload.data?.armWeakPoints;
      let appliedWeak: string[] | null = null;
      if (Array.isArray(groups) && groups.length > 0) {
        appliedWeak = groups.slice(0, 2).map((s: string) => String(s).toLowerCase());
        setWeakPoints(appliedWeak);
        setSpecialization(true);
        setStep('params');
        flash(`↩ Из диагностики: ${groups.join(', ')}`);
      }
      if (Array.isArray(wp) && wp.length > 0) {
        const clean = (wp as string[]).slice(0,3) as ArmWeakPoint[];
        setDiagWeakPoints(clean);
        setSpecialization(true);
        setStep('params');
        flash(`↩ Мёртвые точки: ${clean.join(', ')}`);
      } else if (Array.isArray(payload.data?.armBiomechCards) && payload.data.armBiomechCards.length) {
        const fromCards = (payload.data.armBiomechCards as any[]).map((c:any)=> String(c.weakPoint)).slice(0,3) as ArmWeakPoint[];
        if (fromCards.length) setDiagWeakPoints(fromCards);
      }
      // dynamicWeak fallback if groups empty but armDynamic present
      if ((!appliedWeak || appliedWeak.length===0) && payload.data?.armDynamic) {
        try {
          const dyn = payload.data.armDynamic;
          const weak: string[] = [];
          if (dyn?.metrics?.finger_flex && dyn.metrics.finger_flex.f100 < 20) weak.push('risers');
          if (dyn?.metrics?.hammer && dyn.metrics.hammer.ftIndex < 30) weak.push('brachialis');
          if (dyn?.metrics?.hook && dyn.metrics.hook.fMax < 30) weak.push('supinators');
          if (dyn?.metrics?.cup && dyn.metrics.cup.f500 < 25) weak.push('wrist_flexors');
          if (weak.length) { setWeakPoints(weak.slice(0,2)); setSpecialization(true); flash(`↩ Динамика: ${weak.slice(0,2).join(', ')}`); }
        } catch {}
      }
      const tech = payload.data?.armTechnique;
      if (tech) setTechnique(String(tech));
      // TOP из хаба: матчап + Table-IQ (аддитивно)
      try {
        const mu = payload.data?.armMatchup;
        if (mu && typeof mu === 'object') {
          if (mu.oppStyle) setTopOpp(String(mu.oppStyle));
          if (mu.oppHand) setTopOppHand(String(mu.oppHand));
          if (Number.isFinite(Number(mu.weightDeltaKg)) && Number(mu.weightDeltaKg) !== 0) setTopWD(String(mu.weightDeltaKg));
          flash('↩ Матчап из диагностики применён');
        }
        // TOP wave-13: профиль хаба (L/R, вес, RT) + динамика → RFD
        try {
          const ap = payload.data?.armProfile;
          if (ap && typeof ap === 'object') {
            if (Number(ap.leftKg) > 0) setProLeft(String(ap.leftKg));
            if (Number(ap.rightKg) > 0) setProRight(String(ap.rightKg));
            if (Number(ap.bwKg) > 0) setProBw(String(ap.bwKg));
            if (Number(ap.rtKg) > 0) setProBenchRt(String(ap.rtKg));
          }
          const ar = payload.data?.armRfd;
          if (ar && Number.isFinite(Number(ar.explosivePct)) && Number(ar.explosivePct) > 0) {
            setTopExpl(String(ar.explosivePct));
            setTopRfd(true);
          }
        } catch {}
        const bouts = payload.data?.armBouts;
        if (Array.isArray(bouts) && bouts.length) {
          try { localStorage.setItem('he_arm_table_iq', JSON.stringify(bouts.slice(0, 60))); } catch {}
          flash(`↩ Table-IQ: ${bouts.length} схваток из диагностики`);
        }
      } catch {}
      const bench = payload.data?.armBench;
      if (bench?.level) {
        const map: Record<string,string> = { beginner:'beginner', intermediate:'intermediate', advanced:'advanced', competitive:'advanced', elite:'enhanced' };
        const lvl = map[String(bench.level)] || 'intermediate';
        setLevel(lvl);
        try { localStorage.setItem('he_arm_last_bench_level', bench.level); } catch {}
      }
      // сохраняем диагностику для печати — механизм-ориентированная + 12 точек
      try {
        const diagSnap: any = {
          benchLevel: bench?.level,
          armWeakPoints: payload.data?.armWeakPoints,
          armBiomechCards: payload.data?.armBiomechCards,
          armCorrections: payload.data?.armCorrections,
          armScoring: payload.data?.armScoring,
          armDynamic: payload.data?.armDynamic,
          armAngles: payload.data?.armAngles,
          armForce: payload.data?.armForce,
          findings: payload.data?.armFindings,
          humerusWarnings: payload.data?.armHumerus,
          balanceWarnings: payload.data?.armBalance,
          asymmetryPct: payload.data?.armAsymmetry,
          info: payload.data?.armInfo,
        };
        localStorage.setItem('he_arm_last_diagnostics', JSON.stringify(diagSnap));
        if (payload.data?.armWeakPoints) localStorage.setItem('he_arm_last_weakpoints', JSON.stringify(payload.data.armWeakPoints));
      } catch {}
    };
    // начальный снимок (если хаб уже отправил до монтирования)
    try {
      const cur = getPlannerApply();
      if (cur) apply(cur);
    } catch {}
    const unsub = subscribePlannerApply((p) => { try { apply(p); } catch {} });
    return () => { try { unsub(); } catch {} };
  }, []);

  const ranked = useMemo(() => {
    // R5: при выбранном именном цикле сплиты ранжируются по ЕГО дням/нед —
    // иначе валидатор потом честно пожалуется на расхождение частоты.
    // Ручной daysPerWeek при этом не затирается (только ранжирование).
    let effDays = daysPerWeek;
    try {
      if (cycId) {
        const c = ARM_CYCLE_LIBRARY.find((x) => x.id === cycId);
        if (c && c.daysPerWeek > 0) effDays = c.daysPerWeek;
      }
    } catch { effDays = daysPerWeek; }
    return rankArmSplits({ level, goal: goal as any, technique, discipline, daysPerWeek: effDays, gripFocus, weakPoints, specialization });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, goal, technique, discipline, daysPerWeek, gripFocus, weakPoints, specialization, cycId]);

  const best = useMemo(() => ranked[0]?.pattern, [ranked]);

  const specPreview = useMemo(() => {
    return buildArmSchedule({ focusGroup: focusGroup || undefined, weakPoints, specialization, totalWeeks: weeks });
  }, [focusGroup, weakPoints, specialization, weeks]);

  const flash = (t: string) => { setMsg(t); setTimeout(()=>setMsg(''), 2600); };

  const handleBuild = () => {
    const pid = patternId || best?.id || ARM_SPLIT_PATTERNS[0].id;
    try {
      const recovery: any = (() => {
        try {
          const p: any = linked?.profile ?? {};
          const lifestyle: any = p.lifestyle ?? p.personal ?? {};
          const per: any = p?.settings?.personal ?? p?.personal ?? {};
          return {
            bodyFat: p.personal?.bodyFat ?? p.personal?.bodyFatPct,
            leanMass: p.personal?.leanMass,
            hrvMs: lifestyle?.morningHRV ?? lifestyle?.hrvMs,
            sleepHours: lifestyle?.sleepHours,
            stressLevel: lifestyle?.stressLevel,
            // TOP wave-14: fallback веса/возраста из профиля, если стор подгрузился после mount
            profileWeight: Number(per?.weight) > 0 ? Number(per.weight) : undefined,
            profileAge: Number(per?.age) > 0 ? Number(per.age) : undefined,
          };
        } catch { return {}; }
      })();
      let plan: any = buildArmPlan({
        discipline: discipline as any,
        patternId: pid,
        level,
        goal: goal as any,
        technique: technique as any,
        weeks,
        gripFocus: gripFocus as any,
        weakPoints,
        focusGroup: focusGroup || undefined,
        specialization,
        workMax,
        pedDoses: Object.keys(pedDoses).length ? pedDoses : undefined,
        courseIntensity,
        bodyFat: recovery.bodyFat,
        leanMass: recovery.leanMass,
        hrvMs: recovery.hrvMs,
        sleepHours: recovery.sleepHours,
        stressLevel: recovery.stressLevel,
        // PRO A–J (пустые строки = не задано; вес/возраст добираются из профиля)
        bodyWeightKg: parseFloat(proBw) > 0 ? parseFloat(proBw) : (recovery as any).bodyWeightKg ?? (recovery as any).profileWeight,
        ageYears: parseFloat(proAge) > 0 ? parseFloat(proAge) : (recovery as any).profileAge,
        arm: (proArm === 'left' || proArm === 'right' ? proArm : 'both') as any,
        leftKg: parseFloat(proLeft) > 0 ? parseFloat(proLeft) : undefined,
        rightKg: parseFloat(proRight) > 0 ? parseFloat(proRight) : undefined,
        competitionDateIso: proDate || undefined,
        targetWeightKg: parseFloat(proTargetW) > 0 ? parseFloat(proTargetW) : undefined,
        supermatch: proSupermatch || undefined,
        strapExpected: proStrap || undefined,
        sparring: proSpar === 'off' ? undefined : { intensityPct: Number(proSpar) as any, partnerDeltaKg: parseFloat(proSparDelta) || 0 },
        diary: (parseFloat(proSrpe) > 0 || parseFloat(proElbow) > 0)
          ? [{ dateIso: new Date().toISOString().slice(0, 10), srpe: parseFloat(proSrpe) || undefined, elbowPain: parseFloat(proElbow) || undefined }]
          : undefined,
        bench: (parseFloat(proBenchRt) > 0 || parseFloat(proBenchWristLb) > 0 || parseFloat(proBenchPron) > 0 || parseFloat(proBenchSide) > 0)
          ? { rtKg: parseFloat(proBenchRt) || undefined, wristCurlLb: parseFloat(proBenchWristLb) || undefined, pronHoldSec: parseFloat(proBenchPron) || undefined, sideKg: parseFloat(proBenchSide) || undefined }
          : undefined,
        // TOP T1–T8 (не задано = выключено, план как раньше)
        oppStyle: topOpp !== 'unknown' ? topOpp : undefined,
        oppHand: topOppHand !== 'unknown' ? topOppHand : undefined,
        weightDeltaKg: parseFloat(topWD) !== 0 && Number.isFinite(parseFloat(topWD)) ? parseFloat(topWD) : undefined,
        rfd: topRfd || undefined,
        explosivePct: parseFloat(topExpl) > 0 ? parseFloat(topExpl) : undefined,
        gripAuto: topGripAuto || undefined,
        gripWeek: parseInt(topGripWeek) > 0 ? parseInt(topGripWeek) : undefined,
        gripPhase: topGripPhase !== 'auto' ? topGripPhase : undefined,
        ladderFrom: topLadder || undefined,
        ladderValue: parseFloat(topLadderVal) > 0 ? parseFloat(topLadderVal) : undefined,
        contestSim: topSim || undefined,
        // CYCLES (пусто/выкл = дефолтный путь, план как раньше)
        cycleId: cycId || undefined,
        cycleConsent: cycConsent || undefined,
        correctionPct: parseFloat(cycCorr) >= 0 && parseFloat(cycCorr) <= 5 ? parseFloat(cycCorr) : undefined,
        cocWorking: cycCoc || undefined,
        flatPyramid: cycFlat || undefined,
        flatPyramidWeightKg: cycFlat && parseFloat(topLadderVal) > 0 ? parseFloat(topLadderVal) : undefined,
        bloodflow: cycBlood || undefined,
        neverFail: cycNever || undefined,
        heavySingles: cycSingles || undefined,
        pumpkinArm: (cycPumpkin === 'left' || cycPumpkin === 'right' ? cycPumpkin : undefined) as any,
        brzenkMode: cycBrzenk || undefined,
        akimovHook: cycAkimov || undefined,
        compPeriod: cycAkimov && cycComp ? true : undefined,
        medleyId: cycMedley || undefined,
        forMode: cycFor || undefined,
        forSpecialization: cycFor ? (cycForSpec as any) : undefined,
        // R8: ось и попытки — только при явном вводе, иначе движок их не видит
        axisCheck: cycAxisOn ? {
          ...(axTrunk ? { trunkRotatedTowardAttack: true } : {}),
          ...(axMisalign ? { wristElbowShoulderAligned: false } : {}),
          ...(axBehind ? { wristBehindShoulder: true } : {}),
          ...(axDorsal ? { wristExtendedDorsally: true } : {}),
          ...(axCold ? { coldNoWarmup: true } : {}),
          ...(axDefense ? { fightingFromDefense: true } : {}),
          ...(axSideMax ? { sideMaxAttempt: true } : {}),
        } : undefined,
        medleyAttempts: cycMedley ? medAttKg.map((kg, i) => ({ eventIdx: i, weightKg: parseFloat(kg) || 0, success: medAttOk[i] !== false })).filter((a) => a.weightKg > 0) : undefined,
        tableSession: (discipline as string) === 'armwrestling' ? true : undefined,
        tendonFuel: (discipline as string) === 'armwrestling' ? true : undefined,
        calStartIso: proDate || undefined,
        calPriority: topCalPrio,
        calSeries: topCalSeries,
        cnsCheck: topHeavy !== '' || topPullH !== '' ? true : undefined,
        heavyGripThisWeek: parseInt(topHeavy) >= 0 ? parseInt(topHeavy) : undefined,
        hoursSinceHeavyPull: parseFloat(topPullH) > 0 ? parseFloat(topPullH) : undefined,
        previousPlan: topContinuity ? ((): any => { try {
          const raw = localStorage.getItem('he_arm_last_plan');
          if (!raw) return undefined;
          const parsed = JSON.parse(raw);
          const weeks = (parsed as any)?.plan?.weeks || (parsed as any)?.weeks;
          if (!Array.isArray(weeks) || !weeks.length) return undefined;
          return (parsed as any)?.plan || parsed;
        } catch { return undefined; } })() : undefined,
        bouts: (()=>{ try { const raw = localStorage.getItem('he_arm_table_iq'); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr.slice(0, 60); } } catch {} return undefined; })(),
      });
      plan = finalizeArmPlan(plan, { level });
      // PRO инъекция 12 мёртвых точек (если пришли из хаба) — parity с TA
      try {
        const toInject: ArmWeakPoint[] = diagWeakPoints.length ? diagWeakPoints : (()=>{ try{ const raw=localStorage.getItem('he_arm_last_weakpoints'); if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr) && arr.length) return arr as ArmWeakPoint[]; } } catch{} return []; })();
        if (toInject.length) {
          const inj = injectArmCorrections(plan, toInject as ArmWeakPoint[], { level, workMax });
          plan = inj.plan;
          if (inj.injected>0) plan.rationale = [...(plan.rationale||[]), `Инъекция мёртвых точек: ${inj.notes.join(' · ')}`];
        }
      } catch {}
      const v = validateArmPlan(plan, level);
      plan.validation = v;
      plan.report = buildArmReport(plan);
      plan.metrics = calcArmMetrics(plan);
      setBuiltPlan(plan);
      try { localStorage.setItem('he_arm_last_plan', JSON.stringify(plan)); } catch {}
      setWeekSel(1);
      setStep('plan');
      const injInfo = diagWeakPoints.length ? ` + ${diagWeakPoints.join(', ')} инъекция` : '';
      flash(`✅ План собран: ${plan.pattern.name}, ${plan.weeks.length} нед${injInfo}`);
    } catch (e: any) {
      flash(`❌ Ошибка: ${e?.message || e}`);
    }
  };

  const toggleWeak = (m: string) => {
    setWeakPoints(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev, m].slice(0,2));
  };

  const curWeek = builtPlan?.weeks?.find((w:any)=>w.week===weekSel) || builtPlan?.weeks?.[0];

  return (
    <AdRoot rootClass="train-arm" maxWidth={980}>
      <AdHead
        icon="🤝"
        title="Арм-конструктор PRO"
        sub="Армрестлинг (стол: hook/toproll/press, РУ/РА, table ≥50%) + армлифтинг (хват: support/pinch/crush). Периодизация 3/2/1 (Кузнецов), tendon-cap, humerus-guard."
        side={best ? (<><div>{best.name}</div><div className="ad-muted">{ranked[0]?.score ?? 0} баллов</div></>) : '—'}
      />

      <AdSteps steps={STEP_DEFS} active={step} onSelect={(id) => setStep(id as Step)} hook="steps" />

      {msg && <div className="ad-toast" data-arm="msg">{msg}</div>}

      {step === 'params' && (
        <AdCard>
          <AdSec title="🎛 Параметры">
            <AdGrid cols="2">
              <AdField label="Дисциплина">
                <select value={discipline} onChange={e=>setDiscipline(e.target.value)}>
                  {DISCIPLINES.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </AdField>
              <AdField label="Техника (стол)">
                <select value={technique} onChange={e=>setTechnique(e.target.value)}>
                  {TECHNIQUES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </AdField>
              <AdField label="Уровень">
                <select value={level} onChange={e=>setLevel(e.target.value)}>
                  <option value="beginner">Новичок</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option><option value="enhanced">Enhanced</option>
                </select>
              </AdField>
              <AdField label="Цель">
                <select value={goal} onChange={e=>setGoal(e.target.value)}>
                  {GOALS.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </AdField>
              <AdField label="Недель">
                <input type="number" min={2} max={52} value={weeks} onChange={e=>setWeeks(Math.max(2,Math.min(52, parseInt(e.target.value)||8)))} />
              </AdField>
              <AdField label="Дней/нед">
                <input type="number" min={2} max={6} value={daysPerWeek} onChange={e=>setDaysPerWeek(Math.max(2,Math.min(6, parseInt(e.target.value)||4)))} />
              </AdField>
            </AdGrid>
          </AdSec>

          {discipline !== 'armwrestling' && (
            <AdSec title="Хват-фокус">
              <div className="ad-row">
                {GRIP_FOCI.map(g=> (
                  <AdChip key={g.id} active={gripFocus===g.id} onClick={()=>setGripFocus(g.id)}>{g.label}</AdChip>
                ))}
              </div>
            </AdSec>
          )}

          <AdSec title="Слабые зоны (1–2, специализация ×1.3) — мышцы">
            <div className="ad-row">
              {['wrist_flexors','pronators','supinators','brachialis','risers','grip_support','grip_pinch','side_pressure','back_pressure'].map(m=> (
                <AdChip key={m} active={weakPoints.includes(m)} onClick={()=>toggleWeak(m)}>{ARM_MUSCLE_RU[m] || m}</AdChip>
              ))}
            </div>
            <AdCheck checked={specialization} onChange={setSpecialization} label="Специализация (блок 6 нед + баланс)" />
            {specialization && <span className="ad-tip">{specPreview.rationale}</span>}
          </AdSec>
          {diagWeakPoints.length>0 && (
            <AdBanner tone="warn">
              <b>🎯 Мёртвые точки из диагностики (инъекция 3× @% в план)</b>
              <div className="ad-row">
                {diagWeakPoints.map(wp=> (
                  <span key={wp} className="ad-tag">{wp}</span>
                ))}
              </div>
              <div className="ad-row">
                <AdBtn variant="dark" onClick={()=>{ setDiagWeakPoints([]); try{ localStorage.removeItem('he_arm_last_weakpoints'); } catch{} }}>✕ Сбросить мёртвые точки</AdBtn>
                <span className="ad-muted">Инъекция: per-day dedup, budget 85, humerus guard</span>
              </div>
            </AdBanner>
          )}

          <AdSec title="💉 На курсе (PED)" hint="TendonCap 1.5× (сухожилия медленнее), recovery × lab × nutrition уже в бюджете.">
            <AdCheck checked={showPed} onChange={setShowPed} label="💉 На курсе (PED)" />
            {showPed && (
              <>
                <AdField label="Интенсивность курса">
                  <select value={courseIntensity} onChange={e=>setCourseIntensity(e.target.value as any)}>
                    <option value="mild">Мягкий</option><option value="moderate">Средний</option><option value="heavy">Тяжёлый</option>
                  </select>
                </AdField>
                <AdGrid cols="2">
                  {[
                    ['test_e','Тест энантат мг/нед'],
                    ['tren_a','Тренболон мг/нед'],
                    ['bold_u','Болденон мг/нед'],
                  ].map(([k,label])=> (
                    <AdField key={k} label={label}>
                      <input
                        type="number"
                        value={pedDoses[k] ?? ''}
                        onChange={e=>{
                          const v = parseFloat(e.target.value);
                          setPedDoses(prev=> {
                            const n={...prev};
                            if (Number.isFinite(v) && v>0) n[k]=v; else delete n[k];
                            return n;
                          });
                        }}
                        placeholder="0"
                      />
                    </AdField>
                  ))}
                </AdGrid>
              </>
            )}
          </AdSec>

          <div>
            <ArmTechniqueCard onApplyWeak={(ws)=>setWeakPoints(ws.slice(0,2))} />
          </div>

          <AdSec title="🏋️ Рабочие максимумы (для прогрессии веса)" hint="Веса теперь используются в плане (вес = workMax × %; PRO: тяж 82%, техника 60%, памп 68%).">
            <AdGrid cols="3">
              {[
                ['wrist_flexors','Кисть (кг)'],
                ['pronators','Пронация (кг)'],
                ['supinators','Супинация (кг)'],
                ['brachialis','Брахиалис (кг)'],
                ['grip_support','Support RT/Axle (кг)'],
                ['grip_pinch','Pinch (кг)'],
                ['default','База (кг)'],
              ].map(([k,label]) => (
                <AdField key={k} label={label}>
                  <input value={workMaxEdit[k]||''} onChange={e=> setWorkMaxEdit(prev=> ({...prev, [k]: e.target.value}))} placeholder="—" inputMode="decimal" />
                </AdField>
              ))}
            </AdGrid>
          </AdSec>

          <AdSec title="🏆 PRO: старт WAF · руки L/R · бенчи · дневник · спарринг">
            <AdGrid cols="3">
              <AdField label="Вес, кг">
                <input value={proBw} onChange={e=>setProBw(e.target.value)} placeholder="84" inputMode="decimal" />
              </AdField>
              <AdField label="Возраст">
                <input value={proAge} onChange={e=>setProAge(e.target.value)} placeholder="30" inputMode="numeric" />
              </AdField>
              <AdField label="Рука">
                <select value={proArm} onChange={e=>setProArm(e.target.value)}>
                  <option value="both">Обе (2 зачёта)</option><option value="left">Левая</option><option value="right">Правая</option>
                </select>
              </AdField>
              <AdField label="Дата старта">
                <input type="date" value={proDate} onChange={e=>setProDate(e.target.value)} />
              </AdField>
              <AdField label="Целевой вес, кг">
                <input value={proTargetW} onChange={e=>setProTargetW(e.target.value)} placeholder="85" inputMode="decimal" />
              </AdField>
              <AdField label="Спарринг">
                <select value={proSpar} onChange={e=>setProSpar(e.target.value)}>
                  <option value="off">Выкл</option><option value="70">70% техника</option><option value="90">90% контроль</option><option value="100">100% (heavy-нед)</option>
                </select>
              </AdField>
              <AdField label="Сила левой, кг">
                <input value={proLeft} onChange={e=>setProLeft(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Сила правой, кг">
                <input value={proRight} onChange={e=>setProRight(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Партнёр Δ, кг">
                <input value={proSparDelta} onChange={e=>setProSparDelta(e.target.value)} placeholder="0" inputMode="decimal" />
              </AdField>
              <AdField label="RT бенч, кг">
                <input value={proBenchRt} onChange={e=>setProBenchRt(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Wrist curl, lb">
                <input value={proBenchWristLb} onChange={e=>setProBenchWristLb(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Pron hold, с">
                <input value={proBenchPron} onChange={e=>setProBenchPron(e.target.value)} placeholder="—" inputMode="numeric" />
              </AdField>
              <AdField label="Side, кг">
                <input value={proBenchSide} onChange={e=>setProBenchSide(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="sRPE (дневник)">
                <input value={proSrpe} onChange={e=>setProSrpe(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Боль локтя 0-10">
                <input value={proElbow} onChange={e=>setProElbow(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
            </AdGrid>
            <div className="ad-row">
              <AdCheck checked={proSupermatch} onChange={setProSupermatch} label="Суперматч best-of-5/6" />
              <AdCheck checked={proStrap} onChange={setProStrap} label="Ожидается ремень" />
            </div>
            {(proBw || proAge) && (()=>{ try {
              const card = buildWafStartCard({ sex: linked?.profile?.personal?.sex, ageYears: parseFloat(proAge) || 30, bodyWeightKg: parseFloat(proBw) || 80, arm: proArm as any });
              return <div className="ad-tip">WAF {card.ageGroup} · кат. {card.weightClass.label} кг · {card.weighInNote}</div>;
            } catch { return null; } })()}
            {proSupermatch && (()=>{
              const sm = buildSupermatchPlan({ level });
              return <div className="ad-tip">Суперматч: {sm.rounds.length} раундов × {sm.rounds[0]?.fightSec}с / отдых {sm.rounds[0]?.restSec}с · TUT {sm.totalTimeUnderTensionSec}с — пин-холды в слабом углу + скорость.</div>;
            })()}
            {(proLeft && proRight) && (()=>{ try {
              const b = planBilateralVolume({ leftKg: parseFloat(proLeft), rightKg: parseFloat(proRight), baseSets: 10, mrvSets: 16 });
              if (b.asymmetryPct == null) return null;
              return <div className="ad-tip">L/R: асимметрия {b.asymmetryPct}% — {b.note}</div>;
            } catch { return null; } })()}
            {(proBw && proTargetW && proDate) && (()=>{ try {
              const weeksOut = weeksUntilStart(undefined, proDate);
              const cut = planWeightCut({ startKg: parseFloat(proBw), targetKg: parseFloat(proTargetW), weeksOut, sex: linked?.profile?.personal?.sex });
              return <div className="ad-tip">Сгонка: {cut.note}</div>;
            } catch { return null; } })()}
            <div>
              <div className="ad-muted">WAF-фолы ({WAF_FOULS_OUT_AFTER} фола = поражение):</div>
              <div className="ad-row">
                {WAF_FOULS.map(f=><span key={f.id} title={`${f.what} Профилактика: ${f.prevention}`} className="ad-tag">{f.name}</span>)}
              </div>
            </div>
          </AdSec>

          <AdSec title="🥇 TOP: матчап · скорость · лестница · sim · календарь">
            <AdGrid cols="3">
              <AdField label="Стиль оппонента">
                <select value={topOpp} onChange={e=>setTopOpp(e.target.value)}>
                  <option value="unknown">Неизвестен</option><option value="hook">Хук</option><option value="toproll">Топролл</option><option value="press">Пресс</option><option value="balanced">Универсал</option>
                </select>
              </AdField>
              <AdField label="Рука оппонента">
                <select value={topOppHand} onChange={e=>setTopOppHand(e.target.value)}>
                  <option value="unknown">Неизвестно</option><option value="high">High-hand</option><option value="low">Low-hand</option><option value="neutral">Нейтраль</option>
                </select>
              </AdField>
              <AdField label="Оппонент Δ, кг (+ тяжелее)">
                <input value={topWD} onChange={e=>setTopWD(e.target.value)} placeholder="0" inputMode="decimal" />
              </AdField>
              <AdField label="Имплемент (лестница)">
                <select value={topLadder} onChange={e=>setTopLadder(e.target.value)}>
                  <option value="">—</option><option value="fat_gripz">Fat Gripz</option><option value="rolling_thunder">Rolling Thunder</option><option value="apollon_axle">Axle</option><option value="saxon_bar">Saxon</option><option value="pinch_block">Pinch Block</option><option value="hub">Hub</option><option value="coc_bullet">CoC Bullet</option>
                </select>
              </AdField>
              <AdField label="Результат (кг/с)">
                <input value={topLadderVal} onChange={e=>setTopLadderVal(e.target.value)} placeholder="—" inputMode="decimal" />
              </AdField>
              <AdField label="Приоритет старта">
                <select value={topCalPrio} onChange={e=>setTopCalPrio(e.target.value)}>
                  <option value="A">A (тейпер 3н)</option><option value="B">B (тейпер 2н)</option><option value="C">C (без тейпера)</option>
                </select>
              </AdField>
              <AdField label="Серия">
                <select value={topCalSeries} onChange={e=>setTopCalSeries(e.target.value)}>
                  <option value="local">Локальный</option><option value="waf_worlds">WAF Worlds</option><option value="east_vs_west">East-vs-West</option><option value="super_series">Super Series</option>
                </select>
              </AdField>
              <AdField label="Grip-RPE неделя">
                <select aria-label="Grip-RPE неделя" value={topGripWeek} onChange={e=>setTopGripWeek(e.target.value)}>
                  <option value="">Авто</option><option value="1">1 (объём)</option><option value="2">2 (объём)</option><option value="3">3 (интенс.)</option><option value="4">4 (делоад)</option>
                </select>
              </AdField>
              <AdField label="Grip-RPE фаза">
                <select value={topGripPhase} onChange={e=>setTopGripPhase(e.target.value)}>
                  <option value="auto">Авто</option><option value="volume">Объём RPE7</option><option value="intensification">Интенс. RPE8</option><option value="peak">Пик RPE9</option><option value="deload">Делоад</option>
                </select>
              </AdField>
              <AdField label="Тяж. хвата/нед (CNS)">
                <input value={topHeavy} onChange={e=>setTopHeavy(e.target.value)} placeholder="—" inputMode="numeric" />
              </AdField>
              <AdField label="Часов с тяж. тяг">
                <input value={topPullH} onChange={e=>setTopPullH(e.target.value)} placeholder="72" inputMode="decimal" />
              </AdField>
            </AdGrid>
            <div className="ad-row">
              <AdCheck checked={topRfd} onChange={setTopRfd} label="RFD speed-блок (5×3 RPE8)" />
              <AdCheck checked={topSim} onChange={setTopSim} label="Contest-sim неделя" />
              <AdCheck checked={topContinuity} onChange={setTopContinuity} label="🔗 С прошлого плана (+2.5% веса)" />
              <AdCheck checked={topGripAuto} onChange={setTopGripAuto} label="🌊 Grip-RPE авто-волна" />
            </div>
            <AdSec title="📚 Именной цикл (интернет-библиотека) — пусто = обычный план">
              <AdGrid cols="2">
                <AdField label="Цикл">
                  <select value={cycId} onChange={e=>setCycId(e.target.value)}>
                    <option value="">— обычный план —</option>
                    {ARM_CYCLE_LIBRARY.map(c=> <option key={c.id} value={c.id}>{c.name} ({c.weeks}н)</option>)}
                  </select>
                </AdField>
                <AdField label="Медли (армлифтинг)">
                  <select value={cycMedley} onChange={e=>setCycMedley(e.target.value)}>
                    <option value="">—</option>
                    {ARM_MEDLEYS.map(m=> <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </AdField>
                <AdField label="Коррекция %/нед (СРЦ 0.5)">
                  <input value={cycCorr} onChange={e=>setCycCorr(e.target.value)} placeholder="0.5" inputMode="decimal" />
                </AdField>
                <AdField label="CoC рабочий">
                  <select value={cycCoc} onChange={e=>setCycCoc(e.target.value)}>
                    <option value="">—</option><option value="guide">Guide</option><option value="sport">Sport</option><option value="trainer">Trainer</option><option value="no1">№1</option><option value="no1_5">№1.5</option><option value="no2">№2</option><option value="no2_5">№2.5</option><option value="no3">№3</option>
                  </select>
                </AdField>
                <AdField label="Pumpkin-рука (Larratt)">
                  <select value={cycPumpkin} onChange={e=>setCycPumpkin(e.target.value)}>
                    <option value="">—</option><option value="left">Левая</option><option value="right">Правая</option>
                  </select>
                </AdField>
              </AdGrid>
              <div className="ad-row">
                <AdCheck checked={cycConsent} onChange={setCycConsent} label="Согласен на растяжение/сжатие цикла" />
                <AdCheck checked={cycFlat} onChange={setCycFlat} label="Flat pyramid (Bompa)" />
                <AdCheck checked={cycBlood} onChange={setCycBlood} label="Bloodflow 100×" />
                <AdCheck checked={cycNever} onChange={setCycNever} label="Never fail" />
                <AdCheck checked={cycSingles} onChange={setCycSingles} label="Heavy singles 17–18" />
                <AdCheck checked={cycBrzenk} onChange={setCycBrzenk} label="Brzenk 1+1" />
                <AdCheck checked={cycAkimov} onChange={setCycAkimov} label="Акимов-крюк" />
                {cycAkimov && <AdCheck checked={cycComp} onChange={setCycComp} label="Соревн. период" />}
                <AdCheck checked={cycFor} onChange={setCycFor} label="FOR-7 (adv+)" />
                <AdCheck checked={cycAxisOn} onChange={setCycAxisOn} label="Ось humerus-2026" />
                {cycFor && (
                  <AdField label="FOR-домен">
                    <select value={cycForSpec} onChange={e=>setCycForSpec(e.target.value)}>
                      <option value="support">Поддержка</option><option value="crush">Дробление</option><option value="pinch">Щипок</option><option value="open">Открытый</option><option value="wrist">Кисть</option>
                    </select>
                  </AdField>
                )}
              </div>
              {cycAxisOn && (
                <AdSec title="Ось кисть–локоть–плечо (что было):">
                  <div className="ad-row">
                    <AdCheck checked={axTrunk} onChange={setAxTrunk} label="Скрут корпуса в атаку" />
                    <AdCheck checked={axMisalign} onChange={setAxMisalign} label="Ось разорвана" />
                    <AdCheck checked={axBehind} onChange={setAxBehind} label="Запястье позади плеча" />
                    <AdCheck checked={axDorsal} onChange={setAxDorsal} label="Кисть разогнута назад" />
                    <AdCheck checked={axCold} onChange={setAxCold} label="Холод без разминки" />
                    <AdCheck checked={axDefense} onChange={setAxDefense} label="Борьба из защиты" />
                    <AdCheck checked={axSideMax} onChange={setAxSideMax} label="Макс бокового" />
                  </div>
                </AdSec>
              )}
              {cycMedley && (()=>{
                let events: Array<{ implement: string }> = [];
                try { events = (getMedley(cycMedley)?.events || []) as Array<{ implement: string }>; } catch { events = []; }
                if (!events.length) return null;
                return (
                  <AdSec title="Попытки медли (факт → сводка):">
                    {events.map((ev, i)=>(
                      <label key={i} className="ad-check">{ev.implement}
                        <input aria-label={`Попытка ${i + 1} кг`} value={medAttKg[i] || ''} onChange={e=>setMedAttKg(prev=>prev.map((v, j)=>j===i?e.target.value:v))} placeholder="кг" inputMode="decimal" />
                        <input aria-label={`Попытка ${i + 1} удачна`} type="checkbox" checked={medAttOk[i] !== false} onChange={e=>setMedAttOk(prev=>prev.map((v, j)=>j===i?e.target.checked:v))} />
                      </label>
                    ))}
                  </AdSec>
                );
              })()}
              {cycId && (()=>{
                try {
                  const f = fitCycleToWeeks(cycId, weeks);
                  return <div className="ad-tip">Цикл: {f.note}{f.needsConsent && !cycConsent ? ' — поставьте согласие или недели = длине цикла.' : ''}</div>;
                } catch { return null; }
              })()}
            </AdSec>
            {(topOpp !== 'unknown' || topWD) && (()=>{
              try {
                const mp = profileOpponent({ myTechnique: technique, oppStyle: topOpp, oppHand: topOppHand, weightDeltaKg: parseFloat(topWD) || 0, strapExpected: proStrap });
                return <div className="ad-tip">Матчап: {mp.note} Приоритет: {mp.priorityMuscles.slice(0,3).join(', ')}.</div>;
              } catch { return null; }
            })()}
            {topLadder && (()=>{
              try {
                const sex = linked?.profile?.personal?.sex || 'male';
                return <div className="ad-tip">{ladderAdvice(topLadder, parseFloat(topLadderVal) || 0, sex)}</div>;
              } catch { return null; }
            })()}
            {(proDate && topSim) && (()=>{
              try {
                const sim = buildContestSimWeek({ level, discipline, strapExpected: proStrap, targetKg: parseFloat(proTargetW) || undefined, supermatch: proSupermatch });
                return <div className="ad-tip">{sim.note} Чеклист: {sim.checklist.slice(0,3).join(' · ')}.</div>;
              } catch { return null; }
            })()}
            {proDate && (()=>{
              try {
                const cal = buildArmCalendar({ startIso: proDate, priority: topCalPrio, series: topCalSeries });
                const year = topCalSeries !== 'local' ? superSeriesYear(topCalSeries) : null;
                return <div className="ad-tip">Календарь: {cal.note}{year ? ` Год: ${year.note}.` : ''}</div>;
              } catch { return null; }
            })()}
            {(topGripWeek || topGripPhase !== 'auto') && (()=>{
              try {
                const g = buildGripRpe({ week: parseInt(topGripWeek) || 1, phase: topGripPhase !== 'auto' ? topGripPhase : undefined });
                return <div className="ad-tip">Grip-RPE: {g.note} Экстензоры {g.extensor.sets}×{g.extensor.reps} обязательно.</div>;
              } catch { return null; }
            })()}
          </AdSec>

          <AdBtn variant="primary" block hero onClick={handleBuild}>⚡ Собрать план</AdBtn>
          <div className="ad-muted">Лучший сплит: <b>{best?.name || '—'}</b> ({ranked[0]?.score ?? 0} баллов) · {ranked[0]?.rationale.slice(0,2).join(' · ')}</div>
        </AdCard>
      )}

      {step === 'grip' && (
        <AdCard>
          <ArmGripCard onApplyWeak={(ws)=>setWeakPoints(ws.slice(0,2))} />
          <div className="ad-muted">
            <b>Хват-типы (StrongShop / IronMind):</b> support (Rolling Thunder 60мм вращающаяся, Axle 58мм DOH) · pinch (Saxon 3&quot; / Hub) · crush (CoC). Рекомендация — {best?.name}.
          </div>
        </AdCard>
      )}

      {step === 'split' && (
        <AdCard>
          <AdSec title="🗓 Выбор сплита" hint={`Ранжирование по уровню/цели/технике/хватe/дням (${daysPerWeek}/нед). Зелёный — лучший.`}>
            <div className="ad-list" data-arm="split-list">
              {ranked.slice(0,6).map((r,i)=> (
                <div key={r.pattern.id} className="ad-sec" data-active={patternId===r.pattern.id} onClick={()=>setPatternId(r.pattern.id)} role="button" tabIndex={0} onKeyDown={(e)=>{ if (e.key==='Enter'||e.key===' ') setPatternId(r.pattern.id); }}>
                  <div><b>{i===0 ? '★ ' : ''}{r.pattern.name}</b> <span className="ad-muted">— {r.pattern.sessionsPerRotation}x/{r.pattern.rotationDays}дн</span> <span className="ad-stat-v">{r.score}</span></div>
                  <div className="ad-muted">{r.pattern.description}</div>
                  {r.rationale.length>0 && <div className="ad-tip">{r.rationale.join(' · ')}</div>}
                  {r.warnings.length>0 && <div className="ad-tip">⚠ {r.warnings.join(' · ')}</div>}
                </div>
              ))}
            </div>
          </AdSec>
          <AdBtn variant="primary" block hero onClick={handleBuild}>⚡ Собрать с выбранным сплитом</AdBtn>
        </AdCard>
      )}

      {step === 'plan' && (
        <AdCard>
          {!builtPlan ? <div className="ad-muted">План не собран — вернись в «Параметры».</div> : (
            <>
              <AdSec title={`📋 План — ${builtPlan.pattern.name}`}>
                <div className="ad-muted">{builtPlan.rationale.map((r:string, i:number)=><div key={i}>• {r}</div>)}</div>
              </AdSec>
              <div className="ad-strip" data-arm="week-pills">
                {builtPlan.weeks.map((w:any)=> (
                  <button key={w.week} className="ad-pill" data-active={weekSel===w.week} onClick={()=>setWeekSel(w.week)}>
                    Н{w.week} {w.phase==='deload' ? '· deload' : w.phase==='peaking' ? '· пик' : ''}
                  </button>
                ))}
              </div>
              {curWeek && (
                <div>
                  <h4 className="ad-sec-t">Неделя {curWeek.week} — {curWeek.phase} {curWeek.deload ? '(deload)' : ''}</h4>
                  {curWeek.note && <div className="ad-tip">📝 {curWeek.note}</div>}
                  {curWeek.sessions.map((sess:any, si:number)=> (
                    <div key={si} className="ad-sess">
                      <div className="ad-sess-h">{sess.sessionTag} · {sess.character} {sess.tableTime ? '🖐️ стол' : ''}</div>
                      {sess.note && <div className="ad-muted">📝 {sess.note}</div>}
                      {sess.exercises.map((ex:any, ei:number)=> (
                        <div key={ei} className="ad-ex">
                          <div className="ad-ex-top">
                            <span className="ad-ex-nm">{ex.name} <span>· {ARM_MUSCLE_RU[ex.muscle] || ex.muscle}</span> {ex.isTable ? '🖐️' : ''} {ex.workingAngle ? `· РУ ${ex.workingAngle.elbowDeg}° ${ex.workingAngle.direction}` : ''}</span>
                            <span className="ad-ex-vl">{ex.sets}×{ex.repsRange[0]}-{ex.repsRange[1]} RIR{ex.rir}{ex.holdSeconds ? ` hold ${ex.holdSeconds}с`:''}</span>
                          </div>
                          {ex.comment && /RFD speed|Contest-sim|унилатерально|Table-IQ|overcrush|negatives/.test(ex.comment) && (
                            <div className="ad-tip">💡 {ex.comment}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="ad-row">
                <AdBtn variant="ghost" onClick={()=>{
                  let diag: any = null;
                  try { const raw = localStorage.getItem('he_arm_last_diagnostics'); if (raw) diag = JSON.parse(raw); } catch {}
                  // fatigue/trend из force-history если есть
                  try {
                    const trials = loadForceTrials();
                    const stats = buildWeeklyStats(trials, 12);
                    const ft = fatigueTrend(stats);
                    const tr = forceTrend(stats);
                    if (diag) { diag.fatigue = ft?.text; diag.trend = tr?.text; }
                  } catch {}
                  // R7: PRO-сводка в печать из inputSnapshot плана (пусто = блока нет)
                  let proSummary: any = null;
                  try { if (builtPlan?.inputSnapshot) proSummary = buildArmProSummary(builtPlan.inputSnapshot); } catch { proSummary = null; }
                  const html = buildArmPrintHtml(builtPlan, { findings: diag?.findings, humerusWarnings: diag?.humerusWarnings, balanceWarnings: diag?.balanceWarnings, asymmetryPct: diag?.asymmetryPct, benchLevel: diag?.benchLevel, fatigue: diag?.fatigue, trend: diag?.trend, info: diag?.info }, proSummary);
                  const w = window.open('', '_blank');
                  if (w) { w.document.write(html); w.document.close(); } else flash('⚠ Всплывающие окна заблокированы');
                }}>🖨 Печать</AdBtn>
                <AdBtn variant="ghost" onClick={()=>{
                  const ics = buildArmIcs(builtPlan);
                  const blob = new Blob([ics], { type:'text/calendar' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href=url; a.download='arm-plan.ics'; a.click(); URL.revokeObjectURL(url);
                }}>📅 .ics</AdBtn>
              </div>
            </>
          )}
        </AdCard>
      )}

      {step === 'quality' && (
        <AdCard>
          {!builtPlan ? <div className="ad-muted">Сначала собери план.</div> : (
            <>
              <AdSec title="📊 Качество">
                <div className="ad-muted"><b>{builtPlan.report?.summary}</b></div>
                <div className="ad-stats">
                  <div className="ad-stat">
                    <div className="ad-stat-v">Фазы</div>
                    <div className="ad-stat-s">{builtPlan.report?.phaseRationale.join(' · ')}</div>
                  </div>
                  <div className="ad-stat">
                    <div className="ad-stat-v">Объём</div>
                    <div className="ad-stat-s">{builtPlan.report?.volumeSummary.join(' · ')}</div>
                  </div>
                </div>
                {builtPlan.validation && (
                  <div>
                    {builtPlan.validation.errors.length>0 && <div className="ad-tip">❌ Ошибки: {builtPlan.validation.errors.join(' · ')}</div>}
                    {builtPlan.validation.warnings.length>0 && <div className="ad-tip">⚠ {builtPlan.validation.warnings.slice(0,8).join(' · ')}</div>}
                    {builtPlan.validation.valid && <div className="ad-tip">✓ Валидация пройдена (MRV, humerus, UCL, shoulder, tendon).</div>}
                  </div>
                )}
                <div className="ad-muted">
                  {builtPlan.report?.techniqueRationale.map((r:string,i:number)=><div key={i}>• {r}</div>)}
                  {builtPlan.report?.gripRationale.map((r:string,i:number)=><div key={i}>• {r}</div>)}
                </div>
              </AdSec>
              <div>
                <ArmHeatmap plan={builtPlan} onToast={flash} />
              </div>
              <AdBanner tone="warn">
                <b>4 гейта:</b> humerus (side ≤3, ≤10%/нед, RIR≥2) · UCL (hook n00b) · shoulder (≥4, 12-20, RIR≥2) · tendon (12/16/18/22) — все в валидации.
              </AdBanner>
            </>
          )}
        </AdCard>
      )}

      {step === 'weights' && (
        <AdCard>
          <AdSec title="🏋️ Веса — детали" hint="Веса теперь из рабочих максимумов (выше). Если пусто — используется вес из профиля (default). Прогрессия: тяж 82%, техника 60%, памп 68% от максимума. Для grip — support/pinch отдельно.">
            {!builtPlan ? <div className="ad-muted">Сначала собери план в «Параметры».</div> : (
              <>
                <AdGrid cols="2">
                  {Object.entries(workMax).map(([k,v])=> (
                    <div key={k} className="ad-kv"><span>{k}:</span><span>{String(v)} кг</span></div>
                  ))}
                </AdGrid>
                <div className="ad-muted">Пример веса в плане (неделя 1, тяж): {(() => {
                  try {
                    const ex = builtPlan.weeks[0]?.sessions[0]?.exercises[0];
                    if (!ex) return '—';
                    return `${ex.name} — ${ex.workSets[0]?.weight ?? 0} кг × ${ex.workSets[0]?.reps} RIR${ex.rir} (${ex.tempoSpec})`;
                  } catch { return '—'; }
                })()}</div>
                {discipline === 'armlifting' && (
                  <AdSec title="🏟 Помост: план попыток (опенер 90 / 96 / 102%)">
                    <AdGrid cols="2">
                      <AdField label="Снаряд">
                        <select value={proPlatImpl} onChange={e=>setProPlatImpl(e.target.value)}>
                          {Object.entries(PLATFORM_WR).map(([id, r])=><option key={id} value={id}>{r.name}</option>)}
                        </select>
                      </AdField>
                      <AdField label="Цель, кг">
                        <input value={proPlatTarget} onChange={e=>setProPlatTarget(e.target.value)} placeholder="100" inputMode="decimal" />
                      </AdField>
                    </AdGrid>
                    <div className="ad-muted">{(()=>{
                      const t = parseFloat(proPlatTarget);
                      if (!(t > 0)) return 'Введите цель — покажем раскладку попыток и %WR.';
                      const att = planAttempts(t);
                      const wr = platformWrFor(proPlatImpl, linked?.profile?.personal?.sex);
                      const pct = Math.round((t / wr) * 1000) / 10;
                      return `Попытки: ${att.join(' / ')} кг · WR ${wr} кг · цель ${pct}% WR${pct >= 90 ? ' — элита' : pct >= 70 ? ' — соревновательный уровень' : ' — база'}. Правило помоста: промах = выбыл, только DOH, без лямок.`;
                    })()}</div>
                  </AdSec>
                )}
                <AdBtn variant="primary" block onClick={handleBuild}>🔄 Пересобрать с весами</AdBtn>
              </>
            )}
          </AdSec>
        </AdCard>
      )}
    </AdRoot>
  );
}
