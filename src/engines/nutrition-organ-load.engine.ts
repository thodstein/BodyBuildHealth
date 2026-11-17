// ─── BJU Load on Organs v2.0 — Professional Nutrition Calculator ───
// Оценка метаболической нагрузки макронутриентов на 10 систем органов.
// Физиология пищеварения, гепатология, нефрология, эндокринология,
// нейрофизиология, остеология, кардиология.

import { localIsoDate } from '../core/local-date';

// ─── Interfaces ───

export interface OrganLoadInput {
  proteinG: number;
  fatG: number;
  satFatG: number;
  transFatG?: number;
  carbsG: number;
  sugarG?: number;
  fiberG: number;
  omega3Mg?: number;
  cholesterolMg: number;
  sodiumMg: number;
  potassiumMg?: number;
  /** Минералы для PRAL (Remer-Manz). Без них формула берёт типичный рацион. */
  phosphorusMg?: number;
  magnesiumMg?: number;
  calciumMg?: number;
  /** Омега-6, мг/сут. Нужна для честного Ω6/Ω3 — раньше он был прибит к 4:1. */
  omega6Mg?: number;
  waterMl?: number;
  bodyWeightKg: number;
  heightCm?: number;
  leanMassKg?: number;
  trainingHours?: number;
  mealsPerDay?: number;
  totalKcal?: number;
  proteinPerKg?: number;
  conditions?: string[];
}

export interface OrganLoadScore {
  score: number;
  level: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  color: string;
}

export interface OrganLoadResult {
  liver: OrganLoadScore & { breakdown: { protein: number; fat: number; carbs: number; fructose?: number }; ammoniaMgH: number; advice: string };
  kidneys: OrganLoadScore & { rslMosm: number; pralMEq: number; advice: string };
  pancreas: OrganLoadScore & { insulinDemandU: number; glycemicLoad: number; carbDensityPct: number; advice: string };
  gallbladder: OrganLoadScore & { bileDemandMg: number; fatPerMealG: number; advice: string };
  cardiovascular: OrganLoadScore & { atherogenicIndex: number; omegaRatio: number | null; advice: string };
  giTract: OrganLoadScore & { fermentationG: number; transitHours: number; advice: string };
  adipose: OrganLoadScore & { surplusKcal: number; storageRateGH: number; advice: string };
  bones: OrganLoadScore & { pralNet: number; calciumBalanceMg: number; advice: string };
  cns: OrganLoadScore & { glycemicSwing: number; advice: string };
  endocrine: OrganLoadScore & { insulinLoad: number; ghrelinSuppressionH: number; advice: string };
  totalMetabolicLoad: OrganLoadScore;
  metabolicProfile: string;
  systemCoverage: Array<{ organ: string; pctContribution: number }>;
}

export interface OrganLoadHistoryEntry {
  date: string;
  input: OrganLoadInput;
  result: Pick<OrganLoadResult, 'totalMetabolicLoad' | 'liver' | 'kidneys' | 'pancreas' | 'gallbladder' | 'cardiovascular' | 'giTract' | 'adipose' | 'bones' | 'cns' | 'endocrine' | 'metabolicProfile'>;
}

// ─── Constants ───

const LEVEL_RU: Record<string, string> = {
  low: 'Низкая', moderate: 'Умеренная', elevated: 'Повышенная', high: 'Высокая', critical: 'Критическая',
};

export const ORGAN_LABELS: Record<string, { label: string; icon: string; fullLabel: string }> = {
  liver:          { label: 'Печень', icon: '🫁', fullLabel: 'Гепатоцитарная нагрузка' },
  kidneys:        { label: 'Почки', icon: '🫘', fullLabel: 'Ренальная нагрузка (RSL+PRAL)' },
  pancreas:       { label: 'Поджелудочная', icon: '🔸', fullLabel: 'Инсулиновая / гликемическая нагрузка' },
  gallbladder:    { label: 'Желчный пузырь', icon: '🟢', fullLabel: 'Билиарная нагрузка' },
  cardiovascular: { label: 'ССС', icon: '❤️', fullLabel: 'Атерогенная нагрузка' },
  giTract:        { label: 'ЖКТ', icon: '🫀', fullLabel: 'Ферментативная нагрузка' },
  adipose:        { label: 'Адипоциты', icon: '🔴', fullLabel: 'Анаболическая нагрузка' },
  bones:          { label: 'Кости', icon: '🦴', fullLabel: 'Кислотно-щелочная нагрузка (PRAL)' },
  cns:            { label: 'ЦНС', icon: '🧠', fullLabel: 'Нейрометаболическая нагрузка' },
  endocrine:      { label: 'Эндокринная', icon: '⚡', fullLabel: 'Гормональная нагрузка' },
};

