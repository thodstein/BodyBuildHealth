import React, { useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { loadBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUB_TABS, BIO_ANIM_CSS, type BSTab } from './BioStackAIConstants';
import { ProfileTab } from './BioStackAIProfile';
import { SearchTab } from './BioStackAISearch';
import { BuildTab } from './BioStackAIBuild';
import { StackTab } from './BioStackAIStack';
import { RisksTab } from './BioStackAIRisks';
import { CompareTab } from './BioStackAICompare';
import { ReportsTab } from './BioStackAIReports';
import { AITab } from './BioStackAIAI';

export const BioStackAIScreen: React.FC = () => {
  const [tab, setTab] = useState<BSTab>('profile');
  const [profile, setProfile] = useState<BioStackProfile>(() => loadBioStackProfile());
  const [stackIds, setStackIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('he_biostack_active');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // auto-save active stack for other screens to read
  const setStackIdsAndSync = (ids: string[]) => {
    setStackIds(ids);
    localStorage.setItem('he_biostack_active', JSON.stringify(ids));
  };

  const tabContent: Record<BSTab, React.ReactNode> = {
    profile: <ProfileTab profile={profile} setProfile={setProfile} setStackIds={setStackIdsAndSync} />,
    search: <SearchTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} />,
    build: <BuildTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} />,
    stack: <StackTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} />,
    risks: <RisksTab profile={profile} stackIds={stackIds} />,
    compare: <CompareTab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} />,
    reports: <ReportsTab profile={profile} stackIds={stackIds} />,
    ai: <AITab profile={profile} stackIds={stackIds} setStackIds={setStackIdsAndSync} />,
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

      <div key={tab} className="bio-fade">{tabContent[tab]}</div>
    </div>
  );
};
