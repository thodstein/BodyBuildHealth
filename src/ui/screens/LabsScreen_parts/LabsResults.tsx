import React from 'react';
import type { LabPoint } from '../../../core/types';

export const LabsResults: React.FC<{
  labs: LabPoint[];
}> = ({ labs }) => {
  const sortedLabs = [...labs].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  return (
    <div className="labs-results" aria-label="Результаты анализов">
      <div className="card">
        <h3>Результаты анализов</h3>

        {sortedLabs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
            Нет данных анализов
          </div>
        ) : (
          <div className="grid labs-grid">
            {sortedLabs.map((lab, index) => (
              <div key={lab.date + '-' + lab.code} className="lab-card" aria-label={`Анализ: ${lab.name}`}>
                <div className="lab-header">
                  <span className="lab-name" title={lab.name}>{lab.name ?? 'Без названия'}</span>
                  <span className="lab-status">
                    {lab.value != null ? (typeof lab.value === 'number' ? '✓' : '?') : '—'}
                  </span>
                </div>

                <div className="lab-value">
                  {lab.value != null ? lab.value : '—'}{' '}
                  {lab.unit ? lab.unit : ''}
                </div>

                <div className="lab-date" title="Дата анализа">
                  {lab.date ? new Date(lab.date).toLocaleDateString('ru-RU') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
