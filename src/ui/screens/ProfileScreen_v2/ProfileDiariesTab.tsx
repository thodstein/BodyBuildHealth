/**
 * ProfileDiariesTab — вкладка "Дневники".
 * Встроенные дневники (в Профиле) с кнопками добавления записей + быстрый доступ
 * к дневникам в других блоках (открывает конкретный дневник/отчёт).
 */
import React, { useState, useEffect } from 'react';
import { db } from '../../../core/db';
import { getWeightLog, saveWeightLog, getMeasurementsLog, saveMeasurementsLog } from '../../../engines/profile-store';
import { AccordionSection, colors } from './ui';

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

type DiaryKey = 'sleep' | 'bp' | 'weight' | 'measurements' | 'injection' | 'symptoms' | 'pain' | 'neuro' | 'acne' | 'hemato';

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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
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
  onAdd: () => void;
  onOpen: () => void;
}> = ({ diaryKey, count, last, onAdd, onOpen }) => {
  const meta = DIARY_META[diaryKey];
  return (
    <div
      style={{
        background: 'rgba(28,28,32,0.65)',
        border: `1px solid ${meta.color}33`,
        borderRadius: 12, padding: 12,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{meta.title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: meta.color, marginLeft: 'auto',
          background: `${meta.color}22`, padding: '1px 6px', borderRadius: 4,
        }}>{count}</span>
      </div>
      <div style={{ fontSize: 10, color: colors.textMuted, minHeight: 14 }}>
        {last ? `Последняя: ${last}${meta.unit ? ' ' + meta.unit : ''}` : 'Нет записей'}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          onClick={onAdd}
          aria-label={`Добавить запись в дневник ${meta.title}`}
          style={{
            flex: 1, minHeight: 32, padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44`,
            cursor: 'pointer',
          }}
        >+ Добавить</button>
        <button
          onClick={onOpen}
          aria-label={`Открыть дневник ${meta.title}`}
          style={{
            flex: 1, minHeight: 32, padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`,
            cursor: 'pointer',
          }}
        >📋 Открыть</button>
      </div>
    </div>
  );
};

/* ── Быстрые ссылки на дневники в других блоках ── */

interface QuickLink { icon: string; label: string; target: string; color: string; }

const Sparkline: React.FC<{ points: { date: string; value: number }[]; color: string; width?: number; height?: number }> = ({ points, color, width = 320, height = 48 }) => {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - 4) / (sorted.length - 1);
  const pathD = sorted.map((p, i) => {
    const x = 2 + i * stepX;
    const y = height - 2 - ((p.value - min) / range) * (height - 4);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const last = sorted[sorted.length - 1];
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }} aria-label="График тренда">
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={2 + (sorted.length - 1) * stepX} cy={height - 2 - ((last.value - min) / range) * (height - 4)} r="3" fill={color} />
      <text x={width - 4} y={12} fontSize="10" fill={color} textAnchor="end" fontWeight="700">{last.value.toFixed(1)}</text>
    </svg>
  );
};

const buildSparkline = (
  key: DiaryKey,
  entries: { date: string; fields: { label: string; value: string; unit: string }[] }[]
): { date: string; value: number }[] => {
  const out: { date: string; value: number }[] = [];
  for (const e of entries) {
    let v: number | null = null;
    if (key === 'sleep') {
      const f = e.fields.find(x => x.label === 'Часы');
      if (f) v = parseFloat(f.value);
    } else if (key === 'bp') {
      const sys = e.fields.find(x => x.label === 'Систола');
      const dia = e.fields.find(x => x.label === 'Диастола');
      if (sys && dia) v = (parseFloat(sys.value) + parseFloat(dia.value)) / 2;
    } else if (key === 'weight') {
      const f = e.fields.find(x => x.label === 'Вес');
      if (f) v = parseFloat(f.value);
    } else if (key === 'measurements') {
      const f = e.fields.find(x => x.label === 'Талия');
      if (f) v = parseFloat(f.value);
    } else if (key === 'pain') {
      const f = e.fields.find(x => x.label === 'Суммарно');
      if (f) v = parseFloat(f.value);
    } else if (key === 'neuro') {
      const f = e.fields.find(x => x.label === 'Симптомов');
      if (f) v = parseFloat(f.value);
    } else if (key === 'acne') {
      const f = e.fields.find(x => x.label === 'Суммарно');
      if (f) v = parseFloat(f.value);
    } else if (key === 'hemato') {
      const f = e.fields.find(x => x.label === 'Симптомов');
      if (f) v = parseFloat(f.value);
    } else if (key === 'injection' || key === 'symptoms') {
      continue;
    }
    if (v !== null && Number.isFinite(v)) out.push({ date: e.date, value: v });
  }
  return out;
};

