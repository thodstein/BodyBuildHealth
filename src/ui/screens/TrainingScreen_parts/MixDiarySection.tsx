/** MixDiarySection.tsx — секция «💊 Тренировочные миксы и пресеты здоровья» в дневнике тренировок.
 *  Показывает записи из he_training_mixes (сохраняются кнопкой «💾 Сохранить в дневник и избранное»
 *  в TrainingMixTab и MixPresetsCard), с удалением, эффектом пресета через неделю, напоминанием о приёме,
 *  отметкой фаз приёма (единый слой с дневником поддержки) и бейджем «тренировка сегодня». */
import React, { useState, useEffect } from 'react';
import {
  readDiaryMixes, deleteDiaryMix, analyzePresetEffect, getMixIntake, toggleMixPhaseIntake,
  type DiaryMixRecord,
} from '../../../engines/training-plan-save.engine';

const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 14,
  background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' as any,
  marginBottom: 8,
};

const PHASE_META: Record<string, { label: string; icon: string }> = {
  pre: { label: 'До тренировки', icon: '🔥' },
  intra: { label: 'Во время', icon: '💧' },
  post: { label: 'После', icon: '🍗' },
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Напоминание «Принять микс/пресет» через N минут (Notification API + localStorage pref). */
export function scheduleMixReminder(title: string, minutes = 30): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(p => { if (p === 'granted') scheduleMixReminder(title, minutes); });
    return;
  }
  if (Notification.permission !== 'granted') return;
  setTimeout(() => {
    try { new Notification('💊 Принять: ' + title, { body: 'Тренировочный микс / пресет здоровья — не забудьте принять препараты.' }); } catch {}
  }, minutes * 60000);
  try {
    localStorage.setItem('he_mix_reminder', JSON.stringify({ title, at: new Date().toISOString(), minutes }));
  } catch {}
}

export const MixDiarySection: React.FC<{ hasTrainingToday?: boolean }> = ({ hasTrainingToday }) => {
  const [records, setRecords] = useState<DiaryMixRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [intakeTick, setIntakeTick] = useState(0);

  // Старые записи миксов могли содержать substances={} или повреждённые
  // recommendations. Нормализуем их до рендера, иначе блок миксов роняет
  // весь дневник на .length/.slice/.interactions.
  const readSafeRecords = (): DiaryMixRecord[] => readDiaryMixes().map((raw: any) => ({
    ...raw,
    id: String(raw?.id ?? `legacy_mix_${Math.random().toString(36).slice(2)}`),
    title: String(raw?.title ?? 'Сохранённый микс'),
    date: String(raw?.date ?? ''),
    substances: Array.isArray(raw?.substances) ? raw.substances : [],
    recommendations: raw?.recommendations && typeof raw.recommendations === 'object'
      ? { ...raw.recommendations, interactions: Array.isArray(raw.recommendations.interactions) ? raw.recommendations.interactions : [] }
      : null,
  }));

  useEffect(() => {
    setRecords(readSafeRecords());
    const onRefresh = () => setRecords(readSafeRecords());
    window.addEventListener('he-training-mix-saved', onRefresh as EventListener);
    return () => window.removeEventListener('he-training-mix-saved', onRefresh as EventListener);
  }, []);

  if (records.length === 0) return null;

  const shown = records.slice(0, expanded ? records.length : 3);
  const today = todayStr();
  const todayIntake = getMixIntake(today);
  const phasesOf = (r: DiaryMixRecord): string[] => {
    const set = new Set<string>();
    for (const s of r.substances || []) if (s.timing) set.add(s.timing);
    return ['pre', 'intra', 'post'].filter(p => set.has(p));
  };
  const anyTakenToday = Object.values(todayIntake).some(m => Object.values(m || {}).some(v => v));

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>💊 Тренировочные миксы и пресеты ({records.length})</div>
        <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 11, color:'#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
          {expanded ? 'Свернуть ▲' : 'Все ▼'}
        </button>
      </div>
      {hasTrainingToday && !anyTakenToday && (
        <div style={{ marginBottom: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
          🏋️ Тренировка сегодня — отметьте приём фаз микса (до/во время/после).
        </div>
      )}
      {shown.map(r => {
        const phases = phasesOf(r);
        const taken = todayIntake[r.id] || {};
        return (
        <div key={r.id} style={{ padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>{r.kind === 'preset' ? '🧪' : '💪'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{r.title}</div>
              <div style={{ fontSize: 10, color: '#fff' }}>
                {r.date} · {r.substances.length} веществ{r.score != null ? ` · скор ${r.score} (${r.label || ''})` : ''}
              </div>
              {(() => {
                let eff: ReturnType<typeof analyzePresetEffect> = null;
                try { eff = analyzePresetEffect(r); } catch { eff = null; }
                if (!eff) return null;
                const better = eff.type === 'sleep' ? eff.delta > 0 : eff.delta < 0;
                const arrow = eff.delta === 0 ? '→' : (better ? '↑' : '↓');
                return (
                  <div style={{ fontSize: 10, color: better ? '#00e68a' : eff.delta === 0 ? '#fff' : '#f59e0b', marginTop: 2 }}>
                    📈 {eff.label}: {eff.before} → {eff.after} {eff.type === 'sleep' ? 'ч' : 'кг'} ({arrow} {Math.abs(eff.delta)}) {eff.samplesAfter === 0 ? `· данных после: ${eff.samplesBefore} зап. до` : ''}
                  </div>
                );
              })()}
            </div>
            <button onClick={() => { scheduleMixReminder(r.title, 30); setReminderMsg(`🔔 Напоминание «${r.title}» через 30 мин`); setTimeout(() => setReminderMsg(null), 3000); }}
              title="Напомнить принять через 30 мин" style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>🔔</button>
            <button onClick={() => { deleteDiaryMix(r.id); setRecords(readSafeRecords()); }}
              style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>🗑</button>
          </div>
          {phases.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5, marginLeft: 24 }}>
              {phases.map(p => {
                const meta = PHASE_META[p];
                const active = !!taken[p];
                return (
                  <button key={p} onClick={() => { toggleMixPhaseIntake(today, r.id, p); setIntakeTick(t => t + 1); }} style={{
                    padding: '4px 9px', borderRadius: 8, cursor: 'pointer', fontSize: 9, border: 'none',
                    background: active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                    color: active ? '#c4b5fd' : '#fff', fontWeight: active ? 700 : 400,
                  }}>
                    {active ? '✓ ' : ''}{meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
          )}
          {reminderMsg && <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 4 }}>{reminderMsg}</div>}
          {r.substances.length > 0 && (
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 4 }}>
              {r.substances.slice(0, 6).map((s, i) => (
                <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}>
                  {s.name} · {s.mg >= 1000 ? `${(s.mg / 1000).toFixed(1)} г` : `${s.mg} мг`}
                </span>
              ))}
              {r.substances.length > 6 && <span style={{ fontSize: 9, color: '#fff' }}>+{r.substances.length - 6}</span>}
            </div>
          )}
          {r.recommendations && r.recommendations.interactions.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>
              ⚠️ Конфликтов в наборе: {r.recommendations.interactions.length}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
};

export default MixDiarySection;
