import React, { useState } from 'react';

const BP_DIARY_KEY = 'he_bp_diary';

interface BPEntry { date: string; systolic: number; diastolic: number; hr: number; }

function getBPDiary(): BPEntry[] {
  try { return JSON.parse(localStorage.getItem(BP_DIARY_KEY) || '[]'); } catch { return []; }
}
function saveBPDiary(log: BPEntry[]) {
  try { localStorage.setItem(BP_DIARY_KEY, JSON.stringify(log)); } catch {}
}

const apple = {
  accent: '#00e68a',
  accentDim: 'rgba(0,230,138,0.08)',
  accentBorder: '1px solid rgba(0,230,138,0.2)',
  textPrimary: '#fff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textDim: 'rgba(255,255,255,0.35)',
  glassBg: 'rgba(255,255,255,0.03)',
  glassBorder: '1px solid rgba(255,255,255,0.06)',
  gradientGreen: 'linear-gradient(135deg, #00e68a, #00c771)',
  sliderBg: 'rgba(255,255,255,0.08)',
};
const glassCard: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)', borderRadius: 12, padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.04)',
};
const appleInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 12, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};
const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 16, fontSize: 10, fontWeight: 700,
  whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
  background: active ? apple.accentDim : 'rgba(255,255,255,0.03)',
  color: active ? apple.accent : apple.textDim,
  border: active ? apple.accentBorder : '1px solid rgba(255,255,255,0.06)',
  fontFamily: 'inherit',
});

/** Moving average helper */
function movingAvg(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = 0; j < window; j++) sum += values[i - j];
    return sum / window;
  });
}

/** Monthly grouping */
interface MonthGroup {
  yearKey: string;
  monthKey: string;
  monthLabel: string;
  entries: BPEntry[];
  avgS: number;
  avgD: number;
  avgH: number;
  minS: number;
  maxS: number;
  minD: number;
  maxD: number;
  count: number;
}

