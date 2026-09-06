import { describe, it, expect } from 'vitest';
import { buildArmPrintHtml, buildArmProSummaryHtml } from '../arm-export.engine';
import { buildArmProSummary } from '../arm-pro-integration.engine';
import { buildArmYearBlocks } from '../arm-annual';
import { buildArmPlan } from '../arm-builder.engine';

function demoPlan(): any {
  return buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 2 });
}

describe('arm-cycle-r6 (summary in print + year opt-in)', () => {
  it('без сводки — PRO-блока в печати нет (байт-в-байт)', () => {
    const html = buildArmPrintHtml(demoPlan());
    expect(html).not.toContain('PRO-сводка тренера');
  });
  it('со сводкой — цикл/медли/CoC в печати + XSS-esc', () => {
    const s: any = buildArmProSummary({
      discipline: 'armlifting', patternId: 'grip_3_support', level: 'advanced', goal: 'strength', technique: 'balanced', weeks: 12,
      cycleId: 'coc_12', medleyId: 'rt_saxon_hub', cocWorking: 'no2',
    } as any);
    const html = buildArmPrintHtml(demoPlan(), undefined, s);
    expect(html).toContain('PRO-сводка тренера');
    expect(html).toContain('CoC 12-week');
    expect(html).toContain('CoC: work no2');
    // XSS: ручная сводка с тегом — экранируется
    const evil = buildArmProSummaryHtml({ cycle: null, medley: null, coc: null, waf: null, bilateral: null, cut: null, supermatch: null, sparring: null, attempts: null, video: null, autoreg: null, cns: null, regimen: { volumeMult: 1, rirShift: 0, lines: ['<script>alert(1)</script>'] } } as any);
    expect(evil).not.toContain('<script>');
    expect(evil).toContain('&lt;script&gt;');
  });
  it('year-blocks: по умолчанию без циклов (байт-в-байт)', () => {
    const blocks = buildArmYearBlocks('local', 12);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((b: any) => b.suggestedCycleId === undefined)).toBe(true);
  });
  it('year-blocks opt-in: каждый блок несёт цикл + note', () => {
    const blocks = buildArmYearBlocks('local', 12, {}, { suggestCycles: true });
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks as any[]) {
      expect(typeof b.suggestedCycleId).toBe('string');
      expect(String(b.suggestedCycleNote)).toMatch('Годовой блок');
    }
    // peaking-блок (приоритет A) — toproll_6
    const peak = (blocks as any[]).find((b) => b.phase === 'peaking');
    if (peak) expect(peak.suggestedCycleId).toBe('toproll_6');
  });
});
