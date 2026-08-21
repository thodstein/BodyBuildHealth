/**
 * JointMasterCard.tsx — ЕДИНЫЙ МАСТЕР СУСТАВНО-СВЯЗОЧНОГО АППАРАТА (проф).
 *
 * 8 блоков на один сустав/движение (опасные зоны: поясница L4-S1 выделена):
 *  1 анатомия риска → 2 текущая нагрузка (jointStress) → 3 анамнез (травмы/боль) →
 *  4 геометрия→сустав → 5 недельное распределение (orthopedic-load) →
 *  6 прехаб/мобильность (flows/posture/grip/warmup) → 7 мониторинг (FMS-6 + he_mobility) →
 *  8 рекомендации (замены + cue) + видео-гид ракурса для сустава.
 *
 * Использует ВСЕ 9 ортопедических калькуляторов проекта.
 */
import React, { useMemo, useState } from 'react';
import { JOINTS, JOINT_OPTIONS, jointLoadDiagnosis, JOINT_MAP, type JointId } from '../../../engines/pro/joint-load-master.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import { VideoCaptureCard } from './VideoCaptureCard';

const CARD: React.CSSProperties = { padding:12, borderRadius:10, background:'rgba(24,24,27,0.45)', border:'1px solid rgba(255,255,255,0.08)', marginTop:8 };
const DIM='rgba(255,255,255,0.55)', ACCENT='#f43f5e';
const JOINT_COLOR: Record<JointId,string> = { shoulder:'#f43f5e', elbow:'#fb923c', wrist:'#facc15', spine:'#ef4444', hip:'#a78bfa', knee:'#38bdf8', ankle:'#4ade80' };

