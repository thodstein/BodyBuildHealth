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
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Часы сна</span>
          <input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} style={fieldInput} placeholder="7.5" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Качество (1-5)</span>
          <input type="number" min="1" max="5" value={quality} onChange={(e) => setQuality(e.target.value)} style={fieldInput} placeholder="4" />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Пробуждений</span>
          <input type="number" value={awakenings} onChange={(e) => setAwakenings(e.target.value)} style={fieldInput} placeholder="1" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Лёг спать</span>
          <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} style={fieldInput} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Встал</span>
          <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} style={fieldInput} />
        </label>
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
    [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening'>('morning'),
    [notes, setNotes] = useState('');
  const save = () => {
    const s = Number(systolic),
      d = Number(diastolic),
      p = Number(pulse);
    if (!date || ![s, d, p].every(Number.isFinite) || s < 50 || s > 250 || d < 30 || d > 180 || p < 20 || p > 250 || d >= s) return;
    onSave({ date, systolic: s, diastolic: d, hr: p, pulse: p, timeOfDay, notes: notes.trim() || undefined });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="❤️ Добавить запись АД">
      <label style={fieldLabel}>Дата</label>
      <DateInput value={date} onChange={setDate} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 8 }}>
        {([['morning', '🌅 Утро'], ['evening', '🌙 Вечер']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTimeOfDay(k)} style={{
            flex: 1, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            border: timeOfDay === k ? '1px solid #ef444488' : '1px solid #3f3f46',
            background: timeOfDay === k ? '#ef444422' : '#18181b',
            color: timeOfDay === k ? '#f87171' : '#71717a',
          }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {([
          ['Систола (мм рт.ст.)', systolic, setSystolic],
          ['Диастола (мм рт.ст.)', diastolic, setDiastolic],
          ['ЧСС (уд/мин)', pulse, setPulse],
        ] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, value, setter]) => (
          <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: '#a1a1aa' }}>{label}</span>
            <input type="number" value={value} onChange={(e) => setter(e.target.value)} style={fieldInput} />
          </label>
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
  const FIELD_RU: Record<string, string> = {
    weight: 'Вес (кг)',
    waistCm: 'Талия (см)',
    chestCm: 'Грудь (см)',
    hipCm: 'Бёдра (см)',
    bicepCm: 'Бицепс (см)',
    bicepLeftCm: 'Бицепс L (см)',
    bicepRightCm: 'Бицепс R (см)',
    thighCm: 'Бедро (см)',
    thighLeftCm: 'Бедро L (см)',
    thighRightCm: 'Бедро R (см)',
    calfCm: 'Икры (см)',
    calfLeftCm: 'Икра L (см)',
    calfRightCm: 'Икра R (см)',
    neckCm: 'Шея (см)',
    forearmCm: 'Предплечье (см)',
    bodyFat: '% жира',
    muscleMass: 'Мышцы (кг)',
    waterMass: 'Вода (%)',
  };
  const fields = Object.keys(FIELD_RU);
  const [values, setValues] = useState<Record<string, string>>({ weight: '80' });
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const MAX_PHOTOS = 5;
  const MAX_SIZE_MB = 2;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      alert(`Максимум ${MAX_PHOTOS} фото на запись`);
      return;
    }
    const toProcess = files.slice(0, remaining);
    const compressed = await Promise.all(
      toProcess.map(file => compressImage(file, 800, 0.7))
    );
    setPhotos(prev => [...prev, ...compressed].slice(0, MAX_PHOTOS));
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const save = () => {
    if (!date) return;
    const entry: Record<string, unknown> = { date, notes: notes.trim() || undefined, photos: photos.length ? photos : undefined };
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
          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: '#a1a1aa' }}>{FIELD_RU[key]}</span>
            <input
              type="number"
              step="0.1"
              value={values[key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              style={fieldInput}
              placeholder={FIELD_RU[key]}
            />
          </label>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...fieldInput, marginTop: 8 }}
        placeholder="Заметка"
      />
      <div style={{ marginTop: 10 }}>
        <label style={fieldLabel}>📷 Фото ({photos.length}/{MAX_PHOTOS}, до {MAX_SIZE_MB}Мб каждое)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          style={{ ...fieldInput, padding: '8px' }}
        />
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {photos.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #3f3f46' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => removePhoto(i)}
                  style={{
                    position: 'absolute', top: 2, right: 2, background: '#ef4444cc', color: '#fff',
                    border: 'none', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontSize: 12,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <ActionRow onClose={onClose} onSave={save} color={colors.green} />
    </Modal>
  );
};

const compressImage = (file: File, maxDim = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error(`Файл ${file.name} > 2Мб`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
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
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: '#a1a1aa' }}>Препарат</span>
        <input value={substance} onChange={(e) => setSubstance(e.target.value)} style={fieldInput} placeholder="Тестостерон энантат" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: '#a1a1aa' }}>Доза</span>
        <input value={dose} onChange={(e) => setDose(e.target.value)} style={fieldInput} placeholder="250 мг / 1 мл / 100 IU" />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Зона</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)} style={fieldInput}>
            {INJECTION_ZONES.map((item) => (<option key={item.id} value={item.id}>{item.label}</option>))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Сторона</span>
          <select value={side} onChange={(e) => setSide(e.target.value as 'left' | 'right')} style={fieldInput}>
            <option value="left">Левая сторона</option>
            <option value="right">Правая сторона</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Объём (мл)</span>
          <input type="number" step="0.1" min="0" value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)} style={fieldInput} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Игла</span>
          <select value={needleGauge} onChange={(e) => setNeedleGauge(e.target.value)} style={fieldInput}>
            {NEEDLE_GAUGES.map((g) => (<option key={g}>{g}</option>))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Техника</span>
          <select value={technique} onChange={(e) => setTechnique(e.target.value)} style={fieldInput}>
            {TECHNIQUES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Боль (0–10)</span>
          <input type="number" min="0" max="10" value={painLevel} onChange={(e) => setPainLevel(e.target.value)} style={fieldInput} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>PIP (0–10)</span>
          <input type="number" min="0" max="10" value={pipLevel} onChange={(e) => setPipLevel(e.target.value)} style={fieldInput} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>Отёк (0–10)</span>
          <input type="number" min="0" max="10" value={swelling} onChange={(e) => setSwelling(e.target.value)} style={fieldInput} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {([
          [redness, setRedness, 'Покраснение'],
          [lump, setLump, 'Уплотнение'],
          [bruise, setBruise, 'Синяк'],
        ] as [boolean, React.Dispatch<React.SetStateAction<boolean>>, string][]).map(([value, setter, label]) => (
          <label key={label} style={{ fontSize: 12 }}>
            <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} /> {label}
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
