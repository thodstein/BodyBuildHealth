import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ACWR_ZONE_META, type ACWRZone } from '../training-load.engine';

const HUB = resolve(__dirname, '../../../ui/screens/TrainingScreen_parts/UnifiedIntelligenceHub.tsx');
const src = readFileSync(HUB, 'utf8');

describe('E9 единый канон зон ACWR в хабе', () => {
  it('хаб импортирует канон зон из движка, а не рисует свои пороги', () => {
    expect(src).toContain('ACWR_ZONE_META');
    // Локальный ZONE_META — только расширение канона короткой подписью, без своих label/color.
    const local = src.slice(src.indexOf('const ZONE_META'), src.indexOf('const ZONE_META') + 700);
    for (const zone of ['undertrained', 'optimal', 'caution', 'dangerous'] as ACWRZone[]) {
      expect(local).toContain(`...ACWR_ZONE_META.${zone}`);
      expect(local).not.toContain(`label: '${ACWR_ZONE_META[zone].label}'`);
    }
  });

  it('в хабе нет захардкоженных подписей зон (иначе UI разойдётся с движком)', () => {
    for (const zone of Object.keys(ACWR_ZONE_META) as ACWRZone[]) {
      const label = ACWR_ZONE_META[zone].label;
      // Подпись зоны может встречаться только через ZONE_META[...] — прямых литералов нет.
      const literal = new RegExp(`label:\\s*'${label}'`).test(src);
      expect(literal).toBe(false);
    }
    // И «опасная зона» из старой формулировки тоже не должна жить в UI.
    expect(src).not.toContain('опасная зона');
  });

  it('все 5 секций хаба + отчёт тренеру помечены data-intel (тестируемость/АПК-хук)', () => {
    for (const id of ['load', 'recovery', 'autoreg', 'forecast', 'recommendations', 'coach']) {
      expect(src).toMatch(new RegExp(`id="sec-${id}"[^>]*data-intel="${id}"`));
    }
    expect(src).toContain('data-intel-card="cmj"');
    expect(src).toContain('data-intel-card="wellness"');
    expect(src).toContain('data-intel-card="coach-report"');
  });

  it('канон движка самодостаточен: у каждой зоны есть label/color/hint', () => {
    for (const zone of Object.keys(ACWR_ZONE_META) as ACWRZone[]) {
      const m = ACWR_ZONE_META[zone];
      expect(m.label.length).toBeGreaterThan(2);
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.hint.length).toBeGreaterThan(10);
    }
  });
});
