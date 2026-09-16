import { describe, it, expect } from 'vitest';
import { shoulderWallVerdict, thoracicRotationVerdict } from '../bb-shoulder-screen.engine';
import { hingeVerdict, loadedSquatVerdict } from '../bb-hinge-screen.engine';
import { ybtLqVerdict, YBT_DISCLAIMER } from '../bb-ybt-lq.engine';
import { substitutesForDriver, asymPriority, asymPriorityText, SCREENING_DISCLAIMER } from '../bb-movement-to-plan.engine';
import { resolveBbDiagIntakeExtras } from '../bb-diag-intake.engine';

describe('bb-movement D1 плечо у стены', () => {
  it('чисто — pass', () => {
    const v = shoulderWallVerdict({ backOnWall: true, headOnWall: true, bicepsAtEars: true, ribsDown: true, noShrug: true });
    expect(v.pass).toBe(true);
    expect(v.locus).toBe('ok');
  });
  it('без позиции — невалиден, не локус', () => {
    const v = shoulderWallVerdict({ backOnWall: false, headOnWall: false, bicepsAtEars: false, ribsDown: false, noShrug: false });
    expect(v.locus).toBe('position');
    expect(v.text).toMatch(/невалиден/);
  });
  it('рёбра раздуваются — thoracic', () => {
    const v = shoulderWallVerdict({ backOnWall: true, headOnWall: true, bicepsAtEars: false, ribsDown: false, noShrug: true });
    expect(v.locus).toBe('thoracic');
  });
  it('бицепс не у ушей при спокойных рёбрах — lats', () => {
    const v = shoulderWallVerdict({ backOnWall: true, headOnWall: true, bicepsAtEars: false, ribsDown: true, noShrug: true });
    expect(v.locus).toBe('lats');
  });
  it('ротация: разрыв ≥10 — слабая сторона', () => {
    const v = thoracicRotationVerdict({ rotL: 38, rotR: 52 });
    expect(v.gap).toBe(14);
    expect(v.text).toMatch(/левая/);
  });
  it('ротация: обе <50 — ограничение', () => {
    expect(thoracicRotationVerdict({ rotL: 42, rotR: 44 }).low).toBe(true);
  });
  it('ротация: пусто — тихо', () => {
    expect(thoracicRotationVerdict({ rotL: null, rotR: null }).text).toMatch(/не замерялась/);
  });
});

describe('bb-movement D2 шарнир + нагрузка', () => {
  it('палка держится — чисто', () => {
    expect(hingeVerdict('full').pass).toBe(true);
  });
  it('поясница отрывается — lumbar-маршрут', () => {
    const v = hingeVerdict('lumbar_loss');
    expect(v.pass).toBe(false);
    expect(v.text).toMatch(/поясница/);
  });
  it('не проверялся — тихо', () => {
    expect(hingeVerdict(null).locus).toBe('not_tested');
  });
  it('плывёт под весом — деградация', () => {
    const v = loadedSquatVerdict({ bodyweight: 'pass', bar: 'pass', working: 'fail' });
    expect(v.degraded).toBe(true);
    expect(v.text).toMatch(/снизь/);
  });
  it('база нечиста — чинить паттерн, не вес', () => {
    expect(loadedSquatVerdict({ bodyweight: 'fail', bar: null, working: null }).text).toMatch(/паттерн/);
  });
  it('пусто — тихо', () => {
    expect(loadedSquatVerdict({ bodyweight: null, bar: null, working: null }).degraded).toBe(false);
  });
});

describe('bb-movement D3 YBT-LQ', () => {
  it('норма — тихо', () => {
    const v = ybtLqVerdict({ antL: 62, antR: 63, shinCm: 48 });
    expect(v.warn).toBe(false);
  });
  it('асимметрия >4 — warn + слабая', () => {
    const v = ybtLqVerdict({ antL: 58, antR: 64, shinCm: 48 });
    expect(v.warn).toBe(true);
    expect(v.text).toMatch(/левая/);
  });
  it('композит <94 — note', () => {
    const v = ybtLqVerdict({ antL: 40, antR: 41, shinCm: 48 });
    expect(v.warn).toBe(true);
    expect(v.text).toMatch(/композит/);
  });
  it('пусто — не замерялся', () => {
    expect(ybtLqVerdict({ antL: null, antR: null, shinCm: null }).tested).toBe(false);
  });
  it('дисклеймер честный (не прогноз)', () => {
    expect(YBT_DISCLAIMER).toMatch(/не прогноз/);
  });
});

describe('bb-movement D5 матрица + асимметрии', () => {
  it('каждый драйвер имеет замены (кроме none)', () => {
    for (const d of ['ankle', 'hip', 'thoracic', 'shoulder', 'core']) {
      const s = substitutesForDriver(d);
      expect(s.prefer.length).toBeGreaterThan(0);
      expect(s.note.length).toBeGreaterThan(0);
    }
  });
  it('неизвестный драйвер — none без краша', () => {
    expect(substitutesForDriver('мусор').prefer).toEqual([]);
  });
  it('приоритет: только значимые', () => {
    expect(asymPriority({ ktwGapCm: 1, fppaGapDeg: 5, ybtAsymCm: 2, rotGapDeg: 5 })).toEqual([]);
    const list = asymPriority({ ktwGapCm: 3, fppaGapDeg: 12, ybtAsymCm: 5, rotGapDeg: 4 });
    expect(list.length).toBe(3);
    expect(list[0]).toMatch(/голеностоп/);
  });
  it('текст пустого — работаем по драйверу', () => {
    expect(asymPriorityText({ ktwGapCm: null, fppaGapDeg: null, ybtAsymCm: null, rotGapDeg: null })).toMatch(/по драйверу/);
  });
  it('дисклеймер честный (AUC, не запрет)', () => {
    expect(SCREENING_DISCLAIMER).toMatch(/не прогноз/);
  });
});

describe('bb-movement D1–D5 intake extras', () => {
  it('плечо-провал и YBT-warn едут в bits, пусто — тихо', () => {
    const r = resolveBbDiagIntakeExtras({
      movementDriver: { label: 'Голеностоп', fix: 'пятка', driver: 'ankle', confidence: 0.7 },
      shoulder: { pass: false, locus: 'thoracic', text: 'Плечо у стены: ribs → экстензия' },
      hinge: { text: 'Шарнир: чисто' },
      ybt: { text: 'YBT-баланс: не замерялся' },
      asymPriority: 'Асимметрии: значимых нет — работаем по драйверу',
      driverSubs: { prefer: ['гоблет-присед'], avoid: [], note: 'n' },
    } as any);
    expect(r.bits.some((b) => /плечо:/.test(b))).toBe(true);
    expect(r.bits.some((b) => /Шарнир/.test(b))).toBe(true);
    expect(r.bits.some((b) => /не замерялся/.test(b))).toBe(false);
    expect(r.bits.some((b) => /значимых нет/.test(b))).toBe(false);
    expect(r.bits.some((b) => /замены:/.test(b))).toBe(true);
    expect(r.persist.movementExtra?.shoulder).toMatch(/Плечо у стены/);
  });
  it('мусор — тихо, старые поля целы', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: null, singleLeg: null, shoulder: 'мусор', asymPriority: 123 } as any);
    expect(r.bits).toEqual([]);
    expect(r.persist.movementExtra).toBeUndefined();
  });
});
