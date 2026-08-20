import React, { useMemo } from 'react';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { c, glassCard, glassTile, metricLabel, metricValueLarge, metricDelta, progressBar, progressFill, flexBetween, FONT } from './design';

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
    let statusColor: string = c.green;
    let statusGrad: string = c.gradGreen;
    
    if (ratio < 0.4) {
      status = 'optimal';
      statusLabel = 'Оптимально';
      statusColor = c.green;
      statusGrad = c.gradGreen;
    } else if (ratio < 0.5) {
      status = 'moderate';
      statusLabel = 'Умеренно';
      statusColor = '#fbbf24';
      statusGrad = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
    } else if (ratio < 0.6) {
      status = 'high';
      statusLabel = 'Высокий риск';
      statusColor = '#f97316';
      statusGrad = c.gradOrange;
    } else {
      status = 'very_high';
      statusLabel = 'Очень высокий риск';
      statusColor = c.red;
      statusGrad = c.gradRed;
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
      statusGrad,
      latestWaist: latest.waistCm!,
      prevRatio,
      delta: prevRatio !== null ? ratio - prevRatio : null,
      waistThreshold,
      waistStatus,
    };
  }, [rows, heightCm, sex]);
  
  if (!ratioData) {
    return (
      <div style={glassCard}>
        <div style={{ ...metricLabel, fontSize: 13, marginBottom: 8 }}>📏 Соотношение талия/рост</div>
        <p style={{ color: c.text3, fontSize: 12 }}>Укажите рост в профиле и измерьте талию</p>
      </div>
    );
  }
  
  const { ratio, statusLabel, statusColor, statusGrad, latestWaist, delta, waistThreshold, waistStatus } = ratioData;
  
  const waistStatusColor = waistStatus === 'normal' ? c.green : waistStatus === 'elevated' ? '#fbbf24' : c.red;
  const waistStatusIcon = waistStatus === 'normal' ? '✅' : waistStatus === 'elevated' ? '⚠' : '🔴';
  const waistStatusText = waistStatus === 'normal' ? 'В норме' : waistStatus === 'elevated' ? 'Повышена' : 'Высокая';
  
  return (
    <section style={glassCard}>
      <div style={{ ...metricLabel, fontSize: 13, marginBottom: 16 }}>📏 Талия / Рост (WHtR)</div>
      <p style={{ fontSize: 11, color: c.text3, marginBottom: 16 }}>
        Более точный маркер метаболического риска, чем BMI (Ashwell 2012). Норма {'<'} 0.5.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={glassTile}>
          <div style={metricLabel}>WHtR</div>
          <div style={{ ...metricValueLarge, background: statusGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {ratio.toFixed(2)}
          </div>
          <div style={{ ...metricDelta, background: statusGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 600, fontSize: 12, marginTop: 4 }}>
            {statusLabel}
          </div>
        </div>
        
        <div style={glassTile}>
          <div style={metricLabel}>Талия</div>
          <div style={{ ...metricValueLarge, fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px', color: c.text, fontVariantNumeric: 'tabular-nums' }}>
            {latestWaist.toFixed(1)} см
          </div>
          <div style={metricDelta}>
            Норма: ≤ {waistThreshold} см ({sex === 'female' ? 'женщины' : 'мужчины'})
            <br />
            <span style={{ color: waistStatusColor, fontWeight: 700 }}>
              {waistStatusIcon} {waistStatusText}
            </span>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 10, color: c.text3 }}>
          <span>0.4 Оптимум</span>
          <span>0.5 Норма</span>
          <span>0.6 Риск</span>
        </div>
        <div style={progressBar(statusGrad, 10)}>
          <div style={progressFill(statusGrad, Math.min(100, (ratio / 0.7) * 100))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: c.text3 }}>
          <span style={{ color: c.green }}>🟢 {'<'}0.4</span>
          <span style={{ color: '#fbbf24' }}>🟡 0.4-0.5</span>
          <span style={{ color: c.orange }}>🟠 0.5-0.6</span>
          <span style={{ color: c.red }}>🔴 {'>'}0.6</span>
        </div>
      </div>
      
      {delta !== null && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: delta < 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)', border: `1px solid ${delta < 0 ? c.green : c.red}44` }}>
          <span style={{ fontSize: 11, color: delta < 0 ? c.green : c.red, fontWeight: 600 }}>
            {delta < 0 ? '📉 Улучшение' : '📈 Ухудшение'}: {delta > 0 ? '+' : ''}{delta.toFixed(3)} за период
          </span>
        </div>
      )}
    </section>
  );
};