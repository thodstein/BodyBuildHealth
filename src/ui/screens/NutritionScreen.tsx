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

interface DiaryEntry {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  date?: string;
}

const NutritionLabContext: React.FC<{ labAnalysis: LabCompositeResult }> = ({ labAnalysis }) => (
  <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 10px', marginTop: 8 }}>
    <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4 }}>рџ§Є РљРѕРЅС‚РµРєСЃС‚ РїРёС‚Р°РЅРёСЏ РёР· Р°РЅР°Р»РёР·РѕРІ</div>
    <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
      {labAnalysis.homaIR !== null && labAnalysis.homaIR > 2.5 && <div>вљ  HOMA-IR {labAnalysis.homaIR.toFixed(1)} вЂ” СЂРµРєРѕРјРµРЅРґРѕРІР°РЅС‹ РЅРёР·РєРѕ-Р“Р РїСЂРѕРґСѓРєС‚С‹, РѕРіСЂР°РЅРёС‡РµРЅРёРµ РїСЂРѕСЃС‚С‹С… СѓРіР»РµРІРѕРґРѕРІ</div>}
      {labAnalysis.liverStress > 40 && <div>вљ  РџРµС‡С‘РЅРѕС‡РЅР°СЏ РЅР°РіСЂСѓР·РєР° {labAnalysis.liverStress}% вЂ” РёСЃРєР»СЋС‡РёС‚СЊ Р°Р»РєРѕРіРѕР»СЊ, РґРѕР±Р°РІРёС‚СЊ NAC/РѕРјРµРіР°-3</div>}
      {labAnalysis.inflammation > 4 && <div>вљ  Р’РѕСЃРїР°Р»РµРЅРёРµ {labAnalysis.inflammation.toFixed(1)} вЂ” РїСЂРѕС‚РёРІРѕРІРѕСЃРїР°Р»РёС‚РµР»СЊРЅР°СЏ РґРёРµС‚Р°: РѕРјРµРіР°-3, РєСѓСЂРєСѓРјР°, СЏРіРѕРґС‹</div>}
      {labAnalysis.kidneyStress > 40 && <div>вљ  РџРѕС‡РµС‡РЅР°СЏ РЅР°РіСЂСѓР·РєР° {labAnalysis.kidneyStress}% вЂ” РєРѕРЅС‚СЂРѕР»СЊ Р±РµР»РєР° Рё СЃРѕР»Рё</div>}
      {labAnalysis.hormoneScore > 40 && <div>вљ  Р“РѕСЂРјРѕРЅР°Р»СЊРЅС‹Р№ РґРёСЃР±Р°Р»Р°РЅСЃ {labAnalysis.hormoneScore}% вЂ” С†РёРЅРє, РІРёС‚Р°РјРёРЅ D, РєСЂРµСЃС‚РѕС†РІРµС‚РЅС‹Рµ</div>}
      {labAnalysis.homaIR !== null && labAnalysis.homaIR <= 2.5 && labAnalysis.liverStress <= 40 && labAnalysis.inflammation <= 4 && labAnalysis.kidneyStress <= 40 && labAnalysis.hormoneScore <= 40 && (
        <div style={{ color: '#22c55e' }}>вњ… Р’СЃРµ РїРѕРєР°Р·Р°С‚РµР»Рё РІ РЅРѕСЂРјРµ вЂ” СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ РїР»Р°РЅ РїРёС‚Р°РЅРёСЏ</div>
      )}
    </div>
  </div>
);

