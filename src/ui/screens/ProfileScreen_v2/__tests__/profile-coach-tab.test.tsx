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
import { render, fireEvent, cleanup } from '@testing-library/react';
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

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
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

  it('в подтверждении удаления сказано, что заметки и задачи не удаляются', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    const hint = container.querySelector('[data-coach="delete-hint"]')?.textContent ?? '';
    expect(hint).toContain('карточка');
    expect(hint).toContain('Заметки и задачи');
  });

  it('переход к заметкам и задачам атлета передаёт id и цель', () => {
    seed(1);
    const onOpenAthlete = vi.fn();
    const { container } = render(<ProfileCoachTab onOpenAthlete={onOpenAthlete} />);
    fireEvent.click(container.querySelector('[data-coach="open-notes"]') as HTMLElement);
    expect(onOpenAthlete).toHaveBeenLastCalledWith('a1', 'notes');
    fireEvent.click(container.querySelector('[data-coach="open-planner"]') as HTMLElement);
    expect(onOpenAthlete).toHaveBeenLastCalledWith('a1', 'planner');
  });

  it('без обработчика переходов кнопки не показываются (не мёртвые кнопки)', () => {
    seed(1);
    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="open-notes"]')).toBeNull();
    expect(container.querySelector('[data-coach="open-planner"]')).toBeNull();
  });
});
