/**
 * DiaryModals — shared add-entry modal components for all diary types.
 * Used by both ProfileDiariesTab and DiaryWindow.
 */
import React, { useState } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import { INJECTION_ZONES, NEEDLE_GAUGES, TECHNIQUES } from '../../../engines/injection-diary.engine';

export interface UndoAction {
  label: string;
  undo: () => void;
  expiresAt: number;
}

export const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: colors.textMuted,
  fontWeight: 600,
  marginBottom: 4,
  display: 'block',
};
export const fieldInput: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '10px 12px',
  color: colors.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: 40,
};
export const btnPrimary = (color: string): React.CSSProperties => ({
  flex: 1,
  minHeight: 40,
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  background: color,
  color: '#000',
  border: 'none',
  cursor: 'pointer',
});
export const btnGhost: React.CSSProperties = {
  flex: 1,
  minHeight: 40,
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  background: 'transparent',
  color: colors.text,
  border: `1px solid ${colors.border}`,
  cursor: 'pointer',
};

export const styles = { fieldLabel, fieldInput, btnGhost, btnPrimary };

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({
  open,
  onClose,
  title,
  children,
}) => {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 92vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#1a1a1d',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
          color: colors.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.primary }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const DateInput: React.FC<{ value: string; onChange: (v: string) => void; style?: React.CSSProperties }> = ({
  value,
  onChange,
  style,
}) => (
  <input
    type="date"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{ ...fieldInput, colorScheme: 'dark' }}
  />
);

const SYMPTOM_PRESETS = [
  'Головная боль',
  'Тошнота',
  'Бессонница',
  'Боль в суставах',
  'Отёки',
  'Сыпь',
  'Акне',
  'Потливание',
  'Раздражительность',
  'Снижение либидо',
  'Сердцебиение',
  'Головокружение',
  'Слабость',
  'Боль в пояснице',
  'Судороги',
];

export const PAIN_ZONES = [
  { id: 'shoulders', label: 'Плечи' },
  { id: 'elbows', label: 'Локти' },
  { id: 'wrists', label: 'Запястья' },
  { id: 'lower_back', label: 'Поясница' },
  { id: 'hips', label: 'ТБС' },
  { id: 'knees', label: 'Колени' },
  { id: 'ankles', label: 'Голеностоп' },
];
export const NEURO_SYMPTOMS = [
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
export const ACNE_AREAS = [
  { id: 'face', label: 'Лицо' },
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'shoulders_acne', label: 'Плечи' },
];
export const HEMATO_SYMPTOMS = [
  { id: 'nosebleeds', label: 'Носовые кровотечения' },
  { id: 'gum_bleeding', label: 'Кровоточивость дёсен' },
  { id: 'bruising', label: 'Синяки без причины' },
  { id: 'headache_h', label: 'Головная боль' },
  { id: 'flushing', label: 'Покраснение лица' },
  { id: 'vision', label: 'Нарушения зрения' },
  { id: 'itching', label: 'Кожный зуд' },
  { id: 'numbness', label: 'Онемение конечностей' },
];

export const DIARY_META: Record<
  string,
  { title: string; unit: string; icon: string; color: string; storageKey?: string }
> = {
  sleep: { title: 'Сон', unit: 'ч', icon: '💤', color: '#a78bfa', storageKey: 'he_sleep_diary' },
  bp: { title: 'Давление', unit: 'мм рт.ст.', icon: '❤️', color: '#ef4444', storageKey: 'he_bp_diary' },
  weight: { title: 'Вес и замеры', unit: 'кг / см', icon: '⚖️', color: '#22c55e' },
  injection: { title: 'Инъекции', unit: '', icon: '💉', color: '#f59e0b', storageKey: 'he_injection_diary' },
  health: { title: 'Здоровье', unit: '', icon: '🩺', color: '#ec4899', storageKey: 'he_health_diary' },
};

