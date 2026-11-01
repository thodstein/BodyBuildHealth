import { describe, it, expect } from 'vitest';
import { cameraAngleCheck } from '../strength-sport-video.engine';

/**
 * Траектория штанги: вертикальный ход `dyCm` и горизонтальный уход `dxCm` за серию.
 * Так проверяется именно тот сигнал, который реально виден по замеру.
 */
function path(opts?: { dxCm?: number; dyCm?: number; n?: number }) {
  const n = opts?.n ?? 40;
  const dy = opts?.dyCm ?? 40;
  const dx = opts?.dxCm ?? 0;
  return Array.from({ length: n }, (_, i) => ({
    t: i / 30,
    x: 100 + (dx * i) / (n - 1),
    y: 50 + (dy * i) / (n - 1),
  }));
}

describe('cameraAngleCheck — ракурс по замеру, без догадок', () => {
  it('меньше 8 точек — null: утверждать нечего', () => {
    expect(cameraAngleCheck([])).toBeNull();
    expect(cameraAngleCheck(path({ n: 7 }))).toBeNull();
    expect(cameraAngleCheck(null as unknown as [])).toBeNull();
  });

  it('ровная вертикаль без перспективы: ok, но честно про некалиброванную перспективу', () => {
    const r = cameraAngleCheck(path({ dxCm: 0 }))!;
    expect(r.flag).toBe('ok');
    expect(r.driftPct).toBe(0);
    expect(r.skewPct).toBeNull();
    expect(r.reason).toContain('перспектива не калибрована');
    expect(r.azimuthKnown).toBe(false);
  });

  it('ровная вертикаль с перспективой: ok и оба числа названы', () => {
    const r = cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 1.2 })!;
    expect(r.flag).toBe('ok');
    expect(r.skewPct).toBe(1.2);
    expect(r.reason).toContain('разброс масштаба по высоте 1.2%');
  });

  it('разброс масштаба выше порога → tilt: нужна перспектива, иначе высоты искажены', () => {
    const r = cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 6 })!;
    expect(r.flag).toBe('tilt');
    expect(r.driftPct).toBe(0);
    expect(r.reason).toContain('плывёт на 6%');
    expect(r.reason).toContain('перспективу по 4 кадрам');
    // Искажение масштаба важнее горизонтального хода: вердикт один и он про масштаб.
    expect(cameraAngleCheck(path({ dxCm: 20, dyCm: 40 }), { skewPct: 10 })!.flag).toBe('tilt');
  });

  it('горизонтальный ход выше порога → drift, и в причине ДВЕ версии без выбора', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }))!;
    expect(r.driftPct).toBe(25);
    expect(r.flag).toBe('drift');
    expect(r.reason).toContain('либо техника');
    expect(r.reason).toContain('не различить');
    expect(r.reason).toContain('переснимите строго сбоку');
  });

  it('граница: ровно 20% хода — ещё не нарушение', () => {
    const r = cameraAngleCheck(path({ dxCm: 8, dyCm: 40 }))!;
    expect(r.driftPct).toBe(20);
    expect(r.flag).toBe('ok');
  });

  it('порог настраивается явно', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { driftLimitPct: 40 })!;
    expect(r.flag).toBe('ok');
    const strict = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { driftLimitPct: 5 })!;
    expect(strict.flag).toBe('drift');
  });

  it('вертикальный ход меньше 2 см → unknown: ракурс по такому треку не проверить', () => {
    const flat = Array.from({ length: 40 }, (_, i) => ({ t: i / 30, x: 100 + i * 0.1, y: 50 + Math.sin(i) * 0.05 }));
    const r = cameraAngleCheck(flat)!;
    expect(r.flag).toBe('unknown');
    expect(r.driftPct).toBeNull();
    expect(r.reason).toContain('меньше 2 см');
  });

  it('мусорные значения не ломают расчёт, но и не выдумывают цифр', () => {
    const pts = path({ dxCm: 0 });
    pts[0] = { t: 0, x: Number.NaN, y: 50 };
    pts[1] = { t: 0.1, x: 100, y: Number.POSITIVE_INFINITY };
    const r = cameraAngleCheck(pts)!;
    expect(r).not.toBeNull();
    expect(r.driftPct).toBe(0);
    // Некорректный разброс масштаба — это null, а не 0 (0 значил бы «проверено и ровно»).
    expect(cameraAngleCheck(path(), { skewPct: Number.NaN })!.skewPct).toBeNull();
    expect(cameraAngleCheck(path(), { skewPct: -2 })!.skewPct).toBeNull();
  });

  it('ракурс «спереди/сбоку» не определяется никогда — это заявлено в каждом вердикте', () => {
    const cases = [
      cameraAngleCheck(path({ dxCm: 0 }))!,
      cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }))!,
      cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 9 })!,
      cameraAngleCheck(Array.from({ length: 20 }, (_, i) => ({ t: i / 30, x: 100, y: 50 + i * 0.05 })))!,
    ];
    for (const r of cases) {
      expect(r.azimuthKnown).toBe(false);
      expect(r.reason).toContain('«спереди/сбоку»');
    }
  });
});
