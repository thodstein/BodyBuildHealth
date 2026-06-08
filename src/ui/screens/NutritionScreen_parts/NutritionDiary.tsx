import React from 'react';
import type { FoodItem } from '../../../core/types';

export const NutritionDiary: React.FC<{
  foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[];
}> = ({ foodEntries }) => {
  return (
    <div className="nutrition-diary">
      <div className="card">
        <h3>Дневник питания</h3>
        {foodEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
            Нет записей в дневнике
          </div>
        ) : (
          <div className="list">
            {foodEntries.slice(-10).map((entry, i) => (
              <div key={i} style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600 }}>{entry.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {entry.kcal} ккал | {entry.p}г белки | {entry.f}г жиры | {entry.c}г углеводы
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
