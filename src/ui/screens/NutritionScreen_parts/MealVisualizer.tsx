import React from 'react';
import { FOOD_DB, calcBBQualityScore } from '../../../core/nutrition-database';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';

interface VisualizerProps {
  items: { id: string; name: string; weightG: number; color?: string }[];
  maxItems?: number;
}

const FOOD_COLORS: Record<string, string> = {
  chicken_breast: '#00e68a', beef_lean: '#ef4444', salmon: '#f97316', egg_whole: '#f59e0b',
  rice_white: '#e0e0e0', oats: '#c8a96e', buckwheat: '#8B4513', pasta_durum: '#f0d9b5',
  broccoli: '#22c55e', spinach: '#4ade80', avocado: '#65a30d', olive_oil: '#a3e635',
  almonds: '#92400e', walnuts: '#78350f', milk: '#f5f5dc',
  whey_protein: '#e2e8f0', creatine: '#d4d4d8',
};

export const MealVisualizer: React.FC<VisualizerProps> = ({ items, maxItems = 6 }) => {
  const display = items.slice(0, maxItems);
  const totalW = display.reduce((s, i) => s + i.weightG, 1);

  return (
    <div className="nut-visualizer" style={{ marginTop: 8, textAlign: 'center' }}>
      <ModernHero icon="🍽️" title="Визуализатор" subtitle="Наглядная тарелка — баланс белков, жиров и углеводов." />
      <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>🍽 Визуализатор блюда</div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
        {display.map((item, i) => {
          const pct = item.weightG / totalW * 100;
          const food = FOOD_DB.find(f => f.id === item.id);
          const color = FOOD_COLORS[item.id] || `hsl(${i * 60}, 60%, 50%)`;
          const bb = food?.bb_quality_score;
          const opacity = bb && bb >= 6 ? 1 : bb && bb >= 4 ? 0.6 : 0.35;
          return <div key={item.id + i} title={`${item.name} (${item.weightG}г)`} style={{ width: `${pct}%`, height: '100%', background: color, opacity, borderRight: i < display.length - 1 ? '1px solid rgba(0,0,0,0.2)' : 'none' }} />;
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4, justifyContent: 'center' }}>
        {display.map((item, i) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          const bb = food?.bb_quality_score;
          const color = FOOD_COLORS[item.id] || `hsl(${i * 60}, 60%, 50%)`;
          return (
            <div key={item.id + '_l' + i} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 6, color: 'rgba(255,255,255,0.8)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, opacity: bb && bb >= 6 ? 1 : 0.5 }} />
              {item.weightG}г
            </div>
          );
        })}
      </div>
    </div>
  );
};
