/**
 * injection-diary-modal.tsx — модалка добавления записи инъекции.
 * Ассистент ротации зон (самая давно использованная), память дозы по препарату,
 * чипы последних препаратов, шкалы боли/PIP/отёка.
 */
import React, { useMemo } from 'react';
import { colors, BoolChip } from './ui';
import { NativeIcon } from '../../native/NativeIcons';
import { todayIso } from './diary-helpers';
import {
  INJECTION_ZONES,
  NEEDLE_GAUGES,
  TECHNIQUES,
  getSuggestedZoneSide,
  getZoneCompatibilityIssues,
} from '../../../engines/injection-diary.engine';
import {
  DiaryModalShell,
  SectionCard,
  ScalePicker,
  TextField,
  FormBanner,
  btnGhost,
  btnPrimary,
  fieldInput,
  readDiaryEntries,
  lastEntryOf,
  findByDateAndSubstance,
  useDiaryDraft,
  TodayChip,
  RepeatLastChip,
  daysSince,
} from './diary-modals';

/* ── Модалка инъекции ── */

const COMMON_INJECTIONS = [
  'Тестостерон энантат',
  'Тестостерон пропионат',
  'Сустанон-250',
  'Нандролон деканоат',
  'Тренболон ацетат',
  'Станазолол',
  'Мастерон',
  'Примоболан',
  'GH (соматропин)',
  'IGF-1',
];

const REACTION_KEYS = ['redness', 'lump', 'bruise', 'fever'] as const;
const REACTION_LABELS: Record<string, string> = {
  redness: 'Покраснение',
  lump: 'Уплотнение',
  bruise: 'Синяк',
  fever: 'Температура',
};

type InjRec = { date?: string; zone?: string; side?: string; substance?: string; dose?: string | number; [k: string]: unknown };
interface InjectionDraft {
  date: string;
  substance: string;
  dose: string;
  zone: string;
  side: 'left' | 'right';
  volumeMl: string;
  needleGauge: string;
  technique: string;
  painLevel: string;
  pipLevel: string;
  swelling: string;
  reactions: Record<string, boolean>;
  notes: string;
}

