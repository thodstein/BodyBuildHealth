/**
 * FatigueIndexTab.tsx — Fatigue Index: из sRPE-истории недельная нагрузка,
 * монотонность, strain, ACWR с трендом и зонами. Дополнение к TrainingLoadCalculator.
 * Использует pro/training-load.engine.
 */
import React, { useMemo, useState } from 'react';
import { loadSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import {
  toDailyLoads,
  acuteChronicRatio,
  weeklyMonotony,
  ewma,
  type DayLoad,
} from '../../../engines/pro/training-load.engine';
import { PopupSelect, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };

const ZONE_META: Record<string, { label: string; color: string }> = {
  undertrained: { label: 'Недотренированность', color: '#3b82f6' },
  optimal: { label: 'Оптимальная зона', color: '#22c55e' },
  caution: { label: 'Осторожно', color: '#eab308' },
  dangerous: { label: 'Опасная зона', color: '#ef4444' },
};

// Тренд acute-нагрузки: последние N дней → угол наклона (slope)
function linearTrend(days: DayLoad[], windowDays: number): { slope: number; trend: 'up' | 'flat' | 'down'; pct: number } {
  const last = days.slice(-windowDays).map(d => d.load);
  if (last.length < 2) return { slope: 0, trend: 'flat', pct: 0 };
  const n = last.length;
  const meanX = (n - 1) / 2;
  const meanY = last.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - meanX) * (last[i] - meanY); den += (i - meanX) ** 2; }
  const slope = den > 0 ? num / den : 0;
  const pct = meanY > 0 ? Math.round((slope / meanY) * 100 * 10) / 10 : 0;
  return { slope, trend: Math.abs(pct) < 3 ? 'flat' : pct > 0 ? 'up' : 'down', pct };
}

