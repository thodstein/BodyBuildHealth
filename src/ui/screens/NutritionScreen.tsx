import React, { useState, useEffect, useMemo } from 'react';
import { FOOD_DB } from '../../core/nutrition-database';
import { useDataLink, derivePAL } from '../../core/data-link';
import { getRecipes } from '../../engines/nutrition-periodization.engine';
import { calcNutrition } from '../../engines/nutrition.engine';
import { NutritionDiary } from './NutritionScreen_parts/NutritionDiary';
import { NutritionCharts } from './NutritionScreen_parts/NutritionCharts';
import { IndividualPlan } from './NutritionScreen_parts/IndividualPlan';
import { NutritionReference } from './NutritionScreen_parts/NutritionReference';
import { CAT_MAP_LABEL, addToCart } from '../../core/nutrition-utils';

interface DiaryEntry { name: string; kcal: number; p: number; f: number; c: number; date?: string; }
type NutritionPage = 'hero' | 'tabs';
type NutritionSection = 'diary' | 'planning' | 'overview' | 'all';
type ActiveTab = 'diary' | 'charts' | 'mealplan' | 'cart' | 'favorites' | 'catalog' | 'reference' | 'recipes' | 'reports' | 'restaurant';

const SECTION_TABS: Record<NutritionSection, string[]> = {
  diary: ['mealplan', 'diary', 'charts', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'reports', 'restaurant'],
  planning: ['mealplan'],
  overview: [],
  all: ['mealplan', 'diary', 'charts', 'cart', 'favorites', 'catalog', 'reference', 'recipes', 'reports', 'restaurant'],
};

const TAB_LABELS: Record<string, string> = {
  diary: '📝 Дневник', charts: '📈 Графики',
  mealplan: '🥗 План', cart: '🛒 Корзина',
  restaurant: '🍽 Ресторан',
  favorites: '⭐ Избранное', catalog: '📦 Каталог',
  reference: '📖 Справочник', recipes: '🍳 Рецепты', reports: '📊 Отчёты',
};

const CAT_MAP = CAT_MAP_LABEL;

