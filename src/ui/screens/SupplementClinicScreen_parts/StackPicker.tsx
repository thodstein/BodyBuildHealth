// SupplementClinicScreen_parts/StackPicker.tsx — общий выбор стека.
import React, { useState, useMemo } from 'react';
import { allCatalogIds, entryName, chip, card } from './shared';

export const StackPicker: React.FC<{
  stackIds: string[];
  onChange: (ids: string[]) => void;
}> = ({ stackIds, onChange }) => {
  const [q, setQ] = useState('');
  const all = useMemo(() => allCatalogIds(), []);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return all
      .filter((x) => x.name.toLowerCase().includes(t) || x.id.toLowerCase().includes(t))
      .slice(0, 12);
  }, [q, all]);

  const add = (id: string) => {
    if (!stackIds.includes(id)) onChange([...stackIds, id]);
    setQ('');
  };
  const remove = (id: string) => onChange(stackIds.filter((x) => x !== id));

  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
        🧪 Стек: <span style={{ color: 'var(--accent)' }}>{stackIds.length}</span> веществ
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск БАД / фармы / пептида…"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 14px',
          borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(118,118,128,0.12)', color: 'var(--text)', fontSize: 14,
        }}
      />
      {results.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {results.map((r) => (
            <button key={r.id} style={chip(false)} onClick={() => add(r.id)}>
              ＋ {r.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {stackIds.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            Добавьте вещества — все 4 анализа (взаимодействия, дозы, время, клиника) будут считаться по этому стеку.
          </div>
        )}
        {stackIds.map((id) => (
          <span
            key={id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px',
              borderRadius: 11, fontSize: 13, background: 'rgba(0,230,138,0.12)',
              border: '1px solid rgba(0,230,138,0.3)', color: 'var(--text)',
            }}
          >
            {entryName(id)}
            <span
              onClick={() => remove(id)}
              style={{ cursor: 'pointer', color: '#ff647c', fontWeight: 800 }}
            >
              ✕
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};
