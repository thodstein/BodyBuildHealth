/**
 * BioStackAIBuild — unified builder entry point.
 *
 * The two previous builders (TZ cascade mode + clinical mode, originally kept
 * behind a mode toggle here) have been unified into a single flow in
 * BioStackAIClinicalBuild: organ card selection → per-organ mechanism/marker
 * multi-select → evidence-level (A/B/C) filter → clinical-style result.
 *
 * This module is kept as a thin bridge so BioStackAIScreen keeps importing
 * `BuildTab` from './BioStackAIBuild' unchanged. The real implementation lives
 * in BioStackAIClinicalBuild; nothing else in the project imports this file.
 */
export { default as BuildTab } from './BioStackAIClinicalBuild';
