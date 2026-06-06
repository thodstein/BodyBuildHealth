import React from 'react';
import type { LabResult } from '../../core/types';

export const LabsOverview: React.FC<{
  labs: LabResult[];
  hasLabs: boolean;
  forceNoLabs: boolean;
  setForceNoLabs: (v: boolean) => void;
}> = ({ labs, hasLabs, forceNoLabs, setForceNoLabs }) => {
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
              {labs.filter(l => l.status === 'normal').length}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Отклонения</div>
            <div className="stat-value" style={{ color: labs.some(l => l.status === 'high') ? '#ef4444' : '#eab308' }}>
              {labs.filter(l => l.status !== 'normal').length}
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
