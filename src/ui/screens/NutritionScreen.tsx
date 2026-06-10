import React, { useState, useEffect, useMemo } from 'react';
import { calcNutrition, generateStructuredAdvice } from '../../engines/nutrition.engine';
import { getProfile } from '../../core/profile-manager';
import { FOOD_DB } from '../../core/nutrition-database';
import { MICRONUTRIENT_TARGETS } from '../../core/constants';
import { useDataLink, derivePAL } from '../../core/data-link';
import type { FoodItem } from '../../core/types';
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
  const [tab, setTab] = useState<'overview' | 'diary' | 'charts'>('overview');
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
      default: return <NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} microsIntake={microsIntake} />;
    }
  };

  return (
    <div className="screen nutrition">
      <div className="tab-bar">
        {(['overview', 'diary', 'charts'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📊 Обзор' : t === 'diary' ? '📝 Дневник' : '📈 Графики'}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};