export const NutritionScreen: React.FC = () => {
  const linked = useDataLink();
  const labAnalysis = linked.labAnalysis;
  const [tab, setTab] = useState<'overview' | 'diary' | 'charts' | 'mealplan' | 'grocery' | 'restaurant' | 'cycling'>('overview');
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
      case 'cycling': return <CyclingTab tKcal={tKcal} tProt={tProt} />;
      default: return <NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} microsIntake={microsIntake} />;
    }
  };

  return (
    <div className="screen nutrition">
      <div className="tab-bar">
        {(['overview', 'diary', 'charts', 'mealplan', 'grocery', 'restaurant', 'cycling'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '' : t === 'diary' ? '' : t === 'charts' ? '' : t === 'mealplan' ? '' : t === 'grocery' ? '' : t === 'restaurant' ? '' : ''}
          </button>
        ))}
      </div>
      {renderContent()}
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
        <h3 style={{ margin: '0 0 8px 0' }}>рџЌЅпёЏ РџР»Р°РЅ РїРёС‚Р°РЅРёСЏ</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅ РїРѕРґ С†РµР»СЊ: {targets?.kcal || 2500} РєРєР°Р» | Р‘: {targets?.protein || 160}Рі Р–: {targets?.fats || 70}Рі РЈ: {targets?.carbs || 250}Рі
        </p>
      </div>

      {meals.map((meal, mi) => (
        <div key={mi} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 13 }}>{meal.name}</h4>
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{meal.totalKcal} РєРєР°Р» | Р‘{meal.totalP} Р–{meal.totalF} РЈ{meal.totalC}</span>
          </div>
          {meal.items.map((food, fi) => food && (
            <div key={fi} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, borderBottom: fi < meal.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span>{food.name}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{food.kcal}РєРєР°Р» | Р‘{food.protein} Р–{food.fat} РЈ{food.carbs}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>РС‚РѕРіРѕ Р·Р° РґРµРЅСЊ</div>
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
        <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>рџЌЅпёЏ Р“РµРЅРµСЂР°С‚РѕСЂ РїР»Р°РЅР° РїРёС‚Р°РЅРёСЏ</h4>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input type="number" value={planDays} onChange={e => setPlanDays(+e.target.value)} style={{ width: 50, padding: '4px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }} />
          <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>РґРЅРµР№</span>
          <button onClick={() => setMealPlan(generateMealPlan({ targetKcal: tKcal, targetProtein: tProt, targetFat: tFat, targetCarbs: tCarbs, days: planDays, preferences: { excludePork: false, excludeFish: false, excludeDairy: false, highCarb: false, keto: false } }))} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ</button>
          <button onClick={() => setWeeklyPlan(generateWeeklyMealPlan([1,3,5], 'bulk', tKcal, tProt))} style={{ padding: '6px 12px', borderRadius: 6, background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>РќРµРґРµР»СЊРЅС‹Р№</button>
        </div>
        {mealPlan && <div style={{ maxHeight: 250, overflowY: 'auto', fontSize: 9 }}>
          {mealPlan.map((d, di) => <div key={di} style={{ marginBottom: 6 }}><span style={{ fontWeight: 600 }}>Р”РµРЅСЊ {d.day}</span>: {d.meals.map(m => m.name + ': ' + m.items.map(i => i.name + ' ' + i.amount).join(', ')).join(' | ')}</div>)}
        </div>}
        {weeklyPlan && <div>{weeklyPlan.slice(0,3).map((d: any, di: number) => <div key={di} className="card" style={{ padding: 6, marginBottom: 4 }}><span style={{ fontWeight: 600, fontSize: 10 }}>{d.dayName} {d.isTrainingDay ? '' : ''}</span> вЂ” {d.dailyKcal} РєРєР°Р»</div>)}</div>}
      </div>
      <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>вЏ° РўР°Р№РјРёРЅРі РґРѕР±Р°РІРѕРє</h4>{timings.slice(0,6).map((t:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 0'}}><b>{t.name}</b>: {t.morning||''}{t.preWorkout||''}{t.evening||''}{t.beforeBed||''} вЂ” {t.dosage}</div>)}</div>
      <div className="card"><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>рџЌі Р РµС†РµРїС‚С‹ ({recipes.length})</h4>{recipes.slice(0,5).map((r:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10}}>{r.name}</b><span style={{fontSize:9,color:'var(--text-dim)'}}> вЂ” {r.kcal}РєРєР°Р» Р‘:{r.protein} Р–:{r.fat} РЈ:{r.carbs}</span></div>)}</div>
    </div>
  );
};

const GroceryTab: React.FC<{ tKcal: number; tProt: number }> = ({ tKcal, tProt }) => {
  const weeklyPlan = React.useMemo(() => generateWeeklyMealPlan([1,3,5], 'bulk', tKcal, tProt), [tKcal, tProt]);
  const grocery = React.useMemo(() => generateGroceryList(weeklyPlan), [weeklyPlan]);
  const swaps = React.useMemo(() => getFoodSwaps(), []);
  const portions = React.useMemo(() => getPortionGuide(), []);
  return (<div>
    {grocery.length > 0 && <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>рџ›’ РЎРїРёСЃРѕРє Р·Р°РєСѓРїРѕРє</h4>{grocery.map((cat:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10,color:'var(--accent)'}}>{cat.category}</b>{cat.items.map((it:any,j:number)=><div key={j} style={{fontSize:9,paddingLeft:8}}>вЂў {it.name} вЂ” {it.quantity}</div>)}</div>)}</div>}
    <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>рџ”„ Р—Р°РјРµРЅС‹</h4>{swaps.map((s:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 0'}}><span style={{color:'#ef4444'}}>{s.original}</span> в†’ <span style={{color:'#22c55e'}}>{s.replacement}</span></div>)}</div>
    <div className="card"><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>вњ‹ РџРѕСЂС†РёРё</h4>{portions.map((p:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 0'}}>{p.visual} = {p.food} ({p.kcal}РєРєР°Р»)</div>)}</div>
  </div>);
};

const RestaurantTab: React.FC = () => {
  const guide = React.useMemo(() => getRestaurantGuide(), []);
  const top = React.useMemo(() => getTopAthleteChoices(), []);
  const travels = React.useMemo(() => getTravelWorkouts(), []);
  const sleepStacks = React.useMemo(() => getSleepStacks(), []);
  return (<div>
    <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>рџЌ” Р РµСЃС‚РѕСЂР°РЅС‹ ({guide.length})</h4><div style={{ maxHeight: 200, overflowY: 'auto' }}>{guide.slice(0,12).map((r:any,i:number)=><div key={i} style={{fontSize:9,padding:'2px 4px',display:'flex',justifyContent:'space-between'}}><span>{r.chain}: {r.item}</span><span style={{color:r.athleteRating==='excellent'?'#22c55e':'#f59e0b'}}>Р‘:{r.protein}Рі</span></div>)}</div></div>
    <div className="card" style={{ marginBottom: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>вњ€пёЏ РўСЂРµРЅРёСЂРѕРІРєРё РІ РїРѕРµР·РґРєР°С…</h4>{travels.map((w:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10}}>{w.name}</b><span style={{fontSize:9,color:'var(--text-dim)'}}> ({w.duration}РјРёРЅ)</span></div>)}</div>
    <div className="card"><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>рџґ РЎС‚РµРє РґР»СЏ СЃРЅР°</h4>{sleepStacks.map((s:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10}}>{s.name}</b><span style={{fontSize:9,color:'var(--text-light)'}}>: {s.supplements.join(' + ')}</span></div>)}</div>
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
    <button onClick={gen} style={{ width:'100%',padding:12,borderRadius:8,border:'none',cursor:'pointer',marginBottom:10,background:'linear-gradient(135deg,#3b82f6,#6366f1)',color:'#fff',fontWeight:700,fontSize:14 }}>рџ”„ РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РјР°РєСЂРѕ-С†РёРєР»</button>
    {cycle && <div>{cycle.days.map((d,i)=><div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ fontWeight:600,fontSize:11 }}>{WEEK[i]} {d.isTrainingDay ? '' : ''} вЂ” {d.targets.kcal} РєРєР°Р»</div>
      <div style={{ fontSize:9,color:'var(--text-light)' }}>Р‘:{d.targets.p}Рі Р–:{d.targets.f}Рі РЈ:{d.targets.c}Рі</div>
    </div>)}</div>}
  </div>);
};

const QuickAdviceCard: React.FC = () => {
  const s = getProfile()?.settings;
  const targets = { kcal: s?.weight ? Math.round(s.weight * 30) : 2500, protein: s?.weight ? Math.round(s.weight * 2) : 160, fats: Math.round((s?.weight || 80) * 0.8), carbs: 300, water: 3, fiber: 30, steps: 8000, vitaminD: 2000, potassium: 3500, iron: 12, calcium: 800, sodium: 2300 };
  const advice = React.useMemo(() => generateNutritionAdvice(targets as any, {kcal:2000,pro:120,fiber:20,water:2,steps:6000}), []);
  return (<div className="card" style={{ padding:10, marginTop:8 }}>
    <h4 style={{ margin:'0 0 4px',fontSize:12 }}>рџ’Ў РЎРѕРІРµС‚ РїРѕ РїРёС‚Р°РЅРёСЋ</h4>
    <div style={{ fontSize:9,color:'var(--text-light)',lineHeight:1.6 }}>{advice}</div>
  </div>);
};
