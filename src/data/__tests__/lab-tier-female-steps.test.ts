/**
 * lab-tier-female-steps.test.ts — проход 97: у женских гормонов своя лестница
 * шагов, а не тишина.
 *
 * Было: `MALE_ONLY_TIER` снимал у женщины мужскую лестницу (анастрозол,
 * кломифен), а алерт (`femaleHormoneAlert`, проход 83) говорил только про
 * крайние бэнды: E2 >800 или <30, прогестерон >30, пролактин >1500, тестостерон
 * >6. Пограничная полоса — E2 400–800, прогестерон 20–30, пролактин 800–1500,
 * тестостерон 2.5–6 — оставалась пустой: маркер отклонён, а следующего шага нет,
 * при том что мужчина на той же цифре получал препарат и титрацию.
 *
 * Стало: `femaleHormoneSteps` даёт диагностические шаги (1 — пересдать в
 * правильную фазу, 2 — визуализация/смежный анализ) по порогам
 * `FEMALE_HORMONE_ULN`. Мужской путь и путь без пола не изменены.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeTierAdjustments } from '../lab-tier-recommendations';

const actions = (r: { nutrition: { action: string }[] }) => r.nutrition.map((t) => t.action);
const targets = (r: { nutrition: { target: string }[] }) => r.nutrition.map((t) => t.target).join(' ');
const ids = (r: { titrations: { id: string }[]; addSubs: { id: string }[] }) =>
  [...r.titrations.map((t) => t.id), ...r.addSubs.map((s) => s.id)];

describe('проход 97: женская лестница шагов на пограничном гормоне', () => {
  it('E2 500: пересдать по фазе и УЗИ, без анастрозола и без алерта', () => {
    const r = computeTierAdjustments({ E2: 500 }, 'female');
    expect(actions(r)).toContain('Пересдать E2');
    expect(actions(r)).toContain('УЗИ');
    expect(targets(r)).toContain('2–5 день цикла');
    expect(r.alerts).toHaveLength(0);
    expect(ids(r)).not.toContain('anastrozole');
    expect(r.tierSummary.find((s) => s.marker === 'E2')?.tier).toBe(2);
  });

  it('E2 900: алерт третьей ступени остаётся главным, шаги рядом с ним', () => {
    const r = computeTierAdjustments({ E2: 900 }, 'female');
    expect(r.alerts.map((a) => a.message).join(' ')).toContain('гинеколог');
    expect(actions(r)).toContain('УЗИ');
    expect(r.tierSummary.find((s) => s.marker === 'E2')?.tier).toBe(3);
  });

  it('E2 20: к алерту добавлен шаг «пересдать с ФСГ и АМГ»', () => {
    const r = computeTierAdjustments({ E2: 20 }, 'female');
    expect(r.alerts.map((a) => a.message).join(' ')).toContain('дефицит эстрогенов');
    expect(targets(r)).toContain('ФСГ');
    expect(r.tierSummary.find((s) => s.marker === 'E2')?.tier).toBe(2);
  });

  it('E2 70 (её лютеиновая) — тишина, как и была', () => {
    const r = computeTierAdjustments({ E2: 70 }, 'female');
    expect(r.nutrition).toHaveLength(0);
    expect(r.alerts).toHaveLength(0);
    expect(r.tierSummary).toHaveLength(0);
  });

  it('прогестерон 25: пересдать в лютеиновую и УЗИ; 12 — тишина', () => {
    const r = computeTierAdjustments({ PROG: 25 }, 'female');
    expect(actions(r)).toContain('Пересдать прогестерон');
    expect(actions(r)).toContain('УЗИ');
    expect(r.alerts).toHaveLength(0);
    expect(computeTierAdjustments({ PROG: 12 }, 'female').nutrition).toHaveLength(0);
  });

  it('пролактин 1000: пересдать натощак + ТТГ и макропролактин; 300 — тишина', () => {
    const r = computeTierAdjustments({ PRL: 1000 }, 'female');
    expect(actions(r)).toContain('Повторить пролактин');
    expect(actions(r)).toContain('ТТГ и макропролактин');
    expect(r.alerts).toHaveLength(0);
    expect(computeTierAdjustments({ PRL: 300 }, 'female').nutrition).toHaveLength(0);
  });

  it('тестостерон 3.5: повторить с ГСПГ + гинеколог-эндокринолог; 2 — тишина', () => {
    const r = computeTierAdjustments({ TESTOSTERONE: 3.5 }, 'female');
    expect(actions(r)).toContain('Повторить тестостерон');
    expect(actions(r)).toContain('Гинеколог-эндокринолог');
    expect(r.alerts).toHaveLength(0);
    expect(computeTierAdjustments({ TESTOSTERONE: 2 }, 'female').nutrition).toHaveLength(0);
  });

  it('мужской путь и путь без пола шагов не получают', () => {
    expect(actions(computeTierAdjustments({ E2: 500 }, 'male'))).not.toContain('Пересдать E2');
    expect(actions(computeTierAdjustments({ PROG: 25 }))).not.toContain('Пересдать прогестерон');
    expect(actions(computeTierAdjustments({ PRL: 1000 }, 'male'))).not.toContain('ТТГ и макропролактин');
  });

  it('источник: пороги шагов — из резолвера, а не литералами', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/data/lab-tier-recommendations.ts'), 'utf8');
    expect(src).toContain('function femaleHormoneSteps(');
    expect(src).toContain('for (const s of femSteps) nutrition.push(s);');
    const body = src.slice(src.indexOf('function femaleHormoneSteps('), src.indexOf('//  computeTierAdjustments — главная функция'));
    expect(body).toContain('FEMALE_HORMONE_ULN.E2');
    expect(body).toContain('FEMALE_HORMONE_ULN.PROG');
    expect(body).toContain('FEMALE_HORMONE_ULN.PRL');
    expect(body).toContain('FEMALE_HORMONE_ULN.TT');
    expect(body).not.toMatch(/\b(800|1500|2\.5)\b/);
  });
});
