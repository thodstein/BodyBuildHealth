/**
 * lab-tier-female-hormones.test.ts — проход 83: мужская лестница действий к
 * женским гормонам не применяется.
 *
 * Было: `LAB_TIERS` и `TIER_RULES` для гормонов написаны мужчине на курсе
 * (E2 20–40 пг/мл, прогестерон 0.3–1.5 нг/мл, ЛГ 1.7–9, тестостерон 15–50,
 * пролактин 2–15 нг/мл), поэтому женщина получала:
 * — лютеиновую E2 450 → tier 3 и «снизить/отменить» с титрацией анастрозола;
 * — прогестерон 12 (нормальная лютеиновая) → tier 3 «гинекомастия/либидо»;
 * — подавленный на курсе ЛГ 0.5 → tier 3 с мужскими действиями ПКТ;
 * — пролактин 300 мМЕ/л (норма женщины) → tier 3, потому что мужская шкала в нг/мл.
 *
 * Стало: у женщины эти маркеры ступень не получают вовсе (`MALE_ONLY_TIER`), а
 * тревожные бэнды женской модели печатаются своей формулировкой
 * (`femaleHormoneAlert`) — «гинеколог/эндокринолог», без ИА и кломифена.
 * Мужской путь и путь без пола не изменены.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveTier } from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';

const ids = (r: { titrations: { id: string }[]; addSubs: { id: string }[] }) =>
  [...r.titrations.map((t) => t.id), ...r.addSubs.map((s) => s.id)];
const alertText = (r: { alerts: { message: string }[] }) => r.alerts.map((a) => a.message).join(' ');

describe('ступени женских гормонов: мужская лестница не применяется', () => {
  it('E2 450 у женщины ступени нет; у мужчины это tier 3 (≥100)', () => {
    expect(deriveTier('E2', 450, 'female')).toBe(0);
    expect(deriveTier('E2', 450, 'male')).toBe(3);
  });

  it('лютеиновый прогестерон 12 у женщины ступени нет; у мужчины tier 3 (≥10)', () => {
    expect(deriveTier('PROG', 12, 'female')).toBe(0);
    expect(deriveTier('PROG', 12, 'male')).toBe(3);
  });

  it('подавленный ЛГ 0.5 у женщины — не «экстренно»; у мужчины tier 3', () => {
    expect(deriveTier('LH', 0.5, 'female')).toBe(0);
    expect(deriveTier('LH', 0.5, 'male')).toBe(3);
  });

  it('пролактин 300 (норма женщины в мМЕ/л) — не tier 3', () => {
    expect(deriveTier('PRL', 300, 'female')).toBe(0);
    expect(deriveTier('PRL', 300, 'male')).toBe(3);
  });

  it('женские ряды, которые уже сведены, работают как раньше: АЛТ 35', () => {
    expect(deriveTier('ALT', 35, 'female')).toBe(1);
    expect(deriveTier('ALT', 35, 'male')).toBe(0);
  });

  it('без пола — прежний путь байт-в-байт', () => {
    expect(deriveTier('E2', 450)).toBe(3);
    expect(computeTierAdjustments({ E2: 70 }).titrations.map((t) => t.id)).toContain('anastrozole');
  });
});

describe('алерты женских гормонов: свои слова вместо мужских действий', () => {
  it('E2 900 — гинеколог, без анастрозола и без STOP COURSE', () => {
    const r = computeTierAdjustments({ E2: 900 }, 'female');
    expect(alertText(r)).toContain('гинеколог');
    expect(ids(r)).not.toContain('anastrozole');
    expect(r.stopCourse).toBe(false);
  });

  it('E2 70 у женщины — нормальная лютеиновая: молчание; у мужчины — титрация ИА', () => {
    const fem = computeTierAdjustments({ E2: 70 }, 'female');
    expect(fem.alerts).toHaveLength(0);
    expect(ids(fem)).not.toContain('anastrozole');
    expect(ids(computeTierAdjustments({ E2: 70 }, 'male'))).toContain('anastrozole');
  });

  it('E2 20 у женщины — дефицит эстрогенов, к гинекологу', () => {
    const r = computeTierAdjustments({ E2: 20 }, 'female');
    expect(alertText(r)).toContain('дефицит эстрогенов');
  });

  it('прогестерон 35 — гинеколог; лютеиновые 12 молчат', () => {
    expect(alertText(computeTierAdjustments({ PROG: 35 }, 'female'))).toContain('гинеколог');
    expect(computeTierAdjustments({ PROG: 12 }, 'female').alerts).toHaveLength(0);
  });

  it('пролактин 30 нг/мл молчит, 80 — эндокринолог; канон PROLACTIN тоже срабатывает', () => {
    expect(computeTierAdjustments({ PRL: 30 }, 'female').alerts).toHaveLength(0);
    expect(alertText(computeTierAdjustments({ PRL: 80 }, 'female'))).toContain('эндокринолог');
    expect(alertText(computeTierAdjustments({ PROLACTIN: 80 }, 'female'))).toContain('нг/мл');
  });

  it('тестостерон 50 нг/дл (норма женщины) молчит, 200 — вирилизация', () => {
    expect(computeTierAdjustments({ TESTOSTERONE: 50 }, 'female').alerts).toHaveLength(0);
    expect(alertText(computeTierAdjustments({ TESTOSTERONE: 200 }, 'female'))).toContain('Вирилизация');
    expect(alertText(computeTierAdjustments({ TESTOSTERONE: 200 }, 'female'))).toContain('нг/дл');
  });

  it('мужской путь гормонов не тронут: E2 900 — мужской текст и tier 3 в сводке', () => {
    const male = computeTierAdjustments({ E2: 900 }, 'male');
    expect(alertText(male)).toContain('Эстр');
    expect(alertText(male)).not.toContain('гинеколог');
    expect(male.tierSummary.find((s) => s.marker === 'E2')?.tier).toBe(3);
  });
});

describe('источник: женские гормоны перечислены в MALE_ONLY_TIER', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/data/lab-tier-ranges.ts'), 'utf8');

  it('список закрыт и покрывает все гормональные шкалы', () => {
    const m = src.match(/const MALE_ONLY_TIER = new Set\(\[([\s\S]*?)\]\);/);
    expect(m).not.toBeNull();
    const list = m![1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
    // Проход 175: список держит канонические имена. Вторые написания
    // (`ESTRADIOL`, `PROGESTERONE`, `TOTAL_T`, `PROLACTIN`) закрываются
    // таблицей `TIER_SAME_ANALYSIS`, а не повтором в этом наборе.
    expect(list.sort()).toEqual(['DHT', 'E2', 'FSH', 'LH', 'PRL', 'PROG', 'TESTOSTERONE']);
  });

  it('всякое второе имя мужского гормона ведёт к канону', () => {
    const aliases = [...src.matchAll(/^\s{2}([A-Z0-9_]+): \{ canon: '([A-Z0-9_]+)'/gm)]
      .map(([, alias, canon]) => [alias, canon]);
    const maleOnly = new Set(['E2', 'PROG', 'LH', 'FSH', 'TESTOSTERONE', 'PRL', 'DHT']);
    const covered = aliases.filter(([, canon]) => maleOnly.has(canon)).map(([alias]) => alias);
    expect(covered).toEqual(expect.arrayContaining(['ESTRADIOL', 'PROGESTERONE', 'TOTAL_T', 'PROLACTIN']));
  });

  it('ступень обнуляется до выбора шкалы', () => {
    // Проверка читает строку кода: обнуление обязано стоять до `FEMALE_TIER_OVERRIDES`
    // и до разбора диапазонов, иначе женщина получает мужские действия.
    const zero = src.indexOf("MALE_ONLY_TIER.has(tierCanonicalKey(key))");
    const scale = src.indexOf('const override = sex ===');
    expect(zero).toBeGreaterThan(-1);
    expect(scale).toBeGreaterThan(-1);
    expect(zero).toBeLessThan(scale);
  });
});
