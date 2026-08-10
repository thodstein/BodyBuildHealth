import { describe, expect, it } from 'vitest';
import { UCUM_MAP, URINE_PANEL } from '../../core/constants';
import { mapToUcumCode } from '../../core/labs-mapping';
import { BIOMARKER_DICTIONARY, UNIT_MAP, parseLabResults } from '../biomarker-regex-engine';
import { parseLabText } from '../pdf-parser.engine';
import { LAB_MARKER_MAP_BY_NAME } from '../../data/lab-marker-map';

// ═══════════════════════════════════════════════════════════════════════════
// URINE PANEL TESTS — ОАМ + Нечипоренко + суточная протеинурия + Реберг
// ═══════════════════════════════════════════════════════════════════════════

describe('Urine panel (ОАМ) markers coverage', () => {
  const QUANTITATIVE_URINE = [
    'URINE_SG', 'URINE_LEU', 'URINE_ERY', 'URINE_EPITHELIAL', 'URINE_CYLINDERS',
    'URINE_GLUCOSE_Q', 'URINE_KETONES_Q', 'PROTEIN_24H', 'CREATININE_URINE',
    'URINE_VOLUME_24H', 'UROBILINOGEN', 'URINE_NITRITE_Q', 'URINE_BILIRUBIN_Q',
    'NECHIP_LEU', 'NECHIP_ERY', 'NECHIP_CYL',
    'URINE_CALCIUM', 'URINE_OXALATE', 'URINE_URATE',
  ];
  const SEMI_QUANTITATIVE_URINE = [
    'URINE_PROTEIN_QR', 'URINE_GLUCOSE_QR', 'URINE_KETONES_QR',
    'URINE_BILIRUBIN_QR', 'UROBILINOGEN_QR', 'URINE_NITRITE_QR',
    'URINE_LEU_QR', 'URINE_BLOOD_QR',
  ];
  const ALL_URINE = [...QUANTITATIVE_URINE, ...SEMI_QUANTITATIVE_URINE];

  describe('UCUM_MAP entries', () => {
    it.each(ALL_URINE)('UCUM_MAP has key "%s"', (key) => {
      expect(UCUM_MAP[key]).toBeDefined();
      // prefUnit может быть пустой строкой для безразмерных маркеров (URINE_SG, URINE_PH, score)
      expect(UCUM_MAP[key].prefUnit).toBeDefined();
      expect(UCUM_MAP[key].name).toBeTruthy();
      expect(typeof UCUM_MAP[key].uln).toBe('number');
      expect(typeof UCUM_MAP[key].lln).toBe('number');
    });

    it('URINE_SG has density range 1.010-1.025', () => {
      expect(UCUM_MAP['URINE_SG'].lln).toBe(1.010);
      expect(UCUM_MAP['URINE_SG'].uln).toBe(1.025);
    });

    it('URINE_LEU has normal range 0-5 cells/uL', () => {
      expect(UCUM_MAP['URINE_LEU'].lln).toBe(0);
      expect(UCUM_MAP['URINE_LEU'].uln).toBe(5);
    });

    it('PROTEIN_24H upper limit is 150 mg/24h', () => {
      expect(UCUM_MAP['PROTEIN_24H'].uln).toBe(150);
    });

    it('semi-quantitative markers use score unit', () => {
      for (const code of SEMI_QUANTITATIVE_URINE) {
        expect(UCUM_MAP[code].prefUnit).toBe('score');
      }
    });

    it('semi-quantitative markers have uln ≤ 0.5 (norm = negative/traces)', () => {
      for (const code of SEMI_QUANTITATIVE_URINE) {
        expect(UCUM_MAP[code].uln).toBeLessThanOrEqual(0.5);
      }
    });
  });

  describe('URINE_PANEL list', () => {
    it('URINE_PANEL has oam, oam_quant, nechiporenko, protein_24h, reberg, lithogenesis, full panels', () => {
      for (const panel of ['oam', 'oam_quant', 'nechiporenko', 'protein_24h', 'reberg', 'lithogenesis', 'full']) {
        expect(URINE_PANEL[panel]).toBeDefined();
        expect(URINE_PANEL[panel].length).toBeGreaterThan(0);
      }
    });

    it('URINE_PANEL.oam contains semi-quantitative markers (PROTEIN_QR, etc.)', () => {
      expect(URINE_PANEL.oam).toContain('URINE_PROTEIN_QR');
      expect(URINE_PANEL.oam).toContain('URINE_GLUCOSE_QR');
      expect(URINE_PANEL.oam).toContain('URINE_BLOOD_QR');
    });

    it('URINE_PANEL.nechiporenko contains NECHIP_LEU/ERY/CYL', () => {
      expect(URINE_PANEL.nechiporenko).toEqual(['NECHIP_LEU', 'NECHIP_ERY', 'NECHIP_CYL']);
    });

    it('URINE_PANEL.protein_24h contains PROTEIN_24H + CREATININE_URINE + VOLUME', () => {
      expect(URINE_PANEL.protein_24h).toContain('PROTEIN_24H');
      expect(URINE_PANEL.protein_24h).toContain('CREATININE_URINE');
      expect(URINE_PANEL.protein_24h).toContain('URINE_VOLUME_24H');
    });

    it('URINE_PANEL.reberg links CREATININE_URINE + CREATININE + EGFR + VOLUME', () => {
      expect(URINE_PANEL.reberg).toContain('CREATININE_URINE');
      expect(URINE_PANEL.reberg).toContain('CREATININE');
      expect(URINE_PANEL.reberg).toContain('EGFR');
    });

    it('URINE_PANEL.lithogenesis contains calcium, oxalate, urate, uric acid', () => {
      expect(URINE_PANEL.lithogenesis).toContain('URINE_CALCIUM');
      expect(URINE_PANEL.lithogenesis).toContain('URINE_OXALATE');
      expect(URINE_PANEL.lithogenesis).toContain('URINE_URATE');
      expect(URINE_PANEL.lithogenesis).toContain('UA');
      expect(URINE_PANEL.lithogenesis).toContain('URINE_PH');
    });

    it('URINE_PANEL.full contains all urine markers (quant + semi-quant)', () => {
      for (const code of ALL_URINE) {
        expect(URINE_PANEL.full).toContain(code);
      }
      // Also contains previously-added URINE_OSM, UACR, MICROALB, PROTEIN_URINE
      expect(URINE_PANEL.full).toContain('URINE_OSM');
      expect(URINE_PANEL.full).toContain('UACR');
      expect(URINE_PANEL.full).toContain('MICROALB');
      expect(URINE_PANEL.full).toContain('PROTEIN_URINE');
    });

    it('every URINE_PANEL code resolves to a UCUM_MAP key', () => {
      const allCodes = new Set<string>();
      for (const codes of Object.values(URINE_PANEL)) {
        for (const code of codes) allCodes.add(code);
      }
      const missing: string[] = [];
      for (const code of allCodes) {
        const mapped = mapToUcumCode(code);
        if (!UCUM_MAP[mapped]) missing.push(`${code} → ${mapped}`);
      }
      expect(missing).toEqual([]);
    });
  });

  describe('LAB_MARKER_MAP entries', () => {
    it.each(ALL_URINE)('LAB_MARKER_MAP has entry for "%s"', (key) => {
      expect(LAB_MARKER_MAP_BY_NAME[key]).toBeDefined();
      expect(LAB_MARKER_MAP_BY_NAME[key].organ).toBeTruthy();
      expect(LAB_MARKER_MAP_BY_NAME[key].mechanisms.length).toBeGreaterThan(0);
      expect(LAB_MARKER_MAP_BY_NAME[key].correctionIds.length).toBeGreaterThan(0);
    });

    it('URINE_LEU corrections include D-mannose and cranberry (UTI prevention)', () => {
      expect(LAB_MARKER_MAP_BY_NAME['URINE_LEU'].correctionIds).toContain('d_mannose');
      expect(LAB_MARKER_MAP_BY_NAME['URINE_LEU'].correctionIds).toContain('cranberry');
    });

    it('PROTEIN_24H corrections include telmisartan (renoprotection)', () => {
      expect(LAB_MARKER_MAP_BY_NAME['PROTEIN_24H'].correctionIds).toContain('telmisartan');
    });
  });

  describe('BIOMARKER_DICTIONARY entries', () => {
    it.each(ALL_URINE)('BIOMARKER_DICTIONARY has "%s"', (code) => {
      expect(BIOMARKER_DICTIONARY[code]).toBeDefined();
      expect(BIOMARKER_DICTIONARY[code].length).toBeGreaterThan(0);
    });

    it.each(ALL_URINE)('UNIT_MAP has unit for "%s"', (code) => {
      expect(UNIT_MAP[code]).toBeDefined();
    });
  });

  describe('CODE_ALIAS mappings', () => {
    it('URINE_PROTEIN alias maps to PROTEIN_URINE (existing marker)', () => {
      expect(mapToUcumCode('URINE_PROTEIN')).toBe('PROTEIN_URINE');
    });

    it('URINE_CREATININE alias maps to CREATININE_URINE (new marker)', () => {
      expect(mapToUcumCode('URINE_CREATININE')).toBe('CREATININE_URINE');
    });

    it('NECHIP_LEUKOCYTES alias maps to NECHIP_LEU', () => {
      expect(mapToUcumCode('NECHIP_LEUKOCYTES')).toBe('NECHIP_LEU');
    });

    it('URINE_SPECIFIC_GRAVITY alias maps to URINE_SG', () => {
      expect(mapToUcumCode('URINE_SPECIFIC_GRAVITY')).toBe('URINE_SG');
    });

    it('URINE_PROTEIN_24H alias maps to PROTEIN_24H', () => {
      expect(mapToUcumCode('URINE_PROTEIN_24H')).toBe('PROTEIN_24H');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEMI-QUANTITATIVE PARSING — recognition of qualitative signs (neg, +, ++, +++)
// ═══════════════════════════════════════════════════════════════════════════

describe('Semi-quantitative parsing of qualitative signs (ОАМ)', () => {
  describe('pdf-parser.engine.ts (parseLabText)', () => {
    it('parses "отрицательно" as 0 for URINE_PROTEIN_QR', () => {
      const text = `Белок мочи (кач) отрицательно`;
      const result = parseLabText(text);
      const protein = result.values.find(v => v.code === 'URINE_PROTEIN_QR');
      expect(protein).toBeDefined();
      expect(protein?.value).toBe(0);
    });

    it('parses "neg" as 0 for URINE_GLUCOSE_QR', () => {
      const text = `Глюкоза мочи (кач) neg`;
      const result = parseLabText(text);
      const glucose = result.values.find(v => v.code === 'URINE_GLUCOSE_QR');
      expect(glucose).toBeDefined();
      expect(glucose?.value).toBe(0);
    });

    it('parses "следы" as 0.5 for UROBILINOGEN_QR', () => {
      const text = `Уробилиноген (кач) следы`;
      const result = parseLabText(text);
      const urob = result.values.find(v => v.code === 'UROBILINOGEN_QR');
      expect(urob).toBeDefined();
      expect(urob?.value).toBe(0.5);
    });

    it('parses "+" as 1 for URINE_PROTEIN_QR', () => {
      const text = `Белок мочи (кач) +`;
      const result = parseLabText(text);
      const protein = result.values.find(v => v.code === 'URINE_PROTEIN_QR');
      expect(protein).toBeDefined();
      expect(protein?.value).toBe(1);
    });

    it('parses "++" as 2 for URINE_KETONES_QR', () => {
      const text = `Кетоны мочи (кач) ++`;
      const result = parseLabText(text);
      const ketones = result.values.find(v => v.code === 'URINE_KETONES_QR');
      expect(ketones).toBeDefined();
      expect(ketones?.value).toBe(2);
    });

    it('parses "+++" as 3 for URINE_BLOOD_QR', () => {
      const text = `Кровь мочи (кач) +++`;
      const result = parseLabText(text);
      const blood = result.values.find(v => v.code === 'URINE_BLOOD_QR');
      expect(blood).toBeDefined();
      expect(blood?.value).toBe(3);
    });

    it('parses "++++" as 4 for URINE_LEU_QR', () => {
      const text = `Лейкоциты мочи (кач) ++++`;
      const result = parseLabText(text);
      const leu = result.values.find(v => v.code === 'URINE_LEU_QR');
      expect(leu).toBeDefined();
      expect(leu?.value).toBe(4);
    });

    it('does not crash on qualitative marker without qualitative sign', () => {
      const text = `Белок мочи (кач) —`;
      const result = parseLabText(text);
      // No value, should just skip
      expect(result.values.find(v => v.code === 'URINE_PROTEIN_QR')).toBeUndefined();
    });
  });

  describe('biomarker-regex-engine.ts (parseLabResults)', () => {
    it('parses "отрицательно" as 0 for URINE_PROTEIN_QR', () => {
      const text = `Белок мочи (кач) отрицательно`;
      const result = parseLabResults(text, 'text');
      const protein = result.extractedMarkers.find(m => m.code === 'URINE_PROTEIN_QR');
      expect(protein).toBeDefined();
      expect(protein?.value).toBe(0);
      expect(protein?.unit).toBe('score');
    });

    it('parses "neg" as 0 for URINE_GLUCOSE_QR', () => {
      const text = `Глюкоза мочи (кач) neg`;
      const result = parseLabResults(text, 'text');
      const glucose = result.extractedMarkers.find(m => m.code === 'URINE_GLUCOSE_QR');
      expect(glucose).toBeDefined();
      expect(glucose?.value).toBe(0);
    });

    it('parses "следы" as 0.5 for UROBILINOGEN_QR', () => {
      const text = `Уробилиноген (кач) следы`;
      const result = parseLabResults(text, 'text');
      const urob = result.extractedMarkers.find(m => m.code === 'UROBILINOGEN_QR');
      expect(urob).toBeDefined();
      expect(urob?.value).toBe(0.5);
    });

    it('parses "+" as 1 for URINE_PROTEIN_QR', () => {
      const text = `Белок мочи (кач) +`;
      const result = parseLabResults(text, 'text');
      const protein = result.extractedMarkers.find(m => m.code === 'URINE_PROTEIN_QR');
      expect(protein).toBeDefined();
      expect(protein?.value).toBe(1);
    });

    it('parses "++" as 2', () => {
      const text = `Кетоны мочи (кач) ++`;
      const result = parseLabResults(text, 'text');
      const ketones = result.extractedMarkers.find(m => m.code === 'URINE_KETONES_QR');
      expect(ketones).toBeDefined();
      expect(ketones?.value).toBe(2);
    });

    it('parses "+++" as 3', () => {
      const text = `Кровь мочи (кач) +++`;
      const result = parseLabResults(text, 'text');
      const blood = result.extractedMarkers.find(m => m.code === 'URINE_BLOOD_QR');
      expect(blood).toBeDefined();
      expect(blood?.value).toBe(3);
    });

    it('parses "++++" as 4', () => {
      const text = `Лейкоциты мочи (кач) ++++`;
      const result = parseLabResults(text, 'text');
      const leu = result.extractedMarkers.find(m => m.code === 'URINE_LEU_QR');
      expect(leu).toBeDefined();
      expect(leu?.value).toBe(4);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUANTITATIVE PARSING — full urine panel (ОАМ) recognition
// ═══════════════════════════════════════════════════════════════════════════

describe('Quantitative urine marker recognition (ОАМ, Нечипоренко, Реберг)', () => {
  it('recognizes URINE_SG from a typical urine panel line', () => {
    const text = `Относительная плотность мочи 1.020 1.010-1.025`;
    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toContain('URINE_SG');
    expect(result.values.find(v => v.code === 'URINE_SG')?.value).toBe(1.020);
  });

  it('recognizes URINE_LEU and URINE_ERY (microscopy)', () => {
    const text = `Лейкоциты мочи 3 кл/мкл 0-5
Эритроциты мочи 2 кл/мкл 0-3`;
    const result = parseLabText(text);
    const codes = result.values.map(v => v.code);
    expect(codes).toContain('URINE_LEU');
    expect(codes).toContain('URINE_ERY');
  });

  it('recognizes NECHIP_LEU, NECHIP_ERY, NECHIP_CYL (Нечипоренко)', () => {
    const text = `Нечипоренко лейкоциты 2000 кл/мл 0-4000
Нечипоренко эритроциты 500 кл/мл 0-1000
Нечипоренко цилиндры 50 кл/мл 0-200`;
    const result = parseLabText(text);
    const codes = result.values.map(v => v.code);
    expect(codes).toEqual(expect.arrayContaining(['NECHIP_LEU', 'NECHIP_ERY', 'NECHIP_CYL']));
  });

  it('recognizes PROTEIN_24H (суточная протеинурия)', () => {
    const text = `Суточная протеинурия 120 мг/сут 0-150`;
    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toContain('PROTEIN_24H');
    expect(result.values.find(v => v.code === 'PROTEIN_24H')?.value).toBe(120);
  });

  it('recognizes CREATININE_URINE (креатинин мочи)', () => {
    const text = `Креатинин мочи 12.5 ммоль/л 8.8-17.7`;
    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toContain('CREATININE_URINE');
  });

  it('recognizes URINE_VOLUME_24H (суточный диурез)', () => {
    const text = `Суточный диурез 1500 мл/сут 800-2000`;
    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toContain('URINE_VOLUME_24H');
    expect(result.values.find(v => v.code === 'URINE_VOLUME_24H')?.value).toBe(1500);
  });

  it('recognizes UROBILINOGEN (уробилиноген)', () => {
    const text = `Уробилиноген 2 мг/л 0-5`;
    const result = parseLabText(text);
    expect(result.values.map(v => v.code)).toContain('UROBILINOGEN');
  });

  it('recognizes URINE_CALCIUM, URINE_OXALATE, URINE_URATE (lithogenesis panel)', () => {
    const text = `Кальций мочи 5.0 ммоль/сут 2.5-7.5
Оксалаты мочи 0.2 ммоль/сут 0-0.4
Ураты мочи 4 ммоль/сут 2-7`;
    const result = parseLabText(text);
    const codes = result.values.map(v => v.code);
    expect(codes).toEqual(expect.arrayContaining(['URINE_CALCIUM', 'URINE_OXALATE', 'URINE_URATE']));
  });

  it('recognizes a complete typical ОАМ report', () => {
    const text = `ОБЩИЙ АНАЛИЗ МОЧИ
Относительная плотность мочи 1.020 1.010-1.025
pH мочи 6.5 5.0-8.0
Белок мочи (кач) отрицательно
Глюкоза мочи (кач) neg
Кетоны мочи (кач) отрицательно
Билирубин мочи (кач) отрицательно
Уробилиноген (кач) следы
Нитриты мочи (кач) отрицательно
Лейкоциты мочи (кач) отрицательно
Кровь мочи (кач) neg
Лейкоциты мочи 2 кл/мкл 0-5
Эритроциты мочи 1 кл/мкл 0-3
Эпителий мочи 3 кл/мкл 0-5
Цилиндры мочи 0 кл/мкл 0-2`;
    const result = parseLabText(text);
    const codes = result.values.map(v => v.code);
    // Quantitative
    expect(codes).toContain('URINE_SG');
    expect(codes).toContain('URINE_PH');
    expect(codes).toContain('URINE_LEU');
    expect(codes).toContain('URINE_ERY');
    expect(codes).toContain('URINE_EPITHELIAL');
    expect(codes).toContain('URINE_CYLINDERS');
    // Semi-quantitative (negative/следы should be recognized)
    expect(codes).toContain('URINE_PROTEIN_QR');
    expect(codes).toContain('URINE_GLUCOSE_QR');
    expect(codes).toContain('URINE_KETONES_QR');
    expect(codes).toContain('URINE_BILIRUBIN_QR');
    expect(codes).toContain('UROBILINOGEN_QR');
    expect(codes).toContain('URINE_NITRITE_QR');
    expect(codes).toContain('URINE_LEU_QR');
    expect(codes).toContain('URINE_BLOOD_QR');
    // Verify values
    expect(result.values.find(v => v.code === 'URINE_PROTEIN_QR')?.value).toBe(0); // отрицательно
    expect(result.values.find(v => v.code === 'UROBILINOGEN_QR')?.value).toBe(0.5); // следы
  });
});
