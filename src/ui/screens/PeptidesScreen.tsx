import React, { useState } from 'react';
import { registry } from '../../core/data/registry';
import { generateStack } from '../../engines/stack-builder.engine';

export const PeptidesScreen: React.FC = () => {
  const peptides = registry.getDB().substances.filter(s => s.category === 'peptides');
  const [selected, setSelected] = useState('');
  const [dose, setDose] = useState(100);
  const [result, setResult] = useState<string | null>(null);

  const run = () => {
    if (!selected) return;
    // В реальном проекте здесь вызов API / расчёт PK
    setResult(`✅ Пептид ${selected} | Доза: ${dose} mcg | Статус: Готово к запуску`);
  };

  return (
    <div className="screen peptides">
      <h2>Peptide Calculator</h2>
      <select value={selected} onChange={e => setSelected(e.target.value)} className="input">
        <option value="">Выберите пептид</option>
        {peptides.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="number" value={dose} onChange={e => setDose(Number(e.target.value))} className="input" placeholder="Доза (mcg)" />
      <button onClick={run} className="btn">Рассчитать</button>
      {result && <pre className="output">{result}</pre>}
    </div>
  );
};