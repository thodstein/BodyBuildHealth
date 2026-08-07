/**
 * DiaryWindow — полноценное отдельное окно для одного дневника.
 *
 * Открывается как fullscreen overlay (не inline внутри ProfileDiariesTab).
 * Содержит весь функционал: добавление/редактирование/удаление записей,
 * графики, статистика, сравнение, корреляция, экспорт, печать, undo.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { colors } from './ui';
import {
  Modal, DateInput, fieldLabel, fieldInput, btnPrimary, btnGhost, UndoAction,
  AddSleepModal, AddBPModal, AddWeightModal, AddMeasurementsModal,
  AddInjectionModal, AddSymptomModal, AddPainModal, AddNeuroModal,
  AddAcneModal, AddHematoModal, painZoneColor, acneAreaColor,
} from './diary-modals';
import {
  type DiaryKey,
  type DiaryEntryLike,
  type SortState,
  type DiaryGoals,
  defaultGoals,
  computeStreak,
  computePeriodDelta,
  computeExtremes,
  buildSparkline,
  compareWithLastWeek,
  sortEntries,
  paginate,
  crossCorrelation,
  laggedCorrelation,
  dailyCompletion,
  computePace,
  currentStreak,
  computeSummary,
  targetHit,
  detectAnomalies,
  filterByRange,
  computeDistribution,
  getNormalRange,
  classifyValue,
  buildWeeklyHistogram,
  buildHourDistribution,
  exportSvgAsPng,
  exportSvgAsFile,
  todayIso,
} from './diary-helpers';
import { getWeightLog, saveWeightLog, getMeasurementsLog, saveMeasurementsLog } from '../../../engines/profile-store';
import { db } from '../../../core/db';

/* ── Метаданные дневников ── */

const DIARY_META: Record<DiaryKey, { title: string; unit: string; icon: string; color: string; storageKey?: string }> = {
  sleep: { title: 'Сон', unit: 'ч', icon: '💤', color: '#a78bfa', storageKey: 'he_sleep_diary' },
  bp: { title: 'Давление', unit: 'мм рт.ст.', icon: '❤️', color: '#ef4444', storageKey: 'he_bp_diary' },
  weight: { title: 'Вес', unit: 'кг', icon: '⚖️', color: '#22c55e' },
  measurements: { title: 'Замеры тела', unit: 'см', icon: '📏', color: '#3b82f6' },
  injection: { title: 'Инъекции', unit: '', icon: '💉', color: '#f59e0b', storageKey: 'he_injection_diary' },
  symptoms: { title: 'Симптомы', unit: '', icon: '🩺', color: '#ec4899', storageKey: 'he_symptoms_diary' },
  pain: { title: 'Боль в суставах (VAS)', unit: 'балл', icon: '🦴', color: '#22c55e', storageKey: 'he_pain_diary' },
  neuro: { title: 'Нейросимптомы', unit: 'балл', icon: '🧠', color: '#ef4444', storageKey: 'he_neuro_diary' },
  acne: { title: 'Обострения акне', unit: 'балл', icon: '🔴', color: '#f97316', storageKey: 'he_acne_diary' },
  hemato: { title: 'Гематологические симптомы', unit: 'балл', icon: '🩸', color: '#3b82f6', storageKey: 'he_hemato_diary' },
};

/* ── Списки симптомов/зон ── */

const SYMPTOM_PRESETS = [
  'Головная боль', 'Тошнота', 'Бессонница', 'Боль в суставах', 'Отёки',
  'Сыпь', 'Акне', 'Потливание', 'Раздражительность', 'Снижение либидо',
  'Сердцебиение', 'Головокружение', 'Слабость', 'Боль в пояснице', 'Судороги',
];
const PAIN_ZONES = [
  { id: 'shoulders', label: 'Плечи' },
  { id: 'elbows', label: 'Локти' },
  { id: 'wrists', label: 'Запястья' },
  { id: 'lower_back', label: 'Поясница' },
  { id: 'hips', label: 'ТБС' },
  { id: 'knees', label: 'Колени' },
  { id: 'ankles', label: 'Голеностоп' },
];
const NEURO_SYMPTOMS = [
  { id: 'anxiety', label: 'Тревожность' },
  { id: 'insomnia', label: 'Бессонница' },
  { id: 'mood_swings', label: 'Перепады настроения' },
  { id: 'irritability', label: 'Раздражительность' },
  { id: 'headache', label: 'Головная боль' },
  { id: 'low_libido', label: 'Снижение либидо' },
  { id: 'fatigue', label: 'Усталость' },
  { id: 'concentration', label: 'Трудности с концентрацией' },
  { id: 'depression', label: 'Подавленное настроение' },
  { id: 'sweating', label: 'Потливание' },
];
const ACNE_AREAS = [
  { id: 'face', label: 'Лицо' },
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'shoulders_acne', label: 'Плечи' },
];
const HEMATO_SYMPTOMS = [
  { id: 'nosebleeds', label: 'Носовые кровотечения' },
  { id: 'gum_bleeding', label: 'Кровоточивость дёсен' },
  { id: 'bruising', label: 'Синяки без причины' },
  { id: 'headache_h', label: 'Головная боль' },
  { id: 'flushing', label: 'Покраснение лица' },
  { id: 'vision', label: 'Нарушения зрения' },
  { id: 'itching', label: 'Кожный зуд' },
  { id: 'numbness', label: 'Онемение конечностей' },
];
const PAIN_ZONE_COLORS = (v: number) => v <= 2 ? '#22c55e' : v <= 4 ? '#f59e0b' : v <= 7 ? '#f97316' : '#ef4444';
const ACNE_AREA_COLORS = (v: number) => v === 0 ? '#22c55e' : v === 1 ? '#f59e0b' : v === 2 ? '#f97316' : '#ef4444';

/* ── Хранилище дневника ── */

function loadDiary<T>(key: string): T[] {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveDiary<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data.slice(-365))); } catch {}
}
function getEntriesForDiary(key: DiaryKey): any[] {
  if (key === 'weight') return getWeightLog();
  if (key === 'measurements') return getMeasurementsLog();
  const meta = DIARY_META[key];
  if (meta.storageKey) return loadDiary<any>(meta.storageKey);
  return [];
}
function saveEntriesForDiary(key: DiaryKey, data: any[]): void {
  if (key === 'weight') { saveWeightLog(data); return; }
  if (key === 'measurements') { saveMeasurementsLog(data); return; }
  const meta = DIARY_META[key];
  if (meta.storageKey) saveDiary(meta.storageKey, data);
}

/* ── Полноценный SVG-график ── */

