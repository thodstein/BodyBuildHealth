/**
 * profile-coach-tab.test.tsx — UI режима тренера в профиле.
 *
 * Проверяем продуктовые обещания, которые видит человек:
 *  • выключатель в профиле, включение не оставляет пустой экран;
 *  • количество атлетов не ограничено — форма добавления всегда доступна;
 *  • разделы можно снять/выбрать все, быстрый переход ведёт в раздел приложения;
 *  • удаление — через подтверждение, а не «одним тапом навсегда».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { setSpacePurgeHandler } from '../../../../core/space-purge';

/**
 * База IndexedDB подменена: тесту нужно управлять числом записей в пространстве
 * атлета, а глобальная заглушка делит хранилища между «базами» и не изолирует
 * тесты друг от друга. Остальные функции `core/db` берём настоящие.
 */
const dbCounts = vi.hoisted(() => ({
  counts: {} as Record<string, number | null>,
  disks: null as string[] | null,
}));
vi.mock('../../../../core/db', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../core/db')>();
  return {
    ...actual,
    spaceDbRecordCount: vi.fn(async (sid: string) => dbCounts.counts[sid] ?? 0),
    // Список баз «на диске»: null — среда не даёт список (проверить нельзя).
    listSpaceDatabaseIds: vi.fn(async () => dbCounts.disks),
  };
});

