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
import { NutritionCustomFood } from './NutritionScreen_parts/NutritionCustomFood';
import { generateTierMealPlan, generateRegimeAdvice, type MealTier, type MealPlanResult } from '../../engines/meal-tier-generator.engine';

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
type ActiveTab = 'overview' | 'diary' | 'charts' | 'mealplan' | 'grocery' | 'restaurant' | 'cycling' | 'calc' | 'custom' | 'planoverview' | 'rules' | 'products' | 'infocalc' | 'recipes';

const SECTION_TABS: Record<NutritionSection, string[]> = {
  diary: ['diary', 'charts'],
  planning: ['mealplan', 'cycling'],
  overview: ['overview', 'recipes', 'infocalc'],
  all: ['diary', 'charts', 'mealplan', 'cycling', 'overview', 'recipes', 'infocalc'],
};

const TAB_LABELS: Record<string, string> = {
  diary: '📝 Дневник', charts: '📈 Графики',
  mealplan: '🥗 План', cycling: '🔄 Циклирование',
  overview: '📊 Общая информация', recipes: '🍳 Рецепты', infocalc: '📐 Калькуляторы',
};

const NutritionLabContext: React.FC<{ labAnalysis: LabCompositeResult }> = ({ labAnalysis }) => (
  <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 10px', marginTop: 8 }}>
    <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4 }}>🧪 Контекст питания из анализов</div>
    <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
      {labAnalysis.homaIR !== null && labAnalysis.homaIR > 2.5 && <div>⚠ HOMA-IR {Math.round(labAnalysis.homaIR)} — рекомендованы низко-ГИ продукты, ограничение простых углеводов</div>}
      {labAnalysis.liverStress > 40 && <div>⚠ Печёночная нагрузка {labAnalysis.liverStress}% — исключить алкоголь, добавить NAC/омега-3</div>}
      {labAnalysis.inflammation > 4 && <div>⚠ Воспаление {Math.round(labAnalysis.inflammation)} — противовоспалительная диета: омега-3, куркума, ягоды</div>}
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
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [page, setPage] = useState<NutritionPage>('hero');
  const [nutritionSection, setNutritionSection] = useState<NutritionSection>('all');
  const [mealSubTab, setMealSubTab] = useState<string>('planoverview');
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
      case 'overview': return <><NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} microsIntake={microsIntake} />{labAnalysis && <NutritionLabContext labAnalysis={labAnalysis} />}</>;
      case 'infocalc': return <NutritionCalculators />;
      case 'recipes': return <RecipesTab />;
      case 'diary': return <NutritionDiary foodEntries={foodEntries} />;
      case 'charts': return <NutritionCharts kcalData={[avgWeeklyKcal]} proteinData={[avgWeeklyProtein]} labels={['']} dailyLogs={dailyLogs} />;
      case 'mealplan': return <MealPlanExtended tKcal={tKcal} tProt={tProt} tFat={tFat} tCarbs={tCarbs} profile={linked.profile} mealSubTab={mealSubTab} setMealSubTab={setMealSubTab} />;
      case 'grocery': return <GroceryTab tKcal={tKcal} tProt={tProt} />;
      case 'restaurant': return <RestaurantTab />;
      case 'cycling': return <CyclingTab tKcal={tKcal} tProt={tProt} />;
      case 'custom': return <NutritionCustomFood />;
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
                { section: 'diary' as NutritionSection, tab: 'diary', icon: '📝', title: 'Дневник питания', desc: 'Запись продуктов, OCR, штрих-коды', color: '#22c55e' },
                { section: 'planning' as NutritionSection, tab: 'mealplan', icon: '🥗', title: 'План питания', desc: 'Генератор рациона, уровни, циклирование', color: '#3b82f6' },
                { section: 'overview' as NutritionSection, tab: 'overview', icon: '📊', title: 'Общая информация', desc: 'Сводка, калькуляторы', color: 'var(--accent)' },
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

