/**
 * WorkoutSummaryReport.tsx — сводный отчёт по тренировке / периоду.
 *
 * Один компонент для трёх поверхностей:
 *  • «Итог» после проведения тренировки (SessionPlayer);
 *  • дневник → «Отчёт» (тренировка / несколько / неделя / месяц / всё);
 *  • карточка тренировки в истории дневника.
 *
 * Визуал: KPI-плитки, распределение объёма по мышцам, таблицы упражнений и
 * движений, разбивка по тренировкам, рекорды. Блоки включаются чекбоксами,
 * выбор запоминается в localStorage (если задан storageKey).
 */
import React from 'react';
import type { WorkoutLog } from '../../../core/types';
import {
  buildWorkoutSummary,
  buildWorkoutInsights,
  buildSetDetails,
  compareWorkoutSummaries,
  formatSummaryPeriod,
  muscleLandmarksFor,
  volumeAdvice,
  comparePlanVsActual,
  summaryWeeksCount,
  MUSCLE_COLORS,
  PLAN_ROW_COLOR,
  PLAN_ROW_LABEL,
  VOLUME_STATUS_COLOR,
  VOLUME_STATUS_LABEL,
  ALL_REPORT_BLOCKS,
  REPORT_BLOCKS,
  type PlannedExerciseInput,
  type PlanVsActual,
  type PlanVsActualRow,
  type ReportBlockId,
  type SetDetailSession,
  type SummaryComparison,
  type MetricDelta,
  type WorkoutSummary,
} from '../../../engines/workout-summary.engine';
import { normalizeExerciseName } from '../../../engines/set-intensity.engine';

const ACCENT = '#00e68a';
/** Сколько тренировок в блоке «Все подходы» показывать до раскрытия. */
const SETS_LIMIT = 40;
const CARD: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: 'rgba(24,24,27,0.42)',
  border: '1px solid rgba(255,255,255,0.07)',
  backdropFilter: 'blur(12px)' as any,
  marginBottom: 8,
};

const fmtInt = (n: number) => Math.round(n || 0).toLocaleString('ru-RU');
const fmtTon = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} т` : `${fmtInt(kg)} кг`);
const LEVEL_RU: Record<string, string> = {
  beginner: 'новичок',
  intermediate: 'средний',
  advanced: 'продвинутый',
  enhanced: 'PED-уровень',
};
const fmtDate = (iso: string) => {
  const d = new Date(`${String(iso || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? (iso || '—')
    : d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

function readBlocks(key?: string, fallback?: ReportBlockId[]): ReportBlockId[] {
  const def = fallback && fallback.length ? fallback : ALL_REPORT_BLOCKS;
  if (!key || typeof localStorage === 'undefined') return def;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return def;
    const valid = parsed.filter((x: any) => (ALL_REPORT_BLOCKS as string[]).includes(x));
    return valid.length ? valid : def;
  } catch {
    return def;
  }
}

/* ─── Чекбоксы блоков отчёта ─── */
export const ReportBlockPicker: React.FC<{
  value: ReportBlockId[];
  onChange: (next: ReportBlockId[]) => void;
  compact?: boolean;
}> = ({ value, onChange, compact }) => {
  const has = (id: ReportBlockId) => value.includes(id);
  const toggle = (id: ReportBlockId) => {
    onChange(has(id) ? value.filter(x => x !== id) : ALL_REPORT_BLOCKS.filter(x => x === id || has(x)));
  };
  const allOn = value.length === ALL_REPORT_BLOCKS.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Что показать</span>
        <button
          type="button"
          onClick={() => onChange(ALL_REPORT_BLOCKS.slice())}
          style={{
            padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, cursor: 'pointer',
            border: allOn ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.14)',
            background: allOn ? 'rgba(0,230,138,0.16)' : 'rgba(255,255,255,0.04)',
            color: allOn ? ACCENT : '#fff',
          }}
        >Показать всё</button>
        <button
          type="button"
          onClick={() => onChange(['totals', 'muscles', 'exercises'])}
          style={{ padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}
        >Кратко</button>
        <button
          type="button"
          onClick={() => onChange([])}
          style={{ padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}
        >Сбросить</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {REPORT_BLOCKS.map(b => {
          const on = has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(b.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: compact ? '3px 8px' : '5px 10px', borderRadius: 999, cursor: 'pointer',
                border: on ? '1px solid rgba(0,230,138,0.55)' : '1px solid rgba(255,255,255,0.12)',
                background: on ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                color: on ? ACCENT : '#fff', fontSize: compact ? 10 : 11, fontWeight: 700,
              }}
            >
              <span style={{
                width: 13, height: 13, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: on ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.3)',
                background: on ? ACCENT : 'transparent', color: '#000', fontSize: 9, lineHeight: 1,
              }}>{on ? '✓' : ''}</span>
              {b.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ icon: string; title: string; hint?: string }> = ({ icon, title, hint }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{icon} {title}</span>
    {hint && <span style={{ fontSize: 9, color: '#fff', opacity: 0.75 }}>{hint}</span>}
  </div>
);

const Tile: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({ label, value, sub, color }) => (
  <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 9px' }}>
    <div style={{ fontSize: 9, color: '#fff', opacity: 0.85, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 800, color: color || '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{value}</div>
    {sub && <div style={{ fontSize: 9, color: '#fff', opacity: 0.65, marginTop: 1 }}>{sub}</div>}
  </div>
);

const Bar: React.FC<{ pct: number; color: string; height?: number }> = ({ pct, color, height }) => (
  <div style={{ height: height || 5, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 999 }} />
  </div>
);

/** Шкала MEV→MAV→MRV с отметкой фактических подходов в неделю. */
const LandmarkBar: React.FC<{ sets: number; mev: number; mav: number; mrv: number }> = ({ sets, mev, mav, mrv }) => {
  const max = Math.max(mrv * 1.15, sets, 1);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  const markerColor = sets < mev ? '#60a5fa' : sets <= mav ? '#22c55e' : sets <= mrv ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ width: `${pct(mev)}%`, background: 'rgba(59,130,246,0.45)' }} />
        <div style={{ width: `${Math.max(0, pct(mav) - pct(mev))}%`, background: 'rgba(34,197,94,0.45)' }} />
        <div style={{ width: `${Math.max(0, pct(mrv) - pct(mav))}%`, background: 'rgba(245,158,11,0.45)' }} />
      </div>
      <div style={{ position: 'absolute', top: -1, bottom: -1, left: `calc(${pct(sets)}% - 1px)`, width: 2, background: markerColor, boxShadow: `0 0 4px ${markerColor}` }} />
    </div>
  );
};

/** Мини-график тренда e1RM по тренировкам периода. */
const Sparkline: React.FC<{ values: number[]; color?: string; width?: number; height?: number }> = ({ values, color = ACCENT, width = 56, height = 16 }) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / span) * (height - 3) - 1.5;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={y(values[values.length - 1])} r={1.8} fill={color} />
    </svg>
  );
};

