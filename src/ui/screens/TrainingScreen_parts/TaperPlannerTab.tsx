/**
 * TaperPlannerTab.tsx — ЕДИНЫЙ ПОЛНЫЙ ТАПЕР-КАЛЬКУЛЯТОР.
 * Объединяет: PL-taper (pro/taper.engine), BB show-peak (bb-contest-prep.engine),
 * весовую категорию, таймлайн дня, протоколы восстановления, ментальные рутины.
 * Ранее: TaperPlannerTab + PeakingPanel(PL) + ProPlToolsTab(taper) — теперь всё здесь.
 */
import React, { useMemo, useState } from 'react';
import {
  taperPlan, warmupSequence, taperWeeksForFatigue,
  type AttemptStrategy, type Lift, type TaperPlan,
} from '../../../engines/pro/taper.engine';
import { buildBBContestPrep, isoToday, isoAddDays, type BBContestPrepConfig } from '../../../engines/bb/bb-contest-prep.engine';
import {
  selectWeightClass, generateCompetitionTimeline,
  getRecoveryProtocols, getMentalRoutines, recommendWeightCut,
} from '../../../engines/gym-competition.engine';
import { applyToPlanner } from './planner-bridge';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const CARD_GLASS: React.CSSProperties = { padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 };
const BTN: React.CSSProperties = { flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, minHeight: 44 };
const BTN_GHOST: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: DIM };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 2px' };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };
const LIFT_RU: Record<Lift, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Тяга' };
const LIFT_COLOR: Record<Lift, string> = { squat: '#ef4444', bench: '#3b82f6', deadlift: '#f59e0b' };

type BBShowPeakWeekRow = { day: number; training: string; carbs: string; water: string; sodium: string; posing: string };
type BBShowPeakOutput = { weekPlan: BBShowPeakWeekRow[]; recommendations: string[] };

const fatigueOpts = [
  { id: 'low', label: 'Низкая (8-9)', desc: 'Лёгкий taper 1 неделя' },
  { id: 'med', label: 'Средняя (5-7)', desc: 'Taper 2 недели' },
  { id: 'high', label: 'Высокая (>8)', desc: 'Длительный taper 3 недели' },
];
const strategyOpts: { id: AttemptStrategy; label: string; desc: string }[] = [
  { id: 'conservative', label: 'Консервативная', desc: 'Опенер 90%, 2nd 95.5%, 3rd 100%' },
  { id: 'balanced', label: 'Сбалансированная', desc: 'Опенер 92%, 2nd 96%, 3rd 102%' },
  { id: 'aggressive', label: 'Агрессивная', desc: 'Опенер 93%, 2nd 97%, 3rd 105%' },
];

