import React, { useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { loadBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUB_TABS, type BSTab } from './BioStackAIConstants';
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
  const [stackIds, setStackIds] = useState<string[]>([]);

  return (
    <div style={{ padding: '0 0 80px' }}>
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

      {tab === 'profile' && <ProfileTab profile={profile} setProfile={setProfile} />}
      {tab === 'search' && <SearchTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'build' && <BuildTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'stack' && <StackTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'risks' && <RisksTab profile={profile} stackIds={stackIds} />}
      {tab === 'compare' && <CompareTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'reports' && <ReportsTab profile={profile} stackIds={stackIds} />}
      {tab === 'ai' && <AITab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
    </div>
  );
};
