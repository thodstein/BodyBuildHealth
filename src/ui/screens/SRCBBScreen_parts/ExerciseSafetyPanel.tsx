/**
 * ExerciseSafetyPanel.tsx — BB10: выбор/оценка безопасности упражнения (Этап INT6).
 * REUSE movement-engines (classifyMovement/getMuscleSynergy/getJointStress/assessSafety) + biomechanics-risk-engine (quickSafetyCheck).
 */
import React, { useMemo, useState } from 'react';
import { classifyMovement, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { quickSafetyCheck } from '../../../engines/biomechanics-risk-engine';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const SEL: React.CSSProperties = { ...IN, minHeight: 40 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.4 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

const EX_IDS = ['back_squat','front_squat','goblet_squat','leg_press','deadlift','romanian_deadlift','hip_thrust','bench_press','dumbbell_bench','push_up','barbell_row','seated_row','overhead_press','lateral_raise','pull_up','lat_pulldown','walking_lunge','bicep_curl','tricep_extension','face_pull'];

const lvlColor = (l: string) => l === 'low' ? ACCENT : l === 'moderate' || l === 'medium' ? '#f59e0b' : '#ef4444';
const RU: Record<string, string> = { knee: 'колено', hip: 'тазобедренное', spine: 'позвоночник', shoulder: 'плечо', elbow: 'локоть', ankle: 'голеностоп' };

export const ExerciseSafetyPanel: React.FC = () => {
  const [exId, setExId] = useState('back_squat');
  const [technique, setTechnique] = useState(0.8);
  const [injuries, setInjuries] = useState('');
  const injArr = injuries.split(',').map(s => s.trim()).filter(Boolean);

  const cls = useMemo(() => classifyMovement(exId), [exId]);
  const syn = useMemo(() => getMuscleSynergy(exId), [exId]);
  const stress = useMemo(() => getJointStress(exId), [exId]);
  const safety = useMemo(() => assessSafety(exId, injArr, technique), [exId, injArr, technique]);
  const quick = useMemo(() => {
    const snap: Record<string, string> = {};
    (['knee', 'hip', 'spine', 'shoulder', 'elbow', 'ankle'] as const).forEach(j => { snap[j] = stress[j].level; });
    return quickSafetyCheck(exId, snap);
  }, [exId, stress]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
        <div><div style={LABEL}>Упражнение</div><select style={SEL} value={exId} onChange={e => setExId(e.target.value)}>
          {EX_IDS.map(id => <option key={id} value={id}>{id}</option>)}
        </select></div>
        <div><div style={LABEL}>Техника 0-1</div><input style={IN} type="number" min={0} max={1} step={0.05} value={technique} onChange={e => setTechnique(+e.target.value)} /></div>
        <div style={{ gridColumn: 'span 1' }}></div>
        <div style={{ gridColumn: 'span 3' }}><div style={LABEL}>Травмы (knee, spine, shoulder…)</div><input style={IN} value={injuries} onChange={e => setInjuries(e.target.value)} placeholder="например: knee, shoulder" /></div>
      </div>

      <div style={CARD}>
        <div style={H}>📐 Классификация движения</div>
        <div style={ROW}><span>Паттерн</span><span style={{ color: ACCENT }}>{cls.pattern}</span></div>
        <div style={ROW}><span>Плоскость</span><span>{cls.plane}</span></div>
        <div style={ROW}><span>Нагрузка</span><span>{cls.loadType}</span></div>
        <div style={ROW}><span>Сложность</span><span style={{ color: lvlColor(cls.complexity) }}>{cls.complexity}</span></div>
        <div style={ROW}><span>Опора</span><span>{cls.groundingPattern}</span></div>
        <div style={ROW}><span>Суставы</span><span style={{ fontSize: 11 }}>{cls.primaryJoints.map(j => RU[j] || j).join(', ') || '—'}</span></div>
      </div>

      <div style={CARD}>
        <div style={H}>🧠 Мышечная синергия</div>
        <div style={ROW}><span>Первичные</span><span style={{ color: ACCENT, fontSize: 11 }}>{syn.primary.join(', ') || '—'}</span></div>
        <div style={ROW}><span>Вторичные</span><span style={{ fontSize: 11 }}>{syn.secondary.join(', ') || '—'}</span></div>
        <div style={ROW}><span>Стабилизаторы</span><span style={{ fontSize: 11 }}>{syn.stabilizers.join(', ') || '—'}</span></div>
        <div style={ROW}><span>Антагонисты</span><span style={{ fontSize: 11 }}>{syn.antagonists.join(', ') || '—'}</span></div>
      </div>

      <div style={CARD}>
        <div style={H}>🦴 Нагрузка на суставы</div>
        {(['knee', 'hip', 'spine', 'shoulder', 'elbow', 'ankle'] as const).map(j => (
          <div key={j} style={ROW}>
            <span>{RU[j]}</span>
            <span style={{ color: lvlColor(stress[j].level), fontWeight: 700 }}>{stress[j].level}</span>
          </div>
        ))}
      </div>

      <div style={{ ...CARD, borderColor: lvlColor(safety.level) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={H}>🛡 Безопасность</div>
          <div style={{ color: lvlColor(safety.level), fontWeight: 700, fontSize: 15 }}>{safety.score}/100 · {safety.level}</div>
        </div>
        {safety.requiresSpotter && <div style={{ ...SMALL, color: '#f59e0b' }}>⚠ Требуется страховщик</div>}
        {safety.contraindications.length > 0 && <div style={{ marginTop: 6 }}><div style={LABEL}>Противопоказания:</div>{safety.contraindications.map((c, i) => <div key={i} style={{ ...SMALL, color: '#ef4444' }}>• {c}</div>)}</div>}
        {safety.precautions.length > 0 && <div style={{ marginTop: 6 }}><div style={LABEL}>Меры предосторожности:</div>{safety.precautions.map((p, i) => <div key={i} style={SMALL}>• {p}</div>)}</div>}
        <div style={{ ...ROW, marginTop: 6, borderBottom: 'none' }}><span>Быстрая проверка</span><span style={{ color: quick.safe ? ACCENT : '#ef4444' }}>{quick.safe ? '✅ допустимо' : '🛑 ' + quick.reason}</span></div>
      </div>
    </div>
  );
};

export default ExerciseSafetyPanel;
