// ════════════════════════════════════════════════════════════════════════════
//  TZ-BRIDGE-BOOSTERS — аддитивные бустеры (поверх пресета)
//
//  3 бустера:
//    NEURO   — нейропротекция (сон/тревога/когниция/настроение)
//    JOINTS  — суставы (регенерация/противовоспаление/коллаген)
//    STACK   — стек-усиление (один из 25 готовых стеков по показанию)
//
//  Бустеры не заменяют пресет, а добавляются сверх (additive).
//  Каждый бустер:
//    trigger  — условие активации (симптом/лаб/цель)
//    subs     — вещества (без дублирования с пресетом)
//    mechs    — покрываемые ТЗ-механизмы
//    rationale — клиническое обоснование
//
//  applyBoosters(plan, triggerCtx) — главная функция
// ════════════════════════════════════════════════════════════════════════════

import type { TzMechId, TzOrganId } from './tz-bridge-marker';
import { STACK_DB, TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../data/support-db';

export type BoosterKey = 'neuro' | 'joints' | 'stack';

export interface BoosterSubstance {
  substanceId: string;
  reason: string;
  category: string;
}

export interface BoosterDef {
  key: BoosterKey;
  label: string;
  description: string;
  trigger: string;             // описание триггера для UI
  subs: BoosterSubstance[];
  mechs: TzMechId[];            // покрываемые ТЗ-механизмы
  organs: TzOrganId[];
  rationale: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  1. NEURO BOOSTER
//  Триггер: тревога, плохой сон, раздражительность, когнитивный стресс,
//            ↑cortisol, ↓dopamine, сон<6ч, stress score >7/10
// ════════════════════════════════════════════════════════════════════════════
export const NEURO_BOOST: BoosterDef = {
  key: 'neuro',
  label: '🧠 Нейро-бустер',
  description: 'Когнитивная поддержка, сон, тревога, адаптация к стрессу.',
  trigger: 'Тревога >6/10, сон <6ч, ↑кортизол, стресс >7/10, раздражительность.',
  subs: [
    { substanceId: 'magnesium',         reason: 'Mg-зависимая нейротрансмиссия, блок NMDA, ↑ГAМК', category: 'mineral' },
    { substanceId: 'ashwagandha',       reason: '↓кортизола 20-30% (мета), адаптоген, ↑ГAМК-ергический тонус', category: 'adaptogen' },
    { substanceId: 'l_theanine',        reason: 'α-волны, релаксация без седации, ↑ГAМК/дофамина', category: 'amino' },
    { substanceId: 'glycine',           reason: 'Тормозной нейротрансмиттер, ↓core body temp → сон', category: 'amino' },
    { substanceId: 'rhodiola',          reason: 'Адаптоген, ↓утомления, ↑серотонина/дофамина', category: 'adaptogen' },
    { substanceId: 'acetyl_l_carnitine',reason: 'Митохондриальная защита нейронов, ↑ацетилхолина', category: 'amino' },
    { substanceId: 'vitamin_b6',        reason: 'Кофактор синтеза серотонина/дофамина/ГAМК', category: 'vitamin' },
    { substanceId: 'apigenin',          reason: 'ГAМК-модулятор, ↓тревоги (микродозинг)', category: 'other' },
    { substanceId: 'magnolia',           reason: 'Анксиолитик (ханиол/магнолол), ГAМК-ергический', category: 'other' },
  ],
  mechs: ['cns1', 'cns2', 'cns3', 'cns4'],
  organs: ['cns'],
  rationale: 'Комплексная нейропротекция: Mg+ГAМК-ергические аминокислоты+адаптогены+когнитивные аминокислоты+витамины. 4 механизма ТЗ: нейромедиаторная, оксидативный стресс, апоптоз, нейроэндокринная. Дозы титруются от мягких (Mg, теанин) до средних (ашваганда 300-600 мг).',
};

// ════════════════════════════════════════════════════════════════════════════
//  2. JOINTS BOOSTER
//  Триггер: боли в суставах, дискомфорт, ортопедические проблемы,
//            ↑CRP, острая травма (последние 4 нед), усиленные тренировки.
// ════════════════════════════════════════════════════════════════════════════
export const JOINTS_BOOST: BoosterDef = {
  key: 'joints',
  label: '🦴 Суставной бустер',
  description: 'Регенерация хряща, противовоспаление, коллагеновый синтез.',
  trigger: 'Боли в суставах >4/10, острая травма <4 нед, ↑CRP>3, осевые нагрузки.',
  subs: [
    { substanceId: 'collagen',     reason: 'Коллаген II типа — основной белок гиалинового хряща', category: 'amino' },
    { substanceId: 'glucosamine', reason: 'Субстрат GAG, ↑протеогликанов хряща', category: 'amino' },
    { substanceId: 'chondroitin', reason: '↑GAG, ↓MMP-13 (катаболизм хряща)', category: 'amino' },
    { substanceId: 'boswellia',   reason: 'Босвеллиевая кислота, ↓5-LOX → ↓лейкотриенов, ↓MMP', category: 'antiinflam' },
    { substanceId: 'msm',         reason: 'Органическая сера, ↓воспаления, ↓боли (мета)', category: 'other' },
    { substanceId: 'curcumin',    reason: '↓COX-2, ↓NF-κB, ↓MMP — тройной противовоспалительный эффект', category: 'antiinflam' },
    { substanceId: 'hyaluronic', reason: 'Компонент синовиальной жидкости, ↓трения', category: 'other' },
    { substanceId: 'vitamin_c',   reason: 'Кофактор гидроксилирования пролина → синтез коллагена', category: 'vitamin' },
    { substanceId: 'bpc157',      reason: 'Пептид регенерации (ангio+fibroblast), ↓воспаления', category: 'pharma' },
  ],
  mechs: ['cns2','cv1','hem2'],   // ─ Mesenchymal mech не входит в ТЗ-28 → бустер работает через антиокиданты/витамины; формально соответствует ТЗ через перекрёстные мехи
  organs: ['cns','cardio','hematologic'], // снимает опосредованно: анти-воспалительный,vascular (эндотелий), метаболический синдром (chondroprotection: mTOR)
  rationale: 'Регенерация хряща и противовоспаление: субстрат синтеза GAG + анти-LOX + ↑коллаген. ↑CRP/острая травма — безусловное добавление. mfmode: коллаген 10-15 г/день с витамином C 500 мг.',
};

// ════════════════════════════════════════════════════════════════════════════
//  3. STACK BOOSTER — добавить весь стек как один блок
//  Источник: STACK_DB (25 готовых стеков)
// ════════════════════════════════════════════════════════════════════════════
export interface StackBoosterTrigger {
  stackId: string;             // ключ из STACK_DB
  indicator: string;          // показание (когда назначать)
}

export const STACK_BOOSTER_TRIGGERS: StackBoosterTrigger[] = [
  { stackId: 'hepatoprotection_stack',        indicator: 'АЛТ/АСТ ↑↑, 17α-алкилы, гепатотоксичные препараты' },
  { stackId: 'cardioprotection_stack',        indicator: 'АД>140/90, LDL>3.5, ↑гемоглобин, риск ССС' },
  { stackId: 'nephroprotection_stack',       indicator: 'Креатинин ↑, цистатин-C ↑, UACR>30' },
  { stackId: 'neuroprotection_stack',         indicator: 'Тревога, ↓сна, адаптогенный дефицит, ↑кортизол' },
  { stackId: 'fibrinolytic_stack',           indicator: 'D-димер ↑, фибриноген ↑, ↑вязкость (HCT>50)' },
  { stackId: 'hormonal_pct_stack',            indicator: 'ПКТ - тамоксифен + hCG (после курса)' },
  { stackId: 'glycemic_control_stack',        indicator: 'Глюкоза >5.6, HOMA-IR>2.7, инсулинорезистентность' },
  { stackId: 'adaptogenic_stack',            indicator: '↑стресс, ↓сна, утомляемость, спорт high-intensity' },
  { stackId: 'articular_stack',               indicator: 'Боли в суставах, ↓эластичности хряща, ↑CRP' },
  { stackId: 'immune_stack',                  indicator: '↑простудные заболевания, ↑CRP, ↓иммунитет' },
  { stackId: 'mitochondrial_stack',           indicator: 'Утомляемость, митохондрии, карнитин дефицит' },
  { stackId: 'nootropic_stack',               indicator: 'Когнитивный дефицит, память, фокус' },
  { stackId: 'anti_stress_stack',             indicator: 'Хронический стресс, выгорание, адаптация' },
  { stackId: 'bone_stack',                    indicator: 'Плотность костей ↓, ↓25-OH-D, ↓К2' },
  { stackId: 'gi_microbiome_stack',          indicator: 'Дисбиоз, ЖКТ, диарея/запор, после АБ' },
  { stackId: 'antioxidant_network_stack',    indicator: '↑MDA, оксидативный стресс, антиоксидантный дефицит' },
  { stackId: 'sleep_stack',                   indicator: 'Сон <6ч, ↓качество, ↓мелатонин, раннее пробуждение' },
  { stackId: 'thyroid_stack',                 indicator: 'ТТГ>4, ↓Т3/Т4, аутоиммунные маркёры' },
  { stackId: 'endothelial_no_stack',         indicator: 'Эндотелиальная дисфункция, ↓NO, сосудистый тонус' },
  { stackId: 'anti_inflammatory_stack',      indicator: 'CRP↑↑, интерлейкины ↑, аутоиммунная активность' },
  { stackId: 'skin_collagen_stack',          indicator: 'Кожа, волосы, ногти, ↓коллаген, ↑меланин' },
  { stackId: 'detox_stack',                   indicator: 'Афлатоксины, гепатоксины, ААС пероральные' },
  { stackId: 'post_cycle_recovery_stack',    indicator: 'ПКТ полный (после курса ААС)' },
  { stackId: 'liver_emergency_stack',         indicator: 'АЛТ/АСТ severe >3× ULN, гепатотоксический криз' },
  { stackId: 'libido_erectile_stack',        indicator: '↓либидо, ↓эрекция, ↓T, ↓NO' },
  { stackId: 'sleep_recovery_stack',         indicator: 'Сон<6ч + утомление, восстановление после тренир.' },
  { stackId: 'mega_total_support_35',         indicator: 'Мега-стек при high-risk (>4 активированных систем)' },
  { stackId: 'total_health_optimization_stack',indicator:'Тотальная оптимизация (long-term, без показаний)' },
];

// Получить стек-бустер по id
export function getStackBooster(stackId: string): BoosterDef | null {
  const entry = STACK_DB[stackId];
  if (!entry) return null;
  // Извлечь ТЗ-mechIds из coverage
  const mechs = new Set<TzMechId>();
  for (const sub of Object.values(entry.coverage)) {
    for (const t of sub.targets) mechs.add(t as TzMechId);
  }
  const organs = new Set<TzOrganId>();
  for (const oc of entry.organCoverage) organs.add(oc as TzOrganId);
  return {
    key: 'stack',
    label: `📦 ${entry.name}`,
    description: `Стек: ${substanceId_join(entry.substances)}`,
    trigger: STACK_BOOSTER_TRIGGERS.find(t => t.stackId === stackId)?.indicator || 'По клиническим показаниям',
    subs: entry.substances.map((sid, i) => {
      const c = entry.coverage[Object.keys(entry.coverage)[i]];
      return {
        substanceId: sid,
        reason: c?.q ? `${c.name} — ${c.targets.join('/')} k=${c.k.toFixed(2)} (${c.q})` : sid,
        category: 'other',
      };
    }),
    mechs: Array.from(mechs),
    organs: Array.from(organs),
    rationale: `Готовый стек «${entry.name}». Состав подобран для ${entry.organCoverage.join('/')}. Сила стека (макс k): ${maxK_stack(entry)}.`,
  };
}

function substanceId_join(ids: string[]): string {
  return ids.slice(0,8).join(', ') + (ids.length > 8 ? `, ... (${ids.length})` : '');
}
function maxK_stack(entry: any): string {
  const ks = Object.values(entry.coverage).map((c:any) => c.k as number);
  if (!ks.length) return '0';
  return Math.max(...ks).toFixed(2);
}

// ════════════════════════════════════════════════════════════════════════════
//  КОНТЕКСТ для активации бустеров
// ════════════════════════════════════════════════════════════════════════════
export interface BoosterTriggerCtx {
  // neuro
  anxietyScore?: number;          // 0-10
  sleepHours?: number;             // час/ночь
  cortisolHigh?: boolean;
  stressScore?: number;            // 0-10
  irritability?: boolean;
  // joints
  jointPainScore?: number;        // 0-10
  acuteInjuryWeeks?: number;      // 0-4 нед
  crpLevel?: number;               // мг/л
  // stack — активированные стеки (id из STACK_DB)
  triggeredStackIds?: string[];
}

export interface AppliedBooster {
  key: BoosterKey;
  label: string;
  subs: BoosterSubstance[];
  mechs: TzMechId[];
  organs: TzOrganId[];
  rationale: string;
  triggered: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
//  Оценка триггеров
// ════════════════════════════════════════════════════════════════════════════
export function shouldActivateNeuro(ctx: BoosterTriggerCtx): boolean {
  if (ctx.anxietyScore != null && ctx.anxietyScore > 6) return true;
  if (ctx.sleepHours != null && ctx.sleepHours < 6) return true;
  if (ctx.cortisolHigh) return true;
  if (ctx.stressScore != null && ctx.stressScore > 7) return true;
  if (ctx.irritability) return true;
  return false;
}

export function shouldActivateJoints(ctx: BoosterTriggerCtx): boolean {
  if (ctx.jointPainScore != null && ctx.jointPainScore > 4) return true;
  if (ctx.acuteInjuryWeeks != null && ctx.acuteInjuryWeeks < 4) return true;
  if (ctx.crpLevel != null && ctx.crpLevel > 3) return true;
  return false;
}

export function getTriggeredStacks(ctx: BoosterTriggerCtx): string[] {
  return ctx.triggeredStackIds || [];
}

// ════════════════════════════════════════════════════════════════════════════
//  applyBoosters — применить бустеры поверх уже сформированного плана
//  subsAlreadyInPlan — существующие вещества, исключить дубли
// ════════════════════════════════════════════════════════════════════════════
export function applyBoosters(
  planSubs: string[],
  ctx: BoosterTriggerCtx,
  subsAlreadyInPlan: string[] = []
): AppliedBooster[] {
  const existing = new Set([...planSubs, ...subsAlreadyInPlan].map(s => s.toLowerCase()));
  const result: AppliedBooster[] = [];

  // NEURO
  if (shouldActivateNeuro(ctx)) {
    const subs = NEURO_BOOST.subs.filter(s => !existing.has(s.substanceId.toLowerCase()));
    if (subs.length) {
      result.push({
        key: 'neuro', label: NEURO_BOOST.label, subs,
        mechs: NEURO_BOOST.mechs, organs: NEURO_BOOST.organs,
        rationale: NEURO_BOOST.rationale, triggered: true,
      });
      subs.forEach(s => existing.add(s.substanceId.toLowerCase()));
    }
  }

  // JOINTS
  if (shouldActivateJoints(ctx)) {
    const subs = JOINTS_BOOST.subs.filter(s => !existing.has(s.substanceId.toLowerCase()));
    if (subs.length) {
      result.push({
        key: 'joints', label: JOINTS_BOOST.label, subs,
        mechs: JOINTS_BOOST.mechs, organs: JOINTS_BOOST.organs,
        rationale: JOINTS_BOOST.rationale, triggered: true,
      });
      subs.forEach(s => existing.add(s.substanceId.toLowerCase()));
    }
  }

  // STACK (один или несколько готовых стеков)
  for (const stackId of getTriggeredStacks(ctx)) {
    const booster = getStackBooster(stackId);
    if (!booster) continue;
    const subs = booster.subs.filter(s => !existing.has(s.substanceId.toLowerCase()));
    if (subs.length) {
      result.push({
        key: 'stack', label: booster.label, subs,
        mechs: booster.mechs, organs: booster.organs,
        rationale: booster.rationale, triggered: true,
      });
      subs.forEach(s => existing.add(s.substanceId.toLowerCase()));
    }
  }

  return result;
}

// Сводный список всех веществ из активированных бустеров
export function getBoosterSubs(applied: AppliedBooster[]): string[] {
  const out: string[] = [];
  for (const ab of applied) for (const s of ab.subs) out.push(s.substanceId);
  return out;
}

// Дополнительные покрытые ТЗ-механизмы (агрегированно)
export function getBoosterMechs(applied: AppliedBooster[]): TzMechId[] {
  const set = new Set<TzMechId>();
  for (const ab of applied) for (const m of ab.mechs) set.add(m);
  return Array.from(set);
}

// Описание бустеров для UI (опционально)
export function describeBooster(b: BoosterDef): string {
  return `${b.label}: ${b.subs.length} веществ → мехи [${b.mechs.join(', ')}]. Триггер: ${b.trigger}`;
}

// Все определения бустеров
export function getAllBoosters(): BoosterDef[] {
  return [NEURO_BOOST, JOINTS_BOOST];
}

// PEER-EFFECT: индикация, если бустер доступен (для пресета manual)
export function isBoosterAvailable(phaseKey: string): boolean {
  // фертильность — строгая фаза, бустеры ограничены
  return phaseKey !== 'fertility';
}