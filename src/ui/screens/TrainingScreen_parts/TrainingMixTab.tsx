import React, { useState, useMemo } from 'react';
import { useDataLink } from '../../../core/data-link';
import { SupportMixCalc } from '../SupportScreen_parts/SupportMixCalc';
import type { MixTemplate, MixRecipeItem } from '../../../engines/training-mix-scoring.engine';

export const TrainingMixTab: React.FC = () => {
  const linked = useDataLink();

  const profileSettings = linked.profile?.settings;

  const [mixGoals, setMixGoals] = useState<string[]>(['pump']);
  const [mixTiming, setMixTiming] = useState<string>('pre');
  const [mixInsulin, setMixInsulin] = useState<number>(0);
  const [mixInsulinTiming, setMixInsulinTiming] = useState<'pre'|'post'>('post');
  const [mixDrugIGF, setMixDrugIGF] = useState<number>(0);
  const [mixDrugIGFTiming, setMixDrugIGFTiming] = useState<'pre'|'post'>('pre');
  const [mixDrugGH, setMixDrugGH] = useState<number>(0);
  const [mixDrugGHTiming, setMixDrugGHTiming] = useState<'pre'|'post'>('pre');
  const [mixDrugMGF, setMixDrugMGF] = useState<number>(0);
  const [mixDrugMGFTiming, setMixDrugMGFTiming] = useState<'pre'|'post'>('pre');
  const [mixDrugGLP1, setMixDrugGLP1] = useState(false);

  const [customRecipeOverrides, setCustomRecipeOverrides] = useState<{removed:string[]; replaced:Record<string,{id:string;dose:string;unit:string;note:string}>}>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_recipe_overrides') || 'null') || { removed:[], replaced:{} }; } catch { return { removed:[], replaced:{} }; }
  });
  const [mixSavedRecipes, setMixSavedRecipes] = useState<{id:string;name:string;goal:string;items:MixRecipeItem[]}[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_saved_recipes') || '[]') || []; } catch { return []; }
  });
  const [appliedTemplate, setAppliedTemplate] = useState<MixTemplate | null>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_applied_template') || 'null'); } catch { return null; }
  });
  const [mixWorkoutType, setMixWorkoutType] = useState<'heavy'|'moderate'|'light'>(() => {
    const wpw = profileSettings?.workoutsPerWeek ?? 3;
    const am = profileSettings?.avgWorkoutMinutes ?? 60;
    if (wpw >= 5 && am >= 90) return 'heavy';
    if (wpw >= 3) return 'moderate';
    return 'light';
  });
  const [mixTimeOfDay, setMixTimeOfDay] = useState<'morning'|'afternoon'|'evening'>('morning');
  const [mixExperience, setMixExperience] = useState<'novice'|'intermediate'|'advanced'>('intermediate');
  const [mixDayType, setMixDayType] = useState<'push'|'pull'|'legs'|'upper'|'lower'|'fullbody'>('fullbody');
  const [mixHistory, setMixHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_mixes') || '[]'); } catch { return []; }
  });

  const [planSaved, setPlanSaved] = useState<string>('');
  const [enhancedSubs, setEnhancedSubs] = useState<string[]>([]);
  const [mixSavedPlans, setMixSavedPlans] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_saved_plans') || '[]'); } catch { return []; }
  });
  const [supportLevel] = useState<'basic'|'mid'|'max'|'boost'>('mid');

  const [customMixSubstance, setCustomMixSubstance] = useState('');
  const [customMixDoseMg, setCustomMixDoseMg] = useState(0);
  const [customMixItems, setCustomMixItems] = useState<{timing:'pre'|'intra'|'post';id:string;name:string;dose:string;unit:string;mg:number}[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_custom_items') || '[]'); } catch { return []; }
  });

  const calcSupport = () => {};

  const s = useMemo(() => ({
    mixGoals, setMixGoals,
    mixTiming, setMixTiming,
    mixInsulin, setMixInsulin,
    mixInsulinTiming, setMixInsulinTiming,
    mixDrugIGF, setMixDrugIGF,
    mixDrugIGFTiming, setMixDrugIGFTiming,
    mixDrugGH, setMixDrugGH,
    mixDrugGHTiming, setMixDrugGHTiming,
    mixDrugMGF, setMixDrugMGF,
    mixDrugMGFTiming, setMixDrugMGFTiming,
    mixDrugGLP1, setMixDrugGLP1,
    mixWorkoutType, setMixWorkoutType,
    mixTimeOfDay, setMixTimeOfDay,
    customRecipeOverrides, setCustomRecipeOverrides,
    mixSavedRecipes, setMixSavedRecipes,
    appliedTemplate, setAppliedTemplate,
    customMixItems, setCustomMixItems,
    mixHistory, setMixHistory,
    mixExperience, setMixExperience,
    mixDayType, setMixDayType,
    planSaved, setPlanSaved,
    enhancedSubs, setEnhancedSubs,
    calcSupport,
    supportLevel,
    mixSavedPlans, setMixSavedPlans,
    customMixSubstance, setCustomMixSubstance,
    customMixDoseMg, setCustomMixDoseMg,
    linked,
  }), [
    mixGoals, mixTiming, mixInsulin, mixInsulinTiming,
    mixDrugIGF, mixDrugIGFTiming, mixDrugGH, mixDrugGHTiming,
    mixDrugMGF, mixDrugMGFTiming, mixDrugGLP1,
    mixWorkoutType, mixTimeOfDay,
    customRecipeOverrides, mixSavedRecipes, appliedTemplate,
    customMixItems, mixHistory,
    mixExperience, mixDayType,
    planSaved, enhancedSubs, supportLevel,
    mixSavedPlans, customMixSubstance, customMixDoseMg, linked,
  ]);

  return <SupportMixCalc s={s} />;
};