const computeSummary = (
  key: DiaryKey,
  entries: { date: string; fields: { label: string; value: string; unit: string }[] }[]
): { label: string; value: string; color: string }[] | null => {
  if (entries.length === 0) return null;
  const color = DIARY_META[key].color;
  const out: { label: string; value: string; color: string }[] = [];
  if (key === 'sleep') {
    const hours = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Часы')?.value || 'NaN')).filter(Number.isFinite);
    if (hours.length) {
      const avg = hours.reduce((s, v) => s + v, 0) / hours.length;
      out.push({ label: 'Записей', value: String(hours.length), color });
      out.push({ label: 'Среднее', value: `${avg.toFixed(1)} ч`, color });
      out.push({ label: 'Мин/Макс', value: `${Math.min(...hours).toFixed(1)} / ${Math.max(...hours).toFixed(1)}`, color: color });
    }
  } else if (key === 'bp') {
    const sys = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Систола')?.value || 'NaN')).filter(Number.isFinite);
    const dia = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Диастола')?.value || 'NaN')).filter(Number.isFinite);
    if (sys.length) {
      out.push({ label: 'Записей', value: String(sys.length), color });
      out.push({ label: 'Ср. сист.', value: `${(sys.reduce((s, v) => s + v, 0) / sys.length).toFixed(0)}`, color });
    }
    if (dia.length) {
      out.push({ label: 'Ср. диаст.', value: `${(dia.reduce((s, v) => s + v, 0) / dia.length).toFixed(0)}`, color });
    }
  } else if (key === 'weight') {
    const w = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Вес')?.value || 'NaN')).filter(Number.isFinite);
    if (w.length) {
      const first = w[w.length - 1];
      const last = w[0];
      const delta = last - first;
      out.push({ label: 'Записей', value: String(w.length), color });
      out.push({ label: 'Текущий', value: `${last.toFixed(1)} кг`, color });
      out.push({ label: 'Δ за период', value: `${delta > 0 ? '+' : ''}${delta.toFixed(1)} кг`, color: delta > 0 ? '#22c55e' : delta < 0 ? colors.danger : color });
    }
  } else if (key === 'measurements') {
    out.push({ label: 'Записей', value: String(entries.length), color });
    const last = entries[0];
    const waist = last.fields.find(x => x.label === 'Талия')?.value;
    const bf = last.fields.find(x => x.label === '% жира')?.value;
    if (waist) out.push({ label: 'Талия', value: `${waist} см`, color });
    if (bf && Number(bf) > 0) out.push({ label: '% жира', value: `${bf}%`, color });
  } else if (key === 'injection' || key === 'symptoms') {
    out.push({ label: 'Записей', value: String(entries.length), color });
    if (entries[0]) out.push({ label: 'Последняя', value: new Date(entries[0].date).toLocaleDateString('ru-RU'), color });
  } else if (key === 'pain') {
    const totals = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Суммарно')?.value || 'NaN')).filter(Number.isFinite);
    if (totals.length) {
      const avg = totals.reduce((s, v) => s + v, 0) / totals.length;
      const colorByLevel = avg < 20 ? '#22c55e' : avg < 40 ? '#f59e0b' : avg < 60 ? '#f97316' : '#ef4444';
      out.push({ label: 'Записей', value: String(totals.length), color });
      out.push({ label: 'Ср. Σ', value: `${avg.toFixed(1)}/70`, color: colorByLevel });
      out.push({ label: 'Макс Σ', value: `${Math.max(...totals).toFixed(0)}/70`, color: colorByLevel });
    }
  } else if (key === 'neuro') {
    const scores = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Симптомов')?.value || 'NaN')).filter(Number.isFinite);
    if (scores.length) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const colorByLevel = avg >= 4 ? '#ef4444' : avg >= 2 ? '#f59e0b' : '#22c55e';
      out.push({ label: 'Записей', value: String(scores.length), color });
      out.push({ label: 'Ср. симптомов', value: `${avg.toFixed(1)}/10`, color: colorByLevel });
      out.push({ label: 'Макс', value: `${Math.max(...scores)}/10`, color: colorByLevel });
    }
  } else if (key === 'acne') {
    const totals = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Суммарно')?.value || 'NaN')).filter(Number.isFinite);
    if (totals.length) {
      const avg = totals.reduce((s, v) => s + v, 0) / totals.length;
      const colorByLevel = avg >= 7 ? '#ef4444' : avg >= 4 ? '#f59e0b' : '#22c55e';
      out.push({ label: 'Записей', value: String(totals.length), color });
      out.push({ label: 'Ср. Σ', value: `${avg.toFixed(1)}/12`, color: colorByLevel });
      out.push({ label: 'Макс Σ', value: `${Math.max(...totals).toFixed(0)}/12`, color: colorByLevel });
    }
  } else if (key === 'hemato') {
    const scores = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Симптомов')?.value || 'NaN')).filter(Number.isFinite);
    if (scores.length) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const colorByLevel = avg >= 2 ? '#ef4444' : '#22c55e';
      out.push({ label: 'Записей', value: String(scores.length), color });
      out.push({ label: 'Ср. симптомов', value: `${avg.toFixed(1)}/8`, color: colorByLevel });
      out.push({ label: 'Макс', value: `${Math.max(...scores)}/8`, color: colorByLevel });
    }
  }
  return out;
};

