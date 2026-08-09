import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import { AddBodyMeasurementsModal } from '../../diary-modals';
import { getWeightLog, saveWeightLog, type WeightEntry } from '../../../../../engines/profile-store';
import { strengthDiary } from '../../../../../engines/strength-diary.engine';
import { generateInsights, type DiarySession, type DiarySet } from '../../../../../engines/diary-insights.engine';
import { projectWeight, calcFFMI } from '../../../../../engines/body-composition.engine';
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
import { WeightDiaryVisuals } from './WeightDiary.visuals';
import { OverlayChart, ChartLegend, FIELD_COLORS, FIELD_LABELS, PERCENT_FIELDS, type OverlayChartProps } from './WeightChart';
import { AnimatedCounter } from '@/ui/components/AnimatedCounter';

const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes countUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .wd-card { animation: fadeIn 0.35s ease; transition: transform 0.2s, box-shadow 0.2s; }
  .wd-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .wd-row { animation: fadeIn 0.3s ease; transition: background 0.15s; }
  .wd-row:hover { background: '#27272a' !important; }
  .wd-badge { animation: slideIn 0.25s ease; }
  .wd-stat-value { animation: countUp 0.4s ease; }
  .wd-btn { transition: background 0.2s, transform 0.15s; }
  .wd-btn:hover { transform: scale(1.02); }
  .wd-btn:active { transform: scale(0.98); }
  @media (max-width: 480px) {
    .wd-chart-wrap svg { min-height: 180px; }
    .wd-table-wrap { overflow-x: auto; }
  }
