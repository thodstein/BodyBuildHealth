/** ExerciseSafetyPanel.tsx — выбор/оценка безопасности упражнения. */
import React, { useMemo, useState } from 'react';
import { classifyMovement, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { quickSafetyCheck } from '../../../engines/biomechanics-risk-engine';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, minHeight: 38, width: '100%', boxSizing: 'border-box' };
const RU: Record<string, string> = { knee: 'колено', hip: 'тазобедренное', spine: 'позвоночник', shoulder: 'плечо', elbow: 'локоть', ankle: 'голеностоп' };
const EX_IDS = ['back_squat','front_squat','goblet_squat','leg_press','deadlift','romanian_deadlift','hip_thrust','bench_press','dumbbell_bench','push_up','barbell_row','seated_row','overhead_press','lateral_raise','pull_up','lat_pulldown','walking_lunge','bicep_curl','tricep_extension','face_pull'];
const levelColor = (level: string) => level === 'low' ? ACCENT : level === 'moderate' || level === 'medium' ? '#f59e0b' : '#ef4444';

export const ExerciseSafetyPanel: React.FC = () => {
  const [exercise, setExercise] = useState('back_squat');
  const [technique, setTechnique] = useState(0.8);
  const [injuries, setInjuries] = useState('');
  const injuryList = injuries.split(',').map(value => value.trim()).filter(Boolean);
  const classification = useMemo(() => classifyMovement(exercise), [exercise]);
  const synergy = useMemo(() => getMuscleSynergy(exercise), [exercise]);
  const stress = useMemo(() => getJointStress(exercise), [exercise]);
  const safety = useMemo(() => assessSafety(exercise, injuryList, technique), [exercise, injuries, technique]);
  const quick = useMemo(() => quickSafetyCheck(exercise, Object.fromEntries(Object.entries(stress).map(([joint, value]) => [joint, value.level]))), [exercise, stress]);
  return <div>
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
      <select style={IN} value={exercise} onChange={event => setExercise(event.target.value)}>{EX_IDS.map(id => <option key={id}>{id}</option>)}</select>
      <input style={IN} type="number" min={0} max={1} step={0.05} value={technique} onChange={event => setTechnique(Number(event.target.value))} aria-label="Техника 0-1" />
      <input style={{ ...IN, gridColumn: '1 / -1' }} value={injuries} onChange={event => setInjuries(event.target.value)} placeholder="Травмы: knee, spine, shoulder" aria-label="Травмы" />
    </div>
    <div style={CARD}><b>📐 Движение</b><div>Паттерн: {classification.pattern}</div><div>Плоскость: {classification.plane}</div><div>Нагрузка: {classification.loadType}</div><div>Суставы: {classification.primaryJoints.map(joint => RU[joint] || joint).join(', ') || '—'}</div></div>
    <div style={CARD}><b>🧠 Синергия</b><div>Основные: {synergy.primary.join(', ') || '—'}</div><div>Стабилизаторы: {synergy.stabilizers.join(', ') || '—'}</div></div>
    <div style={CARD}><b>🦴 Суставной стресс</b>{(['knee','hip','spine','shoulder','elbow','ankle'] as const).map(joint => <div key={joint} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{RU[joint]}</span><b style={{ color: levelColor(stress[joint].level) }}>{stress[joint].level}</b></div>)}</div>
    <div style={{ ...CARD, borderColor: levelColor(safety.level) }}><b>🛡 Безопасность: {safety.score}/100 · {safety.level}</b>{safety.contraindications.map(item => <div key={item} style={{ color: '#ef4444' }}>• {item}</div>)}{safety.precautions.map(item => <div key={item}>• {item}</div>)}<div style={{ marginTop: 6, color: quick.safe ? ACCENT : '#ef4444' }}>{quick.safe ? '✅ Допустимо' : `🛑 ${quick.reason}`}</div></div>
  </div>;
};

export default ExerciseSafetyPanel;
