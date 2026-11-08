/**
 * bb-female-split-plumbing.test.ts — guard проводки пола в подбор ББ-сплита
 * (аудит женского слоя): каждый вызов rankBBSplits в UI обязан получать sex,
 * иначе селектор считает пол неизвестным и не рекомендует женские
 * glute-сплиты (а до фикса на 5 днях отдавал «Женский Glute Focus» всем).
 *
 * Тест читает исходники (как risk-female-thresholds.test.tsx) — так регресс
 * «забыли прокинуть пол на новом экране» ловится без рендера всего экрана.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** Все вызовы rankBBSplits(...) в файле — аргумент каждого должен иметь sex. */
function rankCallArgs(src: string): string[] {
  const out: string[] = [];
  let idx = src.indexOf('rankBBSplits(');
  while (idx !== -1) {
    out.push(src.slice(idx, idx + 700));
    idx = src.indexOf('rankBBSplits(', idx + 1);
  }
  return out;
}

describe('проводка sex в rankBBSplits (UI)', () => {
  const files = [
    'src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx',
    'src/ui/screens/SRCBBScreen.tsx',
    'src/ui/screens/TrainingScreen_parts/PeriodizationDesignerTab.tsx',
    'src/ui/screens/SRCBBScreen_parts/MacrocyclePanel.tsx',
  ];

  for (const f of files) {
    it(`${path.basename(f)}: все вызовы rankBBSplits получают sex`, () => {
      const calls = rankCallArgs(read(f));
      expect(calls.length).toBeGreaterThanOrEqual(1);
      for (const c of calls) expect(c).toMatch(/\bsex:/);
    });
  }

  it('BbAutoConstructor: пол входит в ключ авто-синхронизации сплита (male→female пересобирает рекомендацию)', () => {
    const src = read('src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx');
    expect(src).toMatch(/const key = `[^`]*\$\{[^}]*sex[^}]*\}/);
  });

  it('bb-step-split: диагностика выбранного сплита получает пол', () => {
    const src = read('src/ui/screens/TrainingScreen_parts/bb-step-split.tsx');
    expect(src).toMatch(/splitFitWarnings\(\{[^}]*\bsex\b[^}]*\}/);
    const ctor = read('src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx');
    expect(ctor).toMatch(/<BbSplitStep[\s\S]*?sex=\{linked\.profile\?\.settings\?\.personal\?\.sex\}/);
  });

  it('BbAutoConstructor: смена пола снимает ручной выбор сплита (после «трогал» рекомендация применяется заново)', () => {
    const src = read('src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx');
    expect(src).toMatch(/splitSexRef/);
    expect(src).toMatch(/splitSexRef\.current !== sex/);
    expect(src).toMatch(/splitTouched\.current = false/);
  });

  it('bb-step-split: женский профиль видит мягкую подсказку glute-сплита (не запрет)', () => {
    const src = read('src/ui/screens/TrainingScreen_parts/bb-step-split.tsx');
    expect(src).toMatch(/FEMALE_GLUTE_SPLITS/);
    expect(src).toMatch(/sex === 'female'/);
  });

  it('MacrocyclePanel: дни для рекомендации берутся из профиля, а не из недель блока', () => {
    const src = read('src/ui/screens/SRCBBScreen_parts/MacrocyclePanel.tsx');
    expect(src).toMatch(/profileTrainingDays\(\)/);
    expect(src).not.toMatch(/daysPerWeek: Math\.min\(6, Math\.max\(3, block\.weeks\)\)/);
    expect(src).toMatch(/training\?\.daysPerWeek/);
  });

  it('MacrocyclePanel: сборка черновика BB-плана передаёт пол (иначе female-объём теряется)', () => {
    const src = read('src/ui/screens/SRCBBScreen_parts/MacrocyclePanel.tsx');
    const calls = src.split('autodraftBBPlanAsync(').slice(1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) expect(c.slice(0, 600)).toMatch(/\bsex:/);
  });
});
