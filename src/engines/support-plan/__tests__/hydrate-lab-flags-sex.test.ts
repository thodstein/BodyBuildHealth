/**
 * hydrate-lab-flags-sex.test.ts — проход 98: клинические флаги из анализов
 * знают пол.
 *
 * Было: `hydrateState` выводил `altAstElevation`, `ggtElevation`,
 * `creatinineElevation` и `hctElevation` по литералам 40/55/100/110/52/56/60 —
 * то есть по мужской шкале и по ряду, которого нет ни в одном источнике.
 * Женщина с АЛТ 35 (её ВГН 31) получала «none», с креатинином 100 (её ВГН 97) —
 * «none», с HCT 50 (её эритроцитоз-порог 48) — «none». Эти флаги — вход риск-
 * движка и рекомендаций, поэтому занижение было не косметическим.
 *
 * Стало: флаги считаются от резолвера с полом профиля (`LFT_ULN` +
 * `LFT_STAGE_ULN`, `GGT_ULN` + `GGT_STAGE_ULN`, `CREATININE_ULN`, `HCT_STEPS`).
 * Мужской ряд АЛТ/креатинина не изменился, ГГТ и HCT приведены к канону
 * (♂ 55/110/165 и 51/54/58 вместо 55/100/200 и 52/56/60).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hydrateState } from '../index';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal('localStorage', localStorageMock);

const seed = (sex: 'male' | 'female', hct: string) => {
  localStorageMock.clear();
  store['he_profile_v2'] = JSON.stringify({ settings: { personal: { sex } } });
  store['he_labs_history'] = JSON.stringify([{
    date: '2026-11-01',
    panelBiochem: { ALT: '35', AST: '34', GGT: '40', Creatinine: '100', Bilirubin: '10' },
    panelHematology: { HCT: hct },
  }]);
};

const flags = (sex: 'male' | 'female', hct = '50') => {
  seed(sex, hct);
  const h = hydrateState();
  return {
    hep: h.hepatobiliary,
    urinary: h.urinary,
    cardio: h.cardio,
  } as any;
};

describe('проход 98: флаги из анализов — по нормам пола', () => {
  it('женщина: АЛТ 35 и ГГТ 40 выше её ВГН 31 — «mild», креатинин 100 — «mild»', () => {
    const f = flags('female');
    expect(f.hep.altAstElevation).toBe('mild');
    expect(f.hep.ggtElevation).toBe('mild');
    expect(f.urinary.creatinineElevation).toBe('mild');
    expect(f.hep.bilirubinElevation).toBe('none');
  });

  it('мужчина на тех же цифрах — всё «none»: 35 < 40, 40 < 55, 100 < 110', () => {
    const f = flags('male');
    expect(f.hep.altAstElevation).toBe('none');
    expect(f.hep.ggtElevation).toBe('none');
    expect(f.urinary.creatinineElevation).toBe('none');
  });

  it('HCT: женщина 48 — уже «mild», мужчина 50 — ещё «none»', () => {
    expect(flags('female', '48').cardio.hctElevation).toBe('mild');
    expect(flags('male', '50').cardio.hctElevation).toBe('none');
    expect(flags('male', '51').cardio.hctElevation).toBe('mild');
  });

  it('HCT-ступени по канону: ♀ 52 — «moderate», 56 — «severe»; ♂ 54 — «moderate», 58 — «severe»', () => {
    expect(flags('female', '52').cardio.hctElevation).toBe('moderate');
    expect(flags('female', '56').cardio.hctElevation).toBe('severe');
    expect(flags('male', '54').cardio.hctElevation).toBe('moderate');
    expect(flags('male', '58').cardio.hctElevation).toBe('severe');
  });

  it('ГГТ-ступени по канону: ♂ 110 и 165, ♀ 62 и 93', () => {
    const ggt = (sex: 'male' | 'female', val: string) => {
      localStorageMock.clear();
      store['he_profile_v2'] = JSON.stringify({ settings: { personal: { sex } } });
      store['he_labs_history'] = JSON.stringify([{ date: '2026-11-01', panelBiochem: { GGT: val } }]);
      return (hydrateState().hepatobiliary as any).ggtElevation;
    };
    expect(ggt('male', '55')).toBe('mild');
    expect(ggt('male', '110')).toBe('moderate');
    expect(ggt('male', '165')).toBe('severe');
    expect(ggt('female', '31')).toBe('mild');
    expect(ggt('female', '62')).toBe('moderate');
    expect(ggt('female', '93')).toBe('severe');
  });
});

describe('проход 98: источник флагов и триггера рекомендаций', () => {
  const engine = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine.ts'), 'utf8');

  it('флаги берут шкалы резолвера, литералов не осталось', () => {
    expect(engine).toContain("const sexKey: 'male' | 'female' = result.profile?.sex === 'female' ? 'female' : 'male';");
    expect(engine).toContain('const lftUln = LFT_ULN.ALT[sexKey];');
    expect(engine).toContain('const ggtDouble = GGT_STAGE_ULN.double[sexKey];');
    expect(engine).toContain('const crUln = CREATININE_ULN[sexKey];');
    expect(engine).toContain('const [hctErythrocytosis, hctBlock, hctHyperviscosity] = HCT_STEPS[sexKey];');
    expect(engine).not.toContain('maxTransam < 40 ?');
    expect(engine).not.toContain('ggt < 55 ?');
    expect(engine).not.toContain('creatinine < 110 ?');
    expect(engine).not.toContain('hct < 52 ?');
  });

  it('триггер HCT в рекомендациях — та же ступень, без пары 50/46 и «>54»', () => {
    const rec = readFileSync(resolve(process.cwd(), 'src/engines/recommendation-engine.ts'), 'utf8');
    expect(rec).toContain("const [hctErythrocytosis, hctBlock] = HCT_STEPS[sex === 'female' ? 'female' : 'male'];");
    expect(rec).not.toContain("sex === 'male' ? 50 : 46");
    expect(rec).not.toContain('hctVal > 54');
  });
});
