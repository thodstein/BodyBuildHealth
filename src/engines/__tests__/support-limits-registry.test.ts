/**
 * support-limits-registry.test.ts — локи единого реестра пределов (E0.1–E0.3, 26 сен 2026).
 *
 * Здесь закрыт класс дефектов, который НЕ ловился ни одним существующим тестом:
 * bidirection-substring резолв id → нутриент. `bcaa` (BCAA — аминокислоты) получал
 * окно КАЛЬЦИЯ, потому что `'bcaa'.includes('ca')`. Ни один тест про `bcaa` не писал,
 * поэтому дефект жил незамеченным.
 *
 * Мутационно проверено: снос DENY-правила для `bcaa` роняет тест;
 * возврат подстроки вместо границы слова роняет тесты на формах.
 */
import { describe, it, expect } from 'vitest';
import {
  NUTRIENT_LIMITS_V2,
  NUTRIENT_CANON,
  resolveNutrient,
  nutrientLimitValue,
  evaluateLimit,
  sumStackByNutrient,
  stackLimitVerdicts,
  limitsSummary,
  unverifiedLimits,
} from '../support-limits';
import { doseWindowFor } from '../support-hub-evidence.engine';
import { NUTRIENT_UL, NUTRIENT_LIMIT_INFO } from '../support-plan/types';
// ВАЖНО: THERAPEUTIC_WINDOWS и DOSE_RANGES живут в РАЗНЫХ файлах (вторая — в TSX
// компоненте). Импорт DOSE_RANGES из SupportBioavailabilityData даёт `undefined`
// без ошибки компиляции → тест падал с «Cannot convert undefined or null to object».
const { THERAPEUTIC_WINDOWS } = await import('../../ui/screens/SupportScreen_parts/SupportBioavailabilityData');
const { DOSE_RANGES } = await import('../../ui/screens/SupportScreen_parts/SupportEffectiveDose');

describe('E0.3 — резолв нутриента по id/форме (регрессия bcaa→кальций)', () => {
  it('bcaa НЕ кальций (исходный дефект E0.3)', () => {
    expect(resolveNutrient('bcaa')).toBeNull();
    expect(nutrientLimitValue('bcaa')).toBeNull();
  });

  it('eaa — тоже не минерал', () => {
    expect(resolveNutrient('eaa')).toBeNull();
  });

  it('calcium D-glucarate — отдельная форма, не чистый кальций', () => {
    expect(resolveNutrient('calcium_d_glucarate')).toBeNull();
  });

  it('короткие therapeutic-ключи резолвятся точно', () => {
    expect(resolveNutrient('ca')).toBe('calcium');
    expect(resolveNutrient('mg')).toBe('magnesium');
    expect(resolveNutrient('zn')).toBe('zinc');
    expect(resolveNutrient('fe')).toBe('iron');
    expect(resolveNutrient('se')).toBe('selenium');
    expect(resolveNutrient('cr')).toBe('chromium');
  });

  it('форма нутриента резолвится по границе слова', () => {
    expect(resolveNutrient('magnesium_glycinate')).toBe('magnesium');
    expect(resolveNutrient('zinc_picolinate')).toBe('zinc');
    expect(resolveNutrient('calcium citrate')).toBe('calcium');
    expect(resolveNutrient('creatine_monohydrate')).toBe('creatine');
    expect(resolveNutrient('vitamin_d3')).toBe('vitamin_d');
    expect(resolveNutrient('cholecalciferol')).toBe('vitamin_d');
  });

  it('длинный ключ побеждает короткий (vitamin_b12, а не b12)', () => {
    expect(resolveNutrient('vitamin_b12')).toBe('vitamin_b12');
    expect(resolveNutrient('cyanocobalamin')).toBe('vitamin_b12');
    expect(resolveNutrient('b12')).toBe('vitamin_b12');
  });

  it('внутренние подстроки НЕ резолвятся (bcfa,caa,zinco)', () => {
    expect(resolveNutrient('bcfa')).toBeNull();
    expect(resolveNutrient('caa')).toBeNull();
  });

  it('кириллица: русские названия', () => {
    expect(resolveNutrient('магния глицинат')).toBe('magnesium');
    expect(resolveNutrient('Цинк')).toBe('zinc');
    expect(resolveNutrient('витамин D3')).toBe('vitamin_d');
  });

  it('пустое/мусор не угадывается', () => {
    expect(resolveNutrient('')).toBeNull();
    expect(resolveNutrient(null)).toBeNull();
    expect(resolveNutrient(undefined)).toBeNull();
    expect(resolveNutrient('heptral')).toBeNull();
    expect(resolveNutrient('serrapeptase')).toBeNull();
  });

  it('каждый канонический ключ резолвится сам в себя (инвариант карты)', () => {
    for (const k of Object.keys(NUTRIENT_CANON)) {
      expect(resolveNutrient(k)).toBe(NUTRIENT_CANON[k]);
    }
  });

  it('каждый нутриент реестра имеет запись с пределом', () => {
    for (const k of Object.keys(NUTRIENT_CANON)) {
      expect(NUTRIENT_LIMITS_V2[k], `нет записи предела для ${k}`).toBeDefined();
    }
  });
});

