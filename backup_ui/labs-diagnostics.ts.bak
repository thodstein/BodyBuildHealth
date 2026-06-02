import React, { useState, useMemo } from 'react';
import { MASTER_DB } from '../core/master-db';
import type { LabPoint } from '../core/types';

export const LabsDiagnosticsModule: React.FC = () => {
  const db = MASTER_DB;
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');

  const addLab = () => {
    if (!code || !value) return;
    setLabs([...labs, { id: Date.now().toString(), code: code.toUpperCase(), name: code, value: parseFloat(value), unit: '', date: new Date().toISOString().slice(0, 10), phase: 'course' }]);
  };

  // Маппинг лаб на риски
  const activeRisks = useMemo(() => {
    return labs.map(l => db.risks.find(r => r.id.toUpperCase() === l.code.toUpperCase())).filter(Boolean);
  }, [labs]);

  return (
    <div className="labs-diagnostics-container">
      <h2>🧪 Лаборатория</h2>
      
      <div className="add-lab-form">
        <select value={code} onChange={e => setCode(e.target.value)}>
          <option value="">Маркер</option>
          <option value="ALT">ALT</option>
          <option value="AST">AST</option>
          <option value="GLUCOSE">Glucose</option>
          <option value="LIPIDS">Lipids</option>
        </select>
        <input type="number" placeholder="Значение" value={value} onChange={e => setValue(e.target.value)} />
        <button onClick={addLab}>Добавить</button>
      </div>

      <div className="labs-list">
        {labs.map(l => (
          <div key={l.id} className="lab-item">
            <strong>{l.code}</strong>: {l.value}
          </div>
        ))}
      </div>

      <div className="risks-section">
        <h3>🔗 Связанные риски</h3>
        {activeRisks.map((r, i) => (
          <div key={i} className="risk-card">
            <h4>{r?.name}</h4>
            <p>{r?.description}</p>
            <span className="badge">{r?.levels}</span>
          </div>
        ))}
      </div>
    </div>
  );
};