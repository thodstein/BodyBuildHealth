/**
 * useStrengthSportWizard.ts — хук состояния визарда ТА/стронг (вынесен из StrengthSportConstructor для декомпозиции).
 * Инкапсулирует: режим/цель/уровень/недели/дни, фокус, методика, DUP, workMax, оборудование, травмы, мобильность,
 * вне зала, атлет, интернет-цикл (ss-cycles), годовой выбор, ACWR/HRV, VBT per-lift + история, LVP, тапер, контест,
 * стратегию, medley-превью, слабые точки, bridge-приём (хаб/библиотека), план/год/дневник/msg, busy-сборку.
 * StrengthSportConstructor остаётся тонким оркестратором шагов; шаг плана — в StrengthSportPlanView.
 */
import React, { useState, useMemo, useEffect } from 'react';
import type { StrengthSportInput, StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';
import { defaultOutsideLoadFor, computeOutsideMetrics, type OutsideLoad } from '../../../engines/outside-load.engine';
import { acwrEwmaSS } from '../../../engines/strength-sport/strength-sport-diary.engine';
import { hrvReport } from '../../../engines/strength-sport/strength-sport-hrv.engine';
import { loadAnnualSS } from '../../../engines/strength-sport/strength-sport-annual';
import { rankSSCycle } from '../../../engines/strength-sport/strength-sport-ss-selector.engine';
import { simulateContest } from '../../../engines/strength-sport/strength-sport-contest-simulator.engine';
import { getSSCycleById } from '../../../data/ss-cycles/ss-cycle-index';
import { subscribePlannerApply, getPlannerApply } from '../TrainingScreen_parts/planner-bridge';
import { parseSmBridgePayload } from './sm-bridge-intake';
import { shouldClearVbt } from '../../../engines/strength-sport/strength-sport-planner-pro.engine';
import type { StrongmanContest } from '../../../engines/strength-sport/strength-sport-contest.types';
import { ensureStrongmanApkStyles } from './strongman-apk-loader';

export type StrengthSportStep = 'params' | 'athlete' | 'outside' | 'split' | 'plan' | 'quality' | 'export';

export function useStrengthSportWizard() {
  const [step, setStep] = useState<StrengthSportStep>('params');
  const [mode, setMode] = useState<StrengthSportInput['mode']>('weightlifting');
  const [goal, setGoal] = useState<StrengthSportInput['goal']>('strength');
  const [level, setLevel] = useState<StrengthSportInput['level']>('intermediate');
  const [weeks, setWeeks] = useState(8);
  const [days, setDays] = useState(3);
  const [focus, setFocus] = useState<StrengthSportInput['focus']>(null);
  const [methodology, setMethodology] = useState<StrengthSportInput['methodology']>('compound_first');
  const [dupMode, setDupMode] = useState<StrengthSportInput['dupMode']>('off');
  const [intensityTech, setIntensityTech] = useState<StrengthSportInput['intensityTech']>('none');
  const [workMax, setWorkMax] = useState<StrengthSportInput['workMax']>({ backSquat: 120, deadlift: 160, snatch: 70, cleanJerk: 90, overheadPress: 60, yokeWalk: 200, farmersWalk: 140, atlasStone: 100 } as any);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [mobility, setMobility] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<any[]>([]);
  const [injInput, setInjInput] = useState('');
  const [outside, setOutside] = useState<OutsideLoad | null>(defaultOutsideLoadFor('weightlifting'));
  const [outsideEnabled, setOutsideEnabled] = useState(false);
  const [sex, setSex] = useState<'male'|'female'>('male');
  const [bodyweight, setBodyweight] = useState<number>(80);
  const [age, setAge] = useState<number>(30);
  const [competitionDate, setCompetitionDate] = useState<string>('');
  const [patternId, setPatternId] = useState<string>('');
  // Интернет-цикл ТА/стронга (ss-cycles): дословный режим по умолчанию
  const [cycleId, setCycleId] = useState<string>(() => { try { return localStorage.getItem('he_ss_cycle_v1') || ''; } catch { return ''; } });
  const [cycleMode, setCycleMode] = useState<'faithful'|'adapt'>(() => { try { return (localStorage.getItem('he_ss_cycle_mode_v1') as any) || 'faithful'; } catch { return 'faithful'; } });
  const [cycleConsent, setCycleConsent] = useState<boolean>(false);
  // Ручной выбор циклов для годовой сборки (null = авто топ-3), персист
  const [annualCycleSel, setAnnualCycleSel] = useState<string[] | null>(() => {
    try {
      const raw = localStorage.getItem('he_ss_annual_cycles_v1');
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) && arr.length ? arr.map(String) : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (annualCycleSel && annualCycleSel.length) localStorage.setItem('he_ss_annual_cycles_v1', JSON.stringify(annualCycleSel));
      else localStorage.removeItem('he_ss_annual_cycles_v1');
    } catch {}
  }, [annualCycleSel]);
  const [acwr, setAcwr] = useState<{ ratio:number; zone:string } | null>(null);
  const [hrv, setHrv] = useState<any>(null);
  const [velocityLoss, setVelocityLoss] = useState<number>(0);
  const [vbtPerLift, setVbtPerLift] = useState<Record<string, {best:number,last:number}>>({ snatch:{best:0,last:0}, clean:{best:0,last:0}, squat:{best:0,last:0} });
  const [lvpLift, setLvpLift] = useState<string>('snatch');
  const [lvpPoints, setLvpPoints] = useState<Array<{pct:number,velocity:number}>>([{pct:0.5, velocity:2.70},{pct:0.65, velocity:2.15},{pct:0.80, velocity:1.80},{pct:0.90, velocity:1.55}]);
  const [lvpResult, setLvpResult] = useState<any>(null);
  const [taperWeeks, setTaperWeeks] = useState<number>(1);
  // Planner PRO P1–P7 (персист he_ss_pro_*; дефолты = старое поведение)
  const [weightClass, setWeightClass] = useState<string>(() => { try { return localStorage.getItem('he_ss_pro_weightclass') || ''; } catch { return ''; } });
  const [rpeCap, setRpeCap] = useState<number>(() => { try { return Number(localStorage.getItem('he_ss_pro_rpecap')) || 9.5; } catch { return 9.5; } });
  const [deadliftGrip, setDeadliftGrip] = useState<'overhand'|'straps'|'mixed'>(() => { try { return (localStorage.getItem('he_ss_pro_grip') as any) || 'overhand'; } catch { return 'overhand'; } });
  const [blockModel, setBlockModel] = useState<'strong5'|'toro4'|'wave'>(() => { try { return (localStorage.getItem('he_ss_pro_block') as any) || 'strong5'; } catch { return 'strong5'; } });
  const [autoDeload, setAutoDeload] = useState<boolean>(() => { try { const v = localStorage.getItem('he_ss_pro_autodeload'); return v == null ? true : v === '1'; } catch { return true; } });
  const [conditioningDay, setConditioningDay] = useState<boolean>(() => { try { const v = localStorage.getItem('he_ss_pro_condday'); return v == null ? true : v === '1'; } catch { return true; } });
  useEffect(() => { try { if (weightClass) localStorage.setItem('he_ss_pro_weightclass', weightClass); else localStorage.removeItem('he_ss_pro_weightclass'); } catch {} }, [weightClass]);
  useEffect(() => { try { localStorage.setItem('he_ss_pro_rpecap', String(rpeCap)); } catch {} }, [rpeCap]);
  useEffect(() => { try { localStorage.setItem('he_ss_pro_grip', deadliftGrip); } catch {} }, [deadliftGrip]);
  useEffect(() => { try { localStorage.setItem('he_ss_pro_block', blockModel); } catch {} }, [blockModel]);
  useEffect(() => { try { localStorage.setItem('he_ss_pro_autodeload', autoDeload ? '1' : '0'); } catch {} }, [autoDeload]);
  useEffect(() => { try { localStorage.setItem('he_ss_pro_condday', conditioningDay ? '1' : '0'); } catch {} }, [conditioningDay]);
  const [contest, setContest] = useState<StrongmanContest | null>(null);
  const [contestStrategy, setContestStrategy] = useState<'conservative'|'balanced'|'aggressive'>('balanced');
  const [medleyPreview, setMedleyPreview] = useState<{ id:string; label:string; distanceM:number; timeCapS:number }[]>([
    { id:'yoke_walk', label:'Йок', distanceM:20, timeCapS:60 },
    { id:'farmers_walk_heavy', label:'Фермер', distanceM:40, timeCapS:60 },
    { id:'atlas_stone_load', label:'Камень', distanceM:0, timeCapS:60 },
  ]);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [diagnosticLevel, setDiagnosticLevel] = useState<string>('');
  // VBT-история и sway из хаба (bridge): hubVelocity идёт в velocityHistory билда напрямую,
  // минуя vbtMap (у него другой формат ключей week-day-ex-set).
  const [hubVelocity, setHubVelocity] = useState<Record<string, number[]>>({});
  const [swayCmBridge, setSwayCmBridge] = useState<number | null>(null);
  // J7 орто-скрининг: сводка в rationale плана (паттерн swayCmBridge).
  const [orthoNote, setOrthoNote] = useState<string | null>(null);
  // V4-добой (G8): заявки/Sinclair/спец-блок ТА-хаба — в rationale плана + бейдж.
  // V4-добой-2 (П1): + причины/коррекции/FvR/асимметрия/OHS.
  const [taBridge, setTaBridge] = useState<{ attempts: { snatch: number[]; cj: number[] } | null; sinclair: { total: number; value: number; cycle?: string | null; q?: number | null } | null; specWeeks: number | null; prefCorr: Record<string, string> | null; causes: Record<string, string> | null; fvr: { snatchTh: number; pmax: number } | null; asymPct: number | null; ohsFailed: number | null; specTargets: number[] | null }>({ attempts: null, sinclair: null, specWeeks: null, prefCorr: null, causes: null, fvr: null, asymPct: null, ohsFailed: null, specTargets: null });
  // Приём из хабов ТА/стронг (planner-bridge weakpoints → weightlifting/strongman)
  // через чистый parseSmBridgePayload (см. sm-bridge-intake.ts + его тест).
  // + мост из Библиотеки (каталог циклов → kind 'ss_cycle': ставит цикл+режим+сроки).
  useEffect(() => {
    const apply = (payload: any) => {
      if (!payload) return;
      if (payload.kind === 'ss_cycle') {
        try {
          const id = String(payload.data?.cycleId || '');
          const tpl = id ? getSSCycleById(id) : undefined;
          if (!tpl) { setMsg(`⚠ Цикл ${id || '—'} не найден в библиотеке`); setTimeout(()=>setMsg(''),2200); return; }
          setCycleId(id);
          setMode(tpl.meta.mode as any);
          setWeeks(tpl.meta.weeks);
          setDays(tpl.meta.sessionsPerWeek);
          setStep('split');
          setMsg(`↩ Цикл из библиотеки: ${tpl.meta.title}`); setTimeout(()=>setMsg(''),2600);
        } catch {}
        return;
      }
      if (payload.kind !== 'weakpoints' || !payload.data) return;
      const p = parseSmBridgePayload(payload.data);
      // Contest packet from SM hub
      if (p.contest) {
        setContest(p.contest as any);
        setMode('strongman' as any);
      }
      // Turn/platform synthetic via hub fields
      if (payload.data?.turnNeeded || payload.data?.platformHeightCm != null) {
        // will be handled via contest merge on next build; ensure mode strongman
        setMode('strongman' as any);
      }
      // Стратегия попыток из хаба (раньше молча терялась — всегда был 'balanced')
      if (p.strategy) setContestStrategy(p.strategy);
      // VBT/sway/уровень живут вне гейта слабых: иначе VBT-only пакеты молча умирали.
      if (p.diagnosticLevel) setDiagnosticLevel(p.diagnosticLevel);
      // VBT history from SM hub — в отдельный стейт (формат {liftId:[точки]},
      // в vbtMap нельзя: там ключи week-day-ex-set, build() такое отбрасывает)
      if (Object.keys(p.hubVelocity).length > 0) {
        try { setHubVelocity(prev => ({ ...prev, ...p.hubVelocity })); } catch {}
      }
      if (p.velocityLossPct != null) setVelocityLoss(p.velocityLossPct);
      // Sway carry из хаба — в rationale плана (у билдера нет sway-входа)
      if (p.swayCm != null) setSwayCmBridge(p.swayCm);
      // J7 орто-скрининг: гарды ПРИМЕНЯЮТСЯ.
      // mobility-merge — живой фильтр пула; yoke/teen — смягчение стратегии + rationale.
      if (Array.isArray(p.orthoMobility) && p.orthoMobility.length > 0) {
        try { setMobility((prev: string[]) => Array.from(new Set([...(prev || []), ...p.orthoMobility]))); } catch {}
      }
      if (p.orthoYokeGate) {
        try { setContestStrategy((prev) => (prev === 'aggressive' ? 'balanced' : prev)); } catch {}
        setMsg('🦴 Орто-гейт: йок/фермер — стратегия смягчена, трекинг/лента'); setTimeout(() => setMsg(''), 2600);
      }
      if (p.orthoTeen) {
        try { setContestStrategy('conservative'); } catch {}
        setMsg('🧒 Teen 14–15: консервативный режим (без максимумов, RIR≥2)'); setTimeout(() => setMsg(''), 2600);
      }
      // П1/П2: Beighton closedChainOnly — тоже консервативный режим (щадящий, без максимумов).
      if (p.orthoClosedChain) {
        try { setContestStrategy('conservative'); } catch {}
        setMsg('🦴 Beighton+: консервативный режим (закрытая цепь, без end-range)'); setTimeout(() => setMsg(''), 2600);
      }
      if (p.orthoSummary || p.orthoYokeGate || p.orthoTeen || p.orthoClosedChain) {
        try {
          const parts: string[] = [];
          if (p.orthoSummary) parts.push(p.orthoSummary);
          if (p.orthoYokeGate) parts.push('йок/фермер-гейт');
          if (p.orthoTeen) parts.push('teen 14–15');
          if (p.orthoClosedChain) parts.push('Beighton+: закрытая цепь, без end-range');
          if (p.orthoBlocked.length) parts.push(`блок: ${p.orthoBlocked.join(', ')}`);
          setOrthoNote(parts.join(' · ').slice(0, 300));
        } catch {}
      }
      if (p.orthoMobility.length) {
        try { localStorage.setItem('he_ss_ortho_mobility', JSON.stringify(p.orthoMobility)); } catch {}
      }
      // Э3: мост без орто-полей снимает ранее отслеженное (только свои id).
      const hasOrtho = p.orthoMobility.length > 0 || p.orthoYokeGate || p.orthoTeen || p.orthoClosedChain || p.orthoSummary != null || p.orthoBlocked.length > 0;
      if (!hasOrtho) {
        try {
          const raw = localStorage.getItem('he_ss_ortho_mobility');
          const tm: unknown = raw ? JSON.parse(raw) : [];
          if (Array.isArray(tm) && tm.length) {
            setMobility((prev: string[]) => (prev || []).filter((x) => !tm.includes(x)));
            setMsg('🦴 Орто-гарды сняты'); setTimeout(() => setMsg(''), 2600);
          }
          localStorage.removeItem('he_ss_ortho_mobility');
          setOrthoNote(null);
        } catch {}
      }
      // V4-добой (G8): заявки/Sinclair/спец-блок ТА — вне гейта слабых.
      // V4-добой-2 (П1): + причины/коррекции/FvR/асимметрия/OHS.
      if (p.taAttempts || p.taSinclair || p.taSpecWeeks != null || p.taPreferredCorr || p.taWeakCauses || p.taFvr || p.taAsymPct != null || p.taOhsFailed != null || p.taSpecTargets) {
        try { setTaBridge({ attempts: p.taAttempts, sinclair: p.taSinclair, specWeeks: p.taSpecWeeks, prefCorr: p.taPreferredCorr, causes: p.taWeakCauses, fvr: p.taFvr, asymPct: p.taAsymPct, ohsFailed: p.taOhsFailed, specTargets: p.taSpecTargets }); } catch {}
      }
      if (Array.isArray(p.weakPoints) && p.weakPoints.length > 0) {
        setWeakPoints(p.weakPoints);
        if (p.mode) setMode(p.mode as any);
      }
    };
    try {
      const cur = getPlannerApply() as any;
      if (cur) apply(cur);
    } catch {}
    const unsub = subscribePlannerApply((p) => { try { apply(p as any); } catch {} });
    return () => { try { unsub(); } catch {} };
  }, []);
  // APK-слой: подгрузка styles-native-strongman.css только в native (в TG/web no-op).
  useEffect(() => {
    ensureStrongmanApkStyles();
  }, []);
  const [vbtMap, setVbtMap] = useState<Record<string, number>>(() => {
    try { const raw = localStorage.getItem('he_vbt_ss_v1'); return raw ? JSON.parse(raw) as Record<string,number> : {}; } catch { return {}; }
  });
  // Planner PRO P6: stale-VBT — смена цикла/режима чистит замеры week-day-ex-set (история не переживает rebuild).
  const prevCycleRef = React.useRef<{ cycleId: string; mode: string } | null>(null);
  useEffect(() => {
    try {
      const prev = prevCycleRef.current;
      if (prev && shouldClearVbt(prev.cycleId, cycleId, prev.mode, mode)) setVbtMap({});
      prevCycleRef.current = { cycleId, mode };
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, mode]);
  const [plan, setPlan] = useState<StrengthSportPlan | null>(null);
  const [annual, setAnnual] = useState(() => loadAnnualSS());
  const [diaryLoad, setDiaryLoad] = useState<number | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);
  const [msg, setMsg] = useState('');
  // Сборка тяжёлая (до 16 нед) — флаг busy + yield, чтобы UI не фризил без отклика.
  const [building, setBuilding] = useState(false);
  const [buildStage, setBuildStage] = useState('Собираем план…');
  const tick = () => new Promise<void>(r => setTimeout(r, 0));

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);
  const contestSim = useMemo(() => {
    if (!contest || mode !== 'strongman') return null;
    try { return simulateContest(contest as any, workMax as any, contestStrategy as any); } catch { return null; }
  }, [contest, workMax, contestStrategy, mode]);
  useEffect(() => { try { localStorage.setItem('he_vbt_ss_v1', JSON.stringify(vbtMap)); } catch {} }, [vbtMap]);
  useEffect(() => { try { localStorage.setItem('he_ss_cycle_v1', cycleId); } catch {} }, [cycleId]);
  useEffect(() => { try { localStorage.setItem('he_ss_cycle_mode_v1', cycleMode); } catch {} }, [cycleMode]);
  // Ранжирование интернет-циклов под текущие параметры (селектор ss-cycles)
  const rankedCycles = useMemo(() => {
    try {
      let contestEvents: string[] | undefined;
      try {
        const evs = (contest as any)?.events;
        if (Array.isArray(evs)) contestEvents = evs.map((e: any) => String(e.id)).filter(Boolean);
      } catch { contestEvents = undefined; }
      return rankSSCycle({ mode, level, daysPerWeek: days, weeks, equipment, goal, acwrZone: (acwr as any)?.zone || null, cycleConsent, weakPoints: weakPoints.length ? weakPoints : undefined, contestEvents, age });
    } catch { return []; }
  }, [mode, level, days, weeks, equipment, goal, acwr, cycleConsent, weakPoints, contest, age]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('he_srpe_sessions') || localStorage.getItem('he_training_log') || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        const week = arr.slice(-7).reduce((a:any, s:any)=> a + (s.load || s.sRPE || s.rpe || 0), 0);
        setDiaryLoad(week);
        try{
          const daily: Record<string, number> = {};
          for(const s of arr){ const d=(s.date||'').slice(0,10); if(d) daily[d]=(daily[d]||0)+(s.load||s.sRPE||s.rpe||0); }
          const vals = Object.values(daily).slice(-28);
          const ew = acwrEwmaSS(vals as number[]);
          if(ew) setAcwr({ ratio: ew.ratio, zone: ew.zone });
        }catch{}
      }
      // HRV EWMA
      try {
        const hrvRaw = localStorage.getItem('he_hrv_log');
        if (hrvRaw) {
          const hArr = JSON.parse(hrvRaw);
          const vals = Array.isArray(hArr) ? hArr.map((s:any)=> s.hrvMs ?? s.hrv ?? s.value).filter((v:any)=> Number.isFinite(v)) as number[] : [];
          if (vals.length >= 7) {
            const rep = hrvReport(vals);
            if (rep) setHrv(rep);
          }
        }
      } catch {}
    } catch {}
  }, [plan]);

  return {
    step, setStep,
    mode, setMode, goal, setGoal, level, setLevel, weeks, setWeeks, days, setDays,
    focus, setFocus, methodology, setMethodology, dupMode, setDupMode, intensityTech, setIntensityTech,
    workMax, setWorkMax, equipment, setEquipment, mobility, setMobility,
    injuries, setInjuries, injInput, setInjInput,
    outside, setOutside, outsideEnabled, setOutsideEnabled,
    sex, setSex, bodyweight, setBodyweight, age, setAge,
    competitionDate, setCompetitionDate, patternId, setPatternId,
    cycleId, setCycleId, cycleMode, setCycleMode, cycleConsent, setCycleConsent,
    annualCycleSel, setAnnualCycleSel,
    acwr, setAcwr, hrv, setHrv, velocityLoss, setVelocityLoss,
    vbtPerLift, setVbtPerLift, lvpLift, setLvpLift, lvpPoints, setLvpPoints, lvpResult, setLvpResult,
    taperWeeks, setTaperWeeks, contest, setContest, contestStrategy, setContestStrategy,
    weightClass, setWeightClass, rpeCap, setRpeCap, deadliftGrip, setDeadliftGrip,
    blockModel, setBlockModel, autoDeload, setAutoDeload, conditioningDay, setConditioningDay,
    medleyPreview, setMedleyPreview, weakPoints, setWeakPoints, diagnosticLevel, setDiagnosticLevel,
    hubVelocity, setHubVelocity, swayCmBridge, setSwayCmBridge,
    orthoNote, setOrthoNote,
    taBridge, setTaBridge,
    vbtMap, setVbtMap, plan, setPlan, annual, setAnnual,
    diaryLoad, setDiaryLoad, expandedWeek, setExpandedWeek, msg, setMsg,
    building, setBuilding, buildStage, setBuildStage, tick,
    outsideMetrics, contestSim, rankedCycles,
  };
}

export type StrengthSportWizard = ReturnType<typeof useStrengthSportWizard>;
