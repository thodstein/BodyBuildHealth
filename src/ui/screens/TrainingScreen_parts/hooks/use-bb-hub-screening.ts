/**
 * use-bb-hub-screening.ts — скрининг ББ-диагностики: вердикты, стоп-флаги, снимки.
 *
 * Третий срез волны 3 плана хабов. Раньше эти мемо жили в `BBDiagnosticsHub.tsx`
 * вперемешку с обработчиками/экспортом. Контракт 1:1 (тела и deps перенесены как есть):
 *
 * - OHS-присед-тест и КТС (`ktwOf`: L/R приоритетнее legacy-одиночки);
 * - L/R-объём из дневника + флип-гейт по истории (`lrHistNonce` — после записи истории
 *   вердикт пересчитывается, иначе текст уезжал на один клик назад);
 * - готовность + красные флаги + ступени возврата (боль читается из pain-monitoring);
 * - D1–D5 (плечо/ротация/шарнир/нагруженный присед/YBT) и R1–R6 (жим/боль/NHE/аддукторы/
 *   шарнир под весом/ER:IR) — только провалы дают коды снимка;
 * - teen-гейт 14–15 блокирует нагруженные пробы (`teenGate`);
 * - орто-скрининг хаба «Суставы и ортопедия»: флаги + прехаб, перечитывание по focus/visibility.
 *
 * «Не проверялся» — это `tested: false`, а не «чисто»: хаб печатает серый статус.
 */
import { useEffect, useMemo, useState } from 'react';
import { bbNum } from '../bb-hub-controls';
import { ktwOf, type BBState } from '../bb-hub-state';
import { assessOHS } from '../../../../engines/strength-sport/strength-sport-ohs.engine';
import { lrVerdictsFromSessions } from '../../../../engines/bb/bb-lr-volume.engine';
import { assessBbReadiness } from '../../../../engines/bb/bb-readiness.engine';
import { assessBbRedFlags } from '../../../../engines/bb/bb-red-flags.engine';
import { buildReturnToPlan, activeReturnToStage, evaluateReturnToCriteria } from '../../../../engines/bb/bb-return-to.engine';
import { summarizeLrDirection, type BbLrSnapshot } from '../../../../engines/bb/bb-lr-history.engine';
import { loadOrthoFlags } from '../../../../engines/pro/ortho-screen.engine';
import { bbOrthoPrehabRows, bbOrthoFlagsSummary } from '../../../../engines/bb/bb-ortho-prehab.engine';
import { resolveMovementDriver, singleLegVerdict, ohsFailCodes, d1d5FailCodes, v3FailCodes, movementDelta, screenPriorityList, teenLoadedGate, type MovementSnapshot } from '../../../../engines/bb/bb-movement-screen.engine';
import { shoulderWallVerdict, thoracicRotationVerdict, erIrVerdict } from '../../../../engines/bb/bb-shoulder-screen.engine';
import { hingeVerdict, loadedSquatVerdict, loadedHingeVerdict } from '../../../../engines/bb/bb-hinge-screen.engine';
import { ybtLqVerdict } from '../../../../engines/bb/bb-ybt-lq.engine';
import { substitutesForDriver, asymPriorityText } from '../../../../engines/bb/bb-movement-to-plan.engine';
import { benchScreenVerdict } from '../../../../engines/bb/bb-bench-screen.engine';
import { painMonitorVerdict, painMonitorLine } from '../../../../engines/bb/bb-pain-monitor.engine';
import { nheVerdict, adductorVerdict } from '../../../../engines/bb/bb-posterior-readiness.engine';
import { assessBbTendonGuard } from '../../../../engines/bb/bb-tendon-guard.engine';

export type BbHubScreeningInput = {
  state: BBState;
  diarySessions: any[];
  perMuscleAcwr: any;
  profileSleep: number | null;
  level: string;
  teenGate: ReturnType<typeof teenLoadedGate>;
  /** Тик после записи `he_bb_lr_history` (иначе флип-гейт считался по старому срезу). */
  lrHistNonce: number;
};

