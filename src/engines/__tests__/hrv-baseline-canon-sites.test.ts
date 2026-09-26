/**
 * hrv-baseline-canon-sites.test.ts — замок «HRV только от личной базы» на ВСЕХ 5 местах,
 * где абсолютный порог RMSSD жил после раунда П0-Б (26.09.2026).
 *
 * Что было (проверено чтением кода): П0-Б перевёл на личную базу два пути, влияющих на
 * объём (PL `lms-builder`, BB `bb-volume`), и в аддендуме был записан остаток долга —
 * ещё 5 мест с абсолютными миллисекундами. Проверка показала, что 4 из 5 влияли на объём:
 *   1) `recovery-budget.engine.ts` — множитель бюджета (×1.1 / ×1 / ×0.85 при 70/50 мс);
 *      сюда входят strength-sport-builder, strength-sport-ss-cycle-to-plan и combat-builder;
 *   2) `arm-volume.engine.ts` — шкала 100 (−12 / −6 при 40/60 мс), которая конвертится
 *      в множитель объёма через recoveryScoreToMult, т.е. это НЕ «просто текст»;
 *   3) `bb-prep-cycle.engine.ts` — `hrvMs < 50 → ×0.97` в prep-цикле;
 *   4) `bb-safety-score.engine.ts` — `−4` + подпись «отклонение от нормы (<50 мс)»;
 *   5) `ProGuardPanels.tsx` — `hrvMs < 30 → ×0.9` прямо в UI-чек-ине (меняет объём в коде);
 *   6) `CardioConstructor.tsx` — ШЕСТОЕ место, найдено grep-сканером при этом раунде и НЕ
 *      зафиксированное в аддендуме: порог 25 мс включал фактор «HRV» (→ ×0.9 объёма) в трёх
 *      местах (авто-состояние, текст сводки, штамп в config). Тоже абсолютный порог.
 *
 * Наука: Plews P.J. et al. Sports Med 2013;43(6):773-781 (PMID 23535808) — RMSSD нельзя
 * оценивать абсолютно, только против СОБСТВЕННОЙ базы; Buchheit M. Sports Med
 * 2014;44(9):1323-1337 (PMID 24282094) — пороги в SWC от базы. Burns M.J. et al.
 * J Clin Monit 2026 — бытовые датчики дают смещение ~10 %, что опять же запрещает перенос
 * абсолютных порогов между людьми.
 *
 * ОСОЗНАННАЯ ГРАНИЦА: путь `hrvGrade` в `computeRecoveryMultiplier` НЕ трогаем — он приходит
 * из `combat-monitoring.engine` как `hrvGrade(last, mean, sd)`, то есть УЖЕ посчитан по
 * личной базе. Лок ниже специально проверяет, что этот путь жив и имеет приоритет.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeRecoveryMultiplier } from '../recovery-budget.engine';
import { computeArmRecoveryScore, computeArmRecoveryMult } from '../arm/arm-volume.engine';
import { appendHrvReading, hrvSignalFromStore } from '../pro/hrv-baseline.engine';

const ROOT = join(process.cwd(), 'src');

/** Пять мест, где абсолютный порог RMSSD жил. */
const SITES = [
  'engines/recovery-budget.engine.ts',
  'engines/arm/arm-volume.engine.ts',
  'engines/bb/bb-prep-cycle.engine.ts',
  'engines/bb/bb-safety-score.engine.ts',
  'ui/screens/TrainingScreen_parts/ProGuardPanels.tsx',
  'ui/screens/TrainingScreen_parts/CardioConstructor.tsx',
];

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

