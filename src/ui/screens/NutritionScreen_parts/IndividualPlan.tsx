import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { addToCart } from '../../../core/nutrition-utils';
import { FOOD_DB, FOOD_ALLERGEN_DIET } from '../../../core/nutrition-database';
import { PHARMA_DB } from '../../../core/pharma-database';
import { calcNutrition } from '../../../engines/nutrition.engine';
import { getProfile, updateProfile } from '../../../core/profile-manager';
import { getRecipesByMeal, getRecipes, type Recipe } from '../../../engines/nutrition-periodization.engine';
import { generateNutritionReport, type NutritionReport } from '../../../engines/nutrition-report.engine';
import type { UserProfile } from '../../../core/types';


// ─── Types ───
type GoalId = 'mass' | 'strength' | 'fat_loss' | 'cutting' | 'post_cut' | 'maintenance' | 'recomposition' | 'rehab';
type PhaseId = 'course' | 'bridge' | 'pct' | 'recovery' | 'cutting' | 'maintenance' | 'recomp' | 'fat_loss' | 'post_cut';
type BudgetLevel = 'low' | 'medium' | 'max' | 'enhanced';
type NutritionLevel = 'base' | 'medium' | 'enhanced' | 'max';
type PlanType = 'classic' | 'keto' | 'highcarb' | 'mediterranean' | 'vegetarian';
type CycleType = 'none' | 'macro' | 'butch' | 'cheatmeal' | 'carbload';

interface DrugInjection { id: string; name: string; time: string; dose: number; unit: string; type: string; esterType: 'rapid' | 'short' | 'long' | 'none'; halfLifeHours: number; trainLinked: boolean; trainTiming: 'before' | 'after' | 'both' | 'none'; }
interface MealPrepStep { step: number; action: string; duration: number; items: string[]; }
interface SavedPlan { id: number; date: string; name?: string; dayPlan: any; threeDayPlan: any; weekPlan: any; shoppingList: any; waterCalc: any; }

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

