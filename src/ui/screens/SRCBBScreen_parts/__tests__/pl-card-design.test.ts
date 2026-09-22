/**
 * pl-card-design.test.ts — Фазы 3: единый дизайн карточек ПЛ-авто.
 *
 * Контракт:
 *  1. Живые файлы ПЛ-авто не определяют локальные токены CARD/SMALL/BTN/BTN_GHOST/IN
 *     (только импорт из training-ui).
 *  2. Нет серого текста `color: rgba(255,255,255,0.xx)` (рамки borderColor не считаются).
 *  3. Ключевые карточные файлы реально импортируют кит training-ui.
 *  4. СТРУКТУРА (Фаза 3, эталон BbCard/BbFoldCard): живые PL-карточки используют
 *     `BbCard`/`BbFoldCard` из training-ui; локальных `SectionCard`-дублей нет;
 *     кит даёт иконка-тайл (26px) + заголовок 12.5/800 + верхнюю кромку акцента.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbCard, BbFoldCard } from '../../TrainingScreen_parts/training-ui';
import { BlockView } from '../BlockView';

const PARTS = 'src/ui/screens/SRCBBScreen_parts';
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

const LIVE_PL_FILES = [
  'src/ui/screens/SRCBBScreen.tsx',
  `${PARTS}/PLPlanView.tsx`,
  `${PARTS}/PLCompetitionTab.tsx`,
  `${PARTS}/PLSeasonBuilder.tsx`,
  `${PARTS}/PLToolsCard.tsx`,
  `${PARTS}/MacrocyclePanel.tsx`,
  `${PARTS}/BlockView.tsx`,
  `${PARTS}/SessionPlayer.tsx`,
  `${PARTS}/TrainingPopups.tsx`,
  `${PARTS}/TaperCoachCard.tsx`,
];

/** Файлы, где карточные секции обязаны идти через кит (структурный контракт). */
const KIT_CARD_FILES = [
  'src/ui/screens/SRCBBScreen.tsx',
  `${PARTS}/PLPlanView.tsx`,
  `${PARTS}/PLCompetitionTab.tsx`,
  `${PARTS}/PLSeasonBuilder.tsx`,
  `${PARTS}/PLToolsCard.tsx`,
  `${PARTS}/MacrocyclePanel.tsx`,
  `${PARTS}/BlockView.tsx`,
];

const TOKEN_FILES = [
  'src/ui/screens/SRCBBScreen.tsx',
  `${PARTS}/PLPlanView.tsx`,
  `${PARTS}/PLCompetitionTab.tsx`,
  `${PARTS}/TaperCoachCard.tsx`,
];

