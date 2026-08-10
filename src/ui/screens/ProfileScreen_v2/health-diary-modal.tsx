/**
 * health-diary-modal.tsx — Единая модалка добавления записи здоровья.
 * Заменяет 5 отдельных модалок (боль, симптомы, нейро, акне, гематология).
 *
 * Redesign (Aug 10 2026): вкладки с бейджами заполненности + шкалы ScalePicker.
 * Формат сохраняемой записи (UnifiedHealthEntry) не изменён.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import { loadSessions, type WorkoutExercise } from '../../../engines/workout-logger.engine';
import type { UnifiedHealthEntry } from '../../../engines/health-diary.engine';
import {
  DiaryModalShell,
  SectionCard,
  ScalePicker,
  ChipGroup,
  TextField,
  FormBanner,
  btnGhost,
  btnPrimary,
  PAIN_ZONES,
  NEURO_SYMPTOMS,
  ACNE_AREAS,
  HEMATO_SYMPTOMS,
  painZoneColor,
  acneAreaColor,
  readDiaryEntries,
  lastEntryOf,
  findByDate,
  daysSince,
} from './diary-modals';

const DRAFT_KEY = 'he_draft_health';

const SYMPTOM_PRESETS = [
  'Головная боль', 'Тошнота', 'Бессонница', 'Боль в суставах', 'Отёки',
  'Сыпь', 'Акне', 'Потливость', 'Раздражительность', 'Снижение либидо',
  'Сердцебиение', 'Головокружение', 'Слабость', 'Боль в пояснице', 'Судороги',
];

const PAIN_TIMES = [
  { id: 'morning', label: '🌅 Утро' },
  { id: 'afternoon', label: '☀️ День' },
  { id: 'evening', label: '🌆 Вечер' },
  { id: 'night', label: '🌙 Ночь' },
];

const PAIN_TRIGGERS = [
  { id: 'load', label: 'Физ. нагрузка' },
  { id: 'stress', label: 'Стресс' },
  { id: 'weather', label: 'Погода' },
  { id: 'after_training', label: 'После тренировки' },
  { id: 'sitting', label: 'Долгое сидение' },
];

const SEVERITY_TONE = (v: number) =>
  v === 1 ? '#22c55e' : v === 2 ? '#84cc16' : v === 3 ? '#f59e0b' : v === 4 ? '#f97316' : '#ef4444';

type TabId = 'pain' | 'symptoms' | 'neuro' | 'acne' | 'hemato';

export const AddHealthModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: (entry: UnifiedHealthEntry) => void;
}> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<TabId>('pain');

  // Pain
  const [painZones, setPainZones] = useState<Record<string, number>>({});
  const [painTimeOfDay, setPainTimeOfDay] = useState<string>();
  const [painType, setPainType] = useState<string>();
  const [painTriggers, setPainTriggers] = useState<string[]>([]);
  const [painRelief, setPainRelief] = useState<string[]>([]);
  const [painDuration, setPainDuration] = useState('');
  const [linkedExercise, setLinkedExercise] = useState('');
  const [recentExercises, setRecentExercises] = useState<string[]>([]);

  // General symptoms
  const [symptoms, setSymptoms] = useState<Array<{ id: string; name: string; severity: 1|2|3|4|5; duration?: string }>>([]);
  const [newSymptomName, setNewSymptomName] = useState('');
  const [newSymptomSeverity, setNewSymptomSeverity] = useState<1|2|3|4|5>(2);
  const [newSymptomDuration, setNewSymptomDuration] = useState('');

  // Neuro
  const [neuroSymptoms, setNeuroSymptoms] = useState<Record<string, boolean>>({});

  // Acne
  const [acneAreas, setAcneAreas] = useState<Record<string, number>>({});

  // Hemato
  const [hematoSymptoms, setHematoSymptoms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    try {
      const sessions = loadSessions();
      const exercises: string[] = [];
      const seen = new Set<string>();
      for (const s of sessions.slice(0, 20)) {
        for (const ex of s.exercises || []) {
          const name = (ex as WorkoutExercise).exerciseName;
          if (name && !seen.has(name)) { seen.add(name); exercises.push(name); }
        }
      }
      setRecentExercises(exercises.slice(0, 30));
    } catch { setRecentExercises([]); }
  }, [open]);

  const savedRef = useRef(false);

  // Восстановление черновика (переживает закрытие и переключение вкладок)
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(DRAFT_KEY);
      if (!s) return;
      const d = JSON.parse(s) as Record<string, unknown>;
      if (!d || typeof d !== 'object') return;
      if (typeof d.date === 'string') setDate(d.date);
      if (typeof d.notes === 'string') setNotes(d.notes);
      if (d.painZones && typeof d.painZones === 'object') setPainZones(d.painZones as Record<string, number>);
      if (typeof d.painTimeOfDay === 'string') setPainTimeOfDay(d.painTimeOfDay);
      if (typeof d.painType === 'string') setPainType(d.painType);
      if (Array.isArray(d.painTriggers)) setPainTriggers(d.painTriggers as string[]);
      if (typeof d.painDuration === 'string') setPainDuration(d.painDuration);
      if (typeof d.linkedExercise === 'string') setLinkedExercise(d.linkedExercise);
      if (Array.isArray(d.symptoms)) setSymptoms(d.symptoms as typeof symptoms);
      if (typeof d.newSymptomName === 'string') setNewSymptomName(d.newSymptomName);
      if (typeof d.newSymptomSeverity === 'number') setNewSymptomSeverity(d.newSymptomSeverity as 1|2|3|4|5);
      if (typeof d.newSymptomDuration === 'string') setNewSymptomDuration(d.newSymptomDuration);
      if (d.neuroSymptoms && typeof d.neuroSymptoms === 'object') setNeuroSymptoms(d.neuroSymptoms as Record<string, boolean>);
      if (d.acneAreas && typeof d.acneAreas === 'object') setAcneAreas(d.acneAreas as Record<string, number>);
      if (d.hematoSymptoms && typeof d.hematoSymptoms === 'object') setHematoSymptoms(d.hematoSymptoms as Record<string, boolean>);
    } catch {}
  }, []);

  // Сохранение черновика при каждом изменении (кроме сброса после сохранения)
  useEffect(() => {
    if (savedRef.current) { savedRef.current = false; return; }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        date, notes, painZones, painTimeOfDay, painType, painTriggers, painDuration,
        linkedExercise, symptoms, newSymptomName, newSymptomSeverity, newSymptomDuration,
        neuroSymptoms, acneAreas, hematoSymptoms,
      }));
    } catch {}
  });

  const painTotal = Object.values(painZones).reduce((s, v) => s + (v || 0), 0);
  const neuroTotal = Object.values(neuroSymptoms).filter(Boolean).length;
  const acneTotal = Object.values(acneAreas).reduce((s, v) => s + (v || 0), 0);
  const hematoTotal = Object.values(hematoSymptoms).filter(Boolean).length;

  const hasAnyData = painTotal > 0 || symptoms.length > 0 || neuroTotal > 0 || acneTotal > 0 || hematoTotal > 0 || notes.trim().length > 0;

  const toggleArr = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const submit = () => {
    if (!date || !hasAnyData) return;

    const entry: Omit<UnifiedHealthEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      date,
      pain: painTotal > 0 ? {
        zones: painZones,
        totalScore: painTotal,
        timeOfDay: painTimeOfDay,
        painType: painType || undefined,
        triggers: painTriggers.length ? painTriggers : undefined,
        relief: painRelief.length ? painRelief : undefined,
        duration: painDuration || undefined,
        linkedExercise: linkedExercise || undefined,
      } : null,
      symptoms: symptoms.length > 0 ? symptoms.map(s => ({
        id: s.id,
        name: s.name,
        severity: s.severity,
        duration: s.duration,
      })) : [],
      neuro: neuroTotal > 0 ? {
        symptoms: neuroSymptoms,
        totalScore: neuroTotal,
      } : null,
      acne: acneTotal > 0 ? {
        areas: acneAreas,
        totalScore: acneTotal,
      } : null,
      hemato: hematoTotal > 0 ? {
        symptoms: hematoSymptoms,
        totalScore: hematoTotal,
      } : null,
      notes: notes.trim() || undefined,
    };

    onSave({
      ...entry,
      id: '',
      createdAt: '',
      updatedAt: '',
    } as any);

    savedRef.current = true;
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}

    // Reset
    setPainZones({});
    setPainTimeOfDay(undefined);
    setPainType(undefined);
    setPainTriggers([]);
    setPainRelief([]);
    setPainDuration('');
    setLinkedExercise('');
    setSymptoms([]);
    setNewSymptomName('');
    setNewSymptomSeverity(2);
    setNewSymptomDuration('');
    setNeuroSymptoms({});
    setAcneAreas({});
    setHematoSymptoms({});
    setNotes('');
    setTab('pain');
    onClose();
  };

  const addSymptom = () => {
    if (!newSymptomName.trim()) return;
    setSymptoms(p => [...p, {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newSymptomName.trim(),
      severity: newSymptomSeverity,
      duration: newSymptomDuration.trim() || undefined,
    }]);
    setNewSymptomName('');
    setNewSymptomSeverity(2);
    setNewSymptomDuration('');
  };

  const removeSymptom = (id: string) => {
    setSymptoms(p => p.filter(s => s.id !== id));
  };

  const TABS: { id: TabId; icon: string; label: string; badge?: string; color: string }[] = [
    { id: 'pain', icon: '🦴', label: 'Боль', badge: painTotal > 0 ? `${painTotal}` : undefined, color: '#22c55e' },
    { id: 'symptoms', icon: '🩺', label: 'Симптомы', badge: symptoms.length > 0 ? `${symptoms.length}` : undefined, color: '#ec4899' },
    { id: 'neuro', icon: '🧠', label: 'Нейро', badge: neuroTotal > 0 ? `${neuroTotal}` : undefined, color: '#ef4444' },
    { id: 'acne', icon: '🔴', label: 'Акне', badge: acneTotal > 0 ? `${acneTotal}` : undefined, color: '#f97316' },
    { id: 'hemato', icon: '🩸', label: 'Кровь', badge: hematoTotal > 0 ? `${hematoTotal}` : undefined, color: '#3b82f6' },
  ];

  const lastHealth = useMemo(
    () => lastEntryOf(readDiaryEntries<{ date?: string }>('he_health_diary')),
    [open],
  );
  const healthStale = lastHealth?.date ? daysSince(lastHealth.date) ?? 0 : null;
  const existingHealth = useMemo(
    () => findByDate<{ date?: string }>(readDiaryEntries('he_health_diary'), date),
    [open, date],
  );

  return (
    <DiaryModalShell
      open={open}
      onClose={onClose}
      title="Запись здоровья"
      icon="🩺"
      color="#ec4899"
      subtitle="Отмечайте все симптомы за день — можно заполнять несколько разделов"
      width={520}
      onSubmit={submit}
      stale={healthStale !== null ? { days: healthStale } : null}
      footer={
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px 16px', borderTop: `1px solid ${colors.border}` }}>
          <button type="button" onClick={onClose} style={btnGhost}>Отмена</button>
          <button
            type="submit"
            disabled={!hasAnyData}
            style={{
              ...btnPrimary(colors.primary),
              opacity: hasAnyData ? 1 : 0.5,
              cursor: hasAnyData ? 'pointer' : 'not-allowed',
            }}
          >
            Сохранить
          </button>
        </div>
      }
    >
      {!hasAnyData && (
        <FormBanner tone="info">Заполните хотя бы один раздел — кнопка «Сохранить» активируется</FormBanner>
      )}
      {existingHealth && (
        <FormBanner tone="warning">Запись здоровья за {date} уже есть — при сохранении будет заменена</FormBanner>
      )}

      {/* Дата + заметка */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <TextField label="Дата" value={date} onChange={setDate} type="date" />
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <TextField label="Заметка (необязательно)" value={notes} onChange={setNotes} placeholder="Триггеры, лечение, наблюдения…" />
        </div>
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }} role="tablist" aria-label="Разделы здоровья">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                minHeight: 40,
                minWidth: 88,
                padding: '6px 8px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                border: `1px solid ${active ? t.color : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${t.color}20` : 'rgba(255,255,255,0.02)',
                color: active ? t.color : colors.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.badge && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: t.color,
                    background: `${t.color}30`,
                    borderRadius: 999,
                    padding: '1px 6px',
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Боль ── */}
      {tab === 'pain' && (
        <>
          <SectionCard icon="🦴" title="Боль в суставах (VAS 0–10)" color="#22c55e" badge={painTotal > 0 ? `Σ ${painTotal}` : undefined} hint="0 — нет боли, 10 — невыносимая">
            {PAIN_ZONES.map((z) => {
              const v = painZones[z.id] || 0;
              const c = painZoneColor(v);
              return (
                <div key={z.id} style={{ marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, width: 78, flexShrink: 0 }}>{z.label}</span>
                  <div style={{ flex: 1 }}>
                    <ScalePicker
                      value={v}
                      onChange={(n) => setPainZones(p => ({ ...p, [z.id]: n }))}
                      max={10}
                      dense
                      height={32}
                      toneFn={(n) => painZoneColor(n)}
                    />
                  </div>
                </div>
              );
            })}
          </SectionCard>

          <SectionCard icon="📋" title="Детали боли" color="#22c55e">
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Когда</span>
              <div style={{ marginTop: 5 }}>
                <ChipGroup
                  options={PAIN_TIMES}
                  selected={painTimeOfDay ? [painTimeOfDay] : []}
                  onChange={(ids) => setPainTimeOfDay(ids[0])}
                  color="#22c55e"
                  columns={4}
                  single
                />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Триггеры</span>
              <div style={{ marginTop: 5 }}>
                <ChipGroup
                  options={PAIN_TRIGGERS}
                  selected={painTriggers}
                  onChange={setPainTriggers}
                  color="#22c55e"
                  columns={2}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <TextField label="Тип боли" value={painType || ''} onChange={setPainType} placeholder="напр. ноющая" />
              <TextField label="Длительность" value={painDuration} onChange={setPainDuration} placeholder="напр. 2 часа" />
            </div>
            {recentExercises.length > 0 && (
              <TextField
                label="Связано с упражнением"
                value={linkedExercise}
                onChange={setLinkedExercise}
                type="select"
                options={[{ id: '', label: '— не связано —' }, ...recentExercises.map((e) => ({ id: e, label: e }))]}
              />
            )}
          </SectionCard>
        </>
      )}

      {/* ── Симптомы ── */}
      {tab === 'symptoms' && (
        <SectionCard icon="🩺" title="Симптомы" color="#ec4899" badge={symptoms.length > 0 ? `${symptoms.length}` : undefined}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 140px' }}>
              <TextField
                label="Симптом"
                value={newSymptomName}
                onChange={setNewSymptomName}
                placeholder="Симптом…"
                hint="Список подскажет варианты"
              />
            </div>
            <datalist id="he-symptom-presets">{SYMPTOM_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
            <div style={{ flex: '1 1 130px' }}>
              <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 3 }}>Тяжесть</span>
              <ScalePicker
                value={newSymptomSeverity}
                onChange={(v) => setNewSymptomSeverity(v as 1|2|3|4|5)}
                min={1}
                max={5}
                dense
                toneFn={SEVERITY_TONE}
              />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <TextField label="Длительность" value={newSymptomDuration} onChange={setNewSymptomDuration} placeholder="напр. 3 дня" />
            </div>
            <button
              type="button"
              onClick={addSymptom}
              disabled={!newSymptomName.trim()}
              style={{
                ...btnPrimary(colors.primary),
                flex: 0,
                padding: '0 18px',
                minHeight: 44,
                opacity: newSymptomName.trim() ? 1 : 0.4,
              }}
            >
              + Добавить
            </button>
          </div>
          {symptoms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {symptoms.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: colors.text }}>{s.name}</span>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 800, color: SEVERITY_TONE(s.severity),
                      background: `${SEVERITY_TONE(s.severity)}1f`, borderRadius: 999, padding: '2px 8px',
                    }}
                  >
                    {s.severity}/5
                  </span>
                  {s.duration && <span style={{ fontSize: 10, color: colors.textMuted }}>{s.duration}</span>}
                  <button
                    type="button"
                    onClick={() => removeSymptom(s.id)}
                    aria-label={`Удалить симптом ${s.name}`}
                    style={{
                      background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer',
                      fontSize: 16, padding: '4px 8px', minWidth: 40, minHeight: 40, borderRadius: 8,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Нейро ── */}
      {tab === 'neuro' && (
        <SectionCard icon="🧠" title="Нейросимптомы" color="#ef4444" badge={neuroTotal > 0 ? `${neuroTotal}/10` : undefined}>
          <ChipGroup
            options={NEURO_SYMPTOMS}
            selected={Object.entries(neuroSymptoms).filter(([, on]) => on).map(([id]) => id)}
            onChange={(ids) => {
              const next: Record<string, boolean> = {};
              NEURO_SYMPTOMS.forEach((s) => { next[s.id] = ids.includes(s.id); });
              setNeuroSymptoms(next);
            }}
            color="#ef4444"
            columns={2}
          />
        </SectionCard>
      )}

      {/* ── Акне ── */}
      {tab === 'acne' && (
        <SectionCard icon="🔴" title="Акне (0–3)" color="#f97316" badge={acneTotal > 0 ? `Σ ${acneTotal}/12` : undefined}>
          {ACNE_AREAS.map((a) => {
            const v = acneAreas[a.id] || 0;
            return (
              <div key={a.id} style={{ marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, width: 60, flexShrink: 0 }}>{a.label}</span>
                <div style={{ flex: 1 }}>
                  <ScalePicker
                    value={v}
                    onChange={(n) => setAcneAreas(p => ({ ...p, [a.id]: n }))}
                    max={3}
                    dense
                    height={32}
                    labels={(n) => (n === 0 ? 'Чисто' : n === 1 ? 'Ед.' : n === 2 ? 'Умер.' : 'Тяж.')}
                    toneFn={(n) => acneAreaColor(n)}
                  />
                </div>
              </div>
            );
          })}
        </SectionCard>
      )}

      {/* ── Гематология ── */}
      {tab === 'hemato' && (
        <SectionCard icon="🩸" title="Гематологические симптомы" color="#3b82f6" badge={hematoTotal > 0 ? `${hematoTotal}/8` : undefined}>
          <ChipGroup
            options={HEMATO_SYMPTOMS}
            selected={Object.entries(hematoSymptoms).filter(([, on]) => on).map(([id]) => id)}
            onChange={(ids) => {
              const next: Record<string, boolean> = {};
              HEMATO_SYMPTOMS.forEach((s) => { next[s.id] = ids.includes(s.id); });
              setHematoSymptoms(next);
            }}
            color="#3b82f6"
            columns={2}
          />
        </SectionCard>
      )}
    </DiaryModalShell>
  );
};
