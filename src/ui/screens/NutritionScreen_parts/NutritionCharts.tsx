import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler, BarElement,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, BarElement);

type ChartRange = 7 | 14 | 30;

interface DailyLog { date: string; kcal: number; protein: number; fat: number; carbs: number; }

const cardBg = { background: '#18181b', borderRadius: 18, padding: 16, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 20px rgba(0,0,0,0.3)' };
const label = (s: string, c: string) => <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{s}: <strong style={{ color: c }}>{c}</strong></span>;

const commonChartOptions = (hasWeight: boolean) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, fontSize: 9, color: '#fff' } },
    tooltip: { backgroundColor: '#202023', titleColor: '#fff', bodyColor: '#fff', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  },
  scales: {
    y: { beginAtZero: false, position: 'left' as const, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 9 } } },
    ...(hasWeight ? { y1: { beginAtZero: false, position: 'right' as const, grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 9 } } } } : {}),
    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { maxTicksLimit: 7, color: 'rgba(255,255,255,0.8)', font: { size: 9 } } },
  },
});

export const NutritionCharts: React.FC<{
  kcalData: number[]; proteinData: number[]; labels: string[];
  dailyLogs?: Record<string, { kcal: number; p: number; f: number; c: number }[]>;
}> = ({ kcalData, proteinData, dailyLogs }) => {
  const [range, setRange] = useState<ChartRange>(7);
  const [chartMode, setChartMode] = useState<'kcal' | 'macro' | 'both'>('both');

  const weightLog = useMemo(() => { try { return JSON.parse(localStorage.getItem('he_weight_log') || '[]') as { date: string; weight: number }[]; } catch { return []; } }, []);

  const realDailyData = useMemo<DailyLog[]>(() => {
    const days = range; const today = new Date(); const result: DailyLog[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      let dayKcal = 0, dayProtein = 0, dayFat = 0, dayCarbs = 0;
      if (dailyLogs && dailyLogs[dateStr]) {
        dailyLogs[dateStr].forEach(e => { dayKcal += e.kcal || 0; dayProtein += e.p || 0; dayFat += e.f || 0; dayCarbs += e.c || 0; });
      } else {
        try {
          const raw = localStorage.getItem('nutrition_diary');
          if (raw) { const diary = JSON.parse(raw); const dayData = diary[dateStr]; if (dayData?.meals) { Object.values(dayData.meals).flat().forEach((m: any) => { dayKcal += m.kcal || 0; dayProtein += m.p || 0; dayFat += m.f || 0; dayCarbs += m.c || 0; }); } }
        } catch {}
      }
      result.push({ date: dayLabel, kcal: Math.round(dayKcal), protein: Math.round(dayProtein), fat: Math.round(dayFat), carbs: Math.round(dayCarbs) });
    }
    return result;
  }, [range, dailyLogs]);

  const avgKcal = realDailyData.some(d => d.kcal > 0)
    ? Math.round(realDailyData.filter(d => d.kcal > 0).reduce((s, d) => s + d.kcal, 0) / Math.max(1, realDailyData.filter(d => d.kcal > 0).length))
    : (kcalData.length > 0 ? Math.round(kcalData.reduce((a, b) => a + b, 0) / kcalData.length) : 2500);
  const avgProtein = realDailyData.some(d => d.protein > 0)
    ? Math.round(realDailyData.filter(d => d.protein > 0).reduce((s, d) => s + d.protein, 0) / Math.max(1, realDailyData.filter(d => d.protein > 0).length))
    : (proteinData.length > 0 ? Math.round(proteinData.reduce((a, b) => a + b, 0) / proteinData.length) : 160);
  const avgFat = Math.round(avgKcal * 0.3 / 9);
  const avgCarbs = Math.round((avgKcal - avgProtein * 4 - avgFat * 9) / 4);

  const weightData = useMemo(() => {
    const today = new Date();
    return realDailyData.map((_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (range - 1 - i));
      const found = weightLog.find(w => w.date === d.toISOString().split('T')[0]);
      return found ? found.weight : null;
    });
  }, [range, realDailyData, weightLog]);

  const hasRealData = realDailyData.some(d => d.kcal > 0);
  const daysWithData = realDailyData.filter(d => d.kcal > 0).length;
  const hasWeightData = weightData.some(d => d !== null);

  const chartData = useMemo(() => {
    const labels = realDailyData.map(d => d.date);
    if (hasRealData) {
      return { labels, kcalLine: realDailyData.map(d => d.kcal || null), proteinLine: realDailyData.map(d => d.protein || null), fatLine: realDailyData.map(d => d.fat || null), carbsLine: realDailyData.map(d => d.carbs || null), avgKcal, avgProtein, avgFat, avgCarbs };
    }
    return {
      labels, avgKcal, avgProtein, avgFat, avgCarbs,
      kcalLine: Array.from({ length: range }, (_, i) => Math.round(avgKcal + Math.sin(i * 0.7) * 80 + Math.cos(i * 1.3) * 60)),
      proteinLine: Array.from({ length: range }, (_, i) => Math.round(avgProtein + Math.sin(i * 0.5) * 8 + Math.cos(i * 1.1) * 6)),
      fatLine: Array.from({ length: range }, (_, i) => Math.round(avgFat + Math.sin(i * 0.6) * 5 + Math.cos(i * 1.2) * 4)),
      carbsLine: Array.from({ length: range }, (_, i) => Math.round(avgCarbs + Math.sin(i * 0.8) * 15 + Math.cos(i * 1.4) * 10)),
    };
  }, [range, realDailyData, avgKcal, avgProtein, avgFat, avgCarbs]);

  const kcalPct = Math.round((avgProtein * 4) / Math.max(1, avgKcal) * 100);
  const fatPct = Math.round((avgFat * 9) / Math.max(1, avgKcal) * 100);
  const carbPct = Math.max(0, 100 - kcalPct - fatPct);

  const kcalChartData = {
    labels: chartData.labels,
    datasets: [
      { label: 'Ккал', data: chartData.kcalLine, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)', tension: 0.4, fill: true, yAxisID: 'y', pointRadius: 3, pointBackgroundColor: '#22c55e' },
      { label: 'Среднее', data: Array(range).fill(chartData.avgKcal), borderColor: 'rgba(34,197,94,0.3)', borderDash: [5, 5], pointRadius: 0, fill: false, yAxisID: 'y' },
      ...(hasWeightData ? [{ label: 'Вес (кг)', data: weightData, borderColor: '#f472b6', backgroundColor: 'rgba(244,114,182,0.08)', borderDash: [3, 3], pointRadius: 4, pointBackgroundColor: '#f472b6', fill: false, tension: 0.3, yAxisID: 'y1' }] : []),
    ],
  };

  const macroChartData = {
    labels: chartData.labels,
    datasets: [
      { label: 'Белки', data: chartData.proteinLine, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', tension: 0.4, fill: true, pointRadius: 2 },
      { label: 'Жиры', data: chartData.fatLine, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)', tension: 0.4, fill: true, pointRadius: 2 },
      { label: 'Углеводы', data: chartData.carbsLine, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.08)', tension: 0.4, fill: true, pointRadius: 2 },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!hasRealData && (
        <div style={{ ...cardBg, background: 'rgba(255,165,2,0.06)', border: '1px solid rgba(255,165,2,0.15)' }}>
          <div style={{ fontSize: 10, color: '#ffa502' }}>📊 Нет данных дневника. Показаны оценочные значения.</div>
        </div>
      )}
      {hasRealData && daysWithData < range && (
        <div style={{ ...cardBg, background: 'rgba(30,144,255,0.06)', border: '1px solid rgba(30,144,255,0.15)' }}>
          <div style={{ fontSize: 10, color: '#1e90ff' }}>📊 Данные за {daysWithData} из {range} дней.</div>
        </div>
      )}

      {/* Range + mode selector */}
      <div style={{ ...cardBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>📈 Графики</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([7, 14, 30] as ChartRange[]).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontWeight: 600,
                background: range === r ? 'rgba(0,230,138,0.15)' : '#202023',
                border: range === r ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                color: range === r ? '#00e68a' : '#fff',
                transition: 'all 0.15s',
              }}>{r}д</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {['both', 'kcal', 'macro'].map(m => (
            <button key={m} onClick={() => setChartMode(m as any)} style={{
              flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 8, cursor: 'pointer', fontWeight: 600,
              background: chartMode === m ? 'rgba(139,92,246,0.15)' : '#202023',
              border: chartMode === m ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: chartMode === m ? '#a78bfa' : '#fff',
            }}>{m === 'both' ? 'Все' : m === 'kcal' ? 'Ккал' : 'БЖУ'}</button>
          ))}
        </div>
        {(chartMode === 'both' || chartMode === 'kcal') && (
          <div style={{ height: 200, marginBottom: chartMode === 'both' ? 12 : 0 }}>
            <Line data={kcalChartData} options={commonChartOptions(hasWeightData)} />
          </div>
        )}
        {(chartMode === 'both' || chartMode === 'macro') && (
          <div style={{ height: 200 }}>
            <Line data={macroChartData} options={commonChartOptions(false)} />
          </div>
        )}
      </div>

      {/* Macro distribution */}
      <div style={{ ...cardBg }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: -0.3 }}>🍽 Распределение макронутриентов</div>
        <div style={{ height: 20, borderRadius: 10, overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
          <div style={{ flex: kcalPct, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', minWidth: 30 }}>Б {kcalPct}%</div>
          <div style={{ flex: fatPct, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', minWidth: 30 }}>Ж {fatPct}%</div>
          <div style={{ flex: carbPct, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', minWidth: 30 }}>У {carbPct}%</div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
          <span>💪 <strong style={{ color: '#3b82f6' }}>{avgProtein}г</strong> белка</span>
          <span>🧈 <strong style={{ color: '#f59e0b' }}>{avgFat}г</strong> жиров</span>
          <span>🌾 <strong style={{ color: '#f97316' }}>{avgCarbs}г</strong> углеводов</span>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ ...cardBg }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: -0.3 }}>📊 Средние за {range} дней</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'Ккал', val: chartData.avgKcal, unit: '', color: '#22c55e' },
            { label: 'Белки', val: chartData.avgProtein, unit: 'г', color: '#3b82f6' },
            { label: 'Жиры', val: chartData.avgFat, unit: 'г', color: '#f97316' },
            { label: 'Углеводы', val: chartData.avgCarbs, unit: 'г', color: '#a855f7' },
          ].map(s => (
            <div key={s.label} style={{ background: '#202023', padding: '8px 10px', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>{s.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Goal completion */}
      <div style={{ ...cardBg }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: -0.3 }}>🎯 Выполнение целей за {range} дней</div>
        {(() => {
          const daysWithAnyData = realDailyData.filter(d => d.kcal > 0).length;
          if (daysWithAnyData === 0) return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>Нет данных дневника для анализа.</div>;
          const goalChecks = [
            { label: 'Калории ±10%', met: realDailyData.filter(d => d.kcal > 0 && Math.abs(d.kcal - avgKcal) / avgKcal < 0.1).length, total: daysWithAnyData, color: '#22c55e' },
            { label: 'Белки ≥90%', met: realDailyData.filter(d => d.protein > 0 && d.protein >= avgProtein * 0.9).length, total: daysWithAnyData, color: '#3b82f6' },
            { label: 'Жиры ≤110%', met: realDailyData.filter(d => d.fat > 0 && d.fat <= avgFat * 1.1).length, total: daysWithAnyData, color: '#f97316' },
            { label: 'Углеводы ≤110%', met: realDailyData.filter(d => d.carbs > 0 && d.carbs <= avgCarbs * 1.1).length, total: daysWithAnyData, color: '#a855f7' },
          ];
          const streak = (() => { let s = 0; for (let i = realDailyData.length - 1; i >= 0; i--) { if (realDailyData[i].kcal > 0 && Math.abs(realDailyData[i].kcal - avgKcal) / avgKcal < 0.15) s++; else break; } return s; })();
          return <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
              {goalChecks.map(g => {
                const pct = g.total > 0 ? Math.round(g.met / g.total * 100) : 0;
                return <div key={g.label} style={{ background: '#202023', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>{g.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: g.color }}>{pct}%</div>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: g.color, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)' }}>{g.met}/{g.total}</div>
                  </div>
                </div>;
              })}
            </div>
            {streak > 0 && <div style={{ fontSize: 9, color: '#f472b6', fontWeight: 600, textAlign: 'center', padding: '4px 8px', borderRadius: 6, background: 'rgba(244,114,182,0.08)' }}>🔥 Серия: {streak} {streak === 1 ? 'день' : 'дней'} подряд</div>}
          </>;
        })()}
      </div>

      {/* Mini calendar - achievement heatmap */}
      <div style={{ ...cardBg }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: -0.3 }}>📅 Календарь достижений</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', textAlign: 'center', padding: '2px 0' }}>{d}</div>)}
          {(() => {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startDay = startOfMonth.getDay() || 7;
            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            const cells: React.ReactNode[] = [];
            for (let i = 1; i < startDay; i++) cells.push(<div key={`pad-${i}`} />);
            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const dayData = realDailyData.find(r => {
                const dd = new Date(today); dd.setDate(dd.getDate() - (range - 1 - realDailyData.indexOf(r)));
                return dd.toISOString().split('T')[0] === dateStr;
              });
              const hasData = dayData && dayData.kcal > 0;
              const isGood = hasData && Math.abs(dayData.kcal - avgKcal) / avgKcal < 0.15;
              const isToday = d === today.getDate();
              cells.push(
                <div key={d} style={{
                  aspectRatio: '1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 7, fontWeight: isToday ? 700 : 400,
                  background: isToday ? 'rgba(0,230,138,0.15)' : 'transparent',
                  border: isToday ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent',
                  color: isToday ? '#00e68a' : isGood ? '#22c55e' : hasData ? '#ef4444' : 'rgba(255,255,255,0.25)',
                }}>
                  {d}
                  {hasData && <div style={{ position: 'absolute', bottom: 1, width: 3, height: 3, borderRadius: '50%', background: isGood ? '#22c55e' : '#ef4444' }} />}
                </div>
              );
            }
            return cells;
          })()}
        </div>
      </div>
    </div>
  );
};
