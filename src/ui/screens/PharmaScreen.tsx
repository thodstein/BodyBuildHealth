import React, { useState, useMemo } from 'react';
import { PHARMA_DB, SUBSTANCES_BY_CLASS } from '../../core/pharma-database';
import { calculateDose } from '../../engines/dosage.engine';
import { simulateCourse, steadyStatePeak, steadyStateTrough, eliminationConstant } from '../../engines/pk-pd.engine';
import { calculateMultiSubstancePKPD } from '../../engines/pkpd-superposition.engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import type { PharmaSubstance, CourseEntry, PD } from '../../core/types';

type Tab = 'catalog' | 'pkpd' | 'dosage' | 'interactions';

const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон',
  trenbolone: 'Тренболон',
  nandrolone: 'Нандролон',
  boldenone: 'Болденон',
  primobolan: 'Примоболан',
  oral_17aa: 'Оральные 17-α',
  sarm: 'SARMs',
  peptide_ghrh: 'Пептиды GHRH',
  peptide_ghrp: 'Пептиды GHRP',
  igf1: 'ИГФ-1',
  mgf: 'МГФ',
  insulin: 'Инсулины',
  pct_serm: 'СЕРМ (ПКТ)',
  pct_aromatase: 'Ингибиторы ароматазы',
  pct_dopamine: 'Допаминовые агонисты',
  support: 'Поддержка',
};

const PD_LABELS: Record<keyof PD, string> = {
  AR_affinity: 'Сродство к AR',
  aromatization: 'Ароматизация',
  five_alpha_reduction: '5α-восстановление',
  progestogenic: 'Прогестогенная акт.',
  hepatotoxicity: 'Гепатотоксичность',
  lipid_impact: 'Влияние на липиды',
  hct_impact: 'Влияние на HCT',
  neuro_toxicity: 'Нейротоксичность',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff1744',
  warning: '#ff9100',
  info: '#2979ff',
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  synergy: 'Синергия',
  conflict: 'Конфликт',
  danger: 'Опасность',
  caution: 'Осторожность',
};

const pdBarColor = (key: keyof PD, val: number): string => {
  if (key === 'hepatotoxicity') return val >= 2.5 ? '#ff1744' : val >= 1.5 ? '#ff9100' : '#4caf50';
  if (key === 'aromatization') return val >= 0.7 ? '#ff5252' : '#4caf50';
  if (key === 'progestogenic') return val >= 0.3 ? '#ff9100' : '#4caf50';
  if (key === 'neuro_toxicity') return val >= 0.3 ? '#ff1744' : val >= 0.1 ? '#ff9100' : '#4caf50';
  if (key === 'lipid_impact') return val <= -0.5 ? '#ff1744' : '#4caf50';
  if (key === 'hct_impact') return val >= 4 ? '#ff1744' : '#4caf50';
  return '#2979ff';
};

const formatHalfLife = (hours: number): string => {
  if (hours >= 168) return `${(hours / 168).toFixed(1)} нед`;
  if (hours >= 24) return `${(hours / 24).toFixed(1)} дн`;
  return `${hours.toFixed(1)} ч`;
};

