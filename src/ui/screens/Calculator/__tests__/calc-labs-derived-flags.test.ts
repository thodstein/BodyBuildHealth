/**
 * calc-labs-derived-flags.test.ts — проход 103: флаги калькулятора из анализов
 * считаются теми же таблицами резолвера, что и «Поддержка».
 *
 * Было: `deriveStateFromLabs` брал ВГН из резолвера (пол учитывался), но ступени
 * считал своими множителями: АЛТ `×2/×3`, ГГТ `×2/×4`, билирубин `×2/×3.5`,
 * ЛПНП 3.0/4.0/5.0, ЛПВП `< 1.0`, ТГ 1.7/2.3, креатинин `+20/+40`. Из-за этого
 * один и тот же бланк давал разные вердикты на двух экранах:
 *  — ГГТ 200 у мужчины: «moderate» здесь (×4 = 220) и «severe» в «Поддержке»
 *    (×3 = 165);
 *  — билирубин 35: «moderate» здесь (34.2) и «mild» в «Поддержке» (40); 18–21:
 *    «mild» здесь и «норма» там;
 *  — ЛПВП 1.1 у женщины: «норма» здесь и «низко» в таблице рекомендаций (1.2);
 *  — ТГ 2.0 записывалось как `'mild'` — значение, которого не понимал никто:
 *    `engine-helpers` даёт +10 к кардио-риску только за `'elevated'`.
 *
 * Стало: ступени берутся из `LFT_ULN`/`LFT_STAGE_ULN`, `GGT_ULN`/`GGT_STAGE_ULN`,
 * `BILIRUBIN_FLAG_STEPS` (от ВГН 17.1: 17.1/39.3/59.9 — выше границы уже
 * отклонение), `LDL_FLAG_STEPS`, `TG_FLAG_STEPS` (+ значение `'elevated'`),
 * `HDL_LOW` и `CREATININE_ULN` + `CREATININE_FLAG_STEP`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveStateFromLabs } from '../Calc.labs-derived';

const bio = (v: Record<string, string>) => ({ panelBiochem: v } as any);
const lipid = (v: Record<string, string>) => ({ panelLipid: v } as any);

describe('проход 103: АЛТ/АСТ — ступени резолвера (♂ 40/80/120, ♀ 31/62/93)', () => {
  it('мужчина: 39 «none», 40 «mild», 80 «moderate», 120 «severe»', () => {
    const alt = (v: string) => deriveStateFromLabs(bio({ ALT: v }), 'male').hepatobiliary.altAstElevation;
    expect(alt('39')).toBe('none');
    expect(alt('40')).toBe('mild');
    expect(alt('80')).toBe('moderate');
    expect(alt('120')).toBe('severe');
  });

  it('женщина: 30 «none», 31 «mild», 62 «moderate», 93 «severe»', () => {
    const alt = (v: string) => deriveStateFromLabs(bio({ ALT: v }), 'female').hepatobiliary.altAstElevation;
    expect(alt('30')).toBe('none');
    expect(alt('31')).toBe('mild');
    expect(alt('62')).toBe('moderate');
    expect(alt('93')).toBe('severe');
  });
});

describe('проход 103: ГГТ — третья ступень это ×3 ВГН, а не ×4', () => {
  it('мужчина: 109 «mild», 110 «moderate», 164 «moderate», 165 «severe»', () => {
    const ggt = (v: string) => deriveStateFromLabs(bio({ GGT: v }), 'male').hepatobiliary.ggtElevation;
    expect(ggt('54')).toBe('none');
    expect(ggt('55')).toBe('mild');
    expect(ggt('109')).toBe('mild');
    expect(ggt('110')).toBe('moderate');
    expect(ggt('164')).toBe('moderate');
    expect(ggt('165')).toBe('severe');
  });

  it('женщина: 62 «moderate», 93 «severe» (было до 124 «moderate»)', () => {
    const ggt = (v: string) => deriveStateFromLabs(bio({ GGT: v }), 'female').hepatobiliary.ggtElevation;
    expect(ggt('31')).toBe('mild');
    expect(ggt('62')).toBe('moderate');
    expect(ggt('93')).toBe('severe');
  });
});

describe('проход 103: билирубин — от ВГН (17.1 / 39.3 / 59.9), как в «Поддержке»', () => {
  it('границы 17/18, 39/40, 59/60', () => {
    const bil = (v: string) => deriveStateFromLabs(bio({ Bilirubin: v }), 'male').hepatobiliary.bilirubinElevation;
    expect(bil('17')).toBe('none');
    expect(bil('18')).toBe('mild');
    expect(bil('39')).toBe('mild');
    expect(bil('40')).toBe('moderate');
    expect(bil('59')).toBe('moderate');
    expect(bil('60')).toBe('severe');
  });
});

describe('проход 103: липиды', () => {
  it('ЛПНП: 3.0 «mild», 4.0 «moderate», 5.0 «severe»', () => {
    const ldl = (v: string) => deriveStateFromLabs(lipid({ LDL: v }), 'male').cardio.ldlElevation;
    expect(ldl('2.9')).toBe('none');
    expect(ldl('3.0')).toBe('mild');
    expect(ldl('4.0')).toBe('moderate');
    expect(ldl('5.0')).toBe('severe');
  });

  it('ТГ 2.0 — «elevated», а не «mild»: за него «Поддержка» даёт +10 к риску', () => {
    const tg = (v: string) => deriveStateFromLabs(lipid({ Triglycerides: v }), 'male').cardio.triglycerides;
    expect(tg('1.6')).toBe('normal');
    expect(tg('2.0')).toBe('elevated');
    expect(tg('2.3')).toBe('high');
  });

  it('ЛПВП по полу: 1.1 у женщины «низко», у мужчины — нет', () => {
    expect(deriveStateFromLabs(lipid({ HDL: '1.1' }), 'female').cardio.hdlLow).toBe(true);
    expect(deriveStateFromLabs(lipid({ HDL: '1.1' }), 'male').cardio.hdlLow).toBe(false);
    expect(deriveStateFromLabs(lipid({ HDL: '1.25' }), 'female').cardio.hdlLow).toBe(false);
  });
});

describe('проход 103: креатинин — ВГН пола и общий шаг +20/+40', () => {
  it('мужчина 110/130/150, женщина 97/117/137', () => {
    const cr = (v: string, sex: 'male' | 'female') =>
      deriveStateFromLabs(bio({ Creatinine: v }), sex).urinary.creatinineElevation;
    expect(cr('109', 'male')).toBe('none');
    expect(cr('110', 'male')).toBe('mild');
    expect(cr('130', 'male')).toBe('moderate');
    expect(cr('150', 'male')).toBe('severe');
    expect(cr('96', 'female')).toBe('none');
    expect(cr('97', 'female')).toBe('mild');
    expect(cr('117', 'female')).toBe('moderate');
    expect(cr('137', 'female')).toBe('severe');
  });
});

describe('проход 103: источник ступеней', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.labs-derived.ts'), 'utf8');

  it('множителей и литералов больше нет', () => {
    expect(src).not.toContain('altUln * 2');
    expect(src).not.toContain('ggtUln * 4');
    expect(src).not.toContain('biliUln * 3.5');
    expect(src).not.toContain('hdl < 1.0');
    expect(src).not.toContain('tg < 1.7');
    expect(src).not.toContain("card.triglycerides = 'mild'");
  });

  it('ступени читают резолвер', () => {
    expect(src).toContain('const lftReduce = LFT_STAGE_ULN.reduce[sexKey];');
    expect(src).toContain('ggt < GGT_STAGE_ULN.triple[sexKey]');
    expect(src).toContain('bilirubin < BILIRUBIN_FLAG_STEPS.mild');
    expect(src).toContain('ldl < LDL_FLAG_STEPS.mild');
    expect(src).toContain('card.hdlLow = hdl < HDL_LOW[sexKey];');
    expect(src).toContain('tg < TG_FLAG_STEPS.elevated');
    expect(src).toContain('const crUln = CREATININE_ULN[sexKey];');
  });
});
