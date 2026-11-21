/**
 * dht-scale.test.ts — проход 192: одна шкала дигидротестостерона.
 *
 * Класс дефекта: анализ жил в двух единицах сразу. Каталог держал пг/мл
 * (130–870), строка ступеней и мост механизмов — нмоль/л (1.0–3.0 и 3.5).
 * Число в пг/мл почти всегда больше 3, поэтому:
 * — ступени не было ни при каком значении (`direction:'low'`, выше 3 — «норма»);
 * — мост активировал механизм у любого здорового (3.5 «нмоль/л» против 500 пг/мл);
 * — панели печатали цели 200–600 и 250–600 пг/мл — обрезки шкалы, которой нет
 *   ни в одном бланке РФ.
 *
 * Российские бланки печатают пг/мл иммуноанализа: Хеликс 08-024 (ИФА), КДЛ
 * 7.4.A4.201 и CMD 060206 дают мужчинам 19–89 лет одни и те же 143–842.
 * Тот же коридор вмещает международный LC-MS/MS: Mayo 11–95 нг/дл (110–950 пг/мл),
 * Shiraishi 14–77 нг/дл (140–770 пг/мл) — Endocrine Reviews 2017. ИНВИТРО
 * (№168) для >15 лет даёт 175–913 — расхождение калибровок записано в §4
 * `docs/LAB-NORMS-SINGLE-SOURCE.md`, а не выровнено молча.
 *
 * Гард держит равенство: каталог = `DHT_BAND` = строка ступеней = мост =
 * `lab-marker-map` = панели, единица одна — пг/мл.
 */
import { describe, it, expect } from 'vitest';
import { ucumInfo } from '../../core/constants';
import { readLabInUnit } from '../../core/labs-mapping';
import { LAB_TIERS, deriveTier, getLabEntry, tierMarkerKey } from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { DHT_BAND } from '../../engines/lab-norms.engine';
import { MARKER_TO_TZ_MECH, getActivatedTzMechs } from '../../engines/tz-bridge-marker';
import { flatLabUnit } from '../../engines/support-plan/engine-helpers';
import { LAB_MARKER_MAP } from '../lab-marker-map';
import { PROBLEM_PANELS } from '../labs-problem-panels';

const DHT = ucumInfo('DHT')!;

