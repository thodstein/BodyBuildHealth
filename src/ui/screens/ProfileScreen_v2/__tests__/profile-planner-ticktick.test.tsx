/**
 * profile-planner-ticktick.test.tsx — UI TickTick-паритета планёра:
 * быстрый ввод, умные списки, теги, закрепление, карточка задачи с
 * подзадачами, виды «канбан / матрица» и группировка.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfilePlannerTab } from '../ProfilePlannerTab';
import { localIsoDate, shiftIsoDate } from '../../../../core/local-date';
import {
  addCoachSubtask,
  addCoachTask,
  completeCoachTask,
  emptyCoachPlanner,
  readCoachFilters,
  readCoachPlanner,
  writeCoachPlanner,
  type CoachPlannerStore,
} from '../../../../engines/coach/coach-planner.engine';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

const today = localIsoDate();
const tomorrow = shiftIsoDate(today, 1);
const items = (c: HTMLElement): NodeListOf<HTMLElement> => c.querySelectorAll('[data-planner="item"]');

const seed = (s: CoachPlannerStore): void => {
  writeCoachPlanner(localStorage, s);
};

const addTask = (c: HTMLElement, title: string): void => {
  fireEvent.change(c.querySelector('[data-planner="title"]') as HTMLInputElement, { target: { value: title } });
  fireEvent.click(c.querySelector('[data-planner="add"]') as HTMLElement);
};

describe('быстрый ввод', () => {
  it('распознаёт дату, время, тег, список и приоритет', () => {
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.change(container.querySelector('[data-planner="title"]') as HTMLInputElement, {
      target: { value: 'Купить гантели завтра 18:30 #зал !высокий @тренировки' },
    });
    const hints = container.querySelectorAll('[data-planner="quick-hint"]');
    expect(hints.length).toBeGreaterThan(0);
    expect(Array.from(hints).some((h) => h.textContent?.includes('завтра'))).toBe(true);

    fireEvent.click(container.querySelector('[data-planner="add"]') as HTMLElement);
    const saved = readCoachPlanner(localStorage).items[0];
    expect(saved).toMatchObject({
      title: 'Купить гантели',
      date: tomorrow,
      time: '18:30',
      priority: 'high',
      list: 'training',
      tags: ['зал'],
    });
    // Планёр переключился на распознанный день — задача видна сразу.
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Купить гантели');
  });

  it('без служебных слов ввод работает как раньше', () => {
    const { container } = render(<ProfilePlannerTab />);
    addTask(container, 'Обычная задача');
    expect(readCoachPlanner(localStorage).items[0]).toMatchObject({ title: 'Обычная задача', date: today });
  });

  it('повтор объясняет, что будущие вхождения не создаются заранее', () => {
    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelector('[data-planner="repeat-hint"]')).toBeNull();

    fireEvent.change(container.querySelector('[data-planner="repeat"]') as HTMLSelectElement, {
      target: { value: 'daily' },
    });
    expect(container.querySelector('[data-planner="repeat-hint"]')?.textContent).toContain('после закрытия');

    addTask(container, 'Каждый день');
    // Серия не плодит фантомную задачу на завтра.
    expect(readCoachPlanner(localStorage).items).toHaveLength(1);
    expect(readCoachPlanner(localStorage).items[0]).toMatchObject({ repeat: 'daily', date: today });
    expect(items(container)).toHaveLength(1);
  });
});

describe('умные списки', () => {
  it('«7 дней» показывает задачи разных дней, клик по дате возвращает день', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Сегодняшняя', date: today }, { id: 't1' }).store;
    s = addCoachTask(s, { title: 'Завтрашняя', date: tomorrow }, { id: 't2' }).store;
    s = addCoachTask(s, { title: 'Далёкая', date: shiftIsoDate(today, 30) }, { id: 't3' }).store;
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    const chip = container.querySelector('[data-planner="smart-chip"][data-smart="next7"]') as HTMLElement;
    expect(chip.getAttribute('data-count')).toBe('2');
    fireEvent.click(chip);
    expect(items(container)).toHaveLength(2);
    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-smart')).toBe('next7');

    fireEvent.click(container.querySelector(`[data-planner="cell"][data-date="${today}"]`) as HTMLElement);
    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-smart')).toBe('all');
    expect(items(container)).toHaveLength(1);
  });

  it('поле быстрого ввода называет день, куда реально уйдёт задача', () => {
    const human = (iso: string): string =>
      new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
    const { container } = render(<ProfilePlannerTab />);
    const placeholder = (): string =>
      (container.querySelector('[data-planner="title"]') as HTMLInputElement).placeholder;
    expect(placeholder()).toContain(human(today));

    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="tomorrow"]') as HTMLElement);
    expect(placeholder()).toContain(human(tomorrow));

    addTask(container, 'На завтра');
    expect(readCoachPlanner(localStorage).items[0].date).toBe(tomorrow);
  });

  it('«Просрочено» показывает долги без автопереноса', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Долг', date: shiftIsoDate(today, -2) }, { id: 'old' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="overdue"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);
    expect(readCoachPlanner(localStorage).items[0].date).toBe(shiftIsoDate(today, -2));
  });

  it('новая задача из «Просрочено» не прячется: планёр уводит в её день', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Долг', date: shiftIsoDate(today, -2) }, { id: 'old' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="overdue"]') as HTMLElement);
    addTask(container, 'Новая задача');
    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-smart')).toBe('all');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Новая задача');
  });

  it('«Скрыть сделанные» убирает их из списка и счётчика чипа', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Готово', date: today }, { id: 'a' }).store;
    s = completeCoachTask(s, 'a');
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    const chip = container.querySelector('[data-planner="smart-chip"][data-smart="all"]') as HTMLElement;
    expect(chip.getAttribute('data-count')).toBe('1');
    fireEvent.click(container.querySelector('[data-planner="show-done"]') as HTMLElement);
    expect(chip.getAttribute('data-count')).toBe('0');
    expect(items(container)).toHaveLength(0);
  });

  it('в «Сделано» переключатель скрытия не обманка', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Готово', date: today }, { id: 'a' }).store;
    s = completeCoachTask(s, 'a');
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="done"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);
    // Кнопка, которая здесь ничего не меняет, не показывается.
    expect(container.querySelector('[data-planner="show-done"]')).toBeNull();
    expect(container.querySelector('[data-planner="show-done-note"]')?.textContent).toContain('скрывать нечего');
  });
});

describe('теги и закрепление', () => {
  it('тег-чип фильтрует задачи', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Задача А', date: today, tags: ['зал'] }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Задача Б', date: today, tags: ['работа'] }, { id: 'b' }).store;
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    expect(items(container)).toHaveLength(2);
    fireEvent.click(container.querySelector('[data-planner="tag-chip"][data-tag="зал"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Задача А');
  });

  it('тег другого дня не предлагается в текущем дне', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Сегодня', date: today, tags: ['зал'] }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Завтра', date: tomorrow, tags: ['работа'] }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelector('[data-planner="tag-chip"][data-tag="зал"]')).not.toBeNull();
    expect(container.querySelector('[data-planner="tag-chip"][data-tag="работа"]')).toBeNull();
  });

  it('сохранённый фильтр возвращает выбранные условия', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Задача А', date: today, tags: ['зал'] }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Задача Б', date: today, tags: ['работа'] }, { id: 'b' }).store;
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="tag-chip"][data-tag="зал"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="filter-name"]') as HTMLInputElement, {
      target: { value: 'Только зал' },
    });
    fireEvent.click(container.querySelector('[data-planner="filter-save"]') as HTMLElement);
    expect(readCoachFilters(localStorage).items).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-planner="tag-clear"]') as HTMLElement);
    expect(items(container)).toHaveLength(2);
    fireEvent.click(container.querySelector('[data-planner="filter-chip"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Задача А');
  });

  it('кнопки «выше/ниже» меняют ручной порядок и сохраняются', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Первая', date: today, time: '09:00' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Вторая', date: today, time: '10:00' }, { id: 'b' }).store;
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    expect(items(container)[0].textContent).toContain('Первая');
    fireEvent.click(items(container)[0].querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="detail-move-down"]') as HTMLElement);
    expect(items(container)[0].textContent).toContain('Вторая');
    const saved = readCoachPlanner(localStorage).items;
    expect(saved.find((t) => t.id === 'b')?.order).toBeLessThan(saved.find((t) => t.id === 'a')!.order!);
  });
  it('закреплённая задача поднимается вверх дня', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Первая', date: today, time: '09:00' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Вторая', date: today, time: '10:00' }, { id: 'b' }).store;
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    expect(items(container)[0].textContent).toContain('Первая');
    const second = container.querySelectorAll('[data-planner="item"]')[1];
    fireEvent.click(second.querySelector('[data-planner="pin"]') as HTMLElement);
    expect(items(container)[0].textContent).toContain('Вторая');
    expect(items(container)[0].getAttribute('data-pinned')).toBe('true');
    expect(readCoachPlanner(localStorage).items.find((t) => t.id === 'b')?.pinned).toBe(true);
  });
});

describe('карточка задачи', () => {
  it('правит заметку, теги и подзадачи; прогресс виден в строке', () => {
    const r = addCoachTask(emptyCoachPlanner(), { title: 'Сдать анализы', date: today }, { id: 't' });
    seed(r.store);
    const { container } = render(<ProfilePlannerTab />);

    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    expect(container.querySelector('[data-planner="detail"]')).not.toBeNull();

    fireEvent.change(container.querySelector('[data-planner="detail-note"]') as HTMLTextAreaElement, {
      target: { value: 'натощак' },
    });
    fireEvent.change(container.querySelector('[data-planner="detail-tags"]') as HTMLInputElement, {
      target: { value: 'здоровье, анализы' },
    });
    fireEvent.change(container.querySelector('[data-planner="subtask-input"]') as HTMLInputElement, {
      target: { value: 'Не есть 8 часов' },
    });
    fireEvent.click(container.querySelector('[data-planner="subtask-add"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="subtask-toggle"]') as HTMLElement);

    fireEvent.click(container.querySelector('[data-planner="detail-save"]') as HTMLElement);
    const saved = readCoachPlanner(localStorage).items[0];
    expect(saved.note).toBe('натощак');
    expect(saved.tags).toEqual(['здоровье', 'анализы']);
    expect(saved.subtasks?.[0]).toMatchObject({ title: 'Не есть 8 часов', done: true });

    const progress = container.querySelector('[data-planner="subtask-progress"]');
    expect(progress?.textContent).toContain('1/1');
  });

  it('пустое название в карточке не сохраняется и показывает ошибку', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Задача', date: today }, { id: 't' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="detail-title"]') as HTMLInputElement, {
      target: { value: '   ' },
    });
    fireEvent.click(container.querySelector('[data-planner="detail-save"]') as HTMLElement);
    expect(container.querySelector('[data-planner="detail-error"]')?.textContent).toContain('Название задачи пустое');
    expect(readCoachPlanner(localStorage).items[0].title).toBe('Задача');
    // Ошибка живёт в карточке: закрыли — пропала.
    fireEvent.click(container.querySelector('[data-planner="detail-cancel"]') as HTMLElement);
    expect(container.querySelector('[data-planner="detail-error"]')).toBeNull();
  });

  it('перенос в другой список не теряет задачу под фильтром списка', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Анализы', date: today, list: 'health' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Отчёт', date: today, list: 'work' }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="list-chip"][data-list="health"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="detail-list"]') as HTMLSelectElement, {
      target: { value: 'work' },
    });
    fireEvent.click(container.querySelector('[data-planner="detail-save"]') as HTMLElement);

    expect(readCoachPlanner(localStorage).items.find((t) => t.id === 'a')?.list).toBe('work');
    // Фильтр списка сброшен: задача видна сразу, а не «исчезла» после правки.
    expect(items(container)).toHaveLength(2);
    expect(container.querySelector('[data-planner="list-chip"][data-list="all"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('уход из «Входящих» в карточке не прячет задачу', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Входящая', date: today }, { id: 'a' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="inbox"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="detail-list"]') as HTMLSelectElement, {
      target: { value: 'work' },
    });
    fireEvent.click(container.querySelector('[data-planner="detail-save"]') as HTMLElement);

    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-smart')).toBe('all');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Входящая');
  });

  it('«Дублировать» создаёт копию и открывает её для правки', () => {
    seed(
      addCoachTask(
        emptyCoachPlanner(),
        { title: 'Разминка', date: today, tags: ['зал'], priority: 'high' },
        { id: 'a' },
      ).store,
    );
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    expect(container.querySelector('[data-planner="detail"]')?.getAttribute('data-task-id')).toBe('a');

    fireEvent.click(container.querySelector('[data-planner="detail-duplicate"]') as HTMLElement);

    const saved = readCoachPlanner(localStorage).items;
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ id: 'a', title: 'Разминка', tags: ['зал'], priority: 'high' });
    expect(saved[1].id).not.toBe('a');
    expect(saved[1]).toMatchObject({ title: 'Разминка', done: false, tags: ['зал'], priority: 'high' });
    // Карточка переключилась на копию, а строка списка появилась сразу.
    expect(container.querySelector('[data-planner="detail"]')?.getAttribute('data-task-id')).toBe(saved[1].id);
    expect(items(container)).toHaveLength(2);
  });

  it('копия из «Сделано» не теряется: открывается её день', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Готово', date: today }, { id: 'a' }).store;
    s = completeCoachTask(s, 'a');
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="done"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="detail-duplicate"]') as HTMLElement);

    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-smart')).toBe('all');
    // Закрытая задача и её новая копия — обе на экране.
    expect(items(container)).toHaveLength(2);
  });
});

describe('статистика', () => {
  it('карточка считает задачи планера, а не чужие дневники', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Сегодня', date: today }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Завтра', date: tomorrow }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    const stats = container.querySelector('[data-planner="stats"]');
    expect(stats).not.toBeNull();
    expect(stats?.querySelector('[data-stat="today"]')?.textContent).toContain('0/1');
    expect(stats?.querySelector('[data-stat="open"]')?.textContent).toContain('2');
    expect(stats?.querySelector('[data-stat="completed7"]')?.textContent).toContain('0');
  });
});

describe('виды и группировка', () => {
  it('канбан: пять колонок по спискам, счётчики честные', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Присед', date: today, list: 'training' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Созвон', date: today, list: 'work' }, { id: 'b' }).store;
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="view"][data-view="kanban"]') as HTMLElement);
    const columns = container.querySelectorAll('[data-planner="kanban-column"]');
    expect(columns).toHaveLength(5);
    expect(
      container.querySelector('[data-planner="kanban-column"][data-list="training"]')?.getAttribute('data-count'),
    ).toBe('1');
    // Пустая колонка — не «чёрная дыра»: подписано, почему в ней ничего нет.
    expect(container.querySelectorAll('[data-planner="kanban-empty"]')).toHaveLength(3);
  });

  it('матрица: важное и срочное — в квадранте «Сделать сейчас»', () => {
    seed(
      addCoachTask(emptyCoachPlanner(), { title: 'Срочно и важно', date: today, priority: 'high' }, { id: 'a' }).store,
    );
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="view"][data-view="matrix"]') as HTMLElement);
    const cells = container.querySelectorAll('[data-planner="matrix-cell"]');
    expect(cells).toHaveLength(4);
    expect(
      container.querySelector('[data-planner="matrix-cell"][data-quadrant="do"]')?.getAttribute('data-count'),
    ).toBe('1');
    expect(container.querySelectorAll('[data-planner="matrix-empty"]')).toHaveLength(3);
  });

  it('группировка по приоритету делит задачи на группы', () => {
    let s = emptyCoachPlanner();
    s = addCoachTask(s, { title: 'Важная', date: today, priority: 'high' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Обычная', date: today }, { id: 'b' }).store;
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelectorAll('[data-planner="group"]')).toHaveLength(0);
    fireEvent.change(container.querySelector('[data-planner="group-by"]') as HTMLSelectElement, {
      target: { value: 'priority' },
    });
    const groups = container.querySelectorAll('[data-planner="group"]');
    expect(groups).toHaveLength(2);
    expect(
      Array.from(groups)
        .map((g) => g.getAttribute('data-group'))
        .sort(),
    ).toEqual(['high', 'none']);
  });
});

describe('видимость новой задачи', () => {
  it('чипы списков считают текущий день, а не все дни', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Сегодня', date: today, list: 'training' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Завтра', date: tomorrow, list: 'work' }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    const chip = (id: string): HTMLElement =>
      container.querySelector(`[data-planner="list-chip"][data-list="${id}"]`) as HTMLElement;
    expect(chip('all').getAttribute('data-count')).toBe('1');
    expect(chip('training').getAttribute('data-count')).toBe('1');
    expect(chip('work').getAttribute('data-count')).toBe('0');
  });

  it('«скрыть сделанные» не врёт о прогрессе', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Сделана', date: today }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Открыта', date: today }, { id: 'b' }).store;
    s = completeCoachTask(s, 'a');
    seed(s);

    const { container } = render(<ProfilePlannerTab />);
    const progress = (): string =>
      container.querySelector('[data-planner="scope-label"]')?.parentElement?.textContent ?? '';
    expect(progress()).toContain('1/2 сделано');

    fireEvent.click(container.querySelector('[data-planner="show-done"]') as HTMLElement);
    expect(progress()).toContain('1/2 сделано');
    expect(items(container)).toHaveLength(1);
    expect(container.querySelector('[data-planner="hidden-done"]')).toBeNull();
  });

  it('если скрыты все задачи дня — это сказано словами, а не «задач нет»', () => {
    seed(
      completeCoachTask(addCoachTask(emptyCoachPlanner(), { title: 'Готово', date: today }, { id: 'a' }).store, 'a'),
    );
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="show-done"]') as HTMLElement);
    expect(items(container)).toHaveLength(0);
    expect(container.querySelector('[data-planner="hidden-done"]')?.textContent).toContain('уже сделаны');
    expect(container.querySelector('[data-planner="scope-label"]')?.parentElement?.textContent).toContain(
      '1/1 сделано',
    );
  });
  it('чип «День» считает выбранный день, а не все задачи планера', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Сегодня', date: today }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Завтра', date: tomorrow }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    const chip = (): HTMLElement =>
      container.querySelector('[data-planner="smart-chip"][data-smart="all"]') as HTMLElement;
    expect(chip().textContent).toContain('День');
    expect(chip().getAttribute('data-count')).toBe('1');

    fireEvent.click(container.querySelector(`[data-planner="cell"][data-date="${tomorrow}"]`) as HTMLElement);
    expect(chip().getAttribute('data-count')).toBe('1');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Завтра');
  });

  it('задача с датой за пределами «7 дней» открывает свой день, а не пропадает', () => {
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="next7"]') as HTMLElement);
    addTask(container, 'Далёкая задача через 30 дней');
    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-smart')).toBe('all');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Далёкая задача');
  });

  it('в умном списке «Сегодня» задача на завтра не теряется', () => {
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="today"]') as HTMLElement);
    addTask(container, 'Завтрашняя задача завтра');
    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-smart')).toBe('all');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Завтрашняя задача');
    expect(readCoachPlanner(localStorage).items[0].date).toBe(tomorrow);
  });

  it('активные поиск и фильтр приоритета не прячут новую задачу', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Старая', date: today, priority: 'high' }, { id: 'old' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.change(container.querySelector('[data-planner="priority-filter"]') as HTMLSelectElement, {
      target: { value: 'high' },
    });
    fireEvent.change(container.querySelector('[data-planner="search"]') as HTMLInputElement, {
      target: { value: 'нет-такого' },
    });
    expect(items(container)).toHaveLength(0);

    addTask(container, 'Новая задача');
    expect((container.querySelector('[data-planner="priority-filter"]') as HTMLSelectElement).value).toBe('all');
    expect((container.querySelector('[data-planner="search"]') as HTMLInputElement).value).toBe('');
    expect(items(container)).toHaveLength(2);
  });

  it('перенос даты в карточке открывает новый день', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Перенос', date: today }, { id: 't' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="detail-date"]') as HTMLInputElement, {
      target: { value: tomorrow },
    });
    fireEvent.click(container.querySelector('[data-planner="detail-save"]') as HTMLElement);
    expect(
      container.querySelector(`[data-planner="cell"][data-date="${tomorrow}"]`)?.getAttribute('data-selected'),
    ).toBe('true');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Перенос');
    expect(readCoachPlanner(localStorage).items[0].date).toBe(tomorrow);
  });
});

describe('ручной порядок и сортировка', () => {
  it('«выше/ниже» включает ручной порядок, даже если выбрана другая сортировка', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Альфа', date: today, time: '09:00' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Бета', date: today, time: '10:00' }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.change(container.querySelector('[data-planner="sort-by"]') as HTMLSelectElement, {
      target: { value: 'title' },
    });
    expect(items(container)[0].textContent).toContain('Альфа');

    fireEvent.click(items(container)[0].querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="detail-move-down"]') as HTMLElement);
    expect((container.querySelector('[data-planner="sort-by"]') as HTMLSelectElement).value).toBe('manual');
    expect(items(container)[0].textContent).toContain('Бета');
  });

  it('на границе дня стрелка порядка не притворяется рабочей', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Альфа', date: today, time: '09:00' }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Бета', date: today, time: '10:00' }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(items(container)[0].querySelector('[data-planner="open"]') as HTMLElement);

    const up = () => container.querySelector('[data-planner="detail-move-up"]') as HTMLButtonElement;
    const down = () => container.querySelector('[data-planner="detail-move-down"]') as HTMLButtonElement;
    expect(up().disabled).toBe(true);
    expect(down().disabled).toBe(false);

    fireEvent.click(down());
    // Задача стала последней: «вниз» больше некуда, «вверх» доступно.
    expect(up().disabled).toBe(false);
    expect(down().disabled).toBe(true);
  });
});

describe('просроченное', () => {
  it('показывает давность и переносит на сегодня только по явной кнопке', () => {
    const past = shiftIsoDate(today, -3);
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Долг', date: past }, { id: 'p' }).store);
    const { container } = render(<ProfilePlannerTab />);

    expect(container.querySelector('[data-planner="overdue-item"]')?.textContent).toContain('Долг');
    expect(container.querySelector('[data-planner="overdue-days"]')?.textContent).toContain('3');
    // Автопереноса нет: до нажатия дата срока не меняется.
    expect(readCoachPlanner(localStorage).items[0].date).toBe(past);

    fireEvent.click(container.querySelector('[data-planner="overdue-today"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items[0].date).toBe(today);
    expect(container.querySelector('[data-planner="overdue"]')).toBeNull();
  });

  it('«→1д» в «Просрочено» переносит на завтра, а не на день ближе', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Старый долг', date: shiftIsoDate(today, -5) }, { id: 'p' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="overdue"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="move"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items[0].date).toBe(tomorrow);
    expect(container.querySelector('[data-planner="overdue"]')).toBeNull();
  });

  it('подсказка объясняет, что просроченные не переносятся сами', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Долг', date: shiftIsoDate(today, -2) }, { id: 'old' }).store);
    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelector('[data-planner="overdue-hint"]')?.textContent).toContain('не переносятся');

    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="overdue"]') as HTMLElement);
    // В самом списке «Просрочено» объяснять уже нечего.
    expect(container.querySelector('[data-planner="overdue-hint"]')).toBeNull();
  });

  it('больше шести просроченных можно раскрыть — хвост не прячется', () => {
    const past = shiftIsoDate(today, -1);
    let s = emptyCoachPlanner();
    for (let i = 0; i < 7; i += 1) {
      s = addCoachTask(s, { title: `Долг ${i + 1}`, date: past }, { id: `p${i}` }).store;
    }
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelectorAll('[data-planner="overdue-item"]')).toHaveLength(6);
    const more = (): HTMLElement => container.querySelector('[data-planner="overdue-more"]') as HTMLElement;
    expect(more().textContent).toContain('7');

    fireEvent.click(more());
    expect(container.querySelectorAll('[data-planner="overdue-item"]')).toHaveLength(7);
    expect(more().textContent).toContain('Свернуть');

    fireEvent.click(more());
    expect(container.querySelectorAll('[data-planner="overdue-item"]')).toHaveLength(6);
  });
});

describe('серия, залипшие фильтры и клавиатура', () => {
  it('«следующее вхождение» сдвигает серию, показывает новый день и начинает чеклист заново', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Зарядка', date: today, repeat: 'daily' }, { id: 'r' }).store;
    s = addCoachSubtask(s, 'r', 'Разминка', { id: 's1' });
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="subtask-toggle"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items[0].subtasks?.[0]?.done).toBe(true);
    expect(container.textContent).toContain('Чеклист начнётся заново');

    fireEvent.click(container.querySelector('[data-planner="detail-skip"]') as HTMLElement);

    const next = shiftIsoDate(today, 1);
    const moved = readCoachPlanner(localStorage).items[0];
    expect(moved).toMatchObject({ date: next, done: false });
    expect(moved.subtasks?.[0]).toMatchObject({ id: 's1', done: false });
    expect(container.querySelector(`[data-planner="cell"][data-date="${next}"]`)?.getAttribute('data-selected')).toBe(
      'true',
    );
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Зарядка');
  });

  it('активный тег не теряется при смене дня и сбрасывается кнопкой', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Сегодня', date: today, tags: ['зал'] }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Завтра', date: tomorrow, tags: ['работа'] }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="tag-chip"][data-tag="зал"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);

    fireEvent.click(container.querySelector(`[data-planner="cell"][data-date="${tomorrow}"]`) as HTMLElement);
    const chip = container.querySelector('[data-planner="tag-chip"][data-tag="зал"]') as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.getAttribute('data-active')).toBe('true');
    expect(chip.getAttribute('data-count')).toBe('0');
    expect(items(container)).toHaveLength(0);

    fireEvent.click(container.querySelector('[data-planner="tag-clear"]') as HTMLElement);
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Завтра');
  });

  it('Esc отменяет удаление и закрывает карточку', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Задача', date: today }, { id: 'a' }).store);
    const { container } = render(<ProfilePlannerTab />);
    const del = (): HTMLElement => container.querySelector('[data-planner="delete"]') as HTMLElement;
    fireEvent.click(del());
    expect(del().textContent).toContain('Точно?');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(del().textContent).not.toContain('Точно?');
    expect(readCoachPlanner(localStorage).items).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    expect(container.querySelector('[data-planner="detail"]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-planner="detail"]')).toBeNull();
  });

  it('удаление можно отменить кнопкой «Вернуть»', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Удаляемая', date: today }, { id: 'a' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="delete"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items).toHaveLength(0);
    expect(container.querySelector('[data-planner="undo-delete"]')?.textContent).toContain('Удаляемая');

    fireEvent.click(container.querySelector('[data-planner="undo-delete-button"]') as HTMLElement);
    expect(readCoachPlanner(localStorage).items).toHaveLength(1);
    expect(readCoachPlanner(localStorage).items[0]).toMatchObject({ id: 'a', title: 'Удаляемая', date: today });
    expect(items(container)).toHaveLength(1);
    expect(container.querySelector('[data-planner="undo-delete"]')).toBeNull();
  });

  it('«Вернуть» после смены дня показывает день возвращённой задачи', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Возврат', date: today }, { id: 'a' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector(`[data-planner="cell"][data-date="${tomorrow}"]`) as HTMLElement);
    expect(items(container)).toHaveLength(0);

    fireEvent.click(container.querySelector('[data-planner="undo-delete-button"]') as HTMLElement);
    expect(container.querySelector(`[data-planner="cell"][data-date="${today}"]`)?.getAttribute('data-selected')).toBe(
      'true',
    );
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('Возврат');
  });
});

describe('лимит подзадач', () => {
  it('на максимуме поле и кнопка выключены, лимит назван', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Большая', date: today }, { id: 'a' }).store;
    for (let i = 0; i < 30; i += 1) s = addCoachSubtask(s, 'a', `Шаг ${i + 1}`);
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="open"]') as HTMLElement);
    expect((container.querySelector('[data-planner="subtask-input"]') as HTMLInputElement).disabled).toBe(true);
    expect((container.querySelector('[data-planner="subtask-add"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-planner="subtask-limit"]')?.textContent).toContain('Достигнут лимит');
  });
});

describe('фильтры не врут про пустой день', () => {
  it('скрытие фильтрами названо, «Сбросить фильтры» возвращает задачи', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Задача А', date: today, tags: ['зал'] }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Задача Б', date: today, tags: ['работа'] }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelector('[data-planner="filter-status"]')).toBeNull();

    fireEvent.change(container.querySelector('[data-planner="search"]') as HTMLInputElement, {
      target: { value: 'нет-такой' },
    });
    expect(items(container)).toHaveLength(0);
    expect(container.querySelector('[data-planner="filter-status"]')?.textContent).toContain(
      'Скрыто фильтрами: 2 из 2',
    );
    expect(container.querySelector('[data-planner="empty-hint"]')?.textContent).toContain(
      'Под фильтры ничего не подходит',
    );

    fireEvent.click(container.querySelector('[data-planner="filter-reset"]') as HTMLElement);
    expect(items(container)).toHaveLength(2);
    expect(container.querySelector('[data-planner="filter-status"]')).toBeNull();
    expect((container.querySelector('[data-planner="search"]') as HTMLInputElement).value).toBe('');
    // Это не «нет задач»: день был и остался полным.
    expect(container.querySelector('[data-planner="empty-hint"]')).toBeNull();
  });

  it('поясняет, где именно идёт поиск', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'Задача А', date: today }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'Задача Б', date: tomorrow }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    expect(container.querySelector('[data-planner="search-scope"]')).toBeNull();

    fireEvent.change(container.querySelector('[data-planner="search"]') as HTMLInputElement, {
      target: { value: 'Задача' },
    });
    expect(container.querySelector('[data-planner="search-scope"]')?.textContent).toContain('по выбранному дню');
    expect(items(container)).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-planner="smart-chip"][data-smart="next7"]') as HTMLElement);
    expect(container.querySelector('[data-planner="search-scope"]')?.textContent).toContain('внутри списка');
    expect(items(container)).toHaveLength(2);
  });

  it('сохранённый фильтр подсвечен, только пока экран совпадает', () => {
    let s = addCoachTask(emptyCoachPlanner(), { title: 'С залом', date: today, tags: ['зал'] }, { id: 'a' }).store;
    s = addCoachTask(s, { title: 'С работой', date: today, tags: ['работа'] }, { id: 'b' }).store;
    seed(s);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="tag-chip"][data-tag="зал"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="filter-name"]') as HTMLInputElement, {
      target: { value: 'Только зал' },
    });
    fireEvent.click(container.querySelector('[data-planner="filter-save"]') as HTMLElement);

    const chip = (): HTMLElement => container.querySelector('[data-planner="filter-chip"]') as HTMLElement;
    expect(chip().getAttribute('data-active')).toBe('true');

    fireEvent.change(container.querySelector('[data-planner="priority-filter"]') as HTMLSelectElement, {
      target: { value: 'high' },
    });
    expect(chip().getAttribute('data-active')).toBe('false');

    fireEvent.click(chip());
    expect(chip().getAttribute('data-active')).toBe('true');
    expect(items(container)).toHaveLength(1);
    expect(items(container)[0].textContent).toContain('С залом');
  });

  it('сохранённый фильтр возвращает ещё и вид/сортировку', () => {
    seed(addCoachTask(emptyCoachPlanner(), { title: 'Зал', date: today, tags: ['зал'] }, { id: 'a' }).store);
    const { container } = render(<ProfilePlannerTab />);
    fireEvent.click(container.querySelector('[data-planner="tag-chip"][data-tag="зал"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-planner="view"][data-view="kanban"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="sort-by"]') as HTMLSelectElement, {
      target: { value: 'title' },
    });
    fireEvent.change(container.querySelector('[data-planner="filter-name"]') as HTMLInputElement, {
      target: { value: 'Канбан' },
    });
    fireEvent.click(container.querySelector('[data-planner="filter-save"]') as HTMLElement);
    expect(readCoachFilters(localStorage).items[0]).toMatchObject({ view: 'kanban', sortBy: 'title' });

    // Вернулись в список с обычной сортировкой — фильтр больше не «применён».
    fireEvent.click(container.querySelector('[data-planner="view"][data-view="list"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-planner="sort-by"]') as HTMLSelectElement, {
      target: { value: 'smart' },
    });
    const chip = (): HTMLElement => container.querySelector('[data-planner="filter-chip"]') as HTMLElement;
    expect(chip().getAttribute('data-active')).toBe('false');

    fireEvent.click(chip());
    expect(container.querySelector('[data-planner="day"]')?.getAttribute('data-view')).toBe('kanban');
    expect((container.querySelector('[data-planner="sort-by"]') as HTMLSelectElement).value).toBe('title');
    expect(chip().getAttribute('data-active')).toBe('true');
  });
});
