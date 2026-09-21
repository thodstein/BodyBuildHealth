/**
 * pl-card-design.test.ts — Фаза 3: единый дизайн карточек ПЛ-авто.
 *
 * Контракт:
 *  1. Живые файлы ПЛ-авто не определяют локальные токены CARD/SMALL/BTN/BTN_GHOST/IN
 *     (только импорт из training-ui).
 *  2. Нет серого текста `color: rgba(255,255,255,0.xx)` (рамки borderColor не считаются).
 *  3. Ключевые карточные файлы реально импортируют кит training-ui.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
});
