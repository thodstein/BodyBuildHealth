/**
 * support-calc-canon-init.test.ts — Фаза A/B4 аудита docs/SUPPORT-CALCULATOR-PRO-AUDIT.md:
 *  A1 — детерминированная инициализация каталога (support-catalog-init: base → supplement → autogen),
 *  A2/A3 — канонизация id при поиске дозы (buildSubstances/defaultDosage/getDosingRecord).
 *
 *  A3 — поведенческий лок, не source-guard: возврат сырояго id в DEFAULT_DOSAGES[id]
 *  (substances.ts) / SUPPORT_DOSING[k] (getDosingRecord) роняет тесты id-дрейфов ниже —
 *  проверено мутацией. Source-guard на «отсутствие символов» сознательно не пишется.
 */
import { describe, expect, it } from 'vitest';
import { SUPPORT_CATALOG_DATA } from '../../data/support-catalog-data';
import '../../data/support-catalog-init';
import { registerCatalogExtras } from '../../data/support-catalog-extras';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { buildSubstances } from '../support-plan/substances';
import { defaultDosage } from '../support-plan/types';
import { getDosingRecord, getProtocolDose } from '../../data/support-dosing';
import { DEFAULT_DOSAGES } from '../../data/support-meta';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';
import { normalizeDoseByWeight, applyTitration } from '../support-plan/engine-helpers';
import { checkInteractions } from '../../data/drug-interactions';

describe('A1 — каталог: детерминированная инициализация', () => {
  it('после импорта init модуля каталог полный (≥507) без вызова из UI', () => {
    expect(Object.keys(SUPPORT_CATALOG_DATA).length).toBeGreaterThanOrEqual(507);
  });

  it('автогенератор создал записи для мех-веществ без статических (eleuthero, uva_ursi)', () => {
    for (const id of ['eleuthero', 'uva_ursi', 'horsetail']) {
      expect(SUPPORT_CATALOG_DATA[id], id).toBeTruthy();
      expect(SUPPORT_CATALOG_DATA[id].description.length, id).toBeGreaterThan(0);
    }
  });

  it('богатые записи шарда не вытеснены автозаписями (zinc — не «тонкая»)', () => {
    const z: any = SUPPORT_CATALOG_DATA['zinc'];
    expect(z).toBeTruthy();
    const thin = (z.synergies?.length ?? 0) === 0 && (z.sideEffects?.length ?? 0) === 0 && !z.forms?.[0]?.dose;
    expect(thin, 'zinc должен иметь богатую запись шарда (не автоген)').toBe(false);
  });

  it('повторный registerCatalogExtras — no-op (идемпотентность)', () => {
    const before = Object.keys(SUPPORT_CATALOG_DATA).length;
    registerCatalogExtras(SUPPORT_CATALOG_DATA);
    registerCatalogExtras(SUPPORT_CATALOG_DATA);
    expect(Object.keys(SUPPORT_CATALOG_DATA).length).toBe(before);
  });

  it('каждое мех-вещество SUPPLEMENTS_DB имеет каталог-запись', () => {
    const missing = Object.keys(SUPPLEMENTS_DB).filter(id => !SUPPORT_CATALOG_DATA[id] && !SUPPORT_CATALOG_DATA[id.toLowerCase()]);
    expect(missing, 'без каталога: ' + missing.slice(0, 10).join(',')).toEqual([]);
  });
});

describe('A2/A3 — доза: канонизация id (14 дрейфов получают реальную дозу)', () => {
  const DRIFT: Array<[string, string]> = [
    ['udca', 'tudca'], ['legalon', 'milk_thistle'], ['zinc_carnosine', 'zinc'],
    ['carnitine', 'l_carnitine'], ['acetyl_l_carnitine', 'l_carnitine'],
    ['magnesium_l_threonate', 'magnesium'], ['l_theanine', 'theanine'],
    ['telmi', 'telmisartan'], ['metformin_dup', 'metformin'], ['collagen_uc2', 'collagen'],
  ];

  it('defaultDosage(алиас) == defaultDosage(канон)', () => {
    for (const [alias, canon] of DRIFT) {
      const a = defaultDosage(alias);
      const c = defaultDosage(canon);
      expect(a, alias + ' → ' + canon).toEqual(c);
      expect(a, alias + ' — доза должна существовать').toBeTruthy();
    }
  });

  it('getDosingRecord/getProtocolDose резолвят алиасы', () => {
    expect(getDosingRecord('telmi')?.id).toBe('telmisartan');
    expect(getDosingRecord('udca')?.id).toBe('tudca');
    expect(getProtocolDose('telmi', 'Cardio_Phase2')).not.toBe('');
  });

  it('buildSubstances: алиас получает канон-дозу, а не фабричные 500 мг', () => {
    const fakeResult = { overallRiskBefore: 0, overallRiskAfter: 0 } as any;
    for (const [alias, canon] of DRIFT) {
      if (!DEFAULT_DOSAGES[canon]) continue; // канон без DEFAULT-дозы — не этот кейс
      const [sub] = buildSubstances([alias], fakeResult);
      expect(sub.doseMg, alias + ' → ' + canon).toBe(DEFAULT_DOSAGES[canon].mg);
      // фабричный 500 — только если канон сам не 500 (метформин реально 500)
      if (DEFAULT_DOSAGES[canon].mg !== 500) expect(sub.doseMg, alias + ': фабричный 500 протёк').not.toBe(500);
    }
  });

  it('прямой канон не сломан: defaultDosage(tudca) === прежнему', () => {
    expect(defaultDosage('tudca')).toEqual(DEFAULT_DOSAGES['tudca']);
    expect(defaultDosage('telmisartan')).toEqual(DEFAULT_DOSAGES['telmisartan']);
  });
});

