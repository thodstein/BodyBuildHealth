/**
 * Wave-1 Э1.5 (остаток) — Para-класс WAF доезжает до плана.
 *
 * Факт (проверен чтением кода, 26.09.2026): `ArmBuilderInput.paraClass` читался
 * билдером (`arm-pro-integration.engine.ts:116` → `buildWafStartCard({para})`), но
 * НИ ОДИН production-файл его не задавал: нет ни поля в UI, ни передачи в `buildArmPlan`,
 * ни значения в мосте. Итог — вся WAF-2025 система Para (хаб-панель допуска) показывала
 * «допущен», а на план не влияла ничем: категория, потолок и предупреждение о перевесе
 * считались как для обычного Senior.
 *
 * Тест держит сквозной контракт: чип Para в конструкторе → `paraClass` в сборке плана.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { buildWafStartCard } from '../../../../engines/arm/arm-waf.engine';

beforeEach(() => {
  localStorage.clear();
});

/** Шаг «Атлет», где живут вес/возраст/рука/Para. */
function openAthlete() {
  const { container } = render(<ArmAutoConstructor />);
  // пилюля шага, а не hero-кнопка «Атлет: вес, возраст» — обе подходят под /Атлет/
  const pill = container.querySelector('.ad-step[aria-label*="Атлет"]') as HTMLElement | null;
  expect(pill, 'нет пилюли шага «Атлет»').toBeTruthy();
  fireEvent.click(pill!);
  return container;
}

describe('Wave-1 Э1.5: Para-класс WAF (арм-конструктор)', () => {
  it('селектор Para отрисован со всеми официальными классами', () => {
    const container = openAthlete();
    const label = Array.from(container.querySelectorAll('div'))
      .find((d) => (d.textContent || '').includes('Para-класс WAF'));
    expect(label, 'нет заголовка селектора Para').toBeTruthy();
    for (const p of ['PID', 'PIU', 'PIDH', 'PIUH', 'VI', 'HI', 'CPD', 'CPU']) {
      expect(screen.getAllByText(p).length, `нет чипа Para ${p}`).toBeGreaterThan(0);
    }
  });

  it('чип Para меняет стартовую карточку (значит выбор не декоративный)', () => {
    const container = openAthlete();
    fireEvent.change(screen.getByPlaceholderText('84'), { target: { value: '70' } });
    // 70 кг: обычный Senior M-70, а Para PID имеет другие границы [55,65,75,100] → M-75.
    const senior = buildWafStartCard({ sex: 'male', ageYears: 30, bodyWeightKg: 70, para: 'none' });
    fireEvent.click(screen.getAllByText('PID')[0]);
    const note = Array.from(container.querySelectorAll('div'))
      .find((d) => (d.getAttribute('class') || '').includes('ad-tip') && (d.textContent || '').includes('Para'));
    expect(note, 'подсказка WAF не показала выбранный Para').toBeTruthy();
    expect(note!.textContent).toContain('PID');
    // граница класса под Para не совпадает с обычной Senior
    const para = buildWafStartCard({ sex: 'male', ageYears: 30, bodyWeightKg: 70, para: 'PID' });
    expect(`${senior.weightClass.label}`).toBe('70');
    expect(`${para.weightClass.label}`).not.toBe(`${senior.weightClass.label}`);
  });

  it('paraClass меняет сборку плана (не только подсказку)', () => {
    // Сквозной путь UI → сборка: без этого тест был вакуумным — прямой вызов движка
    // проходит мимо конструктора и зеленеет даже при откате проброса (проверено мутацией).
    const container = openAthlete();
    fireEvent.change(screen.getByPlaceholderText('84'), { target: { value: '70' } });
    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '30' } });
    fireEvent.click(screen.getAllByText('PID')[0]);
    // шаг «План»
    const toPlan = Array.from(container.querySelectorAll('button'))
      .find((b) => (b.textContent || '').includes('Сплит') || (b.getAttribute('aria-label') || '').includes('Сплит'));
    expect(toPlan, 'нет перехода на шаг «Сплит»').toBeTruthy();
    fireEvent.click(toPlan!);
    const build = Array.from(document.querySelectorAll('button'))
      .find((b) => (b.textContent || '').includes('Собрать план'));
    expect(build, 'нет кнопки сборки плана').toBeTruthy();
    fireEvent.click(build!);

    // WAF-строка лежит в разделе «Обоснование» на шаге «Выдача» (свёрнут по умолчанию).
    // Берём пилюлю по индексу STEP_DEFS: params0 athlete1 grip2 split3 plan4 quality5 export6
    const pills = Array.from(document.querySelectorAll('.ad-step')) as HTMLElement[];
    const toExport = pills[6];
    expect(toExport, 'нет пилюли шага «Выдача» (индекс 6)').toBeTruthy();
    fireEvent.click(toExport!);
    const head = Array.from(document.querySelectorAll('button'))
      .find((b) => b.getAttribute('aria-expanded') === 'false' && (b.textContent || '').includes('Обоснование'));
    if (head) fireEvent.click(head);

    // В собранном плане WAF-строка: 70 кг → Senior M-70, но Para PID = [55,65,75,100] → M-75
    const rationale = document.querySelector('[data-arm="rationale"]');
    expect(rationale, 'нет блока обоснования в плане').toBeTruthy();
    const wafLine = Array.from(rationale!.querySelectorAll('div'))
      .map((d) => d.textContent || '')
      .find((t) => t.includes('WAF') && t.includes('кат.'));
    expect(wafLine, 'в обосновании нет WAF-строки').toBeTruthy();
    expect(wafLine).toContain('кат. 75');
    expect(wafLine).not.toContain('кат. 70');
  });
});
