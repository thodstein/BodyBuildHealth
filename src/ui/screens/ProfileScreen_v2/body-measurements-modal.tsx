/**
 * body-measurements-modal.tsx — модалка добавления веса и замеров тела.
 * Подсказки «было N», повтор прошлых замеров, фото до/после (сжатие),
 * спарклайн веса за 7 дней.
 */
import React, { useMemo } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import { getWeightLog } from '../../../engines/profile-store';
import {
  DiaryModalShell,
  SectionCard,
  TextField,
  StepperInput,
  FormBanner,
  fieldInput,
  fieldLabel,
  lastEntryOf,
  findByDate,
  useDiaryDraft,
  TodayChip,
  RepeatLastChip,
  daysSince,
} from './diary-modals';

/* ── Модалка веса и замеров ── */

const MEASURE_GROUPS: { title: string; icon: string; fields: { key: string; label: string; unit: string }[] }[] = [
  {
    title: 'Торс',
    icon: '👕',
    fields: [
      { key: 'waistCm', label: 'Талия', unit: 'см' },
      { key: 'chestCm', label: 'Грудь', unit: 'см' },
      { key: 'hipCm', label: 'Бёдра', unit: 'см' },
      { key: 'neckCm', label: 'Шея', unit: 'см' },
    ],
  },
  {
    title: 'Руки',
    icon: '💪',
    fields: [
      { key: 'bicepLeftCm', label: 'Бицепс L', unit: 'см' },
      { key: 'bicepRightCm', label: 'Бицепс R', unit: 'см' },
      { key: 'forearmCm', label: 'Предплечье', unit: 'см' },
    ],
  },
  {
    title: 'Ноги',
    icon: '🦵',
    fields: [
      { key: 'thighLeftCm', label: 'Бедро L', unit: 'см' },
      { key: 'thighRightCm', label: 'Бедро R', unit: 'см' },
      { key: 'calfLeftCm', label: 'Икра L', unit: 'см' },
      { key: 'calfRightCm', label: 'Икра R', unit: 'см' },
    ],
  },
  {
    title: 'Состав тела',
    icon: '🧬',
    fields: [
      { key: 'bodyFat', label: 'Жир', unit: '%' },
      { key: 'muscleMass', label: 'Мышцы', unit: 'кг' },
      { key: 'waterMass', label: 'Вода', unit: '%' },
    ],
  },
];

interface WeightDraft {
  date: string;
  values: Record<string, string>;
  notes: string;
  photos: string[];
}

