/**
 * StrengthSportConstructor.tsx — изолированный конструктор Силовой экстрим / ТА.
 * Полностью отделён от ББ/ПЛ: не импортирует их движки, каталоги, типы.
 * Только силовая часть зала. Внешняя нагрузка (поле) — декларация.
 */
import React, { useState, useMemo } from 'react';
import { buildStrengthSportPlan } from '../../../engines/strength-sport/strength-sport-builder.engine';
import { finalizeStrengthSportPlan, buildStrengthSportReport } from '../../../engines/strength-sport/strength-sport-finalize.engine';
import { STRENGTH_SPORT_PATTERNS, recommendStrengthSportPattern } from '../../../engines/strength-sport/strength-sport-split-patterns';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { saveStrengthSportPlan } from '../../../engines/strength-sport/strength-sport-storage';
import type { StrengthSportInput, StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';

type Step = 'params' | 'outside' | 'split' | 'plan';

export const StrengthSportConstructor: React.FC = () => {
  const [step, setStep] = useState<Step>('params');
  const [mode, setMode] = useState<StrengthSportInput['mode']>('weightlifting');
  const [goal, setGoal] = useState<StrengthSportInput['goal']>('strength');
  const [level, setLevel] = useState<StrengthSportInput['level']>('intermediate');
  const [weeks, setWeeks] = useState(8);
  const [days, setDays] = useState(3);
  const [workMax, setWorkMax] = useState<StrengthSportInput['workMax']>({ backSquat: 120, deadlift: 160, snatch: 70, cleanJerk: 90, overheadPress: 60 });
  const [outside, setOutside] = useState<OutsideLoad | null>(defaultOutsideLoadFor('weightlifting'));
  const [outsideEnabled, setOutsideEnabled] = useState(false);
  const [plan, setPlan] = useState<StrengthSportPlan | null>(null);
  const [msg, setMsg] = useState('');

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);

  const build = () => {
    const input: StrengthSportInput = {
      mode, goal, level, weeks, daysPerWeek: days, workMax,
      outsideLoad: outsideEnabled ? outside : null,
      equipment: [], // по умолчанию всё доступно
    };
    let p = buildStrengthSportPlan(input);
    p = finalizeStrengthSportPlan(p, { outsideLoad: outsideEnabled ? outside : null });
    setPlan(p);
    saveStrengthSportPlan(p);
    setMsg('План сохранён');
    setStep('plan');
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, color: '#fff' }}>Силовой экстрим / Тяжёлая атлетика</h2>
      <div style={{ fontSize: 11, color: '#fff', opacity: 0.7 }}>Только силовая часть зала. Внешняя нагрузка учитывается как фон.</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['params','outside','split','plan'] as Step[]).map(s => (
          <button key={s} onClick={() => setStep(s)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: step===s ? '#00e68a' : 'rgba(255,255,255,0.06)', color: step===s ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>

      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12 }}>Режим</label>
          <select value={mode} onChange={e => setMode(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="weightlifting">Тяжёлая атлетика</option>
            <option value="strongman">Силовой экстрим</option>
            <option value="hybrid">Гибрид</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Цель</label>
          <select value={goal} onChange={e => setGoal(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="strength">Сила</option>
            <option value="hypertrophy">Масса</option>
            <option value="technique">Техника</option>
            <option value="peaking">Пик</option>
            <option value="maintenance">Поддержание</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Уровень</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="beginner">Новичок</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Enhanced</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Недель: {weeks}</label>
          <input type="range" min={2} max={16} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Дней/нед в зале: {days}</label>
          <input type="range" min={2} max={6} value={days} onChange={e => setDays(Number(e.target.value))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['backSquat','frontSquat','deadlift','snatch','cleanJerk','overheadPress'] as const).map(k => (
              <label key={k} style={{ color: '#fff', fontSize: 11 }}>{k}: <input type="number" value={(workMax as any)[k] || 0} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value) }))} style={{ width: 70, padding: 4, borderRadius: 6 }} /></label>
            ))}
          </div>
          <button onClick={() => setStep('outside')} style={{ padding: '8px 12px', borderRadius: 8, background: '#00e68a', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Далее → Вне зала</button>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} /> Учитывать внезальную нагрузку
          </label>
          {outsideEnabled && outside && (
            <>
              <label style={{ color: '#fff', fontSize: 11 }}>Сессий/нед вне зала: {outside.sessionsPerWeek}</label>
              <input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>Длительность мин: {outside.avgDurationMin}</label>
              <input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>RPE: {outside.avgSRPE}</label>
              <input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} />
              <div style={{ fontSize: 11, color: '#00e68a' }}>{outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier}` : ''}</div>
            </>
          )}
          <button onClick={() => setStep('split')} style={{ padding: '8px 12px', borderRadius: 8, background: '#00e68a', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Далее → Сплит</button>
        </div>
      )}

      {step === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <div style={{ color: '#fff', fontSize: 12 }}>Рекомендуемый сплит: {recommendStrengthSportPattern(mode, days, level).name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STRENGTH_SPORT_PATTERNS.filter(p => p.mode===mode || p.mode==='any').map(p => (
              <div key={p.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 11 }}>
                <b>{p.name}</b> — {p.sessionsPerRotation}×/нед · {p.description}
              </div>
            ))}
          </div>
          <button onClick={build} style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, cursor: 'pointer' }}>Собрать план</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(0,230,138,0.1)', padding: 10, borderRadius: 10, color: '#fff', fontSize: 11, whiteSpace: 'pre-wrap' }}>{buildStrengthSportReport(plan)}</div>
          {plan.validation?.warnings.map((w,i) => <div key={i} style={{ color: '#f59e0b', fontSize: 11 }}>⚠ {w}</div>)}
          {plan.weeksData.map(wk => (
            <div key={wk.week} style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
              <div style={{ color: '#00e68a', fontWeight: 700, fontSize: 12 }}>Неделя {wk.week} · {wk.phase}{wk.deload ? ' · делод' : ''} · {wk.totalSets} сетов</div>
              {wk.sessions.map(sess => (
                <div key={sess.day} style={{ marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{sess.sessionTag} · {sess.character} · день {sess.day}</div>
                  {sess.exercises.map(ex => (
                    <div key={ex.id} style={{ color: '#fff', fontSize: 11, marginLeft: 6 }}>{ex.name} — {ex.sets}×{ex.reps} @ {ex.weight}кг RIR{ex.rir}{ex.isCompetitionLift ? ' ★' : ''}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => { const txt = buildStrengthSportReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Копировать отчёт</button>
          {msg && <div style={{ color: '#00e68a', fontSize: 11 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
};
