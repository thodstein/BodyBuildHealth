/**
 * coach-assignments-card.test.tsx — карточка «Назначения» в режиме тренера.
 *
 * Проверяем то, что видит и делает тренер:
 *  • без атлетов карточка не притворяется рабочей;
 *  • «Взять у атлета» снимает рацион в библиотеку (без дневников и веса);
 *  • «Выдать» пишет план в пространство выбранного атлета и оставляет журнал;
 *  • анализы назначаются списком маркеров и закрываются вручную;
 *  • лист назначения собирается по данным и печатается (PDF через печать).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CoachAssignmentsCard } from '../CoachAssignmentsCard';
import {
  addCoachAthlete,
  emptyCoachState,
  type CoachAthlete,
} from '../../../../engines/coach/coach-mode.engine';
import { athleteSpaceId, toPhysicalKey } from '../../../../core/data-space';
import { readCoachAssignments } from '../../../../engines/coach/coach-assignment-library.engine';
import { readCoachLabOrders } from '../../../../engines/coach/coach-lab-order.engine';

const share = vi.hoisted(() => ({
  saved: [] as string[],
  printed: [] as string[],
}));

vi.mock('../../../../core/apk-share', () => ({
  saveTextFileApk: vi.fn(async (name: string) => {
    share.saved.push(name);
    return 'saved';
  }),
  printHtmlApk: vi.fn(async (html: string, name: string) => {
    share.printed.push(`${name}\n${html}`);
    return 'saved';
  }),
  shareOutcomeLabel: (o: string) => `[${o}]`,
}));

// Каталог поддержки тяжёлый: имя БАДа подменяем, проверяем не его.
vi.mock('../../../../data/support-names', () => ({
  supportNameRu: (id: string) => `БАД:${id}`,
}));

// Каталог фармы тяжёлый и грузится отдельным чанком — в тесте он не нужен.
vi.mock('../../../../core/pharma-database', () => ({
  PHARMA_DB: { test_e: { id: 'test_e', name: 'Тестостерон энантат', class: 'testosterone' } },
}));

// База атлета: в тесте её заменяет память — проверяем контракт выдачи курса.
const courseStore = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>[]>(),
  writes: [] as { spaceId: string; rows: Record<string, unknown>[] }[],
}));

vi.mock('../../../../engines/coach/coach-course-store', () => ({
  readCourseRows: vi.fn(async (spaceId: string) => courseStore.rows.get(spaceId) ?? []),
  writeCoachCourse: vi.fn(async (spaceId: string, rows: Record<string, unknown>[]) => {
    courseStore.writes.push({ spaceId, rows });
    courseStore.rows.set(spaceId, rows);
    return { ok: true, written: rows.length, removed: 0, error: null };
  }),
  coachCourseStoreErrorText: () => '',
}));

const PLANS = 'he_saved_nutrition_plans';
const SUPPORT = 'he_support_plan_result';
const DIARY = 'he_diary_v2';

function athletes(): CoachAthlete[] {
  let state = emptyCoachState();
  state = addCoachAthlete(state, { name: 'Иван', goal: 'присед 200' }, { id: 'a1', now: '2026-11-01T10:00:00.000Z' }).state;
  state = addCoachAthlete(state, { name: 'Пётр' }, { id: 'a2', now: '2026-11-01T10:00:00.000Z' }).state;
  return state.athletes;
}

const planJson = JSON.stringify([{ id: 1, name: 'База 2500', date: '2026-11-10', dayPlan: { totals: { kcal: 2500 } } }]);

beforeEach(() => {
  share.saved.length = 0;
  share.printed.length = 0;
  courseStore.rows.clear();
  courseStore.writes.length = 0;
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('пустое состояние', () => {
  it('без атлетов не показывает рабочие кнопки', () => {
    const { container } = render(<CoachAssignmentsCard athletes={[]} />);
    expect(container.querySelector('[data-coach="assign-no-athletes"]')).not.toBeNull();
    expect(container.querySelector('[data-coach="assign-tab"]')).toBeNull();
  });
});

describe('питание и БАДы', () => {
  it('«Взять у атлета» снимает рацион в библиотеку и не тащит дневник', () => {
    const list = athletes();
    const sid = athleteSpaceId('a1');
    localStorage.setItem(toPhysicalKey(sid, PLANS), planJson);
    localStorage.setItem(toPhysicalKey(sid, DIARY), '{"secret":"вес"}');

    const { container } = render(<CoachAssignmentsCard athletes={list} activeAthleteId="a1" />);
    fireEvent.click(container.querySelector('[data-coach="assign-take"]') as HTMLElement);

    expect(container.querySelector('[data-coach="assign-template"]')).not.toBeNull();
    const store = readCoachAssignments(localStorage);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].kind).toBe('nutrition');
    expect(JSON.stringify(store.items[0].bundle)).toContain('База 2500');
    expect(JSON.stringify(store.items[0].bundle)).not.toContain('вес');
  });

  it('если у атлета нет рациона — говорит об этом, а не создаёт пустой шаблон', () => {
    const list = athletes();
    const { container } = render(<CoachAssignmentsCard athletes={list} activeAthleteId="a1" />);
    fireEvent.click(container.querySelector('[data-coach="assign-take"]') as HTMLElement);
    expect(container.querySelector('[data-coach="assign-error"]')?.textContent).toContain('нет сохранённого');
    expect(readCoachAssignments(localStorage).items).toHaveLength(0);
  });

  it('«Выдать» пишет рацион выбранному атлету, оставляет дневник и журнал', () => {
    const list = athletes();
    const from = athleteSpaceId('a1');
    localStorage.setItem(toPhysicalKey(from, PLANS), planJson);
    localStorage.setItem(toPhysicalKey(athleteSpaceId('a2'), DIARY), '{"keep":true}');
    const onAudit = vi.fn();

    const { container } = render(
      <CoachAssignmentsCard athletes={list} activeAthleteId="a1" onAudit={onAudit} />,
    );
    fireEvent.click(container.querySelector('[data-coach="assign-take"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="assign-issue"]') as HTMLElement);

    const picks = Array.from(container.querySelectorAll('[data-coach="assign-pick"] input')) as HTMLElement[];
    expect(picks).toHaveLength(2);
    fireEvent.click(picks[1]); // Пётр
    const confirm = container.querySelector('[data-coach="assign-issue-confirm"]') as HTMLElement;
    expect(confirm.textContent).toContain('(1)');
    fireEvent.click(confirm);

    const to = athleteSpaceId('a2');
    expect(localStorage.getItem(toPhysicalKey(to, PLANS))).toBe(planJson);
    expect(localStorage.getItem(toPhysicalKey(to, DIARY))).toBe('{"keep":true}');
    expect(readCoachAssignments(localStorage).items[0].issuedCount).toBe(1);
    expect(onAudit).toHaveBeenCalledWith('nutrition-issued', 'a2');
    expect(container.querySelector('[data-coach="assign-notice"]')?.textContent).toContain('Пётр');
  });

  it('БАДы живут отдельно от питания: выдача протокола не стирает рацион', () => {
    const list = athletes();
    const from = athleteSpaceId('a1');
    localStorage.setItem(toPhysicalKey(from, SUPPORT), JSON.stringify(['mag', 'd3']));
    const { container } = render(<CoachAssignmentsCard athletes={list} activeAthleteId="a1" />);

    fireEvent.click(container.querySelector('[data-tab="supplements"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="assign-take"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="assign-issue"]') as HTMLElement);
    fireEvent.click((container.querySelectorAll('[data-coach="assign-pick"] input') as NodeListOf<HTMLElement>)[1]);
    fireEvent.click(container.querySelector('[data-coach="assign-issue-confirm"]') as HTMLElement);

    const to = athleteSpaceId('a2');
    expect(localStorage.getItem(toPhysicalKey(to, SUPPORT))).toBe('["mag","d3"]');
    expect(localStorage.getItem(toPhysicalKey(to, PLANS))).toBeNull();
  });
});

describe('анализы', () => {
  it('назначаются маркерами со сроком и закрываются вручную', () => {
    const list = athletes();
    const onAudit = vi.fn();
    const { container } = render(
      <CoachAssignmentsCard athletes={list} activeAthleteId="a1" onAudit={onAudit} />,
    );
    fireEvent.click(container.querySelector('[data-tab="labs"]') as HTMLElement);

    const boxes = container.querySelectorAll('[data-coach="assign-lab-marker"] input');
    expect(boxes.length).toBeGreaterThan(0);
    fireEvent.click(boxes[0] as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="assign-lab-due"]') as HTMLElement, {
      target: { value: '2026-12-01' },
    });
    fireEvent.change(container.querySelector('[data-coach="assign-lab-comment"]') as HTMLElement, {
      target: { value: 'натощак' },
    });
    fireEvent.click(container.querySelector('[data-coach="assign-lab-create"]') as HTMLElement);

    const store = readCoachLabOrders(localStorage);
    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({ athleteId: 'a1', dueDate: '2026-12-01', comment: 'натощак' });
    expect(store.items[0].markers).toHaveLength(1);
    expect(onAudit).toHaveBeenCalledWith('lab-order-created', 'a1');

    const order = container.querySelector('[data-coach="assign-lab-order"]') as HTMLElement;
    expect(order.getAttribute('data-state')).toBe('open');
    const done = Array.from(order.querySelectorAll('button')).find(b => b.textContent === 'Сдано') as HTMLElement;
    fireEvent.click(done);
    expect(readCoachLabOrders(localStorage).items[0].doneAt).toBeTruthy();
    expect(
      (container.querySelector('[data-coach="assign-lab-order"]') as HTMLElement).getAttribute('data-state'),
    ).toBe('done');
  });

  it('без маркеров кнопка неактивна', () => {
    const { container } = render(<CoachAssignmentsCard athletes={athletes()} activeAthleteId="a1" />);
    fireEvent.click(container.querySelector('[data-tab="labs"]') as HTMLElement);
    const create = container.querySelector('[data-coach="assign-lab-create"]') as HTMLButtonElement;
    expect(create.disabled).toBe(true);
  });
});

describe('курс', () => {
  /** Открыть вкладку «Курс» и дождаться каталога (он грузится чанком). */
  async function openCourseTab(container: HTMLElement) {
    fireEvent.click(container.querySelector('[data-tab="course"]') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[data-coach="assign-course-item"]')).not.toBeNull());
  }

  function addCourseItem(container: HTMLElement) {
    fireEvent.click(container.querySelector('[data-coach="assign-course-item"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="assign-course-dose"]') as HTMLElement, {
      target: { value: '500' },
    });
    fireEvent.change(container.querySelector('[data-coach="assign-course-from"]') as HTMLElement, {
      target: { value: '1' },
    });
    fireEvent.change(container.querySelector('[data-coach="assign-course-to"]') as HTMLElement, {
      target: { value: '12' },
    });
    fireEvent.click(container.querySelector('[data-coach="assign-course-add"]') as HTMLElement);
  }

  it('собирается из каталога и уходит в библиотеку шаблоном', async () => {
    const onAudit = vi.fn();
    const { container } = render(
      <CoachAssignmentsCard athletes={athletes()} activeAthleteId="a1" onAudit={onAudit} />,
    );
    await openCourseTab(container);
    addCourseItem(container);

    expect((container.querySelector('[data-coach="assign-course-draft"]') as HTMLElement).textContent).toContain(
      'Тестостерон энантат 500 мг',
    );

    fireEvent.click(container.querySelector('[data-coach="assign-course-save"]') as HTMLElement);
    const store = readCoachAssignments(localStorage);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].kind).toBe('course');
    expect(store.items[0].bundle.coursePlan?.items[0]).toMatchObject({
      substanceId: 'test_e',
      doseValue: 500,
      startWeek: 1,
      endWeek: 12,
    });
    expect(container.querySelector('[data-coach="assign-template"][data-kind="course"]')).not.toBeNull();
    expect(onAudit).toHaveBeenCalledWith('assignment-saved', 'a1');
  });

  it('выдача пишет препараты в базу атлета и дату старта курса', async () => {
    const onAudit = vi.fn();
    const { container } = render(
      <CoachAssignmentsCard athletes={athletes()} activeAthleteId="a1" onAudit={onAudit} />,
    );
    await openCourseTab(container);
    addCourseItem(container);
    fireEvent.click(container.querySelector('[data-coach="assign-course-save"]') as HTMLElement);

    fireEvent.click(container.querySelector('[data-coach="assign-issue"]') as HTMLElement);
    fireEvent.click((container.querySelectorAll('[data-coach="assign-pick"] input') as NodeListOf<HTMLElement>)[1]);
    fireEvent.click(container.querySelector('[data-coach="assign-issue-confirm"]') as HTMLElement);

    await waitFor(() => expect(courseStore.writes).toHaveLength(1));
    const to = athleteSpaceId('a2');
    expect(courseStore.writes[0].spaceId).toBe(to);
    expect(courseStore.writes[0].rows[0]).toMatchObject({ id: 'coach_course_1', substanceId: 'test_e', doseValue: 500 });
    expect(localStorage.getItem(toPhysicalKey(to, 'he_course_start_date'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(readCoachAssignments(localStorage).items[0].issuedCount).toBe(1);
    expect(onAudit).toHaveBeenCalledWith('course-issued', 'a2');
  });

  it('«Взять у атлета» снимает его курс, а без курса честно говорит', async () => {
    const { container } = render(<CoachAssignmentsCard athletes={athletes()} activeAthleteId="a1" />);
    await openCourseTab(container);

    fireEvent.click(container.querySelector('[data-coach="assign-take"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="assign-error"]')?.textContent).toContain('нет курса'),
    );
    expect(readCoachAssignments(localStorage).items).toHaveLength(0);

    courseStore.rows.set(athleteSpaceId('a1'), [
      {
        id: 'own_1',
        substanceId: 'test_e',
        doseValue: 250,
        doseUnit: 'мг',
        frequency: 2,
        startWeek: 1,
        endWeek: 10,
        startDate: '2026-11-20',
      },
    ]);
    fireEvent.click(container.querySelector('[data-coach="assign-take"]') as HTMLElement);
    await waitFor(() => expect(readCoachAssignments(localStorage).items).toHaveLength(1));
    const saved = readCoachAssignments(localStorage).items[0];
    expect(saved.kind).toBe('course');
    expect(saved.bundle.coursePlan?.items[0]).toMatchObject({ substanceId: 'test_e', doseValue: 250, endWeek: 10 });
    expect(saved.bundle.coursePlan?.startDate).toBe('2026-11-20');
  });

  it('в листе назначения курс печатается препаратами', async () => {
    courseStore.rows.set(athleteSpaceId('a1'), [
      {
        id: 'coach_course_1',
        substanceId: 'test_e',
        doseValue: 500,
        doseUnit: 'мг',
        frequency: 2,
        startWeek: 1,
        endWeek: 12,
        startDate: '2026-11-20',
      },
    ]);
    const { container } = render(<CoachAssignmentsCard athletes={athletes()} activeAthleteId="a1" />);
    fireEvent.click(container.querySelector('[data-tab="sheet"]') as HTMLElement);

    await waitFor(() => {
      const text = container.querySelector('[data-coach="assign-sheet-text"]')?.textContent ?? '';
      expect(text).toContain('КУРС');
      expect(text).toContain('Тестостерон энантат 500 мг');
      expect(text).toContain('Старт: 20.11.2026');
    });
  });
});