export const ORGAN_KEYS = [
  'liver','kidneys','pancreas','gallbladder','cardiovascular',
  'giTract','adipose','bones','cns','endocrine',
] as const;

export type OrganKey = typeof ORGAN_KEYS[number];

// ─── Helpers ───

function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
function scoreLevel(value: number): OrganLoadScore['level'] {
  if (value <= 20) return 'low'; if (value <= 40) return 'moderate'; if (value <= 60) return 'elevated'; if (value <= 80) return 'high'; return 'critical';
}
function levelColor(level: OrganLoadScore['level']): string {
  const m: Record<string, string> = { low: '#22c55e', moderate: '#8b5cf6', elevated: '#f59e0b', high: '#f97316', critical: '#ef4444' };
  return m[level];
}
const build = (score: number): OrganLoadScore => ({ score: Math.round(score), level: scoreLevel(score), color: levelColor(scoreLevel(score)) });

// ─── PRAL (Potential Renal Acid Load) — Remer-Manz formula ───
function calcPRAL(p: number, k: number, phosMg = 1500, mgMg = 350, caMg = 900): number {
  // PRAL (mEq) = 0.49×protein_g + 0.037×P_mg − 0.021×K_mg − 0.026×Mg_mg − 0.013×Ca_mg
  return +(0.49 * p + 0.037 * phosMg - 0.021 * k - 0.026 * mgMg - 0.013 * caMg).toFixed(1);
}

// ─── BMI ───
function calcBMI(weight: number, heightCm: number): number {
  return heightCm > 0 ? +(weight / ((heightCm / 100) ** 2)).toFixed(1) : 25;
}

// ─── MAIN ENGINE ───

