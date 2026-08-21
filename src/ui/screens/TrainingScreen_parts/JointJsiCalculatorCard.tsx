/**
 * JointJsiCalculatorCard.tsx — AI-ортопед: ввод → JSI → тепловая карта + тюнинг + нутрицевтики.
 *
 * Telegram Mini App — все инпуты по клику, тепловая карта SVG-силуэт.
 * Читает профиль (personal/pharma/health) для автоподстановки антропометрии/ААС/боли.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { calcJointJsi, JSI_JOINT_RU, JSI_LEVEL_COLOR, JSI_LEVEL_BG, type JointJsiInput, type AmplitudeMode } from '../../../engines/pro/joint-jsi.engine';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import type { JointId } from '../../../engines/pro/joint-load-master.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

const DIM='rgba(255,255,255,0.55)';
const CARD: React.CSSProperties = { padding:12, borderRadius:10, background:'rgba(24,24,27,0.45)', border:'1px solid rgba(255,255,255,0.08)', marginTop:8 };
const btn: React.CSSProperties = { padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:10, fontWeight:700, minHeight:32 };

const LIFT_RU: Record<Lift,string> = { bench:'Жим лёжа', squat:'Присед', deadlift:'Становая', ohp:'Жим стоя', row:'Тяга в наклоне', pulldown:'Тяга блока', incline_press:'Наклонный жим', sumo:'Сумо', biceps:'Бицепс' };
const AMPLITUDE_OPTS: {id:AmplitudeMode; label:string}[] = [
  {id:'full', label:'Полная'}, {id:'partial_top', label:'Частичная верх'}, {id:'partial_stretched', label:'Частичная растянутая (HIGH RISK)'}];
const JOINTS: JointId[] = ['wrist','elbow','shoulder','spine','hip','knee','ankle'];

// тепловой силуэт — упрощённый человечек, суставы — кружки с цветом JSI
const Silhouette: React.FC<{ perJoint: Record<JointId,{level:string}> }> = ({ perJoint }) => {
  const pos: Record<JointId,{x:number;y:number}> = {
    shoulder:{x:50,y:32}, elbow:{x:24,y:48}, wrist:{x:18,y:58},
    spine:{x:50,y:54}, hip:{x:50,y:68}, knee:{x:42,y:84}, ankle:{x:42,y:96},
  };
  return (
    <svg viewBox="0 0 100 110" width="100%" style={{ maxWidth:260, display:'block', margin:'0 auto' }}>
      {/* тело */}
      <line x1="50" y1="12" x2="50" y2="68" stroke="rgba(255,255,255,0.25)" strokeWidth={3} />
      <circle cx="50" cy="8" r="7" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
      <line x1="50" y1="28" x2="26" y2="46" stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} />
      <line x1="50" y1="28" x2="74" y2="46" stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} />
      <line x1="50" y1="68" x2="34" y2="96" stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} />
      <line x1="50" y1="68" x2="66" y2="96" stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} />
      {JOINTS.map(j=>{
        const p = pos[j]; const lvl = ((perJoint as any)[j]?.level ?? 'green') as keyof typeof JSI_LEVEL_COLOR;
        const color = JSI_LEVEL_COLOR[lvl] ?? '#22c55e';
        return <g key={j}><circle cx={p.x} cy={p.y} r={6} fill={color} opacity={0.9} stroke="#fff" strokeWidth={1} /><text x={p.x} y={p.y+10} fontSize={5} fill={DIM} textAnchor="middle">{j}</text></g>;
      })}
    </svg>
  );
};

function readProfile(): any {
  try { const raw = JSON.parse(localStorage.getItem('he_profile_v2')||'null'); return raw?.personal ?? raw?.settings?.personal ?? {}; } catch { return {}; }
}
function readPharma(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('he_profile_v2')||'null');
    const ph = raw?.pharma ?? raw?.settings?.pharma ?? {};
    const cur = ph.currentSubstances ?? [];
    return cur.map((s:any)=> (s.name || s.id || '').toLowerCase()).filter(Boolean);
  } catch { return []; }
}
function readPainMap(): Partial<Record<JointId,number>> {
  try {
    const raw = JSON.parse(localStorage.getItem('he_profile_v2')||'null');
    const h = raw?.health ?? raw?.settings?.health ?? {};
    const m: Partial<Record<JointId,number>> = {};
    if (typeof h.jointPainSeverity==='string') {
      const sev = h.jointPainSeverity; // none/mild/moderate/severe
      const v = sev==='severe'?8: sev==='moderate'?5: sev==='mild'?2:0;
      if (v) m.knee=v;
    }
    // injuries → 3
    const inj: any[] = h.injuries ?? [];
    for (const it of inj) {
      const loc = (it.location||'').toLowerCase();
      if (/колен|knee/.test(loc)) m.knee = Math.max(m.knee??0,6);
      if (/плеч|shoulder/.test(loc)) m.shoulder = Math.max(m.shoulder??0,6);
      if (/поясн|spine|disc/.test(loc)) m.spine = Math.max(m.spine??0,7);
    }
    return m;
  } catch { return {}; }
}

