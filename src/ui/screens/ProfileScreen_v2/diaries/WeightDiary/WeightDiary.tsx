import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import { AddBodyMeasurementsModal } from '../../diary-modals';
import { getWeightLog, saveWeightLog, type WeightEntry } from '../../../../../engines/profile-store';
import { strengthDiary } from '../../../../../engines/strength-diary.engine';
import { generateInsights, type DiarySession, type DiarySet } from '../../../../../engines/diary-insights.engine';
import {
  buildWeeklyHistogram,
  compareWithLastWeek,
  computeDistribution,
  computeExtremes,
  computeStreak,
  crossCorrelation,
  detectAnomalies,
  exportSvgAsFile,
  exportSvgAsPng,
  filterByRange,
  laggedCorrelation,
  paginate,
  sortEntries,
  todayIso,
  type DiaryEntryLike,
  type SortState,
} from '../../diary-helpers';
import type { DiaryWindowProps } from '../../DiaryWindow';

const button: React.CSSProperties = {
  minHeight: 38,
  padding: '7px 10px',
  borderRadius: 7,
  background: '#27272a',
  border: '1px solid #3f3f46',
  color: '#fff',
  cursor: 'pointer',
};
const input: React.CSSProperties = { ...button, boxSizing: 'border-box', background: '#09090b', width: '100%' };
const FIELDS = [
  'weight',
  'waistCm',
  'chestCm',
  'hipCm',
  'bicepCm',
  'thighCm',
  'neckCm',
  'forearmCm',
  'bodyFat',
  'muscleMass',
  'waterMass',
] as const;
type Field = (typeof FIELDS)[number];
const LABELS: Record<Field, string> = {
  weight: 'Вес',
  waistCm: 'Талия',
  chestCm: 'Грудь',
  hipCm: 'Бёдра',
  bicepCm: 'Бицепс',
  thighCm: 'Бедро',
  neckCm: 'Шея',
  forearmCm: 'Предплечье',
  bodyFat: '% жира',
  muscleMass: 'Мышечная масса',
  waterMass: 'Вода',
};
const UNIT: Record<Field, string> = {
  weight: 'кг',
  waistCm: 'см',
  chestCm: 'см',
  hipCm: 'см',
  bicepCm: 'см',
  thighCm: 'см',
  neckCm: 'см',
  forearmCm: 'см',
  bodyFat: '%',
  muscleMass: 'кг',
  waterMass: '%',
};
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x] || x,
  );

interface TrainingState {
  volume: number;
  progress: Awaited<ReturnType<typeof strengthDiary.getWeeklyProgress>>;
  alerts: string[];
  insights: string[];
  volumePoints: { date: string; value: number }[];
}

const loadTraining = async (): Promise<TrainingState> => {
  const logs = await strengthDiary.getWorkoutLogs();
  const sessions: DiarySession[] = logs.map((log) => ({
    sessionId: log.id,
    date: log.date,
    focus: log.split || 'training',
    durationMin: log.duration || 0,
    completed: true,
    terminatedEarly: false,
    sessionVolume: (log.exercises || []).reduce((s, e) => s + (e.totalVolume || 0), 0),
    sessionIntensity: log.overallRPE || 0,
    overallRPE: log.overallRPE || 5,
    notes: log.notes || '',
  }));
  const sets: DiarySet[] = logs.flatMap((log) =>
    (log.exercises || []).flatMap((ex) =>
      (ex.sets || []).map((set, index) => ({
        setId: `${log.id}-${ex.id}-${index}`,
        sessionId: log.id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        setIndex: index + 1,
        targetReps: set.reps,
        targetWeight: set.weight,
        actualReps: set.reps,
        actualWeight: set.weight,
        actualRPE: set.rpe || 5,
        actualRIR: set.rir || 0,
        errors: [],
        restSeconds: 0,
        terminatedEarly: false,
      })),
    ),
  );
  const [progress, alerts] = await Promise.all([
    strengthDiary.getWeeklyProgress(),
    strengthDiary.checkProgressionAlerts(),
  ]);
  return {
    volume: progress.at(-1)?.totalVolume || 0,
    progress,
    alerts: alerts.map((x) => x.message),
    insights: generateInsights(sets, sessions).map((x) => x.message),
    volumePoints: logs.map((x) => ({
      date: x.date,
      value: (x.exercises || []).reduce((s, e) => s + (e.totalVolume || 0), 0),
    })),
  };
};

const pointsFor = (rows: WeightEntry[], field: Field): { date: string; value: number }[] =>
  rows.map((r) => ({ date: r.date, value: Number(r[field]) })).filter((x) => Number.isFinite(x.value));

