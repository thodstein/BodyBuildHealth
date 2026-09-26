/**
 * cardio-timer-persistence.test.tsx — идущая сессия не теряется при смене таба.
 *
 * P2-аудит: CardioSessionTimer держит активную сессию в локальном useState и
 * раньше монтировался только внутри `tab === 'session'`. Переключение на
 * «Аналитика»/«Журнал» размонтировало таймер — секундомер, пауза и введённые
 * RPE/HR/км исчезали молча. Теперь таймер всегда смонтирован, на других табах
 * скрыт через display:none.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioDiaryStep } from '../CardioDiaryStep';
import { buildCardioCycle } from '../../../../engines/lms/cardio.engine';
import { saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';

beforeEach(() => localStorage.clear());

const mount = () => {
  const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, id: 'timer-park' });
  return render(<CardioDiaryStep cycle={c} recoveryLow={false} onChanged={() => {}} />);
};

const tabBtn = (label: string) =>
  Array.from(document.querySelectorAll('button')).find(b => (b.textContent ?? '').includes(label));

describe('Таймер сессии переживает переключение табов', () => {
  it('таймер смонтирован всегда: контейнер есть и на чужом табе', () => {
    mount();
    const parked = document.querySelector('[data-cardio="timer-parked"]');
    expect(parked).toBeTruthy();
    expect((parked as HTMLElement).style.display).toBe('block');

    fireEvent.click(tabBtn('Аналитика')!);
    const parked2 = document.querySelector('[data-cardio="timer-parked"]');
    expect(parked2).toBeTruthy();                      // НЕ размонтирован
    expect((parked2 as HTMLElement).style.display).toBe('none');  // но скрыт
  });

  it('введённые данные сохраняются: узел таймера НЕ пересоздаётся при смене таба', () => {
    mount();
    // Помечаем узел таймера — если компонент размонтируется и смонтируется
    // заново, метка исчезнет (новый DOM-узел получит её уже после клика).
    const node = document.querySelector('[data-cardio="timer-parked"]') as HTMLElement;
    node.setAttribute('data-probe', 'original');

    fireEvent.click(tabBtn('Аналитика')!);
    fireEvent.click(tabBtn('Журнал')!);
    fireEvent.click(tabBtn('Сегодня')!);

    const after = document.querySelector('[data-cardio="timer-parked"]') as HTMLElement;
    expect(after.getAttribute('data-probe')).toBe('original');
    expect(after.style.display).toBe('block');
  });

  it('после двух переключений табов контейнер таймера остаётся один и тем же', () => {
    mount();
    const before = document.querySelectorAll('[data-cardio="timer-parked"]').length;
    fireEvent.click(tabBtn('Аналитика')!);
    fireEvent.click(tabBtn('Журнал')!);
    fireEvent.click(tabBtn('Сегодня')!);
    const after = document.querySelectorAll('[data-cardio="timer-parked"]').length;
    expect(after).toBe(before);
    expect(after).toBe(1);
  });
});
