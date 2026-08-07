import React from 'react';
import { calcMealQuality, getQualityLabel } from '../../../../engines/nutrition-quality.engine';

interface QualityInsightsProps {
  mealQuality: any;
  selectedDate: string;
  dayMeals: Record<string, any[]>;
  foodPatterns: Record<string, string[]>;
  foodTriggers: Record<string, string[]>;
  onSavePattern: (date: string, patterns: string[]) => void;
  onSaveTrigger: (date: string, triggers: string[]) => void;
  mealMood: Record<string, { satiety: number; enjoyment: number; note: string }>;
  onSaveMealMood: (date: string, mood: { satiety: number; enjoyment: number; note: string }) => void;
}

export const QualityInsights: React.FC<QualityInsightsProps> = ({
  mealQuality, selectedDate, dayMeals, foodPatterns, foodTriggers,
  onSavePattern, onSaveTrigger, mealMood, onSaveMealMood,
}) => {
  const hasData = Object.keys(dayMeals).length > 0;
  if (!hasData) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Quality score */}
      {mealQuality && (() => {
        const q = mealQuality;
        const ql = getQualityLabel(q.total);
        return (
          <div style={{ padding: '10px 14px', borderRadius: 14, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{ql.emoji} Качество рациона</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: ql.color }}>{q.total}/100</span>
            </div>
            <div style={{ fontSize: 10, color: ql.color, marginTop: 2, fontWeight: 500 }}>{ql.label}</div>
            {q.microDeficiencies?.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {q.microDeficiencies.slice(0, 5).map((d: any, i: number) => (
                  <span key={i} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    {d.nutrient}: {d.current}/{d.target} {d.unit}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Meal mood */}
      <div style={{ padding: '10px 14px', borderRadius: 14, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>😋 Оценка питания</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Сытость</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3, 4, 5].map(s => {
                const active = s <= (mealMood[selectedDate]?.satiety || 0);
                return (
                  <button key={s} onClick={() => onSaveMealMood(selectedDate, { ...(mealMood[selectedDate] || { satiety: 0, enjoyment: 0, note: '' }), satiety: s === mealMood[selectedDate]?.satiety ? 0 : s })}
                    aria-label={`Сытость ${s}`}
                    style={{ fontSize: 18, cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                      opacity: active ? 1 : 0.25, filter: active ? 'none' : 'grayscale(1)', transition: 'all 0.15s', minHeight: 32, minWidth: 32 }}>
                    🟢
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Удовольствие</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3, 4, 5].map(s => {
                const active = s <= (mealMood[selectedDate]?.enjoyment || 0);
                return (
                  <button key={s} onClick={() => onSaveMealMood(selectedDate, { ...(mealMood[selectedDate] || { satiety: 0, enjoyment: 0, note: '' }), enjoyment: s === mealMood[selectedDate]?.enjoyment ? 0 : s })}
                    aria-label={`Удовольствие ${s}`}
                    style={{ fontSize: 18, cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                      opacity: active ? 1 : 0.25, filter: active ? 'none' : 'grayscale(1)', transition: 'all 0.15s', minHeight: 32, minWidth: 32 }}>
                    ⭐
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <input value={mealMood[selectedDate]?.note || ''} onChange={e => onSaveMealMood(selectedDate, { ...(mealMood[selectedDate] || { satiety: 0, enjoyment: 0, note: '' }), note: e.target.value })}
          placeholder="Заметка о питании..." aria-label="Заметка"
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: '#202023',
            border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, boxSizing: 'border-box', minHeight: 36 }} />
      </div>

      {/* Patterns & triggers */}
      <div style={{ padding: '10px 14px', borderRadius: 14, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>📊 Паттерны</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {[
            { key: 'evening_over', label: '🌙 Переедание вечером' },
            { key: 'morning_under', label: '🌅 Недоедание утром' },
            { key: 'binge_day', label: '🔥 Срывной день' },
          ].map(p => {
            const active = (foodPatterns[selectedDate] || []).includes(p.key);
            return (
              <button key={p.key} onClick={() => {
                const cur = foodPatterns[selectedDate] || [];
                onSavePattern(selectedDate, active ? cur.filter(x => x !== p.key) : [...cur, p.key]);
              }} aria-label={p.label}
                style={{ padding: '5px 10px', borderRadius: 16, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${active ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
                  color: active ? '#a78bfa' : 'rgba(255,255,255,0.6)', minHeight: 28 }}>
                {p.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>⚠️ Триггеры</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { key: 'stress', label: '😰 Стресс' },
            { key: 'alcohol', label: '🍷 Алкоголь' },
            { key: 'sleep_dep', label: '😴 Недосып' },
            { key: 'social', label: '🎉 Событие' },
          ].map(t => {
            const active = (foodTriggers[selectedDate] || []).includes(t.key);
            return (
              <button key={t.key} onClick={() => {
                const cur = foodTriggers[selectedDate] || [];
                onSaveTrigger(selectedDate, active ? cur.filter(x => x !== t.key) : [...cur, t.key]);
              }} aria-label={t.label}
                style={{ padding: '5px 10px', borderRadius: 16, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: active ? '#f59e0b' : 'rgba(255,255,255,0.6)', minHeight: 28 }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
