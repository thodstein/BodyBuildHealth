/**
 * CoachWeekView — «неделя» в режиме тренера: задачи по дням и обзор.
 *
 * Что здесь честно:
 *  • задачи стоят по СВОИМ датам (данные тренера);
 *  • тренировки показаны как ФАКТ («в этот день тренировался»), а не как план:
 *    программа хранит список дней, но не привязку к дням недели — раскладывать
 *    будущее по календарю было бы выдумкой;
 *  • «обзор недели» перечисляет только проверяемые поводы: нет программы,
 *    прошлая неделя не выполнена, чек-ин был не на этой неделе, есть комментарий.
 *
 * Напоминания — opt-in: без нажатия тренера ничего не ставится. На веб-сборке
 * плагин недоступен — это сказано прямо, а не «напоминания включены» впустую.
 */
import React, { useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import type { CoachWeek } from '../../../engines/coach/coach-week.engine';
import { planCoachReminders } from '../../../engines/coach/coach-week.engine';
import {
  readCoachReminderSettings,
  setCoachRemindersEnabled,
  writeCoachReminderSettings,
} from '../../../engines/coach/coach-reminders.engine';

const ACCENT = '#22d3ee';

interface CoachWeekViewProps {
  week: CoachWeek;
  /** Задачи (для напоминаний) — тот же массив, что в неделе. */
  tasks: readonly import('../../../engines/coach/coach-planner.engine').CoachTask[];
  /** Переход к карточке атлета (фильтр списка по имени). */
  onSelectAthlete?: (athleteId: string, athleteName: string) => void;
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const ghostBtn: React.CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  borderRadius: 10,
  padding: '7px 11px',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
};

const linkBtn: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: 'rgba(255,255,255,0.88)',
  padding: 0,
  fontSize: 11.5,
  lineHeight: 1.45,
  textAlign: 'left',
  cursor: 'pointer',
};

/** Стабильный диапазон id, чтобы повторная запись заменяла старые напоминания. */
const REMINDER_ID_BASE = 730_000;

function WeekNote(props: { title: string; children: React.ReactNode; tone?: 'warn' | 'muted' }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.2, color: props.tone === 'warn' ? colors.warning : colors.textMuted }}>
        {props.title}
      </div>
      <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>{props.children}</div>
    </div>
  );
}

