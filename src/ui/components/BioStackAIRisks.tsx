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
      </GlassCard>

      <SectionCard title="🔴 Критические" icon="🚫" color="#ef4444" items={analysis.critical} defaultOpen={true} />
      <SectionCard title="🟡 Умеренные" icon="⚡" color="#f59e0b" items={analysis.moderate} defaultOpen={true} />
      <SectionCard title="🟢 Безопасные / Нет данных" icon="➖" color="#22c55e" items={analysis.cumulative} defaultOpen={false} />
    </div>
  );
}
