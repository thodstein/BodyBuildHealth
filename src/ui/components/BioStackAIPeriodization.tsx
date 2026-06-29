import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile, type AASStatus } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { GlassCard } from './BioStackAIConstants';

type Phase = 'loading' | 'bridge' | 'pct' | 'fertility' | 'off';

interface PhaseMeta {
  id: Phase; label: string; icon: string; color: string;
}

const PHASES: PhaseMeta[] = [
  { id: 'loading', label: 'Загрузка (курс)', icon: '💪', color: '#ef4444' },
  { id: 'bridge', label: 'Бридж', icon: '🌉', color: '#f59e0b' },
  { id: 'pct', label: 'ПКТ', icon: '🔄', color: '#22c55e' },
  { id: 'fertility', label: 'Фертильность', icon: '🧬', color: '#8b5cf6' },
  { id: 'off', label: 'Off-сезон', icon: '🌿', color: '#60a5fa' },
];

function getPhaseKeys(phase: Phase, profile: BioStackProfile): string[] {
  const base: Record<Phase, string[]> = {
    loading: ['hepatoprotector','cardioprotector','anticoagulant','electrolyte','antioxidant','bile_acid'],
    bridge: ['hormonal','adaptogen','metabolic','antioxidant'],
    pct: ['hormonal','serm','aromatase','test_booster','hpta'],
    fertility: ['sperm_support','antioxidant','hormonal','folate'],
    off: ['adaptogen','mineral','vitamin','general_health'],
  };
  const keys = [...(base[phase] || [])];
  const conds = new Set(profile.healthConditions || []);
  if (conds.has('liver')) { if (!keys.includes('hepatoprotector')) keys.push('hepatoprotector'); }
  if (conds.has('kidney')) { if (!keys.includes('nephroprotector')) keys.push('nephroprotector'); }
  if (conds.has('heart') || conds.has('pressure_high')) { if (!keys.includes('cardioprotector')) keys.push('cardioprotector'); }
  if (conds.has('diabetes')) { if (!keys.includes('metabolic')) keys.push('metabolic'); }
  if (conds.has('stomach')) { if (!keys.includes('gi_protector')) keys.push('gi_protector'); }
  if (conds.has('thyroid')) { if (!keys.includes('thyroid_support')) keys.push('thyroid_support'); }
  return [...new Set(keys)];
}

const PHASE_ADV_KEYS: Record<string, Record<Phase, string[]>> = {
  beginner: {
    loading: ['hepatoprotector','cardioprotector','antioxidant','electrolyte'],
    bridge: ['adaptogen','mineral','vitamin'],
    pct: ['hormonal','serm','test_booster'],
    fertility: ['antioxidant','folate'],
    off: ['vitamin','mineral'],
  },
  intermediate: {
    loading: ['hepatoprotector','cardioprotector','anticoagulant','electrolyte','antioxidant','bile_acid'],
    bridge: ['hormonal','adaptogen','metabolic','antioxidant'],
    pct: ['hormonal','serm','aromatase','test_booster','hpta'],
    fertility: ['sperm_support','antioxidant','hormonal','folate'],
    off: ['adaptogen','mineral','vitamin','general_health'],
  },
  advanced: {
    loading: ['hepatoprotector','cardioprotector','anticoagulant','electrolyte','antioxidant','bile_acid','nephroprotector'],
    bridge: ['hormonal','adaptogen','metabolic','antioxidant','nootropic'],
    pct: ['hormonal','serm','aromatase','test_booster','hpta','neuroprotector'],
    fertility: ['sperm_support','antioxidant','hormonal','folate','immunomodulator'],
    off: ['adaptogen','mineral','vitamin','general_health','nootropic'],
  },
};

