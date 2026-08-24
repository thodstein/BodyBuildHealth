/**
 * LiftMasterCard.tsx — ЕДИНЫЙ ИНСТРУМЕНТ НА ДВИЖЕНИЕ (универсальный: 9 лифтов).
 * Стекло rgba(24,24,27,0.42) border 0.07 blur12 radius14, белый #fff, заголовки-кнопки ▶/▼ для каждого блока,
 * подвкладки gradient активные, видео BlazePose всегда видно (в блоке VBT+видео), без sticky.
 * Актуальные описания — без "полный вариант как в ПЛ-авто".
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  LIMITER_CATEGORIES, limiterOptionsFor, analyzeLimiterOption,
  type LimiterOption, type LimiterCategory, type LimiterExerciseItem,
} from '../../../engines/pro/limiter-calculator.engine';
import { unifiedLiftDiagnosis, groupsForPhase } from '../../../engines/pro/unified-lift-diagnosis.engine';
import { diagnoseMovement, barPathIssuesForLift, phaseForReps, type BarPathIssue } from '../../../engines/pro/lift-diagnostics.engine';
import { analyzePhaseAssistance, analyzeStickingCorrections, analyzeBarPathAssistance, protocolFromCycle } from '../../../engines/pro/lift-assistance.engine';
import { WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { detectWeakMusclesByE1rm } from '../../../engines/pro/weak-muscle-detection.engine';
import { diagnoseVelocity } from '../../../engines/pro/vbt.engine';
import { getPLWeakGroupExerciseCandidates } from '../../../engines/lms/lms-builder.engine';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { applyToPlanner } from './planner-bridge';
import { VideoCaptureCard } from './VideoCaptureCard';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import MesoCorrectionCard from './MesoCorrectionCard';
import type { TrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const DIM = '#fff';

const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', borderRadius:14 } as any;
const CARD: React.CSSProperties = { ...GLASS, padding:12, marginTop:10 } as any;
const CARD_COLLAPSIBLE: React.CSSProperties = { ...GLASS, padding:0, overflow:'hidden', marginTop:10 } as any;
const btn: React.CSSProperties = { padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 32 };

const CATEGORY_COLOR: Record<LimiterCategory, { color: string; bg: string }> = {
  speed_strength: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  partial_amplitude: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  stabilization: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  contraction_mode: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  limiter_hypertrophy: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  anthropometry: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  start_specific: { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  grip_stiffness: { color: '#fb7185', bg: 'rgba(251,113,133,0.12)' },
  coordination: { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  endurance_profile: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  technique_geometry: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
};

const LIFT_RU: Record<Lift, string> = {
  bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга (классика)',
  ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной',
  sumo: 'Становая тяга (сумо)', biceps: 'Подъём на бицепс',
};
const PHASE_RU: Record<string, string> = {
  off_chest: 'Сход с груди', mid: 'Средняя точка', lockout: 'Дожим', start: 'Старт',
  bottom: 'Низ (выход из ямы)', sumo_start: 'Сумо: старт', sumo_lockout: 'Сумо: дожим',
  sumo_mid: 'Сумо: середина', ohp_start: 'Старт с плеч', ohp_mid: 'Середина', ohp_lockout: 'Дожим вверх',
  row_start: 'Старт (съём)', row_mid: 'Середина', row_squeeze: 'Сведение лопаток',
  pd_top: 'Верх (старт)', pd_mid: 'Середина', pd_squeeze: 'Сведение к груди',
  inc_off: 'Сход с груди (верх)', inc_mid: 'Середина', inc_lockout: 'Дожим',
  biceps_start: 'Старт', biceps_mid: 'Середина', biceps_top: 'Пик',
};
const ISSUE_RU: Record<BarPathIssue, string> = {
  forward_drift: 'Уход штанги вперёд',
  hips_shoot_up: 'Таз выстреливает вверх',
  good_morning: 'Good-morning присед',
  bar_loops: 'Петлеобразная траектория',
  asymmetric: 'Асимметрия сторон',
};

const WEAK_MUSCLE_DETAIL: Array<{ id: string; label: string; subs: Array<{ sub: string; label: string; patterns: string[]; nameRe?: RegExp }> }> = [
  { id: 'chest', label: 'Грудь', subs: [
    { sub: 'upper', label: 'Верх груди', patterns: ['incline_push'] },
    { sub: 'lower', label: 'Низ груди', patterns: ['dip_push', 'decline_push'] },
    { sub: 'mid', label: 'Середина (изоляция)', patterns: ['isolation_chest'] },
  ]},
  { id: 'back', label: 'Спина', subs: [
    { sub: 'width', label: 'Широчайшие (ширина)', patterns: ['vertical_pull'] },
    { sub: 'thickness', label: 'Толщина (ромбовидные)', patterns: ['horizontal_pull'] },
    { sub: 'lats', label: 'Изоляция широчайших', patterns: ['isolation_back'] },
    { sub: 'rear_delt', label: 'Задние дельты', patterns: ['isolation_shoulders'] },
  ]},
  { id: 'legs', label: 'Ноги', subs: [
    { sub: 'quads', label: 'Квадрицепсы', patterns: ['lunge', 'isolation_legs_quad'] },
    { sub: 'hams', label: 'Бицепс бедра', patterns: ['isolation_legs_ham', 'hinge'] },
    { sub: 'glutes', label: 'Ягодицы', patterns: ['glute_squat', 'hinge'] },
    { sub: 'calves', label: 'Икры', patterns: ['isolation_calves'] },
  ]},
  { id: 'shoulders', label: 'Плечи', subs: [
    { sub: 'front', label: 'Передние дельты', patterns: ['isolation_shoulders'], nameRe: /передн|фронтальные|фронт|жим стоя|армейск/i },
    { sub: 'side', label: 'Средние дельты', patterns: ['isolation_shoulders'], nameRe: /средн|в сторону|в стороны|махи|подбородку/i },
    { sub: 'rear', label: 'Задние дельты', patterns: ['isolation_shoulders'], nameRe: /задн|в наклоне|к лицу|разведен/i },
  ]},
  { id: 'arms', label: 'Руки', subs: [
    { sub: 'biceps', label: 'Бицепс', patterns: ['isolation_arms'], nameRe: /бицепс|сгибан|молот|скотт|брахи|curl/i },
    { sub: 'triceps', label: 'Трицепс', patterns: ['isolation_arms'], nameRe: /трицепс|разгибан|француз|узким хватом|tricep/i },
  ]},
  { id: 'core', label: 'Кор', subs: [
    { sub: 'abs', label: 'Пресс', patterns: ['core'] },
    { sub: 'obliques', label: 'Косые/антиротация', patterns: ['rotation', 'anti_rotation'] },
  ]},
];

const MASTER_KEY = 'he_lift_master_v1';

interface MasterState {
  lift: Lift;
  phase: WeakPoint | '';
  issues: BarPathIssue[];
  selectedGeom: Record<string, string[]>;
  daysGeom: Record<string, number[]>;
  selectedDiag: Record<string, string[]>;
  daysDiag: Record<string, number[]>;
  weakMuscleGroups: string[];
  weakMuscleSubs: string[];
  asymSide: 'left' | 'right' | null;
  vbtBest: string; vbtLast: string; vbtWeight: string;
}

function isRecord(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function cleanStringMap(raw: unknown): Record<string, string[]> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const names = list.filter((n): n is string => typeof n === 'string').slice(0, 40);
    if (names.length) out[k.slice(0,120)] = names;
  }
  return out;
}
function cleanDayMap(raw: unknown): Record<string, number[]> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number[]> = {};
  for (const [k, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const days = list.filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d>=1 && d<=7).slice(0,7);
    if (days.length) out[k.slice(0,120)] = days;
  }
  return out;
}
function loadMaster(): MasterState {
  try {
    const raw = JSON.parse(localStorage.getItem(MASTER_KEY) || 'null');
    if (!isRecord(raw)) throw new Error('bad');
    const allowedLifts = Object.keys(WEAK_POINTS_BY_LIFT) as Lift[];
    const lift: Lift = allowedLifts.includes(raw.lift as Lift) ? (raw.lift as Lift) : 'bench';
    const phases = (WEAK_POINTS_BY_LIFT[lift] ?? []) as string[];
    const phase = typeof raw.phase === 'string' && phases.includes(raw.phase) ? raw.phase as WeakPoint : '' as WeakPoint | '';
    const issues = Array.isArray(raw.issues) ? (raw.issues as BarPathIssue[]).filter(i => barPathIssuesForLift(lift).includes(i)) : [];
    return {
      lift, phase, issues,
      selectedGeom: cleanStringMap(raw.selectedGeom),
      daysGeom: cleanDayMap(raw.daysGeom),
      selectedDiag: cleanStringMap(raw.selectedDiag),
      daysDiag: cleanDayMap(raw.daysDiag),
      weakMuscleGroups: Array.isArray(raw.weakMuscleGroups) ? raw.weakMuscleGroups.filter((g: unknown): g is string => typeof g==='string' && WEAK_MUSCLE_DETAIL.some(d=>d.id===g)) : [],
      weakMuscleSubs: Array.isArray(raw.weakMuscleSubs) ? raw.weakMuscleSubs.filter((s: unknown) => typeof s==='string' && (s as string).includes('|')) as string[] : [],
      asymSide: raw.asymSide==='left'||raw.asymSide==='right'?raw.asymSide:null,
      vbtBest: typeof raw.vbtBest==='string'?raw.vbtBest.slice(0,20):'',
      vbtLast: typeof raw.vbtLast==='string'?raw.vbtLast.slice(0,20):'',
      vbtWeight: typeof raw.vbtWeight==='string'?raw.vbtWeight.slice(0,20):'',
    };
  } catch { return { lift:'bench', phase:'' as WeakPoint|'', issues:[], selectedGeom:{}, daysGeom:{}, selectedDiag:{}, daysDiag:{}, weakMuscleGroups:[], weakMuscleSubs:[], asymSide:null, vbtBest:'', vbtLast:'', vbtWeight:'' }; }
}
function saveMaster(s: MasterState) { try{ localStorage.setItem(MASTER_KEY, JSON.stringify(s)); }catch{} }

const protocolText = (p: { sets:number; reps:number; pct:number; rir:number; tempo?:string; rest?:string; holdSec?:number; note?:string }) => {
  const base = `${p.sets}×${p.reps} @${Math.round(p.pct*100)}% RIR ${p.rir}`;
  const extras = [p.holdSec?`удержание ${p.holdSec}с`:'', p.tempo?`темп ${p.tempo}`:'', p.rest?`отдых ${p.rest}`:''].filter(Boolean).join(' · ');
  return extras? `${base} · ${extras}`: base;
};

const ExerciseRow: React.FC<{ item: any; selected:boolean; onToggle:()=>void; onAdd:()=>void; tag?:string }> = ({ item, selected, onToggle, onAdd, tag }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 7px', marginTop:4, borderRadius:8, background: selected?'rgba(0,230,138,0.09)':'rgba(255,255,255,0.03)', border: selected?'1px solid rgba(0,230,138,0.28)':'1px solid rgba(255,255,255,0.07)' }}>
    <button onClick={onToggle} style={{ minWidth:24, height:24, borderRadius:6, cursor:'pointer', border:'none', background: selected?ACCENT:'rgba(255,255,255,0.10)', color:selected?'#000':'#fff', fontWeight:800, fontSize:12, flexShrink:0 }}>{selected?'✓':'＋'}</button>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#fff', lineHeight:1.3 }}>
        {item.optimal?'⭐ ':''}{item.exercise.name} <span style={{ color:ACCENT, fontWeight:800 }}>{protocolText(item.protocol)}</span>{tag ? <span style={{ fontSize:8, marginLeft:6, padding:'1px 5px', borderRadius:4, background:'rgba(56,189,248,0.14)', color:'#fff', fontWeight:700, border:'1px solid rgba(255,255,255,0.07)' }}>{tag}</span> : null}
      </div>
      <div style={{ fontSize:9, color:'#fff', lineHeight:1.35, marginTop:2, opacity:0.92 }}>{item.rationale}</div>
    </div>
    <button onClick={onAdd} style={{ ...btn, background:'rgba(0,230,138,0.14)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>➕</button>
  </div>
);

export const LiftMasterCard: React.FC<{
  dayCount?: number; template?: SRCycleTemplate | null; sessions?: any[];
  profile?: TrainingProfile;
  acwr?: number; monotony?: number;
  readinessRecovery?: number; readinessFatigue?: number;
  mesoWeeks?: number; missedSessions?: number;
  currentVolume?: number; currentRir?: number;
  exercises?: Array<{ name: string; e1rmBefore: number; e1rmAfter: number }>;
}> = ({ dayCount=7, template=null, sessions=[], profile, acwr, monotony, readinessRecovery=70, readinessFatigue=30, mesoWeeks=12, missedSessions=0, currentVolume=18, currentRir=2, exercises=[] }) => {
  const initial = useMemo(loadMaster, []);
  const [lift, setLift] = useState<Lift>(initial.lift);
  const [phase, setPhase] = useState<WeakPoint|''>(initial.phase);
  const [issues, setIssues] = useState<BarPathIssue[]>(initial.issues);
  const [selectedGeom, setSelectedGeom] = useState<Record<string,string[]>>(initial.selectedGeom);
  const [daysGeom, setDaysGeom] = useState<Record<string,number[]>>(initial.daysGeom);
  const [selectedDiag, setSelectedDiag] = useState<Record<string,string[]>>(initial.selectedDiag);
  const [daysDiag, setDaysDiag] = useState<Record<string,number[]>>(initial.daysDiag);
  const [weakMuscleGroups, setWeakMuscleGroups] = useState<string[]>(initial.weakMuscleGroups);
  const [weakMuscleSubs, setWeakMuscleSubs] = useState<string[]>(initial.weakMuscleSubs);
  const [asymSide, setAsymSide] = useState<'left'|'right'|null>(initial.asymSide);
  const [vbtBest, setVbtBest] = useState(initial.vbtBest);
  const [vbtLast, setVbtLast] = useState(initial.vbtLast);
  const [vbtWeight, setVbtWeight] = useState(initial.vbtWeight);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id:string) => setCollapsed(p=>({...p,[id]:!p[id]}));
  const [armSpanInput, setArmSpanInput] = useState('');
  const [shoulderInput, setShoulderInput] = useState('');
  useEffect(()=>{
    try{
      const raw = JSON.parse(localStorage.getItem('he_profile_v2')||'null');
      const personal = raw?.personal ?? raw?.settings?.personal ?? {};
      if (typeof personal.armSpanCm==='number') setArmSpanInput(String(personal.armSpanCm));
      if (typeof personal.shoulderWidthCm==='number') setShoulderInput(String(personal.shoulderWidthCm));
    }catch{}
  }, []);

  useEffect(()=>{ saveMaster({ lift, phase, issues, selectedGeom, daysGeom, selectedDiag, daysDiag, weakMuscleGroups, weakMuscleSubs, asymSide, vbtBest, vbtLast, vbtWeight }); }, [lift, phase, issues, selectedGeom, daysGeom, selectedDiag, daysDiag, weakMuscleGroups, weakMuscleSubs, asymSide, vbtBest, vbtLast, vbtWeight]);

  const diag = useMemo(()=> unifiedLiftDiagnosis({ lift, phase, barPathIssues: issues, vbtBest, vbtLast, vbtWeight, sessions, template }), [lift, phase, issues, vbtBest, vbtLast, vbtWeight, sessions, template]);
  const effectivePhase = diag.phases.effectivePhase;
  const movement = diag.phases.movement;

  const geomRawOptions = useMemo(()=> limiterOptionsFor('technique_geometry', lift), [lift]);
  const geomOptions = useMemo(()=> geomRawOptions.map(analyzeLimiterOption), [geomRawOptions]);
  const weakHints = useMemo(()=> detectWeakMusclesByE1rm(sessions), [sessions]);

  const phaseAnalysis = useMemo(()=> effectivePhase ? analyzePhaseAssistance(lift, effectivePhase as WeakPoint, template ?? undefined) : null, [lift, effectivePhase, template]);
  const stickingAnalysis = useMemo(()=> effectivePhase ? analyzeStickingCorrections(lift, effectivePhase as WeakPoint, template ?? undefined) : null, [lift, effectivePhase, template]);
  const barAnalyses = useMemo(()=> Object.fromEntries(issues.map(i=>[i, analyzeBarPathAssistance(lift, i, template ?? undefined)])), [issues, lift, template]);

  const diaryHint = useMemo(()=>{
    if (!sessions.length) return null;
    const counts: Record<string,number> = {};
    let totalHard=0;
    for (const w of sessions) for (const e of (w.exercises||[])) {
      const en = (e.exerciseName||e.exerciseId||'').toLowerCase();
      if (!en.includes('жим') && !en.includes('bench')) continue;
      for (const s of (e.sets||[])) {
        const weight = s.weightKg||s.weight||0, reps=s.reps||0;
        const rpe = (s.rpe&&s.rpe>0)?s.rpe:(s.rir!=null?10-s.rir:0);
        const isHard = rpe>=8 && weight>0 && reps>0;
        if (!isHard) continue;
        totalHard++;
        const cand = phaseForReps(reps, lift);
        if (cand) counts[cand]=(counts[cand]||0)+1;
      }
    }
    if (!totalHard || !Object.keys(counts).length) return null;
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return { phase: top[0] as WeakPoint, count: top[1], totalHard };
  }, [sessions, lift]);

  const anthroHint = useMemo(()=>{
    try {
      const raw = JSON.parse(localStorage.getItem('he_profile_v2') || 'null');
      const personal = raw?.personal ?? raw?.settings?.personal ?? {};
      const armSpan = personal?.armSpanCm;
      const height = personal?.height;
      if (typeof armSpan === 'number' && typeof height === 'number' && height>0) {
        const diff = Math.round(armSpan - height);
        if (diff > 5) return `🦴 Длинные руки (размах +${diff}см к росту) → уже хват (1.0×) + локти 30-45° tucked + трицепс/широчайшие.`;
        if (diff < -5) return `🦴 Короткие руки (размах ${diff}см) → шире хват (до 81см) + локти 60-70° flared + грудь-доминант.`;
      }
      if (typeof personal?.shoulderWidthCm === 'number') return `🦴 Ширина плеч ${personal.shoulderWidthCm}см — narrow = 1.0× биакром., wide = 1.5×.`;
      return null;
    } catch { return null; }
  }, []);

  const toggleWeakGroup = (g:string)=> setWeakMuscleGroups(cur=> cur.includes(g)?cur.filter(x=>x!==g):[...cur,g]);
  const toggleWeakSub = (k:string)=> setWeakMuscleSubs(cur=> cur.includes(k)?cur.filter(x=>x!==k):[...cur,k]);
  const toggleIssue = (iss:BarPathIssue)=> setIssues(cur=> cur.includes(iss)?cur.filter(x=>x!==iss):[...cur,iss]);
  const geomKey = (o:LimiterOption)=> `${o.lift}|${o.category}|${o.id}`;

  const toggleGeom = (o:LimiterOption, name:string)=>{
    const k=geomKey(o);
    setSelectedGeom(cur=>{ const s=new Set(cur[k]||[]); if(s.has(name)) s.delete(name); else s.add(name); return {...cur, [k]:[...s]}; });
  };
  const addGeom = (o:LimiterOption, names:string[])=>{
    if(!names.length) return;
    const k=geomKey(o);
    setSelectedGeom(cur=> ({...cur, [k]:[...new Set([...(cur[k]||[]), ...names])]}));
  };
  const toggleGeomDay = (o:LimiterOption, day:number)=>{
    const k=geomKey(o);
    setDaysGeom(cur=>{ const s=new Set(cur[k]||[]); if(s.has(day)) s.delete(day); else s.add(day); return {...cur, [k]:[...s].sort((a,b)=>a-b)}; });
  };
  const toggleDiag = (k:string, name:string)=> setSelectedDiag(cur=>{ const s=new Set(cur[k]||[]); if(s.has(name)) s.delete(name); else s.add(name); return {...cur, [k]:[...s]}; });
  const addDiag = (k:string, names:string[])=>{ if(!names.length) return; setSelectedDiag(cur=> ({...cur, [k]:[...new Set([...(cur[k]||[]), ...names])]})); };

  const applyAll = ()=>{
    const weakGroups = [...new Set([...weakMuscleSubs.map(k=>k.split('|')[0]), ...groupsForPhase(lift, effectivePhase as WeakPoint).filter(Boolean)])];
    const plWeakPoints = effectivePhase ? [{ lift, weakPoint: effectivePhase, days: daysDiag[`${lift}|${effectivePhase}`] ?? [] }] : [];
    const diagnosticExerciseMap: Record<string,string[]> = { ...selectedDiag };
    const hasWeak = weakGroups.length>0 || plWeakPoints.length>0 || Object.keys(diagnosticExerciseMap).length>0;
    if (hasWeak) {
      applyToPlanner({ kind:'weakpoints', label:`Мастер ${LIFT_RU[lift]}: слабые ${weakGroups.join(', ')||'—'} + фаза ${effectivePhase||'—'}`, data:{ groups: weakGroups, plWeakPoints, diagnosticExerciseMap, diagnosticDayMap: daysDiag, weakGroupExerciseMap: {}, weakGroupDayMap:{} } });
    }
    const limiterExerciseMap: Record<string,string[]> = { ...selectedGeom };
    const limiterProtocolMap: Record<string,{protocol:any; category:string}> = {};
    const limiterDayMap: Record<string,number[]> = { ...daysGeom };
    for (const cat of LIMITER_CATEGORIES) for (const o of limiterOptionsFor(cat.id, lift)) {
      const k=geomKey(o);
      if ((limiterExerciseMap[k]||[]).length) limiterProtocolMap[k]={ protocol:o.protocol, category:o.category };
    }
    const totalLim = Object.values(limiterExerciseMap).reduce((s,n)=>s+n.length,0);
    if (totalLim>0) {
      const geomCnt = Object.keys(limiterExerciseMap).filter(k=>k.includes('|technique_geometry|')).reduce((s,k)=>s+(limiterExerciseMap[k]?.length||0),0);
      const otherCnt = totalLim - geomCnt;
      applyToPlanner({ kind:'limiter', label:`Мастер ${LIFT_RU[lift]}: геометрия ${geomCnt} + лимитеры ${otherCnt} = ${totalLim} упр.`, data:{ limiterExerciseMap, limiterProtocolMap, limiterDayMap } });
    }
    if (!hasWeak && totalLim===0) {
      applyToPlanner({ kind:'limiter', label:`Мастер ${LIFT_RU[lift]}: просмотр (ничего не выбрано)`, data:{ limiterExerciseMap:{}, limiterProtocolMap:{}, limiterDayMap:{} } });
    }
  };

  const selectedGeomCount = Object.values(selectedGeom).reduce((s,n)=>s+n.length,0);
  const selectedDiagCount = Object.values(selectedDiag).reduce((s,n)=>s+n.length,0);
  const totalSelected = selectedGeomCount + selectedDiagCount + weakMuscleSubs.length;

  const muscleAnalyses = useMemo(()=>{
    if (!template) return {} as Record<string, any>;
    const out: Record<string, any> = {};
    for (const k of weakMuscleSubs) {
      const [group, subId]=k.split('|');
      const detail = WEAK_MUSCLE_DETAIL.find(d=>d.id===group);
      const sub = detail?.subs.find(s=>s.sub===subId);
      if (!detail||!sub) continue;
      const cands = getPLWeakGroupExerciseCandidates(template, group).filter(ex=> sub.patterns.includes(ex.movementPattern||'')).filter(ex=> !sub.nameRe || sub.nameRe.test(`${ex.name} ${ex.targetMuscle||''}`)).slice(0,5);
      out[k]={ items: cands.map((ex,idx)=>({ exercise:ex, targetGroup:group, optimal:idx===0, rationale:`Слабая мышца «${sub.label}» — ассистент из раскладки цикла`, protocol: protocolFromCycle(template, group), pattern: ex.movementPattern||'' }))};
    }
    return out;
  }, [template, weakMuscleSubs]);

  const HeaderBtn: React.FC<{ icon:string; title:string; count?:string; collapsed:boolean; onToggle:()=>void; accent:string }> = ({ icon, title, count, collapsed: isCol, onToggle, accent }) => (
    <button onClick={onToggle} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:'rgba(255,255,255,0.02)', border:'none', borderBottom: isCol ? 'none' : '1px solid rgba(255,255,255,0.07)', cursor:'pointer', color:'#fff', textAlign:'left' as any }}>
      <span style={{ fontSize:11, fontWeight:800, display:'flex', alignItems:'center', gap:7, color:'#fff' }}><span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:`${accent}18`, border:`1px solid ${accent}30`, fontSize:12, flexShrink:0 }}>{icon}</span> {title} {count ? <span style={{ fontSize:9, padding:'2px 6px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', fontWeight:700 }}>{count}</span> : null}</span>
      <span style={{ fontSize:11, width:26, height:26, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', background: isCol ? 'rgba(255,255,255,0.06)' : `${accent}18`, border:`1px solid ${isCol ? 'rgba(255,255,255,0.07)' : `${accent}30`}`, color: isCol ? '#fff' : accent, fontWeight:800, flexShrink:0 }}>{isCol ? '▶' : '▼'}</span>
    </button>
  );

  return (
    <div style={{ padding:12, color:'#fff', maxWidth:760, margin:'0 auto' }}>
      {/* hero */}
      <div style={{ ...GLASS, padding:'14px 14px 12px', position:'relative', overflow:'hidden', marginBottom:10 }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(0,230,138,0.07),rgba(96,165,250,0.06))', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(0,230,138,0.12),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16, flexShrink:0 }}>🏋️</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>{LIFT_RU[lift]} — единый инструмент</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.35, marginTop:2, opacity:0.92 }}>Диагностика движения: техника, углы, траектория, скорость и коррекция — всё по текущему движению.</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.10)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', fontWeight:800, whiteSpace:'nowrap' }}>9 движений</span>
        </div>
        <div style={{ position:'relative', fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 10px', lineHeight:1.5 }}>
          Нажми на заголовок блока — скрыть/раскрыть (▶/▼). Протокол упражнений — из цикла, скорость — из видео или ручного VBT. 8 блоков ниже полностью отрендерены, без лишнего sticky.
        </div>
      </div>

      <div style={{ ...CARD, padding:'7px 9px', borderRadius:14, fontSize:10, color:'#fff', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:10, fontWeight:800, color:'#fff' }}>📐 Геометрия:</span><span style={{ color:'#fff', opacity:0.92 }}>{diag.limiter.techniqueGeometry.length} парам. для {LIFT_RU[lift]}</span><span style={{ marginLeft:6, padding:'2px 7px', borderRadius:7, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', fontSize:9 }}>{diag.headerHint}</span>
      </div>

      {anthroHint && (
        <div style={{ ...CARD, padding:'8px 10px', fontSize:10, color:'#fff', lineHeight:1.5, background:'rgba(24,24,27,0.42)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ color:'#a78bfa' }}>{anthroHint}</span> <span style={{ color:'#fff', opacity:0.85 }}>(размах/плечи задаются ниже).</span>
        </div>
      )}

      {/* выбор движения — без sticky, gradient активные */}
      <div style={{ ...CARD, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginRight:2, letterSpacing:0.3 }}>ДВИЖЕНИЕ:</div>
        {(Object.keys(LIFT_RU) as Lift[]).map(l=>{ const on=lift===l; return <button key={l} onClick={()=>{ setLift(l); setPhase('' as WeakPoint|''); setIssues([]); }} style={{ minHeight:34, padding:'6px 11px', borderRadius:20, cursor:'pointer', border: on?'1px solid #00e68a':'1px solid rgba(255,255,255,0.07)', background: on?'linear-gradient(135deg,#00e68a,#00c853)': 'rgba(255,255,255,0.04)', color: on?'#000':'#fff', fontWeight:800, fontSize:10, transition:'all 0.15s' }}>{LIFT_RU[l]}{on?' ✓':''}</button>; })}
      </div>

      {/* антропометрия — стекло */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize:11, fontWeight:800, color:'#fff' }}>📏 Антропометрия (для геометрии)</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:3, lineHeight:1.45, opacity:0.9 }}>Размах рук и ширина плеч уточняют рекомендации по хвату и локтям. Сохраняется в профиль.</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
          <label style={{ fontSize:10, color:'#fff' }}>Размах (см): <input value={armSpanInput} onChange={e=>setArmSpanInput(e.target.value)} placeholder="180" style={{ width:74, marginLeft:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', borderRadius:8, padding:'5px 7px', fontSize:11 }} /></label>
          <label style={{ fontSize:10, color:'#fff' }}>Плечи (см): <input value={shoulderInput} onChange={e=>setShoulderInput(e.target.value)} placeholder="42" style={{ width:64, marginLeft:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', borderRadius:8, padding:'5px 7px', fontSize:11 }} /></label>
          <button onClick={()=>{
            try{
              const raw = JSON.parse(localStorage.getItem('he_profile_v2')||'{}');
              const personal = raw.personal ?? raw.settings?.personal ?? {};
              const ns = parseFloat(armSpanInput); if(Number.isFinite(ns)&&ns>0) personal.armSpanCm=ns;
              const sh = parseFloat(shoulderInput); if(Number.isFinite(sh)&&sh>0) personal.shoulderWidthCm=sh;
              if(raw.personal) raw.personal=personal; else if(raw.settings?.personal) raw.settings.personal=personal; else raw.personal=personal;
              localStorage.setItem('he_profile_v2', JSON.stringify(raw));
              setArmSpanInput(''); setShoulderInput('');
              location.reload();
            }catch{}
          }} style={{ ...btn, background:'linear-gradient(135deg,#a78bfa,#7c3aed)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)' }}>💾 Сохранить</button>
        </div>
      </div>

      {/* ── 1. Слабые мышцы + BB-грануляр ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="💪" title="1 · Слабые мышцы · BB-грануляр (головки)" collapsed={!!collapsed['sec-1-bb']} onToggle={()=>toggleCollapse('sec-1-bb')} accent="#4ade80" />
        {!collapsed['sec-1-bb'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>Отметь слабую мышцу — получи 5 ассистентов из раскладки цикла. Ниже — 12 гранулярных BB-изолятов по головкам (ключичная/середина/низ груди, 3 дельты, 3 трицепса, 3 бицепса).</div>
          <div style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:7 }}>💎 BB-грануляр — 12 изолятов по головкам</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {[
                {id:'bb_cable_upper', label:'Верх груди (ключичная)'}, {id:'bb_cable_mid', label:'Середина груди'}, {id:'bb_cable_lower', label:'Низ груди'},
                {id:'bb_lateral_mid', label:'Средняя дельта'}, {id:'bb_rear_cable', label:'Задняя дельта'}, {id:'bb_front_raise', label:'Передняя дельта'},
                {id:'bb_triceps_long', label:'Трицепс длинная'}, {id:'bb_triceps_lateral', label:'Трицепс латер.'}, {id:'bb_triceps_medial', label:'Трицепс медиал.'},
                {id:'bb_biceps_long', label:'Бицепс длинная'}, {id:'bb_biceps_short', label:'Бицепс короткая'}, {id:'bb_brachialis', label:'Брахиалис'},
              ].map(g=>{
                const k = `bb|${g.id}`; const on = selectedDiag[k]?.length>0;
                return <button key={g.id} onClick={()=>{
                  const m: Record<string,string> = { bb_cable_upper:'Сведение в кроссовере с верхнего блока (верх груди)', bb_cable_mid:'Сведение в кроссовере (середина груди)', bb_cable_lower:'Сведение в кроссовере с нижнего блока (низ груди)', bb_lateral_mid:'Махи в стороны с задержкой (средняя дельта)', bb_rear_cable:'Отведение на заднюю дельту в кроссовере', bb_front_raise:'Подъём гантелей перед собой (передняя дельта)', bb_triceps_long:'Французский жим с гантелью над головой (длинная головка трицепса)', bb_triceps_lateral:'Разгибание с канатной рукоятью (латеральная головка)', bb_triceps_medial:'Разгибание обратным хватом (медиальная головка)', bb_biceps_long:'Подъём гантели на наклонной (длинная головка бицепса)', bb_biceps_short:'Подъём на скамье Скотта (короткая головка бицепса)', bb_brachialis:'Молот с канатной рукоятью (брахиалис)' };
                  const name = m[g.id] ?? g.id;
                  if (on) setSelectedDiag(cur=>{ const n={...cur}; delete n[k]; return n; });
                  else addDiag(k, [name]);
                }} style={{ padding:'5px 9px', borderRadius:20, cursor:'pointer', fontSize:9, fontWeight:700, border: on?'1px solid #ec4899':'1px solid rgba(255,255,255,0.07)', background: on?'linear-gradient(135deg,#ec4899,#be185d)':'rgba(255,255,255,0.04)', color:'#fff' }}>{g.label}{on?' ✓':''}</button>;
              })}
            </div>
            <div style={{ fontSize:9, color:'#fff', marginTop:7, lineHeight:1.4, opacity:0.75 }}>Клик — добавить/убрать изолят. Протокол гипертрофии: 3×10 @65% RIR 2, дни — Авто.</div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
            {WEAK_MUSCLE_DETAIL.map(d=>{ const on=weakMuscleGroups.includes(d.id); return <button key={d.id} onClick={()=>toggleWeakGroup(d.id)} style={{ minHeight:34, padding:'6px 12px', borderRadius:20, cursor:'pointer', border: on?'1px solid #4ade80':'1px solid rgba(255,255,255,0.07)', background: on?'linear-gradient(135deg,#4ade80,#16a34a)':'rgba(255,255,255,0.04)', color:on?'#000':'#fff', fontWeight:800, fontSize:10 }}>{d.label}{on?' ✓':''}</button>; })}
          </div>
          {weakHints.length>0 && (
            <div style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:6 }}>📊 Дневник: e1RM-тренд (28д) — подсказка</div>
              {weakHints.map(s=> (
                <div key={s.group} style={{ display:'flex', gap:6, alignItems:'center', marginTop:4, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color:'#fff' }}>{s.status==='weak'?'📉':'🟡'} {s.label}: {s.currentE1rm}{s.priorE1rm>0?` кг (было ${s.priorE1rm}, ${s.deltaPct>0?'+':''}${s.deltaPct}%)`:' кг'} · {s.sessions} сесс.</span>
                  <button onClick={()=>{ if(!weakMuscleGroups.includes(s.group)) toggleWeakGroup(s.group); }} style={{ padding:'3px 9px', borderRadius:7, cursor:'pointer', fontSize:9, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(245,158,11,0.18)', color:'#fff', fontWeight:700, minHeight:28 }}>➕ в слабые</button>
                </div>
              ))}
            </div>
          )}
          {!template && <div style={{ marginTop:8, fontSize:10, color:'#fff', opacity:0.7 }}>Выбери цикл в ПЛ-авто — ассистенты подберутся по его раскладке.</div>}
          {weakMuscleGroups.map(group=>{
            const detail=WEAK_MUSCLE_DETAIL.find(d=>d.id===group); if(!detail) return null;
            return (
              <div key={group} style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(74,222,128,0.05)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:6 }}>{detail.label} — выбери подгруппу:</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {detail.subs.map(s=>{ const k=`${group}|${s.sub}`; const on=weakMuscleSubs.includes(k); return <button key={s.sub} onClick={()=>toggleWeakSub(k)} style={{ minHeight:30, padding:'5px 10px', borderRadius:20, cursor:'pointer', fontSize:9, border: on?'1px solid #4ade80':'1px solid rgba(255,255,255,0.07)', background: on?'linear-gradient(135deg,#4ade80,#22c55e)':'rgba(255,255,255,0.04)', color: on?'#000':'#fff', fontWeight:700 }}>{s.label}{on?' ✓':''}</button>; })}
                </div>
                {detail.subs.filter(s=>weakMuscleSubs.includes(`${group}|${s.sub}`)).map(s=>{
                  const k=`${group}|${s.sub}`; const an=muscleAnalyses[k]; if(!an||!an.items.length) return null;
                  return (
                    <div key={k} style={{ marginTop:9, padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:5 }}>🏋️ {s.label} — ассистенты (отметь):</div>
                      {an.items.map((it:any,idx:number)=> <ExerciseRow key={idx} item={it} selected={!!selectedDiag[k]?.includes(it.exercise.name)} onToggle={()=>toggleDiag(k,it.exercise.name)} onAdd={()=>addDiag(k,[it.exercise.name])} />)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>}
      </div>

      {/* ── 2. Слабые точки ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="🎯" title="2 · Слабые точки (фаза срыва)" collapsed={!!collapsed['sec-2-weak']} onToggle={()=>toggleCollapse('sec-2-weak')} accent="#a855f7" />
        {!collapsed['sec-2-weak'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>Фаза, где теряется скорость и штанга «застревает». Выбери чип — увидишь причину и упражнения из цикла.</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
            {(WEAK_POINTS_BY_LIFT[lift]??[]).map(p=>{ const on=effectivePhase===p; return <button key={p} onClick={()=>setPhase(p as WeakPoint)} style={{ minHeight:34, padding:'6px 12px', borderRadius:20, cursor:'pointer', border: on?'1px solid #a855f7':'1px solid rgba(255,255,255,0.07)', background: on?'linear-gradient(135deg,#a855f7,#7c3aed)':'rgba(255,255,255,0.04)', color:'#fff', fontWeight:800, fontSize:10 }}>{PHASE_RU[p]||p}{on?' ✓':''}</button>; })}
          </div>
          {diaryHint && (
            <div style={{ marginTop:10, padding:'8px 10px', borderRadius:10, background:'rgba(251,191,36,0.07)', border:'1px solid rgba(255,255,255,0.07)', fontSize:10, color:'#fff', lineHeight:1.5 }}>
              📊 Дневник: {diaryHint.count} из {diaryHint.totalHard} тяжёлых подходов — фаза «{PHASE_RU[diaryHint.phase]||diaryHint.phase}».
            </div>
          )}
          {movement && (
            <div style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontWeight:800, color:'#fff', fontSize:11 }}>⚠ {movement.weakPoint.label}</div>
              <div style={{ fontSize:10, color:'#fff', marginTop:3, lineHeight:1.5, opacity:0.9 }}>{movement.weakPoint.description}</div>
              {phaseAnalysis && phaseAnalysis.items.length>0 && (
                <div style={{ marginTop:9 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:5 }}>🏋️ Упражнения фазы — из цикла:</div>
                  {phaseAnalysis.items.map((it:any,idx:number)=> <ExerciseRow key={idx} item={it} selected={!!selectedDiag[`${lift}|${effectivePhase}`]?.includes(it.exercise.name)} onToggle={()=>toggleDiag(`${lift}|${effectivePhase}`, it.exercise.name)} onAdd={()=>addDiag(`${lift}|${effectivePhase}`, [it.exercise.name])} />)}
                  <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                    <button onClick={()=>addDiag(`${lift}|${effectivePhase}`, phaseAnalysis.items.filter((i:any)=>i.optimal).map((i:any)=>i.exercise.name))} style={{ ...btn, background:'linear-gradient(135deg,#a855f7,#7c3aed)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)' }}>➕ Рекомендуемые</button>
                    <button onClick={()=>addDiag(`${lift}|${effectivePhase}`, phaseAnalysis.items.map((i:any)=>i.exercise.name))} style={{ ...btn, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)' }}>➕ Все</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>}
      </div>

      {/* ── 3. Мёртвые точки ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="🧱" title={`3 · Мёртвые точки (углы)${effectivePhase ? ' · '+(PHASE_RU[effectivePhase]||effectivePhase) : ''}`} collapsed={!!collapsed['sec-3-stick']} onToggle={()=>toggleCollapse('sec-3-stick')} accent="#60a5fa" />
        {!collapsed['sec-3-stick'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>Углы суставов и биомеханика фазы: где момент максимален и какие мышцы лимитируют.</div>
          {movement?.sticking ? (
            <div style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(255,255,255,0.07)', fontSize:10, color:'#fff', lineHeight:1.6 }}>
              <div>📐 Угол: <b style={{color:'#fff'}}>{movement.sticking.angleRangeDeg[0]}°–{movement.sticking.angleRangeDeg[1]}°</b> · сустав: {movement.sticking.keyJoint}</div>
              <div style={{ marginTop:3, opacity:0.92 }}>🧠 {movement.sticking.biomechanicalReason}</div>
              <div style={{ marginTop:3 }}>💪 Слабые мышцы: {movement.sticking.weakMuscles.join(', ')}</div>
              <div style={{ color:'#fbbf24', marginTop:4 }}>Коррекции: {movement.sticking.corrections.join(' · ')}</div>
              <div style={{ color:'#fff', marginTop:4, opacity:0.92 }}>💡 Cue: {movement.sticking.loadCues}</div>
            </div>
          ) : <div style={{ marginTop:10, fontSize:10, color:'#fff', opacity:0.7, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>Выбери фазу в блоке 2 — здесь появятся углы и мышцы-лимитеры.</div>}
          {stickingAnalysis && stickingAnalysis.items.length>0 && (
            <div style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:5 }}>🏋️ Коррекции мёртвой точки:</div>
              {stickingAnalysis.items.map((it:any,idx:number)=> <ExerciseRow key={idx} item={it} selected={!!selectedDiag[`${lift}|sticking|${effectivePhase}`]?.includes(it.exercise.name)} onToggle={()=>toggleDiag(`${lift}|sticking|${effectivePhase}`, it.exercise.name)} onAdd={()=>addDiag(`${lift}|sticking|${effectivePhase}`, [it.exercise.name])} />)}
            </div>
          )}
        </div>}
      </div>

      {/* ── 4. Движение штанги ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="📈" title="4 · Движение штанги (bar-path)" collapsed={!!collapsed['sec-4-bar']} onToggle={()=>toggleCollapse('sec-4-bar')} accent="#f59e0b" />
        {!collapsed['sec-4-bar'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>Отклонения траектории: уход вперёд, таз, good-morning, петля, асимметрия. Отметь — получи причину и упражнения-коррекции.</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
            {barPathIssuesForLift(lift).map(iss=>{ const on=issues.includes(iss); return <button key={iss} onClick={()=>toggleIssue(iss)} style={{ minHeight:34, padding:'6px 11px', borderRadius:20, cursor:'pointer', border: on?'1px solid #f59e0b':'1px solid rgba(255,255,255,0.07)', background: on?'linear-gradient(135deg,#f59e0b,#d97706)':'rgba(255,255,255,0.04)', color:'#fff', fontSize:10, fontWeight:700 }}>{ISSUE_RU[iss]}{on?' ✓':''}</button>; })}
          </div>
          {issues.includes('asymmetric' as BarPathIssue) && (
            <div style={{ marginTop:10, padding:8, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize:10, color:'#fff', marginBottom:6, fontWeight:700 }}>⚖️ Какая сторона слабее?</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['left','right'] as const).map(side=>{ const on=asymSide===side; return <button key={side} onClick={()=>setAsymSide(cur=> cur===side?null:side)} style={{ minHeight:32, padding:'5px 13px', borderRadius:20, cursor:'pointer', border: on?'1px solid #f59e0b':'1px solid rgba(255,255,255,0.07)', background: on?'linear-gradient(135deg,#f59e0b,#d97706)':'rgba(255,255,255,0.04)', color:'#fff', fontSize:10, fontWeight:700 }}>{side==='left'?'Левая':'Правая'}{on?' ✓':''}</button>; })}
              </div>
              {asymSide && <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>Слабее: <b>{asymSide==='left'?'левая':'правая'}</b> сторона → унилатеральная работа в плане.</div>}
            </div>
          )}
          {diag.barPath.analysis && diag.barPath.analysis.diagnoses.map((d:any)=>(
            <div key={d.issue} style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', fontSize:10 }}>
              <div style={{ fontWeight:800, color:'#fff' }}>{(ISSUE_RU as Record<string,string>)[d.issue]}{d.relatedPhase?` · фаза ${String(d.relatedPhase)}`:''}</div>
              <div style={{ color:'#fff', marginTop:4, lineHeight:1.5, opacity:0.92 }}>{d.cause} <span style={{ color:ACCENT }}>→ {d.correction}</span></div>
              <div style={{ marginTop:6 }}>
                {(barAnalyses[d.issue]?.items ?? []).map((it:any,idx:number)=> <ExerciseRow key={idx} item={it} selected={!!selectedDiag[`${lift}|barpath|${d.issue}`]?.includes(it.exercise.name)} onToggle={()=>toggleDiag(`${lift}|barpath|${d.issue}`, it.exercise.name)} onAdd={()=>addDiag(`${lift}|barpath|${d.issue}`, [it.exercise.name])} />)}
              </div>
            </div>
          ))}
        </div>}
      </div>

      {/* ── 5. Геометрия техники ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="📐" title={`5 · Геометрия техники — ${geomRawOptions.length} парам. для ${LIFT_RU[lift]}`} collapsed={!!collapsed['sec-5-geom']} onToggle={()=>toggleCollapse('sec-5-geom')} accent="#38bdf8" />
        {!collapsed['sec-5-geom'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>{lift==='bench'?'Хват, локти, мост, ноги, кисть, касание — то, что на бумаге «по плану», а на помосте не едет.':'Постановка, хват, трекинг и брейсинг для выбранного движения — та же логика, что для жима, но под его механику.'} Каждая — метод + протокол + упражнения.</div>
          {geomRawOptions.map(opt=>{
            const an = analyzeLimiterOption(opt);
            const k=geomKey(opt); const col=CATEGORY_COLOR[opt.category];
            return (
              <div key={opt.id} style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#fff' }}>{opt.label}</div>
                <div style={{ fontSize:9, color:'#fff', marginTop:3, lineHeight:1.45, opacity:0.85 }}>{opt.description}</div>
                <div style={{ fontSize:9, color:'#fff', marginTop:4, lineHeight:1.4, opacity:0.92 }}>📋 {opt.method}</div>
                <div style={{ fontSize:9, color:'#fff', marginTop:3, lineHeight:1.4, opacity:0.9 }}>🧠 {opt.rationale}</div>
                {an.items.map((it,idx)=> <ExerciseRow key={idx} item={it} selected={!!selectedGeom[k]?.includes(it.exercise.name)} onToggle={()=>toggleGeom(opt,it.exercise.name)} onAdd={()=>addGeom(opt,[it.exercise.name])} tag={`📐 ${opt.label.split(' ')[0]}`} />)}
                <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                  <button onClick={()=>addGeom(opt, an.items.filter(i=>i.optimal).map(i=>i.exercise.name))} style={{ ...btn, background:'linear-gradient(135deg,#38bdf8,#0ea5e9)', color:'#000', border:'1px solid rgba(255,255,255,0.07)' }}>➕ Рекомендуемое</button>
                  <button onClick={()=>addGeom(opt, an.items.map(i=>i.exercise.name))} style={{ ...btn, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)' }}>➕ Все</button>
                  <span style={{ fontSize:9, color:'#fff', opacity:0.7 }}>Дни:</span>
                  <button onClick={()=>{ setDaysGeom(cur=>{ const n={...cur}; delete n[k]; return n; }); }} style={{ padding:'4px 8px', borderRadius:20, cursor:'pointer', fontSize:9, border: !daysGeom[k]?.length?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.07)', background: !daysGeom[k]?.length?'linear-gradient(135deg,#38bdf8,#0ea5e9)':'rgba(255,255,255,0.04)', color: !daysGeom[k]?.length?'#000':'#fff', fontWeight:700 }}>Авто</button>
                  {Array.from({length:Math.max(1,dayCount)},(_,i)=>i+1).map(d=> <button key={d} onClick={()=>toggleGeomDay(opt,d)} style={{ padding:'4px 8px', borderRadius:20, cursor:'pointer', fontSize:9, border: daysGeom[k]?.includes(d)?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.07)', background: daysGeom[k]?.includes(d)?'linear-gradient(135deg,#38bdf8,#0ea5e9)':'rgba(255,255,255,0.04)', color: daysGeom[k]?.includes(d)?'#000':'#fff', fontWeight:700 }}>Д{d}</button>)}
                </div>
              </div>
            );
          })}
        </div>}
      </div>

      {/* ── 6. VBT + видео ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="⚡" title="6 · VBT + видео (BlazePose) — скорость штанги" collapsed={!!collapsed['sec-6-vbt']} onToggle={()=>toggleCollapse('sec-6-vbt')} accent="#f472b6" />
        {!collapsed['sec-6-vbt'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>Лучший vs последний повтор → потеря скорости → зона → вероятная фаза срыва. Видео — или скорость вручную, или из BlazePose.</div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginTop:10, alignItems:'center' }}>
            <label style={{ fontSize:10, color:'#fff' }}>Лучший (м/с): <input type="number" step="0.01" min="0" value={vbtBest} onChange={e=>setVbtBest(e.target.value)} placeholder="0.60" style={{ width:74, marginLeft:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', borderRadius:8, padding:'5px 7px', fontSize:11 }} /></label>
            <label style={{ fontSize:10, color:'#fff' }}>Последний (м/с): <input type="number" step="0.01" min="0" value={vbtLast} onChange={e=>setVbtLast(e.target.value)} placeholder="0.40" style={{ width:74, marginLeft:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', borderRadius:8, padding:'5px 7px', fontSize:11 }} /></label>
            <label style={{ fontSize:10, color:'#fff' }}>Вес (кг): <input type="number" step="0.5" min="0" value={vbtWeight} onChange={e=>setVbtWeight(e.target.value)} placeholder="100" style={{ width:68, marginLeft:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', borderRadius:8, padding:'5px 7px', fontSize:11 }} /></label>
          </div>
          {(()=>{
            const best=parseFloat(vbtBest), last=parseFloat(vbtLast);
            if (!Number.isFinite(best)||!Number.isFinite(last)||best<=0||last<=0||last>best) return <div style={{ marginTop:8, fontSize:10, color:'#fff', opacity:0.75, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>Введи скорости (последний ≤ лучшего) — или сними видео ниже, скорость подставится автоматически.</div>;
            const weight=parseFloat(vbtWeight);
            const d=diagnoseVelocity(lift, best, last, Number.isFinite(weight)&&weight>0?weight:undefined);
            const vbtPhase=(d.suggestedPhase ?? effectivePhase) as WeakPoint|null;
            const vbtSticking = vbtPhase ? analyzeStickingCorrections(lift, vbtPhase, template ?? undefined) : null;
            const vbtKey=`${lift}|vbt|${vbtPhase??'none'}`;
            return (
              <div style={{ marginTop:10, padding:9, borderRadius:10, background: d.exceeded?'rgba(239,68,68,0.07)':'rgba(244,114,182,0.06)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize:10, color:'#fff', fontWeight:800 }}>Потеря скорости: {d.lossPct}% · {d.zone}</div>
                {d.e1RMByVelocity!=null && <div style={{ fontSize:10, color:'#fff', marginTop:3, opacity:0.9 }}>e1RM по скорости: {d.e1RMByVelocity} кг</div>}
                {d.exceeded && d.suggestedPhase && <div style={{ marginTop:5, fontSize:10, color:'#fbbf24' }}>⚠ Отказ близко — фаза «{PHASE_RU[d.suggestedPhase]||d.suggestedPhase}» (макс. момент).</div>}
                {vbtSticking && vbtSticking.items.length>0 && (
                  <div style={{ marginTop:7 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:4 }}>🏋️ Коррекции фазы «{PHASE_RU[vbtPhase!]||vbtPhase}»:</div>
                    {vbtSticking.items.map((it:any,idx:number)=> <ExerciseRow key={idx} item={it} selected={!!selectedDiag[vbtKey]?.includes(it.exercise.name)} onToggle={()=>toggleDiag(vbtKey,it.exercise.name)} onAdd={()=>addDiag(vbtKey,[it.exercise.name])} />)}
                  </div>
                )}
              </div>
            );
          })()}
          <div style={{ marginTop:10 }}>
            <VideoCaptureCard lift={lift} onResult={r=>{
              if (r.barVelocity!=null) {
                const v = r.barVelocity;
                setVbtBest((v+0.15).toFixed(2));
                setVbtLast(v.toFixed(2));
              }
            }} />
          </div>
        </div>}
      </div>

      {/* ── 7. Срывы ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="💥" title="7 · Срывы (из дневника, RPE≥8)" collapsed={!!collapsed['sec-7-sryv']} onToggle={()=>toggleCollapse('sec-7-sryv')} accent="#ef4444" />
        {!collapsed['sec-7-sryv'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>срывы — авто-детект тяжёлых подходов по дневнику (phaseForReps, ≥6 повт. — без фазы). Ручной ввод — вкладка «Вручную» внутри.</div>
          <div style={{ marginTop:8 }}>
            <StickingPointAnalysisCard sessions={sessions} />
          </div>
        </div>}
      </div>

      {/* ── 8. RIR-калибровка ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="🎚️" title="8 · RIR-калибровка (bias из дневника)" collapsed={!!collapsed['sec-8-rir']} onToggle={()=>toggleCollapse('sec-8-rir')} accent="#60a5fa" />
        {!collapsed['sec-8-rir'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>Насколько ты переоцениваешь/недооцениваешь запас повторов. Подвкладки — «Вручную» / «Из дневника» с gradient активными.</div>
          <div style={{ marginTop:8 }}>
            <RIRCalibrationCard />
          </div>
        </div>}
      </div>

      {/* ── 9. Коррекция мезоцикла ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="🔄" title="9 · Коррекция мезоцикла (объём / RIR / делоад)" collapsed={!!collapsed['sec-9-meso']} onToggle={()=>toggleCollapse('sec-9-meso')} accent="#a78bfa" />
        {!collapsed['sec-9-meso'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>ACWR, монотонность, готовность и дневник — рекомендуемые объём, RIR и частота делоада. Одной кнопкой в планировщик.</div>
          {profile ? (
            <div style={{ marginTop:8 }}>
            <MesoCorrectionCard
              profile={profile}
              acwr={acwr ?? 1}
              monotony={monotony ?? 1}
              avgReadiness={readinessRecovery}
              mesoWeeks={mesoWeeks}
              missedSessions={missedSessions}
              exercises={exercises}
              currentVolume={currentVolume}
              currentRir={currentRir}
            />
            </div>
          ) : <div style={{ marginTop:8, fontSize:10, color:'#fff', opacity:0.7, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>Профиль не загружен — блок доступен после выбора плана.</div>}
        </div>}
      </div>

      {/* ── 10. Остальные лимитирующие ── */}
      <div style={CARD_COLLAPSIBLE}>
        <HeaderBtn icon="🧩" title={`10 · Остальные лимитирующие факторы — для ${LIFT_RU[lift]}`} collapsed={!!collapsed['sec-10-lim']} onToggle={()=>toggleCollapse('sec-10-lim')} accent="#a78bfa" />
        {!collapsed['sec-10-lim'] && <div style={{ padding:12 }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5, opacity:0.92 }}>Дополнительно к геометрии (блок 5) — ещё 10 категорий лимитеров (скорость-силы, амплитуда, стабилизация, режимы сокращения, антропометрия и др.). Выбор по текущему движению, протокол из цикла, добавление одним кликом ниже.</div>
          {LIMITER_CATEGORIES.filter(c=>c.id!=='technique_geometry').map(cat=>{
            const opts = limiterOptionsFor(cat.id, lift);
            if (opts.length===0) return null;
            const col = CATEGORY_COLOR[cat.id];
            return (
              <div key={cat.id} style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#fff' }}>{cat.icon} {cat.label} · {opts.length} парам.</div>
                <div style={{ fontSize:9, color:'#fff', marginTop:3, lineHeight:1.4, opacity:0.75 }}>{cat.description}</div>
                {opts.map(opt=>{
                  const k=geomKey(opt); const an=analyzeLimiterOption(opt);
                  return (
                    <div key={opt.id} style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#fff' }}>{opt.label}</div>
                      <div style={{ fontSize:9, color:'#fff', marginTop:3, lineHeight:1.4, opacity:0.75 }}>{opt.description}</div>
                      <div style={{ fontSize:9, color:'#fff', marginTop:3, lineHeight:1.4, opacity:0.9 }}>📋 {opt.method}</div>
                      {an.items.map((it,idx)=> <ExerciseRow key={idx} item={it} selected={!!selectedGeom[k]?.includes(it.exercise.name)} onToggle={()=>toggleGeom(opt,it.exercise.name)} onAdd={()=>addGeom(opt,[it.exercise.name])} tag={cat.icon} />)}
                      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                        <button onClick={()=>addGeom(opt, an.items.filter(i=>i.optimal).map(i=>i.exercise.name))} style={{ ...btn, background: `${col.bg}`, color:'#fff', border:'1px solid rgba(255,255,255,0.07)' }}>➕ Рекомендуемое</button>
                        <button onClick={()=>addGeom(opt, an.items.map(i=>i.exercise.name))} style={{ ...btn, background:'rgba(255,255,255,0.05)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)' }}>➕ Все</button>
                        <span style={{ fontSize:9, color:'#fff', opacity:0.7 }}>Дни:</span>
                        <button onClick={()=>{ setDaysGeom(cur=>{ const n={...cur}; delete n[k]; return n; }); }} style={{ padding:'4px 8px', borderRadius:20, cursor:'pointer', fontSize:9, border: !daysGeom[k]?.length?`1px solid ${col.color}`:'1px solid rgba(255,255,255,0.07)', background: !daysGeom[k]?.length?col.bg:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700 }}>Авто</button>
                        {Array.from({length:Math.max(1,dayCount)},(_,i)=>i+1).map(d=> <button key={d} onClick={()=>toggleGeomDay(opt,d)} style={{ padding:'4px 8px', borderRadius:20, cursor:'pointer', fontSize:9, border: daysGeom[k]?.includes(d)?`1px solid ${col.color}`:'1px solid rgba(255,255,255,0.07)', background: daysGeom[k]?.includes(d)?col.bg:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700 }}>Д{d}</button>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>}
      </div>

      {/* ── Footer ── */}
      <button onClick={applyAll} style={{ width:'100%', minHeight:44, marginTop:12, border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12 }}>
        🛠 Добавить в ПЛ-авто — геометрия {selectedGeomCount} + диагностика {selectedDiagCount} + слабые {weakMuscleSubs.length} (всего {totalSelected})
      </button>
      <div style={{ marginTop:8, padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', fontSize:10, lineHeight:1.5, opacity:0.92 }}>
        Правило: упражнения цикла не меняются — добавляются только ассистенты. Геометрия — протокол категории, остальная диагностика — протокол из раскладки цикла.
      </div>
    </div>
  );
};

export default LiftMasterCard;
