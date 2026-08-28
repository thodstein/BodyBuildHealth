/**
 * CombatConstructor.tsx — изолированный PRO-конструктор для единоборств.
 * Полностью отделён от ББ/ПЛ. Только силовая часть зала + кондиция + тапер + весогонка + годовой ATR.
 * Движок: combat-builder + periodization ATR / taper / weight-cut / conditioning / monitoring / core / PED cap / mesocycle / annual.
 */
import React, { useState, useMemo } from 'react';
import { buildCombatPlan } from '../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan, buildCombatReport } from '../../../engines/combat/combat-finalize.engine';
import { COMBAT_PATTERNS, recommendCombatPattern } from '../../../engines/combat/combat-split-patterns';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { saveCombatPlan, loadCombatPlans } from '../../../engines/combat/combat-storage';
import { applyCombatMesocycle } from '../../../engines/combat/combat-mesocycle';
import { buildAnnualFromCB, buildAnnualATR, saveAnnualCB, loadAnnualCB, buildAnnualPrintHtml, buildAnnualIcs } from '../../../engines/combat/combat-annual';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import type { CombatInput, CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';
import { combatACWR } from '../../../engines/combat/combat-monitoring.engine';
import { buildWeightCutProtocol } from '../../../engines/combat/combat-weight-cut.engine';

type Step = 'params' | 'outside' | 'split' | 'plan';

export const CombatConstructor: React.FC = () => {
  const [step, setStep] = useState<Step>('params');
  const [discipline, setDiscipline] = useState<CombatInput['discipline']>('mma');
  const [goal, setGoal] = useState<CombatInput['goal']>('power');
  const [level, setLevel] = useState<CombatInput['level']>('intermediate');
  const [weeks, setWeeks] = useState(6);
  const [days, setDays] = useState(3);
  const [weightCut, setWeightCut] = useState(0);
  const [waterMode, setWaterMode] = useState<'stable'|'load_cut'>('stable');
  const [sodiumMode, setSodiumMode] = useState<'stable'|'moderate_cut'>('stable');
  const [carbMode, setCarbMode] = useState<'stable'|'deplete_reload'>('stable');
  const [heatSessions, setHeatSessions] = useState(false);
  const [methodology, setMethodology] = useState<CombatInput['methodology']>('compound_first');
  const [dupMode, setDupMode] = useState<CombatInput['dupMode']>('off');
  const [intensityTech, setIntensityTech] = useState<CombatInput['intensityTech']>('none');
  const [periodizationModel, setPeriodizationModel] = useState<CombatInput['periodizationModel']>('atr_10');
  const [conditioningMode, setConditioningMode] = useState<CombatInput['conditioningMode']>('auto');
  const [outside, setOutside] = useState<OutsideLoad | null>(defaultOutsideLoadFor('mma'));
  const [outsideEnabled, setOutsideEnabled] = useState(true);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [mobility, setMobility] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<any[]>([]);
  const [injInput, setInjInput] = useState('');
  const [bodyweight, setBodyweight] = useState<number>(80);
  const [sex, setSex] = useState<'male'|'female'>('male');
  const [age, setAge] = useState<number>(28);
  const [fightDate, setFightDate] = useState<string>('');
  const [taperWeeks, setTaperWeeks] = useState<number>(2);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [acwr, setAcwr] = useState<{ ratio:number; zone:string } | null>(null);
  const [velocityLoss, setVelocityLoss] = useState<number>(0);
  const [patternId, setPatternId] = useState<string>('');
  const [workMax, setWorkMax] = useState<Record<string,number>>({ bench:80, squat:90, deadlift:100, chest:80, back:70, quads:90, hamstrings:80, shoulders:50 });
  const [plan, setPlan] = useState<CombatPlan | null>(null);
  const [annual, setAnnual] = useState(() => loadAnnualCB());
  const [diaryLoad, setDiaryLoad] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [annualWeeks, setAnnualWeeks] = useState<number>(52);
  const [competitionName, setCompetitionName] = useState<string>('');
  const [competitionDate, setCompetitionDate] = useState<string>('');
  const [competitionWeight, setCompetitionWeight] = useState<string>('');

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
            const r = combatACWR(acute*7, chronic*7);
            setAcwr({ ratio: r.ratio, zone: r.zone });
          }
        }catch{}
      }
    } catch {}
  }, [plan]);

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);

  const pullFromProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (!raw) return;
      const p = JSON.parse(raw);
      const personal = p.personal || {};
      const training = p.training || p;
      const lifestyle = p.lifestyle || {};
      const health = p.health || {};
      if (training.level) setLevel(training.level);
      else if (personal.level) setLevel(personal.level);
      if (personal.sex) setSex(personal.sex === 'female' ? 'female' : 'male');
      if (typeof personal.weight === 'number') setBodyweight(personal.weight);
      else if (typeof personal.bodyweight === 'number') setBodyweight(personal.bodyweight);
      if (typeof personal.age === 'number') setAge(personal.age);
      const wm: Record<string,number> = {};
      if (training.workMax) Object.assign(wm, training.workMax);
      if (personal.workMax) Object.assign(wm, personal.workMax);
      if (Object.keys(wm).length) setWorkMax(s => ({ ...s, ...wm }));
      if (training.workMaxByExercise || personal.workMaxByExercise) {
        // маппим часть ex в групповые для combat
        const exBy = training.workMaxByExercise || personal.workMaxByExercise;
        const map: Record<string,string> = { bench_bar:'bench', squat:'squat', front_squat:'squat', row_bar:'back', ohp:'shoulders' };
        for(const [k,v] of Object.entries(exBy as Record<string,number>)){
          const g = map[k];
          if(g && typeof v==='number' && v>0) wm[g]=v;
        }
        if (Object.keys(wm).length) setWorkMax(s => ({ ...s, ...wm }));
      }
      if (Array.isArray(health.injuries)) setInjuries(health.injuries);
      else if (Array.isArray(training.injuries)) setInjuries(training.injuries);
      if (Array.isArray(training.equipment)) setEquipment(training.equipment);
      else if (Array.isArray(personal.equipment)) setEquipment(personal.equipment);
      if (Array.isArray(health.mobilityRestrictions)) setMobility(health.mobilityRestrictions);
      else if (Array.isArray(training.mobilityRestrictions)) setMobility(training.mobilityRestrictions);
      else if (Array.isArray(p.health?.mobilityRestrictions)) setMobility(p.health.mobilityRestrictions);
      // lifestyle → hrv/sleep later in build
      setMsg('Профиль подтянут: ' + (personal.sex||'') + ' ' + (personal.weight||'') + 'кг');
    } catch {}
  };
  const build = () => {
    // recovery/питание из профиля
    let extra: any = {};
    try{
      const raw = localStorage.getItem('he_profile_v2');
      if(raw){
        const p = JSON.parse(raw);
        const personal = p.personal || {};
        const lifestyle = p.lifestyle || {};
        const ph = p.pharma || {};
        extra.bodyFat = typeof personal.bodyFat === 'number' ? personal.bodyFat : undefined;
        extra.leanMass = typeof personal.bodyFat === 'number' && typeof personal.weight === 'number' ? Math.round(personal.weight * (1 - personal.bodyFat/100)) : undefined;
        extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined;
        extra.sleepHours = typeof lifestyle.sleepHours === 'number' ? lifestyle.sleepHours : undefined;
        extra.stressLevel = typeof lifestyle.stressLevel === 'number' ? lifestyle.stressLevel : undefined;
        extra.calorieSurplus = typeof p.nutrition?.calorieSurplus === 'number' ? p.nutrition.calorieSurplus : undefined;
        extra.proteinPerKg = typeof p.nutrition?.proteinPerKg === 'number' ? p.nutrition.proteinPerKg : undefined;
        if(Array.isArray(ph.currentSubstances) && ph.currentSubstances.length) extra.peds = ph.currentSubstances;
        extra.labMrvMultiplier = typeof p.labs?.mrvMultiplier === 'number' ? p.labs.mrvMultiplier : undefined;
      }
    }catch{}
    const wcProtocol = weightCut>0 ? buildWeightCutProtocol(weightCut, { startWeightKg: bodyweight, waterMode, sodiumMode, carbMode, heatSessions } as any) : null;
    let input: CombatInput = {
      discipline, goal, level, weeks, daysPerWeek: days,
      weightCutKg: weightCut, weightCutProtocol: wcProtocol as any, methodology, dupMode, intensityTech,
      periodizationModel: periodizationModel as any, conditioningMode: conditioningMode as any,
      fightDate: fightDate || null, taperWeeks: fightDate ? taperWeeks : undefined, startDate,
      bodyweight, sex, age,
      workMax: workMax as any,
      acwr: acwr as any, velocityLossPct: velocityLoss>0? velocityLoss : null,
      outsideLoad: outsideEnabled ? outside : null,
      equipment, injuries, mobilityRestrictions: mobility as any,
      patternId: patternId || undefined,
      ...extra,
    } as any;
    try { const prev = loadCombatPlans()[0]; if (prev) input = applyCombatMesocycle(prev, input) as any; } catch {}
    let p = buildCombatPlan(input);
    p = finalizeCombatPlan(p);
    setPlan(p);
    saveCombatPlan(p);
    try { const hist = loadCombatPlans().slice(0,6); const ann = buildAnnualFromCB(hist); saveAnnualCB(ann); setAnnual(ann); } catch {}
    setMsg('План сохранён · модель ' + (periodizationModel||'atr_10') + (fightDate? ' · тапер к бою' : '') + (wcProtocol? ' · весогонка '+wcProtocol.targetLossKg+'кг':''));
    setStep('plan');
  };

  const updateEx = (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const wk = copy.weeksData[wkIdx];
      if (!wk) return prev;
      const sess = wk.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      if (patch.weight != null) { if (patch.weight<0||patch.weight>500) { setMsg('Вес 0-500'); return prev; } ex.weight = patch.weight; ex.workSets = ex.workSets.map(s=> ({...s, weight: patch.weight! })); }
      if (patch.reps != null) { ex.reps = patch.reps; const [a,b]= patch.reps.split('-').map(n=> parseInt(n,10)); const avg = Math.round(((a||5)+(b||a||5))/2); ex.workSets = ex.workSets.map(s=> ({...s, reps: avg })); }
      if (patch.rir != null) { if (patch.rir<0||patch.rir>5) { setMsg('RIR 0-5'); return prev; } ex.rir = patch.rir; ex.workSets = ex.workSets.map(s=> ({...s, rir: patch.rir! })); }
      saveCombatPlan(copy);
      return copy;
    });
  };
  const moveEx = (wkIdx: number, day: number, exId: string, dir: -1|1) => {
    setPlan(prev => {
      if (!prev) return prev;
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s=> s.day===day);
      if (!sess) return prev;
      const idx = sess.exercises.findIndex(e=> e.id===exId);
      if (idx<0) return prev;
      const nIdx = idx + dir;
      if (nIdx<0||nIdx>=sess.exercises.length) return prev;
      const tmp = sess.exercises[idx];
      sess.exercises[idx]=sess.exercises[nIdx];
      sess.exercises[nIdx]=tmp;
      saveCombatPlan(copy);
      return copy;
    });
  };
  const exportToUserProgram = () => {
    if (!plan) return;
    const prog: any = {
      id: plan.id,
      meta: { id: plan.id, title: `Единоборства ${plan.discipline} ${plan.weeks}нед`, direction: 'combat', createdAt: new Date().toISOString(), source: 'combat', discipline: plan.discipline, level: plan.level, methodology: plan.inputSnapshot?.methodology, dupMode: (plan.inputSnapshot as any)?.dupMode, intensityTech: (plan.inputSnapshot as any)?.intensityTech, periodizationModel: (plan.inputSnapshot as any)?.periodizationModel, fightDate: (plan.inputSnapshot as any)?.fightDate },
      weeks: plan.weeksData.map(w=> ({ week: w.week, phase: w.phase, deload: w.deload, taper: (w as any).taper, sessions: w.sessions.map(s=> ({ day: s.day, tag: s.sessionTag, character: s.character, exercises: s.exercises.map(e=> ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, rir: e.rir, tempo: e.tempo, restSeconds: e.restSeconds, technique: (e as any).technique, warmupSets: e.warmupSets, workSets: e.workSets })) })) })),
      outside: plan.outsideMetrics,
      conditioning: (plan as any).conditioning,
      validation: plan.validation,
    };
    try { saveUserProgram(prog); setMsg('Экспортировано в Библиотеку (he_user_programs) + he_last_combat_program'); } catch {}
    try { localStorage.setItem('he_last_combat_program', JSON.stringify(prog)); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog,null,2)); } catch {}
  };

  const handleBuildATR = () => {
    const ann = buildAnnualATR(discipline as any, annualWeeks, startDate || null);
    saveAnnualCB(ann); setAnnual(ann); setMsg(`Годовой ATR ${annualWeeks}нед построен: ${ann.blocks.map(b=> b.phase+' '+b.weeks).join(' → ')}`);
  };
  const handleAddCompetition = () => {
    if(!annual || !competitionName || !competitionDate) { setMsg('Укажите название и дату боя'); return; }
    const ann = loadAnnualCB();
    if(!ann) return;
    // import locally to avoid stale
    const { addCompetitionToAnnual: addComp } = require('../../../engines/combat/combat-annual');
    const next = addComp(ann, { id: `comp_${Date.now()}`, name: competitionName, date: competitionDate, weightClass: competitionWeight || undefined } as any);
    saveAnnualCB(next); setAnnual(next); setMsg('Бой добавлен в годовой: ' + competitionName);
    setCompetitionName(''); setCompetitionDate(''); setCompetitionWeight('');
  };
  const handlePrintAnnual = () => {
    if(!annual) return;
    const html = buildAnnualPrintHtml(annual);
    const w = window.open('', '_blank');
    if(w){ w.document.write(html); w.document.close(); w.print(); } else { navigator.clipboard?.writeText(html); setMsg('HTML скопирован'); }
  };
  const handleDownloadIcs = () => {
    if(!annual) return;
    const ics = buildAnnualIcs(annual, startDate || null);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`combat-annual-${annual.totalWeeks}w.ics`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, color: '#fff' }}>Единоборства — PRO силовая часть</h2>
      <div style={{ fontSize: 11, color: '#fff', opacity: 0.7 }}>Бокс / ММА / Борьба / Кик · ATR 5/3/2 · кондиция 3 системы · тапер к дате · весогонка ISSN · годовой</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['params','outside','split','plan'] as Step[]).map(s => (
          <button key={s} onClick={() => setStep(s)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: step===s ? '#a855f7' : 'rgba(255,255,255,0.06)', color: step===s ? '#fff' : '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>

      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ color: '#fff', fontSize: 11 }}>Дисциплина</label>
              <select value={discipline} onChange={e => setDiscipline(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
                <option value="boxing">Бокс — шея/кор/ротация</option>
                <option value="mma">ММА — шея/хват/тяга</option>
                <option value="wrestling">Борьба — шея/хват ×1.3</option>
                <option value="kickboxing">Кикбоксинг — ноги/ротация</option>
                <option value="general">Общая</option>
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ color: '#fff', fontSize: 11 }}>Цель зала</label>
              <select value={goal} onChange={e => setGoal(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
                <option value="power">Взрывная сила</option>
                <option value="endurance">Силовая выносливость</option>
                <option value="maintenance">Поддержание</option>
                <option value="camp">Кэмп к бою</option>
                <option value="weight_cut">Весогонка</option>
              </select>
            </div>
          </div>
          <label style={{ color: '#fff', fontSize: 12 }}>Уровень</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="beginner">Новичок</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Enhanced</option>
          </select>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Недель: {weeks} <input type="range" min={2} max={12} value={weeks} onChange={e => setWeeks(Number(e.target.value))} style={{ width:'100%' }} /></label>
            <label style={{ color: '#fff', fontSize: 11 }}>Дней/нед в зале: {days} <input type="range" min={2} max={4} value={days} onChange={e => setDays(Number(e.target.value))} style={{ width:'100%' }} /></label>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, background:'rgba(168,85,247,0.08)', padding:8, borderRadius:8, border:'1px solid rgba(168,85,247,0.18)' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ color: '#fff', fontSize: 11, fontWeight:700 }}>Периодизация</label>
              <select value={periodizationModel} onChange={e => setPeriodizationModel(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
                <option value="atr_10">ATR 5/3/2 (Issurin) — 10нед</option>
                <option value="linear_12">Linear 12</option>
                <option value="conjugate">Conjugate (short-notice)</option>
              </select>
              <div style={{ fontSize:9, color:'#fff', opacity:0.55 }}>ATR: 50% Accum (6-10/RIR2-3) → 30% Trans (3-6/RIR1-2) → 20% Real (RIR4). Conjugate: max/dynamic/repetition ротация.</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ color: '#fff', fontSize: 11, fontWeight:700 }}>Кондиция</label>
              <select value={conditioningMode} onChange={e => setConditioningMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
                <option value="auto">Авто (alactic+lactic+aerobic)</option>
                <option value="off">Выкл (только зал)</option>
                <option value="aerobic">Только aerobic Zone2</option>
              </select>
              <div style={{ fontSize:9, color:'#fff', opacity:0.55 }}>Alactic 8×10с/50с · Lactic 5×3мин · Aerobic 40′ Zone2. При внезал ≥5× — авто 0.</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, background:'rgba(255,255,255,0.03)', padding:8, borderRadius:8 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Дата боя (тапер): <input type="date" value={fightDate} onChange={e=> setFightDate(e.target.value)} style={{ padding: 4, borderRadius: 6, fontSize: 11, width:'100%' }} /></label>
            <label style={{ color: '#fff', fontSize: 11 }}>Тапер: <select value={taperWeeks} onChange={e=> setTaperWeeks(Number(e.target.value))} style={{ padding: 6, borderRadius: 6, width:'100%' }}><option value={1}>1 нед (−45%)</option><option value={2}>2 нед (−35%→−55%)</option></select></label>
            <label style={{ color: '#fff', fontSize: 11 }}>Старт плана: <input type="date" value={startDate} onChange={e=> setStartDate(e.target.value)} style={{ padding: 4, borderRadius: 6, fontSize: 11, width:'100%' }} /></label>
            <div style={{ fontSize:9, color:'#fff', opacity:0.6, alignSelf:'center' }}>Тапер Bosquet: объём 0.65→0.45, интенсивность 90-95%, спарринг ↓ + сауна 15-20′×3</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Пол: <select value={sex} onChange={e=> setSex(e.target.value as any)} style={{ padding: 4, borderRadius: 6, width:'100%' }}><option value="male">М</option><option value="female">Ж</option></select></label>
            <label style={{ color: '#fff', fontSize: 11 }}>Вес тела: <input type="number" value={bodyweight} onChange={e=> setBodyweight(Number(e.target.value)||80)} style={{ width:'100%', padding: 4, borderRadius: 6 }} /> кг</label>
            <label style={{ color: '#fff', fontSize: 11 }}>Возраст: <input type="number" value={age} onChange={e=> setAge(Number(e.target.value)||28)} style={{ width:'100%', padding: 4, borderRadius: 6 }} /></label>
          </div>
          {acwr && <div style={{ fontSize: 10, color: acwr.zone==='dangerous'?'#ef4444': acwr.zone==='caution'?'#eab308':'#a855f7', background:'rgba(255,255,255,0.04)', padding:6, borderRadius:6 }}>ACWR {acwr.ratio} · {acwr.zone} {acwr.zone==='dangerous'?'— объём ×0.60,RIR+2': acwr.zone==='caution'?'— ×0.85,RIR+1': acwr.zone==='undertrained'?'— добавить объём':''} · дневник sRPE 28д</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>VBT потеря: {velocityLoss}% <input type="range" min={0} max={40} value={velocityLoss} onChange={e=> setVelocityLoss(Number(e.target.value))} style={{ width:'100%' }} /></label>
            <div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Vitruve: &gt;20% → RIR+1, &gt;30% → стоп сет. Влив в бюджет ×{velocityLoss>20?0.9:1}</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {(['bench','squat','deadlift','chest','back','shoulders','quads'] as const).map(k => (
              <label key={k} style={{ color: '#fff', fontSize: 11 }}>{k}: <input type="number" value={(workMax as any)[k] || 0} onChange={e=> setWorkMax(s=> ({...s, [k]: Number(e.target.value)||0}))} style={{ width:'100%', padding:4, borderRadius:6 }} /></label>
            ))}
          </div>
          <div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>WorkMax: точные веса по упражнениям тянутся из профиля (he_profile_v2). Пусто → BW×коэфф. Шаг 2.5кг (шея 0.5кг).</div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Методика порядка
              <select value={methodology} onChange={e => setMethodology(e.target.value as any)} style={{ padding: 6, borderRadius: 6, width:'100%', marginTop:2 }}>
                <option value="compound_first">База первой</option>
                <option value="pre_exhaust">Предутомление</option>
                <option value="post_exhaust">Постутомление</option>
              </select>
            </label>
            <label style={{ color: '#fff', fontSize: 11 }}>DUP волны
              <select value={dupMode} onChange={e => setDupMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6, width:'100%', marginTop:2 }}>
                <option value="off">Выкл</option>
                <option value="power_endurance">Сила/выносливость</option>
                <option value="heavy_light">Тяж/лёг волна</option>
                <option value="conjugate">Conjugate</option>
              </select>
            </label>
          </div>
          <label style={{ color: '#fff', fontSize: 11 }}>Интенс-техника
            <select value={intensityTech} onChange={e => setIntensityTech(e.target.value as any)} style={{ padding: 6, borderRadius: 6, width:'100%' }}>
              <option value="none">Нет</option>
              <option value="rest_pause">Rest-pause (аксесс.)</option>
              <option value="myo_reps">Myo-reps (хват)</option>
              <option value="cluster">Cluster 3×3/20с (база)</option>
              <option value="contrast">Contrast тяж+плио (power)</option>
            </select>
          </label>

          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:8, display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ color: '#fff', fontSize: 11, fontWeight:700 }}>Весогонка ISSN 2025</label>
            <label style={{ color: '#fff', fontSize: 11 }}>Сгонка кг (0 = нет): {weightCut} <input type="range" min={0} max={8} step={0.5} value={weightCut} onChange={e => { const v=Number(e.target.value); setWeightCut(v); if(v>=3) setHeatSessions(true); if(v>=4) setWaterMode('load_cut'); if(v>=3) setSodiumMode('moderate_cut'); if(v>=5) setCarbMode('deplete_reload'); }} style={{ width:'100%' }} /></label>
            {weightCut>0 && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                  <label style={{ color: '#fff', fontSize: 10 }}>Вода: <select value={waterMode} onChange={e=> setWaterMode(e.target.value as any)} style={{ padding:4, borderRadius:6, width:'100%' }}><option value="stable">Стабильно 35мл/кг</option><option value="load_cut">Load 8л → 2л</option></select></label>
                  <label style={{ color: '#fff', fontSize: 10 }}>Na: <select value={sodiumMode} onChange={e=> setSodiumMode(e.target.value as any)} style={{ padding:4, borderRadius:6, width:'100%' }}><option value="stable">Стабильно 5г</option><option value="moderate_cut">5→3→1.5г</option></select></label>
                  <label style={{ color: '#fff', fontSize: 10 }}>Угли: <select value={carbMode} onChange={e=> setCarbMode(e.target.value as any)} style={{ padding:4, borderRadius:6, width:'100%' }}><option value="stable">Стабильно 4-5г/кг</option><option value="deplete_reload">1г → 8г рефид</option></select></label>
                </div>
                <label style={{ color: '#fff', fontSize: 10, display:'flex', gap:6, alignItems:'center' }}><input type="checkbox" checked={heatSessions} onChange={e=> setHeatSessions(e.target.checked)} /> Сауна 15-20′×3/нед (heat acclimation) — компенсация ↓ объёма</label>
                <div style={{ fontSize:9, color:'#f59e0b' }}>Регидрейшн после взвешивания: 125-150% от сгонки ({(weightCut*1.25).toFixed(1)}-{(weightCut*1.5).toFixed(1)}л) + Na 1г/кг + угли 8г/кг за 12-24ч, контроль ЖКТ!</div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
            <label style={{ color: '#fff', fontSize: 11 }}>Оборудование</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['barbell','dumbbell','machine','cable','other'].map(eq => (
                <label key={eq} style={{ color: '#fff', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" checked={equipment.includes(eq)} onChange={e => setEquipment(s => e.target.checked ? [...s, eq] : s.filter(x=>x!==eq))} /> {eq}
                </label>
              ))}
            </div>
            <label style={{ color: '#fff', fontSize: 11 }}>Щадящие травмы (neck/knee/shoulder/wrist/back/ankle, через запятую)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={injInput} onChange={e=> setInjInput(e.target.value)} placeholder="neck, wrist, knee" style={{ flex: 1, padding: 4, borderRadius: 6, fontSize: 11 }} />
              <button onClick={() => { const parts = injInput.split(',').map(s=> s.trim()).filter(Boolean); setInjuries(parts.map(p=> ({ location: p, type: 'joint' }))); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: '#a855f7', color: '#fff', cursor: 'pointer' }}>Применить</button>
            </div>
            {injuries.length>0 && <div style={{ fontSize: 10, color: '#f59e0b' }}>Щадящий: {injuries.map((j:any)=> j.location).join(', ')} — вес ×0.6-0.7, +RIR, фильтр 풀</div>}
            <label style={{ color: '#fff', fontSize: 11 }}>Мобильность (ограничения)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['shoulder','hip','knee','ankle','wrist','neck','lower_back'].map(m => (
                <label key={m} style={{ color: '#fff', fontSize: 10, display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input type="checkbox" checked={mobility.includes(m)} onChange={e => setMobility(s => e.target.checked ? [...s, m] : s.filter(x=> x!==m))} /> {m}
                </label>
              ))}
            </div>
          </div>
          <button onClick={pullFromProfile} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Подтянуть из профиля (workMax/вес/травмы/ACWR)</button>
          <button onClick={() => setStep('outside')} style={{ padding: '8px 12px', borderRadius: 8, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Далее → Вне зала</button>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} /> Учитывать вне зала (ринг/татами)
          </label>
          {outsideEnabled && outside && (
            <>
              <label style={{ color: '#fff', fontSize: 11 }}>Сессий/нед вне зала: {outside.sessionsPerWeek}</label>
              <input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>Длительность мин: {outside.avgDurationMin}</label>
              <input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>RPE: {outside.avgSRPE}</label>
              <input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} />
              <div style={{ fontSize: 11, color: '#a855f7' }}>{outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier} (${outsideMetrics.interference})` : ''}</div>
              <div style={{ fontSize: 9, color: '#fff', opacity: 0.6 }}>Тяж ноги не ставим за день до high внезальной. При внезал ≥5× — кондиция зала авто 0, бюджет ×{outsideMetrics?.volumeMultiplier ?? 1}.</div>
            </>
          )}
          <button onClick={() => setStep('split')} style={{ padding: '8px 12px', borderRadius: 8, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Далее → Сплит</button>
        </div>
      )}

      {step === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <div style={{ color: '#fff', fontSize: 11, background:'rgba(168,85,247,0.1)', padding:6, borderRadius:6 }}>Рекомендуемый: <b style={{ color:'#a855f7' }}>{recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).name}</b> {patternId ? `· выбран: ${COMBAT_PATTERNS.find(p=>p.id===patternId)?.name || patternId}` : '· авто'} · модель <b>{periodizationModel}</b></div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {COMBAT_PATTERNS.map(p => {
              const active = patternId ? patternId===p.id : p.id===recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).id;
              const preview = p.schedule.map((s)=> s.kind==='тренировка' ? (s.sessionTag||'тренировка').slice(0,4) : 'отд').join(' · ');
              return (
                <button key={p.id} onClick={()=> setPatternId(p.id)} style={{ textAlign: 'left', padding: 8, borderRadius: 8, background: active ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)', border: active ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>{p.name}</b><span style={{ fontSize: 10, opacity: 0.7 }}>{p.sessionsPerRotation}×/нед</span></div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{p.description}</div>
                  <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, fontFamily: 'monospace' }}>{preview}</div>
                  {active && <div style={{ fontSize: 9, color: '#a855f7', marginTop: 2 }}>● выбран — предпросмотр: {p.schedule.filter(s=>s.kind==='тренировка').map(s=> s.sessionTag).join(', ')}</div>}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>ATR 5/3/2: 10нед → 5 Accum (6-10rep/RIR2-3) → 3 Trans (3-6/RIR1-2) → 2 Real (taper). Conjugate — ротация max/dynamic/repetition. Linear — gpp/power/taper.</div>
          <button onClick={build} style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Собрать PRO-план {patternId ? `(${patternId})` : ''} · {periodizationModel}</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(168,85,247,0.12)', padding: 10, borderRadius: 10, color: '#fff', fontSize: 11, whiteSpace: 'pre-wrap' }}>{buildCombatReport(plan)}</div>
          {plan.validation?.warnings.map((w,i) => <div key={i} style={{ color: '#f59e0b', fontSize: 11 }}>⚠ {w}</div>)}
          {(plan as any).conditioning && (
            <div style={{ background:'rgba(59,130,246,0.08)', padding:8, borderRadius:8, border:'1px solid rgba(59,130,246,0.18)' }}>
              <div style={{ color:'#60a5fa', fontWeight:700, fontSize:11, marginBottom:4 }}>Кондиция (3 системы) — вне зала {outside?.sessionsPerWeek ?? 0}× ({outsideMetrics?.volumeMultiplier ?? 1}×)</div>
              {(plan as any).conditioning.sessions.map((week:any[], wi:number)=> (
                <div key={wi} style={{ fontSize:10, color:'#fff', marginTop:4 }}><b>Нед {wi+1} {plan.weeksData[wi]?.phase}:</b> {week.length? week.map((s:any)=> `${s.modality} ${s.durationMin}′ ${s.intervals||''}`).join(' | ') : '— внезал покрывает'}</div>
              ))}
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Quality heatmap (сеты/нед vs MEV/MRV):</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {plan.weeksData.map(wk => {
                const neck = wk.sessions.reduce((s, sess)=> s + sess.exercises.filter(e=> e.id.includes('neck')).reduce((a,e)=> a+e.sets,0),0);
                const lm = getCombat(plan.level,'neck'); const st = lm ? (neck<lm.mev?'below': neck<=lm.mav?'optimal': neck<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#a855f7': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week} {wk.phase}: шея {neck}{wk.deload?' делод': (wk as any).taper?' taper':''}</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {plan.weeksData.map(wk => {
                const grip = wk.sessions.reduce((s, sess)=> s + sess.exercises.filter(e=> e.id.includes('grip')||e.id.includes('pinch')||e.id.includes('wrist')||e.id.includes('farmer')||e.id.includes('towel')).reduce((a,e)=> a+e.sets,0),0);
                const lm = getCombat(plan.level,'grip'); const st = lm ? (grip<lm.mev?'below': grip<=lm.mav?'optimal': grip<=lm.mrv?'high':'over') : 'optimal';
                const col = st==='below'?'#f59e0b': st==='optimal'?'#a855f7': st==='high'?'#eab308':'#ef4444';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: хват {grip}</span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {plan.weeksData.map(wk => {
                const core = wk.sessions.reduce((s, sess)=> s + sess.exercises.filter(e=> ['deadbug','hollow_hold','side_plank','ab_wheel','copenhagen_plank','pallof_rotation_press','suitcase_carry','landmine_rotation'].includes(e.id)).reduce((a,e)=> a+e.sets,0),0);
                const col = core<4?'#f59e0b': core<=10?'#a855f7':'#eab308';
                return <span key={wk.week} style={{ padding: '2px 6px', borderRadius: 6, background: col+'22', border: `1px solid ${col}`, color: col, fontSize: 10 }}>Н{wk.week}: core {core}</span>;
              })}
            </div>
          </div>
          {diaryLoad != null && (
            <div style={{ background: diaryLoad > 30 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 6, border: `1px solid ${diaryLoad > 30 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, color: diaryLoad > 30 ? '#f59e0b' : '#fff', fontSize: 10 }}>
              Дневник (изолированно): нагрузка 7д ≈ {diaryLoad}{diaryLoad > 30 ? ' — высоко, рассмотрите лёгкую неделю' : ' — норма'} {acwr? `· ACWR ${acwr.ratio} ${acwr.zone}`:''}
            </div>
          )}
          {plan.weeksData.map(wk => (
            <div key={wk.week} style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8, border: wk.deload? '1px solid rgba(245,158,11,0.35)': (wk as any).taper?'1px solid rgba(59,130,246,0.35)' : '1px solid transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: wk.deload? '#f59e0b' : (wk as any).taper? '#60a5fa' : '#a855f7', fontWeight: 700, fontSize: 12 }}>Неделя {wk.week} · {wk.phase}{wk.deload ? ' · делод' : (wk as any).taper? ' · тапер':''} · {wk.totalSets} сетов{(wk as any).totalTonnage? ` · ${((wk as any).totalTonnage/1000).toFixed(1)}т`:''}</span>
                <button onClick={() => {
                  const txt = wk.sessions.map(s=> `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e=> `  ${e.name} ${e.sets}x${e.reps} ${e.weight?e.weight+'кг':''} RIR${e.rir} ${e.tempo} отдых${e.restSeconds}с${e.comment? ' // '+e.comment:''}`).join('\n')).join('\n\n');
                  navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n`+txt); setMsg(`Неделя ${wk.week} скопирована`);
                }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Копировать неделю</button>
              </div>
              {wk.sessions.map(sess => (
                <div key={sess.day} style={{ marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{sess.sessionTag} · {sess.character} · день {sess.day} · {sess.durationMin} мин</span>
                    <span style={{ color: '#fff', fontSize: 10, opacity: 0.5 }}>⏱ {sess.exercises.reduce((a,e)=>a+ e.workSets.length* (e.restSeconds||75),0)/60 |0} мин отдыха</span>
                  </div>
                  {sess.exercises.map(ex => (
                    <div key={ex.id} style={{ color: '#fff', fontSize: 11, marginLeft: 6, marginTop: 4, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{ex.name} — {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}кг` : ''} RIR{ex.rir} · {ex.tempo} · отдых {ex.restSeconds}с{ex.comment?.includes('Тапер')?' 🔵': ex.comment?.includes('Весогонка')?' 🟠':''}</span>
                        <input aria-label="вес" type="number" value={ex.weight} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { weight: Number(e.target.value)||0 })} style={{ width: 58, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="повторы" type="text" value={ex.reps} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { reps: e.target.value })} style={{ width: 54, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e=> updateEx(wk.week-1, sess.day, ex.id, { rir: Number(e.target.value)||0 })} style={{ width: 44, padding: '2px 4px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <button aria-label="вверх" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, -1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↑</button>
                        <button aria-label="вниз" onClick={()=> moveEx(wk.week-1, sess.day, ex.id, 1)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>↓</button>
                      </div>
                      {ex.comment && <div style={{ fontSize: 10, opacity: 0.7, marginLeft: 4, borderLeft: '2px solid rgba(168,85,247,0.3)', paddingLeft: 6 }}>{ex.comment}</div>}
                      {ex.warmupSets && ex.warmupSets.length>0 && <div style={{ fontSize: 10, opacity: 0.5 }}>Разминка: {ex.warmupSets.map(s=> `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                      <div style={{ fontSize: 10, opacity: 0.45 }}>Сеты: {ex.workSets.map(s=> `${s.reps}×${s.weight? s.weight+'кг' : '—'} RIR${s.rir}`).join(' | ')}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <div style={{ background:'rgba(255,255,255,0.03)', padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>Годовой план ATR {annual? `${annual.totalWeeks}нед · ${annual.blocks.length} блоков` : '—'} {annual?.discipline? `· ${annual.discipline}`:''}</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                <button onClick={handleBuildATR} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, background:'rgba(168,85,247,0.15)', color:'#a855f7', border:'1px solid rgba(168,85,247,0.3)', cursor:'pointer' }}>Построить годовой ATR {annualWeeks}нед</button>
                <select value={annualWeeks} onChange={e=> setAnnualWeeks(Number(e.target.value))} style={{ padding:4, borderRadius:6, fontSize:10 }}>
                  <option value={12}>12 нед</option><option value={24}>24 нед</option><option value={36}>36 нед</option><option value={52}>52 нед</option>
                </select>
              </div>
            </div>
            {annual && (
              <>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {annual.blocks.map(b => <span key={b.id} title={b.phase} style={{ padding: '2px 6px', borderRadius: 6, background: b.phase==='accumulation'?'rgba(59,130,246,0.15)': b.phase==='transmutation'?'rgba(168,85,247,0.15)': b.phase==='realization'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)', border: `1px solid ${b.phase==='accumulation'?'rgba(59,130,246,0.3)': b.phase==='transmutation'?'rgba(168,85,247,0.3)': b.phase==='realization'?'rgba(239,68,68,0.3)':'rgba(245,158,11,0.3)'}`, color: b.phase==='accumulation'?'#60a5fa': b.phase==='transmutation'?'#a855f7': b.phase==='realization'?'#ef4444':'#f59e0b', fontSize: 10 }}>Нед {b.startWeek}-{b.startWeek+b.weeks-1}: {b.phase} {b.discipline} ×{b.weeks}{b.fightDate?' 🏁':''}</span>)}
                </div>
                <div style={{ display:'flex', height:14, borderRadius:6, overflow:'hidden', marginTop:6, border:'1px solid rgba(255,255,255,0.08)' }}>
                  {annual.blocks.map(b=> {
                    const w = (b.weeks/annual.totalWeeks*100).toFixed(1);
                    const col = b.phase==='accumulation'?'#3b82f6': b.phase==='transmutation'?'#a855f7': b.phase==='realization'?'#ef4444':'#f59e0b';
                    return <div key={b.id} title={`${b.phase} ${b.weeks}нед`} style={{ width: `${w}%`, background: col, opacity: 0.9, borderRight: '1px solid rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700 }}>{b.weeks}</div>;
                  })}
                </div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2, display:'flex', justifyContent:'space-between' }}><span>Нед 1 {startDate}</span><span>Нед {annual.totalWeeks}</span></div>
                {annual.competitions.length>0 && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:10, color:'#fff', fontWeight:700 }}>Бои ({annual.competitions.length}):</div>
                    {annual.competitions.map(c=> <div key={c.id} style={{ fontSize:10, color:'#fff', opacity:0.8 }}>🏁 {c.name} — {c.date} {c.weightClass? `(${c.weightClass})`:''}</div>)}
                  </div>
                )}
                <div style={{ display:'flex', gap:4, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                  <input placeholder="Название боя" value={competitionName} onChange={e=> setCompetitionName(e.target.value)} style={{ flex:1, minWidth:120, padding:4, borderRadius:6, fontSize:10 }} />
                  <input type="date" value={competitionDate} onChange={e=> setCompetitionDate(e.target.value)} style={{ padding:4, borderRadius:6, fontSize:10 }} />
                  <input placeholder="Вес.кат." value={competitionWeight} onChange={e=> setCompetitionWeight(e.target.value)} style={{ width:90, padding:4, borderRadius:6, fontSize:10 }} />
                  <button onClick={handleAddCompetition} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, background:'#ef4444', color:'#fff', cursor:'pointer' }}>+ Бой</button>
                </div>
                <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                  <button onClick={handlePrintAnnual} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, background:'rgba(255,255,255,0.08)', color:'#fff', cursor:'pointer' }}>🖨 Печать года</button>
                  <button onClick={handleDownloadIcs} style={{ padding:'4px 8px', borderRadius:6, fontSize:10, background:'rgba(255,255,255,0.08)', color:'#fff', cursor:'pointer' }}>📅 .ics календарь</button>
                </div>
              </>
            )}
            {!annual && <div style={{ fontSize:10, color:'#fff', opacity:0.5, marginTop:6 }}>Годовой строится из журнала планов или кнопкой «Построить годовой ATR». Соревнования → тапер автоматом.</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => { const txt = buildCombatReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Копировать отчёт</button>
            <button onClick={() => { const txt = buildCombatReport(plan); const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${txt.replace(/</g,'&lt;')}</pre>`); w.document.close(); w.print(); } }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Печать</button>
            <button onClick={exportToUserProgram} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer' }}>Экспорт в программу</button>
            <button onClick={()=> { const s = (plan as any).conditioning; if(s) { navigator.clipboard?.writeText(JSON.stringify(s,null,2)); setMsg('Кондиция скопирована'); }}} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(59,130,246,0.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.22)', cursor:'pointer' }}>Кондиция JSON</button>
          </div>
          {msg && <div style={{ color: '#a855f7', fontSize: 11 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
};
