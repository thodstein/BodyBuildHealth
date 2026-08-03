import {
  type CalculatorState, type CalculatorResult, type RiskSystemId,
  type SystemRisk, type MechanismDetail, type LabDelta,
  type ScheduleItem, type TimeBlock, type SynergyId,
  type PowerLevel, type LabSlice, type TimelineWeekData,
  SYNERGY_ID_SUBSTANCES, TITRATION_RULES, SYNERGY_ID_LABELS,
  NUTRIENT_UL, DEPLETION_CASCADES, SUBSTANCE_HALF_LIFE,
  FORM_BIOAVAIL_MULT, MINERAL_SEPARATION_HOURS, MEAL_CONTEXT_RULES,
} from './types';
import {
  SUB_ALIAS, canonId, TZ_AUTO_BLACKLIST,
  SAME_CLASS_GROUPS, ID_TO_CLASS, sameClassIds,
  PHASE_BLOCKLIST,
} from './shared-constants';
export { SUB_ALIAS, canonId, TZ_AUTO_BLACKLIST, SAME_CLASS_GROUPS, ID_TO_CLASS, sameClassIds, PHASE_BLOCKLIST };
import { evaluateRecommendations } from '../recommendation-engine';
import { calculateTzSpecRisk, calculateTzSpecRiskTimeline, type TzSpecInput, type DrugInput, type TzSpecResult, type TzSpecMechanismResult } from '../risk-engine-tz-spec';
import { DRUG_DB } from '../../data/support-db';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { PHARMACY_DB } from '../../data/support-db/pharmacy-db';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { normalizeLabValue } from '../../core/constants';
import { SYNERGY_NETWORK } from '../../data/support-synergy-network';

//  НУТРИЦИОЛОГИЧЕСКИЕ ФУНКЦИИ (body-weight dosing, depletion, UL, t½)
// ═══════════════════════════════════════════════════════════════

/** Нормализация дозы по весу тела (мг → мг с учётом кг).
 *  weightNormalized = baseDose × (bodyWeight / referenceWeight)^0.75
 *  Показатель 0.75 — аллометрическое масштабирование Клейбера. */
export function normalizeDoseByWeight(baseDoseMg: number, bodyWeightKg: number, refWeightKg = 80): number {
  const bmiFactor = Math.pow(bodyWeightKg / refWeightKg, 0.75);
  return Math.round(baseDoseMg * bmiFactor);
}

/** Проверка каскадов истощения: если вещество X > порога → флаг истощения Y.
 *  Возвращает массив предупреждений. */
interface DepletionWarning {
  depleter: string; depleted: string; mechanism: string; severity: string;
  recommendation: string;
}
export function checkDepletionCascade(
  substances: string[],
  doses: Record<string, number>,
): DepletionWarning[] {
  const warnings: DepletionWarning[] = [];
  for (const cascade of DEPLETION_CASCADES) {
    const doseMg = doses[cascade.depleter] || 0;
    if (doseMg >= cascade.thresholdMg && substances.includes(cascade.depleter)) {
      const depletedInPlan = substances.includes(cascade.depleted);
      warnings.push({
        depleter: cascade.depleter,
        depleted: cascade.depleted,
        mechanism: cascade.mechanism,
        severity: cascade.severity,
        recommendation: depletedInPlan
          ? `Принимать ${cascade.depleter} и ${cascade.depleted} раздельно (≥${MINERAL_SEPARATION_HOURS[`${cascade.depleter}||${cascade.depleted}`] || 2}ч).`
          : `Рассмотреть добавление ${cascade.depleted} для профилактики дефицита.`,
      });
    }
  }
  return warnings;
}

/** Проверка превышения верхнего допустимого уровня (UL).
 *  Возвращает массив предупреждений. */
interface ULWarning {
  substanceId: string; currentDoseMg: number; ulMg: number;
  percentUL: number; risk: string; recommendation: string;
}
export function checkUpperLimits(
  substances: string[],
  doses: Record<string, number>,
): ULWarning[] {
  const warnings: ULWarning[] = [];
  for (const subId of substances) {
    const ul = NUTRIENT_UL[subId];
    if (!ul) continue;
    const doseMg = doses[subId] || 0;
    if (doseMg > ul) {
      const pct = Math.round(doseMg / ul * 100);
      warnings.push({
        substanceId: subId,
        currentDoseMg: doseMg,
        ulMg: ul,
        percentUL: pct,
        risk: pct > 200 ? 'Высокий риск токсичности' : pct > 150 ? 'Значительное превышение UL' : pct > 100 ? 'Превышение UL' : 'В пределах нормы',
        recommendation: pct > 150
          ? `Снизить дозу до ≤${ul * 1.5} мг/сут под контролем врача.`
          : `Рассмотреть снижение дозы до ≤${ul} мг/сут.`,
      });
    }
  }
  return warnings;
}

/** Агрегация суммарной суточной нагрузки минералов/витаминов по всем веществам в плане.
 *  Учитывает, что multiple вещества могут содержать один и тот же нутриент. */
export function aggregateDailyLoad(
  substances: string[],
  doses: Record<string, number>,
): Record<string, { totalMg: number; contributors: string[]; hasUL: boolean; ulMg?: number }> {
  const agg: Record<string, { totalMg: number; contributors: string[]; hasUL: boolean; ulMg?: number }> = {};
  for (const subId of substances) {
    const doseMg = doses[subId] || 0;
    if (doseMg <= 0) continue;
    // Сначала само вещество как нутриент
    if (NUTRIENT_UL[subId] !== undefined) {
      if (!agg[subId]) agg[subId] = { totalMg: 0, contributors: [], hasUL: true, ulMg: NUTRIENT_UL[subId] };
      agg[subId].totalMg += doseMg;
      agg[subId].contributors.push(subId);
    }
    // Дополнительные кроссиды: vitamin_d3 содержит D3, но ID уже vitamin_d3
  }
  return agg;
}

/** Кратность приёма по периоду полувыведения.
 *  ultra_short → 3-4×/день, short → 2-3×, medium → 1-2×, long → 1× */
function halfLifeMultiplicity(id: string): number {
  const cat = SUBSTANCE_HALF_LIFE[id];
  if (!cat) return 1;
  switch (cat) {
    case 'ultra_short': return 3;
    case 'short': return 2;
    case 'medium': return 1;
    case 'long': return 1;
    case 'ultra_long': return 1;
  }
}

/** Корректировка дозы по биодоступности формы (если известна форма из каталога). */
function adjustForBioavailability(subId: string, baseDoseMg: number): { adjustedMg: number; formInfo: string } {
  const entry = SUPPORT_CATALOG_DATA[subId] || SUPPORT_CATALOG_DATA[subId.toUpperCase()];
  if (!entry) return { adjustedMg: baseDoseMg, formInfo: '' };
  const forms = entry.forms;
  if (!forms || !Array.isArray(forms) || forms.length === 0) return { adjustedMg: baseDoseMg, formInfo: '' };
  const bestForm = forms.find((f: any) => f.best) || forms[0];
  const formKey = (subId + '_' + (bestForm.nameRu || bestForm.name || '')).toLowerCase();
  // Ищем коэффициент биодоступности
  let baCoeff = 0.65; // стандартный fallback
  let formName = bestForm.nameRu || bestForm.name || '';
  for (const [key, coeff] of Object.entries(FORM_BIOAVAIL_MULT)) {
    if (formKey.includes(key)) { baCoeff = coeff; break; }
  }
  // Нормализуем к стандартной биодоступности 0.40 (reference)
  const adjustedMg = Math.round(baseDoseMg * (0.40 / Math.max(0.02, baCoeff)));
  return {
    adjustedMg: Math.max(baseDoseMg * 0.3, adjustedMg), // не меньше 30% от базовой дозы
    formInfo: `Биодоступность формы "${formName}": ${Math.round(baCoeff * 100)}% → доза скорректирована: ${adjustedMg} мг`,
  };
}

/** Оптимизация времени приёма с учётом полувыведения.
 *  Возвращает рекомендацию по кратности для schedule. */
function getHalfLifeInstructions(subId: string): string {
  const mult = halfLifeMultiplicity(subId);
  if (mult >= 3) return 'Разделить на 3-4 приёма в течение дня для поддержания концентрации';
  if (mult === 2) return 'Разделить на 2 приёма (утро + вечер) для стабильного эффекта';
  return '1 раз в день';
}

