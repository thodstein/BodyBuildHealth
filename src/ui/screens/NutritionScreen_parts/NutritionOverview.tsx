import React from 'react';
import { derivePAL } from '../../../core/data-link';
import type { UserProfile } from '../../../core/types';

export const NutritionOverview: React.FC<{
  profile: UserProfile | null;
  avgWeeklyKcal: number;
  avgWeeklyProtein: number;
  avgWeeklyFat: number;
  avgWeeklyCarbs: number;
}> = ({ profile, avgWeeklyKcal, avgWeeklyProtein, avgWeeklyFat, avgWeeklyCarbs }) => {
  const pal = profile ? derivePAL(profile.settings.workoutsPerWeek, profile.settings.avgWorkoutMinutes) : 1.55;

  return (
    <div className="nutrition-overview">
      <div className="card">
        <h3>Обзор КБЖУ</h3>
        <div className="grid macro-grid">
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
            <div className="label">Калории</div>
            <div className="value">{Math.round(avgWeeklyKcal)} ккал</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
            <div className="label">Белки</div>
            <div className="value">{Math.round(avgWeeklyProtein)} г</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
            <div className="label">Жиры</div>
            <div className="value">{Math.round(avgWeeklyFat)} г</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
            <div className="label">Углеводы</div>
            <div className="value">{Math.round(avgWeeklyCarbs)} г</div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="label">PAL: {pal.toFixed(2)}</div>
          <div className="reference">Суточный коэффициент активности</div>
        </div>
      </div>
    </div>
  );
};
