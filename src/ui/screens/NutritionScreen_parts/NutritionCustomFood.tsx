import React, { useState, useEffect } from 'react';
import { saveCustomFood, loadCustomFoods, deleteCustomFood, saveCustomTargets, loadCustomTargets, type CustomFoodEntry } from '../../../engines/meal-tier-generator.engine';
import type { FoodItem } from '../../../core/nutrition-database';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'protein', label: '\u0411\u0435\u043B\u043A\u0438' },
  { value: 'carb', label: '\u0423\u0433\u043B\u0435\u0432\u043E\u0434\u044B' },
  { value: 'fat', label: '\u0416\u0438\u0440\u044B' },
  { value: 'dairy', label: '\u041C\u043E\u043B\u043E\u0447\u043D\u044B\u0435' },
  { value: 'veg_fruit', label: '\u041E\u0432\u043E\u0449\u0438/\u0424\u0440\u0443\u043A\u0442\u044B' },
  { value: 'grain', label: '\u0417\u043B\u0430\u043A\u0438' },
  { value: 'supplement', label: '\u0414\u043E\u0431\u0430\u0432\u043A\u0438' },
  { value: 'other', label: '\u0414\u0440\u0443\u0433\u043E\u0435' },
];

export const NutritionCustomFood: React.FC = () => {
  const [customFoods, setCustomFoods] = useState<CustomFoodEntry[]>([]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [newFood, setNewFood] = useState<Partial<CustomFoodEntry>>({ name: '', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, category: 'protein', servingSize: '100 \u0433' });
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
      servingSize: newFood.servingSize || '100 \u0433',
    };
    saveCustomFood(food);
    setCustomFoods([...loadCustomFoods()]);
    setNewFood({ name: '', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, category: 'protein', servingSize: '100 \u0433' });
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
          <button onClick={() => setShowTargets(!showTargets)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: 11 }}>{showTargets ? '\u0421\u043A\u0440\u044B\u0442\u044C' : '\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C'}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          {targets ? `\u041A\u0430\u043B\u043E\u0440\u0438\u0438: ${targets.kcal} | \u0411\u0435\u043B\u043A\u0438: ${targets.protein}\u0433 | \u0416\u0438\u0440\u044B: ${targets.fat}\u0433 | \u0423\u0433\u043B\u0435\u0432\u043E\u0434\u044B: ${targets.carbs}\u0433` : '\u041D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B \u2014 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F'}
        </div>
        {showTargets && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u041A\u043A\u0430\u043B</label><input type="number" value={targets?.kcal ?? 2500} onChange={e => setTargets(t => t ? {...t, kcal: parseFloat(e.target.value) || 0} : {kcal: parseFloat(e.target.value) || 0, protein: 160, fat: 80, carbs: 300, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u0411\u0435\u043B\u043A\u0438 (\u0433)</label><input type="number" value={targets?.protein ?? 160} onChange={e => setTargets(t => t ? {...t, protein: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: parseFloat(e.target.value) || 0, fat: 80, carbs: 300, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u0416\u0438\u0440\u044B (\u0433)</label><input type="number" value={targets?.fat ?? 80} onChange={e => setTargets(t => t ? {...t, fat: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: parseFloat(e.target.value) || 0, carbs: 300, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u0423\u0433\u043B\u0435\u0432\u043E\u0434\u044B (\u0433)</label><input type="number" value={targets?.carbs ?? 300} onChange={e => setTargets(t => t ? {...t, carbs: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: 80, carbs: parseFloat(e.target.value) || 0, fiber: 35, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u041A\u043B\u0435\u0442\u0447\u0430\u0442\u043A\u0430 (\u0433)</label><input type="number" value={targets?.fiber ?? 35} onChange={e => setTargets(t => t ? {...t, fiber: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: 80, carbs: 300, fiber: parseFloat(e.target.value) || 0, water: 2.5})} style={inputStyle} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u0412\u043E\u0434\u0430 (\u043B)</label><input type="number" step="0.1" value={targets?.water ?? 2.5} onChange={e => setTargets(t => t ? {...t, water: parseFloat(e.target.value) || 0} : {kcal: 2500, protein: 160, fat: 80, carbs: 300, fiber: 35, water: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
          </div>
        )}
        {showTargets && <button onClick={handleSaveTargets} style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>\uD83D\uDCBE \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0446\u0435\u043B\u0438</button>}
      </div>

      {/* Add custom food */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>\uD83C\uDF4E \u0421\u0432\u043E\u0438 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u044B</h3>
          <button onClick={() => setShowAddFood(!showAddFood)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#000', fontWeight: 600, fontSize: 11 }}>{showAddFood ? '\u0421\u043A\u0440\u044B\u0442\u044C' : '+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C'}</button>
        </div>
        {showAddFood && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
            <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435</label><input type="text" value={newFood.name || ''} onChange={e => setNewFood({...newFood, name: e.target.value})} placeholder="\u041C\u043E\u0439 \u043F\u0440\u043E\u0434\u0443\u043A\u0442" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u041A\u043A\u0430\u043B</label><input type="number" value={newFood.kcal || ''} onChange={e => setNewFood({...newFood, kcal: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u0411\u0435\u043B\u043A\u0438</label><input type="number" value={newFood.protein || ''} onChange={e => setNewFood({...newFood, protein: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u0416\u0438\u0440\u044B</label><input type="number" value={newFood.fat || ''} onChange={e => setNewFood({...newFood, fat: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u0423\u0433\u043B\u0435\u0432\u043E\u0434\u044B</label><input type="number" value={newFood.carbs || ''} onChange={e => setNewFood({...newFood, carbs: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u041A\u043B\u0435\u0442\u0447\u0430\u0442\u043A\u0430</label><input type="number" value={newFood.fiber || ''} onChange={e => setNewFood({...newFood, fiber: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F</label><select value={newFood.category || 'protein'} onChange={e => setNewFood({...newFood, category: e.target.value as FoodItem['category']})} style={inputStyle}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            </div>
            <button onClick={handleAddFood} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13 }}>\u2795 \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u043E\u0434\u0443\u043A\u0442</button>
          </div>
        )}
        {customFoods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 12 }}>\u041D\u0435\u0442 \u0441\u0432\u043E\u0438\u0445 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u043E\u0432. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C\u00BB \u0447\u0442\u043E\u0431\u044B \u0441\u043E\u0437\u0434\u0430\u0442\u044C.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {customFoods.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{f.kcal} \u043A\u043A\u0430\u043B | \u0411:{f.protein}\u0433 \u0416:{f.fat}\u0433 \u0423:{f.carbs}\u0433</div>
                </div>
                <button onClick={() => handleDeleteFood(f.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#ef4444', fontSize: 10 }}>\u0423\u0434\u0430\u043B\u0438\u0442\u044C</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
