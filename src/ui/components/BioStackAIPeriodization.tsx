import React, { useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, CATEGORY_LABELS } from '../../data/support-database';
import { GlassCard, PillBtn } from './BioStackAIConstants';

type Phase = 'loading' | 'bridge' | 'pct' | 'fertility' | 'off';

const PHASES: { id: Phase; label: string; icon: string; color: string }[] = [
  { id: 'loading', label: 'Загрузка (курс)', icon: '💪', color: '#ef4444' },
  { id: 'bridge', label: 'Бридж', icon: '🌉', color: '#f59e0b' },
  { id: 'pct', label: 'ПКТ', icon: '🔄', color: '#22c55e' },
  { id: 'fertility', label: 'Фертильность', icon: '🧬', color: '#8b5cf6' },
  { id: 'off', label: 'Off-сезон', icon: '🌿', color: '#60a5fa' },
];

interface PhaseStack {
  phase: Phase;
  stackIds: string[];
}

const SAVED_KEY = 'he_biostack_periodization';

function loadPeriodization(): PhaseStack[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
}

function savePeriodization(data: PhaseStack[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(data));
}

export function PeriodizationTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [phases, setPhases] = useState<PhaseStack[]>(() => loadPeriodization());
  const [editing, setEditing] = useState<Phase | null>(null);

  const getPhase = (id: Phase) => phases.find(p => p.phase === id);

  const setPhase = (id: Phase, ids: string[]) => {
    const next = phases.filter(p => p.phase !== id);
    if (ids.length > 0) next.push({ phase: id, stackIds: ids });
    setPhases(next);
    savePeriodization(next);
  };

  const copyCurrentToPhase = (id: Phase) => {
    setPhase(id, [...stackIds]);
  };

  const loadPhase = (id: Phase) => {
    const p = getPhase(id);
    if (p && p.stackIds.length > 0) setStackIds(p.stackIds);
  };

  const clearPhase = (id: Phase) => {
    setPhase(id, []);
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="🔄 Периодизация стека" icon="🔄" color="#00e68a">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 8 }}>
          Настройте разные стеки для каждой фазы вашего цикла. При смене фазы — загрузите соответствующий стек.
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {PHASES.map(ph => {
            const existing = getPhase(ph.id);
            const count = existing?.stackIds.length ?? 0;
            return (
              <div key={ph.id} style={{ padding: 10, borderRadius: 10, background: ph.color + '08', border: '1px solid ' + ph.color + '15' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{ph.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ph.color }}>{ph.label}</span>
                    {count > 0 && <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 8, background: ph.color + '15', color: ph.color, fontWeight: 700 }}>{count} шт</span>}
                  </div>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{count === 0 ? '⚪ Не настроен' : '🟢 Готов'}</span>
                </div>

                {count > 0 && (
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
                    {existing!.stackIds.slice(0, 6).map(id => {
                      const c = SUPPORT_CATALOG_DATA[id];
                      return c ? <span key={id} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, background: ph.color + '10', color: '#fff' }}>{c.nameRu || c.name}</span> : null;
                    })}
                    {count > 6 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>+{count - 6}...</span>}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button onClick={() => copyCurrentToPhase(ph.id)}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 8, fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)', color: '#00e68a' }}>
                    📥 Из текущего стека
                  </button>
                  {count > 0 && (
                    <>
                      <button onClick={() => loadPhase(ph.id)}
                        style={{ flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 8, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.1)', color: '#60a5fa' }}>
                        📤 Загрузить
                      </button>
                      <button onClick={() => clearPhase(ph.id)}
                        style={{ padding: '5px 8px', borderRadius: 7, fontSize: 8, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {phases.length > 0 && (
        <GlassCard title="📊 Сводка по фазам" icon="📊" color="#8b5cf6">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {phases.map(p => {
              const ph = PHASES.find(x => x.id === p.phase)!;
              const overlap = p.stackIds.filter(id => stackIds.includes(id)).length;
              const matchPct = stackIds.length > 0 ? Math.round(overlap / stackIds.length * 100) : 0;
              return (
                <div key={p.phase} style={{ padding: '6px 8px', borderRadius: 8, background: ph.color + '08', border: '1px solid ' + ph.color + '10' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: ph.color }}>{ph.icon} {ph.label}</div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{p.stackIds.length} препаратов</div>
                  <div style={{ fontSize: 7, color: matchPct > 50 ? '#00e68a' : 'rgba(255,255,255,0.3)' }}>Совпадение с текущим: {matchPct}%</div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
