/**
 * SessionPlayer.tsx — T3: экран выполнения СРЦ/BB-плана (Этап INT1).
 * REUSE workout-logger.engine: startSession → addExerciseToSession → logSet → finishSession.
 * Mobile-first, dark theme. Принимает нормализованный план (дни → упражнения → целевые сеты).
 */
import React, { useMemo, useState } from 'react';
import {
  startSession, addExerciseToSession, logSet, finishSession,
  getLastSession, getRecentPRs, type WorkoutSession,
} from '../../../engines/workout-logger.engine';
import { generateWarmup, type WarmupInput } from '../../../engines/warmup.engine';
import { generateCooldown, type CooldownInput } from '../../../engines/cooldown.engine';
import { type WarmupBlock, type CooldownBlock } from '../../../core/types';
import { computeSessionMetrics } from './sessionMetrics';
import { hapticImpact, hapticNotify } from '../../../core/telegram';
import { velocityLoss, velocityLossZone, thresholdForIntent, type VBTIntent } from '../../../engines/pro/vbt.engine';
import { saveSRPESession } from '../../../engines/pro/srpe-store';
import { useTrainingProfile } from '../TrainingScreen_parts/training-profile';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 14, minHeight: 44 };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}` };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.4 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' };

export interface PlayerSet { weight: number; reps: number; rir: number }
export interface PlayerExercise {
  name: string;
  muscleGroup: string;
  targetSets: PlayerSet[];
  // LMS-поля для метрик (Этап D1). Передаются из плана; иначе — эвристика.
  pm?: number;       // предельный максимум упражнения (кг)
  coef?: number;     // Коэф. тяжести (1.2 / 1.0 / 0.3)
  mnosz?: number;    // Множ (множитель нагрузки)
  group?: string;    // группа LMS (ЖМ/ПР/ТГ/Ср)
}
export interface PlayerDay { label: string; exercises: PlayerExercise[] }

export interface SessionPlayerProps {
  days: PlayerDay[];
  weekNumber: number;
  focus: string;
}

export const SessionPlayer: React.FC<SessionPlayerProps> = ({ days, weekNumber, focus }) => {
  const [profile] = useTrainingProfile();
  const [dayIdx, setDayIdx] = useState(0);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [done, setDone] = useState<WorkoutSession | null>(null);
  const [warmupBlocks, setWarmupBlocks] = useState<WarmupBlock[]>([]);
  const [cooldownBlocks, setCooldownBlocks] = useState<CooldownBlock[]>([]);
  // фактический ввод текущего подхода: [exerciseIndex][setIndex] -> {weight,reps}
  const [actual, setActual] = useState<Record<string, { weight: number; reps: number; rpe: number }>>({});
  const [exDone, setExDone] = useState<Record<string, boolean>>({});
  // P11: VBT-ввод скорости штанги (м/с) на сет + авторегуляция по потере скорости
  const [vel, setVel] = useState<Record<string, number>>({});
  const [vbtIntent, setVbtIntent] = useState<VBTIntent>('strength');
  const [sessionRPE, setSessionRPE] = useState<number>(7);
  const [sessionDur, setSessionDur] = useState<number>(60);

  const day = days[dayIdx] || days[0];
  const last = useMemo(() => getLastSession(), [done]);
  const prs = useMemo(() => getRecentPRs(3), [done]);

  const begin = () => {
    if (!day) return;
    
    const warmupInput: WarmupInput = {
      sessionFocus: focus,
      primaryExercises: day.exercises.map(ex => ex.name),
      riskFlags: {}, // Need to get this from profile or somewhere? 
      techniqueIssues: [], // Need to get this from profile or somewhere?
      fatigueLevel: profile.fatigue / 10,
      equipmentAvailable: profile.equipment,
    };
    setWarmupBlocks(generateWarmup(warmupInput));

    let s = startSession(focus || day.label, weekNumber);
    day.exercises.forEach(ex => {
      s = addExerciseToSession(s, { id: ex.name, name: ex.name, pattern: ex.muscleGroup, muscleGroup: ex.muscleGroup });
    });
    setSession(s);
    setDone(null);
    setActual({});
    setExDone({});
    setCooldownBlocks([]);
  };

  const keyFor = (ei: number, si: number) => `${ei}_${si}`;

  const logOne = (ei: number, si: number) => {
    if (!session || !day) return;
    hapticImpact('light');
    const t = day.exercises[ei].targetSets[si];
    const a = actual[keyFor(ei, si)] || { weight: t.weight, reps: t.reps, rpe: 0 };
    let s = logSet(session, ei, { setNumber: si + 1, weightKg: a.weight, reps: a.reps, rpe: a.rpe || 0, rir: t.rir, notes: '' });
    setSession(s);
    setActual(prev => ({ ...prev, [keyFor(ei, si)]: a }));
    // пометить следующий подход/упражнение активным — UI сам покажет статус
  };

  const finish = () => {
    if (!session) return;
    hapticNotify('success');
    const finished = finishSession(session, `${focus} — ${day?.label}`);
    
    const cooldownInput: CooldownInput = {
      muscleGroupsUsed: Array.from(new Set(day.exercises.map(ex => ex.muscleGroup))),
      fatigueScore: profile.fatigue / 10,
      riskFlags: {}, 
      sessionDuration: (finished.durationMin || sessionDur) * 60,
    };
    setCooldownBlocks(generateCooldown(cooldownInput));

    // P12 wire: сохранить сессию с sRPE для мониторинга нагрузки (training-load.engine)
    try { saveSRPESession({ date: finished.date, sRPE: sessionRPE, durationMin: finished.durationMin || sessionDur }); } catch { /* ignore */ }
    setDone(finished);
    setSession(null);
  };

  // Плановые метрики дня
  const planned = useMemo(() => {
    if (!day) return { sets: 0, volume: 0 };
    let sets = 0, vol = 0;
    day.exercises.forEach(ex => ex.targetSets.forEach(t => { sets++; vol += t.weight * t.reps; }));
    return { sets, volume: Math.round(vol) };
  }, [day]);

  // Фактические метрики сессии
  const factVol = useMemo(() => {
    if (!session) return { volume: 0, sets: 0 };
    let v = 0, n = 0;
    session.exercises.forEach(ex => ex.sets.forEach(s => { v += s.weightKg * s.reps; n++; }));
    return { volume: Math.round(v), sets: n };
  }, [session]);

  // 1.4: оценка e1RM (Epley) по лучшему сету сессии
  const topE1RM = useMemo(() => {
    const src = done || session;
    if (!src) return { e1rm: 0, exercise: '', weight: 0, reps: 0 };
    let best = { e1rm: 0, exercise: '', weight: 0, reps: 0 };
    src.exercises.forEach(ex => ex.sets.forEach(s => { if (s.weightKg > 0 && s.reps > 0) { const e = Math.round(s.weightKg * (1 + s.reps / 30)); if (e > best.e1rm) best = { e1rm: e, exercise: ex.exerciseName, weight: s.weightKg, reps: s.reps }; } }));
    return best;
  }, [done, session]);

  // 2.1/2.2: двойная прогрессия + рекомендация делода по завершённой сессии
  const nextSuggestions = useMemo(() => {
    if (!done || !day) return [];
    return day.exercises.map((ex, ei) => {
      const sesEx = done.exercises[ei];
      if (!sesEx || sesEx.sets.length === 0) return null;
      const target = ex.targetSets[0];
      if (!target) return null;
      const sets = sesEx.sets;
      const avgReps = sets.reduce((s: number, x: any) => s + x.reps, 0) / sets.length;
      const maxRPE = Math.max(0, ...sets.map((x: any) => x.rpe || 0));
      const inc = target.weight >= 40 ? 2.5 : 1;
      const hitTarget = avgReps >= target.reps;
      let nextWeight = target.weight, nextReps = target.reps, note = '', deload = false;
      if (hitTarget) { nextWeight = target.weight + inc; note = `Прогрессия: +${inc}кг (цель ${target.reps}повт достигнута${maxRPE <= 8 ? ' при RPE≤8' : ''})`; }
      else if (avgReps < target.reps - 1) { note = `Удержать ${target.weight}кг — добрать повторы до ${target.reps}`; }
      else { note = 'Почти в цель — повторить вес, добавить 1 повтор'; nextReps = target.reps; }
      if (maxRPE >= 9 && sets.length >= 3) { deload = true; note = note + ' · высокий RPE — рассмотреть делод (−15-20% объём)'; }
      return { name: ex.name, nextWeight, nextReps, note, deload };
    }).filter(Boolean) as { name: string; nextWeight: number; nextReps: number; note: string; deload: boolean }[];
  }, [done, day]);

  const anyDeload = nextSuggestions.some(s => s.deload);

  // D1: LMS-метрики фактической сессии (Тоннаж/КПШ/Инт.отн/УОИ/Инт.Ф+Б) — считаются для done-состояния
  const lms = useMemo(() => computeSessionMetrics(done, day), [done, day]);

  if (days.length === 0) return <div style={SMALL}>Нет дней в плане.</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {days.map((d, i) => (
          <button key={i} style={i === dayIdx ? BTN : BTN_GHOST} onClick={() => setDayIdx(i)}>{d.label}</button>
        ))}
      </div>

       {!session && !done && (
        <div style={{ marginTop: 8 }}>
          {warmupBlocks.length > 0 && (
            <div style={{ ...CARD, marginBottom: 8 }}>
              <div style={H}>🤸 Разминка перед: {day.label}</div>
              {warmupBlocks.map((b: WarmupBlock, i: number) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{b.type.toUpperCase()}</div>
                  <div style={SMALL}>{b.notes}</div>
                  <ul style={{ paddingLeft: 16, margin: '2px 0' }}>
                    {b.exercises.map((ex, j: number) => <li key={j} style={SMALL}>{ex.exerciseId}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <button style={{ ...BTN, width: '100%' }} onClick={begin}>▶ Начать тренировку — {day.label} (нед {weekNumber})</button>
        </div>
      )}


      {session && (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={H}>🏃 {day.label}</div>
            <button style={BTN} onClick={finish}>⏹ Завершить</button>
          </div>
          <div style={{ ...SMALL, marginBottom: 6 }}>План: {planned.sets} сетов / {planned.volume} кг·пов · Факт: {factVol.sets} сетов / {factVol.volume} кг·пов</div>
          {/* P12: sRPE для мониторинга нагрузки (сохранится при завершении) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>sRPE сессии:</span>
            {[6,7,8,9,10].map(r => <button key={r} onClick={() => setSessionRPE(r)} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: sessionRPE===r?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: sessionRPE===r?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.02)', color: sessionRPE===r?'#00e68a':'var(--text-dim)' }}>{r}</button>)}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>· длительность, мин:</span>
            <input style={{ ...IN, width: 64 }} type="number" value={sessionDur} onChange={e => setSessionDur(+e.target.value)} aria-label="длительность мин" />
          </div>
          {day.exercises.map((ex, ei) => (
            <div key={ei} style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{ex.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>({ex.muscleGroup})</span></div>
              {ex.targetSets.map((t, si) => {
                const k = keyFor(ei, si);
                const a = actual[k] || { weight: t.weight, reps: t.reps, rpe: 0 };
                const logged = !!actual[k];
                const targetRPE = 10 - t.rir;
                const dW = a.weight - t.weight;
                const dR = a.reps - t.reps;
                const rpeDelta = a.rpe > 0 ? a.rpe - targetRPE : 0;
                const nextW = a.rpe > 0 ? (rpeDelta > 0 ? Math.max(0, a.weight - 2.5) : rpeDelta < -1 ? a.weight + 2.5 : a.weight) : a.weight;
                const nextR = a.rpe > 0 ? (rpeDelta > 1 ? Math.max(1, a.reps - 1) : a.reps) : a.reps;
                return (
                  <div key={si} style={{ ...ROW, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 52 }}>Сет {si + 1}</span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, width: 90 }}>цель {t.weight}кг×{t.reps}@RIR{t.rir}</span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input style={{ ...IN, width: 60 }} type="number" value={a.weight} onChange={e => setActual(p => ({ ...p, [k]: { weight: +e.target.value, reps: a.reps, rpe: a.rpe } }))} aria-label="вес" />
                      <input style={{ ...IN, width: 48 }} type="number" value={a.reps} onChange={e => setActual(p => ({ ...p, [k]: { weight: a.weight, reps: +e.target.value, rpe: a.rpe } }))} aria-label="повт" />
                      <input style={{ ...IN, width: 44 }} type="number" min={0} max={10} placeholder="RPE" value={a.rpe || ""} onChange={e => setActual(p => ({ ...p, [k]: { weight: a.weight, reps: a.reps, rpe: +e.target.value } }))} aria-label="RPE" />
                      <input style={{ ...IN, width: 48 }} type="number" step="0.01" placeholder="v" value={vel[k] ?? ""} onChange={e => setVel(p => ({ ...p, [k]: +e.target.value }))} aria-label="скорость м/с" />
                      <button style={logged ? BTN_GHOST : BTN} onClick={() => logOne(ei, si)}>{logged ? '✓' : 'OK'}</button>
                    </div>
                    {logged && (
                      <div style={{ width: '100%', fontSize: 10, color: 'rgba(255,255,255,0.55)', paddingLeft: 56, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>факт <b style={{ color: '#fff' }}>{a.weight}кг×{a.reps}</b>{a.rpe > 0 ? `@RPE${a.rpe}` : ''}</span>
                        <span style={{ color: dW === 0 ? 'var(--text-dim)' : dW > 0 ? '#22c55e' : '#f59e0b' }}>Δвес {dW > 0 ? '+' : ''}{dW}</span>
                        <span style={{ color: dR === 0 ? 'var(--text-dim)' : dR > 0 ? '#22c55e' : '#f59e0b' }}>Δповт {dR > 0 ? '+' : ''}{dR}</span>
                        {a.rpe > 0 && <span style={{ color: rpeDelta > 0 ? '#ef4444' : rpeDelta < -1 ? '#22c55e' : 'var(--text-dim)' }}>RPE vs цели({targetRPE}): {rpeDelta > 0 ? '+' : ''}{rpeDelta}</span>}
                        {a.rpe > 0 && (rpeDelta > 0 || rpeDelta < -1) && (
                          <span style={{ color: ACCENT, fontWeight: 700 }}>→ след. сет: {nextW}кг×{nextR}{rpeDelta > 0 ? ' (легче)' : ' (тяжелее)'}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* P11: VBT-авторегуляция по потере скорости (если введены скорости) */}
              {(() => {
                const vels = ex.targetSets.map((t, si) => vel[keyFor(ei, si)]).filter(v => v && v > 0);
                if (vels.length < 2) return null;
                const thr = thresholdForIntent(vbtIntent);
                const vl = velocityLoss(vels, thr);
                if (!vl) return null;
                const zone = velocityLossZone(vl.lossPct);
                return <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, background: vl.exceeded ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,138,0.08)', border: '1px solid ' + (vl.exceeded ? 'rgba(239,68,68,0.3)' : 'rgba(0,230,138,0.2)') }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: vl.exceeded ? '#ef4444' : ACCENT }}>⚡ VBT: потеря скорости {vl.lossPct}% ({vl.bestVelocity}→{vl.lastVelocity} м/с, порог {thr}%)</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{vl.exceeded ? '🔴 СТОП — порог превышен, заканчивайте сет' : '🟢 ещё ~' + vl.remainingReps + ' повторов до порога'} · {zone}</div>
                </div>;
              })()}
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>VBT-интент:</span>
                {(['strength','hypertrophy','power_heavy','speed'] as VBTIntent[]).map(it => (
                  <button key={it} onClick={() => setVbtIntent(it)} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: vbtIntent===it?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: vbtIntent===it?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.02)', color: vbtIntent===it?'#00e68a':'var(--text-dim)' }}>{it}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {done && (
        <div style={CARD}>
          <div style={H}>✅ Тренировка завершена</div>
          <div style={SMALL}>{done.date} · {done.startTime}–{done.endTime} · фокус: {done.focus}</div>
          <div style={ROW}><span>Сессий записано всего:</span><span style={{ color: ACCENT }}>{getLastSession() ? 'сохранено в дневник' : '—'}</span></div>
          <div style={ROW}><span>Объём факт vs план:</span><span style={{ color: ACCENT }}>{factVol.volume} / {planned.volume} кг·пов</span></div>
          <div style={ROW}><span>Сеты факт vs план:</span><span style={{ color: ACCENT }}>{factVol.sets} / {planned.sets}</span></div>
          <div style={{ ...SMALL, marginTop: 8 }}>Реализация объёма: {planned.volume > 0 ? Math.round(factVol.volume / planned.volume * 100) : 0}%</div>
          {topE1RM.e1rm > 0 && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>🎯 Оценка 1RM (Epley) по лучшему сету</div>
              <div style={{ ...SMALL, marginTop: 4 }}><b style={{ color: '#fff' }}>{topE1RM.exercise}</b>: {topE1RM.weight}кг×{topE1RM.reps} → e1RM ≈ <b style={{ color: '#60a5fa' }}>{topE1RM.e1rm} кг</b></div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Обновите workMax для этой группы в профиле, если e1RM выше текущего — веса в плане пересчитаются.</div>
            </div>
          )}
          {nextSuggestions.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: anyDeload ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.05)', border: '1px solid ' + (anyDeload ? 'rgba(239,68,68,0.25)' : 'rgba(0,230,138,0.18)') }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: anyDeload ? '#ef4444' : ACCENT, marginBottom: 6 }}>{anyDeload ? '⚠ Прогрессия + сигнал делода' : '📈 Прогрессия к следующей сессии (double progression)'}</div>
              {anyDeload && <div style={{ fontSize: 10, color: '#fca5a5', marginBottom: 6 }}>Высокий RPE на нескольких сетах — рассмотрите делод-неделю (−15-20% объём, удержание интенсивности) перед следующей прогрессией.</div>}
              {nextSuggestions.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 4, paddingLeft: 4, borderLeft: '2px solid ' + (s.deload ? '#ef4444' : 'rgba(0,230,138,0.4)') }}>
                  <b style={{ color: '#fff' }}>{s.name}</b> → след. {s.nextWeight}кг×{s.nextReps}. <span style={{ color: 'var(--text-dim)' }}>{s.note}</span>
                </div>
              ))}
            </div>
          )}
          {lms && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)' }}>
              <div style={{ ...LABEL, color: ACCENT }}>📊 LMS-метрики сессии ({lms.exerciseCount} упр.)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                <div style={SMALL}>Тоннаж: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.tonnage)}</b> кг</div>
                <div style={SMALL}>КПШ: <b style={{ color: '#fff' }}>{lms.metrics.kpsh}</b></div>
                <div style={SMALL}>Инт.отн: <b style={{ color: '#fff' }}>{lms.metrics.relIntensity.toFixed(3)}</b></div>
                <div style={SMALL}>УОИ: <b style={{ color: '#fff' }}>{lms.metrics.uoi.toFixed(3)}</b></div>
                <div style={SMALL}>Инт.Ф+Б: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.intFB)}</b></div>
                <div style={SMALL}>Ср.вес: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.avgWeight)}</b> кг · {lms.minutes} мин</div>
              </div>
            </div>
          )}
          {prs.length > 0 && <div style={{ marginTop: 8 }}><div style={LABEL}>🏆 Последние PR:</div>{prs.map((p, i) => <div key={i} style={SMALL}>• {p.exercise}: {p.weight}кг×{p.reps} ({p.date})</div>)}</div>}
          {cooldownBlocks.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.1)' }}>
              <div style={H}>🧘 Рекомендованная заминка</div>
              {cooldownBlocks.map((b: CooldownBlock, i: number) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{b.type.toUpperCase()}</div>
                  <ul style={{ paddingLeft: 16, margin: '2px 0' }}>
                    {b.exercises.map((ex, j: number) => <li key={j} style={SMALL}>{ex.exerciseId}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <button style={{ ...BTN_GHOST, width: '100%', marginTop: 8 }} onClick={() => { setDone(null); setWarmupBlocks([]); setCooldownBlocks([]); }}>← Новая тренировка</button>
        </div>
      )}

      {!session && !done && last && (
        <div style={{ ...CARD, marginTop: 8 }}>
          <div style={LABEL}>⏱ Последняя сессия</div>
          <div style={SMALL}>{last.date} {last.startTime}–{last.endTime} · {last.focus} · {last.exercises.length} упр.</div>
        </div>
      )}
    </div>
  );
};

export default SessionPlayer;
