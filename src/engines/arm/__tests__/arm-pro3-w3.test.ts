import { describe, it, expect } from 'vitest';
import { HUMERUS_CHECKS, checkHumerusChecklist } from '../arm-humerus-checklist.engine';

/** PRO-3 W3: наука — P8 чек-лист (движок). UI-строки P8–P11 покрыты UI-тестом. */
describe('PRO-3 W3 P8: humerus-чеклист', () => {
  it('5 чеков', () => {
    expect(HUMERUS_CHECKS.length).toBe(5);
    expect(HUMERUS_CHECKS.map((c) => c.id)).toEqual(['axis', 'wrist', 'shoulder', 'elbow', 'warmup']);
  });
  it('пусто — ok, стопа нет', () => {
    const r = checkHumerusChecklist([]);
    expect(r.ok).toBe(true);
    expect(r.stopLine).toBeNull();
  });
  it('один «нет» — стоп с названием чека', () => {
    const r = checkHumerusChecklist(['axis']);
    expect(r.ok).toBe(false);
    expect(r.failedLabels).toEqual(['Ось цела']);
    expect(r.stopLine).toContain('broken arm position');
    expect(r.stopLine).toContain('Ось цела');
  });
  it('неизвестные id игнорятся', () => {
    const r = checkHumerusChecklist(['nope' as never]);
    expect(r.ok).toBe(true);
  });
});
