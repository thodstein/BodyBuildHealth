/** MixPresetsCard.tsx — пресеты тренировочных миксов по цели (ранее неиспользуемые).
 * REUSE training-mix-scoring: getDefaultTemplate/MIX_TEMPLATES/resolveTemplateItems
 * (TrainingMixTab использовал buildDefaultStack, но НЕ getDefaultTemplate/resolveTemplateItems). */
import React, { useState, useMemo } from 'react';
import { getDefaultTemplate, resolveTemplateItems, type MixTemplate } from '../../../engines/training-mix-scoring.engine';
import { loadTrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

const GOALS: { id: string; label: string; icon: string }[] = [
  { id: 'fat_loss', label: 'Жиросжигание', icon: '🔥' },
  { id: 'joint', label: 'Суставы/связки', icon: '🦵' },
  { id: 'gut', label: 'ЖКТ', icon: '🫃' },
  { id: 'sleep', label: 'Сон', icon: '😴' },
  { id: 'hydration', label: 'Гидратация', icon: '💧' },
  { id: 'recovery', label: 'Восстановление', icon: '🧘' },
];

const TIMING_RU: Record<string, string> = { pre: 'До тренировки', intra: 'Во время', post: 'После' };

export const MixPresetsCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [goal, setGoal] = useState('fat_loss');
  const [bw, setBw] = useState(prof.bodyWeight || 80);
  const [mult, setMult] = useState(1);

  const tpl: MixTemplate | undefined = useMemo(() => getDefaultTemplate(goal), [goal]);
  const phases = useMemo(() => {
    if (!tpl) return null;
    return {
      pre: resolveTemplateItems(tpl.pre, mult, bw),
      intra: resolveTemplateItems(tpl.intra, mult, bw),
      post: resolveTemplateItems(tpl.post, mult, bw),
    };
  }, [tpl, mult, bw]);

  const Item = ({ r }: { r: { name: string; id: string; dose: string; unit: string; note: string; mg: number } }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{r.name}</div>
        <div style={{ fontSize: 9, color: DIM }}>{r.note}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>{r.dose}{r.unit}</div>
        <div style={{ fontSize: 8, color: DIM }}>{r.mg >= 1000 ? (r.mg/1000).toFixed(1)+'г' : r.mg+'мг'}</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🧪 Пресеты тренировочных миксов</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Готовые составы (pre/intra/post) под цель: жиросжигание, суставы, ЖКТ, сон, гидратация, восстановление. Ранее getDefaultTemplate/MIX_TEMPLATES/resolveTemplateItems не использовались в UI (TrainingMixTab использует buildDefaultStack).
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {GOALS.map(g => (
            <button key={g.id} onClick={() => setGoal(g.id)} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: goal === g.id ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: goal === g.id ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)', color: goal === g.id ? '#00e68a' : DIM }}>{g.icon} {g.label}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><div style={LABEL}>Вес тела, кг</div><input type="number" style={IN} value={bw} onChange={e => setBw(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Множитель дозы</div><input type="number" step="0.1" min="0.5" max="2" style={IN} value={mult} onChange={e => setMult(parseFloat(e.target.value) || 1)} /></div>
        </div>
      </div>

      {tpl && phases && (
        <div style={CARD}>
          <div style={H}>{tpl.name}</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>{tpl.description}</div>
          {(['pre', 'intra', 'post'] as const).map(t => {
            const items = phases[t];
            if (!items || items.length === 0) return null;
            return (
              <div key={t} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, margin: '6px 0 4px' }}>⏱️ {TIMING_RU[t]} ({items.length})</div>
                {items.map((r, i) => <Item key={i} r={r} />)}
              </div>
            );
          })}
        </div>
      )}
      {!tpl && <div style={CARD}><div style={{ color: DIM, fontSize: 11 }}>Для этой цели пресета нет.</div></div>}
    </div>
  );
};