// ── Synergy helpers ──
// Ищет все синергии кандидата с уже выбранными веществами
export function synergyScoreWithPlan(candidateId: string, planIds: string[]): number {
  let total = 0;
  for (const entry of SYNERGY_NETWORK) {
    if (entry.type !== 'synergy') continue;
    const partners = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g, ...(entry.substances || [])].filter(Boolean) as string[];
    if (!partners.includes(candidateId)) continue;
    for (const pid of planIds) {
      if (partners.includes(pid)) {
        total += entry.score;
      }
    }
  }
  return total;
}

// Ищет все конфликты кандидата с выбранными веществами
export function conflictScoreWithPlan(candidateId: string, planIds: string[]): number {
  let total = 0;
  for (const entry of SYNERGY_NETWORK) {
    if (entry.type !== 'conflict' && entry.type !== 'caution') continue;
    const partners = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g, ...(entry.substances || [])].filter(Boolean) as string[];
    if (!partners.includes(candidateId)) continue;
    for (const pid of planIds) {
      if (partners.includes(pid)) {
        total += entry.score;
      }
    }
  }
  return total;
}

// Генерирует what-if рекомендации синергии для уже выбранного плана
export interface SynergyRecommendation {
  candidateId: string;
  candidateName: string;
  synergiesWith: string[];       // ID веществ в плане, с которыми есть синергия
  synergyScore: number;          // Суммарный score синергии
  newSystemCoverage: number;     // Сколько НОВЫХ систем покроет
  totalSystemCoverage: number;   // Всего систем после добавления
  reason: string;                // Текстовое описание пользы
  effect: string;                // Эффект синергии
  severity: string;              // HIGH / MEDIUM / LOW
}

export function generateSynergyRecommendations(
  planIds: string[],
  activeSystems: string[],
  allDb: Record<string, any[]>,
  planSystemCoverage: Set<string>,
): SynergyRecommendation[] {
  const recommendations: SynergyRecommendation[] = [];
  const used = new Set(planIds);
  for (const [id, entries] of Object.entries(allDb)) {
    if (used.has(id) || !entries || entries.length === 0) continue;
    // Синергия с веществами в плане
    const synScore = synergyScoreWithPlan(id, planIds);
    const confScore = conflictScoreWithPlan(id, planIds);
    if (synScore <= 0 || confScore > 0) continue; // нет синергии или есть конфликт
    // Какие системы покроет новое вещество
    const newSystems = new Set<string>();
    for (const e of entries) {
      const sys = e.organId === 'cns' ? 'neuro' : e.organId;
      if (!planSystemCoverage.has(sys) && activeSystems.includes(sys)) {
        newSystems.add(sys);
      }
    }
    // Хотя бы 1 синергия с планом ИЛИ покрывает новую активную систему
    if (synScore < 4 && newSystems.size === 0) continue;
    // Имена синергистов в плане
    const synergiesWith: string[] = [];
    let bestEffect = '';
    let bestSeverity = 'MEDIUM';
    for (const entry of SYNERGY_NETWORK) {
      if (entry.type !== 'synergy') continue;
      const partners = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g, ...(entry.substances || [])].filter(Boolean) as string[];
      if (!partners.includes(id)) continue;
      for (const pid of planIds) {
        if (partners.includes(pid) && !synergiesWith.includes(pid)) {
          synergiesWith.push(pid);
          if (entry.severity === 'HIGH' || bestSeverity !== 'HIGH') {
            bestEffect = entry.effect;
            bestSeverity = entry.severity;
          }
        }
      }
    }
    const catalogEntry = SUPPORT_CATALOG_DATA[id];
    const candidateName = catalogEntry?.name || id;
    const totalSys = new Set([...planSystemCoverage, ...[...entries].map(e => e.organId === 'cns' ? 'neuro' : e.organId)]).size;
    recommendations.push({
      candidateId: id,
      candidateName,
      synergiesWith,
      synergyScore: synScore,
      newSystemCoverage: newSystems.size,
      totalSystemCoverage: totalSys,
      reason: newSystems.size > 0
        ? `Покрывает ${newSystems.size} новых систем + синергия со ${synergiesWith.length} веществами плана`
        : `Синергия со ${synergiesWith.length} веществами плана (score ${synScore})`,
      effect: bestEffect,
      severity: bestSeverity,
    });
  }
  recommendations.sort((a, b) => (b.newSystemCoverage - a.newSystemCoverage) || (b.synergyScore - a.synergyScore));
  return recommendations.slice(0, 5);
}

export const SYS_META: Record<RiskSystemId, { label: string; icon: string }> = {
  cardio: { label: 'Сердечно-сосудистая', icon: '❤️' },
  hepatic: { label: 'Печень', icon: '🫁' },
  renal: { label: 'Почки', icon: '💧' },
  neuro: { label: 'Нервная система', icon: '🧠' },
  endocrine: { label: 'Эндокринная', icon: '⚖️' },
  hematologic: { label: 'Кроветворная', icon: '🩸' },
  reproductive: { label: 'Репродуктивная', icon: '💪' },
  musculoskeletal: { label: 'ОДА/Мышцы', icon: '🦴' },
};

export const MECH_NAMES: Record<RiskSystemId, string[]> = {
  cardio: ['Дислипидемия', 'Артериальная гипертензия', 'Гипертрофия ЛЖ', 'Тромбогенный потенциал', 'Окислительный стресс', 'Фиброз', 'Аритмогенность'],
  hepatic: ['Холестаз', 'Цитолиз', 'Окислительный стресс', 'Митохондриальная дисфункция', 'Активация звёздчатых клеток', 'Нагрузка CYP450', 'Химическая токсичность'],
  renal: ['Гломерулярная гипертензия', 'Тубулоинтерстициальный фиброз', 'Протеинурия', 'Электролитный дисбаланс', 'Ишемия', 'Нефролитиаз', 'Токсичность метаболитов'],
  neuro: ['Дофаминовый дисбаланс', 'Глутаматная эксайтотоксичность', 'ГАМК-дисрегуляция', 'Нейровоспаление', 'Окислительный стресс', 'Проницаемость ГЭБ', 'Серотониновый дисбаланс'],
  endocrine: ['Подавление ГГЯ', 'Ароматизация', 'Пролактиновый всплеск', 'Инсулинорезистентность', 'Дисфункция ЩЖ', 'Дисбаланс кортизола', 'Десенситизация рецепторов'],
  hematologic: ['Эритроцитоз', 'Тромбоцитоз', 'Лейкоцитоз', 'Изменение реологии', 'Дефицит железа', 'Активация свёртывания', 'Гемолиз'],
  reproductive: ['Атрофия тестикул', 'Олигоспермия', 'Морфология', 'Подвижность', 'Гиперплазия простаты', 'Риск онкологии простаты', 'ЭД'],
  musculoskeletal: ['Мышечный катаболизм', 'Воспаление суставов', 'Тендинопатия', 'Остеопения', 'Фиброз мышц', 'Нарушение восстановления', 'Нервно-мышечная блокада'],
};

function sev(s: string): number {
  return s === 'severe' ? 30 : s === 'moderate' ? 15 : s === 'mild' ? 5 : 0;
}

function clamp(v: number, lo = 0, hi = 100): number { return Math.min(hi, Math.max(lo, v)); }

// ─── Block 1: Profile ───
function rProfile(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const p = s.profile;
  const ageF = clamp(p.age / 40, 0.5, 1.5);
  r.cardio = (r.cardio || 0) + (p.workoutsPerWeek < 2 ? 10 : p.workoutsPerWeek < 4 ? 5 : 0);
  r.cardio! += (p.sleepHours < 6 ? 10 : p.sleepHours < 7 ? 5 : 0);
  r.cardio! += (p.stressLevel > 7 ? 10 : p.stressLevel > 5 ? 5 : 0);
  r.cardio = Math.round(r.cardio! * ageF);
  if (p.smoker) { r.cardio! += 15; r.neuro = (r.neuro || 0) + 5; }
  if (p.alcohol === 'regular') { r.hepatic = (r.hepatic || 0) + 20; }
  else if (p.alcohol === 'sometimes') { r.hepatic = (r.hepatic || 0) + 8; }
  if (p.caffeineMg > 400) { r.neuro = (r.neuro || 0) + 8; r.cardio! += 5; }
  if (p.bodyfat !== undefined && p.bodyfat > 25) { r.cardio! += 8; r.hepatic = (r.hepatic || 0) + 5; }
  if (p.height !== undefined && p.weight !== undefined) {
    const bmi = p.weight / ((p.height / 100) ** 2);
    if (bmi > 30) { r.cardio! += 10; r.hepatic = (r.hepatic || 0) + 5; }
  }
  return r;
}

