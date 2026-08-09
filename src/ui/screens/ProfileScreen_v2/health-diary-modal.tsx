/**
 * health-diary-modal.tsx — Единая модалка добавления записи здоровья.
 * Заменяет 5 отдельных модалок (боль, симптомы, нейро, акне, гематология).
 */

import React, { useState, useEffect } from 'react';
import { colors } from './ui';
import { todayIso } from './diary-helpers';
import { loadSessions, type WorkoutExercise } from '../../../engines/workout-logger.engine';
import type { UnifiedHealthEntry } from '../../../engines/health-diary.engine';
import { PAIN_ZONES, NEURO_SYMPTOMS, ACNE_AREAS, HEMATO_SYMPTOMS, painZoneColor } from './diary-modals';

const SYMPTOM_PRESETS = [
  'Головная боль', 'Тошнота', 'Бессонница', 'Боль в суставах', 'Отёки',
  'Сыпь', 'Акне', 'Потливость', 'Раздражительность', 'Снижение либидо',
  'Сердцебиение', 'Головокружение', 'Слабость', 'Боль в пояснице', 'Судороги',
];

export const AddHealthModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: (entry: UnifiedHealthEntry) => void;
}> = ({ open, onClose, onSave }) => {
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');

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

  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
    }} onClick={onClose}>
      <div style={{
        width: 'min(520px, 94vw)', maxHeight: '90vh', overflowY: 'auto',
        background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 20, color: colors.text,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.primary }}>🩺 Запись здоровья</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: colors.textMuted, fontSize: 20, cursor: 'pointer', padding: 4, minWidth: 32, minHeight: 32 }}>✕</button>
        </div>

        <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 12, lineHeight: 1.4 }}>
          Отмечайте все симптомы за день. Можно заполнять несколько разделов одновременно.
        </div>

        {/* Date + Notes */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 10, color: colors.textMuted, fontWeight: 600, marginBottom: 4, display: 'block' }}>Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayIso()} style={{
              width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 10px', color: colors.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }} />
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label style={{ fontSize: 10, color: colors.textMuted, fontWeight: 600, marginBottom: 4, display: 'block' }}>Заметка (необязательно)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Триггеры, лечение, наблюдения..." style={{
              width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 10px', color: colors.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }} />
          </div>
        </div>

        {/* Pain zones */}
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>🦴 Боль в суставах (VAS 0–10)</div>
          {PAIN_ZONES.map(z => {
            const v = painZones[z.id] || 0;
            const c = painZoneColor(v);
            return (
              <div key={z.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: colors.text, width: 72, flexShrink: 0 }}>{z.label}</span>
                 <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                   {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                     <button key={n} type="button" onClick={() => setPainZones(p => ({ ...p, [z.id]: n }))} style={{
                       flex: 1, minHeight: 44, padding: '4px 0', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                       border: `1px solid ${n === v ? c : 'rgba(255,255,255,0.06)'}`,
                       background: n === v ? `${c}33` : 'transparent',
                       color: n === v ? c : colors.textMuted,
                     }}>{n}</button>
                   ))}
                 </div>
              </div>
            );
          })}
            <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>
             Σ: <b style={{ color: painZoneColor(Math.round(painTotal / PAIN_ZONES.length)) }}>{painTotal}/{PAIN_ZONES.length * 10}</b>
          </div>
        </div>

        {/* General symptoms */}
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ec4899', marginBottom: 6 }}>🩺 Симптомы</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <input type="text" value={newSymptomName} onChange={e => setNewSymptomName(e.target.value)} list="he-symptom-presets" placeholder="Симптом..." style={{
              flex: '1 1 120px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '6px 8px', color: colors.text, fontSize: 12, outline: 'none',
            }} />
            <datalist id="he-symptom-presets">{SYMPTOM_PRESETS.map(s => <option key={s} value={s} />)}</datalist>
            <select value={newSymptomSeverity} onChange={e => setNewSymptomSeverity(Number(e.target.value) as 1|2|3|4|5)} style={{
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', color: colors.text, fontSize: 12,
            }}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}/5</option>)}
            </select>
            <input type="text" value={newSymptomDuration} onChange={e => setNewSymptomDuration(e.target.value)} placeholder="Длительность" style={{
              width: 90, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '6px 8px', color: colors.text, fontSize: 12, outline: 'none',
            }} />
            <button onClick={addSymptom} style={{
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: colors.primary, color: '#000', border: 'none',
            }}>+</button>
          </div>
          {symptoms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {symptoms.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ flex: 1, fontSize: 11, color: colors.text }}>{s.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{s.severity}/5</span>
                  {s.duration && <span style={{ fontSize: 9, color: colors.textMuted }}>{s.duration}</span>}
                   <button onClick={() => removeSymptom(s.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '4px 8px', minWidth: 44, minHeight: 44, borderRadius: 6 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Neuro symptoms */}
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🧠 Нейросимптомы</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {NEURO_SYMPTOMS.map(s => {
              const on = !!neuroSymptoms[s.id];
              return (
                 <button key={s.id} type="button" onClick={() => setNeuroSymptoms(p => ({ ...p, [s.id]: !on }))} style={{
                   padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, minHeight: 44,
                   border: `1px solid ${on ? '#ef4444' : 'rgba(255,255,255,0.06)'}`,
                   background: on ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                   color: on ? '#ef4444' : colors.text, textAlign: 'left',
                 }}>{s.label}</button>
              );
            })}
          </div>
          {neuroTotal > 0 && <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>Отмечено: <b style={{ color: '#ef4444' }}>{neuroTotal}/10</b></div>}
        </div>

        {/* Acne */}
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 6 }}>🔴 Акне (0–3)</div>
          {ACNE_AREAS.map(a => {
            const v = acneAreas[a.id] || 0;
            const c = v === 0 ? '#22c55e' : v === 1 ? '#f59e0b' : v === 2 ? '#f97316' : '#ef4444';
            return (
              <div key={a.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: colors.text, width: 60, flexShrink: 0 }}>{a.label}</span>
                <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                   {[0, 1, 2, 3].map(n => (
                     <button key={n} type="button" onClick={() => setAcneAreas(p => ({ ...p, [a.id]: n }))} style={{
                       flex: 1, minHeight: 44, padding: '4px 0', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                       border: `1px solid ${n === v ? c : 'rgba(255,255,255,0.06)'}`,
                       background: n === v ? `${c}33` : 'transparent',
                       color: n === v ? c : colors.textMuted,
                     }}>{n === 0 ? 'Чисто' : n === 1 ? 'Ед.' : n === 2 ? 'Умер.' : 'Тяж.'}</button>
                   ))}
                </div>
              </div>
            );
          })}
          {acneTotal > 0 && <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>Σ: <b style={{ color: '#f97316' }}>{acneTotal}/12</b></div>}
        </div>

        {/* Hematological */}
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>🩸 Гематологические симптомы</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {HEMATO_SYMPTOMS.map(s => {
              const on = !!hematoSymptoms[s.id];
              return (
                <button key={s.id} type="button" onClick={() => setHematoSymptoms(p => ({ ...p, [s.id]: !on }))} style={{
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, minHeight: 44,
                  border: `1px solid ${on ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
                  background: on ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                  color: on ? '#3b82f6' : colors.text, textAlign: 'left',
                }}>{s.label}</button>
              );
            })}
          </div>
          {hematoTotal > 0 && <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>Отмечено: <b style={{ color: '#3b82f6' }}>{hematoTotal}/8</b></div>}
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, minHeight: 40, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, cursor: 'pointer' }}>Отмена</button>
          <button onClick={submit} disabled={!hasAnyData} style={{
            flex: 1, minHeight: 40, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: colors.primary, color: '#000', border: 'none', cursor: hasAnyData ? 'pointer' : 'not-allowed',
            opacity: hasAnyData ? 1 : 0.5,
          }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};
