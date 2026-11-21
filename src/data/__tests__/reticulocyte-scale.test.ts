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
import { readLabInUnit, unitsIncommensurable, reticulocytePercentFromAbsolute } from '../../core/labs-mapping';
import { LAB_TIERS, deriveTier, getLabEntry, tierMarkerKey } from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { RETIC_BAND, getLabNorm } from '../../engines/lab-norms.engine';
import { flatLabUnit, readFlatLabs } from '../../engines/support-plan/engine-helpers';
import { LAB_MARKER_MAP, getCorrectionIds } from '../lab-marker-map';
import { PROBLEM_PANELS } from '../labs-problem-panels';
import { MECH_LAB_MARKERS, getMiLabStep, clinicalFloorsForLabs } from '../../engines/risk-engine-tz-spec';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { computeMarkerDeviations } from '../../ui/screens/LabsScreen_parts/lab-marker-risks';

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

/**
 * Проход 195: место ретикулоцитов в контуре.
 *
 * Соблазн «добавить в главную модель» выглядит логично: анализ есть в каталоге,
 * ступени и советы готовы. Но `hem1` — эритроцитоз (HCT/HGB/RBC), а высокие
 * ретикулоциты означают усиленный эритропоэз: кровопотеря, гемолиз, ответ на
 * лечение. Это другое состояние, и своей лестницы у него нет. Добавление кода в
 * `MECH_LAB_MARKERS` без ветки в `switch` дало бы `measured > 0` при
 * `step: null` — индекс назвал бы анализ учтённым, не сумев его судить.
 *
 * Поэтому проверяется не «анализ в модели», а честная граница:
 *  - в разборе густой крови есть строка с нормой обоих полов из `RETIC_BAND` —
 *    без смыслов и без пересказа советов правил ступеней (один анализ — один
 *    совет);
 *  - механизм-модель ретикулоциты не судит: ни одного кода в `MECH_LAB_MARKERS`,
 *    ни одной ступени, ни клинического floor, ни вклада в системный риск;
 *  - при этом анализ не исчезает: экран отклонений называет его по норме
 *    каталога (и не выдаёт 10⁹/л за проценты).
 */
