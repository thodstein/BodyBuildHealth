import React, { useState, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack, type StackExplanation, findReplacement, findSingleReplacementForStack } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { SUPPLEMENT_COMPOSITION, COMPLEX_NAMES } from '../../data/support-meta';
import { GlassCard, StatBox, toFinderProfile, showToast, estCost, SubstanceMechanismCard, SubstanceTzCard } from './BioStackAIConstants';
import { getSafeStackRecommendations } from '../../engines/biostack-safety.engine';
import {
  selectStack, getEvidenceGrade,
} from '../../engines/biostack-clinical-v2.engine';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import type { LinkedData } from '../../core/data-link';
import { ClinicalResultCard } from './BioStackAIClinicalCard';
import { TzCascadePopup, type TzCascadeResult } from './BioStackAITzCascade';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../../data/support-db';

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



/* ─── Main BuildTab ─── */
export function BuildTab({ profile, stackIds, setStackIds, labAnalysis, linked }: {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  labAnalysis?: LabCompositeResult | null;
  linked?: LinkedData;
}) {
  const [result, setResult] = useState<{ stack: string[]; explanation: StackExplanation; budgetNote?: string } | null>(null);
  const [gates, setGates] = useState<ReturnType<typeof selectStack> | null>(null);
  const [tzCascadeOpen, setTzCascadeOpen] = useState(false);
  const [targetSize, setTargetSize] = useState(10);
  const [avoidConflicts, setAvoidConflicts] = useState(true);

  /* ─── TZ-cascade build ─── */
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

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ textAlign: 'center', margin: '4px 0 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>🧩 Мастер сборки стека</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Орган → механизм → маркёр</div>
      </div>

      {/* ─── TZ-cascade card ─── */}
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

      <TzCascadePopup
        open={tzCascadeOpen}
        onClose={() => setTzCascadeOpen(false)}
        onConfirm={handleTzCascadeBuild}
      />

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

      {/* ─── Result ─── */}
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
              disabled={(gates?.hardStops.length ?? 0) > 0}
              style={{
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
            }} style={{
              padding: '12px 16px', borderRadius: 12, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: '#202023', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
            }}>📋</button>
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
            if (valid.length >= 2) {
              s2sItems.push({
                complexId: id,
                complexName: COMPLEX_NAMES[id] || SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id,
                components: valid.map(c => ({ id: c, name: SUPPORT_CATALOG_DATA[c]?.nameRu || SUPPORT_CATALOG_DATA[c]?.name || c })),
              });
              continue;
            }
          }
          const algo = findReplacement(id, 'single_to_stack', toFinderProfile(profile));
          if (algo.length >= 2) {
            s2sItems.push({
              complexId: id,
              complexName: SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id,
              components: algo.slice(0, 5).map(r => ({ id: r.replacementId, name: r.replacementName })),
            });
          }
        }

        const s2sMerges: { targetId: string; targetName: string; ids: string[] }[] = [];
        for (const [complexId, components] of Object.entries(SUPPLEMENT_COMPOSITION)) {
          const inStack = components.filter(c => curStack.includes(c));
          if (inStack.length >= 2) {
            s2sMerges.push({
              targetId: complexId,
              targetName: COMPLEX_NAMES[complexId] || SUPPORT_CATALOG_DATA[complexId]?.nameRu || SUPPORT_CATALOG_DATA[complexId]?.name || complexId,
              ids: inStack,
            });
          }
        }
        const algoMerge = findSingleReplacementForStack(curStack, toFinderProfile(profile));
        const hasAny = s2sItems.length > 0 || s2sMerges.length > 0 || (algoMerge && !s2sMerges.some(m => m.targetId === algoMerge.replacementId));

        if (!hasAny) return null;

        return (
          <GlassCard title={`🔀 Замена и компоновка`} icon="🔀" color="#f59e0b">
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
              Заменить комплекс одним препаратом или разложить на компоненты
            </div>

            {s2sMerges.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>📦 Собрать в один препарат</div>
                {s2sMerges.map(m => (
                  <div key={m.targetId} style={{
                    padding: '6px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.04)',
                    border: '1px solid rgba(245,158,11,0.08)', marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>{m.targetName}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>→ {m.ids.length} компонента</span>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', margin: '3px 0' }}>
                      {m.ids.map(cid => (
                        <span key={cid} style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 7 }}>
                          {SUPPORT_CATALOG_DATA[cid]?.nameRu || SUPPORT_CATALOG_DATA[cid]?.name || cid}
                        </span>
                      ))}
                    </div>
            <button onClick={() => {
              const newStack = curStack.filter(id => !m.ids.includes(id));
              newStack.push(m.targetId);
              const exp = explainStack(newStack, toFinderProfile(profile));
              setResult({ stack: newStack, explanation: exp });
            }} style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24',
            }}>🔄 Заменить {m.ids.length}→1</button>
                  </div>
                ))}
              </div>
            )}

            {algoMerge && !s2sMerges.some(m => m.targetId === algoMerge.replacementId) && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>📦 Алгоритм: собрать в один</div>
                <div style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>{algoMerge.replacementName}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>{algoMerge.explanation}</div>
                  <button onClick={() => {
                    const newStack = [algoMerge.replacementId];
                    const exp = explainStack(newStack, toFinderProfile(profile));
                    setResult({ stack: newStack, explanation: exp });
                  }} style={{
                    marginTop: 4, padding: '4px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24',
                  }}>🔄 Заменить весь стек</button>
                </div>
              </div>
            )}

            {s2sItems.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700, marginBottom: 4 }}>🧩 Разложить комплекс на части</div>
                {s2sItems.map(item => (
                  <div key={item.complexId} style={{
                    padding: '6px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.04)',
                    border: '1px solid rgba(96,165,250,0.08)', marginBottom: 4,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>{item.complexName}</div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
                      {item.components.map(c => (
                        <span key={c.id} style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.1)', color: '#93c5fd', fontSize: 7, fontWeight: 600 }}>
                          {c.name}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => {
                      const newStack = curStack.filter(id => id !== item.complexId);
                      item.components.forEach(c => { if (!newStack.includes(c.id)) newStack.push(c.id); });
                      const exp = explainStack(newStack, toFinderProfile(profile));
                      setResult({ stack: newStack, explanation: exp });
                    }} style={{
                      padding: '4px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
                    }}>🔄 Разложить 1→{item.components.length}</button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        );
      })()}
    </div>
  );
}
