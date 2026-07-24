/**
 * ExerciseLabPicker.tsx — выбор упражнения через полную "Лабораторию упражнений".
 * Открывает модальное окно с ExerciseLabCatalog + детальным просмотром.
 * При выборе упражнения вызывает onSelect с каноническим упражнением.
 */
import React, { useState, useMemo } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import type { Exercise } from '../../../core/types';
import { GROUP_RU } from './program-types';
import { IN, ACCENT, DIM, DIM_STRONG, BTN, BTN_GHOST } from './training-ui';

const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];
const TYPES = ['compound', 'isolation'];
const EQUIP = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

const EQUIP_RU: Record<string, string> = {
  barbell: '🏋️ Штанга', dumbbell: '💪 Гантели', machine: '⚙️ Тренажёр',
  cable: '🔗 Блок', bodyweight: '🧘 Вес тела', band: '🟢 Резина',
  kettlebell: '🟤 Гиря', smith: '⚒️ Смит', plate: '🥏 Блин',
};

export const ExerciseLabPicker: React.FC<{
  value: string;
  muscle: string;
  equipment?: string[];
  onSelect: (ex: Exercise) => void;
}> = ({ value, muscle, equipment = [], onSelect }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState<string>(muscle ? (muscle === 'quads' || muscle === 'hamstrings' || muscle === 'glutes' || muscle === 'calves' ? 'legs' : muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms' ? 'arms' : muscle) : '');
  const [type, setType] = useState<string>('');
  const [eq, setEq] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = EXERCISE_CATALOG;
    if (grp) list = list.filter(e => (e.group || '').toLowerCase() === grp);
    if (type) list = list.filter(e => e.type === type);
    if (eq) list = list.filter(e => {
      const rawEq = (e as any).equipment;
      const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
      return exEq.includes(eq);
    });
    if (equipment.length > 0) {
      list = list.filter(e => {
        const rawEq = (e as any).equipment;
        const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
        return exEq.length === 0 || exEq.some(e => equipment.includes(e));
      });
    }
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(e => (e.name || '').toLowerCase().includes(s) || (e.targetMuscle || '').toLowerCase().includes(s));
    }
    return list;
  }, [q, grp, type, eq, equipment]);

  const selectedEx = useMemo(() => selectedId ? EXERCISE_CATALOG.find(e => e.id === selectedId) : null, [selectedId]);
  const selectedBio = useMemo(() => selectedEx ? getExerciseBio(selectedEx.id) : null, [selectedEx]);

  const pick = () => {
    if (selectedEx) {
      onSelect(selectedEx);
      setOpen(false);
      setQ('');
      setSelectedId(null);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...IN, padding: '4px 6px', fontSize: 11, textAlign: 'left', cursor: 'pointer', color: value ? DIM_STRONG : DIM, flex: 1, minWidth: 0 }}>
        {value || '🧬 Выбрать из лаборатории…'}
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: '#18181b', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', maxWidth: 600, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>🧬 Лаборатория упражнений</span>
          <span style={{ fontSize: 10, color: DIM, background: 'rgba(0,230,138,0.1)', padding: '1px 8px', borderRadius: 10, fontWeight: 700 }}>PRO</span>
          <button onClick={() => { setOpen(false); setSelectedId(null); }} style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11, marginLeft: 'auto' }}>✕ Закрыть</button>
        </div>

        {/* Filters */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <input style={{ ...IN, padding: '8px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} placeholder="🔍 Поиск упражнения…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: DIM, marginRight: 2 }}>Группа:</span>
            <button onClick={() => setGrp('')} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: !grp ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: !grp ? 'rgba(0,230,138,0.15)' : 'transparent', color: !grp ? ACCENT : DIM }}>Все</button>
            {GROUPS.map(g => (
              <button key={g} onClick={() => setGrp(g)} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: grp === g ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: grp === g ? 'rgba(0,230,138,0.15)' : 'transparent', color: grp === g ? ACCENT : DIM }}>{GROUP_RU[g] || g}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: DIM, marginRight: 2 }}>Тип:</span>
            <button onClick={() => setType('')} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: !type ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: !type ? 'rgba(0,230,138,0.15)' : 'transparent', color: !type ? ACCENT : DIM }}>Все</button>
            {TYPES.map(t => (
              <button key={t} onClick={() => setType(t)} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: type === t ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: type === t ? 'rgba(0,230,138,0.15)' : 'transparent', color: type === t ? ACCENT : DIM }}>{t === 'compound' ? '🔩 Базовое' : '🎯 Изоляция'}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: DIM, marginRight: 2 }}>Инвентарь:</span>
            <button onClick={() => setEq('')} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: !eq ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: !eq ? 'rgba(0,230,138,0.15)' : 'transparent', color: !eq ? ACCENT : DIM }}>Весь</button>
            {EQUIP.map(e => (
              <button key={e} onClick={() => setEq(e)} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: eq === e ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: eq === e ? 'rgba(0,230,138,0.15)' : 'transparent', color: eq === e ? ACCENT : DIM }}>{EQUIP_RU[e] || e}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: DIM, fontSize: 11 }}>Упражнения не найдены</div>}
          {filtered.slice(0, 100).map(ex => {
            const isSelected = selectedId === ex.id;
            const bio = getExerciseBio(ex.id);
            return (
              <div key={ex.id} onClick={() => setSelectedId(isSelected ? null : ex.id)} style={{
                padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(59,130,246,0.04))' : 'rgba(255,255,255,0.02)',
                border: isSelected ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: isSelected ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {ex.type === 'compound' ? '🔩' : '🎯'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? ACCENT : DIM_STRONG, lineHeight: 1.2 }}>{ex.name}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: DIM }}>{GROUP_RU[ex.group] || ex.group}</span>
                      <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: DIM }}>{EQUIP_RU[(ex as any).equipment] || (ex as any).equipment || '—'}</span>
                      {bio && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: ex.jointStress === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: ex.jointStress === 'high' ? '#ef4444' : '#22c55e' }}>
                        {ex.jointStress === 'high' ? '⚠ высокая' : ex.jointStress === 'med' ? 'средняя' : '✓ низкая'} нагрузка
                      </span>}
                    </div>
                  </div>
                  {isSelected && <span style={{ fontSize: 10, color: ACCENT }}>✓</span>}
                </div>

                {isSelected && bio && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', color: ACCENT }}>{ex.type === 'compound' ? 'Базовое' : 'Изолирующее'}</span>
                      {ex.difficulty && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: ex.difficulty === 'advanced' ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.08)', color: ex.difficulty === 'advanced' ? '#ef4444' : '#f97316' }}>{ex.difficulty === 'advanced' ? 'Продвинутое' : ex.difficulty === 'intermediate' ? 'Среднее' : 'Начальное'}</span>}
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>Усталость: {ex.fatigueCost}/10</span>
                      {ex.targetMuscle && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(236,72,153,0.08)', color: '#ec4899' }}>🎯 {ex.targetMuscle}</span>}
                    </div>
                    {ex.technique && <div style={{ marginBottom: 4, background: 'rgba(0,230,138,0.04)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: DIM_STRONG, lineHeight: 1.4 }}>🎯 {ex.technique}</div>}
                    {ex.comments && <div style={{ marginBottom: 4, background: 'rgba(255,145,0,0.04)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: DIM, lineHeight: 1.4 }}>💡 {ex.comments}</div>}
                    {bio && (
                      <div style={{ marginBottom: 4, background: 'rgba(59,130,246,0.04)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: DIM }}>
                        🔬 Биомеханика: {Object.entries(bio.jointStress || {}).map(([k, v]) => `${k} ${v}/10`).join(', ')} | Сложность: {bio.difficulty}/10 | ЦНС: {bio.cnsDemand || 5}/5
                      </div>
                    )}
                    {ex.canReplace && ex.canReplace.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: DIM }}>Замена:</span>
                        {ex.canReplace.slice(0, 5).map(r => { const rep = EXERCISE_CATALOG.find(e => e.id === r); return rep ? <span key={r} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: ACCENT }}>{rep.name}</span> : null; })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > 100 && <div style={{ textAlign: 'center', padding: 8, color: DIM, fontSize: 10 }}>Показано 100 из {filtered.length}. Уточните фильтры.</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6, alignItems: 'center' }}>
          {selectedEx ? (
            <>
              <span style={{ fontSize: 11, color: DIM_STRONG, flex: 1 }}>Выбрано: <b style={{ color: ACCENT }}>{selectedEx.name}</b></span>
              <button onClick={pick} style={{ ...BTN, padding: '6px 16px', fontSize: 11, background: 'linear-gradient(135deg, #00e68a, #00b36b)' }}>✓ Выбрать</button>
            </>
          ) : (
            <span style={{ fontSize: 11, color: DIM, flex: 1 }}>Кликните по упражнению для выбора</span>
          )}
          <button onClick={() => { setOpen(false); setSelectedId(null); }} style={{ ...BTN_GHOST, padding: '6px 12px', fontSize: 11 }}>Отмена</button>
        </div>
      </div>
    </div>
  );
};
