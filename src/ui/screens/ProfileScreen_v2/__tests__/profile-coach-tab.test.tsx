/**
 * profile-coach-tab.test.tsx — UI режима тренера в профиле.
 *
 * Проверяем продуктовые обещания, которые видит человек:
 *  • выключатель в профиле, включение не оставляет пустой экран;
 *  • до 20 атлетов, на 21-м — честное сообщение, форма добавления закрыта;
 *  • разделы можно снять/выбрать все, быстрый переход ведёт в раздел приложения;
 *  • удаление — через подтверждение, а не «одним тапом навсегда».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProfileCoachTab } from '../ProfileCoachTab';
import {
  COACH_MAX_ATHLETES,
  COACH_SECTIONS,
  addCoachAthlete,
  emptyCoachState,
  readCoachState,
  setCoachEnabled,
  writeCoachState,
  type CoachAthlete,
} from '../../../../engines/coach/coach-mode.engine';
import {
  ATHLETE_SPACE_PREFIX,
  DATA_SPACE_KEY,
  HOME_SPACE_ID,
  _resetDataSpaceCache,
  athleteSpaceId,
  emptyRegistry,
  readRegistryFromStorage,
  touchSpaceOpened,
  upsertSpace,
  writeRegistryToStorage,
} from '../../../../core/data-space';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});

const seed = (athletes: number) => {
  let s = setCoachEnabled(emptyCoachState(), true);
  for (let i = 1; i <= athletes; i++) {
    s = addCoachAthlete(s, { name: `Атлет ${i}` }, { id: `a${i}`, now: '2026-11-04T10:00:00.000Z' }).state;
  }
  writeCoachState(localStorage, s);
  return s;
};

const athleteCards = (c: HTMLElement): NodeListOf<HTMLElement> =>
  c.querySelectorAll('[data-coach="athlete"]');

describe('переключатель', () => {
  it('по умолчанию выключен; включение показывает разделы и список атлетов', () => {
    const { container } = render(<ProfileCoachTab />);
    const toggle = container.querySelector('[data-coach="toggle"]') as HTMLElement;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('[data-coach="sections"]')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-coach="sections"]')).not.toBeNull();
    expect(container.querySelector('[data-coach="athletes"]')).not.toBeNull();
    // первое включение — все разделы, а не пусто
    expect(container.querySelectorAll('[data-coach="section"][data-on="true"]')).toHaveLength(COACH_SECTIONS.length);
  });

  it('выключение сохраняется в состоянии (режим не включается «сам»)', () => {
    const { container } = render(<ProfileCoachTab />);
    const toggle = container.querySelector('[data-coach="toggle"]') as HTMLElement;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(readCoachState(localStorage).enabled).toBe(false);
  });
});

describe('разделы', () => {
  it('чип снимается и возвращается, счётчик честный', () => {
    seed(0);
    const { container } = render(<ProfileCoachTab />);
    const chip = container.querySelector('[data-coach="section"][data-section="nutrition"]') as HTMLElement;
    expect(chip.getAttribute('data-on')).toBe('true');
    fireEvent.click(chip);
    expect(chip.getAttribute('data-on')).toBe('false');
    expect(container.querySelector('[data-coach="sections"]')?.textContent).toContain(`${COACH_SECTIONS.length - 1} из ${COACH_SECTIONS.length}`);
    fireEvent.click(chip);
    expect(chip.getAttribute('data-on')).toBe('true');
  });

  it('«Снять все» оставляет предупреждение, «Выбрать все» возвращает выбор', () => {
    seed(0);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="select-none"]') as HTMLElement);
    expect(container.querySelectorAll('[data-coach="section"][data-on="true"]')).toHaveLength(0);
    expect(container.textContent).toContain('Выберите хотя бы один');
    fireEvent.click(container.querySelector('[data-coach="select-all"]') as HTMLElement);
    expect(container.querySelectorAll('[data-coach="section"][data-on="true"]')).toHaveLength(COACH_SECTIONS.length);
  });

  it('быстрый переход зовёт навигацию с реальным ключом раздела', () => {
    seed(0);
    const onNavigate = vi.fn();
    const { container } = render(<ProfileCoachTab onNavigate={onNavigate} />);
    fireEvent.click(container.querySelector('[data-coach="section-link"]') as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith('training');
  });
});

describe('атлеты', () => {
  it('добавление: карточка появляется, атлет становится активным, данные сохраняются', () => {
    seed(0);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLInputElement, { target: { value: '  Иван  ' } });
    fireEvent.change(container.querySelector('[data-coach="age"]') as HTMLInputElement, { target: { value: '28' } });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);

    const cards = athleteCards(container);
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Иван');
    expect(cards[0].getAttribute('data-active')).toBe('true');
    const saved = readCoachState(localStorage);
    expect(saved.athletes[0]).toMatchObject({ name: 'Иван', age: 28 });
    expect(saved.activeAthleteId).toBe(saved.athletes[0].id);
    // форма очищена после сохранения
    expect((container.querySelector('[data-coach="name"]') as HTMLInputElement).value).toBe('');
  });

  it('пустое имя — ошибка, карточка не создаётся', () => {
    seed(0);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);
    expect(container.querySelector('[data-coach="error"]')?.textContent).toContain('Имя обязательно');
    expect(athleteCards(container)).toHaveLength(0);
  });

  it(`лимит ${COACH_MAX_ATHLETES}: форма закрыта, причина написана`, () => {
    seed(COACH_MAX_ATHLETES);
    const { container } = render(<ProfileCoachTab />);
    expect(athleteCards(container)).toHaveLength(COACH_MAX_ATHLETES);
    expect(container.querySelector('[data-coach="form"]')).toBeNull();
    expect(container.querySelector('[data-coach="limit"]')?.textContent).toContain(String(COACH_MAX_ATHLETES));
    expect(container.querySelector('[data-coach="save"]')).toBeNull();
  });

  it('поиск фильтрует список по имени', () => {
    let s = setCoachEnabled(emptyCoachState(), true);
    s = addCoachAthlete(s, { name: 'Иван' }, { id: 'a1' }).state;
    s = addCoachAthlete(s, { name: 'Пётр' }, { id: 'a2' }).state;
    writeCoachState(localStorage, s);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.change(container.querySelector('[data-coach="search"]') as HTMLInputElement, { target: { value: 'пётр' } });
    const cards = athleteCards(container);
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Пётр');
  });

  it('переключение активного атлета', () => {
    seed(2);
    const { container } = render(<ProfileCoachTab />);
    // первый добавленный (a1) активен по умолчанию — переключаемся на второго
    const second = container.querySelector('[data-coach="athlete"][data-athlete-id="a2"]') as HTMLElement;
    fireEvent.click(second.querySelector('[data-coach="activate"]') as HTMLElement);
    expect(readCoachState(localStorage).activeAthleteId).toBe('a2');
    const activeAfter = container.querySelector('[data-coach="athlete"][data-athlete-id="a2"]') as HTMLElement;
    expect(activeAfter.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-coach="athlete"][data-athlete-id="a1"]')?.getAttribute('data-active')).toBe('false');
  });

  it('удаление требует подтверждения и сбрасывает активного', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    const del = container.querySelector('[data-coach="delete"]') as HTMLElement;
    fireEvent.click(del);
    expect(readCoachState(localStorage).athletes).toHaveLength(1); // первый клик — только спрос
    expect(container.textContent).toContain('Точно удалить');
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    expect(readCoachState(localStorage).athletes).toHaveLength(0);
    expect(readCoachState(localStorage).activeAthleteId).toBeNull();
    expect(athleteCards(container)).toHaveLength(0);
  });

  it('правка имени сохраняется в карточке', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="edit"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLInputElement, { target: { value: 'Иван П.' } });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);
    expect((readCoachState(localStorage).athletes[0] as CoachAthlete).name).toBe('Иван П.');
    expect(container.textContent).toContain('Иван П.');
  });

  it('в подтверждении удаления сказано, что заметки/задачи/журнал остаются, а данные — отдельная кнопка', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    const hint = container.querySelector('[data-coach="delete-hint"]')?.textContent ?? '';
    expect(hint).toContain('только карточку');
    expect(hint).toContain('записи журнала');
    expect(hint).toContain('Удалить и его данные');
  });

  it('подтверждение показывает измеренный объём, а не выдуманный', () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    localStorage.setItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`, 'x'.repeat(2048));
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    const hint = container.querySelector('[data-coach="delete-hint"]')?.textContent ?? '';
    // 2048 символов профиля — это ровно 2,0 КБ текста; размер берём из хранилища
    expect(hint).toContain('2,0 КБ');
    expect(hint).toContain('настроек и планов');
  });

  it('кнопка «Удалить и его данные» есть, только если у атлета есть свои данные (в памяти или в базе)', async () => {
    seed(1);
    const first = render(<ProfileCoachTab />);
    fireEvent.click(first.container.querySelector('[data-coach="delete"]') as HTMLElement);
    // Пока объём неизвестен, кнопка видна: у атлета могут быть записи ТОЛЬКО
    // в базе IndexedDB (дневники тренировок, анализы), и спрятать кнопку значит
    // сделать эти данные неудаляемыми. Как только выяснили, что пусто — убираем.
    await waitFor(() =>
      expect(first.container.querySelector('[data-coach="delete-with-data"]')).toBeNull(),
    );
    cleanup();

    // имитируем «атлет вошёл»: его пространство содержит собственный профиль
    const sid = athleteSpaceId('a1');
    localStorage.setItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`, '{"name":"Иван"}');

    const second = render(<ProfileCoachTab />);
    fireEvent.click(second.container.querySelector('[data-coach="delete"]') as HTMLElement);
    const btn = second.container.querySelector('[data-coach="delete-with-data"]');
    expect(btn).not.toBeNull();
    // в самой кнопке цифры нет: объём пишем в подсказке, где он посчитан честно
    expect(btn?.textContent).toBe('Удалить и его данные');
  });

  it('«Удалить и его данные» стирает данные атлета, но не трогает профиль тренера', () => {
    seed(1);
    localStorage.setItem('he_profile_v2', '{"name":"Тренер"}');
    const sid = athleteSpaceId('a1');
    localStorage.setItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`, '{"name":"Иван"}');

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="delete-with-data"]') as HTMLElement);

    expect(readCoachState(localStorage).athletes).toHaveLength(0);
    expect(localStorage.getItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`)).toBeNull();
    expect(localStorage.getItem('he_profile_v2')).toBe('{"name":"Тренер"}');
  });

  it('обычное удаление убирает из реестра ПУСТОЕ пространство атлета', () => {
    seed(1);
    // Атлет заходил в приложение, но ничего не записал
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(false);
  });

  it('обычное удаление НЕ выбрасывает запись пространства, в котором есть данные', () => {    seed(1);
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    localStorage.setItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`, '{"name":"Иван"}');
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    // данные остались — значит запись должна остаться, иначе до них не добраться
    expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(true);
    expect(localStorage.getItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`)).toBe('{"name":"Иван"}');
  });

  it('в карточке видно факты о данных атлета: есть ли данные и когда открывали', () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    let reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry;
    reg = touchSpaceOpened(reg, sid, '2026-11-03T09:00:00.000Z');
    writeRegistryToStorage(reg);
    localStorage.setItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`, 'x'.repeat(2048));

    const { container } = render(<ProfileCoachTab />);
    const facts = container.querySelector('[data-coach="space-facts"]')?.textContent ?? '';
    expect(facts).toContain('свои данные: есть');
    expect(facts).toContain('открывался 03.11.26');
    // Объём не показываем: дневники и анализы лежат в IndexedDB, и размер только
    // по localStorage был бы занижен в разы — это было бы враньём о масштабе.
    expect(facts).not.toMatch(/КБ|МБ|записей/);
    // и никаких оценок «мало/пора заниматься» — только факты
    expect(facts).not.toMatch(/мало|пора|отстаёт|норма/i);
  });

  it('о пустом пространстве карточка не выдумывает данных: только «открывался»', () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    let reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry;
    reg = touchSpaceOpened(reg, sid, '2026-11-03T09:00:00.000Z');
    writeRegistryToStorage(reg);

    const { container } = render(<ProfileCoachTab />);
    const facts = container.querySelector('[data-coach="space-facts"]')?.textContent ?? '';
    expect(facts).toBe('открывался 03.11.26');
    expect(facts).not.toContain('свои данные');
  });

  it('граница режима сказана честно: черновики раздельные, а вкладка видна тому, кто держит телефон', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    const text = container.querySelector('[data-coach="boundary"]')?.textContent ?? '';
    // то, что режим НЕ обещает, должно быть написано, а не подразумеваться
    expect(text).toContain('черновики');
    expect(text).toContain('IndexedDB');
    expect(text).toContain('кто держит телефон');
    expect(text).toContain('аккаунтов');
  });

  it('«Войти в его данные» записывает пространство атлета и перезагружает приложение', () => {
    seed(1);
    const reload = vi.fn();
    const originalReload = window.location.reload;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="enter-space"]') as HTMLElement);

    const reg = JSON.parse(localStorage.getItem(DATA_SPACE_KEY) as string);
    expect(reg.active).toBe(athleteSpaceId('a1'));
    const space = reg.spaces.find((s: { athleteId: string }) => s.athleteId === 'a1');
    expect(space).toBeTruthy();
    // Имя из карточки уходит в пространство: профиль атлета не будет пустым.
    expect(space.seed.name).toBe('Атлет 1');
    expect(reload).toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: originalReload },
    });
  });

  it('выключение режима в данных атлета возвращает в свои данные, а не оставляет чужие', () => {
    seed(1);
    // Открыт профиль атлета: без возврата полоса «Данные атлета» исчезнет,
    // и его дневники будут выглядеть как данные тренера.
    const sid = athleteSpaceId('a1');
    const reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry;
    writeRegistryToStorage({ ...reg, active: sid });
    _resetDataSpaceCache();

    const reload = vi.fn();
    const originalReload = window.location.reload;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="toggle"]') as HTMLElement);

    const after = JSON.parse(localStorage.getItem(DATA_SPACE_KEY) as string);
    expect(after.active).toBe(HOME_SPACE_ID);
    expect(reload).toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: originalReload },
    });
    _resetDataSpaceCache();
  });

  it('переход к заметкам и задачам атлета передаёт id и цель', () => {
    seed(1);
    const onOpenAthlete = vi.fn();
    const { container } = render(<ProfileCoachTab onOpenAthlete={onOpenAthlete} />);
    fireEvent.click(container.querySelector('[data-coach="open-notes"]') as HTMLElement);
    expect(onOpenAthlete).toHaveBeenLastCalledWith('a1', 'notes');
    fireEvent.click(container.querySelector('[data-coach="open-planner"]') as HTMLElement);
    expect(onOpenAthlete).toHaveBeenLastCalledWith('a1', 'planner');
    fireEvent.click(container.querySelector('[data-coach="open-log"]') as HTMLElement);
    expect(onOpenAthlete).toHaveBeenLastCalledWith('a1', 'log');
  });

  it('без обработчика переходов кнопки не показываются (не мёртвые кнопки)', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="open-notes"]')).toBeNull();
    expect(container.querySelector('[data-coach="open-planner"]')).toBeNull();
    expect(container.querySelector('[data-coach="open-log"]')).toBeNull();
  });
});
