import React, { useState, useEffect, useMemo } from 'react';
import { calcNutrition, generateStructuredAdvice } from '../../engines/nutrition.engine';
import { getProfile } from '../../core/profile-manager';
import { FOOD_DB } from '../../core/nutrition-database';
import { MICRONUTRIENT_TARGETS } from '../../core/constants';
import { useDataLink, derivePAL } from '../../core/data-link';
import type { FoodItem, UserProfile } from '../../core/types';
import { type LabCompositeResult } from '../../engines/lab-analysis.engine';
import { generateMealPlan, type MealPlanInput, type DailyMealPlan } from '../../engines/meal-plan-generator.engine';
import { generateWeeklyMealPlan, generateGroceryList, getFoodSwaps, getPortionGuide } from '../../engines/meal-planning-system.engine';
import { calculateMacroPlan, generateCarbCycle, getSupplementTimings, getRecipes } from '../../engines/nutrition-periodization.engine';
import { getRestaurantGuide, getTopAthleteChoices, getTravelWorkouts, getSleepStacks } from '../../engines/restaurant-travel-sleep.engine';
import { generateMacroCycle, calcCycleAdherence, type WeeklyCyclePlan } from '../../engines/nutrition-cycling.engine';
import { generateNutritionAdvice } from '../../engines/nutrition-full.engine';
import { NutritionOverview } from './NutritionScreen_parts/NutritionOverview';
import { NutritionDiary } from './NutritionScreen_parts/NutritionDiary';
import { NutritionCharts } from './NutritionScreen_parts/NutritionCharts';
import { NutritionMealGen } from './NutritionScreen_parts/NutritionMealGen';
import { NutritionCustomFood } from './NutritionScreen_parts/NutritionCustomFood';

interface DiaryEntry {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  date?: string;
}

type NutritionPage = 'hero' | 'tabs';

const NutritionLabContext: React.FC<{ labAnalysis: LabCompositeResult }> = ({ labAnalysis }) => (
  <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 10px', marginTop: 8 }}>
    <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4 }}>🧪 Контекст питания из анализов</div>
    <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
      {labAnalysis.homaIR !== null && labAnalysis.homaIR > 2.5 && <div>⚠ HOMA-IR {labAnalysis.homaIR.toFixed(1)} — рекомендованы низко-ГИ продукты, ограничение простых углеводов</div>}
      {labAnalysis.liverStress > 40 && <div>⚠ Печёночная нагрузка {labAnalysis.liverStress}% — исключить алкоголь, добавить NAC/омега-3</div>}
      {labAnalysis.inflammation > 4 && <div>⚠ Воспаление {labAnalysis.inflammation.toFixed(1)} — противовоспалительная диета: омега-3, куркума, ягоды</div>}
      {labAnalysis.kidneyStress > 40 && <div>⚠ Почечная нагрузка {labAnalysis.kidneyStress}% — контроль белка и соли</div>}
      {labAnalysis.hormoneScore > 40 && <div>⚠ Гормональный дисбаланс {labAnalysis.hormoneScore}% — цинк, витамин D, крестоцветные</div>}
      {labAnalysis.homaIR !== null && labAnalysis.homaIR <= 2.5 && labAnalysis.liverStress <= 40 && labAnalysis.inflammation <= 4 && labAnalysis.kidneyStress <= 40 && labAnalysis.hormoneScore <= 40 && (
        <div style={{ color: '#22c55e' }}>✅ Все показатели в норме — стандартный план питания</div>
      )}
    </div>
  </div>
);

