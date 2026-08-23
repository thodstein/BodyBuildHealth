/** MetabolicHub.tsx — единый хаб Метаболики (5 в 1) без дублей.
 *  Вода · Шаги · КБЖУ · Жир · Кортизол — один снапшот, переключатель Натурал/ААС, белый текст, стекло.
 *  Канон — Питание, алиас — Тренировки/Интеллект (один файл, без дубля).
 */
import React, { useState, useMemo, useEffect } from 'react';
import { calcWater, calcSteps, calcKBJU, calcBodyFat, calcCortisol, type MetabolicInput } from '../../../engines/metabolic-hub.engine';
import { getProfile } from '../../../core/profile-manager';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from '../TrainingScreen_parts/planner-bridge';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;

type Mode = 'water'|'steps'|'kbju'|'fat'|'cortisol';
const MODE_DEFS: Array<{m:Mode; label:string; icon:string; desc:string; accent:string; hint:string}> = [
  {m:'water', label:'Вода', icon:'💧', desc:'Суточная норма', accent:'#38bdf8', hint:'EFSA 35мл/кг + тренировка · ААС +12%'},
  {m:'steps', label:'Шаги', icon:'👟', desc:'Бытовая активность', accent:'#22c55e', hint:'TDEE + цель → шаги · NEAT'},
  {m:'kbju', label:'КБЖУ', icon:'🍽', desc:'Калории и макро', accent:'#f59e0b', hint:'BMR·PAL + EAT/NEAT + ААС'},
  {m:'fat', label:'Жир', icon:'🧬', desc:'% жира, FFMI', accent:'#a78bfa', hint:'Navy + осевая талия ББ/ПЛ'},
  {m:'cortisol', label:'Кортизол', icon:'🧠', desc:'Оценка HPA', accent:'#f43f5e', hint:'Стресс/сон/ACWR → кортизол'},
];

const SNAP_KEY = 'he_metabolic_snapshot_v1';

