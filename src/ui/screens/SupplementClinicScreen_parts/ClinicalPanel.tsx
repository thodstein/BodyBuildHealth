// SupplementClinicScreen_parts/ClinicalPanel.tsx — клинический контроль (BioStack v2).
import React, { useMemo } from 'react';
import { selectStack } from '../../../engines/biostack-clinical-v2.engine';
import type { LabCompositeResult } from '../../../engines/lab-analysis.engine';
import { loadProfile, entryName, card, sectionTitle, btnGhost } from './shared';
import { ClinicalResultCard } from '../../components/BioStackAIClinicalCard';

const sevColor = (s: number) => (s >= 3 ? '#ef4444' : s === 2 ? '#f59e0b' : '#94a3b8');

export const ClinicalPanel: React.FC<{
  stackIds: string[];
  labAnalysis?: LabCompositeResult | null;
  onClearStops: () => void;
  onReplace?: (originalId: string, replacementId: string) => void;
}> = ({ stackIds, onClearStops, labAnalysis, onReplace }) => {
  const profile = useMemo(() => loadProfile(), []);
  const result = useMemo(() => {
    if (stackIds.length === 0) return null;
    try {
      return selectStack(stackIds, profile, 'comprehensive', (labAnalysis as any) || null);
    } catch (e) {
      return null;
    }
  }, [stackIds, labAnalysis, profile]);

  if (stackIds.length === 0 || !result) {
    return (
      <div style={card}>
        <div style={sectionTitle}>Клинический контроль</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Соберите стек — движок проверит абсолютные противопоказания, UL, лабораторные
          коррекции, избыточность путей и режим циклирования.
        </div>
      </div>
    );
  }

  const hasStop = result.hardStops.length > 0 || result.drugExclusions.length > 0;

  return (
    <div>
      <div style={{
        ...card,
        border: '1px solid ' + (hasStop ? 'rgba(239,68,68,0.4)' : 'rgba(0,230,138,0.3)'),
        background: hasStop ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            🩺 Клинический вердикт:{' '}
            <span style={{ color: hasStop ? '#ff8a9b' : 'var(--accent)' }}>
              {hasStop ? 'ЕСТЬ СТОП-ФАКТОРЫ' : 'ДОПУСТИМО К ПРИЁМУ'}
            </span>
          </div>
          {hasStop && (
            <button style={btnGhost} onClick={onClearStops}>Исключить стоп-позиции</button>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)' }}>
          Стратегия: comprehensive · веществ в анализе: {result.ids.length} / {stackIds.length}
        </div>
        {!result.labAdjustments.length && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#60a5fa' }}>
            💡 Лабораторные коррекции недоступны — заполните профиль BioStack и введите анализы для точной настройки доз.
          </div>
        )}
      </div>

      <ClinicalResultCard result={result} nameOf={entryName} profile={profile as any} onReplace={onReplace} />
    </div>
  );
};
