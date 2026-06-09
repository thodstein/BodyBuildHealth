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

  const kcalChartData = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Калории (ккал)',
        data: chartData.kcalLine,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Цель',
        data: Array(range).fill(chartData.avgKcal),
        borderColor: 'rgba(34,197,94,0.4)',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const macroChartData = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Белки (г)',
        data: chartData.proteinLine,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Жиры (г)',
        data: chartData.fatLine,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Углеводы (г)',
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
      y: { beginAtZero: false },
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
          <Line data={kcalChartData} options={commonOptions('Калории за период')} />
        </div>

        <div style={{ height: 220 }}>
          <Line data={macroChartData} options={commonOptions('Макронутриенты (Б/Ж/У)')} />
        </div>
      </div>

      {/* Summary stats */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>📊 Средние за {range} дней</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Калории', val: chartData.avgKcal, unit: 'ккал/д', color: '#22c55e' },
            { label: 'Белки', val: chartData.avgProtein, unit: 'г/д', color: '#3b82f6' },
            { label: 'Жиры', val: chartData.avgFat, unit: 'г/д', color: '#f97316' },
            { label: 'Углеводы', val: chartData.avgCarbs, unit: 'г/д', color: '#a855f7' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