import { ProfileCoachTab } from '../ProfileCoachTab';
import {
  COACH_SECTIONS,
  addCoachAthlete,
  emptyCoachState,
  readCoachState,
  setCoachAthleteStatus,
  setCoachEnabled,
  writeCoachState,
  type CoachAthlete,
} from '../../../../engines/coach/coach-mode.engine';
import {
  COACH_NOTES_KEY,
  readCoachNotes,
} from '../../../../engines/coach/coach-notes.engine';
import {
  ATHLETE_SPACE_PREFIX,
  DATA_SPACE_KEY,
  HOME_SPACE_ID,
  _resetDataSpaceCache,
  athleteSpaceId,
  emptyRegistry,
  readRegistryFromStorage,
  touchSpaceOpened,
  toPhysicalKey,
  upsertSpace,
  writeRegistryToStorage,
} from '../../../../core/data-space';
import { _resetSpaceTokensCache, ensureSpaceToken } from '../../../../core/space-tokens';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  dbCounts.counts = {};
  dbCounts.disks = null;
  _resetDataSpaceCache();
  _resetSpaceTokensCache();
});
afterEach(() => {
  cleanup();
  setSpacePurgeHandler(null);
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
  _resetSpaceTokensCache();
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

describe('телефон, подключённый к тренеру, при выключенном режиме', () => {
  const joinAsAthlete = () => {
    const joined = athleteSpaceId('coach-a');
    const reg = upsertSpace(emptyRegistry(), { id: joined, athleteId: null, label: 'Тренер' }).registry;
    writeRegistryToStorage({ ...reg, active: HOME_SPACE_ID });
    _resetDataSpaceCache();
    ensureSpaceToken(joined, {
      token: 'tk_' + '4'.repeat(48),
      role: 'athlete',
      migratedAt: '2026-11-06T10:00:00.000Z',
    });
    return joined;
  };

  it('из чужих данных есть выход даже без режима тренера', () => {
    joinAsAthlete();
    // Режим тренера НЕ включаем: атлет выключил его после подключения.
    const { container } = render(<ProfileCoachTab />);
    const card = container.querySelector('[data-coach="device-invite"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Данные тренера');
    // Кодов атлет не выдаёт — их выдаёт тренер.
    expect(container.querySelector('[data-coach="device-invite-create"]')).toBeNull();
    expect(container.querySelector('[data-coach="device-invite-rotate"]')).toBeNull();
    // А подключиться к другому и отключиться — может.
    expect(container.querySelector('[data-coach="device-join"]')).not.toBeNull();
    expect(container.querySelector('[data-coach="device-leave"]')).not.toBeNull();
  });

  it('без подключения карточки нет: чужой доступ не навязывается', () => {
    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="device-invite"]')).toBeNull();
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

  it('количество атлетов не ограничено: 21-я карточка и форма на месте', () => {
    seed(21);
    const { container } = render(<ProfileCoachTab />);
    expect(athleteCards(container)).toHaveLength(21);
    expect(container.querySelector('[data-coach="limit"]')).toBeNull();
    expect(container.querySelector('[data-coach="form"]')).not.toBeNull();
    expect(container.querySelector('[data-coach="save"]')).not.toBeNull();
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

  it('правка имени сохраняется в карточке и в пространстве данных (полоса не врёт)', () => {
    seed(1);
    // Пространство атлета уже существует: тренер входил в его данные.
    const sid = athleteSpaceId('a1');
    const reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry;
    writeRegistryToStorage(reg);
    _resetDataSpaceCache();

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="edit"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLInputElement, { target: { value: 'Иван П.' } });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);
    expect((readCoachState(localStorage).athletes[0] as CoachAthlete).name).toBe('Иван П.');
    expect(container.textContent).toContain('Иван П.');
    // иначе полоса «Данные атлета» и «Сменить» показывали бы старое имя
    const space = readRegistryFromStorage().spaces.find(s => s.id === sid);
    expect(space?.label).toBe('Иван П.');
    _resetDataSpaceCache();
  });

  it('переименование АКТИВНОГО атлета сразу меняет строку «Открыты данные»', () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    const reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry;
    writeRegistryToStorage({ ...reg, active: sid });
    _resetDataSpaceCache();

    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="active"]')?.textContent).toContain('Атлет 1');
    fireEvent.click(container.querySelector('[data-coach="edit"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLInputElement, { target: { value: 'Иван П.' } });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);
    const text = container.querySelector('[data-coach="active"]')?.textContent ?? '';
    expect(text).toContain('Иван П.');
    expect(text).not.toContain('Атлет 1');
    _resetDataSpaceCache();
  });

  it('переименование не создаёт пространство атлета, который ни разу не входил', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="edit"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLInputElement, { target: { value: 'Пётр' } });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);
    // запись пространства = «его данные существуют»: выдумывать её нельзя
    expect(readRegistryFromStorage().spaces.filter(s => s.id !== HOME_SPACE_ID)).toHaveLength(0);
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
    // синхронизация зарегистрирована — удаление должно унести и облачную копию
    const purged: string[][] = [];
    setSpacePurgeHandler(ids => { purged.push([...ids]); });

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="delete-with-data"]') as HTMLElement);

    expect(readCoachState(localStorage).athletes).toHaveLength(0);
    expect(localStorage.getItem(`${ATHLETE_SPACE_PREFIX}${sid}__he_profile_v2`)).toBeNull();
    expect(localStorage.getItem('he_profile_v2')).toBe('{"name":"Тренер"}');
    expect(purged.flat()).toContain(sid);
  });

  it('обычное удаление убирает из реестра ПУСТОЕ пространство атлета', async () => {
    seed(1);
    // Атлет заходил в приложение, но ничего не записал
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    // запись уходит только после того, как доказано, что пусто и в базе тоже
    await waitFor(() => expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(false));
  });

  it('атлет с записями ТОЛЬКО в базе сохраняет запись пространства и попадает в «Данные без карточки»', async () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    // в localStorage пусто, а в его базе — три записи (дневник/анализы)
    dbCounts.counts[sid] = 3;

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    // объём в базе — единственное доказательство, что данные есть
    await waitFor(() =>
      expect(container.querySelector('[data-coach="delete-hint"]')?.textContent).toContain('3 записи'),
    );
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    await waitFor(() => expect(readCoachState(localStorage).athletes).toHaveLength(0));

    // карточки нет, но запись реестра обязана остаться: иначе база осиротеет
    expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(true);
    // и данные видны как висящие, а не «потерялись»
    await waitFor(() => expect(container.querySelector('[data-coach="orphan"]')).not.toBeNull());
    delete dbCounts.counts[sid];
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
    // и то, что уже есть: у атлета свой телефон по коду, но только своё пространство
    expect(text).toContain('Телефон атлета');
    expect(text).toContain('только своё пространство');
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

  it('строка статуса говорит, чьи данные ОТКРЫТЫ, а не кто выбран в списке', () => {
    const at = '2026-01-01T00:00:00.000Z';
    // дома: «Открыты ваши данные», и выбранный атлет подписан отдельно
    seed(2);
    const home = render(<ProfileCoachTab />);
    const homeText = home.container.querySelector('[data-coach="active"]')?.textContent ?? '';
    expect(homeText).toContain('Открыты ваши данные');
    expect(homeText).toContain('выбран');
    cleanup();

    // в пространстве атлета: «Открыты данные: <имя>», без «выбран»
    const sid = athleteSpaceId('a1');
    const reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry;
    writeRegistryToStorage({ ...reg, active: sid });
    _resetDataSpaceCache();
    const inSpace = render(<ProfileCoachTab />);
    const spaceText = inSpace.container.querySelector('[data-coach="active"]')?.textContent ?? '';
    expect(spaceText).toContain('Открыты данные:');
    expect(spaceText).toContain('Атлет 1');
    expect(spaceText).not.toContain('выбран');
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

describe('забыть всех атлетов', () => {
  it('первый клик только спрашивает: данные на месте', () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    localStorage.setItem(toPhysicalKey(sid, 'he_profile_v2'), '{"name":"Иван"}');

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="forget-all"]') as HTMLElement);

    expect(container.querySelector('[data-coach="forget-all"]')?.textContent).toContain('Точно забыть');
    expect(readCoachState(localStorage).athletes).toHaveLength(1);
    expect(localStorage.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBe('{"name":"Иван"}');
  });

  it('подтверждение удаляет данные и карточки атлетов, свои данные и записи тренера — тоже его', async () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    localStorage.setItem('he_profile_v2', '{"name":"Тренер"}');
    localStorage.setItem(toPhysicalKey(sid, 'he_profile_v2'), '{"name":"Иван"}');
    localStorage.setItem(
      COACH_NOTES_KEY,
      JSON.stringify({ version: 1, items: [{ id: 'n1', title: 'Колено', athleteId: 'a1' }] }),
    );
    expect(readCoachNotes(localStorage).items).toHaveLength(1);

    // синхронизация: облачные копии всех атлетов тоже должны уйти
    const purged: string[][] = [];
    setSpacePurgeHandler(ids => { purged.push([...ids]); });

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="forget-all"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="forget-all"]') as HTMLElement);

    await waitFor(() => expect(readCoachState(localStorage).athletes).toHaveLength(0));
    // данные атлета и запись его пространства ушли
    expect(localStorage.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBeNull();
    expect(readRegistryFromStorage().spaces.filter(s => s.id !== HOME_SPACE_ID)).toHaveLength(0);
    expect(purged.flat()).toContain(sid);
    // заметки и журнал относились к людям, которых больше нет
    expect(readCoachNotes(localStorage).items).toHaveLength(0);
    // собственные данные тренера остались: это не полный сброс приложения
    expect(localStorage.getItem('he_profile_v2')).toBe('{"name":"Тренер"}');
    // режим не выключился сам — тренер может продолжить работу
    expect(readCoachState(localStorage).enabled).toBe(true);
    // и человек видит, что операция состоялась, а не пустое место вместо блока
    expect(container.querySelector('[data-coach="forget-all-done"]')).not.toBeNull();
  });

  it('«Оставить» после вопроса ничего не удаляет', () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="forget-all"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="forget-all-cancel"]') as HTMLElement);
    expect(readCoachState(localStorage).athletes).toHaveLength(1);
    expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(true);
  });
});

