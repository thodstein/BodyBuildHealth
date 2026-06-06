import React, { useState, useEffect, useMemo } from 'react';
import { calcNutrition, generateStructuredAdvice } from '../../engines/nutrition.engine';
import { getProfile } from '../../core/profile-manager';
import { FOOD_DB } from '../../core/nutrition-database';
import { useDataLink, derivePAL } from '../../core/data-link';
import { NutritionOverview } from './NutritionScreen_parts/NutritionOverview';
import { NutritionDiary } from './NutritionScreen_parts/NutritionDiary';
import { NutritionCharts } from './NutritionScreen_parts/NutritionCharts';

export const NutritionScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'overview' | 'diary' | 'charts'>('overview');
  const [foodEntries, setFoodEntries] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nutrition_diary');
      if (raw) {
        const diary = JSON.parse(raw);
        const entries = Object.values(diary).flatMap((d: any) =>
          (Object.values(d.meals) as any[][]).flat().map((m: any) => ({
            name: m.name,
            calories: m.kcal,
            protein: m.p,
            fat: m.f,
            carbs: m.c,
          }))
        );
        setFoodEntries(entries);
      }
    } catch {}
  }, []);

  const avgWeeklyKcal = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.calories, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const avgWeeklyProtein = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.protein, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const avgWeeklyFat = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.fat, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const avgWeeklyCarbs = useMemo(() => {
    return foodEntries.reduce((sum, e) => sum + e.carbs, 0) / Math.max(1, foodEntries.length / 7);
  }, [foodEntries]);

  const renderContent = () => {
    switch (tab) {
      case 'overview': return <NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} />;
      case 'diary': return <NutritionDiary foodEntries={foodEntries} />;
      case 'charts': return <NutritionCharts kcalData={[avgWeeklyKcal, avgWeeklyKcal * 1.1, avgWeeklyKcal * 0.9]} proteinData={[avgWeeklyProtein, avgWeeklyProtein * 1.1, avgWeeklyProtein * 0.9]} labels={['День 1', 'День 2', 'День 3']} />;
      default: return <NutritionOverview profile={linked.profile} avgWeeklyKcal={avgWeeklyKcal} avgWeeklyProtein={avgWeeklyProtein} avgWeeklyFat={avgWeeklyFat} avgWeeklyCarbs={avgWeeklyCarbs} />;
    }
  };

  return (
    <div className="screen nutrition">
      <div className="tab-bar">
        {(['overview', 'diary', 'charts'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Обзор' : t === 'diary' ? 'Дневник' : 'Графики'}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};
