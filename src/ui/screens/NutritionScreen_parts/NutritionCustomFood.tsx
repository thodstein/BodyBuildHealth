import React, { useState, useEffect } from 'react';
import { saveCustomFood, loadCustomFoods, deleteCustomFood, saveCustomTargets, loadCustomTargets, type CustomFoodEntry } from '../../../engines/meal-custom-food';
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

const EMPTY_FOOD: Partial<CustomFoodEntry> = { name: '', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, category: 'protein', servingSize: '100 г' };

const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 };
const sectionBtnStyle: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)', fontSize: 10, fontWeight: 600 };

export const NutritionCustomFood: React.FC = () => {
  const [customFoods, setCustomFoods] = useState<CustomFoodEntry[]>([]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [newFood, setNewFood] = useState<Partial<CustomFoodEntry>>({ ...EMPTY_FOOD });
  const [targets, setTargets] = useState<{ kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number } | null>(null);
  const [showMicros, setShowMicros] = useState(false);

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
      potassium_mg: newFood.potassium_mg,
      magnesium_mg: newFood.magnesium_mg,
      calcium_mg: newFood.calcium_mg,
      sodium_mg: newFood.sodium_mg,
      phosphorus_mg: newFood.phosphorus_mg,
      zinc_mg: newFood.zinc_mg,
      iron_mg: newFood.iron_mg,
      selenium_mcg: newFood.selenium_mcg,
      copper_mg: newFood.copper_mg,
      manganese_mg: newFood.manganese_mg,
      iodine_mcg: newFood.iodine_mcg,
      chromium_mcg: newFood.chromium_mcg,
      omega3_mg: newFood.omega3_mg,
      vitamin_a_mcg: newFood.vitamin_a_mcg,
      vitamin_c_mg: newFood.vitamin_c_mg,
      vitamin_d_mcg: newFood.vitamin_d_mcg,
      vitamin_e_mg: newFood.vitamin_e_mg,
      vitamin_k_mcg: newFood.vitamin_k_mcg,
      vitamin_b1_mg: newFood.vitamin_b1_mg,
      vitamin_b2_mg: newFood.vitamin_b2_mg,
      vitamin_b3_mg: newFood.vitamin_b3_mg,
      vitamin_b5_mg: newFood.vitamin_b5_mg,
      vitamin_b6_mg: newFood.vitamin_b6_mg,
      vitamin_b7_mcg: newFood.vitamin_b7_mcg,
      vitamin_b9_mcg: newFood.vitamin_b9_mcg,
      vitamin_b12_mcg: newFood.vitamin_b12_mcg,
      leucine_mg: newFood.leucine_mg,
      isoleucine_mg: newFood.isoleucine_mg,
      valine_mg: newFood.valine_mg,
      lysine_mg: newFood.lysine_mg,
      methionine_mg: newFood.methionine_mg,
      arginine_mg: newFood.arginine_mg,
      glutamine_mg: newFood.glutamine_mg,
      tryptophan_mg: newFood.tryptophan_mg,
      threonine_mg: newFood.threonine_mg,
      cysteine_mg: newFood.cysteine_mg,
      creatine_mg: newFood.creatine_mg,
      taurine_mg: newFood.taurine_mg,
      coenzyme_q10_mg: newFood.coenzyme_q10_mg,
      polyphenols_mg: newFood.polyphenols_mg,
      flavonoids_mg: newFood.flavonoids_mg,
    };
    saveCustomFood(food);
    setCustomFoods([...loadCustomFoods()]);
    setNewFood({ ...EMPTY_FOOD });
    setShowAddFood(false);
    setShowMicros(false);
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
            <div><label style={labelStyle}>Название</label><input type="text" value={newFood.name || ''} onChange={e => setNewFood({...newFood, name: e.target.value})} placeholder="Мой продукт" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div><label style={labelStyle}>Ккал</label><input type="number" value={newFood.kcal || ''} onChange={e => setNewFood({...newFood, kcal: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={labelStyle}>Белки</label><input type="number" value={newFood.protein || ''} onChange={e => setNewFood({...newFood, protein: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={labelStyle}>Жиры</label><input type="number" value={newFood.fat || ''} onChange={e => setNewFood({...newFood, fat: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={labelStyle}>Углеводы</label><input type="number" value={newFood.carbs || ''} onChange={e => setNewFood({...newFood, carbs: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><label style={labelStyle}>Клетчатка</label><input type="number" value={newFood.fiber || ''} onChange={e => setNewFood({...newFood, fiber: parseFloat(e.target.value) || 0})} style={inputStyle} /></div>
              <div><label style={labelStyle}>Категория</label><select value={newFood.category || 'protein'} onChange={e => setNewFood({...newFood, category: e.target.value as FoodItem['category']})} style={inputStyle}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            </div>

            <button onClick={() => setShowMicros(!showMicros)} type="button" style={sectionBtnStyle}>
              {showMicros ? '🔽 Скрыть микронутриенты' : '🔬 Микронутриенты (на 100г)'}
            </button>

            {showMicros && (
              <div style={{ display: 'grid', gap: 6, padding: '6px 0' }}>
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>⚡ Электролиты (мг)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {(['calcium_mg','magnesium_mg','potassium_mg','sodium_mg','phosphorus_mg'] as const).map(k => (
                    <div key={k}><label style={labelStyle}>{k.replace('_mg','')}</label><input type="number" value={newFood[k] ?? ''} onChange={e => setNewFood({...newFood, [k]: parseFloat(e.target.value) || undefined})} style={inputStyle} /></div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>🔬 Микроэлементы</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {(['zinc_mg','iron_mg','selenium_mcg','copper_mg','manganese_mg','iodine_mcg','chromium_mcg'] as const).map(k => (
                    <div key={k}><label style={labelStyle}>{k.replace('_mg','').replace('_mcg','')}</label><input type="number" value={newFood[k] ?? ''} onChange={e => setNewFood({...newFood, [k]: parseFloat(e.target.value) || undefined})} style={inputStyle} /></div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>🧬 Аминокислоты (мг)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {(['leucine_mg','isoleucine_mg','valine_mg','lysine_mg','methionine_mg','arginine_mg','glutamine_mg','tryptophan_mg','threonine_mg','cysteine_mg'] as const).map(k => (
                    <div key={k}><label style={labelStyle}>{k.replace('_mg','')}</label><input type="number" value={newFood[k] ?? ''} onChange={e => setNewFood({...newFood, [k]: parseFloat(e.target.value) || undefined})} style={inputStyle} /></div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>💊 Витамины</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {(['vitamin_a_mcg','vitamin_c_mg','vitamin_d_mcg','vitamin_e_mg','vitamin_k_mcg','vitamin_b1_mg','vitamin_b2_mg','vitamin_b3_mg','vitamin_b5_mg','vitamin_b6_mg','vitamin_b7_mcg','vitamin_b9_mcg','vitamin_b12_mcg'] as const).map(k => (
                    <div key={k}><label style={labelStyle}>{k.replace('vitamin_','v').replace('_mg','').replace('_mcg','')}</label><input type="number" value={newFood[k] ?? ''} onChange={e => setNewFood({...newFood, [k]: parseFloat(e.target.value) || undefined})} style={inputStyle} /></div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>📦 Прочее</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {(['omega3_mg','creatine_mg','taurine_mg','coenzyme_q10_mg','polyphenols_mg','flavonoids_mg'] as const).map(k => (
                    <div key={k}><label style={labelStyle}>{k.replace('_mg','')}</label><input type="number" value={newFood[k] ?? ''} onChange={e => setNewFood({...newFood, [k]: parseFloat(e.target.value) || undefined})} style={inputStyle} /></div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleAddFood} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13 }}>Добавить продукт</button>
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
