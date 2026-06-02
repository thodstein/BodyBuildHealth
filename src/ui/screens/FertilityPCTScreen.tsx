import React, { useState, useMemo } from 'react';
import { calcFertility } from '../../engines/fertility.engine';
import type { FertilityInput, FertilityResult } from '../../core/types';
import { FERTILITY_TARGET, FERTILITY_TAU_WEEKS } from '../../core/constants';

export const FertilityPCTScreen: React.FC = () => {
  const [volume, setVolume] = useState('');
  const [concentration, setConcentration] = useState('');
  const [totalCount, setTotalCount] = useState('');
  const [pr, setPr] = useState('');
  const [morphology, setMorphology] = useState('');
  const [ph, setPh] = useState('7.4');
  const [viscosity, setViscosity] = useState(false);
  const [mar, setMar] = useState('');
  const [leukocytes, setLeukocytes] = useState('');
  const [agglutination, setAgglutination] = useState(false);

  const input: FertilityInput = useMemo(() => ({
    volumeMl: parseFloat(volume) || 0,
    concentrationMlMln: parseFloat(concentration) || 0,
    totalCountMln: parseFloat(totalCount) || 0,
    prPercent: parseFloat(pr) || 0,
    morphologyPercent: parseFloat(morphology) || 0,
    ph: parseFloat(ph) || 7.4,
    viscosity,
    marPercent: parseFloat(mar) || undefined,
    leukocytesMlMln: parseFloat(leukocytes) || undefined,
    agglutination,
  }), [volume, concentration, totalCount, pr, morphology, ph, viscosity, mar, leukocytes, agglutination]);

  const result: FertilityResult = useMemo(() => calcFertility(input), [input]);

  const scoreColor = result.ifScore >= 60 ? '#4caf50' : result.ifScore >= 30 ? '#ff9800' : '#f44336';
  const scoreBg = result.ifScore >= 60 ? 'rgba(76,175,80,0.12)' : result.ifScore >= 30 ? 'rgba(255,152,0,0.12)' : 'rgba(244,67,54,0.12)';

  const recoveryPoints = useMemo(() => {
    const pts: { week: number; score: number }[] = [];
    const tau = FERTILITY_TAU_WEEKS;
    const target = FERTILITY_TARGET;
    for (let w = 0; w <= 24; w += 1) {
      const s = result.ifScore + (target - result.ifScore) * (1 - Math.exp(-w / tau));
      pts.push({ week: w, score: Math.round(s) });
    }
    return pts;
  }, [result.ifScore]);

  const chartW = 340;
  const chartH = 160;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxWeek = 24;
  const maxScore = 100;

  const toX = (week: number) => padL + (week / maxWeek) * plotW;
  const toY = (score: number) => padT + plotH - (score / maxScore) * plotH;

  const polyline = recoveryPoints.map(p => `${toX(p.week)},${toY(p.score)}`).join(' ');
  const areaPoints = recoveryPoints.map(p => `${toX(p.week)},${toY(p.score)}`).join(' ') + ` ${toX(maxWeek)},${toY(0)} ${toX(0)},${toY(0)}`;

  return (
    <div className="screen fertility-pct">
      <h2>Фертильность и ПКТ</h2>
      <p>Расчёт индекса фертильности (IF) по спермограмме</p>

      <h3>Параметры спермограммы</h3>

      <div className="form-group">
        <label>Объём эякулята (мл) <span className="ref">≥1.5</span></label>
        <input type="number" step="0.1" value={volume} onChange={e => setVolume(e.target.value)} placeholder="1.5" />
      </div>
      <div className="form-group">
        <label>Концентрация сперматозоидов (млн/мл) <span className="ref">≥16</span></label>
        <input type="number" step="0.1" value={concentration} onChange={e => setConcentration(e.target.value)} placeholder="16" />
      </div>
      <div className="form-group">
        <label>Общее количество (млн) <span className="ref">≥39</span></label>
        <input type="number" step="0.1" value={totalCount} onChange={e => setTotalCount(e.target.value)} placeholder="39" />
      </div>
      <div className="form-group">
        <label>Подвижность прогрессивная PR (%) <span className="ref">≥30</span></label>
        <input type="number" step="0.1" value={pr} onChange={e => setPr(e.target.value)} placeholder="30" />
      </div>
      <div className="form-group">
        <label>Морфология по Крюгеру (%) <span className="ref">≥4</span></label>
        <input type="number" step="0.1" value={morphology} onChange={e => setMorphology(e.target.value)} placeholder="4" />
      </div>
      <div className="form-group">
        <label>pH <span className="ref">7.2–8.0</span></label>
        <input type="number" step="0.1" value={ph} onChange={e => setPh(e.target.value)} placeholder="7.4" />
      </div>
      <div className="form-group checkbox-group">
        <label>
          <input type="checkbox" checked={viscosity} onChange={e => setViscosity(e.target.checked)} />
          Вязкость повышенная
        </label>
      </div>
      <div className="form-group">
        <label>MAR-тест (%) <span className="ref">&lt;50</span></label>
        <input type="number" step="0.1" value={mar} onChange={e => setMar(e.target.value)} placeholder="0" />
      </div>
      <div className="form-group">
        <label>Лейкоциты (млн/мл) <span className="ref">&lt;1</span></label>
        <input type="number" step="0.1" value={leukocytes} onChange={e => setLeukocytes(e.target.value)} placeholder="0" />
      </div>
      <div className="form-group checkbox-group">
        <label>
          <input type="checkbox" checked={agglutination} onChange={e => setAgglutination(e.target.checked)} />
          Агглютинация
        </label>
      </div>

      <div className="result-card" style={{ borderColor: scoreColor, background: scoreBg }}>
        <h3 style={{ color: scoreColor }}>Индекс фертильности: {result.ifScore}</h3>
        <p style={{ color: scoreColor }}>{result.interpretation}</p>
        <div className="if-bar-track">
          <div className="if-bar-fill" style={{ width: `${result.ifScore}%`, background: scoreColor }} />
        </div>
        <div className="forecast-row">
          <div className="forecast-item">
            <span className="forecast-label">Прогноз 6 нед:</span>
            <span className="forecast-value" style={{ color: result.forecast6w >= 60 ? '#4caf50' : result.forecast6w >= 30 ? '#ff9800' : '#f44336' }}>{result.forecast6w}</span>
          </div>
          <div className="forecast-item">
            <span className="forecast-label">Прогноз 12 нед:</span>
            <span className="forecast-value" style={{ color: result.forecast12w >= 60 ? '#4caf50' : result.forecast12w >= 30 ? '#ff9800' : '#f44336' }}>{result.forecast12w}</span>
          </div>
        </div>
      </div>

      <div className="recovery-chart">
        <h3>Прогноз восстановления фертильности</h3>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="chart-svg">
          <line x1={padL} y1={toY(100)} x2={padL + plotW} y2={toY(100)} className="chart-gridline" />
          <line x1={padL} y1={toY(75)} x2={padL + plotW} y2={toY(75)} className="chart-gridline" />
          <line x1={padL} y1={toY(50)} x2={padL + plotW} y2={toY(50)} className="chart-gridline" />
          <line x1={padL} y1={toY(25)} x2={padL + plotW} y2={toY(25)} className="chart-gridline" />
          <line x1={padL} y1={toY(0)} x2={padL + plotW} y2={toY(0)} className="chart-axis" />
          <text x={padL - 4} y={toY(100) + 4} textAnchor="end" className="chart-label">100</text>
          <text x={padL - 4} y={toY(75) + 4} textAnchor="end" className="chart-label">75</text>
          <text x={padL - 4} y={toY(50) + 4} textAnchor="end" className="chart-label">50</text>
          <text x={padL - 4} y={toY(25) + 4} textAnchor="end" className="chart-label">25</text>
          <text x={padL - 4} y={toY(0) + 4} textAnchor="end" className="chart-label">0</text>
          <text x={toX(0)} y={chartH - 4} textAnchor="middle" className="chart-label">0</text>
          <text x={toX(6)} y={chartH - 4} textAnchor="middle" className="chart-label">6</text>
          <text x={toX(12)} y={chartH - 4} textAnchor="middle" className="chart-label">12</text>
          <text x={toX(18)} y={chartH - 4} textAnchor="middle" className="chart-label">18</text>
          <text x={toX(24)} y={chartH - 4} textAnchor="middle" className="chart-label">24</text>
          <text x={chartW / 2} y={chartH} textAnchor="middle" className="chart-axis-label">Недели</text>
          <line x1={padL} y1={toY(0)} x2={padL} y2={toY(100)} className="chart-axis" />
          <polygon points={areaPoints} className="chart-area" style={{ fill: scoreColor, opacity: 0.15 }} />
          <polyline points={polyline} fill="none" stroke={scoreColor} strokeWidth={2} className="chart-line" />
          <line x1={padL} y1={toY(60)} x2={padL + plotW} y2={toY(60)} stroke="#4caf50" strokeWidth={1} strokeDasharray="4,3" />
          <text x={padL + plotW + 2} y={toY(60) + 4} fill="#4caf50" className="chart-threshold">60</text>
          <line x1={padL} y1={toY(30)} x2={padL + plotW} y2={toY(30)} stroke="#ff9800" strokeWidth={1} strokeDasharray="4,3" />
          <text x={padL + plotW + 2} y={toY(30) + 4} fill="#ff9800" className="chart-threshold">30</text>
          {result.forecast6w !== result.ifScore && (
            <circle cx={toX(6)} cy={toY(result.forecast6w)} r={4} fill={scoreColor} className="chart-dot" />
          )}
          <circle cx={toX(12)} cy={toY(result.forecast12w)} r={4} fill={scoreColor} className="chart-dot" />
          <circle cx={toX(0)} cy={toY(result.ifScore)} r={4} fill={scoreColor} className="chart-dot" />
        </svg>
      </div>

      <div className="pct-recommendations">
        <h3>Рекомендации по ПКТ и восстановлению фертильности</h3>

        <div className="rec-section">
          <h4>HCG на цикле</h4>
          <p>500–1000 МЕ 2–3 раза в неделю начиная с 3-й недели цикла для предотвращения атрофии яичек.</p>
        </div>

        <div className="rec-section">
          <h4>ПКТ: Кломифен</h4>
          <p>Кломифен 50 мг/день — 2 недели, затем 25 мг/день — 2 недели.</p>
        </div>

        <div className="rec-section">
          <h4>ПКТ: Тамоксифен (альтернатива)</h4>
          <p>Тамоксифен 20 мг/день — 4 недели.</p>
        </div>

        <div className="rec-section">
          <h4>HCG в ПКТ</h4>
          <p>HCG 2000 МЕ через день — первые 2 недели ПКТ.</p>
        </div>

        <div className="rec-section">
          <h4>Нутритивная поддержка</h4>
          <ul>
            <li>Цинк — 30 мг/день</li>
            <li>Селен — 100 мкг/день</li>
            <li>Витамин E — 400 МЕ/день</li>
            <li>L-карнитин — 1 г/день</li>
            <li>CoQ10 — 200 мг/день</li>
          </ul>
        </div>

        <div className="rec-section">
          <h4>Образ жизни</h4>
          <ul>
            <li>Отказ от ААС на 3–6 месяцев</li>
            <li>Нормализация сна (7–9 часов)</li>
            <li>Снижение стресса</li>
          </ul>
        </div>
      </div>
    </div>
  );
};