export const AddBodyMeasurementsModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const initial = (): WeightDraft => {
    const last = lastEntryOf(getWeightLog() as { date?: string }[]);
    return {
      date: todayIso(),
      values: { weight: last && typeof (last as Record<string, unknown>).weight === 'number' ? String((last as Record<string, unknown>).weight) : '80' },
      notes: '',
      photos: [],
    };
  };
  const [draft, setDraft, resetDraft] = useDiaryDraft<WeightDraft>('he_draft_weight', initial);
  const MAX_PHOTOS = 5;
  const MAX_SIZE_MB = 2;

  const notify = (msg: string, type: 'success' | 'warning' | 'error' = 'warning') => {
    if (typeof (window as any).showToast === 'function') (window as any).showToast(msg, type);
  };

  const prev = useMemo(() => {
    try {
      const log = getWeightLog();
      if (!log.length) return null;
      const sorted = [...log].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return sorted[0] as unknown as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }, [open]);

  const weightNum = Number(draft.values.weight);
  const prevWeight = typeof prev?.weight === 'number' ? prev.weight : null;
  const weightDelta = Number.isFinite(weightNum) && prevWeight !== null ? weightNum - prevWeight : null;
  const weightInvalid = draft.values.weight === '' || !Number.isFinite(weightNum) || weightNum <= 0;

  const allMeasureFields = MEASURE_GROUPS.flatMap((g) => g.fields);
  const filledMeasures = allMeasureFields.filter((f) => {
    const v = draft.values[f.key];
    return v !== undefined && v !== '' && Number.isFinite(Number(v));
  }).length;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - draft.photos.length;
    if (remaining <= 0) {
      notify(`Максимум ${MAX_PHOTOS} фото на запись`);
      return;
    }
    const toProcess = files.slice(0, remaining);
    try {
      const compressed = await Promise.all(
        toProcess.map((file) => compressImage(file, 800, 0.7)),
      );
      setDraft((p) => ({ ...p, photos: [...p.photos, ...compressed].slice(0, MAX_PHOTOS) }));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Не удалось сжать фото');
    }
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setDraft((p) => ({ ...p, photos: p.photos.filter((_, i) => i !== index) }));
  };

  const setValue = (key: string, v: string) => setDraft((p) => ({ ...p, values: { ...p.values, [key]: v } }));

  const fillFromLast = () => {
    if (!prev) return;
    const values: Record<string, string> = {};
    for (const group of MEASURE_GROUPS) {
      for (const f of group.fields) {
        const v = prev[f.key];
        if (typeof v === 'number') values[f.key] = String(v);
      }
    }
    if (typeof prev.weight === 'number') values.weight = String(prev.weight);
    setDraft((p) => ({ ...p, values: { ...values } }));
  };

  const save = () => {
    if (!draft.date || weightInvalid) return;
    const entry: Record<string, unknown> = { date: draft.date, notes: draft.notes.trim() || undefined, photos: draft.photos.length ? draft.photos : undefined };
    for (const group of MEASURE_GROUPS) {
      for (const f of group.fields) {
        const v = draft.values[f.key];
        const n = Number(v);
        if (v !== undefined && v !== '' && Number.isFinite(n)) entry[f.key] = n;
      }
    }
    entry.weight = weightNum;
    onSave(entry);
    resetDraft();
    onClose();
  };

  const spark = useMemo(
    () => getWeightLog().slice(-7).map((e) => (typeof e.weight === 'number' ? e.weight : null)),
    [open],
  );

  const lastDate = prev?.date ? String(prev.date) : undefined;
  const existing = useMemo(
    () => findByDate(getWeightLog() as { date?: string }[], draft.date),
    [open, draft.date],
  );

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Вес и замеры тела"
      icon="⚖️"
      color="#22c55e"
      subtitle="Прошлые значения подсказывают, что измерять"
      width={460}
      onSubmit={save}
      spark={{ data: spark, color: '#22c55e' }}
      stale={lastDate ? { days: daysSince(lastDate) ?? 0 } : null}
      fill={{ current: (weightInvalid ? 0 : 1) + filledMeasures, total: 1 + allMeasureFields.length }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <TextField label="Дата" value={draft.date} onChange={(v) => setDraft((p) => ({ ...p, date: v }))} type="date" />
        </div>
        <TodayChip date={draft.date} onToday={() => setDraft((p) => ({ ...p, date: todayIso() }))} />
      </div>

      {weightInvalid && <FormBanner tone="error">Вес обязателен — введите число больше 0</FormBanner>}
      {existing && (
        <FormBanner tone="warning">
          Запись за {existing.date} уже есть: {typeof (existing as Record<string, unknown>).weight === 'number' ? `${(existing as Record<string, unknown>).weight} кг` : 'замеры'} — при сохранении будет заменена
        </FormBanner>
      )}

      {prev && (
        <div style={{ marginBottom: 10 }}>
          <RepeatLastChip label={`Повторить прошлые замеры (${String(prev.date || '')})`} onClick={fillFromLast} />
        </div>
      )}

      <SectionCard icon="⚖️" title="Вес" color="#22c55e" badge={weightDelta !== null ? `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} кг` : undefined}>
        <StepperInput value={draft.values.weight || ''} onChange={(v) => setValue('weight', v)} step={0.1} min={20} max={400} unit="кг" large invalid={weightInvalid} />
        {prevWeight !== null && (
          <div style={{ fontSize: 9, color: colors.textSubtle, marginTop: 6, textAlign: 'center' }}>
            Прошлый вес: {prevWeight} кг · {prev && prev.date ? String(prev.date) : ''}
          </div>
        )}
      </SectionCard>

      {MEASURE_GROUPS.map((g) => (
        <SectionCard key={g.title} icon={g.icon} title={g.title} color="#22c55e">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {g.fields.map((f) => {
              const prevVal = typeof prev?.[f.key] === 'number' ? prev[f.key] as number : null;
              return (
                <div key={f.key}>
                  <TextField
                    label={f.label}
                    value={draft.values[f.key] || ''}
                    onChange={(v) => setValue(f.key, v)}
                    type="number"
                    min={0}
                    step={0.1}
                    unit={f.unit}
                    hint={prevVal !== null ? `было ${prevVal}` : undefined}
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>
      ))}

      <SectionCard icon="📝" title="Заметка и фото" color="#22c55e">
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
          style={{ ...fieldInput, minHeight: 52, resize: 'vertical' }}
          placeholder="Заметка"
        />
        <div style={{ marginTop: 10 }}>
          <label style={fieldLabel}>📷 Фото ({draft.photos.length}/{MAX_PHOTOS}, до {MAX_SIZE_MB}Мб каждое)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            style={{ ...fieldInput, padding: '9px' }}
          />
          {draft.photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {draft.photos.map((src, i) => (
                <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: 3, right: 3, background: '#ef4444cc', color: '#fff',
                      border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </DiaryModalShell>
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
