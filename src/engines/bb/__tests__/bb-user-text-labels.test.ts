/**
 * Пользовательские тексты плана не содержат внутренних ключей.
 *
 * Замер до правки (пробник на 3 сплитах × 2 уровнях):
 * - расширенная сводка (`formatBBExpandedSummary`) печатала сырые ключи:
 *   `chest — 3 тренировки/нед…` (86 вхождений ключей на 6 текстов);
 * - стимул: `back: нет растянутой позиции…`, `hamstrings: база 4/18 <40%` (19);
 * - PRO-рекомендации недели: `➕ back: добавьте horizontal_pull` — и ключ мышцы,
 *   и id паттерна (35);
 * - rationale спец-блока: `Цели: delt_mid, chest_upper … Доноры на MV: back, quads` (4);
 * - отчёт: `поставлен в слот «delt_rear», но реально тренирует «shoulders»` (17).
 *
 * Причина — локальные карты подписей в каждом движке и отсутствие `chest_upper` /
 * `chest_lower` в каноническом `MUSCLE_LABEL_RU`. Инвариант закрепляет: любой
 * ключ модели, попавший в текст, должен быть переведён общим словарём.
 */
import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { formatBBExpandedSummary } from '../bb-summary.engine';
import { analyzeBBStimulus } from '../bb-stimulus.engine';
import { scoreProWeek, scoreVolumeWeek } from '../bb-quality-weekly.engine';
import { buildBBPlanReportText } from '../bb-report.engine';
import { buildSpecBlock } from '../bb-spec-block.engine';
import { correctiveBlockForBB } from '../bb-corrective-block.engine';
import { MUSCLE_LABEL_RU } from '../../volume-landmarks.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

/** Все канонические ключи мышц + пучки/зоны, которые движки кладут в тексты. */
const MUSCLE_KEYS = [
  ...Object.keys(MUSCLE_LABEL_RU),
  'chest_upper', 'chest_lower', 'back_width', 'back_thickness', 'delt_front', 'delt_mid', 'delt_rear',
];

const SNAKE_ID = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

/** Английские названия упражнений в скобках — не ключи модели («Гиперэкстензия (back extension)»). */
function stripExerciseNames(text: string): string {
  return text.replace(/\([^)]*[A-Za-z][^)]*\)/g, ' ').replace(/[«"]([^»"]*[A-Za-z][^»"]*)[»"]/g, (m, inner) => (/[а-яё]/i.test(inner) ? m : ' '));
}

function findRawKeys(text: string): string[] {
  const clean = stripExerciseNames(text);
  const out = new Set<string>();
  for (const m of clean.matchAll(SNAKE_ID)) {
    if (MUSCLE_KEYS.includes(m[0])) out.add(m[0]);
  }
  return [...out];
}

function findSnakeIds(text: string): string[] {
  const clean = stripExerciseNames(text);
  return [...new Set(Array.from(clean.matchAll(SNAKE_ID), (m) => m[0]).filter((id) => !MUSCLE_KEYS.includes(id)))];
}

describe('пользовательские тексты: ключи модели переведены', () => {
  it('сводка, отчёт, стимул, PRO-недели, rationale спец-блока — без сырых ключей', () => {
    const checked: string[] = [];
    for (const patternId of ['fullbody_3', 'upper_lower_4', 'ppl_6']) {
      for (const level of ['beginner', 'advanced'] as const) {
        const plan: any = buildBBPlan({ patternId, level, goal: 'mass', weeks: 3, workMax: WM });
        const st = analyzeBBStimulus(plan) as any;
        const pro = scoreProWeek(plan, 1) as any;
        const vol = scoreVolumeWeek(plan, 1) as any;
        const texts: Array<[string, string]> = [
          ['сводка', formatBBExpandedSummary(plan)],
          ['отчёт', buildBBPlanReportText(plan)],
          ['стимул', (st.issues || []).join('\n')],
          ['PRO', (pro.recommendations || []).map((r: any) => r.message || '').join('\n')],
          ['PRO-итог', (pro.totalRecommendations || []).join('\n')],
          ['объём', (vol.issues || []).map((i: any) => i.message || '').join('\n')],
        ];
        for (const [kind, text] of texts) {
          expect(findRawKeys(text), `${patternId}/${level}: ${kind}`).toEqual([]);
          expect(findSnakeIds(text), `${patternId}/${level}: ${kind} (id модели)`).toEqual([]);
          checked.push(text);
        }
      }
    }
    expect(checked.length).toBeGreaterThan(30);
  }, 600000);

  it('rationale спец-блока и календарь спец-блока — без сырых ключей', () => {
    const block = buildSpecBlock({
      weakZones: ['delt_mid', 'chest_upper', 'delt_rear'],
      factSets: { delt_mid: 6, chest_upper: 8, delt_rear: 4 },
      level: 'intermediate',
      weeks: 6,
    });
    const corr = correctiveBlockForBB([], 6);
    const texts: Array<[string, string]> = [
      ['rationale', block.rationale.join('\n')],
      ['focus', block.weeks.map((w: any) => w.focus || '').join('\n')],
      ['календарь', corr.weeks.map((w: any) => w.note || '').join('\n')],
    ];
    for (const [kind, text] of texts) {
      expect(findRawKeys(text), kind).toEqual([]);
      expect(findSnakeIds(text), `${kind} (id модели)`).toEqual([]);
    }
  }, 300000);
});
