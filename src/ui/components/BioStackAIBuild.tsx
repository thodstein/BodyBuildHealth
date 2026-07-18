import React, { useState, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack, type StackExplanation, findReplacement, findSingleReplacementForStack } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { SUPPLEMENT_COMPOSITION, COMPLEX_NAMES } from '../../data/support-meta';
import { GlassCard, StatBox, toFinderProfile, showToast, estCost, SubstanceMechanismCard, SubstanceTzCard, initBioToast } from './BioStackAIConstants';
import { getSafeStackRecommendations } from '../../engines/biostack-safety.engine';
import {
  selectStack, getEvidenceGrade,
} from '../../engines/biostack-clinical-v2.engine';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import type { LinkedData } from '../../core/data-link';
import { ClinicalResultCard } from './BioStackAIClinicalCard';
import { TzCascadePopup, type TzCascadeResult } from './BioStackAITzCascade';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../../data/support-db';
import { buildClinicalStack, type ClinicalStackResult } from '../../engines/biostack-clinical-recommender';
import type { StackStrategy } from '../../engines/biostack-clinical-v2.engine';

/* ═══ TZ-28 cascade button ═══ */
const TZ_CASCADE_BTN = {
  key: 'tzCascade' as const,
  icon: '🧪',
  label: 'Сборка по органу/механизму/анализу',
  desc: 'ТЗ-28: 6 органов — 28 механизмов — ~85 маркёров',
  color: '#a78bfa',
  gradient: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(139,92,246,0.08))',
  border: 'rgba(167,139,250,0.35)',
};

/* ═══ Clinical mode constants ═══ */
const STRATEGIES: { id: StackStrategy; label: string }[] = [
  { id: 'comprehensive', label: 'Полный' },
  { id: 'safe', label: 'Безопасный' },
  { id: 'budget', label: 'Бюджет' },
];
const ORGAN_OPTIONS = Object.entries(TZ_SYSTEM_LABELS).map(([id, label]) => ({ id, label }));
const MECH_OPTIONS = Object.entries(TZ_MECH_LABELS).map(([id, label]) => ({ id, label }));
const MARKER_OPTIONS: { id: string; label: string }[] = [
  { id: 'ALT', label: 'АЛТ (печень)' },
  { id: 'AST', label: 'АСТ (печень)' },
  { id: 'GGT', label: 'ГГТ (печень)' },
  { id: 'BILIRUBIN', label: 'Билирубин' },
  { id: 'GLU', label: 'Глюкоза' },
  { id: 'HOMOCYSTEINE', label: 'Гомоцистеин' },
  { id: 'CRP', label: 'СРБ (воспаление)' },
  { id: 'CREATININE', label: 'Креатинин (почки)' },
  { id: 'LDL', label: 'ЛПНП (липиды)' },
  { id: 'TRIGLYCERIDES', label: 'Триглицериды' },
  { id: 'HCT', label: 'Гематокрит' },
  { id: 'D_DIMER', label: 'D-димер' },
];

