/**
 * WorkoutSessionWidgets.tsx — 3 варианта виджета проведения тренировки (АПК, in-app).
 * Только UI-слой поверх существующих SessionPlayer / he_workout_log_v2.
 * Без чужих правок: самодостаточные карточки, монтируются 1 строкой где угодно.
 */
import React, { useMemo, useState } from 'react';

const WHITE = '#fff';
const ACCENT = '#00e68a';
const CARD: React.CSSProperties = {
  background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, padding: 12, margin: '8px 0',
};
const BIG_BTN: React.CSSProperties = {
  minHeight: 52, borderRadius: 14, border: 'none', fontWeight: 800, fontSize: 15,
  background: ACCENT, color: '#0a0a0a', padding: '12px 16px',
};
const GHOST_BTN: React.CSSProperties = {
  ...BIG_BTN, background: 'transparent', color: WHITE, border: '1px solid rgba(255,255,255,0.14)',
};
const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export interface WidgetExercise { name: string; done: number; total: number; weight?: number }
export interface WorkoutWidgetState {
  dayLabel: string;
  exercises: WidgetExercise[];
  startedAt?: number;
}

function readLastWorkout(): WorkoutWidgetState | null {
  try {
    const raw = localStorage.getItem('he_workout_log_v2');
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const last = arr[arr.length - 1] as any;
    const exs: WidgetExercise[] = Array.isArray(last?.exercises)
      ? last.exercises.slice(0, 6).map((e: any) => ({
        name: String(e?.name ?? e?.exerciseName ?? 'Упражнение'),
        done: Array.isArray(e?.sets) ? e.sets.length : 0,
        total: Array.isArray(e?.sets) ? e.sets.length : 0,
        weight: Number(e?.sets?.[0]?.weight ?? 0) || undefined,
      }))
      : [];
    return { dayLabel: String(last?.date ?? 'Последняя тренировка'), exercises: exs, startedAt: Number(last?.startedAt) || undefined };
  } catch { return null; }
}

/* ── A1: «Пульт зала» — липкая мини-полоса ─────────────────────────────── */
export const WorkoutMiniPult: React.FC<{ state?: WorkoutWidgetState | null; onOpen?: () => void; onNextSet?: () => void }> = ({ state, onOpen, onNextSet }) => {
  const s = state ?? readLastWorkout();
  const done = (s?.exercises ?? []).reduce((a, e) => a + e.done, 0);
  const total = (s?.exercises ?? []).reduce((a, e) => a + e.total, 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div data-widget="workout-pult" role="status" aria-label={`Пульт тренировки, выполнено ${pct} процентов`}
      style={{ ...CARD, position: 'sticky', top: 0, zIndex: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,230,138,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }} aria-hidden>🏋️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: WHITE, fontSize: 13, fontWeight: 800, ...TABULAR }}>{s?.dayLabel ?? 'Тренировки пока нет'} · {done}/{total}</div>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.10)', marginTop: 6 }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: ACCENT }} />
        </div>
      </div>
      <button type="button" data-act="pult-next" onClick={onNextSet} style={{ ...BIG_BTN, minWidth: 96 }} aria-label="Записать следующий сет">+ Сет</button>
      <button type="button" data-act="pult-open" onClick={onOpen} style={{ ...GHOST_BTN, minWidth: 64, padding: '12px 10px' }} aria-label="Открыть проведение">↗</button>
    </div>
  );
};

