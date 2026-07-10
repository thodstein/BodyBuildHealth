/**
 * ConjugateDesigner.tsx — полноценный генератор конъюгата (Westside).
 * Встраивается в библиотеку методик (MethodologyEncyclopedia) как
 * интерактивная карточка внутри ExpandableCard методики "Westside Conjugate".
 */
import React, { useState, useMemo } from 'react';
import { generateConjugateProgram, getAllMEVariations, getConjugateWaveInfo, type ConjugateMode, type BandType } from '../../../engines/conjugate.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.5)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: 10, marginBottom: 8 };
const H: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 6 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 9, margin: '6px 0 3px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const PILL = (on: boolean, accent = ACCENT): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 12, fontSize: 9, fontWeight: 700, cursor: 'pointer', minHeight: 28,
  border: on ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
  background: on ? `${accent}22` : 'rgba(255,255,255,0.02)',
  color: on ? accent : 'rgba(255,255,255,0.5)',
});

const MODES: { id: ConjugateMode; label: string }[] = [
  { id: 'powerlifting', label: '🏋️ Пауэрлифтинг' },
  { id: 'bodybuilding', label: '💪 Бодибилдинг' },
];

const LIFT_OPTIONS: { id: string; label: string }[] = [
  { id: 'squat', label: 'Присед' },
  { id: 'bench', label: 'Жим' },
  { id: 'deadlift', label: 'Тяга' },
];

const WEAK_GROUPS: { id: string; label: string }[] = [
  { id: 'chest', label: 'Грудь' }, { id: 'back', label: 'Спина' },
  { id: 'legs', label: 'Ноги' }, { id: 'shoulders', label: 'Плечи' }, { id: 'arms', label: 'Руки' },
];

const BANDS: { id: BandType; label: string }[] = [
  { id: 'none', label: 'Без резины' },
  { id: 'light', label: 'Light' },
  { id: 'monster_mini', label: 'Monster Mini' },
  { id: 'mini', label: 'Mini' },
];

const DAY_COLORS: Record<string, string> = {
  me_upper: '#ff6b35', de_lower: '#3b82f6', de_upper: '#3b82f6', me_lower: '#ff6b35',
};
const DAY_ICON: Record<string, string> = {
  me_upper: '🔥', de_lower: '⚡', de_upper: '⚡', me_lower: '🔥',
};
const DAY_LABEL: Record<string, string> = {
  me_upper: 'ME Upper', de_lower: 'DE Lower', de_upper: 'DE Upper', me_lower: 'ME Lower',
};

