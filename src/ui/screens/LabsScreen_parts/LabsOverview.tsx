import React from 'react';
import type { LabPoint } from '../../../core/types';

const LAB_RANGES: Record<string, { min: number; max: number }> = {
  ALT: { min: 0, max: 40 },
  AST: { min: 0, max: 40 },
  CRP: { min: 0, max: 5 },
  HGB: { min: 130, max: 170 },
  TESTOSTERONE: { min: 10, max: 35 },
  ESTRADIOL: { min: 0, max: 200 },
  CORTISOL: { min: 100, max: 500 },
  TSH: { min: 0.4, max: 4.0 },
  GLUCOSE: { min: 3.3, max: 5.5 },
  HBA1C: { min: 4, max: 6 },
  LDL: { min: 0, max: 3.0 },
  HDL: { min: 1.0, max: 2.5 },
  TG: { min: 0, max: 1.7 },
  CREATININE: { min: 50, max: 120 },
  FERRITIN: { min: 20, max: 300 },
  PROLACTIN: { min: 2, max: 15 },
  HOMOCYSTEINE: { min: 5, max: 15 },
  INSULIN: { min: 2, max: 25 },
  EGFR: { min: 60, max: 150 },
  ALP: { min: 30, max: 120 },
  GGT: { min: 5, max: 60 },
  BILIRUBIN_TOTAL: { min: 3, max: 21 },
  PROTEIN_TOTAL: { min: 60, max: 85 },
  BUN: { min: 2.5, max: 7.5 },
  CALCIDIOL: { min: 30, max: 100 },
};

function getLabStatus(lab: LabPoint): 'normal' | 'high' | 'low' | 'unknown' {
  const range = LAB_RANGES[lab.code.toUpperCase()];
  if (!range) return 'unknown';
  if (lab.value > range.max) return 'high';
  if (lab.value < range.min) return 'low';
  return 'normal';
}

export const LabsOverview: React.FC<{
  labs: LabPoint[];
  hasLabs: boolean;
  forceNoLabs: boolean;
  setForceNoLabs: (v: boolean) => void;
}> = ({ labs, hasLabs, forceNoLabs, setForceNoLabs }) => {
  const normalCount = labs.filter(l => getLabStatus(l) === 'normal').length;
  const abnormalCount = labs.filter(l => { const s = getLabStatus(l); return s === 'high' || s === 'low'; }).length;
  const hasHigh = labs.some(l => getLabStatus(l) === 'high');

  return (
    <div className="labs-overview">
      {!hasLabs && !forceNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>⚠️ Внимание!</strong> Нет данных анализов. Некоторые функции могут быть ограничены.
        </div>
      )}
      
      {forceNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.2)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>🚫 Применен штраф за отсутствие анализов</strong>
        </div>
      )}

      <div className="card">
        <h3>Статистика анализов</h3>
        <div className="grid stats-grid">
          <div className="stat-item">
            <div className="stat-label">Всего анализов</div>
            <div className="stat-value">{labs.length}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Последний анализ</div>
            <div className="stat-value">{labs.length > 0 ? labs[labs.length - 1].date : 'нет'}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Норма</div>
            <div className="stat-value" style={{ color: '#22c55e' }}>
              {normalCount}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Отклонения</div>
            <div className="stat-value" style={{ color: hasHigh ? '#ef4444' : '#eab308' }}>
              {abnormalCount}
            </div>
          </div>
        </div>
      </div>

      {forceNoLabs && (
        <button onClick={() => setForceNoLabs(false)} style={{ width: '100%', padding: 8, background: 'var(--accent)', color: '#000', marginTop: 8 }}>
          ✅ Штраф снят
        </button>
      )}
    </div>
  );
};
