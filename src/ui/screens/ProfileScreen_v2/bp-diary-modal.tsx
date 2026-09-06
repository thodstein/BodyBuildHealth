/**
 * bp-diary-modal.tsx — модалка добавления записи давления.
 * Умные дефолты из последней записи, живая классификация АД,
 * dual-спарклайн (систола/диастола), PP/MAP, симптомы, рука/позиция,
 * валидация кризов, 3/7-дневные средние, тренд.
 */
import React, { useEffect, useMemo } from 'react';
import { colors } from './ui';
import { NativeIcon } from '../../native/NativeIcons';
import { todayIso } from './diary-helpers';
import { BP_SYMPTOMS, classifyBP } from '../../../core/bp-hr-data';
import {
  DiaryModalShell,
  SectionCard,
  TextField,
  FormBanner,
  LiveBadge,
  ChipGroup,
  fieldInput,
  readDiaryEntries,
  lastEntryOf,
  useDiaryDraft,
  TodayChip,
  RepeatLastChip,
  daysSince,
} from './diary-modals';

/* ── Модалка АД ── */

const BP_TONE: Record<string, { label: string; color: string }> = {
  normal: { label: 'Норма', color: '#22c55e' },
  elevated: { label: 'Норма (высокая)', color: '#60a5fa' },
  high: { label: 'Повышенное', color: '#a78bfa' },
  h1: { label: 'Гипертония 1 ст.', color: '#f59e0b' },
  h2: { label: 'Гипертония 2 ст.', color: '#f97316' },
  h3: { label: 'Гипертония 3 ст.', color: '#ef4444' },
};

export const bpCategory = (s: number, d: number): { label: string; color: string } => {
  if (!Number.isFinite(s) || !Number.isFinite(d) || s <= 0 || d <= 0) return { label: 'Введите показатели', color: colors.textMuted };
  // Пороги берём из единого ядра classifyBP (bp-hr-data.ts), детализация лейблов — своя.
  const cls = classifyBP(s, d);
  if (cls === 'crisis') return BP_TONE.h3;
  if (cls === 'stage2') return s >= 160 || d >= 100 ? BP_TONE.h2 : BP_TONE.h1;
  if (cls === 'stage1') return BP_TONE.high;
  if (cls === 'elevated') return BP_TONE.elevated;
  return BP_TONE.normal;
};

type BpRec = {
  date?: string;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  hr?: number;
  timeOfDay?: string;
  arm?: 'left' | 'right';
  position?: 'sitting' | 'lying' | 'standing';
  symptoms?: string[];
  medicationTaken?: boolean;
  notes?: string;
};

interface BPDraft {
  date: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  arm: 'left' | 'right';
  position: 'sitting' | 'lying' | 'standing';
  symptoms: string[];
  medicationTaken: boolean;
  notes: string;
}

const SYMPTOM_ICONS: Record<string, string> = {
  'Головная боль': '🤕', 'Головокружение': '💫', 'Шум в ушах': '👂',
  'Боль в груди': '🫀', 'Одышка': '🫁', 'Тошнота': '🤢', 'Мелькание мушек': '✨',
  'Слабость': '😴', 'Отёки': '🦵', 'Потливость': '💦',
  'Учащённое сердцебиение': '💓', 'Нарушение зрения': '👁', 'Боль в спине': '🔙',
  'Чувство тревоги': '😰',
};

const SYMPTOM_OPTIONS: { id: string; label: string }[] = BP_SYMPTOMS.map((s) => ({
  id: s,
  label: `${SYMPTOM_ICONS[s] ?? '•'} ${s}`,
}));

const ARM_OPTIONS: { id: 'left' | 'right'; label: string }[] = [
  { id: 'left', label: '👈 Левая' },
  { id: 'right', label: '👉 Правая' },
];

const POSITION_OPTIONS: { id: 'sitting' | 'lying' | 'standing'; label: string }[] = [
  { id: 'sitting', label: '🪑 Сидя' },
  { id: 'lying', label: '🛌 Лежа' },
  { id: 'standing', label: '🧍 Стоя' },
];

