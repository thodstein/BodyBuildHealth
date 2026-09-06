import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors, glassCard, inputStyle, labelStyle, selectStyle, withAlpha } from '../../ui';
import { btnBase, btnPrimary, chip, chipActive, main as pageMain } from '../diary-page-styles';
import { DiaryHeader } from '../DiaryHeader';
import {
  INJECTION_ZONES,
  NEEDLE_GAUGES,
  TECHNIQUES,
  addInjection,
  clearInjectionDiary,
  computeInjectionStats,
  deleteInjection,
  detectInjectionAnomalies,
  getDaysSinceLastInjection,
  getDoseSummary,
  getInjectionDiary,
  getInjectionTrend,
  getLastInjection,
  getRotationRecommendations,
  getRotationWarnings,
  getSubstanceInjectionAdvice,
  getSuggestedZone,
  getWeeklyFrequency,
  getZoneCompatibilityIssues,
  getZoneTechniqueMatrix,
  getZoneTechniqueAdvice,
  migrateAllLegacyEntries,
  parseDose,
  replaceInjectionDiary,
  suggestBetterTechnique,
  techniqueLabel,
  todayLocalStr,
  updateInjection,
  zoneLabel,
  type InjectionEntry,
  type InjectionTechniqueAdvice,
} from '../../../../../engines/injection-diary.engine';
import {
  getInjectionDiaryForPharma,
  getInjectionDiaryForRiskEngine,
  getInjectionDiarySummary,
} from '../../../../../engines/injection-diary-integration';
import {
  SCHEDULE_WEEKDAYS,
  addScheduleItem,
  computeScheduleAdherence,
  getDueToday,
  getInjectionSchedule,
  getMissedInjections,
  removeScheduleItem,
  saveInjectionSchedule,
  updateScheduleItem,
  type InjectionScheduleItem,
} from '../../../../../engines/injection-schedule.engine';
import type { DiaryWindowProps } from '../../DiaryWindow';

type Draft = Omit<InjectionEntry, 'id'>;
type ViewMode = 'journal' | 'stats' | 'chart' | 'schedule';
type Range = 'all' | '7' | '30' | '90';
type SortKey = 'date' | 'substance' | 'dose' | 'pain' | 'pip' | 'volume';

const emptyDraft = (zone = 'glute_dorsal'): Draft => ({
  date: todayLocalStr(),
  substance: '',
  dose: '',
  zone,
  side: 'left',
  volumeMl: 1,
  needleGauge: '23G',
  technique: 'im',
  painLevel: 0,
  pipLevel: 0,
  swelling: 0,
  redness: false,
  lump: false,
  bruise: false,
  fever: false,
  notes: '',
});

const ACCENT = '#f59e0b';

const button: React.CSSProperties = { ...btnBase(ACCENT) };
const dangerButton: React.CSSProperties = {
  ...button,
  color: '#fecaca',
  borderColor: 'rgba(239,68,68,.35)',
  background: colors.dangerDim,
};
const card: React.CSSProperties = { ...glassCard, padding: 14 };
const clamp10 = (value: number) => Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0));
const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] || char,
  );

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <span style={labelStyle}>{label}</span>
    {children}
  </label>
);

