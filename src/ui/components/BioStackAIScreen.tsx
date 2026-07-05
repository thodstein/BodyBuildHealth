import React, { useState, useEffect, useMemo } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { loadBioStackProfile, autoFillFromMainProfile } from '../../engines/biostack-ai.engine';
import { SUB_TABS, BIO_ANIM_CSS, type BSTab, initBioToast, SkeletonLoader, showToast } from './BioStackAIConstants';
import { useDataLink, type LinkedData } from '../../core/data-link';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import { ProfileTab } from './BioStackAIProfile';
import { SearchTab } from './BioStackAISearch';
import { BuildTab } from './BioStackAIBuild';
import { StackTab } from './BioStackAIStack';
import { RisksTab } from './BioStackAIRisks';
import { CompareTab } from './BioStackAICompare';
import { ReportsTab } from './BioStackAIReports';
import { PeriodizationTab } from './BioStackAIPeriodization';
import { InteractionsTab } from './BioStackAIInteractions';
import { ClinicalTab } from './BioStackAIClinical';
import { DrugCheckTab } from './BioStackAIDrugCheck';

const BIO_TAB_KEY = 'he_biostack_tab';

export const BioStackAIScreen: React.FC = () => {
  const [tab, setTab] = useState<BSTab>(() => {
    try { const saved = localStorage.getItem(BIO_TAB_KEY); return saved && SUB_TABS.find(t => t.id === saved) ? (saved as BSTab) : 'profile'; } catch { return 'profile'; }
  });
  const [profile, setProfile] = useState<BioStackProfile>(() => {
    const saved = loadBioStackProfile();
    if (Object.keys(saved).length <= 5) {
      const filled = autoFillFromMainProfile();
      return { ...saved, ...filled };
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

  useEffect(() => { initBioToast(); setLoading(false); }, []);

  useEffect(() => { localStorage.setItem(BIO_TAB_KEY, tab); }, [tab]);

  useEffect(() => {
    if (stackIds.length > 0 && !loading) {
      showToast(`🔵 Активный стек: ${stackIds.length} веществ`, 'info');
    }
  }, [loading]);

  const tabContent: Record<BSTab, React.ReactNode> = {
    profile: <ProfileTab profile={profile} setProfile={setProfile} setStackIds={setStackIdsAndSync} />,
    search: <SearchTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} linked={linked} />,
    build: <BuildTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} labAnalysis={labAnalysis} linked={linked} />,
    stack: <StackTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync}
      allStacks={allStacks} activeStackIdx={activeStackIdx}
      setActiveStackIdx={setActiveStackIdx}
      createStack={() => {
        const n = [...allStacks, []];
        saveStacks(n, n.length - 1);
      }}
      deleteStack={(i: number) => {
        const n = allStacks.filter((_, j) => j !== i);
        if (n.length === 0) n.push([]);
        saveStacks(n, Math.min(activeStackIdx, n.length - 1));
      }}
      renameStack={(i: number, name: string) => {
        const keys = `he_biostack_name_${i}`;
        localStorage.setItem(keys, name);
      }}
      linked={linked}
    />,
    risks: <RisksTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} linked={linked} activeAAS={activeAAS} />,
    compare: <CompareTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} linked={linked} />,
    reports: <ReportsTab profile={profile} stackIds={stackIds} linked={linked} />,
    periodization: <PeriodizationTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} />,
    interactions: <InteractionsTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} />,
    clinical: <ClinicalTab profile={profile} setProfile={setProfile} stackIds={stackIds} linked={linked} />,
    drugcheck: <DrugCheckTab profile={profile} stackIds={stackIds} />,
  };

  return (
    <div style={{ padding: '0 0 80px' }}>
      <style>{BIO_ANIM_CSS}</style>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginBottom: 6 }}>
        🧬 BioStack AI — Операционная система управления БАДами
      </div>

      {/* ── Sub tab bar ── */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: 16, fontSize: 9, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
            background: tab === t.id ? 'var(--accent)' : '#202023',
            color: tab === t.id ? '#000' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)'}`,
            boxShadow: tab === t.id ? '0 0 12px rgba(0,230,138,0.2)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <SkeletonLoader count={4} /> : <div key={tab} className="bio-fade">{tabContent[tab]}</div>}
    </div>
  );
};
