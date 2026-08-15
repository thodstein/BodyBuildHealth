/**
 * pulse-diary-modal.tsx — модалка добавления записи ЧСС (утро/вечер).
 * Одна запись на (дата + время суток), умные дефолты из последней записи,
 * черновик в sessionStorage, stale-чип, баннер замены.
 */
import React, { useEffect, useMemo } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import {
  getHREntries,
  findByDateAndTimeOfDay,
  type HREntry,
} from '../../../engines/hr-diary.engine';
import {
  DiaryModalShell,
  SectionCard,
  StepperInput,
  TextField,
  FormBanner,
  fieldInput,
  lastEntryOf,
  useDiaryDraft,
  TodayChip,
  RepeatLastChip,
  daysSince,
} from './diary-modals';

export type HRTimeOfDay = 'morning' | 'evening';

interface HRDraft {
  date: string;
  timeOfDay: HRTimeOfDay;
  bpm: string;
  notes: string;
}

export const AddPulseModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: (e: any) => void;
  presetTimeOfDay?: HRTimeOfDay;
}> = ({ open, onClose, onSave, presetTimeOfDay }) => {
  const initial = (): HRDraft => {
    const last = lastEntryOf(getHREntries() as unknown as { date?: string; timestamp?: number }[]);
    const lastHr = last ? (last as unknown as HREntry) : null;
    return {
      date: todayIso(),
      timeOfDay: presetTimeOfDay || lastHr?.timeOfDay || 'morning',
      bpm: lastHr && typeof lastHr.bpm === 'number' ? String(lastHr.bpm) : '60',
      notes: '',
    };
  };
  const [draft, setDraft, resetDraft] = useDiaryDraft<HRDraft>('he_draft_hr', initial);
  // Пресет рутинга (утро/вечер) имеет приоритет над сохранённым черновиком.
  useEffect(() => {
    if (presetTimeOfDay) setDraft((p) => ({ ...p, timeOfDay: presetTimeOfDay }));
  }, [presetTimeOfDay, setDraft]);
  const lastRec = useMemo(() => lastEntryOf(getHREntries() as unknown as { date?: string; timestamp?: number }[]), [open]);
  const lastHr = lastRec ? (lastRec as unknown as HREntry) : null;

  const existing = useMemo(
    () => findByDateAndTimeOfDay(getHREntries(), draft.date, draft.timeOfDay),
    [open, draft.date, draft.timeOfDay],
  );

  const bpm = Number(draft.bpm);
  const bpmInvalid = !Number.isFinite(bpm) || bpm < 20 || bpm > 250;

  const set = (key: keyof HRDraft, val: string) => setDraft((p) => ({ ...p, [key]: val }));

  const save = () => {
    if (!draft.date || bpmInvalid) return;
    onSave({
      date: draft.date,
      timeOfDay: draft.timeOfDay,
      bpm,
      notes: draft.notes.trim() || undefined,
    });
    resetDraft();
    onClose();
  };

  const spark = useMemo(
    () => getHREntries().slice(-7).map((e) => (typeof e.bpm === 'number' ? e.bpm : null)),
    [open],
  );

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Запись ЧСС"
      icon="💓"
      color="#ec4899"
      subtitle="Пульс в покое — утром или вечером"
      onSubmit={save}
      spark={{ data: spark, color: '#ec4899' }}
      stale={lastHr ? { days: daysSince(lastHr.date) ?? 0 } : null}
      fill={{ current: (bpmInvalid ? 0 : 1) + (draft.timeOfDay ? 1 : 0), total: 2 }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <TextField label="Дата" value={draft.date} onChange={(v) => set('date', v)} type="date" />
        </div>
        <TodayChip date={draft.date} onToday={() => set('date', todayIso())} />
      </div>

      <SectionCard icon="🕐" title="Время суток" color="#ec4899">
        <div style={{ display: 'flex', gap: 6 }}>
          {(
            [
              ['morning', '🌅 Утро (в покое)'],
              ['evening', '🌆 Вечер (в покое)'],
            ] as const
          ).map(([k, l]) => (
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
                border: `1px solid ${draft.timeOfDay === k ? '#ec4899' : colors.border}`,
                background: draft.timeOfDay === k ? 'rgba(236,72,153,0.16)' : 'rgba(255,255,255,0.03)',
                color: draft.timeOfDay === k ? '#f472b6' : colors.textMuted,
                boxShadow: draft.timeOfDay === k ? '0 3px 12px rgba(236,72,153,0.25)' : undefined,
                transition: 'all 0.15s',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </SectionCard>

      {bpmInvalid && <FormBanner tone="error">ЧСС: число от 20 до 250 уд/мин</FormBanner>}
      {existing && (
        <FormBanner tone="warning">
          Запись за {existing.date} ({existing.timeOfDay === 'morning' ? 'утро' : 'вечер'}) уже есть: {existing.bpm} уд/мин — при сохранении будет заменена
        </FormBanner>
      )}

      <SectionCard icon="💓" title="Пульс в покое" color="#ec4899">
        <StepperInput value={draft.bpm} onChange={(v) => set('bpm', v)} step={1} min={20} max={250} unit="уд/мин" large invalid={bpmInvalid} />
        <div style={{ fontSize: 10.5, color: colors.textSubtle, marginTop: 6, textAlign: 'center' }}>
          Норма в покое: 60–90 уд/мин · у спортсменов 40–60
        </div>
      </SectionCard>

      <SectionCard icon="📝" title="Заметка" color="#ec4899">
        <textarea
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
          style={{ ...fieldInput, minHeight: 52, resize: 'vertical' }}
          placeholder="Самочувствие, тренировка вчера, кофеин…"
        />
      </SectionCard>

      {lastHr && (
        <div style={{ marginTop: 6 }}>
          <RepeatLastChip
            label={`Повторить последнее (${lastHr.date}: ${lastHr.bpm} уд/мин)`}
            onClick={() => setDraft((p) => ({ ...p, bpm: String(lastHr.bpm), timeOfDay: lastHr.timeOfDay }))}
          />
        </div>
      )}
    </DiaryModalShell>
  );
};
