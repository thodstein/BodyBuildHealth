import React, { useState } from 'react';
import { registry } from '../../core/data/registry';

export const PharmaScreen: React.FC = () => {
  const pharma = registry.getDB().substances.filter(s => s.category === 'pharma');
  const [drug, setDrug] = useState('');
  const [mgKg, setMgKg] = useState(2);
  const [weight, setWeight] = useState(90);
  const [result, setResult] = useState<string | null>(null);

  const run = () => {
    if (!drug) return;
    const base = mgKg * weight;
    setResult(`💊 ${drug} | Базовая доза: ${base.toFixed(1)} мг | Вес: ${weight} кг`);
  };

  return (
    <div className="screen pharma">
      <h2>Pharma Calculator</h2>
      <select value={drug} onChange={e => setDrug(e.target.value)} className="input">
        <option value="">Выберите препарат</option>
        {pharma.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="row">
        <input type="number" value={mgKg} onChange={e => setMgKg(Number(e.target.value))} className="input" placeholder="мг/кг" />
        <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="input" placeholder="Вес (кг)" />
      </div>
      <button onClick={run} className="btn">Рассчитать</button>
      {result && <pre className="output">{result}</pre>}
    </div>
  );
};