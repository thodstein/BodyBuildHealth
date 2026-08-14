/** DiaryHistoryView.tsx — режим «История» хаба дневника (вынесен из TrainingDiaryHub). */
import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { epley1RM } from '../../../engines/e1rm';
import { LEVEL_VOLUMES } from '../../../engines/training.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { clearStorageTrimWarning } from '../../../engines/workout-logger.engine';
import { loadCheckins, protocolAdherence, mindsetTrends } from '../../../engines/mindset-protocol.engine';
import { loadMobilityCheckins, mobilityAdherence, mobilityTrends } from '../../../engines/mobility-protocol.engine';
import { Sparkline } from './Sparkline';
import { MiniBarChart } from './DiaryChart';
import { WorkoutWeekCard, DiaryEmptyState } from './diary-cards';
import { diaryStyles as style, GRP_RU, GROUP_COLORS, ACCENT } from './diary-tokens';
import { useDiaryHub, type DiaryHubCtx } from './diary-hub-context';

export const DiaryHistoryView: React.FC<{ hub: DiaryHubCtx }> = ({ hub }) => {
  const {
    diaryProgress, historyWorkouts, level, tprofile, linked, trainingOutput,
    search, setSearch, filterGroup, setFilterGroup, groupPickerOpen, setGroupPickerOpen,
    exPickerOpen, setExPickerOpen, exSearch, setExSearch, notesPickerOpen, setNotesPickerOpen,
    notesFilter, setNotesFilter, historyExerciseFilter, setHistoryExerciseFilter,
    mesoIds, mesoFilter, setMesoFilter, allExerciseNames, groupedHistory, filteredHistory,
    filteredHistoryWorkouts, historyExpanded, setHistoryExpanded, trimWarning, setTrimWarning, progressionAlerts,
    handleEditWorkout, handleDeleteWorkout, confirmDeleteId, setConfirmDeleteId,
    setMode, onGoRecord, onRefresh,
  } = hub;
  return (
        <div>
          {/* Кнопка возврата к записи (История — подвкладка дневника) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <button onClick={() => setMode('record')} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}>← В запись</button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>История тренировок и сводка недели</span>
          </div>
          {/* Предупреждение о срезе истории из-за переполнения хранилища */}
          {trimWarning && (
            <div style={{ ...style.card, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>⚠️ История частично обрезана из-за переполнения хранилища</div>
                <button onClick={() => { clearStorageTrimWarning(); setTrimWarning(null); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                Осталось {trimWarning.kept} последних сессий ({new Date(trimWarning.at).toLocaleString('ru-RU')}). Сделайте экспорт CSV/JSON в «Инструментах» и удалите старые записи.
              </div>
            </div>
          )}

          {/* Алгоритмические алерты: плато, перегрузка объёма, делод */}
          {progressionAlerts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
              {progressionAlerts.map((a, i) => (
                <div key={i} style={{ ...style.card, border: `1px solid ${a.type === 'plateau' ? 'rgba(245,158,11,0.4)' : a.type === 'volume_peak' ? 'rgba(239,68,68,0.4)' : 'rgba(96,165,250,0.4)'}`, background: `${a.type === 'plateau' ? 'rgba(245,158,11,0.06)' : a.type === 'volume_peak' ? 'rgba(239,68,68,0.06)' : 'rgba(96,165,250,0.06)'}`, padding: 10, marginBottom: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: a.type === 'plateau' ? '#f59e0b' : a.type === 'volume_peak' ? '#ef4444' : '#60a5fa' }}>
                    {a.type === 'plateau' ? '⏸' : a.type === 'volume_peak' ? '📈' : '📉'} {a.message}
                  </div>
                  {a.type === 'volume_peak' && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Рекомендуется разгрузочная неделя или снижение объёма.</div>}
                </div>
              ))}
            </div>
          )}

          {/* План vs факт: синхронизация с планом недели */}
          {trainingOutput?.plan && trainingOutput.plan.some((d: any) => (d.exercises || []).length > 0) && (() => {
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            const factWeek = historyWorkouts.filter(w => new Date(w.date) >= weekAgo);
            const plannedDays = trainingOutput.plan.filter((d: any) => (d.exercises || []).length > 0);
            const plannedSets = plannedDays.reduce((s: number, d: any) => s + (d.exercises || []).reduce((ss: number, e: any) => ss + (Number(e.sets) || 0), 0), 0);
            const factSets = factWeek.reduce((s, w) => s + w.exercises.reduce((ss, e) => ss + (e.sets?.length || 0), 0), 0);
            const adherence = plannedSets > 0 ? Math.min(100, Math.round((factSets / plannedSets) * 100)) : 0;
            // Поупражненное выполнение: план-имена из текущего дня плана vs факт-имена
            const plannedNames = new Set(plannedDays.flatMap((d: any) => (d.exercises || []).map((e: any) => (e.name || '').toLowerCase()).filter(Boolean)));
            const factNames = new Map<string, number>();
            factWeek.forEach(w => w.exercises.forEach(e => {
              const n = (e.exerciseName || '').toLowerCase();
              if (n) factNames.set(n, (factNames.get(n) || 0) + (e.sets?.length || 0));
            }));
            const matched = [...plannedNames].filter(n => [...factNames.keys()].some(f => f.includes(n) || n.includes(f))).length;
            const matchPct = plannedNames.size > 0 ? Math.round((matched / plannedNames.size) * 100) : 0;
            const color = adherence >= 80 ? '#22c55e' : adherence >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div style={style.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={style.label} >📋 План vs факт</div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                    🔄 Синхронизировано с планом
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Сессий (план/факт)</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{plannedDays.length}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}> / {factWeek.length}</span></div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Подходов (план/факт)</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{plannedSets}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}> / {factSets}</span></div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Выполнение</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color }}>{adherence}%</div>
                  </div>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${adherence}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  Упражнений плана выполнено: {matched} из {plannedNames.size} ({matchPct}%)
                </div>
                {(() => {
                  // Пропущенные плановые дни: день плана (0=Пн) vs дни недели с факт-тренировками
                  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                  const factDays = new Set(factWeek.map(w => (new Date(w.date).getDay() + 6) % 7));
                  const missed = plannedDays
                    .filter((d: any) => typeof d.day === 'number' && !factDays.has(d.day % 7))
                    .map((d: any) => `${dayNames[d.day % 7]} (${d.name})`);
                  if (missed.length === 0) return null;
                  return (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                      ⏭ Пропущено: {missed.join(', ')}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Сводка недели для копирования */}
          {historyWorkouts.length > 0 && (() => {
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            const lastWeek = historyWorkouts.filter(w => new Date(w.date) >= weekAgo);
            if (lastWeek.length === 0) return null;
            const prevWeek = historyWorkouts.filter(w => { const d = new Date(w.date); return d < weekAgo && d >= new Date(weekAgo.getTime() - 7 * 86400000); });
            const vol = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const sets = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const prevVol = prevWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const volDelta = prevVol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : 0;
            const best = lastWeek.flatMap(w => w.exercises.map(e => ({ name: e.exerciseName, e1rm: e.estimated1RM || 0 }))).sort((a, b) => b.e1rm - a.e1rm)[0];
            const summary = [
              `📅 Неделя: ${lastWeek[0].date.slice(8, 10)}.${lastWeek[0].date.slice(5, 7)} — ${lastWeek[lastWeek.length - 1].date.slice(8, 10)}.${lastWeek[lastWeek.length - 1].date.slice(5, 7)}`,
              `🏋️ Тренировок: ${lastWeek.length} (${prevWeek.length ? `прошлая: ${prevWeek.length}` : 'прошлая: —'})`,
              `⚖️ Объём: ${(vol / 1000).toFixed(1)} т (${volDelta >= 0 ? '+' : ''}${volDelta}%) · подходов: ${sets}`,
              best && best.e1rm > 0 ? `🏆 Лучший e1RM: ${best.name} — ${Math.round(best.e1rm)} кг` : '',
              lastWeek[0].notes ? `📝 ${lastWeek[0].notes}` : '',
            ].filter(Boolean).join('\n');
            return (
              <div style={style.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ ...style.label, marginBottom: 0 }}>📄 Сводка недели</div>
                  <button onClick={() => navigator.clipboard?.writeText(summary)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>📋 Копировать</button>
                </div>
                <pre style={{ margin: '6px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{summary}</pre>
              </div>
            );
          })()}
          <div style={style.card}>
            <div style={style.label}>📜 История тренировок</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[
                { label: 'Недель', value: diaryProgress.length, color: '#34d399' },
                { label: 'Тренировок', value: diaryProgress.reduce((s, w) => s + w.workoutCount, 0), color: '#60a5fa' },
                { label: 'Объём', value: diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length - 1]?.totalVolume / 1000).toFixed(1)}т` : '—', color: '#f59e0b' },
                { label: 'ACWR', value: (() => { try { const s = loadSRPESessions(); if (s.length < 2) return '—'; return acuteChronicRatio(toDailyLoads(s)).ratio.toFixed(2); } catch { return '—'; } })(), color: '#22c55e' },
              ].map((s, i) => <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>)}
            </div>
            {/* Heatmap — redesigned with month labels + tooltips */}
            {historyWorkouts.length > 0 && (() => {
              const byDay: Record<string, number> = {};
              historyWorkouts.forEach((w: any) => { byDay[w.date] = (byDay[w.date] || 0) + (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || 0), 0); });
              const cells: { date: string; vol: number; dayOfWeek: number }[] = [];
              const today = new Date();
              for (let i = 83; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                cells.push({ date: d.toISOString().slice(0, 10), vol: byDay[d.toISOString().slice(0, 10)] || 0, dayOfWeek: (d.getDay() + 6) % 7 });
              }
              const maxVol = Math.max(1, ...cells.map(c => c.vol));
              const heatColor = (v: number) => {
                if (v === 0) return 'rgba(255,255,255,0.04)';
                const t = v / maxVol;
                if (t < 0.25) return 'rgba(0,230,138,0.2)';
                if (t < 0.5) return 'rgba(0,230,138,0.4)';
                if (t < 0.75) return 'rgba(0,230,138,0.65)';
                return 'rgba(0,230,138,0.9)';
              };
              // Group by weeks (columns)
              const weeks: { date: string; vol: number; dayOfWeek: number }[][] = [];
              for (let w = 0; w < 12; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
              // Month labels: find first day of each week column
              const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
              const monthLabels: { week: number; label: string }[] = [];
              let lastMonth = -1;
              weeks.forEach((wk, wi) => {
                if (wk.length > 0) {
                  const m = new Date(wk[0].date).getMonth();
                  if (m !== lastMonth) { monthLabels.push({ week: wi, label: monthNames[m] }); lastMonth = m; }
                }
              });
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 }}>🔥 Тепловая карта (12 нед)</div>
                  {/* Month labels row */}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 2 }}>
                    {weeks.map((_, wi) => {
                      const ml = monthLabels.find(m => m.week === wi);
                      return <div key={wi} style={{ flex: 1, fontSize: 9, color: ml ? 'rgba(255,255,255,0.45)' : 'transparent', fontWeight: ml ? 600 : 400, textAlign: 'center' }}>{ml?.label || ''}</div>;
                    })}
                  </div>
                  {/* Day labels + grid */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 2 }}>
                      {['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map((d, i) => (
                        <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', height: 12, display: 'flex', alignItems: 'center' }}>{d}</div>
                      ))}
                    </div>
                    {weeks.map((wk, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                        {wk.map((c, di) => (
                          <div key={di} title={`${c.date}${c.vol > 0 ? ': ' + Math.round(c.vol) + ' кг' : ''}`}
                            style={{ height: 12, borderRadius: 2, background: heatColor(c.vol), transition: 'background 0.2s' }} />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                    <span>меньше</span>
                    {[0.1, 0.3, 0.5, 0.8].map((t, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: heatColor(maxVol * t) }} />
                    ))}
                    <span>больше</span>
                  </div>
                </div>
              );
            })()}
            {/* MRV alerts */}
            {historyWorkouts.length > 0 && (() => {
              const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
              const mrvBase = (((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv) ?? 20) * (tprofile.onCourse ? 1.2 : 1);
              const ws = (d0: Date) => { const x = new Date(d0); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };
              const now = new Date();
              const wkSets = (weeksAgo: number) => { const s = ws(now); s.setDate(s.getDate() - weeksAgo * 7); const e = new Date(s); e.setDate(e.getDate() + 6); const ss = s.toISOString().slice(0, 10), ee = e.toISOString().slice(0, 10); const m: Record<string, number> = {}; historyWorkouts.forEach((w: any) => { if (w.date >= ss && w.date <= ee) (w.exercises || []).forEach((ex: any) => { const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId); if (cat) m[cat.group] = (m[cat.group] || 0) + (ex.sets?.length || 0); }); }); return m; };
              const w1 = wkSets(1), w2 = wkSets(0);
              const groups2 = Array.from(new Set([...Object.keys(w1), ...Object.keys(w2)]));
              const over2 = groups2.filter(g => (w1[g] || 0) > mrvBase && (w2[g] || 0) > mrvBase);
              const over1 = groups2.filter(g => ((w1[g] || 0) > mrvBase || (w2[g] || 0) > mrvBase) && !over2.includes(g));
              if (over2.length === 0 && over1.length === 0) return null;
              const ru = (g: string) => GRP_RU[g] || g;
              const color = over2.length > 0 ? '#ef4444' : '#f59e0b';
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: color + '12', border: '1px solid ' + color + '40' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 4 }}>{over2.length > 0 ? '🔴 Риск перетренированности' : '🟡 Превышение объёма'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    {over2.length > 0 ? `Группы выше MRV (${Math.round(mrvBase)} сетов) 2 недели подряд: ${over2.map(ru).join(', ')}. Снизьте объём на 10–15% в следующем микроцикле.` : `Группы выше MRV на прошлой/текущей неделе: ${over1.map(ru).join(', ')}. Следите за восстановлением.`}
                  </div>
                </div>
              );
            })()}
            {/* Volume chart */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Тоннаж по неделям</div>
              <MiniBarChart
                data={diaryProgress.slice(-12).map(w => ({
                  value: w.totalVolume,
                  label: `${w.year % 100}.${String(w.week).padStart(2, '0')}`,
                  color: w.totalVolume === Math.max(...diaryProgress.map(w2 => w2.totalVolume), 1) ? '#00e68a' : 'rgba(0,230,138,0.35)',
                }))}
                width={300}
                height={55}
                valueSuffix=" кг"
              />
            </div>
            {/* Exercise progress mini-charts */}
            {historyWorkouts.length >= 2 && (() => {
              const byEx: Record<string, { date: string; e1rm: number }[]> = {};
              historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
                const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                if (best <= 0) return;
                const name = e.exerciseName || e.exerciseId || '—';
                (byEx[name] = byEx[name] || []).push({ date: w.date, e1rm: Math.round(best) });
              }));
              const topEx = Object.entries(byEx)
                .filter(([, arr]) => arr.length >= 2)
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 4);
              if (topEx.length === 0) return null;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Прогресс e1RM по упражнениям</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {topEx.map(([name, arr]) => {
                      const sorted = arr.sort((a, b) => a.date.localeCompare(b.date));
                      const latest = sorted[sorted.length - 1].e1rm;
                      const prev = sorted.length >= 2 ? sorted[sorted.length - 2].e1rm : latest;
                      const delta = prev > 0 ? Math.round((latest - prev) / prev * 100) : 0;
                      return (
                        <div key={name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Sparkline data={sorted.map(p => p.e1rm)} width={40} height={14} color={delta >= 0 ? '#22c55e' : '#ef4444'} showDots={false} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
                              {latest}кг {delta !== 0 && <span style={{ fontSize: 8 }}>{delta > 0 ? '+' : ''}{delta}%</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Muscle recovery estimate */}
            {historyWorkouts.length >= 2 && (() => {
              const lastTrained: Record<string, string> = {};
              const sorted = [...historyWorkouts].sort((a, b) => b.date.localeCompare(a.date));
              sorted.forEach(w => (w.exercises || []).forEach((e: any) => {
                const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                const group = cat?.group;
                if (group && !lastTrained[group]) lastTrained[group] = w.date;
              }));
              const today = new Date().toISOString().slice(0, 10);
              const groups = Object.entries(lastTrained)
                .map(([g, date]) => {
                  const days = Math.floor((new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
                  return { group: g, days, date };
                })
                .sort((a, b) => b.days - a.days)
                .slice(0, 6);
              if (groups.length === 0) return null;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>💚 Восстановление мышц</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {groups.map(({ group, days }) => {
                      const ready = days >= 4;
                      const color = days >= 7 ? '#22c55e' : days >= 4 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={group} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{GRP_RU[group] || group}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color }}>{days}д {ready ? '✓' : '⏳'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Muscle volume trend over 8 weeks */}
            {historyWorkouts.length >= 6 && (() => {
              const weeks = 8;
              const today = new Date();
              const GROUP_COLORS: Record<string, string> = { chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', quads: '#22c55e', hamstrings: '#10b981', biceps: '#a855f7', triceps: '#60a5fa', core: '#f97316' };
              const weekGroupVol: { week: string; groups: Record<string, number> }[] = [];
              for (let w = weeks - 1; w >= 0; w--) {
                const ws = new Date(today); ws.setDate(ws.getDate() - (w + 1) * 7);
                const we = new Date(today); we.setDate(we.getDate() - w * 7);
                const wos = historyWorkouts.filter(wo => { const d = new Date(wo.date); return d > ws && d <= we; });
                const groups: Record<string, number> = {};
                wos.forEach(wo => (wo.exercises || []).forEach((e: any) => {
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const g = cat?.group || 'core';
                  groups[g] = (groups[g] || 0) + (e.sets?.length || 0);
                }));
                weekGroupVol.push({ week: `Н${weeks - w}`, groups });
              }
              const topGroups = Object.entries(weekGroupVol.reduce((acc, wg) => {
                Object.entries(wg.groups).forEach(([g, v]) => { acc[g] = (acc[g] || 0) + v; });
                return acc;
              }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
              if (topGroups.length === 0) return null;
              const maxTotal = Math.max(1, ...weekGroupVol.map(wg => topGroups.reduce((s, g) => s + (wg.groups[g] || 0), 0)));
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Объём по группам (нед)</div>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
                    {weekGroupVol.map((wg, wi) => {
                      const total = topGroups.reduce((s, g) => s + (wg.groups[g] || 0), 0);
                      const h = Math.max(2, (total / maxTotal) * 46);
                      let accH = 0;
                      return (
                        <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, position: 'relative' }}>
                          <div style={{ width: '100%', height: h, borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                            {topGroups.map(g => {
                              const v = wg.groups[g] || 0;
                              const segH = total > 0 ? (v / total) * h : 0;
                              return <div key={g} style={{ height: segH, background: GROUP_COLORS[g] || '#888', opacity: 0.8 }} />;
                            })}
                          </div>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{wg.week}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {topGroups.map(g => <span key={g} style={{ fontSize: 8, color: GROUP_COLORS[g] || '#888' }}>● {GRP_RU[g] || g}</span>)}
                  </div>
                </div>
              );
            })()}
            {/* Duration trend */}
            {historyWorkouts.length >= 4 && (() => {
              const durations = historyWorkouts.slice(-12).map(w => w.duration || 0).filter(d => d > 0);
              if (durations.length < 3) return null;
              const avgDuration = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
              const lastDur = durations[durations.length - 1];
              const firstDur = durations[0];
              const durDelta = firstDur > 0 ? Math.round(((lastDur - firstDur) / firstDur) * 100) : 0;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>⏱ Длительность сессий</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>avg {avgDuration} мин</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkline data={durations} width={80} height={18} color="#60a5fa" />
                    <span style={{ fontSize: 10, fontWeight: 600, color: durDelta > 10 ? '#f59e0b' : durDelta < -10 ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                      {durDelta > 0 ? '+' : ''}{durDelta}%
                    </span>
                  </div>
                </div>
              );
            })()}
            {/* Session quality score trend */}
            {historyWorkouts.length >= 4 && (() => {
              const recent = historyWorkouts.slice(-10);
              const scores = recent.map(w => {
                const exCount = w.exercises.length;
                const totalSets = w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
                const completedSets = w.exercises.reduce((s: number, e: any) => s + (e.sets || []).filter((st: any) => st.completed || (st.weight > 0 && st.reps > 0)).length, 0);
                const completionRate = totalSets > 0 ? completedSets / totalSets : 0;
                const rpe = w.overallRPE || 7;
                const rpeScore = rpe >= 7 && rpe <= 8.5 ? 1.0 : rpe < 7 ? 0.7 : rpe > 9 ? 0.6 : 0.85;
                const volumeScore = Math.min(totalSets / 20, 1);
                return Math.round((completionRate * 40 + rpeScore * 30 + volumeScore * 30));
              });
              const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
              const trend = scores[scores.length - 1] > scores[0];
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>⭐ Качество сессий</span>
                    <span style={{ fontSize: 10, color: avg >= 70 ? '#22c55e' : avg >= 50 ? '#f59e0b' : '#ef4444' }}>{Math.round(avg)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkline data={scores} width={80} height={18} color={avg >= 70 ? '#22c55e' : '#f59e0b'} />
                    <span style={{ fontSize: 10, color: trend ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {trend ? '↑ растёт' : '↓ падает'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>выполнение + RPE + объём</div>
                </div>
              );
            })()}
          </div>
          {/* Week-to-week comparison card */}
          {groupedHistory.length >= 2 && (() => {
            const [curWeek, curWorkouts] = groupedHistory[0];
            const [prevWeek, prevWorkouts] = groupedHistory[1];
            const curVol = curWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const prevVol = prevWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const curSets = curWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const prevSets = prevWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const volPct = prevVol > 0 ? Math.round((curVol - prevVol) / prevVol * 100) : 0;
            const setsPct = prevSets > 0 ? Math.round((curSets - prevSets) / prevSets * 100) : 0;
            const exNames = new Set<string>();
            curWorkouts.forEach(w => w.exercises.forEach((e: any) => exNames.add(e.exerciseName || e.exerciseId)));
            const prevExNames = new Set<string>();
            prevWorkouts.forEach(w => w.exercises.forEach((e: any) => prevExNames.add(e.exerciseName || e.exerciseId)));
            const newExercises = [...exNames].filter(n => !prevExNames.has(n));
            return (
              <div style={{ ...style.card, marginBottom: 6 }}>
                <div style={style.label}>📊 {curWeek} vs {prevWeek}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)' }}>Объём</div>
                    <div style={{ fontWeight: 700, color: volPct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {volPct >= 0 ? '+' : ''}{volPct}% <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({(curVol / 1000).toFixed(1)}т vs {(prevVol / 1000).toFixed(1)}т)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)' }}>Сеты</div>
                    <div style={{ fontWeight: 700, color: setsPct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {setsPct >= 0 ? '+' : ''}{setsPct}% <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({curSets} vs {prevSets})</span>
                    </div>
                  </div>
                </div>
                {newExercises.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>🆕 Новые: {newExercises.slice(0, 3).join(', ')}{newExercises.length > 3 ? ` +${newExercises.length - 3}` : ''}</div>
                )}
              </div>
            );
          })()}
          {/* Фильтр по мезоциклу (если записи тегированы mesocycleId) */}
          {mesoIds.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => setMesoFilter('all')} style={{
                padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                border: mesoFilter === 'all' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                background: mesoFilter === 'all' ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                color: mesoFilter === 'all' ? 'var(--accent)' : 'var(--text-dim)',
              }}>Все мезоциклы</button>
              {mesoIds.map(id => (
                <button key={id} onClick={() => setMesoFilter(mesoFilter === id ? 'all' : id)} style={{
                  padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  border: mesoFilter === id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                  background: mesoFilter === id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                  color: mesoFilter === id ? 'var(--accent)' : 'var(--text-dim)',
                }}>📈 {id}</button>
              ))}
            </div>
          )}
          {/* Search + group filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'stretch' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по неделе..." style={{ ...style.input, flex: 2 }} />
            <button onClick={() => setGroupPickerOpen(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', minWidth: 0,
              background: filterGroup !== 'all' ? `${GROUP_COLORS[filterGroup]}1a` : 'rgba(255,255,255,0.06)',
              border: filterGroup !== 'all' ? `1px solid ${GROUP_COLORS[filterGroup]}66` : '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💪 {filterGroup === 'all' ? 'Все группы' : GRP_RU[filterGroup]}</span>
              <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }}>▾</span>
            </button>
          </div>
          {groupPickerOpen && (
            <div onClick={() => setGroupPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
              <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>💪 Выбор по группам</div>
                  <button onClick={() => setGroupPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button onClick={() => { setFilterGroup('all'); setGroupPickerOpen(false); }} style={{
                    padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: filterGroup === 'all' ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
                    background: filterGroup === 'all' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                  }}>Все группы</button>
                  {Object.entries(GRP_RU).map(([k, v]) => (
                    <button key={k} onClick={() => { setFilterGroup(k); setGroupPickerOpen(false); }} style={{
                      padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: filterGroup === k ? `2px solid ${GROUP_COLORS[k]}` : '1px solid rgba(255,255,255,0.12)',
                      background: filterGroup === k ? `${GROUP_COLORS[k]}1f` : 'rgba(255,255,255,0.04)',
                      color: '#fff',
                    }}>{v}{filterGroup === k ? ' ✓' : ''}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Exercise filter (card-button + popup) */}
          {allExerciseNames.length > 0 && (
            <>
              <div style={{ marginBottom: 6 }}>
                <button onClick={() => { setExSearch(''); setExPickerOpen(true); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: historyExerciseFilter ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.06)',
                  border: historyExerciseFilter ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 12, fontWeight: 600, minHeight: 40,
                }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏋️ {historyExerciseFilter || 'Все упражнения'}</span>
                  {historyExerciseFilter ? (
                    <span onClick={e => { e.stopPropagation(); setHistoryExerciseFilter(''); }} style={{ flexShrink: 0, fontSize: 13, opacity: 0.85 }}>✕</span>
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }}>▾</span>
                  )}
                </button>
              </div>
              {exPickerOpen && (
                <div onClick={() => setExPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
                  <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>🏋️ Фильтр по упражнению</div>
                      <button onClick={() => setExPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                    </div>
                    <input type="text" value={exSearch} onChange={e => setExSearch(e.target.value)} placeholder="🔍 Найти упражнение..." autoFocus style={{ ...style.input, width: '100%', marginBottom: 10 }} />
                    <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {allExerciseNames.filter(n => !exSearch || n.toLowerCase().includes(exSearch.toLowerCase())).map(n => (
                        <button key={n} onClick={() => { setHistoryExerciseFilter(n); setExPickerOpen(false); }} style={{
                          width: '100%', padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          border: historyExerciseFilter === n ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                          background: historyExerciseFilter === n ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                          color: '#fff', fontSize: 12,
                        }}>{n}{historyExerciseFilter === n ? ' ✓' : ''}</button>
                      ))}
                      <button onClick={() => { setHistoryExerciseFilter(''); setExPickerOpen(false); }} style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        border: !historyExerciseFilter ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                        background: !historyExerciseFilter ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                        color: '#fff', fontSize: 12, fontWeight: 700,
                      }}>Все упражнения</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {/* Notes filter (card-button + popup) */}
          {groupedHistory.some(([, ws]) => ws.some(w => w.notes)) && (
            <>
              <div style={{ marginBottom: 6 }}>
                <button onClick={() => setNotesPickerOpen(true)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: notesFilter ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.06)',
                  border: notesFilter ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 12, fontWeight: 600, minHeight: 40,
                }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {notesFilter || 'Фильтр по заметкам'}</span>
                  {notesFilter ? (
                    <span onClick={e => { e.stopPropagation(); setNotesFilter(''); }} style={{ flexShrink: 0, fontSize: 13, opacity: 0.85 }}>✕</span>
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }}>▾</span>
                  )}
                </button>
              </div>
              {notesPickerOpen && (
                <div onClick={() => setNotesPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
                  <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 420, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>📝 Фильтр по заметкам</div>
                      <button onClick={() => setNotesPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                    </div>
                    <input type="text" value={notesFilter} onChange={e => setNotesFilter(e.target.value)} placeholder="Текст заметки / сплита..." autoFocus style={{ ...style.input, width: '100%', marginBottom: 12 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setNotesFilter(''); setNotesPickerOpen(false); }} style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 600, fontSize: 12 }}>Сбросить</button>
                      <button onClick={() => setNotesPickerOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12 }}>Готово</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {filteredHistory.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6, gap: 6 }}>
              <button onClick={() => setHistoryExpanded('__all__')} style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▾ Развернуть все</button>
              <button onClick={() => setHistoryExpanded(null)} style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▸ Свернуть все</button>
            </div>
          )}
          {/* Exercise-specific stats when filtered */}
          {historyExerciseFilter && filteredHistoryWorkouts.length > 0 && (() => {
            const q = historyExerciseFilter.toLowerCase();
            const exSessions = filteredHistoryWorkouts.flatMap(w => w.exercises.filter((e: any) => (e.exerciseName || '').toLowerCase().includes(q)));
            const totalVol = exSessions.reduce((s, e) => s + (e.totalVolume || 0), 0);
            const bestE1RM = Math.max(0, ...exSessions.map((e: any) => e.estimated1RM || 0));
            const totalSets = exSessions.reduce((s, e) => s + (e.sets?.length || 0), 0);
            const latestE1RM = exSessions[exSessions.length - 1]?.estimated1RM || 0;
            const prevE1RM = exSessions.length >= 2 ? exSessions[exSessions.length - 2]?.estimated1RM || 0 : latestE1RM;
            const delta = prevE1RM > 0 ? Math.round(((latestE1RM - prevE1RM) / prevE1RM) * 100) : 0;
            return (
              <div style={style.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={style.label}>🏋️ {historyExerciseFilter}</div>
                  <button onClick={() => setHistoryExerciseFilter('')} style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ сброс</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#fff' }}>Объём</div>
                    <div style={{ fontWeight: 700, color: ACCENT }}>{(totalVol / 1000).toFixed(1)}т кг</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#fff' }}>Лучший e1RM</div>
                    <div style={{ fontWeight: 700, color: '#f59e0b' }}>{Math.round(bestE1RM)} кг</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#fff' }}>Сетов</div>
                    <div style={{ fontWeight: 700, color: '#60a5fa' }}>{totalSets}</div>
                  </div>
                </div>
                {delta !== 0 && (
                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 4, color: delta > 0 ? '#22c55e' : '#ef4444' }}>
                    {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}% к предыдущему e1RM
                  </div>
                )}
              </div>
            );
          })()}
          {/* Психо-чек-ины: сводка (из вкладки «Психология») */}
          {loadCheckins().length > 0 && (() => {            const adh = protocolAdherence(30);
            const trends = mindsetTrends(14);
            const checks = loadCheckins();
            const last = checks[checks.length - 1];
            const avg = (v: number) => v > 0 ? v.toFixed(1) : '—';
            return (
              <div style={{ ...style.card, border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={style.label} >🧠 Психо-чек-ины</div>
                  <span style={{ fontSize: 9, color: 'rgba(167,139,250,0.8)' }}>последний: {last.date.slice(5).replace('-', '.')} · уверенность {last.confidence}/5</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Чек-инов · 14д</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{trends.count}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Приверженность</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: adh.pct >= 80 ? '#22c55e' : adh.pct >= 40 ? '#f59e0b' : '#ef4444' }}>{adh.total > 0 ? `${adh.pct}%` : '—'}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Фокус · 14д</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{avg(trends.averages.focus)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Уверенность · 14д</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{avg(trends.averages.confidence)}</div>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Мобильность: сводка (из вкладки «Мобильность») */}
          {loadMobilityCheckins().length > 0 && (() => {
            const madh = mobilityAdherence(30);
            const mtr = mobilityTrends(30);
            const mchecks = loadMobilityCheckins();
            const mlast = mchecks[mchecks.length - 1];
            return (
              <div style={{ ...style.card, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={style.label}>🧘 Мобильность</div>
                  <span style={{ fontSize: 9, color: 'rgba(96,165,250,0.8)' }}>
                    последний: {mlast.date.slice(5).replace('-', '.')} · ROM {mlast.romScore === null ? '—' : `${mlast.romScore}/5`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Чек-инов · 30д</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{mtr.count}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Приверженность</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: madh.pct >= 70 ? '#22c55e' : madh.pct >= 40 ? '#f59e0b' : '#ef4444' }}>{madh.total > 0 ? `${madh.pct}%` : '—'}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Средний ROM</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{mtr.avgRom > 0 ? mtr.avgRom.toFixed(1) : '—'}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Выполнено дней</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{madh.done}</div>
                  </div>
                </div>
              </div>
            );
          })()}
          {filteredHistory.map(([week, workouts], wi) => (
            <WorkoutWeekCard
              key={week}
              weekLabel={week}
              workouts={workouts}
              prevWorkouts={wi < filteredHistory.length - 1 ? filteredHistory[wi + 1][1] : undefined}
              expanded={historyExpanded === '__all__' || historyExpanded === week}
              onToggle={() => setHistoryExpanded((prev: string | null) => prev === week ? null : week)}
              onEdit={handleEditWorkout}
              onDelete={w => setConfirmDeleteId(w.id)}
              confirmDeleteId={confirmDeleteId}
              onConfirmDelete={handleDeleteWorkout}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
          {filteredHistory.length === 0 && (
            <DiaryEmptyState
              icon="📜"
              title={search || historyExerciseFilter ? 'Ничего не найдено' : 'Нет тренировок'}
              description={search || historyExerciseFilter
                ? 'Попробуйте изменить поиск или сбросить фильтры.'
                : 'Запишите первую тренировку — она появится здесь.'}
              onRecord={!search && !historyExerciseFilter ? () => { setMode('record'); onGoRecord?.(); } : undefined}
            />
          )}
        </div>
  );
};