const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({
  label,
  value,
  tone = colors.primary,
}) => (
    <div className="diary-card" style={{ ...card, minWidth: 138, flex: '1 1 138px', background: `linear-gradient(135deg, ${withAlpha(tone, '14')}, transparent 70%), rgba(28,28,32,0.72)`, borderLeft: `2px solid ${withAlpha(tone, '88')}`, position: 'relative', overflow: 'hidden' }}>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(360px 80px at 14% 0%, ${withAlpha(tone, '12')}, transparent 62%)`, pointerEvents: 'none' }} />
    <div style={{ ...labelStyle, marginBottom: 6, position: 'relative', color: 'rgba(255,255,255,0.44)', fontWeight: 700, letterSpacing: '0.5px' }}>{label}</div>
    <strong style={{ fontSize: 21, color: tone, position: 'relative', letterSpacing: '-0.3px' }}>{value}</strong>
  </div>
);

const scoreTone = (value: number) => (value >= 7 ? colors.danger : value >= 4 ? colors.warning : colors.green);

const ZoneMap: React.FC<{
  entries: InjectionEntry[];
  selectedZone: string;
  onSelectZone: (zoneId: string) => void;
  missedZones?: Set<string>;
}> = ({ entries, selectedZone, onSelectZone, missedZones }) => {
  const zoneDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const zone of INJECTION_ZONES) {
      const days = getDaysSinceLastInjection(zone.id, entries);
      map.set(zone.id, days ?? 999);
    }
    return map;
  }, [entries]);

  const zoneColor = (days: number) => {
    if (days >= 14) return { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.3)', text: '#fca5a5' };
    if (days >= 7) return { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.25)', text: '#fcd34d' };
    if (days >= 3) return { bg: 'rgba(59,130,246,.10)', border: 'rgba(59,130,246,.2)', text: '#93c5fd' };
    return { bg: 'rgba(0,230,138,.10)', border: 'rgba(0,230,138,.2)', text: '#6ee7b7' };
  };

  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 13 }}>🗺 Карта зон</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {INJECTION_ZONES.map((zone) => {
          const days = zoneDays.get(zone.id) ?? 999;
          const c = zoneColor(days);
          const isSelected = selectedZone === zone.id;
          const missed = missedZones?.has(zone.id);
          return (
            <button
              key={zone.id}
              onClick={() => onSelectZone(zone.id)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                background: isSelected ? c.bg.replace('.15', '.25').replace('.12', '.2').replace('.10', '.18').replace('.10', '.18') : c.bg,
                border: missed ? `2px dashed ${isSelected ? '#fff' : '#fca5a5'}` : `1px solid ${isSelected ? c.text : c.border}`,
                color: c.text,
                transition: 'all 0.15s',
                minHeight: 32,
              }}
              title={
                missed
                  ? `⏭ Пропущена по расписанию (${zone.label}) — запланированная инъекция не внесена`
                  : days >= 999
                    ? 'Не использовалась'
                    : `Последняя: ${days} дн. назад`
              }
            >
              {zone.label}
              {missed && <span style={{ marginLeft: 5, opacity: 0.9 }}>⏭</span>}
              <span style={{ marginLeft: 5, opacity: 0.7 }}>{days >= 999 ? '—' : `${days}д`}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: colors.textMuted, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(0,230,138,.2)', border: '1px solid rgba(0,230,138,.3)' }} /> Свежая (&lt;3д)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.25)' }} /> 3-7д</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)' }} /> 7-14д</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)' }} /> ≥14д</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, border: '2px dashed #fca5a5' }} /> ⏭ пропущена по расписанию</span>
      </div>
    </div>
  );
};

const InjectionEditor: React.FC<{
  open: boolean;
  initial: Draft;
  suggestedZone: string;
  editing: boolean;
  onClose: () => void;
  onSave: (draft: Draft) => void;
  onSaveMore?: (draft: Draft) => void;
}> = ({ open, initial, suggestedZone, editing, onClose, onSave, onSaveMore }) => {
  const [draft, setDraft] = useState<Draft>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const setNumber = (key: 'volumeMl' | 'painLevel' | 'pipLevel' | 'swelling', value: string) => {
    set(key, key === 'volumeMl' ? Math.max(0, Number(value) || 0) : clamp10(Number(value)));
  };
  const clean = (value: Draft): Draft => ({
    ...value,
    substance: value.substance.trim(),
    dose: value.dose.trim(),
    notes: value.notes?.trim() || undefined,
  });
  const advice = getZoneTechniqueAdvice(draft.zone);
  const overVolume = advice ? draft.volumeMl > advice.maxVolumeMl : false;
  const waterConflict = advice?.solutionType === 'водный' && (draft.technique === 'im' || draft.technique === 'subq_oil');
  const valid = () => !!draft.date && !!draft.substance.trim() && !!draft.dose.trim() && !overVolume;
  const confirmIfWaterConflict = (): boolean => {
    if (!waterConflict) return true;
    return window.confirm(`Зона «${advice ? zoneLabel(draft.zone) : draft.zone}» — только водные растворы. Масляный в/м не рекомендуется. Всё равно сохранить?`);
  };
  const save = () => {
    if (!valid()) return;
    if (!confirmIfWaterConflict()) return;
    onSave(clean(draft));
  };
  const saveAndMore = () => {
    if (!valid() || !onSaveMore) return;
    if (!confirmIfWaterConflict()) return;
    onSaveMore(clean(draft));
    setDraft((current) => ({
      ...current,
      painLevel: 0,
      pipLevel: 0,
      swelling: 0,
      redness: false,
      lump: false,
      bruise: false,
      fever: false,
      notes: '',
    }));
  };
  const compatIssues = getZoneCompatibilityIssues(draft.zone, draft.technique, draft.volumeMl);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2200,
        background: 'rgba(0,0,0,.76)',
        display: 'flex',
        overflowY: 'auto',
        padding: 14,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          ...card,
          width: 'min(760px, 100%)',
          maxHeight: 'calc(100vh - 28px)',
          overflowY: 'auto',
          margin: 'auto',
          background: '#202024',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>💉 {editing ? 'Редактировать инъекцию' : 'Новая инъекция'}</h2>
          <button style={button} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <Field label="Дата">
            <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Препарат">
            <input
              autoFocus
              value={draft.substance}
              onChange={(e) => set('substance', e.target.value)}
              placeholder="Тестостерон энантат"
              style={inputStyle}
            />
          </Field>
          <Field label="Доза">
            <input
              value={draft.dose}
              onChange={(e) => set('dose', e.target.value)}
              placeholder="250 мг / 1 мл / 100 IU"
              style={inputStyle}
            />
          </Field>
          <Field label="Зона">
            <select value={draft.zone} onChange={(e) => set('zone', e.target.value)} style={selectStyle}>
              {INJECTION_ZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
            {draft.zone === suggestedZone && <small style={{ color: colors.green }}>✓ рекомендована ротацией</small>}
            {(() => {
              const advice = getZoneTechniqueAdvice(draft.zone);
              if (!advice) return null;
              const over = draft.volumeMl > advice.maxVolumeMl;
              return (
                <small style={{ display: 'block', marginTop: 3, color: over ? '#fca5a5' : colors.textMuted }}>
                  💡 {over ? '⚠ ' : ''}Макс. объём зоны: {advice.maxVolumeMl} мл · игла {advice.needleGauge} × {advice.needleLength} · {advice.angle}
                </small>
              );
            })()}
          </Field>
          <Field label="Сторона">
            <select
              value={draft.side}
              onChange={(e) => set('side', e.target.value as Draft['side'])}
              style={selectStyle}
            >
              <option value="left">Левая</option>
              <option value="right">Правая</option>
            </select>
          </Field>
          <Field label="Объём, мл">
            <input
              type="number"
              min="0"
              step="0.1"
              value={draft.volumeMl}
              onChange={(e) => setNumber('volumeMl', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Игла">
            <select value={draft.needleGauge} onChange={(e) => set('needleGauge', e.target.value)} style={selectStyle}>
              {NEEDLE_GAUGES.map((gauge) => (
                <option key={gauge}>{gauge}</option>
              ))}
            </select>
          </Field>
          <Field label="Техника">
            <select value={draft.technique} onChange={(e) => set('technique', e.target.value)} style={selectStyle}>
              {TECHNIQUES.map((technique) => (
                <option key={technique.id} value={technique.id}>
                  {technique.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Боль при введении, 0–10">
            <input
              type="number"
              min="0"
              max="10"
              value={draft.painLevel}
              onChange={(e) => setNumber('painLevel', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="PIP после инъекции, 0–10">
            <input
              type="number"
              min="0"
              max="10"
              value={draft.pipLevel}
              onChange={(e) => setNumber('pipLevel', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Отёк, 0–10">
            <input
              type="number"
              min="0"
              max="10"
              value={draft.swelling}
              onChange={(e) => setNumber('swelling', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '14px 0' }}>
          {(
            [
              ['redness', '🔴 Покраснение'],
              ['lump', '🟤 Уплотнение'],
              ['bruise', '🟣 Гематома'],
              ['fever', '🌡 Температура'],
            ] as const
          ).map(([key, text]) => (
            <label key={key} style={{ fontSize: 13 }}>
              <input type="checkbox" checked={!!draft[key]} onChange={(e) => set(key, e.target.checked)} /> {text}
            </label>
          ))}
        </div>
        {compatIssues.length > 0 && (
          <div
            role="status"
            style={{
              margin: '0 0 12px',
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 12,
              color: '#fcd34d',
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            {compatIssues.slice(0, 2).map((issue) => (
              <div key={issue}>⚠ {issue}</div>
            ))}
          </div>
        )}
        <Field label="Заметки">
          <textarea
            value={draft.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Реакция, техника, самочувствие, ротация..."
          />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button style={button} onClick={onClose}>
            Отмена
          </button>
          {onSaveMore && (
            <button
              style={{ ...button, background: colors.primaryDim, color: colors.primary, opacity: overVolume ? 0.45 : 1 }}
              onClick={saveAndMore}
              disabled={!draft.date || !draft.substance.trim() || !draft.dose.trim() || overVolume}
              title={overVolume ? `Объём превышает максимум ${advice?.maxVolumeMl} мл для зоны` : undefined}
            >
              ➕ Сохранить и ещё
            </button>
          )}
          <button
            style={{ ...button, background: colors.primary, color: '#07130e', fontWeight: 800, opacity: overVolume ? 0.45 : 1 }}
            onClick={save}
            disabled={!draft.date || !draft.substance.trim() || !draft.dose.trim() || overVolume}
            title={overVolume ? `Объём превышает максимум ${advice?.maxVolumeMl} мл для зоны — уменьшите объём` : undefined}
          >
            💾 Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

const ScheduleItemEditor: React.FC<{
  initial?: InjectionScheduleItem;
  onClose: () => void;
  onSave: (item: InjectionScheduleItem) => void;
}> = ({ initial, onClose, onSave }) => {
  const [item, setItem] = useState<InjectionScheduleItem>(() =>
    initial
      ? { ...initial }
      : {
          id: '',
          substance: '',
          dose: '',
          daysOfWeek: [],
          zone: 'glute_dorsal',
          side: 'left',
          technique: 'im',
          needleGauge: '23G',
          volumeMl: 1,
          active: true,
        },
  );
  const toggleDay = (day: number) => {
    setItem((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((d) => d !== day)
        : [...current.daysOfWeek, day].sort((a, b) => a - b),
    }));
  };
  const valid = () => !!item.substance.trim() && !!item.dose.trim() && item.daysOfWeek.length > 0;
  return (
    <div style={{ ...card, marginBottom: 12, borderColor: 'rgba(245,158,11,.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>
          {initial ? '✎ Редактировать пункт расписания' : '➕ Новый пункт расписания'}
        </h3>
        <button style={{ ...button, minHeight: 32, padding: '4px 10px' }} onClick={onClose}>
          ✕
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 8 }}>
        <Field label="Препарат">
          <input value={item.substance} onChange={(e) => setItem((c) => ({ ...c, substance: e.target.value }))} placeholder="Тестостерон энантат" style={inputStyle} />
        </Field>
        <Field label="Доза">
          <input value={item.dose} onChange={(e) => setItem((c) => ({ ...c, dose: e.target.value }))} placeholder="250 мг" style={inputStyle} />
        </Field>
        <Field label="Зона">
          <select value={item.zone || 'glute_dorsal'} onChange={(e) => setItem((c) => ({ ...c, zone: e.target.value }))} style={selectStyle}>
            {INJECTION_ZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Техника">
          <select value={item.technique || 'im'} onChange={(e) => setItem((c) => ({ ...c, technique: e.target.value }))} style={selectStyle}>
            {TECHNIQUES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: colors.textMuted }}>Дни недели:</span>
        {SCHEDULE_WEEKDAYS.map((label, day) => {
          const on = item.daysOfWeek.includes(day);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggleDay(day)}
              style={{
                minHeight: 36,
                minWidth: 40,
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                border: `1px solid ${on ? 'rgba(245,158,11,.55)' : colors.border}`,
                background: on ? 'rgba(245,158,11,.18)' : 'rgba(255,255,255,.03)',
                color: on ? '#fbbf24' : colors.textMuted,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={button} onClick={onClose}>
          Отмена
        </button>
        <button
          style={{ ...button, background: colors.primary, color: '#07130e', fontWeight: 800 }}
          onClick={() => valid() && onSave(item)}
          disabled={!valid()}
        >
          💾 Сохранить
        </button>
      </div>
    </div>
  );
};

export const InjectionDiary: React.FC<DiaryWindowProps> = ({ open, onClose, onDataChange }) => {
  const [entries, setEntries] = useState<InjectionEntry[]>([]);
  const [mode, setMode] = useState<ViewMode>('journal');
  const [editor, setEditor] = useState<{ open: boolean; entry?: InjectionEntry }>({ open: false });
  const [repeatDraft, setRepeatDraft] = useState<Draft | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('glute_dorsal');
  const [undo, setUndo] = useState<InjectionEntry[] | null>(null);
  const [range, setRange] = useState<Range>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [chartMetric, setChartMetric] = useState<'pain' | 'pip'>('pain');
  const [trendDays, setTrendDays] = useState(7);
  const [doseRangeDays, setDoseRangeDays] = useState(7);
  const [schedule, setSchedule] = useState<InjectionScheduleItem[]>([]);
  const [scheduleEditor, setScheduleEditor] = useState<{ open: boolean; item?: InjectionScheduleItem }>({ open: false });
  const [adviceSubstance, setAdviceSubstance] = useState('');
  const chartRef = useRef<SVGSVGElement>(null);

  const today = todayLocalStr();

  useEffect(() => {
    if (!open) return;
    const migrated = migrateAllLegacyEntries();
    setEntries(migrated.length ? migrated : getInjectionDiary());
    setPage(1);
    setMode('journal');
    setSchedule(getInjectionSchedule());
    setScheduleEditor({ open: false });
  }, [open]);

  const stats = useMemo(() => computeInjectionStats(entries), [entries]);
  const anomalies = useMemo(() => detectInjectionAnomalies(entries), [entries]);
  const rotations = useMemo(() => getRotationWarnings(entries), [entries]);
  const frequency = useMemo(() => getWeeklyFrequency(entries, 6), [entries]);
  const summary = useMemo(() => getInjectionDiarySummary(30), [entries]);
  const risk = useMemo(() => getInjectionDiaryForRiskEngine(), [entries]);
  const pharma = useMemo(() => getInjectionDiaryForPharma(), [entries]);
  const suggestedZone = useMemo(() => getSuggestedZone(entries), [entries]);
  const chartData = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const trend = useMemo(() => getInjectionTrend(entries, trendDays), [entries, trendDays]);
  const zoneTechniqueMatrix = useMemo(() => getZoneTechniqueMatrix(entries), [entries]);
  const repeatLast = useMemo(() => getLastInjection(entries), [entries]);
  const zoneAdvice = useMemo(() => getZoneTechniqueAdvice(selectedZone), [selectedZone]);
  const uniqueSubstances = useMemo(() => [...new Set(entries.map((e) => e.substance.trim()).filter(Boolean))], [entries]);
  useEffect(() => {
    if (!adviceSubstance && uniqueSubstances.length) setAdviceSubstance(uniqueSubstances[0]);
  }, [uniqueSubstances, adviceSubstance]);
  const substanceAdvice = useMemo(() => {
    const substance = adviceSubstance || repeatLast?.substance || '';
    if (!substance) return null;
    return getSubstanceInjectionAdvice(substance);
  }, [adviceSubstance, repeatLast]);
  const doseSummary = useMemo(() => getDoseSummary(entries, doseRangeDays), [entries, doseRangeDays]);
  const dueToday = useMemo(() => getDueToday(schedule), [schedule]);
  const missed = useMemo(() => getMissedInjections(entries, schedule), [entries, schedule]);
  const missedZones = useMemo(
    () => new Set(missed.filter((m) => m.item.zone).map((m) => m.item.zone as string)),
    [missed],
  );
  const adherence = useMemo(() => computeScheduleAdherence(entries, schedule), [entries, schedule]);

  const localDateDaysAgo = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const visible = useMemo(() => {
    const cutoff = range === 'all' ? '' : localDateDaysAgo(Number(range));
    const search = query.trim().toLowerCase();
    return entries
      .filter(
        (entry) =>
          (!cutoff || entry.date >= cutoff) &&
          (!search ||
            [
              entry.date,
              entry.substance,
              entry.dose,
              zoneLabel(entry.zone),
              techniqueLabel(entry.technique),
              entry.notes || '',
            ].some((value) => value.toLowerCase().includes(search))),
      )
      .sort((a, b) => {
        const value = (entry: InjectionEntry): string | number =>
          sortKey === 'date'
            ? entry.date
            : sortKey === 'substance'
              ? entry.substance
              : sortKey === 'dose'
                ? parseDose(entry.dose)?.value || 0
                : sortKey === 'pain'
                  ? entry.painLevel
                  : sortKey === 'pip'
                    ? entry.pipLevel
                    : entry.volumeMl;
        const av = value(a);
        const bv = value(b);
        return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDesc ? -1 : 1);
      });
  }, [entries, range, query, sortKey, sortDesc]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const commit = (next: InjectionEntry[], previous = entries) => {
    setEntries(next);
    setUndo(previous);
    onDataChange?.();
  };
  const save = (draft: Draft, id?: string) => commit(id ? updateInjection(id, draft) : addInjection(draft));
  const remove = (entry: InjectionEntry) => {
    if (window.confirm(`Удалить запись от ${entry.date}?`)) commit(deleteInjection(entry.id));
  };
  const clear = () => {
    if (!entries.length || !window.confirm('Удалить весь журнал инъекций?')) return;
    const previous = entries;
    clearInjectionDiary();
    commit([], previous);
  };
  const restore = () => {
    if (!undo) return;
    setEntries(replaceInjectionDiary(undo));
    setUndo(null);
    onDataChange?.();
  };

  const exportCsv = () => {
    const head = [
      'Дата',
      'Препарат',
      'Доза',
      'Зона',
      'Сторона',
      'Объём мл',
      'Игла',
      'Техника',
      'Боль',
      'PIP',
      'Отёк',
      'Покраснение',
      'Уплотнение',
      'Гематома',
      'Температура',
      'Заметки',
    ];
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const body = entries.map((entry) =>
      [
        entry.date,
        entry.substance,
        entry.dose,
        zoneLabel(entry.zone),
        entry.side,
        entry.volumeMl,
        entry.needleGauge,
        techniqueLabel(entry.technique),
        entry.painLevel,
        entry.pipLevel,
        entry.swelling,
        entry.redness ? 'да' : '',
        entry.lump ? 'да' : '',
        entry.bruise ? 'да' : '',
        entry.fever ? 'да' : '',
        entry.notes || '',
      ]
        .map(cell)
        .join(','),
    );
    const url = URL.createObjectURL(
      new Blob(['\ufeff', head.map(cell).join(','), '\n', body.join('\n')], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `injection-diary-${todayLocalStr()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const print = () => {
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.document.write(
      `<html><head><title>Дневник инъекций</title><style>body{font:12px Arial;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:5px}h1{color:#111}</style></head><body><h1>Дневник инъекций</h1><p>Всего: ${stats.totalInjections}; средняя боль: ${stats.avgPain ?? '—'}; PIP: ${stats.avgPip ?? '—'}</p><table><tr><th>Дата</th><th>Препарат</th><th>Доза</th><th>Зона</th><th>PIP</th><th>Боль</th><th>Осложнения</th></tr>${entries.map((entry) => `<tr><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.substance)}</td><td>${escapeHtml(entry.dose)}</td><td>${escapeHtml(zoneLabel(entry.zone))}</td><td>${entry.pipLevel}/10</td><td>${entry.painLevel}/10</td><td>${escapeHtml([entry.redness && 'краснота', entry.lump && 'уплотнение', entry.bruise && 'гематома', entry.fever && 'температура'].filter(Boolean).join(', ') || '—')}</td></tr>`).join('')}</table></body></html>`,
    );
    popup.document.close();
    popup.print();
  };
  const exportChart = (png = false) => {
    const svg = chartRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `injection-pain-${todayLocalStr()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    if (png) {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 720;
        canvas.height = 230;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
        const pngLink = document.createElement('a');
        pngLink.href = canvas.toDataURL('image/png');
        pngLink.download = `injection-pain-${todayLocalStr()}.png`;
        pngLink.click();
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    }
  };

  if (!open) return null;
  const chartMax = 10;
  return (
    <div
      className="injection-window diary-scrollbar"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background:
          'radial-gradient(1000px 560px at 14% -12%, rgba(245,158,11,0.13), transparent 64%), radial-gradient(780px 460px at 100% -6%, rgba(245,158,11,0.07), transparent 58%), radial-gradient(900px 520px at 50% 118%, rgba(255,255,255,0.04), transparent 62%), #08080a',
        color: colors.text, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}
    >
      <style>{`
        .injection-window button { font-family: inherit; }
        .injection-window::-webkit-scrollbar { width: 10px; height: 10px; }
        .injection-window::-webkit-scrollbar-track { background: transparent; }
        .injection-window::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
        .injection-window::-webkit-scrollbar-thumb:hover { background: rgba(245,158,11,0.38); background-clip: content-box; }
        .diary-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .diary-card:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06); }
        @media (hover: none) and (pointer: coarse) {
          .injection-window button { min-height: 44px; }
          .injection-window input, .injection-window textarea, .injection-window select { font-size: 16px; }
        }
      `}</style>
      <DiaryHeader
        accent={ACCENT}
        title="💉 Инъекции"
        count={entries.length}
        onClose={onClose}
        onAdd={() => setEditor({ open: true })}
        addLabel="＋ Добавить"
        onToday={repeatLast
          ? () => {
              const last = entries[entries.length - 1];
              setRepeatDraft({
                date: todayLocalStr(),
                substance: last.substance,
                dose: last.dose,
                zone: last.zone,
                side: last.side,
                volumeMl: last.volumeMl,
                needleGauge: last.needleGauge,
                technique: last.technique,
                painLevel: 0,
                pipLevel: 0,
                swelling: 0,
                redness: false,
                lump: false,
                bruise: false,
                notes: '',
              });
              setEditor({ open: true });
            }
          : undefined}
        todayLabel="↻ Повторить"
        undoActive={!!undo}
        onUndo={restore}
        exportActions={[
          { label: '📥 CSV-файл', onClick: exportCsv },
          { label: '🖨 Печать / PDF', onClick: print },
          { label: '📈 График SVG', onClick: exportChart },
          { label: '🖼 График PNG', onClick: () => exportChart(true) },
          { label: '🗑 Очистить дневник', onClick: clear, danger: true },
        ]}
      />
      <main style={{ ...pageMain, maxWidth: 1180, paddingBottom: 72 }}>
        <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['journal', 'stats', 'chart', 'schedule'] as ViewMode[]).map((value) => (
            <button
              key={value}
              style={mode === value ? chipActive(ACCENT) : chip(ACCENT)}
              onClick={() => setMode(value)}
            >
              {value === 'journal' ? '📋 Журнал' : value === 'stats' ? '📊 Статистика' : value === 'chart' ? '📈 График боли / PIP' : '📅 Расписание'}
            </button>
          ))}
        </div>
        {anomalies.length > 0 && (
          <div
            style={{
              ...card,
              marginBottom: 12,
              background: anomalies.some(a => a.severity === 'danger') ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)',
              border: `1px solid ${anomalies.some(a => a.severity === 'danger') ? 'rgba(239,68,68,.25)' : 'rgba(245,158,11,.25)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <strong style={{ color: anomalies.some(a => a.severity === 'danger') ? '#fca5a5' : '#fcd34d' }}>
                  {anomalies.filter(a => a.severity === 'danger').length > 0
                    ? `Критических аномалий: ${anomalies.filter(a => a.severity === 'danger').length}`
                    : `Предупреждений: ${anomalies.length}`}
                </strong>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  {anomalies.slice(0, 3).map(a => a.message).join(' · ')}
                  {anomalies.length > 3 && ` · ещё ${anomalies.length - 3}`}
                </div>
              </div>
              <button
                style={{ ...button, fontSize: 11, padding: '6px 10px' }}
                onClick={() => setMode('stats')}
              >
                📊 Детали
              </button>
            </div>
          </div>
        )}
        <ZoneMap entries={entries} selectedZone={selectedZone} onSelectZone={(zoneId) => {
          setSelectedZone(zoneId);
          setEditor({ open: true });
        }} missedZones={missedZones} />
        <section style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
          <Metric label="Всего" value={stats.totalInjections} />
          <Metric
            label="Средняя боль"
            value={stats.avgPain ?? '—'}
            tone={stats.avgPain !== null ? scoreTone(stats.avgPain) : colors.primary}
          />
          <Metric
            label="Средний PIP"
            value={stats.avgPip ?? '—'}
            tone={stats.avgPip !== null ? scoreTone(stats.avgPip) : colors.primary}
          />
          <Metric
            label="Осложнения"
            value={`${stats.complicationRate}%`}
            tone={stats.complicationRate >= 20 ? colors.danger : colors.green}
          />
          <Metric label="За 7 дней" value={stats.last7?.count ?? 0} tone={colors.purple} />
          <Metric label="Рекомендована зона" value={zoneLabel(suggestedZone)} tone={colors.teal} />
        </section>

        {mode === 'journal' && (
          <section style={card}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', display: 'flex', alignItems: 'center' }}>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Поиск: препарат, зона, дата, заметка"
                  style={{ ...inputStyle, flex: 1, paddingRight: query ? 30 : undefined }}
                />
                {query && (
                  <button onClick={() => { setQuery(''); setPage(1); }} aria-label="Очистить поиск" style={{ position: 'absolute', right: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: colors.textMuted, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
                )}
              </div>
              {(['all', '7', '30', '90'] as Range[]).map((value) => (
                <button
                  key={value}
                  style={{
                    ...button,
                    background: range === value ? colors.primaryDim : undefined,
                    color: range === value ? colors.primary : undefined,
                  }}
                  onClick={() => {
                    setRange(value);
                    setPage(1);
                  }}
                >
                  {value === 'all' ? 'Все' : `${value} дней`}
                </button>
              ))}
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                style={{ ...selectStyle, width: 145 }}
              >
                <option value="date">Дата</option>
                <option value="substance">Препарат</option>
                <option value="dose">Доза</option>
                <option value="pain">Боль</option>
                <option value="pip">PIP</option>
                <option value="volume">Объём</option>
              </select>
              <button style={button} onClick={() => setSortDesc((value) => !value)}>
                ↕ {sortDesc ? 'убыв.' : 'возр.'}
              </button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{ ...selectStyle, width: 90 }}
              >
                <option value="10">10 / стр</option>
                <option value="25">25 / стр</option>
                <option value="50">50 / стр</option>
              </select>
            </div>
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="inj-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {[
                      'Дата',
                      'Препарат / доза',
                      'Зона',
                      'Техника',
                      'Объём',
                      'Боль / PIP / отёк',
                      'Флаги',
                      'Действия',
                    ].map((title) => (
                      <th
                        key={title}
                        style={{
                          textAlign: 'left',
                          padding: 8,
                          color: colors.textMuted,
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.map((entry) => (
                    <tr key={entry.id}>
                      <td data-label="Дата" style={{ padding: 8, whiteSpace: 'nowrap' }}>{entry.date}</td>
                      <td data-label="Препарат" style={{ padding: 8 }}>
                        <strong>{entry.substance}</strong>
                        <br />
                        <span style={{ color: colors.textMuted }}>
                          {entry.dose}
                          {parseDose(entry.dose)
                            ? ` · ${parseDose(entry.dose)!.value} ${parseDose(entry.dose)!.unit}`
                            : ''}
                        </span>
                      </td>
                      <td data-label="Зона" style={{ padding: 8 }}>
                        {zoneLabel(entry.zone)}
                        <br />
                        <span style={{ color: colors.textMuted }}>{entry.side === 'left' ? 'левая' : 'правая'}</span>
                      </td>
                      <td data-label="Техника" style={{ padding: 8 }}>
                        {techniqueLabel(entry.technique)}
                        <br />
                        {entry.needleGauge}
                      </td>
                      <td data-label="Объём" style={{ padding: 8 }}>{entry.volumeMl} мл</td>
                      <td data-label="PIP / Боль / Отёк" style={{ padding: 8 }}>
                        {entry.painLevel} / {entry.pipLevel} / {entry.swelling}
                      </td>
                      <td
                        data-label="Флаги"
                        style={{
                          padding: 8,
                          color: entry.redness || entry.lump || entry.bruise ? colors.warning : colors.textMuted,
                        }}
                      >
                        {[entry.redness && 'краснота', entry.lump && 'уплотнение', entry.bruise && 'гематома', entry.fever && 'температура']
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </td>
                      <td data-label="Действия" style={{ padding: 8, whiteSpace: 'nowrap' }}>
                        <button
                          style={{ ...button, minHeight: 34, padding: '5px 8px' }}
                          onClick={() => setEditor({ open: true, entry })}
                        >
                          ✎
                        </button>{' '}
                        <button
                          style={{ ...dangerButton, minHeight: 34, padding: '5px 8px' }}
                          onClick={() => remove(entry)}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!current.length && (
              <div style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>
                Нет записей. Добавьте первую инъекцию, чтобы начать отслеживание.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <button style={button} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                ←
              </button>
              <span style={{ color: colors.textMuted, fontSize: 12 }}>
                Страница {page} из {pages} · {visible.length} записей
              </span>
              <button style={button} disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
                →
              </button>
            </div>
          </section>
        )}

        {mode === 'stats' && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
              <div style={card}>
                <h3 style={{ margin: '0 0 8px' }}>📍 По зонам</h3>
                {stats.zoneStats.map((item) => (
                  <div
                    key={item.zone}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 8,
                      padding: '7px 0',
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <span>
                      {zoneLabel(item.zone)}
                      <small style={{ display: 'block', color: colors.textMuted }}>
                        боль {item.avgPain ?? '—'} · PIP {item.avgPip ?? '—'}
                      </small>
                    </span>
                    <strong>
                      {item.count}×
                      <small style={{ display: 'block', color: colors.textMuted }}>
                        {item.daysSinceLast ?? '—'} дн.
                      </small>
                    </strong>
                  </div>
                ))}
                {!stats.zoneStats.length && <span style={{ color: colors.textMuted }}>Нет данных</span>}
              </div>
              <div style={card}>
                <h3 style={{ margin: '0 0 8px' }}>🧪 По веществам</h3>
                {stats.substanceStats.map((item) => (
                  <div
                    key={item.substance}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '7px 0',
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <span>
                      {item.substance}
                      <small style={{ display: 'block', color: colors.textMuted }}>
                        средняя боль {item.avgPain ?? '—'}
                      </small>
                    </span>
                    <strong>{item.count}×</strong>
                  </div>
                ))}
                {!stats.substanceStats.length && <span style={{ color: colors.textMuted }}>Нет данных</span>}
              </div>
            </section>
            {stats.last7 && (
              <div style={{ ...card, marginTop: 12, background: 'rgba(59,130,246,.07)' }}>
                <b style={{ color: colors.blue }}>📊 Последние 7 дней</b>
                <div style={{ marginTop: 5, color: colors.textMuted }}>
                  {stats.last7.count} инъекций · средняя боль {stats.last7.avgPain} · средний PIP {stats.last7.avgPip}
                </div>
              </div>
            )}
            <div style={{ ...card, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>💊 Суммарные дозы</h3>
                <select
                  value={doseRangeDays}
                  onChange={(e) => setDoseRangeDays(Number(e.target.value))}
                  style={{ ...selectStyle, width: 110, fontSize: 12 }}
                >
                  <option value="7">7 дней</option>
                  <option value="30">30 дней</option>
                </select>
              </div>
              {doseSummary.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  {doseSummary.map((row) => (
                    <div
                      key={`${row.substance}-${row.unit}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '7px 0',
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <span>
                        {row.substance}
                        <small style={{ display: 'block', color: colors.textMuted }}>
                          {row.count}× · средняя {row.avg ?? '—'} {row.unit}
                        </small>
                      </span>
                      <strong>
                        {row.total} {row.unit}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: colors.textMuted, marginTop: 6, fontSize: 12 }}>
                  Нет доз с распознаваемыми единицами (мг/мл/IU) за выбранный период
                </div>
              )}
            </div>
            {trend && (
              <div style={{ ...card, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>📈 Тренд PIP</h3>
                  <select
                    value={trendDays}
                    onChange={(e) => setTrendDays(Number(e.target.value))}
                    style={{ ...selectStyle, width: 100, fontSize: 12 }}
                  >
                    <option value="7">7 дней</option>
                    <option value="14">14 дней</option>
                    <option value="30">30 дней</option>
                  </select>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: trend.direction === 'up' ? colors.danger : trend.direction === 'down' ? colors.green : colors.textMuted,
                    }}
                  >
                    {trend.direction === 'up' ? '↑ Ухудшение' : trend.direction === 'down' ? '↓ Улучшение' : '→ Стабильно'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>
                    Средний PIP: <b style={{ color: colors.text }}>{trend.avgPip ?? '—'}/10</b>
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>
                    Средняя боль: <b style={{ color: colors.text }}>{trend.avgPain ?? '—'}/10</b>
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>
                    Инъекций: <b style={{ color: colors.text }}>{trend.count}</b>
                  </span>
                </div>
              </div>
            )}
            {zoneTechniqueMatrix.length > 0 && (
              <div style={{ ...card, marginTop: 12 }}>
                <h3 style={{ margin: '0 0 8px' }}>🔬 PIP по зонам и техникам</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 6, color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Зона</th>
                        <th style={{ textAlign: 'left', padding: 6, color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Техника</th>
                        <th style={{ textAlign: 'right', padding: 6, color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>N</th>
                        <th style={{ textAlign: 'right', padding: 6, color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>PIP</th>
                        <th style={{ textAlign: 'right', padding: 6, color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>Боль</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zoneTechniqueMatrix.slice(0, 20).map((item, idx) => (
                        <tr key={`${item.zone}-${item.technique}-${idx}`}>
                          <td style={{ padding: 6 }}>{zoneLabel(item.zone)}</td>
                          <td style={{ padding: 6, color: colors.textMuted }}>{techniqueLabel(item.technique)}</td>
                          <td style={{ textAlign: 'right', padding: 6 }}>{item.count}</td>
                          <td style={{ textAlign: 'right', padding: 6, color: scoreTone(item.avgPip ?? 0) }}>{item.avgPip ?? '—'}/10</td>
                          <td style={{ textAlign: 'right', padding: 6 }}>{item.avgPain ?? '—'}/10</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <section style={{ ...card, marginTop: 12 }}>
              <h3 style={{ margin: '0 0 8px' }}>🚨 Осложнения и аномалии ({anomalies.length})</h3>
              {anomalies.length ? (
                anomalies.slice(0, 20).map((item, index) => (
                  <div
                    key={`${item.date}-${item.category}-${index}`}
                    style={{
                      padding: '8px 0',
                      borderBottom: `1px solid ${colors.border}`,
                      color: item.severity === 'danger' ? '#fca5a5' : '#fcd34d',
                    }}
                  >
                    ⚠ <b>{item.date}</b> · {item.message}{' '}
                    <small style={{ color: colors.textMuted }}>({item.category})</small>
                  </div>
                ))
              ) : (
                <div style={{ color: colors.green }}>✓ Аномалий не обнаружено</div>
              )}
            </section>
            <section style={{ ...card, marginTop: 12 }}>
              <h3 style={{ margin: '0 0 8px' }}>🔄 Предупреждения ротации</h3>
              {rotations.length ? (
                rotations.map((item) => (
                  <div
                    key={item.zone}
                    style={{
                      color: item.severity === 'danger' ? colors.danger : colors.warning,
                      fontSize: 12,
                      margin: '6px 0',
                    }}
                  >
                    ⚠ {zoneLabel(item.zone)} · {item.daysSince} дней · последняя {item.lastDate}
                  </div>
                ))
              ) : (
                <div style={{ color: colors.green }}>✓ Критических предупреждений нет</div>
              )}
            </section>
          </>
        )}

        {mode === 'chart' && (
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>📈 Динамика боли и PIP</h3>
              <div>
                <button
                  style={{
                    ...button,
                    minHeight: 34,
                    background: chartMetric === 'pain' ? colors.primaryDim : undefined,
                  }}
                  onClick={() => setChartMetric('pain')}
                >
                  Боль
                </button>{' '}
                <button
                  style={{
                    ...button,
                    minHeight: 34,
                    background: chartMetric === 'pip' ? colors.primaryDim : undefined,
                  }}
                  onClick={() => setChartMetric('pip')}
                >
                  PIP
                </button>
              </div>
            </div>
            {chartData.length >= 2 ? (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <svg
                  ref={chartRef}
                  viewBox={`0 0 ${Math.max(720, chartData.length * 44)} 230`}
                  width="100%"
                  height="230"
                  role="img"
                  aria-label="Динамика боли и PIP"
                >
                  <line x1="20" y1="190" x2={Math.max(700, chartData.length * 44)} y2="190" stroke="#555" />
                  {[0, 25, 50, 75, 100].map((y) => (
                    <line
                      key={y}
                      x1="20"
                      y1={190 - y * 1.55}
                      x2={Math.max(700, chartData.length * 44)}
                      y2={190 - y * 1.55}
                      stroke="rgba(255,255,255,.06)"
                    />
                  ))}
                  <polyline
                    points={chartData
                      .map(
                        (entry, index) =>
                          `${30 + index * 44},${190 - ((chartMetric === 'pain' ? entry.painLevel : entry.pipLevel) / chartMax) * 155}`,
                      )
                      .join(' ')}
                    fill="none"
                    stroke={chartMetric === 'pain' ? '#f97316' : '#ef4444'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={chartData
                      .map(
                        (entry, index) =>
                          `${30 + index * 44},190 ${30 + index * 44},${190 - ((chartMetric === 'pain' ? entry.painLevel : entry.pipLevel) / chartMax) * 155}`,
                      )
                      .join(' ')}
                    fill="none"
                    stroke={chartMetric === 'pain' ? 'rgba(249,115,22,0.08)' : 'rgba(239,68,68,0.08)'}
                    strokeWidth="44"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartData.map((entry, index) => {
                    const y = 190 - ((chartMetric === 'pain' ? entry.painLevel : entry.pipLevel) / chartMax) * 155;
                    return (
                      <g key={entry.id}>
                        <circle cx={30 + index * 44} cy={y} r="4" fill={chartMetric === 'pain' ? '#f97316' : '#ef4444'} stroke="#09090b" strokeWidth="1.5" />
                        <text x={30 + index * 44} y="215" fill="#ffffff" fontSize="8" textAnchor="middle">
                          {entry.date.slice(5)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 50, color: colors.textMuted }}>
                Для построения графика нужно минимум 2 записи
              </div>
            )}
            <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
              Показывается {chartMetric === 'pain' ? 'боль при введении' : 'пост-инъекционный PIP'} по датам. Экспорт
              доступен в шапке.
            </div>
          </section>
        )}

        {/* ========== SCHEDULE TAB ========== */}
        {mode === 'schedule' && (
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>📅 Расписание инъекций</h3>
              <button
                style={{ ...button, background: colors.primaryDim, color: colors.primary }}
                onClick={() => setScheduleEditor({ open: true })}
              >
                ➕ Добавить
              </button>
            </div>
            {schedule.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>
                Расписание пусто. Нажмите «➕ Добавить», чтобы создать план инъекций.
              </div>
            )}
            {dueToday.length > 0 && (
              <div
                style={{
                  marginBottom: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  background: 'rgba(245,158,11,0.10)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                <span style={{ fontSize: 15 }}>📌</span>
                <div style={{ flex: 1, minWidth: 160, fontSize: 12.5 }}>
                  <b style={{ color: '#fbbf24' }}>Сегодня по плану:</b>{' '}
                  {dueToday.map((s) => `${s.substance} ${s.dose}`).join(' · ')}
                </div>
                <button
                  style={{ ...button, minHeight: 32, padding: '5px 12px', background: 'rgba(245,158,11,.2)', color: '#fbbf24' }}
                  onClick={() => {
                    const item = dueToday[0];
                    setRepeatDraft({
                      date: todayLocalStr(),
                      substance: item.substance,
                      dose: item.dose,
                      zone: item.zone || 'glute_dorsal',
                      side: item.side || 'left',
                      volumeMl: item.volumeMl ?? 1,
                      needleGauge: item.needleGauge || '23G',
                      technique: item.technique || 'im',
                      painLevel: 0,
                      pipLevel: 0,
                      swelling: 0,
                      redness: false,
                      lump: false,
                      bruise: false,
                      fever: false,
                      notes: '',
                    });
                    setEditor({ open: true });
                  }}
                >
                  ✍ Записать
                </button>
              </div>
            )}
            {missed.length > 0 && (
              <div
                style={{
                  marginBottom: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  fontSize: 12,
                  color: '#fca5a5',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                ⏭ Пропущено за 7 дней: {missed.map((m) => `${m.item.substance} (${m.date})`).join(', ')}
              </div>
            )}
            {adherence.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {adherence.map((row) => (
                  <div key={row.item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {row.item.substance}{' '}
                        <span style={{ color: colors.textMuted, fontWeight: 400 }}>{row.item.dose}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                        {SCHEDULE_WEEKDAYS.map((label, day) => (
                          <span
                            key={label}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 6,
                              color: row.item.daysOfWeek.includes(day) ? '#fbbf24' : colors.textMuted,
                              background: row.item.daysOfWeek.includes(day) ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.03)',
                            }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>
                        <span>Соблюдение · {row.planned} по плану</span>
                        <b style={{ color: row.pct !== null && row.pct < 60 ? colors.danger : row.pct !== null && row.pct < 85 ? colors.warning : colors.green }}>
                          {row.pct !== null ? `${row.pct}%` : '—'}
                        </b>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${row.pct ?? 0}%`,
                            borderRadius: 999,
                            background:
                              row.pct !== null && row.pct < 60
                                ? colors.danger
                                : row.pct !== null && row.pct < 85
                                  ? colors.warning
                                  : colors.green,
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        style={{ ...button, minHeight: 32, padding: '4px 10px' }}
                        onClick={() => setScheduleEditor({ open: true, item: row.item })}
                      >
                        ✎
                      </button>
                      <button
                        style={{ ...button, minHeight: 32, padding: '4px 10px', background: colors.dangerDim, color: colors.danger }}
                        onClick={() => {
                          if (window.confirm(`Удалить пункт расписания «${row.item.substance}»?`)) {
                            setSchedule(removeScheduleItem(row.item.id));
                          }
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {schedule.length > 0 && adherence.length === 0 && (
              <div style={{ textAlign: 'center', padding: 16, color: colors.textMuted }}>
                Инъекций по расписанию нет за последние 7 дней.
              </div>
            )}
          </section>
        )}

        <section style={{ ...card, marginTop: 12 }}>
          {dueToday.length > 0 && (
            <div
              style={{
                marginBottom: 10,
                padding: '9px 12px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              <span style={{ fontSize: 15 }}>📌</span>
              <div style={{ flex: 1, minWidth: 160, fontSize: 12.5 }}>
                <b style={{ color: '#fbbf24' }}>Сегодня по плану:</b>{' '}
                {dueToday.map((s) => `${s.substance} ${s.dose}`).join(' · ')}
              </div>
              <button
                style={{ ...button, minHeight: 32, padding: '5px 12px', background: 'rgba(245,158,11,.2)', color: '#fbbf24' }}
                onClick={() => {
                  const item = dueToday[0];
                  setRepeatDraft({
                    date: todayLocalStr(),
                    substance: item.substance,
                    dose: item.dose,
                    zone: item.zone || 'glute_dorsal',
                    side: item.side || 'left',
                    volumeMl: item.volumeMl ?? 1,
                    needleGauge: item.needleGauge || '23G',
                    technique: item.technique || 'im',
                    painLevel: 0,
                    pipLevel: 0,
                    swelling: 0,
                    redness: false,
                    lump: false,
                    bruise: false,
                    fever: false,
                    notes: '',
                  });
                  setEditor({ open: true });
                }}
              >
                ✍ Записать
              </button>
            </div>
          )}
          {missed.length > 0 && (
            <div
              style={{
                marginBottom: 10,
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 12,
                color: '#fca5a5',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
            >
              ⏭ Пропущено за 7 дней: {missed.map((m) => `${m.item.substance} (${m.date})`).join(', ')}
            </div>
          )}
          {adherence.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {adherence.map((row) => (
                <div key={row.item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {row.item.substance}{' '}
                      <span style={{ color: colors.textMuted, fontWeight: 400 }}>{row.item.dose}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                      {SCHEDULE_WEEKDAYS.map((label, day) => (
                        <span
                          key={label}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 6,
                            color: row.item.daysOfWeek.includes(day) ? '#fbbf24' : colors.textMuted,
                            background: row.item.daysOfWeek.includes(day) ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.03)',
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>
                      <span>Соблюдение · {row.planned} по плану</span>
                      <b style={{ color: row.pct !== null && row.pct < 60 ? colors.danger : row.pct !== null && row.pct < 85 ? colors.warning : colors.green }}>
                        {row.pct !== null ? `${row.pct}%` : '—'}
                      </b>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${row.pct ?? 0}%`,
                          borderRadius: 999,
                          background:
                            row.pct !== null && row.pct < 60
                              ? colors.danger
                              : row.pct !== null && row.pct < 85
                                ? colors.warning
                                : colors.green,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{ ...button, minHeight: 32, padding: '4px 10px' }}
                      onClick={() => setScheduleEditor({ open: true, item: row.item })}
                    >
                      ✎
                    </button>
                    <button
                      style={{ ...dangerButton, minHeight: 32, padding: '4px 10px' }}
                      onClick={() => {
                        if (window.confirm(`Удалить пункт расписания «${row.item.substance}»?`)) {
                          setSchedule(removeScheduleItem(row.item.id));
                        }
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {adherence.length === 0 && !scheduleEditor.open && (
            <div style={{ color: colors.textMuted, fontSize: 12 }}>
              Нет активного расписания. Добавьте план (препарат + дни недели) — будет считаться соблюдение и
              напоминания о пропущенных инъекциях.
            </div>
          )}
          {scheduleEditor.open && (
            <ScheduleItemEditor
              initial={scheduleEditor.item}
              onClose={() => setScheduleEditor({ open: false })}
              onSave={(item) => {
                if (item.id) {
                  setSchedule(updateScheduleItem(item.id, item));
                } else {
                  setSchedule(addScheduleItem(item));
                }
                setScheduleEditor({ open: false });
              }}
            />
          )}
        </section>

        <section
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginTop: 12 }}
        >
          <div style={card}>
            <h3 style={{ margin: '0 0 8px' }}>📊 Частота за 6 недель</h3>
            <svg viewBox="0 0 720 190" width="100%" height="170" aria-label="Частота инъекций">
              {frequency.map((item, index) => {
                const max = Math.max(1, ...frequency.map((value) => value.count));
                const height = (item.count / max) * 125;
                return (
                  <g key={item.week}>
                    <rect
                      x={20 + index * 115}
                      y={145 - height}
                      width="70"
                      height={height}
                      rx="6"
                      fill={colors.teal}
                      opacity=".85"
                    />
                    <text x={55 + index * 115} y={137 - height} textAnchor="middle" fill="#fff" fontSize="14">
                      {item.count}
                    </text>
                    <text x={55 + index * 115} y="170" textAnchor="middle" fill="#ffffff" fontSize="9">
                      {item.week.split('–')[0]}
                    </text>
                  </g>
                );
              })}
              <line x1="12" y1="146" x2="705" y2="146" stroke="#555" />
            </svg>
            <div style={{ color: colors.textMuted, fontSize: 11 }}>
              30 дней: {summary.recentInjections.length} записей · Pharma: {pharma.totalEntries} за 30 дней
            </div>
          </div>
          <div style={card}>
            <h3 style={{ margin: '0 0 8px' }}>🛡 Состояние и риск</h3>
            <p style={{ margin: '6px 0', color: risk.riskFactors.length ? '#fca5a5' : '#86efac' }}>
              {risk.recommendation}
            </p>
            {risk.riskFactors.map((factor) => (
              <div key={factor} style={{ color: colors.danger, fontSize: 12, marginTop: 5 }}>
                ⚠ {factor}
              </div>
            ))}
          </div>
          <div style={card}>
            <h3 style={{ margin: '0 0 8px' }}>💉 Техника инъекций</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: colors.textMuted }}>Зона:</span>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                style={{ ...selectStyle, width: 220, fontSize: 12 }}
              >
                {INJECTION_ZONES.map(z => (
                  <option key={z.id} value={z.id}>{zoneLabel(z.id)}</option>
                ))}
              </select>
            </div>
            {zoneAdvice && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 8 }}>
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Игла</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{zoneAdvice.needleGauge} × {zoneAdvice.needleLength}</div>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Угол / Макс. объём</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{zoneAdvice.angle} / {zoneAdvice.maxVolumeMl} мл</div>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Раствор / Риск</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{zoneAdvice.solutionType} · {zoneAdvice.risk}</div>
                </div>
              </div>
            )}
            {zoneAdvice && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {zoneAdvice.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#fca5a5' }}>⚠ {w}</div>
                ))}
                {zoneAdvice.tips.map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: colors.textMuted }}>→ {t}</div>
                ))}
              </div>
            )}
            {substanceAdvice && (
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors.blue }}>Рекомендации для препарата</div>
                  <select
                    value={adviceSubstance}
                    onChange={(e) => setAdviceSubstance(e.target.value)}
                    style={{ ...selectStyle, width: '100%', fontSize: 12, flex: '1 1 200px' }}
                  >
                    {uniqueSubstances.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: 12, color: colors.text }}><b>Техника:</b> {substanceAdvice.technique}</div>
                <div style={{ fontSize: 12, color: colors.text }}><b>Игла:</b> {substanceAdvice.needle}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{substanceAdvice.notes}</div>
              </div>
            )}
            {!zoneAdvice && (
              <div style={{ color: colors.textMuted, fontSize: 12 }}>Выберите зону для просмотра параметров инъекции</div>
            )}
          </div>
          <div style={card}>
            <h3 style={{ margin: '0 0 8px' }}>💡 Рекомендации</h3>
            {summary.recommendations.length === 0 ? (
              <div style={{ color: colors.textMuted }}>Нет рекомендаций</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summary.recommendations.map((rec: import('../../../../../engines/injection-diary.engine').InjectionRecommendation, idx: number) => (
                  <div key={idx} style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: rec.priority === 'high' ? 'rgba(239,68,68,0.12)' : rec.priority === 'medium' ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${rec.priority === 'high' ? 'rgba(239,68,68,0.35)' : rec.priority === 'medium' ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: rec.action ? 4 : 0, color: rec.priority === 'high' ? '#fca5a5' : rec.priority === 'medium' ? '#fdba74' : colors.text }}>
                      {rec.message}
                    </div>
                    {rec.action && (
                      <div style={{ fontSize: 12, color: colors.textMuted }}>
                        → {rec.action}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <InjectionEditor
        open={editor.open}
        editing={Boolean(editor.entry)}
        initial={repeatDraft || (editor.entry ? { ...editor.entry, notes: editor.entry.notes || '' } : emptyDraft(selectedZone))}
        suggestedZone={suggestedZone}
        onClose={() => {
          setEditor({ open: false });
          setRepeatDraft(null);
        }}
        onSave={(draft) => {
          save(draft, editor.entry?.id);
          setEditor({ open: false });
          setRepeatDraft(null);
        }}
        onSaveMore={(draft) => {
          save(draft, editor.entry?.id);
        }}
      />
      <style>{`
        @media (max-width: 640px) {
          .inj-table thead { display: none; }
          .inj-table tbody tr { display: block; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px; background: rgba(255,255,255,0.02); }
          .inj-table tbody td { display: flex; justify-content: space-between; padding: 5px 0; border: none; }
          .inj-table tbody td::before { content: attr(data-label); font-weight: 600; color: #ffffff; margin-right: 10px; }
          .inj-table tbody td:last-child { justify-content: flex-start; }
        }
        @media (hover: none) and (pointer: coarse) {
          .inj-table tbody td, .inj-table thead th { padding: 10px 6px; }
        }
      `}</style>
    </div>
  );
};