describe('данные без карточки', () => {
  /** Пространство атлета, карточки которого в списке тренера уже нет. */
  const makeOrphan = (athleteId: string, label: string, opts: { active?: boolean } = {}) => {
    const sid = athleteSpaceId(athleteId);
    const reg = upsertSpace(emptyRegistry(), { id: sid, athleteId, label }).registry;
    writeRegistryToStorage({ ...reg, active: opts.active ? sid : HOME_SPACE_ID });
    _resetDataSpaceCache();
    return sid;
  };

  it('висящие данные видны отдельным блоком, а не теряются после удаления карточки', () => {
    seed(1);
    makeOrphan('a9', 'Без карточки');
    localStorage.setItem(toPhysicalKey(athleteSpaceId('a9'), 'he_profile_v2'), '{"name":"Пётр"}');

    const { container } = render(<ProfileCoachTab />);
    const box = container.querySelector('[data-coach="orphans"]');
    expect(box).not.toBeNull();
    const rows = container.querySelectorAll('[data-coach="orphan"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Без карточки');
    // факты — только проверяемое: ключи есть, а не «сколько всего»
    expect(rows[0].querySelector('[data-coach="orphan-facts"]')?.textContent).toContain('свои данные: есть');
    // и прямо сказано, почему это важно: новая карточка = новое пространство
    expect(container.querySelector('[data-coach="orphans-hint"]')?.textContent).toContain('новое');
  });

  it('подключённое к тренеру пространство — не «данные без карточки» и не в «забыть всех»', () => {
    seed(1);
    // Своё пространство с карточкой + чужое, к которому телефон подключился по коду:
    // у подключённого карточки нет никогда, но стирать его «забыть всех» нельзя.
    const own = athleteSpaceId('a1');
    const joined = athleteSpaceId('a2');
    let reg = upsertSpace(emptyRegistry(), { id: own, athleteId: 'a1', label: 'Атлет 1' }).registry;
    reg = upsertSpace(reg, { id: joined, athleteId: null, label: 'Данные тренера' }).registry;
    writeRegistryToStorage({ ...reg, active: HOME_SPACE_ID });
    _resetDataSpaceCache();
    ensureSpaceToken(joined, {
      token: 'tk_' + '5'.repeat(48),
      role: 'athlete',
      migratedAt: '2026-11-06T10:00:00.000Z',
    });

    const { container } = render(<ProfileCoachTab />);
    // Не сирота: «Удалить данные» здесь стёрло бы чужую облачную копию.
    expect(container.querySelector('[data-coach="orphans"]')).toBeNull();
    // И в счётчике «забыть всех» только своё пространство.
    expect(container.querySelector('[data-coach="forget-all-hint"]')?.textContent).toContain('(1');
  });

  it('пространство с живой карточкой в этот блок не попадает', () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    const reg = upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry;
    writeRegistryToStorage(reg);
    _resetDataSpaceCache();

    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="orphans"]')).toBeNull();
  });

  it('«Открыть данные» переключает приложение в это пространство', () => {
    seed(1);
    const sid = makeOrphan('a9', 'Без карточки');
    const reload = vi.fn();
    const originalReload = window.location.reload;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="orphan-open"]') as HTMLElement);
    expect(readRegistryFromStorage().active).toBe(sid);
    expect(reload).toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: originalReload },
    });
  });

  it('«Удалить данные» — два шага, и удаляет не только карточку реестра', () => {
    seed(1);
    const sid = makeOrphan('a9', 'Без карточки');
    localStorage.setItem(toPhysicalKey(sid, 'he_profile_v2'), '{"name":"Пётр"}');

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="orphan-delete"]') as HTMLElement);
    // первый клик только спрашивает: данные атлета стереть случайно нельзя
    expect(container.querySelector('[data-coach="orphan-delete-confirm"]')).not.toBeNull();
    expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(true);
    expect(localStorage.getItem(toPhysicalKey(sid, 'he_profile_v2'))).not.toBeNull();

    fireEvent.click(container.querySelector('[data-coach="orphan-delete-confirm"]') as HTMLElement);
    expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(false);
    expect(localStorage.getItem(toPhysicalKey(sid, 'he_profile_v2'))).toBeNull();
    expect(container.querySelector('[data-coach="orphans"]')).toBeNull();
  });

  it('«Оставить» возвращает блок в исходное состояние и ничего не удаляет', () => {
    seed(1);
    const sid = makeOrphan('a9', 'Без карточки');
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="orphan-delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="orphan-delete-cancel"]') as HTMLElement);
    expect(container.querySelector('[data-coach="orphan-delete-confirm"]')).toBeNull();
    expect(readRegistryFromStorage().spaces.some(s => s.id === sid)).toBe(true);
  });
});