export function calcOrganLoad(input: OrganLoadInput): OrganLoadResult {
  // Ноль — легальное значение (кетогенный рацион: сахар 0, насыщенные 0), поэтому
  // `||` заменён на явную проверку: раньше 0 молча превращался в «среднюю»
  // подстановку (сахар → 25% углеводов, омега-3 → 500 мг) и оценка врала.
  const num = (v: number | undefined, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const bw = num(input.bodyWeightKg, 70) || 70;
  const ht = num(input.heightCm, 175);
  const bmi = calcBMI(bw, ht);
  const lbm = num(input.leanMassKg, bw * 0.75);
  const p = num(input.proteinG, 0);
  const f = num(input.fatG, 0);
  const sf = num(input.satFatG, f * 0.3);
  const tf = num(input.transFatG, 0);
  const c = num(input.carbsG, 0);
  const sug = num(input.sugarG, c * 0.25);
  const fib = num(input.fiberG, 0);
  const o3 = num(input.omega3Mg, 0);
  const o6 = num(input.omega6Mg, 0);
  const chol = num(input.cholesterolMg, 0);
  const na = num(input.sodiumMg, 0);
  const k = num(input.potassiumMg, 0);
  const water = num(input.waterMl, bw * 30);
  const trainH = num(input.trainingHours, 0);
  const meals = num(input.mealsPerDay, 4);
  const totalKcal = num(input.totalKcal, p * 4 + f * 9 + c * 4);
  const conds = new Set(input.conditions || []);

  // ── Training modifier ──
  const trainMult = clamp(1 + trainH * 0.02, 1, 1.3);

  // ── Body comp modifier ──
  const bmiMult = bmi > 35 ? 1.3 : bmi > 30 ? 1.15 : bmi > 25 ? 1.05 : 1;

  // ════════════════════════════════════
  // 1. LIVER (Гепатоцитарная нагрузка)
  // ════════════════════════════════════
  const liverProtein = p * 0.10;               // дезаминирование → уреагенез (~10% белка метаболизируется в печени)
  const liverFat     = f * 0.06 + tf * 0.5;    // VLDL + липотоксичность (~6% жиров достигает печени; трансжиры ×2 нагрузка)
  const liverCarbs   = c * 0.08;               // гликогенез + de novo lipogenesis
  const liverFruct   = sug * 0.15;             // фруктоза = нагрузка ×2 на печень
  const liverRaw     = liverProtein + liverFat + liverCarbs + liverFruct;
  const ammoniaRate  = +(p * 0.16 * 1.21 / 24).toFixed(1); // г NH₃/ч (N→NH₃: ×17/14≈1.21)
  // Калибровка: обычный смешанный рацион (150 Б / 70 Ж / 250 У) даёт raw ≈ 49.
  // Раньше ×1.1 превращало норму в «повышенную»; ×0.7 ставит её в «умеренную»,
  // а действительно тяжёлый рацион (250/150/500) уводит за 70.
  const liverScore   = clamp(liverRaw * 0.7 * trainMult * (conds.has('nafld') ? 1.5 : 1) * (conds.has('gout') ? 1.15 : 1) * bmiMult, 0, 100);

  let liverAdvice = 'Нагрузка на печень в пределах нормы.';
  if (liverScore > 75) liverAdvice = `Гепатотоксический профиль (NH₃ ${ammoniaRate} г/ч). Снизьте фруктозу ≤25 г/сут, насыщенные жиры ≤${(sf*0.5).toFixed(0)} г/сут. Добавьте холин (≥550 мг), NAC, расторопшу.`;
  else if (liverScore > 55) liverAdvice = `Умеренная гепатоцитарная нагрузка. Контролируйте омега-6/3, добавьте глицин (3-5 г).`;
  else if (liverScore > 35) liverAdvice = 'Лёгкая нагрузка — допустимо. Следите за АЛТ/АСТ раз в 3 мес.';

  // ════════════════════════════════════
  // 2. KIDNEYS (Ренальная нагрузка)
  // ════════════════════════════════════
  const rsl      = p * 5.7 + na / 23;         // Renal Solute Load: protein mOsm + Na mEq (1 mEq = 23 mg)
  const rslPerKg = rsl / bw;
  // PRAL — из реальных P/Mg/Ca плана, если они есть; иначе Remer-Manz берёт
  // типичный рацион (1500/350/900 мг) и кислотная нагрузка недооценивается.
  const pralVal  = calcPRAL(
    p, k,
    num(input.phosphorusMg, 1500), num(input.magnesiumMg, 350), num(input.calciumMg, 900),
  );
  // Камни в почках — НЕ ХБП: белок не ограничиваем, главный рычаг — вода (≥40 мл/кг).
  const waterTarget = bw * (conds.has('kidney_stones') ? 40 : 35);
  const hydrated    = clamp(water / waterTarget, 0, 1);
  // Шкала: RSL 6 мОсм/кг — нижняя норма, 20 — край. Раньше score делился на
  // гидратацию, и стандартные 150 г белка давали 100 «критическая».
  const rslScore    = clamp(((rslPerKg - 6) / 14) * 100, 0, 100);
  const pralScore   = clamp((pralVal / 40) * 100, 0, 100);
  const kidneyScore = clamp(
    (rslScore * 0.6 + pralScore * 0.25 + (1 - hydrated) * 20)
      * (conds.has('ckd') ? 1.8 : conds.has('gout') ? 1.2 : conds.has('hypertension') ? 1.15 : 1),
    0, 100,
  );

  let kidneyAdvice = 'Почечная нагрузка в норме.';
  if (kidneyScore > 75) kidneyAdvice = `RSL ${Math.round(rsl)} мОсм, PRAL ${pralVal > 0 ? '+' : ''}${pralVal} мЭкв. Вода: ≥${Math.round(waterTarget)} мл/сут. Распределите белок по ${meals} приёмам (≤0.5 г/кг/приём). Добавьте калий (≥4700 мг).`;
  else if (kidneyScore > 55) kidneyAdvice = `RSL ${Math.round(rsl)} мОсм. Увеличьте воду на ${Math.round(Math.max(0, waterTarget - water))} мл. Снизьте Na ≤2000 мг.`;
  else if (kidneyScore > 35) kidneyAdvice = `Лёгкая RSL. Вода ≥${Math.round(waterTarget / bw)} мл/кг — достаточно.`;
  if (conds.has('kidney_stones')) {
    kidneyAdvice = `Камни в почках: держите воду ≥${Math.round(waterTarget)} мл/сут (${Math.round(waterTarget / bw)} мл/кг) и натрий ≤2000 мг — это главные рычаги. ${kidneyAdvice}`;
  }

  // ════════════════════════════════════
  // 3. PANCREAS (Инсулиновая нагрузка)
  // ════════════════════════════════════
  const carbDensity  = totalKcal > 0 ? +(c * 4 / totalKcal * 100).toFixed(0) : 50;
  const glycemicLoad = clamp((c - fib * 0.8) * (1 + sug / 100), 0, 200);
  const insulinU     = clamp(glycemicLoad * 0.25, 0, 100);  // Insulin demand ≈ 0.25×GL (simplified, without individual sensitivity)
  const pancMult     = conds.has('diabetes') ? 1.6 : 1;
  // 1.15 → 0.9: 250 г углеводов (обычный рацион) давали 57 «повышенная».
  const pancScore    = clamp(insulinU * 0.9 * pancMult * (carbDensity > 70 ? 1.2 : 1), 0, 100);

  let pancreasAdvice = 'Инсулиновая нагрузка в норме.';
  if (pancScore > 75) pancreasAdvice = `Гиперинсулинемический профиль. Снизьте углеводную плотность с ${carbDensity}% до ≤50%, клетчатка ≥30 г/сут. Добавьте берберин 500 мг × 2.`;
  else if (pancScore > 55) pancreasAdvice = `Умеренная. Замените простые сахара (${Math.round(sug)} г) на сложные углеводы. Клетчатка +5 г снижает ГН на ~15%.`;
  else if (pancScore > 35) pancreasAdvice = 'Умеренная нагрузка. Предпочитайте низкий ГИ.';

  // ════════════════════════════════════
  // 4. GALLBLADDER (Билиарная нагрузка)
  // ════════════════════════════════════
  const fatPerMeal = meals > 0 ? f / meals : f / 4;
  const bileDemand = f * 0.10 + sf * 0.05;
  const gbRaw      = bileDemand * 2.5 + (fatPerMeal > 30 ? (fatPerMeal - 30) * 1.5 : 0);
  const gbScore    = clamp(gbRaw * (conds.has('gallstones') ? 1.6 : conds.has('nafld') ? 1.2 : 1), 0, 100);

  let gbAdvice = 'Желчеотток в норме.';
  if (gbScore > 75) gbAdvice = `Жировая нагрузка ${Math.round(fatPerMeal)} г/приём. Разбейте жиры ≤30 г/приём. Добавьте TUDCA 500 мг × 2.`;
  else if (gbScore > 55) gbAdvice = 'Умеренная билиарная нагрузка. Распределите жиры равномерно.';
  else if (gbScore > 35) gbAdvice = 'Желчеотток в норме.';

  // ════════════════════════════════════
  // 5. CARDIOVASCULAR (Атерогенная)
  // ════════════════════════════════════
  // Ω6/3 — только из реальных данных: раньше было прибито 4:1 и панель
  // показывала «идеальное» соотношение при любом рационе. Нет омега-6 → null.
  const omegaRatio = o6 > 0 && o3 > 0 ? +(o6 / o3).toFixed(1) : null;
  const ai = (sf * 0.25 + tf * 0.8 + chol * 0.0015) / bw * 8;  // Atherogenic Index (simplified: SFA + trans fat)
  // Калибровка по АИ: 0.4 — чистый рацион, 2.0 — выраженно атерогенный.
  // Раньше ×5.5 давало 3-6 баллов даже на 40 г насыщенных жиров: ось не работала.
  const cvScore = clamp(((ai - 0.4) / 1.6) * 100 * (conds.has('hypertension') ? 1.4 : conds.has('diabetes') ? 1.2 : 1) * (tf > 2 ? 1.3 : 1), 0, 100);

  const omegaNote = omegaRatio != null ? `, Ω6/3 = ${omegaRatio}:1` : ' (Ω6/3 — нет данных об омега-6)';
  let cvAdvice = 'Атерогенная нагрузка низкая.';
  if (cvScore > 75) cvAdvice = `АИ ${ai.toFixed(1)}${omegaNote}. Замените насыщенные жиры на оливковое масло, рыбу. EPA+DHA ≥2 г/сут.`;
  else if (cvScore > 55) cvAdvice = `АИ ${ai.toFixed(1)}${omegaNote}. Добавьте омега-3 ≥${Math.round(Math.max(2000, o3*2))} мг. Контролируйте трансжиры.`;
  else if (cvScore > 35) cvAdvice = 'Умеренный профиль. Поддерживайте Ω3 ≥1 г/сут.';

  // ════════════════════════════════════
  // 6. GI TRACT (Ферментативная)
  // ════════════════════════════════════
  const fermG       = fib * 0.55 + p * 0.025;    // SCFA + белковая путрефакция
  const giRaw       = c * 0.035 + f * 0.025 + p * 0.04 + fib * 0.12 + sug * 0.07;
  const transitH    = clamp(30 - fib * 0.8 + sf * 0.15 + sug * 0.1, 8, 70);
  const giScore     = clamp(giRaw * 1.25 * (conds.has('ibs') ? 1.5 : 1) * (fib < 20 ? 1.15 : fib > 35 ? 0.85 : 1), 0, 100);

  let giAdvice = 'ЖКТ-нагрузка в норме.';
  if (giScore > 75) giAdvice = `Ферментация ${fermG.toFixed(1)} г SCFA/сут, транзит ~${transitH.toFixed(0)} ч. Снизьте сахар, избегайте «жир+сахар» в одном приёме.`;
  else if (giScore > 55) giAdvice = 'Умеренная нагрузка. Клетчатку вводите +5 г/нед постепенно.';
  else if (giScore > 35) giAdvice = 'ЖКТ в порядке.';

  // ════════════════════════════════════
  // 7. ADIPOSE (Анаболическая)
  // ════════════════════════════════════
  const bfEst = Math.max(5, Math.min(35, (bmi - 18) * 1.2)); // BMI → BF% estimate
  const lbmEst = bw * (1 - bfEst / 100);
  const tdeeEst   = Math.round(lbmEst * 30 + (bw - lbmEst) * 8 + trainH * 200); // LBM-aware TDEE
  const surplus   = totalKcal - tdeeEst;
  const storageRH = surplus > 0 ? +(surplus / 184.8).toFixed(2) : 0;   // г жира/ч: surplus(kcal/day) / 7700(kcal/kg) * 1000(g/kg) / 24(h)
  const adScore   = clamp(surplus <= 0 ? 0 : (surplus / (tdeeEst * 0.005)) * (bmi > 30 ? 1.3 : 1), 0, 100);

  let adAdvice = 'Энергобаланс в норме или дефицит.';
  if (surplus > 500) adAdvice = `Профицит +${Math.round(surplus)} ккал — активный липогенез (~${storageRH} г жира/ч). Контролируйте композицию тела каждые 2 нед.`;
  else if (surplus > 200) adAdvice = `Умеренный профицит +${Math.round(surplus)} ккал. Контролируйте прирост ≤0.5 кг/нед.`;
  else if (surplus <= 0) adAdvice = `Дефицит ${Math.round(-surplus)} ккал — катаболическая фаза. Белок ≥1.8 г/кг для сохранения LBM.`;

  // ════════════════════════════════════
  // 8. BONES (Кислотно-щелочная)
  // ════════════════════════════════════
  const calciumMg = num(input.calciumMg, 900);
  const caBalance = calciumMg - pralVal * 2;  // ~1-2 mg urinary Ca lost per mEq net acid load (Remer 2003)
  // Нормировка по PRAL, а не по модулю: обычный рацион (+13 мЭкв) больше не
  // получает 52 «повышенная». 40 мЭкв — верхняя граница физкоридора.
  const boneScore = clamp((Math.max(0, pralVal) / 40) * 70 + (k < 3000 ? 15 : 0) + (caBalance < 600 ? 15 : 0), 0, 100);

  let boneAdvice = 'Костный метаболизм в балансе.';
  if (boneScore > 55) boneAdvice = `PRAL ${pralVal > 0 ? '+' : ''}${pralVal} мЭкв — кислая нагрузка. Ca баланс ${Math.round(caBalance)} мг. Увеличьте калий (≥4700 мг), зелень.`;
  else if (boneScore > 35) boneAdvice = 'Умеренная кислотная нагрузка. Добавьте листовую зелень.';
  else boneAdvice = 'Костный метаболизм в норме.';

  // ════════════════════════════════════
  // 9. CNS (Нейрометаболическая)
  // ════════════════════════════════════
  const glycemicSwing = sug / (1 + fib * 0.08);                    // амплитуда гликемии
  const cnsScore      = clamp((glycemicSwing * 0.7) * (sug > 50 ? 1.3 : 1), 0, 100);

  let cnsAdvice = 'Нейрометаболическая нагрузка в норме.';
  if (cnsScore > 55) cnsAdvice = `Гликемический размах ${glycemicSwing.toFixed(1)}. Стабилизируйте гликемию: клетчатка, белок в каждом приёме.`;
  else if (cnsScore > 35) cnsAdvice = 'Умеренные колебания гликемии. Избегайте пропусков приёмов.';
  else cnsAdvice = 'Стабильный нейрометаболический профиль.';

  // ════════════════════════════════════
  // 10. ENDOCRINE (Гормональная)
  // ════════════════════════════════════
  const insulinLoadH     = clamp(glycemicLoad / 10, 2, 24);       // часов инсулиновой нагрузки
  const ghrelinSuppress  = clamp(4 + p * 0.03 + fib * 0.06, 1, 16); // часов подавления грелина
  const endoScore        = clamp((insulinLoadH * 3 + Math.abs(ghrelinSuppress - 10) * 5) * (fib < 15 ? 1.3 : 1), 0, 100);

  let endoAdvice = 'Гормональный профиль сбалансирован.';
  if (endoScore > 55) endoAdvice = `Инсулиновая нагрузка ${insulinLoadH.toFixed(0)} ч/сут. Грелин подавлен ${ghrelinSuppress.toFixed(0)} ч. Увеличьте клетчатку.`;
  else if (endoScore > 35) endoAdvice = 'Умеренная. Контролируйте интервалы между приёмами.';
  else endoAdvice = 'Эндокринный профиль в норме.';

  // ════════════════════════════════════
  // TOTAL & PROFILE
  // ════════════════════════════════════
  const scores10 = [liverScore, kidneyScore, pancScore, gbScore, cvScore, giScore, adScore, boneScore, cnsScore, endoScore];
  const totalScore = clamp(scores10.reduce((a, b) => a + b, 0) / 10, 0, 100);
  const sumScores = scores10.reduce((a, b) => a + b, 0);

  let profile = 'Сбалансированный';
  const top3 = scores10.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s).slice(0, 3);
  // i === 7 именно кости; раньше >= 7 вешало «остеогенный» профиль и на ЦНС
  // (i=8), и на эндокринную (i=9).
  if (top3[0].i === 7) profile = 'Остеогенный (высокая кислотная нагрузка)';
  else if (liverScore > 60 && pancScore > 50) profile = 'Смешанный гепато-инсулиновый';
  else if (liverScore > 55 && gbScore > 50) profile = 'Липидный (жировой)';
  else if (kidneyScore > 55) profile = 'Протеиновый (высокобелковый)';
  else if (pancScore > 55) profile = 'Гликемический (углеводный)';
  else if (cvScore > 55) profile = 'Атерогенный (сердечно-сосудистый)';
  else if (giScore > 50) profile = 'Пищеварительный (высокий объём)';

  const systemCoverage = ORGAN_KEYS.map((key, idx) => ({
    organ: key,
    pctContribution: sumScores > 0 ? +(scores10[idx] / sumScores * 100).toFixed(1) : 10,
  }));

  return {
    liver:       { ...build(liverScore), breakdown: { protein: +liverProtein.toFixed(1), fat: +liverFat.toFixed(1), carbs: +liverCarbs.toFixed(1), fructose: +liverFruct.toFixed(1) }, ammoniaMgH: ammoniaRate, advice: liverAdvice },
    kidneys:     { ...build(kidneyScore), rslMosm: Math.round(rsl), pralMEq: pralVal, advice: kidneyAdvice },
    pancreas:    { ...build(pancScore), insulinDemandU: +insulinU.toFixed(1), glycemicLoad: +glycemicLoad.toFixed(0), carbDensityPct: carbDensity, advice: pancreasAdvice },
    gallbladder: { ...build(gbScore), bileDemandMg: Math.round(bileDemand), fatPerMealG: +fatPerMeal.toFixed(0), advice: gbAdvice },
    cardiovascular: { ...build(cvScore), atherogenicIndex: +ai.toFixed(1), omegaRatio, advice: cvAdvice },
    giTract:     { ...build(giScore), fermentationG: +fermG.toFixed(1), transitHours: +transitH.toFixed(0), advice: giAdvice },
    adipose:     { ...build(adScore), surplusKcal: Math.round(surplus), storageRateGH: storageRH, advice: adAdvice },
    bones:       { ...build(boneScore), pralNet: pralVal, calciumBalanceMg: Math.round(caBalance), advice: boneAdvice },
    cns:         { ...build(cnsScore), glycemicSwing: +glycemicSwing.toFixed(1), advice: cnsAdvice },
    endocrine:   { ...build(endoScore), insulinLoad: +insulinLoadH.toFixed(0), ghrelinSuppressionH: +ghrelinSuppress.toFixed(0), advice: endoAdvice },
    totalMetabolicLoad: build(totalScore),
    metabolicProfile: profile,
    systemCoverage,
  };
}