export function CoachWeekView({ week, tasks, onSelectAthlete }: CoachWeekViewProps) {
  const [reminders, setReminders] = useState(() => readCoachReminderSettings(ls()));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const planned = useMemo(
    () => planCoachReminders(tasks, { today: week.days.find(d => d.isToday)?.date ?? week.weekStart }),
    [tasks, week],
  );

  const reviewCount =
    week.review.withoutPlan.length +
    week.review.lastWeekMissed.length +
    week.review.noCheckinThisWeek.length +
    week.review.comments.length;

  const toggleReminders = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const next = setCoachRemindersEnabled(reminders, !reminders.enabled);
    writeCoachReminderSettings(ls(), next);
    setReminders(next);
    try {
      const bridge = await import('../../../core/native-bridge');
      const ids = planned.map((_, i) => REMINDER_ID_BASE + i);
      if (!next.enabled) {
        await bridge.cancelScheduledReminders(ids);
        setResult('Напоминания выключены.');
        return;
      }
      if (!planned.length) {
        setResult('Нечего напоминать: у задач нет времени. Укажите время в планере.');
        return;
      }
      // Сначала снимаем прежние, чтобы не копились дубли.
      await bridge.cancelScheduledReminders(ids);
      const n = await bridge.scheduleWeeklyReminders(
        planned.map((item, i) => ({
          id: REMINDER_ID_BASE + i,
          weekday: bridge.jsDayToCapacitorWeekday(item.weekdayIndex),
          hour: item.hour,
          minute: item.minute,
          title: item.title,
          body: item.body,
        })),
      );
      setResult(
        n > 0
          ? `Поставлено напоминаний: ${n}.`
          : 'Устройство не приняло напоминания (веб-сборка или нет разрешения). Ничего не потеряно — задачи остаются в планере.',
      );
    } catch {
      setResult('Не удалось поставить напоминания. Задачи остаются в планере.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-coach="week" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Неделя</div>
          <div style={{ fontSize: 11, color: colors.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {week.weekStart.slice(8, 10)}.{week.weekStart.slice(5, 7)}–{week.weekEnd.slice(8, 10)}.{week.weekEnd.slice(5, 7)}
            {' · '}задач: {week.tasksTotal}, закрыто: {week.tasksDone}
          </div>
        </div>
        <button
          type="button"
          data-coach="reminders-toggle"
          aria-pressed={reminders.enabled}
          onClick={() => void toggleReminders()}
          disabled={busy}
          style={{
            ...ghostBtn,
            borderColor: reminders.enabled ? withAlpha(ACCENT, '66') : 'rgba(255,255,255,0.14)',
            background: reminders.enabled ? withAlpha(ACCENT, '18') : 'rgba(255,255,255,0.05)',
            color: reminders.enabled ? ACCENT : '#fff',
            opacity: busy ? 0.6 : 1,
          }}
          title="Ставит еженедельные напоминания о задачах, у которых указано время"
        >
          {busy ? 'Ставим…' : reminders.enabled ? 'Напоминания включены' : 'Напоминать о задачах'}
        </button>
      </div>
      {result && (
        <div data-coach="reminders-status" style={{ marginTop: 7, fontSize: 10.5, color: colors.textMuted, lineHeight: 1.45 }}>
          {result}
        </div>
      )}

      {week.overdue.length > 0 && (
        <div
          data-coach="week-overdue"
          style={{
            marginTop: 10,
            borderRadius: 12,
            padding: 9,
            border: `1px solid ${withAlpha(colors.warning, '33')}`,
            background: withAlpha(colors.warning, '0c'),
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: colors.warning }}>
            Просрочено: {week.overdue.length}
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.45 }}>
            {week.overdue.slice(0, 4).map(t => `${t.title} (${t.date.slice(8, 10)}.${t.date.slice(5, 7)})`).join(' · ')}
            {week.overdue.length > 4 ? ` · и ещё ${week.overdue.length - 4}` : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {week.days.map(day => {
          const hasSomething = day.tasks.length > 0 || day.trained.length > 0;
          return (
            <div
              key={day.date}
              data-coach="week-day"
              data-today={day.isToday}
              style={{
                flex: '0 0 auto',
                minWidth: 92,
                borderRadius: 11,
                padding: '7px 8px',
                border: `1px solid ${day.isToday ? withAlpha(ACCENT, '66') : 'rgba(255,255,255,0.09)'}`,
                background: day.isToday ? withAlpha(ACCENT, '12') : 'rgba(255,255,255,0.03)',
                opacity: !hasSomething && day.isPast ? 0.55 : 1,
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: day.isToday ? ACCENT : colors.textMuted }}>
                {day.label}
              </div>
              {day.tasks.length > 0 && (
                <div style={{ marginTop: 3, fontSize: 10.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.35 }}>
                  {day.tasks.length === 1 ? day.tasks[0].title : `задач: ${day.tasks.length}`}
                </div>
              )}
              {day.trained.length > 0 && (
                <div style={{ marginTop: 3, fontSize: 10, color: colors.textMuted, lineHeight: 1.35 }}>
                  {day.trained.length === 1
                    ? `тренировался: ${day.trained[0].athleteName}`
                    : `тренировались: ${day.trained.length}`}
                </div>
              )}
              {!hasSomething && (
                <div style={{ marginTop: 3, fontSize: 10, color: colors.textSubtle }}>—</div>
              )}
            </div>
          );
        })}
      </div>

      <div data-coach="week-review" style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginTop: 8 }}>
          Обзор недели{reviewCount > 0 ? ` · ${reviewCount}` : ''}
        </div>
        {reviewCount === 0 ? (
          <div style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 4 }}>Поводов нет.</div>
        ) : (
          <>
            {week.review.lastWeekMissed.length > 0 && (
              <WeekNote title="Прошлая неделя не выполнена" tone="warn">
                {week.review.lastWeekMissed.slice(0, 6).map(x => (
                  <button
                    key={x.athleteId}
                    type="button"
                    data-coach="review-athlete"
                    onClick={() => onSelectAthlete?.(x.athleteId, x.athleteName)}
                    style={linkBtn}
                  >
                    <b style={{ color: '#fff' }}>{x.athleteName}</b> — {x.done} из {x.planned}
                  </button>
                ))}
              </WeekNote>
            )}
            {week.review.withoutPlan.length > 0 && (
              <WeekNote title="Нет программы">
                {week.review.withoutPlan.slice(0, 6).map(x => (
                  <button
                    key={x.athleteId}
                    type="button"
                    data-coach="review-athlete"
                    onClick={() => onSelectAthlete?.(x.athleteId, x.athleteName)}
                    style={linkBtn}
                  >
                    {x.athleteName}
                  </button>
                ))}
              </WeekNote>
            )}
            {week.review.noCheckinThisWeek.length > 0 && (
              <WeekNote title="Чек-ина нет на этой неделе">
                {week.review.noCheckinThisWeek.slice(0, 6).map(x => (
                  <button
                    key={x.athleteId}
                    type="button"
                    data-coach="review-athlete"
                    onClick={() => onSelectAthlete?.(x.athleteId, x.athleteName)}
                    style={linkBtn}
                  >
                    {x.athleteName} — последний {x.lastCheckin.slice(8, 10)}.{x.lastCheckin.slice(5, 7)}
                  </button>
                ))}
              </WeekNote>
            )}
            {week.review.comments.length > 0 && (
              <WeekNote title="Комментарии к неделе">
                {week.review.comments.slice(0, 6).map(c => (
                  <div key={`${c.athleteId}:${c.body}`} style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.45 }}>
                    <b style={{ color: '#fff' }}>{c.athleteName}:</b> {c.body}
                  </div>
                ))}
              </WeekNote>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** localStorage, но без исключений в приватном режиме/при переполнении. */
function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
