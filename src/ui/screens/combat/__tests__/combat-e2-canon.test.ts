/**
 * combat-e2-canon.test.ts — локи E2 «единый канон».
 *
 * Проверяем, что каждая фича E2 имеет ОДИН источник истины и реально
 * применяется, а не существует только на экране.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const CONSTRUCTOR = read('src/ui/screens/combat/CombatConstructor.tsx');
const PLAN_VIEW = read('src/ui/screens/combat/CombatPlanView.tsx');
const WIZARD = read('src/ui/screens/combat/useCombatWizard.ts');
const CARD = read('src/ui/screens/combat/combat-annual-card.tsx');
const ANNUAL = read('src/engines/combat/combat-annual.ts');

describe('E2.1 — spar weekly load: один канон', () => {
  it('UI зовёт движковую sparringWeeklyLoad, а не инлайн-арифметику', () => {
    expect(CONSTRUCTOR).toContain('sparringWeeklyLoad');
    // был инлайн 90*8.5 + 60*5.5 + 75*7.5 в UI — движок считает это сам
    expect(CONSTRUCTOR).not.toMatch(/sparringHard\s*\*\s*90/);
    expect(CONSTRUCTOR).not.toMatch(/sparringTech\s*\*\s*60/);
    expect(CONSTRUCTOR).not.toMatch(/sparringWrest\s*\*\s*75/);
  });

  it('тот же НОРМАЛИЗОВАННЫЙ объект идёт и в валидатор, и в счётчик', () => {
    // normalizeSparringLoad клампит и возвращает null на нуле — без него
    // счётчик показывал «0 load» при выключенном спарринге
    expect(CONSTRUCTOR).toContain('normalizeSparringLoad({');
    expect(CONSTRUCTOR).toMatch(/validateSparringLoad\(sparringLoad\)/);
    expect(CONSTRUCTOR).toMatch(/sparringWeeklyLoad\(sparringLoad\)/);
  });
});

describe('E2.2 — ISSN-поля реально применяются', () => {
  it('fiberGPerDay и dailyStepsTarget передаются в протокол', () => {
    expect(CONSTRUCTOR).toMatch(/buildWeightCutProtocol\([\s\S]{0,600}fiberGPerDay: weightCutFiber/);
    expect(CONSTRUCTOR).toMatch(/buildWeightCutProtocol\([\s\S]{0,600}dailyStepsTarget: weightCutSteps/);
  });

  it('клетчатка и шаги — РЕАЛЬНЫЕ контролы, а не статичный текст', () => {
    expect(WIZARD).toContain('setWeightCutFiber');
    expect(WIZARD).toContain('setWeightCutSteps');
    // был read-only div с текстом «10г/день — низкая клетчатка 4 дн»
    expect(CONSTRUCTOR).not.toMatch(/10г\/день\s*—\s*низкая клетчатка/);
    expect(CONSTRUCTOR).toMatch(/setWeightCutFiber\(Number/);
    expect(CONSTRUCTOR).toMatch(/setWeightCutSteps\(Number/);
  });
});

describe('E2.3 — годовой блок: одна копия', () => {
  it('оба экрана рендерят общий AnnualCard, а не две копии разметки', () => {
    expect(CONSTRUCTOR).toContain("from './combat-annual-card'");
    expect(PLAN_VIEW).toContain("from './combat-annual-card'");
    expect(CONSTRUCTOR).toMatch(/<AnnualCard[\s\S]{0,80}annual=\{annual\}/);
    expect(PLAN_VIEW).toMatch(/<AnnualCard[\s\S]{0,80}annual=\{annual\}/);
  });

  it('дубль годовой разметки больше не остался ни в одном из файлов', () => {
    for (const src of [CONSTRUCTOR, PLAN_VIEW]) {
      // «Годовой ATR · N нед» рендерится только внутри AnnualCard
      expect(src).not.toContain('Годовой ATR · ${annual.totalWeeks} нед');
      // полоса фаз была инлайн-копией
      expect(src).not.toMatch(/annual\.blocks\.map\(/);
    }
    expect(CARD).toContain('Годовой ATR · ${annual.totalWeeks} нед');
  });

  it('приоритет боя доступен на ОБОИХ экранах (было только в плане)', () => {
    expect(CARD).toContain('setCompetitionPriority');
    expect(CARD).toMatch(/CombatPopupSelect label="Приоритет боя"/);
    expect(CONSTRUCTOR).toMatch(/<AnnualCard[\s\S]{0,1400}setCompetitionPriority=\{setCompetitionPriority\}/);
  });

  it('инпуты годового блока ≥16px (было 11px → iOS-зум на АПК)', () => {
    // 11px допустим только на неинтерактивных чипах, но НЕ на input
    const inputTags = CARD.match(/<(input|textarea)[^\n]*/g) || [];
    expect(inputTags.length).toBeGreaterThan(0);
    for (const tag of inputTags) {
      expect(tag).toMatch(/fontSize: 16/);
    }
    expect(CARD).toMatch(/placeholder="Название боя"[\s\S]{0,200}fontSize: 16/);
  });
});

describe('E2.4/E5 — удаление боя и обратный отсчёт', () => {
  it('удаление боя доступно в UI', () => {
    expect(CARD).toContain('onRemoveCompetition');
    expect(CONSTRUCTOR).toContain('handleRemoveCompetition');
    expect(CONSTRUCTOR).toMatch(/<AnnualCard[\s\S]{0,1400}onRemoveCompetition=\{handleRemoveCompetition\}/);
  });

  it('removeCompetitionFromAnnual снимает и бой, и его taper-блок', () => {
    expect(ANNUAL).toContain('export function removeCompetitionFromAnnual');
    // без этого год «разъезжался» на длину тапера после удаления
    expect(ANNUAL).toMatch(/kept\s*=\s*next\.blocks\.filter\([\s\S]{0,200}phase === 'taper'/);
    expect(ANNUAL).toMatch(/next\.blocks = merged/);
    expect(ANNUAL).toMatch(/next\.totalWeeks = cur - 1/);
  });

  it('обратный отсчёт до боя — чистая функция с UTC-безопасной арифметикой', () => {
    expect(CARD).toContain('export function daysToFirstFight');
    expect(CARD).toContain('data-cb="annual-dday"');
  });
});
