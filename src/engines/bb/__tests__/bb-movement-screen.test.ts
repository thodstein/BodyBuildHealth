import { describe, it, expect } from 'vitest';
import {
  resolveMovementDriver,
  singleLegVerdict,
  ohsFailCodes,
  movementDelta,
  v3FailCodes,
  screenPriorityList,
  teenLoadedGate,
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

describe('bb-movement R4 — гастрокнемиус/камбаловидная, бедро, таз', () => {
  it('КТС прямым коленом <9 при согнутом ок — локус гастрокнемиус', () => {
    const r = resolveMovementDriver({ ...clean, ktwStraightL: 7, ktwStraightR: 8, kneeToWallL: 12, kneeToWallR: 12, kneeValgus: true });
    expect(r.driver).toBe('ankle');
    expect(r.label).toMatch(/гастрокнемиус/);
    expect(r.fix).toMatch(/растяжка икры/);
  });
  it('КТС согнутым <9 при прямом ок — локус камбаловидная/талус', () => {
    const r = resolveMovementDriver({ ...clean, kneeToWallL: 7, kneeToWallR: 8, ktwStraightL: 12, ktwStraightR: 13, kneeValgus: true });
    expect(r.label).toMatch(/камбаловидн/);
  });
  it('оба канала <9 — общий голеностоп (без ложного локуса)', () => {
    const r = resolveMovementDriver({ ...clean, kneeToWallL: 7, kneeToWallR: 7, ktwStraightL: 7, ktwStraightR: 7, kneeValgus: true });
    expect(r.label).toMatch(/гастрокнемиус \+ камбаловидная/);
  });
  it('сгибание бедра <110 — ТБС-ветка с ROM-фиксом', () => {
    const r = resolveMovementDriver({ ...clean, hipFlexionDeg: 95 });
    expect(r.driver).toBe('hip');
    expect(r.label).toMatch(/сгибание бедра/);
    expect(r.fix).toMatch(/hip-flexor/);
  });
  it('сгибание бедра ≥110 не создаёт драйвер', () => {
    expect(resolveMovementDriver({ ...clean, hipFlexionDeg: 125 }).driver).toBe('none');
  });
  it('«подворот» таза при чистом паттерне — слабый hip-драйвер (ФАИ-предупреждение)', () => {
    const r = resolveMovementDriver({ ...clean, ppTilt: true });
    expect(r.driver).toBe('hip');
    expect(r.confidence).toBeLessThan(0.6);
    expect(r.fix).toMatch(/ФАИ/);
  });
  it('«подворот» в вальгус-ветке — нота в фиксе', () => {
    const r = resolveMovementDriver({ ...clean, kneeValgus: true, ppTilt: true });
    expect(r.driver).toBe('hip');
    expect(r.fix).toMatch(/подворот|нейтрали/);
  });
  it('ohsFailCodes ловит ppt, без ppt — тихо', () => {
    expect(ohsFailCodes({ ...clean, ppTilt: true })).toContain('ppt');
    expect(ohsFailCodes({ ...clean })).not.toContain('ppt');
  });
  it('асимметрия прямого колена ≥2 — в тексте асимметрии', () => {
    const r = resolveMovementDriver({ ...clean, ktwStraightL: 7, ktwStraightR: 12 });
    expect(r.driver).toBe('ankle');
    expect(r.fix).toMatch(/прям\. колена/);
  });
});

describe('bb-movement R7 — v3-коды и приоритет', () => {
  it('v3FailCodes: коды по каждому сигналу', () => {
    const codes = v3FailCodes({
      benchLevel: 'fix', nheAsymReps: 3, addAsymPct: 12, painLevel: 'red',
      hipFlexionDeg: 95, ppTilt: true, loadedHingeDegraded: true, erIrRatio: 0.6,
    });
    expect(codes).toEqual(['bench-fix', 'nhe-asym', 'add-asym', 'pm-red', 'hip-flex', 'ppt', 'hng-degraded', 'erir-low']);
  });
  it('v3FailCodes: watch-жим и жёлтая боль; чисто — пусто', () => {
    expect(v3FailCodes({ benchLevel: 'watch', painLevel: 'yellow' })).toEqual(['bench-watch', 'pm-yellow']);
    expect(v3FailCodes({ benchLevel: 'ok', nheAsymReps: 1, addAsymPct: 5, painLevel: 'green', hipFlexionDeg: 120, erIrRatio: 0.9 })).toEqual([]);
    expect(v3FailCodes(null)).toEqual([]);
  });
  it('дельта v:2 → v3-код = новый трекинг, D1–D5 = регресс', () => {
    const d = movementDelta({ date: '2026-09-01', fails: ['heels'], v: 2 }, ['heels', 'sh-thoracic', 'bench-fix']);
    expect(d.tracked).toEqual(['bench-fix']);
    expect(d.regressed).toEqual(['sh-thoracic']);
  });
  it('дельта legacy → и D1–D5, и v3-коды = новый трекинг', () => {
    const d = movementDelta({ date: '2026-08-01', fails: ['heels'] }, ['sh-thoracic', 'pm-red']);
    expect(d.tracked).toEqual(['sh-thoracic', 'pm-red']);
    expect(d.regressed).toEqual([]);
  });
  it('дельта v:3 — новые коды честный регресс', () => {
    const d = movementDelta({ date: '2026-09-10', fails: ['bench-watch'], v: 3 }, ['bench-watch', 'erir-low']);
    expect(d.regressed).toEqual(['erir-low']);
    expect(d.tracked).toEqual([]);
  });
  it('teenLoadedGate: 14–15 блокирует, взрослый/нет возраста — нет', () => {
    expect(teenLoadedGate(14).blocked).toBe(true);
    expect(teenLoadedGate(15).blocked).toBe(true);
    expect(teenLoadedGate(16).blocked).toBe(false);
    expect(teenLoadedGate(null).blocked).toBe(false);
    expect(teenLoadedGate(14).note).toMatch(/14–15/);
  });
  it('screenPriorityList: красная боль → драйвер → асимметрии (порядок и кап 5)', () => {
    const list = screenPriorityList({
      painLevel: 'red',
      painText: 'Боль [Плечо]: красный',
      driver: { driver: 'ankle', label: 'Голеностоп (дорсифлексия)', fix: 'мобилизация', confidence: 0.7 },
      asymText: 'Асимметрии: YBT-anterior 5 см (>4)',
      bench: { level: 'fix', text: 'хват 1.8 BAW' },
      posterior: { nhe: 'NHE: 3 повтора — слабо', adductor: null },
      loadedHinge: { degraded: true, text: 'поясница уходит' },
      erIr: 'ER/IR 0.62 (<0.75): ротация',
      tendon: { level: 'stop', text: 'Локоть: стоп' },
    });
    expect(list.length).toBe(5);
    expect(list[0]).toMatch(/^1\. Боль/);
    expect(list[1]).toMatch(/^2\. Голеностоп/);
    expect(list[2]).toMatch(/^3\. Асимметрии/);
    expect(list[3]).toMatch(/Сухожилия/);
  });
  it('screenPriorityList: драйвер ниже порога (0.4) не приоритет; пусто — честная строка', () => {
    const list = screenPriorityList({
      driver: { driver: 'hip', label: 'ТБС', fix: 'f', confidence: 0.4 },
      asymText: 'Асимметрии: значимых нет — работаем по драйверу',
      posterior: { nhe: 'NHE: эксцентрик в порядке (6)', adductor: 'Аддукторы: не замерялись' },
    });
    expect(list).toEqual(['Приоритетов нет: паттерн чистый — поддерживающий объём и перепроверка 6–8 нед']);
  });
});
