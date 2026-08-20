import React, { useMemo, useState } from 'react';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { c, glassCard, glassTile, metricLabel, metricValue, flexBetween, glowRing, FONT } from './design';

interface PhotoTimelineProps {
  rows: WeightEntry[];
}

interface PhotoEntry {
  date: string;
  photos: string[];
  weight?: number;
  bodyFat?: number;
  waistCm?: number;
}

export const PhotoTimeline: React.FC<PhotoTimelineProps> = ({ rows }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  const photoEntries = useMemo<PhotoEntry[]>(() => {
    return rows
      .filter(r => r.photos && r.photos.length > 0)
      .map(r => ({
        date: r.date,
        photos: r.photos!,
        weight: r.weight,
        bodyFat: r.bodyFat,
        waistCm: r.waistCm,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);
  
  if (!photoEntries.length) {
    return (
      <div style={glassCard}>
        <div style={{ ...metricLabel, fontSize: 13, marginBottom: 8 }}>📸 Лента прогресса (фото)</div>
        <p style={{ color: c.text3, fontSize: 12 }}>Добавьте фото к записям веса для визуализации прогресса</p>
      </div>
    );
  }
  
  return (
    <section style={glassCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...metricLabel, fontSize: 13 }}>📸 Лента прогресса <span style={{ color: c.text3, fontWeight: 400 }}>({photoEntries.length} записей с фото)</span></div>
        <small style={{ color: c.text3, fontSize: 11 }}>Клик на фото — увеличить</small>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {photoEntries.map((entry, idx) => (
          <div key={entry.date} style={glassTile}>
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '10px 0',
                cursor: 'pointer',
                borderBottom: `1px solid ${c.cardBorder}`,
                marginBottom: entry.photos.length > 0 && expandedIndex === idx ? '12px' : '0',
              }}
              onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={glowRing(c.blue, 32)}>
                    <span style={{ ...metricValue, fontSize: 14, fontWeight: 700, color: c.blue, marginTop: 2 }}>📸</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: FONT, color: c.text }}>
                    {entry.date}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {entry.weight !== undefined && (
                    <span style={{ ...metricValue, fontSize: 13, fontWeight: 700, color: c.green, background: c.gradGreen, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      {entry.weight.toFixed(1)} кг
                    </span>
                  )}
                  {entry.bodyFat !== undefined && (
                    <span style={{ ...metricValue, fontSize: 13, fontWeight: 700, background: c.gradOrange, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      {entry.bodyFat.toFixed(1)}% жир
                    </span>
                  )}
                  {entry.waistCm !== undefined && (
                    <span style={{ ...metricValue, fontSize: 13, fontWeight: 700, color: c.blue, background: c.gradBlue, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      Талия {entry.waistCm.toFixed(1)} см
                    </span>
                  )}
                </div>
              </div>
              <span style={{ 
                color: c.text3, 
                fontSize: 14,
                transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                transform: expandedIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                ▼
              </span>
            </div>
            
            {expandedIndex === idx && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {entry.photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Progress ${entry.date} #${i + 1}`}
                    style={{
                      maxWidth: 'calc(33.333% - 6px)',
                      minWidth: 140,
                      maxHeight: 280,
                      borderRadius: 12,
                      objectFit: 'cover',
                      background: '#0c0c0e',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
                      transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.2s',
                    }}
                    loading="lazy"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)'; }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};