import React, { useState, useMemo } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { GlassCard } from './BioStackAIConstants';

type Phase = 'loading' | 'bridge' | 'pct' | 'fertility' | 'off';

const PHASES: { id: Phase; label: string; icon: string; color: string }[] = [
  { id: 'loading', label: 'Загрузка (курс)', icon: '💪', color: '#ef4444' },
  { id: 'bridge', label: 'Бридж', icon: '🌉', color: '#f59e0b' },
  { id: 'pct', label: 'ПКТ', icon: '🔄', color: '#22c55e' },
  { id: 'fertility', label: 'Фертильность', icon: '🧬', color: '#8b5cf6' },
  { id: 'off', label: 'Off-сезон', icon: '🌿', color: '#60a5fa' },
];

const PHASE_KEYS: Record<Phase, string[]> = {
  loading: ['hepatoprotector','cardioprotector','anticoagulant','electrolyte','antioxidant','bile_acid'],
  bridge: ['hormonal','adaptogen','metabolic','antioxidant'],
  pct: ['hormonal','serm','aromatase','test_booster','hpta'],
  fertility: ['sperm_support','antioxidant','hormonal','folate'],
  off: ['adaptogen','mineral','vitamin','general_health'],
};

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

// Suggest substances to ADD when transitioning TO a given phase (not already in stack)
function suggestAdditionsFor(phase: Phase, currentIds: string[]): string[] {
  const neededCats = PHASE_KEYS[phase];
  const catSubs: string[] = [];
  const used = new Set(currentIds.map(i => i.toLowerCase()));
  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    if (used.has(id.toLowerCase())) continue;
    if (entry.tier === 'core' || entry.tier === 'standard') {
      const cats = entry.category || [];
      if (cats.some(c => neededCats.includes(c))) catSubs.push(id);
    }
  }
  return catSubs.slice(0, 8);
}

// Suggest substances to REMOVE when transitioning TO a given phase
function suggestRemovalsFor(phase: Phase, currentIds: string[]): string[] {
  const neededCats = PHASE_KEYS[phase];
  const toRemove: string[] = [];
  for (const id of currentIds) {
    const entry = SUPPORT_CATALOG_DATA[id];
    if (!entry) continue;
    const cats = entry.category || [];
    // Remove substances whose ALL categories are irrelevant for this phase
    const hasRelevantCat = cats.some(c => neededCats.includes(c));
    if (!hasRelevantCat && cats.length > 0) toRemove.push(id);
  }
  return toRemove.slice(0, 6);
}

