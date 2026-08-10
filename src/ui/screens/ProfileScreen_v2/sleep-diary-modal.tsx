/**
 * sleep-diary-modal.tsx — модалка добавления записи сна.
 * Умные дефолты из последней записи, черновик в sessionStorage,
 * спарклайн последних 7 дней, живая валидация.
 */
import React, { useMemo } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import {
  DiaryModalShell,
  SectionCard,
  ScalePicker,
  TextField,
  StepperInput,
  FormBanner,
  fieldInput,
  readDiaryEntries,
  lastEntryOf,
  findByDate,
  useDiaryDraft,
  TodayChip,
  RepeatLastChip,
  daysSince,
} from './diary-modals';

const SLEEP_QUALITY_EMOJI = ['😖', '😞', '😐', '🙂', '😴'];
const SLEEP_QUALITY_LABEL = ['Плохо', 'Тяжело', 'Средне', 'Хорошо', 'Отлично'];

type SleepRec = { date?: string; bedtime?: string; wakeTime?: string; hours?: number; awakenings?: number; quality?: number };
interface SleepDraft {
  date: string;
  hours: string;
  quality: string;
  awakenings: string;
  bedtime: string;
  wakeTime: string;
  notes: string;
}

export const AddSleepModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const initial = (): SleepDraft => {
    const last = lastEntryOf(readDiaryEntries<SleepRec>('he_sleep_diary'));
    return {
      date: todayIso(),
      hours: last && typeof last.hours === 'number' ? String(last.hours) : '7.5',
      quality: '4',
      awakenings: last && typeof last.awakenings === 'number' ? String(last.awakenings) : '1',
      bedtime: last?.bedtime || '23:00',
      wakeTime: last?.wakeTime || '07:00',
      notes: '',
    };
  };
  const [draft, setDraft, resetDraft] = useDiaryDraft<SleepDraft>('he_draft_sleep', initial);
  const lastRec = useMemo(() => lastEntryOf(readDiaryEntries<SleepRec>('he_sleep_diary')), [open]);
  const existing = useMemo(
    () => findByDate(readDiaryEntries<SleepRec>('he_sleep_diary'), draft.date),
    [open, draft.date],
  );
  const set = (key: keyof SleepDraft, val: string) => setDraft((p) => ({ ...p, [key]: val }));

  const h = Number(draft.hours);
  const q = Number(draft.quality);
  const hoursInvalid = !Number.isFinite(h) || h < 0 || h > 24;
  const qualityInvalid = !Number.isFinite(q) || q < 1 || q > 5;
  const aw = Number(draft.awakenings);
  const awakeningsInvalid = draft.awakenings.trim() !== '' && (!Number.isFinite(aw) || aw < 0 || aw > 20);
  const coherenceWarn = !hoursInvalid && !qualityInvalid && h >= 8 && q <= 2;

  const save = () => {
    if (!draft.date || hoursInvalid || qualityInvalid) return;
    onSave({
      date: draft.date,
      hours: h,
      quality: q,
      awakenings: Number.isFinite(Number(draft.awakenings)) ? Number(draft.awakenings) : 0,
      bedtime: draft.bedtime,
      wakeTime: draft.wakeTime,
      notes: draft.notes.trim() || undefined,
    });
    resetDraft();
    onClose();
  };

  const spark = useMemo(
    () => readDiaryEntries<{ hours?: number }>('he_sleep_diary').slice(-7).map((e) => (typeof e?.hours === 'number' ? e.hours : null)),
    [open],
  );

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Запись сна"
      icon="💤"
      color="#a78bfa"
      subtitle="Продолжительность, качество и режим за ночь"
      onSubmit={save}
      spark={{ data: spark, color: '#a78bfa' }}
      stale={lastRec ? { days: daysSince(lastRec.date) ?? 0 } : null}
      fill={{
        current: (!hoursInvalid ? 1 : 0) + (!qualityInvalid ? 1 : 0) + (!awakeningsInvalid ? 1 : 0) + (draft.bedtime ? 1 : 0) + (draft.wakeTime ? 1 : 0),
        total: 5,
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <TextField label="Дата" value={draft.date} onChange={(v) => set('date', v)} type="date" />
        </div>
        <TodayChip date={draft.date} onToday={() => set('date', todayIso())} />
      </div>

      {hoursInvalid && <FormBanner tone="error">Часы сна: число от 0 до 24</FormBanner>}
      {!hoursInvalid && qualityInvalid && <FormBanner tone="error">Качество: оценка от 1 до 5</FormBanner>}
      {coherenceWarn && (
        <FormBanner tone="warning">8+ часов сна с качеством «{SLEEP_QUALITY_LABEL[q - 1]}» — проверьте ввод (или зафиксируйте как есть)</FormBanner>
      )}
      {existing && (
        <FormBanner tone="warning">
          Запись за {existing.date} уже есть: {typeof existing.hours === 'number' ? `${existing.hours} ч` : 'данные'}
          {typeof existing.quality === 'number' ? ` · качество ${SLEEP_QUALITY_LABEL[existing.quality - 1] || '—'}` : ''} — при сохранении будет заменена
        </FormBanner>
      )}

      <SectionCard icon="⏰" title="Продолжительность" color="#a78bfa">
        <StepperInput value={draft.hours} onChange={(v) => set('hours', v)} step={0.5} min={0} max={24} unit="ч" large invalid={hoursInvalid} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
          <TextField label="Лёг спать" value={draft.bedtime} onChange={(v) => set('bedtime', v)} type="time" />
          <TextField label="Встал" value={draft.wakeTime} onChange={(v) => set('wakeTime', v)} type="time" />
        </div>
      </SectionCard>

      <SectionCard icon="🌙" title="Качество" color="#a78bfa" badge={q >= 1 && q <= 5 ? SLEEP_QUALITY_LABEL[q - 1] : undefined}>
        <ScalePicker
          value={q >= 1 && q <= 5 ? q : 4}
          onChange={(v) => set('quality', String(v))}
          min={1}
          max={5}
          labels={(v) => `${SLEEP_QUALITY_EMOJI[v - 1]}`}
          toneFn={(v) => (v >= 4 ? '#22c55e' : v === 3 ? '#f59e0b' : v === 2 ? '#f97316' : '#ef4444')}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: 10.5, color: colors.textSubtle }}>1 — не выспался</span>
          <span style={{ fontSize: 10.5, color: colors.textSubtle }}>5 — полный отдых</span>
        </div>
      </SectionCard>

      <SectionCard icon="📝" title="Пробуждения и заметки" color="#a78bfa">
        <TextField
          label="Пробуждений за ночь"
          value={draft.awakenings}
          onChange={(v) => set('awakenings', v)}
          type="number"
          min={0}
          max={20}
          step={1}
          invalid={awakeningsInvalid}
        />
        <textarea
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
          style={{ ...fieldInput, minHeight: 52, resize: 'vertical', marginTop: 10 }}
          placeholder="Заметка (храп, сновидения, факторы…)"
        />
      </SectionCard>

      {lastRec && (
        <div style={{ marginTop: 6 }}>
          <RepeatLastChip label={`Повторить режим прошлой записи (${lastRec.date})`} onClick={() => setDraft((p) => ({ ...p, bedtime: lastRec.bedtime || p.bedtime, wakeTime: lastRec.wakeTime || p.wakeTime }))} />
        </div>
      )}
    </DiaryModalShell>
  );
};
