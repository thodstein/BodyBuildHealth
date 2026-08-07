/**
 * ProfileDiariesTab — вкладка "Дневники".
 * Встроенные дневники (в Профиле) с кнопками добавления записей + быстрый доступ
 * к дневникам в других блоках (открывает конкретный дневник/отчёт).
 */
import React, { useState, useEffect } from 'react';
import { db } from '../../../core/db';
import { getWeightLog, saveWeightLog, getMeasurementsLog, saveMeasurementsLog } from '../../../engines/profile-store';
import { useProfileRefresh } from '../../../core/profile-manager';
import { AccordionSection, colors } from './ui';
import {
  computeStreak,
  computePeriodDelta,
  computeExtremes,
  groupEntriesByPeriod,
  buildSparkline,
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
  type DiaryKey,
  type DiaryEntryLike,
  type DiaryGoals,
  defaultGoals,
} from './diary-helpers';

/* ── Типы для встроенных дневников ── */

const SLEEP_DIARY_KEY = 'he_sleep_diary';
interface SleepEntry {
  date: string; hours: number; quality: number;
  awakenings: number; bedtime: string; wakeTime: string; notes?: string;
}
const BP_DIARY_KEY = 'he_bp_diary';
interface BPEntry { date: string; systolic: number; diastolic: number; pulse: number; notes?: string; }
const INJECTION_DIARY_KEY = 'he_injection_diary';
interface InjectionEntry { date: string; substance: string; dose: string; site: string; notes?: string; }
const SYMPTOMS_DIARY_KEY = 'he_symptoms_diary';
export interface SymptomEntry {
  date: string;
  name: string;
  severity: 1 | 2 | 3 | 4 | 5;
  duration?: string;
  notes?: string;
}
const PAIN_DIARY_KEY = 'he_pain_diary';
export interface PainEntry {
  date: string;
  zones: Record<string, number>;
  totalScore: number;
  notes?: string;
}
const NEURO_DIARY_KEY = 'he_neuro_diary';
export interface NeuroEntry {
  date: string;
  symptoms: Record<string, boolean>;
  totalScore: number;
  notes?: string;
}
const ACNE_DIARY_KEY = 'he_acne_diary';
export interface AcneEntry {
  date: string;
  areas: Record<string, number>;
  totalScore: number;
  notes?: string;
}
const HEMATO_DIARY_KEY = 'he_hemato_diary';
export interface HematoEntry {
  date: string;
  symptoms: Record<string, boolean>;
  totalScore: number;
  notes?: string;
}

interface BuiltInDiaryRow { key: DiaryKey; count: number; last: string; }

/* ── Хелперы localStorage ── */

function loadDiary<T>(key: string): T[] {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveDiary<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data.slice(-365))); } catch {}
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

/* ── Модалка (модальный диалог) ── */

const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(380px, 92vw)', maxHeight: '90vh', overflowY: 'auto',
          background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 20,
          color: colors.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.primary }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{ background: 'transparent', border: 'none', color: colors.textMuted, fontSize: 20, cursor: 'pointer', padding: 4, minWidth: 32, minHeight: 32 }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const fieldLabel: React.CSSProperties = { fontSize: 11, color: colors.textMuted, fontWeight: 600, marginBottom: 4, display: 'block' };
const fieldInput: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 12px', color: colors.text, fontSize: 14, outline: 'none',
  boxSizing: 'border-box', minHeight: 40,
};
const btnPrimary = (color: string): React.CSSProperties => ({
  flex: 1, minHeight: 40, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
  background: color, color: '#000', border: 'none', cursor: 'pointer',
});
const btnGhost: React.CSSProperties = {
  flex: 1, minHeight: 40, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, cursor: 'pointer',
};

const DateInput: React.FC<{ value: string; onChange: (v: string) => void; style?: React.CSSProperties }> = ({ value, onChange, style }) => {
  const today = todayIso();
  const isFuture = value > today;
  return (
    <div>
      <input
        type="date"
        value={value}
        max={today}
        onChange={e => onChange(e.target.value)}
        style={{
          ...fieldInput,
          ...(isFuture ? { borderColor: '#f59e0b', background: 'rgba(245,158,11,0.08)' } : {}),
          ...style,
        }}
        aria-invalid={isFuture}
        aria-label="Дата (не позже сегодняшней)"
      />
      {isFuture && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
          ⚠ Будущая дата — обычно записывают прошедшие дни. Это не запрещено, но проверьте.
        </div>
      )}
    </div>
  );
};

/* ── Модалки добавления записей ── */

const AddSleepModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: SleepEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState('7.5');
  const [quality, setQuality] = useState('4');
  const [awakenings, setAwakenings] = useState('1');
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [notes, setNotes] = useState('');

  const submit = () => {
    const h = Number(hours);
    const q = Number(quality);
    const a = Number(awakenings);
    if (!date || !Number.isFinite(h) || h < 0 || h > 24) return;
    if (!Number.isFinite(q) || q < 1 || q > 5) return;
    onSave({ date, hours: h, quality: q, awakenings: a, bedtime, wakeTime, notes });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="💤 Добавить запись сна">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <label style={fieldLabel}>Часы сна</label>
          <input type="number" step="0.5" min="0" max="24" value={hours} onChange={e => setHours(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Качество (1-5)</label>
          <input type="number" step="1" min="1" max="5" value={quality} onChange={e => setQuality(e.target.value)} style={fieldInput} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <label style={fieldLabel}>Пробуждений</label>
          <input type="number" step="1" min="0" max="20" value={awakenings} onChange={e => setAwakenings(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Лёг</label>
          <input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Подъём</label>
          <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={fieldInput} />
        </div>
      </div>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} placeholder="Кошмары, будильник, отдых..." />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.primary)}>Сохранить</button>
      </div>
    </Modal>
  );
};

const AddBPModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: BPEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [pulse, setPulse] = useState('70');
  const [notes, setNotes] = useState('');

  const submit = () => {
    const s = Number(systolic); const d = Number(diastolic); const p = Number(pulse);
    if (!date || !Number.isFinite(s) || s < 50 || s > 250) return;
    if (!Number.isFinite(d) || d < 30 || d > 180) return;
    if (!Number.isFinite(p) || p < 20 || p > 250) return;
    onSave({ date, systolic: s, diastolic: d, pulse: p, notes });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="❤️ Добавить запись АД">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <label style={fieldLabel}>Систола</label>
          <input type="number" min="50" max="250" value={systolic} onChange={e => setSystolic(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Диастола</label>
          <input type="number" min="30" max="180" value={diastolic} onChange={e => setDiastolic(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Пульс</label>
          <input type="number" min="20" max="250" value={pulse} onChange={e => setPulse(e.target.value)} style={fieldInput} />
        </div>
      </div>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} placeholder="Условия измерения..." />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.danger)}>Сохранить</button>
      </div>
    </Modal>
  );
};

const AddWeightModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: { date: string; weight: number }) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [weight, setWeight] = useState('80');
  const submit = () => {
    const w = Number(weight);
    if (!date || !Number.isFinite(w) || w < 30 || w > 250) return;
    onSave({ date, weight: w });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="⚖️ Добавить запись веса">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Вес (кг)</label>
      <input type="number" step="0.1" min="30" max="250" value={weight} onChange={e => setWeight(e.target.value)} style={fieldInput} />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.green)}>Сохранить</button>
      </div>
    </Modal>
  );
};

const AddMeasurementsModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [waistCm, setWaistCm] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [bicepCm, setBicepCm] = useState('');
  const [thighCm, setThighCm] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [forearmCm, setForearmCm] = useState('');
  const [bodyFat, setBodyFat] = useState('');

  const submit = () => {
    if (!date) return;
    const e: any = {
      date, waistCm: Number(waistCm) || 0, chestCm: Number(chestCm) || 0, hipCm: Number(hipCm) || 0,
      bicepCm: Number(bicepCm) || 0, thighCm: Number(thighCm) || 0, neckCm: Number(neckCm) || 0,
      forearmCm: Number(forearmCm) || 0, bodyFat: Number(bodyFat) || 0,
    };
    onSave(e);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="📏 Добавить замеры тела">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        {[
          { label: 'Талия (см)', val: waistCm, set: setWaistCm },
          { label: 'Грудь (см)', val: chestCm, set: setChestCm },
          { label: 'Бёдра (см)', val: hipCm, set: setHipCm },
          { label: 'Бицепс (см)', val: bicepCm, set: setBicepCm },
          { label: 'Бедро (см)', val: thighCm, set: setThighCm },
          { label: 'Шея (см)', val: neckCm, set: setNeckCm },
          { label: 'Предплечье (см)', val: forearmCm, set: setForearmCm },
          { label: '% жира', val: bodyFat, set: setBodyFat },
        ].map(f => (
          <div key={f.label}>
            <label style={fieldLabel}>{f.label}</label>
            <input type="number" step="0.5" min="0" value={f.val} onChange={e => f.set(e.target.value)} style={fieldInput} placeholder="—" />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.blue)}>Сохранить</button>
      </div>
    </Modal>
  );
};

const AddInjectionModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: InjectionEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [substance, setSubstance] = useState('');
  const [dose, setDose] = useState('');
  const [site, setSite] = useState('Дельта');
  const [notes, setNotes] = useState('');
  const submit = () => {
    if (!date || !substance || !dose) return;
    onSave({ date, substance, dose, site, notes });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="💉 Добавить запись инъекции">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Препарат</label>
      <input type="text" value={substance} onChange={e => setSubstance(e.target.value)} style={fieldInput} placeholder="Тест энантат 250 мг" />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Доза</label>
      <input type="text" value={dose} onChange={e => setDose(e.target.value)} style={fieldInput} placeholder="0.5 мл в дельту" />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Место инъекции</label>
      <input type="text" value={site} onChange={e => setSite(e.target.value)} style={fieldInput} placeholder="Дельта" />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.warning)}>Сохранить</button>
      </div>
    </Modal>
  );
};

const SYMPTOM_PRESETS = [
  'Головная боль', 'Тошнота', 'Бессонница', 'Боль в суставах', 'Отёки',
  'Сыпь', 'Акне', 'Потливость', 'Раздражительность', 'Снижение либидо',
  'Сердцебиение', 'Головокружение', 'Слабость', 'Боль в пояснице', 'Судороги',
];

const AddSymptomModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: SymptomEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const submit = () => {
    if (!date || !name.trim()) return;
    onSave({ date, name: name.trim(), severity, duration: duration.trim() || undefined, notes: notes.trim() || undefined });
    setName(''); setSeverity(2); setDuration(''); setNotes('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="🩺 Добавить симптом">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Симптом</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} style={fieldInput} placeholder="Например: головная боль" list="he-symptom-presets" />
      <datalist id="he-symptom-presets">{SYMPTOM_PRESETS.map(s => <option key={s} value={s} />)}</datalist>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Сила (1-5)</label>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => setSeverity(n as 1 | 2 | 3 | 4 | 5)} style={{
            flex: 1, minHeight: 36, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            border: `1px solid ${severity === n ? colors.danger : colors.border}`,
            background: severity === n ? `${colors.danger}26` : 'rgba(255,255,255,0.03)',
            color: severity === n ? colors.danger : colors.text,
          }}>{n}</button>
        ))}
      </div>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Длительность (необязательно)</label>
      <input type="text" value={duration} onChange={e => setDuration(e.target.value)} style={fieldInput} placeholder="Например: 2 часа, всю ночь" />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} placeholder="Сопутствующие факторы, триггеры..." />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.danger)}>Сохранить</button>
      </div>
    </Modal>
  );
};