export function PeriodizationTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [phases, setPhases] = useState<PhaseStack[]>(() => loadPeriodization());
  const [editing, setEditing] = useState<Phase | null>(null);
  const [selectedFrom, setSelectedFrom] = useState<Phase | ''>('');
  const [selectedTo, setSelectedTo] = useState<Phase | ''>('');

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

  // AI suggestions for a transition
  const transitionSuggestions = useMemo(() => {
    if (!selectedFrom || !selectedTo) return null;
    const fromPhase = getPhase(selectedFrom);
    const fromIds = fromPhase?.stackIds || [];
    const toAdd = suggestAdditionsFor(selectedTo, fromIds);
    const toRemove = suggestRemovalsFor(selectedTo, fromIds);
    const keep = fromIds.filter(id => !toRemove.includes(id));
    return { from: selectedFrom, to: selectedTo, keep, add: toAdd, remove: toRemove, fromCount: fromIds.length, keepCount: keep.length };
  }, [selectedFrom, selectedTo, phases]);

  // Summary metrics for all phases
  const allSubsSet = useMemo(() => {
    const s = new Set<string>();
    phases.forEach(p => p.stackIds.forEach(id => s.add(id)));
    return s;
  }, [phases]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="🔄 Периодизация стека" icon="🔄" color="#00e68a">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 8 }}>
          Настройте разные стеки для каждой фазы вашего цикла. AI-подсказки помогут адаптировать стек при смене фазы.
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

      {/* ─── AI Phase Transition Advisor ─── */}
      <GlassCard title="🧠 AI: Адаптация стека при смене фазы" icon="🧠" color="#a78bfa">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 8 }}>
          Выберите фазу ОТ и ДО — AI подскажет, какие препараты добавить, убрать или оставить.
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select value={selectedFrom} onChange={e => setSelectedFrom(e.target.value as Phase)}
            style={{ flex: 1, padding: '7px 8px', borderRadius: 8, fontSize: 9, background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
            <option value="">← От (текущая фаза)</option>
            {PHASES.map(ph => <option key={ph.id} value={ph.id}>{ph.icon} {ph.label}</option>)}
          </select>
          <span style={{ fontSize: 16, alignSelf: 'center' }}>→</span>
          <select value={selectedTo} onChange={e => setSelectedTo(e.target.value as Phase)}
            style={{ flex: 1, padding: '7px 8px', borderRadius: 8, fontSize: 9, background: '#202023', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
            <option value="">→ К (целевая фаза)</option>
            {PHASES.map(ph => <option key={ph.id} value={ph.id}>{ph.icon} {ph.label}</option>)}
          </select>
        </div>
        {transitionSuggestions && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>
              Переход: {PHASES.find(p=>p.id===transitionSuggestions.from)?.icon} → {PHASES.find(p=>p.id===transitionSuggestions.to)?.icon}
              <span style={{ fontWeight: 400, marginLeft: 4, color: 'rgba(255,255,255,0.4)' }}>
                ({transitionSuggestions.fromCount} → ~{transitionSuggestions.keepCount + transitionSuggestions.add.length} препаратов)
              </span>
            </div>
            <div style={{ fontSize: 8, lineHeight: 1.5 }}>
              {transitionSuggestions.keep.length > 0 && (
                <div style={{ marginBottom: 3 }}>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>✅ Оставить ({transitionSuggestions.keepCount}): </span>
                  {transitionSuggestions.keep.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || id).join(', ')}
                </div>
              )}
              {transitionSuggestions.add.length > 0 && (
                <div style={{ marginBottom: 3 }}>
                  <span style={{ color: '#60a5fa', fontWeight: 700 }}>➕ Добавить ({transitionSuggestions.add.length}): </span>
                  {transitionSuggestions.add.map(id => {
                    const c = SUPPORT_CATALOG_DATA[id];
                    return <span key={id} style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(96,165,250,0.1)', marginRight: 2 }}>{c?.nameRu || id}</span>;
                  })}
                </div>
              )}
              {transitionSuggestions.remove.length > 0 && (
                <div>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>➖ Убрать ({transitionSuggestions.remove.length}): </span>
                  {transitionSuggestions.remove.map(id => {
                    const c = SUPPORT_CATALOG_DATA[id];
                    return <span key={id} style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', marginRight: 2 }}>{c?.nameRu || id}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* ─── Обзор всех веществ по фазам ─── */}
      {phases.length >= 2 && (
        <GlassCard title="📊 Матрица покрытия" icon="📊" color="#8b5cf6">
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            Какие вещества используются в каждой фазе. Пустая ячейка = препарат не нужен в этой фазе.
          </div>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
            <table style={{ width: '100%', fontSize: 7, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '2px 4px', color: 'rgba(255,255,255,0.5)' }}>Препарат</th>
                  {PHASES.map(ph => <th key={ph.id} style={{ padding: '2px 4px', color: ph.color, textAlign: 'center' }}>{ph.icon}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...allSubsSet].sort().slice(0, 30).map(sid => {
                  const c = SUPPORT_CATALOG_DATA[sid];
                  return (
                    <tr key={sid}>
                      <td style={{ padding: '2px 4px', color: 'rgba(255,255,255,0.8)' }}>{c?.nameRu || sid}</td>
                      {PHASES.map(ph => {
                        const p = getPhase(ph.id);
                        const present = p?.stackIds.includes(sid);
                        return <td key={ph.id} style={{ padding: '2px 4px', textAlign: 'center', color: present ? ph.color : 'rgba(255,255,255,0.1)' }}>{present ? '●' : '○'}</td>;
                      })}
                    </tr>
                  );
                })}
                {allSubsSet.size > 30 && <tr><td colSpan={6} style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', padding: 4 }}>... и ещё {allSubsSet.size - 30} препаратов</td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* ─── Сводка ─── */}
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
