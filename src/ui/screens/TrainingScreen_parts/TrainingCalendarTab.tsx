import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  generateTrainingCalendar,
  generateSyntheticPlan,
  buildPlannedMapFromBridgeSessions,
  buildActualMapFromWorkoutLogs,
  getMesocycleOverview,
  DAY_NAMES_RU,
  MONTH_NAMES_RU,
  type CalendarDay,
  getWaterStats, quickAddWater, type WaterStats,
  exportWorkoutsToCSV, exportToJSON,
} from '../../../engines/training-calendar.engine';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };

const STATUS_COLORS: Record<string, string> = {
  done: '#00e68a',
  partial: '#f59e0b',
  missed: '#ef4444',
  rest: 'rgba(255,255,255,0.12)',
  planned: '#3b82f6',
  none: 'rgba(255,255,255,0.03)',
};

const STATUS_BG: Record<string, string> = {
  done: 'rgba(0,230,138,0.12)',
  partial: 'rgba(245,158,11,0.12)',
  missed: 'rgba(239,68,68,0.12)',
  rest: 'rgba(255,255,255,0.03)',
  planned: 'rgba(59,130,246,0.12)',
  none: 'rgba(255,255,255,0.02)',
};

const btnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#fff', padding: '6px 10px', cursor: 'pointer', fontSize: 13, lineHeight: 1 };

const STATUS_LABELS: Record<string, string> = {
  done: 'Выполнено',
  partial: 'Частично',
  missed: 'Пропущено',
  rest: 'Отдых',
  planned: 'Запланировано',
  none: '',
};

