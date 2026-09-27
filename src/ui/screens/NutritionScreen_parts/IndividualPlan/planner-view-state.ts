/**
 * planner-view-state.ts — Wave 4: состояние отображения плана и UI.
 *
 * Раньше ~20 useState жили в IndividualPlanContext. Этот кластер изолирован:
 * planTab, planDays, selectedDayIndex, planView, dayPlanNotes, draggedItem,
 * dropTarget, quickAdd*, userRecipes, showRecipeCreator, newRecipe,
 * showAddDrug, showDrugTypePicker, takenSupplements, showSuppPicker, suppSearch,
 * editItem, editAmount, replacingItem, recipePickerMeal, savedPlans,
 * expandedSavedId, lockedFoodIds, weekEditDay.
 *
 * API не меняется: хук возвращает те же имена, provider раскладывает их в PlanCtx.
 */
import { useState, useCallback } from "react";

export interface PlannerViewState {
  planTab: string;
  setPlanTab: (v: string) => void;
  planDays: 1 | 3 | 7;
  setPlanDays: (v: 1 | 3 | 7) => void;
  selectedDayIndex: number;
  setSelectedDayIndex: (v: number) => void;
  planView: 'list' | 'calendar';
  setPlanView: (v: 'list' | 'calendar') => void;
  dayPlanNotes: string;
  setDayPlanNotes: (v: string) => void;
  draggedItem: any;
  setDraggedItem: (v: any) => void;
  dropTarget: number | null;
  setDropTarget: (v: any) => void;
  quickAddMealIdx: number | null;
  setQuickAddMealIdx: (v: number | null) => void;
  quickAddSearch: string;
  setQuickAddSearch: (v: string) => void;
  userRecipes: any[];
  setUserRecipes: (v: any[]) => void;
  showRecipeCreator: boolean;
  setShowRecipeCreator: (v: boolean) => void;
  newRecipe: any;
  setNewRecipe: (v: any) => void;
  showAddDrug: boolean;
  setShowAddDrug: (v: boolean) => void;
  showDrugTypePicker: boolean;
  setShowDrugTypePicker: (v: boolean) => void;
  takenSupplements: string[];
  setTakenSupplements: (v: any) => void;
  showSuppPicker: boolean;
  setShowSuppPicker: (v: boolean) => void;
  suppSearch: string;
  setSuppSearch: (v: string) => void;
  editItem: any;
  setEditItem: (v: any) => void;
  editAmount: number;
  setEditAmount: (v: number) => void;
  replacingItem: any;
  setReplacingItem: (v: any) => void;
  recipePickerMeal: any;
  setRecipePickerMeal: (v: any) => void;
  savedPlans: any[];
  setSavedPlans: (v: any[]) => void;
  expandedSavedId: number | null;
  setExpandedSavedId: (v: any) => void;
  lockedFoodIds: Set<string>;
  toggleLockFood: (id: string) => void;
  weekEditDay: number | null;
}

export interface PlannerViewStateInit {
  planTab: string;
  planDays: 1 | 3 | 7;
  selectedDayIndex: number;
  planView: 'list' | 'calendar';
  dayPlanNotes: string;
  userRecipes: any[];
  newRecipe: any;
  savedPlans: any[];
  expandedSavedId: number | null;
  lockedFoodIds: Set<string>;
  weekEditDay: number | null;
}

export function usePlannerViewState(init?: PlannerViewStateInit): PlannerViewState {
  const [planTab, setPlanTab] = useState<string>(init?.planTab || 'plan');
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(init?.planDays ?? 7);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(init?.selectedDayIndex ?? 0);
  const [planView, setPlanView] = useState<'list' | 'calendar'>(init?.planView || 'list');
  const [dayPlanNotes, setDayPlanNotes] = useState<string>(init?.dayPlanNotes ?? '');
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [quickAddMealIdx, setQuickAddMealIdx] = useState<number | null>(null);
  const [quickAddSearch, setQuickAddSearch] = useState<string>('');
  const [userRecipes, setUserRecipes] = useState<any[]>(init?.userRecipes ?? []);
  const [showRecipeCreator, setShowRecipeCreator] = useState<boolean>(false);
  const [newRecipe, setNewRecipe] = useState<any>(init?.newRecipe ?? null);
  const [showAddDrug, setShowAddDrug] = useState<boolean>(false);
  const [showDrugTypePicker, setShowDrugTypePicker] = useState<boolean>(false);
  const [takenSupplements, setTakenSupplements] = useState<string[]>([]);
  const [showSuppPicker, setShowSuppPicker] = useState<boolean>(false);
  const [suppSearch, setSuppSearch] = useState<string>('');
  const [editItem, setEditItem] = useState<any>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [replacingItem, setReplacingItem] = useState<any>(null);
  const [recipePickerMeal, setRecipePickerMeal] = useState<any>(null);
  const [savedPlans, setSavedPlans] = useState<any[]>(init?.savedPlans ?? []);
  const [expandedSavedId, setExpandedSavedId] = useState<number | null>(init?.expandedSavedId ?? null);
  const [lockedFoodIds, setLockedFoodIds] = useState<Set<string>>(init?.lockedFoodIds ?? new Set());
  const [weekEditDay, setWeekEditDay] = useState<number | null>(init?.weekEditDay ?? null);

  const toggleLockFood = useCallback((id: string) => {
    setLockedFoodIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return {
    planTab, setPlanTab,
    planDays, setPlanDays,
    selectedDayIndex, setSelectedDayIndex,
    planView, setPlanView,
    dayPlanNotes, setDayPlanNotes,
    draggedItem, setDraggedItem,
    dropTarget, setDropTarget,
    quickAddMealIdx, setQuickAddMealIdx,
    quickAddSearch, setQuickAddSearch,
    userRecipes, setUserRecipes,
    showRecipeCreator, setShowRecipeCreator,
    newRecipe, setNewRecipe,
    showAddDrug, setShowAddDrug,
    showDrugTypePicker, setShowDrugTypePicker,
    takenSupplements, setTakenSupplements,
    showSuppPicker, setShowSuppPicker,
    suppSearch, setSuppSearch,
    editItem, setEditItem,
    editAmount, setEditAmount,
    replacingItem, setReplacingItem,
    recipePickerMeal, setRecipePickerMeal,
    savedPlans, setSavedPlans,
    expandedSavedId, setExpandedSavedId,
    lockedFoodIds, toggleLockFood,
    weekEditDay,
  };
}
