import React, { useMemo, useState, useRef, useEffect } from 'react';
import { autoSchedule, detectOvertraining, type AutoScheduleOutput, type ScheduledWeek } from '../../../engines/overtraining-scheduler.engine';
import { loadSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../../engines/pro/training-load.engine';
import { useDataLink } from '../../../core/data-link';
import { DeloadProtocolCard } from './DeloadProtocolCard';
import { applyToPlanner } from './planner-bridge';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: '12px', margin: '6px 0' };
const ACCENT = '#00e68a';

const PHASE_COLORS: Record<ScheduledWeek['phase'], string> = {
  accumulation: '#22c55e',
  intensification: '#eab308',
  peaking: '#ef4444',
  deload: '#60a5fa',
  active_rest: '#a855f7',
};

const PHASE_LABELS_RU: Record<ScheduledWeek['phase'], string> = {
  accumulation: 'Накопление',
  intensification: 'Интенсификация',
  peaking: 'Пик',
  deload: 'Разгрузка',
  active_rest: 'Активный отдых',
};

const SYMPTOM_LABELS: Record<string, string> = {
  moodDisturbance: 'Сбитый настрой',
  appetiteLoss: 'Потеря аппетита',
  frequentIllness: 'Частые ОРВИ',
  jointPainIncrease: 'Боли в суставах',
  libidoDecrease: 'Снижение либидо',
};

