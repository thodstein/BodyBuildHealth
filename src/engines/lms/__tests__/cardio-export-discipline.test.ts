/**
 * cardio-export-discipline.test.ts — спринт 5.3: экспорт цикла несёт ДИСЦИПЛИНУ.
 *
 * Дефект (реальный, достижимый): `buildCardioTcx` писал `Sport="Biking"` для
 * КАЖДОЙ сессии — беговой цикл выгружался в Garmin Connect как заезд.
 * `buildCardioZwo` был мягче, но врёл так же: `some(equipment==='running') ?
 * 'run' : 'bike'` → гребля/плавание/ходьба тоже становились велотренировкой.
 *
 * Данные для этого есть (session.equipment, cycle.config.equipment) и уже
 * использовались в ICS через cardioEquipmentLabel — экспорт их просто игнорировал.
 *
 * Контракт: вид спорта = по дисциплине; неизвестно → честный 'Other'/'other',
 * а не выдуманный 'Biking'.
 */
import { describe, it, expect } from 'vitest';
import { buildCardioCycle, buildCardioTcx, buildCardioZwo, tcxSportForSession } from '../cardio.engine';
import type { CardioCycle, CardioSession } from '../cardio-cycle-types.engine';
import { CARDIO_CYCLES } from '../../../data/cardio-cycles/cardio-cycle-index';

/** Минимальный цикл нужной дисциплины: одна сессия с equipment. */
function cycleWith(equipment: CardioSession['equipment'] | undefined): CardioCycle {
  const c = buildCardioCycle({ goal: 'health', totalWeeks: 1, id: 'exp-1', daysAvailable: 3, startDate: '2026-01-05' });
  const s = c.weeks[0].sessions[0];
  if (equipment === undefined) delete s.equipment; else s.equipment = equipment;
  return c;
}

describe('Экспорт цикла несёт дисциплину', () => {
  it('TCX: бег → Running, гребля → Rowing, вело → Biking', () => {
    expect(buildCardioTcx(cycleWith('running'))).toContain('Sport="Running"');
    expect(buildCardioTcx(cycleWith('rowing'))).toContain('Sport="Rowing"');
    expect(buildCardioTcx(cycleWith('cycling'))).toContain('Sport="Biking"');
  });

  it('TCX: дисциплина цикла достаётся из config, когда у сессии её нет', () => {
    const c = buildCardioCycle({
      goal: 'health', totalWeeks: 1, id: 'exp-cfg', daysAvailable: 3,
      startDate: '2026-01-05', equipment: ['rowing'],
    });
    expect(buildCardioTcx(c)).toContain('Sport="Rowing"');
  });

  it('TCX: без дисциплины — честный Other, а не Biking', () => {
    // Раньше здесь был Biking: цикл без equipment объявлялся велотренировкой.
    const tcx = buildCardioTcx(cycleWith(undefined));
    expect(tcx).toContain('Sport="Other"');
    expect(tcx).not.toContain('Sport="Biking"');
  });

  it('tcxSportForSession: сессия важнее дисциплины цикла', () => {
    const c = buildCardioCycle({
      goal: 'health', totalWeeks: 1, id: 'exp-mix', daysAvailable: 3,
      startDate: '2026-01-05', equipment: ['running'],
    });
    const s = c.weeks[0].sessions[0];
    s.equipment = 'swimming';
    expect(tcxSportForSession(s, c)).toBe('Swimming');
    delete s.equipment;
    expect(tcxSportForSession(s, c)).toBe('Running');   // fallback на цикл
  });

  it('весь каталог: вид спорта соответствует заявленной дисциплине', () => {
    // Данными, а не двумя ручными циклами: каждый шаблон каталога прогоняем
    // через настоящий билдер с его собственной дисциплиной (путь пользователя:
    // выбрал шаблон → собрал цикл → выгрузил).
    const expected: Record<string, string> = {
      running: 'Running', cycling: 'Biking', rowing: 'Rowing',
      elliptical: 'Elliptical', walking: 'Walking', swimming: 'Swimming',
    };
    const checked: Record<string, number> = {};
    for (const tpl of CARDIO_CYCLES) {
      const eq = tpl.preset.equipment?.[0];
      if (!eq || !expected[eq]) continue;
      const c = buildCardioCycle({ ...tpl.preset, id: tpl.id, startDate: '2026-01-05' });
      expect(buildCardioTcx(c)).toContain(`Sport="${expected[eq]}"`);
      checked[eq] = (checked[eq] ?? 0) + 1;
    }
    // Каталог не должен молча остаться непроверенным.
    expect(Object.keys(checked).length).toBeGreaterThan(1);
    expect(checked.rowing).toBeGreaterThan(0);   // гребля реально покрыта
    expect(checked.running).toBeGreaterThan(0);
  });

  it('ZWO: гребля — other, а не bike; бег/вело/плавание — свои виды', () => {
    expect(buildCardioZwo(cycleWith('running'))).toContain('<sportType>run</sportType>');
    expect(buildCardioZwo(cycleWith('cycling'))).toContain('<sportType>bike</sportType>');
    expect(buildCardioZwo(cycleWith('swimming'))).toContain('<sportType>swim</sportType>');
    const zwoRow = buildCardioZwo(cycleWith('rowing'));
    expect(zwoRow).toContain('<sportType>other</sportType>');
    expect(zwoRow).not.toContain('<sportType>bike</sportType>');
    // Файл сам объясняет, что это за дисциплина.
    expect(zwoRow).toContain('Гребля');
  });
});
