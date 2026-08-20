import React, { useMemo } from 'react';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { c, glassCard, glassTile, grid3, metricLabel, metricValueLarge, metricDelta, chartLine, FONT } from './design';

interface RecompVelocityPoint {
  date: string;
  weight: number;
  fatMass: number;
  leanMass: number;
  weightVelocity: number;
  fatVelocity: number;
  leanVelocity: number;
}

interface BodyRecompVelocityProps {
  rows: WeightEntry[];
  heightCm?: number;
  sex?: 'male' | 'female';
}

const computeVelocities = (rows: WeightEntry[], heightCm?: number, sex?: 'male' | 'female'): RecompVelocityPoint[] => {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const withBodyFat = sorted.filter(r => Number.isFinite(r.bodyFat) && Number.isFinite(r.weight));
  
  if (withBodyFat.length < 2) return [];
  
  return withBodyFat.map((r, i) => {
    const weight = r.weight;
    const bodyFat = r.bodyFat as number;
    const fatMass = weight * (bodyFat / 100);
    const leanMass = weight - fatMass;
    
    let weightVelocity = 0;
    let fatVelocity = 0;
    let leanVelocity = 0;
    
    if (i > 0) {
      const prev = withBodyFat[i - 1];
      const prevFatMass = prev.weight * ((prev.bodyFat as number) / 100);
      const prevLeanMass = prev.weight - prevFatMass;
      const daysDiff = (new Date(r.date).getTime() - new Date(prev.date).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 0) {
        weightVelocity = (weight - prev.weight) / daysDiff * 7;
        fatVelocity = (fatMass - prevFatMass) / daysDiff * 7;
        leanVelocity = (leanMass - prevLeanMass) / daysDiff * 7;
      }
    }
    
    return {
      date: r.date,
      weight,
      fatMass,
      leanMass,
      weightVelocity,
      fatVelocity,
      leanVelocity,
    };
  });
};

