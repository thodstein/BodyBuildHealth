/**
 * reticulocyte-scale.test.ts — проход 193: одна шкала ретикулоцитов.
 *
 * Класс дефекта: анализ жил в двух величинах сразу. Каталог держал проценты
 * (0.5–2.5 — числа без источника), а строка ступеней — абсолютное число
 * 20–100/100–150/150–300 в 10⁹/л. Бланк печатает проценты (Хеликс 02-027 и КДЛ:
 * ♂ 0.67–1.92, ♀ 0.59–2.07), поэтому нормальные 1.5 % были «ниже нормы 20» и
 * получали ступень «лечение». Обратная ошибка тоже была: запись в 10⁹/л
 * (например 50) подставлялась в шкалу процентов как «50 %».
 *
 * Абсолютное число = % × RBC × 10: без числа эритроцитов пересчёта нет. Поэтому
 * запись в 10⁹/л честно уходит в «не прочитано», а не в чужую шкалу.
 * Относительное в ‰ (ИНВИТРО №150: 6.8–18.6 ‰ = 0.68–1.86 %) — та же величина,
 * переводится ×0.1.
 *
 * Гард держит равенство: каталог = `RETIC_BAND` = строка ступеней = женский слой
 * = `lab-marker-map`, единица одна — «%». Отдельно держится сторона совета:
 * вещества карты лечат низкую сторону (`correctionSide:'low'`), и на подъёме
 * `getCorrectionIds` отдаёт пустой список — железо и B12 не выдаются на
 * выросшие ретикулоциты.
 */
import { describe, it, expect } from 'vitest';
import { ucumInfo } from '../../core/constants';
import { readLabInUnit, unitsIncommensurable } from '../../core/labs-mapping';
import { LAB_TIERS, deriveTier, getLabEntry, tierMarkerKey } from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { RETIC_BAND, getLabNorm } from '../../engines/lab-norms.engine';
import { flatLabUnit, readFlatLabs } from '../../engines/support-plan/engine-helpers';
import { LAB_MARKER_MAP, getCorrectionIds } from '../lab-marker-map';

const RETIC = ucumInfo('RETICULOCYTES')!;

const text = (labs: Record<string, number>, sex?: 'male' | 'female') =>
  computeTierAdjustments(labs, sex).nutrition.map((n) => `${n.action} ${n.target}`).join(' | ');

