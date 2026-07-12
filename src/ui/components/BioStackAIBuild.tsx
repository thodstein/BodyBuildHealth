import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile, type GoalType } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack, type StackExplanation, findReplacement, findSingleReplacementForStack, type ReplacementResult } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS, ALL_STACKS, type SupportStack, getStackSubstanceLabel } from '../../data/support-database';
import { TZ_MECH_LABELS } from '../../data/support-db';
import { ORGAN_LABELS, SYSTEM_LABELS_CATALOG } from '../../data/support-database';
import { LAB_MARKER_MAP, type LabMarkerMap } from '../../data/lab-marker-map';
import { STACK_TEMPLATES, type BioStackTemplate } from '../../engines/biostack-templates';
import { SUPPLEMENT_COMPOSITION, COMPONENT_TO_COMPLEX } from '../../data/support-meta';
import { GlassCard, PillBtn, StatBox, ORGANS, SYSTEMS, PURE_GOALS, TARGET_SYSTEMS, toFinderProfile, showToast, estCost } from './BioStackAIConstants';
import { buildSmartStackMulti, type BuildVariant } from '../../engines/biostack-recommender.engine';
import { getSafeStackRecommendations } from '../../engines/biostack-safety.engine';
import {
  selectStack, getEvidenceGrade,
} from '../../engines/biostack-clinical-v2.engine';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import type { LinkedData } from '../../core/data-link';

type LMState = Record<string, 'off' | 'maintain' | 'correct'>;

const GOAL_GROUPS: { key: string; label: string; goal: GoalType }[] = [
  { key: 'physique', label: '🏋️ Физическая форма', goal: 'muscle_gain' },
  { key: 'physique', label: '🏋️ Физическая форма', goal: 'fat_loss' },
  { key: 'physique', label: '🏋️ Физическая форма', goal: 'endurance' },
  { key: 'recovery', label: '🔄 Восстановление', goal: 'sleep' },
  { key: 'recovery', label: '🔄 Восстановление', goal: 'recovery' },
  { key: 'energy', label: '⚡ Энергия и тонус', goal: 'energy' },
  { key: 'energy', label: '⚡ Энергия и тонус', goal: 'libido' },
  { key: 'cognitive', label: '🧠 Когнитивные', goal: 'concentration' },
  { key: 'cognitive', label: '🧠 Когнитивные', goal: 'brain' },
  { key: 'psycho', label: '😊 Психоэмоциональное', goal: 'mood' },
  { key: 'psycho', label: '😊 Психоэмоциональное', goal: 'stress' },
  { key: 'systemic', label: '❤️ Системное здоровье', goal: 'cardio_health' },
  { key: 'systemic', label: '❤️ Системное здоровье', goal: 'immunity' },
  { key: 'systemic', label: '❤️ Системное здоровье', goal: 'hormones' },
  { key: 'systemic', label: '❤️ Системное здоровье', goal: 'joints' },
  { key: 'systemic', label: '❤️ Системное здоровье', goal: 'digestion' },
  { key: 'systemic', label: '❤️ Системное здоровье', goal: 'detox' },
  { key: 'systemic', label: '❤️ Системное здоровье', goal: 'longevity' },
];

const POPUP_Z = 250;

