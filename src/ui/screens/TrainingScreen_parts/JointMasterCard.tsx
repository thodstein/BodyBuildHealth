/**
 * JointMasterCard.tsx — ЕДИНЫЙ МАСТЕР СУСТАВНО-СВЯЗОЧНОГО АППАРАТА.
 *
 * 9 блоков на один сустав/движение (опасные зоны: поясница L4-S1 выделена):
 *  0 JSI теплокарта → 1 анатомия риска → 2 текущая нагрузка (jointStress) → 3 геометрия→сустав →
 *  4 недельный план (orthopedic-load) → 5 прехаб/мобильность → 6 мониторинг (FMS-6 + he_mobility) →
 *  7 рекомендации (замены + cue) → 8 техника и безопасность упражнения → + видео-гид ракурса.
 *
 * Использует ВСЕ 9 ортопедических калькуляторов проекта + быструю оценку техники. Без вкладок, один скролл.
 */
import React, { useMemo, useState } from 'react';
import { JOINTS, JOINT_OPTIONS, jointLoadDiagnosis, JOINT_MAP, type JointId } from '../../../engines/pro/joint-load-master.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import { VideoCaptureCard } from './VideoCaptureCard';
import { distributeWeeklyLoad } from '../../../engines/orthopedic-load-engines';
import { applyToPlanner } from './planner-bridge';
import { JointJsiCalculatorCard } from './JointJsiCalculatorCard';
import { ExerciseSafetyPanel } from '../SRCBBScreen_parts/ExerciseSafetyPanel';

