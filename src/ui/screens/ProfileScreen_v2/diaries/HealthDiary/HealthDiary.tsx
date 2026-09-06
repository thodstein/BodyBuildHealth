import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors, withAlpha } from '../../ui';
import { NativeIcon } from '../../../../native/NativeIcons';
import { AddHealthModal } from '../../health-diary-modal';
import {
  btnBase,
  btnPrimary,
  chip,
  chipActive,
  glassSection,
  main as pageMain,
  statCard,
  tableTh,
  tableTd,
} from '../diary-page-styles';
import { DiaryHeader } from '../DiaryHeader';
import {
  addUnifiedHealthEntry,
  deleteUnifiedHealthEntry,
  getUnifiedAcneStats,
  getUnifiedHealthEntries,
  getUnifiedHematoStats,
  getUnifiedNeuroStats,
  getUnifiedPainStats,
  getUnifiedSymptomsStats,
  getUnifiedSymptomSummary,
  getUnifiedTodayStatus,
  saveUnifiedHealthEntries,
  updateUnifiedHealthEntry,
  type UnifiedHealthEntry,
} from '../../../../../engines/health-diary.engine';
import { analyzePainEntries } from '../../../../../engines/pain-insights.engine';
import { computeHealthScore, type HealthScoreOutput } from '../../../../../engines/health-score-v2.engine';
import {
  analyzeHealthProfile,
  generateHealthPlan,
  exportHealthPlanText,
  exportHealthReportText,
  loadPlanDone,
  savePlanDone,
  saveHealthPlan,
  loadHealthPlan,
  type HealthPlanCtx,
  type HealthPlan as HealthPlanType,
} from '../../../../../engines/health-improvement-plan.engine';
import {
  buildWeeklyHistogram,
  compareWithLastWeek,
  computeDistribution,
  computeExtremes,
  computeStreak,
  crossCorrelation,
  detectAnomalies,
  escapeHtml,
  exportSvgAsFile,
  exportSvgAsPng,
  fitLinearTrend,
  getNormalRange,
  laggedCorrelation,
  paginate,
  projectToDate,
  sortEntries,
  todayIso,
  type DiaryEntryLike,
  type SortState,
} from '../../diary-helpers';
import { PAIN_ZONES, NEURO_SYMPTOMS, ACNE_AREAS, HEMATO_SYMPTOMS, painZoneColor, readDiaryEntries } from '../../diary-modals';
import { PainZone3D } from './PainZone3D';
import { getProfile } from '../../../../../core/profile-manager';
import type { UnifiedSettings } from '../../../../../core/types';
import { calculateRiskScore } from '../../../../../engines/risk-calculator.engine';
import { getLabDiary } from '../../../../../engines/lab-diary.engine';
import { loadSessions } from '../../../../../engines/workout-logger.engine';
import type { DiaryWindowProps } from '../../DiaryWindow';

const ACCENT = '#ec4899';
const EDIT_DRAFT_KEY = 'he_draft_health_edit';
const PAIN_MAX = PAIN_ZONES.length * 10;

const button: React.CSSProperties = { ...btnBase(ACCENT) };
const card: React.CSSProperties = { ...glassSection };
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  minHeight: 38,
  fontFamily: 'inherit',
};

type Symptom = UnifiedHealthEntry['symptoms'][number];
type EntryDraft = Omit<UnifiedHealthEntry, 'id' | 'createdAt' | 'updatedAt'>;

const emptyDraft = (): EntryDraft => ({
  date: todayIso(),
  pain: null,
  symptoms: [],
  neuro: null,
  acne: null,
  hemato: null,
  notes: '',
});
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const score = (values: Record<string, number | boolean>): number =>
  Object.values(values).reduce<number>((n, v) => n + (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0), 0);

function entryFields(entry: UnifiedHealthEntry): DiaryEntryLike {
  const pain = entry.pain?.totalScore || 0;
  const neuro = entry.neuro?.totalScore || 0;
  const acne = entry.acne?.totalScore || 0;
  const hemato = entry.hemato?.totalScore || 0;
  const painMax = PAIN_ZONES.length * 10;
  const fields = [
    { label: 'Боль', value: String(pain), unit: `/${painMax}` },
    { label: 'Нейро', value: String(neuro), unit: '/10' },
    { label: 'Акне', value: String(acne), unit: '/12' },
    { label: 'Гемат', value: String(hemato), unit: '/8' },
    { label: 'Симптомы', value: String(Array.isArray(entry.symptoms) ? entry.symptoms.length : 0), unit: 'шт.' },
  ];
  if (entry.pain?.timeOfDay) fields.push({ label: 'Время', value: entry.pain.timeOfDay, unit: '' });
  if (entry.pain?.painType) fields.push({ label: 'Тип', value: entry.pain.painType, unit: '' });
  if (entry.pain?.triggers && entry.pain.triggers.length > 0) fields.push({ label: 'Триггеры', value: String(entry.pain.triggers.length), unit: '' });
  if (entry.pain?.linkedExercise) fields.push({ label: 'Упр.', value: entry.pain.linkedExercise, unit: '' });
  if (entry.notes) fields.push({ label: 'Заметка', value: entry.notes, unit: '' });
  return { date: entry.date, fields };
}