/* ─── PopupChips: multi-select grouped chips ─── */
function PopupChips({ label, options, selected, onChange, groups }: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  groups?: { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const activeCount = selected.length;
  const labelShort = activeCount > 0 ? `${label} (${activeCount})` : label;

  const grouped = useMemo(() => {
    if (!groups) return { '_all': options };
    const byKey: Record<string, { key: string; label: string; items: { id: string; label: string }[] }> = {};
    groups.forEach(g => { byKey[g.key] = { ...g, items: [] }; });
    options.forEach(o => {
      const g = groups.find(gg => gg.key === o.id);
      if (g) byKey[g.key]?.items.push(o);
    });
    return byKey;
  }, [options, groups]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  return <>
    <button onClick={() => setOpen(true)} style={{
      width: '100%', padding: '8px 10px', borderRadius: 8,
      cursor: 'pointer', fontSize: 10, fontWeight: 700, textAlign: 'center',
      background: activeCount > 0 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)',
      border: activeCount > 0 ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.06)',
      color: activeCount > 0 ? '#00e68a' : 'rgba(255,255,255,0.5)',
    }}>
      {labelShort}
    </button>
    {open && <div style={{
      position: 'fixed', inset: 0, zIndex: POPUP_Z,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)'
    }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90%', maxWidth: 380, maxHeight: '75vh',
        borderRadius: 16, background: '#18181b',
        border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={{ padding: '14px 16px', maxHeight: 'calc(75vh - 3px)', overflowY: 'auto' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#00e68a', marginBottom: 10 }}>{label}</div>
          {Object.entries(grouped).map(([gk, grp]) => {
            const itemz = (grp as any).items || options;
            const labelz = (grp as any).label || '';
            if (itemz.length === 0) return null;
            return <div key={gk} style={{ marginBottom: 8 }}>
              {labelz && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{labelz}</div>}
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {itemz.map((o: { id: string; label: string }) => {
                  const on = selected.includes(o.id);
                  return <button key={o.id} onClick={() => toggle(o.id)} style={{
                    padding: '5px 10px', borderRadius: 10, fontSize: 8, fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                    background: on ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                    border: on ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: on ? '#00e68a' : 'rgba(255,255,255,0.6)',
                  }}>{o.label}{on ? ' ✓' : ''}</button>;
                })}
              </div>
            </div>;
          })}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button onClick={() => { onChange([]); setOpen(false); }} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
              fontSize: 9, fontWeight: 700,
            }}>Очистить</button>
            <button onClick={() => setOpen(false)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
              fontSize: 9, fontWeight: 700,
            }}>✅ Готово ({selected.length})</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
}

/* ─── PopupLabs: 3-state toggles (off / maintain / correct) grouped by organ ─── */
function PopupLabs({ label, markers, lmState, onChange }: {
  label: string;
  markers: LabMarkerMap[];
  lmState: LMState;
  onChange: (id: string, state: 'off' | 'maintain' | 'correct') => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(lmState).filter(v => v !== 'off').length;
  const correctCount = Object.values(lmState).filter(v => v === 'correct').length;

  const grouped = useMemo(() => {
    const map: Record<string, LabMarkerMap[]> = {};
    markers.forEach(m => {
      const key = m.organ;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [markers]);

  return <>
    <button onClick={() => setOpen(true)} style={{
      width: '100%', padding: '8px 10px', borderRadius: 8,
      cursor: 'pointer', fontSize: 10, fontWeight: 700, textAlign: 'center',
      background: activeCount > 0 ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
      border: activeCount > 0 ? '1px solid rgba(139,92,246,0.15)' : '1px solid rgba(255,255,255,0.06)',
      color: activeCount > 0 ? '#a78bfa' : 'rgba(255,255,255,0.5)',
    }}>
      🧪 {label} {activeCount > 0 ? `(${correctCount}🔴 / ${activeCount - correctCount}🟢)` : ''}
    </button>
    {open && <div style={{
      position: 'fixed', inset: 0, zIndex: POPUP_Z,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)'
    }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '92%', maxWidth: 400, maxHeight: '80vh',
        borderRadius: 16, background: '#18181b',
        border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,#a78bfa,#8b5cf6)' }} />
        <div style={{ padding: '14px 16px', maxHeight: 'calc(80vh - 3px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>🧪 {label}</span>
            <div style={{ display: 'flex', gap: 4, fontSize: 8 }}>
              <span style={{ color: '#00e68a' }}>🟢 {Object.values(lmState).filter(v => v === 'maintain').length}</span>
              <span style={{ color: '#ef4444' }}>🔴 {correctCount}</span>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.3 }}>
            Клик: поддержать 🟢 | ещё клик: скорректировать 🔴 | третий: сброс
          </div>
          {grouped.map(([org, items]) => (
            <div key={org} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, color: '#60a5fa', fontWeight: 600, marginBottom: 3 }}>
                {ORGAN_LABELS[org] || org} ({items.length})
              </div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {items.map(m => {
                  const st = lmState[m.marker] || 'off';
                  const bg = st === 'correct' ? 'rgba(239,68,68,0.1)' : st === 'maintain' ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)';
                  const bd = st === 'correct' ? 'rgba(239,68,68,0.2)' : st === 'maintain' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)';
                  const cl = st === 'correct' ? '#ef4444' : st === 'maintain' ? '#00e68a' : 'rgba(255,255,255,0.5)';
                  return <button key={m.marker} onClick={() => {
                    const next = st === 'off' ? 'maintain' as const : st === 'maintain' ? 'correct' as const : 'off' as const;
                    onChange(m.marker, next);
                  }} style={{
                    padding: '3px 8px', borderRadius: 10, fontSize: 7, cursor: 'pointer', fontWeight: 600,
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                    background: bg, border: `1px solid ${bd}`, color: cl,
                  }}>
                    {m.name}
                    {st === 'maintain' && ' 🟢'}
                    {st === 'correct' && ' 🔴'}
                  </button>;
                })}
              </div>
            </div>
          ))}
          <button onClick={() => setOpen(false)} style={{
            width: '100%', padding: '10px 0', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa',
            fontSize: 10, fontWeight: 700, marginTop: 4,
          }}>✅ Готово</button>
        </div>
      </div>
    </div>}
  </>;
}

