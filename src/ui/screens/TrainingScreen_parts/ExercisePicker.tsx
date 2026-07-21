/**
 * ExercisePicker.tsx — выбор упражнения из каталога с поиском и фильтром
 * по мышце/оборудованию. Заменяет сырой текстовый ввод в ручном редакторе.
 *
 * Поведение: кнопка с текущим именем → раскрывается панель с поиском
 * (по имени) + фильтр группы мышц + список кандидатов. При выборе
 * вызывается onSelect с каноническим упражнением (имя + группа + тип).
 */
import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Exercise } from '../../../core/types';
import { GROUP_RU } from './program-types';
import { IN, ACCENT, DIM, DIM_STRONG } from './training-ui';

const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];

export const ExercisePicker: React.FC<{
  value: string;
  muscle: string;
  equipment?: string[];
  onSelect: (ex: Exercise) => void;
}> = ({ value, muscle, equipment = [], onSelect }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState<string>(muscle ? (muscle === 'quads' || muscle === 'hamstrings' || muscle === 'glutes' || muscle === 'calves' ? 'legs' : muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms' ? 'arms' : muscle) : '');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = EXERCISE_CATALOG.filter(e => {
      if (grp && (e.group || '').toLowerCase() !== grp) return false;
      if (equipment.length > 0) {
        const rawEq = (e as any).equipment;
        const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
        if (exEq.length > 0 && !exEq.some(eq => equipment.includes(eq))) return false;
      }
      if (!s) return true;
      return (e.name || '').toLowerCase().includes(s);
    });
    // Канонические (по типу compound/isolation) — без экзотики на верх.
    return list.slice(0, 60);
  }, [q, grp, equipment]);

  const pick = (ex: Exercise) => { onSelect(ex); setOpen(false); setQ(''); };

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ ...IN, padding: '4px 6px', fontSize: 11, textAlign: 'left', cursor: 'pointer', color: value ? DIM_STRONG : DIM, border: open ? `1px solid ${ACCENT}` : undefined }}>
        {value || 'Выбрать упражнение…'}
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 250, top: '100%', left: 0, right: 0, marginTop: 2, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 6, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <input style={{ ...IN, padding: '4px 6px', fontSize: 11, width: '100%', boxSizing: 'border-box', marginBottom: 4 }} placeholder="Поиск упражнения…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
            <button onClick={() => setGrp('')} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: grp === '' ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: grp === '' ? 'rgba(0,230,138,0.15)' : 'transparent', color: grp === '' ? ACCENT : DIM }}>Все</button>
            {GROUPS.map(g => (
              <button key={g} onClick={() => setGrp(g)} style={{ padding: '2px 6px', fontSize: 9, borderRadius: 6, cursor: 'pointer', border: grp === g ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: grp === g ? 'rgba(0,230,138,0.15)' : 'transparent', color: grp === g ? ACCENT : DIM }}>{GROUP_RU[g] || g}</button>
            ))}
          </div>
          {filtered.length === 0 && <div style={{ fontSize: 10, color: DIM, padding: '6px 0' }}>Ничего не найдено.</div>}
          {filtered.map(ex => (
            <div key={ex.id} onClick={() => pick(ex)} style={{ padding: '4px 6px', fontSize: 11, color: DIM_STRONG, cursor: 'pointer', borderRadius: 6, display: 'flex', justifyContent: 'space-between', gap: 6 }} onMouseDown={ev => ev.preventDefault()}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
              <span style={{ fontSize: 9, color: DIM, flex: '0 0 auto' }}>{GROUP_RU[ex.group] || ex.group} · {ex.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};