export const AddInjectionModal: React.FC<{ open: boolean; onClose: () => void; onSave: (e: any) => void }> = ({
  open,
  onClose,
  onSave,
}) => {
  const initial = (): InjectionDraft => {
    const last = lastEntryOf(readDiaryEntries<InjRec>('he_injection_diary'));
    const lastSide = last?.side === 'right' ? 'right' as const : 'left' as const;
    return {
      date: todayIso(),
      substance: '',
      dose: '',
      zone: typeof last?.zone === 'string' ? last.zone : 'glute_dorsal',
      side: lastSide === 'left' ? 'right' : 'left',
      volumeMl: '1',
      needleGauge: '23G',
      technique: 'im',
      painLevel: '0',
      pipLevel: '0',
      swelling: '0',
      reactions: { redness: false, lump: false, bruise: false, fever: false },
      notes: '',
    };
  };
  const [draft, setDraft, resetDraft] = useDiaryDraft<InjectionDraft>('he_draft_injection', initial);

  const allInjections = useMemo(() => readDiaryEntries<InjRec>('he_injection_diary'), [open]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of allInjections) {
      const s = typeof e?.substance === 'string' ? e.substance.trim() : '';
      if (s && !seen.has(s)) { seen.add(s); out.push(s); }
    }
    return out.slice(0, 8);
  }, [allInjections]);
  const lastRec = useMemo(() => lastEntryOf(allInjections), [allInjections]);

  const rotation = useMemo(
    () => getSuggestedZoneSide(allInjections as any[]),
    [allInjections],
  );

  const compatIssues = useMemo(
    () => getZoneCompatibilityIssues(draft.zone, draft.technique, Number(draft.volumeMl) || 0),
    [draft.zone, draft.technique, draft.volumeMl],
  );

  const lastDoseFor = (sub: string): string => {
    const e = lastEntryOf(allInjections.filter((x) => String(x?.substance || '').toLowerCase() === sub.toLowerCase()));
    const d = e?.dose;
    return d !== undefined && d !== null && d !== '' ? String(d) : '';
  };

  const setSubstanceSmart = (s: string) => {
    setDraft((p) => ({ ...p, substance: s, dose: p.dose ? p.dose : lastDoseFor(s) }));
  };

  const fillFromLast = () => {
    if (!lastRec) return;
    const side = lastRec.side === 'right' ? 'right' as const : 'left' as const;
    setDraft((p) => ({
      ...p,
      substance: typeof lastRec.substance === 'string' ? lastRec.substance : p.substance,
      dose: lastRec.dose !== undefined && lastRec.dose !== null && lastRec.dose !== '' ? String(lastRec.dose) : p.dose,
      zone: typeof lastRec.zone === 'string' ? lastRec.zone : p.zone,
      side,
      volumeMl: typeof lastRec.volumeMl === 'number' ? String(lastRec.volumeMl) : p.volumeMl,
      needleGauge: typeof lastRec.needleGauge === 'string' ? lastRec.needleGauge : p.needleGauge,
      technique: typeof lastRec.technique === 'string' ? lastRec.technique : p.technique,
    }));
  };

  const substanceInvalid = !draft.substance.trim();
  const doseInvalid = !draft.dose.trim();

  const save = () => {
    if (!draft.date || substanceInvalid || doseInvalid) return;
    onSave({
      date: draft.date,
      substance: draft.substance.trim(),
      dose: draft.dose.trim(),
      zone: draft.zone,
      side: draft.side,
      volumeMl: Number(draft.volumeMl) || 0,
      needleGauge: draft.needleGauge,
      technique: draft.technique,
      painLevel: Number(draft.painLevel) || 0,
      pipLevel: Number(draft.pipLevel) || 0,
      swelling: Number(draft.swelling) || 0,
      redness: !!draft.reactions.redness,
      lump: !!draft.reactions.lump,
      bruise: !!draft.reactions.bruise,
      fever: !!draft.reactions.fever,
      notes: draft.notes.trim() || undefined,
    });
    resetDraft();
    onClose();
  };

  const saveAndContinue = () => {
    if (!draft.date || substanceInvalid || doseInvalid) return;
    onSave({
      date: draft.date,
      substance: draft.substance.trim(),
      dose: draft.dose.trim(),
      zone: draft.zone,
      side: draft.side,
      volumeMl: Number(draft.volumeMl) || 0,
      needleGauge: draft.needleGauge,
      technique: draft.technique,
      painLevel: Number(draft.painLevel) || 0,
      pipLevel: Number(draft.pipLevel) || 0,
      swelling: Number(draft.swelling) || 0,
      redness: !!draft.reactions.redness,
      lump: !!draft.reactions.lump,
      bruise: !!draft.reactions.bruise,
      fever: !!draft.reactions.fever,
      notes: draft.notes.trim() || undefined,
    });
    resetDraft();
  };

  const setScale = (key: 'painLevel' | 'pipLevel' | 'swelling') => (v: number) =>
    setDraft((p) => ({ ...p, [key]: String(v) }));

  const zoneLabel = (id: string) => INJECTION_ZONES.find((z) => z.id === id)?.label || id;

  const existing = useMemo(
    () => findByDateAndSubstance<InjRec>(readDiaryEntries<InjRec>('he_injection_diary'), draft.date, draft.substance),
    [open, draft.date, draft.substance],
  );

  const spark = useMemo(
    () => allInjections.slice(-7).map((e) => (typeof e?.painLevel === 'number' ? e.painLevel : null)),
    [allInjections],
  );

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Запись инъекции"
      icon={<NativeIcon name="syringe" size={28} />}
      color="#f59e0b"
      subtitle="Препарат, доза и реакция места укола"
      width={460}
      onSubmit={save}
      fill={{ current: 5 + (substanceInvalid ? 0 : 1) + (doseInvalid ? 0 : 1), total: 7 }}
      spark={{ data: spark, color: '#fbbf24' }}
      stale={lastRec ? { days: daysSince(lastRec.date) ?? 0 } : null}
      footer={
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px 20px', borderTop: '1px solid rgba(245,158,11,0.14)', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          <div
            title={`Заполнено ${5 + (substanceInvalid ? 0 : 1) + (doseInvalid ? 0 : 1)}/7`}
            style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, marginRight: 4 }}
          >
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, ((5 + (substanceInvalid ? 0 : 1) + (doseInvalid ? 0 : 1)) / 7) * 100)}%`,
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, rgba(245,158,11,0.53), #f59e0b)',
                  transition: 'width 0.35s cubic-bezier(0.32, 0.72, 0.28, 1)',
                }}
              />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted, whiteSpace: 'nowrap' }}>
              {5 + (substanceInvalid ? 0 : 1) + (doseInvalid ? 0 : 1)}/7
            </span>
          </div>
          <button type="button" className="dm-ghost-btn" onClick={onClose} style={btnGhost}>
            Отмена
          </button>
          <button
            type="button"
            className="dm-ghost-btn"
            onClick={saveAndContinue}
            disabled={substanceInvalid || doseInvalid || !draft.date}
            style={{ ...btnGhost, flex: 1.2, opacity: substanceInvalid || doseInvalid || !draft.date ? 0.5 : 1 }}
          >
            💾 Сохранить и ещё
          </button>
          <button type="submit" className="dm-primary-btn" style={btnPrimary('#f59e0b')}>
            Сохранить →
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <TextField label="Дата" value={draft.date} onChange={(v) => setDraft((p) => ({ ...p, date: v }))} type="date" />
        </div>
        <TodayChip date={draft.date} onToday={() => setDraft((p) => ({ ...p, date: todayIso() }))} />
      </div>

      {substanceInvalid && <FormBanner tone="error">Укажите препарат (подсказки ниже)</FormBanner>}
      {!substanceInvalid && doseInvalid && <FormBanner tone="error">Укажите дозу (например, «250 мг»)</FormBanner>}
      {existing && (
        <FormBanner tone="warning">
          Запись за {existing.date} уже есть: {typeof existing.substance === 'string' && existing.substance ? existing.substance : 'инъекция'}{typeof existing.dose === 'string' && existing.dose ? ` ${existing.dose}` : typeof existing.dose === 'number' ? ` ${existing.dose}` : ''} — при сохранении будет заменена
        </FormBanner>
      )}

      {compatIssues.slice(0, 2).map((issue) => (
        <FormBanner key={issue} tone="warning">
          {issue}
        </FormBanner>
      ))}

      {rotation && (
        <button
          type="button"
          onClick={() => setDraft((p) => ({ ...p, zone: rotation.zone, side: rotation.side }))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '10px 13px',
            borderRadius: 12,
            marginBottom: 10,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'left',
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.4)',
            color: '#fbbf24',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.10)'; }}
        >
          <span>💡</span>
          <span style={{ flex: 1 }}>
            Следующий укол: {zoneLabel(rotation.zone)}, {rotation.side === 'left' ? 'левая' : 'правая'}
            {rotation.days >= 0 ? ` · не использовалась ${rotation.days} дн.` : ' · ещё не использовалась'} — нажмите, чтобы применить
          </span>
        </button>
      )}

      <div style={{ marginBottom: 10 }}>
        <TextField
          label="Препарат"
          value={draft.substance}
          onChange={setSubstanceSmart}
          placeholder="Тестостерон энантат"
          accent="#f59e0b"
          invalid={substanceInvalid}
        />
        {(recent.length > 0 || COMMON_INJECTIONS.length > 0) && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {[...recent, ...COMMON_INJECTIONS.filter((s) => !recent.includes(s))].slice(0, 12).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubstanceSmart(s)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${draft.substance === s ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                  background: draft.substance === s ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.03)',
                  color: draft.substance === s ? '#fbbf24' : colors.textMuted,
                  boxShadow: draft.substance === s ? '0 2px 8px rgba(245,158,11,0.22)' : undefined,
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <TextField
          label="Доза"
          value={draft.dose}
          onChange={(v) => setDraft((p) => ({ ...p, dose: v }))}
          placeholder="250 мг / 1 мл / 100 IU"
          accent="#f59e0b"
          invalid={doseInvalid}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <TextField
          label="Зона"
          value={draft.zone}
          onChange={(v) => setDraft((p) => ({ ...p, zone: v }))}
          type="select"
          options={INJECTION_ZONES.map((i) => ({ id: i.id, label: i.label }))}
        />
        <div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Сторона</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['left', 'right'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, side: s }))}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 800,
                    border: `1px solid ${draft.side === s ? '#f59e0b' : colors.border}`,
                    background: draft.side === s ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.03)',
                    color: draft.side === s ? '#fbbf24' : colors.textMuted,
                    boxShadow: draft.side === s ? '0 3px 12px rgba(245,158,11,0.25)' : undefined,
                    transition: 'all 0.15s',
                  }}
                >
                  {s === 'left' ? 'Л' : 'R'}
                </button>
              ))}
            </div>
          </label>
        </div>
        <TextField label="Объём (мл)" value={draft.volumeMl} onChange={(v) => setDraft((p) => ({ ...p, volumeMl: v }))} type="number" min={0} step={0.1} unit="мл" />
        <TextField
          label="Игла"
          value={draft.needleGauge}
          onChange={(v) => setDraft((p) => ({ ...p, needleGauge: v }))}
          type="select"
          options={NEEDLE_GAUGES.map((g) => ({ id: g, label: g }))}
        />
        <TextField
          label="Техника"
          value={draft.technique}
          onChange={(v) => setDraft((p) => ({ ...p, technique: v }))}
          type="select"
          options={TECHNIQUES.map((t) => ({ id: t.id, label: t.label }))}
        />
      </div>

      <SectionCard icon={<NativeIcon name="pin" size={16} />} title="Боль в месте укола" color="#ef4444" badge={draft.painLevel !== '0' ? `${draft.painLevel}/10` : undefined}>
        <ScalePicker value={Number(draft.painLevel) || 0} onChange={setScale('painLevel')} max={10} dense />
      </SectionCard>
      <SectionCard icon={<NativeIcon name="zap" size={16} />} title="PIP (постинъекционная боль)" color="#f97316" badge={draft.pipLevel !== '0' ? `${draft.pipLevel}/10` : undefined}>
        <ScalePicker value={Number(draft.pipLevel) || 0} onChange={setScale('pipLevel')} max={10} dense />
      </SectionCard>
      <SectionCard icon={<NativeIcon name="droplet" size={16} />} title="Отёк" color="#f59e0b" badge={draft.swelling !== '0' ? `${draft.swelling}/10` : undefined}>
        <ScalePicker value={Number(draft.swelling) || 0} onChange={setScale('swelling')} max={10} dense />
      </SectionCard>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {REACTION_KEYS.map((key) => (
          <BoolChip
            key={key}
            checked={!!draft.reactions[key]}
            onChange={(v) => setDraft((p) => ({ ...p, reactions: { ...p.reactions, [key]: v } }))}
            label={REACTION_LABELS[key]}
            color="#f59e0b"
          />
        ))}
      </div>

      <SectionCard icon={<NativeIcon name="file" size={16} />} title="Заметка" color="#f59e0b">
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
          style={{ ...fieldInput, minHeight: 52, resize: 'vertical' }}
          placeholder="Заметка (ощущения, температура, реакция…)"
        />
      </SectionCard>

      {lastRec && (
        <div style={{ marginTop: 6 }}>
          <RepeatLastChip
            label={`Повторить последнюю (${String(lastRec.date || '')}: ${String(lastRec.substance || '')} ${String(lastRec.dose ?? '')})`}
            onClick={fillFromLast}
          />
        </div>
      )}
    </DiaryModalShell>
  );
};