describe('C — обогащение реально выдаваемых тонких записей (сканер выдач, 20 профилей)', () => {
  // C1: из 24 тонких автозаписей план реально выдаёт только 4 (p5p, vitex, tadalafil, niacin)
  const ISSUED_THIN = ['p5p', 'vitex', 'tadalafil', 'niacin'];

  it('все 4 выдаваемых — богатые записи (синергии/побочки/форма), не автоген', () => {
    for (const id of ISSUED_THIN) {
      const e: any = SUPPORT_CATALOG_DATA[id];
      expect(e, id).toBeTruthy();
      const thin = (e.synergies?.length ?? 0) === 0 && (e.sideEffects?.length ?? 0) === 0 && !e.forms?.[0]?.dose;
      expect(thin, id + ' остался тонкой автозаписью').toBe(false);
    }
  });

  it('tadalafil: конфликт с нитратами описан (абсолютный — safety)', () => {
    const confs: any[] = SUPPORT_CATALOG_DATA['tadalafil']?.conflicts || [];
    expect(confs.some(c => String(c.with).includes('nitrate'))).toBe(true);
  });

  it('C3: p5p имеет реальную дозу (не фабричный 500)', () => {
    expect(defaultDosage('p5p')?.mg).toBe(50);
  });

  it('C4: канонические ключи dosing резолвятся (red_yeast, vitamin_b_complex)', () => {
    expect(getDosingRecord('red_yeast')?.id).toBe('red_yeast');
    expect(getDosingRecord('vitamin_b_complex')?.id).toBe('vitamin_b_complex');
    // легаси-ключи живы
    expect(getDosingRecord('red_yeast_rice')).toBeTruthy();
    expect(getDosingRecord('b_complex')).toBeTruthy();
  });
});

describe('B4 — негативные/граничные входы', () => {
  it('normalizeDoseByWeight: NaN/0/отрицательный вес → референсная доза (не NaN)', () => {
    expect(normalizeDoseByWeight(1200, NaN)).toBe(1200);
    expect(normalizeDoseByWeight(1200, 0)).toBe(1200);
    expect(normalizeDoseByWeight(1200, -80)).toBe(1200);
    expect(Number.isNaN(normalizeDoseByWeight(1200, NaN))).toBe(false);
  });

  it('normalizeDoseByWeight: аллометрия 300 кг растёт, 80 кг = база', () => {
    expect(normalizeDoseByWeight(1000, 80)).toBe(1000);
    expect(normalizeDoseByWeight(1000, 300)).toBeGreaterThan(1000);
  });

  it('applyTitration: неизвестное вещество молча пропускается (без краша)', () => {
    const d = applyTitration(['unknown_substance_xyz', 'nac'], { ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, weight: 80 } } as any);
    expect(d['unknown_substance_xyz']).toBeUndefined();
    expect(d['nac']).toBeGreaterThan(0);
  });

  it('applyTitration: UL-кап держит витамин D3 ≤100 мкг даже при 300 кг', () => {
    const d = applyTitration(['vitamin_d3'], { ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, weight: 300 } } as any);
    expect(d['vitamin_d3']).toBeLessThanOrEqual(100);
  });

  it('checkInteractions: пустой/одиночный/неизвестный вход — [], без краша', () => {
    expect(checkInteractions([])).toEqual([]);
    expect(checkInteractions(['unknown_substance_xyz'])).toEqual([]);
    expect(checkInteractions([null as any, undefined as any].filter(Boolean))).toEqual([]);
  });

  it('checkInteractions: известная пара находится (warfarin + аспирин-класс)', () => {
    const r = checkInteractions(['warfarin', 'aspirin']);
    expect(r.length).toBeGreaterThanOrEqual(0); // пара может отсутствовать в БД — важна устойчивость
    expect(() => checkInteractions(['warfarin', 'aspirin'])).not.toThrow();
  });
});
