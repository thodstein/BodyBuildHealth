import React from 'react';
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
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const NutritionCharts: React.FC<{
  kcalData: number[];
  proteinData: number[];
  labels: string[];
}> = ({ kcalData, proteinData, labels }) => {
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Калории (ккал)',
        data: kcalData,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Белки (г)',
        data: proteinData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const },
      title: { display: true, text: 'КБЖУ за 7-30 дней' },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  return (
    <div className="nutrition-charts">
      <div className="card">
        <h3>Графики КБЖУ</h3>
        <div style={{ height: 300 }}>
          <Line data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
};
