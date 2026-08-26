/**
 * UnifiedIntelligenceHub.tsx — единый инструмент «Интеллект тренировки».
 * Объединяет 4 ранее разрозненных блока без дублей:
 *  Нагрузка (sRPE/ACWR/Banister/monotony) → Восстановление (сон/HRV/Readiness/shouldTrain/deload) →
 *  Авторегуляция (PRI + pro-autoReg + RPE→вес + RIR-калибрация) → Прогноз (Хольт + what-if).
 *
 * Принципы:
 *  - один входной снапшот (readiness/fatigue/HRV/сон/стресс/DOMS/lastRPE/VLoss) → все движки читают его,
 *    ACWR считается один раз из единого sRPE-хранилища;
 *  - без дублей: ACWR/monotony/strain/Banister — только в «Нагрузке», readiness/recovery — только в
 *    «Восстановлении», PRI/вес/RIR — только в «Авторегуляции», Хольт/what-if — только в «Прогнозе»,
 *    сводные бейджи в шапке — линки, а не повторы формул;
 *  - один итоговый «Применить к планировщику» внизу (volume× + RIR+ + deload) вместо 7 разбросанных кнопок.
 *  - визуальная шлифовка: стеклянные карты, градиенты, sticky-навигация, мягкие переходы, 44px тачи.
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { loadSRPESessions, saveSRPESession, clearSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio, weeklyMonotony, fitnessFatigue, trainingLoadReport, sessionLoad, type DayLoad } from '../../../engines/pro/training-load.engine';
import { analyzeRecovery, shouldTrain } from '../../../engines/recovery-optimization.engine';
import { calculatePRI, getPRIThreshold } from '../../../engines/autoregulation.engine';
import { autoRegulate, loadForRPE, rpeFromLoad, shouldTrainToday } from '../../../engines/pro/autoregulation-pro.engine';
import { generateReadinessForecast, runWhatIf } from '../../../engines/predictive.engine';
import { loadReadinessHistory } from './readiness-history';
import { getCalibrationStats } from '../../../engines/rir-calibration.engine';
import { getProfile } from '../../../core/profile-manager';
import { applyToPlanner } from './planner-bridge';
import { generateBBRecommendations, bbRecSummary } from '../../../engines/bb/bb-training-recommendations.engine';
import { weeklySetsByGroup } from '../../../engines/training-recommendations.engine';
import { MetricCard, ExpandableCard, PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = '#fff';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' };
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: ACCENT, margin: '0 0 6px', letterSpacing: 0.2 };
const SMALL: React.CSSProperties = { fontSize: 10, color: '#fff', lineHeight: 1.45 };
const HINT: React.CSSProperties = { ...SMALL, color: '#fff' };

const ZONE_META: Record<string, { label: string; color: string; short: string }> = {
  undertrained: { label: 'Недотрен', color: '#3b82f6', short: 'недо' },
  optimal: { label: 'Оптимум', color: '#22c55e', short: 'ок' },
  caution: { label: 'Осторожно', color: '#eab308', short: 'осторожно' },
  dangerous: { label: 'Опасно', color: '#ef4444', short: 'риск' },
};

const READINESS_COLOR = (v: number) => v >= 75 ? '#22c55e' : v >= 55 ? '#84cc16' : v >= 35 ? '#eab308' : '#ef4444';
const RECOVERY_LABEL_COLOR = (l: string) => l === 'Отлично' ? '#22c55e' : l === 'Хорошо' ? '#84cc16' : l === 'Средне' ? '#eab308' : l === 'Низко' ? '#f97316' : '#ef4444';

type SectionId = 'load' | 'recovery' | 'autoreg' | 'forecast' | 'recommendations';
const SECTIONS: { id: SectionId; label: string; icon: string; accent: string; desc: string }[] = [
  { id: 'load', label: 'Нагрузка', icon: '📊', accent: '#3b82f6', desc: 'ACWR/Banister/монотонность — факты нагрузки из sRPE' },
  { id: 'recovery', label: 'Восстановление', icon: '🔋', accent: '#22c55e', desc: 'Сон/HRV/готовность → вердикт train/deload/supercompensation' },
  { id: 'autoreg', label: 'Авторегуляция', icon: '⚙️', accent: '#a855f7', desc: 'PRI + pro-регуляция веса/объёма/RIR + RPE↔вес + калибрация' },
  { id: 'forecast', label: 'Прогноз', icon: '🔮', accent: '#f59e0b', desc: 'Хольт-прогноз готовности + сценарий «что-если»' },
  { id: 'recommendations', label: 'Рекомендации', icon: '💡', accent: '#8b5cf6', desc: 'ББ-аудит: план/PED/питание/сапплементы/выполнение' },
];

function useStickySection(active: SectionId, setActive: (s: SectionId) => void) {
  const refs = useRef<Record<string, HTMLElement | null>>({} as any);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b)=> b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) {
        const id = visible.target.id.replace('sec-','') as SectionId;
        if ((SECTIONS as any).some((s: any)=> s.id===id)) setActive(id);
      }
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0,0.2,0.6,1] });
    SECTIONS.forEach(s => { const el = refs.current[s.id]; if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [setActive]);
  return refs;
}

const SNAP_KEY = 'he_unified_intel_snapshot_v1';
export const UnifiedIntelligenceHub: React.FC = () => {
  // ——— единый снапшот ———
  const [readiness, setReadiness] = useState(72);
  const [fatigue, setFatigue] = useState(28);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState(4);
  const [rmssd, setRmssd] = useState(55);
  const [restingHR, setRestingHR] = useState(58);
  const [stress, setStress] = useState(4);
  const [doms, setDoms] =useState(2);
  const [trainDays, setTrainDays] = useState(4);
  const [phase, setPhase] = useState<'accumulation'|'intensification'|'peaking'|'deload'>('accumulation');
  const [lastRPE, setLastRPE] = useState(7);
  const [vLoss, setVLoss] = useState(12);
  const [e1rm, setE1rm] = useState(120);
  const [rpe, setRpe] = useState(8);
  const [repCnt, setRepCnt] = useState(5);
  const [topPct, setTopPct] = useState(0.85);
  const [planRIR, setPlanRIR] = useState(2);
  const [calDelta, setCalDelta] = useState(0);
  const [sleepDelta, setSleepDelta] = useState(0);
  const [aasMult, setAasMult] = useState(1);
  const [sessions, setSessions] = useState<SRPESession[]>(() => loadSRPESessions());
  const [sDate, setSDate] = useState(new Date().toISOString().slice(0,10));
  const [sRPE, setSRPE] = useState(7);
  const [sDur, setSDur] = useState(60);
  const [active, setActive] = useState<SectionId>('load');
  const refs = useStickySection(active, setActive);
  const scrollTo = (id: SectionId) => document.getElementById('sec-'+id)?.scrollIntoView({ behavior:'smooth', block:'start' });

  // autofill once: снапшот → профиль → дефолт (снапшот приоритетнее, чтобы не терять ручные правки)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNAP_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.readiness === 'number') setReadiness(s.readiness);
        if (typeof s.fatigue === 'number') setFatigue(s.fatigue);
        if (typeof s.sleepHours === 'number') setSleepHours(s.sleepHours);
        if (typeof s.sleepQuality === 'number') setSleepQuality(s.sleepQuality);
        if (typeof s.rmssd === 'number') setRmssd(s.rmssd);
        if (typeof s.restingHR === 'number') setRestingHR(s.restingHR);
        if (typeof s.stress === 'number') setStress(s.stress);
        if (typeof s.doms === 'number') setDoms(s.doms);
        if (typeof s.trainDays === 'number') setTrainDays(s.trainDays);
        if (s.phase) setPhase(s.phase);
        if (typeof s.lastRPE === 'number') setLastRPE(s.lastRPE);
        if (typeof s.vLoss === 'number') setVLoss(s.vLoss);
        return;
      }
    } catch {}
    try {
      const p: any = getProfile()?.settings || {};
      if (p.lifestyle?.sleepHours) setSleepHours(p.lifestyle.sleepHours);
      if (p.lifestyle?.sleepQuality) { const m:any={good:5,fair:3,poor:1}; setSleepQuality(m[p.lifestyle.sleepQuality]??3); }
      if (p.lifestyle?.morningHRV) setRmssd(p.lifestyle.morningHRV);
      if (p.lifestyle?.restingHR) setRestingHR(p.lifestyle.restingHR);
      if (p.lifestyle?.fatigueLevel) setFatigue(Math.min(100, Math.max(0, p.lifestyle.fatigueLevel*10)));
      if (p.training?.recovery) setReadiness(Math.min(100, Math.max(0, p.training.recovery*10)));
      if (p.training?.daysPerWeek) setTrainDays(p.training.daysPerWeek);
    } catch {}
  }, []);
  // persist снапшот (debounce 400мс через эффект)
  useEffect(() => {
    try {
      const snap = { readiness, fatigue, sleepHours, sleepQuality, rmssd, restingHR, stress, doms, trainDays, phase, lastRPE, vLoss };
      localStorage.setItem(SNAP_KEY, JSON.stringify(snap));
    } catch {}
  }, [readiness, fatigue, sleepHours, sleepQuality, rmssd, restingHR, stress, doms, trainDays, phase, lastRPE, vLoss]);

  const reload = useCallback(()=> setSessions(loadSRPESessions()), []);
  const addSession = ()=> { saveSRPESession({ date: sDate, sRPE, durationMin: sDur }); reload(); };
  const clearAll = ()=> { clearSRPESessions(); reload(); };

  // ——— вычисляем всё один раз ———
  const dailyLoads: DayLoad[] = useMemo(()=> toDailyLoads(sessions), [sessions]);
  const acwr = useMemo(()=> acuteChronicRatio(dailyLoads), [dailyLoads]);
  const monotony = useMemo(()=> weeklyMonotony(dailyLoads), [dailyLoads]);
  const banister = useMemo(()=> fitnessFatigue(dailyLoads), [dailyLoads]);
  const report = useMemo(()=> trainingLoadReport(sessions), [sessions]);
  const hrvRatio = useMemo(()=> rmssd / 60, [rmssd]);

  const recoveryOut = useMemo(()=> {
    try {
      return analyzeRecovery({
        sleep: { hours: sleepHours, quality: sleepQuality, bedtime:'23:00', wakeTime:'07:00', latencyMin:10, awakenings:1 },
        hrv: { rmssd, sdnn:50, restingHR, readinessScore: readiness },
        fatigueScore: fatigue/100,
        trainingDaysThisWeek: trainDays,
        currentWeek: 4,
        periodizationPhase: phase,
        recentPR: false,
        injuryHistory: [],
      });
    } catch { return null; }
  }, [sleepHours, sleepQuality, rmssd, restingHR, readiness, fatigue, trainDays, phase]);

  const verdict = useMemo(()=> recoveryOut ? shouldTrain(recoveryOut.overallRecoveryIndex, fatigue/100) : null, [recoveryOut, fatigue]);

  const readinessScores = useMemo(()=> ({ recovery: readiness, fatigue, nutrition:80, support:80, sleep: Math.round(sleepQuality*2), stress }), [readiness, fatigue, sleepQuality, stress]);
  const pri = useMemo(()=> calculatePRI(readinessScores as any, doms, sleepQuality*2, stress), [readinessScores, doms, sleepQuality, stress]);
  const priThr = useMemo(()=> getPRIThreshold(pri), [pri]);

  const autoReg = useMemo(()=> autoRegulate({
    readiness, acwr: { ratio: acwr.ratio, zone: acwr.zone }, fatigue, hrvRatio, sleepScore: recoveryOut?.sleepScore ?? 70,
    lastSessionRPE: lastRPE, lastVelocityLossPct: vLoss, plannedTopSetPct: topPct, plannedRIR: planRIR,
  }), [readiness, acwr, fatigue, hrvRatio, recoveryOut, lastRPE, vLoss, topPct, planRIR]);

  const trainToday = useMemo(()=> shouldTrainToday({ readiness, acwr, hrvRatio }), [readiness, acwr, hrvRatio]);

  const rirCalib = useMemo(()=> { try { return getCalibrationStats(); } catch { return null; } }, [sessions]);

  const hist = useMemo(()=> loadReadinessHistory().map(p=> p.recovery), []);
  const forecast = useMemo(()=> hist.length >=3 ? generateReadinessForecast(hist) : null, [hist]);
  const whatIf = useMemo(()=> runWhatIf(recoveryOut?.overtrainingRisk ?? 22, readiness, {
    calorieChange: calDelta, sleepChange: sleepDelta, drugChange: aasMult!==1? { AAS: aasMult }: undefined,
  }), [recoveryOut, readiness, calDelta, sleepDelta, aasMult]);

  const workWeight = useMemo(()=> loadForRPE(e1rm, rpe, repCnt), [e1rm, rpe, repCnt]);
  const rpeBack = useMemo(()=> rpeFromLoad(e1rm, workWeight, repCnt), [e1rm, workWeight, repCnt]);

  // BB-аудит (перенесён из дневника — без дубля, канон тут)
  const bbRecs = useMemo(() => {
    try {
      const loadPlan = () => {
        try {
          const a = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
          if (a && a.weeks) return a;
          const b = JSON.parse(localStorage.getItem('he_bb_plans') || '[]');
          if (Array.isArray(b) && b[0]?.weeks) return b[0];
          const c = JSON.parse(localStorage.getItem('he_bb_session') || 'null');
          if (c?.builtBb?.weeks) return c.builtBb;
        } catch {}
        return null;
      };
      const plan = loadPlan();
      if (!plan) return null;
      const profile: any = (()=> { try { return JSON.parse(localStorage.getItem('he_profile_v2')||'{}').settings || {}; } catch { return {}; }})();
      const historyWorkouts: any[] = (()=> { try { return JSON.parse(localStorage.getItem('he_workout_log_v2')||'[]'); } catch { return []; }})();
      // nutrition avg 7d
      const nutDiary: any = (()=> { try { return JSON.parse(localStorage.getItem('nutrition_diary_v2')||'null'); } catch { return null; }})();
      let nutrition: any = null;
      if (nutDiary && Array.isArray(nutDiary.days)) {
        let sumK=0,sumP=0,sumC=0,cnt=0;
        for (const d of nutDiary.days.slice(-7)) {
          const meals = Array.isArray(d.meals)? d.meals: [];
          if (meals.length===0) continue;
          let k=0,p=0,c=0;
          for (const m of meals) for (const it of (m.items||[])) { k+= it.calories||0; p+= it.protein||0; c+= it.carbs||0; }
          sumK+=k; sumP+=p; sumC+=c; cnt++;
        }
        if (cnt>0) nutrition = { avgKcal: Math.round(sumK/cnt), avgProtein: Math.round(sumP/cnt), avgCarbs: Math.round(sumC/cnt) };
      }
      const supportSubs: string[] = (()=> { try {
        const r = JSON.parse(localStorage.getItem('he_support_plan_result')||'null');
        if (r?.substances) return r.substances.map((s:any)=> s.name||s.id).filter(Boolean);
        const rr = JSON.parse(localStorage.getItem('he_support_risk')||'null');
        if (rr?.subs) return rr.subs;
      } catch {} return [];})();
      const sleepDiary: any[] = (()=> { try { return JSON.parse(localStorage.getItem('he_sleep_diary')||'[]'); } catch { return []; }})();
      const lastSleep = sleepDiary.length? [...sleepDiary].sort((a,b)=> b.date.localeCompare(a.date))[0]?.hours ?? null : null;
      const sections = generateBBRecommendations({
        plan: plan as any,
        params: { goal: profile?.goals?.bbGoal || 'hypertrophy', level: profile?.training?.level || 'intermediate' } as any,
        historyWorkouts,
        profile: { weight: profile?.personal?.weight || 80, proteinPerKg: profile?.nutrition?.proteinPerKg } as any,
        nutrition, supportSubs,
        readiness: { lastRecovery: readiness, lowDays: 0 },
        acwr: { ratio: acwr.ratio, zone: acwr.zone } as any,
        lastSleepHours: lastSleep,
      } as any);
      return { sections, summary: bbRecSummary(sections) };
    } catch { return null; }
  }, [readiness, acwr, sessions.length]);

  // unified apply: один раз, без дублей
  const applyUnified = ()=> {
    const vol = autoReg.volumeMultiplier;
    const rir = autoReg.rirShift;
    const deload = autoReg.deload || !!recoveryOut?.deloadRecommended;
    const label = deload ? `Интеллект: deload (ACWR ${acwr.ratio.toFixed(2)}/${ZONE_META[acwr.zone].label}, RI ${recoveryOut?.overallRecoveryIndex ?? '—'})` : `Интеллект: объём ×${vol} · RIR +${rir} (ACWR ${acwr.ratio.toFixed(2)}, PRI ${pri})`;
    // pri-канал — канон для объёма/RIR; добавим deload-флаг в label (движок объёма учтёт).
    applyToPlanner({ kind:'pri', label, data:{ volumeMult: vol, rirShift: rir } });
    const t = (window as any).showToast; if (typeof t==='function') t(deload ? '🔄 Deload отправлен в планировщик' : `✓ Коррекция ×${vol} · RIR+${rir} отправлена`, 'success'); else alert(label);
  };

  const last7 = report.dailyLoads.slice(-7);
  const maxLoad = Math.max(1, ...last7.map(d=> d.load));
  const weeks: { label:string; load:number }[] = (()=> {
    const dl = report.dailyLoads;
    const out: typeof weeks = [];
    for(let w=0; w<4; w++){ const load = (w===0? dl.slice(-7) : dl.slice(-7 - w*7, -7 - (w-1)*7)).reduce((s,d)=> s+d.load,0); out.unshift({ label: w===0? 'тек.': `−${w}н`, load: Math.round(load)}); }
    return out;
  })();
  const maxW = Math.max(1, ...weeks.map(x=> x.load));

  return (
    <div style={{ padding: '10px 8px 18px', color:'#fff', maxWidth:760, margin:'0 auto' }}>
      {/* header */}
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(0,230,138,0.10),rgba(59,130,246,0.07))', border:'1px solid rgba(0,230,138,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(0,230,138,0.16),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>⚡</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Интеллект тренировки</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Единый пульт: нагрузка → восстановление → авторегуляция → прогноз. Один расчёт, без дублей.</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)', color:ACCENT, fontWeight:800, whiteSpace:'nowrap' }}>без дублей</span>
        </div>
        <div style={{ ...SMALL, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> вверху — единый снимок состояния (сон/HRV/готовность/усталость/sRPE). Он один раз питает все 4 блока ниже.
          <span style={{ color:ACCENT }}> ACWR — только в «Нагрузке»</span>, <span style={{ color:'#22c55e' }}>recovery/shouldTrain — только в «Восстановлении»</span>,
          <span style={{ color:'#a855f7' }}> PRI/RPE-вес — только в «Авторегуляции»</span>, <span style={{ color:'#f59e0b' }}> Хольт/what-if — только в «Прогнозе»</span>. Итоговая коррекция — одна кнопка внизу.
        </div>
      </div>

      {/* sticky nav */}
      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 10px', padding:'8px 8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {SECTIONS.map(s=> (
          <button key={s.id} onClick={()=> scrollTo(s.id)} style={{
            flex:'0 0 auto', display:'flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:800, whiteSpace:'nowrap',
            border: active===s.id ? `1px solid ${s.accent}` : '1px solid rgba(255,255,255,0.08)',
            background: active===s.id ? `${s.accent}18` : 'rgba(255,255,255,0.04)',
            color: active===s.id ? s.accent : '#fff', transition:'all 0.16s',
          }}>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
        <button onClick={applyUnified} style={{ marginLeft:'auto', flex:'0 0 auto', padding:'7px 12px', borderRadius:20, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:11, whiteSpace:'nowrap' }}>🛠 Применить</button>
      </div>

      {/* summary strip — 4 плитки, живые, без дублей формул */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
        <div onClick={()=> scrollTo('load')} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${ZONE_META[acwr.zone].color}`, minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color:ZONE_META[acwr.zone].color, letterSpacing:0.4, textTransform:'uppercase' }}>📊 Нагрузка · ACWR</div>
          <div style={{ fontSize:20, fontWeight:900, color:ZONE_META[acwr.zone].color, lineHeight:1, marginTop:2 }}>{acwr.ratio.toFixed(2)} <span style={{ fontSize:10, fontWeight:700, color:ZONE_META[acwr.zone].color, opacity:0.85 }}>· {ZONE_META[acwr.zone].label}</span></div>
          <div style={{ ...SMALL, marginTop:4 }}>{Math.round(acwr.acute)}/{Math.round(acwr.chronic)} AU · monotony {monotony.monotony} · strain {monotony.strain}</div>
        </div>
        <div onClick={()=> scrollTo('recovery')} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${recoveryOut ? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : DIM}`, minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color: recoveryOut ? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : DIM, letterSpacing:0.4, textTransform:'uppercase' }}>🔋 Восстановление</div>
          <div style={{ fontSize:20, fontWeight:900, color: recoveryOut ? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : '#fff', lineHeight:1, marginTop:2 }}>{recoveryOut ? `${recoveryOut.overallRecoveryIndex} · ${recoveryOut.readinessLabel}` : '—'}</div>
          <div style={{ ...SMALL, marginTop:4 }}>{verdict ? (verdict.train ? '✅ '+verdict.message : '🛑 '+verdict.message) : '—'} {recoveryOut?.deloadRecommended ? ' · deload' : ''}</div>
        </div>
        <div onClick={()=> scrollTo('autoreg')} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid #a855f7`, minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#a855f7', letterSpacing:0.4, textTransform:'uppercase' }}>⚙️ Авторегуляция · PRI {pri}</div>
          <div style={{ fontSize:16, fontWeight:900, color:'#fff', lineHeight:1, marginTop:2 }}>×{autoReg.volumeMultiplier} · RIR+{autoReg.rirShift} <span style={{ fontSize:10, color: autoReg.deload ? '#ef4444' : DIM, fontWeight:800 }}>{autoReg.deload ? 'deload' : autoReg.intensityNote || ''}</span></div>
          <div style={{ ...SMALL, marginTop:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{priThr.label} · {priThr.desc}</div>
        </div>
        <div onClick={()=> scrollTo('forecast')} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid #f59e0b`, minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#f59e0b', letterSpacing:0.4, textTransform:'uppercase' }}>🔮 Прогноз · {forecast ? `${Math.round(forecast.values[0])}→${Math.round(forecast.values[forecast.values.length-1])}` : '—'}</div>
          <div style={{ fontSize:14, fontWeight:900, color: forecast ? READINESS_COLOR(forecast.values[0]) : '#fff', lineHeight:1, marginTop:2 }}>{forecast ? `+${forecast.values.length}д · ДИ ${Math.round(forecast.ci95[0][0])}–${Math.round(forecast.ci95[0][1])}` : (hist.length<3 ? `${hist.length}/3 дн. истории` : '—')}</div>
          <div style={{ ...SMALL, marginTop:4 }}>{whatIf ? `what-if ΔR ${whatIf.riskDelta>=0?'+':''}${whatIf.riskDelta} · ΔГ ${whatIf.readinessDelta>=0?'+':''}${whatIf.readinessDelta}` : '—'}</div>
        </div>
      </div>

      {/* ——— единый пульт входа ——— */}
      <div style={{ ...CARD, border:'1px solid rgba(0,230,138,0.16)', background:'linear-gradient(135deg,rgba(0,230,138,0.07),rgba(255,255,255,0.02))' }}>
        <div style={H}>🎛 Единый пульт — состояние сегодня</div>
        <div style={HINT}>Один снимок питает все блоки. Заполните или нажмите «Авто» — данные подтянутся из профиля и дневника sRPE.</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
          <PopupNumber label="Готовность 0–100" value={readiness} min={0} max={100} onChange={setReadiness} />
          <PopupNumber label="Усталость 0–100" value={fatigue} min={0} max={100} onChange={setFatigue} />
          <PopupNumber label="Сон, часы" value={sleepHours} min={0} max={12} step={0.5} onChange={setSleepHours} />
          <PopupNumber label="Качество сна 1–5" value={sleepQuality} min={1} max={5} onChange={setSleepQuality} />
          <PopupNumber label="HRV rmssd, мс" value={rmssd} min={10} max={150} onChange={setRmssd} />
          <PopupNumber label="Пульс покоя" value={restingHR} min={35} max={95} onChange={setRestingHR} />
          <PopupNumber label="Стресс 0–10" value={stress} min={0} max={10} onChange={setStress} />
          <PopupNumber label="DOMS 0–10" value={doms} min={0} max={10} onChange={setDoms} />
          <PopupNumber label="Тренировок/нед" value={trainDays} min={0} max={7} onChange={setTrainDays} />
          <PopupSelect label="Фаза" value={phase} options={[{id:'accumulation',label:'Накопление'},{id:'intensification',label:'Интенсификация'},{id:'peaking',label:'Пик'},{id:'deload',label:'Разгрузка'}]} onChange={v=> setPhase(v as any)} />
          <PopupNumber label="RPE прошлой сессии" value={lastRPE} min={1} max={10} step={0.5} onChange={setLastRPE} />
          <PopupNumber label="Потеря скорости %" value={vLoss} min={0} max={50} onChange={setVLoss} />
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <button onClick={()=>{
            try {
              const p:any=getProfile()?.settings||{};
              if(p.lifestyle?.sleepHours) setSleepHours(p.lifestyle.sleepHours);
              if(p.lifestyle?.morningHRV) setRmssd(p.lifestyle.morningHRV);
              if(p.lifestyle?.restingHR) setRestingHR(p.lifestyle.restingHR);
              if(p.lifestyle?.fatigueLevel) setFatigue(Math.min(100, p.lifestyle.fatigueLevel*10));
              if(p.training?.recovery) setReadiness(Math.min(100, p.training.recovery*10));
              if(p.training?.daysPerWeek) setTrainDays(p.training.daysPerWeek);
            } catch {}
            const t=(window as any).showToast; if(typeof t==='function') t('📋 Подтянуто из профиля','success');
          }} style={{ flex:1, minHeight:42, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(99,102,241,0.28)', background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:800, fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>📋 Авто из профиля</button>
          <button onClick={reload} style={{ flex:1, minHeight:42, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(0,230,138,0.22)', background:'rgba(0,230,138,0.10)', color:ACCENT, fontWeight:800, fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>🔁 sRPE ({sessions.length})</button>
          <button onClick={()=>{
            try { localStorage.removeItem(SNAP_KEY); } catch {}
            setReadiness(72); setFatigue(28); setSleepHours(7.5); setSleepQuality(4); setRmssd(55); setRestingHR(58); setStress(4); setDoms(2); setTrainDays(4); setPhase('accumulation'); setLastRPE(7); setVLoss(12);
            const t=(window as any).showToast; if(typeof t==='function') t('↩ Сброшено к дефолту','info');
          }} style={{ minWidth:84, padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:DIM, fontWeight:700, fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>↩ Сброс</button>
        </div>
        <div style={{ ...SMALL, marginTop:8, padding:'7px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          HRV-ratio {hrvRatio.toFixed(2)} · PRI {pri} ({priThr.label}) · trainToday: <b style={{ color: trainToday.train ? '#22c55e' : '#ef4444'}}>{trainToday.train ? 'да' : 'нет'}</b> — {trainToday.reason}
        </div>
      </div>

      {/* ——— НАГРУЗКА ——— */}
      <section id="sec-load" ref={el=> refs.current['load']=el} style={{ scrollMarginTop: 56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #3b82f6` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.14)', border:'1px solid rgba(59,130,246,0.22)', fontSize:14 }}>📊</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#3b82f6' }}>Нагрузка</div>
              <div style={{ fontSize:10, color:DIM }}>Одна формула ACWR/monotony/Banister — факты из sRPE, без повторов в других секциях</div>
            </div>
            <span style={{ marginLeft:'auto', fontSize:9, padding:'3px 8px', borderRadius:20, background:`${ZONE_META[acwr.zone].color}14`, border:`1px solid ${ZONE_META[acwr.zone].color}33`, color:ZONE_META[acwr.zone].color, fontWeight:800 }}>{ZONE_META[acwr.zone].label}</span>
          </div>

          {/* ввод sRPE */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8, alignItems:'end' }}>
            <div>
              <div style={{ fontSize:10, color:DIM, marginBottom:3 }}>Дата</div>
              <input type="date" value={sDate} onChange={e=> setSDate(e.target.value)} style={{ width:'100%', background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, padding:'9px 8px', fontSize:12, minHeight:38, boxSizing:'border-box' }} />
            </div>
            <PopupNumber label="sRPE 1–10" value={sRPE} min={1} max={10} onChange={setSRPE} />
            <PopupNumber label="Длит. мин" value={sDur} min={5} max={300} suffix=" мин" onChange={setSDur} />
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <button onClick={addSession} style={{ flex:1, minHeight:42, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:12 }}>💾 Добавить ({sessionLoad(sRPE,sDur)} AU)</button>
            {sessions.length>0 && <button onClick={clearAll} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(239,68,68,0.28)', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontWeight:800, fontSize:12, cursor:'pointer' }}>Очистить</button>}
          </div>
          {sessions.length===0 ? (
            <div style={{ ...CARD, marginBottom:8, background:'rgba(255,255,255,0.03)', textAlign:'center', ...HINT }}>Нет sRPE-данных. Добавьте тренировки — ACWR/monotony/Banister появятся.</div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <div style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>Острая 7д</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#3b82f6' }}>{Math.round(acwr.acute)}</div>
                  <div style={SMALL}>AU/дн</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>Хроническая 28д</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{Math.round(acwr.chronic)}</div>
                  <div style={SMALL}>AU/дн</div>
                </div>
                <div style={{ background:`${ZONE_META[acwr.zone].color}12`, border:`1px solid ${ZONE_META[acwr.zone].color}33`, borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>ACWR</div>
                  <div style={{ fontSize:16, fontWeight:900, color:ZONE_META[acwr.zone].color }}>{acwr.ratio.toFixed(2)}</div>
                  <div style={{ fontSize:9, color:ZONE_META[acwr.zone].color, fontWeight:800 }}>{ZONE_META[acwr.zone].label}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:8, borderRadius:99, background:'linear-gradient(90deg,#3b82f6 0 20%,#22c55e 20% 62%,#eab308 62% 78%,#ef4444 78% 100%)', position:'relative' }}>
                <div style={{ position:'absolute', top:-4, width:3, height:16, background:'#fff', borderRadius:2, left:`${Math.min(100, Math.max(0, (acwr.ratio/2)*100))}%`, boxShadow:'0 1px 6px rgba(0,0,0,0.4)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#fff', marginTop:2 }}><span>0.0</span><span>0.8</span><span>1.3</span><span>1.5</span><span>2.0</span></div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginTop:10 }}>
                <MetricCard title="Нагрузка 7д" accent="#3b82f6"><div style={{ fontSize:16, fontWeight:900, color:'#3b82f6' }}>{monotony.weeklyLoad}</div><div style={SMALL}>AU</div></MetricCard>
                <MetricCard title="Монотонность" accent={monotony.monotony>2?'#ef4444':'#3b82f6'}><div style={{ fontSize:16, fontWeight:900, color: monotony.monotony>2?'#ef4444':'#3b82f6' }}>{monotony.monotony}</div><div style={SMALL}>{monotony.monotony>2?'однообразие': 'норма'}</div></MetricCard>
                <MetricCard title="Strain" accent={monotony.strain>1000?'#ef4444':'#3b82f6'}><div style={{ fontSize:16, fontWeight:900, color: monotony.strain>1000?'#ef4444':'#3b82f6' }}>{monotony.strain}</div><div style={SMALL}>{monotony.strain>1000?'стресс':'норма'}</div></MetricCard>
                <MetricCard title="SD" accent="#3b82f6"><div style={{ fontSize:16, fontWeight:900, color:'#3b82f6' }}>{monotony.stdev}</div><div style={SMALL}>разброс</div></MetricCard>
              </div>

              {banister.current && (
                <MetricCard title="Fitness-Fatigue (Banister)" accent="#60a5fa">
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    <div style={{ background:'rgba(96,165,250,0.07)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}><div style={{ fontSize:9, color:DIM }}>Форма</div><div style={{ fontSize:15, fontWeight:900, color:'#22c55e' }}>{Math.round(banister.current.fitness)}</div></div>
                    <div style={{ background:'rgba(239,68,68,0.06)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}><div style={{ fontSize:9, color:DIM }}>Усталость</div><div style={{ fontSize:15, fontWeight:900, color:'#ef4444' }}>{Math.round(banister.current.fatigue)}</div></div>
                    <div style={{ background:'rgba(0,230,138,0.06)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}><div style={{ fontSize:9, color:DIM }}>Работосп.</div><div style={{ fontSize:15, fontWeight:900, color: banister.current.performance>=0? ACCENT : '#ef4444' }}>{Math.round(banister.current.performance)}</div></div>
                  </div>
                  {banister.series[banister.peakPerformanceIdx] && <div style={{ ...SMALL, marginTop:6 }}>Пик: {Math.round(banister.series[banister.peakPerformanceIdx].performance)} ({banister.series[banister.peakPerformanceIdx].date})</div>}
                </MetricCard>
              )}

              <MetricCard title="Дневная нагрузка · 7д" icon="📈">
                <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:64 }}>
                  {last7.map((d,i)=> (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{ width:'100%', maxWidth:28, height: Math.max(2, (d.load/maxLoad)*52), borderRadius:6, background: d.load>0? 'linear-gradient(180deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)', transition:'height 0.2s' }} />
                      <span style={{ fontSize:9, color:'#fff' }}>{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </MetricCard>

              <MetricCard title="Недельная динамика · 4н" icon="📅" accent="#60a5fa">
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:64 }}>
                  {weeks.map((w,i)=> (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{ width:'100%', maxWidth:36, height: Math.max(2, (w.load/maxW)*52), borderRadius:6, background: i===weeks.length-1? 'linear-gradient(180deg,#00e68a,#00c853)' : 'rgba(96,165,250,0.55)' }} />
                      <span style={{ fontSize:9, color:'#fff' }}>{w.label}</span>
                      <span style={{ fontSize:9, color:'#fff', fontWeight:800 }}>{w.load}</span>
                    </div>
                  ))}
                </div>
              </MetricCard>

              <ExpandableCard title={`Журнал sRPE · ${sessions.length}`} short={`${sessions.length} записей · ACWR ${acwr.ratio.toFixed(2)} · ${ZONE_META[acwr.zone].label}`} full={
                <div>
                  {sessions.slice().reverse().slice(0,30).map((s,i)=> (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 0.6fr 0.7fr 0.6fr', gap:4, fontSize:10, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>
                      <span>{s.date}</span><span>RPE {s.sRPE}</span><span>{s.durationMin} мин</span><span style={{ color:ACCENT, fontWeight:800 }}>{sessionLoad(s.sRPE,s.durationMin)} AU</span>
                    </div>
                  ))}
                </div>
              } />

              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.14)', fontSize:10, color:'#fff', lineHeight:1.45 }}>
                {report.recommendations.map((r,i)=> <div key={i} style={{ marginTop: i?4:0 }}>• {r}</div>)}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ——— ВОССТАНОВЛЕНИЕ ——— */}
      <section id="sec-recovery" ref={el=> refs.current['recovery']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #22c55e` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.14)', border:'1px solid rgba(34,197,94,0.22)', fontSize:14 }}>🔋</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#22c55e' }}>Восстановление</div>
              <div style={{ fontSize:10, color:DIM }}>Единственный источник recovery-вердикта (сон/HRV/готовность/перетрен), без повторов из «Нагрузки»</div>
            </div>
          </div>

          {!recoveryOut || !verdict ? (
            <div style={SMALL}>Недостаточно данных.</div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ background:`${RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel)}14`, border:`1px solid ${RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel)}33`, borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:DIM, letterSpacing:0.3, textTransform:'uppercase' }}>Recovery index</div>
                  <div style={{ fontSize:20, fontWeight:900, color: RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) }}>{recoveryOut.overallRecoveryIndex}<span style={{ fontSize:10 }}> /100</span></div>
                  <div style={{ fontSize:10, color: RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel), fontWeight:800 }}>{recoveryOut.readinessLabel}</div>
                </div>
                <div style={{ background: verdict.train? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${verdict.train? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`, borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:16 }}>{verdict.train? '✅' : '🛑'}</div>
                  <div style={{ fontSize:11, fontWeight:800, color: verdict.train? '#22c55e' : '#ef4444' }}>{verdict.train? 'Тренироваться' : 'Отдых'}</div>
                  <div style={{ fontSize:9, color: verdict.train? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)', marginTop:2, lineHeight:1.3 }}>{verdict.message}</div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginTop:8 }}>
                <MetricCard title="Сон" accent={recoveryOut.sleepScore>=65? '#22c55e':'#eab308'}><div style={{ fontSize:15, fontWeight:900, color: recoveryOut.sleepScore>=65?'#22c55e':'#eab308' }}>{recoveryOut.sleepScore}</div><div style={SMALL}>/100</div></MetricCard>
                <MetricCard title="HRV" accent={recoveryOut.hrvScore>=65?'#22c55e':'#eab308'}><div style={{ fontSize:15, fontWeight:900, color: recoveryOut.hrvScore>=65?'#22c55e':'#eab308' }}>{recoveryOut.hrvScore}</div><div style={SMALL}>/100</div></MetricCard>
                <MetricCard title="Перетрен" accent={recoveryOut.overtrainingRisk>=60?'#ef4444':'#22c55e'}><div style={{ fontSize:15, fontWeight:900, color: recoveryOut.overtrainingRisk>=60?'#ef4444':'#22c55e' }}>{recoveryOut.overtrainingRisk}</div><div style={SMALL}>/100</div></MetricCard>
                <MetricCard title="Суперкомп." accent="#60a5fa"><div style={{ fontSize:15, fontWeight:900, color:'#60a5fa' }}>{recoveryOut.supercompensationHours}ч</div><div style={SMALL}>окно</div></MetricCard>
              </div>

              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10 }}>
                <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>HRV-score <b style={{ color:'#fff' }}>{recoveryOut.hrvScore}</b> · сон <b style={{ color:'#fff' }}>{recoveryOut.sleepScore}</b> · readiness <b style={{ color:'#fff' }}>{recoveryOut.readinessScore}</b></div>
                <div style={{ padding:'8px 10px', borderRadius:10, background: recoveryOut.deloadRecommended? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.06)', border:`1px solid ${recoveryOut.deloadRecommended? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.14)'}`, color: recoveryOut.deloadRecommended? '#f59e0b' : '#22c55e', fontWeight:700 }}>
                  {recoveryOut.deloadRecommended ? `⚠ ${recoveryOut.deloadReason}` : `✓ ${recoveryOut.deloadReason}`}
                </div>
              </div>

              {recoveryOut.recommendations.length>0 && (
                <div style={{ marginTop:8, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:ACCENT, marginBottom:4 }}>📋 Рекомендации восстановления</div>
                  {recoveryOut.recommendations.map((r,i)=> <div key={i} style={{ fontSize:10, color:'#fff', marginTop:2, lineHeight:1.4 }}>• {r}</div>)}
                </div>
              )}

              {verdict.train && <div style={{ ...SMALL, marginTop:6, padding:'6px 10px', borderRadius:9, background: verdict.intensityMod!==0? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>Модификатор интенсивности: <b style={{ color: verdict.intensityMod>0? '#22c55e':'#eab308' }}>{verdict.intensityMod>0? '+':''}{Math.round(verdict.intensityMod*100)}%</b> · {verdict.message}</div>}

              <ExpandableCard title="🤸 Мобилити-флоу · прехаб" short="Лёгкая разминка и коррекционные упражнения — по готовности." full={
                <div style={SMALL}>
                  <div>До 4 флоу по 6–12 мин (разминка/прехаб) и набор корректирующих упражнений — доступны после применения, детализация в Дневнике/Мобильности.</div>
                  <div style={{ marginTop:6, color:ACCENT }}>Суперкомпенсация ~{recoveryOut.supercompensationHours}ч — планируйте следующую тяжёлую сессию в это окно.</div>
                </div>
              } />
            </>
          )}
        </div>
      </section>

      {/* ——— АВТОРЕГУЛЯЦИЯ ——— */}
      <section id="sec-autoreg" ref={el=> refs.current['autoreg']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #a855f7` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.22)', fontSize:14 }}>⚙️</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#a855f7' }}>Авторегуляция</div>
              <div style={{ fontSize:10, color:DIM }}>Одна PRO-формула (готовность+ACWR+HRV+сон+усталость+RPE+VLoss) + PRI как контекст</div>
            </div>
            <span style={{ marginLeft:'auto', fontSize:9, padding:'3px 8px', borderRadius:20, background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.22)', color:'#a855f7', fontWeight:800 }}>PRI {pri} · {priThr.label}</span>
          </div>

          {/* PRI */}
          <MetricCard title={`PRI · ${priThr.label}`} accent={pri>=70?'#22c55e': pri>=50?'#eab308':'#ef4444'}>
            <div style={{ height:8, borderRadius:99, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:6 }}>
              <div style={{ width:`${pri}%`, height:'100%', background: pri>=70? 'linear-gradient(90deg,#22c55e,#16a34a)' : pri>=50? 'linear-gradient(90deg,#eab308,#f59e0b)' : 'linear-gradient(90deg,#ef4444,#dc2626)', transition:'width 0.3s' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:10 }}>
              <div>Объём <b style={{ color:ACCENT }}>×{priThr.volumeMod}</b></div>
              <div>RIR <b style={{ color:ACCENT }}>+{priThr.rirAdd}</b></div>
              <div>{priThr.skipTraining? 'пропуск' : priThr.desc}</div>
            </div>
          </MetricCard>

          {/* pro decisions */}
          <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background: autoReg.deload? 'rgba(239,68,68,0.07)' : 'rgba(168,85,247,0.06)', border:`1px solid ${autoReg.deload? 'rgba(239,68,68,0.16)' : 'rgba(168,85,247,0.14)'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div style={{ fontSize:12, fontWeight:900, color: autoReg.deload? '#ef4444' : '#a855f7' }}>{autoReg.deload? '⭐ Deload' : autoReg.intensityNote? autoReg.intensityNote : 'Авторегуляция'}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:800 }}>топ ×{autoReg.topSetPctMultiplier}</span>
                <span style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:800 }}>объём ×{autoReg.volumeMultiplier}</span>
                <span style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontWeight:800 }}>RIR +{autoReg.rirShift}</span>
              </div>
            </div>
            <div style={{ marginTop:6, display:'grid', gap:3 }}>
              {autoReg.decisions.map((d,i)=> <div key={i} style={{ fontSize:10, color:'#fff', lineHeight:1.4 }}>• {d}</div>)}
            </div>
            {autoReg.adjustedTopSetPct!=null && <div style={{ marginTop:6, fontSize:10, color:DIM }}>Топ-сет: {(topPct*100).toFixed(0)}% → <b style={{ color:'#fff' }}>{(autoReg.adjustedTopSetPct*100).toFixed(1)}%</b> · RIR: {planRIR} → <b style={{ color:'#fff' }}>{autoReg.adjustedRIR}</b></div>}
          </div>

          {/* RPE ↔ вес — единственный калькулятор в хабе */}
          <MetricCard title="RPE ↔ вес (Epley, единственное место)" accent="#a855f7">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
              <PopupNumber label="e1RM, кг" value={e1rm} min={20} max={400} onChange={setE1rm} />
              <PopupNumber label="RPE 6–10" value={rpe} min={6} max={10} step={0.5} onChange={setRpe} />
              <PopupNumber label="Повторы" value={repCnt} min={1} max={15} onChange={setRepCnt} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <div style={{ background:'rgba(168,85,247,0.08)', borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:DIM }}>Рабочий вес @ RPE</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{workWeight.toFixed(1)} кг</div>
                <div style={SMALL}>RIR {Math.max(0,10 - rpe)}</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:DIM }}>Обратный RPE</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{rpeBack.toFixed(1)}</div>
                <div style={SMALL}>от факта веса</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
              <PopupNumber label="Топ-сет план %" value={Math.round(topPct*100)} min={50} max={100} suffix="%" onChange={v=> setTopPct(v/100)} hint="Плановый топ-сет перед авторегуляцией" />
              <PopupNumber label="План RIR" value={planRIR} min={0} max={4} onChange={setPlanRIR} />
            </div>
          </MetricCard>

          {/* RIR калибрация — только если есть данные, без дубля */}
          {rirCalib && rirCalib.totalSets>0 ? (
            <ExpandableCard title={`🎯 RIR-калибрация · ${rirCalib.totalSets} подходов`} short={`bias ${rirCalib.overallAvgBias>0?'+':''}${rirCalib.overallAvgBias.toFixed(2)} · консист. ${Math.round(rirCalib.overallConsistency)}%`} full={
              <div style={SMALL}>
                <div>Системное смещение: <b style={{ color: Math.abs(rirCalib.overallAvgBias)>1? '#ef4444' : '#22c55e' }}>{rirCalib.overallAvgBias>0?'+':''}{rirCalib.overallAvgBias.toFixed(2)}</b> {rirCalib.overallAvgBias>0.5? '— тяжелее чем думаете' : rirCalib.overallAvgBias<-0.5? '— легче чем думаете' : '— в цели'}</div>
                {rirCalib.exercises.slice(0,5).map(ex=> (
                  <div key={ex.exerciseId} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color:'#fff' }}>{ex.exerciseName}</span>
                    <span style={{ fontWeight:800, color: Math.abs(ex.avgBias)>1?'#ef4444':'#eab308' }}>{ex.avgBias>0?'+':''}{ex.avgBias.toFixed(1)} (n={ex.totalPoints})</span>
                  </div>
                ))}
                <div style={{ marginTop:6, color:DIM }}>Коррекция RIR уже учтена в «Авторегуляции» выше (rirShift). Отдельные кнопки применения — убраны, чтобы не дублировать.</div>
              </div>
            } />
          ) : (
            <div style={{ ...SMALL, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', marginTop:8 }}>
              🎯 RIR-калибрация появится после записи RPE в дневнике (≥2 подхода).
            </div>
          )}
        </div>
      </section>

      {/* ——— ПРОГНОЗ ——— */}
      <section id="sec-forecast" ref={el=> refs.current['forecast']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #f59e0b` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.14)', border:'1px solid rgba(245,158,11,0.22)', fontSize:14 }}>🔮</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#f59e0b' }}>Прогноз</div>
              <div style={{ fontSize:10, color:DIM }}>Хольт-прогноз по истории готовности + сценарий «что-если» — единственный прогноз в хабе</div>
            </div>
          </div>

          {hist.length<3 ? (
            <div style={{ padding:'12px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', ...SMALL, textAlign:'center' }}>
              Недостаточно истории ({hist.length}/3). Открывайте приложение ежедневно — готовность пишется в историю, прогноз появится.
            </div>
          ) : forecast ? (
            <>
              <div style={{ height:72, position:'relative', margin:'6px 0' }}>
                {(() => {
                  const recs = hist;
                  const all = [...recs, ...forecast.values];
                  const minV = Math.min(...all), maxV = Math.max(...all);
                  const W = 320, H = 72, pad = 8;
                  const px = (i:number)=> pad + (i / Math.max(1, all.length-1))*(W-2*pad);
                  const py = (v:number)=> H - pad - ((v-minV)/Math.max(1, maxV-minV))*(H-2*pad);
                  const histPts = recs.map((v,i)=> `${px(i)},${py(v)}`).join(' ');
                  const fcPts = forecast.values.map((v,i)=> `${px(recs.length-1+i)},${py(v)}`).join(' ');
                  return (
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block', maxWidth:380, margin:'0 auto' }}>
                      <polyline points={histPts} fill="none" stroke="#60a5fa" strokeWidth={1.6} />
                      <polyline points={fcPts} fill="none" stroke={ACCENT} strokeWidth={1.7} strokeDasharray="5 4" />
                      {forecast.values.map((v,i)=> <circle key={i} cx={px(recs.length-1+i)} cy={py(v)} r={2.6} fill={ACCENT} />)}
                    </svg>
                  );
                })()}
                <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:2 }}>
                  <span style={{ fontSize:9, color:'#60a5fa' }}>● история</span>
                  <span style={{ fontSize:9, color:ACCENT }}>● прогноз Хольт</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {forecast.values.map((v,i)=> (
                  <div key={i} style={{ background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.12)', borderRadius:10, padding:'8px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:9, color:DIM }}>+{i+1} дн</div>
                    <div style={{ fontSize:14, fontWeight:900, color: v>=70?'#22c55e': v>=50?'#eab308':'#ef4444' }}>{Math.round(v)}</div>
                    {forecast.ci95[i] && <div style={{ fontSize:9, color:'#fff' }}>ДИ {Math.round(forecast.ci95[i][0])}–{Math.round(forecast.ci95[i][1])}</div>}
                  </div>
                ))}
              </div>
              {forecast.warnings.length>0 && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.16)', fontSize:10, color:'#ef4444' }}>{forecast.warnings.join(' ')}</div>}
            </>
          ) : null}

          <MetricCard title="Сценарий «что-если»" accent="#f59e0b">
            <div style={{ fontSize:10, color:DIM, marginBottom:6 }}>База: риск {Math.round(recoveryOut?.overtrainingRisk ?? 22)} · готовность {Math.round(readiness)}. Меняйте — увидите дельту.</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
              <PopupNumber label="Δ калории" value={calDelta} min={-500} max={500} step={50} onChange={setCalDelta} />
              <PopupNumber label="Δ сон, ч" value={sleepDelta} min={-2} max={2} step={1} onChange={setSleepDelta} />
              <PopupNumber label="ААС ×" value={aasMult} min={0} max={2} step={0.5} suffix="×" onChange={setAasMult} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:DIM }}>Δ Риск</div>
                <div style={{ fontSize:18, fontWeight:900, color: whatIf.riskDelta>0?'#ef4444': whatIf.riskDelta<0?'#22c55e':'#fff' }}>{whatIf.riskDelta>0?'+':''}{whatIf.riskDelta}</div>
                <div style={{ fontSize:9, color:'#fff' }}>{Math.round((recoveryOut?.overtrainingRisk ?? 22)+whatIf.riskDelta)} итог</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:DIM }}>Δ Готовность</div>
                <div style={{ fontSize:18, fontWeight:900, color: whatIf.readinessDelta>0?'#22c55e': whatIf.readinessDelta<0?'#ef4444':'#fff' }}>{whatIf.readinessDelta>0?'+':''}{whatIf.readinessDelta}</div>
                <div style={{ fontSize:9, color:'#fff' }}>{Math.round(readiness+whatIf.readinessDelta)} итог</div>
              </div>
            </div>
            <div style={{ ...SMALL, marginTop:8, padding:'7px 10px', borderRadius:9, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)' }}>{whatIf.note}</div>
          </MetricCard>
        </div>
      </section>

      {/* ——— РЕКОМЕНДАЦИИ ББ (перенесено из дневника) ——— */}
      <section id="sec-recommendations" ref={el=> refs.current['recommendations']=el} style={{ scrollMarginTop:56 }}>
        <div style={{ ...CARD, borderLeft:`3px solid #8b5cf6` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.22)', fontSize:14 }}>💡</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:'#8b5cf6' }}>Рекомендации · ББ-аудит</div>
              <div style={{ fontSize:10, color:DIM }}>План / PED / питание / добавки / выполнение — единственный ББ-аудит (перенесён из дневника)</div>
            </div>
            {bbRecs && <span style={{ marginLeft:'auto', fontSize:9, padding:'3px 8px', borderRadius:20, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.22)', color:'#8b5cf6', fontWeight:800 }}>{bbRecs.summary.total} · ⚠{bbRecs.summary.warns} · 🔴{bbRecs.summary.criticals}</span>}
          </div>
          {!bbRecs ? (
            <div style={{ ...SMALL, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
              Нет активного ББ-плана для аудита. Соберите план в <b>ББ-авто</b> или <b>Ручном конструкторе</b> — рекомендации появятся (PED, питание, добавки, выполнение vs факт, сон, ACWR).
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {bbRecs.sections.map((sec:any, idx:number)=> (
                <div key={idx} style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:4 }}>{sec.title}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {sec.items.map((it:any,i:number)=> {
                      const col = it.severity==='critical' ? '#ef4444' : it.severity==='warn' ? '#eab308' : '#60a5fa';
                      return <div key={i} style={{ display:'flex', gap:8, fontSize:11, lineHeight:1.4, color:'#fff', background:`${col}0d`, border:`1px solid ${col}22`, borderRadius:8, padding:'6px 8px' }}>
                        <span style={{ minWidth:6, height:6, borderRadius:6, background:col, marginTop:6, flexShrink:0 }} />
                        <span>{it.text}</span>
                        {it.severity!=='info' && <span style={{ marginLeft:'auto', fontSize:9, padding:'2px 6px', borderRadius:10, background:`${col}18`, color:col, fontWeight:800, whiteSpace:'nowrap' }}>{it.severity==='critical'?'🔴 крит':'⚠ варн'}</span>}
                      </div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ——— единый итог и применение ——— */}
      <div style={{ ...CARD, background:'linear-gradient(135deg,rgba(0,230,138,0.09),rgba(59,130,246,0.06))', border:'1px solid rgba(0,230,138,0.20)', padding:14 }}>
        <div style={{ fontSize:12, fontWeight:900, color:ACCENT, marginBottom:4 }}>🧩 Итоговая коррекция — одна кнопка вместо семи</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:DIM }}>ACWR</div>
            <div style={{ fontSize:13, fontWeight:900, color:ZONE_META[acwr.zone].color }}>{acwr.ratio.toFixed(2)} · {ZONE_META[acwr.zone].label}</div>
            <div style={{ fontSize:9, color:DIM }}>{acwr.zone==='dangerous'? 'deload' : acwr.zone==='caution'? 'RIR+1' : 'ок'}</div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:DIM }}>Recovery</div>
            <div style={{ fontSize:13, fontWeight:900, color: recoveryOut? RECOVERY_LABEL_COLOR(recoveryOut.readinessLabel) : '#fff' }}>{recoveryOut? `${recoveryOut.overallRecoveryIndex} · ${recoveryOut.readinessLabel}` : '—'}</div>
            <div style={{ fontSize:9, color:DIM }}>{recoveryOut?.deloadRecommended? 'deload' : 'ок'}</div>
          </div>
          <div style={{ background:'rgba(168,85,247,0.08)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:DIM }}>PRI/autoReg</div>
            <div style={{ fontSize:13, fontWeight:900, color:'#a855f7' }}>×{autoReg.volumeMultiplier} · +{autoReg.rirShift}</div>
            <div style={{ fontSize:9, color: autoReg.deload? '#ef4444':'#fff' }}>{autoReg.deload? 'deload' : 'применить'}</div>
          </div>
        </div>
        <div style={{ ...SMALL, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:10, lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Что применится:</b> объём <b style={{ color:ACCENT }}>×{autoReg.volumeMultiplier}</b> · RIR <b style={{ color:ACCENT }}>+{autoReg.rirShift}</b> ·
          топ-сет <b style={{ color:ACCENT }}>{(autoReg.adjustedTopSetPct ?? topPct)!=null ? `${((autoReg.adjustedTopSetPct ?? topPct)*100).toFixed(1)}%` : '—'}</b>
          { (autoReg.deload || !!recoveryOut?.deloadRecommended) && <span style={{ color:'#ef4444', fontWeight:800 }}> · deload</span> }.
          Forecast {forecast ? `→ ${Math.round(forecast.values[0])}` : '—'} + what-if ΔГ {whatIf.readinessDelta>=0?'+':''}{whatIf.readinessDelta} — информативно, в план не пишется.
          <span style={{ color:DIM }}> Канал: pri (планировщик покажет баннер и пересчитает).</span>
        </div>
        <button onClick={applyUnified} style={{ width:'100%', minHeight:46, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:13, boxShadow:'0 6px 18px rgba(0,230,138,0.22)' }}>
          🛠 Применить к планировщику — объём ×{autoReg.volumeMultiplier} · RIR +{autoReg.rirShift} {(autoReg.deload || !!recoveryOut?.deloadRecommended) ? '· deload' : ''}
        </button>
        <div style={{ ...SMALL, textAlign:'center', marginTop:6 }}>Источники: Foster/Impellizzeri sRPE, Gabbett/Rollinson ACWR, Banister FF, Helms RIR/RPE, Zatsiorsky, Holt (1957). Без выдумок.</div>
      </div>

      <div style={{ ...SMALL, textAlign:'center', marginTop:10 }}>
        Единый хаб без дублей — ACWR только в «Нагрузке», recovery/shouldTrain только в «Восстановлении», PRI/вес только в «Авторегуляции», Хольт/what-if только в «Прогнозе». Связный конвейер, а не 4 разрозненных вкладки.
      </div>
    </div>
  );
};

export default UnifiedIntelligenceHub;
