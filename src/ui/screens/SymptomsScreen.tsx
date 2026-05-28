import React, { useState } from 'react';

interface Props { initialSymptoms?: string[]; }

export const SymptomsScreen: React.FC<Props> = ({ initialSymptoms = [] }) => {
  const [symptoms, setSymptoms] = useState<string[]>(initialSymptoms);
  const [input, setInput] = useState('');

  const add = () => {
    if (input.trim()) {
      setSymptoms(prev => [...prev, input.trim()]);
      setInput('');
    }
  };

  return (
    <div className="screen symptoms">
      <h2>Симптомы</h2>
      <div className="row">
        <input className="input" value={input} onChange={e => setInput(e.target.value)} placeholder="Введите симптом" />
        <button onClick={add} className="btn">Добавить</button>
      </div>
      <div className="list">
        {symptoms.map((s, i) => (
          <div key={i} className="symptom-item">{s}</div>
        ))}
        {symptoms.length === 0 && <div className="empty">Нет добавленных симптомов</div>}
      </div>
    </div>
  );
};