describe('проход 192: ДГТ — одна единица (пг/мл РФ-бланка)', () => {
  it('каталог — источник нормы, строка ступеней в его единице', () => {
    expect(DHT.lln).toBe(143);
    expect(DHT.uln).toBe(842);
    expect(DHT.prefUnit).toBe('pg/mL');
    const row = LAB_TIERS.DHT;
    expect(row.unit).toBe(DHT.prefUnit);
    expect(row.normal).toEqual([DHT.lln, DHT.uln]);
    // Нижняя сторона: 0.5·LLN — «лечение», между половиной и нормой — грань.
    expect(row.borderline[0]).toBe(71.5);
    expect(row.treatment[1]).toBe(71.5);
    // Верхняя сторона: норма кончается на ВГН, дальше грань и 2×ВГН.
    expect(row.borderline[2]).toBe(DHT.uln);
    expect(row.borderline[3]).toBe(DHT.uln * 2);
    expect(row.treatment[2]).toBe(DHT.uln * 2);
    // Экстренной границы нет: источника на число, при котором один высокий ДГТ
    // требует остановки курса, не существует (см. комментарий `DHT_BAND`).
    expect(row.emergencyLow).toBeUndefined();
    expect(row.emergencyHigh).toBeUndefined();
  });

  it('банк шкалы и ступеней — те же числа, что в каталоге', () => {
    expect(DHT_BAND.low).toBe(DHT.lln);
    expect(DHT_BAND.high).toBe(DHT.uln);
    expect(DHT_BAND.halfLow).toBe(71.5);
    expect(DHT_BAND.doubleHigh).toBe(DHT.uln * 2);
  });

  it('форма находит ту же строку и ту же единицу', () => {
    expect(tierMarkerKey('DHT')).toBe('DHT');
    expect(getLabEntry('DHT')).toBe(LAB_TIERS.DHT);
    expect(flatLabUnit('DHT')).toBe('pg/mL');
  });

  it('бланк в нмоль/л пересчитывается, а не читается как пг/мл', () => {
    expect(readLabInUnit('DHT', 2.5, 'нмоль/л', 'пг/мл')).toBeCloseTo(726.1, 1);
    expect(readLabInUnit('DHT', 2.5, 'nmol/L', 'pg/mL')).toBeCloseTo(726.1, 1);
  });

  it('ступень читает пг/мл по обеим сторонам шкалы', () => {
    expect(deriveTier('DHT', 500, 'male')).toBe(0);
    expect(deriveTier('DHT', 842, 'male')).toBe(0);
    // Высокая сторона: грань до 2×ВГН, дальше «лечение» без «экстренно».
    expect(deriveTier('DHT', 843, 'male')).toBe(1);
    expect(deriveTier('DHT', 1683, 'male')).toBe(1);
    expect(deriveTier('DHT', 1684, 'male')).toBe(2);
    expect(deriveTier('DHT', 3000, 'male')).toBe(2);
    // Низкая сторона.
    expect(deriveTier('DHT', 120, 'male')).toBe(1);
    expect(deriveTier('DHT', 71.5, 'male')).toBe(2);
    expect(deriveTier('DHT', 50, 'male')).toBe(2);
  });

  it('у женщины мужской шкалы нет', () => {
    expect(deriveTier('DHT', 50, 'female')).toBe(0);
    expect(deriveTier('DHT', 3000, 'female')).toBe(0);
  });

  it('совет различает стороны и не выдаёт «STOP COURSE»', () => {
    const text = (labs: Record<string, number>) =>
      computeTierAdjustments(labs, 'male').nutrition.map(n => `${n.action} ${n.target}`).join(' | ');

    // Высокая сторона: способ введения и метод, а не препарат.
    const high = computeTierAdjustments({ DHT: 900 }, 'male');
    expect(high.addSubs).toEqual([]);
    expect(high.titrations).toEqual([]);
    expect(high.stopCourse).toBe(false);
    expect(text({ DHT: 900 })).toContain('способ введения');
    expect(text({ DHT: 900 })).not.toContain('5-АРИ');

    // Низкая сторона: 5-АРИ объясняет снижение, простата не при чём.
    const low = text({ DHT: 100 });
    expect(low).toContain('5-АРИ');
    expect(low).not.toContain('ПСА');
    expect(computeTierAdjustments({ DHT: 50 }, 'male').stopCourse).toBe(false);
    expect(text({ DHT: 50 })).toContain('эндокринолог');

    // Норма — ни строки.
    expect(computeTierAdjustments({ DHT: 500 }, 'male').nutrition).toEqual([]);
  });

  it('мост механизмов читает ту же ВГН и ту же единицу', () => {
    const link = MARKER_TO_TZ_MECH.find(m => m.marker === 'DHT')!;
    expect(link.direction).toBe('up');
    expect(link.uln).toBe(DHT.uln);
    expect(link.lln).toBeUndefined();
    expect(getActivatedTzMechs({ DHT: 900 }).map(m => m.mechId)).toContain('rep4');
    expect(getActivatedTzMechs({ DHT: 500 })).toEqual([]);
  });

  it('порог `lab-marker-map` и цели панелей — из шкалы, а не обрезки', () => {
    const entry = LAB_MARKER_MAP.find(m => m.marker === 'DHT')!;
    expect(entry.defaultValue).toBe(DHT.uln);
    expect(entry.unit).toBe('пг/мл');

    for (const panel of PROBLEM_PANELS) {
      for (const marker of panel.markers) {
        if (marker.code !== 'DHT') continue;
        expect(marker.target, `${panel.id}: цель ДГТ не из шкалы`).toBe(`${DHT_BAND.low}–${DHT_BAND.high} пг/мл`);
      }
    }
  });
});