export const JointJsiCalculatorCard: React.FC = () => {
  const [lift, setLift] = useState<Lift>('bench');
  const [weight, setWeight] = useState('100');
  const [sets, setSets] = useState('4');
  const [reps, setReps] = useState('5');
  const [tempo, setTempo] = useState('2.0');
  const [amplitude, setAmplitude] = useState<AmplitudeMode>('full');
  const [grip, setGrip] = useState<'narrow'|'medium'|'wide'>('medium');
  const [elbow, setElbow] = useState<0|45|90>(45);
  const [touch, setTouch] = useState<'upper_chest'|'lower_chest'|'clavicles'>('lower_chest');
  const [wristStraight, setWristStraight] = useState(true);
  const [hasBounce, setHasBounce] = useState(false);
  const [deadPoint, setDeadPoint] = useState<'bottom'|'middle'|'top'|'none'>('bottom');
  const [painSpine, setPainSpine] = useState('0');
  const [painShoulder, setPainShoulder] = useState('0');
  const [painKnee, setPainKnee] = useState('0');
  const [painElbow, setPainElbow] = useState('0');
  const [painWrist, setPainWrist] = useState('0');
  const [stance, setStance] = useState<'narrow'|'medium'|'wide'>('medium');
  const [depth, setDepth] = useState<'full'|'parallel'|'partial'>('parallel');
  const [heelLift, setHeelLift] = useState(false);
  const [buttWink, setButtWink] = useState(false);

  // профиль
  const profile = useMemo(readProfile, []);
  const pharma = useMemo(readPharma, []);
  const painInit = useMemo(readPainMap, []);

  useEffect(()=>{
    if (painInit.spine) setPainSpine(String(painInit.spine));
    if (painInit.shoulder) setPainShoulder(String(painInit.shoulder));
    if (painInit.knee) setPainKnee(String(painInit.knee));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = useMemo(()=>{
    const input: JointJsiInput = {
      lift,
      weightKg: parseFloat(weight) || 0,
      sets: parseInt(sets)||0,
      reps: parseInt(reps)||0,
      tempoEccSec: parseFloat(tempo)||2,
      hasBounce,
      amplitude,
      gripWidth: grip,
      elbowAngleDeg: elbow,
      touchPoint: touch,
      wristStraight,
      stanceWidth: stance,
      squatDepth: depth,
      heelLift,
      painMap: { spine: parseInt(painSpine)||0, shoulder: parseInt(painShoulder)||0, knee: parseInt(painKnee)||0, elbow: parseInt(painElbow)||0, wrist: parseInt(painWrist)||0 },
      deadPoint,
      amplitudeErrors: [...(buttWink?['butt_wink']:[]), ...(hasBounce?['bounce']:[])],
      anthropometry: { heightCm: profile.height, armSpanCm: profile.armSpanCm, femurCm: profile.femurLengthCm, torsoCm: profile.torsoLengthCm },
      aasStack: pharma,
      bodyWeightKg: profile.weight ?? 80,
      oldInjuries: painInit ? Object.keys(painInit) : [],
    };
    return calcJointJsi(input);
  }, [lift, weight, sets, reps, tempo, hasBounce, amplitude, grip, elbow, touch, wristStraight, stance, depth, heelLift, painSpine, painShoulder, painKnee, painElbow, painWrist, deadPoint, buttWink, profile, pharma]);

  const perJoint = result.perJoint;

  return (
    <div style={{ padding:12, color:'#fff' }}>
      <div style={{ fontSize:15, fontWeight:800, color:'#f43f5e' }}>🦴 AI-ортопед — JSI калькулятор (проф)</div>
      <div style={{ fontSize:10, color:DIM, marginTop:3, lineHeight:1.45 }}>
        Вес×Объём×Темп×Анатомия×Фарма×Боль → персональный износ по суставу. Зелёный→Жёлтый→Красный→Critical. Внутри Telegram Mini App — все 9 ортопедических калькуляторов в одном JSI.
      </div>

      {/* Вход */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#f43f5e' }}>Вход: упражнение + вес/объём/темп</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:6 }}>
          {(Object.keys(LIFT_RU) as Lift[]).slice(0,6).map(l=>{ const on=lift===l; return <button key={l} onClick={()=>setLift(l)} style={{ minHeight:28, padding:'4px 9px', borderRadius:10, cursor:'pointer', fontSize:9, border: on?'1px solid #f43f5e':'1px solid rgba(255,255,255,0.1)', background: on?'rgba(244,63,94,0.15)':'transparent', color:on?'#f43f5e':DIM, fontWeight:700 }}>{LIFT_RU[l]}{on?' ✓':''}</button>; })}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6, alignItems:'center' }}>
          <label style={{fontSize:10,color:DIM}}>Вес кг: <input value={weight} onChange={e=>setWeight(e.target.value)} style={{width:64,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:11}} /></label>
          <label style={{fontSize:10,color:DIM}}>Подх: <input value={sets} onChange={e=>setSets(e.target.value)} style={{width:40,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:11}} /></label>
          <label style={{fontSize:10,color:DIM}}>Повт: <input value={reps} onChange={e=>setReps(e.target.value)} style={{width:40,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:11}} /></label>
          <label style={{fontSize:10,color:DIM}}>Эксц. сек: <input value={tempo} onChange={e=>setTempo(e.target.value)} style={{width:46,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:11}} /></label>
          <label style={{fontSize:10,color:DIM, display:'flex',alignItems:'center',gap:4}}><input type="checkbox" checked={hasBounce} onChange={e=>setHasBounce(e.target.checked)} /> Отбив</label>
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
          {AMPLITUDE_OPTS.map(o=>{ const on=amplitude===o.id; return <button key={o.id} onClick={()=>setAmplitude(o.id)} style={{ padding:'4px 8px', borderRadius:7, cursor:'pointer', fontSize:9, border:on?'1px solid #f43f5e':'1px solid rgba(255,255,255,0.1)', background:on?'rgba(244,63,94,0.12)':'transparent', color:on?'#f43f5e':DIM, fontWeight:700 }}>{o.label}{on?' ✓':''}</button>; })}
        </div>
        <div style={{ fontSize:9, color:DIM, marginTop:4 }}>Антр.: {profile.height?`${profile.height}см`:'—'} / размах {profile.armSpanCm??'—'} · Фарма: {pharma.length? pharma.join(', '): 'нет'} {pharma.some(s=>/stan|mast|tren/i.test(s)) && <span style={{color:'#f43f5e'}}>· сушащие 1.4-1.5×</span>}</div>
      </div>

      {/* Геометрия */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#38bdf8' }}>Биомеханический паспорт техники</div>
        {lift==='bench' || lift==='incline_press' ? (
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:6 }}>
            <span style={{fontSize:10,color:DIM}}>Хват:</span>
            {(['narrow','medium','wide'] as const).map(v=>{ const on=grip===v; return <button key={v} onClick={()=>setGrip(v)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border:on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background:on?'rgba(56,189,248,0.12)':'transparent', color:on?'#38bdf8':DIM }}>{v}</button>; })}
            <span style={{fontSize:10,color:DIM, marginLeft:6}}>Локти:</span>
            {([0,45,90] as const).map(v=>{ const on=elbow===v; return <button key={v} onClick={()=>setElbow(v)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border:on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background:on?'rgba(56,189,248,0.12)':'transparent', color:on?'#38bdf8':DIM }}>{v}°</button>; })}
            <span style={{fontSize:10,color:DIM, marginLeft:6}}>Касание:</span>
            {(['upper_chest','lower_chest','clavicles'] as const).map(v=>{ const on=touch===v; return <button key={v} onClick={()=>setTouch(v)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border:on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background:on?'rgba(56,189,248,0.12)':'transparent', color:on?'#38bdf8':DIM }}>{v}</button>; })}
            <label style={{fontSize:10,color:DIM, display:'flex',alignItems:'center',gap:4, marginLeft:6}}><input type="checkbox" checked={wristStraight} onChange={e=>setWristStraight(e.target.checked)} /> Кисть прямая</label>
          </div>
        ) : lift==='squat' ? (
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:6 }}>
            <span style={{fontSize:10,color:DIM}}>Стойка:</span>
            {(['narrow','medium','wide'] as const).map(v=>{ const on=stance===v; return <button key={v} onClick={()=>setStance(v)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border:on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background:on?'rgba(56,189,248,0.12)':'transparent', color:on?'#38bdf8':DIM }}>{v}</button>; })}
            <span style={{fontSize:10,color:DIM, marginLeft:6}}>Глубина:</span>
            {(['full','parallel','partial'] as const).map(v=>{ const on=depth===v; return <button key={v} onClick={()=>setDepth(v)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border:on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background:on?'rgba(56,189,248,0.12)':'transparent', color:on?'#38bdf8':DIM }}>{v}</button>; })}
            <label style={{fontSize:10,color:DIM, display:'flex',alignItems:'center',gap:4}}><input type="checkbox" checked={heelLift} onChange={e=>setHeelLift(e.target.checked)} /> Штангетки</label>
            <label style={{fontSize:10,color:DIM, display:'flex',alignItems:'center',gap:4}}><input type="checkbox" checked={buttWink} onChange={e=>setButtWink(e.target.checked)} /> Кивок таза</label>
          </div>
        ) : <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Геометрия для этого движения — через блоки JointMaster (стойка/хват).</div>}
      </div>

      {/* Субъективный статус */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#facc15' }}>Субъективный статус (тепловая карта боли + мёртвая точка)</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6, alignItems:'center' }}>
          <span style={{fontSize:10,color:DIM}}>Боль 0-10:</span>
          <label style={{fontSize:10,color:DIM}}>Плечо <input value={painShoulder} onChange={e=>setPainShoulder(e.target.value)} style={{width:32,marginLeft:2,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'2px 4px',fontSize:10}} /></label>
          <label style={{fontSize:10,color:DIM}}>Локоть <input value={painElbow} onChange={e=>setPainElbow(e.target.value)} style={{width:32,marginLeft:2,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'2px 4px',fontSize:10}} /></label>
          <label style={{fontSize:10,color:DIM}}>Кисть <input value={painWrist} onChange={e=>setPainWrist(e.target.value)} style={{width:32,marginLeft:2,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'2px 4px',fontSize:10}} /></label>
          <label style={{fontSize:10,color:DIM}}>Поясн <input value={painSpine} onChange={e=>setPainSpine(e.target.value)} style={{width:32,marginLeft:2,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'2px 4px',fontSize:10}} /></label>
          <label style={{fontSize:10,color:DIM}}>Колено <input value={painKnee} onChange={e=>setPainKnee(e.target.value)} style={{width:32,marginLeft:2,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'2px 4px',fontSize:10}} /></label>
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6, alignItems:'center' }}>
          <span style={{fontSize:10,color:DIM}}>Мёртвая точка:</span>
          {(['bottom','middle','top','none'] as const).map(v=>{ const on=deadPoint===v; return <button key={v} onClick={()=>setDeadPoint(v)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border:on?'1px solid #facc15':'1px solid rgba(255,255,255,0.1)', background:on?'rgba(250,204,21,0.12)':'transparent', color:on?'#facc15':DIM }}>{v}</button>; })}
        </div>
      </div>

      {/* Результат: тепловая карта */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#f43f5e' }}>Тепловая карта JSI — макс {result.maxJsi} ({JSI_JOINT_RU[result.maxJoint]}) · {result.overallLevel}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6, alignItems:'center' }}>
          <div>
            <Silhouette perJoint={result.perJoint as any} />
            <div style={{ fontSize:9, color:DIM, textAlign:'center', marginTop:4 }}>Зел→Жёл→Красн→Critical</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {JOINTS.map(j=>{
              const pj = (result.perJoint as any)[j] as any;
              if (!pj || pj.kBase===0) return null;
              const lvl = pj.level as keyof typeof JSI_LEVEL_COLOR;
              return (
                <div key={j} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 6px', borderRadius:6, background: JSI_LEVEL_BG[lvl], border:`1px solid ${JSI_LEVEL_COLOR[lvl]}55` }}>
                  <span style={{ fontSize:10, color:'#fff' }}>{JSI_JOINT_RU[j]} {pj.jsi}</span>
                  <span style={{ fontSize:8, color:JSI_LEVEL_COLOR[lvl], fontWeight:700 }}>{pj.level}</span>
                </div>
              );
            })}
            <div style={{ fontSize:9, color:DIM, marginTop:4, lineHeight:1.3 }}>
              Коэфф. макс-сустава: Ktempo {perJointMax(result).kTempo} · Kanat {perJointMax(result).kAnatomy} · Kpharma {perJointMax(result).kPharma} · Kpain {perJointMax(result).kPain}
            </div>
          </div>
        </div>
        {result.deadlyCombos.length>0 && (
          <div style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.4)' }}>
            {result.deadlyCombos.map(c=>(
              <div key={c.id} style={{ fontSize:10, color:'#f87171', marginTop:4 }}>
                <b style={{color:'#ef4444'}}>🚨 CRITICAL: {c.title}</b><div style={{ color:DIM, marginTop:2 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        )}
        {result.phaseOverload.length>0 && (
          <div style={{ marginTop:6, padding:8, borderRadius:8, background:'rgba(250,204,21,0.08)', border:'1px solid rgba(250,204,21,0.2)' }}>
            {result.phaseOverload.map(p=> <div key={p.joint} style={{ fontSize:10, color:'#facc15' }}>⚡ {p.jointLabel}: {p.reason}</div>)}
          </div>
        )}
      </div>

      {/* Тюнинг */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#38bdf8' }}>Технический тюнинг и умные альтернативы</div>
        {result.tuning.length===0 ? <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Рисков в красной зоне нет — тюнинг не требуется.</div> :
          result.tuning.map(t=>(
            <div key={t.id} style={{ marginTop:6, padding:8, borderRadius:7, background:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.15)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#38bdf8' }}>{t.action} <span style={{ color:'#22c55e', fontSize:9 }}>{t.expected}</span></div>
              <div style={{ fontSize:9, color:DIM, marginTop:2 }}>{t.alternative && <>Альтернатива: <b style={{color:'#fff'}}>{t.alternative}</b></>}</div>
              <button onClick={()=>{
                // быстрый пресет для жима: меняем локальный стейт — снижает JSI
                if (t.id==='tune_grip') setGrip('medium');
                if (t.id==='tune_wrist') setWristStraight(true);
                if (t.id==='tune_squat_depth') setDepth('parallel');
              }} style={{ ...btn, marginTop:6, background:'rgba(56,189,248,0.12)', color:'#38bdf8', border:'1px solid rgba(56,189,248,0.25)' }}>Оптимизировать</button>
            </div>
          ))
        }
        <div style={{ fontSize:9, color:DIM, marginTop:6 }}>Метод TUT: вес -20% + эксцентрика 4с → мышца сохранена, хрящ -25% (Schoenfeld). Замена паттерна: осевая 0 (болгарские) при красной пояснице.</div>
      </div>

      {/* Нутрицевтики */}
      <div style={{ ...CARD, border:`1px solid ${result.nutraceutical.tier==='red'?'rgba(239,68,68,0.3)': result.nutraceutical.tier==='yellow'?'rgba(250,204,21,0.2)':'rgba(34,197,94,0.2)'}` }}>
        <div style={{ fontSize:11, fontWeight:800, color: result.nutraceutical.tier==='red'?'#f87171': result.nutraceutical.tier==='yellow'?'#facc15':'#4ade80' }}>💊 {result.nutraceutical.title}</div>
        <ul style={{ margin:'4px 0 0 14px', padding:0 }}>
          {result.nutraceutical.basket.map((b,i)=><li key={i} style={{ fontSize:10, color:DIM }}>{b}</li>)}
        </ul>
        {result.nutraceutical.labs && <div style={{ fontSize:10, color:'#f87171', marginTop:4 }}>Анализы: {result.nutraceutical.labs.join(' · ')}</div>}
        <div style={{ fontSize:9, color:DIM, marginTop:4 }}>{result.nutraceutical.note}</div>
      </div>
    </div>
  );
};

function perJointMax(r: any){ return r.perJoint[r.maxJoint]; }

export default JointJsiCalculatorCard;
