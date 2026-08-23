import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import { DiaryHeader } from '../DiaryHeader';
import { AddBodyMeasurementsModal } from '../../diary-modals';
import { getWeightLog, saveWeightLog, migrateWeightLogLegacy, getWeightLogArchived, getWeightLogWithPhotos, normalizeWeightEntry, type WeightEntry } from '../../../../../engines/profile-store';
import { migrateWeightPhotosFromLocalStorage } from '../../../../../engines/weight-photo-store';
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
  escapeHtml,
  type DiaryEntryLike,
  type SortState,
} from '../../diary-helpers';
import { exportAllDiariesPdf, type DiaryExportData } from '../../diary-helpers';
import type { DiaryWindowProps } from '../../DiaryWindow';
import { WeightDiaryVisuals } from './WeightDiary.visuals';
import { OverlayChart, ChartLegend, FIELD_COLORS, FIELD_LABELS, PERCENT_FIELDS, type OverlayChartProps } from './WeightChart';
import { AnimatedCounter } from '@/ui/components/AnimatedCounter';
import {
  c,
  FONT,
  card,
  tile,
  sectionHeader,
  btn,
  btnPrimary,
  segWrap,
  segBtn,
  chip,
  input,
  group,
  metricLabel,
  metricValue,
  metricDelta,
  tnum,
} from './design';
import {
  rowsInRange,
  deltaVsPrev,
  timeOfDayBreakdown,
  fmtSigned,
  goalProgressSafe,
  goalDirection,
  preferMorning,
  csvEscape,
  type RangeKey,
} from './weight-insights';

const style = document.createElement('style');
style.textContent = `
  @keyframes wd-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wd-slide { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes wd-pop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  .wd-diary { font-family: ${FONT}; -webkit-font-smoothing: antialiased; }
  .wd-card { animation: wd-fade 0.3s ease; }
  .wd-diary details > summary { list-style: none; }
  .wd-diary details > summary::-webkit-details-marker { display: none; }
  .wd-diary::-webkit-scrollbar { width: 8px; }
  .wd-diary::-webkit-scrollbar-track { background: transparent; }
  .wd-diary::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 999px; }
  .wd-diary::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.24); }
  .wd-table-wrap::-webkit-scrollbar { height: 6px; }
  .wd-table-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 999px; }
  @media (max-width: 560px) {
    .wd-chart-wrap svg { min-height: 180px; }
    .wd-table-wrap { overflow-x: visible !important; }
    .wd-table-wrap table { min-width: 0 !important; }
    .wd-table-wrap thead { display: none; }
    .wd-table-wrap tbody tr { display: block; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; margin-bottom: 10px; padding: 10px 12px; background: #1c1c1e; }
    .wd-table-wrap td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 2px !important; border-bottom: 1px dashed rgba(255,255,255,0.06); }
    .wd-table-wrap td:last-child { border-bottom: none; }
    .wd-table-wrap td::before { content: attr(data-label); color: #ffffff; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0; }
    .wd-table-wrap td[data-label="Заметка"] { flex-direction: column; align-items: flex-start; }
  }
`;
if (typeof document !== 'undefined') document.head.appendChild(style);

/* ── Мини-спарклайн тренда в таблице ── */

const TrendSpark: React.FC<{ row: WeightEntry; rows: WeightEntry[]; goalDir: 1 | -1 | 0 }> = ({ row, rows, goalDir }) => {
  const win = rows.filter((r) => r.date <= row.date).slice(0, 7).reverse();
  if (win.length < 2) return <span style={{ color: c.text3, fontSize: 11 }}>—</span>;
  const min = Math.min(...win.map((w) => w.weight));
  const max = Math.max(...win.map((w) => w.weight));
  const span = max - min || 1;
  const pts = win.map((w, i) => [i * 11, 16 - ((w.weight - min) / span) * 14] as const);
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const trend = win[win.length - 1].weight - win[0].weight;
  const up = trend >= 0;
  const stroke = goalDir === 0 ? c.blue : up === (goalDir > 0) ? c.green : c.red;
  return (
    <svg width="66" height="18" aria-label="тренд веса">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" />
      <circle cx={`${pts[pts.length - 1][0]}`} cy={`${pts[pts.length - 1][1]}`} r="2" fill={stroke} />
    </svg>
  );
};

const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: '#1c1c1e',
  padding: '8px 6px',
  textAlign: 'left',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  color: c.text3,
};

const sum: React.CSSProperties = {
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: c.text,
  padding: '2px 0',
  userSelect: 'none',
  fontFamily: FONT,
};

const FIELDS = [
  'weight',
  'waistCm',
  'chestCm',
  'hipCm',
  'shoulderCm',
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
  'forearmLeftCm',
  'forearmRightCm',
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
  shoulderCm: 'Плечи',
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
  forearmLeftCm: 'Предплечье L',
  forearmRightCm: 'Предплечье R',
  bodyFat: '% жира',
  muscleMass: 'Мышечная масса',
  waterMass: 'Вода',
};
const UNIT: Record<Field, string> = {
  weight: 'кг',
  waistCm: 'см',
  chestCm: 'см',
  hipCm: 'см',
  shoulderCm: 'см',
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
  forearmLeftCm: 'см',
  forearmRightCm: 'см',
  bodyFat: '%',
  muscleMass: 'кг',
  waterMass: '%',
};
const esc = escapeHtml;

