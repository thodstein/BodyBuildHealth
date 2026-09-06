/**
 * StrengthSportConstructor.tsx — премиальный конструктор Стронгмен / ТА.
 * Стекло + градиенты, современный мобильный стиль. Полностью изолирован.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { subscribePlannerApply, getPlannerApply } from '../TrainingScreen_parts/planner-bridge';
import { buildStrengthSportPlan } from '../../../engines/strength-sport/strength-sport-builder.engine';
import { finalizeStrengthSportPlan, buildStrengthSportReport } from '../../../engines/strength-sport/strength-sport-finalize.engine';
import { STRENGTH_SPORT_PATTERNS, recommendStrengthSportPattern } from '../../../engines/strength-sport/strength-sport-split-patterns';
import { buildStrengthCsv, downloadStrengthCsv, downloadStrengthXlsx, buildStrengthPrintHtml, shareStrengthDigest, buildStrengthTelegramUrl, buildStrengthShareHash, downloadStrengthIcs } from '../../../engines/strength-sport/strength-sport-export';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { WL_WEAKPOINT_LABELS } from '../../../engines/strength-sport/strength-sport-weakpoint';
import { buildWLMeetPlan, wlAttemptRationale } from '../../../engines/strength-sport/strength-sport-attempts.engine';
import { buildSMEventPlan, smEventRationale, pointsForPlace, buildStrongmanPoints } from '../../../engines/strength-sport/strength-sport-strongman-attempts.engine';
import { CONTEST_PRESETS, type StrongmanContest } from '../../../engines/strength-sport/strength-sport-contest.types';
import { EVENT_META } from '../../../engines/strength-sport/strength-sport-event-types';
import { TAPER_CESSATION_DAYS } from '../../../engines/strength-sport/strength-sport-taper.engine';
import { buildConditioningRationale } from '../../../engines/strength-sport/strength-sport-conditioning';
import { syncStrengthAnnualToGeneral } from '../../../engines/strength-sport/strength-sport-annual-bridge';
import { estimate1RMFromVelocitySS, VBT_SS_THRESHOLDS, velocityTypeForLift } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { calibrateLVP, saveLVPProfile, loadLVPProfiles, velocityForLVP } from '../../../engines/strength-sport/strength-sport-lvp-calibration.engine';
import { hrvReport } from '../../../engines/strength-sport/strength-sport-hrv.engine';
import { simulateContest } from '../../../engines/strength-sport/strength-sport-contest-simulator.engine';
import { intensityZoneFor } from '../../../engines/strength-sport/strength-sport-progression';
import { acwrEwmaSS } from '../../../engines/strength-sport/strength-sport-diary.engine';
import { injectTAWeakPoints } from '../../../engines/strength-sport/strength-sport-ta-injection.engine';
import { injectSMWeakPoints } from '../../../engines/strength-sport/strength-sport-sm-injection.engine';
import { saveStrengthSportPlan, loadStrengthSportPlans } from '../../../engines/strength-sport/strength-sport-storage';
import { applyMesocycleProgression } from '../../../engines/strength-sport/strength-sport-mesocycle';
import { buildAnnualFromSS, buildAnnualWithTaper, buildAnnualMultiPeak, saveAnnualSS, loadAnnualSS, moveAnnualBlock } from '../../../engines/strength-sport/strength-sport-annual';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import { SS_CYCLES, getSSCycleById } from '../../../data/ss-cycles/ss-cycle-index';
import { rankSSCycle, recommendSSCycle } from '../../../engines/strength-sport/strength-sport-ss-selector.engine';
import { buildSSCyclePlan } from '../../../engines/strength-sport/strength-sport-ss-cycle-to-plan.engine';
import { buildAnnualFromSSCycles } from '../../../engines/strength-sport/strength-sport-ss-annual.engine';
import type { StrengthSportInput, StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';
import { getWL, getStrong } from '../../../engines/strength-sport/strength-sport-volume';
import { isNativeApp } from '../../../core/app-platform';
import { ensureStrongmanApkStyles } from './strongman-apk-loader';
import { CARD, CARD_ACCENT, CARD_STRONG, CARD_HERO, ROW, LABEL, HINT, HINT_SM, BTN, BTN_PRIMARY, BTN_SMALL, BTN_STRONG, BTN_GHOST, INPUT, SELECT, CHIP, CHIP_ACTIVE, CHIP_STRONG_ACTIVE, PHASE_COLOR, MODE_COLOR, ACCENT, ACCENT_STRONG, ACCENT_SOFT, STRONG_SOFT, ACCENT_BORDER, STRONG_BORDER, ACCENT_GRAD, STRONG_GRAD, TEXT_1, TEXT_2, TEXT_3, SectionCard, StatTile, Badge, InfoBanner, GroupHeading, SectionNav, ProgressBar, ChipToggle, Field, Divider, CardHeader, Highlight, HighlightStrong, StrengthPopupSelect, StrengthPopupNumber, EventCard, StrengthGantt, StrengthHeatmap, MODE_RU, LEVEL_RU, PHASE_RU, ZONE_RU, EQUIP_RU, MOBILITY_RU, SESSION_TAG_RU, ruLabel } from './StrengthUI';

type Step = 'params' | 'outside' | 'split' | 'plan';
const STEP_LABEL_RU: Record<Step,string> = { params:'Параметры', outside:'Вне зала', split:'Сплит', plan:'План' };
const WM_LABEL_RU: Record<string,string> = { backSquat:'Присед', frontSquat:'Фронт. присед', deadlift:'Тяга', snatch:'Рывок', cleanJerk:'Толчок', overheadPress:'Жим стоя', yokeWalk:'Йок', farmersWalk:'Фермер', frameCarry:'Рама', husafellCarry:'Хусафелл', sandbagLoad:'Мешок загр.', kegToss:'Бочка', carDeadlift:'Автотяга', axlePress:'Аксель-жим', atlasStone:'Камень', axleDeadlift:'Аксель', logPress:'Лог' };

export const StrengthSportConstructor: React.FC = () => {
  const [step, setStep] = useState<Step>('params');
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
  React.useEffect(() => {
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
  const [contest, setContest] = useState<StrongmanContest | null>(null);
  const [contestStrategy, setContestStrategy] = useState<'conservative'|'balanced'|'aggressive'>('balanced');
  const [medleyPreview, setMedleyPreview] = useState<{ id:string; label:string; distanceM:number; timeCapS:number }[]>([
    { id:'yoke_walk', label:'Йок', distanceM:20, timeCapS:60 },
    { id:'farmers_walk_heavy', label:'Фермер', distanceM:40, timeCapS:60 },
    { id:'atlas_stone_load', label:'Камень', distanceM:0, timeCapS:60 },
  ]);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [diagnosticLevel, setDiagnosticLevel] = useState<string>('');
  // Приём из хабов ТА/стронг (planner-bridge weakpoints → weightlifting/strongman)
  useEffect(() => {
    const apply = (payload: any) => {
      if (!payload || payload.kind !== 'weakpoints') return;
      const merged: string[] = [
        ...((payload.data?.smWeakPoints as string[]) || []),
        ...((payload.data?.groups as string[]) || []),
        ...((payload.data?.wlWeakPoints as string[]) || []),
        ...((payload.data?.weakPoints as string[]) || []),
      ];
      const groups: string[] | undefined = merged.length ? Array.from(new Set(merged.map((s: any) => String(s)))) as string[] : undefined;
      // Contest packet from SM hub
      const incomingContest: any = payload.data?.contest || payload.data?.smContest || null;
      if (incomingContest && typeof incomingContest === 'object' && Array.isArray(incomingContest.events)) {
        setContest(incomingContest as any);
        setMode('strongman' as any);
      }
      // Turn/platform synthetic via hub fields
      if (payload.data?.turnNeeded || payload.data?.platformHeightCm != null) {
        // will be handled via contest merge on next build; ensure mode strongman
        setMode('strongman' as any);
      }
      if (Array.isArray(groups) && groups.length > 0) {
        setWeakPoints(groups.slice(0, 4).map((s: string) => String(s)));
        if (payload.data?.level) setDiagnosticLevel(String(payload.data.level));
        else if (payload.data?.diagnosticLevel) setDiagnosticLevel(String(payload.data.diagnosticLevel));
        if (payload.data?.smWeakPoints) setMode('strongman' as any);
        else if (payload.data?.wlWeakPoints) setMode('weightlifting' as any);
        // VBT history / sway from SM hub
        if (payload.data?.velocityHistory && typeof payload.data.velocityHistory === 'object') {
          try { setVbtMap(prev => ({ ...prev, ...payload.data.velocityHistory } as any)); } catch {}
        }
        if (payload.data?.velocityLossPct != null) setVelocityLoss(Number(payload.data.velocityLossPct) || 0);
        else if (payload.data?.vbtLossPct != null) setVelocityLoss(Number(payload.data.vbtLossPct) || 0);
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
  const [plan, setPlan] = useState<StrengthSportPlan | null>(null);
  const [annual, setAnnual] = useState(() => loadAnnualSS());
  const [diaryLoad, setDiaryLoad] = useState<number | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);
  const [msg, setMsg] = useState('');

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);
  const contestSim = useMemo(() => {
    if (!contest || mode !== 'strongman') return null;
    try { return simulateContest(contest as any, workMax as any, contestStrategy as any); } catch { return null; }
  }, [contest, workMax, contestStrategy, mode]);
  React.useEffect(() => { try { localStorage.setItem('he_vbt_ss_v1', JSON.stringify(vbtMap)); } catch {} }, [vbtMap]);
  React.useEffect(() => { try { localStorage.setItem('he_ss_cycle_v1', cycleId); } catch {} }, [cycleId]);
  React.useEffect(() => { try { localStorage.setItem('he_ss_cycle_mode_v1', cycleMode); } catch {} }, [cycleMode]);
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

  React.useEffect(() => {
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

  const pullFromProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (!raw) return;
      const p = JSON.parse(raw);
      const personal = p.personal || {};
      const training = p.training || p;
      const health = p.health || {};
      if (training.workMax) setWorkMax(s => ({ ...s, ...training.workMax }));
      if (personal.workMax) setWorkMax(s => ({ ...s, ...personal.workMax }));
      if (training.level) setLevel(training.level);
      else if (personal.level) setLevel(personal.level);
      if (personal.sex) setSex(personal.sex === 'female' ? 'female' : 'male');
      if (typeof personal.weight === 'number') setBodyweight(personal.weight);
      else if (typeof personal.bodyweight === 'number') setBodyweight(personal.bodyweight);
      if (typeof personal.age === 'number') setAge(personal.age);
      if (Array.isArray(health.injuries)) setInjuries(health.injuries);
      else if (Array.isArray(training.injuries)) setInjuries(training.injuries);
      if (Array.isArray(training.equipment)) setEquipment(training.equipment);
      else if (Array.isArray(personal.equipment)) setEquipment(personal.equipment);
      if (Array.isArray(health.mobilityRestrictions)) setMobility(health.mobilityRestrictions);
      else if (Array.isArray(training.mobilityRestrictions)) setMobility(training.mobilityRestrictions);
      const sport = (training.sportType || p.goals?.primaryGoal || '').toLowerCase();
      if (sport.includes('weightlifting') || sport.includes('та')) setOutside(defaultOutsideLoadFor('weightlifting'));
      else if (sport.includes('strongman') || sport.includes('стронг')) setOutside(defaultOutsideLoadFor('strongman'));
      setMsg('✦ Профиль подтянут'); setTimeout(()=>setMsg(''), 2200);
    } catch {}
  };

  const build = () => {
    let extra: any = {};
    try{
      const raw = localStorage.getItem('he_profile_v2');
      if(raw){
        const p = JSON.parse(raw);
        const personal = p.personal || {};
        const lifestyle = p.lifestyle || {};
        extra.bodyFat = typeof personal.bodyFat === 'number' ? personal.bodyFat : undefined;
        extra.leanMass = typeof personal.bodyFat === 'number' && typeof personal.weight === 'number' ? Math.round(personal.weight * (1 - personal.bodyFat/100)) : undefined;
        extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined;
        extra.sleepHours = typeof lifestyle.sleepHours === 'number' ? lifestyle.sleepHours : undefined;
        extra.stressLevel = typeof lifestyle.stressLevel === 'number' ? lifestyle.stressLevel : undefined;
        extra.calorieSurplus = typeof p.nutrition?.calorieSurplus === 'number' ? p.nutrition.calorieSurplus : undefined;
        extra.proteinPerKg = typeof p.nutrition?.proteinPerKg === 'number' ? p.nutrition.proteinPerKg : undefined;
        const ph = p.pharma || {};
        if(Array.isArray(ph.currentSubstances) && ph.currentSubstances.length) extra.peds = ph.currentSubstances;
      }
    }catch{}
    let diaryTrend: any[] | null = null;
    try{
      const rawLog = localStorage.getItem('he_workout_log') || localStorage.getItem('he_training_log') || localStorage.getItem('he_workout_history') || '[]';
      const logs = JSON.parse(rawLog);
      if(Array.isArray(logs) && logs.length){
        const epley = (w:number,r:number)=> w*(1+r/30);
        const now = Date.now(); const dayMs=24*3600*1000;
        const lifts = [
          { key:'snatch', names:['snatch','рывок'] },
          { key:'clean', names:['clean','толчок','clean_and_jerk'] },
          { key:'squat', names:['squat','присед','back_squat','front_squat'] },
          { key:'deadlift', names:['deadlift','тяга'] },
        ];
        diaryTrend=[];
        for(const lf of lifts){
          const recent = logs.filter((e:any)=>{
            const n=(e.exerciseName||e.name||'').toLowerCase();
            return lf.names.some(k=> n.includes(k)) && Array.isArray(e.sets) && (()=>{ const d=e.date||''; const t=new Date(d).getTime(); return now-t<=28*dayMs && now-t>=0; })();
          }).map((e:any)=> Math.max(...(e.sets as any[]).map((s:any)=> epley(s.weight||0,s.reps||0)))).filter((v:number)=> v>0);
          const prev = logs.filter((e:any)=>{
            const n=(e.exerciseName||e.name||'').toLowerCase();
            const d=e.date||''; const t=new Date(d).getTime();
            return lf.names.some(k=> n.includes(k)) && Array.isArray(e.sets) && now-t>28*dayMs && now-t<=56*dayMs;
          }).map((e:any)=> Math.max(...(e.sets as any[]).map((s:any)=> epley(s.weight||0,s.reps||0)))).filter((v:number)=> v>0);
          if(recent.length && prev.length){
            const maxR=Math.max(...recent), maxP=Math.max(...prev);
            diaryTrend.push({ lift: lf.key, changePct: Math.round(((maxR-maxP)/maxP*100)*10)/10 });
          }
        }
        if(diaryTrend.length===0) diaryTrend=null;
      }
    }catch{}
    let velocityHistory: Record<string, number[]> | undefined;
    try {
      const grouped: Record<string, number[]> = {};
      for (const [k,v] of Object.entries(vbtMap as Record<string, number>)) {
        if (!v || v<=0) continue;
        const parts = String(k).split('-');
        const exId = parts.slice(2, -1).join('-');
        if (!exId) continue;
        if (!grouped[exId]) grouped[exId]=[];
        grouped[exId].push(v);
        if (grouped[exId].length>3) grouped[exId]=grouped[exId].slice(-3);
      }
      if (Object.keys(grouped).length) velocityHistory = grouped;
    } catch {}
    // per-lift VBT 3× → velocityHistory (приоритет)
    try {
      for (const [lift, vals] of Object.entries(vbtPerLift as Record<string, { best: number; last: number }>)) {
        if (vals.best>0 && vals.last>0) {
          if (!velocityHistory) velocityHistory = {};
          if (!velocityHistory[lift]) velocityHistory[lift] = [];
          // best/last как 2 точки истории для EWMA
          velocityHistory[lift] = [...(velocityHistory[lift]||[]), vals.best, vals.last].slice(-3);
        }
      }
    } catch {}
    let input: StrengthSportInput = {
      mode, goal, level, weeks, daysPerWeek: days, workMax, focus, methodology, dupMode, intensityTech,
      outsideLoad: outsideEnabled ? outside : null,
      equipment, injuries, mobilityRestrictions: mobility as any,
      sex, bodyweight, age,
      competitionDate: competitionDate || undefined,
      startDate: new Date().toISOString().slice(0,10),
      acwr: acwr as any,
      velocityLossPct: velocityLoss > 0 ? velocityLoss : undefined,
      velocityHistory: velocityHistory || undefined,
      patternId: patternId || undefined,
      diaryTrend: diaryTrend || undefined,
      taperWeeks: goal==='peaking' ? taperWeeks : undefined,
      weakPoints: weakPoints.length ? weakPoints : undefined,
      contest: mode==='strongman' ? contest : undefined,
      contestStrategy: mode==='strongman' ? contestStrategy : undefined,
      diagnosticLevel: (diagnosticLevel as any) || undefined,
      cycleId: cycleId || undefined,
      cycleMode: cycleId ? cycleMode : undefined,
      cycleConsent: cycleId ? cycleConsent : undefined,
      ...extra,
    } as any;
    try {
      const prev = loadStrengthSportPlans()[0];
      if (prev) input = applyMesocycleProgression(prev, input) as any;
    } catch {}
    // Интернет-цикл (ss-cycles): дословный faithful по умолчанию, иначе параметрический билдер
    let p: StrengthSportPlan;
    {
      const tpl = cycleId ? getSSCycleById(cycleId) : undefined;
      if (tpl) {
        // Цикл задаёт свои недели/дни — синхронизируем слайдеры под шаблон
        if (weeks !== tpl.meta.weeks) setWeeks(tpl.meta.weeks);
        const needDays = Math.min(tpl.meta.sessionsPerWeekMax ?? tpl.meta.sessionsPerWeek, 6);
        if (days !== tpl.meta.sessionsPerWeek && days !== needDays) setDays(tpl.meta.sessionsPerWeek);
        p = buildSSCyclePlan(tpl, { ...input, weeks: tpl.meta.weeks, daysPerWeek: tpl.meta.sessionsPerWeek } as any, { cycleMode, bodyweight, sex });
      } else {
        p = buildStrengthSportPlan(input);
      }
    }
    p = finalizeStrengthSportPlan(p, { outsideLoad: outsideEnabled ? outside : null });
    // Диагностика: инъекция коррекций с MRV-бюджетом (TA vs SM)
    if (weakPoints.length) {
      const isSM = weakPoints.some((wp: string) => /^(log_|yoke_|farmers_|stone_|grip_|core_|conditioning)/.test(String(wp)));
      if (isSM || mode === 'strongman') {
        const inj = injectSMWeakPoints(p, weakPoints as any, { workMax: p.workMax } as any);
        if (inj.injected > 0) p.rationale = inj.plan.rationale;
        p = inj.plan;
        if (inj.notes.length) { try { console.info('[SM injection]', inj.notes.join(' | ')); } catch {} }
        // fallback TA if SM injected 0 and weakPoints look like WL
        if (inj.injected === 0 && weakPoints.some((w: string) => /snatch|clean|jerk|squat|pull|press/.test(String(w).toLowerCase()))) {
          const inj2 = injectTAWeakPoints(p, weakPoints as any, { workMax: p.workMax } as any);
          if (inj2.injected > 0) p.rationale = inj2.plan.rationale;
          p = inj2.plan;
        }
      } else {
        const inj = injectTAWeakPoints(p, weakPoints as any, { workMax: p.workMax } as any);
        if (inj.injected > 0) p.rationale = inj.plan.rationale;
        p = inj.plan;
        if (inj.notes.length) { try { console.info('[TA injection]', inj.notes.join(' | ')); } catch {} }
      }
    }
    if (diagnosticLevel === 'critical') {
      p.weeksData.forEach(w => { if (!w.deload) w.sessions.forEach(s => s.exercises.forEach(e => { const orig = e.workSets.length; const keep = Math.max(2, Math.round(orig * 0.85)); if (keep < orig) { e.workSets = e.workSets.slice(0, keep); e.sets = keep; e.workSets.forEach(ws => ws.rir = Math.min(4, (ws.rir ?? 2) + 1)); } })); });
      p.rationale.push('CRITICAL gate: объём ×0.85 RIR+1 (score≤49)');
    }
    setPlan(p);
    saveStrengthSportPlan(p);
    try {
      const bw = (input as any).bodyweight || 80;
      const nut = { proteinG: Math.round(bw * ((input as any).weightCutKg ? 2.3 : 2.0)), carbsG: Math.round(bw * ((input as any).weightCutKg ? 3 : 5)), note: `TA/стронг ${input.mode} ${input.weeks}нед`, bodyweight: bw, mode: input.mode };
      localStorage.setItem('he_strength_nutrition_payload', JSON.stringify({ planId: p.id, ...nut }));
      window.dispatchEvent(new CustomEvent('he-strength-updated', { detail: { planId: p.id, nutrition: nut } }));
      const wc = (p as any).weightCutProtocol;
      if (wc) localStorage.setItem('he_strength_weightcut_payload', JSON.stringify(wc));
    } catch {}
    try {
      const hist = loadStrengthSportPlans().slice(0, 6);
      const ann = competitionDate ? buildAnnualWithTaper(hist, { competitionDate, taperWeeks: 1 }) : buildAnnualFromSS(hist);
      saveAnnualSS(ann);
      setAnnual(ann);
      try { syncStrengthAnnualToGeneral(ann); } catch {}
      try {
        localStorage.setItem('he_strength_annual_sync_v1', JSON.stringify({ updatedAt: new Date().toISOString(), totalWeeks: ann.totalWeeks, blocks: ann.blocks.map(b=> ({ startWeek: b.startWeek, weeks: b.weeks, mode: b.mode })) }));
        window.dispatchEvent(new CustomEvent('he-strength-annual-updated', { detail: ann }));
      } catch {}
    } catch {}
    setMsg('✦ План собран'); setTimeout(()=>setMsg(''), 2200);
    setStep('plan');
  };

  const updateEx = (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const wk = copy.weeksData[wkIdx];
      if (!wk) return prev;
      const sess = wk.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      if (patch.weight != null) {
        if (patch.weight < 0 || patch.weight > 500) { setMsg('Вес 0–500'); setTimeout(()=>setMsg(''),1800); return prev; }
        ex.weight = patch.weight;
        const wmAny: any = (prev as any)?.inputSnapshot?.workMax || workMax || {};
        let base = 100;
        const lid = ex.id;
        if (['snatch','hang_snatch','power_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','snatch_pull','pause_pull','deficit_pull','snatch_balance','overhead_squat_v2'].includes(lid) || lid.includes('snatch')) base = wmAny.snatch || 60;
        else if (['clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','pause_clean','push_jerk','split_jerk','clean_pull','front_squat_clean_grip','jerk_dip','jerk_recovery','behind_neck_jerk'].includes(lid) || lid.includes('clean') || lid.includes('jerk')) base = wmAny.cleanJerk || wmAny.clean || wmAny.frontSquat || 80;
        else if (['squat','back_squat','front_squat','hack_squat','front_squat_clean_grip','pause_squat','overhead_squat_v2'].includes(lid) || lid.includes('squat')) base = wmAny.backSquat || wmAny.frontSquat || 100;
        else if (['deadlift','sumo_dl','axle_deadlift','car_deadlift_18','rdl','deficit_pull','pause_pull'].includes(lid)) base = wmAny.deadlift || 120;
        else if (['yoke_walk','frame_carry','husafell_carry','farmers_walk_heavy','sandbag_carry','zercher_carry'].includes(lid)) base = wmAny.farmersWalk || wmAny.yokeWalk || 140;
        else if (['atlas_stone_load','stone_lift','sandbag_load','sandbag_shoulder','keg_toss'].includes(lid)) base = wmAny.atlasStone || 100;
        else if (['ohp','push_press','log_press','axle_press','circus_db_press','bench_bar','jerk_recovery','behind_neck_jerk'].includes(lid)) base = wmAny.overheadPress || wmAny.bench || wmAny.logPress || 60;
        const newPct = base ? Math.round(patch.weight / base * 100) : 0;
        ex.workSets = ex.workSets.map(s => ({ ...s, weight: patch.weight!, pct: newPct || s.pct }));
      }
      if (patch.reps != null) {
        ex.reps = patch.reps;
        const [a,b] = patch.reps.split('-').map(n=> parseInt(n,10));
        const avg = Math.round(((a||5)+(b||a||5))/2);
        ex.workSets = ex.workSets.map(s => ({ ...s, reps: avg }));
      }
      if (patch.rir != null) {
        if (patch.rir < 0 || patch.rir > 5) { setMsg('RIR 0–5'); setTimeout(()=>setMsg(''),1800); return prev; }
        ex.rir = patch.rir;
        ex.workSets = ex.workSets.map(s => ({ ...s, rir: patch.rir! }));
      }
      saveStrengthSportPlan(copy);
      return copy;
    });
  };

  const updateSet = (wkIdx: number, day: number, exId: string, setIdx: number, patch: Partial<{ weight:number; reps:number; rir:number; distanceM:number; timeCapS:number }>) => {
    setPlan(prev=>{
      if(!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const ex = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day)?.exercises.find(e=> e.id===exId);
      if(!ex || !ex.workSets[setIdx]) return prev;
      if(patch.weight!=null){
        if(patch.weight<0 || patch.weight>600) return prev;
        (ex.workSets[setIdx] as any).weight = patch.weight;
        ex.weight = Math.round(ex.workSets.reduce((a,s)=>a+s.weight,0)/ex.workSets.length);
      }
      if(patch.reps!=null) (ex.workSets[setIdx] as any).reps = Math.max(1, Math.min(20, patch.reps));
      if(patch.rir!=null) (ex.workSets[setIdx] as any).rir = Math.max(0, Math.min(5, patch.rir));
      if((patch as any).distanceM!=null) (ex.workSets[setIdx] as any).distanceM = Math.max(5, Math.min(100, (patch as any).distanceM));
      if((patch as any).timeCapS!=null) (ex.workSets[setIdx] as any).timeCapS = Math.max(10, Math.min(300, (patch as any).timeCapS));
      saveStrengthSportPlan(copy);
      return copy;
    });
  };
  const moveEx = (wkIdx: number, day: number, exId: string, dir: -1|1) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day);
      if (!sess) return prev;
      const idx = sess.exercises.findIndex(e=> e.id===exId);
      if (idx<0) return prev;
      const nIdx = idx + dir;
      if (nIdx<0 || nIdx>=sess.exercises.length) return prev;
      const tmp = sess.exercises[idx];
      sess.exercises[idx]=sess.exercises[nIdx];
      sess.exercises[nIdx]=tmp;
      saveStrengthSportPlan(copy);
      return copy;
    });
  };
  const exportToUserProgram = () => {
    if (!plan) return;
    const prog: any = {
      id: plan.id,
      meta: { id: plan.id, title: `Стронг+ТА ${plan.mode} ${plan.weeks}нед`, direction: 'strength', createdAt: new Date().toISOString(), source: 'strength-sport', mode: plan.mode, level: plan.level, focus: plan.inputSnapshot?.focus, methodology: plan.inputSnapshot?.methodology, dupMode: (plan.inputSnapshot as any)?.dupMode, intensityTech: (plan.inputSnapshot as any)?.intensityTech },
      weeks: plan.weeksData.map(w=> ({ week: w.week, phase: w.phase, deload: w.deload, sessions: w.sessions.map(s=> ({ day: s.day, tag: s.sessionTag, character: s.character, exercises: s.exercises.map(e=> ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, rir: e.rir, tempo: e.tempo, restSeconds: e.restSeconds, technique: (e as any).technique, warmupSets: e.warmupSets, workSets: e.workSets })) })) })),
      outside: plan.outsideMetrics,
      validation: plan.validation,
    };
    try { saveUserProgram(prog); setMsg('✦ Экспортировано в библиотеку'); setTimeout(()=>setMsg(''),2200); } catch {}
    try { localStorage.setItem('he_last_strength_program', JSON.stringify(prog)); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog, null, 2)); } catch {}
  };

  const stepIndex = (['params','outside','split','plan'] as Step[]).indexOf(step) + 1;
  const modeColor = mode === 'weightlifting' ? '#00e68a' : mode === 'strongman' ? '#f59e0b' : '#0ea5e9';
  const modeGrad = mode === 'weightlifting' ? ACCENT_GRAD : mode === 'strongman' ? STRONG_GRAD : 'linear-gradient(135deg, #0ea5e9, #6366f1)';
  const SelectWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ position: 'relative' }}>{children}<span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>▾</span></div>
  );

  return (
    <div className={isNativeApp() ? 'train-strong ss-apk' : 'train-strong'} data-ss="root" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860, margin: '0 auto' }}>
      <style>{`input[type="range"]{ -webkit-appearance:none; appearance:none; height:6px; border-radius:999px; background:rgba(255,255,255,0.08); }
        input[type="range"]::-webkit-slider-thumb{ -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:${mode === 'strongman' ? '#f59e0b' : mode === 'hybrid' ? '#0ea5e9' : '#00e68a'}; border:2px solid #fff; box-shadow:0 2px 10px rgba(0,0,0,0.24); cursor:pointer; }
        input[type="range"]::-moz-range-thumb{ width:18px; height:18px; border-radius:50%; background:${mode === 'strongman' ? '#f59e0b' : mode === 'hybrid' ? '#0ea5e9' : '#00e68a'}; border:2px solid #fff; cursor:pointer; }
        input[type="date"]{ color-scheme: dark; }`}</style>

      {/* HERO — Apple glass + Highlights */}
      <div data-ss="hero" style={mode === 'strongman' ? CARD_STRONG : CARD_HERO}>
        <div style={{ position: 'absolute', top: -36, right: -36, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${modeColor}22, transparent 70%)`, filter: 'blur(2px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -28, left: 30, width: 220, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${modeColor}0F, transparent 70%)`, filter: 'blur(2px)', pointerEvents: 'none' }} />
        <div style={ROW}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: modeGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: mode === 'weightlifting' ? '#06281c' : '#fff', boxShadow: `0 6px 18px ${modeColor}33, inset 0 1px 0 rgba(255,255,255,0.22)`, flexShrink: 0 }}>{mode === 'weightlifting' ? '🏋️' : mode === 'strongman' ? '🪨' : '🔀'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.05, letterSpacing: -0.02*15, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>{mode === 'weightlifting' ? 'Тяжёлая атлетика — PRO' : mode === 'strongman' ? 'Силовой экстрим — PRO' : 'Гибрид — PRO'}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(235,235,245,0.60)', lineHeight: 1.35, marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><Highlight color={modeColor}>Torokhtiy 3/3/3/1</Highlight><span>·</span><Highlight color={modeColor}>Prilepin</Highlight><span>·</span><Highlight color={modeColor}>SINCLAIR 2025</Highlight><span>·</span><span style={{ color: 'rgba(255,255,255,0.52)' }}>92/97/102%</span></div>
          </div>
          <Badge color={modeColor} bg={`${modeColor}14`} border={`${modeColor}30`}>{stepIndex}/4 · {STEP_LABEL_RU[step]}</Badge>
        </div>
        <ProgressBar value={stepIndex} max={4} color={modeColor} height={6} />
        <div data-ss="steps"><SectionNav activeId={step} onSelect={(id)=> setStep(id as Step)} items={[{id:'params',label:'⚙️ Параметры'},{id:'outside',label:'🏃 Вне зала'},{id:'split',label:'🧩 Сплит'},{id:'plan',label:'📋 План'}]} /></div>
        <div style={{ ...ROW, justifyContent:'space-between', gap: 8 }}>
          <div style={{ ...ROW, gap: 6 }}>
            {plan && <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`} icon="📋">План {plan.weeks}нед · {plan.patternId}</Badge>}
            {outsideMetrics && <Badge color="#c4b5fd" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)">Вне зала ×{outsideMetrics.volumeMultiplier}</Badge>}
            {acwr && <Badge color={acwr.zone==='dangerous'?'#fecaca': acwr.zone==='caution'?'#fde68a': acwr.zone==='caution'?'#fde68a':'#86efac'} bg={acwr.zone==='dangerous'?'rgba(239,68,68,0.12)': acwr.zone==='caution'?'rgba(245,158,11,0.12)':'rgba(0,230,138,0.08)'} border={acwr.zone==='dangerous'?'rgba(239,68,68,0.22)': acwr.zone==='caution'?'rgba(245,158,11,0.22)':'rgba(0,230,138,0.16)'}>ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)}</Badge>}
            {hrv && <Badge color={hrv.zone==='dangerous'?'#fecaca': hrv.zone==='caution'?'#fde68a':'#86efac'} bg={hrv.zone==='dangerous'?'rgba(239,68,68,0.12)': hrv.zone==='caution'?'rgba(245,158,11,0.12)':'rgba(0,230,138,0.08)'} border={hrv.zone==='dangerous'?'rgba(239,68,68,0.22)': hrv.zone==='caution'?'rgba(245,158,11,0.22)':'rgba(0,230,138,0.16)'}>HRV {hrv.ewma ?? hrv.last} мс · {hrv.zone}</Badge>}
          </div>
          {msg && <span data-ss="msg" style={{ fontSize:11.5, fontWeight:700, color:'#fff', background: mode==='strongman'?'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.12))':'linear-gradient(135deg, rgba(48,209,88,0.18), rgba(14,165,233,0.12))', border:'1px solid rgba(255,255,255,0.10)', padding:'6px 12px', borderRadius:20, backdropFilter:'blur(8px)', boxShadow:'0 4px 16px rgba(0,0,0,0.18)' }}>{msg}</span>}
        </div>
      </div>

      {/* Mobile lazy: только активный шаг монтируется (step==='params' &&) — 1/4 DOM, 60% меньше памяти на мобильном, как CardioUI */}
      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionCard icon="🎯" title="Режим и цель" subtitle="Подбирает сплит, тоннаж и % зоны">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <StrengthPopupSelect label="Режим" value={mode} onChange={v=> setMode(v as any)} strong={mode==='strongman'} options={[
                { id:'weightlifting', label:'🏋️ ТА', desc:'рывок/толчок/присед' },
                { id:'strongman', label:'🪨 Стронг', desc:'йок/фермер/камни' },
                { id:'hybrid', label:'🔀 Гибрид', desc:'микс' },
              ]} />
              <StrengthPopupSelect label="Цель блока" value={goal} onChange={v=> setGoal(v as any)} strong={mode==='strongman'} options={[
                { id:'strength', label:'🏆 Сила', desc:'RIR 2-3, % 75-90' },
                { id:'hypertrophy', label:'💪 Масса', desc:'RIR 3-4, объём' },
                { id:'technique', label:'🎯 Техника', desc:'RIR 4, лёгкие' },
                { id:'peaking', label:'🏁 Пик', desc:'taper, 92-97-102%' },
                { id:'maintenance', label:'🛡️ Поддержание', desc:'минимум' },
              ]} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <StrengthPopupSelect label="Уровень" value={level} onChange={v=> setLevel(v as any)} options={[
                { id:'beginner', label:'Новичок', desc:'RIR 3-4' },
                { id:'intermediate', label:'Средний', desc:'RIR 2-3' },
                { id:'advanced', label:'Продвинутый', desc:'RIR 1-2' },
                { id:'enhanced', label:'💊 На курсе', desc:'+объём' },
              ]} />
              <StrengthPopupSelect label="Фокус зала" value={focus || ''} onChange={v=> setFocus((v || null) as any)} options={[
                { id:'', label:'Без фокуса — баланс' },
                { id:'snatch', label:'⚡️ Рывок' },
                { id:'clean', label:'🏋️ Толчок / взятие' },
                { id:'squat', label:'🦵 Присед' },
                { id:'overhead', label:'🪵 Жим / лог' },
                { id:'carry', label:'🚜 Переноски' },
                { id:'stone', label:'🪨 Камни' },
              ]} />
            </div>
            <Divider />
            <GroupHeading icon="📅" text="Объём цикла" desc="Недели и частота — тоннаж и восстановление" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label={`Недель`} hint={`${weeks} нед — мезоцикл`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={2} max={16} value={weeks} onChange={e => setWeeks(Number(e.target.value))} style={{ flex:1 }} /><Highlight color={mode==='strongman'?ACCENT_STRONG:ACCENT}>{weeks}</Highlight></div><div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:TEXT_3, fontFamily:'-apple-system, system-ui, sans-serif' }}><span>2</span><span>16</span></div></Field>
              <Field label={`Дней / нед`} hint={`${days}× — сплит и тоннаж`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={2} max={6} value={days} onChange={e => setDays(Number(e.target.value))} style={{ flex:1 }} /><Highlight color={mode==='strongman'?ACCENT_STRONG:ACCENT}>{days}×</Highlight></div><div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:TEXT_3 }}><span>2</span><span>6</span></div></Field>
            </div>
          </SectionCard>

          <SectionCard icon="👤" title="Атлет" subtitle="Подсветка ключевых метрик">
            <GroupHeading icon="⚖️" text="Профиль" desc="Вес, возраст и дата пика — базис для % и SINCLAIR" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
              <StrengthPopupSelect label="Пол" value={sex} onChange={v=> setSex(v as any)} options={[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}]} />
              <StrengthPopupNumber label="Вес" value={bodyweight} min={40} max={160} suffix="кг" onChange={v=> setBodyweight(v)} strong={mode==='strongman'} />
              <StrengthPopupNumber label="Возраст" value={age} min={14} max={65} onChange={v=> setAge(v)} strong={mode==='strongman'} />
              <Field label="Дата пика"><input type="date" value={competitionDate} onChange={e=> setCompetitionDate(e.target.value)} style={INPUT} /></Field>
            </div>
            {goal==='peaking' && competitionDate && (
              <StrengthPopupSelect label="Тапер" value={String(taperWeeks)} onChange={v=> setTaperWeeks(Number(v))} options={[{id:'1',label:'1 неделя',desc:'объём −45%'},{id:'2',label:'2 недели',desc:'−35% → −55%'}]} />
            )}
            {acwr && <InfoBanner tone={acwr.zone==='dangerous'?'warn': acwr.zone==='caution'?'warn':'info'}><Highlight color={acwr.zone==='dangerous'?'#ff3b30':acwr.zone==='caution'?'#ff9f0a':'#30d158'}>ACWR {acwr.ratio}</Highlight> · {ruLabel(ZONE_RU, acwr.zone)} {acwr.zone==='dangerous'?'— объём ×0.60, RIR+2': acwr.zone==='caution'?'— объём ×0.85, RIR+1': '— оптимум'}</InfoBanner>}
            {hrv && <InfoBanner tone={hrv.zone==='dangerous'?'warn': hrv.zone==='caution'?'warn':'info'}><Highlight color={hrv.zone==='dangerous'?'#ff3b30':hrv.zone==='caution'?'#ff9f0a':'#30d158'}>HRV {hrv.ewma ?? hrv.last} мс</Highlight> · {hrv.zone} {hrv.zone==='dangerous'?'— recovery ×0.85': hrv.zone==='caution'?'— recovery ×0.94':'— оптимум'} · mean {hrv.mean}±{hrv.sd}</InfoBanner>}
            <Divider />
            <GroupHeading icon="⚡" text="Скорость (VBT)" desc=">20% → объём ×0.90, RIR+1" />
            <Field label={`VBT потеря`} hint={`потеря скорости vs бюджет`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={40} value={velocityLoss} onChange={e=> setVelocityLoss(Number(e.target.value))} style={{ flex:1 }} /><Highlight color={velocityLoss>25?'#ff3b30': velocityLoss>20?'#ff9f0a':'#30d158'}>{velocityLoss}%</Highlight></div></Field>
            {(() => {
              const sn = workMax.snatch||0, cj = workMax.cleanJerk||workMax.clean||0, sq = workMax.backSquat||0, dl = workMax.deadlift||0;
              const warns: string[] = [];
              if(sn && cj && sn > cj) warns.push('Рывок > толчка — проверьте ПМ');
              if(cj && sq && cj > sq) warns.push('Толчок > приседа — редко');
              if(sq && dl && sq > dl) warns.push('Присед > тяги — проверьте');
              return warns.length ? <InfoBanner tone="warn">{warns.join(' · ')}</InfoBanner> : null;
            })()}
          </SectionCard>

          <SectionCard icon="⚡" title="VBT per-lift" subtitle="snatch/clean/squat — пороги 10% TA / 15% тяга (PLOS 2026) + EWMA 7/14д" accent>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
              {(['snatch','clean','squat'] as const).map(lift => {
                const vals = (vbtPerLift as any)[lift] || {best:0,last:0};
                const loss = vals.best>0 && vals.last>0 ? Math.round((vals.best - vals.last)/vals.best*100) : 0;
                const col = loss>20 ? '#ef4444' : loss>10 ? '#f59e0b' : '#22c55e';
                return (
                  <div key={lift} style={{ background:'rgba(0,0,0,0.14)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#86efac', textTransform:'uppercase', letterSpacing:0.5 }}>{lift==='snatch'?'🏋️ Рывок':lift==='clean'?'🏋️ Толчок':'🦵 Присед'} · {lift}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      <Field label="Best м/с"><input type="number" step={0.05} value={vals.best||''} onChange={e=> { const v=Number(e.target.value)||0; setVbtPerLift(s=> ({...s, [lift]:{...((s as any)[lift]||{best:0,last:0}), best:v}})); }} style={INPUT} placeholder="1.60" /></Field>
                      <Field label="Last м/с"><input type="number" step={0.05} value={vals.last||''} onChange={e=> { const v=Number(e.target.value)||0; setVbtPerLift(s=> ({...s, [lift]:{...((s as any)[lift]||{best:0,last:0}), last:v}})); }} style={INPUT} placeholder="1.40" /></Field>
                    </div>
                    {loss>0 && <div style={{ fontSize:10, fontWeight:700, color:col }}>{loss}% · {loss>20?'⚠️ стоп':loss>10?'контроль':'✅'} · порог {lift==='snatch'||lift==='clean'?10:15}%</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', padding:'6px 8px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)' }}>Per-lift приоритетнее скаляра `VBT потеря`: если заполнен хотя бы один lift — builder режет объём/RIR индивидуально (иначе скаляр). Пороги TA 10% / тяга 15% (PLOS).</div>
           </SectionCard>

           <SectionCard icon="📈" title="LVP калибровка" subtitle="Индивидуальный профиль скорость — нагрузка (Wood 2026 peak) 50/65/75/90%" accent>
             <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
               <StrengthPopupSelect label="Лифт" value={lvpLift} onChange={v=> setLvpLift(v)} options={[{id:'snatch',label:'🏋️ Рывок'},{id:'clean',label:'🏋️ Толчок'},{id:'squat',label:'🦵 Присед'},{id:'deadlift',label:'🏋️ Тяга'},{id:'yoke_walk',label:'🚜 Йок'},{id:'farmers_walk',label:'🚜 Фермер'}]} />
               <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
                 <button onClick={()=> {
                   const res = calibrateLVP(lvpLift, lvpPoints as any);
                   if (res) { saveLVPProfile(res); setLvpResult(res); setMsg(`✦ LVP ${lvpLift} r² ${res.r2} ${res.valid?'✅':'⚠️'}`); setTimeout(()=>setMsg(''),2000); }
                   else { setMsg('⚠ Need ≥3 точки с покрытием 20%'); setTimeout(()=>setMsg(''),2000); }
                 }} style={{ ...BTN_PRIMARY, flex:1 }}>Калибровать</button>
                 <button onClick={()=> { const all=loadLVPProfiles(); setMsg(`LVP профилей: ${Object.keys(all).join(', ')||'—'}`); setTimeout(()=>setMsg(''),2000); }} style={BTN}>Показать</button>
               </div>
             </div>
             <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, marginTop:8 }}>
               {lvpPoints.map((pt,idx)=> (
                 <div key={idx} style={{ background:'rgba(0,0,0,0.14)', padding:'6px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                   <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>{Math.round(pt.pct*100)}% → м/с</div>
                   <input type="number" step={0.05} value={pt.velocity||''} onChange={e=> { const v=Number(e.target.value)||0; setLvpPoints(s=> s.map((p,i)=> i===idx?{...p, velocity:v}:p)); }} style={{ ...INPUT, fontSize:11, padding:'4px 6px' }} placeholder="1.80" />
                   <div style={{ fontSize:9, color: velocityTypeForLift(lvpLift)==='peak' ? '#22c55e':'#f59e0b' }}>{velocityTypeForLift(lvpLift)==='peak'?'peak':'mpv'}</div>
                 </div>
               ))}
             </div>
             {lvpResult && <div style={{ fontSize:10, color: lvpResult.valid ? '#22c55e':'#f59e0b', background: lvpResult.valid?'rgba(34,197,94,0.08)':'rgba(245,158,11,0.08)', padding:'6px 8px', borderRadius:8, border:`0.5px solid ${lvpResult.valid?'rgba(34,197,94,0.18)':'rgba(245,158,11,0.18)'}` }}>r² {lvpResult.r2} slope {lvpResult.slope} intercept {lvpResult.intercept} {lvpResult.valid?'✅ валиден ≥0.85':'⚠ проверьте'} · e1RM пример {estimate1RMFromVelocitySS(80, lvpResult.valid? velocityForLVP(lvpResult,0.8)??0 : 0, lvpLift)||'—'}кг</div>}
             <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>Population → individual приоритет: `velocityForSS` сначала ищет `he_lv_profile_ss_v1` (PLOS Wood 2026: individual калибровка обязательна).</div>
           </SectionCard>

           <SectionCard icon="🧠" title="Методика и волны" subtitle="Подсветка зон RIR/веса">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <StrengthPopupSelect label="Порядок" value={methodology} onChange={v=> setMethodology(v as any)} options={[{id:'compound_first',label:'База первой',desc:'классика'},{id:'pre_exhaust',label:'Предутомление',desc:'изоляция → база'},{id:'post_exhaust',label:'Постутомление',desc:'база → изоляция'}]} />
              <StrengthPopupSelect label="DUP" value={dupMode} onChange={v=> setDupMode(v as any)} options={[{id:'off',label:'Выкл',desc:'одна зона'},{id:'heavy_light',label:'Тяж/лёг',desc:'волна'},{id:'wave',label:'Волна',desc:'3-волны'}]} />
              <StrengthPopupSelect label="Техника" value={intensityTech} onChange={v=> setIntensityTech(v as any)} options={[{id:'none',label:'Нет',desc:'чистые сеты'},{id:'cluster',label:'Кластер 3×1',desc:'база'}]} />
            </div>
          </SectionCard>

          <SectionCard icon="🏋️" title="Рабочие максимумы" subtitle="Олимпийка + сила · стронг — ниже">
            <GroupHeading icon="🏋️" text="Олимпийка · база зала" desc="ПМ для % зон и SINCLAIR/Robi" />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:8 }}>
              {(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).map(k => (
                <Field key={k} label={WM_LABEL_RU[k]||k}><input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value)||0 }))} style={{ ...INPUT, fontVariantNumeric:'tabular-nums' }} placeholder="кг" /></Field>
              ))}
            </div>
            {mode !== 'weightlifting' && (
              <>
                <Divider />
                <GroupHeading icon="🪨" text="Стронг-ивенты" desc="Йок / фермер / рама / хус / камень / лог · отдельные ПМ" strong />
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:8 }}>
                  {(['yokeWalk','farmersWalk','frameCarry','husafellCarry','atlasStone','sandbagLoad','kegToss','carDeadlift','axlePress','logPress'] as const).map(k => (
                    <Field key={k} label={WM_LABEL_RU[k]||k}><input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value)||0 }))} style={{ ...INPUT, fontVariantNumeric:'tabular-nums', borderColor:'rgba(255,159,10,0.22)' }} placeholder="кг" /></Field>
                  ))}
                </div>
              </>
            )}
            <Divider />
            <GroupHeading icon="🎯" text="Слабые точки" desc="Объём ×1.15 на выбранные зоны" />
            <Field label="Слабые точки — объём ×1.15">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {Object.entries(WL_WEAKPOINT_LABELS).slice(0,8).map(([k,label])=> (
                  <ChipToggle key={k} active={weakPoints.includes(k)} onClick={()=> setWeakPoints(s=> s.includes(k)? s.filter(x=>x!==k): s.length>=2?s:[...s,k])}>{label}</ChipToggle>
                ))}
              </div>
            </Field>
            {mode==='strongman' && (
              <>
                <Divider />
                <GroupHeading icon="🏆" text="Контест — пакет ивентов" desc="Выбери точные ивенты старта: йок/лог/камни/конэн/трак → план строит под них" strong />
                <Field label="Пресет контеста">
                  <div data-ss="presets" style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {Object.entries(CONTEST_PRESETS).map(([pid, pc])=> (
                      <button key={pid} onClick={()=> setContest(pc as StrongmanContest)} style={{ padding:'6px 10px', borderRadius:10, border: contest?.name===pc.name ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: contest?.name===pc.name ? 'rgba(245,158,11,0.14)':'rgba(255,255,255,0.04)', color:'#fff', fontSize:11, cursor:'pointer' }}>{pc.name}</button>
                    ))}
                    <button onClick={()=> setContest(null)} style={{ padding:'6px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:11 }}>✕ Очистить</button>
                  </div>
                </Field>
                {contest && (
                  <div data-ss="contest" style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', borderRadius:10, padding:10, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>{contest.name || 'Кастом'} · {contest.events.length} ивентов</span>
                      <StrengthPopupSelect label="Стратегия" value={contestStrategy} onChange={v=> setContestStrategy(v as any)} strong options={[{id:'conservative',label:'🛡️ Консерва'},{id:'balanced',label:'⚖️ Баланс'},{id:'aggressive',label:'🔥 Агрессив'}]} />
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {contest.events.map((ev, idx)=> (
                        <div key={idx} style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', background:'rgba(0,0,0,0.18)', padding:'6px 8px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize:11, color:'#fff', minWidth:100 }}>{(EVENT_META as any)[ev.id]?.label || ev.id}</span>
                          <span style={{ fontSize:10, color:'rgba(255,255,255,0.52)', minWidth:72 }}>{ev.format}</span>
                          <input type="number" value={ev.weight||''} placeholder="кг" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, weight: Number(e.target.value)||0 } : x)} : c)} style={{ width:62, padding:'4px 6px', fontSize:11, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#fff', textAlign:'center' }} />
                          {(ev.id.includes('yoke')||ev.id.includes('farmers')||ev.id.includes('conan')||ev.id.includes('truck')||ev.id.includes('carry')||ev.id.includes('shield')||ev.id.includes('duck')) && <input type="number" value={ev.distanceM||''} placeholder="м" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, distanceM: Number(e.target.value)||0 } : x)} : c)} style={{ width:50, padding:'4px 6px', fontSize:11, background:'rgba(255,159,10,0.08)', border:'0.5px solid rgba(255,159,10,0.18)', borderRadius:6, color:'#fff', textAlign:'center' }} />}
                          <input type="number" value={ev.timeCapS||''} placeholder="capс" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, timeCapS: Number(e.target.value)||0 } : x)} : c)} style={{ width:54, padding:'4px 6px', fontSize:11, background:'rgba(59,130,246,0.08)', border:'0.5px solid rgba(59,130,246,0.18)', borderRadius:6, color:'#fff', textAlign:'center' }} />
                          <label style={{ display:'flex', gap:4, alignItems:'center', fontSize:10, color:'#fff' }}><input type="checkbox" checked={!!ev.turn} onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, turn: e.target.checked } : x)} : c)} /> разв.</label>
                          <input type="number" value={ev.heightCm||''} placeholder="высота" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, heightCm: Number(e.target.value)||0 } : x)} : c)} style={{ width:66, padding:'4px 6px', fontSize:10, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#fff', textAlign:'center' }} />
                          {(ev.format==='ladder' || ev.id.includes('stone') || ev.id.includes('sandbag')) && <input type="text" value={(ev.ladderWeights||[]).join(',')} placeholder="100,110,120" onChange={e=> setContest(c=> c ? { ...c, events: c.events.map((x,i)=> i===idx ? { ...x, ladderWeights: e.target.value.split(',').map(v=> Number(v.trim())).filter(v=> v>0) } : x)} : c)} style={{ flex:1, minWidth:90, padding:'4px 6px', fontSize:10, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#fff' }} />}
                          <button onClick={()=> setContest(c=> c ? { ...c, events: c.events.filter((_,i)=> i!==idx)} : c)} style={{ width:26, height:26, borderRadius:7, background:'rgba(239,68,68,0.14)', border:'0.5px solid rgba(239,68,68,0.22)', color:'#fecaca', cursor:'pointer' }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                      <select onChange={e=> { const id=e.target.value; if(!id) return; setContest(c=> c ? { ...c, events: [...c.events, { id, format: (EVENT_META as any)[id]?.class === 'loading_race' ? 'loading_race' : (EVENT_META as any)[id]?.class === 'reps_60s' ? 'reps_60s' : 'max', weight: 100 } as any] } : { name:'Кастом', events:[{ id, format:'max', weight:100 } as any] }); e.target.value=''; }} style={{ ...SELECT, flex:1, minWidth:160 }}>
                        <option value="">＋ Добавить ивент…</option>
                        {Object.keys(EVENT_META).map(id=> <option key={id} value={id}>{(EVENT_META as any)[id]?.label || id}</option>)}
                      </select>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.36)' }}>Taper: йок/камень 7д · лог/фермер 5д · броски 4д</span>
                    </div>
                    {contestSim && (
                      <div style={{ background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.22)', borderRadius:10, padding:'8px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>🏆 Симулятор: {contestSim.totalPoints} pts → прогноз {contestSim.predictedPlace} место из 10 · avg {contestSim.avgPoints}</div>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {contestSim.events.map(ev=> (
                            <span key={ev.id} style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background: ev.isWeak ? 'rgba(239,68,68,0.14)':'rgba(34,197,94,0.10)', border:`0.5px solid ${ev.isWeak?'rgba(239,68,68,0.22)':'rgba(34,197,94,0.18)'}`, color: ev.isWeak?'#fecaca':'#86efac' }}>{ev.id} {ev.points}pts {ev.effectiveRatio*100>0?`${Math.round(ev.effectiveRatio*100)}%`:''}</span>
                          ))}
                        </div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>Rec order: {contestSim.recOrder.join(' → ')}</div>
                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.36)' }}>{contestSim.rationale.join(' · ')}</div>
                        {contestSim.weakEvents.length>0 && <div style={{ fontSize:10, color:'#f59e0b' }}>Слабые: {contestSim.weakEvents.join(', ')} — объём ×1.15 на них (injection)</div>}
                      </div>
                    )}
                    <InfoBanner tone="strong">Contest Packet: план строит event_day/overhead/deadlift под заявленные ивенты, прогрессия веса к контест-весу, taper cess 7/5/4д (Winwood), medley 90с cap180</InfoBanner>
                  </div>
                )}
                {!contest && <InfoBanner tone="info">Без пакета — план generic 5-фаз. Выбери пресет для PRO-контеста.</InfoBanner>}
              </>
            )}
          </SectionCard>

          <SectionCard icon="🛡️" title="Оборудование и здоровье" subtitle="Ограничения фильтруют пул и темп">
            <GroupHeading icon="🏋️" text="Доступное оборудование" desc="Пусто — доступно всё; выбор фильтрует пул" />
            <Field label="Оборудование">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {(['barbell','dumbbell','machine','cable','other'] as const).map(eq => (
                  <ChipToggle key={eq} active={equipment.includes(eq)} onClick={()=> setEquipment(s=> s.includes(eq)? s.filter(x=>x!==eq): [...s,eq])}>{(EQUIP_RU as any)[eq] || eq}</ChipToggle>
                ))}
              </div>
            </Field>
            <Divider />
            <GroupHeading icon="🩹" text="Травмы — щадящий режим" desc="Снижает вес ×0.6 и RIR+1, прячет осевые" />
            <Field label="Травмы — щадящий режим" hint="Снижает вес ×0.6, фильтрует опасные движения">
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <input value={injInput} onChange={e=> setInjInput(e.target.value)} placeholder="напр.: колено, плечо" style={{ ...INPUT, flex:1, minWidth:160 }} />
                <button onClick={() => { const parts = injInput.split(',').map(s=> s.trim()).filter(Boolean); setInjuries(parts.map(p=> ({ location: p, type: 'joint' }))); setMsg(parts.length? '✦ Травмы применены':'Список очищен'); setTimeout(()=>setMsg(''),1800); }} style={BTN_SMALL}>Применить</button>
              </div>
              {injuries.length>0 && <InfoBanner tone="warn"><Highlight color="#ff9f0a">Щадящий</Highlight>: {injuries.map((j:any)=> j.location).join(', ')} — вес ×0.6–0.7, RIR+1</InfoBanner>}
            </Field>
            <Divider />
            <GroupHeading icon="🤸" text="Мобильность" desc="Фильтрует глубокие амплитуды" />
            <Field label="Мобильность">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {(['shoulder','hip','knee','ankle','wrist','lower_back'] as const).map(m => (
                  <ChipToggle key={m} active={mobility.includes(m)} onClick={()=> setMobility(s=> s.includes(m)? s.filter(x=> x!==m): [...s,m])}>{(MOBILITY_RU as any)[m]}</ChipToggle>
                ))}
              </div>
            </Field>
          </SectionCard>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={pullFromProfile} style={{ ...BTN, flex:1, background:'rgba(255,255,255,0.05)' }}>⟡ Из профиля</button>
            <button onClick={() => setStep('outside')} style={{ ...(mode==='strongman'?BTN_STRONG:BTN_PRIMARY), flex:1.2 }}>Далее → Вне зала</button>
          </div>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
          <SectionCard icon="🏃" title="Вне зала — поле / кроссфит" subtitle="ACWR и объём зала ×" accent={outsideEnabled}>
            <GroupHeading icon="📊" text="Нагрузка вне зала" desc="Поле, кроссфит, GPP — декремент объёма зала" />
            <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, color:'#fff', fontWeight:700, background: outsideEnabled ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.03)', padding:'11px 12px', borderRadius:12, border:`1px solid ${outsideEnabled?'rgba(48,209,88,0.22)':'rgba(255,255,255,0.06)'}`, cursor:'pointer', fontFamily: '-apple-system, system-ui, sans-serif' }}>
              <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} style={{ width:18, height:18, accentColor:'#30d158' }} /> Учитывать внезальную нагрузку — <Highlight>{outsideEnabled?'включено':'выкл'}</Highlight>
            </label>
            {outsideEnabled && outside && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  <Field label="Сессий / нед" hint={`${outside.sessionsPerWeek}×`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight>{outside.sessionsPerWeek}×</Highlight></div></Field>
                  <Field label="Длительность" hint={`${outside.avgDurationMin} мин`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight>{outside.avgDurationMin}′</Highlight></div></Field>
                  <Field label="RPE" hint={`RPE ${outside.avgSRPE}`}><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight color={outside.avgSRPE>=8?'#ff3b30': outside.avgSRPE>=6?'#ff9f0a':'#30d158'}>RPE {outside.avgSRPE}</Highlight></div></Field>
                </div>
                <InfoBanner tone={outsideMetrics?.interference === 'high' ? 'warn' : outsideMetrics?.interference === 'medium' ? 'info' : 'ok'}>{outsideMetrics ? <span><Highlight color={outsideMetrics.interference==='high'?'#ff9f0a':'#30d158'}>{outsideMetrics.weeklyLoad} load</Highlight> → объём <Highlight>×{outsideMetrics.volumeMultiplier}</Highlight> ({outsideMetrics.interference})</span> : 'Вне зала: нет данных — объём 100%'}</InfoBanner>
              </>
            )}
            <button onClick={() => setStep('split')} style={{ ...(mode==='strongman'?BTN_STRONG:BTN_PRIMARY), width:'100%', borderRadius: 12 }}>Далее → Сплит</button>
          </SectionCard>
          {diaryLoad != null && (
            <InfoBanner tone={diaryLoad>30?'warn':'info'}>Дневник: нагрузка 7д ≈ <Highlight color={diaryLoad>30?'#ff9f0a':'#30d158'}>{diaryLoad}</Highlight> {diaryLoad>30?'— высоко, лёгкую неделю?':'— норма'} {acwr && <span>· ACWR <Highlight>{acwr.ratio}</Highlight> · {ruLabel(ZONE_RU, acwr.zone)}</span>}</InfoBanner>
          )}
        </div>
      )}

      {step === 'split' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionCard icon="✨" title="Рекомендация" subtitle="Подбор сплита по режиму · дням · уровню" accent>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color: TEXT_3 }}>Рекомендуем:</span><Highlight color={modeColor}>{recommendStrengthSportPattern(mode, days, level).name}</Highlight>
              <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`}>{recommendStrengthSportPattern(mode, days, level).sessionsPerRotation}×/нед</Badge>
            </div>
            <div style={{ fontSize:11, color: TEXT_3 }}>{patternId ? <span>Выбран: <Highlight color={modeColor}>{STRENGTH_SPORT_PATTERNS.find(p=>p.id===patternId)?.name}</Highlight></span> : 'Авто по режиму/дням/уровню · тапните карточку ниже'}</div>
            <div style={{ fontSize:10, color:'rgba(235,235,245,0.36)', fontFamily:'-apple-system, system-ui, sans-serif', background:'rgba(0,0,0,0.16)', padding:'6px 8px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.04)' }}>Дней <Highlight>{days}×</Highlight> · Режим <Highlight color={modeColor}>{mode==='weightlifting'?'ТА':mode==='strongman'?'Стронг':'Гибрид'}</Highlight> · Уровень {ruLabel(LEVEL_RU, level)}</div>
          </SectionCard>
          <SectionCard icon="📚" title="Интернет-цикл" subtitle="Дословные программы ТА/стронга · перекрывает сплит ниже" accent={!!cycleId}>
            {!cycleId && rankedCycles.filter(r=> !r.blocked).length > 0 && (
              <div style={{ fontSize:11, color:'rgba(235,235,245,0.60)' }}>💡 Рекомендуем цикл: <Highlight color={modeColor}>{rankedCycles.filter(r=> !r.blocked)[0].cycle.meta.title}</Highlight></div>
            )}
            <StrengthPopupSelect label="Цикл" value={cycleId} onChange={v=> setCycleId(v)} strong={mode==='strongman'} options={[
              { id:'', label:'Без цикла — параметрический план', desc:'сплит ниже' },
              ...rankedCycles.filter(r=> !r.blocked).map(r=> ({
                id: r.cycle.meta.id,
                label: `${r.fit==='exact'?'✅ ':r.fit==='close'?'🔹 ':'▫️ '}${r.cycle.meta.title}`,
                desc: `${r.cycle.meta.weeks}нед · ${r.cycle.meta.sessionsPerWeek}${r.cycle.meta.sessionsPerWeekMax?`→${r.cycle.meta.sessionsPerWeekMax}`:''}× · ${r.reasons.slice(0,2).join(' · ')}`,
              })),
            ]} />
            {rankedCycles.some(r=> r.blocked) && (
              <InfoBanner tone="warn">{rankedCycles.filter(r=> r.blocked).map(r=> `${r.cycle.meta.title}: ${r.blocked}`).join(' · ')}</InfoBanner>
            )}
            {cycleId && (
              <>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <ChipToggle active={cycleMode==='faithful'} onClick={()=> setCycleMode('faithful')}>📜 Дословно (дефолт)</ChipToggle>
                  <ChipToggle active={cycleMode==='adapt'} onClick={()=> setCycleMode('adapt')}>🛡️ Адаптировать (ACWR/VBT)</ChipToggle>
                </div>
                <div style={{ fontSize:10, color:'rgba(235,235,245,0.52)', background:'rgba(255,255,255,0.03)', padding:'6px 8px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                  {cycleMode==='faithful'
                    ? 'Дословно: сеты/повторы/% 1-в-1 из источника, без авто-срезок объёма. Травмы и фолбэк снарядов действуют всегда.'
                    : 'Адаптировать: поверх дословного — срезки ACWR/outside/VBT и дрейф ПМ по лифту.'}
                </div>
                {(() => {
                  const tpl = getSSCycleById(cycleId);
                  if (!tpl) return null;
                  const phaseShort: Record<string,string> = { base:'Б', build:'Н', peak:'П', deload:'Р', taper:'Т', test:'Тст' };
                  const phaseOf = (wn: number) => tpl.meta.phases?.find(p=> wn >= p.weekStart && wn <= p.weekEnd)?.phase;
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {tpl.weeks.map((wkDays, wi)=> {
                          const wn = wi + 1;
                          const ph = phaseOf(wn);
                          const marks = `${(tpl.meta.mockWeeks||[]).includes(wn)?' 🏁':''}${(tpl.meta.taperWeeks||[]).includes(wn)?' 📉':''}${(tpl.meta.deloadWeeks||[]).includes(wn)?' 💤':''}`;
                          return <span key={wn} style={{ fontSize:10, padding:'3px 7px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,0.08)', color:'#fff', fontVariantNumeric:'tabular-nums' }}>Н{wn}·{wkDays.length}д·{phaseShort[ph||'']||'·'}{marks}</span>;
                        })}
                      </div>
                      <div style={{ fontSize:11, color:'rgba(235,235,245,0.72)', lineHeight:1.45 }}>{tpl.meta.description}</div>
                      <div style={{ fontSize:10, color:'rgba(235,235,245,0.45)' }}>{tpl.meta.howItWorks}</div>
                      {tpl.meta.needsSpecialty && !(['other','specialty'].some(e=> equipment.map(x=>String(x).toLowerCase()).includes(e)) || equipment.length===0) && (
                        <InfoBanner tone="warn">Нет спец-снарядов — ивенты заменятся (йок→фермер ×0.73, камень→мешок ×0.66) с бейджем в плане</InfoBanner>
                      )}
                      {competitionDate && (tpl.meta.mockWeeks?.length || tpl.meta.taperWeeks?.length) && (
                        <InfoBanner tone="info">⚓ Якорь к старту {competitionDate}: mock нед {tpl.meta.mockWeeks?.join(',')||'—'} · тейпер нед {tpl.meta.taperWeeks?.join(',')||'—'} (порядок недель не меняем)</InfoBanner>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
            {(() => {
              const bg = rankedCycles.find(r=> r.cycle.meta.bulgarian);
              if (!bg || !bg.blocked || !/согласие/.test(bg.blocked)) return null;
              return (
                <label style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:11.5, color:'#fff', background:'rgba(239,68,68,0.08)', padding:'10px 12px', borderRadius:12, border:'1px solid rgba(239,68,68,0.20)', cursor:'pointer', lineHeight:1.4 }}>
                  <input type="checkbox" checked={cycleConsent} onChange={e=> setCycleConsent(e.target.checked)} style={{ width:18, height:18, marginTop:1, accentColor:'#ef4444' }} />
                  <span>Понимаю риск daily-max (максимумы каждый день, только advanced+, сон 8ч). Разблокировать болгарский цикл.</span>
                </label>
              );
            })()}
          </SectionCard>
          <div data-ss="split-list" style={{ display:'flex', flexDirection:'column', gap:8, opacity: cycleId ? 0.45 : 1 }}>
            <div style={{ fontSize:10, color:'rgba(235,235,245,0.40)' }}>{cycleId ? 'Сплит перекрыт интернет-циклом (дни/недели из шаблона)' : 'Сплит для параметрического плана'}</div>
            {STRENGTH_SPORT_PATTERNS.filter(p => p.mode===mode || p.mode==='any').map(p => {
              const active = patternId ? patternId===p.id : p.id===recommendStrengthSportPattern(mode, days, level).id;
              const preview = p.schedule.map(s=> s.kind==='тренировка' ? (s.sessionTag||'тренировка').slice(0,4) : 'отд').join(' · ');
              return (
                <button key={p.id} onClick={()=> setPatternId(p.id)} style={{
                  textAlign:'left', padding:14, borderRadius:14, cursor:'pointer', transition:'all 0.18s ease',
                  background: active ? (mode==='strongman' ? 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(239,68,68,0.08))' : 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(14,165,233,0.08))') : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                  border: active ? `1px solid ${modeColor}36` : '1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:11,
                  boxShadow: active ? `0 6px 20px ${modeColor}14, inset 0 1px 0 rgba(255,255,255,0.08)` : '0 4px 12px rgba(0,0,0,0.14)', backdropFilter:'blur(12px)'
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><b style={{ fontSize:13, color: active? '#fff':'rgba(255,255,255,0.92)' }}>{p.name}</b><span style={{ fontSize:11, fontWeight:800, color: active? modeColor : 'rgba(255,255,255,0.38)', background: active?`${modeColor}18`:'rgba(255,255,255,0.06)', padding:'3px 8px', borderRadius:20, border:`1px solid ${active?`${modeColor}22`:'rgba(255,255,255,0.06)'}`}}>{p.sessionsPerRotation}×/нед</span></div>
                  <div style={{ fontSize:11.5, color:'rgba(255,255,255,0.62)', marginTop:4, lineHeight:1.4 }}>{p.description}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.32)', marginTop:6, fontFamily:'ui-monospace, monospace', background:'rgba(0,0,0,0.16)', padding:'5px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>{preview}</div>
                  {active && <div style={{ fontSize:11, color:modeColor, fontWeight:800, marginTop:8, display:'flex', alignItems:'center', gap:6 }}><span style={{ width:6, height:6, borderRadius:'50%', background:modeColor, boxShadow:`0 0 8px ${modeColor}`}} /> Выбран — {p.schedule.filter(s=>s.kind==='тренировка').map(s=> s.sessionTag).join(', ')}</div>}
                </button>
              );
            })}
          </div>
          {mode==='strongman' && (
            <EventCard
              title="Medley превью — до сборки"
              subtitle="Настрой дистанции/cap до генерации — 90с переход, cap 180с в плане"
              events={medleyPreview.map(e=> ({ id:e.id, label:e.label, distanceM:e.distanceM, timeCapS:e.timeCapS }))}
              onChange={(id,patch)=> setMedleyPreview(prev=> prev.map(p=> p.id===id ? { ...p, ...patch } : p))}
              preview
            />
          )}
          <button data-ss="build" onClick={build} style={{ ...(mode==='strongman'?BTN_STRONG:BTN_PRIMARY), width:'100%', padding:'14px 16px', fontSize:13, borderRadius:14 }}>✦ Собрать план {cycleId ? `· 📚 ${cycleId} (${cycleMode==='faithful'?'дословно':'adapt'})` : patternId ? `· ${patternId}` : ''}</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Сводка — Apple glass + Highlights + StatTiles */}
          <SectionCard icon="📋" title="Сводка плана" subtitle={`${ruLabel(MODE_RU, plan.mode)} · ${ruLabel(PHASE_RU, plan.weeksData[0]?.phase || 'accumulation')} · ${plan.weeks} нед`} accent>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px,1fr))', gap:8 }}>
              <StatTile label="Недель" value={String(plan.weeks)} color={modeColor} sub={plan.patternId} icon="📅" />
              <StatTile label="Дней/нед" value={`${days}×`} color={modeColor} sub={ruLabel(LEVEL_RU, plan.level)} icon="🗓️" />
              <StatTile label="Сетов" value={String(plan.weeksData.reduce((a,w)=>a+(w.totalSets||0),0))} color={modeColor} sub="за цикл" icon="📊" />
              <StatTile label="Тоннаж" value={`${Math.round(plan.weeksData.reduce((a,w)=>a+(w.totalTonnage||0),0)/1000)}т`} color={modeColor} sub="за цикл" icon="⚖️" />
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`}>{ruLabel(MODE_RU, plan.mode)}</Badge>
              <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`}>{ruLabel(PHASE_RU, plan.weeksData[0]?.phase || '')}</Badge>
              <Badge>{plan.patternId}</Badge>
              {plan.inputSnapshot?.focus && <Badge color={mode==='strongman'?ACCENT_STRONG:ACCENT} bg={mode==='strongman'?STRONG_SOFT:ACCENT_SOFT} border={mode==='strongman'?STRONG_BORDER:ACCENT_BORDER}>Фокус {plan.inputSnapshot.focus}</Badge>}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {plan.weeksData.map(w=> (
                <span key={w.week} style={{ padding:'4px 8px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.06)', fontSize:11, color:'#fff', fontFamily:'-apple-system, system-ui, sans-serif', fontVariantNumeric:'tabular-nums' }}>Н{w.week} · <Highlight color={w.deload?'#f59e0b': (w as any).taper?'#60a5fa':modeColor}>{w.totalSets}</Highlight> сетов · <Highlight>{Math.round((w.totalTonnage||0)/1000)}т</Highlight></span>
              ))}
            </div>
            {/* Sinclair / DOTS блок */}
            {(() => {
              const bw = (plan.inputSnapshot as any)?.bodyweight as number | undefined;
              const sex = (plan.inputSnapshot as any)?.sex as string | undefined;
              if (!bw || !plan.workMax) return null;
              const wm: any = plan.workMax || {};
              let total = 0;
              if (plan.mode === 'weightlifting') total = (wm.snatch||0)+(wm.cleanJerk||wm.clean||0);
              else if (plan.mode === 'strongman') total = (wm.deadlift||0)+(wm.logPress||wm.overheadPress||0)+(wm.backSquat||0);
              else total = (wm.snatch||0)+(wm.cleanJerk||0)+(wm.backSquat||0);
              if (!total) return null;
              const reportLines = buildStrengthSportReport(plan).split('\n');
              const sinLine = reportLines.find(l=> l.includes('Sinclair') || l.includes('DOTS'));
              return sinLine ? <div style={{ fontSize:11, color:'rgba(235,235,245,0.72)', background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', lineHeight:1.4 }}>{sinLine.split('·').map((p,i)=> <span key={i} style={{ marginRight:6 }}>{p.trim().split(' ').map((w,j)=> /[0-9]/.test(w) ? <Highlight key={j} color={modeColor}>{w}</Highlight> : w+' ').reduce((a,c)=> <>{a} {c}</> as any, null as any)}</span>)}</div> : null;
            })()}
            {plan.outsideMetrics && <InfoBanner tone={plan.outsideMetrics.interference==='high'?'warn':'info'}><Highlight color={plan.outsideMetrics.interference==='high'?'#ff9f0a':'#30d158'}>{plan.outsideMetrics.weeklyLoad} load</Highlight> → объём <Highlight>×{plan.outsideMetrics.volumeMultiplier}</Highlight> · {plan.outsideMetrics.interference}</InfoBanner>}
            {plan.rationale?.length ? <div style={{ fontSize:11, color:'rgba(235,235,245,0.58)', background:'rgba(0,0,0,0.14)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', lineHeight:1.45 }}>{plan.rationale.slice(0,3).map((r,i)=> <div key={i} style={{ display:'flex', gap:6 }}><span style={{ color:modeColor }}>•</span><span>{r}</span></div>)}</div> : null}
          </SectionCard>

          <SectionCard icon="🗓️" title="Gantt фаз" subtitle="Накопление · интенсификация · пик · taper 1-2нед перед стартом" >
            <StrengthGantt weeks={plan.weeksData} totalWeeks={plan.weeks} />
            <div style={{ fontSize:10, color: TEXT_3, background:'rgba(255,255,255,0.03)', padding:'6px 8px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.04)' }}>Тапер <span style={{ color:'#30D158' }}>зелёный</span> 1-2нед (объём ×0.45/0.65) выносится отдельной фазой в Gantt — как в annual-training taperWeeksForBlock</div>
          </SectionCard>

          {plan.mode === 'weightlifting' && (plan.workMax.snatch || 0) > 0 && (plan.workMax.cleanJerk || (plan.workMax as any).clean || 0) > 0 && (() => {
            const meet = buildWLMeetPlan(plan.workMax.snatch as number, (plan.workMax.cleanJerk || (plan.workMax as any).clean) as number, 'balanced', { bodyweight, sex });
            return meet ? (
              <div data-ss="attempts"><SectionCard icon="🏋️" title="Попытки ТА · IWF 1кг" subtitle={`Тотал ${meet.total}кг`} accent>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <Badge color="#0a84ff" bg="rgba(10,132,255,0.12)" border="rgba(10,132,255,0.22)">Тотал <Highlight color="#0a84ff">{meet.total}кг</Highlight></Badge>
                  {meet.sinclair && <Badge color="#30d158" bg="rgba(48,209,88,0.10)" border="rgba(48,209,88,0.18)">Sinclair <Highlight color="#30d158">{meet.sinclair}</Highlight></Badge>}
                  {(meet as any).robi && <Badge color="#a855f7" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)">Robi <Highlight color="#a855f7">{(meet as any).robi}</Highlight></Badge>}
                  <Badge>кат. {(() => { try{ const c=(plan.inputSnapshot as any)?.bodyweight; return c? c+'кг':'' }catch{return ''} })()}</Badge>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div style={{ background:'rgba(255,255,255,0.03)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>⚡️ Рывок <Badge color="#0a84ff" bg="rgba(10,132,255,0.12)" border="rgba(10,132,255,0.22)">{meet.total? Math.round(meet.snatch.opener/meet.total*100)+'%' : ''}</Badge></div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', fontSize:12, fontVariantNumeric:'tabular-nums' }}><Highlight color="#30d158">{meet.snatch.opener}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff9f0a">{meet.snatch.second}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff3b30">{meet.snatch.third}кг</Highlight></div>
                    <div style={{ fontSize:10, color:TEXT_3, marginTop:4 }}>92% · 97% · 102% от ПМ</div>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.03)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>🏋️ Толчок <Badge color="#0a84ff" bg="rgba(10,132,255,0.12)" border="rgba(10,132,255,0.22)">{meet.total? Math.round(meet.cleanJerk.opener/meet.total*100)+'%' : ''}</Badge></div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', fontSize:12, fontVariantNumeric:'tabular-nums' }}><Highlight color="#30d158">{meet.cleanJerk.opener}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff9f0a">{meet.cleanJerk.second}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff3b30">{meet.cleanJerk.third}кг</Highlight></div>
                    <div style={{ fontSize:10, color:TEXT_3, marginTop:4 }}>92% · 97% · 102% от ПМ</div>
                  </div>
                </div>
                <div style={{ fontSize:11, color:'rgba(235,235,245,0.58)', background:'rgba(0,0,0,0.14)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', lineHeight:1.4 }}>{wlAttemptRationale(meet).slice(0,3).map((t,i)=> <span key={i} style={{ marginRight:8 }}>{t.includes('кг') ? t.split(' ').map((w,j)=> /[0-9]/.test(w) ? <Highlight key={j} color="#0a84ff">{w}</Highlight> : w+' ') : t}</span>)}</div>
              </SectionCard></div>
            ) : null;
          })()}
          {(plan.inputSnapshot as any)?.contest?.events?.length ? (
            <SectionCard icon="🏆" title="Контест-пакет" subtitle={`${(plan.inputSnapshot as any).contest.events.length} ивентов · ${(plan.inputSnapshot as any).contestStrategy||'balanced'} · taper Winwood 8.6д`} strong>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {(plan.inputSnapshot as any).contest.events.map((e:any, i:number)=> (
                  <span key={i} style={{ padding:'5px 8px', borderRadius:9, background:'rgba(245,158,11,0.10)', border:'0.5px solid rgba(245,158,11,0.18)', fontSize:11, color:'#fff' }}><HighlightStrong>{(EVENT_META as any)[e.id]?.label || e.id}</HighlightStrong> {e.format} {e.weight?`${e.weight}кг`:''} {e.distanceM?`${e.distanceM}м`:''} {e.timeCapS?`cap${e.timeCapS}с`:''} {e.heightCm?`${e.heightCm}см`:''} {e.turn?'разв.':''} {(TAPER_CESSATION_DAYS as any)[e.id] ? `· cess ${(TAPER_CESSATION_DAYS as any)[e.id]}д`:''}</span>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                {(() => {
                  const rows = (plan.inputSnapshot as any).contest.events.map((e:any)=> {
                    const pm = (()=>{ const wm:any=plan.workMax||{}; if(e.id==='yoke_walk') return wm.yokeWalk||wm.deadlift||180; if(['farmers_walk_heavy','frame_carry','husafell_carry','conan_wheel','shield_carry'].includes(e.id)) return wm.farmersWalk||wm.deadlift||140; if(['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load'].includes(e.id)) return wm.atlasStone||100; if(['log_press','axle_press','viking_press','circus_db_press'].includes(e.id)) return wm.logPress||wm.overheadPress||60; return 100; })();
                    const ratio = e.weight ? Math.round(pm/e.weight*100) : 100; const place = ratio>=100?1: ratio>=95?2: ratio>=90?3:4;
                    return <span key={e.id} style={{ padding:'4px 7px', borderRadius:8, background: ratio>=100?'rgba(48,209,88,0.12)':'rgba(255,159,10,0.10)', border:`0.5px solid ${ratio>=100?'rgba(48,209,88,0.22)':'rgba(255,159,10,0.18)'}`, fontSize:10, color:'#fff' }}>{(EVENT_META as any)[e.id]?.label||e.id} {ratio}% · P{place}</span>;
                  });
                  return rows;
                })()}
              </div>
              <InfoBanner tone="strong">Прогрессия: 85%→100% к контесту · дистанции/высота/cap/разворот из пакета · medley по implements контеста · стратегия { (plan.inputSnapshot as any).contestStrategy } → 85/92/98 vs 90/97/102%</InfoBanner>
            </SectionCard>
          ) : null}
          {(() => {
            const cond = buildConditioningRationale(1, plan.weeks, plan.mode);
            return cond.length && plan.mode==='strongman' ? (
              <SectionCard icon="🏃" title="Кондиция" subtitle={cond.join(' · ')}>
                <InfoBanner tone="info">Фаза: alactic 8×10с/50с → lactic 5×60с/90с → aerobic Zone2 30′ · внезала high — пауза (Winwood 54% plyo)</InfoBanner>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {cond.map((c,i)=> <Badge key={i} color="#0a84ff" bg="rgba(10,132,255,0.08)" border="rgba(10,132,255,0.16)">{c}</Badge>)}
                </div>
              </SectionCard>
            ) : null;
          })()}
          {plan.mode !== 'weightlifting' && (() => {
            const yoke = (plan.workMax as any).yokeWalk || (plan.workMax as any).deadlift;
            const log = (plan.workMax as any).logPress || (plan.workMax as any).overheadPress;
            const yPlan = yoke ? buildSMEventPlan('yoke_walk', yoke, (plan.inputSnapshot as any)?.contestStrategy) : null;
            const lPlan = log ? buildSMEventPlan('log_press', log, (plan.inputSnapshot as any)?.contestStrategy) : null;
            // medley для ивент-дня: берём первые 2 carries недели 1
            const medleyEx = plan.weeksData[0]?.sessions.find(s=> s.sessionTag==='event_day')?.exercises.filter(e=> ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','sled_push_sprint'].includes(e.id)).slice(0,2) || [];
            return (yPlan || lPlan || medleyEx.length>=2) ? (
              <div data-ss="attempts"><SectionCard icon="🪨" title="Попытки стронг + Medley" subtitle="шаг йок 10кг / лог 2.5кг · medley 90с переход cap 180с" strong>
                <div style={{ display:'grid', gridTemplateColumns: yPlan && lPlan ? '1fr 1fr' : '1fr', gap:10 }}>
                  {yPlan && <div style={{ background:'rgba(255,159,10,0.08)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,159,10,0.18)' }}><div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>🚜 Йок {(yPlan.warmup[0] as any)?.distanceM||20}м cap {(yPlan.warmup[0] as any)?.timeCapS||60}с</div><div style={{ display:'flex', gap:6, marginTop:6, fontVariantNumeric:'tabular-nums' }}><HighlightStrong>{yPlan.attempts.opener}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{yPlan.attempts.second}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{yPlan.attempts.third}кг</HighlightStrong></div>{yPlan.ladder && <div style={{ fontSize:10, color:TEXT_3, marginTop:4 }}>Лестница: {yPlan.ladder.weights.slice(0,3).join('→')}кг</div>}</div>}
                  {lPlan && <div style={{ background:'rgba(255,159,10,0.08)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,159,10,0.18)' }}><div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>🪵 Лог</div><div style={{ display:'flex', gap:6, marginTop:6, fontVariantNumeric:'tabular-nums' }}><HighlightStrong>{lPlan.attempts.opener}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{lPlan.attempts.second}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{lPlan.attempts.third}кг</HighlightStrong></div></div>}
                </div>
                {medleyEx.length>=2 && <div style={{ background:'rgba(59,130,246,0.08)', border:'0.5px solid rgba(59,130,246,0.18)', padding:'8px 10px', borderRadius:10, fontSize:11, color:TEXT_2 }}><b style={{ color:'#60a5fa' }}>Medley</b> · {medleyEx.map(e=> `${e.name} ${e.weight}кг ${(e.workSets[0] as any)?.distanceM||20}м`).join(' → ')} <span style={{ color:TEXT_3 }}>· переход 90с · cap 180с</span></div>}
                <div style={{ fontSize:10, color:TEXT_3, lineHeight:1.4 }}>{yPlan && smEventRationale(yPlan).slice(0,2).join(' · ')} {lPlan && smEventRationale(lPlan).slice(0,2).join(' · ')}</div>
              </SectionCard></div>
            ) : null;
          })()}

          {plan.validation?.warnings.map((w,i) => <InfoBanner key={i} tone="warn">{w}</InfoBanner>)}

          {/* Heatmap 4 rows (carry/stone/overhead / squat+deadlift) — P2 как CardioUI */}
          <SectionCard icon="🔥" title="Heatmap · 4 ряда" subtitle="Carry м / Stone подъёмы / Overhead+Жим / Присед+Тяга — как CardioUI 4 rows">
            <StrengthHeatmap weeksData={plan.weeksData as any} level={plan.level} />
          </SectionCard>

          {/* Medley EventCard — глобальные слайдеры distance/timeCap как в ТЗ K UI */}
          {plan.mode==='strongman' && plan.weeksData.some(w=> w.sessions.some(s=> s.sessionTag==='event_day')) && (
            <EventCard
              title="⛓️ Medley — цепь 2+1 в плане"
              subtitle={`${plan.weeksData.filter(w=> w.sessions.some(s=> s.sessionTag==='event_day')).length} ивент-дней · distance 10-50м / cap 30-180с · суммарный cap < 360с`}
              events={(() => {
                const ev = plan.weeksData[0].sessions.find(s=> s.sessionTag==='event_day');
                if (!ev) return [];
                const carries = ev.exercises.filter(e=> ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','sandbag_carry','zercher_carry'].includes(e.id)).slice(0,2);
                const stones = ev.exercises.filter(e=> ['atlas_stone_load','sandbag_load','stone_lift','sandbag_shoulder','keg_toss'].includes(e.id)).slice(0,1);
                return [...carries, ...stones].map(e=> ({
                  id: e.id, label: e.name,
                  distanceM: (e.workSets[0] as any)?.distanceM ?? (e.id.includes('yoke')?20:40),
                  timeCapS: (e.workSets[0] as any)?.timeCapS ?? 60,
                  weight: e.weight
                }));
              })()}
              onChange={(id,patch)=> {
                // глобально правим все недели для этого ивента
                setPlan(prev=>{
                  if(!prev) return prev;
                  const copy: any = JSON.parse(JSON.stringify(prev));
                  for(const wk of copy.weeksData) for(const sess of wk.sessions.filter((s:any)=> s.sessionTag==='event_day')) for(const ex of sess.exercises.filter((e:any)=> e.id===id)) {
                    for(const ws of ex.workSets){ if(patch.distanceM!=null) (ws as any).distanceM = patch.distanceM; if(patch.timeCapS!=null) (ws as any).timeCapS = patch.timeCapS; }
                  }
                  try{ localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(copy)); }catch{}
                  return copy;
                });
              }}
            />
          )}

          {/* Недели — collapsible Apple accordion */}
          {plan.weeksData.map(wk => {
            const isOpen = expandedWeek === wk.week - 1;
            const tone = wk.deload ? '#f59e0b' : (wk as any).taper ? '#60a5fa' : '#30d158';
            const border = wk.deload ? 'rgba(245,158,11,0.22)' : (wk as any).taper ? 'rgba(59,130,246,0.22)' : 'rgba(48,209,88,0.16)';
            const tonnage = Math.round(wk.sessions.reduce((a,s)=>a+s.exercises.reduce((x,e)=>x+e.workSets.reduce((q,w)=>q+w.weight*w.reps,0),0),0)/1000);
            return (
            <div key={wk.week} data-ss="week" style={{ ...CARD, padding:0, overflow:'hidden', borderColor: border, background: isOpen ? 'linear-gradient(180deg, rgba(26,24,38,0.82), rgba(18,16,28,0.66))' : CARD.background }}>
              <button onClick={()=> setExpandedWeek(isOpen? null : wk.week-1)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'14px 14px', background: wk.deload? 'rgba(245,158,11,0.06)' : (wk as any).taper? 'rgba(59,130,246,0.06)':'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                <span style={{ width:36, height:36, borderRadius:11, background: wk.deload? 'linear-gradient(135deg,#f59e0b,#f97316)' : (wk as any).taper? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : ACCENT_GRAD, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:13, flexShrink:0, boxShadow:'0 4px 14px rgba(0,0,0,0.18)', fontFamily:'-apple-system, system-ui, sans-serif' }}>{wk.week}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#fff', lineHeight:1.1, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}><Highlight color={tone}>{ruLabel(PHASE_RU, wk.phase)}</Highlight>{wk.deload? <Highlight color="#f59e0b">разгрузка</Highlight> : (wk as any).taper? <Highlight color="#60a5fa">тапер</Highlight> : null}<span style={{ fontWeight:400, color:TEXT_3 }}>· {wk.totalSets} сетов · <Highlight color={tone}>{tonnage}т</Highlight></span></div>
                  <div style={{ fontSize:11, color:TEXT_3, marginTop:1, fontFamily:'-apple-system, system-ui, sans-serif' }}>Неделя {wk.week} · {wk.sessions.length} сессий · {wk.sessions.reduce((a,s)=>a+s.exercises.length,0)} упр.</div>
                </div>
                <span style={{ width:30, height:30, borderRadius:9, background: isOpen? `${tone}14`:'rgba(255,255,255,0.06)', border:`0.5px solid ${isOpen? tone+'22':'rgba(255,255,255,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', color: isOpen? tone:'#fff', fontSize:11, transition:'transform 0.18s', transform: isOpen? 'rotate(180deg)':'rotate(0deg)' }}>▾</span>
              </button>
              {!isOpen && (
                <div style={{ padding:'0 14px 12px', display:'flex', gap:6, flexWrap:'wrap' }}>
                  {wk.sessions.map(s=> <span key={s.day} style={{ fontSize:10.5, padding:'4px 8px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.72)', fontFamily:'-apple-system, system-ui, sans-serif' }}>{s.sessionTag} · {s.exercises.length}упр · {s.character}</span>)}
                </div>
              )}
              {isOpen && (
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', justifyContent:'flex-end' }}><button onClick={()=>{
                  const txt = wk.sessions.map(s=> `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e=> `  ${e.name} ${e.sets}x${e.reps} ${e.weight}кг RIR${e.rir}`).join('\n')).join('\n\n');
                  navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n`+txt); setMsg(`Неделя ${wk.week} скопирована`); setTimeout(()=>setMsg(''),1800);
                }} style={{ ...BTN_SMALL, background:'rgba(255,255,255,0.06)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.08)' }}>⎙ Копировать неделю</button></div>
                {wk.sessions.map(sess => (
                  <div key={sess.day} style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.06)', borderRadius:14, padding:10, backdropFilter:'blur(8px)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#fff', fontFamily:'-apple-system, system-ui, sans-serif' }}>{sess.sessionTag} <span style={{ fontWeight:500, color:TEXT_3 }}>· <Highlight color={sess.character==='тяж'?'#f59e0b': sess.character==='памп'?'#30d158':'#64d2ff'}>{sess.character}</Highlight> · день {sess.day} · {sess.durationMin}′</span></span>
                      <span style={{ fontSize:10, color:TEXT_3, background:'rgba(0,0,0,0.16)', padding:'3px 7px', borderRadius:20, border:'0.5px solid rgba(255,255,255,0.06)', fontVariantNumeric:'tabular-nums' }}>⏱ {Math.round(sess.exercises.reduce((a,e)=>a+ e.workSets.length* (e.restSeconds||90),0)/60)}′ отдыха</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {sess.exercises.map(ex => (
                        <div key={ex.id} data-ss="exercise" style={{ background:'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))', border:'0.5px solid rgba(255,255,255,0.06)', borderRadius:12, padding:10, display:'flex', flexDirection:'column', gap:7 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                            <span style={{ fontSize:12.5, fontWeight:700, color:'#fff', flex:'1 1 160px', fontFamily:'-apple-system, system-ui, sans-serif' }}>{ex.name} <span style={{ fontWeight:500, color:'rgba(235,235,245,0.62)' }}>— <Highlight color={mode==='strongman'?ACCENT_STRONG:ACCENT}>{ex.sets}×{ex.reps}</Highlight>{(ex.workSets[0] as any)?.distanceM ? <> · <Highlight color={ACCENT_STRONG}>{(ex.workSets[0] as any).distanceM}м</Highlight></> : null}{(ex.workSets[0] as any)?.timeCapS ? <> · <Highlight>{(ex.workSets[0] as any).timeCapS}с cap</Highlight></> : null} · <Highlight>{ex.weight}кг</Highlight> · <Highlight color={ex.rir<=1?'#ff3b30': ex.rir<=2?'#ff9f0a':'#30d158'}>RIR{ex.rir}</Highlight></span><span style={{ fontSize:10.5, color:TEXT_3, marginLeft:6, fontVariantNumeric:'tabular-nums' }}>· {ex.tempo} · {ex.restSeconds}с{ex.isCompetitionLift?' ★':''}</span></span>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'64px 64px 64px auto', gap:6, alignItems:'center' }}>
                            <input type="number" value={ex.weight} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { weight: Number(e.target.value)||0 })} style={{ ...INPUT, padding:'7px 8px', fontSize:12, textAlign:'center', fontVariantNumeric:'tabular-nums' }} placeholder="кг" />
                            <input type="text" value={ex.reps} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { reps: e.target.value })} style={{ ...INPUT, padding:'7px 8px', fontSize:12, textAlign:'center' }} placeholder="повт" />
                            <input type="number" value={ex.rir} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { rir: Number(e.target.value)||0 })} style={{ ...INPUT, padding:'7px 8px', fontSize:12, textAlign:'center', fontVariantNumeric:'tabular-nums' }} placeholder="RIR" />
                            <div style={{ display:'flex', gap:4 }}><button onClick={()=> moveEx(wk.week-1, sess.day, ex.id, -1)} style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.08)', color:'#fff', cursor:'pointer', fontSize:12 }}>↑</button><button onClick={()=> moveEx(wk.week-1, sess.day, ex.id, 1)} style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.08)', color:'#fff', cursor:'pointer', fontSize:12 }}>↓</button></div>
                          </div>
                          {ex.comment && <div style={{ fontSize:11, color:'rgba(235,235,245,0.68)', background: mode==='strongman'?'rgba(245,158,11,0.08)':'rgba(48,209,88,0.08)', borderLeft:`2px solid ${mode==='strongman'?'rgba(245,158,11,0.28)':'rgba(48,209,88,0.28)'}`, padding:'6px 8px', borderRadius:8, lineHeight:1.4 }}>{ex.comment}</div>}
                          {ex.warmupSets && ex.warmupSets.length>0 && <div style={{ fontSize:10.5, color:TEXT_3, fontFamily:'-apple-system, system-ui, sans-serif' }}>Разминка: {ex.warmupSets.map(s=> `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {ex.workSets.map((s,si)=> (
                              <span key={si} data-ss="set-row" style={{ display:'flex', gap:3, alignItems:'center', background:'rgba(255,255,255,0.04)', padding:'4px 6px', borderRadius:8, fontSize:10, color:'#fff', border:'0.5px solid rgba(255,255,255,0.06)', fontVariantNumeric:'tabular-nums' }}>
                                #{si+1}
                                <input type="number" value={s.weight} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{weight:Number(e.target.value)||0})} style={{ width:48, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />кг
                                <input type="number" value={s.reps} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{reps:Number(e.target.value)||0})} style={{ width:34, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />×
                                <input type="number" value={s.rir} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{rir:Number(e.target.value)||0})} style={{ width:30, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />RIR
                                <input type="number" step="0.05" placeholder="м/с" value={vbtMap[`${wk.week}-${sess.day}-${ex.id}-${si}`] ?? ''} onChange={e=> { const v=parseFloat(e.target.value); const k=`${wk.week}-${sess.day}-${ex.id}-${si}`; setVbtMap(m=> ({...m, [k]: Number.isFinite(v)?v:0})); }} style={{ width:48, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />
                                {(ex.id.includes('yoke')||ex.id.includes('farmers')||ex.id.includes('carry')||ex.id.includes('husafell')||ex.id.includes('frame')||ex.id.includes('sled')||ex.id.includes('tire')||ex.id.includes('stone')||ex.id.includes('sandbag')) && <>
                                  <input type="number" placeholder="м" title="дистанция м" value={(s as any).distanceM ?? ''} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{distanceM: Number(e.target.value)||0} as any)} style={{ width:40, padding:'3px 4px', fontSize:10, background:'rgba(255,159,10,0.10)', color:'#fff', border:'0.5px solid rgba(255,159,10,0.18)', borderRadius:6, textAlign:'center' }} />
                                  <input type="number" placeholder="с" title="cap с" value={(s as any).timeCapS ?? ''} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{timeCapS: Number(e.target.value)||0} as any)} style={{ width:40, padding:'3px 4px', fontSize:10, background:'rgba(59,130,246,0.10)', color:'#fff', border:'0.5px solid rgba(59,130,246,0.18)', borderRadius:6, textAlign:'center' }} />
                                </>}
                                {(() => { const v=vbtMap[`${wk.week}-${sess.day}-${ex.id}-${si}`]; if(!v||v<=0) return null; const e1=estimate1RMFromVelocitySS(s.weight, v, ex.id); return e1? <span style={{ fontSize:9, color:TEXT_3, fontVariantNumeric:'tabular-nums' }}>e1RM {Math.round(e1)}кг</span>:null; })()}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
            );
          })}

          {annual && (
            <>
            <SectionCard icon="🗓️" title="Годовой план" subtitle={`${annual.totalWeeks} нед · ${annual.blocks.length} блоков · синхронизация Stark`} >
              <CardHeader icon="🗓️" title={`Годовой · ${annual.totalWeeks} нед`} subtitle={`${annual.blocks.length} блоков · ${plan.weeks} нед текущий`} />
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {annual.blocks.map((b:any) => {
                  const col = b.mode==='weightlifting'?'#30d158': b.mode==='strongman'?'#ff9f0a':'#0a84ff';
                  return <span key={b.id} style={{ padding:'5px 8px', borderRadius:10, background:`${col}12`, border:`0.5px solid ${col}22`, color:col, fontSize:10, fontWeight:700, fontVariantNumeric:'tabular-nums' }}><Highlight color={col}>Нед {b.startWeek}-{b.startWeek+b.weeks-1}</Highlight>: {ruLabel(MODE_RU, b.mode)} ×{b.weeks}{((b as any).plan?.inputSnapshot as any)?.cycleId ? ` · ${String(((b as any).plan.inputSnapshot as any).cycleId).replace(/^ss-/, '')}` : ''}{b.competitionDate ? ' 🏁' : ''}</span>;
                })}
              </div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {annual.blocks.map((b:any, idx:number)=> (
                  <div key={b.id} style={{ display:'flex', gap:2, alignItems:'center', background:'rgba(255,255,255,0.04)', padding:'4px 6px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize:10, color:'#fff' }}>{idx+1}. {b.weeks}нед</span>
                    <button disabled={idx===0} onClick={()=> { const n=moveAnnualBlock(annual, idx, idx-1); if(n){ saveAnnualSS(n); setAnnual(n); setMsg(`◀ блок ${idx+1} → ${idx}`); setTimeout(()=>setMsg(''),1500);} }} style={{ ...BTN_SMALL, padding:'2px 6px', fontSize:10, opacity: idx===0?0.4:1 }}>◀</button>
                    <button disabled={idx===annual.blocks.length-1} onClick={()=> { const n=moveAnnualBlock(annual, idx, idx+1); if(n){ saveAnnualSS(n); setAnnual(n); setMsg(`▶ блок ${idx+1} → ${idx+2}`); setTimeout(()=>setMsg(''),1500);} }} style={{ ...BTN_SMALL, padding:'2px 6px', fontSize:10, opacity: idx===annual.blocks.length-1?0.4:1 }}>▶</button>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', height:16, borderRadius:10, overflow:'hidden', border:'0.5px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.18)' }}>
                {annual.blocks.map((b:any)=> {
                  const w = (b.weeks/annual.totalWeeks*100).toFixed(1);
                  const col = b.mode==='weightlifting'?'#30d158': b.mode==='strongman'?'#ff9f0a':'#0a84ff';
                  const grad = b.competitionDate ? `linear-gradient(90deg, ${col}, #fff)` : col;
                  return <div key={b.id} title={`${b.mode} ${b.weeks}нед${b.competitionDate?` · 🏁 ${b.competitionDate}`:''}`} style={{ width: `${w}%`, background: grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color: b.mode==='weightlifting'?'#06281c':'#fff', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{b.weeks}</div>;
                })}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:TEXT_3 }}><span>Нед 1</span><span>Нед {annual.totalWeeks}</span></div>
                <div style={{ fontSize:11, color:'rgba(235,235,245,0.60)', background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)' }}>Синхронизация: <Highlight>he_strength_annual_sync_v1</Highlight> · годовой доступен в дневнике и общем плане</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {rankedCycles.filter(r=> !r.blocked).map(r=> {
                    const id = r.cycle.meta.id;
                    const sel = annualCycleSel ? annualCycleSel.includes(id) : rankedCycles.filter(x=> !x.blocked).slice(0, 3).some(x=> x.cycle.meta.id===id);
                    return (
                      <ChipToggle key={id} active={sel} onClick={()=> setAnnualCycleSel(prev=> {
                        const base = prev ?? rankedCycles.filter(x=> !x.blocked).slice(0, 3).map(x=> x.cycle.meta.id);
                        return base.includes(id) ? base.filter(x=> x!==id) : [...base, id];
                      })}>{r.cycle.meta.title}</ChipToggle>
                    );
                  })}
                </div>
                <button onClick={()=>{
                  try{
                    const avail = rankedCycles.filter(r=> !r.blocked);
                    const picked = (annualCycleSel && annualCycleSel.length ? annualCycleSel.filter(id=> avail.some(r=> r.cycle.meta.id===id)) : avail.slice(0, 3).map(r=> r.cycle.meta.id));
                    if (!picked.length) { setMsg('Нет доступных циклов'); setTimeout(()=>setMsg(''),1800); return; }
                    const base: any = { mode, goal, level, workMax, equipment, injuries, mobilityRestrictions: mobility, sex, bodyweight, age, methodology, dupMode, intensityTech, outsideLoad: outsideEnabled ? outside : null, acwr: acwr as any, weakPoints: weakPoints.length ? weakPoints : undefined, contest: mode==='strongman' ? contest : undefined, contestStrategy: mode==='strongman' ? contestStrategy : undefined, startDate: new Date().toISOString().slice(0,10) };
                    const ann3 = buildAnnualFromSSCycles(picked, base, { cycleMode, competitionDate: competitionDate || undefined, taperWeeks: 1 });
                    saveAnnualSS(ann3); setAnnual(ann3);
                    try { syncStrengthAnnualToGeneral(ann3); } catch {}
                    setMsg(`✦ Год из циклов: ${picked.length} блока (${ann3.totalWeeks}нед)`); setTimeout(()=>setMsg(''),2200);
                  }catch{ setMsg('Не собралось'); setTimeout(()=>setMsg(''),1800); }
                }} style={{ ...BTN_SMALL, background:'linear-gradient(135deg, #0A84FF, #30D158)', color:'#fff', border:'none' }}>📚 Год из циклов ({annualCycleSel?.length || 3})</button>
              </SectionCard>
            {plan.mode==='strongman' && (
              <SectionCard icon="🗓️" title="Сезон — Multi-peak (PRO)" subtitle="GPP 4w + 2×camp 8-12w + transition 2w (season planner)" >
                <GroupHeading icon="🏁" text="Сезон 2 пика" desc="GPP + camp→пик + transition + camp→пик — backend готов, фронт Season Planner"/>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:TEXT_2 }}>GPP</span><input type="number" value={4} style={{ width:56, ...INPUT, padding:'6px 8px', fontSize:11, textAlign:'center' }} readOnly />
                  <span style={{ fontSize:11, color:TEXT_2 }}>Transition</span><input type="number" value={2} style={{ width:56, ...INPUT, padding:'6px 8px', fontSize:11, textAlign:'center' }} readOnly />
                  <button onClick={()=>{
                    try{
                      const p2 = buildStrengthSportPlan({ mode:'strongman', goal:'peaking', level, weeks:6, daysPerWeek: days, workMax, competitionDate, startDate: new Date().toISOString().slice(0,10), contest, contestStrategy } as any);
                      const ann2 = buildAnnualMultiPeak([plan, p2], { competitions: [{date: competitionDate || new Date(Date.now()+ 60*86400000).toISOString().slice(0,10)}, {date: new Date(Date.now()+ 150*86400000).toISOString().slice(0,10)}], gppWeeks:4, transitionWeeks:2 });
                      saveAnnualSS(ann2); setAnnual(ann2); setMsg('✦ Сезон 2 пика собран'); setTimeout(()=>setMsg(''),2200);
                    }catch{}
                  }} style={{ ...BTN_SMALL, background:'linear-gradient(135deg, #f59e0b, #ef4444)', color:'#fff', border:'none' }}>✦ Собрать сезон 2 пика</button>
                </div>
                <InfoBanner tone="strong">Multi-peak: GPP 4w + peak1 ({plan.weeks}w) + trans 2w + peak2 6w — {annual.totalWeeks}w → ~{annual.totalWeeks+8}w сезон</InfoBanner>
              </SectionCard>
            )}
            </>
          )}

          <div data-ss="exports"><SectionCard icon="📤" title="Экспорт и шаринг" subtitle="Печать · CSV/XLS · ICS · дайджест · в программу">
            <GroupHeading icon="⎙" text="Копировать и печать" desc="Быстрый обмен и печать" />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px,1fr))', gap:8 }}>
              <button onClick={() => { const txt = buildStrengthSportReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); setTimeout(()=>setMsg(''),1800); }} style={BTN}>⎙ Копировать</button>
              <button onClick={() => { const html = buildStrengthPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } setMsg('Печать'); }} style={BTN}>🖨 Печать</button>
              <button onClick={()=> { const d=shareStrengthDigest(plan); navigator.clipboard?.writeText(d); setMsg('Дайджест'); }} style={BTN}>📋 Дайджест</button>
            </div>
            <Divider />
            <GroupHeading icon="📊" text="Файлы" desc="CSV / XLS для Excel · ICS для календаря" />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px,1fr))', gap:8 }}>
              <button onClick={() => { downloadStrengthCsv(plan); setMsg('CSV'); }} style={BTN}>📊 CSV</button>
              <button onClick={() => { downloadStrengthXlsx(plan); setMsg('XLS'); }} style={{ ...BTN, background:'rgba(48,209,88,0.12)', color:'#30d158', border:'0.5px solid rgba(48,209,88,0.20)' }}>📗 XLS</button>
              <button onClick={() => { downloadStrengthIcs(plan, (plan as any).inputSnapshot?.startDate); setMsg('ICS'); }} style={BTN}>📅 ICS</button>
              <button onClick={exportToUserProgram} style={BTN_PRIMARY}>✦ В программу</button>
            </div>
            <div style={{ fontSize:11, color:TEXT_3, background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}><Highlight>Экспорт</Highlight> — библиотека программ · печать · шаринг в ТГ · ICS · CSV/XLS</div>
          </SectionCard></div>
          {msg && <InfoBanner tone="ok"><Highlight>{msg}</Highlight></InfoBanner>}
        </div>
      )}
    </div>
  );
};