const cardBg = { background: '#18181b', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 16px rgba(0,0,0,0.2)' };
const pillActive = { background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700 as const, border: 'none', boxShadow: '0 2px 12px rgba(0,230,138,0.25)' };
const pillInactive = { background: '#202023', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.06)' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'10px 14px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none' };
const labelSec: React.CSSProperties = { fontSize:14, fontWeight:600, color:'#fff', marginBottom:10, letterSpacing:-0.3 };

const CartTab: React.FC = () => {
  const [, forceUpdate] = useState(0);
  const cart: any[] = useMemo(() => { try { return JSON.parse(localStorage.getItem('he_nutrition_cart') || '[]'); } catch { return []; } }, [forceUpdate]);
  const saveCart = (c: any[]) => { localStorage.setItem('he_nutrition_cart', JSON.stringify(c)); forceUpdate(n => n + 1); };
  const clearCart = () => saveCart([]);
  const removeItem = (idx: number) => saveCart(cart.filter((_, i) => i !== idx));
  const totalKcal = cart.reduce((s: number, i: any) => s + (i.kcal || 0), 0);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ padding:14, ...cardBg }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>🛒 Корзина</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{cart.length} позиций • {Math.round(totalKcal)} ккал</div>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} style={{ padding:'6px 12px', borderRadius:10, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:9, fontWeight:600 }}>✕ Очистить</button>
          )}
        </div>
        {cart.length === 0 ? (
          <div style={{ textAlign:'center', padding:24, color:'rgba(255,255,255,0.3)', fontSize:11 }}>
            Корзина пуста. Добавляйте продукты из плана питания кнопкой «🛒 В корзину».
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {cart.map((item, idx) => (
              <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:10, background:'#202023', border:'1px solid #27272a' }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{item.name}</div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{item.amount ? `${item.amount}г` : ''} {item.category ? `· ${CAT_MAP[item.category] || item.category}` : ''}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{Math.round(item.kcal || 0)} ккал</span>
                  <button onClick={() => removeItem(idx)} style={{ padding:'3px 7px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:10, lineHeight:1 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ReferenceTab: React.FC = () => (
  <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'4px 0' }}>
    <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:2, padding:'0 4px', letterSpacing:-0.2 }}>📖 Справочник питания</div>
    <NutritionReference />
  </div>
);

const CatalogTab: React.FC = () => {
  const [catSearch, setCatSearch] = React.useState('');
  const [catFilter, setCatFilter] = React.useState('all');
  const categories = [...new Set(FOOD_DB.map(f => f.category || 'other'))];
  const addFav = (food: { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number }) => {
    try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = [food.id, ...ids.filter(f => f !== food.id)].slice(0, 12); localStorage.setItem('he_food_favs', JSON.stringify(updated)); } catch {}
  };
  const filtered = FOOD_DB.filter(f => {
    if (catFilter !== 'all' && f.category !== catFilter) return false;
    if (catSearch && !f.name.toLowerCase().includes(catSearch.toLowerCase())) return false;
    return true;
  });
  const filterBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{ padding:'5px 10px', borderRadius:8, fontSize:8, cursor:'pointer', fontWeight: isActive ? 700 : 400, letterSpacing:0.2, whiteSpace:'nowrap', border: isActive ? '1px solid #00e68a' : '1px solid #27272a', background: isActive ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.5)' }}>{children}</button>
  );
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>📦 Каталог продуктов ({FOOD_DB.length})</div>
      <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="🔍 Поиск по названию..." style={inputStyle} />
      <div style={{ marginTop:8, display:'flex', gap:3, flexWrap:'wrap', marginBottom:8 }}>
        {filterBtn(catFilter === 'all', () => setCatFilter('all'), 'Все')}
        {categories.map(c => filterBtn(catFilter === c, () => setCatFilter(c), CAT_MAP[c] || c))}
      </div>
      <div style={{ maxHeight:380, overflowY:'auto', display:'flex', flexDirection:'column', gap:3, borderRadius:8 }}>
        {filtered.map(f => <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:10, background:'#202023', border:'1px solid #27272a' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{f.name}</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:1 }}>{CAT_MAP[f.category] || f.category} • {f.kcal}ккал • Б{f.protein} Ж{f.fat} У{f.carbs}</div>
          </div>
          <div style={{ display:'flex', gap:3, alignItems:'center' }}>
            <button onClick={() => addFav(f)} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6' }}>⭐</button>
            <button onClick={() => addToCart({ name: f.name, kcal: f.kcal, amount: 100, category: f.category })} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>🛒</button>
          </div>
        </div>)}
      </div>
    </div>
  </div>);
};

