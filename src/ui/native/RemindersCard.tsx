/**
 * RemindersCard — ежедневные напоминания в АПК (взвешивание, еда, тренировка).
 *
 * Всё локально: Capacitor LocalNotifications, без Firebase и интернета.
 * Настройки применяются сразу (как в напоминаниях курса) — отдельной
 * кнопки «Сохранить» нет, чтобы не забыть её нажать.
 */
import React, { useState } from 'react';
import { NativeIcon } from './NativeIcons';
import {
  cancelScheduledReminders,
  scheduleDailyReminders,
  scheduleWeeklyReminders,
  type DailyReminder,
  type WeeklyReminder,
} from '../../core/native-bridge';
import {
  REMINDER_DAYS_RU,
  allReminderIds,
  dailySlots,
  defaultReminderPrefs,
  loadReminderPrefs,
  saveReminderPrefs,
  weeklySlots,
  type ReminderPrefs,
} from '../../core/reminders';

const MEAL_TITLES = ['Завтрак', 'Обед', 'Ужин'];

const timeStyle: React.CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.28)',
  color: '#fff',
  fontSize: 13,
  padding: '4px 8px',
  fontVariantNumeric: 'tabular-nums',
};

export const RemindersCard: React.FC = () => {
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => {
    const p = loadReminderPrefs();
    return p || defaultReminderPrefs();
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async (next: ReminderPrefs) => {
    setPrefs(next);
    saveReminderPrefs(next);
    setBusy(true);
    setStatus(null);
    try {
      await cancelScheduledReminders(allReminderIds());
      const daily: DailyReminder[] = dailySlots(next).map((s) =>
        s.kind === 'weigh'
          ? {
              id: s.id,
              hour: s.hour,
              minute: s.minute,
              title: 'Взвешивание',
              body: 'Утреннее взвешивание — запишите вес в дневник',
            }
          : {
              id: s.id,
              hour: s.hour,
              minute: s.minute,
              title: MEAL_TITLES[s.index] || 'Приём пищи',
              body: 'Пора поесть — отметьте приём в дневнике питания',
            },
      );
      const weekly: WeeklyReminder[] = weeklySlots(next).map((s) => ({
        id: s.id,
        weekday: s.weekday,
        hour: s.hour,
        minute: s.minute,
        title: 'Тренировка',
        body: 'Плановая тренировка — не пропустите',
      }));
      if (daily.length + weekly.length === 0) {
        setStatus('Все напоминания выключены');
        return;
      }
      const put = (await scheduleDailyReminders(daily)) + (await scheduleWeeklyReminders(weekly));
      setStatus(
        put > 0
          ? `Поставлено напоминаний: ${put}`
          : 'Уведомления недоступны — разрешите их в настройках Android',
      );
    } catch {
      setStatus('Не удалось поставить напоминания');
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (d: number) => {
    const days = prefs.workout.days.includes(d)
      ? prefs.workout.days.filter((x) => x !== d)
      : [...prefs.workout.days, d].sort((a, b) => a - b);
    void apply({ ...prefs, workout: { ...prefs.workout, days } });
  };

  const setMealTime = (i: number, time: string) => {
    const times = prefs.meals.times.slice(0, 3);
    while (times.length < 3) times.push('12:00');
    times[i] = time;
    void apply({ ...prefs, meals: { ...prefs.meals, times } });
  };

  return (
    <div className="native-feature-card" aria-label="Напоминания">
      <div className="native-feature-head">
        <span className="native-feature-icon" style={{ color: 'var(--accent-contrast)' }}>
          <NativeIcon name="bell" size={20} />
        </span>
        <div>
          <div className="native-feature-title">Напоминания</div>
          <div className="native-feature-sub">
            Локальные уведомления · работают без интернета и без Firebase
          </div>
        </div>
      </div>

      <div className="native-feature-list">
        <div className="native-feature-row">
          <span className="native-feature-row-icon"><NativeIcon name="activity" size={15} /></span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Взвешивание утром</div>
            <div className="native-feature-row-desc">Каждый день в выбранное время</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <input
              type="time"
              value={prefs.weigh.time}
              onChange={(e) => void apply({ ...prefs, weigh: { ...prefs.weigh, time: e.target.value } })}
              aria-label="Время напоминания о взвешивании"
              style={timeStyle}
            />
            <input
              type="checkbox"
              checked={prefs.weigh.enabled}
              onChange={(e) => void apply({ ...prefs, weigh: { ...prefs.weigh, enabled: e.target.checked } })}
              aria-label="Включить напоминание о взвешивании"
            />
          </div>
        </div>

        <div className="native-feature-row" style={{ alignItems: 'flex-start' }}>
          <span className="native-feature-row-icon"><NativeIcon name="bowl" size={15} /></span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Приёмы пищи</div>
            <div className="native-feature-row-desc">Завтрак, обед и ужин по своему времени</div>
            {prefs.meals.enabled && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {MEAL_TITLES.map((label, i) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, opacity: 0.85 }}>
                    <span>{label}</span>
                    <input
                      type="time"
                      value={prefs.meals.times[i] || '12:00'}
                      onChange={(e) => setMealTime(i, e.target.value)}
                      aria-label={`Время: ${label}`}
                      style={timeStyle}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          <input
            type="checkbox"
            checked={prefs.meals.enabled}
            onChange={(e) => void apply({ ...prefs, meals: { ...prefs.meals, enabled: e.target.checked } })}
            aria-label="Включить напоминания о приёмах пищи"
          />
        </div>

        <div className="native-feature-row" style={{ alignItems: 'flex-start' }}>
          <span className="native-feature-row-icon"><NativeIcon name="dumbbell" size={15} /></span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Тренировка</div>
            <div className="native-feature-row-desc">В выбранные дни недели</div>
            {prefs.workout.enabled && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {REMINDER_DAYS_RU.map((label, d) => {
                  const on = prefs.workout.days.includes(d);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(d)}
                      aria-pressed={on}
                      aria-label={`Тренировка в ${label}`}
                      style={{
                        minWidth: 38,
                        minHeight: 32,
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: on ? '#1b1033' : '#fff',
                        background: on ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                        border: on ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.18)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                <input
                  type="time"
                  value={prefs.workout.time}
                  onChange={(e) => void apply({ ...prefs, workout: { ...prefs.workout, time: e.target.value } })}
                  aria-label="Время напоминания о тренировке"
                  style={{ ...timeStyle, marginLeft: 4 }}
                />
              </div>
            )}
          </div>
          <input
            type="checkbox"
            checked={prefs.workout.enabled}
            onChange={(e) => void apply({ ...prefs, workout: { ...prefs.workout, enabled: e.target.checked } })}
            aria-label="Включить напоминания о тренировках"
          />
        </div>
      </div>

      {status && (
        <div className="native-feature-msg" role="status">
          {busy ? 'Применяю…' : status}
        </div>
      )}
    </div>
  );
};