function getProfileAdjustedPhaseKeys(profile: BioStackProfile): Record<Phase, string[]> {
  const result: Record<Phase, string[]> = {} as Record<Phase, string[]>;
  const baseMap = PHASE_ADV_KEYS[profile.experience || 'intermediate'] || PHASE_ADV_KEYS.intermediate;
  const conds = new Set(profile.healthConditions || []);
  (PHASES as PhaseMeta[]).forEach(ph => {
    const baseKeys = baseMap[ph.id] || getPhaseKeys(ph.id, profile);
    const keys = [...baseKeys];
    if (conds.has('liver') && !keys.includes('hepatoprotector')) keys.push('hepatoprotector');
    if (conds.has('kidney') && !keys.includes('nephroprotector')) keys.push('nephroprotector');
    if ((conds.has('heart') || conds.has('pressure_high')) && !keys.includes('cardioprotector')) keys.push('cardioprotector');
    if (conds.has('diabetes') && !keys.includes('metabolic')) keys.push('metabolic');
    if (conds.has('stomach') && !keys.includes('gi_protector')) keys.push('gi_protector');
    if (conds.has('thyroid') && !keys.includes('thyroid_support')) keys.push('thyroid_support');
    result[ph.id] = [...new Set(keys)];
  });
  return result;
}

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

