/** ExecutionZone.tsx — зона «Тренировка» (выполнение): live-сессия, таймеры, миксы.
 * Содержимое зоны — ровно эти 3 вкладки; нигде больше они не рендерятся. */
import React from 'react';
import { InfoErrorBoundary } from '../SupportScreen_parts/SupportScreenData';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import type { TrainingOutput, MovementPattern } from '../../../core/types';
import type { MacrocyclePlan, Microcycle } from '../../../engines/training-periodization.engine';
import { SessionPlayer, type PlayerDay } from '../SRCBBScreen_parts/SessionPlayer';
import { TimersTab } from './TimersTab';
import { SessionWidgetsDock } from './SessionWidgetsDock';
import { selectSetScheme } from '../../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../../engines/tempo.engine';
import { getCachedProgressForExercise, localIsoDate } from '../../../engines/workout-logger.engine';
import { isBodyweightExercise as isBWExercise } from '../../../engines/movement-pattern';
import { activeRampRows } from '../../../engines/warmup-ramp.engine';
import { generateWarmup, warmupLabel, warmupSpecificLabel, upsertWarmupLog } from '../../../engines/warmup.engine';
import { groupsFromExercises } from '../../../engines/warmup-day.engine';
import { calculatePlates } from '../../../engines/gym-competition.engine';
import { hapticImpact, hapticNotify } from '../../../core/telegram';
import { NativeIcon } from '../../native/NativeIcons';
import type { TrainingTab } from './shared';

const isDumbbellEx = (n?: string) => !!(n && /гантел|dumbbell/i.test(n));

/** День микроцикла (plan-форма) → PlayerDay для проф-плеера SessionPlayer.
 *  Один источник логирования: тёплый код ExecutionZone больше не ведёт свой
 *  «ручной» учёт сетов (были UTC-дата, RPE=7 и 1RM от последнего подхода). */
const playerDayFromMicro = (day: any): PlayerDay => {
  const exercises = ((day?.exercises || []) as any[]).map((ex: any, i: number) => {
    const sets = Math.max(1, Math.min(20, Math.round(Number(ex?.sets)) || 3));
    const weight = Math.max(0, Number(ex?.weight) || 0);
    const reps = Math.max(1, Math.round(Number(ex?.reps)) || 10);
    const rir = ex?.rir == null ? 2 : Math.max(0, Math.min(6, Math.round(Number(ex.rir))));
    const bodyweight = isBWExercise(ex) || weight <= 0;
    const targetSets = Array.from({ length: sets }, () => ({ weight: bodyweight ? 0 : weight, reps, rir }));
    return {
      name: ex?.name || `Упражнение ${i + 1}`,
      muscleGroup: String(ex?.muscleGroup || ex?.group || 'other'),
      targetSets,
      restSec: Math.max(20, Math.round(Number(ex?.restSec)) || 90),
    };
  });
  return { label: String(day?.day || day?.label || 'День'), exercises };
};

type RuntimeLogEntry = { sets: { weight: number; reps: number; rpe: number; rir: number }[]; completed: boolean };
type PlRuntime = { days: PlayerDay[]; focus: string; week: number; track: string };

interface Props {
  tab: TrainingTab;
  goal: string; level: string; recovery: number;
  trainingOutput: TrainingOutput | null;
  macrocycle: MacrocyclePlan | null;
  selectedWeek: number;
  currentMicrocycle: Microcycle | null;
  runtimeDay: number; setRuntimeDay: React.Dispatch<React.SetStateAction<number>>;
  runtimeExIdx: number; setRuntimeExIdx: React.Dispatch<React.SetStateAction<number>>;
  runtimeLogs: Record<string, RuntimeLogEntry>; setRuntimeLogs: React.Dispatch<React.SetStateAction<Record<string, RuntimeLogEntry>>>;
  runtimeStarted: boolean; setRuntimeStarted: React.Dispatch<React.SetStateAction<boolean>>;
  plRuntime: PlRuntime | null; plRunOpen: boolean; setPlRunOpen: React.Dispatch<React.SetStateAction<boolean>>;
  runtimeSetW: number; setRuntimeSetW: React.Dispatch<React.SetStateAction<number>>;
  runtimeSetR: number; setRuntimeSetR: React.Dispatch<React.SetStateAction<number>>;
  runtimeSetRP: number; setRuntimeSetRP: React.Dispatch<React.SetStateAction<number>>;
  runtimeSetRI: number; setRuntimeSetRI: React.Dispatch<React.SetStateAction<number>>;
  diary: StrengthDiary;
  onRefresh: () => void;
  onGoToTimers?: (settings?: { work: number; rest: number; rounds: number }) => void;
}

