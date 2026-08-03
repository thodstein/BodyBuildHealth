import React, { useState, useEffect, useMemo } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { loadBioStackProfile, autoFillFromMainProfile, getProfileCompleteness } from '../../engines/biostack-ai.engine';
import { BIO_ANIM_CSS, initBioToast, SkeletonLoader, showToast } from './BioStackAIConstants';
import { useDataLink, type LinkedData } from '../../core/data-link';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import ProfileTab from './BioStackAIProfile';
import { BioStackAIUnifiedBuild } from './BioStackAIUnifiedBuild';
import { selectStack } from '../../engines/biostack-clinical-v2.engine';
import { ExportTab } from './BioStackAIExport';
import { RisksTab } from './BioStackAIRisks';
import { CompareTab } from './BioStackAICompare';
import { ReportsTab } from './BioStackAIReports';
import { readBioStackStacks, writeBioStackStacks, type StoredBioStack } from '../../engines/biostack-storage';

type MainTab = 'profile' | 'build' | 'analysis';
const TAB_KEY = 'he_biostack_tab';

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'profile', label: '👤 Профиль' },
  { id: 'build', label: '🔧 Сборка' },
  { id: 'analysis', label: '📊 Анализ' },
];

const ANALYSIS_TABS = [
  { id: 'reports', label: '📊 Отчёты' },
  { id: 'risks', label: '⚠ Риски' },
  { id: 'compare', label: '⚖ Сравнение' },
  { id: 'export', label: '📤 Экспорт' },
];

// Stack v2 format with metadata
type SavedStackV2 = StoredBioStack & { profileSnapshot: BioStackProfile | null };

const IDX_KEY = 'he_biostack_active_idx';
const LEGACY_ACTIVE_KEY = 'he_biostack_active';

function migrateStacks(): SavedStackV2[] {
  try {
    // Clean up legacy profile key (now loaded from unified profile settings)
    localStorage.removeItem('he_biostack_profile');
    // Check if v2 already exists
    const v2 = readBioStackStacks();
    if (v2.length) return v2 as SavedStackV2[];
    
    const migrated = readBioStackStacks();
    if (migrated.length) {
      const activeIdx = Number(localStorage.getItem(LEGACY_ACTIVE_KEY) || '0');
      const result = migrated.map((stack, index) => index === activeIdx ? { ...stack, name: stack.name || 'Текущий стек' } : stack) as SavedStackV2[];
      localStorage.removeItem(LEGACY_ACTIVE_KEY);
      return result;
    }
  } catch {}
  return [{ id: crypto.randomUUID(), name: 'Стек 1', ids: [], profileSnapshot: null, createdAt: new Date().toISOString(), version: 1, notes: '' }];
}

