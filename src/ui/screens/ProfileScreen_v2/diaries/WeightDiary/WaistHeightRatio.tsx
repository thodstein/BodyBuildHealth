import React, { useMemo } from 'react';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { c, card, metricLabel, metricValue, metricDelta, tnum, FONT } from './design';

interface WaistHeightRatioProps {
  rows: WeightEntry[];
  heightCm?: number;
  sex?: 'male' | 'female';
}

export const WaistHeightRatio: React.FC<WaistHeightRatioProps> = ({ rows, heightCm, sex }) => {
  const ratioData = useMemo(() => {
    if (!heightCm || heightCm <= 0) return null;
    
    const withWaist = rows
      .filter(r => Number.isFinite(r.waistCm))
      .sort((a, b) => b.date.localeCompare(a.date));
    
    if (!withWaist.length) return null;
    
    const latest = withWaist[0];
    const ratio = latest.waistCm! / heightCm;
    
    let prevRatio: number | null = null;
    if (withWaist.length > 1) {
      const prev = withWaist[1];
      prevRatio = prev.waistCm! / heightCm;
    }
    
    // Health thresholds (Ashwell 2012)
    let status: 'optimal' | 'moderate' | 'high' | 'very_high' = 'optimal';
    let statusLabel = 'Оптимально';
    let statusColor = c.green;
    
    if (ratio < 0.4) {
      status = 'optimal';
      statusLabel = 'Оптимально';
      statusColor = c.green;
    } else if (ratio < 0.5) {
      status = 'moderate';
      statusLabel = 'Умеренно';
      statusColor = '#fbbf24'; // amber
    } else if (ratio < 0.6) {
      status = 'high';
      statusLabel = 'Высокий риск';
      statusColor = '#f97316'; // orange
    } else {
      status = 'very_high';
      statusLabel = 'Очень высокий риск';
      statusColor = c.red;
    }
    
    // Sex-specific waist thresholds (IDF)
    const waistThreshold = sex === 'female' ? 80 : 94; // cm
    const waistStatus = latest.waistCm! <= waistThreshold ? 'normal' : 
                        latest.waistCm! <= waistThreshold + 8 ? 'elevated' : 'high';
    
    return {
      ratio,
      status,
      statusLabel,
      statusColor,
      latestWaist: latest.waistCm!,
      prevRatio,
      delta: prevRatio !== null ? ratio - prevRatio : null,
      waistThreshold,
      waistStatus,
    };
  }, [rows, heightCm, sex]);
  
  if (!ratioData) {
    return (
      <div style={card}>
        <b style={{ display: 'block', marginBottom: 8 }}>📏 Соотношение талия/рост</b>
        <p style={{ color: c.text3, fontSize: 12 }}>Укажите рост в профиле и измерьте талию</p>
      </div>
    );
  }
  
  const { ratio, statusLabel, statusColor, latestWaist, delta, waistThreshold, waistStatus } = ratioData;
  
  return (
    <section style={card}>
      <b style={{ display: 'block', marginBottom: 12 }}>📏 Талия / Рост (WHtR)</b>
      <p style={{ fontSize: 11, color: c.text3, marginBottom: 12 }}>
        Более точный маркер метаболического риска, чем BMI (Ashwell 2012). Норма {'<'} 0.5.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', padding: '16px 12px', borderRadius: 12, background: '#18181b', border: `1px solid ${statusColor}44` }}>
          <div style={metricLabel}>WHtR</div>
          <div style={{ ...metricValue, fontSize: 28, fontWeight: 700, color: statusColor, fontVariantNumeric: 'tabular-nums' }}>
            {ratio.toFixed(2)}
          </div>
          <div style={{ ...metricDelta, color: statusColor, fontWeight: 600, fontSize: 12, marginTop: 4 }}>
            {statusLabel}
          </div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '16px 12px', borderRadius: 12, background: '#18181b' }}>
          <div style={metricLabel}>Талия</div>
          <div style={{ ...metricValue, fontSize: 28, fontWeight: 700, color: c.text }}>
            {latestWaist.toFixed(1)} см
          </div>
          <div style={metricDelta}>
            Норма: ≤ {waistThreshold} см ({sex === 'female' ? 'женщины' : 'мужчины'})
            <br />
            <span style={{ 
              color: waistStatus === 'normal' ? c.green : waistStatus === 'elevated' ? '#fbbf24' : c.red,
              fontWeight: 600 
            }}>
              {waistStatus === 'normal' ? '✅ В норме' : waistStatus === 'elevated' ? '⚠ Повышена' : '🔴 Высокая'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: c.text3 }}>
          <span>0.4 Оптимум</span>
          <span>0.5 Норма</span>
          <span>0.6 Риск</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, (ratio / 0.7) * 100)}%`,
              borderRadius: 999,
              background: `linear-gradient(90deg, #30d158 0%, #30d158 57%, #fbbf24 57%, #fbbf24 71%, #f97316 71%, #f97316 86%, #ff453a 86%, #ff453a 100%)`,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: c.text3 }}>
          <span>🟢 {'<'}0.4</span>
          <span>🟡 0.4-0.5</span>
          <span>🟠 0.5-0.6</span>
          <span>🔴 {'>'}0.6</span>
        </div>
      </div>
      
      {delta !== null && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: delta < 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)', border: `1px solid ${delta < 0 ? c.green : c.red}44` }}>
          <span style={{ fontSize: 11, color: delta < 0 ? c.green : c.red, fontWeight: 600 }}>
            {delta < 0 ? '📉 Улучшение' : '📈 Ухудшение'}: {delta > 0 ? '+' : ''}{delta.toFixed(3)} за период
          </span>
        </div>
      )}
    </section>
  );
};