// ─── UTILITIES ───

export function calcOrganLoadFromProtein(proteinPerKg: number, bodyWeightKg: number, fatG?: number, carbsG?: number): OrganLoadResult {
  const p = proteinPerKg * bodyWeightKg;
  const f = fatG ?? bodyWeightKg * 1.2;
  const c = carbsG ?? bodyWeightKg * 4;
  return calcOrganLoad({
    proteinG: p, fatG: f, satFatG: f * 0.3, transFatG: 1, carbsG: c, sugarG: c * 0.25,
    fiberG: 25, omega3Mg: 500, cholesterolMg: 300, sodiumMg: 2000, potassiumMg: 3500,
    waterMl: bodyWeightKg * 30, bodyWeightKg, heightCm: 175, leanMassKg: bodyWeightKg * 0.75,
    trainingHours: 0, mealsPerDay: 4, totalKcal: p * 4 + f * 9 + c * 4, proteinPerKg,
  });
}

export function compareScenarios(a: OrganLoadInput, b: OrganLoadInput): {
  a: OrganLoadResult; b: OrganLoadResult;
  deltas: Array<{ organ: OrganKey; aScore: number; bScore: number; delta: number; improved: boolean }>;
} {
  const ra = calcOrganLoad(a);
  const rb = calcOrganLoad(b);
  const deltas = ORGAN_KEYS.map(organ => {
    const ascore = ((ra as any)[organ] as OrganLoadScore).score;
    const bscore = ((rb as any)[organ] as OrganLoadScore).score;
    return { organ: organ as OrganKey, aScore: ascore, bScore: bscore, delta: +(bscore - ascore).toFixed(1), improved: bscore < ascore };
  });
  return { a: ra, b: rb, deltas };
}

