import React, { useMemo, useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { GlassCard, StatBox } from './BioStackAIConstants';

export function RisksTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const analysis = useMemo(() => {
    if (stackIds.length < 2) return null;
    const catData = SUPPORT_CATALOG_DATA;
    const pairs: {
      a: string; b: string; nameA: string; nameB: string;
      type: string; effect: string; severity: string; mechanisms: string[]; notes: string;
    }[] = [];
    for (let i = 0; i < stackIds.length; i++) {
      for (let j = i + 1; j < stackIds.length; j++) {
        const idA = stackIds[i], idB = stackIds[j];
        const all = ALL_INTERACTIONS;
        const direct = all.filter(inx =>
          (inx.substanceA === idA && inx.substanceB === idB) ||
          (inx.substanceA === idB && inx.substanceB === idA));
        if (direct.length > 0) {
          direct.forEach(inx => {
            pairs.push({
              a: idA, b: idB,
              nameA: catData[idA]?.nameRu || catData[idA]?.name || idA,
              nameB: catData[idB]?.nameRu || catData[idB]?.name || idB,
              type: inx.type,
              effect: inx.effect,
              severity: inx.severity,
              mechanisms: inx.mechanisms || [],
              notes: inx.notes || '',
            });
          });
        } else {
          pairs.push({
            a: idA, b: idB,
            nameA: catData[idA]?.nameRu || catData[idA]?.name || idA,
            nameB: catData[idB]?.nameRu || catData[idB]?.name || idB,
            type: 'no_interaction', effect: 'Взаимодействий не найдено',
            severity: 'LOW', mechanisms: [], notes: '',
          });
        }
      }
    }
    const critical = pairs.filter(p => p.severity === 'HIGH' && (p.type === 'conflict' || p.type === 'caution'));
    const moderate = pairs.filter(p => p.severity === 'MEDIUM' && (p.type === 'conflict' || p.type === 'caution'));
    const cumulative = pairs.filter(p => (p.severity === 'LOW' || p.type === 'synergy' || p.type === 'no_interaction'));
    return { pairs, critical, moderate, cumulative, total: pairs.length };
  }, [stackIds]);

  const [expandedPair, setExpandedPair] = useState<Record<string, boolean>>({});

  if (stackIds.length < 2) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Нет пар для анализа</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Добавьте минимум 2 препарата в стек для расчёта взаимодействий</div>
      </div>
    );
  }

  if (!analysis) return null;

  const severityColor = (s: string) => s === 'HIGH' ? '#ef4444' : s === 'MEDIUM' ? '#f59e0b' : '#22c55e';
  const severityLabel = (s: string) => s === 'HIGH' ? '🔴 Высокий' : s === 'MEDIUM' ? '🟡 Средний' : '🟢 Низкий';
  const typeIcon = (t: string) => t === 'conflict' ? '🚫' : t === 'caution' ? '⚡' : t === 'synergy' ? '🤝' : '➖';

  // ── Interaction Network Graph ──
  const graphNodes = stackIds.map((id, i) => {
    const cat = SUPPORT_CATALOG_DATA[id];
    return { id, label: cat?.nameRu || cat?.name || id, idx: i };
  });
  const angles = graphNodes.map((_, i) => (2 * Math.PI * i) / graphNodes.length - Math.PI / 2);
  const cx = 50, cy = 50, r = 38;
  const positions = angles.map(a => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }));
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const pairMap = new Map<string, typeof analysis.pairs[0]>();
  analysis.pairs.forEach(p => pairMap.set(pairKey(p.a, p.b), p));

  const interColor = (type: string, severity: string) => {
    if (type === 'conflict' && severity === 'HIGH') return '#ef4444';
    if (type === 'conflict' && severity === 'MEDIUM') return '#f97316';
    if (type === 'caution') return '#f59e0b';
    if (type === 'synergy') return '#22c55e';
    return 'rgba(255,255,255,0.1)';
  };
  const interWidth = (type: string, severity: string) => {
    if (type === 'conflict' && severity === 'HIGH') return 3;
    if (type === 'conflict' && severity === 'MEDIUM') return 2;
    return 1.5;
  };
  const interDash = (type: string) => type === 'synergy' ? '' : '5,3';

  const [graphTab, setGraphTab] = useState<'graph' | 'list'>('list');

  const SectionCard: React.FC<{ title: string; icon: string; color: string; items: typeof analysis.critical; defaultOpen?: boolean }> =
    ({ title, icon, color, items, defaultOpen }) => (
    <GlassCard title={`${icon} ${title} (${items.length})`} color={color}>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: '#22c55e', textAlign: 'center', padding: 8 }}>
          ✅ Не обнаружено
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((p, idx) => {
            const key = `${p.a}|${p.b}|${p.type}|${idx}`;
            const open = expandedPair[key] ?? (defaultOpen ?? true);
            return (
              <div key={key} style={{
                padding: '8px 10px', borderRadius: 10,
                background: `${severityColor(p.severity)}06`,
                border: `1px solid ${severityColor(p.severity)}12`,
              }}>
                <div onClick={() => setExpandedPair(prev => ({ ...prev, [key]: !open }))}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{typeIcon(p.type)}</span>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{p.nameA}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', margin: '0 4px' }}>↔</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{p.nameB}</span>
                    </div>
                    <span style={{ padding: '2px 5px', borderRadius: 4, fontSize: 7, fontWeight: 600,
                      background: `${severityColor(p.severity)}18`, color: severityColor(p.severity) }}>
                      {severityLabel(p.severity)}
                    </span>
                  </div>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
                </div>
                {open && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginBottom: 4 }}>
                      {typeIcon(p.type)} {p.effect}
                    </div>
                    {p.mechanisms.length > 0 && (
                      <div style={{ fontSize: 7, color: '#a78bfa', marginBottom: 2 }}>
                        🧬 Механизмы: {p.mechanisms.join(', ')}
                      </div>
                    )}
                    {p.notes && (
                      <div style={{ fontSize: 7, color: '#f59e0b', lineHeight: 1.3 }}>
                        📝 {p.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="⚠ Анализ взаимодействий" icon="📊" color="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
          <StatBox label="Всего пар" value={analysis.total} color="#60a5fa" />
          <StatBox label="Критических" value={analysis.critical.length} color="#ef4444" />
          <StatBox label="Умеренных" value={analysis.moderate.length} color="#f59e0b" />
          <StatBox label="Безопасных" value={analysis.cumulative.length} color="#22c55e" />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setGraphTab('list')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: graphTab === 'list' ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${graphTab === 'list' ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: graphTab === 'list' ? '#00e68a' : 'rgba(255,255,255,0.5)',
          }}>📋 Список</button>
          <button onClick={() => setGraphTab('graph')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: graphTab === 'graph' ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${graphTab === 'graph' ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: graphTab === 'graph' ? '#00e68a' : 'rgba(255,255,255,0.5)',
          }}>🕸️ Граф</button>
        </div>
      </GlassCard>

      {/* Graph view */}
      {graphTab === 'graph' && (
        <GlassCard title="🕸️ Граф взаимодействий" icon="🕸️" color="#8b5cf6">
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: 220, background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
            {(() => {
              const drawn = new Set<string>();
              return analysis.pairs.map(p => {
                const k = pairKey(p.a, p.b);
                if (drawn.has(k)) return null;
                drawn.add(k);
                const i1 = stackIds.indexOf(p.a), i2 = stackIds.indexOf(p.b);
                if (i1 === -1 || i2 === -1) return null;
                const p1 = positions[i1], p2 = positions[i2];
                return (
                  <line key={k} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={interColor(p.type, p.severity)} strokeWidth={interWidth(p.type, p.severity)}
                    strokeDasharray={interDash(p.type)} opacity={0.7} />
                );
              });
            })()}
            {graphNodes.map((n, i) => {
              const p = positions[i];
              const criticalCount = analysis.critical.filter(x => x.a === n.id || x.b === n.id).length;
              return (
                <g key={n.id}>
                  <circle cx={p.x} cy={p.y} r={5} fill={criticalCount > 0 ? '#ef4444' : criticalCount > 1 ? '#f59e0b' : '#1a1a1e'} stroke={criticalCount > 0 ? '#ef4444' : '#00e68a'} strokeWidth={1.2} />
                  <text x={p.x} y={p.y + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={3.5} fontWeight={600}>{n.label}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
            <span><span style={{ color: '#ef4444' }}>━</span> Конфликт</span>
            <span><span style={{ color: '#f59e0b' }}>- -</span> Осторожно</span>
            <span><span style={{ color: '#22c55e' }}>━</span> Синергия</span>
            <span><span style={{ color: 'rgba(255,255,255,0.15)' }}>- -</span> Нет данных</span>
          </div>
        </GlassCard>
      )}

      <SectionCard title="🔴 Критические" icon="🚫" color="#ef4444" items={analysis.critical} defaultOpen={true} />
      <SectionCard title="🟡 Умеренные" icon="⚡" color="#f59e0b" items={analysis.moderate} defaultOpen={true} />
      <SectionCard title="🟢 Безопасные / Нет данных" icon="➖" color="#22c55e" items={analysis.cumulative} defaultOpen={false} />
    </div>
  );
}
