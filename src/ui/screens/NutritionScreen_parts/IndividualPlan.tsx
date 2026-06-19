import React, { useState, useMemo, useEffect } from 'react';
import { FOOD_DB } from '../../../core/nutrition-database';
import { calcNutrition } from '../../../engines/nutrition.engine';
import { getProfile, updateProfile } from '../../../core/profile-manager';
import type { UserProfile } from '../../../core/types';

// ─── Types ───
type GoalId = 'mass' | 'strength' | 'fat_loss' | 'cutting' | 'post_cut' | 'maintenance' | 'recomposition' | 'rehab';
type PhaseId = 'course' | 'bridge' | 'pct' | 'cruise' | 'blast' | 'off';
type BudgetLevel = 'low' | 'medium' | 'max' | 'enhanced';
type NutritionLevel = 'base' | 'medium' | 'enhanced' | 'max';
type PlanType = 'classic' | 'keto' | 'highcarb' | 'mediterranean' | 'vegetarian';
type CycleType = 'none' | 'macro' | 'butch' | 'cheatmeal' | 'carbload';

interface DrugInjection { id: string; name: string; time: string; dose: number; unit: string; type: string; }
interface MealPrepStep { step: number; action: string; duration: number; items: string[]; }
interface SavedPlan { id: number; date: string; dayPlan: any; threeDayPlan: any; weekPlan: any; shoppingList: any; waterCalc: any; }

const GOALS: { id: GoalId; label: string; icon: string; desc: string }[] = [
  { id: 'mass', label: 'Массонабор', icon: '💪', desc: 'Профицит калорий, рост мышц' },
  { id: 'strength', label: 'Сила', icon: '🏋️', desc: 'Силовые показатели, CNS recovery' },
  { id: 'fat_loss', label: 'Похудение', icon: '🔥', desc: 'Дефицит калорий, жиросжигание' },
  { id: 'cutting', label: 'Сушка', icon: '✂️', desc: 'Агрессивный дефицит, рельеф' },
  { id: 'post_cut', label: 'Выход из сушки', icon: '📈', desc: 'Плавный выход, обратная метаболическая' },
  { id: 'maintenance', label: 'Поддержка', icon: '⚖️', desc: 'Баланс, сохранение формы' },
  { id: 'recomposition', label: 'Рекомпозиция', icon: '🔄', desc: 'Одновременный рост + жиросжигание' },
  { id: 'rehab', label: 'Реабилитация', icon: '🩹', desc: 'Восстановление после травм/болезни' },
];

const PHASES: { id: PhaseId; label: string; icon: string }[] = [
  { id: 'course', label: 'Курс', icon: '💉' },
  { id: 'bridge', label: 'Мост', icon: '🌉' },
  { id: 'pct', label: 'PCT', icon: '🔄' },
  { id: 'cruise', label: 'Круиз', icon: '⛵' },
  { id: 'blast', label: 'Бласт', icon: '💥' },
  { id: 'off', label: 'Офф', icon: '⏸️' },
];

const BUDGET_LEVELS: { id: BudgetLevel; label: string; icon: string; desc: string; color: string }[] = [
  { id: 'low', label: 'Низкий', icon: '🟢', desc: 'Бюджетные продукты, базовый набор', color: '#22c55e' },
  { id: 'medium', label: 'Средний', icon: '🟡', desc: 'Качество + цена, фермерские аналоги', color: '#f59e0b' },
  { id: 'max', label: 'Максимум', icon: '🟠', desc: 'Премиум продукты, органика', color: '#f97316' },
  { id: 'enhanced', label: 'Усиленный', icon: '🔴', desc: 'Элитные продукты, спецсорта', color: '#ef4444' },
];

const NUTRITION_LEVELS: { id: NutritionLevel; label: string; icon: string; mult: number }[] = [
  { id: 'base', label: 'База', icon: '🟢', mult: 1.0 },
  { id: 'medium', label: 'Средний', icon: '🟡', mult: 1.15 },
  { id: 'enhanced', label: 'Усиление', icon: '🟠', mult: 1.3 },
  { id: 'max', label: 'Максимум', icon: '🔴', mult: 1.5 },
];

const PLAN_TYPES: { id: PlanType; label: string; icon: string; desc: string; pMult?: number; fMult?: number; cMult?: number }[] = [
  { id: 'classic', label: 'Классический', icon: '🥩', desc: 'Сбалансированное питание' },
  { id: 'keto', label: 'Кето', icon: '🥑', desc: 'Низкоуглеводный, высокожировой', cMult: 0.1, fMult: 2.5 },
  { id: 'highcarb', label: 'Высоко-углеводный', icon: '🍚', desc: '60% углеводов', cMult: 1.35, pMult: 0.85 },
  { id: 'mediterranean', label: 'Средиземноморский', icon: '⚖️', desc: 'Рыба, оливки, овощи', fMult: 1.3, cMult: 0.85 },
  { id: 'vegetarian', label: 'Вегетарианский', icon: '🌱', desc: 'Растительный белок', pMult: 0.8, fMult: 1.2 },
];

const ALLERGEN_LIST = ['лактоза', 'глютен', 'орехи', 'яйца', 'соя', 'рыба', 'ракообразные'];

// ─── Helpers ───
const getProfileSafe = () => { try { return getProfile(); } catch { return null; } };

const getDefaultKcal = (profile: UserProfile | null) => {
  if (!profile) return 2200;
  const s = profile.settings;
  return s.weight ? Math.round(s.weight * 30) : 2200;
};

// ─── Apple-style glass card wrapper ───
const GlassCard: React.FC<{ title?: string; icon?: string; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ title, icon, color, style, children }) => (
  <div style={{
    padding: 12, borderRadius: 14,
    background: 'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.06)',
    ...style,
  }}>
    {title && <div style={{ fontSize: 10, color: color || 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon && <span>{icon}</span>}{title}
    </div>}
    {children}
  </div>
);

const PillBtn: React.FC<{ active?: boolean; onClick: () => void; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ active, onClick, color, children, style }) => (
  <button onClick={onClick} style={{
    padding: '5px 10px', borderRadius: 16, fontSize: 9, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
    background: active ? (color || 'rgba(0,230,138,0.15)') : 'rgba(255,255,255,0.03)',
    border: active ? `1px solid ${color || '#00e68a'}` : '1px solid rgba(255,255,255,0.06)',
    color: active ? (color || '#00e68a') : 'rgba(255,255,255,0.5)',
    transition: 'all 0.15s',
    ...style,
  }}>{children}</button>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', fontSize: 11, boxSizing: 'border-box' as const,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none' as const,
};

const greenBtn: React.CSSProperties = {
  width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000',
  fontWeight: 700, fontSize: 11,
};

