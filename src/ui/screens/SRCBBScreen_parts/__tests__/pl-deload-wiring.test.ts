/**
 * pl-deload-wiring.test.ts — source-guard проводки «делод по кнопке пользователя»:
 *  - SRCBBScreen реально применяет applyPLDeload к САМОМУ плану (buildSrc,
 *    buildSrcMacrocycle, мост kind 'deload', откат) — не только runtime-оверлей;
 *  - конфиг делода персистится merge-записью he_pl_session (не теряется);
 *  - PLPlanView показывает маркер и кнопку «↩ Убрать делод».
 * jsdom-рендер god-компонента не делаем (виснет) — паттерн pl-meet-registry-wiring.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PARTS = 'src/ui/screens/SRCBBScreen_parts';
const screen = readFileSync(resolve(process.cwd(), 'src/ui/screens/SRCBBScreen.tsx'), 'utf8');
const view = readFileSync(resolve(process.cwd(), `${PARTS}/PLPlanView.tsx`), 'utf8');
const season = readFileSync(resolve(process.cwd(), `${PARTS}/PLSeasonBuilder.tsx`), 'utf8');
const compTab = readFileSync(resolve(process.cwd(), `${PARTS}/PLCompetitionTab.tsx`), 'utf8');

describe('ПЛ-авто: делод по кнопке — проводка (source-guard)', () => {
  it('SRCBBScreen импортирует движок делода и применяет его к плану', () => {
    expect(screen).toContain("from '../../engines/lms/lms-deload.engine'");
    const calls = (screen.match(/applyPLDeload\(/g) || []).length;
    // buildSrc + buildSrcMacrocycle + мост kind deload + откат (импорт не считается)
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(screen).toContain('planHasDeload(effectiveSrc ?? builtSrc)');
    expect(screen).toContain('onRemoveDeload');
  });

  it('конфиг делода персистится merge-записью he_pl_session', () => {
    expect(screen).toContain('plDeloadCfg');
    // merge: читаем текущий объект и распространяем его (иначе season/peds терялись)
    expect(screen).toMatch(/const prev = raw \? JSON\.parse\(raw\) : null/);
    expect(screen).toMatch(/\.\.\.base,/);
  });

  it('PLPlanView: маркеры и кнопка отката', () => {
    expect(view).toContain('data-pl="deload-remove"');
    expect(view).toContain('data-pl="deload-banner"');
    expect(view).toContain('🔋');
    expect(view).toContain('isDeloadWeek');
  });

  it('мост kind deload в ПЛ не сводится к runtime-оверлею (честный откат + заметка)', () => {
    expect(screen).toMatch(/p\.kind === 'deload'/);
    expect(screen).toContain('setDeloadAdjust(null)');
    expect(screen).toContain('Делод убран');
  });

  it('сезон: консенты/выборы не съезжают при выключении слота (индексная карта)', () => {
    expect(season).toContain('enabledIdxOf');
    expect(season).toContain('slotIndex');
    expect(season).toContain('toEnabledKeyed');
  });

  it('тапер: честный контур встроен/не встроен с реальным откатом', () => {
    expect(compTab).toContain("he_pl_prev_weeks_v1");
    expect(compTab).toContain('Убрать тапер из плана');
    expect(compTab).toContain('sessionStorage.setItem(TAPER_PREV_KEY');
  });
});
