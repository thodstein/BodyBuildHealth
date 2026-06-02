import React, { useState, useEffect } from 'react';
import { calculateRisks } from '../../engines/risk.engine';
import type { RiskInput, RiskResult } from '../../core/types';

export const PredictiveAnalyticsScreen: React.FC = () => {
  const [riskInput, setRiskInput] = useState<RiskInput>({
    genetics: {},
    activeDrugs: {},
    biomarkerValues: {},
    hgiMarkers: {},
    nutritionFactor: 1.0,
    trainingFactor: 1.0,
    interventionResponse: 0.5,
    supportCoverage: {}
  });

  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState('Baseline');

  // Predefined scenarios for quick testing
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
        hepatic: 2.5, // Elevated liver enzymes
        lipid: 2.8,   // Elevated lipids
        cardio: 1.4   // Elevated cardiac markers
      },
      hgiMarkers: { inflammation: 1.8, immune: 1.6 },
      nutritionFactor: 0.8, // Poor nutrition
      trainingFactor: 1.3,  // Intense training
      interventionResponse: 0.3, // Poor response to interventions
      supportCoverage: {}
    },
    'Optimized Protocol': {
      genetics: { hepatic: 'Val/Val', cardio: 'Val/Val' },
      activeDrugs: {
        'testosterone-enanthate': { dosePerWeek: 250 },
        'support-samarin': { dosePerWeek: 0 } // Milk thistle
      },
      biomarkerValues: {
        hepatic: 0.9, // Normal liver enzymes
        lipid: 1.0,   // Normal lipids
        cardio: 0.9   // Normal cardiac markers
      },
      hgiMarkers: { inflammation: 0.7, immune: 0.8 },
      nutritionFactor: 1.2, // Good nutrition
      trainingFactor: 1.0,  // Moderate training
      interventionResponse: 0.8, // Good response to interventions
      supportCoverage: {
        'hepatic_1': 0.3, // 30% risk reduction from liver support
        'lipid_1': 0.2    // 20% risk reduction from lipid support
      }
    },
    'Post Cycle Therapy': {
      genetics: {},
      activeDrugs: {
        'pct-clomiphene': { dosePerWeek: 100 }, // Clomid
        'pct-tamoxifen': { dosePerWeek: 40 }    // Nolvadex
      },
      biomarkerValues: {
        endocrine: 1.2, // Slightly elevated (recovering)
        hepatic: 1.1    // Slightly elevated
      },
      hgiMarkers: { inflammation: 0.9, immune: 0.9 },
      nutritionFactor: 1.1,
      trainingFactor: 0.8, // Reduced training during PCT
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
      console.error('Error calculating risks:', error);
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
      <h2>Predictive Analytics - What-If Scenarios</h2>
      
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Scenario Selector</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(predefinedScenarios).map((scenario) => (
            <button
              key={scenario}
              onClick={() => handleScenarioChange(scenario as keyof typeof predefinedScenarios)}
              className={scenarioName === scenario ? 'btn' : 'btn secondary'}
              style={{ flex: 1, minWidth: 120 }}
            >
              {scenario}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Risk Input Parameters</h3>
        <div className="grid">
          {/* Genetics */}
          <div>
            <h4>Genetic Factors</h4>
            <div style={{ display: 'grid', gap: 4 }}>
              <div>
                <label>Hepatic:</label>
                <select
                  onChange={(e) => handleInputChange('genetics', (prev) => ({
                    ...prev,
                    hepatic: e.target.value as any
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="Val/Val">Val/Val (Normal)</option>
                  <option value="Val/Mut">Val/Mut (Moderate)</option>
                  <option value="Mut/Mut">Mut/Mut (High Risk)</option>
                </select>
              </div>
              <div>
                <label>Cardio:</label>
                <select
                  onChange={(e) => handleInputChange('genetics', (prev) => ({
                    ...prev,
                    cardio: e.target.value as any
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="Val/Val">Val/Val (Normal)</option>
                  <option value="Val/Mut">Val/Mut (Moderate)</option>
                  <option value="Mut/Mut">Mut/Mut (High Risk)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nutrition & Training */}
          <div>
            <h4>Lifestyle Factors</h4>
            <div style={{ display: 'grid', gap: 4 }}>
              <div>
                <label>Nutrition Quality:</label>
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
                  1.0 = average, {'>'}1.0 = good, {'<'}1.0 = poor
                </p>
              </div>
              <div>
                <label>Training Intensity:</label>
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
                  1.0 = average, {'>'}1.0 = intense, {'<'}1.0 = light
                </p>
              </div>
              <div>
                <label>Intervention Response:</label>
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
                  How well body responds to interventions (0-1)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Calculating risks...</p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Risk Analysis Results</h3>
          {riskResult ? (
            <>
              <div className="row">
                <span className="label">Overall Raw Risk:</span>
                <span className="value">
                  {riskResult.overallRaw?.toFixed(1)}%
                </span>
              </div>
              <div className="row">
                <span className="label">Overall Net Risk:</span>
                <span className="value">
                  {riskResult.overallNet?.toFixed(1)}%
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4>System Breakdown:</h4>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {Object.entries(riskResult.systemBreakdown || {}).map(([system, values]) => (
                    <div key={system} className="card" style={{ padding: 12, margin: 0 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>{system}</h4>
                      <div className="row">
                        <span className="label">Raw:</span>
                        <span className="value">
                          {values.raw?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="row">
                        <span className="label">Net:</span>
                        <span className="value">
                          {values.net?.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                        Risk reduction: {((1 - values.net! / values.raw!) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p>No risk data available</p>
          )}
        </div>
      )}

      <div className="card">
        <h3>What-If Analysis</h3>
        <p style={{ marginBottom: 12 }}>
          Adjust any parameter above to see how it affects your risk profile in real-time.
          This allows you to experiment with different protocols, supplements, or lifestyle
          changes before implementing them.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={handleCalculateRisks} className="btn">
            Recalculate Risks
          </button>
          <button
            onClick={() => handleScenarioChange('Baseline')}
            className="btn secondary"
          >
            Reset to Baseline
          </button>
        </div>
      </div>
    </div>
  );
};