export const MetabolicHub: React.FC = () => {
  const [mode, setMode] = useState<Mode>('water');
  const [onAAS, setOnAAS] = useState(false);
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

  useEffect(()=>{
    try{
      const raw = localStorage.getItem(SNAP_KEY);
      if(raw){ const s=JSON.parse(raw); if(typeof s.weight==='number') setWeight(s.weight); if(typeof s.height==='number') setHeight(s.height); if(typeof s.age==='number') setAge(s.age); if(s.sex) setSex(s.sex); if(typeof s.bodyFat==='number') setBodyFat(s.bodyFat); if(typeof s.neck==='number') setNeck(s.neck); if(typeof s.waist==='number') setWaist(s.waist); if(typeof s.hip==='number') setHip(s.hip); if(typeof s.steps==='number') setSteps(s.steps); if(typeof s.cardioMin==='number') setCardioMin(s.cardioMin); if(typeof s.trainingDays==='number') setTrainingDays(s.trainingDays); if(s.activityLevel) setActivityLevel(s.activityLevel); if(s.goal) setGoal(s.goal); if(typeof s.stress==='number') setStress(s.stress); if(typeof s.sleepHours==='number') setSleepHours(s.sleepHours); if(typeof s.sleepQuality==='number') setSleepQuality(s.sleepQuality); if(typeof s.onAAS==='boolean') setOnAAS(s.onAAS); return; }
    }catch{}
    try{
      const p:any = getProfile()?.settings?.personal || {};
      if(p.weight) setWeight(Number(p.weight)); if(p.height) setHeight(Number(p.height)); if(p.age) setAge(Number(p.age)); if(p.sex) setSex(p.sex==='female'?'female':'male'); if(p.bodyFat) setBodyFat(Number(p.bodyFat));
    }catch{}
  },[]);
  useEffect(()=>{ try{ localStorage.setItem(SNAP_KEY, JSON.stringify({weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,stress,sleepHours,sleepQuality,onAAS})); }catch{} }, [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,stress,sleepHours,sleepQuality,onAAS]);

  const acwr = useMemo(()=>{ try{ const s=loadSRPESessions(); return s.length>=2 ? acuteChronicRatio(toDailyLoads(s as any)).ratio : 1; }catch{return 1;}}, [trainingDays]);

  const input: MetabolicInput = useMemo(()=> ({ weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,trainingHours: trainingDays*1.2, activityLevel, goal, onAAS, stress, sleepHours, sleepQuality, acwr }), [weight,height,age,sex,bodyFat,neck,waist,hip,steps,cardioMin,trainingDays,activityLevel,goal,onAAS,stress,sleepHours,sleepQuality,acwr]);

  const water = useMemo(()=> calcWater(input), [input]);
  const stepsCalc = useMemo(()=> calcSteps(input), [input]);
  const kbju = useMemo(()=> calcKBJU(input), [input]);
  const fat = useMemo(()=> calcBodyFat(input), [input]);
  const cortisol = useMemo(()=> calcCortisol(input), [input]);

  const active = MODE_DEFS.find(d=> d.m===mode)!;

  return (
    <div style={{ padding:'10px 8px 18px', color:'#fff', maxWidth:760, margin:'0 auto' }}>
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(96,165,250,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(96,165,250,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(96,165,250,0.14),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#60a5fa,#00e68a)', color:'#000', fontWeight:900, fontSize:16 }}>⚖️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Метаболика — Вода · Шаги · КБЖУ · Жир · Кортизол</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Один снапшот — 5 расчётов с/без ААС. Без дублей.</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${onAAS ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.22)'}`, color: onAAS ? '#f87171' : '#22c55e', fontWeight:800, whiteSpace:'nowrap' }}>{onAAS ? '💉 С ААС' : '🌿 Натурал'}</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> <span style={{ color:'#38bdf8' }}>вода</span> 35мл/кг + тренировка, <span style={{ color:'#22c55e' }}>шаги</span> из TDEE, <span style={{ color:'#f59e0b' }}>КБЖУ</span> BMR·PAL + EAT, <span style={{ color:'#a78bfa' }}>жир</span> Navy + осевая, <span style={{ color:'#f43f5e' }}>кортизол</span> HPA. Переключатель ААС — дельта.
        </div>
      </div>

      <div style={{ ...CARD, border:'1px solid rgba(255,255,255,0.07)', padding:10 }}>
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button onClick={()=> setOnAAS(false)} style={{ flex:1, minHeight:36, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800, border: !onAAS ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', background: !onAAS ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.02)', color: !onAAS ? '#22c55e' : '#fff' }}>🌿 Без ААС</button>
          <button onClick={()=> setOnAAS(true)} style={{ flex:1, minHeight:36, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800, border: onAAS ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', background: onAAS ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.02)', color: onAAS ? '#f87171' : '#fff' }}>💉 С ААС</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <PopupNumber label="Вес, кг" value={weight} min={30} max={200} onChange={setWeight} />
          <PopupNumber label="Рост, см" value={height} min={140} max={220} onChange={setHeight} />
          <PopupNumber label="Возраст" value={age} min={14} max={80} onChange={setAge} />
          <PopupSelect label="Пол" value={sex} options={[{id:'male',label:'♂ Мужчина'},{id:'female',label:'♀ Женщина'}]} onChange={v=> setSex(v as any)} />
          <PopupNumber label="Жир, %" value={bodyFat} min={3} max={50} onChange={setBodyFat} />
          <PopupSelect label="Цель" value={goal} options={[{id:'cut',label:'Сушка'},{id:'maintain',label:'Поддержание'},{id:'bulk',label:'Масса'}]} onChange={v=> setGoal(v as any)} />
          <PopupSelect label="Бытовая" value={activityLevel} options={[{id:'low',label:'Низкая'},{id:'medium',label:'Средняя'},{id:'high',label:'Высокая'}]} onChange={v=> setActivityLevel(v as any)} />
          <PopupNumber label="Тренировок/нед" value={trainingDays} min={1} max={7} onChange={setTrainingDays} />
          <PopupNumber label="Кардио мин/нед" value={cardioMin} min={0} max={600} onChange={setCardioMin} />
          <PopupNumber label="Шаги/сут (факт)" value={steps} min={0} max={30000} onChange={setSteps} />
          <PopupNumber label="Шея см" value={neck} min={30} max={60} onChange={setNeck} />
          <PopupNumber label="Талия см" value={waist} min={60} max={150} onChange={setWaist} />
          <PopupNumber label="Бедро см (Ж)" value={hip} min={80} max={140} onChange={setHip} />
          <PopupNumber label="Стресс 1-10" value={stress} min={1} max={10} onChange={setStress} />
          <PopupNumber label="Сон ч" value={sleepHours} min={4} max={10} step={0.5} onChange={setSleepHours} />
          <PopupNumber label="Качество сна 1-5" value={sleepQuality} min={1} max={5} onChange={setSleepQuality} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:10 }}>
        {[
          {k:'water', v: onAAS ? water.aas : water.nat, u:'мл', l:'Вода', c:'#38bdf8', d: `Δ ${water.delta>0?'+':''}${water.delta}`},
          {k:'steps', v: onAAS ? stepsCalc.stepsAAS : stepsCalc.stepsNat, u:'', l:'Шаги', c:'#22c55e', d: `${onAAS? stepsCalc.tdeeAAS : stepsCalc.tdeeNat} ккал`},
          {k:'kbju', v: onAAS ? kbju.aas.kcal : kbju.nat.kcal, u:'ккал', l:'КБЖУ', c:'#f59e0b', d:`Б${onAAS? kbju.aas.p:kbju.nat.p} Ж${onAAS? kbju.aas.f:kbju.nat.f} У${onAAS? kbju.aas.c:kbju.nat.c}`},
          {k:'fat', v: fat.current, u:'%', l:'Жир', c:'#a78bfa', d:`FFMI ${onAAS? fat.ffmiAdj:fat.ffmi}`},
          {k:'cort', v: onAAS ? cortisol.aas : cortisol.nat, u:'', l:'Кортизол', c:'#f43f5e', d: onAAS? cortisol.zoneAAS:cortisol.zoneNat},
        ].slice(0,3).map(x=> (
          <div key={x.k} style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid ${x.c}`, minHeight:68 }}>
            <div style={{ fontSize:9, fontWeight:800, color:x.c, letterSpacing:0.4, textTransform:'uppercase' }}>{x.l}</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{x.v}<span style={{ fontSize:10, color:'#fff' }}> {x.u}</span></div>
            <div style={{ fontSize:9, color:'#fff' }}>{x.d}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
        {[
          {k:'fat', v: fat.current, u:'%', l:'Жир', c:'#a78bfa', d:`Navy ${fat.navy ?? '—'}${fat.navyAdj? ` → ${fat.navyAdj}`:''}`},
          {k:'cort', v: onAAS ? cortisol.aas : cortisol.nat, u:'нм/л', l:'Кортизол', c:'#f43f5e', d: onAAS? cortisol.diurnal:fat.note},
        ].map(x=> (
          <div key={x.k} style={{ ...CARD, marginBottom:0, padding:10, borderLeft:`3px solid ${x.c}`, minHeight:68 }}>
            <div style={{ fontSize:9, fontWeight:800, color:x.c, letterSpacing:0.4, textTransform:'uppercase' }}>{x.l}</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{x.v}<span style={{ fontSize:10, color:'#fff' }}> {x.u}</span></div>
            <div style={{ fontSize:9, color:'#fff' }}>{x.d}</div>
          </div>
        ))}
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
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHour} мл/ч · база {water.breakdown.base}+{water.breakdown.training}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:20, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{water.aas} <span style={{fontSize:10, color:'#fff'}}>мл</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{water.perHourAAS} мл/ч · Δ +{water.delta}</div>
                </div>
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{water.note}</div>
            </div>
          )}
          {mode==='steps' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#22c55e' }}>{stepsCalc.stepsNat.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeNat} → {stepsCalc.targetNat} ккал</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС</div>
                  <div style={{ fontSize:18, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{stepsCalc.stepsAAS.toLocaleString()} <span style={{fontSize:10}}>шагов</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>TDEE {stepsCalc.tdeeAAS} → {stepsCalc.targetAAS} ккал · Δ {stepsCalc.delta}</div>
                </div>
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{stepsCalc.note}</div>
            </div>
          )}
          {mode==='kbju' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {kbju.nat.protPerKg}г/кг</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#f59e0b' }}>{kbju.nat.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.nat.p} Ж{kbju.nat.f} У{kbju.nat.c}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: onAAS ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS ? '#f87171' : '#fff' }}>С ААС — {kbju.aas.protPerKg}г/кг</div>
                  <div style={{ fontSize:16, fontWeight:900, color: onAAS ? '#f87171' : '#fff' }}>{kbju.aas.kcal} ккал</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Б{kbju.aas.p} Ж{kbju.aas.f} У{kbju.aas.c}</div>
                </div>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ ккал <b style={{color: kbju.delta.kcal>0?'#f87171':'#22c55e'}}>{kbju.delta.kcal>0?'+':''}{kbju.delta.kcal}</b></div>
                <div style={{ flex:1, padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:10, color:'#fff' }}>Δ белок <b style={{color:'#f87171'}}>+{kbju.delta.p}г</b></div>
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>{kbju.note} · {kbju.carbTiming}</div>
              <button onClick={()=> applyToPlanner({kind:'volume', label:`КБЖУ ${onAAS? kbju.aas.kcal:kbju.nat.kcal} ккал`, data:{ sets: {} } as any})} style={{ width:'100%', marginTop:8, padding:10, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000', fontWeight:800, fontSize:11 }}>🍽 Применить к плану питания</button>
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
                <div style={{ padding:10, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>FFMI {onAAS? 'с ААС':''}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: onAAS? '#f87171':'#fff' }}>{onAAS? fat.ffmiAdj:fat.ffmi}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{fat.aasNote}</div>
                </div>
              </div>
              {fat.waistAdj && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', fontSize:10, color:'#fff' }}>Талия с осевой: {fat.waistAdj} см (коррекция +{fat.axialAdd}см) · {fat.note}</div>}
              <div style={{ marginTop:6, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>ББ/ПЛ: присед/тяга + объём → +талия. Без учёта — Navy занижает жир у качков.</div>
            </div>
          )}
          {mode==='cortisol' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:10, borderRadius:10, background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.15)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff' }}>Без ААС — {cortisol.zoneNat}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneNat==='high'?'#ef4444': cortisol.zoneNat==='low'?'#60a5fa':'#22c55e' }}>{cortisol.nat} <span style={{fontSize:10}}>нм/л</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>{cortisol.note}</div>
                </div>
                <div style={{ padding:10, borderRadius:10, background: onAAS?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.03)', border: onAAS?'1px solid rgba(239,68,68,0.18)':'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: onAAS?'#f87171':'#fff' }}>С ААС — {cortisol.zoneAAS}</div>
                  <div style={{ fontSize:18, fontWeight:900, color: cortisol.zoneAAS==='high'?'#ef4444': cortisol.zoneAAS==='low'?'#60a5fa':'#22c55e' }}>{cortisol.aas} <span style={{fontSize:10}}>нм/л</span></div>
                  <div style={{ fontSize:9, color:'#fff' }}>Δ {cortisol.delta>0?'+':''}{cortisol.delta}</div>
                </div>
              </div>
              <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#fff' }}>{cortisol.diurnal}</div>
              <div style={{ marginTop:6, fontSize:10, color:'#fff', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 10px' }}>Что-если: сон/стресс/ACWR → кортизол. Используй слайдеры стресса/сна/тренировок вверху — дельта считается живо.</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize:10, color:'#fff', textAlign:'center', marginTop:10, opacity:0.9, lineHeight:1.45 }}>
        Единый снапшот — 5 расчётов с/без ААС. Формулы: EFSA/Mifflin-Katch-Helms/Navy/ISSU R/Bompa. Без дублей.
      </div>
    </div>
  );
};
