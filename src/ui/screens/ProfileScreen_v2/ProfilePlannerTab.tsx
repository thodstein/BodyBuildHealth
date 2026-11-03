/**
 * ProfilePlannerTab — календарь-планировщик профиля (в духе TickTick).
 *
 * Что есть: месячная сетка с точками занятости, выбор дня, задачи дня с
 * отметкой «сделано», привязка к атлету, блок «просрочено» и быстрые кнопки
 * «сегодня/завтра».
 *
 * Чего сознательно НЕТ, чтобы не обещать лишнего:
 *  • повторяющихся серий (без честного механизма повторов лучше не делать вид);
 *  • напоминаний и пушей — планёр их не отправляет;
 *  • автопереноса просроченных: задача остаётся в своём дне, пока её не закроют,
 *    и показывается отдельным блоком — «сгоревших» задач не бывает.
 *
 * Даты — только через канон core/local-date: `toISOString()` в UTC+10 вечером
 * даёт вчера и уводит задачу на сутки.
 */
import React, { useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import { localIsoDate, shiftIsoDate } from '../../../core/local-date';
import { readCoachState } from '../../../engines/coach/coach-mode.engine';
import {
  COACH_MONTH_LABELS,
  COACH_PLANNER_MAX,
  COACH_WEEKDAY_LABELS,
  addCoachTask,
  buildCoachMonthGrid,
  countTasksByDate,
  overdueCoachTasks,
  readCoachPlanner,
  removeCoachTask,
  shiftCoachMonth,
  tasksForDate,
  toggleCoachTaskDone,
  writeCoachPlanner,
  type CoachPlannerStore,
} from '../../../engines/coach/coach-planner.engine';

const BLUE = '#60a5fa';

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13.5,
  color: '#fff',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const btn = (tone: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  minHeight: 44,
  padding: '8px 14px',
  borderRadius: 12,
  fontSize: 12.5,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border:
    tone === 'primary'
      ? '1px solid transparent'
      : `1px solid ${tone === 'danger' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.14)'}`,
  color: tone === 'primary' ? '#0a1f33' : tone === 'danger' ? '#fca5a5' : 'rgba(255,255,255,0.82)',
  background:
    tone === 'primary'
      ? `linear-gradient(135deg, ${BLUE}, #3b82f6)`
      : tone === 'danger'
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(255,255,255,0.05)',
});

const fmtHuman = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
};