const RecipesTab: React.FC = () => {
  const [recMeal, setRecMeal] = React.useState('all');
  const [recSearch, setRecSearch] = React.useState('');
  const recipes = React.useMemo(() => getRecipes(), []);
  let list = recipes;
  if (recMeal !== 'all') list = list.filter((r: any) => r.mealType === recMeal);
  if (recSearch.trim()) { const q = recSearch.toLowerCase(); list = list.filter((r: any) => r.name?.toLowerCase().includes(q) || r.ingredients?.some((i: string) => i.toLowerCase().includes(q))); }
  const mealBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{ padding:'4px 10px', borderRadius:8, fontSize:8, cursor:'pointer', border: isActive ? '1px solid #00e68a' : '1px solid #27272a', background: isActive ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 700 : 400 }}>{children}</button>
  );
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>🍳 Рецепты ({recipes.length})</div>
      <input value={recSearch} onChange={e => setRecSearch(e.target.value)} placeholder="🔍 Поиск рецептов..." style={inputStyle} />
      <div style={{ marginTop:8, display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
        {mealBtn(recMeal === 'all', () => setRecMeal('all'), 'Все')}
        {mealBtn(recMeal === 'breakfast', () => setRecMeal('breakfast'), 'Завтрак')}
        {mealBtn(recMeal === 'main', () => setRecMeal('main'), 'Основное')}
        {mealBtn(recMeal === 'salad', () => setRecMeal('salad'), 'Салат')}
        {mealBtn(recMeal === 'snack', () => setRecMeal('snack'), 'Перекус')}
      </div>
      <div style={{ maxHeight:380, overflowY:'auto' }}>
        {list.map((r: any, i: number) => <div key={i} style={{ padding:'6px 10px', borderRadius:10, background:'#202023', border:'1px solid #27272a', marginBottom:3 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{r.name}</div>
            <div style={{ fontSize:9, display:'flex', gap:4 }}>
              <span style={{ color:'#00e68a', fontWeight:700 }}>{r.kcal}ккал</span>
              <span style={{ color:'#3b82f6' }}>Б{r.protein}</span>
              <span style={{ color:'#f59e0b' }}>Ж{r.fat}</span>
              <span style={{ color:'#f97316' }}>У{r.carbs}</span>
            </div>
          </div>
          {r.ingredients && <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
            {r.ingredients.map((ing: string, j: number) => <span key={j} style={{ padding:'1px 5px', borderRadius:4, fontSize:7, background:'#202023', border:'1px solid #27272a', color:'rgba(255,255,255,0.5)' }}>{ing}</span>)}
          </div>}
        </div>)}
      </div>
    </div>
  </div>);
};

const RESTAURANT_CUISINE: Record<string, string[]> = {
  russian: ['харчо','лагман','долма','хачапури','чебуреки','пян-се','шницель','котлета по-киевски','бефстроганов','щавелевый суп'],
  asian: ['рамен','жареный рис','курица терияки','вок','поке','том ям','мисо суп','оладьи','курица карри','греческий','оладьи'],
  italian: ['пицца'],
  fastfood: ['шаурма','бургер','kfc','mcdonald','burger king','макнаггетс','big mac','whopper','maple','maple grilled','фалафель','гирос','сэндвич с тунцом','картофель фри'],
};
function detectCuisine(name: string): string {
  const low = name.toLowerCase();
  for (const [cuisine, keywords] of Object.entries(RESTAURANT_CUISINE)) {
    for (const kw of keywords) { if (low.includes(kw)) return cuisine; }
  }
  return 'fastfood';
}

const RestaurantTab: React.FC = () => {
  const [g, setG] = React.useState<'all'|'russian'|'asian'|'italian'|'fastfood'>('all');
  const [search, setSearch] = React.useState('');
  const [portions, setPortions] = React.useState<Record<string, number>>({});
  const restaurantDishes = useMemo(() => FOOD_DB.filter(f => f.category === 'fast_food'), []);
  const filtered = useMemo(() => {
    let list = g === 'all' ? restaurantDishes : restaurantDishes.filter(f => detectCuisine(f.name) === g);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(f => f.name.toLowerCase().includes(q)); }
    return list;
  }, [g, search, restaurantDishes]);
  const totals = useMemo(() => ({
    kcal: filtered.reduce((s,f) => s + f.kcal * (portions[f.id] || 1), 0),
    p: filtered.reduce((s,f) => s + f.protein * (portions[f.id] || 1), 0),
    f: filtered.reduce((s,f) => s + f.fat * (portions[f.id] || 1), 0),
    c: filtered.reduce((s,f) => s + f.carbs * (portions[f.id] || 1), 0),
  }), [filtered, portions]);
  const cuisineBtn = (v: typeof g, label: string) => (
    <button onClick={() => setG(v)} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border: g === v ? '1px solid #00e68a' : '1px solid #27272a', background: g === v ? 'rgba(0,230,138,0.15)' : '#202023', color: g === v ? '#00e68a' : 'rgba(255,255,255,0.5)', fontWeight: g === v ? 600 : 400 }}>{label}</button>
  );
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    {/* КБЖУ сводка */}
    {filtered.length > 0 && (
      <div style={{ padding:14, ...cardBg }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:6 }}>📊 КБЖУ выбранных блюд</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
          {[{l:'Калории',v:Math.round(totals.kcal),c:'#00e68a',u:'ккал'},{l:'Белки',v:Math.round(totals.p),c:'#3b82f6',u:'г'},{l:'Жиры',v:Math.round(totals.f),c:'#f59e0b',u:'г'},{l:'Углеводы',v:Math.round(totals.c),c:'#f97316',u:'г'}].map((s,i) => (
            <div key={i} style={{ background:'#202023', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{s.l}</div>
              <div style={{ fontSize:16, fontWeight:800, color:s.c }}>{s.v}<span style={{ fontSize:9, fontWeight:400, color:'rgba(255,255,255,0.3)' }}> {s.u}</span></div>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* Фильтры */}
    <div style={{ padding:14, ...cardBg }}>
      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
        {cuisineBtn('all', 'Все')}
        {cuisineBtn('russian', '🇷🇺 Русская')}
        {cuisineBtn('asian', '🥟 Азиатская')}
        {cuisineBtn('italian', '🍝 Итальянская')}
        {cuisineBtn('fastfood', '🍔 Фаст-фуд')}
      </div>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск блюд..." style={{ width:'100%', boxSizing:'border-box', padding:'6px 10px', borderRadius:8, fontSize:9, border:'1px solid #27272a', background:'#202023', color:'#fff', outline:'none' }} />
    </div>
    {/* Список блюд с КБЖУ */}
    <div style={{ padding:14, ...cardBg }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:6 }}>🍽 Блюда ресторанов ({filtered.length})</div>
      {filtered.length === 0 ? (
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textAlign:'center', padding:20 }}>Нет блюд по выбранному фильтру.</div>
      ) : (
        <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          {filtered.map(food => {
            const portion = portions[food.id] || 1;
            return (<div key={food.id} style={{ padding:'6px 8px', borderRadius:8, background:'#202023', border:'1px solid #27272a' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{food.name}</div>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>{food.servingSize || ''} · {detectCuisine(food.name)}</div>
                </div>
                <div style={{ display:'flex', gap:2 }}>
                  {[-1,1].map(d => <button key={d} onClick={() => setPortions(p => ({...p, [food.id]: Math.max(0.25, (p[food.id]||1) + d * 0.25)}))} style={{ width:18, height:18, borderRadius:4, border:'1px solid #27272a', background:'#18181b', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>{d>0?'+':'-'}</button>)}
                </div>
                <button onClick={() => addToCart({ name: food.name, amount: Math.round(portion * (parseInt(food.servingSize) || 100)), kcal: Math.round(food.kcal * portion), category: 'fast_food' })} style={{ padding:'3px 6px', borderRadius:4, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:7, fontWeight:600 }}>🛒</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:3, marginTop:4 }}>
                <div style={{ background:'#18181b', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'rgba(255,255,255,0.4)' }}>🔥 {Math.round(food.kcal * portion)}</div>
                <div style={{ background:'rgba(59,130,246,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#60a5fa' }}>Б {Math.round(food.protein * portion)}</div>
                <div style={{ background:'rgba(245,158,11,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#fbbf24' }}>Ж {Math.round(food.fat * portion)}</div>
                <div style={{ background:'rgba(249,115,22,0.08)', borderRadius:4, padding:'2px 4px', textAlign:'center', fontSize:7, color:'#fb923c' }}>У {Math.round(food.carbs * portion)}</div>
              </div>
              {portion !== 1 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:2 }}>× {portion.toFixed(2)} порции</div>}
            </div>);
          })}
        </div>
      )}
    </div>
  </div>);
};

