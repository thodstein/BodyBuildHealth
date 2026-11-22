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
 *  • пушей и локальных уведомлений: «напоминание» — это время-подсказка в
 *    карточке, планёр ничего не отправляет;
 *  • автопереноса просроченных: задача остаётся в своём дне, пока её не закроют,
 *    и показывается отдельным блоком — «сгоревших» задач не бывает.
 *
 * TickTick-паритет (локальный, без облака и совместного доступа): теги,
 * подзадачи, закрепление, умные списки, фильтры, группировка/сортировка,
 * виды «список / канбан / матрица Эйзенхауэра», быстрый ввод на русском
 * («завтра 18:30 #здоровье !высокий») и честная статистика.
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
  COACH_QUADRANTS,
  COACH_REPEAT_INTERVAL_DEFAULT,
  COACH_REPEAT_INTERVAL_MAX,
  COACH_REPEAT_INTERVAL_MIN,
  COACH_REPEAT_LABELS,
  COACH_REPEATS,
  COACH_SMART_LISTS,
  COACH_SUBTASKS_MAX,
  COACH_SUBTASK_TITLE_MAX,
  COACH_TASK_LIST_LABELS,
  COACH_TASK_LISTS,
  COACH_WEEKDAY_LABELS,
  addCoachSubtask,
  addCoachFilter,
  addCoachTask,
  buildCoachMonthGrid,
  coachPlannerStats,
  coachQuadrant,
  coachQuickAddHints,
  coachRepeatLabel,
  coachSubtaskProgress,
  coachTaskList,
  coachTaskPriority,
  coachTaskRepeat,
  coachTaskSubtasks,
  coachTaskTags,
  coachWeekdayIndex,
  collectCoachTags,
  completeCoachTask,
  countSmartList,
  countTasksByDate,
  daysBetweenIso,
  duplicateCoachTask,
  filterCoachTasks,
  fmtCoachDateLabel,
  formatCoachTag,
  groupCoachTasks,
  moveCoachTask,
  normalizeTags,
  overdueCoachTasks,
  parseCoachQuickAdd,
  readCoachFilters,
  readCoachPlanner,
  removeCoachFilter,
  removeCoachSubtask,
  removeCoachTask,
  reorderCoachTasks,
  restoreCoachTask,
  setCoachTaskPinned,
  shiftCoachMonth,
  skipCoachRepeat,
  sortCoachTasksBy,
  tasksForDate,
  toggleCoachSubtask,
  updateCoachTask,
  writeCoachFilters,
  writeCoachPlanner,
  type CoachFilterStore,
  type CoachGroupBy,
  type CoachPlannerStore,
  type CoachRepeat,
  type CoachSavedFilter,
  type CoachSmartListId,
  type CoachSortBy,
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

/** Подписи группировки и сортировки (TickTick: Group & Sort). */
const GROUP_LABELS: Record<CoachGroupBy, string> = {
  none: 'Без групп',
  list: 'По списку',
  priority: 'По приоритету',
  tag: 'По тегу',
  date: 'По дате',
};

const SORT_LABELS: Record<CoachSortBy, string> = {
  smart: 'Умная',
  date: 'По дате',
  priority: 'По приоритету',
  created: 'По созданию',
  updated: 'По изменению',
  title: 'По названию',
  manual: 'Ручной порядок',
};

const GROUP_OPTIONS = Object.keys(GROUP_LABELS) as CoachGroupBy[];
const SORT_OPTIONS = Object.keys(SORT_LABELS) as CoachSortBy[];

type PlannerView = 'list' | 'kanban' | 'matrix';

const VIEW_LABELS: Record<PlannerView, string> = {
  list: 'Список',
  kanban: 'Канбан',
  matrix: 'Матрица',
};

interface CoachTaskDraft {
  title: string;
  note: string;
  date: string;
  time: string;
  reminder: string;
  priority: CoachTaskPriority;
  list: CoachTaskList;
  athleteId: string;
  repeat: CoachRepeat;
  repeatDays: number[];
  repeatInterval: number;
  tagsText: string;
}

const draftFromTask = (t: CoachTask): CoachTaskDraft => ({
  title: t.title,
  note: t.note,
  date: t.date,
  time: t.time ?? '',
  reminder: t.reminder ?? '',
  priority: coachTaskPriority(t),
  list: coachTaskList(t),
  athleteId: t.athleteId ?? '',
  repeat: coachTaskRepeat(t),
  repeatDays: [...(t.repeatDays ?? [])],
  repeatInterval: t.repeatInterval ?? COACH_REPEAT_INTERVAL_DEFAULT,
  tagsText: coachTaskTags(t).join(', '),
});

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
  // TickTick-паритет: умные списки, теги, вид (список/канбан/матрица),
  // группировка и сортировка.
  const [smart, setSmart] = useState<CoachSmartListId>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<CoachTaskPriority | 'all'>('all');
  const [view, setView] = useState<PlannerView>('list');
  const [groupBy, setGroupBy] = useState<CoachGroupBy>('none');
  const [sortBy, setSortBy] = useState<CoachSortBy>('smart');
  const [showDone, setShowDone] = useState(true);
  // Сохранённые фильтры (TickTick «Filters»).
  const [filters, setFilters] = useState<CoachFilterStore>(() => readCoachFilters(ls()));
  const [filterName, setFilterName] = useState('');
  // Карточка задачи: черновик правки и строка новой подзадачи.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CoachTaskDraft | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  // Атлет, к которому пришли из карточки тренера; удалённая карточка — не подставляем.
  const [athleteId, setAthleteId] = useState<string>(() => {
    if (!initialAthleteId) return '';
    return athletes.some((a) => a.id === initialAthleteId) ? initialAthleteId : '';
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Последняя удалённая задача — для «Вернуть» (удаление подтверждается, но не безвозвратно).
  const [lastDeleted, setLastDeleted] = useState<CoachTask | null>(null);
  // Ошибку карточки показываем рядом с «Сохранить», а не только в быстром вводе внизу.
  const [detailError, setDetailError] = useState<string | null>(null);
  // Просроченных бывает много: карточка показывает 6, остальные — по явному нажатию.
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  // Что подтягивать из приложения: выбор живёт отдельно от задач и не меняет
  // чужие дневники. Данные читаются заново при возврате вкладки/фокусе.
  const [sources, setSources] = useState<AgendaSourceId[]>(() => readAgendaSources(ls()));
  // Время авто-событий: поправка хранится отдельно и применяется при сборке.
  const [timeOverrides, setTimeOverrides] = useState<Record<string, string>>(() => readAgendaTimeOverrides(ls()));
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    // Фокус — другой модуль мог изменить план/дневник: перечитываем поправки
    // времени и данные разделов. Событие storage (другая вкладка) — ещё и
    // сами задачи с фильтрами, иначе вкладки расходятся.
    const bump = (reloadPlanner: boolean) => {
      if (reloadPlanner) {
        setStore(readCoachPlanner(ls()));
        setFilters(readCoachFilters(ls()));
        setSources(readAgendaSources(ls()));
      }
      setTimeOverrides(readAgendaTimeOverrides(ls()));
      setRefreshTick((t) => t + 1);
    };
    const onFocus = () => bump(false);
    const onStorage = () => bump(true);
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') bump(false);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Esc закрывает карточку или отменяет «Точно?» — не только мышью.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (confirmDeleteId) {
        setConfirmDeleteId(null);
        return;
      }
      if (detailId) {
        setDetailId(null);
        setDraft(null);
        setSubtaskDraft('');
        setDetailError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDeleteId, detailId]);

  const nameOf = (id: string | null): string => (id ? (athletes.find((a) => a.id === id)?.name ?? 'атлет удалён') : '');

  const apply = (next: CoachPlannerStore) => {
    writeCoachPlanner(ls(), next);
    setStore(next);
  };

  const grid = useMemo(() => buildCoachMonthGrid(cursor.year, cursor.month, today), [cursor, today]);
  const counts = useMemo(() => {
    const flat = grid.flat().map((c) => c.iso);
    const from = flat[0] ?? selected;
    const to = flat[flat.length - 1] ?? selected;
    // Точки календаря подчиняются «скрыть сделанные» — иначе цифра врёт.
    return countTasksByDate(store, from, to, { includeDone: showDone });
  }, [grid, store, selected, showDone]);

  /**
   * Рабочая область: выбранный день или умный список (TickTick smart list).
   * Умный список заменяет день, пока его не сбросят кликом по дате.
   */
  const scopeTasks = useMemo(() => {
    const base = filterCoachTasks(store, {
      smart: smart === 'all' ? undefined : smart,
      from: smart === 'all' ? selected : undefined,
      to: smart === 'all' ? selected : undefined,
      list: filterList,
      priority: filterPriority,
      tags: filterTags,
      query,
      includeDone: smart === 'done' ? true : showDone,
      today,
    });
    return sortBy === 'smart' ? base : sortCoachTasksBy(base, sortBy);
  }, [store, smart, selected, filterList, filterPriority, filterTags, query, showDone, sortBy, today]);
  const listChipCounts = useMemo(() => {
    // Счётчик списка — по текущему дню/умному списку, а не по всем дням:
    // иначе цифра на чипе не совпадает с тем, что видно после нажатия.
    const base = filterCoachTasks(store, {
      smart: smart === 'all' ? undefined : smart,
      from: smart === 'all' ? selected : undefined,
      to: smart === 'all' ? selected : undefined,
      priority: filterPriority,
      tags: filterTags,
      query,
      includeDone: smart === 'done' ? true : showDone,
      today,
    });
    const out = { all: base.length, inbox: 0, training: 0, health: 0, work: 0, personal: 0 };
    for (const t of base) out[coachTaskList(t)] += 1;
    return out;
  }, [store, smart, selected, filterPriority, filterTags, query, showDone, today]);
  // Прогресс не должен зависеть от «скрыть сделанные»: иначе две закрытые
  // задачи дают «0/5 сделано». Считаем по тем же фильтрам, но со всеми.
  const scopeProgress = useMemo(() => {
    const all = filterCoachTasks(store, {
      smart: smart === 'all' ? undefined : smart,
      from: smart === 'all' ? selected : undefined,
      to: smart === 'all' ? selected : undefined,
      list: filterList,
      priority: filterPriority,
      tags: filterTags,
      query,
      includeDone: true,
      today,
    });
    return { done: all.filter((t) => t.done).length, total: all.length };
  }, [store, smart, selected, filterList, filterPriority, filterTags, query, today]);
  // Сколько задач в этой области прячет именно фильтр (а не «сделано»):
  // пустой экран не должен притворяться «на этот день задач нет».
  const unfilteredTotal = useMemo(
    () =>
      filterCoachTasks(store, {
        smart: smart === 'all' ? undefined : smart,
        from: smart === 'all' ? selected : undefined,
        to: smart === 'all' ? selected : undefined,
        includeDone: true,
        today,
      }).length,
    [store, smart, selected, today],
  );
  const filtersActive =
    filterList !== 'all' || filterPriority !== 'all' || filterTags.length > 0 || query.trim().length > 0;
  const hiddenByFilters = filtersActive ? Math.max(0, unfilteredTotal - scopeProgress.total) : 0;
  // Тег-чип должен быть кликабельным не в пустоту: считаем теги только по
  // текущему дню/умному списку (остальные фильтры не учитываем, иначе чипы
  // исчезали бы во время поиска и было бы нечем расширить выборку).
  const allTags = useMemo(() => {
    const base = filterCoachTasks(store, {
      smart: smart === 'all' ? undefined : smart,
      from: smart === 'all' ? selected : undefined,
      to: smart === 'all' ? selected : undefined,
      includeDone: smart === 'done' ? true : showDone,
      today,
    });
    return collectCoachTags({ version: 1, items: base }, { includeDone: true });
  }, [store, smart, selected, showDone, today]);
  // Активный тег может исчезнуть из видимого дня — тогда его чип с нулём
  // всё равно показываем, иначе фильтр «залипает» без кнопки сброса.
  const tagChips = useMemo(() => {
    const rows = [...allTags];
    for (const tag of filterTags) {
      if (!rows.some((r) => r.tag.toLowerCase() === tag.toLowerCase())) rows.push({ tag, count: 0 });
    }
    return rows;
  }, [allTags, filterTags]);
  const smartCounts = useMemo(
    () =>
      Object.fromEntries(
        COACH_SMART_LISTS.map((s) => [
          s.id,
          // «Все» в этом планёре — выбранный день, поэтому и счётчик дневной:
          // общий счётчик по всем дням не совпадал бы со списком под чипом.
          s.id === 'all'
            ? filterCoachTasks(store, { from: selected, to: selected, includeDone: showDone, today }).length
            : // Счётчик чипа честный: скрытые сделанные не считаются, кроме «Сделано».
              countSmartList(store, s.id, today, { includeDone: s.id === 'done' || showDone }),
        ]),
      ) as Record<CoachSmartListId, number>,
    [store, today, selected, showDone],
  );
  const stats = useMemo(() => coachPlannerStats(store, today), [store, today]);
  const overdue = useMemo(() => overdueCoachTasks(store, today), [store, today]);
  // Быстрый ввод: разбор не меняет форму, пока пользователь не нажмёт «+ Задача».
  // Если служебные слова съели весь заголовок («Через день»), считаем строку
  // обычным названием: задача не должна пропадать из-за разбора.
  const quick = useMemo(() => {
    const parsed = parseCoachQuickAdd(title, today);
    if (parsed.title || !title.trim()) return parsed;
    return {
      ...parsed,
      title: title.trim(),
      date: null,
      time: null,
      tags: [],
      priority: null,
      list: null,
      repeat: null,
      repeatDays: null,
      note: '',
      matched: [],
    };
  }, [title, today]);
  const quickHints = useMemo(() => (title.trim() ? coachQuickAddHints(quick, today) : []), [quick, title, today]);
  const scopeLabel =
    smart === 'all' ? fmtHuman(selected) : (COACH_SMART_LISTS.find((s) => s.id === smart)?.label ?? 'Все');
  const detailTask = detailId ? (store.items.find((t) => t.id === detailId) ?? null) : null;
  // Границы ручного порядка: на первом/последнем месте кнопка честно выключается,
  // а не делает вид, что что-то сдвинула.
  const detailDayList = detailTask ? tasksForDate(store, detailTask.date) : [];
  const detailIndex = detailTask ? detailDayList.findIndex((t) => t.id === detailTask.id) : -1;
  const canMoveUp = detailIndex > 0;
  const canMoveDown = detailIndex >= 0 && detailIndex < detailDayList.length - 1;

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
    return agenda.filter((ev) => ev.date >= first && ev.date <= last);
  }, [agenda, grid, selected]);
  const sourceCounts = useMemo(() => countAgendaBySource(agenda), [agenda]);
  const dayAgenda = useMemo(() => agenda.filter((ev) => ev.date === selected), [agenda, selected]);

  const toggleSource = (id: AgendaSourceId) => {
    const next = sources.includes(id) ? sources.filter((s) => s !== id) : [...sources, id];
    setSources(writeAgendaSources(ls(), next));
  };

  const enableAllSources = () =>
    setSources(
      writeAgendaSources(
        ls(),
        AGENDA_SOURCES.map((s) => s.id),
      ),
    );

  /** Выбор повтора: для «дни недели» сразу подставляем день задачи. */
  const changeRepeat = (value: CoachRepeat) => {
    setRepeat(value);
    if (value === 'weekdays' && repeatDays.length === 0) setRepeatDays([coachWeekdayIndex(selected)]);
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  /** Поправить время авто-события (пусто — вернуть время источника). */
  const setAutoTime = (eventId: string, value: string) => {
    setTimeOverrides(writeAgendaTimeOverride(ls(), eventId, value || null));
    setRefreshTick((t) => t + 1);
  };

  // Куда уйдёт задача из быстрого ввода — поле и сама задача говорят одно и то же.
  const quickTargetDate =
    smart === 'today' || smart === 'next7' ? today : smart === 'tomorrow' ? shiftIsoDate(today, 1) : selected;

  const add = () => {
    // Быстрый ввод: «завтра 18:30 #здоровье !высокий @работа» разбирается здесь.
    // Распознанное в строке важнее полей формы; форма — запасной вариант.
    const parsed = quick;
    const useRepeat = parsed.repeat ?? repeat;
    // В умном списке новая задача попадает в его диапазон, а не в случайно
    // выбранный ранее день календаря.
    const targetDate = parsed.date ?? quickTargetDate;
    const nextList = parsed.list ?? list;
    const nextPriority = parsed.priority ?? priority;
    const nextTags = parsed.tags;
    const res = addCoachTask(store, {
      title: parsed.title,
      date: targetDate,
      time: time || parsed.time || null,
      athleteId: athleteId || null,
      priority: nextPriority,
      repeat: useRepeat,
      repeatDays:
        useRepeat === 'weekdays'
          ? parsed.repeat === 'weekdays' && parsed.repeatDays && parsed.repeatDays.length > 0
            ? parsed.repeatDays
            : repeatDays
          : undefined,
      repeatInterval: useRepeat === 'custom' ? (parsed.repeatInterval ?? repeatInterval) : undefined,
      list: nextList,
      tags: nextTags,
      note: parsed.note,
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
    // Задача не должна «исчезнуть» из-за текущего вида: умный список, который
    // её не покажет (другая дата/список), уступает место её дню.
    const smartHides =
      (smart === 'today' && targetDate !== today) ||
      (smart === 'tomorrow' && targetDate !== shiftIsoDate(today, 1)) ||
      (smart === 'next7' && (targetDate < today || targetDate > shiftIsoDate(today, 6))) ||
      (smart === 'inbox' && nextList !== 'inbox') ||
      smart === 'overdue' ||
      smart === 'done';
    if (smartHides) selectIso(targetDate);
    // Распознанную дату показываем сразу — задача не должна «исчезнуть».
    else if (smart === 'all' && targetDate !== selected) selectIso(targetDate);
    // И активные фильтры другого списка/приоритета/поиска тоже не должны её прятать.
    if (filterList !== 'all' && filterList !== nextList) setFilterList('all');
    if (filterPriority !== 'all' && filterPriority !== nextPriority) setFilterPriority('all');
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      const hay = [parsed.title, parsed.note, nextTags.join(' ')].join(' ').toLowerCase();
      if (!hay.includes(needle)) setQuery('');
    }
    if (filterTags.length > 0) {
      const added = nextTags.map((x) => x.toLowerCase());
      const visible = filterTags.some((tag) => added.includes(tag.toLowerCase()));
      if (!visible) setFilterTags([]);
    }
  };

  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      const victim = store.items.find((t) => t.id === id) ?? null;
      if (victim) setLastDeleted(victim);
      apply(removeCoachTask(store, id));
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(id);
  };

  /** Отмена последнего удаления: задача возвращается как была. */
  const undoDelete = () => {
    if (!lastDeleted) return;
    const next = restoreCoachTask(store, lastDeleted);
    if (next === store) {
      setError(`Не удалось вернуть задачу: лимит ${COACH_PLANNER_MAX} или она уже существует.`);
      return;
    }
    const back = lastDeleted;
    apply(next);
    setLastDeleted(null);
    setError(null);
    // Задачу вернули в её день: показываем его, иначе «Вернуть» выглядит как no-op.
    selectIso(back.date);
  };

  const goMonth = (delta: number) => setCursor((c) => shiftCoachMonth(c.year, c.month, delta));

  const jumpToday = () => {
    const d = new Date(`${today}T00:00:00`);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
    setSmart('all');
  };

  const selectIso = (iso: string) => {
    setSelected(iso);
    setSmart('all');
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(d.getTime())) setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const selectSmart = (id: CoachSmartListId) => {
    setSmart(id);
    if (id === 'done') setShowDone(true);
  };

  const toggleTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag],
    );
  };

  /** Применить сохранённый фильтр: те же состояния, что и у чипов. */
  const applySavedFilter = (id: string) => {
    const filter = filters.items.find((f) => f.id === id);
    if (!filter) return;
    setSmart(filter.smart);
    setFilterList(filter.list);
    setFilterPriority(filter.priority);
    setFilterTags([...filter.tags]);
    setQuery(filter.query);
    setShowDone(filter.includeDone);
    // Старые фильтры вид не запоминали — в этом случае оставляем текущий.
    if (filter.view) setView(filter.view);
    if (filter.groupBy) setGroupBy(filter.groupBy);
    if (filter.sortBy) setSortBy(filter.sortBy);
  };

  /** Сбросить фильтры, не трогая выбранный день и умный список. */
  const resetFilters = () => {
    setFilterList('all');
    setFilterPriority('all');
    setFilterTags([]);
    setQuery('');
  };

  /** Сохранённый фильтр подсвечиваем, только если экран действительно совпадает. */
  const isSavedFilterActive = (f: CoachSavedFilter) =>
    smart === f.smart &&
    filterList === f.list &&
    filterPriority === f.priority &&
    showDone === f.includeDone &&
    query.trim() === f.query.trim() &&
    filterTags.length === f.tags.length &&
    filterTags.every((t) => f.tags.some((x) => x.toLowerCase() === t.toLowerCase())) &&
    (f.view === undefined || view === f.view) &&
    (f.groupBy === undefined || groupBy === f.groupBy) &&
    (f.sortBy === undefined || sortBy === f.sortBy);

  const saveFilter = () => {
    const res = addCoachFilter(filters, {
      name: filterName,
      smart,
      list: filterList,
      priority: filterPriority,
      tags: filterTags,
      query,
      includeDone: showDone,
      view,
      groupBy,
      sortBy,
    });
    if (res.error === 'name') {
      setError('Название фильтра пустое — напишите, как его узнать.');
      return;
    }
    if (res.error === 'limit') {
      setError('Слишком много фильтров — удалите один из старых.');
      return;
    }
    setFilters(writeCoachFilters(ls(), res.store));
    setFilterName('');
    setError(null);
  };

  const deleteFilter = (id: string) => setFilters(writeCoachFilters(ls(), removeCoachFilter(filters, id)));

  /** Ручной порядок: поднять/опустить задачу в своём дне (аналог drag). */
  const moveInDay = (t: CoachTask, direction: -1 | 1) => {
    const list = tasksForDate(store, t.date);
    const index = list.findIndex((x) => x.id === t.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    // Иначе при сортировке «по названию» нажатие выглядело бы как «ничего не произошло».
    setSortBy('manual');
    if (direction === -1) {
      apply(reorderCoachTasks(store, t.id, list[index - 1].id));
      return;
    }
    const after = list[index + 2];
    apply(reorderCoachTasks(store, t.id, after ? after.id : null));
  };

  const openDetails = (t: CoachTask) => {
    if (detailId === t.id) {
      setDetailId(null);
      setDraft(null);
      setSubtaskDraft('');
      setDetailError(null);
      return;
    }
    setDetailId(t.id);
    setDraft(draftFromTask(t));
    setSubtaskDraft('');
    setDetailError(null);
  };

  const closeDetails = () => {
    setDetailId(null);
    setDraft(null);
    setSubtaskDraft('');
    setDetailError(null);
  };

  /** Увести текущее вхождение серии на следующую дату, не закрывая задачу. */
  const skipOccurrence = () => {
    if (!detailTask) return;
    const nextStore = skipCoachRepeat(store, detailTask.id);
    if (nextStore === store) return;
    const moved = nextStore.items.find((t) => t.id === detailTask.id);
    apply(nextStore);
    closeDetails();
    // Задача не должна «исчезнуть»: показываем день, куда она уехала.
    if (moved) selectIso(moved.date);
  };

  /** Поля карточки → патч задачи (одно место для сохранения и дублирования). */
  const patchFromDraft = (d: CoachTaskDraft) => ({
    title: d.title.trim(),
    note: d.note,
    date: d.date,
    time: d.time || null,
    reminder: d.reminder || null,
    priority: d.priority,
    list: d.list,
    athleteId: d.athleteId || null,
    repeat: d.repeat,
    repeatDays: d.repeat === 'weekdays' ? d.repeatDays : undefined,
    repeatInterval: d.repeat === 'custom' ? d.repeatInterval : undefined,
    tags: normalizeTags(d.tagsText.split(/[,;]+|\s+/)),
  });

  const saveDetails = () => {
    if (!detailId || !draft || !detailTask) return;
    const title = draft.title.trim();
    if (!title) {
      setDetailError('Название задачи пустое — напишите, что нужно сделать.');
      return;
    }
    const next = updateCoachTask(store, detailId, patchFromDraft(draft));
    if (next === store) {
      setDetailError('Проверьте дату — такая не существует.');
      return;
    }
    const movedToAnotherDay = draft.date !== detailTask.date;
    const saved = next.items.find((t) => t.id === detailId);
    apply(next);
    setError(null);
    // Правка не должна «терять» задачу под фильтром, который её больше не показывает.
    if (saved) {
      if (filterList !== 'all' && filterList !== coachTaskList(saved)) setFilterList('all');
      if (filterPriority !== 'all' && filterPriority !== coachTaskPriority(saved)) setFilterPriority('all');
      if (query.trim()) {
        const needle = query.trim().toLowerCase();
        const hay = [saved.title, saved.note ?? '', coachTaskTags(saved).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(needle)) setQuery('');
      }
      if (filterTags.length > 0) {
        const savedTags = coachTaskTags(saved).map((x) => x.toLowerCase());
        if (!filterTags.some((tag) => savedTags.includes(tag.toLowerCase()))) setFilterTags([]);
      }
    }
    closeDetails();
    // Перенесли на другой день или убрали из «Входящих» — показываем день задачи,
    // иначе она «исчезнет» из текущего списка без объяснения.
    const leftInbox = smart === 'inbox' && saved !== undefined && coachTaskList(saved) !== 'inbox';
    if (movedToAnotherDay || leftInbox) selectIso(saved ? saved.date : draft.date);
  };

  const addSubtask = () => {
    if (!detailId) return;
    const clean = subtaskDraft.trim();
    if (!clean) return;
    apply(addCoachSubtask(store, detailId, clean));
    setSubtaskDraft('');
  };

  /** Дублировать: сохраняем правки карточки и сразу открываем копию. */
  const duplicateDetails = () => {
    if (!detailId || !draft || !detailTask) return;
    if (!draft.title.trim()) {
      setDetailError('Название задачи пустое — напишите, что нужно сделать.');
      return;
    }
    const updated = updateCoachTask(store, detailId, patchFromDraft(draft));
    if (updated === store) {
      setDetailError('Проверьте дату — такая не существует.');
      return;
    }
    const next = duplicateCoachTask(updated, detailId);
    if (next === updated) {
      setDetailError(`Не удалось дублировать: лимит ${COACH_PLANNER_MAX} задач.`);
      return;
    }
    apply(next);
    setError(null);
    setDetailError(null);
    // Копию обычно переименовывают — открываем её вместо оригинала.
    const copy = next.items[next.items.length - 1];
    setDetailId(copy.id);
    setDraft(draftFromTask(copy));
    setSubtaskDraft('');
  };

  const moveTomorrow = (t: CoachTask) => {
    // В умном списке «завтра» — это завтрашний день, а не «дата задачи + 1»:
    // иначе просроченная задача из «Просрочено» осталась бы в прошлом.
    const target = smart === 'all' ? shiftIsoDate(t.date, 1) : shiftIsoDate(today, 1);
    apply(moveCoachTask(store, t.id, target));
  };

  const renderTask = (t: CoachTask) => {
    const sub = coachSubtaskProgress(t);
    const tags = coachTaskTags(t);
    const priority = coachTaskPriority(t);
    const isOpen = detailId === t.id;
    return (
      <div
        key={t.id}
        data-planner="item"
        data-task-id={t.id}
        data-done={t.done}
        data-pinned={t.pinned === true}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          border: `1px solid ${t.done ? 'rgba(255,255,255,0.09)' : withAlpha(PRIORITY_COLOR[priority], '3d')}`,
          boxShadow: `inset 3px 0 0 ${PRIORITY_COLOR[priority]}`,
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
            {t.pinned === true && (
              <span aria-label="Закреплено" title="Закреплено" data-planner="pinned-badge" style={{ marginRight: 5 }}>
                📌
              </span>
            )}
            {t.time && (
              <span style={{ color: BLUE, fontVariantNumeric: 'tabular-nums', marginRight: 7 }}>{t.time}</span>
            )}
            {priority !== 'none' && (
              <span
                aria-label={`Приоритет: ${COACH_PRIORITY_LABELS[priority]}`}
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: PRIORITY_COLOR[priority],
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
            )}
            {t.title}
          </div>
          {(coachTaskList(t) !== 'inbox' ||
            coachTaskRepeat(t) !== 'none' ||
            tags.length > 0 ||
            sub.total > 0 ||
            t.reminder) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
              {coachTaskList(t) !== 'inbox' && (
                <span
                  data-planner="task-list"
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    color: '#c7d2fe',
                    background: 'rgba(99,102,241,0.16)',
                    border: '1px solid rgba(99,102,241,0.35)',
                  }}
                >
                  {COACH_TASK_LIST_LABELS[coachTaskList(t)]}
                </span>
              )}
              {coachTaskRepeat(t) !== 'none' && (
                <span
                  data-planner="task-repeat"
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    color: '#a7f3d0',
                    background: 'rgba(16,185,129,0.14)',
                    border: '1px solid rgba(16,185,129,0.32)',
                  }}
                >
                  ↻ {coachRepeatLabel(t)}
                </span>
              )}
              {sub.total > 0 && (
                <span
                  data-planner="subtask-progress"
                  data-done={sub.done}
                  data-total={sub.total}
                  title="Подзадачи"
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    color: sub.done === sub.total ? '#bbf7d0' : '#fde68a',
                    background: sub.done === sub.total ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.12)',
                    border: `1px solid ${sub.done === sub.total ? 'rgba(34,197,94,0.32)' : 'rgba(245,158,11,0.3)'}`,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ☑ {sub.done}/{sub.total}
                </span>
              )}
              {t.reminder && (
                <span
                  data-planner="task-reminder"
                  title="Время-подсказка в карточке: планёр не отправляет уведомления"
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    color: '#fbcfe8',
                    background: 'rgba(236,72,153,0.12)',
                    border: '1px solid rgba(236,72,153,0.3)',
                  }}
                >
                  ⏰ {t.reminder}
                </span>
              )}
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  data-planner="tag"
                  data-tag={tag}
                  aria-label={`Фильтр по тегу ${formatCoachTag(tag)}`}
                  aria-pressed={filterTags.some((t) => t.toLowerCase() === tag.toLowerCase())}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTag(tag);
                  }}
                  style={{
                    font: 'inherit',
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    color: '#fde68a',
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.3)',
                  }}
                >
                  {formatCoachTag(tag)}
                </button>
              ))}
            </div>
          )}
          {nameOf(t.athleteId) && (
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>{nameOf(t.athleteId)}</div>
          )}
          {t.note && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>{t.note}</div>}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, auto)',
            gap: 4,
            justifyContent: 'end',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => apply(setCoachTaskPinned(store, t.id, t.pinned !== true))}
            aria-label={t.pinned === true ? 'Открепить задачу' : 'Закрепить задачу'}
            aria-pressed={t.pinned === true}
            title={t.pinned === true ? 'Открепить' : 'Закрепить сверху дня'}
            data-planner="pin"
            data-pinned={t.pinned === true}
            style={{
              minHeight: 32,
              padding: '4px 8px',
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 800,
              border: `1px solid ${t.pinned === true ? withAlpha(BLUE, '88') : 'rgba(255,255,255,0.12)'}`,
              background: t.pinned === true ? withAlpha(BLUE, '22') : 'transparent',
              color: t.pinned === true ? '#fff' : colors.textMuted,
            }}
          >
            📌
          </button>
          <button
            type="button"
            onClick={() => openDetails(t)}
            aria-label="Открыть задачу"
            aria-expanded={isOpen}
            title="Открыть: заметка, теги, подзадачи"
            data-planner="open"
            data-open={isOpen}
            style={{
              minHeight: 32,
              padding: '4px 8px',
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 800,
              border: `1px solid ${isOpen ? withAlpha(BLUE, '88') : 'rgba(255,255,255,0.12)'}`,
              background: isOpen ? withAlpha(BLUE, '22') : 'transparent',
              color: isOpen ? '#fff' : colors.textMuted,
            }}
          >
            ⋯
          </button>
          <button
            type="button"
            onClick={() => moveTomorrow(t)}
            aria-label={smart === 'all' ? 'Перенести на следующий день' : 'Перенести на завтра'}
            title={smart === 'all' ? 'Перенести на следующий день' : 'Перенести на завтра'}
            data-planner="move"
            style={{
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
      </div>
    );
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
          {COACH_WEEKDAY_LABELS.map((w) => (
            <div
              key={w}
              style={{
                textAlign: 'center',
                fontSize: 10.5,
                fontWeight: 800,
                color: colors.textSubtle,
                padding: '2px 0',
              }}
            >
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }} data-planner="grid">
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {week.map((cell) => {
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
                              background: i < Math.min(count, 3) ? (count >= 3 ? '#f59e0b' : BLUE) : '#a78bfa',
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

        <div
          data-planner="grid-legend"
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 10, color: colors.textSubtle }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: BLUE }} />
            свои задачи
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
            3+ задач
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa' }} />
            из приложения
          </span>
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

      {/* Умные списки, списки, теги и вид (TickTick) */}
      <div style={cardStyle} data-planner="filters">
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>Умные списки</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }} data-planner="smart-lists">
          {COACH_SMART_LISTS.map((s) => {
            const active = smart === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSmart(s.id)}
                aria-pressed={active}
                title={s.id === 'all' ? 'Задачи выбранного дня' : s.hint}
                data-planner="smart-chip"
                data-smart={s.id}
                data-active={active}
                data-count={smartCounts[s.id]}
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
                {s.id === 'all' ? 'День' : s.label}
                <span style={{ opacity: 0.6, marginLeft: 5, fontVariantNumeric: 'tabular-nums' }}>
                  {smartCounts[s.id]}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: colors.textSubtle, marginTop: 6, lineHeight: 1.45 }}>
          «День» — задачи выбранной даты. Умный список показывает задачи по всем дням; клик по дате в календаре
          возвращает день.
        </div>
        {smartCounts.overdue > 0 && smart !== 'overdue' && (
          <div
            data-planner="overdue-hint"
            style={{ fontSize: 10.5, color: colors.textSubtle, marginTop: 4, lineHeight: 1.45 }}
          >
            Просроченные не переносятся сами — их {smartCounts.overdue}, все в списке «Просрочено».
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {[
            { id: 'all' as const, label: 'Все', count: listChipCounts.all },
            ...COACH_TASK_LISTS.map((id) => ({ id, label: COACH_TASK_LIST_LABELS[id], count: listChipCounts[id] })),
          ].map((chip) => {
            const active = filterList === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterList(chip.id)}
                aria-pressed={active}
                data-planner="list-chip"
                data-list={chip.id}
                data-count={chip.count}
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

        {tagChips.length > 0 && (
          <div
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}
            data-planner="tag-filters"
          >
            {tagChips.map(({ tag, count }) => {
              const active = filterTags.some((t) => t.toLowerCase() === tag.toLowerCase());
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={active}
                  title={count === 0 ? 'В этом дне задач с таким тегом нет' : undefined}
                  data-planner="tag-chip"
                  data-tag={tag}
                  data-active={active}
                  data-count={count}
                  style={{
                    minHeight: 32,
                    padding: '4px 10px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 800,
                    border: `1px solid ${active ? 'rgba(245,158,11,0.7)' : 'rgba(245,158,11,0.28)'}`,
                    background: active ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)',
                    color: active ? '#fde68a' : colors.textMuted,
                  }}
                >
                  {formatCoachTag(tag)}
                  <span style={{ opacity: 0.65, marginLeft: 5, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                </button>
              );
            })}
            {filterTags.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterTags([])}
                data-planner="tag-clear"
                style={{ ...btn('ghost'), minHeight: 32, padding: '4px 10px', fontSize: 11 }}
              >
                Сбросить теги
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as CoachTaskPriority | 'all')}
            aria-label="Фильтр по приоритету"
            data-planner="priority-filter"
            style={{ ...inputStyle, minHeight: 36, flex: '0 1 auto' }}
          >
            <option value="all">Любой приоритет</option>
            {COACH_PRIORITIES.filter((p) => p !== 'none').map((p) => (
              <option key={p} value={p}>
                {COACH_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Название фильтра"
            aria-label="Название фильтра"
            data-planner="filter-name"
            style={{ ...inputStyle, minHeight: 36, flex: '1 1 140px' }}
          />
          <button
            type="button"
            onClick={saveFilter}
            data-planner="filter-save"
            style={{ ...btn('ghost'), minHeight: 36, padding: '4px 10px', fontSize: 11 }}
          >
            Сохранить фильтр
          </button>
        </div>
        {filters.items.length > 0 && (
          <div data-planner="saved-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {filters.items.map((f) => {
              const active = isSavedFilterActive(f);
              return (
                <span
                  key={f.id}
                  data-planner="filter-item"
                  data-filter={f.id}
                  data-active={active}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: 999,
                    border: `1px solid ${active ? 'rgba(167,139,250,0.9)' : 'rgba(167,139,250,0.4)'}`,
                    background: active ? 'rgba(167,139,250,0.28)' : 'rgba(167,139,250,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => applySavedFilter(f.id)}
                    aria-pressed={active}
                    title={active ? 'Этот фильтр сейчас применён' : 'Применить фильтр'}
                    data-planner="filter-chip"
                    data-filter={f.id}
                    data-active={active}
                    style={{
                      minHeight: 32,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      border: 'none',
                      background: 'transparent',
                      color: active ? '#fff' : '#ddd6fe',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFilter(f.id)}
                    aria-label={`Удалить фильтр: ${f.name}`}
                    data-planner="filter-remove"
                    data-filter={f.id}
                    style={{
                      minHeight: 32,
                      padding: '4px 9px',
                      cursor: 'pointer',
                      border: 'none',
                      borderLeft: '1px solid rgba(167,139,250,0.3)',
                      background: 'transparent',
                      color: colors.textMuted,
                      fontSize: 10.5,
                      fontWeight: 800,
                    }}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по задачам, заметкам, тегам"
          aria-label="Поиск по задачам"
          data-planner="search"
          style={{ ...inputStyle, width: '100%', marginTop: 8 }}
        />

        {query.trim() && (
          <div
            data-planner="search-scope"
            style={{ fontSize: 10.5, color: colors.textSubtle, marginTop: 4, lineHeight: 1.45 }}
          >
            {smart === 'all'
              ? `Поиск идёт по выбранному дню — ${fmtHuman(selected)}; другие дни не затрагиваются.`
              : `Поиск идёт внутри списка «${scopeLabel}».`}
          </div>
        )}

        {filtersActive && (
          <div
            data-planner="filter-status"
            role="status"
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 8,
              fontSize: 11.5,
              color: colors.textMuted,
            }}
          >
            <span>
              {hiddenByFilters > 0 ? `Скрыто фильтрами: ${hiddenByFilters} из ${unfilteredTotal}` : 'Фильтры включены'}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              data-planner="filter-reset"
              style={{ ...btn('ghost'), minHeight: 32, padding: '2px 10px', fontSize: 11 }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          <div
            role="group"
            aria-label="Вид задач"
            data-planner="views"
            style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
          >
            {(Object.keys(VIEW_LABELS) as PlannerView[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={active}
                  data-planner="view"
                  data-view={v}
                  data-active={active}
                  style={{
                    minHeight: 36,
                    padding: '6px 11px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 800,
                    border: `1px solid ${active ? withAlpha(BLUE, '99') : 'rgba(255,255,255,0.12)'}`,
                    background: active ? withAlpha(BLUE, '26') : 'rgba(255,255,255,0.03)',
                    color: active ? '#fff' : colors.textMuted,
                  }}
                >
                  {VIEW_LABELS[v]}
                </button>
              );
            })}
          </div>
          {view === 'list' && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as CoachGroupBy)}
              aria-label="Группировка задач"
              data-planner="group-by"
              style={{ ...inputStyle, minHeight: 36, flex: '0 1 auto' }}
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CoachSortBy)}
            aria-label="Сортировка задач"
            data-planner="sort-by"
            style={{ ...inputStyle, minHeight: 36, flex: '0 1 auto' }}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
          {smart === 'done' ? (
            <span
              data-planner="show-done-note"
              style={{ fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.4, maxWidth: 200 }}
            >
              В «Сделано» скрывать нечего — это и есть сделанные задачи.
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-pressed={!showDone}
              data-planner="show-done"
              data-hidden={!showDone}
              style={{ ...btn('ghost'), minHeight: 36, padding: '4px 10px', fontSize: 11 }}
            >
              {showDone ? 'Скрыть сделанные' : 'Показать сделанные'}
            </button>
          )}
        </div>
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
          События из разделов появляются в календаре сами и перечитываются при возврате на вкладку. Отмечаются они в
          своём разделе — планёр их не меняет.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {AGENDA_SOURCES.map((src) => {
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
            onClick={() => setRefreshTick((t) => t + 1)}
            data-planner="source-refresh"
            style={{ ...btn('ghost'), fontSize: 12 }}
          >
            Обновить
          </button>
          {sources.length < AGENDA_SOURCES.length && (
            <button
              type="button"
              onClick={enableAllSources}
              data-planner="source-all"
              style={{ ...btn('ghost'), fontSize: 12 }}
            >
              Включить всё
            </button>
          )}
        </div>
      </div>

      {/* Задачи: день или умный список; виды «список / канбан / матрица» */}
      <div style={cardStyle} data-planner="day" data-view={view} data-smart={smart}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }} data-planner="scope-label">
            {scopeLabel}
          </div>
          <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
            {scopeProgress.done}/{scopeProgress.total} сделано
            {smart === 'all' && dayAgenda.length > 0 ? ` · ${dayAgenda.length} из приложения` : ''}
          </div>
        </div>

        {lastDeleted && (
          <div
            data-planner="undo-delete"
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 8,
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)',
              fontSize: 11.5,
              color: '#fecaca',
            }}
          >
            <span style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word' }}>
              Удалено: «{lastDeleted.title}»
            </span>
            <button
              type="button"
              onClick={undoDelete}
              data-planner="undo-delete-button"
              style={{ ...btn('ghost'), minHeight: 32, padding: '2px 10px', fontSize: 11, color: '#fff' }}
            >
              Вернуть
            </button>
            <button
              type="button"
              onClick={() => setLastDeleted(null)}
              aria-label="Скрыть сообщение об удалении"
              data-planner="undo-dismiss"
              style={{ ...btn('ghost'), minHeight: 32, padding: '2px 8px', fontSize: 11 }}
            >
              ✕
            </button>
          </div>
        )}

        {scopeTasks.length === 0 && scopeProgress.total > 0 && (
          <div data-planner="hidden-done" style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
            Все задачи здесь уже сделаны — включите «Показать сделанные», чтобы их увидеть.
          </div>
        )}

        {view === 'list' && groupBy === 'none' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {scopeTasks.length === 0 && scopeProgress.total === 0 && (
              <div data-planner="empty-hint" style={{ fontSize: 12, color: colors.textMuted }}>
                {filtersActive && unfilteredTotal > 0
                  ? `Под фильтры ничего не подходит — скрыто ${hiddenByFilters} из ${unfilteredTotal}.`
                  : smart !== 'all'
                    ? 'В этом списке задач нет.'
                    : dayAgenda.length > 0
                      ? 'Своих задач нет — ниже события из приложения.'
                      : 'На этот день задач нет.'}
              </div>
            )}
            {scopeTasks.map((t) => renderTask(t))}
          </div>
        )}

        {view === 'list' && groupBy !== 'none' && (
          <div data-planner="groups" style={{ marginTop: 10 }}>
            {scopeTasks.length === 0 && scopeProgress.total === 0 && (
              <div data-planner="empty-hint" style={{ fontSize: 12, color: colors.textMuted }}>
                {filtersActive && unfilteredTotal > 0
                  ? `Под фильтры ничего не подходит — скрыто ${hiddenByFilters} из ${unfilteredTotal}.`
                  : smart !== 'all'
                    ? 'В этом списке задач нет.'
                    : 'На этот день задач нет.'}
              </div>
            )}
            {groupCoachTasks(scopeTasks, groupBy).map((group) => (
              <div key={group.key} data-planner="group" data-group={group.key} style={{ marginTop: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: colors.textSubtle, letterSpacing: 0.2 }}>
                    {group.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                    {group.items.length}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {group.items.map((t) => renderTask(t))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'kanban' && (
          <div
            data-planner="kanban"
            style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, paddingBottom: 4 }}
          >
            {COACH_TASK_LISTS.map((listId) => {
              const items = scopeTasks.filter((t) => coachTaskList(t) === listId);
              return (
                <div
                  key={listId}
                  data-planner="kanban-column"
                  data-list={listId}
                  data-count={items.length}
                  style={{
                    flex: '0 0 236px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 8,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 6,
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: '#c7d2fe',
                    }}
                  >
                    <span>{COACH_TASK_LIST_LABELS[listId]}</span>
                    <span style={{ color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
                  </div>
                  {items.length === 0 && (
                    <div
                      data-planner="kanban-empty"
                      style={{ fontSize: 11, color: colors.textSubtle, padding: '6px 2px', lineHeight: 1.4 }}
                    >
                      Пусто — {filtersActive ? 'под фильтры задач нет' : 'новых задач в этом списке нет'}
                    </div>
                  )}
                  {items.map((t) => renderTask(t))}
                </div>
              );
            })}
          </div>
        )}

        {view === 'matrix' && (
          <div
            data-planner="matrix"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}
          >
            {COACH_QUADRANTS.map((q) => {
              const items = scopeTasks.filter((t) => coachQuadrant(t, today) === q.id);
              return (
                <div
                  key={q.id}
                  data-planner="matrix-cell"
                  data-quadrant={q.id}
                  data-count={items.length}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 8,
                    borderRadius: 12,
                    border: `1px solid ${withAlpha(q.color, '3d')}`,
                    background: withAlpha(q.color, '0d'),
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: q.color }}>
                    {q.label}
                    <span style={{ color: colors.textSubtle, marginLeft: 5, fontVariantNumeric: 'tabular-nums' }}>
                      {items.length}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: -4 }}>{q.hint}</div>
                  {items.length === 0 && (
                    <div
                      data-planner="matrix-empty"
                      style={{ fontSize: 11, color: colors.textSubtle, lineHeight: 1.4 }}
                    >
                      {filtersActive ? 'Под фильтры здесь задач нет' : 'Нет задач в этом квадранте'}
                    </div>
                  )}
                  {items.map((t) => renderTask(t))}
                </div>
              );
            })}
          </div>
        )}

        {detailTask && draft && (
          <div
            data-planner="detail"
            data-task-id={detailTask.id}
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>Задача · подробно</div>
              <button
                type="button"
                onClick={closeDetails}
                data-planner="detail-close"
                style={{ ...btn('ghost'), minHeight: 32, padding: '2px 10px', fontSize: 11 }}
              >
                Закрыть
              </button>
            </div>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
              placeholder="Название"
              aria-label="Название задачи в карточке"
              data-planner="detail-title"
              style={{ ...inputStyle, width: '100%' }}
            />
            <textarea
              value={draft.note}
              onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))}
              placeholder="Заметка"
              aria-label="Заметка задачи"
              data-planner="detail-note"
              rows={3}
              style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((d) => (d ? { ...d, date: e.target.value } : d))}
                aria-label="Дата задачи в карточке"
                data-planner="detail-date"
                style={{ ...inputStyle, minWidth: 148 }}
              />
              <input
                type="time"
                value={draft.time}
                onChange={(e) => setDraft((d) => (d ? { ...d, time: e.target.value } : d))}
                aria-label="Время задачи в карточке"
                title="Время задачи"
                data-planner="detail-time"
                style={{ ...inputStyle, minWidth: 108 }}
              />
              <input
                type="time"
                value={draft.reminder}
                onChange={(e) => setDraft((d) => (d ? { ...d, reminder: e.target.value } : d))}
                aria-label="Время-подсказка задачи"
                title="Время-подсказка в карточке: планёр не отправляет уведомления"
                data-planner="detail-reminder"
                style={{ ...inputStyle, minWidth: 108 }}
              />
              <select
                value={draft.priority}
                onChange={(e) => setDraft((d) => (d ? { ...d, priority: e.target.value as CoachTaskPriority } : d))}
                aria-label="Приоритет задачи в карточке"
                data-planner="detail-priority"
                style={{ ...inputStyle, flex: '0 0 auto' }}
              >
                {COACH_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {COACH_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              <select
                value={draft.list}
                onChange={(e) => setDraft((d) => (d ? { ...d, list: e.target.value as CoachTaskList } : d))}
                aria-label="Список задачи в карточке"
                data-planner="detail-list"
                style={{ ...inputStyle, flex: '0 0 auto' }}
              >
                {COACH_TASK_LISTS.map((l) => (
                  <option key={l} value={l}>
                    {COACH_TASK_LIST_LABELS[l]}
                  </option>
                ))}
              </select>
              {athletes.length > 0 && (
                <select
                  value={draft.athleteId}
                  onChange={(e) => setDraft((d) => (d ? { ...d, athleteId: e.target.value } : d))}
                  aria-label="Атлет задачи в карточке"
                  data-planner="detail-athlete"
                  style={{ ...inputStyle, flex: '0 1 auto' }}
                >
                  <option value="">Без атлета</option>
                  {/* Удалённого атлета показываем, чтобы привязка не «врала» пустым полем. */}
                  {draft.athleteId && !athletes.some((a) => a.id === draft.athleteId) && (
                    <option value={draft.athleteId}>{nameOf(draft.athleteId)}</option>
                  )}
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={draft.repeat}
                onChange={(e) => {
                  const value = e.target.value as CoachRepeat;
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          repeat: value,
                          repeatDays:
                            value === 'weekdays' && d.repeatDays.length === 0
                              ? [coachWeekdayIndex(d.date)]
                              : d.repeatDays,
                        }
                      : d,
                  );
                }}
                aria-label="Повтор задачи в карточке"
                data-planner="detail-repeat"
                style={{ ...inputStyle, flex: '0 0 auto' }}
              >
                {COACH_REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {COACH_REPEAT_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {draft.repeat === 'weekdays' && (
              <div
                role="group"
                aria-label="Дни недели повтора в карточке"
                data-planner="detail-repeat-days"
                style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
              >
                {COACH_WEEKDAY_LABELS.map((label, day) => {
                  const active = draft.repeatDays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                repeatDays: d.repeatDays.includes(day)
                                  ? d.repeatDays.filter((x) => x !== day)
                                  : [...d.repeatDays, day].sort((a, b) => a - b),
                              }
                            : d,
                        )
                      }
                      aria-pressed={active}
                      aria-label={`Повтор в карточке: ${label}`}
                      data-planner="detail-repeat-day"
                      data-day={day}
                      data-active={active}
                      style={{
                        minHeight: 32,
                        minWidth: 32,
                        padding: '3px 6px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 10.5,
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
            {draft.repeat === 'custom' && (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  color: colors.textMuted,
                }}
              >
                каждые
                <input
                  type="number"
                  min={COACH_REPEAT_INTERVAL_MIN}
                  max={COACH_REPEAT_INTERVAL_MAX}
                  value={draft.repeatInterval}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, repeatInterval: Number(e.target.value) || COACH_REPEAT_INTERVAL_DEFAULT } : d,
                    )
                  }
                  aria-label="Интервал повтора в карточке"
                  data-planner="detail-repeat-interval"
                  style={{ ...inputStyle, width: 78, minHeight: 40 }}
                />
                дн.
              </label>
            )}
            {coachTaskRepeat(detailTask) !== 'none' && !detailTask.done && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={skipOccurrence}
                  data-planner="detail-skip"
                  title="Сдвинуть серию на следующую дату, не отмечая задачу сделанной"
                  style={{ ...btn('ghost'), minHeight: 36, padding: '4px 10px', fontSize: 11.5 }}
                >
                  → Следующее вхождение
                </button>
                <span style={{ fontSize: 10.5, color: colors.textSubtle }}>
                  Не отмечает сделанной — просто сдвигает серию.
                  {coachTaskSubtasks(detailTask).length > 0 ? ' Чеклист начнётся заново.' : ''}
                </span>
              </div>
            )}
            <input
              value={draft.tagsText}
              onChange={(e) => setDraft((d) => (d ? { ...d, tagsText: e.target.value } : d))}
              placeholder="Теги: здоровье, зал"
              aria-label="Теги задачи"
              data-planner="detail-tags"
              style={{ ...inputStyle, width: '100%' }}
            />
            <div style={{ fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}>
              Теги — через запятую, до 10 штук. Второе поле времени — «время-подсказка»: это бейдж в карточке, пуши и
              локальные уведомления планёр не отправляет.
            </div>

            <div data-planner="subtasks">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                Подзадачи
                {coachSubtaskProgress(detailTask).total > 0
                  ? ` · ${coachSubtaskProgress(detailTask).done}/${coachSubtaskProgress(detailTask).total}`
                  : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {coachTaskSubtasks(detailTask).map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => apply(toggleCoachSubtask(store, detailTask.id, s.id))}
                      aria-pressed={s.done}
                      aria-label={s.done ? 'Снять отметку подзадачи' : 'Отметить подзадачу'}
                      data-planner="subtask-toggle"
                      data-subtask-id={s.id}
                      data-done={s.done}
                      style={{
                        flexShrink: 0,
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: `1px solid ${s.done ? withAlpha(BLUE, '99') : 'rgba(255,255,255,0.22)'}`,
                        background: s.done ? withAlpha(BLUE, '33') : 'transparent',
                        color: BLUE,
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      {s.done ? '✓' : ''}
                    </button>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12,
                        color: s.done ? colors.textMuted : '#fff',
                        textDecoration: s.done ? 'line-through' : undefined,
                        wordBreak: 'break-word',
                      }}
                    >
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => apply(removeCoachSubtask(store, detailTask.id, s.id))}
                      aria-label="Удалить подзадачу"
                      data-planner="subtask-remove"
                      data-subtask-id={s.id}
                      style={{
                        flexShrink: 0,
                        minHeight: 28,
                        padding: '2px 8px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 10.5,
                        fontWeight: 800,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'transparent',
                        color: colors.textMuted,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {coachTaskSubtasks(detailTask).length === 0 && (
                  <div style={{ fontSize: 11.5, color: colors.textMuted }}>Пока нет подзадач.</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addSubtask();
                  }}
                  placeholder="Новая подзадача"
                  aria-label="Новая подзадача"
                  maxLength={COACH_SUBTASK_TITLE_MAX}
                  disabled={coachTaskSubtasks(detailTask).length >= COACH_SUBTASKS_MAX}
                  data-planner="subtask-input"
                  style={{ ...inputStyle, flex: 1, minHeight: 40 }}
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  aria-label="Добавить подзадачу"
                  disabled={coachTaskSubtasks(detailTask).length >= COACH_SUBTASKS_MAX}
                  data-planner="subtask-add"
                  style={{ ...btn('ghost'), minHeight: 40, padding: '4px 12px', fontSize: 12 }}
                >
                  +
                </button>
              </div>
              <div data-planner="subtask-limit" style={{ fontSize: 10.5, color: colors.textSubtle, marginTop: 4 }}>
                {coachTaskSubtasks(detailTask).length >= COACH_SUBTASKS_MAX
                  ? `Достигнут лимит — ${COACH_SUBTASKS_MAX} подзадач.`
                  : `До ${COACH_SUBTASKS_MAX} подзадач. Enter — добавить.`}
              </div>
            </div>

            <div
              style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
              data-planner="detail-order"
            >
              <span style={{ fontSize: 11, color: colors.textSubtle }}>Порядок в дне:</span>
              <button
                type="button"
                onClick={() => moveInDay(detailTask, -1)}
                disabled={!canMoveUp}
                aria-disabled={!canMoveUp}
                data-planner="detail-move-up"
                style={{
                  ...btn('ghost'),
                  minHeight: 34,
                  padding: '3px 10px',
                  fontSize: 11,
                  opacity: canMoveUp ? 1 : 0.45,
                  cursor: canMoveUp ? 'pointer' : 'not-allowed',
                }}
              >
                ↑ Выше
              </button>
              <button
                type="button"
                onClick={() => moveInDay(detailTask, 1)}
                disabled={!canMoveDown}
                aria-disabled={!canMoveDown}
                data-planner="detail-move-down"
                style={{
                  ...btn('ghost'),
                  minHeight: 34,
                  padding: '3px 10px',
                  fontSize: 11,
                  opacity: canMoveDown ? 1 : 0.45,
                  cursor: canMoveDown ? 'pointer' : 'not-allowed',
                }}
              >
                ↓ Ниже
              </button>
            </div>

            {detailError && (
              <div role="alert" data-planner="detail-error" style={{ fontSize: 12, color: colors.danger }}>
                {detailError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={saveDetails} data-planner="detail-save" style={btn('primary')}>
                Сохранить
              </button>
              <button
                type="button"
                onClick={closeDetails}
                data-planner="detail-cancel"
                style={{ ...btn('ghost'), minHeight: 44 }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  apply(setCoachTaskPinned(store, detailTask.id, detailTask.pinned !== true));
                  setDraft((d) => (d ? { ...d } : d));
                }}
                data-planner="detail-pin"
                data-pinned={detailTask.pinned === true}
                aria-pressed={detailTask.pinned === true}
                style={{ ...btn('ghost'), minHeight: 44 }}
              >
                {detailTask.pinned === true ? 'Открепить' : 'Закрепить'}
              </button>
              <button
                type="button"
                onClick={duplicateDetails}
                title="Сохранит правки карточки и создаст копию задачи"
                data-planner="detail-duplicate"
                style={{ ...btn('ghost'), minHeight: 44 }}
              >
                Дублировать
              </button>
            </div>
          </div>
        )}

        {smart === 'all' && dayAgenda.length > 0 && (
          <div
            data-planner="auto"
            style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd' }}>Из приложения · {dayAgenda.length}</div>
              <div style={{ fontSize: 10.5, color: colors.textSubtle }}>время можно поправить</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {dayAgenda.map((ev) => {
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
                        onChange={(e) => setAutoTime(ev.id, e.target.value)}
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
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
            placeholder={`Задача на ${fmtHuman(quickTargetDate)}`}
            aria-label="Название задачи"
            data-planner="title"
            style={{ ...inputStyle, width: '100%' }}
          />
          {quickHints.length > 0 && (
            <div data-planner="quick-hints" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {quickHints.map((hint, index) => (
                <span
                  key={`${hint}-${index}`}
                  data-planner="quick-hint"
                  data-hint={hint}
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    color: '#bfdbfe',
                    background: 'rgba(59,130,246,0.16)',
                    border: '1px solid rgba(59,130,246,0.34)',
                  }}
                >
                  {hint}
                </span>
              ))}
              {quick.title.trim() && (
                <span style={{ fontSize: 10.5, color: colors.textSubtle }}>→ «{quick.title}»</span>
              )}
            </div>
          )}
          <div data-planner="quick-help" style={{ fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}>
            Быстрый ввод: «завтра 18:30», «в 8 вечера», «через 3 дня», «каждый вторник», «#здоровье», «@тренировки»,
            «!высокий», «//заметка».
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Время задачи"
              data-planner="time"
              style={{ ...inputStyle, flex: '0 0 auto', minWidth: 110 }}
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CoachTaskPriority)}
              aria-label="Приоритет задачи"
              data-planner="priority"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {COACH_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {COACH_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <select
              value={list}
              onChange={(e) => setList(e.target.value as CoachTaskList)}
              aria-label="Список задачи"
              data-planner="list"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {COACH_TASK_LISTS.map((l) => (
                <option key={l} value={l}>
                  {COACH_TASK_LIST_LABELS[l]}
                </option>
              ))}
            </select>
            <select
              value={repeat}
              onChange={(e) => changeRepeat(e.target.value as CoachRepeat)}
              aria-label="Повтор задачи"
              data-planner="repeat"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {COACH_REPEATS.map((r) => (
                <option key={r} value={r}>
                  {COACH_REPEAT_LABELS[r]}
                </option>
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
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  color: colors.textMuted,
                }}
              >
                каждые
                <input
                  type="number"
                  min={COACH_REPEAT_INTERVAL_MIN}
                  max={COACH_REPEAT_INTERVAL_MAX}
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(Number(e.target.value) || COACH_REPEAT_INTERVAL_DEFAULT)}
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
                onChange={(e) => setAthleteId(e.target.value)}
                aria-label="Атлет задачи"
                data-planner="athlete"
                style={{ ...inputStyle, flex: '1 1 140px' }}
              >
                <option value="">Без атлета</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={add} data-planner="add" style={btn('primary')}>
              + Задача
            </button>
          </div>
          {repeat !== 'none' && (
            <div data-planner="repeat-hint" style={{ fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}>
              Следующее вхождение появится после закрытия этой задачи — планёр не создаёт будущие серии заранее.
            </div>
          )}
          {error && (
            <div role="alert" data-planner="error" style={{ fontSize: 12, color: colors.danger }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Статистика: честные счётчики по задачам планера */}
      <div style={cardStyle} data-planner="stats">
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Статистика</div>
        <div style={{ fontSize: 11, color: colors.textSubtle, marginTop: 3, lineHeight: 1.45 }}>
          Считается только по задачам планера. «Закрыто» — по времени отметки, а не по дате задачи; «Вовремя» — закрыто
          в день срока или раньше, среди задач с известным временем закрытия (если таких нет — «—», а не 0%).
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))',
            gap: 8,
            marginTop: 10,
          }}
        >
          {[
            { id: 'today', label: 'На сегодня', value: `${stats.todayDone}/${stats.todayTotal}` },
            { id: 'completed-today', label: 'Закрыто сегодня', value: String(stats.completedToday) },
            { id: 'open', label: 'Открыто', value: String(stats.open) },
            { id: 'overdue', label: 'Просрочено', value: String(stats.overdue) },
            { id: 'completed7', label: 'Закрыто за 7 дней', value: String(stats.completed7) },
            {
              id: 'on-time',
              label: 'Вовремя',
              // Без известного времени закрытия доля не 0%, а «нет данных».
              value: stats.onTimeKnown > 0 ? `${Math.round(stats.onTimeRate * 100)}%` : '—',
            },
          ].map((cell) => (
            <div
              key={cell.id}
              data-planner="stat"
              data-stat={cell.id}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {cell.value}
              </div>
              <div style={{ fontSize: 10.5, color: colors.textSubtle }}>{cell.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Просроченные */}
      {overdue.length > 0 && (
        <div style={{ ...cardStyle, borderColor: 'rgba(245,158,11,0.35)' }} data-planner="overdue">
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.warning }}>Просрочено: {overdue.length}</div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 }}>
            Эти задачи не переносятся автоматически и не пропадают — откройте день и закройте их или перенесите вручную.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {(showAllOverdue ? overdue : overdue.slice(0, 6)).map((t) => {
              const late = daysBetweenIso(t.date, today);
              return (
                <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                  <button
                    type="button"
                    onClick={() => selectIso(t.date)}
                    data-planner="overdue-item"
                    data-date={t.date}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 7,
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
                    <span style={{ color: colors.warning, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {t.date.slice(8, 10)}.{t.date.slice(5, 7)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{t.title}</span>
                    {late !== null && late > 0 && (
                      <span
                        data-planner="overdue-days"
                        title="Сколько дней прошло с даты срока"
                        style={{
                          flexShrink: 0,
                          fontSize: 10.5,
                          color: colors.warning,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {late} дн.
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Только по явному нажатию: автопереноса просроченных нет.
                      apply(moveCoachTask(store, t.id, today));
                      selectIso(today);
                    }}
                    data-planner="overdue-today"
                    data-task-id={t.id}
                    aria-label={`Перенести «${t.title}» на сегодня`}
                    title="Перенести на сегодня (вручную)"
                    style={{ ...btn('ghost'), minHeight: 40, padding: '4px 9px', fontSize: 10.5 }}
                  >
                    → сегодня
                  </button>
                </div>
              );
            })}
          </div>
          {overdue.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllOverdue((v) => !v)}
              data-planner="overdue-more"
              data-expanded={showAllOverdue}
              style={{ ...btn('ghost'), marginTop: 8, minHeight: 36, padding: '4px 10px', fontSize: 11 }}
            >
              {showAllOverdue ? 'Свернуть до 6' : `Показать все (${overdue.length})`}
            </button>
          )}
        </div>
      )}

      <div
        style={{
          fontSize: 11.5,
          color: colors.textSubtle,
          lineHeight: 1.55,
          padding: '0 4px',
          display: 'flex',
          gap: 6,
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', color: BLUE, flexShrink: 0, marginTop: 1 }}>
          <NativeIcon name="clock" size={13} />
        </span>
        <span>
          Планёр — это ваш распорядок: события из разделов подтягиваются на просмотр, время можно поправить только
          здесь, планёр не меняет чужие планы и не отправляет уведомления.
        </span>
      </div>
    </div>
  );
};
