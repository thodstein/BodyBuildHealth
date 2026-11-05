/**
 * profile-coach-programs.test.tsx — «Мои программы» тренера: снять и выдать.
 *
 * Проверяем то, ради чего фича существует:
 *  • снять программу с атлета одной кнопкой и увидеть её в библиотеке;
 *  • выдача требует ВТОРОГО подтверждения (она заменяет программу);
 *  • выдача меняет только программу, а дневник/вес/анализы остаются;
 *  • пространство получателя регистрируется, иначе копия выпала бы из бэкапа;
 *  • пустую программу выдать нельзя — честная причина, ничего не записано.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfileCoachTab } from '../ProfileCoachTab';
import {
  addCoachAthlete,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';
import { addCoachProgram, readCoachPrograms, writeCoachPrograms, emptyCoachPrograms } from '../../../../engines/coach/coach-program-library.engine';
import {
  _resetDataSpaceCache,
  athleteSpaceId,
  readRegistryFromStorage,
  toPhysicalKey,
} from '../../../../core/data-space';

const PL = 'he_pl_macro';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});

function seedAthletes(names: string[]) {
  let s = setCoachEnabled(emptyCoachState(), true);
  names.forEach((name, i) => {
    s = addCoachAthlete(s, { name }, { id: `a${i + 1}`, now: '2026-11-05T10:00:00.000Z' }).state;
  });
  writeCoachState(localStorage, s);
  return s;
}

function putProgram(athleteId: string, value: unknown = { v: 7, b: ['присед'], t: 12 }) {
  localStorage.setItem(toPhysicalKey(athleteSpaceId(athleteId), PL), JSON.stringify(value));
}

const programRows = (c: HTMLElement) => c.querySelectorAll('[data-coach="program"]');

describe('снять программу с атлета', () => {
  it('без плана — честная причина, библиотека пуста', () => {
    seedAthletes(['Иван']);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="save-program"]') as HTMLElement);
    expect(container.querySelector('[data-coach="program-error"]')?.textContent).toMatch(/нет сохранённой программы/);
    expect(programRows(container)).toHaveLength(0);
    expect(localStorage.getItem('he_coach_programs')).toBeNull();
  });

  it('снимает программу в библиотеку; название, источник и повторная загрузка', () => {
    seedAthletes(['Иван']);
    putProgram('a1');
    const { container, unmount } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="save-program"]') as HTMLElement);

    expect(container.querySelector('[data-coach="program-notice"]')?.textContent).toContain('Моих программах');
    const rows = programRows(container);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Иван');
    expect(rows[0].textContent).toContain('снята с «Иван»');
    expect(rows[0].textContent).toContain('ещё не выдавалась');

    const store = readCoachPrograms(localStorage);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].bundle.keys[PL]).toContain('присед');

    // Библиотека переживает перерисовку (это хранилище, а не состояние вкладки).
    unmount();
    const again = render(<ProfileCoachTab />);
    expect(programRows(again.container)).toHaveLength(1);
  });

  it('повторное снятие даёт свободное имя, а не перезапись', () => {
    seedAthletes(['Иван']);
    putProgram('a1');
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="save-program"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="save-program"]') as HTMLElement);
    expect(programRows(container)).toHaveLength(2);
    expect(readCoachPrograms(localStorage).items).toHaveLength(2);
  });
});

describe('выдача программы', () => {
  const withTemplate = () => {
    const store = addCoachProgram(
      emptyCoachPrograms(),
      { name: 'База 12 недель', bundle: { app: 'bodybuildhealth', kind: 'coach-program', version: 1, createdAt: '', keys: { [PL]: JSON.stringify({ v: 7, b: ['жим'], t: 12 }) } }, sourceLabel: 'Иван' },
      { id: 'p1', now: '2026-11-05T10:00:00.000Z' },
    );
    expect(store.error).toBeNull();
    writeCoachPrograms(localStorage, store.store);
  };

  it('без второго подтверждения ничего не пишет', () => {
    seedAthletes(['Иван', 'Пётр']);
    withTemplate();
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="program-issue"]') as HTMLElement);
    // пустой выбор — кнопка не открывает подтверждение
    fireEvent.click(container.querySelector('[data-coach="issue-ask"]') as HTMLElement);
    expect(container.querySelector('[data-coach="issue-warning"]')).toBeNull();
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a2'), PL))).toBeNull();
  });

  it('выдаёт выбранному, регистрирует пространство и считает выдачу', () => {
    seedAthletes(['Иван', 'Пётр']);
    withTemplate();
    // У Петра есть старая программа и дневник — проверяем замену и неприкосновенность.
    putProgram('a2', { v: 7, b: ['старое'], t: 3 });
    localStorage.setItem(toPhysicalKey(athleteSpaceId('a2'), 'he_diary_v2'), '{"keep":true}');

    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="program-issue"]') as HTMLElement);
    const boxes = container.querySelectorAll('[data-coach="issue-athlete"]');
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[1] as HTMLElement); // Пётр
    fireEvent.click(container.querySelector('[data-coach="issue-ask"]') as HTMLElement);
    expect(container.querySelector('[data-coach="issue-warning"]')?.textContent).toMatch(/Отменить это будет нельзя/);
    fireEvent.click(container.querySelector('[data-coach="issue-confirm"]') as HTMLElement);

    expect(container.querySelector('[data-coach="issue-done"]')?.textContent).toContain('Пётр');
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a2'), PL))).toContain('жим');
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a2'), 'he_diary_v2'))).toBe('{"keep":true}');
    // Иван остался со своей программой
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a1'), PL))).toBeNull();

    expect(readRegistryFromStorage().spaces.some(s => s.id === athleteSpaceId('a2'))).toBe(true);
    expect(readCoachPrograms(localStorage).items[0].issuedCount).toBe(1);
    expect(container.querySelectorAll('[data-coach="program"]')[0].textContent).toContain('выдана 1 раз');
  });

  it('несколько получателей — одна выдача, итог перечисляет людей', () => {
    seedAthletes(['Иван', 'Пётр', 'Анна']);
    withTemplate();
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="program-issue"]') as HTMLElement);
    const boxes = container.querySelectorAll('[data-coach="issue-athlete"]');
    fireEvent.click(boxes[0] as HTMLElement);
    fireEvent.click(boxes[2] as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="issue-ask"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="issue-confirm"]') as HTMLElement);

    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a1'), PL))).toContain('жим');
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a3'), PL))).toContain('жим');
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a2'), PL))).toBeNull();
    expect(container.querySelector('[data-coach="issue-done"]')?.textContent).toContain('Анна');
  });

  it('программу можно выдать прямо с карточки атлета («Выдать другому»)', () => {
    seedAthletes(['Иван', 'Пётр']);
    putProgram('a1');
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="copy-program"]') as HTMLElement);
    const boxes = container.querySelectorAll('[data-coach="issue-athlete"]');
    fireEvent.click(boxes[1] as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="issue-ask"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="issue-confirm"]') as HTMLElement);
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a2'), PL))).toContain('присед');
  });
});

describe('библиотека: переименование и удаление', () => {
  it('переименование сохраняется, пустое имя — ошибка', () => {
    seedAthletes(['Иван']);
    putProgram('a1');
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="save-program"]') as HTMLElement);

    fireEvent.click(container.querySelector('[data-coach="program-rename"]') as HTMLElement);
    const input = container.querySelector('[data-coach="program-rename-input"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(container.querySelector('[data-coach="program-rename-save"]') as HTMLElement);
    expect(container.querySelector('[data-coach="program-error"]')?.textContent).toMatch(/Название программы/);

    fireEvent.change(container.querySelector('[data-coach="program-rename-input"]') as HTMLInputElement, {
      target: { value: 'Осень' },
    });
    fireEvent.click(container.querySelector('[data-coach="program-rename-save"]') as HTMLElement);
    expect(readCoachPrograms(localStorage).items[0].name).toBe('Осень');
    expect(programRows(container)[0].textContent).toContain('Осень');
  });

  it('удаление — через подтверждение; у атлета программа остаётся', () => {
    seedAthletes(['Иван']);
    putProgram('a1');
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="save-program"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="program-delete"]') as HTMLElement);
    expect(programRows(container)).toHaveLength(1);

    fireEvent.click(container.querySelector('[data-coach="program-delete-confirm"]') as HTMLElement);
    expect(programRows(container)).toHaveLength(0);
    expect(readCoachPrograms(localStorage).items).toHaveLength(0);
    expect(container.querySelector('[data-coach="program-notice"]')?.textContent).toMatch(/осталась/);
    expect(localStorage.getItem(toPhysicalKey(athleteSpaceId('a1'), PL))).toContain('присед');
  });
});
