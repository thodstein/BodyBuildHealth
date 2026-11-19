/**
 * risk-calculator-sex.test.ts — проход 92: риски «по анализам» знают пол.
 *
 * Было: `calculateRiskFromAnalyses` читал только мужской ряд `UCUM_MAP`, хотя в
 * комментарии к вкладу было написано «отклонение в долях ВГН своего пола». На
 * экране «Анализы» это давало прямую нестыковку: строка отклонений печатала
 * «HCT 49 ↑ 36–48 ♀», а системный риск крови при этом оставался нулевым, потому
 * что считался по мужским 52. То же на экране «Риск»: женские пороги брались для
 * списка маркеров, но не для систем.
 *
 * Стало: ВГН из единого резолвера `getLabNorm(code, sex)` (lab-norms.engine),
 * без sex — ровно пара `UCUM_MAP` (мужской путь байт-в-байт). Оба экрана передают
 * пол пациента и пересчитывают мемо при его смене.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateRiskFromAnalyses } from '../risk-calculator-v2.engine';
import type { LabPoint } from '../../core/types';

const lab = (code: string, value: number): LabPoint => ({
  id: `${code}-1`, code, name: code, value, unit: '', date: '2026-11-14',
} as LabPoint);

const contrib = (code: string, value: number, sex?: 'male' | 'female') =>
  (calculateRiskFromAnalyses([lab(code, value)], sex) as any).systemContributions as Record<string, number>;

describe('проход 92: ВГН пола в рисках по анализам', () => {
  it('HCT 49: мужчине норма (0), женщине — выше её 48', () => {
    expect(contrib('HCT', 49, 'male').hematologic).toBe(0);
    expect(contrib('HCT', 49, 'female').hematologic).toBeGreaterThan(0);
  });

  it('АЛТ 35: мужчине норма (ВГН 40), женщине — выше её 31', () => {
    expect(contrib('ALT', 35, 'male').hepatic).toBe(0);
    expect(contrib('ALT', 35, 'female').hepatic).toBeGreaterThan(0);
  });

  it('креатинин 100: мужчине норма (110), женщине — выше её 97', () => {
    expect(contrib('CREATININE', 100, 'male').renal).toBe(0);
    expect(contrib('CREATININE', 100, 'female').renal).toBeGreaterThan(0);
  });

  it('мочевая кислота 380: мужчине норма (420), женщине — выше её 350', () => {
    expect(contrib('UA', 380, 'male').renal).toBe(0);
    expect(contrib('UA', 380, 'female').renal).toBeGreaterThan(0);
  });

  it('без sex — прежний мужской ряд байт-в-байт', () => {
    expect(contrib('HCT', 49)).toEqual(contrib('HCT', 49, 'male'));
    expect(contrib('ALT', 35)).toEqual(contrib('ALT', 35, 'male'));
    expect(contrib('UA', 380)).toEqual(contrib('UA', 380, 'male'));
  });

  it('перегрузка (RiskResult, labs, sex) тоже принимает пол', () => {
    const female = calculateRiskFromAnalyses(
      { systemBreakdown: {}, overallRaw: 0, overallNet: 0 } as any,
      [lab('HCT', 49)],
      'female',
    ) as any;
    const male = calculateRiskFromAnalyses(
      { systemBreakdown: {}, overallRaw: 0, overallNet: 0 } as any,
      [lab('HCT', 49)],
      'male',
    ) as any;
    expect(female.systemBreakdown.hematologic.raw).toBeGreaterThan(0);
    expect(male.systemBreakdown.hematologic.raw).toBe(0);
  });

  it('источник: ВГН из резолвера, а не из UCUM напрямую', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/risk-calculator-v2.engine.ts'), 'utf8');
    expect(src).toContain('getLabNorm(code, sex)');
    expect(src).not.toContain('const uln = reference.uln;');
  });

  it('источник: оба экрана передают пол и пересчитывают мемо при его смене', () => {
    const labs = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');
    expect(labs).toContain("calculateRiskFromAnalyses(labData, profileSex as 'male' | 'female')");
    expect(labs).toContain('}, [hasLabs, labs, currentLabs, profileSex]);');

    const risk = readFileSync(resolve(process.cwd(), 'src/ui/screens/RiskScreen.tsx'), 'utf8');
    expect(risk).toContain('calculateRiskFromAnalyses(labData, profileSex)');
    expect(risk).toContain('calculateRiskFromAnalyses(result, linked.labs, profileSex)');
    // Проход 152: у экрана «Риск» больше нет своей копии нормы — список отклонений
    // считает общий модуль, куда пол приходит вместе с `sex`.
    expect(risk).toContain('computeMarkerDeviations(labs as any, profileSex)');
    expect(risk).not.toContain('getLabNorm(lab.code, profileSex)');
    const markerRisks = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen_parts/lab-marker-risks.ts'), 'utf8');
    expect(markerRisks).toContain('getLabNorm(lab.code, sex)');
  });
});