const Chart: React.FC<{
  points: { date: string; value: number }[];
  color: string;
  target?: number;
  onSvg: (x: SVGSVGElement) => void;
  onPng: (x: SVGSVGElement) => void;
}> = ({ points, color, target, onSvg, onPng }) => {
  const ref = useRef<SVGSVGElement>(null);
  if (!points.length)
    return <div style={{ padding: 20, color: colors.textMuted }}>Недостаточно данных для графика.</div>;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((x) => x.value);
  const min = Math.min(...values, target ?? Infinity);
  const max = Math.max(...values, target ?? -Infinity);
  const pad = Math.max((max - min) * 0.12, 1);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => 42 + (i * 540) / Math.max(1, sorted.length - 1);
  const y = (v: number) => 170 - ((v - lo) / (hi - lo)) * 140;
  const path = sorted.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button style={button} onClick={() => ref.current && onSvg(ref.current)}>
          SVG
        </button>
        <button style={button} onClick={() => ref.current && onPng(ref.current)}>
          PNG
        </button>
      </div>
      <svg ref={ref} viewBox="0 0 600 200" width="100%" role="img" aria-label="График веса и замеров">
        <line x1="42" y1="170" x2="582" y2="170" stroke="#555" />
        <line x1="42" y1="30" x2="42" y2="170" stroke="#555" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="42" y1={30 + i * 35} x2="582" y2={30 + i * 35} stroke="#ffffff12" />
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="3" />
        {sorted.map((p, i) => (
          <circle key={`${p.date}-${i}`} cx={x(i)} cy={y(p.value)} r="3" fill={color} />
        ))}
        {target !== undefined && (
          <>
            <line x1="42" y1={y(target)} x2="582" y2={y(target)} stroke="#22c55e" strokeDasharray="5 4" />
            <text x="578" y={y(target) - 4} textAnchor="end" fill="#22c55e" fontSize="10">
              цель {target}
            </text>
          </>
        )}
        <text x="42" y="194" fill="#aaa" fontSize="10">
          {sorted[0].date}
        </text>
        <text x="582" y="194" textAnchor="end" fill="#aaa" fontSize="10">
          {sorted.at(-1)?.date}
        </text>
      </svg>
    </div>
  );
};

