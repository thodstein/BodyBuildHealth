/**
 * planner-food-preferences-state.ts — Wave 4: состояние пищевых предпочтений.
 *
 * Раньше ~10 useState + 2 callback жили в IndividualPlanContext.
 * Этот кластер изолирован: allergens, healthIssues, preferredFoods,
 * excludedFoods, intolerances, tasteProfile, excludedCategories,
 * allergenExcludedCount + toggleAllergen, toggleHealthIssue.
 *
 * API не меняется: хук возвращает те же имена, provider раскладывает их в PlanCtx.
 */
import { useState, useCallback } from "react";

export interface PlannerFoodPreferencesState {
  allergens: string[];
  setAllergens: (v: any) => void;
  healthIssues: string[];
  setHealthIssues: (v: any) => void;
  preferredFoods: string[];
  setPreferredFoods: (v: any) => void;
  excludedFoods: string[];
  setExcludedFoods: (v: any) => void;
  preferredByMeal: Record<string, string[]>;
  setPreferredByMeal: (v: any) => void;
  intolerances: any;
  setIntolerances: (v: any) => void;
  tasteProfile: any;
  setTasteProfile: (v: any) => void;
  excludedCategories: string[];
  setExcludedCategories: (v: any) => void;
  allergenExcludedCount: number;
  setAllergenExcludedCount: (v: number) => void;
  toggleAllergen: (id: string) => void;
  toggleHealthIssue: (id: string) => void;
}

export function usePlannerFoodPreferencesState(): PlannerFoodPreferencesState {
  const [allergens, setAllergens] = useState<string[]>([]);
  const [healthIssues, setHealthIssues] = useState<string[]>([]);
  const [preferredFoods, setPreferredFoods] = useState<string[]>([]);
  const [excludedFoods, setExcludedFoods] = useState<string[]>([]);
  const [preferredByMeal, setPreferredByMeal] = useState<Record<string, string[]>>({});
  const [intolerances, setIntolerances] = useState<any>({});
  const [tasteProfile, setTasteProfile] = useState<any>({});
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [allergenExcludedCount, setAllergenExcludedCount] = useState<number>(0);

  const toggleAllergen = useCallback((id: string) => {
    setAllergens(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }, []);

  const toggleHealthIssue = useCallback((id: string) => {
    setHealthIssues(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]);
  }, []);

  return {
    allergens, setAllergens,
    healthIssues, setHealthIssues,
    preferredFoods, setPreferredFoods,
    excludedFoods, setExcludedFoods,
    preferredByMeal, setPreferredByMeal,
    intolerances, setIntolerances,
    tasteProfile, setTasteProfile,
    excludedCategories, setExcludedCategories,
    allergenExcludedCount, setAllergenExcludedCount,
    toggleAllergen, toggleHealthIssue,
  };
}
