import { describe, expect, it, beforeEach } from 'vitest';
import { generateReadinessForecast, runWhatIf } from '../../predictive.engine';

describe('P3 живой прогноз', () => {
  it('кламп 0–100: растущий тренд не уходит за 100, падающий — за 0', () => {
    const up = generateReadinessForecast([90, 93, 96, 98, 99]);
    expect(Math.max(...up.values)).toBeLessThanOrEqual(100);
    expect(Math.min(...up.ci95.map(c => c[0]))).toBeGreaterThanOrEqual(0);
    const down = generateReadinessForecast([10, 8, 6, 4, 3]);
    expect(Math.min(...down.values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...down.ci95.map(c => c[1]))).toBeLessThanOrEqual(100);
  });

  it('ДИ расширяется с горизонтом', () => {
    const f = generateReadinessForecast([70, 68, 72, 69, 71, 70, 68]);
    const w = (i: number) => f.ci95[i][1] - f.ci95[i][0];
    expect(w(2)).toBeGreaterThan(w(0));
  });

  it('уверенность: <7 точек — early с предупреждением, ≥7 — stable', () => {
    const early = generateReadinessForecast([70, 68, 72]);
    expect(early.confidence).toBe('early');
    expect(early.warnings.some(w => w.includes('Ранний прогноз'))).toBe(true);
    const stable = generateReadinessForecast([70, 68, 72, 69, 71, 70, 68, 69]);
    expect(stable.confidence).toBe('stable');
  });

  it('what-if честно подписан как ориентир', () => {
    const r = runWhatIf(22, 70, { calorieChange: 200, sleepChange: 1, drugChange: { AAS: 1.5 } });
    expect(r.note).toContain('Ориентиры направления');
    expect(r.readinessDelta).toBeGreaterThan(0);
    const plain = runWhatIf(22, 70, {});
    expect(plain.riskDelta).toBe(0);
    expect(plain.note).toContain('Ориентиры направления');
  });
});

describe('P3 история готовности (readiness-history)', () => {
  beforeEach(() => { try { localStorage.removeItem('he_readiness_history'); } catch { /* noop */ } });

  it('дедуп по дню: повторная запись не плодит точки', async () => {
    const { appendReadinessToday, loadReadinessHistory } = await import(
      '../../../ui/screens/TrainingScreen_parts/readiness-history'
    );
    appendReadinessToday(70, 30);
    appendReadinessToday(72, 28);
    const arr = loadReadinessHistory();
    expect(arr).toHaveLength(1);
    expect(arr[0].recovery).toBe(72);
  });
});
