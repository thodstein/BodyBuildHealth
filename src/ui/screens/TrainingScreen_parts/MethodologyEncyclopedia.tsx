/**
 * MethodologyEncyclopedia.tsx — энциклопедия тренировочных методик по категориям
 * (Периодизация, Прогрессия, Интенсивность, Техника, Объём, Частота, Специализация)
 * с подробным описанием и кнопкой «Применить к планировщику».
 */
import React, { useMemo, useState } from 'react';
import { getTrainingMethods } from '../../../engines/training-methodology.engine';
import { ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from './planner-bridge';
import ConjugateDesigner from './ConjugateDesigner';

const CAT: { id: string; label: string; icon: string }[] = [
  { id: 'periodization', label: 'Периодизация', icon: '🗓️' },
  { id: 'progression', label: 'Прогрессия', icon: '📈' },
  { id: 'intensity', label: 'Интенсивность', icon: '🔥' },
  { id: 'technique', label: 'Техника', icon: '🎯' },
  { id: 'volume', label: 'Объём', icon: '📦' },
  { id: 'frequency', label: 'Частота', icon: '🔁' },
  { id: 'specialization', label: 'Специализация', icon: '🎯' },
  { id: 'recovery', label: 'Восстановление', icon: '🔄' },
  { id: 'mobility', label: 'Мобильность', icon: '🤸' },
  { id: 'mindset', label: 'Психология', icon: '🧠' },
];

const CAT_LABEL: Record<string, string> = {
  periodization: 'Периодизация', progression: 'Прогрессия', intensity: 'Интенсивность',
  technique: 'Техника', volume: 'Объём', frequency: 'Частота', specialization: 'Специализация',
  recovery: 'Восстановление', mobility: 'Мобильность', mindset: 'Психология',
};

const EV_COLOR: Record<string, string> = { A: '#22c55e', B: '#eab308', C: '#f97316' };
const EV_LABEL: Record<string, string> = { A: 'доказательность A', B: 'доказательность B', C: 'доказательность C' };

export const MethodologyEncyclopedia: React.FC = () => {
  const methods = useMemo(() => getTrainingMethods(), []);
  const [cat, setCat] = useState<string>('specialization');
  const [applied, setApplied] = useState<Record<string, string>>({});
  const list = methods.filter(m => m.category === cat);

  const handleApply = (m: { name: string; category: string }) => {
    applyToPlanner({ kind: 'methodology', label: m.name + ' (' + (CAT_LABEL[m.category] || m.category) + ')', data: { methodName: m.name, category: m.category } });
    setApplied(p => ({ ...p, [m.category]: m.name }));
    setTimeout(() => setApplied(p => { const n = { ...p }; delete n[m.category]; return n; }), 3000);
  };

  return (
    <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 12, margin: '6px 0' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a', margin: '0 0 8px' }}>🧠 Энциклопедия тренировочных методик</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {CAT.map(c => {
          const on = cat === c.id;
          const cnt = methods.filter(m => m.category === c.id).length;
          return <button key={c.id} onClick={() => setCat(c.id)} style={{ padding: '6px 12px', borderRadius: 16, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)', color: on ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>{c.icon} {c.label} ({cnt})</button>;
        })}
      </div>
      {list.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Нет методов в категории.</div>}
      {list.map((m, i) => (
        <ExpandableCard key={i} title={m.name} icon="" accent={EV_COLOR[m.evidenceLevel] || '#00e68a'}
          short={<><span style={{ fontSize: 10, color: EV_COLOR[m.evidenceLevel], fontWeight: 700, marginRight: 6 }}>{EV_LABEL[m.evidenceLevel]}</span>{m.description}</>}
          full={<div>
            <div style={{ marginBottom: 6 }}><b style={{ color: '#00e68a' }}>Как работает:</b> {m.howItWorks}</div>
            <div style={{ marginBottom: 6 }}><b style={{ color: '#00e68a' }}>Кому подходит:</b> {m.bestFor}</div>
            <div style={{ marginBottom: 6 }}><b style={{ color: '#00e68a' }}>Пример:</b> {m.example}</div>
            {m.popularizedBy && <div style={{ marginBottom: 6, fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>Популяризатор: {m.popularizedBy}</div>}
            {m.caveats.length > 0 && <div><b style={{ color: '#ef4444' }}>Осторожно:</b> <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{m.caveats.map((c, j) => <li key={j}>{c}</li>)}</ul></div>}
            {m.name.toLowerCase().includes('westside') ? (
              <div style={{ marginTop: 8, padding: 10, background: 'rgba(255,107,53,0.06)', borderRadius: 10, border: '1px solid rgba(255,107,53,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#ff6b35', marginBottom: 4 }}>⚡ Генератор конъюгата (Westside)</div>
                <ConjugateDesigner />
              </div>
            ) : (
              <button onClick={() => handleApply(m)} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: applied[m.category] === m.name ? 'rgba(0,230,138,0.3)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: applied[m.category] === m.name ? '#00e68a' : '#000', transition: 'all 0.2s', width: '100%' }}>
                {applied[m.category] === m.name ? '✅ Применена к планировщику' : '🛠 Применить к планировщику'}
              </button>
            )}
          </div>}
        />
      ))}
    </div>
  );
};

export default MethodologyEncyclopedia;
