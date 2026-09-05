// SupplementClinicScreen.tsx — единый клинический инструмент:
// БАД + фарма + пептиды → взаимодействия, дозы, время приёма, клинический контроль.
// ОДИН стек (stackIds) — четыре анализа на нём. Роль: спортивный врач / фармаколог.
import React, { useState, useMemo } from 'react';
import { selectStack } from '../../engines/biostack-clinical-v2.engine';
import { loadBioStackProfile } from '../../engines/biostack-ai.engine';
import { StackPicker } from './SupplementClinicScreen_parts/StackPicker';
import { InteractionPanel } from './SupplementClinicScreen_parts/InteractionPanel';
import { DosePanel } from './SupplementClinicScreen_parts/DosePanel';
import { TimingPanel } from './SupplementClinicScreen_parts/TimingPanel';
import { ClinicalPanel } from './SupplementClinicScreen_parts/ClinicalPanel';
import { card, chip, btnPrimary } from './SupplementClinicScreen_parts/shared';

type ClinicTab = 'interactions' | 'dose' | 'timing' | 'clinical';
const TABS: { id: ClinicTab; label: string }[] = [
  { id: 'interactions', label: '⚗ Взаимодействия' },
  { id: 'dose', label: '💊 Дозировка' },
  { id: 'timing', label: '⏰ Время приёма' },
  { id: 'clinical', label: '🩺 Клинический контроль' },
];

export const SupplementClinicScreen: React.FC = () => {
  const [stackIds, setStackIds] = useState<string[]>([]);
  const [tab, setTab] = useState<ClinicTab>('interactions');

  const stopIds = useMemo(() => {
    if (stackIds.length === 0) return new Set<string>();
    try {
      const r = selectStack(stackIds, loadBioStackProfile(), 'comprehensive', null);
      const ids = [
        ...r.hardStops.map((h: any) => h.substanceId),
        ...r.drugExclusions.map((e: any) => e.substanceId),
      ];
      return new Set(ids);
    } catch {
      return new Set<string>();
    }
  }, [stackIds]);

  const clearStops = () => setStackIds(stackIds.filter((id) => !stopIds.has(id)));

  return (
    <div className="sup-clinic" style={{ padding: '54px 12px 24px', minHeight: '100%' }}>
      <div style={{ padding: '0 4px 14px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>🧪 Клиника БАД и фармы</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>
          Единый инструмент спортивного врача: соберите стек и получите взаимодействия,
          дозировку, время приёма и клинический вердикт — на одних данных.
        </div>
      </div>

      <StackPicker stackIds={stackIds} onChange={setStackIds} />

      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 4px',
        position: 'sticky', top: 48, zIndex: 5, background: 'var(--bg)', padding: '6px 0',
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const badge =
            t.id === 'clinical' && stopIds.size > 0
              ? { bg: '#ef4444', n: stopIds.size }
              : null;
          return (
            <button key={t.id} style={chip(active)} onClick={() => setTab(t.id)}>
              {t.label}
              {badge && (
                <span style={{
                  background: badge.bg, color: '#fff', borderRadius: 8, fontSize: 11,
                  padding: '1px 6px', fontWeight: 800,
                }}>{badge.n}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'interactions' && <InteractionPanel stackIds={stackIds} />}
      {tab === 'dose' && <DosePanel stackIds={stackIds} />}
      {tab === 'timing' && <TimingPanel stackIds={stackIds} />}
      {tab === 'clinical' && <ClinicalPanel stackIds={stackIds} onClearStops={clearStops} />}

      {stackIds.length > 0 && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Стек собран: {stackIds.length} веществ</span>
          <button style={btnPrimary} onClick={() => setStackIds([])}>Очистить стек</button>
        </div>
      )}
    </div>
  );
};
