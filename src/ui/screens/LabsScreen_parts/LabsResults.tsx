import React from 'react';
import type { LabResult } from '../../core/types';

export const LabsResults: React.FC<{
  labs: LabResult[];
}> = ({ labs }) => {
  return (
    <div className="labs-results">
      <div className="card">
        <h3>Результаты анализов</h3>
        {labs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
            Нет данных анализов
          </div>
        ) : (
          <div className="grid labs-grid">
            {labs.map((lab, i) => (
              <div key={i} className="lab-card">
                <div className="lab-header">
                  <span className="lab-name">{lab.name}</span>
                  <span className={`lab-status ${lab.status}`}>
                    {lab.status === 'normal' ? '✓' : lab.status === 'high' ? '▲' : '▼'}
                  </span>
                </div>
                <div className="lab-value">{lab.value} {lab.unit}</div>
                <div className="lab-reference">
                  Норма: {lab.refMin} - {lab.refMax} {lab.unit}
                </div>
                {lab.comment && <div className="lab-comment">{lab.comment}</div>}
                <div className="lab-date">{lab.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
