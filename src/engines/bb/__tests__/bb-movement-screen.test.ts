import { describe, it, expect } from 'vitest';
import {
  resolveMovementDriver,
  singleLegVerdict,
  ohsFailCodes,
  movementDelta,
} from '../bb-movement-screen.engine';

const clean = {
  heelsFlat: true, kneeValgus: false, hipBelowParallel: true,
  trunkUpright: true, armsOverMidfoot: true, lumbarNeutral: true,
};

describe('bb-movement-screen', () => {
  it('чистый паттерн — драйвера нет', () => {
    expect(resolveMovementDriver({ ...clean }).driver).toBe('none');
  });
  it('подпятка чинит — драйвер голеностоп с высокой уверенностью', () => {
    const r = resolveMovementDriver({ ...clean, heelsFlat: false, hipBelowParallel: false, heelRetest: 'better' });
    expect(r.driver).toBe('ankle');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it('knee-to-wall <9 без подпятки — тоже голеностоп', () => {
    const r = resolveMovementDriver({ ...clean, kneeToWallCm: 7, kneeValgus: true });
    expect(r.driver).toBe('ankle');
  });
  it('вальгус при плоских пятках и норме голеностопа — ТБС', () => {
    const r = resolveMovementDriver({ ...clean, kneeValgus: true, kneeToWallCm: 13 });
    expect(r.driver).toBe('hip');
  });
  it('нет глубины при плоских пятках — ТБС', () => {
    const r = resolveMovementDriver({ ...clean, hipBelowParallel: false, kneeToWallCm: 14 });
    expect(r.driver).toBe('hip');
  });
  it('руки падают + руки на бёдрах чистят — плечо/широчайшие', () => {
    const r = resolveMovementDriver({ ...clean, armsOverMidfoot: false, handsOnHipsBetter: true });
    expect(r.driver).toBe('shoulder');
  });
  it('руки падают без признака широчайших — грудной', () => {
    const r = resolveMovementDriver({ ...clean, armsOverMidfoot: false, lumbarNeutral: true });
    expect(r.driver).toBe('thoracic');
  });
  it('гуляет поясница при чистых руках/ногах — кор', () => {
    const r = resolveMovementDriver({ ...clean, lumbarNeutral: false });
    expect(r.driver).toBe('core');
  });
  it('односторонний: слабее левая', () => {
    const v = singleLegVerdict({ splitSquatL: 'fail', splitSquatR: 'pass', rdlL: 'fail', rdlR: 'pass' });
    expect(v.weakSide).toBe('left');
    expect(v.text).toMatch(/левая/);
  });
  it('односторонний: обе чистые — null', () => {
    expect(singleLegVerdict({ splitSquatL: 'pass', splitSquatR: 'pass', rdlL: 'pass', rdlR: 'pass' }).weakSide).toBeNull();
  });
  it('коды провалов OHS: 6 сегментов', () => {
    const codes = ohsFailCodes({ heelsFlat: false, kneeValgus: true, hipBelowParallel: false, trunkUpright: true, armsOverMidfoot: true, lumbarNeutral: true });
    expect(codes).toEqual(expect.arrayContaining(['heels', 'valgus', 'depth']));
  });
  it('дельта: без снимка — честная строка', () => {
    expect(movementDelta(null, ['heels']).text).toMatch(/Первый снимок/);
  });
  it('дельта: чинит и регрессирует', () => {
    const d = movementDelta({ date: '2026-08-01', fails: ['heels', 'valgus'] }, ['valgus', 'arms']);
    expect(d.fixed).toEqual(['heels']);
    expect(d.regressed).toEqual(['arms']);
    expect(d.text).toMatch(/исправлено heels/);
  });
});