const QUICK_DIARY_LINKS: QuickLink[] = [
  { icon: '🍽', label: 'Дневник питания', target: 'nutrition-diary', color: colors.green },
  { icon: '🏋️', label: 'Журнал тренировок', target: 'workout-log', color: colors.blue },
  { icon: '💊', label: 'Мой курс', target: 'pharma-course', color: colors.warning },
  { icon: '🛡', label: 'Дневник поддержки', target: 'support-diary', color: colors.purple },
  { icon: '🧪', label: 'Анализы', target: 'labs-diary', color: colors.teal },
];

const QUICK_REPORT_LINKS: QuickLink[] = [
  { icon: '🏋️', label: 'Тренер-отчёт', target: 'training-analytics', color: colors.blue },
  { icon: '💊', label: 'Фарма-отчёт', target: 'pharma-reports', color: colors.warning },
  { icon: '🩺', label: 'Врач-отчёт', target: 'labs-reports', color: colors.danger },
  { icon: '🍽', label: 'Отчёт по питанию', target: 'nutrition-reports', color: colors.green },
  { icon: '🛡', label: 'Отчёт поддержки', target: 'support-reports', color: colors.purple },
  { icon: '📊', label: 'Кастомный отчёт', target: 'custom-report', color: colors.orange },
];

/* ── Главный компонент ── */