const painZoneColor = (v: number) => v <= 2 ? '#22c55e' : v <= 4 ? '#f59e0b' : v <= 7 ? '#f97316' : '#ef4444';

const AddPainModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: PainEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [zones, setZones] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const total = Object.values(zones).reduce((s, v) => s + (v || 0), 0);
  const submit = () => {
    if (!date) return;
    onSave({ date, zones, totalScore: total, notes: notes.trim() || undefined });
    setZones({}); setNotes('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="🦴 Оценить боль в суставах">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 6, marginBottom: 8 }}>
        Визуально-аналоговая шкала (0–10). При боли ≥6/10 не тренируйте эту зону.
      </div>
      {PAIN_ZONES.map(z => {
        const v = zones[z.id] || 0;
        const c = painZoneColor(v);
        return (
          <div key={z.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>{z.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{v}/10</span>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} type="button" onClick={() => setZones(p => ({ ...p, [z.id]: n }))} style={{
                  flex: 1, minHeight: 28, padding: 0, borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  border: `1px solid ${n === v ? c : colors.border}`,
                  background: n === v ? `${c}33` : 'rgba(255,255,255,0.03)',
                  color: n === v ? c : colors.textMuted,
                }}>{n}</button>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginTop: 8, fontSize: 11, color: colors.text, fontWeight: 700 }}>
        Суммарно по всем зонам: <span style={{ color: painZoneColor(Math.round(total / PAIN_ZONES.length)) }}>{total}/70</span>
      </div>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} placeholder="Триггер, длительность, облегчение..." />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary('#22c55e')}>Сохранить</button>
      </div>
    </Modal>
  );
};

const AddNeuroModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: NeuroEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const total = Object.values(symptoms).filter(Boolean).length;
  const submit = () => {
    if (!date) return;
    onSave({ date, symptoms, totalScore: total, notes: notes.trim() || undefined });
    setSymptoms({}); setNotes('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="🧠 Нейросимптомы (еженедельный чек-лист)">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 6, marginBottom: 8 }}>
        Отметьте симптомы, которые наблюдались за неделю. При ≥4/10 — обратиться к неврологу.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {NEURO_SYMPTOMS.map(s => {
          const on = !!symptoms[s.id];
          return (
            <button key={s.id} type="button" onClick={() => setSymptoms(p => ({ ...p, [s.id]: !on }))} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${on ? colors.danger : colors.border}`,
              background: on ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
              color: on ? colors.danger : colors.text, fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? colors.danger : 'rgba(255,255,255,0.08)', color: on ? '#fff' : colors.textMuted, fontSize: 10, fontWeight: 800 }}>{on ? '✓' : ''}</span>
              {s.label}
            </button>
          );
        })}
      </div>
      <div style={{ padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginTop: 8, fontSize: 11, color: colors.text, fontWeight: 700 }}>
        Симптомов отмечено: <span style={{ color: total >= 4 ? colors.danger : total >= 2 ? colors.warning : colors.primary }}>{total}/10</span>
      </div>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} placeholder="Связь с курсом, триггеры, длительность..." />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.danger)}>Сохранить</button>
      </div>
    </Modal>
  );
};

const acneAreaColor = (v: number) => v === 0 ? '#22c55e' : v === 1 ? '#f59e0b' : v === 2 ? '#f97316' : '#ef4444';

const AddAcneModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: AcneEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [areas, setAreas] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const total = Object.values(areas).reduce((s, v) => s + (v || 0), 0);
  const submit = () => {
    if (!date) return;
    onSave({ date, areas, totalScore: total, notes: notes.trim() || undefined });
    setAreas({}); setNotes('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="🔴 Обострения акне (еженедельный трекинг)">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 6, marginBottom: 8 }}>
        Оцените каждую зону: 0 — чисто, 1 — единичные, 2 — умеренно, 3 — тяжёлое обострение.
      </div>
      {ACNE_AREAS.map(a => {
        const v = areas[a.id] || 0;
        const c = acneAreaColor(v);
        return (
          <div key={a.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>{a.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{v}/3</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3].map(n => (
                <button key={n} type="button" onClick={() => setAreas(p => ({ ...p, [a.id]: n }))} style={{
                  flex: 1, minHeight: 32, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  border: `1px solid ${n === v ? c : colors.border}`,
                  background: n === v ? `${c}33` : 'rgba(255,255,255,0.03)',
                  color: n === v ? c : colors.textMuted,
                }}>{n === 0 ? 'Чисто' : n === 1 ? 'Единичные' : n === 2 ? 'Умеренно' : 'Тяжёлое'}</button>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginTop: 8, fontSize: 11, color: colors.text, fontWeight: 700 }}>
        Суммарно: <span style={{ color: total >= 7 ? colors.danger : total >= 4 ? colors.warning : colors.primary }}>{total}/12</span>
      </div>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} placeholder="Связь с препаратом, диета, гигиена..." />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary('#f97316')}>Сохранить</button>
      </div>
    </Modal>
  );
};

const AddHematoModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: HematoEntry) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const total = Object.values(symptoms).filter(Boolean).length;
  const submit = () => {
    if (!date) return;
    onSave({ date, symptoms, totalScore: total, notes: notes.trim() || undefined });
    setSymptoms({}); setNotes('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="🩸 Гематологические симптомы">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 6, marginBottom: 8 }}>
        Отметьте симптомы. При ≥2/8 — срочно сдать ОАК + гематокрит.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {HEMATO_SYMPTOMS.map(s => {
          const on = !!symptoms[s.id];
          return (
            <button key={s.id} type="button" onClick={() => setSymptoms(p => ({ ...p, [s.id]: !on }))} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${on ? colors.danger : colors.border}`,
              background: on ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
              color: on ? colors.danger : colors.text, fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? colors.danger : 'rgba(255,255,255,0.08)', color: on ? '#fff' : colors.textMuted, fontSize: 10, fontWeight: 800 }}>{on ? '✓' : ''}</span>
              {s.label}
            </button>
          );
        })}
      </div>
      <div style={{ padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginTop: 8, fontSize: 11, color: colors.text, fontWeight: 700 }}>
        Симптомов отмечено: <span style={{ color: total >= 2 ? colors.danger : colors.primary }}>{total}/8</span>
      </div>
      <label style={{ ...fieldLabel, marginTop: 10 }}>Заметка (необязательно)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={200}
        style={{ ...fieldInput, resize: 'vertical' }} placeholder="Связь с курсом, давление, принимаемые препараты..." />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.blue)}>Сохранить</button>
      </div>
    </Modal>
  );
};

/* ── Карточка дневника ── */

const DIARY_META: Record<DiaryKey, { title: string; unit: string; icon: string; color: string; storageKey?: string }> = {
  sleep: { title: 'Сон', unit: 'ч', icon: '💤', color: '#a78bfa', storageKey: SLEEP_DIARY_KEY },
  bp: { title: 'Давление', unit: 'мм рт.ст.', icon: '❤️', color: '#ef4444', storageKey: BP_DIARY_KEY },
  weight: { title: 'Вес', unit: 'кг', icon: '⚖️', color: '#22c55e' },
  measurements: { title: 'Замеры тела', unit: 'см', icon: '📏', color: '#3b82f6' },
  injection: { title: 'Инъекции', unit: '', icon: '💉', color: '#f59e0b', storageKey: INJECTION_DIARY_KEY },
  symptoms: { title: 'Симптомы', unit: '', icon: '🩺', color: '#ec4899', storageKey: SYMPTOMS_DIARY_KEY },
  pain: { title: 'Боль в суставах (VAS)', unit: 'балл', icon: '🦴', color: '#22c55e', storageKey: PAIN_DIARY_KEY },
  neuro: { title: 'Нейросимптомы', unit: 'балл', icon: '🧠', color: '#ef4444', storageKey: NEURO_DIARY_KEY },
  acne: { title: 'Обострения акне', unit: 'балл', icon: '🔴', color: '#f97316', storageKey: ACNE_DIARY_KEY },
  hemato: { title: 'Гематологические симптомы', unit: 'балл', icon: '🩸', color: '#3b82f6', storageKey: HEMATO_DIARY_KEY },
};

const PAIN_ZONES = [
  { id: 'shoulders', label: '🦵 Плечи' },
  { id: 'elbows', label: '💪 Локти' },
  { id: 'wrists', label: '✋ Запястья' },
  { id: 'lower_back', label: '🔙 Поясница' },
  { id: 'hips', label: '🦵 ТБС' },
  { id: 'knees', label: '🦵 Колени' },
  { id: 'ankles', label: '🦶 Голеностоп' },
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
  { id: 'sweating', label: 'Потливость' },
];

