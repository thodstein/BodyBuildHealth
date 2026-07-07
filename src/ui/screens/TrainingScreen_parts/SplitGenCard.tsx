/** SplitGenCard.tsx — генератор сплитов (ранее неиспользуемые split-engines, 0/9).
 * REUSE: generateFBW/UpperLower/PPL/Powerbuilding/Strongman/Weightlifting/CrossFit/Rehab + generateSplit. */
import React, { useState, useMemo } from 'react';
import {
  generateFBWSplit, generateUpperLowerSplit, generatePPLSplit, generatePowerbuildingSplit,
  generateStrongmanSplit, generateWeightliftingSplit, generateCrossFitSplit, generateRehabSplit,
  generateSplit, type SplitGoal, type SplitInput, type SplitOutput,
} from '../../../engines/split-engines';
import { loadTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
const IN = SEL;

const SPLIT_TYPES = [
  { id: 'auto', label: 'Авто (по цели)', fn: (i: SplitInput) => generateSplit(i) },
  { id: 'fbw', label: 'Full Body (FBW)', fn: (i: SplitInput) => generateFBWSplit(i) },
  { id: 'ul', label: 'Upper/Lower', fn: (i: SplitInput) => generateUpperLowerSplit(i) },
  { id: 'ppl', label: 'Push/Pull/Legs', fn: (i: SplitInput) => generatePPLSplit(i) },
  { id: 'pb', label: 'Powerbuilding', fn: (i: SplitInput) => generatePowerbuildingSplit(i) },
  { id: 'sm', label: 'Strongman', fn: (i: SplitInput) => generateStrongmanSplit(i) },
  { id: 'wl', label: 'Weightlifting', fn: (i: SplitInput) => generateWeightliftingSplit(i) },
  { id: 'cf', label: 'CrossFit', fn: (i: SplitInput) => generateCrossFitSplit(i) },
  { id: 'rehab', label: 'Rehab', fn: (i: SplitInput) => generateRehabSplit(i) },
];
const GOALS: SplitGoal[] = ['strength', 'hypertrophy', 'powerbuilding', 'weightlifting', 'crossfit', 'conditioning', 'technique', 'rehab'];

export const SplitGenCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [type, setType] = useState('auto');
  const [goal, setGoal] = useState<SplitGoal>('hypertrophy');
  const [days, setDays] = useState(4);
  const [weak, setWeak] = useState<string>(prof.weakPoints.join(','));

  const out: SplitOutput | null = useMemo(() => {
    const input: SplitInput = {
      daysPerWeek: days, goal, weakPoints: weak.split(',').map(s => s.trim()).filter(Boolean),
      equipmentAvailable: prof.equipment || ['barbell'],
    };
    try { const t = SPLIT_TYPES.find(s => s.id === type)!; return t.fn(input); } catch (e) { return null; }
  }, [type, goal, days, weak, prof.equipment]);

  // маппинг pattern → группа мышц (для ручного конструктора: cycle = группы по дням)
  const PATTERN_TO_GROUP: Record<string, string> = {
    squat: 'legs', lunge: 'legs', hinge: 'legs',
    horizontal_push: 'chest', vertical_push: 'shoulders',
    horizontal_pull: 'back', vertical_pull: 'back',
    carry: 'core', core: 'core', anti_rotation: 'core', rotation: 'core', accessory: '',
  };
  const [applied, setApplied] = useState(false);
  const applySplit = () => {
    if (!out) return;
    const cycle: string[][] = out.sessions.map(s => {
      const groups: string[] = [];
      for (const sl of s.slots) { const g = PATTERN_TO_GROUP[sl.pattern]; if (g && !groups.includes(g)) groups.push(g); }
      return groups;
    }).filter(g => g.length > 0);
    if (cycle.length === 0) return;
    applyToPlanner({ kind: 'split', label: 'Сплит «' + out.name + '» (' + cycle.length + ' дн)', data: { cycle, name: out.name } });
    setApplied(true); setTimeout(() => setApplied(false), 2500);
  };

  const PATTERN_RU: Record<string, string> = { squat: 'Присед', hinge: 'Тяга', horizontal_push: 'Жим г.', horizontal_pull: 'Тяга г.', vertical_push: 'Жим в.', vertical_pull: 'Тяга в.', lunge: 'Выпад', carry: 'Носка', accessory: 'Аксессуар', core: 'Кор', rotation: 'Ротация', anti_rotation: 'Анти-ротация' };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🧩 Генератор сплитов</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        9 типов сплитов (FBW / Upper-Lower / PPL / Powerbuilding / Strongman / Weightlifting / CrossFit / Rehab / авто). Ранее split-engines не использовались в UI.
      </div>

      <div style={CARD}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Тип сплита</div>
            <select style={SEL} value={type} onChange={e => setType(e.target.value)}>
              {SPLIT_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div><div style={LABEL}>Цель</div>
            <select style={SEL} value={goal} onChange={e => setGoal(e.target.value as SplitGoal)}>
              {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div><div style={LABEL}>Дней/нед</div><input type="number" min={2} max={6} style={IN} value={days} onChange={e => setDays(parseInt(e.target.value) || 0)} /></div>
        </div>
        <div><div style={LABEL}>Слабые группы (через запятую)</div><input type="text" style={IN} value={weak} onChange={e => setWeak(e.target.value)} placeholder="chest, legs" /></div>
      </div>

      {out && (
        <div style={CARD}>
          <div style={H}>{out.name}</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>{out.description}</div>
          {out.sessions.map((s, i) => (
            <div key={i} style={{ marginBottom: 8, padding: 10, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>
                День {s.dayIndex} · фокус: <span style={{ color: '#fff' }}>{s.focus}</span> · {s.priority}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {s.slots.map((sl, j) => (
                  <span key={j} style={{ padding: '4px 8px', borderRadius: 14, fontSize: 9, fontWeight: 700, border: sl.role === 'main' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.1)', background: sl.role === 'main' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)', color: sl.role === 'main' ? '#00e68a' : DIM }}>
                    {PATTERN_RU[sl.pattern] || sl.pattern}
                    <span style={{ opacity: 0.6, fontWeight: 400 }}> · {sl.role}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {out.recommendations.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {out.recommendations.map((r, i) => <div key={i} style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>• {r}</div>)}
            </div>
          )}
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>🔗 Применить этот сплит к ручному конструктору — структура дней (группы мышц) загрузится в план, конструктор подберёт упражнения.</div>
            <button onClick={applySplit} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>{applied ? '✓ Отправлено в конструктор' : '🛠 Применить к ручному конструктору'}</button>
          </div>
        </div>
      )}
    </div>
  );
};
