/**
 * CardioPreviewStep.tsx — шаг 3 v3: таб-эксклюзив.
 * 5 под-вкладок: Обзор | Варианты | План | График | Детали
 * Hero-сводка sticky, календарь открыт по умолчанию, крупные карточки вариантов.
 */
import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  cardioCycleSummary, cardioQualityReport, cardioEquipmentLabel,
  cardioPlanVariants, improveCardioCycle, cardioSessionProtocol,
  spreadSessionsAcrossDays, DAY_LABELS_RU, cardioWeekForDate,
  cardioFitnessForecast, cardioCoachHints, cardioWeekLegConflicts,
  CARDIO_GOAL_LABELS, CARDIO_PHASE_LABELS, CARDIO_VARIANT_LABELS,
  type CardioCycle, type CardioType, type CardioVariant, type CardioTuneChange,
} from '../../../engines/lms/cardio.engine';
import { CardioVolumeChart } from './CardioVolumeChart';
import { CardioProgressCard } from './CardioProgressCard';
import { CARD, ROW, LABEL, BTN, BTN_PRIMARY, BTN_DANGER, PHASE_COLOR, TYPE_COLOR, Badge, ProgressBar, Stepper, Tabs, CARD_HERO, HINT_SM } from './CardioUI';
import { CardioCalendar } from './CardioCalendar';

const VARIANT_CARD: React.CSSProperties = {
  flex: '1 1 160px', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#fff',
  transition: 'all 0.18s ease', minHeight: 84,
};
const VARIANT_ACTIVE: React.CSSProperties = {
  ...VARIANT_CARD, border: '1px solid rgba(0,230,138,0.5)', background: 'linear-gradient(180deg, rgba(0,230,138,0.14), rgba(0,230,138,0.06))', color: '#fff',
  boxShadow: '0 0 16px rgba(0,230,138,0.18)',
};
const DAY_CELL: React.CSSProperties = {
  flex: '1 1 0', minWidth: 0, borderRadius: 10, padding: '7px 4px', textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 11,
  display: 'flex', flexDirection: 'column', gap: 3, minHeight: 64,
};

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Rec' };