// ─── Block 2: Neuro ───
function rNeuro(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const n = s.neuro;
  let score = n.dopamineScore * 4 + n.serotoninScore * 3 + n.aggressionScore * 3;
  if (n.gabaBalance === 'overexcited') score += 10;
  else if (n.gabaBalance === 'inhibited') score += 5;
  if (n.memoryIssues) score += 5;
  if (n.focusIssues) score += 5;
  if (n.slowThinking) score += 5;
  if (n.coordinationIssues) score += 5;
  if (n.headaches) score += 5;
  if (n.weatherDependent) score += 3;
  r.neuro = clamp(score);
  if (n.sleepQuality === 'poor') r.neuro += 15;
  else if (n.sleepQuality === 'fair') r.neuro += 5;
  return r;
}

// ─── Block 3: Pharma Stack ───
function rPharma(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const p = s.pharma;
  if (p.aas.length > 0) {
    const totalDose = p.aas.reduce((a, b) => a + b.doseMgWeek, 0);
    const hasOral = p.aas.some(a => ['methandienone','oxandrolone','stanozolol','dianabol','anadrol','winstrol','anavar','turinabol','superdrol','m1t','halodrol','halotestin','methyltestosterone','fluoxymesterone'].some(n => a.id?.toLowerCase().includes(n)));
    const hasTren = p.aas.some(a => a.id.includes('tren'));
    const hasNand = p.aas.some(a => a.id.includes('nand') || a.id.includes('deca'));
    const has19nor = p.aas.some(a => a.id.includes('tren') || a.id.includes('nand') || a.id === 'bold' || a.id === 'eq');
    r.endocrine = clamp(totalDose * 0.02, 0, 50);
    r.reproductive = clamp(totalDose * 0.015, 0, 40);
    r.hepatic = hasOral ? 30 : 5;
    r.cardio = clamp(totalDose * 0.015, 0, 40);
    if (hasTren) { r.neuro = 35; r.cardio! += 10; }
    if (has19nor) { r.neuro = (r.neuro || 0) + 10; }
    if (hasNand) { r.reproductive = clamp((r.reproductive || 0) + 10, 0, 50); }
    r.hematologic = clamp(totalDose * 0.01, 0, 35);
    if (totalDose > 1000) { r.cardio = clamp((r.cardio || 0) + 10, 0, 50); }
  }
  if (p.hasGH) { r.endocrine = (r.endocrine || 0) + 15; r.cardio = (r.cardio || 0) + 5; }
  if (p.hasIGF) { r.endocrine = (r.endocrine || 0) + 8; }
  if (p.hasInsulin) { r.cardio = (r.cardio || 0) + 10; r.neuro = (r.neuro || 0) + 5; }
  return r;
}

// ─── Block 4: Goals ───
function rGoals(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const g = s.goals;
  if (g.trainingCycle === 'mass') { r.cardio = 5; r.hepatic = 5; }
  if (g.cycleWeeks > 16) { r.hepatic = (r.hepatic || 0) + 10; r.cardio = (r.cardio || 0) + 10; r.neuro = (r.neuro || 0) + 5; }
  else if (g.cycleWeeks > 12) { r.hepatic = (r.hepatic || 0) + 5; r.cardio = (r.cardio || 0) + 5; }
  if (g.previousCycles > 5) { r.endocrine = 10; r.reproductive = 10; }
  if (g.previousCycles > 10) { r.endocrine = (r.endocrine || 0) + 5; r.reproductive = (r.reproductive || 0) + 5; }
  if (g.timeSinceLastCycle === '<3mo' || g.timeSinceLastCycle === 'none') { r.endocrine = (r.endocrine || 0) + 10; }
  return r;
}

// ─── Block 5: Hepatobiliary ───
function rHepatic(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const h = s.hepatobiliary;
  r.hepatic = sev(h.altAstElevation) + sev(h.ggtElevation) + sev(h.bilirubinElevation);
  if (h.fattyLiver) r.hepatic += 20;
  if (h.cholecystitis) r.hepatic += 10;
  if (h.alcoholHistory === 'current') r.hepatic += 25;
  else if (h.alcoholHistory === 'past') r.hepatic += 5;
  return r;
}

// ─── Block 6: Urinary ───
function rRenal(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const u = s.urinary;
  r.renal = sev(u.creatinineElevation) + sev(u.ureaElevation);
  if (u.proteinuria) r.renal += 20;
  if (u.nephrotoxicDrugs) r.renal += 15;
  if (u.hypertension) r.renal += 15;
  if (u.diabetes) r.renal += 20;
  return r;
}

// ─── Block 7: Cardiovascular ───
function rCardio(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const c = s.cardio;
  const bpMap: Record<string, number> = { normal: 0, prehypertension: 10, hypertension1: 25, hypertension2: 40 };
  r.cardio = (r.cardio || 0) + (bpMap[c.bpStage] || 0);
  if (c.heartRate > 90) r.cardio += 15;
  else if (c.heartRate > 80) r.cardio += 5;
  r.cardio += sev(c.ldlElevation);
  if (c.hdlLow) r.cardio += 10;
  if (c.triglycerides === 'elevated') r.cardio += 10;
  else if (c.triglycerides === 'high') r.cardio += 20;
  r.cardio += sev(c.hctElevation);
  if (c.previousCVD) r.cardio += 25;
  if (c.familyCVD) r.cardio += 10;
  return r;
}

// ─── Block 8: ODA ───
function rODA(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const o = s.oda;
  r.musculoskeletal = sev(o.jointPain) + (o.injuries.length * 5);
  if (o.ligamentIssues) r.musculoskeletal += 15;
  if (o.backPain) r.musculoskeletal += 10;
  return r;
}

// ─── Block 11: Nutrition ───
function rNutrition(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const n = s.nutrition;
  if (n.calories > 4000) { r.cardio = 5; r.hepatic = 5; }
  if (n.proteinG > 3.5 * (s.profile.weight || 80)) { r.renal = 10; }
  if (n.fatG < 40) { r.endocrine = 5; }
  if (n.waterL < 1.5) { r.renal = 10; r.hematologic = 5; }
  if (n.saltIntake === 'high') { r.cardio = (r.cardio || 0) + 8; r.renal = (r.renal || 0) + 5; }
  if (n.fiberG < 20) { r.cardio = (r.cardio || 0) + 3; }
  if (n.omega3) { r.cardio = Math.max(0, (r.cardio || 0) - 5); }
  return r;
}

// ─── Block 12: Medical Contraindications ───
function rContraind(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const c = s.contraindications;
  if (c.hasCVD) r.cardio = 20;
  if (c.hasThrombophilia) r.hematologic = 25;
  if (c.hasDiabetes) { r.cardio = 10; r.renal = 10; }
  if (c.hasLiverDisease) r.hepatic = 20;
  if (c.hasKidneyDisease) r.renal = 20;
  if (c.hasEpilepsy) r.neuro = 15;
  if (c.hasMentalIllness) r.neuro = (r.neuro || 0) + 10;
  if (c.hasGI) { r.musculoskeletal = 5; r.hepatic = (r.hepatic || 0) + 5; }
  return r;
}

// ─── Epicrisis ───
function rEpicrisis(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const e = s.epicrisis;
  if (e.pastGyno) r.reproductive = 15;
  if (e.pastLibidoDrop) r.reproductive = (r.reproductive || 0) + 10;
  if (e.pastHctSpike) r.hematologic = 15;
  if (e.pastLiverIssues) r.hepatic = 15;
  if (e.pastKidneyIssues) r.renal = 15;
  return r;
}

// ─── Toxic Load ───
function rToxic(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const t = s.toxicLoad;
  if (t.hazardousWork) { r.hepatic = 5; r.renal = 5; r.hematologic = 5; }
  if (t.regularNSAIDs) { r.hepatic = 10; r.renal = 10; }
  if (t.otherHeavyDrugs) { r.hepatic = 15; r.renal = 10; }
  if (t.bowelFrequency === 'constipation') { r.hepatic = 5; }
  return r;
}