function MultiChips({
  options, selected, onToggle, color,
}: { options: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <button key={o.id} onClick={() => onToggle(o.id)} style={{
            fontSize: 11, padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
            background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
            color: active ? color : 'rgba(255,255,255,0.6)',
            fontWeight: active ? 700 : 500,
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

export function BuildTab({ profile, stackIds, setStackIds, labAnalysis, linked }: {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  labAnalysis?: LabCompositeResult | null;
  linked?: LinkedData;
}) {
  const [mode, setMode] = useState<'cascade' | 'clinical'>('cascade');
  initBioToast();

  /* ─── Cascade state ─── */
  const [result, setResult] = useState<{ stack: string[]; explanation: StackExplanation; budgetNote?: string } | null>(null);
  const [gates, setGates] = useState<ReturnType<typeof selectStack> | null>(null);
  const [tzCascadeOpen, setTzCascadeOpen] = useState(false);
  const [targetSize, setTargetSize] = useState(10);
  const [avoidConflicts, setAvoidConflicts] = useState(true);

  /* ─── Clinical state ─── */
  const [strategy, setStrategy] = useState<StackStrategy>('comprehensive');
  const [clinicalResult, setClinicalResult] = useState<ClinicalStackResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [filterOrgans, setFilterOrgans] = useState<string[]>([]);
  const [filterMechanisms, setFilterMechanisms] = useState<string[]>([]);
  const [filterMarkers, setFilterMarkers] = useState<string[]>([]);
  const [evidenceLevel, setEvidenceLevel] = useState<'all' | 'A' | 'B' | 'C'>('all');

  /* ─── Cascade handlers ─── */
  const handleTzCascadeBuild = useCallback((cascade: TzCascadeResult) => {
    setTzCascadeOpen(false);
    setTimeout(() => {
      const queryOrgans = [cascade.organ];
      const queryMechs = [cascade.mech];
      const fp = toFinderProfile(profile);
      const conflictFilter = avoidConflicts ? (id: string) => {
        const hasConflict = stackIds.some(existing => {
          const isCaution = ALL_INTERACTIONS.some(inx =>
            ((inx.substanceA === id && inx.substanceB === existing) ||
             (inx.substanceA === existing && inx.substanceB === id)) &&
            (inx.type === 'conflict' || inx.type === 'caution') &&
            (inx.severity === 'HIGH' || inx.severity === 'MEDIUM')
          );
          return isCaution;
        });
        return !hasConflict;
      } : undefined;
      const built = buildStack({
        baseIds: stackIds,
        targetSize,
        organs: queryOrgans,
        mechanisms: queryMechs,
        autoFill: true,
        profile: fp,
        avoidIds: conflictFilter ? stackIds.filter(id => !conflictFilter(id)) : undefined,
      });
      let filteredStack = built.stack;
      let drugSafetyNote = '';
      if (profile.currentMeds?.length) {
        const { safe, excluded } = getSafeStackRecommendations(filteredStack, profile.currentMeds);
        if (excluded.length > 0) {
          const excludedNames = excluded.map(e => e.substanceName).slice(0, 3).join(', ');
          drugSafetyNote = `💊 Лекарственная безопасность: исключено ${excluded.length} БАДов из-за HIGH-взаимодействий с вашими препаратами (${excludedNames}${excluded.length > 3 ? '...' : ''})`;
          filteredStack = safe;
        }
      }
      const gate = selectStack(filteredStack, profile, 'comprehensive', (labAnalysis as LabCompositeResult) || null);
      filteredStack = gate.ids;
      let gateNote = '';
      if (gate.hardStops.length > 0) {
        const st = gate.hardStops.map(h => `${h.substanceName}: ${h.reason}`).slice(0, 4).join('; ');
        gateNote += `\n🛑 Абсолютные противопоказания (исключены): ${st}`;
      }
      const cascadeNote = `🧪 Каскад: ${TZ_SYSTEM_LABELS[cascade.organ] || cascade.organ} → ${TZ_MECH_LABELS[cascade.mech] || cascade.mech} (маркёр: ${cascade.marker})`;
      const exp = explainStack(filteredStack, fp);
      setGates(gate);
      setResult({
        stack: filteredStack,
        explanation: exp,
        budgetNote: cascadeNote + (drugSafetyNote ? '\n' + drugSafetyNote : '') + gateNote,
      });
      showToast(`🧩 Собрано ${filteredStack.length} БАДов по каскаду`, 'success');
    }, 100);
  }, [profile, stackIds, avoidConflicts, targetSize, labAnalysis]);

  const handleSaveStack = useCallback(() => {
    if (!result) return;
    const existing: string[][] = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    const updated = [result.stack, ...existing].slice(0, 10);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
  }, [result]);

  /* ─── Clinical handlers ─── */
  const toggleOrgan = (id: string) =>
    setFilterOrgans((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleMechanism = (id: string) =>
    setFilterMechanisms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleMarker = (id: string) =>
    setFilterMarkers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const resetFilters = () => {
    setFilterOrgans([]);
    setFilterMechanisms([]);
    setFilterMarkers([]);
    setEvidenceLevel('all');
  };

  const courseWeek = (linked as any)?.pharma?.week ?? (linked as any)?.courseWeek ?? 1;

  const onClinicalBuild = () => {
    setBuilding(true);
    setTimeout(() => {
      try {
        const r = buildClinicalStack(profile, {
          strategy,
          lab: labAnalysis ?? null,
          courseWeek: typeof courseWeek === 'number' ? courseWeek : 1,
          filterOrgans: filterOrgans.length ? filterOrgans : undefined,
          filterMechanisms: filterMechanisms.length ? filterMechanisms : undefined,
          filterMarkers: filterMarkers.length ? filterMarkers : undefined,
          evidenceLevel: evidenceLevel !== 'all' ? evidenceLevel : undefined,
        });
        setClinicalResult(r);
      } catch (e: any) {
        showToast('Ошибка подбора: ' + (e?.message || e), 'error');
      } finally {
        setBuilding(false);
      }
    }, 10);
  };

  const onToPlan = () => {
    if (!clinicalResult) return;
    const ids = clinicalResult.substances.map((s) => s.id);
    localStorage.setItem(
      'he_biostack_to_plan',
      JSON.stringify({ stackIds: ids, name: 'Клинический подбор (BioStack)' }),
    );
    setStackIds(ids);
    showToast(`Клинический стек (${ids.length}) отправлен в план поддержки`, 'success');
  };

  /* ═══ RENDER ═══ */
  return (
    <div style={{ paddingBottom: 80 }}>
      {/* ─── Mode toggle ─── */}
      <div style={{ textAlign: 'center', margin: '4px 0 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>🧩 Мастер сборки стека</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {mode === 'cascade' ? 'Орган → механизм → маркёр' : 'Движок поддержки — канонические дозы, ТЗ-28'}
        </div>
      </div>

      {/* ─── Mode pills ─── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'center' }}>
        <button onClick={() => setMode('cascade')} style={{
          padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: mode === 'cascade' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${mode === 'cascade' ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
          color: mode === 'cascade' ? '#a78bfa' : 'rgba(255,255,255,0.5)',
        }}>🧪 Каскад ТЗ</button>
        <button onClick={() => setMode('clinical')} style={{
          padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: mode === 'clinical' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${mode === 'clinical' ? 'rgba(0,230,138,0.35)' : 'rgba(255,255,255,0.08)'}`,
          color: mode === 'clinical' ? '#00e68a' : 'rgba(255,255,255,0.5)',
        }}>⚕️ Клинический</button>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* CASCADE MODE                                    */}
      {/* ═══════════════════════════════════════════════ */}
      {mode === 'cascade' && (
        <>
          <GlassCard title="🧪 TZ-каскад" icon="🧪" color="#a78bfa">
            <button onClick={() => setTzCascadeOpen(true)} style={{
              width: '100%', padding: '20px 16px', borderRadius: 16, cursor: 'pointer',
              background: TZ_CASCADE_BTN.gradient,
              border: '1px solid ' + TZ_CASCADE_BTN.border,
              display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
            }}>
              <span style={{ fontSize: 32 }}>{TZ_CASCADE_BTN.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: TZ_CASCADE_BTN.color }}>{TZ_CASCADE_BTN.label}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3, textAlign: 'center' }}>{TZ_CASCADE_BTN.desc}</span>
            </button>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>📏 Размер стека:</span>
                <input type="range" min={1} max={40} value={targetSize} onChange={e => setTargetSize(+e.target.value)}
                  style={{ flex: 1, height: 3, accentColor: '#60a5fa', cursor: 'pointer' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', minWidth: 22, textAlign: 'right' }}>{targetSize}</span>
              </div>
              <div style={{ padding: '5px 10px', borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={avoidConflicts} onChange={e => setAvoidConflicts(e.target.checked)}
                  style={{ accentColor: '#00e68a', width: 14, height: 14 }} />
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>Без конфликтов</span>
              </div>
            </div>
          </GlassCard>

          <TzCascadePopup open={tzCascadeOpen} onClose={() => setTzCascadeOpen(false)} onConfirm={handleTzCascadeBuild} />

          {/* ─── Cost bar ─── */}
          {result && (() => {
            const totalCost = result.stack.reduce((s, id) => s + estCost(id), 0);
            const priceScore = totalCost > 10000 ? 20 : totalCost > 5000 ? 50 : totalCost > 2000 ? 75 : 90;
            const priceLabel = totalCost > 10000 ? '💰💰💰' : totalCost > 5000 ? '💰💰' : totalCost > 2000 ? '💰' : '🟢';
            return (
              <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>💰 Ориентир. стоимость/мес</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#00e68a' }}>{totalCost.toLocaleString()} ₽ {priceLabel}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ width: priceScore + '%', height: '100%', borderRadius: 2,
                    background: priceScore >= 70 ? '#22c55e' : priceScore >= 40 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
            );
          })()}

          {gates && <ClinicalResultCard result={gates} />}

          {/* ─── Cascade result ─── */}
          {result && (
            <GlassCard title="📋 Результат сборки" icon="📋" color="#00e68a">
              {result.budgetNote && (
                <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', marginBottom: 6, fontSize: 8, color: '#22c55e' }}>
                  {result.budgetNote}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
                <StatBox label="Синергия" value={result.explanation.totalSynergyScore} color="#8b5cf6" />
                <StatBox label="Покрытие" value={`${result.explanation.completeness}%`} color="#8b5cf6" />
                <StatBox label="Компонентов" value={result.stack.length} color="#00e68a" />
                <StatBox label="С дозировкой" value={`${result.explanation.totalDoseCount}/${result.stack.length}`} color="#60a5fa" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                {result.explanation.substances.map(s => {
                  const ev = getEvidenceGrade(s.id);
                  const evColor = ev === 'A' ? '#22c55e' : ev === 'B' ? '#f59e0b' : '#9ca3af';
                  return (
                    <div key={s.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{s.name}</span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>~{estCost(s.id).toLocaleString()} ₽</span>
                          <span title={`Доказательность: ${ev}`} style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: evColor + '22', color: evColor }}>{ev}</span>
                          <span style={{ fontSize: 8, color: '#00e68a' }}>{s.role}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>🧬 {s.mechanism}</div>
                      {s.dose && <div style={{ fontSize: 8, color: '#60a5fa' }}>💊 {s.dose}</div>}
                      <SubstanceMechanismCard id={s.id} />
                      <SubstanceTzCard id={s.id} />
                    </div>
                  );
                })}
              </div>
              {result.explanation.warnings.length > 0 && (
                <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠ Предупреждения:</div>
                  {result.explanation.warnings.slice(0, 5).map((w, i) => (
                    <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>• {w}</div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setStackIds(result.stack); handleSaveStack(); }}
                  disabled={(gates?.hardStops.length ?? 0) > 0} style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 11, fontWeight: 800,
                    cursor: (gates?.hardStops.length ?? 0) > 0 ? 'not-allowed' : 'pointer',
                    background: (gates?.hardStops.length ?? 0) > 0 ? 'rgba(239,68,68,0.08)' : 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,198,83,0.05))',
                    border: '1px solid ' + ((gates?.hardStops.length ?? 0) > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(0,230,138,0.2)'),
                    color: (gates?.hardStops.length ?? 0) > 0 ? '#f87171' : '#00e68a',
                    letterSpacing: 0.3,
                  }}>{(gates?.hardStops.length ?? 0) > 0 ? '🛑 Есть противопоказания' : '💾 Сохранить стек'}</button>
                <button onClick={() => {
                  const txt = result.explanation.substances.map(s => s.name + ' — ' + (s.dose || s.role)).join('\n');
                  navigator.clipboard.writeText(txt);
                }} style={{ padding: '12px 16px', borderRadius: 12, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: '#202023', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>📋</button>
                <button onClick={() => {
                  try {
                    let arr: any[] = JSON.parse(localStorage.getItem('he_my_stacks') || '[]');
                    const ids = result.stack;
                    const key = 'biostack_build_' + ids.join('_');
                    if (!arr.find((x:any) => x.id === key)) {
                      const subNames = ids.slice(0,3).map((id:string) => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id).join(', ');
                      arr.push({
                        id: key, name: 'BioStack Build: ' + subNames + (ids.length > 3 ? ' и ещё ' + (ids.length-3) : ''),
                        description: result.explanation.name || 'Собран в BioStack Build',
                        system: (result.explanation.coverage?.goals || []).join(', ') || 'Мультисистемная', subs: ids,
                        dosages: Object.fromEntries(result.explanation.substances.map(s => [s.id, s.dose || ''])),
                        timingSummary: '', monitoring: '', specialInstructions: '', contraindications: '', warnings: '',
                        synergyScore: result.explanation.totalSynergyScore ?? 0,
                        source: 'BioStack Build', date: new Date().toISOString()
                      });
                      localStorage.setItem('he_my_stacks', JSON.stringify(arr));
                    }
                  } catch {}
                }} disabled={(gates?.hardStops.length ?? 0) > 0} style={{
                  padding: '12px 16px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                  cursor: (gates?.hardStops.length ?? 0) > 0 ? 'not-allowed' : 'pointer',
                  background: (gates?.hardStops.length ?? 0) > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.1)',
                  border: '1px solid ' + ((gates?.hardStops.length ?? 0) > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.2)'),
                  color: (gates?.hardStops.length ?? 0) > 0 ? '#f87171' : '#818cf8',
                }}>📦 В стеки</button>
              </div>
            </GlassCard>
          )}

          {/* ─── Replacement panel ─── */}
          {result && (() => {
            const curStack = result.stack;
            const s2sItems: { complexId: string; complexName: string; components: { id: string; name: string }[] }[] = [];
            for (const id of curStack) {
              const comps = SUPPLEMENT_COMPOSITION[id];
              if (comps && comps.length >= 2) {
                const valid = comps.filter(c => SUPPORT_CATALOG_DATA[c]);
                if (valid.length >= 2) { s2sItems.push({ complexId: id, complexName: COMPLEX_NAMES[id] || SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id, components: valid.map(c => ({ id: c, name: SUPPORT_CATALOG_DATA[c]?.nameRu || SUPPORT_CATALOG_DATA[c]?.name || c })) }); continue; }
              }
              const algo = findReplacement(id, 'single_to_stack', toFinderProfile(profile));
              if (algo.length >= 2) s2sItems.push({ complexId: id, complexName: SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id, components: algo.slice(0, 5).map(r => ({ id: r.replacementId, name: r.replacementName })) });
            }
            const s2sMerges: { targetId: string; targetName: string; ids: string[] }[] = [];
            for (const [complexId, components] of Object.entries(SUPPLEMENT_COMPOSITION)) {
              const inStack = components.filter(c => curStack.includes(c));
              if (inStack.length >= 2) s2sMerges.push({ targetId: complexId, targetName: COMPLEX_NAMES[complexId] || SUPPORT_CATALOG_DATA[complexId]?.nameRu || SUPPORT_CATALOG_DATA[complexId]?.name || complexId, ids: inStack });
            }
            const algoMerge = findSingleReplacementForStack(curStack, toFinderProfile(profile));
            const hasAny = s2sItems.length > 0 || s2sMerges.length > 0 || (algoMerge && !s2sMerges.some(m => m.targetId === algoMerge.replacementId));
            if (!hasAny) return null;
            return (
              <GlassCard title="🔀 Замена и компоновка" icon="🔀" color="#f59e0b">
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Заменить комплекс одним препаратом или разложить на компоненты</div>
                {s2sMerges.length > 0 && (<div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>📦 Собрать в один препарат</div>
                  {s2sMerges.map(m => (<div key={m.targetId} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)', marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>{m.targetName}</span><span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>→ {m.ids.length} компонента</span></div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', margin: '3px 0' }}>{m.ids.map(cid => (<span key={cid} style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 7 }}>{SUPPORT_CATALOG_DATA[cid]?.nameRu || SUPPORT_CATALOG_DATA[cid]?.name || cid}</span>))}</div>
                    <button onClick={() => { const newStack = curStack.filter(id => !m.ids.includes(id)); newStack.push(m.targetId); const exp = explainStack(newStack, toFinderProfile(profile)); setResult({ stack: newStack, explanation: exp }); }} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>🔄 Заменить {m.ids.length}→1</button>
                  </div>))}
                </div>)}
                {algoMerge && !s2sMerges.some(m => m.targetId === algoMerge.replacementId) && (<div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>📦 Алгоритм: собрать в один</div>
                  <div style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>{algoMerge.replacementName}</div><div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>{algoMerge.explanation}</div>
                    <button onClick={() => { const newStack = [algoMerge.replacementId]; const exp = explainStack(newStack, toFinderProfile(profile)); setResult({ stack: newStack, explanation: exp }); }} style={{ marginTop: 4, padding: '4px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>🔄 Заменить весь стек</button>
                  </div>
                </div>)}
                {s2sItems.length > 0 && (<div><div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700, marginBottom: 4 }}>🧩 Разложить комплекс на части</div>
                  {s2sItems.map(item => (<div key={item.complexId} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.08)', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>{item.complexName}</div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>{item.components.map(c => (<span key={c.id} style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.1)', color: '#93c5fd', fontSize: 7, fontWeight: 600 }}>{c.name}</span>))}</div>
                    <button onClick={() => { const newStack = curStack.filter(id => id !== item.complexId); item.components.forEach(c => { if (!newStack.includes(c.id)) newStack.push(c.id); }); const exp = explainStack(newStack, toFinderProfile(profile)); setResult({ stack: newStack, explanation: exp }); }} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>🔄 Разложить 1→{item.components.length}</button>
                  </div>))}
                </div>)}
              </GlassCard>
            );
          })()}
        </>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* CLINICAL MODE                                   */}
      {/* ═══════════════════════════════════════════════ */}
      {mode === 'clinical' && (
        <>
          <GlassCard title="🔬 Клинический подбор" icon="🧬" color="#00e68a">
            <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,marginBottom:10,background:'rgba(0,230,138,0.06)',border:'1px solid rgba(0,230,138,0.1)' }}>
              <span style={{ fontSize:28 }}>⚕️</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14,fontWeight:800,color:'#00e68a' }}>Стек строится движком поддержки</div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.4,marginTop:2 }}>
                  Единый источник истины — калькулятор поддержки. Канонические дозы, механизмы ТЗ (28 кодов),
                  клинический шлюз безопасности: противопоказания, ЛС-конфликты, UL, лаб-коррекции.
                </div>
              </div>
            </div>

            {/* Strategy pills */}
            <div style={{ marginTop:10,display:'flex',gap:8,flexWrap:'wrap' }}>
              {STRATEGIES.map((s) => (
                <button key={s.id} onClick={() => setStrategy(s.id)} style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: strategy === s.id ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${strategy === s.id ? 'rgba(0,230,138,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: strategy === s.id ? '#00e68a' : 'rgba(255,255,255,0.5)',
                }}>{s.label}</button>
              ))}
            </div>

            {/* Multi-filters */}
            <div style={{ marginTop:14,display:'flex',flexDirection:'column',gap:14 }}>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.82)',marginBottom:2 }}>🫀 Органы / системы</div>
                <MultiChips options={ORGAN_OPTIONS} selected={filterOrgans} onToggle={toggleOrgan} color="#00e68a" />
              </div>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.82)',marginBottom:2 }}>⚙️ Механизмы ТЗ</div>
                <MultiChips options={MECH_OPTIONS} selected={filterMechanisms} onToggle={toggleMechanism} color="#a78bfa" />
              </div>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.82)',marginBottom:2 }}>🧪 Лаб-маркеры</div>
                <MultiChips options={MARKER_OPTIONS} selected={filterMarkers} onToggle={toggleMarker} color="#f59e0b" />
              </div>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.82)',marginBottom:2 }}>📚 Уровень доказательности</div>
                <MultiChips
                  options={[{ id:'all', label:'Все' },{ id:'A', label:'A' },{ id:'B', label:'B' },{ id:'C', label:'C' }]}
                  selected={[evidenceLevel]}
                  onToggle={(id) => setEvidenceLevel(id as 'all'|'A'|'B'|'C')}
                  color="#60a5fa"
                />
              </div>
              {(filterOrgans.length > 0 || filterMechanisms.length > 0 || filterMarkers.length > 0 || evidenceLevel !== 'all') && (
                <button onClick={resetFilters} style={{ alignSelf:'flex-start',fontSize:11,padding:'4px 10px',borderRadius:8,cursor:'pointer',background:'transparent',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.5)' }}>✕ Сбросить фильтры</button>
              )}
            </div>

            <button onClick={onClinicalBuild} disabled={building} style={{
              marginTop:12,width:'100%',padding:'14px 0',borderRadius:14,border:'none',
              background:building?'rgba(0,230,138,0.4)':'linear-gradient(135deg,#00e68a,#00b4d8)',
              color:'#00120c',fontWeight:800,fontSize:15,cursor:'pointer',
              boxShadow:building?'none':'0 6px 20px rgba(0,230,138,0.2)',
            }}>{building?'⚙️ Собираю…':'⚕️ Собрать клинический стек'}</button>
          </GlassCard>

          {/* ─── Clinical result ─── */}
          {clinicalResult && (
            <>
              <GlassCard title="📊 Возможное изменение риска" icon="📈" color="#60a5fa" style={{ marginTop: 12 }}>
                {(() => {
                  const delta = Math.round((clinicalResult.riskBefore - clinicalResult.riskAfter) * 10) / 10;
                  const improved = delta > 0;
                  return (
                    <>
                      <div style={{ display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:8,alignItems:'center' }}>
                        <div style={{ padding:'12px',borderRadius:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',textAlign:'center' }}>
                          <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4 }}>Риск сейчас</div>
                          <div style={{ fontSize:32,fontWeight:800,color:'#fff' }}>{clinicalResult.riskBefore}</div>
                        </div>
                        <div style={{ fontSize:24,color:'rgba(255,255,255,0.3)',fontWeight:300 }}>→</div>
                        <div style={{ padding:'12px',borderRadius:12,background:improved?'rgba(34,197,94,0.06)':'rgba(245,158,11,0.06)',border:`1px solid ${improved?'rgba(34,197,94,0.15)':'rgba(245,158,11,0.15)'}`,textAlign:'center' }}>
                          <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4 }}>Прогноз</div>
                          <div style={{ fontSize:32,fontWeight:800,color:improved?'#22c55e':'#fbbf24' }}>{clinicalResult.riskAfter}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex',gap:8,marginTop:10 }}>
                        <div style={{ flex:1,padding:'8px 12px',borderRadius:10,background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.1)',textAlign:'center' }}>
                          <div style={{ fontSize:20,fontWeight:800,color:improved?'#22c55e':'#f59e0b' }}>{improved?`−${delta}`:`+${Math.abs(delta)}`}</div>
                          <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>Δ прогноз</div>
                        </div>
                        <div style={{ flex:1,padding:'8px 12px',borderRadius:10,background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.1)',textAlign:'center' }}>
                          <div style={{ fontSize:20,fontWeight:800,color:'#60a5fa' }}>{clinicalResult.coveragePercent}%</div>
                          <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>Покрытие</div>
                        </div>
                      </div>
                      <div style={{ marginTop:8,padding:'6px 10px',borderRadius:8,background:'rgba(96,165,250,0.08)',fontSize:10,color:'rgba(255,255,255,0.45)',lineHeight:1.4 }}>
                        ⓘ Прогноз изменения риска. BioStack не влияет на расчёт — только оценка эффекта поддержки.
                      </div>
                    </>
                  );
                })()}
                <div style={{ marginTop:8,fontSize:10,color:'rgba(255,255,255,0.3)' }}>
                  Источник: {clinicalResult.sourceOfTruth} · неделя {clinicalResult.courseWeek}
                </div>
              </GlassCard>

              {/* Composition */}
              <GlassCard title={`💊 Состав (${clinicalResult.substances.length})`} icon="💊" color="#a78bfa" style={{ marginTop: 12 }}>
                {clinicalResult.substances.map((s) => (
                  <div key={s.id} style={{ padding:'12px 14px',marginBottom:4,borderRadius:12,background:'rgba(167,139,250,0.04)',border:'1px solid rgba(167,139,250,0.08)' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8 }}>
                      <div>
                        <span style={{ fontWeight:700,fontSize:14,color:'#fff' }}>{s.name}</span>
                        <span style={{ marginLeft:6,fontSize:9,padding:'2px 6px',borderRadius:4,
                          background: s.tier==='core'?'rgba(34,197,94,0.15)':s.tier==='standard'?'rgba(96,165,250,0.15)':'rgba(167,139,250,0.1)',
                          color: s.tier==='core'?'#22c55e':s.tier==='standard'?'#60a5fa':'#a78bfa' }}>{s.tier}</span>
                      </div>
                      <div style={{ fontSize:14,fontWeight:700,color:'#00e68a' }}>{s.doseDisplay || `${s.doseMg} мг`}</div>
                    </div>
                    <div style={{ fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2 }}>{s.timing}</div>
                    {s.tzMechanisms.length>0 && (
                      <div style={{ marginTop:6,display:'flex',gap:4,flexWrap:'wrap' }}>
                        {s.tzMechanisms.slice(0,5).map((m) => (
                          <span key={m.mechId} style={{ fontSize:9,padding:'3px 8px',borderRadius:6,background:'rgba(96,165,250,0.15)',color:'#93c5fd',fontWeight:600 }}>{m.label}</span>
                        ))}
                      </div>
                    )}
                    {s.mechanismReason && (
                      <div style={{ marginTop:4,fontSize:10,color:'rgba(255,255,255,0.35)',lineHeight:1.3 }}>{s.mechanismReason}</div>
                    )}
                  </div>
                ))}
              </GlassCard>

              {/* Excluded by severity */}
              {clinicalResult.excluded.length > 0 && (() => {
                const SEV_META: Record<string, { title: string; icon: string; color: string; note: string }> = {
                  hard: { title: 'Абсолютные противопоказания', icon: '🛑', color: '#f87171', note: 'Удалены полностью — приём недопустим' },
                  drug: { title: 'Конфликты с лекарствами', icon: '💊', color: '#fb7185', note: 'Удалены из-за взаимодействия с текущими ЛС' },
                  ul: { title: 'Превышен верхний предел (UL)', icon: '⚠️', color: '#f59e0b', note: 'Удалены во избежание передозировки' },
                  titration: { title: 'Требуется титрация дозы', icon: '🔧', color: '#fbbf24', note: 'Не удаление — снизьте/подберите дозу под контролем' },
                  redundant: { title: 'Дублирование (избыточно)', icon: '🔁', color: '#9ca3af', note: 'Убраны как дубли уже покрытых механизмов' },
                };
                const order: Array<keyof typeof SEV_META> = ['hard', 'drug', 'ul', 'titration', 'redundant'];
                const groups = order.map((sev) => ({ sev, meta: SEV_META[sev], items: clinicalResult.excluded.filter((x) => x.severity === sev) })).filter((g) => g.items.length > 0);
                return groups.map((g) => (
                  <GlassCard key={g.sev} title={`${g.meta.title} (${g.items.length})`} icon={g.meta.icon} color={g.meta.color} style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: g.meta.color, marginBottom: 6, fontWeight: 600 }}>{g.meta.note}</div>
                    {g.items.map((x, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{x.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)' }}>{x.reason}</div>
                      </div>
                    ))}
                  </GlassCard>
                ));
              })()}

              {/* Titrations */}
              {clinicalResult.safety.drugTitrations.length > 0 && (
                <GlassCard title={`🔧 Титрация доз (${clinicalResult.safety.drugTitrations.length})`} icon="🔧" color="#fbbf24" style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 6, fontWeight: 600 }}>Вещество остаётся в стеке, но дозу нужно подобрать под контролем (взаимодействие с текущими ЛС)</div>
                  {clinicalResult.safety.drugTitrations.map((t: any, i: number) => {
                    const kept = clinicalResult.substances.some((s) => s.id === t.substanceId);
                    return (
                      <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{t.substanceName}</div>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: kept ? 'rgba(0,230,138,0.18)' : 'rgba(156,163,175,0.18)', color: kept ? '#00e68a' : '#9ca3af', whiteSpace: 'nowrap' }}>{kept ? 'в стеке' : 'отсеяно'}</span>
                        </div>
                        {t.drug && <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)', marginTop: 2 }}>ЛС: {t.drug}{t.effect ? ` · ${t.effect}` : ''}</div>}
                        {t.recommendation && <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 3 }}>→ {t.recommendation}</div>}
                        {t.mechanism && <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.5)', marginTop: 2 }}>{t.mechanism}</div>}
                      </div>
                    );
                  })}
                </GlassCard>
              )}

              {/* Lab adjustments */}
              {clinicalResult.safety.labAdjustments.length > 0 && (
                <GlassCard title="🔬 Лабораторные коррекции" icon="🧪" color="#f59e0b" style={{ marginTop: 12 }}>
                  {clinicalResult.safety.labAdjustments.map((a: any, i: number) => (
                    <div key={i} style={{ padding: '6px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>• {a.message || a.reason || JSON.stringify(a)}</div>
                  ))}
                </GlassCard>
              )}

              {/* Monitoring */}
              {clinicalResult.monitoring.length > 0 && (
                <GlassCard title="🩺 Мониторинг" icon="📋" color="#34d399" style={{ marginTop: 12 }}>
                  {clinicalResult.monitoring.map((m, i) => (
                    <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>• {m}</div>
                  ))}
                </GlassCard>
              )}
              {clinicalResult.specialInstructions.length > 0 && (
                <GlassCard title="📌 Особые указания" icon="⚠️" color="#fbbf24" style={{ marginTop: 12 }}>
                  {clinicalResult.specialInstructions.map((m, i) => (
                    <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>• {m}</div>
                  ))}
                </GlassCard>
              )}
              {clinicalResult.conflicts.length > 0 && (
                <GlassCard title="🔗 Конфликты" icon="⚡" color="#c084fc" style={{ marginTop: 12 }}>
                  {clinicalResult.conflicts.map((m, i) => (
                    <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>• {m}</div>
                  ))}
                </GlassCard>
              )}

              <button onClick={onToPlan} style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00b4d8)', color: '#00120c', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                ➕ Отправить в план поддержки ({clinicalResult.substances.length})
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