describe('ПЛ-авто: единый дизайн карточек', () => {
  it('нет локальных копий токенов CARD/SMALL/BTN/BTN_GHOST/IN', () => {
    const localToken = /const (CARD|SMALL|BTN|BTN_GHOST|IN)\s*:\s*React\.CSSProperties/;
    for (const rel of LIVE_PL_FILES) {
      expect(localToken.test(read(rel)), rel).toBe(false);
    }
  });

  it('нет серого текста color: rgba(255,255,255,0.x) (borderColor исключён)', () => {
    const grayText = /(^|[^A-Za-z])color:\s*'rgba\(255,\s*255,\s*255,\s*0?\.\d+\)'/m;
    for (const rel of LIVE_PL_FILES) {
      expect(grayText.test(read(rel)), rel).toBe(false);
    }
  });

  it('карточные файлы импортируют кит training-ui', () => {
    for (const rel of TOKEN_FILES) {
      expect(read(rel)).toContain('TrainingScreen_parts/training-ui');
    }
  });

  it('карточные секции ПЛ идут через BbCard/BbFoldCard (не локальная разметка)', () => {
    for (const rel of KIT_CARD_FILES) {
      const src = read(rel);
      expect(/<BbCard[\s>]/.test(src) || /<BbFoldCard[\s>]/.test(src), rel).toBe(true);
      // BbCard/BbFoldCard — импорт из единого кита.
      const importsKit = /import\s*\{[^}]*\b(BbCard|BbFoldCard)\b[^}]*\}\s*from\s*'[^']*training-ui'/.test(src);
      expect(importsKit, rel).toBe(true);
    }
  });

  it('нет локальных SectionCard-дублей в живых PL-файлах', () => {
    const localSectionCard = /const SectionCard\s*[:=]/;
    for (const rel of LIVE_PL_FILES) {
      expect(localSectionCard.test(read(rel)), rel).toBe(false);
    }
  });

  it('один набор карточек: ББ-авто ре-экспортирует кит training-ui (третьего набора нет)', () => {
    const shared = read('src/ui/screens/TrainingScreen_parts/bb-auto-constructor-shared.tsx');
    expect(shared).toContain("export { BbCard, BbFoldCard } from './training-ui'");
    expect(shared).not.toMatch(/const BbCard\s*[:=]/);
    expect(shared).not.toMatch(/const BbFoldCard\s*[:=]/);
    const kit = read('src/ui/screens/TrainingScreen_parts/training-ui.tsx');
    expect(kit).toContain('export const BbCard');
    expect(kit).toContain('export const BbFoldCard');
    expect(kit).toContain('export function bbCardChrome');
    expect(kit).toContain('export function bbIconTile');
  });

  it('fold-карточки попапов берут обвязку/тайл из кита (копий значений нет)', () => {
    const popups = read(`${PARTS}/TrainingPopups.tsx`);
    expect(popups).toContain('bbCardChrome');
    expect(popups).toContain('bbIconTile');
    expect(popups).toContain("from '../TrainingScreen_parts/training-ui'");
    // Кромка/тайл — только из кита, не локальные литералы.
    expect(popups).not.toMatch(/borderTop:\s*`2px solid \$\{accent\}55`/);
    expect(popups).not.toMatch(/width:\s*26,\s*height:\s*26/);
  });

  it('DOM-дамп кита: иконка-тайл + заголовок 12.5/800 + верхняя кромка (BbCard)', () => {
    const html = renderToStaticMarkup(
      React.createElement(BbCard, { icon: '🧪', title: 'Тест-карточка', accent: '#00e68a' },
        React.createElement('div', null, 'контент')),
    );
    // Верхняя кромка акцента — структурная подпись кита.
    expect(html).toContain('border-top:2px solid #00e68a55');
    // Иконка-тайл.
    expect(html).toContain('width:26px');
    expect(html).toContain('height:26px');
    // Заголовок 12.5/800.
    expect(html).toContain('font-size:12.5px');
    expect(html).toContain('font-weight:800');
    expect(html).toContain('Тест-карточка');
  });

  it('DOM-дамп кита: BbFoldCard — шапка-кнопка с aria-expanded, контент скрыт по умолчанию', () => {
    const html = renderToStaticMarkup(
      React.createElement(BbFoldCard, { icon: '📦', title: 'Свернутое', accent: '#60a5fa' },
        React.createElement('div', null, 'скрытый-контент')),
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('border-top:2px solid #60a5fa55');
    expect(html).not.toContain('скрытый-контент');
  });

  it('DOM-дамп живой PL-карточки (BlockView): кит-шапка + кромка + тайл, контент под fold', () => {
    const plan = {
      template: { meta: { title: 'тест' } },
      progressionRationale: '',
      cycleMetrics: {},
      weeks: [{ week: 1, pmRow: { 'Присед': 200 }, days: [{ exercises: [{ name: 'Присед', workSets: [{ sets: 3, reps: 5, pct: 0.8, weight: 160 }], rir: 2 }] }] }],
    };
    const html = renderToStaticMarkup(React.createElement(BlockView, { plan: plan as never }));
    expect(html).toContain('class="pl-blockview"');
    expect(html).toContain('border-top:2px solid #a78bfa55');
    expect(html).toContain('width:26px');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('PowerSheets');
  });
});