function groupByMonth(entries: BPEntry[]): MonthGroup[] {
  const map = new Map<string, BPEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  const groups: MonthGroup[] = [];
  for (const [key, list] of map) {
    const [year, month] = key.split('-');
    const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    const vals = list.map(e => e.systolic);
    const diVals = list.map(e => e.diastolic);
    const hrVals = list.map(e => e.hr);
    const avg = (arr: number[]) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
    groups.push({
      yearKey: year, monthKey: key,
      monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      entries: list.sort((a, b) => b.date.localeCompare(a.date)),
      avgS: avg(vals), avgD: avg(diVals), avgH: avg(hrVals),
      minS: Math.min(...vals), maxS: Math.max(...vals),
      minD: Math.min(...diVals), maxD: Math.max(...diVals),
      count: list.length,
    });
  }
  return groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export const BPDiaryTab: React.FC = () => {
  const [entries, setEntries] = useState<BPEntry[]>(getBPDiary);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [hr, setHr] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [savedMsg, setSavedMsg] = useState('');
  const [viewMode, setViewMode] = useState<'journal' | 'archive' | 'stats'>('journal');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const showSaved = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const saveEntry = () => {
    const s = Math.round(Number(systolic));
    const d = Math.round(Number(diastolic));
    const h = Math.round(Number(hr));
    if (!s || !d || !h || isNaN(s) || isNaN(d) || isNaN(h) || s < 50 || s > 250 || d < 30 || d > 160 || h < 30 || h > 250) return;
    const entry: BPEntry = { date: entryDate || new Date().toISOString().slice(0, 10), systolic: s, diastolic: d, hr: h };
    let updated: BPEntry[];
    if (editIdx !== null) {
      updated = [...entries];
      updated[editIdx] = entry;
    } else {
      updated = [...entries, entry];
    }
    updated.sort((a, b) => a.date.localeCompare(b.date));
    setEntries(updated);
    saveBPDiary(updated);
    setSystolic('');
    setDiastolic('');
    setHr('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEditIdx(null);
    setShowForm(false);
    showSaved(editIdx !== null ? 'Обновлено' : 'Сохранено');
  };

  const deleteEntry = (idx: number) => {
    const updated = entries.filter((_, i) => i !== idx);
    setEntries(updated);
    saveBPDiary(updated);
    if (editIdx === idx) { setEditIdx(null); setShowForm(false); setSystolic(''); setDiastolic(''); setHr(''); }
    showSaved('Удалено');
  };

  const startEdit = (idx: number) => {
    const e = entries[idx];
    setSystolic(String(e.systolic));
    setDiastolic(String(e.diastolic));
    setHr(String(e.hr));
    setEntryDate(e.date);
    setEditIdx(idx);
    setShowForm(true);
  };

  // Filter by period
  const now = new Date();
  const cutoff = new Date(now);
  if (period === 'day') cutoff.setDate(cutoff.getDate() - 1);
  else if (period === 'week') cutoff.setDate(cutoff.getDate() - 7);
  else if (period === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
  else cutoff.setFullYear(cutoff.getFullYear() - 10);
  const filtered = entries.filter(e => new Date(e.date) >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const reversed = [...filtered].reverse();

  const avgS = filtered.length ? Math.round(filtered.reduce((s, e) => s + e.systolic, 0) / filtered.length) : 0;
  const avgD = filtered.length ? Math.round(filtered.reduce((s, e) => s + e.diastolic, 0) / filtered.length) : 0;
  const avgH = filtered.length ? Math.round(filtered.reduce((s, e) => s + e.hr, 0) / filtered.length) : 0;

  // Trend analysis
  const calcTrend = (values: number[]): { diff: number; trend: 'up' | 'down' | 'stable'; percent: number } => {
    if (values.length < 2) return { diff: 0, trend: 'stable', percent: 0 };
    const recent = values.slice(-3).reduce((s, v) => s + v, 0) / 3;
    const prev = values.slice(-6, -3).reduce((s, v) => s + v, 0) / 3;
    const diff = recent - prev;
    const pct = prev > 0 ? Math.round((diff / prev) * 100) : 0;
    return { diff: Math.round(diff), trend: diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable', percent: pct };
  };
  const sysVals = filtered.map(e => e.systolic);
  const diaVals = filtered.map(e => e.diastolic);
  const hrVals = filtered.map(e => e.hr);
  const sysTrend = calcTrend(sysVals);
  const diaTrend = calcTrend(diaVals);
  const hrTrend = calcTrend(hrVals);

  const trendColor = (t: 'up' | 'down' | 'stable', upBad: boolean) => {
    if (t === 'stable') return '#94a3b8';
    return upBad ? (t === 'up' ? '#ef4444' : '#4caf50') : (t === 'up' ? '#4caf50' : '#ef4444');
  };
  const trendArrow = (t: 'up' | 'down' | 'stable') => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';

  // Chart dimensions
  const chartH = 160;
  const chartW = 360;
  const padL = 32;
  const padR = 10;
  const padT = 14;
  const padB = 24;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const yMin = 40;
  const yMax = 210;
  const yRange = yMax - yMin;

  const xScale = (i: number) => padL + (filtered.length > 1 ? (i / (filtered.length - 1)) * innerW : innerW / 2);
  const yScale = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;
  const yScaleHr = (v: number) => padT + innerH - ((v - 40) / 120) * innerH;

  const sysLine = filtered.length > 0
    ? filtered.map((e, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(e.systolic).toFixed(1)}`).join(' ')
    : '';
  const diaLine = filtered.length > 0
    ? filtered.map((e, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(e.diastolic).toFixed(1)}`).join(' ')
    : '';
  const hrLine = filtered.length > 0
    ? filtered.map((e, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScaleHr(e.hr).toFixed(1)}`).join(' ')
    : '';
  // Moving averages
  const sysMA = movingAvg(sysVals, 3);
  const sysMALine = sysMA.length > 0
    ? sysMA.map((v, i) => v !== null ? `${i === sysMA.findIndex(x => x !== null) ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}` : null).filter(Boolean).join(' ')
    : '';
  const diaMA = movingAvg(diaVals, 3);
  const diaMALine = diaMA.length > 0
    ? diaMA.map((v, i) => v !== null ? `${i === diaMA.findIndex(x => x !== null) ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}` : null).filter(Boolean).join(' ')
    : '';

  const yTicks = [60, 80, 100, 120, 140, 160, 180, 200];

  const bpStatus = (s: number, d: number) =>
    s > 140 || d > 90 ? 'Повышено' : s > 130 || d > 80 ? 'Граница' : 'Норма';
  const bpColorVal = (s: number, d: number) =>
    s > 140 || d > 90 ? '#ef4444' : s > 130 || d > 80 ? '#f59e0b' : apple.accent;
  const bpIcon = (s: number, d: number) =>
    s > 140 || d > 90 ? '🔴' : s > 130 || d > 80 ? '🟡' : '🟢';

  // Health status summary
  const pctNormal = filtered.length > 0 ? Math.round(filtered.filter(e => e.systolic <= 130 && e.diastolic <= 80).length / filtered.length * 100) : 0;
  const pctBorderline = filtered.length > 0 ? Math.round(filtered.filter(e => (e.systolic > 130 && e.systolic <= 140) || (e.diastolic > 80 && e.diastolic <= 90)).length / filtered.length * 100) : 0;
  const pctHigh = filtered.length > 0 ? Math.round(filtered.filter(e => e.systolic > 140 || e.diastolic > 90).length / filtered.length * 100) : 0;

  // Monthly groups
  const monthGroups = groupByMonth(entries);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: apple.textPrimary }}>Давление и пульс</h3>
        <button onClick={() => { if (!showForm) { setEditIdx(null); setSystolic(''); setDiastolic(''); setHr(''); setEntryDate(new Date().toISOString().slice(0, 10)); } setShowForm(!showForm); }} style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: apple.accentDim, border: apple.accentBorder, color: apple.accent, fontFamily: 'inherit',
        }}>{showForm ? 'Отмена' : '+ Добавить'}</button>
      </div>

      {/* Save feedback */}
      {savedMsg && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontSize: 10, fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
          {savedMsg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ ...glassCard, marginBottom: 10 }}>
          {editIdx !== null && <div style={{ fontSize: 10, color: apple.accent, fontWeight: 600, marginBottom: 6 }}>Редактирование записи</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Дата</div>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={appleInput} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Систолическое</div>
              <input type="number" value={systolic} onChange={e => setSystolic(e.target.value)} placeholder="120" style={appleInput} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Диастолическое</div>
              <input type="number" value={diastolic} onChange={e => setDiastolic(e.target.value)} placeholder="80" style={appleInput} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Пульс</div>
              <input type="number" value={hr} onChange={e => setHr(e.target.value)} placeholder="70" style={appleInput} />
            </div>
          </div>
          <button onClick={saveEntry} style={{
            width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: apple.gradientGreen, color: '#000', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
          }}>{editIdx !== null ? 'Обновить' : 'Сохранить'}</button>
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {(['journal', 'archive', 'stats'] as const).map(m => (
          <button key={m} onClick={() => setViewMode(m)} style={pillBtn(viewMode === m)}>
            {m === 'journal' ? 'Дневник' : m === 'archive' ? 'Архив' : 'Статистика'}
          </button>
        ))}
      </div>

      {viewMode === 'journal' && (
        <>
          {/* Period + clear */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['day', 'week', 'month', 'all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                flex: 1, padding: '8px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: period === p ? apple.accentDim : 'rgba(255,255,255,0.03)',
                border: period === p ? apple.accentBorder : '1px solid rgba(255,255,255,0.06)',
                color: period === p ? apple.accent : 'rgba(255,255,255,0.6)', fontFamily: 'inherit',
              }}>{p === 'day' ? 'День' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Всё'}</button>
            ))}
            <button onClick={() => { if (window.confirm('Очистить все записи давления?')) { setEntries([]); localStorage.removeItem(BP_DIARY_KEY); showSaved('Все записи удалены'); } }} style={{
              padding: '8px 10px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontFamily: 'inherit',
            }}>Очистить</button>
          </div>

          {filtered.length > 0 ? <>
            {/* Average cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[
                { label: 'Среднее сист.', val: avgS, unit: 'мм', color: avgS > 140 ? '#ef4444' : avgS > 130 ? '#f59e0b' : apple.accent },
                { label: 'Среднее диаст.', val: avgD, unit: 'мм', color: avgD > 90 ? '#ef4444' : avgD > 80 ? '#f59e0b' : apple.accent },
                { label: 'Средний пульс', val: avgH, unit: 'уд/мин', color: avgH > 100 ? '#ef4444' : avgH > 85 ? '#f59e0b' : apple.accent },
              ].map((c, i) => (
                <div key={i} style={{ ...glassCard, textAlign: 'center', padding: 10 }}>
                  <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.val || '—'}</div>
                  <div style={{ fontSize: 8, color: apple.textDim }}>{c.unit}</div>
                </div>
              ))}
            </div>

            {/* Distribution bar */}
            <div style={{ ...glassCard, marginBottom: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: apple.textDim, fontWeight: 600 }}>Распределение</span>
                <span style={{ fontSize: 9, color: apple.textDim }}>{filtered.length} записей</span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                {pctNormal > 0 && <div style={{ flex: pctNormal, background: '#4caf50' }} />}
                {pctBorderline > 0 && <div style={{ flex: pctBorderline, background: '#f59e0b' }} />}
                {pctHigh > 0 && <div style={{ flex: pctHigh, background: '#ef4444' }} />}
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 8, color: apple.textDim }}>
                <span>Норма {pctNormal}%</span>
                <span>Граница {pctBorderline}%</span>
                <span>Повышено {pctHigh}%</span>
              </div>
            </div>

            {/* Trend cards */}
            {filtered.length >= 5 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                {[
                  { label: 'Систол.', val: `${sysTrend.diff >= 0 ? '+' : ''}${sysTrend.diff}`, unit: 'мм (3д)', color: trendColor(sysTrend.trend, true), arrow: trendArrow(sysTrend.trend) },
                  { label: 'Диастол.', val: `${diaTrend.diff >= 0 ? '+' : ''}${diaTrend.diff}`, unit: 'мм (3д)', color: trendColor(diaTrend.trend, true), arrow: trendArrow(diaTrend.trend) },
                  { label: 'Пульс', val: `${hrTrend.diff >= 0 ? '+' : ''}${hrTrend.diff}`, unit: 'уд/мин (3д)', color: trendColor(hrTrend.trend, true), arrow: trendArrow(hrTrend.trend) },
                ].map((c, i) => (
                  <div key={i} style={{ ...glassCard, textAlign: 'center', padding: '8px 4px' }}>
                    <div style={{ fontSize: 8, color: apple.textDim, marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.arrow} {c.val}</div>
                    <div style={{ fontSize: 7, color: apple.textDim }}>{c.unit}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Line chart */}
            {filtered.length >= 1 && (
              <div style={{ ...glassCard, marginBottom: 8, padding: '10px 8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: apple.textDim, fontWeight: 600 }}>Динамика</span>
                  <span style={{ fontSize: 8, color: apple.textDim }}>{filtered.length} записей</span>
                </div>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: chartH }}>
                  {yTicks.map(t => (
                    <text key={t} x={padL - 4} y={yScale(t) + 3} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize={7}>{t}</text>
                  ))}
                  {yTicks.map(t => (
                    <line key={t} x1={padL} y1={yScale(t)} x2={chartW - padR} y2={yScale(t)} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
                  ))}
                  {/* Reference lines */}
                  <line x1={padL} y1={yScale(120)} x2={chartW - padR} y2={yScale(120)} stroke="rgba(0,230,138,0.35)" strokeWidth={1} strokeDasharray="4,3" />
                  <text x={chartW - padR - 2} y={yScale(120) - 2} textAnchor="end" fill="rgba(0,230,138,0.35)" fontSize={6}>120</text>
                  <line x1={padL} y1={yScale(80)} x2={chartW - padR} y2={yScale(80)} stroke="rgba(0,230,138,0.25)" strokeWidth={1} strokeDasharray="4,3" />
                  <text x={chartW - padR - 2} y={yScale(80) - 2} textAnchor="end" fill="rgba(0,230,138,0.25)" fontSize={6}>80</text>
                  {/* Systolic area */}
                  {filtered.length >= 2 && (
                    <path d={`${sysLine} L${xScale(filtered.length - 1)},${yScale(yMin)} L${xScale(0)},${yScale(yMin)} Z`} fill="rgba(239,68,68,0.06)" />
                  )}
                  {/* Systolic line */}
                  {filtered.length >= 2 ? (
                    <>
                      <path d={sysLine} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      {filtered.map((e, i) => (
                        <circle key={i} cx={xScale(i)} cy={yScale(e.systolic)} r={2} fill="#ef4444" />
                      ))}
                    </>
                  ) : (
                    <circle cx={xScale(0)} cy={yScale(filtered[0].systolic)} r={4} fill="#ef4444" />
                  )}
                  {/* Systolic MA line */}
                  {filtered.length >= 4 && sysMALine && (
                    <path d={sysMALine} fill="none" stroke="#ef4444" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3,2" opacity={0.4} />
                  )}
                  {/* Diastolic line */}
                  {filtered.length >= 2 ? (
                    <>
                      <path d={diaLine} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      {filtered.map((e, i) => (
                        <circle key={i} cx={xScale(i)} cy={yScale(e.diastolic)} r={2} fill="#f59e0b" />
                      ))}
                    </>
                  ) : (
                    <circle cx={xScale(0)} cy={yScale(filtered[0].diastolic)} r={4} fill="#f59e0b" />
                  )}
                  {/* Diastolic MA line */}
                  {filtered.length >= 4 && diaMALine && (
                    <path d={diaMALine} fill="none" stroke="#f59e0b" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3,2" opacity={0.4} />
                  )}
                  {/* HR line */}
                  {filtered.length >= 2 && (
                    <path d={hrLine} fill="none" stroke="#8b5cf6" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,3" opacity={0.5} />
                  )}
                  {/* X-axis labels */}
                  {filtered.length <= 14 && filtered.length >= 2 && filtered.map((e, i) => (
                    <text key={i} x={xScale(i)} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={6}>{e.date.slice(5)}</text>
                  ))}
                  {filtered.length <= 14 && filtered.length === 1 && (
                    <text x={xScale(0)} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={6}>{filtered[0].date.slice(5)}</text>
                  )}
                  {filtered.length > 14 && (
                    <>
                      <text x={xScale(0)} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={6}>{filtered[0].date.slice(5)}</text>
                      <text x={xScale(Math.floor(filtered.length / 2))} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={6}>{filtered[Math.floor(filtered.length / 2)].date.slice(5)}</text>
                      <text x={xScale(filtered.length - 1)} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={6}>{filtered[filtered.length - 1].date.slice(5)}</text>
                    </>
                  )}
                </svg>
                <div style={{ display: 'flex', gap: 10, fontSize: 8, color: apple.textDim, marginTop: 4, flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 2, borderRadius: 1, background: '#ef4444', marginRight: 3, verticalAlign: 'middle' }} /> Систолическое</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 2, borderRadius: 1, background: '#f59e0b', marginRight: 3, verticalAlign: 'middle' }} /> Диастолическое</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 1.5, borderRadius: 1, background: '#8b5cf6', marginRight: 3, verticalAlign: 'middle' }} /> Пульс</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 1, borderRadius: 1, background: 'rgba(255,255,255,0.35)', marginRight: 3, verticalAlign: 'middle', borderTop: '1px dashed rgba(255,255,255,0.35)' }} /> Скользящая ср.</span>
                </div>
              </div>
            )}

            {/* Entry list */}
            <div style={{ fontSize: 10, color: apple.textDim, fontWeight: 600, marginBottom: 4 }}>Записи ({reversed.length})</div>
            {reversed.map((e, i) => (
              <div key={`${e.date}-${i}`} style={{ ...glassCard, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.1)', fontSize: 14 }}>{bpIcon(e.systolic, e.diastolic)}</div>
                <div style={{ flex: 1 }} onClick={() => startEdit(entries.indexOf(e))} title="Редактировать">
                  <div style={{ fontSize: 13, fontWeight: 700, color: apple.textPrimary }}>{e.systolic}/{e.diastolic}</div>
                  <div style={{ fontSize: 9, color: apple.textDim }}>Пульс: {e.hr} уд/мин</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <div style={{ fontSize: 10, color: bpColorVal(e.systolic, e.diastolic), fontWeight: 600 }}>
                    {bpStatus(e.systolic, e.diastolic)}
                  </div>
                  <div style={{ fontSize: 8, color: apple.textDim, whiteSpace: 'nowrap' }}>{e.date}</div>
                  <button onClick={(ev) => { ev.stopPropagation(); const idx = entries.indexOf(e); if (idx >= 0) deleteEntry(idx); }} style={{
                    padding: '2px 6px', borderRadius: 6, fontSize: 8, cursor: 'pointer',
                    border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontFamily: 'inherit',
                  }}>✕</button>
                </div>
              </div>
            ))}
          </> : (
            <div style={{ ...glassCard, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🫀</div>
              <div style={{ fontSize: 11, color: apple.textDim, marginBottom: 2 }}>Нет записей за выбранный период</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Нажмите «+ Добавить» для первой записи</div>
            </div>
          )}
        </>
      )}

      {/* ARCHIVE VIEW */}
      {viewMode === 'archive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={glassCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: apple.textPrimary }}>Архив записей</span>
              <span style={{ fontSize: 10, color: apple.textDim }}>Всего: {entries.length}</span>
            </div>
          </div>
          {monthGroups.length === 0 ? (
            <div style={{ ...glassCard, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 11, color: apple.textDim }}>Нет записей</div>
            </div>
          ) : (
            monthGroups.map(mg => (
              <div key={mg.monthKey} style={glassCard}>
                <div
                  onClick={() => setExpandedMonth(expandedMonth === mg.monthKey ? null : mg.monthKey)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: apple.textPrimary }}>{mg.monthLabel}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: apple.textDim }}>{mg.count} зап.</span>
                    <span style={{ fontSize: 9, color: bpColorVal(mg.avgS, mg.avgD), fontWeight: 600 }}>{mg.avgS}/{mg.avgD}</span>
                    <span style={{ fontSize: 11, color: apple.textDim }}>{expandedMonth === mg.monthKey ? '▲' : '▼'}</span>
                  </div>
                </div>
                {/* Mini stats row */}
                <div style={{ display: 'flex', gap: 8, fontSize: 8, color: apple.textDim, marginTop: 4, flexWrap: 'wrap' }}>
                  <span>Мин: {mg.minS}/{mg.minD}</span>
                  <span>Макс: {mg.maxS}/{mg.maxD}</span>
                  <span>Пульс ср: {mg.avgH}</span>
                </div>
                {expandedMonth === mg.monthKey && (
                  <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
                    {mg.entries.map((e, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                      }} onClick={() => { const idx = entries.indexOf(e); if (idx >= 0) startEdit(idx); }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: apple.textDim }}>{e.date.slice(8)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: bpColorVal(e.systolic, e.diastolic) }}>{e.systolic}/{e.diastolic}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: apple.textDim }}>{e.hr} уд</span>
                          <span style={{ fontSize: 10 }}>{bpIcon(e.systolic, e.diastolic)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* STATS VIEW */}
      {viewMode === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {monthGroups.length > 0 ? (
            monthGroups.map(mg => (
              <div key={mg.monthKey} style={glassCard}>
                <div style={{ fontSize: 12, fontWeight: 700, color: apple.textPrimary, marginBottom: 6 }}>{mg.monthLabel}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
                  <StatCell label="Среднее" value={`${mg.avgS}/${mg.avgD}`} color={bpColorVal(mg.avgS, mg.avgD)} />
                  <StatCell label="Минимум" value={`${mg.minS}/${mg.minD}`} color={apple.accent} />
                  <StatCell label="Максимум" value={`${mg.maxS}/${mg.maxD}`} color="#ef4444" />
                  <StatCell label="Пульс" value={`${mg.avgH}`} color="#8b5cf6" unit="уд/мин" />
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 8, color: apple.textDim }}>
                  <span>Записей: {mg.count}</span>
                  <span>Вариация сист.: {Math.round((mg.maxS - mg.minS) <= 0 ? 0 : mg.maxS - mg.minS)} мм</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ ...glassCard, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 11, color: apple.textDim }}>Недостаточно данных для статистики</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function StatCell({ label, value, color, unit }: { label: string; value: string; color: string; unit?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
      {unit && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>{unit}</div>}
    </div>
  );
}
