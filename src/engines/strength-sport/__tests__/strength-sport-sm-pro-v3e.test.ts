import { describe, it, expect } from 'vitest';
import {
  carryPathMetrics,
  classifyCarryPath,
  diagnoseCarryPathFromPoints,
} from '../strength-sport-sm-carry-path.engine';
import { smPoseCheckFromCsv } from '../strength-sport-sm-pose-check.engine';

// Физичные данные 30fps: sway 1.5Гц ≈ Hindle stride rate 1.62Гц, 61 точка = 2с = 3 периода
const straightWalk = Array.from({ length: 61 }, (_, i) => ({
  x: Math.sin(i * 0.314) * 1.2,
  y: 80 + Math.sin(i * 0.628) * 1.5,
  t: i * 0.033,
}));

const swayWalk = Array.from({ length: 61 }, (_, i) => ({
  x: Math.sin(i * 0.3) * 4.5 + i * 0.2,
  y: 80 + Math.sin(i * 0.6) * 2.0,
  t: i * 0.033,
}));

describe('SM PRO v3e: carry-path 2D', () => {
  it('ровный проход → stable/ok', () => {
    const r = diagnoseCarryPathFromPoints(straightWalk);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('stable');
    expect(r!.verdict).toBe('ok');
    expect(r!.metrics.n).toBe(61);
  });
  it('разболтанный + снос → lateral_sway, warn+', () => {
    const r = diagnoseCarryPathFromPoints(swayWalk);
    expect(r).not.toBeNull();
    expect(r!.type).not.toBe('stable');
    expect(['warn', 'critical']).toContain(r!.verdict);
    expect(r!.metrics.xLoop).toBeGreaterThan(3);
  });
  it('критика >5см', () => {
    const wild = Array.from({ length: 21 }, (_, i) => ({ x: Math.sin(i) * 7, y: 80, t: i * 0.033 }));
    expect(diagnoseCarryPathFromPoints(wild)!.verdict).toBe('critical');
  });
  it('боб — info без влияния на ok', () => {
    const bouncy = Array.from({ length: 61 }, (_, i) => ({ x: Math.sin(i * 0.314) * 1.0, y: 80 + Math.sin(i * 0.628) * 6, t: i * 0.033 }));
    const r = diagnoseCarryPathFromPoints(bouncy)!;
    expect(r.lines.some((l) => l.includes('боб'))).toBe(true);
    expect(r.verdict).toBe('ok');
  });
  it('мало точек → null', () => {
    expect(carryPathMetrics(null)).toBeNull();
    expect(classifyCarryPath(null)).toBeNull();
    expect(diagnoseCarryPathFromPoints([{ x: 1, y: 2, t: 0 }])).toBeNull();
  });
});

describe('SM PRO v3e: female-нормы позы', () => {
  // hip ROM ~22 (<30), knee ROM ~50 (норма) — изолированный hip-low
  const csv = [
    't,hip,knee,ankle,shoulder',
    '0.00,150,170,90,170',
    '0.03,140,145,88,171',
    '0.06,128,120,85,170',
    '0.09,140,145,89,171',
    '0.12,150,170,90,170',
  ].join('\n');
  it('мужчина/без пола — строже', () => {
    const m = smPoseCheckFromCsv(csv, 'yoke_walk', 'male')!;
    expect(m.result.lines.some((l) => l.includes('hip ROM'))).toBe(true);
    expect(m.result.verdict).toBe('warn');
  });
  it('женщина — изолированный hip-low смягчён + нота Hindle', () => {
    const f = smPoseCheckFromCsv(csv, 'yoke_walk', 'female')!;
    expect(f.result.verdict).toBe('warn');
    expect(f.result.lines.some((l) => l.includes('Hindle interaction'))).toBe(true);
  });
  it('female без sex-эффекта при норме', () => {
    const ok = [
      't,hip,knee,ankle,shoulder',
      '0.00,150,170,90,170',
      '0.03,135,140,88,171',
      '0.06,120,120,85,170',
      '0.09,135,150,89,171',
      '0.12,150,170,90,170',
    ].join('\n');
    expect(smPoseCheckFromCsv(ok, 'yoke_walk', 'female')!.result.verdict).toBe('ok');
  });
});
