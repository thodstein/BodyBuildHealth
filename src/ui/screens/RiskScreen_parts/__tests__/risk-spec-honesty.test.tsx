/**
 * risk-spec-honesty.test.tsx — guard: механизм-модель в «Рисках» честно
 * сообщает, что часть препаратов не смоделирована.
 *
 * Аудит 2026-11: `calculateTzSpecRisk` давно возвращает `riskStatus` и
 * `unmodeledDrugs` (препарат без записи в `DRUG_DB` не даёт вклада), но экран
 * показывал только проценты — «риск 0 %» читался как «всё безопасно».
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RISK_LAB_MARKERS } from '../../../../engines/risk-engine-tz-spec';
import { writeCalcSnapshot, courseSignature } from '../../../../engines/tz-snapshot';

const courseBox: { current: any[] } = { current: [] };
const labsBox: { current: any[] } = { current: [] };

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    course: courseBox.current,
    labs: labsBox.current,
    profile: { settings: { weight: 85 } },
  }),
}));

import { RiskSpecMethod } from '../RiskSpecMethod';

const KNOWN = { id: '1', substanceId: 'test_enan', doseValue: 500, frequency: '2x/wk', startWeek: 1, endWeek: 12 };
const UNKNOWN = {
  id: '2',
  substanceId: 'unknown_peptide_xyz',
  doseValue: 10,
  frequency: 'daily',
  startWeek: 1,
  endWeek: 4,
};

describe('RiskSpecMethod: честность расчёта', () => {
  beforeEach(() => {
    localStorage.clear();
    courseBox.current = [];
    labsBox.current = [];
  });

  it('неизвестный препарат → красная плашка «НЕ рассчитан» + список', () => {
    courseBox.current = [UNKNOWN];
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).toContain('НЕ рассчитан');
    expect(container.textContent).toContain('unknown_peptide_xyz');
  });

  it('смешанный курс → «Расчёт неполный», список не смоделированных', () => {
    courseBox.current = [KNOWN, UNKNOWN];
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).toContain('Расчёт неполный');
    expect(container.textContent).toContain('unknown_peptide_xyz');
  });

  it('все препараты известны → плашек о неполноте нет', () => {
    courseBox.current = [KNOWN];
    const { container } = render(<RiskSpecMethod />);
    expect(container.textContent).not.toContain('НЕ рассчитан');
    expect(container.textContent).not.toContain('Расчёт неполный');
  });

  it('покрытие анализами — число модели, а не доля рукописного списка', () => {
    courseBox.current = [KNOWN];
    labsBox.current = [
      { code: 'K', value: 4.2 },
      { code: 'HCT', value: 46 },
      { code: 'GLU', value: 5.1 },
    ];
    const { container } = render(<RiskSpecMethod />);
    // Подпись живёт в сворачиваемом блоке «Входные данные расчёта».
    fireEvent.click(container.querySelector('.risk-inputs [role="button"]') as Element);
    // Три маркера модели: 0.3 + 0.04 x 3 = 0.42 — модель насыщается уже на 18
    // маркерах, поэтому подпись печатает не сырую долю (42 % при трёх анализах
    // читалось бы как «почти всё»), а штраф неопределённости U = 1 + 0.25·(1−0.42)
    // → ×1.00 при d_cov ≥ 1, здесь 0.42 → ×1.15. Считает его сама модель.
    expect(container.textContent).toContain(`3 из ${RISK_LAB_MARKERS.length} маркеров модели`);
    expect(container.textContent).toMatch(/штраф неопределённости ×1\.1[45]/);
  });

  it('снапшот калькулятора: покрытие считает те же анализы, что ушли в модель', () => {
    // Ревью P1: в ветке снапшота `buildInputs.labValues` содержит производные
    // (`HOMA`, `EGFR`), а подпись/таймлайн брали живой `labMap` без них — «38 %»
    // стояли рядом с U, посчитанным по другой карте. Карта бланка здесь пустая,
    // значит любое ненулевое покрытие приходит только из снапшота.
    courseBox.current = [KNOWN];
    writeCalcSnapshot(
      {
        drugClass: 'aas',
        drugName: 'weekly',
        dose: 500,
        duration: 12,
        form: 'inject',
        labValues: { K: 4.2, HCT: 46, GLU: 5.1, HOMA: 4.8, EGFR: 88 },
        labCoverage: 0.5,
        supportSubstances: [],
      },
      courseSignature([{ id: 'test_enan', dose: 500 }]),
    );
    const { container } = render(<RiskSpecMethod />);
    fireEvent.click(container.querySelector('.risk-inputs [role="button"]') as Element);
    expect(container.textContent).toContain(`5 из ${RISK_LAB_MARKERS.length} маркеров модели`);
    // Бейдж шапки блока — то же число, что в подписи (P3-4): иначе на карточке
    // стоят два разных счётчика анализов.
    expect(container.querySelector('.risk-inputs')!.textContent).toContain('5 марк.');
    // d_cov = 0.3 + 5 × 0.04 = 0.5 → U = 1 + 0.25 × 0.5 = 1.125 → ×1.13.
    // Без производных из снапшота карта пустая и подпись сказала бы «0 из 46, ×1.18».
    expect(container.textContent).toMatch(/штраф неопределённости ×1\.1[23]/);
  });

  it(
    '«Без анализов» снимает анализы и в ветке снапшота калькулятора',
    () => {
      // Ревью P2-1: кнопка меняла только вид («Штраф активирован»), а модель
      // продолжала считать по снапшоту — два разных ответа на одной карточке.
      courseBox.current = [KNOWN];
      writeCalcSnapshot(
        {
          drugClass: 'aas',
          drugName: 'weekly',
          dose: 500,
          duration: 12,
          form: 'inject',
          labValues: { K: 4.2, HCT: 46, GLU: 5.1, HOMA: 4.8, EGFR: 88 },
          labCoverage: 0.5,
          supportSubstances: [],
        },
        courseSignature([{ id: 'test_enan', dose: 500 }]),
      );
      const { container } = render(<RiskSpecMethod />);
      // Кнопка живёт в раскрытом блоке «Входные данные расчёта».
      fireEvent.click(container.querySelector('.risk-inputs [role="button"]') as Element);
      const toggle = Array.from(container.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('Без анализов'),
      );
      expect(toggle, 'нет кнопки «Без анализов»').toBeTruthy();
      fireEvent.click(toggle!);
      expect(container.textContent).toContain(`0 из ${RISK_LAB_MARKERS.length} маркеров модели`);
      expect(container.querySelector('.risk-inputs')!.textContent).toContain('0 марк.');
      // Баннер «цифры идентичны калькулятору» при снятых анализах врал бы.
      expect(container.textContent).not.toContain('Цифры идентичны калькулятору');
      // Пустая карта: d_cov = 0.3 → U = 1 + 0.25 × 0.7 = 1.175 → ×1.18.
      expect(container.textContent).toMatch(/штраф неопределённости ×1\.1[78]/);
    },
  );

  it('своего списка обязательных анализов у экрана больше нет', () => {
    // Второй список — второй источник чисел: он расходился с маркерами модели.
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/RiskScreen_parts/RiskSpecMethod.tsx'), 'utf8');
    expect(src).not.toContain('REQUIRED_LAB_CODES');
    expect(src).toContain('riskLabCoverage(');
  });

  it('покрытие механизмов рядом с Kp: «Механизмы: c/t закрыто»', () => {
    courseBox.current = [KNOWN];
    const { container } = render(<RiskSpecMethod />);
    // Механизмы риска у курса есть; без поддержки закрытых 0 — но цифра честная.
    expect(container.textContent).toMatch(/Механизмы: \d+\/\d+ закрыто/);
    // Это отдельная метрика, Kp никуда не исчез.
    expect(container.textContent).toContain('Kp =');
  });
});
