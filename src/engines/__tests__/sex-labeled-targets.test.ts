/**
 * sex-labeled-targets.test.ts — проход 64: цели называют пол там, где порог
 * половой.
 *
 * Было: каталог и фарм-ноты печатали мужские таргеты как общие — `АЛТ <40`,
 * `ГГТ <55`, `E2 20-40 пг/мл`, `ALT>2×ULN`. Женщина читала чужие числа: её ВГН
 * АЛТ/ГГТ — 31, а E2 — фазовый (фолликулярная 40–200, лютеиновая 70–500 пг/мл),
 * и подавлять его ей нельзя.
 *
 * Стало: в каталоге рядом с мужским числом стоит женское (`АЛТ <40 (♀ <31)`),
 * цели ИА подписаны `♂`/`♀`, ступень 2×ВГН печатается в единицах обоих полов.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LFT_STAGE_ULN, FEMALE_HORMONE_BANDS, FEMALE_LAB_BOUNDS } from '../../engines/lab-norms.engine';

const ROOT = resolve(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Строки-цели (`target:`/`targetRange:`), где печёночный порог написан без пола. */
function unlabeledLiverTargets(): string[] {
  const bad: string[] = [];
  const re = /target(?:Range)?:\s*'([^']*)'/g;
  const liver = /(АЛТ|АСТ|ГГТ|ALT|AST|GGT)/;
  const maleOnly = /(<\s*40\b|<\s*55\b)/;
  for (const file of walk(ROOT)) {
    const src = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const value = m[1];
      if (!liver.test(value) || !maleOnly.test(value)) continue;
      if (value.includes('♀')) continue;
      bad.push(`${file.replace(/\\/g, '/')}: ${value}`);
    }
  }
  return bad;
}

describe('каталог: печёночные цели называют оба пола', () => {
  it('нет `АЛТ <40` / `ГГТ <55` без женской половины', () => {
    expect(unlabeledLiverTargets()).toEqual([]);
  });

  it('женская половина совпадает с резолвером (31)', () => {
    const src = ['src/data/support-catalog-data.ts', 'src/data/support-catalog-extras.ts',
      'src/data/support-catalog-supplement.ts', 'src/data/support-stacks-part1.ts']
      .map(f => readFileSync(resolve(process.cwd(), f), 'utf8')).join('\n');
    // Формат `(♀ <31)` — единственная женская запись в каталоге для АЛТ/ГГТ;
    // если поменяется ВГН в резолвере, тест напомнит обновить и текст.
    expect(src).toContain('(♀ <31)');
    expect(src).not.toContain('(♀ <32)');
    expect(Number(/\(♀ <(\d+)\)/.exec(src)![1])).toBe(31);
  });
});

describe('фарм-ноты: цель ИА подписана полом, ступень 2×ВГН — в единицах обоих полов', () => {
  const tz = readFileSync(resolve(process.cwd(), 'src/engines/tz-mapper-engine.ts'), 'utf8');
  // Комментарии объясняют, какие литералы убраны, — сканируем только код.
  const code = tz
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n');

  it('нет `20-40 pg/mL` как общей цели и `ALT>2×ULN`', () => {
    expect(code).not.toContain('20-40 pg/mL');
    expect(code).not.toContain('20-40 пг/мл');
    expect(code).not.toContain('ALT>2×ULN');
  });

  it('AI_E2_TARGET называет мужской таргет и женскую норму', () => {
    expect(code).toContain('AI_E2_TARGET');
    expect(code).toContain('♂; ♀');
  });

  it('ступень 2×ВГН печатает оба пола', () => {
    expect(code).toContain('LFT_REDUCE_BOTH');
    expect(LFT_STAGE_ULN.reduce.male).toBe(80);
    expect(LFT_STAGE_ULN.reduce.female).toBe(62);
  });
});

describe('женские протоколы сопровождения: пометка рядом с мужским коридором', () => {
  it('E2-протокол и постцикл предупреждают женщину', () => {
    for (const f of ['supportProtocolE2.tsx', 'supportProtocolPostCycle.tsx']) {
      const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts', f), 'utf8');
      expect(src).toContain('data-female-protocol-note');
    }
  });
});

describe('ступень 2×ВГН — везде в единицах обоих полов', () => {
  it('нет `2×ULN` в коде (комментарии не считаются)', () => {
    const bad: string[] = [];
    for (const file of walk(ROOT)) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(/\r?\n/)
        .map(l => l.replace(/\/\/.*$/, ''))
        .join('\n');
      if (/2\s*[×x]\s*ULN/.test(code)) bad.push(file.replace(/\\/g, '/'));
    }
    expect(bad).toEqual([]);
  });
});

