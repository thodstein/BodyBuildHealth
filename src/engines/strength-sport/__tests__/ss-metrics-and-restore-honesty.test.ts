/**
 * Wave-0 Э0.4/Э0.7 — честность показателей, которые выглядят как измерения.
 *
 * 1) yMax: раньше UI рисовал «⚠» перед ЛЮБЫМ вердиктом, включая «в норме весовой».
 *    Теперь глиф выбирается по зоне (`ymaxZone`), сам текст `ymaxVerdict` не изменён.
 * 2) SM restore: бэкап без восстановления — односторонняя функция; `restoreSMBackup`
 *    обязан реально вернуть ключи, а UI — перечитать состояние хаба.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ymaxVerdict, ymaxNormForBodyweight, ymaxZone } from '../strength-sport-ta-norms.engine';
import { buildSMBackup, restoreSMBackup, isSMBackupShape } from '../strength-sport-sm-storage.engine';

describe('Wave-0 Э0.7: yMax — глиф соответствует зоне, а не всегда «⚠»', () => {
  it('норма по весовой/полу: мужчины тяжелее → выше коридор', () => {
    const light = ymaxNormForBodyweight(70, 'male')!;
    const heavy = ymaxNormForBodyweight(100, 'male')!;
    expect(heavy.lo).toBeGreaterThan(light.lo);
    // женщины того же веса — ниже (отдельная лестница)
    expect(ymaxNormForBodyweight(64, 'female')!.hi).toBeLessThan(ymaxNormForBodyweight(100, 'male')!.hi);
  });

  it('зоны: ok внутри коридора, low/high по краям, noData без данных', () => {
    const n = ymaxNormForBodyweight(80, 'male')!;
    const mid = Math.round((n.lo + n.hi) / 2);
    expect(ymaxZone(mid, 80, 'male')).toBe('ok');
    expect(ymaxZone(n.lo - 12, 80, 'male')).toBe('low');
    expect(ymaxZone(n.hi + 12, 80, 'male')).toBe('high');
    // без веса / без измерения / мусор — не выдумываем зону
    expect(ymaxZone(mid, null, 'male')).toBe('noData');
    expect(ymaxZone(NaN, 80, 'male')).toBe('noData');
    expect(ymaxZone(0, 80, 'male')).toBe('noData');
  });

  it('вердикт и зона согласованы: «в норме весовой» ⇒ зона ok', () => {
    const n = ymaxNormForBodyweight(80, 'male')!;
    const mid = Math.round((n.lo + n.hi) / 2);
    expect(ymaxVerdict(mid, 80, 'male')).toContain('в норме весовой');
    expect(ymaxZone(mid, 80, 'male')).toBe('ok');

    const low = ymaxVerdict(n.lo - 12, 80, 'male')!;
    expect(low).toContain('низко');
    expect(ymaxZone(n.lo - 12, 80, 'male')).toBe('low');

    const high = ymaxVerdict(n.hi + 12, 80, 'male')!;
    expect(high).toContain('высоко');
    expect(ymaxZone(n.hi + 12, 80, 'male')).toBe('high');
  });
});

describe('Wave-0 Э0.4: SM-бэкап восстанавливается (не односторонний)', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it('build → restore возвращает ключи хаба', () => {
    localStorage.setItem('he_sm_progress_hist_v1', JSON.stringify([{ date: '2026-09-01', bodyweightKg: 90 }]));
    const backup = buildSMBackup();
    expect(isSMBackupShape(backup)).toBe(true);

    localStorage.clear();
    expect(localStorage.getItem('he_sm_progress_hist_v1')).toBeNull();

    const res = restoreSMBackup(backup);
    expect(res.restored).toContain('he_sm_progress_hist_v1');
    expect(res.failed).toEqual([]);
    expect(JSON.parse(localStorage.getItem('he_sm_progress_hist_v1') || '[]')).toHaveLength(1);
  });

  it('восстановление чинит запись внутри хаба (здесь — зеркало STORAGE_KEY в UI)', () => {
    const HUB_KEY = 'he_strongman_diagnostics_hub_v1';
    const snapshot = { yokeKg: '140', stoneKg: '180' };
    localStorage.setItem(HUB_KEY, JSON.stringify(snapshot));
    const backup = buildSMBackup();
    localStorage.clear();
    expect(localStorage.getItem(HUB_KEY)).toBeNull();

    const res = restoreSMBackup(backup);
    expect(res.restored).toContain(HUB_KEY);
    expect(JSON.parse(localStorage.getItem(HUB_KEY) || '{}')).toMatchObject(snapshot);
  });

  it('мусорный файл и пустой бэкап не «восстанавливаются» молча', () => {
    const bad = restoreSMBackup({ nope: 1 } as never);
    expect(bad.restored).toEqual([]);
    expect(bad.failed.length).toBeGreaterThan(0);

    const none = restoreSMBackup(buildSMBackup());
    expect(none.restored).toEqual([]);
  });

  it('isSMBackupShape отсекает мусор и принимает реальный бэкап', () => {
    expect(isSMBackupShape({ nope: 1 } as never)).toBe(false);
    expect(isSMBackupShape(null as never)).toBe(false);
    expect(isSMBackupShape(buildSMBackup())).toBe(true);
  });

  it('восстановление НЕ трогает ключи вне списка (обещание «чужие ключи не трогаем»)', () => {
    // he_lv_sm_v1 и he_grip_profile_v1 общие с армлифтингом, поэтому «всё начинается с he_sm_»
    // — неверный инвариант. Проверяем то, что реально обещано интерфейсом.
    const OTHER_HUB = 'he_bb_plan_saved';
    localStorage.setItem(OTHER_HUB, JSON.stringify({ keep: true }));

    localStorage.setItem('he_sm_progress_hist_v1', JSON.stringify([{ date: '2026-09-01' }]));
    const backup = buildSMBackup();
    localStorage.removeItem('he_sm_progress_hist_v1');

    restoreSMBackup(backup);
    // наш ключ вернулся
    expect(localStorage.getItem('he_sm_progress_hist_v1')).not.toBeNull();
    // чужой хаб не задет: restore не является «восстановить всё подряд»
    expect(JSON.parse(localStorage.getItem(OTHER_HUB) || '{}')).toEqual({ keep: true });
  });
});