describe('базы на диске', () => {
  it('до нажатия ничего не спрашиваем — проверка только по просьбе', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="disk-scan"]')).not.toBeNull();
    expect(container.querySelector('[data-coach="disk-scan-run"]')).not.toBeNull();
    // результата нет: список баз не запрашивали
    expect(container.querySelector('[data-coach="disk-scan-clean"]')).toBeNull();
    expect(container.querySelector('[data-coach="disk-orphan"]')).toBeNull();
  });

  it('база без записи в реестре видна и удаляется в два шага', async () => {
    seed(1);
    const zombie = athleteSpaceId('zombie');
    dbCounts.disks = [HOME_SPACE_ID, zombie];

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="disk-scan-run"]') as HTMLElement);

    await waitFor(() => expect(container.querySelector('[data-coach="disk-orphan"]')).not.toBeNull());
    const row = container.querySelector('[data-coach="disk-orphan"]') as HTMLElement;
    expect(row.getAttribute('data-space-id')).toBe(zombie);

    fireEvent.click(container.querySelector('[data-coach="disk-orphan-delete"]') as HTMLElement);
    expect(container.querySelector('[data-coach="disk-orphan-confirm"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-coach="disk-orphan-confirm"]') as HTMLElement);
    expect(container.querySelector('[data-coach="disk-orphan"]')).toBeNull();
    expect(container.querySelector('[data-coach="disk-scan-clean"]')).not.toBeNull();
  });

  it('пространства из реестра и домашняя база не считаются лишними', async () => {
    seed(1);
    const sid = athleteSpaceId('a1');
    writeRegistryToStorage(upsertSpace(emptyRegistry(), { id: sid, athleteId: 'a1', label: 'Атлет 1' }).registry);
    dbCounts.disks = [HOME_SPACE_ID, sid];

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="disk-scan-run"]') as HTMLElement);

    await waitFor(() => expect(container.querySelector('[data-coach="disk-scan-clean"]')).not.toBeNull());
    expect(container.querySelector('[data-coach="disk-orphan"]')).toBeNull();
  });

  it('если среда не даёт список баз — это сказано прямо, а не «всё чисто»', async () => {
    seed(1);
    dbCounts.disks = null;

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="disk-scan-run"]') as HTMLElement);

    await waitFor(() => expect(container.querySelector('[data-coach="disk-scan-unavailable"]')).not.toBeNull());
    expect(container.querySelector('[data-coach="disk-scan-clean"]')).toBeNull();
  });
});
describe('карточка v2: статусы, группа, метки, контакт', () => {
  it('архив скрыт по умолчанию, но открывается переключателем и возвращается', () => {
    let s = seed(2);
    s = setCoachAthleteStatus(s, 'a2', 'archived');
    writeCoachState(localStorage, s);

    const { container } = render(<ProfileCoachTab />);
    // По умолчанию в списке только «в работе».
    expect(athleteCards(container)).toHaveLength(1);
    expect(container.querySelector('[data-coach="status-live"]')?.textContent).toContain('В работе (1)');
    expect(container.querySelector('[data-coach="status-archived"]')?.textContent).toContain('Архив (1)');

    fireEvent.click(container.querySelector('[data-coach="status-archived"]') as HTMLElement);
    expect(athleteCards(container)).toHaveLength(1);
    expect(container.querySelector('[data-coach="athlete-status"]')?.textContent).toBe('архив');

    // «Вернуть из архива» — данные и программа остаются, меняется только статус.
    fireEvent.click(container.querySelector('[data-coach="unarchive"]') as HTMLElement);
    expect(readCoachState(localStorage).athletes.find(a => a.id === 'a2')?.status).toBe('active');
    expect(container.querySelector('[data-coach="status-archived"]')?.textContent).toContain('Архив (0)');
  });

  it('«В паузу» сохраняет статус, а «Снять с паузы» возвращает в работу', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);

    fireEvent.click(container.querySelector('[data-coach="pause"]') as HTMLElement);
    expect(readCoachState(localStorage).athletes[0].status).toBe('paused');
    // Пауза не прячет карточку: тренер должен видеть, с кем перерыв.
    expect(athleteCards(container)).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-coach="resume"]') as HTMLElement);
    expect(readCoachState(localStorage).athletes[0].status).toBe('active');
  });

  it('группа, метки, контакт и дата старта вводятся и видны на карточке', () => {
    seed(0);
    const { container } = render(<ProfileCoachTab />);

    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLElement, { target: { value: 'Иван' } });
    fireEvent.change(container.querySelector('[data-coach="group"]') as HTMLElement, { target: { value: 'Вечерняя' } });
    fireEvent.change(container.querySelector('[data-coach="tags"]') as HTMLElement, { target: { value: 'сила, спина' } });
    fireEvent.change(container.querySelector('[data-coach="contact"]') as HTMLElement, { target: { value: '@ivan' } });
    fireEvent.change(container.querySelector('[data-coach="started-at"]') as HTMLElement, { target: { value: '2026-09-01' } });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);

    const a = readCoachState(localStorage).athletes[0];
    expect(a.group).toBe('Вечерняя');
    expect(a.tags).toEqual(['сила', 'спина']);
    expect(a.contact).toBe('@ivan');
    expect(a.startedAt).toBe('2026-09-01');

    const card = container.querySelector('[data-coach="athlete"]') as HTMLElement;
    expect(card.textContent).toContain('Вечерняя');
    expect(card.textContent).toContain('#сила');
    expect(card.textContent).toContain('#спина');
    expect(card.querySelector('[data-coach="athlete-contacts"]')?.textContent).toContain('@ivan');
  });

  it('клик по «Архив» при пустом рабочем списке объясняет, где искать людей', () => {
    let s = seed(1);
    s = setCoachAthleteStatus(s, 'a1', 'archived');
    writeCoachState(localStorage, s);

    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="athletes-empty"]')?.textContent).toContain('1 в архиве');
  });
});
describe('недельный вид в вкладке', () => {
  it('«Неделя» показывается в режиме тренера и считает задачи', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    const week = container.querySelector('[data-coach="week"]');
    expect(week).not.toBeNull();
    expect(week?.querySelectorAll('[data-coach="week-day"]')).toHaveLength(7);
    expect(week?.textContent).toContain('задач: 0');
    // Напоминания по умолчанию выключены — никакого «мы уже включили».
    expect(week?.querySelector('[data-coach="reminders-toggle"]')?.textContent).toContain('Напоминать о задачах');
  });
});
