import React, { useState, useEffect, useMemo } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { loadBioStackProfile, autoFillFromMainProfile, getProfileCompleteness } from '../../engines/biostack-ai.engine';
import { SUB_TABS, SUB_TAB_GROUPS, DEFAULT_SUB, BIO_ANIM_CSS, type BSTab, initBioToast, SkeletonLoader, showToast } from './BioStackAIConstants';
import { useDataLink, type LinkedData } from '../../core/data-link';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
  import ProfileTab from './BioStackAIProfile';
  import { SearchTab } from './BioStackAISearch';
  import { BuildTab } from './BioStackAIBuild';
  import { ComplexTab } from './BioStackAIComplexes';
  import BioStackAIAnalog from './BioStackAIAnalog';
  import { StackTab } from './BioStackAIStack';
  import { RisksTab } from './BioStackAIRisks';
  import { CompareTab } from './BioStackAICompare';
  import { ReportsTab } from './BioStackAIReports';
  import { selectStack } from '../../engines/biostack-clinical-v2.engine';
  import { StackPicker } from '../screens/SupplementClinicScreen_parts/StackPicker';
  import { InteractionPanel } from '../screens/SupplementClinicScreen_parts/InteractionPanel';
  import { DosePanel } from '../screens/SupplementClinicScreen_parts/DosePanel';
  import { TimingPanel } from '../screens/SupplementClinicScreen_parts/TimingPanel';
  import { ClinicalPanel } from '../screens/SupplementClinicScreen_parts/ClinicalPanel';
  import { DrugCheckTab } from './BioStackAIDrugCheck';
  import { ExportTab } from './BioStackAIExport';
  
const BIO_TAB_KEY = 'he_biostack_tab';
const BIO_SUBTAB_KEY = 'he_biostack_subtab';