// ─── Main Component ───
export const IndividualPlan: React.FC<{ profile: UserProfile | null }> = ({ profile: _profile }) => {
  const profile = _profile || getProfileSafe();
  const s = profile?.settings;

  // 1. User info state (synced from profile)
  const [weight, setWeight] = useState(s?.weight || 80);
  const [height, setHeight] = useState(s?.height || 180);
  const [age, setAge] = useState(s?.age || 30);
  const [sex, setSex] = useState<'male' | 'female'>(s?.sex || 'male');
  const [dailySteps, setDailySteps] = useState(s?.dailySteps || 8000);
  const [cookTimeMin, setCookTimeMin] = useState(60);

  // 2. Goal (synced with profile)
  const [goal, setGoal] = useState<GoalId>((s?.primaryGoal as GoalId) || 'maintenance');

  // 3. Phase + course drugs
  const [phase, setPhase] = useState<PhaseId>('course');
  const [injections, setInjections] = useState<DrugInjection[]>([]);
  const [injName, setInjName] = useState('');
  const [injTime, setInjTime] = useState('08:00');
  const [injDose, setInjDose] = useState(10);
  const [injUnit, setInjUnit] = useState('mg');
  const [injType, setInjType] = useState('инсулин');
  const injectDrugTypes = ['инсулин', 'ГР', 'ИФР-1', 'MGF', 'IGF-1 DES', 'IGF-1 LR3', 'HMG', 'HCG', 'GHRP', 'CJC', 'BPC-157', 'TB-500', 'меланотан', 'семаглутид', 'тирзепатид', 'другое'];

  // 4. Training link
  const [trainStart, setTrainStart] = useState('16:00');
  const [trainEnd, setTrainEnd] = useState('17:30');
  const [linkToTraining, setLinkToTraining] = useState(false);

  // 5. Editable KBJU
  const calcTargets = useMemo(() => {
    const pal = 1.2 + ((s?.workoutsPerWeek || 3) * 0.075) + ((s?.avgWorkoutMinutes || 60) > 60 ? 0.1 : 0);
    return calcNutrition({ weightKg: weight, heightCm: height, age, sex, pal: Math.min(1.9, Math.max(1.2, pal)), goal });
  }, [weight, height, age, sex, goal, s?.workoutsPerWeek, s?.avgWorkoutMinutes]);

  const [manualKcal, setManualKcal] = useState<number | null>(null);
  const [manualP, setManualP] = useState<number | null>(null);
  const [manualF, setManualF] = useState<number | null>(null);
  const [manualC, setManualC] = useState<number | null>(null);

  const effectiveKcal = manualKcal ?? calcTargets.kcal;
  const effectiveP = manualP ?? calcTargets.protein;
  const effectiveF = manualF ?? calcTargets.fats;
  const effectiveC = (() => {
    if (manualC !== null) return manualC;
    // If kcal is manual but carbs not set, calc from remaining
    if (manualKcal !== null && manualP !== null && manualF !== null && manualC === null) {
      const fromPF = (manualP * 4) + (manualF * 9);
      return Math.max(0, Math.round((manualKcal - fromPF) / 4));
    }
    return calcTargets.carbs;
  })();

  // Auto-calc kcal from P+F+C when all 3 are set
  useEffect(() => {
    if (manualP !== null && manualF !== null && manualC !== null && manualKcal === null) {
      setManualKcal(manualP * 4 + manualF * 9 + manualC * 4);
    }
  }, [manualP, manualF, manualC]);

  const [editMode, setEditMode] = useState(false);

  // 6. Budget level
  const [budget, setBudget] = useState<BudgetLevel>('medium');

  // 7. Nutrition level
  const [nutrLevel, setNutrLevel] = useState<NutritionLevel>('base');

  // 8. Schedule
  const [wakeTime, setWakeTime] = useState('07:00');
  const [bedTime, setBedTime] = useState('23:00');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('19:00');
  const [workFood, setWorkFood] = useState<'any' | 'portable'>('any');
  const [mealsCount, setMealsCount] = useState(4);

  // 9. Allergens
  const [allergens, setAllergens] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_food_allergens') || '[]'); } catch { return []; } });

  // 10. Plan type
  const [planType, setPlanType] = useState<PlanType>('classic');

  // 11. Preferences + user foods
  const [preferredFoods, setPreferredFoods] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_preferred_foods') || '["chicken_breast","rice_white","broccoli","egg_whole","avocado"]'); } catch { return ['chicken_breast','rice_white','broccoli','egg_whole','avocado']; } });
  const [userFoods, setUserFoods] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_custom_foods') || '[]'); } catch { return []; } });

  // 12. Excluded foods
  const [excludedFoods, setExcludedFoods] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_excluded_foods') || '[]'); } catch { return []; } });

  // 13-14: Cycling toggles
  const [cyclingMode, setCyclingMode] = useState<CycleType>('none');
  const [heavyTrainDay, setHeavyTrainDay] = useState('');

  // 15. Plan generation
  const [generated, setGenerated] = useState(false);
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(1);
  const [dayPlan, setDayPlan] = useState<any>(null);
  const [threeDayPlan, setThreeDayPlan] = useState<any>(null);
  const [weekPlan, setWeekPlan] = useState<any>(null);
  const [shoppingList, setShoppingList] = useState<any>(null);
  const [waterCalc, setWaterCalc] = useState<any>(null);

  // Save plans
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => { try { return JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]'); } catch { return []; } });

  // Sync goal to profile
  useEffect(() => {
    if (profile) {
      try { updateProfile({ settings: { ...profile.settings, primaryGoal: goal as any } } as any); } catch {}
    }
  }, [goal]);

  const toggleAllergen = (a: string) => {
    setAllergens(prev => {
      const updated = prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a];
      localStorage.setItem('he_food_allergens', JSON.stringify(updated));
      return updated;
    });
  };

  // ─── Generate Plan ───
  const generatePlan = (days: 1 | 3 | 7) => {
    setPlanDays(days);
    const nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
    const budgetFilter = (id: BudgetLevel): number[] => {
      const map: Record<string, number[]> = { low: [0,5], medium: [5,8], max: [8,10], enhanced: [10,15] };
      return map[id] || [5,10];
    };
    const [bMin, bMax] = budgetFilter(budget);

    const tierScores: Record<string, number> = { basic: 5, mid: 7, max: 9, boost: 11 };
    const foods = FOOD_DB.filter(f => {
      if (f.kcal <= 0) return false;
      const score = tierScores[f.tier || 'basic'] || 5;
      return score >= bMin && score <= bMax;
    });

    const planTypeMod = PLAN_TYPES.find(p => p.id === planType);
    const pMod = planTypeMod?.pMult || 1.0;
    const fMod = planTypeMod?.fMult || 1.0;
    const cMod = planTypeMod?.cMult || 1.0;

    const tKcal = Math.round(effectiveKcal * nutrMult);
    const tP = Math.round(effectiveP * pMod * nutrMult);
    const tF = Math.round(effectiveF * fMod * nutrMult);
    const tC = Math.round(effectiveC * cMod * nutrMult);

    // Get excluded food IDs
    const excludedIds = new Set(excludedFoods);
    const allergenIds = new Set(
      allergens.flatMap(a => {
        if (a === 'лактоза') return ['cottage_cheese_5','kefir','yogurt_greek','milk','cheese_hard','kefir_2','yogurt_natural','ryazhenka','sour_cream_15','greek_yogurt'];
        if (a === 'глютен') return ['pasta_durum','bread_rye','tortilla_wheat','oats','bulgur','couscous'];
        if (a === 'орехи') return FOOD_DB.filter(f => f.allergens?.includes('nuts')).map(f => f.id);
        if (a === 'яйца') return ['egg_whole','egg_white'];
        if (a === 'соя') return FOOD_DB.filter(f => f.name.toLowerCase().includes('соя') || f.name.toLowerCase().includes('тофу')).map(f => f.id);
        if (a === 'рыба') return FOOD_DB.filter(f => f.category === 'protein' && (f.name.toLowerCase().includes('рыб') || f.name.toLowerCase().includes('лосос') || f.name.toLowerCase().includes('тунец') || f.name.toLowerCase().includes('треск') || f.name.toLowerCase().includes('палтус') || f.name.toLowerCase().includes('скумбр') || f.name.toLowerCase().includes('форель') || f.name.toLowerCase().includes('креветк') || f.name.toLowerCase().includes('мидии') || f.name.toLowerCase().includes('кальмар'))).map(f => f.id);
        if (a === 'ракообразные') return FOOD_DB.filter(f => f.name.toLowerCase().includes('креветк') || f.name.toLowerCase().includes('краб') || f.name.toLowerCase().includes('лобстер') || f.name.toLowerCase().includes('омар')).map(f => f.id);
        return [];
      })
    );

    // Build meal plan for 1 day then expand
    const buildDay = (dayOffset: number, isTrainingDay: boolean) => {
      const mealTimes: { time: string; label: string; pct: number }[] = [];
      const wakeMin = parseInt(wakeTime.split(':')[0]) * 60 + parseInt(wakeTime.split(':')[1]);
      const bedMin = parseInt(bedTime.split(':')[0]) * 60 + parseInt(bedTime.split(':')[1]);
      const awakeMin = bedMin - wakeMin;
      const interval = awakeMin / mealsCount;

      for (let i = 0; i < mealsCount; i++) {
        const mMin = wakeMin + interval * i;
        const h = Math.floor(mMin / 60);
        const m = mMin % 60;
        const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const pcts = [0.2, 0.2, 0.3, 0.15, 0.1, 0.05];
        mealTimes.push({
          time,
          label: i === 0 ? 'Завтрак' : i === 1 ? 'Второй завтрак' : i === 2 ? 'Обед' : i === 3 ? 'Полдник' : i === mealsCount-1 ? 'Ужин' : 'Перекус',
          pct: pcts[i] || 0.15,
        });
      }

      // Adjust for training
      if (linkToTraining && isTrainingDay) {
        const trainH = parseInt(trainStart.split(':')[0]);
        // Add pre and post workout meals
        mealTimes.push({ time: `${String(trainH-2).padStart(2,'0')}:00`, label: 'Предтрен', pct: 0.1 });
        mealTimes.push({ time: `${String(trainH+1).padStart(2,'0')}:30`, label: 'Пост-трен', pct: 0.15 });
      }

      // Cycling adjustments
      let tKcalAdj = tKcal;
      let tCAdj = tC;
      if (cyclingMode === 'macro' && !isTrainingDay) { tKcalAdj = Math.round(tKcal * 0.85); tCAdj = Math.round(tC * 0.7); }
      if (cyclingMode === 'butch') { tCAdj = isTrainingDay ? Math.round(tC * 1.3) : Math.round(tC * 0.5); }
      if (cyclingMode === 'cheatmeal' && isTrainingDay) { tKcalAdj = Math.round(tKcal * 0.85); /* cheat meal will be separate */ }
      if (cyclingMode === 'carbload' && isTrainingDay) { tCAdj = Math.round(tC * 1.5); }

      const meals = mealTimes.map((mt, idx) => {
        const p = Math.round(tP / mealTimes.length);
        const f = Math.round(tF / mealTimes.length);
        const c = Math.round(tCAdj / mealTimes.length);
        const kcal = Math.round(tKcalAdj / mealTimes.length);

        // Select items based on budget, allergens, preferences
        const items: any[] = [];
        let remainingP = p;
        let remainingF = f;
        let remainingC = c;

        // Protein source
        let protPool = foods.filter(f => f.id !== 'egg_white' && (f.category === 'protein' || f.category === 'dairy'));
        if (planType === 'vegetarian') protPool = protPool.filter(f => f.isVegetarian !== false);
        if (planType === 'mediterranean') protPool = protPool.filter(f => !f.name.toLowerCase().includes('говядин') && !f.name.toLowerCase().includes('свинин') && !f.name.toLowerCase().includes('баранин'));
        protPool = protPool.filter(f => !excludedIds.has(f.id) && !allergenIds.has(f.id) && preferredFoods.some(pf => pf === f.id || f.id.includes(pf)));
        if (protPool.length === 0) protPool = foods.filter(f => f.category === 'protein' || f.category === 'dairy').filter(f => !excludedIds.has(f.id) && !allergenIds.has(f.id));
        if (protPool.length > 0) {
          const prot = protPool[idx % protPool.length];
          const portions = Math.min(1.5, remainingP / Math.max(1, prot.protein));
          items.push({ name: prot.name, id: prot.id, amount: Math.round(portions * 100), kcal: Math.round(prot.kcal * portions), p: Math.round(prot.protein * portions), f: Math.round(prot.fat * portions), c: Math.round(prot.carbs * portions) });
          remainingP -= Math.round(prot.protein * portions);
        }

        // Carb source
        if (remainingC > 5) {
          let carbPool = foods.filter(f => f.category === 'carb' || f.category === 'grain');
          if (planType === 'keto') carbPool = carbPool.filter(f => f.carbs < 15);
          carbPool = carbPool.filter(f => !excludedIds.has(f.id) && !allergenIds.has(f.id));
          if (carbPool.length > 0) {
            const carb = carbPool[idx % carbPool.length];
            const portions = Math.min(1.2, remainingC / Math.max(1, carb.carbs));
            items.push({ name: carb.name, id: carb.id, amount: Math.round(portions * 100), kcal: Math.round(carb.kcal * portions), p: Math.round(carb.protein * portions), f: Math.round(carb.fat * portions), c: Math.round(carb.carbs * portions) });
          }
        }

        // Fat source (not duplicated with pre-workout)
        if (remainingF > 3 && !mt.label.includes('Предтрен') && !mt.label.includes('Пост-трен')) {
          let fatPool = foods.filter(f => f.category === 'fat');
          fatPool = fatPool.filter(f => !excludedIds.has(f.id) && !allergenIds.has(f.id));
          if (fatPool.length > 0) {
            const fat = fatPool[idx % fatPool.length];
            const portions = Math.min(0.3, remainingF / Math.max(1, fat.fat));
            items.push({ name: fat.name, id: fat.id, amount: Math.max(5, Math.round(portions * 100)), kcal: Math.round(fat.kcal * portions), p: Math.round(fat.protein * portions), f: Math.round(fat.fat * portions), c: Math.round(fat.carbs * portions) });
          }
        }

        // Vegetables
        const veg = FOOD_DB.filter(f => f.category === 'veg_fruit' && !excludedIds.has(f.id));
        if (veg.length > 0) {
          const v = veg[idx % veg.length];
          items.push({ name: v.name, id: v.id, amount: 80, kcal: Math.round(v.kcal * 0.8), p: Math.round(v.protein * 0.8), f: Math.round(v.fat * 0.8), c: Math.round(v.carbs * 0.8) });
        }

        const tot = { kcal: items.reduce((s,i) => s + i.kcal, 0), p: items.reduce((s,i) => s + i.p, 0), f: items.reduce((s,i) => s + i.f, 0), c: items.reduce((s,i) => s + i.c, 0) };

        return { ...mt, items, totals: tot, idx };
      });

      const totals = { kcal: meals.reduce((s,m) => s + m.totals.kcal, 0), p: meals.reduce((s,m) => s + m.totals.p, 0), f: meals.reduce((s,m) => s + m.totals.f, 0), c: meals.reduce((s,m) => s + m.totals.c, 0) };

      // Detect allergen conflicts
      const allergenWarnings: string[] = [];
      meals.forEach(m => {
        m.items.forEach((it: any) => {
          const food = FOOD_DB.find(f => f.id === it.id);
          if (food?.allergens) {
            const matched = food.allergens.filter(a => !allergens.includes(a));
            if (matched.length > 0 && !excludedIds.has(food.id)) {
              allergenWarnings.push(`${it.name}: содержит ${matched.join(', ')}`);
            }
          }
        });
      });

      return { meals, totals, isTrainingDay, allergenWarnings: [...new Set(allergenWarnings)] };
    };

    // Build plans
    const d1 = buildDay(0, true);
    const d2 = buildDay(1, false);
    const d3 = buildDay(2, true);
    setDayPlan(d1);

    if (days >= 3) {
      setThreeDayPlan({ days: [d1, d2, d3], totals: {
        kcal: d1.totals.kcal + d2.totals.kcal + d3.totals.kcal,
        p: d1.totals.p + d2.totals.p + d3.totals.p,
        f: d1.totals.f + d2.totals.f + d3.totals.f,
        c: d1.totals.c + d2.totals.c + d3.totals.c,
      }});
    }

    if (days >= 7) {
      const week = Array.from({ length: 7 }, (_, i) => buildDay(i, i % 3 === 0 || i % 3 === 2));
      setWeekPlan({ days: week, totals: {
        kcal: week.reduce((s,d) => s + d.totals.kcal, 0),
        p: week.reduce((s,d) => s + d.totals.p, 0),
        f: week.reduce((s,d) => s + d.totals.f, 0),
        c: week.reduce((s,d) => s + d.totals.c, 0),
      }});
    }

    // Shopping list
    const allMeals = [d1, d2, d3, ...(days >= 7 ? Array.from({ length: 7 }, (_, i) => buildDay(i, i % 3 === 0)) : [])];
    const itemMap: Record<string, { name: string; amount: number; category: string }> = {};
    allMeals.forEach(day => day.meals.forEach(m => m.items.forEach((it: any) => {
      if (itemMap[it.name]) itemMap[it.name].amount += it.amount;
      else {
        const food = FOOD_DB.find(f => f.id === it.id);
        itemMap[it.name] = { name: it.name, amount: it.amount, category: food?.category || 'other' };
      }
    })));
    setShoppingList(itemMap);

    // Water balance
    const baseWater = weight * 30 / 1000;
    const trainBonus = (s?.workoutsPerWeek || 0) > 0 ? 0.5 : 0;
    const fiberFactor = 0.2;
    const waterTotal = Math.max(1.5, Math.round((baseWater + trainBonus + fiberFactor) * 10) / 10);
    setWaterCalc({ baseWater: Math.round(baseWater * 10) / 10, trainBonus, fiberFactor, total: waterTotal });

    setGenerated(true);
  };

  // Generate cheat meal plan
  const [cheatMealPlan, setCheatMealPlan] = useState<any>(null);
  const [carbloadPlan, setCarbloadPlan] = useState<any>(null);
  const [butchPlan, setButchPlan] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const generateCheatMeal = () => {
    const cals = Math.round(effectiveKcal * 0.35);
    const items = FOOD_DB.filter(f => f.category === 'fast_food' || (f.kcal > 200 && f.name.toLowerCase().includes('бургер') || f.name.toLowerCase().includes('пицц') || f.name.toLowerCase().includes('картофель фри') || f.name.toLowerCase().includes('чипс') || f.name.toLowerCase().includes('шоколад') || f.name.toLowerCase().includes('морожен') || f.name.toLowerCase().includes('пончик'))).sort(() => Math.random() - 0.5).slice(0, 2);
    const tot = items.reduce((s,i) => s + i.kcal, 0);
    setCheatMealPlan({ items, totalKcal: tot, cals, note: 'Читмил ПОСЛЕ тяжёлой тренировки. Не более 1500 ккал. Вернуться к обычному рациону без компенсации.' });
  };

  const generateCarbload = () => {
    const carbsPerKg = 8;
    const totalCarbs = Math.round(weight * carbsPerKg);
    const carbFoods = FOOD_DB.filter(f => (f.category === 'carb' || f.category === 'grain') && f.carbs > 20).sort(() => Math.random() - 0.5).slice(0, 5);
    setCarbloadPlan({ totalCarbs, foods: carbFoods.map(f => ({ name: f.name, carbs: f.carbs, amount: Math.round(totalCarbs * 0.3 / f.carbs * 100) })), note: 'За 24-48ч до тяжёлой тренировки. Увеличить воду на 1-1.5л.' });
  };

  const generateBUTCH = () => {
    const highCarb = Math.round(effectiveC * 1.3);
    const lowCarb = Math.round(effectiveC * 0.5);
    setButchPlan({ pattern: '3 тренировочных + 1 отдых', highCarb, lowCarb, protein: effectiveP, note: 'Цикл: 3 дня ВУ (тренировочные) + 1 день НУ (отдых). Белок всегда высокий.' });
  };

  const generateRecommendations = () => {
    const recs: string[] = [];
    if (goal === 'mass') recs.push('Профицит 300-500 ккал. Белок 2г/кг. Основные приёмы до/после тренировки.');
    if (goal === 'fat_loss' || goal === 'cutting') recs.push('Дефицит 300-500 ккал. Белок 2.5г/кг. Углеводы вокруг тренировки.');
    if (goal === 'strength') recs.push('Профицит 200-300 ккал. Углеводы 5-6г/кг в тренировочные дни. Белок 2г/кг.');
    if (allergens.length > 0) recs.push(`Исключены аллергены: ${allergens.join(', ')}. Проверяйте состав продуктов.`);
    if (planType === 'keto') recs.push('Кето: контроль электролитов (натрий, калий, магний). Адаптация 2-4 недели.');
    if (linkToTraining) recs.push(`Тренировка ${trainStart}-${trainEnd}. Предтрен за 1.5-2ч. Пост-трен в течение 60-90мин.`);
    if (cyclingMode === 'butch') recs.push('БУЧ: следить за энергией в низкоуглеводные дни. Возможна вялость.');
    if (budget === 'low') recs.push('Бюджет: яйца, курица, рис, картофель, сезонные овощи — основа рациона.');
    if (budget === 'enhanced') recs.push('Премиум: лосось, говядина мраморная, авокадо, ягоды, органические продукты.');
    setRecommendations(recs);
  };

  // Save plan
  const saveCurrentPlan = () => {
    const plan: SavedPlan = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc,
    };
    const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)].slice(0, 10);
    setSavedPlans(updated);
    localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated));
  };

  // ─── Meal Prep Plan Generator ───
  const [mealPrepPlan, setMealPrepPlan] = useState<{ steps: MealPrepStep[]; totalTime: number; containers: number } | null>(null);

  const generateMealPrep = () => {
    if (!dayPlan) { generatePlan(1); if (!dayPlan) return; }
    const steps: MealPrepStep[] = [];
    let stepNum = 1;
    const allItems = dayPlan.meals.flatMap((m: any) => m.items.map((it: any) => ({ ...it, mealLabel: m.label, mealTime: m.time })));
    const uniqueItems = [...new Map(allItems.map((it: any) => [it.name, it])).values()];

    // Step 1: Prepare grains/rice (longest cooking time first)
    const grains = uniqueItems.filter((it: any) => {
      const n = it.name.toLowerCase();
      return n.includes('рис') || n.includes('гречк') || n.includes('плов') || n.includes('булгур') || n.includes('киноа') || n.includes('кус-кус') || n.includes('перловк') || n.includes('овсянк');
    });
    if (grains.length > 0) {
      steps.push({
        step: stepNum++, action: 'Поставить вариться крупы',
        duration: 25, items: grains.map((g: any) => `${g.name} ×${Math.round(g.amount / 100 * 7)} порций`),
      });
    }

    // Step 2: Marinate/season meats
    const meats = uniqueItems.filter((it: any) => {
      const n = it.name.toLowerCase();
      return n.includes('куриц') || n.includes('индейк') || n.includes('говядин') || n.includes('свинин') || n.includes('баранин') || n.includes('лосос') || n.includes('треск') || n.includes('палтус');
    });
    if (meats.length > 0) {
      steps.push({
        step: stepNum++, action: 'Замариновать мясо/рыбу (соль, перец, масло, специи)',
        duration: 5, items: meats.map((m: any) => `${m.name} ×${Math.round(m.amount / 100 * 7)} порций`),
      });
    }

    // Step 3: Oven prep
    const ovenItems = meats.filter((it: any) => {
      const n = it.name.toLowerCase();
      return n.includes('лосос') || n.includes('треск') || n.includes('палтус') || n.includes('индейк') || n.includes('говядин') || n.includes('куриц');
    });
    if (ovenItems.length > 0) {
      steps.push({
        step: stepNum++, action: 'Поставить в духовку (180-200°C)',
        duration: 30, items: ovenItems.map((m: any) => m.name),
      });
    }

    // Step 4: Eggs
    const eggs = uniqueItems.filter((it: any) => {
      const n = it.name.toLowerCase();
      return n.includes('яйц') || n.includes('омлет');
    });
    if (eggs.length > 0) {
      steps.push({
        step: stepNum++, action: 'Сварить яйца вкрутую (10 мин) или приготовить омлет',
        duration: 10, items: eggs.map((e: any) => `${e.name} ×${Math.round(e.amount / 60 * 7)} шт`),
      });
    }

    // Step 5: Vegetables
    const veg = uniqueItems.filter((it: any) => {
      const n = it.name.toLowerCase();
      return n.includes('овощ') || n.includes('брокколи') || n.includes('цветная капуст') || n.includes('морков') || n.includes('свёкл') || n.includes('кабач') || n.includes('перец') || n.includes('шпинат') || n.includes('стручков') || n.includes('спарж');
    });
    if (veg.length > 0) {
      steps.push({
        step: stepNum++, action: 'Нарезать овощи и приготовить на пару/запечь',
        duration: 15, items: veg.map((v: any) => v.name),
      });
    }

    // Step 6: Wash and portion fresh items
    const fresh = uniqueItems.filter((it: any) => {
      const n = it.name.toLowerCase();
      return n.includes('огурец') || n.includes('помидор') || n.includes('салат') || n.includes('зелен') || n.includes('укроп') || n.includes('петрушк') || n.includes('кинз') || n.includes('авокадо');
    });
    if (fresh.length > 0) {
      steps.push({
        step: stepNum++, action: 'Помыть, нарезать свежие овощи/зелень',
        duration: 8, items: fresh.map((f: any) => f.name),
      });
    }

    // Step 7: Portion into containers
    const mealCount = dayPlan.meals.length;
    steps.push({
      step: stepNum++, action: `Разложить по ${mealCount} контейнерам (по приёмам)`,
      duration: 12, items: [`${mealCount} контейнеров × 7 дней = ${mealCount * 7} порций`],
    });

    // Step 8: Label and organize
    steps.push({
      step: stepNum++, action: 'Подписать контейнеры (день + приём пищи), убрать в холодильник/морозилку',
      duration: 5, items: ['Холодильник: 3 дня', 'Морозилка: остальное'],
    });

    const totalTime = steps.reduce((s, st) => s + st.duration, 0);
    setMealPrepPlan({ steps, totalTime, containers: mealCount * 7 });
  };

  // ─── Render ───
  const renderMealList = (dayData: any) => {
    if (!dayData) return null;
    const d = dayData;
    return (
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
          {d.isTrainingDay ? '🏋️ Тренировочный день' : '😴 День отдыха'}
        </div>
        {d.allergenWarnings?.length > 0 && (
          <div style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 8, color: '#ef4444', marginBottom: 6 }}>
            ⚠ {d.allergenWarnings.join('; ')}
          </div>
        )}
        {d.meals.map((m: any, mi: number) => (
          <div key={mi} style={{ marginBottom: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
              <span style={{ fontWeight: 600, color: '#00e68a' }}>{m.time} {m.label}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{m.totals.kcal} ккал</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
              {m.items.map((it: any, ii: number) => (
                <span key={ii} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {it.name} {it.amount}г
                </span>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', fontSize: 9, marginTop: 4 }}>
          <span style={{ color: '#00e68a', fontWeight: 700 }}>Ккал: {Math.round(d.totals.kcal)}</span>
          <span style={{ color: '#3b82f6' }}>Б: {Math.round(d.totals.p)}</span>
          <span style={{ color: '#f59e0b' }}>Ж: {Math.round(d.totals.f)}</span>
          <span style={{ color: '#f97316' }}>У: {Math.round(d.totals.c)}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>

      {/* 1. User info card */}
      <GlassCard title="Пользователь" icon="👤">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
          <div><label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Вес (кг)</label><input type="number" value={weight} onChange={e => setWeight(+e.target.value || 0)} style={inputStyle} /></div>
          <div><label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Рост (см)</label><input type="number" value={height} onChange={e => setHeight(+e.target.value || 0)} style={inputStyle} /></div>
          <div><label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Возраст</label><input type="number" value={age} onChange={e => setAge(+e.target.value || 0)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
          <div>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Пол</label>
            <select value={sex} onChange={e => setSex(e.target.value as any)} style={selectStyle}>
              <option value="male">Мужской</option><option value="female">Женский</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Шагов/день</label>
            <input type="number" value={dailySteps} onChange={e => setDailySteps(+e.target.value || 0)} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Время на готовку (мин/день)</label>
          <input type="number" value={cookTimeMin} onChange={e => setCookTimeMin(+e.target.value || 0)} style={inputStyle} />
        </div>
      </GlassCard>

      {/* 2. Goal card */}
      <GlassCard title="Цель" icon="🎯">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {GOALS.map(g => (
            <PillBtn key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)} color={goal === g.id ? '#00e68a' : undefined}>
              {g.icon} {g.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      {/* 3. Phase + drugs card */}
      <GlassCard title="Фаза и препараты" icon="💉">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {PHASES.map(p => (
            <PillBtn key={p.id} active={phase === p.id} onClick={() => setPhase(p.id)}>{p.icon} {p.label}</PillBtn>
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Инъекции (добавьте препараты курса):</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-end', marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 60 }}>
            <input type="text" value={injName} onChange={e => setInjName(e.target.value)} placeholder="Название" style={inputStyle} list="drug-list" />
            <datalist id="drug-list">{injectDrugTypes.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div style={{ width: 55 }}>
            <input type="time" value={injTime} onChange={e => setInjTime(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ width: 45 }}>
            <input type="number" value={injDose} onChange={e => setInjDose(+e.target.value || 0)} style={inputStyle} placeholder="Доза" />
          </div>
          <div style={{ width: 40 }}>
            <select value={injUnit} onChange={e => setInjUnit(e.target.value)} style={selectStyle}>
              <option value="mg">mg</option><option value="mcg">mcg</option>
              <option value="IU">IU</option><option value="ml">ml</option>
            </select>
          </div>
          <button onClick={() => { if (injName.trim()) { setInjections([...injections, { id: Date.now().toString(), name: injName.trim(), time: injTime, dose: injDose, unit: injUnit, type: injType }]); setInjName(''); } }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 9, cursor: 'pointer' }}>+</button>
        </div>
        {injections.map((inj, i) => (
          <div key={inj.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 6px', borderRadius: 6, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)', fontSize: 8, marginRight: 3, marginBottom: 3, color: '#06b6d4' }}>
            💉 {inj.time} {inj.name} {inj.dose}{inj.unit}
            <button onClick={() => setInjections(injections.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 10, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
      </GlassCard>

      {/* 4. Training link */}
      <GlassCard title="Привязка к тренировке" icon="🏋️">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={() => setLinkToTraining(!linkToTraining)} style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none',
            background: linkToTraining ? '#00e68a' : 'rgba(255,255,255,0.1)',
            position: 'relative' as const, transition: 'background 0.2s',
          }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: linkToTraining ? 18 : 2, transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: 10, color: linkToTraining ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>Привязать рацион к тренировке</span>
        </div>
        {linkToTraining && (
          <div style={{ display: 'flex', gap: 4, fontSize: 9 }}>
            <div><label style={{ color: 'rgba(255,255,255,0.3)' }}>Начало</label><input type="time" value={trainStart} onChange={e => setTrainStart(e.target.value)} style={inputStyle} /></div>
            <div><label style={{ color: 'rgba(255,255,255,0.3)' }}>Конец</label><input type="time" value={trainEnd} onChange={e => setTrainEnd(e.target.value)} style={inputStyle} /></div>
          </div>
        )}
      </GlassCard>

      {/* 5. Editable KBJU card */}
      <GlassCard title="КБЖУ" icon="📊">
        {!editMode ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
              {[{ l:'Ккал', v: effectiveKcal, c:'#00e68a' }, { l:'Белки', v: effectiveP, c:'#3b82f6' }, { l:'Жиры', v: effectiveF, c:'#f59e0b' }, { l:'Углеводы', v: effectiveC, c:'#f97316' }].map(m => (
                <div key={m.l} style={{ textAlign:'center', background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'4px' }}>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{m.l}</div>
                  <div style={{ fontWeight:700, color:m.c, fontSize:14 }}>{m.v}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setEditMode(true)} style={{ width:'100%', padding:6, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.02)', color:'rgba(255,255,255,0.5)', fontSize:9, cursor:'pointer' }}>✏️ Редактировать КБЖУ</button>
          </div>
        ) : (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, marginBottom:4 }}>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Ккал</label><input type="number" value={manualKcal ?? calcTargets.kcal} onChange={e => setManualKcal(+e.target.value || null)} style={inputStyle} /></div>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Белки (г)</label><input type="number" value={manualP ?? calcTargets.protein} onChange={e => setManualP(+e.target.value || null)} style={inputStyle} /></div>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Жиры (г)</label><input type="number" value={manualF ?? calcTargets.fats} onChange={e => setManualF(+e.target.value || null)} style={inputStyle} /></div>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Углеводы (г)</label><input type="number" value={manualC ?? calcTargets.carbs} onChange={e => setManualC(+e.target.value || null)} style={inputStyle} /></div>
            </div>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',marginBottom:4}}>Введите любые значения — недостающие рассчитаются автоматически</div>
            <button onClick={() => setEditMode(false)} style={greenBtn}>✓ Готово</button>
          </div>
        )}
      </GlassCard>

      {/* 6. Budget level */}
      <GlassCard title="Уровень бюджета" icon="💰">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {BUDGET_LEVELS.map(b => (
            <button key={b.id} onClick={() => setBudget(b.id)} style={{
              padding: '6px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              background: budget === b.id ? `${b.color}15` : 'rgba(255,255,255,0.02)',
              border: budget === b.id ? `1px solid ${b.color}` : '1px solid rgba(255,255,255,0.06)',
              color: budget === b.id ? b.color : 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 11 }}>{b.icon} {b.label}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{b.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 7. Nutrition level */}
      <GlassCard title="Уровень питания" icon="📈">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          {NUTRITION_LEVELS.map(n => (
            <button key={n.id} onClick={() => setNutrLevel(n.id)} style={{
              padding: '6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
              background: nutrLevel === n.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
              border: nutrLevel === n.id ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
              color: nutrLevel === n.id ? '#00e68a' : 'rgba(255,255,255,0.5)',
              fontWeight: nutrLevel === n.id ? 700 : 400, fontSize: 10,
            }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 8. Schedule card */}
      <GlassCard title="Расписание" icon="⏰">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
          <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Пробуждение</label><input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={inputStyle} /></div>
          <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Обед</label><input type="time" value={lunchTime} onChange={e => setLunchTime(e.target.value)} style={inputStyle} /></div>
          <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Ужин</label><input type="time" value={dinnerTime} onChange={e => setDinnerTime(e.target.value)} style={inputStyle} /></div>
          <div><label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Отход ко сну</label><input type="time" value={bedTime} onChange={e => setBedTime(e.target.value)} style={inputStyle} /></div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Еда на работе</label>
            <select value={workFood} onChange={e => setWorkFood(e.target.value as any)} style={selectStyle}>
              <option value="any">Любая (можно разогреть)</option>
              <option value="portable">Только порошок/хлопья/протеин</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Количество приёмов пищи</label>
          <div style={{ display: 'flex', gap: 3 }}>
            {[3,4,5,6].map(n => (
              <PillBtn key={n} active={mealsCount === n} onClick={() => setMealsCount(n)}>{n}</PillBtn>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* 9. Allergens */}
      <GlassCard title="Аллергены и ограничения" icon="⚠️">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ALLERGEN_LIST.map(a => (
            <PillBtn key={a} active={allergens.includes(a)} onClick={() => toggleAllergen(a)} color={allergens.includes(a) ? '#ef4444' : undefined}>
              {allergens.includes(a) ? '✕ ' : '○ '}{a}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      {/* 10. Plan type */}
      <GlassCard title="Тип плана питания" icon="📋">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {PLAN_TYPES.map(pt => (
            <PillBtn key={pt.id} active={planType === pt.id} onClick={() => setPlanType(pt.id)}>
              {pt.icon} {pt.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      {/* 11-12. Food preferences + excluded */}
      <GlassCard title="Предпочтения и исключения" icon="🍎">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Любимые продукты:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 6 }}>
          {preferredFoods.slice(0, 8).map((pf, i) => {
            const food = FOOD_DB.find(f => f.id === pf);
            return food ? (
              <span key={pf} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a' }}>
                {food.name}
              </span>
            ) : null;
          })}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Исключённые продукты:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 6 }}>
          {excludedFoods.map((ef, i) => {
            const food = FOOD_DB.find(f => f.id === ef);
            return food ? (
              <span key={ef} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>
                {food.name}
              </span>
            ) : null;
          })}
        </div>
      </GlassCard>

      {/* 13. Cycling mode */}
      <GlassCard title="Циклирование" icon="🔄">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {[
            { id: 'none' as CycleType, label: 'Выкл', icon: '⏹️' },
            { id: 'macro' as CycleType, label: 'Макросы', icon: '🔄' },
            { id: 'butch' as CycleType, label: 'БУЧ', icon: '⤴️⤵️' },
            { id: 'cheatmeal' as CycleType, label: 'Читмил', icon: '🍔' },
            { id: 'carbload' as CycleType, label: 'Углев. загр.', icon: '🍚' },
          ].map(c => (
            <PillBtn key={c.id} active={cyclingMode === c.id} onClick={() => setCyclingMode(c.id)} color={cyclingMode === c.id ? '#3b82f6' : undefined}>
              {c.icon} {c.label}
            </PillBtn>
          ))}
        </div>
        {cyclingMode !== 'none' && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            {cyclingMode === 'macro' && 'Тренировочные: +15% ккал/+30% угл. Отдых: −15% ккал/−30% угл. Белок постоянный.'}
            {cyclingMode === 'butch' && '3 дня ВУ (тренировочные) + 1 день НУ (отдых). Белок 2.2г/кг всегда.'}
            {cyclingMode === 'cheatmeal' && 'Один приём пищи ПОСЛЕ тяжёлой тренировки. До 1500 ккал.'}
            {cyclingMode === 'carbload' && '6-8г/кг углеводов за 24-48ч до тяжёлой тренировки. +1-1.5л воды.'}
          </div>
        )}
      </GlassCard>

      {/* 14. Heavy training day for cycling */}
      {(cyclingMode === 'cheatmeal' || cyclingMode === 'carbload') && (
        <GlassCard title={cyclingMode === 'cheatmeal' ? 'Читмил' : 'Углеводная загрузка'} icon="📅">
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>День тяжёлой тренировки:</label>
          <input type="date" value={heavyTrainDay} onChange={e => setHeavyTrainDay(e.target.value)} style={inputStyle} />
        </GlassCard>
      )}

      {/* 15. Generate button */}
      <button onClick={() => setPlanDays(1)} style={{ ...greenBtn, fontSize: 13, padding: 12 }}>✨ Сгенерировать план питания</button>

      {/* Day/3day/Week selector */}
      {generated && (
        <GlassCard title="Варианты отображения" icon="📐">
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 1 as const, label: 'На день' },
              { id: 3 as const, label: 'На 3 дня' },
              { id: 7 as const, label: 'Недельный' },
            ].map(v => (
              <button key={v.id} onClick={() => { setPlanDays(v.id); if (!dayPlan) generatePlan(1); if (v.id >= 3 && !threeDayPlan) generatePlan(3); if (v.id >= 7 && !weekPlan) generatePlan(7); }} style={{
                flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                background: planDays === v.id ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'rgba(255,255,255,0.03)',
                border: planDays === v.id ? 'none' : '1px solid rgba(255,255,255,0.06)',
                color: planDays === v.id ? '#000' : 'rgba(255,255,255,0.5)',
                fontWeight: 700, fontSize: 11,
              }}>{v.label}</button>
            ))}
          </div>
          {planDays !== 1 && (
            <button onClick={() => generatePlan(planDays)} style={{ marginTop: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', cursor: 'pointer', fontSize: 9, width: '100%' }}>
              🔄 Перегенерировать {planDays === 3 ? '3 дня' : 'неделю'}
            </button>
          )}
        </GlassCard>
      )}

      {/* Results */}
      {generated && planDays === 1 && dayPlan && (
        <GlassCard title="📋 План на день" icon="📋" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {renderMealList(dayPlan)}
        </GlassCard>
      )}

      {generated && planDays === 3 && threeDayPlan && (
        <>
          <GlassCard title="📋 План на 3 дня" icon="📋" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 6 }}>
              <span style={{ color: '#00e68a', fontWeight: 700 }}>Всего за 3 дня: {Math.round(threeDayPlan.totals.kcal)} ккал</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>В ср/день: {Math.round(threeDayPlan.totals.kcal / 3)} ккал</span>
            </div>
            {threeDayPlan.days.map((d: any, di: number) => (
              <div key={di} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>День {di + 1}</div>
                {renderMealList(d)}
              </div>
            ))}
          </GlassCard>
        </>
      )}

      {generated && planDays === 7 && weekPlan && (
        <GlassCard title="📋 Недельный план" icon="📋" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ fontSize: 9, color: '#00e68a', fontWeight: 700, marginBottom: 6 }}>
            Всего за неделю: {Math.round(weekPlan.totals.kcal)} ккал | В ср/день: {Math.round(weekPlan.totals.kcal / 7)} ккал
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {weekPlan.days.map((d: any, di: number) => (
              <div key={di} style={{ marginBottom: 6, padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  День {di + 1} {d.isTrainingDay ? '🏋️' : '😴'} — {Math.round(d.totals.kcal)} ккал
                </div>
                {d.meals.map((m: any, mi: number) => (
                  <div key={mi} style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', padding: '1px 0' }}>
                    {m.time} {m.label}: {m.items.map((it: any) => it.name).join(', ')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Save plan button */}
      {generated && (
        <button onClick={saveCurrentPlan} style={{ ...greenBtn, background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' }}>
          💾 Сохранить в мои планы
        </button>
      )}

      {/* 17. Shopping list */}
      {generated && shoppingList && (
        <GlassCard title="🛒 Список покупок" icon="🛒" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          {Object.entries(shoppingList).map(([name, data]: [string, any]) => (
            <div key={name} style={{ fontSize: 9, padding: '2px 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span>{name}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                {data.amount >= 1000 ? `${(data.amount / 1000).toFixed(1)} кг` : `${Math.round(data.amount)} г`}
              </span>
            </div>
          ))}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '6px', borderRadius: 6, border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.08)', color: '#f97316', cursor: 'pointer', fontSize: 9, width: '100%' }}>💾 Сохранить в мои планы</button>
        </GlassCard>
      )}

      {/* 18. Water balance */}
      {generated && waterCalc && (
        <GlassCard title="💧 Водный баланс" icon="💧" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            <div>База: 30 мл × {weight} кг = {waterCalc.baseWater} л</div>
            {waterCalc.trainBonus > 0 && <div>+ тренировка: {waterCalc.trainBonus} л</div>}
            <div style={{ fontSize: 14, fontWeight: 800, color: '#06b6d4', marginTop: 4, textAlign: 'center' }}>
              Итого: {waterCalc.total} л/день
            </div>
          </div>
        </GlassCard>
      )}

      {/* 19. Generate reports */}
      {generated && (
        <button onClick={() => {
          generatePlan(planDays);
          setPlanDays(7);
        }} style={{ ...greenBtn, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
          📊 Сгенерировать общий отчёт
        </button>
      )}

      {/* 20-22: Separate calculators */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => { generateCheatMeal(); }} style={{ flex: 1, padding: 7, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>
          🍔 Читмил
        </button>
        <button onClick={() => { generateCarbload(); }} style={{ flex: 1, padding: 7, borderRadius: 8, border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.08)', color: '#f97316', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>
          🍚 Углев. загрузка
        </button>
        <button onClick={() => { generateBUTCH(); }} style={{ flex: 1, padding: 7, borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>
          ⤴️⤵️ БУЧ
        </button>
      </div>

      {cheatMealPlan && (
        <GlassCard title="🍔 Читмил" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>~{cheatMealPlan.cals} ккал (35% от дневной нормы)</div>
          {cheatMealPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ fontSize: 9, padding: '2px 0' }}>• {it.name} — {it.kcal} ккал</div>
          ))}
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4 }}>{cheatMealPlan.note}</div>
        </GlassCard>
      )}

      {carbloadPlan && (
        <GlassCard title="🍚 Углеводная загрузка" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 9, color: '#f97316', fontWeight: 700, marginBottom: 4 }}>Всего углеводов: {carbloadPlan.totalCarbs} г ({Math.round(carbloadPlan.totalCarbs / weight)} г/кг)</div>
          {carbloadPlan.foods.map((f: any, i: number) => (
            <div key={i} style={{ fontSize: 9, padding: '2px 0', color: 'rgba(255,255,255,0.6)' }}>• {f.name}: {f.amount}г ({f.carbs}г/100г)</div>
          ))}
          <div style={{ fontSize: 8, color: '#f97316', marginTop: 4 }}>{carbloadPlan.note}</div>
        </GlassCard>
      )}

      {butchPlan && (
        <GlassCard title="⤴️⤵️ БУЧ" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            <div>📋 Схема: {butchPlan.pattern}</div>
            <div style={{ marginTop: 4 }}>
              <span style={{ color: '#22c55e' }}>ВУ дни: {butchPlan.highCarb}г угл</span> | 
              <span style={{ color: '#ef4444' }}> НУ дни: {butchPlan.lowCarb}г угл</span>
            </div>
            <div>Белок: {butchPlan.protein}г (постоянный)</div>
            <div style={{ fontSize: 8, color: '#3b82f6', marginTop: 4 }}>{butchPlan.note}</div>
          </div>
        </GlassCard>
      )}

      {/* 22. Recommendations */}
      <button onClick={generateRecommendations} style={{ ...greenBtn, background: 'linear-gradient(135deg,#a855f7,#d946ef)' }}>
        💡 Выдать рекомендации
      </button>
      {recommendations.length > 0 && (
        <GlassCard title="💡 Рекомендации" style={{ border: '1px solid rgba(168,85,247,0.15)' }}>
          {recommendations.map((r, i) => (
            <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', padding: '3px 0', borderBottom: i < recommendations.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              • {r}
            </div>
          ))}
        </GlassCard>
      )}

      {/* 23. Meal prep plan */}
      {generated && dayPlan && (
        <button onClick={generateMealPrep} style={{ ...greenBtn, background: 'linear-gradient(135deg,#06b6d4,#0e7490)' }}>
          👨‍🍳 Составить план готовки (Meal Prep)
        </button>
      )}
      {mealPrepPlan && (
        <GlassCard title="👨‍🍳 План готовки" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ fontSize: 9, color: '#06b6d4', fontWeight: 700, marginBottom: 6 }}>
            ⏱ Общее время: {mealPrepPlan.totalTime} мин · Контейнеров: {mealPrepPlan.containers}
          </div>
          {mealPrepPlan.steps.map((st, i) => (
            <div key={i} style={{ marginBottom: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#06b6d4' }}>Шаг {st.step}: {st.action}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{st.duration} мин</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                {st.items.map((item, j) => <span key={j} style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.03)' }}>{item}</span>)}
              </div>
            </div>
          ))}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '6px', borderRadius: 6, border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.08)', color: '#06b6d4', cursor: 'pointer', fontSize: 9, width: '100%' }}>💾 Сохранить</button>
        </GlassCard>
      )}

      {/* Saved plans */}
      {savedPlans.length > 0 && (
        <GlassCard title="📂 Сохранённые планы" icon="📂">
          {savedPlans.slice(0, 5).map(p => (
            <div key={p.id} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 9, display: 'flex', justifyContent: 'space-between' }}>
              <span>📅 {p.date}</span>
              <span style={{color:'rgba(255,255,255,0.4)'}}>
                {p.dayPlan ? `${Math.round(p.dayPlan.totals.kcal)} ккал` : ''}
              </span>
            </div>
          ))}
        </GlassCard>
      )}

    </div>
  );
};
