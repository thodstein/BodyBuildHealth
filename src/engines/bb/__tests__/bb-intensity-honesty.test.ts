/**
 * Волна 5.5 (BB-AUTO-EXHAUSTIVE-PRO): философия интенсив-методик — «тайм-эффективность,
 * не превосходство». Sødal 2023: drop ≈ традиционные подходы (SMD 0.04); Havers 2026 /
 * Tsartsapakis 2026: rest-pause — небольшой плюс; Enes 2025: темп/схема минимально влияют
 * при равном усилии. Lock: в текстах-источниках нет клеймов превосходства над
 * традиционными подходами, маркеры тайм-эффективности на месте.
 *
 * Источники текстов: `bb-intensity-techniques.ts` (UI-каталог), `bb-rep-schemes.engine.ts`
 * (схемы), `bb-autocoach.engine.ts` (канон UI-описаний техник), `PHASE_TECHNIQUES`
 * в `bb-auto-constructor-shared.tsx` (подсказки по фазам).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INTENSITY_TECHNIQUES as ENGINE_TECHNIQUES } from '../bb-autocoach.engine';
import { INTENSITY_TECHNIQUES as UI_CATALOG, techniquesFor } from '../bb-intensity-techniques';
import { REP_SCHEMES } from '../bb-rep-schemes.engine';

const FORBIDDEN: Array<{ re: RegExp; why: string }> = [
  { re: /эффективнее\s+(традиционн|обычн|классическ)/i, why: 'утверждение «эффективнее традиционного»' },
  { re: /лучше\s+(традиционн|обычн|классическ)/i, why: 'утверждение «лучше традиционного»' },
  { re: /(быстрее|больше)\s+(рост|гипертроф|мышц)/i, why: 'утверждение «быстрее/больше роста»' },
  { re: /гарантированн\w*/i, why: 'гарантия результата' },
  { re: /супер-?эффект/i, why: '«супер-эффект»' },
  { re: /превосходит\s+(традиционн|обычн|классическ)/i, why: 'утверждение превосходства' },
  { re: /максимальн\w+\s+эффективность/i, why: '«максимальная эффективность»' },
  { re: /объ[её]мный\s+шок/i, why: 'маркетинговый «объёмный шок»' },
];

function checkTexts(entries: Array<{ text: string; where: string }>): string[] {
  const bad: string[] = [];
  for (const { text, where } of entries) {
    for (const { re, why } of FORBIDDEN) {
      if (re.test(text)) bad.push(`${where}: «${text.slice(0, 90)}…» — ${why}`);
    }
  }
  return bad;
}

const sharedSrc = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'bb-auto-constructor-shared.tsx'), 'utf8');
const catalogSrc = readFileSync(resolve(__dirname, '..', 'bb-intensity-techniques.ts'), 'utf8');
const repSchemesSrc = readFileSync(resolve(__dirname, '..', 'bb-rep-schemes.engine.ts'), 'utf8');
const autocoachSrc = readFileSync(resolve(__dirname, '..', 'bb-autocoach.engine.ts'), 'utf8');

function phaseTechniquesBlock(): string {
  const idx = sharedSrc.indexOf('export const PHASE_TECHNIQUES');
  expect(idx, 'PHASE_TECHNIQUES не найден в shared').toBeGreaterThanOrEqual(0);
  const commentStart = sharedSrc.lastIndexOf('/**', idx);
  const end = sharedSrc.indexOf('\n};', idx);
  return sharedSrc.slice(commentStart >= 0 ? commentStart : idx, end + 3);
}

describe('5.5: нет клеймов превосходства в текстах интенсив-методик', () => {
  it('канон движка (bb-autocoach INTENSITY_TECHNIQUES)', () => {
    const bad = checkTexts(Object.values(ENGINE_TECHNIQUES).map(t => ({ text: t.description, where: `engine:${t.type}` })));
    expect(bad).toEqual([]);
  });

  it('UI-каталог (bb-intensity-techniques)', () => {
    const bad = checkTexts(UI_CATALOG.map(t => ({ text: t.description, where: `catalog:${t.technique}` })));
    expect(bad).toEqual([]);
  });

  it('схемы повторений (REP_SCHEMES)', () => {
    const bad = checkTexts(Object.values(REP_SCHEMES).map(s => ({ text: `${s.description} ${s.evidence}`, where: `scheme:${s.id}` })));
    expect(bad).toEqual([]);
  });

  it('подсказки по фазам (PHASE_TECHNIQUES) — только названия техник без клеймов', () => {
    const bad = checkTexts([{ text: phaseTechniquesBlock(), where: 'PHASE_TECHNIQUES' }]);
    expect(bad).toEqual([]);
  });
});

describe('5.5: маркеры тайм-эффективности и источники', () => {
  it('движок: rest-pause/drop-set — тайм-эффективность + Sødal 2023, «не превосходство»', () => {
    const rp = ENGINE_TECHNIQUES.rest_pause.description;
    const drop = ENGINE_TECHNIQUES.drop_set.description;
    for (const text of [rp, drop]) {
      expect(/тайм-эффективност|экономия времени/i.test(text), text).toBe(true);
      expect(text).toContain('Sødal 2023');
    }
    expect(drop).toContain('не превосходство');
  });

  it('шапки источников несут философию и Sødal 2023', () => {
    expect(catalogSrc).toContain('ТАЙМ-ЭФФЕКТИВНОСТЬ');
    expect(catalogSrc).toContain('Sødal 2023');
    expect(repSchemesSrc).toContain('ТАЙМ-ЭФФЕКТИВНОСТЬ');
    expect(repSchemesSrc).toContain('Sødal 2023');
    expect(autocoachSrc).toContain('ТАЙМ-ЭФФЕКТИВНОСТЬ, не');
    expect(phaseTechniquesBlock()).toContain('тайм-эффективность');
  });

  it('каталог: ≥3 описания с тайм-эффективностью; GVT без «объёмного шока»', () => {
    const count = UI_CATALOG.filter(t => /тайм-эффективност|экономия времени|плотность|сопоставим/i.test(t.description)).length;
    expect(count).toBeGreaterThanOrEqual(3);
    expect(REP_SCHEMES.gvt.description).not.toMatch(/шок/i);
    expect(REP_SCHEMES.gvt.description).toContain('Schoenfeld 2017');
  });

  it('имена/уровни техник не изменились (совместимость UI/парсеров)', () => {
    expect(techniquesFor('памп', 'advanced').some(t => t.name === 'Дроп-сет')).toBe(true);
    expect(ENGINE_TECHNIQUES.rest_pause.label).toBe('Rest-pause');
    expect(ENGINE_TECHNIQUES.drop_set.label).toBe('Drop-set');
    expect(ENGINE_TECHNIQUES.negative.label).toContain('Негативы');
  });
});