/* ── A2: «Карточка дня» — спокойная карточка на Главную/Дневник ────────── */
export const WorkoutDayCard: React.FC<{ state?: WorkoutWidgetState | null; onOpen?: () => void; onSkip?: () => void }> = ({ state, onOpen, onSkip }) => {
  const s = state ?? readLastWorkout();
  return (
    <section data-widget="workout-daycard" aria-label="Тренировка дня" style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ color: WHITE, fontSize: 14, fontWeight: 800 }}>🏋️ {s?.dayLabel ?? 'Сегодня — отдых или свободная'}</div>
        <div style={{ color: WHITE, fontSize: 12, ...TABULAR }}>{(s?.exercises ?? []).length} упр.</div>
      </div>
      {(s?.exercises ?? []).slice(0, 4).map((e, i) => (
        <div key={i} data-ex={e.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', minHeight: 44, alignItems: 'center' }}>
          <span style={{ color: WHITE, fontSize: 13 }}>{e.name}</span>
          <span style={{ color: WHITE, fontSize: 12, ...TABULAR }}>{e.done}/{e.total}{e.weight ? ` · ${e.weight} кг` : ''}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" data-act="day-start" onClick={onOpen} style={{ ...BIG_BTN, flex: 2 }} aria-label="Начать проведение тренировки">▶ Начать</button>
        <button type="button" data-act="day-skip" onClick={onSkip} style={{ ...GHOST_BTN, flex: 1 }} aria-label="Пропустить тренировку">Пропуск</button>
      </div>
    </section>
  );
};

/* ── A3: «BIG-режим» — огромные кнопки для зала одной рукой ────────────── */
export const WorkoutBigMode: React.FC<{ state?: WorkoutWidgetState | null; onDoneSet?: (exIdx: number) => void; onFinish?: () => void }> = ({ state, onDoneSet, onFinish }) => {
  const s = state ?? readLastWorkout();
  const [idx, setIdx] = useState(0);
  const exs = useMemo(() => s?.exercises ?? [], [s]);
  const cur = exs[idx];
  return (
    <section data-widget="workout-big" aria-label="Крупный режим зала" style={{ ...CARD, textAlign: 'center' }}>
      <div style={{ color: WHITE, fontSize: 12 }}>Упражнение {exs.length ? idx + 1 : 0} из {exs.length}</div>
      <div style={{ color: WHITE, fontSize: 20, fontWeight: 800, margin: '6px 0' }}>{cur?.name ?? 'Нет упражнений'}</div>
      <div style={{ color: WHITE, fontSize: 28, fontWeight: 800, ...TABULAR }}>{cur ? `${cur.done}/${cur.total}` : '—'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <button type="button" data-act="big-prev" disabled={idx === 0} onClick={() => setIdx(i => Math.max(0, i - 1))} style={{ ...GHOST_BTN, minHeight: 56 }} aria-label="Предыдущее упражнение">‹ Назад</button>
        <button type="button" data-act="big-next" disabled={idx >= exs.length - 1} onClick={() => setIdx(i => Math.min(exs.length - 1, i + 1))} style={{ ...GHOST_BTN, minHeight: 56 }} aria-label="Следующее упражнение">Далее ›</button>
      </div>
      <button type="button" data-act="big-done" onClick={() => cur && onDoneSet?.(idx)} style={{ ...BIG_BTN, width: '100%', minHeight: 64, fontSize: 18, marginTop: 8 }} aria-label="Готово, записать сет">✅ ГОТОВО</button>
      <button type="button" data-act="big-finish" onClick={onFinish} style={{ ...GHOST_BTN, width: '100%', marginTop: 8 }} aria-label="Завершить тренировку">Завершить</button>
    </section>
  );
};

/* ── Панель-переключатель всех трёх (для предпросмотра в АПК) ──────────── */
export const WorkoutWidgetsPanel: React.FC<{ state?: WorkoutWidgetState | null }> = ({ state }) => {
  const [tab, setTab] = useState<'pult' | 'day' | 'big'>('pult');
  return (
    <section data-widget="workout-panel" aria-label="Виджеты проведения" style={CARD}>
      <div role="tablist" aria-label="Вариант виджета" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {([['pult', 'Пульт'], ['day', 'День'], ['big', 'BIG']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} data-tab={k} onClick={() => setTab(k)}
            style={{ flex: 1, minHeight: 44, borderRadius: 12, border: tab === k ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.12)', background: tab === k ? 'rgba(0,230,138,0.12)' : 'transparent', color: WHITE, fontWeight: 800, fontSize: 13 }}>{label}</button>
        ))}
      </div>
      {tab === 'pult' && <WorkoutMiniPult state={state} />}
      {tab === 'day' && <WorkoutDayCard state={state} />}
      {tab === 'big' && <WorkoutBigMode state={state} />}
    </section>
  );
};
