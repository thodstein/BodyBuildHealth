/**
 * labs-results-female-phase.test.tsx — проход 78: строка результата в
 * «Лабораториях» знает фазу цикла.
 *
 * Было: у женщины рядом с E2 печаталась мужская строка резолвера
 * (`getLabNorm('E2')` = 10–40 пг/мл), а статус считался по ней же. Её
 * нормальная лютеиновая 300–450 читалась «выше», фолликулярная 300 — тоже
 * «выше», при этом в отчёте и в бэндах те же числа были нормой. ЛГ/ФСГ хуже:
 * резолвер отдаёт 1–12 / 1–15 — тоже мужские.
 *
 * Контракт: у женщины E2/ЛГ/ФСГ сравниваются с коридором её фазы
 * (`female-cycle-phase.engine`); фазы нет (или овуляторная) — объединение фаз с
 * подписью «по фазе». Свой диапазон из бланка лаборатории остаётся главнее.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LabsResults } from '../LabsResults';
import { cycleState } from '../../../../engines/female-cycle-phase.engine';
import { FEMALE_LABS_TAB_NOTE } from '../../../../engines/lab-norms.engine';
import type { LabPoint } from '../../../../core/types';

const lab = (code: string, value: number, unit = ''): LabPoint => ({
  id: code + value, code, name: code, value, unit, date: '2026-11-10', phase: 'on_cycle',
});

const html = (labs: LabPoint[], sex?: 'male' | 'female', cycle?: ReturnType<typeof cycleState>) =>
  renderToStaticMarkup(React.createElement(LabsResults, { labs, sex, cycle }));

const LUTEAL = cycleState({ sex: 'female', lastPeriodStart: '2026-10-30', cycleLengthDays: 28 }, '2026-11-14');
const FOLLICULAR = cycleState({ sex: 'female', lastPeriodStart: '2026-11-08', cycleLengthDays: 28 }, '2026-11-14');
const OVULATORY = cycleState({ sex: 'female', lastPeriodStart: '2026-11-02', cycleLengthDays: 28 }, '2026-11-14');
const MENSTRUAL = cycleState({ sex: 'female', lastPeriodStart: '2026-11-13', cycleLengthDays: 28 }, '2026-11-14');

describe('♀ E2 в строке результата — коридор её фазы', () => {
  it('лютеиновая: 450 — норма, а не «выше» (мужская строка 10–40)', () => {
    const h = html([lab('E2', 450, 'пг/мл')], 'female', LUTEAL);
    expect(h).toContain('70–500 пг/мл (лютеиновая)');
    expect(h).toContain('норма');
    expect(h).not.toContain('выше');
  });

  it('фолликулярная: те же 300 — «выше» её коридора 40–200', () => {
    const h = html([lab('E2', 300, 'пг/мл')], 'female', FOLLICULAR);
    expect(h).toContain('40–200 пг/мл (фолликулярная)');
    expect(h).toContain('выше');
  });

  it('без даты цикла — объединение фаз и подпись «по фазе»', () => {
    const inside = html([lab('E2', 450, 'пг/мл')], 'female');
    expect(inside).toContain('40–500 пг/мл (по фазе)');
    expect(inside).toContain('норма');
    const outside = html([lab('E2', 520, 'пг/мл')], 'female');
    expect(outside).toContain('выше');
  });

  it('овуляторная — коридора нет, объединение фаз (пик не наказываем)', () => {
    const h = html([lab('E2', 450, 'пг/мл')], 'female', OVULATORY);
    expect(h).toContain('40–500 пг/мл (по фазе)');
    expect(h).toContain('норма');
  });

  it('низ E2 — красная граница 30, а не низ коридора', () => {
    const h = html([lab('E2', 25, 'пг/мл')], 'female', MENSTRUAL);
    expect(h).toContain('ниже');
  });

  it('ЛГ 20: у женщины в лютеиновую — норма (5–25), мужская строка дала бы «выше»', () => {
    const fem = html([lab('LH', 20, 'МЕ/л')], 'female', LUTEAL);
    expect(fem).toContain('5–25 МЕ/л (лютеиновая)');
    expect(fem).toContain('норма');
    const male = html([lab('LH', 20, 'МЕ/л')], 'male', LUTEAL);
    expect(male).not.toContain('data-phase-ref');
    expect(male).toContain('выше');
  });

  it('мужчине фаза не подставляется — строка из UCUM', () => {
    const h = html([lab('E2', 30, 'пг/мл')], 'male', LUTEAL);
    expect(h).not.toContain('data-phase-ref');
    expect(h).toContain('10–40');
  });

  it('диапазон из бланка лаборатории главнее фазового коридора', () => {
    const withRefs: LabPoint = { ...lab('E2', 450, 'пг/мл'), refLow: 100, refHigh: 600 };
    const h = html([withRefs], 'female', LUTEAL);
    expect(h).not.toContain('data-phase-ref');
    expect(h).toContain('норма');
  });

  it('пометка женских порогов называет текущую фазу', () => {
    const h = html([lab('E2', 450, 'пг/мл')], 'female', LUTEAL);
    expect(h).toContain(FEMALE_LABS_TAB_NOTE);
    expect(h).toContain('Сейчас: лютеиновая фаза, 16-й день из 28');
  });
});

describe('источник фазы в экране «Лаборатории»', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');

  it('фаза считается один раз и передаётся в строки результата', () => {
    expect(src).toContain('const cyclePhase = useMemo(() => cycleStateFromProfile(linked.profile)');
    expect(src).toContain('cycle={cyclePhase}');
    // Ровно один расчёт фазы на экран: второй вызов — это уже две фазы.
    expect(src.split('cycleStateFromProfile(linked.profile)').length - 1).toBe(1);
  });

  it('архиву фаза не передаётся — у старых дат она другая', () => {
    expect(src).toContain('labs={archiveLabs} sex={profileSex as \'male\' | \'female\'} />');
  });
});
