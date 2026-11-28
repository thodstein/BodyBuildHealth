import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BbAutoConstructor } from '../BbAutoConstructor';
import { BbSplitStep } from '../bb-step-split';
import { BbPlanStep } from '../bb-step-plan';
import { ACCENT, DIM, DIM_STRONG, bbCardTitle } from '../training-ui';
import { buildBBPlan } from '../../../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics } from '../../../../engines/bb/bb-metrics.engine';
import { rankBBSplits } from '../../../../engines/bb/bb-selector.engine';

describe('Wave 6 — Design System Tokens, APK Native CSS, Quick-Start & UX Polish', () => {
  it('shared design tokens use CSS custom properties for Light Theme & Dynamic Color', () => {
    expect(ACCENT).toContain('var(--accent');
    expect(DIM).toContain('var(--text-dim');
    expect(DIM_STRONG).toContain('var(--text');
    expect(String(bbCardTitle.color)).toContain('var(--text');
  });

  it('styles-native.css defines section 120 BB-AUTO CONSTRUCTOR PRO with >=44px tap targets, safe-area, tabular-nums, <=380px grid', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles-native.css'), 'utf8');
    expect(css).toContain('120. BB-AUTO CONSTRUCTOR PRO (Wave 6)');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('tabular-nums');
    expect(css).toContain('@media (max-width: 380px)');
  });

  it('BbAutoConstructor renders bb-auto-root, Quick-Start 1-click button, Базовый/PRO toggle, and sticky CTA', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).toContain('bb-auto-root');
    expect(html).toContain('quick-start-btn');
    expect(html).toContain('params-mode-basic');
    expect(html).toContain('params-mode-pro');
    expect(html).toContain('sticky-cta');
    expect(html).not.toContain('NaN');
  });

  it('BbSplitStep renders top-3 split comparison grid; BbPlanStep renders ±1d/±1w shift and progression bars', () => {
    const ranked = rankBBSplits({ daysPerWeek: 4, level: 'intermediate', goal: 'mass' });
    const splitHtml = renderToStaticMarkup(React.createElement(BbSplitStep, {
      selectedSplitId: ranked[0].pattern.id,
      onSelectSplit: () => {},
      bestSplit: ranked[0],
      phases: [{ week: 1, phase: 'accumulation' }],
      ranked,
      suggestSplitIds: new Set([ranked[0].pattern.id]),
      goal: 'mass',
      level: 'intermediate',
      weeks: 6,
      daysPerWeek: 4,
      isBuilding: false,
      onBuild: () => {},
      onBack: () => {},
    }));
    expect(splitHtml).toContain('split-compare-top3');

    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any) as any;
    const metrics = calcBBPlanMetrics(plan) as any;
    const planHtml = renderToStaticMarkup(React.createElement(BbPlanStep, {
      builtPlan: plan,
      metrics,
      bbWeekSel: 1,
      setBbWeekSel: () => {},
      bbWeeks: 4,
      autoDeload: false,
      weakPoints: [],
      dupMode: 'none' as any,
      autoRegOn: false,
      autoRegResult: null,
      exerciseEdits: {},
      setExerciseEdits: () => {},
      editMode: null,
      setEditMode: () => {},
      collapsedDays: new Set(),
      setCollapsedDays: () => {},
      collapsedExercises: new Set(),
      setCollapsedExercises: () => {},
      bbTrainingFocus: 'hypertrophy',
      bbLevel: 'intermediate',
      setSubTarget: () => {},
      handleSendToExecution: () => {},
      setWeightEntries: () => {},
      setWeightsApplied: () => {},
      setStep: () => {},
      startDateInput: '2026-12-01',
      setStartDateInput: () => {},
      actionRow: React.createElement('div'),
    }));
    expect(planHtml).toContain('−1 день');
    expect(planHtml).toContain('+1 день');
    expect(planHtml).toContain('−1 неделя');
    expect(planHtml).toContain('+1 неделя');
    expect(planHtml).toContain('week-progression-bars');
  });
});