/** Колонки по умолчанию: без «средних» дублей L/R. */
const DEFAULT_VISIBLE: Field[] = FIELDS.filter((f) => !['bicepCm', 'thighCm', 'calfCm'].includes(f));

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
  const [range, setRange] = useState<RangeKey>('all');
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
  const [showCols, setShowCols] = useState(false);
  const [archiveRows, setArchiveRows] = useState<WeightEntry[]>(() => getWeightLogArchived());
  const [profileHeight, setProfileHeight] = useState<number | undefined>();
  const [profileSex, setProfileSex] = useState<'male' | 'female' | undefined>();
  const [visibleCols, setVisibleCols] = useState<Field[]>(() => {
    try {
      const raw = localStorage.getItem('he_wd_cols_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          const valid = FIELDS.filter((f) => arr.includes(f));
          if (valid.length) return valid;
        }
      }
    } catch { /* ignore */ }
    return [...DEFAULT_VISIBLE];
  });
  const [units, setUnits] = useState<'kg' | 'lbs'>(() => {
    try { return localStorage.getItem('he_wd_units_v1') === 'lbs' ? 'lbs' : 'kg'; } catch { return 'kg'; }
  });
  useEffect(() => {
    try { localStorage.setItem('he_wd_units_v1', units); } catch { /* ignore */ }
  }, [units]);
  const KG_IN_LB = 0.45359237;
  const isLbs = units === 'lbs';
  const dispW = (kg: number | undefined | null): number | null =>
    kg === undefined || kg === null || !Number.isFinite(kg) ? null : (isLbs ? kg / KG_IN_LB : kg);
  const wUnit = isLbs ? 'lbs' : 'кг';
  const fmtW = (kg: number | undefined | null, digits = 1): string => {
    const v = dispW(kg);
    return v === null ? '—' : `${v.toFixed(digits)} ${wUnit}`;
  };
  useEffect(() => {
    try { localStorage.setItem('he_wd_cols_v1', JSON.stringify(visibleCols)); } catch { /* ignore */ }
  }, [visibleCols]);
  const svgName = `weight-${todayIso()}`;
  const toggleChartField = (f: Field) =>
    setActiveChartFields(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      await migrateWeightLogLegacy();
      await migrateWeightPhotosFromLocalStorage();
      if (!mounted) return;
      const rows = await getWeightLogWithPhotos();
      rows.sort((a, b) => b.date.localeCompare(a.date));
      setRows(rows);
      setArchiveRows(getWeightLogArchived());
    })();
    return () => { mounted = false; };
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
        const unified = JSON.parse(unifiedRaw as string);
        const h = unified?.personal?.height;
        const hNum = typeof h === 'number' ? h : typeof h === 'string' ? Number(h) : NaN;
        if (Number.isFinite(hNum) && hNum > 0) height = hNum;
        const s = unified?.personal?.sex;
        if (typeof s === 'string') sex = s === 'female' ? 'female' : 'male';
      }
      if (!height) {
        const raw = localStorage.getItem('he_training_profile');
        if (raw) {
          const profile = JSON.parse(raw as string);
          const h2 = profile.bodyHeightCm;
          const h2Num = typeof h2 === 'number' ? h2 : typeof h2 === 'string' ? Number(h2) : NaN;
          if (Number.isFinite(h2Num)) height = h2Num;
          const s2 = profile.sex;
          if (typeof s2 === 'string') sex = s2;
        }
      }
      if (height) setProfileHeight(height);
      if (sex) setProfileSex(sex);
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
    // Дедупликация по дате: последняя запись на дату выигрывает.
    // Нормализация до state — чтобы NaN/невалидные не попадали в таблицу.
    const byDate = new Map<string, WeightEntry>();
    for (const e of next) {
      const n = normalizeWeightEntry(e);
      if (n) byDate.set(n.date, n);
    }
    const ordered = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
    if (remember) setUndo(rows);
    saveWeightLog(ordered);
    setRows(ordered);
    setArchiveRows(getWeightLogArchived());
    onDataChange?.();
  };
  /** Удалить ВСЕ фото из лога (photos раздувают localStorage). */
  const clearAllPhotos = () => {
    if (!rows.some((r) => r.photos && r.photos.length)) {
      (window as any).showToast?.('📷 Фото в дневнике нет');
      return;
    }
    if (!window.confirm('Удалить ВСЕ фото из всех записей веса? Это освободит место в хранилище.')) return;
    commit(rows.map((r) => (r.photos && r.photos.length ? { ...r, photos: undefined } : r)));
    (window as any).showToast?.('🖼 Все фото удалены');
  };
  /** Импорт фото из архива в основные записи (по совпадающим датам, если фото нет). */
  const importArchivePhotos = () => {
    const withPhotos = archiveRows.filter((a) => a.photos && a.photos.length);
    if (!withPhotos.length) {
      (window as any).showToast?.('🗄 В архиве нет записей с фото');
      return;
    }
    let changed = false;
    const next = rows.map((r) => {
      if (r.photos && r.photos.length) return r;
      const arch = archiveRows.find((a) => a.date === r.date && a.photos && a.photos.length);
      if (!arch) return r;
      changed = true;
      return { ...r, photos: arch.photos };
    });
    if (!changed) {
      (window as any).showToast?.('Нет совпадающих дат с фото в архиве');
      return;
    }
    commit(next);
    (window as any).showToast?.('📥 Фото импортированы из архива');
  };
  const quickAdd = () => {
    const raw = Number(quickW);
    const maxRaw = isLbs ? 880 : 400;
    if (!Number.isFinite(raw) || raw <= 0 || raw > maxRaw) return;
    const w = isLbs ? raw * KG_IN_LB : raw;
    const today = todayIso();
    const next = rows.some((r) => r.date === today)
      ? rows.map((r) => (r.date === today ? { ...r, weight: w, timeOfDay: quickTod } : r))
      : [{ date: today, weight: w, timeOfDay: quickTod }, ...rows];
    commit(next);
    setQuickW('');
    (window as any).showToast?.(`✅ Вес записан (${quickTod === 'morning' ? 'утро' : 'вечер'})`);
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
  /* График и связанные с ним метрики учитывают выбранный диапазон. */
  // График/тренды: архивные записи (старше 365 дней) включаются в «Всё время» —
  // длинный тренд без разрыва; фото не тащим в расчёты.
  const chartRows = useMemo(() => {
    const base = range === 'all' ? [...rows, ...archiveRows.filter((a) => !rows.some((r) => r.date === a.date))] : rows;
    return rowsInRange(base, range);
  }, [rows, archiveRows, range]);
  const chartSeries = useMemo<OverlayChartProps['series']>(() => {
    if (activeChartFields.length === 0) return [];
    const series: OverlayChartProps['series'] = activeChartFields.map(f => ({
      field: f,
      points: pointsFor(chartRows, f),
      color: FIELD_COLORS[f] || '#ffffff',
      useRightAxis: PERCENT_FIELDS.has(f),
    }));
    if (profileHeight && chartRows.some(r => r.bodyFat !== undefined)) {
      const sorted = [...chartRows].sort((a, b) => a.date.localeCompare(b.date));
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
  }, [chartRows, activeChartFields, profileHeight]);
  const ma7 = useMemo(() => movingAverage(pointsFor(chartRows, 'weight'), 7), [chartRows]);
  const photoPairs = useMemo(() => {
    const withPhotos = rows.filter(r => r.photos && r.photos.length > 0);
    if (withPhotos.length < 2) return null;
    const first = withPhotos[withPhotos.length - 1];
    const last = withPhotos[0];
    return { before: first, after: last, beforeDates: withPhotos.map(r => r.date) };
  }, [rows]);
  /* Тренд/цель считаются по утренним замерам, когда их достаточно
     (≥60% записей и ≥3) — меньше шума от «еда и вода» вечером. */
  const trendRows = useMemo(() => preferMorning(rows), [rows]);
  const trendNormalized = trendRows !== rows;
  const weightFit = useMemo(() => fitLinearTrend(pointsFor(trendRows, 'weight')), [trendRows]);
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
    const pts = pointsFor(trendRows, 'weight').sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length === 0 || goal <= 0) return null;
    return goalProgressSafe(pts[0].value, pts[pts.length - 1].value, goal);
  }, [trendRows, goal]);
  const goalDir = useMemo(() => {
    const pts = pointsFor(trendRows, 'weight').sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length === 0) return 0 as 1 | -1 | 0;
    return goalDirection(pts[0].value, pts[pts.length - 1].value, goal);
  }, [trendRows, goal]);
  const deltaMap = useMemo(() => deltaVsPrev(rows), [rows]);
  const todInsight = useMemo(() => timeOfDayBreakdown(rows), [rows]);
  const chartNotes = useMemo(() => chartRows.filter(r => r.notes).map(r => ({ date: r.date, text: r.notes! })), [chartRows]);
  const rightAxis = useMemo(() => {
    const rightFields = activeChartFields.filter(f => PERCENT_FIELDS.has(f));
    const rightValues: number[] = [];
    rightFields.forEach(f => {
      const pts = pointsFor(chartRows, f);
      rightValues.push(...pts.map(p => p.value));
    });
    if (profileHeight && chartRows.some(r => r.bodyFat !== undefined)) {
      const sorted = [...chartRows].sort((a, b) => a.date.localeCompare(b.date));
      sorted.filter(r => r.bodyFat !== undefined && Number.isFinite(r.bodyFat)).forEach(r => {
        rightValues.push(calcFFMI(r.weight, profileHeight, r.bodyFat as number));
      });
    }
    if (rightValues.length === 0) return undefined;
    const min = Math.min(...rightValues);
    const max = Math.max(...rightValues);
    return { min, max, label: '% / FFMI', ticks: 5 };
  }, [chartRows, activeChartFields, profileHeight]);
  const weightPoints = pointsFor(rows, 'weight');
  const distribution = computeDistribution(weightPoints.map((x) => x.value));
  const extremes = computeExtremes('weight', entries);
  const weekly = buildWeeklyHistogram(weightPoints);
  const comparison = compareWithLastWeek(weightPoints);
  const anomalies = detectAnomalies('weight', entries);
  const streak = computeStreak(entries);
  const body = useMemo(() => {
    const latest = rows[0];
    if (!latest) return null;
    // Δ за период и 30/90 дней — консистентно с трендом: когда есть достаточно утренних замеров,
    // используем утренние (меньше шум), иначе — все.
    const baseRows = trendNormalized ? trendRows : rows;
    const first = baseRows.at(-1) ?? rows.at(-1);
    const baseLatest = baseRows[0] ?? latest;
    const daysAgo = (n: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - n);
      const iso = cutoff.toISOString().split('T')[0];
      const hit = baseRows.find(r => r.date <= iso);
      return hit ? baseLatest.weight - hit.weight : null;
    };
    return {
      latest,
      bmi: profileHeight && profileHeight > 0 && latest.weight > 0 ? latest.weight / ((profileHeight / 100) ** 2) : null,
      weightDelta: first ? baseLatest.weight - first.weight : 0,
      delta30: daysAgo(30),
      delta90: daysAgo(90),
      fatDelta: baseLatest.bodyFat !== undefined && first?.bodyFat !== undefined ? baseLatest.bodyFat - first.bodyFat : null,
      leanDelta:
        baseLatest.muscleMass !== undefined && first?.muscleMass !== undefined
          ? baseLatest.muscleMass - first.muscleMass
          : null,
      waistDelta: baseLatest.waistCm !== undefined && first?.waistCm !== undefined ? baseLatest.waistCm - first.waistCm : null,
    };
  }, [rows, trendRows, trendNormalized, profileHeight]);

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
      [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape((r as any)[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${svgName}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const exportArchiveCsv = () => {
    const cols = ['date', 'weight', 'bodyFat', 'notes'];
    const csv = '\ufeff' + [cols.join(','), ...archiveRows.map((r) => cols.map((c) => csvEscape((r as any)[c])).join(','))].join('\n');
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
  const exportAllDiaries = () => {
    exportAllDiariesPdf([{
      title: 'Вес и замеры',
      entries: rows.map((r) => ({
        date: r.date,
        fields: [
          { label: 'Вес', value: String(r.weight ?? ''), unit: 'кг' },
          ...(r.notes ? [{ label: 'Заметки', value: r.notes, unit: '' }] : []),
        ],
      })),
    }]);
  };
  const beginEdit = (row: WeightEntry) => {
    setEditing(row.date);
    setDraft({ ...row });
  };
  const saveEdit = () => {
    if (!editing || !draft.weight || !Number.isFinite(Number(draft.weight))) return;
    const newDate = typeof draft.date === 'string' && draft.date ? draft.date : editing;
    // При смене даты на занятую — мерджим в существующую запись, дубликат не создаётся
    const target = rows.find((r) => r.date === newDate);
    const merged: WeightEntry = {
      ...target,
      ...draft,
      date: newDate,
      weight: Number(draft.weight),
    } as WeightEntry;
    commit(rows.filter((r) => r.date !== editing && r.date !== newDate).concat([merged]));
    setDraft({});
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
        const dd = dispW(d) ?? 0;
        if (Math.abs(d) <= 1) return <span style={badge('green')}>✓ Goal</span>;
        if (d > 0) return <span style={badge('orange')}>▲ +{dd.toFixed(1)}</span>;
        return <span style={badge('blue')}>▼ {dd.toFixed(1)}</span>;
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
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.3px',
    background: color === 'green' ? '#30d15822' : color === 'red' ? '#ff453a22' : color === 'orange' ? '#ff9f0a22' : '#0a84ff22',
    color: color === 'green' ? '#30d158' : color === 'red' ? '#ff453a' : color === 'orange' ? '#ff9f0a' : '#0a84ff',
    lineHeight: '16px',
    whiteSpace: 'nowrap',
  });
  const fieldCell = (row: WeightEntry, field: Field) =>
    editing === row.date ? (
      <input
        style={{ ...input, minWidth: 70, padding: 5 }}
        type="number"
        step="0.1"
        value={field === 'weight' && draft.weight !== undefined ? (dispW(draft.weight) as number).toFixed(1) : draft[field] ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (field === 'weight') {
            const n = Number(v);
            setDraft({ ...draft, weight: v === '' ? undefined : (isLbs ? n * KG_IN_LB : n) });
          } else {
            setDraft({ ...draft, [field]: v === '' ? undefined : Number(v) });
          }
        }}
      />
    ) : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={tnum}>
          {field === 'weight' && row.weight !== undefined
            ? (dispW(row.weight) as number).toFixed(1)
            : row[field] ?? '—'}
        </span>
        {badgeFor(field, row[field] as number | undefined, row)}
      </span>
    );
  const correlation =
    trainingCorrelation ||
    (training && weightPoints.length >= 3 ? laggedCorrelation(weightPoints, training.volumePoints, 1) : null);
  if (!open) return null;

  const deltaTone = (d: number | undefined): { color: string; text: string } => {
    const dv = dispW(d);
    if (d === undefined || dv === null) return { color: c.text3, text: '—' };
    if (Math.abs(dv) < 0.05) return { color: c.text3, text: '±0.0' };
    const good = goalDir === 0 ? null : d > 0 === (goalDir > 0);
    const color = good === null ? c.text2 : good ? c.green : c.red;
    return { color, text: fmtSigned(dv) };
  };
  const bmiLabel = body?.bmi == null ? '' : body.bmi >= 30 ? 'Ожирение' : body.bmi >= 25 ? 'Избыточный вес' : body.bmi < 18.5 ? 'Дефицит' : 'Норма';
  const bmiColor = body?.bmi == null ? undefined : body.bmi >= 30 ? c.red : body.bmi >= 25 ? c.orange : body.bmi < 18.5 ? c.orange : c.green;

  return (
    <div className="wd-diary"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background:
          'radial-gradient(900px 480px at 15% -10%, rgba(34,197,94,0.08), transparent 60%), radial-gradient(700px 420px at 100% 0%, rgba(56,189,248,0.05), transparent 55%), #0a0a0a',
        color: c.text,
        overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}
    >
      <DiaryHeader
        accent="#34c759"
        title="⚖️ Вес и замеры"
        count={rows.length}
        countLabel="записей"
        onClose={onClose}
        onAdd={() => setModal(true)}
        addLabel="+ Добавить"
        onToday={() => setModal(true)}
        undoActive={!!undo}
        onUndo={() => { if (undo) { commit(undo, false); setUndo(null); } }}
        exportActions={[
          { label: '📥 CSV-файл', onClick: doExportCsv },
          { label: '🖨 Печать / PDF (вес)', onClick: doPrint },
          { label: '📄 PDF: все дневники', onClick: exportAllDiaries },
          { label: '🗄 Архив', onClick: () => setShowArchive((v: boolean) => !v), danger: false },
          { label: '📥 Фото из архива', onClick: importArchivePhotos },
          { label: '🖼 Сбросить фото', onClick: clearAllPhotos, danger: true },
          { label: '📋 Из профиля', onClick: syncFromProfile },
          { label: '💾 В профиль', onClick: syncToProfile },
          { label: '🗑 Очистить дневник', onClick: () => { if (rows.length && confirm('Очистить весь дневник?')) commit([]); }, danger: true },
        ]}
      />

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '8px 14px 72px' }}>
        {rows.length === 0 && (
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ textAlign: 'center', padding: '30px 12px' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>⚖️</div>
              <b style={{ fontSize: 15, letterSpacing: '-0.2px' }}>Пока нет записей веса</b>
              <p style={{ color: c.text3, fontSize: 12, margin: '6px 0 16px' }}>
                Добавьте первую запись — через «+ Добавить» или быстрый ввод ниже
              </p>
              <button style={btnPrimary} onClick={() => setModal(true)}>+ Добавить запись</button>
            </div>
          </div>
        )}

        {showArchive && archiveRows.length > 0 && (
          <details style={card} open>
            <summary style={sum}>
              <span>🗄</span> Архив — {archiveRows.length} записей старше 365 дней
              <span style={{ marginLeft: 'auto', color: c.text3, fontSize: 11, transition: 'transform 0.2s' }}>▾</span>
            </summary>
            <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
              <button style={btn} onClick={exportArchiveCsv}>CSV архива</button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
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
                    <tr key={r.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: 6 }}>{r.date}</td>
                      <td style={{ padding: 6 }}>{fmtW(r.weight)}</td>
                      <td style={{ padding: 6 }}>{r.bodyFat !== undefined ? r.bodyFat + '%' : '—'}</td>
                      <td style={{ padding: 6 }}>{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* ── Инструменты: диапазон · поиск · цель · единицы ── */}
        <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '14px 0 2px' }}>
          <div style={segWrap}>
            {(['all', '7', '30', '90'] as const).map((r) => (
              <button
                key={r}
                style={segBtn(range === r)}
                onClick={() => { setRange(r); setPage(1); }}
              >
                {r === 'all' ? 'Всё' : `${r}д`}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: '1 1 140px', minWidth: 120, display: 'flex', alignItems: 'center' }}>
            <input
              style={{ ...input, flex: 1, paddingRight: query ? 30 : undefined }}
              placeholder="Поиск"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              aria-label="Поиск по дате и полям"
            />
            {query && (
              <button onClick={() => { setQuery(''); setPage(1); }} aria-label="Очистить поиск" style={{ position: 'absolute', right: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: c.text3, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
            )}
          </div>
          <div style={segWrap} role="radiogroup" aria-label="Единицы измерения">
            {(['kg', 'lbs'] as const).map((u) => (
              <button
                key={u}
                style={segBtn(units === u)}
                onClick={() => setUnits(u)}
                aria-pressed={units === u}
                title={u === 'kg' ? 'Килограммы' : 'Фунты'}
              >
                {u === 'kg' ? 'кг' : 'lbs'}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: c.text3, whiteSpace: 'nowrap' }}>
            Цель
            <input
              style={{ ...input, width: 74 }}
              type="number" step="0.1" min={0}
              value={goal > 0 ? (dispW(goal) as number).toFixed(1) : ''}
              onChange={(e) => {
                const v = Number(e.target.value);
                setGoal(Number.isFinite(v) && v > 0 ? (isLbs ? v * KG_IN_LB : v) : 0);
              }}
              aria-label="Целевой вес"
            />
            {wUnit}
          </label>
        </section>

        {/* ── Быстрый ввод ── */}
        <section style={card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...metricLabel, marginBottom: 0 }}>Быстрый ввод</span>
            <input
              style={{ ...input, width: 96 }}
              type="number" step="0.1" min={isLbs ? 44 : 20} max={isLbs ? 880 : 400}
              placeholder={`Вес, ${wUnit}`}
              value={quickW}
              onChange={(e) => setQuickW(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); }}
              aria-label="Быстрый ввод веса"
            />
            <div style={{ display: 'inline-flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${colors.border}`, flexShrink: 0 }} role="radiogroup" aria-label="Время суток">
              {(['morning', 'evening'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={quickTod === t}
                  onClick={() => setQuickTod(t)}
                  style={{
                    ...input,
                    width: 88,
                    minHeight: 38,
                    cursor: 'pointer',
                    textAlign: 'center',
                    border: 'none',
                    borderRadius: 0,
                    background: quickTod === t ? 'rgba(34,197,94,0.16)' : 'transparent',
                    color: quickTod === t ? '#4ade80' : colors.textMuted,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {t === 'morning' ? '🌅 Утро' : '🌙 Вечер'}
                </button>
              ))}
            </div>
            <button
              style={{ ...btnPrimary, minHeight: 36 }}
              onClick={quickAdd}
              disabled={!(Number(quickW) > 0 && Number(quickW) <= (isLbs ? 880 : 400))}
            >
              + Записать
            </button>
            {rows.some((r) => r.date === todayIso()) && (
              <small style={{ color: c.orange, fontSize: 11 }}>Сегодня уже есть запись — будет обновлена</small>
            )}
          </div>
        </section>

        {/* ── Сводка: герой + плитки ── */}
        {body && (
          <section style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <span style={metricLabel}>Текущий вес</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <AnimatedCounter
                    value={dispW(body.latest.weight) || 0}
                    decimals={1}
                    duration={400}
                    suffix={` ${wUnit}`}
                    style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.8px', fontVariantNumeric: 'tabular-nums', color: c.text, fontFamily: FONT, lineHeight: 1.1 }}
                  />
                </div>
                <div style={metricDelta}>
                  Δ {fmtSigned(dispW(body.weightDelta) || 0)} {wUnit} · {interpretWeight(body.weightDelta, goal)}
                  {trendNormalized && <span style={{ color: c.blue, marginLeft: 6 }}>· тренд по утренним ☀</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={metricLabel}>BMI</span>
                <div style={{ ...metricValue, fontSize: 22, color: bmiColor || c.text, marginTop: 2 }}>{body.bmi?.toFixed(1) ?? '—'}</div>
                <div style={metricDelta}>{bmiLabel || 'укажите рост в профиле'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 14 }}>
              {[
                ['Δ вес', dispW(body.weightDelta), wUnit, interpretWeight(body.weightDelta, goal)],
                ['% жира', body.latest.bodyFat, '%', interpretFat(body.fatDelta)],
                ['Δ жира', body.fatDelta, '%', interpretFat(body.fatDelta)],
                ['Мышцы', dispW(body.latest.muscleMass), wUnit, interpretMuscle(body.leanDelta)],
                ['Δ мышц', dispW(body.leanDelta), wUnit, interpretMuscle(body.leanDelta)],
                ['Δ талии', body.waistDelta, 'см', interpretWaist(body.waistDelta)],
              ].map(([k, val, unit, insight]) => {
                const numVal = typeof val === 'number' && Number.isFinite(val) ? val : null;
                const isDelta = String(k).startsWith('Δ');
                const deltaColor = isDelta && numVal !== null ? (numVal < 0 ? c.green : numVal > 0 ? c.red : c.text3) : undefined;
                return (
                  <div key={String(k)} style={tile}>
                    <span style={metricLabel}>{k}</span>
                    <div style={{ ...metricValue, color: deltaColor || c.text, marginTop: 1 }}>
                      {numVal === null ? '—' : (
                        <AnimatedCounter
                          value={Math.abs(numVal)}
                          decimals={unit === 'кг' || unit === 'см' ? 1 : 0}
                          duration={400}
                          prefix={isDelta ? (numVal > 0 ? '+' : '') : ''}
                          suffix={` ${unit}`}
                          style={{ ...metricValue, color: deltaColor || c.text }}
                        />
                      )}
                    </div>
                    {insight && <span style={metricDelta}>{insight}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
              {[
                ['Среднее', dispW(distribution?.mean), wUnit],
                ['Медиана', dispW(distribution?.median), wUnit],
                ['Мин/макс', extremes.min && extremes.max ? [dispW(extremes.min.value), dispW(extremes.max.value)] : null, ''],
                ['Серия', streak.current, 'дн'],
                ['Δ нед.', dispW(comparison.delta), wUnit],
                ['Δ 30д', dispW(body.delta30 ?? null), wUnit],
                ['Δ 90д', dispW(body.delta90 ?? null), wUnit],
                ['Аномалии', anomalies.length, ''],
              ].map(([k, v, u]) => {
                let content: React.ReactNode = '—';
                if (Array.isArray(v)) {
                  content = <b style={tnum}>{v[0] !== null ? v[0].toFixed(1) : '—'}/{v[1] !== null ? v[1].toFixed(1) : '—'}</b>;
                } else if (typeof v === 'number' && Number.isFinite(v)) {
                  const decimals = u === 'дн' ? 0 : 1;
                  const isDelta = String(k).startsWith('Δ');
                  const color = isDelta ? (v < 0 ? c.green : v > 0 ? c.red : c.text3) : undefined;
                  content = (
                    <b style={{ color, ...tnum }}>
                      {v < 0 ? '−' : ''}{Math.abs(v).toFixed(decimals)} {u}
                    </b>
                  );
                }
                return (
                  <span key={String(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: c.row, border: `1px solid ${c.cardBorder}`, fontSize: 11, color: c.text2 }}>
                    <span style={{ color: c.text3, fontSize: 10 }}>{k}</span> {content}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Прогресс к цели ── */}
        {goalProgress && (
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <b style={{ fontSize: 14, letterSpacing: '-0.2px' }}>Цель {fmtW(goal, 1)}</b>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ fontSize: 11, color: c.text3 }}>
                  К дате
                  <input
                    type="date"
                    style={{ ...input, width: 140, height: 32, display: 'inline-block', marginLeft: 6 }}
                    value={goalDate}
                    onChange={(e) => setGoalDate(e.target.value)}
                  />
                </label>
                {eta ? (
                  <small style={{ color: c.orange, fontSize: 11 }}>
                    {(weightFit ? (weightFit.slopePerDay * 7 >= 0 ? '+' : '') + (dispW(weightFit.slopePerDay * 7) as number).toFixed(2) : '')} {wUnit}/нед · ETA ≈ {eta.weeks} нед
                  </small>
                ) : (
                  <small style={{ color: c.text3, fontSize: 11 }}>Тренд не направлен к цели</small>
                )}
                {pace && (
                  <small style={{ color: Math.abs(pace.kgPerWeek) >= 0.25 ? c.orange : c.green, fontSize: 11 }}>
                    Нужно {pace.kgPerWeek > 0 ? '+' : ''}{(dispW(pace.kgPerWeek) as number).toFixed(2)} {wUnit}/нед · {pace.days} дн.
                  </small>
                )}
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', marginTop: 12, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: (goalProgress.pct === null ? 0 : Math.max(0, Math.min(100, goalProgress.pct))) + '%',
                  borderRadius: 999,
                  transition: 'width 0.5s ease',
                  background: goalProgress.done ? c.green : goalProgress.pct === null ? c.purple : goalProgress.pct < 0 ? c.red : 'linear-gradient(90deg,#248a3d,#30d158)',
                }}
              />
            </div>
            <small style={{ display: 'block', marginTop: 6, color: c.text3, fontSize: 11 }}>
              {fmtW(goalProgress.start)} → {fmtW(goalProgress.cur)} · прогресс {goalProgress.pct === null ? '—' : goalProgress.pct + '%'}
              {!goalProgress.done && ` · осталось ${fmtW(Math.abs(goal - goalProgress.cur))}`}
            </small>
          </section>
        )}

        {/* ── График ── */}
        <h2 style={sectionHeader}>График{range !== 'all' ? ` · последние ${range} дн` : ''}</h2>
        <section style={card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <button
              style={chip(showMA, c.green)}
              onClick={() => setShowMA(v => !v)}
              aria-pressed={showMA}
            >
              MA 7д
            </button>
            <span style={{ width: 1, height: 18, background: c.hairline }} />
            {FIELDS.map(f => (
              <button
                key={f}
                style={chip(activeChartFields.includes(f), FIELD_COLORS[f] || c.green)}
                onClick={() => toggleChartField(f)}
                aria-pressed={activeChartFields.includes(f)}
              >
                {LABELS[f]}
              </button>
            ))}
          </div>
          <div className="wd-chart-wrap">
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
                if (activeChartFields.includes(f)) setActiveChartFields(prev => prev.filter(x => x !== f));
                else setActiveChartFields(prev => [...prev, f]);
              }}
            />
          </div>
        </section>

        {/* ── Утро vs вечер ── */}
        {(todInsight.morning || todInsight.evening) && (
          <section style={card}>
            <b style={{ fontSize: 13, letterSpacing: '-0.1px' }}>🌅 Утро vs 🌙 Вечер</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 10 }}>
              {[
                ['Утро (среднее)', todInsight.morning?.avg, todInsight.morning?.count],
                ['Вечер (среднее)', todInsight.evening?.avg, todInsight.evening?.count],
              ].map(([k, v, n]) => (
                <div key={String(k)} style={tile}>
                  <span style={metricLabel}>{k}</span>
                  <div style={metricValue}>{typeof v === 'number' ? (dispW(v) as number).toFixed(1) + ' ' + wUnit : '—'}</div>
                  {typeof n === 'number' && <span style={metricDelta}>{n} записей</span>}
                </div>
              ))}
              {todInsight.swing !== null && (
                <div style={tile}>
                  <span style={metricLabel}>Разброс</span>
                  <div style={{ ...metricValue, fontSize: 15, color: Math.abs(todInsight.swing) >= 0.3 ? c.blue : c.text3 }}>
                    {fmtSigned(dispW(todInsight.swing) || 0)} {wUnit}
                  </div>
                  <span style={metricDelta}>
                    {Math.abs(todInsight.swing) >= 0.3
                      ? `вечер в среднем ${todInsight.swing > 0 ? 'выше' : 'ниже'} на ${Math.abs(dispW(todInsight.swing) || 0).toFixed(1)} ${wUnit}`
                      : 'утро ≈ вечер'}
                  </span>
                </div>
              )}
            </div>
            <small style={{ display: 'block', marginTop: 8, fontSize: 11, color: c.text3 }}>
              Разброс «утро/вечер» нормален (еда и вода). Для честного тренда взвешивайтесь в одно и то же время.
            </small>
          </section>
        )}

        {photoPairs && (
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <b style={{ fontSize: 13, letterSpacing: '-0.1px' }}>До / После</b>
              <small style={{ color: c.text3, fontSize: 11 }}>{photoPairs.before.date} → {photoPairs.after.date}</small>
            </div>
            <div
              style={{
                position: 'relative', marginTop: 12, borderRadius: 14, overflow: 'hidden',
                aspectRatio: '3/4', maxHeight: 340, width: '100%', background: '#0c0c0e',
              }}
            >
              <img src={photoPairs.after.photos![0]} alt="после" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <img
                src={photoPairs.before.photos![0]}
                alt="до"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  clipPath: 'inset(0 ' + (100 - comparePos) + '% 0 0)',
                  transition: 'clip-path 0.1s linear',
                }}
              />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: comparePos + '%', width: 2, background: '#fff', opacity: 0.85, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '50%', left: -11, width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: 'translateY(-50%)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ color: '#111', fontSize: 10 }}>⇔</span>
                </div>
              </div>
              <span style={{ position: 'absolute', left: 8, top: 8, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', fontSize: 10, color: '#fff' }}>
                До ({photoPairs.before.date.slice(5)})
              </span>
              <span style={{ position: 'absolute', right: 8, top: 8, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', fontSize: 10, color: '#fff' }}>
                После ({photoPairs.after.date.slice(5)})
              </span>
            </div>
            <input
              type="range" min={0} max={100} value={comparePos}
              onChange={(e) => setComparePos(Number(e.target.value))}
              aria-label="Позиция разделителя до/после"
              style={{ width: '100%', marginTop: 10, accentColor: c.green }}
            />
          </section>
        )}

        {heatmap && (
          <details style={card}>
            <summary style={sum}>
              <span>🗓</span> Календарь веса ({heatmap.cells.flat().filter(Boolean).length} записей)
              <span style={{ marginLeft: 'auto', color: c.text3, fontSize: 11 }}>▾</span>
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginTop: 10 }}>
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                <small key={d} style={{ textAlign: 'center', color: c.text3, fontSize: 9 }}>{d}</small>
              ))}
              {heatmap.cells.flat().map((cell, i) =>
                cell ? (
                  <div
                    key={i}
                    title={`${cell.date}: ${fmtW(cell.value)}`}
                    style={{ aspectRatio: '1', borderRadius: 6, background: `rgba(48,209,88,${(0.12 + cell.pct * 0.85).toFixed(2)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <small style={{ fontSize: 8, color: '#ffffff' }}>{(dispW(cell.value) as number).toFixed(0)}</small>
                  </div>
                ) : (
                  <div key={i} style={{ aspectRatio: '1', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.06)' }} />
                ),
              )}
            </div>
            <small style={{ display: 'block', marginTop: 6, color: c.text3, fontSize: 10 }}>
              Мин {fmtW(heatmap.min)} · Макс {fmtW(heatmap.max)}
            </small>
          </details>
        )}

        {(weekSummaries.length > 0 || monthSummaries.length > 0) && (
          <details style={card}>
            <summary style={sum}>
              <span>📊</span> Сводки по периодам
              <span style={{ marginLeft: 'auto', color: c.text3, fontSize: 11 }}>▾</span>
            </summary>
            {weekSummaries.length > 0 && (
              <>
                <b style={{ fontSize: 11, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Недели</b>
                <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Неделя</th><th style={thStyle}>Записей</th><th style={thStyle}>Средняя</th><th style={thStyle}>Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekSummaries.map((w) => (
                        <tr key={w.weekStart} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: 6 }}>{w.weekStart}</td>
                          <td style={{ padding: 6 }}>{w.count}</td>
                          <td style={{ padding: 6 }}>{(dispW(w.mean) as number).toFixed(1)} {wUnit}</td>
                          <td style={{ padding: 6, color: w.delta === null ? c.text3 : w.delta < 0 ? c.green : c.red }}>
                            {w.delta === null ? '—' : (w.delta > 0 ? '+' : '') + (dispW(w.delta) as number).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {monthSummaries.length > 0 && (
              <>
                <b style={{ fontSize: 11, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginTop: 10 }}>Месяцы</b>
                <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Месяц</th><th style={thStyle}>Записей</th><th style={thStyle}>Средняя</th><th style={thStyle}>Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthSummaries.map((m) => (
                        <tr key={m.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: 6 }}>{m.month}</td>
                          <td style={{ padding: 6 }}>{m.count}</td>
                          <td style={{ padding: 6 }}>{(dispW(m.mean) as number).toFixed(1)} {wUnit}</td>
                          <td style={{ padding: 6, color: m.delta === null ? c.text3 : m.delta < 0 ? c.green : c.red }}>
                            {m.delta === null ? '—' : (m.delta > 0 ? '+' : '') + (dispW(m.delta) as number).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </details>
        )}

        <h2 style={sectionHeader}>Состав тела</h2>
        <WeightDiaryVisuals rows={rows} goal={goal} heightCm={profileHeight} sex={profileSex} />

        {bodyCorrelations.length > 0 && (
          <details style={card}>
            <summary style={sum}>
              <span>🔗</span> Связь веса с замерами ({bodyCorrelations.length})
              <span style={{ marginLeft: 'auto', color: c.text3, fontSize: 11 }}>▾</span>
            </summary>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {bodyCorrelations.map((item) => (
                <span key={item.field} style={{ padding: '5px 12px', borderRadius: 999, background: item.r >= 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)', fontSize: 11, color: c.text2 }}>
                  {LABELS[item.field]}: {item.r > 0 ? '+' : ''}{item.r.toFixed(2)} · n={item.n}
                </span>
              ))}
            </div>
          </details>
        )}

        {anomalies.length > 0 && (
          <details style={card}>
            <summary style={{ ...sum, color: c.orange }}>
              <span>⚠</span> Аномалии ({anomalies.length})
              <span style={{ marginLeft: 'auto', color: c.text3, fontSize: 11 }}>▾</span>
            </summary>
            {anomalies.slice(-5).map((a, i) => (
              <div key={`${a.date}-${i}`} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: c.text2 }}>
                {a.date}: {a.message}
              </div>
            ))}
          </details>
        )}

        {training && (
          <details style={card}>
            <summary style={sum}>
              <span>🏋️</span> Сила и инсайты
              <span style={{ marginLeft: 'auto', color: c.text3, fontSize: 11 }}>▾</span>
            </summary>
            <div style={{ fontSize: 12, marginTop: 6, color: c.text2 }}>
              Последний объём: <b style={{ color: c.text }}>{Math.round(training.volume)}</b>
              {correlation && (
                <span> · связь вес/объём: <b style={{ color: c.text }}>{correlation.r.toFixed(2)}</b> ({correlation.n} пар)</span>
              )}
            </div>
            {training.progress.slice(-4).map((x) => (
              <div key={x.week} style={{ fontSize: 12, padding: '4px 0', color: c.text2 }}>
                Неделя {x.week}: объём {Math.round(x.totalVolume)} · тренировок {x.workoutCount} · 1RM {Math.round(x.total1RM)}
              </div>
            ))}
            {[...training.alerts, ...training.insights].map((x, i) => (
              <div key={i} style={{ color: c.orange, fontSize: 12, padding: '3px 0' }}>• {x}</div>
            ))}
          </details>
        )}

        {/* ── Таблица записей ── */}
        <h2 style={sectionHeader}>Журнал</h2>
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: c.text3 }}>
              Записей: {pageData.total}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button style={btn} onClick={() => setShowCols(v => !v)} aria-expanded={showCols}>
                Колонки ({visibleCols.length})
              </button>
              <button style={btn} onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>←</button>
              <span style={{ fontSize: 11, color: c.text3, ...tnum }}>{page}/{pageData.totalPages}</span>
              <button style={btn} onClick={() => setPage(Math.min(pageData.totalPages, page + 1))} disabled={page >= pageData.totalPages}>→</button>
            </div>
          </div>
          {showCols && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 10, borderRadius: 12, background: c.row, border: `1px solid ${c.cardBorder}`, marginBottom: 10 }}>
              {FIELDS.map(f => {
                const on = visibleCols.includes(f);
                return (
                  <button
                    key={f}
                    style={chip(on, FIELD_COLORS[f] || c.green)}
                    onClick={() => setVisibleCols(prev => (on ? prev.filter(x => x !== f) : [...prev, f]))}
                    aria-pressed={on}
                  >
                    {LABELS[f]}
                  </button>
                );
              })}
            </div>
          )}
          <div className="wd-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(720, 260 + visibleCols.length * 56), fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    <button
                      style={{ background: 'none', border: 'none', color: sort.key === 'date' ? c.green : c.text3, cursor: 'pointer', padding: 2, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}
                      onClick={() => setSort({ key: 'date', dir: sort.key === 'date' && sort.dir === 'asc' ? 'desc' : 'asc' })}
                    >
                      Дата{sort.key === 'date' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                  <th style={thStyle}>Δ</th>
                  {visibleCols.map((f) => (
                    <th key={f} style={thStyle}>
                      <button
                        style={{ background: 'none', border: 'none', color: sort.key === LABELS[f] ? c.green : c.text3, cursor: 'pointer', padding: 2, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}
                        onClick={() => setSort({ key: LABELS[f], dir: sort.key === LABELS[f] && sort.dir === 'asc' ? 'desc' : 'asc' })}
                      >
                        {LABELS[f]}{sort.key === LABELS[f] ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
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
                  const dRow = deltaTone(deltaMap.get(row.date));
                  return (
                    <tr key={row.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td data-label="Дата" style={{ whiteSpace: 'nowrap', color: c.text2 }}>
                        {editing === row.date ? (
                          <input style={input} type="date" value={String(draft.date || row.date)} onChange={(x) => setDraft({ ...draft, date: x.target.value })} />
                        ) : (
                          row.date
                        )}
                      </td>
                      <td data-label="Δ" style={{ whiteSpace: 'nowrap', ...tnum, color: dRow.color, fontWeight: 600 }}>
                        {dRow.text}
                      </td>
                      {visibleCols.map((f) => (
                        <td data-label={LABELS[f]} key={f}>{fieldCell(row, f)}</td>
                      ))}
                      <td data-label="Время" style={{ whiteSpace: 'nowrap' }}>
                        {editing === row.date ? (
                          <select style={input} value={draft.timeOfDay || 'morning'} onChange={(e) => setDraft({ ...draft, timeOfDay: e.target.value as 'morning' | 'evening' })} aria-label="Время суток">
                            <option value="morning">🌅 Утро</option>
                            <option value="evening">🌙 Вечер</option>
                          </select>
                        ) : row.timeOfDay === 'morning' ? '🌅 Утро' : row.timeOfDay === 'evening' ? '🌙 Вечер' : '—'}
                      </td>
                      <td data-label="Заметка">
                        {editing === row.date ? (
                          <input style={input} value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                        ) : (
                          row.notes || '—'
                        )}
                      </td>
                      <td data-label="Фото" style={{ whiteSpace: 'nowrap' }}>
                        {row.photos && row.photos.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {row.photos.map((src, i) => (
                              <img key={i} src={src} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }} onClick={() => setViewPhoto({ src, date: row.date })} />
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Тренд" style={{ whiteSpace: 'nowrap' }}>
                        <TrendSpark row={row} rows={rows} goalDir={goalDir} />
                      </td>
                      <td data-label="Действия" style={{ whiteSpace: 'nowrap' }}>
                        {editing === row.date ? (
                          <>
                            <button style={btn} onClick={saveEdit}>Сохранить</button>{' '}
                            <button style={btn} onClick={() => { setDraft({}); setEditing(null); }}>Отмена</button>
                          </>
                        ) : (
                          <>
                            <button style={btn} onClick={() => beginEdit(row)}>Изменить</button>{' '}
                            <button style={{ ...btn, color: c.red }} onClick={() => commit(rows.filter((r) => r.date !== row.date))}>Удалить</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
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
            style={{ position: 'absolute', top: 16, right: 16, background: '#2c2c2e', border: '1px solid #3a3a3c', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, zIndex: 1 }}
            onClick={() => setViewPhoto(null)}
          >
            ×
          </button>
          <img src={viewPhoto.src} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', bottom: 16, background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: 999, color: '#ffffff', fontSize: 12 }}>
            {viewPhoto.date}
          </div>
        </div>
      )}
    </div>

  );
};
