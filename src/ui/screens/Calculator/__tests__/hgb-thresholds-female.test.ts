/**
 * hgb-thresholds-female.test.ts — проход 53: порог гемоглобина называет оба пола.
 *
 * Было: таблица лабораторного мониторинга синерго-калькулятора (`LAB_MONITOR_DB`)
 * печатала мужские «<170 г/л» / «>185 — стоп» как ОБЩИЙ порог. Для женщины верх
 * нормы — 150 г/л, вмешательство (кровопускание + отмена) — 165. Тот же класс,
 * что HCT в проходах 39–50: одно число выдаётся за порог для всех.
 *
 * Источник чисел — `HGB_THRESHOLDS` в `lab-norms.engine` (верх нормы берётся из
 * резолвера полов, а не литералом), реэкспорт — через первичную модель
 * (`risk-engine-tz-spec`), как у `HCT_THRESHOLDS`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { HGB_THRESHOLDS } from '../../../../engines/lab-norms.engine';
import { HGB_THRESHOLDS as HGB_FROM_SPEC } from '../../../../engines/risk-engine-tz-spec';
import { LAB_MONITOR_DB } from '../../SupportScreen_parts/UnifiedSynergyCalculator';

describe('гемоглобин: одна шкала на оба пола', () => {
  it('♂ 170/185, ♀ 150/165 — и реэкспорт из первичной модели тот же объект', () => {
    expect(HGB_THRESHOLDS.male).toEqual({ upper: 170, block: 185 });
    expect(HGB_THRESHOLDS.female).toEqual({ upper: 150, block: 165 });
    expect(HGB_FROM_SPEC).toBe(HGB_THRESHOLDS);
  });

  it('женские пороги строго ниже мужских (пол не перевёрнут)', () => {
    expect(HGB_THRESHOLDS.female.upper).toBeLessThan(HGB_THRESHOLDS.male.upper);
    expect(HGB_THRESHOLDS.female.block).toBeLessThan(HGB_THRESHOLDS.male.block);
  });

  it('женский протокол держит тот же порог флеботомии (165)', () => {
    const women = readFileSync(
      resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts/supportProtocolWomenData.ts'),
      'utf8',
    );
    expect(women).toContain(`>${HGB_THRESHOLDS.female.block} г/л`);
  });

  it('таблица мониторинга: оба HGB-маркера называют ♀ и берут числа из шкалы', () => {
    const hgb = Object.values(LAB_MONITOR_DB)
      .flat()
      .filter((m) => m.markerEn === 'HEMOGLOBIN');
    expect(hgb.length).toBeGreaterThanOrEqual(2);
    for (const m of hgb) {
      const text = `${m.target} ${m.note ?? ''} ${m.tier1 ?? ''} ${m.tier2 ?? ''} ${m.tier3 ?? ''}`;
      expect(text, m.markerRu).toContain('♀');
      expect(text, m.markerRu).toContain(String(HGB_THRESHOLDS.female.upper));
      expect(text, m.markerRu).toContain(String(HGB_THRESHOLDS.female.block));
    }
  });
});

describe('гемоглобин: тексты не вводят мужской порог как общий', () => {
  it('в UI порог HGB рядом с ♀ или в файле с явной оговоркой', () => {
    // Исключения названы, а не «забыты»:
    //  - `supportProtocolHemato` — лестница гематологии с оговоркой «к женщинам
    //    не применяются» (мужской протокол, второй слой — женский файл);
    //  - `supportProtocolWomenData` — это и есть женский слой (♀ по определению);
    //  - `NutritionScreen_parts/IndividualPlan` — планировщик питания переписывается
    //    параллельно (чужой WIP); его HGB/HCT-строка получит ♀ при мерже.
    const root = resolve(process.cwd(), 'src/ui');
    const bad: string[] = [];
    let scanned = 0;
    for (const p of walk(root)) {
      const rel = relative(process.cwd(), p).replace(/\\/g, '/');
      if (rel.includes('NutritionScreen_parts/IndividualPlan')) continue;
      if (/WomenData/.test(rel)) continue;
      const src = readFileSync(p, 'utf8');
      if (/♀ Женщины|к женщинам не применяются/.test(src)) continue;
      scanned++;
      src.split(/\r?\n/).forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (!/(гемоглобин|hemoglobin|\bHGB\b|\bHb\b)/i.test(line)) return;
        if (!/([<>≥≤]|выше|ниже|более|менее|STOP|стоп|отмен)/i.test(line)) return;
        // Порог: г/л (140–199) или г/дл (14–19.9) — только рядом с маркером.
        if (!/(1[4-9]\d)\s*г\/л/i.test(line) && !/(1[4-9][.,]\d)\s*г\/дл/i.test(line)) return;
        if (/♀|женск|female|\(ж\)/i.test(line)) return;
        bad.push(`${rel}:${i + 1} — ${line.trim().slice(0, 110)}`);
      });
    }
    expect(scanned).toBeGreaterThan(40);
    expect(bad).toEqual([]);
  });

  it('исключение «мужская лестница» объявлено в самом файле', () => {
    const hemato = readFileSync(
      resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts/supportProtocolHemato.tsx'),
      'utf8',
    );
    expect(hemato).toMatch(/к женщинам не применяются/);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (/__tests__|node_modules/.test(e)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}
