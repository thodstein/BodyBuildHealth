/**
 * metabolic-hub-wiring.test.tsx — «ввод действительно доходит до расчёта».
 *
 * Зачем: главный дефект старого хаба был не в формулах, а в проводке — поля рисовались
 * (профессия, климат, пот, MET-ч), но их сеттеры не вызывались вообще, и значение уезжало
 * в никуда. Ни один тест чисел такое не ловит. Здесь мы дёргаем UI как пользователь и
 * требуем, чтобы итог МЕНЯЛСЯ в предсказуемую сторону.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MetabolicHub } from '../MetabolicHub';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); });

/** Кнопка-плитка сводки по префиксу aria-label. */
function tile(prefix: string): HTMLElement {
  const el = Array.from(document.querySelectorAll('button'))
    .find(b => (b.getAttribute('aria-label') || '').startsWith(prefix));
  if (!el) throw new Error(`нет плитки «${prefix}»`);
  return el as HTMLElement;
}
/** Крупное число плитки (второй div: label / value / sub). */
function tileValue(prefix: string): number {
  const el = tile(prefix);
  const raw = (el.children[1] as HTMLElement | undefined)?.textContent || '';
  const m = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) throw new Error(`в плитке «${prefix}» нет числа: "${raw}"`);
  return Number(m[0].replace(',', '.'));
}

/** Ввести число в поле хаба (MhNum или PopupNumber) так, как это делает пользователь. */
function setNumber(label: string, value: number) {
  const btn = Array.from(document.querySelectorAll('button')).find(b => {
    if (b.closest('[role="dialog"]') || b.closest('.mh-popupoverlay') || b.closest('.pl-popupoverlay')) return false;
    return (b.textContent || '').trim().startsWith(label);
  });
  if (!btn) throw new Error(`нет поля «${label}»`);
  fireEvent.click(btn);

  const area = document.querySelector('.mh-popupoverlay, .pl-popupoverlay');
  if (!area) throw new Error(`попап «${label}» не открылся`);
  const input = area.querySelector('input[type="number"]') as HTMLInputElement;
  expect(input, `в попапе «${label}» нет input`).toBeTruthy();
  fireEvent.change(input, { target: { value: String(value) } });

  const ok = Array.from(area.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'OK');
  expect(ok, `в попапе «${label}» нет OK`).toBeTruthy();
  fireEvent.click(ok as HTMLElement);
}

/** Выбрать значение в PopupSelect (клик по карточке → клик по варианту). */
function setSelect(label: string, option: string) {
  const trigger = Array.from(document.querySelectorAll('button.pl-popupselect'))
    .find(b => (b.textContent || '').trim().startsWith(label));
  if (!trigger) throw new Error(`нет селекта «${label}»`);
  fireEvent.click(trigger);
  const area = document.querySelector('.pl-popupoverlay');
  if (!area) throw new Error(`попап «${label}» не открылся`);
  const opt = Array.from(area.querySelectorAll('button'))
    .find(b => (b.textContent || '').trim().startsWith(option));
  if (!opt) throw new Error(`в селекте «${label}» нет варианта «${option}»`);
  fireEvent.click(opt);
}

/** Значение поля по aria-label («HCT, %: 52 %» → «52 %»). */
function fieldValue(label: string): string {
  const el = Array.from(document.querySelectorAll('button'))
    .find(b => (b.getAttribute('aria-label') || '').startsWith(`${label}:`));
  if (!el) throw new Error(`нет поля «${label}»`);
  return (el.getAttribute('aria-label') || '').slice(label.length + 2);
}