// ─── Dental / Mineral ───
function rDental(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const d = s.dental;
  if (d.bleedingGums) r.hematologic = 8;
  if (d.looseTeeth) r.musculoskeletal = 10;
  if (d.nightGrinding) r.neuro = (r.neuro || 0) + 5;
  if (d.boneFractures) r.musculoskeletal = (r.musculoskeletal || 0) + 10;
  if (d.cramps) r.neuro = (r.neuro || 0) + 5;
  return r;
}

// ─── Genetics ───
function rGenetics(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const g = s.genetics;
  if (g.cyp19a1 === 'high') { r.endocrine = 10; r.reproductive = 5; }
  if (g.srd5a2 === 'hypersensitive') { r.reproductive = 10; }
  if (g.arSensitivity === 'high') { r.endocrine = 10; r.cardio = 5; r.hematologic = 5; }
  if (g.mthfr === 'c677t') { r.neuro = 5; r.cardio = (r.cardio || 0) + 5; r.hematologic = (r.hematologic || 0) + 5; }
  return r;
}

// ─── GI ───
function rGI(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const g = s.gi;
  if (g.bloating || g.heartburn || g.diarrhea || g.constipation) {
    r.hepatic = (r.hepatic || 0) + 5;
    r.neuro = (r.neuro || 0) + 3;
  }
  if (g.diagnosedIBS) { r.hepatic = (r.hepatic || 0) + 5; r.musculoskeletal = 5; }
  return r;
}

// ─── Psych ───
function rPsych(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {}; const p = s.psych;
  let neuroAdd = p.fearOfLoss * 3 + p.mirrorObsession * 3 + p.apathyOffCycle * 3;
  r.neuro = clamp(neuroAdd);
  return r;
}

// ─── Injection ───
function rInjection(s: CalculatorState): Partial<Record<RiskSystemId, number>> {
  const r: Record<string, number> = {};
  const inj = s.injection;
  const hasProblem = Object.values(inj).some(v => v !== '' && v !== 'ok');
  if (hasProblem) r.musculoskeletal = 10;
  return r;
}

// ─── Calculates risk from ALL blocks ───
export function calcAllRisks(state: CalculatorState): Record<RiskSystemId, number> {
  const fns = [rProfile, rNeuro, rPharma, rGoals, rHepatic, rRenal, rCardio, rODA,
    rNutrition, rContraind, rEpicrisis, rToxic, rDental, rGenetics, rGI, rPsych, rInjection];
  const scores: Record<string, number> = { cardio: 0, hepatic: 0, renal: 0, neuro: 0, endocrine: 0, hematologic: 0, reproductive: 0, musculoskeletal: 0 };
  for (const fn of fns) {
    const part = fn(state);
    for (const [k, v] of Object.entries(part)) {
      if (v !== undefined) scores[k] = (scores[k] || 0) + v;
    }
  }
  for (const k of Object.keys(scores)) scores[k] = clamp(scores[k]);
  return scores as Record<RiskSystemId, number>;
}

export function toSystemRisks(scores: Record<RiskSystemId, number>, result: CalculatorResult): SystemRisk[] {
  return (Object.keys(SYS_META) as RiskSystemId[]).map(id => {
    const raw = scores[id];
    const mechs: MechanismDetail[] = MECH_NAMES[id].slice(0, 7).map((name, i) => {
      const contribution = raw > 0 ? clamp(Math.round(raw / 7 * (i + 1))) : 0;
      return { id: i + 1, name, contribution, active: contribution > 10, triggers: [] };
    });
    const protection = 0.3 + (result.synergyIdsUsed.length * 0.02);
    const afterSupport = Math.max(0, raw - Math.round(raw * Math.min(protection, 0.7)));
    return { id, label: SYS_META[id].label, icon: SYS_META[id].icon, rawScore: raw, afterSupport, mechanisms: mechs };
  });
}

function selectSynergyGroups(state: CalculatorState): SynergyId[] {
  const sel: SynergyId[] = [];
  const scores = calcAllRisks(state);
  const s = scores;
  const cw = state.courseWeek ?? 1;
  const isLatePhase = cw > 6;
  const isMidPhase = cw > 3 && cw <= 6;
  const threshold = isLatePhase ? 15 : isMidPhase ? 18 : 20;
  const midThreshold = threshold + (isLatePhase ? 10 : 15);
  if (s.hepatic >= threshold) { sel.push('HEPATIC_GSH'); if (s.hepatic >= midThreshold) sel.push('HEPATIC_BILE'); }
  if (s.hepatic >= threshold + 10) sel.push('LIVER_DETOX');
  if (s.cardio >= threshold) { sel.push('CARDIO_LIPID'); if (s.cardio >= midThreshold) sel.push('CARDIO_ANTIAGG'); }
  if (s.cardio >= threshold + 5) sel.push('CARDIO_BP');
  if (s.renal >= threshold) sel.push('RENAL_PROTECT');
  if (s.neuro >= threshold) { sel.push('NEURO_DOPAMINE'); if (s.neuro >= midThreshold) sel.push('NEURO_GABA'); }
  if (s.endocrine >= threshold || state.pharma.phase === 'pct') sel.push('ENDOCRINE');
  if (s.reproductive >= threshold) sel.push('ENDOCRINE');
  if (s.musculoskeletal >= threshold) sel.push('BONE_JOINT');
  if (s.hematologic >= threshold) sel.push('CARDIO_ANTIAGG');
  const pl = state.powerLevel;
  if (isLatePhase) {
    if (!sel.includes('ANTIOXIDANT')) sel.push('ANTIOXIDANT');
    if (!sel.includes('IMMUNE')) sel.push('IMMUNE');
    if (!sel.includes('OMEGA3') && s.cardio >= 10) sel.push('OMEGA3');
    if (!sel.includes('MAGNESIUM')) sel.push('MAGNESIUM');
  }
  if (pl === 'max' || pl === 'boost' || isLatePhase) {
    if (!sel.includes('ANTIOXIDANT')) sel.push('ANTIOXIDANT');
    if (!sel.includes('IMMUNE')) sel.push('IMMUNE');
    if (!sel.includes('METHYLATION') && s.neuro >= 10) sel.push('METHYLATION');
    if (!sel.includes('MAGNESIUM')) sel.push('MAGNESIUM');
    if (!sel.includes('ZINC')) sel.push('ZINC');
    if (!sel.includes('OMEGA3') && s.cardio >= 10) sel.push('OMEGA3');
  }
  if (pl === 'boost' || (isLatePhase && pl !== 'basic')) {
    if (!sel.includes('NEURO_SEROTONIN') && s.neuro >= 15) sel.push('NEURO_SEROTONIN');
    if (!sel.includes('CARDIO_BP')) sel.push('CARDIO_BP');
    if (!sel.includes('VITAMIN_D')) sel.push('VITAMIN_D');
    if (!sel.includes('VITAMIN_B')) sel.push('VITAMIN_B');
  }
  const dedup: [SynergyId, SynergyId][] = [
    ['LIVER_DETOX', 'HEPATIC_GSH'], ['ANTIOXIDANT', 'HEPATIC_GSH'], ['CARDIO_ANTIAGG', 'CARDIO_LIPID'],
  ];
  for (const [sub, parent] of dedup) {
    const idx = sel.indexOf(sub);
    if (idx >= 0 && sel.includes(parent)) sel.splice(idx, 1);
  }
  return [...new Set(sel)];
}

function getSubstancesFromSynergies(synergies: SynergyId[], powerLevel: PowerLevel, blacklist: string[]): string[] {
  const all = new Set<string>();
  for (const sid of synergies) {
    for (const sub of SYNERGY_ID_SUBSTANCES[sid]) all.add(sub);
  }
  // Critical bypass: telmisartan/nebivolol всегда оставляются при гипертензии 2 ст. (critical),
  // даже при basic/mid уровне — иначе пользователь не получит НИЧЕГО для АД >160/100
  if (powerLevel === 'basic') {
    for (const e of ['telmisartan', 'nebivolol', 'l_dopa', 'gaba', 'bile_acids', 'artichoke', 'bergamot', 'red_yeast', 'probiotics']) {
      // telmisartan/nebivolol удаляются только если нет критической гипертензии
      // (вызов getSubstancesFromSynergies не имеет доступа к state, поэтому оставляем их —
      // движок в engine.ts сам решит через scoresPre/sysCoverageCount)
      if (e === 'telmisartan' || e === 'nebivolol') continue;
      all.delete(e);
    }
  }
  if (powerLevel === 'mid') {
    // telmisartan/nebivolol оставляются при mid (не удаляются)
  }
  for (const b of blacklist) all.delete(b);
  return [...all];
}