function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Индекс здоровья из реальных данных (профиль v2, дневники, labs, тренировки) с безопасными фолбэками. */
function computeRealHealthScore(): HealthScoreOutput {
  let settings: UnifiedSettings | null = null;
  try { settings = getProfile().settings; } catch { settings = null; }

  let pharmaRisk = 0;
  try {
    const ids = (settings?.pharma?.currentSubstances || []).map((s) => s.id).filter(Boolean);
    if (ids.length > 0) {
      const r = calculateRiskScore(ids);
      pharmaRisk = Math.min(100, Math.max(0, 100 - r.score));
    }
  } catch { pharmaRisk = 0; }

  let weeksSinceLab = 52;
  try {
    const dates = getLabDiary().map((d) => Date.parse(d.date)).filter(Number.isFinite);
    if (dates.length > 0) weeksSinceLab = Math.max(0, (Date.now() - Math.max(...dates)) / (7 * 86400000));
  } catch { weeksSinceLab = 52; }

  let sleepScore = 70;
  try {
    const hours = readDiaryEntries<{ hours?: number }>('he_sleep_diary')
      .map((r) => Number(r.hours)).filter((v) => Number.isFinite(v) && v > 0);
    if (hours.length > 0) sleepScore = Math.round(Math.min(100, ((hours.reduce((s, v) => s + v, 0) / hours.length) / 8) * 100));
  } catch {}

  let hrvScore = 50;
  let subjectiveStress = 5;
  let subjectiveEnergy = 3;
  try {
    const hrv = Number(settings?.lifestyle?.morningHRV) || 0;
    if (hrv > 0) hrvScore = Math.round(Math.min(100, (hrv / 65) * 100));
    const stressRaw = Number(settings?.lifestyle?.stressLevel);
    if (Number.isFinite(stressRaw) && stressRaw > 0) subjectiveStress = Math.max(1, Math.min(5, Math.round(stressRaw / 2)));
    const fatigueRaw = Number(settings?.lifestyle?.fatigueLevel);
    if (Number.isFinite(fatigueRaw) && fatigueRaw > 0) subjectiveEnergy = Math.max(1, Math.min(5, 6 - Math.round(fatigueRaw / 2)));
  } catch {}

  let weightTrend = 0;
  try {
    const ws = readDiaryEntries<{ date?: string; weight?: number }>('he_weight_log')
      .map((r) => ({ date: r.date || '', weight: Number(r.weight) }))
      .filter((x) => x.date && Number.isFinite(x.weight) && x.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (ws.length >= 2) {
      const days = (Date.parse(ws[ws.length - 1].date) - Date.parse(ws[0].date)) / 86400000;
      if (days > 0) weightTrend = ((ws[ws.length - 1].weight - ws[0].weight) / days) * 7;
    }
  } catch {}

  let trainingConsistency = 0;
  try {
    const cutoff = Date.now() - 28 * 86400000;
    const recent = loadSessions().filter((s) => {
      const t = Date.parse(s.date || '');
      return Number.isFinite(t) && t >= cutoff;
    }).length;
    trainingConsistency = Math.min(100, Math.round((recent / (4 * 3.5)) * 100));
  } catch {}

  return computeHealthScore({
    pharmaRisk,
    weeksSinceLab,
    nutritionAdherence: 70,
    trainingConsistency,
    sleepScore,
    hrvScore,
    weightTrend,
    subjectiveEnergy,
    subjectiveStress,
  });
}

/** Контекст для плана улучшений: сон / АД / курс / вес-тренд из соседних дневников и профиля. */
function buildPlanCtx(): HealthPlanCtx {
  let sleepAvg7: number | null = null;
  try {
    const cutoff = Date.now() - 7 * 86400000;
    const hours = readDiaryEntries<{ date?: string; hours?: number }>('he_sleep_diary')
      .filter((r) => {
        const t = Date.parse(r.date || '');
        return Number.isFinite(t) && t >= cutoff;
      })
      .map((r) => Number(r.hours))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (hours.length > 0) sleepAvg7 = Math.round((hours.reduce((s, v) => s + v, 0) / hours.length) * 10) / 10;
  } catch {}

  let bpSystolicLast: number | null = null;
  let bpDiastolicLast: number | null = null;
  try {
    const bpRows = readDiaryEntries<{ date?: string; systolic?: number; diastolic?: number }>('he_bp_diary')
      .filter((r) => Number.isFinite(Number(r.systolic)) && Number.isFinite(Number(r.diastolic)))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const last = bpRows[bpRows.length - 1];
    if (last) {
      bpSystolicLast = Number(last.systolic);
      bpDiastolicLast = Number(last.diastolic);
    }
  } catch {}

  let onCycle = false;
  try {
    onCycle = (getProfile().settings.pharma?.currentSubstances || []).length > 0;
  } catch {}

  let weightTrendKgWeek: number | null = null;
  try {
    const ws = readDiaryEntries<{ date?: string; weight?: number }>('he_weight_log')
      .map((r) => ({ date: r.date || '', weight: Number(r.weight) }))
      .filter((x) => x.date && Number.isFinite(x.weight) && x.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (ws.length >= 2) {
      const days = (Date.parse(ws[ws.length - 1].date) - Date.parse(ws[0].date)) / 86400000;
      if (days > 0) weightTrendKgWeek = Math.round(((ws[ws.length - 1].weight - ws[0].weight) / days) * 7 * 10) / 10;
    }
  } catch {}

  return { sleepAvg7, bpSystolicLast, bpDiastolicLast, weightTrendKgWeek, onCycle };
}

const FieldGroup: React.FC<{ title: string; color?: string; children: React.ReactNode }> = ({
  title,
  color = colors.primary,
  children,
}) => (
  <section style={{ ...card, marginBottom: 10, borderColor: `${withAlpha(color, '55')}` }}>
    <h3 style={{ margin: '0 0 9px', fontSize: 13, color }}>{title}</h3>
    {children}
  </section>
);

const ToggleGrid: React.FC<{
  items: readonly { id: string; label: string }[];
  values: Record<string, boolean>;
  onChange: (id: string) => void;
  color: string;
}> = ({ items, values, onChange, color }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 5 }}>
    {items.map((item) => {
      const active = !!values[item.id];
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          style={{
            ...button,
            minHeight: 44,
            textAlign: 'left',
            borderColor: active ? color : 'rgba(255,255,255,0.12)',
            background: active ? `${withAlpha(color, '22')}` : 'rgba(255,255,255,0.04)',
            color: active ? color : colors.text,
          }}
        >
          {active ? '✓ ' : ''}
          {item.label}
        </button>
      );
    })}
  </div>
);

