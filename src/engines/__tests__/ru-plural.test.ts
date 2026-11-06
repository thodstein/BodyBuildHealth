/**
 * Склонение числительных в пользовательских текстах плана.
 *
 * Замер до правки: 384 текста (отчёт, печать, rationale, валидация; 8 сплитов ×
 * 2 уровня × 1..6 недель) → **1419** неверных форм: `report/сетов` 1022,
 * `rationale/сетов` 253, `report/недель` 64, `report/тренировок` 48,
 * `report/упражнений` 32. Самые заметные: первая строка отчёта
 * «План: … · 1 недель · 3 тренировок в неделю», «Итого: 2 рабочих сетов/нед».
 *
 * Правило проверки — только ИМЕНИТЕЛЬНЫЙ счёт («3 сета», «4 недели»).
 * Родительный после предлогов («до 2 сетов», «из 4 сетов») в проверку не входит.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ruForm, ruCount, ruAdjCount, ruFracCount, RU_ADJ_BUILT, RU_ADJ_CRITICAL_F, RU_ADJ_CRITICAL_M, RU_BLOCKS, RU_CONFLICTS, RU_CONFLICTS_DRUG, RU_EXERCISES, RU_PAIRS, RU_SESSIONS, RU_SETS, RU_TRAININGS, RU_WEEKS } from '../ru-plural';
import { buildBBPlan } from '../bb/bb-builder.engine';
import { buildBBPlanReportText } from '../bb/bb-report.engine';
import { buildBBPlanPrintHtml } from '../bb/bb-visual.engine';
import { formatBBExpandedSummary } from '../bb/bb-summary.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('ru-plural: согласование', () => {
  it('выбирает форму по правилам русского языка', () => {
    const f = (n: number) => ruForm(n, RU_SETS);
    expect([1, 21, 101, 1001].map(f)).toEqual(['сет', 'сет', 'сет', 'сет']);
    expect([2, 3, 4, 22, 34, 102].map(f)).toEqual(['сета', 'сета', 'сета', 'сета', 'сета', 'сета']);
    expect([0, 5, 6, 11, 12, 13, 14, 25, 111, 100].map(f)).toEqual([
      'сетов', 'сетов', 'сетов', 'сетов', 'сетов', 'сетов', 'сетов', 'сетов', 'сетов', 'сетов',
    ]);
    expect(ruCount(3, RU_EXERCISES)).toBe('3 упражнения');
    expect(ruCount(1, RU_WEEKS)).toBe('1 неделя');
    expect(ruCount(4, RU_TRAININGS)).toBe('4 тренировки');
  });
});

describe('словари: род прилагательного и фразовые формы', () => {
  it('пары (ж.) и конфликты (м.) — разные формы прилагательного', () => {
    expect(ruAdjCount(1, RU_ADJ_CRITICAL_F, RU_PAIRS)).toBe('1 критическая пара');
    expect(ruAdjCount(3, RU_ADJ_CRITICAL_F, RU_PAIRS)).toBe('3 критические пары');
    expect(ruAdjCount(1, RU_ADJ_CRITICAL_M, RU_CONFLICTS)).toBe('1 критический конфликт');
    expect(ruAdjCount(3, RU_ADJ_CRITICAL_M, RU_CONFLICTS)).toBe('3 критических конфликта');
  });

  it('фразовый словарь согласует всю цепочку «прил. + прил. + сущ.»', () => {
    expect(ruCount(1, RU_CONFLICTS_DRUG)).toBe('1 критический межлекарственный конфликт');
    expect(ruCount(2, RU_CONFLICTS_DRUG)).toBe('2 критических межлекарственных конфликта');
    expect(ruCount(5, RU_CONFLICTS_DRUG)).toBe('5 критических межлекарственных конфликтов');
  });

  it('«собранный блок» — мужской род (было «1 собранная блок»)', () => {
    expect(ruAdjCount(1, RU_ADJ_BUILT, RU_BLOCKS)).toBe('1 собранный блок');
    expect(ruAdjCount(3, RU_ADJ_BUILT, RU_BLOCKS)).toBe('3 собранных блока');
  });

  it('дробное число — родительный единственного, целое в «.0» — обычное правило', () => {
    expect(ruFracCount(4.7.toFixed(1), RU_SESSIONS)).toBe('4.7 сессии');
    expect(ruFracCount(14.5.toFixed(1), RU_SETS)).toBe('14.5 сета');
    expect(ruFracCount(18.0.toFixed(1), RU_SETS)).toBe('18.0 сетов');
    expect(ruCount(5.7, RU_SETS)).toBe('5.7 сетов'); // ловушка: trunc(5.7) = 5 → форма «5+»
    expect(ruFracCount(5.7.toFixed(1), RU_SETS)).toBe('5.7 сета');
  });
});

describe('тексты плана: числительные согласованы', () => {
  type Noun = { forms: readonly [string, string, string]; re: RegExp };

  const NOUNS: Noun[] = [
    { forms: RU_WEEKS, re: /(?<![\d.,])(\d+)\s+(неделя|недели|недель)(?![а-яё])/gi },
    { forms: RU_TRAININGS, re: /(?<![\d.,])(\d+)\s+(тренировка|тренировки|тренировок)(?![а-яё])/gi },
    { forms: RU_SETS, re: /(?<![\d.,])(\d+)\s+(сет|сета|сетов)(?![а-яё])/gi },
    { forms: RU_EXERCISES, re: /(?<![\d.,])(\d+)\s+(упражнение|упражнения|упражнений)(?![а-яё])/gi },
  ];

  function findBad(text: string): string[] {
    const bad: string[] = [];
    for (const noun of NOUNS) {
      for (const m of text.matchAll(noun.re)) {
        const n = Number(m[1]);
        const want = ruForm(n, noun.forms);
        if (m[2].toLowerCase() !== want) bad.push(`${m[1]} ${m[2]} (нужно «${want}»)`);
      }
    }
    return bad;
  }

  it('отчёт, печать и rationale не содержат «1 недель» / «3 тренировок» / «2 сетов»', () => {
    for (const patternId of ['fullbody_3', 'upper_lower_4', 'ppl_6']) {
      for (const level of ['beginner', 'advanced'] as const) {
        for (const weeks of [1, 3, 6]) {
          const plan: any = buildBBPlan({ patternId, level, goal: 'mass', weeks, workMax: WM });
          const texts: Array<[string, string]> = [
            ['отчёт', buildBBPlanReportText(plan)],
            ['печать', buildBBPlanPrintHtml(plan).replace(/<[^>]*>/g, ' ')],
            ['сводка', formatBBExpandedSummary(plan)],
            ['rationale', (plan.rationale || []).join('\n')],
          ];
          for (const [kind, text] of texts) {
            expect(findBad(text), `${patternId}/${level}/${weeks}н: ${kind}`).toEqual([]);
          }
        }
      }
    }
  }, 600000);
});

describe('хеджи «слово(ов)» не возвращаются в тексты BB/PL/ARM', () => {
  // Итерация AO: 19 мест писали «N приём(ов)», «N строк(и)», «N блок(а)» —
  // это не согласование, а его отсутствие. Ратчет по зонам, за текст которых
  // отвечаем мы; Nutrition и Profile — зона параллельной работы.
  const ROOTS = [
    'src/engines/bb',
    'src/engines/lms',
    'src/engines/arm',
    'src/ui/screens/SRCBBScreen.tsx',
    'src/ui/screens/SRCBBScreen_parts',
    'src/ui/screens/TrainingScreen_parts',
  ];
  // «Выполнил(а)» — настоящий род (м/ж), а не числительное. Не хедж счёта.
  const ALLOWED = new Set(['Выполнил(а)']);
  const HEDGE = /([а-яА-ЯёЁ]{3,})\((ов|ей|а|я|и|ы)\)/g;

  const files: string[] = [];
  const walk = (p: string) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) {
        if (name === '__tests__' || name === 'node_modules') continue;
        walk(join(p, name));
      }
      return;
    }
    if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) return;
    files.push(p);
  };
  for (const root of ROOTS) walk(root);

  it('ни одного «(ов)/(а)/(и)» в строках кода', () => {
    const bad: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (/^(\/\/|\*|\/\*)/.test(trimmed)) return; // комментарии — не текст пользователю
        for (const m of line.matchAll(HEDGE)) {
          if (ALLOWED.has(m[0])) continue;
          bad.push(`${file}:${i + 1}: ${m[0]}`);
        }
      });
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
