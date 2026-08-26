/** MetabolicHub.tsx — единый хаб Метаболики (5 в 1) без дублей.
 *  Вода · Шаги · КБЖУ · Жир · Кортизол — один снапшот, переключатель Натурал/ААС, белый текст, стекло.
 *  Pro: cm→in фикс, PAL без дубля, дозозависимый ААС, HPA-индекс, live-профиль, валидация, графики.
 *  Канон — Питание, алиас — Тренировки/Интеллект (один файл, без дубля).
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, type MetabolicInput } from '../../../engines/metabolic-hub.engine';
import { getProfile } from '../../../core/profile-manager';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { ModernHero } from '../NutritionScreen_parts/nutrition-modern-kit';

const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;

type Mode = 'water'|'steps'|'kbju'|'fat'|'cortisol';
const MODE_DEFS: Array<{m:Mode; label:string; icon:string; desc:string; accent:string; hint:string}> = [
  {m:'water', label:'Вода', icon:'💧', desc:'Суточная норма', accent:'#38bdf8', hint:'EFSA lean40/жир20 + пот 600мл/ч · ААС дозозависимо'},
  {m:'steps', label:'Шаги', icon:'👟', desc:'Бытовая активность', accent:'#22c55e', hint:'PAL 1.40-1.75 + train/cardio → TDEE'},
  {m:'kbju', label:'КБЖУ', icon:'🍽', desc:'Калории и макро', accent:'#f59e0b', hint:'Helms/ISSN + потолок 5г/кг У'},
  {m:'fat', label:'Жир', icon:'🧬', desc:'% жира, FFMI', accent:'#a78bfa', hint:'Navy см→in + FFMI_norm'},
  {m:'cortisol', label:'HPA', icon:'🧠', desc:'Индекс перегруза', accent:'#f43f5e', hint:'Стресс/сон/ACWR → 0-100'},
];

const SNAP_KEY = 'he_metabolic_snapshot_v2';
const SNAP_KEY_LEGACY = 'he_metabolic_snapshot_v1';

function Bar({v, max, color, label}:{v:number; max:number; color:string; label?:string}){
  const pct = Math.max(4, Math.min(100, Math.round(v/max*100)));
  return (<div style={{ flex:1 }}>
    {label && <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginBottom:3, textTransform:'uppercase', letterSpacing:0.3 }}>{label}</div>}
    <div style={{ height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background: color, borderRadius:20, transition:'width 0.35s ease' }} />
    </div>
  </div>);
}

export const MetabolicHub: React.FC = () => {
  const [mode, setMode] = useState<Mode>('water');
  const [onAAS, setOnAAS] = useState(false);
  const [aasDose, setAasDose] = useState(500);
  const [sex, setSex] = useState<'male'|'female'>('male');
  const [weight, setWeight] = useState(83);
  const [height, setHeight] = useState(180);
  const [age, setAge] = useState(30);
  const [bodyFat, setBodyFat] = useState(15);
  const [neck, setNeck] = useState(39);
  const [waist, setWaist] = useState(84);
  const [hip, setHip] = useState(96);
  const [steps, setSteps] = useState(7000);
  const [cardioMin, setCardioMin] = useState(90);
  const [trainingDays, setTrainingDays] = useState(4);
  const [activityLevel, setActivityLevel] = useState<'low'|'medium'|'high'>('medium');
  const [goal, setGoal] = useState<'cut'|'maintain'|'bulk'>('maintain');
  const [stress, setStress] = useState(5);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [climate, setClimate] = useState<'temperate'|'hot'|'cold'>('temperate');
  const [toast, setToast] = useState<string|null>(null);
  const showToast = useCallback((m:string)=>{ setToast(m); setTimeout(()=> setToast(null), 2400); }, []);

  // ACWR live — слушаем srpe-store + polling
  const [acwr, setAcwr] = useState(1);
  const refreshAcwr = useCallback(()=>{
    try{ const s=loadSRPESessions(); const r = s.length>=2 ? acuteChronicRatio(toDailyLoads(s as any)).ratio : 1; setAcwr(r); }catch{ setAcwr(1); }
  }, []);
  useEffect(()=>{
    refreshAcwr();
    const id = setInterval(refreshAcwr, 8000);
    const onStorage = (e: StorageEvent)=>{ if(e.key && e.key.includes('srpe')) refreshAcwr(); };
    const onFocus = ()=> refreshAcwr();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return ()=>{ clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); };
  }, [refreshAcwr]);

  // init from snapshot v2 → v1 → profile v2 (расширенный)
  useEffect(()=>{
    let loaded=false;
    try{
      const raw = localStorage.getItem(SNAP_KEY) || localStorage.getItem(SNAP_KEY_LEGACY);
      if(raw){
        const s=JSON.parse(raw);
        if(typeof s.weight==='number') setWeight(s.weight);
        if(typeof s.height==='number') setHeight(s.height);
        if(typeof s.age==='number') setAge(s.age);
        if(s.sex) setSex(s.sex);
        if(typeof s.bodyFat==='number') setBodyFat(s.bodyFat);
        if(typeof s.neck==='number') setNeck(s.neck);
        if(typeof s.waist==='number') setWaist(s.waist);
        if(typeof s.hip==='number') setHip(s.hip);
        if(typeof s.steps==='number') setSteps(s.steps);
        if(typeof s.cardioMin==='number') setCardioMin(s.cardioMin);
        if(typeof s.trainingDays==='number') setTrainingDays(s.trainingDays);
        if(s.activityLevel) setActivityLevel(s.activityLevel);
        if(s.goal) setGoal(s.goal);
        if(typeof s.stress==='number') setStress(s.stress);
        if(typeof s.sleepHours==='number') setSleepHours(s.sleepHours);
        if(typeof s.sleepQuality==='number') setSleepQuality(s.sleepQuality);
        if(typeof s.onAAS==='boolean') setOnAAS(s.onAAS);
        if(typeof s.aasDose==='number') setAasDose(s.aasDose);
        if(s.climate) setClimate(s.climate);
        loaded=true;
      }
    }catch{}
    if(loaded) return;
    try{
      const p:any = getProfile()?.settings || {};
      const pers = p.personal || {};
      const life = p.lifestyle || {};
      const train = p.training || {};
      if(pers.weight) setWeight(Number(pers.weight));
      if(pers.height) setHeight(Number(pers.height));
      if(pers.age) setAge(Number(pers.age));
      if(pers.sex) setSex(pers.sex==='female'?'female':'male');
      if(pers.bodyFat) setBodyFat(Number(pers.bodyFat));
      if(pers.neckCm) setNeck(Number(pers.neckCm));
      if(pers.waistCm) setWaist(Number(pers.waistCm));
      if(pers.hipCm) setHip(Number(pers.hipCm));
      if(life.dailySteps) setSteps(Number(life.dailySteps));
      if(life.activityLevel) {
        const al = Number(life.activityLevel);
        setActivityLevel(al>=7?'high': al>=4?'medium':'low');
      }
      if(train.daysPerWeek) setTrainingDays(Number(train.daysPerWeek));
      if(typeof life.sleepHours==='number') setSleepHours(Number(life.sleepHours));
      if(typeof life.stressLevel==='number') setStress(Math.round(Number(life.stressLevel)));
      const sleepQMap:Record<string,number>={good:4, fair:3, poor:2};
      if(life.sleepQuality && sleepQMap[life.sleepQuality]) setSleepQuality(sleepQMap[life.sleepQuality]);
    }catch{}
  },[]);
  useEffect(()=>{
    try{ localStorage.setItem(SNAP_KEY, JSON.stringify({weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,stress,sleepHours,sleepQuality,onAAS,aasDose,climate})); }catch{}
  }, [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,stress,sleepHours,sleepQuality,onAAS,aasDose,climate]);

  const input: MetabolicInput = useMemo(()=> ({ weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,trainingHours: trainingDays*1.15, activityLevel, goal, onAAS, aasDose, stress, sleepHours, sleepQuality, acwr, climate }), [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,onAAS,aasDose,stress,sleepHours,sleepQuality,acwr,climate]);

  const water = useMemo(()=> calcWater(input), [input]);
  const stepsCalc = useMemo(()=> calcSteps(input), [input]);
  const kbju = useMemo(()=> calcKBJU(input), [input]);
  const fat = useMemo(()=> calcBodyFat(input), [input]);
  const cortisol = useMemo(()=> calcCortisol(input), [input]);

  const active = MODE_DEFS.find(d=> d.m===mode)!;
  const waistErr = waist && neck && waist <= neck ? 'Талия ≤ шеи — Navy невалиден' : null;
  const hipWarn = sex==='female' && (!hip || hip<80) ? 'Для женщин нужен обхват бёдер' : null;

  const applyKBJU = ()=>{
    try{
      const tgt = onAAS ? kbju.aas : kbju.nat;
      const payload = { kcal: tgt.kcal, p: tgt.p, f: tgt.f, c: tgt.c, protPerKg: tgt.protPerKg, pal: tgt.pal, bmr: tgt.bmr, ts: Date.now(), source: 'metabolic-hub' };
      localStorage.setItem('he_planner_kbju_suggestion', JSON.stringify(payload));
      // также в профиль nutrition.manualTargets для автоподхвата (если ручной режим)
      try{
        const p = getProfile();
        const curNut:any = p.settings?.nutrition || {};
        // не перезаписываем без спроса, только подсказка
        localStorage.setItem('he_metabolic_last_kbju', JSON.stringify(payload));
        void curNut;
      }catch{}
      window.dispatchEvent(new CustomEvent('he-kbju-suggestion', { detail: payload }));
      const txt = `КБЖУ ${tgt.kcal}ккал Б${tgt.p} Ж${tgt.f} У${tgt.c} → скопировано. Вставь в Планировщике (КБЖУ → Ручной).`;
      if(navigator.clipboard) navigator.clipboard.writeText(`${tgt.kcal} ${tgt.p} ${tgt.f} ${tgt.c}`).catch(()=>{});
      showToast(txt);
    }catch{ showToast('Сохранено в he_planner_kbju_suggestion'); }
  };

  return (
    <div style={{ padding:'10px 8px 18px', color:'#fff', maxWidth:780, margin:'0 auto' }}>
      {toast && <div style={{ position:'fixed', left:'50%', bottom:18, transform:'translateX(-50%)', zIndex:60, maxWidth:520, padding:'10px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.10)', boxShadow:'0 8px 24px rgba(0,0,0,0.35)', fontSize:11, fontWeight:600, color:'#fff', textAlign:'center' }}>{toast}</div>}
      <ModernHero icon="⚖️" title="Метаболика" subtitle="TDEE · NEAT · КБЖУ · Navy · HPA — один снапшот, без дубля. Источники: EFSA, Mifflin/Katch, Helms/ISSN, Navy, Gabbett." />
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(96,165,250,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(96,165,250,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(96,165,250,0.14),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#60a5fa,#00e68a)', color:'#000', fontWeight:900, fontSize:16 }}>⚖️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Метаболика — Вода · Шаги · КБЖУ · Жир · HPA</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Один снапшот → 5 движков. PAL без дубля, Navy см→in, ААС дозозависимо, ACWR live {acwr.toFixed(2)}.</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${onAAS ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.22)'}`, color: onAAS ? '#f87171' : '#22c55e', fontWeight:800, whiteSpace:'nowrap' }}>{onAAS ? `💉 ${aasDose}мг/нед` : '🌿 Натурал'}</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.5 }}>
          <b style={{ color:'#fff' }}>Формулы:</b> <span style={{ color:'#38bdf8' }}>вода</span> EFSA 35мл/кг (lean 40/жир 20) + пот, <span style={{ color:'#22c55e' }}>шаги</span> PAL 1.40/1.55/1.75+train/cardio → TDEE, <span style={{ color:'#f59e0b' }}>КБЖУ</span> Helms/ISSN + потолок 5г/кг У, <span style={{ color:'#a78bfa' }}>жир</span> Navy (дюймы) + FFMI_norm Kouri, <span style={{ color:'#f43f5e' }}>HPA</span> 0-100 (стресс/сон/ACWR).
        </div>
      </div>

      {/* Переключатель ААС */}
      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ display:'flex', gap:6, marginBottom: onAAS?8:0 }}>
          <button onClick={()=> setOnAAS(false)} style={{ flex:1, minHeight:36, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800, border: !onAAS ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', background: !onAAS ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.02)', color: !onAAS ? '#22c55e' : '#fff' }}>🌿 Без ААС</button>
          <button onClick={()=> setOnAAS(true)} style={{ flex:1, minHeight:36, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800, border: onAAS ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.02)', color: onAAS ? '#f87171' : '#fff' }}>💉 С ААС</button>
        </div>
        {onAAS && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <PopupNumber label="Доза ААС, мг/нед (тест-экв)" value={aasDose} min={0} max={2000} onChange={setAasDose} />
            <PopupSelect label="Климат" value={climate} options={[{id:'temperate',label:'Умеренный'},{id:'hot',label:'Жара'},{id:'cold',label:'Холод'}]} onChange={v=> setClimate(v as any)} />
          </div>
        )}
        {!onAAS && (
          <div style={{ marginTop:8 }}>
            <PopupSelect label="Климат" value={climate} options={[{id:'temperate',label:'Умеренный'},{id:'hot',label:'Жара +600мл'},{id:'cold',label:'Холод −150мл'}]} onChange={v=> setClimate(v as any)} />
          </div>
        )}
      </div>

      {/* Ввод — группы */}
      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Антропометрия и цель</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Вес, кг" value={weight} min={30} max={200} onChange={setWeight} />
          <PopupNumber label="Рост, см" value={height} min={140} max={220} onChange={setHeight} />
          <PopupNumber label="Возраст" value={age} min={14} max={80} onChange={setAge} />
          <PopupSelect label="Пол" value={sex} options={[{id:'male',label:'♂ Мужчина'},{id:'female',label:'♀ Женщина'}]} onChange={v=> setSex(v as any)} />
          <PopupNumber label="Жир, % (если знаешь)" value={bodyFat} min={3} max={55} onChange={setBodyFat} />
          <PopupSelect label="Цель" value={goal} options={[{id:'cut',label:'Сушка −18% TDEE'},{id:'maintain',label:'Поддержание'},{id:'bulk',label:'Масса +10%'}]} onChange={v=> setGoal(v as any)} />
        </div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6, lineHeight:1.35 }}>BMR: {kbju.nat.method==='katch_mcardle'?'Katch-McArdle (по lean)':'Mifflin-St Jeor'} · {kbju.nat.bmr}ккал · PAL {kbju.nat.pal.toFixed(2)}</div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Активность (NEAT + EAT)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupSelect label="Бытовая" value={activityLevel} options={[{id:'low',label:'Низкая (офис)'},{id:'medium',label:'Средняя'},{id:'high',label:'Высокая (на ногах)'}]} onChange={v=> setActivityLevel(v as any)} />
          <PopupNumber label="Тренировок/нед" value={trainingDays} min={0} max={7} onChange={setTrainingDays} />
          <PopupNumber label="Кардио мин/нед" value={cardioMin} min={0} max={600} onChange={setCardioMin} />
          <PopupNumber label="Шаги/сут факт" value={steps} min={0} max={32000} onChange={setSteps} />
        </div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6 }}>TDEE {stepsCalc.tdeeNat} → цель {stepsCalc.targetNat}ккал · {stepsCalc.kcalPerStep}ккал/шаг · ACWR {acwr.toFixed(2)} live</div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Замеры для Navy (опционально)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Шея, см" value={neck} min={28} max={60} onChange={setNeck} />
          <PopupNumber label="Талия, см" value={waist} min={55} max={150} onChange={setWaist} />
          {sex==='female' && <PopupNumber label="Бёдра, см (Ж)" value={hip} min={75} max={145} onChange={setHip} />}
          {sex==='male' && <div style={{ display:'flex', alignItems:'center', padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'rgba(255,255,255,0.55)' }}>Бёдра — только для ♀ формулы</div>}
        </div>
        {(waistErr || hipWarn) && <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:10, color:'#fbbf24' }}>{waistErr || hipWarn}</div>}
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:6 }}>{fat.accuracy} · {fat.note}</div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:8 }}>Восстановление (HPA)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Стресс 1-10" value={stress} min={1} max={10} onChange={setStress} />
          <PopupNumber label="Сон, ч" value={sleepHours} min={3} max={11} step={0.5} onChange={setSleepHours} />
          <PopupNumber label="Качество сна 1-5" value={sleepQuality} min={1} max={5} onChange={setSleepQuality} />
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:0.3 }}>ACWR live</div>
            <div style={{ fontSize:14, fontWeight:900, color: cortisol.acwrZone==='dangerous'?'#ef4444':cortisol.acwrZone==='caution'?'#f59e0b':'#22c55e' }}>{acwr.toFixed(2)} · {cortisol.acwrZone}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>из sRPE · обновляется live</div>
          </div>
        </div>
      </div>

      {/* KPI — 5 карточек без slice-бага */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:6 }}>
        {[
          {k:'water', v: onAAS ? water.aas : water.nat, u:'мл', l:'Вода', c:'#38bdf8', d: `Δ ${water.delta>0?'+':''}${water.delta} · ${water.perHour}мл/ч`},
          {k:'steps', v: onAAS ? stepsCalc.stepsAAS : stepsCalc.stepsNat, u:'', l:'Шаги', c:'#22c55e', d: `PAL ${stepsCalc.pal} · ${stepsCalc.tdeeNat}ккал`},
          {k:'kbju', v: onAAS ? kbju.aas.kcal : kbju.nat.kcal, u:'ккал', l:'КБЖУ', c:'#f59e0b', d:`Б${onAAS? kbju.aas.p:kbju.nat.p} Ж${onAAS? kbju.aas.f:kbju.nat.f} У${onAAS? kbju.aas.c:kbju.nat.c}`},
        ].map(x=> (
          <div key={x.k} style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid ${x.c}`, minHeight:72 }}>
            <div style={{ fontSize:9, fontWeight:800, color:x.c, letterSpacing:0.4, textTransform:'uppercase' }}>{x.l}</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{x.v.toLocaleString()}<span style={{ fontSize:10, color:'#fff' }}> {x.u}</span></div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.3 }}>{x.d}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:'3px solid #a78bfa', minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#a78bfa', letterSpacing:0.4, textTransform:'uppercase' }}>Жир · FFMI</div>
          <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{fat.current}%<span style={{ fontSize:10 }}> · FFMI {onAAS? fat.ffmiNormAdj:fat.ffmiNorm}</span></div>
          <div style={{ fontSize:9, color: (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit)?'#f87171':'#fff' }}>Navy {fat.navy ?? '—'}{fat.navyAdj? ` → ${fat.navyAdj}`:''} · лимит 25 { (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit) ? '⚠ выше' : '✓' }</div>
        </div>
        <div style={{ ...CARD, marginBottom:0, padding:10, borderLeft:'3px solid #f43f5e', minHeight:72 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#f43f5e', letterSpacing:0.4, textTransform:'uppercase' }}>HPA индекс</div>
          <div style={{ fontSize:16, fontWeight:900, color: (onAAS? cortisol.zoneAAS:cortisol.zoneNat)==='high' || (onAAS? cortisol.zoneAAS:cortisol.zoneNat)==='very_high' ? '#ef4444' : '#fff' }}>{onAAS? cortisol.aas: cortisol.nat}<span style={{ fontSize:10 }}> /100 · {onAAS? cortisol.zoneLabelAAS: cortisol.zoneLabelNat}</span></div>
          <div style={{ fontSize:9, color:'#fff' }}>{cortisol.scaleNote}</div>
        </div>
      </div>

      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 10px', padding:'8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {MODE_DEFS.map(({m,label,icon,desc,accent})=> (
          <button key={m} onClick={()=> setMode(m)} title={desc} style={{
            flex:'0 0 auto', display:'flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:800, whiteSpace:'nowrap',
            border: mode===m ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
            background: mode===m ? `${accent}18` : 'rgba(255,255,255,0.04)',
            color: mode===m ? accent : '#fff', transition:'all 0.16s',
          }}><span>{icon}</span> {label}</button>
        ))}
      </div>

      <div style={{ ...CARD, padding:0, overflow:'hidden', background:'rgba(24,24,27,0.30)' }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${active.accent}18`, border:`1px solid ${active.accent}33`, fontSize:14 }}>{active.icon}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:900, color:active.accent }}>{active.label} · {active.desc}</div>
            <div style={{ fontSize:10, color:'#fff' }}>{active.hint}</div>
          </div>
        </div>
        <div style={{ padding:12 }}>
          {mode==='water' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(56,165,250,0.08)', border:'1px solid rgba(56,165,250,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'#38bdf8' }}>{water.nat} <span style={{fontSize:10, color:'#fff'}}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHour}мл/ч · база {water.breakdown.base}+пот {water.breakdown.training}{water.breakdown.climate? ` ${water.breakdown.climate>0?'+':''}${water.breakdown.climate}`:''}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:20, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{water.aas} <span style={{fontSize:10, color:'#fff'}}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHourAAS}мл/ч · Δ +{water.delta} ({Math.round((water.aas/water.nat-1)*100)}%)</div>
                </div>
              </div>
              <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center' }}>
                <Bar v={water.breakdown.base} max={water.nat} color="#38bdf8" label={`база ${water.breakdown.base}`} />
                <Bar v={water.breakdown.training} max={water.nat} color="#f59e0b" label={`пот ${water.breakdown.training}`} />
                {water.breakdown.climate!==0 && <Bar v={Math.abs(water.breakdown.climate)} max={water.nat} color="#22c55e" label={`${water.breakdown.climate>0?'+':''}${water.breakdown.climate} климат`} />}
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px', lineHeight:1.45 }}>{water.note} · LBM {water.breakdown.lean}кг / жир {water.breakdown.fatMass}кг</div>
            </div>
          )}
          {mode==='steps' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#22c55e' }}>{stepsCalc.stepsNat.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeNat} → цель {stepsCalc.targetNat}ккал</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{stepsCalc.stepsAAS.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeAAS} → {stepsCalc.targetAAS}ккал · Δ {stepsCalc.delta}</div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6 }}>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>PAL <b style={{color:'#22c55e'}}>{stepsCalc.pal}</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>сидяч <b>{stepsCalc.sedentKcal}ккал</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>{stepsCalc.kcalPerStep}ккал/шаг</div>
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{stepsCalc.note}</div>
            </div>
          )}
          {mode==='kbju' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {kbju.nat.protPerKg}г/кг · PAL {kbju.nat.pal}</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#f59e0b' }}>{kbju.nat.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.nat.p} Ж{kbju.nat.f} У{kbju.nat.c}</div>
                  <div style={{ marginTop:6, height:6, borderRadius:20, background:'rgba(255,255,255,0.06)', display:'flex', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(kbju.nat.p*4/kbju.nat.kcal*100)}%`, background:'#60a5fa' }} />
                    <div style={{ width:`${Math.round(kbju.nat.f*9/kbju.nat.kcal*100)}%`, background:'#fbbf24' }} />
                    <div style={{ flex:1, background:'#fb923c' }} />
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Б {Math.round(kbju.nat.p*4/kbju.nat.kcal*100)}% · Ж {Math.round(kbju.nat.f*9/kbju.nat.kcal*100)}% · У {Math.round(kbju.nat.c*4/kbju.nat.kcal*100)}%</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС — {kbju.aas.protPerKg}г/кг · PAL {kbju.aas.pal}</div>
                  <div style={{ fontSize:16, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{kbju.aas.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.aas.p} Ж{kbju.aas.f} У{kbju.aas.c}</div>
                  <div style={{ marginTop:6, height:6, borderRadius:20, background:'rgba(255,255,255,0.06)', display:'flex', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(kbju.aas.p*4/kbju.aas.kcal*100)}%`, background:'#60a5fa' }} />
                    <div style={{ width:`${Math.round(kbju.aas.f*9/kbju.aas.kcal*100)}%`, background:'#fbbf24' }} />
                    <div style={{ flex:1, background:'#fb923c' }} />
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>Б {Math.round(kbju.aas.p*4/kbju.aas.kcal*100)}% · Ж {Math.round(kbju.aas.f*9/kbju.aas.kcal*100)}% · У {Math.round(kbju.aas.c*4/kbju.aas.kcal*100)}%</div>
                </div>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ ккал <b style={{color: kbju.delta.kcal>0?'#f87171':'#22c55e'}}>{kbju.delta.kcal>0?'+':''}{kbju.delta.kcal}</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ белок <b style={{color:'#f87171'}}>+{kbju.delta.p}г</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>клетчатка {onAAS? kbju.fiber.aas:kbju.fiber.nat}г</div>
              </div>
              <div style={{ marginTop:6, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{kbju.note} · {kbju.carbTiming}</div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <button onClick={applyKBJU} style={{ flex:1, padding:10, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000', fontWeight:800, fontSize:11 }}>🍽 Применить к плану питания → буфер</button>
                <button onClick={()=> { const s = onAAS? kbju.aas:kbju.nat; const t=`КБЖУ ${s.kcal} Б${s.p} Ж${s.f} У${s.c} (P${s.protPerKg})`; navigator.clipboard?.writeText(t).then(()=> showToast('Скопировано: '+t)).catch(()=> showToast(t)); }} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>⎘ Копировать</button>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', lineHeight:1.35 }}>Буфер: <code style={{ background:'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:5, color:'#fff' }}>he_planner_kbju_suggestion</code> — планировщик подхватит как подсказку. Потолок У — 5г/кг (6 на ААС, ≤8 с инсулином) — из `planner-targets`.</div>
            </div>
          )}
          {mode==='fat' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Текущий</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#a78bfa' }}>{fat.current}%</div>
                  <div style={{ fontSize:9, color:'#fff' }}>Navy {fat.navy ?? '—'}{fat.navyAdj? ` → ${fat.navyAdj}`:''} · FFM {fat.ffm}кг</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: fat.isOverNatLimit ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: fat.isOverNatLimit ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: fat.isOverNatLimit ? '#f87171' : '#fff' }}>FFMI_norm {onAAS? fat.ffmiNormAdj:fat.ffmiNorm} { (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit) ? '⚠' : '✓'}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: (onAAS? fat.isOverNatLimitAAS:fat.isOverNatLimit)? '#f87171':'#fff' }}>{onAAS? fat.ffmiNormAdj:fat.ffmiNorm}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{fat.aasNote}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:8, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', position:'relative' }}>
                <div style={{ position:'absolute', left:`${Math.min(100, Math.max(0, ( (onAAS? fat.ffmiNormAdj:fat.ffmiNorm)/28*100)))}%`, top:0, bottom:0, width:2, background:'#fff', opacity:0.9 }} />
                <div style={{ width:`${Math.min(100, 25/28*100)}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#a78bfa)', opacity:0.55 }} />
                <div style={{ position:'absolute', left:`${25/28*100}%`, top:0, bottom:0, width:1, background:'rgba(255,255,255,0.35)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>18</span><span>25 лимит нат</span><span>28</span></div>
              {fat.waistAdj && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:10, color:'#fff' }}>Талия с осевой: {fat.waistAdj}см (коррекция +{fat.axialAdd}см) · {fat.note}</div>}
              <div style={{ marginTop:6, display:'flex', gap:6, fontSize:9 }}>
                <span style={{ flex:1, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', textAlign:'center' }}>FFMI {fat.ffmi} → norm {fat.ffmiNorm}</span>
                <span style={{ flex:1, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', textAlign:'center' }}>FFM {fat.ffm}кг</span>
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'7px 10px' }}>{fat.accuracy}</div>
            </div>
          )}
          {mode==='cortisol' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.15)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {cortisol.zoneLabelNat}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneNat==='high'||cortisol.zoneNat==='very_high'?'#ef4444': cortisol.zoneNat==='low'?'#60a5fa':'#22c55e' }}>{cortisol.nat} <span style={{fontSize:10}}>/100</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{cortisol.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.03)', border: onAAS?'1px solid rgba(239,68,68,0.18)':'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS?'#f87171':'#fff' }}>С ААС — {cortisol.zoneLabelAAS}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneAAS==='high'||cortisol.zoneAAS==='very_high'?'#ef4444': cortisol.zoneAAS==='low'?'#60a5fa':'#22c55e' }}>{cortisol.aas} <span style={{fontSize:10}}>/100</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>Δ {cortisol.delta>0?'+':''}{cortisol.delta} · {cortisol.acwrZone}</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:10, borderRadius:20, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', display:'flex' }}>
                <div style={{ width:'38%', background:'rgba(96,165,250,0.45)' }} />
                <div style={{ width:'24%', background:'rgba(34,197,94,0.55)' }} />
                <div style={{ width:'16%', background:'rgba(245,158,11,0.55)' }} />
                <div style={{ flex:1, background:'rgba(239,68,68,0.55)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:2 }}><span>0 low</span><span>38</span><span>62 norm</span><span>78 high</span><span>100</span></div>
              <div style={{ marginTop:6, position:'relative', height:6, borderRadius:20, background:'rgba(255,255,255,0.06)' }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${onAAS? cortisol.aas: cortisol.nat}%`, background:'linear-gradient(90deg,#60a5fa,#22c55e 45%,#f59e0b 78%,#ef4444)', borderRadius:20, transition:'width 0.35s' }} />
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff', lineHeight:1.4 }}>{cortisol.diurnal}</div>
              <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff' }}>
                Что-если: попробуй +1ч сна → {cortisol.whatIf(1,0,0)}, −2 стресса → {cortisol.whatIf(0,-2,0)}, ACWR 1.5→1.0 → {cortisol.whatIf(0,0,-0.5)}. Двигай слайдеры вверху — индекс live.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', textAlign:'center', marginTop:10, lineHeight:1.5 }}>
        Источники: Mifflin-St Jeor 1990 · Katch-McArdle 1991 · EFSA 2010 · ISSN Helms 2014 · Navy Hodgdon 1984 · Kouri FFMI 1995 · Gabbett ACWR 2016.<br/>HPA — скрининг, не диагноз. Для лабы — кортизол 08:00 + ACTH.
      </div>
    </div>
  );
};
