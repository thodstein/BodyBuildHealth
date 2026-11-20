/**
 * profile-planner-tab.test.tsx — UI календаря-планировщика.
 *
 * Проверяем: задача добавляется в выбранный день (локальная дата), отмечается
 * выполненной, переключение месяцев работает, просроченное не исчезает и не
 * переносится само, пустая задача не создаётся с объяснением. Плюс авто-события
 * из разделов: приходят на просмотр и выключаются выбором источника.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfilePlannerTab } from '../ProfilePlannerTab';
import { localIsoDate, shiftIsoDate } from '../../../../core/local-date';
import {
  addCoachAthlete,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';
import {
  COACH_MONTH_LABELS,
  COACH_WEEKDAY_LABELS,
  addCoachTask,
  emptyCoachPlanner,
  readCoachPlanner,
  shiftCoachMonth,
  writeCoachPlanner,
} from '../../../../engines/coach/coach-planner.engine';
import {
  AGENDA_SOURCES,
  readAgendaSources,
  readAgendaTimeOverrides,
} from '../../../../engines/coach/coach-agenda.engine';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const today = localIsoDate();
const items = (c: HTMLElement): NodeListOf<HTMLElement> => c.querySelectorAll('[data-planner="item"]');

const addTask = (c: HTMLElement, title: string, time = '') => {
  fireEvent.change(c.querySelector('[data-planner="title"]') as HTMLInputElement, { target: { value: title } });
  if (time) fireEvent.change(c.querySelector('[data-planner="time"]') as HTMLInputElement, { target: { value: time } });
  fireEvent.click(c.querySelector('[data-planner="add"]') as HTMLElement);
};

describe('задачи дня', () => {
  it('пустой день объясняется, а не выглядит сломанным', () => {
    const { container } = render(<ProfilePlannerTab />);
    expect(container.textContent).toContain('На этот день задач нет');
    expect(items(container)).toHaveLength(0);
  });

  it('задача добавляется в СЕГОДНЯ (локальная дата) со временем', () => {
    const { container } = render(<ProfilePlannerTab />);
    addTask(container, 'Присед у Ивана', '18:30');

    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Присед у Ивана');
    expect(items(container)[0].textContent).toContain('18:30');
    const saved = readCoachPlanner(localStorage);
    expect(saved.items[0]).toMatchObject({ title: 'Присед у Ивана', date: today, time: '18:30', done: false });
    // поле очищено
    expect((container.querySelector('[data-planner="title"]') as HTMLInputElement).value).toBe('');
  });

  it('пустое название — ошибка, задача не создаётся', () => {
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="add"]') as HTMLElement);
    expect(container.querySelector('[data-planner="error"]')?.textContent).toContain('Название задачи пустое');
    expect(items(container)).toHaveLength(0);
  });

  it('отметка «сделано» переключается и сохраняется', () => {
    const { container } = render(<ProfilePlannerTab />);
    addTask(container, 'Сдать ферритин');
    fireEvent.click(container.querySelector('[data-planner="toggle"]') as HTMLElement);
    expect(items(container)[0].getAttribute('data-done')).toBe('true');
    expect(readCoachPlanner(localStorage).items[0].done).toBe(true);
    fireEvent.click(container.querySelector('[data-planner="toggle"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items[0].done).toBe(false);
  });

  it('удаление требует второго клика', () => {
    const { container } = render(<ProfilePlannerTab />);
    addTask(container, 'Созвон');
    const del = container.querySelector('[data-planner="delete"]') as HTMLElement;
    fireEvent.click(del);
    expect(readCoachPlanner(localStorage).items).toHaveLength(1);
    fireEvent.click(container.querySelector('[data-planner="delete"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items).toHaveLength(0);
  });
});

describe('календарь', () => {
  it('сетка показывает месяц и подсвечивает сегодня', () => {
    const { container } = render(<ProfilePlannerTab />);
    const d = new Date(`${today}T00:00:00`);
    const label = `${COACH_MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    expect(container.querySelector('[data-planner="month"]')?.textContent).toContain(label);
    const cells = container.querySelectorAll('[data-planner="cell"]');
    expect(cells.length % 7).toBe(0);
    expect(container.querySelector(`[data-planner="cell"][data-date="${today}"]`)).not.toBeNull();
  });

  it('переключение месяцев меняет подпись и остаётся в пределах года', () => {
    const { container } = render(<ProfilePlannerTab />);
    const d = new Date(`${today}T00:00:00`);
    const next = shiftCoachMonth(d.getFullYear(), d.getMonth(), 1);
    fireEvent.click(container.querySelector('[data-planner="next"]') as HTMLElement);
    expect(container.querySelector('[data-planner="month"]')?.textContent).toContain(`${COACH_MONTH_LABELS[next.month]} ${next.year}`);
    fireEvent.click(container.querySelector('[data-planner="prev"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="prev"]') as HTMLElement);
    const prev = shiftCoachMonth(d.getFullYear(), d.getMonth(), -1);
    expect(container.querySelector('[data-planner="month"]')?.textContent).toContain(`${COACH_MONTH_LABELS[prev.month]} ${prev.year}`);
  });

  it('задача ставится в выбранный день, а не в сегодня', () => {
    const tomorrow = shiftIsoDate(today, 1);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector(`[data-planner="cell"][data-date="${tomorrow}"]`) as HTMLElement);
    addTask(container, 'Завтрашняя');
    const saved = readCoachPlanner(localStorage);
    expect(saved.items[0].date).toBe(tomorrow);
    expect(items(container)).toHaveLength(1);
    // вернулись в сегодня — задачи нет
    fireEvent.click(container.querySelector('[data-planner="today"]') as HTMLElement);
    expect(items(container)).toHaveLength(0);
  });

  it('точки занятости отражают количество задач в дне', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'A', date: today }, { id: 't1' }).store;
    s = addCoachTask(s, { title: 'B', date: today }, { id: 't2' }).store;
    writeCoachPlanner(localStorage, s);
    const { container } = render(<ProfilePlannerTab />);
    const cell = container.querySelector(`[data-planner="cell"][data-date="${today}"]`) as HTMLElement;
    expect(cell.getAttribute('data-count')).toBe('2');
  });
});

describe('просроченное', () => {
  it('незакрытые задачи из прошлого видны отдельным блоком и открывают свой день', () => {
    const past = shiftIsoDate(today, -3);
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Старый долг', date: past }, { id: 'old' }).store;
    writeCoachPlanner(localStorage, s);
    const { container } = render(<ProfilePlannerTab />);

    expect(container.querySelector('[data-planner="overdue"]')?.textContent).toContain('Старый долг');
    fireEvent.click(container.querySelector('[data-planner="overdue-item"]') as HTMLElement);
    // день открылся: задача этого дня в списке и не «сгорела»
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Старый долг');
  });

  it('выполненная просроченная задача не мешает', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Сделано', date: shiftIsoDate(today, -1) }, { id: 'old' }).store;
    s = { version: 1, items: s.items.map(t => ({ ...t, done: true })) };
    writeCoachPlanner(localStorage, s);
    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelector('[data-planner="overdue"]')).toBeNull();
  });
});

describe('пришли из карточки атлета', () => {
  const seedAthlete = () => {
    let coach = setCoachEnabled(emptyCoachState(), true);
    coach = addCoachAthlete(coach, { name: 'Иван' }, { id: 'a1' }).state;
    writeCoachState(localStorage, coach);
  };

  it('атлет подставлен в форму новой задачи', () => {
    seedAthlete();
    const { container } = render(<ProfilePlannerTab initialAthleteId="a1" />);
    expect((container.querySelector('[data-planner="athlete"]') as HTMLSelectElement).value).toBe('a1');
    fireEvent.change(container.querySelector('[data-planner="title"]') as HTMLInputElement, { target: { value: 'Созвон' } });
    fireEvent.click(container.querySelector('[data-planner="add"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items[0]).toMatchObject({ title: 'Созвон', athleteId: 'a1' });
  });

  it('удалённого атлета не подставляем (без «фантомной» привязки)', () => {
    seedAthlete();
    const { container } = render(<ProfilePlannerTab initialAthleteId="ghost" />);
    expect((container.querySelector('[data-planner="athlete"]') as HTMLSelectElement).value).toBe('');
  });
});

describe('авто-события из приложения', () => {
  // День недели «сегодня» в той же нумерации, что и расписание инъекций.
  const todayDow = (new Date(`${today}T00:00:00`).getDay() + 6) % 7;
  const seedInjection = () => {
    localStorage.setItem(
      'he_injection_schedule',
      JSON.stringify([{ id: 'inj1', substance: 'Test E', dose: '250', daysOfWeek: [todayDow], active: true }]),
    );
  };
  const autoItems = (c: HTMLElement): NodeListOf<HTMLElement> => c.querySelectorAll('[data-planner="auto-item"]');

  it('показывает выбор источников и по умолчанию включает все', () => {
    const { container } = render(<ProfilePlannerTab />);
    const chips = container.querySelectorAll('[data-planner="source-chip"]');
    expect(chips.length).toBe(AGENDA_SOURCES.length);
    for (const chip of Array.from(chips)) expect(chip.getAttribute('data-active')).toBe('true');
    expect(readAgendaSources(localStorage)).toEqual(AGENDA_SOURCES.map(s => s.id));
  });

  it('инъекция из своего раздела попадает в день — только на просмотр', () => {
    seedInjection();
    const { container } = render(<ProfilePlannerTab />);
    const row = container.querySelector('[data-planner="auto-item"][data-source="injections"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.textContent).toContain('Test E');
    // В авто-строке нет кнопок задач: планёр её не отмечает, не переносит и не удаляет.
    expect(row.querySelector('[data-planner="toggle"]')).toBeNull();
    expect(row.querySelector('[data-planner="move"]')).toBeNull();
    expect(row.querySelector('[data-planner="delete"]')).toBeNull();
    // Но время поправить можно — это единственное местное поле.
    expect(row.querySelector('[data-planner="auto-time"]')).not.toBeNull();
    // И в задачи она не превратилась.
    expect(items(container)).toHaveLength(0);
    expect(readCoachPlanner(localStorage).items).toHaveLength(0);
  });

  it('факт из своего раздела виден как выполненный', () => {
    seedInjection();
    localStorage.setItem('he_injection_diary', JSON.stringify([{ date: today, substance: 'Test E' }]));
    const { container } = render(<ProfilePlannerTab />);
    const row = container.querySelector('[data-planner="auto-item"][data-source="injections"]') as HTMLElement;
    expect(row.getAttribute('data-done')).toBe('true');
  });

  it('время авто-события правится и сбрасывается, источник не меняется', () => {
    localStorage.setItem(
      'he_injection_schedule',
      JSON.stringify([{ id: 'inj1', substance: 'Test E', dose: '250', daysOfWeek: [todayDow], active: true, time: '09:00' }]),
    );
    const { container } = render(<ProfilePlannerTab />);
    const input = (): HTMLInputElement =>
      container.querySelector('[data-planner="auto-time"]') as HTMLInputElement;
    expect(input().value).toBe('09:00');

    fireEvent.change(input(), { target: { value: '21:15' } });
    expect(input().value).toBe('21:15');
    const overrides = readAgendaTimeOverrides(localStorage);
    const eventId = Object.keys(overrides)[0];
    expect(eventId).toContain('agenda:injections:');
    expect(overrides[eventId]).toBe('21:15');
    // Источник не тронут, задача не появилась.
    expect(JSON.parse(localStorage.getItem('he_injection_schedule') as string)[0].time).toBe('09:00');
    expect(items(container)).toHaveLength(0);

    fireEvent.click(container.querySelector('[data-planner="auto-time-reset"]') as HTMLElement);
    expect(input().value).toBe('09:00');
    expect(readAgendaTimeOverrides(localStorage)).toEqual({});
  });

  it('выключенный источник исчезает из дня и из точек календаря', () => {
    seedInjection();
    const { container } = render(<ProfilePlannerTab />);
    const cell = container.querySelector(`[data-planner="cell"][data-date="${today}"]`) as HTMLElement;
    expect(Number(cell.getAttribute('data-auto-count'))).toBeGreaterThan(0);
    expect(autoItems(container).length).toBeGreaterThan(0);

    fireEvent.click(container.querySelector('[data-planner="source-chip"][data-source="injections"]') as HTMLElement);
    expect(readAgendaSources(localStorage)).not.toContain('injections');
    expect(autoItems(container)).toHaveLength(0);
    const after = container.querySelector(`[data-planner="cell"][data-date="${today}"]`) as HTMLElement;
    expect(after.getAttribute('data-auto-count')).toBe('0');
  });

  it('«Включить всё» возвращает все источники', () => {
    seedInjection();
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="source-chip"][data-source="labs"]') as HTMLElement);
    expect(container.querySelector('[data-planner="source-all"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-planner="source-all"]') as HTMLElement);
    expect(readAgendaSources(localStorage)).toEqual(AGENDA_SOURCES.map(s => s.id));
    expect(container.querySelector('[data-planner="source-all"]')).toBeNull();
  });
});

describe('повтор задачи', () => {
  const todayDay = (new Date(`${today}T00:00:00`).getDay() + 6) % 7;

  it('дни недели: день задачи выбран сразу, выбор сохраняется и виден в бейдже', () => {
    const { container } = render(<ProfilePlannerTab />);
    const repeat = container.querySelector('[data-planner="repeat"]') as HTMLSelectElement;
    fireEvent.change(repeat, { target: { value: 'weekdays' } });

    const days = container.querySelectorAll('[data-planner="repeat-day"]');
    expect(days).toHaveLength(7);
    expect(
      container.querySelector(`[data-planner="repeat-day"][data-day="${todayDay}"]`)?.getAttribute('data-active'),
    ).toBe('true');

    const otherDay = (todayDay + 1) % 7;
    fireEvent.click(container.querySelector(`[data-planner="repeat-day"][data-day="${otherDay}"]`) as HTMLElement);
    addTask(container, 'Кардио');

    const task = readCoachPlanner(localStorage).items[0];
    expect(task.repeat).toBe('weekdays');
    expect(task.repeatDays).toEqual([todayDay, otherDay].sort((a, b) => a - b));
    expect(container.querySelector('[data-planner="task-repeat"]')?.textContent).toContain(
      COACH_WEEKDAY_LABELS[todayDay],
    );
  });

  it('свой интервал сохраняется и показывается в бейдже', () => {
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.change(container.querySelector('[data-planner="repeat"]') as HTMLSelectElement, {
      target: { value: 'custom' },
    });
    fireEvent.change(container.querySelector('[data-planner="repeat-interval"]') as HTMLInputElement, {
      target: { value: '10' },
    });
    addTask(container, 'Готовка');

    expect(readCoachPlanner(localStorage).items[0]).toMatchObject({ repeat: 'custom', repeatInterval: 10 });
    expect(container.querySelector('[data-planner="task-repeat"]')?.textContent).toContain('10 дн.');
  });

  it('«через день» и «каждые 2 недели» доступны в выборе', () => {
    const { container } = render(<ProfilePlannerTab />);
    const options = Array.from(
      (container.querySelector('[data-planner="repeat"]') as HTMLSelectElement).options,
    ).map(o => o.value);
    expect(options).toEqual(
      expect.arrayContaining(['none', 'daily', 'eod', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom']),
    );
    fireEvent.change(container.querySelector('[data-planner="repeat"]') as HTMLSelectElement, {
      target: { value: 'eod' },
    });
    addTask(container, 'Через день');
    expect(readCoachPlanner(localStorage).items[0].repeat).toBe('eod');
  });
});
