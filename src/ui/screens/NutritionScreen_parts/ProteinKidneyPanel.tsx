/**
 * ProteinKidneyPanel.tsx — «Белок и почки»: калькулятор переносимости белка.
 *
 * Зачем отдельная вкладка рядом с «Метаболикой»:
 *  - Метаболика отвечает «сколько белка нужно», но не «сколько ещё можно», когда
 *    ОАМ/мочевина уже нагружены.
 *  - Креатинин в одиночку врёт: высокий белок и дефицит воды поднимают мочевину
 *    без повреждения почек, а протеинурия требует снижения белка при нормальной СКФ.
 *
 * Что видит пользователь:
 *  1) Свои данные (вес/белок/вода) — с автоподстановкой из Плана питания.
 *  2) Кровь (мочевина, креатинин, СКФ) и ОАМ — с автоподстановкой из Профиля → Лабы.
 *  3) Вердикт: потолок г/кг, запас, можно ли наращивать и почему нет.
 *  4) Вода и осмолярная нагрузка (RSL).
 *  5) Пошаговый план прибавки + что-если.
 *  6) История замеров и методика с уровнями доказательности.
 *
 * Ограничения осознанные: это инструмент самонаблюдения, а не диагноз.
 * Никаких нативных <select>/<input type=checkbox> — только MhNum/MhToggle/кнопки
 * (APK-safe, min 44px).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlanCtx } from './IndividualPlan/IndividualPlanContext';
import { readPlanTargets } from './IndividualPlan/plan-targets-bridge';
import { getProfile } from '../../../core/profile-manager';
import { db } from '../../../core/db';
import { UACR_MG_MMOL_TO_MG_G } from '../../../core/constants';
import {
  ALBUMINURIA_LABEL,
  GFR_CATEGORY_LABEL,
  PROTEIN_KIDNEY_INPUT_KEY,
  buildDoctorSummary,
  calcProteinKidney,
  clearProteinKidneyHistory,
  loadProteinKidneyHistory,
  saveProteinKidneySnapshot,
  toSnapshot,
  type PkGoal,
  type PkSex,
  type PkTraining,
  type ProteinKidneyInput,
  type ProteinKidneyResult,
  type ProteinKidneySnapshot,
} from '../../../engines/protein-kidney-tolerance.engine';
import { MhBar, MhGrid, MhNum, MhSection, MhTile, MhToggle } from '../Shared/metabolic-hub.parts';

type OptionalNumKey =
  | 'bodyFatPct'
  | 'waterMlPerDay'
  | 'ureaMmolL'
  | 'creatinineUmolL'
  | 'egfrMeasured'
  | 'cystatinCMgL'
  | 'dietarySodiumG'
  | 'dietaryPotassiumG'
  | 'urineSg'
  | 'urinePh'
  | 'urineProteinScore'
  | 'urineProteinGL'
  | 'urineCreatinineMmolL'
  | 'microalbuminMgL'
  | 'uacrMgMmol'
  | 'urineVolume24hMl'
  | 'urineLeuPerUl'
  | 'urineEryPerUl'
  | 'urineNitriteScore'
  | 'urineGlucoseScore'
  | 'urineKetonesScore'
  | 'urineCastsPerUl'
  | 'plannedIncreaseGPerDay';

interface PanelState {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: PkSex;
  training: PkTraining;
  goal: PkGoal;
  proteinGPerDay: number;
  mealsPerDay: number;
  bodyFatPct?: number;
  waterMlPerDay?: number;
  creatineUse: boolean;
  knownCkd: boolean;
  aasUse?: boolean;
  hypertension?: boolean;
  diabetes?: boolean;
  nsaidUse?: boolean;
  ureaMmolL?: number;
  creatinineUmolL?: number;
  egfrMeasured?: number;
  cystatinCMgL?: number;
  dietarySodiumG?: number;
  dietaryPotassiumG?: number;
  urineSg?: number;
  urinePh?: number;
  urineProteinScore?: number;
  urineProteinGL?: number;
  urineCreatinineMmolL?: number;
  microalbuminMgL?: number;
  uacrMgMmol?: number;
  urineVolume24hMl?: number;
  urineLeuPerUl?: number;
  urineEryPerUl?: number;
  urineNitriteScore?: number;
  urineGlucoseScore?: number;
  urineKetonesScore?: number;
  urineCastsPerUl?: number;
  plannedIncreaseGPerDay?: number;
}

/** Лабораторные поля, которые можно подтянуть из профиля (и не затирать ручной ввод). */
const LAB_KEYS: Array<OptionalNumKey> = [
  'ureaMmolL',
  'creatinineUmolL',
  'egfrMeasured',
  'cystatinCMgL',
  'urineSg',
  'urinePh',
  'urineProteinScore',
  'urineProteinGL',
  'urineCreatinineMmolL',
  'microalbuminMgL',
  'uacrMgMmol',
  'urineVolume24hMl',
  'urineLeuPerUl',
  'urineEryPerUl',
  'urineNitriteScore',
  'urineGlucoseScore',
  'urineKetonesScore',
  'urineCastsPerUl',
];

const SCORE_OPTIONS = [
  { v: 0, t: 'отр' },
  { v: 0.5, t: 'следы' },
  { v: 1, t: '1+' },
  { v: 2, t: '2+' },
  { v: 3, t: '3+' },
  { v: 4, t: '4+' },
];

const TRAIN_OPTIONS: Array<{ v: PkTraining; t: string; d: string }> = [
  { v: 'sedentary', t: 'Без тренировок', d: 'польза до 1.6 г/кг' },
  { v: 'recreational', t: 'Любитель', d: 'польза до 1.8 г/кг' },
  { v: 'resistance', t: 'Силовой', d: 'польза до 2.2 г/кг' },
  { v: 'athlete', t: 'Спортсмен', d: 'польза до 2.2 г/кг' },
];

const GOAL_OPTIONS: Array<{ v: PkGoal; t: string }> = [
  { v: 'cut', t: 'Сушка' },
  { v: 'maintain', t: 'Поддержание' },
  { v: 'bulk', t: 'Набор' },
];

const HYDRATION_LABEL: Record<ProteinKidneyResult['hydrationStatus'], string> = {
  unknown: 'нет данных',
  good: 'достаточно',
  borderline: 'на грани',
  dehydrated: 'дефицит воды',
};

const RISK_LABEL: Record<ProteinKidneyResult['concentrationRisk'], string> = {
  low: 'низкий',
  moderate: 'умеренный',
  high: 'высокий',
};

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' для человеческой даты пересдачи. */
function formatRuDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

const MANUAL_KEY = `${PROTEIN_KIDNEY_INPUT_KEY}_manual`;

