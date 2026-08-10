/**
 * bp-diary-modal.tsx — модалка добавления записи давления.
 * Умные дефолты из последней записи, живая классификация АД,
 * спарклайн последних 7 записей, валидация кризов.
 */
import React, { useMemo } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import {
  DiaryModalShell,
  SectionCard,
  TextField,
  FormBanner,
  LiveBadge,
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
  if (s >= 180 || d >= 120) return BP_TONE.h3;
  if (s >= 160 || d >= 100) return BP_TONE.h2;
  if (s >= 140 || d >= 90) return BP_TONE.h1;
  if (s >= 130 || d >= 80) return BP_TONE.high;
  if (s >= 120 && d < 80) return BP_TONE.elevated;
  return BP_TONE.normal;
};

type BpRec = { date?: string; systolic?: number; diastolic?: number; pulse?: number; hr?: number; timeOfDay?: string };
interface BPDraft {
  date: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  timeOfDay: 'morning' | 'evening';
  notes: string;
}

export const AddBPModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const initial = (): BPDraft => {
    const last = lastEntryOf(readDiaryEntries<BpRec>('he_bp_diary'));
    const lastPulse = last?.pulse ?? last?.hr;
    return {
      date: todayIso(),
      systolic: last?.systolic ? String(last.systolic) : '120',
      diastolic: last?.diastolic ? String(last.diastolic) : '80',
      pulse: lastPulse && lastPulse > 0 ? String(lastPulse) : '70',
      timeOfDay: last?.timeOfDay === 'evening' ? 'evening' : 'morning',
      notes: '',
    };
  };
  const [draft, setDraft, resetDraft] = useDiaryDraft<BPDraft>('he_draft_bp', initial);
  const lastRec = useMemo(() => lastEntryOf(readDiaryEntries<BpRec>('he_bp_diary')), [open]);
  const set = (key: keyof BPDraft, val: string) => setDraft((p) => ({ ...p, [key]: val }));

  const s = Number(draft.systolic);
  const d = Number(draft.diastolic);
  const p = Number(draft.pulse);
  const sInvalid = !Number.isFinite(s) || s < 50 || s > 250;
  const dInvalid = !Number.isFinite(d) || d < 30 || d > 180 || (Number.isFinite(d) && Number.isFinite(s) && d >= s);
  const pInvalid = !Number.isFinite(p) || p < 20 || p > 250;
  const valid = !sInvalid && !dInvalid && !pInvalid;
  const dge = Number.isFinite(s) && Number.isFinite(d) && d >= s;
  const cat = bpCategory(s, d);

  const save = () => {
    if (!draft.date || !valid || dge) return;
    onSave({ date: draft.date, systolic: s, diastolic: d, hr: p, pulse: p, timeOfDay: draft.timeOfDay, notes: draft.notes.trim() || undefined });
    resetDraft();
    onClose();
  };

  const spark = useMemo(
    () => readDiaryEntries<{ systolic?: number }>('he_bp_diary').slice(-7).map((e) => (typeof e?.systolic === 'number' ? e.systolic : null)),
    [open],
  );

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Запись давления"
      icon="❤️"
      color="#ef4444"
      subtitle="Систола, диастола и пульс в покое"
      onSubmit={save}
      spark={{ data: spark, color: '#f87171' }}
      stale={lastRec ? { days: daysSince(lastRec.date) ?? 0 } : null}
      fill={{ current: (sInvalid ? 0 : 1) + (dInvalid ? 0 : 1) + (pInvalid ? 0 : 1), total: 3 }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <TextField label="Дата" value={draft.date} onChange={(v) => set('date', v)} type="date" />
        </div>
        <TodayChip date={draft.date} onToday={() => set('date', todayIso())} />
      </div>

      <SectionCard icon="🕐" title="Время измерения" color="#ef4444">
        <div style={{ display: 'flex', gap: 6 }}>
          {([['morning', '🌅 Утро'], ['evening', '🌙 Вечер']] as const).map(([k, l]) => (
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
      </SectionCard>

      {dge && <FormBanner tone="error">Диастола не может быть ≥ систолы ({d} ≥ {s}) — проверьте значения</FormBanner>}
      {!dge && !valid && (Number.isFinite(s) || Number.isFinite(d)) && (
        <FormBanner tone="error">Значения вне диапазона: систола 50–250, диастола 30–180, пульс 20–250</FormBanner>
      )}
      {valid && !dge && s >= 180 && <FormBanner tone="error">Систола ≥ 180 — гипертонический криз, обратитесь к врачу</FormBanner>}

      <SectionCard icon="🫀" title="Показатели" color="#ef4444" badge={cat.label}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <TextField label="Систола" value={draft.systolic} onChange={(v) => set('systolic', v)} type="number" min={50} max={250} unit="мм" accent="#ef4444" invalid={sInvalid} />
          <TextField label="Диастола" value={draft.diastolic} onChange={(v) => set('diastolic', v)} type="number" min={30} max={180} unit="мм" accent="#ef4444" invalid={dInvalid} />
          <TextField label="Пульс" value={draft.pulse} onChange={(v) => set('pulse', v)} type="number" min={20} max={250} unit="уд/мин" invalid={pInvalid} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <LiveBadge color={cat.color} icon="🩺">{cat.label}</LiveBadge>
        </div>
      </SectionCard>

      <SectionCard icon="📝" title="Заметка" color="#ef4444">
        <textarea
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
          style={{ ...fieldInput, minHeight: 52, resize: 'vertical' }}
          placeholder="Заметка (самочувствие, лекарства…)"
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