export function applyTitration(substances: string[], state: CalculatorState): Record<string, number> {
  const d: Record<string, number> = {};
  const c = state.cardio; const p = state.pharma;
  const cw = state.courseWeek ?? 1;
  const bw = state.profile?.weight || 80;
  // Week scaling: early = 0.5x, mid = 0.75x, late = 1.0x
  const weekScale = cw <= 2 ? 0.5 : cw <= 4 ? 0.75 : cw <= 6 ? 0.9 : 1.0;
  if (substances.includes('telmisartan')) {
    const baseDose = c.bpStage === 'hypertension2' ? 120 : c.bpStage === 'hypertension1' ? 80 : 40;
    d.telmisartan = Math.round(baseDose * weekScale / 10) * 10;
  }
  if (substances.includes('nebivolol')) {
    const baseDose = c.heartRate > 95 ? 7.5 : c.heartRate > 85 ? 5 : 2.5;
    d.nebivolol = Math.round(baseDose * weekScale * 2) / 2;
  }
  if (p.hasAI && substances.includes('anastrozole')) {
    const totalTest = p.aas.filter(a => ['test_prop','test_enan','test_cyp','test_undec','test_mix'].includes(a.id)).reduce((s, a) => s + a.doseMgWeek, 0);
    const baseDose = totalTest > 700 ? 1.5 : totalTest > 500 ? 1 : 0.5;
    d.anastrozole = Math.round(baseDose * Math.max(0.75, weekScale) * 2) / 2;
  }
  if (p.hasCaber && substances.includes('cabergoline')) {
    d.cabergoline = cw <= 2 ? 0.125 : 0.25;
  }
  // NAC / TUDCA titration: build up to avoid GI upset
  if (substances.includes('nac')) d.nac = cw <= 2 ? normalizeDoseByWeight(1200, bw) : normalizeDoseByWeight(1800, bw);
  if (substances.includes('tudca')) d.tudca = cw <= 2 ? normalizeDoseByWeight(500, bw) : normalizeDoseByWeight(1000, bw);
  // Body-weight normalized minerals/vitamins
  if (substances.includes('magnesium')) d.magnesium = normalizeDoseByWeight(200, bw);
  if (substances.includes('zinc')) d.zinc = normalizeDoseByWeight(15, bw);
  // 50 мкг = 2000 МЕ (1 мкг = 40 МЕ). UL = 100 мкг = 4000 МЕ (IOM 2011).
  // Ранее передавалось 2000 (как мкг), что после ×40 в doseStr давало 80 000 МЕ — в 20× выше UL.
  if (substances.includes('vitamin_d3')) d.vitamin_d3 = normalizeDoseByWeight(50, bw, 70);
  if (substances.includes('omega3')) d.omega3 = normalizeDoseByWeight(2000, bw);
  if (substances.includes('alpha_lipoic')) d.alpha_lipoic = normalizeDoseByWeight(300, bw);
  if (substances.includes('coq10')) d.coq10 = normalizeDoseByWeight(100, bw);
  if (substances.includes('glycine')) d.glycine = normalizeDoseByWeight(2000, bw);
  if (substances.includes('potassium')) d.potassium = normalizeDoseByWeight(200, bw);
  if (substances.includes('vitamin_c')) d.vitamin_c = normalizeDoseByWeight(500, bw);
  if (substances.includes('selenium')) d.selenium = normalizeDoseByWeight(50, bw, 70);
  // UL-cap: гарантия, что нормализация по весу не превысит верхний допустимый уровень (NUTRIENT_UL).
  // Единицы доз в `d` совпадают с единицами NUTRIENT_UL (мг для макро, мкг для микродоз).
  for (const id of Object.keys(d)) {
    const ul = NUTRIENT_UL[id];
    if (ul !== undefined && d[id] > ul) d[id] = ul;
  }
  return d;
}

export const SUB_NAMES: Record<string, string> = {
  nac:'NAC', alpha_lipoic:'Альфа-липоевая к-та', tudca:'TUDCA', milk_thistle:'Силимарин',
  omega3:'Омега-3', coq10:'CoQ10', bergamot:'Бергамот', red_yeast:'Красный рис',
  telmisartan:'Телмисартан', nebivolol:'Небиволол', magnesium:'Магний',
  aspirin:'Аспирин', nattokinase:'Наттокиназа', bromelain:'Бромелайн',
  astragalus:'Астрагал', celery_extract:'Сельдерей', potassium:'Калий',
  tyrosine:'L-Тирозин', l_dopa:'L-ДОФА', vitamin_b6:'B6',
  glycine:'Глицин', theanine:'L-Теанин', gaba:'GABA',
  x5htp:'5-HTP', vitamin_c:'Витамин C', zinc:'Цинк', vitamin_d3:'D3',
  probiotics:'Пробиотики', vitamin_e:'Витамин E', glutathione:'Глутатион',
  betaine:'TMG', folate:'5-МТГФ', vitamin_b12:'B12',
  calcium:'Кальций', boron:'Бор', vitamin_k2:'K2',
  ashwagandha:'Ашваганда', selenium:'Селен', artichoke:'Артишок',
  bile_acids:'Жёлчные к-ты', berberine:'Берберин', anastrozole:'Анастрозол',
  cabergoline:'Каберголин', hcg:'ХГЧ', tamoxifen:'Тамоксифен',
  curcumin:'Куркумин', piperine:'Пиперин', reishi:'Рейши', maitake:'Майтаке',
  shilajit:'Шиладжит', chaga:'Чага', cordyceps:'Кордицепс', lions_mane:'Ежовик',
  saw_palmetto:'Пальма сереноа', pygeum:'Слива африканская',
  taurine:'Таурин', inositol:'Инозитол', nac_acetyl:'N-ацетилтаурин',
  dhea:'DHEA', pregnenolone:'Прегненолон',
  collagen:'Коллаген', glucosamine:'Глюкозамин', msm:'МСМ',
  boswellia:'Босвеллия', chondroitin_sulfate:'Хондроитин', hyaluronic_acid:'Гиалуроновая к-та',
  bpc157:'BPC-157', tb500:'TB-500',
  melatonin:'Мелатонин', '5htp':'5-HTP', stjohns_wort:'Зверобой',
  grape_seed:'Экстракт косточек винограда', pine_bark:'Экстракт коры сосны',
  DIM:'DIM', indole_3_carbinol:'I3C', calcium_d_glucarate:'Кальция D-глюкарат',
  selenium_yeast:'Селен (дрожжи)', methylfolate:'5-МТГФ',
  niacin:'Ниацин', pantethine:'Пантетин', red_yeast_rice:'Красный дрожжевой рис',
  celadrin:'Целадрин', emu_oil:'Эму масло', cissus:'Циссус',
  l_citrulline:'L-Цитруллин', beet_root:'Свёкла',
  tadalafil:'Тадалафил', agmatine:'Агматин', pycnogenol:'Пикногенол',
  astaxanthin:'Астаксантин', hesperidin:'Гесперидин', dandelion:'Одуванчик',
  serrapeptase:'Серрапептаза', garlic:'Чеснок', metformin:'Метформин', chromium:'Хром',
};

