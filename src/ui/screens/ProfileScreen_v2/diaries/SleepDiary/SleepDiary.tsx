import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BoolChip, SliderInput, colors, glassCard, inputStyle } from '../../ui';
import { NativeIcon, type NativeIconName } from '../../../../native/NativeIcons';
import { useDiaryDraft } from '../../diary-modals';
import {
  analyzeAllSleepCorrelations,
  generateCorrelationRecommendations,
  type SleepEntry,
} from '../../../../../engines/sleep-correlation.engine';
import {
  analyzePEDImpactOnSleep,
  generateSleepHygieneNotifications,
  generateSleepReport,
  getSupplementIntakeFromStorage,
  getTrainingDatesFromStorage,
} from '../../../../../engines/sleep-integration.engine';
import {
  avgSleepEfficiency,
  computeSleepRegularity,
  cumulativeSleepDebt,
  recommendedBedtime,
  syncSleepToProfile,
} from '../../../../../engines/sleep-facts.engine';
import {
  buildSleepCalendar,
  buildWeeklyHistogram,
  classifyValue,
  computeDistribution,
  computeExtremes,
  computeSleepScore,
  computeSleepTrends,
  computeStreak,
  computeWeekdayAverages,
  compareWithLastWeek,
  crossCorrelation,
  detectAnomalies,
  exportSvgAsFile,
  exportSvgAsPng,
  filterByRange,
  getNormalRange,
  laggedCorrelation,
  paginate,
  sleepCellLevel,
  sortEntries,
  todayIso,
  type CalendarCell,
  type DiaryEntryLike,
  type SortState,
} from '../../diary-helpers';
import { DiaryHeader } from '../DiaryHeader';
import { readDiaryEntries, saveDiaryEntries } from '../../../../../engines/diary-storage';
import type { DiaryWindowProps } from '../../DiaryWindow';

const KEY = 'he_sleep_diary';
const GOALS_KEY = 'he_sleep_goals';
const ACCENT = '#a78bfa';
const ACCENT_DIM = 'rgba(167,139,250,0.16)';
const ACCENT_BORDER = 'rgba(167,139,250,0.4)';

type RichSleepEntry = SleepEntry & {
  latency?: number;
  caffeineCutoff?: string;
  alcohol?: boolean;
  screenTime?: number;
  stressLevel?: number;
  exerciseTiming?: string;
};
type SleepGoals = {
  targetHours: number;
  targetQuality: number;
  targetLatency: number;
  targetAwakenings: number;
  maxStressLevel: number;
  alcoholDaysPerWeek: number;
};
const defaultGoals: SleepGoals = {
  targetHours: 8,
  targetQuality: 4,
  targetLatency: 20,
  targetAwakenings: 1,
  maxStressLevel: 5,
  alcoholDaysPerWeek: 2,
};

/* ── Общие стили — премиум апгрейд (стекло + глубина) ─────────────── */

const btnBase: React.CSSProperties = {
  minHeight: 40,
  padding: '9px 14px',
  borderRadius: 12,
  border: `1px solid rgba(255,255,255,0.10)`,
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(12px) saturate(140%)',
  WebkitBackdropFilter: 'blur(12px) saturate(140%)',
  color: colors.text,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  boxShadow: '0 2px 10px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
};
const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: ACCENT,
  border: `1px solid ${ACCENT}`,
  color: '#0a0a0f',
  fontWeight: 700,
  boxShadow: '0 4px 18px rgba(167,139,250,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
};
const btnGhost: React.CSSProperties = { ...btnBase, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
const menuItem: React.CSSProperties = {
  ...btnGhost,
  justifyContent: 'flex-start',
  width: '100%',
  minHeight: 38,
  padding: '8px 12px',
  border: 'none',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  background: 'transparent',
  boxShadow: 'none',
};
const chip: React.CSSProperties = {
  minHeight: 32,
  padding: '6px 13px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid rgba(255,255,255,0.10)`,
  background: 'rgba(255,255,255,0.05)',
  backdropFilter: 'blur(10px)',
  color: colors.textMuted,
  fontFamily: 'inherit',
  transition: 'all 0.18s ease',
};
const chipActive: React.CSSProperties = {
  ...chip,
  borderColor: 'rgba(167,139,250,0.55)',
  background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.08))',
  color: ACCENT,
  boxShadow: '0 2px 12px rgba(167,139,250,0.18), inset 0 1px 0 rgba(167,139,250,0.18)',
  fontWeight: 700,
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: ACCENT,
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
      marginBottom: 10,
    }}
  >
    {children}
  </div>
);

const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const safeSet = (key: string, value: unknown, fallbackMsg: string) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if ((window as any).showToast) (window as any).showToast(`⚠️ ${fallbackMsg}`);
  }
};
const save = (entries: RichSleepEntry[]) => {
  const ok = saveDiaryEntries<RichSleepEntry>(KEY, entries, 365);
  if (!ok && (window as any).showToast) (window as any).showToast('⚠️ Не удалось сохранить дневник (хранилище переполнено)');
};
const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c,
  );
const fieldsOf = (e: RichSleepEntry): DiaryEntryLike => ({
  date: e.date,
  fields: [
    ['Часы', e.hours, 'ч'],
    ['Качество', e.quality, '/5'],
    ['Пробуждений', e.awakenings, 'раз'],
    ['Легли', e.bedtime, ''],
    ['Подъём', e.wakeTime, ''],
    ['Латентность', e.latency ?? '', 'мин'],
    ['Кофеин до', e.caffeineCutoff || '', ''],
    ['Алкоголь', e.alcohol ? 'да' : 'нет', ''],
    ['Экран', e.screenTime ?? '', 'мин'],
    ['Стресс', e.stressLevel ?? '', '/10'],
    ['Тренировка', e.exerciseTiming || '', ''],
    ['Заметка', e.notes || '', ''],
  ].map(([label, value, unit]) => ({ label: String(label), value: String(value), unit: String(unit) })),
});

const blankEntry = (source?: Partial<RichSleepEntry>): RichSleepEntry => ({
  date: todayIso(),
  hours: 7.5,
  quality: 4,
  awakenings: 1,
  bedtime: '23:00',
  wakeTime: '07:00',
  notes: '',
  latency: 20,
  caffeineCutoff: '14:00',
  alcohol: false,
  screenTime: 30,
  stressLevel: 5,
  exerciseTiming: '',
  ...source,
});

/* ── Звёзды качества ───────────────────────────────────────────────────── */

const Stars: React.FC<{ value: number; onChange?: (v: number) => void; size?: number }> = ({
  value,
  onChange,
  size = 22,
}) => (
  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        aria-label={`Качество ${n} из 5`}
        onClick={() => onChange?.(n)}
        style={{
          fontSize: size,
          lineHeight: 1,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: onChange ? 'pointer' : 'default',
          color: n <= value ? '#fbbf24' : 'rgba(255,255,255,0.14)',
          textShadow: n <= value ? '0 0 8px rgba(251,191,36,0.35)' : 'none',
        }}
      >
        ★
      </button>
    ))}
    <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 6, minWidth: 26 }}>
      {value}/5
    </span>
  </div>
);

/* ── Форма записи ──────────────────────────────────────────────────────── */

const SLEEP_FORM_DRAFT_KEY = 'he_draft_sleep_inline';

