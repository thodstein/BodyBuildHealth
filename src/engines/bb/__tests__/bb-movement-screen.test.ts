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
  it('КТС L/R: худшая решает + асимметрия ≥2 см в тексте', () => {
    const r = resolveMovementDriver({ ...clean, kneeToWallL: 6, kneeToWallR: 13, kneeValgus: true });
    expect(r.driver).toBe('ankle');
    expect(r.fix).toMatch(/асимметрия/);
  });
  it('КТС legacy-значение работает как обе стороны', () => {
    const r = resolveMovementDriver({ ...clean, kneeToWallCm: 6, kneeValgus: true });
    expect(r.driver).toBe('ankle');
  });
  it('чистый паттерн + разрыв КТС ≥2 — слабый ankle-драйвер асимметрии', () => {
    const r = resolveMovementDriver({ ...clean, kneeToWallL: 8, kneeToWallR: 13 });
    expect(r.driver).toBe('ankle');
    expect(r.label).toMatch(/асимметрия/);
    expect(r.confidence).toBeLessThan(0.7);
  });
  it('разрыв КТС <2 — тихо', () => {
    expect(resolveMovementDriver({ ...clean, kneeToWallL: 11, kneeToWallR: 12 }).driver).toBe('none');
  });
  it('коды провалов ловят ankle_asym', () => {
    expect(ohsFailCodes({ ...clean, kneeToWallL: 8, kneeToWallR: 13 } as any)).toContain('ankle_asym');
  });
  it('хип-фикс — комплексный (ягодица + дистально + 8 нед)', () => {
    const r = resolveMovementDriver({ ...clean, kneeValgus: true, kneeToWallCm: 13 });
    expect(r.fix).toMatch(/8 нед/);
    expect(r.fix).toMatch(/дистально/);
  });
  it('гонометр <35° + наклон корпуса — драйвер голеностоп', () => {
    const r = resolveMovementDriver({ ...clean, ankleDeg: 28, trunkUpright: false });
    expect(r.driver).toBe('ankle');
  });
  it('изолированный гонометр без видимых компенсаций — не драйвер (честно)', () => {
    expect(resolveMovementDriver({ ...clean, ankleDeg: 28 }).driver).toBe('none');
  });
  it('гонометр в норме не ломает чистый паттерн', () => {
    expect(resolveMovementDriver({ ...clean, ankleDeg: 38 }).driver).toBe('none');
  });
  it('FPPA tiebreak: качественная чистая, разрыв ≥10° — слабая сторона угломером', () => {
    const v = singleLegVerdict({ splitSquatL: 'pass', splitSquatR: 'pass', rdlL: 'pass', rdlR: 'pass', fppaL: 18, fppaR: 6 });
    expect(v.weakSide).toBe('left');
    expect(v.text).toMatch(/угломер/);
  });
  it('FPPA: разрыв <10° — тихо', () => {
    const v = singleLegVerdict({ splitSquatL: 'pass', splitSquatR: 'pass', rdlL: null, rdlR: null, fppaL: 12, fppaR: 6 });
    expect(v.weakSide).toBeNull();
  });
  it('FPPA не перебивает качественный провал', () => {
    const v = singleLegVerdict({ splitSquatL: 'fail', splitSquatR: 'pass', rdlL: null, rdlR: null, fppaL: 5, fppaR: 20 });
    expect(v.weakSide).toBe('left');
    expect(v.text).not.toMatch(/угломер/);
  });
});