// Последние 6 недельную нагрузку
function weeklyLoads(dailyLoads: DayLoad[], weeks = 6): { weekIdx: number; load: number; days: number; start: string }[] {
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  if (sorted.length === 0) return [];
  const last = sorted[sorted.length - 1].date;
  const result: { weekIdx: number; load: number; days: number; start: string }[] = [];
  for (let w = weeks; w >= 1; w--) {
    const end = new Date(last); end.setDate(end.getDate() - (w - 1) * 7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const inWeek = sorted.filter(d => d.date >= startStr && d.date <= endStr);
    result.push({ weekIdx: weeks - w + 1, load: inWeek.reduce((s, d) => s + d.load, 0), days: inWeek.length, start: startStr });
  }
  return result;
}

const trendOpts = [
  { id: '7', label: '7 дней', desc: 'острая (недельная) динамика' },
  { id: '14', label: '14 дней', desc: 'среднесрочный тренд' },
  { id: '28', label: '28 дней', desc: 'хроническая динамика' },
];

export const FatigueIndexTab: React.FC = () => {
  const [sessions] = useState<SRPESession[]>(() => loadSRPESessions());
  const [trendDays, setTrendDays] = useState<number>(7);

  const dailyLoads = useMemo(() => toDailyLoads(sessions), [sessions]);

  // ACWR для текущего последнего дня
  const acwr = useMemo(() => acuteChronicRatio(dailyLoads), [dailyLoads]);

  // Монотонность/strain за последнюю неделю
  const mon = useMemo(() => weeklyMonotony(dailyLoads), [dailyLoads]);

  // Тренды
  const trend = useMemo(() => linearTrend(dailyLoads, trendDays), [dailyLoads, trendDays]);
  const trendAcute = useMemo(() => linearTrend(dailyLoads, 7), [dailyLoads]);
  const trendChronic = useMemo(() => linearTrend(dailyLoads, 14), [dailyLoads]);

  // 6 недельных сводок
  const weeks = useMemo(() => weeklyLoads(dailyLoads, 6), [dailyLoads]);

  // EWMA acute/chronic (Rollinson)
  const loads7 = dailyLoads.slice(-7).map(d => d.load);
  const loads28 = dailyLoads.slice(-28).map(d => d.load);
  const ewmaAcute = useMemo(() => ewma(loads7.length > 0 ? [...loads7].reverse() : [], 2 / (7 + 1)), [dailyLoads]);
  const ewmaChronic = useMemo(() => ewma(loads28.length > 0 ? [...loads28].reverse() : [], 2 / (28 + 1)), [dailyLoads]);

  if (sessions.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={H}>📉 Индекс усталости (Fatigue Index)</div>
        <div style={CARD}>
          <div style={SMALL}>Нет записанных sRPE сессий. Добавьте тренировки в калькулятор «Нагрузка/тоннаж» (вкладка «⚖️») для расчёта усталости.</div>
        </div>
      </div>
    );
  }

  // SVG шкала ACWR (dial)
  const acwrPct = Math.min(100, Math.max(0, (acwr.ratio / 2) * 100));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>📉 Индекс усталости (Fatigue Index из sRPE)</div>
      <div style={{ ...SMALL, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
        Источник: sRPE-дневник. Метрики: недельная нагрузка (sRPE × минуты), монотонность (mean/stdev), strain (mono × total),
        ACWR (острая 7д / хроническая 28д), EWMA Rollinson, тренд последних дней, графическая шкала опасности.
      </div>

      {/* ACWR полукруглая шкала */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📊 Острая/хроническая нагрузка (ACWR)</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
          <svg width="220" height="120" viewBox="0 0 220 120">
            {/* Зоны */}
            <path d="M10,110 A100,100 0 0,1 110,10" stroke="#3b82f6" strokeWidth="14" fill="none" strokeDasharray="40 999" />
            <path d="M10,110 A100,100 0 0,1 70,22" stroke="#22c55e" strokeWidth="14" fill="none" strokeDasharray="55 999" strokeDashoffset="-40" />
            <path d="M70,22 A100,100 0 0,1 95,14" stroke="#eab308" strokeWidth="14" fill="none" strokeDasharray="15 999" strokeDashoffset="-95" />
            <path d="M95,14 A100,100 0 0,1 110,10" stroke="#ef4444" strokeWidth="14" fill="none" strokeDasharray="20 999" strokeDashoffset="-110" />
            {/* Стрелка */}
            {(() => {
              const ang = Math.PI - (acwrPct / 100) * Math.PI; // 0..π
              const x = 110 - Math.cos(ang) * 100, y = 110 - Math.sin(ang) * 100;
              return <><line x1="110" y1="110" x2={x} y2={y} stroke="#fff" strokeWidth="3" /><circle cx={x} cy={y} r="5" fill={ZONE_META[acwr.zone].color} /></>;
            })()}
          </svg>
          <div style={{ fontSize: 22, fontWeight: 800, color: ZONE_META[acwr.zone].color }}>{acwr.ratio}</div>
          <div style={{ fontSize: 11, color: ZONE_META[acwr.zone].color }}>{ZONE_META[acwr.zone].label}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: 9, color: DIM }}>Острая (7д)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>{Math.round(acwr.acute)} AU/дн</div>
          </div>
          <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 9, color: DIM }}>Хроническая (28д)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{Math.round(acwr.chronic)} AU/дн</div>
          </div>
        </div>
      </div>

      {/* Монотонность/strain */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <MetricCard title="Недельная нагрузка" icon="📊" accent={ACCENT}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{mon.weeklyLoad}</div>
          <div style={SMALL}>AU (7д ср.)</div>
        </MetricCard>
        <MetricCard title="Монотонность" icon="🔁" accent={mon.monotony > 2 ? '#ef4444' : ACCENT}>
          <div style={{ fontSize: 18, fontWeight: 800, color: mon.monotony > 2 ? '#ef4444' : ACCENT }}>{mon.monotony}</div>
          <div style={SMALL}>{mon.monotony > 2 ? '>2 — однообразие!' : 'норма'}</div>
        </MetricCard>
        <MetricCard title="Strain" icon="🔥" accent={mon.strain > 1000 ? '#ef4444' : ACCENT}>
          <div style={{ fontSize: 18, fontWeight: 800, color: mon.strain > 1000 ? '#ef4444' : ACCENT }}>{mon.strain}</div>
          <div style={SMALL}>{mon.strain > 1000 ? '>1000 — стресс!' : 'норма'}</div>
        </MetricCard>
        <MetricCard title="StDev" icon="📐" accent={ACCENT}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{mon.stdev}</div>
          <div style={SMALL}>разброс (AU/дн)</div>
        </MetricCard>
      </div>

      {/* EWMA */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📈 EWMA (Rollinson/Gabbett)</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.75)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span>EWMA острая (α=2/8):</span><b style={{ color: '#3b82f6' }}>{Math.round(ewmaAcute)}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.75)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span>EWMA хроническая (α=2/29):</span><b style={{ color: '#fff' }}>{Math.round(ewmaChronic)}</b>
        </div>
      </div>

      {/* Тренды */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📈 Тренд нагрузки</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={{ fontSize: 9, color: DIM, marginBottom: 3 }}>Окно тренда</div>
            <PopupSelect label="" value={String(trendDays)} options={trendOpts} onChange={v => setTrendDays(+v)} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: DIM, marginBottom: 3 }}>Slope (AU/дн)</div>
            <div style={{ ...IN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: trend.trend === 'up' ? '#ef4444' : trend.trend === 'down' ? '#3b82f6' : '#fff' }}>{trend.slope.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: DIM, marginBottom: 3 }}>Тренд %</div>
            <div style={{ ...IN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: trend.trend === 'up' ? '#ef4444' : trend.trend === 'down' ? '#3b82f6' : '#fff', fontWeight: 700 }}>
              {trend.pct > 0 ? '↑' : trend.pct < 0 ? '↓' : '—'} {Math.abs(trend.pct)}%
            </div>
          </div>
        </div>
        <TrendBar acuteTrend={trendAcute} chronicTrend={trendChronic} />
      </div>

      {/* Понедельная сводка за 6 недель */}
      <ExpandableCard title="📅 Понедельная сводка (6 недель)" accent={ACCENT} short={weeks.length > 0 ? `${weeks.length} недель · последняя ${weeks[weeks.length - 1].load} AU` : 'Нет данных'}>
        {weeks.length === 0 ? (
          <div style={SMALL}>Недостаточно данных (нужно ≥7 дней).</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {weeks.map(w => {
              const max = Math.max(1, ...weeks.map(x => x.load));
              const pct = (w.load / max) * 100;
              return (
                <div key={w.weekIdx} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                    <span>Нед {w.weekIdx} (с {w.start})</span>
                    <span><b style={{ color: ACCENT }}>{w.load} AU</b> · {w.days} трен.дн.</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${ACCENT}88, ${ACCENT})`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ExpandableCard>

      {/* Интерпретация */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>💾 Интерпретация</div>
        {acwr.ratio > 1.5 && <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🚨 ACWR {acwr.ratio} &gt; 1.5 — опасная зона: снизить объём на 20-30%, высокий риск травмы/перетренированности.</div>}
        {acwr.ratio < 0.8 && <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>⚠ ACWR {acwr.ratio} &lt; 0.8 — недотренированность: можно плавно ↑ объём.</div>}
        {acwr.ratio >= 0.8 && acwr.ratio <= 1.3 && <div style={{ padding: 8, borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>✅ ACWR {acwr.ratio} в оптимальной зоне (0.8-1.3).</div>}
        {mon.monotony > 2 && <div style={{ padding: 8, borderRadius: 8, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>⚠ Монотонность &gt; 2: однообразная нагрузка, добавьте вариативность/восстановление.</div>}
        {trend.trend === 'up' && trend.pct > 10 && <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', fontSize: 11, marginBottom: 6 }}>📈 Тренд растёт ({trend.pct}%): плавный набор нагрузки, следите за ACWR.</div>}
        {trend.trend === 'down' && trend.pct < -10 && <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: 11, marginBottom: 6 }}>📉 Тренд падает ({trend.pct}%): разгрузка или недогруз.</div>}
      </div>

      <div style={{ fontSize: 9, color: DIM, marginTop: 12, lineHeight: 1.4 }}>
        Foster C., Impellizzeri F. (2017) — sRPE × длительность = AU. EWMA: Rollisson et al. — α=2/(N+1). ACWR zones (Gabbett): 0.8-1.3 optimum, &gt;1.5 опасно. Монотонность &gt;2 — высокий риск перетрена (Foster).
      </div>
    </div>
  );
};

function TrendBar({ acuteTrend, chronicTrend }: { acuteTrend: { pct: number; trend: string }; chronicTrend: { pct: number; trend: string } }) {
  const mk = (t: { pct: number; trend: string }, label: string, color: string) => (
    <div style={{ padding: 8, borderRadius: 8, background: `${color}0a`, border: `1px solid ${color}22`, textAlign: 'center' as const }}>
      <div style={{ fontSize: 9, color: DIM }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{t.trend === 'up' ? '↑' : t.trend === 'down' ? '↓' : '—'} {Math.abs(t.pct)}%</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {mk(acuteTrend, 'Острая 7д', acuteTrend.trend === 'up' ? '#ef4444' : acuteTrend.trend === 'down' ? '#3b82f6' : '#fff')}
      {mk(chronicTrend, 'Хроническая 14д', chronicTrend.trend === 'up' ? '#eab308' : chronicTrend.trend === 'down' ? '#22c55e' : '#fff')}
    </div>
  );
}

export default FatigueIndexTab;