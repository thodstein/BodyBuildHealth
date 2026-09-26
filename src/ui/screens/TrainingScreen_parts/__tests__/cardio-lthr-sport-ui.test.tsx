/**
 * cardio-lthr-sport-ui.test.tsx — спринт 5.5: поле «LTHR по видам спорта».
 *
 * Граница прошлого раунда была ровно тут: эталон по видам умел храниться и
 * читаться (cycle.config.lthrBySport → CardioAnalyticsDashboard), но ввести его
 * было нечем. Тест проверяет поведение поля, а не наличие разметки: значение
 * уходит по своему ключу, соседние виды не затираются, «другого» среди полей
 * нет, а без сеттера поля не появляются вовсе (старый вызов не ломается).
 */
import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioAthleteSection } from '../CardioParamsStep';

const noop = () => {};

/** Аккордеон рендерит тело только открытым — сначала открываем секцию. */
function openFieldTests(): void {
  fireEvent.click(screen.getByRole('button', { name: /полевые тесты/ }));
}

function sportInputs(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[aria-label^="LTHR: "]'),
  );
}

function Harness({ withSetter = true }: { withSetter?: boolean }) {
  const [lthrBySport, setLthrBySport] = useState<Record<string, string>>({});
  return (
    <CardioAthleteSection
      age="30" setAge={noop}
      bodyWeight={80} setBodyWeight={noop}
      restingHr="" setRestingHr={noop}
      sex="male" setSex={noop}
      level="intermediate" setLevel={noop}
      recoveryLow={false} setRecoveryLow={noop}
      lthr="165" setLthr={noop}
      lthrBySport={lthrBySport}
      setLthrBySport={withSetter ? setLthrBySport : undefined}
      onFromProfile={noop} onSaveProfile={noop} onFromDiaryHr={noop}
    />
  );
}

describe('Поле LTHR по видам спорта', () => {
  it('рисует по одному полю на измеримый вид (бег/велосипед/гребля)', () => {
    render(<Harness />);
    openFieldTests();
    expect(screen.getByLabelText('LTHR: бег')).toBeTruthy();
    expect(screen.getByLabelText('LTHR: велосипед')).toBeTruthy();
    expect(screen.getByLabelText('LTHR: гребля')).toBeTruthy();
  });

  it('видов ровно три — для «другого» базы нет, скрытого поля тоже нет', () => {
    render(<Harness />);
    openFieldTests();
    expect(sportInputs().map(i => i.getAttribute('aria-label'))).toEqual([
      'LTHR: бег',
      'LTHR: велосипед',
      'LTHR: гребля',
    ]);
    expect(screen.queryByLabelText('LTHR: другое')).toBeNull();
  });

  it('введённое значение уходит по своему виду и не затирает соседние', () => {
    render(<Harness />);
    openFieldTests();
    fireEvent.change(screen.getByLabelText('LTHR: бег'), { target: { value: '172' } });
    fireEvent.change(screen.getByLabelText('LTHR: гребля'), { target: { value: '155' } });
    expect((screen.getByLabelText('LTHR: бег') as HTMLInputElement).value).toBe('172');
    expect((screen.getByLabelText('LTHR: гребля') as HTMLInputElement).value).toBe('155');
    // Велосипед не затронут — значит пишем в свой ключ, а не перетираем карту.
    expect((screen.getByLabelText('LTHR: велосипед') as HTMLInputElement).value).toBe('');
  });

  it('без сеттера полей нет — старый вызов конструктора не ломается', () => {
    render(<Harness withSetter={false} />);
    openFieldTests();
    expect(sportInputs()).toHaveLength(0);
    expect(screen.getByLabelText('LTHR')).toBeTruthy();   // общий LTHR на месте
  });

  it('подпись объясняет, зачем это нужно', () => {
    render(<Harness />);
    openFieldTests();
    expect(screen.getByText(/по видам спорта/i).textContent).toContain('TID');
  });
});
