import React, { useState, useEffect, useMemo } from 'react';
import { calcNutrition } from '../../engines/nutrition.engine';
import { getProfile } from '../../core/profile-manager';
import { FOOD_DB } from '../../core/nutrition-database';
import { useDataLink, derivePAL } from '../../core/data-link';
import type { UserProfile } from '../../core/types';
import { generateWeeklyMealPlan, generateGroceryList, getFoodSwaps, getPortionGuide } from '../../engines/meal-planning-system.engine';
import { getRecipes } from '../../engines/nutrition-periodization.engine';
import { getRestaurantGuide, getTopAthleteChoices, getTravelWorkouts, getSleepStacks } from '../../engines/restaurant-travel-sleep.engine';
import { generateNutritionAdvice } from '../../engines/nutrition-full.engine';
import { NutritionDiary } from './NutritionScreen_parts/NutritionDiary';
import { NutritionCharts } from './NutritionScreen_parts/NutritionCharts';
import { NutritionCustomFood } from './NutritionScreen_parts/NutritionCustomFood';
import { IndividualPlan } from './NutritionScreen_parts/IndividualPlan';


interface DiaryEntry {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  date?: string;
}

type NutritionPage = 'hero' | 'tabs';
type NutritionSection = 'diary' | 'planning' | 'overview' | 'all';
type ActiveTab = 'diary' | 'charts' | 'mealplan' | 'grocery' | 'infocalc' | 'custom' | 'favorites' | 'catalog' | 'restaurant' | 'recipes' | 'reports';

const SECTION_TABS: Record<NutritionSection, string[]> = {
  diary: ['mealplan', 'diary', 'charts', 'favorites', 'catalog', 'recipes', 'restaurant', 'reports'],
  planning: ['mealplan', 'infocalc', 'grocery'],
  overview: [],
  all: ['mealplan', 'diary', 'charts', 'favorites', 'catalog', 'recipes', 'restaurant', 'reports', 'infocalc', 'grocery', 'custom'],
};

const TAB_LABELS: Record<string, string> = {
  diary: '📝 Дневник', charts: '📈 Графики',
  mealplan: '🥗 Планирование питания',
  infocalc: '📐 Калькуляторы',
  grocery: '🛒 Список', restaurant: '🍽 Ресторан', custom: '🍎 Своё',
  favorites: '⭐ Избранное', catalog: '📦 Каталог', recipes: '🍳 Рецепты', reports: '📊 Отчёты',
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

  const avgWeeklyKcal = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.kcal, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const avgWeeklyProtein = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.p, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const avgWeeklyFat = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.f, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const avgWeeklyCarbs = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.c, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const microsIntake = useMemo(() => {
    if (foodEntries.length === 0) return {};
    const totals: Record<string, number> = {};
    foodEntries.forEach(e => {
      const food = FOOD_DB.find(f => f.name === e.name || f.id === (e as any).id);
      if (food?.micros) {
        Object.entries(food.micros).forEach(([k, v]) => {
          totals[k] = (totals[k] || 0) + (v || 0);
        });
      }
    });
    // Normalize to daily average
    const days = Math.max(1, foodEntries.length / 7);
    Object.keys(totals).forEach(k => { totals[k] = Math.round(totals[k] / days); });
    return totals;
  }, [foodEntries]);

  const renderContent = () => {
    const s = linked.profile?.settings;
    const tKcal = linked.avgWeeklyKcal || (s?.weight ? Math.round(s.weight * 30) : 2200);
    const tProt = linked.avgWeeklyProtein || (s?.weight ? Math.round(s.weight * 2) : 140);
    const tFat = linked.avgWeeklyFat || Math.round(tKcal * 0.25 / 9);
    const tCarbs = linked.avgWeeklyCarbs || Math.round((tKcal - tProt * 4 - tFat * 9) / 4);
    switch (tab) {
      case 'infocalc': return <NutritionCalculators />;
      case 'recipes': return <RecipesTab />;
      case 'diary': return <NutritionDiary foodEntries={foodEntries} />;
      case 'charts': return <NutritionCharts kcalData={[avgWeeklyKcal]} proteinData={[avgWeeklyProtein]} labels={['']} dailyLogs={dailyLogs} />;
      case 'mealplan': return <IndividualPlan profile={linked.profile} course={linked.course} />;
      case 'grocery': return <GroceryTab tKcal={tKcal} tProt={tProt} />;
      case 'restaurant': return <RestaurantTab />;
      case 'custom': return <NutritionCustomFood />;
      case 'favorites': return <FavoritesTab />;
      case 'catalog': return <CatalogTab />;
      case 'reports': return <ReportsTab foodEntries={foodEntries} />;
      default: return null;
    }
  };

  return (
    <div className="screen nutrition" style={{ flex: 1, minHeight: 0, display:'flex', flexDirection:'column', overflow:'auto', padding: 0 }}>

      {/* ─── HERO PAGE ─── */}
      {page === 'hero' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/nutrition-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 14px rgba(0,0,0,0.9)' }}>Питание</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px', lineHeight: 1.3, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
              Дневник питания, графики, планирование и калькуляторы
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { section: 'diary' as NutritionSection, tab: 'mealplan', icon: '🥗', title: 'Планирование питания', desc: 'План, дневник, графики, избранное, каталог', color: '#3b82f6' },
                { section: 'planning' as NutritionSection, tab: 'mealplan', icon: '🧮', title: 'Калькуляторы и список', desc: 'Расчёты КБЖУ, продуктовый список, свои продукты', color: '#22c55e' },
              ].map(card => (
                <button key={card.section} onClick={() => { setPage('tabs'); setNutritionSection(card.section); setTab(card.tab as any); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'rgba(20,22,30,0.35)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: card.color + '18', fontSize: 20,
                  }}>
                    {card.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: card.color }}>{card.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color: card.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TOP NAV BAR (only when not on hero) ─── */}
      {page !== 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setPage('hero')} style={{
            padding: '6px 8px', cursor: 'pointer', fontSize: 14,
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: 600,
          }}>← На главную</button>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 'auto' }}>
            {nutritionSection === 'diary' ? 'Дневник' : nutritionSection === 'planning' ? 'Планирование' : nutritionSection === 'overview' ? 'Общая информация' : 'Всё'}
          </span>
        </div>
      )}

      {/* ─── TABS CONTENT (only when not on hero) ─── */}
      {page !== 'hero' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 70px' }}>
          <div className="tab-bar">
            {(SECTION_TABS[nutritionSection] || SECTION_TABS.all).map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t as any)}>
                {TAB_LABELS[t] || t}
              </button>
            ))}
          </div>
          {renderContent()}
        </div>
      )}

    </div>
  );
};

