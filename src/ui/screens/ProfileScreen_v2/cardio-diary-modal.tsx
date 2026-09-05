/**
 * cardio-diary-modal.tsx — быстрая модалка добавления кардио-сессии.
 * Аналог AddSleepModal / AddBPModal для встроенного добавления в Профиле.
 */
import React, { useMemo, useState } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import { loadCardioLog } from '../../../engines/lms/cardio-diary.engine';
import {
  DiaryModalShell,
  SectionCard,
  TextField,
  FormBanner,
  fieldInput,
  fieldLabel,
  btnPrimary,
  btnGhost,
  useDiaryDraft,
  TodayChip,
  lastEntryOf,
  findByDate,
  daysSince,
} from './diary-modals';
import { validateCardioLogFields } from '../../../engines/lms/cardio-diary.engine';

const CARDIO_TYPES = [
  { id: 'zone2', label: 'Zone 2', color: '#4ade80' },
  { id: 'miss', label: 'MISS', color: '#60a5fa' },
  { id: 'hiit', label: 'HIIT', color: '#a78bfa' },
  { id: 'recovery', label: 'Recovery', color: '#94a3b8' },
] as const;

const CARDIO_DRAFT_KEY = 'he_draft_cardio';

type CardioDraft = {
  date: string;
  type: string;
  durationMin: string;
  rpe: string;
  hr: string;
  km: string;
  notes: string;
};

interface AddCardioModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: any) => void;
}

const initialDraft = (): CardioDraft => {
  const last = lastEntryOf(loadCardioLog() as { date?: string; type?: string; durationMin?: number; rpe?: number; avgHr?: number; distanceKm?: number }[]);
  return {
    date: todayIso(),
    type: last?.type || 'zone2',
    durationMin: last && typeof last.durationMin === 'number' ? String(last.durationMin) : '30',
    rpe: last && typeof last.rpe === 'number' ? String(last.rpe) : '',
    hr: last && typeof last.avgHr === 'number' ? String(last.avgHr) : '',
    km: last && typeof last.distanceKm === 'number' ? String(last.distanceKm) : '',
    notes: '',
  };
};

export const AddCardioModal: React.FC<AddCardioModalProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [draft, setDraft, resetDraft] = useDiaryDraft<CardioDraft>(CARDIO_DRAFT_KEY, initialDraft);
  const [error, setError] = useState<string | null>(null);

  const prev = useMemo(() => {
    try {
      const log = (() => {
        const raw = localStorage.getItem('he_cardio_sessions');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      })();
      if (!log.length) return null;
      const sorted = [...log].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return sorted[0] as any;
    } catch {
      return null;
    }
  }, [open]);

  const existing = useMemo(
    () => {
      const raw = localStorage.getItem('he_cardio_sessions');
      if (!raw) return null;
      const log = JSON.parse(raw);
      if (!Array.isArray(log)) return null;
      return log.find((e: any) => e.date === draft.date);
    },
    [draft.date],
  );

  const warnings = useMemo(() => validateCardioLogFields({ rpe: draft.rpe, hr: draft.hr, km: draft.km, minutes: draft.durationMin }), [draft.rpe, draft.hr, draft.km, draft.durationMin]);
  const hasWarnings = Object.keys(warnings).length > 0;

  const handleSave = () => {
    const dur = Math.max(5, Math.min(180, Number(draft.durationMin) || 30));
    const entry = {
      date: draft.date,
      type: draft.type,
      durationMin: dur,
      rpe: Number(draft.rpe) > 0 ? Number(draft.rpe) : undefined,
      avgHr: Number(draft.hr) > 0 ? Number(draft.hr) : undefined,
      distanceKm: Number(draft.km) > 0 ? Math.round(Number(draft.km) * 10) / 10 : undefined,
      completed: true,
      notes: draft.notes?.trim() || undefined,
    };
    onSave(entry);
    resetDraft();
    onClose();
  };

  const lastDate = prev?.date ? String(prev.date) : undefined;
  const hasAnyData = draft.type && draft.durationMin;

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Кардио-сессия"
      icon="🏃"
      color="#4ade80"
      subtitle={existing ? `Запись за ${existing.date} будет заменена` : 'Тип, минуты, ЧСС, RPE, км'}
      width={420}
      onSubmit={handleSave}
      fill={{ current: (draft.type && draft.durationMin ? 2 : 0) + (draft.rpe ? 1 : 0) + (draft.hr ? 1 : 0) + (draft.km ? 1 : 0), total: 5 }}
    >
      {hasWarnings && <FormBanner tone="warning">{Object.values(warnings).join(' · ')}</FormBanner>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8, marginBottom: 8 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
          Дата
          <input style={{ ...fieldInput, width: '100%' }} type="date" value={draft.date} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
          Тип
          <select style={{ ...fieldInput, width: '100%' }} value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}>
            {CARDIO_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 8 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
          Минуты
          <input style={{ ...fieldInput, width: '100%' }} type="number" min="1" max="300" value={draft.durationMin} onChange={(e) => setDraft((p) => ({ ...p, durationMin: e.target.value }))} placeholder="30" />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
          RPE (1–10)
          <input style={{ ...fieldInput, width: '100%' }} type="number" min="1" max="10" value={draft.rpe} onChange={(e) => setDraft((p) => ({ ...p, rpe: e.target.value }))} placeholder="7" />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
          ЧСС
          <input style={{ ...fieldInput, width: '100%' }} type="number" min="50" max="220" value={draft.hr} onChange={(e) => setDraft((p) => ({ ...p, hr: e.target.value }))} placeholder="140" />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
          Км
          <input style={{ ...fieldInput, width: '100%' }} type="number" step="0.1" min="0" max="100" value={draft.km} onChange={(e) => setDraft((p) => ({ ...p, km: e.target.value }))} placeholder="5" />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 4, fontSize: 11, color: colors.textMuted, fontWeight: 600, marginTop: 4 }}>
        Заметка
        <textarea style={{ ...fieldInput, width: '100%', minHeight: 50, resize: 'vertical' }} value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Ощущения, маршрут, темп..." />
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="submit" style={{ ...btnPrimary('#4ade80'), flex: 1 }}>Сохранить</button>
        <button type="button" onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Отмена</button>
      </div>
    </DiaryModalShell>
  );
};