describe('HRV-канон: личная база вместо абсолютных мс', () => {
  it('recovery-budget: без базы HRV не трогает объём (было: <50 мс → ×0.85)', () => {
    const only = { hrvMs: 40 };
    expect(computeRecoveryMultiplier(only)).toBe(1);
    // 60 мс у человека с базой 80 мс — это 75% базы, то есть снижение
    expect(computeRecoveryMultiplier({ hrvMs: 60, hrvBaseline: 80 })).toBeLessThan(1);
    // та же 60 мс у человека с базой 55 мс — это 109%, объём не трогаем
    expect(computeRecoveryMultiplier({ hrvMs: 60, hrvBaseline: 55 })).toBe(1);
  });

  it('recovery-budget: z-путь (SWC) работает и без ratio', () => {
    expect(computeRecoveryMultiplier({ hrvMs: 60, hrvBaselineZ: -2.5 })).toBeLessThan(1);
    expect(computeRecoveryMultiplier({ hrvMs: 60, hrvBaselineZ: 0 })).toBe(1);
  });

  it('recovery-budget: hrvGrade (уже базовый, из combat-monitoring) имеет приоритет и жив', () => {
    // НЕ сломали корректный путь: грейд считается как hrvGrade(last, mean, sd) — по личной базе.
    expect(computeRecoveryMultiplier({ hrvMs: 10, hrvGrade: 'dangerous' })).toBeLessThan(1);
    expect(computeRecoveryMultiplier({ hrvMs: 90, hrvGrade: 'optimal' })).toBeGreaterThan(1);
    // приоритет именно у грейда: он сильнее Baseline-пути при конфликте
    expect(computeRecoveryMultiplier({ hrvMs: 90, hrvGrade: 'dangerous', hrvBaseline: 90 })).toBeLessThan(1);
  });

  it('arm-volume: шкала не штрафует норму атлета с высокой базой (было: <40 → −12)', () => {
    // Высокая база: 60 мс — это 120% от 50, а раньше это был «−6 очка из 100»
    expect(computeArmRecoveryScore({ hrvMs: 60, hrvBaseline: 50 })).toBe(100);
    // Просадка от СВОЕЙ базы — штрафуем
    expect(computeArmRecoveryScore({ hrvMs: 40, hrvBaseline: 50 })).toBeLessThan(100);
    // Без базы — не трогаем
    expect(computeArmRecoveryScore({ hrvMs: 40 })).toBe(100);
  });

  it('arm-volume: множитель объёма следует за шкалой (score → recoveryScoreToMult)', () => {
    // recoveryScoreToMult: ≥95 → 1.1 · 85–94 → 1.0 · 70–84 → 0.9 · 55–69 → 0.8 · <55 → 0.65
    // Один HRV-штраф (−12) даёт 88 → ещё ×1.0, поэтому для проверки связи со шкалой берём
    // просадку вместе со стрессом: 100 −12 −6 = 82 → ×0.9. Без HRV та же комбинация = 94 → ×1.0.
    const withHrvDrop = computeArmRecoveryMult({ hrvMs: 40, hrvBaseline: 90, stressLevel: 7 });
    const sameWithoutHrv = computeArmRecoveryMult({ stressLevel: 7 });
    expect(withHrvDrop).toBeLessThan(sameWithoutHrv);
    // и без базы HRV объём не двигает вообще
    expect(computeArmRecoveryMult({ hrvMs: 40, stressLevel: 7 })).toBe(sameWithoutHrv);
  });

  it('hrvSignalFromStore: база строится из he_hrv_log, без неё mult = 1', () => {
    // 5 замеров по 80 мс → база есть, сегодня 60 мс → просадка
    for (let i = 0; i < 5; i++) appendHrvReading(80, `2026-09-${10 + i}`);
    const sig = hrvSignalFromStore(60);
    expect(sig.n).toBeGreaterThanOrEqual(3);
    expect(sig.hrvBaseline).toBeGreaterThan(0);
    expect(computeArmRecoveryScore({ hrvMs: 60, hrvBaseline: sig.hrvBaseline, hrvBaselineZ: sig.hrvBaselineZ })).toBeLessThan(100);
  });

  /* ── Source-guard: абсолютный порог RMSSD не вернётся ни в одно из шести мест ── */
  it.each(SITES)('в %s нет сравнения hrvMs с порогом (абсолютная норма)', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    // `hrvMs > 0` — проверка валидности (не порог), её пропускаем; ловим любой другой порог.
    const bad = src.match(/hrvMs\s*[<>]=?\s*(?!0\b)\d+/g);
    expect(bad, `найден абсолютный порог HRV: ${bad ? bad.join(', ') : ''}`).toBeNull();
  });

  it.each(SITES)('в %s HRV взят через канон hrvRecoveryMult', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    if (!/hrvMs/.test(src)) return; // место не использует HRV — нечего проверять
    expect(src).toMatch(/hrvRecoveryMult|hrvGrade/);
  });
});