describe('E0.1 — значения и типы пределов (EFSA 2023–2026)', () => {
  it('витамин B6: EFSA 2023 = 12 мг (было 100 мг IOM)', () => {
    const l = NUTRIENT_LIMITS_V2.vitamin_b6;
    expect(l.value).toBe(12);
    expect(l.jurisdiction).toBe('EFSA');
    expect(l.year).toBe(2023);
    expect(l.kind).toBe('UL');
    expect(l.altValue).toBe(100); // IOM — сохранён как альтернативное значение
  });

  it('селен: EFSA 2023 = 255 мкг (было 300/400 мкг)', () => {
    const l = NUTRIENT_LIMITS_V2.selenium;
    expect(l.value).toBe(255);
    expect(l.unit).toBe('mcg');
    expect(l.jurisdiction).toBe('EFSA');
  });

  it('бор: число НЕ перепроверено — лок фиксирует честность, а не выдуманное значение', () => {
    const l = NUTRIENT_LIMITS_V2.boron;
    // План упоминал «EFSA 12 мг», но первоисточник открыть не удалось (websearch 403).
    // Поэтому НЕ подставляем непроверенное число: остаётся легаси IOM, и机器но
    // проверяется, что запись помечена как непроверенная (правило плана).
    expect(l.verified).toBe(false);
    expect(l.value).toBe(20);
    expect(l.jurisdiction).toBe('IOM');
    expect(l.note).toContain('НЕ ПЕРЕПРОВЕРЕНО');
  });

  it('железо — SafeLevel, а НЕ UL (EFSA не устанавливала UL)', () => {
    const l = NUTRIENT_LIMITS_V2.iron;
    expect(l.kind).toBe('SafeLevel');
  });

  it('витамин E — условный UL с исключениями (EFSA 2024)', () => {
    const l = NUTRIENT_LIMITS_V2.vitamin_e;
    expect(l.kind).toBe('UL');
    expect(l.excludes?.length ?? 0).toBeGreaterThan(0);
  });

  it('креатин: UL НЕ установлен (value=0, kind=NotEstablished)', () => {
    const l = NUTRIENT_LIMITS_V2.creatine;
    expect(l.value).toBe(0);
    expect(l.kind).toBe('NotEstablished');
  });

  it('каждая запись несёт юрисдикцию/год/критический эффект', () => {
    for (const [k, l] of Object.entries(NUTRIENT_LIMITS_V2)) {
      expect(l.nutrient, k).toBeTruthy();
      expect(['EFSA', 'IOM', 'Clinical'], k).toContain(l.jurisdiction);
      expect(l.year, k).toBeGreaterThan(1900);
      expect(l.criticalEffect, k).toBeTruthy();
    }
  });

  it('запись verified=false обязана нести содержательную пометку', () => {
    // Инвариант НЕ про конкретную формулировку (она менялась по ходу раунда), а про то,
    // что непроверенная запись не может быть МОЛЧАЛИВОЙ: пустая note = «выглядит как
    // проверенное». Конкретные числа/пометки пинятся отдельно.
    for (const [k, l] of Object.entries(NUTRIENT_LIMITS_V2)) {
      if (l.verified) continue;
      expect((l.note ?? '').trim().length, `${k}: verified=false, но note пустая`).toBeGreaterThan(10);
    }
  });

  it('в реестре есть и проверенные, и непроверенные записи (не выдумано и не «всё под сомнением»)', () => {
    const s = limitsSummary();
    expect(s.verified).toBeGreaterThan(0);
    expect(s.unverified).toBeGreaterThan(0);
  });
});