const TravelGuide: React.FC = () => {
  const [travelAdvice] = React.useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('travel_workouts') || '[]'); } catch { return []; } });
  return (<>
    <div style={{ fontSize:12, fontWeight:600, color:'#fff', marginBottom:6 }}>✈ Питание в дороге</div>
    {travelAdvice.length > 0 ? travelAdvice.map((a, i) => <div key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>{a}</div>) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', padding:10 }}>Нет сохранённых советов.</div>}
    <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:6 }}>
      🥜 Берите с собой: орехи, протеиновые батончики, сухофрукты<br />
      🍗 В ресторане: выбирайте белковую основу, просите соус отдельно<br />
      💧 В самолёте: пейте больше воды, ограничьте алкоголь
    </div>
  </>);
};

const SleepGuide: React.FC = () => {
  const sleepStacks = useMemo(() => { try { return JSON.parse(localStorage.getItem('sleep_stacks') || '[]'); } catch { return []; } }, []);
  return (<>
    <div style={{ fontSize:12, fontWeight:600, color:'#fff', marginBottom:6 }}>💤 Сон и восстановление</div>
    {sleepStacks.length > 0 ? sleepStacks.map((s: any, i: number) => <div key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>{s}</div>) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', padding:10 }}>Нет сохранённых стеков.</div>}
    <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:6 }}>
      🌙 Последний приём за 2-3 ч до сна<br />
      🥛 Казеин/творог 30г на ночь ↓ катаболизм<br />
      🧘 Магний 400-600 мг + глицинат улучшают качество сна
    </div>
  </>);
};