const CARD: React.CSSProperties = { padding:12, borderRadius:10, background:'rgba(24,24,27,0.45)', border:'1px solid rgba(255,255,255,0.08)', marginTop:8 };
const DIM='rgba(255,255,255,0.55)', ACCENT='#f43f5e';
const JOINT_COLOR: Record<JointId,string> = { shoulder:'#f43f5e', elbow:'#fb923c', wrist:'#facc15', spine:'#ef4444', hip:'#a78bfa', knee:'#38bdf8', ankle:'#4ade80' };
const LEVEL_RU: Record<string,string> = { critical: 'Критично', high: 'Высокий', moderate: 'Средний', medium: 'Средний', low: 'Низкий', none: 'Нет' };
const PHASE_RU: Record<string,string> = { acute: 'Острая', subacute: 'Подострая', chronic: 'Хроническая', normal: 'Норма', stable: 'Стабильная' };
const DIFF_RU: Record<string,string> = { hard: 'Тяжёлая', medium: 'Средняя', light: 'Лёгкая', off: 'Отдых' };
const LIFT_RU_ALL: Record<string,string> = { squat: 'Присед', deadlift: 'Становая (классика)', bench: 'Жим лёжа', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга блока', incline_press: 'Жим наклонный', sumo: 'Сумо', biceps: 'Бицепс' };

export const JointMasterCard: React.FC = () => {
  const [sub, setSub] = useState<'ortho' | 'safety'>('ortho');
  const [joint, setJoint] = useState<JointId>('spine'); // поясница по умолчанию — самая опасная
  const [lift, setLift] = useState<Lift>('squat');
  const [phasePain, setPhasePain] = useState<string>('');
  const [selected, setSelected] = useState<Record<string,string[]>>({});
  const [weekGoal, setWeekGoal] = useState<'strength'|'hypertrophy'|'rehab'>('strength');

  const diag = useMemo(()=> jointLoadDiagnosis({ joint, lifts:[lift], currentPain: phasePain ? [phasePain] : [] }), [joint,lift,phasePain]);
  const opts = diag.options;
  const weekPlan = useMemo(()=> distributeWeeklyLoad({ weeklySessions: 4, goal: weekGoal, volumeCapacity: 1, intensityCapacity: 1, priScore: 0.5, riskLevel: diag.phase==='acute'?'high': diag.phase==='subacute'?'medium':'low' }), [weekGoal, diag.phase]);

  return (
    <div style={{ padding:12, color:'#fff' }}>
      <div style={{ fontSize:15, fontWeight:800, color:ACCENT }}>🦴 Ортопедия и суставы — единый инструмент</div>
      <div style={{ fontSize:10, color:DIM, marginTop:3, lineHeight:1.45 }}>
        Всё про суставы и движения в одном месте: тепловая карта износа (JSI), анатомия риска, нагрузка, геометрия, недельный план, прехаб/мобильность, мониторинг (FMS), замены, видео + оценка техники упражнения. Без вкладок-дублей.
      </div>

      {/* подвкладки */}
      <div style={{ display:'flex', gap:6, marginTop:8, marginBottom:6, flexWrap:'wrap' }}>
        {([['ortho','🦴 Суставы и ортопедия'],['safety','🛡 Безопасность упражнения']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setSub(id)} aria-pressed={sub===id} style={{
            minHeight:36, padding:'7px 14px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:800,
            border: sub===id ? '1px solid '+ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: sub===id ? 'rgba(244,63,94,0.14)' : 'rgba(255,255,255,0.02)',
            color: sub===id ? ACCENT : DIM,
          }}>{label}</button>
        ))}
      </div>

      {sub === 'safety' && (
        <>
          <div style={{ marginTop:4, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.14)', fontSize:10, color:DIM, lineHeight:1.4 }}>
            Быстрая оценка техники и противопоказаний для выбранного движения. Детальный разбор каждого сустава — во вкладке <b style={{ color:ACCENT }}>«Суставы и ортопедия»</b> выше.
          </div>
          <ExerciseSafetyPanel />
        </>
      )}
      {sub === 'ortho' && (<> 
      {/* выбор сустава */}
      <div style={{ ...CARD, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT, marginRight:6 }}>Сустав/зона:</div>
        {JOINTS.map(j=>{ const on=joint===j.id; return <button key={j.id} onClick={()=>setJoint(j.id)} style={{ minHeight:32, padding:'5px 10px', borderRadius:14, cursor:'pointer', border: on?`1px solid ${JOINT_COLOR[j.id]}`:'1px solid rgba(255,255,255,0.1)', background: on?`${JOINT_COLOR[j.id]}22`:'transparent', color: on?JOINT_COLOR[j.id]:DIM, fontWeight:700, fontSize:10 }}>{j.icon} {j.label}{on?' ✓':''}</button>; })}
      </div>
      <div style={{ ...CARD, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT, marginRight:6 }}>Движение:</div>
        {(['squat','deadlift','bench','ohp','row','pulldown','incline_press','sumo','biceps'] as Lift[]).map(l=>{ const on=lift===l; return <button key={l} onClick={()=>setLift(l)} style={{ minHeight:28, padding:'4px 9px', borderRadius:10, cursor:'pointer', fontSize:9, border: on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background: on?'rgba(56,189,248,0.15)':'transparent', color: on?'#38bdf8':DIM, fontWeight:700 }}>{LIFT_RU_ALL[l] || l}</button>; })}
        <label style={{ fontSize:10, color:DIM, marginLeft:8 }}>Боль сейчас: <input value={phasePain} onChange={e=>setPhasePain(e.target.value)} placeholder="напр. поясница" style={{ width:110, marginLeft:4, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', borderRadius:6, padding:'4px 6px', fontSize:10 }} /></label>
      </div>

      {/* 1 анатомия */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:JOINT_COLOR[joint] }}>1 · Анатомия риска — {diag.joint.label} {diag.joint.icon}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4, lineHeight:1.5 }}>{diag.joint.description}</div>
        <div style={{ fontSize:10, color:'#fbbf24', marginTop:4 }}>Опасные структуры: {diag.joint.dangerous.join(' · ')}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Связанные движения: {diag.joint.relatedLifts.join(', ')}</div>
        {joint==='spine' && <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:10 }}>🦴 Поясница выделена: диск L4-S1 не терпит округления + shear. Нейтраль + брейсинг + ограничение глубины — база.</div>}
      </div>

      {/* 2 нагрузка */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT }}>2 · Текущая нагрузка из плана (jointStress)</div>
        <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Фаза ортопедии: <b style={{color:ACCENT}}>{PHASE_RU[diag.phase] || diag.phase}</b> · Разрешённые паттерны: {diag.allowedPatterns.join(', ') || '—'} · Заблокированы: <span style={{color:'#f87171'}}>{diag.blockedPatterns.join(', ') || 'нет'}</span></div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Лимиты ROM: {Object.keys(diag.romLimits).length? Object.entries(diag.romLimits).map(([k,v])=>`${k} ${v.min}-${v.max}°`).join(', ') : 'нет'} · Стресс-лимиты: {Object.entries(diag.stressLimits).slice(0,3).map(([k,v])=>`${k}:${v}`).join(', ')}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Пример упражнений каталога с high jointStress для этого сустава:</div>
        <div style={{ fontSize:10, color:DIM }}>{EXERCISE_CATALOG.filter(e=>e.jointStress==='high' && (e.group==='legs' && joint==='knee' || e.group==='back' && joint==='spine' || e.group==='chest' && joint==='shoulder')).slice(0,3).map(e=>e.name).join(' · ') || '—'}</div>
      </div>

      {/* 3 геометрия → сустав */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:JOINT_COLOR[joint] }}>3 · Геометрия → нагрузка на {diag.joint.label}</div>
        {opts.length===0 ? <div style={{ fontSize:10, color:DIM }}>Нет специфичных опций — используйте технику из JointMaster жима/приседа.</div> : opts.map(o=>{
          const sel = selected[o.id] ?? [];
          return (
          <div key={o.id} style={{ marginTop:8, padding:8, borderRadius:7, background:'rgba(255,255,255,0.02)', border:`1px solid ${JOINT_COLOR[joint]}18` }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff' }}>{o.label} <span style={{ fontSize:8, color: o.level==='critical'?'#ef4444': o.level==='high'?'#f97316':DIM, border:`1px solid ${o.level==='critical'?'#ef4444':'rgba(255,255,255,0.1)'}`, padding:'1px 5px', borderRadius:4, marginLeft:6 }}>{LEVEL_RU[o.level] || o.level}</span></div>
            <div style={{ fontSize:9, color:DIM, marginTop:2 }}>{o.description}</div>
            <div style={{ fontSize:9, color:JOINT_COLOR[joint], marginTop:3 }}>📋 {o.method}</div>
            <div style={{ fontSize:9, color:DIM, marginTop:2 }}>🧠 {o.rationale}</div>
            <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
              {o.assistance.map(name=>{
                const on = sel.includes(name);
                return <button key={name} onClick={()=>{
                  setSelected(cur=>{
                    const curSel = cur[o.id] ?? [];
                    const next = on ? curSel.filter(x=>x!==name) : [...curSel, name];
                    return { ...cur, [o.id]: next };
                  });
                }} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border: on?`1px solid ${JOINT_COLOR[joint]}`:'1px solid rgba(255,255,255,0.1)', background: on?`${JOINT_COLOR[joint]}22`:'transparent', color: on? JOINT_COLOR[joint]:DIM }}>{name}{on?' ✓':''}</button>;
              })}
            </div>
          </div>
        );})}
        <button onClick={()=>{
          const map: Record<string,string[]> = {}; let total=0;
          for (const [k,v] of Object.entries(selected)) if (v.length) { map[k]=v; total+=v.length; }
          if (total===0) { // если ничего не выбрано — берём первую помощь каждой опции
            for (const o of opts) map[o.id]=[o.assistance[0]];
            total = opts.length;
          }
          // используем limiter канал: joint-коррективы как limiiter с протоколом опции
          const limiterExerciseMap: Record<string,string[]> = {};
          const limiterProtocolMap: Record<string,{protocol:any; category:string}> = {};
          for (const o of opts) if (map[o.id]?.length) {
            const k = `${o.joint}|joint|${o.id}`;
            limiterExerciseMap[k]=map[o.id];
            limiterProtocolMap[k]={ protocol: o.protocol as any, category:'joint' };
          }
          applyToPlanner({ kind:'limiter', label:`Сустав ${diag.joint.label}: ${total} корр.`, data:{ limiterExerciseMap, limiterProtocolMap, limiterDayMap:{} } as any });
        }} style={{ marginTop:8, width:'100%', minHeight:36, border:'none', borderRadius:8, cursor:'pointer', background: ACCENT, color:'#000', fontWeight:800, fontSize:11 }}>
          🛠 Добавить коррекции в PL-авто ({Object.values(selected).reduce((a,b)=>a+b.length,0) || opts.length} авт.)
        </button>
      </div>

      {/* 4 прехаб */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa' }}>4 · Прехаб / мобильность для {diag.joint.label}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Тесты: {diag.mobilityTests.map(t=>t.title).join(', ') || '—'}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Слабые (последняя оценка): {diag.weakest.map(w=>`${w.test.title} ${w.score}/2`).join(', ') || 'нет данных — пройдите оценку в «Мобильность»'}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Потоки: {diag.flows.map(f=>f.name).join(', ') || '—'}</div>
      </div>

      {/* 4b недельный план нагрузки (orthopedic-load) */}
      <div style={CARD}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <div style={{ fontSize:11, fontWeight:800, color:ACCENT }}>4b · Недельный план (нагрузка)</div>
          <div style={{ display:'flex', gap:4 }}>
            {(['strength','hypertrophy','rehab'] as const).map(g=>{ const on=weekGoal===g; const ru = g==='strength'?'Сила': g==='hypertrophy'?'Масса':'Реабилитация'; return <button key={g} onClick={()=>setWeekGoal(g)} style={{ padding:'3px 7px', borderRadius:6, cursor:'pointer', fontSize:9, border: on?'1px solid #00e68a':'1px solid rgba(255,255,255,0.1)', background: on?'rgba(0,230,138,0.15)':'transparent', color: on?'#00e68a':DIM}}>{ru}</button>; })}
          </div>
        </div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Фаза: <b style={{color:ACCENT}}>{PHASE_RU[diag.phase] || diag.phase}</b> · Риск: {weekPlan.warnings.join(' · ') || 'нет'} · Тяжёлых дней: {weekPlan.hardDays}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginTop:6 }}>
          {weekPlan.weekPlan.map(d=>(
            <div key={d.day} style={{ padding:'6px 4px', borderRadius:6, background: d.difficulty==='hard'?'rgba(239,68,68,0.12)': d.difficulty==='medium'?'rgba(251,191,36,0.12)': d.difficulty==='light'?'rgba(56,189,248,0.12)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', textAlign:'center' }}>
              <div style={{ fontSize:8, color:DIM }}>Д{d.day}</div>
              <div style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{d.difficulty==='off'?'—':`V${d.volumeTarget}`}</div>
              <div style={{ fontSize:8, color:DIM }}>{DIFF_RU[d.difficulty] || d.focus}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5 видео гид для сустава */}
      <div style={{ marginTop:8 }}>
        <VideoCaptureCard lift={lift as Lift} />
      </div>

      {/* 0 JSI — встроен сразу */}
      <div style={{ marginTop:12, padding:8, borderRadius:10, background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.18)' }}>
        <div style={{ fontSize:11, fontWeight:800, color:'#f43f5e' }}>0 · JSI — тепловая карта износа сустава (ввод → карта)</div>
        <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Вес×объём×темп×геометрия×фарма×боль → персональный индекс по каждому суставу + тюнинг + нутрицевтики. Часть единого инструмента, переключение не нужно.</div>
      </div>
      <JointJsiCalculatorCard />
      </>)}
    </div>
  );
};

export default JointMasterCard;