describe('E1.8 — семантика типов предела (UL ≠ SafeLevel ≠ не установлен)', () => {
  it('превышение UL = over:true, color over', () => {
    const v = evaluateLimit('zinc', 100);
    expect(v.over).toBe(true);
    expect(v.color).toBe('over');
  });

  it('превышение SafeLevel = НЕ over (это не токсичность)', () => {
    const v = evaluateLimit('iron', 999);
    expect(v.kind).toBe('SafeLevel');
    expect(v.over).toBe(false);
    expect(v.color).toBe('warn');
  });

  it('NotEstablished = over:false всегда, даже при огромной дозе', () => {
    const v = evaluateLimit('creatine', 100000);
    expect(v.kind).toBe('NotEstablished');
    expect(v.over).toBe(false);
    expect(v.color).toBe('na');
  });

  it('неизвестный нутриент = kind Unknown, без выдуманного предела', () => {
    const v = evaluateLimit('heptral', 900);
    expect(v.kind).toBe('Unknown');
    expect(v.limit).toBeNull();
    expect(v.over).toBe(false);
  });

  it('исключение регулятора снимает предел (витамин E + антикоагулянты)', () => {
    const ok = evaluateLimit('vitamin_e', 1000);
    expect(ok.over).toBe(true);
    const na = evaluateLimit('vitamin_e', 1000, { onAnticoagulant: true });
    expect(na.limitNotApplicable).toBe(true);
    expect(na.over).toBe(false);
  });
});