export function generateSchedule(substances: string[], synergyIds: SynergyId[], doses: Record<string, number>, state: CalculatorState): ScheduleItem[] {
  const schedule: ScheduleItem[] = [];
  const used = new Set<string>();
  const morningGroup = ['vitamin_c','vitamin_d3','vitamin_e','coq10','alpha_lipoic','selenium','boron','zinc','telmisartan','nebivolol','ashwagandha','calcium','vitamin_k2','probiotics','anastrozole','cabergoline','hcg','curcumin','dhea','pregnenolone','collagen','l_citrulline','DIM','saw_palmetto','tyrosine','tadalafil','pycnogenol','astaxanthin','agmatine','chromium','serrapeptase','garlic','dandelion'];
  const afternoonGroup = ['berberine','bromelain','nattokinase','betaine','folate','vitamin_b12','magnesium','potassium','artichoke','bile_acids','omega3','glucosamine','msm','boswellia','chondroitin_sulfate','taurine','inositol','piperine','reishi','maitake','shilajit','chaga','cordyceps','lions_mane','hesperidin','metformin'];
  const eveningGroup = ['nac','tudca','milk_thistle','glycine','theanine','gaba','x5htp','vitamin_b6','astragalus','celery_extract','glutathione','bergamot','red_yeast','aspirin','tamoxifen','5htp','hyaluronic_acid','bpc157','tb500','melatonin'];
  const timeOf = (id: string): TimeBlock => morningGroup.includes(id) ? 'morning' : afternoonGroup.includes(id) ? 'afternoon' : 'evening';
  const bw = state.profile?.weight || 80;

  const doseStr = (id: string): string => {
    if (doses[id]) {
      const val = doses[id];
      // МКГ-единицы для микродоз
      if (id === 'selenium' || id === 'folate' || id === 'vitamin_k2' || id === 'boron' || id === 'chromium')
        return val + ' мкг';
      // МЕ для витамина D
      if (id === 'vitamin_d3') {
        const iu = Math.round(val * 40); // 1 мкг = 40 МЕ
        return iu >= 1000 ? iu + ' МЕ' : val + ' мкг';
      }
      if (id === 'bpc157' || id === 'tb500') return val + ' мкг';
      return val + ' мг';
    }
    const defs: Record<string, string> = {
      nac:'1200 мг', alpha_lipoic:'300 мг', tudca:'500 мг', milk_thistle:'280 мг',
      omega3:'2000 мг', coq10:'100 мг', magnesium:'200 мг', telmisartan:'40 мг',
      nebivolol:'5 мг', aspirin:'100 мг', nattokinase:'2000 ФЕ', bromelain:'500 мг',
      astragalus:'500 мг', celery_extract:'500 мг', potassium:'200 мг',
      tyrosine:'500 мг', l_dopa:'250 мг', vitamin_b6:'25 мг',
      glycine:'2000 мг', theanine:'100 мг', gaba:'500 мг',
      x5htp:'50 мг', vitamin_c:'500 мг', zinc:'15 мг', vitamin_d3:'2000 МЕ',
      probiotics:'1 капс', vitamin_e:'100 мг', glutathione:'100 мг',
      betaine:'1000 мг', folate:'200 мкг', vitamin_b12:'500 мкг',
      calcium:'250 мг', boron:'2 мг', vitamin_k2:'100 мкг',
      ashwagandha:'300 мг', selenium:'50 мкг', artichoke:'250 мг',
      bile_acids:'250 мг', bergamot:'500 мг', red_yeast:'600 мг',
      berberine:'500 мг', anastrozole:'0.5 мг', cabergoline:'0.25 мг',
      hcg:'500 МЕ', tamoxifen:'10 мг', curcumin:'500 мг', piperine:'5 мг',
      reishi:'500 мг', maitake:'500 мг', shilajit:'250 мг', chaga:'500 мг',
      cordyceps:'500 мг', lions_mane:'500 мг', saw_palmetto:'320 мг',
      taurine:'1000 мг', inositol:'1000 мг', dhea:'25 мг', pregnenolone:'50 мг',
      collagen:'5000 мг', glucosamine:'1500 мг', msm:'1000 мг', boswellia:'300 мг',
      chondroitin_sulfate:'1200 мг', hyaluronic_acid:'200 мг',
      bpc157:'250 мкг', tb500:'5 мг', melatonin:'3 мг', '5htp':'100 мг',
      DIM:'100 мг', l_citrulline:'3000 мг',
      tadalafil:'5 мг', agmatine:'1000 мг', pycnogenol:'150 мг',
      astaxanthin:'4 мг', hesperidin:'500 мг', dandelion:'500 мг',
      serrapeptase:'10 мг', garlic:'1200 мг', metformin:'500 мг', chromium:'200 мкг',
    };
    return defs[id] || 'по инструкции';
  };

  /** Контекст приёма пищи для вещества. */
  const mealCtxFor = (id: string): string => {
    const rule = MEAL_CONTEXT_RULES.find(r => r.substanceId === id);
    if (!rule) return 'С едой';
    if (rule.emptyStomach) return 'Натощак (за 30-60 мин до еды)';
    if (rule.requireFat) return 'С пищей, содержащей жиры (для усвоения)';
    if (rule.requireWithFood) return 'С едой';
    return 'С едой';
  };

  /** Half-life-aware инструкция. */
  const hlInst = (id: string): string => {
    const mult = halfLifeMultiplicity(id);
    if (mult >= 3) return `Разделить на 3-4 приёма (t½ < 2ч). ${mealCtxFor(id)}`;
    if (mult === 2) return `Разделить на 2 приёма (t½ 2-6ч). ${mealCtxFor(id)}`;
    return mealCtxFor(id);
  };

  for (const sub of substances) {
    if (used.has(sub)) continue; used.add(sub);
    const block = timeOf(sub);
    const catEntry = SUPPORT_CATALOG_DATA[sub] || SUPPORT_CATALOG_DATA[sub.toUpperCase()];
    const name = SUB_NAMES[sub] || catEntry?.nameRu || catEntry?.name || sub;
    // Bioavailability-adjusted dose display
    const { formInfo } = adjustForBioavailability(sub, doses[sub] || 0);
    schedule.push({
      substanceId: sub, name,
      dose: doseStr(sub),
      timeBlock: block,
      instructions: hlInst(sub) + (formInfo ? `. ${formInfo}` : ''),
      synergyGroup: synergyIds.find(sid => SYNERGY_ID_SUBSTANCES[sid]?.includes(sub)),
    });
  }
  const order: Record<TimeBlock, number> = { morning: 0, afternoon: 1, evening: 2 };
  schedule.sort((a, b) => order[a.timeBlock] - order[b.timeBlock] || a.name.localeCompare(b.name));
  return schedule;
}

export function getBlacklist(state: CalculatorState): string[] {
  return state.journal.negative.map(n => n.substanceId);
}

export function calcLabDeltas(state: CalculatorState): LabDelta[] {
  const { preCourse, midCourse, postPCT } = state.labs;
  const markers = new Set<string>();
  for (const slice of [preCourse, midCourse, postPCT]) {
    if (slice) for (const k of Object.keys(slice.panelSex || {})) markers.add(k);
    if (slice) for (const k of Object.keys(slice.panelBiochem || {})) markers.add(k);
    if (slice) for (const k of Object.keys(slice.panelHematology || {})) markers.add(k);
    if (slice) for (const k of Object.keys(slice.panelThyroid || {})) markers.add(k);
  }
  const res: LabDelta[] = [];
  const getVal = (slice: LabSlice | null, marker: string): string | undefined => {
    if (!slice) return undefined;
    return slice.panelSex[marker] ?? slice.panelBiochem[marker] ?? slice.panelHematology[marker] ?? slice.panelThyroid[marker] ?? undefined;
  };
  for (const marker of markers) {
    const preV = getVal(preCourse, marker); const midV = getVal(midCourse, marker); const postV = getVal(postPCT, marker);
    const dPreMid = preV !== undefined && midV !== undefined ? Math.round((Number(midV) - Number(preV)) / Number(preV) * 100) : undefined;
    let trend: LabDelta['trend'] = 'stable';
    const vals = [preV, midV, postV].filter(v => v !== undefined).map(Number);
    if (vals.length >= 2) {
      const last = vals[vals.length - 1]; const first = vals[0];
      const delta = last - first;
      trend = Math.abs(delta) > 20 ? (delta > 0 ? 'worsening' : 'improving') : 'stable';
      if (Math.abs(delta) > 50) trend = 'critical';
    }
    res.push({ marker, sliceValues: [preV, midV, postV], trend });
  }
  return res;
}

