import React, { useState } from 'react';
import { PHARMA_DB } from '../../core/pharma-database';
import { calculateDose } from '../../engines/dosage.engine';

const PEPTIDE_CLASSES = ['peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf'] as const;

const CLASS_LABELS: Record<string, string> = {
  peptide_ghrh: '',
  peptide_ghrp: '',
  igf1: 'IGF-1 (РРЅСЃСѓР»РёРЅРѕРїРѕРґРѕР±РЅС‹Р№ С„Р°РєС‚РѕСЂ СЂРѕСЃС‚Р°)',
  mgf: '',
};

export const PeptidesScreen: React.FC = () => {
  const peptides = Object.values(PHARMA_DB).filter(s =>
    PEPTIDE_CLASSES.includes(s.class as typeof PEPTIDE_CLASSES[number])
  );
  const [selected, setSelected] = useState('');
  const [doseMcg, setDoseMcg] = useState(100);
  const [concentration, setConcentration] = useState(2);
  const [vialVol, setVialVol] = useState(2);
  const [result, setResult] = useState<string | null>(null);
  const [doseHistory, setDoseHistory] = useState<{ name: string; dose: number; time: string }[]>([]);

  const selectedSub = selected ? PHARMA_DB[selected] : null;

  const run = () => {
    if (!selected || !selectedSub) return;
    const doseMg = doseMcg / 1000;
    const calc = calculateDose({
      targetDoseMg: doseMg,
      concentrationMgPerMl: concentration,
      roundingStepMl: 0.01,
      syringeVolumeMl: 1,
      divisionsPerMl: 100,
      vialVolumeMl: vialVol
    });
    setResult(
      `${selectedSub.name}\n` +
        `` +
        `` +
        `` +
        `` +
        (calc.flags.length ? `вљ  ${calc.flags.join(', ')}` : 'вњ“ Р“РѕС‚РѕРІРѕ Рє РІРІРµРґРµРЅРёСЋ')
    );
    setDoseHistory(prev => [{ name: selectedSub.name, dose: doseMcg, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 10));
  };

  const groupedPeptides = PEPTIDE_CLASSES.reduce((acc, cls) => {
    acc[cls] = peptides.filter(p => p.class === cls);
    return acc;
  }, {} as Record<string, typeof peptides>);

  return (
    <div className="screen peptides">
      <h2>РџРµРїС‚РёРґС‹</h2>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>&#128138; РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ РґРѕР·РёСЂРѕРІРєРё</h3>
        <select value={selected} onChange={e => setSelected(e.target.value)} className="input">
          <option value="">Р’С‹Р±РµСЂРёС‚Рµ РїРµРїС‚РёРґ</option>
          {PEPTIDE_CLASSES.map(cls => (
            <optgroup key={cls} label={CLASS_LABELS[cls] ?? cls}>
              {(groupedPeptides[cls] ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {selectedSub && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{selectedSub.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
              <div>РџРµСЂРёРѕРґ РїРѕР»СѓРІС‹РІРµРґРµРЅРёСЏ: {selectedSub.pk.halfLifeHours} С‡</div>
              <div>Р‘РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ: {(selectedSub.pk.bioavailability * 100).toFixed(0)}%</div>
              <div>AR СЃСЂРѕРґСЃС‚РІРѕ: {selectedSub.pd.AR_affinity}</div>
              <div>Р“РµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ: {selectedSub.pd.hepatotoxicity}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Р”РѕР·Р° (РјРєРі)</label>
            <input type="number" value={doseMcg} onChange={e => setDoseMcg(Number(e.target.value))} placeholder="" min={0} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>РљРѕРЅС†РµРЅС‚СЂР°С†РёСЏ (РјРі/РјР»)</label>
            <input type="number" value={concentration} onChange={e => setConcentration(Number(e.target.value))} placeholder="" min={0} step={0.1} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>РћР±СЉС‘Рј С„Р»Р°РєРѕРЅР° (РјР»)</label>
            <input type="number" value={vialVol} onChange={e => setVialVol(Number(e.target.value))} placeholder="" min={0.5} step={0.5} />
          </div>
        </div>

        <button onClick={run} className="btn" disabled={!selected}>&#128270; Р Р°СЃСЃС‡РёС‚Р°С‚СЊ</button>
      </div>

      {result && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>Р РµР·СѓР»СЊС‚Р°С‚ СЂР°СЃС‡С‘С‚Р°</h3>
          <pre className="output" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result}</pre>
        </div>
      )}

      {doseHistory.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>РСЃС‚РѕСЂРёСЏ РїСЂРёС‘РјРѕРІ</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {doseHistory.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                <span>{h.name}</span>
                <span style={{ color: 'var(--accent)' }}>{h.dose} РјРєРі</span>
                <span style={{ color: 'var(--text-dim)' }}>{h.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>РЎРїСЂР°РІРѕС‡РЅРёРє РїРµРїС‚РёРґРѕРІ</h3>
        {PEPTIDE_CLASSES.map(cls => {
          const items = groupedPeptides[cls] ?? [];
          if (!items.length) return null;
          return (
            <div key={cls} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--accent)' }}>{CLASS_LABELS[cls]}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {items.map(p => (
                  <div key={p.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, cursor: 'pointer' }} onClick={() => setSelected(p.id)}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      <div>TВЅ: {p.pk.halfLifeHours} С‡</div>
                      <div>Р‘РёРѕРґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ: {(p.pk.bioavailability * 100).toFixed(0)}%</div>
                      <div>Р“РµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ: {p.pd.hepatotoxicity}</div>
                      <div>Р’Р»РёСЏРЅРёРµ РЅР° Р»РёРїРёРґС‹: {p.pd.lipid_impact}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};