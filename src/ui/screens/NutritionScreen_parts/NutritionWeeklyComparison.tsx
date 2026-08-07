import React, { useMemo } from 'react';
import { formatDate } from '../../../core/utils/date-utils';

interface Props {
  diaryData: Record<string, any>;
  selectedDate: string;
  targets?: { kcal: number; protein: number; fats: number; carbs: number };
}

const cardStyle: React.CSSProperties = { padding: 10, borderRadius: 14, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)' };

function getWeekRange(dateStr: string): string[] {
  const d = new Date(dateStr);
  const day = d.getDay();
  const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const result: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday); date.setDate(monday.getDate() + i);
    result.push(formatDate(date));
  }
  return result;
}

function getWeekTotals(diaryData: Record<string, any>, week: string[]) {
  let kcal = 0, p = 0, f = 0, c = 0, days = 0;
  week.forEach(date => {
    const day = diaryData[date];
    if (!day?.meals) return;
    let dayHas = false;
    Object.values(day.meals).forEach((items: any) => {
      (items || []).forEach((item: any) => {
        kcal += item.kcal || 0;
        p += item.p || 0;
        f += item.f || 0;
        c += item.c || 0;
        dayHas = true;
      });
    });
    if (dayHas) days++;
  });
  return { kcal: Math.round(kcal), p: Math.round(p), f: Math.round(f), c: Math.round(c), days };
}

function getDayAvg(diaryData: Record<string, any>, week: string[]) {
  const totals = getWeekTotals(diaryData, week);
  const d = totals.days || 1;
  return {
    kcal: Math.round(totals.kcal / d),
    p: Math.round(totals.p / d * 10) / 10,
    f: Math.round(totals.f / d * 10) / 10,
    c: Math.round(totals.c / d * 10) / 10,
    days: totals.days,
  };
}

export const NutritionWeeklyComparison: React.FC<Props> = ({ diaryData, selectedDate, targets }) => {
  const comparison = useMemo(() => {
    const currentWeek = getWeekRange(selectedDate);
    const prevStart = new Date(currentWeek[0]); prevStart.setDate(prevStart.getDate() - 7);
    const prevWeekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(prevStart); date.setDate(prevStart.getDate() + i);
      prevWeekDates.push(formatDate(date));
    }

    const curAvg = getDayAvg(diaryData, currentWeek);
    const prevAvg = getDayAvg(diaryData, prevWeekDates);

    const tg = targets || { kcal: 2500, protein: 160, fats: 70, carbs: 300 };

    return { current: curAvg, previous: prevAvg, currentWeek, prevWeekDates, targets: tg };
  }, [diaryData, selectedDate, targets]);

  const { current, previous, targets: tg } = comparison;

  if (current.days === 0 && previous.days === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>📊 Сравнение недель</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Недостаточно данных — заполняйте дневник</div>
      </div>
    );
  }

  const metrics: { label: string; key: string; unit: string; color: string; target: number }[] = [
    { label: 'Ккал/день', key: 'kcal', unit: '', color: '#22c55e', target: tg.kcal },
    { label: 'Белок', key: 'p', unit: 'г', color: '#3b82f6', target: tg.protein },
    { label: 'Жиры', key: 'f', unit: 'г', color: '#f59e0b', target: tg.fats },
    { label: 'Углеводы', key: 'c', unit: 'г', color: '#f97316', target: tg.carbs },
  ];

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📊 Сравнение: эта неделя vs прошлая</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        {metrics.map(m => {
          const curVal = (current as any)[m.key] || 0;
          const prevVal = (previous as any)[m.key] || 0;
          const delta = prevVal > 0 ? Math.round((curVal - prevVal) / prevVal * 100) : 0;

          return (
            <div key={m.key} style={{ padding: 6, borderRadius: 8, background: 'rgba(32,32,35,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: m.color }}>
                  {curVal}{m.unit}
                </span>
                {prevVal > 0 && (
                  <span style={{
                    fontSize: 8, fontWeight: 600,
                    color: delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : 'rgba(255,255,255,0.5)',
                  }}>
                    {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}{Math.abs(delta)}%
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 1.5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, curVal / Math.max(m.target, 1) * 100)}%`, borderRadius: 1.5, background: m.color, minWidth: 1, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)', minWidth: 16, textAlign: 'right' }}>
                  {Math.round(curVal / Math.max(m.target, 1) * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.5)', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span>Эта нед: {current.days}/7 дн ({currentWeekLabel(comparison.currentWeek[0])})</span>
        <span>Прошлая: {previous.days}/7 дн ({currentWeekLabel(comparison.prevWeekDates[0])})</span>
      </div>

      {current.days < 3 && (
        <div style={{ fontSize: 7, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.08)' }}>
          ⚠️ Мало данных за текущую неделю ({current.days}/7 дней). Продолжайте заполнять дневник.
        </div>
      )}
    </div>
  );
};

function currentWeekLabel(startDate: string): string {
  const d = new Date(startDate);
  const end = new Date(d); end.setDate(end.getDate() + 6);
  const format = (dt: Date) => `${dt.getDate()}.${dt.getMonth() + 1}`;
  return `${format(d)}-${format(end)}`;
}
