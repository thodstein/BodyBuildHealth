/**
 * plan-text-dose-parity.test.ts — текстовые экспорты: полный состав и доза плана.
 *
 * Аудит 2026-11 (проход 20), два дефекта:
 *  1) заголовки групп были плюральными («Минералы»/«БАДы»/«Препараты»), а
 *     `planItemKind` возвращает единственное число → в отчёт врачу попадала
 *     только «База курса», весь план поддержки терялся;
 *  2) доза считалась `DEFAULT_DOSAGES × titrationFactor`, а карточка/расписание —
 *     `resolvePlanDose` (вес + потолки UL): при 140 кг карточка показывала
 *     магний 350 мг, а текст — 200 мг; лаб-титрация умножалась молча.
 */
import { describe, it, expect } from 'vitest';
import { buildPlanText, buildDoctorReport } from '../Calc.mapper';
import { resolvePlanDose } from '../../../../engines/support-plan/substances';

const mk = (substanceId: string, reason = 'r') => ({
  substanceId, category: 'mineral', k: 0.5, q: 'B', reason, mechsCovered: [],
});

const subs = [
  mk('hydration', 'Реология'),
  mk('electrolyte_balance', 'Электролиты'),
  mk('magnesium', 'Нейро/мышцы'),
  mk('telmisartan', 'АД'),
  mk('vitamin_d3', 'Кости/иммунитет'),
];

const rec: any = {
  level: 'mid',
  phase: 'course',
  phaseLabel: 'Курс',
  subs,
  suppression: [],
  gaps: [],
  conflicts: [],
  boosters: [],
  supportRisks: [],
  monitoringSchedule: [],
  guardrails: [],
  procedures: [],
  assayWarnings: [],
  coverage: [],
  summary: 's',
  // Лаб-титрация: ориентир, который раньше перемножался с типовой дозой.
  titrationFactors: new Map([['magnesium', 1.5]]),
};

const state: any = {
  profile: { weight: 140, age: 30, sex: 'male' },
  pharma: { aas: [], phase: 'course', hasHCG: false, hasAI: false },
  labs: {},
};

describe('buildPlanText / buildDoctorReport: полный состав плана', () => {
  it('все четыре группы веществ попадают в «Копировать» (было видно только «База»)', () => {
    const text = buildPlanText(rec, 140);
    expect(text).toContain('БАЗА КУРСА');
    expect(text).toContain('МИНЕРАЛЬНАЯ ПОДДЕРЖКА');
    expect(text).toContain('ПРЕПАРАТЫ');
    expect(text).toContain('БАДЫ И ДОБАВКИ');
    expect(text).toContain('Гидратация');
    expect(text).toContain('Электролиты');
    expect(text).toContain('Магний');
    expect(text).toContain('Тельмисартан');
    expect(text).toContain('Витамин D3');
  });

  it('все четыре группы — и в отчёте «Врачу»', () => {
    const text = buildDoctorReport(rec, state);
    expect(text).toContain('МИНЕРАЛЬНАЯ ПОДДЕРЖКА');
    expect(text).toContain('ПРЕПАРАТЫ');
    expect(text).toContain('БАДЫ И ДОБАВКИ');
    expect(text).toContain('Магний');
    expect(text).toContain('Витамин D3');
  });
});

describe('buildPlanText / buildDoctorReport: предел рядом с дозой выше UL', () => {
  // B6: план 25 мг при UL 12 мг (EFSA 2023) — план это допускает как потолок
  // протокола, но текст обязан назвать предел: скопированный «B6 25 мг» без
  // подписи читается как безопасная доза.
  const recB6: any = { ...rec, subs: [...subs, mk('vitamin_b6', 'Дофамин')] };

  it('«Копировать»: превышение UL подписано', () => {
    const text = buildPlanText(recB6, 60);
    expect(text).toMatch(/Витамин В6[^\n]{0,120}выше UL 12 мг/);
  });

  it('«Врачу»: превышение UL — отдельной строкой', () => {
    const text = buildDoctorReport(recB6, state);
    expect(text).toContain('Предел дозы: ⚠ выше UL 12 мг');
  });

  it('в пределах предела — ничего не дописываем', () => {
    const text = buildPlanText(rec, 140); // магний 350 = UL, D3 4000 = UL
    expect(text).not.toContain('выше UL 350');
    expect(text).not.toContain('Предел дозы');
  });
});

describe('buildPlanText / buildDoctorReport: доза плана, а не DEFAULT×титрация', () => {
  it('«Копировать»: 140 кг → магний 350 мг (как карточка), без титрации ×1.5', () => {
    const text = buildPlanText(rec, 140);
    expect(text).toMatch(/Магний[^\n]{0,3}350 мг/);
    expect(text).not.toMatch(/Магний[^\n]{0,3}300 мг/); // 200×1.5 — старая вторая доза
  });

  it('«Копировать»: 60 кг → магний 200 мг (нижняя граница вес-дозы)', () => {
    const text = buildPlanText(rec, 60);
    expect(text).toMatch(/Магний[^\n]{0,3}200 мг/);
  });

  it('D3 в тексте — единицы плана, без «мг» и без 2000 у 140 кг', () => {
    const text = buildPlanText(rec, 140);
    expect(resolvePlanDose('vitamin_d3', 140)).toBe(4000); // 100 мкг = UL 4000 МЕ
    expect(text).toMatch(/Витамин D3[^\n]{0,3}4000 МЕ/);
    expect(text).not.toMatch(/Витамин D3[^\n]{0,3}2000 МЕ/);
  });

  it('база курса (hydration) — без выдуманной дозы «500 мг»', () => {
    const text = buildPlanText(rec, 140);
    expect(text).not.toMatch(/Гидратация[^\n]{0,6}\d+\s*мг/);
  });

  it('«Врачу»: та же доза плана, что в карточке', () => {
    const text = buildDoctorReport(rec, state);
    expect(text).toMatch(/Магний[^\n]{0,3}350 мг/);
    expect(text).not.toMatch(/Магний[^\n]{0,3}300 мг/);
  });
});