export const NutritionScreen: React.FC = () => {
  const linked = useDataLink();
  const labAnalysis = linked.labAnalysis;
  const [tab, setTab] = useState<'overview' | 'diary' | 'charts' | 'mealplan' | 'grocery' | 'restaurant' | 'cycling' | 'calc' | 'regime' | 'custom'>('overview');
  const [page, setPage] = useState<NutritionPage>('hero');
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
      case 'overview': return <><NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} microsIntake={microsIntake} />{labAnalysis && <NutritionLabContext labAnalysis={labAnalysis} />}<QuickAdviceCard /></>;
      case 'diary': return <NutritionDiary foodEntries={foodEntries} />;
      case 'charts': return <NutritionCharts kcalData={[avgWeeklyKcal]} proteinData={[avgWeeklyProtein]} labels={['']} dailyLogs={dailyLogs} />;
      case 'mealplan': return <MealPlanExtended tKcal={tKcal} tProt={tProt} tFat={tFat} tCarbs={tCarbs} />;
      case 'grocery': return <GroceryTab tKcal={tKcal} tProt={tProt} />;
      case 'restaurant': return <RestaurantTab />;
      case 'calc': return <NutritionCalculators />;
      case 'cycling': return <CyclingTab tKcal={tKcal} tProt={tProt} />;
      default: return <NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} microsIntake={microsIntake} />;
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
                { id: 'overview', icon: '📋', title: 'Общие сведения', desc: 'Обзор, дневник, графики, список, ресторан, калькуляторы', color: 'var(--accent)' },
                { id: 'cycling', icon: '📅', title: 'Планирование', desc: 'Циклирование, план питания', color: '#3b82f6' },
              ].map(card => (
                <button key={card.id} onClick={() => { setPage('tabs'); setTab(card.id as any); }} style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setPage('hero')} style={{
            padding: '6px 8px', cursor: 'pointer', fontSize: 14,
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: 600,
          }}>← На главную</button>
        </div>
      )}

      {/* ─── TABS CONTENT (only when not on hero) ─── */}
      {page !== 'hero' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 70px' }}>
          <div className="tab-bar">
            {(['overview', 'diary', 'charts', 'mealplan', 'grocery', 'restaurant', 'calc', 'cycling', 'regime', 'custom'] as const).map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'overview' ? '📊 Обзор' : t === 'diary' ? '📝 Дневник' : t === 'charts' ? '📈 Графики' : t === 'mealplan' ? '🥗 План' : t === 'grocery' ? '🛒 Список' : t === 'restaurant' ? '🍽 Ресторан' : t === 'calc' ? '📐 Калькуляторы' : t === 'regime' ? '⏰ Режим' : t === 'custom' ? '🍎 Своё' : '🔄 Циклирование'}
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

  const totalKcal = meals.reduce((s, m) => s + m.totalKcal, 0);
  const totalP = meals.reduce((s, m) => s + m.totalP, 0);
  const totalF = meals.reduce((s, m) => s + m.totalF, 0);
  const totalC = meals.reduce((s, m) => s + m.totalC, 0);

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
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{meal.totalKcal} ккал | Б{meal.totalP} Ж{meal.totalF} У{meal.totalC}</span>
          </div>
          {meal.items.map((food, fi) => food && (
            <div key={fi} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, borderBottom: fi < meal.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span>{food.name}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{food.kcal}ккал | Б{food.protein} Ж{food.fat} У{food.carbs}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Итого за день</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {[
            { l: '', v: totalKcal, t: targets?.kcal || 2500, u: '' },
            { l: '', v: totalP, t: targets?.protein || 160, u: '' },
            { l: '', v: totalF, t: targets?.fats || 70, u: '' },
            { l: '', v: totalC, t: targets?.carbs || 250, u: '' },
          ].map(m => {
            const pct = Math.round((m.v / m.t) * 100);
            const color = pct >= 90 && pct <= 110 ? '#22c55e' : pct < 90 ? '#ff9100' : '#ef4444';
            return (
              <div key={m.l} style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{m.l}</div>
                <div style={{ fontWeight: 700, color }}>{m.v}<span style={{ fontSize: 9, color: 'var(--text-dim)' }}>/{m.t}{m.u}</span></div>
                <div style={{ fontSize: 8, color }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MealPlanExtended: React.FC<{ tKcal: number; tProt: number; tFat: number; tCarbs: number }> = ({ tKcal, tProt, tFat, tCarbs }) => {
  const [planDays, setPlanDays] = React.useState(3);
  const [mealPlan, setMealPlan] = React.useState<DailyMealPlan[] | null>(null);
  const [weeklyPlan, setWeeklyPlan] = React.useState<any[] | null>(null);
  const recipes = React.useMemo(() => getRecipes(), []);
  const timings = React.useMemo(() => getSupplementTimings(), []);

  return (
    <div>
      <div className="card" style={{ marginBottom: 8 }}>
        <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🍽️ Генератор плана питания</h4>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input type="number" value={planDays} onChange={e => setPlanDays(+e.target.value)} style={{ width: 50, padding: '4px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }} />
          <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>дней</span>
          <button onClick={() => setMealPlan(generateMealPlan({ targetKcal: tKcal, targetProtein: tProt, targetFat: tFat, targetCarbs: tCarbs, days: planDays, preferences: { excludePork: false, excludeFish: false, excludeDairy: false, highCarb: false, keto: false } }))} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>Сгенерировать</button>
          <button onClick={() => setWeeklyPlan(generateWeeklyMealPlan([1,3,5], 'bulk', tKcal, tProt))} style={{ padding: '6px 12px', borderRadius: 6, background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>Недельный</button>
        </div>
        {mealPlan && <div style={{ maxHeight: 250, overflowY: 'auto', fontSize: 9 }}>
          {mealPlan.map((d, di) => <div key={di} style={{ marginBottom: 6 }}><span style={{ fontWeight: 600 }}>День {d.day}</span>: {d.meals.map(m => m.name + ': ' + m.items.map(i => i.name + ' ' + i.amount).join(', ')).join(' | ')}</div>)}
        </div>}
        {weeklyPlan && <div>{weeklyPlan.slice(0,3).map((d: any, di: number) => <div key={di} className="card" style={{ padding: 6, marginBottom: 4 }}><span style={{ fontWeight: 600, fontSize: 10 }}>{d.dayName} {d.isTrainingDay ? '' : ''}</span> — {d.dailyKcal} ккал</div>)}</div>}
      </div>
      <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>⏰ Тайминг добавок</h4>{timings.slice(0,6).map((t:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 0'}}><b>{t.name}</b>: {t.morning||''}{t.preWorkout||''}{t.evening||''}{t.beforeBed||''} — {t.dosage}</div>)}</div>
      <div className="card"><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>🍳 Рецепты ({recipes.length})</h4>{recipes.slice(0,5).map((r:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10}}>{r.name}</b><span style={{fontSize:9,color:'var(--text-dim)'}}> — {r.kcal}ккал Б:{r.protein} Ж:{r.fat} У:{r.carbs}</span></div>)}</div>
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
  return (<div>
    <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>🍔 Рестораны ({guide.length})</h4><div style={{ maxHeight: 200, overflowY: 'auto' }}>{guide.slice(0,12).map((r:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 4px',display:'flex',justifyContent:'space-between'}}><span>{r.chain}: {r.item}</span><span style={{color:r.athleteRating==='excellent'?'#22c55e':'#f59e0b'}}>Б:{r.protein}г</span></div>)}</div></div>
    <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>✈️ Тренировки в поездках</h4>{travels.map((w:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10}}>{w.name}</b><span style={{fontSize:9,color:'var(--text-dim)'}}> ({w.duration}мин)</span></div>)}</div>
    <div className="card"><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>😴 Стек для сна</h4>{sleepStacks.map((s:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10}}>{s.name}</b><span style={{fontSize:9,color:'var(--text-light)'}}>: {s.supplements.join(' + ')}</span></div>)}</div>
  </div>);
};

const CyclingTab: React.FC<{ tKcal: number; tProt: number }> = ({ tKcal, tProt }) => {
  const WEEK = ['','','','','','',''];
  const [cycle, setCycle] = React.useState<WeeklyCyclePlan | null>(null);
  const gen = () => {
    const targets: any = { kcal: Math.round(tKcal), protein: Math.round(tProt), fats: Math.round(tKcal * 0.25 / 9), carbs: Math.round((tKcal - tProt * 4 - tKcal * 0.25) / 4), water: 3, fiber: 30, steps: 8000 };
    setCycle(generateMacroCycle(targets, [true,true,false,true,true,false,false], new Date().toISOString().split('T')[0]));
  };
  return (<div>
    <button onClick={gen} style={{ width:'100%',padding:12,borderRadius:8,border:'none',cursor:'pointer',marginBottom:10,background:'linear-gradient(135deg,#3b82f6,#6366f1)',color:'#fff',fontWeight:700,fontSize:14 }}>🔄 Сгенерировать макро-цикл</button>
    {cycle && <div>{cycle.days.map((d,i)=><div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ fontWeight:600,fontSize:11 }}>{WEEK[i]} {d.isTrainingDay ? '' : ''} — {d.targets.kcal} ккал</div>
      <div style={{ fontSize:9,color:'var(--text-light)' }}>Б:{d.targets.p}г Ж:{d.targets.f}г У:{d.targets.c}г</div>
    </div>)}</div>}
  </div>);
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
            <input type="number" value={dTdee} onChange={e => setDTdee(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Целевые ккал/день</label>
            <input type="number" value={dTarget} onChange={e => setDTarget(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={calcDeficit} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
        {dResult !== null && (
          <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: dResult.deficit > 0 ? '#ef4444' : '#22c55e' }}>{dResult.deficit > 0 ? `Дефицит ${dResult.deficit} ккал/день` : 'Нет дефицита'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Потеря веса: {dResult.rateKgWeek.toFixed(2)} кг/нед</div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '10px 12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚖️ Расчёт макросов</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
            <input type="number" value={mWeight} onChange={e => setMWeight(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рост (см)</label>
            <input type="number" value={mHeight} onChange={e => setMHeight(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Возраст</label>
            <input type="number" value={mAge} onChange={e => setMAge(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
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
            <select value={mPal} onChange={e => setMPal(+e.target.value)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center', fontSize: 10 }}>
              <div><span style={{ color: 'var(--text-dim)' }}>Ккал</span><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{mResult.kcal}</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Белки</span><div style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>{mResult.protein}г</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Жиры</span><div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{mResult.fats}г</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Углеводы</span><div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{mResult.carbs}г</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Вода</span><div style={{ fontSize: 16, fontWeight: 700, color: '#06b6d4' }}>{mResult.water}л</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Клетчатка</span><div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{mResult.fiber}г</div></div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '10px 12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🩸 HOMA-IR</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Глюкоза (ммоль/л)</label>
            <input type="number" step="0.1" value={hGlucose} onChange={e => setHGlucose(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Инсулин (μЕ/мл)</label>
            <input type="number" step="0.1" value={hInsulin} onChange={e => setHInsulin(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={calcHOMA} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
        {hResult !== null && (
          <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: hResult.resistant ? '#ef4444' : 'var(--accent)' }}>{hResult.index.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{hResult.resistant ? 'Инсулинорезистентность (>2.5)' : 'Норма'}</div>
          </div>
        )}
      </div>
    </div>
  );
};
