/**
 * CardioPreviewStep.tsx — шаг 3 мастера кардио: варианты нагрузки + объяснение
 * выбора, сборка, метрики, качество, «✨ Улучшить», план по фазам, taper-план,
 * неделя по дням, график объёма, таблица недель, обоснование.
 */
import React, { useMemo, useState } from 'react';
import {
  cardioCycleSummary, cardioQualityReport, cardioEquipmentLabel,
  cardioPlanVariants, improveCardioCycle, cardioSessionProtocol,
  spreadSessionsAcrossDays, DAY_LABELS_RU, cardioWeekForDate,
  cardioFitnessForecast, cardioCoachHints,
  CARDIO_GOAL_LABELS, CARDIO_PHASE_LABELS, CARDIO_VARIANT_LABELS,
  type CardioCycle, type CardioType, type CardioVariant, type CardioTuneChange,
} from '../../../engines/lms/cardio.engine';
import { CardioVolumeChart } from './CardioVolumeChart';
import { CardioProgressCard } from './CardioProgressCard';
import { CARD, ROW, LABEL, BTN, BTN_PRIMARY, BTN_DANGER, PHASE_COLOR, Stepper } from './CardioUI';

const VARIANT_BTN: React.CSSProperties = {
  flex: '1 1 100px', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', fontSize: 11,
};
const VARIANT_BTN_ACTIVE: React.CSSProperties = {
  ...VARIANT_BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff',
};
const DAY_CELL: React.CSSProperties = {
  flex: '1 1 42px', minWidth: 42, borderRadius: 8, padding: '6px 4px', textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 10,
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
  const [showWeeks, setShowWeeks] = useState(true);
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

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const NAV = [
    { id: 'sec-overview', label: '📊 Обзор' },
    { id: 'sec-variants', label: '⇄ Варианты' },
    { id: 'sec-phases', label: '🗂 Фазы' },
    { id: 'sec-quality', label: '📊 Качество' },
    { id: 'sec-nutrition', label: '🍽 Питание' },
    { id: 'sec-weeks', label: '🗓 Недели' },
    { id: 'sec-rationale', label: '💡 Обоснование' },
  ];

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

  if (!cycle || !summary) {
    return (
      <div style={CARD}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`@media (max-width:480px){.cardio-day-grid{display:grid!important;grid-template-columns:repeat(4,1fr)}.cardio-day-grid>div{min-width:0!important}}`}</style>
      <div style={CARD} id="sec-overview">
        <div style={ROW}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{cycle.name}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>создан {new Date(cycle.createdAt).toLocaleDateString('ru-RU')}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ flex: '1 1 90px', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={{ ...BTN_PRIMARY, flex: '1 1 140px' }} onClick={onBuild}>🔄 Пересобрать цикл</button>
          <button style={{ ...BTN, flex: '1 1 140px' }} onClick={onEditConfig} title="Загрузить параметры, из которых собран этот цикл, для редактирования">⚙️ Изменить параметры</button>
          <button style={{ ...BTN, flex: '1 1 140px' }} onClick={copyKcal} aria-label="Скопировать ккал">
            {kcalFlash ? '✅ Ккал в буфере' : '🔥 Ккал в буфер'}
          </button>
        </div>
        {paramsDirty && (
          <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 10px' }} role="status">
            ⚠ Параметры в мастере изменены — показан последний собранный цикл. Нажмите «🔄 Пересобрать цикл», чтобы применить изменения.
          </div>
        )}
      </div>

      {/* Якорная навигация по секциям */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {NAV.map(n => (
          <button key={n.id} style={{ ...BTN, minHeight: 30, padding: '5px 10px', fontSize: 10 }} onClick={() => goTo(n.id)} aria-label={`К разделу ${n.label}`}>{n.label}</button>
        ))}
      </div>

      {/* Варианты нагрузки */}
      <div style={CARD} id="sec-variants">
        <div style={LABEL}>⇄ Варианты нагрузки</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {variants.map(v => (
            <div key={v.id} style={variant === v.id ? VARIANT_BTN_ACTIVE : VARIANT_BTN} onClick={() => onVariant(v.id)} role="button" aria-label={`Вариант: ${v.label}`}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{v.label}</div>
              <div style={{ marginTop: 2, opacity: 0.7 }}>{v.summary.avgMinutesPerWeek} мин/нед · {v.summary.hiitWeeks} HIIT</div>
              <div style={{ fontSize: 9, marginTop: 2, opacity: 0.6 }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Почему этот план */}
      <div style={CARD}>
        <div style={LABEL}>💡 Почему этот план</div>
        {explanation.map((e, i) => (
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>• {e}</div>
        ))}
      </div>

      {/* Факторы восстановления/курса */}
      {factorsSummary.length > 0 && (
        <div style={CARD}>
          <div style={LABEL}>📊 Учтённые факторы</div>
          {factorsSummary.map((f, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>• {f}</div>
          ))}
        </div>
      )}

      {/* Питание для кардио */}
      {nutritionNotes.length > 0 && (
        <div style={CARD} id="sec-nutrition">
          <div style={LABEL}>🍽 Питание для кардио</div>
          {nutritionNotes.map((n, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>• {n}</div>
          ))}
        </div>
      )}

      {/* Качество + улучшить */}
      {quality && (
        <div style={CARD} id="sec-quality">
          <div style={ROW}>
            <span style={LABEL}>📊 Качество цикла</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444' }}>{quality.score}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>/100</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...BTN, minHeight: 34, padding: '6px 14px' }} onClick={previewImprove}>✨ Улучшить</button>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: quality.score + '%', height: '100%', borderRadius: 3, background: quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444' }} />
          </div>
          {quality.findings.map((f, i) => (
            <div key={i} style={{ fontSize: 10, lineHeight: 1.4, color: f.level === 'warn' ? '#fbbf24' : f.level === 'ok' ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.5)' }}>
              {f.level === 'warn' ? '⚠ ' : f.level === 'ok' ? '✅ ' : '💡 '}{f.text}
            </div>
          ))}
          {improve && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {improve.changes.length === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>План уже соответствует рекомендациям — улучшать нечего.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>Авто-улучшения ({improve.changes.length}):</div>
                  {improve.changes.map((c, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Нед {c.week}: <b>{c.label}</b> — {c.from} → {c.to}</div>
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

      {/* Адаптация и контроль (проф) */}
      {(() => {
        const forecast = cardioFitnessForecast(cycle);
        const hints = cardioCoachHints(cycle);
        const tests = hints.filter(h => h.kind === 'test');
        return (
          <div style={{ ...CARD, borderColor: 'rgba(96,165,250,0.3)' }}>
            <div style={LABEL}>📈 Адаптация и контроль</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
              Прогноз адаптации: <b style={{ color: '#60a5fa' }}>+{forecast.vo2GainPct}% VO2max</b> за цикл ({forecast.effectiveWeeks} рабочих нед)
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{forecast.note}</div>
            {tests.length > 0 && (
              <div style={{ fontSize: 10, color: '#4ade80', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', borderRadius: 8, padding: '6px 8px' }}>
                🔬 Контрольные замеры: недели {tests.map(t => t.week).join(', ')} — 30 мин на комфортном темпе, сравните пульс/ощущения с прошлым замером.
              </div>
            )}
            {hints.filter(h => h.kind !== 'work').slice(0, 4).map(h => (
              <div key={h.week} style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>
                • Нед {h.week} ({CARDIO_PHASE_LABELS[h.phase]}): {h.text}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Переименование */}
      <div style={CARD}>
        <div style={LABEL}>✏️ Название цикла</div>
        <div style={ROW}>
          <input value={nameDraft || cycle.name} onChange={e => setNameDraft(e.target.value)} style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} aria-label="Название цикла" />
          <button style={BTN_PRIMARY} onClick={() => { if (nameDraft.trim()) { onRename(nameDraft.trim()); setNameDraft(''); } }}>💾 Переименовать</button>
        </div>
      </div>

      {/* План по фазам */}
      <div style={CARD} id="sec-phases">
        <div style={LABEL}>🗂 План по фазам</div>
        <div style={{ display: 'flex', gap: 2, height: 14, borderRadius: 3, overflow: 'hidden' }}>
          {phasesPlan.map(p => (
            <div key={p.phase} title={`${p.label}: ${p.weeks} нед`} style={{ flex: p.weeks, background: PHASE_COLOR[p.phase] ?? '#888' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {phasesPlan.map(p => (
            <div key={p.phase} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 130, fontWeight: 700, color: PHASE_COLOR[p.phase] ?? '#888' }}>{p.label}</span>
              <span style={{ width: 110, color: 'rgba(255,255,255,0.55)' }}>нед {p.first}–{p.last}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{p.weeks} нед</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>~{p.avgMin} мин/нед</span>
            </div>
          ))}
        </div>
      </div>

      {/* Taper-план (или пик-недели при taper:false) */}
      {taperPlan.length > 0 && (
        <div style={{ ...CARD, borderColor: 'rgba(234,179,8,0.3)' }}>
          <div style={LABEL}>{cycle.config?.taper === false ? '🏔 Пик-неделя перед стартом (без taper)' : '📉 Taper-план перед стартом'}</div>
          {taperPlan.map(w => (
            <div key={w.week} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 44, fontWeight: 800, color: PHASE_COLOR[w.phase] }}>нед {w.week}</span>
              <span style={{ width: 90, color: 'rgba(255,255,255,0.6)' }}>{CARDIO_PHASE_LABELS[w.phase]}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{w.minutes} мин · {w.sessions} сессий</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: w.hiit ? '#f87171' : '#4ade80', fontWeight: 700 }}>{w.hiit ? 'есть HIIT' : 'без HIIT'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Неделя по дням */}
      <div style={CARD} id="sec-weeks">
        <div style={ROW}>
          <span style={LABEL}>🗓 Неделя по дням</span>
          <Stepper
            value={Math.min(cycle.totalWeeks, Math.max(1, weekNo))}
            min={1}
            max={cycle.totalWeeks}
            step={1}
            onChange={setWeekNo}
            ariaPrefix="Неделя"
            suffix={`из ${cycle.totalWeeks}`}
            width={50}
          />
          <button style={BTN} onClick={goCurrentWeek} title="Перейти к текущей неделе цикла" aria-label="К текущей неделе">📍</button>
        </div>
        <div className="cardio-day-grid" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DAY_LABELS_RU.map((d, i) => {
            const sess = weekDays.filter(s => s.dayOfWeek === i);
            return (
              <div key={d} style={DAY_CELL}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 3 }}>{d}</div>
                {sess.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.2)' }}>—</div> : sess.map((s, j) => (
                  <button
                    key={j}
                    onClick={() => setSelectedSession({ week: Math.min(cycle.totalWeeks, Math.max(1, weekNo)), dayOfWeek: i })}
                    title="Показать протокол сессии"
                    style={{ color: '#4ade80', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'nowrap', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10 }}
                    aria-label={`Протокол: ${TYPE_LABEL[s.type]} ${d}`}
                  >
                    {TYPE_LABEL[s.type]} {s.durationMin}м{s.equipment ? ` ${cardioEquipmentLabel(s.equipment)}` : ''}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {selectedSession && (() => {
          const w = cycle.weeks.find(x => x.week === selectedSession.week);
          const s = w?.sessions.find(x => x.dayOfWeek === selectedSession.dayOfWeek);
          if (!s) return null;
          const protocol = cardioSessionProtocol(s);
          return (
            <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }} role="status">
              <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>📋 Протокол: {TYPE_LABEL[s.type]} {s.durationMin} мин · нед {selectedSession.week}</div>
              {protocol.map(p => (
                <div key={p.name} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                  <b>{p.name}</b> {p.minutes} мин — {p.note}{p.hrZone?.max ? ` · ЧСС ${p.hrZone.min}-${p.hrZone.max}` : ''}
                </div>
              ))}
              <button style={{ ...BTN, minHeight: 30, padding: '4px 10px', alignSelf: 'flex-start' }} onClick={() => setSelectedSession(null)}>✕ Закрыть</button>
            </div>
          );
        })()}
      </div>

      <CardioProgressCard cycle={cycle} />
      <CardioVolumeChart cycle={cycle} />

      <div style={CARD}>
        <div style={ROW}>
          <span style={LABEL}>🗓 Недели</span>
          <button style={{ ...BTN, minHeight: 32, padding: '6px 12px' }} onClick={() => setShowWeeks(v => !v)}>{showWeeks ? '▾ Скрыть' : '▸ Показать'}</button>
        </div>
        {showWeeks && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {visibleWeeks.map(w => {
              const hint = cardioCoachHints(cycle).find(h => h.week === w.week);
              return (
                <div key={w.week} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={ROW}>
                    <span style={{ width: 26, fontSize: 11, fontWeight: 800, color: PHASE_COLOR[w.phase] ?? '#888' }}>{w.week}</span>
                    <span style={{ width: 92, fontSize: 11, color: 'var(--text-dim)' }}>
                      {CARDIO_PHASE_LABELS[w.phase]}{w.deload ? ' · делод' : ''}{w.taper ? ' · taper' : ''}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.sessions.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin}×${s.weeklyFrequency}${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? ' · ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join('  |  ')}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 74, textAlign: 'right' }}>{w.totalMinutes} мин · {w.totalKcal} ккал</span>
                  </div>
                  {hint && hint.kind !== 'work' && (
                    <div style={{ fontSize: 9, color: hint.kind === 'test' ? '#4ade80' : hint.kind === 'deload' ? '#fbbf24' : hint.kind === 'taper' ? '#eab308' : '#f87171', paddingLeft: 26, lineHeight: 1.4 }}>
                      {hint.kind === 'test' ? '🔬 ' : hint.kind === 'deload' ? '🧘 ' : hint.kind === 'taper' ? '📉 ' : '🎭 '}{hint.text}
                    </div>
                  )}
                </div>
              );
            })}
            {!showAllWeeks && (cycle.totalWeeks ?? 0) > 16 && (
              <button style={{ ...BTN, minHeight: 32, padding: '6px 12px', alignSelf: 'flex-start' }} onClick={() => setShowAllWeeks(true)} aria-label="Показать все недели">
                Показать все ({cycle.totalWeeks})
              </button>
            )}
          </div>
        )}
      </div>

      {cycle.rationale.length > 0 && (
        <div style={CARD} id="sec-rationale">
          <div style={LABEL}>💡 Обоснование</div>
          {cycle.rationale.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>• {r}</div>
          ))}
        </div>
      )}
    </div>
  );
};
