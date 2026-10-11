/**
 * arm-shoulder-erir.test.ts — баланс ротаторов плеча ER:IR (Pascoa 2026, PMC12904635).
 * Каждый тест = одно поведение движка; нормативы подписаны источниками.
 */
import { describe, it, expect } from 'vitest';
import {
  erIrRatio, erIrVerdict, ERIR_RATIO_MIN, ERIR_ATHELETE_MIN, ERIR_RATIO_HIGH,
} from '../arm-shoulder-erir.engine';
import { buildArmDiagnosticsReport } from '../arm-diagnostics-hub.engine';
import { SourceFileReader } from './helpers/source-reader';

describe('ER:IR — расчёт и зоны', () => {
  it('нет данных → no_data без выдуманного норматива', () => {
    const v = erIrVerdict({});
    expect(v.zone).toBe('no_data');
    expect(v.ratio).toBeNull();
    expect(v.warn).toBe(false);
    expect(v.fix).toBeNull();
  });

  it('ена 0/нули → no_data (деление на ноль не даёт 0)', () => {
    expect(erIrRatio(0, 50)).toBeNull();
    expect(erIrRatio(40, 0)).toBeNull();
    expect(erIrRatio(null, 50)).toBeNull();
    expect(erIrRatio(NaN, 50)).toBeNull();
  });

  it('норма здоровых (0.71–0.86) → ok', () => {
    expect(erIrRatio(40, 50)).toBe(0.8);
    const v = erIrVerdict({ erKg: 40, irKg: 50 });
    expect(v.zone).toBe('ok');
    expect(v.warn).toBe(false);
  });

  it('0.64–0.75 → watch: ниже нормы здоровых, добавить ER', () => {
    const v = erIrVerdict({ erKg: 34, irKg: 50 }); // 0.68
    expect(v.ratio).toBe(0.68);
    expect(v.zone).toBe('watch');
    expect(v.warn).toBe(true);
    expect(v.fix).toContain('Внешняя ротация');
  });

  it('<0.64 → risk: перекос как у армрестлеров в Pascoa-2026 (0.57)', () => {
    const v = erIrVerdict({ erKg: 28.5, irKg: 50 }); // 0.57
    expect(v.ratio).toBe(0.57);
    expect(v.zone).toBe('risk');
    expect(v.warn).toBe(true);
    expect(v.line).toContain('Pascoa');
  });

  it('>1.15 → watch «проверьте замер» (ER не может быть >> IR)', () => {
    const v = erIrVerdict({ erKg: 60, irKg: 50 }); // 1.2
    expect(v.zone).toBe('watch');
    expect(v.line).toContain('проверьте замер');
  });

  it('границы: <0.64 risk / 0.64–0.75 watch / ≥0.75 ok — без «мёртвых» зон', () => {
    expect(erIrVerdict({ erKg: 31.5, irKg: 50 }).zone).toBe('risk');      // 0.63 — строго ниже нормы атлетов
    expect(erIrVerdict({ erKg: 32, irKg: 50 }).zone).toBe('watch');      // 0.64 — ровно на границе норматива
    expect(erIrVerdict({ erKg: 32.5, irKg: 50 }).zone).toBe('watch');    // 0.65
    expect(erIrVerdict({ erKg: 37.5, irKg: 50 }).zone).toBe('ok');       // 0.75 — граница нормы здоровых
    expect(ERIR_ATHELETE_MIN).toBe(0.64);
    expect(ERIR_RATIO_MIN).toBe(0.75);
    expect(ERIR_RATIO_HIGH).toBe(1.15);
  });
});

describe('ER:IR — проводка в диагностику плеча', () => {
  const BASE: any = { weakTest: {}, grip: {}, level: 'intermediate', technique: 'balanced', tableSessions: 2, totalSessions: 4, tendonSets: 8 };

  it('risk-замер → critical finding с exercise external_rotation_band', () => {
    const r = buildArmDiagnosticsReport({ ...BASE, erIr: { erKg: 28.5, irKg: 50 } });
    const f = r.findings.find((x) => x.text.includes('ER:IR'));
    expect(f).toBeTruthy();
    expect(f!.level).toBe('critical');
    expect(f!.exercise).toBe('external_rotation_band');
    expect(r.info.some((i) => i.includes('2–3×5–15'))).toBe(true);
  });

  it('watch-замер → warn finding', () => {
    const r = buildArmDiagnosticsReport({ ...BASE, erIr: { erKg: 34, irKg: 50 } });
    const f = r.findings.find((x) => x.text.includes('ER:IR'));
    expect(f!.level).toBe('warn');
  });

  it('норма → ok finding', () => {
    const r = buildArmDiagnosticsReport({ ...BASE, erIr: { erKg: 40, irKg: 50 } });
    const f = r.findings.find((x) => x.text.includes('ER:IR'));
    expect(f!.level).toBe('ok');
  });

  it('без замера ER:IR-finding НЕ пишется (честное «нет данных»)', () => {
    const r = buildArmDiagnosticsReport(BASE);
    expect(r.findings.some((x) => x.text.includes('ER:IR'))).toBe(false);
  });
});

describe('UI-проводка ER:IR (source-guard)', () => {
  it('хаб: поля ввода + вердикт из движка (нет своих расчётов)', () => {
    const src = new SourceFileReader('src/ui/screens/TrainingScreen_parts/arm-hub-tabs2.tsx');
    expect(src.text).toContain("import { erIrVerdict } from '../../../engines/arm/arm-shoulder-erir.engine'");
    expect(src.text).toContain('state.erKg');
    expect(src.text).toContain('state.irKg');
    expect(src.text).toContain('erIr.line');
    expect(src.text).not.toMatch(/erKg\s*\/\s*irKg/); // деления в UI нет
  });
  it('движок диагностики: вход erIr объявлен и заполняется из UI', () => {
    const engine = new SourceFileReader('src/engines/arm/arm-diagnostics-hub.engine.ts');
    expect(engine.text).toContain('erIr?: ErIrInput');
    expect(engine.text).toContain('erIrVerdict(input.erIr');
    const hub = new SourceFileReader('src/ui/screens/TrainingScreen_parts/ArmDiagnosticsHub.tsx');
    expect(hub.text).toMatch(/erIr: \(parseFloat\(state\.erKg \|\| ''\)/);
  });
});