function readManualFlags(): Record<string, boolean> {
  try {
    const parsed = safeRead<Record<string, boolean>>(MANUAL_KEY);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** .ics для календаря: напоминание о пересдаче, без серверов и разрешений. */
export function buildRetestIcs(dateIso: string, title: string, description: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const start = m ? `${m[1]}${m[2]}${m[3]}` : dateIso.replace(/-/g, '');
  const d = new Date(`${dateIso}T12:00:00`);
  const next = new Date(d.getTime() + 86400000);
  const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const esc = (s: string): string =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/[,;]/g, (c) => `\\${c}`)
      .replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BodyBuildHealth//ProteinKidney//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:pk-${start}@bodybuildhealth`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

const STATUS_META: Record<ProteinKidneyResult['status'], { text: string; color: string }> = {
  above_tolerance: { text: 'Выше переносимости', color: '#ef4444' },
  above_benefit: { text: 'Выше пользы, но переносится', color: '#eab308' },
  within: { text: 'В пределах пользы', color: '#22c55e' },
  below_min: { text: 'Меньше оптимума', color: '#f59e0b' },
};

function trainFromCtx(t?: string): PkTraining {
  if (t === 'strength') return 'resistance';
  if (t === 'cardio') return 'recreational';
  if (t === 'mixed') return 'resistance';
  if (t === 'hiit') return 'athlete';
  return 'resistance';
}

function goalFromCtx(g?: string): PkGoal {
  if (g === 'cutting' || g === 'fat_loss') return 'cut';
  if (g === 'mass' || g === 'bulking') return 'bulk';
  return 'maintain';
}

function initialTraining(t?: string): PkTraining {
  return trainFromCtx(t);
}

function safeRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Строка из `labs_log` (IndexedDB): результат из раздела «Анализы». */
export interface LabDbRow {
  code?: string;
  value?: unknown;
  unit?: unknown;
  date?: string;
  patientId?: string;
}

/**
 * Свежие значения по коду из двух источников: сводка профиля и `labs_log`.
 *
 * Зачем: профиль обновляется не мгновенно, а раздел «Анализы» пишет напрямую
 * в IndexedDB. Кнопка «Из анализов» должна видеть только что сданный результат,
 * не дожидаясь фоновой синхронизации. Побеждает более свежая дата; записи без
 * `patientId` считаем своими (старый формат), чужих не смешиваем.
 */
export function mergeLatestLabs(
  profileSummary: Record<string, { value?: unknown; unit?: unknown; date?: string }> | null | undefined,
  entries: LabDbRow[],
  patientId: string,
): Record<string, { value: number; unit?: string }> {
  const out: Record<string, { value: number; unit?: string; date: string }> = {};
  for (const [rawKey, entry] of Object.entries(profileSummary || {})) {
    const key = String(rawKey || '')
      .trim()
      .toUpperCase();
    const value = Number(entry?.value);
    if (!key || !Number.isFinite(value)) continue;
    out[key] = {
      value,
      unit: entry?.unit == null ? undefined : String(entry.unit),
      date: typeof entry?.date === 'string' ? entry.date : '',
    };
  }
  for (const row of entries) {
    const key = String(row?.code ?? '')
      .trim()
      .toUpperCase();
    const value = Number(row?.value);
    if (!key || !Number.isFinite(value)) continue;
    if (row.patientId && row.patientId !== patientId) continue;
    const date = typeof row.date === 'string' ? row.date : '';
    const prev = out[key];
    // Если у старой записи есть дата, а у новой нет — не можем доказать, что
    // она свежее; оставляем проверенное значение.
    if (prev?.date && (!date || date < prev.date)) continue;
    out[key] = {
      value,
      unit: row.unit == null ? undefined : String(row.unit),
      date,
    };
  }
  return out;
}

/** Достаём значение из settings.labs.summary по списку алиасов. */
function pickLab(
  labs: Record<string, { value?: unknown; unit?: unknown }>,
  aliases: string[],
): { key: string; value: number; unit: string } | null {
  for (const key of aliases) {
    const entry = labs[key];
    if (!entry) continue;
    const value = Number(entry.value);
    if (Number.isFinite(value)) {
      const unit = String(entry.unit ?? '')
        .toLowerCase()
        .replace(/мг/g, 'mg')
        .replace(/дл/g, 'dl')
        .replace(/мкмоль/g, 'µmol')
        .replace(/ммоль/g, 'mmol');
      return { key, value, unit };
    }
  }
  return null;
}

/** Приводим лабораторные единицы к тем, на которых считает движок. */
function ureaMmol(value: number, unit: string, labKey: string): number {
  const isBun = /bun/i.test(labKey);
  if (/mg/.test(unit)) return isBun ? value / 2.8 : value / 6.0;
  if (/(µmol|umol|mcmol)/.test(unit)) return value / 1000;
  return value;
}
function creatinineUmol(value: number, unit: string): number {
  return /mg/.test(unit) ? value * 88.4 : value;
}
function specificGravity(value: number): number {
  if (value >= 1000 && value <= 1060) return value / 1000;
  return value;
}
function proteinGL(value: number, unit: string): number {
  if (/mg\/dl/.test(unit)) return value / 100;
  if (/mg/.test(unit)) return value / 1000;
  return value;
}
function urineCreatinineMmol(value: number, unit: string): number {
  if (/mg\/dl/.test(unit)) return value * 0.0884;
  if (/(µmol|umol|mcmol)/.test(unit)) return value / 1000;
  return value;
}
function microalbuminMgL(value: number, unit: string): number {
  if (/mg\/dl/.test(unit)) return value * 10;
  if (/g\/l/.test(unit)) return value * 1000;
  return value;
}
function cystatinMgL(value: number, unit: string): number {
  return /mg\/dl/.test(unit) ? value * 10 : value;
}
/**
 * Проход 207: канон приложения — мг/г (`UCUM_MAP.UACR`, поле бланка, шкала
 * ступеней), поэтому запись БЕЗ единицы тоже читается как мг/г. Раньше она
 * считалась мг/ммоль: 50 мг/г (A2) превращались в 50 мг/ммоль (A3) — завышение
 * с ложным «нефролог + ≤1.0 г/кг». Пересчёт — фактор KDIGO 0.113
 * (`UACR_MG_MMOL_TO_MG_G`), одна константа на всё приложение. Единица с `mmol`
 * или «ммоль» (в том числе приведённая из «мг/ммоль») остаётся мг/ммоль.
 */
export function uacrToMgMmol(value: number, unit: string): number {
  return /(mmol|ммоль)/.test(unit) ? value : value / UACR_MG_MMOL_TO_MG_G;
}

const Pep: React.FC<{ children: React.ReactNode; color?: string; onClick?: () => void }> = ({
  children,
  color = '#60a5fa',
  onClick,
}) => (
  <span
    onClick={onClick}
    style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 6,
      fontSize: 9,
      fontWeight: 700,
      background: `${color}18`,
      color,
      border: `1px solid ${color}33`,
      lineHeight: 1.5,
      ...(onClick ? { cursor: 'pointer' } : {}),
    }}
  >
    {children}
  </span>
);

/** Сегментный выбор вместо нативного select. */
const Segment: React.FC<{
  label: string;
  hint?: string;
  options: Array<{ v: string; t: string; d?: string }>;
  value: string;
  onChange: (v: string) => void;
  accent?: string;
}> = ({ label, hint, options, value, onChange, accent = '#60a5fa' }) => (
  <div style={{ gridColumn: '1 / -1', marginBottom: 2 }}>
    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', fontWeight: 600, marginBottom: 4 }}>
      {label}
      {hint ? <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.42)' }}> · {hint}</span> : null}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.v)}
            style={{
              flex: '1 1 45%',
              minHeight: 44,
              padding: '7px 9px',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'left',
              color: '#fff',
              background: active ? `${accent}1a` : 'rgba(255,255,255,0.03)',
              border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>{o.t}</span>
            {o.d && <span style={{ display: 'block', fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{o.d}</span>}
          </button>
        );
      })}
    </div>
  </div>
);