/* ─── ExtStack: merged template + library card ─── */
function ExtStack({ item, type, onLoad }: {
  item: { id: string; name: string; desc: string; icon: string; system: string; substances: string[]; score?: number };
  type: 'template' | 'stack';
  onLoad: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const subs = item.substances.slice(0, 8);
  const extra = item.substances.length - 8;
  return <div style={{
    borderRadius: 12, background: 'rgba(24,24,27,0.6)',
    border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', marginBottom: 4,
  }}>
    <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6' }}>{item.icon} {item.name}</span>
          {type === 'template' ? (
            <span style={{ padding: '1px 6px', borderRadius: 8, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', fontSize: 7, fontWeight: 600 }}>шаблон</span>
          ) : (
            <span style={{ padding: '1px 6px', borderRadius: 8, background: 'rgba(0,230,138,0.1)', color: '#00e68a', fontSize: 7, fontWeight: 600 }}>⭐ {item.score ?? 'стек'}</span>
          )}
          <span style={{ padding: '1px 6px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', color: '#a78bfa', fontSize: 7, fontWeight: 600 }}>🧪 {item.substances.length}</span>
        </div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{item.system}</div>
      </div>
    </div>
    {expanded && <div style={{ padding: '0 10px 6px' }}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3, marginBottom: 4 }}>{item.desc}</div>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
        {subs.map(id => {
          const c = SUPPORT_CATALOG_DATA[id];
          return <span key={id} style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 7 }}>
            {c?.nameRu || c?.name || id}
          </span>;
        })}
        {extra > 0 && <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', fontSize: 7 }}>+{extra}</span>}
      </div>
    </div>}
    <div style={{ display: 'flex', gap: 4, padding: '4px 10px 8px' }}>
      <button onClick={() => onLoad(item.substances)} style={{
        flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
        background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
      }}>📥 Загрузить стек</button>
      <button onClick={() => setExpanded(!expanded)} style={{
        padding: '5px 10px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer',
        background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
      }}>{expanded ? '🔼' : '📋'}</button>
    </div>
  </div>;
}