const MealPlanExtended: React.FC<{ tKcal: number; tProt: number; tFat: number; tCarbs: number; profile: UserProfile | null; mealSubTab?: string; setMealSubTab?: (v: string) => void }> = ({ tKcal, tProt, tFat, tCarbs, profile, mealSubTab, setMealSubTab }) => {
  const [planDays, setPlanDays] = React.useState(3);
  const [mealPlan, setMealPlan] = React.useState<DailyMealPlan[] | null>(null);
  const [weeklyPlan, setWeeklyPlan] = React.useState<any[] | null>(null);
  const [tierResult, setTierResult] = React.useState<MealPlanResult | null>(null);
  const [activeTier, setActiveTier] = React.useState<MealTier | null>(null);
  const [variantPlans, setVariantPlans] = React.useState<MealPlanResult[]>([]);
  const [activeVariant, setActiveVariant] = React.useState(0);
  const [swapPopup, setSwapPopup] = React.useState<{ mealIdx: number; foodIdx: number } | null>(null);
  const [planSaved, setPlanSaved] = React.useState(false);
  const recipes = React.useMemo(() => getRecipes(), []);
  const timings = React.useMemo(() => getSupplementTimings(), []);
  const regimeAdviceLines = React.useMemo(() => generateRegimeAdvice(), []);

  const [expandedRules, setExpandedRules] = React.useState<Set<number>>(new Set());
  const toggleRule = (i: number) => setExpandedRules(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  const [qualityFromDB, setQualityFromDB] = React.useState(false);

  const computeFoodScore = React.useCallback((f: typeof FOOD_DB[number]): number => {
    if (f.tier === 'max') return 10;
    if (f.tier === 'mid') return 8;
    if (f.tier === 'basic') return 6;
    if (f.kcal === 0) return 5;
    let score = 5;
    const proteinDensity = (f.protein * 4) / Math.max(f.kcal, 1);
    if (proteinDensity > 0.6) score += 2;
    else if (proteinDensity > 0.3) score += 1;
    if (f.fiber >= 3) score += 1;
    if (f.fiber >= 6) score += 1;
    if (f.category === 'carb' || f.category === 'grain') {
      if (f.gi <= 50) score += 2;
      else if (f.gi <= 70) score += 1;
      else if (f.gi >= 85) score -= 1;
    }
    if (f.micros?.Omega3 && f.micros.Omega3 > 0.5) score += 1;
    return Math.max(1, Math.min(10, score));
  }, []);
  const computeFoodPros = React.useCallback((f: typeof FOOD_DB[number]): string[] => {
    const pros: string[] = [];
    if (f.bestFor && f.bestFor.length) pros.push(...f.bestFor.slice(0, 2).map(g => ({bulk:'Набор',cut:'Сушка',strength:'Сила',maintenance:'Поддержание',recomp:'Рекомпозиция',rehab:'Реабилитация'}[g]||g)));
    if (f.fiber >= 5) pros.push('Клетчатка');
    if (f.gi > 0 && f.gi <= 50) pros.push('Низкий ГИ');
    if (f.micros?.Omega3 && f.micros.Omega3 > 0.3) pros.push('Омега-3');
    if (f.micros?.Fe && f.micros.Fe >= 2) pros.push('Железо');
    if (f.micros?.Ca && f.micros.Ca >= 100) pros.push('Кальций');
    if (f.micros?.Zn && f.micros.Zn >= 2) pros.push('Цинк');
    if (f.protein > 20) pros.push('Высокий белок');
    if (pros.length === 0) pros.push(f.tier === 'max' ? 'Премиум' : f.tier === 'mid' ? 'Средний+' : 'Базовый');
    return pros.slice(0, 3);
  }, []);
  const computeFoodCons = React.useCallback((f: typeof FOOD_DB[number]): string[] => {
    const cons: string[] = [];
    if (f.allergens && f.allergens.length) cons.push(...f.allergens.slice(0, 1));
    if (f.gi >= 80) cons.push('Высокий ГИ');
    if (f.category === 'fast_food') cons.push('Фастфуд');
    if (f.fat > 15) cons.push('Высокий жир');
    if (f.kcal > 350) cons.push('Калорийно');
    if (cons.length === 0) cons.push('Особых нет');
    return cons.slice(0, 2);
  }, []);
  const dbQualityScores = React.useMemo(() => {
    const allFoods = FOOD_DB.filter(f => f.kcal > 0);
    const proteinFoods = allFoods.filter(f => f.category === 'protein' || f.category === 'dairy' || f.category === 'supplement')
      .map(f => ({ name: f.name, score: computeFoodScore(f), desc: f.description || '', tier: f.tier || 'none', pros: computeFoodPros(f), cons: computeFoodCons(f) }));
    const carbFoods = allFoods.filter(f => f.category === 'carb' || f.category === 'grain' || f.category === 'veg_fruit')
      .map(f => ({ name: f.name, score: computeFoodScore(f), desc: f.description || '', tier: f.tier || 'none', pros: computeFoodPros(f), cons: computeFoodCons(f) }));
    const fatFoods = allFoods.filter(f => f.category === 'fat')
      .map(f => ({ name: f.name, score: computeFoodScore(f), desc: f.description || '', tier: f.tier || 'none', pros: computeFoodPros(f), cons: computeFoodCons(f) }));
    return { proteins: proteinFoods.sort((a, b) => b.score - a.score).slice(0, 20), carbs: carbFoods.sort((a, b) => b.score - a.score).slice(0, 20), fats: fatFoods.sort((a, b) => b.score - a.score).slice(0, 15) };
  }, [computeFoodScore, computeFoodPros, computeFoodCons]);

  const NUTRITION_RULES = [
    { title: 'Осторожность с молочкой', body: 'Лактоза повышает воспалительные маркеры (СРБ) и провоцирует застой желчи. Может влиять на акне.', color: '#f59e0b' },
    { title: 'Нормы клетчатки', body: '3-30 г/сутки индивидуально. Избыток → диарея. Польза для ССЗ.', color: '#22c55e' },
    { title: 'Питание до тренировки', body: 'За 1-2 часа до. Реально показывает профит.', color: '#3b82f6' },
    { title: 'Контроль фруктозы', body: 'Фруктоза → жировое депо если гликогеновое полно. Следить за сладкими фруктами.', color: '#ef4444' },
    { title: 'Качество продуктов', body: 'Основа — свежая пища. Джанк ≤ 15-20%.', color: '#22c55e' },
    { title: 'Белковая оптимизация', body: 'Не >50 г белка за приём. Распределение эффективнее.', color: '#3b82f6' },
    { title: 'Естественный аппетит', body: 'Только при чувстве голода. Не давиться через силу.', color: '#a855f7' },
    { title: 'Баланс нутриентов', body: 'Каждый приём: белки+жиры+углеводы. Исключение: до/после тренировки (без жиров).', color: '#8b5cf6' },
    { title: 'Комфортное пищеварение', body: 'Без вздутия/диареи. При симптомах → пересмотреть рацион или ЖКТ.', color: '#06b6d4' },
    { title: 'Гидратация', body: '30-40 мл воды на кг веса. +500 мл за час тренировки. Обезвоживание снижает силу на 10-15%.', color: '#06b6d4' },
    { title: 'Сон и питание', body: 'Последний приём за 2-3 часа до сна. Казеин/творог на ночь для медленного белка.', color: '#8b5cf6' },
    { title: 'Пост-тренировочное окно', body: 'Белок + углеводы в первые 60-90 минут после тренировки. Соотношение 1:3 для набора, 1:1 для сушки.', color: '#3b82f6' },
    { title: 'Циклирование калорий', body: 'Тренировочные дни +10-15% ккал, дни отдыха -5-10%.', color: '#f59e0b' },
    { title: 'Контроль натрия', body: '3-5 г соли/день. При высоком АД — снизить до 2-3 г. Задержка воды от избытка соли маскирует результат.', color: '#ef4444' },
    { title: 'Читмил и тяжёлая тренировка', body: 'Лучшее время: сразу ПОСЛЕ тяжёлой тренировки (гликогеновые депо опустошены, чувствительность к инсулину максимальна)\n- Перед тренировкой: лёгкий белковый приём за 1.5-2 часа\n- После читмила: вернуться к обычному рациону без компенсации (не голодать!)\n- Частота: 1 раз в 7-10 дней\n- Не более 1500 ккал за читмил', color: '#f59e0b' },
    { title: 'Углеводная загрузка (вокруг тяжёлой тренировки)', body: 'За 24-48 часов ДО тяжёлой тренировки: увеличить углеводы до 6-8 г/кг\n- В день тренировки: 1-1.5 г/кг углеводов за 2-3 часа до\n- Сразу после: 1 г/кг быстрых углеводов + 0.3 г/кг белка\n- Следующие 24 часа: поддерживать повышенные углеводы\n- Вода: увеличить потребление на 1-1.5 л в дни загрузки', color: '#f97316' },
    { title: 'Белково-углеводное чередование (БУЧ)', body: 'Высокоуглеводные дни: тренировочные дни, +30% к базовым углеводам\nНизкоуглеводные дни: дни отдыха, -50% к базовым углеводам\nБелок: постоянно высокий (2-2.5 г/кг) все дни\nЖиры: выше в низкоуглеводные дни, ниже в высокоуглеводные\nЦикл: 3 тренировочных (высоко) + 1 отдых (низко) или 2+1', color: '#3b82f6' },
    { title: 'Водный баланс и электролиты', body: '30-40 мл воды на кг веса в день\n+ 500-750 мл за каждый час тренировки\nНа курсе ААС: увеличить до 40-50 мл/кг (повышенный гематокрит)\nНатрий: 3-5 г/день (при повышенном АД → 2-3 г)\nКалий: 4-5 г/день из продуктов (бананы, картофель, авокадо)\nМагний: 400-600 мг/день дополнительно', color: '#06b6d4' },
    { title: 'Периодизация питания', body: 'Фаза набора: профицит 300-500 ккал, белок 2-2.5 г/кг\nФаза сушки: дефицит 300-500 ккал, белок 2.5-3 г/кг\nПоддержание: баланс калорий, белок 1.8-2 г/кг\nМенять фазы каждые 8-12 недель\nМетаболическая адаптация: при плато ±200 ккал', color: '#a855f7' },
    { title: 'Нутритивное окно и анаболический отклик', body: '30 г белка каждые 3-4 часа для максимального синтеза белка\nЛейцин 3-4 г на приём для активации mTOR\nУглеводы вокруг тренировки повышают анаболический отклик на 30-40%\nКазеин (30-40 г) перед сном для ночного анти-катаболизма\nОмега-3 (2-3 г EPA/DHA) улучшает чувствительность к инсулину на 25%', color: '#22c55e' },
  ];

  const RECOMMENDED_FOODS: Record<string, { items: string[]; color: string; bg: string }> = {
    'Белки': { items: ['Филе индейки', 'Филе курицы', 'Яйца', 'Говядина постная', 'Фарш говяжий', 'Лосось (2 р/нед)', 'Креветки (1 р/нед)', 'Треска', 'Палтус', 'Минтай'], color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    'Жиры': { items: ['Авокадо', 'Гуакамоле', 'Кокосовое масло', 'Кокосовый урбеч', 'Красная икра', 'Оливковое масло extra virgin'], color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    'Углеводы': { items: ['Рис (кроме бурого)', 'Макароны твёрдых сортов', 'Рисовые макароны', 'Рисовая каша/cream of rice', 'Картофель', 'Батат', 'Хлеб цельнозерновой'], color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
    'С ограничением': { items: ['Кукурузные хлопья (без пшеницы)', 'Цитрусовые', 'Зелёные яблоки', 'Финики', 'Ягоды', 'Мармелад (желатин+сахар)', 'Томатный сок', 'Амилопектин/декстрин/декстроза'], color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    'Клетчатка': { items: ['Морковь', 'Свёкла', 'Огурцы', 'Помидоры', 'Лук', 'Квашеная капуста'], color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    'Специи': { items: ['Томатная паста', 'Гималайская соль', 'Любые травы'], color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
    'До тренировки (за 1.5-2 ч)': { items: ['Рис/макароны + курица/индейка', 'Овсянка + протеин', 'Банан + яйца'], color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    'После тренировки': { items: ['Протеиновый коктейль + банан', 'Рис + рыба/курица', 'Картофель + яйца'], color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  };

  const s = profile?.settings;
  const [indivPlan, setIndivPlan] = React.useState<any>(null);
  const [indivKcal, setIndivKcal] = React.useState(tKcal);
  const [indivProt, setIndivProt] = React.useState(tProt);
  const [indivFat, setIndivFat] = React.useState(tFat);
  const [indivCarbs, setIndivCarbs] = React.useState(tCarbs);
  const [indivMeals, setIndivMeals] = React.useState(s?.mealsPerDay || 4);
  const [indivTrainTime, setIndivTrainTime] = React.useState('16:00');
  const [indivDairyFree, setIndivDairyFree] = React.useState(s?.dietRestrictions?.includes('dairy') || false);
  const [indivGlutenFree, setIndivGlutenFree] = React.useState(s?.dietRestrictions?.includes('gluten') || false);
  const [indivFishFree, setIndivFishFree] = React.useState(false);
  const [indivNutFree, setIndivNutFree] = React.useState(false);
  const [indivEggFree, setIndivEggFree] = React.useState(false);
  const [indivInsulinShots, setIndivInsulinShots] = React.useState<{ time: string; dose: number; type: string }[]>([]);
  const [indivGHShots, setIndivGHShots] = React.useState<{ time: string; dose: number }[]>([]);
  const [indivIGFShots, setIndivIGFShots] = React.useState<{ time: string; dose: number }[]>([]);
  const [expandedMeals, setExpandedMeals] = React.useState<Set<number>>(new Set());
  const [mealNotes, setMealNotes] = React.useState<Record<number, string>>({});
  const [regenerateCount, setRegenerateCount] = React.useState(0);
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
  const [newInsulinTime, setNewInsulinTime] = React.useState('12:00');
  const [newInsulinDose, setNewInsulinDose] = React.useState(5);
  const [newInsulinType, setNewInsulinType] = React.useState('короткий');
  const [newGHTime, setNewGHTime] = React.useState('08:00');
  const [newGHDose, setNewGHDose] = React.useState(4);
  const [newIGFTime, setNewIGFTime] = React.useState('10:00');
  const [newIGFDose, setNewIGFDose] = React.useState(50);
  const [macroCyclingEnabled, setMacroCyclingEnabled] = React.useState(false);
  const [shoppingListVisible, setShoppingListVisible] = React.useState(false);
  const [indivPlanRest, setIndivPlanRest] = React.useState<any>(null);
  const [activeCyclingView, setActiveCyclingView] = React.useState<'train' | 'rest'>('train');

  const RECOMMENDED_IDS: Record<string, string[]> = {
    'protein': ['turkey_breast', 'chicken_breast', 'egg_whole', 'egg_white', 'beef_lean', 'salmon', 'shrimp', 'tuna_steak'],
    'fat': ['avocado', 'egg_whole', 'olive_oil', 'fish_oil_food'],
    'carb': ['rice_white', 'pasta_durum', 'rice_noodles', 'potato_boiled', 'sweet_potato', 'bread_rye'],
    'veg': ['cucumber', 'tomato', 'carrot', 'beetroot', 'apple', 'berries', 'grapefruit', 'broccoli'],
    'grain': ['rice_white', 'pasta_durum', 'rice_noodles', 'oats', 'bread_rye'],
  };

  const generateIndividualPlan = () => {
    const dairyIds = ['cottage_cheese_5', 'kefir', 'yogurt_greek', 'milk', 'cheese_hard', 'kefir_2', 'yogurt_natural', 'ryazhenka', 'sour_cream_15', 'greek_yogurt'];
    let proteinFoods = FOOD_DB.filter(f => RECOMMENDED_IDS.protein.includes(f.id) && f.category === 'protein');
    if (indivDairyFree) proteinFoods = proteinFoods.filter(f => !dairyIds.includes(f.id));
    if (indivFishFree) proteinFoods = proteinFoods.filter(f => !['salmon', 'shrimp', 'tuna_canned', 'tuna_steak', 'sardines', 'mackerel'].includes(f.id));
    if (indivEggFree) proteinFoods = proteinFoods.filter(f => !['egg_whole', 'egg_white'].includes(f.id));
    let carbFoods = FOOD_DB.filter(f => [...RECOMMENDED_IDS.carb, ...RECOMMENDED_IDS.grain].includes(f.id) && (f.category === 'carb' || f.category === 'grain'));
    if (indivGlutenFree) carbFoods = carbFoods.filter(f => !['pasta_durum', 'bread_rye', 'tortilla_wheat'].includes(f.id));
    let fatFoods = FOOD_DB.filter(f => RECOMMENDED_IDS.fat.includes(f.id) && f.category === 'fat');
    if (indivNutFree) fatFoods = fatFoods.filter(f => !(f.allergens || []).includes('nuts'));
    const vegFoods = FOOD_DB.filter(f => RECOMMENDED_IDS.veg.includes(f.id) && f.category === 'veg_fruit');

    const trainHour = parseInt(indivTrainTime.split(':')[0]);
    const insulinShots = indivInsulinShots.map(s => ({ ...s, hour: parseInt(s.time.split(':')[0]) }));
    const ghShots = indivGHShots.map(s => ({ ...s, hour: parseInt(s.time.split(':')[0]) }));
    const igfShots = indivIGFShots.map(s => ({ ...s, hour: parseInt(s.time.split(':')[0]) }));

    const mealTimes = (() => {
      const n = indivMeals;
      const times: string[] = [];
      if (n === 3) { times.push('08:00', '13:00', '19:00'); }
      else if (n === 4) { times.push('07:00', '11:00', '15:00', '19:00'); }
      else if (n === 5) { times.push('07:00', '10:00', '13:00', '16:00', '20:00'); }
      else { times.push('07:00', '10:00', '13:00', '15:30', '18:00', '21:00'); }
      return times;
    })();

    // Phase 5.12: Time-based meal name assignment
    const getMealLabelByTime = (timeStr: string): string => {
      const h = parseInt(timeStr.split(':')[0]);
      if (h >= 6 && h <= 9) return 'Завтрак';
      if (h >= 10 && h <= 11) return 'Второй завтрак';
      if (h >= 12 && h <= 14) return 'Обед';
      if (h >= 15 && h <= 16) return 'Полдник / Предтрен';
      if (h >= 17 && h <= 18) return 'Пост-тренировочный';
      if (h >= 19 && h <= 21) return 'Ужин';
      if (h >= 21) return 'Поздний перекус (casein)';
      return 'Приём пищи';
    };
    const labels = mealTimes.map(t => getMealLabelByTime(t));

    const meals: any[] = mealTimes.map((time, i) => {
      const h = parseInt(time.split(':')[0]);
      const isPreWorkout = trainHour > 0 && (h === trainHour - 2 || h === trainHour - 1);
      const isPostWorkout = trainHour > 0 && (h === trainHour + 1 || h === trainHour + 2);
      const isMorning = h < 11;
      const isEvening = h >= 18;

        // Insulin shots check — carbs at 0min and +60min for short, balanced every 3-4h for long
        const matchingInsulin = insulinShots.filter(s => h === s.hour || h === s.hour + 1);
        const isInsulinShortMeal = matchingInsulin.some(s => s.type === 'короткий' || s.type === 'сверхбыстрый');
        const isInsulinLongMeal = matchingInsulin.some(s => s.type === 'длинный');
        const isInsulinMeal = isInsulinShortMeal || isInsulinLongMeal;

        // Calculate forced carbs from insulin: 0.5g per IU short, 0.3g per IU at +60min
        const totalShortInsulinDose = matchingInsulin
          .filter(s => s.type === 'короткий' || s.type === 'сверхбыстрый')
          .reduce((sum, s) => sum + (s.hour !== undefined ? s.dose : 0), 0);
        const forcedCarbsFromInsulin = Math.round(totalShortInsulinDose * 0.5);
        const forcedCarbs60Min = isInsulinShortMeal ? Math.round(totalShortInsulinDose * 0.3) : 0;

        // GH: avoid carbs 30min before/after each GH injection
      const isGHWindow = ghShots.some(s => Math.abs(h - s.hour) <= 1);
      // IGF: protein-rich meal within 1hr of each injection
      const isIGFWindow = igfShots.some(s => Math.abs(h - s.hour) <= 1);

      const targetP = Math.round(indivProt / indivMeals);
      // Forced carbs from insulin take priority
      const insulinBaseCarbs = isInsulinShortMeal ? forcedCarbsFromInsulin : 0;
      const carbFromMacro = isGHWindow ? 0 : (isInsulinLongMeal ? Math.round(indivCarbs * 0.2) : isPreWorkout || isPostWorkout ? Math.round(indivCarbs * 0.25) : isEvening ? Math.round(indivCarbs * 0.1) : Math.round(indivCarbs * 0.15));
      const targetC = Math.max(insulinBaseCarbs, carbFromMacro) + (isInsulinShortMeal ? forcedCarbs60Min : 0);
      const targetF = isGHWindow || isPreWorkout || isPostWorkout ? 0 : isMorning ? Math.round(indivFat * 0.25) : Math.round(indivFat * 0.15);

      const bindingTags: string[] = [];
      if (isInsulinMeal) bindingTags.push('инсулин');
      if (isGHWindow) bindingTags.push('ГР');
      if (isIGFWindow) bindingTags.push('ИФР-1/MGF');

      const items: { foodName: string; amount: number; kcal: number; p: number; f: number; c: number }[] = [];

      let remainingP = Math.min(targetP, 50);
      const shuffledProt = [...proteinFoods].sort(() => Math.random() - 0.5);
      for (const pf of shuffledProt) {
        if (remainingP <= 0) break;
        const portions = Math.min(1.5, remainingP / pf.protein);
        const grams = Math.round(portions * 100);
        items.push({
          foodName: pf.name,
          amount: grams,
          kcal: Math.round(pf.kcal * portions),
          p: Math.round(pf.protein * portions),
          f: Math.round(pf.fat * portions),
          c: Math.round(pf.carbs * portions),
        });
        remainingP -= Math.round(pf.protein * portions);
      }

      if (targetC > 0) {
        const shuffledCarb = [...carbFoods].sort(() => Math.random() - 0.5);
        for (const cf of shuffledCarb) {
          const cRemaining = targetC - items.reduce((s, it) => s + it.c, 0);
          if (cRemaining <= 5) break;
          const portions = Math.min(1.5, cRemaining / Math.max(1, cf.carbs));
          const grams = Math.round(portions * 100);
          items.push({
            foodName: cf.name,
            amount: grams,
            kcal: Math.round(cf.kcal * portions),
            p: Math.round(cf.protein * portions),
            f: Math.round(cf.fat * portions),
            c: Math.round(cf.carbs * portions),
          });
        }
      }

      if (targetF > 0 && !isPreWorkout && !isPostWorkout) {
        const shuffledFat = [...fatFoods].sort(() => Math.random() - 0.5);
        for (const ff of shuffledFat) {
          const fRemaining = targetF - items.reduce((s, it) => s + it.f, 0);
          if (fRemaining <= 3) break;
          const portions = Math.min(0.3, fRemaining / Math.max(1, ff.fat));
          const grams = Math.round(portions * 100);
          items.push({
            foodName: ff.name,
            amount: Math.max(5, grams),
            kcal: Math.round(ff.kcal * portions),
            p: Math.round(ff.protein * portions),
            f: Math.round(ff.fat * portions),
            c: Math.round(ff.carbs * portions),
          });
        }
      }

      const veg = vegFoods[i % vegFoods.length];
      if (veg) {
        items.push({
          foodName: veg.name,
          amount: 100,
          kcal: veg.kcal,
          p: veg.protein,
          f: veg.fat,
          c: veg.carbs,
        });
      }

      return {
        time, label: labels[i] || `Приём ${i + 1}`,
        items,
        totals: {
          kcal: items.reduce((s, it) => s + it.kcal, 0),
          protein: items.reduce((s, it) => s + it.p, 0),
          fat: items.reduce((s, it) => s + it.f, 0),
          carbs: items.reduce((s, it) => s + it.c, 0),
        },
        isPreWorkout, isPostWorkout,
        isInsulinMeal, isGHNoCarb: isGHWindow, isIGFProtein: isIGFWindow,
        bindingTags,
        prepTime: (() => {
          const names = items.map(it => (it.foodName || '').toLowerCase());
          if (names.some(n => n.includes('говядин') || n.includes('свинин') || n.includes('баранин'))) return 30;
          if (names.some(n => n.includes('куриц') || n.includes('индейк') || n.includes('лосос') || n.includes('треск') || n.includes('палтус'))) return 20;
          if (names.some(n => n.includes('рыб') || n.includes('тунец') || n.includes('креветк'))) return 15;
          if (names.some(n => n.includes('яйц') || n.includes('творог') || n.includes('йогурт') || n.includes('сыр'))) return 10;
          if (names.some(n => n.includes('рис') || n.includes('макарон') || n.includes('картоф') || n.includes('гречк') || n.includes('плов'))) return 20;
          return 15;
        })(),
        cookingMethod: (() => {
          const names = items.map(it => (it.foodName || '').toLowerCase());
          if (names.some(n => n.includes('говядин') || n.includes('свинин') || n.includes('баранин') || n.includes('куриц') || n.includes('индейк'))) return '🍳 жарка';
          if (names.some(n => n.includes('лосос') || n.includes('треск') || n.includes('палтус') || n.includes('рыб'))) return '🔥 запекание';
          if (names.some(n => n.includes('рис') || n.includes('макарон') || n.includes('картоф') || n.includes('гречк') || n.includes('плов') || n.includes('овсянк'))) return '💧 варка';
          if (names.some(n => n.includes('яйц'))) return '💧 варка';
          if (names.some(n => n.includes('творог') || n.includes('йогурт') || n.includes('сыр') || n.includes('орех') || n.includes('авокадо') || n.includes('масло'))) return '🟢 без готовки';
          if (names.some(n => n.includes('креветк') || n.includes('тунец'))) return '💧 варка';
          return '🟢 без готовки';
        })(),
        storage: (() => {
          const names = items.map(it => (it.foodName || '').toLowerCase());
          if (names.some(n => n.includes('творог') || n.includes('йогурт') || n.includes('сыр') || n.includes('молок') || n.includes('кефир'))) return '🧊 холодильник 3 дня';
          if (names.some(n => n.includes('говядин') || n.includes('куриц') || n.includes('индейк') || n.includes('свинин') || n.includes('рыб') || n.includes('лосос') || n.includes('яйц'))) return '❄️ морозилка 1 мес';
          if (names.some(n => n.includes('рис') || n.includes('гречк') || n.includes('плов') || n.includes('макарон'))) return '🧊 холодильник 3 дня';
          if (names.some(n => n.includes('овощ') || n.includes('фрукт') || n.includes('яблок') || n.includes('огур') || n.includes('помидор') || n.includes('салат') || n.includes('зелен'))) return '🧊 холодильник 5 дней';
          if (names.some(n => n.includes('орех') || n.includes('масло') || n.includes('авокадо'))) return '📦 комн. темп 2 нед';
          return '🧊 холодильник 3 дня';
        })(),
      };
    });

    const dayTotals = {
      kcal: meals.reduce((s: number, m: any) => s + m.totals.kcal, 0),
      protein: meals.reduce((s: number, m: any) => s + m.totals.protein, 0),
      fat: meals.reduce((s: number, m: any) => s + m.totals.fat, 0),
      carbs: meals.reduce((s: number, m: any) => s + m.totals.carbs, 0),
    };

    // Insulin warnings and glucose impact
    const insulinWarnings: string[] = [];
    const glucoseEstimates: { mealIdx: number; label: string; glucoseImpact: number; risk: 'low' | 'medium' | 'high'; note: string }[] = [];

    // Calculate total daily short insulin dose and required carbs
    const totalDailyShortDose = indivInsulinShots
      .filter(s => s.type === 'короткий' || s.type === 'сверхбыстрый')
      .reduce((sum, s) => sum + s.dose, 0);
    const totalDailyLongDose = indivInsulinShots
      .filter(s => s.type === 'длинный')
      .reduce((sum, s) => sum + s.dose, 0);
    const minDailyCarbs = Math.round(totalDailyShortDose * 0.5);
    const totalDailyInsulinIU = totalDailyShortDose + totalDailyLongDose;

    if (totalDailyShortDose > 0) {
      insulinWarnings.push(`⚠️ Риск гипогликемии! Минимум ${minDailyCarbs}г углеводов в день для покрытия ${totalDailyShortDose} IU короткого инсулина. Обеспечьте минимум 15-20г быстрых углеводов через 30 мин после инсулина.`);
    }
    if (totalDailyLongDose > 0) {
      insulinWarnings.push(`💉 Длинный инсулин (${totalDailyLongDose} IU/день): обеспечьте равномерное питание каждые 3-4 часа для стабильной гликемии.`);
    }
    if (totalDailyInsulinIU > 0) {
      insulinWarnings.push(`📊 Общая суточная доза инсулина: ${totalDailyInsulinIU} IU. Расчётная суточная потребность в углеводах: минимум ${minDailyCarbs}г (0.5 г/кг веса на IU короткого).`);
    }

    meals.forEach((meal: any, mi: number) => {
      const h = parseInt(meal.time.split(':')[0]);
      const mealCarbs = meal.totals.carbs;
      const mealKcal = meal.totals.kcal;
      const matchingInsulin = insulinShots.filter(s => Math.abs(h - s.hour) <= 1);
      const hasShortInsulin = matchingInsulin.some(s => s.type === 'короткий' || s.type === 'сверхбыстрый');
      const hasLongInsulin = matchingInsulin.some(s => s.type === 'длинный');

      // Glucose impact estimate: carbs × 3.5-5 mg/dL per gram, modulated by insulin
      let giFactor = 4.0;
      if (hasShortInsulin) giFactor = 2.0;
      else if (hasLongInsulin) giFactor = 3.0;
      const glucoseImpact = Math.round(mealCarbs * giFactor);

      let risk: 'low' | 'medium' | 'high' = 'low';
      let note = 'Стабильный уровень глюкозы';
      if (hasShortInsulin && mealCarbs < 20) {
        risk = 'high';
        note = `⚠ Риск гипогликемии! Минимум 15-20г быстрых углеводов через 30 мин после инсулина.`;
        insulinWarnings.push(`Приём ${meal.label} (${meal.time}): мало углеводов (${mealCarbs}г) для короткого инсулина (${totalDailyShortDose} IU) — риск гипогликемии! Добавьте минимум 15-20г быстрых углеводов.`);
      } else if (hasShortInsulin && mealCarbs >= Math.max(20, totalDailyShortDose * 0.5)) {
        risk = 'low';
        note = '✓ Адекватное покрытие углеводами';
      } else if (hasShortInsulin) {
        risk = 'medium';
        note = '⚡ Добавьте 15-20г быстрых углеводов';
      } else if (glucoseImpact > 150) {
        risk = 'medium';
        note = 'Высокая гликемическая нагрузка';
      }

      glucoseEstimates.push({ mealIdx: mi, label: meal.label, glucoseImpact, risk, note });

      // IGF-1/MGF protein timing suggestion
      const igfShots = indivIGFShots.map(s => ({ ...s, hour: parseInt(s.time.split(':')[0]) }));
      const nearIGF = igfShots.some(s => Math.abs(h - s.hour) <= 1);
      if (nearIGF && meal.totals.protein < 30) {
        insulinWarnings.push(`Приём ${meal.label} (${meal.time}): в окне ИФР-1/MGF рекомендуется ≥30г белка (сейчас ${meal.totals.protein}г)`);
      }

      // Attach glucose impact to meal
      meal.glucoseImpact = glucoseImpact;
      meal.glucoseRisk = risk;
      meal.glucoseNote = note;
    });

    setIndivPlan({ meals, dayTotals, insulinWarnings, glucoseEstimates });
  };

  const TIER_BTNS: { tier: MealTier; label: string; color: string; gradient: string }[] = [
    { tier: 'basic', label: 'База', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e44, #22c55e08)' },
    { tier: 'mid', label: 'Средний', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b44, #f59e0b08)' },
    { tier: 'max', label: 'Усиление', color: '#f97316', gradient: 'linear-gradient(135deg, #f9731644, #f9731608)' },
    { tier: 'boost', label: 'Максимум', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef444444, #ef444408)' },
  ];

  const getSwapsForItem = (foodName: string, category: string): any[] => {
    const candidates = FOOD_DB.filter(f => f.category === category && f.name !== foodName).sort(() => Math.random() - 0.5).slice(0, 3);
    return candidates.map(f => ({
      foodName: f.name, foodId: f.id, amount: 100,
      kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs,
    }));
  };

  const handleTierGenerate = (tier: MealTier) => {
    const s = profile?.settings;
    const baseInput = {
      weightKg: s?.weight ?? 80,
      heightCm: s?.height ?? 180,
      age: s?.age ?? 30,
      sex: s?.sex ?? 'male',
      goal: (s?.primaryGoal as any) || (s?.goal as any) || 'maintenance',
      tier,
      trainingDaysPerWeek: s?.workoutsPerWeek ?? 3,
      avgWorkoutMinutes: s?.avgWorkoutMinutes ?? 60,
      includeWorkoutMeals: true,
    };
    const result = generateTierMealPlan(baseInput as any);
    setTierResult(result);
    setActiveTier(tier);
    setActiveVariant(0);
    setPlanSaved(false);
    const a = generateTierMealPlan(baseInput as any);
    const b = generateTierMealPlan(baseInput as any);
    setVariantPlans([a, b]);
  };

  const saveMealPlan = () => {
    if (!tierResult) return;
    try {
      const key = 'savedMealPlans';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const plan = {
        id: Date.now(),
        tier: activeTier,
        date: new Date().toISOString().split('T')[0],
        result: tierResult,
      };
      existing.unshift(plan);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 10)));
      setPlanSaved(true);
      setTimeout(() => setPlanSaved(false), 2000);
    } catch {}
  };

  const msTab = mealSubTab || 'planoverview';
  const setMs = setMealSubTab || ((v: string) => {});

  return (
    <div>
      {/* Sub-tab pills */}
      <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
        {[
          { id:'planoverview', label:'📋 Обзор' },
          { id:'rules', label:'📋 Правила питания' },
          { id:'products', label:'📋 Обзор продуктов' },
        ].map(st => (
          <button key={st.id} onClick={() => setMs(st.id)} style={{
            padding:'6px 12px', borderRadius:16, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
            background: msTab === st.id ? 'var(--accent)' : 'var(--bg-secondary)',
            color: msTab === st.id ? '#000' : 'var(--text-dim)',
            border: `1px solid ${msTab === st.id ? 'var(--accent)' : 'var(--border)'}`,
          }}>{st.label}</button>
        ))}
      </div>

      {msTab === 'planoverview' && (<>
      <div className="card" style={{ marginBottom: 8, padding: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>🏷️ Выберите уровень питания</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {TIER_BTNS.map(tb => (
            <button key={tb.tier} onClick={() => handleTierGenerate(tb.tier)} style={{
              background: activeTier === tb.tier ? tb.gradient : 'var(--bg-secondary)',
              border: activeTier === tb.tier ? `1.5px solid ${tb.color}` : '1px solid var(--border)',
              borderRadius: 20, padding: '8px 12px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.2s', color: activeTier === tb.tier ? tb.color : 'var(--text-dim)',
              fontWeight: activeTier === tb.tier ? 700 : 500, fontSize: 12,
            }}>
              {tb.label}
            </button>
          ))}
        </div>
        {tierResult && (
          <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
              {tierResult.summary.tier === 'basic' ? 'База' : tierResult.summary.tier === 'mid' ? 'Средний' : tierResult.summary.tier === 'max' ? 'Усиление' : 'Максимум'} — {tierResult.summary.avgKcal} ккал
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, textAlign: 'center', marginBottom: 8, fontSize: 10 }}>
              <div><span style={{ color: 'var(--text-dim)' }}>Белки</span><div style={{ fontWeight: 700, color: '#3b82f6' }}>{tierResult.summary.avgProtein}г</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Жиры</span><div style={{ fontWeight: 700, color: '#f59e0b' }}>{tierResult.summary.avgFat}г</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Углеводы</span><div style={{ fontWeight: 700, color: '#f97316' }}>{tierResult.summary.avgCarbs}г</div></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Порций</span><div style={{ fontWeight: 700, color: '#a855f7' }}>{tierResult.dayPlans[0]?.meals.length || '-'}</div></div>
            </div>

            {/* ─── Variant tabs ─── */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {['А', 'Б', 'В'].map((vl, v) => (
                <button key={v} onClick={() => setActiveVariant(v)} style={{
                  flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontWeight: 600,
                  background: activeVariant === v ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: activeVariant === v ? '#000' : 'var(--text-dim)',
                  border: activeVariant === v ? 'none' : '1px solid var(--border)',
                }}>Вариант {vl}</button>
              ))}
            </div>

            {/* Get display plan */}
            {(() => {
              const displayPlan = activeVariant === 0 ? tierResult : variantPlans[activeVariant - 1] || tierResult;
              return displayPlan ? (
                <div>
                  {displayPlan.dayPlans.length > 0 && (
                    <div style={{ fontSize: 9 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-light)' }}>
                        {displayPlan.dayPlans[0].isTrainingDay ? 'Тренировочный день' : 'День отдыха'}
                      </div>
                      {displayPlan.dayPlans[0].meals.map((m, mi) => (
                        <div key={mi} style={{ marginBottom: 5, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{m.name} ({m.time})</div>
                            <button onClick={() => setSwapPopup({ mealIdx: mi, foodIdx: -1 })} style={{
                              padding: '2px 6px', borderRadius: 4, fontSize: 8, cursor: 'pointer',
                              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                              color: '#8b5cf6', fontWeight: 500, flexShrink: 0,
                            }}>🔄 Заменить блюдо</button>
                          </div>
                          <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                            {m.items.map((it, ii) => (
                              <span key={ii} style={{
                                display: 'inline-block', margin: '1px 2px', padding: '1px 6px',
                                borderRadius: 4, fontSize: 8,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                              }}>{it.foodName} {it.amount}г</span>
                            ))}
                          </div>
                          {/* Swap popup */}
                          {swapPopup && swapPopup.mealIdx === mi && (
                            <div style={{
                              marginTop: 6, padding: 8, borderRadius: 8,
                              background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
                            }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: '#8b5cf6', marginBottom: 4 }}>
                                Выберите замену для «{m.name}»:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {(() => {
                                  const mainItemCategory = m.items[0] ? (FOOD_DB.find(f => f.name === m.items[0].foodName)?.category || 'protein') : 'protein';
                                  const swaps = getSwapsForItem(m.items[0]?.foodName || '', mainItemCategory);
                                  return swaps.map((sw, si) => (
                                    <button key={si} onClick={() => {
                                      if (displayPlan.dayPlans[0].meals[mi].items.length > 0) {
                                        displayPlan.dayPlans[0].meals[mi].items[0] = { ...sw };
                                        setTierResult({ ...tierResult, dayPlans: [...(activeVariant === 0 ? tierResult : variantPlans[activeVariant - 1] || tierResult).dayPlans] });
                                      }
                                      setSwapPopup(null);
                                    }} style={{
                                      display: 'flex', justifyContent: 'space-between', padding: '4px 8px',
                                      borderRadius: 6, fontSize: 9, cursor: 'pointer',
                                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                      color: 'var(--text)', textAlign: 'left',
                                    }}>
                                      <span>{sw.foodName} {sw.amount}г</span>
                                      <span style={{ color: 'var(--text-dim)' }}>{sw.kcal}ккал Б{sw.protein} Ж{sw.fat} У{sw.carbs}</span>
                                    </button>
                                  ));
                                })()}
                              </div>
                              <button onClick={() => setSwapPopup(null)} style={{
                                marginTop: 4, padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-dim)',
                              }}>Отмена</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {displayPlan.dayPlans[0].totals && (
                        <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                          Итого: {displayPlan.dayPlans[0].totals.kcal}ккал Б:{displayPlan.dayPlans[0].totals.protein}г Ж:{displayPlan.dayPlans[0].totals.fat}г У:{displayPlan.dayPlans[0].totals.carbs}г
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* Save button */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={saveMealPlan} style={{
                flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: planSaved ? '#22c55e' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff', fontWeight: 700, fontSize: 11,
              }}>
                {planSaved ? '✅ Сохранено!' : '💾 Сохранить рацион'}
              </button>
            </div>

            {tierResult.workoutMealPlan && (
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>🏋️ Питание вокруг тренировки</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>{tierResult.workoutMealPlan.description}</div>
                {tierResult.workoutMealPlan.meals.map((m, mi) => (
                  <div key={mi} style={{ fontSize: 9, marginBottom: 2 }}>
                    <b>{m.name}</b> ({m.time}): {m.items.map(i => `${i.foodName} ${i.amount}г`).join(', ')}
                  </div>
                ))}
                {tierResult.workoutMealPlan.supplements.length > 0 && (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                    <b>Добавки:</b> {tierResult.workoutMealPlan.supplements.map(s => `${s.name} ${s.dose} (${s.timing})`).join(' | ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </>)}

      {msTab === 'rules' && (<>
      <div className="card" style={{ marginBottom: 8, padding: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--accent)' }}>📋 Правила питания</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NUTRITION_RULES.map((rule, i) => (
            <div key={i} style={{
              borderRadius: 10, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.06)',
              transition: 'all 0.25s ease',
            }}>
              <button
                onClick={() => toggleRule(i)}
                style={{
                  width: '100%', padding: '8px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: expandedRules.has(i) ? `${rule.color}10` : 'var(--bg-secondary)',
                  border: 'none', color: 'var(--text)', textAlign: 'left',
                  fontSize: 11, fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: rule.color + '20', color: rule.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700,
                  transition: 'transform 0.2s',
                  transform: expandedRules.has(i) ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>›</span>
                <span>{rule.title}</span>
              </button>
              {expandedRules.has(i) && (
                <div style={{
                  padding: '8px 12px 8px 40px',
                  fontSize: 10, color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)',
                  background: 'rgba(0,0,0,0.15)',
                }}>
                  {rule.body}
                </div>
              )}
            </div>
          ))}
          {/* Regime advice merged from former "Режим" tab */}
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.25s ease', marginTop: 4 }}>
            <button
              onClick={() => toggleRule(NUTRITION_RULES.length)}
              style={{
                width: '100%', padding: '8px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                background: expandedRules.has(NUTRITION_RULES.length) ? 'rgba(0,230,138,0.06)' : 'var(--bg-secondary)',
                border: 'none', color: 'var(--text)', textAlign: 'left',
                fontSize: 11, fontWeight: 600,
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 6,
                background: 'rgba(0,230,138,0.12)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 13, fontWeight: 700,
                transition: 'transform 0.2s',
                transform: expandedRules.has(NUTRITION_RULES.length) ? 'rotate(90deg)' : 'rotate(0deg)',
              }}>›</span>
              <span>⏰ Режим питания (тайминг приёмов)</span>
            </button>
            {expandedRules.has(NUTRITION_RULES.length) && (
              <div style={{
                padding: '8px 12px 8px 40px',
                fontSize: 10, color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(0,0,0,0.15)',
              }}>
                {regimeAdviceLines.map((a, j) => (
                  <div key={j} style={{ padding: '4px 0', borderBottom: j < regimeAdviceLines.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>{a}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </>)}

      {msTab === 'products' && (<>
      <div className="card" style={{ marginBottom: 8, padding: 14 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--accent)' }}>🍽 Рекомендуемые продукты</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(RECOMMENDED_FOODS).map(([cat, { items, color, bg }]) => (
            <div key={cat}>
              <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 5 }}>{cat}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {items.map((item, j) => (
                  <span key={j} style={{
                    padding: '3px 8px', borderRadius: 14, fontSize: 9,
                    background: bg, color, border: `1px solid ${color}20`,
                    whiteSpace: 'nowrap',
                  }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 8, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h4 style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>📊 Качество продуктов</h4>
          <button
            onClick={() => setQualityFromDB(!qualityFromDB)}
            style={{
              padding: '4px 10px', borderRadius: 14, fontSize: 9, fontWeight: 600, cursor: 'pointer',
              background: qualityFromDB ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
              border: qualityFromDB ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)',
              color: qualityFromDB ? 'var(--accent)' : 'var(--text-dim)',
              transition: 'all 0.2s',
            }}
          >
            {qualityFromDB ? '🗄 Из БД' : '📋 Ручной'}
          </button>
        </div>
        <p style={{ fontSize: 9, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          {qualityFromDB ? 'Авто-оценка всей БД: tier (max=10, mid=8, basic=6) или анализ плотности белка, клетчатки, ГИ, омега-3' : 'Оценка источников белка, углеводов и жиров по шкале 1–10'}
        </p>
        {qualityFromDB ? (
          // ── DB-generated quality scores (all foods, auto-scored) ──
          <>
            <h5 style={{ margin: '8px 0 6px', fontSize: 11, color: '#3b82f6' }}>Белки (из БД, {dbQualityScores.proteins.length})</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
              {dbQualityScores.proteins.map((p, j) => {
                const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
                return (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: j < dbQualityScores.proteins.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ minWidth: 28, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor + '15', color: scoreColor, fontWeight: 800, fontSize: 10 }}>{p.score}/10</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: 4, marginTop: 1, flexWrap: 'wrap' }}>
                        {p.pros.map((pr, i) => <span key={i} style={{ fontSize: 7, color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '0 4px', borderRadius: 4 }}>+{pr}</span>)}
                        {p.cons.map((cn, i) => <span key={i} style={{ fontSize: 7, color: '#ef4444', background: 'rgba(239,68,68,0.06)', padding: '0 4px', borderRadius: 4 }}>−{cn}</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <h5 style={{ margin: '8px 0 6px', fontSize: 11, color: '#f97316' }}>Углеводы (из БД, {dbQualityScores.carbs.length})</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
              {dbQualityScores.carbs.map((p, j) => {
                const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
                return (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: j < dbQualityScores.carbs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ minWidth: 28, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor + '15', color: scoreColor, fontWeight: 800, fontSize: 10 }}>{p.score}/10</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: 4, marginTop: 1, flexWrap: 'wrap' }}>
                        {p.pros.map((pr, i) => <span key={i} style={{ fontSize: 7, color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '0 4px', borderRadius: 4 }}>+{pr}</span>)}
                        {p.cons.map((cn, i) => <span key={i} style={{ fontSize: 7, color: '#ef4444', background: 'rgba(239,68,68,0.06)', padding: '0 4px', borderRadius: 4 }}>−{cn}</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <h5 style={{ margin: '8px 0 6px', fontSize: 11, color: '#f59e0b' }}>Жиры (из БД, {dbQualityScores.fats.length})</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {dbQualityScores.fats.map((p, j) => {
                const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
                return (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: j < dbQualityScores.fats.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ minWidth: 28, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor + '15', color: scoreColor, fontWeight: 800, fontSize: 10 }}>{p.score}/10</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: 4, marginTop: 1, flexWrap: 'wrap' }}>
                        {p.pros.map((pr, i) => <span key={i} style={{ fontSize: 7, color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '0 4px', borderRadius: 4 }}>+{pr}</span>)}
                        {p.cons.map((cn, i) => <span key={i} style={{ fontSize: 7, color: '#ef4444', background: 'rgba(239,68,68,0.06)', padding: '0 4px', borderRadius: 4 }}>−{cn}</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // ── Manual curated quality scores ──
          <>
        <h5 style={{ margin: '8px 0 6px', fontSize: 11, color: '#3b82f6' }}>Белки (оценка 1–10)</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { name: 'Куриная грудка', score: 9, desc: 'Чистый белок, минимум жира, нейтральный вкус, универсальна' },
            { name: 'Индейка', score: 9, desc: 'Как курица, чуть суше, больше цинка' },
            { name: 'Яйца', score: 10, desc: 'Эталонный белок, полный аминокислотный профиль, биодоступность 98%' },
            { name: 'Говядина постная', score: 8, desc: 'Креатин, железо, цинк, витамины B. Минус: насыщенные жиры' },
            { name: 'Свинина (вырезка)', score: 7, desc: 'Хороший белок, витамин B1. Минус: больше жира, возможны добавки при выращивании' },
            { name: 'Лосось', score: 9, desc: 'Омега-3, витамин D, высокий белок. Минус: цена, тяжёлые металлы при низком качестве' },
            { name: 'Тунец', score: 8, desc: 'Отличный белок, низкий жир. Минус: ртуть (ограничивать до 2–3 порций/нед)' },
            { name: 'Творог', score: 8, desc: 'Медленный казеин, кальций. Минус: лактоза (при непереносимости замена на безлактозный)' },
            { name: 'Протеин сывороточный', score: 9, desc: 'Быстрое усвоение, полный профиль. Минус: искусственные подсластители в некоторых' },
            { name: 'Соевый белок', score: 6, desc: 'Полный растительный профиль. Минус: фитоэстрогены, антинутриенты, ГМО в неорганическом' },
            { name: 'Баранина', score: 7, desc: 'Хороший белок, цинк, B12. Минус: высокий насыщенный жир, специфичный вкус' },
            { name: 'Индейка', score: 9, desc: 'Нежное мясо, цинк, селен. Минус: суховата при переготовке' },
            { name: 'Говяжья печень', score: 10, desc: 'Суперфуд: железо, B12, медь, витамин A. Минус: вкус на любителя, холестерин' },
            { name: 'Креветки', score: 8, desc: 'Чистый белок, йод, селен. Минус: холестерин, цена' },
            { name: 'Тунец консервированный', score: 7, desc: 'Удобный белок. Минус: ртуть, BPA в банках' },
            { name: 'Кролик', score: 9, desc: 'Диетическое мясо, легко усваивается. Минус: цена, доступность' },
          ].map((p, j) => {
            const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
            return (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: j < 15 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ minWidth: 32, height: 22, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor + '15', color: scoreColor, fontWeight: 800, fontSize: 11 }}>{p.score}/10</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 6 }}>— {p.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
        <h5 style={{ margin: '12px 0 6px', fontSize: 11, color: '#f97316' }}>Углеводы (оценка 1–10)</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { name: 'Рис белый', score: 8, desc: 'Быстрые углеводы, легко усваивается. Минус: высокий ГИ, мало клетчатки' },
            { name: 'Гречка', score: 9, desc: 'Медленные углеводы, магний, железо. Минус: специфичный вкус не всем' },
            { name: 'Овсянка', score: 9, desc: 'Бета-глюкан, клетчатка, медленная энергия. Минус: фитиновая кислота' },
            { name: 'Картофель', score: 7, desc: 'Калий, витамин C. Минус: высокий ГИ, соланин в зелёном' },
            { name: 'Батат', score: 9, desc: 'Витамин A, клетчатка, низкий ГИ. Минус: цена' },
            { name: 'Макароны твёрдых сортов', score: 8, desc: 'Медленные углеводы, сытость. Минус: глютен' },
            { name: 'Хлеб цельнозерновой', score: 7, desc: 'Клетчатка, витамины B. Минус: глютен, фитаты' },
            { name: 'Булгур', score: 8, desc: 'Клетчатка, магний. Минус: глютен' },
            { name: 'Киноа', score: 9, desc: 'Полный белок + углеводы. Минус: цена, сапонины' },
            { name: 'Кукурузные хлопья (без пшеницы)', score: 5, desc: 'Быстрая энергия. Минус: обработанные, часто с сахаром' },
            { name: 'Рис басмати', score: 8, desc: 'Ароматный, низкий ГИ. Минус: цена выше обычного риса' },
            { name: 'Перловка', score: 8, desc: 'Самый низкий ГИ среди круп, клетчатка. Минус: долго варить' },
            { name: 'Кус-кус', score: 7, desc: 'Быстро готовится. Минус: средний ГИ, мало клетчатки' },
            { name: 'Пшено', score: 7, desc: 'Магний, кремний. Минус: горчит при неправильной варке' },
            { name: 'Нут', score: 9, desc: 'Белок + углеводы, клетчатка. Минус: долгое замачивание' },
          ].map((p, j) => {
            const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
            return (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: j < 14 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ minWidth: 32, height: 22, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor + '15', color: scoreColor, fontWeight: 800, fontSize: 11 }}>{p.score}/10</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 6 }}>— {p.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
        <h5 style={{ margin: '12px 0 6px', fontSize: 11, color: '#f59e0b' }}>Жиры (оценка 1–10)</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { name: 'Оливковое масло extra virgin', score: 10, desc: 'Мононенасыщенные жиры, полифенолы, антивоспалительное' },
            { name: 'Авокадо', score: 10, desc: 'Калий, клетчатка, мононенасыщенные жиры' },
            { name: 'Кокосовое масло', score: 7, desc: 'MCT, быстрая энергия. Минус: насыщенные жиры' },
            { name: 'Орехи (грецкие)', score: 8, desc: 'Омега-3, магний. Минус: калорийность, оксалаты' },
            { name: 'Сливочное масло', score: 6, desc: 'Витамин A, вкус. Минус: насыщенные жиры, холестерин' },
            { name: 'Рыбий жир', score: 10, desc: 'Омега-3 EPA/DHA, антивоспалительное' },
            { name: 'Льняное масло', score: 8, desc: 'ALA омега-3. Минус: нестабильно, быстро окисляется' },
            { name: 'Яичный желток', score: 8, desc: 'Лецитин, холин, витамины. Минус: холестерин' },
            { name: 'Грецкие орехи', score: 9, desc: 'Омега-3 ALA, магний. Минус: калорийность' },
            { name: 'Миндаль', score: 9, desc: 'Витамин E, магний. Минус: оксалаты при больших дозах' },
            { name: 'Кедровые орехи', score: 8, desc: 'Уникальный жирнокислотный состав. Минус: цена' },
            { name: 'Урбеч кокосовый', score: 7, desc: 'MCT, быстрая энергия. Минус: насыщенные жиры' },
            { name: 'Красная икра', score: 9, desc: 'Омега-3, витамин D, белок. Минус: соль, цена' },
          ].map((p, j) => {
            const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
            return (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: j < 12 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ minWidth: 32, height: 22, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor + '15', color: scoreColor, fontWeight: 800, fontSize: 11 }}>{p.score}/10</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 6 }}>— {p.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 8, padding: 14, border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.03)' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#8b5cf6' }}>🍽 Сочетаемость продуктов</h4>
        <p style={{ fontSize: 9, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          Научно обоснованные комбинации: синергии (усиление) и конфликты (снижение усвоения)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { pair: 'Железо + Витамин C', effect: '+200% всасывания', note: 'Мясо/печень + лимон, перец, томаты, цитрусовые. Витамин C восстанавливает Fe³⁺ → Fe²⁺.', type: 'synergy' as const },
            { pair: 'Куркумин + Чёрный перец', effect: '+2000% биодоступности', note: 'Пиперин ингибирует глюкуронидацию куркумина в печени.', type: 'synergy' as const },
            { pair: 'Кальций + Кофеин', effect: '−30% всасывания Ca', note: 'Не запивать молочные продукты кофе/чаем. Интервал 1-2 часа.', type: 'conflict' as const },
            { pair: 'Цинк + Фитиновая кислота', effect: '−50% всасывания Zn', note: 'Не есть мясо с хлебом/овсянкой. Фитиновая кислота связывает цинк.', type: 'conflict' as const },
            { pair: 'Омега-3 + Витамин E', effect: 'Защита от окисления', note: 'Витамин E предотвращает перекисное окисление ПНЖК в мембранах.', type: 'synergy' as const },
            { pair: 'D3 + K2 (MK-7)', effect: 'Синергия Ca-обмена', note: 'D3 повышает всасывание Ca, K2 направляет его в кости, а не в сосуды.', type: 'synergy' as const },
            { pair: 'Белок + Клетчатка', effect: 'Замедление усвоения', note: 'Полезно на ночь: пролонгированный аминокислотный поток (казеин + овощи).', type: 'neutral' as const },
            { pair: 'Углеводы + Корица', effect: '−20-30% гликемии', note: 'Корица замедляет опорожнение желудка и повышает чувствительность к инсулину.', type: 'synergy' as const },
          ].map((p, j) => {
            const typeColor = p.type === 'synergy' ? '#22c55e' : p.type === 'conflict' ? '#ef4444' : '#f59e0b';
            const typeIcon = p.type === 'synergy' ? '⊕' : p.type === 'conflict' ? '⊖' : '○';
            const bg = p.type === 'synergy' ? 'rgba(34,197,94,0.06)' : p.type === 'conflict' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)';
            return (
              <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', background: bg, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ minWidth: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: typeColor + '15', color: typeColor, fontWeight: 800, fontSize: 13 }}>{typeIcon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{p.pair}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: typeColor, background: typeColor + '12', padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap' }}>{p.effect}</span>
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.4 }}>{p.note}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 8, padding: 14, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#ef4444' }}>⚠️ Ограничить</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { item: 'Молочные продукты', note: 'лактоза → воспаление, застой желчи, акне' },
            { item: 'Соления', note: 'грибки + натрий → отёки, нагрузка на почки' },
            { item: 'Бурый рис', note: 'фитиновая кислота, антинутриенты → хуже усвоение' },
            { item: 'Сладкие фрукты', note: 'фруктоза → жировое депо при полном гликогене' },
          ].map((w, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
              <span style={{ color: '#ef4444', flexShrink: 0 }}>✕</span>
              <div>
                <span style={{ fontWeight: 600, color: '#ef4444' }}>{w.item}</span>
                <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>— {w.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>)}

      {msTab !== 'products' && msTab !== 'rules' && (<>
      <div className="card" style={{ marginBottom: 8, padding: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--accent)' }}>🎯 Индивидуальный план</h4>
        <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          План питания на основе ваших параметров, времени тренировки и ограничений
        </p>

        {/* ─── Dietary presets ─── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {[
            { id: 'classic', icon: '🥩', label: 'Классический', kcal: tKcal, p: tProt, f: tFat, c: tCarbs, desc: 'Стандарт' },
            { id: 'keto', icon: '🥑', label: 'Кето', kcal: tKcal, p: Math.round(tProt * 1.1), f: Math.round(tFat * 2.5), c: 45, desc: 'Низкоуглеводный' },
            { id: 'highcarb', icon: '🍚', label: 'Высоко-углеводный', kcal: tKcal, p: Math.round(tKcal * 0.25 / 4), f: Math.round(tKcal * 0.15 / 9), c: Math.round(tKcal * 0.6 / 4), desc: 'У 60%' },
            { id: 'mediterranean', icon: '⚖️', label: 'Средиземноморский', kcal: tKcal, p: Math.round(tProt * 0.85), f: Math.round(tKcal * 0.35 / 9), c: Math.round(tKcal * 0.45 / 4), desc: 'Рыба, оливки' },
            { id: 'vegetarian', icon: '🌱', label: 'Вегетарианский', kcal: tKcal, p: Math.round(tProt * 0.8), f: Math.round(tFat * 1.2), c: Math.round(tKcal * 0.55 / 4), desc: 'Растительный' },
          ].map(p => (
            <button key={p.id} onClick={() => {
              setSelectedPreset(p.id);
              setIndivKcal(p.kcal);
              setIndivProt(p.p);
              setIndivFat(p.f);
              setIndivCarbs(p.c);
              if (p.id === 'keto') { setIndivDairyFree(false); setIndivGlutenFree(true); }
              if (p.id === 'mediterranean') { setIndivFishFree(false); }
              if (p.id === 'vegetarian') { setIndivFishFree(true); setIndivEggFree(false); }
            }} style={{
              padding: '5px 10px', borderRadius: 16, fontSize: 9, cursor: 'pointer', fontWeight: 600,
              background: selectedPreset === p.id ? 'rgba(0,230,138,0.15)' : 'var(--glass-bg)',
              color: selectedPreset === p.id ? '#00e68a' : 'var(--text-dim)',
              border: selectedPreset === p.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--glass-border)',
              transition: 'all 0.2s',
            }}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Ккал/день</label>
            <input type="number" value={indivKcal} onChange={e => setIndivKcal(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Белок (г)</label>
            <input type="number" value={indivProt} onChange={e => setIndivProt(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Жиры (г)</label>
            <input type="number" value={indivFat} onChange={e => setIndivFat(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Углеводы (г)</label>
            <input type="number" value={indivCarbs} onChange={e => setIndivCarbs(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Приёмов в день</label>
            <select value={indivMeals} onChange={e => setIndivMeals(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
              {[3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Время тренировки</label>
            <input type="time" value={indivTrainTime} onChange={e => setIndivTrainTime(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={indivDairyFree} onChange={e => setIndivDairyFree(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Без молочки
          </label>
          <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={indivGlutenFree} onChange={e => setIndivGlutenFree(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Без глютена
          </label>
          <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={indivFishFree} onChange={e => setIndivFishFree(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Без рыбы
          </label>
          <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={indivNutFree} onChange={e => setIndivNutFree(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Без орехов
          </label>
          <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={indivEggFree} onChange={e => setIndivEggFree(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Без яиц
          </label>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)', margin: '8px 0 4px' }}>💉 Инъекции инсулина</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Время</span>
            <input type="time" value={newInsulinTime} onChange={e => setNewInsulinTime(e.target.value)} style={{ padding: '3px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Доза (IU)</span>
            <input type="number" value={newInsulinDose} onChange={e => setNewInsulinDose(parseFloat(e.target.value) || 0)} style={{ width: 55, padding: '3px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Тип</span>
            <select value={newInsulinType} onChange={e => setNewInsulinType(e.target.value)} style={{ padding: '3px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, boxSizing: 'border-box' }}>
              <option value="короткий">короткий</option>
              <option value="длинный">длинный</option>
              <option value="сверхбыстрый">сверхбыстрый</option>
            </select>
          </div>
          <button onClick={() => setIndivInsulinShots([...indivInsulinShots, { time: newInsulinTime, dose: newInsulinDose, type: newInsulinType }])} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid #06b6d4', cursor: 'pointer',
            background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontWeight: 600, fontSize: 10,
          }}>+ Добавить укол</button>
        </div>
        {indivInsulinShots.map((shot, i) => (
          <div key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 6px', borderRadius: 6, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)', fontSize: 9, marginRight: 4, marginBottom: 4, color: '#06b6d4' }}>
            💉 {shot.time} {shot.dose}IU {shot.type}
            <button onClick={() => setIndivInsulinShots(indivInsulinShots.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)', margin: '6px 0 4px' }}>💉 Инъекции ГР</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Время</span>
            <input type="time" value={newGHTime} onChange={e => setNewGHTime(e.target.value)} style={{ padding: '3px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Доза (IU)</span>
            <input type="number" value={newGHDose} onChange={e => setNewGHDose(parseFloat(e.target.value) || 0)} style={{ width: 55, padding: '3px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, boxSizing: 'border-box' }} />
          </div>
          <button onClick={() => setIndivGHShots([...indivGHShots, { time: newGHTime, dose: newGHDose }])} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid #a855f7', cursor: 'pointer',
            background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 600, fontSize: 10,
          }}>+ Добавить укол</button>
        </div>
        {indivGHShots.map((shot, i) => (
          <div key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 6px', borderRadius: 6, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', fontSize: 9, marginRight: 4, marginBottom: 4, color: '#a855f7' }}>
            💉 {shot.time} {shot.dose}IU
            <button onClick={() => setIndivGHShots(indivGHShots.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)', margin: '6px 0 4px' }}>💉 Инъекции ИФР-1/MGF</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Время</span>
            <input type="time" value={newIGFTime} onChange={e => setNewIGFTime(e.target.value)} style={{ padding: '3px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Доза (mcg)</span>
            <input type="number" value={newIGFDose} onChange={e => setNewIGFDose(parseFloat(e.target.value) || 0)} style={{ width: 55, padding: '3px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, boxSizing: 'border-box' }} />
          </div>
          <button onClick={() => setIndivIGFShots([...indivIGFShots, { time: newIGFTime, dose: newIGFDose }])} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid #ec4899', cursor: 'pointer',
            background: 'rgba(236,72,153,0.1)', color: '#ec4899', fontWeight: 600, fontSize: 10,
          }}>+ Добавить укол</button>
        </div>
        {indivIGFShots.map((shot, i) => (
          <div key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 6px', borderRadius: 6, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.15)', fontSize: 9, marginRight: 4, marginBottom: 4, color: '#ec4899' }}>
            💉 {shot.time} {shot.dose}mcg
            <button onClick={() => setIndivIGFShots(indivIGFShots.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
        {/* Macro cycling toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: macroCyclingEnabled ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)', border: macroCyclingEnabled ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)' }}>
          <button onClick={() => setMacroCyclingEnabled(!macroCyclingEnabled)} style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none',
            background: macroCyclingEnabled ? '#3b82f6' : 'var(--border)',
            position: 'relative' as const, transition: 'background 0.2s',
          }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: macroCyclingEnabled ? 18 : 2, transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: 11, fontWeight: 600, color: macroCyclingEnabled ? '#3b82f6' : 'var(--text-dim)' }}>
            🔄 Циклирование макросов
          </span>
        </div>
        {macroCyclingEnabled && (
          <div style={{ padding: '6px 10px', marginBottom: 8, borderRadius: 8, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)', fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <div>🏋️ <b>Тренировочный день:</b> +200 ккал, +50 г углеводов</div>
            <div>😴 <b>День отдыха:</b> −200 ккал, −50 г углеводов</div>
            <div>🥩 <b>Белок:</b> постоянный ({indivProt} г) все дни</div>
          </div>
        )}
        <button onClick={() => {
          generateIndividualPlan();
          setIndivPlanRest(null);
        }} style={{
          width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
          fontWeight: 700, fontSize: 13, marginBottom: 10,
        }}>✨ Сгенерировать план питания</button>

        {indivPlan && (
          <div>
            {/* Insulin warnings banner */}
            {indivPlan.insulinWarnings && indivPlan.insulinWarnings.length > 0 && (
              <div style={{
                padding: '8px 10px', marginBottom: 10, borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>⚠ Предупреждения инсулина/ИФР-1</div>
                {indivPlan.insulinWarnings.map((w: string, wi: number) => (
                  <div key={wi} style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, padding: '1px 0' }}>{w}</div>
                ))}
              </div>
            )}
            {/* Global glucose overview */}
            {indivPlan.glucoseEstimates && indivPlan.glucoseEstimates.length > 0 && indivInsulinShots.length > 0 && (
              <div style={{
                padding: '8px 10px', marginBottom: 10, borderRadius: 8,
                background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4', marginBottom: 4 }}>📈 Оценка влияния на глюкозу</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {indivPlan.glucoseEstimates.map((ge: any, gi: number) => {
                    const barColor = ge.risk === 'high' ? '#ef4444' : ge.risk === 'medium' ? '#f59e0b' : '#22c55e';
                    return (
                      <div key={gi} style={{
                        flex: '1 0 auto', minWidth: 60, textAlign: 'center',
                        padding: '4px 6px', borderRadius: 6, fontSize: 8,
                        background: barColor + '12', border: '1px solid ' + barColor + '30',
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-light)' }}>{ge.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: barColor }}>~{ge.glucoseImpact} мг/дл</div>
                        <div style={{ color: 'var(--text-dim)' }}>{ge.note}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              {/* Regenerate button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={() => { setRegenerateCount(regenerateCount + 1); generateIndividualPlan(); }} style={{
                  padding: '4px 12px', borderRadius: 16, fontSize: 9, cursor: 'pointer', fontWeight: 600,
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-dim)', transition: 'all 0.2s',
                }}>🔄 Перегенерировать день</button>
              </div>

              {indivPlan.meals.map((meal: any, mi: number) => {
                // Phase 5.12: Running total calculation
                const runningKcal = indivPlan.meals.slice(0, mi + 1).reduce((s: number, m: any) => s + m.totals.kcal, 0);
                const runningProt = indivPlan.meals.slice(0, mi + 1).reduce((s: number, m: any) => s + m.totals.protein, 0);
                const runningFat = indivPlan.meals.slice(0, mi + 1).reduce((s: number, m: any) => s + m.totals.fat, 0);
                const runningCarbs = indivPlan.meals.slice(0, mi + 1).reduce((s: number, m: any) => s + m.totals.carbs, 0);
                const isExpanded = expandedMeals.has(mi);
                const isBreakfast = meal.label?.toLowerCase().includes('завтрак');
                const isLunch = meal.label?.toLowerCase().includes('обед');
                const isDinner = meal.label?.toLowerCase().includes('ужин');
                let mealColor = 'var(--accent)';
                if (meal.isPreWorkout) mealColor = '#f97316';
                else if (meal.isPostWorkout) mealColor = '#a855f7';
                else if (isBreakfast) mealColor = '#f59e0b';
                else if (isLunch) mealColor = '#22c55e';
                else if (isDinner) mealColor = '#3b82f6';
                else if (meal.label?.toLowerCase().includes('перекус')) mealColor = '#06b6d4';

                return (
                  <div key={mi} style={{
                    marginBottom: 8, borderRadius: 12, overflow: 'hidden',
                    border: `1px solid ${mealColor}22`,
                    background: `${mealColor}08`,
                  }}>
                    <button
                      onClick={() => setExpandedMeals(prev => { const s = new Set(prev); s.has(mi) ? s.delete(mi) : s.add(mi); return s; })}
                      style={{
                        width: '100%', padding: '10px 12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'transparent', border: 'none', color: 'var(--text)', textAlign: 'left' as const,
                        fontSize: 11, fontWeight: 600,
                        borderLeft: `3px solid ${mealColor}`,
                      }}
                    >
                      <span style={{
                        width: 24, height: 24, borderRadius: 8,
                        background: mealColor + '20', color: mealColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: 11,
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}>›</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: mealColor, fontSize: 11 }}>{meal.time} {meal.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                          ⏱ {meal.prepTime || 15} мин · {meal.cookingMethod || 'готовка'} · {meal.storage || 'холодильник'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: mealColor }}>{meal.totals.kcal} ккал</div>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                          Б:{meal.totals.protein}г Ж:{meal.totals.fat}г У:{meal.totals.carbs}г
                        </div>
                        <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginTop: 1 }}>
                          Всего: {runningKcal} ккал · Б:{runningProt} Ж:{runningFat} У:{runningCarbs}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${mealColor}11` }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {meal.items.map((it: any, ii: number) => (
                            <span key={ii} style={{
                              padding: '3px 8px', borderRadius: 12, fontSize: 9,
                              background: `${mealColor}10`, color: 'var(--text-light)',
                              border: `1px solid ${mealColor}18`,
                            }}>
                              {it.foodName} {it.amount}г
                              <span style={{ color: 'var(--text-dim)', marginLeft: 4, fontSize: 8 }}>~{it.kcal}ккал</span>
                            </span>
                          ))}
                        </div>
                        {/* Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                          {meal.isPreWorkout && <span style={{ padding:'1px 6px', borderRadius:6, fontSize:8, background:'rgba(249,115,22,0.12)', color:'#f97316' }}>🏋️ предтрен</span>}
                          {meal.isPostWorkout && <span style={{ padding:'1px 6px', borderRadius:6, fontSize:8, background:'rgba(168,85,247,0.12)', color:'#a855f7' }}>💪 пост-трен</span>}
                          {meal.isInsulinMeal && <span style={{ padding:'1px 6px', borderRadius:6, fontSize:8, background:'rgba(6,182,212,0.12)', color:'#06b6d4' }}>💉 инсулин</span>}
                          {meal.isGHNoCarb && <span style={{ padding:'1px 6px', borderRadius:6, fontSize:8, background:'rgba(168,85,247,0.12)', color:'#a855f7' }}>🧬 ГР</span>}
                          {meal.isIGFProtein && <span style={{ padding:'1px 6px', borderRadius:6, fontSize:8, background:'rgba(236,72,153,0.12)', color:'#ec4899' }}>🧪 ИФР-1</span>}
                          {meal.glucoseImpact !== undefined && indivInsulinShots.length > 0 && (
                            <span style={{
                              padding:'1px 6px', borderRadius:6, fontSize:8, fontWeight:600,
                              background: meal.glucoseRisk === 'high' ? 'rgba(239,68,68,0.12)' : meal.glucoseRisk === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                              color: meal.glucoseRisk === 'high' ? '#ef4444' : meal.glucoseRisk === 'medium' ? '#f59e0b' : '#22c55e',
                            }}>🩸~{meal.glucoseImpact} мг/дл</span>
                          )}
                        </div>
                        {/* Notes textarea */}
                        <textarea
                          placeholder="📝 Заметки к этому приёму..."
                          value={mealNotes[mi] || ''}
                          onChange={e => setMealNotes({ ...mealNotes, [mi]: e.target.value })}
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 8,
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            color: 'var(--text)', fontSize: 9, boxSizing: 'border-box' as const,
                            resize: 'vertical' as const, minHeight: 28,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{
              padding: 12, borderRadius: 10,
              background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)',
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>📊 Итого за день</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {(() => {
                  const kcalPct = indivKcal > 0 ? Math.round(indivPlan.dayTotals.kcal / indivKcal * 100) : 0;
                  const protPct = indivProt > 0 ? Math.round(indivPlan.dayTotals.protein / indivProt * 100) : 0;
                  const fatPct = indivFat > 0 ? Math.round(indivPlan.dayTotals.fat / indivFat * 100) : 0;
                  const carbsPct = indivCarbs > 0 ? Math.round(indivPlan.dayTotals.carbs / indivCarbs * 100) : 0;
                  const pctColor = (p: number) => p >= 90 && p <= 110 ? '#22c55e' : p > 110 ? '#ef4444' : '#f59e0b';
                  return (
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)', textAlign: 'center', lineHeight: 1.6 }}>
                      <div>Ккал: <span style={{color: pctColor(kcalPct)}}>{Math.round(indivPlan.dayTotals.kcal)} / {indivKcal}</span> <span style={{fontSize:9, color: pctColor(kcalPct)}}>({kcalPct}%)</span></div>
                      <div>Б: <span style={{color: pctColor(protPct)}}>{Math.round(indivPlan.dayTotals.protein)}/{indivProt}г</span> · Ж: <span style={{color: pctColor(fatPct)}}>{Math.round(indivPlan.dayTotals.fat)}/{indivFat}г</span> · У: <span style={{color: pctColor(carbsPct)}}>{Math.round(indivPlan.dayTotals.carbs)}/{indivCarbs}г</span></div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, textAlign: 'center', fontSize: 9 }}>
                {[
                  { l: 'Ккал', v: Math.round(indivPlan.dayTotals.kcal), t: indivKcal, c: '#00e68a' },
                  { l: 'Белок', v: Math.round(indivPlan.dayTotals.protein), t: indivProt, c: '#3b82f6' },
                  { l: 'Жиры', v: Math.round(indivPlan.dayTotals.fat), t: indivFat, c: '#f59e0b' },
                  { l: 'Углеводы', v: Math.round(indivPlan.dayTotals.carbs), t: indivCarbs, c: '#f97316' },
                ].map(m => {
                  const diff = m.v - m.t;
                  const diffPct = m.t > 0 ? Math.round((diff / m.t) * 100) : 0;
                  const deltaColor = Math.abs(diffPct) <= 10 ? '#22c55e' : diffPct > 0 ? '#ef4444' : '#f59e0b';
                  return (
                    <div key={m.l} style={{ background: m.c + '10', borderRadius: 8, padding: '4px 6px' }}>
                      <div style={{ fontSize: 8, fontWeight: 600, color: deltaColor }}>
                        {diff >= 0 ? '+' : ''}{diff} ({diffPct >= 0 ? '+' : ''}{diffPct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Macro cycling comparison */}
            {macroCyclingEnabled && (
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>🔄 Циклирование</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
                  <div style={{ padding: 6, borderRadius: 6, background: 'rgba(0,230,138,0.06)' }}>
                    <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 2 }}>🏋️ Тренировочный день</div>
                    <div style={{ color: 'var(--text-dim)' }}>
                      {Math.round(indivPlan.dayTotals.kcal)} ккал<br/>
                      Б: {Math.round(indivPlan.dayTotals.protein)}г · Ж: {Math.round(indivPlan.dayTotals.fat)}г · У: {Math.round(indivPlan.dayTotals.carbs)}г
                    </div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 6, background: 'rgba(139,92,246,0.06)' }}>
                    <div style={{ fontWeight: 700, color: '#8b5cf6', marginBottom: 2 }}>😴 День отдыха</div>
                    <div style={{ color: 'var(--text-dim)' }}>
                      {Math.round(indivPlan.dayTotals.kcal) - 200} ккал<br/>
                      Б: {Math.round(indivPlan.dayTotals.protein)}г · Ж: {Math.round(indivPlan.dayTotals.fat)}г · У: {Math.round(indivPlan.dayTotals.carbs) - 50}г
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>
                  Белок постоянный · Углеводы циклируются · Жиры стабильны
                </div>
              </div>
            )}
            {/* Shopping list button */}
            <button onClick={() => setShoppingListVisible(!shoppingListVisible)} style={{
              width: '100%', marginTop: 8, padding: 8, borderRadius: 8,
              border: '1px solid rgba(249,115,22,0.3)', cursor: 'pointer',
              background: shoppingListVisible ? 'rgba(249,115,22,0.08)' : 'var(--bg-secondary)',
              color: '#f97316', fontWeight: 600, fontSize: 11,
            }}>🛒 {shoppingListVisible ? 'Скрыть список покупок' : 'Список покупок на неделю'}</button>
            {shoppingListVisible && (() => {
              const allItems: { name: string; totalGrams: number; category: string }[] = [];
              const itemMap: Record<string, { totalGrams: number; category: string }> = {};
              indivPlan.meals.forEach((meal: any) => {
                meal.items.forEach((it: any) => {
                  const key = it.foodName;
                  if (itemMap[key]) {
                    itemMap[key].totalGrams += it.amount;
                  } else {
                    const food = FOOD_DB.find(f => f.name === key);
                    itemMap[key] = { totalGrams: it.amount, category: food?.category || 'protein' };
                  }
                });
              });
              Object.entries(itemMap).forEach(([name, data]) => {
                allItems.push({ name, totalGrams: Math.round(data.totalGrams * 7), category: data.category });
              });
              const catGroups: Record<string, { label: string; emoji: string; color: string; items: typeof allItems }> = {
                protein: { label: 'Белки', emoji: '🥩', color: '#3b82f6', items: [] },
                carb: { label: 'Углеводы', emoji: '🌾', color: '#f97316', items: [] },
                grain: { label: 'Углеводы', emoji: '🌾', color: '#f97316', items: [] },
                fat: { label: 'Жиры', emoji: '🥑', color: '#f59e0b', items: [] },
                veg_fruit: { label: 'Овощи/Фрукты', emoji: '🥬', color: '#22c55e', items: [] },
                dairy: { label: 'Молочное', emoji: '🥛', color: '#06b6d4', items: [] },
                supplement: { label: 'Добавки', emoji: '💊', color: '#a855f7', items: [] },
              };
              allItems.forEach(it => {
                const g = catGroups[it.category] || catGroups.protein;
                g.items.push(it);
              });
              return (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.12)', fontSize: 9 }}>
                  <div style={{ fontWeight: 700, color: '#f97316', marginBottom: 6 }}>🛒 Список покупок на неделю:</div>
                  {Object.values(catGroups).filter(g => g.items.length > 0).map(g => (
                    <div key={g.label} style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: g.color }}>{g.emoji} {g.label}: </span>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {g.items.map(it => it.totalGrams >= 1000
                          ? `${it.name} ${(it.totalGrams / 1000).toFixed(1)} кг`
                          : `${it.name} ${it.totalGrams} г`
                        ).join(', ')}
                      </span>
                    </div>
                  ))}
                  {macroCyclingEnabled && (
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>
                      * Для дней отдыха берите на ~15% меньше углеводов
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Phase 5.12: Water intake calculator */}
            {(() => {
              const weight = s?.weight || profile?.settings?.weight || 80;
              const baseWater = Math.round(weight * 30 / 1000 * 10) / 10; // 30 ml/kg → liters
              const trainingBonus = (s?.workoutsPerWeek || 0) > 0 ? 0.5 : 0; // +500ml per training day
              const avgFiber = 30;
              const fiberBonus = Math.round((avgFiber / 10) * 200 / 1000 * 10) / 10; // +200ml per 10g fiber
              const coffeeCups: number = 0;
              const coffeePenalty = coffeeCups * 0.2; // -200ml per coffee cup
              const totalWater = Math.max(1.5, baseWater + trainingBonus + fiberBonus - coffeePenalty);
              return (
                <div style={{
                  padding: 12, borderRadius: 10, marginTop: 8,
                  background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', marginBottom: 6 }}>💧 Водный баланс</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.8 }}>
                    <div>Вода: <b style={{color:'var(--text-light)'}}>30 мл × {weight} кг = {baseWater} л</b></div>
                    {trainingBonus > 0 && <div>+ {trainingBonus * 1000} мл за тренировку</div>}
                    {avgFiber > 0 && <div>+ {Math.round(avgFiber/10) * 200} мл на клетчатку (~{avgFiber}г)</div>}
                    {coffeePenalty > 0 && <div style={{color:'#f59e0b'}}>- {coffeePenalty * 1000} мл: кофеин ({coffeeCups} чаш{coffeeCups === 1 ? 'ка' : coffeeCups < 5 ? 'ки' : 'ек'} кофе)</div>}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 800, color: '#06b6d4',
                    marginTop: 6, padding: '6px 10px',
                    background: 'rgba(6,182,212,0.08)', borderRadius: 8,
                    textAlign: 'center',
                  }}>Итого: {Math.round(totalWater * 10) / 10} л/день</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: 'center' }}>
                    Калий: 4-5 г/день · Натрий: 3-5 г/день · Магний: 400-600 мг/день
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 8 }}>
        <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🍽️ Генератор плана питания</h4>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input type="number" value={planDays} onChange={e => setPlanDays(parseFloat(e.target.value) || 0)} style={{ width: 50, padding: '4px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }} />
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
      <div className="card"><h4 style={{ margin: '0 0 4px', fontSize: 12 }}>🍳 Рецепты ({recipes.length})</h4>{recipes.slice(0,8).map((r:any,i:number)=><div key={i} style={{marginBottom:4}}><b style={{fontSize:10}}>{r.name}</b><span style={{fontSize:9,color:'var(--text-dim)'}}> — {r.kcal}ккал Б:{r.protein} Ж:{r.fat} У:{r.carbs}</span></div>)}</div>
      </>)}
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
