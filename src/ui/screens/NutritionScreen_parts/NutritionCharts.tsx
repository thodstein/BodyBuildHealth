import React, { useState, useMemo } from 'react';
import { formatDate } from '../../../core/utils/date-utils';
import { readDiaryV2 } from './diary-storage-v2';
import { Line } from 'react-chartjs-2';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler, BarElement,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, BarElement);

type ChartRange = 7 | 14 | 30;

interface DailyLog { date: string; kcal: number; protein: number; fat: number; carbs: number; }

const cardBg = { background: 'linear-gradient(135deg, #18181b 0%, #1e1e22 100%)', borderRadius: 18, padding: 16, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' };

const commonChartOptions = (hasWeight: boolean) => ({
  responsive: true, maintainAspectRatio: false,
  interaction: { intersect:false, mode:'index' as const },
  plugins: {
    legend: { display: true, position: 'top' as const, labels: { boxWidth: 12, boxHeight:12, usePointStyle:true, pointStyle:'circle', font:{ size:10, weight:'600' as const }, color: 'rgba(255,255,255,0.9)', padding:12 } },
    tooltip: {
      backgroundColor: 'rgba(24,24,27,0.95)', titleColor: '#fff', bodyColor: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
      padding:10, cornerRadius:10, displayColors:true, titleFont:{ size:11, weight:'700' as const }, bodyFont:{ size:11 },
      callbacks: {}
    },
  },
  scales: {
    y: { beginAtZero: false, position: 'left' as const, grid: { color: 'rgba(255,255,255,0.04)', drawBorder:false }, border:{ display:false }, ticks: { color: 'rgba(255,255,255,0.65)', font: { size: 10, weight:'600' as const }, padding:8 } },
    ...(hasWeight ? { y1: { beginAtZero: false, position: 'right' as const, grid: { display: false }, border:{ display:false }, ticks: { color: 'rgba(244,114,182,0.8)', font: { size: 10, weight:'600' as const } } } } : {}),
    x: { grid: { color: 'rgba(255,255,255,0.03)', drawBorder:false }, border:{ display:false }, ticks: { maxTicksLimit: 7, color: 'rgba(255,255,255,0.65)', font: { size: 10, weight:'600' as const } } },
  },
});

export const NutritionCharts: React.FC<{
  kcalData: number[]; proteinData: number[]; labels: string[];
  dailyLogs?: Record<string, { kcal: number; p: number; f: number; c: number }[]>;
  targets?: { kcal: number; protein: number; fats: number; carbs: number };
}> = ({ kcalData, proteinData, dailyLogs, targets }) => {
  const [range, setRange] = useState<ChartRange>(7);
  const [chartMode, setChartMode] = useState<'kcal' | 'macro' | 'both'>('both');
  const [calMonth, setCalMonth] = useState(() => { const d=new Date(); return { y:d.getFullYear(), m:d.getMonth() }; });

  const weightLog = useMemo(() => { try { return JSON.parse(localStorage.getItem('he_weight_log') || '[]') as { date: string; weight: number }[]; } catch { return []; } }, [range]);

  const realDailyData = useMemo<DailyLog[]>(() => {
    const days = range; const today = new Date(); const result: DailyLog[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const dayLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      let dayKcal = 0, dayProtein = 0, dayFat = 0, dayCarbs = 0;
      if (dailyLogs && dailyLogs[dateStr]) {
        dailyLogs[dateStr].forEach(e => { dayKcal += e.kcal || 0; dayProtein += e.p || 0; dayFat += e.f || 0; dayCarbs += e.c || 0; });
      } else {
        try {
          const diary = readDiaryV2(); const dayData = diary[dateStr]; if (dayData?.meals) { Object.values(dayData.meals).flat().forEach((m: any) => { dayKcal += m.kcal || 0; dayProtein += m.p || 0; dayFat += m.f || 0; dayCarbs += m.c || 0; }); }
        } catch {}
      }
      result.push({ date: dayLabel, kcal: Math.round(dayKcal), protein: Math.round(dayProtein), fat: Math.round(dayFat), carbs: Math.round(dayCarbs), _dateStr: dateStr } as any);
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
      const found = weightLog.find(w => w.date === formatDate(d));
      return found ? found.weight : null;
    });
  }, [range, realDailyData, weightLog]);

  const hasRealData = realDailyData.some(d => d.kcal > 0);
  const daysWithData = realDailyData.filter(d => d.kcal > 0).length;
  const hasWeightData = weightData.some(d => d !== null);

  const diaryMap = useMemo(() => {
    try {
      const diary = readDiaryV2();
      const m = new Map<string, number>();
      Object.entries(diary).forEach(([date, day]: any) => {
        const tot = Object.values(day.meals || {}).flat().reduce((s:number, it:any)=> s + (it.kcal||0), 0);
        if (tot>0) m.set(date, Math.round(tot));
      });
      return m;
    } catch { return new Map<string, number>(); }
  }, [realDailyData]);

  const chartData = useMemo(() => {
    const labels = realDailyData.map(d => d.date);
    if (hasRealData) {
      return { labels, kcalLine: realDailyData.map(d => d.kcal || null), proteinLine: realDailyData.map(d => d.protein || null), fatLine: realDailyData.map(d => d.fat || null), carbsLine: realDailyData.map(d => d.carbs || null), avgKcal, avgProtein, avgFat, avgCarbs };
    }
    return {
      labels, avgKcal, avgProtein, avgFat, avgCarbs,
      kcalLine: Array.from({ length: range }, () => null),
      proteinLine: Array.from({ length: range }, () => null),
      fatLine: Array.from({ length: range }, () => null),
      carbsLine: Array.from({ length: range }, () => null),
    };
  }, [range, realDailyData, avgKcal, avgProtein, avgFat, avgCarbs]);

  const kcalPct = Math.round((avgProtein * 4) / Math.max(1, avgKcal) * 100);
  const fatPct = Math.round((avgFat * 9) / Math.max(1, avgKcal) * 100);
  const carbPct = Math.max(0, 100 - kcalPct - fatPct);

  const targetKcal = targets?.kcal || 2500;
  const targetProtein = targets?.protein || 160;
  const kcalChartData = {
    labels: chartData.labels,
    datasets: [
      { label: 'Ккал', data: chartData.kcalLine, borderColor: '#00e68a', backgroundColor: 'rgba(0,230,138,0.10)', tension: 0.42, fill: true, yAxisID: 'y', pointRadius: 4, pointHoverRadius:6, pointBackgroundColor: '#00e68a', pointBorderColor:'#18181b', pointBorderWidth:2, borderWidth:2.2 },
      { label: 'Цель', data: Array(range).fill(targetKcal), borderColor: 'rgba(0,230,138,0.45)', backgroundColor:'transparent', borderDash: [6, 4], pointRadius: 0, fill: false, yAxisID: 'y', borderWidth:1.5 },
      { label: 'Среднее', data: Array(range).fill(chartData.avgKcal), borderColor: 'rgba(245,158,11,0.55)', borderDash: [3, 3], pointRadius: 0, fill: false, yAxisID: 'y', borderWidth:1.2 },
      ...(hasWeightData ? [{ label: 'Вес (кг)', data: weightData, borderColor: '#f472b6', backgroundColor: 'rgba(244,114,182,0.06)', borderDash: [4, 4], pointRadius: 4, pointBackgroundColor: '#f472b6', pointBorderColor:'#18181b', pointBorderWidth:2, fill: false, tension: 0.35, yAxisID: 'y1', borderWidth:1.8 }] : []),
    ],
  };

  const macroChartData = {
    labels: chartData.labels,
    datasets: [
      { label: 'Белки', data: chartData.proteinLine, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.10)', tension: 0.42, fill: true, pointRadius: 3, pointBackgroundColor:'#3b82f6', pointBorderColor:'#18181b', pointBorderWidth:1.5, borderWidth:2 },
      { label: 'Жиры', data: chartData.fatLine, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', tension: 0.42, fill: true, pointRadius: 3, pointBackgroundColor:'#f59e0b', pointBorderColor:'#18181b', pointBorderWidth:1.5, borderWidth:2 },
      { label: 'Углеводы', data: chartData.carbsLine, borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', tension: 0.42, fill: true, pointRadius: 3, pointBackgroundColor:'#a78bfa', pointBorderColor:'#18181b', pointBorderWidth:1.5, borderWidth:2 },
      { label: 'Цель Б', data: Array(range).fill(targetProtein), borderColor:'rgba(59,130,246,0.35)', borderDash:[6,4], pointRadius:0, fill:false, borderWidth:1.2 },
    ],
  };

  const maxKcalInRange = Math.max(...realDailyData.map(d=>d.kcal||0), 0);
  const trendKcal = realDailyData.length>=2 && realDailyData[realDailyData.length-1].kcal>0 && realDailyData[0].kcal>0 ? ((realDailyData[realDailyData.length-1].kcal - realDailyData[0].kcal)/Math.max(realDailyData[0].kcal,1)*100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ModernHero icon="📈" title="Графики" subtitle="Динамика КБЖУ и веса • цели, тренды и календарь прогресса. Выбери период и режим." stats={[
        { k:'Дней', v: range, sub:'период', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
        { k:'Ккал', v: avgKcal, sub:'среднее', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
        { k:'Белок', v: avgProtein+'г', sub:'среднее', col:'#3b82f6', bg:'rgba(96,165,250,0.10)' },
        { k:'Тренд', v: trendKcal===0 ? '—' : `${trendKcal>0?'+':''}${Math.round(trendKcal)}%`, sub: trendKcal>0?'рост':'спад', col: trendKcal>5?'#ef4444': trendKcal<-5?'#22c55e':'rgba(255,255,255,0.6)', bg: trendKcal>5?'rgba(239,68,68,0.08)': trendKcal<-5?'rgba(34,197,94,0.08)':'rgba(255,255,255,0.03)' },
      ]} />
      {!hasRealData && (
        <div style={{ ...modernCardBg, background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(251,146,60,0.04))', border: '1px solid rgba(245,158,11,0.18)', display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ width:36, height:36, borderRadius:10, background:'rgba(245,158,11,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📊</span>
          <div>
            <div style={{ fontSize: 12, color: '#f59e0b', fontWeight:700 }}>Нет данных дневника</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:2 }}>Добавь приёмы в 📝 Дневник — графики оживут. Показаны целевые значения.</div>
          </div>
        </div>
      )}
      {hasRealData && daysWithData < range && (
        <div style={{ ...modernCardBg, background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(96,165,250,0.04))', border: '1px solid rgba(59,130,246,0.18)', display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ width:32, height:32, borderRadius:10, background:'rgba(59,130,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💡</span>
          <div style={{ fontSize: 11, color: '#60a5fa', fontWeight:600 }}>Заполнено {daysWithData} из {range} дней • продолжай вести дневник для точной динамики</div>
          <div style={{ marginLeft:'auto', height:6, width:80, borderRadius:999, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}><div style={{ height:'100%', width:`${Math.round(daysWithData/range*100)}%`, background:'#60a5fa', borderRadius:999 }} /></div>
        </div>
      )}

      {/* Range + mode selector — modern glass */}
      <div style={{ ...cardBg, padding:14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📈</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Графики динамики</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{range} дн • макс {maxKcalInRange||'—'} ккал</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, padding:4, borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)' }}>
            {([7, 14, 30] as ChartRange[]).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: '7px 14px', borderRadius: 9, fontSize: 11, cursor: 'pointer', fontWeight: 700, minWidth:44,
                background: range === r ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'transparent',
                border: range === r ? '1px solid #00e68a' : '1px solid transparent',
                color: range === r ? '#000' : 'rgba(255,255,255,0.65)',
                transition: 'all 0.2s', boxShadow: range===r ? '0 2px 10px rgba(0,230,138,0.25)' : 'none',
              }}>{r}д</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[
            { k:'both', l:'Всё', icon:'📊' },
            { k:'kcal', l:'Ккал + Вес', icon:'🔥' },
            { k:'macro', l:'БЖУ', icon:'🥩' },
          ].map(m => (
            <button key={m.k} onClick={() => setChartMode(m.k as any)} style={{
              flex: 1, padding: '9px 6px', borderRadius: 10, fontSize: 11, cursor: 'pointer', fontWeight: 700, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              background: chartMode === m.k ? 'linear-gradient(135deg,#a78bfa18,#7c3aed12)' : '#202023',
              border: chartMode === m.k ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.06)',
              color: chartMode === m.k ? '#a78bfa' : 'rgba(255,255,255,0.6)',
              boxShadow: chartMode===m.k ? '0 2px 10px rgba(167,139,250,0.12)' : 'none',
            }}><span>{m.icon}</span> {m.l}</button>
          ))}
        </div>
        {(chartMode === 'both' || chartMode === 'kcal') && (
          <div style={{ height: 220, marginBottom: chartMode === 'both' ? 14 : 0, padding:8, borderRadius:12, background:'rgba(255,255,255,0.01)', border:'1px solid rgba(255,255,255,0.03)' }}>
            <Line data={kcalChartData} options={commonChartOptions(hasWeightData) as any} />
          </div>
        )}
        {(chartMode === 'both' || chartMode === 'macro') && (
          <div style={{ height: 220, padding:8, borderRadius:12, background:'rgba(255,255,255,0.01)', border:'1px solid rgba(255,255,255,0.03)' }}>
            <Line data={macroChartData} options={commonChartOptions(false) as any} />
          </div>
        )}
        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:999, background:'rgba(0,230,138,0.08)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.15)' }}>● Ккал факт</span>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:999, background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.5)', border:'1px dashed rgba(255,255,255,0.08)' }}>— Цель {targetKcal}</span>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:999, background:'rgba(245,158,11,0.08)', color:'#f59e0b', border:'1px dashed rgba(245,158,11,0.18)' }}>╌ Среднее {avgKcal}</span>
          {hasWeightData && <span style={{ fontSize:9, padding:'4px 8px', borderRadius:999, background:'rgba(244,114,182,0.08)', color:'#f472b6', border:'1px dashed rgba(244,114,182,0.18)' }}>● Вес</span>}
        </div>
      </div>

      {/* Macro distribution — enhanced */}
      <div style={{ ...cardBg }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 10 }}>
          <span style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#60a5fa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🍽</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Баланс макро</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>среднее за {range} дн • {avgKcal} ккал</div>
          </div>
        </div>
        <div style={{ height: 22, borderRadius: 12, overflow: 'hidden', display: 'flex', marginBottom: 10, padding:2, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', gap:2 }}>
          <div style={{ flex: kcalPct, background: 'linear-gradient(90deg,#3b82f6,#60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', borderRadius:10, boxShadow:'0 2px 8px rgba(59,130,246,0.3)' }}>Б {kcalPct}%</div>
          <div style={{ flex: fatPct, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', borderRadius:10, boxShadow:'0 2px 8px rgba(245,158,11,0.3)' }}>Ж {fatPct}%</div>
          <div style={{ flex: carbPct, background: 'linear-gradient(90deg,#8b5cf6,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', borderRadius:10, boxShadow:'0 2px 8px rgba(139,92,246,0.3)' }}>У {carbPct}%</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { l:'Белки', v:avgProtein, c:'#3b82f6', bg:'rgba(59,130,246,0.08)', pct:kcalPct, target: Math.round(targetProtein) },
            { l:'Жиры', v:avgFat, c:'#f59e0b', bg:'rgba(245,158,11,0.08)', pct:fatPct, target: targets?.fats||70 },
            { l:'Углеводы', v:avgCarbs, c:'#a78bfa', bg:'rgba(167,139,250,0.08)', pct:carbPct, target: targets?.carbs||300 },
          ].map(s=>(
            <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.c}18`, borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', fontWeight:700, letterSpacing:0.5, textTransform:'uppercase' as const }}>{s.l}</div>
              <div style={{ fontSize:16, fontWeight:800, color:s.c, marginTop:2 }}>{s.v}<span style={{ fontSize:9, fontWeight:600, color:'rgba(255,255,255,0.45)' }}>г</span></div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:2 }}>{s.pct}% • цель {s.target}г</div>
              <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', marginTop:6, overflow:'hidden' }}><div style={{ height:'100%', width:`${Math.min(100, Math.round(s.v/Math.max(s.target,1)*100))}%`, background:s.c, borderRadius:2 }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats — modern cards */}
      <div style={{ ...cardBg }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 10 }}>
          <span style={{ width:26, height:26, borderRadius:8, background:'rgba(0,230,138,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>📊</span>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Средние за {range} дней</div>
          <span style={{ marginLeft:'auto', fontSize:9, padding:'3px 8px', borderRadius:999, background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.06)' }}>{daysWithData}/{range} дн</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Ккал', val: chartData.avgKcal, unit: '', color: '#00e68a', icon:'🔥', bg:'rgba(0,230,138,0.08)', border:'rgba(0,230,138,0.15)' },
            { label: 'Белки', val: chartData.avgProtein, unit: 'г', color: '#3b82f6', icon:'🥩', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.15)' },
            { label: 'Жиры', val: chartData.avgFat, unit: 'г', color: '#f59e0b', icon:'🧈', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.15)' },
            { label: 'Углеводы', val: chartData.avgCarbs, unit: 'г', color: '#a78bfa', icon:'🍞', bg:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.15)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, padding: '12px 10px', borderRadius: 14, textAlign: 'center', border: `1px solid ${s.border}`, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-12, right:-12, width:40, height:40, background:`radial-gradient(circle, ${s.color}14 0%, transparent 70%)`, borderRadius:'50%' }} />
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight:600, letterSpacing:0.4, textTransform:'uppercase' as const }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop:2, letterSpacing:-0.5 }}>{s.val}<span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)' }}>{s.unit}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Goal completion — enhanced */}
      <div style={{ ...cardBg }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 10 }}>
          <span style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#a78bfa,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🎯</span>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Выполнение целей</div>
          <span style={{ marginLeft:'auto', fontSize:9, color:'rgba(255,255,255,0.4)' }}>{range} дн</span>
        </div>
        {(() => {
          const daysWithAnyData = realDailyData.filter(d => d.kcal > 0).length;
          if (daysWithAnyData === 0) return <div style={{ textAlign:'center', padding:16, background:'rgba(255,255,255,0.02)', borderRadius:12, border:'1px dashed rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Нет данных — начни вести дневник и цели оживут</div>;
           const goal = targets || { kcal: 2500, protein: 160, fats: 70, carbs: 300 };
           const goalChecks = [
             { label: 'Калории ±10%', met: realDailyData.filter(d => d.kcal > 0 && Math.abs(d.kcal - goal.kcal) / Math.max(goal.kcal, 1) <= 0.1).length, total: daysWithAnyData, color: '#00e68a', icon:'🔥' },
             { label: 'Белки ≥90%', met: realDailyData.filter(d => d.protein > 0 && d.protein >= goal.protein * 0.9).length, total: daysWithAnyData, color: '#3b82f6', icon:'🥩' },
             { label: 'Жиры ≤110%', met: realDailyData.filter(d => d.fat > 0 && d.fat <= goal.fats * 1.1).length, total: daysWithAnyData, color: '#f59e0b', icon:'🧈' },
             { label: 'Углеводы ≤110%', met: realDailyData.filter(d => d.carbs > 0 && d.carbs <= goal.carbs * 1.1).length, total: daysWithAnyData, color: '#a78bfa', icon:'🍞' },
          ];
           const streak = (() => { let s = 0; for (let i = realDailyData.length - 1; i >= 0; i--) { if (realDailyData[i].kcal > 0 && Math.abs(realDailyData[i].kcal - goal.kcal) / Math.max(goal.kcal, 1) < 0.15) s++; else break; } return s; })();
          return <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {goalChecks.map(g => {
                const pct = g.total > 0 ? Math.round(g.met / g.total * 100) : 0;
                const ok = pct>=70;
                return <div key={g.label} style={{ background: ok ? `${g.color}0d` : '#202023', padding: '10px', borderRadius: 12, border: `1px solid ${ok ? g.color+'22' : 'rgba(255,255,255,0.04)'}` }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginBottom: 4, fontWeight:600, letterSpacing:0.3 }}>{g.icon} {g.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: ok? g.color : 'rgba(255,255,255,0.5)', minWidth:42 }}>{pct}%</div>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow:'hidden', padding:1 }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: g.color, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)', boxShadow:`0 0 8px ${g.color}40` }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight:700, background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:999 }}>{g.met}/{g.total}</div>
                  </div>
                </div>;
              })}
            </div>
            {streak > 0 && <div style={{ fontSize: 11, color: '#fff', fontWeight: 700, textAlign: 'center', padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(244,114,182,0.12), rgba(236,72,153,0.08))', border:'1px solid rgba(244,114,182,0.18)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><span style={{ fontSize:14 }}>🔥</span> Серия {streak} {streak === 1 ? 'день' : streak<5?'дня':'дней'} подряд в цели!</div>}
            {streak===0 && daysWithData>0 && <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', textAlign:'center', padding:6 }}>Сегодня вне ±15% от цели — завтра наверстаем 💪</div>}
          </>;
        })()}
      </div>

      {/* Calendar — full heatmap month with navigation */}
      <div style={{ ...cardBg }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>📅</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Календарь прогресса</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>тепловая карта • клик — данные дня</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={()=> setCalMonth(p=> { const d=new Date(p.y, p.m-1,1); return { y:d.getFullYear(), m:d.getMonth()}; })} style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontWeight:700 }}>‹</button>
            <span style={{ fontSize:11, fontWeight:700, color:'#fff', minWidth:92, textAlign:'center' }}>{new Date(calMonth.y, calMonth.m, 1).toLocaleDateString('ru-RU',{month:'long', year:'numeric'})}</span>
            <button onClick={()=> { const now=new Date(); setCalMonth({y:now.getFullYear(), m:now.getMonth()}); }} title="Сегодня" style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:700 }}>●</button>
            <button onClick={()=> setCalMonth(p=> { const d=new Date(p.y, p.m+1,1); return { y:d.getFullYear(), m:d.getMonth()}; })} style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontWeight:700 }}>›</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom:6 }}>
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '4px 0', fontWeight:700, letterSpacing:0.4 }}>{d}</div>)}
          {(() => {
            const startOfMonth = new Date(calMonth.y, calMonth.m, 1);
            const startDay = (startOfMonth.getDay() || 7);
            const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
            const todayStr = formatDate(new Date());
            const cells: React.ReactNode[] = [];
            for (let i = 1; i < startDay; i++) cells.push(<div key={`pad-${i}`} />);
            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = `${calMonth.y}-${String(calMonth.m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const kcal = diaryMap.get(dateStr) || 0;
              const hasData = kcal > 0;
              const pct = targetKcal>0 ? kcal/targetKcal : 0;
              let bg='transparent', border='1px solid transparent', color='rgba(255,255,255,0.25)', dot=null as string | null;
              if (hasData) {
                if (pct>=0.85 && pct<=1.15) { bg='linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,200,160,0.10))'; border='1px solid rgba(0,230,138,0.25)'; color='#00e68a'; dot='#00e68a'; }
                else if (pct>1.15) { bg='linear-gradient(135deg, rgba(239,68,68,0.16), rgba(220,38,38,0.08))'; border='1px solid rgba(239,68,68,0.22)'; color='#f87171'; dot='#ef4444'; }
                else if (pct>=0.5) { bg='linear-gradient(135deg, rgba(245,158,11,0.14), rgba(251,146,60,0.08))'; border='1px solid rgba(245,158,11,0.20)'; color='#fbbf24'; dot='#f59e0b'; }
                else { bg='rgba(239,68,68,0.08)'; border='1px solid rgba(239,68,68,0.12)'; color='rgba(239,68,68,0.7)'; dot='rgba(239,68,68,0.5)'; }
              }
              const isToday = dateStr===todayStr;
              const isWeekend = new Date(calMonth.y, calMonth.m, d).getDay()===0 || new Date(calMonth.y, calMonth.m, d).getDay()===6;
              cells.push(
                <div key={d} title={hasData ? `${dateStr} • ${kcal} ккал • ${Math.round(pct*100)}%` : dateStr} style={{
                  aspectRatio: '1', borderRadius: 10, display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: isToday ? 800 : 600, position:'relative',
                  background: isToday ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : bg,
                  border: isToday ? '1.5px solid #00e68a' : border,
                  color: isToday ? '#000' : color,
                  boxShadow: isToday ? '0 4px 12px rgba(0,230,138,0.30)' : hasData ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                  opacity: isToday ? 1 : isWeekend && !hasData ? 0.5 : 1,
                  cursor: hasData ? 'pointer' : 'default',
                  transition:'all 0.15s',
                }}>
                  <span>{d}</span>
                  {hasData && <span style={{ fontSize:7, fontWeight:700, marginTop:1, opacity:0.9 }}>{Math.round(kcal/100)/10}k</span>}
                  {hasData && dot && <div style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: isToday ? '#000' : dot, opacity: isToday?0.7:1 }} />}
                </div>
              );
            }
            // fill trailing to keep grid 6 rows
            const totalCells = startDay -1 + daysInMonth;
            const remaining = (7 - (totalCells %7)) %7;
            for(let i=0;i<remaining;i++) cells.push(<div key={`tail-${i}`} />);
            return cells;
          })()}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', marginTop:8, padding:'8px', background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:8, color:'rgba(255,255,255,0.6)' }}><span style={{ width:10, height:10, borderRadius:3, background:'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,200,160,0.10))', border:'1px solid rgba(0,230,138,0.25)' }} /> В цели ±15%</span>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:8, color:'rgba(255,255,255,0.6)' }}><span style={{ width:10, height:10, borderRadius:3, background:'rgba(245,158,11,0.14)', border:'1px solid rgba(245,158,11,0.20)' }} /> 50-85%</span>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:8, color:'rgba(255,255,255,0.6)' }}><span style={{ width:10, height:10, borderRadius:3, background:'rgba(239,68,68,0.16)', border:'1px solid rgba(239,68,68,0.22)' }} /> Перебор</span>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:8, color:'rgba(255,255,255,0.6)' }}><span style={{ width:10, height:10, borderRadius:7, background:'linear-gradient(135deg,#00e68a,#00c8a0)', border:'1px solid #00e68a' }} /> Сегодня</span>
        </div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', textAlign:'center', marginTop:6 }}>Наведи/тап на день — подсветка • зелёный = в цели, жёлтый = недобор, красный = перебор</div>
      </div>
    </div>
  );
};
