/**
 * planner-report-state.ts — Хвост-1 (god-component рефактор): состояние отчётов планировщика.
 *
 * Раньше ~7 useState + 6 генераторов отчётов + 2 авто-эффекта жили прямо в
 * IndividualPlanContext (~3500 строк). Это первый безопасно-выделяемый кластер:
 * состояние отчётов изолировано, зависит от узкого набора входов, а его изменения
 * НЕ перерисовывают остальной контекст (состояние локально в этом хуке).
 *
 * API не меняется: хук возвращает те же имена (activeReports/allergenReport/... +
 * генераторы), которые provider раскладывает в единый PlanCtx. Потребители
 * (`usePlanCtx()` → `ctx as any`) не меняются.
 */
import { useState, useEffect } from "react";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { generateNutritionReport } from "../../../../engines/nutrition-report.engine";
import { generateAllergenReportPure, generateNutrientReportPure, generateQualityReportPure, generateRiskReportPure, generateDrugCompatReportPure } from "./planner-reports";
import { carbPeriodizationLabel } from "./planner-carb-periodization";
import { getProfileSafe } from "./ui";
import { safeWriteJSON } from "./planner-storage";
import type { DrugInjection } from "./types";

export interface PlannerReportStateDeps {
  dayPlan: any;
  allergens: string[];
  budget: string;
  weight: number;
  injections: DrugInjection[];
  v2Pharma: Record<string, boolean>;
  phase: string;
  takenSupplements: string[];
  planTargets: { kcal: number; protein: number; fats: number; carbs: number };
  planType: string;
  variety: string;
  healthIssues: string[];
  waterCalc: any;
  linkToTraining: boolean;
  trainStart: string;
  trainDaysArr: boolean[];
  carbPeriodization: import("./types").CarbPeriodization;
}

export interface PlannerReportState {
  activeReports: string[];
  setActiveReports: (v: any) => void;
  allergenReport: any;
  setAllergenReport: (v: any) => void;
  nutrientReport: any;
  setNutrientReport: (v: any) => void;
  qualityReport: any;
  setQualityReport: (v: any) => void;
  riskReport: any;
  setRiskReport: (v: any) => void;
  drugCompatReport: any;
  setDrugCompatReport: (v: any) => void;
  nutritionReport: any;
  setNutritionReport: (v: any) => void;
  generateAllergenReport: () => void;
  generateNutrientReport: () => void;
  generateQualityReport: () => void;
  generateRiskReport: () => void;
  generateDrugCompatReport: () => void;
  generateFullNutritionReport: (planArg?: any, archive?: boolean) => void;
}