// ─── HISTORY ───

const HISTORY_KEY = 'he_organ_load_history';
const MAX_HISTORY = 30;

export function loadOrganLoadHistory(): OrganLoadHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export function saveOrganLoadHistory(input: OrganLoadInput): void {
  const result = calcOrganLoad(input);
  const date = localIsoDate();
  const entry: OrganLoadHistoryEntry = {
    date,
    input,
    result: {
      totalMetabolicLoad: result.totalMetabolicLoad,
      liver: result.liver, kidneys: result.kidneys, pancreas: result.pancreas,
      gallbladder: result.gallbladder, cardiovascular: result.cardiovascular,
      giTract: result.giTract, adipose: result.adipose,
      bones: result.bones, cns: result.cns, endocrine: result.endocrine,
      metabolicProfile: result.metabolicProfile,
    },
  };
  // Одна запись на календарный день: панель сохраняет историю на каждое
  // изменение ввода (debounce 800 мс), и раньше 30 строк были копиями
  // сегодняшнего дня — истории как динамики не было.
  const history = loadOrganLoadHistory().filter(h => h.date !== date);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}

export function clearOrganLoadHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

// ─── REFERENCE RANGES ───

export function getOrganLoadReference(): Record<string, { low: number; moderate: number; elevated: number; high: number }> {
  return {
    liver:       { low: 0, moderate: 20, elevated: 45, high: 70 },
    kidneys:     { low: 0, moderate: 20, elevated: 45, high: 70 },
    pancreas:    { low: 0, moderate: 20, elevated: 50, high: 75 },
    gallbladder: { low: 0, moderate: 18, elevated: 45, high: 70 },
    cardiovascular: { low: 0, moderate: 18, elevated: 45, high: 70 },
    giTract:     { low: 0, moderate: 25, elevated: 50, high: 75 },
    adipose:     { low: 0, moderate: 12, elevated: 30, high: 55 },
    bones:       { low: 0, moderate: 18, elevated: 40, high: 65 },
    cns:         { low: 0, moderate: 15, elevated: 40, high: 65 },
    endocrine:   { low: 0, moderate: 20, elevated: 50, high: 75 },
  };
}
