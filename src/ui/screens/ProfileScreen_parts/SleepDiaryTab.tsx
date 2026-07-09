import React, { useState } from 'react';

const SLEEP_DIARY_KEY = 'he_sleep_diary';

interface SleepEntry {
  date: string;
  hours: number;
  quality: number;
  awakenings: number;
  bedtime: string;
  wakeTime: string;
  notes: string;
}

const apple = {
  accent: '#00e68a',
  accentDim: 'rgba(0,230,138,0.08)',
  accentBorder: '1px solid rgba(0,230,138,0.2)',
  textPrimary: '#fff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textDim: 'rgba(255,255,255,0.35)',
  gradientGreen: 'linear-gradient(135deg, #00e68a, #00c771)',
};

const glassCard: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)', borderRadius: 12, padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.04)',
};

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 16, fontSize: 10, fontWeight: 700,
  whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
  background: active ? apple.accentDim : 'rgba(255,255,255,0.03)',
  color: active ? apple.accent : apple.textDim,
  border: active ? apple.accentBorder : '1px solid rgba(255,255,255,0.06)',
  fontFamily: 'inherit',
});

function loadSleepDiary(): SleepEntry[] {
  try { return JSON.parse(localStorage.getItem(SLEEP_DIARY_KEY) || '[]'); } catch { return []; }
}
function saveSleepDiaryEntry(entry: SleepEntry) {
  try {
    const diary = loadSleepDiary();
    const idx = diary.findIndex(e => e.date === entry.date);
    if (idx >= 0) diary[idx] = entry; else diary.unshift(entry);
    localStorage.setItem(SLEEP_DIARY_KEY, JSON.stringify(diary.slice(0, 365)));
  } catch {}
}
function deleteSleepEntry(date: string) {
  try {
    const diary = loadSleepDiary().filter(e => e.date !== date);
    localStorage.setItem(SLEEP_DIARY_KEY, JSON.stringify(diary));
  } catch {}
}