const ReportsTab: React.FC<{ foodEntries: DiaryEntry[] }> = ({ foodEntries }) => {
  const [reportMode, setReportMode] = React.useState<'day'|'week'|'month'>('day');
  const [reportDate, setReportDate] = React.useState(new Date().toISOString().split('T')[0]);
  const raw = React.useMemo(() => { try { return JSON.parse(localStorage.getItem('nutrition_diary') || '{}'); } catch { return {}; } }, [foodEntries]);
  const dayData = raw[reportDate];
  const weekStart = React.useMemo(() => { const d = new Date(reportDate); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0]; }, [reportDate]);
  const weekData = React.useMemo(() => {
    const start = new Date(weekStart); const entries: any[] = [];
    for (let i=0;i<7;i++) { const d = new Date(start); d.setDate(d.getDate()+i); const ds = d.toISOString().split('T')[0]; if (raw[ds]) Object.values(raw[ds].meals||{}).forEach((m:any) => m.forEach((e:any) => entries.push({...e, date:ds}))); }
    return entries;
  }, [raw, weekStart]);
  const monthKey = reportDate.slice(0,7);
  const monthData = React.useMemo(() => {
    const entries: any[] = [];
    Object.entries(raw).forEach(([date, d]: [string,any]) => { if (date.startsWith(monthKey)) Object.values(d.meals||{}).forEach((m:any) => m.forEach((e:any) => entries.push({...e, date}))); });
    return entries;
  }, [raw, monthKey]);
  const data = reportMode === 'day' ? (dayData ? Object.entries(dayData.meals||{}).flatMap(([meal,items]:[string,any]) => (items||[]).map((i:any) => ({...i, meal}))) : []) : reportMode === 'week' ? weekData : monthData;
  const totals = { kcal: data.reduce((s:number,i:any)=>s+(i.kcal||0),0), p: data.reduce((s:number,i:any)=>s+(i.p||0),0), f: data.reduce((s:number,i:any)=>s+(i.f||0),0), c: data.reduce((s:number,i:any)=>s+(i.c||0),0), count: data.length };
  const byMeal: Record<string,{kcal:number;p:number;f:number;c:number;count:number}> = reportMode === 'day' && dayData ? Object.fromEntries(Object.entries(dayData.meals||{}).map(([meal,items]:[string,any]) => { const mealItems = items||[]; return [meal, {kcal:mealItems.reduce((s:number,i:any)=>s+(i.kcal||0),0), p:mealItems.reduce((s:number,i:any)=>s+(i.p||0),0), f:mealItems.reduce((s:number,i:any)=>s+(i.f||0),0), c:mealItems.reduce((s:number,i:any)=>s+(i.c||0),0), count:mealItems.length}]; })) : {};
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const reportBtn = (isActive: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{ padding:'5px 12px', borderRadius:8, fontSize:9, cursor:'pointer', border: isActive ? '1px solid #00e68a' : '1px solid #27272a', background: isActive ? 'linear-gradient(135deg,rgba(0,230,138,0.2),rgba(0,200,160,0.12))' : '#202023', color: isActive ? '#00e68a' : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 700 : 400 }}>{children}</button>
  );
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:14, ...cardBg }}>
      <div style={labelSec}>📊 Отчёты</div>
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {reportBtn(reportMode === 'day', () => setReportMode('day'), 'День')}
        {reportBtn(reportMode === 'week', () => setReportMode('week'), 'Неделя')}
        {reportBtn(reportMode === 'month', () => setReportMode('month'), 'Месяц')}
      </div>
      {reportMode === 'day' && <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ ...inputStyle, marginBottom:8 }} />}
      {reportMode === 'week' && <div style={{ display:'flex', gap:2, marginBottom:8 }}>
        {Array.from({length:7}, (_,i) => { const d = new Date(new Date(weekStart)); d.setDate(d.getDate()+i); const ds = d.toISOString().split('T')[0]; const hasData = !!raw[ds]; return <div key={i} style={{ flex:1, textAlign:'center', padding:'5px 2px', borderRadius:8, background: hasData ? 'rgba(0,230,138,0.12)' : '#202023', fontSize:8, color: hasData ? '#00e68a' : 'rgba(255,255,255,0.3)' }}>
          <div>{dayNames[i]}</div><div style={{ fontWeight:700, fontSize:11 }}>{d.getDate()}</div>
        </div>; })}
      </div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:6, marginBottom:8 }}>
        {[{l:'Ккал',v:Math.round(totals.kcal),c:'#00e68a'},{l:'Белки',v:Math.round(totals.p),c:'#3b82f6'},{l:'Жиры',v:Math.round(totals.f),c:'#f59e0b'},{l:'Угл.',v:Math.round(totals.c),c:'#f97316'},{l:'Ед.',v:totals.count,c:'#a78bfa'}].map((s,i) => <div key={i} style={{ background:'#202023', borderRadius:8, padding:'5px', textAlign:'center' }}>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{s.l}</div><div style={{ fontSize:15, fontWeight:800, color:s.c }}>{s.v}</div>
        </div>)}
      </div>
      {reportMode === 'day' && Object.keys(byMeal).length > 0 && <div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>По приёмам пищи:</div>
        {Object.entries(byMeal).map(([meal, vals]) => <div key={meal} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid #27272a', fontSize:9, color:'rgba(255,255,255,0.7)' }}>
          <span style={{ fontWeight:600 }}>{meal}</span>
          <span style={{ color:'rgba(255,255,255,0.4)' }}>{Math.round(vals.kcal)} ккал | Б{Math.round(vals.p)} Ж{Math.round(vals.f)} У{Math.round(vals.c)}</span>
        </div>)}
      </div>}
      {data.length > 0 && <div style={{ marginTop:6 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>Продукты:</div>
        <div style={{ maxHeight:150, overflowY:'auto' }}>
          {data.map((i:any, idx:number) => <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:8, color:'rgba(255,255,255,0.5)' }}>
            <span>{i.name} {i.meal ? <span style={{ color:'rgba(255,255,255,0.3)' }}>({i.meal})</span> : ''}</span>
            <span>{Math.round(i.kcal||0)}ккал</span>
          </div>)}
        </div>
      </div>}
    </div>
  </div>);
};