const ACNE_AREAS = [
  { id: 'face', label: '🧑 Лицо' },
  { id: 'chest', label: '🫁 Грудь' },
  { id: 'back', label: '🔙 Спина' },
  { id: 'shoulders_acne', label: '💪 Плечи' },
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

const DIARY_FIELDS: Record<DiaryKey, { label: string; unit: string }[]> = {
  sleep: [
    { label: 'Часы', unit: 'ч' },
    { label: 'Качество', unit: '1–5' },
    { label: 'Пробуждений', unit: 'раз' },
    { label: 'Легли', unit: 'время' },
    { label: 'Подъём', unit: 'время' },
  ],
  bp: [
    { label: 'Систола', unit: 'мм рт.ст.' },
    { label: 'Диастола', unit: 'мм рт.ст.' },
    { label: 'Пульс', unit: 'уд/мин' },
  ],
  weight: [
    { label: 'Вес', unit: 'кг' },
    { label: 'Изменение', unit: 'кг' },
  ],
  measurements: [
    { label: 'Талия', unit: 'см' },
    { label: 'Грудь', unit: 'см' },
    { label: 'Бёдра', unit: 'см' },
    { label: 'Бицепс', unit: 'см' },
    { label: 'Бедро', unit: 'см' },
    { label: 'Шея', unit: 'см' },
    { label: 'Предплечье', unit: 'см' },
    { label: '% жира', unit: '%' },
  ],
  injection: [
    { label: 'Препарат', unit: '' },
    { label: 'Доза', unit: '' },
    { label: 'Место', unit: '' },
  ],
  symptoms: [
    { label: 'Симптом', unit: '' },
    { label: 'Сила', unit: '1–5' },
    { label: 'Длительность', unit: '' },
  ],
  pain: [
    { label: 'Зоны', unit: '0–10' },
    { label: 'Суммарно', unit: '/70' },
  ],
  neuro: [
    { label: 'Симптомы', unit: '' },
    { label: 'Итого', unit: '/10' },
  ],
  acne: [
    { label: 'Зоны', unit: '0–3' },
    { label: 'Суммарно', unit: '/12' },
  ],
  hemato: [
    { label: 'Симптомы', unit: '' },
    { label: 'Итого', unit: '/8' },
  ],
};

const DiaryCard: React.FC<{
  diaryKey: DiaryKey;
  count: number;
  last: string;
  daysSinceLast: number | null;
  loggedToday: boolean;
  onAdd: () => void;
  onOpen: () => void;
}> = ({ diaryKey, count, last, daysSinceLast, loggedToday, onAdd, onOpen }) => {
  const meta = DIARY_META[diaryKey];
  const stale = daysSinceLast !== null && daysSinceLast >= 3 && !loggedToday;
  const staleColor = daysSinceLast !== null && daysSinceLast >= 14 ? '#ef4444' : daysSinceLast !== null && daysSinceLast >= 7 ? '#f97316' : daysSinceLast !== null && daysSinceLast >= 3 ? '#f59e0b' : meta.color;
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={`Открыть дневник «${meta.title}»`}
      style={{
        background: stale ? `${staleColor}14` : 'rgba(28,28,32,0.75)',
        border: `1px solid ${stale ? `${staleColor}77` : `${meta.color}44`}`,
        borderRadius: 14, padding: '14px 12px',
        display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
        minHeight: 110,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-hidden="true"
          style={{
            width: 38, height: 38, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${meta.color}28`, border: `1px solid ${meta.color}55`,
            fontSize: 20, lineHeight: 1, flexShrink: 0,
          }}
        >{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.title}</div>
          <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 1 }}>{meta.unit || '—'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: meta.color,
            background: `${meta.color}22`, padding: '2px 7px', borderRadius: 5,
            border: `1px solid ${meta.color}33`,
          }}>{count}</span>
          {loggedToday && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.18)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>✓ сегодня</span>}
        </div>
      </div>
      <div style={{ fontSize: 10, color: colors.textMuted, minHeight: 14, lineHeight: 1.3 }}>
        {last ? (
          <>
            📅 {last}{meta.unit ? ' ' + meta.unit : ''}
            {daysSinceLast !== null && daysSinceLast > 0 && (
              <span style={{ marginLeft: 6, fontWeight: 700, color: staleColor }}>
                · {daysSinceLast === 1 ? 'вчера' : daysSinceLast < 5 ? `${daysSinceLast} дн. назад` : `${daysSinceLast} дней назад`}
              </span>
            )}
          </>
        ) : 'Нет записей'}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onAdd}
          aria-label={`Добавить запись в дневник ${meta.title}`}
          style={{
            flex: 1, minHeight: 30, padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
            background: `${meta.color}26`, color: meta.color, border: `1px solid ${meta.color}55`,
            cursor: 'pointer',
          }}
        >+ Добавить</button>
        <button
          onClick={onOpen}
          aria-label={`Открыть дневник ${meta.title}`}
          style={{
            flex: 1, minHeight: 30, padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
            background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`,
            cursor: 'pointer',
          }}
        >📋 Открыть</button>
      </div>
    </div>
  );
};

/* ── Быстрые ссылки на дневники в других блоках ── */

interface QuickLink { icon: string; label: string; target: string; color: string; desc?: string; }

interface UndoAction { label: string; undo: () => void; expiresAt: number; }
let undoTimer: ReturnType<typeof setTimeout> | null = null;

const Snackbar: React.FC<{ action: UndoAction | null; onDismiss: () => void }> = ({ action, onDismiss }) => {
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
        position: 'fixed', left: 12, right: 12, bottom: 80, zIndex: 1100,
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

const QUICK_DIARY_LINKS: QuickLink[] = [
  { icon: '🍽', label: 'Дневник питания', target: 'nutrition-diary', color: colors.green, desc: 'Питание: КБЖУ, приёмы, анализ рациона' },
  { icon: '🏋️', label: 'Журнал тренировок', target: 'workout-log', color: colors.blue, desc: 'Тренировочный дневник со снарядами' },
  { icon: '💊', label: 'Мой курс', target: 'pharma-course', color: colors.warning, desc: 'Текущий курс, фазы, дозировки' },
  { icon: '🛡', label: 'Дневник поддержки', target: 'support-diary', color: colors.purple, desc: 'Приём БАДов, протоколы, побочки' },
  { icon: '🧪', label: 'Анализы', target: 'labs-diary', color: colors.teal, desc: 'Результаты лабораторных исследований' },
];

const QUICK_REPORT_LINKS: QuickLink[] = [
  { icon: '🏋️', label: 'Тренер-отчёт', target: 'training-analytics', color: colors.blue, desc: 'Анализ тренировок, прогрессии' },
  { icon: '💊', label: 'Фарма-отчёт', target: 'pharma-reports', color: colors.warning, desc: 'Курс, фазы, перекрёстные риски' },
  { icon: '🩺', label: 'Врач-отчёт', target: 'labs-reports', color: colors.danger, desc: 'Анализы: отклонения, динамика' },
  { icon: '🍽', label: 'Отчёт по питанию', target: 'nutrition-reports', color: colors.green, desc: 'КБЖУ за день/неделю/месяц' },
  { icon: '🛡', label: 'Отчёт поддержки', target: 'support-reports', color: colors.purple, desc: 'Совместимость, побочки' },
  { icon: '⚠️', label: 'Отчёт по рискам', target: 'risk-reports', color: '#f97316', desc: 'Риск по системам органов' },
  { icon: '📊', label: 'Кастомный отчёт', target: 'custom-report', color: colors.orange, desc: 'Сводный отчёт по разделам' },
];

/* ── Главный компонент ── */

export const ProfileDiariesTab: React.FC<{ onNavigate?: (screen: string) => void; initialView?: 'diary' | 'reports' | 'archive'; initialActiveDiary?: DiaryKey }> = ({ onNavigate, initialView, initialActiveDiary }) => {
  const profile = useProfileRefresh();
  const pharmaPhase = (profile.settings as any)?.pharma?.phase as 'baseline' | 'course' | 'bridge' | 'pct' | 'post_pct' | 'fertility' | undefined;
  const courseStartDate = (profile.settings as any)?.pharma?.courseStartDate as string | undefined;
  const PHASE_LABELS: Record<string, { label: string; color: string }> = {
    baseline: { label: 'Базовая линия', color: '#6b7280' },
    course: { label: 'Курс', color: '#f59e0b' },
    bridge: { label: 'Мост', color: '#a78bfa' },
    pct: { label: 'ПКТ', color: '#8b5cf6' },
    post_pct: { label: 'После ПКТ', color: '#3b82f6' },
    fertility: { label: 'Фертильность', color: '#ec4899' },
  };
  const currentPhase = pharmaPhase ? PHASE_LABELS[pharmaPhase] : null;
  const courseWeek = (() => {
    if (pharmaPhase !== 'course' || !courseStartDate) return null;
    const start = new Date(courseStartDate);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    return Math.max(1, Math.floor(diffMs / (7 * 86400000)) + 1);
  })();
  const [view, setView] = useState<'diary' | 'reports' | 'archive'>(initialView || 'diary');
  const [activeDiary, setActiveDiary] = useState<DiaryKey | null>(initialActiveDiary || null);
  useEffect(() => { if (initialView) setView(initialView); }, [initialView]);
  useEffect(() => { if (initialActiveDiary) { setActiveDiary(initialActiveDiary); setView('diary'); } }, [initialActiveDiary]);
  useEffect(() => { if (view !== 'diary') setActiveDiary(null); }, [view]);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [bpEntries, setBpEntries] = useState<BPEntry[]>([]);
  const [injectionEntries, setInjectionEntries] = useState<InjectionEntry[]>([]);
  const [symptomEntries, setSymptomEntries] = useState<SymptomEntry[]>([]);
  const [painEntries, setPainEntries] = useState<PainEntry[]>([]);
  const [neuroEntries, setNeuroEntries] = useState<NeuroEntry[]>([]);
  const [acneEntries, setAcneEntries] = useState<AcneEntry[]>([]);
  const [hematoEntries, setHematoEntries] = useState<HematoEntry[]>([]);
  const [measurements, setMeasurements] = useState<ReturnType<typeof getMeasurementsLog>>([]);
  const [weights, setWeights] = useState<ReturnType<typeof getWeightLog>>([]);

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
  const [diaryRange, setDiaryRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  const pushUndo = (label: string, undo: () => void) => {
    setUndoAction({ label, undo, expiresAt: Date.now() + 5000 });
  };
  const dismissUndo = () => setUndoAction(null);

  interface DiaryGoals { sleepHours: number; weightKg: number; systolicTarget: number; }
  const GOALS_KEY = 'he_diary_goals';
  const [goals, setGoals] = useState<DiaryGoals>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(GOALS_KEY) || '{}');
      return {
        sleepHours: Number(raw.sleepHours) || 0,
        weightKg: Number(raw.weightKg) || 0,
        systolicTarget: Number(raw.systolicTarget) || 0,
      };
    } catch { return { sleepHours: 0, weightKg: 0, systolicTarget: 0 }; }
  });
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  const saveGoals = (next: DiaryGoals) => {
    setGoals(next);
    try { localStorage.setItem(GOALS_KEY, JSON.stringify(next)); } catch {}
  };

  const refresh = () => {
    try { setSleepEntries(loadDiary<SleepEntry>(SLEEP_DIARY_KEY)); } catch {}
    try { setBpEntries(loadDiary<BPEntry>(BP_DIARY_KEY)); } catch {}
    try { setInjectionEntries(loadDiary<InjectionEntry>(INJECTION_DIARY_KEY)); } catch {}
    try { setSymptomEntries(loadDiary<SymptomEntry>(SYMPTOMS_DIARY_KEY)); } catch {}
    try { setPainEntries(loadDiary<PainEntry>(PAIN_DIARY_KEY)); } catch {}
    try { setNeuroEntries(loadDiary<NeuroEntry>(NEURO_DIARY_KEY)); } catch {}
    try { setAcneEntries(loadDiary<AcneEntry>(ACNE_DIARY_KEY)); } catch {}
    try { setHematoEntries(loadDiary<HematoEntry>(HEMATO_DIARY_KEY)); } catch {}
    try { setMeasurements(getMeasurementsLog()); } catch {}
    try { setWeights(getWeightLog()); } catch {}
  };

  useEffect(() => { refresh(); }, []);

  const lastDate = (arr: { date: string }[]): string => {
    if (arr.length === 0) return '';
    return arr[arr.length - 1].date;
  };

  const getEntryArray = (key: DiaryKey): { date: string }[] => {
    if (key === 'sleep') return sleepEntries;
    if (key === 'bp') return bpEntries;
    if (key === 'weight') return weights;
    if (key === 'measurements') return measurements as any;
    if (key === 'injection') return injectionEntries;
    if (key === 'symptoms') return symptomEntries;
    if (key === 'pain') return painEntries;
    if (key === 'neuro') return neuroEntries;
    if (key === 'acne') return acneEntries;
    if (key === 'hemato') return hematoEntries;
    return [];
  };

  const daysSinceLast = (arr: { date: string }[]): number | null => {
    if (arr.length === 0) return null;
    const last = new Date(arr[arr.length - 1].date);
    if (isNaN(last.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - last.getTime()) / 86400000);
  };

  const todayEntry = (arr: { date: string }[]): boolean => {
    if (arr.length === 0) return false;
    return arr[arr.length - 1].date === todayIso();
  };

  const buildTodayOverview = () => {
    const today = todayIso();
    const overview: { label: string; value: string; color: string }[] = [];
    if (sleepEntries.length) {
      const e = sleepEntries[sleepEntries.length - 1];
      if (e.date === today) overview.push({ label: 'Сон', value: `${e.hours} ч`, color: '#a78bfa' });
    }
    if (bpEntries.length) {
      const e = bpEntries[bpEntries.length - 1];
      if (e.date === today) overview.push({ label: 'АД', value: `${e.systolic}/${e.diastolic}`, color: '#ef4444' });
    }
    if (weights.length) {
      const e = weights[weights.length - 1];
      if (e.date === today) overview.push({ label: 'Вес', value: `${e.weight} кг`, color: '#22c55e' });
    }
    if (painEntries.length) {
      const e = painEntries[painEntries.length - 1];
      if (e.date === today) overview.push({ label: 'Суставы Σ', value: `${e.totalScore}/70`, color: e.totalScore < 20 ? '#22c55e' : e.totalScore < 40 ? '#f59e0b' : '#ef4444' });
    }
    if (neuroEntries.length) {
      const e = neuroEntries[neuroEntries.length - 1];
      if (e.date === today) overview.push({ label: 'Нейро', value: `${e.totalScore}/10`, color: e.totalScore >= 4 ? '#ef4444' : e.totalScore >= 2 ? '#f59e0b' : '#22c55e' });
    }
    if (acneEntries.length) {
      const e = acneEntries[acneEntries.length - 1];
      if (e.date === today) overview.push({ label: 'Акне Σ', value: `${e.totalScore}/12`, color: e.totalScore >= 7 ? '#ef4444' : e.totalScore >= 4 ? '#f59e0b' : '#22c55e' });
    }
    if (hematoEntries.length) {
      const e = hematoEntries[hematoEntries.length - 1];
      if (e.date === today) overview.push({ label: 'Гемат', value: `${e.totalScore}/8`, color: e.totalScore >= 2 ? '#ef4444' : '#22c55e' });
    }
    return overview;
  };
  const todayOverview = buildTodayOverview();

  const builtInDiaries: BuiltInDiaryRow[] = [
    { key: 'sleep', count: sleepEntries.length, last: lastDate(sleepEntries) },
    { key: 'bp', count: bpEntries.length, last: bpEntries.length ? `${bpEntries[bpEntries.length - 1].systolic}/${bpEntries[bpEntries.length - 1].diastolic}` : '' },
    { key: 'weight', count: weights.length, last: lastDate(weights) },
    { key: 'measurements', count: measurements.length, last: lastDate(measurements) },
    { key: 'injection', count: injectionEntries.length, last: lastDate(injectionEntries) },
    { key: 'symptoms', count: symptomEntries.length, last: symptomEntries.length ? symptomEntries[symptomEntries.length - 1].name : '' },
    { key: 'pain', count: painEntries.length, last: painEntries.length ? `Σ ${painEntries[painEntries.length - 1].totalScore}/70` : '' },
    { key: 'neuro', count: neuroEntries.length, last: neuroEntries.length ? `${neuroEntries[neuroEntries.length - 1].totalScore}/10` : '' },
    { key: 'acne', count: acneEntries.length, last: acneEntries.length ? `Σ ${acneEntries[acneEntries.length - 1].totalScore}/12` : '' },
    { key: 'hemato', count: hematoEntries.length, last: hematoEntries.length ? `${hematoEntries[hematoEntries.length - 1].totalScore}/8` : '' },
  ];

  const getEntries = (key: DiaryKey): { date: string; fields: { label: string; value: string; unit: string }[] }[] => {
    if (key === 'sleep') return [...sleepEntries].reverse().map(e => ({
      date: e.date, fields: [
        { label: 'Часы', value: String(e.hours), unit: 'ч' },
        { label: 'Качество', value: String(e.quality), unit: '1–5' },
        { label: 'Пробуждений', value: String(e.awakenings ?? 0), unit: 'раз' },
        { label: 'Легли', value: e.bedtime || '—', unit: '' },
        { label: 'Подъём', value: e.wakeTime || '—', unit: '' },
        ...(e.notes ? [{ label: 'Заметка', value: e.notes, unit: '' }] : []),
      ],
    }));
    if (key === 'bp') return [...bpEntries].reverse().map(e => ({
      date: e.date, fields: [
        { label: 'Систола', value: String(e.systolic), unit: 'мм рт.ст.' },
        { label: 'Диастола', value: String(e.diastolic), unit: 'мм рт.ст.' },
        { label: 'Пульс', value: String(e.pulse), unit: 'уд/мин' },
        ...(e.notes ? [{ label: 'Заметка', value: e.notes, unit: '' }] : []),
      ],
    }));
    if (key === 'weight') return [...weights].reverse().map((w, idx, arr) => {
      const prev = arr[idx + 1];
      const delta = prev ? (w.weight - prev.weight) : 0;
      return {
        date: w.date, fields: [
          { label: 'Вес', value: String(w.weight), unit: 'кг' },
          { label: 'Изменение', value: (delta > 0 ? '+' : '') + delta.toFixed(1), unit: 'кг' },
        ],
      };
    });
    if (key === 'measurements') return [...measurements].reverse().map(m => ({
      date: m.date, fields: DIARY_FIELDS.measurements
        .filter(f => f.label !== '% жира' || (m as any).bodyFat)
        .map(f => ({
          label: f.label,
          value: (() => {
            switch (f.label) {
              case 'Талия': return String((m as any).waistCm || 0);
              case 'Грудь': return String((m as any).chestCm || 0);
              case 'Бёдра': return String((m as any).hipCm || 0);
              case 'Бицепс': return String((m as any).bicepCm || 0);
              case 'Бедро': return String((m as any).thighCm || 0);
              case 'Шея': return String((m as any).neckCm || 0);
              case 'Предплечье': return String((m as any).forearmCm || 0);
              case '% жира': return String((m as any).bodyFat || 0);
              default: return '0';
            }
          })(),
          unit: f.unit,
        })),
    }));
    if (key === 'injection') return [...injectionEntries].reverse().map(e => ({
      date: e.date, fields: [
        { label: 'Препарат', value: e.substance || '—', unit: '' },
        { label: 'Доза', value: e.dose || '—', unit: '' },
        { label: 'Место', value: e.site || '—', unit: '' },
        ...(e.notes ? [{ label: 'Заметка', value: e.notes, unit: '' }] : []),
      ],
    }));
    if (key === 'symptoms') return [...symptomEntries].reverse().map(e => ({
      date: e.date, fields: [
        { label: 'Симптом', value: e.name, unit: '' },
        { label: 'Сила', value: '★'.repeat(e.severity) + '☆'.repeat(5 - e.severity), unit: `${e.severity}/5` },
        ...(e.duration ? [{ label: 'Длительность', value: e.duration, unit: '' }] : []),
        ...(e.notes ? [{ label: 'Заметка', value: e.notes, unit: '' }] : []),
      ],
    }));
    if (key === 'pain') return [...painEntries].reverse().map(e => {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(e.zones).forEach(([zoneId, val]) => {
        const z = PAIN_ZONES.find(p => p.id === zoneId);
        if (z && val > 0) fields.push({ label: z.label.replace(/^[^\s]+\s/, ''), value: String(val), unit: '/10' });
      });
      fields.push({ label: 'Суммарно', value: String(e.totalScore), unit: '/70' });
      if (e.notes) fields.push({ label: 'Заметка', value: e.notes, unit: '' });
      return { date: e.date, fields };
    });
    if (key === 'neuro') return [...neuroEntries].reverse().map(e => {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(e.symptoms).filter(([, v]) => v).forEach(([symId]) => {
        const s = NEURO_SYMPTOMS.find(n => n.id === symId);
        if (s) fields.push({ label: s.label, value: 'есть', unit: '' });
      });
      fields.push({ label: 'Симптомов', value: String(e.totalScore), unit: '/10' });
      if (e.notes) fields.push({ label: 'Заметка', value: e.notes, unit: '' });
      return { date: e.date, fields };
    });
    if (key === 'acne') return [...acneEntries].reverse().map(e => {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(e.areas).forEach(([areaId, val]) => {
        const a = ACNE_AREAS.find(x => x.id === areaId);
        if (a && val > 0) fields.push({ label: a.label.replace(/^[^\s]+\s/, ''), value: String(val), unit: '/3' });
      });
      fields.push({ label: 'Суммарно', value: String(e.totalScore), unit: '/12' });
      if (e.notes) fields.push({ label: 'Заметка', value: e.notes, unit: '' });
      return { date: e.date, fields };
    });
    if (key === 'hemato') return [...hematoEntries].reverse().map(e => {
      const fields: { label: string; value: string; unit: string }[] = [];
      Object.entries(e.symptoms).filter(([, v]) => v).forEach(([symId]) => {
        const s = HEMATO_SYMPTOMS.find(h => h.id === symId);
        if (s) fields.push({ label: s.label, value: 'есть', unit: '' });
      });
      fields.push({ label: 'Симптомов', value: String(e.totalScore), unit: '/8' });
      if (e.notes) fields.push({ label: 'Заметка', value: e.notes, unit: '' });
      return { date: e.date, fields };
    });
    return [];
  };

  const activeEntriesRaw = activeDiary ? getEntries(activeDiary) : [];
  const activeEntries = diaryRange === 'all' ? activeEntriesRaw : activeEntriesRaw.filter(e => {
    const d = Date.parse(e.date);
    if (Number.isNaN(d)) return true;
    return d >= Date.now() - Number(diaryRange) * 86400000;
  });

  const deleteDiaryEntry = (key: DiaryKey, date: string) => {
    const findList = (): { list: any[]; setter: (v: any[]) => void; save: (v: any[]) => void; keyName: string } | null => {
      if (key === 'sleep') return { list: sleepEntries, setter: setSleepEntries, save: v => saveDiary(SLEEP_DIARY_KEY, v), keyName: SLEEP_DIARY_KEY };
      if (key === 'bp') return { list: bpEntries, setter: setBpEntries, save: v => saveDiary(BP_DIARY_KEY, v), keyName: BP_DIARY_KEY };
      if (key === 'injection') return { list: injectionEntries, setter: setInjectionEntries, save: v => saveDiary(INJECTION_DIARY_KEY, v), keyName: INJECTION_DIARY_KEY };
      if (key === 'symptoms') return { list: symptomEntries, setter: setSymptomEntries, save: v => saveDiary(SYMPTOMS_DIARY_KEY, v), keyName: SYMPTOMS_DIARY_KEY };
      if (key === 'pain') return { list: painEntries, setter: setPainEntries, save: v => saveDiary(PAIN_DIARY_KEY, v), keyName: PAIN_DIARY_KEY };
      if (key === 'neuro') return { list: neuroEntries, setter: setNeuroEntries, save: v => saveDiary(NEURO_DIARY_KEY, v), keyName: NEURO_DIARY_KEY };
      if (key === 'acne') return { list: acneEntries, setter: setAcneEntries, save: v => saveDiary(ACNE_DIARY_KEY, v), keyName: ACNE_DIARY_KEY };
      if (key === 'hemato') return { list: hematoEntries, setter: setHematoEntries, save: v => saveDiary(HEMATO_DIARY_KEY, v), keyName: HEMATO_DIARY_KEY };
      return null;
    };
    const ctx = findList();
    if (!ctx) return;
    const removed = ctx.list.find(x => x.date === date);
    if (!removed) return;
    const updated = ctx.list.filter(x => x.date !== date);
    ctx.setter(updated);
    ctx.save(updated);
    const dateLabel = new Date(date).toLocaleDateString('ru-RU');
    pushUndo(`Запись от ${dateLabel} удалена`, () => {
      const restored = [...updated, removed].sort((a, b) => a.date.localeCompare(b.date));
      ctx.setter(restored);
      ctx.save(restored);
    });
  };

  const exportDiaryCSV = (key: DiaryKey, entries: typeof activeEntries) => {
    if (entries.length === 0) return;
    const meta = DIARY_META[key];
    const rows: string[] = [];
    const allLabels = new Set<string>();
    entries.forEach(e => e.fields.forEach(f => allLabels.add(f.label)));
    const labels = Array.from(allLabels);
    rows.push(['Дата', ...labels].join(','));
    entries.forEach(e => {
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
    a.download = `${key}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast(`📤 Экспортировано ${entries.length} записей: ${meta.title}`);
    }
  };

  const clearActiveDiary = () => {
    if (!activeDiary) return;
    if (!confirm(`Удалить ВСЕ записи дневника «${DIARY_META[activeDiary].title}»?`)) return;
    const snapshot = getEntryArray(activeDiary).map(x => ({ ...x }));
    const doClear = () => {
      if (activeDiary === 'sleep') { saveDiary(SLEEP_DIARY_KEY, []); setSleepEntries([]); }
      else if (activeDiary === 'bp') { saveDiary(BP_DIARY_KEY, []); setBpEntries([]); }
      else if (activeDiary === 'injection') { saveDiary(INJECTION_DIARY_KEY, []); setInjectionEntries([]); }
      else if (activeDiary === 'symptoms') { saveDiary(SYMPTOMS_DIARY_KEY, []); setSymptomEntries([]); }
      else if (activeDiary === 'pain') { saveDiary(PAIN_DIARY_KEY, []); setPainEntries([]); }
      else if (activeDiary === 'neuro') { saveDiary(NEURO_DIARY_KEY, []); setNeuroEntries([]); }
      else if (activeDiary === 'acne') { saveDiary(ACNE_DIARY_KEY, []); setAcneEntries([]); }
      else if (activeDiary === 'hemato') { saveDiary(HEMATO_DIARY_KEY, []); setHematoEntries([]); }
    };
    doClear();
    const keyName = DIARY_META[activeDiary].storageKey;
    pushUndo(`🧹 Дневник «${DIARY_META[activeDiary].title}» очищен (${snapshot.length})`, () => {
      if (keyName) saveDiary(keyName, snapshot);
      if (activeDiary === 'sleep') setSleepEntries(snapshot as SleepEntry[]);
      else if (activeDiary === 'bp') setBpEntries(snapshot as BPEntry[]);
      else if (activeDiary === 'injection') setInjectionEntries(snapshot as InjectionEntry[]);
      else if (activeDiary === 'symptoms') setSymptomEntries(snapshot as SymptomEntry[]);
      else if (activeDiary === 'pain') setPainEntries(snapshot as PainEntry[]);
      else if (activeDiary === 'neuro') setNeuroEntries(snapshot as NeuroEntry[]);
      else if (activeDiary === 'acne') setAcneEntries(snapshot as AcneEntry[]);
      else if (activeDiary === 'hemato') setHematoEntries(snapshot as HematoEntry[]);
    });
  };

  const exportAllDiaries = () => {
    const payload: Record<string, any> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      goals,
      diaries: {
        [SLEEP_DIARY_KEY]: sleepEntries,
        [BP_DIARY_KEY]: bpEntries,
        [INJECTION_DIARY_KEY]: injectionEntries,
        [SYMPTOMS_DIARY_KEY]: symptomEntries,
        [PAIN_DIARY_KEY]: painEntries,
        [NEURO_DIARY_KEY]: neuroEntries,
        [ACNE_DIARY_KEY]: acneEntries,
        [HEMATO_DIARY_KEY]: hematoEntries,
      },
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diaries-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    if ((window as any).showToast) (window as any).showToast('📦 Все дневники экспортированы в JSON');
  };

  const importAllDiaries = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        const diaries = data.diaries || {};
        if (diaries[SLEEP_DIARY_KEY] && Array.isArray(diaries[SLEEP_DIARY_KEY])) { saveDiary(SLEEP_DIARY_KEY, diaries[SLEEP_DIARY_KEY]); setSleepEntries(diaries[SLEEP_DIARY_KEY]); }
        if (diaries[BP_DIARY_KEY] && Array.isArray(diaries[BP_DIARY_KEY])) { saveDiary(BP_DIARY_KEY, diaries[BP_DIARY_KEY]); setBpEntries(diaries[BP_DIARY_KEY]); }
        if (diaries[INJECTION_DIARY_KEY] && Array.isArray(diaries[INJECTION_DIARY_KEY])) { saveDiary(INJECTION_DIARY_KEY, diaries[INJECTION_DIARY_KEY]); setInjectionEntries(diaries[INJECTION_DIARY_KEY]); }
        if (diaries[SYMPTOMS_DIARY_KEY] && Array.isArray(diaries[SYMPTOMS_DIARY_KEY])) { saveDiary(SYMPTOMS_DIARY_KEY, diaries[SYMPTOMS_DIARY_KEY]); setSymptomEntries(diaries[SYMPTOMS_DIARY_KEY]); }
        if (diaries[PAIN_DIARY_KEY] && Array.isArray(diaries[PAIN_DIARY_KEY])) { saveDiary(PAIN_DIARY_KEY, diaries[PAIN_DIARY_KEY]); setPainEntries(diaries[PAIN_DIARY_KEY]); }
        if (diaries[NEURO_DIARY_KEY] && Array.isArray(diaries[NEURO_DIARY_KEY])) { saveDiary(NEURO_DIARY_KEY, diaries[NEURO_DIARY_KEY]); setNeuroEntries(diaries[NEURO_DIARY_KEY]); }
        if (diaries[ACNE_DIARY_KEY] && Array.isArray(diaries[ACNE_DIARY_KEY])) { saveDiary(ACNE_DIARY_KEY, diaries[ACNE_DIARY_KEY]); setAcneEntries(diaries[ACNE_DIARY_KEY]); }
        if (diaries[HEMATO_DIARY_KEY] && Array.isArray(diaries[HEMATO_DIARY_KEY])) { saveDiary(HEMATO_DIARY_KEY, diaries[HEMATO_DIARY_KEY]); setHematoEntries(diaries[HEMATO_DIARY_KEY]); }
        if (data.goals && typeof data.goals === 'object') { setGoals({ ...goals, ...data.goals }); localStorage.setItem(GOALS_KEY, JSON.stringify({ ...goals, ...data.goals })); }
        if ((window as any).showToast) (window as any).showToast('📥 Дневники импортированы');
      } catch (e) {
        if ((window as any).showToast) (window as any).showToast('❌ Ошибка импорта: ' + (e instanceof Error ? e.message : 'неверный формат'));
      }
    };
    reader.readAsText(file);
  };

  const printActiveDiary = () => {
    if (!activeDiary) return;
    const meta = DIARY_META[activeDiary];
    const allLabels = Array.from(new Set(activeEntriesRaw.flatMap(e => e.fields.map(f => f.label))));
    const summary = computeSummary(activeDiary, activeEntriesRaw);
    const summaryHtml = summary ? summary.map(s => `<div class="sum"><div class="muted">${s.label}</div><div class="v" style="color:${s.color}">${s.value}</div></div>`).join('') : '';
    const anomalies = detectAnomalies(activeDiary, activeEntriesRaw);
    const anomalyRows = anomalies.length === 0
      ? '<tr><td colspan="3" style="color:#22c55e">Аномалий не выявлено</td></tr>'
      : anomalies.map(a => `<tr><td>${new Date(a.date).toLocaleDateString('ru-RU')}</td><td style="color:${a.severity === 'danger' ? '#ef4444' : '#f59e0b'};font-weight:700">${a.severity === 'danger' ? '⚠️ ВЫСОКИЙ' : '⚠ ВНИМАНИЕ'}</td><td>${a.message}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${meta.title} — отчёт</title>
<style>
@page { size: A4; margin: 14mm; }
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#111;padding:18px;max-width:780px;margin:0 auto;}
h1{color:${meta.color};border-bottom:3px solid ${meta.color};padding-bottom:6px;margin:0 0 8px;font-size:22px;}
h2{color:#333;font-size:15px;margin:18px 0 6px;}
.meta{color:#666;font-size:11px;margin-bottom:14px;}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-bottom:14px;}
.sum{padding:8px;border:1px solid #ddd;border-radius:6px;background:#fafafa;}
.sum .muted{color:#777;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;}
.sum .v{font-size:18px;font-weight:800;margin-top:2px;}
table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px;}
th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #e5e5e5;}
th{background:#f3f3f3;color:#444;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;}
tr:nth-child(even){background:#fafafa;}
.muted{color:#999;font-size:10px;margin-top:14px;text-align:right;}
@media print{body{padding:0;}}
</style></head><body>
<h1>${meta.icon} ${meta.title}</h1>
<div class="meta">Отчёт сформирован: ${new Date().toLocaleString('ru-RU')} · Записей: ${activeEntriesRaw.length}${diaryRange !== 'all' ? ` (показано ${activeEntries.length} за период ${diaryRange} дней)` : ''}</div>
${summaryHtml ? `<h2>Сводка</h2><div class="summary">${summaryHtml}</div>` : ''}
<h2>Записи</h2>
<table><thead><tr><th>Дата</th>${allLabels.map(l => `<th>${l}</th>`).join('')}<th>Заметка</th></tr></thead><tbody>
${activeEntriesRaw.map(e => `<tr><td>${new Date(e.date).toLocaleDateString('ru-RU')}</td>${allLabels.map(l => {
      const f = e.fields.find(x => x.label === l);
      return `<td>${f ? f.value + (f.unit ? ' ' + f.unit : '') : '—'}</td>`;
    }).join('')}<td>${(e.fields.find(f => f.label === 'Заметка')?.value) || '—'}</td></tr>`).join('')}
</tbody></table>
<h2>Аномалии и предупреждения</h2>
<table><thead><tr><th>Дата</th><th>Уровень</th><th>Описание</th></tr></thead><tbody>${anomalyRows}</tbody></table>
<div class="muted">BodyBuildHealth · профильные дневники</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    } else {
      if ((window as any).showToast) (window as any).showToast('⚠ Не удалось открыть окно печати — разрешите всплывающие окна');
    }
  };

  const quickAddToday = () => {
    if (!activeDiary) return;
    const today = todayIso();
    const last = getEntryArray(activeDiary);
    if (last.length > 0 && last[last.length - 1].date === today) {
      if ((window as any).showToast) (window as any).showToast('ℹ️ Запись за сегодня уже есть');
      return;
    }
    if (activeDiary === 'sleep') {
      const e: SleepEntry = { date: today, hours: 7.5, quality: 4, awakenings: 1, bedtime: '23:00', wakeTime: '07:00' };
      const updated = [...sleepEntries, e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(SLEEP_DIARY_KEY, updated); setSleepEntries(updated);
    } else if (activeDiary === 'bp') {
      const e: BPEntry = { date: today, systolic: 120, diastolic: 80, pulse: 70 };
      const updated = [...bpEntries, e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(BP_DIARY_KEY, updated); setBpEntries(updated);
    } else if (activeDiary === 'symptoms') {
      const e: SymptomEntry = { date: today, name: 'Нет симптомов', severity: 1 };
      const updated = [...symptomEntries, e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(SYMPTOMS_DIARY_KEY, updated); setSymptomEntries(updated);
    } else if (activeDiary === 'pain') {
      const e: PainEntry = { date: today, zones: {}, totalScore: 0 };
      const updated = [...painEntries, e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(PAIN_DIARY_KEY, updated); setPainEntries(updated);
    } else if (activeDiary === 'neuro') {
      const e: NeuroEntry = { date: today, symptoms: {}, totalScore: 0 };
      const updated = [...neuroEntries, e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(NEURO_DIARY_KEY, updated); setNeuroEntries(updated);
    } else if (activeDiary === 'acne') {
      const e: AcneEntry = { date: today, areas: {}, totalScore: 0 };
      const updated = [...acneEntries, e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(ACNE_DIARY_KEY, updated); setAcneEntries(updated);
    } else if (activeDiary === 'hemato') {
      const e: HematoEntry = { date: today, symptoms: {}, totalScore: 0 };
      const updated = [...hematoEntries, e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(HEMATO_DIARY_KEY, updated); setHematoEntries(updated);
    } else if (activeDiary === 'injection') {
      const e: InjectionEntry = { date: today, substance: 'Курс', dose: '—', site: 'Дельта' };
      const updated = [...injectionEntries.filter(x => x.date !== today), e].sort((a, b) => a.date.localeCompare(b.date));
      saveDiary(INJECTION_DIARY_KEY, updated); setInjectionEntries(updated);
    } else {
      setAddWeightOpen(activeDiary === 'weight');
      setAddMeasurementsOpen(activeDiary === 'measurements');
      return;
    }
    if ((window as any).showToast) (window as any).showToast('⚡ Запись за сегодня добавлена (откройте для деталей)');
  };

  const targetHit = (
    key: DiaryKey,
    entries: { date: string; fields: { label: string; value: string; unit: string }[] }[],
    goals: DiaryGoals
  ): { onTarget: boolean; details: string } | null => {
    const last = entries[0];
    if (!last) return null;
    if (key === 'sleep' && goals.sleepHours > 0) {
      const hours = parseFloat(last.fields.find(x => x.label === 'Часы')?.value || 'NaN');
      if (!Number.isFinite(hours)) return null;
      const onTarget = hours >= goals.sleepHours;
      return { onTarget, details: `${hours.toFixed(1)} ч / цель ${goals.sleepHours} ч` };
    }
    if (key === 'weight' && goals.weightKg > 0) {
      const w = parseFloat(last.fields.find(x => x.label === 'Вес')?.value || 'NaN');
      if (!Number.isFinite(w)) return null;
      const diff = w - goals.weightKg;
      const onTarget = Math.abs(diff) <= 0.5;
      return { onTarget, details: `${w.toFixed(1)} кг / цель ${goals.weightKg} кг (Δ ${diff > 0 ? '+' : ''}${diff.toFixed(1)})` };
    }
    if (key === 'bp' && goals.systolicTarget > 0) {
      const sys = parseFloat(last.fields.find(x => x.label === 'Систола')?.value || 'NaN');
      if (!Number.isFinite(sys)) return null;
      return { onTarget: sys <= goals.systolicTarget, details: `${sys.toFixed(0)} / цель ≤ ${goals.systolicTarget}` };
    }
    return null;
  };

  const reportSources = [
    { current: 'he_training_report_current', label: '🏋️ Тренер-отчёт', target: 'training-analytics', archiveKeys: ['he_training_reports'], color: colors.blue, desc: 'Анализ силы, прогрессии, объёма, восстановления' },
    { current: 'he_nutrition_report_current', label: '🍽 Отчёт по питанию', target: 'nutrition-reports', archiveKeys: ['he_nutrition_report_archive'], color: colors.green, desc: 'КБЖУ за день/неделю/месяц, микронутриенты' },
    { current: 'he_labs_report_current', label: '🩺 Врач-отчёт', target: 'labs-reports', archiveKeys: ['he_lab_reports'], color: colors.danger, desc: 'Анализы: отклонения, динамика по фазам' },
    { current: 'he_support_reports', label: '🛡 Отчёт поддержки', target: 'support-reports', archiveKeys: ['he_support_reports_archive', 'he_support_reports'], color: colors.purple, desc: 'Стек, фазы, перекрёстные риски, совместимость' },
    { current: 'he_pharma_report_current', label: '💊 Фарма-отчёт', target: 'pharma-reports', archiveKeys: ['he_pharma_reports'], color: colors.warning, desc: 'Оценка курса: баланс, безопасность, длительность' },
    { current: 'he_risk_report_current', label: '⚠️ Отчёт по рискам', target: 'risk-reports', archiveKeys: ['he_risk_reports'], color: '#f97316', desc: 'Риск по системам органов, динамика' },
    { current: 'he_profile_reports', label: '📊 Кастомный отчёт', target: 'custom-report', archiveKeys: ['he_profile_reports'], color: colors.orange, desc: 'Сводный отчёт по разделам профиля' },
  ];
  const readReportEntries = (src: typeof reportSources[number]) => {
    const list: any[] = [];
    try {
      const current = localStorage.getItem(src.current);
      const parsed = current ? JSON.parse(current) : null;
      if (Array.isArray(parsed)) list.push(...parsed);
      else if (parsed) list.push(parsed);
    } catch {}
    for (const key of src.archiveKeys) {
      try {
        const arch = localStorage.getItem(key);
        const parsed = arch ? JSON.parse(arch) : null;
        if (Array.isArray(parsed)) list.push(...parsed);
        else if (parsed) list.push(parsed);
      } catch {}
    }
    return list;
  };

  const QuickLinkRow: React.FC<{ links: QuickLink[]; ariaLabel: string }> = ({ links, ariaLabel }) => (
    <div
      role="navigation"
      aria-label={ariaLabel}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}
    >
      {links.map(link => (
        <button
          key={link.target}
          onClick={() => onNavigate?.(link.target)}
          aria-label={`Открыть ${link.label}: ${link.desc || ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            borderRadius: 12, cursor: 'pointer', textAlign: 'left', minHeight: 56,
            background: `${link.color}14`, border: `1px solid ${link.color}55`,
            color: colors.text, transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
            position: 'relative',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)'; e.currentTarget.style.background = `${link.color}22`; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = `${link.color}14`; }}
        >
          <div aria-hidden="true" style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${link.color}33`, fontSize: 18, flexShrink: 0,
          }}>{link.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: link.color }}>{link.label}</div>
            {link.desc && <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2, lineHeight: 1.3 }}>{link.desc}</div>}
          </div>
          <span style={{ color: link.color, fontSize: 16, opacity: 0.7 }}>→</span>
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="Разделы дневников">
        {([
          ['diary', '📓 Дневники'], ['reports', '📊 Отчёты'], ['archive', '🗄 Архив отчётов'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)} role="tab" aria-selected={view === key}
            style={{ padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              border: `1px solid ${view === key ? colors.primary : colors.border}`,
              background: view === key ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.03)',
              color: view === key ? colors.primary : colors.textMuted }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'reports' && (
        <AccordionSection title="📊 Отчёты блоков" subtitle="Последние отчёты из модулей приложения" icon="📊" color={colors.teal} defaultOpen>
          <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reportSources.map(src => {
              const list = readReportEntries(src);
              const last = list[0];
              return (
                <button
                  key={src.target}
                  onClick={() => onNavigate?.(src.target)}
                  role="listitem"
                  aria-label={`Открыть ${src.label}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left', minHeight: 60,
                    background: `${src.color}10`, border: `1px solid ${src.color}44`,
                    color: colors.text, transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, background: `${src.color}26`, fontSize: 20,
                    }}
                  >{src.label.split(' ')[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: src.color }}>{src.label.replace(/^[^\s]+\s/, '')}</div>
                    <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{src.desc}</div>
                    <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 3, opacity: 0.8 }}>
                      {list.length === 0
                        ? 'Нет отчётов'
                        : `${list.length} ${list.length === 1 ? 'отчёт' : list.length < 5 ? 'отчёта' : 'отчётов'}${last?.date ? ` · последний ${new Date(last.date).toLocaleDateString('ru-RU')}` : ''}`}
                    </div>
                  </div>
                  <span style={{ color: src.color, fontSize: 18, opacity: 0.7 }}>→</span>
                </button>
              );
            })}
          </div>
        </AccordionSection>
      )}

      {view === 'archive' && (
        <AccordionSection title="🗄 Архив отчётов" subtitle="Сохранённые отчёты всех блоков" icon="🗄" color={colors.orange} defaultOpen>
          {reportSources.every(src => readReportEntries(src).length === 0) ? (
            <div style={{ color: colors.textMuted, fontSize: 12, padding: 12 }}>Архив отчётов пуст.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reportSources.flatMap(src => readReportEntries(src).map((rep: any, i: number) => ({ src, rep, key: `${src.target}-${i}` }))).map(({ src, rep, key }) => (
                <div key={key} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}` }}>
                  <div style={{ color: src.color, fontWeight: 700, fontSize: 12 }}>{src.label}</div>
                  <div style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>{rep.date ? new Date(rep.date).toLocaleString('ru-RU') : 'Архивный отчёт'}</div>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>
      )}

      {view !== 'diary' ? null : <>
      <AccordionSection
        title="📓 Встроенные дневники"
        subtitle="10 дневников: сон, давление, вес, замеры, инъекции, симптомы, боль, нейро, акне, гематология. Клик — раскрыть содержимое"
        icon="📓"
        color={colors.orange}
        defaultOpen
      >
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Поиск дневника…"
          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 10px', color: colors.text, fontSize: 12, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
          aria-label="Поиск дневника"
        />
        <div
          role="list"
          aria-label="Встроенные дневники"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}
        >
          {builtInDiaries
            .filter(d => !searchQuery.trim() || DIARY_META[d.key].title.toLowerCase().includes(searchQuery.toLowerCase()) || d.last.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(d => (
            <DiaryCard
              key={d.key}
              diaryKey={d.key}
              count={d.count}
              last={d.last}
              daysSinceLast={daysSinceLast(getEntryArray(d.key))}
              loggedToday={todayEntry(getEntryArray(d.key))}
              onAdd={() => {
                if (d.key === 'sleep') setAddSleepOpen(true);
                else if (d.key === 'bp') setAddBPOpen(true);
                else if (d.key === 'weight') setAddWeightOpen(true);
                else if (d.key === 'measurements') setAddMeasurementsOpen(true);
                else if (d.key === 'injection') setAddInjectionOpen(true);
                else if (d.key === 'symptoms') setAddSymptomOpen(true);
                else if (d.key === 'pain') setAddPainOpen(true);
                else if (d.key === 'neuro') setAddNeuroOpen(true);
                else if (d.key === 'acne') setAddAcneOpen(true);
                else if (d.key === 'hemato') setAddHematoOpen(true);
              }}
              onOpen={() => setActiveDiary(d.key)}
            />
          ))}
        </div>
        {searchQuery.trim() && builtInDiaries.filter(d => DIARY_META[d.key].title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
          <div style={{ color: colors.textMuted, fontSize: 12, padding: 12, textAlign: 'center' }}>
            Дневников по запросу «{searchQuery}» не найдено.
          </div>
        )}
      </AccordionSection>

      <AccordionSection
        title="🎯 Цели"
        subtitle="Целевые значения для отслеживания прогресса"
        icon="🎯"
        color={colors.primary}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {([
            { key: 'sleepHours', label: 'Сон (ч/день)', min: 4, max: 12, step: 0.5, color: '#a78bfa' },
            { key: 'weightKg', label: 'Вес (кг)', min: 30, max: 250, step: 0.1, color: '#22c55e' },
            { key: 'systolicTarget', label: 'АД сист. (≤ мм рт.ст.)', min: 80, max: 180, step: 1, color: '#ef4444' },
          ] as const).map(g => (
            <div key={g.key} style={{ padding: 8, borderRadius: 8, background: `${g.color}12`, border: `1px solid ${g.color}44` }}>
              <label style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>{g.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={g.min}
                  max={g.max}
                  step={g.step}
                  value={goals[g.key] || ''}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    saveGoals({ ...goals, [g.key]: Number.isFinite(v) ? v : 0 });
                  }}
                  style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 10px', color: g.color, fontSize: 16, fontWeight: 700, outline: 'none' }}
                />
                {goals[g.key] > 0 && (
                  <button
                    onClick={() => saveGoals({ ...goals, [g.key]: 0 })}
                    aria-label="Сбросить цель"
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: colors.textMuted, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  >✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 8, lineHeight: 1.4 }}>
          Укажите целевые значения, и в активном дневнике появится индикатор «в цели/вне цели» для последней записи.
        </div>
      </AccordionSection>

      <AccordionSection
        title="💾 Данные"
        subtitle="Импорт, экспорт и сброс всех дневников"
        icon="💾"
        color={colors.blue}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={exportAllDiaries}
            style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.4)', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}
          >📤 Экспорт всех дневников (JSON)</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importAllDiaries(f); e.target.value = ''; }}
            style={{ display: 'none' }}
            aria-label="Импорт файла"
          />
          <button
            onClick={() => importInputRef.current?.click()}
            style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}
          >📥 Импорт</button>
          <button
            onClick={() => {
              if (!confirm('Удалить ВСЕ записи ВСЕХ встроенных дневников?')) return;
              const snap = {
                [SLEEP_DIARY_KEY]: [...sleepEntries] as any[],
                [BP_DIARY_KEY]: [...bpEntries] as any[],
                [INJECTION_DIARY_KEY]: [...injectionEntries] as any[],
                [SYMPTOMS_DIARY_KEY]: [...symptomEntries] as any[],
                [PAIN_DIARY_KEY]: [...painEntries] as any[],
                [NEURO_DIARY_KEY]: [...neuroEntries] as any[],
                [ACNE_DIARY_KEY]: [...acneEntries] as any[],
                [HEMATO_DIARY_KEY]: [...hematoEntries] as any[],
              };
              const total = Object.values(snap).reduce((s, a) => s + a.length, 0);
              [SLEEP_DIARY_KEY, BP_DIARY_KEY, INJECTION_DIARY_KEY, SYMPTOMS_DIARY_KEY, PAIN_DIARY_KEY, NEURO_DIARY_KEY, ACNE_DIARY_KEY, HEMATO_DIARY_KEY].forEach(k => saveDiary(k, []));
              setSleepEntries([]); setBpEntries([]); setInjectionEntries([]); setSymptomEntries([]);
              setPainEntries([]); setNeuroEntries([]); setAcneEntries([]); setHematoEntries([]);
              pushUndo(`🧹 Очищены все встроенные дневники (${total})`, () => {
                setSleepEntries(snap[SLEEP_DIARY_KEY] as SleepEntry[]);
                setBpEntries(snap[BP_DIARY_KEY] as BPEntry[]);
                setInjectionEntries(snap[INJECTION_DIARY_KEY] as InjectionEntry[]);
                setSymptomEntries(snap[SYMPTOMS_DIARY_KEY] as SymptomEntry[]);
                setPainEntries(snap[PAIN_DIARY_KEY] as PainEntry[]);
                setNeuroEntries(snap[NEURO_DIARY_KEY] as NeuroEntry[]);
                setAcneEntries(snap[ACNE_DIARY_KEY] as AcneEntry[]);
                setHematoEntries(snap[HEMATO_DIARY_KEY] as HematoEntry[]);
                Object.entries(snap).forEach(([k, v]) => saveDiary(k, v as any[]));
              });
            }}
            style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}
          >🗑 Сбросить всё</button>
        </div>
      </AccordionSection>

      <AccordionSection
        title="🔗 Дневники в других блоках"
        subtitle="Быстрый переход к дневнику нужного блока (с подтверждением)"
        icon="🔗"
        color={colors.blue}
      >
        <QuickLinkRow links={QUICK_DIARY_LINKS} ariaLabel="Дневники в других блоках" />
      </AccordionSection>

      {activeDiary && (() => {
            const target = targetHit(activeDiary, activeEntriesRaw, goals);
        const offTarget = target && !target.onTarget;
        const bg = offTarget ? 'rgba(245,158,11,0.04)' : undefined;
        return (
        <AccordionSection
          title={`${DIARY_META[activeDiary].icon} Дневник: ${DIARY_META[activeDiary].title}`}
          subtitle={`Записи из ${DIARY_META[activeDiary].title.toLowerCase()} (${activeEntries.length})${currentPhase ? ` · ${currentPhase.label}${courseWeek ? ` · неделя ${courseWeek}` : ''}` : ''}${offTarget ? ` · ⚠️ вне цели` : ''}`}
          icon={DIARY_META[activeDiary].icon}
          color={DIARY_META[activeDiary].color}
          defaultOpen
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveDiary(null)}
              aria-label="Закрыть дневник"
              style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`, color: colors.text }}
            >← Назад к дневникам</button>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => quickAddToday()}
                aria-label="Быстро записать сегодня"
                style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.14)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' }}
              >⚡ Сегодня</button>
              {activeEntriesRaw.length > 0 && (
                <>
                  <button
                    onClick={() => printActiveDiary()}
                    aria-label="Печать или экспорт в PDF"
                    title="В диалоге печати можно выбрать «Сохранить как PDF»"
                    style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                  >📄 PDF / Печать</button>
                  <button
                    onClick={() => clearActiveDiary()}
                    aria-label="Очистить весь дневник"
                    style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                  >🧹 Очистить</button>
                </>
              )}
              {activeEntries.length > 0 && (
                <button
                  onClick={() => exportDiaryCSV(activeDiary, activeEntries)}
                  aria-label="Экспорт в CSV"
                  style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
                >📤 CSV</button>
              )}
              <button
                onClick={() => {
                  if (activeDiary === 'sleep') setAddSleepOpen(true);
                  else if (activeDiary === 'bp') setAddBPOpen(true);
                  else if (activeDiary === 'weight') setAddWeightOpen(true);
                  else if (activeDiary === 'measurements') setAddMeasurementsOpen(true);
                  else if (activeDiary === 'injection') setAddInjectionOpen(true);
                  else if (activeDiary === 'symptoms') setAddSymptomOpen(true);
                  else if (activeDiary === 'pain') setAddPainOpen(true);
                  else if (activeDiary === 'neuro') setAddNeuroOpen(true);
                  else if (activeDiary === 'acne') setAddAcneOpen(true);
                  else if (activeDiary === 'hemato') setAddHematoOpen(true);
                }}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: DIARY_META[activeDiary].color, color: '#0a0a0a', border: 'none' }}
              >+ Добавить запись</button>
            </div>
          </div>

          {/* Фильтр по дате */}
          {activeEntriesRaw.length > 1 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 600 }}>Период:</span>
              {(['all', '7', '30', '90'] as const).map(r => (
                <button key={r} onClick={() => setDiaryRange(r)} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${diaryRange === r ? DIARY_META[activeDiary].color : colors.border}`,
                  background: diaryRange === r ? `${DIARY_META[activeDiary].color}26` : 'rgba(255,255,255,0.03)',
                  color: diaryRange === r ? DIARY_META[activeDiary].color : colors.textMuted,
                }}>{r === 'all' ? 'Всё время' : `${r} дней`}</button>
              ))}
            </div>
          )}

          {/* Summary + Streak + Extremes + Trend */}
          {(() => {
            const summary = computeSummary(activeDiary, activeEntries);
            const period = computePeriodDelta(activeDiary, activeEntries);
            const streak = computeStreak(activeEntriesRaw);
            const extremes = computeExtremes(activeDiary, activeEntries);
        const target = targetHit(activeDiary, activeEntriesRaw, goals);
            const blocks: { label: string; value: string; color: string }[] = [];
            if (streak.totalDays > 0) {
              blocks.push({ label: 'Дней с записями', value: String(streak.totalDays), color: DIARY_META[activeDiary].color });
              blocks.push({ label: 'Серия (текущая)', value: `${streak.current} дн.`, color: streak.current >= 3 ? '#22c55e' : streak.current >= 1 ? colors.warning : colors.textMuted });
              blocks.push({ label: 'Серия (лучшая)', value: `${streak.best} дн.`, color: streak.best >= 7 ? '#22c55e' : streak.best >= 3 ? colors.warning : colors.textMuted });
            }
            if (period) blocks.push(period);
            if (extremes.min && (activeDiary === 'sleep' || activeDiary === 'weight' || activeDiary === 'pain' || activeDiary === 'acne' || activeDiary === 'neuro' || activeDiary === 'hemato')) {
              blocks.push({ label: 'Минимум', value: `${extremes.min.value.toFixed(1)} · ${new Date(extremes.min.date).toLocaleDateString('ru-RU')}`, color: '#22c55e' });
              blocks.push({ label: 'Максимум', value: `${extremes.max!.value.toFixed(1)} · ${new Date(extremes.max!.date).toLocaleDateString('ru-RU')}`, color: '#ef4444' });
            }
            if (target) blocks.unshift({ label: '🎯 Цель', value: `${target.onTarget ? '✅' : '⚠️'} ${target.details}`, color: target.onTarget ? '#22c55e' : '#f59e0b' });
            if (summary) blocks.push(...summary);
            if (blocks.length === 0) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, marginBottom: 10 }}>
                {blocks.map((s, i) => (
                  <div key={i} style={{ padding: 8, borderRadius: 8, background: `${s.color}1A`, border: `1px solid ${s.color}44` }}>
                    <div style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Полноценный график с зонами нормы и экспортом */}
          {activeEntries.length >= 1 && (() => {
            const points = buildSparkline(activeDiary, activeEntries);
            if (points.length < 1) return null;
            const targetVal = (() => {
              if (activeDiary === 'sleep') return goals.sleepHours > 0 ? goals.sleepHours : null;
              if (activeDiary === 'weight') return goals.weightKg > 0 ? goals.weightKg : null;
              if (activeDiary === 'bp') return goals.systolicTarget > 0 ? goals.systolicTarget : null;
              return null;
            })();
            const unit = DIARY_META[activeDiary].unit || '';
            const range = getNormalRange(activeDiary);
            const safeDate = new Date().toISOString().slice(0, 10);
            return (
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${DIARY_META[activeDiary].color}33`, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📈 График по датам</div>
                    {range && (
                      <div style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 4 }} title={range.description}>
                        Норма: {range.low}–{range.high}{unit}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: colors.textMuted }}>{points.length} точек · {unit}</div>
                </div>
                <FullChart
                  points={points}
                  color={DIARY_META[activeDiary].color}
                  target={targetVal}
                  normalRange={range}
                  unit={unit}
                  height={200}
                  onExportSvg={(svg) => exportSvgAsFile(svg, `${activeDiary}-chart-${safeDate}.svg`)}
                  onExportPng={(svg) => exportSvgAsPng(svg, `${activeDiary}-chart-${safeDate}.png`)}
                />
              </div>
            );
          })()}

          {/* Гистограмма по неделям */}
          {activeEntries.length >= 2 && (() => {
            const points = buildSparkline(activeDiary, activeEntries);
            const weeks = buildWeeklyHistogram(points);
            if (weeks.length < 2) return null;
            const maxCount = Math.max(...weeks.map(w => w.count));
            const maxMean = Math.max(...weeks.map(w => w.mean));
            const minMean = Math.min(...weeks.map(w => w.mean));
            const color = DIARY_META[activeDiary].color;
            const unit = DIARY_META[activeDiary].unit || '';
            return (
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📊 По неделям ({weeks.length})</div>
                  <div style={{ fontSize: 9, color: colors.textMuted }}>Столбик = среднее{unit ? ` ${unit}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, padding: '4px 0' }}>
                  {weeks.map((w, i) => {
                    const h = maxMean > minMean ? ((w.mean - minMean) / (maxMean - minMean || 1)) * 80 + 15 : 60;
                    const dateLabel = new Date(w.weekStart).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }} title={`Неделя с ${dateLabel}: ${w.count} записей, среднее ${w.mean.toFixed(1)}${unit}, мин ${w.min.toFixed(1)}, макс ${w.max.toFixed(1)}`}>
                        <div style={{ fontSize: 9, color: color, fontWeight: 700, marginBottom: 2 }}>{w.mean.toFixed(1)}</div>
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

          {/* Статистика распределения + распределение по часам */}
          {activeEntries.length >= 3 && (() => {
            const points = buildSparkline(activeDiary, activeEntries);
            const values = points.map(p => p.value);
            const stats = computeDistribution(values);
            const hourDist = buildHourDistribution(activeEntriesRaw.map(e => e.date));
            const maxHour = Math.max(...hourDist.map(h => h.count), 1);
            const lastClass = activeEntries[0] ? classifyValue(activeDiary, parseFloat(activeEntries[0].fields[0]?.value || 'NaN')) : 'unknown';
            const lastVal = activeEntries[0] ? activeEntries[0].fields[0]?.value : null;
            const lastUnit = activeEntries[0] ? activeEntries[0].fields[0]?.unit : '';
            return (
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${DIARY_META[activeDiary].color}33`, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📈 Статистика</div>
                  {lastVal && (
                    <div style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 4,
                      background: lastClass === 'normal' ? 'rgba(34,197,94,0.18)' : lastClass === 'warn' ? 'rgba(245,158,11,0.18)' : lastClass === 'danger' ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)',
                      color: lastClass === 'normal' ? '#22c55e' : lastClass === 'warn' ? '#f59e0b' : lastClass === 'danger' ? '#ef4444' : colors.textMuted,
                      fontWeight: 700,
                    }}>Последняя: {lastVal}{lastUnit} · {lastClass === 'normal' ? '✅ норма' : lastClass === 'warn' ? '⚠ внимание' : lastClass === 'danger' ? '⚠️ опасно' : '—'}</div>
                  )}
                </div>
                {stats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 4, marginBottom: 8 }}>
                    {[
                      { l: 'Среднее', v: stats.mean.toFixed(1) },
                      { l: 'Медиана', v: stats.median.toFixed(1) },
                      { l: 'σ (SD)', v: stats.stdDev.toFixed(1) },
                      { l: 'P25', v: stats.p25.toFixed(1) },
                      { l: 'P75', v: stats.p75.toFixed(1) },
                      { l: 'IQR', v: stats.iqr.toFixed(1) },
                    ].map(s => (
                      <div key={s.l} style={{ padding: '5px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 5, textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.l}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: DIARY_META[activeDiary].color }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Распределение по часам суток */}
                <div style={{ fontSize: 9, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>⏰ По времени суток</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 50 }}>
                  {hourDist.map((h, i) => {
                    const barH = (h.count / maxHour) * 40;
                    const isHigh = h.count > 0;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }} title={`${i}:00 — ${i + 1}:00: ${h.count} записей`}>
                        <div style={{
                          width: '100%', maxWidth: 18, height: `${barH}px`,
                          background: isHigh ? DIARY_META[activeDiary].color : 'rgba(255,255,255,0.06)',
                          borderRadius: '2px 2px 0 0', opacity: isHigh ? 0.9 : 0.4,
                        }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: colors.textMuted, marginTop: 2 }}>
                  <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                </div>
              </div>
            );
          })()}

          {activeEntries.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 12, padding: 12, textAlign: 'center' }}>
              {activeEntriesRaw.length === 0
                ? 'Записей пока нет. Нажмите «+ Добавить запись», чтобы внести первую.'
                : `Нет записей за выбранный период (${diaryRange === 'all' ? 'всё время' : diaryRange + ' дней'}).`}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupEntriesByPeriod(activeEntries).map(group => (
                <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: `${DIARY_META[activeDiary].color}14`, borderRadius: 6, borderLeft: `3px solid ${DIARY_META[activeDiary].color}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: DIARY_META[activeDiary].color }}>📅 {group.label}</span>
                    <span style={{ fontSize: 9, color: colors.textMuted }}>· {group.entries.length} {group.entries.length === 1 ? 'запись' : group.entries.length < 5 ? 'записи' : 'записей'}</span>
                  </div>
                  {group.entries.map((entry, i) => {
                    const anomalies = detectAnomalies(activeDiary, [entry]);
                    const dangerCount = anomalies.filter(a => a.severity === 'danger').length;
                    const warnCount = anomalies.filter(a => a.severity === 'warn').length;
                    const anomalyLevel = dangerCount > 0 ? 'danger' : warnCount > 0 ? 'warn' : null;
                    const rowColor = anomalyLevel === 'danger' ? '#ef4444' : anomalyLevel === 'warn' ? '#f59e0b' : DIARY_META[activeDiary].color;
                    return (
                    <div key={`${group.label}-${entry.date}-${i}`} style={{
                      padding: 10, borderRadius: 8,
                      background: anomalyLevel === 'danger' ? 'rgba(239,68,68,0.08)' : anomalyLevel === 'warn' ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${rowColor}66`,
                      transition: 'background 0.15s, transform 0.15s',
                      animation: `diary-row-in 0.25s ease-out ${i * 0.04}s both`,
                      ...(anomalyLevel === 'danger' ? { animation: `diary-row-in 0.25s ease-out ${i * 0.04}s both, diary-pulse 1.6s ease-out infinite` } : {}),
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = anomalyLevel === 'danger' ? 'rgba(239,68,68,0.12)' : anomalyLevel === 'warn' ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = anomalyLevel === 'danger' ? 'rgba(239,68,68,0.08)' : anomalyLevel === 'warn' ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: rowColor }}>{new Date(entry.date).toLocaleDateString('ru-RU')}</span>
                          {anomalyLevel === 'danger' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>⚠️ АНОМАЛИЯ</span>}
                          {anomalyLevel === 'warn' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>⚠ Внимание</span>}
                        </div>
                        <button
                          onClick={() => deleteDiaryEntry(activeDiary, entry.date)}
                          aria-label={`Удалить запись ${new Date(entry.date).toLocaleDateString('ru-RU')}`}
                          style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}
                        >🗑 Удалить</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 4 }}>
                        {entry.fields.map((f, fi) => (
                          <div key={fi} style={{ fontSize: 10, color: colors.textMuted }}>
                            <span style={{ color: colors.text }}>{f.value}</span>
                            {f.unit ? ` ${f.unit}` : ''}
                            <span style={{ marginLeft: 4, opacity: 0.7 }}>· {f.label}</span>
                          </div>
                        ))}
                      </div>
                      {anomalies.length > 0 && (
                        <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 4, fontSize: 10, background: 'rgba(0,0,0,0.25)', color: rowColor, fontWeight: 600 }}>
                          ⚠ {anomalies.map(a => a.message).join(' · ')}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </AccordionSection>
        );
      })()}

      <AccordionSection
        title="📊 Отчёты по модулям"
        subtitle="Быстрый переход к отчётам других блоков (с подтверждением)"
        icon="📊"
        color={colors.teal}
      >
        <QuickLinkRow links={QUICK_REPORT_LINKS} ariaLabel="Отчёты по модулям" />
      </AccordionSection>

      <AddSleepModal
        open={addSleepOpen}
        onClose={() => setAddSleepOpen(false)}
        onSave={(e) => {
          const updated = [...sleepEntries.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(SLEEP_DIARY_KEY, updated);
          setSleepEntries(updated);
        }}
      />
      <AddBPModal
        open={addBPOpen}
        onClose={() => setAddBPOpen(false)}
        onSave={(e) => {
          const updated = [...bpEntries.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(BP_DIARY_KEY, updated);
          setBpEntries(updated);
        }}
      />
      <AddWeightModal
        open={addWeightOpen}
        onClose={() => setAddWeightOpen(false)}
        onSave={(e) => {
          const updated = [...weights.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveWeightLog(updated);
          setWeights(updated);
        }}
      />
      <AddMeasurementsModal
        open={addMeasurementsOpen}
        onClose={() => setAddMeasurementsOpen(false)}
        onSave={(e) => {
          const updated = [...measurements.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveMeasurementsLog(updated);
          setMeasurements(updated);
        }}
      />
      <AddInjectionModal
        open={addInjectionOpen}
        onClose={() => setAddInjectionOpen(false)}
        onSave={(e) => {
          const updated = [...injectionEntries.filter(x => !(x.date === e.date && x.substance === e.substance)), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(INJECTION_DIARY_KEY, updated);
          setInjectionEntries(updated);
        }}
      />
      <AddSymptomModal
        open={addSymptomOpen}
        onClose={() => setAddSymptomOpen(false)}
        onSave={(e) => {
          const updated = [...symptomEntries.filter(x => !(x.date === e.date && x.name === e.name)), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(SYMPTOMS_DIARY_KEY, updated);
          setSymptomEntries(updated);
        }}
      />
      <AddPainModal
        open={addPainOpen}
        onClose={() => setAddPainOpen(false)}
        onSave={(e) => {
          const updated = [...painEntries.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(PAIN_DIARY_KEY, updated);
          setPainEntries(updated);
        }}
      />
      <AddNeuroModal
        open={addNeuroOpen}
        onClose={() => setAddNeuroOpen(false)}
        onSave={(e) => {
          const updated = [...neuroEntries.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(NEURO_DIARY_KEY, updated);
          setNeuroEntries(updated);
        }}
      />
      <AddAcneModal
        open={addAcneOpen}
        onClose={() => setAddAcneOpen(false)}
        onSave={(e) => {
          const updated = [...acneEntries.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(ACNE_DIARY_KEY, updated);
          setAcneEntries(updated);
        }}
      />
      <AddHematoModal
        open={addHematoOpen}
        onClose={() => setAddHematoOpen(false)}
        onSave={(e) => {
          const updated = [...hematoEntries.filter(x => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
          saveDiary(HEMATO_DIARY_KEY, updated);
          setHematoEntries(updated);
        }}
      />
      </>}

      <style>{`
        @keyframes snackbar-in {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes diary-row-in {
          from { transform: translateX(-8px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes diary-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          70% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
      <Snackbar action={undoAction} onDismiss={dismissUndo} />
    </div>
  );
};
