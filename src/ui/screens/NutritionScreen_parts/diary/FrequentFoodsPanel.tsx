/**
 * FrequentFoodsPanel - Quick access to frequently consumed foods
 * Shows top N most eaten foods for quick logging
 */

import React, { useState, useCallback } from 'react';
import { useFrequentFoods } from '../useNutritionDiary';
import { type DiaryMealItem } from '../diary-storage-v2';

interface FrequentFoodsPanelProps {
  diary: Record<string, any>;
  onAddFood: (food: DiaryMealItem, mealType: string) => void;
  maxItems?: number;
}

type MealType = 'Завтрак' | 'Обед' | 'Ужин' | 'Перекус' | 'До тренировки' | 'После тренировки';

const MEAL_TYPES: MealType[] = ['Завтрак', 'Обед', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки'];

export const FrequentFoodsPanel: React.FC<FrequentFoodsPanelProps> = ({
  diary,
  onAddFood,
  maxItems = 10,
}) => {
  const [selectedMealType, setSelectedMealType] = useState<MealType>('Перекус');
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  
  const frequentFoods = useFrequentFoods(diary, showAll ? 50 : maxItems);
  
  const handleAdd = useCallback(
    (food: DiaryMealItem) => {
      onAddFood(food, selectedMealType);
    },
    [onAddFood, selectedMealType]
  );
  
  if (frequentFoods.length === 0) {
    return null;
  }

  const parseQty = (qty: any): number => {
    if (typeof qty === 'number' && Number.isFinite(qty)) return qty;
    if (typeof qty === 'string') {
      const m = qty.match(/[\d.,]+/);
      if (m) return Math.max(10, Math.round(parseFloat(m[0].replace(',', '.')))) || 100;
    }
    return 100;
  };

  return (
    <div style={{ padding: 14, borderRadius: 18, background: 'linear-gradient(135deg, rgba(18,18,20,0.9), rgba(24,24,27,0.8))', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#00e68a,#00c8a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 2px 8px rgba(0,230,138,0.25)' }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 6 }}>Быстрое добавление <span style={{ fontSize: 9, background: 'rgba(0,230,138,0.12)', color: '#00e68a', padding: '2px 6px', borderRadius: 999, border: '1px solid rgba(0,230,138,0.18)' }}>{frequentFoods.length}</span></div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>{collapsed ? 'Нажми чтобы развернуть' : `${frequentFoods.length} частых • ${selectedMealType}`} • тап = 1-клик в {selectedMealType}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!collapsed && (
            <button onClick={() => setShowAll(!showAll)} style={{ padding: '6px 10px', borderRadius: 999, fontSize: 9, fontWeight: 600, cursor: 'pointer', background: showAll ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showAll ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`, color: showAll ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>
              {showAll ? '▲ Скрыть' : 'Ещё'}
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ width: 32, height: 32, borderRadius: 10, background: collapsed ? 'rgba(255,255,255,0.04)' : 'rgba(0,230,138,0.12)', border: `1px solid ${collapsed ? 'rgba(255,255,255,0.06)' : 'rgba(0,230,138,0.2)'}`, color: collapsed ? 'rgba(255,255,255,0.6)' : '#00e68a', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MEAL_TYPES.map(type => {
          const isActive = selectedMealType === type;
          const icon = type === 'Завтрак' ? '🌅' : type === 'Обед' ? '☀️' : type === 'Ужин' ? '🌙' : type === 'Перекус' ? '🍿' : type.includes('тренировки') ? '💪' : '🍽';
          return (
            <button key={type} onClick={() => setSelectedMealType(type)} style={{ padding: '7px 10px', borderRadius: 999, fontSize: 10, fontWeight: isActive ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: isActive ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? '#00e68a' : 'rgba(255,255,255,0.06)'}`, color: isActive ? '#000' : 'rgba(255,255,255,0.65)', boxShadow: isActive ? '0 2px 8px rgba(0,230,138,0.2)' : 'none', transition: 'all 0.15s' }}>
              <span style={{ fontSize: 11 }}>{icon}</span> {type}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        {frequentFoods.map((food, idx) => {
          const qty = parseQty(food.qty);
          const kcal = Math.round((Number(food.kcal) || 0) * qty / 100);
          const p = Math.round(((Number(food.p) || 0) * qty / 100) * 10) / 10;
          const f = Math.round(((Number(food.f) || 0) * qty / 100) * 10) / 10;
          const c = Math.round(((Number(food.c) || 0) * qty / 100) * 10) / 10;
          return (
            <button key={`${food.name}-${idx}`} onClick={() => handleAdd(food)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,230,138,0.06), rgba(0,200,160,0.03))', border: '1px solid rgba(0,230,138,0.12)', backdropFilter: 'blur(8px)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 4 }} onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(0,200,160,0.06))')} onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,230,138,0.06), rgba(0,200,160,0.03))')} title={`${food.name}\n${kcal} ккал | Б: ${p} Ж: ${f} У: ${c}`}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <span style={{ background: 'rgba(0,230,138,0.12)', color: '#00e68a', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>{qty}г</span>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>→</span>
                <span style={{ color: '#00e68a', fontWeight: 700 }}>{kcal} ккал</span>
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ color: '#60a5fa' }}>Б{p}</span><span style={{ color: '#f59e0b' }}>Ж{f}</span><span style={{ color: '#fb923c' }}>У{c}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
        Нажмите на продукт, чтобы добавить в «{selectedMealType}» • {frequentFoods.length} продуктов
      </div>
        </>
      )}
    </div>
  );
};

export default FrequentFoodsPanel;