export const NutritionScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<ActiveTab>('mealplan');
  const [page, setPage] = useState<NutritionPage>('hero');
  const [nutritionSection, setNutritionSection] = useState<NutritionSection>('all');
  const [foodEntries, setFoodEntries] = useState<DiaryEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DiaryEntry[]>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nutrition_diary');
      if (raw) {
        const diary = JSON.parse(raw);
        const allEntries: DiaryEntry[] = [];
        const logs: Record<string, DiaryEntry[]> = {};
        Object.entries(diary).forEach(([date, d]: [string, any]) => {
          const dayEntries: DiaryEntry[] = [];
          Object.values(d.meals || {}).flat().forEach((m: any) => {
            const entry = { name: m.name, kcal: m.kcal, p: m.p, f: m.f, c: m.c, date };
            allEntries.push(entry);
            dayEntries.push(entry);
          });
          logs[date] = dayEntries;
        });
        setFoodEntries(allEntries);
        setDailyLogs(logs);
      }
    } catch {}
  }, []);

  const avgWeeklyKcal = useMemo(() => foodEntries.reduce((s, e) => s + e.kcal, 0) / Math.max(1, foodEntries.length / 7), [foodEntries]);
  const avgWeeklyProtein = useMemo(() => foodEntries.reduce((s, e) => s + e.p, 0) / Math.max(1, foodEntries.length / 7), [foodEntries]);
  const avgWeeklyFat = useMemo(() => foodEntries.reduce((s, e) => s + e.f, 0) / Math.max(1, foodEntries.length / 7), [foodEntries]);
  const avgWeeklyCarbs = useMemo(() => foodEntries.reduce((s, e) => s + e.c, 0) / Math.max(1, foodEntries.length / 7), [foodEntries]);

  const cartCount = useMemo(() => { try { return JSON.parse(localStorage.getItem('he_nutrition_cart') || '[]').length; } catch { return 0; } }, [tab]);

  const macroTargets = useMemo(() => {
    const s = linked.profile?.settings;
    if (!s?.weight) return { kcal: 2500, protein: 160, fats: 70, carbs: 300 };
    const pal = derivePAL(s.workoutsPerWeek, s.avgWorkoutMinutes);
    const goal = (s.primaryGoal as string) || 'maintenance';
    try {
      const t = calcNutrition({ weightKg: s.weight, heightCm: s.height || 175, age: s.age || 30, sex: s.sex || 'male', pal, goal });
      return { kcal: t.kcal, protein: t.protein, fats: t.fats, carbs: t.carbs };
    } catch { return { kcal: 2500, protein: 160, fats: 70, carbs: 300 }; }
  }, [linked.profile]);

  const renderContent = () => {
    switch (tab) {
      case 'diary': return <NutritionDiary foodEntries={foodEntries} targets={macroTargets} />;
      case 'charts': return <NutritionCharts kcalData={[avgWeeklyKcal]} proteinData={[avgWeeklyProtein]} labels={['']} dailyLogs={dailyLogs} />;
      case 'mealplan': return <IndividualPlan profile={linked.profile} course={linked.course} />;
      case 'cart': return <CartTab />;
      case 'restaurant': return <RestaurantTab />;
      case 'favorites': return <FavoritesTab />;
      case 'catalog': return <CatalogTab />;
      case 'reference': return <ReferenceTab />;
      case 'recipes': return <RecipesTab />;
      case 'reports': return <ReportsTab foodEntries={foodEntries} />;
      default: return null;
    }
  };

  const FavoritesTab: React.FC = () => {
    const [favs, setFavs] = useState<typeof FOOD_DB>(() => { try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); return ids.map(id => FOOD_DB.find(f => f.id === id)).filter(Boolean) as typeof FOOD_DB; } catch { return []; } });
    const removeFav = (id: string) => { try { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); localStorage.setItem('he_food_favs', JSON.stringify(ids.filter(f => f !== id))); setFavs(prev => prev.filter(f => f.id !== id)); } catch {} };
    return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ padding:14, ...cardBg }}>
        <div style={labelSec}>⭐ Избранное ({favs.length}/12)</div>
        {favs.length === 0 ? <div style={{ textAlign:'center', padding:16, color:'rgba(255,255,255,0.3)', fontSize:10 }}>Нет избранных. Добавляйте из каталога кнопкой ⭐.</div> : <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {favs.map(f => <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:10, background:'#202023', border:'1px solid #27272a' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{f.name}</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)' }}>{f.kcal}ккал • Б{f.protein} Ж{f.fat} У{f.carbs}</div>
            </div>
            <div style={{ display:'flex', gap:3, alignItems:'center' }}>
              <button onClick={() => addToCart({ name: f.name, kcal: f.kcal, amount: 100, category: f.category })} style={{ padding:'4px 7px', borderRadius:6, fontSize:9, cursor:'pointer', background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>🛒</button>
              <button onClick={() => removeFav(f.id)} style={{ padding:'4px 7px', borderRadius:6, border:'none', cursor:'pointer', background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:9 }}>✕</button>
            </div>
          </div>)}
        </div>}
      </div>
    </div>);
  };

  if (page === 'hero') {
    return (
      <div className="screen nutrition" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'auto', padding:0 }}>
        <div style={{ position:'relative', flex:1, minHeight:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <img src="/nutrition-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize:26, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)', letterSpacing:-0.5 }}>Питание</h1>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.9)', margin:'0 0 20px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
              План питания, дневник, графики, каталог продуктов
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { section: 'diary' as NutritionSection, tab: 'mealplan' as ActiveTab, icon: '🥗', title: 'Планирование питания', desc: 'Индивидуальный план, дневник, справочник, корзина', color: '#3b82f6' },
                { section: 'diary' as NutritionSection, tab: 'charts' as ActiveTab, icon: '📊', title: 'Аналитика питания', desc: 'Графики КБЖУ, отчёты, рецепты, рестораны', color: '#8b5cf6' },
              ].map(card => (
                <button key={card.tab} onClick={() => { setPage('tabs'); setNutritionSection(card.section); setTab(card.tab); }} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:16, cursor:'pointer', textAlign:'left', width:'100%',
                  background:'#18181b', border:'1px solid #27272a', color:'#fff',
                  transition:'all 0.2s',
                }}>
                  <div style={{ width:44, height:44, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: card.color + '25', fontSize:22 }}>{card.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, marginBottom:2, color: card.color, letterSpacing:-0.2 }}>{card.title}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', lineHeight:1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color: card.color, fontSize:18, opacity:0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen nutrition" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'auto', padding:0 }}>
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'8px 12px', flexShrink:0,
        background:'#18181b',
        borderBottom:'1px solid #27272a',
        position:'sticky', top:0, zIndex:20,
      }}>
        <button onClick={() => setPage('hero')} style={{
          padding:'4px 8px', cursor:'pointer', fontSize:20, color:'rgba(255,255,255,0.4)',
          border:'none', background:'transparent', display:'flex', alignItems:'center',
        }}>←</button>
        <div style={{ flex:1, fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>Питание</div>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>
          {nutritionSection === 'diary' ? 'Дневник' : 'Всё'}
        </span>
      </div>

      <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'0 8px 80px' }}>
        <div style={{
          display:'flex', gap:3, flexWrap:'nowrap', overflowX:'auto', overflowY:'hidden',
          padding:'8px 4px 10px',
          scrollbarWidth:'none', msOverflowStyle:'none',
          WebkitOverflowScrolling:'touch', whiteSpace:'nowrap',
        }}>
          {(SECTION_TABS[nutritionSection] || SECTION_TABS.all).map(t => {
            const isActive = tab === t;
            return (
              <button key={t} onClick={() => setTab(t as ActiveTab)} style={{
                flexShrink:0, padding:'6px 14px', borderRadius:20, cursor:'pointer',
                fontSize:10, fontWeight: isActive ? 700 : 500, letterSpacing:0.2,
                border: isActive ? '1px solid #00e68a' : '1px solid #27272a',
                background: isActive ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#18181b',
                color: isActive ? '#000' : 'rgba(255,255,255,0.5)',
                transition:'all 0.2s cubic-bezier(0.22,1,0.36,1)',
              }}>
                {TAB_LABELS[t] || t}
                {t === 'cart' && cartCount > 0 && (
                  <span style={{ marginLeft:3, background:'rgba(0,0,0,0.2)', borderRadius:8, padding:'1px 5px', fontSize:8, fontWeight:700 }}>{cartCount}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ animation:'fadeSlideIn 0.3s ease' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
