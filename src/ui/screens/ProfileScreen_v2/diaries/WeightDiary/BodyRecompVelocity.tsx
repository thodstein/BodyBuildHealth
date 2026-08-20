import React, { useMemo } from 'react';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { c, card, metricLabel, metricValue, metricDelta, tnum, FONT } from './design';

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
        weightVelocity = (weight - prev.weight) / daysDiff * 7; // per week
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
  const latest = velocities[velocities.length - 1];
  
  if (velocities.length < 2) {
    return (
      <div style={card}>
        <b style={{ display: 'block', marginBottom: 8 }}>⚡ Скорость рекомпозиции</b>
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
  const phaseColor = isRecomp ? '#a855f7' : isBulkLean ? '#22c55e' : isCutLean ? '#f97316' : c.text3;
  
  return (
    <section style={card}>
      <b style={{ display: 'block', marginBottom: 12 }}>⚡ Скорость рекомпозиции (7 дней)</b>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: `${phaseColor}22`, border: `1px solid ${phaseColor}44` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: phaseColor }}>{phase}</span>
        <span style={{ fontSize: 11, color: c.text3 }}>среднее за 4 замера</span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#18181b' }}>
          <div style={metricLabel}>Жир</div>
          <div style={{ ...metricValue, fontSize: 20, color: avgFatVel < 0 ? c.green : c.red }}>
            {avgFatVel >= 0 ? '+' : ''}{avgFatVel.toFixed(2)} кг/нед
          </div>
          <div style={metricDelta}>{avgFatVel < -0.05 ? '🔥 Уходит' : avgFatVel > 0.05 ? '⬆ Набирается' : '⚖ Стабилен'}</div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#18181b' }}>
          <div style={metricLabel}>Мышцы</div>
          <div style={{ ...metricValue, fontSize: 20, color: avgLeanVel > 0 ? c.green : c.red }}>
            {avgLeanVel >= 0 ? '+' : ''}{avgLeanVel.toFixed(2)} кг/нед
          </div>
          <div style={metricDelta}>{avgLeanVel > 0.05 ? '💪 Растут' : avgLeanVel < -0.05 ? '⚠ Уходят' : '⚖ Стабильны'}</div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#18181b' }}>
          <div style={metricLabel}>Вес</div>
          <div style={{ ...metricValue, fontSize: 20, color: c.blue }}>
            {avgWeightVel >= 0 ? '+' : ''}{avgWeightVel.toFixed(2)} кг/нед
          </div>
          <div style={metricDelta}>
            {avgWeightVel > 0.1 ? '📈 Набор' : avgWeightVel < -0.1 ? '📉 Потеря' : '⚖ Стабилен'}
          </div>
        </div>
      </div>
      
      {/* Mini chart - fat vs lean velocity over time */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 10, color: c.text3 }}>
          <span>Жир (кг/нед)</span>
          <span>Мышцы (кг/нед)</span>
        </div>
        <div style={{ height: 60, position: 'relative' }}>
          <svg width="100%" height="60" style={{ display: 'block' }}>
            {velocities.slice(-12).map((v, i, arr) => {
              const x = (i / (arr.length - 1 || 1)) * 100;
              const fatY = 30 - Math.max(-2, Math.min(2, v.fatVelocity)) * 10;
              const leanY = 30 - Math.max(-2, Math.min(2, v.leanVelocity)) * 10;
              return (
                <g key={v.date}>
                  {i > 0 && (
                    <>
                      <line
                        x1={(i - 1) / (arr.length - 1) * 100}
                        y1={30 - Math.max(-2, Math.min(2, arr[i - 1].fatVelocity)) * 10}
                        x2={x}
                        y2={fatY}
                        stroke="#f97316"
                        strokeWidth="1.5"
                        opacity="0.8"
                      />
                      <line
                        x1={(i - 1) / (arr.length - 1) * 100}
                        y1={30 - Math.max(-2, Math.min(2, arr[i - 1].leanVelocity)) * 10}
                        x2={x}
                        y2={leanY}
                        stroke="#22c55e"
                        strokeWidth="1.5"
                        opacity="0.8"
                      />
                    </>
                  )}
                  <circle cx={x} cy={fatY} r="2" fill="#f97316" />
                  <circle cx={x} cy={leanY} r="2" fill="#22c55e" />
                </g>
              );
            })}
            <line x1="0" y1="30" x2="100%" y2="30" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          </svg>
        </div>
        <small style={{ color: c.text3, fontSize: 9 }}>← старее · новее →</small>
      </div>
    </section>
  );
};