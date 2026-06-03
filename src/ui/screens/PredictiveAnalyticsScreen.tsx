import React, { useState, useEffect } from 'react';
import { calculateRisks } from '../../engines/risk.engine';
import { generateReadinessForecast, predictLabTrend, runWhatIf } from '../../engines/predictive.engine';
import type { RiskInput, RiskResult } from '../../core/types';
import type { ForecastResult, LabForecast } from '../../engines/predictive.engine';
import { useDataLink, getLatestLabValue } from '../../core/data-link';

const SCENARIO_NAMES: Record<string, string> = {
  'Baseline': 'Базовый',
  'High Risk Cycle': 'Высокорисковый курс',
  'Optimized Protocol': 'Оптимизированный протокол',
  'Post Cycle Therapy': 'ПКТ (послекурсовая терапия)',
};

const SYSTEM_LABELS: Record<string, string> = {
  hepatic: 'Печень',
  cardio: 'Сердечно-сосудистая',
  endocrine: 'Эндокринная',
  renal: 'Почки',
  hematologic: 'Кроветворение',
  neuro: 'Нервная',
  reproductive: 'Репродуктивная',
  musculoskeletal: 'Суставы и связки',
};

export const PredictiveAnalyticsScreen: React.FC = () => {
  const { profile, labs, activeDrugs, supportCoverage, readiness } = useDataLink();
  const [riskInput, setRiskInput] = useState<RiskInput>({
    genetics: profile.settings.genetics ?? {},
    activeDrugs,
    biomarkerValues: {},
    hgiMarkers: {},
    nutritionFactor: profile.settings.nutritionFactor ?? 1.0,
    trainingFactor: profile.settings.trainingFactor ?? 1.0,
    interventionResponse: 0.5,
    supportCoverage
  });

  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState('Baseline');

  const predefinedScenarios = {
    'Baseline': {
      genetics: {},
      activeDrugs: {},
      biomarkerValues: {},
      hgiMarkers: {},
      nutritionFactor: 1.0,
      trainingFactor: 1.0,
      interventionResponse: 0.5,
      supportCoverage: {}
    },
    'High Risk Cycle': {
      genetics: { hepatic: 'Mut/Mut', cardio: 'Mut/Mut' },
      activeDrugs: {
        'testosterone-enanthate': { dosePerWeek: 500 },
        'trenbolone-acetate': { dosePerWeek: 300 },
        'oral-stanozolol': { dosePerWeek: 50 }
      },
      biomarkerValues: {
        hepatic: 2.5,
        lipid: 2.8,
        cardio: 1.4
      },
      hgiMarkers: { inflammation: 1.8, immune: 1.6 },
      nutritionFactor: 0.8,
      trainingFactor: 1.3,
      interventionResponse: 0.3,
      supportCoverage: {}
    },
    'Optimized Protocol': {
      genetics: { hepatic: 'Val/Val', cardio: 'Val/Val' },
      activeDrugs: {
        'testosterone-enanthate': { dosePerWeek: 250 },
        'support-samarin': { dosePerWeek: 0 }
      },
      biomarkerValues: {
        hepatic: 0.9,
        lipid: 1.0,
        cardio: 0.9
      },
      hgiMarkers: { inflammation: 0.7, immune: 0.8 },
      nutritionFactor: 1.2,
      trainingFactor: 1.0,
      interventionResponse: 0.8,
      supportCoverage: {
        'hepatic_1': 0.3,
        'lipid_1': 0.2
      }
    },
    'Post Cycle Therapy': {
      genetics: {},
      activeDrugs: {
        'pct-clomiphene': { dosePerWeek: 100 },
        'pct-tamoxifen': { dosePerWeek: 40 }
      },
      biomarkerValues: {
        endocrine: 1.2,
        hepatic: 1.1
      },
      hgiMarkers: { inflammation: 0.9, immune: 0.9 },
      nutritionFactor: 1.1,
      trainingFactor: 0.8,
      interventionResponse: 0.7,
      supportCoverage: {}
    }
  };

  const handleCalculateRisks = () => {
    setLoading(true);
    try {
      const result = calculateRisks(riskInput);
      setRiskResult(result);
    } catch (error) {
      console.error('Ошибка расчёта рисков:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioChange = (scenario: keyof typeof predefinedScenarios) => {
    setScenarioName(scenario);
    setRiskInput(predefinedScenarios[scenario]);
    handleCalculateRisks();
  };

  const handleInputChange = <K extends keyof RiskInput>(
    key: K,
    value: React.SetStateAction<RiskInput[K]>
  ) => {
    setRiskInput(prev => ({
      ...prev,
      [key]: typeof value === 'function' ? value(prev[key]) : value
    }));
  };

  useEffect(() => {
    handleCalculateRisks();
  }, [riskInput]);

  return (
    <div className="screen predictive-analytics">
      <h2>Предиктивная аналитика — Сценарии «Что если»</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Выбор сценария</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(predefinedScenarios).map((scenario) => (
            <button
              key={scenario}
              onClick={() => handleScenarioChange(scenario as keyof typeof predefinedScenarios)}
              className={scenarioName === scenario ? 'btn' : 'btn secondary'}
              style={{ flex: 1, minWidth: 120 }}
            >
              {SCENARIO_NAMES[scenario] || scenario}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Входные параметры рисков</h3>
        <div className="grid">
          <div>
            <h4>Генетические факторы</h4>
            <div style={{ display: 'grid', gap: 4 }}>
              <div>
                <label>Печень:</label>
                <select
                  onChange={(e) => handleInputChange('genetics', (prev) => ({
                    ...prev,
                    hepatic: e.target.value as any
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="Val/Val">Val/Val (Норма)</option>
                  <option value="Val/Mut">Val/Mut (Умеренный)</option>
                  <option value="Mut/Mut">Mut/Mut (Высокий риск)</option>
                </select>
              </div>
              <div>
                <label>Сердечно-сосудистая:</label>
                <select
                  onChange={(e) => handleInputChange('genetics', (prev) => ({
                    ...prev,
                    cardio: e.target.value as any
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="Val/Val">Val/Val (Норма)</option>
                  <option value="Val/Mut">Val/Mut (Умеренный)</option>
                  <option value="Mut/Mut">Mut/Mut (Высокий риск)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h4>Факторы образа жизни</h4>
            <div style={{ display: 'grid', gap: 4 }}>
              <div>
                <label>Качество питания:</label>
                <input
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={riskInput.nutritionFactor || 1.0}
                  onChange={(e) => handleInputChange('nutritionFactor', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  1.0 = среднее, {'>'}1.0 = хорошее, {'<'}1.0 = плохое
                </p>
              </div>
              <div>
                <label>Интенсивность тренировок:</label>
                <input
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={riskInput.trainingFactor || 1.0}
                  onChange={(e) => handleInputChange('trainingFactor', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  1.0 = средняя, {'>'}1.0 = высокая, {'<'}1.0 = низкая
                </p>
              </div>
              <div>
                <label>Ответ на вмешательства:</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={riskInput.interventionResponse || 0.5}
                  onChange={(e) => handleInputChange('interventionResponse', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Насколько хорошо организм реагирует на вмешательства (0–1)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Расчёт рисков...</p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Результаты анализа рисков</h3>
          {riskResult ? (
            <>
              <div className="row">
                <span className="label">Общий базовый риск:</span>
                <span className="value">
                  {riskResult.overallRaw?.toFixed(1)}%
                </span>
              </div>
              <div className="row">
                <span className="label">Общий скорректированный риск:</span>
                <span className="value">
                  {riskResult.overallNet?.toFixed(1)}%
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4>Разбивка по системам:</h4>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {Object.entries(riskResult.systemBreakdown || {}).map(([system, values]) => (
                    <div key={system} className="card" style={{ padding: 12, margin: 0 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{SYSTEM_LABELS[system] || system}</h4>
                      <div className="row">
                        <span className="label">Базовый:</span>
                        <span className="value">
                          {values.raw?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="row">
                        <span className="label">Скорректированный:</span>
                        <span className="value">
                          {values.net?.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                        Снижение риска: {(values.raw! > 0 ? ((1 - values.net! / values.raw!) * 100) : 0).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p>Данные о рисках отсутствуют</p>
          )}
        </div>
      )}

      <div className="card">
        <h3>Анализ «Что если»</h3>
        <p style={{ marginBottom: 12 }}>
          Измените любой параметр выше, чтобы увидеть, как это влияет на ваш профиль рисков в реальном времени.
          Это позволяет тестировать различные протоколы, добавки или изменения образа жизни до их реализации.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={handleCalculateRisks} className="btn">
            Пересчитать риски
          </button>
          <button
            onClick={() => handleScenarioChange('Baseline')}
            className="btn secondary"
          >
            Сбросить к базовому
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Прогноз готовности (7 дней)</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Модель Хольта: прогноз на основе последних данных готовности.</p>
        <ReadinessForecastBlock initialHistory={readiness ? [readiness.recovery] : undefined} />
      </div>

      <div className="card">
        <h3>Тренд лабораторных показателей</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Прогноз по данным анализов (HCT, АЛТ, и др.).</p>
        <LabTrendBlock initialPoints={labs.length > 0 ? labs.slice(-7).map(l => l.value) : undefined} />
      </div>
    </div>
  );
};

const ReadinessForecastBlock: React.FC<{ initialHistory?: number[] }> = ({ initialHistory }) => {
  const [history, setHistory] = useState<number[]>(initialHistory ?? [65, 68, 70, 72, 69, 71, 73]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);

  const calc = () => {
    setForecast(generateReadinessForecast(history));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {history.map((v, i) => (
          <input key={i} type="number" value={v} onChange={e => { const h = [...history]; h[i] = +e.target.value; setHistory(h); }} style={{ width: 48, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }} />
        ))}
      </div>
      <button onClick={calc} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Рассчитать прогноз</button>
      {forecast && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {forecast.values.map((v, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center', minWidth: 48 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Д+{i + 1}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>[{forecast.ci95[i][0]}–{forecast.ci95[i][1]}]</div>
              </div>
            ))}
          </div>
          {forecast.warnings.length > 0 && forecast.warnings.map((w, i) => <div key={i} style={{ fontSize: 11, color: '#FF9800', marginTop: 6 }}>{w}</div>)}
        </div>
      )}
    </div>
  );
};

const LabTrendBlock: React.FC<{ initialPoints?: number[] }> = ({ initialPoints }) => {
  const [points, setPoints] = useState<number[]>(initialPoints ?? [42, 44, 46, 48]);
  const [forecast, setForecast] = useState<LabForecast | null>(null);

  const calc = () => {
    setForecast(predictLabTrend(points));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {points.map((v, i) => (
          <input key={i} type="number" value={v} onChange={e => { const p = [...points]; p[i] = +e.target.value; setPoints(p); }} style={{ width: 48, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }} />
        ))}
      </div>
      <button onClick={calc} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Спрогнозировать тренд</button>
      {forecast && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.current}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Сейчас</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.w4}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>4 нед</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.w8}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>8 нед</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.w12}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>12 нед</div>
            </div>
          </div>
          {forecast.alert && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{forecast.alert}</div>}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>95% CI через 4 нед: [{forecast.ci95w4[0]}–{forecast.ci95w4[1]}] | 12 нед: [{forecast.ci95w12[0]}–{forecast.ci95w12[1]}]</div>
        </div>
      )}
    </div>
  );
};