export function getContraindicationAlerts(state: CalculatorState): string[] {
  const alerts: string[] = [];
  const c = state.contraindications;
  if (c.hasCVD) alerts.push('⚠ ССЗ: избегать высоких доз стимуляторов, контролировать АД/ЧСС');
  if (c.hasThrombophilia) alerts.push('⚠ Тромбофилия: избегать высоких доз андрогенов, контролировать гематокрит');
  if (c.hasLiverDisease) alerts.push('⚠ Заболевания печени: минимизировать оральные ААС, поддержка гепатопротекторов');
  if (c.hasKidneyDisease) alerts.push('⚠ Заболевания почек: избегать НПВС, контролировать креатинин');
  if (c.allergies) alerts.push(`⚠ Аллергии: ${c.allergies}`);
  return alerts;
}

// ── TZ Risk Engine helpers ──
function extractLabValues(labs: CalculatorState['labs']): Record<string, number> {
  const v: Record<string, number> = {};
  const fp = labs?.fullPanel || labs?.midCourse || labs?.preCourse;
  if (!fp) return v;

  const num = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
    return isNaN(n) ? undefined : n;
  };

  // panelBiochem: ALT, AST, GGT, Bilirubin, Glucose, Creatinine, Urea, Uric acid, CRP, Homocysteine
  const b = (fp.panelBiochem || {}) as Record<string, any>;
  if (num(b.ALT) !== undefined) v['ALT'] = num(b.ALT)!;
  if (num(b.AST) !== undefined) v['AST'] = num(b.AST)!;
  if (num(b.GGT) !== undefined) v['GGT'] = num(b.GGT)!;
  if (num(b.Bilirubin) !== undefined) v['BIL'] = num(b.Bilirubin)!;
  if (num(b.Glucose) !== undefined) v['GLU'] = num(b.Glucose)!;
  if (num(b.Creatinine) !== undefined) v['CREAT'] = num(b.Creatinine)!;
  if (num(b.CRP) !== undefined) v['CRP'] = num(b.CRP)!;
  if (num(b.Homocysteine) !== undefined) v['HOMOCYSTEINE'] = num(b.Homocysteine)!;
  // Insulin (may be in panelBiochem or panelSex depending on lab)
  const sForIns = (fp.panelSex || {}) as Record<string, any>;
  const insVal = num(b.Insulin) ?? num(sForIns.Insulin);
  if (insVal !== undefined) {
    // HOMA-IR = (glucose mmol/L × insulin μU/mL) / 22.5
    const glu = v['GLU'];
    if (glu !== undefined) {
      v['HOMA'] = Math.round((glu * insVal) / 22.5 * 100) / 100;
    }
  }

  // panelLipid: Total Cholesterol, LDL, HDL, Triglycerides, VLDL, ApoB, ApoA1, Lp(a)
  const lip = (fp.panelLipid || {}) as Record<string, any>;
  if (num(lip.LDL) !== undefined) v['LDL'] = num(lip.LDL)!;
  if (num(lip.HDL) !== undefined) v['HDL'] = num(lip.HDL)!;
  if (num(lip.Triglycerides) !== undefined) v['TG'] = num(lip.Triglycerides)!;
  if (num(lip['Total Cholesterol']) !== undefined) v['TC'] = num(lip['Total Cholesterol'])!;

  // panelHematology: HCT, Hemoglobin, RBC, WBC, Platelets
  const h = (fp.panelHematology || {}) as Record<string, any>;
  if (num(h.HCT) !== undefined) v['HCT'] = num(h.HCT)!;
  if (num(h.Hemoglobin) !== undefined) v['HGB'] = num(h.Hemoglobin)!;
  if (num(h.Platelets) !== undefined) v['PLT'] = num(h.Platelets)!;

  // panelSex: LH, FSH, Total T, Free T, E2, Prolactin, SHBG, DHT, Progesterone, Cortisol
  const s = (fp.panelSex || {}) as Record<string, any>;
  if (num(s.LH) !== undefined) v['LH'] = num(s.LH)!;
  if (num(s.FSH) !== undefined) v['FSH'] = num(s.FSH)!;
  if (num(s['Total T']) !== undefined) v['TT'] = normalizeLabValue('Total T', num(s['Total T'])!);
  if (num(s.E2) !== undefined) v['E2'] = normalizeLabValue('E2', num(s.E2)!);
  if (num(s.Prolactin) !== undefined) v['PRL'] = normalizeLabValue('Prolactin', num(s.Prolactin)!);
  if (num(s.SHBG) !== undefined) v['SHBG'] = num(s.SHBG)!;
  if (num(s.Cortisol) !== undefined) v['CORTISOL'] = normalizeLabValue('Cortisol', num(s.Cortisol)!);

  // panelThyroid: TSH, T3 free, T4 free
  const th = (fp.panelThyroid || {}) as Record<string, any>;
  if (num(th.TSH) !== undefined) v['TSH'] = num(th.TSH)!;

  // panelMineral: Calcium, Phosphorus, Magnesium, Sodium, Potassium, Chloride
  const min = (fp.panelMineral || {}) as Record<string, any>;
  if (num(min.Potassium) !== undefined) v['K'] = num(min.Potassium)!;
  if (num(min.Sodium) !== undefined) v['NA'] = num(min.Sodium)!;

  // panelCoagulation: D-dimer, Fibrinogen, PT, APTT, INR
  const coag = (fp.panelCoagulation || {}) as Record<string, any>;
  if (num(coag['D-dimer']) !== undefined) v['D_DIMER'] = num(coag['D-dimer'])!;
  if (num(coag.Fibrinogen) !== undefined) v['FIBRINOGEN'] = num(coag.Fibrinogen)!;

  // panelCardiac: CK, CK-MB, Troponin I, NT-proBNP
  const card = (fp.panelCardiac || {}) as Record<string, any>;
  if (num(card['NT-proBNP']) !== undefined) v['BNP'] = num(card['NT-proBNP'])!;

  // panelInflammatory: IL-6, TNF-alpha, hsCRP
  const infl = (fp.panelInflammatory || {}) as Record<string, any>;
  if (num(infl.hsCRP) !== undefined && v['CRP'] === undefined) v['CRP'] = num(infl.hsCRP)!;

  // panelTumor: PSA total
  const tum = (fp.panelTumor || {}) as Record<string, any>;
  if (num(tum['PSA total']) !== undefined) v['PSA'] = num(tum['PSA total'])!;
  if (num(tum['PSA free']) !== undefined) v['PSA_FREE'] = num(tum['PSA free'])!;

  // panelUrinalysis: Protein
  const ua = (fp.panelUrinalysis || {}) as Record<string, any>;
  if (num(ua.Protein) !== undefined) v['UACR'] = num(ua.Protein)!;

  // panelIron: Ferritin, Iron, TIBC
  const iron = (fp.panelIron || {}) as Record<string, any>;
  if (num(iron.Ferritin) !== undefined) v['FERRITIN'] = num(iron.Ferritin)!;
  if (num(iron.Iron) !== undefined) v['IRON'] = num(iron.Iron)!;
  if (num(iron.TIBC) !== undefined) v['TIBC'] = num(iron.TIBC)!;

  // panelVitamin: B12, Folate, Vitamin D (25-OH)
  const vit = (fp.panelVitamin || {}) as Record<string, any>;
  if (num(vit['Vitamin D (25-OH)']) !== undefined) v['VITD'] = num(vit['Vitamin D (25-OH)'])!;
  if (num(vit.B12) !== undefined) v['B12'] = num(vit.B12)!;
  if (num(vit.Folate) !== undefined) v['FOLATE'] = num(vit.Folate)!;

  // panelAdrenal: DHEA-S, Aldosterone, PTH
  const adr = (fp.panelAdrenal || {}) as Record<string, any>;
  if (num(adr['DHEA-S']) !== undefined) v['DHEAS'] = num(adr['DHEA-S'])!;
  if (num(adr.Aldosterone) !== undefined) v['ALDO'] = num(adr.Aldosterone)!;
  if (num(adr.PTH) !== undefined) v['PTH'] = num(adr.PTH)!;

  // panelMineral: Calcium, Magnesium, Phosphorus
  if (num(min.Calcium) !== undefined) v['CA'] = num(min.Calcium)!;
  if (num(min.Magnesium) !== undefined) v['MG'] = num(min.Magnesium)!;
  if (num(min.Phosphorus) !== undefined) v['PHOS'] = num(min.Phosphorus)!;

  // panelCardiac: CK, CK-MB, Troponin
  if (num(card.CK) !== undefined) v['CK'] = num(card.CK)!;
  if (num(card['CK-MB']) !== undefined) v['CKMB'] = num(card['CK-MB'])!;
  if (num(card['Troponin I']) !== undefined) v['TROP'] = num(card['Troponin I'])!;

  // panelInflammatory: IL-6, TNF-alpha
  if (num(infl['IL-6']) !== undefined) v['IL6'] = num(infl['IL-6'])!;
  if (num(infl['TNF-alpha']) !== undefined) v['TNFA'] = num(infl['TNF-alpha'])!;

  // panelBiochem доп: Urea, Uric acid
  if (num(b.Urea) !== undefined) v['UREA'] = num(b.Urea)!;
  if (num(b['Uric acid']) !== undefined) v['URIC'] = num(b['Uric acid'])!;

  // panelHematology доп: RBC, WBC
  if (num(h.RBC) !== undefined) v['RBC'] = num(h.RBC)!;
  if (num(h.WBC) !== undefined) v['WBC'] = num(h.WBC)!;

  // panelSex доп: Free T, DHT, Progesterone
  if (num(s['Free T']) !== undefined) v['FT'] = num(s['Free T'])!;
  if (num(s.DHT) !== undefined) v['DHT'] = num(s.DHT)!;
  if (num(s.Progesterone) !== undefined) v['PROG'] = num(s.Progesterone)!;

  // panelThyroid доп: T3 free, T4 free, Anti-TPO
  if (num(th['T3 free']) !== undefined) v['T3'] = num(th['T3 free'])!;
  if (num(th['T4 free']) !== undefined) v['T4'] = num(th['T4 free'])!;
  if (num(th['Anti-TPO']) !== undefined) v['ANTI_TPO'] = num(th['Anti-TPO'])!;

  // eGFR calculated from creatinine (MDRD simplified)
  if (v['CREAT'] !== undefined) {
    const cr = v['CREAT']; // μmol/L
    const egfr = Math.round(175 * Math.pow(cr / 88.4, -1.154));
    v['eGFR'] = Math.min(120, Math.max(15, egfr));
  }

  return v;
}

