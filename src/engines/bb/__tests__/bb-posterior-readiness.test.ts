import { describe, it, expect } from 'vitest';
import {
  nheVerdict,
  nheDose,
  adductorVerdict,
  adductorAsymPct,
  copenhagenProgression,
  NHE_DISCLAIMER,
  ADDUCTOR_HONESTY,
} from '../bb-posterior-readiness.engine';

describe('bb-posterior-readiness R3a — NHE', () => {
  it('6 повторов обе стороны — ок + доза', () => {
    const v = nheVerdict({ repsL: 6, repsR: 7 });
    expect(v.level).toBe('ok');
    expect(v.dose?.total).toBe(2 * 3 * 6);
    expect(v.text).toMatch(/в порядке/);
  });
  it('4 повтора (<5) — weak, не very_weak', () => {
    const v = nheVerdict({ repsL: 4, repsR: 5 });
    expect(v.level).toBe('weak');
    expect(v.text).toMatch(/эксцентрик в работе/);
  });
  it('<3 повторов — very_weak', () => {
    expect(nheVerdict({ repsL: 2, repsR: 4 }).level).toBe('very_weak');
  });
  it('асимметрия ≥2 повторов — слабая сторона и weak', () => {
    const v = nheVerdict({ repsL: 3, repsR: 7 });
    expect(v.asymReps).toBe(4);
    expect(v.weakSide).toBe('left');
    expect(v.level).toBe('weak');
    expect(v.text).toMatch(/слабее левая/);
  });
  it('угол срыва <30 — very_weak (падаешь в первой трети)', () => {
    const v = nheVerdict({ repsL: 8, repsR: 8, breakAngleL: 20, breakAngleR: 25 });
    expect(v.level).toBe('very_weak');
  });
  it('угол 30–59 — weak', () => {
    expect(nheVerdict({ repsL: 6, repsR: 6, breakAngleL: 45, breakAngleR: 50 }).level).toBe('weak');
  });
  it('пусто — not_tested, дозы нет', () => {
    const v = nheVerdict({});
    expect(v.tested).toBe(false);
    expect(v.dose).toBeNull();
  });
  it('доза: 2 сессии, ~50/нед к потолку, делод упомянут', () => {
    const d = nheDose(5, 2);
    expect(d.sets).toBe(3);
    expect(d.total).toBe(30);
    expect(d.text).toMatch(/2×\/нед/);
    expect(d.text).toMatch(/делод/);
    const hi = nheDose(10, 2);
    expect(hi.total).toBe(60);
    expect(hi.text).toMatch(/8–10/);
  });
  it('дисклеймер: экстраполяция + польза эксцентрика', () => {
    expect(NHE_DISCLAIMER).toMatch(/экстраполяция/);
    expect(NHE_DISCLAIMER).toMatch(/Franke/);
  });
});

describe('bb-posterior-readiness R3b — аддукторы/Copenhagen', () => {
  it('асимметрия ≥15% — weak со слабой стороной', () => {
    const v = adductorVerdict({ squeezeL: 20, squeezeR: 28 });
    expect(v.asymPct).toBe(Math.round((8 / 28) * 100));
    expect(v.level).toBe('weak');
    expect(v.weakSide).toBe('left');
  });
  it('асимметрия 10–14% — watch', () => {
    expect(adductorVerdict({ squeezeL: 25, squeezeR: 28 }).level).toBe('watch');
  });
  it('симметрично + без CPH — ок', () => {
    const v = adductorVerdict({ squeezeL: 30, squeezeR: 30 });
    expect(v.level).toBe('ok');
    expect(v.text).toMatch(/симметрично/);
  });
  it('Copenhagen L0 — weak + шаг прогрессии', () => {
    const v = adductorVerdict({ cphLevel: 'L0' });
    expect(v.level).toBe('weak');
    expect(v.text).toMatch(/L1/);
  });
  it('L3 — ок, шаг «держи и добавляй»', () => {
    expect(adductorVerdict({ cphLevel: 'L3' }).text).toMatch(/держи L3|объём/i);
    expect(copenhagenProgression('L3').next).toMatch(/держи L3/);
  });
  it('«сжатие» пусто и уровень пуст — not_tested', () => {
    expect(adductorVerdict({}).tested).toBe(false);
  });
  it('asymPct helper: null без пары, 0 при равных', () => {
    expect(adductorAsymPct(null, 30)).toBeNull();
    expect(adductorAsymPct(30, 30)).toBe(0);
  });
  it('честность: сила = риск, снижение травм не доказано', () => {
    expect(ADDUCTOR_HONESTY).toMatch(/фактор риска/);
    expect(ADDUCTOR_HONESTY).toMatch(/не доказано/);
    expect(ADDUCTOR_HONESTY).toMatch(/RR 0\.83/);
  });
});
