import React, { useMemo } from 'react';

interface DiaryItem { name: string; kcal: number; p: number; f: number; c: number; qty?: number; category?: string; }

interface Props {
  dayMeals: Record<string, any[]>;
  dayTotals: { kcal: number; p: number; f: number; c: number };
  targets?: { kcal: number; protein: number; fats: number; carbs: number };
  diaryData: Record<string, any>;
  selectedDate: string;
  refreshKey: number;
}

const cardStyle: React.CSSProperties = { padding: 10, borderRadius: 14, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 };

const DonutChart: React.FC<{ protein: number; fat: number; carbs: number; size?: number }> = ({ protein, fat, carbs, size = 90 }) => {
  const total = protein + fat + carbs || 1;
  const segments = [
    { value: protein / total, color: '#3b82f6', label: 'Белки' },
    { value: fat / total, color: '#f59e0b', label: 'Жиры' },
    { value: carbs / total, color: '#f97316', label: 'Углеводы' },
  ];
  const cx = size / 2, cy = size / 2, r = size / 2 - 8, strokeW = size * 0.2;
  let offset = 0;
  const arcs = segments.map((s, i) => {
    const dash = s.value * Math.PI * 2 * r;
    const gap = dash > 0 ? Math.PI * 2 * r - dash : 0;
    const arc = { dash, gap, color: s.color, offset, label: s.label, pct: Math.round(s.value * 100) };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={strokeW}
            strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={-a.offset}
            transform={`rotate(-90 ${cx} ${cy})`} opacity={a.dash > 0 ? 1 : 0.2}
            style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#fff" fontSize={size * 0.16} fontWeight={700}>
          {Math.round(protein + fat + carbs)}г
        </text>
        <text x={cx} y={cy + size * 0.13} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={size * 0.1}>
          БЖУ
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 6, fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>
        {segments.map((s, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
            {s.label} {Math.round(s.value * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
};

const Sparkline: React.FC<{ data: number[]; color: string; height?: number; label: string; unit: string }> = ({ data, color, height = 36, label, unit }) => {
  const valid = data.filter(d => d > 0);
  if (valid.length < 2) return (
    <div style={{ textAlign: 'center', padding: 4 }}>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>Нет данных</div>
    </div>
  );
  const max = Math.max(...valid, 1);
  const min = Math.min(...valid);
  const w = 140, h = height, padX = 1, padY = 4;
  const scaleX = (w - padX * 2) / Math.max(valid.length - 1, 1);
  const scaleY = (h - padY * 2) / (max - min || 1);
  const points = valid.map((v, i) => {
    const x = padX + i * scaleX;
    const y = h - padY - (v - min) * scaleY;
    return `${x},${y}`;
  }).join(' ');

  const avg = Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  const trend = valid.length >= 2 ? ((valid[valid.length - 1] - valid[0]) / valid[0] * 100) : 0;

  return (
    <div style={{ textAlign: 'center', padding: 4 }}>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{label}</div>
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'all 0.3s' }} />
        {valid.map((v, i) => (i === 0 || i === valid.length - 1) ? (
          <circle key={i} cx={padX + i * scaleX} cy={h - padY - (v - min) * scaleY} r={2} fill={color} />
        ) : null)}
      </svg>
      <div style={{ fontSize: 8, fontWeight: 700, color }}>
        {avg}{unit} {trend !== 0 ? <span style={{ fontSize: 7, color: trend > 0 ? '#ef4444' : '#22c55e' }}>{trend > 0 ? '+' : ''}{Math.round(trend)}%</span> : null}
      </div>
    </div>
  );
};

const FoodFrequencyChart: React.FC<{ diaryData: Record<string, any>; selectedDate: string }> = ({ diaryData, selectedDate }) => {
  const freq = useMemo(() => {
    const map = new Map<string, { count: number; totalKcal: number }>();
    const cutOff = new Date(selectedDate);
    cutOff.setDate(cutOff.getDate() - 30);
    Object.entries(diaryData).forEach(([date, day]) => {
      if (date < cutOff.toISOString().split('T')[0] || date > selectedDate) return;
      Object.values(day?.meals || {}).forEach((items: any) => {
        (items || []).forEach((item: any) => {
          const key = item.name || '';
          if (!key) return;
          const existing = map.get(key) || { count: 0, totalKcal: 0 };
          existing.count++;
          existing.totalKcal += item.kcal || 0;
          map.set(key, existing);
        });
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [diaryData, selectedDate]);

  if (freq.length < 2) return (
    <div style={{ ...cardStyle, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>
      📊 Недостаточно данных для анализа частоты (нужно ≥2 продуктов)
    </div>
  );

  const maxCount = Math.max(...freq.map(f => f.count), 1);
  const barColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#a855f7', '#14b8a6'];

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📊 Топ продуктов (30 дней)</div>
      {freq.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', width: 80, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right' }}
            title={f.name}>
            {f.name.length > 14 ? f.name.slice(0, 13) + '...' : f.name}
          </span>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(f.count / maxCount * 100)}%`, borderRadius: 5, background: barColors[i % barColors.length], transition: 'width 0.5s', minWidth: 3 }} />
          </div>
          <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.8)', minWidth: 20, textAlign: 'right' }}>{f.count}</span>
        </div>
      ))}
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
        Частота употребления за последние 30 дней
      </div>
    </div>
  );
};

const MacroBalanceGauge: React.FC<{ actual: number; target: number; label: string; color: string }> = ({ actual, target, label, color }) => {
  const pct = target > 0 ? Math.min(100, Math.round(actual / target * 100)) : 0;
  const isOk = pct >= 85 && pct <= 115;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 52, height: 52, margin: '0 auto' }}>
        <svg width={52} height={52} viewBox="0 0 52 52">
          <circle cx={26} cy={26} r={22} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
          <circle cx={26} cy={26} r={22} fill="none" stroke={isOk ? color : pct > 115 ? '#ef4444' : '#f59e0b'}
            strokeWidth={4} strokeDasharray={`${pct * 1.38} ${276 - pct * 1.38}`}
            strokeDashoffset={0} transform="rotate(-90 26 26)" strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s' }} />
          <text x={26} y={28} textAnchor="middle" fill={isOk ? color : pct > 115 ? '#ef4444' : '#f59e0b'} fontSize={13} fontWeight={700}>
            {pct}%
          </text>
        </svg>
      </div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{Math.round(actual)}/{target}</div>
    </div>
  );
};

export const NutritionDiaryCharts: React.FC<Props> = ({ dayMeals, dayTotals, targets, diaryData, selectedDate, refreshKey }) => {
  const hasData = Object.keys(dayMeals).length > 0;

  const weeklyKcal = useMemo(() => {
    const vals: number[] = [];
    const current = new Date(selectedDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(current);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const day = diaryData[ds];
      let total = 0;
      if (day?.meals) {
        Object.values(day.meals).forEach((items: any) => {
          (items || []).forEach((item: any) => { total += item.kcal || 0; });
        });
      }
      vals.push(total);
    }
    return vals;
  }, [diaryData, selectedDate, refreshKey]);

  const weeklyProtein = useMemo(() => {
    const vals: number[] = [];
    const current = new Date(selectedDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(current);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const day = diaryData[ds];
      let total = 0;
      if (day?.meals) {
        Object.values(day.meals).forEach((items: any) => {
          (items || []).forEach((item: any) => { total += item.p || 0; });
        });
      }
      vals.push(total);
    }
    return vals;
  }, [diaryData, selectedDate, refreshKey]);

  if (!hasData) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Macro distribution donut + gauge cards */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <DonutChart protein={dayTotals.p} fat={dayTotals.f} carbs={dayTotals.c} size={80} />
        <div style={{ display: 'flex', gap: 6 }}>
          <MacroBalanceGauge actual={dayTotals.kcal} target={targets?.kcal || 2500} label="Ккал" color="#00e68a" />
          <MacroBalanceGauge actual={dayTotals.p} target={targets?.protein || 160} label="Белки" color="#3b82f6" />
        </div>
      </div>

      {/* Weekly trend sparklines */}
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap' }}>
        <Sparkline data={weeklyKcal} color="#22c55e" label="Ккал (7 дн)" unit="" />
        <Sparkline data={weeklyProtein} color="#3b82f6" label="Белок (7 дн)" unit="г" />
        <div style={{ textAlign: 'center', padding: 4 }}>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>Приёмов</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6' }}>{Object.keys(dayMeals).length}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>за день</div>
        </div>
      </div>

      {/* Food frequency */}
      <FoodFrequencyChart diaryData={diaryData} selectedDate={selectedDate} />
    </div>
  );
};