const FullChart: React.FC<{
  points: { date: string; value: number }[];
  color: string;
  target?: number | null;
  normalRange?: { low: number; high: number; warnLow?: number; warnHigh?: number } | null;
  yMin?: number | null;
  yMax?: number | null;
  height?: number;
  unit?: string;
  onExportPng?: (svg: SVGSVGElement) => void;
  onExportSvg?: (svg: SVGSVGElement) => void;
}> = ({ points, color, target, normalRange, yMin, yMax, height = 200, unit = '', onExportPng, onExportSvg }) => {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  if (points.length < 1) return <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', padding: 20 }}>Нет данных для графика</div>;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map(p => p.value);
  const PAD = { l: 40, r: 16, t: 20, b: 28 };
  const W = 700, H = height;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  let vMin = yMin !== null && yMin !== undefined ? yMin : Math.min(...values);
  let vMax = yMax !== null && yMax !== undefined ? yMax : Math.max(...values);
  if (normalRange) {
    if (normalRange.warnLow !== undefined && normalRange.warnLow < vMin) vMin = normalRange.warnLow;
    if (normalRange.warnHigh !== undefined && normalRange.warnHigh > vMax) vMax = normalRange.warnHigh;
    if (normalRange.low < vMin) vMin = normalRange.low;
    if (normalRange.high > vMax) vMax = normalRange.high;
  }
  if (target !== null && target !== undefined) {
    if (target < vMin) vMin = target;
    if (target > vMax) vMax = target;
  }
  let range = vMax - vMin;
  if (range === 0) range = Math.max(Math.abs(vMax) * 0.2, 1);
  const padding = range * 0.08;
  vMin -= padding;
  vMax += padding;
  range = vMax - vMin;
  const stepX = sorted.length === 1 ? 0 : innerW / (sorted.length - 1);
  const toX = (i: number) => PAD.l + i * stepX;
  const toY = (v: number) => PAD.t + innerH - ((v - vMin) / range) * innerH;
  const yTicks = 4;
  const yLabels: { y: number; v: number }[] = [];
  for (let i = 0; i <= yTicks; i++) {
    const v = vMin + (range * i) / yTicks;
    yLabels.push({ y: toY(v), v });
  }
  const xLabelStep = Math.max(1, Math.ceil(sorted.length / 8));
  const xLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < sorted.length; i += xLabelStep) {
    const d = new Date(sorted[i].date);
    xLabels.push({ x: toX(i), label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) });
  }
  if (xLabels.length && (sorted.length - 1) % xLabelStep !== 0) {
    const lastD = new Date(sorted[sorted.length - 1].date);
    xLabels.push({ x: toX(sorted.length - 1), label: lastD.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) });
  }
  const pathD = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`).join(' ');
  const yNormalLow = normalRange ? toY(normalRange.low) : null;
  const yNormalHigh = normalRange ? toY(normalRange.high) : null;
  const yWarnLow = normalRange?.warnLow !== undefined ? toY(normalRange.warnLow) : null;
  const yWarnHigh = normalRange?.warnHigh !== undefined ? toY(normalRange.warnHigh) : null;
  return (
    <div style={{ width: '100%' }}>
      {(onExportPng || onExportSvg) && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
          {onExportSvg && <button onClick={() => svgRef.current && onExportSvg(svgRef.current)} style={{ padding: '3px 8px', fontSize: 10, borderRadius: 5, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600 }}>📄 SVG</button>}
          {onExportPng && <button onClick={() => svgRef.current && onExportPng(svgRef.current)} style={{ padding: '3px 8px', fontSize: 10, borderRadius: 5, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a', cursor: 'pointer', fontWeight: 600 }}>🖼 PNG</button>}
        </div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="График значений по датам" style={{ display: 'block' }}>
        {normalRange && yNormalLow !== null && yNormalHigh !== null && (
          <rect x={PAD.l} y={Math.min(yNormalLow, yNormalHigh)} width={innerW} height={Math.abs(yNormalLow - yNormalHigh)} fill="rgba(34,197,94,0.12)" />
        )}
        {normalRange && yWarnHigh !== null && yNormalHigh !== null && (
          <rect x={PAD.l} y={yWarnHigh} width={innerW} height={Math.abs(yWarnHigh - yNormalHigh)} fill="rgba(245,158,11,0.1)" />
        )}
        {normalRange && yWarnLow !== null && yNormalLow !== null && (
          <rect x={PAD.l} y={yNormalLow} width={innerW} height={Math.abs(yWarnLow - yNormalLow)} fill="rgba(245,158,11,0.1)" />
        )}
        {yLabels.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={PAD.l - 6} y={t.y + 3} fontSize="10" fill="rgba(255,255,255,0.6)" textAnchor="end">{t.v.toFixed(Math.abs(t.v) >= 100 ? 0 : 1)}</text>
          </g>
        ))}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        {xLabels.map((l, i) => (
          <text key={`x-${i}`} x={l.x} y={H - 8} fontSize="9" fill="rgba(255,255,255,0.55)" textAnchor="middle">{l.label}</text>
        ))}
        {target !== null && target !== undefined && target >= vMin && target <= vMax && (
          <g>
            <line x1={PAD.l} y1={toY(target)} x2={W - PAD.r} y2={toY(target)} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
            <text x={W - PAD.r - 4} y={toY(target) - 4} fontSize="9" fill="#22c55e" textAnchor="end" fontWeight="700">🎯 цель {target.toFixed(1)}</text>
          </g>
        )}
        {(() => {
          const minV = Math.min(...values);
          const maxV = Math.max(...values);
          const minIdx = values.findIndex(v => v === minV);
          const maxIdx = values.findIndex(v => v === maxV);
          return (
            <>
              {minIdx >= 0 && (
                <g>
                  <circle cx={toX(minIdx)} cy={toY(minV)} r="4" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                  <text x={toX(minIdx)} y={toY(minV) - 8} fontSize="9" fill="#22c55e" textAnchor="middle" fontWeight="700">▼{minV.toFixed(1)}</text>
                </g>
              )}
              {maxIdx >= 0 && maxIdx !== minIdx && (
                <g>
                  <circle cx={toX(maxIdx)} cy={toY(maxV)} r="4" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                  <text x={toX(maxIdx)} y={toY(maxV) - 8} fontSize="9" fill="#ef4444" textAnchor="middle" fontWeight="700">▲{maxV.toFixed(1)}</text>
                </g>
              )}
            </>
          );
        })()}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((p, i) => (
          <circle key={`pt-${i}`} cx={toX(i)} cy={toY(p.value)} r="2.5" fill={color}>
            <title>{`${new Date(p.date).toLocaleDateString('ru-RU')}: ${p.value.toFixed(1)}${unit}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
};

/* ── Модальные окна для добавления записей ── */

// ... (AddSleepModal, AddBPModal, etc. - same as in ProfileDiariesTab)

/* ── Интерфейс DiaryWindow ── */

export interface DiaryWindowProps {
  open: boolean;
  onClose: () => void;
   diaryKey: DiaryKey;
  goals: DiaryGoals;
  onDataChange?: () => void;
}

/* ── Snackbar для undo ── */

let undoTimer: ReturnType<typeof setTimeout> | null = null;