describe('E0.4 — суммирование по стеку (было total += 1)', () => {
  it('суммирует дозы форм одного нутриента × частота', () => {
    const r = sumStackByNutrient([
      { id: 'zinc_picolinate', nameRu: 'Цинк пиколинат', doseMg: 30, timesPerDay: 2 },
      { id: 'zinc_gluconate', nameRu: 'Цинк глюконат', doseMg: 15, timesPerDay: 1 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].nutrient).toBe('zinc');
    expect(r[0].amountPerDay).toBe(75); // 30×2 + 15
    expect(r[0].sources).toHaveLength(2);
  });

  it('пустая доза / нули НЕ создают вклад (иначе «1» как в старом баге)', () => {
    const r = sumStackByNutrient([
      { id: 'zinc', doseMg: 0 },
      { id: 'magnesium', doseMg: undefined },
      { id: 'unknown_thing', doseMg: 500 },
    ]);
    expect(r).toHaveLength(0);
  });

  it('одинаковая форма дважды в стеке — один нутриент', () => {
    const r = sumStackByNutrient([
      { id: 'magnesium_glycinate', doseMg: 200 },
      { id: 'magnesium_oxide', doseMg: 400 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].amountPerDay).toBe(600);
  });

  it('вердикты стека ловят реальный перебор цинка', () => {
    const v = stackLimitVerdicts([
      { id: 'zinc_picolinate', doseMg: 25, timesPerDay: 2 },
      { id: 'zinc_gluconate', doseMg: 20, timesPerDay: 1 },
    ]);
    const zinc = v.find(x => x.nutrient === 'zinc');
    expect(zinc).toBeDefined();
    expect(zinc!.verdict.over).toBe(true); // 70 мг > UL 40
  });

  it('verdict.kind Unknown отфильтровывается, а не показывается как «норма»', () => {
    const v = stackLimitVerdicts([{ id: 'berberine', doseMg: 1000 }]);
    expect(v).toHaveLength(0);
  });
});

describe('E0.3/E1.8 — doseWindowFor на реальных таблицах', () => {
  it('bcaa НЕ получает окно кальция (главный регресс)', () => {
    const w = doseWindowFor('bcaa', THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);
    expect(w.hasData).toBe(false);
    expect(w.ul).toBeNull();
  });

  it('форма магния получает окно из THERAPEUTIC_WINDOWS', () => {
    const w = doseWindowFor('magnesium_glycinate', THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);
    expect(w.hasData).toBe(true);
    expect(w.min).toBe(200);
    expect(w.max).toBe(600);
  });

  it('сенсант ul:9999 больше не утекает наружу (b12: UL не установлен)', () => {
    const w = doseWindowFor('b12', THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);
    expect(w.ul).not.toBe(9999);
    // UL для B12 не установлен, но есть ОРИЕНТИР из руководства → ClinicalGuidance.
    // Именно поэтому ulWarning = false: система не имеет права писать «превышен UL».
    expect(w.ulKind).toBe('ClinicalGuidance');
    expect(w.ulWarning).toBe(false);
  });

  it('ulWarning достижим только для настоящего UL', () => {
    expect(doseWindowFor('zinc', THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never).ulWarning).toBe(true);
    expect(doseWindowFor('vitamin_d3', THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never).ulWarning).toBe(true);
  });

  it('каждый ключ THERAPEUTIC_WINDOWS резолвится в окно (регресс-локсток)', () => {
    for (const k of Object.keys(THERAPEUTIC_WINDOWS)) {
      const w = doseWindowFor(k, THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);
      expect(w.hasData, `окно потеряно для ключа ${k}`).toBe(true);
    }
  });

  it('окна нет — но предел из реестра всё равно известен (тир 3, честно)', () => {
    // У креатина нет ключа в THERAPEUTIC_WINDOWS, но есть в DOSE_RANGES → окно найдено.
    // Предел при этом НЕ УСТАНОВЛЕН (EFSA не выдавала UL) → ulKind=NotEstablished,
    // и система не имеет права рисовать «превышен предел».
    const w = doseWindowFor('creatine', THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);
    expect(w.hasData).toBe(true);
    expect(w.ul).toBeNull();
    expect(w.ulKind).toBe('NotEstablished');
    expect(w.ulWarning).toBe(false);
  });

  it('окна нет ни в одной таблице — предел из реестра всё равно виден (тир 3b)', () => {
    // Пустые обе таблицы: hasData=false, но природа предела не теряется —
    // молчание было бы тем же «нет данных = норма».
    const w = doseWindowFor('creatine_monohydrate', {} as never, {} as never);
    expect(w.hasData).toBe(false);
    expect(w.ulKind).toBe('NotEstablished');
    expect(w.note).toContain('Терапевтического окна в базе нет');
  });
});

describe('E0.2 — NUTRIENT_UL выведен из реестра (третья копия закрыта)', () => {
  it('ключи NUTRIENT_UL — это id ВЕЩЕСТВ (contract checkUpperLimits), не нутриенты', () => {
    // Регресс: если ключами станут канонические нутриенты (`vitamin_d`),
    // `checkUpperLimits(['vitamin_d3'])` перестанет находить предел → UL-кап исчезнет.
    expect(NUTRIENT_UL['vitamin_d3']).toBe(100);
    expect(NUTRIENT_UL['vitamin_k2']).toBe(1000);
    expect(NUTRIENT_UL['zinc']).toBe(40);
  });

  it('витамин D: реестр 4000 МЕ, таблица 100 мкг — один и тот же предел', () => {
    const reg = NUTRIENT_LIMITS_V2.vitamin_d;
    expect(reg.value).toBe(4000);
    expect(reg.unit).toBe('iu');
    expect(reg.altValue).toBe(100);
    // Регресс «UL-кап ослаб в 40 раз»: если бы копировалось 4000 — cap не сработал бы.
    expect(NUTRIENT_UL['vitamin_d3']).toBe(reg.altValue);
    expect(NUTRIENT_UL['vitamin_d3']).not.toBe(reg.value);
  });

  it('B6 = 12 мг (EFSA 2023), а не легаси 100 мг', () => {
    expect(NUTRIENT_UL['vitamin_b6']).toBe(12);
  });

  it('селен = 255 мкг (EFSA 2023), а не легаси 400', () => {
    expect(NUTRIENT_UL['selenium']).toBe(255);
  });

  it('каждое значение NUTRIENT_UL совпадает с реестром (расхождение невозможно)', () => {
    for (const [k, v] of Object.entries(NUTRIENT_UL)) {
      const canon = resolveNutrient(k);
      expect(canon, `ключ ${k} не резолвится в нутриент`).toBeTruthy();
      const reg = NUTRIENT_LIMITS_V2[canon!];
      expect(reg, `нет записи предела для ${k}`).toBeDefined();
      expect(reg.kind, `${k}: NotEstablished не должен попадать в UL`).not.toBe('NotEstablished');
      // Значение допускается либо как есть, либо как altValue (единицы мкг/МЕ).
      expect([reg.value, reg.altValue], `${k}: значение ${v} не из реестра`).toContain(v);
    }
  });

  it('NUTRIENT_LIMIT_INFO отдаёт тип/юрисдикцию/год/альтернативу для UI', () => {
    const b6 = NUTRIENT_LIMIT_INFO['vitamin_b6'];
    expect(b6.jurisdiction).toBe('EFSA');
    expect(b6.year).toBe(2023);
    expect(b6.kind).toBe('UL');
    // Критерий приёмки E0.2: блок «EFSA строже IOM» должен быть выводим.
    expect(b6.altJurisdiction).toBe('IOM');
    expect(b6.altValue).toBe(100);
    expect(NUTRIENT_LIMIT_INFO['iron'].kind).toBe('SafeLevel');
  });
});

describe('E0.1 — сводка и честность непроверенного', () => {
  it('limitsSummary не выдумывает чисел', () => {
    const s = limitsSummary();
    expect(s.total).toBeGreaterThan(20);
    expect(s.verified + s.unverified).toBe(s.total);
  });

  it('unverifiedLimits честно перечисляет непроверенные записи', () => {
    const u = unverifiedLimits();
    expect(u.length).toBeGreaterThan(0);
    for (const l of u) {
      expect(l.verified).toBe(false);
      expect(NUTRIENT_LIMITS_V2[l.nutrient]).toBeDefined();
    }
  });
});