const EntryEditor: React.FC<{
  entry?: UnifiedHealthEntry;
  onCancel: () => void;
  onSave: (draft: EntryDraft) => void;
}> = ({ entry, onCancel, onSave }) => {
  const [draft, setDraft] = useState<EntryDraft>(() =>
    entry
      ? clone({
          date: entry.date,
          pain: entry.pain,
          symptoms: entry.symptoms,
          neuro: entry.neuro,
          acne: entry.acne,
          hemato: entry.hemato,
          notes: entry.notes || '',
        })
      : emptyDraft(),
  );
  const [symptomName, setSymptomName] = useState('');
  const [symptomSeverity, setSymptomSeverity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [symptomDuration, setSymptomDuration] = useState('');
  // Черновик редактирования (переживает перезагрузку) — localStorage, ключ привязан к дате записи,
  // чтобы черновик одной даты не перетекал в другую. Автоочистка при успешном сохранении.
  const editDraftKey = `${EDIT_DRAFT_KEY}:${entry?.date ?? 'new'}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(editDraftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as EntryDraft;
      if (!d || typeof d.date !== 'string') return;
      // восстанавливаем только если даты совпадают — защита от leak между датами
      if (d.date !== (entry?.date ?? d.date)) return;
      setDraft(d);
    } catch {}
  }, [editDraftKey]);
  useEffect(() => {
    try { localStorage.setItem(editDraftKey, JSON.stringify(draft)); } catch {}
  }, [draft, editDraftKey]);
  const clearEditDraft = () => {
    try { localStorage.removeItem(editDraftKey); } catch {}
  };
  const painZones = draft.pain?.zones || {};
  const neuroValues = draft.neuro?.symptoms || {};
  const acneAreas = draft.acne?.areas || {};
  const hematoValues = draft.hemato?.symptoms || {};
  const setPain = (patch: Partial<NonNullable<EntryDraft['pain']>>) =>
    setDraft((d) => ({ ...d, pain: { zones: {}, totalScore: 0, ...(d.pain || {}), ...patch } }));
  const updateMap = (kind: 'neuro' | 'hemato', id: string) =>
    setDraft((d) => {
      const current = d[kind] || { symptoms: {}, totalScore: 0 };
      const values = { ...current.symptoms, [id]: !current.symptoms[id] };
      return { ...d, [kind]: { symptoms: values, totalScore: score(values) } };
    });
  const updateAcne = (id: string, value: number) =>
    setDraft((d) => {
      const values = { ...(d.acne?.areas || {}), [id]: value };
      return { ...d, acne: { areas: values, totalScore: score(values) } };
    });
  const addSymptom = () => {
    if (!symptomName.trim()) return;
    const s: Symptom = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: symptomName.trim(),
      severity: symptomSeverity,
      duration: symptomDuration.trim() || undefined,
    };
    setDraft((d) => ({ ...d, symptoms: [...d.symptoms, s] }));
    setSymptomName('');
    setSymptomDuration('');
    setSymptomSeverity(2);
  };
  const valid =
    !!draft.date &&
    (draft.symptoms.length > 0 ||
      !!draft.pain?.totalScore ||
      !!draft.neuro?.totalScore ||
      !!draft.acne?.totalScore ||
      !!draft.hemato?.totalScore ||
      !!draft.notes?.trim());
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2200,
        background: 'rgba(0,0,0,.78)',
        display: 'flex',
        overflowY: 'auto',
        padding: 14,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          maxWidth: 650,
          width: '100%',
          margin: 'auto',
          background: '#1a1a1d',
          color: colors.text,
          borderRadius: 15,
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b>{entry ? '✏️ Изменить запись здоровья' : '🩺 Запись здоровья'}</b>
          <button style={button} onClick={onCancel}>
            ✕
          </button>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 10 }}>
          <label>
            Дата
            <input
              type="date"
              max={todayIso()}
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              style={input}
            />
          </label>
          <label>
            Заметка
            <input
              value={draft.notes || ''}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Триггеры, лечение, наблюдения"
              style={input}
            />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, marginBottom: 10 }}>
          <FieldGroup title="Суставная боль: VAS 0–10 по каждой зоне" color="#22c55e">
            <div style={{ display: 'grid', gap: 6 }}>
              {PAIN_ZONES.map((z) => {
                const value = painZones[z.id] || 0;
                return (
                  <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 80, fontSize: 11 }}>{z.label}</span>
                    <input
                      aria-label={`${z.label}: VAS`}
                      type="range"
                      min="0"
                      max="10"
                      value={value}
                      onChange={(e) => {
                        const zones = { ...painZones, [z.id]: Number(e.target.value) };
                        setPain({ zones, totalScore: score(zones) });
                      }}
                      style={{ flex: 1 }}
                    />
                    <b style={{ color: painZoneColor(value), width: 25 }}>{value}</b>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 11 }}>Σ {score(painZones)}/{PAIN_MAX}</div>
          </FieldGroup>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>Нажмите на часть тела — VAS 0–10</div>
            <PainZone3D zones={painZones} onChange={(zones) => setPain({ zones, totalScore: score(zones) })} height={300} />
          </div>
        </div>
        {draft.pain && (
          <FieldGroup title="Детали боли" color="#22c55e">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input
                placeholder="Время (утро/день/вечер)"
                value={draft.pain.timeOfDay || ''}
                onChange={(e) => setPain({ timeOfDay: e.target.value || undefined })}
                style={input}
              />
              <input
                placeholder="Тип боли"
                value={draft.pain.painType || ''}
                onChange={(e) => setPain({ painType: e.target.value || undefined })}
                style={input}
              />
              <input
                placeholder="Триггеры через запятую"
                value={(draft.pain.triggers || []).join(', ')}
                onChange={(e) =>
                  setPain({
                    triggers: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                style={input}
              />
              <input
                placeholder="Что облегчает через запятую"
                value={(draft.pain.relief || []).join(', ')}
                onChange={(e) =>
                  setPain({
                    relief: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                style={input}
              />
              <input
                placeholder="Длительность"
                value={draft.pain.duration || ''}
                onChange={(e) => setPain({ duration: e.target.value || undefined })}
                style={input}
              />
              <input
                placeholder="Связанное упражнение"
                value={draft.pain.linkedExercise || ''}
                onChange={(e) => setPain({ linkedExercise: e.target.value || undefined })}
                style={input}
              />
            </div>
          </FieldGroup>
        )}
        <FieldGroup title="Симптомы" color="#ec4899">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px auto', gap: 5 }}>
            <input
              placeholder="Название симптома"
              value={symptomName}
              onChange={(e) => setSymptomName(e.target.value)}
              style={input}
            />
            <select
              value={symptomSeverity}
              onChange={(e) => setSymptomSeverity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
              style={input}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </select>
            <input
              placeholder="Длительность"
              value={symptomDuration}
              onChange={(e) => setSymptomDuration(e.target.value)}
              style={input}
            />
            <button style={button} onClick={addSymptom}>
              +
            </button>
          </div>
          {draft.symptoms.map((s) => (
            <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 11 }}>
              <span style={{ flex: 1 }}>{s.name}</span>
              <b>{s.severity}/5</b>
              <span>{s.duration || ''}</span>
              <button
                style={{ ...button, minHeight: 30, padding: '3px 8px', color: '#ef4444' }}
                onClick={() => setDraft((d) => ({ ...d, symptoms: d.symptoms.filter((x) => x.id !== s.id) }))}
              >
                ×
              </button>
            </div>
          ))}
        </FieldGroup>
        <FieldGroup title="Нейросимптомы" color="#ef4444">
          <ToggleGrid
            items={NEURO_SYMPTOMS}
            values={neuroValues}
            onChange={(id) => updateMap('neuro', id)}
            color="#ef4444"
          />
          <div style={{ marginTop: 7, fontSize: 11 }}>Отмечено: {score(neuroValues)}/10</div>
        </FieldGroup>
        <FieldGroup title="Акне по зонам" color="#f97316">
          <div style={{ display: 'grid', gap: 6 }}>
            {ACNE_AREAS.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 80, fontSize: 11 }}>{a.label}</span>
                 {[0, 1, 2, 3].map((n) => (
                   <button
                     key={n}
                     style={{
                       ...button,
                       flex: 1,
                       minHeight: 44,
                       padding: '4px 0',
                       color: (acneAreas[a.id] || 0) === n ? '#f97316' : colors.textMuted,
                     }}
                     onClick={() => updateAcne(a.id, n)}
                   >
                     {n}
                   </button>
                 ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 7, fontSize: 11 }}>Σ {score(acneAreas)}/12</div>
        </FieldGroup>
        <FieldGroup title="Гематологические симптомы" color="#3b82f6">
          <ToggleGrid
            items={HEMATO_SYMPTOMS}
            values={hematoValues}
            onChange={(id) => updateMap('hemato', id)}
            color="#3b82f6"
          />
          <div style={{ marginTop: 7, fontSize: 11 }}>Отмечено: {score(hematoValues)}/8</div>
        </FieldGroup>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...button, flex: 1 }} onClick={() => { clearEditDraft(); onCancel(); }}>
            Отмена
          </button>
          <button
            disabled={!valid}
            style={{
              ...button,
              flex: 1,
              background: valid ? colors.primary : 'rgba(255,255,255,0.08)',
              color: valid ? '#07130d' : '#ffffff',
            }}
            onClick={() => { if (valid) { clearEditDraft(); onSave(draft); } }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export const HealthDiary: React.FC<DiaryWindowProps> = ({ open, onClose, onDataChange, onNavigate }) => {
  const [rows, setRows] = useState<UnifiedHealthEntry[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<UnifiedHealthEntry | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [undo, setUndo] = useState<UnifiedHealthEntry[] | null>(null);
  const [subTab, setSubTab] = useState<'overview' | 'painmap'>('overview');
  const [mapZones, setMapZones] = useState<Record<string, number>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (open) setRows(getUnifiedHealthEntries());
  }, [open]);
  useEffect(() => {
    if (open) {
      const last = rows[0]?.pain?.zones || {};
      setMapZones(prev => (Object.keys(prev).length ? prev : last));
    }
  }, [open]);
  const commit = (next: UnifiedHealthEntry[], remember = true) => {
    const ordered = [...next].sort((a, b) => b.date.localeCompare(a.date));
    if (remember) setUndo(clone(rows));
    saveUnifiedHealthEntries(ordered);
    setRows(ordered);
    onDataChange?.();
  };
  const saveNew = (entry: UnifiedHealthEntry) => {
    commit(addUnifiedHealthEntry(entry as EntryDraft), true);
    setAddOpen(false);
    (window as any).showToast?.('✅ Запись здоровья добавлена');
  };
  const saveEdit = (draft: EntryDraft) => {
    const current = edit ? rows.find((r) => r.date === edit.date) : undefined;
    const merged: UnifiedHealthEntry = current
      ? {
          ...clone(current),
          ...clone(draft),
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: new Date().toISOString(),
        }
      : {
          ...clone(draft),
          id: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as UnifiedHealthEntry;
    // Пустая дата недопустима: движок (sanitize) подставил бы «сегодня» молча — делаем явно.
    if (!merged.date) merged.date = todayIso();
    if (current && merged.date === current.date) {
      // Дата не менялась — обычное обновление.
      const result = updateUnifiedHealthEntry(current.date, (entry) => Object.assign(entry, merged));
      commit(result);
    } else {
      // Дата изменилась: удаляем запись со старой даты (и любую на новой),
      // вставляем перенесённую — инвариант «одна запись на дату» сохраняется.
      const rest = rows.filter((r) => r.date !== edit!.date && r.date !== merged.date);
      commit([...rest, merged]);
    }
    setEdit(null);
    (window as any).showToast?.('✅ Запись здоровья обновлена');
  };
  const savePainZones = () => {
    const today = todayIso();
    const totalScore = score(mapZones);
    const existing = rows.find((r) => r.date === today);
    const draft: EntryDraft = {
      date: today,
      pain: { zones: mapZones, totalScore },
      symptoms: existing?.symptoms || [],
      neuro: existing?.neuro || null,
      acne: existing?.acne || null,
      hemato: existing?.hemato || null,
      notes: existing?.notes || '',
    };
    if (existing) {
      const result = updateUnifiedHealthEntry(today, (current) =>
        Object.assign(current, clone(draft), {
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: new Date().toISOString(),
        }),
      );
      commit(result);
    } else {
      commit(addUnifiedHealthEntry(draft), true);
    }
    (window as any).showToast?.('🗺 Зоны боли сохранены в запись за сегодня');
  };
  const fields = useMemo(() => rows.map(entryFields), [rows]);
  // Диапазон (7/30/90) для статов, диаграмм и инсайтов; поиск влияет только на таблицу
  const rangeFields = useMemo(() => {
    if (range === 'all') return fields;
    const cutoff = Date.now() - Number(range) * 86400000;
    return fields.filter((e) => {
      const d = Date.parse(e.date);
      if (Number.isNaN(d)) return true;
      return d >= cutoff;
    });
  }, [fields, range]);
  const visible = useMemo(() => {
    let result = rangeFields;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (e) => e.date.includes(q) || e.fields.some((f) => `${f.label} ${f.value}`.toLowerCase().includes(q)),
      );
    }
    return sortEntries(result, sort);
  }, [rangeFields, query, sort]);
  const pageData = paginate(visible, page, 8);
  const rangeDateSet = useMemo(() => new Set(rangeFields.map((v) => v.date)), [rangeFields]);
  const rangeRows = useMemo(() => rows.filter((e) => rangeDateSet.has(e.date)), [rows, rangeDateSet]);
  const allPoints = useMemo(
    () =>
      rangeRows
        .map((e) => ({ date: e.date, value: e.pain?.totalScore || 0 }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rangeRows],
  );
  const distribution = computeDistribution(allPoints.map((x) => x.value));
  const painRows = rangeRows.filter((e) => e.pain).map((e) => ({ ...e.pain!, date: e.date }));
  const painInsights = analyzePainEntries(painRows);
  const symptomStats = getUnifiedSymptomsStats(rangeRows);
  const symptomSummary = getUnifiedSymptomSummary(rangeRows, 30);
  const stats = {
    pain: getUnifiedPainStats(rangeRows),
    neuro: getUnifiedNeuroStats(rangeRows),
    acne: getUnifiedAcneStats(rangeRows),
    hemato: getUnifiedHematoStats(rangeRows),
  };
  const status = getUnifiedTodayStatus(rows);
  // planCtx пересчитывается при изменении записей — план строится на свежих
  // соседних дневниках (сон/АД/вес), а не на данных момента монтирования.
  const planCtx = useMemo(buildPlanCtx, [rows]);
  const [plan, setPlan] = useState<HealthPlanType>(() => loadHealthPlan() ?? generateHealthPlan(analyzeHealthProfile(rows, planCtx)));
  useEffect(() => {
    if (rows.length === 0) return;
    const fresh = generateHealthPlan(analyzeHealthProfile(rows, planCtx));
    const prevKey = plan.recommendations.map((r) => r.id).join('|');
    const nextKey = fresh.recommendations.map((r) => r.id).join('|');
    if (prevKey === nextKey) return;
    setPlan(fresh);
    saveHealthPlan(fresh);
  }, [rows, planCtx, plan]);
  const [planDone, setPlanDone] = useState<string[]>(() => {
    try { return loadPlanDone(); } catch { return []; }
  });
  /** Сводный анализ зон боли по истории дневника (для 3D-карты). */
  const zoneAnalysis = useMemo(() => {
    const byBase: Record<string, { date: string; v: number }[]> = {};
    for (const r of rows) {
      if (!r.pain?.zones) continue;
      for (const [zone, v] of Object.entries(r.pain.zones)) {
        if (v > 0) {
          const list = byBase[zone] || (byBase[zone] = []);
          list.push({ date: r.date, v });
        }
      }
    }
    const out: Record<string, { last?: number; avg30?: number; count?: number; trend?: 'up' | 'down' | 'stable' | null }> = {};
    const now = Date.now();
    const cutoff30 = now - 30 * 86400000;
    const cutoff14 = now - 14 * 86400000;
    for (const [base, vals] of Object.entries(byBase)) {
      const sorted = [...vals].sort((a, b) => a.date.localeCompare(b.date));
      const recent30 = sorted.filter((x) => {
        const t = Date.parse(x.date);
        return Number.isFinite(t) && t >= cutoff30;
      });
      // Тайм-взвешенный тренд: последние 14д vs предыдущие 14д (30-14). Fallback — половина массива если окон недостаточно.
      let trend: 'up' | 'down' | 'stable' | null = null;
      const recent14 = sorted.filter((x) => {
        const t = Date.parse(x.date);
        return Number.isFinite(t) && t >= cutoff14;
      });
      const prior14 = sorted.filter((x) => {
        const t = Date.parse(x.date);
        return Number.isFinite(t) && t >= cutoff30 && t < cutoff14;
      });
      if (recent14.length && prior14.length) {
        const avgR = recent14.reduce((s, x) => s + x.v, 0) / recent14.length;
        const avgP = prior14.reduce((s, x) => s + x.v, 0) / prior14.length;
        trend = avgR - avgP > 1 ? 'up' : avgP - avgR > 1 ? 'down' : 'stable';
      } else if (sorted.length >= 4) {
        const half = Math.max(1, Math.floor(sorted.length / 2));
        const older = sorted.slice(0, half);
        const newer = sorted.slice(half);
        if (older.length && newer.length) {
          const avgO = older.reduce((s, x) => s + x.v, 0) / older.length;
          const avgN = newer.reduce((s, x) => s + x.v, 0) / newer.length;
          trend = avgN - avgO > 1 ? 'up' : avgO - avgN > 1 ? 'down' : 'stable';
        }
      }
      out[base] = {
        last: sorted[sorted.length - 1].v,
        avg30: recent30.length ? Math.round((recent30.reduce((s, x) => s + x.v, 0) / recent30.length) * 10) / 10 : undefined,
        count: sorted.length,
        trend,
      };
    }
    return out;
  }, [rows]);
  const togglePlanItem = (id: string) => {
    const next = planDone.includes(id) ? planDone.filter((x) => x !== id) : [...planDone, id];
    setPlanDone(next);
    savePlanDone(next);
  };
  const regeneratePlan = () => {
    const fresh = generateHealthPlan(analyzeHealthProfile(rows, planCtx));
    setPlan(fresh);
    saveHealthPlan(fresh);
  };
  const exportPlan = () => {
    downloadText(`health-plan-${todayIso()}.txt`, exportHealthPlanText(plan, analyzeHealthProfile(rows, planCtx)), 'text/plain;charset=utf-8');
    (window as any).showToast?.('📄 План улучшений экспортирован');
  };
  const exportReport = () => {
    downloadText(`health-report-${todayIso()}.txt`, exportHealthReportText(analyzeHealthProfile(rows, planCtx), plan), 'text/plain;charset=utf-8');
    (window as any).showToast?.('📄 Отчёт по здоровью сохранён');
  };
  const doneCount = plan.recommendations.filter((r) => planDone.includes(r.id)).length;
  const planProgressPct = plan.recommendations.length ? Math.round((doneCount / plan.recommendations.length) * 100) : 0;
  const painForecast = useMemo(() => {
    if (allPoints.length < 4) return null;
    const fit = fitLinearTrend(allPoints);
    if (!fit) return null;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      value: Math.max(0, Math.round(projectToDate(fit, target))),
      rising: fit.slopePerDay > 0.05,
      r2: fit.r2,
    };
  }, [allPoints]);
  const weekly = buildWeeklyHistogram(allPoints);
  const compare = compareWithLastWeek(allPoints);
  const anomalies = detectAnomalies('pain', rangeFields);
  const extremes = computeExtremes('pain', rangeFields);
  const streak = computeStreak(rangeFields);
  const normal = getNormalRange('pain');
  const line = allPoints
    .map((p, i) => `${20 + (i * 560) / Math.max(1, allPoints.length - 1)},${180 - Math.min(160, p.value * 2.25)}`)
    .join(' ');
  const exportCsv = () => {
    const zoneLabels = PAIN_ZONES.map((z) => z.label);
    const header = ['Дата', 'Боль', ...zoneLabels, 'Симптомы', 'Нейро', 'Акне', 'Гемат', 'Заметка'];
    const csvCell = (v: unknown) => {
      const s = String(v ?? '');
      const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${guarded.replace(/"/g, '""')}"`;
    };
    const body = rows.map((e) => {
      const zones = PAIN_ZONES.map((z) => e.pain?.zones[z.id] || 0);
      const symptoms = e.symptoms.map((s) => `${s.name} ${s.severity}/5${s.duration ? ` (${s.duration})` : ''}`).join('; ');
      return [
        e.date,
        e.pain?.totalScore || 0,
        ...zones,
        symptoms,
        e.neuro?.totalScore || 0,
        e.acne?.totalScore || 0,
        e.hemato?.totalScore || 0,
        e.notes || '',
      ]
        .map(csvCell)
        .join(',');
    });
    downloadText(`health-${todayIso()}.csv`, `\ufeff${header.map(csvCell).join(',')}\n${body.join('\n')}`, 'text/csv;charset=utf-8');
    (window as any).showToast?.('📥 CSV экспортирован');
  };
  const printPdf = () => {
    const zoneCols = PAIN_ZONES.map((z) => `<th>${escapeHtml(z.label)}</th>`).join('');
    const rowsHtml = rows.map((e) => {
      const zones = PAIN_ZONES.map((z) => `<td>${e.pain?.zones[z.id] || 0}</td>`).join('');
      const symptoms = e.symptoms.map((s) => `${escapeHtml(s.name)} ${s.severity}/5`).join('<br>');
      return `<tr><td>${escapeHtml(e.date)}</td><td>${e.pain?.totalScore || 0}/${PAIN_MAX}</td>${zones}<td>${symptoms}</td><td>${e.neuro?.totalScore || 0}/10</td><td>${e.acne?.totalScore || 0}/12</td><td>${e.hemato?.totalScore || 0}/8</td><td>${escapeHtml(e.notes || '')}</td></tr>`;
    }).join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Дневник здоровья</title><style>body{font:12px Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:5px;text-align:left}th{background:#eee}@media print{button{display:none}}</style></head><body><h1>Дневник здоровья</h1><p>Сформирован ${new Date().toLocaleString('ru-RU')}</p><table><tr><th>Дата</th><th>Боль</th>${zoneCols}<th>Симптомы</th><th>Нейро</th><th>Акне</th><th>Гемат</th><th>Заметка</th></tr>${rowsHtml}</table></body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };
  const symptomSeries = useMemo(
    () =>
      rangeRows.map((e) => ({ date: e.date, value: e.symptoms.reduce((s, x) => s + x.severity, 0) })),
    [rangeRows],
  );
  const correlation = crossCorrelation(allPoints, symptomSeries);
  const healthLagCorrelation = laggedCorrelation(allPoints, symptomSeries, 1);
  const recent30 = rows.slice(0, 30);
  const avgPain30 = recent30.length ? recent30.reduce((s, e) => s + (e.pain?.totalScore || 0), 0) / recent30.length : 0;
  const avgNeuro30 = recent30.filter((e) => e.neuro).length ? recent30.filter((e) => e.neuro).reduce((s, e) => s + e.neuro!.totalScore, 0) / recent30.filter((e) => e.neuro).length : 0;
  const avgAcne30 = recent30.filter((e) => e.acne).length ? recent30.filter((e) => e.acne).reduce((s, e) => s + e.acne!.totalScore, 0) / recent30.filter((e) => e.acne).length : 0;
  const avgHemato30 = recent30.filter((e) => e.hemato).length ? recent30.filter((e) => e.hemato).reduce((s, e) => s + e.hemato!.totalScore, 0) / recent30.filter((e) => e.hemato).length : 0;
  const healthScore = useMemo(computeRealHealthScore, [rows]);
  const scoreColor = healthScore.overallScore >= 70 ? colors.green : healthScore.overallScore >= 45 ? colors.warning : colors.danger;
  const scoreDim = healthScore.overallScore >= 70 ? colors.greenDim : healthScore.overallScore >= 45 ? colors.warningDim : colors.dangerDim;
  const diaryScore = Math.round(Math.max(0, 100 - (avgPain30 / 70) * 100 - (avgNeuro30 / 10) * 20 - (avgAcne30 / 12) * 15 - (avgHemato30 / 8) * 15));
  if (!open) return null;
  return (
    <div
      className="health-window diary-scrollbar"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background:
          'radial-gradient(1000px 560px at 14% -12%, rgba(236,72,153,0.14), transparent 64%), radial-gradient(760px 460px at 100% -6%, rgba(236,72,153,0.08), transparent 58%), radial-gradient(900px 520px at 50% 118%, rgba(255,255,255,0.04), transparent 62%), #08080a',
        color: colors.text, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}
    >
      <style>{`
        .health-window button { font-family: inherit; }
        .health-window::-webkit-scrollbar { width: 10px; height: 10px; }
        .health-window::-webkit-scrollbar-track { background: transparent; }
        .health-window::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
        .health-window::-webkit-scrollbar-thumb:hover { background: rgba(236,72,153,0.38); background-clip: content-box; }
        .diary-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .diary-card:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06); }
        @media (hover: none) and (pointer: coarse) {
          .health-window button { min-height: 44px; }
          .health-window input, .health-window textarea, .health-window select { font-size: 16px; }
        }
      `}</style>
      <DiaryHeader
        accent={ACCENT}
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><NativeIcon name="cross" size={18} /> Здоровье</span>}
        count={rows.length}
        onClose={onClose}
        onAdd={() => setAddOpen(true)}
        addLabel="+ Добавить"
        onToday={() => setAddOpen(true)}
        undoActive={!!undo}
        onUndo={() => { if (undo) { commit(undo, false); setUndo(null); } }}
        badge={
          <div style={{
            padding: '4px 10px',
            borderRadius: 8,
            background: scoreDim,
            border: `1px solid ${scoreColor}`,
            color: scoreColor,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }} title={`${healthScore.label}: ${healthScore.overallScore}/100 · Дневник ${diaryScore}/100${healthScore.topIssues.length ? ' · ' + healthScore.topIssues.join(', ') : ''}`}>
            💚 {healthScore.overallScore}
          </div>
        }
        exportActions={[
          { label: '📥 CSV-файл', onClick: exportCsv },
          { label: '🖨 Печать / PDF', onClick: printPdf },
          { label: '📄 Отчёт TXT', onClick: exportReport },
          { label: '📈 График SVG', onClick: () => { if (svgRef.current) exportSvgAsFile(svgRef.current, `health-${todayIso()}.svg`); (window as any).showToast?.('📈 График SVG сохранён'); } },
          { label: '🖼 График PNG', onClick: () => { if (svgRef.current) exportSvgAsPng(svgRef.current, `health-${todayIso()}.png`); (window as any).showToast?.('🖼 График PNG сохранён'); } },
          { label: '🗑 Очистить дневник', onClick: () => { if (confirm('Очистить единый дневник здоровья?')) { commit([]); (window as any).showToast?.('🗑 Дневник очищен (можно отменить)'); } }, danger: true },
        ]}
      />
      <main style={{ ...pageMain, maxWidth: 1150, paddingBottom: 72 }}>
        {/* ── Sub-tabs ── */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {(
            [
              ['overview', '📊 Обзор'],
              ['painmap', '🗺 Карта зон боли'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} style={subTab === id ? chipActive(ACCENT) : chip(ACCENT)} onClick={() => setSubTab(id)} aria-pressed={subTab === id}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: subTab === 'painmap' ? 'none' : undefined }}>
        {status && (
          <div role="status" style={{ ...card, marginBottom: 10, color: status.color, borderColor: status.color }}>
            ⚠ {status.message}
          </div>
        )}
        {rows.length > 0 && (
          <section style={{ ...card, marginBottom: 12, borderColor: '#8b5cf655' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <b>🧭 План улучшений · {new Date(plan.generatedAt).toLocaleDateString('ru-RU')}</b>
              <span style={{ color: colors.textMuted, fontSize: 11 }}>{plan.summary.verdict}</span>
            </div>
            {plan.recommendations.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.textMuted, marginBottom: 3 }}>
                  <span>✅ Выполнено: {doneCount} из {plan.recommendations.length}</span>
                  <span>{planProgressPct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${planProgressPct}%`, background: '#8b5cf6', borderRadius: 999, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
              {(
                [
                  ['critical', '🔴', '#ef4444'],
                  ['high', '🟠', '#f97316'],
                  ['medium', '🟡', '#f59e0b'],
                  ['low', '🟢', '#22c55e'],
                ] as const
              ).map(([label, icon, c]) => (
                <span key={label} style={{ fontSize: 10, fontWeight: 800, color: c, background: `${c}1f`, borderRadius: 999, padding: '2px 8px' }}>
                  {icon} {plan.summary[label]}
                </span>
              ))}
              <button style={button} onClick={exportPlan}>📄 Экспорт плана</button>
              <button style={button} onClick={regeneratePlan}>🔄 Перегенерировать</button>
            </div>
            {plan.recommendations.length === 0 ? (
              <p style={{ color: colors.textMuted, fontSize: 12 }}>Данных недостаточно — добавьте записи в дневник.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.recommendations.map((r) => {
                  const done = planDone.includes(r.id);
                  const c = r.priority === 'critical' ? '#ef4444' : r.priority === 'high' ? '#f97316' : r.priority === 'medium' ? '#f59e0b' : '#22c55e';
                  const supportable = onNavigate && (r.domain === 'pain' || r.domain === 'neuro' || r.domain === 'hemato' || r.domain === 'acne');
                  return (
                    <div key={r.id} style={{ padding: '7px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${c}44`, opacity: done ? 0.6 : 1 }}>
                      <label style={{ display: 'flex', gap: 9, alignItems: 'center', cursor: 'pointer', fontSize: 12, minHeight: 40 }}>
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => togglePlanItem(r.id)}
                          style={{ width: 20, height: 20, accentColor: c, flexShrink: 0, cursor: 'pointer' }}
                          aria-label={`Выполнено: ${r.title}`}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', lineHeight: 1.35 }}>
                            <b style={{ color: c }}>{r.title}</b>
                            <span style={{ color: colors.text, marginLeft: 6 }}>— {r.action}</span>
                          </span>
                          <span style={{ display: 'block', color: colors.textMuted, marginTop: 2, fontSize: 11, lineHeight: 1.3 }}>
                            {r.rationale}
                          </span>
                        </span>
                      </label>
                      {supportable && (
                        <div style={{ marginTop: 3, paddingLeft: 29 }}>
                          <button style={{ ...button, minHeight: 32, padding: '3px 10px', fontSize: 11 }} onClick={() => onNavigate('support')}>🛡 Протокол поддержки</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(105px,1fr))',
            gap: 7,
            marginBottom: 12,
          }}
        >
          {[
            ['Записей', rows.length, '#60a5fa'],
            ['Боль', stats.pain ? `${stats.pain.avg}/${PAIN_MAX}` : '—', '#22c55e'],
            ['Нейро', stats.neuro ? `${stats.neuro.avg}/10` : '—', '#ef4444'],
            ['Акне', stats.acne ? `${stats.acne.avg}/12` : '—', '#f97316'],
            ['Гемат', stats.hemato ? `${stats.hemato.avg}/8` : '—', '#3b82f6'],
            ['Симптомы', symptomStats?.total || 0, '#ec4899'],
            ['Серия', streak.current, '#f59e0b'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="diary-card" style={{ ...statCard, border: `1px solid ${String(color)}30`, background: `linear-gradient(135deg, ${String(color)}14, transparent 70%), rgba(28,28,32,0.74)`, borderLeft: `2px solid ${String(color)}88`, position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(360px 80px at 14% 0%, ${String(color)}12, transparent 62%)`, pointerEvents: 'none' }} />
              <small style={{ fontSize: 10, color: 'rgba(255,255,255,0.44)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', position: 'relative' }}>{label}</small>
              <strong style={{ display: 'block', color: String(color), fontSize: 20, fontWeight: 800, position: 'relative', letterSpacing: '-0.3px', marginTop: 2 }}>{value}</strong>
            </div>
          ))}
        </section>
        <section style={{ ...card, marginBottom: 12, padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', fontSize: 10 }}>
            <b style={{ color: colors.textMuted, marginRight: 2 }}>🧬 Индекс здоровья: {healthScore.overallScore}/100 · {healthScore.label}</b>
            {(
              [
                ['Фарма', healthScore.breakdown.pharma.score],
                ['Лабы', healthScore.breakdown.labs.score],
                ['Питание', healthScore.breakdown.nutrition.score],
                ['Тренировки', healthScore.breakdown.training.score],
                ['Восст.', healthScore.breakdown.recovery.score],
                ['Композ.', healthScore.breakdown.bodyComp.score],
              ] as const
            ).map(([label, v]) => (
              <span key={label} title={label} style={{ fontWeight: 700, color: v >= 70 ? '#22c55e' : v >= 45 ? '#f59e0b' : '#ef4444', background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '2px 8px' }}>
                {label} {v}
              </span>
            ))}
          </div>
        </section>
        <section style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <b>📈 Боль по датам</b>
            <span style={{ color: colors.textMuted, fontSize: 11 }}>Норма ≤ {normal?.high}/${PAIN_MAX}</span>
          </div>
          <svg
            ref={svgRef}
            viewBox="0 0 600 230"
            width="100%"
            height="210"
            role="img"
            aria-label="График суставной боли"
          >
            <line x1="40" y1="190" x2="580" y2="190" stroke="#ffffff" />
            <line x1="40" y1="30" x2="40" y2="190" stroke="#ffffff" />
            {[0, 10, 20, 30, 40, 50, 60, 70].map((value) => (
              <g key={value}>
                <line x1="40" y1={190 - value * 2.25} x2="580" y2={190 - value * 2.25} stroke="#ffffff12" />
                <text x="34" y={194 - value * 2.25} textAnchor="end" fill="#ffffff" fontSize="8">
                  {value}
                </text>
              </g>
            ))}
            <rect
              x="40"
              y={190 - (normal?.high || 20) * 2.25}
              width="540"
              height={((normal?.high || 20) - (normal?.low || 0)) * 2.25}
              fill="#22c55e12"
            />
            <line
              x1="40"
              y1={190 - (normal?.high || 20) * 2.25}
              x2="580"
              y2={190 - (normal?.high || 20) * 2.25}
              stroke="#22c55e"
              strokeDasharray="5 4"
            />
            <polyline points={line} fill="none" stroke="#22c55e" strokeWidth="3" />
            {allPoints.map((p, i) => (
              <circle
                key={`${p.date}-${i}`}
                cx={40 + (i * 540) / Math.max(1, allPoints.length - 1)}
                cy={190 - Math.min(160, p.value * 2.25)}
                r="3"
                fill="#22c55e"
              >
                <title>
                  {p.date}: {p.value}/${PAIN_MAX}
                </title>
              </circle>
            ))}
          </svg>
          {painForecast && (
            <div style={{ marginTop: 4, fontSize: 11, color: painForecast.rising ? colors.warning : colors.green }}>
              🔮 Прогноз боли через 7 дней: {painForecast.value}/${PAIN_MAX} ({painForecast.rising ? '↑ рост' : 'стабильно/↓ снижение'}, r²={painForecast.r2.toFixed(2)})
            </div>
          )}
        </section>
        {(() => {
          const renderMiniChart = (title: string, color: string, maxVal: number, points: { date: string; value: number }[], normalHigh?: number) => {
            const visiblePoints = points.filter((p) => rangeDateSet.has(p.date));
            if (visiblePoints.length === 0) return null;
            const sorted = visiblePoints.sort((a, b) => a.date.localeCompare(b.date));
            const line = sorted.map((p, i) => `${20 + (i * 560) / Math.max(1, sorted.length - 1)},${190 - Math.min(160, p.value * (180 / maxVal))}`).join(' ');
            return (
              <section key={title} style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <b>{title}</b>
                  <span style={{ color: colors.textMuted, fontSize: 11 }}>Норма ≤ {normalHigh ?? maxVal}/{maxVal}</span>
                </div>
                <svg viewBox="0 0 600 230" width="100%" height="210" role="img" aria-label={title}>
                  <line x1="40" y1="190" x2="580" y2="190" stroke="#ffffff" />
                  <line x1="40" y1="30" x2="40" y2="190" stroke="#ffffff" />
                  {Array.from({ length: 5 }, (_, i) => {
                    const v = Math.round((maxVal / 4) * i);
                    return (
                      <g key={v}>
                        <line x1="40" y1={190 - v * (180 / maxVal)} x2="580" y2={190 - v * (180 / maxVal)} stroke="#ffffff12" />
                        <text x="34" y={194 - v * (180 / maxVal)} textAnchor="end" fill="#ffffff" fontSize="8">{v}</text>
                      </g>
                    );
                  })}
                  {normalHigh !== undefined && (
                    <>
                      <rect x="40" y={190 - normalHigh * (180 / maxVal)} width="540" height={normalHigh * (180 / maxVal)} fill={`${color}12`} />
                      <line x1="40" y1={190 - normalHigh * (180 / maxVal)} x2="580" y2={190 - normalHigh * (180 / maxVal)} stroke={color} strokeDasharray="5 4" />
                    </>
                  )}
                  <polyline points={line} fill="none" stroke={color} strokeWidth="3" />
                  {sorted.map((p, i) => (
                    <circle key={`${p.date}-${i}`} cx={40 + (i * 540) / Math.max(1, sorted.length - 1)} cy={190 - Math.min(160, p.value * (180 / maxVal))} r="3" fill={color}>
                      <title>{p.date}: {p.value}/{maxVal}</title>
                    </circle>
                  ))}
                </svg>
              </section>
            );
          };
          const neuroPoints = rows.filter((e) => e.neuro && e.neuro.totalScore > 0).map((e) => ({ date: e.date, value: e.neuro!.totalScore }));
          const acnePoints = rows.filter((e) => e.acne && e.acne.totalScore > 0).map((e) => ({ date: e.date, value: e.acne!.totalScore }));
          const hematoPoints = rows.filter((e) => e.hemato && e.hemato.totalScore > 0).map((e) => ({ date: e.date, value: e.hemato!.totalScore }));
          return (
            <>
              {renderMiniChart('🧠 Нейросимптомы', '#ef4444', 10, neuroPoints, 4)}
              {renderMiniChart('🔴 Акне', '#f97316', 12, acnePoints, 7)}
              {renderMiniChart('🩸 Гематология', '#3b82f6', 8, hematoPoints, 2)}
            </>
          );
        })()}
        {(correlation || healthLagCorrelation) && (
          <section style={{ ...card, marginBottom: 12 }}>
            <b>🔗 Связь боли и симптомов</b>
            <div>
              Тот же день: {correlation ? `r=${correlation.r.toFixed(2)} · n=${correlation.n}` : 'нет данных'} · Лаг 1
              день:{' '}
              {healthLagCorrelation
                ? `r=${healthLagCorrelation.r.toFixed(2)} · n=${healthLagCorrelation.n}`
                : 'нет данных'}
            </div>
          </section>
        )}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={card}>
            <b>📊 Распределение</b>
            {distribution ? (
              <div style={{ marginTop: 7, fontSize: 12 }}>
                Среднее {distribution.mean.toFixed(1)} · медиана {distribution.median.toFixed(1)}
                <br />
                SD {distribution.stdDev.toFixed(1)} · P25/P75 {distribution.p25.toFixed(1)}/
                {distribution.p75.toFixed(1)}
                <br />
                Мин/макс {distribution.min.toFixed(0)}/{distribution.max.toFixed(0)}
                {extremes.min && extremes.max && (
                  <>
                    <br />
                    <span style={{ color: colors.textMuted, fontSize: 11 }}>
                      Мин {extremes.min.date}: {extremes.min.value}/${PAIN_MAX} · Макс {extremes.max.date}: {extremes.max.value}/${PAIN_MAX}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <p style={{ color: colors.textMuted }}>Нужно минимум 2 записи</p>
            )}
          </div>
          <div style={card}>
            <b>📆 Сравнение недели</b>
            <div style={{ marginTop: 7, fontSize: 12 }}>
              {compare.thisWeek && compare.lastWeek
                ? `Эта ${compare.thisWeek.mean.toFixed(1)} · прошлая ${compare.lastWeek.mean.toFixed(1)} · Δ ${compare.delta?.toFixed(1)}`
                : 'Недостаточно данных'}
            </div>
          </div>
          <div style={card}>
            <b>🔗 Корреляция боли и симптомов</b>
            <div style={{ marginTop: 7, fontSize: 12 }}>
              {correlation
                ? `r=${correlation.r.toFixed(2)} · n=${correlation.n} · ${correlation.strength}`
                : 'Нужно минимум 3 совпадающие даты'}
            </div>
          </div>
        </section>
        {weekly.length > 0 && (
          <section style={{ ...card, marginBottom: 12 }}>
            <b>📅 Недели</b>
            <div style={{ display: 'flex', gap: 5, alignItems: 'end', height: 100, marginTop: 8 }}>
              {weekly.map((w) => (
                <div
                  key={w.weekStart}
                  title={`${w.weekStart}: ${w.mean.toFixed(1)}`}
                  style={{ flex: 1, textAlign: 'center', fontSize: 9 }}
                >
                  <div
                    style={{
                      height: Math.max(8, Math.min(75, w.mean * 2)),
                      background: '#22c55e99',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span>{w.weekStart.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        <section style={{ ...card, marginBottom: 12 }}>
          <b>💡 Инсайты и аномалии</b>
          {[
            ...painInsights.insights.map((x) => `${x.title}: ${x.description}`),
            ...symptomSummary.slice(0, 5).map((x) => `${x.symptomName}: ${x.currentSeverity}/5 (${x.trend})`),
            ...anomalies.map((x) => x.message),
          ]
            .slice(0, 12)
            .map((x, i) => (
              <div
                key={i}
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: i < painInsights.insights.length ? '#f59e0b' : colors.textMuted,
                }}
              >
                • {x}
              </div>
            ))}
          {!painInsights.insights.length && !symptomSummary.length && !anomalies.length && (
            <p style={{ color: '#22c55e' }}>Предупреждений нет</p>
          )}
        </section>
        <section style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['all', '7', '30', '90'] as const).map((r) => (
              <button
                key={r}
                style={range === r ? chipActive(ACCENT) : chip(ACCENT)}
                onClick={() => {
                  setRange(r);
                  setPage(1);
                }}
              >
                {r === 'all' ? 'Всё время' : `${r} дней`}
              </button>
            ))}
            <div style={{ position: 'relative', flex: 1, minWidth: 180, display: 'flex', alignItems: 'center' }}>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="🔍 Поиск по дате/показателю"
                style={{ ...input, flex: 1, paddingRight: query ? 30 : undefined }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setPage(1); }} aria-label="Очистить поиск" style={{ position: 'absolute', right: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: colors.textMuted, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
              )}
            </div>
            <button style={chip(ACCENT)} onClick={() => setSort({ key: 'date', dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>
              ↕ Дата
            </button>
          </div>
        </section>
        <section style={{ ...card, overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>Последние записи ({pageData.total})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Дата', 'Боль', 'Нейро', 'Акне', 'Гемат', 'Симптомы', 'Время', 'Тип', 'Триггеры', 'Упр.', 'Заметка', 'Действия'].map((h) => (
                  <th key={h} style={tableTh}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.pageItems.map((e) => {
                const row = rows.find((r) => r.date === e.date);
                if (!row) return null;
                return (
                  <tr key={row.id}>
                    <td style={tableTd}>{row.date}</td>
                    <td style={tableTd}>{row.pain?.totalScore || 0}/${PAIN_MAX}</td>
                    <td style={tableTd}>{row.neuro?.totalScore || 0}/10</td>
                    <td style={tableTd}>{row.acne?.totalScore || 0}/12</td>
                    <td style={tableTd}>{row.hemato?.totalScore || 0}/8</td>
                    <td style={tableTd}>{row.symptoms.length}</td>
                    <td style={tableTd}>{row.pain?.timeOfDay || ''}</td>
                    <td style={tableTd}>{row.pain?.painType || ''}</td>
                    <td style={tableTd}>{(row.pain?.triggers || []).join(', ')}</td>
                    <td style={tableTd}>{row.pain?.linkedExercise || ''}</td>
                    <td style={tableTd}>{row.notes ? (row.notes.length > 20 ? row.notes.slice(0, 20) + '…' : row.notes) : ''}</td>
                    <td style={tableTd}>
                      <button style={{ ...button, minHeight: 32, padding: '3px 7px' }} onClick={() => setEdit(row)}>
                        ✏️
                      </button>{' '}
                      <button
                        style={{ ...button, minHeight: 32, padding: '3px 7px', color: '#ef4444' }}
                        onClick={() => {
                          if (confirm(`Удалить запись ${row.date}?`)) {
                            commit(deleteUnifiedHealthEntry(row.date));
                            (window as any).showToast?.('🗑 Запись удалена');
                          }
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 9,
              fontSize: 11,
            }}
          >
            <span>
              {pageData.total ? `${pageData.pageStart + 1}–${pageData.pageEnd} из ${pageData.total}` : 'Нет записей'}
            </span>
            <span>
              <button style={button} onClick={() => setPage(Math.max(1, page - 1))}>
                ‹
              </button>{' '}
              {page}/{pageData.totalPages}{' '}
              <button style={button} onClick={() => setPage(Math.min(pageData.totalPages, page + 1))}>
                ›
              </button>
            </span>
          </div>
        </section>
        {rows.length > 0 && (
          <section style={{ ...card, marginTop: 12 }}>
            <b>🕘 Последние записи</b>
            {rows.slice(0, 3).map((row) => (
              <div key={`latest-${row.id}`} style={{ marginTop: 7, fontSize: 12, color: colors.textMuted }}>
                {row.date}: боль {row.pain?.totalScore || 0}/${PAIN_MAX} · симптомов {row.symptoms.length} · нейро{' '}
                {row.neuro?.totalScore || 0}/10
              </div>
            ))}
          </section>
        )}
        </div>

        {/* ── Sub-tab: 3D карта зон боли ── */}
        {subTab === 'painmap' && (
          <section style={{ ...card, marginBottom: 12, borderColor: '#ec489955' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <b style={{ display:'inline-flex', alignItems:'center', gap:6 }}><NativeIcon name="target" size={13} /> Карта зон боли · 3D</b>
              <span style={{ color: colors.textMuted, fontSize: 11 }}>
                Клик по части тела — анализ зоны · Вращайте модель · Σ {score(mapZones)}/${PAIN_MAX}
              </span>
            </div>
            <PainZone3D zones={mapZones} onChange={setMapZones} height={460} analysisFor={(base) => zoneAnalysis[base] || null} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={{ ...button, background: '#ec4899', borderColor: '#ec4899', color: '#fff', display:'inline-flex', alignItems:'center', gap:6 }} onClick={savePainZones}>
                <NativeIcon name="check" size={13} /> Сохранить в запись за сегодня
              </button>
              <button style={{ ...button, display:'inline-flex', alignItems:'center', gap:6 }} onClick={() => {
                const cleared: Record<string, number> = {};
                for (const z of PAIN_ZONES) cleared[z.id] = 0;
                setMapZones(cleared);
              }}>
                <NativeIcon name="trash" size={13} /> Очистить
              </button>
              <button style={button} onClick={() => setMapZones(rows[0]?.pain?.zones || {})}>
                📋 Из последней записи
              </button>
            </div>
          </section>
        )}
      </main>
      {addOpen && <AddHealthModal open onClose={() => setAddOpen(false)} onSave={saveNew} />}
      {edit && <EntryEditor entry={edit} onCancel={() => setEdit(null)} onSave={saveEdit} />}
    </div>
  );
};
