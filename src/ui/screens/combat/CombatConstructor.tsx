/**
 * CombatConstructor.tsx — изолированный конструктор для единоборств.
 * Полностью отделён от ББ/ПЛ. Только силовая часть зала.
 */
import React, { useState, useMemo } from 'react';
import { buildCombatPlan } from '../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan, buildCombatReport } from '../../../engines/combat/combat-finalize.engine';
import { COMBAT_PATTERNS, recommendCombatPattern } from '../../../engines/combat/combat-split-patterns';
import { computeOutsideMetrics, defaultOutsideLoadFor, type OutsideLoad } from '../../../engines/outside-load.engine';
import { saveCombatPlan } from '../../../engines/combat/combat-storage';
import type { CombatInput, CombatPlan } from '../../../engines/combat/combat.types';

type Step = 'params' | 'outside' | 'split' | 'plan';

export const CombatConstructor: React.FC = () => {
  const [step, setStep] = useState<Step>('params');
  const [discipline, setDiscipline] = useState<CombatInput['discipline']>('mma');
  const [goal, setGoal] = useState<CombatInput['goal']>('power');
  const [level, setLevel] = useState<CombatInput['level']>('intermediate');
  const [weeks, setWeeks] = useState(6);
  const [days, setDays] = useState(3);
  const [weightCut, setWeightCut] = useState(0);
  const [outside, setOutside] = useState<OutsideLoad | null>(defaultOutsideLoadFor('mma'));
  const [outsideEnabled, setOutsideEnabled] = useState(true);
  const [plan, setPlan] = useState<CombatPlan | null>(null);
  const [msg, setMsg] = useState('');

  const outsideMetrics = useMemo(() => computeOutsideMetrics(outsideEnabled ? outside : null), [outside, outsideEnabled]);

  const build = () => {
    const input: CombatInput = {
      discipline, goal, level, weeks, daysPerWeek: days,
      weightCutKg: weightCut,
      outsideLoad: outsideEnabled ? outside : null,
      equipment: [],
    };
    let p = buildCombatPlan(input);
    p = finalizeCombatPlan(p);
    setPlan(p);
    saveCombatPlan(p);
    setMsg('План сохранён');
    setStep('plan');
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, color: '#fff' }}>Единоборства — силовая часть</h2>
      <div style={{ fontSize: 11, color: '#fff', opacity: 0.7 }}>Бокс / ММА / Борьба / Кик. Внешняя нагрузка (ринг/татами) учитывается как фон — зала 2-3×/нед.</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['params','outside','split','plan'] as Step[]).map(s => (
          <button key={s} onClick={() => setStep(s)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: step===s ? '#a855f7' : 'rgba(255,255,255,0.06)', color: step===s ? '#fff' : '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>

      {step === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12 }}>Дисциплина</label>
          <select value={discipline} onChange={e => setDiscipline(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="boxing">Бокс</option>
            <option value="mma">ММА</option>
            <option value="wrestling">Борьба</option>
            <option value="kickboxing">Кикбоксинг</option>
            <option value="general">Общая</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Цель зала</label>
          <select value={goal} onChange={e => setGoal(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="power">Взрывная сила</option>
            <option value="endurance">Силовая выносливость</option>
            <option value="maintenance">Поддержание</option>
            <option value="camp">Кэмп к бою</option>
            <option value="weight_cut">Весогонка</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Уровень</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ padding: 6, borderRadius: 6 }}>
            <option value="beginner">Новичок</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Enhanced</option>
          </select>
          <label style={{ color: '#fff', fontSize: 12 }}>Недель: {weeks}</label>
          <input type="range" min={2} max={12} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Дней/нед в зале: {days}</label>
          <input type="range" min={2} max={4} value={days} onChange={e => setDays(Number(e.target.value))} />
          <label style={{ color: '#fff', fontSize: 12 }}>Весогонка кг (0 = нет): {weightCut}</label>
          <input type="range" min={0} max={8} step={0.5} value={weightCut} onChange={e => setWeightCut(Number(e.target.value))} />
          <button onClick={() => setStep('outside')} style={{ padding: '8px 12px', borderRadius: 8, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Далее → Вне зала</button>
        </div>
      )}

      {step === 'outside' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <label style={{ color: '#fff', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={outsideEnabled} onChange={e => setOutsideEnabled(e.target.checked)} /> Учитывать вне зала (ринг/татами)
          </label>
          {outsideEnabled && outside && (
            <>
              <label style={{ color: '#fff', fontSize: 11 }}>Сессий/нед вне зала: {outside.sessionsPerWeek}</label>
              <input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>Длительность мин: {outside.avgDurationMin}</label>
              <input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} />
              <label style={{ color: '#fff', fontSize: 11 }}>RPE: {outside.avgSRPE}</label>
              <input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} />
              <div style={{ fontSize: 11, color: '#a855f7' }}>{outsideMetrics ? `${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier} (${outsideMetrics.interference})` : ''}</div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.6 }}>Тяж ноги не ставим за день до высокой внезальной автоматически.</div>
            </>
          )}
          <button onClick={() => setStep('split')} style={{ padding: '8px 12px', borderRadius: 8, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Далее → Сплит</button>
        </div>
      )}

      {step === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 10 }}>
          <div style={{ color: '#fff', fontSize: 12 }}>Рекомендуемый: {recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).name}</div>
          {COMBAT_PATTERNS.map(p => (
            <div key={p.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 11 }}>
              <b>{p.name}</b> — {p.sessionsPerRotation}×/нед · {p.description}
            </div>
          ))}
          <button onClick={build} style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Собрать план</button>
        </div>
      )}

      {step === 'plan' && plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(168,85,247,0.12)', padding: 10, borderRadius: 10, color: '#fff', fontSize: 11, whiteSpace: 'pre-wrap' }}>{buildCombatReport(plan)}</div>
          {plan.validation?.warnings.map((w,i) => <div key={i} style={{ color: '#f59e0b', fontSize: 11 }}>⚠ {w}</div>)}
          {plan.weeksData.map(wk => (
            <div key={wk.week} style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
              <div style={{ color: '#a855f7', fontWeight: 700, fontSize: 12 }}>Неделя {wk.week} · {wk.phase}{wk.deload ? ' · делод' : ''} · {wk.totalSets} сетов</div>
              {wk.sessions.map(sess => (
                <div key={sess.day} style={{ marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{sess.sessionTag} · {sess.character} · день {sess.day}</div>
                  {sess.exercises.map(ex => (
                    <div key={ex.id} style={{ color: '#fff', fontSize: 11, marginLeft: 6 }}>{ex.name} — {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}кг` : ''} RIR{ex.rir}{ex.comment ? ` · ${ex.comment}` : ''}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => { const txt = buildCombatReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Копировать отчёт</button>
          {msg && <div style={{ color: '#a855f7', fontSize: 11 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
};