export const WeightDiary: React.FC<DiaryWindowProps> = ({ open, onClose, goals, onDataChange }) => {
  const [rows, setRows] = useState<WeightEntry[]>([]);
  const [modal, setModal] = useState(false);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<WeightEntry>>({});
  const [undo, setUndo] = useState<WeightEntry[] | null>(null);
  const [training, setTraining] = useState<TrainingState | null>(null);
  const [goal, setGoal] = useState(goals?.weightKg || 0);
  const [chartField, setChartField] = useState<Field>('weight');
  const svgName = `weight-${todayIso()}`;
  useEffect(() => {
    if (!open) return;
    setRows(getWeightLog());
    try {
      const stored = Number(JSON.parse(localStorage.getItem('he_diary_goals') || '{}').weightKg);
      setGoal(Number.isFinite(stored) && stored > 0 ? stored : goals?.weightKg || 0);
    } catch {
      setGoal(goals?.weightKg || 0);
    }
  }, [open, goals?.weightKg]);
  useEffect(() => {
    if (goal > 0) {
      try {
        const current = JSON.parse(localStorage.getItem('he_diary_goals') || '{}');
        localStorage.setItem('he_diary_goals', JSON.stringify({ ...current, weightKg: goal }));
      } catch {
        /* storage is optional */
      }
    }
  }, [goal]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadTraining()
      .then((x) => !cancelled && setTraining(x))
      .catch(() => !cancelled && setTraining(null));
    return () => {
      cancelled = true;
    };
  }, [open]);
  const commit = (next: WeightEntry[], remember = true) => {
    const ordered = [...next].sort((a, b) => b.date.localeCompare(a.date));
    if (remember) setUndo(rows);
    saveWeightLog(ordered);
    setRows(ordered);
    onDataChange?.();
  };
  const entries = useMemo<DiaryEntryLike[]>(
    () =>
      rows.map((r) => ({
        date: r.date,
        fields: FIELDS.filter((f) => r[f] !== undefined)
          .map((f) => ({ label: LABELS[f], value: String(r[f]), unit: UNIT[f] }))
          .concat(r.notes ? [{ label: 'Заметка', value: r.notes, unit: '' }] : []),
      })),
    [rows],
  );
  const filtered = useMemo(() => {
    let v = filterByRange(entries, range);
    const q = query.trim().toLowerCase();
    if (q)
      v = v.filter(
        (e) => e.date.includes(q) || e.fields.some((f) => `${f.label} ${f.value}`.toLowerCase().includes(q)),
      );
    return sortEntries(v, sort);
  }, [entries, range, query, sort]);
  const pageData = paginate(filtered, page, 8);
  const chartPoints = pointsFor(rows, chartField);
  const weightPoints = pointsFor(rows, 'weight');
  const distribution = computeDistribution(weightPoints.map((x) => x.value));
  const extremes = computeExtremes('weight', entries);
  const weekly = buildWeeklyHistogram(weightPoints);
  const comparison = compareWithLastWeek(weightPoints);
  const anomalies = detectAnomalies('weight', entries);
  const streak = computeStreak(entries);
  const body = useMemo(() => {
    const latest = rows[0];
    const first = rows.at(-1);
    if (!latest) return null;
    return {
      latest,
      weightDelta: first ? latest.weight - first.weight : 0,
      fatDelta: latest.bodyFat !== undefined && first?.bodyFat !== undefined ? latest.bodyFat - first.bodyFat : null,
      leanDelta:
        latest.muscleMass !== undefined && first?.muscleMass !== undefined
          ? latest.muscleMass - first.muscleMass
          : null,
      waistDelta: latest.waistCm !== undefined && first?.waistCm !== undefined ? latest.waistCm - first.waistCm : null,
    };
  }, [rows]);
  const bodyCorrelations = useMemo(
    () =>
      FIELDS.filter((field): field is Exclude<Field, 'weight'> => field !== 'weight')
        .map((field) => {
          const result = crossCorrelation(weightPoints, pointsFor(rows, field));
          return result ? { field, ...result } : null;
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
        .slice(0, 4),
    [rows, weightPoints],
  );
  const trainingCorrelation = useMemo(
    () => (training && weightPoints.length >= 3 ? crossCorrelation(weightPoints, training.volumePoints) : null),
    [training, weightPoints],
  );
  const doExportCsv = () => {
    const cols = ['date', ...FIELDS, 'notes'];
    const csv =
      '\ufeff' +
      [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify((r as any)[c] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${svgName}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const doPrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>Вес и замеры</title><style>body{font:12px sans-serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px}</style></head><body><h1>Вес и замеры</h1><table><tr>${['Дата', ...FIELDS.map((f) => LABELS[f]), 'Заметка'].map((x) => `<th>${esc(x)}</th>`).join('')}</tr>${rows.map((r) => `<tr><td>${esc(r.date)}</td>${FIELDS.map((f) => `<td>${esc(r[f])}</td>`).join('')}<td>${esc(r.notes)}</td></tr>`).join('')}</table></body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 100);
  };
  const beginEdit = (row: WeightEntry) => {
    setEditing(row.date);
    setDraft({ ...row });
  };
  const saveEdit = () => {
    if (!editing || !draft.weight || !Number.isFinite(Number(draft.weight))) return;
    commit(
      rows.map((r) => (r.date === editing ? ({ ...r, ...draft, weight: Number(draft.weight) } as WeightEntry) : r)),
    );
    setEditing(null);
  };
  const fieldCell = (row: WeightEntry, field: Field) =>
    editing === row.date ? (
      <input
        style={{ ...input, minWidth: 70, padding: 5 }}
        type="number"
        step="0.1"
        value={draft[field] ?? ''}
        onChange={(e) => setDraft({ ...draft, [field]: e.target.value === '' ? undefined : Number(e.target.value) })}
      />
    ) : (
      (row[field] ?? '—')
    );
  const correlation =
    trainingCorrelation ||
    (training && weightPoints.length >= 3 ? laggedCorrelation(weightPoints, training.volumePoints, 1) : null);
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, height: '100dvh', maxHeight: '100dvh', background: '#09090b', color: colors.text, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 3,
          display: 'flex',
          gap: 7,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: 12,
          background: '#18181b',
          borderBottom: '1px solid #3f3f46',
        }}
      >
        <button style={button} onClick={onClose}>
          ← Дневники
        </button>
        <b style={{ fontSize: 16 }}>⚖️ Вес и все замеры</b>
        <button style={button} onClick={() => setModal(true)}>
          + Добавить
        </button>
        <button style={button} onClick={() => setModal(true)}>
          ⚡ Сегодня
        </button>
        <button style={button} onClick={doExportCsv}>
          CSV
        </button>
        <button style={button} onClick={doPrint}>
          PDF / Печать
        </button>
        {undo && (
          <button
            style={button}
            onClick={() => {
              commit(undo, false);
              setUndo(null);
            }}
          >
            ↩ Отменить
          </button>
        )}
        <button
          style={{ ...button, color: '#f87171' }}
          onClick={() => {
            if (rows.length && confirm('Очистить весь дневник?')) commit([]);
          }}
        >
          Очистить
        </button>
      </header>
      <main style={{ maxWidth: 1200, margin: 'auto', padding: 16 }}>
        <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', '7', '30', '90'] as const).map((r) => (
            <button
              key={r}
              style={{ ...button, background: range === r ? '#166534' : button.background }}
              onClick={() => {
                setRange(r);
                setPage(1);
              }}
            >
              {r === 'all' ? 'Всё время' : `${r} дней`}
            </button>
          ))}
          <input
            style={{ ...input, width: 220 }}
            placeholder="Поиск по дате и полям"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <label>
            Цель, кг{' '}
            <input
              style={{ ...input, width: 90, display: 'inline-block', marginLeft: 4 }}
              type="number"
              step="0.1"
              value={goal || ''}
              onChange={(e) => setGoal(Number(e.target.value) || 0)}
            />
          </label>
        </section>
        {body && (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))',
              gap: 8,
              margin: '14px 0',
            }}
          >
            {[
              ['Текущий вес', `${body.latest.weight} кг`],
              ['Δ веса', `${body.weightDelta > 0 ? '+' : ''}${body.weightDelta.toFixed(1)} кг`],
              ['% жира', body.latest.bodyFat === undefined ? '—' : `${body.latest.bodyFat}%`],
              ['Δ жира', body.fatDelta === null ? '—' : `${body.fatDelta > 0 ? '+' : ''}${body.fatDelta.toFixed(1)}%`],
              ['Мышцы', body.latest.muscleMass === undefined ? '—' : `${body.latest.muscleMass} кг`],
              [
                'Δ талии',
                body.waistDelta === null ? '—' : `${body.waistDelta > 0 ? '+' : ''}${body.waistDelta.toFixed(1)} см`,
              ],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                style={{ padding: 12, borderRadius: 9, background: '#22c55e18', border: '1px solid #22c55e44' }}
              >
                <small>{k}</small>
                <strong style={{ display: 'block', marginTop: 4 }}>{v}</strong>
              </div>
            ))}
          </section>
        )}
        <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            ['Среднее', distribution?.mean.toFixed(1) || '—'],
            ['Медиана', distribution?.median.toFixed(1) || '—'],
            ['Мин/макс', extremes.min && extremes.max ? `${extremes.min.value}/${extremes.max.value}` : '—'],
            ['Дней', streak.totalDays],
            ['Серия', streak.current],
            ['Δ нед.', comparison.delta?.toFixed(1) || '—'],
            ['Аномалии', anomalies.length],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ padding: 10, background: '#27272a', borderRadius: 8 }}>
              <small>{k}</small>
              <b style={{ display: 'block' }}>{v}</b>
            </div>
          ))}
        </section>
        <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <b>📈 График</b>
            <select
              style={{ ...input, width: 180 }}
              value={chartField}
              onChange={(e) => setChartField(e.target.value as Field)}
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <Chart
            points={chartPoints}
            color="#22c55e"
            target={chartField === 'weight' && goal > 0 ? goal : undefined}
            onSvg={(x) => exportSvgAsFile(x, `${svgName}.svg`)}
            onPng={(x) => exportSvgAsPng(x, `${svgName}.png`)}
          />
        </section>
        {weekly.length > 0 && (
          <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
            <b>📊 Среднее по неделям</b>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120, marginTop: 8 }}>
              {weekly.map((w) => {
                const max = Math.max(...weekly.map((x) => x.mean));
                const h = Math.max(12, (w.mean / Math.max(max, 1)) * 85);
                return (
                  <div
                    key={w.weekStart}
                    title={`${w.weekStart}: ${w.mean.toFixed(1)} кг, ${w.count} записей`}
                    style={{ flex: 1, textAlign: 'center', minWidth: 25 }}
                  >
                    <small>{w.mean.toFixed(1)}</small>
                    <div style={{ height: h, background: '#22c55e99', borderRadius: '4px 4px 0 0' }} />
                    <small>{w.weekStart.slice(5)}</small>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {comparison.thisWeek && comparison.lastWeek && (
          <section style={{ padding: 12, background: '#3b82f622', borderRadius: 10, marginBottom: 12 }}>
            📆 Эта неделя: <b>{comparison.thisWeek.mean.toFixed(1)} кг</b> · прошлая:{' '}
            <b>{comparison.lastWeek.mean.toFixed(1)} кг</b> · Δ <b>{comparison.delta?.toFixed(1)} кг</b>
          </section>
        )}
        {bodyCorrelations.length > 0 && (
          <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
            <b>🔗 Связь веса с замерами</b>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {bodyCorrelations.map((item) => (
                <span
                  key={item.field}
                  style={{ padding: '6px 8px', borderRadius: 7, background: item.r >= 0 ? '#22c55e22' : '#ef444422' }}
                >
                  {LABELS[item.field]}: {item.r > 0 ? '+' : ''}
                  {item.r.toFixed(2)} · n={item.n}
                </span>
              ))}
            </div>
          </section>
        )}
        {anomalies.length > 0 && (
          <section style={{ padding: 12, background: '#f59e0b18', borderRadius: 10, marginBottom: 12 }}>
            <b>⚠ Аномалии</b>
            {anomalies.slice(-5).map((a, i) => (
              <div key={`${a.date}-${i}`}>
                {a.date}: {a.message}
              </div>
            ))}
          </section>
        )}
        {training && (
          <section style={{ padding: 12, background: '#3b82f622', borderRadius: 10, marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>🏋️ Сила и инсайты</h3>
            <div>
              Последний объём: <b>{Math.round(training.volume)}</b>
              {correlation && (
                <span>
                  {' '}
                  · связь вес/объём: <b>{correlation.r.toFixed(2)}</b> ({correlation.n} пар)
                </span>
              )}
            </div>
            {training.progress.slice(-4).map((x) => (
              <div key={x.week}>
                Неделя {x.week}: объём {Math.round(x.totalVolume)}, тренировок {x.workoutCount}, 1RM{' '}
                {Math.round(x.total1RM)}
              </div>
            ))}
            {[...training.alerts, ...training.insights].map((x, i) => (
              <div key={i} style={{ color: '#fbbf24' }}>
                • {x}
              </div>
            ))}
          </section>
        )}
        <section style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Дата</th>
                {FIELDS.map((f) => (
                  <th key={f}>
                    <button
                      style={{ ...button, padding: 4 }}
                      onClick={() =>
                        setSort({ key: LABELS[f], dir: sort.key === LABELS[f] && sort.dir === 'asc' ? 'desc' : 'asc' })
                      }
                    >
                      {LABELS[f]}
                    </button>
                  </th>
                ))}
                <th>Заметка</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pageData.pageItems.map((e) => {
                const row = rows.find((r) => r.date === e.date);
                if (!row) return null;
                return (
                  <tr key={row.date}>
                    <td>
                      {editing === row.date ? (
                        <input
                          style={input}
                          type="date"
                          value={String(draft.date || row.date)}
                          onChange={(x) => setDraft({ ...draft, date: x.target.value })}
                        />
                      ) : (
                        row.date
                      )}
                    </td>
                    {FIELDS.map((f) => (
                      <td key={f}>{fieldCell(row, f)}</td>
                    ))}
                    <td>
                      {editing === row.date ? (
                        <input
                          style={input}
                          value={draft.notes || ''}
                          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        />
                      ) : (
                        row.notes || '—'
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {editing === row.date ? (
                        <>
                          <button style={button} onClick={saveEdit}>
                            Сохранить
                          </button>{' '}
                          <button style={button} onClick={() => setEditing(null)}>
                            Отмена
                          </button>
                        </>
                      ) : (
                        <>
                          <button style={button} onClick={() => beginEdit(row)}>
                            Изменить
                          </button>{' '}
                          <button style={button} onClick={() => commit(rows.filter((r) => r.date !== row.date))}>
                            Удалить
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          Записей: {pageData.total}
          <span>
            <button style={button} onClick={() => setPage(Math.max(1, page - 1))}>
              ←
            </button>{' '}
            {page}/{pageData.totalPages}{' '}
            <button style={button} onClick={() => setPage(Math.min(pageData.totalPages, page + 1))}>
              →
            </button>
          </span>
        </div>
        <h3>Последние записи</h3>
        {rows.slice(0, 3).map((r) => (
          <div key={r.date} style={{ padding: 8, borderBottom: '1px solid #27272a' }}>
            {r.date}: {r.weight} кг{r.bodyFat !== undefined ? ` · ${r.bodyFat}% жира` : ''}
            {r.waistCm !== undefined ? ` · талия ${r.waistCm} см` : ''}
          </div>
        ))}
      </main>
      <AddBodyMeasurementsModal
        open={modal}
        onClose={() => setModal(false)}
        onSave={(x) => commit([x as WeightEntry, ...rows.filter((r) => r.date !== x.date)])}
      />
    </div>
  );
};
