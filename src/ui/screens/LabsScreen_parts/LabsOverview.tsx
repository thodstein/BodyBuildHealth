import React from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';

const LAB_RANGES: Record<string, { min: number; max: number; name: string; unit: string }> = {};
// Build from UCUM_MAP
Object.entries(UCUM_MAP).forEach(([code, info]) => {
  LAB_RANGES[code] = { min: info.lln, max: info.uln, name: info.name, unit: info.prefUnit };
});

function getLabStatus(lab: LabPoint): 'normal' | 'high' | 'low' | 'unknown' {
  if (lab.refLow !== undefined && lab.refHigh !== undefined) {
    if (lab.value > lab.refHigh) return 'high';
    if (lab.value < lab.refLow) return 'low';
    return 'normal';
  }
  const range = LAB_RANGES[lab.code] || LAB_RANGES[lab.code.toUpperCase()];
  if (!range) return 'unknown';
  if (lab.value > range.max) return 'high';
  if (lab.value < range.min) return 'low';
  return 'normal';
}

function getLabRefInfo(lab: LabPoint): string {
  if (lab.refLow !== undefined && lab.refHigh !== undefined) {
    return `${lab.refLow}–${lab.refHigh} ${lab.unit || ''}`;
  }
  const range = LAB_RANGES[lab.code] || LAB_RANGES[lab.code.toUpperCase()];
  if (!range) return '';
  return `${range.min}–${range.max} ${range.unit}`;
}

export const LabsOverview: React.FC<{
  labs: LabPoint[];
  hasLabs: boolean;
  forceNoLabs: boolean;
  setForceNoLabs: (v: boolean) => void;
}> = ({ labs, hasLabs, forceNoLabs, setForceNoLabs }) => {
  const normalCount = labs.filter(l => getLabStatus(l) === 'normal').length;
  const highCount = labs.filter(l => getLabStatus(l) === 'high').length;
  const lowCount = labs.filter(l => getLabStatus(l) === 'low').length;
  const abnormalCount = highCount + lowCount;

  // Group labs by system
  const systemGroups: Record<string, LabPoint[]> = {};
  const labSystemMap: Record<string, string> = {
    // Cardiovascular
    'LDL': 'cardio', 'HDL': 'cardio', 'TG': 'cardio', 'CHOL': 'cardio',
    'GLU': 'metabolic', 'HBA1C': 'metabolic', 'HbA1c': 'metabolic', 'HOMOCYSTEINE': 'cardio',
    // Hepatic
    'ALT': 'hepatic', 'AST': 'hepatic', 'GGT': 'hepatic', 'ALP': 'hepatic',
    'BILIRUBIN_TOTAL': 'hepatic', 'BIL_T': 'hepatic', 'BIL': 'hepatic', 'DBIL': 'hepatic', 'ALB': 'hepatic',
    // Renal
    'CREATININE': 'renal', 'BUN': 'renal', 'EGFR': 'renal', 'UREA': 'renal',
    'PROTEIN_TOTAL': '', 'TP': '', 'UA': 'renal',
    // Endocrine
    'TSH': 'endocrine', 'FT3': 'endocrine', 'FT4': 'endocrine',
    'TESTOSTERONE': 'endocrine', 'TT': 'endocrine', 'E2': 'endocrine', 'ESTRADIOL': 'endocrine',
    'PRL': 'endocrine', 'PROLACTIN': 'endocrine', 'CORTISOL': 'endocrine',
    'INSULIN': 'metabolic', 'INS': 'metabolic', 'HOMA': 'metabolic',
    'LH': 'endocrine', 'FSH': 'endocrine', 'SHBG': 'endocrine',
    // Hematologic
    'HGB': 'hematologic', 'HCT': 'hematologic', 'PLT': 'hematologic', 'WBC': 'hematologic',
    'RBC': 'hematologic', 'MCV': 'hematologic', 'MCH': 'hematologic', 'MCHC': 'hematologic',
    // Other
    'CRP': 'cardio', 'FERRITIN': 'hematologic', 'VITD': 'metabolic', 'CALCIDIOL': 'metabolic',
    'IGF1': 'endocrine', 'DHEA_S': 'endocrine', 'PSA': 'reproductive',
    'PROGESTERONE': 'reproductive', 'AMH': 'reproductive', 'INHB': 'reproductive',
    'K': 'metabolic', 'NA': 'metabolic', 'CA': 'metabolic', 'MG': 'metabolic', 'P': 'metabolic',
    'IRON': 'hematologic', 'TIBC': 'hematologic',
  };

  labs.forEach(lab => {
    const system = labSystemMap[lab.code.toUpperCase()] || '';
    if (!systemGroups[system]) systemGroups[system] = [];
    systemGroups[system].push(lab);
  });

  return (
    <div className="labs-overview">
      {!hasLabs && !forceNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>⚠️ Внимание!</strong> Нет данных анализов. Некоторые функции могут быть ограничены.
          Перейдите на вкладку «Результаты» для ввода данных.
        </div>
      )}

      {forceNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.2)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>🚫 Применен штраф за отсутствие анализов</strong>
        </div>
      )}

      {/* Stats Summary */}
      <div className="card">
        <h3>📋 Статистика анализов</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Всего</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{labs.length}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#22c55e' }}>✓ Норма</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{normalCount}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#ef4444' }}>↑ Выше нормы</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{highCount}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#f97316' }}>↓ Ниже нормы</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f97316' }}>{lowCount}</div>
          </div>
        </div>
        {abnormalCount > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: 12 }}>
            ⚠️ <strong>{abnormalCount}</strong> из {labs.length} показателей вне нормы ({highCount} ↑, {lowCount} ↓)
          </div>
        )}
      </div>

      {/* Lab Values by System */}
      {labs.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>🔬 Показатели по системам</h3>
          {Object.entries(systemGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([system, systemLabs]) => (
              <div key={system} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--accent)' }}>{system}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {systemLabs.sort((a, b) => {
                    const sa = getLabStatus(a);
                    const sb = getLabStatus(b);
                    const priority: Record<string, number> = { high: 0, low: 1, unknown: 2, normal: 3 };
                    return (priority[sa] ?? 2) - (priority[sb] ?? 2);
                  }).map(lab => {
                    const status = getLabStatus(lab);
                    const refInfo = getLabRefInfo(lab);
                    const statusColor = status === 'high' ? '#ef4444' : status === 'low' ? '#f97316' : '#22c55e';
                    const statusIcon = status === 'high' ? '↑' : status === 'low' ? '↓' : '✓';
                    return (
                      <div key={lab.code + '-' + lab.date} style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{lab.name || lab.code}</span>
                          {refInfo && <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 4 }}>({refInfo})</span>}
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, color: statusColor }}>{lab.value}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 2 }}>{lab.unit || ''}</span>
                          <span style={{ marginLeft: 4, color: statusColor }}>{statusIcon}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