const ConjugateDesigner: React.FC = () => {
  const [mode, setMode] = useState<ConjugateMode>('powerlifting');
  const [upperLift, setUpperLift] = useState('bench');
  const [lowerLift, setLowerLift] = useState('squat');
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [bandType, setBandType] = useState<BandType>('none');
  const [weeks, setWeeks] = useState(6);
  const [weekIdx, setWeekIdx] = useState(0);
  const [applied, setApplied] = useState(false);

  const program = useMemo(() => generateConjugateProgram(
    { upper: upperLift, lower: lowerLift }, mode, weakPoints, bandType, weeks
  ), [mode, upperLift, lowerLift, weakPoints, bandType, weeks]);

  const currentWeek = program.weeks[weekIdx] || program.weeks[0];
  const variations = getAllMEVariations();
  const waveInfo = getConjugateWaveInfo();

  const toggleWp = (id: string) => setWeakPoints(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleApply = () => {
    const label = `Westside Conjugate (${MODE_LABEL[mode]} · upper ${upperLift} · lower ${lowerLift} · ${bandType === 'none' ? 'без резины' : bandType + ' bands'})`;
    applyToPlanner({ kind: 'methodology', label, data: { methodName: 'Westside Conjugate: структура ME/DE дней', category: 'periodization' } });
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  return (
    <div style={{ marginTop: 6 }}>
      {/* Режим */}
      <div style={GLASS}>
        <div style={H}>🔁 Режим конъюгата</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={PILL(mode === m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Основные движения */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ ...GLASS, flex: 1 }}>
          <div style={LABEL}>Upper (ME/DE)</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {LIFT_OPTIONS.map(o => (
              <button key={o.id} onClick={() => setUpperLift(o.id)} style={PILL(upperLift === o.id, '#ff6b35')}>{o.label}</button>
            ))}
          </div>
        </div>
        <div style={{ ...GLASS, flex: 1 }}>
          <div style={LABEL}>Lower (ME/DE)</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {LIFT_OPTIONS.map(o => (
              <button key={o.id} onClick={() => setLowerLift(o.id)} style={PILL(lowerLift === o.id, '#3b82f6')}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Резина + недели */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ ...GLASS, flex: 1 }}>
          <div style={LABEL}>Резина/цепи (DE)</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {BANDS.map(b => (
              <button key={b.id} onClick={() => setBandType(b.id)} style={PILL(bandType === b.id, '#a78bfa')}>{b.label}</button>
            ))}
          </div>
        </div>
        <div style={{ ...GLASS, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700 }}>Недель</div>
          {[3, 6, 9, 12].map(n => (
            <button key={n} onClick={() => { setWeeks(n); setWeekIdx(0); }} style={PILL(weeks === n, '#22c55e')}>{n}</button>
          ))}
        </div>
      </div>

      {/* Слабые места */}
      <div style={GLASS}>
        <div style={LABEL}>🎯 Слабые места (акцент в RE/аксессуарах)</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {WEAK_GROUPS.map(g => (
            <button key={g.id} onClick={() => toggleWp(g.id)} style={PILL(weakPoints.includes(g.id), '#ec4899')}>{g.label}</button>
          ))}
          {weakPoints.length === 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Не выбраны — общий акцент</span>}
        </div>
      </div>

      {/* Навигация по неделям */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
          📅 Неделя {currentWeek.weekNumber} / {weeks}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button disabled={weekIdx === 0} onClick={() => setWeekIdx(Math.max(0, weekIdx - 1))} style={{ ...PILL(false), opacity: weekIdx === 0 ? 0.3 : 1 }}>◀</button>
          <button disabled={weekIdx >= weeks - 1} onClick={() => setWeekIdx(Math.min(weeks - 1, weekIdx + 1))} style={{ ...PILL(false), opacity: weekIdx >= weeks - 1 ? 0.3 : 1 }}>▶</button>
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
        ME вариации: upper <b style={{ color: '#ff6b35' }}>{currentWeek.meVariation.upper}</b> · lower <b style={{ color: '#ff6b35' }}>{currentWeek.meVariation.lower}</b>
        <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.25)' }}>Волна: {waveInfo.note}</span>
      </div>

      {/* Дни недели */}
      {currentWeek.days.map((day, di) => (
        <div key={di} style={{ ...GLASS, borderLeft: `3px solid ${DAY_COLORS[day.type] || ACCENT}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: DAY_COLORS[day.type] || '#fff' }}>
              {DAY_ICON[day.type]} {DAY_LABEL[day.type]}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{day.mainLift}</span>
          </div>
          {day.exercises.map((ex, ei) => (
            <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <span style={{ color: ex.type === 'main' ? '#fff' : 'rgba(255,255,255,0.55)', fontWeight: ex.type === 'main' ? 700 : 400 }}>
                {ex.name}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>
                {ex.sets}×{ex.reps} @{Math.round(ex.intensity * 100)}% RIR {ex.rir}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 3, fontStyle: 'italic' }}>{day.notes}</div>
        </div>
      ))}

      {/* Вариации */}
      <div style={GLASS}>
        <div style={H}>📋 Все ME-вариации</div>
        <div style={{ fontSize: 9, color: '#ff6b35', fontWeight: 700, marginBottom: 4 }}>Upper:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {variations.upper.map((v, i) => (
            <span key={i} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(255,107,53,0.08)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.15)' }}>{v}</span>
          ))}
        </div>
        <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, marginBottom: 4 }}>Lower:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {variations.lower.map((v, i) => (
            <span key={i} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.15)' }}>{v}</span>
          ))}
        </div>
      </div>

      {/* Применить */}
      <button onClick={handleApply} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: applied ? 'rgba(0,230,138,0.2)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: applied ? '#00e68a' : '#000', fontWeight: 800, fontSize: 13, minHeight: 44, transition: 'all 0.2s' }}>
        {applied ? '✅ Применён к планировщику' : '🛠 Применить конъюгат к планировщику'}
      </button>
    </div>
  );
};

const MODE_LABEL: Record<ConjugateMode, string> = { powerlifting: 'ПЛ', bodybuilding: 'ББ' };
export { MODE_LABEL };
export default ConjugateDesigner;
