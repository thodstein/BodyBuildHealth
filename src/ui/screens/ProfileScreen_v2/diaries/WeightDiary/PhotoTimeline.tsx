import React, { useMemo, useState } from 'react';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { c, card, metricLabel, metricValue, FONT } from './design';

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
      <div style={card}>
        <b style={{ display: 'block', marginBottom: 8 }}>📸 Лента прогресса (фото)</b>
        <p style={{ color: c.text3, fontSize: 12 }}>Добавьте фото к записям веса для визуализации прогресса</p>
      </div>
    );
  }
  
  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>📸 Лента прогресса ({photoEntries.length} записей с фото)</b>
        <small style={{ color: c.text3, fontSize: 11 }}>Клик на фото — увеличить</small>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {photoEntries.map((entry, idx) => (
          <div key={entry.date} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '10px 12px', 
                background: '#18181b',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>
                  {entry.date}
                </span>
                {entry.weight !== undefined && (
                  <span style={{ color: c.green, fontSize: 12, fontWeight: 600 }}>
                    {entry.weight.toFixed(1)} кг
                  </span>
                )}
                {entry.bodyFat !== undefined && (
                  <span style={{ color: '#f97316', fontSize: 12, fontWeight: 600 }}>
                    {entry.bodyFat.toFixed(1)}% жир
                  </span>
                )}
                {entry.waistCm !== undefined && (
                  <span style={{ color: c.blue, fontSize: 12, fontWeight: 600 }}>
                    Талия {entry.waistCm.toFixed(1)} см
                  </span>
                )}
              </div>
              <span style={{ color: c.text3, fontSize: 14 }}>
                {expandedIndex === idx ? '▲' : '▼'}
              </span>
            </div>
            
            {expandedIndex === idx && (
              <div style={{ padding: '12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {entry.photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Progress ${entry.date} #${i + 1}`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 10,
                      objectFit: 'contain',
                      background: '#0c0c0e',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                    loading="lazy"
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