export const AddBPModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: (e: any) => void;
  presetTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}> = ({ open, onClose, onSave, presetTimeOfDay }) => {
  const initial = (): BPDraft => {
    const last = lastEntryOf(readDiaryEntries<BpRec>('he_bp_diary'));
    const lastPulse = last?.pulse ?? last?.hr;
    return {
      date: todayIso(),
      systolic: last?.systolic ? String(last.systolic) : '120',
      diastolic: last?.diastolic ? String(last.diastolic) : '80',
      pulse: lastPulse && lastPulse > 0 ? String(lastPulse) : '70',
      timeOfDay:
        last?.timeOfDay === 'afternoon' || last?.timeOfDay === 'evening' || last?.timeOfDay === 'night'
          ? (last.timeOfDay as BPDraft['timeOfDay'])
          : 'morning',
      arm: last?.arm ?? 'left',
      position: last?.position ?? 'sitting',
      symptoms: [],
      medicationTaken: false,
      notes: '',
    };
  };
  const [draft, setDraft, resetDraft] = useDiaryDraft<BPDraft>('he_draft_bp', initial);
  // Пресет рутинга (утро/вечер) имеет приоритет над сохранённым черновиком.
  useEffect(() => {
    if (presetTimeOfDay) setDraft((p) => ({ ...p, timeOfDay: presetTimeOfDay as BPDraft['timeOfDay'] }));
  }, [presetTimeOfDay, setDraft]);
  const lastRec = useMemo(() => lastEntryOf(readDiaryEntries<BpRec>('he_bp_diary')), [open]);
  const set = (key: keyof BPDraft, val: string | string[] | boolean) => setDraft((p) => ({ ...p, [key]: val }));

  const s = Number(draft.systolic);
  const d = Number(draft.diastolic);
  const p = Number(draft.pulse);
  const sInvalid = !Number.isFinite(s) || s < 50 || s > 250;
  const dInvalid = !Number.isFinite(d) || d < 30 || d > 180 || (Number.isFinite(d) && Number.isFinite(s) && d >= s);
  const pInvalid = !Number.isFinite(p) || p < 20 || p > 250;
  const valid = !sInvalid && !dInvalid && !pInvalid;
  const dge = Number.isFinite(s) && Number.isFinite(d) && d >= s;
  const cat = bpCategory(s, d);

  /* ── Расчётные показатели ── */
  const pp = Number.isFinite(s) && Number.isFinite(d) ? s - d : null; // Pulse Pressure
  const map = Number.isFinite(s) && Number.isFinite(d) ? Math.round((2 * d + s) / 3) : null; // MAP
  const ppWarn = pp !== null && (pp > 60 || pp < 30);
  const mapWarn = map !== null && (map > 110 || map < 60);

  /* ── Тренд и средние ── */
  const history = useMemo(
    () => readDiaryEntries<BpRec>('he_bp_diary').slice(-7),
    [open],
  );
  const systolicHistory = history.map((e) => (typeof e?.systolic === 'number' ? e.systolic : null));
  const diastolicHistory = history.map((e) => (typeof e?.diastolic === 'number' ? e.diastolic : null));
  const avg3 = useMemo(() => {
    const vals = history.slice(-3).filter((e) => typeof e.systolic === 'number' && typeof e.diastolic === 'number');
    if (!vals.length) return null;
    return {
      sys: Math.round(vals.reduce((a, e) => a + (e.systolic || 0), 0) / vals.length),
      dia: Math.round(vals.reduce((a, e) => a + (e.diastolic || 0), 0) / vals.length),
    };
  }, [history]);
  const avg7 = useMemo(() => {
    const vals = history.filter((e) => typeof e.systolic === 'number' && typeof e.diastolic === 'number');
    if (!vals.length) return null;
    return {
      sys: Math.round(vals.reduce((a, e) => a + (e.systolic || 0), 0) / vals.length),
      dia: Math.round(vals.reduce((a, e) => a + (e.diastolic || 0), 0) / vals.length),
    };
  }, [history]);
  const trend = useMemo(() => {
    if (history.length < 2) return '→';
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    if (!last.systolic || !prev.systolic) return '→';
    const diff = last.systolic - prev.systolic;
    return diff > 2 ? '↑' : diff < -2 ? '↓' : '→';
  }, [history]);

  const save = () => {
    if (!draft.date || !valid || dge) return;
    onSave({
      date: draft.date,
      systolic: s,
      diastolic: d,
      hr: p,
      pulse: p,
      timeOfDay: draft.timeOfDay,
      arm: draft.arm,
      position: draft.position,
      symptoms: draft.symptoms,
      medicationTaken: draft.medicationTaken,
      notes: draft.notes.trim() || undefined,
    });
    resetDraft();
    onClose();
  };

  const spark = useMemo(
    () => ({
      sys: systolicHistory,
      dia: diastolicHistory,
    }),
    [systolicHistory, diastolicHistory],
  );

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Запись давления"
      icon={<NativeIcon name="heart" size={28} />}
      color="#ef4444"
      subtitle="Систола, диастола и пульс в покое"
      onSubmit={save}
      spark={spark.sys.length > 1 ? { data: spark.sys, color: '#f87171' } : undefined}
      stale={lastRec ? { days: daysSince(lastRec.date) ?? 0 } : null}
      fill={{ current: (sInvalid ? 0 : 1) + (dInvalid ? 0 : 1) + (pInvalid ? 0 : 1), total: 3 }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <TextField label="Дата" value={draft.date} onChange={(v) => set('date', v)} type="date" />
        </div>
        <TodayChip date={draft.date} onToday={() => set('date', todayIso())} />
      </div>

      <SectionCard icon={<NativeIcon name="clock" size={16} />} title="Время и условия" color="#ef4444">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
          {([['morning', '🌅 Утро'], ['afternoon', '☀️ День'], ['evening', '🌆 Вечер'], ['night', '🌙 Ночь']] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => set('timeOfDay', k)}
              style={{
                flex: 1,
                minHeight: 48,
                padding: '10px 10px',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 800,
                border: `1px solid ${draft.timeOfDay === k ? '#ef4444' : colors.border}`,
                background: draft.timeOfDay === k ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.03)',
                color: draft.timeOfDay === k ? '#f87171' : colors.textMuted,
                boxShadow: draft.timeOfDay === k ? '0 3px 12px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
                transition: 'all 0.15s',
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {ARM_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => set('arm', o.id)}
              style={{
                flex: 1,
                minHeight: 40,
                padding: '8px 10px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                border: `1px solid ${draft.arm === o.id ? '#ef4444' : colors.border}`,
                background: draft.arm === o.id ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.03)',
                color: draft.arm === o.id ? '#f87171' : colors.textMuted,
                transition: 'all 0.15s',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {POSITION_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => set('position', o.id)}
              style={{
                flex: 1,
                minHeight: 40,
                padding: '8px 10px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                border: `1px solid ${draft.position === o.id ? '#ef4444' : colors.border}`,
                background: draft.position === o.id ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.03)',
                color: draft.position === o.id ? '#f87171' : colors.textMuted,
                transition: 'all 0.15s',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {dge && <FormBanner tone="error">Диастола не может быть ≥ систолы ({d} ≥ {s}) — проверьте значения</FormBanner>}
      {!dge && !valid && (Number.isFinite(s) || Number.isFinite(d)) && (
        <FormBanner tone="error">Значения вне диапазона: систола 50–250, диастола 30–180, пульс 20–250</FormBanner>
      )}
      {valid && !dge && s >= 180 && <FormBanner tone="error">Систола ≥ 180 — гипертонический криз, обратитесь к врачу</FormBanner>}
      {ppWarn && <FormBanner tone="warning">{pp! > 60 ? `Пульсовое давление ${pp} мм — расширено (>60), риск ССЗ` : `Пульсовое давление ${pp} мм — сужено (<30), проверьте измерение`}</FormBanner>}
      {mapWarn && <FormBanner tone="warning">{map! > 110 ? `СРД ${map} мм — высокое (>110), нагрузка на сердце` : `СРД ${map} мм — низкое (<60), риск гипоперфузии`}</FormBanner>}

      <SectionCard icon={<NativeIcon name="heart" size={16} />} title="Показатели" color="#ef4444" badge={`${cat.label} ${trend}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <TextField label="Систола" value={draft.systolic} onChange={(v) => set('systolic', v)} type="number" min={50} max={250} unit="мм" accent="#ef4444" invalid={sInvalid} />
          <TextField label="Диастола" value={draft.diastolic} onChange={(v) => set('diastolic', v)} type="number" min={30} max={180} unit="мм" accent="#ef4444" invalid={dInvalid} />
          <TextField label="Пульс" value={draft.pulse} onChange={(v) => set('pulse', v)} type="number" min={20} max={250} unit="уд/мин" invalid={pInvalid} />
        </div>

        {/* PP / MAP row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 10 }}>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: `rgba(239,68,68,${ppWarn ? '0.18' : '0.08'})`, border: `1px solid ${ppWarn ? '#ef444466' : '#ef444433'}`, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Пульсовое давление (PP)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ppWarn ? '#ef4444' : '#f87171', marginTop: 2 }}>{pp !== null ? `${pp} мм` : '—'}</div>
            <div style={{ fontSize: 9, color: ppWarn ? '#ef4444' : colors.textSubtle, marginTop: 2 }}>{ppWarn ? (pp! > 60 ? '⚠ Расширено' : '⚠ Сужено') : 'Норма 30–60'}</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: `rgba(167,139,250,${mapWarn ? '0.18' : '0.08'})`, border: `1px solid ${mapWarn ? '#a78bfa66' : '#a78bfa33'}`, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>СРД (MAP)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: mapWarn ? '#a78bfa' : '#c4b5fd', marginTop: 2 }}>{map !== null ? `${map} мм` : '—'}</div>
            <div style={{ fontSize: 9, color: mapWarn ? '#a78bfa' : colors.textSubtle, marginTop: 2 }}>{mapWarn ? (map! > 110 ? '⚠ Высокое' : '⚠ Низкое') : 'Норма 70–110'}</div>
          </div>
        </div>

        {/* Dual mini sparkline */}
        {(spark.sys.length > 1 || spark.dia.length > 1) && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase' }}>Динамика 7 дн</span>
              <span style={{ display: 'inline-flex', width: 12, height: 3, borderRadius: 2, background: '#f87171' }}></span>
              <span style={{ fontSize: 10, color: '#f87171' }}>Систола</span>
              <span style={{ display: 'inline-flex', width: 12, height: 3, borderRadius: 2, background: '#60a5fa' }}></span>
              <span style={{ fontSize: 10, color: '#60a5fa' }}>Диастола</span>
            </div>
            <div style={{ height: 36 }}>
              <svg width="100%" height="36" viewBox="0 0 200 36" style={{ overflow: 'visible' }} aria-hidden="true">
                {spark.sys.length > 1 && (() => {
                  const pts = spark.sys.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).slice(-7);
                  const allVals = [...pts, ...spark.dia.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).slice(-7)];
                  const min = Math.min(...allVals);
                  const max = Math.max(...allVals);
                  const range = max - min || 1;
                  const x = (i: number) => ((i * 190) / (pts.length - 1) + 5).toFixed(1);
                  const y = (v: number) => (32 - ((v - min) / range) * 28).toFixed(1);
                  const path = pts.map((v: number, i: number) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
                  return <path d={path} fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />;
                })()}
                {spark.dia.length > 1 && (() => {
                  const pts = spark.dia.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).slice(-7);
                  const allVals = [...pts, ...spark.sys.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).slice(-7)];
                  const min = Math.min(...allVals);
                  const max = Math.max(...allVals);
                  const range = max - min || 1;
                  const x = (i: number) => ((i * 190) / (pts.length - 1) + 5).toFixed(1);
                  const y = (v: number) => (32 - ((v - min) / range) * 28).toFixed(1);
                  const path = pts.map((v: number, i: number) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
                  return <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" strokeDasharray="4,3" />;
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* Averages */}
        {(avg3 || avg7) && (
          <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {avg3 && (
              <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 11 }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>Ср. за 3 дня: </span>
                <span style={{ color: '#4ade80' }}>{avg3.sys}/{avg3.dia}</span>
              </div>
            )}
            {avg7 && (
              <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', fontSize: 11 }}>
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>Ср. за 7 дней: </span>
                <span style={{ color: '#93c5fd' }}>{avg7.sys}/{avg7.dia}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <LiveBadge color={cat.color} icon={<NativeIcon name="eye" size={12} />}>{cat.label} {trend}</LiveBadge>
        </div>
      </SectionCard>

      <SectionCard icon={<NativeIcon name="activity" size={16} />} title="Симптомы" color="#ef4444" hint="Отметьте, что беспокоило во время измерения">
        <ChipGroup
          options={SYMPTOM_OPTIONS}
          selected={draft.symptoms}
          onChange={(ids) => set('symptoms', ids)}
          color="#ef4444"
          columns={2}
        />
      </SectionCard>

      <SectionCard icon={<NativeIcon name="pill" size={16} />} title="Лекарства" color="#ef4444">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 12, background: draft.medicationTaken ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${draft.medicationTaken ? '#ef444444' : colors.border}` }}>
          <input
            type="checkbox"
            checked={draft.medicationTaken}
            onChange={(e) => set('medicationTaken', e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#ef4444', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: draft.medicationTaken ? '#f87171' : colors.text }}>Приём гипотензивных препаратов перед замером</span>
        </label>
      </SectionCard>

      <SectionCard icon={<NativeIcon name="file" size={16} />} title="Заметка" color="#ef4444">
        <textarea
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
          style={{ ...fieldInput, minHeight: 52, resize: 'vertical' }}
          placeholder="Заметка (самочувствие, лекарства, обстоятельства…)"
        />
      </SectionCard>

      {lastRec && (
        <div style={{ marginTop: 6 }}>
          <RepeatLastChip label={`Повторить последнее (${lastRec.date}: ${lastRec.systolic}/${lastRec.diastolic})`} onClick={() => setDraft(initial())} />
        </div>
      )}
    </DiaryModalShell>
  );
};