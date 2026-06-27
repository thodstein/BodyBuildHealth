// ── Orchestrator — единый pipeline по ТЗ (вход → модули → результат) ──
// Запускает все Score Engines, объединяет результаты в единый отчёт

import type { ModuleResult, ScoreReport } from './score-engine';
import type { ScoreInput as SupportInput } from './score-engine';
import type { LabInput } from './score-labs';
import type { NutritionInput } from './score-nutrition';
import type { TrainingInput } from './score-training';
import type { PharmaInput } from './score-pharma';

import { runScoreAnalysis, getSuggestedPlan, generateScoreReportText } from './score-engine';
import { analyzeLabs, generateLabsReport } from './score-labs';
import { analyzeNutrition, generateNutritionReport } from './score-nutrition';
import { analyzeTraining, generateTrainingReport } from './score-training';
import { analyzePharma, generatePharmaReport } from './score-pharma';

// ─── Full Input ───

export interface OrchestratorInput {
  support?: Partial<SupportInput>;
  labs?: Partial<LabInput>;
  nutrition?: Partial<NutritionInput>;
  training?: Partial<TrainingInput>;
  pharma?: Partial<PharmaInput>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
}

export interface OrchestratorResult {
  timestamp: string;
  profile: { weight: number; age: number; sex: string };
  modules: {
    support: ScoreReport | null;
    labs: ModuleResult | null;
    nutrition: ModuleResult | null;
    training: ModuleResult | null;
    pharma: ModuleResult | null;
  };
  overallRisk: number;
  recommendations: string[];
}

// ─── Orchestrator ───

export function runPipeline(input: OrchestratorInput): OrchestratorResult {
  const { weight, age, sex } = input;

  // Phase 1: Run all modules independently
  const pharmaResult = input.pharma
    ? analyzePharma({
        course: input.pharma.course || [],
        weight: input.pharma.weight ?? weight,
        age: input.pharma.age ?? age,
        sex: input.pharma.sex || sex,
        labs: input.pharma.labs,
      })
    : null;

  const labsResult = input.labs
    ? analyzeLabs({
        markers: input.labs.markers || [],
        weight: input.labs.weight ?? weight,
        age: input.labs.age ?? age,
        sex: input.labs.sex || sex,
      })
    : null;

  const nutritionResultRaw = input.nutrition
    ? analyzeNutrition({
        meals: input.nutrition.meals || [],
        weight: input.nutrition.weight ?? weight,
        age: input.nutrition.age ?? age,
        sex: input.nutrition.sex || sex,
        goal: input.nutrition.goal,
        activityLevel: input.nutrition.activityLevel,
      })
    : null;

  const trainingResult = input.training
    ? analyzeTraining({
        workoutsPerWeek: input.training.workoutsPerWeek || 0,
        avgMinutes: input.training.avgMinutes || 0,
        intensity: input.training.intensity || 'moderate',
        goal: input.training.goal || 'hypertrophy',
        experience: input.training.experience || 'intermediate',
        sleepHours: input.training.sleepHours || 7,
        stressLevel: input.training.stressLevel || 3,
        jointPain: input.training.jointPain || [],
        deloadWeeksAgo: input.training.deloadWeeksAgo || 0,
        weight: input.training.weight ?? weight,
        age: input.training.age ?? age,
        sex: input.training.sex || sex,
      })
    : null;

  // Phase 2: Derive cross-module modifiers (TZ: результаты одного модуля → коррекция другого)
  const nutritionQuality = nutritionResultRaw
    ? 100 - nutritionResultRaw.overallRaw
    : undefined;
  const trainingLoad = trainingResult
    ? trainingResult.overallRaw
    : undefined;

  // Phase 3: Run support WITH cross-modifiers
  const supportResult = input.support
    ? runScoreAnalysis({
        course: input.support.course || [],
        weight: input.support.weight ?? weight,
        age: input.support.age ?? age,
        sex: input.support.sex || sex,
        labs: input.support.labs,
        nutritionQuality,
        trainingLoad,
      })
    : null;

  // Aggregate overall risk (TZ: Risk_total = max across all modules)
  const allRisks = [
    supportResult?.overallRaw || 0,
    labsResult?.overallRaw || 0,
    nutritionResultRaw?.overallRaw || 0,
    trainingResult?.overallRaw || 0,
    pharmaResult?.overallRaw || 0,
  ];
  const overallRisk = Math.max(...allRisks);

  // Aggregate recommendations + cross-module correlations
  const recommendations: string[] = [];
  if (supportResult) for (const r of supportResult.recommendations) recommendations.push(`💊 ${r}`);
  if (labsResult) for (const r of labsResult.recommendations) recommendations.push(`🧪 ${r}`);
  if (pharmaResult) for (const r of pharmaResult.recommendations) recommendations.push(`💉 ${r}`);
  if (nutritionResultRaw) for (const r of nutritionResultRaw.recommendations) recommendations.push(`🥗 ${r}`);
  if (trainingResult) for (const r of trainingResult.recommendations) recommendations.push(`🏋️ ${r}`);

  // Cross-module correlations
  const hepaticSys = supportResult?.systems?.find(s => s.id === 'hepatic');
  const neuroSys = supportResult?.systems?.find(s => s.id === 'neuro');
  if (nutritionQuality !== undefined && nutritionQuality < 60 && hepaticSys && hepaticSys.weightedScore >= 40) {
    recommendations.push(`🔗 Кросс-коррекция: Низкое качество питания (${nutritionQuality}%) усиливает нагрузку на печень. Улучшите рацион.`);
  }
  if (trainingLoad !== undefined && trainingLoad > 50 && neuroSys && neuroSys.weightedScore >= 40) {
    recommendations.push(`🔗 Кросс-коррекция: Высокая нагрузка тренинга (${trainingLoad}%) усиливает нейро-риск. Увеличьте восстановление.`);
  }

  return {
    timestamp: new Date().toISOString(),
    profile: { weight, age, sex },
    modules: {
      support: supportResult,
      labs: labsResult,
      nutrition: nutritionResultRaw,
      training: trainingResult,
      pharma: pharmaResult,
    },
    overallRisk,
    recommendations,
  };
}

// ─── Report Generation ───

export function generateFullReport(result: OrchestratorResult): string {
  let text = `🧬 ПОЛНЫЙ АНАЛИЗ (Score Engine — TZ Pipeline)\n`;
  text += `${'═'.repeat(40)}\n`;
  text += `📅 ${new Date(result.timestamp).toLocaleString('ru-RU')}\n`;
  text += `👤 ${result.profile.weight}кг · ${result.profile.age}лет · ${result.profile.sex}\n`;
  text += `📊 Общий риск: ${result.overallRisk}%\n\n`;

  if (result.modules.support) {
    text += generateScoreReportText(result.modules.support as ScoreReport);
    text += '\n\n';
  }
  if (result.modules.labs) {
    text += generateLabsReport(result.modules.labs);
    text += '\n\n';
  }
  if (result.modules.nutrition) {
    text += generateNutritionReport(result.modules.nutrition);
    text += '\n\n';
  }
  if (result.modules.training) {
    text += generateTrainingReport(result.modules.training);
    text += '\n\n';
  }
  if (result.modules.pharma) {
    text += generatePharmaReport(result.modules.pharma);
    text += '\n\n';
  }

  text += `🧬 СВОДКА РЕКОМЕНДАЦИЙ (${result.recommendations.length})\n`;
  for (const r of result.recommendations) text += `  • ${r}\n`;

  text += `\n${'═'.repeat(40)}\n✅ Orchestrator v2 — полный pipeline по ТЗ`;
  return text;
}
