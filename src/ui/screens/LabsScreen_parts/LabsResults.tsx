import React, { useState, useMemo } from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';

const LAB_SYSTEM_MAP: Record<string, string> = {
  'ALT': 'hepatic', 'AST': 'hepatic', 'GGT': 'hepatic', 'ALP': 'hepatic',
  'BILIRUBIN_TOTAL': 'hepatic', 'BIL_T': 'hepatic', 'BIL': 'hepatic', 'ALB': 'hepatic',
  'CREATININE': 'renal', 'BUN': 'renal', 'EGFR': 'renal', 'PROTEIN_TOTAL': 'renal', 'UA': 'renal',
  'TSH': 'endocrine', 'FT3': 'endocrine', 'FT4': 'endocrine',
  'TESTOSTERONE': 'endocrine', 'TT': 'endocrine', 'E2': 'endocrine', 'ESTRADIOL': 'endocrine',
  'PRL': 'endocrine', 'PROLACTIN': 'endocrine', 'CORTISOL': 'endocrine',
  'INSULIN': 'metabolic', 'INS': 'metabolic', 'HOMA': 'metabolic',
  'LH': 'endocrine', 'FSH': 'endocrine', 'SHBG': 'endocrine', 'IGF1': 'endocrine',
  'HGB': 'hematologic', 'HCT': 'hematologic', 'PLT': 'hematologic', 'WBC': 'hematologic',
  'LDL': 'cardio', 'HDL': 'cardio', 'TG': 'cardio', 'GLU': 'metabolic', 'GLUCOSE': 'metabolic',
  'HBA1C': 'metabolic', 'HOMOCYSTEINE': 'neuro', 'FERRITIN': 'hematologic',
  'CRP': 'cardio', 'VITD': 'metabolic', 'CALCIDIOL': 'metabolic',
};

const sysLabels: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная система', endocrine: 'Эндокринная', hematologic: 'Кровь',
  reproductive: 'Репродуктивная', musculoskeletal: 'Мышечная', metabolic: 'Метаболизм',
  other: 'Прочее',
};

const sysColors: Record<string, string> = {
  hepatic: '#22c55e', renal: '#3b82f6', endocrine: '#a855f7',
  hematologic: '#ef4444', cardio: '#f97316', metabolic: '#eab308',
  reproductive: '#ec4899', neuro: '#14b8a6', other: '#6b7280',
};

const sysIcons: Record<string, string> = {
  hepatic: '🫁', renal: '🫘', endocrine: '🧬', hematologic: '🩸',
  cardio: '❤️', metabolic: '⚡', reproductive: '🧫', neuro: '🧠', other: '📋',
};

function getLabStatus(lab: LabPoint): 'normal' | 'high' | 'low' | 'unknown' {
  const info = UCUM_MAP[lab.code.toUpperCase()];
  if (!info) return 'unknown';
  if (lab.value > info.uln) return 'high';
  if (lab.value < info.lln) return 'low';
  return 'normal';
}

export const LabsResults: React.FC<{ labs: LabPoint[] }> = ({ labs }) => {
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  const sortedLabs = useMemo(() =>
    [...labs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [labs]
  );

  const uniqueDates = useMemo(() =>
    [...new Set(sortedLabs.map(l => l.date))].sort().reverse(),
    [sortedLabs]
  );

  const systems = useMemo(() =>
    [...new Set(labs.map(l => LAB_SYSTEM_MAP[l.code.toUpperCase()] || ''))].filter(Boolean).sort(),
    [labs]
  );

  const filteredLabs = filterSystem === 'all'
    ? sortedLabs
    : sortedLabs.filter(l => (LAB_SYSTEM_MAP[l.code.toUpperCase()] || '') === filterSystem);

  const groupedByDate = uniqueDates.reduce<Record<string, LabPoint[]>>((acc, date) => {
    const dateLabs = filteredLabs.filter(l => l.date === date);
    if (dateLabs.length > 0) acc[date] = dateLabs;
    return acc;
  }, {});

  return (
    <div>
      {/* Expand/Collapse header */}
      <button onClick={() => setIsExpanded(!isExpanded)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', marginBottom: 8,
        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        color: 'var(--text)', fontSize: 12, fontWeight: 600,
      }}>
        <span style={{ fontSize: 14, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        <span>История анализов</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{labs.length} записей</span>
      </button>

      {isExpanded && (<>
      {/* System filter */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => setFilterSystem('all')} style={{
          padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 10, fontWeight: 600,
          background: filterSystem === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
          color: filterSystem === 'all' ? '#000' : 'var(--text-dim)',
        }}>
          Все системы
        </button>
        {systems.map(sys => (
          <button key={sys} onClick={() => setFilterSystem(sys)} style={{
            padding: '5px 10px', borderRadius: 8, border: `1px solid ${filterSystem === sys ? sysColors[sys] : 'var(--border)'}`, cursor: 'pointer', fontSize: 10, fontWeight: 600,
            background: filterSystem === sys ? sysColors[sys] + '18' : 'var(--bg-secondary)',
            color: filterSystem === sys ? sysColors[sys] : 'var(--text-dim)',
          }}>
            {sysIcons[sys] || ''} {sysLabels[sys] || sys}
          </button>
        ))}
      </div>

      {labs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🧪</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Нет данных анализов</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Введите анализы во вкладке «Текущие»</div>
        </div>
      ) : (
        Object.entries(groupedByDate).map(([date, dateLabs]) => (
          <div key={date} className="card" style={{ marginBottom: 10, padding: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                {dateLabs.length} маркеров
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {dateLabs.map((lab) => {
                const status = getLabStatus(lab);
                const info = UCUM_MAP[lab.code.toUpperCase()];
                const sys = LAB_SYSTEM_MAP[lab.code.toUpperCase()] || 'other';
                const sysColor = sysColors[sys] || '#6b7280';
                const isAbnormal = status === 'high' || status === 'low';
                const statusIcon = status === 'high' ? '↑' : status === 'low' ? '↓' : '✓';
                const statusColor = status === 'high' ? '#ef4444' : status === 'low' ? '#f97316' : sysColor;

                return (
                  <div key={lab.code + lab.date} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                    background: isAbnormal ? 'rgba(239,68,68,0.04)' : 'var(--bg-secondary)',
                    border: `1px solid ${isAbnormal ? 'rgba(239,68,68,0.12)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: sysColor + '16', color: sysColor, fontWeight: 700, fontSize: 9,
                    }}>
                      {lab.code.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: isAbnormal ? '#ef4444' : 'var(--text)' }}>
                        {lab.name || lab.code}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                        {sysLabels[sys] || sys}
                        {info && ` • ${info.lln}–${info.uln} ${info.prefUnit || ''}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: statusColor }}>
                        {lab.value}
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 2 }}>{lab.unit || ''}</span>
                        <span style={{ marginLeft: 3, fontSize: 11 }}>{statusIcon}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      </>)}
    </div>
  );
};