describe('каталог и solver: однозначные пороги называют оба пола', () => {
  // Проход 67: `targetRange: '<40 Ед/л'` в 60+ строках каталога, стеков и
  // symptom-solver печатался как общий порог. Женщина читала 40 при своём ВГН 31.
  const DATA_FILES = [
    'src/data/support-catalog-data.ts',
    'src/data/support-catalog-extras.ts',
    'src/data/support-catalog-supplement.ts',
    'src/data/support-stacks-part1.ts',
    'src/data/support-stacks-part2.ts',
    'src/data/support-stacks-late.ts',
    'src/engines/symptom-solver.data-part1.ts',
    'src/engines/symptom-solver.data-part2.ts',
    'src/engines/symptom-solver.data-part3.ts',
    'src/engines/comprehensive-report.engine.ts',
  ];
  const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

  it('нет одиночных мужских порогов без женской половины', () => {
    const bare = [
      "'<40 Ед/л'", "'<55 Ед/л'", "'<110 мкмоль/л'", "'<170 г/л'",
      "'<35 Ед/л'",
      "'HCT<50%'", "'HCT < 50%'", "'HCT <0.50'", "'<50%'", "'<52%'",
    ];
    const bad: string[] = [];
    for (const f of DATA_FILES) {
      const src = read(f);
      for (const b of bare) if (src.includes(b)) bad.push(`${f}: ${b}`);
    }
    expect(bad).toEqual([]);
  });

  it('женские половины совпадают с резолвером', () => {
    const catalog = DATA_FILES.filter(f => !/engines/.test(f)).map(read).join('\n');
    const lft = LFT_STAGE_ULN.reduce.female; // 2×ВГН ♀ = 62 → ВГН 31
    expect(catalog).toContain(`<40 Ед/л (♀ <${lft / 2})`);
    expect(catalog).toContain('<110 мкмоль/л (♀ <97)');
    expect(catalog).toContain('(♀ <150)');
    expect(catalog).toContain('(♀ <48%)');
  });
});

describe('каталог и solver: гормональные цели называют пол', () => {
  // Проход 68: цели `20-50 пг/мл`, `<15 нг/мл` — мужские. У женщины E2 фазовый
  // (подавлять нельзя), PRL норма до 800 мМЕ/л.
  const DATA_FILES = [
    'src/data/support-catalog-data.ts',
    'src/data/support-catalog-extras.ts',
    'src/data/support-catalog-supplement.ts',
    'src/data/support-stacks-part1.ts',
    'src/data/support-stacks-part2.ts',
    'src/engines/symptom-solver.data-part1.ts',
    'src/engines/symptom-solver.data-part2.ts',
    'src/engines/symptom-solver.data-part3.ts',
    'src/engines/comprehensive-report.engine.ts',
  ];
  const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

  it('нет мужских E2/PRL целей без женской половины', () => {
    const bare = [
      "'20-50 пг/мл'", "'♂ 20-40 пг/мл'", "'10-20 пг/мл'", "'<45 пг/мл'",
      "'<200 пмоль/л'", "'80-160 пмоль/л'", "'40-160 пг/мл'", "'40-160 пмоль/л'",
      "'<15 нг/мл'", "'< 15 нг/мл'", "'4-23 нг/мл'", "'86-324 мкМЕ/мл'",
    ];
    const bad: string[] = [];
    for (const f of DATA_FILES) {
      const src = read(f);
      for (const b of bare) if (src.includes(b)) bad.push(`${f}: ${b}`);
    }
    expect(bad).toEqual([]);
  });

  it('женские числа — из бэндов резолвера', () => {
    const all = DATA_FILES.map(read).join('\n');
    expect(all).toContain(`(♀ ${FEMALE_HORMONE_BANDS.PRL.green} мМЕ/л)`);
    expect(all).toContain('(♀ — по фазе, не подавлять)');
    expect(FEMALE_HORMONE_BANDS.E2.normal).toContain('40–200');
  });
});

describe('диапазоны целей называют оба пола', () => {
  // Проход 70: мужские диапазоны (Hct 42-50 %, креатинин 62-106, HGB 130-160)
  // печатались как общие. Женские половины — из `FEMALE_LAB_BOUNDS`.
  const DATA_FILES = [
    'src/data/support-catalog-data.ts',
    'src/data/support-catalog-supplement.ts',
    'src/data/support-stacks-part1.ts',
    'src/data/support-stacks-part2.ts',
    'src/engines/symptom-solver.data-part1.ts',
    'src/engines/symptom-solver.data-part2.ts',
  ];
  const all = () => DATA_FILES.map(f => readFileSync(resolve(process.cwd(), f), 'utf8')).join('\n');

  it('нет голых мужских диапазонов', () => {
    const src = all();
    for (const bare of [
      "'Hct 42-50%'", "'40-50%'", "'40-48%'",
      "'62-106 мкмоль/л'", "'60-110 мкмоль/л'", "'70-110 мкмоль/л'",
      "'130-160 г/л'",
    ]) {
      expect(src, bare).not.toContain(bare);
    }
  });

  it('женские диапазоны совпадают с FEMALE_LAB_BOUNDS', () => {
    const src = all();
    const hct = FEMALE_LAB_BOUNDS.HCT;
    const crea = FEMALE_LAB_BOUNDS.CREATININE;
    const hgb = FEMALE_LAB_BOUNDS.HGB;
    expect(src).toContain(`(♀ ${hct.lln}-${hct.uln}%)`);
    expect(src).toContain(`(♀ ${crea.lln}-${crea.uln})`);
    expect(src).toContain(`(♀ ${hgb.lln}-${hgb.uln})`);
  });
});