const addDays = (n: number): string => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export const TaperPlannerTab: React.FC = () => {
  const [kind, setKind] = useState<'pl' | 'bb'>('pl');

  // ── PL: taper + соревнование ──
  const [meetDate, setMeetDate] = useState<string>(addDays(28));
  const [squat1RM, setSquat1RM] = useState(180);
  const [bench1RM, setBench1RM] = useState(120);
  const [deadlift1RM, setDeadlift1RM] = useState(220);
  const [fatigueRaw, setFatigueRaw] = useState<string>('med');
  const [fatigueNum, setFatigueNum] = useState(7);
  const [strategy, setStrategy] = useState<AttemptStrategy>('balanced');
  const [saved, setSaved] = useState(false);
  // Весовая категория
  const [bw, setBw] = useState(80);
  const [fed, setFed] = useState('IPF');
  // Таймлайн
  const [weighIn, setWeighIn] = useState('08:00');
  const [start, setStart] = useState('11:00');

  // ── BB: шоу ──
  const [showDate, setShowDate] = useState<string>(addDays(7));
  const [conditioning, setConditioning] = useState(0.7);
  const [fullness, setFullness] = useState(0.6);
  const [dryness, setDryness] = useState(0.6);
  const [carbTol, setCarbTol] = useState(0.7);

  const fatigue = fatigueRaw === 'low' ? 8 : fatigueRaw === 'high' ? 9 : fatigueNum;

  // ── Расчёты PL ──
  const plan: TaperPlan | null = useMemo(() => {
    if (kind !== 'pl' || squat1RM <= 0 || bench1RM <= 0 || deadlift1RM <= 0) return null;
    try { return taperPlan(meetDate, { squat: squat1RM, bench: bench1RM, deadlift: deadlift1RM }, fatigue * 10, strategy); }
    catch { return null; }
  }, [kind, meetDate, squat1RM, bench1RM, deadlift1RM, fatigue, strategy]);

  const daysUntil = useMemo(() => {
    const d = new Date(meetDate).getTime() - Date.now();
    return Math.max(0, Math.round(d / 86400000));
  }, [meetDate]);

  const cls = useMemo(() => selectWeightClass(bw, fed), [bw, fed]);
  const timeline = useMemo(() => generateCompetitionTimeline(weighIn, start), [weighIn, start]);
  const recovery = useMemo(() => getRecoveryProtocols(), []);
  const mental = useMemo(() => getMentalRoutines(), []);
  const warmup = plan ? warmupSequence(plan.attempts.squat.opener) : [];

  // ── Расчёты BB (canonical engine: bb-contest-prep.engine.ts) ──
  const bb: BBShowPeakOutput | null = useMemo(() => {
    if (kind !== 'bb') return null;
    try {
      const cfg: BBContestPrepConfig = {
        sex: 'male',
        category: 'mens_physique',
        weightKg: 80,
        experienceLevel: 'intermediate',
        enhanced: false,
        prepCount: 0,
        showDate,
        weeksOut: 1,
        trainingProtocol: 'bb',
        carbLoadStrategy: 'moderate',
        waterStrategy: 'minimal',
        sodiumStrategy: 'constant',
      };
      const res = buildBBContestPrep(cfg);
      return {
        weekPlan: res.peakWeek.map(d => ({
          day: d.day,
          training: d.training.type,
          carbs: `${d.carbsG} г`,
          water: `${d.waterLiters} л`,
          sodium: `${d.sodiumMg} мг`,
          posing: `${d.posingMinutes} мин`,
        })),
        recommendations: [
          ...res.warnings,
          'Вода и натрий стабильны по умолчанию; резкие манипуляции недоступны без подтверждения.',
          'Объём тапера снижается, интенсивность сохраняется, RIR 2–4 — без отказных серий.',
        ],
      };
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, showDate]);

  const handleSave = () => {
    if (kind === 'pl' && plan) {
      localStorage.setItem('he_taper_plan', JSON.stringify({ meetDate, squat1RM, bench1RM, deadlift1RM, fatigue, strategy, savedAt: Date.now() }));
    }
    if (kind === 'bb' && bb) {
      localStorage.setItem('he_bb_peak_plan', JSON.stringify({ showDate, conditioning, fullness, dryness, carbTol, savedAt: Date.now() }));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🔻 Тапер-планер (ПОЛНЫЙ)</div>
      <div style={{ ...SMALL, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
        Единый калькулятор: taper/пик для пауэрлифтинга (снижение объёма 40-60%, прикиды, стратегия,
        весовая категория, таймлайн дня, восстановление, ментал) + шоу-пик для бодибилдинга
        (углеводная загрузка, водная манипуляция, памп-тренировки).
      </div>

      {/* ── PL / BB переключатель ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setKind('pl')} style={{ ...BTN_GHOST, flex: 1, border: kind === 'pl' ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)', background: kind === 'pl' ? 'rgba(0,230,138,0.12)' : 'transparent', color: kind === 'pl' ? ACCENT : DIM }}>
          🏋️ PL: Тапер + Соревнование
        </button>
        <button onClick={() => setKind('bb')} style={{ ...BTN_GHOST, flex: 1, border: kind === 'bb' ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)', background: kind === 'bb' ? 'rgba(0,230,138,0.12)' : 'transparent', color: kind === 'bb' ? ACCENT : DIM }}>
          🏆 BB: Шоу-пик
        </button>
      </div>

      {/* ════════════════ PL ════════════════ */}
      {kind === 'pl' && (<>
        {/* Параметры */}
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📝 Параметры taper</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><div style={LABEL}>📅 Дата старта</div>
              <input type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} style={IN} /></div>
            <PopupSelect label="Усталость (RPE-пресс)" value={fatigueRaw} options={fatigueOpts} onChange={setFatigueRaw} />
            <PopupSelect label="Стратегия прикидов" value={strategy} options={strategyOpts} onChange={v => setStrategy(v as AttemptStrategy)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <PopupNumber label="Присед 1RM" value={squat1RM} min={20} max={600} suffix="кг" onChange={setSquat1RM} />
            <PopupNumber label="Жим 1RM" value={bench1RM} min={20} max={400} suffix="кг" onChange={setBench1RM} />
            <PopupNumber label="Тяга 1RM" value={deadlift1RM} min={20} max={600} suffix="кг" onChange={setDeadlift1RM} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><PopupNumber label="Усталость число (1-10)" value={fatigueNum} min={1} max={10} onChange={setFatigueNum} /></div>
            {daysUntil > 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: '4px 0' }}>
              <span style={{ ...SMALL, color: ACCENT }}>До старта: <b>{daysUntil}</b> дн.</span>
            </div>}
          </div>
        </div>

        {/* Сводка taper */}
        {plan && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { title: 'Длительность', val: plan.taperWeeks + ' нед', sub: taperWeeksForFatigue(fatigue * 10) + ' нед по усталости', clr: ACCENT },
              { title: 'Тотал (имп.)', val: String(squat1RM + bench1RM + deadlift1RM), sub: 'сум 3 движ.', clr: ACCENT },
              { title: 'Цель 3rd SQ', val: plan.attempts.squat.third + ' кг', sub: plan.attempts.squat.rpeNote, clr: '#f59e0b' },
              { title: 'Цель 3rd DL', val: plan.attempts.deadlift.third + ' кг', sub: plan.attempts.deadlift.rpeNote, clr: '#f59e0b' },
            ].map(s => (
              <div key={s.title} style={{ padding: 12, borderRadius: 12, textAlign: 'center', background: 'rgba(24,24,27,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.clr }}>{s.val}</div>
                <div style={{ fontSize: 10, color: DIM }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Кривая taper */}
        {plan && (
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📊 Кривая taper (объём / интенсивность / RIR)</div>
            {plan.taperCurve.map(tw => (
              <div key={tw.week} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                <span style={{ color: ACCENT, fontWeight: 700 }}>Нед {tw.week}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Объём: <b style={{ color: '#fff' }}>{Math.round(tw.volumePctOfPeak * 100)}%</b></span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Инт.: <b style={{ color: '#fff' }}>{Math.round(tw.intensityPct * 100)}%</b></span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>RIR: <b style={{ color: '#fff' }}>{tw.rir}</b></span>
                <div style={{ gridColumn: '1 / -1', fontSize: 10, color: DIM, marginTop: 2 }}>{tw.rationale}</div>
              </div>
            ))}
          </div>
        )}

        {/* Понедельный план */}
        {plan && plan.weeks.map(w => (
          <div key={w.week} style={CARD}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>📅 Неделя {w.week} — {w.sessions.length} сессии</div>
            {w.sessions.map((s, si) => (
              <div key={si} style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.dayName}</span>
                  <span style={{ fontSize: 10, color: ACCENT }}>{s.daysUntilMeet} дн. до старта</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>{s.focus}</div>
                {s.exercises.map((ex, ei) => {
                  const weight = ex.lift === 'squat' ? squat1RM : ex.lift === 'bench' ? bench1RM : deadlift1RM;
                  const wkg = Math.round(weight * ex.percent * 10) / 10;
                  return (
                    <div key={ei} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr', gap: 6, fontSize: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}>
                      <span style={{ color: LIFT_COLOR[ex.lift], fontWeight: 700 }}>{LIFT_RU[ex.lift]}</span>
                      <span>{Math.round(ex.percent * 100)}% × {ex.reps}</span>
                      <span style={{ color: ACCENT, fontWeight: 700 }}>{wkg} кг × {ex.sets}</span>
                      <span style={{ gridColumn: '4 / -1' }}>{ex.note}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}

        {/* Прикиды */}
        {plan && (
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🏆 Прикиды ({strategyOpts.find(s => s.id === strategy)?.label})</div>
            {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => (
              <div key={l} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: LIFT_COLOR[l], marginBottom: 4 }}>{LIFT_RU[l]}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {(['opener', 'second', 'third', 'target'] as const).map(a => (
                    <div key={a} style={{ padding: 8, borderRadius: 8, textAlign: 'center', background: a === 'target' ? 'rgba(245,158,11,0.06)' : 'rgba(24,24,27,0.6)', border: a === 'target' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 10, color: DIM }}>{a === 'opener' ? 'Опенер' : a === 'second' ? 'Вторая' : a === 'third' ? 'Третья' : 'Цель'}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: a === 'target' ? '#f59e0b' : '#fff' }}>{plan.attempts[l][a]} кг</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Разминка + последние тяжёлые + инструкции */}
        {plan && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={CARD}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🔥 Разминка (опенер присед {plan.attempts.squat.opener} кг)</div>
              {warmup.map((w, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}>
                  <span>{Math.round(w.percent * 100)}%</span>
                  <b style={{ color: ACCENT }}>{w.weight} кг × {w.reps} повт.</b>
                </div>
              ))}
            </div>
            <div style={CARD}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>⏱ Последние тяжёлые (дн. до старта)</div>
              {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => (
                <div key={l} style={ROW}>
                  <span style={{ color: LIFT_COLOR[l], fontWeight: 700 }}>{LIFT_RU[l]}</span>
                  <span style={{ color: '#fff' }}><b>{plan.lastHeavyDays[l]}</b> дн.</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>
                {plan.meetDayInstructions.map((m, i) => <div key={i} style={{ padding: '4px 0', lineHeight: 1.45 }}>• {m}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Весовая категория ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>⚖️ Весовая категория</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <PopupNumber label="Вес тела, кг" value={bw} min={40} max={200} suffix="кг" onChange={v => setBw(v)} />
            <PopupSelect label="Федерация" value={fed} options={[{ id: 'IPF', label: 'IPF (офиц.)' }, { id: 'other', label: 'Другая' }]} onChange={v => setFed(v)} />
          </div>
          <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Категория до {cls.weightClass} кг</div>
            {cls.cuttingRequired && <div style={{ fontSize: 10, color: '#eab308' }}>Сушка: {cls.cuttingAmount} кг</div>}
            {!cls.cuttingRequired && bw < cls.weightClass && (() => {
              const g = recommendWeightCut(bw, cls.weightClass, Math.max(1, Math.ceil(daysUntil / 7)));
              return (
                <div style={{ fontSize: 10, color: '#4ade80', marginTop: 2, lineHeight: 1.45 }}>
                  📈 Набор до {cls.weightClass} кг: +{g.toGain.toFixed(1)} кг · темп {g.safeGainRate.toFixed(1)} кг/нед · профицит ≈{g.dailySurplusKcal} ккал/день
                  {g.gainFeasible && ` · успеваете за ${Math.ceil(daysUntil / 7)} нед`}
                  {g.gainRecommendations.length > 0 && <div style={{ color: DIM, marginTop: 2 }}>{g.gainRecommendations[1]}</div>}
                </div>
              );
            })()}
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{cls.recommendation}</div>
          </div>
        </div>

        {/* ═══ Таймлайн дня ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>⏰ Таймлайн соревновательного дня</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><div style={LABEL}>Взвешивание</div><input type="time" style={IN} value={weighIn} onChange={e => setWeighIn(e.target.value)} /></div>
            <div><div style={LABEL}>Старт потока</div><input type="time" style={IN} value={start} onChange={e => setStart(e.target.value)} /></div>
          </div>
          {timeline.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{t.time}</span>
              <span style={{ color: DIM }}>{t.action}</span>
            </div>
          ))}
        </div>

        {/* ═══ Протоколы восстановления ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🔄 Протоколы восстановления</div>
          {recovery.map((r, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 8, borderRadius: 6, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{r.name} <span style={{ fontSize: 10, color: DIM }}>({r.type}, {r.durationMin} мин)</span></div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>Когда: {r.whenToUse}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>{r.instructions.join(' · ')}</div>
            </div>
          ))}
        </div>

        {/* ═══ Ментальные рутины ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🧠 Ментальные рутины</div>
          {mental.map((m, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 8, borderRadius: 6, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7' }}>{m.name}</div>
              <div style={{ fontSize: 10, color: DIM }}>Когда: {m.whenToUse}</div>
              {m.steps.map((s, j) => (
                <div key={j} style={{ fontSize: 10, color: DIM, marginTop: 2 }}>• {s.action} ({s.duration}) {s.notes}</div>
              ))}
            </div>
          ))}
        </div>

        {/* Инструкции соревновательного дня */}
        {plan && (
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📋 План соревновательного дня</div>
            {plan.meetDayInstructions.map((m, i) => (
              <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', padding: '4px 0', lineHeight: 1.45 }}>• {m}</div>
            ))}
          </div>
        )}

        {/* Apply + Save */}
        {plan && (<>
          <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
              🔗 Применить ПМ ({squat1RM}/{bench1RM}/{deadlift1RM} кг) и taper-план (объём ×{plan.taperCurve[plan.taperCurve.length - 1]?.volumePctOfPeak ?? 0.5}, RIR→0) к планировщику.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => applyToPlanner({ kind: 'pm', label: 'ПМ taper: ' + squat1RM + '/' + bench1RM + '/' + deadlift1RM + ' кг', data: { squat: squat1RM, bench: bench1RM, dead: deadlift1RM } })} style={{ ...BTN, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000' }}>
                🛠 Применить ПМ
              </button>
              <button onClick={() => applyToPlanner({ kind: 'peak', label: 'Taper: объём ×' + (plan.taperCurve[plan.taperCurve.length - 1]?.volumePctOfPeak ?? 0.5) + ', RIR→0', data: { volumeMult: plan.taperCurve[plan.taperCurve.length - 1]?.volumePctOfPeak ?? 0.5, rirTarget: 0 } })} style={{ ...BTN, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff' }}>
                🛠 Применить пик
              </button>
            </div>
          </div>
          <button onClick={handleSave} disabled={saved} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: saved ? 'not-allowed' : 'pointer', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, marginTop: 8, opacity: saved ? 0.4 : 1 }}>
            {saved ? '✓ План сохранён' : '💾 Сохранить taper-план'}
          </button>
        </>)}
      </>)}

      {/* ════════════════ BB ════════════════ */}
      {kind === 'bb' && (<>
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📝 Параметры шоу-пика</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={LABEL}>📅 Дата шоу</div><input type="date" style={IN} value={showDate} onChange={e => setShowDate(e.target.value)} /></div>
            <PopupNumber label="Кондиция (0-1)" value={conditioning} min={0} max={1} step={0.05} onChange={v => setConditioning(v)} />
            <PopupNumber label="Наполненность (0-1)" value={fullness} min={0} max={1} step={0.05} onChange={v => setFullness(v)} />
            <PopupNumber label="Сухость (0-1)" value={dryness} min={0} max={1} step={0.05} onChange={v => setDryness(v)} />
            <PopupNumber label="Толерантность к углеводам" value={carbTol} min={0} max={1} step={0.05} onChange={v => setCarbTol(v)} />
          </div>
        </div>
        {bb && (
          <div style={CARD}>
            <div style={H}>⬇ Неделя пика (шоу)</div>
            <div style={ROW}><span>День</span><span>Тренировка · Углеводы · Вода · Na · Поза</span></div>
            {bb.weekPlan.map(d => (
              <div key={d.day} style={{ ...ROW, flexWrap: 'wrap', gap: 4 }}>
                <span style={{ color: ACCENT, fontWeight: 700, width: 28 }}>Д{d.day}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{d.training} · {d.carbs} · {d.water} · {d.sodium} · {d.posing}</span>
              </div>
            ))}
            {bb.recommendations.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={LABEL}>Рекомендации:</div>
                {bb.recommendations.map((r, i) => <div key={i} style={SMALL}>• {r}</div>)}
              </div>
            )}
          </div>
        )}
        {bb && (
          <>
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
                🔗 Применить BB шоу-пик к планировщику (карб-загрузка, водная манипуляция, памп).
              </div>
              <button onClick={() => applyToPlanner({ kind: 'peak', label: 'BB шоу-пик: карб-загрузка, вода и натрий стабильны, RIR 2-4', data: { volumeMult: 0.6, rirTarget: 2 } })} style={{ width: '100%', ...BTN, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000' }}>
                🛠 Применить шоу-пик к планировщику
              </button>
            </div>
            <button onClick={handleSave} disabled={saved} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: saved ? 'not-allowed' : 'pointer', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, marginTop: 8, opacity: saved ? 0.4 : 1 }}>
              {saved ? '✓ План сохранён' : '💾 Сохранить шоу-пик план'}
            </button>
          </>
        )}
      </>)}
    </div>
  );
};

export default TaperPlannerTab;
