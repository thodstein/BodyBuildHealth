/**
 * lab-numeric-norms.test.ts — проход 60: числовой дрейф печёночных/ГГТ/кровяных
 * ступеней и пол в системе тиров.
 *
 *  - ГГТ жила тремя способами: `risk-verification` ♂ `[55,110,220]` (1×/2×/4×ВГН)
 *    и ♀ `[32,48,96]` (1.03×/1.5×/3×), таблица тиров `110/200`, женский протокол
 *    от 31. Теперь одна шкала `GGT_ULN` + `GGT_STAGE_ULN` (♀ 31/62/93).
 *  - `risk-engine-tz-spec` держал мужские ступени 5×ВГН (`[40,80,200]`) там, где
 *    канон прохода 57 — 1×/2×/3× (`[40,80,120]`), и креатинин с первой ступенью
 *    90 при ВГН 110.
 *  - `deriveTier` брал мужской ряд для всех: ALT 35 / HCT 49 / HGB 160 / ГГТ 40
 *    у женщины читались как «норма».
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveTier, LAB_TIERS } from '../../data/lab-tier-ranges';
import {
  GGT_ULN, GGT_STAGE_ULN, LFT_ULN, LFT_STAGE_ULN,
  HCT_THRESHOLDS, HGB_THRESHOLDS, CREATININE_ULN, CREATININE_STEPS, RBC_ULN,
  UA_ULN, UA_STAGE_ULN, SCREEN_TARGETS, FT_STEPS, PRL_STEPS, FERRITIN_STEPS,
} from '../lab-norms.engine';
import { VERIFICATION_SYSTEMS, markerThresholds, type VerifMarker } from '../risk-verification.engine';

const findMarker = (systemId: string, mechId: string, code: string): VerifMarker => {
  const sys = VERIFICATION_SYSTEMS.find(s => s.id === systemId)!;
  return sys.mechanisms.find(m => m.id === mechId)!.markers.find(mk => mk.code === code)!;
};

describe('ГГТ: одна шкала вместо трёх', () => {
  it('ВГН и ступени 2×/3× от своего пола', () => {
    expect(GGT_ULN).toEqual({ male: 55, female: 31 });
    expect(GGT_STAGE_ULN.double).toEqual({ male: 110, female: 62 });
    expect(GGT_STAGE_ULN.triple).toEqual({ male: 165, female: 93 });
  });

  it('risk-verification берёт числа из лестницы (было 220/96)', () => {
    const ggt = findMarker('hepatic', 'liv2', 'GGT');
    expect(markerThresholds(ggt, 'male')).toEqual([55, 110, 165]);
    expect(markerThresholds(ggt, 'female')).toEqual([31, 62, 93]);
  });

  it('таблица тиров — тот же мужской ряд', () => {
    const row = LAB_TIERS.GGT;
    expect(row.normal).toEqual([0, GGT_ULN.male]);
    expect(row.borderline).toEqual([GGT_ULN.male, GGT_STAGE_ULN.double.male]);
    expect(row.treatment).toEqual([GGT_STAGE_ULN.double.male, GGT_STAGE_ULN.triple.male]);
    expect(row.emergencyHigh).toBe(GGT_STAGE_ULN.triple.male);
  });
});

describe('deriveTier знает пол (женский ряд — от её ВГН)', () => {
  it('АЛТ 35: у мужчины норма, у женщины ≥ ВГН 31 — грань', () => {
    expect(deriveTier('ALT', 35, 'male')).toBe(0);
    expect(deriveTier('ALT', 35, 'female')).toBe(1);
    expect(deriveTier('ALT', 35)).toBe(0); // без sex — прежний мужской путь
  });

  it('АЛТ 70: мужчина грань, женщина ≥ 2×ВГН 62 — лечение', () => {
    expect(deriveTier('ALT', 70, 'male')).toBe(1);
    expect(deriveTier('ALT', 70, 'female')).toBe(2);
  });

  it('ГГТ 40: мужчина норма, женщина ≥ 31 — грань', () => {
    expect(deriveTier('GGT', 40, 'male')).toBe(0);
    expect(deriveTier('GGT', 40, 'female')).toBe(1);
  });

  it('HCT 49 и 53: женские зоны 48/52', () => {
    expect(deriveTier('HCT', 49, 'male')).toBe(0);
    expect(deriveTier('HCT', 49, 'female')).toBe(1);
    expect(deriveTier('HCT', 53, 'male')).toBe(1);
    expect(deriveTier('HCT', 53, 'female')).toBe(2);
  });

  it('HGB 160: мужчина норма (верх 170), женщина ≥ 150', () => {
    expect(deriveTier('HGB', 160, 'male')).toBe(0);
    expect(deriveTier('HGB', 160, 'female')).toBe(1);
    expect(deriveTier('HEMOGLOBIN', 160, 'female')).toBe(1);
  });

  it('креатинин 100: мужчина норма (ВГН 110), женщина ≥ 97', () => {
    expect(deriveTier('CREATININE', 100, 'male')).toBe(0);
    expect(deriveTier('CREATININE', 100, 'female')).toBe(1);
  });

  it('ступени тиров совпадают с резолвером норм', () => {
    expect(LAB_TIERS.ALT.emergencyHigh).toBe(LFT_STAGE_ULN.stopOral.male);
    expect(LAB_TIERS.HCT.normal[1]).toBe(HCT_THRESHOLDS.male.erythrocytosis);
    expect(LAB_TIERS.HCT.treatment[0]).toBe(HCT_THRESHOLDS.male.block);
    expect(LAB_TIERS.HGB.normal[1]).toBe(HGB_THRESHOLDS.male.upper);
    expect(LAB_TIERS.HGB.borderline[1]).toBe(HGB_THRESHOLDS.male.block);
    expect(LAB_TIERS.CREATININE.normal[1]).toBe(CREATININE_ULN.male);
    expect(LFT_ULN.ALT.male).toBe(40);
  });
});

describe('HCT/HGB: один ряд на маркер во всех системах', () => {
  it('HCT = HCT_THRESHOLDS (+4 п.п.), HGB = HGB_THRESHOLDS (+15 г/л)', () => {
    const hcts: VerifMarker[] = [];
    const hgbs: VerifMarker[] = [];
    for (const sys of VERIFICATION_SYSTEMS) {
      for (const mech of sys.mechanisms) {
        for (const mk of mech.markers) {
          if (mk.code === 'HCT') hcts.push(mk);
          if (mk.code === 'HGB') hgbs.push(mk);
        }
      }
    }
    // cv4, cv5, hem1 — раньше у них были три разных ряда.
    expect(hcts.length).toBeGreaterThanOrEqual(3);
    for (const m of hcts) {
      expect(markerThresholds(m, 'male')).toEqual([
        HCT_THRESHOLDS.male.erythrocytosis, HCT_THRESHOLDS.male.block, HCT_THRESHOLDS.male.block + 4,
      ]);
      expect(markerThresholds(m, 'female')).toEqual([
        HCT_THRESHOLDS.female.erythrocytosis, HCT_THRESHOLDS.female.block, HCT_THRESHOLDS.female.block + 4,
      ]);
    }
    expect(hgbs.length).toBeGreaterThanOrEqual(1);
    for (const m of hgbs) {
      expect(markerThresholds(m, 'male')).toEqual([
        HGB_THRESHOLDS.male.upper, HGB_THRESHOLDS.male.block, HGB_THRESHOLDS.male.block + 15,
      ]);
      expect(markerThresholds(m, 'female')).toEqual([
        HGB_THRESHOLDS.female.upper, HGB_THRESHOLDS.female.block, HGB_THRESHOLDS.female.block + 15,
      ]);
    }
  });

  it('RBC = RBC_ULN (+0.4 / +0.8): мужской ряд не ниже своей ВГН', () => {
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const rbcs: VerifMarker[] = [];
    for (const sys of VERIFICATION_SYSTEMS) {
      for (const mech of sys.mechanisms) {
        for (const mk of mech.markers) if (mk.code === 'RBC') rbcs.push(mk);
      }
    }
    expect(rbcs.length).toBeGreaterThanOrEqual(1);
    for (const m of rbcs) {
      expect(markerThresholds(m, 'male')).toEqual([
        RBC_ULN.male, round1(RBC_ULN.male + 0.4), round1(RBC_ULN.male + 0.8),
      ]);
      expect(markerThresholds(m, 'female')).toEqual([
        RBC_ULN.female, round1(RBC_ULN.female + 0.4), round1(RBC_ULN.female + 0.8),
      ]);
    }
  });
});

describe('исходник главной модели: литеральные ступени печени/ГГТ убраны', () => {
  // Комментарии объясняют, какие литералы убраны, — сканируем только код.
  const tz = readFileSync(resolve(process.cwd(), 'src/engines/risk-engine-tz-spec.ts'), 'utf8')
    .split(/\r?\n/)
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n');

  it('liv1/liv2 считают от LFT_STAGE_ULN и GGT_STAGE_ULN', () => {
    expect(tz).toContain('LFT_STAGE_ULN.reduce[lftSex]');
    expect(tz).toContain('GGT_STAGE_ULN.triple');
    expect(tz).not.toContain('[40,80,200]');
    expect(tz).not.toContain('[55,110,220]');
    expect(tz).not.toContain('[32,48,96]');
  });

  it('креатинин, гематокрит, гемоглобин и эритроциты — от резолвера', () => {
    // Проход 126: ступени переехали в `lab-norms` (CREATININE_STEPS/HCT_STEPS/
    // HGB_STEPS/RBC_STEPS), чтобы каталог «Анализы» и эта модель читали один ряд.
    expect(tz).toContain('CREATININE_STEPS');
    expect(tz).toContain('HCT_STEPS');
    expect(tz).toContain('HGB_STEPS');
    expect(tz).toContain('RBC_STEPS');
    expect(tz).not.toContain('[90,130,200]');
    expect(tz).not.toContain('[50,54,58]');
    expect(tz).not.toContain('[170,180,190]');
    expect(tz).not.toContain('[5.5,6.0,6.5]');
  });

  // Проход 77: мочевая кислота держала мужской литерал, поэтому у женщины 380
  // мкмоль/л не давало вклада в риск, хотя её ВГН 350.
  it('мочевая кислота — от UA_STAGE_ULN, литерала [420,480,540] нет', () => {
    expect(tz).toContain('UA_STAGE_ULN');
    expect(tz).not.toContain('[420,480,540]');
  });

  // Проходы 125/126: свободный тест, пролактин, ферритин и билирубин держали
  // собственные литералы в обоих движках. Свободный тест — в пмоль/л при каноне
  // пг/мл (норма 15 пг/мл читалась как m=3), билирубин — второй ряд 21/50/100,
  // пролактин и ферритин — без женских веток.
  it('FT/PRL/ферритин/билирубин — от резолвера', () => {
    expect(tz).toContain('FT_STEPS');
    expect(tz).toContain('PRL_STEPS');
    expect(tz).toContain('FERRITIN_STEPS');
    expect(tz).toContain('BILIRUBIN_FLAG_STEPS');
    expect(tz).not.toContain('[250,150,50]');
    expect(tz).not.toContain('[10,15,25]');
    expect(tz).not.toContain('[300,400,500]');
    expect(tz).not.toContain('[21,50,100]');
  });
});

describe('проходы 125/126: ступени гормонов и почек — одна запись в резолвере', () => {
  it('свободный тест: канон пг/мл, мужской ряд от LLN 8', () => {
    expect(FT_STEPS.male).toEqual([8, 6, 4]);
    expect(FT_STEPS.female).toEqual([10, 15, 25]);
  });

  it('пролактин: женский ряд — 800/1500 мМЕ/л в нг/мл', () => {
    expect(PRL_STEPS.male).toEqual([15, 25, 50]);
    expect(PRL_STEPS.female).toEqual([37.7, 50, 70.8]);
  });

  it('ферритин: цель ♂ 300 / ♀ 150 (SCREEN_TARGETS), дальше 400', () => {
    expect(FERRITIN_STEPS.male).toEqual([SCREEN_TARGETS.FERRITIN.male, 400, 500]);
    expect(FERRITIN_STEPS.female).toEqual([SCREEN_TARGETS.FERRITIN.female, SCREEN_TARGETS.FERRITIN.male, 400]);
  });

  it('креатинин: оба пола начинаются со своей ВГН', () => {
    expect(CREATININE_STEPS.male[0]).toBe(CREATININE_ULN.male);
    expect(CREATININE_STEPS.female[0]).toBe(CREATININE_ULN.female);
    expect(CREATININE_STEPS.male.slice(1)).toEqual([130, 200]);
    expect(CREATININE_STEPS.female.slice(1)).toEqual([130, 200]);
  });

  it('каталог «Анализы» читает те же ряды', () => {
    const ft = findMarker('reproductive', 'rep2', 'FT');
    expect(ft.unit).toBe('пг/мл');
    expect(markerThresholds(ft)).toEqual(FT_STEPS.male);
    expect(markerThresholds(ft, 'female')).toEqual(FT_STEPS.female);
    const fer = findMarker('cns', 'cns2', 'FERRITIN');
    expect(markerThresholds(fer, 'female')).toEqual(FERRITIN_STEPS.female);
  });
});

describe('мочевая кислота: ВГН и ступени половые (проход 77)', () => {
  it('одна пара ВГН и одна лестница ступеней', () => {
    expect(UA_ULN).toEqual({ male: 420, female: 350 });
    expect(UA_STAGE_ULN.male).toEqual([420, 480, 540]);
    expect(UA_STAGE_ULN.female).toEqual([350, 400, 450]);
  });

  it('risk-verification: те же ступени, что в резолвере', () => {
    const ua = findMarker('renal', 'ren1', 'UA');
    expect(markerThresholds(ua, 'male')).toEqual(UA_STAGE_ULN.male);
    expect(markerThresholds(ua, 'female')).toEqual(UA_STAGE_ULN.female);
  });

  it('тиры: 380 у мужчины — норма, у женщины — грань (её ВГН 350)', () => {
    expect(LAB_TIERS.URIC_ACID.normal[1]).toBe(UA_STAGE_ULN.male[0]);
    expect(deriveTier('URIC_ACID', 380, 'male')).toBe(0);
    expect(deriveTier('URIC_ACID', 380, 'female')).toBe(1);
    expect(deriveTier('URIC_ACID', 380)).toBe(0); // без sex — прежний мужской путь
  });
});
