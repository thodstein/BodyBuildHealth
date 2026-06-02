import React, { useState } from 'react';
import { PHARMA_DB } from '../../core/pharma-database';
import { calculateDose } from '../../engines/dosage.engine';

const PEPTIDE_CLASSES = ['peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf'] as const;

export const PeptidesScreen: React.FC = () => {
  const peptides = Object.values(PHARMA_DB).filter((s) =>
    PEPTIDE_CLASSES.includes(s.class as (typeof PEPTIDE_CLASSES)[number])
  );
  const [selected, setSelected] = useState('');
  const [doseMcg, setDoseMcg] = useState(100);
  const [concentration, setConcentration] = useState(2);
  const [result, setResult] = useState<string | null>(null);

  const run = () => {
    if (!selected) return;
    const sub = PHARMA_DB[selected];
    const doseMg = doseMcg / 1000;
    const calc = calculateDose({
      targetDoseMg: doseMg,
      concentrationMgPerMl: concentration,
      roundingStepMl: 0.01,
      syringeVolumeMl: 1,
      divisionsPerMl: 100,
      vialVolumeMl: 2
    });
    setResult(
      `${sub?.name ?? selected}\n` +
        `Целевая доза: ${doseMcg} mcg (${doseMg} mg)\n` +
        `Концентрация: ${concentration} mg/ml\n` +
        `Объём: ${calc.volumeMl} мл, деления: ${calc.divisions}\n` +
        (calc.flags.length ? `⚠ ${calc.flags.join(', ')}` : '✓ Готово к введению')
    );
  };

  return (
    <div className="screen peptides">
      <h2>Калькулятор пептидов</h2>
      <div className="card">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Выберите пептид</option>
          {peptides.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <input type="number" value={doseMcg} onChange={(e) => setDoseMcg(Number(e.target.value))} placeholder="Доза (mcg)" />
          <input type="number" value={concentration} onChange={(e) => setConcentration(Number(e.target.value))} placeholder="mg/ml" />
        </div>
        <button onClick={run} className="btn">Рассчитать</button>
      </div>
      {result && <pre className="output">{result}</pre>}
    </div>
  );
};