describe('панели проблем и таблица мониторинга: пороги называют оба пола', () => {
  // Проход 71: «Густая кровь», «Печень», «Почки» и таблица `LAB_MONITOR_DB`
  // печатали мужские цели и пороги как общие, хотя рядом уже был резолвер.
  const panels = readFileSync(resolve(process.cwd(), 'src/data/labs-problem-panels.ts'), 'utf8');
  const unified = readFileSync(
    resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts/UnifiedSynergyCalculator.tsx'), 'utf8');
  const hepatic = readFileSync(
    resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts/supportProtocolHepatic.tsx'), 'utf8');

  it('панели: цели и пороги с женской половиной', () => {
    for (const bare of [
      "target: '<45 Ед/л'", "target: '<40 Ед/л'", "target: '<55 Ед/л'",
      "target: '44-49%'", "target: '140-165 г/л'", "target: '4.5-5.5 млн/мкл'",
      "target: '<105 мкмоль/л'",
    ]) {
      expect(panels, bare).not.toContain(bare);
    }
    expect(panels).toContain('(♀ 36-48%)');
    expect(panels).toContain('(♀ 4.0-5.2)');
    expect(panels).toContain('(♀ <97)');
  });

  it('ГГТ в таблице мониторинга — из резолвера, не литерал `<55`', () => {
    expect(unified).toContain('GGT_TARGET');
    expect(unified).not.toContain("target:'<55 Ед/л'");
    expect(hepatic).toContain("labUlnText('GGT')");
    expect(hepatic).not.toContain("target:'<55 Ед/л'");
  });
});

describe('мёртвая вкладка «Риски (ТЗ)» не возвращается', () => {
  // Проход 69: компонент не был смонтирован (импорт закомментирован), дублировал
  // механизм-модель LabsScreen и жил только в тестах — удалён вместе с тестом.
  // Модель по классу препарата заменена фактическими препаратами курса.
  it('в LabsScreen нет ссылки на LabsTzRiskTab', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');
    expect(src).not.toMatch(/from '\.\/LabsScreen_parts\/LabsTzRiskTab'/);
  });
});

describe('процедурные гейты и таблица норм симптомов: пороги по полу', () => {
  // Проход 74: гейты эритроцитафереза/оценки гематолога сравнивали с 52/185 и
  // 48/175 — 52 это ЖЕНСКИЙ блок, 175 нет ни в одной шкале приложения. Итог был
  // не косметический: женщина с HCT 49–51% не получала оценки гематолога, а
  // мужчина с нормальным HCT 50 — получал.
  const tz = readFileSync(resolve(process.cwd(), 'src/engines/tz-mapper-engine.ts'), 'utf8');

  it('buildProcedureRecommendations берёт пороги из резолвера и пола', () => {
    const start = tz.indexOf('function buildProcedureRecommendations');
    expect(start).toBeGreaterThan(0);
    const body = tz.slice(start, tz.indexOf('if (dDimer', start));
    expect(body).toContain("ctx.sex === 'female' ? 'female' : 'male'");
    expect(body).toContain('HCT_THRESHOLDS[sexKey]');
    expect(body).toContain('HGB_THRESHOLDS[sexKey]');
    expect(body).not.toMatch(/(hct|hgb)\s*>=\s*\d/);
  });

  it('D-димер в тексте плана — от порога блока обоих полов, не «HCT>52%»', () => {
    expect(tz).not.toContain('D-димер (при HCT>52%)');
    expect(tz).toContain('HCT_THRESHOLDS.male.block}%, ♀ >${HCT_THRESHOLDS.female.block}%');
  });

  it('symptom-lab-link: женские ВГН — из резолвера, а не из второй таблицы', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/symptom-lab-link.ts'), 'utf8');
    expect(src).toContain("resolveLabNorm(code, 'female')");
    expect(src).toContain('linkSymptomsToLabs');
  });

  it('таблица мониторинга: E2 при тамоксифене называет пол', () => {
    const unified = readFileSync(
      resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts/UnifiedSynergyCalculator.tsx'), 'utf8');
    expect(unified).not.toMatch(/target:\s*'100-200 пмоль\/л'/);
    expect(unified).toContain('♂ 100-200 пмоль/л (♀ — по фазе, не подавлять)');
  });
});