export function buildTzInput(state: CalculatorState, supportSubs: string[]): TzSpecInput | null {
  const drugs: DrugInput[] = [];
  const aasList = state.pharma.aas;

  for (const a of aasList) {
    const id = (a.id || '').toLowerCase();
    const dbEntry = DRUG_DB[id] || DRUG_DB[a.id];
    const form = dbEntry?.form === 'oral' ? 'oral' as const : 'inject' as const;
    const dbClass = dbEntry?.class || 'aas';
    const drugClass: 'aas' | 'gh' | 'insulin' = dbClass === 'gh' ? 'gh' : dbClass === 'insulin' ? 'insulin' : 'aas';
    drugs.push({ drugClass, drugName: a.id, dose: a.doseMgWeek || 0, form, startWeek: a.startWeek, endWeek: a.endWeek });
  }

  if (state.pharma.hasGH && !drugs.some(d => d.drugName === 'mk677' || d.drugName === 'cjc1295')) {
    drugs.push({ drugClass: 'gh', drugName: 'cjc1295', dose: 300, form: 'inject' });
  }
  if (state.pharma.hasIGF && !drugs.some(d => d.drugName === 'igf1_lr3')) {
    drugs.push({ drugClass: 'gh', drugName: 'igf1_lr3', dose: 100, form: 'inject' });
  }
  if (state.pharma.hasInsulin && !drugs.some(d => d.drugClass === 'insulin')) {
    drugs.push({ drugClass: 'insulin', drugName: 'ins_short', dose: 10, form: 'inject' });
  }
  if (state.pharma.hasGLP1 && !drugs.some(d => d.drugName === 'semaglutide' || d.drugName === 'tirzepatide')) {
    drugs.push({ drugClass: 'insulin', drugName: 'semaglutide', dose: 5, form: 'inject' });
  }

  if (drugs.length === 0) return null;

  const allAasWeeks = aasList.map(a => a.weeks || 12);
  const duration = Math.max(...allAasWeeks, 12);
  const labValues = extractLabValues(state.labs);
  const firstDrug = drugs[0];
  // Genetics
  const genetics = state.genetics ? {
    cyp19a1: state.genetics.cyp19a1,
    srd5a2: state.genetics.srd5a2,
    mthfr: state.genetics.mthfr,
    ar: state.genetics.arSensitivity,
  } : undefined;
  // Nutrition
  const n = state.nutrition;
  const nutrition = n ? {
    proteinPerKg: n.proteinGPerKg || (n.proteinG && state.profile?.weight ? n.proteinG / state.profile.weight : 1.8),
    fiberG: n.fiberG || 25,
    omega3G: n.omega3 ? 1.5 : 0.5,
    sodiumG: (n.sodiumMg || 3000) / 1000,
    potassiumG: (n.potassiumMg || 3000) / 1000,
    waterL: n.waterL || 2,
    calories: n.calories || 2500,
  } : undefined;
  // Training
  const p = state.profile;
  const training = p ? {
    hasHIIT: (p.workoutsPerWeek || 3) >= 4,
    weeklyMinutes: (p.workoutsPerWeek || 3) * (p.avgWorkoutMinutes || 60),
    volumeTonnes: 8000,
    lissMinutesPerWeek: 60,
  } : undefined;
  return {
    drugClass: firstDrug.drugClass, drugName: firstDrug.drugName,
    dose: firstDrug.dose, duration,
    form: firstDrug.form,
    combinations: Math.max(1, drugs.length),
    labCoverage: Math.min(1.0, 0.3 + Object.keys(labValues).length * 0.04),
    labValues, supportSubstances: supportSubs, drugs,
    genetics, nutrition, training,
    courseWeek: state.courseWeek,
  };
}

export function tzToScores(tzResult: TzSpecResult, oldScores: Record<RiskSystemId, number>): Record<RiskSystemId, number> {
  const scores: Record<string, number> = {
    cardio: 0, hepatic: 0, renal: 0, neuro: 0,
    endocrine: 0, hematologic: 0, reproductive: 0, musculoskeletal: 0,
  };
  for (const organ of tzResult.organs) {
    const mappedId = organ.id === 'cns' ? 'neuro' : organ.id;
    scores[mappedId] = organ.rawPercent;
  }
  scores['endocrine'] = oldScores['endocrine'] || 0;
  scores['musculoskeletal'] = oldScores['musculoskeletal'] || 0;
  return scores as Record<RiskSystemId, number>;
}

export function toSystemRisksFromTz(
  tzResult: TzSpecResult,
  oldScores: Record<RiskSystemId, number>,
  synergyCount: number,
): SystemRisk[] {
  const tzMechMap = new Map<string, TzSpecMechanismResult[]>();
  const tzAfterMap = new Map<string, number>();
  for (const organ of tzResult.organs) {
    tzMechMap.set(organ.id, organ.mechanisms);
    tzAfterMap.set(organ.id, organ.afterPercent);
  }
  return (Object.keys(SYS_META) as RiskSystemId[]).map(id => {
    const tzId = id === 'neuro' ? 'cns' : id;
    const tzMechs = tzMechMap.get(tzId) || [];
    const raw = oldScores[id] || 0;
    const afterSupport = tzAfterMap.get(tzId) ?? Math.max(0, raw - Math.round(raw * Math.min(0.7, 0.3 + synergyCount * 0.02)));
    const mechs: MechanismDetail[] = tzMechs.length > 0
      ? tzMechs.map((m, i) => ({
          id: i + 1, name: m.name, contribution: Math.round(m.raw), active: m.raw > 5, triggers: [],
          mechId: m.id, weight: m.weight, m_i: m.m_i, E_i: m.E_i, k_used: m.k_used, q_label: m.q_label,
        }))
      : MECH_NAMES[id].slice(0, 7).map((name, i) => ({
          id: i + 1, name, contribution: raw > 0 ? Math.round(raw / 7 * (i + 1)) : 0, active: false, triggers: [],
        }));
    return { id, label: SYS_META[id].label, icon: SYS_META[id].icon, rawScore: raw, afterSupport, mechanisms: mechs };
  });
}

// Константы SUB_ALIAS, canonId, TZ_AUTO_BLACKLIST, SAME_CLASS_GROUPS,
// ID_TO_CLASS, sameClassIds — перенесены в ./shared-constants.ts
// (разрыв circular dependency с recommendation-engine.ts).
// Ре-экспорт через `export { ... }` в шапке файла.