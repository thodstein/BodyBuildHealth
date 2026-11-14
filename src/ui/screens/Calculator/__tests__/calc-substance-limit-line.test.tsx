/**
 * calc-substance-limit-line.test.tsx — карточка вещества показывает ПРЕДЕЛ рядом с дозой.
 *
 * Аудит 2026-11: доза в карточке («Магний 200 мг», «Железо 60 мг») стояла без
 * предела, хотя в недельном плане/протоколах плашка `DoseUlBadge` уже есть.
 * Человек читал карточку как «доза проверена» и не видел границы.
 *
 * Второй дефект того же места: масса соли применялась повторно к дозе ПЛАНА
 * (она уже элементарная) — 200 мг магния показывались как «≈28 мг элементарного»,
 * и предел сравнивался бы с заниженным числом.
 *
 * Числа берутся из реестра (`NUTRIENT_LIMITS_V2` → `NUTRIENT_UL`), в тексте
 * тестов они дублируются намеренно: тест ловит дрейф реестра.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { CalcSubstanceDetail } from '../CalcSubstanceDetail';
import { substanceLimitView } from '../Calc.substanceUl';

afterEach(() => cleanup());

describe('substanceLimitView: тип предела и честная подпись', () => {
  it('магний 200 мг — UL 350 мг, без превышения', () => {
    const v = substanceLimitView('magnesium', 200)!;
    expect(v).not.toBeNull();
    expect(v.kind).toBe('UL');
    expect(v.over).toBe(false);
    expect(v.text).toBe('UL 350 мг');
  });

  it('магний 400 мг — «выше UL 350 мг»', () => {
    const v = substanceLimitView('magnesium', 400)!;
    expect(v.over).toBe(true);
    expect(v.text).toContain('выше UL 350 мг');
  });

  it('цинк 50 мг — выше UL 40 мг', () => {
    const v = substanceLimitView('zinc', 50)!;
    expect(v.over).toBe(true);
    expect(v.text).toContain('выше UL 40 мг');
  });

  it('железо 60 мг — Safe Level, а НЕ «превышение UL»', () => {
    const v = substanceLimitView('iron', 60)!;
    expect(v.kind).toBe('SafeLevel');
    expect(v.over).toBe(true);
    expect(v.text).toContain('Safe Level 40 мг');
    expect(v.text).toContain('не порог токсичности');
    expect(v.text).not.toContain('UL 40');
    expect(v.title).toContain('НЕ порог токсичности');
  });

  it('железо 18 мг — предел показан, превышения нет', () => {
    const v = substanceLimitView('iron', 18)!;
    expect(v.over).toBe(false);
    expect(v.text).toBe('Safe Level 40 мг — не порог токсичности');
  });

  it('витамин D3: 5000 МЕ выше UL 4000 МЕ (пересчёт МЕ → мкг)', () => {
    const over = substanceLimitView('vitamin_d3', 5000)!;
    expect(over.over).toBe(true);
    expect(over.text).toContain('выше UL 4000 МЕ');
    const ok = substanceLimitView('vitamin_d3', 2000)!;
    expect(ok.over).toBe(false);
    expect(ok.text).toBe('UL 4000 МЕ');
  });

  it('селен — предел в мкг (255), а не в мг', () => {
    const v = substanceLimitView('selenium', 200)!;
    expect(v.text).toBe('UL 255 мкг');
    expect(substanceLimitView('selenium', 300)!.over).toBe(true);
  });

  it('витамин E 268 мг — в пределах UL 300 мг', () => {
    const v = substanceLimitView('vitamin_e', 268)!;
    expect(v.over).toBe(false);
    expect(v.text).toBe('UL 300 мг');
  });

  it('P5P — та же B6-шкала (EFSA 12 мг)', () => {
    const v = substanceLimitView('p5p', 25)!;
    expect(v.over).toBe(true);
    expect(v.text).toContain('выше UL 12 мг');
  });

  it('B6: в tooltip есть альтернатива IOM 100 мг', () => {
    const v = substanceLimitView('vitamin_b6', 12)!;
    expect(v.title).toContain('IOM');
    expect(v.title).toContain('100 мг');
  });

  it('NAC — клинический ориентир, а не UL', () => {
    const v = substanceLimitView('nac', 4000)!;
    expect(v.kind).toBe('ClinicalGuidance');
    expect(v.over).toBe(true);
    expect(v.text).toContain('клинического ориентира 2400 мг');
    expect(v.text).toContain('не UL');
    expect(v.title).toContain('регуляторного UL нет');
  });

  it('хром — клинический ориентир 1000 мкг', () => {
    const v = substanceLimitView('chromium', 200)!;
    expect(v.kind).toBe('ClinicalGuidance');
    expect(v.over).toBe(false);
    expect(v.text).toContain('1000 мкг');
  });

  it('форма вещества резолвится в нутриент (magnesium_glycinate)', () => {
    const v = substanceLimitView('magnesium_glycinate', 400)!;
    expect(v).not.toBeNull();
    expect(v.over).toBe(true);
    expect(v.text).toContain('350 мг');
  });

  it('доза неизвестна — предел всё равно показываем', () => {
    const v = substanceLimitView('magnesium', null)!;
    expect(v.over).toBe(false);
    expect(v.text).toBe('UL 350 мг');
  });

  it('нет записи в реестре (НПВС) — строки нет, а не «UL не установлен»', () => {
    expect(substanceLimitView('ibuprofen', 400)).toBeNull();
    expect(substanceLimitView('__нет_такого__', 100)).toBeNull();
  });
});

interface RenderOpts {
  subId: string;
  doseMg: number;
  planDose?: number;
}

function renderCard({ subId, doseMg, planDose }: RenderOpts) {
  return render(
    <CalcSubstanceDetail
      sub={{ substanceId: subId, category: 'other', k: 0, reason: 'Ручной выбор', mechsCovered: [], q: 'B' } as any}
      rec={{ subs: [], suppression: [], coverage: [], gaps: [], conflicts: [], guardrails: [], boosters: [], activatedMechs: [], summary: '', rationale: '', level: 'medium', phase: 'on', phaseLabel: 'На курсе' } as any}
      subNameRu={(id: string) => id}
      subDosage={() => ({ mg: doseMg, timing: 'с едой' })}
      planDose={planDose !== undefined ? () => planDose : undefined}
      doseIsElemental={planDose !== undefined}
      subTier={() => 'core'}
      canonIdLocal={(id: string) => id}
    />,
  );
}

describe('CalcSubstanceDetail: предел в шапке карточки', () => {
  it('карточка плана: доза элементарная, соль повторно НЕ применяется', () => {
    const { container } = renderCard({ subId: 'magnesium', doseMg: 200, planDose: 200 });
    const text = container.textContent || '';
    expect(text).toContain('UL 350 мг');
    expect(text).not.toContain('элементарного');
  });

  it('каталог: масса соли пересчитана и сравнена с пределом', () => {
    const { container } = renderCard({ subId: 'magnesium', doseMg: 400 });
    const text = container.textContent || '';
    expect(text).toContain('≈ 64 мг элементарного');
    expect(text).toContain('UL 350 мг');
  });

  it('железо выше safe level — плашка честно говорит «не порог токсичности»', () => {
    const { container } = renderCard({ subId: 'iron', doseMg: 60, planDose: 60 });
    const badge = container.querySelector('[data-substance-limit="SafeLevel"]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute('data-over')).toBe('1');
    expect(badge.textContent).toContain('не порог токсичности');
  });

  it('в пределах предела — нейтральная плашка без «⚠»', () => {
    const { container } = renderCard({ subId: 'zinc', doseMg: 30, planDose: 30 });
    const badge = container.querySelector('[data-substance-limit="UL"]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute('data-over')).toBe('0');
    expect(badge.textContent).not.toContain('⚠');
  });
});