export const ProfilePlannerTab: React.FC = () => {
  // Не мемоизируем: приложение может жить открытым через полночь — «сегодня»
  // должно пересчитываться на следующем рендере, а не застывать на дате входа.
  const today = localIsoDate();
  const [store, setStore] = useState<CoachPlannerStore>(() => readCoachPlanner(ls()));
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const d = new Date(`${today}T00:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const athletes = useMemo(() => readCoachState(ls()).athletes, []);
  const nameOf = (id: string | null): string =>
    id ? (athletes.find(a => a.id === id)?.name ?? 'атлет удалён') : '';

  const apply = (next: CoachPlannerStore) => {
    writeCoachPlanner(ls(), next);
    setStore(next);
  };

  const grid = useMemo(() => buildCoachMonthGrid(cursor.year, cursor.month, today), [cursor, today]);
  const counts = useMemo(() => {
    const flat = grid.flat().map(c => c.iso);
    const from = flat[0] ?? selected;
    const to = flat[flat.length - 1] ?? selected;
    return countTasksByDate(store, from, to);
  }, [grid, store]);

  const dayTasks = useMemo(() => tasksForDate(store, selected), [store, selected]);
  const overdue = useMemo(() => overdueCoachTasks(store, today), [store, today]);
  const doneCount = dayTasks.filter(t => t.done).length;

  const add = () => {
    const res = addCoachTask(store, { title, date: selected, time: time || null, athleteId: athleteId || null });
    if (res.error === 'title') {
      setError('Название задачи пустое — напишите, что нужно сделать.');
      return;
    }
    if (res.error === 'date') {
      setError('Некорректная дата — выберите день в календаре.');
      return;
    }
    if (res.error === 'limit') {
      setError(`Лимит ${COACH_PLANNER_MAX} задач. Удалите старые — планёр не стирает их сам.`);
      return;
    }
    apply(res.store);
    setTitle('');
    setTime('');
    setError(null);
  };

  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      apply(removeCoachTask(store, id));
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(id);
  };

  const goMonth = (delta: number) => setCursor(c => shiftCoachMonth(c.year, c.month, delta));

  const jumpToday = () => {
    const d = new Date(`${today}T00:00:00`);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
  };

  const selectIso = (iso: string) => {
    setSelected(iso);
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(d.getTime())) setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="pf-planner" data-planner="root" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Календарь */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Предыдущий месяц"
            data-planner="prev"
            style={{ ...btn('ghost'), padding: '8px 12px' }}
          >
            ←
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }} data-planner="month">
              {COACH_MONTH_LABELS[cursor.month]} {cursor.year}
            </div>
            <div style={{ fontSize: 11, color: colors.textSubtle }}>
              {store.items.length} задач всего · {overdue.length} просрочено
            </div>
          </div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Следующий месяц"
            data-planner="next"
            style={{ ...btn('ghost'), padding: '8px 12px' }}
          >
            →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 10 }}>
          {COACH_WEEKDAY_LABELS.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: colors.textSubtle, padding: '2px 0' }}>
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }} data-planner="grid">
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {week.map(cell => {
                const count = counts[cell.iso] ?? 0;
                const isSelected = cell.iso === selected;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => selectIso(cell.iso)}
                    aria-label={`${cell.iso}${count ? `, задач: ${count}` : ''}`}
                    aria-pressed={isSelected}
                    data-planner="cell"
                    data-date={cell.iso}
                    data-count={count}
                    data-in-month={cell.inMonth}
                    data-selected={isSelected}
                    style={{
                      position: 'relative',
                      minHeight: 44,
                      borderRadius: 10,
                      cursor: 'pointer',
                      padding: '4px 2px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      border: `1px solid ${
                        isSelected
                          ? withAlpha(BLUE, '99')
                          : cell.isToday
                            ? withAlpha(BLUE, '4d')
                            : 'rgba(255,255,255,0.07)'
                      }`,
                      background: isSelected
                        ? withAlpha(BLUE, '26')
                        : cell.inMonth
                          ? 'rgba(255,255,255,0.03)'
                          : 'transparent',
                      opacity: cell.inMonth ? 1 : 0.42,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: cell.isToday || isSelected ? 800 : 600,
                        color: cell.isToday ? BLUE : cell.inMonth ? '#fff' : colors.textMuted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {cell.day}
                    </span>
                    <span style={{ display: 'flex', gap: 2, height: 5 }}>
                      {count > 0 &&
                        Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                          <span
                            key={i}
                            aria-hidden="true"
                            style={{ width: 4, height: 4, borderRadius: '50%', background: count > 3 ? '#f59e0b' : BLUE }}
                          />
                        ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={jumpToday} data-planner="today" style={{ ...btn('ghost'), fontSize: 12 }}>
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => selectIso(shiftIsoDate(today, 1))}
            data-planner="tomorrow"
            style={{ ...btn('ghost'), fontSize: 12 }}
          >
            Завтра
          </button>
        </div>
      </div>

      {/* Задачи дня + добавление */}
      <div style={cardStyle} data-planner="day">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{fmtHuman(selected)}</div>
          <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
            {doneCount}/{dayTasks.length} сделано
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {dayTasks.length === 0 && (
            <div style={{ fontSize: 12, color: colors.textMuted }}>На этот день задач нет.</div>
          )}
          {dayTasks.map(t => (
            <div
              key={t.id}
              data-planner="item"
              data-task-id={t.id}
              data-done={t.done}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.09)',
                background: t.done ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)',
                opacity: t.done ? 0.62 : 1,
              }}
            >
              <button
                type="button"
                onClick={() => apply(toggleCoachTaskDone(store, t.id))}
                aria-label={t.done ? 'Отметить невыполненной' : 'Отметить выполненной'}
                aria-pressed={t.done}
                data-planner="toggle"
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  marginTop: 2,
                  borderRadius: 9,
                  cursor: 'pointer',
                  border: `1px solid ${t.done ? withAlpha(BLUE, '99') : 'rgba(255,255,255,0.22)'}`,
                  background: t.done ? withAlpha(BLUE, '33') : 'transparent',
                  color: BLUE,
                  fontSize: 14,
                  fontWeight: 900,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {t.done ? '✓' : ''}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    textDecoration: t.done ? 'line-through' : undefined,
                    wordBreak: 'break-word',
                  }}
                >
                  {t.time && <span style={{ color: BLUE, fontVariantNumeric: 'tabular-nums', marginRight: 7 }}>{t.time}</span>}
                  {t.title}
                </div>
                {nameOf(t.athleteId) && (
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>{nameOf(t.athleteId)}</div>
                )}
                {t.note && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>{t.note}</div>}
              </div>
              <button
                type="button"
                onClick={() => askDelete(t.id)}
                aria-label="Удалить задачу"
                data-planner="delete"
                style={{
                  flexShrink: 0,
                  minHeight: 32,
                  padding: '4px 9px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  border: `1px solid ${confirmDeleteId === t.id ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  background: confirmDeleteId === t.id ? 'rgba(239,68,68,0.2)' : 'transparent',
                  color: confirmDeleteId === t.id ? '#fecaca' : colors.textMuted,
                }}
              >
                {confirmDeleteId === t.id ? 'Точно?' : '✕'}
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') add();
            }}
            placeholder={`Задача на ${fmtHuman(selected)}`}
            aria-label="Название задачи"
            data-planner="title"
            style={{ ...inputStyle, width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              aria-label="Время задачи"
              data-planner="time"
              style={{ ...inputStyle, flex: '0 0 auto', minWidth: 110 }}
            />
            {athletes.length > 0 && (
              <select
                value={athleteId}
                onChange={e => setAthleteId(e.target.value)}
                aria-label="Атлет задачи"
                data-planner="athlete"
                style={{ ...inputStyle, flex: '1 1 140px' }}
              >
                <option value="">Без атлета</option>
                {athletes.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={add} data-planner="add" style={btn('primary')}>
              + Задача
            </button>
          </div>
          {error && (
            <div role="alert" data-planner="error" style={{ fontSize: 12, color: colors.danger }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Просроченные */}
      {overdue.length > 0 && (
        <div style={{ ...cardStyle, borderColor: 'rgba(245,158,11,0.35)' }} data-planner="overdue">
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.warning }}>
            Просрочено: {overdue.length}
          </div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 }}>
            Эти задачи не переносятся автоматически и не пропадают — откройте день и закройте их
            или перенесите вручную.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {overdue.slice(0, 6).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectIso(t.date)}
                data-planner="overdue-item"
                data-date={t.date}
                style={{
                  textAlign: 'left',
                  minHeight: 40,
                  padding: '8px 10px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: '1px solid rgba(245,158,11,0.24)',
                  background: 'rgba(245,158,11,0.08)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <span style={{ color: colors.warning, fontVariantNumeric: 'tabular-nums', marginRight: 7 }}>
                  {t.date.slice(8, 10)}.{t.date.slice(5, 7)}
                </span>
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.55, padding: '0 4px', display: 'flex', gap: 6 }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', color: BLUE, flexShrink: 0, marginTop: 1 }}>
          <NativeIcon name="clock" size={13} />
        </span>
        <span>
          Планёр — это ваш распорядок: он не меняет тренировочный план и не отправляет
          уведомления сам по себе.
        </span>
      </div>
    </div>
  );
};