/** Тест-полоска: 0/следы/1+…/4+ или «очистить». */
const ScorePicker: React.FC<{
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  options?: Array<{ v: number; t: string }>;
  accent?: string;
}> = ({ label, value, onChange, options = SCORE_OPTIONS, accent = '#f59e0b' }) => {
  const has = typeof value === 'number';
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>{label}</span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`${label}: очистить`}
          style={{
            minHeight: 30,
            padding: '2px 10px',
            borderRadius: 7,
            cursor: 'pointer',
            fontSize: 9,
            background: 'transparent',
            color: has ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          сброс
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {options.map((o) => {
          const active = has && Math.abs((value as number) - o.v) < 0.001;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.v)}
              style={{
                flex: '1 1 0',
                minWidth: 48,
                minHeight: 44,
                borderRadius: 9,
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: active ? 800 : 600,
                background: active ? `${accent}22` : 'rgba(255,255,255,0.03)',
                border: active ? `1px solid ${accent}77` : '1px solid rgba(255,255,255,0.07)',
                color: active ? accent : 'rgba(255,255,255,0.72)',
              }}
            >
              {o.t}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Мини-график индекса нагрузки по истории. */
const ScoreSpark: React.FC<{ points: number[]; color: string }> = ({ points, color }) => {
  if (points.length < 2) return null;
  const W = 260,
    H = 46,
    PAD = 4;
  const xs = (i: number): number => PAD + (i * (W - 2 * PAD)) / Math.max(1, points.length - 1);
  const ys = (v: number): number => H - PAD - (Math.min(100, Math.max(0, v)) / 100) * (H - 2 * PAD);
  const pts = points.map((p, i) => `${xs(i).toFixed(1)},${ys(p).toFixed(1)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', display: 'block' }}
      role="img"
      aria-label="Индекс нагрузки по истории"
    >
      <line x1={PAD} y1={ys(50)} x2={W - PAD} y2={ys(50)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xs(i)} cy={ys(p)} r={2.2} fill={color}>
          <title>{`${p}`}</title>
        </circle>
      ))}
    </svg>
  );
};

const FlagCard: React.FC<{ severity: 'info' | 'warn' | 'danger'; title: string; detail: string }> = ({
  severity,
  title,
  detail,
}) => {
  const color = severity === 'danger' ? '#ef4444' : severity === 'warn' ? '#f59e0b' : '#60a5fa';
  const icon = severity === 'danger' ? '⛔' : severity === 'warn' ? '⚠️' : 'ℹ️';
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 10,
        marginBottom: 6,
        background: `${color}10`,
        border: `1px solid ${color}33`,
      }}
    >
      <span aria-hidden style={{ fontSize: 13, lineHeight: 1.2 }}>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color }}>{title}</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.66)', lineHeight: 1.4 }}>{detail}</div>
      </div>
    </div>
  );
};

export const ProteinKidneyPanel: React.FC = () => {
  const ctx = usePlanCtx();

  const [state, setState] = useState<PanelState>(() => {
    const saved = safeRead<Partial<PanelState>>(PROTEIN_KIDNEY_INPUT_KEY);
    const planProtein = (() => {
      try {
        return readPlanTargets()?.protein ?? 0;
      } catch {
        return 0;
      }
    })();
    const profile = (() => {
      try {
        return (getProfile()?.settings as any) || {};
      } catch {
        return {};
      }
    })();
    const waterL = Number(profile?.lifestyle?.dailyWaterLiters);

    const base: PanelState = {
      weightKg: Number(ctx.weight) > 20 ? ctx.weight : 80,
      heightCm: Number(ctx.height) > 100 ? ctx.height : 180,
      age: Number(ctx.age) > 10 ? ctx.age : 30,
      sex: ctx.sex === 'female' ? 'female' : 'male',
      training: initialTraining(ctx.trainType),
      goal: goalFromCtx(ctx.goal),
      proteinGPerDay: planProtein > 0 ? Math.round(planProtein) : Math.round(Number(ctx.effectiveP) || 160),
      mealsPerDay: Number(ctx.mealsCount) > 0 ? ctx.mealsCount : 4,
      bodyFatPct: Number(ctx.bodyFatPct) > 3 ? ctx.bodyFatPct : undefined,
      waterMlPerDay: Number.isFinite(waterL) && waterL > 0 ? Math.round(waterL * 1000) : undefined,
      creatineUse: false,
      knownCkd: false,
    };
    if (!saved || typeof saved !== 'object') return base;
    // Сохранённый ввод пользователя важнее дефолтов контекста.
    return { ...base, ...saved };
  });

  const manualRef = useRef<Record<string, boolean>>(readManualFlags());
  const pulledRef = useRef<Record<string, boolean>>({});
  const [history, setHistory] = useState<ProteinKidneySnapshot[]>(() => loadProteinKidneyHistory());
  const [showMethod, setShowMethod] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [labsBusy, setLabsBusy] = useState(false);
  const [labsNotice, setLabsNotice] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const labsNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setOptional = useCallback((key: OptionalNumKey, v: number | undefined) => {
    manualRef.current[key] = true;
    setState((s) => ({ ...s, [key]: v }));
  }, []);

  const setRequired = useCallback(
    (key: 'weightKg' | 'heightCm' | 'age' | 'proteinGPerDay' | 'mealsPerDay', v: number | undefined) => {
      if (v == null || !Number.isFinite(v)) return;
      if (key === 'proteinGPerDay') manualRef.current.proteinGPerDay = true;
      setState((s) => ({ ...s, [key]: v }));
    },
    [],
  );

  const valuesRef = useRef(state);
  useEffect(() => {
    valuesRef.current = state;
  }, [state]);

  /** Раскладываем сводку анализов по полям. Возвращает число применённых. */
  const applyLabSummary = useCallback(
    (labs: Record<string, { value?: unknown; unit?: unknown }>, force: boolean): number => {
      const cur = valuesRef.current;
      let applied = 0;
      const apply = (
        key: OptionalNumKey,
        raw: { key: string; value: number; unit: string } | null,
        convert?: (v: number, u: string, labKey: string) => number,
      ) => {
        if (!raw) return;
        if (!force && manualRef.current[key]) return;
        // Не перетираем уже показанное значение (ручное или ранее подтянутое).
        if (!force && cur[key] != null) return;
        const value = convert ? convert(raw.value, raw.unit, raw.key) : raw.value;
        if (!Number.isFinite(value)) return;
        pulledRef.current[key] = true;
        // Явное «подтянуть» снимает ручную блокировку: значение снова из анализов.
        if (force) delete manualRef.current[key];
        applied += 1;
        setState((s) => ({ ...s, [key]: value }));
      };

      apply('ureaMmolL', pickLab(labs, ['UREA', 'Urea', 'urea', 'Мочевина', 'BUN']), ureaMmol);
      apply('creatinineUmolL', pickLab(labs, ['CREATININE', 'Creatinine', 'creatinine', 'Креатинин']), creatinineUmol);
      apply('egfrMeasured', pickLab(labs, ['EGFR', 'eGFR', 'GFR', 'gfr', 'СКФ']));
      apply('cystatinCMgL', pickLab(labs, ['CYSTATIN_C', 'Cystatin C', 'cystatin_c', 'Цистатин C']), cystatinMgL);
      apply('urineSg', pickLab(labs, ['URINE_SG', 'urine_sg', 'USG', 'sg', 'Плотность мочи']), (v) =>
        specificGravity(v),
      );
      apply('urinePh', pickLab(labs, ['URINE_PH', 'urine_ph', 'pH мочи']));
      apply('urineProteinScore', pickLab(labs, ['URINE_PROTEIN_QR', 'PROTEIN_QR', 'urine_protein_qr']), (v) =>
        Math.max(0, Math.min(4, v)),
      );
      apply(
        'urineProteinGL',
        pickLab(labs, ['PROTEIN_URINE', 'Protein_urine', 'protein_urine', 'Протеинурия']),
        proteinGL,
      );
      apply(
        'urineCreatinineMmolL',
        pickLab(labs, ['CREATININE_URINE', 'creatinine_urine', 'Креатинин мочи']),
        urineCreatinineMmol,
      );
      apply(
        'microalbuminMgL',
        pickLab(labs, ['MICROALB', 'Microalb', 'microalbumin', 'Микроальбумин']),
        microalbuminMgL,
      );
      apply('uacrMgMmol', pickLab(labs, ['UACR', 'uacr', 'Альбумин/креатинин']), uacrToMgMmol);
      apply('urineVolume24hMl', pickLab(labs, ['URINE_VOLUME_24H', 'urine_volume_24h', 'Суточный диурез']));
      apply('urineLeuPerUl', pickLab(labs, ['URINE_LEU', 'urine_leu', 'Лейкоциты мочи']));
      apply('urineEryPerUl', pickLab(labs, ['URINE_ERY', 'urine_ery', 'Эритроциты мочи']));
      apply('urineNitriteScore', pickLab(labs, ['URINE_NITRITE_QR', 'urine_nitrite_qr', 'URINE_NITRITE_Q']), (v) =>
        Math.max(0, Math.min(4, v)),
      );
      apply('urineGlucoseScore', pickLab(labs, ['URINE_GLUCOSE_QR', 'urine_glucose_qr']), (v) =>
        Math.max(0, Math.min(4, v)),
      );
      apply('urineKetonesScore', pickLab(labs, ['URINE_KETONES_QR', 'urine_ketones_qr']), (v) =>
        Math.max(0, Math.min(4, v)),
      );
      apply('urineCastsPerUl', pickLab(labs, ['URINE_CYLINDERS', 'urine_cylinders', 'Цилиндры мочи']));
      return applied;
    },
    [],
  );

  const notifyLabs = useCallback((text: string, tone: 'ok' | 'warn') => {
    setLabsNotice({ text, tone });
    if (labsNoticeTimer.current) clearTimeout(labsNoticeTimer.current);
    labsNoticeTimer.current = setTimeout(() => setLabsNotice(null), 4200);
  }, []);

  useEffect(
    () => () => {
      if (labsNoticeTimer.current) clearTimeout(labsNoticeTimer.current);
    },
    [],
  );

  /** Подтягиваем лабы из профиля: ручной ввод и уже показанное не затираем. */
  const pullLabs = useCallback(
    (force = false) => {
      let labs: Record<string, { value?: unknown; unit?: unknown }> = {};
      try {
        labs = (getProfile()?.settings as any)?.labs?.summary || {};
      } catch {
        labs = {};
      }
      if (!labs || typeof labs !== 'object') return;

      const cur = valuesRef.current;
      // «Белок сейчас» следует за планом, пока пользователь не поправил его вручную.
      if (!manualRef.current.proteinGPerDay) {
        const planProtein = (() => {
          try {
            return readPlanTargets()?.protein ?? 0;
          } catch {
            return 0;
          }
        })();
        if (planProtein > 0 && Math.abs(cur.proteinGPerDay - planProtein) > 1) {
          setState((s) => ({ ...s, proteinGPerDay: Math.round(planProtein) }));
        }
      }
      applyLabSummary(labs, force);
    },
    [applyLabSummary],
  );

  /**
   * Кнопка «Из анализов»: читает `labs_log` напрямую (IndexedDB), не дожидаясь
   * фоновой синхронизации профиля. Свежесть — по дате бланка, чужие patientId
   * отбрасываются.
   */
  const pullLabsFromDb = useCallback(async () => {
    if (labsBusy) return;
    setLabsBusy(true);
    try {
      const entries = await db.getAll<LabDbRow>('labs_log');
      const profile = (() => {
        try {
          return getProfile();
        } catch {
          return null;
        }
      })();
      const patientId = profile?.id || 'current-user';
      const profileSummary = (() => {
        try {
          return (profile?.settings as any)?.labs?.summary || {};
        } catch {
          return {};
        }
      })();
      const merged = mergeLatestLabs(profileSummary, Array.isArray(entries) ? entries : [], patientId);
      const applied = applyLabSummary(merged, true);
      if (applied > 0) notifyLabs(`Подтянуто из анализов: ${applied}`, 'ok');
      else notifyLabs('В анализах нет нужных маркеров — заполните вручную', 'warn');
    } catch {
      notifyLabs('Не удалось прочитать раздел «Анализы»', 'warn');
    } finally {
      setLabsBusy(false);
    }
  }, [applyLabSummary, labsBusy, notifyLabs]);

  useEffect(() => {
    pullLabs();
    const id = setInterval(() => {
      if (!document.hidden) pullLabs();
    }, 8000);
    const onStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes('he_profile') || e.key.includes('he_labs') || e.key.includes('profile'))) pullLabs();
    };
    const onFocus = () => pullLabs();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [pullLabs]);

  // Персист ввода: переживает перезагрузку и уход на другую вкладку.
  useEffect(() => {
    try {
      localStorage.setItem(PROTEIN_KIDNEY_INPUT_KEY, JSON.stringify(state));
    } catch {
      /* quota */
    }
    try {
      localStorage.setItem(MANUAL_KEY, JSON.stringify(manualRef.current));
    } catch {
      /* quota */
    }
  }, [state]);

  const input: ProteinKidneyInput = useMemo(() => ({ ...state }), [state]);
  const result = useMemo(() => calcProteinKidney(input), [input]);

  const statusMeta = STATUS_META[result.status];
  // «Переносится» можно говорить только когда потолок подтверждён анализами.
  const statusText = result.extreme
    ? result.status === 'above_tolerance'
      ? 'Выше переносимости'
      : 'Экстремальный режим'
    : result.status === 'above_benefit' && !result.toleranceVerified
      ? 'Выше пользы'
      : statusMeta.text;
  const statusColor = result.extreme ? '#f97316' : statusMeta.color;
  const overToleranceG = Math.max(0, result.proteinGPerDay - result.capGPerDay);
  const overBenefitG = Math.max(0, result.proteinGPerDay - result.benefitCapGPerDay);
  const util = result.utilization;
  const toleranceValue = result.toleranceAssessed ? `${result.capGPerKg}` : '—';
  const toleranceSub = !result.toleranceAssessed
    ? 'нужны анализы'
    : result.capGPerKg < result.benefitCapGPerKg - 1e-9
      ? `${result.capGPerDay} г/сут · ограничение`
      : result.extreme
        ? `${result.capGPerDay} г/сут · экстремальный`
        : result.toleranceVerified
          ? `${result.capGPerDay} г/сут`
          : `${result.capGPerDay} г/сут · не подтверждено`;
  const toleranceHeadValue = !result.toleranceAssessed
    ? '—'
    : result.toleranceHeadroomGPerDay > 0
      ? `+${result.toleranceHeadroomGPerDay}`
      : `−${overToleranceG}`;
  const toleranceHeadSub = result.toleranceAssessed ? (result.extreme ? 'г/сут · врач' : 'г/сут') : 'после анализов';
  const toleranceHeadColor = !result.toleranceAssessed
    ? '#94a3b8'
    : result.extreme
      ? '#f97316'
      : result.toleranceHeadroomGPerDay > 0
        ? '#22c55e'
        : '#ef4444';
  const barMax = Math.max(result.toleranceAssessed ? result.capGPerKg : result.benefitCapGPerKg, result.proteinGPerKg);
  const planTone =
    result.increaseAllowed && !result.increasePaused
      ? '#22c55e'
      : result.increasePaused
        ? '#f59e0b'
        : result.extreme && result.status !== 'above_tolerance'
          ? '#f97316'
          : result.canIncreaseToTolerance
            ? '#eab308'
            : '#ef4444';
  const planLabel =
    result.increaseAllowed && !result.increasePaused
      ? 'рекомендуется'
      : result.increasePaused
        ? 'пауза'
        : result.extreme && result.status !== 'above_tolerance'
          ? 'под контролем'
          : result.canIncreaseToTolerance
            ? 'только переносимость'
            : 'нельзя';
  const historyPoints = useMemo(() => history.map((h) => h.score), [history]);
  const hydrationTone =
    result.hydrationStatus === 'dehydrated'
      ? '#ef4444'
      : result.hydrationStatus === 'borderline'
        ? '#f59e0b'
        : result.hydrationStatus === 'good'
          ? '#22c55e'
          : 'rgba(255,255,255,0.6)';

  const onSaveSnapshot = () => {
    const next = saveProteinKidneySnapshot(toSnapshot(input, result));
    setHistory(next);
    setSavedMsg('Замер сохранён');
    setTimeout(() => setSavedMsg(''), 2200);
  };

  const onClearHistory = () => {
    clearProteinKidneyHistory();
    setHistory([]);
    setSavedMsg('История очищена');
    setTimeout(() => setSavedMsg(''), 2200);
  };

  const onCopySummary = async () => {
    const text = buildDoctorSummary(input, result);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setSavedMsg('Сводка для врача скопирована');
    } catch {
      setSavedMsg('Не удалось скопировать — буфер обмена недоступен');
    }
    setTimeout(() => setSavedMsg(''), 2600);
  };

  const onDownloadIcs = () => {
    try {
      const ics = buildRetestIcs(
        result.retest.date,
        'Пересдать анализы: белок и почки',
        `Что сдать: ${result.retest.items.join(', ')}. ${result.retest.reason}`,
      );
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `belok-pochki-${result.retest.date}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSavedMsg('Файл календаря скачан');
    } catch {
      setSavedMsg('Не удалось создать файл календаря');
    }
    setTimeout(() => setSavedMsg(''), 2600);
  };

  const resetFromProfile = () => {
    manualRef.current = {};
    pulledRef.current = {};
    const planProtein = (() => {
      try {
        return readPlanTargets()?.protein ?? 0;
      } catch {
        return 0;
      }
    })();
    setState((s) => ({
      ...s,
      // Тело и цель — из живого контекста плана: сохранённый вес мог устареть.
      weightKg: Number(ctx.weight) > 20 ? ctx.weight : s.weightKg,
      heightCm: Number(ctx.height) > 100 ? ctx.height : s.heightCm,
      age: Number(ctx.age) > 10 ? ctx.age : s.age,
      sex: ctx.sex === 'female' ? 'female' : 'male',
      training: initialTraining(ctx.trainType),
      goal: goalFromCtx(ctx.goal),
      proteinGPerDay: planProtein > 0 ? Math.round(planProtein) : s.proteinGPerDay,
      mealsPerDay: Number(ctx.mealsCount) > 0 ? ctx.mealsCount : s.mealsPerDay,
      ...Object.fromEntries(LAB_KEYS.map((k) => [k, undefined])),
    }));
    // valuesRef обновится после рендера; подтягиваем на следующем тике.
    setTimeout(() => pullLabs(true), 0);
  };

  const numberProps = (key: OptionalNumKey) => ({
    value: state[key],
    fromProfile: !!pulledRef.current[key] && !manualRef.current[key],
    onChange: (v: number | undefined) => setOptional(key, v),
  });

  return (
    <div className="pk-panel" data-pk-root="1" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 14,
          marginBottom: 8,
          background: 'linear-gradient(135deg, rgba(56,189,248,0.14), rgba(34,197,94,0.08))',
          border: '1px solid rgba(56,189,248,0.22)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 19,
            background: 'rgba(56,189,248,0.16)',
            border: '1px solid rgba(56,189,248,0.3)',
            flexShrink: 0,
          }}
        >
          🧪
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: -0.2 }}>Белок и почки</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.62)', lineHeight: 1.35 }}>
            ОАМ + мочевина + креатинин → сколько белка ещё можно добавить
          </div>
        </div>
      </div>

      {/* Два источника: профиль (план, вес, вода) и раздел «Анализы» (labs_log). */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          onClick={resetFromProfile}
          aria-label="Подтянуть данные из профиля заново"
          style={{
            flex: 1,
            minHeight: 44,
            padding: '0 10px',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 800,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff',
          }}
        >
          ↻ Из профиля
        </button>
        <button
          type="button"
          onClick={() => void pullLabsFromDb()}
          disabled={labsBusy}
          aria-label="Подтянуть анализы из раздела Анализы"
          style={{
            flex: 1,
            minHeight: 44,
            padding: '0 10px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 800,
            cursor: labsBusy ? 'progress' : 'pointer',
            opacity: labsBusy ? 0.65 : 1,
            background: 'rgba(56,189,248,0.14)',
            border: '1px solid rgba(56,189,248,0.32)',
            color: '#7dd3fc',
          }}
        >
          {labsBusy ? 'Читаю анализы…' : '↻ Из анализов'}
        </button>
      </div>
      {labsNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: -2,
            marginBottom: 8,
            padding: '0 2px',
            fontSize: 9,
            lineHeight: 1.4,
            color: labsNotice.tone === 'ok' ? '#22c55e' : '#f59e0b',
          }}
        >
          {labsNotice.text}
        </div>
      )}

      {result.dataIssues.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 8,
            padding: '9px 11px',
            borderRadius: 12,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>
            Проверьте единицы — иначе вывод будет неверным
          </div>
          {result.dataIssues.map((d) => (
            <div key={d.code} style={{ fontSize: 9, color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>
              • <strong>{d.title}</strong> — {d.hint}
            </div>
          ))}
        </div>
      )}

      {/* ── Тело и белок ──────────────────────────────────────────────────── */}
      <MhSection icon="⚖️" title="Тело и белок" hint="Отсюда берётся знаменатель для г/кг" accent="#60a5fa">
        <MhGrid>
          <MhNum
            label="Вес"
            value={state.weightKg}
            min={30}
            max={250}
            suffix=" кг"
            onChange={(v) => setRequired('weightKg', v)}
          />
          <MhNum
            label="Рост"
            value={state.heightCm}
            min={120}
            max={230}
            suffix=" см"
            onChange={(v) => setRequired('heightCm', v)}
          />
          <MhNum
            label="Возраст"
            value={state.age}
            min={14}
            max={100}
            suffix=" лет"
            onChange={(v) => setRequired('age', v)}
          />
          <MhNum
            label="Белок сейчас"
            value={state.proteinGPerDay}
            min={0}
            max={1500}
            suffix=" г/сут"
            hint="до 5 г/кг; выше 3.2 — под контролем врача"
            onChange={(v) => setRequired('proteinGPerDay', v)}
          />
          <MhNum
            label="Приёмов пищи"
            value={state.mealsPerDay}
            min={1}
            max={8}
            suffix=""
            onChange={(v) => setRequired('mealsPerDay', v)}
          />
          <MhNum label="% жира (необяз.)" {...numberProps('bodyFatPct')} min={3} max={60} suffix=" %" optional />
          <MhNum
            label="Вода (необяз.)"
            {...numberProps('waterMlPerDay')}
            min={0}
            max={8000}
            step={100}
            suffix=" мл/сут"
            optional
          />
          <MhNum
            label="Натрий рациона"
            {...numberProps('dietarySodiumG')}
            min={0}
            max={15}
            step={0.1}
            suffix=" г"
            optional
            hint="Поваренная соль ×0.4 = натрий"
          />
          <MhNum
            label="Калий рациона"
            {...numberProps('dietaryPotassiumG')}
            min={0}
            max={12}
            step={0.1}
            suffix=" г"
            optional
          />
        </MhGrid>

        <div style={{ marginTop: 8 }}>
          <Segment
            label="Пол"
            hint="нужен для CKD-EPI 2021"
            options={[
              { v: 'male', t: 'Мужской' },
              { v: 'female', t: 'Женский' },
            ]}
            value={state.sex}
            onChange={(v) => setState((s) => ({ ...s, sex: v as PkSex }))}
            accent="#a78bfa"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <Segment
            label="Уровень тренировок"
            options={TRAIN_OPTIONS.map((o) => ({ v: o.v, t: o.t, d: o.d }))}
            value={state.training}
            onChange={(v) => setState((s) => ({ ...s, training: v as PkTraining }))}
          />
        </div>
        <div style={{ display: 'flex', marginTop: 8 }}>
          <Segment
            label="Цель"
            options={GOAL_OPTIONS.map((o) => ({ v: o.v, t: o.t }))}
            value={state.goal}
            onChange={(v) => setState((s) => ({ ...s, goal: v as PkGoal }))}
            accent="#22c55e"
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          <Pep color="#60a5fa">{`${result.proteinGPerKg} г/кг сейчас`}</Pep>
          {result.bmi != null && <Pep color="#94a3b8">{`ИМТ ${result.bmi}`}</Pep>}
          {result.leanMassKg != null && <Pep color="#a78bfa">{`Тощая масса ≈${result.leanMassKg} кг`}</Pep>}
          {result.proteinGPerKgLbm != null && (
            <Pep color="#a78bfa">{`${result.proteinGPerKgLbm} г/кг тощей массы`}</Pep>
          )}
          {result.benefitCapLbmGPerKg != null && (
            <Pep color="#60a5fa">{`польза ≈ до ${result.benefitCapLbmGPerKg} г/кг LBM`}</Pep>
          )}
          {result.toleranceCapLbmGPerKg != null && (
            <Pep color="#22c55e">{`переносимость ≈ до ${result.toleranceCapLbmGPerKg} г/кг LBM`}</Pep>
          )}
          {state.aasUse && <Pep color="#f97316">ААС: СКФ подтверждать цистатином C</Pep>}
        </div>

        <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>
          Калькулятор оценивает белок до 5 г/кг. Выше 3.2 г/кг доказанной переносимости нет — такие режимы только под
          наблюдением врача и с контролем анализов каждые 7–14 дней.
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, marginTop: 8 }}
        >
          <MhToggle
            checked={state.creatineUse}
            onChange={(v) => setState((s) => ({ ...s, creatineUse: v }))}
            icon="💊"
            title="Принимаю креатин"
            desc="креатинин может быть выше нормы"
            compact
          />
          <MhToggle
            checked={state.knownCkd}
            onChange={(v) => setState((s) => ({ ...s, knownCkd: v }))}
            icon="🏥"
            title="Есть диагноз ХБП"
            desc="потолок 0.8 г/кг"
            accent="#f59e0b"
            compact
          />
          <MhToggle
            checked={state.aasUse === true}
            onChange={(v) => setState((s) => ({ ...s, aasUse: v }))}
            icon="💉"
            title="Принимаю ААС"
            desc="креатинин завышен мышцами → цистатин C"
            accent="#f97316"
            compact
          />
          <MhToggle
            checked={state.hypertension === true}
            onChange={(v) => setState((s) => ({ ...s, hypertension: v }))}
            icon="🫀"
            title="Есть гипертония"
            desc="цель АД <130/80"
            accent="#ef4444"
            compact
          />
          <MhToggle
            checked={state.diabetes === true}
            onChange={(v) => setState((s) => ({ ...s, diabetes: v }))}
            icon="🩸"
            title="Есть диабет"
            desc="UACR раз в год"
            accent="#eab308"
            compact
          />
          <MhToggle
            checked={state.nsaidUse === true}
            onChange={(v) => setState((s) => ({ ...s, nsaidUse: v }))}
            icon="💊"
            title="Принимаю НПВС"
            desc="ибупрофен/напроксен"
            accent="#f59e0b"
            compact
          />
        </div>
      </MhSection>

      {/* ── Кровь ─────────────────────────────────────────────────────────── */}
      <MhSection icon="🩸" title="Кровь" hint="CKD-EPI 2021; цистатин C точнее на ААС/креатине" accent="#f97316">
        <MhGrid cols={3}>
          <MhNum
            label="Мочевина"
            {...numberProps('ureaMmolL')}
            min={0}
            max={60}
            step={0.1}
            suffix=" ммоль/л"
            optional
          />
          <MhNum
            label="Креатинин"
            {...numberProps('creatinineUmolL')}
            min={0}
            max={2000}
            step={1}
            suffix=" мкмоль/л"
            optional
          />
          <MhNum
            label="Цистатин C"
            {...numberProps('cystatinCMgL')}
            min={0.2}
            max={10}
            step={0.01}
            suffix=" мг/л"
            optional
            hint="если есть в бланке"
          />
          <MhNum label="СКФ (из лабы)" {...numberProps('egfrMeasured')} min={0} max={200} suffix=" мл/мин" optional />
        </MhGrid>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          <Pep color="#a78bfa">{`СКФ: ${result.egfr != null ? `${result.egfr} · ${GFR_CATEGORY_LABEL[result.gfrCategory]}` : 'нужен креатинин'}`}</Pep>
          <Pep color={result.egfrSource === 'measured' ? '#22c55e' : '#60a5fa'}>
            {result.egfrSource === 'measured'
              ? 'из лаборатории'
              : result.egfrSource === 'ckd-epi'
                ? 'CKD-EPI 2021'
                : 'нет данных'}
          </Pep>
          {result.bunCreatinineRatio != null && (
            <Pep
              color={result.bunCrPattern === 'high' ? '#f59e0b' : result.bunCrPattern === 'low' ? '#60a5fa' : '#22c55e'}
            >
              {`BUN/Cr ${result.bunCreatinineRatio}`}
            </Pep>
          )}
        </div>
      </MhSection>

      {/* ── ОАМ ───────────────────────────────────────────────────────────── */}
      <MhSection
        icon="🧫"
        title="Общий анализ мочи"
        hint="Плотность, белок, осадок — главные данные для вывода"
        accent="#22c55e"
      >
        <MhGrid cols={3}>
          <MhNum
            label="Плотность (SG)"
            {...numberProps('urineSg')}
            min={1}
            max={1.06}
            step={0.001}
            optional
            hint="Например 1.020"
          />
          <MhNum label="pH мочи" {...numberProps('urinePh')} min={4} max={9} step={0.1} optional />
          <MhNum
            label="Белок мочи"
            {...numberProps('urineProteinGL')}
            min={0}
            max={20}
            step={0.01}
            suffix=" г/л"
            optional
          />
          <MhNum
            label="Микроальбумин"
            {...numberProps('microalbuminMgL')}
            min={0}
            max={5000}
            step={1}
            suffix=" мг/л"
            optional
          />
          <MhNum
            label="Креатинин мочи"
            {...numberProps('urineCreatinineMmolL')}
            min={0}
            max={60}
            step={0.1}
            suffix=" ммоль/л"
            optional
            hint="нужен для UACR"
          />
          <MhNum
            label="UACR"
            {...numberProps('uacrMgMmol')}
            min={0}
            max={1000}
            step={0.1}
            suffix=" мг/ммоль"
            optional
          />
          <MhNum label="Лейкоциты мочи" {...numberProps('urineLeuPerUl')} min={0} max={5000} suffix=" /мкл" optional />
          <MhNum label="Эритроциты мочи" {...numberProps('urineEryPerUl')} min={0} max={5000} suffix=" /мкл" optional />
          <MhNum label="Цилиндры" {...numberProps('urineCastsPerUl')} min={0} max={500} suffix=" /мкл" optional />
          <MhNum
            label="Суточный диурез"
            {...numberProps('urineVolume24hMl')}
            min={0}
            max={6000}
            step={50}
            suffix=" мл"
            optional
          />
        </MhGrid>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          <Pep color="#22c55e">{`Белок мочи: ${ALBUMINURIA_LABEL[result.albuminuriaCategory]}`}</Pep>
          {result.uacrMgMmol != null && <Pep color="#60a5fa">{`UACR ${result.uacrMgMmol} мг/ммоль`}</Pep>}
          {result.urineOsmolality != null && (
            <Pep color="#a78bfa">{`≈${result.urineOsmolality} мОсм/кг (оценка по SG)`}</Pep>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <ScorePicker
            label="Белок в тест-полоске"
            value={state.urineProteinScore}
            onChange={(v) => setOptional('urineProteinScore', v)}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <ScorePicker
            label="Нитриты"
            value={state.urineNitriteScore}
            onChange={(v) => setOptional('urineNitriteScore', v)}
            options={[
              { v: 0, t: 'отр' },
              { v: 1, t: 'полож.' },
            ]}
            accent="#ef4444"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <ScorePicker
            label="Глюкоза мочи"
            value={state.urineGlucoseScore}
            onChange={(v) => setOptional('urineGlucoseScore', v)}
            accent="#eab308"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <ScorePicker
            label="Кетоны мочи"
            value={state.urineKetonesScore}
            onChange={(v) => setOptional('urineKetonesScore', v)}
            accent="#a78bfa"
          />
        </div>
      </MhSection>

      {/* ── Усвоение: прямой ответ ────────────────────────────────────────── */}
      <MhSection
        icon="🧬"
        title="Усваивается ли белок"
        hint="Ответ по мочевине, креатинину/СКФ и белку мочи"
        accent={util.color}
        right={
          <Pep color={util.color}>
            {util.confidence === 'high'
              ? 'данных достаточно'
              : util.confidence === 'medium'
                ? 'частичные данные'
                : 'мало данных'}
          </Pep>
        }
      >
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: `${util.color}12`,
            border: `1px solid ${util.color}44`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, color: util.color, lineHeight: 1.25 }}>{util.label}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, marginTop: 4 }}>
            {util.detail}
          </div>
          {util.markers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {util.markers.map((m) => (
                <Pep key={m} color={util.color}>
                  {m}
                </Pep>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45, marginTop: 6 }}>
          Честная рамка: ни ОАМ, ни мочевина не измеряют всасывание или синтез в мышцах. Они показывают, как выводится
          азот из белка: норма = нагрузка переносится, рост мочевины = избыток окисляется.
        </div>
      </MhSection>

      {/* ── Вердикт ───────────────────────────────────────────────────────── */}
      <MhSection
        icon="🎯"
        title="Вердикт"
        hint="Два потолка: польза — плато дозы, переносимость — по анализам"
        accent={result.color}
        right={<Pep color={result.color}>{result.levelLabel}</Pep>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
          <MhTile label="Индекс" value={result.score} sub="из 100" color={result.color} accent={result.color} />
          <MhTile
            label="Польза"
            value={`${result.benefitCapGPerKg}`}
            sub={`${result.benefitCapGPerDay} г/сут`}
            color="#fff"
            accent="#60a5fa"
          />
          <MhTile
            label="Переносимость"
            value={toleranceValue}
            sub={toleranceSub}
            color="#fff"
            accent={result.extreme ? '#f97316' : '#a78bfa'}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, marginTop: 6 }}>
          <MhTile
            label="Запас пользы"
            value={result.headroomGPerDay > 0 ? `+${result.headroomGPerDay}` : `−${overBenefitG}`}
            sub="г/сут"
            color={result.headroomGPerDay > 0 ? '#22c55e' : '#eab308'}
            accent={result.headroomGPerDay > 0 ? '#22c55e' : '#eab308'}
          />
          <MhTile
            label="Запас переносимости"
            value={toleranceHeadValue}
            sub={toleranceHeadSub}
            color={toleranceHeadColor}
            accent={toleranceHeadColor}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 6px' }}>
          <MhBar
            v={result.proteinGPerKg}
            max={barMax}
            color={statusColor}
            label={`Сейчас ${result.proteinGPerKg} г/кг`}
          />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
            {result.toleranceAssessed ? `переносимость ${result.capGPerKg}` : `польза ${result.benefitCapGPerKg}`}
          </span>
        </div>

        <div
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            fontSize: 10,
            lineHeight: 1.45,
            background: `${statusColor}10`,
            border: `1px solid ${statusColor}33`,
            color: '#fff',
          }}
        >
          <strong style={{ color: statusColor }}>{statusText}.</strong> Сейчас {result.proteinGPerDay} г/сут (
          {result.proteinGPerKg} г/кг).
          {result.extreme
            ? ` Это выше 3.2 г/кг — вне доказанной переносимости. 5 г/кг — верхняя граница калькулятора, а не безопасная норма: нужны врач (нефролог/спортмедицина) и контроль анализов каждые 7–14 дней.${result.status === 'above_tolerance' ? ` При этом белок на ${overToleranceG} г/сут выше потолка переносимости ${result.capGPerDay} г/сут — сначала снижение до него.` : ''}`
            : result.status === 'above_tolerance'
              ? ` Это на ${overToleranceG} г/сут больше потолка переносимости ${result.capGPerDay} г/сут — сначала снижение, потом любые прибавки.`
              : result.status === 'above_benefit'
                ? result.aasEgfrUnverified
                  ? ' Выше ориентира пользы. Снижать до потолка не обязательно: СКФ по креатинину на ААС может быть занижена мышцами. Но наращивать можно только после цистатина C.'
                  : result.toleranceVerified
                    ? ` Дополнительной пользы сверх ${result.benefitCapGPerKg} г/кг в среднем не доказано (лишние ${overBenefitG} г/сут), но переносимость позволяет до ${result.capGPerDay} г/сут.`
                    : ` Дополнительной пользы сверх ${result.benefitCapGPerKg} г/кг в среднем не доказано (лишние ${overBenefitG} г/сут), а переносимость выше не подтверждена — для роста нужны чистые анализы.`
                : result.status === 'within'
                  ? ` В пределах ориентира пользы — до ${result.benefitCapGPerDay} г/сут.`
                  : ' Ниже физиологичного минимума: сначала доберите базовый белок.'}
          {result.increaseAllowed && !result.increasePaused
            ? ` Прибавка рекомендуется: +${result.headroomGPerDay} г/сут шагами по 5–15 г.`
            : result.increasePaused
              ? ' Прибавка на паузе до нормализации анализов.'
              : result.extreme
                ? result.status === 'above_tolerance'
                  ? ' Сначала вернитесь к потолку переносимости.'
                  : ' Дальше — только под наблюдением врача и с контролем каждые 7–14 дней.'
                : result.canIncreaseToTolerance
                  ? ` По переносимости можно до ${result.capGPerDay} г/сут (+${result.toleranceHeadroomGPerDay} г), но дополнительного прироста это в среднем не даёт.`
                  : result.status === 'above_tolerance'
                    ? ' Сначала вернитесь к потолку.'
                    : ' Прибавка сейчас не рекомендуется.'}
        </div>

        {result.capReasons.length > 1 && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              Почему потолки такие
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {result.capReasons.map((r, i) => (
                <Pep key={i} color={i === 0 ? '#60a5fa' : '#f59e0b'}>
                  {r}
                </Pep>
              ))}
            </div>
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 10,
            fontSize: 9,
            lineHeight: 1.5,
            background: 'rgba(96,165,250,0.06)',
            border: '1px solid rgba(96,165,250,0.2)',
            color: 'rgba(255,255,255,0.68)',
          }}
        >
          <strong style={{ color: '#60a5fa' }}>Откуда «потолок пользы».</strong> {result.benefitBasis}. Это не «белок
          вреден выше» — это среднее плато дозы: прирост мышц перестаёт ускоряться. Индивидуально выше проверяется
          только анализами (переносимость).
        </div>
      </MhSection>

      {/* ── Когда пересдать ───────────────────────────────────────────────── */}
      <MhSection
        icon="📅"
        title="Когда пересдать анализы"
        hint="Дата уже посчитана — от неё зависит следующий шаг с белком"
        accent={result.retest.color}
        right={
          <Pep color={result.retest.color}>
            {result.retest.afterDays === 0 ? 'сейчас' : `через ${result.retest.afterDays} дн.`}
          </Pep>
        }
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 12,
            background: `${result.retest.color}10`,
            border: `1px solid ${result.retest.color}38`,
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: result.retest.color, letterSpacing: -0.3 }}>
            {formatRuDate(result.retest.date)}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{result.retest.title}</div>
        </div>
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.68)', lineHeight: 1.45, marginTop: 7 }}>
          {result.retest.reason}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
          {result.retest.items.map((it) => (
            <Pep key={it} color={result.retest.color}>
              {it}
            </Pep>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCopySummary}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 800,
              background: 'rgba(96,165,250,0.14)',
              border: '1px solid rgba(96,165,250,0.35)',
              color: '#93c5fd',
            }}
          >
            Скопировать для врача
          </button>
          <button
            type="button"
            onClick={onDownloadIcs}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 800,
              background: 'rgba(148,163,184,0.12)',
              border: '1px solid rgba(148,163,184,0.28)',
              color: '#cbd5e1',
            }}
          >
            В календарь (.ics)
          </button>
        </div>
        {savedMsg && (
          <div role="status" aria-live="polite" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
            {savedMsg}
          </div>
        )}
      </MhSection>

      {/* ── Сигналы ───────────────────────────────────────────────────────── */}
      <MhSection
        icon="📊"
        title="Из чего сложился индекс"
        hint="Чем выше балл, тем осторожнее с белком"
        accent="#a78bfa"
      >
        {result.signals.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ minWidth: 84 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{s.label}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{s.value}</div>
            </div>
            <MhBar v={s.points} max={s.max} color={s.color} />
            <span style={{ fontSize: 9, fontWeight: 800, color: s.color, minWidth: 34, textAlign: 'right' }}>
              {s.points}/{s.max}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.42)', lineHeight: 1.4, marginTop: 2 }}>
          Индекс — не диагноз: он показывает, насколько осторожно стоит менять белок, пока анализы не перепроверены.
        </div>
      </MhSection>

      {/* ── Вода и осмолярная нагрузка ────────────────────────────────────── */}
      <MhSection
        icon="💧"
        title="Вода и осмолярная нагрузка"
        hint="RSL: ~5.8 мОсм на 1 г белка + электролиты"
        accent="#38bdf8"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
          <MhTile label="RSL" value={result.rslMOsmPerDay} sub="мОсм/сут" accent="#38bdf8" />
          <MhTile label="Моча нужна" value={result.urineVolumeNeededMl} sub="мл/сут при 600 мОсм/кг" accent="#38bdf8" />
          <MhTile label="Вода цель" value={result.waterTargetMl} sub="мл/сут" accent="#22c55e" color="#22c55e" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          <Pep color={hydrationTone}>{`Гидратация: ${HYDRATION_LABEL[result.hydrationStatus]}`}</Pep>
          <Pep
            color={
              result.concentrationRisk === 'high'
                ? '#ef4444'
                : result.concentrationRisk === 'moderate'
                  ? '#f59e0b'
                  : '#22c55e'
            }
          >
            {`Концентрация: ${RISK_LABEL[result.concentrationRisk]}`}
          </Pep>
          {result.waterDeficitMl != null && result.waterDeficitMl > 0 && (
            <Pep color="#f59e0b">{`Не хватает ~${result.waterDeficitMl} мл`}</Pep>
          )}
          {!result.rslElectrolytesKnown && <Pep color="rgba(255,255,255,0.55)">электролиты не заданы</Pep>}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45, marginTop: 6 }}>
          {result.rslElectrolytesKnown
            ? `Из них белок даёт ${result.rslProteinPart} мОсм, электролиты — ${result.rslElectrolytePart} мОсм.`
            : `Белок даёт ${result.rslProteinPart} мОсм; натрий/калий не заданы, поэтому цель по воде может быть занижена.`}
        </div>
      </MhSection>

      {/* ── План прибавки ─────────────────────────────────────────────────── */}
      <MhSection
        icon="🪜"
        title="План прибавки"
        hint={
          result.canIncreaseToTolerance && !result.increaseAllowed
            ? 'Выше пользы — только по переносимости, с контролем'
            : 'Шаг 5–15 г/сут, контроль через 10–14 дней'
        }
        accent={planTone}
        right={<Pep color={planTone}>{planLabel}</Pep>}
      >
        {result.increasePaused && result.pauseReason && (
          <div style={{ fontSize: 10, color: '#f59e0b', lineHeight: 1.45, marginBottom: 8 }}>{result.pauseReason}</div>
        )}
        {result.steps.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.steps.map((st, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 9px',
                  borderRadius: 9,
                  background: st.beyondBenefit ? 'rgba(234,179,8,0.06)' : 'rgba(34,197,94,0.06)',
                  border: `1px solid ${st.beyondBenefit ? 'rgba(234,179,8,0.20)' : 'rgba(34,197,94,0.18)'}`,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    background: st.beyondBenefit ? 'rgba(234,179,8,0.18)' : 'rgba(34,197,94,0.18)',
                    color: st.beyondBenefit ? '#eab308' : '#22c55e',
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    {st.totalProteinG} г/сут · {st.gPerKg} г/кг
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{st.note}</div>
                </div>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                  день {st.afterDays}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>
            {result.status === 'above_tolerance'
              ? 'Шагов вверх нет: сначала вернитесь к потолку переносимости и перепроверьте анализы.'
              : 'Шагов нет, пока не появятся запас по белку и нормальные анализы.'}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', fontWeight: 600, marginBottom: 4 }}>
            Что если добавить, г/сут
          </div>
          <MhNum
            label="Планируемая прибавка"
            {...numberProps('plannedIncreaseGPerDay')}
            min={0}
            max={1000}
            step={5}
            suffix=" г/сут"
            optional
          />
          {result.planned &&
            (() => {
              const withinBoth = result.planned.withinBenefit && result.planned.withinTolerance;
              const tone = withinBoth ? '#22c55e' : result.planned.withinTolerance ? '#eab308' : '#ef4444';
              return (
                <div
                  style={{
                    marginTop: 6,
                    padding: '7px 9px',
                    borderRadius: 9,
                    fontSize: 10,
                    lineHeight: 1.45,
                    background: `${tone}14`,
                    border: `1px solid ${tone}40`,
                  }}
                >
                  Итого {result.planned.totalG} г/сут · {result.planned.gPerKg} г/кг.{' '}
                  {!result.planned.withinTolerance
                    ? 'Выше потолка переносимости — так делать не стоит до повторных анализов.'
                    : result.planned.withinBenefit
                      ? `Влезает в потолок пользы. Добавьте ~${result.planned.extraWaterMl} мл воды, чтобы вывести новые осмоли.`
                      : `Переносимость это позволяет, но дополнительной пользы сверх ${result.benefitCapGPerKg} г/кг в среднем не доказано: мышцам добавка ничего не даст, только лишний азот. Только при реальной причине и с контролем анализов.`}
                </div>
              );
            })()}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          <Pep color="#60a5fa">{`~${result.perMealProteinG} г белка/приём`}</Pep>
          <Pep color="#60a5fa">{`ориентир 0.4 г/кг, предел ${result.maxPerMealProteinG} г`}</Pep>
          <Pep color="#a78bfa">{`приёмов: ${result.recommendedMeals}`}</Pep>
        </div>
      </MhSection>

      {/* ── Флаги и рекомендации ──────────────────────────────────────────── */}
      <MhSection icon="🩺" title="Что требует внимания" hint="Сначала безопасность, потом прибавка" accent="#ef4444">
        {result.flags.length > 0 ? (
          result.flags.map((f) => <FlagCard key={f.code} severity={f.severity} title={f.title} detail={f.detail} />)
        ) : (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
            Критичных отклонений по введённым данным нет.
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          {result.recommendations.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <span style={{ color: '#22c55e', fontSize: 10, lineHeight: 1.45 }}>•</span>
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>{r}</span>
            </div>
          ))}
        </div>
      </MhSection>

      {/* ── История ───────────────────────────────────────────────────────── */}
      <MhSection
        icon="📈"
        title="История замеров"
        hint="Один день — один снимок; сравнение важнее одного числа"
        accent="#f59e0b"
        right={<Pep color="rgba(255,255,255,0.55)">{`${history.length}/30`}</Pep>}
      >
        {historyPoints.length >= 2 && (
          <div style={{ marginBottom: 8 }}>
            <ScoreSpark points={historyPoints.slice(-14)} color="#f59e0b" />
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onSaveSnapshot}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 800,
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              border: 'none',
              color: '#000',
            }}
          >
            Сохранить замер
          </button>
          <button
            type="button"
            onClick={onClearHistory}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            Очистить
          </button>
        </div>
        {savedMsg && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 6 }}>{savedMsg}</div>}

        {history.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {[...history]
              .reverse()
              .slice(0, 6)
              .map((h) => {
                const prev = history.filter((x) => x.date < h.date).slice(-1)[0];
                const delta = prev ? h.score - prev.score : 0;
                return (
                  <div
                    key={h.date}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 8,
                      marginBottom: 4,
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', minWidth: 58 }}>{h.date.slice(5)}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', minWidth: 58 }}>
                      {h.proteinGPerKg} г/кг
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', flex: 1 }}>
                      {h.egfr != null ? `СКФ ${h.egfr}` : 'СКФ —'}
                      {h.ureaMmolL != null ? ` · мочевина ${h.ureaMmolL}` : ''}
                      {h.creatinineUmolL != null ? ` · креатинин ${h.creatinineUmolL}` : ''}
                      {h.urineSg != null ? ` · SG ${h.urineSg}` : ''}
                      {h.uacrMgMmol != null ? ` · UACR ${h.uacrMgMmol}` : ''}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color:
                          h.level === 'low'
                            ? '#22c55e'
                            : h.level === 'moderate'
                              ? '#eab308'
                              : h.level === 'elevated'
                                ? '#f59e0b'
                                : '#ef4444',
                      }}
                    >
                      {h.score}
                    </span>
                    {prev && delta !== 0 && (
                      <span
                        style={{
                          fontSize: 8,
                          color: delta > 0 ? '#ef4444' : '#22c55e',
                          minWidth: 26,
                          textAlign: 'right',
                        }}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </MhSection>

      {/* ── Методика ──────────────────────────────────────────────────────── */}
      <MhSection
        icon="📚"
        title="Методика и источники"
        hint="Что именно считает калькулятор и где он не работает"
        accent="#94a3b8"
        right={
          <Pep color="#94a3b8" onClick={() => setShowMethod((v) => !v)}>
            {showMethod ? 'скрыть' : 'показать'}
          </Pep>
        }
      >
        {showMethod && (
          <div>
            {result.evidence.map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    fontSize: 9,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(148,163,184,0.16)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(148,163,184,0.3)',
                  }}
                >
                  {e.grade}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>{e.text}</span>
              </div>
            ))}
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.42)', lineHeight: 1.45, marginTop: 4 }}>
              Уровни: A — руководства/крупные исследования, B — физиология и валидированные формулы, C — приближения, E
              — экспертное мнение. Оценка по SG ломается при глюкозе, контрасте и массивной протеинурии.
            </div>
          </div>
        )}
        <div
          style={{
            marginTop: showMethod ? 8 : 0,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            fontSize: 9,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.45,
          }}
        >
          {result.disclaimer}
        </div>
      </MhSection>
    </div>
  );
};

export default ProteinKidneyPanel;