export function usePlannerReportState(d: PlannerReportStateDeps): PlannerReportState {
  const [activeReports, setActiveReports] = useState<string[]>([]);
  const [allergenReport, setAllergenReport] = useState<any>(null);
  const [nutrientReport, setNutrientReport] = useState<any>(null);
  const [qualityReport, setQualityReport] = useState<any>(null);
  const [riskReport, setRiskReport] = useState<any>(null);
  const [drugCompatReport, setDrugCompatReport] = useState<any>(null);
  const [nutritionReport, setNutritionReport] = useState<any>(null);

  const { dayPlan, allergens, budget, weight, injections, v2Pharma, phase, takenSupplements, planTargets, planType, variety, healthIssues, waterCalc, linkToTraining, trainStart, trainDaysArr, carbPeriodization } = d;

  const generateAllergenReport = () => { if (!dayPlan) return; setAllergenReport(generateAllergenReportPure(dayPlan, allergens, FOOD_DB)); setActiveReports(prev => prev.includes('allergen') ? prev : [...prev, 'allergen']); };
  const generateNutrientReport = () => { if (!dayPlan) return; setNutrientReport(generateNutrientReportPure(dayPlan, FOOD_DB)); setActiveReports(prev => prev.includes('nutrient') ? prev : [...prev, 'nutrient']); };
  const generateQualityReport = () => { if (!dayPlan) return; const _r = generateQualityReportPure(dayPlan, budget, FOOD_DB); setQualityReport({ ..._r, dayScore: (dayPlan as any).healthScore?.score ?? null, dayStatus: (dayPlan as any).healthScore?.status ?? null }); setActiveReports(prev => prev.includes('quality') ? prev : [...prev, 'quality']); };
  const generateRiskReport = () => { if (!dayPlan) return; setRiskReport(generateRiskReportPure(dayPlan, weight)); setActiveReports(prev => prev.includes('risk') ? prev : [...prev, 'risk']); };
  const generateDrugCompatReport = () => {
    const safeInjections = Array.isArray(injections) ? injections : [];
    if (!dayPlan || safeInjections.length === 0) return;
    setDrugCompatReport(generateDrugCompatReportPure({ dayPlan, injections: safeInjections, weight, v2Pharma: v2Pharma && typeof v2Pharma === 'object' ? v2Pharma : {}, phase, takenSupplements: Array.isArray(takenSupplements) ? takenSupplements : [] }));
    setActiveReports(prev => prev.includes('drug') ? prev : [...prev, 'drug']);
  };
  const generateFullNutritionReport = (planArg?: any, archive = true) => {
    const src = planArg || dayPlan; if (!src) return;
    try {
      const rep = generateNutritionReport({
        meals: src.meals.map((m: any) => ({ label: m.label, items: m.items.map((i: any) => ({ name: i.name || '', id: i.id || '', amount: i.amount || 100, kcal: i.kcal || 0, p: i.p || 0, f: i.f || 0, c: i.c || 0, fiber: i.fiber || 0 })), totals: m.totals || { kcal: 0, p: 0, f: 0, c: 0 }, time: m.time || '' })),
        totals: src.totals || { kcal: 0, p: 0, f: 0, c: 0 },
        targets: planTargets,
        userWeight: getProfileSafe()?.settings?.weight || 80,
        userTDEE: planTargets.kcal,
        healthIssues, planType, variety, budget, allergens,
        cyclingMode: carbPeriodizationLabel(carbPeriodization),
        goal: getProfileSafe()?.settings?.primaryGoal || 'maintenance',
        waterMl: waterCalc?.total ? Math.round(waterCalc.total * 1000) : 0,
        injections: injections.map((i: any) => ({ type: i.type, dose: i.dose, name: i.name, time: i.time })),
        workoutTime: linkToTraining && trainDaysArr.some(Boolean) ? trainStart : undefined,
      });
      if (rep) {
        setNutritionReport(rep);
        setActiveReports(prev => prev.includes('nutrition') ? prev : [...prev, 'nutrition']);
        if (archive) {
          try {
            const arch = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
            arch.unshift(rep);
            safeWriteJSON('he_nutrition_report_archive', arch.slice(0, 50));
            safeWriteJSON('he_nutrition_report_current', rep);
            try { safeWriteJSON('he_profile_nutrition_reports', arch.slice(0, 20)); } catch {}
          } catch {}
        }
      }
    } catch (e) { try { console.error('Report failed:', e); } catch {} }
  };

  // D-26: auto-run drug-compat check when the plan changes (live food-drug warnings).
  useEffect(() => { try { generateDrugCompatReport(); } catch (e: any) { try { console.warn('[Planner] drug-compat report failed:', e); } catch {} } }, [dayPlan, injections, v2Pharma, phase, takenSupplements]);
  // D-25: auto-generate the report (without archiving) whenever the day plan changes,
  // so the dietology scorecard in the day card is live without opening the Отчёт tab.
  useEffect(() => { if (dayPlan) generateFullNutritionReport(dayPlan, false); }, [dayPlan]);

  return {
    activeReports, setActiveReports, allergenReport, setAllergenReport, nutrientReport, setNutrientReport,
    qualityReport, setQualityReport, riskReport, setRiskReport,
    drugCompatReport, setDrugCompatReport, nutritionReport, setNutritionReport,
    generateAllergenReport, generateNutrientReport, generateQualityReport, generateRiskReport,
    generateDrugCompatReport, generateFullNutritionReport,
  };
}