const MealPlan: React.FC<{ profile: UserProfile | null }> = ({ profile }) => {
  const pal = profile ? derivePAL(profile.settings?.workoutsPerWeek, profile.settings?.avgWorkoutMinutes) : 1.55;
  const s = profile?.settings;
  const targets = calcNutrition({
    weightKg: s?.weight ?? 80, heightCm: s?.height ?? 180, age: s?.age ?? 30,
    sex: s?.sex ?? 'male', pal, goal: s?.primaryGoal ?? s?.goal ?? 'maintenance',
    bodyFatPercent: s?.bodyFat,
  });

  const meals = useMemo(() => {
    const proteinFoods = FOOD_DB.filter(f => f.category === 'protein').sort(() => Math.random() - 0.5);
    const carbFoods = FOOD_DB.filter(f => f.category === 'carb' || f.category === 'grain').sort(() => Math.random() - 0.5);
    const fatFoods = FOOD_DB.filter(f => f.category === 'fat').sort(() => Math.random() - 0.5);
    const vegFoods = FOOD_DB.filter(f => f.category === 'veg_fruit').sort(() => Math.random() - 0.5);

    const plan = [
      { name: '', items: [proteinFoods[0], carbFoods[0], vegFoods[0]].filter(Boolean) },
      { name: '', items: [proteinFoods[1], carbFoods[1] || carbFoods[0], vegFoods[1] || vegFoods[0]].filter(Boolean) },
      { name: '', items: [carbFoods[2] || carbFoods[0]].filter(Boolean) },
      { name: '', items: [proteinFoods[2] || proteinFoods[0], carbFoods[3] || carbFoods[1] || carbFoods[0]].filter(Boolean) },
      { name: '', items: [proteinFoods[3] || proteinFoods[1], fatFoods[0], vegFoods[2] || vegFoods[1] || vegFoods[0]].filter(Boolean) },
      { name: '', items: [proteinFoods.find(f => f.id === 'egg_white' || f.id === 'casein') || proteinFoods[4] || proteinFoods[0]].filter(Boolean) },
    ];

    return plan.map(m => ({
      ...m,
      totalKcal: Math.round(m.items.reduce((s, f) => s + (f?.kcal || 0), 0)),
      totalP: Math.round(m.items.reduce((s, f) => s + (f?.protein || 0), 0)),
      totalF: Math.round(m.items.reduce((s, f) => s + (f?.fat || 0), 0)),
      totalC: Math.round(m.items.reduce((s, f) => s + (f?.carbs || 0), 0)),
    }));
  }, [targets]);

  const totalKcal = Math.round(meals.reduce((s, m) => s + m.totalKcal, 0));
  const totalP = Math.round(meals.reduce((s, m) => s + m.totalP, 0));
  const totalF = Math.round(meals.reduce((s, m) => s + m.totalF, 0));
  const totalC = Math.round(meals.reduce((s, m) => s + m.totalC, 0));

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>🍽️ План питания</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          Сгенерирован под цель: {targets?.kcal || 2500} ккал | Б: {targets?.protein || 160}г Ж: {targets?.fats || 70}г У: {targets?.carbs || 250}г
        </p>
      </div>

      {meals.map((meal, mi) => (
        <div key={mi} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 13 }}>{meal.name}</h4>
            <span style={{ fontSize: 9, display:'flex', gap:4, flexWrap:'wrap' }}>
              <b style={{ color:'#00e68a' }}>{meal.totalKcal} ккал</b>
              <span style={{ color:'#3b82f6' }}>Б:{meal.totalP}г</span>
              <span style={{ color:'#f59e0b' }}>Ж:{meal.totalF}г</span>
              <span style={{ color:'#f97316' }}>У:{meal.totalC}г</span>
            </span>
          </div>
          {meal.items.map((food, fi) => food && (
            <div key={fi} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, borderBottom: fi < meal.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span>{food.name}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 9, display:'flex', gap:4, flexWrap:'wrap' }}>
                <b style={{ color:'#00e68a' }}>{food.kcal} ккал</b>
                <span style={{ color:'#3b82f6' }}>Б:{food.protein}г</span>
                <span style={{ color:'#f59e0b' }}>Ж:{food.fat}г</span>
                <span style={{ color:'#f97316' }}>У:{food.carbs}г</span>
              </span>
            </div>
          ))}
        </div>
      ))}

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Итого за день</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', color: '#00e68a', fontSize: 10, fontWeight: 700 }}>Ккал: {Math.round(totalKcal)}</span>
          <span style={{ padding: '3px 8px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 10, fontWeight: 700 }}>Б: {Math.round(totalP)}г</span>
          <span style={{ padding: '3px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>Ж: {Math.round(totalF)}г</span>
          <span style={{ padding: '3px 8px', borderRadius: 10, background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: 10, fontWeight: 700 }}>У: {Math.round(totalC)}г</span>
        </div>
      </div>
    </div>
  );
};

const GroceryTab: React.FC<{ tKcal: number; tProt: number }> = ({ tKcal, tProt }) => {
  const weeklyPlan = React.useMemo(() => generateWeeklyMealPlan([1,3,5], 'bulk', tKcal, tProt), [tKcal, tProt]);
  const grocery = React.useMemo(() => generateGroceryList(weeklyPlan), [weeklyPlan]);
  const swaps = React.useMemo(() => getFoodSwaps(), []);
  const portions = React.useMemo(() => getPortionGuide(), []);
  return (<div>
    {grocery.length > 0 && <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>🛒 Список закупок</h4>{grocery.map((cat:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10,color:'var(--accent)'}}>{cat.category}</b>{cat.items.map((it:any,j:number)=><div key={j} style={{fontSize:9,paddingLeft:8}}>• {it.name} — {it.quantity}</div>)}</div>)}</div>}
    <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>🔄 Замены</h4>{swaps.map((s:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 0'}}><span style={{color:'#ef4444'}}>{s.original}</span> → <span style={{color:'#22c55e'}}>{s.replacement}</span></div>)}</div>
    <div className="card"><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>✋ Порции</h4>{portions.map((p:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 0'}}>{p.visual} = {p.food} ({p.kcal}ккал)</div>)}</div>
  </div>);
};

const RestaurantTab: React.FC = () => {
  const guide = React.useMemo(() => getRestaurantGuide(), []);
  const top = React.useMemo(() => getTopAthleteChoices(), []);
  const travels = React.useMemo(() => getTravelWorkouts(), []);
  const sleepStacks = React.useMemo(() => getSleepStacks(), []);
  const [selectedItem, setSelectedItem] = React.useState<string | null>(null);
  const [restSearch, setRestSearch] = React.useState('');

  const fastFoodItems = React.useMemo(() => {
    return FOOD_DB.filter(f => f.category === 'fast_food');
  }, []);

  const filteredItems = React.useMemo(() => {
    if (!restSearch.trim()) return fastFoodItems;
    const q = restSearch.toLowerCase();
    return fastFoodItems.filter(f => f.name.toLowerCase().includes(q));
  }, [fastFoodItems, restSearch]);

  return (<div>
    <div className="card" style={{ marginBottom: 8 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>🍽 Блюда и калорийность ({fastFoodItems.length})</h4>
      <input
        placeholder="🔍 Поиск блюда..."
        value={restSearch}
        onChange={e => setRestSearch(e.target.value)}
        style={{ width:'100%', padding:'7px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box', marginBottom:8 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredItems.map((item) => {
          const isExpanded = selectedItem === item.id;
          const total = item.protein + item.fat + item.carbs;
          const pWidth = total > 0 ? Math.round((item.protein / total) * 100) : 33;
          const fWidth = total > 0 ? Math.round((item.fat / total) * 100) : 33;
          const cWidth = total > 0 ? Math.round((item.carbs / total) * 100) : 34;
          return (
            <div key={item.id} onClick={() => setSelectedItem(isExpanded ? null : item.id)} style={{
              padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
              background: isExpanded ? 'rgba(0,230,138,0.06)' : 'var(--bg-secondary)',
              border: isExpanded ? '1px solid rgba(0,230,138,0.2)' : '1px solid var(--border)',
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 10, color: 'var(--text)' }}>{item.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{item.kcal} ккал</span>
              </div>
              <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ flex: pWidth || 0.1, background: '#3b82f6', minWidth: pWidth > 0 ? 12 : 0 }} />
                <div style={{ flex: fWidth || 0.1, background: '#f59e0b', minWidth: fWidth > 0 ? 12 : 0 }} />
                <div style={{ flex: cWidth || 0.1, background: '#f97316', minWidth: cWidth > 0 ? 12 : 0 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 8, color: 'var(--text-dim)' }}>
                <span>Б: <b style={{ color: '#3b82f6' }}>{item.protein}г</b></span>
                <span>Ж: <b style={{ color: '#f59e0b' }}>{item.fat}г</b></span>
                <span>У: <b style={{ color: '#f97316' }}>{item.carbs}г</b></span>
                {item.servingSize && <span style={{ color:'rgba(255,255,255,0.5)' }}>{item.servingSize}</span>}
              </div>
              {isExpanded && (
                <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  <div>Полный состав на порцию: {item.kcal} ккал</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                    <span>🔵 Белки: {item.protein}г ({Math.round(item.protein * 4)} ккал)</span>
                    <span>🟡 Жиры: {item.fat}г ({Math.round(item.fat * 9)} ккал)</span>
                    <span>🟠 Углеводы: {item.carbs}г ({Math.round(item.carbs * 4)} ккал)</span>
                  </div>
                  {item.fiber !== undefined && <div style={{ marginTop: 2 }}>Клетчатка: {item.fiber}г | ГИ: {item.gi || '—'}</div>}
                </div>
              )}
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div style={{ textAlign:'center', padding:12, color:'var(--text-dim)', fontSize:10 }}>Ничего не найдено</div>
        )}
      </div>
    </div>
  </div>);
};

const FoodDbSyncCard: React.FC = () => {
  const FOOD_DB_VERSION = '2026.06.15';
  const CHANGELOG = [
    '+ Куриная грудка (варёная, жареная, гриль) — 38 продуктов',
    '+ Рыба (лосось, тунец, треска, скумбрия, форель) — 22 продукта',
    '+ Молочные (творог 0/5/9%, сыр, йогурт, кефир) — 18 продуктов',
    '+ Крупы и гарниры (гречка, рис, булгур, киноа) — 15 продуктов',
    '+ Овощи и фрукты с микронутриентами — 35 продуктов',
    '+ Орехи и семена — 12 продуктов',
    '+ Спортивное питание (протеин, гейнер, BCAAs) — 8 продуктов',
    '+ Микронутриенты (витамины, минералы) добавлены ко всем позициям',
  ];
  const [synced, setSynced] = React.useState(false);
  const [showChangelog, setShowChangelog] = React.useState(false);
  const [version, setVersion] = React.useState(() => localStorage.getItem('foodDbVersion') || FOOD_DB_VERSION);
  const hasUpdate = version !== FOOD_DB_VERSION;

  const handleCheckUpdate = () => {
    if (hasUpdate) {
      localStorage.setItem('foodDbVersion', FOOD_DB_VERSION);
      setVersion(FOOD_DB_VERSION);
      setSynced(true);
    }
  };

  return (
    <div className="card" style={{ padding: 10, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🔄</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)' }}>Обновление базы продуктов</div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            Версия БД: <span style={{ color: hasUpdate ? '#f59e0b' : 'var(--accent)', fontWeight: 600 }}>{version}</span>
            {hasUpdate && <span style={{ color: '#f59e0b', marginLeft: 6 }}>Доступна: {FOOD_DB_VERSION}</span>}
            {synced && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>✓ Обновлено</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleCheckUpdate}
          disabled={!hasUpdate && synced}
          style={{
            padding: '6px 12px', borderRadius: 8, cursor: hasUpdate ? 'pointer' : 'default',
            background: hasUpdate ? 'var(--accent)' : 'var(--bg-secondary)',
            color: hasUpdate ? '#000' : 'var(--text-dim)',
            border: '1px solid var(--border)', fontWeight: 700, fontSize: 10,
            opacity: !hasUpdate && synced ? 0.5 : 1,
          }}
        >
          {hasUpdate ? '⬇ Обновить базу' : synced ? '✓ Актуально' : 'Проверить обновления'}
        </button>
        <button
          onClick={() => setShowChangelog(!showChangelog)}
          style={{
            padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--bg-secondary)', color: 'var(--text-dim)',
            border: '1px solid var(--border)', fontWeight: 700, fontSize: 10,
          }}
        >
          {showChangelog ? '▲ Скрыть' : '📋 Изменения'}
        </button>
      </div>
      {showChangelog && (
        <div style={{ marginTop: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: '6px 10px', maxHeight: 160, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4 }}>Последнее обновление ({FOOD_DB_VERSION}):</div>
          {CHANGELOG.map((item, i) => (
            <div key={i} style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.6 }}>{item}</div>
          ))}
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>Всего в базе: 150+ продуктов с микронутриентами</div>
        </div>
      )}
    </div>
  );
};

const RecipesTab: React.FC = () => {
  const recipes = React.useMemo(() => getRecipes(), []);
  const [recSearch, setRecSearch] = React.useState('');
  const [recMeal, setRecMeal] = React.useState('all');
  const filtered = React.useMemo(() => {
    let list = recipes;
    if (recMeal !== 'all') list = list.filter(r => r.meal === recMeal);
    if (recSearch) { const q = recSearch.toLowerCase(); list = list.filter(r => r.name.toLowerCase().includes(q) || r.ingredients.some(i => i.toLowerCase().includes(q))); }
    return list.slice(0, 20);
  }, [recipes, recMeal, recSearch]);
  return (
    <div>
      <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
        <input value={recSearch} onChange={e => setRecSearch(e.target.value)} placeholder="🔍 Поиск по названию или ингредиенту..." style={{ flex:1, minWidth:120, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }} />
        <select value={recMeal} onChange={e => setRecMeal(e.target.value)} style={{ padding:'6px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:10 }}>
          <option value="all">Все приёмы</option>
          <option value="breakfast">Завтрак</option>
          <option value="lunch">Обед</option>
          <option value="dinner">Ужин</option>
          <option value="snack">Перекус</option>
        </select>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {filtered.map((r, i) => (
          <div key={i} className="card" style={{ padding:10, marginBottom:4 }}>
            <div style={{ fontWeight:600, fontSize:12, color:'var(--text-light)' }}>{r.name}</div>
            <div style={{ display:'flex', gap:6, fontSize:9, color:'var(--text-dim)', marginTop:2, flexWrap:'wrap' }}>
              <span>🔥 {r.kcal} ккал</span>
              <span style={{ color:'#22c55e' }}>Б {r.protein}г</span>
              <span style={{ color:'#f59e0b' }}>Ж {r.fat}г</span>
              <span style={{ color:'#3b82f6' }}>У {r.carbs}г</span>
              <span>⏱ {r.prepTimeMin} мин</span>
            </div>
            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:4 }}>
              {r.ingredients.map((ing, j) => <span key={j} style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:'rgba(255,255,255,0.04)', color:'var(--text-dim)' }}>{ing}</span>)}
            </div>
            {r.instructions && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:4, lineHeight:1.4 }}>👨‍🍳 {r.instructions[0]}{r.instructions.length > 1 ? ' → ' + r.instructions.slice(1).join(' → ') : ''}</div>}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign:'center', padding:20, color:'var(--text-dim)', fontSize:11 }}>Рецепты не найдены</div>}
      </div>
    </div>
  );
};

const QuickAdviceCard: React.FC = () => {
  const s = getProfile()?.settings;
  const targets = { kcal: s?.weight ? Math.round(s.weight * 30) : 2500, protein: s?.weight ? Math.round(s.weight * 2) : 160, fats: Math.round((s?.weight || 80) * 0.8), carbs: 300, water: 3, fiber: 30, steps: 8000, vitaminD: 2000, potassium: 3500, iron: 12, calcium: 800, sodium: 2300 };
  const advice = React.useMemo(() => generateNutritionAdvice(targets as any, {kcal:2000,pro:120,fiber:20,water:2,steps:6000}), []);
  return (<div className="card" style={{ padding:10, marginTop:8 }}>
    <h4 style={{ margin:'0 0 4px',fontSize:12 }}>💡 Совет по питанию</h4>
    <div style={{ fontSize:9,color:'var(--text-light)',lineHeight:1.6 }}>{advice}</div>
  </div>);
};

const NutritionCalculators: React.FC = () => {
  const [dTdee, setDTdee] = useState(2500);
  const [dTarget, setDTarget] = useState(2000);
  const [dResult, setDResult] = useState<{ deficit: number; rateKgWeek: number } | null>(null);
  const [mWeight, setMWeight] = useState(70);
  const [mHeight, setMHeight] = useState(175);
  const [mAge, setMAge] = useState(25);
  const [mSex, setMSex] = useState<'male' | 'female'>('male');
  const [mPal, setMPal] = useState(1.55);
  const [mGoal, setMGoal] = useState('maintenance');
  const [mResult, setMResult] = useState<{ kcal: number; protein: number; fats: number; carbs: number; water: number; fiber: number } | null>(null);
  const [hGlucose, setHGlucose] = useState(5.0);
  const [hInsulin, setHInsulin] = useState(10);
  const [hResult, setHResult] = useState<{ index: number; resistant: boolean } | null>(null);

  const calcDeficit = () => {
    const deficit = dTdee - dTarget;
    setDResult({ deficit, rateKgWeek: deficit / 7700 });
  };

  const calcMacros = () => {
    const t = calcNutrition({ weightKg: mWeight, heightCm: mHeight, age: mAge, sex: mSex, pal: mPal, goal: mGoal });
    setMResult({ kcal: t.kcal, protein: t.protein, fats: t.fats, carbs: t.carbs, water: t.water, fiber: t.fiber });
  };

  const calcHOMA = () => {
    const index = (hGlucose * hInsulin) / 22.5;
    setHResult({ index, resistant: index > 2.5 });
  };

  const PAL_OPTS = [
    { v: 1.2, l: 'Сидячий (1.2)' }, { v: 1.375, l: 'Легкий (1.375)' },
    { v: 1.55, l: 'Умеренный (1.55)' }, { v: 1.725, l: 'Высокий (1.725)' },
    { v: 1.9, l: 'Экстремальный (1.9)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="card" style={{ padding: '10px 12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🔥 Калорийный дефицит</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>TDEE (ккал/день)</label>
            <input type="number" value={dTdee} onChange={e => setDTdee(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Целевые ккал/день</label>
            <input type="number" value={dTarget} onChange={e => setDTarget(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={calcDeficit} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
        {dResult !== null && (
          <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>{dResult.deficit > 0 ? `Дефицит ${dResult.deficit} ккал/день` : 'Нет дефицита'}</div>
            <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4 }}>Потеря веса: {Math.round(dResult.rateKgWeek)} кг/нед</div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '10px 12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚖️ Расчёт макросов</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
            <input type="number" value={mWeight} onChange={e => setMWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рост (см)</label>
            <input type="number" value={mHeight} onChange={e => setMHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Возраст</label>
            <input type="number" value={mAge} onChange={e => setMAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Пол</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['male', 'female'] as const).map(s => (
                <button key={s} onClick={() => setMSex(s)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  background: mSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: mSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: mSex === s ? '#00e68a' : 'var(--text-dim)', fontWeight: mSex === s ? 700 : 400,
                }}>{s === 'male' ? 'Мужской' : 'Женский'}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>PAL</label>
            <select value={mPal} onChange={e => setMPal(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
              {PAL_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Цель</label>
            <select value={mGoal} onChange={e => setMGoal(e.target.value)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
              <option value="bulk">Набор массы</option>
              <option value="cut">Снижение веса</option>
              <option value="maintenance">Поддержание</option>
              <option value="recomp">Рекомпозиция</option>
              <option value="rehab">Реабилитация</option>
            </select>
          </div>
        </div>
        <button onClick={calcMacros} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
        {mResult !== null && (
          <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center', fontSize: 11 }}>
              <div><span style={{ color: 'var(--text-light)' }}>Ккал</span><div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>{mResult.kcal}</div></div>
              <div><span style={{ color: 'var(--text-light)' }}>Белки</span><div style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6' }}>{mResult.protein}г</div></div>
              <div><span style={{ color: 'var(--text-light)' }}>Жиры</span><div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>{mResult.fats}г</div></div>
              <div><span style={{ color: 'var(--text-light)' }}>Углеводы</span><div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>{mResult.carbs}г</div></div>
              <div><span style={{ color: 'var(--text-light)' }}>Вода</span><div style={{ fontSize: 15, fontWeight: 700, color: '#06b6d4' }}>{mResult.water}л</div></div>
              <div><span style={{ color: 'var(--text-light)' }}>Клетчатка</span><div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e' }}>{mResult.fiber}г</div></div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '10px 12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🩸 HOMA-IR</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Глюкоза (ммоль/л)</label>
            <input type="number" step="0.1" value={hGlucose} onChange={e => setHGlucose(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Инсулин (μЕ/мл)</label>
            <input type="number" step="0.1" value={hInsulin} onChange={e => setHInsulin(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={calcHOMA} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
        {hResult !== null && (
          <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>{Math.round(hResult.index * 10) / 10}</div>
            <div style={{ fontSize: 13, color: hResult.resistant ? '#ef4444' : 'var(--accent)', marginTop: 4 }}>{hResult.resistant ? 'Инсулинорезистентность (>2.5)' : 'Норма'}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Favorites Tab (избранное + свои продукты) ──
interface FavItem { id: string; name: string; kcal: number; p: number; f: number; c: number; _type: 'fav' | 'custom'; }

const FavoritesTab: React.FC = () => {
  const [foodSearch, setFoodSearch] = React.useState('');
  const [favs, setFavs] = React.useState<FavItem[]>(() => {
    const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]');
    return ids.map(id => {
      const f = FOOD_DB.find(db => db.id === id);
      if (!f) return null;
      return { id: f.id, name: f.name, kcal: f.kcal, p: f.protein, f: f.fat, c: f.carbs, _type: 'fav' as const };
    }).filter(Boolean) as FavItem[];
  });
  const [customFoods, setCustomFoods] = React.useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_custom_foods') || '[]'); } catch { return []; } });
  const [newName, setNewName] = React.useState(''); const [newKcal, setNewKcal] = React.useState(0); const [newP, setNewP] = React.useState(0); const [newF, setNewF] = React.useState(0); const [newC, setNewC] = React.useState(0);
  const saveCustom = () => { if (!newName.trim()) return; const food = { id:'custom_'+Date.now(), name:newName, kcal:newKcal, p:newP, f:newF, c:newC }; const updated = [...customFoods, food]; setCustomFoods(updated); localStorage.setItem('he_custom_foods', JSON.stringify(updated)); setNewName(''); setNewKcal(0); setNewP(0); setNewF(0); setNewC(0); };
  const deleteCustom = (id: string) => { const updated = customFoods.filter((f:any) => f.id !== id); setCustomFoods(updated); localStorage.setItem('he_custom_foods', JSON.stringify(updated)); };
  const removeFav = (id: string) => { const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); const updated = ids.filter(fid => fid !== id); localStorage.setItem('he_food_favs', JSON.stringify(updated)); setFavs(prev => prev.filter(f => f.id !== id)); };
  const addToDiary = (food: FavItem) => {
    const raw = localStorage.getItem('nutrition_diary');
    const diary = raw ? JSON.parse(raw) : {};
    const today = new Date().toISOString().split('T')[0];
    if (!diary[today]) diary[today] = { meals: { 'Приём пищи': [] } };
    diary[today].meals['Приём пищи'].push({ name:food.name, qty:'100 г', kcal:food.kcal || 0, p:food.p || 0, f:food.f || 0, c:food.c || 0 });
    localStorage.setItem('nutrition_diary', JSON.stringify(diary));
  };
  const allItems: FavItem[] = [
    ...favs,
    ...customFoods.map((f:any) => ({ id:f.id, name:f.name, kcal:f.kcal, p:f.p || f.protein || 0, f:f.f || f.fat || 0, c:f.c || f.carbs || 0, _type:'custom' as const })),
  ];
  const filtered = allItems.filter(f => !foodSearch || f.name.toLowerCase().includes(foodSearch.toLowerCase()));
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, marginBottom:6 }}>⭐ Избранное и свои продукты</div>
      <input value={foodSearch} onChange={e => setFoodSearch(e.target.value)} placeholder="🔍 Поиск..." style={{ width:'100%', padding:'7px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box', marginBottom:8 }} />
      <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
        {filtered.map(f => <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize:10, fontWeight:500 }}>{f.name}</span>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{f.kcal}ккал Б{f.p} Ж{f.f} У{f.c}</span>
            <button onClick={() => addToDiary(f)} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a' }}>+Дневник</button>
            {f._type === 'fav' ? <button onClick={() => removeFav(f.id)} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>
            : <button onClick={() => deleteCustom(f.id)} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
          </div>
        </div>)}
      </div>
    </div>
    {/* Add custom food */}
    <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, marginBottom:6 }}>➕ Добавить свой продукт</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:4, marginBottom:6 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название" style={{ padding:'5px', borderRadius:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:9 }} />
        <input type="number" value={newKcal || ''} onChange={e => setNewKcal(+e.target.value)} placeholder="Ккал" style={{ padding:'5px', borderRadius:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:9 }} />
        <input type="number" value={newP || ''} onChange={e => setNewP(+e.target.value)} placeholder="Белки" style={{ padding:'5px', borderRadius:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:9 }} />
        <input type="number" value={newF || ''} onChange={e => setNewF(+e.target.value)} placeholder="Жиры" style={{ padding:'5px', borderRadius:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:9 }} />
        <input type="number" value={newC || ''} onChange={e => setNewC(+e.target.value)} placeholder="Угл." style={{ padding:'5px', borderRadius:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:9 }} />
      </div>
      <button onClick={saveCustom} style={{ width:'100%', padding:7, borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:600, fontSize:10 }}>💾 Сохранить</button>
    </div>
  </div>);
};

// ── Catalog Tab ──
const CatalogTab: React.FC = () => {
  const [catSearch, setCatSearch] = React.useState('');
  const [catFilter, setCatFilter] = React.useState('all');
  const categories = [...new Set(FOOD_DB.map(f => f.category || 'other'))];
  const addFav = (food: { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number }) => {
    const ids: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]');
    const updated = [food.id, ...ids.filter(f => f !== food.id)].slice(0, 12);
    localStorage.setItem('he_food_favs', JSON.stringify(updated));
  };
  const filtered = FOOD_DB.filter(f => {
    if (catFilter !== 'all' && f.category !== catFilter) return false;
    if (catSearch && !f.name.toLowerCase().includes(catSearch.toLowerCase())) return false;
    return true;
  });
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, marginBottom:6 }}>📦 Каталог продуктов ({FOOD_DB.length})</div>
      <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="🔍 Поиск..." style={{ width:'100%', padding:'7px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box', marginBottom:6 }} />
      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
        <button onClick={() => setCatFilter('all')} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border: catFilter==='all' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: catFilter==='all' ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color:'var(--text)' }}>Все</button>
        {categories.map(c => <button key={c} onClick={() => setCatFilter(c)} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, cursor:'pointer', border: catFilter===c ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: catFilter===c ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color:'var(--text)' }}>{c}</button>)}
      </div>
      <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
        {filtered.map(f => <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)' }}>
          <div><span style={{ fontSize:10, fontWeight:500 }}>{f.name}</span><span style={{ fontSize:7, color:'rgba(255,255,255,0.2)', marginLeft:4 }}>{f.category}</span></div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{f.kcal}ккал</span>
            <button onClick={() => addFav(f)} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6' }}>+В избранное</button>
          </div>
        </div>)}
      </div>
    </div>
  </div>);
};

// ── Reports Tab ──
const ReportsTab: React.FC<{ foodEntries: DiaryEntry[] }> = ({ foodEntries }) => {
  const [reportMode, setReportMode] = React.useState<'day'|'week'|'month'>('day');
  const [reportDate, setReportDate] = React.useState(new Date().toISOString().split('T')[0]);
  const raw = React.useMemo(() => { try { return JSON.parse(localStorage.getItem('nutrition_diary') || '{}'); } catch { return {}; } }, [foodEntries]);
  const dayData = raw[reportDate];
  const weekStart = React.useMemo(() => { const d = new Date(reportDate); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0]; }, [reportDate]);
  const weekData = React.useMemo(() => {
    const start = new Date(weekStart);
    const entries: any[] = [];
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(d.getDate() + i); const ds = d.toISOString().split('T')[0]; if (raw[ds]) Object.values(raw[ds].meals || {}).forEach((m:any) => m.forEach((e:any) => entries.push({...e, date:ds}))); }
    return entries;
  }, [raw, weekStart]);
  const monthKey = reportDate.slice(0, 7);
  const monthData = React.useMemo(() => {
    const entries: any[] = [];
    Object.entries(raw).forEach(([date, d]: [string, any]) => { if (date.startsWith(monthKey)) Object.values(d.meals || {}).forEach((m:any) => m.forEach((e:any) => entries.push({...e, date}))); });
    return entries;
  }, [raw, monthKey]);
  const data = reportMode === 'day' ? (dayData ? Object.entries(dayData.meals || {}).flatMap(([meal, items]: [string, any]) => (items||[]).map((i:any) => ({...i, meal}))) : [])
    : reportMode === 'week' ? weekData : monthData;
  const totals = { kcal: data.reduce((s,i:any)=>s+(i.kcal||0),0), p: data.reduce((s,i:any)=>s+(i.p||0),0), f: data.reduce((s,i:any)=>s+(i.f||0),0), c: data.reduce((s,i:any)=>s+(i.c||0),0), count: data.length };
  const byMeal: Record<string, {kcal:number;p:number;f:number;c:number;count:number}> = {};
  (reportMode === 'day' && dayData ? Object.entries(dayData.meals || {}) : []).forEach(([meal, items]: [string, any]) => {
    const mealItems = (items||[]);
    byMeal[meal] = { kcal: mealItems.reduce((s:number,i:any)=>s+(i.kcal||0),0), p: mealItems.reduce((s:number,i:any)=>s+(i.p||0),0), f: mealItems.reduce((s:number,i:any)=>s+(i.f||0),0), c: mealItems.reduce((s:number,i:any)=>s+(i.c||0),0), count: mealItems.length };
  });
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  return (<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ padding:12, borderRadius:14, background:'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, marginBottom:6 }}>📊 Отчёты</div>
      <div style={{ display:'flex', gap:4, marginBottom:6 }}>
        {(['day','week','month'] as const).map(m => <button key={m} onClick={() => setReportMode(m)} style={{ padding:'4px 10px', borderRadius:6, fontSize:9, cursor:'pointer', border: reportMode===m ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: reportMode===m ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color:'var(--text)', fontWeight: reportMode===m ? 700 : 400 }}>{m === 'day' ? 'День' : m === 'week' ? 'Неделя' : 'Месяц'}</button>)}
      </div>
      {reportMode === 'day' && <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ width:'100%', padding:'6px', borderRadius:6, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:10, boxSizing:'border-box', marginBottom:6 }} />}
      {/* Week row */}
      {reportMode === 'week' && <div style={{ display:'flex', gap:2, marginBottom:6 }}>
        {Array.from({length:7}, (_,i) => { const d = new Date(new Date(weekStart)); d.setDate(d.getDate()+i); const ds = d.toISOString().split('T')[0]; const hasData = !!raw[ds]; return <div key={i} style={{ flex:1, textAlign:'center', padding:'4px 2px', borderRadius:6, background: hasData ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)', fontSize:8, color: hasData ? '#00e68a' : 'rgba(255,255,255,0.3)' }}>
          <div>{dayNames[i]}</div><div style={{ fontWeight:700 }}>{d.getDate()}</div>
        </div>; })}
      </div>}
      {/* Totals */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:4, marginBottom:6 }}>
        {[{l:'Ккал',v:Math.round(totals.kcal),c:'#00e68a'},{l:'Белки',v:Math.round(totals.p),c:'#3b82f6'},{l:'Жиры',v:Math.round(totals.f),c:'#f59e0b'},{l:'Угл.',v:Math.round(totals.c),c:'#f97316'},{l:'Продуктов',v:totals.count,c:'#a78bfa'}].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'4px', textAlign:'center' }}>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>{s.l}</div><div style={{ fontSize:14, fontWeight:800, color:s.c }}>{s.v}</div>
        </div>)}
      </div>
      {/* By meal type */}
      {reportMode === 'day' && Object.keys(byMeal).length > 0 && <div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>По приёмам пищи:</div>
        {Object.entries(byMeal).map(([meal, vals]) => <div key={meal} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', fontSize:9 }}>
          <span style={{ fontWeight:600 }}>{meal}</span>
          <span style={{ color:'rgba(255,255,255,0.4)' }}>{Math.round(vals.kcal)} ккал | Б{Math.round(vals.p)} Ж{Math.round(vals.f)} У{Math.round(vals.c)}</span>
        </div>)}
      </div>}
      {/* Product list */}
      {data.length > 0 && <div style={{ marginTop:6 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>Продукты:</div>
        <div style={{ maxHeight:150, overflowY:'auto' }}>
          {data.map((i:any, idx:number) => <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:8, color:'rgba(255,255,255,0.4)' }}>
            <span>{i.name} {i.meal ? <span style={{ color:'rgba(255,255,255,0.2)' }}>({i.meal})</span> : ''}</span>
            <span>{Math.round(i.kcal||0)}ккал</span>
          </div>)}
        </div>
      </div>}
    </div>
  </div>);
};