export const CardioPreviewStep: React.FC<{
  cycle: CardioCycle | null;
  onBuild: () => void;
  onRename: (name: string) => void;
  onEditConfig: () => void;
  daysAvailable: number;
  recoveryLow: boolean;
  variant: CardioVariant;
  onVariant: (v: CardioVariant) => void;
  variants: ReturnType<typeof cardioPlanVariants>;
  explanation: string[];
  paramsDirty?: boolean;
  onImproved: (cycle: CardioCycle) => void;
  factorsSummary: string[];
  nutritionNotes: string[];
}> = ({ cycle, onBuild, onRename, onEditConfig, daysAvailable, recoveryLow, variant, onVariant, variants, explanation, paramsDirty, onImproved, factorsSummary, nutritionNotes }) => {
  const [subTab, setSubTab] = useState<'overview' | 'variants' | 'plan' | 'chart' | 'details'>('overview');
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [weekNo, setWeekNo] = useState(1);
  const [improve, setImprove] = useState<{ changes: CardioTuneChange[]; cycle: CardioCycle } | null>(null);
  const [selectedSession, setSelectedSession] = useState<{ week: number; dayOfWeek: number } | null>(null);
  const [kcalFlash, setKcalFlash] = useState(false);

  const summary = useMemo(() => (cycle ? cardioCycleSummary(cycle) : null), [cycle]);
  const quality = useMemo(() => (cycle ? cardioQualityReport(cycle, daysAvailable) : null), [cycle, daysAvailable]);

  const phasesPlan = useMemo(() => {
    if (!cycle) return [];
    const order: { phase: string; label: string }[] = [
      { phase: 'base', label: '🌱 База' },
      { phase: 'build', label: '📈 Наращивание' },
      { phase: 'maintenance', label: '🧘 Поддержание' },
      { phase: 'contest_prep', label: '🏋️ Prep' },
      { phase: 'taper', label: '📉 Taper' },
      { phase: 'peak', label: '🎭 Пик' },
      { phase: 'transition', label: '🌤 Переход' },
    ];
    return order
      .map(o => {
        const weeks = cycle.weeks.filter(w => w.phase === o.phase);
        if (weeks.length === 0) return null;
        const minutes = weeks.reduce((s, w) => s + w.totalMinutes, 0);
        return { ...o, weeks: weeks.length, first: weeks[0].week, last: weeks[weeks.length - 1].week, avgMin: Math.round(minutes / weeks.length) };
      })
      .filter(Boolean) as { phase: string; label: string; weeks: number; first: number; last: number; avgMin: number }[];
  }, [cycle]);

  const taperPlan = useMemo(() => {
    if (!cycle) return [];
    return cycle.weeks.filter(w => w.phase === 'taper' || w.phase === 'peak').map(w => ({
      week: w.week, phase: w.phase, minutes: w.totalMinutes, hiit: w.sessions.some(s => s.type === 'hiit'), sessions: w.sessions.length,
    }));
  }, [cycle]);

  const weekDays = useMemo(() => {
    if (!cycle) return [];
    const clamped = Math.max(1, Math.min(cycle.totalWeeks, weekNo));
    const w = cycle.weeks.find(x => x.week === clamped);
    return w ? spreadSessionsAcrossDays(w) : [];
  }, [cycle, weekNo]);

  const legDays = useMemo(() => new Set((cycle?.config?.legDays ?? []).filter(d => d >= 0 && d <= 6)), [cycle]);
  const legConflicts = useMemo(() => (cycle ? cardioWeekLegConflicts(cycle, Math.max(1, Math.min(cycle.totalWeeks, weekNo))) : []), [cycle, weekNo]);

  const goCurrentWeek = () => {
    if (!cycle) return;
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const w = cardioWeekForDate(cycle, iso, cycle.startDate);
    setWeekNo(Math.min(cycle.totalWeeks, Math.max(1, w?.week ?? 1)));
  };

  const copyKcal = () => {
    if (!cycle || !summary) return;
    const text = `Кардио «${cycle.name}»: ${summary.avgKcalPerWeek} ккал/нед (в среднем)`;
    try {
      navigator.clipboard.writeText(text).then(() => setKcalFlash(true)).catch(() => fallbackCopy(text));
    } catch { fallbackCopy(text); }
    if (!navigator.clipboard) fallbackCopy(text);
    window.setTimeout(() => setKcalFlash(false), 2000);
  };

  const fallbackCopy = (text: string) => {
    setKcalFlash(true);
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { /* ignore */ }
  };

  const visibleWeeks = showAllWeeks || (cycle?.totalWeeks ?? 0) <= 16 ? (cycle?.weeks ?? []) : (cycle?.weeks ?? []).slice(0, 12);
  // Виртуализация для 52 нед — рендер только видимого окна (динамическая высота)
  const virtualRef = useRef<HTMLDivElement>(null);
  const [virtualScroll, setVirtualScroll] = useState(0);
  const [rowH, setRowH] = useState(118);
  const measureRef = useRef<HTMLDivElement>(null);
  const onVirtualScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => setVirtualScroll(e.currentTarget.scrollTop), []);
  const ROW_H = rowH;
  const VIEW_H = 420;

  const previewImprove = () => {
    if (!cycle) return;
    const r = improveCardioCycle(cycle, { daysAvailable, recoveryLow });
    if (r.changes.length === 0) { setImprove({ changes: [], cycle }); return; }
    setImprove({ changes: r.changes, cycle: r.cycle });
  };

  const applyImprove = () => {
    if (!improve || improve.changes.length === 0) return;
    onImproved(improve.cycle);
    setImprove(null);
  };

  const SUB_TABS = [
    { id: 'overview', label: 'Обзор', icon: '📊' },
    { id: 'variants', label: 'Варианты', icon: '⇄' },
    { id: 'plan', label: 'План', icon: '🗓' },
    { id: 'chart', label: 'График', icon: '📈' },
    { id: 'details', label: 'Детали', icon: '📋' },
  ] as const;

  if (!cycle || !summary) {
    return (
      <div style={CARD}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
          Соберите кардио-цикл из параметров и стартов — появится предпросмотр по неделям.
        </div>
        <button style={BTN_PRIMARY} onClick={onBuild}>🛠 Собрать и сохранить цикл</button>
      </div>
    );
  }

  const metrics = [
    { label: 'Недель', value: String(cycle.totalWeeks), color: '#22c55e' },
    { label: 'Мин/нед', value: String(summary.avgMinutesPerWeek), color: '#3b82f6' },
    { label: 'Ккал/нед', value: String(summary.avgKcalPerWeek), color: '#f59e0b' },
    { label: 'HIIT-нед', value: String(summary.hiitWeeks), color: '#a78bfa' },
    { label: 'Цель', value: CARDIO_GOAL_LABELS[cycle.goal], color: '#94a3b8' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hero сводка — всегда видна */}
      <div style={CARD_HERO}>
        <div style={ROW}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{cycle.name}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>создан {new Date(cycle.createdAt).toLocaleDateString('ru-RU')}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: summary ? '#00e68a' : '#fff', background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.24)', borderRadius: 20, padding: '3px 10px' }}>{cycle.totalWeeks} нед · {summary.avgMinutesPerWeek} мин/нед</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ flex: '1 1 86px', padding: '9px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>{m.label}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={{ ...BTN_PRIMARY, flex: '1 1 140px' }} onClick={onBuild}>🔄 Пересобрать цикл</button>
          <button style={{ ...BTN, flex: '1 1 140px' }} onClick={onEditConfig} title="Загрузить параметры цикла">⚙️ Изменить параметры</button>
          <button style={{ ...BTN, flex: '1 1 120px' }} onClick={copyKcal} aria-label="Скопировать ккал">
            {kcalFlash ? '✅ Ккал в буфере' : '🔥 Ккал в буфер'}
          </button>
        </div>
        {paramsDirty && (
          <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.32)', borderRadius: 10, padding: '8px 10px' }} role="status">
            ⚠ Параметры в мастере изменены — показан последний собранный цикл. Нажмите «🔄 Пересобрать цикл», чтобы применить изменения.
          </div>
        )}
      </div>

      <Tabs tabs={SUB_TABS as unknown as { id: string; label: string; icon?: string }[]} active={subTab} onChange={v => setSubTab(v as typeof subTab)} />

      {subTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Почему план + факторы + питание */}
          <div style={CARD}>
            <div style={LABEL}>💡 Почему этот план</div>
            {explanation.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>• {e}</div>
            ))}
          </div>
          {factorsSummary.length > 0 && (
            <div style={CARD}>
              <div style={LABEL}>📊 Учтённые факторы</div>
              {factorsSummary.map((f, i) => (
                <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>• {f}</div>
              ))}
            </div>
          )}
          {nutritionNotes.length > 0 && (
            <div style={CARD}>
              <div style={LABEL}>🍽 Питание для кардио</div>
              {nutritionNotes.map((n, i) => (
                <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>• {n}</div>
              ))}
            </div>
          )}
          {quality && (
            <div style={CARD}>
              <div style={ROW}>
                <span style={LABEL}>📊 Качество цикла</span>
                <Badge bg={quality.score >= 85 ? 'rgba(34,197,94,0.14)' : quality.score >= 60 ? 'rgba(245,158,11,0.14)' : 'rgba(239,68,68,0.14)'} border={quality.score >= 85 ? 'rgba(34,197,94,0.28)' : quality.score >= 60 ? 'rgba(245,158,11,0.28)' : 'rgba(239,68,68,0.28)'} color={quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444'}>{quality.score}/100</Badge>
                <span style={{ flex: 1 }} />
                <button style={{ ...BTN, minHeight: 36, padding: '6px 14px' }} onClick={previewImprove}>✨ Улучшить</button>
              </div>
              <ProgressBar value={quality.score} color={quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444'} height={8} />
              {quality.findings.map((f, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.4, color: f.level === 'warn' ? '#fbbf24' : f.level === 'ok' ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.72)' }}>
                  {f.level === 'warn' ? '⚠ ' : f.level === 'ok' ? '✅ ' : '💡 '}{f.text}
                </div>
              ))}
              {improve && (
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {improve.changes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>План уже оптимален — улучшать нечего.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>Авто-улучшения ({improve.changes.length}):</div>
                      {improve.changes.map((c, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#fff' }}>Нед {c.week}: <b>{c.label}</b> — {c.from} → {c.to}</div>
                      ))}
                      <div style={ROW}>
                        <button style={BTN_PRIMARY} onClick={applyImprove}>✓ Применить</button>
                        <button style={BTN_DANGER} onClick={() => setImprove(null)}>✕ Отмена</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {(() => {
            const forecast = cardioFitnessForecast(cycle);
            const hints = cardioCoachHints(cycle);
            const tests = hints.filter(h => h.kind === 'test');
            return (
              <div style={{ ...CARD, borderColor: 'rgba(96,165,250,0.24)' }}>
                <div style={LABEL}>📈 Адаптация и контроль</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                  Прогноз: <b style={{ color: '#60a5fa' }}>+{forecast.vo2GainPct}% VO2max</b> за {forecast.effectiveWeeks} рабочих нед
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>{forecast.note}</div>
                {tests.length > 0 && (
                  <div style={{ fontSize: 11, color: '#4ade80', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', borderRadius: 8, padding: '8px 10px' }}>
                    🔬 Контрольные замеры: недели {tests.map(t => t.week).join(', ')} — 30 мин комфортно, сравните пульс.
                  </div>
                )}
                {hints.filter(h => h.kind !== 'work').slice(0, 3).map(h => (
                  <div key={h.week} style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', lineHeight: 1.45 }}>
                    • Нед {h.week} ({CARDIO_PHASE_LABELS[h.phase]}): {h.text}
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={CARD}>
            <div style={LABEL}>✏️ Название цикла</div>
            <div style={ROW}>
              <input value={nameDraft || cycle.name} onChange={e => setNameDraft(e.target.value)} style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13 }} aria-label="Название цикла" />
              <button style={BTN_PRIMARY} onClick={() => { if (nameDraft.trim()) { onRename(nameDraft.trim()); setNameDraft(''); } }}>💾 Переименовать</button>
            </div>
          </div>
        </div>
      )}

      {subTab === 'variants' && (
        <div style={CARD}>
          <div style={LABEL}>⇄ Варианты нагрузки — выберите и цикл пересоберётся сразу</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {variants.map(v => (
              <div key={v.id} style={variant === v.id ? VARIANT_ACTIVE : VARIANT_CARD} onClick={() => onVariant(v.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVariant(v.id); } }} role="button" tabIndex={0} aria-pressed={variant === v.id} aria-label={`Вариант: ${v.label}`}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{v.label}</div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: variant === v.id ? '#00e68a' : 'rgba(255,255,255,0.72)' }}>{v.summary.avgMinutesPerWeek} мин/нед · {v.summary.hiitWeeks} HIIT</div>
                <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.55)', lineHeight: 1.35 }}>{v.desc}</div>
              </div>
            ))}
          </div>
          <div style={HINT_SM}>Вариант применяется сразу: мягкий = новичок+восстановление низкое, интенсивный = продвинутый. Текущий: <b style={{ color: '#00e68a' }}>{CARDIO_VARIANT_LABELS[variant]}</b></div>
        </div>
      )}

      {subTab === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={CARD}>
            <div style={LABEL}>🗂 План по фазам</div>
            <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              {phasesPlan.map(p => (
                <div key={p.phase} title={`${p.label}: ${p.weeks} нед`} style={{ flex: p.weeks, background: PHASE_COLOR[p.phase] ?? '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{p.weeks >= 4 ? p.label : ''}</div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {phasesPlan.map(p => (
                <div key={p.phase} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' }}>
                  <span style={{ width: 130, fontWeight: 800, color: PHASE_COLOR[p.phase] ?? '#888' }}>{p.label}</span>
                  <span style={{ width: 110, color: 'rgba(255,255,255,0.72)' }}>нед {p.first}–{p.last}</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{p.weeks} нед</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ color: 'rgba(255,255,255,0.72)' }}>~{p.avgMin} мин/нед</span>
                </div>
              ))}
            </div>
          </div>
          {taperPlan.length > 0 && (
            <div style={{ ...CARD, borderColor: 'rgba(234,179,8,0.24)' }}>
              <div style={LABEL}>{cycle.config?.taper === false ? '🏔 Пик-неделя (без taper)' : '📉 Taper-план перед стартом'}</div>
              {taperPlan.map(w => (
                <div key={w.week} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' }}>
                  <span style={{ width: 52, fontWeight: 800, color: PHASE_COLOR[w.phase] }}>нед {w.week}</span>
                  <span style={{ width: 90, color: 'rgba(255,255,255,0.72)' }}>{CARDIO_PHASE_LABELS[w.phase]}</span>
                  <span style={{ color: '#fff' }}>{w.minutes} мин · {w.sessions} сесс</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ color: w.hiit ? '#f87171' : '#4ade80', fontWeight: 700 }}>{w.hiit ? 'HIIT' : 'без HIIT'}</span>
                </div>
              ))}
            </div>
          )}
          <div style={CARD}>
            <div style={ROW}>
              <span style={LABEL}>🗓 Неделя по дням</span>
              <Stepper value={Math.min(cycle.totalWeeks, Math.max(1, weekNo))} min={1} max={cycle.totalWeeks} step={1} onChange={setWeekNo} ariaPrefix="Неделя" suffix={`из ${cycle.totalWeeks}`} width={50} />
              <button style={BTN} onClick={goCurrentWeek} title="К текущей неделе" aria-label="К текущей неделе">📍 Сегодня</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
              {DAY_LABELS_RU.map((d, i) => {
                const isLeg = legDays.has(i);
                const sess = weekDays.filter(s => s.dayOfWeek === i);
                const isConflict = isLeg && sess.some(s => s.type !== 'recovery');
                return (
                  <div key={d} style={{ ...DAY_CELL, ...(isLeg ? { background: isConflict ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.08)', border: isConflict ? '1px solid rgba(239,68,68,0.36)' : '1px solid rgba(245,158,11,0.30)' } : {}) }}>
                    <div style={{ color: isLeg ? '#fbbf24' : '#fff', fontWeight: 800, fontSize: 11 }}>{d}{isLeg ? ' 🦵' : ''}</div>
                    {sess.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>—</div> : sess.map((s, j) => (
                      <button
                        key={j}
                        onClick={() => setSelectedSession({ week: Math.min(cycle.totalWeeks, Math.max(1, weekNo)), dayOfWeek: i })}
                        title="Протокол"
                        style={{ color: isConflict && s.type !== 'recovery' ? '#f87171' : '#4ade80', fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap', background: `${isConflict && s.type !== 'recovery' ? 'rgba(239,68,68,0.12)' : 'rgba(0,230,138,0.08)'}`, border: `1px solid ${isConflict && s.type !== 'recovery' ? 'rgba(239,68,68,0.22)' : 'rgba(0,230,138,0.16)'}`, borderRadius: 8, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                        aria-label={`Протокол: ${TYPE_LABEL[s.type]} ${d}`}
                      >
                        {TYPE_LABEL[s.type]} {s.durationMin}м
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            {legDays.size > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.85)', lineHeight: 1.4 }}>
                🦵 Дни ног: {DAY_LABELS_RU.filter((_, i) => legDays.has(i)).join(', ')} — интенсивное кардио не ставится (recovery — можно).
              </div>
            )}
            {legConflicts.length > 0 && (
              <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '7px 10px' }} role="alert">
                ⚠ Нед {Math.max(1, Math.min(cycle.totalWeeks, weekNo))}: на дне ног ({legConflicts.map(c => DAY_LABELS_RU[c.dayOfWeek]).join(', ')}) — перенесите на «Конструктор недели».
              </div>
            )}
            {selectedSession && (() => {
              const w = cycle.weeks.find(x => x.week === selectedSession.week);
              const s = w?.sessions.find(x => x.dayOfWeek === selectedSession.dayOfWeek);
              if (!s) return null;
              const protocol = cardioSessionProtocol(s);
              return (
                <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }} role="status">
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>📋 Протокол: {TYPE_LABEL[s.type]} {s.durationMin} мин · нед {selectedSession.week}</div>
                  {protocol.map(p => (
                    <div key={p.name} style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                      <b style={{ color: '#fff' }}>{p.name}</b> {p.minutes} мин — {p.note}{p.hrZone?.max ? ` · ЧСС ${p.hrZone.min}-${p.hrZone.max}` : ''}
                    </div>
                  ))}
                  <button style={{ ...BTN, minHeight: 32, padding: '6px 10px', alignSelf: 'flex-start' }} onClick={() => setSelectedSession(null)}>✕ Закрыть</button>
                </div>
              );
            })()}
          </div>
          <CardioCalendar cycle={cycle} defaultOpen />
        </div>
      )}

      {subTab === 'chart' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CardioProgressCard cycle={cycle} />
          <CardioVolumeChart cycle={cycle} defaultOpen />
        </div>
      )}

      {subTab === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={CARD}>
            <div style={ROW}>
              <span style={LABEL}>🗓 Недели ({cycle.totalWeeks})</span>
              <span style={{ flex: 1 }} />
              <Badge bg="rgba(255,255,255,0.06)" border="rgba(255,255,255,0.12)" color="rgba(255,255,255,0.72)">{showAllWeeks && (cycle.totalWeeks ?? 0) > 16 ? cycle.totalWeeks : visibleWeeks.length} показано</Badge>
            </div>
            {showAllWeeks && (cycle.totalWeeks ?? 0) > 16 ? (
              <div ref={virtualRef} onScroll={onVirtualScroll} style={{ height: VIEW_H, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, scrollbarWidth: 'thin' }}>
                <div ref={measureRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: 'calc(100% - 8px)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid #888', borderRadius: 10, padding: '8px 10px', minHeight: 92 }}>
                    <div style={{ height: 18 }}>measure</div>
                  </div>
                </div>
                {(() => {
                  const all = cycle.weeks;
                  // динамическая высота — измеряем скрытый образец при маунте
                  if (measureRef.current && rowH === 118) {
                    const h = measureRef.current.firstElementChild?.getBoundingClientRect().height;
                    if (h && Math.abs(h + 6 - rowH) > 4) setTimeout(() => setRowH(Math.round(h + 6)), 0);
                  }
                  const startIdx = Math.max(0, Math.floor(virtualScroll / ROW_H) - 1);
                  const endIdx = Math.min(all.length, Math.ceil((virtualScroll + VIEW_H) / ROW_H) + 1);
                  const slice = all.slice(startIdx, endIdx);
                  const topPad = startIdx * ROW_H;
                  const bottomPad = (all.length - endIdx) * ROW_H;
                  return (
                    <>
                      {topPad > 0 && <div style={{ height: topPad, flexShrink: 0 }} aria-hidden />}
                      {slice.map(w => {
                        const hint = cardioCoachHints(cycle).find(h => h.week === w.week);
                        const color = PHASE_COLOR[w.phase] ?? '#888';
                        return (
                          <div key={w.week} style={{
                            display: 'flex', flexDirection: 'column', gap: 4,
                            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                            borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '8px 10px', minHeight: 92,
                          }}>
                            <div style={ROW}>
                              <span style={{ minWidth: 22, fontSize: 12, fontWeight: 900, color }}>{w.week}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                                {CARDIO_PHASE_LABELS[w.phase]}{w.deload ? ' · делод' : ''}{w.taper ? ' · taper' : ''}
                              </span>
                              {w.deload && <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '2px 8px' }}>🧘 делод</span>}
                              {w.taper && <span style={{ fontSize: 10, fontWeight: 700, color: '#eab308', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 20, padding: '2px 8px' }}>📉 taper</span>}
                              <span style={{ flex: 1 }} />
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{w.totalMinutes} мин · {w.totalKcal} ккал</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 22 }}>
                              {w.sessions.map((s, i) => (
                                <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', whiteSpace: 'nowrap', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)', borderRadius: 20, padding: '3px 8px' }}>
                                  {TYPE_LABEL[s.type]} {s.durationMin}×{s.weeklyFrequency}{s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}{s.targetHr?.max ? ' · ' + s.targetHr.min + '-' + s.targetHr.max : ''}
                                </span>
                              ))}
                            </div>
                            {hint && hint.kind !== 'work' && (
                              <div style={{ fontSize: 11, color: hint.kind === 'test' ? '#4ade80' : hint.kind === 'deload' ? '#fbbf24' : hint.kind === 'taper' ? '#eab308' : '#f87171', paddingLeft: 22, lineHeight: 1.4 }}>
                                {hint.kind === 'test' ? '🔬 ' : hint.kind === 'deload' ? '🧘 ' : hint.kind === 'taper' ? '📉 ' : '🎭 '}{hint.text}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {bottomPad > 0 && <div style={{ height: bottomPad, flexShrink: 0 }} aria-hidden />}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visibleWeeks.map(w => {
                  const hint = cardioCoachHints(cycle).find(h => h.week === w.week);
                  const color = PHASE_COLOR[w.phase] ?? '#888';
                  return (
                    <div key={w.week} style={{
                      display: 'flex', flexDirection: 'column', gap: 4,
                      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                      borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '8px 10px',
                    }}>
                      <div style={ROW}>
                        <span style={{ minWidth: 22, fontSize: 12, fontWeight: 900, color }}>{w.week}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                          {CARDIO_PHASE_LABELS[w.phase]}{w.deload ? ' · делод' : ''}{w.taper ? ' · taper' : ''}
                        </span>
                        {w.deload && <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '2px 8px' }}>🧘 делод</span>}
                        {w.taper && <span style={{ fontSize: 10, fontWeight: 700, color: '#eab308', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 20, padding: '2px 8px' }}>📉 taper</span>}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{w.totalMinutes} мин · {w.totalKcal} ккал</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 22 }}>
                        {w.sessions.map((s, i) => (
                          <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', whiteSpace: 'nowrap', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)', borderRadius: 20, padding: '3px 8px' }}>
                            {TYPE_LABEL[s.type]} {s.durationMin}×{s.weeklyFrequency}{s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}{s.targetHr?.max ? ' · ' + s.targetHr.min + '-' + s.targetHr.max : ''}
                          </span>
                        ))}
                      </div>
                      {hint && hint.kind !== 'work' && (
                        <div style={{ fontSize: 11, color: hint.kind === 'test' ? '#4ade80' : hint.kind === 'deload' ? '#fbbf24' : hint.kind === 'taper' ? '#eab308' : '#f87171', paddingLeft: 22, lineHeight: 1.4 }}>
                          {hint.kind === 'test' ? '🔬 ' : hint.kind === 'deload' ? '🧘 ' : hint.kind === 'taper' ? '📉 ' : '🎭 '}{hint.text}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!showAllWeeks && (cycle.totalWeeks ?? 0) > 16 && (
                  <button style={{ ...BTN, minHeight: 36, padding: '8px 12px', alignSelf: 'flex-start' }} onClick={() => setShowAllWeeks(true)} aria-label="Показать все недели">
                    Показать все ({cycle.totalWeeks})
                  </button>
                )}
              </div>
            )}
          </div>
          {cycle.rationale.length > 0 && (
            <div style={CARD}>
              <div style={LABEL}>💡 Обоснование цикла</div>
              {cycle.rationale.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>• {r}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
