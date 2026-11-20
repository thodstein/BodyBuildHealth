/**
 * ProfilePlannerTab — календарь-планировщик профиля (в духе TickTick).
 *
 * Что есть: месячная сетка с точками занятости, выбор дня, задачи дня с
 * отметкой «сделано», привязка к атлету, блок «просрочено» и быстрые кнопки
 * «сегодня/завтра».
 *
 * Плюс авто-события (coach-agenda.engine): тренировки, кардио, инъекции, приём
 * БАДов, образ жизни, приёмы пищи, закупки продуктов/БАДов/фармы, контрольные
 * анализы, взвешивание и привычки приезжают в календарь сами. Человек сам
 * решает, какие источники показывать. Такие события не превращаются в задачи,
 * не отмечаются здесь и не меняют чужие дневники; единственная местная правка —
 * время события (хранится в планёре поверх времени источника).
 *
 * Чего сознательно НЕТ, чтобы не обещать лишнего:
 *  • фантомных будущих вхождений: серия появляется после закрытия задачи и
 *    только по выбранному правилу (день/через день/дни недели/интервал);
 *  • напоминаний и пушей — планёр их не отправляет;
 *  • автопереноса просроченных: задача остаётся в своём дне, пока её не закроют,
 *    и показывается отдельным блоком — «сгоревших» задач не бывает.
 *
 * Даты — только через канон core/local-date: `toISOString()` в UTC+10 вечером
 * даёт вчера и уводит задачу на сутки.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import { localIsoDate, shiftIsoDate } from '../../../core/local-date';
import { readCoachState } from '../../../engines/coach/coach-mode.engine';
import {
  COACH_MONTH_LABELS,
  COACH_PLANNER_MAX,
  COACH_PRIORITY_LABELS,
  COACH_PRIORITIES,
  COACH_REPEAT_INTERVAL_DEFAULT,
  COACH_REPEAT_INTERVAL_MAX,
  COACH_REPEAT_INTERVAL_MIN,
  COACH_REPEAT_LABELS,
  COACH_REPEATS,
  COACH_TASK_LIST_LABELS,
  COACH_TASK_LISTS,
  COACH_WEEKDAY_LABELS,
  addCoachTask,
  buildCoachMonthGrid,
  coachRepeatLabel,
  coachTaskList,
  coachTaskPriority,
  coachTaskRepeat,
  coachWeekdayIndex,
  completeCoachTask,
  countTasksByList,
  countTasksByDate,
  filterCoachTasks,
  moveCoachTask,
  overdueCoachTasks,
  readCoachPlanner,
  removeCoachTask,
  shiftCoachMonth,
  writeCoachPlanner,
  type CoachPlannerStore,
  type CoachRepeat,
  type CoachTask,
  type CoachTaskList,
  type CoachTaskPriority,
} from '../../../engines/coach/coach-planner.engine';
import {
  AGENDA_SOURCES,
  agendaSourceMeta,
  collectAgenda,
  countAgendaByDate,
  countAgendaBySource,
  readAgendaSources,
  readAgendaTimeOverrides,
  writeAgendaSources,
  writeAgendaTimeOverride,
  type AgendaSourceId,
} from '../../../engines/coach/coach-agenda.engine';

const BLUE = '#60a5fa';

const PRIORITY_COLOR: Record<CoachTaskPriority, string> = {
  none: '#64748b',
  low: '#38bdf8',
  medium: '#f59e0b',
  high: '#ef4444',
};

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

export const ProfilePlannerTab: React.FC<{ initialAthleteId?: string }> = ({ initialAthleteId }) => {
  // Не мемоизируем: приложение может жить открытым через полночь — «сегодня»
  // должно пересчитываться на следующем рендере, а не застывать на дате входа.
  const today = localIsoDate();
  const athletes = useMemo(() => readCoachState(ls()).athletes, []);
  const [store, setStore] = useState<CoachPlannerStore>(() => readCoachPlanner(ls()));
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const d = new Date(`${today}T00:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<CoachTaskPriority>('none');
  const [repeat, setRepeat] = useState<CoachRepeat>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatInterval, setRepeatInterval] = useState<number>(COACH_REPEAT_INTERVAL_DEFAULT);
  const [list, setList] = useState<CoachTaskList>('inbox');
  const [filterList, setFilterList] = useState<CoachTaskList | 'all'>('all');
  const [query, setQuery] = useState('');
  // Атлет, к которому пришли из карточки тренера; удалённая карточка — не подставляем.
  const [athleteId, setAthleteId] = useState<string>(() => {
    if (!initialAthleteId) return '';
    return athletes.some(a => a.id === initialAthleteId) ? initialAthleteId : '';
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Что подтягивать из приложения: выбор живёт отдельно от задач и не меняет
  // чужие дневники. Данные читаются заново при возврате вкладки/фокусе.
  const [sources, setSources] = useState<AgendaSourceId[]>(() => readAgendaSources(ls()));
  // Время авто-событий: поправка хранится отдельно и применяется при сборке.
  const [timeOverrides, setTimeOverrides] = useState<Record<string, string>>(() => readAgendaTimeOverrides(ls()));
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const bump = () => {
      // Другой модуль мог изменить план/дневник — перечитываем и поправки времени.
      setTimeOverrides(readAgendaTimeOverrides(ls()));
      setRefreshTick(t => t + 1);
    };
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') bump();
    };
    window.addEventListener('focus', bump);
    window.addEventListener('storage', bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', bump);
      window.removeEventListener('storage', bump);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

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

  const dayTasks = useMemo(
    () => filterCoachTasks(store, { from: selected, to: selected, list: filterList, query }),
    [store, selected, filterList, query],
  );
  const listCounts = useMemo(() => countTasksByList(store), [store]);
  const overdue = useMemo(() => overdueCoachTasks(store, today), [store, today]);
  const doneCount = dayTasks.filter(t => t.done).length;

  // Авто-события из других разделов. Только чтение: планёр их не отмечает и
  // не копирует в задачи. Диапазон — вся видимая сетка, чтобы точки в
  // календаре были честными и для соседних месяцев.
  const agenda = useMemo(() => {
    const flat = grid.flat();
    const first = flat[0]?.iso ?? selected;
    const last = flat[flat.length - 1]?.iso ?? selected;
    // Диапазон сетки + выбранный день: при листании месяца выбранный день
    // может оказаться вне сетки, и его события не должны пропадать.
    const from = first < selected ? first : selected;
    const to = last > selected ? last : selected;
    return collectAgenda(ls(), { from, to, today, sources });
    // refreshTick — осознанная зависимость: другие модули пишут в свои ключи,
    // поэтому перечитываем при возврате на вкладку, а не по таймеру.
  }, [grid, today, sources, refreshTick, selected]);
  const agendaCounts = useMemo(() => countAgendaByDate(agenda), [agenda]);
  const agendaInGrid = useMemo(() => {
    const flat = grid.flat();
    const first = flat[0]?.iso ?? selected;
    const last = flat[flat.length - 1]?.iso ?? selected;
    return agenda.filter(ev => ev.date >= first && ev.date <= last);
  }, [agenda, grid, selected]);
  const sourceCounts = useMemo(() => countAgendaBySource(agenda), [agenda]);
  const dayAgenda = useMemo(() => agenda.filter(ev => ev.date === selected), [agenda, selected]);

  const toggleSource = (id: AgendaSourceId) => {
    const next = sources.includes(id) ? sources.filter(s => s !== id) : [...sources, id];
    setSources(writeAgendaSources(ls(), next));
  };

  const enableAllSources = () => setSources(writeAgendaSources(ls(), AGENDA_SOURCES.map(s => s.id)));

  /** Выбор повтора: для «дни недели» сразу подставляем день задачи. */
  const changeRepeat = (value: CoachRepeat) => {
    setRepeat(value);
    if (value === 'weekdays' && repeatDays.length === 0) setRepeatDays([coachWeekdayIndex(selected)]);
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)));
  };

  /** Поправить время авто-события (пусто — вернуть время источника). */
  const setAutoTime = (eventId: string, value: string) => {
    setTimeOverrides(writeAgendaTimeOverride(ls(), eventId, value || null));
    setRefreshTick(t => t + 1);
  };

  const add = () => {
    const res = addCoachTask(store, {
      title,
      date: selected,
      time: time || null,
      athleteId: athleteId || null,
      priority,
      repeat,
      repeatDays: repeat === 'weekdays' ? repeatDays : undefined,
      repeatInterval: repeat === 'custom' ? repeatInterval : undefined,
      list,
    });
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
    // Задача не должна «пропадать» из-за активного фильтра другого списка.
    if (filterList !== 'all' && filterList !== list) setFilterList('all');
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

  const moveTomorrow = (t: CoachTask) => {
    apply(moveCoachTask(store, t.id, shiftIsoDate(t.date, 1)));
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
              {agendaInGrid.length > 0 ? ` · ${agendaInGrid.length} событий` : ''}
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
                const autoCount = agendaCounts[cell.iso] ?? 0;
                const total = count + autoCount;
                const isSelected = cell.iso === selected;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => selectIso(cell.iso)}
                    aria-label={`${cell.iso}${count ? `, задач: ${count}` : ''}${autoCount ? `, событий: ${autoCount}` : ''}`}
                    aria-pressed={isSelected}
                    data-planner="cell"
                    data-date={cell.iso}
                    data-count={count}
                    data-auto-count={autoCount}
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
                      {total > 0 &&
                        Array.from({ length: Math.min(total, 3) }).map((_, i) => (
                          <span
                            key={i}
                            aria-hidden="true"
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              // Свои задачи — синие/янтарные, события из разделов — лиловые.
                              background: i < Math.min(count, 3) ? (count > 3 ? '#f59e0b' : BLUE) : '#a78bfa',
                            }}
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

      {/* Фильтры списков + поиск (TickTick: списки и быстрый поиск) */}
      <div style={cardStyle} data-planner="filters">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([{ id: 'all' as const, label: 'Все', count: store.items.length }, ...COACH_TASK_LISTS.map(id => ({ id, label: COACH_TASK_LIST_LABELS[id], count: listCounts[id] }))]).map(chip => {
            const active = filterList === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterList(chip.id)}
                aria-pressed={active}
                data-planner="list-chip"
                data-list={chip.id}
                style={{
                  minHeight: 36,
                  padding: '6px 11px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 800,
                  border: `1px solid ${active ? withAlpha(BLUE, '99') : 'rgba(255,255,255,0.12)'}`,
                  background: active ? withAlpha(BLUE, '26') : 'rgba(255,255,255,0.03)',
                  color: active ? '#fff' : colors.textMuted,
                }}
              >
                {chip.label}
                <span style={{ opacity: 0.6, marginLeft: 5, fontVariantNumeric: 'tabular-nums' }}>{chip.count}</span>
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск по задачам"
          aria-label="Поиск по задачам"
          data-planner="search"
          style={{ ...inputStyle, width: '100%', marginTop: 8 }}
        />
      </div>

      {/* Что подтягивать из приложения */}
      <div style={cardStyle} data-planner="sources">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Подтягивать в планёр</div>
          <div style={{ fontSize: 11, color: colors.textSubtle }}>
            {sources.length}/{AGENDA_SOURCES.length} включено
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 }}>
          События из разделов появляются в календаре сами и перечитываются при возврате на
          вкладку. Отмечаются они в своём разделе — планёр их не меняет.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {AGENDA_SOURCES.map(src => {
            const active = sources.includes(src.id);
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => toggleSource(src.id)}
                aria-pressed={active}
                title={src.hint}
                data-planner="source-chip"
                data-source={src.id}
                data-active={active}
                style={{
                  minHeight: 36,
                  padding: '6px 11px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${active ? withAlpha(src.color, '99') : 'rgba(255,255,255,0.12)'}`,
                  background: active ? withAlpha(src.color, '26') : 'rgba(255,255,255,0.03)',
                  color: active ? '#fff' : colors.textMuted,
                  opacity: active ? 1 : 0.72,
                }}
              >
                <span aria-hidden="true">{src.icon}</span>
                {src.label}
                <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{sourceCounts[src.id]}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setRefreshTick(t => t + 1)}
            data-planner="source-refresh"
            style={{ ...btn('ghost'), fontSize: 12 }}
          >
            Обновить
          </button>
          {sources.length < AGENDA_SOURCES.length && (
            <button type="button" onClick={enableAllSources} data-planner="source-all" style={{ ...btn('ghost'), fontSize: 12 }}>
              Включить всё
            </button>
          )}
        </div>
      </div>

      {/* Задачи дня + добавление */}
      <div style={cardStyle} data-planner="day">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{fmtHuman(selected)}</div>
          <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
            {doneCount}/{dayTasks.length} сделано
            {dayAgenda.length > 0 ? ` · ${dayAgenda.length} из приложения` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {dayTasks.length === 0 && dayAgenda.length === 0 && (
            <div style={{ fontSize: 12, color: colors.textMuted }}>На этот день задач нет.</div>
          )}
          {dayTasks.length === 0 && dayAgenda.length > 0 && (
            <div style={{ fontSize: 12, color: colors.textMuted }}>Своих задач нет — ниже события из приложения.</div>
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
                border: `1px solid ${t.done ? 'rgba(255,255,255,0.09)' : withAlpha(PRIORITY_COLOR[coachTaskPriority(t)], '3d')}`,
                boxShadow: `inset 3px 0 0 ${PRIORITY_COLOR[coachTaskPriority(t)]}`,
                background: t.done ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)',
                opacity: t.done ? 0.62 : 1,
              }}
            >
              <button
                type="button"
                onClick={() => apply(completeCoachTask(store, t.id))}
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
                  {coachTaskPriority(t) !== 'none' && (
                    <span
                      aria-label={`Приоритет: ${COACH_PRIORITY_LABELS[coachTaskPriority(t)]}`}
                      style={{
                        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                        background: PRIORITY_COLOR[coachTaskPriority(t)], marginRight: 6, verticalAlign: 'middle',
                      }}
                    />
                  )}
                  {t.title}
                </div>
                {(coachTaskList(t) !== 'inbox' || coachTaskRepeat(t) !== 'none') && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                    {coachTaskList(t) !== 'inbox' && (
                      <span
                        data-planner="task-list"
                        style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 999,
                          color: '#c7d2fe', background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.35)',
                        }}
                      >
                        {COACH_TASK_LIST_LABELS[coachTaskList(t)]}
                      </span>
                    )}
                    {coachTaskRepeat(t) !== 'none' && (
                      <span
                        data-planner="task-repeat"
                        style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 999,
                          color: '#a7f3d0', background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.32)',
                        }}
                      >
                        ↻ {coachRepeatLabel(t)}
                      </span>
                    )}
                  </div>
                )}
                {nameOf(t.athleteId) && (
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>{nameOf(t.athleteId)}</div>
                )}
                {t.note && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>{t.note}</div>}
              </div>
              <button
                type="button"
                onClick={() => moveTomorrow(t)}
                aria-label="Перенести на завтра"
                title="Перенести на завтра"
                data-planner="move"
                style={{
                  flexShrink: 0,
                  minHeight: 32,
                  padding: '4px 8px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent',
                  color: colors.textMuted,
                }}
              >
                →1д
              </button>
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

        {dayAgenda.length > 0 && (
          <div
            data-planner="auto"
            style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd' }}>
                Из приложения · {dayAgenda.length}
              </div>
              <div style={{ fontSize: 10.5, color: colors.textSubtle }}>время можно поправить</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {dayAgenda.map(ev => {
                const meta = agendaSourceMeta(ev.source);
                return (
                  <div
                    key={ev.id}
                    data-planner="auto-item"
                    data-source={ev.source}
                    data-done={ev.done}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 9,
                      padding: '9px 11px',
                      borderRadius: 11,
                      border: `1px solid ${withAlpha(meta.color, '33')}`,
                      background: ev.done ? 'rgba(255,255,255,0.02)' : withAlpha(meta.color, '14'),
                      opacity: ev.done ? 0.62 : 1,
                      boxShadow: `inset 3px 0 0 ${meta.color}`,
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 13, lineHeight: '18px' }}>
                      {meta.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: '#fff',
                          wordBreak: 'break-word',
                          textDecoration: ev.done ? 'line-through' : undefined,
                        }}
                      >
                        {ev.title}
                      </div>
                      {ev.detail && (
                        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                          {ev.detail}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="time"
                        value={ev.time}
                        onChange={e => setAutoTime(ev.id, e.target.value)}
                        aria-label={`Время события: ${ev.title}`}
                        title="Время события — правка только в планёре, источник не меняется"
                        data-planner="auto-time"
                        data-event-id={ev.id}
                        style={{
                          width: 92,
                          minHeight: 32,
                          borderRadius: 9,
                          padding: '2px 6px',
                          fontSize: 11.5,
                          color: meta.color,
                          fontVariantNumeric: 'tabular-nums',
                          background: 'rgba(255,255,255,0.04)',
                          border: `1px solid ${withAlpha(meta.color, '3d')}`,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      {timeOverrides[ev.id] && (
                        <button
                          type="button"
                          onClick={() => setAutoTime(ev.id, '')}
                          aria-label="Вернуть время из источника"
                          title="Вернуть время из источника"
                          data-planner="auto-time-reset"
                          style={{
                            minHeight: 26,
                            padding: '1px 7px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: 800,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: 'transparent',
                            color: colors.textMuted,
                          }}
                        >
                          ↺ своё
                        </button>
                      )}
                      <span
                        data-planner="auto-badge"
                        style={{
                          flexShrink: 0,
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 999,
                          color: meta.color,
                          background: withAlpha(meta.color, '1f'),
                          border: `1px solid ${withAlpha(meta.color, '3d')}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {meta.short}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as CoachTaskPriority)}
              aria-label="Приоритет задачи"
              data-planner="priority"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {COACH_PRIORITIES.map(p => (
                <option key={p} value={p}>{COACH_PRIORITY_LABELS[p]}</option>
              ))}
            </select>
            <select
              value={list}
              onChange={e => setList(e.target.value as CoachTaskList)}
              aria-label="Список задачи"
              data-planner="list"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {COACH_TASK_LISTS.map(l => (
                <option key={l} value={l}>{COACH_TASK_LIST_LABELS[l]}</option>
              ))}
            </select>
            <select
              value={repeat}
              onChange={e => changeRepeat(e.target.value as CoachRepeat)}
              aria-label="Повтор задачи"
              data-planner="repeat"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {COACH_REPEATS.map(r => (
                <option key={r} value={r}>{COACH_REPEAT_LABELS[r]}</option>
              ))}
            </select>
            {repeat === 'weekdays' && (
              <div
                role="group"
                aria-label="Дни недели повтора"
                data-planner="repeat-days"
                style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}
              >
                {COACH_WEEKDAY_LABELS.map((label, day) => {
                  const active = repeatDays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleRepeatDay(day)}
                      aria-pressed={active}
                      aria-label={`Повтор: ${label}`}
                      data-planner="repeat-day"
                      data-day={day}
                      data-active={active}
                      style={{
                        minHeight: 34,
                        minWidth: 34,
                        padding: '4px 6px',
                        borderRadius: 9,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        border: `1px solid ${active ? withAlpha(BLUE, '99') : 'rgba(255,255,255,0.14)'}`,
                        background: active ? withAlpha(BLUE, '26') : 'rgba(255,255,255,0.04)',
                        color: active ? '#fff' : colors.textMuted,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {repeat === 'custom' && (
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: colors.textMuted }}
              >
                каждые
                <input
                  type="number"
                  min={COACH_REPEAT_INTERVAL_MIN}
                  max={COACH_REPEAT_INTERVAL_MAX}
                  value={repeatInterval}
                  onChange={e => setRepeatInterval(Number(e.target.value) || COACH_REPEAT_INTERVAL_DEFAULT)}
                  aria-label="Интервал повтора в днях"
                  data-planner="repeat-interval"
                  style={{ ...inputStyle, width: 78, flex: '0 0 auto', minHeight: 40 }}
                />
                дн.
              </label>
            )}
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
          Планёр — это ваш распорядок: события из разделов подтягиваются на просмотр,
          время можно поправить только здесь, планёр не меняет чужие планы и не
          отправляет уведомления.
        </span>
      </div>
    </div>
  );
};