describe('лист назначения', () => {
  it('собирается по данным атлета и печатается как PDF', async () => {
    const list = athletes();
    const sid = athleteSpaceId('a1');
    localStorage.setItem(toPhysicalKey(sid, PLANS), planJson);
    localStorage.setItem(toPhysicalKey(sid, SUPPORT), JSON.stringify(['mag']));
    const onAudit = vi.fn();

    const { container } = render(
      <CoachAssignmentsCard athletes={list} activeAthleteId="a1" onAudit={onAudit} />,
    );
    fireEvent.click(container.querySelector('[data-tab="sheet"]') as HTMLElement);

    await waitFor(() => {
      expect(container.querySelector('[data-coach="assign-sheet-text"]')).not.toBeNull();
    });
    const text = (container.querySelector('[data-coach="assign-sheet-text"]') as HTMLElement).textContent ?? '';
    expect(text).toContain('ЛИСТ НАЗНАЧЕНИЯ');
    expect(text).toContain('Иван');
    expect(text).toContain('База 2500');
    // Имена БАДов разворачиваются через каталог, а не показываются сырыми id.
    expect(text).toContain('БАД:mag');

    fireEvent.click(container.querySelector('[data-coach="assign-sheet-print"]') as HTMLElement);
    await waitFor(() => expect(share.printed).toHaveLength(1));
    expect(share.printed[0]).toContain('Лист назначения');
    expect(share.printed[0]).toContain('assignment-Иван-');
    expect(onAudit).toHaveBeenCalledWith('sheet-printed', 'a1');
  });
});
