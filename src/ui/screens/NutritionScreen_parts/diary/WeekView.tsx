import React, { useMemo } from 'react';
import { formatDate } from '../../../../core/utils/date-utils';

interface WeekViewProps {
  diaryData: Record<string, any>;
  targets: { kcal: number; protein: number; fats: number; carbs: number };
  selectedDate: string;
}

export const WeekView: React.FC<WeekViewProps> = ({ diaryData, targets, selectedDate }) => {
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d;
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return formatDate(d);
    });
  }, [weekStart]);

  const daysData = useMemo(() => {
    return weekDays.map(date => {
      const day = diaryData[date];
      if (!day?.meals) return { date, kcal: 0, p: 0, f: 0, c: 0, meals: 0, items: 0 };
      
      const items = Object.values(day.meals).filter(Array.isArray).flat();
      const kcal = items.reduce((s: number, i: any) => s + (i.kcal || 0), 0);
      const p = items.reduce((s: number, i: any) => s + (i.p || 0), 0);
      const f = items.reduce((s: number, i: any) => s + (i.f || 0), 0);
      const c = items.reduce((s: number, i: any) => s + (i.c || 0), 0);
      
      return { date, kcal, p, f, c, meals: Object.keys(day.meals).length, items: items.length };
    });
  }, [diaryData, weekDays]);

  const weeklyTotals = useMemo(() => {
    return daysData.reduce((acc, d) => ({
      kcal: acc.kcal + d.kcal,
      p: acc.p + d.p,
      f: acc.f + d.f,
      c: acc.c + d.c,
      meals: acc.meals + d.meals,
      days: acc.days + (d.meals > 0 ? 1 : 0),
    }), { kcal: 0, p: 0, f: 0, c: 0, meals: 0, days: 0 });
  }, [daysData]);

  const avgKcal = weeklyTotals.days > 0 ? Math.round(weeklyTotals.kcal / weeklyTotals.days) : 0;
  const avgP = weeklyTotals.days > 0 ? Math.round(weeklyTotals.p / weeklyTotals.days * 10) / 10 : 0;
  const avgF = weeklyTotals.days > 0 ? Math.round(weeklyTotals.f / weeklyTotals.days * 10) / 10 : 0;
  const avgC = weeklyTotals.days > 0 ? Math.round(weeklyTotals.c / weeklyTotals.days * 10) / 10 : 0;

  const today = formatDate(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Weekly summary */}
      <div style={{ padding: 14, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 10 }}>📊 Итоги недели</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { l: 'Ккал/день', v: avgKcal, t: targets.kcal, c: '#00e68a' },
            { l: 'Белки/день', v: avgP, t: targets.protein, c: '#3b82f6', u: 'г' },
            { l: 'Жиры/день', v: avgF, t: targets.fats, c: '#f59e0b', u: 'г' },
            { l: 'Угл./день', v: avgC, t: targets.carbs, c: '#f97316', u: 'г' },
          ].map(m => {
            const pct = m.t > 0 ? Math.min(100, Math.round((m.v || 0) / m.t * 100)) : 0;
            return (
              <div key={m.l} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: m.c, lineHeight: 1 }}>
                  {m.v}{m.u || ''}
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{m.l}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{pct}% от цели</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>📅 {weeklyTotals.days}/7 дней с записями</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>🍽 {weeklyTotals.meals} приёмов</span>
          <span style={{ fontSize: 9, color: '#00e68a', fontWeight: 600 }}>∑ {Math.round(weeklyTotals.kcal)} ккал</span>
        </div>
      </div>

      {/* Day-by-day breakdown */}
      <div style={{ padding: 14, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 10 }}>📅 По дням</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {daysData.map(d => {
            const isToday = d.date === today;
            const pct = targets.kcal > 0 ? Math.min(100, Math.round(d.kcal / targets.kcal * 100)) : 0;
            const isOver = pct > 100;
            
            return (
              <div key={d.date} style={{ 
                padding: '10px 12px', borderRadius: 12, 
                background: isToday ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isToday ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#00e68a' : '#fff' }}>
                      {new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {isToday && <span style={{ fontSize: 8, color: '#00e68a', background: 'rgba(0,230,138,0.1)', padding: '2px 6px', borderRadius: 4 }}>Сегодня</span>}
                    {d.meals === 0 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Нет данных</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: isOver ? '#ef4444' : 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                      {d.kcal > 0 ? `${Math.round(d.kcal)} ккал` : '—'}
                    </span>
                    {d.kcal > 0 && (
                      <span style={{ fontSize: 9, color: isOver ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
                {d.kcal > 0 && (
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 2, 
                      background: isOver ? '#ef4444' : '#00e68a', transition: 'width 0.4s' }} />
                  </div>
                )}
                {d.items > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                    <span>Б {Math.round(d.p)}г</span>
                    <span>Ж {Math.round(d.f)}г</span>
                    <span>У {Math.round(d.c)}г</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{d.meals} приёмов</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
