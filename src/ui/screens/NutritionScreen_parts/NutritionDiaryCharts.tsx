import React, { useMemo } from 'react';
import { formatDate } from '../../../core/utils/date-utils';
import { type DiaryItem } from './types';

interface Props {
  dayMeals: Record<string, DiaryItem[]>;
  dayTotals: { kcal: number; p: number; f: number; c: number };
  targets?: { kcal: number; protein: number; fats: number; carbs: number };
  diaryData: Record<string, any>;
  selectedDate: string;
  refreshKey: number;
}

const cardStyle: React.CSSProperties = { padding: 14, borderRadius: 16, background: 'linear-gradient(135deg, #18181b 0%, #1e1e22 100%)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8, boxShadow:'0 4px 20px rgba(0,0,0,0.18)', backdropFilter:'blur(8px)' };

const DonutChart: React.FC<{ protein: number; fat: number; carbs: number; size?: number }> = ({ protein, fat, carbs, size = 92 }) => {
  const total = protein + fat + carbs || 1;
  const segments = [
    { value: protein / total, color: '#3b82f6', label: 'Белки', light:'#60a5fa' },
    { value: fat / total, color: '#f59e0b', label: 'Жиры', light:'#fbbf24' },
    { value: carbs / total, color: '#a78bfa', label: 'Углеводы', light:'#c4b5fd' },
  ];
  const cx = size / 2, cy = size / 2, r = size / 2 - 9, strokeW = size * 0.18;
  let offset = 0;
  const arcs = segments.map((s) => {
    const dash = s.value * Math.PI * 2 * r;
    const gap = dash > 0 ? Math.PI * 2 * r - dash : 0;
    const arc = { dash, gap, color: s.color, light:s.light, offset, label: s.label, pct: Math.round(s.value * 100) };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position:'relative', filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          {arcs.map((a, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={strokeW}
              strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={-a.offset}
              transform={`rotate(-90 ${cx} ${cy})`} opacity={a.dash > 0 ? 1 : 0.12}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)', filter: a.dash>0 ? `drop-shadow(0 2px 6px ${a.color}40)` : 'none' }} />
          ))}
          <circle cx={cx} cy={cy} r={r - strokeW/2 -2} fill="#18181b" />
          <text x={cx} y={cy - 5} textAnchor="middle" fill="#fff" fontSize={size * 0.17} fontWeight={800} letterSpacing={-0.5}>
            {Math.round(protein + fat + carbs)}г
          </text>
          <text x={cx} y={cy + size * 0.13} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={size * 0.09} fontWeight={600} letterSpacing={0.3}>
            БЖУ
          </text>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 8 }}>
        {segments.map((s, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding:'3px 7px', borderRadius:999, background:`${s.color}12`, border:`1px solid ${s.color}18` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, boxShadow:`0 0 6px ${s.color}60` }} />
            <span style={{ color:'rgba(255,255,255,0.75)', fontWeight:600 }}>{s.label}</span>
            <span style={{ color:s.color, fontWeight:800 }}>{Math.round(s.value * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const Sparkline: React.FC<{ data: number[]; color: string; height?: number; label: string; unit: string }> = ({ data, color, height = 42, label, unit }) => {
  const valid = data.filter(d => d > 0);
  if (valid.length < 2) return (
    <div style={{ textAlign: 'center', padding: 8, minWidth:110, background:'rgba(255,255,255,0.02)', borderRadius:12, border:'1px dashed rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontWeight:600, letterSpacing:0.4, textTransform:'uppercase' as const }}>{label}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>—</div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)' }}>нужно ≥2 дней</div>
    </div>
  );
  const max = Math.max(...valid, 1);
  const min = Math.min(...valid);
  const range = max - min || 1;
  const w = 150, h = height, padX = 6, padY = 6;
  const scaleX = (w - padX * 2) / Math.max(valid.length - 1, 1);
  const scaleY = (h - padY * 2) / range;
  const points = valid.map((v, i) => {
    const x = padX + i * scaleX;
    const y = h - padY - (v - min) * scaleY;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `${padX},${h-padY} ${points} ${padX + (valid.length-1)*scaleX},${h-padY}`;

  const avg = Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  const trend = valid.length >= 2 ? ((valid[valid.length - 1] - valid[0]) / Math.max(valid[0],1) * 100) : 0;
  const isUp = trend > 2, isDown = trend < -2;

  return (
    <div style={{ textAlign: 'center', padding: '8px 10px', background:'rgba(255,255,255,0.02)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', minWidth:150 }}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', marginBottom: 4, fontWeight:700, letterSpacing:0.4, textTransform:'uppercase' as const, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
        <span style={{ width:6, height:6, borderRadius:4, background:color, boxShadow:`0 0 6px ${color}80` }} /> {label}
      </div>
      <svg width={w} height={h} style={{ overflow: 'visible', display:'block', margin:'0 auto' }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${color.replace('#','')})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'all 0.4s ease', filter:`drop-shadow(0 2px 4px ${color}30)` }} />
        {valid.map((v, i) => {
          const isEdge = i===0 || i===valid.length-1;
          const x = padX + i * scaleX, y = h - padY - (v - min) * scaleY;
          if (!isEdge && valid.length>6 && i%2!==0) return null;
          return <g key={i}>
            <circle cx={x} cy={y} r={isEdge?3:2} fill={color} stroke="#18181b" strokeWidth={1.5} style={{ filter:`drop-shadow(0 1px 3px ${color}60)` }} />
          </g>;
        })}
      </svg>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:2 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{avg}<span style={{ fontSize:8, fontWeight:600, color:'rgba(255,255,255,0.5)' }}>{unit}</span></span>
        {trend !== 0 && (
          <span style={{ fontSize: 8, fontWeight:700, padding:'2px 6px', borderRadius:999, background: isUp ? 'rgba(239,68,68,0.12)' : isDown ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', color: isUp ? '#ef4444' : isDown ? '#22c55e' : 'rgba(255,255,255,0.6)', border:`1px solid ${isUp ? 'rgba(239,68,68,0.18)' : isDown ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)'}` }}>
            {isUp ? '↗' : isDown ? '↘' : '→'} {trend > 0 ? '+' : ''}{Math.round(trend)}%
          </span>
        )}
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
      if (date < formatDate(cutOff) || date > selectedDate) return;
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
      .slice(0, 8);
  }, [diaryData, selectedDate]);

  if (freq.length < 2) return (
    <div style={{ ...cardStyle, textAlign: 'center', padding:20 }}>
      <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', fontSize:16 }}>📊</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight:600 }}>Ещё нет статистики</div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop:4 }}>Запиши минимум 2 разных продукта — покажем топ</div>
    </div>
  );

  const maxCount = Math.max(...freq.map(f => f.count), 1);
  const barGradients = [
    'linear-gradient(90deg,#3b82f6,#60a5fa)', 'linear-gradient(90deg,#8b5cf6,#a78bfa)', 'linear-gradient(90deg,#f59e0b,#fbbf24)',
    'linear-gradient(90deg,#10b981,#34d399)', 'linear-gradient(90deg,#ef4444,#f87171)', 'linear-gradient(90deg,#f97316,#fb923c)',
    'linear-gradient(90deg,#06b6d4,#22d3ee)', 'linear-gradient(90deg,#ec4899,#f472b6)',
  ];

  return (
    <div style={cardStyle}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🏆</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing:-0.2 }}>Топ продуктов</div>
          <div style={{ fontSize: 9, color:'rgba(255,255,255,0.45)' }}>30 дней • частота</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:9, padding:'3px 8px', borderRadius:999, background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.18)', fontWeight:700 }}>{freq.length} поз.</span>
      </div>
      {freq.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', width: 88, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight:500 }}
            title={`${f.name} • ${f.count} раз • ${Math.round(f.totalKcal)} ккал`}>
            {f.name.length > 16 ? f.name.slice(0, 15) + '…' : f.name}
          </span>
          <div style={{ flex: 1, height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', padding:1, boxShadow:'inset 0 1px 2px rgba(0,0,0,0.2)' }}>
            <div style={{ height: '100%', width: `${Math.round(f.count / maxCount * 100)}%`, borderRadius: 7, background: barGradients[i % barGradients.length], transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)', minWidth: 6, boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', minWidth: 22, textAlign: 'right', background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:6 }}>{f.count}</span>
          <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', minWidth:42 }}>{Math.round(f.totalKcal)} ккал</span>
        </div>
      ))}
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 6, textAlign:'center', padding:'6px 8px', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px solid rgba(255,255,255,0.03)' }}>
        Частота за последние 30 дней • тап — быстро добавить (в вкладке ➕)
      </div>
    </div>
  );
};

const MacroBalanceGauge: React.FC<{ actual: number; target: number; label: string; color: string }> = ({ actual, target, label, color }) => {
  const pct = target > 0 ? Math.min(100, Math.round(actual / target * 100)) : 0;
  const isOk = pct >= 85 && pct <= 115;
  const isOver = pct > 115;
  const displayColor = isOk ? color : isOver ? '#ef4444' : '#f59e0b';
  const bgColor = isOk ? `${color}12` : isOver ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
  const borderColor = isOk ? `${color}18` : isOver ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
  return (
    <div style={{ textAlign: 'center', padding:'8px 6px', borderRadius:12, background:bgColor, border:`1px solid ${borderColor}`, minWidth:74 }}>
      <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto' }}>
        <svg width={56} height={56} viewBox="0 0 56 56" style={{ filter: `drop-shadow(0 2px 6px ${displayColor}20)` }}>
          <circle cx={28} cy={28} r={22} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
          <circle cx={28} cy={28} r={22} fill="none" stroke={displayColor}
            strokeWidth={4} strokeDasharray={`${pct * 1.38} ${276 - pct * 1.38}`}
            strokeDashoffset={0} transform="rotate(-90 28 28)" strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
          <text x={28} y={30} textAnchor="middle" fill={displayColor} fontSize={13} fontWeight={800} letterSpacing={-0.3}>
            {pct}%
          </text>
        </svg>
        <div style={{ position:'absolute', top:-2, right:-2, width:14, height:14, borderRadius:7, background: isOk ? color : isOver ? '#ef4444' : '#f59e0b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, boxShadow:'0 2px 6px rgba(0,0,0,0.2)' }}>
          {isOk ? '✓' : isOver ? '↑' : '↓'}
        </div>
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', marginTop: 4, fontWeight:600, letterSpacing:0.3, textTransform:'uppercase' as const }}>{label}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: displayColor }}>{Math.round(actual)}/{target}</div>
    </div>
  );
};

export const NutritionDiaryCharts: React.FC<Props> = ({ dayMeals, dayTotals, targets, diaryData, selectedDate, refreshKey }) => {
  const hasData = Object.keys(dayMeals).length > 0;

  function computeWeekly(diaryData: Record<string, any>, field: string): number[] {
    const vals: number[] = [];
    const current = new Date(selectedDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(current);
      d.setDate(d.getDate() - i);
      const ds = formatDate(d);
      const day = diaryData[ds];
      let total = 0;
      if (day?.meals) {
        Object.values(day.meals).forEach((items: any) => {
          (items || []).forEach((item: any) => { total += item[field] || 0; });
        });
      }
      vals.push(total);
    }
    return vals;
  }

  const weeklyKcal = useMemo(() => computeWeekly(diaryData, 'kcal'), [diaryData, selectedDate, refreshKey]);
  const weeklyProtein = useMemo(() => computeWeekly(diaryData, 'p'), [diaryData, selectedDate, refreshKey]);

  if (!hasData) return null;

  return (
    <div className="nut-diarycharts" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Macro distribution donut + gauge cards */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap', padding:16 }}>
        <DonutChart protein={dayTotals.p} fat={dayTotals.f} carbs={dayTotals.c} size={92} />
        <div style={{ display: 'flex', gap: 8 }}>
          <MacroBalanceGauge actual={dayTotals.kcal} target={targets?.kcal || 2500} label="Ккал" color="#00e68a" />
          <MacroBalanceGauge actual={dayTotals.p} target={targets?.protein || 160} label="Белки" color="#3b82f6" />
        </div>
      </div>

      {/* Weekly trend sparklines — enhanced */}
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap:8, padding:12 }}>
        <Sparkline data={weeklyKcal} color="#00e68a" label="Ккал • 7 дн" unit="" />
        <Sparkline data={weeklyProtein} color="#3b82f6" label="Белок • 7 дн" unit="г" />
        <div style={{ textAlign: 'center', padding: '10px 14px', background:'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.06))', borderRadius:12, border:'1px solid rgba(139,92,246,0.15)', minWidth:88 }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', marginBottom: 4, fontWeight:700, letterSpacing:0.4, textTransform:'uppercase' as const }}>Приёмов</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#a78bfa', lineHeight:1 }}>{Object.keys(dayMeals).length}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop:2 }}>за день</div>
        </div>
      </div>

      {/* Food frequency */}
      <FoodFrequencyChart diaryData={diaryData} selectedDate={selectedDate} />
    </div>
  );
};