const DiarySnackbar: React.FC<{ action: UndoAction | null; onDismiss: () => void }> = ({ action, onDismiss }) => {
  useEffect(() => {
    if (!action) return;
    if (undoTimer) clearTimeout(undoTimer);
    const remaining = Math.max(0, action.expiresAt - Date.now());
    undoTimer = setTimeout(onDismiss, remaining);
    return () => { if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; } };
  }, [action, onDismiss]);
  if (!action) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 80, zIndex: 2100,
        maxWidth: 480, margin: '0 auto',
        background: '#1f2937', border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 12, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        animation: 'snackbar-in 0.25s ease-out',
      }}
    >
      <span style={{ flex: 1, color: '#fff', fontSize: 13 }}>{action.label}</span>
      <button
        onClick={() => { action.undo(); onDismiss(); }}
        style={{ background: '#60a5fa', border: 'none', color: '#0a0a0a', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 32 }}
      >↩ Отменить</button>
      <button
        onClick={onDismiss}
        aria-label="Закрыть уведомление"
        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', minWidth: 32, minHeight: 32 }}
      >✕</button>
    </div>
  );
};

/* ── Главный компонент DiaryWindow ── */

export const DiaryWindow: React.FC<DiaryWindowProps> = ({ open, onClose, diaryKey, goals, onDataChange }) => {
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const meta = DIARY_META[diaryKey];
  const storageKey = meta.storageKey;
  
  const [entries, setEntries] = useState<any[]>([]);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  /* ── Модальные окна добавления записей ── */
  const [addSleepOpen, setAddSleepOpen] = useState(false);
  const [addBPOpen, setAddBPOpen] = useState(false);
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  const [addMeasurementsOpen, setAddMeasurementsOpen] = useState(false);
  const [addInjectionOpen, setAddInjectionOpen] = useState(false);
  const [addSymptomOpen, setAddSymptomOpen] = useState(false);
  const [addPainOpen, setAddPainOpen] = useState(false);
  const [addNeuroOpen, setAddNeuroOpen] = useState(false);
  const [addAcneOpen, setAddAcneOpen] = useState(false);
  const [addHematoOpen, setAddHematoOpen] = useState(false);
  
  const GOALS_KEY = 'he_diary_goals';
  
  useEffect(() => {
    if (!open) return;
    loadEntries();
  }, [open, diaryKey]);
  
  useEffect(() => {
    if (undoAction) {
      const timer = setTimeout(() => setUndoAction(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [undoAction]);
  
  const loadEntries = () => {
    const data = getEntriesForDiary(diaryKey);
    setEntries([...data].reverse());
  };
  
  const saveEntries = (data: any[]) => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    saveEntriesForDiary(diaryKey, sorted);
    setEntries([...sorted].reverse());
    onDataChange?.();
  };
  
  const pushUndo = (label: string, undo: () => void) => {
    setUndoAction({ label, undo, expiresAt: Date.now() + 5000 });
  };
  
  const addEntry = (entry: any) => {
    const key = storageKey || 'he_diary_' + diaryKey;
    const updated = [...getEntriesForDiary(diaryKey).filter((x: any) => x.date !== entry.date), entry]
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    saveEntriesForDiary(diaryKey, updated);
    setEntries([...updated].reverse());
    onDataChange?.();
  };
  
  const deleteEntry = (date: string) => {
    const orig = entries.find(x => x.date === date);
    if (!orig) return;
    const updated = entries.filter(x => x.date !== date);
    const reverseSorted = [...updated].reverse();
    setEntries(reverseSorted);
    saveEntriesForDiary(diaryKey, [...reverseSorted].reverse());
    pushUndo(`Запись от ${new Date(date).toLocaleDateString('ru-RU')} удалена`, () => {
      const restored = [...reverseSorted, orig].sort((a, b) => a.date.localeCompare(b.date));
      saveEntriesForDiary(diaryKey, restored);
      setEntries([...restored].reverse());
    });
  };
  
  const clearDiary = () => {
    const snapshot = [...entries];
    if (!confirm(`Удалить ВСЕ записи дневника «${meta.title}»?`)) return;
    saveEntriesForDiary(diaryKey, []);
    setEntries([]);
    pushUndo(`🧹 Дневник «${meta.title}» очищен (${snapshot.length})`, () => {
      saveEntriesForDiary(diaryKey, snapshot);
      setEntries([...snapshot].reverse());
    });
  };
  
  const quickAddToday = () => {
    const today = todayIso();
    const existing = entries.find(x => x.date === today);
    if (existing) {
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('ℹ️ Запись за сегодня уже есть');
      }
      return;
    }
    
    let entry: any = { date: today };
    if (diaryKey === 'sleep') {
      entry = { date: today, hours: 7.5, quality: 4, awakenings: 1, bedtime: '23:00', wakeTime: '07:00' };
    } else if (diaryKey === 'bp') {
      entry = { date: today, systolic: 120, diastolic: 80, pulse: 70 };
    } else if (diaryKey === 'symptoms') {
      entry = { date: today, name: 'Нет симптомов', severity: 1 };
    } else if (diaryKey === 'pain') {
      entry = { date: today, zones: {}, totalScore: 0 };
    } else if (diaryKey === 'neuro') {
      entry = { date: today, symptoms: {}, totalScore: 0 };
    } else if (diaryKey === 'acne') {
      entry = { date: today, areas: {}, totalScore: 0 };
    } else if (diaryKey === 'hemato') {
      entry = { date: today, symptoms: {}, totalScore: 0 };
    } else if (diaryKey === 'injection') {
      entry = { date: today, substance: 'Курс', dose: '—', site: 'Дельта' };
    } else if (diaryKey === 'weight') {
      entry = { date: today, weight: goals.weightKg > 0 ? goals.weightKg : 80 };
    } else if (diaryKey === 'measurements') {
      entry = { date: today, waistCm: 0, chestCm: 0, hipCm: 0, bicepCm: 0, thighCm: 0, neckCm: 0, forearmCm: 0, bodyFat: 0 };
    }
    
    const key = storageKey || 'he_diary_' + diaryKey;
    const allEntries = getEntriesForDiary(diaryKey);
    const updated = [...allEntries.filter((x: any) => x.date !== today), entry]
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    saveEntriesForDiary(diaryKey, updated);
    setEntries([...updated].reverse());
    onDataChange?.();
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast('⚡ Запись за сегодня добавлена (откройте для деталей)');
    }
  };
  
  // Build entries with fields for table/display
  const entriesWithFields = useMemo(() => {
    return entries.map(entry => buildEntryFields(diaryKey, entry));
  }, [entries, diaryKey]);
  
  function buildEntryFields(key: DiaryKey, entry: any): DiaryEntryLike {
    if (key === 'sleep') {
      return {
        date: entry.date,
        fields: [
          { label: 'Часы', value: String(entry.hours), unit: 'ч' },
          { label: 'Качество', value: String(entry.quality), unit: '1–5' },
          { label: 'Пробуждений', value: String(entry.awakenings ?? 0), unit: 'раз' },
          { label: 'Легли', value: entry.bedtime || '—', unit: '' },
          { label: 'Подъём', value: entry.wakeTime || '—', unit: '' },
          ...(entry.notes ? [{ label: 'Заметка', value: entry.notes, unit: '' }] : []),
        ],
      };
    }
    if (key === 'bp') {
      return {
        date: entry.date,
        fields: [
          { label: 'Систола', value: String(entry.systolic), unit: 'мм рт.ст.' },
          { label: 'Диастола', value: String(entry.diastolic), unit: 'мм рт.ст.' },
          { label: 'Пульс', value: String(entry.pulse), unit: 'уд/мин' },
          ...(entry.notes ? [{ label: 'Заметка', value: entry.notes, unit: '' }] : []),
        ],
      };
    }
    if (key === 'weight') {
      return {
        date: entry.date,
        fields: [
          { label: 'Вес', value: String(entry.weight), unit: 'кг' },
        ],
      };
    }
    if (key === 'measurements') {
      return {
        date: entry.date,
        fields: DIARY_META.measurements ? [
          { label: 'Талия', value: String(entry.waistCm || 0), unit: 'см' },
          { label: 'Грудь', value: String(entry.chestCm || 0), unit: 'см' },
          { label: 'Бёдра', value: String(entry.hipCm || 0), unit: 'см' },
          { label: 'Бицепс', value: String(entry.bicepCm || 0), unit: 'см' },
          { label: 'Бедро', value: String(entry.thighCm || 0), unit: 'см' },
          { label: 'Шея', value: String(entry.neckCm || 0), unit: 'см' },
          { label: 'Предплечье', value: String(entry.forearmCm || 0), unit: 'см' },
          ...(entry.bodyFat > 0 ? [{ label: '% жира', value: String(entry.bodyFat), unit: '%' }] : []),
        ] : [],
      };
    }
    if (key === 'injection') {
      return {
        date: entry.date,
        fields: [
          { label: 'Препарат', value: entry.substance || '—', unit: '' },
          { label: 'Доза', value: entry.dose || '—', unit: '' },
          { label: 'Место', value: entry.site || '—', unit: '' },
          ...(entry.notes ? [{ label: 'Заметка', value: entry.notes, unit: '' }] : []),
        ],
      };
    }
    if (key === 'symptoms') {
      return {
        date: entry.date,
        fields: [
          { label: 'Симптом', value: entry.name, unit: '' },
          { label: 'Сила', value: '★'.repeat(entry.severity) + '☆'.repeat(5 - entry.severity), unit: `${entry.severity}/5` },
          ...(entry.duration ? [{ label: 'Длительность', value: entry.duration, unit: '' }] : []),
          ...(entry.notes ? [{ label: 'Заметка', value: entry.notes, unit: '' }] : []),
        ],
      };
    }
    if (key === 'pain') {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(entry.zones || {}).forEach(([zoneId, val]) => {
        const z = PAIN_ZONES.find(p => p.id === zoneId);
        if (z && (val as number) > 0) fields.push({ label: z.label, value: String(val), unit: '/10' });
      });
      fields.push({ label: 'Суммарно', value: String(entry.totalScore), unit: '/70' });
      if (entry.notes) fields.push({ label: 'Заметка', value: entry.notes, unit: '' });
      return { date: entry.date, fields };
    }
    if (key === 'neuro') {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(entry.symptoms || {}).filter(([, v]) => v).forEach(([symId]) => {
        const s = NEURO_SYMPTOMS.find(n => n.id === symId);
        if (s) fields.push({ label: s.label, value: 'есть', unit: '' });
      });
      fields.push({ label: 'Симптомов', value: String(entry.totalScore), unit: '/10' });
      if (entry.notes) fields.push({ label: 'Заметка', value: entry.notes, unit: '' });
      return { date: entry.date, fields };
    }
    if (key === 'acne') {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(entry.areas || {}).forEach(([areaId, val]) => {
        const a = ACNE_AREAS.find(x => x.id === areaId);
        if (a && (val as number) > 0) fields.push({ label: a.label, value: String(val), unit: '/3' });
      });
      fields.push({ label: 'Суммарно', value: String(entry.totalScore), unit: '/12' });
      if (entry.notes) fields.push({ label: 'Заметка', value: entry.notes, unit: '' });
      return { date: entry.date, fields };
    }
    if (key === 'hemato') {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(entry.symptoms || {}).filter(([, v]) => v).forEach(([symId]) => {
        const s = HEMATO_SYMPTOMS.find(h => h.id === symId);
        if (s) fields.push({ label: s.label, value: 'есть', unit: '' });
      });
      fields.push({ label: 'Симптомов', value: String(entry.totalScore), unit: '/8' });
      if (entry.notes) fields.push({ label: 'Заметка', value: entry.notes, unit: '' });
      return { date: entry.date, fields };
    }
    return { date: entry.date, fields: [{ label: 'Запись', value: JSON.stringify(entry), unit: '' }] };
  }
  
  const activeEntries = useMemo(() => {
    return filterByRange(entriesWithFields, range);
  }, [entriesWithFields, range]);
  
  const deleteDiaryEntry = (date: string) => {
    deleteEntry(date);
  };
  
  const exportDiaryCSV = () => {
    if (activeEntries.length === 0) return;
    const rows: string[] = [];
    const allLabels = new Set<string>();
    activeEntries.forEach(e => e.fields.forEach(f => allLabels.add(f.label)));
    const labels = Array.from(allLabels);
    rows.push(['Дата', ...labels].join(','));
    activeEntries.forEach(e => {
      const cells: string[] = [e.date];
      labels.forEach(l => {
        const f = e.fields.find(x => x.label === l);
        const v = f ? `${f.value}${f.unit ? ' ' + f.unit : ''}`.replace(/"/g, '""') : '';
        cells.push(`"${v}"`);
      });
      rows.push(cells.join(','));
    });
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diaryKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  
  const printActiveDiary = () => {
    if (activeEntries.length === 0) return;
    const allLabels = Array.from(new Set(activeEntries.flatMap(e => e.fields.map(f => f.label))));
    const summary = computeSummary(diaryKey, activeEntries);
    const summaryHtml = summary ? summary.map(s => `<div class="sum"><div class="muted">${s.label}</div><div class="v" style="color:${s.color}">${s.value}</div></div>`).join('') : '';
    const anomalies = detectAnomalies(diaryKey, activeEntries);
    const anomalyRows = anomalies.length === 0
      ? '<tr><td colspan="3" style="color:#22c55e">Аномалий не выявлено</td></tr>'
      : anomalies.map(a => `<tr><td>${new Date(a.date).toLocaleDateString('ru-RU')}</td><td style="color:${a.severity === 'danger' ? '#ef4444' : '#f59e0b'};font-weight:700">${a.severity === 'danger' ? '⚠️ ВЫСОКИЙ' : '⚠ ВНИМАНИЕ'}</td><td>${a.message}</td></tr>`).join('');
    const stats = computeDistribution(buildSparkline(diaryKey, activeEntries).map(p => p.value));
    const statsHtml = stats ? `
      <div class="stats-grid">
        <div class="sum"><div class="muted">Среднее</div><div class="v">${stats.mean.toFixed(1)}</div></div>
        <div class="sum"><div class="muted">Медиана</div><div class="v">${stats.median.toFixed(1)}</div></div>
        <div class="sum"><div class="muted">σ (SD)</div><div class="v">${stats.stdDev.toFixed(1)}</div></div>
        <div class="sum"><div class="muted">P25</div><div class="v">${stats.p25.toFixed(1)}</div></div>
        <div class="sum"><div class="muted">P75</div><div class="v">${stats.p75.toFixed(1)}</div></div>
        <div class="sum"><div class="muted">Мин / Макс</div><div class="v">${stats.min.toFixed(1)} / ${stats.max.toFixed(1)}</div></div>
      </div>` : '';
    const norm = getNormalRange(diaryKey);
    const normHtml = norm ? `<div class="norm">📏 Норма: ${norm.low}–${norm.high}${norm.unit ? ' ' + norm.unit : ''}. ${norm.description}</div>` : '';
    const target = targetHit(diaryKey, activeEntries, goals);
    const targetHtml = target ? `<div class="target ${target.onTarget ? 'on' : 'off'}">🎯 Цель: ${target.details}${target.onTarget ? ' ✅' : ' ⚠️'}</div>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${meta.title} — отчёт</title>
<style>
@page { size: A4; margin: 14mm; }
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#111;padding:18px;max-width:780px;margin:0 auto;}
h1{color:${meta.color};border-bottom:3px solid ${meta.color};padding-bottom:6px;margin:0 0 8px;font-size:22px;}
h2{color:#333;font-size:14px;margin:16px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px;}
.meta{color:#666;font-size:11px;margin-bottom:14px;}
.summary,.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-bottom:12px;}
.sum{padding:8px;border:1px solid #ddd;border-radius:6px;background:#fafafa;}
.sum .muted{color:#777;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;}
.sum .v{font-size:18px;font-weight:800;margin-top:2px;}
.norm{background:#f0fdf4;border:1px solid #22c55e55;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#166534;}
.target{padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:12px;font-weight:700;}
.target.on{background:#f0fdf4;color:#166534;border:1px solid #22c55e55;}
.target.off{background:#fef3c7;color:#92400e;border:1px solid #f59e0b55;}
table{width:100%;border-collapse:collapse;margin-top:6px;font-size:10px;}
th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #e5e5e5;}
th{background:#f3f3f3;color:#444;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;}
tr:nth-child(even){background:#fafafa;}
.muted{color:#999;font-size:9px;margin-top:12px;text-align:right;}
@media print{body{padding:0;}}
</style></head><body>
<h1>${meta.icon} ${meta.title}</h1>
<div class="meta">📅 Отчёт сформирован: ${new Date().toLocaleString('ru-RU')} · Записей: ${entriesWithFields.length}</div>
${targetHtml}
${normHtml}
${summaryHtml ? `<h2>Сводка</h2><div class="summary">${summaryHtml}</div>` : ''}
${statsHtml ? `<h2>Статистика</h2>${statsHtml}` : ''}
<h2>Записи</h2>
<table><thead><tr><th>Дата</th>${allLabels.map(l => `<th>${l}</th>`).join('')}</tr></thead><tbody>
${activeEntries.map(e => `<tr><td>${new Date(e.date).toLocaleDateString('ru-RU')}</td>${allLabels.map(l => {
      const f = e.fields.find(x => x.label === l);
      return `<td>${f ? f.value + (f.unit ? ' ' + f.unit : '') : '—'}</td>`;
    }).join('')}</tr>`).join('')}
</tbody></table>
<h2>Аномалии и предупреждения</h2>
<table><thead><tr><th>Дата</th><th>Уровень</th><th>Описание</th></tr></thead><tbody>${anomalyRows}</tbody></table>
<div class="muted">BodyBuildHealth · профильные дневники · ${new Date().toLocaleString('ru-RU')}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    } else {
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('⚠ Не удалось открыть окно печати — разрешите всплывающие окна');
      }
    }
  };
  
  if (!open) return null;
  
  const sorted = sortEntries(activeEntries, sort);
  const filtered = searchQuery.trim()
    ? sorted.filter(e => e.date.includes(searchQuery.toLowerCase()) || e.fields.some(f => f.value.toLowerCase().includes(searchQuery.toLowerCase())))
    : sorted;
  const PAGE_SIZE = 8;
  const pageResult = paginate(filtered, page, PAGE_SIZE);
  const color = meta.color;
  
  const summary = computeSummary(diaryKey, activeEntries);
  const period = computePeriodDelta(diaryKey, activeEntries);
  const streak = computeStreak(activeEntries);
  const extremes = computeExtremes(diaryKey, activeEntries);
  const target = targetHit(diaryKey, entriesWithFields, goals);
  const offTarget = target && !target.onTarget;
  const rangeObj = getNormalRange(diaryKey);
  const points = buildSparkline(diaryKey, activeEntries);
  
  const blocks: { label: string; value: string; color: string }[] = [];
  if (streak.totalDays > 0) {
    blocks.push({ label: 'Дней с записями', value: String(streak.totalDays), color });
    blocks.push({ label: 'Серия (текущая)', value: `${streak.current} дн.`, color: streak.current >= 3 ? '#22c55e' : streak.current >= 1 ? colors.warning : colors.textMuted });
    blocks.push({ label: 'Серия (лучшая)', value: `${streak.best} дн.`, color: streak.best >= 7 ? '#22c55e' : streak.best >= 3 ? colors.warning : colors.textMuted });
  }
  if (period) blocks.push(period);
  if (extremes.min && ['sleep', 'weight', 'pain', 'acne', 'neuro', 'hemato'].includes(diaryKey)) {
    blocks.push({ label: 'Минимум', value: `${extremes.min.value.toFixed(1)} · ${new Date(extremes.min.date).toLocaleDateString('ru-RU')}`, color: '#22c55e' });
    blocks.push({ label: 'Максимум', value: `${extremes.max!.value.toFixed(1)} · ${new Date(extremes.max!.date).toLocaleDateString('ru-RU')}`, color: '#ef4444' });
  }
  if (target) blocks.unshift({ label: '🎯 Цель', value: `${target.onTarget ? '✅' : '⚠️'} ${target.details}`, color: target.onTarget ? '#22c55e' : '#f59e0b' });
  if (summary) blocks.push(...summary);

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          background: '#18181b',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => onClose()}
              aria-label="Назад к дневникам"
              style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`, color: colors.text,
              }}
            >← Дневники</button>
            <span style={{ fontSize: 22 }}>{meta.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{meta.title}</div>
              <div style={{ fontSize: 10, color: colors.textMuted }}>{entriesWithFields.length} записей</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => quickAddToday()}
              aria-label="Быстро записать сегодня"
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,230,138,0.14)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a',
              }}
            >⚡ Сегодня</button>
            {entriesWithFields.length > 0 && (
              <>
                <button
                  onClick={() => printActiveDiary()}
                  aria-label="Печать / PDF"
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa',
                  }}
                >📄 PDF / Печать</button>
                <button
                  onClick={exportDiaryCSV}
                  aria-label="Экспорт в CSV"
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa',
                  }}
                >📤 CSV</button>
                <button
                  onClick={clearDiary}
                  aria-label="Очистить весь дневник"
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                  }}
                >🧹 Очистить</button>
              </>
            )}
            {/* Add entry button - right most */}
            <button
              onClick={() => {
                if (diaryKey === 'sleep') setAddSleepOpen(true);
                else if (diaryKey === 'bp') setAddBPOpen(true);
                else if (diaryKey === 'weight') setAddWeightOpen(true);
                else if (diaryKey === 'measurements') setAddMeasurementsOpen(true);
                else if (diaryKey === 'injection') setAddInjectionOpen(true);
                else if (diaryKey === 'symptoms') setAddSymptomOpen(true);
                else if (diaryKey === 'pain') setAddPainOpen(true);
                else if (diaryKey === 'neuro') setAddNeuroOpen(true);
                else if (diaryKey === 'acne') setAddAcneOpen(true);
                else if (diaryKey === 'hemato') setAddHematoOpen(true);
              }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: color, color: '#0a0a0a', border: 'none',
              }}
            >+ Записать</button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '16px', scrollbarWidth: 'thin',
          scrollbarColor: `${colors.border} transparent`,
        }}>
          {/* Toolbar: range filter + search */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            {entriesWithFields.length > 1 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 600 }}>Период:</span>
              {(['all', '7', '30', '90'] as const).map(r => (
                <button key={r} onClick={() => { setRange(r); setPage(1); }} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${range === r ? color : colors.border}`,
                  background: range === r ? `${color}26` : 'rgba(255,255,255,0.03)',
                  color: range === r ? color : colors.textMuted,
                }}>{r === 'all' ? 'Всё время' : `${r} дней`}</button>
              ))}
            </div>
            )}
            <div style={{ flex: 1, minWidth: 140 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="🔍 Поиск по значениям и дате…"
                style={{
                  width: '100%', background: 'rgba(0,0,0,0.3)', border: `1px solid ${colors.border}`,
                  borderRadius: 8, padding: '8px 10px', color: colors.text, fontSize: 12, outline: 'none',
                  boxSizing: 'border-box',
                }}
                aria-label="Поиск в дневнике"
              />
            </div>
          </div>

          {/* Stats cards */}
          {blocks.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, marginBottom: 16 }}>
              {blocks.map((s, i) => (
                <div key={i} style={{ padding: 10, borderRadius: 10, background: `${s.color}1A`, border: `1px solid ${s.color}44` }}>
                  <div style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          {activeEntries.length >= 1 && points.length > 0 && (() => {
            const targetVal = (() => {
              if (diaryKey === 'sleep') return goals.sleepHours > 0 ? goals.sleepHours : null;
              if (diaryKey === 'weight') return goals.weightKg > 0 ? goals.weightKg : null;
              if (diaryKey === 'bp') return goals.systolicTarget > 0 ? goals.systolicTarget : null;
              return null;
            })();
            const unit = meta.unit || '';
            return (
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📈 График по датам</div>
                    {rangeObj && (
                      <div style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 4 }} title={rangeObj.description}>
                        Норма: {rangeObj.low}–{rangeObj.high}{unit ? ' ' + unit : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: colors.textMuted }}>{points.length} точек · {unit}</div>
                </div>
                <FullChart
                  points={points}
                  color={color}
                  target={targetVal}
                  normalRange={rangeObj}
                  unit={unit}
                  height={220}
                  onExportSvg={(svg) => exportSvgAsFile(svg, `${diaryKey}-chart-${todayIso()}.svg`)}
                  onExportPng={(svg) => exportSvgAsPng(svg, `${diaryKey}-chart-${todayIso()}.png`)}
                />
              </div>
            );
          })()}

          {/* Weekly histogram */}
          {activeEntries.length >= 2 && points.length >= 2 && (() => {
            const weeks = buildWeeklyHistogram(points);
            if (weeks.length < 2) return null;
            const maxMean = Math.max(...weeks.map(w => w.mean));
            const minMean = Math.min(...weeks.map(w => w.mean));
            const unit = meta.unit || '';
            return (
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📊 По неделям ({weeks.length})</div>
                  <div style={{ fontSize: 9, color: colors.textMuted }}>Столбик = среднее{unit ? ` ${unit}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110, padding: '4px 0' }}>
                  {weeks.map((w, i) => {
                    const h = maxMean > minMean ? ((w.mean - minMean) / (maxMean - minMean || 1)) * 80 + 15 : 60;
                    const dateLabel = new Date(w.weekStart).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }} title={`Неделя с ${dateLabel}: ${w.count} записей, среднее ${w.mean.toFixed(1)}${unit}, мин ${w.min.toFixed(1)}, макс ${w.max.toFixed(1)}`}>
                        <div style={{ fontSize: 9, color, fontWeight: 700, marginBottom: 2 }}>{w.mean.toFixed(1)}</div>
                        <div style={{
                          width: '100%', maxWidth: 40, height: `${h}px`,
                          background: `linear-gradient(180deg, ${color}, ${color}66)`,
                          borderRadius: '4px 4px 0 0', border: `1px solid ${color}99`,
                          position: 'relative',
                        }}>
                          <div style={{ position: 'absolute', top: 2, left: 0, right: 0, textAlign: 'center', fontSize: 7, color: '#fff', fontWeight: 700 }}>{w.count}</div>
                        </div>
                        <div style={{ fontSize: 7, color: colors.textMuted, marginTop: 3, whiteSpace: 'nowrap' }}>{dateLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Comparison with last week */}
          {activeEntries.length >= 2 && points.length >= 2 && (() => {
            const cmp = compareWithLastWeek(points);
            if (!cmp.thisWeek || !cmp.lastWeek) return null;
            const deltaColor = cmp.better === 'up' ? '#22c55e' : cmp.better === 'down' ? '#ef4444' : colors.textMuted;
            const arrow = cmp.better === 'up' ? '↑' : cmp.better === 'down' ? '↓' : '≈';
            const unit = meta.unit || '';
            return (
              <div style={{ padding: 14, borderRadius: 12, background: `${deltaColor}0d`, border: `1px solid ${deltaColor}55`, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📆 Сравнение с прошлой неделей</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                  <div style={{ padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Эта неделя</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{cmp.thisWeek.mean.toFixed(1)}</div>
                    <div style={{ fontSize: 9, color: colors.textMuted }}>{cmp.thisWeek.count} записей</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: deltaColor }}>{arrow}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>{cmp.delta !== null ? `${cmp.delta > 0 ? '+' : ''}${cmp.delta.toFixed(1)}${unit}` : '—'}</div>
                    {cmp.pct !== null && Math.abs(cmp.pct) >= 0.5 && (
                      <div style={{ fontSize: 9, color: colors.textMuted }}>{cmp.pct > 0 ? '+' : ''}{cmp.pct.toFixed(1)}%</div>
                    )}
                  </div>
                  <div style={{ padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Прошлая</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: colors.textMuted, marginTop: 4 }}>{cmp.lastWeek.mean.toFixed(1)}</div>
                    <div style={{ fontSize: 9, color: colors.textMuted }}>{cmp.lastWeek.count} записей</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Correlation with other diaries */}
          {activeEntries.length >= 5 && points.length >= 5 && (() => {
            const candidates: { key: DiaryKey; label: string; color: string; data: { date: string; value: number }[] }[] = [];
            for (const k of Object.keys(DIARY_META) as DiaryKey[]) {
              if (k === diaryKey) continue;
              const arr = getEntriesForDiary(k);
              const vals = arr.map((e: any) => {
                let v = NaN;
                if (k === 'sleep') v = parseFloat(e.fields?.find((f: any) => f.label === 'Часы')?.value || 'NaN');
                else if (k === 'bp') v = parseFloat(e.fields?.find((f: any) => f.label === 'Систола')?.value || 'NaN');
                else if (k === 'weight') v = parseFloat(e.weight || 'NaN');
                else if (k === 'pain') v = parseFloat(e.totalScore || 'NaN');
                else if (k === 'neuro' || k === 'hemato') v = parseFloat(e.totalScore || 'NaN');
                else if (k === 'acne') v = parseFloat(e.totalScore || 'NaN');
                return { date: e.date, value: v };
              }).filter((p: any) => Number.isFinite(p.value));
              // Для встроенных дневников полей могут быть структурированы иначе
              const rawVals = arr.map((e: any) => {
                let v = NaN;
                if (k === 'sleep') v = e.hours;
                else if (k === 'bp') v = e.systolic;
                else if (k === 'pain') v = e.totalScore;
                else if (k === 'neuro') v = e.totalScore;
                else if (k === 'acne') v = e.totalScore;
                else if (k === 'hemato') v = e.totalScore;
                return { date: e.date, value: v };
              }).filter((p: any) => Number.isFinite(p.value));
              if (rawVals.length >= 3) candidates.push({ key: k, label: DIARY_META[k].title, color: DIARY_META[k].color, data: rawVals });
            }
            const results: { key: DiaryKey; label: string; color: string; r: number; n: number; strength: 'weak' | 'moderate' | 'strong'; positive: boolean; lag: number }[] = [];
            for (const c of candidates) {
              const cc = crossCorrelation(points, c.data);
              if (cc) results.push({ key: c.key, label: c.label, color: c.color, r: cc.r, n: cc.n, strength: cc.strength, positive: cc.positive, lag: 0 });
              if (candidates.length > 0 && results.length < 3) {
                const lag = laggedCorrelation(points, c.data, 1);
                if (lag) results.push({ key: c.key, label: c.label, color: c.color, r: lag.r, n: lag.n, strength: lag.strength, positive: lag.positive, lag: 1 });
              }
            }
            const top = results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 4);
            if (top.length === 0) return null;
            return (
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>🔗 Корреляция с другими дневниками</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
                  {top.map((r, i) => {
                    const sign = r.r > 0 ? '+' : '−';
                    const c = r.r > 0 ? '#22c55e' : '#ef4444';
                    return (
                      <div key={i} style={{ padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: `1px solid ${r.color}33` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.label}</span>
                          <span style={{ fontSize: 9, color: colors.textMuted }}>{r.lag > 0 ? `lag ${r.lag}д` : 'совместно'}</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c, marginTop: 4 }}>{sign}{Math.abs(r.r).toFixed(2)}</div>
                        <div style={{ fontSize: 9, color: colors.textMuted }}>n={r.n} · {r.strength === 'strong' ? '🟢 сильная' : r.strength === 'moderate' ? '🟡 средняя' : '⚪ слабая'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Anomalies */}
          {entriesWithFields.length > 0 && (() => {
            const anomalies = detectAnomalies(diaryKey, activeEntries);
            if (anomalies.length === 0) return null;
            const recent = anomalies.slice(-3);
            return (
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>⚠️ Аномалии ({anomalies.length})</div>
                {recent.map((a, i) => (
                  <div key={i} style={{ fontSize: 10, color: a.severity === 'danger' ? '#ef4444' : '#f59e0b', marginBottom: 2 }}>
                    {a.severity === 'danger' ? '⚠️' : '⚠'} {new Date(a.date).toLocaleDateString('ru-RU')}: {a.message}
                  </div>
                ))}
                {anomalies.length > 3 && <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 2 }}>…и ещё {anomalies.length - 3}</div>}
              </div>
            );
          })()}

          {/* Table */}
          {entriesWithFields.length > 0 && (() => {
            const allLabels = Array.from(new Set(entriesWithFields.flatMap(e => e.fields.map(f => f.label))));
            const sortedEntries = sortEntries(entriesWithFields, sort);
            const filtered = searchQuery.trim()
              ? sortedEntries.filter(e => e.date.includes(searchQuery.toLowerCase()) || e.fields.some(f => f.value.toLowerCase().includes(searchQuery.toLowerCase())))
              : sortedEntries;
            const PAGE_SIZE = 8;
            const pageResult = paginate(filtered, page, PAGE_SIZE);

            return (
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📋 Записи ({pageResult.total})</div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                    placeholder="🔍 Фильтр по дате или значению…"
                    style={{ width: 200, background: 'rgba(0,0,0,0.3)', border: `1px solid ${colors.border}`, borderRadius: 6, padding: '5px 8px', color: colors.text, fontSize: 10, outline: 'none' }}
                    aria-label="Фильтр таблицы"
                  />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr>
                        <th
                          onClick={() => setSort(s => ({ key: 'date', dir: s.key === 'date' && s.dir === 'asc' ? 'desc' : 'asc' }))}
                          style={{ padding: '6px 4px', background: 'rgba(255,255,255,0.05)', borderBottom: `2px solid ${color}`, color: color, textAlign: 'left', cursor: 'pointer', userSelect: 'none', minWidth: 70 }}
                        >📅 Дата{sort.key === 'date' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                        {allLabels.map(l => (
                          <th
                            key={l}
                            onClick={() => setSort(s => ({ key: l, dir: s.key === l && s.dir === 'asc' ? 'desc' : 'asc' }))}
                            style={{ padding: '6px 4px', background: 'rgba(255,255,255,0.05)', borderBottom: `2px solid ${color}`, color: color, textAlign: 'left', cursor: 'pointer', userSelect: 'none', minWidth: 60 }}
                          >{l}{sort.key === l ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                        ))}
                        <th style={{ padding: '6px 4px', background: 'rgba(255,255,255,0.05)', borderBottom: `2px solid ${color}`, color: color, textAlign: 'right', minWidth: 80 }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageResult.pageItems.map(e => {
                        const isEditing = editingDate === e.date;
                        return (
                          <tr key={e.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '5px 4px', color, fontWeight: 700 }}>{new Date(e.date).toLocaleDateString('ru-RU')}</td>
                            {allLabels.map(l => {
                              const field = e.fields.find(f => f.label === l);
                              if (isEditing) {
                                const key2 = `${e.date}::${l}`;
                                return (
                                  <td key={l} style={{ padding: '3px 4px' }}>
                                    <input
                                      type="text"
                                      value={editingValues[key2] !== undefined ? editingValues[key2] : (field?.value || '')}
                                      onChange={e2 => setEditingValues(p => ({ ...p, [key2]: e2.target.value }))}
                                      style={{ width: '100%', minWidth: 50, background: 'rgba(0,0,0,0.4)', border: `1px solid ${color}66`, borderRadius: 4, padding: '3px 5px', color, fontSize: 10, outline: 'none', boxSizing: 'border-box' }}
                                    />
                                  </td>
                                );
                              }
                              const cls = field ? classifyValue(diaryKey, parseFloat(field.value)) : 'unknown';
                              const clsColor = cls === 'normal' ? '#22c55e' : cls === 'warn' ? '#f59e0b' : cls === 'danger' ? '#ef4444' : colors.text;
                              return (
                                <td key={l} style={{ padding: '5px 4px', color: clsColor, fontWeight: cls === 'normal' ? 400 : 700 }}>
                                  {field ? `${field.value}${field.unit ? ' ' + field.unit : ''}` : '—'}
                                </td>
                              );
                            })}
                            <td style={{ padding: '4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {isEditing ? (
                                <>
                                  <button onClick={() => {
                                    // Save inline edit
                                    const list = getEntriesForDiary(diaryKey);
                                    const orig = list.find((x: any) => x.date === e.date);
                                    if (!orig) return;
                                    const updated: any = { ...(orig as any) };
                                    allLabels.forEach(l => {
                                      const field = updated.fields?.find((f: any) => f.label === l);
                                      if (field) field.value = editingValues[`${e.date}::${l}`] || field.value;
                                    });
                                    // Also update direct properties for weight/measurements
                                    if (diaryKey === 'weight') {
                                      const weightField = e.fields.find(f => f.label === 'Вес');
                                      if (weightField) updated.weight = parseFloat(weightField.value);
                                    } else if (diaryKey === 'measurements') {
                                      ['Талия','Грудь','Бёдра','Бицепс','Бедро','Шея','Предплечье','% жира'].forEach((label, i) => {
                                        const field = e.fields.find(f => f.label === label);
                                        if (field) {
                                          const num = parseFloat(field.value);
                                          if (label === 'Талия') updated.waistCm = num;
                                          else if (label === 'Грудь') updated.chestCm = num;
                                          else if (label === 'Бёдра') updated.hipCm = num;
                                          else if (label === 'Бицепс') updated.bicepCm = num;
                                          else if (label === 'Бедро') updated.thighCm = num;
                                          else if (label === 'Шея') updated.neckCm = num;
                                          else if (label === 'Предплечье') updated.forearmCm = num;
                                          else if (label === '% жира') updated.bodyFat = num;
                                        }
                                      });
                                    }
                                    const newList = list.map((x: any) => x.date === e.date ? updated : x);
                                    saveEntriesForDiary(diaryKey, [...newList].sort((a: any, b: any) => a.date.localeCompare(b.date)));
                                    setEntries([...newList].sort((a: any, b: any) => a.date.localeCompare(b.date)).reverse());
                                    setEditingDate(null);
                                    if (typeof window !== 'undefined' && (window as any).showToast) {
                                      (window as any).showToast('✏️ Запись обновлена');
                                    }
                                  }}
                                  style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, background: '#22c55e', color: '#0a0a0a', border: 'none', cursor: 'pointer', fontWeight: 700, marginRight: 4 }}
                                >💾 OK</button>
                                <button onClick={() => setEditingDate(null)} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, background: 'rgba(255,255,255,0.06)', color: colors.text, border: `1px solid ${colors.border}`, cursor: 'pointer' }}>✕</button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      const init: Record<string, string> = {};
                                      e.fields.forEach(f => { init[`${e.date}::${f.label}`] = f.value; });
                                      setEditingValues(init);
                                      setEditingDate(e.date);
                                    }}
                                    aria-label={`Редактировать запись ${e.date}`}
                                    style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'none', cursor: 'pointer', marginRight: 4 }}
                                  >✏️</button>
                                  <button
                                    onClick={() => deleteDiaryEntry(e.date)}
                                    aria-label={`Удалить запись ${e.date}`}
                                    style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer' }}
                                  >🗑</button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {pageResult.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 10, color: colors.textMuted }}>
                    <span>Показано {pageResult.pageStart + 1}–{pageResult.pageEnd} из {pageResult.total}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        style={{ padding: '4px 10px', borderRadius: 5, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: page === 1 ? colors.textMuted : colors.text, border: `1px solid ${colors.border}`, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                      >‹ Назад</button>
                      <span style={{ padding: '4px 8px', color, fontWeight: 700 }}>{page} / {pageResult.totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(pageResult.totalPages, p + 1))}
                        disabled={page === pageResult.totalPages}
                        style={{ padding: '4px 10px', borderRadius: 5, fontSize: 10, background: 'rgba(255,255,255,0.06)', color: page === pageResult.totalPages ? colors.textMuted : colors.text, border: `1px solid ${colors.border}`, cursor: page === pageResult.totalPages ? 'not-allowed' : 'pointer' }}
                      >Вперёд ›</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Empty state */}
          {entriesWithFields.length === 0 && (
            <div style={{ color: colors.textMuted, fontSize: 12, padding: 24, textAlign: 'center' }}>
              Записей пока нет. Нажмите «+ Записать» или «⚡ Сегодня», чтобы внести первую.
            </div>
          )}

          {/* Last entries summary */}
          {entriesWithFields.length > 0 && (
            <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>
              Последние записи
            </div>
          )}
          {entriesWithFields.slice(0, 3).map((entry, i) => (
            <div key={`${entry.date}-${i}`} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{new Date(entry.date).toLocaleDateString('ru-RU')}</span>
                <button
                  onClick={() => deleteEntry(entry.date)}
                  aria-label={`Удалить запись ${new Date(entry.date).toLocaleDateString('ru-RU')}`}
                  style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}
                >🗑</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 4 }}>
                {entry.fields.map((f, fi) => (
                  <div key={fi} style={{ fontSize: 10, color: colors.textMuted }}>
                    <span style={{ color: colors.text }}>{f.value}</span>{f.unit ? ` ${f.unit}` : ''}<span style={{ marginLeft: 4, opacity: 0.7 }}>· {f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      {/* Snackbar for undo */}
      {undoAction && (
        <DiarySnackbar action={undoAction} onDismiss={() => setUndoAction(null)} />
      )}

      {/* ── Модальные окна добавления записей ── */}
      <AddSleepModal open={addSleepOpen} onClose={() => setAddSleepOpen(false)} onSave={addEntry} />
      <AddBPModal open={addBPOpen} onClose={() => setAddBPOpen(false)} onSave={addEntry} />
      <AddWeightModal open={addWeightOpen} onClose={() => setAddWeightOpen(false)} onSave={addEntry} />
      <AddMeasurementsModal open={addMeasurementsOpen} onClose={() => setAddMeasurementsOpen(false)} onSave={addEntry} />
      <AddInjectionModal open={addInjectionOpen} onClose={() => setAddInjectionOpen(false)} onSave={addEntry} />
      <AddSymptomModal open={addSymptomOpen} onClose={() => setAddSymptomOpen(false)} onSave={addEntry} />
      <AddPainModal open={addPainOpen} onClose={() => setAddPainOpen(false)} onSave={addEntry} />
      <AddNeuroModal open={addNeuroOpen} onClose={() => setAddNeuroOpen(false)} onSave={addEntry} />
      <AddAcneModal open={addAcneOpen} onClose={() => setAddAcneOpen(false)} onSave={addEntry} />
      <AddHematoModal open={addHematoOpen} onClose={() => setAddHematoOpen(false)} onSave={addEntry} />
    </div>
    </>
  );
};
