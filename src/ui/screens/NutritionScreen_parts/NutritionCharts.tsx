import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, BarElement);

type ChartRange = 7 | 14 | 30;

interface DailyLog {
  date: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface DailyLog {
  date: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}



export const NutritionCharts: React.FC<{
  kcalData: number[];
  proteinData: number[];
  labels: string[];
  dailyLogs?: Record<string, { kcal: number; p: number; f: number; c: number }[]>;
}> = ({ kcalData, proteinData, dailyLogs }) => {
  const [range, setRange] = useState<ChartRange>(7);

  // Read weight log from localStorage
  const weightLog = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_weight_log') || '[]') as { date: string; weight: number }[]; } catch { return []; }
  }, []);

  const realDailyData = useMemo<DailyLog[]>(() => {
    const days = range;
    const today = new Date();
    const result: DailyLog[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      let dayKcal = 0, dayProtein = 0, dayFat = 0, dayCarbs = 0;
      if (dailyLogs && dailyLogs[dateStr]) {
        dailyLogs[dateStr].forEach(e => { dayKcal += e.kcal || 0; dayProtein += e.p || 0; dayFat += e.f || 0; dayCarbs += e.c || 0; });
      } else {
        try {
          const raw = localStorage.getItem('nutrition_diary');
          if (raw) { const diary = JSON.parse(raw); const dayData = diary[dateStr]; if (dayData && dayData.meals) { Object.values(dayData.meals).flat().forEach((m: any) => { dayKcal += m.kcal || m.totalKcal || 0; dayProtein += m.p || m.protein || m.totalProtein || 0; dayFat += m.f || m.fat || m.totalFat || 0; dayCarbs += m.c || m.carbs || m.totalCarbs || 0; }); } }
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

  // Weight data for chart — match labels
  const weightData = useMemo(() => {
    const labels = realDailyData.map(d => d.date);
    // Build full date for each label
    const today = new Date();
    return labels.map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (range - 1 - i));
      const ds = d.toISOString().split('T')[0];
      const found = weightLog.find(w => w.date === ds);
      return found ? found.weight : null;
    });
  }, [range, realDailyData, weightLog]);

  const chartData = useMemo(() => {
    const hasRealData = realDailyData.some(d => d.kcal > 0);
    const labels = realDailyData.map(d => d.date);
    if (hasRealData) {
      return { labels, kcalLine: realDailyData.map(d => d.kcal || null), proteinLine: realDailyData.map(d => d.protein || null), fatLine: realDailyData.map(d => d.fat || null), carbsLine: realDailyData.map(d => d.carbs || null), avgKcal, avgProtein, avgFat, avgCarbs };
    }
    const days = range;
    const kcalLine = Array.from({ length: days }, (_, i) => Math.round(avgKcal + Math.sin(i * 0.7) * 80 + Math.cos(i * 1.3) * 60));
    const proteinLine = Array.from({ length: days }, (_, i) => Math.round(avgProtein + Math.sin(i * 0.5) * 8 + Math.cos(i * 1.1) * 6));
    const fatLine = Array.from({ length: days }, (_, i) => Math.round(avgFat + Math.sin(i * 0.6) * 5 + Math.cos(i * 1.2) * 4));
    const carbsLine = Array.from({ length: days }, (_, i) => Math.round(avgCarbs + Math.sin(i * 0.8) * 15 + Math.cos(i * 1.4) * 10));
    return { labels, kcalLine, proteinLine, fatLine, carbsLine, avgKcal, avgProtein, avgFat, avgCarbs };
  }, [range, realDailyData, avgKcal, avgProtein, avgFat, avgCarbs]);

  const hasRealData = realDailyData.some(d => d.kcal > 0);
  const daysWithData = realDailyData.filter(d => d.kcal > 0).length;
  const hasWeightData = weightData.some(d => d !== null);

  const kcalChartData = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Ккал',
        data: chartData.kcalLine,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.1)',
        tension: 0.4,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Среднее',
        data: Array(range).fill(chartData.avgKcal),
        borderColor: 'rgba(34,197,94,0.4)',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        yAxisID: 'y',
      },
      ...(hasWeightData ? [{
        label: 'Вес (кг)',
        data: weightData,
        borderColor: '#f472b6',
        backgroundColor: 'rgba(244,114,182,0.1)',
        borderDash: [3, 3],
        pointRadius: 4,
        pointBackgroundColor: '#f472b6',
        fill: false,
        tension: 0.3,
        yAxisID: 'y1',
      }] : []),
    ],
  };

  const macroChartData = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Белки',
        data: chartData.proteinLine,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Жиры',
        data: chartData.fatLine,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Углеводы',
        data: chartData.carbsLine,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168,85,247,0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const commonOptions = (title: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { boxWidth: 12, fontSize: 10 } },
      title: { display: true, text: title, font: { size: 13 } },
    },
    scales: {
      y: { beginAtZero: false, position: 'left' as const, title: { display: true, text: 'ккал', font: { size: 9 } } },
      ...(hasWeightData ? { y1: { beginAtZero: false, position: 'right' as const, grid: { display: false }, title: { display: true, text: 'кг', font: { size: 9 } } } } : {}),
      x: { ticks: { maxTicksLimit: 7, font: { size: 9 } } },
    },
  });

  return (
    <div className="nutrition-charts">
      {!hasRealData && (
        <div className="card" style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(255,165,2,0.08)', borderColor: 'rgba(255,165,2,0.3)' }}>
          <div style={{ fontSize: 11, color: '#ffa502' }}>📊 Нет данных дневника. Графики — оценочные значения.</div>
        </div>
      )}
      {hasRealData && daysWithData < range && (
        <div className="card" style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(30,144,255,0.08)', borderColor: 'rgba(30,144,255,0.3)' }}>
          <div style={{ fontSize: 11, color: '#1e90ff' }}>📊 Данные за {daysWithData} из {range} дней.</div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>📈 Графики КБЖУ</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {([7, 14, 30] as ChartRange[]).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: range === r ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                border: range === r ? '1px solid #00e68a' : '1px solid var(--border)',
                color: range === r ? '#00e68a' : 'var(--text-dim)', fontWeight: 600,
              }}>
                {r}д
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 220, marginBottom: 16 }}>
          <Line data={kcalChartData} options={commonOptions('')} />
        </div>

        <div style={{ height: 220 }}>
          <Line data={macroChartData} options={commonOptions('')} />
        </div>
      </div>

      {/* Summary stats */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>📊 Средние за {range} дней</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Ккал', val: chartData.avgKcal, unit: '', color: '#22c55e' },
            { label: 'Белки', val: chartData.avgProtein, unit: 'г', color: '#3b82f6' },
            { label: 'Жиры', val: chartData.avgFat, unit: 'г', color: '#f97316' },
            { label: 'Углеводы', val: chartData.avgCarbs, unit: 'г', color: '#a855f7' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Goal completion */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>🎯 Выполнение целей за {range} дней</h3>
        {(() => {
          const daysWithAnyData = realDailyData.filter(d => d.kcal > 0).length;
          if (daysWithAnyData === 0) return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Нет данных дневника для анализа.</div>;
          const goalChecks = [
            { label: 'Калории ±10%', met: realDailyData.filter(d => d.kcal > 0 && Math.abs(d.kcal - avgKcal) / avgKcal < 0.1).length, total: daysWithAnyData, color: '#22c55e' },
            { label: 'Белки ≥90%', met: realDailyData.filter(d => d.protein > 0 && d.protein >= avgProtein * 0.9).length, total: daysWithAnyData, color: '#3b82f6' },
            { label: 'Жиры ≤110%', met: realDailyData.filter(d => d.fat > 0 && d.fat <= avgFat * 1.1).length, total: daysWithAnyData, color: '#f97316' },
            { label: 'Углеводы ≤110%', met: realDailyData.filter(d => d.carbs > 0 && d.carbs <= avgCarbs * 1.1).length, total: daysWithAnyData, color: '#a855f7' },
          ];
          const streak = (() => { let s = 0; for (let i = realDailyData.length - 1; i >= 0; i--) { if (realDailyData[i].kcal > 0 && Math.abs(realDailyData[i].kcal - avgKcal) / avgKcal < 0.15) s++; else break; } return s; })();
          return <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {goalChecks.map(g => {
                const pct = g.total > 0 ? Math.round(g.met / g.total * 100) : 0;
                return <div key={g.label} style={{ background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{g.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: g.color }}>{pct}%</div>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: g.color, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{g.met}/{g.total}</div>
                  </div>
                </div>;
              })}
            </div>
            {streak > 0 && <div style={{ fontSize: 10, color: '#f472b6', fontWeight: 600, textAlign: 'center', padding: '4px 8px', borderRadius: 6, background: 'rgba(244,114,182,0.08)' }}>🔥 Серия: {streak} {streak === 1 ? 'день' : 'дней'} подряд в норме</div>}
          </>;
        })()}
      </div>
    </div>
  );
};