const NUTRITION_LEVELS: { id: NutritionLevel; label: string; icon: string; mult: number; desc: string }[] = [
  { id: 'base', label: 'База', icon: '🟢', mult: 1.0, desc: '0%' },
  { id: 'medium', label: '+15%', icon: '🟡', mult: 1.15, desc: 'Средний' },
  { id: 'enhanced', label: '+30%', icon: '🟠', mult: 1.3, desc: 'Усиленный' },
  { id: 'max', label: '+50%', icon: '🔴', mult: 1.5, desc: 'Максимум' },
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

const HEALTH_ISSUES = [
  { id: 'oedema', label: 'Отёки', icon: '🫧', desc: 'Задержка жидкости, склонность к отёкам', foodIds: ['salt','soy_sauce','kfc_wings','kfc_soup','kfc_bucket','bk_whopper','mcd_big_mac','mcd_royale','vt_big_smoke','french_fries','bread_white','pizza_margherita','sausage'] },
  { id: 'lactose_intolerance', label: 'Непереносимость лактозы', icon: '🥛', desc: 'Вздутие, дискомфорт от молочных продуктов', foodIds: ['milk','cheese','yogurt','kefir','cheese_cream','sour_cream','condensed_milk','ice_cream','cottage_cheese_5','cottage_cheese_2','cottage_cheese_0','yogurt_greek','ricotta','mozzarella','parmesan','feta'] },
  { id: 'gluten_intolerance', label: 'Непереносимость глютена', icon: '🌾', desc: 'Реакция на пшеницу, рожь, ячмень', foodIds: ['bread_white','bread_rye','pasta','mantua','bread_protein','pancakes','pita','lavash','muesli','oats_instant','pelmeni','pizza_margherita','chebureki','pyanse','ramen_egg','falafel_pita','greek_gyros','tortilla_corn','cornmeal','rice_cakes'] },
  { id: 'diabetes', label: 'Диабет / Преддиабет', icon: '💉', desc: 'Контроль гликемии, низкий GI', foodIds: ['sugar','honey','syrup','bread_white','rice_white','rice_cakes','pasta','potato_mashed','potato_baked','french_fries','pancakes','pizza_margherita','ice_cream','watermelon','dates','banana','coca_cola','juice_apple','juice_orange','muesli','chocolate','cookie','marmalade'] },
  { id: 'hypertension', label: 'Гипертония', icon: '❤️', desc: 'Повышенное давление, ограничение натрия', foodIds: ['salt','soy_sauce','kfc_wings','kfc_bucket','bk_whopper','mcd_big_mac','mcd_royale','vt_big_smoke','french_fries','sausage','bacon','ham','ketchup','mayonnaise','chips','pickles','olives','suluguni','cheese_processed','bouillon_cube'] },
  { id: 'gi_issues', label: 'Проблемы с ЖКТ', icon: '🫀', desc: 'Гастрит, вздутие, синдром раздражённого кишечника', foodIds: ['cabbage','broccoli','cauliflower','brussels_sprouts','beans','lentils','chickpeas','peas','cornmeal','pancakes','pizza_margherita','french_fries','fried_rice_egg','chicken_curry_rice','soda','chebureki','pyanse','khachapuri','shaurma','mayonnaise','ketchup','cream_sauce','milk','ice_cream','onion_raw'] },
  { id: 'gout', label: 'Подагра', icon: '🦶', desc: 'Повышенная мочевая кислота, низкие пурины', foodIds: ['liver','kidneys','sardines','anchovies','mussels','beef_liver','chicken_liver','pork_liver','beef_kidney','green_peas','spinach','mushrooms','cauliflower','broccoli','asparagus','beer','red_meat','bacon','ham','sausage','tuna_canned','sprats','broth_bone'] },
  { id: 'kidney_stones', label: 'Камни в почках', icon: '🫘', desc: 'Оксалаты, ограничение кальция/оксалатов', foodIds: ['spinach','rhubarb','beetroot','nuts','almonds','walnuts','cashews','peanuts','chocolate','sweet_potato','okra','swiss_chard','parsley','poppy_seeds','sesame','soy_flour','buckwheat','millet','bran','berries'] },
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
    borderRadius: 18, overflow: 'hidden',
    background: '#18181b',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
    position: 'relative',
    ...style,
  }}>
    {color && <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}66, transparent)` }} />}
    {title && <div style={{ padding: '14px 18px 0', fontSize: 14, color: color || 'rgba(255,255,255,0.75)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.3px' }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}{title}
    </div>}
    <div style={{ padding: title ? '12px 18px 18px' : 18 }}>
      {children}
    </div>
  </div>
);

const PillBtn: React.FC<{ active?: boolean; onClick: () => void; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ active, onClick, color, children, style }) => (
  <button onClick={onClick} style={{
    padding: '6px 14px', borderRadius: 20, fontSize: 10, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '-0.1px',
    background: active ? (color ? `${color}18` : 'rgba(0,230,138,0.12)') : '#202023',
    border: active ? `1px solid ${color || '#00e68a'}` : '1px solid rgba(255,255,255,0.06)',
    color: active ? (color || '#00e68a') : '#fff',
    transition: 'all 0.2s',
    boxShadow: active ? `0 0 12px ${(color || '#00e68a')}22` : 'none',
    ...style,
  }}>{children}</button>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none' as const,
};

const greenBtn: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 14, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000',
  fontWeight: 700, fontSize: 13, letterSpacing: '-0.2px',
  boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
  transition: 'all 0.2s',
};

const reportPillStyle = (color: string, active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
  background: active ? `${color}18` : '#202023',
  border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
  color: active ? color : '#fff',
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

  // Auto-cycling: phase → recommended goal
  const phaseToGoal: Record<PhaseId, GoalId> = {
    course: 'mass', bridge: 'maintenance', pct: 'maintenance',
    recovery: 'maintenance', cutting: 'cutting', maintenance: 'maintenance',
    recomp: 'recomposition', fat_loss: 'fat_loss', post_cut: 'post_cut',
  };
  const autoGoal = phaseToGoal[phase] || 'maintenance';
  const [goalUserSet, setGoalUserSet] = useState(false);
  useEffect(() => {
    if (!goalUserSet) setGoal(autoGoal);
  }, [phase, autoGoal, goalUserSet]);
  const [injections, setInjections] = useState<DrugInjection[]>(() => {
    // Auto-pull from pharma course with proper type detection
    if (courseEntries.length > 0) {
      return courseEntries.map(ce => {
        const substance = PHARMA_DB[ce.substanceId];
        const name = substance?.name || ce.substanceId || ce.name || 'Препарат';
        const halfLife = substance?.pk?.halfLifeHours || 24;
        // Detect type from PHARMA_DB class
        let type = 'другое';
        let esterType: 'rapid' | 'short' | 'long' | 'none' = 'none';
        if (substance?.class === 'insulin') {
          type = 'инсулин';
          // Ester-based timing: rapid = <2h, short = 2-8h, long = >8h
          if (halfLife < 2) esterType = 'rapid';
          else if (halfLife <= 8) esterType = 'short';
          else esterType = 'long';
        } else if (substance?.id?.includes('ghrp') || substance?.id?.includes('cjc') || substance?.id?.includes('sermorelin') || substance?.class === 'peptide_ghrh' || substance?.class === 'peptide_ghrp') {
          type = 'ГР';
          esterType = 'short';
        } else if (substance?.id?.includes('igf1') || substance?.id?.includes('mgf')) {
          type = 'ИФР-1';
          esterType = 'short';
        } else if (substance?.class === 'glp1') {
          type = 'семаглутид'; // generic GLP-1, specific name saved manually
          esterType = 'long';
        } else if (substance?.id?.includes('bpc') || substance?.id?.includes('tb500')) {
          type = 'пептид';
          esterType = 'none';
        } else if (substance?.class && ['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone'].includes(substance.class)) {
          type = 'ААС';
          // Check esters for timing
          const esters = substance.esters || [];
          if (esters.some((e: string) => ['propionate','acetate','phenylpropionate'].includes(e))) esterType = 'short';
          else if (esters.some((e: string) => ['enanthate','cypionate'].includes(e))) esterType = 'long';
          else esterType = 'long';
        }
        return {
          id: `course_${ce.substanceId}_${Date.now()}`,
          name,
          time: type === 'инсулин' ? (esterType === 'long' ? '22:00' : (linkToTraining ? '00:00' : '08:00')) : '08:00',
          dose: ce.doseValue || 10,
          unit: ce.doseUnit || 'mg',
          type,
          esterType,
          halfLifeHours: halfLife,
          trainLinked: linkToTraining && (type === 'инсулин' || type === 'ИФР-1'),
          trainTiming: 'before' as 'before' | 'after' | 'both' | 'none',
        };
      });
    }
    return [];
  });
  const [injName, setInjName] = useState('');
  const [injTime, setInjTime] = useState('08:00');
  const [injDose, setInjDose] = useState(10);
  const [injUnit, setInjUnit] = useState('mg');
  const [injType, setInjType] = useState('инсулин');
  const [injEster, setInjEster] = useState<'rapid' | 'short' | 'long' | 'none'>('none');
  const injectDrugTypes = ['инсулин', 'ГР', 'ИФР-1', 'MGF', 'IGF-1 DES', 'IGF-1 LR3', 'HMG', 'HCG', 'GHRP', 'CJC', 'BPC-157', 'TB-500', 'меланотан', 'семаглутид', 'тирзепатид', 'другое'];

  // 4. Training link
  const [trainStart, setTrainStart] = useState('16:00');
  const [trainEnd, setTrainEnd] = useState('17:30');
  const [linkToTraining, setLinkToTraining] = useState(false);

  // 5. Editable KBJU
  const calcTargets = useMemo(() => {
    const wpw = s?.workoutsPerWeek || 3;
    const awm = s?.avgWorkoutMinutes || 60;
    let pal = 1.2 + wpw * 0.075;
    if (awm > 60) pal += 0.1;
    if (awm > 90) pal += 0.05;
    if (wpw >= 6) pal += 0.05;
    pal = Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
    // Map app goal IDs to engine-compatible values
    const goalMap: Record<string, string> = {
      mass: 'bulk', strength: 'strength', fat_loss: 'cut',
      cutting: 'cut', post_cut: 'maintenance', maintenance: 'maintenance',
      recomposition: 'recomp', rehab: 'rehab',
    };
    const engineGoal = goalMap[goal] || 'maintenance';
    const targets = calcNutrition({ weightKg: weight, heightCm: height, age, sex, pal: Math.min(1.9, Math.max(1.2, pal)), goal: engineGoal });
    // Phase-aware adjustments
    const phaseMult: Record<string, { kcalMod: number; pAdd: number }> = {
      course:      { kcalMod: 1.0,  pAdd: 0.3 },
      bridge:      { kcalMod: 0.95, pAdd: 0.0 },
      pct:         { kcalMod: 0.9,  pAdd: 0.0 },
      recovery:    { kcalMod: 1.05, pAdd: 0.3 },
      cutting:     { kcalMod: 0.8,  pAdd: 0.2 },
      maintenance: { kcalMod: 1.0,  pAdd: 0.0 },
      recomp:      { kcalMod: 0.9,  pAdd: 0.1 },
      fat_loss:    { kcalMod: 0.75, pAdd: 0.2 },
      post_cut:    { kcalMod: 1.05, pAdd: 0.1 },
    };
    const pm = phaseMult[phase] || { kcalMod: 1.0, pAdd: 0 };
    targets.kcal = Math.round(targets.kcal * pm.kcalMod);
    targets.protein = Math.round(targets.protein + weight * pm.pAdd);
    // Recalc fat+carbs proportionally from new kcal/protein
    if (pm.kcalMod !== 1.0 || pm.pAdd !== 0) {
      const pKcal = targets.protein * 4;
      const remaining = Math.max(0, targets.kcal - pKcal);
      if (targets.fats > 0 || targets.carbs > 0) {
        const fRatio = (targets.fats * 9) / Math.max(1, targets.fats * 9 + targets.carbs * 4);
        targets.fats = Math.round((remaining * fRatio) / 9);
        targets.carbs = Math.round((remaining * (1 - fRatio)) / 4);
      } else {
        targets.fats = Math.round((remaining * 0.25) / 9);
        targets.carbs = Math.round((remaining * 0.75) / 4);
      }
    }
    // Pharma-aware adjustments
    const hasAAS = injections.some(i => i.type === 'ААС');
    const hasShortInsulin = injections.some(i => i.type === 'инсулин' && i.esterType !== 'long');
    const hasInsulin = injections.some(i => i.type === 'инсулин');
    const hasGLP = injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид');
    if (hasAAS) targets.protein = Math.round(targets.protein + weight * 0.3); // +0.3g/kg on AAS
    if (hasShortInsulin) {
      const totalInsulinDose = injections.filter(i => i.type === 'инсулин' && i.esterType !== 'long').reduce((s, i) => s + i.dose, 0);
      const minInsulinCarbs = totalInsulinDose * 10;
      if (targets.carbs < minInsulinCarbs) targets.carbs = Math.round(minInsulinCarbs * 1.2); // 20% buffer
      const maxFat = Math.round(weight * 0.5);
      if (targets.fats > maxFat) targets.fats = maxFat;
      targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
    }
    if (hasInsulin) {
      const maxFat = Math.round(weight * 0.5);
      if (targets.fats > maxFat) targets.fats = maxFat;
      targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
    }
    if (hasGLP) {
      targets.fats = Math.min(targets.fats, Math.round(weight * 0.4));
      targets.protein = Math.round(targets.protein + weight * 0.2);
      targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
    }
    return targets;
  }, [weight, height, age, sex, goal, s?.workoutsPerWeek, s?.avgWorkoutMinutes, injections, phase]);

  const [manualKcal, setManualKcal] = useState<number | null>(null);
  const [manualP, setManualP] = useState<number | null>(null);
  const [manualF, setManualF] = useState<number | null>(null);
  const [manualC, setManualC] = useState<number | null>(null);
  const [kbjuMode, setKbjuMode] = useState<'auto' | 'manual' | 'profile'>('auto');

  // Profile-based KBJU (raw calc from profile settings, no pharma override)
  const profileTargets = useMemo(() => {
    const wpw = s?.workoutsPerWeek || 3;
    const awm = s?.avgWorkoutMinutes || 60;
    let pal = 1.2 + wpw * 0.075;
    if (awm > 60) pal += 0.1;
    if (awm > 90) pal += 0.05;
    if (wpw >= 6) pal += 0.05;
    pal = Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
    const gm: Record<string, string> = { mass:'bulk',strength:'strength',fat_loss:'cut',cutting:'cut',post_cut:'maintenance',maintenance:'maintenance',recomposition:'recomp',rehab:'rehab' };
    return calcNutrition({ weightKg: s?.weight || weight, heightCm: s?.height || height, age: s?.age || age, sex: s?.sex || sex, pal, goal: gm[goal] || 'maintenance' });
  }, [s?.weight, s?.height, s?.age, s?.sex, s?.workoutsPerWeek, s?.avgWorkoutMinutes, goal]);

  const effectiveKcal = kbjuMode === 'profile' ? profileTargets.kcal : (manualKcal ?? calcTargets.kcal);
  const effectiveP = kbjuMode === 'profile' ? profileTargets.protein : (manualP ?? calcTargets.protein);
  const effectiveF = kbjuMode === 'profile' ? profileTargets.fats : (manualF ?? calcTargets.fats);
  const effectiveC = kbjuMode === 'profile' ? profileTargets.carbs : (() => {
    if (manualC !== null) return manualC;
    if (manualKcal !== null && manualP !== null && manualF !== null && manualC === null) {
      const fromPF = (manualP * 4) + (manualF * 9);
      return Math.max(0, Math.round((manualKcal - fromPF) / 4));
    }
    return calcTargets.carbs;
  })();

  // Sync manual values when switching to manual mode
  const switchKbjuMode = (mode: typeof kbjuMode) => {
    if (mode === 'manual' && kbjuMode !== 'manual') {
      setManualKcal(effectiveKcal);
      setManualP(effectiveP);
      setManualF(effectiveF);
      setManualC(effectiveC);
    }
    if (mode !== 'manual') {
      setManualKcal(null);
      setManualP(null);
      setManualF(null);
      setManualC(null);
    }
    setKbjuMode(mode);
  };

  const resultsRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);

  // 6. Budget level
  const [budget, setBudget] = useState<BudgetLevel>('medium');

  // 7. Nutrition level
  const [nutrLevel, setNutrLevel] = useState<NutritionLevel>('base');
  const [variety, setVariety] = useState<'minimal' | 'medium' | 'max'>('max');

  // 8. Schedule
  const [wakeTime, setWakeTime] = useState('07:00');
  const [bedTime, setBedTime] = useState('23:00');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('19:00');
  const [workFood, setWorkFood] = useState<'any' | 'portable'>('any');
  const [mealsCount, setMealsCount] = useState(4);

  // Auto-adjust mealsCount from awake hours
  useEffect(() => {
    const wMin = parseInt(wakeTime.split(':')[0]) * 60 + parseInt(wakeTime.split(':')[1]);
    const bMin = parseInt(bedTime.split(':')[0]) * 60 + parseInt(bedTime.split(':')[1]);
    const awakeHours = (bMin - wMin) / 60;
    if (awakeHours >= 16) setMealsCount(5);
    else if (awakeHours >= 14) setMealsCount(4);
    else setMealsCount(3);
  }, [wakeTime, bedTime]);

  // 9. Allergens
  const [allergens, setAllergens] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_food_allergens') || '[]'); } catch { return []; } });
  const [healthIssues, setHealthIssues] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_health_issues') || '[]'); } catch { return []; } });
  const [eveningLowCarb, setEveningLowCarb] = useState(() => {
    try { return localStorage.getItem('he_evening_low_carb') === 'true'; } catch { return false; }
  });
  // Auto-enable eveningLowCarb when oedema or diabetes is selected
  React.useEffect(() => {
    const relevantActive = healthIssues.some(h => h === 'oedema' || h === 'diabetes');
    if (relevantActive && !eveningLowCarb) {
      setEveningLowCarb(true);
      localStorage.setItem('he_evening_low_carb', 'true');
    }
  }, [healthIssues]);

  // 10. Plan type
  const [planType, setPlanType] = useState<PlanType>('classic');

  // 11. Preferences + user foods
  const [preferredFoods, setPreferredFoods] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_preferred_foods') || '["chicken_breast","rice_white","broccoli","egg_whole","avocado"]'); } catch { return ['chicken_breast','rice_white','broccoli','egg_whole','avocado']; } });
  const [userFoods, setUserFoods] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_custom_foods') || '[]'); } catch { return []; } });
  const [customNotes, setCustomNotes] = useState(() => { try { return localStorage.getItem('he_nutrition_notes') || ''; } catch { return ''; } });

  // 12. Excluded foods
  const [excludedFoods, setExcludedFoods] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_excluded_foods') || '[]'); } catch { return []; } });
  const [allergenExcludedCount, setAllergenExcludedCount] = useState(0);
  const [planTargets, setPlanTargets] = useState<{ kcal: number; protein: number; fats: number; carbs: number }>({ kcal: 2500, protein: 160, fats: 70, carbs: 300 });

  // 13-14: Cycling toggles
  const [cyclingMode, setCyclingMode] = useState<CycleType>('none');
  const [heavyTrainDay, setHeavyTrainDay] = useState('');
  const [trainingDays, setTrainingDays] = useState<boolean[]>([true, false, true, false, true, true, false]);
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // 15. Plan generation
  const [generated, setGenerated] = useState(false);
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(1);
  const [planView, setPlanView] = useState<'list' | 'calendar'>('list');
  const [dayPlan, setDayPlan] = useState<any>(null);
  const [threeDayPlan, setThreeDayPlan] = useState<any>(null);
  const [weekPlan, setWeekPlan] = useState<any>(null);
  const [shoppingList, setShoppingList] = useState<any>(null);
  const [waterCalc, setWaterCalc] = useState<any>(null);

  // Save plans
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => { try { return JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]'); } catch { return []; } });
  const [expandedSavedId, setExpandedSavedId] = useState<number | null>(null);

  // Plan editing state
  const [editItem, setEditItem] = useState<{ dayIdx: number; mealIdx: number; itemIdx: number } | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [replacingItem, setReplacingItem] = useState<{ dayIdx: number; mealIdx: number; itemIdx: number } | null>(null);
  const [recipePickerMeal, setRecipePickerMeal] = useState<{ dayIdx: number; mealIdx: number; label: string } | null>(null);
  const [mealPrep, setMealPrep] = useState<any[] | null>(null);
  const [dayPlanNotes, setDayPlanNotes] = useState(() => { try { return localStorage.getItem('he_day_notes') || ''; } catch { return ''; } });
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [userRecipes, setUserRecipes] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_user_recipes') || '[]'); } catch { return []; } });
  const [showRecipeCreator, setShowRecipeCreator] = useState(false);
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ name: '', meal: 'lunch' as string, prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });

  // Save undo state before modifications
  const saveUndo = () => {
    if (dayPlan) setUndoStack(prev => [JSON.parse(JSON.stringify(dayPlan)), ...prev].slice(0, 5));
  };

  // Move food item between meals
  const moveFoodItem = (fromMealIdx: number, toMealIdx: number, itemIdx: number) => {
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m: any) => ({ ...m, items: [...m.items], totals: { ...m.totals } }));
      const item = meals[fromMealIdx].items.splice(itemIdx, 1)[0];
      if (!item) return prev;
      meals[toMealIdx].items.push(item);
      meals.forEach((m: any, i: number) => {
        meals[i] = { ...m, totals: { kcal: m.items.reduce((s: number, it: any) => s + it.kcal, 0), p: m.items.reduce((s: number, it: any) => s + it.p, 0), f: m.items.reduce((s: number, it: any) => s + it.f, 0), c: m.items.reduce((s: number, it: any) => s + it.c, 0) } };
      });
      const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) };
      return { ...prev, meals, totals };
    });
    setDraggedItem(null);
    setDropTarget(null);
  };

  // Find similar foods by category
  const findSimilarFoods = (item: any, count = 5) => {
    const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
    if (!food) return [];
    const sameCat = FOOD_DB.filter(f => f.category === food.category && f.id !== food.id);
    const scored = sameCat.map(f => {
      const score = Math.abs(f.protein - food.protein) + Math.abs(f.fat - food.fat) * 0.5 + Math.abs(f.carbs - food.carbs) * 0.3;
      return { ...f, score };
    }).sort((a, b) => a.score - b.score).slice(0, count);
    return scored;
  };

  // Replace food item with another
  const replaceFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number, newFood: any) => {
    const dayData = dayIdx === 0 ? dayPlan : threeDayPlan?.days?.[dayIdx] || weekPlan?.days?.[dayIdx];
    if (!dayData?.meals?.[mealIdx]?.items?.[itemIdx]) return;
    const old = dayData.meals[mealIdx].items[itemIdx];
    const portion = (old.amount || 100) / 100;
    const replacement = { ...old, name: newFood.name, id: newFood.id, kcal: Math.round(newFood.kcal * portion), p: Math.round(newFood.protein * portion), f: Math.round(newFood.fat * portion), c: Math.round(newFood.carbs * portion), amount: Math.round(portion * (parseInt(newFood.servingSize) || 100)) };
    const updatePlan = (prev: any) => {
      if (!prev) return prev;
      const meals = [...prev.meals];
      const items = [...meals[mealIdx].items];
      items[itemIdx] = replacement;
      meals[mealIdx] = { ...meals[mealIdx], items, totals: { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) } };
      const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) };
      return { ...prev, meals, totals };
    };
    if (dayIdx === 0) setDayPlan(updatePlan);
    setReplacingItem(null);
  };

  // Update item amount
  const updateItemAmount = (dayIdx: number, mealIdx: number, itemIdx: number, newAmount: number) => {
    const updatePlan = (prev: any) => {
      if (!prev) return prev;
      const meals = [...prev.meals];
      const items = [...meals[mealIdx].items];
      const it = { ...items[itemIdx], amount: Math.max(1, newAmount), kcal: Math.round(items[itemIdx].kcal / Math.max(1, items[itemIdx].amount) * Math.max(1, newAmount)) };
      items[itemIdx] = it;
      meals[mealIdx] = { ...meals[mealIdx], items, totals: { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) } };
      const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) };
      return { ...prev, meals, totals };
    };
    if (dayIdx === 0) setDayPlan(updatePlan);
    setEditItem(null);
  };

  // Remove food item
  const removeFoodItem = (dayIdx: number, mealIdx: number, itemIdx: number) => {
    saveUndo();
    const updatePlan = (prev: any) => {
      if (!prev) return prev;
      const meals = [...prev.meals];
      const items = meals[mealIdx].items.filter((_: any, i: number) => i !== itemIdx);
      meals[mealIdx] = { ...meals[mealIdx], items, totals: { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) } };
      const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) };
      return { ...prev, meals, totals };
    };
    if (dayIdx === 0) setDayPlan(updatePlan);
  };

  // Replace meal with a recipe
  const replaceMealWithRecipe = (recipe: Recipe, mealIdx: number) => {
    saveUndo();
    const updatePlan = (prev: any) => {
      if (!prev) return prev;
      const meals = [...prev.meals];
      const matchedItems = recipe.ingredients.map((ing, ii) => {
        const lower = ing.toLowerCase();
        const food = FOOD_DB.find(f => lower.includes(f.name.toLowerCase()) || lower.includes(f.id));
        const item: any = food || { name: ing, id: ing, kcal: Math.round(recipe.kcal / recipe.ingredients.length), protein: Math.round(recipe.protein / recipe.ingredients.length), fat: Math.round(recipe.fat / recipe.ingredients.length), carbs: Math.round(recipe.carbs / recipe.ingredients.length) };
        return { name: item.name || ing, id: item.id || ing, amount: 100, kcal: Math.round((item.kcal || 0) * (recipe.kcal / recipe.ingredients.length) / Math.max(1, item.kcal || 1)), p: Math.round(item.protein || recipe.protein / recipe.ingredients.length), f: Math.round(item.fat || recipe.fat / recipe.ingredients.length), c: Math.round(item.carbs || recipe.carbs / recipe.ingredients.length) };
      });
      const totals = { kcal: matchedItems.reduce((s, i) => s + i.kcal, 0), p: matchedItems.reduce((s, i) => s + i.p, 0), f: matchedItems.reduce((s, i) => s + i.f, 0), c: matchedItems.reduce((s, i) => s + i.c, 0) };
      meals[mealIdx] = { ...meals[mealIdx], items: matchedItems, totals };
      const dayTotals = { kcal: meals.reduce((s, m) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s, m) => s + (m.totals?.p || 0), 0), f: meals.reduce((s, m) => s + (m.totals?.f || 0), 0), c: meals.reduce((s, m) => s + (m.totals?.c || 0), 0) };
      return { ...prev, meals, totals: dayTotals };
    };
    setDayPlan(updatePlan);
    setRecipePickerMeal(null);
  };

  const mealtimeToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

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
      const updated = prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id];
      localStorage.setItem('he_food_allergens', JSON.stringify(updated));
      return updated;
    });
  };
  const toggleHealthIssue = (id: string) => {
    setHealthIssues(prev => {
      const updated = prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id];
      localStorage.setItem('he_health_issues', JSON.stringify(updated));
      return updated;
    });
  };

  // ─── Generate Plan ───
  const generatePlan = (days: 1 | 3 | 7) => {
    setPlanDays(days);
    const nutrMult = NUTRITION_LEVELS.find(l => l.id === nutrLevel)?.mult || 1.0;
    const budgetFilter = (id: BudgetLevel): number[] => {
      const map: Record<string, number[]> = { low: [0,5], medium: [5,8], max: [8,10], enhanced: [9,15] };
      return map[id] || [5,10];
    };
    const [bMin, bMax] = budgetFilter(budget);

    const tierScores: Record<string, number> = { basic: 5, mid: 7, max: 9, boost: 11 };

    const planTypeMod = PLAN_TYPES.find(p => p.id === planType);
    const pMod = planTypeMod?.pMult || 1.0;
    const fMod = planTypeMod?.fMult || 1.0;
    const cMod = planTypeMod?.cMult || 1.0;

    const excludedIds = new Set(excludedFoods);
    // Add health issue food exclusions
    healthIssues.forEach(hid => {
      const issue = HEALTH_ISSUES.find(h => h.id === hid);
      if (issue?.foodIds) issue.foodIds.forEach(fid => excludedIds.add(fid));
    });
    // Build food allergen map from authoritative sources
    const getFoodAllergens = (foodId: string): string[] => {
      const fromDiet = FOOD_ALLERGEN_DIET[foodId];
      if (fromDiet) return fromDiet.allergens;
      const food = FOOD_DB.find(f => f.id === foodId);
      return food?.allergens || [];
    };

    // Map user-selected allergens to food allergen values + text fallbacks
    const userAllergenToValues: Record<string, string[]> = {
      'лактоза': ['dairy'], 'молочные': ['dairy'],
      'глютен': ['gluten'], 'орехи': ['nuts', 'tree_nuts'],
      'арахис': ['peanuts'], 'яйца': ['eggs'], 'соя': ['soy'],
      'рыба': ['fish'], 'морепродукты': ['shellfish'],
      'кунжут': ['sesame'], 'горчица': ['mustard'],
      'сельдерей': ['celery'], 'сульфиты': ['sulfites'], 'люпин': ['lupin'],
    };

    // Comprehensive text-based name searches — covers items missed by FOOD_ALLERGEN_DIET
    const allergenTextMatches = (a: string, fName: string): boolean => {
      const n = fName.toLowerCase();
      if (a === 'лактоза' || a === 'молочные') {
        if (n.includes('молок')||n.includes('сыр')||n.includes('творог')||n.includes('кефир')||n.includes('сливк')||n.includes('йогурт')||n.includes('сметан')||n.includes('масл')||n.includes('морожен')||n.includes('сывороточ')||n.includes('whey')||n.includes('cas')||n.includes('casein')||n.includes('лактоз')) return true;
      }
      if (a === 'глютен') {
        if (n.includes('пшениц')||n.includes('мук')||n.includes('хлеб')||n.includes('макарон')||n.includes('пельмен')||n.includes('вареник')||n.includes('пицц')||n.includes('лаваш')||n.includes('булгур')||n.includes('кускус')||n.includes('манк')||n.includes('паниров')||n.includes('сухар')||n.includes('кляр')||n.includes('тест')||n.includes('блин')||n.includes('олад')||n.includes('круасс')||n.includes('багет')||n.includes('чиабат')||n.includes('лепёш')||n.includes('торт')||n.includes('пирож')||n.includes('пончик')||n.includes('печень')||n.includes('крекер')||n.includes('вафл')||n.includes('глютен')) return true;
      }
      if (a === 'орехи') {
        if (n.includes('миндаль')||n.includes('грецк')||n.includes('кешью')||n.includes('фундук')||n.includes('пекан')||n.includes('макадам')||n.includes('фисташк')||n.includes('орех')||n.includes('nut')||n.includes('almond')||n.includes('walnut')||n.includes('cashew')||n.includes('hazeln')||n.includes('pecan')||n.includes('pistach')) return true;
      }
      if (a === 'арахис') {
        if (n.includes('арахис')||n.includes('peanut')||n.includes('groundnut')||n.includes('ахид')||n.includes('землян')) return true;
      }
      if (a === 'яйца') {
        if (n.includes('яйц')||n.includes('яич')||n.includes('яичн')||n.includes('белок')||n.includes('желтк')||n.includes('омлет')||n.includes('egg')||n.includes('egg_')||n.includes('майонез')) return true;
      }
      if (a === 'соя') {
        if (n.includes('со')||n.includes('тофу')||n.includes('соев')||n.includes('edamame')||n.includes('soy')||n.includes('мисо')||n.includes('miso')||n.includes('темпе')||n.includes('tamari')) return true;
      }
      if (a === 'рыба') {
        if (n.includes('рыб')||n.includes('лосос')||n.includes('тунец')||n.includes('треск')||n.includes('палтус')||n.includes('скумбр')||n.includes('форель')||n.includes('сардин')||n.includes('сельдь')||n.includes('anchov')||n.includes('fish')||n.includes('salmon')||n.includes('tuna')||n.includes('cod')||n.includes('halibut')) return true;
      }
      if (a === 'морепродукты') {
        if (n.includes('креветк')||n.includes('краб')||n.includes('лобстер')||n.includes('омар')||n.includes('мидии')||n.includes('кальмар')||n.includes('осьминог')||n.includes('shrimp')||n.includes('crab')||n.includes('lobster')||n.includes('mussel')||n.includes('squid')||n.includes('scallop')||n.includes('устриц')||n.includes('моллюск')||n.includes('ракушк')||n.includes('langoust')) return true;
      }
      if (a === 'кунжут') {
        if (n.includes('кунжут')||n.includes('тахини')||n.includes('сезам')||n.includes('sesame')||n.includes('tahini')) return true;
      }
      if (a === 'горчица') {
        if (n.includes('горчиц')||n.includes('mustard')) return true;
      }
      if (a === 'сельдерей') {
        if (n.includes('сельдерей')||n.includes('celery')||n.includes('seler')) return true;
      }
      if (a === 'сульфиты') {
        if (n.includes('сульфит')||n.includes('sulfite')||n.includes('sulphite')||n.includes('e22')) return true;
      }
      if (a === 'люпин') {
        if (n.includes('люпин')||n.includes('lupin')||n.includes('lupine')) return true;
      }
      return false;
    };
    // Also check direct FOOD_DB allergen field as fallback
    const getDirectAllergens = (foodId: string): string[] => {
      const food = FOOD_DB.find(f => f.id === foodId);
      return food?.allergens || [];
    };

    const allergenIds = new Set<string>();
    let allergenMatchCount = 0;
    allergens.forEach(a => {
      const foodVals = userAllergenToValues[a];
      FOOD_DB.forEach(f => {
        const fAllergens = [...getFoodAllergens(f.id), ...getDirectAllergens(f.id)];
        const uniqueAllergens = [...new Set(fAllergens)];
        if (foodVals && uniqueAllergens.some(fa => foodVals.includes(fa))) {
          if (!allergenIds.has(f.id)) { allergenIds.add(f.id); allergenMatchCount++; }
        }
        if (allergenTextMatches(a, f.name)) {
          if (!allergenIds.has(f.id)) { allergenIds.add(f.id); allergenMatchCount++; }
        }
      });
    });
    setAllergenExcludedCount(allergenMatchCount);

    // Build main food pool — exclude disliked + allergen items at source
    const foods = FOOD_DB.filter(f => {
      if (f.kcal <= 0) return false;
      if (excludedIds.has(f.id)) return false;
      if (allergenIds.has(f.id)) return false;
      const score = tierScores[f.tier || 'basic'] || 5;
      return score >= bMin && score <= bMax;
    });

    const tKcal = Math.round(effectiveKcal * nutrMult);
    const tP = Math.round(effectiveP * pMod * nutrMult);
    const tF = Math.round(effectiveF * fMod * nutrMult);
    const tC = Math.round(effectiveC * cMod * nutrMult);
    setPlanTargets({ kcal: tKcal, protein: tP, fats: tF, carbs: tC });

    // Seeded random for food variety
    const seedRand = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 49297;
      return x - Math.floor(x);
    };

    // Build meal plan for 1 day then expand
    const buildDay = (dayOffset: number, isTrainingDay: boolean) => {
      const mealTimes: { time: string; label: string; pct: number }[] = [];
      const wakeMin = parseInt(wakeTime.split(':')[0]) * 60 + parseInt(wakeTime.split(':')[1]);
      const lunchMin = parseInt(lunchTime.split(':')[0]) * 60 + parseInt(lunchTime.split(':')[1]);
      const dinnerMin = parseInt(dinnerTime.split(':')[0]) * 60 + parseInt(dinnerTime.split(':')[1]);
      const bedMin = parseInt(bedTime.split(':')[0]) * 60 + parseInt(bedTime.split(':')[1]);
      const awakeMin = Math.max(1, bedMin - wakeMin);
      const pcts = [0.2, 0.2, 0.3, 0.15, 0.1, 0.05];

      // Build anchor points: label → target time
      const labelAnchor: Record<string, number> = {
        'Завтрак': wakeMin + 30,
        'Обед': lunchMin,
        'Ужин': dinnerMin,
      };
      // When training is linked, push snack/dinner to avoid training window
      const trainMin = linkToTraining && isTrainingDay ? parseInt(trainStart.split(':')[0]) * 60 + parseInt(trainStart.split(':')[1]) : 0;
      // Build meal order for this mealsCount
      const mealDefs: { label: string; anchor?: number }[] = [];
      mealDefs.push({ label: 'Завтрак', anchor: labelAnchor['Завтрак'] });
      if (mealsCount >= 5) mealDefs.push({ label: 'Второй завтрак' });
      if (mealsCount >= 3) mealDefs.push({ label: 'Обед', anchor: labelAnchor['Обед'] });
      if (mealsCount >= 4) mealDefs.push({ label: 'Полдник' });
      mealDefs.push({ label: 'Ужин', anchor: labelAnchor['Ужин'] });
      if (mealsCount >= 6) mealDefs.push({ label: 'Перекус' });

      // Distribute times — anchored ones are fixed, others interpolate between anchors
      const anchored = mealDefs.map((m, i) => {
        if (m.anchor) return { ...m, time: m.anchor, fixed: true };
        let leftAnchorIdx = i;
        let leftTime = wakeMin;
        while (leftAnchorIdx >= 0 && !mealDefs[leftAnchorIdx].anchor) leftAnchorIdx--;
        if (leftAnchorIdx >= 0) leftTime = mealDefs[leftAnchorIdx].anchor!;

        let rightAnchorIdx = i;
        let rightTime = bedMin - 30;
        while (rightAnchorIdx < mealDefs.length && !mealDefs[rightAnchorIdx].anchor) rightAnchorIdx++;
        if (rightAnchorIdx < mealDefs.length) rightTime = mealDefs[rightAnchorIdx].anchor!;

        const totalSlots = rightAnchorIdx - leftAnchorIdx;
        const thisSlot = i - leftAnchorIdx;
        let interp = totalSlots > 0 ? thisSlot / totalSlots : 0.5;
        let t = Math.round(leftTime + (rightTime - leftTime) * interp);
        // If this meal falls in training window, push it before
        if (trainMin > 0 && t >= trainMin && t <= trainMin + 90) {
          t = Math.max(leftTime + 15, trainMin - 45);
        }
        return { ...m, time: t, fixed: false };
      });

      anchored.forEach((m, i) => {
        const mMin = Math.max(wakeMin + 15, Math.min(bedMin - 15, m.time));
        const hh = Math.floor(mMin / 60);
        const mm = mMin % 60;
        mealTimes.push({
          time: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`,
          label: m.label,
          pct: pcts[i] || 0.15,
        });
      });

      // Adjust for training
      if (linkToTraining && isTrainingDay) {
        const trainH = parseInt(trainStart.split(':')[0]);
        const preTime = `${String(trainH-2).padStart(2,'0')}:00`;
        const postTime = `${String(trainH+1).padStart(2,'0')}:30`;
        // Check if existing meals already cover this window (within 45 min)
        const hasNearby = (t: string) => mealTimes.some(mt => {
          const mtMin = parseInt(mt.time.split(':')[0])*60 + parseInt(mt.time.split(':')[1]);
          const tMin = parseInt(t.split(':')[0])*60 + parseInt(t.split(':')[1]);
          return Math.abs(mtMin - tMin) <= 45;
        });
        if (!hasNearby(preTime)) { mealTimes.push({ time: preTime, label: 'Предтрен', pct: 0.1 }); }
        if (!hasNearby(postTime)) { mealTimes.push({ time: postTime, label: 'Пост-трен', pct: 0.15 }); }
        // Sort by time so display order is chronological
        mealTimes.sort((a, b) => {
          const aMin = parseInt(a.time.split(':')[0])*60 + parseInt(a.time.split(':')[1]);
          const bMin = parseInt(b.time.split(':')[0])*60 + parseInt(b.time.split(':')[1]);
          return aMin - bMin;
        });
      }

      // Cycling adjustments
      let tKcalAdj = tKcal;
      let tCAdj = tC;
      if (cyclingMode === 'macro' && !isTrainingDay) { tKcalAdj = Math.round(tKcal * 0.85); tCAdj = Math.round(tC * 0.7); }
      if (cyclingMode === 'butch') { tCAdj = isTrainingDay ? Math.round(tC * 1.3) : Math.round(tC * 0.5); }
      if (cyclingMode === 'cheatmeal' && isTrainingDay) { tKcalAdj = Math.round(tKcal * 0.85); /* cheat meal will be separate */ }
      if (cyclingMode === 'carbload' && isTrainingDay) { tCAdj = Math.round(tC * 1.5); }

      // Find training-linked injections for pre/post workout meals
      const trainLinkedInjs = injections.filter(i => i.trainLinked && i.type === 'инсулин' || i.trainLinked && i.type === 'ИФР-1');
      const hasPreWorkoutInj = trainLinkedInjs.some(i => i.trainTiming === 'before' || i.trainTiming === 'both');
      const hasPostWorkoutInj = trainLinkedInjs.some(i => i.trainTiming === 'after' || i.trainTiming === 'both');

      // Pharma-aware carb timing: insulin = 10g carbs per 1 unit
      const insulinsWithTiming = injections.filter(i => i.type === 'инсулин' && (i.esterType === 'rapid' || i.esterType === 'short'));

      // Evening low carb: reduce dinner carbs by 60%, add them to lunch
      let mealCAdjust: Record<number, number> = {};
      if (eveningLowCarb) {
        const dinnerIdx = mealTimes.findIndex(m => m.label === 'Ужин');
        const lunchIdx = mealTimes.findIndex(m => m.label === 'Обед');
        if (dinnerIdx >= 0) {
          const carbReduction = Math.round((tCAdj / mealTimes.length) * 0.6);
          mealCAdjust[dinnerIdx] = -carbReduction;
          if (lunchIdx >= 0) mealCAdjust[lunchIdx] = carbReduction;
        }
      }

      const meals = mealTimes.map((mt, idx) => {
        const p = Math.round(tP / mealTimes.length);
        const f = Math.round(tF / mealTimes.length);
        const c = Math.round(tCAdj / mealTimes.length) + (mealCAdjust[idx] || 0);
        const kcalAdj = Math.round((mealCAdjust[idx] || 0) * 4); // 1g carbs ≈ 4 kcal
        const kcal = Math.round(tKcalAdj / mealTimes.length) + kcalAdj;

        // Select items based on budget, allergens, preferences
        const items: any[] = [];
        let remainingP = p;
        let remainingF = f;
        let remainingC = c;
        const foodSeed = dayOffset * 10007 + idx * 997 + (isTrainingDay ? 3000 : 0) + (cyclingMode === 'butch' ? 5000 : 0);

        const isPreWorkout = mt.label === 'Предтрен';
        const isPostWorkout = mt.label === 'Пост-трен';
        const isPeriWorkout = isPreWorkout || isPostWorkout;

        // Pre/Post workout with training-linked insulin/IGF-1 → specific foods
        if (isPeriWorkout && trainLinkedInjs.length > 0 && isTrainingDay) {
          const needCarbs = isPreWorkout ? hasPreWorkoutInj : hasPostWorkoutInj;
          // Total insulin dose for this timing
          const timingInjs = trainLinkedInjs.filter(i =>
            (isPreWorkout && (i.trainTiming === 'before' || i.trainTiming === 'both')) ||
            (isPostWorkout && (i.trainTiming === 'after' || i.trainTiming === 'both'))
          );
          const totalInsulinDose = timingInjs.filter(i => i.type === 'инсулин').reduce((s, i) => s + i.dose, 0);
          const requiredCarbs = Math.round(totalInsulinDose * 10); // 10g per 1 unit

          // Protein: whey isolate (fast absorption)
          const iso = FOOD_DB.find(f => f.id === 'whey_isolate');
          const eggW = FOOD_DB.find(f => f.id === 'egg_white');
          if (iso && !excludedIds.has(iso.id) && !allergenIds.has(iso.id)) {
            const isoPortions = Math.min(1, remainingP / Math.max(1, iso.protein));
            items.push({ name: iso.name, id: iso.id, amount: Math.round(isoPortions * 30), kcal: Math.round(iso.kcal * isoPortions), p: Math.round(iso.protein * isoPortions), f: Math.round(iso.fat * isoPortions), c: Math.round(iso.carbs * isoPortions) });
            remainingP -= Math.round(iso.protein * isoPortions);
          }
          if (eggW && !excludedIds.has(eggW.id) && !allergenIds.has(eggW.id)) {
            const eggPortions = Math.min(1.5, remainingP / Math.max(1, eggW.protein));
            items.push({ name: eggW.name, id: eggW.id, amount: Math.round(eggPortions * 100), kcal: Math.round(eggW.kcal * eggPortions), p: Math.round(eggW.protein * eggPortions), f: Math.round(eggW.fat * eggPortions), c: Math.round(eggW.carbs * eggPortions) });
          }

          // Carbs: dextrose (post) or amylopectin (pre) for insulin coverage
          if (needCarbs && requiredCarbs > 0) {
            const carbItem = FOOD_DB.find(f => isPreWorkout ? f.id === 'amylopectin' : f.id === 'dextrose');
            if (carbItem && !excludedIds.has(carbItem.id) && !allergenIds.has(carbItem.id)) {
              const carbPortions = Math.min(2, requiredCarbs / Math.max(1, carbItem.carbs));
              items.push({ name: carbItem.name, id: carbItem.id, amount: Math.round(carbPortions * 30), kcal: Math.round(carbItem.kcal * carbPortions), p: Math.round(carbItem.protein * carbPortions), f: Math.round(carbItem.fat * carbPortions), c: Math.round(carbItem.carbs * carbPortions) });
              remainingC -= Math.round(carbItem.carbs * carbPortions);
            }
          }
          // Also add regular carbs if there's remaining need
          if (remainingC > 10 && isPostWorkout) {
            const dex = FOOD_DB.find(f => f.id === 'dextrose');
            if (dex && !excludedIds.has(dex.id) && !allergenIds.has(dex.id)) {
              const dexPortions = Math.min(2, remainingC / Math.max(1, dex.carbs));
              items.push({ name: dex.name, id: dex.id, amount: Math.round(dexPortions * 20), kcal: Math.round(dex.kcal * dexPortions), p: Math.round(dex.protein * dexPortions), f: Math.round(dex.fat * dexPortions), c: Math.round(dex.carbs * dexPortions) });
            }
          }
          // No fat for pre/post workout
          remainingF = 0;
        } else {
        // Helper: apply preferred foods + plan-type filters to any pool
        const applyFoodPrefs = (pool: any[], category: string) => {
          if (planType === 'keto' && category === 'carb') pool = pool.filter((f: any) => f.carbs < 15);
          if (planType === 'keto' && category === 'veg') pool = pool.filter((f: any) => f.carbs < 10);
          if (planType === 'vegetarian' && category === 'fat') pool = pool.filter((f: any) => f.isVegetarian !== false);
          if (planType === 'mediterranean' && category === 'fat') pool = pool.filter((f: any) => f.name.toLowerCase().includes('оливк') || f.name.toLowerCase().includes('орех') || f.name.toLowerCase().includes('авокад'));
          if (planType === 'mediterranean' && category === 'carb') pool = pool.filter((f: any) => f.name.toLowerCase().includes('киноа') || f.name.toLowerCase().includes('гречк') || f.name.toLowerCase().includes('рис') || f.name.toLowerCase().includes('овс') || f.name.toLowerCase().includes('чечевиц') || f.name.toLowerCase().includes('нут') || f.name.toLowerCase().includes('фасол') || f.name.toLowerCase().includes('макарон'));
          if (planType === 'highcarb' && category === 'carb') pool = pool.filter((f: any) => f.carbs > 50 || f.name.toLowerCase().includes('рис') || f.name.toLowerCase().includes('макарон') || f.name.toLowerCase().includes('хлеб') || f.name.toLowerCase().includes('картоф') || f.name.toLowerCase().includes('овс'));
          pool = pool.filter((f: any) => !excludedIds.has(f.id) && !allergenIds.has(f.id));
          const preferredPool = pool.filter((f: any) => preferredFoods.some((pf: string) => pf === f.id));
          return preferredPool.length >= 2 ? preferredPool : pool;
        };

        // Variety limiter: sort pool deterministically by seed, take N items
        const limitPool = (pool: any[], seed: number) => {
          if (variety === 'max') return pool;
          const sorted = [...pool].sort((a, b) => seedRand(seed + (a.id||'').length) - seedRand(seed + (b.id||'').length));
          const limit = variety === 'minimal' ? 2 : 4;
          return sorted.slice(0, Math.min(limit, sorted.length));
        };

        let protPool = foods.filter(f => f.id !== 'egg_white' && (f.category === 'protein' || f.category === 'dairy'));
        if (planType === 'vegetarian') protPool = protPool.filter(f => f.isVegetarian !== false);
        if (planType === 'mediterranean') protPool = protPool.filter(f => !f.name.toLowerCase().includes('говядин') && !f.name.toLowerCase().includes('свинин') && !f.name.toLowerCase().includes('баранин'));
        protPool = protPool.filter(f => !excludedIds.has(f.id) && !allergenIds.has(f.id));
        const prefProtPool = protPool.filter(f => preferredFoods.some(pf => pf === f.id));
        const mixProtPool = limitPool(prefProtPool.length >= 2 ? prefProtPool : protPool, foodSeed + 1);
        if (mixProtPool.length > 0) {
          const protIdx = Math.floor(seedRand(foodSeed + 1) * mixProtPool.length);
          const prot = mixProtPool[protIdx % mixProtPool.length];
          const portions = Math.min(1.5, remainingP / Math.max(1, prot.protein));
          items.push({ name: prot.name, id: prot.id, amount: Math.round(portions * 100), kcal: Math.round(prot.kcal * portions), p: Math.round(prot.protein * portions), f: Math.round(prot.fat * portions), c: Math.round(prot.carbs * portions) });
          remainingP -= Math.round(prot.protein * portions);
        }

        // Carb source
        if (remainingC > 5) {
          let carbPool = foods.filter(f => f.category === 'carb' || f.category === 'grain');
          carbPool = limitPool(applyFoodPrefs(carbPool, 'carb'), foodSeed + 2);
          if (carbPool.length > 0) {
            let carbAmount = remainingC;
            const mealMin = parseInt(mt.time.split(':')[0]) * 60 + parseInt(mt.time.split(':')[1]);
            insulinsWithTiming.forEach(ins => {
              const injMin = parseInt(ins.time.split(':')[0]) * 60 + parseInt(ins.time.split(':')[1]);
              const diff = Math.abs(mealMin - injMin);
              if (diff <= 45) {
                const requiredCarbs = Math.round(ins.dose * 10);
                carbAmount = Math.max(carbAmount, requiredCarbs);
              }
            });
            const carbIdx = Math.floor(seedRand(foodSeed + 2) * carbPool.length);
            const carb = carbPool[carbIdx % carbPool.length];
            const portions = Math.min(1.2, carbAmount / Math.max(1, carb.carbs));
            items.push({ name: carb.name, id: carb.id, amount: Math.round(portions * 100), kcal: Math.round(carb.kcal * portions), p: Math.round(carb.protein * portions), f: Math.round(carb.fat * portions), c: Math.round(carb.carbs * portions) });
          }
        }

        // Fat source
        const isInsulinWindow = insulinsWithTiming.some(ins => {
          const mealMin = parseInt(mt.time.split(':')[0]) * 60 + parseInt(mt.time.split(':')[1]);
          const injMin = parseInt(ins.time.split(':')[0]) * 60 + parseInt(ins.time.split(':')[1]);
          return Math.abs(mealMin - injMin) <= 90;
        });
        if (remainingF > 3 && !mt.label.includes('Предтрен') && !mt.label.includes('Пост-трен') && !isInsulinWindow) {
          let fatPool = foods.filter(f => f.category === 'fat');
          fatPool = limitPool(applyFoodPrefs(fatPool, 'fat'), foodSeed + 3);
          if (fatPool.length > 0) {
            const fatIdx = Math.floor(seedRand(foodSeed + 3) * fatPool.length);
            const fat = fatPool[fatIdx % fatPool.length];
            const portions = Math.min(0.3, remainingF / Math.max(1, fat.fat));
            items.push({ name: fat.name, id: fat.id, amount: Math.max(5, Math.round(portions * 100)), kcal: Math.round(fat.kcal * portions), p: Math.round(fat.protein * portions), f: Math.round(fat.fat * portions), c: Math.round(fat.carbs * portions) });
          }
        }

        // Vegetables
        const vegPool = limitPool(applyFoodPrefs(FOOD_DB.filter(f => f.category === 'veg_fruit'), 'veg'), foodSeed + 4);
        if (vegPool.length > 0) {
          const vegIdx = Math.floor(seedRand(foodSeed + 4) * vegPool.length);
          const v = vegPool[vegIdx % vegPool.length];
          items.push({ name: v.name, id: v.id, amount: 80, kcal: Math.round(v.kcal * 0.8), p: Math.round(v.protein * 0.8), f: Math.round(v.fat * 0.8), c: Math.round(v.carbs * 0.8) });
        }
        } // end else (regular meal)

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
    const aasCount = injections.filter(i => i.type === 'ААС').length;
    const insulinCount = injections.filter(i => i.type === 'инсулин').length;
    const ghCount = injections.filter(i => i.type === 'ГР').length;
    const pharmaHeavy = aasCount + insulinCount + ghCount;
    const pharmaBaseMl = hasPharma ? Math.min(45, 40 + pharmaHeavy * 1.5) : 30; // 40-45 ml/kg by pharma load
    const baseWaterMl = weight * pharmaBaseMl;
    const baseWater = baseWaterMl / 1000;
    // Training bonus proportional to weekly minutes (0.3L per hour of training)
    const weeklyTrainMin = (s?.workoutsPerWeek || 0) * (s?.avgWorkoutMinutes || 60);
    const trainBonus = Math.round((weeklyTrainMin / 60) * 0.3 * 10) / 10;
    // Fiber factor proportional to fiber target (0.1L per 10g fiber)
    const fiberTarget = Math.round(effectiveC * 0.025); // ~2.5% of carbs as fiber
    const fiberFactor = Math.round((fiberTarget / 10) * 0.1 * 10) / 10;
    // Pharma bonus: AAS/injectables = +0.1L per injectable, insulin = +0.3L
    const pharmaBonus = hasPharma ? Math.round((0.5 + aasCount * 0.15 + insulinCount * 0.3 + ghCount * 0.1) * 10) / 10 : 0;
    const waterTotal = Math.max(1.5, Math.round((baseWater + trainBonus + fiberFactor + pharmaBonus) * 10) / 10);
    setWaterCalc({ baseWater: Math.round(baseWater * 10) / 10, pharmaBaseMl: Math.round(pharmaBaseMl), trainBonus, fiberFactor, pharmaBonus, total: waterTotal, hasPharma });

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
      const hasShortInsulin = injections.some(i => i.type === 'инсулин' && i.esterType !== 'long');
      const hasGH = injections.some(i => i.type === 'ГР' || i.type === 'GHRP' || i.type === 'CJC');
      const hasIGF = injections.some(i => i.type === 'ИФР-1');
      const hasGLP = injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид');
      const hasAAS = injections.some(i => i.type === 'ААС');
      const trainLinkedInj = injections.some(i => i.trainLinked);
      const totalInsulinDose = injections.filter(i => i.type === 'инсулин' && i.esterType !== 'long').reduce((s, i) => s + i.dose, 0);
      if (hasAAS) recs.push('💉 На курсе ААС: белок +0.3г/кг (до 2.5-3г/кг). Вода 40мл/кг. Контроль АД и липидов. Добавки: расторопша, артишок, NAC, омега-3, CoQ10.');
      if (hasShortInsulin || hasInsulin) {
        const fatRestrictionMsg = `🍔 НА ИНСУЛИНЕ — МИНИМУМ ЖИРОВ в окне действия: жиры замедляют всасывание углеводов и усиливают инсулинорезистентность. В приёмах пищи в течение 2ч после инъекции короткого/быстрого инсулина — жиры не более 5г.`;
        recs.push(`💉 Инсулин: ${totalInsulinDose}ЕД × 10г = ${totalInsulinDose * 10}г углеводов за инъекцию. Минимум 150г углеводов/день. Быстрые углеводы (декстроза, сок) под рукой. ПРОПУСК ЕДЫ КРИТИЧЕН — гипогликемия развивается за 15-30 минут!`);
        recs.push(fatRestrictionMsg);
        recs.push(`📊 ПОЛНЫЙ КОНТРОЛЬ ГЛЮКОЗЫ: измерять через 15, 30, 60, 90, 120 минут после инъекции. Цель — не ниже 3.9 ммоль/л. Глюкометр обязателен! При уровне <3.5 ммоль/л — немедленно 15-20г быстрых углеводов (сок/глюкоза/декстроза), повторный замер через 15 мин.`);
        recs.push(`⏰ ПРАВИЛО 4 ЧАСОВ: короткий инсулин (NovoRapid/Хумулин) действует ~4 часа. Каждый час после укола — минимум 10-15г углеводов на подержание. Длинный инсулин (Лантус/Тресиба/Левемир) — равномерно распределяй углеводы по дню.`);
        recs.push(`🛑 НЕ ПРИНИМАЙ КОРОТКИЙ ИНСУЛИН НА НОЧЬ! Риск ночной гипогликемии — потеря сознания во сне. Последняя инъекция — не позднее 18:00.`);
        recs.push(`🍬 ЭКСТРЕННЫЙ НАБОР: всегда носи при себе — 200мл сладкого сока, 3-4 таблетки глюкозы (по 5г), конфеты/сахар-рафинад, банан. Для тренировки — изотоник 6-8% + банан. Информируй окружающих о диабетической аптечке.`);
        recs.push(`🏥 СИМПТОМЫ ГИПОГЛИКЕМИИ: лёгкая (<3.5 ммоль/л) — потливость, голод, дрожь, сердцебиение. Умеренная (<3.0) — спутанность, агрессия, нарушение речи. Тяжёлая (<2.5) — потеря сознания, судороги — ВЫЗОВ СКОРОЙ (глюкагон 1 мг в/м).`);
        recs.push(`🧬 ЖИРОНАКОПЛЕНИЕ НА ИНСУЛИНЕ: инсулин — мощный липогенный гормон. В окне его действия организм не использует жиры как энергию — наоборот, запасает. Поэтому жиры в рационе при инсулинотерапии не должны превышать 0.5г/кг.`);
        recs.push(`🔄 ИНСУЛИН + НАБОР МАССЫ: инсулин потенцирует синтез гликогена и белка. В паре с ААС/ГР даёт синергию анаболизма. НО — после отмены инсулина уменьши потребление углеводов на 30% за 3-5 дней, иначе быстрый набор жира.`);
        recs.push(`⚠️ ИНСУЛИН ПОСЛЕ КУРСА ГР/ААС: чувствительность к инсулину может быть снижена на 20-30% — корректируй дозу по глюкометру. Не повышай дозу выше 10-15 ЕД за раз без врача!`);
      }
      if (trainLinkedInj) recs.push('🏋️ Инсулин/ИФР-1/MGF привязаны к тренировке: до тренировки (за 90мин) — изолят сывороточного белка (40-50г) + амилопектин (80-100г). После тренировки (немедленно) — изолят сывороточного белка (40-50г) + декстроза (80-120г из расчёта 10г на 1ЕД). НА ТРЕНИРОВКЕ ОБЯЗАТЕЛЬНО: изотоник 500-1000мл + банан/гейнер — каждые 20 мин по 100мл.🚨 Не допускай пустого желудка на тренировке с инсулином! Пред-тренировочный приём — минимум за 90 мин или внутривенный изотоник во время.');
      if (hasGH) recs.push('🧬 Гормон роста: избегать углеводов в окне 60мин до/после укола (пик ГР, подавляет утилизацию глюкозы). Увеличить воду на 0.5-1л. Контроль глюкозы — ГР снижает чувствительность к инсулину на 20-50%. При долгом курсе — HOMA-IR каждые 4 нед.');
      if (hasIGF) {
        recs.push('🧬 ИФР-1 (IGF-1 LR3/DES): натощак за 30-45 мин до еды — не есть и не пить сладкое. Синергия с инсулином 100% — усиление анаболизма в разы. НО: гипогликемия вдвойне опасна. Контроль глюкозы обязателен при комбинации. Жиры минимизировать — IGF-1 улучшает утилизацию глюкозы, жиры замедляют этот эффект. Максимальный анаболический ответ: ИФР-1 + инсулин + глюкоза + аминокислоты (BCAA/изолят). Пропуск еды после ИФР-1 — гипогликемия. Держи глюкометр под рукой.');
        recs.push('🔬 MGF (Механо-фактор): активирует сателлитные клетки в зоне нагрузки. Действует локально, а не на весь организм. Питание: те же принципы что и для ИФР-1 — натощак, контроль глюкозы, жиры минимум. Синергия с ИФР-1 (каскад GHRP→ГР→ИФР-1→MGF).');
      }
      if (hasGLP) recs.push('💊 GLP-1 (семаглутид/тирзепатид): дробное питание 5-6 раз маленькими порциями (100-200г за приём). Избегать жирного — замедляет опорожнение желудка, усиливает тошноту и риск панкреатита. Контроль тошноты — первые 4-8 нед самые сложные. За 3 дня до инъекции и 3 дня после — диета с минимальным содержанием жиров (<30г/день). Употреблять много воды — снижает риск запора. НЕ ПЕРЕЕДАТЬ — растяжение желудка на GLP-1 вызывает сильнейшую тошноту. Отказ от алкоголя на время курса. Контроль поджелудочной: при болях в левом подреберье — прекратить приём, срочно к врачу. Витамин B12 и электролиты — дополнительно (GLP-1 снижает всасывание B12 и минералов).');
      recs.push('💉 Фарма поддержка: расторопша/артишок/NAC для печени, омега-3 + CoQ10 для сердца, электролиты (калий 4000+мг, магний 500+мг).');
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

  // Auto-regenerate recommendations when injections change
  useEffect(() => {
    if (generated && dayPlan) generateRecommendations();
  }, [injections.length]);

  // Save plan
  const saveCurrentPlan = () => {
    const name = prompt('Название плана:', `${new Date().toLocaleDateString('ru-RU')} · ${Math.round(dayPlan?.totals?.kcal || 0)} ккал`);
    if (name === null) return;
    const plan: SavedPlan = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      name,
      dayPlan, threeDayPlan, weekPlan, shoppingList, waterCalc,
    };
    const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)].slice(0, 10);
    setSavedPlans(updated);
    localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated));
  };

  // ─── Auto-correction: adjust remaining meals ───
  const autoCorrectPlan = () => {
    if (!dayPlan || !dayPlan.meals) return;
    const dayTargetPct = { kcal: effectiveKcal, p: effectiveP, f: effectiveF, c: effectiveC };
    const currentTotals = dayPlan.totals || { kcal: 0, p: 0, f: 0, c: 0 };
    const remaining = {
      kcal: Math.max(0, dayTargetPct.kcal - currentTotals.kcal),
      p: Math.max(0, dayTargetPct.p - currentTotals.p),
      f: Math.max(0, dayTargetPct.f - currentTotals.f),
      c: Math.max(0, dayTargetPct.c - currentTotals.c),
    };
    // Skip the last meal (already consumed), adjust future meals
    const futureMeals = dayPlan.meals.filter((m: any) => !m.label.includes('Завтрак') && !m.label.includes('Предтрен'));
    if (futureMeals.length === 0) return;
    const perMeal = { kcal: Math.round(remaining.kcal / futureMeals.length), p: Math.round(remaining.p / futureMeals.length), f: Math.round(remaining.f / futureMeals.length), c: Math.round(remaining.c / futureMeals.length) };
    setDayPlan((prev: any) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m: any) => {
        if (m.label.includes('Завтрак') || m.label.includes('Предтрен')) return m;
        const ratio = Math.max(0.3, Math.min(1.7, perMeal.kcal / Math.max(1, m.totals?.kcal || 1)));
        const items = m.items.map((it: any) => ({ ...it, amount: Math.round(it.amount * ratio), kcal: Math.round(it.kcal * ratio), p: Math.round(it.p * ratio), f: Math.round(it.f * ratio), c: Math.round(it.c * ratio) }));
        const totals = { kcal: items.reduce((s: number, i: any) => s + i.kcal, 0), p: items.reduce((s: number, i: any) => s + i.p, 0), f: items.reduce((s: number, i: any) => s + i.f, 0), c: items.reduce((s: number, i: any) => s + i.c, 0) };
        return { ...m, items, totals };
      });
      const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) };
      return { ...prev, meals, totals };
    });
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
  const [nutritionReport, setNutritionReport] = useState<NutritionReport | null>(null);

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
        if (mealAtInjTime) {
          if (mealAtInjTime.totals.p < 30) warnings.push(`🧬 ${inj.name}: в окне нужно ≥30г белка. Приём ${mealAtInjTime.time} содержит ${Math.round(mealAtInjTime.totals.p)}г.`);
          if (mealAtInjTime.totals.f > 5) warnings.push(`🥑 ${inj.name}: в окне не более 5г жиров (замедляют всасывание и блокируют IGF-1R сигналинг). Приём ${mealAtInjTime.time} содержит ${Math.round(mealAtInjTime.totals.f)}г жиров.`);
          const fastCarbs = mealAtInjTime.items.filter((it: any) => {
            const food = FOOD_DB.find(f => f.id === it.id);
            return food?.gi && food.gi >= 80;
          });
          if (fastCarbs.length === 0 && (t.includes('igf') || t.includes('ифр'))) warnings.push(`🍚 ${inj.name}: быстрые углеводы (декстроза/сок) нужны для потенцирования анаболизма IGF-1.`);
        }
      }
      if (t.includes('семаглутид') || t.includes('тирзепатид')) {
        warnings.push('💊 GLP-1: дробное питание 5-6р/д по 100-200г. Жиры <5г/приём. Не переедать — тошнота, риск панкреатита. Обильное питьё. Контроль B12 и электролитов. Алкоголь исключить.');
        const fattyMeals = dayPlan.meals.filter((m: any) => (m.totals.f || 0) > 15);
        if (fattyMeals.length > 0) interactions.push({ drug: inj.name, food: `${fattyMeals.length} приёмов с >15г жиров`, effect: 'Замедление опорожнения желудка, тошнота, риск острого панкреатита', severity: 'high' });
        const largeMeals = dayPlan.meals.filter((m: any) => m.items && m.items.reduce((s: number, i: any) => s + i.amount, 0) > 400);
        if (largeMeals.length > 0) interactions.push({ drug: inj.name, food: `${largeMeals.length} приёмов >400г еды за раз`, effect: 'Растяжение желудка, рвота, рефлюкс-эзофагит', severity: 'high' });
        const alcoholItems = dayPlan.meals.flatMap((m: any) => m.items).filter((i: any) => i.name?.toLowerCase().includes('алкоголь') || i.name?.toLowerCase().includes('вино') || i.name?.toLowerCase().includes('пиво'));
        if (alcoholItems.length > 0) interactions.push({ drug: inj.name, food: 'Алкоголь', effect: 'Усиление тошноты, риск острого панкреатита, дегидратация', severity: 'high' });
      }
    });

    if (warnings.length === 0) warnings.push('✅ Все препараты совместимы с рационом');
    setDrugCompatReport({ interactions, warnings });
    setActiveReports(prev => prev.includes('drug') ? prev : [...prev, 'drug']);
  };

  const generateFullNutritionReport = () => {
    if (!dayPlan) return;
    const meals = dayPlan.meals.map((m: any) => ({
      label: m.label,
      items: m.items.map((i: any) => ({ name: i.name, id: i.id || '', amount: i.amount || 100, kcal: i.kcal||0, p: i.p||0, f: i.f||0, c: i.c||0 })),
      totals: { kcal: m.totals?.kcal || 0, p: m.totals?.p || 0, f: m.totals?.f || 0, c: m.totals?.c || 0 },
      time: m.time || '',
    }));
    const rep = generateNutritionReport({
      meals, totals: { kcal: dayPlan.totals.kcal, p: dayPlan.totals.p, f: dayPlan.totals.f, c: dayPlan.totals.c },
      targets: { kcal: planTargets.kcal, protein: planTargets.protein, fats: planTargets.fats, carbs: planTargets.carbs },
      userWeight: getProfileSafe()?.settings?.weight || 80,
      userTDEE: planTargets.kcal,
      healthIssues, planType, variety, budget,
      allergens, cyclingMode,
      goal: getProfileSafe()?.settings?.primaryGoal || 'maintenance',
      waterMl: waterCalc?.total ? Math.round(waterCalc.total * 1000) : 0,
      injections: injections.map(i => ({ type: i.type, dose: i.dose, name: i.name, time: i.time })),
      workoutTime: linkToTraining && trainingDays.some(Boolean) ? trainStart : undefined,
    });
    setNutritionReport(rep);
    setActiveReports(prev => prev.includes('nutrition') ? prev : [...prev, 'nutrition']);
    // Save to archive
    try {
      const arch = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
      arch.unshift(rep);
      localStorage.setItem('he_nutrition_report_archive', JSON.stringify(arch.slice(0, 50)));
    } catch {}
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
          border: d.isTrainingDay ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.06)',
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
                  color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.85)',
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
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>ккал</div>
              </div>
            </div>
            {/* Day macro summary row */}
            <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>💪 {totalP}г Б</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>🧈 {totalF}г Ж</span>
              <span style={{ color: '#f97316', fontWeight: 600 }}>🌾 {totalC}г У</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.85)' }}>
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
              border: `1px solid ${dropTarget === mi ? 'rgba(0,230,138,0.4)' : isPreWorkout ? 'rgba(139,92,246,0.2)' : isPostWorkout ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.15)'}`,
              transition: 'all 0.2s',
              background: dropTarget === mi ? 'rgba(0,230,138,0.04)' : undefined,
            }}
              onDragOver={e => { e.preventDefault(); setDropTarget(mi); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={e => { e.preventDefault(); if (draggedItem && draggedItem.mealIdx !== mi) { moveFoodItem(draggedItem.mealIdx, mi, draggedItem.itemIdx); } setDropTarget(null); }}>
              {/* Meal header */}
              <div style={{
                padding: '7px 10px 5px',
                background: isPreWorkout ? 'rgba(139,92,246,0.06)' : isPostWorkout ? 'rgba(245,158,11,0.06)' : '#202023',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{mealKcal} ккал</span>
                  <span onClick={() => setRecipePickerMeal({ dayIdx: 0, mealIdx: mi, label: m.label })} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#a78bfa', cursor: 'pointer', fontWeight: 600, lineHeight: '14px' }} title="Заменить рецептом">🍳</span>
                  <span onClick={() => { const name = prompt('Добавить продукт:'); if (!name) return; const food = FOOD_DB.find((f: any) => f.name.toLowerCase().includes(name.toLowerCase())); if (!food) return; setDayPlan((prev: any) => { if (!prev) return prev; const meals = prev.meals.map((m: any, i: number) => { if (i !== mi) return m; const items = [...m.items, { name: food.name, id: food.id, amount: 100, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs }]; return { ...m, items, totals: { kcal: items.reduce((s: number, it: any) => s + it.kcal, 0), p: items.reduce((s: number, it: any) => s + it.p, 0), f: items.reduce((s: number, it: any) => s + it.f, 0), c: items.reduce((s: number, it: any) => s + it.c, 0) } }; }); const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; }); }} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a', cursor: 'pointer', fontWeight: 600 }} title="Добавить продукт">+</span>
                  <span onClick={() => { saveUndo(); const copy = JSON.parse(JSON.stringify(dayPlan?.meals?.[mi])); if (!copy) return; setDayPlan((prev: any) => { if (!prev) return prev; const meals = [...prev.meals]; const insertAt = Math.min(mi + 1, meals.length); const dup = { ...copy, label: copy.label + ' (копия)', time: (() => { const [h, m] = (copy.time || '12:00').split(':').map(Number); const t = h * 60 + m + 30; return `${String(Math.floor(t / 60) % 24).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`; })() }; meals.splice(insertAt, 0, dup); const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; }); }} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }} title="Копировать приём">📋</span>
                  <span onClick={() => { saveUndo(); setDayPlan((prev: any) => { if (!prev) return prev; const meals = prev.meals.filter((_: any, i: number) => i !== mi); const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; }); }} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#ef4444', cursor: 'pointer', fontWeight: 600, lineHeight: '14px' }} title="Удалить приём">✕</span>
                  {mi > 0 && <span onClick={() => { saveUndo(); setDayPlan((prev: any) => { if (!prev) return prev; const meals = [...prev.meals]; [meals[mi-1], meals[mi]] = [meals[mi], meals[mi-1]]; const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; }); }} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 4, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600 }} title="Вверх">↑</span>}
                  {mi < (dayPlan?.meals?.length || 1) - 1 && <span onClick={() => { saveUndo(); setDayPlan((prev: any) => { if (!prev) return prev; const meals = [...prev.meals]; [meals[mi], meals[mi+1]] = [meals[mi+1], meals[mi]]; const totals = { kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0), p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0), f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0), c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0) }; return { ...prev, meals, totals }; }); }} style={{ fontSize: 7, padding: '2px 5px', borderRadius: 4, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600 }} title="Вниз">↓</span>}
                </div>
              </div>
              {/* Meal items */}
              <div style={{ padding: '6px 10px 8px', background: '#18181b' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {m.items.map((it: any, ii: number) => {
                    const isEditing = editItem?.mealIdx === mi && editItem?.itemIdx === ii;
                    const isReplacing = replacingItem?.mealIdx === mi && replacingItem?.itemIdx === ii;
                    const similar = isReplacing ? findSimilarFoods(it) : [];
                    return <span key={ii} draggable={!isEditing && !isReplacing} onDragStart={e => { e.dataTransfer.setData('text/plain', `${mi}:${ii}`); setDraggedItem({ mealIdx: mi, itemIdx: ii }); }} style={{
                      padding: '3px 6px', borderRadius: 6, fontSize: 8,
                      background: isEditing ? 'rgba(59,130,246,0.08)' : isReplacing ? 'rgba(245,158,11,0.08)' : '#202023',
                      border: `1px solid ${isEditing ? 'rgba(59,130,246,0.2)' : isReplacing ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.15)'}`,
                      cursor: 'grab',
                      color: '#fff',
                      display: 'inline-flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
                    }}>
                      {isEditing ? (
                        <>
                          <input type="number" defaultValue={it.amount} onChange={e => setEditAmount(+e.target.value || 0)} style={{ width: 40, padding: '1px 4px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)', background: '#18181b', color: '#fff', fontSize: 8 }} />
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>г</span>
                          <button onClick={() => updateItemAmount(0, mi, ii, editAmount || it.amount)} style={{ padding: '1px 4px', borderRadius: 3, border: 'none', background: 'rgba(0,230,138,0.15)', color: '#00e68a', cursor: 'pointer', fontSize: 7 }}>✓</button>
                          <button onClick={() => setEditItem(null)} style={{ padding: '1px 4px', borderRadius: 3, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 7 }}>✕</button>
                        </>
                      ) : isReplacing ? (
                        <>
                          <span style={{ fontWeight: 600 }}>{it.name}</span>
                          <select onChange={e => { if (e.target.value) { const f = FOOD_DB.find(x => x.id === e.target.value); if (f) replaceFoodItem(0, mi, ii, f); } }} value="" style={{ fontSize: 7, padding: '1px 2px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)', background: '#18181b', color: '#fff', maxWidth: 120 }}>
                            <option value="">🔀 Заменить...</option>
                            {similar.map(s => <option key={s.id} value={s.id}>{s.name} (Б{s.protein}/Ж{s.fat}/У{s.carbs})</option>)}
                          </select>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600 }}>{it.name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 7 }}>{it.amount}г</span>
                          <span onClick={() => addToCart({ name: it.name, kcal: it.kcal * (it.amount / 100), amount: it.amount, category: it.category })} style={{ cursor:'pointer', fontSize:7, color:'#00e68a', opacity:0.35, padding:'0 2px', transition:'opacity 0.15s' }} title="В корзину">🛒</span>
                          <span onClick={() => { setEditItem({ dayIdx: 0, mealIdx: mi, itemIdx: ii }); setEditAmount(it.amount); }} style={{ cursor:'pointer', fontSize:7, color:'rgba(255,255,255,0.8)', padding:'0 2px' }} title="Изменить вес">✏️</span>
                          <span onClick={() => setReplacingItem({ dayIdx: 0, mealIdx: mi, itemIdx: ii })} style={{ cursor:'pointer', fontSize:7, color:'rgba(245,158,11,0.4)', padding:'0 2px' }} title="Аналог">🔄</span>
                          <span onClick={() => removeFoodItem(0, mi, ii)} style={{ cursor:'pointer', fontSize:7, color:'rgba(239,68,68,0.3)', padding:'0 2px' }} title="Удалить">✕</span>
                        </>
                      )}
                    </span>;
                  })}
                </div>
                {/* Meal micro-macros row */}
                {m.totals && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 7 }}>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>Б {mealP}г</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Ж {mealF}г</span>
                    <span style={{ color: '#f97316', fontWeight: 600 }}>У {mealC}г</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 'auto' }}>
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
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '1px' }}>ИТОГО ЗА ДЕНЬ</span>
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
                      <span style={{ color: isOver ? '#ef4444' : 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
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
                    <div style={{ fontSize: 7, color: isOver ? '#ef4444' : 'rgba(255,255,255,0.85)', textAlign: 'right', marginTop: 1 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80, maxWidth: 540, margin: '0 auto' }}>

      {/* 1. User info card */}
      <GlassCard title="Пользователь" icon="👤" color="#a78bfa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Вес (кг)</label><input type="number" value={weight} onChange={e => setWeight(+e.target.value || 0)} style={inputStyle} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Рост (см)</label><input type="number" value={height} onChange={e => setHeight(+e.target.value || 0)} style={inputStyle} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Возраст</label><input type="number" value={age} onChange={e => setAge(+e.target.value || 0)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div>
            <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Пол</label>
            <select value={sex} onChange={e => setSex(e.target.value as any)} style={selectStyle}>
              <option value="male">Мужской</option><option value="female">Женский</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Шагов/день</label>
            <input type="number" value={dailySteps} onChange={e => setDailySteps(+e.target.value || 0)} style={inputStyle} />
          </div>
        </div>
        <button onClick={() => {
          setWeight(s?.weight || weight);
          setHeight(s?.height || height);
          setAge(s?.age || age);
          setSex(s?.sex || sex);
          setDailySteps(s?.dailySteps || dailySteps);
        }} style={{
          width:'100%', padding:'5px 8px', borderRadius:8, cursor:'pointer', fontSize:8, fontWeight:600,
          background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)', color:'#60a5fa',
          marginBottom:8,
        }}>👤 Автозаполнение из профиля</button>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Время на готовку (мин/день)</label>
          <input type="number" value={cookTimeMin} onChange={e => setCookTimeMin(+e.target.value || 0)} style={inputStyle} />
        </div>
      </GlassCard>

      {/* 2. Goal card */}
      <GlassCard title="Цель" icon="🎯" color="#00e68a">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {GOALS.map(g => (
            <PillBtn key={g.id} active={goal === g.id} onClick={() => { setGoal(g.id); setGoalUserSet(true); }} color={goal === g.id ? '#00e68a' : undefined}>
              {g.icon} {g.label}
              {autoGoal === g.id && !goalUserSet && <span style={{ marginLeft: 3, fontSize: 7, color: '#00e68a', fontWeight: 800 }}>⚡</span>}
            </PillBtn>
          ))}
        </div>
        {autoGoal !== goal && goalUserSet && (
          <div style={{ marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Фаза «{PHASES.find(p => p.id === phase)?.label}» → рекомендована цель «{GOALS.find(g => g.id === autoGoal)?.label}».
            <span onClick={() => { setGoal(autoGoal); setGoalUserSet(false); }} style={{ color: '#00e68a', cursor: 'pointer', fontWeight: 600, marginLeft: 2 }}>Применить</span>
          </div>
        )}
      </GlassCard>

      {/* 3. Phase + drugs card */}
      <GlassCard title="Фаза и препараты" icon="💉" color="#06b6d4">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
          {PHASES.map(p => (
            <PillBtn key={p.id} active={phase === p.id} onClick={() => setPhase(p.id)}>{p.icon} {p.label}</PillBtn>
          ))}
        </div>
        {courseEntries.length > 0 && (
          <div style={{ fontSize: 9, color: '#a78bfa', marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            📋 Загружено {courseEntries.length} препаратов из курса
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, marginBottom: 6 }}>Добавленные инъекции:</div>
        <div style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {injections.map((inj, i) => {
            const canLink = inj.type === 'инсулин' || inj.type === 'ИФР-1';
            return (
            <div key={inj.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#fff' }}>
                <span>💉</span>
                <strong style={{ color: '#06b6d4' }}>{inj.time}</strong>
                <span style={{ fontWeight: 600 }}>{inj.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{inj.dose}{inj.unit}</span>
                {inj.esterType !== 'none' && <span style={{color:'rgba(255,255,255,0.8)',fontSize:8}}>({inj.esterType})</span>}
                {canLink && (
                  <button onClick={() => {
                    if (!linkToTraining) setLinkToTraining(true);
                    setInjections(injections.map((j2, j) => j === i ? { ...j2, trainLinked: !j2.trainLinked, trainTiming: !j2.trainLinked ? 'before' : 'none' } : j2));
                  }} style={{
                    fontSize: 7, padding: '2px 5px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
                    background: inj.trainLinked ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                    border: inj.trainLinked ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: inj.trainLinked ? '#00e68a' : '#fff',
                  }}>🏋️</button>
                )}
                {canLink && inj.trainLinked && (['before', 'after', 'both'] as const).map(t => (
                  <button key={t} onClick={() => setInjections(injections.map((j2, j) => j === i ? { ...j2, trainTiming: t } : j2))} style={{
                    fontSize: 6, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', fontWeight: 600,
                    background: inj.trainTiming === t ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: inj.trainTiming === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: inj.trainTiming === t ? '#60a5fa' : '#fff',
                  }}>{t === 'before' ? 'До' : t === 'after' ? 'После' : 'До+После'}</button>
                ))}
                <button onClick={() => setInjections(injections.filter((_, j) => j !== i))} style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', fontSize: 10, cursor: 'pointer', borderRadius: 4, padding: '2px 6px' }}>✕</button>
              </div>
            </div>);
          })}
        </div>
        <button onClick={() => setShowAddDrug(true)} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(6,182,212,0.2)', background:'rgba(6,182,212,0.06)', color:'#06b6d4', fontSize:9, fontWeight:600 }}>
          + Добавить инъекцию
        </button>
        {showAddDrug && (
          <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)' }}
            onClick={() => setShowAddDrug(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width:320, padding:20, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.15)', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginBottom:14, textAlign:'center', letterSpacing:-0.3 }}>💉 Добавить</div>
              <input value={injName} onChange={e => setInjName(e.target.value)} placeholder="Название препарата" style={{ ...inputStyle, marginBottom:6, fontSize:12 }} list="drug-list" />
              <datalist id="drug-list">{injectDrugTypes.map(d => <option key={d} value={d} />)}</datalist>
              <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                <select value={injType} onChange={e => setInjType(e.target.value)} style={{ ...selectStyle, flex:1, fontSize:10 }}>
                  {injectDrugTypes.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={injEster} onChange={e => setInjEster(e.target.value as any)} style={{ ...selectStyle, flex:1, fontSize:10 }}>
                  <option value="none">Авто</option><option value="rapid">Быстрый</option><option value="short">Короткий</option><option value="long">Длинный</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                <input type="number" value={injDose} onChange={e => setInjDose(+e.target.value || 0)} style={{ ...inputStyle, flex:1, fontSize:12 }} placeholder="Доза" />
                <select value={injUnit} onChange={e => setInjUnit(e.target.value)} style={{ ...selectStyle, width:50, fontSize:10 }}>
                  <option value="mg">mg</option><option value="mcg">mcg</option><option value="IU">IU</option><option value="ml">ml</option>
                </select>
                <input type="time" value={injTime} onChange={e => setInjTime(e.target.value)} style={{ ...inputStyle, width:65, fontSize:10 }} />
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={() => setShowAddDrug(false)} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', fontSize:10, fontWeight:600 }}>Отмена</button>
                <button onClick={() => {
                  if (!injName.trim()) return;
                  const sub = PHARMA_DB[injName.trim()]; const hl = sub?.pk?.halfLifeHours || 24;
                  let dt = injType, de = injEster;
                  if (sub?.class === 'insulin') { dt = 'инсулин'; de = hl < 2 ? 'rapid' : hl <= 8 ? 'short' : 'long'; }
                  let autoTime = +injTime.split(':')[0] * 60 + +injTime.split(':')[1] > 0 ? injTime : '08:00';
                  if (dt === 'инсулин' && de === 'long') autoTime = '22:00';
                  if (injEster !== 'none') de = injEster;
                  const newInj = { id: Date.now().toString(), name: injName.trim(), time: autoTime, dose: injDose, unit: injUnit, type: dt, esterType: de, halfLifeHours: hl, trainLinked: false, trainTiming: 'none' as const };
                  setInjections(prev => [...prev, newInj]);
                  setInjName(''); setShowAddDrug(false);
                }} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:10, fontWeight:700 }}>✓ Добавить</button>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* 4. Training link */}
      <GlassCard title="Привязка к тренировке" icon="🏋️" color="#22c55e">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={() => setLinkToTraining(!linkToTraining)} style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none',
            background: linkToTraining ? '#00e68a' : 'rgba(255,255,255,0.7)',
            position: 'relative' as const, transition: 'background 0.2s',
          }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: linkToTraining ? 18 : 2, transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: 10, color: linkToTraining ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>Привязать рацион к тренировке</span>
        </div>
        {linkToTraining && (
          <>
            <div style={{ display: 'flex', gap: 4, fontSize: 9, marginBottom: 6 }}>
              <div><label style={{ color: 'rgba(255,255,255,0.85)' }}>Начало</label><input type="time" value={trainStart} onChange={e => setTrainStart(e.target.value)} style={inputStyle} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.85)' }}>Конец</label><input type="time" value={trainEnd} onChange={e => setTrainEnd(e.target.value)} style={inputStyle} /></div>
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>Выберите тренировочные дни:</div>
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
                      color: isTrain ? '#22c55e' : 'rgba(255,255,255,0.85)',
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
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['auto', 'manual', 'profile'] as const).map(mode => {
            const labels: Record<string, string> = { auto: '🤖 Авторасчёт', manual: '✏️ Ручной ввод', profile: '👤 Из профиля' };
            const colors: Record<string, string> = { auto: '#00e68a', manual: '#f59e0b', profile: '#60a5fa' };
            return (
              <button key={mode} onClick={() => switchKbjuMode(mode)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600,
                background: kbjuMode === mode ? `${colors[mode]}20` : '#202023',
                border: kbjuMode === mode ? `1px solid ${colors[mode]}` : '1px solid rgba(255,255,255,0.06)',
                color: kbjuMode === mode ? colors[mode] : 'rgba(255,255,255,0.85)',
              }}>{labels[mode]}</button>
            );
          })}
        </div>
        {kbjuMode !== 'manual' ? (
          <div>
            {/* Big macro tiles */}
            {(() => {
              const nm = NUTRITION_LEVELS.find(n => n.id === nutrLevel)?.mult || 1.0;
              const dispKcal = Math.round(effectiveKcal * nm);
              const dispP = Math.round(effectiveP * nm);
              const dispF = Math.round(effectiveF * nm);
              const dispC = Math.round(effectiveC * nm);
              return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
                {[
                  { l:'Калории', v: dispKcal, c:'#00e68a', unit:'ккал', perKg: Math.round(dispKcal / weight) },
                  { l:'Белки', v: dispP, c:'#3b82f6', unit:'г', perKg: Math.round(dispP / weight) },
                  { l:'Жиры', v: dispF, c:'#f59e0b', unit:'г', perKg: Math.round(dispF / weight) },
                  { l:'Углеводы', v: dispC, c:'#f97316', unit:'г', perKg: Math.round(dispC / weight) },
                ].map(m => {
                  const pct = dispKcal > 0 && m.l !== 'Калории'
                    ? Math.round(({ 'Калории': dispKcal, 'Белки': dispP * 4, 'Жиры': dispF * 9, 'Углеводы': dispC * 4 }[m.l] || 0) / dispKcal * 100)
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
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', marginTop:1 }}>{m.unit}</div>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.9)', marginTop:1 }}>
                      {m.perKg} / кг
                      {pct !== null && ` · ${pct}%`}
                    </div>
                  </div>
                );
              })}
            </div>;
            })()}
            {/* Macro distribution bar */}
            {(() => {
              const nm = NUTRITION_LEVELS.find(n => n.id === nutrLevel)?.mult || 1.0;
              const pKcal = Math.round(effectiveP * nm) * 4;
              const fKcal = Math.round(effectiveF * nm) * 9;
              const cKcal = Math.round(effectiveC * nm) * 4;
              const total = pKcal + fKcal + cKcal || 1;
              const pPct = pKcal / total * 100;
              const fPct = fKcal / total * 100;
              const cPct = cKcal / total * 100;
              return (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>Распределение макронутриентов</div>
                  <div style={{ height: 8, borderRadius: 4, background: '#202023', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: `${pPct}%`, background: '#3b82f6', transition: 'width 0.3s', minWidth: 2 }} title={`Белки ${Math.round(pPct)}%`} />
                    <div style={{ height: '100%', width: `${fPct}%`, background: '#f59e0b', transition: 'width 0.3s', minWidth: 2 }} title={`Жиры ${Math.round(fPct)}%`} />
                    <div style={{ height: '100%', width: `${cPct}%`, background: '#f97316', transition: 'width 0.3s', minWidth: 2 }} title={`Углеводы ${Math.round(cPct)}%`} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                    <span style={{ color: '#3b82f6' }}>● Б {Math.round(pPct)}%</span>
                    <span style={{ color: '#f59e0b' }}>● Ж {Math.round(fPct)}%</span>
                    <span style={{ color: '#f97316' }}>● У {Math.round(cPct)}%</span>
                  </div>
                </div>
              );
            })()}
            {nutrLevel !== 'base' && (() => {
              const nm = NUTRITION_LEVELS.find(n => n.id === nutrLevel);
              return <div style={{ fontSize: 8, color: 'rgba(0,230,138,0.5)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)' }}>📈 Уровень «{nm?.label}» (×{nm?.mult}) — план будет на {Math.round(((nm?.mult||1)-1)*100)}% больше: ~{Math.round(effectiveKcal * (nm?.mult||1))} ккал, Б {Math.round(effectiveP * (nm?.mult||1))} / Ж {Math.round(effectiveF * (nm?.mult||1))} / У {Math.round(effectiveC * (nm?.mult||1))}</div>;
            })()}
            {cyclingMode !== 'none' && (() => {
              const trainDayC = Math.round(effectiveC * (cyclingMode === 'butch' ? 1.3 : cyclingMode === 'carbload' ? 1.5 : 1.0));
              const restDayC = Math.round(effectiveC * (cyclingMode === 'macro' ? 0.7 : cyclingMode === 'butch' ? 0.5 : 1.0));
              const trainDayK = Math.round(effectiveKcal * (cyclingMode === 'macro' ? 1.0 : cyclingMode === 'butch' ? 1.0 : cyclingMode === 'cheatmeal' ? 0.85 : 1.0));
              const restDayK = Math.round(effectiveKcal * (cyclingMode === 'macro' ? 0.85 : 1.0));
              const cycleLabel = ({ macro: '🔄 Макросы', butch: '⤴️⤵️ БУЧ', cheatmeal: '🍔 Читмил', carbload: '🍚 Угл.загр.' })[cyclingMode] || '';
              return <div style={{ fontSize: 8, color: 'rgba(59,130,246,0.5)', marginTop: 2, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)' }}>{cycleLabel}: в тренировочный день ~{trainDayK} ккал / {trainDayC}г угл. · в день отдыха ~{restDayK} ккал / {restDayC}г угл.</div>;
            })()}
          </div>
        ) : (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, marginBottom:4 }}>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.85)'}}>Ккал</label><input type="number" value={manualKcal ?? calcTargets.kcal} onChange={e => setManualKcal(+e.target.value || null)} style={inputStyle} /></div>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.85)'}}>Белки (г)</label><input type="number" value={manualP ?? calcTargets.protein} onChange={e => setManualP(+e.target.value || null)} style={inputStyle} /></div>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.85)'}}>Жиры (г)</label><input type="number" value={manualF ?? calcTargets.fats} onChange={e => setManualF(+e.target.value || null)} style={inputStyle} /></div>
              <div><label style={{fontSize:8,color:'rgba(255,255,255,0.85)'}}>Углеводы (г)</label><input type="number" value={manualC ?? calcTargets.carbs} onChange={e => setManualC(+e.target.value || null)} style={inputStyle} /></div>
            </div>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.85)',marginBottom:4}}>Введите любые значения — недостающие рассчитаются автоматически</div>
            <button onClick={() => setKbjuMode('auto')} style={greenBtn}>✓ Применить</button>
          </div>
        )}
      </GlassCard>

      {/* 6. Budget level */}
      <GlassCard title="Уровень бюджета" icon="💰" color="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {BUDGET_LEVELS.map(b => (
            <button key={b.id} onClick={() => setBudget(b.id)} style={{
              padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              background: budget === b.id ? `${b.color}18` : '#202023',
              border: budget === b.id ? `2px solid ${b.color}` : '1px solid rgba(255,255,255,0.06)',
              color: budget === b.id ? b.color : 'rgba(255,255,255,0.85)',
              fontWeight: budget === b.id ? 700 : 500,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 12 }}>{b.icon} {b.label}</div>
              <div style={{ fontSize: 9, color: budget === b.id ? `${b.color}aa` : 'rgba(255,255,255,0.85)', marginTop: 3 }}>{b.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 6.5 Variety level */}
      <GlassCard title="Разнообразие рациона" icon="🎲" color="#8b5cf6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          Минимум — одни и те же продукты каждый день (проще готовить и закупать). Максимум — полная ротация для разнообразия нутриентов.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {[
            { id: 'minimal' as const, label: '🎯 База', desc: '2-3 продукта на категорию, минимум разнообразия', color: '#22c55e' },
            { id: 'medium' as const, label: '⚖️ Средний', desc: '4-5 продуктов, баланс удобства и разнообразия', color: '#f59e0b' },
            { id: 'max' as const, label: '🎪 Максимум', desc: 'Полный пул продуктов, макс. разнообразие', color: '#8b5cf6' },
          ].map(v => (
            <button key={v.id} onClick={() => setVariety(v.id)} style={{
              padding: '10px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              background: variety === v.id ? `${v.color}18` : '#202023',
              border: variety === v.id ? `2px solid ${v.color}` : '1px solid rgba(255,255,255,0.06)',
              color: variety === v.id ? v.color : 'rgba(255,255,255,0.85)',
              fontWeight: variety === v.id ? 700 : 500, fontSize: 10,
            }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{v.label.split(' ')[0]}</div>
              <div style={{ fontWeight: 700, fontSize: 10 }}>{v.label.split(' ').slice(1).join(' ')}</div>
              <div style={{ fontSize: 7, color: variety === v.id ? `${v.color}aa` : 'rgba(255,255,255,0.85)', marginTop: 2 }}>{v.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 7. Nutrition level */}
      <GlassCard title="Уровень питания" icon="📈" color="#22c55e">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          База ×1.0, Средний ×1.15, Усиление ×1.3, Максимум ×1.5. Используется для коррекции калоража без смены цели.
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Множитель калорийности: {NUTRITION_LEVELS.find(n => n.id === nutrLevel)?.mult || 1.0}× — итоговый план будет на {Math.round(( (NUTRITION_LEVELS.find(n => n.id === nutrLevel)?.mult || 1) - 1) * 100)}% больше базы</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5 }}>
          {NUTRITION_LEVELS.map(n => (
            <button key={n.id} onClick={() => setNutrLevel(n.id)} style={{
              padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              background: nutrLevel === n.id ? 'rgba(0,230,138,0.15)' : '#202023',
              border: nutrLevel === n.id ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
              color: nutrLevel === n.id ? '#00e68a' : 'rgba(255,255,255,0.85)',
              fontWeight: nutrLevel === n.id ? 700 : 500, fontSize: 10,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{n.icon}</div>
              <div style={{ fontWeight: 700 }}>{n.label}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>{n.desc}</div>
              <div style={{ fontSize: 8, color: nutrLevel === n.id ? '#00e68a' : 'rgba(255,255,255,0.8)', marginTop: 1 }}>×{n.mult}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 8. Schedule card */}
      <GlassCard title="Расписание" icon="⏰" color="#06b6d4">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div><label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:3,display:'block'}}>Пробуждение</label><input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={inputStyle} /></div>
          <div><label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:3,display:'block'}}>Обед</label><input type="time" value={lunchTime} onChange={e => setLunchTime(e.target.value)} style={inputStyle} /></div>
          <div><label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:3,display:'block'}}>Ужин</label><input type="time" value={dinnerTime} onChange={e => setDinnerTime(e.target.value)} style={inputStyle} /></div>
          <div><label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:3,display:'block'}}>Отход ко сну</label><input type="time" value={bedTime} onChange={e => setBedTime(e.target.value)} style={inputStyle} /></div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:3,display:'block'}}>Еда на работе</label>
            <select value={workFood} onChange={e => setWorkFood(e.target.value as any)} style={selectStyle}>
              <option value="any">Любая (можно разогреть)</option>
              <option value="portable">Только порошок/хлопья/протеин</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{fontSize:9,color:'rgba(255,255,255,0.85)',marginBottom:4,display:'block'}}>Количество приёмов пищи</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[3,4,5,6].map(n => (
              <PillBtn key={n} active={mealsCount === n} onClick={() => setMealsCount(n)} color={mealsCount === n ? '#06b6d4' : undefined}>{n}</PillBtn>
            ))}
          </div>
          {(() => {
            const wMin = parseInt(wakeTime.split(':')[0]) * 60 + parseInt(wakeTime.split(':')[1]);
            const bMin = parseInt(bedTime.split(':')[0]) * 60 + parseInt(bedTime.split(':')[1]);
            const awakeH = Math.round((bMin - wMin) / 60);
            const recCount = awakeH >= 16 ? 5 : awakeH >= 14 ? 4 : 3;
            return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.5 }}>⏰ Бодрствование {awakeH} ч → рекомендуется {recCount} приёмов (каждые {Math.round(awakeH / recCount)} ч).<br />🍳 Завтрак около {wakeTime} · 🥗 Обед в {lunchTime} · 🍽 Ужин в {dinnerTime}</div>;
          })()}
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

      {/* 9.5 Health Issues — Apple-style cards */}
      <GlassCard title="Проблемы со здоровьем" icon="🩺" color="#06b6d4">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          Отметьте проблемы — план автоматически исключит продукты, которые их усугубляют. Например, отёки → снижение натрия, диабет → низкий GI, подагра → низкие пурины.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {HEALTH_ISSUES.map(h => {
            const active = healthIssues.includes(h.id);
            return (
              <button key={h.id} onClick={() => toggleHealthIssue(h.id)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                background: active ? 'rgba(6,182,212,0.12)' : '#202023',
                border: active ? '1.5px solid #06b6d4' : '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.2s',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: active ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.04)', fontSize: 16 }}>{h.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: active ? '#06b6d4' : '#fff', marginBottom: 1 }}>{h.label}</div>
                  <div style={{ fontSize: 8, color: active ? 'rgba(6,182,212,0.8)' : 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{h.desc}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: active ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: active ? '#000' : 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: 10, transition: 'all 0.2s' }}>
                  {active ? '✓' : ''}
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* 9.7 Evening Low Carb */}
      <GlassCard title="🌙 Вечерний режим" icon="🌙" color="#6366f1">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 8, lineHeight: 1.5 }}>
          Автоматически включается при выборе «Отёки» или «Диабет». Снижает количество углеводов в вечернем приёме пищи, перенося их на обед.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: eveningLowCarb ? 'rgba(99,102,241,0.12)' : '#202023', border: `1px solid ${eveningLowCarb ? '#6366f1' : 'rgba(255,255,255,0.06)'}` }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: eveningLowCarb ? '#6366f1' : '#fff' }}>Вечер — минимум углеводов</div>
            <div style={{ fontSize: 8, color: eveningLowCarb ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.6)' }}>Углеводы ужина → обед</div>
          </div>
          <button onClick={() => { const nv = !eveningLowCarb; setEveningLowCarb(nv); localStorage.setItem('he_evening_low_carb', nv ? 'true' : 'false'); }} style={{
            width: 48, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
            background: eveningLowCarb ? '#6366f1' : 'rgba(255,255,255,0.15)',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'all 0.2s',
              left: eveningLowCarb ? 27 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </button>
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

      {/* Quick presets */}
      <GlassCard title="⚡ Быстрые пресеты" icon="⚡" color="#f97316">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            { id: 'meat', label: '🥩 Мясной', desc: 'Курица, говядина, индейка', fn: () => { setPlanType('classic'); setPreferredFoods(['chicken_breast','beef_lean','turkey_breast','rice_white','broccoli']); } },
            { id: 'fish', label: '🐟 Рыбный', desc: 'Лосось, тунец, треска', fn: () => { setPlanType('mediterranean'); setPreferredFoods(['salmon','tuna_canned','cod','rice_brown','broccoli','olive_oil']); } },
            { id: 'vegan', label: '🌱 Веган', desc: 'Бобовые, тофу, киноа', fn: () => { setPlanType('vegetarian'); setPreferredFoods(['tofu','tempeh','lentils','quinoa','broccoli','avocado']); } },
            { id: 'budget', label: '💰 Бюджет', desc: 'Яйца, курица, гречка', fn: () => { setBudget('low'); setPreferredFoods(['egg_whole','chicken_thigh','buckwheat','cabbage','apple']); } },
          ].map(p => (
            <button key={p.id} onClick={() => { p.fn(); }} style={{ flex: 1, minWidth: 80, padding: '8px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', fontSize: 8, fontWeight: 600, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(249,115,22,0.1)'; (e.target as HTMLElement).style.borderColor = 'rgba(249,115,22,0.3)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#202023'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{p.label.slice(0,2)}</div>
              <div>{p.label.slice(2)}</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 11-12. Food preferences + excluded */}
      <GlassCard title="Предпочтения и исключения" icon="🍎" color="#f59e0b">
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>🌟 Любимые продукты (план будет их чаще использовать):</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
            {preferredFoods.slice(0, 10).map((pf) => {
              const food = FOOD_DB.find(f => f.id === pf);
              return food ? (
                <span key={pf} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {food.name}
                  <span onClick={() => setPreferredFoods(prev => prev.filter(p => p !== pf))} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 7 }}>✕</span>
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
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>🚫 Исключённые продукты:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
            {excludedFoods.map((ef) => {
              const food = FOOD_DB.find(f => f.id === ef);
              return food ? (
                <span key={ef} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {food.name}
                  <span onClick={() => setExcludedFoods(prev => { const upd = prev.filter(p => p !== ef); localStorage.setItem('he_excluded_foods', JSON.stringify(upd)); return upd; })} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 7 }}>✕</span>
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
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>📝 Дополнительные заметки по питанию:</label>
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
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
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
                    color: isTrain ? '#22c55e' : 'rgba(255,255,255,0.85)',
                    fontSize: 10, fontWeight: isTrain ? 800 : 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
              <span>🏋️ {trainingDays.filter(Boolean).length} тренировочных</span>
              <span>😴 {trainingDays.filter(d => !d).length} выходных</span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* 14. Heavy training day for cycling */}
      {(cyclingMode === 'cheatmeal' || cyclingMode === 'carbload') && (
        <GlassCard title={cyclingMode === 'cheatmeal' ? 'Читмил' : 'Углеводная загрузка'} icon="📅">
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>День тяжёлой тренировки:</label>
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
                border: planDays === v.id ? 'none' : '1px solid rgba(255,255,255,0.06)',
                color: planDays === v.id ? '#000' : 'rgba(255,255,255,0.85)',
                fontWeight: 700, fontSize: 11,
                transition: 'all 0.15s',
              }}>{v.label}</button>
            ))}
          </div>
          {planDays === 7 && (
            <button onClick={() => setPlanView(prev => prev === 'list' ? 'calendar' : 'list')} style={{
              marginTop: 6, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%',
              background: planView === 'calendar' ? 'rgba(139,92,246,0.15)' : '#202023',
              border: planView === 'calendar' ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: planView === 'calendar' ? '#a78bfa' : 'rgba(255,255,255,0.85)',
            }}>📅 {planView === 'calendar' ? 'Список' : 'Календарь'}</button>
          )}
        {planDays !== 1 && (
          <button onClick={() => generatePlan(planDays)} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>
            🔄 Перегенерировать {planDays === 3 ? '3 дня' : 'неделю'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button onClick={() => {
            const txt = dayPlan ? `🍽 План питания\n${dayPlan.meals.map((m: any) => `${m.time} ${m.label}: ${m.items.map((it: any) => `${it.name} ${it.amount}г`).join(', ')}  [${Math.round(m.totals?.kcal || 0)}ккал]`).join('\n')}\n\n📊 Итого: ${Math.round(dayPlan.totals.kcal)} ккал, Б${Math.round(dayPlan.totals.p)}/Ж${Math.round(dayPlan.totals.f)}/У${Math.round(dayPlan.totals.c)}` : '';
            navigator.clipboard?.writeText(txt);
          }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:7, fontWeight:600 }}>📤 Скопировать план</button>
          <button onClick={() => {
            const input = prompt('Вставьте план из буфера:');
            if (!input) return;
            try {
              const parsed = JSON.parse(input);
              if (parsed.meals) { setDayPlan(parsed); setGenerated(true); }
            } catch {
              alert('Неверный формат. Скопируйте план через кнопку "Копировать план".');
            }
          }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:7, fontWeight:600 }}>📥 Импорт</button>
        </div>
      </GlassCard>
      )}
      {generated && allergens.length > 0 && (
        <GlassCard title="Аллергены" icon="⚠️" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            {allergenExcludedCount > 0 ? (
              <>🚫 Исключено <strong style={{ color: '#f97316' }}>{allergenExcludedCount}</strong> продуктов из {FOOD_DB.length} по вашим аллергенам: <span style={{ color: '#fb923c' }}>{allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}</span></>
            ) : (
              <>⚠️ Аллергены выбраны ({allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}), но ни один продукт не был исключён — проверьте список продуктов в базе</>
            )}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Чтобы применить изменения аллергенов, нажмите «Перегенерировать»</div>
        </GlassCard>
      )}

      {/* Results */}
      {generated && planDays === 1 && dayPlan && (
        <GlassCard title={`План на день${cyclingMode !== 'none' ? (dayPlan.isTrainingDay ? ' 🏋️ Тренировочный' : ' 🛌 Отдых') : ''}`} icon="📋" color={dayPlan.isTrainingDay ? '#00e68a' : '#8b5cf6'} style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {dayPlan.isTrainingDay !== undefined && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{dayPlan.isTrainingDay ? 'Тренировочный день' : 'День отдыха'}{cyclingMode !== 'none' && ` · циклирование: ${({macro:'макросы',butch:'БУЧ',cheatmeal:'читмил',carbload:'угл.загрузка'})[cyclingMode] || ''}`}</div>}
          {renderMealList(dayPlan)}
          {/* Day notes */}
          <textarea value={dayPlanNotes} onChange={e => { setDayPlanNotes(e.target.value); localStorage.setItem('he_day_notes', e.target.value); }} placeholder="Заметки на сегодня..." style={{ width:'100%', marginTop:6, padding:'6px 10px', borderRadius:8, fontSize:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.85)', resize:'vertical', minHeight:30, boxSizing:'border-box' }} rows={1} />
          {(() => {
            const dayTotal = dayPlan.totals;
            const devKcal = Math.round(dayTotal?.kcal - effectiveKcal);
            const devP = Math.round(dayTotal?.p - effectiveP);
            if (Math.abs(devKcal) < 50 && Math.abs(devP) < 5) return null;
            return (
              <button onClick={autoCorrectPlan} style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                📊 Автокоррекция: откл. от цели {devKcal > 0 ? '+' : ''}{devKcal} ккал / {devP > 0 ? '+' : ''}{devP}г Б — подогнать оставшиеся приёмы
              </button>
            );
          })()}
        </GlassCard>
      )}

      {generated && planDays === 3 && threeDayPlan && (
        <GlassCard title="План на 3 дня" icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>📊 Всего: {Math.round(threeDayPlan.totals.kcal)} ккал</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>Среднее: {Math.round(threeDayPlan.totals.kcal / 3)} ккал/день</span>
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
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>Среднее: {Math.round(weekPlan.totals.kcal / 7)} ккал/день</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6, display: 'flex', gap: 6, justifyContent: 'center' }}>
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
                  border: wIsTraining ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{wIsTraining ? '🏋️' : '😴'}</span>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: wIsTraining ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                          {DAY_LABELS[di]} · День {di + 1}
                        </span>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', display: 'flex', gap: 4 }}>
                          <span style={{ color: '#3b82f6' }}>Б {wP}</span>
                          <span style={{ color: '#f59e0b' }}>Ж {wF}</span>
                          <span style={{ color: '#f97316' }}>У {wC}</span>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{wKcal} ккал</span>
                  </div>
                  {/* Meal breakdown */}
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {d.meals.map((m: any, mi: number) => (
                      <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                        <span style={{ color: '#00e68a', fontWeight: 600, minWidth: 50 }}>{m.time}</span>
                        <span style={{ color: '#00e68a', minWidth: 55 }}>{m.label}</span>
                        <span style={{ flex: 1 }}>{m.items.map((it: any) => it.name).join(', ')}</span>
                        <span style={{ color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>
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

      {/* Calendar view */}
      {generated && planDays === 7 && weekPlan && planView === 'calendar' && (
        <GlassCard title="📅 Календарь питания на неделю" icon="📅" color="#a78bfa">
          {(() => {
            const allMealLabels = Array.from(new Set(weekPlan.days.flatMap((d: any) => d.meals.map((m: any) => m.label))));
            return <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 7 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 6px', textAlign: 'center', background: '#202023', borderRadius: 6, fontSize: 7, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Приём</th>
                    {weekPlan.days.map((d: any, di: number) => (
                      <th key={di} style={{ padding: '4px 6px', textAlign: 'center', background: d.isTrainingDay ? 'rgba(0,230,138,0.12)' : '#202023', borderRadius: 6, fontSize: 7, color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                        {DAY_LABELS[di]}
                        <div style={{ fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>{Math.round(d.totals.kcal)} ккал</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allMealLabels.map((label: any) => (
                    <tr key={label}>
                      <td style={{ padding: '4px 6px', background: '#202023', borderRadius: 6, fontSize: 7, color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</td>
                      {weekPlan.days.map((d: any, di: number) => {
                        const meal = d.meals.find((m: any) => m.label === label);
                        if (!meal) return <td key={di} style={{ padding: '4px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 6 }}>—</td>;
                        const kcal = Math.round(meal.totals?.kcal || 0);
                        return (
                          <td key={di} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 6, verticalAlign: 'top' }}>
                            <div style={{ color: '#00e68a', fontWeight: 700, fontSize: 7, marginBottom: 2 }}>{kcal} ккал</div>
                            {meal.items.slice(0, 2).map((it: any, ii: number) => (
                              <div key={ii} style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontSize: 6 }}>{it.name} {it.amount}г</div>
                            ))}
                            {meal.items.length > 2 && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 5 }}>+{meal.items.length - 2} ещё</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>;
          })()}
        </GlassCard>
      )}

      {/* Time-line view for day/week */}
      {generated && planDays === 1 && dayPlan && (
        <GlassCard title="⏳ Таймлайн дня" icon="⏳" color="#06b6d4">
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            {/* Vertical timeline line */}
            <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'rgba(6,182,212,0.2)', borderRadius: 1 }} />
            {dayPlan.meals.map((m: any, mi: number) => {
              const k = Math.round(m.totals?.kcal || 0);
              const w = Math.max(10, Math.round(k / Math.max(1, dayPlan.totals?.kcal) * 100));
              return (
                <div key={mi} style={{ position: 'relative', marginBottom: 8, paddingLeft: 16 }}>
                  <div style={{ position: 'absolute', left: -16, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', border: '2px solid #18181b' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 600, color: '#06b6d4', minWidth: 40 }}>{m.time}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{m.label}</span>
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 700 }}>{k} ккал</span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Б {Math.round(m.totals?.p || 0)} Ж {Math.round(m.totals?.f || 0)} У {Math.round(m.totals?.c || 0)}</span>
                  </div>
                  {/* Energy bar */}
                  <div style={{ height: 4, borderRadius: 2, background: '#202023', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${w}%`, background: 'linear-gradient(90deg, #06b6d4, #00e68a)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {m.items.map((it: any, ii: number) => (
                      <span key={ii} style={{ background: '#202023', padding: '1px 5px', borderRadius: 4 }}>{it.name} {it.amount}г</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Recipe picker modal */}
      {recipePickerMeal && generated && dayPlan && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
          onClick={() => setRecipePickerMeal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, padding:'14px 20px 28px', borderRadius:'20px 20px 0 0', background:'#18181b', boxShadow:'0 -4px 30px rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)', borderBottom:'none' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 16px' }} />
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4, letterSpacing:'-0.3px' }}>🍳 Заменить «{recipePickerMeal.label}» рецептом</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:12 }}>Подходящие рецепты</div>
            <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
              {getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').length === 0 ? (
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', textAlign:'center', padding:10 }}>Нет рецептов для этого приёма.</div>
              ) : getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').map((r, i) => (
                <button key={i} onClick={() => replaceMealWithRecipe(r, recipePickerMeal.mealIdx)} style={{ width:'100%', padding:'10px 12px', borderRadius:12, cursor:'pointer', textAlign:'left', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9, transition:'all 0.15s' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'}>
                  <div style={{ fontWeight:700, color:'#a78bfa', fontSize:10, marginBottom:2 }}>{r.name}</div>
                  <div style={{ color:'rgba(255,255,255,0.85)', marginBottom:4 }}>⏱{r.prepTimeMin}мин · {r.kcal}ккал · Б{r.protein}/Ж{r.fat}/У{r.carbs}</div>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)', display:'flex', gap:2, flexWrap:'wrap' }}>{r.tags.map(t => <span key={t} style={{ padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'rgba(167,139,250,0.5)' }}>{t}</span>)}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setRecipePickerMeal(null)} style={{ width:'100%', marginTop:8, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:8, fontWeight:600 }}>✕ Отмена</button>
          </div>
        </div>
      )}

      {/* Undo button */}
      {generated && undoStack.length > 0 && (
        <button onClick={() => { setDayPlan(undoStack[0]); setUndoStack(prev => prev.slice(1)); }} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>
          ↩ Отменить ({undoStack.length})
        </button>
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

      {/* Achievements + Seasonal */}
      {generated && (
        <GlassCard title="🏆 Достижения и сезон" icon="🏆" color="#f472b6">
          {(() => {
            const ach: { label: string; earned: boolean; icon: string }[] = [];
            try {
              const diaryRaw = localStorage.getItem('nutrition_diary');
              const diary = diaryRaw ? JSON.parse(diaryRaw) : {};
              const daysLogged = Object.keys(diary).length;
              if (daysLogged >= 1) ach.push({ label: 'Первый день в дневнике', earned: true, icon: '📝' });
              if (daysLogged >= 7) ach.push({ label: 'Неделя дневника', earned: true, icon: '📆' });
              if (daysLogged >= 30) ach.push({ label: 'Месяц дневника', earned: true, icon: '📅' });
              const plansRaw = localStorage.getItem('he_saved_nutrition_plans');
              const plans = plansRaw ? JSON.parse(plansRaw) : [];
              if (plans.length >= 1) ach.push({ label: 'Первый сохранённый план', earned: true, icon: '💾' });
              if (plans.length >= 5) ach.push({ label: '5 планов', earned: true, icon: '📚' });
              if (localStorage.getItem('he_off_cache')) ach.push({ label: 'Сканировал штрих-код', earned: true, icon: '📷' });
            } catch {}
            // Seasonal products
            const month = new Date().getMonth();
            const seasonal = [
              { months: [5,6,7,8], label: '🥒 Огурцы, помидоры, ягоды, зелень' },
              { months: [9,10], label: '🍂 Тыква, кабачки, яблоки, виноград' },
              { months: [11,12,1,2], label: '🥬 Цитрусовые, хурма, гранаты, свёкла' },
              { months: [3,4], label: '🌱 Спаржа, редис, шпинат, первая зелень' },
            ].find(s => s.months.includes(month));
            return <>
              {ach.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                {ach.map(a => <span key={a.label} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.15)', color:'#f472b6' }}>{a.icon} {a.label}</span>)}
              </div>}
              {seasonal && <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', padding:'4px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.1)' }}>🌿 Сезонные продукты: {seasonal.label}</div>}
              {ach.length === 0 && <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)' }}>Начните вести дневник питания, чтобы получать достижения.</div>}
            </>;
          })()}
        </GlassCard>
      )}

      {/* Recipe creator */}
      <button onClick={() => setShowRecipeCreator(true)} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:9, fontWeight:600, marginTop:4 }}>
        🍳 Создать свой рецепт
      </button>
      {showRecipeCreator && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
          onClick={() => setShowRecipeCreator(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, padding:'14px 20px 28px', borderRadius:'20px 20px 0 0', background:'#18181b', boxShadow:'0 -4px 30px rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.1)', borderBottom:'none' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 16px' }} />
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:12 }}>🍳 Создать рецепт</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <input value={newRecipe.name} onChange={e => setNewRecipe(r => ({...r, name: e.target.value}))} placeholder="Название рецепта" style={inputStyle} />
              <div style={{ display:'flex', gap:4 }}>
                <select value={newRecipe.meal} onChange={e => setNewRecipe(r => ({...r, meal: e.target.value}))} style={selectStyle}>
                  <option value="breakfast">Завтрак</option><option value="lunch">Обед</option>
                  <option value="dinner">Ужин</option><option value="snack">Перекус</option>
                </select>
                <input type="number" value={newRecipe.prepTime} onChange={e => setNewRecipe(r => ({...r, prepTime: +e.target.value || 10}))} placeholder="Мин" style={inputStyle} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                {[{k:'kcal',l:'Ккал'},{k:'protein',l:'Белки'},{k:'fat',l:'Жиры'},{k:'carbs',l:'Угл'}].map(f => <div key={f.k}><input type="number" value={(newRecipe as any)[f.k]} onChange={e => setNewRecipe(r => ({...r, [f.k]: +e.target.value || 0}))} placeholder={f.l} style={inputStyle} /></div>)}
              </div>
              <textarea value={newRecipe.ingredients} onChange={e => setNewRecipe(r => ({...r, ingredients: e.target.value}))} placeholder="Ингредиенты (каждый с новой строки)" style={{...inputStyle, minHeight:60, resize:'vertical', fontSize:9}} rows={3} />
              <textarea value={newRecipe.instructions} onChange={e => setNewRecipe(r => ({...r, instructions: e.target.value}))} placeholder="Инструкция (каждый шаг с новой строки)" style={{...inputStyle, minHeight:60, resize:'vertical', fontSize:9}} rows={3} />
              <input value={newRecipe.tags} onChange={e => setNewRecipe(r => ({...r, tags: e.target.value}))} placeholder="Теги (через запятую)" style={inputStyle} />
              <button onClick={() => {
                const recipe = { ...newRecipe, ingredients: newRecipe.ingredients.split('\n').filter(Boolean), instructions: newRecipe.instructions.split('\n').filter(Boolean), tags: newRecipe.tags.split(',').map(t => t.trim()).filter(Boolean), userCreated: true };
                const updated = [...userRecipes, recipe];
                setUserRecipes(updated);
                localStorage.setItem('he_user_recipes', JSON.stringify(updated));
                setShowRecipeCreator(false);
                setNewRecipe({ name: '', meal: 'lunch', prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });
              }} style={greenBtn}>✓ Сохранить рецепт</button>
            </div>
          </div>
        </div>
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
            const totalItems = shoppingList.length;
            const totalGrams = shoppingList.reduce((s: number, i: any) => s + (i.amount || 0), 0);
            const pricePerKg: Record<string, number> = { low: 4, medium: 7, max: 12, enhanced: 18 };
            const estCost = Math.round(totalGrams / 1000 * (pricePerKg[budget] || 7));
            const exportText = shoppingList.map((i: any) => `${i.name} — ${i.amount >= 1000 ? `${(i.amount/1000).toFixed(1)} кг` : `${Math.round(i.amount)} г`}`).join('\n');
            return (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => { shoppingList.forEach((i: any) => addToCart({ name: i.name, kcal: i.kcal || 0, amount: i.amount, category: i.catLabel || i.category })); }} style={{ flex:1, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>
                    🛒 В корзину ({totalItems})
                  </button>
                  <div style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a', fontSize: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    💰 ~{estCost}€
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(exportText); }} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>
                    📋
                  </button>
                </div>
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', marginBottom: 2, padding: '2px 0 2px 4px', borderLeft: '2px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {cat}
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', marginLeft: 'auto' }}>{items.length} шт</span>
                    </div>
                    {items.map((data: any, i: number) => (
                      <div key={data.name + i} style={{ fontSize: 9, padding: '3px 0 3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.85)' }}>
                        <span>{data.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>
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

      {/* 17b. Pharma meal timing */}
      {generated && injections.length > 0 && (
        <GlassCard title="Тайминг препаратов и приёмов пищи" icon="💊" color="#8b5cf6" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
          {injections.map((inj: DrugInjection) => {
            const isInsulin = inj.type === 'инсулин';
            const isIGF = inj.type === 'ИФР-1';
            const isGH = inj.type === 'ГР';
            const isPeptide = inj.type === 'пептид';
            const isAAS = inj.type === 'ААС';
            return (
              <div key={inj.id} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <div style={{ fontWeight: 700, fontSize: 10, color: '#a78bfa', marginBottom: 3 }}>
                  💉 {inj.name} ({inj.dose}{inj.unit}) — {inj.time}
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>
                    T½ {inj.halfLifeHours}ч
                    {inj.trainLinked && <span style={{ color: '#00e68a', marginLeft: 4 }}>🏋️ {inj.trainTiming === 'before' ? 'До тренировки' : inj.trainTiming === 'after' ? 'После тренировки' : 'До+После'}</span>}
                  </span>
                </div>
                {isInsulin && inj.esterType === 'rapid' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    ⚡ <strong>Быстрый инсулин (аналог)</strong> — пик 30-90 мин, длительность 3-4ч.<br />
                    🍚 На <strong>{Math.round(inj.dose * 10)}г углеводов</strong> (10г/ед). Принять сразу перед едой или после. <strong>ПРОПУСК ЕДЫ = ГИПОГЛИКЕМИЯ!</strong><br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до и после'}). В приёме: изолят сывороточного белка + ${inj.trainTiming === 'before' ? 'амилопектин' : 'декстроза'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' 🚨 На тренировке ОБЯЗАТЕЛЬНО углеводы (изотоник/гейнер/бананы) каждые 20 мин!' : ''}
                    {!inj.trainLinked ? ' ⏰ Не ешь без углеводов — риск гипогликемии!' : ''}<br />
                    🥑 <strong>Жиры МИНИМУМ</strong> в окне действия (первые 90 мин) — не более 3-5г. Жиры замедляют опорожнение желудка и блокируют поступление глюкозы.<br />
                    🩸 <strong>Глюкоза:</strong> замеры через 15, 30, 60, 90, 120 мин. Цель не ниже 4.0 ммоль/л.<br />
                    🍬 <strong>Экстренно:</strong> 200мл сока + 4 таблетки глюкозы при уровне &lt;3.5 ммоль/л. 
                  </div>
                )}
                {isInsulin && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🕐 <strong>Короткий инсулин (человеческий)</strong> — пик 2-4ч, длительность 5-8ч.<br />
                    🍚 На <strong>{Math.round(inj.dose * 10)}г углеводов</strong> (10г/ед). Ввести за 20-30 мин до еды. <strong>ПРОПУСК ЕДЫ ОПАСЕН!</strong><br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до+после'}). В приёме: изолят + ${inj.trainTiming === 'before' ? 'амилопектин' : 'декстроза'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' 🚨 На тренировке ОБЯЗАТЕЛЬНО углеводы каждые 20 мин!' : ''}<br />
                    🥑 <strong>Жиры &lt;5г</strong> в окне 90 мин — иначе гипогликемия на фоне уже принятых углеводов.<br />
                    🩸 <strong>Правило 4 часов:</strong> каждый час после укола — минимум 10-15г углеводов на подержание.
                  </div>
                )}
                {isInsulin && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🌙 <strong>Длинный инсулин (базальный)</strong> — покрывает суточную потребность.<br />
                    🍚 Привязка к еде <strong>не требуется</strong>. Принимай в одно и то же время ежедневно.<br />
                    📊 Короткий инсулин считай отдельно от длинного (суточная норма + еда).<br />
                    📋 Контроль глюкозы натощак каждое утро — цель 4.0-6.0 ммоль/л.
                  </div>
                )}
                {isIGF && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🧬 <strong>ИФР-1/MGF</strong> — анаболический пептид, работает синергично с инсулином.<br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до и после'}). Принимать НАТОЩАК за 30-45 мин до еды. Еда после — изолят + декстроза (МGF — натощак, локально в месте нагрузки).` : '⏰ Принимать натощак, за 30-45 мин до еды или согласно протоколу.'}<br />
                    🥑 <strong>Жиры МИНИМУМ</strong> — в комбинации с инсулином жиры критически замедляют анаболический ответ.<br />
                    🩸 <strong>Гипогликемия:</strong> ИФР-1 + инсулин — риск гипо вдвойне. Глюкометр обязателен!<br />
                    🔬 <strong>MGF:</strong> активирует сателлитные клетки локально (только нагружаемая мышца). В комбинации с ИФР-1 — каскад гиперплазии. Питание: глюкоза + аминокислоты (BCAA/изолят) в окне 30 мин после.
                  </div>
                )}
                {isGH && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🧬 <strong>ГР/Пептиды</strong> — влияние на инсулин и глюкозу.<br />
                    ⏰ Натощак, за 30-60 мин до еды. Не есть углеводы 30 мин после.<br />
                    📊 Контролируй глюкозу — ГР снижает чувствительность к инсулину.
                  </div>
                )}
                {isAAS && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💉 <strong>Короткий эфир</strong> — частая инъекция (EOD/ежедневно).<br />
                    ⏰ Привязка к еде минимальна. Следи за уровнем воды: +0.5л к норме.
                  </div>
                )}
                {isAAS && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💉 <strong>Длинный эфир</strong> — редкая инъекция (1-2р/нед).<br />
                    ⏰ Пей 40мл/кг воды. Контролируй АД и липиды.
                  </div>
                )}
                {(inj.type === 'семаглутид' || inj.type === 'тирзепатид') && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💊 <strong>GLP-1 агонист</strong> — замедляет опорожнение желудка, подавляет аппетит.<br />
                    📏 <strong>Питание дробное:</strong> 5-6 раз/день по 100-200г. Не переедать — тошнота, рвота.<br />
                    🥑 <strong>Жиры &lt;5г/приём</strong> — жирная пища задерживается в желудке на 4-6ч, вызывая тошноту и риск панкреатита.<br />
                    💧 <strong>Вода 30-40мл/кг</strong> — GLP-1 снижает моторику ЖКТ, риск запора. Клетчатка 25-30г/день.<br />
                    ⏰ <strong>Дни пик тошноты:</strong> первые 24-72ч после еженедельной инъекции — самые лёгкие приёмы, жиры &lt;20г/день.<br />
                    🩸 <strong>B12 и электролиты:</strong> добавки обязательны — GLP-1 снижает всасывание через IF-фактор.<br />
                    🚫 <strong>Алкоголь</strong> — исключить полностью (панкреатит, гипогликемия).<br />
                    🆘 <strong>Боли в животе/подреберье:</strong> немедленно к врачу — исключить панкреатит.
                  </div>
                )}
                {inj.type === 'другое' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    ℹ️ Следуй инструкции по препарату. При необходимости уточни тип.
                  </div>
                )}
              </div>
            );
          })}
          {/* Hypoglycemia checklist */}
          {injections.some(i => i.type === 'инсулин' && i.esterType !== 'long') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🚨 Чеклист гипогликемии (ОПАСНОСТЬ)</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                🩸 <strong>Глюкометр обязателен!</strong> Замеры: до, через 15, 30, 60, 90, 120 мин<br />
                🧃 <strong>Экстренный набор:</strong> 200мл сока + 3-4 таблетки глюкозы (15-20г) ВСЕГДА С СОБОЙ<br />
                🛌 <strong>Не принимать короткий инсулин после 18:00</strong> — риск ночной гипогликемии<br />
                ⏰ <strong>Каждый час после инъекции</strong> — минимум 10-15г углеводов (4-часовое окно действия)<br />
                🏋️ <strong>На тренировке:</strong> изотоник 6-8% (500-1000мл) + банан каждые 20 мин<br />
                🔴 <strong>Если глюкоза &lt;3.5 ммоль/л:</strong> немедленно 15-20г быстрых углеводов, замер через 15 мин<br />
                🚑 <strong>Если &lt;2.5 ммоль/л или потеря сознания:</strong> ВЫЗОВ 103! Глюкагон 1мг в/м или в/в глюкоза 40%<br />
                📋 <strong>Симптомы:</strong> потливость, дрожь, голод → спутанность, агрессия → потеря сознания, судороги<br />
                🥑 <strong>Жиры МИНИМУМ:</strong> в окне действия инсулина — не более 5г жиров за приём (жиры замедляют всасывание углеводов!)
              </div>
            </div>
          )}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.5 }}>
            💡 <strong>БАЗОВЫЕ ПРАВИЛА ИНСУЛИНА:</strong><br />
            🧮 1 ЕД короткого/быстрого ≈ 10г углеводов (чувствительность индивидуальна — после курса ГР/ААС может требоваться на 20-30% больше).<br />
            🥑 <strong>ЖИРЫ МИНИМАЛЬНЫ</strong> в окне действия инсулина (первые 2ч) — не более 5г. Жиры блокируют выход глюкозы из желудка в кровь, вызывая гипогликемию при уже принятых углеводах!<br />
            🚫 <strong>НЕ ПРОПУСКАЙ ПРИЁМЫ ПИЩИ</strong> — гипогликемия развивается за 15-30 минут!<br />
            🩸 <strong>Глюкометр — твой лучший друг.</strong> Цель: 4.0-6.0 ммоль/л через 2ч после инъекции. Не выше 7.8, не ниже 3.9.<br />
            🧬 MGF активирует сателлитные клетки локально (место инъекции/тренировки). ИФР-1 — системно. Оба требуют глюкозу и аминокислоты. Без еды в окне — нулевой эффект. 
          </div>
          {/* GLP-1 info */}
          {injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>💊 GLP-1 — справочник питания</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                📏 <strong>Дробное питание:</strong> 5-6 раз/день по 100-200г за приём. Не переполнять желудок — риск рвоты.<br />
                🥑 <strong>Жиры &lt;5г/приём:</strong> GLP-1 замедляет опорожнение желудка — жиры задерживаются и вызывают тошноту, изжогу, риск панкреатита.<br />
                💧 <strong>Вода 30-40 мл/кг:</strong> GLP-1 снижает моторику ЖКТ — риск запоров. Клетчатка 25-30г/день дополнительно.<br />
                ⏰ <strong>График инъекций:</strong> пик тошноты — первые 24-72ч после инъекции. Планируй самые лёгкие приёмы на эти дни. Жиры в эти дни &lt;20г/день.<br />
                🩸 <strong>Контроль B12 и электролитов:</strong> GLP-1 снижает всасывание B12 (через IF-фактор) и калия/магния — добавки обязательны.<br />
                🆘 <strong>Боли в левом подреберье/животе:</strong> прекратить приём, срочно к врачу — исключить острый панкреатит.<br />
                🚫 <strong>Алкоголь:</strong> исключить полностью — усиливает тошноту, риск гипогликемии, панкреатит.<br />
                🍬 <strong>Гипогликемия:</strong> в комбинации с инсулином — риск возрастает вдвое. Глюкометр обязателен!
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Insulin справочник */}
      {injections.some(i => i.type === 'инсулин') && (
        <GlassCard title="📖 Справочник: Инсулин" icon="📖" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🧮 Правило 10г/1ЕД:</strong> 1 единица короткого/быстрого инсулина покрывает ~10г углеводов. Доза × 10 = необходимые углеводы.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🥑 Жиры МИНИМУМ:</strong> в окне 90 минут после инъекции — не более 5г жиров. Жиры замедляют опорожнение желудка, вызывая гипогликемию при уже принятых углеводах.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🚫 ПРОПУСК ЕДЫ КРИТИЧЕН:</strong> гипогликемия развивается за 15-30 минут. Каждый час после укола — минимум 10-15г углеводов.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🩸 Глюкометр:</strong> замеры через 15, 30, 60, 90, 120 мин. Цель — не ниже 4.0 ммоль/л. При &lt;3.5 — 15-20г быстрых углеводов.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🏋️ Тренировка + инсулин:</strong> предтрен — изолят (40-50г) + амилопектин (80-100г). Пост-трен — изолят + декстроза (10г/1ЕД). На тренировке изотоник каждые 20 мин.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🛑 Не на ночь:</strong> короткий инсулин после 18:00 — риск ночной гипогликемии. Длинный (Лантус/Левемир) — базальный, можно.
            </div>
          </div>
        </GlassCard>
      )}

      {/* 18. Water balance */}
      {generated && waterCalc && (
        <GlassCard title="Водный баланс" icon="💧" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
              <span>База: {waterCalc.hasPharma ? (waterCalc.pharmaBaseMl || 40) : '30'} мл × {weight} кг</span>
              <span>{waterCalc.baseWater} л</span>
            </div>
            {waterCalc.hasPharma && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ Фармакология (повышенный метаболизм)</span>
                <span>+{waterCalc.pharmaBonus.toFixed(1)} л</span>
              </div>
            )}
            {waterCalc.trainBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ Тренировка</span>
                <span>+{waterCalc.trainBonus} л</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
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
            {injections.length > 0 &&             <button onClick={generateDrugCompatReport} style={reportPillStyle('#8b5cf6', activeReports.includes('drug') && !!drugCompatReport)}>💉 Совместимость</button>}
            <button onClick={generateFullNutritionReport} style={reportPillStyle('#3b82f6', activeReports.includes('nutrition') && !!nutritionReport)}>📋 Полный отчёт</button>
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
                <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>
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
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '1px 0', color: 'rgba(255,255,255,0.85)' }}>
                  <span>{k}</span>
                  <span style={{ color: v.status === 'ok' ? '#22c55e' : v.status === 'low' ? '#f59e0b' : '#ef4444' }}>
                    {v.actual} / {v.target} ({v.pct}%)
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
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
              {qualityReport.bestItems.length > 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>Лучшие: {qualityReport.bestItems.join(', ')}</div>}
              {qualityReport.weakItems.length > 0 && <div style={{ fontSize: 8, color: '#ef4444' }}>Слабые: {qualityReport.weakItems.join(', ')}</div>}
              {qualityReport.recommendations.map((r, i) => <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>• {r}</div>)}
            </div>
          )}

          {/* Risk report */}
          {riskReport && activeReports.includes('risk') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: riskReport.totalRisk === 'Низкий' ? '#22c55e' : riskReport.totalRisk === 'Средний' ? '#f59e0b' : '#ef4444' }}>
                🩺 Общий риск: {riskReport.totalRisk}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{riskReport.summary}</div>
              {Object.entries(riskReport.systems).map(([sys, data]) => (
                <div key={sys} style={{ fontSize: 8, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: data.score >= 5 ? '#ef4444' : data.score >= 3 ? '#f59e0b' : '#22c55e' }}>
                      {sys === 'hepatic' ? 'Печень' : sys === 'renal' ? 'Почки' : sys === 'inflammatory' ? 'Воспаление' : sys === 'insulin' ? 'Инсулин' : 'Электролиты'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>⚠ {data.score}/7</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.85)' }}>{data.impact}</div>
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
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>
                {drugCompatReport.warnings.join('; ')}
              </div>
            </div>
          )}

          {/* Nutrition report */}
          {nutritionReport && activeReports.includes('nutrition') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>📋 Полный отчёт о питании</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: nutritionReport.overallGrade === 'A' ? '#22c55e' : nutritionReport.overallGrade === 'B' ? '#8b5cf6' : nutritionReport.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{nutritionReport.overallGrade}</span>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>{nutritionReport.overallGradeLabel}</div>

              {/* KBJU % */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
                {[{l:'Ккал',v:nutritionReport.kbjuPct.kcal},{l:'Белки',v:nutritionReport.kbjuPct.p},{l:'Жиры',v:nutritionReport.kbjuPct.f},{l:'Угл.',v:nutritionReport.kbjuPct.c}].map(s => (
                  <div key={s.l} style={{ background:'rgba(0,0,0,0.2)', borderRadius:4, padding:'3px', textAlign:'center' }}>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                    <div style={{ fontSize:11, fontWeight:700, color: s.v >= 85 && s.v <= 115 ? '#22c55e' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                  </div>
                ))}
              </div>

              {/* Weight dynamics */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <div style={{ flex: 1, background: 'rgba(59,130,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Вес/нед</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.weightDynamicsBasic.direction === 'loss' ? '#22c55e' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                    {nutritionReport.weightDynamicsBasic.direction === 'loss' ? '−' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '+' : '∼'}{nutritionReport.weightDynamicsBasic.weeklyKg} кг
                  </div>
                </div>
                <div style={{ flex: 1, background: 'rgba(139,92,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Качество</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.foodQualityScore >= 7 ? '#22c55e' : '#f59e0b' }}>{nutritionReport.foodQualityScore}/10</div>
                </div>
              </div>

              {/* Micros */}
              {nutritionReport.microDeficiencies.length > 0 && <div style={{ fontSize: 7, color: '#f59e0b', marginBottom: 2 }}>⚠ {nutritionReport.microDeficiencies.length} дефицитов: {nutritionReport.microDeficiencies.slice(0, 3).join('; ')}</div>}

              {/* Recommendations */}
              {nutritionReport.recommendations.length > 0 && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>💡 {nutritionReport.recommendations.slice(0, 2).join(' • ')}</div>}
            </div>
          )}
        </GlassCard>
      )}

      {/* 20-22: Separate calculators */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => generateCheatMeal()} style={{
          flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
          background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
          color: '#f59e0b', fontWeight: 700, fontSize: 10,
          transition: 'all 0.15s',
        }}>
          🍔 Читмил
        </button>
        <button onClick={() => generateCarbload()} style={{
          flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
          background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
          color: '#f97316', fontWeight: 700, fontSize: 10,
          transition: 'all 0.15s',
        }}>
          🍚 Углев. загрузка
        </button>
        <button onClick={() => generateBUTCH()} style={{
          flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
          background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
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
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cheatMealPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cheatMealPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{cheatMealPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>{cheatMealPlan.bjuBreakdown}</div>
          {cheatMealPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || (cheatMealPlan.cals / cheatMealPlan.items.length), amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {cheatMealPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.note}</div>
        </GlassCard>
      )}

      {carbloadPlan && (
        <GlassCard title="Углеводная загрузка" icon="🍚" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>Всего: {carbloadPlan.totalCarbs} г ({Math.round(carbloadPlan.totalCarbs / weight)} г/кг)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{carbloadPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{carbloadPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{carbloadPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>~{carbloadPlan.bju.kcal} ккал всего</div>
          {carbloadPlan.foods.map((f: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {f.name || f}</span>
              <span onClick={() => addToCart({ name: f.name || f, kcal: f.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f97316', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {carbloadPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f97316', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)' }}>{carbloadPlan.note}</div>
        </GlassCard>
      )}

      {butchPlan && (
        <GlassCard title="БУЧ (белково-углеводное чередование)" icon="⤴️⤵️" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ padding: '10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>📋 {butchPlan.pattern}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 600 }}>ВУ (тренировка)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>{butchPlan.highCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↓ жиры {butchPlan.fatHigh}г</div>
              </div>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>НУ (отдых)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>{butchPlan.lowCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↑ жиры {butchPlan.fatLow}г</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: '#22c55e', textAlign: 'center', marginBottom: 4 }}>
              ВУ: {butchPlan.bjuHigh.kcal} ккал · НУ: {butchPlan.bjuLow.kcal} ккал
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#3b82f6', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
              {butchPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)' }}>{butchPlan.note}</div>
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
            <div key={i} style={{ fontSize: 9, color: '#fff', padding: '4px 0', borderBottom: i < recommendations.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', lineHeight: 1.4 }}>
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
                border: 'none', color: mealPrepDays === n ? '#000' : 'rgba(255,255,255,0.85)',
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
            <div key={i} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4' }}>Шаг {st.step}: {st.action}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>{st.duration} мин</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {st.items.map((item, j) => <span key={j} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.1)', color: 'rgba(255,255,255,0.85)' }}>{item}</span>)}
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
              <div key={p.id} style={{ marginBottom: 6, borderRadius: 10, overflow: 'hidden', border: isExpanded ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', background: isExpanded ? 'rgba(139,92,246,0.04)' : '#202023' }}
                  onClick={() => setExpandedSavedId(isExpanded ? null : p.id)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{p.name || p.date}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 600 }}>{p.dayPlan ? `${Math.round(p.dayPlan.totals.kcal)} ккал` : ''}</span>
                    <button onClick={(e) => { e.stopPropagation(); loadSavedPlan(p); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontWeight: 600 }}>📋</button>
                    <button onClick={(e) => { e.stopPropagation(); const txt = `🍽 План питания ${p.name || p.date}\n${p.dayPlan?.meals?.map((m: any) => `${m.time} ${m.label}: ${m.items?.map((it: any) => `${it.name} ${it.amount}г`).join(', ')}`).join('\n') || ''}`; navigator.clipboard?.writeText(txt); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontWeight: 600 }}>📤</button>
                    <button onClick={(e) => { e.stopPropagation(); const updated = savedPlans.filter((_, j) => j !== pi); setSavedPlans(updated); localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated)); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}>✕</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '6px 10px 8px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {p.dayPlan && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#00e68a', marginBottom: 4, fontSize: 9 }}>🍽 План на день: {Math.round(p.dayPlan.totals.kcal)} ккал</div>
                        {p.dayPlan.meals?.map((m: any, mi: number) => (
                          <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{m.time}</span>
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
