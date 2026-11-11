/**
 * support-geninfo-coverage.test.tsx — «Покрытие каталога» на экране
 * «Как работает» считается из данных, а не из старой строки «Все 435 веществ».
 *
 * Аудит 2026-11: строка утверждала полное покрытие мех-записями, хотя каталог
 * вырос до 521 вещества, большинство записей — ОЦЕНОЧНЫЕ (q='C') механизмы,
 * а часть каталога — сопутствующие препараты (НПВС/ГКС/иммунодепрессанты),
 * которые вообще не должны участвовать в покрытии риска.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { SupportGeneratorInfo } from '../SupportGeneratorInfo';
import { SUPPORT_CATALOG_DATA } from '../../../../data/support-catalog-data';
import '../../../../data/support-catalog-init';
import {
  isCuratedSupport,
  isSupportSubstanceId,
  listUnmappedSupportIds,
} from '../../../../data/support-db/mech-map';

describe('SupportGeneratorInfo: честные цифры покрытия', () => {
  const { container } = render(<SupportGeneratorInfo s={{}} />);
  const text = container.textContent || '';

  it('нет устаревшего «Все 435 мех-веществ»', () => {
    expect(text).not.toContain('435');
    expect(text).not.toContain('полное покрытие, без коротких записей');
  });

  it('числа совпадают с данными: веществ поддержки и кураторских записей', () => {
    const ids = Object.keys(SUPPORT_CATALOG_DATA);
    expect(ids.length).toBeGreaterThan(400);
    const support = ids.filter(isSupportSubstanceId);
    const curated = support.filter(isCuratedSupport).length;
    const m = /Покрытие каталога:\s*(\d+) веществ[^—]*—\s*(\d+)/.exec(text);
    expect(m, text.slice(0, 400)).toBeTruthy();
    expect(Number(m![1])).toBe(support.length);
    expect(Number(m![2])).toBe(curated);
  });

  it('оценочная часть, сопутствующие препараты и «без механизмов» показаны явно', () => {
    expect(text).toContain('оценочных по токенам каталога');
    expect(text).toContain('сопутствующие препараты');
    const m = /без механизмов —\s*(\d+)/.exec(text);
    expect(m, text.slice(-400)).toBeTruthy();
    // Реальных дыр покрытия быть не должно — 0.
    expect(Number(m![1])).toBe(0);
    expect(listUnmappedSupportIds()).toEqual([]);
  });

  it('сопутствующих препаратов столько же, сколько записей вне покрытия', () => {
    const ids = Object.keys(SUPPORT_CATALOG_DATA);
    const outside = ids.length - ids.filter(isSupportSubstanceId).length;
    const m = /Ещё (\d+) записей — сопутствующие/.exec(text);
    expect(m, text.slice(-400)).toBeTruthy();
    expect(Number(m![1])).toBe(outside);
  });
});
