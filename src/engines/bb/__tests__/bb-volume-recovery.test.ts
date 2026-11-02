/**
 * bb-volume-recovery.test.ts — BB-G-01: панель «Объём · Recovery · Mobility».
 *
 * Локи: факт сравнивается с ориентирами по ПРЯМЫМ сетам, отсутствие данных —
 * «нет данных» (не ноль), ограничитель выбирается по приоритету (боль > сон >
 * ACWR > MRV > мобилити), советы выводятся только из измеренных данных.
 */
import { describe, it, expect } from 'vitest';
import { buildVolumeRecoveryPanel, vrMuscleLabel } from '../bb-volume-recovery.engine';

const base = {
  level: 'intermediate',
  factVolume: null,
  perMuscleAcwr: null,
  readiness: null,
  sleepHours: null,
  pain010: null,
  mobilityFails: 0,
  mobilityChecked: false,
};

describe('BB-G-01 панель «Объём · Recovery · Mobility»', () => {
  it('без дневника — «нет данных», а не нули и не зелёные галочки', () => {
    const p = buildVolumeRecoveryPanel(base);
    expect(p.hasVolume).toBe(false);
    expect(p.rows).toEqual([]);
    const mrv = p.chips.find((c) => c.id === 'mrv')!;
    expect(mrv.zone).toBe('nodata');
    expect(mrv.value).toBe('нет данных');
    const acwr = p.chips.find((c) => c.id === 'acwr')!;
    expect(acwr.zone).toBe('nodata');
    expect(acwr.detail).toMatch(/4 сессии/);
  });

  it('объём считается по ПРЯМЫМ сетам: косвенная нагрузка не закрывает MEV', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      // aggregateBBVolume: явно 4 прямых сета груди при 12 effective (косвенная)
      factVolume: { chest: { directSets: 4, effectiveSets: 12 } },
    });
    const row = p.rows.find((r) => r.group === 'chest')!;
    expect(row.sets).toBe(4);
    expect(row.status).toBe('below_mev'); // MEV груди = 8 на intermediate
  });

  it('превышение MRV — красный чип MRV + совет снять подходы', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      factVolume: { chest: { directSets: 24, effectiveSets: 30 } }, // MRV = 20
    });
    const row = p.rows.find((r) => r.group === 'chest')!;
    expect(row.status).toBe('exceeding_mrv');
    expect(row.over).toBe(4);
    expect(row.headroom).toBe(-4);
    const mrv = p.chips.find((c) => c.id === 'mrv')!;
    expect(mrv.zone).toBe('red');
    expect(mrv.value).toContain('24/20');
    expect(p.advice.join(' | ')).toMatch(/Снять 4 подх/);
  });

  it('ACWR опасный становится ограничителем и советует паузу по мышце', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      factVolume: { back: { directSets: 14 } },
      perMuscleAcwr: { back: { ratio: 1.7, zone: 'dangerous' }, chest: { ratio: 1.0, zone: 'optimal' } },
    });
    const acwr = p.chips.find((c) => c.id === 'acwr')!;
    expect(acwr.zone).toBe('red');
    expect(acwr.value).toContain('1.7');
    expect(p.limiter?.id).toBe('acwr');
    expect(p.advice.join(' | ')).toMatch(/без отказных/);
  });

  it('приоритет ограничителя: боль 8/10 важнее превышения MRV и сна 6.5 ч', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      factVolume: { quads: { directSets: 24 } },
      pain010: 8,
      sleepHours: 6.5,
    });
    expect(p.limiter?.id).toBe('pain');
    expect(p.limiter?.zone).toBe('red');
  });

  it('сон <6 ч — красный ограничитель, если боли нет', () => {
    const p = buildVolumeRecoveryPanel({ ...base, factVolume: { quads: { directSets: 12 } }, sleepHours: 5 });
    expect(p.limiter?.id).toBe('sleep');
    expect(p.chips.find((c) => c.id === 'limiter')!.zone).toBe('red');
  });

  it('ниже MEV у слабой зоны — совет добрать до MEV', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      factVolume: { chest: { directSets: 5 }, quads: { directSets: 14 } },
      weakZones: ['chest'],
    });
    expect(p.advice.join(' | ')).toMatch(/Добрать 3 подх\..*Грудь/);
  });

  it('ниже MEV у НЕ слабой зоны — совета нет (не путаем «нет приоритета» с «надо добрать»)', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      factVolume: { chest: { directSets: 5 } },
      weakZones: [],
    });
    expect(p.advice.join(' | ')).not.toMatch(/Добрать/);
  });

  it('мобилити: непроведённый скрининг — «не проверено», провалы — проваленные тесты', () => {
    const skipped = buildVolumeRecoveryPanel(base);
    expect(skipped.hasMobility).toBe(false);
    expect(skipped.chips.find((c) => c.id === 'mobility')!.value).toBe('не проверено');

    const done = buildVolumeRecoveryPanel({ ...base, mobilityChecked: true, mobilityFails: 2, factVolume: { quads: { directSets: 12 } } });
    const chip = done.chips.find((c) => c.id === 'mobility')!;
    expect(chip.zone).toBe('red');
    expect(done.limiter?.id).toBe('mobility');
  });

  it('готовность без измеренных каналов — «нет данных», а не «жёлтая»', () => {
    const p = buildVolumeRecoveryPanel({ ...base, readiness: { level: 'yellow', tested: false, noData: true } });
    const chip = p.chips.find((c) => c.id === 'readiness')!;
    expect(chip.zone).toBe('nodata');
    expect(chip.value).toBe('нет данных');
  });

  it('готовность красная с причинами — ограничитель и причины в чипе', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      readiness: { level: 'red', tested: true, reasons: ['Сон 4.5 ч', 'ACWR 1.8'] },
      factVolume: { back: { directSets: 12 } },
    });
    expect(p.chips.find((c) => c.id === 'readiness')!.detail).toContain('Сон 4.5 ч');
    expect(p.limiter?.id).toBe('readiness');
  });

  it('чипы идут в фиксированном порядке: готовность → ACWR → MRV → мобилити → ограничитель', () => {
    const p = buildVolumeRecoveryPanel(base);
    expect(p.chips.map((c) => c.id)).toEqual(['readiness', 'acwr', 'mrv', 'mobility', 'limiter']);
  });

  it('строки отсортированы: превышение MRV раньше оптимума, при равенстве — по доле MRV', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      factVolume: { chest: { directSets: 14 }, quads: { directSets: 18 }, back: { directSets: 24 }, biceps: { directSets: 9 } },
    });
    expect(p.rows[0].group).toBe('back'); // exceeding_mrv
    expect(p.rows[1].group).toBe('quads'); // approaching_mrv
    expect(p.rows[p.rows.length - 1].status === 'optimal' || p.rows[p.rows.length - 1].status === 'below_mev').toBe(true);
  });

  it('строки капятся по maxRows, но советы считаются по всем мышцам', () => {
    const p = buildVolumeRecoveryPanel({
      ...base,
      maxRows: 1,
      factVolume: { chest: { directSets: 24 }, quads: { directSets: 18 } },
    });
    expect(p.rows).toHaveLength(1);
    expect(p.advice.join(' | ')).toMatch(/Снять/);
  });

  it('vrMuscleLabel: гранулярная зона показывает родителя + уточнение', () => {
    expect(vrMuscleLabel('chest')).toBe('Грудь');
    expect(vrMuscleLabel('chest_upper')).toContain('Грудь');
    expect(vrMuscleLabel('chest_upper')).toContain('chest_upper');
  });
});
