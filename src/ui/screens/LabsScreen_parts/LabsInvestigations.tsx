import React, { useState } from 'react';
import { SYSTEM_INFO } from '../../../core/risk-info';

interface Investigation {
  id: string;
  name: string;
  system: string;
  freq: string;
  markers: string;
  reason: string;
}

const SYSTEM_LABELS_INVEST: Record<string, string> = {
  cardio: '❤️ Сердечно-сосудистая',
  hepatic: '',
  renal: '',
  neuro: '',
  endocrine: '',
  reproductive: '',
  musculoskeletal: '',
  hematologic: '',
};

const INVESTIGATIONS_DATA: Investigation[] = [
  { id: 'echo_kg', name: '', system: 'cardio', freq: '', markers: '', reason: '' },
  { id: 'ekg', name: '', system: 'cardio', freq: '', markers: 'QTc, гипертрофия ЛЖ, аритмии, ишемия, блокады', reason: '' },
  { id: 'usg_heart_24h', name: '', system: 'cardio', freq: '', markers: '', reason: '' },
  { id: 'usg_abd', name: '', system: 'hepatic', freq: '', markers: '', reason: '' },
  { id: 'fibroscan', name: '', system: 'hepatic', freq: '', markers: '', reason: '' },
  { id: 'usg_kidney', name: '', system: 'renal', freq: '', markers: '', reason: '' },
  { id: 'mri_brain', name: '', system: 'neuro', freq: '', markers: '', reason: '' },
  { id: 'eeg', name: '', system: 'neuro', freq: '', markers: '', reason: '' },
  { id: 'usg_thyroid', name: '', system: 'endocrine', freq: '', markers: '', reason: '' },
  { id: 'usg_prostate', name: '', system: 'reproductive', freq: '', markers: '', reason: '' },
  { id: 'spermiogram', name: '', system: 'reproductive', freq: '', markers: '', reason: '' },
  { id: 'densitometry', name: '', system: 'musculoskeletal', freq: '', markers: '', reason: '' },
  { id: 'usg_joints', name: '', system: 'musculoskeletal', freq: '', markers: '', reason: '' },
  { id: 'blood_smear', name: '', system: 'hematologic', freq: '', markers: '', reason: '' },
];

export const LabsInvestigations: React.FC = () => {
  const [collapsedSystems, setCollapsedSystems] = useState<Record<string, boolean>>({});
  const [invDone, setInvDone] = useState<Record<string, boolean>>({});

  const toggleSystem = (system: string) => {
    setCollapsedSystems(prev => ({ ...prev, [system]: !prev[system] }));
  };

  const toggleInv = (id: string) => {
    setInvDone(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupedBySystem = INVESTIGATIONS_DATA.reduce((acc, inv) => {
    if (!acc[inv.system]) acc[inv.system] = [];
    acc[inv.system].push(inv);
    return acc;
  }, {} as Record<string, Investigation[]>);

  const totalDone = Object.values(invDone).filter(Boolean).length;
  const totalAll = INVESTIGATIONS_DATA.length;

  return (
    <div className="labs-investigations">
      <div className="card">
        <h3>🔬 Исследования и обследования</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
          Инструментальные и аппаратные исследования для мониторинга на курсе и в ПКТ
        </p>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${totalAll > 0 ? (totalDone / totalAll * 100) : 0}%`, background: 'var(--accent)', height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{totalDone}/{totalAll}</span>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {Object.entries(groupedBySystem).map(([system, investigations]) => {
            const isCollapsed = collapsedSystems[system] || false;
            const doneCount = investigations.filter(inv => invDone[inv.id]).length;
            return (
              <div key={system} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                  }}
                  onClick={() => toggleSystem(system)}
                >
                  <div style={{ fontWeight: 600, fontSize: 12 }}>
                    {SYSTEM_LABELS_INVEST[system] || system}
                    <span style={{ marginLeft: 6, fontSize: 10, color: doneCount === investigations.length ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {doneCount}/{investigations.length}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {isCollapsed ? '▼' : '▲'}
                  </span>
                </div>
                {!isCollapsed && (
                  <div style={{ padding: '6px 10px' }}>
                    {investigations.map(inv => {
                      const isDone = invDone[inv.id] ?? false;
                      return (
                        <div key={inv.id} style={{
                          background: isDone ? 'rgba(0,230,138,0.06)' : 'var(--bg-secondary)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          border: isDone ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
                          marginBottom: 6,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 11, color: isDone ? 'var(--accent)' : 'var(--text)' }}>{inv.name}</div>
                            </div>
                            <button onClick={() => toggleInv(inv.id)} style={{
                              padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                              background: isDone ? 'rgba(0,230,138,0.15)' : 'var(--bg-tertiary)',
                              color: isDone ? 'var(--accent)' : 'var(--text-dim)',
                              border: isDone ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
                              whiteSpace: 'nowrap',
                            }}>
                              {isDone ? '✓' : '✗'}
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 2 }}>⏱ {inv.freq}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}><b>Параметры:</b> {inv.markers}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.3 }}>{inv.reason}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