export const ExecutionZone: React.FC<Props> = (p) => {
  const { tab, goal, level, recovery, trainingOutput, macrocycle, selectedWeek, currentMicrocycle,
    runtimeDay, setRuntimeDay, runtimeExIdx, setRuntimeExIdx, runtimeLogs, setRuntimeLogs,
    runtimeStarted, setRuntimeStarted, plRuntime: _plRuntime, plRunOpen, setPlRunOpen,
    runtimeSetW, setRuntimeSetW, runtimeSetR, setRuntimeSetR, runtimeSetRP, setRuntimeSetRP, runtimeSetRI, setRuntimeSetRI,
    diary, onRefresh: loadDiaryStats, onGoToTimers } = p;
  const plRuntime = (_plRuntime && !Array.isArray(_plRuntime) && Array.isArray((_plRuntime as any).days)) ? _plRuntime : null;
  const [timerInitialSettings, setTimerInitialSettings] = React.useState<{ work: number; rest: number; rounds: number } | undefined>(undefined);
  const [dayDetailsOpen, setDayDetailsOpen] = React.useState(true);
  const [warmupOpen, setWarmupOpen] = React.useState(true);
  const [execWarmupDone, setExecWarmupDone] = React.useState<Record<string, boolean>>({});
  const [execWarmupMode, setExecWarmupMode] = React.useState<import('../../../engines/warmup.engine').WarmupMode>(() => {
    try { const v = localStorage.getItem('he_warmup_mode') as import('../../../engines/warmup.engine').WarmupMode | null; return v === 'quick' || v === 'full' ? v : 'standard'; } catch { return 'standard'; }
  });
  // Wake Lock — экран не гаснет в зале
  React.useEffect(() => {
    let lock: any = null;
    let released = false;
    const request = async () => {
      try {
        if (runtimeStarted && 'wakeLock' in navigator) {
          // @ts-ignore
          lock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    if (runtimeStarted) request();
    const onVis = () => { if (document.visibilityState === 'visible' && runtimeStarted && !lock) request(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVis);
      try { lock?.release?.(); } catch {}
    };
  }, [runtimeStarted]);
  // Безопасные производные: мемоизированы чтобы не пересчитывать и не фризить вкладку на каждом тике таймера
  const trainingDaysList: any[] = React.useMemo(() => {
    try { return ((currentMicrocycle?.days || []) as any[]).filter((d: any) => d && d.isTraining); }
    catch { return []; }
  }, [currentMicrocycle]);
  const safeRuntimeDay = React.useMemo(() => trainingDaysList.length === 0 ? 0 : Math.min(runtimeDay, trainingDaysList.length - 1), [trainingDaysList.length, runtimeDay]);
  // Мемоизация разминки — тяжёлый generateWarmup не гоняем на каждый ререндер таймера
  const warmupMemo = React.useMemo(() => {
    const dayExercises: any[] = (trainingDaysList[safeRuntimeDay] as any)?.exercises || [];
    if (!dayExercises.length) return { dayExercises: [] as any[], groups: [] as string[], blocks: [] as any[], total: 0, mins: 0 };
    const groups = groupsFromExercises(dayExercises.map((e: any) => ({ name: e.name })));
    const blocks = generateWarmup({
      sessionFocus: 'fullbody',
      primaryExercises: dayExercises.slice(0, 3).map((e: any) => e.name),
      primaryWeights: dayExercises.slice(0, 3).map((e: any) => (typeof e.weight === 'number' ? e.weight : null) as any),
      targetGroups: groups.length > 0 ? groups : ['fullbody'],
      riskFlags: {},
      techniqueIssues: [],
      fatigueLevel: 0.2,
      equipmentAvailable: ['barbell', 'dumbbell', 'band', 'bodyweight'],
      mode: execWarmupMode,
    });
    const total = blocks.reduce((s: number, b: any) => s + b.exercises.length, 0);
    const mins = Math.round(blocks.reduce((s: number, b: any) => s + (b.durationSec || 0), 0) / 60 * 10) / 10;
    return { dayExercises, groups, blocks, total, mins };
  }, [trainingDaysList, safeRuntimeDay, execWarmupMode]);
  const warmupBlocksExec = warmupMemo.blocks;
  const warmupTotal = warmupMemo.total;
  const warmupMins = warmupMemo.mins;
  const warmupGroups = warmupMemo.groups;
  const warmupDoneCount = React.useMemo(() => Object.values(execWarmupDone).filter(Boolean).length, [execWarmupDone]);
  const warmupPct = React.useMemo(() => warmupTotal > 0 ? Math.round(warmupDoneCount / warmupTotal * 100) : 0, [warmupDoneCount, warmupTotal]);
  return (
    <>
      {tab === 'runtime' && (
        <InfoErrorBoundary label="Тренировка">
        <div className="hub-exec" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Док зала: пульт/таймеры/график уколов-БАД (session-widgets-pack, сворачивается). */}
          <SessionWidgetsDock />
          {/* Запуск построенного плана ПЛ/ББ — единая сворачиваемая карточка.
              SessionPlayer НЕ размонтируется при сворачивании: прогресс сессии сохраняется. */}
          {plRuntime && plRuntime.days.length > 0 && (
            <div className="card" style={{ padding: '12px', border: plRunOpen ? '1px solid rgba(var(--train-accent-rgb, 0,230,138),0.25)' : '1px solid rgba(255,255,255,0.08)', background: plRunOpen ? 'rgba(var(--train-accent-rgb, 0,230,138),0.06)' : 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <NativeIcon name={plRunOpen ? 'pause' : 'play'} size={12} /> {plRunOpen ? 'Выполнение плана' : 'Сессия свёрнута'} · {plRuntime.track === 'bb' ? 'ББ' : 'ПЛ'} · {plRuntime.focus}
                  </h3>
                  <p style={{ fontSize: 10, color: '#fff', margin: '2px 0 0' }}>
                    Неделя {plRuntime.week} · {plRuntime.days.length} дн. {plRunOpen ? '· выполнение записывается в дневник' : '· прогресс сохранён, нажмите «Возобновить»'}
                  </p>
                </div>
                <button onClick={() => setPlRunOpen(!plRunOpen)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <NativeIcon name={plRunOpen ? 'pause' : 'play'} size={10} /> {plRunOpen ? 'Свернуть' : 'Возобновить'}
                </button>
              </div>
              <div style={{ display: plRunOpen ? 'block' : 'none' }}>
                <SessionPlayer days={plRuntime.days} weekNumber={plRuntime.week} focus={plRuntime.focus} onSaved={loadDiaryStats} />
              </div>
            </div>
          )}
          {/* Универсальная запись из сгенерированного плана — показывается только если нет активного ПЛ/ББ плана */}
          {plRuntime && plRuntime.days.length > 0 ? null : !runtimeStarted ? (
            <div className="card" style={{ padding: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ display: 'inline-flex', color: 'var(--accent)' }}><NativeIcon name="play" size={14} /></span> Начать тренировку</h3>
              <p style={{ fontSize: 11, color: '#fff', margin: '0 0 10px' }}>
                Выберите день из плана для отслеживания подходов в реальном времени.
              </p>
              {macrocycle && currentMicrocycle && trainingDaysList.length > 0 ? (
                <>
                  {(() => {
                    const totalSetsWeek = trainingDaysList.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0), 0) || 0), 0);
                    const totalVolWeek = trainingDaysList.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0) * (Number(e.reps) || 0) * (e.weight || 0), 0) || 0), 0);
                    const allDays = (currentMicrocycle.days || []) as any[];
                    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                    const trainingMap = new Set(trainingDaysList.map((d: any) => d.day || ''));
                    return (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, padding: '10px 11px', borderRadius: 13,
                        background: 'linear-gradient(135deg, rgba(0,230,138,0.07), rgba(59,130,246,0.06))',
                        border: '1px solid rgba(0,230,138,0.14)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontSize: 12, fontWeight: 800 }}>#{selectedWeek}</span>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#00e68a', lineHeight: 1 }}>Неделя {selectedWeek} · {trainingDaysList.length} тренировки · {currentMicrocycle.mesocycleType || ''}</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)' }}>{totalSetsWeek} сетов · {totalVolWeek.toLocaleString()} кг недельный объём</div>
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 20, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.20)', whiteSpace: 'nowrap' }}>понедельно</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {weekDays.map((wd, wi) => {
                            const dayObj = allDays[wi];
                            const isTraining = dayObj ? !!dayObj.isTraining : wi < trainingDaysList.length;
                            const label = dayObj?.day || (isTraining ? `Д${wi + 1}` : '—');
                            const isSelected = isTraining && trainingDaysList[safeRuntimeDay]?.day === dayObj?.day;
                            return (
                              <div key={wi} style={{
                                flex: 1, minWidth: 0, padding: '5px 2px', borderRadius: 9, textAlign: 'center',
                                background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.10))' : isTraining ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                                border: isSelected ? '1px solid rgba(0,230,138,0.28)' : isTraining ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.04)',
                                opacity: isTraining ? 1 : 0.45,
                              }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#00e68a' : isTraining ? '#fff' : 'rgba(255,255,255,0.35)' }}>{wd}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#00e68a' : isTraining ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.25)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label.slice(0, 6)}</div>
                                <div style={{ width: 5, height: 5, borderRadius: 5, margin: '3px auto 0', background: isSelected ? '#00e68a' : isTraining ? 'rgba(255,255,255,0.22)' : 'transparent', boxShadow: isSelected ? '0 0 6px rgba(0,230,138,0.45)' : 'none' }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', marginBottom: 10 }}>
                    {(() => { const _todayIdx = (((new Date().getDay() + 6) % 7)) % Math.max(1, trainingDaysList.length); const isToday = safeRuntimeDay === _todayIdx; return (
                      <button onClick={() => setRuntimeDay(_todayIdx)} aria-label="Выбрать сегодняшний день" style={{
                        minWidth: 92, flex: '0 0 auto', scrollSnapAlign: 'start', padding: '8px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                        background: isToday ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.08))' : 'rgba(255,255,255,0.04)',
                        color: isToday ? '#00e68a' : '#fff', border: `1px solid ${isToday ? 'rgba(0,230,138,0.28)' : 'rgba(255,255,255,0.08)'}`,
                        fontSize: 10, fontWeight: 800,
                      }}>📅 Сегодня</button>
                    ); })()}
                    {trainingDaysList.map((day: any, di: number) => {
                      const active = safeRuntimeDay === di;
                      const exCnt = day.exercises?.length ?? 0;
                      const sets = day.exercises?.reduce((s: number, e: any) => s + (e.sets || 0), 0) ?? 0;
                      return (
                        <button key={di} onClick={() => setRuntimeDay(di)} aria-pressed={active} aria-label={`Выбрать ${day.day || `День ${di+1}`}`} style={{
                          minWidth: 112, flex: '0 0 auto', scrollSnapAlign: 'start', textAlign: 'left', position: 'relative', overflow: 'hidden',
                          padding: '9px 11px', borderRadius: 13, cursor: 'pointer',
                          background: active ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.07))' : 'rgba(255,255,255,0.04)',
                          border: active ? '1px solid rgba(0,230,138,0.30)' : '1px solid rgba(255,255,255,0.08)',
                          borderLeft: `3px solid ${active ? '#00e68a' : 'rgba(255,255,255,0.10)'}`,
                          boxShadow: active ? '0 4px 14px rgba(0,230,138,0.16)' : '0 1px 8px rgba(0,0,0,0.10)',
                          transition: 'all 0.2s',
                        }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: active ? 'linear-gradient(90deg,#00e68a,#00c853)' : 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: active ? '#00e68a' : 'rgba(255,255,255,0.50)', marginBottom: 3 }}>День {di + 1}{active ? ' •' : ''}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{day.day || `День ${di + 1}`}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: active ? 'rgba(0,230,138,0.13)' : 'rgba(255,255,255,0.06)', color: active ? '#00e68a' : '#fff', border: `1px solid ${active ? 'rgba(0,230,138,0.20)' : 'rgba(255,255,255,0.07)'}` }}>{exCnt} упр.</span>
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.06)' }}>{sets} сет.</span>
                          </div>
                          {active && <span style={{ position: 'absolute', top: 6, right: 7, width: 16, height: 16, borderRadius: 16, background: '#00e68a', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#fff' }}>
                {trainingDaysList[safeRuntimeDay]?.exercises?.length || 0} упражнений • {trainingDaysList[safeRuntimeDay]?.duration || 60} мин
              </div>
              <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>
                Интенсивность: {trainingDaysList[safeRuntimeDay]?.intensity || 'средняя'} | Схема: {currentMicrocycle.mesocycleType || ''}
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
                Расчётный тоннаж: {trainingDaysList[safeRuntimeDay]?.exercises?.reduce((sum: number, ex: any) => sum + (ex.sets || 0) * (Number(ex.reps) || 0) * (ex.weight || 0), 0) || 0} кг
              </div>
            </div>
                  {/* ── Детали дня: полный список упражнений (сеты/вес/RIR/отдых) ── */}
                  {(() => {
                    const dayExercises = trainingDaysList[safeRuntimeDay]?.exercises || [];
                    if (!dayExercises.length) return null;
                    const totalSets = dayExercises.reduce((s: number, e: any) => s + (e.sets || 0), 0);
                    const estMin = Math.round((totalSets * 60 + 300) / 60);
                    return (
                      <div style={{ marginBottom: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => setDayDetailsOpen(v => !v)}
                          role="button"
                          aria-expanded={dayDetailsOpen}
                          aria-label="Детали плана дня"
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                            📋 План дня — {dayExercises.length} упр. · {totalSets} подходов · ~{estMin} мин
                          </span>
                          <span style={{ fontSize: 10, color: '#fff' }}>{dayDetailsOpen ? '▲' : '▼'}</span>
                        </div>
                        {dayDetailsOpen && (
                          <div style={{ padding: '0 10px 8px' }}>
                            {dayExercises.map((ex: any, i: number) => (
                              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
                                <span style={{ color: '#fff', minWidth: 16 }}>{i + 1}</span>
                                <span style={{ flex: 1, minWidth: 0, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ex.name}{ex.isCompound ? ' 🔴' : ''}
                                </span>
                                <span style={{ color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{ex.sets}×{ex.reps}</span>
                                <span style={{ color: '#fff', whiteSpace: 'nowrap' }}>{ex.weight ? `${ex.weight}кг` : 'в/т'}</span>
                                <span style={{ color: '#fff', whiteSpace: 'nowrap' }}>RIR {ex.rir ?? '—'}</span>
                                <span style={{ color: '#fff', whiteSpace: 'nowrap' }}>~{ex.restSec ?? 90}с</span>
                                {ex.technique && (
                                  <span style={{ color: '#fbbf24', whiteSpace: 'nowrap' }} title={ex.technique}>🎯</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {/* Session difficulty estimate */}
                  {(() => {
                    const dayExercises = trainingDaysList[safeRuntimeDay]?.exercises || [];
                    const totalSets = dayExercises.reduce((s: number, e: any) => s + (e.sets || 0), 0);
                    const avgIntensity = dayExercises.length > 0
                      ? dayExercises.reduce((s: number, e: any) => s + (e.intensity || 70), 0) / dayExercises.length
                      : 70;
                    const difficulty = totalSets > 25 ? 'очень тяжёлая' : totalSets > 15 ? 'средняя' : 'лёгкая';
                    const color = totalSets > 25 ? '#ef4444' : totalSets > 15 ? '#f59e0b' : '#22c55e';
                    return (
                      <div style={{ fontSize: 10, margin: '6px 0', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                        <span style={{ color: '#fff' }}>Сложность: </span>
                        <span style={{ fontWeight: 600, color }}>{difficulty}</span>
                        <span style={{ color: '#fff', marginLeft: 6 }}>· {totalSets} подходов · ~{avgIntensity.toFixed(0)}% ср.</span>
                        {totalSets > 25 && (
                          <div style={{ color: '#f97316', marginTop: 2 }}>⚠ Высокий объём — отдых ≥ 3 мин между подходами</div>
                        )}
                      </div>
                    );
                  })()}
                  {/* ── Красивая разминка дня — по группам, суставы+активация+подводящие (мемоизировано, не пересоздаём на тиках) ── */}
                  {warmupMemo.dayExercises.length > 0 && (() => {
                    const dayExercises = warmupMemo.dayExercises;
                    const groups = warmupMemo.groups;
                    const warmupBlocksExec = warmupMemo.blocks;
                    const total = warmupMemo.total;
                    const done = warmupDoneCount;
                    const pct = warmupPct;
                    const mins = warmupMemo.mins;
                    return (
                      <div style={{
                        margin: '8px 0', borderRadius: 14, overflow: 'hidden',
                        background: 'linear-gradient(135deg, rgba(249,115,22,0.09), rgba(167,139,250,0.06))',
                        border: '1px solid rgba(249,115,22,0.18)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                      }}>
                        <div
                          role="button" tabIndex={0}
                          onClick={() => setWarmupOpen(v => !v)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWarmupOpen(v => !v); } }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                          aria-expanded={warmupOpen} aria-label="Разминка дня"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', flexShrink: 0 }}><NativeIcon name="zap" size={14} /></span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', lineHeight: 1 }}>Разминка дня · персональная</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {groups.length > 0 ? groups.join(', ') : 'общая'} · {warmupBlocksExec.length} блока · {total} пунктов · ~{mins} мин
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 20, background: pct === 100 ? '#22c55e' : 'rgba(255,255,255,0.07)', color: pct === 100 ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>{done}/{total} · {pct}%</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{warmupOpen ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {warmupOpen && (
                          <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg,#f97316,#fb923c)', transition: 'width 0.3s ease' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                              {(['quick','standard','full'] as const).map(m => {
                                const active = execWarmupMode === m;
                                const cfg = m === 'quick' ? { label: 'Быстро', sub: '5м', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' } : m === 'standard' ? { label: 'Стандарт', sub: '9м', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.28)' } : { label: 'Полная', sub: '14м', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.28)' };
                                return (
                                  <button key={m} onClick={() => {
                                    setExecWarmupMode(m);
                                    try { localStorage.setItem('he_warmup_mode', m); } catch {}
                                    setExecWarmupDone({});
                                  }} style={{ flex: 1, minWidth: 60, padding: '4px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700, background: active ? cfg.bg : 'rgba(255,255,255,0.04)', color: active ? cfg.color : 'rgba(255,255,255,0.55)', border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.07)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                    <span>{cfg.label}</span><span style={{ fontSize: 7, opacity: 0.85 }}>{cfg.sub}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {warmupBlocksExec.map((b, bi) => {
                              const meta = b.type === 'general' ? { icon: 'activity' as const, title: 'Общая', color: '#06b6d4', bg: 'rgba(6,182,214,0.08)', border: 'rgba(6,182,214,0.22)' }
                                : b.type === 'mobility' ? { icon: 'move' as const, title: 'Суставы + зоны', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)' }
                                : b.type === 'activation' ? { icon: 'zap' as const, title: 'Активация', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)' }
                                : { icon: 'dumbbell' as const, title: 'Подводящие', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)' };
                              const bTotal = b.exercises.length;
                              const bDone = b.exercises.filter((_: any, j: number) => execWarmupDone[`ew_${bi}_${j}`]).length;
                              const bPct = bTotal > 0 ? Math.round(bDone / bTotal * 100) : 0;
                              return (
                                <div key={bi} style={{ borderRadius: 10, padding: '8px 8px 6px', background: bDone === bTotal && bTotal > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${bDone === bTotal && bTotal > 0 ? 'rgba(34,197,94,0.18)' : meta.border}`, borderLeft: `3px solid ${bDone === bTotal && bTotal > 0 ? '#22c55e' : meta.color}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: bDone === bTotal && bTotal > 0 ? '#22c55e' : meta.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}><NativeIcon name={meta.icon} size={11} /> {meta.title}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, display: 'inline-flex', alignItems: 'center', gap: 3 }}><NativeIcon name="clock" size={8} /> {b.durationSec}с · {bDone}/{bTotal}</span>
                                  </div>
                                  {b.notes && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', marginBottom: 5, lineHeight: 1.3 }}>{b.notes}</div>}
                                  <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 6 }}>
                                    <div style={{ height: '100%', width: `${bPct}%`, background: bDone === bTotal && bTotal > 0 ? '#22c55e' : meta.color, transition: 'width 0.3s ease' }} />
                                  </div>
                                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {b.exercises.map((ex: any, j: number) => {
                                      const isDone = !!execWarmupDone[`ew_${bi}_${j}`];
                                      const isSpec = 'intensityPct' in ex && (ex as any).intensityPct;
                                      const elabel = isSpec ? warmupSpecificLabel(ex.exerciseId) : warmupLabel(ex.exerciseId);
                                      const edose = isSpec ? `${(ex as any).intensityPct}% · ${ex.sets}×${ex.reps}` : `${ex.sets}×${ex.reps}`;
                                      return (
                                        <li key={j} style={{ listStyle: 'none' }}>
                                          <button type="button" aria-pressed={isDone} aria-label={`${elabel} — ${isDone ? 'выполнено' : 'отметить'}`}
                                            onClick={() => setExecWarmupDone(prev => ({ ...prev, [`ew_${bi}_${j}`]: !prev[`ew_${bi}_${j}`] }))}
                                            style={{
                                              width: '100%', display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 9px', borderRadius: 11, cursor: 'pointer', textAlign: 'left', minWidth: 0,
                                              background: isDone ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.07))' : 'rgba(255,255,255,0.035)',
                                              border: `1px solid ${isDone ? 'rgba(34,197,94,0.24)' : 'rgba(255,255,255,0.06)'}`,
                                              borderLeft: `3px solid ${isDone ? '#22c55e' : meta.color}`,
                                              boxShadow: isDone ? '0 2px 10px rgba(34,197,94,0.14)' : '0 1px 6px rgba(0,0,0,0.08)',
                                              opacity: isDone ? 0.92 : 1, transition: 'all 0.2s',
                                            }}>
                                            <span style={{
                                              width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                                              background: isDone ? 'linear-gradient(135deg,#22c55e,#16a34a)' : `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)`,
                                              color: '#fff', fontSize: 11, fontWeight: 800, boxShadow: `0 2px 7px ${isDone ? 'rgba(34,197,94,0.26)' : meta.color + '33'}`,
                                            }}>{isDone ? '✓' : (j + 1)}</span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                              <span style={{ fontSize: 10.5, fontWeight: isDone ? 600 : 700, color: isDone ? 'rgba(255,255,255,0.74)' : '#fff', textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.3, display: 'block', wordBreak: 'break-word' }}>{elabel}</span>
                                              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 3 }}>
                                                <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 20, background: isDone ? 'rgba(34,197,94,0.13)' : meta.bg, color: isDone ? '#86efac' : meta.color, border: `1px solid ${isDone ? 'rgba(34,197,94,0.20)' : meta.border}` }}>{edose}</span>
                                                {'note' in ex && (ex as any).note && <span style={{ fontSize: 10, color: isDone ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.58)', lineHeight: 1.3 }}>{(ex as any).note}</span>}
                                              </span>
                                            </span>
                                            <span style={{
                                              width: 22, height: 22, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                                              background: isDone ? '#22c55e' : 'rgba(255,255,255,0.06)', color: isDone ? '#000' : 'rgba(255,255,255,0.34)',
                                              border: `1px solid ${isDone ? '#22c55e' : 'rgba(255,255,255,0.08)'}`, fontSize: 10, fontWeight: 800,
                                            }}>{isDone ? '✓' : '○'}</span>
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              );
                            })}
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 1.3 }}>
                              Отмечайте пункты — прогресс сохранится до старта · без ленты — bodyweight-замены уже включены · подводящие — с % и кг в подсказке
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <button onClick={() => {
                    try {
                      const dayExercises: any[] = trainingDaysList[safeRuntimeDay]?.exercises || [];
                      const groups = groupsFromExercises(dayExercises.map((e: any) => ({ name: e.name })));
                      const warmupBlocksExec = generateWarmup({
                        sessionFocus: 'fullbody',
                        primaryExercises: dayExercises.slice(0, 3).map((e: any) => e.name),
                        primaryWeights: dayExercises.slice(0, 3).map((e: any) => (typeof e.weight === 'number' ? e.weight : null) as any),
                        targetGroups: groups.length > 0 ? groups : ['fullbody'],
                        riskFlags: {}, techniqueIssues: [], fatigueLevel: 0.2, equipmentAvailable: ['barbell','dumbbell','band','bodyweight'],
                        mode: execWarmupMode,
                      });
                      const total = warmupBlocksExec.reduce((s,b)=>s+b.exercises.length,0);
                      const done = Object.values(execWarmupDone).filter(Boolean).length;
                      upsertWarmupLog({ date: localIsoDate(), done: done>0, quality: done>0 ? (done/total>=0.8?4: done/total>=0.5?3:2) : null, totalItems: total, doneItems: done });
                    } catch {}
                    setRuntimeStarted(true); setRuntimeLogs({}); setRuntimeExIdx(0);
                  }} style={{
                     width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
                     background: 'linear-gradient(135deg, var(--accent), var(--accent-2, #00c853))', color: 'var(--accent-contrast, #000)', fontWeight: 700, fontSize: 14,
                   }}> <span style={{ display:'inline-flex', verticalAlign:'-2px', marginRight:6 }}><NativeIcon name="play" size={13} /></span>Старт</button>
                    {onGoToTimers && (() => {
                      const dayExercises = trainingDaysList[safeRuntimeDay]?.exercises || [];
                      const compoundCount = dayExercises.filter((e: any) => ['squat','bench','deadlift','overhead','row','pull','lunge','hip','leg'].some(p => (e.name || '').toLowerCase().includes(p))).length;
                      const isolationCount = dayExercises.length - compoundCount;
                      const avgRest = dayExercises.length > 0 ? Math.round(dayExercises.reduce((s: number, e: any) => s + (e.restSec || 90), 0) / dayExercises.length) : 90;
                      const rounds = Math.max(3, dayExercises.length);
                      const work = Math.max(45, Math.min(180, avgRest));
                       return (
                         <button onClick={() => { setTimerInitialSettings({ work, rest: avgRest, rounds }); onGoToTimers?.({ work, rest: avgRest, rounds }); }} style={{
                          width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                          background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontWeight: 600, fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                          <NativeIcon name="clock" size={12} /> Таймер для этого дня · отдых ~{avgRest}с · {rounds} раундов
                        </button>
                      );
                    })()}
                    
                    {/* Прогресс по упражнениям дня из кэша */}
                    {(() => {
                      const dayExercises = trainingDaysList[safeRuntimeDay]?.exercises || [];
                      if (!dayExercises.length) return null;
                      return (
                        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📈 Прогресс по упражнениям дня</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                            {dayExercises.slice(0, 6).map((ex: any, i: number) => {
                              const cached = getCachedProgressForExercise(ex.name || ex.id || '');
                              if (!cached) return (
                                <div key={i} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{ex.name || ex.id}</div>
                                  <div style={{ fontSize: 10, color: '#fff' }}>Нет данных</div>
                                </div>
                              );
                              const trendIcon = cached.trend === 'up' ? '↑' : cached.trend === 'down' ? '↓' : '→';
                              const trendColor = cached.trend === 'up' ? '#22c55e' : cached.trend === 'down' ? '#ef4444' : '#fff';
                              return (
                                <div key={i} style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{cached.exerciseName}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#fff' }}>
                                    <span>1RM {cached.bestE1RM}кг</span>
                                    <span style={{ color: trendColor }}>{trendIcon} {cached.e1RMDelta > 0 ? '+' : ''}{cached.e1RMDelta}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#fff', marginTop: 2 }}>
                                    <span>Объём {cached.totalVolume.toLocaleString()}</span>
                                    <span style={{ color: trendColor }}>{trendIcon} {cached.weightDelta > 0 ? '+' : ''}{cached.weightDelta}кг</span>
                                  </div>
                                  <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{cached.sessions} сессий · {cached.lastDate}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#fff', fontSize: 11 }}>
                  Сначала сгенерируйте план во вкладке 📋 План
                </div>
              )}
            </div>
          ) : (
            // Проведение: проф-плеер (разминка → подходы → заминка → итоги).
            // Логирование сетов, блины, VBT, RIR, сравнение с прошлой сессией,
            // таймер отдыха, автосейв живой сессии — всё в SessionPlayer.
            <div className="card" style={{ padding: '10px 12px', border: '1px solid rgba(var(--train-accent-rgb, 0,230,138),0.22)', background: 'rgba(var(--train-accent-rgb, 0,230,138),0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <NativeIcon name="play" size={12} /> Проведение тренировки
                  </h3>
                  <p style={{ fontSize: 10, color: '#fff', margin: '2px 0 0' }}>
                    {trainingDaysList[safeRuntimeDay]?.day || `День ${safeRuntimeDay + 1}`} · неделя {selectedWeek}
                    {trainingDaysList[safeRuntimeDay]?.exercises?.length ? ` · ${trainingDaysList[safeRuntimeDay].exercises.length} упр.` : ''}
                  </p>
                </div>
                <button onClick={() => { setRuntimeStarted(false); setRuntimeExIdx(0); }} aria-label="Свернуть проведение" style={{ padding: '8px 12px', minHeight: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <NativeIcon name="pause" size={10} /> Свернуть
                </button>
              </div>
              <SessionPlayer
                days={trainingDaysList.length > 0 ? [playerDayFromMicro(trainingDaysList[safeRuntimeDay])] : []}
                weekNumber={selectedWeek}
                focus={trainingOutput?.splitName || currentMicrocycle?.mesocycleType || trainingDaysList[safeRuntimeDay]?.day || 'Тренировка'}
                onSaved={loadDiaryStats}
              />
            </div>
          )}
        </div>
        </InfoErrorBoundary>
      )}
      {tab === 'timers' && <InfoErrorBoundary label="Таймеры"><TimersTab initialSettings={timerInitialSettings} /></InfoErrorBoundary>}
    </>
  );
};
