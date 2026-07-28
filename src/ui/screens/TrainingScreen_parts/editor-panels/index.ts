/**
 * editor-panels/index.ts — единая точка входа для editor-панелей.
 * F4.6: разбито на 4 файла (diagnostics, summary, periodization, tools) + shared.
 */
export { PlanDiagnosticsPanel } from './diagnostics';
export { PlanSummaryTable } from './summary';
export { AutoPeriodizationPanel, ProgressionCoach } from './periodization';
export { SplitConsultant, InteractiveVolumePanel, ExerciseInfoPanel, SubstitutionPanel } from './tools';
export type { PanelProps } from './shared';
export { PHASE_LABELS } from './shared';