export function useBbHubScreening(input: BbHubScreeningInput) {
  const { state, diarySessions, perMuscleAcwr, profileSleep, level, teenGate, lrHistNonce } = input;

  const ohs = useMemo(() => assessOHS({
    heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
    trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
    kneeToWallCm: ktwOf(state).eff,
    ankleDorsiflexDeg: bbNum(state.ankleDeg),
    shoulderFlexionDeg: bbNum(state.shoulderFlexDeg),
    heelRaiseRetest: state.heelRetest === 'better' ? true : state.heelRetest === 'same' ? false : null,
  }), [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ktwL, state.ktwR, state.kneeToWallCm, state.ankleDeg, state.heelRetest, state.shoulderFlexDeg]);

  // P1: L/R-объём из дневника + флип-гейт по истории (D2: сторона плавает — шум измерения,
  // добивку не фиксируем; стабильная сторона ≥3 замеров — добивка оправдана).
  const lrVerdicts = useMemo(() => {
    try {
      const base = lrVerdictsFromSessions(diarySessions as any);
      let hist: BbLrSnapshot[] = [];
      try {
        const raw = localStorage.getItem('he_bb_lr_history');
        hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      } catch { /* noop */ }
      return base.map((v) => {
        if ((v.verdict === 'topup' || v.verdict === 'watch') && v.weakSide) {
          try {
            const d = summarizeLrDirection(hist, v.group);
            if (d && d.flipped && !d.persistent) {
              return { ...v, verdict: 'watch' as const, topUpSets: 0, text: `${v.text} · сторона плавает — шум измерения, добивку не фиксируем` };
            }
          } catch { /* noop */ }
        }
        return v;
      });
    } catch { return []; }
  }, [diarySessions, lrHistNonce]);
  // P2/P3: готовность + красные флаги
  const redFlags = useMemo(() => {
    try {
      return assessBbRedFlags({ acutePain: state.acutePain, swelling: state.swelling, numbness: state.numbness, jointClickPain: state.jointClickPain });
    } catch { return { active: false, blocked: false, items: [], text: '' } as any; }
  }, [state.acutePain, state.swelling, state.numbness, state.jointClickPain]);
  const readiness = useMemo(() => {
    try {
      // Сон — из профиля; боль — из pain-monitoring (pmDuring/pmMorning), если её
      // вводили; ACWR — из дневника. Важно: без данных это «нет данных», а не
      // измеренный ноль — раньше Number(null)=0 давал зелёный «можно включая добивки».
      const sl = profileSleep;
      const hasAcwr = Object.keys(perMuscleAcwr as any).length > 0;
      const danger = Object.values(perMuscleAcwr as any).filter((v: any) => v?.zone === 'dangerous').length;
      // Боль 0–10: берём худшую из «во время» и «на след. утро» — восстановление
      // определяется не лучшим показателем. (painMon объявлен ниже — читаем поля напрямую.)
      const p1 = bbNum(state.pmDuring);
      const p2 = bbNum(state.pmMorning);
      const pain = (p1 != null || p2 != null) ? Math.max(p1 ?? 0, p2 ?? 0) : null;
      return assessBbReadiness({
        sleepHours: Number.isFinite(sl as number) ? (sl as number) : null,
        pain010: pain,
        vbtLossPct: null,
        dangerMuscles: hasAcwr ? danger : null,
      });
    } catch { return { level: 'yellow', reasons: [], advice: '', tested: false, noData: true } as any; }
  }, [profileSleep, perMuscleAcwr, state.pmDuring, state.pmMorning]);
  // PRO-3 R2 + PRO-4 S3: return-to после стоп-флагов (ступень выбирается вручную) — гейт вставки
  const returnToPlan = useMemo(() => {
    try { return buildReturnToPlan(redFlags as any); } catch { return null; }
  }, [redFlags]);
  const returnActive = useMemo(() => {
    try { return activeReturnToStage(returnToPlan as any, state.returnStage as any); } catch { return null; }
  }, [returnToPlan, state.returnStage]);
  // П2: измеримые критерии выхода (pain-monitoring). Ничего не двигает автоматически.
  const chipStyle = (on: boolean) => ({
    minHeight: 44, padding: '8px 12px', borderRadius: 999,
    border: '1px solid', borderColor: on ? '#22c55e' : 'rgba(255,255,255,0.12)',
    background: on ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
    color: on ? '#22c55e' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  });
  const returnCriteria = useMemo(() => {
    try {
      return evaluateReturnToCriteria({
        painDuringLoad: state.retPainLoad,
        painNextMorning: state.retPainMorning,
        morningStiffness: state.retStiffness,
        plyoTolerated: state.retPlyo,
      });
    } catch { return null; }
  }, [state.retPainLoad, state.retPainMorning, state.retStiffness, state.retPlyo]);
  // PRO-3 R6: направление перекоса (история слабых сторон)
  const lrDirection = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_bb_lr_history');
      const hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      const out: Array<{ group: string; text: string }> = [];
      for (const v of lrVerdicts.slice(0, 2)) {
        const d = summarizeLrDirection(hist, v.group);
        if (d) out.push({ group: v.group, text: d.text });
      }
      return out;
    } catch { return []; }
  }, [lrVerdicts, lrHistNonce]);
  const painWorst = useMemo(() => {
    const p1 = bbNum(state.pmDuring);
    const p2 = bbNum(state.pmMorning);
    return (p1 != null || p2 != null) ? Math.max(p1 ?? 0, p2 ?? 0) : null;
  }, [state.pmDuring, state.pmMorning]);
  /**
   * BB-D-19 (хвост): орто-скрининг живёт в общем хабе «Суставы и ортопедия»
   * (`he_ortho_screen_v1`). Хаб диагностики его не дублирует, а читает — и перечитывает,
   * когда окно возвращается из ортопедии (focus/visibility), иначе карточка показывала бы
   * старый скрининг после заполнения.
   */
  const [orthoNonce, setOrthoNonce] = useState(0);
  useEffect(() => {
    const bump = () => setOrthoNonce((n) => n + 1);
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') bump(); };
    window.addEventListener('focus', bump);
    document.addEventListener?.('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', bump); document.removeEventListener?.('visibilitychange', onVis); };
  }, []);
  const orthoFlags = useMemo(() => {
    try { return loadOrthoFlags(); } catch { return []; }
  }, [orthoNonce]);
  const orthoPrehab = useMemo(() => {
    try { return bbOrthoPrehabRows(orthoFlags); } catch { return []; }
  }, [orthoFlags]);
  const orthoSummary = useMemo(() => bbOrthoFlagsSummary(orthoFlags), [orthoFlags]);
  // Скрининг v2: драйвер + односторонний + коды/снимок (чистые функции движка)
  const moveDriver = useMemo(() => {
    try {
      return resolveMovementDriver({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
        kneeToWallCm: ktwOf(state).eff,
        kneeToWallL: ktwOf(state).l,
        kneeToWallR: ktwOf(state).r,
        ankleDeg: bbNum(state.ankleDeg),
        heelRetest: state.heelRetest === 'better' ? 'better' : state.heelRetest === 'same' ? 'same' : null,
        handsOnHipsBetter: state.handsOnHipsBetter || null,
        // R4: гастрокнемиус (прямое колено) + ROM сгибания бедра + задний наклон таза
        ktwStraightL: bbNum(state.ktwStraightL), ktwStraightR: bbNum(state.ktwStraightR),
        hipFlexionDeg: bbNum(state.hipFlexDeg),
        ppTilt: state.ppTilt,
        // Пока скрининг не тронут — «не заполнен», а не «паттерн чистый».
        tested: state.screenTouched,
      });
    } catch { return { driver: 'none', label: '—', fix: '', confidence: 0, tested: false } as any; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ktwL, state.ktwR, state.kneeToWallCm, state.ankleDeg, state.heelRetest, state.handsOnHipsBetter, state.ktwStraightL, state.ktwStraightR, state.hipFlexDeg, state.ppTilt, state.screenTouched]);
  const singleLeg = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n >= 0 ? n : null; };
      return singleLegVerdict({
        splitSquatL: (state.splitL || null) as any, splitSquatR: (state.splitR || null) as any,
        rdlL: (state.rdlL || null) as any, rdlR: (state.rdlR || null) as any,
        fppaL: num(state.fppaL), fppaR: num(state.fppaR),
      });
    } catch { return { weakSide: null, text: 'Односторонний: ошибка расчёта — данные не учтены', tested: false } as any; }
  }, [state.splitL, state.splitR, state.rdlL, state.rdlR, state.fppaL, state.fppaR]);
  // D1–D5: плечо/шарнир/YBT/асимметрии/замены (чистые мемы, без TDZ — выше экспорта/моста)
  const shoulderV = useMemo(() => {
    try {
      // Не проверялся → pass=false + tested=false: иначе UI красил «непройденный»
      // скрининг зелёным («всё чисто»), хотя замеров не было.
      if (!state.screenTouched) return { pass: false, fails: [], locus: 'ok', text: 'Плечо у стены: не проверялся', tested: false } as any;
      return shoulderWallVerdict({
        backOnWall: state.shBackOnWall, headOnWall: state.shHeadOnWall, bicepsAtEars: state.shBicepsAtEars,
        ribsDown: state.shRibsDown, noShrug: state.shNoShrug,
      });
    } catch { return { pass: true, fails: [], locus: 'ok', text: '', tested: false } as any; }
  }, [state.shBackOnWall, state.shHeadOnWall, state.shBicepsAtEars, state.shRibsDown, state.shNoShrug, state.screenTouched]);
  const rotV = useMemo(() => {
    try {
      const n = (v: string): number | null => { const x = bbNum(v); return x != null && x >= 0 ? x : null; };
      return thoracicRotationVerdict({ rotL: n(state.rotL), rotR: n(state.rotR) });
    } catch { return { text: '', gap: null, low: false } as any; }
  }, [state.rotL, state.rotR]);
  const hingeV = useMemo(() => {
    try { return hingeVerdict((state.hingeDowel || null) as any); } catch { return { pass: true, locus: 'not_tested', text: '' } as any; }
  }, [state.hingeDowel]);
  const loadedV = useMemo(() => {
    try {
      // Teen-гейт: рабочая нагрузка у 14–15 не измеряется (прецедент teenNote ББ-авто).
      if (teenGate.blocked) return { degraded: false, text: teenGate.note };
      return loadedSquatVerdict({
        bodyweight: (state.sqBody || null) as any, bar: (state.sqBar || null) as any, working: (state.sqWork || null) as any,
      });
    } catch { return { degraded: false, text: '' }; }
  }, [state.sqBody, state.sqBar, state.sqWork, teenGate]);
  const ybtV = useMemo(() => {
    try {
      return ybtLqVerdict({
        antL: bbNum(state.ybtL), antR: bbNum(state.ybtR), shinCm: bbNum(state.shinCm),
        pmL: bbNum(state.ybtPmL), pmR: bbNum(state.ybtPmR), plL: bbNum(state.ybtPlL), plR: bbNum(state.ybtPlR),
        limbCm: bbNum(state.limbCm),
      });
    } catch { return { tested: false, asymCm: null, compositePct: null, compositeFull: false, warn: false, text: '' } as any; }
  }, [state.ybtL, state.ybtR, state.shinCm, state.ybtPmL, state.ybtPmR, state.ybtPlL, state.ybtPlR, state.limbCm]);
  const asymText = useMemo(() => {
    try {
      const n = (v: string): number | null => bbNum(v);
      const kl = n(state.ktwL); const kr = n(state.ktwR);
      const fl = n(state.fppaL); const fr = n(state.fppaR);
      return asymPriorityText({
        ktwGapCm: kl != null && kr != null ? Math.abs(kl - kr) : null,
        fppaGapDeg: fl != null && fr != null ? Math.abs(fl - fr) : null,
        ybtAsymCm: (ybtV as any)?.asymCm ?? null,
        rotGapDeg: (rotV as any)?.gap ?? null,
      });
    } catch { return ''; }
  }, [state.ktwL, state.ktwR, state.fppaL, state.fppaR, ybtV, rotV]);
  const driverSubs = useMemo(() => {
    try { return substitutesForDriver((moveDriver as any)?.driver); } catch { return { avoid: [], prefer: [], note: '' } as any; }
  }, [moveDriver]);
  // ── R1–R6 PRO-2: жим / боль-мониторинг / задняя цепь / шарнир-нагрузка / ER:IR (чистые мемы) ──
  const benchV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n > 0 ? n : null; };
      return benchScreenVerdict({
        gripCm: num(state.benchGripCm),
        biacromialCm: num(state.circ.shoulderWidth),
        touchPoint: (state.benchTouch || null) as any,
        scapula: (state.benchScapula || null) as any,
        abductionDeg: num(state.benchAbduction),
        elbowsBelowBench: state.benchElbowsBelow,
        pain: state.benchPain,
      });
    } catch { return benchScreenVerdict({}); }
  }, [state.benchGripCm, state.circ.shoulderWidth, state.benchTouch, state.benchScapula, state.benchAbduction, state.benchElbowsBelow, state.benchPain]);
  const painMon = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n >= 0 ? n : null; };
      const input = {
        location: (state.pmLoc || null) as any,
        during010: num(state.pmDuring),
        nextMorning010: num(state.pmMorning),
        weeksRising: state.pmRising,
        nightPain: state.pmNight,
        sharp: state.pmSharp,
      };
      return { verdict: painMonitorVerdict(input), line: painMonitorLine(input) };
    } catch { return { verdict: painMonitorVerdict({}), line: '' }; }
  }, [state.pmLoc, state.pmDuring, state.pmMorning, state.pmRising, state.pmNight, state.pmSharp]);
  const painJointTendon = useMemo(() => {
    try {
      const joint = state.pmLoc === 'elbow' ? 'elbow' : state.pmLoc === 'shoulder' ? 'shoulder' : null;
      if (!joint || !diarySessions.length) return null;
      const g = assessBbTendonGuard(diarySessions as any, {
        level,
        painRedJoint: painMon.verdict.level === 'red' ? joint : null,
        // W2: оживлены мёртвые параметры. `elbowPain` — заявленная боль в этом суставе
        // (любой уровень, не только красный); `shoulderOhsFail` — провал плеча в
        // присед-тесте (стеновый тест). Без них сухожильный стоп не видел ни того, ни
        // другого, хотя хаб эти данные собирает.
        elbowPain: state.pmLoc === 'elbow' && painMon.verdict.tested,
        
      });
      return (g as any)[joint] as { text: string; level: string } | null;
    } catch { return null; }
  }, [state.pmLoc, diarySessions, level, painMon.verdict.level, painMon.verdict.tested, shoulderV]);
  const nheV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n >= 0 ? n : null; };
      const angle = num(state.nheAngle);
      return nheVerdict({ repsL: num(state.nheL), repsR: num(state.nheR), breakAngleL: angle, breakAngleR: angle });
    } catch { return nheVerdict({}); }
  }, [state.nheL, state.nheR, state.nheAngle]);
  const adductorV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n > 0 ? n : null; };
      return adductorVerdict({ squeezeL: num(state.addL), squeezeR: num(state.addR), cphLevel: (state.cphLevel || '') as any });
    } catch { return adductorVerdict({}); }
  }, [state.addL, state.addR, state.cphLevel]);
  const loadedHingeV = useMemo(() => {
    try {
      if (teenGate.blocked) return { degraded: false, text: teenGate.note };
      return loadedHingeVerdict({ rdl: (state.rdlLoaded || null) as any, floor: (state.floorLoaded || null) as any });
    } catch { return { degraded: false, text: '' }; }
  }, [state.rdlLoaded, state.floorLoaded, teenGate]);
  const erIrV = useMemo(() => {
    try {
      if (teenGate.blocked) return erIrVerdict({});
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n > 0 ? n : null; };
      return erIrVerdict({ erKg: num(state.erKg), irKg: num(state.irKg) });
    } catch { return erIrVerdict({}); }
  }, [state.erKg, state.irKg, teenGate]);
  const ohsCodes = useMemo(() => {
    try {
      return ohsFailCodes({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
        ppTilt: state.ppTilt,
      });
    } catch { return []; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ppTilt]);
  // П1: D1–D5 коды снимка из вердиктов (только провалы; чисто — тихо).
  const d1d5Codes = useMemo(() => {
    try {
      return d1d5FailCodes({
        shoulder: { pass: !!(shoulderV as any).pass, locus: String((shoulderV as any).locus || '') },
        rotGap: (rotV as any).gap ?? null,
        rotLow: !!(rotV as any).low,
        hinge: { pass: !!(hingeV as any).pass, locus: String((hingeV as any).locus || '') },
        loadedDegraded: !!(loadedV as any).degraded,
        ybtAsymCm: (ybtV as any).asymCm ?? null,
        ybtCompositePct: (ybtV as any).compositePct ?? null,
        ybtTested: !!(ybtV as any).tested,
      });
    } catch { return []; }
  }, [shoulderV, rotV, hingeV, loadedV, ybtV]);
  // R7: R1–R6 коды снимка (жим/боль/NHE/аддукторы/бедро/шарнир-нагрузка/ER:IR)
  const v3Codes = useMemo(() => {
    try {
      const n = (v: string): number | null => bbNum(v);
      return v3FailCodes({
        benchLevel: benchV.level,
        nheAsymReps: nheV.asymReps,
        addAsymPct: adductorV.asymPct,
        painLevel: painMon.verdict.level,
        hipFlexionDeg: n(state.hipFlexDeg),
        ppTilt: state.ppTilt,
        loadedHingeDegraded: teenGate.blocked ? false : loadedHingeV.degraded,
        erIrRatio: teenGate.blocked ? null : erIrV.ratio,
      });
    } catch { return []; }
  }, [benchV.level, nheV.asymReps, adductorV.asymPct, painMon.verdict.level, state.hipFlexDeg, state.ppTilt, teenGate.blocked, loadedHingeV.degraded, erIrV.ratio]);
  const screenCodes = useMemo(() => Array.from(new Set([...ohsCodes, ...d1d5Codes, ...v3Codes])), [ohsCodes, d1d5Codes, v3Codes]);
  const screenPriority = useMemo(() => {
    try {
      return screenPriorityList({
        painLevel: painMon.verdict.level,
        painText: painMon.line,
        driver: moveDriver as any,
        asymText,
        tendon: painJointTendon && painJointTendon.level === 'stop' ? { level: 'stop', text: painJointTendon.text } : null,
        bench: { level: benchV.level, text: benchV.text },
        posterior: { nhe: nheV.tested ? nheV.text : null, adductor: adductorV.tested ? adductorV.text : null },
        loadedHinge: { degraded: teenGate.blocked ? false : loadedHingeV.degraded, text: loadedHingeV.text },
        // Wave-0 Э0.7 (проверено): `erIr` здесь — это локальный параметр движка
        // screenPriorityList (ScreenPriorityInput.erIr), НЕ поле моста. Контракт бриджа
        // (`erir`) собирается отдельно на строках выше/ниже и там уже корректен.
        // Переименовывать здесь нельзя — иначе строка ER:IR молча пропадёт из приоритетов.
        erIr: erIrV.tested ? { warn: erIrV.warn, text: erIrV.text } : null,
      });
    } catch { return []; }
  }, [painMon, moveDriver, asymText, painJointTendon, benchV, nheV, adductorV, loadedHingeV, erIrV, teenGate.blocked]);
  const [screenHist, setScreenHist] = useState<MovementSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem('he_bb_screen_history');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((s) => s && typeof s.date === 'string' && Array.isArray(s.fails)) : [];
    } catch { return []; }
  });
  const screenDelta = useMemo(() => {
    try {
      const prev = screenHist.length ? screenHist[screenHist.length - 1] : null;
      return movementDelta(prev, screenCodes);
    } catch { return { fixed: [], regressed: [], tracked: [], text: '' } as any; }
  }, [screenHist, screenCodes]);
  return {
    ohs,
    lrVerdicts,
    lrDirection,
    redFlags,
    readiness,
    returnToPlan,
    returnActive,
    chipStyle,
    returnCriteria,
    painWorst,
    orthoFlags,
    orthoPrehab,
    orthoSummary,
    moveDriver,
    singleLeg,
    shoulderV,
    rotV,
    hingeV,
    loadedV,
    ybtV,
    asymText,
    driverSubs,
    benchV,
    painMon,
    painJointTendon,
    nheV,
    adductorV,
    loadedHingeV,
    erIrV,
    screenCodes,
    screenPriority,
    screenHist,
    setScreenHist,
    screenDelta,
  };
}
