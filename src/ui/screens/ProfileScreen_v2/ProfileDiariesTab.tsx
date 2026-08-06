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

/* ── Карточка дневника ── */

interface BuiltInDiary {
  key: 'sleep' | 'bp' | 'weight' | 'measurements' | 'injection';
  icon: string;
  title: string;
  color: string;
  count: number;
  last: string;
  unit?: string;
}

const DiaryCard: React.FC<{
  diary: BuiltInDiary;
  onAdd: () => void;
  onOpen: () => void;
}> = ({ diary, onAdd, onOpen }) => (
  <div
    style={{
      background: 'rgba(28,28,32,0.65)',
      border: `1px solid ${diary.color}33`,
      borderRadius: 12, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{diary.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{diary.title}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: diary.color, marginLeft: 'auto',
        background: `${diary.color}22`, padding: '1px 6px', borderRadius: 4,
      }}>{diary.count}</span>
    </div>
    <div style={{ fontSize: 10, color: colors.textMuted, minHeight: 14 }}>
      {diary.last ? `Последняя: ${diary.last}${diary.unit ? ' ' + diary.unit : ''}` : 'Нет записей'}
    </div>
    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
      <button
        onClick={onAdd}
        aria-label={`Добавить запись в дневник ${diary.title}`}
        style={{
          flex: 1, minHeight: 32, padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: `${diary.color}22`, color: diary.color, border: `1px solid ${diary.color}44`,
          cursor: 'pointer',
        }}
      >+ Добавить</button>
      <button
        onClick={onOpen}
        aria-label={`Открыть дневник ${diary.title}`}
        style={{
          flex: 1, minHeight: 32, padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`,
          cursor: 'pointer',
        }}
      >📋 Открыть</button>
    </div>
  </div>
);

/* ── Быстрые ссылки на дневники в других блоках ── */

interface QuickLink { icon: string; label: string; target: string; color: string; }

const QUICK_DIARY_LINKS: QuickLink[] = [
  { icon: '🍽', label: 'Дневник питания', target: 'nutrition-diary', color: colors.green },
  { icon: '🏋️', label: 'Журнал тренировок', target: 'workout-log', color: colors.blue },
  { icon: '💊', label: 'Мой курс', target: 'pharma-course', color: colors.warning },
  { icon: '🛡', label: 'Дневник поддержки', target: 'support-diary', color: colors.purple },
  { icon: '🩺', label: 'Симптомы', target: 'symptoms', color: colors.pink },
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

export const ProfileDiariesTab: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [bpEntries, setBpEntries] = useState<BPEntry[]>([]);
  const [injectionEntries, setInjectionEntries] = useState<InjectionEntry[]>([]);
  const [measurements, setMeasurements] = useState<ReturnType<typeof getMeasurementsLog>>([]);
  const [weights, setWeights] = useState<ReturnType<typeof getWeightLog>>([]);

  const [addSleepOpen, setAddSleepOpen] = useState(false);
  const [addBPOpen, setAddBPOpen] = useState(false);
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  const [addMeasurementsOpen, setAddMeasurementsOpen] = useState(false);
  const [addInjectionOpen, setAddInjectionOpen] = useState(false);

  const refresh = () => {
    try { setSleepEntries(loadDiary<SleepEntry>(SLEEP_DIARY_KEY)); } catch {}
    try { setBpEntries(loadDiary<BPEntry>(BP_DIARY_KEY)); } catch {}
    try { setInjectionEntries(loadDiary<InjectionEntry>(INJECTION_DIARY_KEY)); } catch {}
    try { setMeasurements(getMeasurementsLog()); } catch {}
    try { setWeights(getWeightLog()); } catch {}
  };

  useEffect(() => { refresh(); }, []);

  const lastDate = (arr: { date: string }[]): string => {
    if (arr.length === 0) return '';
    return arr[arr.length - 1].date;
  };

  const builtInDiaries: BuiltInDiary[] = [
    { key: 'sleep', icon: '💤', title: 'Сон', color: colors.purple, count: sleepEntries.length, last: lastDate(sleepEntries), unit: 'ч' },
    { key: 'bp', icon: '❤️', title: 'Давление', color: colors.danger, count: bpEntries.length, last: bpEntries.length ? `${bpEntries[bpEntries.length - 1].systolic}/${bpEntries[bpEntries.length - 1].diastolic}` : '' },
    { key: 'weight', icon: '⚖️', title: 'Вес', color: colors.green, count: weights.length, last: lastDate(weights), unit: 'кг' },
    { key: 'measurements', icon: '📏', title: 'Замеры тела', color: colors.blue, count: measurements.length, last: lastDate(measurements) },
    { key: 'injection', icon: '💉', title: 'Инъекции', color: colors.warning, count: injectionEntries.length, last: lastDate(injectionEntries) },
  ];

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
              diary={d}
              onAdd={() => {
                if (d.key === 'sleep') setAddSleepOpen(true);
                else if (d.key === 'bp') setAddBPOpen(true);
                else if (d.key === 'weight') setAddWeightOpen(true);
                else if (d.key === 'measurements') setAddMeasurementsOpen(true);
                else if (d.key === 'injection') setAddInjectionOpen(true);
              }}
              onOpen={() => {
                if (d.key === 'sleep' || d.key === 'bp' || d.key === 'weight' || d.key === 'measurements') {
                  onNavigate?.(`profile-diary-${d.key}`);
                } else if (d.key === 'injection') {
                  onNavigate?.('pharma-course');
                }
              }}
            />
          ))}
        </div>
      </AccordionSection>

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
    </div>
  );
};
