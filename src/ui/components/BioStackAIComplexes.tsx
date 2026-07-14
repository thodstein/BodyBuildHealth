import React, { useState, useMemo } from 'react';
import { SUPPLEMENT_COMPOSITION } from '../../data/support-meta';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { decomposeComplex } from '../../engines/biostack-clinical-v2.engine';
import { inputS } from './BioStackAIConstants';

interface ComplexTabProps {
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
}

function humanize(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function complexName(id: string): string {
  const e = SUPPORT_CATALOG_DATA[id];
  return e?.nameRu || e?.name || humanize(id);
}

function componentName(id: string): string {
  const e = SUPPORT_CATALOG_DATA[id];
  return e?.nameRu || e?.name || humanize(id);
}

export const ComplexTab: React.FC<ComplexTabProps> = ({ stackIds, setStackIds }) => {
  const [query, setQuery] = useState('');

  const complexes = useMemo(() => {
    const q = query.toLowerCase().trim();
    const all = Object.keys(SUPPLEMENT_COMPOSITION).map(id => {
      const comps = decomposeComplex(id);
      const fallback = SUPPLEMENT_COMPOSITION[id] || [];
      const components = comps.length > 0
        ? comps
        : fallback.map(cid => ({ componentId: cid, componentName: componentName(cid) }));
      return {
        id,
        name: complexName(id),
        description: SUPPORT_CATALOG_DATA[id]?.description || '',
        components,
      };
    });
    if (!q) return all;
    return all.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.components.some(cp => cp.componentName.toLowerCase().includes(q))
    );
  }, [query]);

  const toggle = (id: string) => {
    if (stackIds.includes(id)) setStackIds(stackIds.filter(s => s !== id));
    else setStackIds([...stackIds, id]);
  };

  return (
    <div style={{ padding: '4px 0 40px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
        🧪 Каталог комплексов
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
        Готовые комплексы заменяют несколько отдельных препаратов — меньше капсул, проще приём.
      </div>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="🔍 Поиск по комплексу или компоненту..."
        style={{ ...inputS, marginBottom: 12 }}
      />

      {complexes.length === 0 ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>
          Комплексы не найдены
        </div>
      ) : complexes.map(c => {
        const inStack = stackIds.includes(c.id);
        return (
          <div key={c.id} style={{
            padding: '10px 12px', marginBottom: 8, borderRadius: 12,
            background: inStack ? 'rgba(34,197,94,0.06)' : 'rgba(251,191,36,0.04)',
            border: `1px solid ${inStack ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.12)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
                {c.name}
              </span>
              <button onClick={() => toggle(c.id)} style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                border: 'none', fontSize: 9, fontWeight: 700,
                background: inStack ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                color: inStack ? '#22c55e' : '#fbbf24',
              }}>
                {inStack ? '✓ В стеке' : '＋ В стек'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: c.description ? 6 : 0 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>
                🔬 Состав ({c.components.length}):
              </span>
              {c.components.map((cp, j) => (
                <span key={j} style={{
                  padding: '2px 6px', borderRadius: 5, fontSize: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.55)',
                }}>
                  {cp.componentName}
                </span>
              ))}
            </div>

            {c.description && (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                📝 {c.description.slice(0, 140)}{c.description.length > 140 ? '…' : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
