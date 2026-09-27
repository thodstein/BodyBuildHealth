/**
 * planner-generation-state.ts — Wave 4: состояние генерации плана.
 *
 * Раньше ~8 useState + 1 ref жили в IndividualPlanContext.
 * Этот кластер изолирован: generated, planBusy, dayPlan, threeDayPlan,
 * weekPlan, shoppingList, waterCalc, monthPlan, monthPlanMode, monthPlanRef,
 * selectedWeek, loadMonthWeekIntoPlan.
 *
 * API не меняется: хук возвращает те же имена, provider раскладывает их в PlanCtx.
 */
import { useState, useRef, useEffect } from "react";

export interface PlannerGenerationState {
  generated: boolean;
  setGenerated: (v: boolean) => void;
  planBusy: boolean;
  dayPlan: any;
  setDayPlan: (v: any) => void;
  threeDayPlan: any;
  setThreeDayPlan: (v: any) => void;
  weekPlan: any;
  setWeekPlan: (v: any) => void;
  shoppingList: any;
  setShoppingList: (v: any) => void;
  waterCalc: any;
  setWaterCalc: (v: any) => void;
  monthPlanMode: boolean;
  setMonthPlanMode: (v: boolean) => void;
  monthPlan: any[];
  setMonthPlan: (v: any[]) => void;
  selectedWeek: number;
  setSelectedWeek: (v: number) => void;
  loadMonthWeekIntoPlan: (wi: number) => boolean;
}

export function usePlannerGenerationState(): PlannerGenerationState {
  const [generated, setGenerated] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [dayPlan, setDayPlan] = useState<any>(null);
  const [threeDayPlan, setThreeDayPlan] = useState<any>(null);
  const [weekPlan, setWeekPlan] = useState<any>(null);
  const [shoppingList, setShoppingList] = useState<any>(null);
  const [waterCalc, setWaterCalc] = useState<any>(null);
  const [monthPlanMode, setMonthPlanMode] = useState(() => {
    try { return localStorage.getItem("he_plan_month_mode") === "true"; } catch { return false; }
  });
  const [monthPlan, setMonthPlan] = useState<any[]>(() => {
    try { const v = JSON.parse(localStorage.getItem("he_plan_month") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const [selectedWeek, setSelectedWeek] = useState(0);

  const monthPlanRef = useRef<any[]>(monthPlan);
  useEffect(() => { monthPlanRef.current = monthPlan; }, [monthPlan]);

  const loadMonthWeekIntoPlan = (wi: number) => {
    const w = monthPlanRef.current[wi];
    if (w?.days?.length) { setWeekPlan(w); return true; }
    return false;
  };

  return {
    generated, setGenerated,
    planBusy,
    dayPlan, setDayPlan,
    threeDayPlan, setThreeDayPlan,
    weekPlan, setWeekPlan,
    shoppingList, setShoppingList,
    waterCalc, setWaterCalc,
    monthPlanMode, setMonthPlanMode,
    monthPlan, setMonthPlan,
    selectedWeek, setSelectedWeek,
    loadMonthWeekIntoPlan,
  };
}
