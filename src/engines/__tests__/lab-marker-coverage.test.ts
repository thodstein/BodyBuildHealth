import { describe, expect, it } from 'vitest';
import { UCUM_MAP, REQUIRED_LABS_PER_PHASE } from '../../core/constants';
import { mapToUcumCode, normalizeLabMeasurement } from '../../core/labs-mapping';
import { BIOMARKER_DICTIONARY, UNIT_MAP, parseLabResults } from '../biomarker-regex-engine';
import { parseLabText } from '../pdf-parser.engine';
import { LAB_MARKER_MAP, LAB_MARKER_MAP_BY_NAME } from '../../data/lab-marker-map';

// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE TESTS — verify every parser-recognized marker maps to UCUM_MAP
// ═══════════════════════════════════════════════════════════════════════════

describe('Lab marker full coverage audit (Aug 10 2026)', () => {
  // ── 35 markers added to UCUM_MAP ──
  const NEW_UCUM_KEYS = [
    'PT', 'MCV', 'MCH', 'MCHC', 'NEUT', 'LYMPH', 'MONO', 'EO', 'BASO',
    'T4', 'T3', 'CA125', 'AFP', 'CEA', 'MYOG',
    'IGA', 'IGG', 'IGM', 'IGE',
    'SOD', 'GLUT', 'GPX', 'METAN', 'NMETAN',
    'CK_18', 'GLDH', 'ADMA', 'OXLDL', 'CORTISOL_NIGHT',
    'HVA', 'MANGANESE', 'IODINE', 'CHROMIUM',
    'CTX', 'COMP', 'P1NP', 'NEPHRIN', 'GALECTIN3',
  ];

  // ── 24 markers added to LAB_PATTERNS + BIOMARKER_DICTIONARY ──
  const NEW_PARSER_MARKERS = [
    'AMH', 'BNP', 'PROTEIN_URINE', 'ENDOTHELIN1', 'NO_MARKER',
    'ESTRADIOL_SENS', 'PREALBUMIN', 'RETICULOCYTES', 'HAPTOGLOBIN',
    'NGAL', 'TNF_ALPHA', 'IL6', 'IL1B', 'LACTATE', 'AMMONIA',
    'IGFBP3', 'CHOLINESTERASE', 'OSMOLALITY', 'ANION_GAP',
    'URINE_PH', 'URINE_OSM', 'MAR_TEST', 'DFI', 'HDS',
  ];

  describe('UCUM_MAP additions (35+ markers)', () => {
    it.each(NEW_UCUM_KEYS)('UCUM_MAP has key "%s"', (key) => {
      expect(UCUM_MAP[key]).toBeDefined();
      expect(UCUM_MAP[key].prefUnit).toBeTruthy();
      expect(UCUM_MAP[key].name).toBeTruthy();
      expect(typeof UCUM_MAP[key].uln).toBe('number');
      expect(typeof UCUM_MAP[key].lln).toBe('number');
    });

    it('UCUM_MAP now has 180+ markers (was ~145)', () => {
      expect(Object.keys(UCUM_MAP).length).toBeGreaterThanOrEqual(180);
    });

    it('T4 total has different uln from FT4 (T4=140, FT4=19)', () => {
      expect(UCUM_MAP['T4'].uln).toBe(140);
      expect(UCUM_MAP['FT4'].uln).toBe(19);
      expect(UCUM_MAP['T4'].name).toContain('общий');
    });

    it('T3 total has different uln from FT3 (T3=2.8, FT3=6.0)', () => {
      expect(UCUM_MAP['T3'].uln).toBe(2.8);
      expect(UCUM_MAP['FT3'].uln).toBe(6.0);
      expect(UCUM_MAP['T3'].name).toContain('общий');
    });
  });

  describe('LAB_PATTERNS coverage — all codes map to UCUM_MAP', () => {
    // Import LAB_PATTERNS indirectly by checking parseLabText recognition
    const KNOWN_LAB_CODES = [
      'MCV', 'MCH', 'MCHC', 'NEUT', 'LYMPH', 'MONO', 'EO', 'BASO',
      'T4', 'T3', 'CA125', 'AFP', 'CEA', 'MYOG',
      'IGA', 'IGG', 'IGM', 'IGE',
      'SOD', 'GLUT', 'GPX', 'METAN', 'NMETAN',
      'AMH', 'BNP', 'PROTEIN_URINE', 'ENDOTHELIN1',
      'LACTATE', 'AMMONIA', 'IGFBP3', 'CHOLINESTERASE',
      'OSMOLALITY', 'ANION_GAP',
      'CK_18', 'GLDH', 'ADMA', 'OXLDL', 'CORTISOL_NIGHT',
      'HVA', 'MANGANESE', 'IODINE', 'CHROMIUM',
      'CTX', 'COMP', 'P1NP',
    ];

    it.each(KNOWN_LAB_CODES)('mapToUcumCode("%s") returns a UCUM_MAP key', (code) => {
      const mapped = mapToUcumCode(code);
      expect(UCUM_MAP[mapped]).toBeDefined();
    });

    it('T3 maps to T3 (not FT3 — bug fix)', () => {
      const mapped = mapToUcumCode('T3');
      expect(mapped).toBe('T3');
      expect(mapped).not.toBe('FT3');
    });

    it('T4 maps to T4 (not FT4 — bug fix)', () => {
      const mapped = mapToUcumCode('T4');
      expect(mapped).toBe('T4');
      expect(mapped).not.toBe('FT4');
    });

    it('T3_Free still maps to FT3 (unchanged)', () => {
      expect(mapToUcumCode('T3_FREE')).toBe('FT3');
    });

    it('T4_Free still maps to FT4 (unchanged)', () => {
      expect(mapToUcumCode('T4_FREE')).toBe('FT4');
    });

    it('CK-18 (hyphen) maps to CK_18 (underscore)', () => {
      expect(mapToUcumCode('CK-18')).toBe('CK_18');
    });

    it('BIOMARKER code Cortisol_night maps to CORTISOL_NIGHT', () => {
      expect(mapToUcumCode('CORTISOL_NIGHT')).toBe('CORTISOL_NIGHT');
    });

    it('BIOMARKER code Manganese maps to MANGANESE', () => {
      expect(mapToUcumCode('MANGANESE')).toBe('MANGANESE');
    });
  });

  describe('BIOMARKER_DICTIONARY additions (47 markers)', () => {
    it.each(NEW_PARSER_MARKERS)('BIOMARKER_DICTIONARY has "%s"', (code) => {
      expect(BIOMARKER_DICTIONARY[code]).toBeDefined();
      expect(BIOMARKER_DICTIONARY[code].length).toBeGreaterThan(0);
    });

    it.each([
      'MCV', 'MCH', 'MCHC', 'NEUT', 'LYMPH', 'MONO', 'EO', 'BASO',
      'T4', 'T3', 'CA125', 'AFP', 'CEA', 'MYOG',
      'IGA', 'IGG', 'IGM', 'IGE',
      'SOD', 'GLUT', 'GPX', 'METAN', 'NMETAN',
    ])('BIOMARKER_DICTIONARY has LAB_PATTERNS-only marker "%s"', (code) => {
      expect(BIOMARKER_DICTIONARY[code]).toBeDefined();
      expect(BIOMARKER_DICTIONARY[code].length).toBeGreaterThan(0);
    });

    it.each(NEW_PARSER_MARKERS)('UNIT_MAP has unit for "%s"', (code) => {
      expect(UNIT_MAP[code]).toBeDefined();
    });
  });

  describe('REQUIRED_LABS_PER_PHASE — all codes in UCUM_MAP', () => {
    it('every required lab code resolves to UCUM_MAP', () => {
      const allRequired = new Set<string>();
      for (const codes of Object.values(REQUIRED_LABS_PER_PHASE)) {
        for (const code of codes) allRequired.add(code);
      }
      const missing: string[] = [];
      for (const code of allRequired) {
        const mapped = mapToUcumCode(code);
        if (!UCUM_MAP[mapped]) missing.push(`${code} → ${mapped}`);
      }
      expect(missing).toEqual([]);
    });

    it('FOLATE in REQUIRED_LABS maps to FOL in UCUM_MAP', () => {
      expect(mapToUcumCode('FOLATE')).toBe('FOL');
      expect(UCUM_MAP['FOL']).toBeDefined();
    });
  });

  describe('LAB_MARKER_MAP coverage', () => {
    it.each(NEW_UCUM_KEYS)('LAB_MARKER_MAP has entry for "%s"', (key) => {
      expect(LAB_MARKER_MAP_BY_NAME[key]).toBeDefined();
      expect(LAB_MARKER_MAP_BY_NAME[key].organ).toBeTruthy();
      expect(LAB_MARKER_MAP_BY_NAME[key].mechanisms.length).toBeGreaterThan(0);
    });

    it.each(NEW_PARSER_MARKERS)('LAB_MARKER_MAP has entry for parser marker "%s"', (key) => {
      expect(LAB_MARKER_MAP_BY_NAME[key]).toBeDefined();
    });
  });

  describe('End-to-end PDF parser recognition', () => {
    it('recognizes MCV, MCH, MCHC from a blood panel', () => {
      const text = `АЛТ 35 Е/л 0-41
MCV 88 фл 80-100
MCH 30 пг 27-34
MCHC 340 г/л 320-360`;
      const result = parseLabText(text);
      const codes = result.values.map(v => v.code);
      expect(codes).toEqual(expect.arrayContaining(['MCV', 'MCH', 'MCHC']));
    });

    it('recognizes T4 total and T3 total (not mapped to FT4/FT3)', () => {
      const text = `Т4 общий 95 нмоль/л 60-140
Т3 общий 1.8 нмоль/л 1.0-2.8
Т4 свободный 14 пмоль/л 10-19`;
      const result = parseLabText(text);
      const codes = result.values.map(v => v.code);
      expect(codes).toContain('T4');
      expect(codes).toContain('T3');
      expect(codes).toContain('FT4');
    });

    it('recognizes tumor markers (CA125, AFP, CEA)', () => {
      const text = `CA-125 25 Е/мл 0-35
АФП 3 МЕ/мл 0-10
РЭА 2 нг/мл 0-5`;
      const result = parseLabText(text);
      const codes = result.values.map(v => v.code);
      expect(codes).toEqual(expect.arrayContaining(['CA125', 'AFP', 'CEA']));
    });

    it('recognizes immunoglobulins (IgA, IgG, IgM, IgE)', () => {
      const text = `IgA 2.1 г/л 0.7-4.0
IgG 11 г/л 7-16
IgM 1.2 г/л 0.4-2.3
IgE 50 МЕ/мл 0-100`;
      const result = parseLabText(text);
      const codes = result.values.map(v => v.code);
      expect(codes).toEqual(expect.arrayContaining(['IGA', 'IGG', 'IGM', 'IGE']));
    });

    it('recognizes AMH (previously lost)', () => {
      const text = `Антимюллеров гормон 3.5 нг/мл 1.0-15`;
      const result = parseLabText(text);
      expect(result.values.map(v => v.code)).toContain('AMH');
    });

    it('recognizes BNP (previously lost)', () => {
      const text = `BNP 45 пг/мл 0-100`;
      const result = parseLabText(text);
      expect(result.values.map(v => v.code)).toContain('BNP');
    });

    it('recognizes cytokines (TNF-alpha, IL-6, IL-1β)', () => {
      const text = `ФНО-альфа 5 пг/мл 0-8
ИЛ-6 3 пг/мл 0-7
ИЛ-1β 2 пг/мл 0-5`;
      const result = parseLabText(text);
      const codes = result.values.map(v => v.code);
      expect(codes).toEqual(expect.arrayContaining(['TNF_ALPHA', 'IL6', 'IL1B']));
    });

    it('recognizes bone turnover markers (CTX, P1NP)', () => {
      const text = `CTX 0.3 нг/мл 0.1-0.5
P1NP 45 нг/мл 20-80`;
      const result = parseLabText(text);
      const codes = result.values.map(v => v.code);
      expect(codes).toEqual(expect.arrayContaining(['CTX', 'P1NP']));
    });

    it('recognizes trace minerals (Manganese, Iodine, Chromium)', () => {
      const text = `Марганец 0.2 мкмоль/л 0.05-0.3
Йод 75 мкг/л 50-100
Хром 5 нмоль/л 2-10`;
      const result = parseLabText(text);
      const codes = result.values.map(v => v.code);
      expect(codes).toEqual(expect.arrayContaining(['MANGANESE', 'IODINE', 'CHROMIUM']));
    });
  });

  describe('End-to-end biomarker-regex engine recognition', () => {
    it('recognizes AMH via biomarker-regex engine', () => {
      const text = `Антимюллеров гормон 3.5 нг/мл 1.0-15`;
      const result = parseLabResults(text, 'text');
      expect(result.extractedMarkers.some(m => m.code === 'AMH')).toBe(true);
    });

    it('recognizes BNP via biomarker-regex engine', () => {
      const text = `BNP 45 пг/мл 0-100`;
      const result = parseLabResults(text, 'text');
      expect(result.extractedMarkers.some(m => m.code === 'BNP')).toBe(true);
    });

    it('recognizes LACTATE via biomarker-regex engine', () => {
      const text = `Лактат 1.5 ммоль/л 0.5-2.2`;
      const result = parseLabResults(text, 'text');
      expect(result.extractedMarkers.some(m => m.code === 'LACTATE')).toBe(true);
    });

    it('recognizes RETICULOCYTES via biomarker-regex engine', () => {
      const text = `Ретикулоциты 1.5 % 0.5-2.5`;
      const result = parseLabResults(text, 'text');
      expect(result.extractedMarkers.some(m => m.code === 'RETICULOCYTES')).toBe(true);
    });

    it('recognizes MCV, NEUT, LYMPH (hematology indices) via biomarker-regex', () => {
      const text = `MCV 88 фл 80-100
Нейтрофилы 60 % 45-75
Лимфоциты 30 % 20-50`;
      const result = parseLabResults(text, 'text');
      const codes = result.extractedMarkers.map(m => m.code);
      expect(codes).toEqual(expect.arrayContaining(['MCV', 'NEUT', 'LYMPH']));
    });

    it('recognizes T4 total and T3 total (not confused with free)', () => {
      const text = `Т4 общий 95 нмоль/л 60-140
Т3 общий 1.8 нмоль/л 1.0-2.8`;
      const result = parseLabResults(text, 'text');
      const codes = result.extractedMarkers.map(m => m.code);
      expect(codes).toContain('T4');
      expect(codes).toContain('T3');
      // T4 should NOT be mapped to T4_Free
      expect(result.extractedMarkers.find(m => m.code === 'T4')?.unit).toBe('nmol/L');
    });
  });

  describe('T3/T4 total vs free — bug fix verification', () => {
    it('normalizeLabMeasurement keeps T4 total in nmol/L (not pg/mL like FT4)', () => {
      const t4Total = normalizeLabMeasurement('T4', 95, 'нмоль/л');
      expect(t4Total.unit).toBe('nmol/L');
      expect(t4Total.value).toBe(95);

      const ft4 = normalizeLabMeasurement('FT4', 14, 'пмоль/л');
      expect(ft4.unit).toBe('pmol/L');
      expect(ft4.value).toBe(14);
    });

    it('T3 and T4 are distinct from FT3 and FT4 in mapToUcumCode', () => {
      expect(mapToUcumCode('T3')).not.toBe(mapToUcumCode('FT3'));
      expect(mapToUcumCode('T4')).not.toBe(mapToUcumCode('FT4'));
    });
  });

  describe('Cross-engine deduplication', () => {
    it('both engines find ALT and it maps to same UCUM key', () => {
      // pdf-parser → 'ALT' → mapToUcumCode → 'ALT'
      // biomarker-regex → 'ALT' → mapToUcumCode → 'ALT'
      expect(mapToUcumCode('ALT')).toBe('ALT');
      expect(UCUM_MAP['ALT']).toBeDefined();
    });

    it('both engines find TSH and it maps to same UCUM key', () => {
      expect(mapToUcumCode('TSH')).toBe('TSH');
      expect(UCUM_MAP['TSH']).toBeDefined();
    });

    it('pdf-parser CREAT and biomarker Creatinine both map to CREATININE', () => {
      expect(mapToUcumCode('CREAT')).toBe('CREATININE');
      expect(mapToUcumCode('CREATININE')).toBe('CREATININE');
      expect(UCUM_MAP['CREATININE']).toBeDefined();
    });
  });
});
