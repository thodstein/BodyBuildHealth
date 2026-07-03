import React, { useState, useMemo } from 'react';
import type { TimelineWeekData } from '../../../engines/support-plan';

interface RiskTimelineChartProps {
  timeline: TimelineWeekData[];
}

const SYS_COLORS: Record<string, string> = {
  cardio: '#ef4444',
  hepatic: '#fbbf24',
  renal: '#a78bfa',
  cns: '#60a5fa',
  reproductive: '#f472b6',
  hematologic: '#22c55e',
};

const SYS_LABELS: Record<string, string> = {
  cardio: '❤️ ССС',
  hepatic: '🫁 Печень',
  renal: '🫘 Почки',
  cns: '🧠 ЦНС',
  reproductive: '🧬 Репрод.',
  hematologic: '🩸 Гематол.',
};

export const RiskTimelineChart: React.FC<RiskTimelineChartProps> = ({ timeline }) => {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [showAfter, setShowAfter] = useState(false);

  if (!timeline || timeline.length === 0) return null;

  const maxWeek = timeline.length;
  const weekData = timeline[Math.min(selectedWeek - 1, maxWeek - 1)];

  // SVG chart dimensions
  const W = Math.min(340, Math.max(200, maxWeek * 18));
  const H = 120;
  const PAD_L = 24;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 16;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const xForWeek = (w: number) => PAD_L + ((w - 1) / Math.max(1, maxWeek - 1)) * chartW;
  const yForPct = (p: number) => PAD_T + chartH - (p / 100) * chartH;

  // Build SVG paths per system
  const systemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of timeline) {
      const key = showAfter ? 'organAfterPercents' : 'organPercents';
      for (const k of Object.keys(t[key])) ids.add(k);
    }
    return [...ids].filter(id => SYS_COLORS[id]);
  }, [timeline, showAfter]);

  // Overall line
  const overallPath = useMemo(() => {
    const key = showAfter ? 'overallAfter' : 'overallRaw';
    return timeline.map((t, i) => `${i === 0 ? 'M' : 'L'} ${xForWeek(t.week).toFixed(1)} ${yForPct(t[key]).toFixed(1)}`).join(' ');
  }, [timeline, showAfter, maxWeek]);

  // Drug concentration bars (bottom)
  const allDrugs = useMemo(() => {
    const ds = new Set<string>();
    for (const t of timeline) for (const d of t.activeDrugs) ds.add(d);
    return [...ds];
  }, [timeline]);

  const drugColors = useMemo(() => {
    const palette = ['#00e68a', '#818cf8', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
    const m: Record<string, string> = {};
    allDrugs.forEach((d, i) => { m[d] = palette[i % palette.length]; });
    return m;
  }, [allDrugs]);

  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>📈 Динамика риска по неделям</span>
        <button
          onClick={() => setShowAfter(!showAfter)}
          style={{
            fontSize: 8, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: showAfter ? 'rgba(0,230,138,0.15)' : 'rgba(239,68,68,0.12)',
            color: showAfter ? '#00e68a' : '#ef4444',
          }}
        >
          {showAfter ? 'После поддержки' : 'До поддержки'}
        </button>
      </div>

      {/* SVG Chart */}
      <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ display: 'block', maxHeight: 160 }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(p => (
          <g key={p}>
            <line x1={PAD_L} y1={yForPct(p)} x2={W - PAD_R} y2={yForPct(p)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
            <text x={2} y={yForPct(p) + 3} fontSize={7} fill="rgba(255,255,255,0.3)">{p}</text>
          </g>
        ))}

        {/* Overall line (thick) */}
        <path d={overallPath} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} strokeDasharray="3,2" />

        {/* Per-system lines */}
        {systemIds.map(sysId => {
          const key = showAfter ? 'organAfterPercents' : 'organPercents';
          const path = timeline.map((t, i) => {
            const v = t[key][sysId] || 0;
            return `${i === 0 ? 'M' : 'L'} ${xForWeek(t.week).toFixed(1)} ${yForPct(v).toFixed(1)}`;
          }).join(' ');
          return <path key={sysId} d={path} fill="none" stroke={SYS_COLORS[sysId]} strokeWidth={1} opacity={0.7} />;
        })}

        {/* Drug concentration bars at bottom */}
        {allDrugs.map((drug, di) => {
          const barH = 3;
          const yOffset = H + 2 + di * (barH + 1);
          return timeline.map((t, i) => {
            const conc = t.drugConcentrations[drug] || 0;
            if (conc <= 0) return null;
            const x = xForWeek(t.week) - 4;
            const w = 8;
            const h = barH * conc;
            return <rect key={`${drug}-${i}`} x={x} y={yOffset + (barH - h)} width={w} height={h} fill={drugColors[drug]} opacity={0.6} rx={1} />;
          });
        })}

        {/* Selected week marker */}
        <line x1={xForWeek(selectedWeek)} y1={PAD_T} x2={xForWeek(selectedWeek)} y2={PAD_T + chartH} stroke="#00e68a" strokeWidth={1} opacity={0.6} />
        <circle cx={xForWeek(selectedWeek)} cy={yForPct(showAfter ? weekData?.overallAfter || 0 : weekData?.overallRaw || 0)} r={3} fill="#00e68a" />

        {/* Week labels (every few weeks) */}
        {timeline.filter((_, i) => i % Math.max(1, Math.ceil(maxWeek / 8)) === 0 || i === maxWeek - 1).map(t => (
          <text key={t.week} x={xForWeek(t.week) - 4} y={H + 16} fontSize={6} fill="rgba(255,255,255,0.3)">{t.week}</text>
        ))}
      </svg>

      {/* Drug legend */}
      {allDrugs.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {allDrugs.map(d => (
            <span key={d} style={{ fontSize: 7, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: drugColors[d], display: 'inline-block' }} />
              {d}
            </span>
          ))}
        </div>
      )}

      {/* System legend */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {systemIds.map(id => (
          <span key={id} style={{ fontSize: 7, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <span style={{ width: 8, height: 2, background: SYS_COLORS[id], display: 'inline-block' }} />
            {SYS_LABELS[id] || id}
          </span>
        ))}
        <span style={{ fontSize: 7, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <span style={{ width: 8, height: 2, background: 'rgba(255,255,255,0.5)', borderTop: '1px dashed', display: 'inline-block' }} />
          Общий
        </span>
      </div>

      {/* Week slider */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>
          <span>Неделя: <b style={{ color: 'var(--text)' }}>{selectedWeek}</b> / {maxWeek}</span>
          {weekData && weekData.activeDrugs.length > 0 && (
            <span style={{ fontSize: 7, color: 'var(--accent)' }}>{weekData.activeDrugs.length} активн.</span>
          )}
        </div>
        <input
          type="range" min={1} max={maxWeek} value={selectedWeek}
          onChange={e => setSelectedWeek(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#00e68a', height: 16 }}
        />
      </div>

      {/* Selected week details */}
      {weekData && weekData.activeDrugs.length > 0 ? (
        <div>
          {/* Overall gauge */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>Риск до</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: weekData.overallRaw > 50 ? '#ef4444' : weekData.overallRaw > 25 ? '#fbbf24' : '#22c55e' }}>
                {weekData.overallRaw}%
              </div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(0,230,138,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>После поддержки</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: weekData.overallAfter > 50 ? '#ef4444' : weekData.overallAfter > 25 ? '#fbbf24' : '#22c55e' }}>
                {weekData.overallAfter}%
              </div>
            </div>
          </div>

          {/* Active drugs with concentration */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 2 }}>Активные препараты:</div>
            {weekData.activeDrugs.map(d => {
              const conc = weekData.drugConcentrations[d] || 0;
              const phase = conc >= 0.95 ? 'стационар' : conc >= 0.5 ? 'накопление' : conc >= 0.1 ? 'распад' : 'следы';
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: drugColors[d], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 8, color: 'var(--text)', flex: 1 }}>{d}</span>
                  <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${conc * 100}%`, background: drugColors[d], borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 7, color: 'var(--text-dim)', minWidth: 32, textAlign: 'right' }}>{Math.round(conc * 100)}%</span>
                  <span style={{ fontSize: 7, color: 'var(--accent)', minWidth: 40 }}>{phase}</span>
                </div>
              );
            })}
          </div>

          {/* Per-system bars */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 2 }}>Риск по системам:</div>
            {systemIds.map(id => {
              const raw = weekData.organPercents[id] || 0;
              const after = weekData.organAfterPercents[id] || 0;
              const c = raw >= 60 ? '#ef4444' : raw >= 30 ? '#fbbf24' : '#22c55e';
              return (
                <div key={id} style={{ marginBottom: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 1 }}>
                    <span style={{ color: 'var(--text)' }}>{SYS_LABELS[id] || id}</span>
                    <span style={{ color: c, fontWeight: 600 }}>{raw}% → {after}%</span>
                  </div>
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(raw, 100)}%`, background: c, borderRadius: 1 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 8, fontSize: 9, color: 'var(--text-dim)' }}>
          Нет активных препаратов на неделе {selectedWeek}
        </div>
      )}
    </div>
  );
};
