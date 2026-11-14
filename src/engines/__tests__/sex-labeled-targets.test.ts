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
import { LFT_STAGE_ULN } from '../../engines/lab-norms.engine';

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

describe('placeholder-нормы формы ввода лаборатории — из резолвера', () => {
  // Вкладка TZ не смонтирована в LabsScreen, но живёт в тестах и как форма
  // ввода. Её женские placeholder'ы раньше были литералами и разъехались:
  // HGB «120-140» (верх 150), ГГТ «<32» (ВГН 31), креатинин «44-80» (верх 97).
  const src = readFileSync(
    resolve(process.cwd(), 'src/ui/screens/LabsScreen_parts/LabsTzRiskTab.tsx'), 'utf8');

  it('женские границы берутся из резолвера', () => {
    expect(src).toContain('HCT_THRESHOLDS.female.erythrocytosis');
    expect(src).toContain('HGB_THRESHOLDS.female.upper');
    expect(src).toContain('LFT_ULN.ALT.female');
    expect(src).toContain('LFT_ULN.AST.female');
    expect(src).toContain('GGT_ULN.female');
    expect(src).toContain('CREATININE_ULN.female');
    expect(src).toContain('FEMALE_HORMONE_BANDS.PRL');
  });

  it('разъехавшихся литералов больше нет', () => {
    expect(src).not.toContain("'120-140'");
    expect(src).not.toContain("'<32'");
    expect(src).not.toContain("'44-80'");
    expect(src).not.toContain("'<48'");
    // E2 в этой таблице — пмоль/л; прежний женский «30-400» был в пг/мл без пометки.
    expect(src).not.toContain("E2: '30-400'");
    expect(src).toContain('FEMALE_HORMONE_BANDS.E2.normal');
  });
});
