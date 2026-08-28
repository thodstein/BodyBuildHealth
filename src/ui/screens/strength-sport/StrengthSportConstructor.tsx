/**
 * StrengthSportConstructor.tsx — изолированный конструктор Силовой экстрим / ТА.
 * Полностью отделён от ББ/ПЛ: не импортирует их движки, каталоги, типы.
 * Только силовая часть зала. Внешняя нагрузка (поле) — декларация.
 */
import React, { useState, useMemo } from 'react';
import { buildStrengthSportPlan } from '../../../engines/strength-sport/strength-sport-builder.engine';
import { finalizeStrengthSportPlan, buildStrengthSportReport } from '../../../engines/strength-sport/strength-sport-finalize.engine';
import { STRENGTH_SPORT_PATTERNS, recommendStrengthSportPattern } from '../../../engines/strength-sport/strength-sport-split-patterns';
import { buildStrengthCsv, downloadStrengthCsv, buildStrengthPrintHtml, shareStrengthDigest, buildStrengthTelegramUrl, buildStrengthShareHash } from '../../../engines/strength-sport/strength-sport-export';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { saveStrengthSportPlan, loadStrengthSportPlans } from '../../../engines/strength-sport/strength-sport-storage';
import { applyMesocycleProgression } from '../../../engines/strength-sport/strength-sport-mesocycle';
import { buildAnnualFromSS, buildAnnualWithTaper, saveAnnualSS, loadAnnualSS } from '../../../engines/strength-sport/strength-sport-annual';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import type { StrengthSportInput, StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';
import { getWL, getStrong } from '../../../engines/strength-sport/strength-sport-volume';
import { CARD, CARD_ACCENT, CARD_STRONG, ROW, LABEL, HINT, HINT_SM, BTN, BTN_PRIMARY, BTN_SMALL, BTN_STRONG, INPUT, CHIP, CHIP_ACTIVE, CHIP_STRONG_ACTIVE, PHASE_COLOR, MODE_COLOR, SectionCard, StatTile, Badge, InfoBanner, GroupHeading, SectionNav, ProgressBar, Stepper, ChipToggle, Field, Divider } from './StrengthUI';

type Step = 'params' | 'outside' | 'split' | 'plan';

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
  const [workMax, setWorkMax] = useState<StrengthSportInput['workMax']>({ backSquat: 120, deadlift: 160, snatch: 70, cleanJerk: 90, overheadPress: 60 });
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
        // P0-7 ACWR из sRPE (как в TrainingScreen)
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
      const lifestyle = p.lifestyle || {};
      const health = p.health || {};
      if (training.workMax) setWorkMax(s => ({ ...s, ...training.workMax }));
      if (personal.workMax) setWorkMax(s => ({ ...s, ...personal.workMax }));
      if ((training.workMaxByExercise || personal.workMaxByExercise)) {
        // workMaxByExercise → workMax маппинг (упрощённо берём chest/back как squat/press)
      }
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
      // lifestyle → sleep/hrv/stress позже в build пробросим
      const sport = (training.sportType || p.goals?.primaryGoal || '').toLowerCase();
      if (sport.includes('weightlifting') || sport.includes('та')) setOutside(defaultOutsideLoadFor('weightlifting'));
      else if (sport.includes('strongman') || sport.includes('стронг')) setOutside(defaultOutsideLoadFor('strongman'));
      setMsg('Профиль подтянут: ' + (personal.sex || '') + ' ' + (personal.weight || '') + 'кг');
    } catch {}
  };

  const build = () => {
    // P0-12: тянем recovery/питание из профиля
    let extra: any = {};
    try{
      const raw = localStorage.getItem('he_profile_v2');
      if(raw){
        const p = JSON.parse(raw);
        const personal = p.personal || {};
        const lifestyle = p.lifestyle || {};
        const health = p.health || {};
        extra.bodyFat = typeof personal.bodyFat === 'number' ? personal.bodyFat : undefined;
        extra.leanMass = typeof personal.bodyFat === 'number' && typeof personal.weight === 'number' ? Math.round(personal.weight * (1 - personal.bodyFat/100)) : undefined;
        extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined;
        extra.sleepHours = typeof lifestyle.sleepHours === 'number' ? lifestyle.sleepHours : undefined;
        extra.stressLevel = typeof lifestyle.stressLevel === 'number' ? lifestyle.stressLevel : undefined;
        extra.calorieSurplus = typeof p.nutrition?.calorieSurplus === 'number' ? p.nutrition.calorieSurplus : undefined;
        extra.proteinPerKg = typeof p.nutrition?.proteinPerKg === 'number' ? p.nutrition.proteinPerKg : undefined;
        // pharma
        const ph = p.pharma || {};
        if(Array.isArray(ph.currentSubstances) && ph.currentSubstances.length) extra.peds = ph.currentSubstances;
      }
    }catch{}
    // P3 diary e1RM trend 28д (epley) — считываем логи как в BB
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
    } catch {}
    setMsg('План сохранён · питание/кардио payload записан');
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
        if (patch.weight < 0 || patch.weight > 500) { setMsg('Вес вне диапазона 0-500'); return prev; }
        ex.weight = patch.weight;
        // P1: pct autosync — вес ↔ %ПМ (база из workMax)
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
        if (patch.rir < 0 || patch.rir > 5) { setMsg('RIR 0-5'); return prev; }
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
        // также обновляем общий вес упражнения как среднее
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
    try { saveUserProgram(prog); setMsg('Экспортировано в Библиотеку (he_user_programs) + he_last_strength_program'); } catch {}
    try { localStorage.setItem('he_last_strength_program', JSON.stringify(prog)); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog, null, 2)); } catch {}
  };

  const stepIndex = (['params','outside','split','plan'] as Step[]).indexOf(step) + 1;
  const modeColor = mode === 'weightlifting' ? '#00e68a' : mode === 'strongman' ? '#f59e0b' : '#3b82f6';
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={mode === 'strongman' ? CARD_STRONG : CARD_ACCENT}>
        <div style={ROW}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${modeColor},${modeColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: modeColor === '#00e68a' ? '#000' : '#fff' }}>{mode === 'weightlifting' ? '🏋️' : mode === 'strongman' ? '🪨' : '🔀'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{mode === 'weightlifting' ? 'Тяжёлая атлетика — PRO' : mode === 'strongman' ? 'Силовой экстрим — PRO' : 'Гибрид — PRO'}</div>
            <div style={HINT_SM}>Torokhtiy 3/3/3/1 · Prilepin · SINCLAIR 2025 · попытки 92/97/102 · внезальная × — интегрировано</div>
          </div>
          <Badge color={modeColor} bg={`${modeColor}14`} border={`${modeColor}32`}>{stepIndex}/4 · {step}</Badge>
        </div>
        <ProgressBar value={stepIndex} max={4} color={modeColor} />
        <SectionNav items={[{id:'params',label:'⚙️ Параметры'},{id:'outside',label:'🏃 Вне зала'},{id:'split',label:'🧩 Сплит'},{id:'plan',label:'📋 План'}]} />
        <div style={ROW}>
          {(['params','outside','split','plan'] as Step[]).map(s => (
            <ChipToggle key={s} active={step===s} onClick={() => setStep(s)}>{s}</ChipToggle>
          ))}
          {plan && <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}24`}>План {plan.weeks}нед · {plan.patternId}</Badge>}
          {outsideMetrics && <Badge>Вне зала ×{outsideMetrics.volumeMultiplier}</Badge>}
          {acwr && <Badge color={acwr.zone==='dangerous'?'#ef4444': acwr.zone==='caution'?'#f59e0b':'#00e68a'} bg={acwr.zone==='dangerous'?'rgba(239,68,68,0.12)':'rgba(0,230,138,0.08)'}>ACWR {acwr.ratio}</Badge>}
        </div>
      </div>

      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12 }}>Режим</label>
          <select value={mode} onChange={e => setMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="weightlifting">Тяжёлая атлетика</option>
            <option value="strongman">Силовой экстрим</option>
            <option value="hybrid">Гибрид</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Цель</label>
          <select value={goal} onChange={e => setGoal(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="strength">Сила</option>
            <option value="hypertrophy">Масса</option>
            <option value="technique">Техника</option>
            <option value="peaking">Пик</option>
            <option value="maintenance">Поддержание</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Уровень</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="beginner">Новичок</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Enhanced</option>
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Пол: <select value={sex} onChange={e=> setSex(e.target.value as any)} style={{ padding: 4, borderRadius: 6, width: 90 }}><option value="male">М</option><option value="female">Ж</option></select></label>
            <label style={{ color: '#fff', fontSize: 11 }}>Вес тела: <input type="number" value={bodyweight} onChange={e=> setBodyweight(Number(e.target.value)||80)} style={{ width: 70, padding: 4, borderRadius: 6 }} /> кг</label>
            <label style={{ color: '#fff', fontSize: 11 }}>Возраст: <input type="number" value={age} onChange={e=> setAge(Number(e.target.value)||30)} style={{ width: 70, padding: 4, borderRadius: 6 }} /></label>
            <label style={{ color: '#fff', fontSize: 11 }}>Дата пика: <input type="date" value={competitionDate} onChange={e=> setCompetitionDate(e.target.value)} style={{ padding: 4, borderRadius: 6, fontSize: 10 }} /></label>
          </div>
          {goal==='peaking' && competitionDate && (
            <label style={{ color: '#fff', fontSize: 11 }}>Тейпер недель: <select value={taperWeeks} onChange={e=> setTaperWeeks(Number(e.target.value))} style={{ padding: 4, borderRadius: 6 }}><option value={1}>1 нед</option><option value={2}>2 нед</option></select> <span style={{ opacity:0.6, fontSize:10 }}>— объём ×0.55/0.45, интенсивность 92-95%</span></label>
          )}
          {acwr && <div style={{ fontSize: 10, color: acwr.zone==='dangerous'?'#ef4444': acwr.zone==='caution'?'#eab308':'#00e68a', background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 4 }}>ACWR {acwr.ratio} · {acwr.zone} {acwr.zone==='dangerous'?'— объём ×0.60, RIR+2': acwr.zone==='caution'?'— объём ×0.85, RIR+1': ''}</div>}
          <label style={{ color: '#fff', fontSize: 11 }}>VBT потеря скорости: {velocityLoss}% {velocityLoss>20?'— снизьте объём':''}</label>
          <input type="range" min={0} max={40} value={velocityLoss} onChange={e=> setVelocityLoss(Number(e.target.value))} />
          {(() => {
            const sn = workMax.snatch||0, cj = workMax.cleanJerk||workMax.clean||0, sq = workMax.backSquat||0, dl = workMax.deadlift||0;
            const warns: string[] = [];
            if(sn && cj && sn > cj) warns.push('Рывок > толчка — проверьте ПМ');
            if(cj && sq && cj > sq) warns.push('Толчок > приседа — редко, проверьте');
            if(sq && dl && sq > dl) warns.push('Присед > тяги — проверьте (обычно тяга выше)');
            return warns.length ? <div style={{ fontSize: 10, color: '#f59e0b' }}>{warns.map((w,i)=><div key={i}>⚠ {w}</div>)}</div> : null;
          })()}
          <label style={{ color: '#fff', fontSize: 12 }}>Недель: {weeks}</label>
          <input type="range" min={2} max={16} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Дней/нед в зале: {days}</label>
          <input type="range" min={2} max={6} value={days} onChange={e => setDays(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Фокус зала (специализация)</label>
          <select value={focus || ''} onChange={e => setFocus((e.target.value || null) as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="">Без фокуса (баланс)</option>
            <option value="snatch">Рывок</option>
            <option value="clean">Толчок/взятие</option>
            <option value="squat">Присед</option>
            <option value="overhead">Жим/лог</option>
            <option value="carry">Переноски (фермер/йок)</option>
            <option value="stone">Камни</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Методика порядка</label>
          <select value={methodology} onChange={e => setMethodology(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="compound_first">База первой</option>
            <option value="pre_exhaust">Предутомление</option>
            <option value="post_exhaust">Постутомление</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>DUP волны</label>
          <select value={dupMode} onChange={e => setDupMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="off">Выкл</option>
            <option value="heavy_light">Тяж/лёг</option>
            <option value="wave">Волна</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Интенс-техника</label>
          <select value={intensityTech} onChange={e => setIntensityTech(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="none">Нет</option>
            <option value="cluster">Кластер (3×1)</option>
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).map(k => (
              <label key={k} style={{ color: '#fff', fontSize: 11 }}>{k}: <input type="number" value={(workMax as any)[k] || 0} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value) }))} style={{ width: 70, padding: 4, borderRadius: 6 }} /></label>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Оборудование (пусто — всё доступно)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['barbell','dumbbell','machine','cable','other'].map(eq => (
                <label key={eq} style={{ color: '#fff', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" checked={equipment.includes(eq)} onChange={e => setEquipment(s => e.target.checked ? [...s, eq] : s.filter(x=>x!==eq))} /> {eq}
                </label>
              ))}
            </div>
            <label style={{ color: '#fff', fontSize: 11 }}>Щадящие травмы (knee/back/shoulder/wrist, через запятую)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={injInput} onChange={e=> setInjInput(e.target.value)} placeholder="knee, shoulder" style={{ flex: 1, padding: 4, borderRadius: 6, fontSize: 11 }} />
              <button onClick={() => { const parts = injInput.split(',').map(s=> s.trim()).filter(Boolean); setInjuries(parts.map(p=> ({ location: p, type: 'joint' }))); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: '#00e68a', color: '#000', cursor: 'pointer' }}>Применить</button>
            </div>
            {injuries.length>0 && <div style={{ fontSize: 10, color: '#f59e0b' }}>Щадящий режим: {injuries.map((j:any)=> j.location).join(', ')} — вес ×0.6, +RIR</div>}
            <label style={{ color: '#fff', fontSize: 11 }}>Мобильность (ограничения)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['shoulder','hip','knee','ankle','wrist','lower_back'].map(m => (
                <label key={m} style={{ color: '#fff', fontSize: 10, display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input type="checkbox" checked={mobility.includes(m)} onChange={e => setMobility(s => e.target.checked ? [...s, m] : s.filter(x=> x!==m))} /> {m}
                </label>
              ))}
            </div>
          </div>
          <button onClick={pullFromProfile} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Подтянуть из профиля</button>
          <button onClick={() => setStep('outside')} style={{ padding: '8px 12px', borderRadius: 8, background: '#00e68a', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Далее → Вне зала</button>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} /> Учитывать внезальную нагрузку
          </label>
          {outsideEnabled && outside && (
            <>
              <label style={{ color: '#fff', fontSize: 11 }}>Сессий/нед вне зала: {outside.sessionsPerWeek}</label>
              <input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>Длительность мин: {outside.avgDurationMin}</label>
              <input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>RPE: {outside.avgSRPE}</label>
              <input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} />
              <div style={{ fontSize: 11, color: '#00e68a' }}>{outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier}` : ''}</div>
            </>
          )}
          <button onClick={() => setStep('split')} style={{ padding: '8px 12px', borderRadius: 8, background: '#00e68a', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Далее → Сплит</button>
        </div>
      )}

      {step === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <div style={{ color: '#fff', fontSize: 12 }}>Рекомендуемый: <b style={{ color: '#00e68a' }}>{recommendStrengthSportPattern(mode, days, level).name}</b> {patternId ? `· выбран: ${STRENGTH_SPORT_PATTERNS.find(p=>p.id===patternId)?.name || patternId}` : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STRENGTH_SPORT_PATTERNS.filter(p => p.mode===mode || p.mode==='any').map(p => {
              const active = patternId ? patternId===p.id : p.id===recommendStrengthSportPattern(mode, days, level).id;
              const preview = p.schedule.map((s,i)=> s.kind==='тренировка' ? (s.sessionTag||'тренировка').slice(0,4) : 'отд').join(' · ');
              return (
                <button key={p.id} onClick={()=> setPatternId(p.id)} style={{ textAlign: 'left', padding: 8, borderRadius: 8, background: active ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)', border: active ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>{p.name}</b><span style={{ fontSize: 10, opacity: 0.7 }}>{p.sessionsPerRotation}×/нед</span></div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{p.description}</div>
                  <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, fontFamily: 'monospace' }}>{preview}</div>
                  {active && <div style={{ fontSize: 9, color: '#00e68a', marginTop: 2 }}>● выбран — предпросмотр: {p.schedule.filter(s=>s.kind==='тренировка').map(s=> s.sessionTag).join(', ')}</div>}
                </button>
              );
            })}
          </div>
          <button onClick={build} style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, cursor: 'pointer' }}>Собрать план {patternId ? `(${patternId})` : ''}</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(0,230,138,0.1)', padding: 10, borderRadius: 10, color: '#fff', fontSize: 11, whiteSpace: 'pre-wrap' }}>{buildStrengthSportReport(plan)}</div>
          {plan.validation?.warnings.map((w,i) => <div key={i} style={{ color: '#f59e0b', fontSize: 11 }}>⚠ {w}</div>)}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Quality heatmap (подъёмы/нед vs MEV/MAV/MRV) — P0-4 расширение:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {plan.weeksData.map(wk => {
                const sn = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['snatch','hang_snatch','power_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
                const lm = getWL(plan.level,'snatch'); const st = lm ? (sn<lm.mev?'below': sn<=lm.mav?'optimal': sn<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#00e68a': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} title={`${sn}/${lm?.mav}`} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: {sn} рывков</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {plan.weeksData.map(wk => {
                const cl = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['clean_and_jerk','hang_clean','power_clean','deficit_clean','block_clean','pause_clean','push_jerk','split_jerk'].includes(e.id))).reduce((a,e)=> a + e.workSets.reduce((x,s)=> x+s.reps,0),0);
                const lm = getWL(plan.level,'cleanJerk'); const st = lm ? (cl<lm.mev?'below': cl<=lm.mav?'optimal': cl<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#00e68a': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: {cl} толчков</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {plan.weeksData.map(wk => {
                const sq = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['back_squat','front_squat','squat','hack_squat','pause_squat'].includes(e.id))).reduce((a,e)=> a+e.sets,0);
                const lm = plan.mode==='strongman'? getStrong(plan.level,'squat'): getWL(plan.level,'squat'); const st = lm ? (sq<lm.mev?'below': sq<=lm.mav?'optimal': sq<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#00e68a': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: {sq} присед</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {plan.weeksData.map(wk => {
                const carry = wk.sessions.flatMap(s=> s.exercises.filter(e=> ['farmers_walk_heavy','yoke_walk','zercher_carry','sled_push_sprint'].includes(e.id))).reduce((a,e)=> a+e.sets,0)*20;
                const lm = getStrong(plan.level,'carry'); const st = lm ? (carry<lm.mev?'below': carry<=lm.mav?'optimal': carry<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#00e68a': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: {carry}м carry</span>;
              })}
            </div>
            {acwr && <div style={{ marginTop: 6, fontSize: 10, color: acwr.zone==='dangerous'?'#ef4444': acwr.zone==='caution'?'#eab308':'#00e68a' }}>ACWR {acwr.ratio} ({acwr.zone}) — объём скорректирован ×{acwr.zone==='dangerous'?0.65: acwr.zone==='caution'?0.85:1}</div>}
          </div>
          {diaryLoad != null && (
            <div style={{ background: diaryLoad > 30 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 6, border: `1px solid ${diaryLoad > 30 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, color: diaryLoad > 30 ? '#f59e0b' : '#fff', fontSize: 10 }}>
              Дневник (изолированно): нагрузка 7д ≈ {diaryLoad}{diaryLoad > 30 ? ' — высоко, рассмотрите лёгкую неделю' : ' — норма'}
            </div>
          )}
          {plan.weeksData.map(wk => (
            <div key={wk.week} style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#00e68a', fontWeight: 700, fontSize: 12 }}>Неделя {wk.week} · {wk.phase}{wk.deload ? ' · делод' : ''} · {wk.totalSets} сетов · {wk.sessions.reduce((a,s)=>a+s.exercises.reduce((x,e)=>x+e.workSets.reduce((q,w)=>q+w.weight*w.reps,0),0),0)/1000 |0}т тоннаж</span>
                <button onClick={() => {
                  const txt = wk.sessions.map(s=> `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e=> `  ${e.name} ${e.sets}x${e.reps} ${e.weight}кг RIR${e.rir} ${e.tempo} отдых${e.restSeconds}с${e.comment? ' // '+e.comment:''}`).join('\n')).join('\n\n');
                  navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n`+txt); setMsg(`Неделя ${wk.week} скопирована`);
                }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Копировать неделю</button>
              </div>
              {wk.sessions.map(sess => (
                <div key={sess.day} style={{ marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{sess.sessionTag} · {sess.character} · день {sess.day} · {sess.durationMin} мин</span>
                    <span style={{ color: '#fff', fontSize: 10, opacity: 0.5 }}>⏱ {sess.exercises.reduce((a,e)=>a+ e.workSets.length* (e.restSeconds||90) ,0)/60 |0} мин отдыха</span>
                  </div>
                  {sess.exercises.map(ex => (
                    <div key={ex.id} style={{ color: '#fff', fontSize: 11, marginLeft: 6, marginTop: 4, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{ex.name} — {ex.sets}×{ex.reps} @ {ex.weight}кг RIR{ex.rir} · {ex.tempo} · отдых {ex.restSeconds}с{ex.isCompetitionLift ? ' ★ соревн.' : ''}</span>
                        <input aria-label="вес" type="number" value={ex.weight} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { weight: Number(e.target.value)||0 })} style={{ width: 58, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="повторы" type="text" value={ex.reps} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { reps: e.target.value })} style={{ width: 54, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { rir: Number(e.target.value)||0 })} style={{ width: 44, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <button aria-label="вверх" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, -1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↑</button>
                        <button aria-label="вниз" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, 1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↓</button>
                      </div>
                      {ex.comment && <div style={{ fontSize: 10, opacity: 0.7, marginLeft: 4, borderLeft: '2px solid rgba(0,230,138,0.3)', paddingLeft: 6 }}>{ex.comment}</div>}
                      {ex.warmupSets && ex.warmupSets.length>0 && <div style={{ fontSize: 10, opacity: 0.5 }}>Разминка: {ex.warmupSets.map(s=> `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                      <div style={{ fontSize: 10, opacity: 0.45 }}>Сеты: {ex.workSets.map(s=> `${s.reps}×${s.weight}кг RIR${s.rir} ${s.pct?`(${s.pct}%)`:''}`).join(' | ')}</div>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                        {ex.workSets.map((s,si)=> (
                          <span key={si} style={{ display:'flex', gap:2, alignItems:'center', background:'rgba(255,255,255,0.04)', padding:'2px 4px', borderRadius:4, fontSize:9, color:'#fff' }}>
                            #{si+1}
                            <input aria-label={`вес сет ${si+1}`} type="number" value={s.weight} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{weight:Number(e.target.value)||0})} style={{width:44, padding:'1px 2px', fontSize:9, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)', borderRadius:3}} />
                            кг
                            <input aria-label={`повторы сет ${si+1}`} type="number" value={s.reps} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{reps:Number(e.target.value)||0})} style={{width:32, padding:'1px 2px', fontSize:9, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)', borderRadius:3}} />
                            ×
                            <input aria-label={`RIR сет ${si+1}`} type="number" value={s.rir} onChange={e=> updateSet(wk.week-1,sess.day,ex.id,si,{rir:Number(e.target.value)||0})} style={{width:28, padding:'1px 2px', fontSize:9, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)', borderRadius:3}} />
                            RIR
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {annual && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>Годовой план (изолирован): {annual.totalWeeks} нед · {annual.blocks.length} блоков</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {annual.blocks.map(b => <span key={b.id} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a', fontSize: 10 }}>Нед {b.startWeek}-{b.startWeek+b.weeks-1}: {b.mode} ×{b.weeks}{b.competitionDate?` 🏁${b.competitionDate}`:''}</span>)}
              </div>
              <div style={{ display: 'flex', height: 14, borderRadius: 6, overflow: 'hidden', marginTop: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                {annual.blocks.map(b=> {
                  const w = (b.weeks/annual.totalWeeks*100).toFixed(1);
                  const col = b.mode==='weightlifting'?'#00e68a': b.mode==='strongman'?'#f59e0b':'#3b82f6';
                  return <div key={b.id} title={`${b.mode} ${b.weeks}нед`} style={{ width: `${w}%`, background: col, opacity: 0.85, borderRight: '1px solid rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#000', fontWeight: 700 }}>{b.weeks}</div>;
                })}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}><span>Нед 1</span><span>Нед {annual.totalWeeks}</span></div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => { const txt = buildStrengthSportReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Копировать отчёт</button>
            <button onClick={() => { const html = buildStrengthPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } else { navigator.clipboard?.writeText(html); setMsg('HTML скопирован'); } }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>🖨 Печать (HTML)</button>
            <button onClick={() => { downloadStrengthCsv(plan); setMsg('CSV скачан'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>📊 CSV (Excel)</button>
            <button onClick={()=> { const d=shareStrengthDigest(plan); navigator.clipboard?.writeText(d); setMsg('Дайджест скопирован'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>📋 Дайджест</button>
            <button onClick={()=> { const url=buildStrengthTelegramUrl(plan); navigator.clipboard?.writeText(url); setMsg('Telegram ссылка скопирована'); try{ window.open(url,'_blank'); }catch{} }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,136,204,0.15)', color: '#2ca5e0', border: '1px solid rgba(0,136,204,0.3)', cursor: 'pointer' }}>✈ Telegram</button>
            <button onClick={exportToUserProgram} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.15)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>Экспорт в программу</button>
          </div>
          {msg && <div style={{ color: '#00e68a', fontSize: 11 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
};