export const BioStackAIScreen: React.FC = () => {
  const [tab, setTab] = useState<BSTab>(() => {
    try { const saved = localStorage.getItem(BIO_TAB_KEY); return saved && SUB_TABS.find(t => t.id === saved) ? (saved as BSTab) : 'profile'; } catch { return 'profile'; }
  });
  const [subTab, setSubTab] = useState<string>(() => {
    try { return localStorage.getItem(BIO_SUBTAB_KEY) || ''; } catch { return ''; }
  });
  const [profile, setProfile] = useState<BioStackProfile>(() => {
    const saved = loadBioStackProfile();
    const savedLen = Object.keys(saved).filter(k => k !== 'autoFilledFields').length;
    if (savedLen <= 6) {
      const { patch, autoKeys } = autoFillFromMainProfile();
      return { ...saved, ...patch, autoFilledFields: [...new Set([...(saved.autoFilledFields || []), ...autoKeys])] };
    }
    return saved;
  });
  const [loading, setLoading] = useState(true);
  const linked = useDataLink();
  const labAnalysis: LabCompositeResult | null = linked?.labAnalysis || null;
  const activeAAS = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_course_data');
      if (!raw) return [] as string[];
      const course = JSON.parse(raw);
      return (course.aas || []).filter((a: any) => a.active !== false).map((a: any) => a.id?.toLowerCase?.() || a.id || '').filter(Boolean);
    } catch { return [] as string[]; }
  }, []);
  /* ── Multi-stack ── */
  const STACKS_KEY = 'he_biostack_stacks';
  const IDX_KEY = 'he_biostack_active_idx';
  const [allStacks, setAllStacks] = useState<string[][]>(() => {
    try {
      const raw = localStorage.getItem(STACKS_KEY);
      if (raw) return JSON.parse(raw);
      const old = localStorage.getItem('he_biostack_active');
      if (old) { const p = JSON.parse(old); return Array.isArray(p[0]) ? p : [p]; }
    } catch {}
    return [[]];
  });
  const [activeStackIdx, setActiveStackIdxRaw] = useState<number>(() => {
    try { return Math.min(+(localStorage.getItem(IDX_KEY) || '0'), allStacks.length - 1); } catch { return 0; }
  });
  const saveStacks = (stks: string[][], idx: number) => {
    setAllStacks(stks);
    localStorage.setItem(STACKS_KEY, JSON.stringify(stks));
    localStorage.setItem(IDX_KEY, String(idx));
    localStorage.setItem('he_biostack_active', JSON.stringify(stks[idx] || []));
  };
  const setActiveStackIdx = (idx: number) => {
    const i = Math.max(0, Math.min(idx, allStacks.length - 1));
    setActiveStackIdxRaw(i);
    localStorage.setItem(IDX_KEY, String(i));
    localStorage.setItem('he_biostack_active', JSON.stringify(allStacks[i] || []));
  };
  const stackIds = allStacks[activeStackIdx] || [];
  const setStackIds = (ids: string[]) => {
    const updated = allStacks.map((s, i) => i === activeStackIdx ? ids : s);
    saveStacks(updated, activeStackIdx);
  };
  const setStackIdsAndSync = (ids: string[]) => setStackIds(ids);

  /* ── Clinic: hard-stop detection for clinical panel ── */
  const stopIds = useMemo(() => {
    if (stackIds.length === 0) return new Set<string>();
    try {
      // Пробуем кэшированный gate из результата сборки (быстрее, не вызывает selectStack повторно)
      const rawGate = localStorage.getItem('he_biostack_gate_cache');
      if (rawGate) {
        const cached = JSON.parse(rawGate);
        const cachedIds = new Set(cached.ids?.map((s: string) => s.toLowerCase()) || []);
        const currentIds = new Set(stackIds.map(s => s.toLowerCase()));
        if (cachedIds.size > 0 && [...currentIds].every(id => cachedIds.has(id))) {
          return new Set<string>([
            ...(cached.hardStops || []).map((h: any) => h.substanceId),
            ...(cached.drugExclusions || []).map((e: any) => e.substanceId),
          ]);
        }
      }
      // Fallback: полный вызов selectStack
      const r = selectStack(stackIds, loadBioStackProfile(), 'comprehensive', null);
      return new Set<string>([
        ...r.hardStops.map((h: any) => h.substanceId),
        ...r.drugExclusions.map((e: any) => e.substanceId),
      ]);
    } catch {
      return new Set<string>();
    }
  }, [stackIds]);
  const clearStops = () => setStackIds(stackIds.filter((id) => !stopIds.has(id)));
  const replaceStop = (originalId: string, replacementId: string) => {
    if (!replacementId) return;
    const oldLow = (originalId || '').toLowerCase();
    if (!oldLow) return;
    const next = stackIds.map((id) => (id.toLowerCase() === oldLow ? replacementId : id));
    setStackIds([...new Set(next)]);
    showToast(`🔄 Заменено на аналог`, 'info');
  };

  useEffect(() => { initBioToast(); setLoading(false); }, []);

  useEffect(() => {
    localStorage.setItem(BIO_TAB_KEY, tab);
    const def = DEFAULT_SUB[tab] || '';
    if (!subTab || !(SUB_TAB_GROUPS[tab] || []).find(s => s.id === subTab)) {
      setSubTab(def);
    }
  }, [tab]);

  useEffect(() => { localStorage.setItem(BIO_SUBTAB_KEY, subTab); }, [subTab]);

  useEffect(() => {
    if (stackIds.length > 0 && !loading) {
      showToast(`🔵 Активный стек: ${stackIds.length} веществ`, 'info');
    }
  }, [loading]);

  const activeSub = subTab && (SUB_TAB_GROUPS[tab] || []).find(s => s.id === subTab) ? subTab : (DEFAULT_SUB[tab] || '');

  const renderSubContent = (): React.ReactNode => {
    switch (tab) {
      case 'profile':
        return <ProfileTab profile={profile} setProfile={setProfile} setStackIds={setStackIdsAndSync} />;

      case 'select':
        if (activeSub === 'build') return <BuildTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} labAnalysis={labAnalysis} linked={linked} />;
        if (activeSub === 'complexes') return <ComplexTab stackIds={stackIds} setStackIds={setStackIdsAndSync} />;
        if (activeSub === 'analog') return <BioStackAIAnalog profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} onToast={(m) => showToast(m, 'info')} />;
        return <SearchTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} linked={linked} />;

      case 'stack':
        if (activeSub === 'interactions') return (<div><StackPicker stackIds={stackIds} onChange={setStackIdsAndSync} /><InteractionPanel stackIds={stackIds} /></div>);
        if (activeSub === 'dose') return (<div><StackPicker stackIds={stackIds} onChange={setStackIdsAndSync} /><DosePanel stackIds={stackIds} /></div>);
        if (activeSub === 'timing') return (<div><StackPicker stackIds={stackIds} onChange={setStackIdsAndSync} /><TimingPanel stackIds={stackIds} /></div>);
        if (activeSub === 'drugcheck') return <DrugCheckTab profile={profile} stackIds={stackIds} />;
        if (activeSub === 'clinical') return (<div><StackPicker stackIds={stackIds} onChange={setStackIdsAndSync} /><ClinicalPanel stackIds={stackIds} labAnalysis={labAnalysis} onClearStops={clearStops} onReplace={replaceStop} /></div>);
        return (
          <StackTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync}
            allStacks={allStacks} activeStackIdx={activeStackIdx}
            setActiveStackIdx={setActiveStackIdx}
            createStack={() => { const n = [...allStacks, []]; saveStacks(n, n.length - 1); }}
            deleteStack={(i: number) => {
              const n = allStacks.filter((_, j) => j !== i);
              if (n.length === 0) n.push([]);
              saveStacks(n, Math.min(activeStackIdx, n.length - 1));
            }}
            renameStack={(i: number, name: string) => { localStorage.setItem(`he_biostack_name_${i}`, name); }}
            linked={linked}
          />
        );

      case 'reports':
        if (activeSub === 'risks') return <RisksTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} linked={linked} activeAAS={activeAAS} />;
        if (activeSub === 'compare') return <CompareTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} linked={linked} />;
        if (activeSub === 'export') return <ExportTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} linked={linked} />;
        return <ReportsTab profile={profile} stackIds={stackIds} linked={linked} />;

      default:
        return null;
    }
  };

  const subTabs = SUB_TAB_GROUPS[tab];

  return (
    <div style={{ padding: '0 0 80px' }}>
      <style>{BIO_ANIM_CSS}</style>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginBottom: 4 }}>
        🧬 BioStack AI — подбор, синергия и клинический контроль БАДов и фармы
      </div>

      {/* ── Profile completeness banner ── */}
      {(() => {
        const comp = getProfileCompleteness(profile);
        if (comp.percent >= 70) return null;
        const missingGroups = Object.entries(comp.groupStatus)
          .filter(([, st]) => !st.filled)
          .map(([k]) => ({ personal: 'личные данные', health: 'здоровье', goals: 'цели', organs: 'органы', systems: 'системы', lifestyle: 'образ жизни', clinical: 'клинические данные' }[k] || k));
        return (
          <div onClick={() => setTab('profile')} style={{
            marginBottom: 6, padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
            background: comp.percent < 30 ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.08)',
            border: `1px solid ${comp.percent < 30 ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.15)'}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 11 }}>⚠️</span>
            <span style={{ fontSize: 9, color: comp.percent < 30 ? '#f87171' : '#fbbf24', fontWeight: 600 }}>
              Профиль заполнен на {comp.percent}%. {missingGroups.slice(0, 2).join(', ')} — нажмите чтобы заполнить
            </span>
          </div>
        );
      })()}

      {/* ── Main tab bar ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flexShrink: 0, minHeight: 38, padding: '9px 13px', borderRadius: 12, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
            background: tab === t.id ? 'var(--accent)' : '#202023',
            color: tab === t.id ? '#000' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)'}`,
            boxShadow: tab === t.id ? '0 0 8px rgba(0,230,138,0.15)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Sub tab bar (if merged tab has sub-pills) ── */}
      {subTabs && subTabs.length > 1 && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {subTabs.map(s => (
            <button key={s.id} onClick={() => setSubTab(s.id)} style={{
              flexShrink: 0, minHeight: 32, padding: '6px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
              background: activeSub === s.id ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)',
              color: activeSub === s.id ? '#00e68a' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${activeSub === s.id ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.04)'}`,
            }}>{s.label}</button>
          ))}
        </div>
      )}

      {loading ? <SkeletonLoader count={4} /> : <div key={tab + activeSub} className="bio-fade">{renderSubContent()}</div>}
    </div>
  );
};
