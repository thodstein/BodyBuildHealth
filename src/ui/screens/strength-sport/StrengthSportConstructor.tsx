/**
 * StrengthSportConstructor.tsx — премиальный конструктор Стронгмен / ТА.
 * Стекло + градиенты, современный мобильный стиль. Полностью изолирован.
 */
import React, { useState, useMemo } from 'react';
import { buildStrengthSportPlan } from '../../../engines/strength-sport/strength-sport-builder.engine';
import { finalizeStrengthSportPlan, buildStrengthSportReport } from '../../../engines/strength-sport/strength-sport-finalize.engine';
import { STRENGTH_SPORT_PATTERNS, recommendStrengthSportPattern } from '../../../engines/strength-sport/strength-sport-split-patterns';
import { buildStrengthCsv, downloadStrengthCsv, downloadStrengthXlsx, buildStrengthPrintHtml, shareStrengthDigest, buildStrengthTelegramUrl, buildStrengthShareHash, downloadStrengthIcs } from '../../../engines/strength-sport/strength-sport-export';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { WL_WEAKPOINT_LABELS } from '../../../engines/strength-sport/strength-sport-weakpoint';
import { buildWLMeetPlan, wlAttemptRationale } from '../../../engines/strength-sport/strength-sport-attempts.engine';
import { buildSMEventPlan, smEventRationale } from '../../../engines/strength-sport/strength-sport-strongman-attempts.engine';
import { syncStrengthAnnualToGeneral } from '../../../engines/strength-sport/strength-sport-annual-bridge';
import { estimate1RMFromVelocitySS } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { intensityZoneFor } from '../../../engines/strength-sport/strength-sport-progression';
import { saveStrengthSportPlan, loadStrengthSportPlans } from '../../../engines/strength-sport/strength-sport-storage';
import { applyMesocycleProgression } from '../../../engines/strength-sport/strength-sport-mesocycle';
import { buildAnnualFromSS, buildAnnualWithTaper, saveAnnualSS, loadAnnualSS } from '../../../engines/strength-sport/strength-sport-annual';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import type { StrengthSportInput, StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';
import { getWL, getStrong } from '../../../engines/strength-sport/strength-sport-volume';
import { CARD, CARD_ACCENT, CARD_STRONG, CARD_HERO, ROW, LABEL, HINT, HINT_SM, BTN, BTN_PRIMARY, BTN_SMALL, BTN_STRONG, BTN_GHOST, INPUT, SELECT, CHIP, CHIP_ACTIVE, CHIP_STRONG_ACTIVE, PHASE_COLOR, MODE_COLOR, ACCENT, ACCENT_GRAD, STRONG_GRAD, TEXT_3, SectionCard, StatTile, Badge, InfoBanner, GroupHeading, SectionNav, ProgressBar, ChipToggle, Field, Divider, CardHeader, Highlight, HighlightStrong, StrengthPopupSelect, MODE_RU, LEVEL_RU, PHASE_RU, ZONE_RU, EQUIP_RU, MOBILITY_RU, SESSION_TAG_RU, ruLabel } from './StrengthUI';

type Step = 'params' | 'outside' | 'split' | 'plan';
const STEP_LABEL_RU: Record<Step,string> = { params:'Параметры', outside:'Вне зала', split:'Сплит', plan:'План' };
const WM_LABEL_RU: Record<string,string> = { backSquat:'Присед', frontSquat:'Фронт. присед', deadlift:'Тяга', snatch:'Рывок', cleanJerk:'Толчок', overheadPress:'Жим стоя', yokeWalk:'Йок', farmersWalk:'Фермер', atlasStone:'Камень', axleDeadlift:'Аксель', logPress:'Лог' };

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
  const [acwr, setAcwr] = useState<{ ratio:number; zone:string } | null>(null);
  const [velocityLoss, setVelocityLoss] = useState<number>(0);
  const [taperWeeks, setTaperWeeks] = useState<number>(1);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [vbtMap, setVbtMap] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<StrengthSportPlan | null>(null);
  const [annual, setAnnual] = useState(() => loadAnnualSS());
  const [diaryLoad, setDiaryLoad] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);

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
          if(vals.length>=14){
            const acute = vals.slice(-7).reduce((a,c)=>a+c,0)/7;
            const chronic = vals.reduce((a,c)=>a+c,0)/vals.length;
            const ratio = chronic>0? acute/chronic : 0;
            let zone='optimal';
            if(ratio>1.5) zone='dangerous'; else if(ratio>1.3) zone='caution'; else if(ratio<0.8) zone='undertrained';
            setAcwr({ ratio: Math.round(ratio*100)/100, zone });
          }
        }catch{}
      }
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
    let input: StrengthSportInput = {
      mode, goal, level, weeks, daysPerWeek: days, workMax, focus, methodology, dupMode, intensityTech,
      outsideLoad: outsideEnabled ? outside : null,
      equipment, injuries, mobilityRestrictions: mobility as any,
      sex, bodyweight, age,
      competitionDate: competitionDate || undefined,
      startDate: new Date().toISOString().slice(0,10),
      acwr: acwr as any,
      velocityLossPct: velocityLoss > 0 ? velocityLoss : undefined,
      patternId: patternId || undefined,
      diaryTrend: diaryTrend || undefined,
      taperWeeks: goal==='peaking' ? taperWeeks : undefined,
      weakPoints: weakPoints.length ? weakPoints : undefined,
      ...extra,
    } as any;
    try {
      const prev = loadStrengthSportPlans()[0];
      if (prev) input = applyMesocycleProgression(prev, input) as any;
    } catch {}
    let p = buildStrengthSportPlan(input);
    p = finalizeStrengthSportPlan(p, { outsideLoad: outsideEnabled ? outside : null });
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
        else if (['deadlift','sumo_dl','axle_deadlift','rdl','deficit_pull','pause_pull'].includes(lid)) base = wmAny.deadlift || 120;
        else if (['ohp','push_press','log_press','circus_db_press','bench_bar','jerk_recovery','behind_neck_jerk'].includes(lid)) base = wmAny.overheadPress || wmAny.bench || wmAny.logPress || 60;
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

  const updateSet = (wkIdx: number, day: number, exId: string, setIdx: number, patch: Partial<{ weight:number; reps:number; rir:number }>) => {
    setPlan(prev=>{
      if(!prev) return prev;
      const copy: StrengthSportPlan = JSON.parse(JSON.stringify(prev));
      const ex = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day)?.exercises.find(e=> e.id===exId);
      if(!ex || !ex.workSets[setIdx]) return prev;
      if(patch.weight!=null){
        if(patch.weight<0 || patch.weight>600) return prev;
        ex.workSets[setIdx].weight = patch.weight;
        ex.weight = Math.round(ex.workSets.reduce((a,s)=>a+s.weight,0)/ex.workSets.length);
      }
      if(patch.reps!=null) ex.workSets[setIdx].reps = Math.max(1, Math.min(20, patch.reps));
      if(patch.rir!=null) ex.workSets[setIdx].rir = Math.max(0, Math.min(5, patch.rir));
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
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860, margin: '0 auto' }}>
      <style>{`input[type="range"]{ -webkit-appearance:none; appearance:none; height:6px; border-radius:999px; background:rgba(255,255,255,0.08); }
        input[type="range"]::-webkit-slider-thumb{ -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:${mode === 'strongman' ? '#f59e0b' : mode === 'hybrid' ? '#0ea5e9' : '#00e68a'}; border:2px solid #fff; box-shadow:0 2px 10px rgba(0,0,0,0.24); cursor:pointer; }
        input[type="range"]::-moz-range-thumb{ width:18px; height:18px; border-radius:50%; background:${mode === 'strongman' ? '#f59e0b' : mode === 'hybrid' ? '#0ea5e9' : '#00e68a'}; border:2px solid #fff; cursor:pointer; }
        input[type="date"]{ color-scheme: dark; }`}</style>

      {/* HERO */}
      <div style={mode === 'strongman' ? CARD_STRONG : CARD_HERO}>
        <div style={{ position: 'absolute', top: -36, right: -36, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${modeColor}22, transparent 70%)`, filter: 'blur(2px)', pointerEvents: 'none' }} />
        <div style={ROW}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: modeGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: mode === 'weightlifting' ? '#06281c' : '#fff', boxShadow: `0 6px 18px ${modeColor}33, inset 0 1px 0 rgba(255,255,255,0.22)`, flexShrink: 0 }}>{mode === 'weightlifting' ? '🏋️' : mode === 'strongman' ? '🪨' : '🔀'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: -0.3 }}>{mode === 'weightlifting' ? 'Тяжёлая атлетика — PRO' : mode === 'strongman' ? 'Силовой экстрим — PRO' : 'Гибрид — PRO'}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.58)', lineHeight: 1.35, marginTop: 2 }}>Torokhtiy 3/3/3/1 · Prilepin · SINCLAIR 2025 · попытки 92/97/102</div>
          </div>
          <Badge color={modeColor} bg={`${modeColor}14`} border={`${modeColor}30`}>{stepIndex}/4 · {STEP_LABEL_RU[step]}</Badge>
        </div>
        <ProgressBar value={stepIndex} max={4} color={modeColor} />
        <SectionNav activeId={step} onSelect={(id)=> setStep(id as Step)} items={[{id:'params',label:'⚙️ Параметры'},{id:'outside',label:'🏃 Вне зала'},{id:'split',label:'🧩 Сплит'},{id:'plan',label:'📋 План'}]} />
        <div style={{ ...ROW, justifyContent:'space-between' }}>
          <div style={ROW}>
            {plan && <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`}>План {plan.weeks}нед · {plan.patternId}</Badge>}
            {outsideMetrics && <Badge>Вне зала ×{outsideMetrics.volumeMultiplier}</Badge>}
            {acwr && <Badge color={acwr.zone==='dangerous'?'#fecaca': acwr.zone==='caution'?'#fde68a':'#86efac'} bg={acwr.zone==='dangerous'?'rgba(239,68,68,0.12)':'rgba(0,230,138,0.08)'}>ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)}</Badge>}
          </div>
          {msg && <span style={{ fontSize:11, fontWeight:800, color: mode==='strongman'?'#fcd34d':'#86efac', background: mode==='strongman'?'rgba(245,158,11,0.12)':'rgba(0,230,138,0.12)', border:`1px solid ${mode==='strongman'?'rgba(245,158,11,0.24)':'rgba(0,230,138,0.22)'}`, padding:'5px 10px', borderRadius:20 }}>{msg}</span>}
        </div>
      </div>

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
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label={`Недель · ${weeks}`}><input type="range" min={2} max={16} value={weeks} onChange={e => setWeeks(Number(e.target.value))} /><div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:TEXT_3 }}><span>2</span><span>16</span></div></Field>
              <Field label={`Дней/нед · ${days}`}><input type="range" min={2} max={6} value={days} onChange={e => setDays(Number(e.target.value))} /><div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:TEXT_3 }}><span>2</span><span>6</span></div></Field>
            </div>
          </SectionCard>

          <SectionCard icon="👤" title="Атлет" subtitle="Подсветка ключевых метрик">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
              <StrengthPopupSelect label="Пол" value={sex} onChange={v=> setSex(v as any)} options={[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}]} />
              <Field label="Вес, кг"><input type="number" value={bodyweight} onChange={e=> setBodyweight(Number(e.target.value)||80)} style={INPUT} /></Field>
              <Field label="Возраст"><input type="number" value={age} onChange={e=> setAge(Number(e.target.value)||30)} style={INPUT} /></Field>
              <Field label="Дата пика"><input type="date" value={competitionDate} onChange={e=> setCompetitionDate(e.target.value)} style={INPUT} /></Field>
            </div>
            {goal==='peaking' && competitionDate && (
              <StrengthPopupSelect label="Тапер" value={String(taperWeeks)} onChange={v=> setTaperWeeks(Number(v))} options={[{id:'1',label:'1 неделя',desc:'объём −45%'},{id:'2',label:'2 недели',desc:'−35% → −55%'}]} />
            )}
            {acwr && <InfoBanner tone={acwr.zone==='dangerous'?'warn': acwr.zone==='caution'?'warn':'info'}>ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)} {acwr.zone==='dangerous'?'— объём ×0.60, RIR+2': acwr.zone==='caution'?'— объём ×0.85, RIR+1': ''}</InfoBanner>}
            <Field label={`VBT потеря · ${velocityLoss}%`}><input type="range" min={0} max={40} value={velocityLoss} onChange={e=> setVelocityLoss(Number(e.target.value))} /></Field>
            {(() => {
              const sn = workMax.snatch||0, cj = workMax.cleanJerk||workMax.clean||0, sq = workMax.backSquat||0, dl = workMax.deadlift||0;
              const warns: string[] = [];
              if(sn && cj && sn > cj) warns.push('Рывок > толчка — проверьте ПМ');
              if(cj && sq && cj > sq) warns.push('Толчок > приседа — редко');
              if(sq && dl && sq > dl) warns.push('Присед > тяги — проверьте');
              return warns.length ? <InfoBanner tone="warn">{warns.join(' · ')}</InfoBanner> : null;
            })()}
          </SectionCard>

          <SectionCard icon="🧠" title="Методика и волны" subtitle="Подсветка зон RIR/веса">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <StrengthPopupSelect label="Порядок" value={methodology} onChange={v=> setMethodology(v as any)} options={[{id:'compound_first',label:'База первой',desc:'классика'},{id:'pre_exhaust',label:'Предутомление',desc:'изоляция → база'},{id:'post_exhaust',label:'Постутомление',desc:'база → изоляция'}]} />
              <StrengthPopupSelect label="DUP" value={dupMode} onChange={v=> setDupMode(v as any)} options={[{id:'off',label:'Выкл',desc:'одна зона'},{id:'heavy_light',label:'Тяж/лёг',desc:'волна'},{id:'wave',label:'Волна',desc:'3-волны'}]} />
              <StrengthPopupSelect label="Техника" value={intensityTech} onChange={v=> setIntensityTech(v as any)} options={[{id:'none',label:'Нет',desc:'чистые сеты'},{id:'cluster',label:'Кластер 3×1',desc:'база'}]} />
            </div>
          </SectionCard>

          <SectionCard icon="🏋️" title="Рабочие максимумы" subtitle="Олимпийка + сила · для стронга ниже">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:8 }}>
              {(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).map(k => (
                <Field key={k} label={WM_LABEL_RU[k]||k}><input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value)||0 }))} style={INPUT} placeholder="кг" /></Field>
              ))}
            </div>
            {mode !== 'weightlifting' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:8 }}>
                {(['yokeWalk','farmersWalk','atlasStone','logPress'] as const).map(k => (
                  <Field key={k} label={WM_LABEL_RU[k]||k}><input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value)||0 }))} style={INPUT} placeholder="кг" /></Field>
                ))}
              </div>
            )}
            <Field label="Слабые точки — объём ×1.15">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {Object.entries(WL_WEAKPOINT_LABELS).slice(0,8).map(([k,label])=> (
                  <ChipToggle key={k} active={weakPoints.includes(k)} onClick={()=> setWeakPoints(s=> s.includes(k)? s.filter(x=>x!==k): s.length>=2?s:[...s,k])}>{label}</ChipToggle>
                ))}
              </div>
            </Field>
          </SectionCard>

          <SectionCard icon="🛡️" title="Оборудование и здоровье">
            <Field label="Оборудование">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {(['barbell','dumbbell','machine','cable','other'] as const).map(eq => (
                  <ChipToggle key={eq} active={equipment.includes(eq)} onClick={()=> setEquipment(s=> s.includes(eq)? s.filter(x=>x!==eq): [...s,eq])}>{(EQUIP_RU as any)[eq] || eq}</ChipToggle>
                ))}
              </div>
            </Field>
            <Field label="Травмы — щадящий режим" hint="Снижает вес ×0.6, фильтрует опасные движения">
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <input value={injInput} onChange={e=> setInjInput(e.target.value)} placeholder="напр.: колено, плечо" style={{ ...INPUT, flex:1, minWidth:160 }} />
                <button onClick={() => { const parts = injInput.split(',').map(s=> s.trim()).filter(Boolean); setInjuries(parts.map(p=> ({ location: p, type: 'joint' }))); setMsg(parts.length? '✦ Травмы применены':'Список очищен'); setTimeout(()=>setMsg(''),1800); }} style={BTN_SMALL}>Применить</button>
              </div>
              {injuries.length>0 && <InfoBanner tone="warn">Щадящий: {injuries.map((j:any)=> j.location).join(', ')}</InfoBanner>}
            </Field>
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
        <SectionCard icon="🏃" title="Вне зала — поле / кроссфит" subtitle="ACWR и объём зала ×">
          <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, color:'#fff', fontWeight:800, background: outsideEnabled ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.03)', padding:'11px 12px', borderRadius:12, border:`1px solid ${outsideEnabled?'rgba(0,230,138,0.20)':'rgba(255,255,255,0.06)'}`, cursor:'pointer' }}>
            <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} style={{ width:18, height:18, accentColor:'#00e68a' }} /> Учитывать внезальную нагрузку
          </label>
          {outsideEnabled && outside && (
            <>
              <Field label={`Сессий/нед · ${outside.sessionsPerWeek}`}><input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} /></Field>
              <Field label={`Длительность · ${outside.avgDurationMin} мин`}><input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} /></Field>
              <Field label={`RPE · ${outside.avgSRPE}`}><input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} /></Field>
              <InfoBanner tone={outsideMetrics?.interference === 'high' ? 'warn' : 'info'}>{outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier} (${outsideMetrics.interference})` : 'Вне зала: нет данных — объём 100%'}</InfoBanner>
            </>
          )}
          <button onClick={() => setStep('split')} style={{ ...(mode==='strongman'?BTN_STRONG:BTN_PRIMARY), width:'100%' }}>Далее → Сплит</button>
        </SectionCard>
      )}

      {step === 'split' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ ...CARD, padding:14, gap:10 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ width:32, height:32, borderRadius:10, background: modeGrad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>✨</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:900, color:'#fff' }}>Рекомендуем: <span style={{ color: modeColor }}>{recommendStrengthSportPattern(mode, days, level).name}</span></div>
                <div style={{ fontSize:11, color:TEXT_3 }}>{patternId ? `Выбран: ${STRENGTH_SPORT_PATTERNS.find(p=>p.id===patternId)?.name}` : 'Авто по режиму/дням/уровню'}</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
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
          <button onClick={build} style={{ ...(mode==='strongman'?BTN_STRONG:BTN_PRIMARY), width:'100%', padding:'14px 16px', fontSize:13, borderRadius:14 }}>✦ Собрать план {patternId ? `· ${patternId}` : ''}</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(14,165,233,0.06), rgba(18,16,28,0.72))', border:'1px solid rgba(0,230,138,0.18)', borderRadius:16, padding:14, color:'#fff', fontSize:11, whiteSpace:'pre-wrap', boxShadow:'0 10px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter:'blur(14px)' }}>
            <div style={{ fontSize:10, fontWeight:900, letterSpacing:0.6, textTransform:'uppercase', color:'rgba(255,255,255,0.52)', marginBottom:6 }}>Сводка плана</div>
            {buildStrengthSportReport(plan)}
          </div>

          {plan.mode === 'weightlifting' && (plan.workMax.snatch || 0) > 0 && (plan.workMax.cleanJerk || (plan.workMax as any).clean || 0) > 0 && (() => {
            const meet = buildWLMeetPlan(plan.workMax.snatch as number, (plan.workMax.cleanJerk || (plan.workMax as any).clean) as number, 'balanced', { bodyweight, sex });
            return meet ? (
              <div style={{ ...CARD, borderColor:'rgba(59,130,246,0.22)', background:'linear-gradient(180deg, rgba(59,130,246,0.10), rgba(18,16,28,0.62))' }}>
                <CardHeader icon="🏋️" title="Попытки ТА · IWF 1кг" subtitle={`Тотал ${meet.total}кг ${meet.sinclair?`· Sinclair ${meet.sinclair}`:''} ${(meet as any).robi?`· Robi ${(meet as any).robi}`:''}`} />
                <div style={{ fontSize:11, color:'#fff' }}><b>Рывок:</b> {meet.snatch.opener} / {meet.snatch.second} / {meet.snatch.third} кг · <b>Толчок:</b> {meet.cleanJerk.opener} / {meet.cleanJerk.second} / {meet.cleanJerk.third} кг</div>
                <div style={{ fontSize:10, color:TEXT_3 }}>{wlAttemptRationale(meet).slice(2).join(' · ')}</div>
              </div>
            ) : null;
          })()}
          {plan.mode !== 'weightlifting' && (() => {
            const yoke = (plan.workMax as any).yokeWalk || (plan.workMax as any).deadlift;
            const log = (plan.workMax as any).logPress || (plan.workMax as any).overheadPress;
            const yPlan = yoke ? buildSMEventPlan('yoke_walk', yoke) : null;
            const lPlan = log ? buildSMEventPlan('log_press', log) : null;
            return (yPlan || lPlan) ? (
              <div style={{ ...CARD_STRONG, padding:14 }}>
                <CardHeader icon="🪨" title="Попытки стронг" subtitle="шаг йок 10кг / лог 2.5кг" strong />
                {yPlan && <div style={{ fontSize:11, color:'#fff' }}>Йок: {yPlan.attempts.opener} / {yPlan.attempts.second} / {yPlan.attempts.third} кг</div>}
                {lPlan && <div style={{ fontSize:11, color:'#fff' }}>Лог: {lPlan.attempts.opener} / {lPlan.attempts.second} / {lPlan.attempts.third} кг</div>}
              </div>
            ) : null;
          })()}

          {plan.validation?.warnings.map((w,i) => <InfoBanner key={i} tone="warn">{w}</InfoBanner>)}

          {/* Карта качества */}
          <div style={CARD}>
            <div style={{ fontSize:12, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:8 }}><span style={{ width:28, height:28, borderRadius:9, background: ACCENT_GRAD, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✦</span>Карта качества</div>
            {([
              { key:'snatch', label:'Рывок', ids:['snatch','hang_snatch','power_snatch'], get:'snatch' },
              { key:'cl', label:'Толчок', ids:['clean_and_jerk','hang_clean'], get:'cleanJerk' },
              { key:'squat', label:'Присед', ids:['back_squat','front_squat'], get:'squat' },
            ] as any).map((row:any)=> (
              <div key={row.key} style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:900, letterSpacing:0.5, textTransform:'uppercase', color:'#86efac', minWidth:52 }}>{row.label}</span>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
                  {plan.weeksData.map(wk=>{
                    const cnt = wk.sessions.flatMap(s=> s.exercises.filter(e=> row.ids.some((id:string)=> e.id.includes(id)))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
                    const lm = getWL(plan.level, row.get as any); const st = lm ? (cnt<lm.mev?'below': cnt<=lm.mav?'optimal': cnt<=lm.mrv?'high':'over') : 'optimal';
                    const col = st==='below'?'#f59e0b': st==='optimal'?'#00e68a': st==='high'?'#eab308':'#ef4444';
                    return <span key={wk.week} style={{ padding:'4px 8px', borderRadius:10, background:col+'14', border:`1px solid ${col}2e`, color:col, fontSize:10.5, fontWeight:800 }}>Н{wk.week}: {cnt}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Недели */}
          {plan.weeksData.map(wk => (
            <div key={wk.week} style={{ ...CARD, padding:0, overflow:'hidden', borderColor: wk.deload? 'rgba(245,158,11,0.22)' : (wk as any).taper? 'rgba(59,130,246,0.22)' : 'rgba(0,230,138,0.12)' }}>
              <div style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', background: wk.deload? 'rgba(245,158,11,0.06)' : (wk as any).taper? 'rgba(59,130,246,0.06)' : 'transparent' }}>
                <span style={{ fontSize:13, fontWeight:900, color: wk.deload? '#f59e0b' : (wk as any).taper? '#60a5fa' : '#00e68a' }}>Неделя {wk.week} · {ruLabel(PHASE_RU, wk.phase)}{wk.deload? ' · разгрузка':(wk as any).taper?' · тапер':''} · {wk.totalSets} сетов · {Math.round(wk.sessions.reduce((a,s)=>a+s.exercises.reduce((x,e)=>x+e.workSets.reduce((q,w)=>q+w.weight*w.reps,0),0),0)/1000)}т</span>
                <button onClick={()=>{
                  const txt = wk.sessions.map(s=> `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e=> `  ${e.name} ${e.sets}x${e.reps} ${e.weight}кг RIR${e.rir}`).join('\n')).join('\n\n');
                  navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n`+txt); setMsg(`Неделя ${wk.week} скопирована`); setTimeout(()=>setMsg(''),1800);
                }} style={{ ...BTN_SMALL, background:'rgba(255,255,255,0.06)', color:'#fff' }}>⎙ Копировать</button>
              </div>
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:10 }}>
                {wk.sessions.map(sess => (
                  <div key={sess.day} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:12, fontWeight:900, color:'#fff' }}>{sess.sessionTag} <span style={{ fontWeight:600, color:TEXT_3 }}>· {sess.character} · день {sess.day} · {sess.durationMin} мин</span></span>
                      <span style={{ fontSize:10, color:TEXT_3, background:'rgba(0,0,0,0.16)', padding:'3px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>⏱ {Math.round(sess.exercises.reduce((a,e)=>a+ e.workSets.length* (e.restSeconds||90),0)/60)} мин</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {sess.exercises.map(ex => (
                        <div key={ex.id} style={{ background:'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:10, display:'flex', flexDirection:'column', gap:7 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                            <span style={{ fontSize:12.5, fontWeight:900, color:'#fff', flex:'1 1 160px' }}>{ex.name} <span style={{ fontWeight:600, color:'rgba(255,255,255,0.58)' }}>— {ex.sets}×{ex.reps} · {ex.weight}кг · RIR{ex.rir}</span><span style={{ fontSize:10.5, color:TEXT_3, marginLeft:6 }}>· {ex.tempo} · {ex.restSeconds}с{ex.isCompetitionLift?' ★':''}</span></span>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'64px 64px 64px auto', gap:6, alignItems:'center' }}>
                            <input type="number" value={ex.weight} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { weight: Number(e.target.value)||0 })} style={{ ...INPUT, padding:'7px 8px', fontSize:12, textAlign:'center' }} />
                            <input type="text" value={ex.reps} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { reps: e.target.value })} style={{ ...INPUT, padding:'7px 8px', fontSize:12, textAlign:'center' }} />
                            <input type="number" value={ex.rir} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { rir: Number(e.target.value)||0 })} style={{ ...INPUT, padding:'7px 8px', fontSize:12, textAlign:'center' }} />
                            <div style={{ display:'flex', gap:4 }}><button onClick={()=> moveEx(wk.week-1, sess.day, ex.id, -1)} style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', cursor:'pointer' }}>↑</button><button onClick={()=> moveEx(wk.week-1, sess.day, ex.id, 1)} style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', cursor:'pointer' }}>↓</button></div>
                          </div>
                          {ex.comment && <div style={{ fontSize:11, color:'rgba(255,255,255,0.58)', background: mode==='strongman'?'rgba(245,158,11,0.06)':'rgba(0,230,138,0.06)', borderLeft:`2px solid ${mode==='strongman'?'rgba(245,158,11,0.28)':'rgba(0,230,138,0.28)'}`, padding:'6px 8px', borderRadius:8 }}>{ex.comment}</div>}
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {ex.workSets.map((s,si)=> (
                              <span key={si} style={{ display:'flex', gap:3, alignItems:'center', background:'rgba(255,255,255,0.04)', padding:'4px 6px', borderRadius:8, fontSize:10, color:'#fff', border:'1px solid rgba(255,255,255,0.06)' }}>
                                #{si+1}
                                <input type="number" value={s.weight} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{weight:Number(e.target.value)||0})} style={{ width:48, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center' }} />кг
                                <input type="number" value={s.reps} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{reps:Number(e.target.value)||0})} style={{ width:34, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center' }} />×
                                <input type="number" value={s.rir} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{rir:Number(e.target.value)||0})} style={{ width:30, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center' }} />RIR
                                <input type="number" step="0.05" placeholder="м/с" value={vbtMap[`${wk.week}-${sess.day}-${ex.id}-${si}`] ?? ''} onChange={e=> { const v=parseFloat(e.target.value); const k=`${wk.week}-${sess.day}-${ex.id}-${si}`; setVbtMap(m=> ({...m, [k]: Number.isFinite(v)?v:0})); }} style={{ width:48, padding:'3px 4px', fontSize:10, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.10)', borderRadius:6, textAlign:'center' }} />
                                {(() => { const v=vbtMap[`${wk.week}-${sess.day}-${ex.id}-${si}`]; if(!v||v<=0) return null; const e1=estimate1RMFromVelocitySS(s.weight, v, ex.id); return e1? <span style={{ fontSize:9, color:TEXT_3 }}>e1RM {Math.round(e1)}кг</span>:null; })()}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {annual && (
            <div style={{ ...CARD, borderColor:'rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:12, fontWeight:900, color:'#fff' }}>Годовой план · {annual.totalWeeks} нед · {annual.blocks.length} блоков</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {annual.blocks.map((b:any) => <span key={b.id} style={{ padding:'4px 8px', borderRadius:10, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.18)', color:'#00e68a', fontSize:10, fontWeight:800 }}>Нед {b.startWeek}-{b.startWeek+b.weeks-1}: {b.mode} ×{b.weeks}</span>)}
              </div>
              <div style={{ display:'flex', height:14, borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
                {annual.blocks.map((b:any)=> {
                  const w = (b.weeks/annual.totalWeeks*100).toFixed(1);
                  const col = b.mode==='weightlifting'?'#00e68a': b.mode==='strongman'?'#f59e0b':'#3b82f6';
                  return <div key={b.id} style={{ width: `${w}%`, background: col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color: b.mode==='weightlifting'?'#06281c':'#fff', fontWeight:900 }}>{b.weeks}</div>;
                })}
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:8 }}>
            <button onClick={() => { const txt = buildStrengthSportReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); setTimeout(()=>setMsg(''),1800); }} style={BTN}>⎙ Копировать</button>
            <button onClick={() => { const html = buildStrengthPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } setMsg('Печать'); }} style={BTN}>🖨 Печать</button>
            <button onClick={() => { downloadStrengthCsv(plan); setMsg('CSV'); }} style={BTN}>📊 CSV</button>
            <button onClick={() => { downloadStrengthXlsx(plan); setMsg('XLS'); }} style={{ ...BTN, background:'rgba(34,197,94,0.12)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.20)' }}>📗 XLS</button>
            <button onClick={() => { downloadStrengthIcs(plan, (plan as any).inputSnapshot?.startDate); setMsg('ICS'); }} style={BTN}>📅 ICS</button>
            <button onClick={()=> { const d=shareStrengthDigest(plan); navigator.clipboard?.writeText(d); setMsg('Дайджест'); }} style={BTN}>📋 Дайджест</button>
            <button onClick={exportToUserProgram} style={BTN_PRIMARY}>✦ В программу</button>
          </div>
          {msg && <InfoBanner tone="ok">{msg}</InfoBanner>}
        </div>
      )}
    </div>
  );
};