export const TrainingCalendarTab: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<'month' | 'week' | 'meso'>('month');
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [water, setWater] = useState<WaterStats>(() => getWaterStats());
  const refreshWater = useCallback((amt: number) => { quickAddWater(amt); setWater(getWaterStats()); }, []);
  const download = useCallback((filename: string, text: string, mime = 'text/plain') => {
    try {
      const blob = new Blob([text], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { /* ignore */ }
  }, []);
  const [flaggedDates, setFlaggedDates] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('he_cal_manual') || '[]')); } catch { return new Set<string>(); }
  });

  useEffect(() => {
    (async () => {
      try {
        const diary = new StrengthDiary();
        const logs = await diary.getWorkoutLogs();
        setHistoryWorkouts(logs.reverse());
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const plannedData = useMemo(() => {
    try {
      const runtime = JSON.parse(localStorage.getItem('he_pl_runtime') || 'null');
      if (runtime && Array.isArray(runtime) && runtime.length > 0) {
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endDate = new Date(year, month + 1, 0);
        const endStr = endDate.toISOString().slice(0, 10);
        return buildPlannedMapFromBridgeSessions(runtime.map((r: any, i: number) => ({
          ...r,
          date: r.date || `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
          totalVolume: r.totalVolume || 3000,
          totalSets: r.totalSets || 15,
          focus: r.focus || 'Тренировка',
        })), startStr, endStr);
      }
    } catch { /* ignore */ }
    return null;
  }, [monthKey]);

  const syntheticPlan = useMemo(() => generateSyntheticPlan(year, month, 4, 'ppl'), [monthKey]);

  const actualMap = useMemo(() => {
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = new Date(year, month + 1, 0);
    const endStr = endDate.toISOString().slice(0, 10);
    return buildActualMapFromWorkoutLogs(historyWorkouts, startStr, endStr);
  }, [monthKey, historyWorkouts]);

  const cal = useMemo(() => {
    const plannedMap = plannedData || syntheticPlan;
    return generateTrainingCalendar(year, month, plannedMap, actualMap);
  }, [monthKey, plannedData, syntheticPlan, actualMap]);

  const weekSummaries = cal.weekSummaries || [];

  const navigateMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
    setSelectedWeek(0);
  };

  const goToday = useCallback(() => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedWeek(0);
    setView('month');
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const toggleManualDone = useCallback((date: string) => {
    setFlaggedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      localStorage.setItem('he_cal_manual', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // После ручного флага обновляем historyWorkouts — добавляем виртуальный лог
  useEffect(() => {
    if (flaggedDates.size === 0) return;
    const extra: WorkoutLog[] = [];
    for (const d of flaggedDates) {
      if (!historyWorkouts.find(w => w.date === d)) {
        extra.push({ id: 'cal_man_' + d, date: d, exercises: [], duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'manual' } as WorkoutLog);
      }
    }
    if (extra.length > 0) {
      setHistoryWorkouts(prev => [...prev, ...extra]);
    }
  }, [flaggedDates]);

  const totalDone = cal.weeks.flat().filter(d => d.status === 'done').length;
  const totalPartial = cal.weeks.flat().filter(d => d.status === 'partial').length;
  const totalMissed = cal.weeks.flat().filter(d => d.status === 'missed').length;
  const totalPlannedVol = cal.weeks.flat().reduce((s, d) => s + d.plannedVolume, 0);
  const totalActualVol = cal.weeks.flat().reduce((s, d) => s + d.actualVolume, 0);

  const formatVol = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`;

  if (loading) {
    return <div style={{ padding: 20, color: DIM, textAlign: 'center' }}>Загрузка календаря...</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      {/* Водный баланс — вода из training-calendar.engine (ранее неиспользуемая) */}
      <div style={{ padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12, display:'flex', flexDirection:'column', gap: 8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>💧 Водный баланс</span>
          <span style={{ fontSize: 11, color: water.today.percentComplete >= 100 ? '#22c55e' : water.today.percentComplete >= 60 ? '#eab308' : '#ef4444', fontWeight: 700 }}>{water.today.percentComplete}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: Math.min(100, water.today.percentComplete) + '%', height: '100%', background: water.today.percentComplete >= 100 ? '#22c55e' : water.today.percentComplete >= 60 ? '#eab308' : '#ef4444', borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 10, color: DIM }}>{water.today.totalMl} / {water.today.goalMl} мл сегодня · нед.ср. {water.weekAvg} мл · серия {water.streak} дн. {water.trend>=0?'+':''}{water.trend}%</div>
        <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
          {[200, 300, 500].map(ml => <button key={ml} onClick={() => refreshWater(ml)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color: ACCENT, cursor:'pointer', fontSize:12, fontWeight:700 }}>+{ml} мл</button>)}
        </div>
      </div>
      {/* Экспорт тренировок — ранее неиспользуемые exportWorkoutsToCSV/exportToJSON */}
      <div style={{ padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12, display:'flex', flexDirection:'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>📤 Экспорт тренировок</span>
        <div style={{ fontSize: 10, color: DIM }}>Сохранить журнал тренировок (he_workout_log_v2) в CSV/JSON для анализа или передачи тренеру.</div>
        <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
          <button onClick={() => download('workouts.csv', exportWorkoutsToCSV(), 'text/csv')} style={{ padding:'10px 16px', borderRadius:8, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color: ACCENT, cursor:'pointer', fontSize:12, fontWeight:700 }}>⬇ Экспорт CSV</button>
          <button onClick={() => download('workouts.json', exportToJSON(JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]')), 'application/json')} style={{ padding:'10px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color: '#fff', cursor:'pointer', fontSize:12, fontWeight:700 }}>⬇ Экспорт JSON</button>
        </div>
      </div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => navigateMonth(-1)} style={btnStyle}>◀</button>
          <span style={{ fontSize: 16, fontWeight: 700, margin: '0 8px', color: ACCENT, whiteSpace: 'nowrap' }}>{MONTH_NAMES_RU[month]} {year}</span>
          <button onClick={() => navigateMonth(1)} style={btnStyle}>▶</button>
          <button onClick={goToday} style={{ ...btnStyle, marginLeft: 4, background: 'rgba(0,230,138,0.08)', borderColor: 'rgba(0,230,138,0.3)', color: ACCENT, fontSize: 10 }}>Сегодня</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['month', 'week', 'meso'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); setSelectedWeek(0); }} style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: view === v ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
              background: view === v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
              color: view === v ? ACCENT : DIM,
            }}>
              {v === 'month' ? '📅 Месяц' : v === 'week' ? '📆 Неделя' : '📊 Мезоцикл'}
            </button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {view === 'month' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <MiniStat label="Выполнено" value={totalDone} color={ACCENT} />
            <MiniStat label="Частично" value={totalPartial} color="#f59e0b" />
            <MiniStat label="Пропущено" value={totalMissed} color="#ef4444" />
            <MiniStat label="Объём" value={formatVol(totalActualVol)} color="#3b82f6" />
          </div>

          {/* Compliance gauge bar */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginBottom: 3 }}>
              <span>Compliance месяца</span>
              <span style={{ fontWeight: 700, color: cal.compliance >= 80 ? ACCENT : cal.compliance >= 50 ? '#f59e0b' : '#ef4444' }}>{cal.compliance}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, cal.compliance)}%`, background: cal.compliance >= 80 ? `linear-gradient(90deg, ${ACCENT}, ${ACCENT}aa)` : cal.compliance >= 50 ? 'linear-gradient(90deg, #f59e0b, #f59e0baa)' : 'linear-gradient(90deg, #ef4444, #ef4444aa)', transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            <div />
            {DAY_NAMES_RU.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: DIM, padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {cal.weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
              <div style={{ fontSize: 10, color: DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>Н{wi + 1}</div>
              {week.map((day, di) => (
                <CalendarCell key={di} day={day} today={today} onClick={() => { setView('week'); setSelectedWeek(wi + 1); }} />
              ))}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {['done', 'partial', 'missed', 'planned', 'rest'].filter(k => k !== 'none').map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: DIM }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[k] }} />
                {STATUS_LABELS[k]}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Week detail view */}
      {view === 'week' && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {weekSummaries.map((ws, i) => (
              <button key={i} onClick={() => setSelectedWeek(ws.weekNumber)} style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                border: selectedWeek === ws.weekNumber ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
                background: selectedWeek === ws.weekNumber ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
                color: selectedWeek === ws.weekNumber ? ACCENT : DIM,
              }}>
                Нед {ws.weekNumber} → {ws.compliance}%
              </button>
            ))}
          </div>

          {(() => {
            const ws = weekSummaries.find(w => w.weekNumber === selectedWeek) || weekSummaries[0];
            if (!ws) return <div style={{ color: DIM, textAlign: 'center', padding: 20 }}>Нет данных</div>;

            const activeDays = ws.days.filter(d => d.date);
            return (
              <>
                <div style={CARD}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📆 Неделя {ws.weekNumber} ({ws.startDate} — {ws.endDate})</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <MiniStat label="Запланировано" value={ws.plannedSessions} color="#3b82f6" />
                    <MiniStat label="Выполнено" value={ws.completedSessions} color={ACCENT} />
                    <MiniStat label="Compliance" value={`${ws.compliance}%`} color={ws.compliance >= 80 ? ACCENT : ws.compliance >= 50 ? '#f59e0b' : '#ef4444'} />
                    <MiniStat label="Объём план" value={formatVol(ws.plannedVolume)} color="#3b82f6" />
                    <MiniStat label="Объём факт" value={formatVol(ws.actualVolume)} color={ACCENT} />
                  </div>
                  {ws.mesocyclePhase && <div style={{ fontSize: 10, color: '#a855f7', marginBottom: 8 }}>🏷 Фаза: {ws.mesocyclePhase}</div>}
                </div>

                {activeDays.map((day, i) => {
                  const exNames = actualMap.get(day.date)?.exercises || [];
                  return (
                    <div key={i} style={{ ...CARD, opacity: day.date ? 1 : 0.3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                            {DAY_NAMES_RU[day.dayOfWeek]} · {day.date}
                          </span>
                          {day.isToday && <span style={{ fontSize: 10, color: ACCENT, marginLeft: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.2)' }}>Сегодня</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {day.date && day.date <= today && (
                            <button onClick={(e) => { e.stopPropagation(); toggleManualDone(day.date); }}
                              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: flaggedDates.has(day.date) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)', color: flaggedDates.has(day.date) ? ACCENT : DIM }}>
                              {flaggedDates.has(day.date) ? '✓ Отм.' : '☐ Отм.'}
                            </button>
                          )}
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: STATUS_BG[day.status] || 'transparent',
                            color: STATUS_COLORS[day.status] || DIM,
                          }}>{STATUS_LABELS[day.status] || ''}</span>
                        </div>
                      </div>

                      {day.isTrainingDay && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
                          <div><span style={{ color: DIM }}>Фокус:</span> <span style={{ color: '#fff' }}>{day.plannedFocus || '—'}</span></div>
                          <div><span style={{ color: DIM }}>Подходов:</span> <span style={{ color: '#fff' }}>{day.plannedSets} план / {day.actualSets} факт</span></div>
                          <div><span style={{ color: DIM }}>Объём:</span> <span style={{ color: '#fff' }}>{formatVol(day.plannedVolume)} план / {formatVol(day.actualVolume)} факт</span></div>
                          <div><span style={{ color: DIM }}>Compliance:</span> <span style={{ color: day.compliance >= 80 ? ACCENT : day.compliance >= 30 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{day.compliance}%</span></div>
                        </div>
                      )}

                      {/* Exercise names from actual workout */}
                      {exNames.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {exNames.filter(Boolean).map((ex, ei) => (
                            <span key={ei} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: ACCENT }}>
                              {ex}
                            </span>
                          ))}
                        </div>
                      )}

                      {day.isTrainingDay && day.plannedVolume > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${Math.min(100, day.compliance)}%`,
                              background: day.compliance >= 80 ? ACCENT : day.compliance >= 30 ? '#f59e0b' : '#ef4444',
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                      )}

                      {!day.isTrainingDay && day.actualVolume > 0 && (
                        <div style={{ fontSize: 10, color: ACCENT, marginTop: 4 }}>
                          ✅ Незапланированная тренировка — {formatVol(day.actualVolume)} кг
                        </div>
                      )}

                      {flaggedDates.has(day.date) && !day.actualCompleted && (
                        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⚑ Отмечено вручную
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </>
      )}

      {/* Mesocycle overview */}
      {view === 'meso' && (() => {
        const overview = getMesocycleOverview(
          monthKey, `${MONTH_NAMES_RU[month]} ${year}`,
          `${year}-${String(month + 1).padStart(2, '0')}-01`,
          `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`,
          weekSummaries.map(w => ({
            weekNumber: w.weekNumber,
            plannedSessions: w.plannedSessions,
            completedSessions: w.completedSessions,
            plannedVolume: w.plannedVolume,
            actualVolume: w.actualVolume,
            mesocyclePhase: w.mesocyclePhase || '',
          })),
        );

        const trendLabel = overview.trend === 'improving' ? '📈 Улучшение' : overview.trend === 'declining' ? '📉 Спад' : '➡ Стабильно';
        const trendColor = overview.trend === 'improving' ? ACCENT : overview.trend === 'declining' ? '#ef4444' : '#f59e0b';

        return (
          <>
            <div style={CARD}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>📊 Обзор мезоцикла — {MONTH_NAMES_RU[month]} {year}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <MiniStat label="План" value={overview.totalPlannedSessions} color="#3b82f6" />
                <MiniStat label="Выполнено" value={overview.totalCompleted} color={ACCENT} />
                <MiniStat label="Compliance" value={`${overview.overallCompliance}%`} color={overview.overallCompliance >= 80 ? ACCENT : overview.overallCompliance >= 50 ? '#f59e0b' : '#ef4444'} />
                <MiniStat label="Тренд" value={trendLabel} color={trendColor} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <MiniStat label="Объём план" value={formatVol(overview.totalPlannedVolume)} color="#3b82f6" />
                <MiniStat label="Объём факт" value={formatVol(overview.totalActualVolume)} color={ACCENT} />
                <MiniStat label="Реализация" value={overview.totalPlannedVolume > 0 ? `${Math.round((overview.totalActualVolume / overview.totalPlannedVolume) * 100)}%` : '—'} color={overview.totalActualVolume >= overview.totalPlannedVolume * 0.8 ? ACCENT : '#f59e0b'} />
              </div>
            </div>

            {/* Phase distribution */}
            {overview.phaseDistribution.length > 0 && (
              <div style={CARD}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🏷 Фазы мезоцикла</div>
                {overview.phaseDistribution.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: ACCENT }}>{p.phase}</span>
                    <span style={{ color: DIM }}>{p.weeks} нед · compliance {p.compliance}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Week-by-week compliance */}
            {overview.weekCompliance.length > 0 && (
              <div style={CARD}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Compliance по неделям</div>
                {overview.weekCompliance.map((wc, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginBottom: 2 }}>
                      <span>Нед {wc.week}</span>
                      <span>{wc.actual}/{wc.planned} — {wc.compliance}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, wc.compliance)}%`, background: wc.compliance >= 80 ? 'linear-gradient(90deg, #00e68a88, #00e68a)' : wc.compliance >= 50 ? 'linear-gradient(90deg, #f59e0b88, #f59e0b)' : 'linear-gradient(90deg, #ef444488, #ef4444)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Volume by week */}
            {overview.weekCompliance.length > 0 && (
              <div style={CARD}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Объём по неделям (план vs факт)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, paddingTop: 8 }}>
                  {(() => {
                    const maxVol = Math.max(...overview.weekCompliance.map(w => Math.max(overview.totalPlannedVolume / overview.weekCompliance.length, overview.totalActualVolume / overview.weekCompliance.length)), 1);
                    return overview.weekCompliance.map((wc, i) => {
                      const weekPlanned = Math.round(overview.totalPlannedVolume / overview.weekCompliance.length);
                      const weekActual = Math.round(overview.totalActualVolume / overview.weekCompliance.length);
                      const ph = `${(weekPlanned / maxVol) * 80}px`;
                      const ah = `${(weekActual / maxVol) * 80}px`;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ fontSize: 10, color: DIM }}>{formatVol(weekActual)}</div>
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div title="План" style={{ height: ph === '0px' ? '2px' : ph, width: '70%', borderRadius: 2, background: 'rgba(59,130,246,0.35)', border: '1px dashed rgba(59,130,246,0.5)', minHeight: 2, transition: 'height 0.3s' }} />
                            <div title="Факт" style={{ height: ah === '0px' ? '2px' : ah, width: '60%', borderRadius: 2, background: ACCENT, border: '1px solid rgba(0,230,138,0.3)', minHeight: 2, transition: 'height 0.3s' }} />
                          </div>
                          <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>Н{wc.week}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10, color: DIM, marginTop: 8 }}>
                  <span>▬ Факт</span>
                  <span style={{ borderTop: '1px dashed rgba(59,130,246,0.5)' }}>--- План</span>
                </div>
              </div>
            )}

            {/* Trend */}
            <div style={CARD}>
              <div style={{ fontSize: 11, fontWeight: 700, color: trendColor }}>{trendLabel}</div>
            </div>
          </>
        );
      })()}
    </div>
  );
};

/** Calendar cell for month grid */
const CalendarCell: React.FC<{ day: CalendarDay; today: string; onClick: () => void }> = ({ day, today, onClick }) => {
  if (!day.date) {
    return <div style={{ aspectRatio: '1', borderRadius: 8 }} />;
  }

  const isToday = day.date === today;
  const bg = STATUS_BG[day.status] || 'rgba(255,255,255,0.02)';
  const border = isToday
    ? '1px solid ' + ACCENT
    : `1px solid ${STATUS_COLORS[day.status]}33`;

  return (
    <div onClick={onClick} title={STATUS_LABELS[day.status] || ''} style={{
      aspectRatio: '1',
      borderRadius: 8,
      background: bg,
      border,
      padding: 2,
      cursor: day.isTrainingDay ? 'pointer' : 'default',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s',
      position: 'relative',
    }}>
      <div style={{ fontSize: 10, fontWeight: isToday ? 800 : 500, color: isToday ? ACCENT : '#fff' }}>
        {day.date.slice(8)}
      </div>
      {day.isTrainingDay && (
        <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>
          {day.plannedExercises}упр
        </div>
      )}
      {day.isTrainingDay && day.status !== 'planned' && (
        <div style={{ fontSize: 10, color: STATUS_COLORS[day.status] || DIM, marginTop: 1 }}>
          {day.compliance}%
        </div>
      )}
      {day.isTrainingDay && (
        <div style={{
          position: 'absolute', bottom: 2, left: 2, right: 2,
          height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 1,
            width: `${Math.min(100, day.compliance)}%`,
            background: STATUS_COLORS[day.status] || ACCENT,
          }} />
        </div>
      )}
    </div>
  );
};

/** Mini stat chip */
const MiniStat: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div style={{
    padding: '6px 10px', borderRadius: 8, fontSize: 10,
    background: 'rgba(24,24,27,0.6)',
    border: '1px solid rgba(255,255,255,0.05)',
    textAlign: 'center', minWidth: 60,
  }}>
    <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>{label}</div>
  </div>
);

export default React.memo(TrainingCalendarTab);
