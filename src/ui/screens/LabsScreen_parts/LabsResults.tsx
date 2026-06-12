import React, { useState } from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';

const LAB_SYSTEM_MAP: Record<string, string> = {
  'ALT': '', 'AST': '', 'GGT': '', 'ALP': '',
  'BILIRUBIN_TOTAL': '', 'BIL_T': '', 'BIL': '', 'ALB': '',
  'CREATININE': '', 'BUN': '', 'EGFR': '', 'PROTEIN_TOTAL': '', 'UA': '',
  'TSH': '', 'FT3': '', 'FT4': '',
  'TESTOSTERONE': '', 'TT': '', 'E2': '', 'ESTRADIOL': '',
  'PRL': '', 'PROLACTIN': '', 'CORTISOL': '',
  'INSULIN': '', 'INS': '', 'HOMA': '',
  'LH': '', 'FSH': '', 'SHBG': '', 'IGF1': '',
  'HGB': '', 'HCT': '', 'PLT': '', 'WBC': '',
  'LDL': '', 'HDL': '', 'TG': '', 'GLU': '', 'GLUCOSE': '',
  'HBA1C': '', 'HOMOCYSTEINE': '', 'FERRITIN': '',
  'CRP': '', 'VITD': '', 'CALCIDIOL': '',
};

function getLabStatus(lab: LabPoint): 'normal' | 'high' | 'low' | 'unknown' {
  const info = UCUM_MAP[lab.code.toUpperCase()];
  if (!info) return 'unknown';
  if (lab.value > info.uln) return 'high';
  if (lab.value < info.lln) return 'low';
  return 'normal';
}

export const LabsResults: React.FC<{
  labs: LabPoint[];
}> = ({ labs }) => {
  const [filterSystem, setFilterSystem] = useState<string>('all');

  const sortedLabs = [...labs].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  // Unique dates
  const uniqueDates = [...new Set(sortedLabs.map(l => l.date))].sort().reverse();

  // Systems present
  const systems = [...new Set(labs.map(l => LAB_SYSTEM_MAP[l.code.toUpperCase()] || ''))].sort();

  // Filter labs
  const filteredLabs = filterSystem === 'all'
    ? sortedLabs
    : sortedLabs.filter(l => (LAB_SYSTEM_MAP[l.code.toUpperCase()] || '') === filterSystem);

  // Group by date
  const groupedByDate = uniqueDates.reduce<Record<string, LabPoint[]>>((acc, date) => {
    const dateLabs = filteredLabs.filter(l => l.date === date);
    if (dateLabs.length > 0) acc[date] = dateLabs;
    return acc;
  }, {});

  const addNewLab = () => {
    const confirmed = window.confirm('');
    if (confirmed) {
      const inputTab = document.querySelector('[data-tab="input"]') as HTMLElement;
      if (inputTab) inputTab.click();
    }
  };

  return (
    <div className="labs-results" aria-label="">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>📋 Результаты анализов</h3>
          <button onClick={addNewLab} style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + Добавить
          </button>
        </div>

        {/* System filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            onClick={() => setFilterSystem('all')}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: filterSystem === 'all' ? 'var(--accent)' : 'transparent', color: filterSystem === 'all' ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
          >
            Все
          </button>
          {systems.map(sys => (
            <button
              key={sys}
              onClick={() => setFilterSystem(sys)}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: filterSystem === sys ? 'var(--accent)' : 'transparent', color: filterSystem === sys ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
            >
              {sys}
            </button>
          ))}
        </div>

        {labs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧪</div>
            <div>Нет данных анализов</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Нажмите «+ Добавить» для ввода результатов</div>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, dateLabs]) => (
            <div key={date} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
                📅 {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {dateLabs.map((lab) => {
                  const status = getLabStatus(lab);
                  const info = UCUM_MAP[lab.code.toUpperCase()];
                  const statusColor = status === 'high' ? '#ef4444' : status === 'low' ? '#f97316' : '#22c55e';
                  const statusIcon = status === 'high' ? '↑' : status === 'low' ? '↓' : '✓';
                  const systemName = LAB_SYSTEM_MAP[lab.code.toUpperCase()] || '';

                  return (
                    <div key={lab.code} className="lab-card" aria-label={`Анализ: ${lab.name}`} style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{lab.name || lab.code}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          {systemName}{info ? ` • ${info.lln}–${info.uln} ${info.prefUnit}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: statusColor }}>{lab.value}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 2 }}>{lab.unit || ''}</span>
                          <span style={{ marginLeft: 4, color: statusColor }}>{statusIcon}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
