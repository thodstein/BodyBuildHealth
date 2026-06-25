import React, { useState } from 'react';
import { FOOD_DB } from '../../../core/nutrition-database';

export const CustomProducts: React.FC = () => {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');
  const [products, setProducts] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_custom_products') || '[]'); } catch { return []; }
  });
  const [msg, setMsg] = useState('');

  const add = () => {
    if (!name.trim() || !kcal) return;
    const id = 'custom_' + Date.now();
    const food = { id, name: name.trim(), category: 'other' as const, kcal: +kcal, protein: +protein || 0, fat: +fat || 0, carbs: +carbs || 0, fiber: +fiber || 0, gi: 50, servingSize: '100 г', description: 'Пользовательский продукт', tier: 'basic' as const };
    const updated = [...products, food];
    setProducts(updated);
    localStorage.setItem('he_custom_products', JSON.stringify(updated));
    setName(''); setKcal(''); setProtein(''); setFat(''); setCarbs(''); setFiber('');
    setMsg('✅ Продукт добавлен');
    setTimeout(() => setMsg(''), 2000);
  };

  const remove = (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    localStorage.setItem('he_custom_products', JSON.stringify(updated));
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>📝 Свои продукты</div>
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Название" style={inpS()} />
          <input value={kcal} onChange={e => setKcal(e.target.value)} type="number" placeholder="Ккал" style={inpS()} />
          <input value={protein} onChange={e => setProtein(e.target.value)} type="number" step="0.1" placeholder="Белки" style={inpS()} />
          <input value={fat} onChange={e => setFat(e.target.value)} type="number" step="0.1" placeholder="Жиры" style={inpS()} />
          <input value={carbs} onChange={e => setCarbs(e.target.value)} type="number" step="0.1" placeholder="Углеводы" style={inpS()} />
          <input value={fiber} onChange={e => setFiber(e.target.value)} type="number" step="0.1" placeholder="Клетчатка" style={inpS()} />
        </div>
        <button onClick={add} style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', border: 'none', color: '#000' }}>➕ Добавить продукт</button>
        {msg && <div style={{ marginTop: 4, fontSize: 8, color: '#00e68a' }}>{msg}</div>}
      </div>
      {products.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {products.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{p.name}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{p.kcal} ккал • Б{p.protein} Ж{p.fat} У{p.carbs}</div>
              </div>
              <button onClick={() => remove(p.id)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const inpS = () => ({ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 9, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', outline: 'none', boxSizing: 'border-box' } as React.CSSProperties);