const SleepForm: React.FC<{
  value: RichSleepEntry;
  onCancel: () => void;
  onSave: (entry: RichSleepEntry) => void;
  targetHours?: number;
}> = ({ value, onCancel, onSave, targetHours = 8 }) => {
  // Персистентный черновик: введённое переживает закрытие формы и переключение вкладок.
  const [draft, setDraft, resetDraft] = useDiaryDraft<RichSleepEntry>(SLEEP_FORM_DRAFT_KEY, () => value);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof RichSleepEntry, val: string | number | boolean) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  const timeRe = /^\d{2}:\d{2}$/;
  const isValidTime = (t: unknown) => typeof t === 'string' && timeRe.test(t) && (() => { const [hh, mm] = t.split(':').map(Number); return hh >= 0 && hh < 24 && mm >= 0 && mm < 60; })();
  const submit = () => {
    const h = Number(draft.hours);
    if (!draft.date) return setError('Укажите дату');
    if (!Number.isFinite(h) || h < 0 || h > 24) return setError('Часы сна: число от 0 до 24');
    if (!Number.isFinite(Number(draft.quality)) || draft.quality < 1 || draft.quality > 5)
      return setError('Качество: оценка от 1 до 5');
    const lat = Number(draft.latency);
    if (draft.latency !== undefined && draft.latency !== null && (!Number.isFinite(lat) || lat < 0 || lat > 300))
      return setError('Засыпание: число минут от 0 до 300');
    const aw = Number(draft.awakenings);
    if (draft.awakenings !== undefined && draft.awakenings !== null && (!Number.isFinite(aw) || aw < 0 || aw > 20))
      return setError('Пробуждений: 0–20');
    const st = Number(draft.screenTime);
    if (draft.screenTime !== undefined && draft.screenTime !== null && (!Number.isFinite(st) || st < 0 || st > 600))
      return setError('Экран: 0–600 мин');
    if (draft.caffeineCutoff && !isValidTime(draft.caffeineCutoff)) return setError('Кофеин до: формат ЧЧ:ММ');
    if (draft.bedtime && !isValidTime(draft.bedtime)) return setError('Легли: формат ЧЧ:ММ');
    if (draft.wakeTime && !isValidTime(draft.wakeTime)) return setError('Подъём: формат ЧЧ:ММ');
    setError(null);
    onSave({
      ...draft,
      hours: h,
      quality: Number(draft.quality),
      awakenings: Math.max(0, Number(draft.awakenings) || 0),
      latency: Math.max(0, Number(draft.latency) || 0),
      screenTime: Math.max(0, Number(draft.screenTime) || 0),
      stressLevel: Math.min(10, Math.max(1, Number(draft.stressLevel) || 5)),
      notes: draft.notes?.trim() || '',
    });
    resetDraft();
  };

  const numField = (label: string, key: keyof RichSleepEntry, extra: Record<string, string> = {}) => (
    <label style={{ display: 'grid', gap: 5, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
      {label}
      <input
        style={{ ...inputStyle, width: '100%' }}
        type="number"
        value={String(draft[key] ?? '')}
        onChange={(e) => set(key, Number(e.target.value))}
        {...extra}
      />
    </label>
  );
  const timeField = (label: string, key: keyof RichSleepEntry) => (
    <label style={{ display: 'grid', gap: 5, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
      {label}
      <input
        style={{ ...inputStyle, width: '100%' }}
        type="time"
        value={String(draft[key] ?? '')}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );

  return (
    <section style={{ ...glassCard, margin: '14px 0', border: `1px solid ${ACCENT_BORDER}` }}>
      <SectionTitle>{value.date ? '✏️ Запись сна' : '➕ Новая запись'}</SectionTitle>
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <SectionTitle>Основное</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
              Дата
              <input
                style={{ ...inputStyle, width: '100%' }}
                type="date"
                value={draft.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </label>
            {numField('Часы сна', 'hours', { min: '0', max: '24', step: '0.5' })}
            {numField('Пробуждений', 'awakenings', { min: '0' })}
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
              Качество
              <div style={{ minHeight: 38, display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}>
                <Stars value={Number(draft.quality) || 0} onChange={(v) => set('quality', v)} size={26} />
              </div>
            </label>
          </div>
        </div>

        <div>
          <SectionTitle>Режим</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {timeField('Легли', 'bedtime')}
            {timeField('Подъём', 'wakeTime')}
            {numField('Засыпание, мин', 'latency', { min: '0', max: '300' })}
            {timeField('Кофеин до', 'caffeineCutoff')}
          </div>
        </div>

        <div>
          <SectionTitle>Факторы</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {numField('Экран перед сном, мин', 'screenTime', { min: '0' })}
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
              Время тренировки
              <input
                style={{ ...inputStyle, width: '100%' }}
                type="text"
                value={String(draft.exerciseTiming || '')}
                onChange={(e) => set('exerciseTiming', e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <BoolChip checked={!!draft.alcohol} onChange={(v) => set('alcohol', v)} label="Алкоголь" color="#f87171" />
            </div>
          </div>
          <div style={{ marginTop: 12, maxWidth: 420 }}>
            <SliderInput
              value={Number(draft.stressLevel) || 5}
              onChange={(v) => set('stressLevel', v)}
              min={1}
              max={10}
              step={1}
              label="Стресс за день"
              color="#f59e0b"
              minLabel="спокойный день, без напряжения"
              maxLabel="сильный стресс, на пределе"
            />
          </div>
        </div>

        <label style={{ display: 'grid', gap: 5, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
          Заметки
          <textarea
            style={{ ...inputStyle, width: '100%', minHeight: 80, resize: 'vertical' }}
            value={draft.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>

        {error && (
          <div
            role="alert"
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              background: colors.dangerDim,
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(167,139,250,0.07)',
            border: `1px solid ${ACCENT_BORDER}`,
            fontSize: 12,
            color: colors.textMuted,
          }}
        >
          <b style={{ color: ACCENT, fontWeight: 700 }}>Итог:</b>
          <span style={{ fontWeight: 800, color: Number(draft.hours) >= targetHours ? '#34d399' : '#fbbf24' }}>
            💤 {Number(draft.hours) || '—'} ч
          </span>
          <span>⭐ {Number(draft.quality) || '—'}/5</span>
          {draft.bedtime && draft.wakeTime && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><NativeIcon name="moon" size={12} /> {draft.bedtime}–{draft.wakeTime}</span>}
          {Number(draft.latency) > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><NativeIcon name="clock" size={12} /> {Number(draft.latency)} мин</span>}
          {draft.alcohol && <span style={{ color: '#f87171' }}>🍷 алкоголь</span>}
          {Number(draft.stressLevel) >= 7 && <span style={{ color: '#f87171' }}>😣 стресс {draft.stressLevel}/10</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...btnPrimary, display:'inline-flex', alignItems:'center', gap:6 }} onClick={submit}>
            <NativeIcon name="check" size={13} /> Сохранить
          </button>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </section>
  );
};

/* ── Карточки-виджеты ──────────────────────────────────────────────────── */

const StatCard: React.FC<{ icon: NativeIconName; label: string; value: string; color: string; hint?: string }> = ({
  icon,
  label,
  value,
  color,
  hint,
}) => (
  <div
    className="diary-card"
    style={{
      ...glassCard,
      padding: 13,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 0,
      background: `linear-gradient(135deg, ${color}10, transparent 68%), ${String((glassCard.background as string) || 'rgba(28,28,32,0.72)')}`,
      boxShadow: `0 8px 22px rgba(0,0,0,0.24), 0 2px 10px ${color}14, inset 0 1px 0 rgba(255,255,255,0.06)`,
      borderLeft: `2px solid ${color}88`,
      borderTop: `1px solid rgba(255,255,255,0.07)`,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(420px 120px at 18% 0%, ${color}14, transparent 62%)`,
        pointerEvents: 'none',
      }}
    />
    <div style={{ color, position: 'relative' }}><NativeIcon name={icon} size={16} /></div>
    <small style={{ fontSize: 10, color: 'rgba(255,255,255,0.44)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', position: 'relative' }}>
      {label}
    </small>
    <strong style={{ fontSize: 21, fontWeight: 800, color, lineHeight: 1.1, letterSpacing: '-0.3px', position: 'relative' }}>{value}</strong>
    {hint && <small style={{ fontSize: 10, color: 'rgba(255,255,255,0.42)', position: 'relative' }}>{hint}</small>}
  </div>
);

const ScoreRing: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const R = 42;
  const C = 2 * Math.PI * R;
  const ringColor = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';
  return (
    <svg viewBox="0 0 100 100" width="116" height="116" role="img" aria-label={`Балл сна: ${score} из 100`}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={R}
        fill="none"
        stroke={ringColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(C * Math.max(0, Math.min(100, score))) / 100} ${C}`}
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="26" fontWeight="800">
        {score}
      </text>
      <text x="50" y="72" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.45)" fontSize="9">
        {label}
      </text>
    </svg>
  );
};

/* ── Основной экран ────────────────────────────────────────────────────── */

export const SleepDiary: React.FC<DiaryWindowProps> = ({ open, onClose, goals: profileGoals, onDataChange }) => {
  const [rows, setRows] = useState<RichSleepEntry[]>(() => read(KEY, []).map(blankEntry));
  const [goals, setGoals] = useState<SleepGoals>(() => ({
    ...defaultGoals,
    targetHours: profileGoals.sleepHours || defaultGoals.targetHours,
    ...read(GOALS_KEY, {}),
  }));
  const [form, setForm] = useState<RichSleepEntry | null>(null);
  /** Открыть форму: при РЕДАКТИРОВАНИИ существующей записи сбрасываем персистентный
   *  черновик (иначе подхватится ввод прошлого раза); для новой — черновик сохраняется. */
  const openSleepForm = (source: RichSleepEntry, isEdit: boolean) => {
    if (isEdit) {
      try {
        sessionStorage.removeItem(SLEEP_FORM_DRAFT_KEY);
      } catch {}
    }
    setForm(source);
  };
  const [undo, setUndo] = useState<RichSleepEntry[] | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [showGoals, setShowGoals] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const commit = (next: RichSleepEntry[], remember = true) => {
    if (remember) setUndo(rows);
    save(next);
    setRows([...next].sort((a, b) => b.date.localeCompare(a.date)));
    onDataChange?.();
  };

  useEffect(() => {
    if (!open) return;
    try {
      syncSleepToProfile(rows);
    } catch {
      /* профиль-синк не должен ронять дневник */
    }
  }, [rows, open]);
  const add = (entry: RichSleepEntry) => {
    const existing = rows.find((r) => r.date === entry.date);
    if (existing) {
      const same =
        existing.hours === entry.hours &&
        existing.quality === entry.quality &&
        existing.awakenings === entry.awakenings &&
        existing.bedtime === entry.bedtime &&
        existing.wakeTime === entry.wakeTime &&
        existing.notes === entry.notes &&
        existing.latency === entry.latency &&
        existing.alcohol === entry.alcohol;
      if (!same && !window.confirm(`Запись от ${entry.date} уже существует (${existing.hours} ч). Заменить её?`)) return;
    }
    commit([entry, ...rows.filter((r) => r.date !== entry.date)]);
    setForm(null);
  };

  const entries = useMemo(() => rows.map(fieldsOf), [rows]);
  const rangeEntries = useMemo(() => filterByRange(entries, range), [entries, range]);
  const active = useMemo(() => {
    let result = rangeEntries;
    const q = query.trim().toLowerCase();
    if (q) result = result.filter((e) => e.date.includes(q) || e.fields.some((f) => f.value.toLowerCase().includes(q)));
    return sortEntries(result, sort);
  }, [rangeEntries, query, sort]);
  const pageData = paginate(active, page, 8);

  const rangeDateSet = useMemo(() => new Set(rangeEntries.map((e) => e.date)), [rangeEntries]);
  const points = rows.filter((r) => rangeDateSet.has(r.date)).map((r) => ({ date: r.date, value: r.hours }));
  const dist = computeDistribution(points.map((p) => p.value));
  const extremes = computeExtremes('sleep', rangeEntries);
  const streak = computeStreak(rangeEntries);
  const anomalies = detectAnomalies('sleep', rangeEntries);
  const weeks = buildWeeklyHistogram(points);
  const comparison = compareWithLastWeek(points);
  const normal = getNormalRange('sleep');
  const score = useMemo(() => computeSleepScore(rangeEntries, goals), [rangeEntries, goals]);
  const trends = useMemo(() => computeSleepTrends(rangeEntries), [rangeEntries]);
  const weekdayAvg = useMemo(() => computeWeekdayAverages(rangeEntries), [rangeEntries]);
  const calendar = useMemo(() => buildSleepCalendar(entries, 60), [entries]);

  const diaryCorrelations = useMemo(() => {
    const readPoints = (key: string, valueKey: string) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(raw)
          ? raw
              .map((entry) => {
                // UnifiedHealthEntry хранит боль вложенно (pain.totalScore), legacy — на корне
                const value = key === 'he_health_diary'
                  ? Number((entry as any)?.pain?.totalScore ?? (entry as any)?.totalScore)
                  : Number(entry[valueKey]);
                return { date: String(entry.date || ''), value };
              })
              .filter((p) => p.date && Number.isFinite(p.value))
          : [];
      } catch {
        return [];
      }
    };
    const candidates = [
      ['Вес', readPoints('he_weight_log', 'weight')],
      ['Систолическое АД', readPoints('he_bp_diary', 'systolic')],
      ['Боль', readPoints('he_health_diary', 'totalScore')],
    ] as const;
    return candidates
      .flatMap(([label, data]) => {
        const same = crossCorrelation(points, data);
        const lagged = laggedCorrelation(points, data, 1);
        return [same && { label, ...same, lag: 0 }, lagged && { label, ...lagged, lag: 1 }].filter(Boolean) as Array<{
          label: string;
          r: number;
          n: number;
          strength: string;
          lag: number;
        }>;
      })
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 6);
  }, [points]);

  const recent = useMemo(() => rows.slice(0, 7), [rows]);
  const debtCalc = useMemo(() => cumulativeSleepDebt(rows, goals.targetHours, 7), [rows, goals.targetHours]);
  const debt = debtCalc.debt;
  const avgQuality = useMemo(() => recent.length ? recent.reduce((n, r) => n + r.quality, 0) / recent.length : 0, [recent]);
  const efficiency = useMemo(() => avgSleepEfficiency(rows, 30), [rows]);
  const regularity = useMemo(() => computeSleepRegularity(rows, 14), [rows]);
  const lastWake = rows[0]?.wakeTime;
  const bedtimeRec = useMemo(() => lastWake ? recommendedBedtime(lastWake, goals.targetHours) : null, [lastWake, goals.targetHours]);

  const correlations = useMemo(() => analyzeAllSleepCorrelations({
    sleepDiary: rows,
    trainingDates: getTrainingDatesFromStorage(90),
    supplementIntake: getSupplementIntakeFromStorage(90),
  }), [rows]);
  const recommendations = useMemo(() => generateCorrelationRecommendations(correlations), [correlations]);
  const hygiene = useMemo(() => generateSleepHygieneNotifications(rows), [rows]);
  const ped = useMemo(() => analyzePEDImpactOnSleep(rows, getSupplementIntakeFromStorage(90)), [rows]);

  const exportCsv = () => {
    const headers = [
      'Дата', 'Часы', 'Качество', 'Пробуждений', 'Легли', 'Подъём', 'Латентность', 'Кофеин',
      'Алкоголь', 'Экран', 'Стресс', 'Тренировка', 'Заметки',
    ];
    // Защита от формульной инъекции (Excel): префикс «'» для полей, начинающихся с = + - @.
    const csvCell = (v: unknown) => {
      const s = String(v ?? '');
      const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${guarded.replace(/"/g, '""')}"`;
    };
    const csv = [
      headers,
      ...rows.map((r) => [
        r.date, r.hours, r.quality, r.awakenings, r.bedtime, r.wakeTime, r.latency ?? '',
        r.caffeineCutoff || '', r.alcohol ? 'да' : 'нет', r.screenTime ?? '', r.stressLevel ?? '',
        r.exerciseTiming || '', r.notes || '',
      ]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `sleep-${todayIso()}.csv`;
    a.click();
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const report = generateSleepReport(rows, { targetHours: goals.targetHours, targetQuality: goals.targetQuality });
    w.document.write(
      `<html><head><title>Дневник сна</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:5px;text-align:left}</style></head><body><h1>💤 Дневник сна</h1><pre>${escapeHtml(report)}</pre><table><tr><th>Дата</th><th>Часы</th><th>Качество</th><th>Проб.</th><th>Латентность</th><th>Стресс</th><th>Заметки</th></tr>${rows.map((r) => `<tr><td>${escapeHtml(r.date)}</td><td>${r.hours}</td><td>${r.quality}</td><td>${r.awakenings}</td><td>${r.latency ?? ''}</td><td>${r.stressLevel ?? ''}</td><td>${escapeHtml(r.notes)}</td></tr>`).join('')}</table></body></html>`,
    );
    w.document.close();
    w.print();
  };

  if (!open) return null;

  const changeSort = (key: string) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  /* ── Геометрия графика (часы + качество) ── */
  const G = { w: 640, h: 240, padL: 44, padR: 56, padT: 14, padB: 26 };
  const innerW = G.w - G.padL - G.padR;
  const innerH = G.h - G.padT - G.padB;
  const yMaxH = 12;
  const hourTicks = [0, 2, 4, 6, 8, 10, 12];
  const sortedPoints = points.slice().sort((a, b) => a.date.localeCompare(b.date));
  const x = (i: number) => G.padL + (sortedPoints.length > 1 ? (i * innerW) / (sortedPoints.length - 1) : innerW / 2);
  const yH = (v: number) => G.padT + innerH - (Math.min(v, yMaxH) / yMaxH) * innerH;
  const yQ = (v: number) => G.padT + innerH - ((v - 1) / 4) * innerH;
  const hoursPath = sortedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yH(p.value).toFixed(1)}`).join(' ');
  const areaPath =
    sortedPoints.length >= 2
      ? `${hoursPath} L${x(sortedPoints.length - 1).toFixed(1)},${yH(0).toFixed(1)} L${x(0).toFixed(1)},${yH(0).toFixed(1)} Z`
      : '';
  const qualityPoints = sortedPoints
    .map((p) => ({ date: p.date, q: rows.find((r) => r.date === p.date)?.quality ?? null }))
    .filter((p) => p.q !== null) as { date: string; q: number }[];
  const qualityPath = qualityPoints
    .map((p, i) => {
      const t = sortedPoints.findIndex((s) => s.date === p.date);
      return `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)},${yQ(p.q).toFixed(1)}`;
    })
    .join(' ');

  /* ── Календарь: группировка по неделям (Пн–Вс) ── */
  const calWeeks: CalendarCell[][] = [];
  for (let i = 0; i < calendar.length; i += 7) calWeeks.push(calendar.slice(i, i + 7));
  const cellColor: Record<string, string> = {
    none: 'rgba(255,255,255,0.045)',
    bad: '#ef4444',
    low: '#f97316',
    good: ACCENT,
    great: '#34d399',
    high: '#3b82f6',
  };

  const avgColor = classifyValue('sleep', dist?.mean ?? 0);
  const meanStatColor = avgColor === 'normal' ? '#34d399' : avgColor === 'warn' ? '#fbbf24' : '#f87171';
  const weekdayHasData = weekdayAvg.some((d) => d.count > 0);

  return (
    <div
      className="sleep-window diary-scrollbar"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background:
          'radial-gradient(1000px 560px at 14% -12%, rgba(167,139,250,0.16), transparent 64%), radial-gradient(820px 480px at 100% -6%, rgba(56,189,248,0.09), transparent 58%), radial-gradient(900px 520px at 50% 118%, rgba(139,92,246,0.06), transparent 62%), #08080a',
        color: colors.text,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
    >
      <style>{`
        .sleep-window button { font-family: inherit; }
        .sleep-window::-webkit-scrollbar { width: 10px; }
        .sleep-window::-webkit-scrollbar-track { background: transparent; }
        .sleep-window::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 5px; }
        .sleep-window::-webkit-scrollbar-thumb:hover { background: rgba(167,139,250,0.4); }
        .sleep-table { width: 100%; border-collapse: collapse; }
        .sleep-table th { text-align: left; padding: 9px 8px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.12); font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: rgba(255,255,255,0.55); white-space: nowrap; }
        .sleep-table th:hover { color: ${ACCENT}; }
        .sleep-table td { padding: 9px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
        .sleep-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.02); }
        .sleep-table tbody tr:hover { background: rgba(167,139,250,0.07); }
        .sleep-heat { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .sleep-heat:hover { transform: scale(1.18); box-shadow: 0 0 0 2px rgba(255,255,255,0.18); position: relative; z-index: 1; }
        .sleep-window [id^="sleep-"] { scroll-margin-top: 68px; }
        @media (hover: none) and (pointer: coarse) {
          .sleep-window button { min-height: 44px; }
          .sleep-window input, .sleep-window textarea, .sleep-window select { font-size: 16px; }
        }
        @media (max-width: 620px) {
          .sleep-stats { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .sleep-score-wrap { flex-direction: column !important; }
        }
      `}</style>

      <DiaryHeader
        accent={ACCENT}
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><NativeIcon name="moon" size={18} /> Сон</span>}
        count={rows.length}
        onClose={onClose}
        onAdd={() => openSleepForm(blankEntry(), false)}
        onToday={() => {
          const today = todayIso();
          const existing = rows.find((r) => r.date === today);
          openSleepForm(existing ? { ...existing } : blankEntry(), !!existing);
        }}
        undoActive={!!undo}
        onUndo={() => { if (!undo) return; commit(undo, false); setUndo(null); }}
        exportActions={[
          { label: '📥 CSV-файл', onClick: exportCsv },
          { label: '🖨 Печать / PDF', onClick: print },
          { label: '📈 График SVG', onClick: () => { if (svgRef.current) exportSvgAsFile(svgRef.current, `sleep-${todayIso()}.svg`); } },
          { label: '🖼 График PNG', onClick: () => { if (svgRef.current) exportSvgAsPng(svgRef.current, `sleep-${todayIso()}.png`); } },
          { label: '🗑 Очистить дневник', onClick: () => { if (window.confirm('Очистить дневник сна? Это действие нельзя отменить.')) commit([]); }, danger: true },
        ]}
      />

      <main style={{ padding: '16px 16px 72px', maxWidth: 1100, margin: 'auto' }}>
        {form && <SleepForm value={form} onCancel={() => setForm(null)} onSave={add} targetHours={goals.targetHours} />}

        {/* Фильтры */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {(['all', '7', '30', '90'] as const).map((r) => (
            <button
              key={r}
              style={range === r ? chipActive : chip}
              onClick={() => {
                setRange(r);
                setPage(1);
              }}
            >
              {r === 'all' ? 'Всё время' : `${r} дней`}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, width: 200, minHeight: 38, paddingRight: query ? 30 : undefined }}
              placeholder="🔍 Поиск"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setPage(1); }}
                aria-label="Очистить поиск"
                style={{
                  position: 'absolute',
                  right: 6,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button style={chip} onClick={() => changeSort('date')}>
            ↕ Дата
          </button>
        </div>

        {/* Навигация по блокам */}
        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              ['📈', 'График'],
              ['🗓', 'Хитмап'],
              ['📊', 'Тренды'],
              ['🧠', 'Инсайты'],
              ['📋', 'Таблица'],
            ].map(([icon, label]) => (
              <button
                key={label as string}
                style={{ ...chip, fontSize: 11 }}
                onClick={() => {
                  const id = label === 'График' ? 'sleep-chart' : label === 'Хитмап' ? 'sleep-calendar' : label === 'Тренды' ? 'sleep-trends' : label === 'Инсайты' ? 'sleep-insights' : 'sleep-table';
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        )}

        {/* Сегодня */}
        {(() => {
          const today = todayIso();
          const todays = rows.find((r) => r.date === today);
          const hColor = todays ? (todays.hours >= goals.targetHours ? '#34d399' : todays.hours >= 6 ? '#fbbf24' : '#f87171') : colors.textMuted;
          return (
            <section
              style={{
                ...glassCard,
                marginBottom: 12,
                padding: 14,
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                flexWrap: 'wrap',
                border: `1px solid ${ACCENT_BORDER}`,
                background: 'linear-gradient(120deg, rgba(167,139,250,0.12), rgba(56,189,248,0.05) 55%, transparent)',
              }}
            >
              <div style={{ fontSize: 34, lineHeight: 1 }}>🌙</div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Сегодня
                </div>
                {todays ? (
                  <>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                      <b style={{ fontSize: 26, fontWeight: 800, color: hColor }}>{todays.hours} ч</b>
                      <Stars value={todays.quality} size={15} />
                      <span style={{ color: colors.textMuted, fontSize: 13 }}>🛌 {todays.bedtime}–{todays.wakeTime}</span>
                      {todays.latency !== undefined && (
                        <span style={{ color: colors.textMuted, fontSize: 13 }}>🕐 {todays.latency} мин</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSubtle, marginTop: 2 }}>
                      {todays.hours >= goals.targetHours
                        ? '✓ Цель по часам достигнута'
                        : todays.hours >= 6
                          ? 'Чуть меньше цели — можно лечь пораньше'
                          : 'Мало сна — попробуйте лечь на час раньше'}
                    </div>
                    {bedtimeRec && (
                      <div style={{ fontSize: 12, color: ACCENT, marginTop: 2, fontWeight: 700 }}>
                        🌜 Чтобы встать в {todays.wakeTime}, ложитесь в {bedtimeRec}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>Запись за сегодня отсутствует</div>
                    <div style={{ fontSize: 12, color: colors.textSubtle, marginTop: 2 }}>
                      Добавьте сон — статистика и тренды обновятся мгновенно
                    </div>
                    {bedtimeRec && lastWake && (
                      <div style={{ fontSize: 12, color: ACCENT, marginTop: 2, fontWeight: 700 }}>
                        🌜 Чтобы встать в {lastWake}, ложитесь в {bedtimeRec}
                      </div>
                    )}
                  </>
                )}
              </div>
              <button style={todays ? btnBase : btnPrimary} onClick={() => openSleepForm(todays ? { ...todays } : blankEntry(), !!todays)}>
                {todays ? '✏️ Изменить' : '+ Записать сегодня'}
              </button>
            </section>
          );
        })()}

        {/* Статистика */}
        <div className="sleep-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 12 }}>
          <StatCard icon="moon" label="Среднее" value={dist ? `${dist.mean.toFixed(1)} ч` : '—'} color={meanStatColor} hint={`медиана ${dist ? dist.median.toFixed(1) : '—'} ч`} />
          <StatCard icon="trendingDown" label="Мин / Макс" value={extremes.min && extremes.max ? `${extremes.min.value}/${extremes.max.value} ч` : '—'} color={colors.purple} />
          <StatCard icon="zap" label="Серия" value={`${streak.current} дн.`} color={streak.current >= 7 ? '#34d399' : '#fbbf24'} hint={`лучшая ${streak.best} дн.`} />
          <StatCard icon="clock" label="Долг за 7д" value={`${debt.toFixed(1)} ч`} color={debt > 2 ? '#f87171' : debt > 0 ? '#fbbf24' : '#34d399'} hint={`записано ${debtCalc.recordedDays} дн.`} />
          {efficiency !== null && (
            <StatCard
              icon="target"
              label="Эффективность (30д)"
              value={`${efficiency}%`}
              color={efficiency >= 85 ? '#34d399' : efficiency >= 75 ? '#fbbf24' : '#f87171'}
              hint={efficiency >= 85 ? 'норма ≥85%' : efficiency >= 75 ? 'пограничная' : 'маркер инсомнии'}
            />
          )}
          <StatCard icon="star" label="Качество (7д)" value={recent.length ? `${avgQuality.toFixed(1)}/5` : '—'} color={avgQuality >= 4 ? '#34d399' : avgQuality >= 3 ? '#fbbf24' : '#f87171'} />
          <StatCard icon="alertTriangle" label="Аномалии" value={String(anomalies.length)} color={anomalies.length ? '#f87171' : '#34d399'} hint={anomalies.length ? 'требуют внимания' : 'всё в порядке'} />
        </div>

        {/* Регулярность режима */}
        {regularity && regularity.samples >= 2 && (
          <section style={{ ...glassCard, marginBottom: 12 }}>
            <b style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><NativeIcon name="clock" size={13} /> Регулярность режима (14 дней)</b>
            <div className="sleep-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
              <StatCard
                icon="moon"
                label="Разброс отбоя (σ)"
                value={`±${regularity.bedtimeStdMin} мин`}
                color={regularity.bedtimeStdMin <= 30 ? '#34d399' : regularity.bedtimeStdMin <= 60 ? '#fbbf24' : '#f87171'}
                hint={regularity.bedtimeStdMin <= 30 ? 'стабильно' : regularity.bedtimeStdMin <= 60 ? 'плавает' : 'нестабильно'}
              />
              <StatCard
                icon="sun"
                label="Разброс подъёма (σ)"
                value={`±${regularity.wakeStdMin} мин`}
                color={regularity.wakeStdMin <= 30 ? '#34d399' : regularity.wakeStdMin <= 60 ? '#fbbf24' : '#f87171'}
                hint={regularity.wakeStdMin <= 30 ? 'стабильно' : regularity.wakeStdMin <= 60 ? 'плавает' : 'нестабильно'}
              />
              {regularity.jetlagMin !== null && (
                <StatCard
                  icon="send"
                  label="Джетлаг выходных"
                  value={`${regularity.jetlagMin} мин`}
                  color={regularity.jetlagMin <= 30 ? '#34d399' : regularity.jetlagMin <= 60 ? '#fbbf24' : '#f87171'}
                  hint="сдвиг середины сна в выходные"
                />
              )}
              <StatCard icon="chart" label="Записей" value={`${regularity.samples}`} color={colors.textMuted} hint="в окне 14 дней" />
            </div>
          </section>
        )}

        {/* Балл сна */}
        {score && (
          <section style={{ ...glassCard, marginBottom: 12 }}>
            <div className="sleep-score-wrap" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ScoreRing score={score.score} label="балл" />
                <div>
                  <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>Сводный балл сна</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    {score.score >= 80 ? '🟢 Отличное восстановление' : score.score >= 60 ? '🟡 Можно лучше' : '🔴 Требует внимания'}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textSubtle, marginTop: 2 }}>за выбранный период</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 8 }}>
                {score.breakdown.map((b) => (
                  <div key={b.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: colors.textMuted, fontWeight: 600 }}>{b.label}</span>
                      <span style={{ color: b.ok ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                        {b.ok ? '✓' : '✗'} {b.detail}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${b.pct}%`,
                          borderRadius: 3,
                          background: b.ok ? '#34d399' : b.pct >= 50 ? '#fbbf24' : '#f87171',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Цели */}
        <section style={{ ...glassCard, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>🎯 Цели сна</b>
            <button style={chip} onClick={() => setShowGoals(!showGoals)}>
              {showGoals ? 'Скрыть' : 'Настроить'}
            </button>
          </div>
          {showGoals && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
                gap: 10,
                marginTop: 12,
              }}
            >
              {(
                [
                  ['Часы', 'targetHours'],
                  ['Качество', 'targetQuality'],
                  ['Латентность', 'targetLatency'],
                  ['Пробуждения', 'targetAwakenings'],
                  ['Макс стресс', 'maxStressLevel'],
                  ['Алкоголь дней', 'alcoholDaysPerWeek'],
                ] as const
              ).map(([label, key]) => (
                <label key={key} style={{ display: 'grid', gap: 5, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
                  {label}
                  <input
                    style={inputStyle}
                    type="number"
                    value={goals[key]}
                    onChange={(e) => {
                      const next = { ...goals, [key]: Number(e.target.value) };
                      setGoals(next);
                      safeSet(GOALS_KEY, next, 'Не удалось сохранить цели (хранилище переполнено)');
                      // Синхронизация с хабом he_diary_goals (sleepHours) — двусторонняя связь без дубля
                      if (key === 'targetHours') {
                        try {
                          const hubRaw = JSON.parse(localStorage.getItem('he_diary_goals') || '{}');
                          localStorage.setItem('he_diary_goals', JSON.stringify({ ...hubRaw, sleepHours: Number(e.target.value) }));
                        } catch {}
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </section>

        {/* График часов + качества */}
        {sortedPoints.length > 0 && (
          <section id="sleep-chart" style={{ ...glassCard, marginBottom: 12, background: 'rgba(20,20,26,0.9)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <b>📈 Часы и качество</b>
              <small style={{ color: colors.textSubtle }}>{sortedPoints.length} дней</small>
            </div>
            <svg ref={svgRef} viewBox={`0 0 ${G.w} ${G.h}`} width="100%" aria-label="График часов сна и качества">
              <defs>
                <linearGradient id="sleepArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {hourTicks.map((t) => (
                <g key={t}>
                  <line x1={G.padL} y1={yH(t)} x2={G.w - G.padR} y2={yH(t)} stroke="rgba(255,255,255,0.07)" />
                  <text x={G.padL - 6} y={yH(t) + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10">
                    {t}
                  </text>
                </g>
              ))}
              {[1, 2, 3, 4, 5].map((t) => (
                <text key={`q${t}`} x={G.w - G.padR + 6} y={yQ(t) + 3} fill="rgba(56,189,248,0.5)" fontSize="10">
                  {t}
                </text>
              ))}
              <text x={G.w - G.padR + 6} y={yQ(5) - 4} fill="rgba(56,189,248,0.4)" fontSize="8">
                качество
              </text>
              {/* Зона нормы */}
              <rect
                x={G.padL}
                y={yH(normal?.high ?? 9)}
                width={innerW}
                height={Math.abs(yH(normal?.high ?? 9) - yH(normal?.low ?? 7))}
                fill="rgba(34,197,94,0.09)"
              />
              <line x1={G.padL} y1={yH(goals.targetHours)} x2={G.w - G.padR} y2={yH(goals.targetHours)} stroke="#22c55e" strokeDasharray="5 4" />
              <text x={G.w - G.padR} y={yH(goals.targetHours) - 4} textAnchor="end" fill="rgba(34,197,94,0.8)" fontSize="9">
                цель {goals.targetHours} ч
              </text>
              {/* Область и линия часов */}
              {areaPath && <path d={areaPath} fill="url(#sleepArea)" />}
              <path d={hoursPath} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Линия качества */}
              {qualityPath && (
                <path d={qualityPath} fill="none" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
              )}
              {/* Точки */}
              {sortedPoints.map((p, i) => {
                const q = rows.find((r) => r.date === p.date)?.quality;
                return (
                  <g key={`${p.date}-${i}`}>
                    <circle cx={x(i)} cy={yH(p.value)} r="3.2" fill={ACCENT} stroke="#0a0a0d" strokeWidth="1">
                      <title>{`${p.date}: ${p.value.toFixed(1)} ч · качество ${q ?? '—'}/5`}</title>
                    </circle>
                    {q !== undefined && (
                      <circle cx={x(i)} cy={yQ(q)} r="2.2" fill="#38bdf8" opacity="0.85">
                        <title>{`${p.date}: качество ${q}/5`}</title>
                      </circle>
                    )}
                  </g>
                );
              })}
              {/* Подписи дат */}
              {sortedPoints.length > 0 && sortedPoints.length <= 31 && (
                <>
                  {sortedPoints.map((p, i) =>
                    sortedPoints.length <= 14 || i % Math.ceil(sortedPoints.length / 14) === 0 ? (
                      <text key={p.date} x={x(i)} y={G.h - 8} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">
                        {p.date.slice(5)}
                      </text>
                    ) : null,
                  )}
                </>
              )}
            </svg>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: colors.textMuted, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 3, borderRadius: 2, background: ACCENT }} /> Часы
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 0, borderTop: '2px dashed #38bdf8' }} /> Качество (правая шкала)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 8, borderRadius: 2, background: 'rgba(34,197,94,0.25)' }} /> Норма 7–9 ч
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 0, borderTop: '2px dashed #22c55e' }} /> Цель {goals.targetHours} ч
              </span>
            </div>
          </section>
        )}

        {/* Недели */}
        {weeks.length > 0 && (
          <section style={{ ...glassCard, marginBottom: 12 }}>
            <b style={{ display: 'block', marginBottom: 10 }}>📅 Средние по неделям</b>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {weeks.slice(-8).map((w) => {
                const ok = w.mean >= goals.targetHours;
                return (
                  <div key={w.weekStart} style={{ minWidth: 120, flex: '1 1 120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.textSubtle, marginBottom: 4 }}>
                      <span>{w.weekStart.slice(5)}</span>
                      <span>{w.count} дн.</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (w.mean / Math.max(0.1, goals.targetHours)) * 100)}%`,
                          borderRadius: 5,
                          background: ok ? '#34d399' : w.mean < 6 ? '#f87171' : '#fbbf24',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ok ? '#34d399' : '#fbbf24', marginTop: 3 }}>
                      {w.mean.toFixed(1)} ч
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Календарь-хитмап */}
        {calendar.some((c) => c.hours !== null) && (
          <section id="sleep-calendar" style={{ ...glassCard, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b>🗓 Календарь сна (60 дней)</b>
              <div style={{ display: 'flex', gap: 6, fontSize: 10, color: colors.textSubtle, alignItems: 'center' }}>
                <span>нет</span>
                {(['bad', 'low', 'good', 'great', 'high'] as const).map((l) => (
                  <span key={l} title={l} style={{ width: 12, height: 12, borderRadius: 3, background: cellColor[l], display: 'inline-block' }} />
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 24px)', gap: 5, width: 'max-content' }}>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => (
                  <div
                    key={d}
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: i >= 5 ? 'rgba(167,139,250,0.8)' : colors.textSubtle,
                    }}
                  >
                    {d}
                  </div>
                ))}
                {calWeeks.map((week, wi) =>
                  week.map((c, di) => {
                    const level = sleepCellLevel(c.hours, c.quality);
                    return (
                      <div
                        key={`${wi}-${di}`}
                        className="sleep-heat"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: cellColor[level],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          color: c.hours !== null && (level === 'bad' || level === 'low' || level === 'high') ? '#fff' : 'rgba(255,255,255,0.5)',
                          fontWeight: 700,
                        }}
                        title={c.hours !== null ? `${c.date}: ${c.hours.toFixed(1)} ч · качество ${c.quality ?? '—'}/5` : c.date}
                      >
                        {c.hours !== null ? Number(c.date.slice(8)) : ''}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          </section>
        )}

        {/* Тренды метрик */}
        <section id="sleep-trends" style={{ ...glassCard, marginBottom: 12 }}>
          {trends.some((t) => t.thisWeek !== null && t.lastWeek !== null) ? (
            <>
              <b style={{ display: 'block', marginBottom: 10 }}>📊 Эта неделя vs прошлая</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                {trends.map((t) => {
                  const changed = t.delta !== null && Math.abs(t.delta) >= 0.05;
                  const better = changed && (t.betterWhenUp ? t.delta! > 0 : t.delta! < 0);
                  const worse = changed && !better;
                  return (
                    <div key={t.label} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}` }}>
                      <div style={{ fontSize: 10, color: colors.textSubtle, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                        {t.thisWeek !== null ? t.thisWeek.toFixed(1) : '—'}
                        <span style={{ fontSize: 11, color: colors.textSubtle, fontWeight: 500 }}> vs {t.lastWeek !== null ? t.lastWeek.toFixed(1) : '—'}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: better ? '#34d399' : worse ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                        {changed ? `${t.delta! > 0 ? '↑ +' : '↓ '}${Math.abs(t.delta!).toFixed(1)}` : '— стабильно'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ color: colors.textMuted, fontSize: 12 }}>
              📊 Тренды появятся при наличии записей за 2 недели: сравнение текущей и прошлой недели по часам, качеству, латентности и пробуждениям.
            </div>
          )}
        </section>

        {/* По дням недели */}
        {weekdayHasData && (
          <section style={{ ...glassCard, marginBottom: 12 }}>
            <b style={{ display: 'block', marginBottom: 10 }}>🗓 По дням недели</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {weekdayAvg.map((d) => (
                <div
                  key={d.dayName}
                  style={{
                    textAlign: 'center',
                    padding: '8px 2px',
                    borderRadius: 10,
                    background: d.count ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: d.count ? `1px solid ${colors.border}` : '1px solid transparent',
                  }}
                >
                  <div style={{ fontSize: 10, color: colors.textSubtle, fontWeight: 700 }}>{d.dayName}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: d.avgHours === null ? colors.textSubtle : d.avgHours >= goals.targetHours ? '#34d399' : d.avgHours >= 6 ? '#fbbf24' : '#f87171' }}>
                    {d.avgHours === null ? '—' : `${d.avgHours.toFixed(1)}ч`}
                  </div>
                  <div style={{ fontSize: 10, color: d.avgQuality === null ? colors.textSubtle : d.avgQuality >= 4 ? '#34d399' : d.avgQuality >= 3 ? '#fbbf24' : '#f87171' }}>
                    {d.avgQuality === null ? '' : `★${d.avgQuality.toFixed(1)}`}
                  </div>
                  {d.avgHours !== null && (
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 4 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (d.avgHours / Math.max(0.1, goals.targetHours)) * 100)}%`,
                          background: d.avgHours >= goals.targetHours ? '#34d399' : d.avgHours >= 6 ? '#fbbf24' : '#f87171',
                        }}
                      />
                    </div>
                  )}
                  {d.count > 0 && <div style={{ fontSize: 9, color: colors.textSubtle, marginTop: 3 }}>{d.count} дн.</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Сравнение недель */}
        {comparison.thisWeek && comparison.lastWeek && (
          <section style={{ ...glassCard, marginBottom: 12 }}>
            📆 Неделя: <b style={{ color: '#a78bfa' }}>{comparison.thisWeek.mean.toFixed(1)} ч</b> vs{' '}
            {comparison.lastWeek.mean.toFixed(1)} ч ранее (
            {comparison.delta !== null && comparison.delta >= 0 ? '+' : ''}
            {comparison.delta?.toFixed(1)} ч)
          </section>
        )}

        {/* Инсайты */}
        <section id="sleep-insights" style={{ ...glassCard, marginBottom: 12 }}>
          {(hygiene.length || recommendations.length || ped.length) > 0 ? (
            <>
              <b style={{ display: 'block', marginBottom: 8 }}>🧠 Инсайты и рекомендации</b>
              {hygiene.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '6px 0 2px' }}>
                  Гигиена сна
                </div>
                {hygiene.map((x, i) => (
                  <div key={`h${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '4px 0', fontSize: 13 }}>
                    <span>💡</span>
                    <span style={{ color: colors.text }}>{x}</span>
                  </div>
                ))}
              </>
            )}
            {recommendations.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '6px 0 2px' }}>
                  Корреляции
                </div>
                {recommendations.map((x, i) => (
                  <div key={`r${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '4px 0', fontSize: 13 }}>
                    <span>🔗</span>
                    <span style={{ color: colors.text }}>{x}</span>
                  </div>
                ))}
              </>
            )}
            {ped.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '6px 0 2px' }}>
                  Влияние добавок
                </div>
                {ped.map((x, i) => (
                  <div key={`p${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '4px 0', fontSize: 13, color: '#fbbf24' }}>
                    <span>💊</span>
                    <span>
                      {x.substance}: качество {x.avgQualityChange >= 0 ? '+' : ''}
                      {x.avgQualityChange}, латентность {x.avgLatencyChange >= 0 ? '+' : ''}
                      {x.avgLatencyChange} мин
                    </span>
                  </div>
                ))}
              </>
            )}
            {correlations.map((c) => (
              <div key={c.factor} style={{ fontSize: 12, marginTop: 5, color: colors.textMuted }}>
                {c.factor}: <b style={{ color: colors.text }}>{c.description}</b> · {c.strength}
              </div>
            ))}
            </>
          ) : (
            <div style={{ color: colors.textMuted, fontSize: 12 }}>
              🧠 Инсайты появятся с данными: заполняйте качество, засыпание, стресс и факторы (кофеин, алкоголь, экран) — алгоритм найдёт корреляции с тренировками и добавками.
            </div>
          )}
        </section>

        {/* Аномалии */}
        {anomalies.length > 0 && (
          <section style={{ ...glassCard, marginBottom: 12, borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }}>
            <b>⚠️ Аномалии ({anomalies.length})</b>
            {anomalies.slice(0, 5).map((a, i) => (
              <div key={i} style={{ marginTop: 4, fontSize: 13 }}>
                {a.date}: {a.message}
              </div>
            ))}
          </section>
        )}

        {/* Таблица */}
        <div id="sleep-table" style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="sleep-table">
            <thead>
              <tr>
                {['Дата', 'Часы', 'Качество', 'Пробуждений', 'Латентность', 'Кофеин до', 'Экран', 'Стресс', 'Алкоголь', 'Заметки'].map((h) => (
                  <th key={h} onClick={() => changeSort(h === 'Дата' ? 'date' : h)}>
                    {h}
                  </th>
                ))}
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pageData.pageItems.map((e) => {
                const r = rows.find((x) => x.date === e.date)!;
                const qColor = r.quality >= 4 ? '#34d399' : r.quality >= 3 ? '#fbbf24' : '#f87171';
                return (
                  <tr key={r.date}>
                    <td style={{ whiteSpace: 'nowrap', color: colors.textMuted }}>{r.date}</td>
                    <td style={{ fontWeight: 800, color: r.hours >= goals.targetHours ? '#34d399' : r.hours >= 6 ? '#fbbf24' : '#f87171' }}>
                      {r.hours} ч
                    </td>
                    <td style={{ fontWeight: 700, color: qColor }}>{r.quality}/5</td>
                    <td>{r.awakenings}</td>
                    <td>{r.latency ?? '—'} мин</td>
                    <td style={{ whiteSpace: 'nowrap', color: colors.textMuted }}>
                      {r.caffeineCutoff ? (
                        <span style={{ color: r.caffeineCutoff > '12:00' ? '#fbbf24' : '#34d399', fontWeight: 700 }}>{r.caffeineCutoff}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ color: colors.textMuted }}>{r.screenTime !== undefined ? `${r.screenTime} мин` : '—'}</td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          background: (r.stressLevel ?? 0) >= 7 ? 'rgba(239,68,68,0.18)' : (r.stressLevel ?? 0) >= 5 ? 'rgba(245,158,11,0.16)' : 'rgba(34,197,94,0.14)',
                          color: (r.stressLevel ?? 0) >= 7 ? '#f87171' : (r.stressLevel ?? 0) >= 5 ? '#fbbf24' : '#34d399',
                        }}
                      >
                        {r.stressLevel ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, color: r.alcohol ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                        {r.alcohol ? 'да' : 'нет'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textMuted }}>
                      {r.notes || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button style={{ ...btnBase, minHeight: 32, padding: '4px 9px' }} onClick={() => openSleepForm(r, true)}>
                        ✏️
                      </button>{' '}
                      <button
                        style={{ ...btnBase, minHeight: 32, padding: '4px 9px', color: '#f87171' }}
                        onClick={() => commit(rows.filter((x) => x.date !== r.date))}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
          <button style={chip} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Назад
          </button>
          <span style={{ fontSize: 13, color: colors.textMuted }}>
            Страница {page}/{pageData.totalPages} · {pageData.total} записей
          </span>
          <button style={chip} disabled={page >= pageData.totalPages} onClick={() => setPage(page + 1)}>
            Далее →
          </button>
        </div>

        {/* Последние записи */}
        {rows.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Последние записи</h3>
            {rows.slice(0, 3).map((r) => (
              <div key={r.date} style={{ ...glassCard, padding: 12, marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: ACCENT }}>{r.date}</span>
                <span style={{ fontWeight: 800 }}>💤 {r.hours} ч</span>
                <span style={{ color: r.quality >= 4 ? '#34d399' : r.quality >= 3 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                  ⭐ {r.quality}/5
                </span>
                <span style={{ color: colors.textMuted }}>
                  🛌 {r.bedtime}–{r.wakeTime}
                </span>
                {r.latency !== undefined && <span style={{ color: colors.textMuted }}>🕐 {r.latency} мин</span>}
                {r.alcohol && <span style={{ color: '#f87171' }}>🍷</span>}
                {r.notes && <span style={{ color: colors.textSubtle, fontSize: 12 }}>{r.notes}</span>}
              </div>
            ))}
          </div>
        )}

        {!rows.length && (
          <div style={{ ...glassCard, textAlign: 'center', padding: '36px 16px', marginTop: 12 }}>
            <div style={{ fontSize: 44 }}>🌙</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>Дневник сна пуст</div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, maxWidth: 380, margin: '6px auto' }}>
              Записывайте часы, качество и факторы сна — приложение покажет тренды, корреляции с тренировками и
              персональные рекомендации.
            </div>
            <button style={{ ...btnPrimary, marginTop: 14 }} onClick={() => openSleepForm(blankEntry(), false)}>
              + Добавить первую запись
            </button>
            <div style={{ display: 'grid', gap: 8, maxWidth: 420, margin: '18px auto 0', textAlign: 'left' }}>
              {[
                ['✏️', 'Запись за 30 секунд', 'часы, качество звёздами, режим, факторы, стресс'],
                ['📈', 'Аналитика сна', 'сводный балл, хитмап, тренды, корреляции с тренировками'],
                ['💊', 'Связь с курсом', 'влияние добавок на качество и засыпание'],
              ].map(([icon, title, sub]) => (
                <div
                  key={title as string}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span>
                    <b style={{ fontSize: 13, display: 'block' }}>{title}</b>
                    <span style={{ fontSize: 12, color: colors.textSubtle }}>{sub}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