`;
if (typeof document !== 'undefined') document.head.appendChild(style);

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
  'bicepLeftCm',
  'bicepRightCm',
  'thighCm',
  'thighLeftCm',
  'thighRightCm',
  'calfCm',
  'calfLeftCm',
  'calfRightCm',
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
  bicepLeftCm: 'Бицепс L',
  bicepRightCm: 'Бицепс R',
  thighCm: 'Бедро',
  thighLeftCm: 'Бедро L',
  thighRightCm: 'Бедро R',
  calfCm: 'Икры',
  calfLeftCm: 'Икра L',
  calfRightCm: 'Икра R',
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
  bicepLeftCm: 'см',
  bicepRightCm: 'см',
  thighCm: 'см',
  thighLeftCm: 'см',
  thighRightCm: 'см',
  calfCm: 'см',
  calfLeftCm: 'см',
  calfRightCm: 'см',
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
  const [viewPhoto, setViewPhoto] = useState<{ src: string; date: string } | null>(null);
  const [training, setTraining] = useState<TrainingState | null>(null);
  const [goal, setGoal] = useState(goals?.weightKg || 0);
  const [activeChartFields, setActiveChartFields] = useState<Field[]>(['weight', 'bodyFat', 'muscleMass']);
  const [profileHeight, setProfileHeight] = useState<number | undefined>();
  const [profileSex, setProfileSex] = useState<'male' | 'female' | undefined>();
  const svgName = `weight-${todayIso()}`;
  const toggleChartField = (f: Field) =>
    setActiveChartFields(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  useEffect(() => {
    if (!open) return;
    setRows(getWeightLog());
    try {
      const stored = Number(JSON.parse(localStorage.getItem('he_diary_goals') || '{}').weightKg);
      setGoal(Number.isFinite(stored) && stored > 0 ? stored : goals?.weightKg || 0);
    } catch {
      setGoal(goals?.weightKg || 0);
    }
    try {
      const raw = localStorage.getItem('he_training_profile');
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile.bodyHeightCm) setProfileHeight(Number(profile.bodyHeightCm));
        if (profile.sex) setProfileSex(profile.sex);
      }
    } catch {
      /* ignore */
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
  const chartSeries = useMemo<OverlayChartProps['series']>(() => {
    if (activeChartFields.length === 0) return [];
    const series: OverlayChartProps['series'] = activeChartFields.map(f => ({
      field: f,
      points: pointsFor(rows, f),
      color: FIELD_COLORS[f] || '#888',
      useRightAxis: PERCENT_FIELDS.has(f),
    }));
    if (profileHeight && rows.some(r => r.bodyFat !== undefined)) {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      const ffmiPoints = sorted
        .filter(r => r.bodyFat !== undefined && Number.isFinite(r.bodyFat))
        .map(r => {
          const bf = r.bodyFat as number;
          const ffmi = calcFFMI(r.weight, profileHeight, bf);
          return { date: r.date, value: ffmi };
        });
      if (ffmiPoints.length > 0) {
        series.push({
          field: 'ffmi',
          points: ffmiPoints,
          color: '#a78bfa',
          useRightAxis: true,
        });
      }
    }
    return series;
  }, [rows, activeChartFields, profileHeight]);
  const chartProjection = useMemo(() => {
    if (goal <= 0 || rows.length < 3) return [] as OverlayChartProps['projections'];
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    const daysDiff = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
    if (daysDiff <= 0) return [];
    const weeklyRate = ((last.weight - first.weight) / daysDiff) * 7;
    const proj = projectWeight(last.weight, weeklyRate, goal, 12);
    return proj.map(p => ({ date: p.date, value: p.weight }));
  }, [rows, goal]);
  const chartNotes = useMemo(() => rows.filter(r => r.notes).map(r => ({ date: r.date, text: r.notes! })), [rows]);
  const rightAxis = useMemo(() => {
    const rightFields = activeChartFields.filter(f => PERCENT_FIELDS.has(f));
    const rightValues: number[] = [];
    rightFields.forEach(f => {
      const pts = pointsFor(rows, f);
      rightValues.push(...pts.map(p => p.value));
    });
    if (profileHeight && rows.some(r => r.bodyFat !== undefined)) {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      sorted.filter(r => r.bodyFat !== undefined && Number.isFinite(r.bodyFat)).forEach(r => {
        rightValues.push(calcFFMI(r.weight, profileHeight, r.bodyFat as number));
      });
    }
    if (rightValues.length === 0) return undefined;
    const min = Math.min(...rightValues);
    const max = Math.max(...rightValues);
    return { min, max, label: '% / FFMI', ticks: 5 };
  }, [rows, activeChartFields, profileHeight]);
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

  const interpretWeight = (delta: number, goal: number): string => {
    if (goal > 0 && Math.abs(delta) <= 1) return 'На цели';
    if (delta > 1.5) return 'Рост веса';
    if (delta > 0.5) return 'Небольшой рост';
    if (delta < -1.5) return 'Снижение веса';
    if (delta < -0.5) return 'Небольшое снижение';
    return 'Стабильно';
  };

  const interpretFat = (delta: number | null): string => {
    if (delta === null) return '';
    if (delta < -1) return 'Жир снижается — отлично';
    if (delta < -0.3) return 'Жир немного снизился';
    if (delta > 1) return 'Жир растёт';
    if (delta > 0.3) return 'Жир немного вырос';
    return 'Жир стабилен';
  };

  const interpretMuscle = (delta: number | null): string => {
    if (delta === null) return '';
    if (delta > 0.8) return 'Мышечный рост';
    if (delta > 0.2) return 'Небольшой рост мышц';
    if (delta < -0.8) return 'Потеря мышц — внимательно';
    if (delta < -0.2) return 'Небольшая потеря мышц';
    return 'Мышцы стабильны';
  };

  const interpretWaist = (delta: number | null): string => {
    if (delta === null) return '';
    if (delta < -1) return 'Талия уменьшилась — хорошая рекомпозиция';
    if (delta < -0.3) return 'Талия немного уменьшилась';
    if (delta > 1) return 'Талия увеличилась';
    if (delta > 0.3) return 'Талия немного выросла';
    return 'Талия стабильна';
  };
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
  const badgeFor = (field: Field, value: number | undefined, row: WeightEntry): React.ReactNode => {
    if (value === undefined || value === null || !Number.isFinite(value)) return null;
    const sex = profileSex;
    const isMale = sex === 'male';
    switch (field) {
      case 'bodyFat': {
        if (isMale) {
          if (value < 10) return <span style={badge('blue')}>Low</span>;
          if (value <= 20) return <span style={badge('green')}>Norm</span>;
          if (value <= 25) return <span style={badge('orange')}>High</span>;
          return <span style={badge('red')}>V.High</span>;
        }
        if (value < 18) return <span style={badge('blue')}>Low</span>;
        if (value <= 28) return <span style={badge('green')}>Norm</span>;
        if (value <= 32) return <span style={badge('orange')}>High</span>;
        return <span style={badge('red')}>V.High</span>;
      }
      case 'muscleMass': {
        const median = isMale ? 34 : 24;
        const diff = value - median;
        if (Math.abs(diff) < 3) return <span style={badge('green')}>≈med</span>;
        if (diff > 0) return <span style={badge('green')}>▲ +{diff.toFixed(1)}</span>;
        return <span style={badge('red')}>▼ {diff.toFixed(1)}</span>;
      }
      case 'waistCm': {
        if (isMale) {
          if (value < 80) return <span style={badge('blue')}>Low</span>;
          if (value <= 94) return <span style={badge('green')}>Norm</span>;
          if (value <= 102) return <span style={badge('orange')}>High</span>;
          return <span style={badge('red')}>V.High</span>;
        }
        if (value < 70) return <span style={badge('blue')}>Low</span>;
        if (value <= 80) return <span style={badge('green')}>Norm</span>;
        if (value <= 88) return <span style={badge('orange')}>High</span>;
        return <span style={badge('red')}>V.High</span>;
      }
      case 'weight': {
        const g = goal;
        if (!g || g <= 0) return null;
        const d = value - g;
        if (Math.abs(d) <= 1) return <span style={badge('green')}>✓ Goal</span>;
        if (d > 0) return <span style={badge('orange')}>▲ +{d.toFixed(1)}</span>;
        return <span style={badge('blue')}>▼ {d.toFixed(1)}</span>;
      }
      case 'bicepCm':
      case 'thighCm':
      case 'calfCm': {
        const leftKey = `${field.slice(0, -2)}LeftCm` as keyof WeightEntry;
        const rightKey = `${field.slice(0, -2)}RightCm` as keyof WeightEntry;
        const left = row[leftKey];
        const right = row[rightKey];
        if (left !== undefined && right !== undefined && Number.isFinite(left as number) && Number.isFinite(right as number)) {
          const diff = Math.abs((left as number) - (right as number));
          if (diff > 1) return <span style={badge('red')}>Δ {diff.toFixed(1)}</span>;
          if (diff > 0.5) return <span style={badge('orange')}>Δ {diff.toFixed(1)}</span>;
        }
        return null;
      }
      default:
        return null;
    }
  };
  const badge = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    marginLeft: 6,
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.3px',
    background: color === 'green' ? '#22c55e33' : color === 'red' ? '#ef444433' : color === 'orange' ? '#f9731633' : '#3b82f633',
    color: color === 'green' ? '#4ade80' : color === 'red' ? '#f87171' : color === 'orange' ? '#fb923c' : '#60a5fa',
    lineHeight: '16px',
    whiteSpace: 'nowrap',
  });
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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span>{row[field] ?? '—'}</span>
        {badgeFor(field, row[field] as number | undefined, row)}
      </span>
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
              ['Текущий вес', body.latest.weight, 'кг', interpretWeight(body.weightDelta, goal)],
              ['Δ веса', body.weightDelta, 'кг', interpretWeight(body.weightDelta, goal), body.weightDelta > 0 ? '+' : ''],
              ['% жира', body.latest.bodyFat, '%', interpretFat(body.fatDelta)],
              ['Δ жира', body.fatDelta, '%', interpretFat(body.fatDelta), body.fatDelta && body.fatDelta > 0 ? '+' : ''],
              ['Мышцы', body.latest.muscleMass, 'кг', interpretMuscle(body.leanDelta)],
              [
                'Δ талии',
                body.waistDelta,
                'см',
                interpretWaist(body.waistDelta),
                body.waistDelta && body.waistDelta > 0 ? '+' : '',
              ],
            ].map(([k, val, unit, insight, prefix]) => {
              const numVal = typeof val === 'number' ? val : null;
              return (
                <div
                  key={String(k)}
                  style={{ padding: 12, borderRadius: 9, background: '#22c55e18', border: '1px solid #22c55e44' }}
                >
                  <small>{k}</small>
                  <strong style={{ display: 'block', marginTop: 4, fontSize: 16 }}>
                    {numVal === null ? '—' : (
                      <AnimatedCounter
                        value={Math.abs(numVal)}
                        decimals={unit === 'кг' || unit === 'см' ? 1 : 0}
                        duration={500}
                        prefix={typeof prefix === 'string' ? prefix : ''}
                        suffix={` ${unit}`}
                        style={{ fontSize: 16, fontWeight: 700 }}
                      />
                    )}
                  </strong>
                  {insight && (
                    <small style={{ display: 'block', marginTop: 4, color: '#aaa', fontSize: 10 }}>
                      {insight}
                    </small>
                  )}
                </div>
              );
            })}
          </section>
        )}
        <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            ['Среднее', distribution?.mean],
            ['Медиана', distribution?.median],
            ['Мин/макс', extremes.min && extremes.max ? [extremes.min.value, extremes.max.value] : null],
            ['Дней', streak.totalDays],
            ['Серия', streak.current],
            ['Δ нед.', comparison.delta],
            ['Аномалии', anomalies.length],
          ].map(([k, v]) => {
            let content: React.ReactNode = '—';
            if (Array.isArray(v)) {
              content = `${v[0].toFixed(1)}/${v[1].toFixed(1)}`;
            } else if (typeof v === 'number' && Number.isFinite(v)) {
              const decimals = k === 'Дней' || k === 'Серия' || k === 'Аномалии' ? 0 : 1;
              content = <AnimatedCounter value={Math.abs(v)} decimals={decimals} duration={500} prefix={v < 0 ? '-' : ''} style={{ fontSize: 14, fontWeight: 700 }} />;
            }
            return (
              <div key={String(k)} style={{ padding: 10, background: '#27272a', borderRadius: 8 }}>
                <small>{k}</small>
                <b style={{ display: 'block' }}>{content}</b>
              </div>
            );
          })}
        </section>
        <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <b>📈 График</b>
            {FIELDS.map(f => (
              <button
                key={f}
                style={{
                  ...button,
                  background: activeChartFields.includes(f) ? (FIELD_COLORS[f] || '#22c55e') + '33' : '#27272a',
                  border: `1px solid ${activeChartFields.includes(f) ? (FIELD_COLORS[f] || '#22c55e') + '66' : '#3f3f46'}`,
                  color: activeChartFields.includes(f) ? (FIELD_COLORS[f] || '#22c55e') : '#aaa',
                }}
                onClick={() => toggleChartField(f)}
              >
                {LABELS[f]}
              </button>
            ))}
          </div>
          <OverlayChart
            series={chartSeries}
            target={activeChartFields.includes('weight') && goal > 0 ? goal : undefined}
            projections={chartProjection}
            rightAxis={rightAxis}
            notes={chartNotes}
            onSvg={(x) => exportSvgAsFile(x, `${svgName}.svg`)}
            onPng={(x) => exportSvgAsPng(x, `${svgName}.png`)}
            onSwipeField={(field) => {
              const f = field as Field;
              if (activeChartFields.includes(f)) {
                setActiveChartFields(prev => prev.filter(x => x !== f));
              } else {
                setActiveChartFields(prev => [...prev, f]);
              }
            }}
          />
        </section>
        <WeightDiaryVisuals rows={rows} goal={goal} heightCm={profileHeight} sex={profileSex} />
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
        <section style={{ overflowX: 'auto' }} className="wd-table-wrap">
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
                <th>Фото</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pageData.pageItems.map((e) => {
                const row = rows.find((r) => r.date === e.date);
                if (!row) return null;
                return (
                  <tr key={row.date} style={{ animation: 'fadeIn 0.3s ease' }}>
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
                      {row.photos && row.photos.length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {row.photos.map((src, i) => (
                            <img
                              key={i}
                              src={src}
                              alt=""
                              style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: '1px solid #3f3f46' }}
                              onClick={() => setViewPhoto({ src, date: row.date })}
                            />
                          ))}
                        </div>
                      ) : (
                        '—'
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
      {viewPhoto && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          onClick={() => setViewPhoto(null)}
        >
          <button
            style={{ position: 'absolute', top: 16, right: 16, background: '#27272a', border: '1px solid #3f3f46', color: '#fff', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18, zIndex: 1 }}
            onClick={() => setViewPhoto(null)}
          >
            ×
          </button>
          <img src={viewPhoto.src} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', bottom: 16, background: '#0008', padding: '6px 12px', borderRadius: 8, color: '#ccc', fontSize: 12 }}>
            {viewPhoto.date}
          </div>
        </div>
      )}
    </div>
  );
};