export const ProfileDiariesTab: React.FC<{ onNavigate?: (screen: string) => void; initialView?: 'diary' | 'reports' | 'archive'; initialActiveDiary?: DiaryKey }> = ({ onNavigate, initialView, initialActiveDiary }) => {
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
    if (!confirm(`Удалить запись от ${new Date(date).toLocaleDateString('ru-RU')}?`)) return;
    const handler = (arr: any[], list: any[], setter: (v: any[]) => void, save: (v: any[]) => void) => {
      const updated = list.filter(x => x.date !== date);
      setter(updated);
      save(updated);
    };
    if (key === 'sleep') handler([], sleepEntries, setSleepEntries, v => saveDiary(SLEEP_DIARY_KEY, v));
    else if (key === 'bp') handler([], bpEntries, setBpEntries, v => saveDiary(BP_DIARY_KEY, v));
    else if (key === 'injection') handler([], injectionEntries, setInjectionEntries, v => saveDiary(INJECTION_DIARY_KEY, v));
    else if (key === 'symptoms') handler([], symptomEntries, setSymptomEntries, v => saveDiary(SYMPTOMS_DIARY_KEY, v));
    else if (key === 'pain') handler([], painEntries, setPainEntries, v => saveDiary(PAIN_DIARY_KEY, v));
    else if (key === 'neuro') handler([], neuroEntries, setNeuroEntries, v => saveDiary(NEURO_DIARY_KEY, v));
    else if (key === 'acne') handler([], acneEntries, setAcneEntries, v => saveDiary(ACNE_DIARY_KEY, v));
    else if (key === 'hemato') handler([], hematoEntries, setHematoEntries, v => saveDiary(HEMATO_DIARY_KEY, v));
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
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {links.map(link => (
        <button
          key={link.target}
          onClick={() => onNavigate?.(link.target)}
          aria-label={`Открыть ${link.label}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 8, cursor: 'pointer', textAlign: 'left', minHeight: 44,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${link.color}33`,
            color: colors.text, transition: 'background 0.15s',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{link.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: link.color, flex: 1 }}>{link.label}</span>
          <span style={{ color: colors.textMuted, fontSize: 16 }}>→</span>
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
        subtitle="Сон, давление, вес, замеры, инъекции — добавляйте прямо здесь"
        icon="📓"
        color={colors.orange}
        defaultOpen
      >
        <div
          role="list"
          aria-label="Встроенные дневники"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}
        >
          {builtInDiaries.map(d => (
            <DiaryCard
              key={d.key}
              diaryKey={d.key}
              count={d.count}
              last={d.last}
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
      </AccordionSection>

      {activeDiary && (
        <AccordionSection
          title={`${DIARY_META[activeDiary].icon} Дневник: ${DIARY_META[activeDiary].title}`}
          subtitle={`Записи из ${DIARY_META[activeDiary].title.toLowerCase()} (${activeEntries.length})`}
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
          {activeEntries.length > 1 && (
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

          {/* Summary */}
          {(() => {
            const summary = computeSummary(activeDiary, activeEntries);
            if (!summary) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, marginBottom: 10 }}>
                {summary.map((s, i) => (
                  <div key={i} style={{ padding: 8, borderRadius: 8, background: `${s.color}1A`, border: `1px solid ${s.color}44` }}>
                    <div style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Sparkline */}
          {activeEntries.length >= 2 && (() => {
            const points = buildSparkline(activeDiary, activeEntries);
            if (points.length < 2) return null;
            return (
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${DIARY_META[activeDiary].color}22`, marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Тренд (по дате)</div>
                <Sparkline points={points} color={DIARY_META[activeDiary].color} width={300} height={48} />
              </div>
            );
          })()}

          {activeEntries.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 12, padding: 12, textAlign: 'center' }}>
              Записей пока нет. Нажмите «+ Добавить запись», чтобы внести первую.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeEntries.map((entry, i) => (
                <div key={`${entry.date}-${i}`} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${DIARY_META[activeDiary].color}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: DIARY_META[activeDiary].color }}>{new Date(entry.date).toLocaleDateString('ru-RU')}</span>
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
                </div>
              ))}
            </div>
          )}
        </AccordionSection>
      )}

      <AccordionSection
        title="🔗 Дневники в других блоках"
        subtitle="Переход к дневнику в нужном блоке (одним кликом)"
        icon="🔗"
        color={colors.blue}
      >
        <QuickLinkRow links={QUICK_DIARY_LINKS} ariaLabel="Дневники в других блоках" />
      </AccordionSection>

      <AccordionSection
        title="📊 Отчёты"
        subtitle="Готовые отчёты по модулям приложения"
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
    </div>
  );
};