export const painZoneColor = (v: number) => (v <= 2 ? '#22c55e' : v <= 4 ? '#f59e0b' : v <= 7 ? '#f97316' : '#ef4444');
export const acneAreaColor = (v: number) =>
  v === 0 ? '#22c55e' : v === 1 ? '#f59e0b' : v === 2 ? '#f97316' : '#ef4444';

const ActionRow: React.FC<{ onClose: () => void; onSave: () => void; color: string }> = ({
  onClose,
  onSave,
  color,
}) => (
  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
    <button onClick={onClose} style={btnGhost}>
      Отмена
    </button>
    <button onClick={onSave} style={btnPrimary(color)}>
      Сохранить
    </button>
  </div>
);

export const AddSleepModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState('7.5');
  const [quality, setQuality] = useState('4');
  const [awakenings, setAwakenings] = useState('1');
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [notes, setNotes] = useState('');
  const save = () => {
    const h = Number(hours),
      q = Number(quality),
      a = Number(awakenings);
    if (!date || !Number.isFinite(h) || h < 0 || h > 24 || !Number.isFinite(q) || q < 1 || q > 5) return;
    onSave({
      date,
      hours: h,
      quality: q,
      awakenings: Number.isFinite(a) ? a : 0,
      bedtime,
      wakeTime,
      notes: notes.trim() || undefined,
    });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="💤 Добавить запись сна">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <input
          type="number"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          style={fieldInput}
          placeholder="Часы сна"
        />
        <input
          type="number"
          min="1"
          max="5"
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          style={fieldInput}
          placeholder="Качество 1-5"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <input
          type="number"
          value={awakenings}
          onChange={(e) => setAwakenings(e.target.value)}
          style={fieldInput}
          placeholder="Пробуждений"
        />
        <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} style={fieldInput} />
        <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} style={fieldInput} />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...fieldInput, marginTop: 8 }}
        placeholder="Заметка"
      />
      <ActionRow onClose={onClose} onSave={save} color={colors.primary} />
    </Modal>
  );
};

export const AddBPModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(todayIso()),
    [systolic, setSystolic] = useState('120'),
    [diastolic, setDiastolic] = useState('80'),
    [pulse, setPulse] = useState('70'),
    [notes, setNotes] = useState('');
  const save = () => {
    const s = Number(systolic),
      d = Number(diastolic),
      p = Number(pulse);
    if (!date || s < 50 || s > 250 || d < 30 || d > 180 || p < 20 || p > 250) return;
    onSave({ date, systolic: s, diastolic: d, pulse: p, notes: notes.trim() || undefined });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="❤️ Добавить запись АД">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 8 }}>
        {[
          ['Систола', systolic, setSystolic],
          ['Диастола', diastolic, setDiastolic],
          ['Пульс', pulse, setPulse],
        ].map(([label, value, setter]) => (
          <input
            key={String(label)}
            type="number"
            value={value as string}
            onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
            style={fieldInput}
            placeholder={String(label)}
          />
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...fieldInput, marginTop: 8 }}
        placeholder="Заметка"
      />
      <ActionRow onClose={onClose} onSave={save} color={colors.danger} />
    </Modal>
  );
};

export const AddBodyMeasurementsModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(todayIso());
  const fields = [
    'weight',
    'waistCm',
    'chestCm',
    'hipCm',
    'bicepCm',
    'thighCm',
    'neckCm',
    'forearmCm',
    'bodyFat',
    'muscleMass',
    'waterMass',
  ] as const;
  const [values, setValues] = useState<Record<string, string>>({ weight: '80' });
  const [notes, setNotes] = useState('');
  const save = () => {
    if (!date) return;
    const entry: Record<string, unknown> = { date, notes: notes.trim() || undefined };
    fields.forEach((key) => {
      const value = Number(values[key]);
      if (values[key] !== undefined && values[key] !== '' && Number.isFinite(value)) entry[key] = value;
    });
    if (typeof entry.weight !== 'number' || entry.weight <= 0) return;
    onSave(entry);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="⚖️ Вес и замеры тела">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        {fields.map((key) => (
          <input
            key={key}
            type="number"
            step="0.1"
            value={values[key] || ''}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            style={fieldInput}
            placeholder={key}
            aria-label={key}
          />
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...fieldInput, marginTop: 8 }}
        placeholder="Заметка"
      />
      <ActionRow onClose={onClose} onSave={save} color={colors.green} />
    </Modal>
  );
};

