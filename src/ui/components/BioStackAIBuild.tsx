import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile, type GoalType } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack, type StackExplanation, findReplacement, findSingleReplacementForStack, type ReplacementResult } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS, ALL_STACKS, type SupportStack, getStackSubstanceLabel, MECHANISM_LABELS } from '../../data/support-database';
import { ORGAN_LABELS, SYSTEM_LABELS_CATALOG } from '../../data/support-database';
import { LAB_MARKER_MAP, type LabMarkerMap } from '../../data/lab-marker-map';
import { STACK_TEMPLATES, type BioStackTemplate } from '../../engines/biostack-templates';
import { SUPPLEMENT_COMPOSITION, COMPONENT_TO_COMPLEX } from '../../data/support-meta';
import { GlassCard, PillBtn, StatBox, ORGANS, SYSTEMS, PURE_GOALS, TARGET_SYSTEMS, toFinderProfile } from './BioStackAIConstants';

type LMState = Record<string, 'off' | 'maintain' | 'correct'>;

const PRICE_RUB: Record<string, number> = {
  nac: 650, milk_thistle: 400, tudca: 900, omega3: 800, coq10: 1200, magnesium: 350,
  zinc: 200, vitamin_d3: 300, vitamin_c: 250, vitamin_e: 350, selenium: 200,
  berberine: 600, curcumin: 500, alpha_lipoic: 700, collagen: 1200, glucosamine: 800,
  msm: 500, chondroitin: 900, ashwagandha: 600, rhodiola: 550, theanine: 450,
  glycine: 300, creatine: 400, l_carnitine: 700, taurine: 350, inositol: 500,
  probiotics: 1200, glutamine: 500, astragalus: 600, borax: 200, potassium: 250,
  calcium: 300, citicoline: 1200, alpha_gpc: 900, huperzine_a: 400, noopept: 800,
  piracetam: 500, lions_mane: 900, phosphatidylserine: 900, magnesium_l_threonate: 1200,
  serrapeptase: 900, nattokinase: 800, bromelain: 500, vitamin_a: 200,
  zinc_carnosine: 800, l_glutamine: 600,
};

function estCost(id: string): number {
  if (PRICE_RUB[id]) return PRICE_RUB[id];
  const c = SUPPORT_CATALOG_DATA[id];
  if (!c) return 500;
  const tm: Record<string, number> = { core: 800, standard: 500, advanced: 300, specialty: 1200 };
  return tm[c.tier as string] || 500;
}

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
export function BuildTab({ profile, stackIds, setStackIds }: {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
}) {
  const [goals, setGoals] = useState<GoalType[]>(profile.goals);
  const [selOrgans, setSelOrgans] = useState<string[]>(profile.targetOrgans || []);
  const [selSystems, setSelSystems] = useState<string[]>(profile.targetSystems || []);
  const [selTargets, setSelTargets] = useState<GoalType[]>([]);
  const [targetSize, setTargetSize] = useState(() => profile.stackComplexity === 'minimal' ? 5 : profile.stackComplexity === 'balanced' ? 10 : 18);
  const [lmState, setLmState] = useState<LMState>({});
  const [result, setResult] = useState<{ stack: string[]; explanation: StackExplanation } | null>(null);
  const [avoidConflicts, setAvoidConflicts] = useState(true);
  const [stkQuery, setStkQuery] = useState('');
  const [stkFilter, setStkFilter] = useState('all');
  const [replaceOpen, setReplaceOpen] = useState(true);

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
    const exp = explainStack(built.stack, fp);
    setResult({ stack: built.stack, explanation: exp });
  }, [goals, selTargets, selOrgans, selSystems, targetSize, lmState, stackIds, profile, avoidConflicts]);

  const handleSaveStack = useCallback(() => {
    if (!result) return;
    const existing: string[][] = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    const updated = [result.stack, ...existing].slice(0, 10);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
  }, [result]);

  const handleLoadIds = useCallback((ids: string[]) => {
    setStackIds(ids);
  }, [setStackIds]);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* ─── Card 1: Параметры сборки ─── */}
      <GlassCard title="🎯 Параметры сборки" icon="🎯" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 6 }}>
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
          <button onClick={() => setTargetSize(Math.max(1, targetSize - 2))} style={{
            padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa',
          }}>📏 − {targetSize}</button>
          <button onClick={() => setTargetSize(Math.min(40, targetSize + 2))} style={{
            padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa',
          }}>📏 + {targetSize}</button>
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
      <GlassCard title="🧪 Анализы" icon="🧪" color="#a78bfa">
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

      {/* ─── Build button ─── */}
      <button onClick={handleBuild} style={{
        width: '100%', padding: '16px 0', borderRadius: 14, fontSize: 14, fontWeight: 800,
        cursor: 'pointer', marginBottom: 10,
        background: 'linear-gradient(135deg,#00e68a,#00c8a0)', border: 'none', color: '#000',
        boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
      }}>
        🧩 Собрать стек
      </button>

      {/* ─── Result ─── */}
      {result && (
        <GlassCard title="📋 Результат сборки" icon="📋" color="#00e68a">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
            <StatBox label="Синергия" value={result.explanation.totalSynergyScore} color="#8b5cf6" />
            <StatBox label="Покрытие" value={`${result.explanation.completeness}%`} color="#8b5cf6" />
            <StatBox label="Компонентов" value={result.stack.length} color="#00e68a" />
            <StatBox label="С дозировкой" value={`${result.explanation.totalDoseCount}/${result.stack.length}`} color="#60a5fa" />
          </div>
          {(() => {
            const totalCost = result.stack.reduce((s, id) => s + estCost(id), 0);
            const priceScore = totalCost > 10000 ? 20 : totalCost > 5000 ? 50 : totalCost > 2000 ? 75 : 90;
            const priceLabel = totalCost > 10000 ? '💰💰💰' : totalCost > 5000 ? '💰💰' : totalCost > 2000 ? '💰' : '🟢';
            return <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>💰 Ориентир. стоимость/мес</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#00e68a' }}>{totalCost.toLocaleString()} ₽ {priceLabel}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: priceScore + '%', height: '100%', borderRadius: 2,
                  background: priceScore >= 70 ? '#22c55e' : priceScore >= 40 ? '#f59e0b' : '#ef4444' }} />
              </div>
            </div>;
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
            {result.explanation.substances.map(s => (
              <div key={s.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{s.name}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>~{estCost(s.id).toLocaleString()} ₽</span>
                    <span style={{ fontSize: 8, color: '#00e68a' }}>{s.role}</span>
                  </div>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>🧬 {s.mechanism}</div>
                {s.dose && <div style={{ fontSize: 8, color: '#60a5fa' }}>💊 {s.dose}</div>}
              </div>
            ))}
          </div>
          {result.explanation.warnings.length > 0 && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠ Предупреждения:</div>
              {result.explanation.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>• {w}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => { setStackIds(result.stack); handleSaveStack(); }} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
            }}>💾 Сохранить стек</button>
            <button onClick={() => {
              const txt = result.explanation.substances.map(s => `${s.name} — ${s.dose || s.role}`).join('\n');
              navigator.clipboard.writeText(txt);
            }} style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            }}>📋</button>
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
                      padding: '4px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
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