/* ─── Main BuildTab ─── */
export function BuildTab({ profile, stackIds, setStackIds, labAnalysis, linked }: {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  labAnalysis?: LabCompositeResult | null;
  linked?: LinkedData;
}) {
  const [goals, setGoals] = useState<GoalType[]>(profile.goals);
  const [selOrgans, setSelOrgans] = useState<string[]>(profile.targetOrgans || []);
  const [selSystems, setSelSystems] = useState<string[]>(profile.targetSystems || []);
  const [selTargets, setSelTargets] = useState<GoalType[]>([]);
  const [targetSize, setTargetSize] = useState(() => profile.stackComplexity === 'minimal' ? 5 : profile.stackComplexity === 'balanced' ? 10 : 18);
  const [lmState, setLmState] = useState<LMState>(() => {
    const init: LMState = {};
    if (labAnalysis?.interpretations) {
      for (const interp of labAnalysis.interpretations) {
        if (interp.status === 'high' || interp.status === 'critical_high' || interp.status === 'low') {
          const marker = LAB_MARKER_MAP.find(m =>
            m.marker.toLowerCase() === interp.code.toLowerCase() ||
            m.name.toLowerCase() === interp.code.toLowerCase() ||
            m.name.toLowerCase().includes(interp.code.toLowerCase())
          );
          if (marker) {
            init[marker.marker] = 'correct';
          }
        }
      }
    }
    return init;
  });
  const [result, setResult] = useState<{ stack: string[]; explanation: StackExplanation; budgetNote?: string } | null>(null);
  const [multiResult, setMultiResult] = useState<{ variant: BuildVariant; stack: string[]; estCost: number; synergyScore: number; coverage: string; substanceCount: number }[] | null>(null);
  const [avoidConflicts, setAvoidConflicts] = useState(true);
  const [stkQuery, setStkQuery] = useState('');
  const [stkFilter, setStkFilter] = useState('all');
  const [replaceOpen, setReplaceOpen] = useState(true);
  const [buildLoading, setBuildLoading] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const [gates, setGates] = useState<ReturnType<typeof selectStack> | null>(null);

  const mergedStacks = useMemo(() => {
    const templates: ExtStackItem[] = STACK_TEMPLATES.map(t => ({
      id: t.id, name: t.name, desc: t.description, icon: t.icon || '',
      system: t.goal, substances: t.substanceIds, score: undefined, type: 'template' as const,
    }));
    const stacks: ExtStackItem[] = ALL_STACKS.map(s => ({
      id: s.id, name: s.name, desc: s.description, icon: '',
      system: s.system || '', substances: s.substances.map(x => x.id), score: s.synergyScore, type: 'stack' as const,
    }));
    return [...templates, ...stacks];
  }, []);

  const filteredStacks = useMemo(() => {
    let items = mergedStacks;
    if (stkFilter !== 'all') {
      const q = stkFilter.toLowerCase();
      items = items.filter(it => it.system.toLowerCase().includes(q));
    }
    if (stkQuery.trim()) {
      const q = stkQuery.toLowerCase();
      items = items.filter(it => it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q));
    }
    return items;
  }, [mergedStacks, stkFilter, stkQuery]);

  const handleBuild = useCallback(() => {
    setBuildLoading(true);
    setTimeout(() => {
    const queryOrgans = [...selOrgans];
    const queryMechs: string[] = [];
    const targetToOrgan: Record<string, string> = {
      liver_health: 'LIVER', cardio_health: 'HEART', joints: 'JOINTS',
      skin: 'SKIN', hair: 'SKIN', brain: 'BRAIN', kidney: 'KIDNEYS',
      immunity: 'IMMUNE_SYSTEM', hormones: 'ENDOCRINE', digestion: 'GUT',
    };
    selTargets.forEach(t => { const o = targetToOrgan[t]; if (o && !queryOrgans.includes(o)) queryOrgans.push(o); });
    const sysToOrgan: Record<string, string[]> = {
      hepatic: ['LIVER'], cardio: ['HEART','VESSELS'], renal: ['KIDNEYS'],
      neuro: ['BRAIN','NERVES'], endocrine: ['ENDOCRINE','ADRENALS','THYROID'],
      hematologic: ['BLOOD'], reproductive: ['REPRODUCTIVE','PROSTATE'],
      musculoskeletal: ['MUSCLES','BONES','JOINTS'], immune: ['IMMUNE_SYSTEM'],
      metabolic: ['PANCREAS','LIVER'], gastrointestinal: ['GUT'],
    };
    selSystems.forEach(s => { (sysToOrgan[s] || []).forEach(o => { if (!queryOrgans.includes(o)) queryOrgans.push(o); }); });
    Object.entries(lmState).forEach(([id, state]) => {
      if (state === 'maintain' || state === 'correct') {
        const marker = LAB_MARKER_MAP.find(m => m.marker === id);
        if (marker) {
          if (!queryOrgans.includes(marker.organ)) queryOrgans.push(marker.organ);
          marker.mechanisms.forEach(m => { if (!queryMechs.includes(m)) queryMechs.push(m); });
        }
      }
    });
    const allGoals = [...new Set([...goals, ...selTargets, ...profile.goals])];
    const firstGoal = allGoals[0] || undefined;
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
      baseIds: stackIds, targetSize,
      goal: firstGoal || undefined,
      organs: queryOrgans.length > 0 ? queryOrgans : undefined,
      mechanisms: queryMechs.length > 0 ? queryMechs : undefined,
      autoFill: true, profile: fp,
      avoidIds: conflictFilter ? stackIds.filter(id => !conflictFilter(id)) : undefined,
    });
    // Budget filter: economy → only core/standard
    let filteredStack = built.stack;
    let budgetNote = '';
    if (profile.budget === 'economy') {
      const tierEd = filteredStack.filter(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        return c && (c.tier === 'core' || c.tier === 'standard');
      });
      const removed = filteredStack.length - tierEd.length;
      if (removed > 0) {
        budgetNote = `💰 Бюджетный режим: убрано ${removed} препаратов тира advanced/specialty`;
        filteredStack = tierEd;
      }
    }
    // Drug-safety filter: exclude HIGH-severity drug interactions
    let drugSafetyNote = '';
    if (profile.currentMeds?.length) {
      const { safe, excluded } = getSafeStackRecommendations(filteredStack, profile.currentMeds);
      if (excluded.length > 0) {
        const excludedNames = excluded.map(e => e.substanceName).slice(0, 3).join(', ');
        drugSafetyNote = `💊 Лекарственная безопасность: исключено ${excluded.length} БАДов из-за HIGH-взаимодействий с вашими препаратами (${excludedNames}${excluded.length > 3 ? '...' : ''})`;
        filteredStack = safe;
      }
    }
    // Clinical gate (v2): absolute contraindictions, UL, lab dose-correction,
    // pathway redundancy, daily schedule, cycling advice, hard stops.
    const gate = selectStack(
      filteredStack,
      profile,
      'comprehensive',
      (labAnalysis as LabCompositeResult) || null,
    );
    filteredStack = gate.ids;
    let gateNote = '';
    if (gate.hardStops.length > 0) {
      const st = gate.hardStops.map(h => `${h.substanceName}: ${h.reason}`).slice(0, 4).join('; ');
      gateNote += `\n🛑 Абсолютные противопоказания (исключены): ${st}`;
    }
    const exp = explainStack(filteredStack, fp);
    setGates(gate);
    setResult({ stack: filteredStack, explanation: exp, budgetNote: budgetNote + (drugSafetyNote ? '\n' + drugSafetyNote : '') + gateNote });
    setBuildLoading(false);
    }, 100);
  }, [goals, selTargets, selOrgans, selSystems, targetSize, lmState, stackIds, profile, avoidConflicts, labAnalysis]);

  const handleSaveStack = useCallback(() => {
    if (!result) return;
    const existing: string[][] = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    const updated = [result.stack, ...existing].slice(0, 10);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
  }, [result]);

  const handleMultiBuild = useCallback(() => {
    const allGoals = [...new Set([...goals, ...selTargets, ...profile.goals])] as GoalType[];
    if (allGoals.length === 0) { showToast('Выберите хотя бы одну цель', 'error'); return; }
    setMultiLoading(true);
    setTimeout(() => {
    const recGoals = allGoals.map(g => g === 'muscle_gain' ? 'performance' as const : g === 'fat_loss' ? 'energy' as const : g === 'concentration' ? 'focus' as const : g === 'brain' ? 'focus' as const : g === 'cardio_health' ? 'longevity' as const : g === 'liver_health' ? 'detox' as const : g === 'kidney' ? 'detox' as const : g === 'sleep' ? 'sleep' as const : g === 'recovery' ? 'recovery' as const : g === 'energy' ? 'energy' as const : g === 'immunity' ? 'immunity' as const : g === 'stress' ? 'stress' as const : g === 'libido' ? 'libido' as const : g === 'joints' ? 'joints' as const : g === 'digestion' ? 'digestion' as const : g === 'detox' ? 'detox' as const : g === 'longevity' ? 'longevity' as const : g === 'mood' ? 'stress' as const : g === 'hormones' ? 'libido' as const : 'immunity' as const);
    if (recGoals.length === 0) { showToast('Выберите хотя бы одну цель', 'error'); setMultiLoading(false); return; }
    const variants = buildSmartStackMulti(recGoals, profile);
    setMultiResult(variants.map(v => ({
      variant: v.variant,
      stack: v.stack.substances.map(s => s.id),
      estCost: v.estCost,
      synergyScore: v.stack.totalScore,
      coverage: v.stack.coverageSummary,
      substanceCount: v.stack.substances.length,
    })));
    showToast('🧩 Собрано 3 варианта', 'success');
    setMultiLoading(false);
    }, 100);
  }, [goals, selTargets, profile]);

  const handleLoadIds = useCallback((ids: string[]) => {
    setStackIds(ids);
  }, [setStackIds]);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* ─── Card 1: Параметры сборки ─── */}
      <GlassCard title="🎯 Параметры сборки" icon="🎯" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 4, marginBottom: 6 }}>
          <PopupChips label="🎯 Цели"
            options={GOAL_GROUPS.map(g => ({ id: g.goal, label: g.label }))}
            selected={goals} onChange={ids => setGoals(ids as GoalType[])}
            groups={[...new Set(GOAL_GROUPS.map(g => g.key))].map(k => ({ key: k, label: k }))}
          />
          <PopupChips label="🫀 Органы"
            options={ORGANS.map(o => ({ id: o.key, label: o.label }))}
            selected={selOrgans} onChange={setSelOrgans}
          />
          <PopupChips label="⚙️ Системы"
            options={SYSTEMS.map(s => ({ id: s.key, label: s.label }))}
            selected={selSystems} onChange={setSelSystems}
          />
          <PopupChips label="🎯 Мишени"
            options={TARGET_SYSTEMS.map(t => ({ id: t.key, label: t.label }))}
            selected={selTargets} onChange={ids => setSelTargets(ids as GoalType[])}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>📏 Размер стека: <strong style={{ color: '#60a5fa', fontSize: 16 }}>{targetSize}</strong></span>
          <input type="range" min={1} max={40} value={targetSize} onChange={e => setTargetSize(+e.target.value)}
            style={{ flex: 1, height: 4, accentColor: '#60a5fa', cursor: 'pointer' }} />
          <div style={{ display: 'flex', gap: 3 }}>
            <button onClick={() => setTargetSize(Math.max(1, targetSize - 2))} style={{
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
            }}>−</button>
            <button onClick={() => setTargetSize(Math.min(40, targetSize + 2))} style={{
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
            }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ flex: 1, padding: '5px 10px', borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={avoidConflicts} onChange={e => setAvoidConflicts(e.target.checked)}
              style={{ accentColor: '#00e68a', width: 14, height: 14 }} />
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Авто-исключение конфликтов</span>
          </div>
          <div style={{ flex: 1, padding: '5px 10px', borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)', fontSize: 8, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
            🧩 <span>Размер: <strong style={{ color: '#00e68a' }}>{targetSize}</strong></span>
            <input type="range" min={1} max={40} value={targetSize} onChange={e => setTargetSize(+e.target.value)}
              style={{ flex: 1, height: 3, accentColor: '#00e68a', cursor: 'pointer' }} />
          </div>
        </div>
      </GlassCard>

      {/* ─── Card 2: Лабораторные маркеры ─── */}
      <GlassCard title={`🧪 Анализы${labAnalysis ? ' (авто-заполнено из лаборатории)' : ''}`} icon="🧪" color="#a78bfa">
        {labAnalysis && (
          <div style={{ fontSize: 7, color: '#22c55e', marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)' }}>
            🔗 Авто-синхронизация: {Object.values(lmState).filter(v => v === 'correct').length} маркеров предзаполнено
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 4, marginBottom: 4 }}>
          <PopupLabs label="Маркеры" markers={LAB_MARKER_MAP} lmState={lmState}
            onChange={(id, st) => setLmState(prev => ({ ...prev, [id]: st }))} />
          <button onClick={() => setLmState({})} style={{
            padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', color: '#ef4444',
          }}>🗑 Сбросить</button>
        </div>
      </GlassCard>

      {/* ─── Card 3: Готовые стеки и шаблоны ─── */}
      <GlassCard title={`📋 Готовые стеки и шаблоны (${filteredStacks.length})`} icon="📋" color="#8b5cf6">
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <input type="text" value={stkQuery} onChange={e => setStkQuery(e.target.value)}
            placeholder="🔍 Поиск по названию..." style={{
              flex: 1, padding: '6px 10px', borderRadius: 8,
              background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
              color: '#fff', fontSize: 9, outline: 'none',
            }} />
          <select value={stkFilter} onChange={e => setStkFilter(e.target.value)} style={{
            padding: '6px 10px', borderRadius: 8,
            background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.7)', fontSize: 9, outline: 'none', appearance: 'none',
          }}>
            <option value="all">🏠 Все</option>
            {SYSTEMS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filteredStacks.length === 0 ? (
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '12px 0' }}>
              Ничего не найдено
            </div>
          ) : filteredStacks.slice(0, 20).map(it => (
            <ExtStack key={it.id} item={it} type={it.type} onLoad={handleLoadIds} />
          ))}
          {filteredStacks.length > 20 && (
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 6 }}>
              +{filteredStacks.length - 20} ещё
            </div>
          )}
        </div>
      </GlassCard>

      {/* ─── Build buttons ─── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button onClick={handleBuild} disabled={buildLoading}
          style={{
          flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 11, fontWeight: 800,
          cursor: buildLoading ? 'wait' : 'pointer',
          background: buildLoading ? 'rgba(0,230,138,0.3)' : 'linear-gradient(135deg,#00e68a,#00c8a0)',
          border: 'none', color: buildLoading ? 'rgba(0,0,0,0.4)' : '#000',
          boxShadow: buildLoading ? 'none' : '0 2px 12px rgba(0,230,138,0.15)',
        }}>
          {buildLoading ? '⏳ Собираем...' : '🧩 Собрать стек'}
        </button>
        <button onClick={handleMultiBuild} disabled={multiLoading}
          style={{
          flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 11, fontWeight: 800,
          cursor: multiLoading ? 'wait' : 'pointer',
          background: multiLoading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
          border: 'none', color: multiLoading ? 'rgba(255,255,255,0.4)' : '#fff',
          boxShadow: multiLoading ? 'none' : '0 2px 12px rgba(139,92,246,0.15)',
        }}>
          {multiLoading ? '⏳ Генерируем...' : '🎲 3 варианта'}
        </button>
      </div>

      {(() => {
        if (!result) return null;
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

      {(() => {
        if (!gates) return null;
        const g = gates;
        const slots = g.schedule || [];
        const hasHard = g.hardStops.length > 0;
        const ulWarn = (g.ulWarnings || []).map(w => w.message).filter((w: string) => /верх|превыш|избыт/i.test(w));
        return (
          <div style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 6,
            background: hasHard ? 'rgba(239,68,68,0.07)' : 'rgba(0,230,138,0.05)',
            border: `1px solid ${hasHard ? 'rgba(239,68,68,0.14)' : 'rgba(0,230,138,0.1)'}` }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: hasHard ? '#ef4444' : '#00e68a', marginBottom: 4 }}>
              🩺 Клинический контроль (доказательность × безопасность)
            </div>
            {hasHard && (
              <div style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3, marginBottom: 4 }}>
                🛑 Блокировано по абсолютным противопоказаниям:
                {g.hardStops.map((h, i) => (
                  <div key={i}>• {h.substanceName}: {h.reason}</div>
                ))}
              </div>
            )}
            {ulWarn.length > 0 && (
              <div style={{ fontSize: 8, color: '#f59e0b', lineHeight: 1.3, marginBottom: 4 }}>
                ⚠ Превышение верхних безопасных доз (UL):
                {ulWarn.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            )}
            {g.labAdjustments.length > 0 && (
              <div style={{ fontSize: 8, color: '#60a5fa', lineHeight: 1.3, marginBottom: 4 }}>
                🧪 Коррекция по анализам:
                {g.labAdjustments.map((a, i) => (
                  <div key={i}>• {a.name}: {a.reason}</div>
                ))}
              </div>
            )}
            {g.redundancy.length > 0 && (
              <div style={{ fontSize: 8, color: '#f59e0b', lineHeight: 1.3, marginBottom: 4 }}>
                🔁 Избыточное дублирование путей:
                {g.redundancy.map((r, i) => (
                  <div key={i}>• {r.pathway}: {r.names.join(', ')} — {r.message}</div>
                ))}
              </div>
            )}
            {slots.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>🕐 Расписание приёма:</div>
                {slots.map((sl, i) => (
                  <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                    <b style={{ color: '#00e68a' }}>{sl.time === 'morning' ? 'Утро' : sl.time === 'afternoon' ? 'День' : sl.time === 'evening' ? 'Вечер' : 'Ночь'}:</b> {sl.names.join(', ')}
                  </div>
                ))}
              </div>
            )}
            {g.cycling.length > 0 && (
              <div style={{ fontSize: 8, color: '#8b5cf6', lineHeight: 1.3 }}>
                🔄 Циклирование:
                {g.cycling.map((c, i) => (
                  <div key={i}>• {c.name}: {c.cycleNote}</div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

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

      {/* ─── Multi-variant result ─── */}
      {multiResult && (
        <GlassCard title="🎲 3 варианта сборки" icon="🎲" color="#8b5cf6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {multiResult.map((vr, idx) => {
              const labels: Record<string, { label: string; icon: string; color: string; size: string }> = {
                economy: { label: 'Бюджетный', icon: '💰', color: '#22c55e', size: '5-7 веществ' },
                balanced: { label: 'Сбалансированный', icon: '⚖️', color: '#f59e0b', size: '8-12 веществ' },
                maximum: { label: 'Максимальный', icon: '💎', color: '#ef4444', size: '12-18 веществ' },
              };
              const l = labels[vr.variant] || { label: vr.variant, icon: '📦', color: '#60a5fa', size: '' };
              const costLevel = vr.estCost > 10000 ? 2 : vr.estCost > 5000 ? 1 : 0;
              const costLabel = ['🟢 Доступный', '💰 Средний', '💰💰 Дорогой'][costLevel];
              return (
                <div key={vr.variant} style={{
                  padding: '10px 12px', borderRadius: 12,
                  background: (l.color || '#60a5fa') + '08', border: '1px solid ' + (l.color || '#60a5fa') + '15',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{l.icon}</span>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: l.color }}>{l.label}</span>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>{l.size}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{vr.substanceCount} веществ</span>
                      <span style={{ fontSize: 8, fontWeight: 600, color: l.color }}>{vr.estCost.toLocaleString()} ₽</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>⭐ Синергия: <strong style={{ color: l.color }}>{vr.synergyScore}</strong></span>
                    <span>•</span>
                    <span>{vr.coverage}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 6, fontWeight: 600,
                      background: costLevel === 0 ? 'rgba(34,197,94,0.1)' : costLevel === 1 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                      color: [ '#22c55e', '#f59e0b', '#ef4444' ][costLevel],
                    }}>{costLabel}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button onClick={() => {
                      setStackIds(vr.stack);
                      const fp = toFinderProfile(profile);
                      const exp = explainStack(vr.stack, fp);
                      setResult({ stack: vr.stack, explanation: exp });
                      setMultiResult(null);
                      showToast(`✅ Загружен ${l.label.toLowerCase()} вариант`, 'success');
                    }} style={{
                      flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                      background: `${l.color}15`, border: `1px solid ${l.color}25`, color: l.color,
                    }}>📥 Этот вариант</button>
                    <button onClick={() => {
                      const txt = vr.stack.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id).join('\n');
                      navigator.clipboard.writeText(txt);
                    }} style={{
                      padding: '6px 10px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer',
                      background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                    }}>📋</button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* ─── Replacement panel ─── */}
      {result && (() => {
        const curStack = result.stack;
        /* single→stack: find complex substances that can be expanded */
        const s2sItems: { complexId: string; complexName: string; components: { id: string; name: string }[] }[] = [];
        for (const id of curStack) {
          const comps = SUPPLEMENT_COMPOSITION[id];
          if (comps && comps.length >= 2) {
            const valid = comps.filter(c => SUPPORT_CATALOG_DATA[c]);
            if (valid.length >= 2) {
              s2sItems.push({
                complexId: id,
                complexName: SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id,
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

        /* stack→single: find if multiple items can merge into one complex */
        const s2sMerges: { targetId: string; targetName: string; ids: string[] }[] = [];
        for (const [complexId, components] of Object.entries(SUPPLEMENT_COMPOSITION)) {
          const inStack = components.filter(c => curStack.includes(c));
          if (inStack.length >= 2 && SUPPORT_CATALOG_DATA[complexId]) {
            s2sMerges.push({
              targetId: complexId,
              targetName: SUPPORT_CATALOG_DATA[complexId]?.nameRu || SUPPORT_CATALOG_DATA[complexId]?.name || complexId,
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

            {/* Stack→Single: собрать в один */}
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

            {/* Algorithmic stack→single */}
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

            {/* Single→Stack: разложить на части */}
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

interface ExtStackItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  system: string;
  substances: string[];
  score?: number;
  type: 'template' | 'stack';
}
