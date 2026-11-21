/**
 * risk-flat-unread-visible.test.tsx — гард прохода 182: экран «Риски» называет
 * записи бланка, которые не удалось привести к единице расчёта.
 *
 * Класс дефекта: анализ, единицу которого нельзя пересчитать (КФК-МВ в нг/мл
 * против нормы в Ед/л), раньше молча отдавался модели своим числом — либо
 * просто исчезал из списка. «Нет записи» читалось как «в норме». Теперь отказ
 * виден строкой `data-labs-unread`, а читаемые записи по-прежнему показываются
 * числом в единице расчёта (инсулин 60 пмоль/л — это 10 мЕд/л, а не 60).
 *
 * Проход 185 сделал КФК-МВ активностью (Ед/л) везде, поэтому непереводимой
 * стала масса: бланк «25 нг/мл» не сравнивается с нормой 24 Ед/л.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const linked = {
  current: { course: [] as any[], labs: [] as any[] },
};

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    course: linked.current.course,
    labs: linked.current.labs,
    profile: { settings: { weight: 85 } },
  }),
}));

import { RiskSpecMethod } from '../RiskSpecMethod';

const COURSE = { id: '1', substanceId: 'test_enan', doseValue: 500, frequency: '2x/wk', startWeek: 1, endWeek: 12 };

/** Блоки данных свёрнуты по умолчанию — раскрываем тем же заголовком. */
const openInputs = (container: HTMLElement) => {
  const header = Array.from(container.querySelectorAll('[role="button"]'))
    .find(el => (el.textContent || '').includes('Входные данные расчёта'));
  expect(header).toBeTruthy();
  fireEvent.click(header!);
};

describe('RiskSpecMethod: единица бланка на экране риска', () => {
  beforeEach(() => {
    localStorage.clear();
    linked.current = { course: [COURSE], labs: [] };
  });

  it('непереводимая запись названа, а не выдана за норму', () => {
    linked.current.labs = [
      { code: 'CK_MB', name: 'КФК-МВ', value: 25, unit: 'ng/mL' },
    ];
    const { container } = render(<RiskSpecMethod />);
    openInputs(container);
    const block = container.querySelector('[data-labs-unread]');
    expect(block).not.toBeNull();
    const text = block!.textContent || '';
    expect(text).toContain('КФК-МВ');
    expect(text).toContain('25');
    expect(text).toContain('ng/mL');
    expect(text).toContain('Е/л');
    expect(text).toContain('в расчёт не вошло');
  });

  it('читаемая запись показана числом в единице расчёта и не попадает в отказ', () => {
    linked.current.labs = [
      { code: 'INS', name: 'Инсулин', value: 60, unit: 'пмоль/л' },
    ];
    const { container } = render(<RiskSpecMethod />);
    openInputs(container);
    expect(container.querySelector('[data-labs-unread]')).toBeNull();
    // 60 пмоль/л инсулина = 10 мЕд/л; раньше модель получала 60 и видела
    // «втрое выше нормы 17».
    expect(container.textContent).toContain('INS: 10');
    expect(container.textContent).not.toContain('INS: 60');
    // Проход 183: число подписано единицей расчёта, а не показано «голым».
    expect(container.textContent).toContain('INS: 10 mIU/L');
  });

  it('индекс без единицы печатается без приписки', () => {
    linked.current.labs = [
      { code: 'HOMA', name: 'HOMA-IR', value: 2.4 },
    ];
    const { container } = render(<RiskSpecMethod />);
    openInputs(container);
    expect(container.textContent).toContain('HOMA: 2.4');
    // Единицы у индекса нет и выдумывать её нельзя.
    expect(container.textContent).not.toContain('HOMA: 2.4 ');
  });
});