describe('проход 193: ретикулоциты — проценты бланка, одна шкала', () => {
  it('каталог — источник нормы, строка ступеней в его единице', () => {
    expect(RETIC.prefUnit).toBe('%');
    expect(RETIC.lln).toBe(0.67);
    expect(RETIC.uln).toBe(1.92);

    const row = LAB_TIERS.RETICULOCYTES;
    expect(row.unit).toBe(RETIC.prefUnit);
    expect(row.normal).toEqual([RETIC.lln, RETIC.uln]);
    // Низ: 0.5·LLN — «лечение», между половиной и нормой — грань.
    expect(row.borderline[0]).toBe(0.34);
    expect(row.borderline[1]).toBe(RETIC.lln);
    expect(row.treatment[0]).toBe(0);
    expect(row.treatment[1]).toBe(0.34);
    // Верх: норма кончается на ВГН, дальше грань и 2×ВГН.
    expect(row.borderline[2]).toBe(RETIC.uln);
    expect(row.borderline[3]).toBe(3.84);
    expect(row.treatment[2]).toBe(3.84);
    // Экстренной границы нет: число «⛔ STOP COURSE» по ретикулоцитам не выдумано.
    expect(row.emergencyLow).toBeUndefined();
    expect(row.emergencyHigh).toBeUndefined();
  });

  it('банк шкалы и ступеней — те же числа, что в каталоге', () => {
    expect(RETIC_BAND.low).toBe(RETIC.lln);
    expect(RETIC_BAND.high).toBe(RETIC.uln);
    expect(RETIC_BAND.halfLow).toBe(0.34);
    expect(RETIC_BAND.doubleHigh).toBe(3.84);
  });

  it('женский слой — своя пара, мужской путь не тронут', () => {
    expect(getLabNorm('RETICULOCYTES')!.lln).toBe(0.67);
    expect(getLabNorm('RETICULOCYTES', 'male')!.uln).toBe(1.92);
    expect(getLabNorm('RETICULOCYTES', 'male')!.female).toBe(false);

    const fem = getLabNorm('RETICULOCYTES', 'female')!;
    expect(fem.lln).toBe(0.59);
    expect(fem.uln).toBe(2.07);
    expect(fem.female).toBe(true);
    expect(RETIC_BAND.femaleLow).toBe(0.59);
    expect(RETIC_BAND.femaleHigh).toBe(2.07);
    expect(RETIC_BAND.femaleHalfLow).toBe(0.3);
    expect(RETIC_BAND.femaleDoubleHigh).toBe(4.14);
  });

  it('форма находит ту же строку и ту же единицу', () => {
    expect(tierMarkerKey('RETICULOCYTES')).toBe('RETICULOCYTES');
    expect(getLabEntry('RETICULOCYTES')).toBe(LAB_TIERS.RETICULOCYTES);
    expect(flatLabUnit('RETICULOCYTES')).toBe('%');
  });

  it('ступень читает проценты по обеим сторонам шкалы', () => {
    expect(deriveTier('RETICULOCYTES', 0.8, 'male')).toBe(0);
    expect(deriveTier('RETICULOCYTES', 1.92, 'male')).toBe(0);
    // Высокая сторона: грань до 2×ВГН, дальше «лечение» без «экстренно».
    expect(deriveTier('RETICULOCYTES', 2.0, 'male')).toBe(1);
    expect(deriveTier('RETICULOCYTES', 2.5, 'male')).toBe(1);
    expect(deriveTier('RETICULOCYTES', 3.84, 'male')).toBe(2);
    expect(deriveTier('RETICULOCYTES', 10, 'male')).toBe(2);
    // Низкая сторона.
    expect(deriveTier('RETICULOCYTES', 0.5, 'male')).toBe(1);
    expect(deriveTier('RETICULOCYTES', 0.34, 'male')).toBe(2);
    expect(deriveTier('RETICULOCYTES', 0.2, 'male')).toBe(2);
  });

  it('у женщины — женский ряд той же шкалы', () => {
    // 2.0 % — её норма, у мужчины это уже грань.
    expect(deriveTier('RETICULOCYTES', 2.0, 'female')).toBe(0);
    expect(deriveTier('RETICULOCYTES', 2.0, 'male')).toBe(1);
    expect(deriveTier('RETICULOCYTES', 2.5, 'female')).toBe(1);
    expect(deriveTier('RETICULOCYTES', 4.2, 'female')).toBe(2);
    expect(deriveTier('RETICULOCYTES', 0.5, 'female')).toBe(1);
    expect(deriveTier('RETICULOCYTES', 0.25, 'female')).toBe(2);
  });

  it('совет различает стороны, не выдаёт добавки «по числу» и не кричит STOP', () => {
    const high = computeTierAdjustments({ RETICULOCYTES: 2.5 }, 'male');
    expect(high.addSubs).toEqual([]);
    expect(high.titrations).toEqual([]);
    expect(high.alerts).toEqual([]);
    expect(high.stopCourse).toBe(false);
    expect(text({ RETICULOCYTES: 2.5 })).toContain('Не добавку, а причину');
    expect(text({ RETICULOCYTES: 2.5 })).not.toContain('Проверить субстрат');

    // Выше 2×ВГН — гематолог и поиск гемолиза/кровопотери.
    const high2 = text({ RETICULOCYTES: 4.5 });
    expect(high2).toContain('Гемолиз?');
    expect(high2).toContain('Кровопотеря');
    expect(computeTierAdjustments({ RETICULOCYTES: 4.5 }, 'male').stopCourse).toBe(false);

    // Низкая сторона — субстрат и причина, а не «лечить цифру».
    const low = text({ RETICULOCYTES: 0.5 });
    expect(low).toContain('Проверить субстрат');
    expect(low).not.toContain('Гемолиз?');
    expect(text({ RETICULOCYTES: 0.3 })).toContain('Почки');

    // Норма — ни строки; у женщины 2.0 % — тоже норма.
    expect(computeTierAdjustments({ RETICULOCYTES: 1.5 }, 'male').nutrition).toEqual([]);
    expect(computeTierAdjustments({ RETICULOCYTES: 2.0 }, 'female').nutrition).toEqual([]);
  });

  it('бланк в процентах и в промилле читается, ±10 раз не путаются', () => {
    expect(readLabInUnit('RETICULOCYTES', 1.5, '%', '%')).toBe(1.5);
    // ИНВИТРО печатает относительное в ‰: 15 ‰ = 1.5 %.
    expect(readLabInUnit('RETICULOCYTES', 15, '‰', '%')).toBeCloseTo(1.5, 6);
    expect(readLabInUnit('RETICULOCYTES', 6.8, 'промилле', '%')).toBeCloseTo(0.68, 6);
  });

  it('абсолютное число (10⁹/л) — «не прочитано», а не проценты', () => {
    // Без RBC процент не получить: 50×10⁹/л — это не «50 %».
    expect(readLabInUnit('RETICULOCYTES', 50, '10⁹/л', '%')).toBeNull();
    expect(readLabInUnit('RETICULOCYTES', 50, '10^9/L', '%')).toBeNull();
    expect(unitsIncommensurable('%', '10⁹/л')).toBe(true);
    expect(unitsIncommensurable('%', '‰')).toBe(false);

    const absolute = readFlatLabs([{ code: 'RETICULOCYTES', value: 50, unit: '10⁹/л' }]);
    expect(absolute.values).toEqual({});
    expect(absolute.unread).toEqual([{ code: 'RETICULOCYTES', value: 50, unit: '10⁹/л' }]);

    const percent = readFlatLabs([{ code: 'RETICULOCYTES', value: 1.5, unit: '%' }]);
    expect(percent.values).toEqual({ RETICULOCYTES: 1.5 });
    expect(percent.unread).toEqual([]);

    const promille = readFlatLabs([{ code: 'RETICULOCYTES', value: 15, unit: '‰' }]);
    expect(promille.values.RETICULOCYTES).toBeCloseTo(1.5, 6);
    expect(promille.unread).toEqual([]);
  });

  it('порог `lab-marker-map` — из шкалы, единица та же', () => {
    const entry = LAB_MARKER_MAP.find((m) => m.marker === 'RETICULOCYTES')!;
    expect(entry.defaultValue).toBe(RETIC_BAND.high);
    expect(entry.unit).toBe('%');
  });

  it('вещества карты лечат низкую сторону, а не выросшие ретикулоциты', () => {
    // Низкие ретикулоциты — субстрат эритропоэза.
    expect(getCorrectionIds('RETICULOCYTES', 'down')).toEqual(
      expect.arrayContaining(['iron_supplement', 'folate', 'vitamin_b12']),
    );
    // Подъём — кровопотеря/гемолиз/ответ на лечение: добавки не выдаются.
    expect(getCorrectionIds('RETICULOCYTES', 'up')).toEqual([]);
    // Без направления — прежнее поведение списка (старые вызовы не сломаны).
    expect(getCorrectionIds('RETICULOCYTES').length).toBeGreaterThan(0);
    // Односторонние маркеры фильтр не задевает.
    expect(getCorrectionIds('PLT', 'up').length).toBeGreaterThan(0);
    expect(getCorrectionIds('PLT', 'down').length).toBeGreaterThan(0);
  });
});