/** Тренд: сравнение последнего дня со средним за 7 дней */
function calcSleepTrend(diary: SleepEntry[]): {
  hoursDiff: number; qualityDiff: number; awakeningsDiff: number;
  avgHours: number; avgQuality: number; avgAwakenings: number;
  hoursTrend: 'up' | 'down' | 'stable';
  qualityTrend: 'up' | 'down' | 'stable';
  hoursCV: number;
  consistencyScore: number;
} {
  if (diary.length < 2) return {
    hoursDiff: 0, qualityDiff: 0, awakeningsDiff: 0,
    avgHours: 0, avgQuality: 0, avgAwakenings: 0,
    hoursTrend: 'stable', qualityTrend: 'stable',
    hoursCV: 0, consistencyScore: 0,
  };
  const last = diary[0];
  const prev = diary.slice(1, Math.min(diary.length, 8));
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const std = (arr: number[]) => { const m = avg(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };
  const aH = avg(prev.map(e => e.hours));
  const aQ = avg(prev.map(e => e.quality));
  const aA = avg(prev.map(e => e.awakenings));
  const hDiff = last.hours - aH;
  const qDiff = last.quality - aQ;
  const aDiff = last.awakenings - aA;
  const hCV = diary.length >= 7 ? std(diary.slice(0, 7).map(e => e.hours)) / avg(diary.slice(0, 7).map(e => e.hours)) : 0;
  const cs = diary.length >= 3 ? Math.max(0, Math.min(100, Math.round(
    (1 - hCV) * 50 + (avg(diary.slice(0, 7).map(e => e.quality)) / 10) * 30 + (1 - Math.min(avg(diary.slice(0, 7).map(e => e.awakenings)) / 5, 1)) * 20
  ))) : 0;
  return {
    hoursDiff: Math.round(hDiff * 10) / 10,
    qualityDiff: Math.round(qDiff * 10) / 10,
    awakeningsDiff: Math.round(aDiff * 10) / 10,
    avgHours: Math.round(aH * 10) / 10,
    avgQuality: Math.round(aQ * 10) / 10,
    avgAwakenings: Math.round(aA * 10) / 10,
    hoursTrend: hDiff > 0.5 ? 'up' : hDiff < -0.5 ? 'down' : 'stable',
    qualityTrend: qDiff > 1 ? 'up' : qDiff < -1 ? 'down' : 'stable',
    hoursCV: Math.round(hCV * 100) / 100,
    consistencyScore: cs,
  };
}

/** По-недельные средние за последние 4 недели */
function weeklyAverages(diary: SleepEntry[]): { weekLabel: string; avgHours: number; avgQuality: number; avgAwakenings: number; days: number }[] {
  const result: { weekLabel: string; avgHours: number; avgQuality: number; avgAwakenings: number; days: number }[] = [];
  const now = new Date();
  for (let w = 0; w < 4; w++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekEntries = diary.filter(e => {
      const d = new Date(e.date);
      return d >= weekStart && d <= weekEnd;
    });
    if (weekEntries.length > 0) {
      const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      result.push({
        weekLabel: `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`,
        avgHours: Math.round(avg(weekEntries.map(e => e.hours)) * 10) / 10,
        avgQuality: Math.round(avg(weekEntries.map(e => e.quality)) * 10) / 10,
        avgAwakenings: Math.round(avg(weekEntries.map(e => e.awakenings)) * 10) / 10,
        days: weekEntries.length,
      });
    }
  }
  return result;
}

/** Среднее по дню недели */
function dayOfWeekAvg(diary: SleepEntry[]): { dayName: string; avgHours: number; avgQuality: number; count: number }[] {
  const days: { dayName: string; idx: number; hours: number[]; quality: number[] }[] = [
    { dayName: 'Пн', idx: 1, hours: [], quality: [] },
    { dayName: 'Вт', idx: 2, hours: [], quality: [] },
    { dayName: 'Ср', idx: 3, hours: [], quality: [] },
    { dayName: 'Чт', idx: 4, hours: [], quality: [] },
    { dayName: 'Пт', idx: 5, hours: [], quality: [] },
    { dayName: 'Сб', idx: 6, hours: [], quality: [] },
    { dayName: 'Вс', idx: 0, hours: [], quality: [] },
  ];
  for (const e of diary) {
    const d = new Date(e.date);
    const dayIdx = d.getDay();
    const day = days.find(x => x.idx === dayIdx);
    if (day) { day.hours.push(e.hours); day.quality.push(e.quality); }
  }
  return days.map(d => ({
    dayName: d.dayName,
    avgHours: d.hours.length > 0 ? Math.round(d.hours.reduce((s, v) => s + v, 0) / d.hours.length * 10) / 10 : 0,
    avgQuality: d.quality.length > 0 ? Math.round(d.quality.reduce((s, v) => s + v, 0) / d.quality.length * 10) / 10 : 0,
    count: d.hours.length,
  }));
}

export const SleepDiaryTab: React.FC<{ settings: any; save: (data: any) => void }> = ({ settings, save }) => {
  const [diary, setDiary] = useState<SleepEntry[]>(loadSleepDiary);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState(settings.baselineSleepHours ?? 7);
  const [quality, setQuality] = useState(settings.baselineSleepQuality ?? 5);
  const [awakenings, setAwakenings] = useState(settings.nightAwakenings ?? 1);
  const [bedtime, setBedtime] = useState(settings.bedtime ?? '23:00');
  const [wakeTime, setWakeTime] = useState(settings.wakeTime ?? '07:00');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'diary' | 'chart' | 'stats'>('diary');
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');
  const [editDate, setEditDate] = useState<string | null>(null);

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setHours(settings.baselineSleepHours ?? 7);
    setQuality(settings.baselineSleepQuality ?? 5);
    setAwakenings(settings.nightAwakenings ?? 1);
    setBedtime(settings.bedtime ?? '23:00');
    setWakeTime(settings.wakeTime ?? '07:00');
    setNotes('');
    setEditDate(null);
  };

  const addEntry = () => {
    const entry: SleepEntry = { date, hours, quality, awakenings, bedtime, wakeTime, notes };
    saveSleepDiaryEntry(entry);
    setDiary(loadSleepDiary());
    setShowForm(false);
    resetForm();
  };

  const startEdit = (e: SleepEntry) => {
    setDate(e.date);
    setHours(e.hours);
    setQuality(e.quality);
    setAwakenings(e.awakenings);
    setBedtime(e.bedtime);
    setWakeTime(e.wakeTime);
    setNotes(e.notes);
    setEditDate(e.date);
    setShowForm(true);
  };

  const removeEntry = (d: string) => {
    deleteSleepEntry(d);
    setDiary(loadSleepDiary());
  };

  const chartDays = diary.slice(0, chartRange === '30d' ? 30 : 7).reverse();
  const trend = calcSleepTrend(diary);
  const weekly = weeklyAverages(diary);
  const dowAvg = dayOfWeekAvg(diary);
  const maxHours = Math.max(...diary.map(e => e.hours), 8);

  const qualityColor = (q: number) => q >= 7 ? '#4caf50' : q >= 4 ? '#ff9800' : '#f44336';
  const trendIcon = (t: 'up' | 'down' | 'stable', goodUp: boolean) => {
    if (t === 'stable') return '➡️';
    if (goodUp) return t === 'up' ? '📈' : '📉';
    return t === 'up' ? '📉' : '📈';
  };

  const chartH = 160;
  const chartW = 360;
  const padL = 34;
  const padR = 10;
  const padT = 16;
  const padB = 22;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const yMinH = 3;
  const yMaxH = 10;
  const yRangeH = yMaxH - yMinH;
  const yMinQ = 0;
  const yMaxQ = 10;
  const yRangeQ = yMaxQ - yMinQ;

  const xScale = (i: number) => padL + (chartDays.length > 1 ? (i / (chartDays.length - 1)) * innerW : innerW / 2);
  const yScaleHours = (v: number) => padT + innerH - ((v - yMinH) / yRangeH) * innerH;
  const yScaleQuality = (v: number) => padT + innerH - ((v - yMinQ) / yRangeQ) * innerH;

  const hoursLine = chartDays.length > 0
    ? chartDays.map((e, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScaleHours(e.hours).toFixed(1)}`).join(' ')
    : '';
  const qualityLine = chartDays.length > 0
    ? chartDays.map((e, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScaleQuality(e.quality).toFixed(1)}`).join(' ')
    : '';

  const hoursYTicks = [4, 6, 7, 8, 9];
  const qualityYTicks = [2, 4, 6, 8, 10];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Кнопка добавления */}
      <button onClick={() => setShowForm(!showForm)} style={{
        width: '100%', padding: '10px', borderRadius: 12,
        border: apple.accentBorder, background: apple.accentDim,
        color: apple.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
      }}>
        {showForm ? '✕ Закрыть' : editDate ? '✏️ Редактировать запись' : '➕ Добавить запись сна'}
      </button>

      {/* Форма */}
      {showForm && (
        <div style={glassCard}>
          {editDate && (
            <div style={{ fontSize:9, color:'#f59e0b', fontWeight:600, marginBottom:6 }}>
              ✏️ Редактирование записи от {editDate}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Дата</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.2)', color:'#fff', fontSize:12, boxSizing:'border-box', fontFamily:'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Часов сна</div>
              <input type="number" min={0} max={24} step={0.5} value={hours} onChange={e => setHours(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.2)', color:'#fff', fontSize:12, boxSizing:'border-box', fontFamily:'inherit' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Качество (1-10)</div>
              <input type="range" min={1} max={10} step={1} value={quality}
                onChange={e => setQuality(parseInt(e.target.value))}
                style={{ width:'100%' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: qualityColor(quality), textAlign: 'center' }}>{quality}/10</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Пробуждения</div>
              <input type="range" min={0} max={10} step={1} value={awakenings}
                onChange={e => setAwakenings(parseInt(e.target.value))}
                style={{ width:'100%' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: apple.textPrimary, textAlign: 'center' }}>{awakenings}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Засыпание</div>
              <input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.2)', color:'#fff', fontSize:12, boxSizing:'border-box', fontFamily:'inherit' }} /></div>
            <div><div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Подъём</div>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.2)', color:'#fff', fontSize:12, boxSizing:'border-box', fontFamily:'inherit' }} /></div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: apple.textDim, marginBottom: 3 }}>Заметки</div>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Стресс, кофеин, алкоголь..."
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.2)', color:'#fff', fontSize:12, boxSizing:'border-box', fontFamily:'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addEntry} style={{
              flex: 1, padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: apple.gradientGreen, color: '#000', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
            }}>💾 Сохранить</button>
            <button onClick={() => save({ baselineSleepHours: hours, baselineSleepQuality: quality, nightAwakenings: awakenings, bedtime, wakeTime })} style={{
              padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.9)',
            }}>↕ В профиль</button>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {(['stats','diary','chart'] as const).map(m => (
          <button key={m} onClick={() => setViewMode(m)} style={pillBtn(viewMode === m)}>
            {m === 'stats' ? '📊 Статистика' : m === 'diary' ? '📋 Журнал' : '📈 График'}
          </button>
        ))}
      </div>

      {/* STATS VIEW */}
      {viewMode === 'stats' && diary.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={glassCard}>
            <div style={{ fontSize: 11, fontWeight: 700, color: apple.textPrimary, marginBottom: 8 }}>📊 Сводка сна</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <MiniStat label="Сегодня" value={`${diary[0]?.hours ?? '—'}ч`} color={apple.accent} />
              <MiniStat label="В среднем" value={`${trend.avgHours}ч`} color="#3b82f6" />
              <MiniStat label="Качество" value={`${trend.avgQuality}/10`} color={qualityColor(trend.avgQuality)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <TrendCard icon="🕐" label="Часы" value={`${trend.hoursDiff >= 0 ? '+' : ''}${trend.hoursDiff}ч`}
                trend={trend.hoursTrend} goodUp />
              <TrendCard icon="⭐" label="Качество" value={`${trend.qualityDiff >= 0 ? '+' : ''}${trend.qualityDiff}`}
                trend={trend.qualityTrend} goodUp />
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, fontSize: 9, color: apple.textDim, flexWrap: 'wrap' }}>
              <span>🌙 Пробуждений: ср. {trend.avgAwakenings} ({trend.awakeningsDiff >= 0 ? '+' : ''}{trend.awakeningsDiff})</span>
              <span>📅 Всего записей: {diary.length}</span>
              {trend.consistencyScore > 0 && (
                <span>🎯 Консистентность: {trend.consistencyScore}% {trend.consistencyScore >= 70 ? '✅' : trend.consistencyScore >= 40 ? '⚠️' : '🔴'}</span>
              )}
            </div>
          </div>

          {/* По-недельные средние */}
          {weekly.length >= 2 && (
            <div style={glassCard}>
              <div style={{ fontSize: 10, fontWeight: 700, color: apple.textPrimary, marginBottom: 6 }}>📅 Средние по неделям</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekly.length}, 1fr)`, gap: 4 }}>
                {weekly.map((w, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 7, color: apple.textDim, marginBottom: 2 }}>{w.weekLabel}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: apple.accent }}>{w.avgHours}ч</div>
                    <div style={{ fontSize: 8, color: qualityColor(w.avgQuality) }}>⭐{w.avgQuality}</div>
                    <div style={{ fontSize: 7, color: apple.textDim }}>{w.days}дн</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* По дням недели */}
          {dowAvg.some(d => d.count > 0) && (
            <div style={glassCard}>
              <div style={{ fontSize: 10, fontWeight: 700, color: apple.textPrimary, marginBottom: 6 }}>📊 По дням недели</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {dowAvg.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '4px 2px', borderRadius: 6, background: d.count > 0 ? 'rgba(0,230,138,0.04)' : 'transparent' }}>
                    <div style={{ fontSize: 7, color: apple.textDim }}>{d.dayName}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: d.count > 0 ? apple.accent : apple.textDim }}>{d.avgHours > 0 ? `${d.avgHours}ч` : '—'}</div>
                    <div style={{ fontSize: 7, color: d.count > 0 ? qualityColor(d.avgQuality) : apple.textDim }}>{d.avgQuality > 0 ? `⭐${d.avgQuality}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHART VIEW */}
      {viewMode === 'chart' && chartDays.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Range toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['7d','30d'] as const).map(r => (
              <button key={r} onClick={() => setChartRange(r)} style={pillBtn(chartRange === r)}>
                {r === '7d' ? '7 дней' : '30 дней'}
              </button>
            ))}
          </div>
          {/* SVG Line chart: hours + quality */}
          <div style={{ ...glassCard, padding: '10px 8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: apple.textDim, fontWeight: 600 }}>📈 Часы сна и качество</span>
              <span style={{ fontSize: 8, color: apple.textDim }}>{chartDays.length} дней</span>
            </div>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: chartH }}>
              {hoursYTicks.map(t => (
                <text key={t} x={padL - 4} y={yScaleHours(t) + 3} textAnchor="end" fill="rgba(0,230,138,0.35)" fontSize={6}>{t}</text>
              ))}
              <text x={padL - 4} y={yScaleHours(9) - 4} textAnchor="end" fill="rgba(0,230,138,0.35)" fontSize={5}>часы</text>
              {qualityYTicks.filter(t => t !== 0).map(t => (
                <text key={`q${t}`} x={chartW - padR + 4} y={yScaleQuality(t) + 3} textAnchor="start" fill="rgba(139,92,246,0.35)" fontSize={6}>{t}</text>
              ))}
              <text x={chartW - padR + 4} y={yScaleQuality(8) - 4} textAnchor="start" fill="rgba(139,92,246,0.35)" fontSize={5}>кач</text>
              {/* Grid */}
              {hoursYTicks.map(t => (
                <line key={t} x1={padL} y1={yScaleHours(t)} x2={chartW - padR} y2={yScaleHours(t)} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
              ))}
              {/* Reference line (7h) */}
              <line x1={padL} y1={yScaleHours(7)} x2={chartW - padR} y2={yScaleHours(7)} stroke="rgba(0,230,138,0.15)" strokeWidth={1} strokeDasharray="4,3" />
              {/* Hours area */}
              {chartDays.length >= 2 && (
                <path d={`${hoursLine} L${xScale(chartDays.length - 1)},${yScaleHours(yMinH)} L${xScale(0)},${yScaleHours(yMinH)} Z`} fill="rgba(0,230,138,0.06)" />
              )}
              {/* Hours line */}
              {chartDays.length >= 2 ? (
                <path d={hoursLine} fill="none" stroke="#00e68a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <circle cx={xScale(0)} cy={yScaleHours(chartDays[0].hours)} r={4} fill="#00e68a" />
              )}
              {/* Quality line */}
              {chartDays.length >= 2 ? (
                <path d={qualityLine} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
              ) : (
                <circle cx={xScale(0)} cy={yScaleQuality(chartDays[0].quality)} r={3} fill="#8b5cf6" />
              )}
              {/* X labels */}
              {chartDays.length <= 14 && chartDays.length >= 2 && chartDays.map((e, i) => (
                <text key={i} x={xScale(i)} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={6}>{e.date.slice(5)}</text>
              ))}
              {chartDays.length > 14 && (
                <>
                  <text x={xScale(0)} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={6}>{chartDays[0].date.slice(5)}</text>
                  <text x={xScale(chartDays.length - 1)} y={chartH - 2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={6}>{chartDays[chartDays.length - 1].date.slice(5)}</text>
                </>
              )}
            </svg>
            <div style={{ display: 'flex', gap: 12, fontSize: 8, color: apple.textDim, marginTop: 4 }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 2, borderRadius: 1, background: '#00e68a', marginRight: 3, verticalAlign: 'middle' }} /> Часы</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 1.5, borderRadius: 1, background: '#8b5cf6', marginRight: 3, verticalAlign: 'middle', borderTop: '1.5px dashed #8b5cf6' }} /> Качество</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 1, borderRadius: 1, background: 'rgba(0,230,138,0.15)', marginRight: 3, verticalAlign: 'middle', borderTop: '1px dashed rgba(0,230,138,0.15)' }} /> 7ч</span>
            </div>
          </div>
        </div>
      )}

      {/* DIARY LOG VIEW */}
      {viewMode === 'diary' && (
        <div style={glassCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: apple.textPrimary }}>
              История сна ({diary.length} записей)
            </span>
          </div>
          {diary.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, fontSize: 10, color: apple.textSecondary }}>
              Нет записей. Добавьте первую запись сна.
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {diary.map((e, i) => (
                <div key={i} onClick={() => startEdit(e)} style={{
                  padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', cursor:'pointer', transition:'background 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{e.date}</span>
                    <button onClick={() => removeEntry(e.date)} style={{
                      padding: '2px 6px', borderRadius: 6, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                    }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 9, color: apple.textSecondary, flexWrap: 'wrap' }}>
                    <span style={{ color: apple.accent, fontWeight: 700 }}>💤 {e.hours}ч</span>
                    <span style={{ color: qualityColor(e.quality) }}>⭐ {e.quality}/10</span>
                    <span>🌙 {e.awakenings} проб.</span>
                    <span>🛌 {e.bedtime}-{e.wakeTime}</span>
                  </div>
                  {e.notes && <div style={{ fontSize: 8, color: apple.textDim, marginTop: 2 }}>{e.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Мини-счётчик */
function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
      <div style={{ fontSize:9, color: apple.textDim, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color }}>{value}</div>
    </div>
  );
}

/** Карточка тренда */
function TrendCard({ icon, label, value, trend, goodUp }: {
  icon: string; label: string; value: string;
  trend: 'up' | 'down' | 'stable'; goodUp: boolean;
}) {
  const isGood = goodUp ? trend === 'up' : trend === 'down';
  const color = trend === 'stable' ? '#94a3b8' : isGood ? '#4caf50' : '#f44336';
  return (
    <div style={{
      padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.02)',
      border:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center', gap:8,
    }}>
      <span style={{ fontSize:14 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:9, color: apple.textDim }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:700, color }}>{value}</div>
      </div>
      <span style={{ fontSize:12, color }}>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
    </div>
  );
}
