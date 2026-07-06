import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, canReplace } from '../../../core/exercise-catalog';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { ACCENT, DIM, SMALL, GROUP_RU, TYPE_RU, EQUIP_RU, GROUPS } from './ExerciseLabShared';

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const DIFF_RU: Record<string, string> = { beginner: 'Начальное', intermediate: 'Среднее', advanced: 'Продвинутое' };
const EQUIP_ICON: Record<string, string> = { barbell: '🏋️', dumbbell: '💪', machine: '⚙️', cable: '🔗', bodyweight: '🧘', band: '🟢', kettlebell: '🟤', smith: '⚒️' };

const ExerciseLabCatalog: React.FC = () => {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [type, setType] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(80);

  const filtered = useMemo(() => {
    let list = EXERCISE_CATALOG;
    if (group !== 'all') list = list.filter(e => e.group === group);
    if (type !== 'all') list = list.filter(e => e.type === type);
    if (equipment !== 'all') list = list.filter(e => e.equipment === equipment);
    if (difficulty !== 'all') list = list.filter(e => e.difficulty === difficulty);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(s) || (e.targetMuscle || '').toLowerCase().includes(s));
    }
    return list;
  }, [search, group, type, equipment, difficulty]);

  const selectedEx = useMemo(() => EXERCISE_CATALOG.find(e => e.id === selectedId), [selectedId]);
  const visibleList = filtered.slice(0, visible);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🏋️ Каталог упражнений</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
        Полный каталог упражнений (~500+) с фильтрами по группе, типу, оборудованию и сложности.
        Кликните по упражнению для детальной информации.
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '8px 10px', border: '1px solid var(--border)', marginBottom: 8 }}>
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setVisible(80); }}
          placeholder="🔍 Поиск упражнений..." style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 6 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <select value={group} onChange={e => { setGroup(e.target.value); setVisible(80); }} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, fontWeight: 600, textAlign: 'center', minWidth: 0 }}>
            <option value="all">Группа</option>
            {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{GROUP_RU[g]}</option>)}
          </select>
          <select value={type} onChange={e => { setType(e.target.value); setVisible(80); }} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, fontWeight: 600, textAlign: 'center', minWidth: 0 }}>
            <option value="all">Тип</option>
            <option value="compound">Базовые</option>
            <option value="isolation">Изолирующие</option>
          </select>
          <select value={equipment} onChange={e => { setEquipment(e.target.value); setVisible(80); }} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, fontWeight: 600, textAlign: 'center', minWidth: 0 }}>
            <option value="all">Инвентарь</option>
            <option value="barbell">Штанга</option>
            <option value="dumbbell">Гантели</option>
            <option value="machine">Тренажёр</option>
            <option value="cable">Блок</option>
            <option value="bodyweight">Вес тела</option>
          </select>
          <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setVisible(80); }} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, fontWeight: 600, textAlign: 'center', minWidth: 0 }}>
            <option value="all">Сложность</option>
            <option value="beginner">Начальные</option>
            <option value="intermediate">Средние</option>
            <option value="advanced">Продвинутые</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '55vh', overflowY: 'auto', paddingRight: 2 }}>
        {visibleList.map(ex => {
          const isSelected = selectedEx?.id === ex.id;
          const equipIcon = EQUIP_ICON[ex.equipment] || '📦';
          return (
            <div key={ex.id} onClick={() => setSelectedId(isSelected ? null : ex.id)} style={{
              padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
              background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(59,130,246,0.04))' : 'var(--bg-secondary)',
              border: isSelected ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: isSelected ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {ex.type === 'compound' ? '🔩' : '🎯'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-light)', lineHeight: 1.2 }}>{ex.name}</div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{equipIcon} {EQUIP_RU[ex.equipment] || ex.equipment}</span>
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>{GROUP_RU[ex.group]}</span>
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: ex.jointStress === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: ex.jointStress === 'high' ? '#ef4444' : '#22c55e' }}>
                      {ex.jointStress === 'high' ? 'высокая' : ex.jointStress === 'med' ? 'средняя' : 'низкая'}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--text-dim)', transition: 'transform 0.15s', transform: isSelected ? 'rotate(180deg)' : 'none' }}>▼</span>
              </div>

              {isSelected && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', color: 'var(--accent)' }}>{ex.type === 'compound' ? 'Базовое' : 'Изолирующее'}</span>
                    {ex.difficulty && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: ex.difficulty === 'advanced' ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.08)', color: ex.difficulty === 'advanced' ? '#ef4444' : ex.difficulty === 'intermediate' ? '#f97316' : '#22c55e' }}>{DIFF_RU[ex.difficulty]}</span>}
                    <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>Усталость: {ex.fatigueCost}/10</span>
                    {ex.targetMuscle && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(236,72,153,0.08)', color: '#ec4899' }}>🎯 {ex.targetMuscle}</span>}
                  </div>
                  {ex.technique && <div style={{ marginBottom: 4, background: 'rgba(0,230,138,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: 'var(--text)', lineHeight: 1.4 }}>🎯 {ex.technique}</div>}
                  {ex.comments && <div style={{ marginBottom: 4, background: 'rgba(255,145,0,0.04)', borderRadius: 8, padding: '6px 8px', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>💡 {ex.comments}</div>}
                  {(() => { const bio = getExerciseBio(ex.id); if (!bio) return null; const js = bio.jointStress; const strs = Object.entries(js || {}).map(([k, v]) => `${k} ${v}/10`); return <div style={{ marginBottom: 4, background: 'rgba(59,130,246,0.04)', borderRadius: 8, padding: '5px 8px', fontSize: 8, color: 'var(--text-dim)' }}>🔬 Биомеханика: {strs.join(', ')} | Сложность: {bio.difficulty}/10 | ЦНС: {bio.cnsDemand || 5}/5</div>; })()}
                  {ex.canReplace && ex.canReplace.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Замена:</span>
                      {ex.canReplace.map(r => { const rep = EXERCISE_CATALOG.find(e => e.id === r); return rep ? <span key={r} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: 'var(--accent)' }}>{rep.name}</span> : null; })}
                    </div>
                  )}
                  <button onClick={() => setSelectedId(null)} style={{ width: '100%', marginTop: 4, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.3s' }}>
                    ▲ Свернуть
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 11 }}>Упражнения не найдены</div>}
        {filtered.length > visible && (
          <button onClick={() => setVisible(v => v + 80)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.04)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, marginTop: 4 }}>
            ▼ Показать ещё ({filtered.length - visible} из {filtered.length})
          </button>
        )}
      </div>
    </div>
  );
};

export default ExerciseLabCatalog;
