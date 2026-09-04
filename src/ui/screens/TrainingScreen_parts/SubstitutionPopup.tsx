import React from 'react';
import { EXERCISE_CATALOG, getSubstitutes, getExerciseById } from '../../../core/exercise-catalog';
import { getExerciseBio, type ExerciseBio } from '../../../data/exercise-biomechanics-db';

const ACCENT = '#00e68a';
const DIM = '#fff';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)',
};
const sheet: React.CSSProperties = {
  width: '90%', maxWidth: 420, maxHeight: '80vh', borderRadius: 16,
  background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
};
const sheetBody: React.CSSProperties = {
  padding: '14px 16px', maxHeight: 'calc(80vh - 3px)', overflowY: 'auto',
};

interface SubOption {
  id: string;
  name: string;
  reason: string;
  group: string;
  type: string;
  equipment: string;
  difficulty: string;
  jointStress: string;
  technique?: string;
  description?: string;
}

interface Props {
  exerciseName: string;
  group: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const DIFF_COLORS: Record<string, string> = {
  beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444', professional: '#a855f7',
};

const STRESS_ICONS: Record<string, string> = {
  low: '🟢', med: '🟡', high: '🔴',
};

const STRESS_KEYS_RU: Record<string, string> = {
  knee: 'колено', hip: 'таз', spine: 'позвоночник', shoulder: 'плечо', elbow: 'локоть', ankle: 'голеностоп',
};

// Биомеханическая карточка упражнения (как в Exercise Lab)
const BioLine: React.FC<{ bio?: ExerciseBio }> = ({ bio }) => {
  if (!bio) return null;
  const js = bio.jointStress;
  const strs = Object.entries(js || {}).map(([k, v]) => `${STRESS_KEYS_RU[k] || k} ${v}/10`);
  return (
    <div style={{ marginBottom: 4, background: 'rgba(59,130,246,0.04)', borderRadius: 8, padding: '5px 8px', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
      🔬 Биомеханика: {strs.join(', ')} | Сложность: {bio.difficulty}/10 | ЦНС: {bio.cnsDemand}/5
      {bio.primaryMuscles?.length > 0 && <div style={{ marginTop: 2 }}>🎯 Цель: {bio.primaryMuscles.join(', ')}{bio.secondaryMuscles?.length ? ' + ' + bio.secondaryMuscles.join(', ') : ''}</div>}
    </div>
  );
};

export const SubstitutionPopup: React.FC<Props> = ({ exerciseName, group, onSelect, onClose }) => {
  const cat = EXERCISE_CATALOG.find(c => c.name === exerciseName) || getExerciseById(exerciseName);
  if (!cat) {
    return (
      <div className="train-subspopup" style={overlay} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={sheet}>
          <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},#00c853)` }} />
          <div style={sheetBody}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Упражнение не найдено</div>
            <button onClick={onClose}
              style={{ width: '100%', padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: `linear-gradient(135deg,${ACCENT},#00c853)`, color: '#000' }}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  const opts: SubOption[] = [];

  // 1. canReplace / getSubstitutes
  const sub = getSubstitutes(cat.id);
  if (sub) {
    for (const s of sub.substitutes) {
      if (opts.find(o => o.id === s.id)) continue;
      const rep = getExerciseById(s.id);
      if (rep) {
        opts.push({
          id: rep.id, name: rep.name, reason: s.reason, group: rep.group,
          type: rep.type, equipment: rep.equipment, difficulty: rep.difficulty,
          jointStress: rep.jointStress, technique: (rep as any).technique,
          description: (rep as any).description || (rep as any).comments,
        });
      }
    }
  }

  // 2. Same substitutionGroup
  const pattern = cat.movementPattern || '';
  const patternMatches = EXERCISE_CATALOG.filter(
    ex => ex.group === cat.group && ex.movementPattern === pattern && ex.id !== cat.id && !opts.find(o => o.id === ex.id)
  );
  for (const pm of patternMatches) {
    opts.push({
      id: pm.id, name: pm.name, reason: `Тот же паттерн (${pattern})`, group: pm.group,
      type: pm.type, equipment: pm.equipment, difficulty: pm.difficulty,
      jointStress: pm.jointStress, technique: (pm as any).technique,
      description: (pm as any).description || (pm as any).comments,
    });
  }

  // 3. Same group, any pattern
  if (opts.length < 4) {
    const sameGroup = EXERCISE_CATALOG.filter(
      ex => ex.group === cat.group && ex.id !== cat.id && !opts.find(o => o.id === ex.id)
    );
    for (const sg of sameGroup.slice(0, 6)) {
      opts.push({
        id: sg.id, name: sg.name, reason: 'Та же группа мышц', group: sg.group,
        type: sg.type, equipment: sg.equipment, difficulty: sg.difficulty,
        jointStress: sg.jointStress, technique: (sg as any).technique,
        description: (sg as any).description || (sg as any).comments,
      });
    }
  }

  return (
    <div className="train-subspopup-main" style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},#00c853)` }} />
        <div style={sheetBody}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>🔄 Замена упражнения</span>
              <span style={{ fontSize: 11, color: DIM, marginLeft: 8, fontWeight: 600 }}>{exerciseName}</span>
            </div>
            <button onClick={onClose}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: DIM }}>
              ✕
            </button>
          </div>

          <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', fontSize: 10, color: DIM, lineHeight: 1.5 }}>
            {cat.name}: {cat.group} · {cat.type === 'compound' ? 'базовое' : 'изолирующее'} · {cat.equipment} · нагрузка {STRESS_ICONS[cat.jointStress] || ''}{cat.jointStress}
            {(cat as any).technique && <span> · { (cat as any).technique }</span>}
          </div>

          {BioLine({ bio: getExerciseBio(cat.id) })}

          {opts.length === 0 && (
            <div style={{ fontSize: 11, color: DIM, padding: 12, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              Нет альтернатив для замены. Вы можете отредактировать упражнение вручную.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {opts.map((opt, i) => {
              const obio = getExerciseBio(opt.id);
              return (
              <button key={opt.id} onClick={() => onSelect(opt.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                  padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{opt.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase',
                    background: opt.type === 'compound' ? 'rgba(0,230,138,0.15)' : 'rgba(96,165,250,0.15)',
                    color: opt.type === 'compound' ? ACCENT : '#60a5fa',
                    border: `0.5px solid ${opt.type === 'compound' ? ACCENT : '#60a5fa'}40`,
                  }}>
                    {opt.type === 'compound' ? 'база' : 'изо'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: DIM }}>
                    {opt.equipment}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: (DIFF_COLORS[opt.difficulty] || '#666') + '20',
                    color: DIFF_COLORS[opt.difficulty] || '#666',
                  }}>
                    {opt.difficulty === 'beginner' ? 'новичок' : opt.difficulty === 'intermediate' ? 'средний' : opt.difficulty === 'advanced' ? 'продвинутый' : opt.difficulty}
                  </span>
                  <span style={{ fontSize: 10, color: opt.jointStress === 'high' ? '#ef4444' : opt.jointStress === 'med' ? '#f59e0b' : '#22c55e' }}>
                    {STRESS_ICONS[opt.jointStress] || ''} {opt.jointStress === 'high' ? 'высокая' : opt.jointStress === 'med' ? 'средняя' : 'низкая'} нагрузка
                  </span>
                </div>
                {opt.reason && (
                  <div style={{ fontSize: 10, color: '#60a5fa', fontStyle: 'italic' }}>
                    ↳ {opt.reason}
                  </div>
                )}
                {opt.technique && (
                  <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>
                    🎯 {opt.technique}
                  </div>
                )}
                {opt.description && (
                  <div style={{ fontSize: 10, color:'#fff', marginTop: 1, lineHeight: 1.4 }}>
                    📝 {opt.description}
                  </div>
                )}
                {BioLine({ bio: obio })}
              </button>
            ); })}
          </div>
        </div>
      </div>
    </div>
  );
};
