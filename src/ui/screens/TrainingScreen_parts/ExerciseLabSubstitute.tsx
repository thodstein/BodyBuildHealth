import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, canReplace, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { ACCENT, DIM, SMALL, GROUP_RU } from './ExerciseLabShared';

const GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

const ExerciseLabSubstitute: React.FC = () => {
  const [exId, setExId] = useState('');
  const [group, setGroup] = useState('chest');

  const ex = useMemo(() => EXERCISE_CATALOG.find(e => e.id === exId), [exId]);

  const subs = useMemo(() => {
    if (!ex) return [];
    const sub = getSubstitutes(ex.id);
    const opts: Array<{ id: string; name: string; reason: string }> = [];
    if (sub) {
      for (const s of sub.substitutes) {
        if (!canReplace(ex.id, s.id)) continue;
        const r = getExerciseById(s.id);
        opts.push({ id: s.id, name: r?.name || s.id, reason: s.reason });
      }
    }
    if (opts.length === 0) {
      EXERCISE_CATALOG
        .filter(c => c.group === ex.group && c.id !== ex.id && canReplace(ex.id, c.id))
        .slice(0, 8)
        .forEach(c => opts.push({ id: c.id, name: c.name, reason: 'Альтернатива той же группы с сохранением биомеханики' }));
    }
    return opts;
  }, [ex]);

  const forbidden = useMemo(() => {
    if (!ex) return [];
    const raw = getSubstitutes(ex.id)?.forbidden ?? [];
    return raw.map((f: { id: string; reason: string }) => {
      const fex = EXERCISE_CATALOG.find(e => e.id === f.id);
      return { id: f.id, name: fex?.name || f.id, reason: f.reason };
    });
  }, [ex]);

  const exList = useMemo(() => EXERCISE_CATALOG.filter(e => e.group === group), [group]);
  const [showAll, setShowAll] = useState(false);
  const maxVisible = showAll ? 999 : 6;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🔄 Калькулятор замены упражнения</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
        Выберите упражнение — покажу допустимые замены (с причиной) и запретные замены из базы биомеханики.
        Также показаны все упражнения той же группы, которые можно использовать как замену.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <PopupSelect label="Группа мышц" value={group} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g] }))} onChange={v => { setGroup(v); setExId(''); }} />
        <PopupSelect label="Упражнение" value={exId} options={exList.map(e => ({ id: e.id, label: e.name, desc: `${e.type === 'compound' ? 'Базовое' : 'Изолированное'} · ${e.equipment}` }))} hint="Выберите упражнение" onChange={v => setExId(v)} />
      </div>

      {!ex ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Выберите упражнение выше, чтобы увидеть варианты замены.</div>
      ) : (<>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{ex.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            Группа: {GROUP_RU[ex.group]} · {ex.type === 'compound' ? 'Базовое' : 'Изолированное'} · {ex.equipment}
            {ex.targetMuscle ? ` · цель: ${ex.targetMuscle}` : ''}
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>✅ Допустимые замены ({subs.length})</div>
        {subs.length === 0 ? (
          <div style={{ ...SMALL, marginBottom: 10 }}>Нет явных замен в базе. Ниже показаны все упражнения той же группы.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {subs.map(o => (
              <div key={o.id} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid rgba(0,230,138,0.4)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{o.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{o.reason}</div>
              </div>
            ))}
          </div>
        )}

        {forbidden.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🚫 Запретные замены ({forbidden.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {forbidden.map((f, i) => (
                <div key={i} style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderLeft: '3px solid rgba(239,68,68,0.4)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5' }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{f.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All exercises in same group as potential alternatives */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>
            📋 Все упражнения группы ({GROUP_RU[ex.group]}) — возможные замены
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {exList
              .filter(e => e.id !== ex.id)
              .slice(0, maxVisible)
              .map(e => {
                const canRep = canReplace(ex.id, e.id);
                return (
                  <div key={e.id} style={{
                    padding: '6px 8px', borderRadius: 6, fontSize: 10,
                    background: canRep ? 'rgba(34,197,94,0.04)' : 'rgba(245,158,11,0.04)',
                    border: `1px solid ${canRep ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                    <span style={{ fontSize: 8, color: canRep ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>
                      {canRep ? '✅ замена' : '⚠️ проверьте'}
                    </span>
                  </div>
                );
              })}
            {exList.length > maxVisible && (
              <button onClick={() => setShowAll(v => !v)} style={{
                width: '100%', padding: 8, borderRadius: 8, border: '1px solid rgba(96,165,250,0.3)',
                background: 'rgba(96,165,250,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 11,
              }}>
                {showAll ? '▲ Свернуть' : `▼ Показать ещё (${exList.length - maxVisible} из ${exList.length})`}
              </button>
            )}
          </div>
        </div>
      </>)}
    </div>
  );
};

export default ExerciseLabSubstitute;