describe('проход 195: ретикулоциты — строка разбора без лестницы модели', () => {
  const panel = PROBLEM_PANELS.find((p) => p.id === 'polycythemia_workup')!;
  const row = () => panel.markers.find((m) => m.code === 'RETICULOCYTES')!;

  it('разбор густой крови заказывает анализ с нормой обоих полов', () => {
    expect(row()).toBeDefined();
    expect(row().target).toContain(`${RETIC_BAND.low}–${RETIC_BAND.high}%`);
    expect(row().target).toContain(`♀ ${RETIC_BAND.femaleLow}–${RETIC_BAND.femaleHigh}%`);
    // Числа — из каталога, а не своя копия: та же пара, что у нормы.
    expect(RETIC.lln).toBe(RETIC_BAND.low);
    expect(RETIC.uln).toBe(RETIC_BAND.high);
  });

  it('строка не пересказывает советы ступеней — совет один', () => {
    // Смыслов у строки нет: толкование и действия — только в правилах ступеней.
    expect(row().highMeaning).toBeUndefined();
    expect(row().lowMeaning).toBeUndefined();

    // Советы реально выдаются правилами (иначе проверка ниже была бы пустой)…
    const advice = [0.1, 0.7, 3, 5].flatMap((v) =>
      computeTierAdjustments({ RETICULOCYTES: v }, 'male').nutrition.map((n) => ({ action: n.action, target: n.target })),
    );
    expect(advice.length).toBeGreaterThan(0);

    // …и ни один из них не повторён в строке панели.
    const rowText = JSON.stringify(row()).toLowerCase();
    for (const { action, target } of advice) {
      expect(rowText, action).not.toContain(action.toLowerCase());
      if (target.length > 12) expect(rowText, target).not.toContain(target.toLowerCase());
    }
  });

  it('механизм-модель ретикулоциты не читает — и это явно', () => {
    const readByModel = Object.entries(MECH_LAB_MARKERS)
      .filter(([, codes]) => codes.includes('RETICULOCYTES'))
      .map(([mech]) => mech);
    expect(readByModel).toEqual([]);
    // Эритроцитоз по-прежнему судится четырьмя маркерами, без нового кода.
    expect(MECH_LAB_MARKERS.hem1).toEqual(['HCT', 'HGB', 'RBC', 'WBC']);

    // Ни одна ступень не берётся из ретикулоцитов: измерен только он — ступени нет.
    for (const mech of Object.keys(MECH_LAB_MARKERS)) {
      expect(getMiLabStep(mech, { RETICULOCYTES: 10 }), mech).toBeUndefined();
    }
    // И клинического floor «повышенные ретикулоциты» тоже нет.
    expect(clinicalFloorsForLabs({ RETICULOCYTES: 10 }, 'male')).toEqual([]);
  });

  it('системный риск не получает выдуманного веса', () => {
    const res = calculateRiskFromAnalyses(
      [{ code: 'RETICULOCYTES', value: 6, unit: '%' }] as never,
      'male',
    );
    const contributions = Object.values(res.systemContributions);
    expect(contributions.length).toBeGreaterThan(0);
    expect(contributions.every((v) => v === 0)).toBe(true);
    expect(res.boundUnproven ?? []).toEqual([]);
  });

  it('но экран отклонений анализ называет, а не молчит', () => {
    const high = computeMarkerDeviations([{ code: 'RETICULOCYTES', value: 3, unit: '%' }], 'male');
    expect(high.markerDeviations.map((d) => d.code)).toEqual(['RETICULOCYTES']);
    expect(high.markerDeviations[0].side).toBe('high');
    expect(high.unknownCount).toBe(0);

    // 2.0 % — норма женщины и грань у мужчины: пол решает, а не «выше нормы».
    expect(computeMarkerDeviations([{ code: 'RETICULOCYTES', value: 2.0, unit: '%' }], 'female').normalCount).toBe(1);
    expect(computeMarkerDeviations([{ code: 'RETICULOCYTES', value: 2.0, unit: '%' }], 'male').markerDeviations).toHaveLength(1);

    // Абсолютное число в 10⁹/л — «единица не та», а не проценты.
    const absolute = computeMarkerDeviations([{ code: 'RETICULOCYTES', value: 50, unit: '10⁹/л' }], 'male');
    expect(absolute.markerDeviations).toEqual([]);
    expect(absolute.unknown).toEqual([{ code: 'RETICULOCYTES', value: 50, reason: 'unit' }]);
  });
});

/**
 * Проход 197: абсолютное число в проценты переводится только парой из одного
 * бланка. Формула стандартная (`% = RET# / (RBC × 10)`), но живёт в одном месте
 * (`reticulocytePercentFromAbsolute`), чтобы импорт и гард считали одинаково.
 * Нечем считать — `null`, а не «ноль» и не число «как есть».
 */
describe('проход 197: ретикулоциты — абсолютное число и эритроциты одного бланка', () => {
  it('формула: 50 ×10⁹/л при RBC 5.0 ×10¹²/л — 1 %', () => {
    expect(reticulocytePercentFromAbsolute(50, '10⁹/л', 5.0, '10¹²/л')).toBe(1);
    expect(reticulocytePercentFromAbsolute(60, '10^9/L', 5.0, '10^12/L')).toBe(1.2);
  });

  it('та же величина в другом написании единицы — то же число', () => {
    // 10⁶/мкл — это 10¹²/л; запись не должна зависеть от написания.
    expect(reticulocytePercentFromAbsolute(50, '10⁹/л', 5, '10⁶/мкл')).toBe(1);
  });

  it('нет пары или пара невозможна — пересчёта нет', () => {
    expect(reticulocytePercentFromAbsolute(50, '10⁹/л', 0, '10¹²/л')).toBeNull();
    expect(reticulocytePercentFromAbsolute(50, '10⁹/л', 5, '')).toBeNull();
    expect(reticulocytePercentFromAbsolute(50, '%', 5, '10¹²/л')).toBeNull();
    expect(reticulocytePercentFromAbsolute(Number.NaN, '10⁹/л', 5, '10¹²/л')).toBeNull();
    // Доля целого больше целого — уже не результат анализа.
    expect(reticulocytePercentFromAbsolute(6000, '10⁹/л', 5, '10¹²/л')).toBeNull();
  });
});