export const BioStackAIScreen: React.FC = () => {
  const [tab, setTab] = useState<MainTab>(() => {
    try { const s = localStorage.getItem(TAB_KEY); return MAIN_TABS.find(t => t.id === s) ? (s as MainTab) : 'profile'; }
    catch { return 'profile'; }
  });
  const [analysisSub, setAnalysisSub] = useState('reports');
  const [profile, setProfile] = useState<BioStackProfile>(() => {
    const saved = loadBioStackProfile();
    const sl = Object.keys(saved).filter(k => k !== 'autoFilledFields').length;
    if (sl <= 6) { const { patch, autoKeys } = autoFillFromMainProfile(); return { ...saved, ...patch, autoFilledFields: [...new Set([...(saved.autoFilledFields || []), ...autoKeys])] }; }
    return saved;
  });
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const linked = useDataLink();
  const labAnalysis: LabCompositeResult | null = linked?.labAnalysis || null;

  /* ── Multi-stack v2 ── */
  const [allStacks, setAllStacks] = useState<SavedStackV2[]>(() => migrateStacks());
  const [activeStackIdx, setActiveStackIdxRaw] = useState<number>(() => {
    try { return Math.min(+(localStorage.getItem(IDX_KEY) || '0'), allStacks.length - 1); } catch { return 0; }
  });
   const saveStacks = (stks: SavedStackV2[], idx: number) => {
     setAllStacks(stks);
      writeBioStackStacks(stks);
     localStorage.setItem(IDX_KEY, String(idx));
   };
  const setActiveStackIdx = (idx: number) => {
    const i = Math.max(0, Math.min(idx, allStacks.length - 1));
    setActiveStackIdxRaw(i);
    localStorage.setItem(IDX_KEY, String(i));
  };

  const stackIds = allStacks[activeStackIdx]?.ids || [];
  const setStackIds = (ids: string[]) => {
    const updated = allStacks.map((s, i) => i === activeStackIdx ? { ...s, ids } : s);
    saveStacks(updated, activeStackIdx);
  };

  /* ── Gate cache ── */
  useEffect(() => {
    if (stackIds.length === 0) return;
    try {
      const r = selectStack(stackIds, loadBioStackProfile(), 'comprehensive', null);
      localStorage.setItem('he_biostack_gate_cache', JSON.stringify(r));
    } catch {}
  }, [stackIds]);

  /* ── Hard-stop detection ── */
  const stopIds = useMemo(() => {
    if (stackIds.length === 0) return new Set<string>();
    try {
      const rawGate = localStorage.getItem('he_biostack_gate_cache');
      if (rawGate) {
        const cached = JSON.parse(rawGate);
        return new Set<string>([...(cached.hardStops||[]).map((h:any)=>h.substanceId), ...(cached.drugExclusions||[]).map((e:any)=>e.substanceId)]);
      }
    } catch {}
    return new Set<string>();
  }, [stackIds]);
  const clearStops = () => setStackIds(stackIds.filter(id => !stopIds.has(id)));
  const replaceStop = (originalId: string, replacementId: string) => {
    if (!replacementId) return;
    const oldLow = (originalId||'').toLowerCase();
    if (!oldLow) return;
    setStackIds(stackIds.map(id => id.toLowerCase() === oldLow ? replacementId : id));
  };

  useEffect(() => { initBioToast(); setLoading(false); }, []);
  useEffect(() => { localStorage.setItem(TAB_KEY, tab); }, [tab]);

  return (
    <div style={{ padding: '0 0 80px' }}>
      <style>{BIO_ANIM_CSS}</style>

      {/* ── Main tab bar ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flexShrink: 0, minHeight: 38, padding: '9px 13px', borderRadius: 12, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
            background: tab === t.id ? 'var(--accent)' : '#202023',
            color: tab === t.id ? '#000' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <SkeletonLoader count={4} /> : <div key={tab} className="bio-fade">
        {tab === 'profile' && (
          <ProfileTab profile={profile} setProfile={setProfile} setStackIds={setStackIds} />
        )}
        {tab === 'build' && (
          <BioStackAIUnifiedBuild
            profile={profile} labAnalysis={labAnalysis} linked={linked}
            stackIds={stackIds} setStackIds={setStackIds}
            allStacks={allStacks} activeStackIdx={activeStackIdx}
            saveStacks={saveStacks} setActiveStackIdx={setActiveStackIdx}
            stopIds={stopIds} clearStops={clearStops} replaceStop={replaceStop}
          />
        )}
        {tab === 'analysis' && (
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {ANALYSIS_TABS.map(a => (
                <button key={a.id} onClick={() => setAnalysisSub(a.id)} style={{
                  flexShrink: 0, minHeight: 32, padding: '6px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                  background: analysisSub === a.id ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                  color: analysisSub === a.id ? '#00e68a' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${analysisSub === a.id ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
                }}>{a.label}</button>
              ))}
            </div>
            {analysisSub === 'reports' && <ReportsTab profile={profile} stackIds={stackIds} linked={linked} />}
            {analysisSub === 'risks' && <RisksTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} linked={linked} activeAAS={[]} />}
            {analysisSub === 'compare' && <CompareTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} linked={linked} />}
            {analysisSub === 'export' && <ExportTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} linked={linked} />}
          </div>
        )}
      </div>}
    </div>
  );
};
