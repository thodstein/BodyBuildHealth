/** MixDiarySection.tsx — секция «💊 Тренировочные миксы и пресеты здоровья» в дневнике тренировок.
 *  Показывает записи из he_training_mixes (сохраняются кнопкой «💾 Сохранить в дневник и избранное»
 *  в TrainingMixTab и MixPresetsCard), с удалением. */
import React, { useState, useEffect } from 'react';
import { readDiaryMixes, deleteDiaryMix, type DiaryMixRecord } from '../../../engines/training-plan-save.engine';

const CARD: React.CSSProperties = {
  padding: 10, borderRadius: 12,
  background: 'rgba(24,24,27,0.35)', border: '1px solid rgba(139,92,246,0.2)',
  marginBottom: 8,
};

export const MixDiarySection: React.FC = () => {
  const [records, setRecords] = useState<DiaryMixRecord[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setRecords(readDiaryMixes());
    const onRefresh = () => setRecords(readDiaryMixes());
    window.addEventListener('he-training-mix-saved', onRefresh as EventListener);
    return () => window.removeEventListener('he-training-mix-saved', onRefresh as EventListener);
  }, []);

  if (records.length === 0) return null;

  const shown = records.slice(0, expanded ? records.length : 3);

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>💊 Тренировочные миксы и пресеты ({records.length})</div>
        <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {expanded ? 'Свернуть ▲' : 'Все ▼'}
        </button>
      </div>
      {shown.map(r => (
        <div key={r.id} style={{ padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>{r.kind === 'preset' ? '🧪' : '💪'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{r.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {r.date} · {r.substances.length} веществ{r.score != null ? ` · скор ${r.score} (${r.label || ''})` : ''}
              </div>
            </div>
            <button onClick={() => { deleteDiaryMix(r.id); setRecords(readDiaryMixes()); }}
              style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>🗑</button>
          </div>
          {r.substances.length > 0 && (
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 4 }}>
              {r.substances.slice(0, 6).map((s, i) => (
                <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}>
                  {s.name} · {s.mg >= 1000 ? `${(s.mg / 1000).toFixed(1)} г` : `${s.mg} мг`}
                </span>
              ))}
              {r.substances.length > 6 && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>+{r.substances.length - 6}</span>}
            </div>
          )}
          {r.recommendations && r.recommendations.interactions.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>
              ⚠️ Конфликтов в наборе: {r.recommendations.interactions.length}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MixDiarySection;
