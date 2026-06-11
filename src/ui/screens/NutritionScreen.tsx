import React, { useState, useEffect, useMemo } from 'react';
import { calcNutrition, generateStructuredAdvice } from '../../engines/nutrition.engine';
import { getProfile } from '../../core/profile-manager';
import { FOOD_DB } from '../../core/nutrition-database';
import { MICRONUTRIENT_TARGETS } from '../../core/constants';
import { useDataLink, derivePAL } from '../../core/data-link';
import type { FoodItem, UserProfile } from '../../core/types';
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

export const NutritionScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'overview' | 'diary' | 'charts' | 'mealplan'>('overview');
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
    switch (tab) {
      case 'overview': return <NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} microsIntake={microsIntake} />;
      case 'diary': return <NutritionDiary foodEntries={foodEntries} />;
      case 'charts': return <NutritionCharts kcalData={[avgWeeklyKcal]} proteinData={[avgWeeklyProtein]} labels={['Текущая']} dailyLogs={dailyLogs} />;
      case 'mealplan': return <MealPlan profile={linked.profile} />;
      default: return <NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} microsIntake={microsIntake} />;
    }
  };

  return (
    <div className="screen nutrition">
      <div className="tab-bar">
        {(['overview', 'diary', 'charts', 'mealplan'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📊 Обзор' : t === 'diary' ? '📝 Дневник' : t === 'charts' ? '📈 Графики' : '🍽️ План питания'}
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
      { name: 'Завтрак (7:00-9:00)', items: [proteinFoods[0], carbFoods[0], vegFoods[0]].filter(Boolean) },
      { name: 'Обед (12:00-14:00)', items: [proteinFoods[1], carbFoods[1] || carbFoods[0], vegFoods[1] || vegFoods[0]].filter(Boolean) },
      { name: 'До тренировки (за 1-2ч)', items: [carbFoods[2] || carbFoods[0]].filter(Boolean) },
      { name: 'После тренировки', items: [proteinFoods[2] || proteinFoods[0], carbFoods[3] || carbFoods[1] || carbFoods[0]].filter(Boolean) },
      { name: 'Ужин (18:00-20:00)', items: [proteinFoods[3] || proteinFoods[1], fatFoods[0], vegFoods[2] || vegFoods[1] || vegFoods[0]].filter(Boolean) },
      { name: 'Перед сном (21:00-22:00)', items: [proteinFoods.find(f => f.id === 'egg_white' || f.id === 'casein') || proteinFoods[4] || proteinFoods[0]].filter(Boolean) },
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
            { l: 'Калории', v: totalKcal, t: targets?.kcal || 2500, u: 'ккал' },
            { l: 'Белки', v: totalP, t: targets?.protein || 160, u: 'г' },
            { l: 'Жиры', v: totalF, t: targets?.fats || 70, u: 'г' },
            { l: 'Углеводы', v: totalC, t: targets?.carbs || 250, u: 'г' },
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
