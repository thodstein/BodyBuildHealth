import React, { useState, useEffect } from 'react';
import { saveCustomFood, loadCustomFoods, deleteCustomFood, saveCustomTargets, loadCustomTargets, type CustomFoodEntry } from '../../../engines/meal-tier-generator.engine';
import type { FoodItem } from '../../../core/nutrition-database';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'protein', label: 'Белки' },
  { value: 'carb', label: 'Углеводы' },
  { value: 'fat', label: 'Жиры' },
  { value: 'dairy', label: 'Молочные' },
  { value: 'veg_fruit', label: 'Овощи/Фрукты' },
  { value: 'grain', label: 'Злаки' },
  { value: 'supplement', label: 'Добавки' },
  { value: 'other', label: 'Другое' },
];

export const NutritionCustomFood: React.FC = () => {
  const [customFoods, setCustomFoods] = useState<CustomFoodEntry[]>([]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [newFood, setNewFood] = useState<Partial<CustomFoodEntry>>({ name: '', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, category: 'protein', servingSize: '100 г' });
  const [targets, setTargets] = useState<{ kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number } | null>(null);

  useEffect(() => {
    setCustomFoods(loadCustomFoods());
    setTargets(loadCustomTargets());
  }, []);

  const handleAddFood = () => {
    if (!newFood.name) return;
    const food: CustomFoodEntry = {
      id: 'custom_' + Date.now(),
      name: newFood.name || '',
      kcal: newFood.kcal || 0,
      protein: newFood.protein || 0,
      fat: newFood.fat || 0,
      carbs: newFood.carbs || 0,
      fiber: newFood.fiber || 0,
      category: (newFood.category as FoodItem['category']) || 'protein',
      servingSize: newFood.servingSize || '100 г',
    };
    saveCustomFood(food);
    setCustomFoods([...loadCustomFoods()]);
    setNewFood({ name: '', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, category: 'protein', servingSize: '100 г' });
    setShowAddFood(false);
  };

  const handleDeleteFood = (id: string) => {
    deleteCustomFood(id);
    setCustomFoods(customFoods.filter(f => f.id !== id));
  };

  const handleSaveTargets = () => {
    if (targets) {
      saveCustomTargets(targets);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' };

  return (
    <div>
      {/* Custom КБЖУ targets */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>🎯 Свои КБЖУ цели</h3>
          <button onClick={() => setShowTargets(!showTargets)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: 11 }}>{showTargets ? 'Скрыть' : 'Настроить'}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          {targets ? `Калории: ${targets.kcal} | Белки: ${targets.protein}г | Жиры: ${targets.fat}г | Углеводы: ${targets.carbs}г` : 'Не заданы — используются расчётные значения'}
        </div>
        {showTargets && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ккал</label><input type="number" value={targets?.kcal ?? 2500} onChange={e => setTargets(t => t ? {...t, kcal: parseFloat(e.target.value) || 0} : {kcal: parseFloat(e.target.value) || 0, protein: 160, fat: 80, carbs: 300, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Белки (г)</label><input type="number" value={targets?.protein ?? 160} onChange={e => setTargets(t => t ? {...t, protein: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: parseFloat(e.target.value) || 0, fat: 80, carbs: 300, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Жиры (г)</label><input type="number" value={targets?.fat ?? 80} onChange={e => setTargets(t => t ? {...t, fat: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: parseFloat(e.target.value) || 0, carbs: 300, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Углеводы (г)</label><input type="number" value={targets?.carbs ?? 300} onChange={e => setTargets(t => t ? {...t, carbs: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: 80, carbs: parseFloat(e.target.value) || 0, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Клетчатка (г)</label><input type="number" value={targets?.fiber ?? 35} onChange={e => setTargets(t => t ? {...t, fiber: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: 80, carbs: 300, fiber: parseFloat(e.target.value) || 0, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вода (л)</label><input type="number" step="0.1" value={targets?.water ?? 2.5} onChange={e => setTargets(t => t ? {...t, water: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: 80, carbs: 300, fiber: 35, water: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
          </div>
        )}
        {showTargets && <button onClick={handleSaveTargets} style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>💾 Сохранить цели</button>}
      </div>

      {/* Add custom food */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>🍎 Свои продукты</h3>
          <button onClick={() => setShowAddFood(!showAddFood)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#000', fontWeight: 600, fontSize: 11 }}>{showAddFood ? 'Скрыть' : '+ Добавить'}</button>
        </div>
        {showAddFood && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Название</label><input type="text" value={newFood.name || ''} onChange={e => setNewFood({...newFood, name: e.target.value})} placeholder="Мой продукт" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ккал</label><input type="number" value={newFood.kcal || ''} onChange={e => setNewFood({...newFood, kcal: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Белки</label><input type="number" value={newFood.protein || ''} onChange={e => setNewFood({...newFood, protein: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Жиры</label><input type="number" value={newFood.fat || ''} onChange={e => setNewFood({...newFood, fat: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Углеводы</label><input type="number" value={newFood.carbs || ''} onChange={e => setNewFood({...newFood, carbs: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Клетчатка</label><input type="number" value={newFood.fiber || ''} onChange={e => setNewFood({...newFood, fiber: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Категория</label><select value={newFood.category || 'protein'} onChange={e => setNewFood({...newFood, category: e.target.value as FoodItem['category']})} style={inputStyle}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            </div>
            <button onClick={handleAddFood} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13 }}>➕ Добавить продукт</button>
          </div>
        )}
        {customFoods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 12 }}>Нет своих продуктов. Нажмите «Добавить» чтобы создать.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {customFoods.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{f.kcal} ккал | Б:{f.protein}г Ж:{f.fat}г У:{f.carbs}г</div>
                </div>
                <button onClick={() => handleDeleteFood(f.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#ef4444', fontSize: 10 }}>Удалить</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
