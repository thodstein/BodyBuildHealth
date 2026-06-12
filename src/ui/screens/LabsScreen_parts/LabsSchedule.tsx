import React from 'react';
import { REQUIRED_LABS_PER_PHASE } from '../../../core/constants';

const PHASE_LABELS: Record<string, string> = {
  baseline: '',
  on_cycle: '',
  bridge: '',
  pct: '',
  post_pct: '',
  course_bridge_course: '',
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
  baseline: '',
  on_cycle: '',
  bridge: '',
  pct: '',
  post_pct: '',
  course_bridge_course: '',
};

const LAB_DESCRIPTIONS: Record<string, string> = {
  'ALT': '',
  'AST': '',
  'GGT': '',
  'HCT': '',
  'HGB': '',
  'PLT': '',
  'WBC': '',
  'TT': '',
  'FT3': '',
  'FT4': '',
  'TSH': '',
  'E2': '',
  'PRL': '',
  'LH': '',
  'FSH': '',
  'SHBG': '',
  'CRP': '',
  'HbA1c': '',
  'FERRITIN': '',
  'VITD': '',
  'LDL': '',
  'HDL': '',
  'TG': '',
  'GLU': '',
  'INS': '',
  'HOMA': 'HOMA-IR — индекс инсулинорезистентности',
  'CREATININE': '',
  'UA': '',
  'CORTISOL': '',
  'IGF1': '',
  'ALP': '',
  'BILIRUBIN_TOTAL': '',
  'BIL_T': '',
  'PROTEIN_TOTAL': '',
  'BUN': '',
  'EGFR': '',
};

export const LabsSchedule: React.FC = () => {
  return (
    <div className="labs-schedule">
      <div className="card">
        <h3>📅 График сдачи анализов</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Рекомендуемый график сдачи анализов по фазам курса. Каждая фаза требует определённый набор маркеров.
        </p>

        {Object.entries(REQUIRED_LABS_PER_PHASE).map(([phase, labs]) => {
          const phaseLabel = PHASE_LABELS[phase] || phase;
          const phaseDesc = PHASE_DESCRIPTIONS[phase] || '';

          return (
            <div key={phase} style={{ marginBottom: 16, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 4 }}>
                {phaseLabel}
              </div>
              {phaseDesc && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{phaseDesc}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {labs.map((code: string) => (
                  <span key={code} style={{
                    background: 'rgba(0,230,138,0.1)',
                    border: '1px solid rgba(0,230,138,0.3)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--text)',
                  }}>
                    {code}
                    {LAB_DESCRIPTIONS[code] && (
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 4 }} title={LAB_DESCRIPTIONS[code]}>ℹ️</span>
                    )}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                Всего маркеров: {labs.length}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
