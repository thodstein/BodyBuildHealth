import React, { useState, useCallback } from 'react';
import { ACCENT, DIM, BORDER, LabMode } from './ExerciseLabShared';
import PrescriptionTab from './ExerciseLabPrescription';
import TechniqueTab from './ExerciseLabTechnique';
import CompareTab from './ExerciseLabCompare';
import ProAnalysisTab from './ExerciseLabPro';
import ExerciseLabCatalog from './ExerciseLabCatalog';

const MODE_DEFS: Array<{ m: LabMode; label: string; icon: string }> = [
  { m: 'prescription', label: 'Подбор', icon: '📐' },
  { m: 'technique', label: 'Техника', icon: '🔬' },
  { m: 'compare', label: 'Сравнение', icon: '⚖️' },
  { m: 'pro', label: 'ПРО-анализ', icon: '🔮' },
  { m: 'catalog', label: 'Каталог', icon: '📋' },
];

const ExerciseLab: React.FC = () => {
  const [mode, setMode] = useState<LabMode>('prescription');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const handleSelectForCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🧬 Лаборатория упражнений</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>
        Подбор нагрузки, анализ техники, сравнение, ПРО-анализ, замена упражнений и каталог — всё в одном инструменте.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon }) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: mode === m ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
              background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
              color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {icon} {label}
            {m === 'compare' && compareIds.length > 0 && (
              <span style={{ background: ACCENT, color: '#000', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 800 }}>{compareIds.length}</span>
            )}
          </button>
        ))}
      </div>

      {mode === 'prescription' && <PrescriptionTab />}
      {mode === 'technique' && <TechniqueTab onSelectForCompare={handleSelectForCompare} />}
      {mode === 'compare' && <CompareTab initialId1={compareIds[0] || ''} initialId2={compareIds[1] || ''} />}
      {mode === 'pro' && <ProAnalysisTab />}
      {mode === 'catalog' && <ExerciseLabCatalog />}
    </div>
  );
};

export default ExerciseLab;
