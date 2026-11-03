/**
 * pl-norms-bridge.test.ts — Фаза 6, п.2: нормативы/разряд/очки для сезона.
 *
 * Проверяем: тотал собирается ТОЛЬКО из соревновательных движений, разряд
 * берётся из справочника `pl-norms.engine` (никаких цифр «из головы»),
 * а неизвестная федерация не притворяется посчитанной.
 */
import { describe, expect, it } from 'vitest';
import { plNormsSnapshot } from '../pl-norms-bridge.engine';
import { getNormTable, classifyTotal } from '../../pl-norms.engine';

const pm = { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240, 'Тяга блока': 90 };

describe('plNormsSnapshot — мост PL-авто → нормативы', () => {
  it('тотал = только присед+жим+тяга (аксессуары не в счёт)', () => {
    const r = plNormsSnapshot({ fed: 'fpr', sex: 'male', bodyWeight: 83, plannedPm: pm });
    expect(r.total).toBe(580);
    expect(r.liftsFound).toBe(3);
    expect(r.federation).toBe('fpr_classic');
    expect(r.glPoints).toBeGreaterThan(0);
  });

  it('разряд считается по таблице справочника (тот же результат, что напрямую)', () => {
    const r = plNormsSnapshot({ fed: 'ipf', sex: 'male', bodyWeight: 83, plannedPm: pm });
    const table = getNormTable('fpr_classic', 'total', 'male')!;
    const direct = classifyTotal(table, 83, 580);
    expect(r.classification).not.toBeNull();
    expect(r.classification!.achievedLabel).toBe(direct.achievedLabel);
    expect(r.classification!.nextLabel).toBe(direct.nextLabel);
    expect(r.progressPct).toBeGreaterThanOrEqual(0);
    expect(r.progressPct).toBeLessThanOrEqual(100);
    expect(r.note).toMatch(/Сверяйте с официальной таблицей/);
  });

  it('незнакомая федерация → разряд не считаем, но очки-ориентир есть', () => {
    const r = plNormsSnapshot({ fed: 'other', sex: 'male', bodyWeight: 83, plannedPm: pm });
    expect(r.federation).toBeNull();
    expect(r.classification).toBeNull();
    expect(r.glPoints).toBeGreaterThan(0);
    expect(r.note).toMatch(/нет/);
  });

  it('пустые ПМ → честная подсказка, без нулевого «разряда»', () => {
    const r = plNormsSnapshot({ fed: 'fpr', sex: 'male', bodyWeight: 83, plannedPm: {} });
    expect(r.total).toBe(0);
    expect(r.classification).toBeNull();
    expect(r.glPoints).toBe(0);
    expect(r.note).toMatch(/Заполните целевые ПМ/);
  });

  it('неполный тотал (только присед+жим) честно помечен', () => {
    const r = plNormsSnapshot({ fed: 'fpr', sex: 'male', bodyWeight: 83, plannedPm: { 'Присед': 200, 'Жим лежа': 140 } });
    expect(r.total).toBe(340);
    expect(r.liftsFound).toBe(2);
    expect(r.note).toMatch(/Тотал неполный/);
  });

  it('женская таблица WRPF отсутствует → разряд не считаем (без выдуманных порогов)', () => {
    const r = plNormsSnapshot({ fed: 'wpc', sex: 'female', bodyWeight: 63, plannedPm: { 'Присед': 120, 'Жим лежа': 70, 'Становая тяга': 150 } });
    expect(r.federation).toBe('wrpf_untested');
    expect(r.classification).toBeNull();
    expect(r.glPoints).toBeGreaterThan(0);
    expect(r.note).toMatch(/нет/);
  });

  it('экипировка (Фаза 6, п.3): у ФПР другая таблица, коэффициенты GL для экипировки строже', () => {
    const classic = plNormsSnapshot({ fed: 'fpr', sex: 'male', bodyWeight: 83, plannedPm: pm, gear: 'classic' });
    const single = plNormsSnapshot({ fed: 'fpr', sex: 'male', bodyWeight: 83, plannedPm: pm, gear: 'single-ply' });
    const multi = plNormsSnapshot({ fed: 'fpr', sex: 'male', bodyWeight: 83, plannedPm: pm, gear: 'multi-ply' });
    expect(classic.federation).toBe('fpr_classic');
    expect(single.federation).toBe('fpr_equipped');
    expect(multi.federation).toBe('fpr_equipped');
    // Однослой и многослой делят коэффициенты GL (отдельных для многослоя нет).
    expect(single.glPoints).toBe(multi.glPoints);
    // ВАЖНО: экипировочные коэффициенты СТРОЖЕ — тот же тотал даёт МЕНЬШЕ очков
    // (экипированные атлеты поднимают больше; так устроена официальная формула).
    expect(single.glPoints).toBeLessThan(classic.glPoints);
    expect(single.note).toMatch(/Экипировка/);
    expect(classic.note).not.toMatch(/Экипировка/);
  });

  it('экипировка не выдумывает таблицу там, где её нет (WPC)', () => {
    const r = plNormsSnapshot({ fed: 'wpc', sex: 'male', bodyWeight: 83, plannedPm: pm, gear: 'multi-ply' });
    expect(r.federation).toBe('wrpf_untested');
    expect(r.classification).not.toBeNull();
    expect(r.glPoints).toBeGreaterThan(0);
  });
});
