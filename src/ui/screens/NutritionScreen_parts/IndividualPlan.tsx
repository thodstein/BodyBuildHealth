import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { addToCart } from '../../../core/nutrition-utils';
import { FOOD_DB } from '../../../core/nutrition-database';
import { calcNutrition } from '../../../engines/nutrition.engine';
import { getProfile, updateProfile } from '../../../core/profile-manager';
import type { UserProfile } from '../../../core/types';


// ─── Types ───
type GoalId = 'mass' | 'strength' | 'fat_loss' | 'cutting' | 'post_cut' | 'maintenance' | 'recomposition' | 'rehab';
type PhaseId = 'course' | 'bridge' | 'pct' | 'recovery' | 'cutting' | 'maintenance' | 'recomp' | 'fat_loss' | 'post_cut';
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

const PHASES: { id: PhaseId; label: string; icon: string; desc: string }[] = [
  { id: 'course', label: 'Курс', icon: '💉', desc: 'Активная фаза с фармакологической поддержкой' },
  { id: 'bridge', label: 'Мост', icon: '🌉', desc: 'Переход между курсами, низкие дозировки' },
  { id: 'pct', label: 'ПКТ', icon: '🔄', desc: 'Послекурсовая терапия, восстановление оси ГГЯ' },
  { id: 'recovery', label: 'Восстановление', icon: '🩹', desc: 'Повышенный белок, витамины, отдых' },
  { id: 'cutting', label: 'Сушка', icon: '✂️', desc: 'Дефицит 300-500 ккал, рельеф' },
  { id: 'maintenance', label: 'Поддержка', icon: '⚖️', desc: 'Баланс, сохранение формы' },
  { id: 'recomp', label: 'Рекомпозиция', icon: '🔄', desc: 'Одновременный рост + жиросжигание' },
  { id: 'fat_loss', label: 'Похудение', icon: '🔥', desc: 'Дефицит калорий, жиросжигание' },
  { id: 'post_cut', label: 'Выход из сушки', icon: '📈', desc: 'Плавный выход, обратная метаболическая' },
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

const ALLERGEN_LIST = [
  { id: 'лактоза', label: 'Лактоза', icon: '🥛' },
  { id: 'глютен', label: 'Глютен', icon: '🌾' },
  { id: 'орехи', label: 'Орехи (грецкие/миндаль/кешью)', icon: '🥜' },
  { id: 'арахис', label: 'Арахис', icon: '🥜' },
  { id: 'яйца', label: 'Яйца', icon: '🥚' },
  { id: 'соя', label: 'Соя/тофу', icon: '🫘' },
  { id: 'рыба', label: 'Рыба', icon: '🐟' },
  { id: 'морепродукты', label: 'Морепродукты (креветки/крабы)', icon: '🦐' },
  { id: 'молочные', label: 'Молочные продукты (казеин/сыворотка)', icon: '🧀' },
  { id: 'кунжут', label: 'Кунжут/тахини', icon: '🌰' },
  { id: 'сельдерей', label: 'Сельдерей', icon: '🥬' },
  { id: 'горчица', label: 'Горчица', icon: '🫙' },
  { id: 'сульфиты', label: 'Сульфиты (вино/сухофрукты)', icon: '🍷' },
  { id: 'люпин', label: 'Люпин (мука/белок)', icon: '🌱' },
];

// ─── Helpers ───
const getProfileSafe = () => { try { return getProfile(); } catch { return null; } };

const getDefaultKcal = (profile: UserProfile | null) => {
  if (!profile) return 2200;
  const s = profile.settings;
  return s.weight ? Math.round(s.weight * 30) : 2200;
};

const GlassCard: React.FC<{ title?: string; icon?: string; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ title, icon, color, style, children }) => (
  <div style={{
    padding: 14, borderRadius: 14,
    background: '#18181b',
    border: '1px solid #27272a',
    position: 'relative', overflow: 'hidden',
    ...style,
  }}>
    {color && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}66)` }} />}
    {title && <div style={{ fontSize: 11, color: color || 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.3px' }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}{title}
    </div>}
    {children}
  </div>
);

const PillBtn: React.FC<{ active?: boolean; onClick: () => void; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ active, onClick, color, children, style }) => (
  <button onClick={onClick} style={{
    padding: '5px 10px', borderRadius: 16, fontSize: 9, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
    background: active ? (color ? `${color}25` : 'rgba(0,230,138,0.2)') : '#202023',
    border: active ? `1px solid ${color || '#00e68a'}` : '1px solid #27272a',
    color: active ? (color || '#00e68a') : 'rgba(255,255,255,0.5)',
    transition: 'all 0.15s',
    ...style,
  }}>{children}</button>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  background: '#202023', border: '1px solid #27272a',
  color: '#fff', fontSize: 11, boxSizing: 'border-box' as const,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none' as const,
};

const greenBtn: React.CSSProperties = {
  width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000',
  fontWeight: 700, fontSize: 11,
  transition: 'box-shadow 0.2s, transform 0.15s',
};

const reportPillStyle = (color: string, active: boolean): React.CSSProperties => ({
  padding: '4px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer', fontWeight: 600,
  background: active ? `${color}25` : '#202023',
  border: active ? `1px solid ${color}` : '1px solid #27272a',
  color: active ? color : 'rgba(255,255,255,0.5)',
  transition: 'all 0.15s',
});

// ─── Main Component ───
export const IndividualPlan: React.FC<{ profile: UserProfile | null; course?: any[] }> = ({ profile: _profile, course: _course }) => {
  const profile = _profile || getProfileSafe();
  const s = profile?.settings;
  const courseEntries = _course || [];

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
  const [injections, setInjections] = useState<DrugInjection[]>(() => {
    // Auto-pull from pharma course
    if (courseEntries.length > 0) {
      return courseEntries.map(ce => ({
        id: `course_${ce.substanceId}_${Date.now()}`,
        name: ce.substanceId || ce.name || 'Препарат',
        time: '08:00',
        dose: ce.doseValue || 10,
        unit: ce.doseUnit || 'mg',
        type: ce.substanceId?.toLowerCase().includes('ins') || ce.name?.toLowerCase().includes('инсулин') ? 'инсулин' : 'другое',
      }));
    }
    return [];
  });
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

  const resultsRef = useRef<HTMLDivElement>(null);
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
  const [customNotes, setCustomNotes] = useState(() => { try { return localStorage.getItem('he_nutrition_notes') || ''; } catch { return ''; } });

  // 12. Excluded foods
  const [excludedFoods, setExcludedFoods] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_excluded_foods') || '[]'); } catch { return []; } });

  // 13-14: Cycling toggles
  const [cyclingMode, setCyclingMode] = useState<CycleType>('none');
  const [heavyTrainDay, setHeavyTrainDay] = useState('');
  const [trainingDays, setTrainingDays] = useState<boolean[]>([true, false, true, false, true, true, false]);
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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
  const [expandedSavedId, setExpandedSavedId] = useState<number | null>(null);

  const loadSavedPlan = (plan: SavedPlan) => {
    if (plan.dayPlan) { setDayPlan(plan.dayPlan); setGenerated(true); setPlanDays(1); }
    if (plan.threeDayPlan) setThreeDayPlan(plan.threeDayPlan);
    if (plan.weekPlan) setWeekPlan(plan.weekPlan);
    if (plan.shoppingList) setShoppingList(plan.shoppingList);
    if (plan.waterCalc) setWaterCalc(plan.waterCalc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync goal to profile
  useEffect(() => {
    if (profile) {
      try { updateProfile({ settings: { ...profile.settings, primaryGoal: goal as any } } as any); } catch {}
    }
  }, [goal]);

  const toggleAllergen = (id: string) => {
    setAllergens(prev => {
      const updated = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
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
        if (a === 'лактоза' || a === 'молочные') return ['cottage_cheese_5','kefir','yogurt_greek','milk','cheese_hard','kefir_2','yogurt_natural','ryazhenka','sour_cream_15','greek_yogurt','milk_3_2','cheese_mozzarella','cheese_ricotta','whey_protein'];
        if (a === 'глютен') return ['pasta_durum','bread_rye','tortilla_wheat','oats','bulgur','couscous','bread_white','flour_wheat'];
        if (a === 'орехи') return FOOD_DB.filter(f => f.allergens?.includes('nuts') || f.name.toLowerCase().includes('миндаль') || f.name.toLowerCase().includes('грецк') || f.name.toLowerCase().includes('кешью') || f.name.toLowerCase().includes('фундук') || f.name.toLowerCase().includes('пекан')).map(f => f.id);
        if (a === 'арахис') return FOOD_DB.filter(f => f.name.toLowerCase().includes('арахис')).map(f => f.id);
        if (a === 'яйца') return ['egg_whole','egg_white'];
        if (a === 'соя') return FOOD_DB.filter(f => f.name.toLowerCase().includes('соя') || f.name.toLowerCase().includes('тофу') || f.name.toLowerCase().includes('эдамам') || f.name.toLowerCase().includes('темпе')).map(f => f.id);
        if (a === 'рыба') return FOOD_DB.filter(f => f.category === 'protein' && (f.name.toLowerCase().includes('рыб') || f.name.toLowerCase().includes('лосос') || f.name.toLowerCase().includes('тунец') || f.name.toLowerCase().includes('треск') || f.name.toLowerCase().includes('палтус') || f.name.toLowerCase().includes('скумбр') || f.name.toLowerCase().includes('форель') || f.name.toLowerCase().includes('сардин') || f.name.toLowerCase().includes('сельдь'))).map(f => f.id);
        if (a === 'морепродукты') return FOOD_DB.filter(f => f.name.toLowerCase().includes('креветк') || f.name.toLowerCase().includes('краб') || f.name.toLowerCase().includes('лобстер') || f.name.toLowerCase().includes('омар') || f.name.toLowerCase().includes('мидии') || f.name.toLowerCase().includes('кальмар') || f.name.toLowerCase().includes('осьминог')).map(f => f.id);
        if (a === 'кунжут') return FOOD_DB.filter(f => f.name.toLowerCase().includes('кунжут') || f.name.toLowerCase().includes('тахини') || f.name.toLowerCase().includes('сезам')).map(f => f.id);
        if (a === 'горчица') return FOOD_DB.filter(f => f.name.toLowerCase().includes('горчиц')).map(f => f.id);
        return [];
      })
    );

    // Seeded random for food variety
    const seedRand = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 49297;
      return x - Math.floor(x);
    };

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
        const foodSeed = dayOffset * 1000 + idx * 73;

        // Protein source
        let protPool = foods.filter(f => f.id !== 'egg_white' && (f.category === 'protein' || f.category === 'dairy'));
        if (planType === 'vegetarian') protPool = protPool.filter(f => f.isVegetarian !== false);
        if (planType === 'mediterranean') protPool = protPool.filter(f => !f.name.toLowerCase().includes('говядин') && !f.name.toLowerCase().includes('свинин') && !f.name.toLowerCase().includes('баранин'));
        protPool = protPool.filter(f => !excludedIds.has(f.id) && !allergenIds.has(f.id));
        // Prefer user's preferred foods but mix in variety
        const preferredPool = protPool.filter(f => preferredFoods.some(pf => pf === f.id));
        const mixPool = preferredPool.length >= 2 ? preferredPool : protPool;
        if (mixPool.length > 0) {
          const protIdx = Math.floor(seedRand(foodSeed + 1) * mixPool.length);
          const prot = mixPool[protIdx % mixPool.length];
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
            const carbIdx = Math.floor(seedRand(foodSeed + 2) * carbPool.length);
            const carb = carbPool[carbIdx % carbPool.length];
            const portions = Math.min(1.2, remainingC / Math.max(1, carb.carbs));
            items.push({ name: carb.name, id: carb.id, amount: Math.round(portions * 100), kcal: Math.round(carb.kcal * portions), p: Math.round(carb.protein * portions), f: Math.round(carb.fat * portions), c: Math.round(carb.carbs * portions) });
          }
        }

        // Fat source (not duplicated with pre-workout)
        if (remainingF > 3 && !mt.label.includes('Предтрен') && !mt.label.includes('Пост-трен')) {
          let fatPool = foods.filter(f => f.category === 'fat');
          fatPool = fatPool.filter(f => !excludedIds.has(f.id) && !allergenIds.has(f.id));
          if (fatPool.length > 0) {
            const fatIdx = Math.floor(seedRand(foodSeed + 3) * fatPool.length);
            const fat = fatPool[fatIdx % fatPool.length];
            const portions = Math.min(0.3, remainingF / Math.max(1, fat.fat));
            items.push({ name: fat.name, id: fat.id, amount: Math.max(5, Math.round(portions * 100)), kcal: Math.round(fat.kcal * portions), p: Math.round(fat.protein * portions), f: Math.round(fat.fat * portions), c: Math.round(fat.carbs * portions) });
          }
        }

        // Vegetables
        const vegPool = FOOD_DB.filter(f => f.category === 'veg_fruit' && !excludedIds.has(f.id));
        if (vegPool.length > 0) {
          const vegIdx = Math.floor(seedRand(foodSeed + 4) * vegPool.length);
          const v = vegPool[vegIdx % vegPool.length];
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
    const d1 = buildDay(0, trainingDays[0]);
    const d2 = buildDay(1, trainingDays[1]);
    const d3 = buildDay(2, trainingDays[2]);
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
      const week = Array.from({ length: 7 }, (_, i) => buildDay(i, trainingDays[i]));
      setWeekPlan({ days: week, totals: {
        kcal: week.reduce((s,d) => s + d.totals.kcal, 0),
        p: week.reduce((s,d) => s + d.totals.p, 0),
        f: week.reduce((s,d) => s + d.totals.f, 0),
        c: week.reduce((s,d) => s + d.totals.c, 0),
      }});
    }

    // Shopping list — grouped by category
    const allMeals = [d1, d2, d3, ...(days >= 7 ? Array.from({ length: 7 }, (_, i) => buildDay(i, trainingDays[i])) : [])];
    const itemMap: Record<string, { name: string; amount: number; category: string; catLabel: string }> = {};
    const catLabels: Record<string, string> = {
      protein: '🥩 Мясо/рыба', dairy: '🥛 Молочка', eggs: '🥚 Яйца',
      carb: '🍚 Крупы/хлеб', grain: '🌾 Зерновые', fat: '🧈 Жиры/масла',
      veg_fruit: '🥦 Овощи/фрукты', nuts: '🥜 Орехи/семена',
      sauce: '🫙 Соусы/специи', drink: '🥤 Напитки',
      other: '📦 Прочее', fast_food: '🍔 Фастфуд',
    };
    allMeals.forEach(day => day.meals.forEach(m => m.items.forEach((it: any) => {
      const food = FOOD_DB.find(f => f.id === it.id);
      const cat = food?.category || 'other';
      if (itemMap[it.name]) itemMap[it.name].amount += it.amount;
      else itemMap[it.name] = { name: it.name, amount: it.amount, category: cat, catLabel: catLabels[cat] || cat };
    })));
    // Sort: grouped by category, then by name
    const sorted = Object.values(itemMap).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
    setShoppingList(sorted);

    // Water balance (with pharma adjustments)
    const hasPharma = injections.length > 0 || (courseEntries?.length || 0) > 0;
    const baseWaterMl = weight * (hasPharma ? 40 : 30); // AAS ↑ protein metabolism → ↑ water
    const baseWater = baseWaterMl / 1000;
    const trainBonus = (s?.workoutsPerWeek || 0) > 0 ? 0.5 : 0;
    const fiberFactor = 0.2;
    const pharmaBonus = hasPharma ? 0.5 + injections.length * 0.1 : 0; // Each injectable = +0.1L
    const waterTotal = Math.max(1.5, Math.round((baseWater + trainBonus + fiberFactor + pharmaBonus) * 10) / 10);
    setWaterCalc({ baseWater: Math.round(baseWater * 10) / 10, trainBonus, fiberFactor, pharmaBonus, total: waterTotal, hasPharma });

    setGenerated(true);
    // Scroll to results
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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
    setCheatMealPlan({
      items, totalKcal: tot, cals,
      note: 'Читмил ПОСЛЕ тяжёлой тренировки. Не более 1500 ккал. Вернуться к обычному рациону без компенсации.',
      principles: [
        '🍔 Читмил = психологическая разгрузка + метаболический всплеск',
        '⏰ Только ПОСЛЕ тяжёлой тренировки (не в день отдыха)',
        '📏 Максимум 1 раз в неделю, не более 1500 ккал за приём',
        '🔄 Не компенсировать на следующий день — вернуться к обычному рациону',
        '💧 Запить водой, не газировкой — меньше натрия и сахара',
      ],
      bju: { kcal: cals, p: Math.round(cals * 0.08 / 4), f: Math.round(cals * 0.40 / 9), c: Math.round(cals * 0.52 / 4) },
      bjuBreakdown: 'Типичное распределение: Ж 35-45% · У 45-55% · Б 5-10%',
      recommendation: goal === 'mass' ? 'Читмил на массе можно чаще — 1-2 раза в неделю, до 20% недельного профицита'
        : goal === 'fat_loss' || goal === 'cutting' ? 'На сушке читмил строго 1 раз в 7-10 дней, контроль жиров'
        : '1 раз в неделю, лучше в самый интенсивный тренировочный день',
    });
  };

  const generateCarbload = () => {
    const carbsPerKg = 8;
    const totalCarbs = Math.round(weight * carbsPerKg);
    const carbFoods = FOOD_DB.filter(f => (f.category === 'carb' || f.category === 'grain') && f.carbs > 20).sort(() => Math.random() - 0.5).slice(0, 5);
    setCarbloadPlan({
      totalCarbs, foods: carbFoods.map(f => ({ name: f.name, carbs: f.carbs, amount: Math.round(totalCarbs * 0.3 / f.carbs * 100) })),
      note: 'За 24-48ч до тяжёлой тренировки. Увеличить воду на 1-1.5л.',
      principles: [
        '🍚 Углеводная загрузка = максимальное заполнение гликогена',
        '⏰ За 24-48 часов до тяжёлой тренировки (присед/становая/жим лёжа)',
        '📏 6-8 г/кг углеводов (низкое ГИ в первые 24ч, высокое ГИ в последние 12ч)',
        '💧 Увеличить воду на 1-1.5 л (гликоген связывает 3-4г воды на 1г)',
        '🧂 Добавить натрий (200-500 мг дополнительно) для удержания воды',
        '⬇ Снизить жиры до 0.5 г/кг в дни загрузки для лучшего усвоения углеводов',
      ],
      bju: {
        c: totalCarbs, p: Math.round(effectiveP),
        f: Math.round(weight * 0.5),
        kcal: totalCarbs * 4 + Math.round(effectiveP) * 4 + Math.round(weight * 0.5) * 9,
      },
    });
  };

  const generateBUTCH = () => {
    const highCarb = Math.round(effectiveC * 1.3);
    const lowCarb = Math.round(effectiveC * 0.5);
    setButchPlan({
      pattern: trainingDays.filter(Boolean).length + ' тренировочных + ' + trainingDays.filter(d => !d).length + ' отдых',
      highCarb, lowCarb, protein: effectiveP,
      fatHigh: Math.round(effectiveF * 0.8), fatLow: Math.round(effectiveF * 1.2),
      note: 'Цикл: ' + trainingDays.filter(Boolean).length + ' дня ВУ (тренировочные) + ' + trainingDays.filter(d => !d).length + ' дня НУ (отдых). Белок всегда высокий.',
      principles: [
        '⤴️⤵️ БУЧ = белково-углеводное чередование для жиросжигания + сохранения мышц',
        '📊 ВУ дни: углеводы +30% → гликоген + энергия на тренировку',
        '📊 НУ дни: углеводы -50% → переключение на жиры как источник энергии',
        '💪 Белок ВСЕГДА высокий (2-2.5 г/кг) — защита мышц в НУ дни',
        '🧈 Жиры: в ВУ дни 0.8× нормы, в НУ дни 1.2× нормы',
        '🔄 Типичный цикл: 2-3 дня ВУ → 1-2 дня НУ (подбирается индивидуально)',
        '⏳ Максимум 4 недели БУЧ, затем переход на сбалансированное питание',
      ],
      bjuHigh: { c: highCarb, p: effectiveP, f: Math.round(effectiveF * 0.8), kcal: effectiveP * 4 + Math.round(effectiveF * 0.8) * 9 + highCarb * 4 },
      bjuLow: { c: lowCarb, p: effectiveP, f: Math.round(effectiveF * 1.2), kcal: effectiveP * 4 + Math.round(effectiveF * 1.2) * 9 + lowCarb * 4 },
    });
  };

  const generateRecommendations = () => {
    const recs: string[] = [];
    // Goal-based
    if (goal === 'mass') {
      recs.push('💪 МАССОНАБОР: Профицит 300-500 ккал. Белок 1.8-2.2г/кг. Углеводы 4-5г/кг. Основные приёмы до/после тренировки.');
      recs.push('📈 Рост: 0.5-1% веса в неделю. Если вес не растёт 2 недели — +200 ккал. Контролировать калорийность каждые 3 дня.');
      recs.push('⏰ Тайминг: 40% углеводов до/после тренировки. Казеин (творог) перед сном для антикатаболического эффекта.');
    }
    if (goal === 'fat_loss' || goal === 'cutting') {
      recs.push('🔥 ПОХУДЕНИЕ: Дефицит 300-500 ккал. Белок 2.5г/кг — критически важен для сохранения мышц.');
      recs.push('🥦 Стратегия: 80% углеводов вокруг тренировки. Овощи с каждым приёмом (клетчатка + объём).');
      recs.push('📉 Темп: -0.5-1% веса в неделю. Если плато 2+ недели — пересмотреть дефицит или добавить NEAT (шаги 10k+).');
      recs.push('🔄 Разгрузка: 1 день поддержки каждые 7-10 дней для гормонов щитовидной железы.');
    }
    if (goal === 'strength') {
      recs.push('🏋️ СИЛА: Профицит 200-300 ккал. Углеводы 5-6г/кг в тренировочные дни. Белок 2г/кг.');
      recs.push('⚡ Предтрен: за 1.5-2ч до — 0.5г/кг углеводов + 0.2г/кг белка. Кофеин 3-6 мг/кг за 60 мин.');
      recs.push('🔄 Циклирование: больше углеводов в день ног/спины, меньше в день рук/плеч.');
    }
    if (goal === 'maintenance') {
      recs.push('⚖️ ПОДДЕРЖКА: Калории на уровне TDEE. Баланс макронутриентов 30/20/50 (Б/Ж/У).');
      recs.push('📊 Контроль: взвешивание 1 раз в неделю. Если вес отклоняется >2% — коррекция на 150-200 ккал.');
    }
    if (goal === 'recomposition') {
      recs.push('🔄 РЕКОМПОЗИЦИЯ: Калории на уровне TDEE или лёгкий дефицит (-100-200). Белок 2.5г/кг.');
      recs.push('📈 Условия: новички/возвращающиеся после перерыва/фарма. Только с силовыми тренировками.');
    }
    if (goal === 'rehab') {
      recs.push('🩹 РЕАБИЛИТАЦИЯ: Белок 2.5-3г/кг. ВСАА 15-20г/день. Глютамин 10-20г/день. Омега-3 3-5г/день.');
      recs.push('🧊 Противовоспалительные: куркума, имбирь, зеленый чай. Ограничить сахар/трансжиры.');
    }
    // Phase-based
    if (phase === 'course') recs.push('💉 Курс: повышенный белок 2.5г/кг, контроль печени (расторопша, артишок), вода 40мл/кг.');
    if (phase === 'bridge') recs.push('🌉 Мост: калории на поддержание, белок 2г/кг, контроль эстрадиола, добавки для суставов.');
    if (phase === 'pct') recs.push('🔄 ПКТ: белок 2.2г/кг, цинк 50мг, витамин D 5000МЕ, магний, DAA для восстановления оси.');
    if (phase === 'cutting') recs.push('✂️ Сушка: дробное питание 5-6 раз, контроль натрия, увеличить клетчатку для насыщения.');
    if (phase === 'recovery') recs.push('🩹 Восстановление: повышенный белок 2.5г/кг, глютамин, антиоксиданты.');
    if (phase === 'fat_loss') recs.push('🔥 Похудение: дефицит 300-500 ккал, белок 2.5г/кг, большая часть углеводов вокруг тренировки.');
    if (phase === 'post_cut') recs.push('📈 Выход из сушки: плавное +200 ккал/нед, обратная метаболическая, контроль отёков.');
    // Plan type
    if (planType === 'keto') {
      recs.push('🥑 КЕТО: Контроль электролитов (натрий 5-7г, калий 3-5г, магний 400-600мг). Адаптация 2-4 недели.');
      recs.push('💧 Вода: 3-4 литра (кетоз увеличивает диурез). Бульоны для электролитов.');
      recs.push('📊 Цели: жиры 70-80%, белок 20-25%, углеводы <5% (до 30г/день).');
    }
    if (planType === 'highcarb') recs.push('🍚 ВЫСОКОУГЛЕВОДНАЯ: 60% углеводов. Подходит при интенсивных тренировках и высокой NEAT.');
    if (planType === 'mediterranean') recs.push('⚖️ СРЕДИЗЕМНОМОРСКАЯ: Рыба 2-3 раза/нед, оливковое масло, овощи, бобовые. Снижение воспаления.');
    if (planType === 'vegetarian') recs.push('🌱 ВЕГЕТАРИАНСКАЯ: Контроль B12, железа, цинка, омега-3 (льняное/чиа). Комбинация злаков+бобовых.');
    // Allergens
    if (allergens.length > 0) recs.push(`⚠ Аллергены: исключены: ${allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}. Проверяйте скрытые источники в соусах/добавках.`);
    // Training link
    if (linkToTraining) recs.push(`🏋️ Привязка: Тренировка ${trainStart}-${trainEnd}. Предтрен за 1.5-2ч (0.5г/кг угл + 0.2г/кг). Пост-трен в течение 60-90мин (0.4г/кг угл + 0.3г/кг белка).`);
    // Cycling
    if (cyclingMode === 'macro') recs.push('🔄 Циклирование макросов: тренировочные дни +15% ккал/+30% угл. Дни отдыха -15% ккал/-30% угл. Белок постоянный.');
    if (cyclingMode === 'butch') recs.push('⤴️⤵️ БУЧ: следить за энергией в низкоуглеводные дни. Возможна вялость. Пить больше воды в НУ дни.');
    if (cyclingMode === 'carbload') recs.push('🍚 Углеводная загрузка: 8г/кг за 24-48ч до тяжёлой тренировки. +1-1.5л воды. Снизить жиры до 0.5г/кг.');
    // Budget
    if (budget === 'low') recs.push('💰 Бюджет: яйца, курица (окорочка/бедро), рис, картофель, макароны, капуста, морковь, яблоки, сезонные овощи — основа. Протеин сывороточный — минимально необходим.');
    if (budget === 'medium') recs.push('💰 Средний: филе курицы/индейки, говядина фарш, рис басмати, гречка, творог 5%, греческий йогурт, оливковое масло.');
    if (budget === 'max') recs.push('💰 Премиум: лосось, мраморная говядина, фермерские яйца, киноа, авокадо, ягоды, миндаль, кокосовое масло.');
    if (budget === 'enhanced') recs.push('💰 Элитный: вагю, дикий лосось, органические продукты, трюфель, спаржа, голубика, макадамия, чёрный рис.');
    // Drugs specific
    if (injections.length > 0) {
      const hasInsulin = injections.some(i => i.type === 'инсулин');
      const hasGH = injections.some(i => i.type === 'ГР' || i.type === 'GHRP' || i.type === 'CJC');
      const hasGLP = injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид');
      if (hasInsulin) recs.push('💉 Инсулин: обязательный контроль углеводов — минимум 150г/день. Быстрые углеводы (декстроза, сок) под рукой. Не тренироваться на пустой желудок.');
      if (hasGH) recs.push('🧬 Гормон роста: избегать углеводов в окне 30мин до/после укола ГР. Увеличить воду на 0.5-1л.');
      if (hasGLP) recs.push('💊 GLP-1: дробное питание 5-6 раз маленькими порциями. Избегать жирного. Контроль тошноты.');
      recs.push('💉 Фарма поддержка: добавки для печени (расторопша, артишок, NAC), контроль давления, электролиты.');
    }
    // Water
    const hasPharmaRec = injections.length > 0 || (courseEntries?.length || 0) > 0;
    if (hasPharmaRec) recs.push('💧 Гидратация на фарме: 40 мл/кг + 0.5л на каждую инъекцию. Контроль отёков — калий 4000-5000 мг, магний 500-600 мг.');
    // Steps
    if (dailySteps < 5000) recs.push('🚶 NEAT: текущие шаги <5000 — низкая активность. Цель 8-10k шагов для ускорения метаболизма.');
    if (dailySteps >= 10000) recs.push('🚶 Отлично! 10k+ шагов поддерживают высокий NEAT. Контролировать восстановление ног.');
    // General tips
    recs.push('✅ Общие правила: белковая пища с каждым приёмом. Овощи 300-500г/день. Вода 2.5-4л. Сон 7-9ч. Постепенные изменения без экстрима.');
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

  const [mealPrepDays, setMealPrepDays] = useState<1 | 3 | 7>(1);

  const generateMealPrep = () => {
    const prepSource = mealPrepDays === 1 ? dayPlan : mealPrepDays === 3 ? threeDayPlan : weekPlan;
    if (!prepSource) { generatePlan(mealPrepDays as 1|3|7); if (!prepSource) return; }
    const days = mealPrepDays === 1 ? [dayPlan] : mealPrepDays === 3 ? threeDayPlan.days : weekPlan.days;
    if (!days) return;
    const steps: MealPrepStep[] = [];
    let stepNum = 1;
    const allItems = days.flatMap((d: any) => d.meals.flatMap((m: any) => m.items.map((it: any) => ({ ...it, mealLabel: m.label, mealTime: m.time }))));
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
    const mealCount = days[0]?.meals?.length || dayPlan?.meals?.length || 4;
    steps.push({
      step: stepNum++, action: `Разложить по ${mealCount} контейнерам (по приёмам)`,
      duration: 12, items: [`${mealCount} контейнеров × ${mealPrepDays} дня(ей) = ${mealCount * mealPrepDays} порций`],
    });

    // Step 8: Label and organize
    steps.push({
      step: stepNum++, action: 'Подписать контейнеры (день + приём пищи), убрать в холодильник/морозилку',
      duration: 5, items: ['Холодильник: 3 дня', 'Морозилка: остальное'],
    });

    const totalTime = steps.reduce((s, st) => s + st.duration, 0);
    setMealPrepPlan({ steps, totalTime, containers: mealCount * mealPrepDays });
  };

  // ─── Report Generators ───
  const [activeReports, setActiveReports] = useState<string[]>([]);
  const [allergenReport, setAllergenReport] = useState<{ conflicts: { food: string; allergens: string[] }[]; riskLevel: 'low' | 'medium' | 'high'; summary: string } | null>(null);
  const [nutrientReport, setNutrientReport] = useState<{ micros: Record<string, { actual: number; target: number; pct: number; status: string }>; gaps: string[] } | null>(null);
  const [qualityReport, setQualityReport] = useState<{ avgScore: number; bestItems: string[]; weakItems: string[]; recommendations: string[] } | null>(null);
  const [riskReport, setRiskReport] = useState<{ systems: Record<string, { score: number; impact: string; recommendation: string }>; totalRisk: string; summary: string } | null>(null);
  const [drugCompatReport, setDrugCompatReport] = useState<{ interactions: { drug: string; food: string; effect: string; severity: 'low' | 'medium' | 'high' }[]; warnings: string[] } | null>(null);

  const generateAllergenReport = () => {
    if (!dayPlan) return;
    const conflicts: { food: string; allergens: string[] }[] = [];
    const allItems = dayPlan.meals.flatMap((m: any) => m.items);
    allItems.forEach((it: any) => {
      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
      if (food?.allergens) {
        const matched = food.allergens.filter(a => allergens.includes(a));
        if (matched.length > 0) conflicts.push({ food: it.name, allergens: matched });
      }
    });
    const riskLevel: 'low' | 'medium' | 'high' = conflicts.length === 0 ? 'low' : conflicts.length <= 3 ? 'medium' : 'high';
    const summary = conflicts.length === 0
      ? '✅ Рацион не содержит выбранных аллергенов'
      : `⚠ Обнаружено ${conflicts.length} совпадений с аллергенами. ${riskLevel === 'high' ? 'Требуется замена продуктов!' : 'Рекомендуется замена.'}`;
    setAllergenReport({ conflicts, riskLevel, summary });
    setActiveReports(prev => prev.includes('allergen') ? prev : [...prev, 'allergen']);
  };

  const generateNutrientReport = () => {
    if (!dayPlan) return;
    const totals: Record<string, number> = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    const micros: Record<string, number> = {};
    const allItems = dayPlan.meals.flatMap((m: any) => m.items);
    allItems.forEach((it: any) => {
      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
      if (!food) return;
      totals.kcal += it.kcal || 0;
      totals.protein += it.p || 0;
      totals.fat += it.f || 0;
      totals.carbs += it.c || 0;
      totals.fiber += (food.fiber || 0) * (it.amount / 100);
      if (food.micros) {
        Object.entries(food.micros).forEach(([k, v]) => {
          if (v) micros[k] = (micros[k] || 0) + (v as number) * (it.amount / 100);
        });
      }
    });
    const microTargets: Record<string, number> = { Ca: 1000, Fe: 18, Mg: 400, Zn: 15, K: 3500, Se: 55, VitC: 100, VitD: 15, VitB12: 2.4, Omega3: 1.6 };
    const microResults: Record<string, { actual: number; target: number; pct: number; status: string }> = {};
    const gaps: string[] = [];
    Object.entries(microTargets).forEach(([k, target]) => {
      const actual = Math.round((micros[k] || 0) * 10) / 10;
      const pct = Math.round(actual / target * 100);
      const status = pct >= 80 ? 'ok' : pct >= 50 ? 'low' : 'critical';
      microResults[k] = { actual, target, pct, status };
      if (status !== 'ok') gaps.push(`${k}: ${actual} из ${target} (${pct}%)`);
    });
    const gapsText = gaps.length === 0 ? ['✅ Все микрнутриенты в норме'] : gaps;
    setNutrientReport({ micros: microResults, gaps: gapsText });
    setActiveReports(prev => prev.includes('nutrient') ? prev : [...prev, 'nutrient']);
  };

  const generateQualityReport = () => {
    if (!dayPlan) return;
    const allItems = dayPlan.meals.flatMap((m: any) => m.items);
    const scores: { name: string; score: number; category: string }[] = [];
    allItems.forEach((it: any) => {
      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
      if (!food) return;
      let score = 5;
      const proteinDensity = (food.protein * 4) / Math.max(food.kcal, 1);
      if (proteinDensity > 0.6) score += 2;
      else if (proteinDensity > 0.3) score += 1;
      if ((food.fiber || 0) >= 3) score += 1;
      if (food.tier === 'max') score = 10;
      else if (food.tier === 'mid') score = Math.max(score, 8);
      else if (food.tier === 'basic') score = Math.max(score, 6);
      scores.push({ name: it.name, score: Math.min(10, score), category: food.category });
    });
    const avgScore = Math.round(scores.reduce((s, x) => s + x.score, 0) / Math.max(1, scores.length) * 10) / 10;
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const bestItems = sorted.filter(s => s.score >= 8).map(s => s.name).slice(0, 5);
    const weakItems = sorted.filter(s => s.score <= 5).map(s => s.name).slice(0, 5);
    const recommendations: string[] = [];
    if (avgScore < 6) recommendations.push('Повысьте качество: добавьте постное мясо, рыбу, свежие овощи');
    if (scores.filter(s => s.score <= 5).length > 2) recommendations.push('Замените обработанные продукты на цельные');
    if (avgScore >= 8) recommendations.push('Отличный выбор продуктов!');
    setQualityReport({ avgScore, bestItems, weakItems, recommendations });
    setActiveReports(prev => prev.includes('quality') ? prev : [...prev, 'quality']);
  };

  const generateRiskReport = () => {
    if (!dayPlan) return;
    const systems: Record<string, { score: number; impact: string; recommendation: string }> = {};
    const allItems = dayPlan.meals.flatMap((m: any) => m.items);
    const totalFat = allItems.reduce((s: number, it: any) => s + (it.f || 0), 0);
    const totalSodium = allItems.reduce((s: number, it: any) => {
      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
      return s + ((food?.micros?.Na || 0) * (it.amount / 100));
    }, 0);
    const totalFiber = allItems.reduce((s: number, it: any) => {
      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
      return s + ((food?.fiber || 0) * (it.amount / 100));
    }, 0);
    const totalProtein = allItems.reduce((s: number, it: any) => s + (it.p || 0), 0);
    const totalKcal = allItems.reduce((s: number, it: any) => s + (it.kcal || 0), 0);

    // Hepatic risk (high fat → liver stress)
    const fatPct = totalKcal > 0 ? totalFat * 9 / totalKcal * 100 : 0;
    const hepaticScore = fatPct > 40 ? 7 : fatPct > 30 ? 5 : fatPct > 20 ? 3 : 1;
    systems.hepatic = { score: hepaticScore, impact: fatPct > 35 ? 'Высокожировая диета' : 'Умеренные жиры', recommendation: fatPct > 35 ? 'Снизить долю жиров до 25-30%' : 'В норме' };

    // Renal risk (high protein → kidney stress)
    const proteinGPerKg = Math.round((totalProtein / weight) * 10) / 10;
    const renalScore = proteinGPerKg > 3 ? 7 : proteinGPerKg > 2.5 ? 5 : proteinGPerKg > 2 ? 3 : 1;
    systems.renal = { score: renalScore, impact: `${proteinGPerKg.toFixed(1)} г/кг белка`, recommendation: proteinGPerKg > 2.5 ? 'Контроль белка, поддержание гидратации' : 'Белок в норме' };

    // Inflammatory risk (omega 6/3 balance, processed foods)
    const processedCount = allItems.filter((it: any) => {
      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
      return food?.category === 'fast_food' || food?.gi && food.gi >= 80;
    }).length;
    const inflamScore = processedCount > 5 ? 7 : processedCount > 3 ? 5 : processedCount > 1 ? 3 : 1;
    systems.inflammatory = { score: inflamScore, impact: `${processedCount} продукт(ов) с высоким ГИ/обработанных`, recommendation: inflamScore > 3 ? 'Добавить омега-3 (рыба, льняное масло), снизить ГИ' : 'Противовоспалительный профиль хороший' };

    // Insulin risk (high carbs + simple sugars)
    const carbGPerMeal = effectiveC / Math.max(1, dayPlan.meals.length);
    const insulinScore = carbGPerMeal > 80 ? 7 : carbGPerMeal > 60 ? 5 : carbGPerMeal > 40 ? 3 : 1;
    systems.insulin = { score: insulinScore, impact: `~${Math.round(carbGPerMeal)} г углеводов/приём`, recommendation: insulinScore > 3 ? 'Распределить углеводы равномерно, добавить клетчатку' : 'Гликемическая нагрузка в норме' };

    // Electrolyte risk
    const sodiumPerKcal = totalKcal > 0 ? totalSodium / totalKcal * 1000 : 0;
    const electrolyteScore = sodiumPerKcal > 2 ? 5 : sodiumPerKcal > 1 ? 3 : 1;
    systems.electrolyte = { score: electrolyteScore, impact: `Na: ${Math.round(totalSodium)} мг/день`, recommendation: electrolyteScore > 3 ? 'Контроль соли, увел. калия (овощи, картофель)' : 'Электролиты в балансе' };

    const totalScore = Object.values(systems).reduce((s, sys) => s + sys.score, 0);
    const totalRisk = totalScore <= 8 ? 'Низкий' : totalScore <= 14 ? 'Средний' : 'Высокий';
    const summary = totalRisk === 'Низкий'
      ? '✅ Рацион сбалансирован, риски минимальны'
      : totalRisk === 'Средний'
        ? '⚠ Есть зоны для улучшения. Обратите внимание на рекомендации.'
        : '🔴 Требуется коррекция рациона. Высокая нагрузка на организм.';

    setRiskReport({ systems, totalRisk, summary });
    setActiveReports(prev => prev.includes('risk') ? prev : [...prev, 'risk']);
  };

  const generateDrugCompatReport = () => {
    if (!dayPlan || injections.length === 0) return;
    const interactions: { drug: string; food: string; effect: string; severity: 'low' | 'medium' | 'high' }[] = [];
    const warnings: string[] = [];
    const allItems = dayPlan.meals.flatMap((m: any) => m.items);

    injections.forEach(inj => {
      const t = inj.type.toLowerCase();
      if (t.includes('инсулин')) {
        const totalCarbs = dayPlan.totals.c || 0;
        if (totalCarbs < 150) warnings.push(`💉 Инсулин (${inj.name}): всего ${Math.round(totalCarbs)}г углеводов/день — риск гипогликемии. Минимум 150г/день.`);
        const fastCarbs = allItems.filter((it: any) => {
          const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
          return food?.gi && food.gi >= 80;
        });
        if (fastCarbs.length === 0) warnings.push('Нет быстрых углеводов для покрытия инсулина. Добавьте рис/банан/декстрозу после укола.');
        allItems.forEach((it: any) => {
          const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
          if (food?.gi && food.gi >= 85) interactions.push({ drug: inj.name, food: it.name, effect: 'Резкий скачок глюкозы', severity: 'high' });
        });
      }
      if (t.includes('гр') || t.includes('gh')) {
        const mealAtInjTime = dayPlan.meals.find((m: any) => {
          const h = parseInt(m.time.split(':')[0]);
          const ih = parseInt(inj.time.split(':')[0]);
          return Math.abs(h - ih) <= 1;
        });
        if (mealAtInjTime && mealAtInjTime.totals.c > 10) {
          interactions.push({ drug: inj.name, food: 'Углеводы в окне ГР', effect: 'Снижение эффекта ГР', severity: 'medium' });
          warnings.push('В окне ГР (30мин до/после) избегайте углеводов.');
        }
      }
      if (t.includes('ифр') || t.includes('igf') || t.includes('mgf')) {
        const mealAtInjTime = dayPlan.meals.find((m: any) => {
          const h = parseInt(m.time.split(':')[0]);
          const ih = parseInt(inj.time.split(':')[0]);
          return Math.abs(h - ih) <= 1;
        });
        if (mealAtInjTime && mealAtInjTime.totals.p < 30) {
          warnings.push(`🧬 ${inj.name}: в окне ИФР-1 нужно ≥30г белка. Приём ${mealAtInjTime.time} содержит ${Math.round(mealAtInjTime.totals.p)}г.`);
        }
      }
      if (t.includes('семаглутид') || t.includes('тирзепатид')) {
        warnings.push('💊 Агонисты GLP-1: еда маленькими порциями, избегать жирного. Контроль тошноты.');
        const fattyMeals = dayPlan.meals.filter((m: any) => (m.totals.f || 0) > 20);
        if (fattyMeals.length > 0) interactions.push({ drug: inj.name, food: `${fattyMeals.length} приёмов с >20г жиров`, effect: 'Замедление опорожнения желудка, тошнота', severity: 'medium' });
      }
    });

    if (warnings.length === 0) warnings.push('✅ Все препараты совместимы с рационом');
    setDrugCompatReport({ interactions, warnings });
    setActiveReports(prev => prev.includes('drug') ? prev : [...prev, 'drug']);
  };

  // ─── Render ───
  const renderMealList = (dayData: any, editable = false) => {
    if (!dayData) return null;
    const d = dayData;
    const totalKcal = Math.round(d.totals?.kcal || 0);
    const totalP = Math.round(d.totals?.p || 0);
    const totalF = Math.round(d.totals?.f || 0);
    const totalC = Math.round(d.totals?.c || 0);
    const pKcalPct = totalKcal > 0 ? (totalP * 4 / totalKcal) * 100 : 0;
    const fKcalPct = totalKcal > 0 ? (totalF * 9 / totalKcal) * 100 : 0;
    const cKcalPct = totalKcal > 0 ? (totalC * 4 / totalKcal) * 100 : 0;
    return (
      <div>
        {/* Day header — card with gradient badge */}
        <div style={{
          marginBottom: 10, borderRadius: 12, overflow: 'hidden',
          border: d.isTrainingDay ? '1px solid rgba(0,230,138,0.2)' : '1px solid #27272a',
        }}>
          <div style={{
            padding: '10px 12px',
            background: d.isTrainingDay ? 'linear-gradient(135deg, rgba(0,230,138,0.1), rgba(0,200,160,0.03))' : '#202023',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 20,
                filter: d.isTrainingDay ? 'none' : 'grayscale(0.5)',
              }}>{d.isTrainingDay ? '🏋️' : '😴'}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 12, fontWeight: 800,
                  color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.3px',
                }}>
                  {d.isTrainingDay ? '🏆 ТРЕНИРОВОЧНЫЙ ДЕНЬ' : '🛌 ДЕНЬ ОТДЫХА'}
                </div>
              </div>
              {/* Day total big number */}
              <div style={{
                padding: '4px 10px', borderRadius: 8,
                background: d.isTrainingDay ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                border: d.isTrainingDay ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#00e68a', lineHeight: 1 }}>{totalKcal}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>ккал</div>
              </div>
            </div>
            {/* Day macro summary row */}
            <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>💪 {totalP}г Б</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>🧈 {totalF}г Ж</span>
              <span style={{ color: '#f97316', fontWeight: 600 }}>🌾 {totalC}г У</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)' }}>
                {weight > 0 ? `${Math.round(totalP / weight)}г/кг` : ''}
              </span>
            </div>
          </div>
          {/* Macro distribution thin bar */}
          <div style={{ height: 4, display: 'flex' }}>
            <div style={{ height: '100%', width: `${Math.max(2, pKcalPct)}%`, background: '#3b82f6', minWidth: 2 }} />
            <div style={{ height: '100%', width: `${Math.max(2, fKcalPct)}%`, background: '#f59e0b', minWidth: 2 }} />
            <div style={{ height: '100%', width: `${Math.max(2, cKcalPct)}%`, background: '#f97316', minWidth: 2, flex: 1 }} />
          </div>
        </div>

        {/* Allergens */}
        {d.allergenWarnings?.length > 0 && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 8, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10 }}>⚠️</span>
            <span>{d.allergenWarnings.join('; ')}</span>
          </div>
        )}

        {/* Meals */}
        {d.meals.map((m: any, mi: number) => {
          const mealKcal = Math.round(m.totals?.kcal || 0);
          const mealP = Math.round(m.totals?.p || 0);
          const mealF = Math.round(m.totals?.f || 0);
          const mealC = Math.round(m.totals?.c || 0);
          const isPreWorkout = m.label?.toLowerCase().includes('предтрен');
          const isPostWorkout = m.label?.toLowerCase().includes('пост-трен');
          const accentColor = isPreWorkout ? '#8b5cf6' : isPostWorkout ? '#f59e0b' : '#00e68a';
          return (
            <div key={mi} style={{
              marginBottom: 6, borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${isPreWorkout ? 'rgba(139,92,246,0.2)' : isPostWorkout ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.2s',
            }}>
              {/* Meal header */}
              <div style={{
                padding: '7px 10px 5px',
                background: isPreWorkout ? 'rgba(139,92,246,0.06)' : isPostWorkout ? 'rgba(245,158,11,0.06)' : '#202023',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.3)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>{m.time}</span>
                  <span style={{
                    width: 3, height: 12, borderRadius: 2,
                    background: accentColor,
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: accentColor }}>{m.label}</span>
                  {isPreWorkout && <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#a855f7', fontWeight: 600 }}>ДО</span>}
                  {isPostWorkout && <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>ПОСЛЕ</span>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>{mealKcal} ккал</span>
              </div>
              {/* Meal items */}
              <div style={{ padding: '6px 10px 8px', background: '#18181b' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {m.items.map((it: any, ii: number) => (
                    <span key={ii} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 8,
                      background: '#202023',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.7)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ fontWeight: 600 }}>{it.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 7 }}>{it.amount}г</span>
                      <span onClick={() => addToCart({ name: it.name, kcal: it.kcal * (it.amount / 100), amount: it.amount, category: it.category })} style={{ cursor:'pointer', fontSize:7, color:'#00e68a', opacity:0.35, padding:'0 2px', transition:'opacity 0.15s' }} title="В корзину">🛒</span>
                    </span>
                  ))}
                </div>
                {/* Meal micro-macros row */}
                {m.totals && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 7 }}>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>Б {mealP}г</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Ж {mealF}г</span>
                    <span style={{ color: '#f97316', fontWeight: 600 }}>У {mealC}г</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
                      {(() => {
                        const mp = mealKcal > 0 ? (mealP * 4 / mealKcal * 100) : 0;
                        const mf = mealKcal > 0 ? (mealF * 9 / mealKcal * 100) : 0;
                        const mc = mealKcal > 0 ? (mealC * 4 / mealKcal * 100) : 0;
                        return `${Math.round(mp)}/${Math.round(mf)}/${Math.round(mc)}%`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Day totals — modern summary card */}
        <div style={{
          marginTop: 8, borderRadius: 10, overflow: 'hidden',
          border: '1px solid rgba(0,230,138,0.15)',
        }}>
          <div style={{
            padding: '10px 12px',
            background: 'linear-gradient(135deg, rgba(0,230,138,0.06), transparent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>ИТОГО ЗА ДЕНЬ</span>
              <span style={{ color: '#00e68a', fontWeight: 900, fontSize: 16 }}>{totalKcal} ккал</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Белки', val: totalP, unit: 'г', color: '#3b82f6', target: effectiveP },
                { label: 'Жиры', val: totalF, unit: 'г', color: '#f59e0b', target: effectiveF },
                { label: 'Углеводы', val: totalC, unit: 'г', color: '#f97316', target: effectiveC },
              ].map(m => {
                const pct = Math.min(100, Math.round(m.val / Math.max(1, m.target) * 100));
                const isOver = pct > 100;
                return (
                  <div key={m.label} style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                      <span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span>
                      <span style={{ color: isOver ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                        {m.val}/{m.target}{m.unit}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: '#202023', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 3,
                        background: isOver ? '#ef4444' : `linear-gradient(90deg, ${m.color}, ${m.color}88)`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 7, color: isOver ? '#ef4444' : 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 1 }}>
                      {isOver ? `+${pct - 100}%` : `${pct}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>

      {/* 1. User info card */}
      <GlassCard title="Пользователь" icon="👤" color="#a78bfa">
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
      <GlassCard title="Цель" icon="🎯" color="#00e68a">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {GOALS.map(g => (
            <PillBtn key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)} color={goal === g.id ? '#00e68a' : undefined}>
              {g.icon} {g.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      {/* 3. Phase + drugs card */}
      <GlassCard title="Фаза и препараты" icon="💉" color="#06b6d4">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {PHASES.map(p => (
            <PillBtn key={p.id} active={phase === p.id} onClick={() => setPhase(p.id)}>{p.icon} {p.label}</PillBtn>
          ))}
        </div>
        {courseEntries.length > 0 && (
          <div style={{ fontSize: 8, color: '#8b5cf6', marginBottom: 4, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.08)', display: 'inline-block' }}>
            📋 Препараты автоматически загружены из фармы ({courseEntries.length})
          </div>
        )}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Инъекции {courseEntries.length > 0 ? '(можно добавить ещё)' : '(добавьте препараты курса)'}:</div>
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
      <GlassCard title="Привязка к тренировке" icon="🏋️" color="#22c55e">
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
          <>
            <div style={{ display: 'flex', gap: 4, fontSize: 9, marginBottom: 6 }}>
              <div><label style={{ color: 'rgba(255,255,255,0.3)' }}>Начало</label><input type="time" value={trainStart} onChange={e => setTrainStart(e.target.value)} style={inputStyle} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.3)' }}>Конец</label><input type="time" value={trainEnd} onChange={e => setTrainEnd(e.target.value)} style={inputStyle} /></div>
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Выберите тренировочные дни:</div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {DAY_LABELS.map((label, idx) => {
                  const isTrain = trainingDays[idx];
                  return (
                    <button key={idx} onClick={() => {
                      setTrainingDays(prev => prev.map((d, i) => i === idx ? !d : d));
                    }} style={{
                      width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                      border: isTrain ? '2px solid #22c55e' : '2px solid #3f3f46',
                      background: isTrain ? 'rgba(34,197,94,0.2)' : '#202023',
                      color: isTrain ? '#22c55e' : 'rgba(255,255,255,0.4)',
                      fontSize: 9, fontWeight: isTrain ? 800 : 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>{label}</button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </GlassCard>

      {/* 5. Editable KBJU card */}
      <GlassCard title="КБЖУ" icon="📊" color="#00e68a">
        {!editMode ? (
          <div>
            {/* Big macro tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
              {[
                { l:'Калории', v: effectiveKcal, c:'#00e68a', unit:'ккал', perKg: Math.round(effectiveKcal / weight) },
                { l:'Белки', v: effectiveP, c:'#3b82f6', unit:'г', perKg: Math.round(effectiveP / weight) },
                { l:'Жиры', v: effectiveF, c:'#f59e0b', unit:'г', perKg: Math.round(effectiveF / weight) },
                { l:'Углеводы', v: effectiveC, c:'#f97316', unit:'г', perKg: Math.round(effectiveC / weight) },
              ].map(m => {
                const pct = effectiveKcal > 0 && m.l !== 'Калории'
                  ? Math.round(({ 'Белки': effectiveP * 4, 'Жиры': effectiveF * 9, 'Углеводы': effectiveC * 4 }[m.l] || 0) / effectiveKcal * 100)
                  : null;
                return (
                  <div key={m.l} style={{
                    textAlign:'center', borderRadius:10, padding:'8px 4px',
                    background: `linear-gradient(135deg, ${m.c}12, transparent)`,
                    border: `1px solid ${m.c}25`,
                    position:'relative', overflow:'hidden',
                  }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: m.c }} />
                    <div style={{ fontSize:18, fontWeight:800, color:m.c, lineHeight:1.2 }}>{m.v}</div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{m.unit}</div>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.25)', marginTop:1 }}>
                      {m.perKg} / кг
                      {pct !== null && ` · ${pct}%`}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Macro distribution bar */}
            {(() => {
              const pKcal = effectiveP * 4;
              const fKcal = effectiveF * 9;
              const cKcal = effectiveC * 4;
              const total = pKcal + fKcal + cKcal || 1;
              const pPct = pKcal / total * 100;
              const fPct = fKcal / total * 100;
              const cPct = cKcal / total * 100;
              return (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Распределение макронутриентов</div>
                  <div style={{ height: 8, borderRadius: 4, background: '#202023', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: `${pPct}%`, background: '#3b82f6', transition: 'width 0.3s', minWidth: 2 }} title={`Белки ${Math.round(pPct)}%`} />
                    <div style={{ height: '100%', width: `${fPct}%`, background: '#f59e0b', transition: 'width 0.3s', minWidth: 2 }} title={`Жиры ${Math.round(fPct)}%`} />
                    <div style={{ height: '100%', width: `${cPct}%`, background: '#f97316', transition: 'width 0.3s', minWidth: 2 }} title={`Углеводы ${Math.round(cPct)}%`} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 7, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    <span style={{ color: '#3b82f6' }}>● Б {Math.round(pPct)}%</span>
                    <span style={{ color: '#f59e0b' }}>● Ж {Math.round(fPct)}%</span>
                    <span style={{ color: '#f97316' }}>● У {Math.round(cPct)}%</span>
                  </div>
                </div>
              );
            })()}
            <button onClick={() => setEditMode(true)} style={{
              width:'100%', padding:7, borderRadius:8,
              border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.06)',
              color:'#00e68a', fontSize:9, cursor:'pointer', fontWeight:600,
              transition:'all 0.15s',
            }}>
              ✏️ Редактировать
            </button>
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
      <GlassCard title="Уровень бюджета" icon="💰" color="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {BUDGET_LEVELS.map(b => (
            <button key={b.id} onClick={() => setBudget(b.id)} style={{
              padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              background: budget === b.id ? `${b.color}15` : '#202023',
              border: budget === b.id ? `1px solid ${b.color}` : '1px solid #27272a',
              color: budget === b.id ? b.color : 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 11, fontWeight: budget === b.id ? 700 : 500 }}>{b.icon} {b.label}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{b.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 7. Nutrition level */}
      <GlassCard title="Уровень питания" icon="📈" color="#22c55e">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 6, lineHeight: 1.4 }}>
          Множитель калорийности: База ×1.0, Средний ×1.15, Усиление ×1.3, Максимум ×1.5.
          Используется, когда нужен более высокий/низкий калораж без изменения целей.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          {NUTRITION_LEVELS.map(n => (
            <button key={n.id} onClick={() => setNutrLevel(n.id)} style={{
              padding: '8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
              background: nutrLevel === n.id ? 'rgba(0,230,138,0.12)' : '#202023',
              border: nutrLevel === n.id ? '1px solid #00e68a' : '1px solid #27272a',
              color: nutrLevel === n.id ? '#00e68a' : 'rgba(255,255,255,0.5)',
              fontWeight: nutrLevel === n.id ? 700 : 500, fontSize: 10,
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 12, marginBottom: 1 }}>{n.icon}</div>
              <div>{n.label}</div>
              <div style={{ fontSize: 7, color: nutrLevel === n.id ? '#00e68a' : 'rgba(255,255,255,0.2)', marginTop: 1 }}>×{n.mult}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 8. Schedule card */}
      <GlassCard title="Расписание" icon="⏰" color="#06b6d4">
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
              <PillBtn key={n} active={mealsCount === n} onClick={() => setMealsCount(n)} color={mealsCount === n ? '#06b6d4' : undefined}>{n}</PillBtn>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* 9. Allergens */}
      <GlassCard title="Аллергены и ограничения" icon="⚠️" color="#ef4444">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ALLERGEN_LIST.map(a => (
            <PillBtn key={a.id} active={allergens.includes(a.id)} onClick={() => toggleAllergen(a.id)} color={allergens.includes(a.id) ? '#ef4444' : undefined}>
              {allergens.includes(a.id) ? '✕ ' : '○ '}{a.icon} {a.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      {/* 10. Plan type */}
      <GlassCard title="Тип плана питания" icon="📋" color="#a855f7">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {PLAN_TYPES.map(pt => (
            <PillBtn key={pt.id} active={planType === pt.id} onClick={() => setPlanType(pt.id)}>
              {pt.icon} {pt.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      {/* 11-12. Food preferences + excluded */}
      <GlassCard title="Предпочтения и исключения" icon="🍎" color="#f59e0b">
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, display: 'block' }}>🌟 Любимые продукты (план будет их чаще использовать):</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
            {preferredFoods.slice(0, 10).map((pf) => {
              const food = FOOD_DB.find(f => f.id === pf);
              return food ? (
                <span key={pf} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {food.name}
                  <span onClick={() => setPreferredFoods(prev => prev.filter(p => p !== pf))} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 7 }}>✕</span>
                </span>
              ) : null;
            })}
          </div>
          <select value="" onChange={e => { const val = e.target.value; if (val && !preferredFoods.includes(val)) { setPreferredFoods([...preferredFoods, val]); localStorage.setItem('he_preferred_foods', JSON.stringify([...preferredFoods, val])); } }} style={{ ...inputStyle, fontSize: 9, padding: '4px 8px', width: '100%' }}>
            <option value="">+ Добавить любимый продукт...</option>
            {FOOD_DB.filter(f => !preferredFoods.includes(f.id)).slice(0, 30).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, display: 'block' }}>🚫 Исключённые продукты:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
            {excludedFoods.map((ef) => {
              const food = FOOD_DB.find(f => f.id === ef);
              return food ? (
                <span key={ef} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {food.name}
                  <span onClick={() => setExcludedFoods(prev => { const upd = prev.filter(p => p !== ef); localStorage.setItem('he_excluded_foods', JSON.stringify(upd)); return upd; })} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 7 }}>✕</span>
                </span>
              ) : null;
            })}
          </div>
          <select value="" onChange={e => { const val = e.target.value; if (val && !excludedFoods.includes(val)) { const upd = [...excludedFoods, val]; setExcludedFoods(upd); localStorage.setItem('he_excluded_foods', JSON.stringify(upd)); } }} style={{ ...inputStyle, fontSize: 9, padding: '4px 8px', width: '100%' }}>
            <option value="">+ Исключить продукт...</option>
            {FOOD_DB.filter(f => !excludedFoods.includes(f.id)).slice(0, 30).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, display: 'block' }}>📝 Дополнительные заметки по питанию:</label>
          <textarea value={customNotes} onChange={e => { setCustomNotes(e.target.value); localStorage.setItem('he_nutrition_notes', e.target.value); }} placeholder="Например: не ем после 20:00, аллергия на пенициллин, проблемы с ЖКТ, не переношу лактозу..." style={{ ...inputStyle, resize: 'vertical', minHeight: 50, fontSize: 9 }} rows={2} />
        </div>
      </GlassCard>

      {/* 13. Cycling mode */}
      <GlassCard title="Циклирование" icon="🔄" color="#3b82f6">
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
        {/* Training day picker for macro/butch */}
        {(cyclingMode === 'macro' || cyclingMode === 'butch') && (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#60a5fa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              📅 Выберите тренировочные дни:
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {DAY_LABELS.map((label, idx) => {
                const isTrain = trainingDays[idx];
                return (
                  <button key={idx} onClick={() => {
                    setTrainingDays(prev => prev.map((d, i) => i === idx ? !d : d));
                  }} style={{
                    width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                    border: isTrain ? '2px solid #22c55e' : '2px solid #3f3f46',
                    background: isTrain ? 'rgba(34,197,94,0.2)' : '#202023',
                    color: isTrain ? '#22c55e' : 'rgba(255,255,255,0.4)',
                    fontSize: 10, fontWeight: isTrain ? 800 : 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
              <span>🏋️ {trainingDays.filter(Boolean).length} тренировочных</span>
              <span>😴 {trainingDays.filter(d => !d).length} выходных</span>
            </div>
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
      <button onClick={() => generatePlan(1)} style={{
        ...greenBtn, fontSize: 14, padding: 14,
        boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
      }}>
        ✨ Сгенерировать план питания
      </button>

      {/* Day/3day/Week selector */}
      <div ref={resultsRef} />
      {generated && (
        <GlassCard title="Варианты отображения" icon="📐" color="#00e68a">
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 1 as const, label: 'На день' },
              { id: 3 as const, label: 'На 3 дня' },
              { id: 7 as const, label: 'Недельный' },
            ].map(v => (
              <button key={v.id} onClick={() => { setPlanDays(v.id); if (v.id === 7 && !weekPlan) generatePlan(7); }} style={{
                flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                background: planDays === v.id ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
                border: planDays === v.id ? 'none' : '1px solid #27272a',
                color: planDays === v.id ? '#000' : 'rgba(255,255,255,0.5)',
                fontWeight: 700, fontSize: 11,
                transition: 'all 0.15s',
              }}>{v.label}</button>
            ))}
          </div>
          {planDays !== 1 && (
            <button onClick={() => generatePlan(planDays)} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>
              🔄 Перегенерировать {planDays === 3 ? '3 дня' : 'неделю'}
            </button>
          )}
        </GlassCard>
      )}

      {/* Results */}
      {generated && planDays === 1 && dayPlan && (
        <GlassCard title="План на день" icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {renderMealList(dayPlan)}
        </GlassCard>
      )}

      {generated && planDays === 3 && threeDayPlan && (
        <GlassCard title="План на 3 дня" icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>📊 Всего: {Math.round(threeDayPlan.totals.kcal)} ккал</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Среднее: {Math.round(threeDayPlan.totals.kcal / 3)} ккал/день</span>
          </div>
          {threeDayPlan.days.map((d: any, di: number) => (
            <div key={di} style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 6,
                padding: '3px 8px', borderRadius: 6,
                background: 'rgba(0,230,138,0.04)', display: 'inline-block',
              }}>
                День {di + 1}
              </div>
              {renderMealList(d)}
            </div>
          ))}
        </GlassCard>
      )}

      {generated && planDays === 7 && weekPlan && (
        <GlassCard title="Недельный план" icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>📊 За неделю: {Math.round(weekPlan.totals.kcal)} ккал</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Среднее: {Math.round(weekPlan.totals.kcal / 7)} ккал/день</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 6, display: 'flex', gap: 6, justifyContent: 'center' }}>
            <span style={{ color: '#3b82f6' }}>● Б: {Math.round(weekPlan.totals.p)}г</span>
            <span style={{ color: '#f59e0b' }}>● Ж: {Math.round(weekPlan.totals.f)}г</span>
            <span style={{ color: '#f97316' }}>● У: {Math.round(weekPlan.totals.c)}г</span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weekPlan.days.map((d: any, di: number) => {
              const wKcal = Math.round(d.totals.kcal);
              const wP = Math.round(d.totals.p);
              const wF = Math.round(d.totals.f);
              const wC = Math.round(d.totals.c);
              const wIsTraining = d.isTrainingDay;
              return (
                <div key={di} style={{
                  padding: 10, borderRadius: 12,
                  background: wIsTraining ? 'rgba(0,230,138,0.03)' : '#202023',
                  border: wIsTraining ? '1px solid rgba(0,230,138,0.15)' : '1px solid #27272a',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{wIsTraining ? '🏋️' : '😴'}</span>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: wIsTraining ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>
                          {DAY_LABELS[di]} · День {di + 1}
                        </span>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', display: 'flex', gap: 4 }}>
                          <span style={{ color: '#3b82f6' }}>Б {wP}</span>
                          <span style={{ color: '#f59e0b' }}>Ж {wF}</span>
                          <span style={{ color: '#f97316' }}>У {wC}</span>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{wKcal} ккал</span>
                  </div>
                  {/* Meal breakdown */}
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                    {d.meals.map((m: any, mi: number) => (
                      <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                        <span style={{ color: '#00e68a', fontWeight: 600, minWidth: 50 }}>{m.time}</span>
                        <span style={{ color: '#00e68a', minWidth: 55 }}>{m.label}</span>
                        <span style={{ flex: 1 }}>{m.items.map((it: any) => it.name).join(', ')}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                          {Math.round(m.totals?.kcal || 0)} ккал
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Save plan button */}
      {generated && (
        <button onClick={saveCurrentPlan} style={{
          ...greenBtn, background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)',
          fontSize: 13, padding: 12,
          boxShadow: '0 4px 16px rgba(139,92,246,0.2)',
        }}>
          💾 Сохранить в мои планы
        </button>
      )}

      {/* 17. Shopping list */}
      {generated && shoppingList && (
        <GlassCard title="Список покупок" icon="🛒" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          {(() => {
            const groups: Record<string, any[]> = {};
            shoppingList.forEach((item: any) => {
              const cat = item.catLabel || item.category || '📦 Прочее';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(item);
            });
            return (
              <>
                <button onClick={() => { shoppingList.forEach((i: any) => addToCart({ name: i.name, kcal: i.kcal || 0, amount: i.amount, category: i.catLabel || i.category })); }} style={{ marginBottom: 8, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%' }}>
                  🛒 Добавить всё в корзину ({shoppingList.length} товаров)
                </button>
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', marginBottom: 2, padding: '2px 0', borderBottom: '1px solid rgba(249,115,22,0.1)' }}>{cat}</div>
                    {items.map((data: any, i: number) => (
                      <div key={data.name + i} style={{ fontSize: 9, padding: '3px 0 3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.6)' }}>
                        <span>{data.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {data.amount >= 1000 ? `${(data.amount / 1000).toFixed(1)} кг` : `${Math.round(data.amount)} г`}
                          </span>
                          <button onClick={() => addToCart({ name: data.name, kcal: data.kcal || 0, amount: data.amount, category: data.catLabel || data.category })} style={{ padding: '2px 4px', borderRadius: 4, border: 'none', background: 'rgba(249,115,22,0.12)', color: '#f97316', cursor: 'pointer', fontSize: 7 }}>🛒</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            );
          })()}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>💾 Сохранить план</button>
        </GlassCard>
      )}

      {/* 18. Water balance */}
      {generated && waterCalc && (
        <GlassCard title="Водный баланс" icon="💧" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
              <span>База: {waterCalc.hasPharma ? '40' : '30'} мл × {weight} кг</span>
              <span>{waterCalc.baseWater} л</span>
            </div>
            {waterCalc.hasPharma && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                <span>+ Фармакология (повышенный метаболизм)</span>
                <span>+{waterCalc.pharmaBonus.toFixed(1)} л</span>
              </div>
            )}
            {waterCalc.trainBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                <span>+ Тренировка</span>
                <span>+{waterCalc.trainBonus} л</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
              <span>+ Клетчатка</span>
              <span>+{waterCalc.fiberFactor} л</span>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#06b6d4', textAlign: 'center', marginTop: 6 }}>
            {waterCalc.total} л/день
          </div>
        </GlassCard>
      )}

      {/* 19. Reports section */}
      {generated && (
        <GlassCard title="Отчёты по рациону" icon="📊" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            <button onClick={generateAllergenReport} style={reportPillStyle('#ef4444', activeReports.includes('allergen') && !!allergenReport)}>⚠️ Аллергены</button>
            <button onClick={generateNutrientReport} style={reportPillStyle('#22c55e', activeReports.includes('nutrient') && !!nutrientReport)}>🧬 Нутриенты</button>
            <button onClick={generateQualityReport} style={reportPillStyle('#f59e0b', activeReports.includes('quality') && !!qualityReport)}>⭐ Качество</button>
            <button onClick={generateRiskReport} style={reportPillStyle('#ef4444', activeReports.includes('risk') && !!riskReport)}>🩺 Риски здоровья</button>
            {injections.length > 0 && <button onClick={generateDrugCompatReport} style={reportPillStyle('#8b5cf6', activeReports.includes('drug') && !!drugCompatReport)}>💉 Совместимость</button>}
            <button onClick={() => {
              generateAllergenReport();
              generateNutrientReport();
              generateQualityReport();
              generateRiskReport();
              if (injections.length > 0) generateDrugCompatReport();
              generateRecommendations();
            }} style={reportPillStyle('#3b82f6', activeReports.length >= 3)}>📋 Общий отчёт</button>
          </div>

          {/* Allergen report */}
          {allergenReport && activeReports.includes('allergen') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: allergenReport.riskLevel === 'high' ? 'rgba(239,68,68,0.06)' : allergenReport.riskLevel === 'medium' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e'}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e' }}>
                {allergenReport.summary}
              </div>
              {allergenReport.conflicts.map((c, i) => (
                <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', padding: '1px 0' }}>
                  • {c.food}: {c.allergens.join(', ')}
                </div>
              ))}
            </div>
          )}

          {/* Nutrient report */}
          {nutrientReport && activeReports.includes('nutrient') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>🧬 Микронутриенты</div>
              {Object.entries(nutrientReport.micros).slice(0, 10).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '1px 0', color: 'rgba(255,255,255,0.6)' }}>
                  <span>{k}</span>
                  <span style={{ color: v.status === 'ok' ? '#22c55e' : v.status === 'low' ? '#f59e0b' : '#ef4444' }}>
                    {v.actual} / {v.target} ({v.pct}%)
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {nutrientReport.gaps.join('; ')}
              </div>
            </div>
          )}

          {/* Quality report */}
          {qualityReport && activeReports.includes('quality') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: qualityReport.avgScore >= 8 ? '#22c55e' : '#f59e0b', marginBottom: 3 }}>
                ⭐ Среднее качество: {qualityReport.avgScore}/10
              </div>
              {qualityReport.bestItems.length > 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>Лучшие: {qualityReport.bestItems.join(', ')}</div>}
              {qualityReport.weakItems.length > 0 && <div style={{ fontSize: 8, color: '#ef4444' }}>Слабые: {qualityReport.weakItems.join(', ')}</div>}
              {qualityReport.recommendations.map((r, i) => <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', padding: '1px 0' }}>• {r}</div>)}
            </div>
          )}

          {/* Risk report */}
          {riskReport && activeReports.includes('risk') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: riskReport.totalRisk === 'Низкий' ? '#22c55e' : riskReport.totalRisk === 'Средний' ? '#f59e0b' : '#ef4444' }}>
                🩺 Общий риск: {riskReport.totalRisk}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{riskReport.summary}</div>
              {Object.entries(riskReport.systems).map(([sys, data]) => (
                <div key={sys} style={{ fontSize: 8, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: data.score >= 5 ? '#ef4444' : data.score >= 3 ? '#f59e0b' : '#22c55e' }}>
                      {sys === 'hepatic' ? 'Печень' : sys === 'renal' ? 'Почки' : sys === 'inflammatory' ? 'Воспаление' : sys === 'insulin' ? 'Инсулин' : 'Электролиты'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>⚠ {data.score}/7</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)' }}>{data.impact}</div>
                  {data.score >= 3 && <div style={{ color: '#f59e0b' }}>→ {data.recommendation}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Drug compatibility report */}
          {drugCompatReport && activeReports.includes('drug') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>💉 Совместимость с препаратами</div>
              {drugCompatReport.interactions.map((int, i) => (
                <div key={i} style={{ fontSize: 8, padding: '2px 0', color: int.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                  • {int.drug} + {int.food}: {int.effect}
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                {drugCompatReport.warnings.join('; ')}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* 20-22: Separate calculators */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => generateCheatMeal()} style={{
          flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
          background: '#202023', border: '1px solid #27272a',
          color: '#f59e0b', fontWeight: 700, fontSize: 10,
          transition: 'all 0.15s',
        }}>
          🍔 Читмил
        </button>
        <button onClick={() => generateCarbload()} style={{
          flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
          background: '#202023', border: '1px solid #27272a',
          color: '#f97316', fontWeight: 700, fontSize: 10,
          transition: 'all 0.15s',
        }}>
          🍚 Углев. загрузка
        </button>
        <button onClick={() => generateBUTCH()} style={{
          flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
          background: '#202023', border: '1px solid #27272a',
          color: '#3b82f6', fontWeight: 700, fontSize: 10,
          transition: 'all 0.15s',
        }}>
          ⤴️⤵️ БУЧ
        </button>
      </div>

      {cheatMealPlan && (
        <GlassCard title="Читмил" icon="🍔" color="#f59e0b" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>~{cheatMealPlan.cals} ккал (35% от нормы)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cheatMealPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cheatMealPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{cheatMealPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textAlign: 'center' }}>{cheatMealPlan.bjuBreakdown}</div>
          {cheatMealPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || (cheatMealPlan.cals / cheatMealPlan.items.length), amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 4 }}>
            {cheatMealPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.note}</div>
        </GlassCard>
      )}

      {carbloadPlan && (
        <GlassCard title="Углеводная загрузка" icon="🍚" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>Всего: {carbloadPlan.totalCarbs} г ({Math.round(carbloadPlan.totalCarbs / weight)} г/кг)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{carbloadPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{carbloadPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{carbloadPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textAlign: 'center' }}>~{carbloadPlan.bju.kcal} ккал всего</div>
          {carbloadPlan.foods.map((f: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>• {f.name || f}</span>
              <span onClick={() => addToCart({ name: f.name || f, kcal: f.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f97316', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 4 }}>
            {carbloadPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f97316', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)' }}>{carbloadPlan.note}</div>
        </GlassCard>
      )}

      {butchPlan && (
        <GlassCard title="БУЧ (белково-углеводное чередование)" icon="⤴️⤵️" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ padding: '10px', borderRadius: 10, background: '#202023', border: '1px solid #27272a' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>📋 {butchPlan.pattern}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 600 }}>ВУ (тренировка)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>{butchPlan.highCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↓ жиры {butchPlan.fatHigh}г</div>
              </div>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>НУ (отдых)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>{butchPlan.lowCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↑ жиры {butchPlan.fatLow}г</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: '#22c55e', textAlign: 'center', marginBottom: 4 }}>
              ВУ: {butchPlan.bjuHigh.kcal} ккал · НУ: {butchPlan.bjuLow.kcal} ккал
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#3b82f6', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 4 }}>
              {butchPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)' }}>{butchPlan.note}</div>
          </div>
        </GlassCard>
      )}

      {/* 22. Recommendations */}
      <button onClick={generateRecommendations} style={{ ...greenBtn, background: 'linear-gradient(135deg,#a855f7,#d946ef)' }}>
        💡 Выдать рекомендации
      </button>
      {recommendations.length > 0 && (
        <GlassCard title="Рекомендации" icon="💡" color="#a855f7" style={{ border: '1px solid rgba(168,85,247,0.15)' }}>
          {recommendations.map((r, i) => (
            <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', padding: '4px 0', borderBottom: i < recommendations.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', lineHeight: 1.4 }}>
              • {r}
            </div>
          ))}
        </GlassCard>
      )}

      {/* 23. Meal prep plan */}
      {generated && dayPlan && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {([1, 3, 7] as const).map(n => (
              <button key={n} onClick={() => setMealPrepDays(n)} style={{
                flex: 1, padding: '6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                background: mealPrepDays === n ? 'linear-gradient(135deg,#06b6d4,#0e7490)' : '#202023',
                border: 'none', color: mealPrepDays === n ? '#000' : 'rgba(255,255,255,0.5)',
                fontWeight: 700, fontSize: 9,
              }}>
                {n === 1 ? '1 день' : n === 3 ? '3 дня' : 'Неделя'}
              </button>
            ))}
          </div>
          <button onClick={generateMealPrep} style={{ ...greenBtn, background: 'linear-gradient(135deg,#06b6d4,#0e7490)' }}>
            👨‍🍳 Составить план готовки (Meal Prep)
          </button>
        </div>
      )}
      {mealPrepPlan && (
        <GlassCard title="План готовки" icon="👨‍🍳" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#06b6d4', marginBottom: 6 }}>
            <span>⏱ {mealPrepPlan.totalTime} мин</span>
            <span>📦 {mealPrepPlan.containers} контейнеров</span>
          </div>
          {mealPrepPlan.steps.map((st, i) => (
            <div key={i} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: '#202023', border: '1px solid #27272a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4' }}>Шаг {st.step}: {st.action}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{st.duration} мин</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {st.items.map((item, j) => <span key={j} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.1)', color: 'rgba(255,255,255,0.6)' }}>{item}</span>)}
              </div>
            </div>
          ))}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.25)', background: 'rgba(6,182,212,0.06)', color: '#06b6d4', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>💾 Сохранить план</button>
        </GlassCard>
      )}

      {/* Saved plans with load/delete */}
      {savedPlans.length > 0 && (
        <GlassCard title="Сохранённые планы" icon="📂" color="#8b5cf6">
          {savedPlans.slice(0, 10).map((p, pi) => {
            const isExpanded = p.id === (expandedSavedId as any);
            return (
              <div key={p.id} style={{ marginBottom: 6, borderRadius: 10, overflow: 'hidden', border: isExpanded ? '1px solid rgba(139,92,246,0.2)' : '1px solid #27272a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', background: isExpanded ? 'rgba(139,92,246,0.04)' : '#202023' }}
                  onClick={() => setExpandedSavedId(isExpanded ? null : p.id)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>📅 {p.date}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 600 }}>{p.dayPlan ? `${Math.round(p.dayPlan.totals.kcal)} ккал` : ''}</span>
                    <button onClick={(e) => { e.stopPropagation(); loadSavedPlan(p); }} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontWeight: 600 }}>📋</button>
                    <button onClick={(e) => { e.stopPropagation(); const updated = savedPlans.filter((_, j) => j !== pi); setSavedPlans(updated); localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated)); }} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}>✕</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '6px 10px 8px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                    {p.dayPlan && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#00e68a', marginBottom: 4, fontSize: 9 }}>🍽 План на день: {Math.round(p.dayPlan.totals.kcal)} ккал</div>
                        {p.dayPlan.meals?.map((m: any, mi: number) => (
                          <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{m.time}</span>
                            <span style={{ fontWeight: 600, color: '#00e68a' }}>{m.label}:</span>
                            <span>{m.items?.map((it: any) => it.name).join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.shoppingList && p.shoppingList.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                        <span style={{ color: '#f97316', fontWeight: 600 }}>🛒 {p.shoppingList.length} продуктов</span>
                      </div>
                    )}
                    {p.waterCalc && <div style={{ marginTop: 2, color: '#06b6d4', fontWeight: 600 }}>💧 {p.waterCalc.total} л/день</div>}
                  </div>
                )}
              </div>
            );
          })}
        </GlassCard>
      )}

    </div>
  );
};
