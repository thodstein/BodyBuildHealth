/**
 * DiaryModals — shared add-entry modal components for all diary types.
 * Used by both ProfileDiariesTab and DiaryWindow.
 */
import React, { useState } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';

export interface UndoAction { label: string; undo: () => void; expiresAt: number; }

export const fieldLabel: React.CSSProperties = { fontSize: 11, color: colors.textMuted, fontWeight: 600, marginBottom: 4, display: 'block' };
export const fieldInput: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 12px', color: colors.text, fontSize: 14, outline: 'none',
  boxSizing: 'border-box', minHeight: 40,
};
export const btnPrimary = (color: string): React.CSSProperties => ({
  flex: 1, minHeight: 40, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
  background: color, color: '#000', border: 'none', cursor: 'pointer',
});
export const btnGhost: React.CSSProperties = {
  flex: 1, minHeight: 40, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, cursor: 'pointer',
};

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
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
          width: 'min(420px, 92vw)', maxHeight: '90vh', overflowY: 'auto',
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

export const DateInput: React.FC<{ value: string; onChange: (v: string) => void; style?: React.CSSProperties }> = ({ value, onChange, style }) => {
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

const SYMPTOM_PRESETS = [
  'Головная боль', 'Тошнота', 'Бессонница', 'Боль в суставах', 'Отёки',
  'Сыпь', 'Акне', 'Потливание', 'Раздражительность', 'Снижение либидо',
  'Сердцебиение', 'Головокружение', 'Слабость', 'Боль в пояснице', 'Судороги',
];

const PAIN_ZONES = [
  { id: 'shoulders', label: 'Плечи' }, { id: 'elbows', label: 'Локти' }, { id: 'wrists', label: 'Запястья' },
  { id: 'lower_back', label: 'Поясница' }, { id: 'hips', label: 'ТБС' }, { id: 'knees', label: 'Колени' },
  { id: 'ankles', label: 'Голеностоп' },
];
const NEURO_SYMPTOMS = [
  { id: 'anxiety', label: 'Тревожность' }, { id: 'insomnia', label: 'Бессонница' }, { id: 'mood_swings', label: 'Перепады настроения' },
  { id: 'irritability', label: 'Раздражительность' }, { id: 'headache', label: 'Головная боль' }, { id: 'low_libido', label: 'Снижение либидо' },
  { id: 'fatigue', label: 'Усталость' }, { id: 'concentration', label: 'Трудности с концентрацией' }, { id: 'depression', label: 'Подавленное настроение' },
  { id: 'sweating', label: 'Потливание' },
];
const ACNE_AREAS = [
  { id: 'face', label: 'Лицо' }, { id: 'chest', label: 'Грудь' }, { id: 'back', label: 'Спина' },
  { id: 'shoulders_acne', label: 'Плечи' },
];
const HEMATO_SYMPTOMS = [
  { id: 'nosebleeds', label: 'Носовые кровотечения' }, { id: 'gum_bleeding', label: 'Кровоточивость дёсен' },
  { id: 'bruising', label: 'Синяки без причины' }, { id: 'headache_h', label: 'Головная боль' },
  { id: 'flushing', label: 'Покраснение лица' }, { id: 'vision', label: 'Нарушения зрения' },
  { id: 'itching', label: 'Кожный зуд' }, { id: 'numbness', label: 'Онемение конечностей' },
];

export const AddSleepModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState('7.5');
  const [quality, setQuality] = useState('4');
  const [awakenings, setAwakenings] = useState('1');
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [notes, setNotes] = useState('');
  const submit = () => {
    const h = Number(hours); const q = Number(quality); const a = Number(awakenings);
    if (!date || !Number.isFinite(h) || h < 0 || h > 24) return;
    if (!Number.isFinite(q) || q < 1 || q > 5) return;
    onSave({ date, hours: h, quality: q, awakenings: a, bedtime, wakeTime, notes: notes.trim() || undefined });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="💤 Добавить запись сна">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div><label style={fieldLabel}>Часы сна</label><input type="number" step="0.5" min="0" max="24" value={hours} onChange={e => setHours(e.target.value)} style={fieldInput} /></div>
        <div><label style={fieldLabel}>Качество (1-5)</label><input type="number" step="1" min="1" max="5" value={quality} onChange={e => setQuality(e.target.value)} style={fieldInput} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
        <div><label style={fieldLabel}>Пробуждений</label><input type="number" step="1" min="0" max="20" value={awakenings} onChange={e => setAwakenings(e.target.value)} style={fieldInput} /></div>
        <div><label style={fieldLabel}>Лёг</label><input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} style={fieldInput} /></div>
        <div><label style={fieldLabel}>Подъём</label><input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={fieldInput} /></div>
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

export const AddBPModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
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
    onSave({ date, systolic: s, diastolic: d, pulse: p, notes: notes.trim() || undefined });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="❤️ Добавить запись АД">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
        <div><label style={fieldLabel}>Систола</label><input type="number" min="50" max="250" value={systolic} onChange={e => setSystolic(e.target.value)} style={fieldInput} /></div>
        <div><label style={fieldLabel}>Диастола</label><input type="number" min="30" max="180" value={diastolic} onChange={e => setDiastolic(e.target.value)} style={fieldInput} /></div>
        <div><label style={fieldLabel}>Пульс</label><input type="number" min="20" max="250" value={pulse} onChange={e => setPulse(e.target.value)} style={fieldInput} /></div>
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

export const AddWeightModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
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

export const AddMeasurementsModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>{[
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
      ))}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Отмена</button>
        <button onClick={submit} style={btnPrimary(colors.blue)}>Сохранить</button>
      </div>
    </Modal>
  );
};

export const AddInjectionModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [substance, setSubstance] = useState('');
  const [dose, setDose] = useState('');
  const [site, setSite] = useState('Дельта');
  const [notes, setNotes] = useState('');
  const submit = () => {
    if (!date || !substance || !dose) return;
    onSave({ date, substance, dose, site, notes: notes.trim() || undefined });
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

export const AddSymptomModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const submit = () => {
    if (!date || !name.trim()) return;
    onSave({ date, name: name.trim(), severity, duration: duration.trim() || undefined, notes: notes.trim() || undefined });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="🩺 Добавить симптом">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} style={fieldInput} />
      <label style={{ ...fieldLabel, marginTop: 10 }}>Симптом</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} style={fieldInput} placeholder="Например: головная боль" list="he-symptom-presets-dw" />
      <datalist id="he-symptom-presets-dw">{SYMPTOM_PRESETS.map(s => <option key={s} value={s} />)}</datalist>
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

export const painZoneColor = (v: number) => v <= 2 ? '#22c55e' : v <= 4 ? '#f59e0b' : v <= 7 ? '#f97316' : '#ef4444';
export const acneAreaColor = (v: number) => v === 0 ? '#22c55e' : v === 1 ? '#f59e0b' : v === 2 ? '#f97316' : '#ef4444';

export const AddPainModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
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

export const AddNeuroModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
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

export const AddAcneModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
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

export const AddHematoModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({ open, onClose, onSave }) => {
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
