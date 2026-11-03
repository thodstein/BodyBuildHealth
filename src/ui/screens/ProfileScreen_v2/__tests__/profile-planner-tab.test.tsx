/**
 * profile-planner-tab.test.tsx — UI календаря-планировщика.
 *
 * Проверяем: задача добавляется в выбранный день (локальная дата), отмечается
 * выполненной, переключение месяцев работает, просроченное не исчезает и не
 * переносится само, пустая задача не создаётся с объяснением.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfilePlannerTab } from '../ProfilePlannerTab';
import { localIsoDate, shiftIsoDate } from '../../../../core/local-date';
import {
  COACH_MONTH_LABELS,
  addCoachTask,
  emptyCoachPlanner,
  readCoachPlanner,
  shiftCoachMonth,
  writeCoachPlanner,
} from '../../../../engines/coach/coach-planner.engine';

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
