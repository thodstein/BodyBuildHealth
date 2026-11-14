/**
 * monitoring-single-list.test.tsx — «Мониторинг / врачебный протокол / K0–K10 — одно и то же».
 *
 * Аудит 2026-11: блок мониторинга печатал один и тот же список анализов трижды
 * (график фазы → карточки K0–K10 → свод системных панелей), а текстовые экспорты
 * дважды («МОНИТОРИНГ И АНАЛИЗЫ» + «КАРТОЧКИ АНАЛИЗОВ ПО ФАЗАМ»). Пользователь
 * читал это как три разных раздела с одинаковым содержимым.
 *
 * Контракт после прохода:
 *   • перечень анализов ОДИН — карточки фаз (support-phase-labs);
 *   • рядом остаётся только то, чего в карточках нет: привязка «маркер →
 *     вещества плана» (без повторного «когда/цель»), пороги тревог по системам,
 *     инструменты, дневник, экстренные признаки и быт («ЕЖЕДНЕВНО»);
 *   • график фазы (monitoringSchedule) в UI и в текстовых экспортах не печатается.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PHASE_LAB_CARDS, cardMarkerList, markerCoveredByMarkers, phaseCardsFor,
} from '../../../../engines/support-phase-labs.engine';
import { buildPlanText, buildDoctorReport } from '../Calc.mapper';

const MK = (substanceId: string, reason = 'r') => ({
  substanceId, category: 'mineral', k: 0.5, q: 'B', reason, mechsCovered: [],
});

const rec: any = {
  level: 'mid',
  phase: 'course',
  phaseLabel: 'Курс',
  pedFlags: { hasAAS: true },
  subs: [MK('hydration', 'Реология'), MK('magnesium', 'Нейро/мышцы'), MK('telmisartan', 'АД')],
  suppression: [],
  gaps: [],
  conflicts: [],
  boosters: [],
  supportRisks: [],
  // График фазы в тексте больше не печатается, но ежедневный быт берётся отсюда.
  monitoringSchedule: [
    {
      id: 'daily', label: 'Ежедневно', period: 'каждый день', icon: '🌡',
      items: [{ marker: 'Вес (утром)', reason: 'Задержка воды/отёки', target: '↑ <2 кг/нед' }],
    },
    {
      id: 'baseline', label: 'До курса (исходно)', period: '0 нед', icon: '📋',
      items: [{ marker: 'ОАК с СОЭ: HCT, HGB, RBC, WBC, PLT', reason: 'База', target: 'HCT<50%' }],
    },
  ],
  guardrails: [],
  procedures: [],
  assayWarnings: [],
  coverage: [],
  summary: 's',
};

const state: any = {
  profile: { weight: 80, age: 30, sex: 'male' },
  pharma: { aas: [{ id: 'test_enan' }], phase: 'course', hasHCG: false, hasAI: false },
  labs: {},
};

describe('маркер считается описанным карточкой по токенам, а не по точной строке', () => {
  const cards = cardMarkerList(PHASE_LAB_CARDS);

  it('«АЛТ/АСТ» покрыто карточкой «АЛТ/АСТ/ГГТ/ЩФ/…»', () => {
    expect(markerCoveredByMarkers('АЛТ/АСТ', cards)).toBe(true);
  });

  it('«PRL» покрыто «PRL (19-nor)»', () => {
    expect(markerCoveredByMarkers('PRL', cards)).toBe(true);
  });

  it('маркер, которого в карточках нет, не считается покрытым', () => {
    expect(markerCoveredByMarkers('Либидо', cards)).toBe(false);
  });

  it('пустая строка — не покрытие (не глотаем пустые маркеры)', () => {
    expect(markerCoveredByMarkers('   ', cards)).toBe(false);
  });
});

describe('текстовые экспорты: один перечень анализов', () => {
  it('«Копировать»: карточки K0–K10 один раз, графика фазы нет', () => {
    const text = buildPlanText(rec, 80);
    expect(text.match(/АНАЛИЗЫ ПО ФАЗАМ \(K0–K10\)/g)?.length).toBe(1);
    expect(text).not.toContain('МОНИТОРИНГ И АНАЛИЗЫ:');
    expect(text).not.toContain('КАРТОЧКИ АНАЛИЗОВ ПО ФАЗАМ (K0–K10):');
    // фазовая строка графика («До курса (исходно)» + ОАК) в текст не попала
    expect(text).not.toContain('До курса (исходно) (0 нед)');
    // привязка к веществам и быт остались
    expect(text).toContain('МОНИТОРИНГ ПО ПРЕПАРАТАМ ПЛАНА');
    expect(text).toContain('ЕЖЕДНЕВНО (быт, не анализы)');
    expect(text).toContain('Вес (утром)');
  });

  it('«Врачу»: тот же единственный перечень, без второго списка «КАРТОЧКИ…»', () => {
    const text = buildDoctorReport(rec, state);
    expect(text.match(/АНАЛИЗЫ ПО ФАЗАМ \(K0–K10\)/g)?.length).toBe(1);
    expect(text).not.toContain('МОНИТОРИНГ И АНАЛИЗЫ:');
    expect(text).not.toContain('КАРТОЧКИ АНАЛИЗОВ ПО ФАЗАМ (K0–K10):');
    expect(text).toContain('Вес (утром)');
  });

  it('в экспорт попадают именно карточки выбранной фазы', () => {
    const ids = phaseCardsFor(rec.pedFlags, rec.phase).map(c => c.id);
    const text = buildPlanText(rec, 80);
    for (const id of ids) expect(text).toContain(`${id} · `);
  });
});

describe('source-lock: график фазы не рендерится в мониторинге', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.mapper.tsx'), 'utf8');

  it('нет вывода monitoringSchedule в JSX и нет второго текстового блока', () => {
    expect(src).not.toContain('{(finalRec.monitoringSchedule || []).map');
    expect(src).not.toContain(`lines.push('МОНИТОРИНГ И АНАЛИЗЫ:')`);
    expect(src).not.toContain(`lines.push('КАРТОЧКИ АНАЛИЗОВ ПО ФАЗАМ (K0–K10):')`);
  });

  it('быт берётся из графика фазы (секция daily) — единственное место его чтения', () => {
    expect(src).toContain(`find(s => s.id === 'daily')`);
  });

  it('свод системных панелей больше не перечисляет маркеры', () => {
    expect(src).not.toContain('Маркеры:</span> {panel.markers}');
    expect(src).not.toContain('Частота:</span> {panel.freq}');
  });
});
