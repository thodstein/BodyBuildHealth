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
} {
  if (diary.length < 2) return {
    hoursDiff: 0, qualityDiff: 0, awakeningsDiff: 0,
    avgHours: 0, avgQuality: 0, avgAwakenings: 0,
    hoursTrend: 'stable', qualityTrend: 'stable',
  };
  const last = diary[0];
  const prev = diary.slice(1, Math.min(diary.length, 8)); // up to 7 prev
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const aH = avg(prev.map(e => e.hours));
  const aQ = avg(prev.map(e => e.quality));
  const aA = avg(prev.map(e => e.awakenings));
  const hDiff = last.hours - aH;
  const qDiff = last.quality - aQ;
  const aDiff = last.awakenings - aA;
  return {
    hoursDiff: Math.round(hDiff * 10) / 10,
    qualityDiff: Math.round(qDiff * 10) / 10,
    awakeningsDiff: Math.round(aDiff * 10) / 10,
    avgHours: Math.round(aH * 10) / 10,
    avgQuality: Math.round(aQ * 10) / 10,
    avgAwakenings: Math.round(aA * 10) / 10,
    hoursTrend: hDiff > 0.5 ? 'up' : hDiff < -0.5 ? 'down' : 'stable',
    qualityTrend: qDiff > 1 ? 'up' : qDiff < -1 ? 'down' : 'stable',
  };
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

  const addEntry = () => {
    const entry: SleepEntry = { date, hours, quality, awakenings, bedtime, wakeTime, notes };
    saveSleepDiaryEntry(entry);
    setDiary(loadSleepDiary());
    setShowForm(false);
    setNotes('');
  };

  const removeEntry = (d: string) => {
    deleteSleepEntry(d);
    setDiary(loadSleepDiary());
  };

  const weekData = diary.slice(0, 7).reverse();
  const trend = calcSleepTrend(diary);
  const maxHours = Math.max(...diary.map(e => e.hours), 8);

  const qualityColor = (q: number) => q >= 7 ? '#4caf50' : q >= 4 ? '#ff9800' : '#f44336';
  const trendIcon = (t: 'up' | 'down' | 'stable', goodUp: boolean) => {
    if (t === 'stable') return '➡️';
    if (goodUp) return t === 'up' ? '📈' : '📉';
    return t === 'up' ? '📉' : '📈';
  };
  const trendVal = (t: 'up' | 'down' | 'stable') => {
    if (t === 'up') return '+';
    if (t === 'down') return '−';
    return '∼';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Кнопка добавления */}
      <button onClick={() => setShowForm(!showForm)} style={{
        width: '100%', padding: '10px', borderRadius: 12,
        border: apple.accentBorder, background: apple.accentDim,
        color: apple.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
      }}>
        {showForm ? '✕ Закрыть' : '➕ Добавить запись сна'}
      </button>

      {/* Форма */}
      {showForm && (
        <div style={glassCard}>
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

      {/* STATS VIEW: сводка трендов */}
      {viewMode === 'stats' && diary.length > 0 && (
        <div style={glassCard}>
          <div style={{ fontSize: 11, fontWeight: 700, color: apple.textPrimary, marginBottom: 8 }}>
            📊 Сводка сна
          </div>
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
          </div>
        </div>
      )}

      {/* CHART VIEW */}
      {viewMode === 'chart' && diary.length > 0 && (
        <div style={glassCard}>
          <div style={{ fontSize: 11, fontWeight: 700, color: apple.textPrimary, marginBottom: 4 }}>
            📈 Последние 7 дней
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '8px 0' }}>
            {weekData.map((e, i) => {
              const h = Math.min(70, (e.hours / Math.max(maxHours, 8)) * 70);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%', background: qualityColor(e.quality), opacity: 0.5,
                    borderRadius: '4px 4px 0 0', height: h, minHeight: 4,
                    border: `1px solid ${qualityColor(e.quality)}`,
                  }}>
                    <div style={{ position: 'relative', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: apple.accent, whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {e.hours}ч
                    </div>
                  </div>
                  <span style={{ fontSize: 7, color: apple.textSecondary, textAlign: 'center' }}>{e.date.slice(5)}</span>
                </div>
              );
            })}
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
                <div key={i} style={{
                  padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
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