describe('MetabolicHub: ввод меняет расчёт (проводка полей)', () => {
  it('вес 83 → 110 поднимает TDEE и воду', () => {
    render(<MetabolicHub />);
    const tdee0 = tileValue('TDEE');
    const water0 = tileValue('Вода');
    setNumber('Вес, кг', 110);
    expect(tileValue('TDEE')).toBeGreaterThan(tdee0);
    expect(tileValue('Вода')).toBeGreaterThan(water0);
  });

  it('тренировки/нед 4 → 0 снижают воду (недельный пот уходит из суточной нормы)', () => {
    render(<MetabolicHub />);
    const water0 = tileValue('Вода');
    setNumber('Тренировок/нед', 0);
    expect(tileValue('Вода')).toBeLessThan(water0);
  });

  it('HCT из ОАК попадает в кровь и в воду под HCT', () => {
    render(<MetabolicHub />);
    expect(tile('Кровь').textContent).toContain('введи HCT');
    setNumber('HCT, %', 56);
    const blood = tile('Кровь').textContent || '';
    expect(blood).toContain('56%');
    expect(blood).not.toContain('введи HCT');
    expect(blood).toMatch(/мл/);
  });

  it('цель: сушка < поддержание < масса по ккал КБЖУ', () => {
    render(<MetabolicHub />);
    const pick = (name: string) => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim() === name && b.className.includes('mh-goal'));
      if (!btn) throw new Error(`нет кнопки цели «${name}»`);
      fireEvent.click(btn);
      return tileValue('КБЖУ');
    };
    const cut = pick('Сушка');
    const maintain = pick('Поддержание');
    const bulk = pick('Масса');
    expect(cut).toBeLessThan(maintain);
    expect(maintain).toBeLessThan(bulk);
  });

  it('ААС-переключатель меняет воду и белок, но не вес', () => {
    render(<MetabolicHub />);
    const water0 = tileValue('Вода');
    const kbju0 = tileValue('КБЖУ');
    const weight0 = tileValue('Жир'); // % жира не должен зависеть от ААС

    fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('С ААС')) as HTMLElement);

    expect(tileValue('Вода')).toBeGreaterThan(water0);
    expect(tileValue('КБЖУ')).toBeGreaterThan(kbju0);
    expect(tileValue('Жир')).toBe(weight0);
  });

  it('«бытовая активность» реально работает, когда профессия не указана', () => {
    render(<MetabolicHub />);
    // было: профессия по умолчанию 'sedentary' всегда перекрывала бытовую — поле-пустышка
    setSelect('Профессия (FAO PAL)', 'Не указана');
    const tdee0 = tileValue('TDEE');
    setSelect('Бытовая', 'Высокая');
    const tdeeHigh = tileValue('TDEE');
    setSelect('Бытовая', 'Низкая');
    const tdeeLow = tileValue('TDEE');
    expect(tdeeHigh).toBeGreaterThan(tdee0);
    expect(tdeeLow).toBeLessThan(tdee0);
  });

  it('профессия перекрывает бытовую — и это сказано текстом, а не молча', () => {
    render(<MetabolicHub />);
    expect(document.body.textContent).toMatch(/профессия перекрывает «бытовую»/);
    const tdee0 = tileValue('TDEE');
    setSelect('Профессия (FAO PAL)', 'Физическая');
    const tdeePhysical = tileValue('TDEE');
    setSelect('Бытовая', 'Низкая');
    setSelect('Бытовая', 'Высокая');
    // пока профессия задана, «бытовая» на расчёт не влияет (один день нельзя посчитать дважды)
    expect(tileValue('TDEE')).toBe(tdeePhysical);
    expect(tdeePhysical).toBeGreaterThan(tdee0);
  });

  it('«Целевых недель» реально проверяет срок (раньше поле не считалось)', () => {
    render(<MetabolicHub />);
    setNumber('Цель вес, кг', 60);
    setNumber('Целевых недель', 3);
    // без цели «сушка» план = поддержание, и срок справедливо назван встречным
    expect(document.body.textContent || '').toMatch(/Переключи цель/);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').trim() === 'Сушка' && b.className.includes('mh-goal')) as HTMLElement);
    expect(document.body.textContent || '').toMatch(/в срок не успеть/);
    setNumber('Целевых недель', 80);
    const loose = document.body.textContent || '';
    expect(loose).toMatch(/план быстрее срока/);
    expect(loose).not.toMatch(/в срок не успеть/);
  });

  it('сценарий хранит лабы и восстанавливает их (было 22 поля из ~90)', () => {
    render(<MetabolicHub />);
    setNumber('HCT, %', 52);
    setNumber('Ферритин, нг/мл', 15);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('Сохранить сценарий')) as HTMLElement);
    setNumber('HCT, %', 44);
    setNumber('Ферритин, нг/мл', 120);
    expect(fieldValue('HCT, %')).toBe('44 %');
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('↺ Сценарий')) as HTMLElement);
    // сценарий раньше нёс только вес/рост/цель — лабы после загрузки пропадали
    expect(fieldValue('HCT, %')).toBe('52 %');
    expect(fieldValue('Ферритин, нг/мл')).toBe('15 нг/мл');
  });

  it('измеренный пот-тест попадает в воду, а не живёт только в карточке', () => {
    render(<MetabolicHub />);
    // по умолчанию режим «Взвешивание»: 83 → 82.2 кг + 0.5 л за 1 ч = 1.30 л/ч
    const waterMeasured = tileValue('Вода');
    expect(document.body.textContent || '').toMatch(/измерено пот-тестом/);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('Оценка')) as HTMLElement);
    const waterEstimated = tileValue('Вода');
    expect(document.body.textContent || '').toMatch(/— ручное значение/);
    expect(waterMeasured).not.toBe(waterEstimated);
  });
});