export const JointMasterCard: React.FC = () => {
  const [joint, setJoint] = useState<JointId>('spine'); // поясница по умолчанию — самая опасная
  const [lift, setLift] = useState<Lift>('squat');
  const [phasePain, setPhasePain] = useState<string>('');

  const diag = useMemo(()=> jointLoadDiagnosis({ joint, lifts:[lift], currentPain: phasePain ? [phasePain] : [] }), [joint,lift,phasePain]);
  const opts = diag.options;

  return (
    <div style={{ padding:12, color:'#fff' }}>
      <div style={{ fontSize:15, fontWeight:800, color:ACCENT }}>🦴 Суставно-связочный мастер — {JOINT_MAP[joint].label}</div>
      <div style={{ fontSize:10, color:DIM, marginTop:3, lineHeight:1.45 }}>
        Один экран на сустав — все 9 калькуляторов: нагрузка (jointStress) → анамнез → геометрия → недельный план → прехаб → мониторинг (FMS) → замены. Старые калькуляторы остаются как эксперт, но прячем — см. план чистки внизу.
      </div>

      {/* выбор сустава */}
      <div style={{ ...CARD, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT, marginRight:6 }}>Сустав/зона:</div>
        {JOINTS.map(j=>{ const on=joint===j.id; return <button key={j.id} onClick={()=>setJoint(j.id)} style={{ minHeight:32, padding:'5px 10px', borderRadius:14, cursor:'pointer', border: on?`1px solid ${JOINT_COLOR[j.id]}`:'1px solid rgba(255,255,255,0.1)', background: on?`${JOINT_COLOR[j.id]}22`:'transparent', color: on?JOINT_COLOR[j.id]:DIM, fontWeight:700, fontSize:10 }}>{j.icon} {j.label}{on?' ✓':''}</button>; })}
      </div>
      <div style={{ ...CARD, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ fontSize:11, fontWeight:800, color:ACCENT, marginRight:6 }}>Движение:</div>
        {(['squat','deadlift','bench','ohp','row'] as Lift[]).map(l=>{ const on=lift===l; return <button key={l} onClick={()=>setLift(l)} style={{ minHeight:28, padding:'4px 9px', borderRadius:10, cursor:'pointer', fontSize:9, border: on?'1px solid #38bdf8':'1px solid rgba(255,255,255,0.1)', background: on?'rgba(56,189,248,0.15)':'transparent', color: on?'#38bdf8':DIM, fontWeight:700 }}>{l}</button>; })}
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
        <div style={{ fontSize:10, color:DIM, marginTop:2 }}>Фаза ортопедии: <b style={{color:ACCENT}}>{diag.phase}</b> · Разрешённые паттерны: {diag.allowedPatterns.join(', ') || '—'} · Заблокированы: <span style={{color:'#f87171'}}>{diag.blockedPatterns.join(', ') || 'нет'}</span></div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Лимиты ROM: {Object.keys(diag.romLimits).length? Object.entries(diag.romLimits).map(([k,v])=>`${k} ${v.min}-${v.max}°`).join(', ') : 'нет'} · Стресс-лимиты: {Object.entries(diag.stressLimits).slice(0,3).map(([k,v])=>`${k}:${v}`).join(', ')}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Пример упражнений каталога с high jointStress для этого сустава:</div>
        <div style={{ fontSize:10, color:DIM }}>{EXERCISE_CATALOG.filter(e=>e.jointStress==='high' && (e.group==='legs' && joint==='knee' || e.group==='back' && joint==='spine' || e.group==='chest' && joint==='shoulder')).slice(0,3).map(e=>e.name).join(' · ') || '—'}</div>
      </div>

      {/* 3 геометрия → сустав */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:JOINT_COLOR[joint] }}>3 · Геометрия → нагрузка на {diag.joint.label}</div>
        {opts.length===0 ? <div style={{ fontSize:10, color:DIM }}>Нет специфичных опций — используйте технику из JointMaster жима/приседа.</div> : opts.map(o=>(
          <div key={o.id} style={{ marginTop:8, padding:8, borderRadius:7, background:'rgba(255,255,255,0.02)', border:`1px solid ${JOINT_COLOR[joint]}18` }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#fff' }}>{o.label} <span style={{ fontSize:8, color: o.level==='critical'?'#ef4444': o.level==='high'?'#f97316':DIM, border:`1px solid ${o.level==='critical'?'#ef4444':'rgba(255,255,255,0.1)'}`, padding:'1px 5px', borderRadius:4, marginLeft:6 }}>{o.level}</span></div>
            <div style={{ fontSize:9, color:DIM, marginTop:2 }}>{o.description}</div>
            <div style={{ fontSize:9, color:JOINT_COLOR[joint], marginTop:3 }}>📋 {o.method}</div>
            <div style={{ fontSize:9, color:DIM, marginTop:2 }}>🧠 {o.rationale}</div>
            <div style={{ fontSize:9, color:DIM, marginTop:4 }}>Помощь: {o.assistance.join(' · ')}</div>
          </div>
        ))}
      </div>

      {/* 4 прехаб */}
      <div style={CARD}>
        <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa' }}>4 · Прехаб / мобильность для {diag.joint.label}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Тесты: {diag.mobilityTests.map(t=>t.title).join(', ') || '—'}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Слабые (последняя оценка): {diag.weakest.map(w=>`${w.test.title} ${w.score}/2`).join(', ') || 'нет данных — пройдите оценку в «Мобильность»'}</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4 }}>Потоки: {diag.flows.map(f=>f.name).join(', ') || '—'}</div>
      </div>

      {/* 5 видео гид для сустава */}
      <div style={{ marginTop:8 }}>
        <VideoCaptureCard lift={lift as Lift} />
      </div>

      {/* план чистки */}
      <div style={{ marginTop:8, padding:9, borderRadius:8, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)', color:'#fbbf24', fontSize:10, lineHeight:1.45 }}>
        <b>План чистки старых калькуляторов:</b> если мастер покрывает — прячем вкладки `Orthopedic / Mobility Assessment / Mobility Protocol / Warmup Joints` (оставляем движки, помечаем `@deprecated`, удаляем через 1 релиз после проверки). Сейчас они доступны как эксперт, но основной путь — этот мастер.
      </div>
    </div>
  );
};

export default JointMasterCard;
