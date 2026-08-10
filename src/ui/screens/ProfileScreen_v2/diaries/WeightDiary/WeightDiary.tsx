import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import { AddBodyMeasurementsModal } from '../../diary-modals';
import { getWeightLog, saveWeightLog, migrateWeightLogLegacy, getWeightLogArchived, type WeightEntry } from '../../../../../engines/profile-store';
import { updateSection } from '../../../../../core/profile-manager';
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
  daysToTarget,
  detectAnomalies,
  exportSvgAsFile,
  exportSvgAsPng,
  filterByRange,
  fitLinearTrend,
  laggedCorrelation,
  movingAverage,
  monthlySummaries,
  paceToTarget,
  paginate,
  projectToDate,
  sortEntries,
  todayIso,
  weeklySummaries,
  weightHeatmap,
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
  @media (max-width: 520px) {
    .wd-chart-wrap svg { min-height: 180px; }
    .wd-table-wrap { overflow-x: visible !important; }
    .wd-table-wrap table { min-width: 0 !important; }
    .wd-table-wrap thead { display: none; }
    .wd-table-wrap tbody tr { display: block; border: 1px solid #27272a; border-radius: 10px; margin-bottom: 10px; padding: 8px; background: #18181b; }
    .wd-table-wrap td { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 4px !important; border-bottom: 1px dashed #27272a; }
    .wd-table-wrap td:last-child { border-bottom: none; }
    .wd-table-wrap td::before { content: attr(data-label); color: #71717a; font-size: 11px; flex-shrink: 0; }
  }
`;
if (typeof document !== 'undefined') document.head.appendChild(style);

const TrendSpark: React.FC<{ row: WeightEntry; rows: WeightEntry[] }> = ({ row, rows }) => {
  const win = rows.filter((r) => r.date <= row.date).slice(0, 7).reverse();
  if (win.length < 2) return <span style={{ color: '#52525b' }}>—</span>;
  const min = Math.min(...win.map((w) => w.weight));
  const max = Math.max(...win.map((w) => w.weight));
  const span = max - min || 1;
  const pts = win.map((w, i) => [i * 11, 16 - ((w.weight - min) / span) * 14] as const);
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const trend = win[win.length - 1].weight - win[0].weight;
  return (
    <svg width="66" height="18" aria-label="тренд веса">
      <path d={path} fill="none" stroke={trend >= 0 ? '#f87171' : '#22c55e'} strokeWidth="1.5" />
      <circle cx={`${pts[pts.length - 1][0]}`} cy={`${pts[pts.length - 1][1]}`} r="2" fill={trend >= 0 ? '#f87171' : '#22c55e'} />
    </svg>
  );
};

const card: React.CSSProperties = { padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 };
const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: '#18181b',
  padding: '8px 6px',
  textAlign: 'left',
  borderBottom: '1px solid #3f3f46',
};
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
  const [showMA, setShowMA] = useState(true);
  const [comparePos, setComparePos] = useState(50);
  const [quickW, setQuickW] = useState('');
  const [quickTod, setQuickTod] = useState<'morning' | 'evening'>('morning');
  const [showArchive, setShowArchive] = useState(false);
  const [goalDate, setGoalDate] = useState('');
  const [archiveRows, setArchiveRows] = useState<WeightEntry[]>(() => getWeightLogArchived());
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
    setArchiveRows(getWeightLogArchived());
    try {
      const stored = Number(JSON.parse(localStorage.getItem('he_diary_goals') || '{}').weightKg);
      setGoal(Number.isFinite(stored) && stored > 0 ? stored : goals?.weightKg || 0);
    } catch {
      setGoal(goals?.weightKg || 0);
    }
    try {
      // Приоритет: UnifiedSettings (he_profile_v2) → legacy he_training_profile.
      const unifiedRaw = localStorage.getItem('he_profile_v2');
      let height: number | undefined;
      let sex: 'male' | 'female' | undefined;
      if (unifiedRaw) {
        const unified = JSON.parse(unifiedRaw);
        if (Number(unified?.personal?.height) > 0) height = Number(unified.personal.height);
        if (unified?.personal?.sex) sex = unified.personal.sex === 'female' ? 'female' : 'male';
      }
      if (!height) {
        const raw = localStorage.getItem('he_training_profile');
        if (raw) {
          const profile = JSON.parse(raw);
          if (profile.bodyHeightCm) height = Number(profile.bodyHeightCm);
          if (profile.sex) sex = profile.sex;
        }
      }
      if (height) setProfileHeight(height);
      if (sex) setProfileSex(sex);
    } catch {
      /* ignore */
    }
    migrateWeightLogLegacy();
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
  const quickAdd = () => {
    const w = Number(quickW);
    if (!Number.isFinite(w) || w <= 0 || w > 400) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = rows.some((r) => r.date === today)
      ? rows.map((r) => (r.date === today ? { ...r, weight: w, timeOfDay: quickTod } : r))
      : [{ date: today, weight: w, timeOfDay: quickTod }, ...rows];
    commit(next);
    setQuickW('');
    setQuickTod('morning');
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
  const ma7 = useMemo(() => movingAverage(pointsFor(rows, 'weight'), 7), [rows]);
  const photoPairs = useMemo(() => {
    const withPhotos = rows.filter(r => r.photos && r.photos.length > 0);
    if (withPhotos.length < 2) return null;
    const first = withPhotos[withPhotos.length - 1];
    const last = withPhotos[0];
    return { before: first, after: last, beforeDates: withPhotos.map(r => r.date) };
  }, [rows]);
  const weightFit = useMemo(() => fitLinearTrend(pointsFor(rows, 'weight')), [rows]);
  const chartProjection = useMemo(() => {
    if (goal <= 0 || !weightFit) return [] as OverlayChartProps['projections'];
    const out: OverlayChartProps['projections'] = [];
    for (let w = 0; w <= 12; w++) {
      const d = new Date();
      d.setDate(d.getDate() + w * 7);
      const iso = d.toISOString().split('T')[0];
      const val = projectToDate(weightFit, iso);
      const reached = weightFit.slopePerDay > 0 ? val >= goal : weightFit.slopePerDay < 0 ? val <= goal : false;
      if (reached) { out.push({ date: iso, value: goal }); break; }
      out.push({ date: iso, value: val });
    }
    return out;
  }, [goal, weightFit]);
  const eta = useMemo(() => {
    if (goal <= 0 || !weightFit) return null;
    const days = daysToTarget(weightFit, todayIso(), goal);
    if (days === null) return null;
    return { days, weeks: Math.round((days / 7) * 10) / 10 };
  }, [goal, weightFit]);
  const goalProgress = useMemo(() => {
    const pts = pointsFor(rows, 'weight').sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length === 0 || goal <= 0) return null;
    const start = pts[0].value;
    const cur = pts[pts.length - 1].value;
    if (start === cur) return { start, cur, pct: null, done: false };
    const pct = Math.max(-200, Math.min(200, Math.round(((cur - start) / (goal - start)) * 100)));
    return { start, cur, pct, done: Math.abs(cur - goal) < 0.5 };
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
    const daysAgo = (n: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - n);
      const iso = cutoff.toISOString().split('T')[0];
      const hit = rows.find(r => r.date <= iso);
      return hit ? latest.weight - hit.weight : null;
    };
    return {
      latest,
      bmi: profileHeight && profileHeight > 0 && latest.weight > 0 ? latest.weight / ((profileHeight / 100) ** 2) : null,
      weightDelta: first ? latest.weight - first.weight : 0,
      delta30: daysAgo(30),
      delta90: daysAgo(90),
      fatDelta: latest.bodyFat !== undefined && first?.bodyFat !== undefined ? latest.bodyFat - first.bodyFat : null,
      leanDelta:
        latest.muscleMass !== undefined && first?.muscleMass !== undefined
          ? latest.muscleMass - first.muscleMass
          : null,
      waistDelta: latest.waistCm !== undefined && first?.waistCm !== undefined ? latest.waistCm - first.waistCm : null,
    };
  }, [rows, profileHeight]);

  const weekSummaries = useMemo(() => weeklySummaries(rows.map((r) => ({ date: r.date, weight: r.weight })), 12), [rows]);
  const monthSummaries = useMemo(() => monthlySummaries(rows.map((r) => ({ date: r.date, weight: r.weight })), 6), [rows]);
  const heatmap = useMemo(() => weightHeatmap(rows.map((r) => ({ date: r.date, weight: r.weight })), 12), [rows]);
  const pace = useMemo(
    () => (goalDate && goal > 0 && body ? paceToTarget(body.latest.weight, goal, goalDate) : null),
    [goalDate, goal, body]
  );
  const syncFromProfile = () => {
    setGoal(goals?.weightKg || 0);
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (raw) {
        const unified = JSON.parse(raw);
        if (Number(unified?.personal?.height) > 0) setProfileHeight(Number(unified.personal.height));
        if (unified?.personal?.sex) setProfileSex(unified.personal.sex === 'female' ? 'female' : 'male');
      }
    } catch { /* ignore */ }
  };
  const syncToProfile = () => {
    if (!body) return;
    try { updateSection('personal', { weight: body.latest.weight }); } catch { /* ignore */ }
  };

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
    const cols = ['date', ...FIELDS, 'timeOfDay', 'notes'];
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
  const exportArchiveCsv = () => {
    const cols = ['date', 'weight', 'bodyFat', 'notes'];
    const csv = '\ufeff' + [cols.join(','), ...archiveRows.map((r) => cols.map((c) => JSON.stringify((r as any)[c] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${svgName}-archive.csv`;
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
          background: 'linear-gradient(135deg,#18181b 0%,#0d2817 100%)',
          borderBottom: '1px solid #3f3f46',
        }}
      >
        <button style={button} onClick={onClose}>
          ← Дневники
        </button>
        <b style={{ fontSize: 17, backgroundImage: 'linear-gradient(90deg,#4ade80,#a3e635)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>⚖️ Вес и все замеры</b>
        <button
          style={{ ...button, background: 'linear-gradient(135deg,#166534,#22c55e)', border: '1px solid #22c55e66', fontWeight: 700 }}
          onClick={() => setModal(true)}
        >
          + Добавить
        </button>
        <button style={button} onClick={() => setModal(true)}>
          ⚡ Сегодня
        </button>
        {body && (
          <small style={{ marginLeft: 'auto', color: '#4ade80', fontSize: 11, opacity: 0.9 }}>
            Текущий: {body.latest.weight} кг{goal ? ` · цель ${goal} кг` : ''}
          </small>
        )}
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
          <button
            style={{ ...button, background: showArchive ? '#166534' : button.background }}
            onClick={() => setShowArchive((v) => !v)}
            aria-pressed={showArchive}
          >
            🗄 Архив ({archiveRows.length})
          </button>
          <button style={button} onClick={syncFromProfile}>
            📋 Из профиля
          </button>
          <button style={button} onClick={syncToProfile}>
            💾 В профиль
          </button>
        </section>
        <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12, background: 'linear-gradient(135deg,#18181b,#0d2817)', borderRadius: 10, marginBottom: 12, border: '1px solid #22c55e33' }}>
          <b style={{ fontSize: 14 }}>⚡ Быстрый ввод</b>
          <input
            style={{ ...input, width: 110 }}
            type="number"
            step="0.1"
            min={20}
            max={400}
            placeholder="Вес, кг"
            value={quickW}
            onChange={(e) => setQuickW(e.target.value)}
          />
          <select
            style={{ ...input, width: 150 }}
            value={quickTod}
            onChange={(e) => setQuickTod(e.target.value as 'morning' | 'evening')}
            aria-label="Время суток"
          >
            <option value="morning">🌅 Утро</option>
            <option value="evening">🌙 Вечер</option>
          </select>
          <button
            style={{
              ...button,
              background: 'linear-gradient(135deg,#166534,#22c55e)',
              border: '1px solid #22c55e66',
              fontWeight: 700,
            }}
            onClick={quickAdd}
            disabled={!(Number(quickW) > 0 && Number(quickW) <= 400)}
          >
            + Записать
          </button>
          {rows.some((r) => r.date === new Date().toISOString().slice(0, 10)) && (
            <small style={{ color: '#fbbf24' }}>Сегодня уже есть запись — будет обновлена</small>
          )}
        </section>
        {rows.length === 0 && (
          <section style={{ padding: 24, textAlign: 'center', borderRadius: 12, background: 'linear-gradient(135deg,#18181b,#0d2817)', border: '1px dashed #22c55e55', marginBottom: 12 }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>⚖️</div>
            <b>Пока нет записей веса</b>
            <p style={{ color: '#aaa', fontSize: 13, margin: '6px 0 12px' }}>Добавьте первую запись через «+ Добавить» или быстрый ввод выше</p>
            <button
              style={{ ...button, background: 'linear-gradient(135deg,#166534,#22c55e)', border: '1px solid #22c55e66', fontWeight: 700 }}
              onClick={() => setModal(true)}
            >
              + Добавить запись
            </button>
          </section>
        )}
        {showArchive && archiveRows.length > 0 && (
          <details style={card} open>
            <summary style={{ cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>
              🗄 Архив ({archiveRows.length} записей старше 365 дней)
            </summary>
            <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
              <button style={button} onClick={exportArchiveCsv}>CSV архива</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Дата</th>
                  <th style={thStyle}>Вес</th>
                  <th style={thStyle}>Жир %</th>
                  <th style={thStyle}>Заметка</th>
                </tr>
              </thead>
              <tbody>
                {archiveRows.slice(0, 100).map((r) => (
                  <tr key={r.date} style={{ borderBottom: '1px solid #27272a' }}>
                    <td style={{ padding: 5 }}>{r.date}</td>
                    <td style={{ padding: 5 }}>{r.weight ? r.weight.toFixed(1) : '—'}</td>
                    <td style={{ padding: 5 }}>{r.bodyFat !== undefined ? r.bodyFat + '%' : '—'}</td>
                    <td style={{ padding: 5 }}>{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
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
              [
                'BMI',
                body.bmi,
                '',
                body.bmi === null ? '' : body.bmi >= 30 ? 'Ожирение' : body.bmi >= 25 ? 'Избыточный вес' : body.bmi < 18.5 ? 'Дефицит' : 'Норма',
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
                        decimals={unit === 'кг' || unit === 'см' || String(k) === 'BMI' ? 1 : 0}
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
            ['📊 Среднее', distribution?.mean],
            ['🎯 Медиана', distribution?.median],
            ['↕ Мин/макс', extremes.min && extremes.max ? [extremes.min.value, extremes.max.value] : null],
            ['📅 Дней', streak.totalDays],
            ['🔥 Серия', streak.current],
            ['Δ нед.', comparison.delta],
            ['Δ 30д', body?.delta30 ?? null],
            ['Δ 90д', body?.delta90 ?? null],
            ['⚠ Аномалии', anomalies.length],
          ].map(([k, v]) => {
            let content: React.ReactNode = '—';
            if (Array.isArray(v)) {
              content = `${v[0].toFixed(1)}/${v[1].toFixed(1)}`;
            } else if (typeof v === 'number' && Number.isFinite(v)) {
              const decimals = k === 'Дней' || k === 'Серия' || k === 'Аномалии' ? 0 : 1;
              const isDelta = String(k).startsWith('Δ');
              const color = isDelta ? (v < 0 ? '#22c55e' : v > 0 ? '#f87171' : '#aaa') : undefined;
              content = <AnimatedCounter value={Math.abs(v)} decimals={decimals} duration={500} prefix={v < 0 ? '-' : ''} style={{ fontSize: 14, fontWeight: 700, color }} />;
            }
            return (
              <div key={String(k)} style={{ padding: 10, background: '#27272a', borderRadius: 8 }}>
                <small>{k}</small>
                <b style={{ display: 'block' }}>{content}</b>
              </div>
            );
          })}
        </section>
        <section style={card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <b>📈 График</b>
            <button
              style={{
                ...button,
                background: showMA ? '#22c55e22' : '#27272a',
                border: '1px solid ' + (showMA ? '#22c55e66' : '#3f3f46'),
                color: showMA ? '#22c55e' : '#aaa',
              }}
              onClick={() => setShowMA(v => !v)}
              aria-pressed={showMA}
            >
              Сглаживание 7д
            </button>
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
            targetZone={0.5}
            projections={chartProjection}
            movingAverage={showMA && activeChartFields.includes('weight') ? ma7 : undefined}
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
        {goalProgress && (
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <b>Цель {goal} кг</b>
              {eta ? (
                <small style={{ color: '#fbbf24' }}>
                  Тренд: {weightFit ? (weightFit.slopePerDay * 7 >= 0 ? '+' : '') + (weightFit.slopePerDay * 7).toFixed(2) : ''} кг/нед · ETA ≈ {eta.weeks} нед
                </small>
              ) : (
                <small style={{ color: '#aaa' }}>Тренд не направлен к цели</small>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <label style={{ fontSize: 11, color: '#aaa' }}>
                К дате:{' '}
                <input
                  type="date"
                  style={{ ...input, width: 150, display: 'inline-block' }}
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                />
              </label>
              {pace && (
                <small style={{ color: pace.kgPerWeek <= -0.25 || pace.kgPerWeek >= 0.25 ? '#fbbf24' : '#4ade80' }}>
                  Нужно {pace.kgPerWeek > 0 ? '+' : ''}
                  {pace.kgPerWeek.toFixed(2)} кг/нед · осталось {pace.days} дн. ({Math.abs(pace.kgTotal).toFixed(1)} кг)
                </small>
              )}
            </div>
            <div style={{ height: 8, borderRadius: 4, background: '#27272a', marginTop: 8, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', width: (goalProgress.pct === null ? 0 : Math.max(0, Math.min(100, goalProgress.pct))) + '%',
                  borderRadius: 4,
                  transition: 'width 0.5s ease',
                  background: goalProgress.done ? '#22c55e' : goalProgress.pct === null ? '#a78bfa' : goalProgress.pct < 0 ? '#ef4444' : 'linear-gradient(90deg,#22c55e,#a3e635)',
                }}
              />
            </div>
            <small style={{ display: 'block', marginTop: 6, color: '#aaa' }}>
              {goalProgress.start.toFixed(1)} кг → {goalProgress.cur.toFixed(1)} кг (текущий) · прогресс{' '}
              {goalProgress.pct === null ? '—' : goalProgress.pct + '%'}
              {!goalProgress.done && ` · осталось ${Math.abs(goal - goalProgress.cur).toFixed(1)} кг`}
            </small>
          </section>
        )}
        {photoPairs && (
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <b>До / После</b>
              <small style={{ color: '#888' }}>
                {photoPairs.before.date} → {photoPairs.after.date}
              </small>
            </div>
            <div
              style={{
                position: 'relative', marginTop: 8, borderRadius: 10, overflow: 'hidden',
                aspectRatio: '3/4', maxHeight: 360, width: '100%', background: '#09090b',
              }}
            >
              <img
                src={photoPairs.after.photos![0]}
                alt="после"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <img
                src={photoPairs.before.photos![0]}
                alt="до"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  clipPath: 'inset(0 ' + (100 - comparePos) + '% 0 0)',
                  transition: 'clip-path 0.1s linear',
                }}
              />
              <div
                style={{
                  position: 'absolute', top: 0, bottom: 0, left: comparePos + '%',
                  width: 2, background: '#fff', opacity: 0.85, pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute', top: '50%', left: -10, width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transform: 'translateY(-50%)', boxShadow: '0 0 0 3px rgba(0,0,0,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                  }}
                >
                  <span style={{ color: '#111', fontSize: 10 }}>⇔</span>
                </div>
              </div>
              <span style={{ position: 'absolute', left: 8, top: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.55)', fontSize: 11, color: '#fff' }}>
                До ({photoPairs.before.date.slice(5)})
              </span>
              <span style={{ position: 'absolute', right: 8, top: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.55)', fontSize: 11, color: '#fff' }}>
                После ({photoPairs.after.date.slice(5)})
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={comparePos}
              onChange={(e) => setComparePos(Number(e.target.value))}
              aria-label="Позиция разделителя до/после"
              style={{ width: '100%', marginTop: 8, accentColor: '#22c55e' }}
            />
            <small style={{ display: 'block', marginTop: 4, color: '#888', fontSize: 10 }}>
              Перетащите ползунок, чтобы сравнить прогресс
            </small>
          </section>
        )}
        {heatmap && (
          <details style={card}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>
              🗓 Календарь веса ({heatmap.cells.flat().filter(Boolean).length} записей)
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginTop: 8 }}>
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                <small key={d} style={{ textAlign: 'center', color: '#71717a', fontSize: 9 }}>{d}</small>
              ))}
              {heatmap.cells.flat().map((c, i) =>
                c ? (
                  <div
                    key={i}
                    title={`${c.date}: ${c.value.toFixed(1)} кг`}
                    style={{ aspectRatio: '1', borderRadius: 4, background: `rgba(34,197,94,${(0.12 + c.pct * 0.85).toFixed(2)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <small style={{ fontSize: 8, color: '#e5e5e5' }}>{c.value.toFixed(0)}</small>
                  </div>
                ) : (
                  <div key={i} style={{ aspectRatio: '1', borderRadius: 4, background: '#111113', border: '1px dashed #27272a' }} />
                )
              )}
            </div>
            <small style={{ display: 'block', marginTop: 6, color: '#71717a', fontSize: 10 }}>
              Мин {heatmap.min.toFixed(1)} кг · Макс {heatmap.max.toFixed(1)} кг
            </small>
          </details>
        )}
        {(weekSummaries.length > 0 || monthSummaries.length > 0) && (
          <details style={card}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>📊 Сводки по периодам</summary>
            {weekSummaries.length > 0 && (
              <>
                <b style={{ fontSize: 12 }}>Недели</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Неделя</th>
                      <th style={thStyle}>Записей</th>
                      <th style={thStyle}>Средняя</th>
                      <th style={thStyle}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekSummaries.map((w) => (
                      <tr key={w.weekStart} style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: 5 }}>{w.weekStart}</td>
                        <td style={{ padding: 5 }}>{w.count}</td>
                        <td style={{ padding: 5 }}>{w.mean.toFixed(1)}</td>
                        <td style={{ padding: 5, color: w.delta === null ? '#71717a' : w.delta < 0 ? '#22c55e' : '#f87171' }}>
                          {w.delta === null ? '—' : (w.delta > 0 ? '+' : '') + w.delta.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {monthSummaries.length > 0 && (
              <>
                <b style={{ fontSize: 12, display: 'block', marginTop: 10 }}>Месяцы</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Месяц</th>
                      <th style={thStyle}>Записей</th>
                      <th style={thStyle}>Средняя</th>
                      <th style={thStyle}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthSummaries.map((m) => (
                      <tr key={m.month} style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: 5 }}>{m.month}</td>
                        <td style={{ padding: 5 }}>{m.count}</td>
                        <td style={{ padding: 5 }}>{m.mean.toFixed(1)}</td>
                        <td style={{ padding: 5, color: m.delta === null ? '#71717a' : m.delta < 0 ? '#22c55e' : '#f87171' }}>
                          {m.delta === null ? '—' : (m.delta > 0 ? '+' : '') + m.delta.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </details>
        )}
        <WeightDiaryVisuals rows={rows} goal={goal} heightCm={profileHeight} sex={profileSex} />
        {comparison.thisWeek && comparison.lastWeek && (
          <section style={{ padding: 12, background: '#3b82f622', borderRadius: 10, marginBottom: 12 }}>
            📆 Эта неделя: <b>{comparison.thisWeek.mean.toFixed(1)} кг</b> · прошлая:{' '}
            <b>{comparison.lastWeek.mean.toFixed(1)} кг</b> · Δ <b>{comparison.delta?.toFixed(1)} кг</b>
          </section>
        )}
        {bodyCorrelations.length > 0 && (
          <details style={card}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>🔗 Связь веса с замерами ({bodyCorrelations.length})</summary>
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
          </details>
        )}
        {anomalies.length > 0 && (
          <details style={{ padding: 12, background: '#f59e0b18', borderRadius: 10, marginBottom: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>⚠ Аномалии ({anomalies.length})</summary>
            {anomalies.slice(-5).map((a, i) => (
              <div key={`${a.date}-${i}`}>
                {a.date}: {a.message}
              </div>
            ))}
          </details>
        )}
        {training && (
          <details style={{ padding: 12, background: '#3b82f622', borderRadius: 10, marginBottom: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>🏋️ Сила и инсайты</summary>
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
          </details>
        )}
        <section style={{ overflowX: 'auto' }} className="wd-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={thStyle}>Дата</th>
                {FIELDS.map((f) => (
                  <th key={f} style={thStyle}>
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
                <th style={thStyle}>Время</th>
                <th style={thStyle}>Заметка</th>
                <th style={thStyle}>Фото</th>
                <th style={thStyle}>Тренд</th>
                <th style={thStyle}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pageData.pageItems.map((e) => {
                const row = rows.find((r) => r.date === e.date);
                if (!row) return null;
                return (
                  <tr key={row.date} style={{ animation: 'fadeIn 0.3s ease' }}>
                    <td data-label="Дата">
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
                      <td data-label={LABELS[f]} key={f}>{fieldCell(row, f)}</td>
                    ))}
                    <td data-label="Время">
                      {editing === row.date ? (
                        <select
                          style={input}
                          value={draft.timeOfDay || 'morning'}
                          onChange={(e) => setDraft({ ...draft, timeOfDay: e.target.value as 'morning' | 'evening' })}
                          aria-label="Время суток"
                        >
                          <option value="morning">🌅 Утро</option>
                          <option value="evening">🌙 Вечер</option>
                        </select>
                      ) : row.timeOfDay === 'morning' ? '🌅 Утро' : row.timeOfDay === 'evening' ? '🌙 Вечер' : '—'}
                    </td>
                    <td data-label="Заметка">
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
                    <td data-label="Фото" style={{ whiteSpace: 'nowrap' }}>
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
                    <td data-label="Тренд" style={{ whiteSpace: 'nowrap' }}>
                      <TrendSpark row={row} rows={rows} />
                    </td>
                    <td data-label="Действия" style={{ whiteSpace: 'nowrap' }}>
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
