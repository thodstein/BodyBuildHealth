/**
 * planner-mode-state.ts — Wave 4: состояние режимов планировщика.
 *
 * Раньше ~6 useState + 2 ref + 2 эффекта жили в IndividualPlanContext.
 * Этот кластер изолирован: plannerMode, generationMode, weightMode,
 * favoriteRecipes — всё с минимальными side-effects (только localStorage).
 *
 * API не меняется: хук возвращает те же имена, provider раскладывает их в PlanCtx.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { readWeightMode, writeWeightMode } from "./planner-weight-mode";

export interface PlannerModeState {
  plannerMode: string;
  setPlannerMode: (v: any) => void;
  generationMode: 'products' | 'recipes';
  setGenerationMode: (v: 'products' | 'recipes') => void;
  weightMode: 'cooked' | 'raw';
  setWeightMode: (v: 'cooked' | 'raw') => void;
  favoriteRecipes: Set<string>;
  toggleFavoriteRecipe: (name: string) => void;
  isFavoriteRecipe: (name: string) => boolean;
}

export interface PlannerModeStateInit {
  plannerMode: string;
  generationMode: 'products' | 'recipes';
  weightMode: 'cooked' | 'raw';
  favoriteRecipes: Set<string>;
}

export function usePlannerModeState(init?: PlannerModeStateInit): PlannerModeState {
  const [plannerMode, setPlannerMode] = useState<string>(init?.plannerMode || 'simple');
  const [generationMode, setGenerationMode] = useState<'products' | 'recipes'>(init?.generationMode || 'products');

  const generationModeRef = useRef<'products' | 'recipes'>(generationMode);
  useEffect(() => { generationModeRef.current = generationMode; }, [generationMode]);

  useEffect(() => { try { localStorage.setItem('he_planner_gen_mode', generationMode); } catch {} }, [generationMode]);

  const [weightMode, setWeightMode] = useState<'cooked' | 'raw'>(init?.weightMode || 'cooked');
  useEffect(() => { writeWeightMode(weightMode); }, [weightMode]);

  const [favoriteRecipes, setFavoriteRecipes] = useState<Set<string>>(init?.favoriteRecipes ?? new Set());

  const toggleFavoriteRecipe = useCallback((name: string) => {
    setFavoriteRecipes(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try { localStorage.setItem('he_recipe_fav', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const isFavoriteRecipe = useCallback((name: string) => favoriteRecipes.has(name), [favoriteRecipes]);

  return {
    plannerMode, setPlannerMode,
    generationMode, setGenerationMode,
    weightMode, setWeightMode,
    favoriteRecipes, toggleFavoriteRecipe, isFavoriteRecipe,
  };
}