/** Плитка дельты: текущее значение и изменение к прошлому периоду. */
const DeltaChip: React.FC<{ label: string; d: MetricDelta; unit?: string; neutral?: boolean; decimals?: boolean }> = ({ label, d, unit, neutral = false, decimals = false }) => {
  const color = d.delta === 0 || neutral
    ? 'rgba(255,255,255,0.7)'
    : d.delta > 0 ? '#22c55e' : '#ef4444';
  const fmtNum = (n: number) => (decimals ? String(Math.round(n * 10) / 10) : fmtInt(n));
  const text = d.delta === 0
    ? '= без изменений'
    : `${d.delta > 0 ? '+' : ''}${fmtNum(d.delta)}${d.pct != null ? ` (${d.pct > 0 ? '+' : ''}${d.pct}%)` : ' · нет базы'}`;
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '6px 8px' }}>
      <div style={{ fontSize: 8.5, color: '#fff', opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {fmtNum(d.current)}{unit ? ` ${unit}` : ''}
      </div>
      <div style={{ fontSize: 9, color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{text}</div>
    </div>
  );
};

/* ─── Тело отчёта (без выбора блоков) ─── */
export const WorkoutSummaryBody: React.FC<{
  summary: WorkoutSummary;
  blocks: ReportBlockId[];
  compact?: boolean;
  /** Уровень спортсмена — для ориентиров MEV/MAV/MRV. */
  level?: string;
  /** Подходы «как есть» для блока «Подходы». */
  details?: SetDetailSession[];
  /** Сравнение с предыдущим периодом (null — сравнивать не с чем). */
  comparison?: SummaryComparison | null;
  /** Подпись предыдущего периода: «прошлой неделей» и т.п. */
  previousLabel?: string;
  /** План тренировки (targetSets) — строки «план → факт» в упражнениях. */
  plan?: PlannedExerciseInput[] | null;
}> = ({ summary, blocks, compact, level = 'intermediate', details, comparison, previousLabel, plan }) => {
  const [onlyProblems, setOnlyProblems] = React.useState(false);
  // Список подходов в отчёте длинный: за неделю-месяц это десятки тренировок.
  // Показываем первые SETS_LIMIT и даём раскрыть всё — без «обрезано и всё».
  const [showAllSets, setShowAllSets] = React.useState(false);
  // План против факта: только когда план передан (плеер знает targetSets,
  // дневник — нет). Считаем по сводке, поэтому цифры совпадают с отчётом.
  const planVsActual = React.useMemo<PlanVsActual | null>(
    () => (Array.isArray(plan) && plan.length > 0 ? comparePlanVsActual(plan, summary) : null),
    [plan, summary],
  );
  const has = (id: ReportBlockId) => blocks.includes(id);
  const t = summary.totals;
  if (summary.workouts === 0) {
    return (
      <div style={{ ...CARD, textAlign: 'center', fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
        Нет данных для отчёта. Запишите тренировку — сводка появится здесь.
      </div>
    );
  }
  const bestE1RM = summary.exercises.reduce((m, e) => Math.max(m, e.bestE1RM), 0);
  const topExercise = summary.exercises[0] || null;
  const topMuscle = summary.muscles[0] || null;
  const insights = buildWorkoutInsights(summary, level, comparison, planVsActual);
  const weeksCount = summaryWeeksCount(summary);
  const maxMuscleTonnage = Math.max(1, ...summary.muscles.map(m => m.tonnageKg));
  const maxExTonnage = Math.max(1, ...summary.exercises.map(e => e.tonnageKg));
  const maxWeekTonnage = Math.max(1, ...summary.weeks.map(w => w.tonnageKg));
  // Ориентиры MEV/MAV/MRV — недельные. Если в отчёте одна тренировка, «+5/нед»
  // обещать нельзя: неизвестно, единственная ли она за неделю. Тогда совет
  // теряет «/нед», а строка мышцы честно говорит про недельные ориентиры.
  const perWeek = summary.workouts > 1;
  // Ориентиры считаем один раз: они нужны и фильтру, и сводке статусов.
  const muscleRows = summary.muscles.map(m => {
    const weekly = Math.round(m.sets / weeksCount);
    return { m, weekly, lm: muscleLandmarksFor(m.muscle, weekly, level) };
  });
  const problemCount = muscleRows.filter(r => r.lm && (r.lm.status === 'below_mev' || r.lm.status === 'exceeding_mrv')).length;
  const shownMuscleRows = onlyProblems
    ? muscleRows.filter(r => r.lm && (r.lm.status === 'below_mev' || r.lm.status === 'exceeding_mrv'))
    : muscleRows;

  return (
    <>
      {/* ── ОБЩЕЕ ── */}
      {has('totals') && (
        <div style={CARD}>
          <SectionTitle icon="📊" title="Общие показатели" hint={summary.workouts > 1 ? `за ${summary.workouts} тренировок` : 'за тренировку'} />
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fit, minmax(96px, 1fr))', gap: 6 }}>
            <Tile label="Тоннаж" value={fmtTon(t.tonnageKg)} sub={topExercise ? `топ: ${topExercise.name}` : undefined} color={ACCENT} />
            <Tile label="Подходы" value={fmtInt(t.sets)} sub={`${t.avgSetsPerSession} / трень`} color="#60a5fa" />
            <Tile label="Повторы" value={fmtInt(t.reps)} sub={`${t.avgRepsPerSet} за подход`} color="#a78bfa" />
            <Tile label="Движений" value={fmtInt(t.uniqueExercises)} sub={`${t.sessions} тренировок`} color="#f59e0b" />
            <Tile label="Время" value={t.durationMin > 0 ? `${fmtInt(t.durationMin)} мин` : '—'} sub={t.durationMin > 0 ? `ср. ${t.avgSessionMin} мин` : undefined} />
            <Tile label="Плотность" value={t.densityKgPerMin > 0 ? `${fmtInt(t.densityKgPerMin)} кг/мин` : '—'} sub="объём ÷ время" color="#22d3ee" />
            <Tile label="Средний вес" value={t.avgLoadKg > 0 ? `${t.avgLoadKg} кг` : '—'} sub={t.maxLoadKg > 0 ? `макс ${t.maxLoadKg} кг` : undefined} />
            <Tile label="Лучший e1RM" value={bestE1RM > 0 ? `${fmtInt(bestE1RM)} кг` : '—'} sub={t.avgRIR != null ? `ср. RIR ${t.avgRIR}` : undefined} color="#f472b6" />
            <Tile label="Интенсивность" value={t.avgIntensityPct != null ? `${t.avgIntensityPct}%` : '—'} sub="средний вес от e1RM" color="#fb923c" />
          </div>
          {(topMuscle || t.prs > 0 || t.weightlessSets > 0) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {topMuscle && (
                <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.22)', color: ACCENT }}>
                  Приоритет объёма: {topMuscle.label} · {topMuscle.sharePct}%
                </span>
              )}
              {t.prs > 0 && (
                <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)', color: '#f59e0b' }}>
                  🏆 рекордов: {t.prs}
                </span>
              )}
              {t.avgRPE != null && (
                <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.22)', color: '#60a5fa' }}>
                  RPE в среднем {t.avgRPE}
                </span>
              )}
              {t.weightlessSets > 0 && (
                <span
                  title="Подходы со своим весом (подтягивания, отжимания, планка) не дают внешней нагрузки, поэтому в тоннаж не входят"
                  style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.28)', color: '#cbd5e1' }}
                >
                  ⚖️ {t.weightlessSets} подх. без веса — вне тоннажа
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ВЫВОДЫ ── */}
      {has('insights') && insights.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="🧠" title="Выводы" hint="что важно в этой тренировке или периоде" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {insights.map((ins, i) => {
              const color = ins.tone === 'good' ? '#22c55e' : ins.tone === 'warn' ? '#f59e0b' : '#60a5fa';
              return (
                <div key={`${ins.id}_${i}`} style={{ display: 'flex', gap: 7, padding: '6px 8px', borderRadius: 9, background: `${color}12`, border: `1px solid ${color}33` }}>
                  <span style={{ fontSize: 13, lineHeight: 1.1, flexShrink: 0 }}>{ins.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color }}>{ins.title}</div>
                    <div style={{ fontSize: 9.5, color: '#fff', opacity: 0.82, lineHeight: 1.35, marginTop: 1 }}>{ins.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── СРАВНЕНИЕ ── */}
      {has('compare') && comparison && !comparison.empty && (
        <div style={CARD}>
          <SectionTitle icon="↔" title="Сравнение периодов" hint={`с ${previousLabel || 'предыдущим равным периодом'}`} />
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fit, minmax(92px, 1fr))', gap: 6 }}>
            <DeltaChip label="Тоннаж, кг" d={comparison.metrics.tonnage} />
            <DeltaChip label="Подходы" d={comparison.metrics.sets} />
            <DeltaChip label="Повторы" d={comparison.metrics.reps} />
            <DeltaChip label="Тренировки" d={comparison.metrics.sessions} />
            {comparison.metrics.density.previous > 0 && <DeltaChip label="Плотность, кг/мин" d={comparison.metrics.density} />}
            {comparison.metrics.duration.previous > 0 && <DeltaChip label="Время, мин" d={comparison.metrics.duration} />}
            {comparison.metrics.rir && <DeltaChip label="Средний RIR" d={comparison.metrics.rir} neutral decimals />}
          </div>

          {(() => {
            const rows = comparison.muscles.filter(m => m.sets.delta !== 0).slice(0, compact ? 4 : 8);
            if (rows.length === 0) return null;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: '#fff', opacity: 0.8, marginBottom: 3 }}>Подходы по мышцам</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {rows.map(m => {
                    const color = m.sets.delta > 0 ? '#22c55e' : '#ef4444';
                    return (
                      <div key={m.muscle} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: MUSCLE_COLORS[m.muscle] || ACCENT, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                        <span style={{ color: '#fff', opacity: 0.65, fontVariantNumeric: 'tabular-nums', minWidth: 46, textAlign: 'right' }}>{m.sets.previous} → {m.sets.current}</span>
                        <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 58, textAlign: 'right' }}>
                          {`${m.sets.delta > 0 ? '+' : ''}${m.sets.delta} подх.`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {(() => {
            const rows = comparison.patterns.filter(p => p.sets.delta !== 0).slice(0, compact ? 3 : 5);
            if (rows.length === 0) return null;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: '#fff', opacity: 0.8, marginBottom: 3 }}>Подходы по движениям</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {rows.map(p => {
                    const color = p.sets.delta > 0 ? '#22c55e' : '#ef4444';
                    return (
                      <div key={p.pattern} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                        <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                        <span style={{ color: '#fff', opacity: 0.65, fontVariantNumeric: 'tabular-nums', minWidth: 46, textAlign: 'right' }}>{p.sets.previous} → {p.sets.current}</span>
                        <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 58, textAlign: 'right' }}>
                          {`${p.sets.delta > 0 ? '+' : ''}${p.sets.delta} подх.`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {(() => {
            const rows = comparison.exercises.filter(e => e.e1rm.delta !== 0).slice(0, compact ? 4 : 6);
            if (rows.length === 0) return null;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: '#fff', opacity: 0.8, marginBottom: 3 }}>Лучший e1RM по упражнениям, кг</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {rows.map(e => {
                    const color = e.e1rm.delta > 0 ? '#22c55e' : '#ef4444';
                    return (
                      <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                        <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                        <span style={{ color: '#fff', opacity: 0.65, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
                          {e.e1rm.previous > 0 ? `${e.e1rm.previous} → ${e.e1rm.current}` : `новое · ${e.e1rm.current}`}
                        </span>
                        <span style={{ color: e.e1rm.previous > 0 ? color : '#60a5fa', fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right' }}>
                          {e.e1rm.previous > 0 ? `${e.e1rm.delta > 0 ? '+' : ''}${e.e1rm.delta} кг` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── ОБЪЁМ ── */}
      {has('volume') && summary.muscles.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="🧱" title="Распределение объёма" hint="тоннаж по мышцам, %" />
          <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
            {summary.muscles.map(m => (
              <div key={m.muscle} title={`${m.label}: ${m.sharePct}%`} style={{ width: `${Math.max(1.5, m.sharePct)}%`, background: m.color }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {summary.muscles.map(m => (
              <span key={m.muscle} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#fff' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: m.color }} />
                {m.label} <b style={{ color: m.color }}>{m.sharePct}%</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── МЫШЦЫ ── */}
      {has('muscles') && summary.muscles.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="💪" title="По мышцам" hint={perWeek ? 'подходы · тоннаж · доля · ориентир MEV/MAV/MRV' : 'за сессию · ориентиры MEV/MAV/MRV недельные'} />
          {muscleRows.some(r => r.lm) && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
              {(['below_mev', 'optimal', 'approaching_mrv', 'exceeding_mrv'] as const).map(st => {
                const n = muscleRows.filter(r => r.lm?.status === st).length;
                if (n === 0) return null;
                const color = VOLUME_STATUS_COLOR[st];
                return (
                  <span key={st} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: `${color}14`, border: `1px solid ${color}38`, color }}>
                    <b>{n}</b> {VOLUME_STATUS_LABEL[st]}
                  </span>
                );
              })}
              {problemCount > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyProblems(v => !v)}
                  style={{ marginLeft: 'auto', padding: '2px 9px', borderRadius: 999, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: `1px solid ${onlyProblems ? 'rgba(245,158,11,0.55)' : 'rgba(255,255,255,0.14)'}`, background: onlyProblems ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.04)', color: onlyProblems ? '#f59e0b' : '#fff' }}
                >
                  {onlyProblems ? 'Показать все' : `Только проблемные (${problemCount})`}
                </button>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {shownMuscleRows.map(({ m, lm }) => {
              const adv = volumeAdvice(lm, perWeek);
              return (
              <div key={m.muscle} style={{ position: 'relative', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.025)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(m.tonnageKg / maxMuscleTonnage) * 100}%`, background: m.color, opacity: 0.14 }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                  <span style={{ color: '#fff', fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}>{m.sets} подх.</span>
                  <span style={{ color: '#fff', opacity: 0.75, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{m.setsPerSession}/трен</span>
                  <span style={{ color: m.color, fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 58, textAlign: 'right' }}>{fmtTon(m.tonnageKg)}</span>
                  <span style={{ color: '#fff', opacity: 0.7, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>{m.sharePct}%</span>
                </div>
                {lm && (
                  <div style={{ position: 'relative', marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 8.5, color: '#fff', opacity: 0.8 }}>
                      <span>
                        {perWeek ? (
                          <>
                            ≈ <b style={{ color: VOLUME_STATUS_COLOR[lm.status] }}>{lm.weeklySets}</b> подх/нед
                          </>
                        ) : (
                          <span title="MEV/MAV/MRV — недельные ориентиры. Объём одной сессии сравним с ними, только если мышца тренируется раз в неделю.">
                            <b style={{ color: VOLUME_STATUS_COLOR[lm.status] }}>{lm.weeklySets}</b> подх за сессию
                          </span>
                        )}
                        {' · '}{VOLUME_STATUS_LABEL[lm.status]}
                        {m.weeklyTrendPct != null && m.weeklyTrendPct !== 0 && (
                          <span style={{ marginLeft: 5, color: m.weeklyTrendPct > 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                            {m.weeklyTrendPct > 0 ? '▲' : '▼'} {Math.abs(m.weeklyTrendPct)}%
                          </span>
                        )}
                        {adv && (
                          <span title={adv.hint} style={{ marginLeft: 5, fontWeight: 800, color: VOLUME_STATUS_COLOR[lm.status], whiteSpace: 'nowrap' }}>
                            {adv.chip}
                          </span>
                        )}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ whiteSpace: 'nowrap' }}>MEV {lm.mev} · MAV {lm.mav} · MRV {lm.mrv}</span>
                        {m.weeklySets.length > 1 && (
                          <span title={`Подходы по неделям: ${m.weeklySets.join(' → ')}`} style={{ display: 'inline-flex' }}>
                            <Sparkline values={m.weeklySets} color={VOLUME_STATUS_COLOR[lm.status]} width={44} height={12} />
                          </span>
                        )}
                      </span>
                    </div>
                    <LandmarkBar sets={lm.weeklySets} mev={lm.mev} mav={lm.mav} mrv={lm.mrv} />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── УПРАЖНЕНИЯ ── */}
      {has('exercises') && summary.exercises.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="🏋️" title="По упражнениям" hint={planVsActual && !planVsActual.empty ? 'план → факт · подходы · тоннаж · e1RM' : 'подходы × повторы · тоннаж · лучший вес / e1RM'} />
          {planVsActual && !planVsActual.empty && (() => {
            const donePct = planVsActual.setsPct;
            const tone = donePct == null ? '#fff' : donePct >= 95 ? '#22c55e' : donePct >= 75 ? '#f59e0b' : '#ef4444';
            return (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 9, marginBottom: 6, color: '#fff' }}>
                <span>План: <b>{planVsActual.plannedSets}</b> подх · {fmtTon(planVsActual.plannedTonnageKg)}</span>
                <span>Факт: <b style={{ color: tone }}>{planVsActual.actualSets}</b> подх · {fmtTon(planVsActual.actualTonnageKg)}</span>
                {donePct != null && (
                  <span style={{ color: tone, fontWeight: 800 }}>
                    выполнено {donePct}% по подходам{planVsActual.tonnagePct != null ? ` · ${planVsActual.tonnagePct}% по тоннажу` : ''}
                  </span>
                )}
                {planVsActual.skipped.length > 0 && (
                  <span style={{ color: '#ef4444' }}>пропущено: {planVsActual.skipped.join(', ')}</span>
                )}
                {planVsActual.unplanned.length > 0 && (
                  <span style={{ color: '#a78bfa' }}>не по плану: {planVsActual.unplanned.join(', ')}</span>
                )}
              </div>
            );
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {summary.exercises.map(e => {
              const pvaRow = planVsActual?.rows.find(r => r.key === normalizeExerciseName(e.name));
              return (
              <div key={`${e.name}_${e.muscle}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <span style={{ flex: 1, minWidth: 60, color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                  <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#fff', whiteSpace: 'nowrap' }}>{e.muscleLabel}</span>
                  <span style={{ color: '#60a5fa', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{e.sets}×{e.avgRepsPerSet}</span>
                  <span style={{ color: ACCENT, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtTon(e.tonnageKg)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 9, color: '#fff', opacity: 0.78, flexWrap: 'wrap' }}>
                  <span>Лучший <b style={{ color: '#f59e0b' }}>{e.bestWeight > 0 ? `${e.bestWeight} кг` : '—'}</b> × {e.bestReps}</span>
                  <span>e1RM <b style={{ color: '#fff' }}>{e.bestE1RM || '—'}</b> кг</span>
                  {e.avgIntensityPct != null && (
                    <span title="Средний вес подхода в % от лучшего e1RM упражнения">инт. <b style={{ color: '#fb923c' }}>{e.avgIntensityPct}%</b></span>
                  )}
                  <span>доля <b style={{ color: '#fff' }}>{e.sharePct}%</b></span>
                  {e.avgRIR != null && <span>RIR <b style={{ color: '#fff' }}>{e.avgRIR}</b></span>}
                  {e.sessions > 1 && <span>в {e.sessions} трен.</span>}
                  {e.progressPct != null && (
                    <span style={{ color: e.progressPct > 0 ? '#22c55e' : e.progressPct < 0 ? '#ef4444' : '#fff', opacity: e.progressPct === 0 ? 0.65 : 1, fontWeight: 700 }}>
                      {`${e.progressPct > 0 ? '▲' : e.progressPct < 0 ? '▼' : '→'} ${Math.abs(e.progressPct)}%`}
                    </span>
                  )}
                  <div style={{ flex: 1, minWidth: 60 }}>
                    <Bar pct={(e.tonnageKg / maxExTonnage) * 100} color={MUSCLE_COLORS[e.muscle] || ACCENT} height={3} />
                  </div>
                  <Sparkline values={e.e1rmSeries} color={e.progressPct != null && e.progressPct < 0 ? '#ef4444' : ACCENT} />
                </div>
                {pvaRow && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 9, flexWrap: 'wrap', color: PLAN_ROW_COLOR[pvaRow.status] }}>
                    <span style={{ fontWeight: 800 }}>{PLAN_ROW_LABEL[pvaRow.status]}</span>
                    <span style={{ opacity: 0.92 }}>
                      план {pvaRow.plannedSets} → факт {pvaRow.actualSets}
                      {pvaRow.setsDelta !== 0 && ` (${pvaRow.setsDelta > 0 ? '+' : ''}${pvaRow.setsDelta})`}
                    </span>
                    {pvaRow.plannedTonnageKg > 0 && (
                      <span style={{ opacity: 0.75 }}>тоннаж {fmtTon(pvaRow.plannedTonnageKg)} → {fmtTon(pvaRow.actualTonnageKg)}</span>
                    )}
                    {pvaRow.setsPct != null && pvaRow.status !== 'done' && <span style={{ opacity: 0.75 }}>{pvaRow.setsPct}% плана</span>}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* ── ПОДХОДЫ ── */}
      {has('sets') && (details || []).length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="🧾" title="Все подходы" hint="вес × повторы · RIR/RPE по каждой тренировке" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(details || []).slice(0, compact ? 3 : showAllSets ? undefined : SETS_LIMIT).map(session => (
              <div key={session.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, marginBottom: 3 }}>
                  <span style={{ color: '#fff', fontWeight: 800, whiteSpace: 'nowrap' }}>{fmtDate(session.date)}</span>
                  <span style={{ flex: 1, minWidth: 40, color: '#fff', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.split}</span>
                  <span style={{ color: ACCENT, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtTon(session.tonnageKg)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {session.exercises.map((ex, ei) => (
                    <div key={`${session.id}_${ex.name}_${ei}`} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 9.5, paddingLeft: 4, borderLeft: `2px solid ${MUSCLE_COLORS[ex.muscle] || 'rgba(255,255,255,0.2)'}` }}>
                      <span style={{ minWidth: 74, maxWidth: 110, color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                      <span style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {ex.sets.map((st, si) => (
                          <span
                            key={si}
                            title={st.rir != null ? `RIR ${st.rir}` : st.rpe != null ? `RPE ${st.rpe}` : undefined}
                            style={{ fontSize: 8.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.07)', color: '#fff', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                          >
                            {st.weight > 0 ? `${st.weight}×${st.reps}` : `×${st.reps}`}
                            {st.rir != null && <b style={{ color: st.rir <= 0 ? '#ef4444' : st.rir <= 2 ? '#f59e0b' : '#22c55e' }}> @{st.rir}</b>}
                            {st.rir == null && st.rpe != null && <b style={{ color: '#60a5fa' }}> @{st.rpe}RPE</b>}
                          </span>
                        ))}
                      </span>
                      <span style={{ color: '#f59e0b', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>e1RM {ex.bestE1RM || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {(details || []).length > (compact ? 3 : SETS_LIMIT) && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 9, color: '#fff', opacity: 0.8 }}>
              <span>
                Показаны {compact ? 3 : showAllSets ? details!.length : SETS_LIMIT} из {details?.length} тренировок.
              </span>
              {!compact && (
                <button
                  type="button"
                  onClick={() => setShowAllSets(v => !v)}
                  style={{ marginLeft: 'auto', padding: '2px 9px', borderRadius: 999, fontSize: 9, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}
                >
                  {showAllSets ? 'Свернуть' : `Показать все (${details?.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ДВИЖЕНИЯ ── */}
      {has('movement') && summary.patterns.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="🔀" title="Движения (паттерны)" hint="КПШ · подходы · тоннаж" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {summary.patterns.map(p => (
              <div key={p.pattern} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                <span style={{ color: '#fff', opacity: 0.7, fontVariantNumeric: 'tabular-nums', minWidth: 62, textAlign: 'right' }}>КПШ {p.reps}</span>
                <span style={{ color: '#60a5fa', fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}>{p.sets} подх.</span>
                <span style={{ color: ACCENT, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 62, textAlign: 'right' }}>{fmtTon(p.tonnageKg)}</span>
                <span style={{ color: '#fff', opacity: 0.7, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>{p.sharePct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ТРЕНИРОВКИ ── */}
      {has('sessions') && summary.sessions.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="📅" title={summary.workouts > 1 ? 'По тренировкам' : 'Тренировка'} hint="подходы · повторы · тоннаж · плотность" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {summary.sessions.slice().reverse().map(s => (
              <div key={s.id} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <span style={{ color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</span>
                  <span style={{ flex: 1, minWidth: 50, color: '#fff', opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.split}</span>
                  <span style={{ color: ACCENT, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtTon(s.tonnageKg)}</span>
                  {s.prs > 0 && <span title="Рекорды" style={{ color: '#f59e0b' }}>🏆{s.prs}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 9, color: '#fff', opacity: 0.72, flexWrap: 'wrap' }}>
                  <span>{s.sets} подх.</span>
                  <span>{s.reps} повт.</span>
                  <span>{s.exercises} упр.</span>
                  {s.durationMin > 0 && <span>{s.durationMin} мин</span>}
                  {s.density > 0 && <span style={{ color: '#22d3ee', opacity: 1 }}>{fmtInt(s.density)} кг/мин</span>}
                </div>
              </div>
            ))}
          </div>
          {summary.weeks.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: '#fff', opacity: 0.8, marginBottom: 4 }}>Тоннаж по неделям</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
                {summary.weeks.slice(-10).map((w, i) => (
                  <div key={`${w.label}_${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${w.label}: ${fmtTon(w.tonnageKg)} · ${w.sessions} трен. · ${w.reps} повт.`}>
                    <div style={{ width: '100%', height: Math.max(3, (w.tonnageKg / maxWeekTonnage) * 32), background: 'linear-gradient(180deg, rgba(0,230,138,0.9), rgba(0,230,138,0.35))', borderRadius: 3 }} />
                    <span style={{ fontSize: 7, color: '#fff', opacity: 0.65, whiteSpace: 'nowrap' }}>{w.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── РЕКОРДЫ ── */}
      {has('prs') && summary.prs.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon="🏆" title="Рекорды периода" hint="рост расчётного 1RM" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {summary.prs.map((p, i) => (
              <div key={`${p.exercise}_${p.date}_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.exercise}</span>
                <span style={{ color: '#fff', opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>{p.weight}кг×{p.reps}</span>
                <span style={{ color: '#f59e0b', fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>e1RM {p.e1rm}</span>
                {p.deltaPct != null && <span style={{ color: ACCENT, minWidth: 44, textAlign: 'right' }}>+{p.deltaPct}%</span>}
                <span style={{ color: '#fff', opacity: 0.6, minWidth: 58, textAlign: 'right' }}>{fmtDate(p.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

/* ─── Полный отчёт с выбором блоков ─── */
export const WorkoutSummaryReport: React.FC<{
  workouts: WorkoutLog[];
  title?: string;
  subtitle?: string;
  blocks?: ReportBlockId[];
  onBlocksChange?: (next: ReportBlockId[]) => void;
  storageKey?: string;
  defaultBlocks?: ReportBlockId[];
  compact?: boolean;
  showSelector?: boolean;
  /** Уровень спортсмена — для ориентиров MEV/MAV/MRV. */
  level?: string;
  /** Тренировки предыдущего равного периода — для блока «Сравнение». */
  previousWorkouts?: WorkoutLog[];
  /** Как назвать предыдущий период: «прошлой неделей», «прошлым месяцем». */
  previousLabel?: string;
  /** История до периода — база для рекордов (чтобы одиночная тренировка знала прошлые e1RM). */
  baselineWorkouts?: WorkoutLog[];
  /** План этих тренировок (targetSets из плеера) — для строк «план → факт». */
  plan?: PlannedExerciseInput[] | null;
}> = ({ workouts, title, subtitle, blocks, onBlocksChange, storageKey, defaultBlocks, compact, showSelector = true, level, previousWorkouts, previousLabel, baselineWorkouts, plan }) => {
  const [localBlocks, setLocalBlocks] = React.useState<ReportBlockId[]>(() => readBlocks(storageKey, defaultBlocks));
  const selected = blocks ?? localBlocks;
  const setSelected = (next: ReportBlockId[]) => {
    if (blocks == null) setLocalBlocks(next);
    onBlocksChange?.(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };
  const summary = React.useMemo(() => buildWorkoutSummary(workouts, baselineWorkouts), [workouts, baselineWorkouts]);
  const details = React.useMemo(
    () => (selected.includes('sets') ? buildSetDetails(workouts) : []),
    [workouts, selected],
  );
  // Сравнение считаем всегда, когда есть прошлый период: от него зависит не
  // только блок «Сравнение», но и вывод про разгрузку в «Выводах».
  const comparison = React.useMemo(
    () => {
      const list = (Array.isArray(previousWorkouts) ? previousWorkouts : []).filter(Boolean);
      if (list.length === 0) return null;
      return compareWorkoutSummaries(summary, buildWorkoutSummary(list));
    },
    [summary, previousWorkouts],
  );

  return (
    <div className="workout-summary-report" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(96,165,250,0.08))', border: '1px solid rgba(0,230,138,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{title || 'Сводный отчёт по тренировке'}</div>
            <div style={{ fontSize: 10, color: '#fff', opacity: 0.9, marginTop: 2 }}>
              {subtitle || formatSummaryPeriod(summary)}
              {summary.workouts > 0 && <> · {summary.workouts} трен. · {fmtTon(summary.totals.tonnageKg)} · {fmtInt(summary.totals.sets)} подходов</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {level && (
              <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
                {LEVEL_RU[level] || level}
              </span>
            )}
            <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
              {summary.totals.uniqueExercises} упр.
            </span>
            <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
              🏆 {summary.totals.prs}
            </span>
          </div>
        </div>
        {showSelector && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <ReportBlockPicker value={selected} onChange={setSelected} compact={compact} />
          </div>
        )}
      </div>
      <WorkoutSummaryBody summary={summary} blocks={selected} compact={compact} level={level} details={details} comparison={comparison} previousLabel={previousLabel} plan={plan} />
    </div>
  );
};

export default WorkoutSummaryReport;
