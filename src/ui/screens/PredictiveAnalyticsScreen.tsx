import React, { useState, useEffect } from 'react';
import { calculateRisks } from '../../engines/risk.engine';
import { generateReadinessForecast, predictLabTrend, runWhatIf } from '../../engines/predictive.engine';
import type { RiskInput, RiskResult } from '../../core/types';
import type { ForecastResult, LabForecast } from '../../engines/predictive.engine';
import { useDataLink, getLatestLabValue } from '../../core/data-link';

const SCENARIO_NAMES: Record<string, string> = {
  'Baseline': '',
  'High Risk Cycle': '',
  'Optimized Protocol': '',
  'Post Cycle Therapy': '',
};

const SYSTEM_LABELS: Record<string, string> = {
  hepatic: '',
  cardio: '',
  endocrine: '',
  renal: '',
  hematologic: '',
  neuro: '',
  reproductive: '',
  musculoskeletal: '',
  metabolic: '',
  ghigf: '',
  ins_axis: '',
  neuro_toxicity: '',
  blood: '',
  vessels: '',
  immunity: '',
  thyroid: '',
  prostate: '',
  skin: '',
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
      console.error('', error);
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
      <h2>РџСЂРµРґРёРєС‚РёРІРЅР°СЏ Р°РЅР°Р»РёС‚РёРєР° вЂ” РЎС†РµРЅР°СЂРёРё В«Р§С‚Рѕ РµСЃР»РёВ»</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Р’С‹Р±РѕСЂ СЃС†РµРЅР°СЂРёСЏ</h3>
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
        <h3>Р’С…РѕРґРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ СЂРёСЃРєРѕРІ</h3>
        <div className="grid">
          <div>
            <h4>Р“РµРЅРµС‚РёС‡РµСЃРєРёРµ С„Р°РєС‚РѕСЂС‹</h4>
            <div style={{ display: 'grid', gap: 4 }}>
              <div>
                <label>РџРµС‡РµРЅСЊ:</label>
                <select
                  onChange={(e) => handleInputChange('genetics', (prev) => ({
                    ...prev,
                    hepatic: e.target.value as any
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="Val/Val">Val/Val (РќРѕСЂРјР°)</option>
                  <option value="Val/Mut">Val/Mut (РЈРјРµСЂРµРЅРЅС‹Р№)</option>
                  <option value="Mut/Mut">Mut/Mut (Р’С‹СЃРѕРєРёР№ СЂРёСЃРє)</option>
                </select>
              </div>
              <div>
                <label>РЎРµСЂРґРµС‡РЅРѕ-СЃРѕСЃСѓРґРёСЃС‚Р°СЏ:</label>
                <select
                  onChange={(e) => handleInputChange('genetics', (prev) => ({
                    ...prev,
                    cardio: e.target.value as any
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="Val/Val">Val/Val (РќРѕСЂРјР°)</option>
                  <option value="Val/Mut">Val/Mut (РЈРјРµСЂРµРЅРЅС‹Р№)</option>
                  <option value="Mut/Mut">Mut/Mut (Р’С‹СЃРѕРєРёР№ СЂРёСЃРє)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h4>Р¤Р°РєС‚РѕСЂС‹ РѕР±СЂР°Р·Р° Р¶РёР·РЅРё</h4>
            <div style={{ display: 'grid', gap: 4 }}>
              <div>
                <label>РљР°С‡РµСЃС‚РІРѕ РїРёС‚Р°РЅРёСЏ:</label>
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
                  1.0 = СЃСЂРµРґРЅРµРµ, {'>'}1.0 = С…РѕСЂРѕС€РµРµ, {'<'}1.0 = РїР»РѕС…РѕРµ
                </p>
              </div>
              <div>
                <label>РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ С‚СЂРµРЅРёСЂРѕРІРѕРє:</label>
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
                  1.0 = СЃСЂРµРґРЅСЏСЏ, {'>'}1.0 = РІС‹СЃРѕРєР°СЏ, {'<'}1.0 = РЅРёР·РєР°СЏ
                </p>
              </div>
              <div>
                <label>РћС‚РІРµС‚ РЅР° РІРјРµС€Р°С‚РµР»СЊСЃС‚РІР°:</label>
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
                  РќР°СЃРєРѕР»СЊРєРѕ С…РѕСЂРѕС€Рѕ РѕСЂРіР°РЅРёР·Рј СЂРµР°РіРёСЂСѓРµС‚ РЅР° РІРјРµС€Р°С‚РµР»СЊСЃС‚РІР° (0вЂ“1)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Р Р°СЃС‡С‘С‚ СЂРёСЃРєРѕРІ...</p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Р РµР·СѓР»СЊС‚Р°С‚С‹ Р°РЅР°Р»РёР·Р° СЂРёСЃРєРѕРІ</h3>
          {riskResult ? (
            <>
              <div className="row">
                <span className="label">РћР±С‰РёР№ Р±Р°Р·РѕРІС‹Р№ СЂРёСЃРє:</span>
                <span className="value">
                  {riskResult.overallRaw?.toFixed(1)}%
                </span>
              </div>
              <div className="row">
                <span className="label">РћР±С‰РёР№ СЃРєРѕСЂСЂРµРєС‚РёСЂРѕРІР°РЅРЅС‹Р№ СЂРёСЃРє:</span>
                <span className="value">
                  {riskResult.overallNet?.toFixed(1)}%
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4>Р Р°Р·Р±РёРІРєР° РїРѕ СЃРёСЃС‚РµРјР°Рј:</h4>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {Object.entries(riskResult.systemBreakdown || {}).map(([system, values]) => (
                    <div key={system} className="card" style={{ padding: 12, margin: 0 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{SYSTEM_LABELS[system] || system}</h4>
                      <div className="row">
                        <span className="label">Р‘Р°Р·РѕРІС‹Р№:</span>
                        <span className="value">
                          {values.raw?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="row">
                        <span className="label">РЎРєРѕСЂСЂРµРєС‚РёСЂРѕРІР°РЅРЅС‹Р№:</span>
                        <span className="value">
                          {values.net?.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                        РЎРЅРёР¶РµРЅРёРµ СЂРёСЃРєР°: {(values.raw! > 0 ? ((1 - values.net! / values.raw!) * 100) : 0).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p>Р”Р°РЅРЅС‹Рµ Рѕ СЂРёСЃРєР°С… РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚</p>
          )}
        </div>
      )}

      <div className="card">
        <h3>РђРЅР°Р»РёР· В«Р§С‚Рѕ РµСЃР»РёВ»</h3>
        <p style={{ marginBottom: 12 }}>
          РР·РјРµРЅРёС‚Рµ Р»СЋР±РѕР№ РїР°СЂР°РјРµС‚СЂ РІС‹С€Рµ, С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ, РєР°Рє СЌС‚Рѕ РІР»РёСЏРµС‚ РЅР° РІР°С€ РїСЂРѕС„РёР»СЊ СЂРёСЃРєРѕРІ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё.
          Р­С‚Рѕ РїРѕР·РІРѕР»СЏРµС‚ С‚РµСЃС‚РёСЂРѕРІР°С‚СЊ СЂР°Р·Р»РёС‡РЅС‹Рµ РїСЂРѕС‚РѕРєРѕР»С‹, РґРѕР±Р°РІРєРё РёР»Рё РёР·РјРµРЅРµРЅРёСЏ РѕР±СЂР°Р·Р° Р¶РёР·РЅРё РґРѕ РёС… СЂРµР°Р»РёР·Р°С†РёРё.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={handleCalculateRisks} className="btn">
            РџРµСЂРµСЃС‡РёС‚Р°С‚СЊ СЂРёСЃРєРё
          </button>
          <button
            onClick={() => handleScenarioChange('Baseline')}
            className="btn secondary"
          >
            РЎР±СЂРѕСЃРёС‚СЊ Рє Р±Р°Р·РѕРІРѕРјСѓ
          </button>
        </div>
      </div>

      <div className="card">
        <h3>РџСЂРѕРіРЅРѕР· РіРѕС‚РѕРІРЅРѕСЃС‚Рё (7 РґРЅРµР№)</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>РњРѕРґРµР»СЊ РҐРѕР»СЊС‚Р°: РїСЂРѕРіРЅРѕР· РЅР° РѕСЃРЅРѕРІРµ РїРѕСЃР»РµРґРЅРёС… РґР°РЅРЅС‹С… РіРѕС‚РѕРІРЅРѕСЃС‚Рё.</p>
        <ReadinessForecastBlock initialHistory={readiness ? [readiness.recovery] : undefined} />
      </div>

      <div className="card">
        <h3>РўСЂРµРЅРґ Р»Р°Р±РѕСЂР°С‚РѕСЂРЅС‹С… РїРѕРєР°Р·Р°С‚РµР»РµР№</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>РџСЂРѕРіРЅРѕР· РїРѕ РґР°РЅРЅС‹Рј Р°РЅР°Р»РёР·РѕРІ (HCT, РђР›Рў, Рё РґСЂ.).</p>
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
      <button onClick={calc} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Р Р°СЃСЃС‡РёС‚Р°С‚СЊ РїСЂРѕРіРЅРѕР·</button>
      {forecast && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {forecast.values.map((v, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center', minWidth: 48 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Р”+{i + 1}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>[{forecast.ci95[i][0]}вЂ“{forecast.ci95[i][1]}]</div>
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
      <button onClick={calc} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>РЎРїСЂРѕРіРЅРѕР·РёСЂРѕРІР°С‚СЊ С‚СЂРµРЅРґ</button>
      {forecast && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.current}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>РЎРµР№С‡Р°СЃ</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.w4}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>4 РЅРµРґ</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.w8}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>8 РЅРµРґ</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{forecast.w12}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>12 РЅРµРґ</div>
            </div>
          </div>
          {forecast.alert && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{forecast.alert}</div>}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>95% CI С‡РµСЂРµР· 4 РЅРµРґ: [{forecast.ci95w4[0]}вЂ“{forecast.ci95w4[1]}] | 12 РЅРµРґ: [{forecast.ci95w12[0]}вЂ“{forecast.ci95w12[1]}]</div>
        </div>
      )}
    </div>
  );
};