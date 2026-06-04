import React, { useState, useMemo, useEffect } from 'react';
import { calcFertility } from '../../engines/fertility.engine';
import type { FertilityInput, FertilityResult, LabPoint } from '../../core/types';
import { FERTILITY_TARGET, FERTILITY_TAU_WEEKS } from '../../core/constants';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';

type FertTab = 'semen' | 'hormones' | 'structure';

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 },
  label: { fontSize: 11, opacity: 0.7, marginBottom: 2 },
  input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 14, boxSizing: 'border-box' as const },
  btn: { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, cursor: 'pointer' },
  btnActive: { padding: '6px 12px', borderRadius: 8, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.15)', color: '#00e68a', fontSize: 12, cursor: 'pointer' },
  barTrack: { height: 10, borderRadius: 5, background: 'var(--border)', overflow: 'hidden', margin: '4px 0' },
  check: { width: 18, height: 18, accentColor: '#00e68a' },
};

const VARICOCELE = [
  { id: 'none', label: 'Нет' }, { id: 'grade1', label: '1 степень' },
  { id: 'grade2', label: '2 степень' }, { id: 'grade3', label: '3 степень' }
] as const;

export const FertilityPCTScreen: React.FC = () => {
  const [tab, setTab] = useState<FertTab>('semen');

  const [volume, setVolume] = useState('');
  const [concentration, setConcentration] = useState('');
  const [totalCount, setTotalCount] = useState('');
  const [pr, setPr] = useState('');
  const [np, setNp] = useState('');
  const [immotile, setImmotile] = useState('');
  const [morphology, setMorphology] = useState('');
  const [viability, setViability] = useState('');
  const [ph, setPh] = useState('7.4');
  const [viscosity, setViscosity] = useState(false);
  const [mar, setMar] = useState('');
  const [leukocytes, setLeukocytes] = useState('');
  const [agglutination, setAgglutination] = useState(false);
  const [fructose, setFructose] = useState('');
  const [zincMmol, setZincMmol] = useState('');
  const [dfi, setDfi] = useState('');
  const [varicocele, setVaricocele] = useState<'none' | 'grade1' | 'grade2' | 'grade3'>('none');

  const [tt, setTt] = useState('');
  const [ft, setFt] = useState('');
  const [e2, setE2] = useState('');
  const [lh, setLh] = useState('');
  const [fsh, setFsh] = useState('');
  const [prl, setPrl] = useState('');
  const [shbg, setShbg] = useState('');
  const [inhb, setInhb] = useState('');
  const [amh, setAmh] = useState('');

  useEffect(() => {
    const loadLabs = async () => {
      try {
        const profile = getProfile();
        const entries = await db.getAll<LabPoint>('labs_log');
        const codeMap: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
          TT: setTt, FT: setFt, E2: setE2, LH: setLh, FSH: setFsh,
          PRL: setPrl, SHBG: setShbg, INHB: setInhb, AMH: setAmh
        };
        const codeToKey: Record<string, string> = { TT: 'ng/dL', FT: 'pg/mL', E2: 'pg/mL', LH: 'mIU/mL', FSH: 'mIU/mL', PRL: 'ng/mL', SHBG: 'nmol/L', INHB: 'pg/mL', AMH: 'ng/mL' };
        entries
          .filter(e => e.patientId === (profile.id || 'current-user'))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .forEach(e => {
            const setter = codeMap[e.code];
            if (setter && e.value !== undefined) setter(String(e.value));
          });
      } catch {}
    };
    loadLabs();
  }, []);

  const input: FertilityInput = useMemo(() => ({
    volumeMl: parseFloat(volume) || 0,
    concentrationMlMln: parseFloat(concentration) || 0,
    totalCountMln: parseFloat(totalCount) || 0,
    prPercent: parseFloat(pr) || 0,
    npPercent: parseFloat(np) || undefined,
    immotilePercent: parseFloat(immotile) || undefined,
    morphologyPercent: parseFloat(morphology) || 0,
    viabilityPercent: parseFloat(viability) || undefined,
    ph: parseFloat(ph) || 7.4,
    viscosity,
    marPercent: parseFloat(mar) || undefined,
    leukocytesMlMln: parseFloat(leukocytes) || undefined,
    agglutination,
    fructose: parseFloat(fructose) || undefined,
    zincMmol: parseFloat(zincMmol) || undefined,
    dfi: parseFloat(dfi) || undefined,
    varicocele,
    lh: parseFloat(lh) || undefined,
    fsh: parseFloat(fsh) || undefined,
    tt: parseFloat(tt) || undefined,
    ft: parseFloat(ft) || undefined,
    e2: parseFloat(e2) || undefined,
    prl: parseFloat(prl) || undefined,
    shbg: parseFloat(shbg) || undefined,
    inhb: parseFloat(inhb) || undefined,
    amh: parseFloat(amh) || undefined,
  }), [volume, concentration, totalCount, pr, np, immotile, morphology, viability, ph, viscosity, mar, leukocytes, agglutination, fructose, zincMmol, dfi, varicocele, tt, ft, e2, lh, fsh, prl, shbg, inhb, amh]);

  const result: FertilityResult = useMemo(() => calcFertility(input), [input]);

  const scoreColor = result.ifScore >= 60 ? '#00e68a' : result.ifScore >= 30 ? '#ff9800' : '#f44336';
  const scoreBg = result.ifScore >= 60 ? 'rgba(0,230,138,0.12)' : result.ifScore >= 30 ? 'rgba(255,152,0,0.12)' : 'rgba(244,67,54,0.12)';

  const recoveryPoints = useMemo(() => {
    const pts: { week: number; score: number }[] = [];
    const tau = FERTILITY_TAU_WEEKS;
    const target = FERTILITY_TARGET;
    for (let w = 0; w <= 24; w += 1) {
      pts.push({ week: w, score: Math.round(result.ifScore + (target - result.ifScore) * (1 - Math.exp(-w / tau))) });
    }
    return pts;
  }, [result.ifScore]);

  const chartW = 340, chartH = 160, padL = 36, padR = 12, padT = 12, padB = 28;
  const plotW = chartW - padL - padR, plotH = chartH - padT - padB;
  const maxWeek = 24, maxScore = 100;
  const toX = (w: number) => padL + (w / maxWeek) * plotW;
  const toY = (sc: number) => padT + plotH - (sc / maxScore) * plotH;
  const polyline = recoveryPoints.map(p => `${toX(p.week)},${toY(p.score)}`).join(' ');
  const areaPoints = polyline + ` ${toX(maxWeek)},${toY(0)} ${toX(0)},${toY(0)}`;

  const field = (label: string, val: string, set: React.Dispatch<React.SetStateAction<string>>, placeholder: string, step = '0.1') => (
    <div className="form-group">
      <label>{label}</label>
      <input type="number" step={step} value={val} onChange={e => set(e.target.value)} placeholder={placeholder} />
    </div>
  );

  const fertTabs: { id: FertTab; label: string }[] = [
    { id: 'semen', label: 'Спермограмма' }, { id: 'hormones', label: 'Гормоны крови' }, { id: 'structure', label: 'DFI/Структура' }
  ];

  return (
    <div className="screen fertility-pct">
      <h2>Фертильность и ПКТ</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {fertTabs.map(t => <button key={t.id} className={`tab-button ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'semen' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>Спермограмма расширенная</h4>
          <div style={s.row}>
            <div>{field('Объём (мл) ≥1.5', volume, setVolume, '1.5')}</div>
            <div>{field('Концентрация (млн/мл) ≥16', concentration, setConcentration, '16')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Общее кол-во (млн) ≥39', totalCount, setTotalCount, '39')}</div>
            <div>{field('PR подвижность (%) ≥30', pr, setPr, '30')}</div>
          </div>
          <div style={s.row}>
            <div>{field('NP подвижность (%)', np, setNp, '10')}</div>
            <div>{field('Неподвижные (%)', immotile, setImmotile, '0')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Морфология (%) ≥4', morphology, setMorphology, '4')}</div>
            <div>{field('Жизнеспособность (%) ≥58', viability, setViability, '58')}</div>
          </div>
          <div style={s.row}>
            <div>{field('pH 7.2–8.0', ph, setPh, '7.4')}</div>
            <div>{field('Фруктоза (мг/дл)', fructose, setFructose, '13')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Цинк (ммоль/эякулят)', zincMmol, setZincMmol, '2')}</div>
            <div>{field('MAR-тест (%) <50', mar, setMar, '0')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Лейкоциты (млн/мл) <1', leukocytes, setLeukocytes, '0')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label><input type="checkbox" style={s.check} checked={viscosity} onChange={e => setViscosity(e.target.checked)} /> Вязкость</label>
              <label><input type="checkbox" style={s.check} checked={agglutination} onChange={e => setAgglutination(e.target.checked)} /> Агглютинация</label>
            </div>
          </div>
        </div>
      )}

      {tab === 'hormones' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>Гормоны крови (10 маркеров)</h4>
          <p style={{ fontSize: 11, opacity: 0.6, margin: '0 0 8px' }}>Автозаполнение из LabsScreen</p>
          <div style={s.row}>
            <div>{field('ЛГ (мМЕ/мл)', lh, setLh, '5')}</div>
            <div>{field('ФСГ (мМЕ/мл)', fsh, setFsh, '4')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Тестостерон (нг/дл)', tt, setTt, '500')}</div>
            <div>{field('Тестостерон свободный (пг/мл)', ft, setFt, '15')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Эстрадиол (пг/мл)', e2, setE2, '25')}</div>
            <div>{field('Пролактин (нг/мл)', prl, setPrl, '8')}</div>
          </div>
          <div style={s.row}>
            <div>{field('ГСПГ (нмоль/л)', shbg, setShbg, '30')}</div>
            <div>{field('Ингибин Б (пг/мл)', inhb, setInhb, '150')}</div>
          </div>
          <div style={s.row}>
            <div>{field('АМГ (нг/мл)', amh, setAmh, '4')}</div>
            <div></div>
          </div>
        </div>
      )}

      {tab === 'structure' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>DFI и структурные факторы</h4>
          <div style={s.row}>
            <div>{field('DFI (%) ≤15 норма', dfi, setDfi, '0')}</div>
            <div>
              <span style={s.label}>Варикоцеле</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {VARICOCELE.map(v => <button key={v.id} style={varicocele === v.id ? s.btnActive : s.btn} onClick={() => setVaricocele(v.id)}>{v.label}</button>)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...s.card, borderColor: scoreColor, background: scoreBg, border: `1px solid ${scoreColor}` }}>
        <h3 style={{ color: scoreColor, margin: '0 0 8px' }}>Индекс фертильности: {result.ifScore}</h3>
        <p style={{ color: scoreColor, margin: '0 0 4px' }}>{result.interpretation}</p>
        <div style={s.barTrack}>
          <div style={{ height: '100%', borderRadius: 5, background: scoreColor, width: `${result.ifScore}%`, transition: 'width 0.3s' }} />
        </div>

        {result.spermIndex !== undefined && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Суб-индексы IF v2</h4>
            {[
              { label: 'Спермограмма (55%)', value: result.spermIndex },
              { label: 'Гормоны (30%)', value: result.hormonalIndex ?? 0 },
              { label: 'Структура (15%)', value: result.structuralIndex ?? 0 },
            ].map(si => (
              <div key={si.label} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{si.label}</span>
                  <span style={{ fontWeight: 600 }}>{si.value}</span>
                </div>
                <div style={s.barTrack}>
                  <div style={{ height: '100%', borderRadius: 5, background: si.value >= 60 ? '#00e68a' : si.value >= 30 ? '#ff9800' : '#f44336', width: `${si.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {result.warnings && result.warnings.length > 0 && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(244,67,54,0.15)', border: '1px solid #f44336' }}>
            {result.warnings.map(w => <div key={w} style={{ fontSize: 12, color: '#f44336' }}>{w}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: result.forecast6w >= 60 ? '#00e68a' : '#ff9800' }}>{result.forecast6w}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Прогноз 6 нед</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: result.forecast12w >= 60 ? '#00e68a' : '#ff9800' }}>{result.forecast12w}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Прогноз 12 нед</div>
          </div>
        </div>
      </div>

      <div style={s.card}>
        <h4 style={{ margin: '0 0 8px' }}>Прогноз восстановления</h4>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', maxWidth: 380 }}>
          {[0, 25, 50, 75, 100].map(v => <line key={v} x1={padL} y1={toY(v)} x2={padL + plotW} y2={toY(v)} stroke="var(--border)" strokeWidth={0.5} />)}
          {[0, 6, 12, 18, 24].map(w => <text key={w} x={toX(w)} y={chartH - 4} textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>{w}</text>)}
          <text x={chartW / 2} y={chartH} textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>Недели</text>
          <polygon points={areaPoints} fill={scoreColor} opacity={0.15} />
          <polyline points={polyline} fill="none" stroke={scoreColor} strokeWidth={2} />
          <line x1={padL} y1={toY(60)} x2={padL + plotW} y2={toY(60)} stroke="#00e68a" strokeWidth={1} strokeDasharray="4,3" />
          <line x1={padL} y1={toY(30)} x2={padL + plotW} y2={toY(30)} stroke="#ff9800" strokeWidth={1} strokeDasharray="4,3" />
          <circle cx={toX(0)} cy={toY(result.ifScore)} r={4} fill={scoreColor} />
          <circle cx={toX(12)} cy={toY(result.forecast12w)} r={4} fill={scoreColor} />
        </svg>
      </div>

      <div style={s.card}>
        <h4 style={{ margin: '0 0 8px' }}>Рекомендации по ПКТ и восстановлению</h4>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <h5>HCG на цикле</h5>
          <p>500–1000 МЕ 2–3 раза в неделю начиная с 3-й недели цикла.</p>
          <h5>ПКТ: Кломифен</h5>
          <p>50 мг/день — 2 нед, затем 25 мг/день — 2 нед.</p>
          <h5>ПКТ: Тамоксифен (альтернатива)</h5>
          <p>20 мг/день — 4 недели.</p>
          <h5>Нутритивная поддержка</h5>
          <ul><li>Цинк 30 мг/день</li><li>Селен 100 мкг/день</li><li>L-карнитин 1 г/день</li><li>CoQ10 200 мг/день</li><li>Витамин E 400 МЕ/день</li></ul>
        </div>
      </div>
    </div>
  );
};