export const DeloadSchedulerTab: React.FC = () => {
  const linked = useDataLink();
  const [goal, setGoal] = useState<'strength' | 'hypertrophy' | 'peaking' | 'recomposition'>('strength');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [weeksUntilGoal, setWeeksUntilGoal] = useState<number>(12);
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [showOvertraining, setShowOvertraining] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<number, ScheduledWeek['phase']>>(() => {
    try { return JSON.parse(localStorage.getItem('he_deload_overrides') || '{}'); } catch { return {}; }
  });
  const [sessions, setSessions] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_deload_sessions') || '[]'); } catch { return []; }
  });
  const [otSymptoms, setOtSymptoms] = useState<Record<string, boolean>>({
    moodDisturbance: false,
    appetiteLoss: false,
    frequentIllness: false,
    jointPainIncrease: false,
    libidoDecrease: false,
  });
  const [perfDecline, setPerfDecline] = useState(0);
  const [restingHR, setRestingHR] = useState(0);

  const srpeSessions = useMemo(() => loadSRPESessions(), []);
  const acwr = useMemo(() => {
    if (srpeSessions.length < 2) return null;
    return acuteChronicRatio(toDailyLoads(srpeSessions));
  }, [srpeSessions]);

  const monotonyResult = useMemo(() => {
    if (srpeSessions.length < 7) return null;
    return weeklyMonotony(toDailyLoads(srpeSessions));
  }, [srpeSessions]);

  const otInput = useMemo(() => ({
    performanceDecline: perfDecline,
    hrvSuppression: (1 - (linked.profile?.settings?.baselineHrvRatio ?? 1)) * 50,
    restingHRIncrease: restingHR,
    sleepHours: (linked.readiness?.sleep ?? 7) / (100 / 7),
    sleepQuality: Math.round((linked.readiness?.sleep ?? 70) / 20),
    moodDisturbance: otSymptoms.moodDisturbance,
    appetiteLoss: otSymptoms.appetiteLoss,
    frequentIllness: otSymptoms.frequentIllness,
    jointPainIncrease: otSymptoms.jointPainIncrease,
    trainingMotivation: Math.round((100 - (linked.readiness?.fatigue ?? 30)) / 20),
    rpeInflation: (acwr?.ratio ?? 0) > 1.5,
    recoveryTimeExtension: (100 - (linked.readiness?.recovery ?? 80)) > 40,
    libidoDecrease: otSymptoms.libidoDecrease,
  }), [linked.readiness, linked.profile, acwr, otSymptoms, perfDecline, restingHR]);

  const otResult = useMemo(() => detectOvertraining(otInput), [otInput]);
  const fatigueLevel = (linked.readiness?.fatigue ?? 30) / 10;
  const recoveryLevel = (linked.readiness?.recovery ?? 80) / 10;
  const overtraining = otInput;
  const deloadGoal = goal as 'strength' | 'hypertrophy' | 'maintenance' | 'peaking' | 'rehab';

  const schedule: AutoScheduleOutput = useMemo(() => {
    const base = autoSchedule({
      goal,
      level,
      weeksUntilGoal,
      currentWeek,
      fatigueLevel: (linked.readiness?.fatigue ?? 30) / 100,
      recoveryLevel: (linked.readiness?.recovery ?? 80) / 100,
      overtrainingRisk: otResult.riskPercent,
      acwr: acwr?.ratio ?? null,
      monotony: monotonyResult?.monotony ?? null,
      strain: monotonyResult?.strain ?? null,
    });

    const weeks = base.weeks.map(w => ({
      ...w,
      phase: manualOverrides[w.week] || w.phase
    }));

    return {
      ...base,
      weeks,
      deloadWeeks: weeks.filter(w => w.phase === 'deload' || w.phase === 'active_rest').map(w => w.week)
    };
  }, [goal, level, weeksUntilGoal, currentWeek, linked.readiness, otResult.riskPercent, manualOverrides, acwr, monotonyResult]);

  const cyclePhase = (week: number) => {
    const phases: ScheduledWeek['phase'][] = ['accumulation', 'intensification', 'peaking', 'deload', 'active_rest'];
    const current = manualOverrides[week] || schedule.weeks.find(w => w.week === week)?.phase || 'accumulation';
    const nextIdx = (phases.indexOf(current) + 1) % phases.length;
    setManualOverrides(p => ({ ...p, [week]: phases[nextIdx] }));
  };

  useEffect(() => {
    localStorage.setItem('he_deload_overrides', JSON.stringify(manualOverrides));
  }, [manualOverrides]);

  const saveSession = () => {
    const name = window.prompt('Название сессии:', 'План ' + new Date().toLocaleDateString());
    if (!name) return;
    const newSession = {
      name,
      date: new Date().toISOString(),
      config: { goal, level, weeksUntilGoal, currentWeek, manualOverrides }
    };
    const updated = [newSession, ...sessions].slice(0, 20);
    setSessions(updated);
    localStorage.setItem('he_deload_sessions', JSON.stringify(updated));
  };

  const loadSession = (s: any) => {
    const { goal: g, level: l, weeksUntilGoal: w, currentWeek: cw, manualOverrides: mo } = s.config;
    setGoal(g); setLevel(l); setWeeksUntilGoal(w); setCurrentWeek(cw); setManualOverrides(mo);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🧘 Планировщик делода</div>
      <div style={{ fontSize: 10, color: '#fff', marginBottom: 12, lineHeight: 1.5 }}>
        Авто-расписание разгрузочных недель по накопленной усталости (sRPE ACWR, HRV, сон, восстановление).
        Система анализирует 12 маркеров перетренированности и строит понедельный план с делодами.
      </div>

       <div style={CARD}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
           <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>💾 Сохранённые сессии</div>
           <button onClick={saveSession} style={{ padding: '4px 8px', borderRadius: 6, background: ACCENT, color: '#000', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Сохранить текущий</button>
         </div>
         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
           {sessions.length === 0 ? (
             <div style={{ fontSize: 10, color: '#fff' }}>Нет сохранённых сессий</div>
           ) : (
             sessions.map((s, i) => (
               <div 
                 key={i} 
                 onClick={() => loadSession(s)}
                 style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 10, cursor: 'pointer', transition: 'all 0.2s' }}
               >
                 {s.name}
               </div>
             ))
           )}
         </div>
       </div>

       {/* Базовые параметры */}

      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Параметры планирования</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 3 }}>Цель</div>
            <select value={goal} onChange={e => setGoal(e.target.value as any)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none' }}>
              <option value="strength">Сила</option>
              <option value="hypertrophy">Гипертрофия</option>
              <option value="peaking">Выход на пик</option>
              <option value="recomposition">Рекомпозиция</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 3 }}>Уровень</div>
            <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none' }}>
              <option value="beginner">Новичок</option>
              <option value="intermediate">Средний</option>
              <option value="advanced">Продвинутый</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 3 }}>Недель до цели</div>
            <input type="number" min={4} max={52} value={weeksUntilGoal} onChange={e => setWeeksUntilGoal(+e.target.value || 12)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 3 }}>Текущая неделя</div>
            <input type="number" min={0} max={weeksUntilGoal - 1} value={currentWeek} onChange={e => setCurrentWeek(+e.target.value || 0)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {/* sRPE / ACWR статус */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📊 Данные нагрузки (sRPE)</div>
        {srpeSessions.length === 0 ? (
          <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', padding: 12 }}>
            Нет sRPE-сессий. Ведите дневник нагрузки через «Проведение тренировки» — данные появятся здесь.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 10, color: '#fff' }}>Сессий</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{srpeSessions.length}</div>
            </div>
            {acwr && (
              <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: acwr.ratio > 1.5 ? 'rgba(239,68,68,0.08)' : acwr.ratio > 1.3 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.06)' }}>
                <div style={{ fontSize: 10, color: '#fff' }}>ACWR</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: acwr.ratio > 1.5 ? '#ef4444' : acwr.ratio > 1.3 ? '#f59e0b' : '#22c55e' }}>{acwr.ratio.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: '#fff' }}>{acwr.zone === 'dangerous' ? 'ОПАСНО' : acwr.zone === 'caution' ? 'Осторожно' : acwr.zone === 'optimal' ? 'Оптимум' : 'Недотрен'}</div>
              </div>
            )}
            {monotonyResult && (
              <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: monotonyResult.monotony > 2 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 10, color: '#fff' }}>Монотонность</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: monotonyResult.monotony > 2 ? '#ef4444' : ACCENT }}>{monotonyResult.monotony.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: '#fff' }}>Strain: {Math.round(monotonyResult.strain)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Детектор перетренированности */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowOvertraining(v => !v)}>
          <div style={{ fontSize: 12, fontWeight: 700, color: otResult.riskPercent >= 50 ? '#ef4444' : otResult.riskPercent >= 25 ? '#f59e0b' : '#22c55e' }}>
            🩺 Детектор перетренированности: {otResult.totalScore}/{otResult.maxScore} ({otResult.riskPercent}%)
          </div>
          <span style={{ fontSize: 10, color: '#fff' }}>{showOvertraining ? '▴' : '▾'}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: otResult.riskPercent + '%', borderRadius: 3, background: otResult.riskPercent >= 50 ? '#ef4444' : otResult.riskPercent >= 25 ? '#f59e0b' : '#22c55e', transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 10, color: '#fff', marginTop: 6, lineHeight: 1.5 }}>
          <b style={{ color: otResult.riskPercent >= 50 ? '#ef4444' : otResult.riskPercent >= 25 ? '#f59e0b' : '#22c55e' }}>
            {otResult.deloadUrgency === 'urgent' ? 'СРОЧНЫЙ ДЕЛОД' : otResult.deloadUrgency === 'required' ? 'Требуется делод' : otResult.deloadUrgency === 'recommended' ? 'Рекомендован делод' : otResult.deloadUrgency === 'advisory' ? 'Контроль' : 'Норма'}
          </b>
          {' — '}{otResult.recommendation}
        </div>
         {showOvertraining && (
           <div style={{ marginTop: 12, padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
             <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🛠️ Корректировка маркеров</div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
               <div>
                 <div style={{ fontSize: 10, color: '#fff', marginBottom: 3 }}>Падение 1RM (%)</div>
                 <input type="number" value={perfDecline} onChange={e => setPerfDecline(+e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 10, outline: 'none' }} />
               </div>
               <div>
                 <div style={{ fontSize: 10, color: '#fff', marginBottom: 3 }}>Пульс покоя ↑ (уд/мин)</div>
                 <input type="number" value={restingHR} onChange={e => setRestingHR(+e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 10, outline: 'none' }} />
               </div>
             </div>
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
               {Object.entries(SYMPTOM_LABELS).map(([key, label]) => (
                 <div 
                   key={key} 
                   onClick={() => setOtSymptoms(p => ({ ...p, [key]: !p[key] }))}
                   style={{ 
                     padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', 
                     background: otSymptoms[key] ? ACCENT : 'rgba(255,255,255,0.05)', 
                     color: otSymptoms[key] ? '#000' : '#fff', 
                     border: '1px solid ' + (otSymptoms[key] ? ACCENT : 'rgba(255,255,255,0.08)'),
                     fontWeight: otSymptoms[key] ? 700 : 400,
                     transition: 'all 0.2s'
                   }}
                 >
                   {label}
                 </div>
               ))}
             </div>
           </div>
         )}

      </div>

      {/* Расписание делодов */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
          📅 Расписание {schedule.weeks.length} недель
          {schedule.deloadWeeks.length > 0 && <span style={{ marginLeft: 8, fontSize: 10, color: '#60a5fa' }}>{schedule.deloadWeeks.length} делод(ов)</span>}
          {schedule.peakWeek && <span style={{ marginLeft: 8, fontSize: 10, color: '#ef4444' }}>Пик: нед {schedule.peakWeek}</span>}
        </div>
        {schedule.warnings.length > 0 && (
          <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {schedule.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ {w}</div>)}
          </div>
        )}
        {/* Визуальный таймлайн */}
        <div style={{ overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: 2, minWidth: 'max-content' }}>
            {schedule.weeks.map((w, i) => {
              const isDeload = w.phase === 'deload' || w.phase === 'active_rest';
              const color = PHASE_COLORS[w.phase];
              return (
                     <div 
                       key={i} 
                       onClick={() => cyclePhase(w.week)}
                       style={{ 
                         display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 36, cursor: 'pointer' 
                       }}
                     >
                       <div style={{
                         width: 28, height: 28, borderRadius: 8,
                         background: isDeload ? `linear-gradient(135deg, ${color}, ${color}88)` : color,
                         border: isDeload ? '2px solid #60a5fa' : '1px solid transparent',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         fontSize: 10, fontWeight: 800, color: isDeload ? '#fff' : '#000',
                         boxShadow: isDeload ? `0 0 8px ${color}66` : 'none',
                         transition: 'all 0.2s',
                       }}>
                         {w.week}
                       </div>

                  <div style={{ fontSize: 10, color: color, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                    {PHASE_LABELS_RU[w.phase]}
                  </div>
                  <div style={{ height: 3, width: '100%', borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.round(w.volumePercent) + '%', borderRadius: 2, background: color }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#fff' }}>{w.volumePercent}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Детальная таблица */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📋 Детальный понедельный план</div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '0.4fr 1fr 0.5fr 0.5fr 0.4fr 0.4fr', gap: 2, padding: '4px 8px', fontSize:10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', minWidth: 340 }}>
          <span>Нед</span><span>Фаза</span><span>Объём</span><span>Инт.</span><span>RPE</span><span>RIR</span>
        </div>
        {schedule.weeks.slice(0, 24).map((w, i) => {
          const isDeload = w.phase === 'deload' || w.phase === 'active_rest';
          const color = PHASE_COLORS[w.phase];
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '0.4fr 1fr 0.5fr 0.5fr 0.4fr 0.4fr', gap: 2,
              padding: '5px 8px', fontSize: 10, color: '#fff',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              background: isDeload ? 'rgba(96,165,250,0.06)' : 'transparent',
              borderLeft: isDeload ? '3px solid #60a5fa' : '3px solid transparent',
              minWidth: 340,
            }}>
              <span style={{ fontWeight: 700, color }}>{w.week}</span>
              <span style={{ color, fontWeight: 600, fontSize: 10 }}>{PHASE_LABELS_RU[w.phase]}{isDeload ? ' ⬇' : ''}</span>
              <span style={{ color: '#fff' }}>{w.volumePercent}%</span>
              <span style={{ color: '#f59e0b' }}>{w.intensityPercent}%</span>
              <span style={{ color: '#a855f7' }}>{w.rpeTarget}</span>
              <span style={{ color: ACCENT }}>{w.rirTarget}</span>
            </div>
          );
        })}
        </div>
      </div>

      {/* Сводка делодов */}
      {schedule.deloadWeeks.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🧘 Делод-недели</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {schedule.deloadWeeks.map(w => (
              <span key={w} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', fontSize: 10, fontWeight: 700 }}>
                Нед {w}: объём 40%, RIR 4, RPE 5.5
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Структурированный протокол делода */}
      <div style={{ marginTop: 8 }}>
        <DeloadProtocolCard ctx={{
          acwr: acwr?.ratio ?? 1.0,
          weeksSinceDeload: schedule.deloadWeeks.length === 0 ? 99 : 0,
          fatigue: fatigueLevel,
          recovery: recoveryLevel,
          hasCompetitionSoon: deloadGoal === 'peaking',
          jointPain: overtraining.jointPainIncrease,
          cnsFatigue: overtraining.rpeInflation || overtraining.recoveryTimeExtension,
          goal: deloadGoal,
        }} />
      </div>
      {schedule.deloadWeeks.length > 0 && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить делод-недели ({schedule.deloadWeeks.join(', ')}) к планировщику — объём ×0.5, RIR +3 на этих неделях.</div>
          <button onClick={() => applyToPlanner({ kind: 'deload', label: 'Делод: нед ' + schedule.deloadWeeks.join(','), data: { volumeMult: 0.5, rirShift: 3, weeks: schedule.deloadWeeks } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить делод к планировщику</button>
        </div>
      )}
    </div>
  );
};

export default DeloadSchedulerTab;
