/**
 * bb-audit-p3-ped-volume.test.ts — аудит 2026-11, P3-2 (ядро, остаток).
 *
 * «На курсе» — одно дозо-зависимое правило (`bb-ped-profile`), а не непустой список
 * `peds`: креатин в списке давал недельный бюджет ×2, MRV ×1.9–2.15 и кап сессии
 * «про на курсе» — план строился на объёме, которого у атлета нет.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeBBWeeklyBudget,
  computeMrvMult,
  computeRegimeMrvMult,
  sessionLimitsFor,
} from '../bb-volume.engine';
import { highVolumeDemandOf, onCourseOf, pedProfileOf } from '../bb-ped-profile';

describe('pedProfileOf — дозо-зависимый профиль', () => {
  it('AAS по имени и по порогу дозы 500 мг', () => {
    expect(pedProfileOf({ peds: ['AAS'] }).hasAAS).toBe(true);
    expect(pedProfileOf({ peds: ['тестостерон'] }).hasAAS).toBe(true);
    expect(pedProfileOf({ peds: [], pedDoses: { AAS: 499 } }).hasAAS).toBe(false);
    expect(pedProfileOf({ peds: [], pedDoses: { AAS: 500 } }).hasAAS).toBe(true);
  });

  it('GH и инсулин — по имени или ненулевой дозе', () => {
    expect(pedProfileOf({ peds: ['GH'] }).hasGH).toBe(true);
    expect(pedProfileOf({ peds: [], pedDoses: { GH: 4 } }).hasGH).toBe(true);
    expect(pedProfileOf({ peds: ['insulin'] }).hasIns).toBe(true);
    expect(pedProfileOf({ peds: [], pedDoses: { insulin: 10 } }).hasIns).toBe(true);
  });

  it('креатин и пустой список — не профиль', () => {
    expect(pedProfileOf({ peds: ['creatine'] })).toEqual({ hasAAS: false, hasGH: false, hasIns: false });
    expect(pedProfileOf({ peds: [] })).toEqual({ hasAAS: false, hasGH: false, hasIns: false });
    expect(highVolumeDemandOf({ level: 'advanced', peds: ['creatine'] })).toBe(false);
    expect(highVolumeDemandOf({ level: 'advanced', peds: ['AAS'] })).toBe(true);
    // enhanced — по уровню, даже без препаратов.
    expect(highVolumeDemandOf({ level: 'enhanced', peds: [] })).toBe(true);
  });

  it('onCourseOf: явный флаг сильнее профиля, профиль — только когда флаг не задан', () => {
    expect(onCourseOf({})).toBe(false);
    expect(onCourseOf({ onCourse: true })).toBe(true);
    // Креатин в списке — не профиль.
    expect(onCourseOf({ peds: ['creatine'] })).toBe(false);
    // Флаг не задан → решает профиль (прежнее `peds.length > 0`).
    expect(onCourseOf({ peds: ['AAS'] })).toBe(true);
    expect(onCourseOf({ peds: [], pedDoses: { AAS: 750 } })).toBe(true);
    // Явный флаг сильнее: атлет с профилем может быть ВНЕ курса (фаза off).
    expect(onCourseOf({ peds: ['AAS'], onCourse: false })).toBe(false);
    expect(onCourseOf({ peds: ['creatine'], onCourse: true })).toBe(true);
  });
});

describe('Объём читает то же правило: креатин больше не «курс»', () => {
  it('множитель режима: натурал/креатин ×1.0, реальный PED ×2.0', () => {
    expect(computeRegimeMrvMult({})).toBe(1.0);
    expect(computeRegimeMrvMult({ peds: [] })).toBe(1.0);
    expect(computeRegimeMrvMult({ peds: ['creatine'] })).toBe(1.0);
    expect(computeRegimeMrvMult({ peds: ['AAS'] })).toBe(2.0);
    expect(computeRegimeMrvMult({ peds: [], pedDoses: { AAS: 500 } })).toBe(2.0);
    expect(computeRegimeMrvMult({ peds: ['GH'] })).toBe(2.0);
    // Явный режим по-прежнему включает (интенсивность курса учитывается).
    expect(computeRegimeMrvMult({ onCourse: true })).toBe(2.0);
    expect(computeRegimeMrvMult({ peds: ['creatine'], onCourse: true })).toBe(2.0);
  });

  it('дозо-зависимый MRV: кривая работает только у реального профиля', () => {
    expect(computeMrvMult({ peds: ['creatine'] })).toBe(1.0);
    expect(computeMrvMult({ peds: ['AAS'], doseAwareMrv: 1.3 })).toBe(1.3);
    // Явное «не на курсе» игнорирует кривую (прежний сторож).
    expect(computeMrvMult({ onCourse: false, doseAwareMrv: 2.0 })).toBe(1.0);
  });

  it('недельный бюджет: натурал 112, курс 224, креатин — 112', () => {
    expect(computeBBWeeklyBudget({})).toBe(112);
    expect(computeBBWeeklyBudget({ peds: ['creatine'] })).toBe(112);
    expect(computeBBWeeklyBudget({ peds: ['AAS'] })).toBe(224);
    expect(computeBBWeeklyBudget({ peds: ['creatine'], onCourse: true })).toBe(224);
  });

  it('капы сессии: креатин даёт тир уровня, а не «про на курсе»', () => {
    const creatine = sessionLimitsFor({ level: 'advanced', trainingYears: 8, peds: ['creatine'] });
    const aas = sessionLimitsFor({ level: 'advanced', trainingYears: 8, peds: ['AAS'] });
    expect(creatine.maxWorkingSets).toBe(40);
    expect(creatine.maxExercises).toBe(15);
    expect(aas.maxWorkingSets).toBe(60);
    expect(aas.maxExercises).toBe(16);
    // Недельный бюджет тоже не удваивается креатином.
    expect(creatine.weeklyWorkingSets).toBe(112);
    expect(aas.weeklyWorkingSets).toBe(224);
  });
});

describe('Нет цикла импортов: правило живёт в отдельном модуле', () => {
  it('bb-volume не импортирует bb-selector (иначе цикл selector → volume)', () => {
    const src = readFileSync(resolve(__dirname, '..', 'bb-volume.engine.ts'), 'utf8');
    expect(src).not.toContain("from './bb-selector.engine'");
    expect(src).toContain("from './bb-ped-profile'");
  });

  it('селектор реэкспортирует то же правило (прежние импортёры не ломаются)', () => {
    const src = readFileSync(resolve(__dirname, '..', 'bb-selector.engine.ts'), 'utf8');
    expect(src).toContain("export { pedProfileOf, highVolumeDemandOf };");
    expect(src).toContain("from './bb-ped-profile'");
  });
});
