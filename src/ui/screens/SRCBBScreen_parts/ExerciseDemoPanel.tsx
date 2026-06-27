/**
 * ExerciseDemoPanel.tsx — T9: демо/медиа упражнения (браузерно).
 * REUSE exercise-demo.ts aggregator. Inline-SVG карта тела (без ассетов), mobile-first.
 */
import React, { useMemo, useState } from 'react';
import { getExerciseDemo, listExercisesByGroup, muscleToRegion, type BodyRegion } from '../../../engines/lms/exercise-demo';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '8px 10px', fontWeight: 600, fontSize: 13, minHeight: 40 };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}` };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '6px 0 3px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.4 };
const BADGE: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, marginRight: 4 };

const GROUPS = ['chest','back','legs','shoulders','arms','core'];

function BodyMapSVG({ primary, secondary }: { primary: BodyRegion[]; secondary: BodyRegion[] }) {
  const fill = (r: BodyRegion) => primary.includes(r) ? ACCENT : secondary.includes(r) ? 'rgba(0,230,138,0.35)' : '#3a3a3c';
  return (
    <svg viewBox="0 0 120 220" style={{ width: 110, height: 200, display: 'block', margin: '0 auto' }} role="img" aria-label="Карта работающих мышц">
      <circle cx="60" cy="18" r="12" fill="#4a4a4a" />
      <path d="M30 38 Q60 30 90 38 L90 50 Q60 44 30 50 Z" fill={fill('shoulders')} />
      <rect x="38" y="50" width="44" height="26" rx="6" fill={fill('chest')} />
      <rect x="22" y="50" width="12" height="50" rx="6" fill={fill('arms')} />
      <rect x="86" y="50" width="12" height="50" rx="6" fill={fill('arms')} />
      <rect x="44" y="78" width="32" height="22" rx="5" fill={fill('core')} />
      <rect x="36" y="48" width="48" height="56" rx="8" fill="none" stroke={fill('back')} strokeWidth="3" opacity="0.8" />
      <rect x="44" y="100" width="14" height="70" rx="6" fill={fill('legs')} />
      <rect x="62" y="100" width="14" height="70" rx="6" fill={fill('legs')} />
    </svg>
  );
}

export const ExerciseDemoPanel: React.FC = () => {
  const [group, setGroup] = useState('chest');
  const list = useMemo(() => listExercisesByGroup(group), [group]);
  const [exId, setExId] = useState(list[0]?.id || '');
  const demo = useMemo(() => getExerciseDemo(exId || (list[0]?.id || '')), [exId, list]);

  const primary = useMemo<BodyRegion[]>(() => demo ? [...new Set(demo.synergy.primary.map(muscleToRegion).filter(r => r !== 'other'))] : [], [demo]);
  const secondary = useMemo<BodyRegion[]>(() => demo ? [...new Set(demo.synergy.secondary.map(muscleToRegion).filter(r => r !== 'other'))] : [], [demo]);

  return (
    <div>
      <div style={H}>🎬 Демо упражнения</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {GROUPS.map(g => <button key={g} style={group === g ? BTN : BTN_GHOST} onClick={() => { setGroup(g); const l = listExercisesByGroup(g); setExId(l[0]?.id || ''); }}>{g}</button>)}
      </div>
      <select style={SEL} value={exId} onChange={e => setExId(e.target.value)}>
        {list.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      {demo ? (
        <div style={CARD}>
          <div style={H}>{demo.name}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <BodyMapSVG primary={primary} secondary={secondary} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ ...BADGE, background: 'rgba(0,230,138,0.15)', color: ACCENT }}>{demo.type}</span>
                <span style={{ ...BADGE, background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>{demo.equipment}</span>
                <span style={{ ...BADGE, background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>{demo.difficulty}</span>
              </div>
              {demo.targetMuscle && <div style={SMALL}><b>Целевая мышца:</b> {demo.targetMuscle}</div>}
              {demo.synergy.primary.length > 0 && <div style={SMALL}><b>Основные:</b> {demo.synergy.primary.join(', ')}</div>}
              {demo.synergy.secondary.length > 0 && <div style={SMALL}><b>Вторичные:</b> {demo.synergy.secondary.join(', ')}</div>}
              <div style={SMALL}><b>Суставы:</b> {demo.jointStressLabel} · <b>Усталость:</b> {demo.fatigueCost}/10</div>
            </div>
          </div>

          {demo.technique && <div style={{ marginTop: 8 }}><div style={LABEL}>⚙️ Техника</div><div style={SMALL}>{demo.technique}</div></div>}
          {demo.comments && <div style={{ marginTop: 6 }}><div style={LABEL}>💡 Комментарий</div><div style={SMALL}>{demo.comments}</div></div>}

          {demo.cues.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={LABEL}>✅ Ключи техники</div>
              {demo.cues.map((c, i) => <div key={i} style={SMALL}>• {c.cue}{c.category ? ` (${c.category})` : ''}{c.priority === 'critical' ? ' ⚠️' : ''}</div>)}
            </div>
          )}
          {demo.commonErrors && demo.commonErrors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={LABEL}>⚠️ Частые ошибки</div>
              {demo.commonErrors.slice(0, 6).map((e, i) => <div key={i} style={SMALL}>• <b>{e.error}</b> — {e.fix}</div>)}
            </div>
          )}
          {demo.progression.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={LABEL}>📈 Прогрессия</div>
              {demo.progression.slice(0, 4).map((p, i) => <div key={i} style={SMALL}>{i + 1}. {p}</div>)}
            </div>
          )}
          {demo.substitutes.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={LABEL}>🔄 Замены</div>
              <div style={SMALL}>{demo.substitutes.join(', ')}</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...SMALL, padding: 20, textAlign: 'center' }}>Выберите упражнение.</div>
      )}
    </div>
  );
};

export default ExerciseDemoPanel;
