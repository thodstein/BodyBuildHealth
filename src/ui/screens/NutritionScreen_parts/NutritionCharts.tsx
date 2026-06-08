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

function generateMockData(days: number, base: number, variance: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const trend = i > days * 0.6 ? (i - days * 0.6) * variance * 0.02 : 0;
    const noise = (Math.sin(i * 0.7) * 0.3 + Math.cos(i * 1.3) * 0.2) * variance;
    return Math.round(base + trend + noise);
  });
}

export const NutritionCharts: React.FC<{
  kcalData: number[];
  proteinData: number[];
  labels: string[];
}> = ({ kcalData, proteinData }) => {
  const [range, setRange] = useState<ChartRange>(7);

  const chartData = useMemo(() => {
    const days = range;
    const labels = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    });

    const baseKcal = kcalData.length > 0 ? Math.round(kcalData.reduce((a, b) => a + b, 0) / kcalData.length) : 2500;
    const baseProtein = proteinData.length > 0 ? Math.round(proteinData.reduce((a, b) => a + b, 0) / proteinData.length) : 160;
    const baseFat = Math.round(baseKcal * 0.3 / 9);
    const baseCarbs = Math.round((baseKcal - baseProtein * 4 - baseFat * 9) / 4);

    const kcalLine = generateMockData(days, baseKcal, 200);
    const proteinLine = generateMockData(days, baseProtein, 15);
    const fatLine = generateMockData(days, baseFat, 8);
    const carbsLine = generateMockData(days, baseCarbs, 30);

    return { labels, kcalLine, proteinLine, fatLine, carbsLine, baseKcal, baseProtein, baseFat, baseCarbs };
  }, [range, kcalData, proteinData]);

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
        data: Array(range).fill(chartData.baseKcal),
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
        <h3 style={{ margin: '0 0 8px 0' }}>📊 Средние за период</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Калории', val: chartData.baseKcal, unit: 'ккал/д', color: '#22c55e' },
            { label: 'Белки', val: chartData.baseProtein, unit: 'г/д', color: '#3b82f6' },
            { label: 'Жиры', val: chartData.baseFat, unit: 'г/д', color: '#f97316' },
            { label: 'Углеводы', val: chartData.baseCarbs, unit: 'г/д', color: '#a855f7' },
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
