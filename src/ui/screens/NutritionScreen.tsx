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
type NutritionSection = 'overview' | 'diary' | 'planning' | 'tools' | 'all';
type ActiveTab = 'overview' | 'diary' | 'charts' | 'mealplan' | 'grocery' | 'restaurant' | 'cycling' | 'calc' | 'custom';

const SECTION_TABS: Record<NutritionSection, string[]> = {
  overview: ['overview', 'grocery', 'restaurant', 'custom'],
  diary: ['diary', 'charts'],
  planning: ['mealplan', 'cycling'],
  tools: ['calc'],
  all: ['overview', 'diary', 'charts', 'mealplan', 'grocery', 'restaurant', 'calc', 'cycling', 'custom'],
};

const TAB_LABELS: Record<string, string> = {
  overview: '📊 Обзор', diary: '📝 Дневник', charts: '📈 Графики',
  mealplan: '🥗 План', grocery: '🛒 Список', restaurant: '🍽 Ресторан',
  calc: '📐 Калькуляторы', cycling: '🔄 Циклирование',
  custom: '🍎 Своё',
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
      case 'mealplan': return <MealPlanExtended tKcal={tKcal} tProt={tProt} tFat={tFat} tCarbs={tCarbs} profile={linked.profile} />;
      case 'grocery': return <GroceryTab tKcal={tKcal} tProt={tProt} />;
      case 'restaurant': return <RestaurantTab />;
      case 'calc': return <NutritionCalculators />;
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
                { section: 'overview' as NutritionSection, tab: 'overview', icon: '📊', title: 'Обзор и списки', desc: 'Сводка, список покупок, рестораны', color: 'var(--accent)' },
                { section: 'tools' as NutritionSection, tab: 'calc', icon: '📐', title: 'Калькуляторы', desc: 'КБЖУ, дефицит, HOMA-IR', color: '#a855f7' },
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
            {nutritionSection === 'diary' ? 'Дневник' : nutritionSection === 'planning' ? 'Планирование' : nutritionSection === 'overview' ? 'Обзор' : nutritionSection === 'tools' ? 'Инструменты' : 'Всё'}
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

const MealPlanExtended: React.FC<{ tKcal: number; tProt: number; tFat: number; tCarbs: number; profile: UserProfile | null }> = ({ tKcal, tProt, tFat, tCarbs, profile }) => {
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
    { title: 'Читмил', body: 'Один приём пищи в неделю без ограничений. Правила:\n- Не на голодный желудок (съешьте белок за 30 мин до)\n- Лучше после тренировки (чувствительность к инсулину выше)\n- Не перед сном (нарушит сон и пищеварение)\n- Не более 1500 ккал за один читмил\n- Пейте воду до и после', color: '#f59e0b' },
    { title: 'Углеводная загрузка', body: 'За 2-3 дня до соревнований/фотосессии:\n- День 1-2: истощение гликогена (низкоуглеводно + тренировка)\n- День 3: загрузка 8-10 г/кг углеводов, минимум жиров\n- Вода: много в дни истощения, ограничить в день загрузки\n- Натрий: увеличить в день загрузки для удержания воды в мышцах', color: '#f97316' },
    { title: 'Белково-углеводное чередование (БУЧ)', body: 'Высокоуглеводные дни: тренировочные дни, +30% к базовым углеводам\nНизкоуглеводные дни: дни отдыха, -50% к базовым углеводам\nБелок: постоянно высокий (2-2.5 г/кг) все дни\nЖиры: выше в низкоуглеводные дни, ниже в высокоуглеводные\nЦикл: 3 тренировочных (высоко) + 1 отдых (низко) или 2+1', color: '#3b82f6' },
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
  const [indivInsulinShots, setIndivInsulinShots] = React.useState<{ time: string; dose: number; type: string }[]>([]);
  const [indivGHShots, setIndivGHShots] = React.useState<{ time: string; dose: number }[]>([]);
  const [indivIGFShots, setIndivIGFShots] = React.useState<{ time: string; dose: number }[]>([]);
  const [newInsulinTime, setNewInsulinTime] = React.useState('12:00');
  const [newInsulinDose, setNewInsulinDose] = React.useState(5);
  const [newInsulinType, setNewInsulinType] = React.useState('короткий');
  const [newGHTime, setNewGHTime] = React.useState('08:00');
  const [newGHDose, setNewGHDose] = React.useState(4);
  const [newIGFTime, setNewIGFTime] = React.useState('10:00');
  const [newIGFDose, setNewIGFDose] = React.useState(50);

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
    let carbFoods = FOOD_DB.filter(f => [...RECOMMENDED_IDS.carb, ...RECOMMENDED_IDS.grain].includes(f.id) && (f.category === 'carb' || f.category === 'grain'));
    if (indivGlutenFree) carbFoods = carbFoods.filter(f => !['pasta_durum', 'bread_rye', 'tortilla_wheat'].includes(f.id));
    const fatFoods = FOOD_DB.filter(f => RECOMMENDED_IDS.fat.includes(f.id) && f.category === 'fat');
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

    const labels = indivMeals === 3 ? ['Завтрак', 'Обед', 'Ужин']
      : indivMeals === 4 ? ['Завтрак', 'Перекус', 'Обед', 'Ужин']
      : indivMeals === 5 ? ['Завтрак', 'Перекус 1', 'Обед', 'Предтрен', 'Ужин']
      : ['Завтрак', 'Перекус 1', 'Обед', 'Предтрен', 'Пост-трен', 'Ужин'];

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
      // GH: avoid carbs 30min before/after each GH injection
      const isGHWindow = ghShots.some(s => Math.abs(h - s.hour) <= 1);
      // IGF: protein-rich meal within 1hr of each injection
      const isIGFWindow = igfShots.some(s => Math.abs(h - s.hour) <= 1);

      const targetP = Math.round(indivProt / indivMeals);
      const targetC = isGHWindow ? 0 : (isInsulinShortMeal ? Math.round(indivCarbs * 0.4) : isInsulinLongMeal ? Math.round(indivCarbs * 0.2) : isPreWorkout || isPostWorkout ? Math.round(indivCarbs * 0.25) : isEvening ? Math.round(indivCarbs * 0.1) : Math.round(indivCarbs * 0.15));
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
        note = '⚠ Риск гипогликемии: мало углеводов при коротком инсулине';
        insulinWarnings.push(`Приём ${meal.label} (${meal.time}): мало углеводов (${mealCarbs}г) для короткого инсулина — риск гипогликемии!`);
      } else if (hasShortInsulin && mealCarbs >= 40) {
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

  return (
    <div>
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
        <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--accent)' }}>📊 Качество продуктов</h4>
        <p style={{ fontSize: 9, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          Оценка источников белка, углеводов и жиров по шкале 1–10
        </p>
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
          ].map((p, j) => {
            const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
            return (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: j < 10 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
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
          ].map((p, j) => {
            const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
            return (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: j < 9 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
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
          ].map((p, j) => {
            const scoreColor = p.score >= 9 ? '#22c55e' : p.score >= 7 ? '#f59e0b' : p.score >= 5 ? '#f97316' : '#ef4444';
            return (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: j < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ minWidth: 32, height: 22, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor + '15', color: scoreColor, fontWeight: 800, fontSize: 11 }}>{p.score}/10</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 6 }}>— {p.desc}</span>
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

      <div className="card" style={{ marginBottom: 8, padding: 14 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--accent)' }}>🎯 Индивидуальный план</h4>
        <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          План питания на основе ваших параметров, времени тренировки и ограничений
        </p>
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
        <button onClick={generateIndividualPlan} style={{
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
            <div style={{
              position: 'relative', paddingLeft: 16, borderLeft: '2px solid var(--accent)', marginBottom: 10,
            }}>
              {indivPlan.meals.map((meal: any, mi: number) => (
                <div key={mi} style={{
                  position: 'relative', marginBottom: 10, paddingLeft: 16,
                }}>
                  <div style={{
                    position: 'absolute', left: -22, top: 8, width: 10, height: 10,
                    borderRadius: '50%', background: meal.isPreWorkout ? '#8b5cf6' : meal.isPostWorkout ? '#3b82f6' : 'var(--accent)',
                    border: '2px solid var(--bg-primary)',
                  }} />
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 1 }}>{meal.time}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, marginBottom: 3,
                    color: meal.isPreWorkout ? '#8b5cf6' : meal.isPostWorkout ? '#3b82f6' : 'var(--text)',
                  }}>
                    {meal.label}
                    {meal.isPreWorkout && <span style={{ fontSize: 8, color: '#8b5cf6', marginLeft: 6 }}>🏋️ предтрен</span>}
                    {meal.isPostWorkout && <span style={{ fontSize: 8, color: '#3b82f6', marginLeft: 6 }}>💪 пост-трен</span>}
                    {meal.isInsulinMeal && <span style={{ fontSize: 8, color: '#06b6d4', marginLeft: 6 }}>💉 инсулин</span>}
                    {meal.isGHNoCarb && <span style={{ fontSize: 8, color: '#a855f7', marginLeft: 6 }}>🧬 ГР (без угл)</span>}
                    {meal.isIGFProtein && <span style={{ fontSize: 8, color: '#ec4899', marginLeft: 6 }}>🧪 ИФР-1/MGF</span>}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 1 }}>
                    Б:{meal.totals.protein}г Ж:{meal.totals.fat}г У:{meal.totals.carbs}г | {meal.totals.kcal} ккал
                    {meal.glucoseImpact !== undefined && indivInsulinShots.length > 0 && (
                      <span style={{
                        marginLeft: 6, fontSize: 8, fontWeight: 600,
                        color: meal.glucoseRisk === 'high' ? '#ef4444' : meal.glucoseRisk === 'medium' ? '#f59e0b' : '#22c55e',
                      }}>
                        🩸~{meal.glucoseImpact} мг/дл
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {meal.items.map((it: any, ii: number) => (
                      <span key={ii} style={{
                        padding: '2px 7px', borderRadius: 10, fontSize: 8,
                        background: 'var(--bg-secondary)', color: 'var(--text-light)',
                        border: '1px solid var(--border)',
                      }}>
                        {it.foodName} {it.amount}г
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              padding: 12, borderRadius: 10,
              background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)',
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>📊 Итого за день</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, textAlign: 'center', fontSize: 10 }}>
                {[
                  { l: 'Ккал', v: indivPlan.dayTotals.kcal, t: indivKcal, c: '#00e68a' },
                  { l: 'Белок', v: indivPlan.dayTotals.protein, t: indivProt, c: '#3b82f6' },
                  { l: 'Жиры', v: indivPlan.dayTotals.fat, t: indivFat, c: '#f59e0b' },
                  { l: 'Углеводы', v: indivPlan.dayTotals.carbs, t: indivCarbs, c: '#f97316' },
                ].map(m => {
                  const diff = m.v - m.t;
                  const diffPct = m.t > 0 ? Math.round((diff / m.t) * 100) : 0;
                  const deltaColor = Math.abs(diffPct) <= 10 ? '#22c55e' : diffPct > 0 ? '#ef4444' : '#f59e0b';
                  return (
                    <div key={m.l} style={{ background: m.c + '10', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{m.l}</div>
                      <div style={{ fontWeight: 700, color: m.c, fontSize: 14 }}>{m.v}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>цель: {m.t}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: deltaColor }}>
                        {diff >= 0 ? '+' : ''}{diff} ({diffPct >= 0 ? '+' : ''}{diffPct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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

const RESTAURANT_ITEMS: { name: string; kcal: number; p: number; f: number; c: number }[] = [
  { name: 'Шаурма куриная', kcal: 550, p: 25, f: 22, c: 58 },
  { name: 'Бургер классический', kcal: 480, p: 22, f: 24, c: 42 },
  { name: 'Пицца Маргарита (кусок)', kcal: 240, p: 9, f: 8, c: 32 },
  { name: 'Пицца Пепперони (кусок)', kcal: 298, p: 12, f: 12, c: 34 },
  { name: 'Суши лосось (8 шт)', kcal: 310, p: 16, f: 6, c: 48 },
  { name: 'Ролл Филадельфия', kcal: 290, p: 12, f: 10, c: 36 },
  { name: 'Ролл Калифорния', kcal: 260, p: 10, f: 8, c: 38 },
  { name: 'Паста Карбонара', kcal: 350, p: 14, f: 18, c: 32 },
  { name: 'Паста Болоньезе', kcal: 280, p: 16, f: 10, c: 32 },
  { name: 'Стейк рибай', kcal: 350, p: 30, f: 25, c: 0 },
  { name: 'Курица гриль (половина)', kcal: 400, p: 45, f: 22, c: 0 },
  { name: 'Шашлык свинина (200г)', kcal: 380, p: 32, f: 28, c: 2 },
  { name: 'Шашлык курица (200г)', kcal: 280, p: 38, f: 12, c: 2 },
  { name: 'Салат Цезарь с курицей', kcal: 320, p: 25, f: 18, c: 14 },
  { name: 'Салат Греческий', kcal: 180, p: 6, f: 14, c: 8 },
  { name: 'Борщ', kcal: 170, p: 7, f: 5, c: 25 },
  { name: 'Окрошка', kcal: 200, p: 10, f: 8, c: 22 },
  { name: 'Круассан', kcal: 230, p: 5, f: 14, c: 22 },
  { name: 'Блинчики с творогом (2 шт)', kcal: 280, p: 14, f: 10, c: 32 },
  { name: 'Хот-дог', kcal: 300, p: 10, f: 18, c: 24 },
];

const RestaurantTab: React.FC = () => {
  const guide = React.useMemo(() => getRestaurantGuide(), []);
  const top = React.useMemo(() => getTopAthleteChoices(), []);
  const travels = React.useMemo(() => getTravelWorkouts(), []);
  const sleepStacks = React.useMemo(() => getSleepStacks(), []);
  const [selectedItem, setSelectedItem] = React.useState<number | null>(null);
  const maxKcal = Math.max(...RESTAURANT_ITEMS.map(i => i.kcal), 1);
  return (<div>
    <div className="card" style={{ marginBottom: 8 }}>
      <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🍽 Блюда и калорийность</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {RESTAURANT_ITEMS.map((item, i) => {
          const isExpanded = selectedItem === i;
          const pWidth = Math.round((item.p / Math.max(item.p + item.f + item.c, 1)) * 100);
          const fWidth = Math.round((item.f / Math.max(item.p + item.f + item.c, 1)) * 100);
          const cWidth = Math.round((item.c / Math.max(item.p + item.f + item.c, 1)) * 100);
          return (
            <div key={i} onClick={() => setSelectedItem(isExpanded ? null : i)} style={{
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
                <span>Б: <b style={{ color: '#3b82f6' }}>{item.p}г</b></span>
                <span>Ж: <b style={{ color: '#f59e0b' }}>{item.f}г</b></span>
                <span>У: <b style={{ color: '#f97316' }}>{item.c}г</b></span>
              </div>
              {isExpanded && (
                <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  <div>Полный состав на порцию: {item.kcal} ккал</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                    <span>🔵 Белки: {item.p}г ({item.p * 4} ккал)</span>
                    <span>🟡 Жиры: {item.f}г ({item.f * 9} ккал)</span>
                    <span>🟠 Углеводы: {item.c}г ({item.c * 4} ккал)</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