export const PharmaScreen: React.FC = () => {
  const [tab, setTab] = useState<Tab>('catalog');

  return (
    <div className="screen pharma">
      <h2>Фармакология</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {([
          ['catalog', 'Каталог'],
          ['pkpd', 'PK/PD'],
          ['dosage', 'Дозировка'],
          ['interactions', 'Взаимодействия'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`btn${tab === key ? ' btn-primary' : ''}`}
            style={{ fontSize: 12, padding: '6px 10px', whiteSpace: 'nowrap' }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'pkpd' && <PKPDSimulationTab />}
      {tab === 'dosage' && <DosageCalculatorTab />}
      {tab === 'interactions' && <InteractionCheckerTab />}
    </div>
  );
};

const CatalogTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const selected = selectedId ? PHARMA_DB[selectedId] : null;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {Object.entries(SUBSTANCES_BY_CLASS).map(([cls, list]) => (
          <div key={cls}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                background: 'var(--card-bg, #1a1a2e)',
                borderRadius: 6,
                cursor: 'pointer',
                borderBottom: expandedClass === cls ? 'none' : '1px solid var(--border)',
              }}
              onClick={() => setExpandedClass(expandedClass === cls ? null : cls)}
            >
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {CLASS_LABELS[cls] || cls}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{list.length}</span>
            </div>
            {expandedClass === cls && (
              <div style={{ paddingLeft: 8, paddingTop: 4 }}>
                {list.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                    style={{
                      padding: '5px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      background: selectedId === s.id ? 'var(--accent, #7c4dff)' : 'transparent',
                      borderRadius: 4,
                      color: selectedId === s.id ? '#fff' : 'var(--text)',
                    }}
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {selected && <DrugDetailCard sub={selected} />}
    </div>
  );
};

const DrugDetailCard: React.FC<{ sub: PharmaSubstance }> = ({ sub }) => {
  const pd = sub.pd;
  const pdEntries = Object.entries(pd) as [keyof PD, number][];

  const riskLabels: string[] = [];
  if (pd.hepatotoxicity >= 2) riskLabels.push('Гепатотоксичность высокая');
  if (pd.aromatization >= 0.7) riskLabels.push('Высокая ароматизация → эстрогенные побочки');
  if (pd.progestogenic >= 0.3) riskLabels.push('Прогестогенная активность → риск пролактина');
  if (pd.neuro_toxicity >= 0.3) riskLabels.push('Нейротоксичность');
  if (pd.lipid_impact <= -0.5) riskLabels.push('Сильное ухудшение липидного профиля');
  if (pd.hct_impact >= 4) riskLabels.push('Значительный рост HCT');

  const effectLabels: string[] = [];
  if (pd.AR_affinity >= 1.0) effectLabels.push('Высокая AR-активация');
  else if (pd.AR_affinity >= 0.7) effectLabels.push('Умеренная AR-активация');
  if (pd.five_alpha_reduction >= 0.5) effectLabels.push('Подвержен 5α-редуктазе');
  if (pd.aromatization === 0) effectLabels.push('Не ароматизируется');
  if (sub.class === 'sarm') effectLabels.push('Селективная AR-модуляция');

  return (
    <div className="card" style={{ fontSize: 12, lineHeight: 1.6 }}>
      <h3 style={{ margin: '0 0 8px', color: 'var(--accent)' }}>{sub.name}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
        <span>Класс:</span><span style={{ fontWeight: 600 }}>{CLASS_LABELS[sub.class] || sub.class}</span>
        <span>T½:</span><span style={{ fontWeight: 600 }}>{formatHalfLife(sub.pk.halfLifeHours)}</span>
        <span>Биодоступность:</span><span style={{ fontWeight: 600 }}>{(sub.pk.bioavailability * 100).toFixed(0)}%</span>
        <span>Vd:</span><span style={{ fontWeight: 600 }}>{sub.pk.Vd} л</span>
        <span>Эстеры:</span><span style={{ fontWeight: 600 }}>{sub.esters?.join(', ') || '—'}</span>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Фармакодинамика</div>
        {pdEntries.map(([key, val]) => {
          const absVal = Math.abs(val);
          const maxScale = key === 'AR_affinity' ? 2 : key === 'hct_impact' ? 6 : key === 'hepatotoxicity' ? 4 : 1.2;
          const pct = Math.min(100, (absVal / maxScale) * 100);
          return (
            <div key={key} style={{ marginBottom: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{PD_LABELS[key]}</span>
                <span style={{ color: pdBarColor(key, val) }}>{val.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 2, height: 4 }}>
                <div style={{ width: `${pct}%`, background: pdBarColor(key, val), height: 4, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {effectLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Эффекты: </span>
          <span style={{ color: '#4caf50' }}>{effectLabels.join(' · ')}</span>
        </div>
      )}
      {riskLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Риски: </span>
          <span style={{ color: '#ff5252' }}>{riskLabels.join(' · ')}</span>
        </div>
      )}
    </div>
  );
};

interface DrugDose {
  substanceId: string;
  doseMg: number;
  frequencyDays: number[];
  totalWeeks: number;
}

const PKPDSimulationTab: React.FC = () => {
  const [drugDoses, setDrugDoses] = useState<DrugDose[]>([
    { substanceId: 'test_enan', doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 },
  ]);
  const [simResult, setSimResult] = useState<{ points: { week: number; cp: number; effect: number; tol: number }[]; peak: number; trough: number; ssDays: number } | null>(null);

  const allSubstances = Object.values(PHARMA_DB);

  const addDrug = () => {
    setDrugDoses([...drugDoses, { substanceId: 'test_enan', doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 }]);
  };

  const removeDrug = (idx: number) => {
    setDrugDoses(drugDoses.filter((_, i) => i !== idx));
  };

  const updateDrug = (idx: number, field: keyof DrugDose, value: string | number | number[]) => {
    const updated = [...drugDoses];
    updated[idx] = { ...updated[idx], [field]: value };
    setDrugDoses(updated);
  };

  const runSimulation = () => {
    const entries: CourseEntry[] = [];
    drugDoses.forEach((dd) => {
      const scheduleSet = new Set(dd.frequencyDays);
      for (let w = 0; w < dd.totalWeeks; w++) {
        for (let d = 1; d <= 7; d++) {
          if (scheduleSet.has(d)) {
            entries.push({
              id: `${dd.substanceId}-${w}-${d}`,
              substanceId: dd.substanceId,
              doseValue: dd.doseMg,
              doseUnit: 'mg',
              frequency: `${scheduleSet.size}x/week`,
              startWeek: 0,
              endWeek: dd.totalWeeks,
            });
          }
        }
      }
    });

    if (entries.length === 0) return;

    const superpositionResult = calculateMultiSubstancePKPD(entries, Math.max(...drugDoses.map(d => d.totalWeeks)));

    const firstDrug = PHARMA_DB[drugDoses[0].substanceId];
    let peak = 0;
    let trough = Infinity;
    let ssDays = 0;

    if (firstDrug) {
      const intervalH = (168 / drugDoses[0].frequencyDays.length);
      try {
        peak = steadyStatePeak({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
        trough = steadyStateTrough({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
      } catch { peak = 0; trough = 0; }

      const k = eliminationConstant(firstDrug.pk.halfLifeHours);
      ssDays = Math.ceil(5 * (firstDrug.pk.halfLifeHours / 24));
    }

    setSimResult({ points: superpositionResult, peak, trough, ssDays });
  };

  const chart = useMemo(() => {
    if (!simResult || simResult.points.length === 0) return null;
    const W = 600;
    const H = 200;
    const PAD = 30;
    const pts = simResult.points;
    const maxCp = Math.max(...pts.map(p => p.cp), 1);
    const maxWeek = pts[pts.length - 1].week;

    const toX = (w: number) => PAD + (w / maxWeek) * (W - 2 * PAD);
    const toY = (cp: number) => H - PAD - (cp / maxCp) * (H - 2 * PAD);

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.cp).toFixed(1)}`).join(' ');
    const effectPathD = pts.map((p, i) => {
      const ey = H - PAD - (p.effect / 100) * (H - 2 * PAD);
      return `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${ey.toFixed(1)}`;
    }).join(' ');

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const y = H - PAD - frac * (H - 2 * PAD);
      return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
    });

    const weekMarkers: string[] = [];
    const step = maxWeek <= 12 ? 1 : maxWeek <= 24 ? 2 : 4;
    for (let w = 0; w <= maxWeek; w += step) {
      const x = toX(w);
      weekMarkers.push(`<text x="${x}" y="${H - PAD + 14}" fill="var(--text-dim)" font-size="9" text-anchor="middle">${w}</text>`);
    }

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {gridLines.map((l, i) => <g key={i} dangerouslySetInnerHTML={{ __html: l }} />)}
        <path d={pathD} fill="none" stroke="var(--accent, #7c4dff)" strokeWidth="2" />
        <path d={effectPathD} fill="none" stroke="#4caf50" strokeWidth="1.5" strokeDasharray="4 2" />
        {weekMarkers.map((m, i) => <g key={`w${i}`} dangerouslySetInnerHTML={{ __html: m }} />)}
        <text x={PAD} y={12} fill="var(--accent)" fontSize="9">Сывороточная концентрация</text>
        <text x={W - PAD} y={12} fill="#4caf50" fontSize="9" textAnchor="end">Эффект %</text>
        <text x={W / 2} y={H - 2} fill="var(--text-dim)" fontSize="9" textAnchor="middle">Недели</text>
      </svg>
    );
  }, [simResult]);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {drugDoses.map((dd, idx) => (
          <div key={idx} className="card" style={{ padding: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <select
                value={dd.substanceId}
                onChange={(e) => updateDrug(idx, 'substanceId', e.target.value)}
                style={{ fontSize: 12, flex: 1, marginRight: 8 }}
              >
                {allSubstances.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {drugDoses.length > 1 && (
                <button className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => removeDrug(idx)}>✕</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Доза (мг)</label>
                <input type="number" value={dd.doseMg} onChange={(e) => updateDrug(idx, 'doseMg', Number(e.target.value))} style={{ width: '100%', fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дни инъекций</label>
                <input type="text" value={dd.frequencyDays.join(',')} onChange={(e) => updateDrug(idx, 'frequencyDays', e.target.value.split(',').map(Number).filter(n => n >= 1 && n <= 7))} style={{ width: '100%', fontSize: 12 }} placeholder="1,4" />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Недель</label>
                <input type="number" value={dd.totalWeeks} onChange={(e) => updateDrug(idx, 'totalWeeks', Number(e.target.value))} style={{ width: '100%', fontSize: 12 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={runSimulation}>Симуляция</button>
        <button className="btn" onClick={addDrug}>+ Препарат</button>
      </div>

      {simResult && (
        <div>
          <div className="card" style={{ fontSize: 12, marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><span style={{ color: 'var(--text-dim)' }}>Cmax стацион.:</span><br/><strong>{simResult.peak.toFixed(1)} мг/л</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Cmin стацион.:</span><br/><strong>{simResult.trough.toFixed(1)} мг/л</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Стацион. ≈:</span><br/><strong>{simResult.ssDays} дн</strong></div>
            </div>
            {simResult.peak > 50 && (
              <div style={{ color: '#ff1744', marginTop: 6, fontWeight: 600 }}>⚠ Высокая пиковая концентрация — риск побочных эффектов</div>
            )}
            {simResult.points.length > 0 && simResult.points[simResult.points.length - 1].tol > 0.3 && (
              <div style={{ color: '#ff9100', marginTop: 4 }}>⚠ Значительная толерантность ({(simResult.points[simResult.points.length - 1].tol * 100).toFixed(0)}%)</div>
            )}
          </div>
          <div className="card" style={{ padding: 4 }}>
            {chart}
          </div>
        </div>
      )}
    </div>
  );
};

const DosageCalculatorTab: React.FC = () => {
  const allPharma = Object.values(PHARMA_DB).filter((s) => s.class !== 'support' && s.class !== 'pct_serm' && s.class !== 'pct_aromatase' && s.class !== 'pct_dopamine');
  const [drug, setDrug] = useState('');
  const [mgKg, setMgKg] = useState(2);
  const [weight, setWeight] = useState(90);
  const [concentration, setConcentration] = useState(250);
  const [result, setResult] = useState<string | null>(null);

  const run = () => {
    if (!drug) return;
    const sub = PHARMA_DB[drug];
    const baseMg = mgKg * weight;
    const dose = calculateDose({
      targetDoseMg: baseMg,
      concentrationMgPerMl: concentration,
      roundingStepMl: 0.01,
      syringeVolumeMl: 1,
      divisionsPerMl: 100,
    });
    setResult(
      `${sub?.name ?? drug}\n` +
      `Базовая доза: ${baseMg.toFixed(1)} мг (${mgKg} мг/кг, вес ${weight} кг)\n` +
      `Объём инъекции: ${dose.volumeMl} мл\n` +
      `Деления шприца: ${dose.divisions}\n` +
      `Доз на флакон: ${dose.dosesPerVial || '—'}\n` +
      (dose.flags.length ? `⚠ ${dose.flags.join(', ')}` : '✓ Готово к введению')
    );
  };

  return (
    <div>
      <div className="card">
        <select value={drug} onChange={(e) => setDrug(e.target.value)}>
          <option value="">Выберите препарат</option>
          {allPharma.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({CLASS_LABELS[p.class] || p.class})</option>
          ))}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input type="number" value={mgKg} onChange={(e) => setMgKg(Number(e.target.value))} placeholder="мг/кг" />
          <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} placeholder="Вес (кг)" />
          <input type="number" value={concentration} onChange={(e) => setConcentration(Number(e.target.value))} placeholder="мг/мл" />
        </div>
        <button onClick={run} className="btn btn-primary">Рассчитать</button>
      </div>
      {result && <pre className="output" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{result}</pre>}
    </div>
  );
};

const InteractionCheckerTab: React.FC = () => {
  const allSubstances = Object.values(PHARMA_DB);
  const [selectedIds, setSelectedIds] = useState<string[]>(['', '']);

  const addDrug = () => setSelectedIds([...selectedIds, '']);
  const removeDrug = (idx: number) => setSelectedIds(selectedIds.filter((_, i) => i !== idx));
  const updateDrug = (idx: number, value: string) => {
    const updated = [...selectedIds];
    updated[idx] = value;
    setSelectedIds(updated);
  };

  const alerts = useMemo(() => {
    const validIds = selectedIds.filter(Boolean);
    if (validIds.length < 2) return null;

    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`,
      substanceId: id,
      doseValue: 300,
      doseUnit: 'mg/wk',
      frequency: '2x/week',
      startWeek: 0,
      endWeek: 12,
    }));

    return checkDrugInteractions(course);
  }, [selectedIds]);

  const hasAlerts = alerts && alerts.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {selectedIds.map((id, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8 }}>
            <select value={id} onChange={(e) => updateDrug(idx, e.target.value)} style={{ flex: 1, fontSize: 12 }}>
              <option value="">Выберите препарат</option>
              {allSubstances.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {selectedIds.length > 2 && (
              <button className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => removeDrug(idx)}>✕</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={addDrug}>+ Препарат</button>
      </div>

      {alerts === null && (
        <div className="card" style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          Выберите минимум 2 препарата для проверки взаимодействий
        </div>
      )}

      {alerts !== null && !hasAlerts && (
        <div className="card" style={{ fontSize: 12, color: '#4caf50', textAlign: 'center' }}>
          ✓ Критических взаимодействий не обнаружено
        </div>
      )}

      {hasAlerts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts!.map((alert, i) => (
            <div
              key={i}
              className="card"
              style={{
                borderLeft: `4px solid ${SEVERITY_COLORS[alert.type] || '#666'}`,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  color: SEVERITY_COLORS[alert.type],
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: `${SEVERITY_COLORS[alert.type]}22`,
                }}>
                  {alert.type === 'critical' ? 'КРИТИЧЕСКОЕ' : alert.type === 'warning' ? 'ПРЕДУПРЕЖДЕНИЕ' : 'ИНФО'}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  {alert.drugs.join(' + ')}
                </span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Механизм:</span> {alert.mechanism}
              </div>
              <div>
                <span style={{ fontWeight: 600 }}>Рекомендация:</span> {alert.recommendation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};