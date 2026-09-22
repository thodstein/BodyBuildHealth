/**
 * pl-meet-registry-wiring.test.ts — проводка единого реестра стартов ПЛ:
 * SRCBBScreen гидратирует слияние и синхронизирует обратно, MacrocyclePanel
 * персистит правки соревнований года (раньше терялись при перезагрузке).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('единый реестр стартов: проводка', () => {
  it('SRCBBScreen: слияние при монтировании/событии года + обратная запись стартов', () => {
    const src = read('src/ui/screens/SRCBBScreen.tsx');
    expect(src).toContain('mergeMeetRegistry');
    expect(src).toContain('syncCompetitionsFromMeets');
    expect(src).toContain("window.addEventListener('he-pl-macrocycle-updated'");
    expect(src).toContain("localStorage.setItem('he_pl_macro'");
  });

  it('MacrocyclePanel: правки competitions персистятся в macro (а не только при пересборке)', () => {
    const src = read('src/ui/screens/SRCBBScreen_parts/MacrocyclePanel.tsx');
    expect(src).toContain('competitions: competitions.length > 0 ? competitions : undefined');
  });
});