function suggestAdditionsFor(phase: Phase, currentIds: string[], profile: BioStackProfile): string[] {
  const neededCats = getProfileAdjustedPhaseKeys(profile)[phase];
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

function suggestRemovalsFor(phase: Phase, currentIds: string[], profile: BioStackProfile): string[] {
  const neededCats = getProfileAdjustedPhaseKeys(profile)[phase];
  const toRemove: string[] = [];
  for (const id of currentIds) {
    const entry = SUPPORT_CATALOG_DATA[id];
    if (!entry) continue;
    const cats = entry.category || [];
    const hasRelevantCat = cats.some(c => neededCats.includes(c));
    if (!hasRelevantCat && cats.length > 0) toRemove.push(id);
  }
  return toRemove.slice(0, 6);
}

const PRICE: Record<string, number> = {
  nac:650, milk_thistle:400, tudca:900, omega3:800, coq10:1200, magnesium:350,
  zinc:200, vitamin_d3:300, vitamin_c:250, vitamin_e:350, selenium:200,
  berberine:600, curcumin:500, alpha_lipoic:700, collagen:1200, glucosamine:800,
  msm:500, chondroitin:900, ashwagandha:600, rhodiola:550, theanine:450,
  glycine:300, creatine:400, l_carnitine:700, taurine:350, inositol:500,
  probiotics:1200, glutamine:500, astragalus:600, borax:200, potassium:250,
  calcium:300, citicoline:1200, alpha_gpc:900, huperzine_a:400, noopept:800,
  piracetam:500, lions_mane:900, phosphatidylserine:900, magnesium_l_threonate:1200,
  serrapeptase:900, nattokinase:800, bromelain:500, vitamin_a:200,
  zinc_carnosine:800, l_glutamine:600,
};

function estCost(id: string): number {
  if (PRICE[id]) return PRICE[id];
  const c = SUPPORT_CATALOG_DATA[id];
  if (!c) return 500;
  const tm: Record<string, number> = { core:800, standard:500, advanced:300, specialty:1200 };
  return tm[c.tier as string] || 500;
}

function phaseCost(ids: string[]): number {
  return ids.reduce((s, id) => s + estCost(id), 0);
}

function findMissingCategories(phase: Phase, currentIds: string[], profile: BioStackProfile): string[] {
  const needed = getProfileAdjustedPhaseKeys(profile)[phase];
  const presentCats = new Set<string>();
  currentIds.forEach(id => {
    const entry = SUPPORT_CATALOG_DATA[id];
    if (entry) (entry.category || []).forEach(c => presentCats.add(c));
  });
  return needed.filter(c => !presentCats.has(c));
}

export function PeriodizationTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [phases, setPhases] = useState<PhaseStack[]>(() => loadPeriodization());
  const [selectedFrom, setSelectedFrom] = useState<Phase | ''>('');
  const [selectedTo, setSelectedTo] = useState<Phase | ''>('');
  const [applyConfirm, setApplyConfirm] = useState<{ keep: string[]; add: string[] } | null>(null);

  const getPhase = (id: Phase) => phases.find(p => p.phase === id);

  const setPhase = (id: Phase, ids: string[]) => {
    const next = phases.filter(p => p.phase !== id);
    if (ids.length > 0) next.push({ phase: id, stackIds: ids });
    setPhases(next);
    savePeriodization(next);
  };

  const copyCurrentToPhase = (id: Phase) => setPhase(id, [...stackIds]);

  const loadPhase = (id: Phase) => {
    const p = getPhase(id);
    if (p && p.stackIds.length > 0) setStackIds(p.stackIds);
  };

  const clearPhase = (id: Phase) => setPhase(id, []);

  const transitionSuggestions = useMemo(() => {
    if (!selectedFrom || !selectedTo) return null;
    const fromPhase = getPhase(selectedFrom);
    const fromIds = fromPhase?.stackIds || [];
    const toAdd = suggestAdditionsFor(selectedTo, fromIds, profile);
    const toRemove = suggestRemovalsFor(selectedTo, fromIds, profile);
    const keep = fromIds.filter(id => !toRemove.includes(id));
    return { from: selectedFrom, to: selectedTo, keep, add: toAdd, remove: toRemove, fromCount: fromIds.length, keepCount: keep.length };
  }, [selectedFrom, selectedTo, phases, profile]);

  const allSubsSet = useMemo(() => {
    const s = new Set<string>();
    phases.forEach(p => p.stackIds.forEach(id => s.add(id)));
    return s;
  }, [phases]);

  const goBack = useCallback(() => {
    setApplyConfirm(null);
  }, []);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* ─── Apply confirm modal ─── */}
      {applyConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#18181b', borderRadius: 12, padding: 16,
            border: '1px solid rgba(139,92,246,0.2)', maxWidth: 360, width: '100%',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>🧠 Применить переход?</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              Будет изменён текущий стек: {applyConfirm.add.length} добавлено, {stackIds.length - applyConfirm.keep.length} удалено.
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, color: '#4ade80', marginBottom: 2 }}>✅ Оставить ({applyConfirm.keep.length})</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {(stackIds.filter(id => applyConfirm.keep.includes(id))).map(id => {
                  const c = SUPPORT_CATALOG_DATA[id];
                  return c ? <span key={id} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>{c.nameRu || c.name}</span> : null;
                })}
              </div>
              {applyConfirm.add.length > 0 && (
                <>
                  <div style={{ fontSize: 8, color: '#60a5fa', marginTop: 4, marginBottom: 2 }}>➕ Добавить ({applyConfirm.add.length})</div>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {applyConfirm.add.map(id => {
                      const c = SUPPORT_CATALOG_DATA[id];
                      return c ? <span key={id} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>{c.nameRu || c.name}</span> : null;
                    })}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={goBack} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, cursor: 'pointer',
                background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
              }}>Отмена</button>
              <button onClick={() => {
                const merged = [...new Set([...applyConfirm.keep, ...applyConfirm.add])];
                setStackIds(merged);
                setApplyConfirm(null);
              }} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa',
              }}>✅ Применить</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Phase cards ─── */}
      <GlassCard title="🔄 Периодизация стека" icon="🔄" color="#00e68a">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 8 }}>
          Настройте разные стеки для каждой фазы вашего цикла. AI-подсказки помогут адаптировать стек при смене фазы.
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {PHASES.map(ph => {
            const existing = getPhase(ph.id);
            const count = existing?.stackIds.length ?? 0;
            const cost = existing ? phaseCost(existing.stackIds) : 0;
            const missingCats = findMissingCategories(ph.id, existing?.stackIds || [], profile);
            const neededCats = getProfileAdjustedPhaseKeys(profile)[ph.id];
            const completeness = neededCats.length > 0
              ? Math.round(((neededCats.length - missingCats.length) / neededCats.length) * 100)
              : 0;
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
                  <>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
                      {existing!.stackIds.slice(0, 6).map(id => {
                        const c = SUPPORT_CATALOG_DATA[id];
                        return c ? <span key={id} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, background: ph.color + '10', color: '#fff' }}>{c.nameRu || c.name}</span> : null;
                      })}
                      {count > 6 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>+{count - 6}...</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                      <span>💰 ~{cost.toLocaleString()} ₽/мес</span>
                      <span>📊 {completeness}% покрытия</span>
                    </div>
                    {missingCats.length > 0 && (
                      <div style={{ fontSize: 7, color: ph.color, marginBottom: 4 }}>
                        ✳ Не хватает: {missingCats.slice(0, 3).join(', ')}{missingCats.length > 3 ? ` (+${missingCats.length - 3})` : ''}
                      </div>
                    )}
                  </>
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
          Выберите фазу ОТ и ДО — AI подскажет, какие препараты добавить, убрать или оставить. Нажмите «Применить» чтобы изменить текущий стек.
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
                <div style={{ marginBottom: 3 }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>➖ Убрать ({transitionSuggestions.remove.length}): </span>
                  {transitionSuggestions.remove.map(id => {
                    const c = SUPPORT_CATALOG_DATA[id];
                    return <span key={id} style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', marginRight: 2 }}>{c?.nameRu || id}</span>;
                  })}
                </div>
              )}
            </div>
            <button onClick={() => setApplyConfirm({ keep: transitionSuggestions.keep, add: transitionSuggestions.add })}
              style={{
                width: '100%', marginTop: 6, padding: '7px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa',
              }}>
              ✅ Применить к текущему стеку
            </button>
          </div>
        )}
      </GlassCard>

      {/* ─── Matrix + Cost + Phase summary ─── */}
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

      {/* ─── Cost comparison chart ─── */}
      {phases.length >= 2 && (
        <GlassCard title="💰 Стоимость по фазам" icon="💰" color="#f59e0b">
          <div style={{ display: 'grid', gap: 6 }}>
            {PHASES.map(ph => {
              const existing = getPhase(ph.id);
              const count = existing?.stackIds.length ?? 0;
              const cost = existing ? phaseCost(existing.stackIds) : 0;
              return (
                <div key={ph.id} style={{ fontSize: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: ph.color, fontWeight: 700 }}>{ph.icon} {ph.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{count} шт — {cost.toLocaleString()} ₽</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{
                      width: Math.min(100, cost > 0 ? (cost / 5000) * 100 : 0) + '%', height: '100%',
                      borderRadius: 3, background: ph.color, transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* ─── Phase summary ─── */}
      {phases.length > 0 && (
        <GlassCard title="📊 Сводка по фазам" icon="📊" color="#8b5cf6">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {phases.map(p => {
              const ph = PHASES.find(x => x.id === p.phase)!;
              const overlap = p.stackIds.filter(id => stackIds.includes(id)).length;
              const matchPct = stackIds.length > 0 ? Math.round(overlap / stackIds.length * 100) : 0;
              const cost = phaseCost(p.stackIds);
              const missingCats = findMissingCategories(p.phase, p.stackIds, profile);
              return (
                <div key={p.phase} style={{ padding: '6px 8px', borderRadius: 8, background: ph.color + '08', border: '1px solid ' + ph.color + '10' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: ph.color }}>{ph.icon} {ph.label}</div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{p.stackIds.length} препаратов · ~{cost.toLocaleString()} ₽</div>
                  <div style={{ fontSize: 7, color: matchPct > 50 ? '#00e68a' : 'rgba(255,255,255,0.3)' }}>Совпадение с тек.: {matchPct}%</div>
                  {missingCats.length > 0 && (
                    <div style={{ fontSize: 6, color: ph.color, marginTop: 2 }}>
                      ✳ Не хватает: {missingCats.slice(0, 2).join(', ')}{missingCats.length > 2 ? ` (+${missingCats.length - 2})` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