export const BodyRecompVelocity: React.FC<BodyRecompVelocityProps> = ({ rows, heightCm, sex }) => {
  const velocities = useMemo(() => computeVelocities(rows, heightCm, sex), [rows, heightCm, sex]);
  
  if (velocities.length < 2) {
    return (
      <div style={glassCard}>
        <div style={{ ...metricLabel, fontSize: 13, marginBottom: 8 }}>⚡ Скорость рекомпозиции</div>
        <p style={{ color: c.text3, fontSize: 12 }}>Недостаточно данных (нужно ≥2 замеров с % жира)</p>
      </div>
    );
  }
  
  const avgFatVel = velocities.slice(-4).reduce((s, v) => s + v.fatVelocity, 0) / Math.min(4, velocities.length);
  const avgLeanVel = velocities.slice(-4).reduce((s, v) => s + v.leanVelocity, 0) / Math.min(4, velocities.length);
  const avgWeightVel = velocities.slice(-4).reduce((s, v) => s + v.weightVelocity, 0) / Math.min(4, velocities.length);
  
  const isRecomp = avgFatVel < -0.05 && avgLeanVel > 0.05;
  const isBulkLean = avgWeightVel > 0.1 && avgLeanVel > avgFatVel;
  const isCutLean = avgWeightVel < -0.1 && Math.abs(avgFatVel) > Math.abs(avgLeanVel);
  
  const phase = isRecomp ? '🔄 Рекомпозиция' : isBulkLean ? '📈 Чистый набор' : isCutLean ? '🔥 Сушка' : '⚖️ Стабильность';
  const phaseColor = isRecomp ? c.purple : isBulkLean ? c.green : isCutLean ? c.orange : c.gray;
  const phaseGrad = isRecomp ? c.gradPurple : isBulkLean ? c.gradGreen : isCutLean ? c.gradOrange : 'linear-gradient(135deg, #8e8e93 0%, #6e6e73 100%)';
  
  const fatColor = avgFatVel < 0 ? c.green : c.red;
  const fatGrad = avgFatVel < 0 ? c.gradGreen : c.gradRed;
  const leanColor = avgLeanVel > 0 ? c.green : c.red;
  const leanGrad = avgLeanVel > 0 ? c.gradGreen : c.gradRed;
  const weightColor = avgWeightVel > 0.1 ? c.green : avgWeightVel < -0.1 ? c.red : c.blue;
  const weightGrad = avgWeightVel > 0.1 ? c.gradGreen : avgWeightVel < -0.1 ? c.gradRed : c.gradBlue;
  
  return (
    <section style={glassCard}>
      <div style={{ ...metricLabel, fontSize: 13, marginBottom: 16 }}>⚡ Скорость рекомпозиции <span style={{ color: c.text3, fontWeight: 400 }}>за 4 замера</span></div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: `${phaseColor}22`, border: `1px solid ${phaseColor}44` }}>
        <span style={{ fontSize: 14, fontWeight: 700, background: phaseGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontFamily: FONT }}>{phase}</span>
        <span style={{ fontSize: 11, color: c.text3 }}>среднее за 4 замера</span>
      </div>
      
      <div style={grid3}>
        <div style={glassTile}>
          <div style={metricLabel}>Жир</div>
          <div style={{ ...metricValueLarge, background: fatGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {avgFatVel >= 0 ? '+' : ''}{avgFatVel.toFixed(2)} кг/нед
          </div>
          <div style={{ ...metricDelta, color: fatColor, fontWeight: 600 }}>
            {avgFatVel < -0.05 ? '🔥 Уходит' : avgFatVel > 0.05 ? '⬆ Набирается' : '⚖ Стабилен'}
          </div>
        </div>
        
        <div style={glassTile}>
          <div style={metricLabel}>Мышцы</div>
          <div style={{ ...metricValueLarge, background: leanGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {avgLeanVel >= 0 ? '+' : ''}{avgLeanVel.toFixed(2)} кг/нед
          </div>
          <div style={{ ...metricDelta, color: leanColor, fontWeight: 600 }}>
            {avgLeanVel > 0.05 ? '💪 Растут' : avgLeanVel < -0.05 ? '⚠ Уходят' : '⚖ Стабильны'}
          </div>
        </div>
        
        <div style={glassTile}>
          <div style={metricLabel}>Вес</div>
          <div style={{ ...metricValueLarge, background: weightGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {avgWeightVel >= 0 ? '+' : ''}{avgWeightVel.toFixed(2)} кг/нед
          </div>
          <div style={{ ...metricDelta, color: weightColor, fontWeight: 600 }}>
            {avgWeightVel > 0.1 ? '📈 Набор' : avgWeightVel < -0.1 ? '📉 Потеря' : '⚖ Стабилен'}
          </div>
        </div>
      </div>
      
      {/* Mini chart - fat vs lean velocity over time */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 10, color: c.text3 }}>
          <span style={{ color: c.orange }}>Жир (кг/нед)</span>
          <span style={{ color: c.green }}>Мышцы (кг/нед)</span>
        </div>
        <div style={{ height: 70, position: 'relative' }}>
          <svg width="100%" height="70" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="fatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="leanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#30d158" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#30d158" stopOpacity="0" />
              </linearGradient>
            </defs>
            {velocities.slice(-12).map((v, i, arr) => {
              const x = (i / (arr.length - 1 || 1)) * 100;
              const fatY = 35 - Math.max(-2.5, Math.min(2.5, v.fatVelocity)) * 12;
              const leanY = 35 - Math.max(-2.5, Math.min(2.5, v.leanVelocity)) * 12;
              return (
                <g key={v.date}>
                  {/* Area under fat line */}
                  {i > 0 && (
                    <path
                      d={`M${(i - 1) / (arr.length - 1) * 100},70 L${(i - 1) / (arr.length - 1) * 100},${35 - Math.max(-2.5, Math.min(2.5, arr[i - 1].fatVelocity)) * 12} L${x},${fatY} L${x},70 Z`}
                      fill="url(#fatGrad)"
                    />
                  )}
                  {/* Area under lean line */}
                  {i > 0 && (
                    <path
                      d={`M${(i - 1) / (arr.length - 1) * 100},70 L${(i - 1) / (arr.length - 1) * 100},${35 - Math.max(-2.5, Math.min(2.5, arr[i - 1].leanVelocity)) * 12} L${x},${leanY} L${x},70 Z`}
                      fill="url(#leanGrad)"
                    />
                  )}
                  {/* Fat line */}
                  {i > 0 && (
                    <path
                      d={`M${(i - 1) / (arr.length - 1) * 100},${35 - Math.max(-2.5, Math.min(2.5, arr[i - 1].fatVelocity)) * 12} L${x},${fatY}`}
                      {...chartLine(c.orange, 2.5)}
                    />
                  )}
                  {/* Lean line */}
                  {i > 0 && (
                    <path
                      d={`M${(i - 1) / (arr.length - 1) * 100},${35 - Math.max(-2.5, Math.min(2.5, arr[i - 1].leanVelocity)) * 12} L${x},${leanY}`}
                      {...chartLine(c.green, 2.5)}
                    />
                  )}
                  {/* Data points */}
                  <circle cx={x} cy={fatY} r="3.5" fill={c.orange} stroke="#0a0a0a" strokeWidth="2" />
                  <circle cx={x} cy={leanY} r="3.5" fill={c.green} stroke="#0a0a0a" strokeWidth="2" />
                </g>
              );
            })}
            <line x1="0" y1="35" x2="100%" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="4,4" />
          </svg>
        </div>
        <small style={{ color: c.text3, fontSize: 9, display: 'block', textAlign: 'center', marginTop: 6 }}>← старее · новее →</small>
      </div>
    </section>
  );
};