export const AddInjectionModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(todayIso());
  const [substance, setSubstance] = useState('');
  const [dose, setDose] = useState('');
  const [zone, setZone] = useState('glute_dorsal');
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [volumeMl, setVolumeMl] = useState('1');
  const [needleGauge, setNeedleGauge] = useState('23G');
  const [technique, setTechnique] = useState('im');
  const [painLevel, setPainLevel] = useState('0');
  const [pipLevel, setPipLevel] = useState('0');
  const [swelling, setSwelling] = useState('0');
  const [redness, setRedness] = useState(false);
  const [lump, setLump] = useState(false);
  const [bruise, setBruise] = useState(false);
  const [notes, setNotes] = useState('');
  const save = () => {
    if (!date || !substance.trim() || !dose.trim()) return;
    onSave({
      date,
      substance: substance.trim(),
      dose: dose.trim(),
      zone,
      side,
      volumeMl: Number(volumeMl) || 0,
      needleGauge,
      technique,
      painLevel: Number(painLevel) || 0,
      pipLevel: Number(pipLevel) || 0,
      swelling: Number(swelling) || 0,
      redness,
      lump,
      bruise,
      notes: notes.trim() || undefined,
    });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="💉 Добавить запись инъекции">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} />
      <input
        value={substance}
        onChange={(e) => setSubstance(e.target.value)}
        style={{ ...fieldInput, marginTop: 8 }}
        placeholder="Препарат"
      />
      <input
        value={dose}
        onChange={(e) => setDose(e.target.value)}
        style={{ ...fieldInput, marginTop: 8 }}
        placeholder="Доза"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <select value={zone} onChange={(e) => setZone(e.target.value)} style={fieldInput}>
          {INJECTION_ZONES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={side} onChange={(e) => setSide(e.target.value as 'left' | 'right')} style={fieldInput}>
          <option value="left">Левая сторона</option>
          <option value="right">Правая сторона</option>
        </select>
        <input
          type="number"
          step="0.1"
          min="0"
          value={volumeMl}
          onChange={(e) => setVolumeMl(e.target.value)}
          style={fieldInput}
          placeholder="Объём, мл"
        />
        <select value={needleGauge} onChange={(e) => setNeedleGauge(e.target.value)} style={fieldInput}>
          {NEEDLE_GAUGES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select value={technique} onChange={(e) => setTechnique(e.target.value)} style={fieldInput}>
          {TECHNIQUES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          max="10"
          value={painLevel}
          onChange={(e) => setPainLevel(e.target.value)}
          style={fieldInput}
          placeholder="Боль 0–10"
        />
        <input
          type="number"
          min="0"
          max="10"
          value={pipLevel}
          onChange={(e) => setPipLevel(e.target.value)}
          style={fieldInput}
          placeholder="PIP 0–10"
        />
        <input
          type="number"
          min="0"
          max="10"
          value={swelling}
          onChange={(e) => setSwelling(e.target.value)}
          style={fieldInput}
          placeholder="Отёк 0–10"
        />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {[
          [redness, setRedness, 'Покраснение'],
          [lump, setLump, 'Уплотнение'],
          [bruise, setBruise, 'Синяк'],
        ].map(([value, setter, label]) => (
          <label key={String(label)} style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(e.target.checked)}
            />{' '}
            {String(label)}
          </label>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...fieldInput, marginTop: 8 }}
        placeholder="Заметка"
      />
      <ActionRow onClose={onClose} onSave={save} color={colors.warning} />
    </Modal>
  );
};

export { AddHealthModal } from './health-diary-modal';
