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
import { ALL_STACKS } from '../data/support-stacks';
import { SYNERGY_PAIRS } from '../data/lab-synergy-engine';
import { SUPPORT_CATALOG_DATA } from '../data/support-catalog-data';

// ── Автоподбор стеков под недокрытые механизмы ТЗ (режим «Усиление») ──
// Остаточный риск по органу → выделенный стек той же системы:
//   печень (liv*)   → hepatoprotection_stack
//   почки  (ren*)   → nephroprotection_stack
//   ССС    (cv*)    → cardioprotection_stack
//   ЦНС    (cns*)   → neuroprotection_stack
//   репрод (rep*)   → hormonal_pct_stack
//   гемато hem1*    → fibrinolytic_stack (вязкость/эритроцитоз)
//   гемато hem2-5*  → glycemic_control_stack (метаб/электролиты)

export interface GapFillMech {
  organId: TzOrganId;
  organLabel: string;
  mechId: TzMechId;
  mechLabel: string;
  suggestions: string[];
}

export interface GapFillSuggestion {
  stackId: string;
  stackName: string;
  mechLabels: string[];   // какие остаточные механизмы закрывает
  organLabels: string[];  // по каким системам органов
}

function stackForMech(mechId: TzMechId): string | null {
  if (mechId.startsWith('liv')) return 'hepatoprotection_stack';
  if (mechId.startsWith('ren')) return 'nephroprotection_stack';
  if (mechId.startsWith('cv')) return 'cardioprotection_stack';
  if (mechId.startsWith('cns')) return 'neuroprotection_stack';
  if (mechId.startsWith('rep')) return 'hormonal_pct_stack';
  if (mechId.startsWith('hem1')) return 'fibrinolytic_stack';
  if (mechId.startsWith('hem')) return 'glycemic_control_stack';
  return null;
}

export function buildGapFillSuggestions(gaps: GapFillMech[] = []): GapFillSuggestion[] {
  if (!gaps || !gaps.length) return [];
  const byStack = new Map<string, GapFillSuggestion>();
  for (const g of gaps) {
    const stackId = stackForMech(g.mechId);
    if (!stackId) continue;
    const stack = (ALL_STACKS as any[]).find(s => s.id === stackId)
      || (STACK_DB[stackId] ? { id: stackId, name: STACK_DB[stackId].name } : null);
    if (!stack) continue;
    const name = (stack as any).name || stackId;
    if (!byStack.has(stackId)) {
      byStack.set(stackId, { stackId, stackName: name, mechLabels: [], organLabels: [] });
    }
    const entry = byStack.get(stackId)!;
    if (!entry.mechLabels.includes(g.mechLabel)) entry.mechLabels.push(g.mechLabel);
    if (!entry.organLabels.includes(g.organLabel)) entry.organLabels.push(g.organLabel);
  }
  return Array.from(byStack.values());
}

export type BoosterKey = 'neuro' | 'joints' | 'hemato' | 'stack';

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
  subs: BoosterSubstance[];    // LV1 (база — всегда при активации)
  mechs: TzMechId[];            // покрываемые ТЗ-механизмы
  organs: TzOrganId[];
  rationale: string;
  // ── Tier-based selection (Фаза 1) ──
  subsLv2?: BoosterSubstance[];                    // LV2 (средний — при tier≥2)
  subsLv3?: BoosterSubstance[];                    // LV3 (тяжёлый — при tier≥3, всегда)
  subsLv3Alternates?: {                            // LV3 (тяжёлый — при tier≥3, выбрать ОДИН из группы)
    group: string;
    options: BoosterSubstance[];
  }[];
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
  trigger: 'Тревога >6/10, сон <6ч, ↑кортизол, стресс >7/10, раздражительность. PED: тренболон/19-нор → авто.',
  // ── LV1 (база) — статья: agmatine ★, NAC ★, таурин ★ + существующие 9 ──
  subs: [
    { substanceId: 'magnesium',         reason: 'Mg-зависимая нейротрансмиссия, блок NMDA, ↑ГAМК', category: 'mineral' },
    { substanceId: 'ashwagandha',       reason: '↓кортизола 20-30% (мета), адаптоген, ↑ГAМК-ергический тонус', category: 'adaptogen' },
    { substanceId: 'theanine',          reason: 'α-волны, релаксация без седации, ↑ГAМК/дофамина', category: 'amino' },
    { substanceId: 'glycine',           reason: 'Тормозной нейротрансмиттер, ↓core body temp → сон', category: 'amino' },
    { substanceId: 'rhodiola',          reason: 'Адаптоген, ↓утомления, ↑серотонина/дофамина', category: 'adaptogen' },
    { substanceId: 'acetyl_l_carnitine',reason: 'Митохондриальная защита нейронов, ↑ацетилхолина', category: 'amino' },
    { substanceId: 'vitamin_b6',        reason: 'Кофактор синтеза серотонина/дофамина/ГAМК', category: 'vitamin' },
    { substanceId: 'apigenin',          reason: 'ГAМК-модулятор, ↓тревоги (микродозинг)', category: 'other' },
    { substanceId: 'magnolia',          reason: 'Анксиолитик (ханиол/магнолол), ГAМК-ергический', category: 'other' },
    // ── Добавлено по статье «Нейротоксичность ААС» ──
    { substanceId: 'agmatine',          reason: '★ must have на курсе: неконкурентный антагонист NMDA, ↓глутаматергической активности', category: 'amino' },
    { substanceId: 'magnesium_l_threonate', reason: 'Mg через ГЭБ, ↑синаптическая пластичность, блок NMDA', category: 'mineral' },
    { substanceId: 'gaba',              reason: 'Тормозной нейромедиатор, ↓возбудимость ЦНС (статья: влияет на флору кишечника → ЦНС)', category: 'amino' },
    { substanceId: 'tryptophan',        reason: 'Предшественник серотонина → мелатонин (статья: ААС ↓серотонин)', category: 'amino' },
    { substanceId: 'nac',               reason: '★ Снижает глутаматергическую активность через mGluR2/3 (статья: АЦЦ при ОКР)', category: 'antioxidant' },
    { substanceId: 'taurine',           reason: '★ Стабилизирует митохондрии, ↓кальциевая токсичность (статья)', category: 'amino' },
    { substanceId: 'alpha_lipoic',      reason: '★ Проникает в ЦНС, ↓оксидативный стресс нейронов (статья)', category: 'antioxidant' },
  ],
  // ── LV2 (средний) — нейростероиды, BDNF, серотонин ──
  subsLv2: [
    { substanceId: 'pregnenolone',      reason: 'Тормозный нейростероид (статья: закрывает прегненолоновую дырку на ААС)', category: 'hormonal' },
    { substanceId: 'inositol',          reason: '↑чувствительность серотониновых рецепторов (статья: ОКР/БДР)', category: 'other' },
    { substanceId: 'citicoline',        reason: 'Донатор холина для ACh, ↑фосфатидилхолин мембран', category: 'other' },
    { substanceId: 'lions_mane',        reason: '↑NGF через ERK1/2 (статья: нейротрофины, BDNF)', category: 'other' },
    { substanceId: 'phosphatidylserine',reason: 'Связывает кортизол, ↓GR-активацию в гиппокампе', category: 'other' },
    { substanceId: 'bacopa',            reason: '↑ацетилхолин, ↑дендритное ветвление, антиоксидант', category: 'adaptogen' },
    { substanceId: 'astaxanthin',       reason: 'Встраивается в мембрану, блокирует окисление жиров (статья: митохондрии/ДНК)', category: 'antioxidant' },
    { substanceId: 'grandaxine',        reason: 'ФДЭ-4 ингибитор, ↑ГАМК без толерантности (статья: LV2)', category: 'pharma' },
  ],
  // ── LV3 (тяжёлый) — NMDA-антагонизм, нормотимики, TrkB-агонисты ──
  // Статья: «самая мощная нейропротекция — адекватная доза и длительность»
  // LV3 — селективные пары (не стекать 2 NMDA-антагониста)
  subsLv3: [
    { substanceId: 'fasoracetam',       reason: '↑ГAМК-Б рецепторы (статья: контроль импульсов в префронтальной коре)', category: 'other' },
    { substanceId: 'bromantane',        reason: '↑тирозин-гидроксилаза → дофамин, ↓ГAМК-транспортёр (статья: 19-нор)', category: 'other' },
    { substanceId: 'noopept',           reason: '↑NGF, ↑BDNF, ↑AMPA (статья: нейрогенез)', category: 'other' },
    { substanceId: 'dihexa',            reason: 'c-met/HGF агонист, синаптогенез 10× сильнее BDNF (статья: LV3)', category: 'pharma' },
    { substanceId: 'tropoflavin',       reason: 'TrkB-агонист, ↑выживаемости нейронов (статья: LV3)', category: 'other' },
    { substanceId: 'phenylpiracetam',   reason: '↑дофамин/норадреналин, ↑мотивация (статья: LV3)', category: 'other' },
  ],
  subsLv3Alternates: [
    {
      group: 'NMDA-антагонизм / нормотимик (выбрать ОДИН — не стекать)',
      options: [
        { substanceId: 'memantine',    reason: 'Неконкурентный антагонист NMDA, ↓эксайтотоксичность (статья: LV4)', category: 'pharma' },
        { substanceId: 'lamotrigine',  reason: 'Негативный модулятор Na-каналов, нормотимик (статья: LV4)', category: 'pharma' },
        { substanceId: 'amantadine',   reason: 'NMDA-антагонист (слабее мемантина), ↑дофамин, ↑BDNF (статья: LV4)', category: 'pharma' },
      ],
    },
    {
      group: 'Противотревожный / иммуномодулятор (опционально, выбрать ОДИН)',
      options: [
        { substanceId: 'fluvoxamine',  reason: 'СИОЗС + сигма-1 агонист, нейропротекция (статья: LV3)', category: 'pharma' },
        { substanceId: 'naltrexone',   reason: 'LDN — ↑эндорфины, ↓TLR4-нейровоспаление (статья: LV4)', category: 'pharma' },
      ],
    },
    {
      group: 'α2-адренорецептор (опционально, для импульсивности/сна)',
      options: [
        { substanceId: 'guanfacine',   reason: 'α2 (постсинаптический), ↓импульсивности (статья: LV4)', category: 'pharma' },
        { substanceId: 'tizanidine',   reason: 'α2 (пресинаптический), ↓норадреналин, индукция сна (статья: LV4)', category: 'pharma' },
      ],
    },
  ],
  mechs: ['cns1', 'cns2', 'cns3', 'cns4'],
  organs: ['cns'],
  rationale: 'Комплексная нейропротекция по статье «Нейротоксичность ААС»: LV1 (agmatine★+NAC★+таурин★+Mg+ГAМК-аминокислоты) → LV2 (нейростероиды+BDNF) → LV3 (NMDA-антагонизм, селективные пары: memantine ИЛИ lamotrigine). 4 механизма ТЗ: нейромедиаторная, оксидативный стресс, апоптоз, нейроэндокринная.',
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
  trigger: 'Боли в суставах >4/10, острая травма <4 нед, ↑CRP>3, осевые нагрузки. PED: станозолол → авто.',
  // ── LV1 (база) — хондропротекция, анти-воспаление ──
  subs: [
    { substanceId: 'collagen',     reason: 'Коллаген II типа — основной белок гиалинового хряща', category: 'amino' },
    { substanceId: 'glucosamine', reason: 'Субстрат GAG, ↑протеогликанов хряща', category: 'amino' },
    { substanceId: 'chondroitin', reason: '↑GAG, ↓MMP-13 (катаболизм хряща)', category: 'amino' },
    { substanceId: 'boswellia',   reason: 'Босвеллиевая кислота, ↓5-LOX → ↓лейкотриенов, ↓MMP', category: 'antiinflam' },
    { substanceId: 'msm',         reason: 'Органическая сера, ↓воспаления, ↓боли (мета)', category: 'other' },
    { substanceId: 'curcumin',    reason: '↓COX-2, ↓NF-κB, ↓MMP — тройной противовоспалительный эффект', category: 'antiinflam' },
    { substanceId: 'hyaluronic_acid', reason: 'Компонент синовиальной жидкости, ↓трения', category: 'other' },
    { substanceId: 'vitamin_c',   reason: 'Кофактор гидроксилирования пролина → синтез коллагена', category: 'vitamin' },
    { substanceId: 'omega3',      reason: 'Резолвины/протектины, ↓воспаления в синовии', category: 'other' },
  ],
  // ── LV2 (средний) — усиление синтеза коллагена, минерализация ──
  subsLv2: [
    { substanceId: 'collagen_uc2', reason: 'Коллаген UC-II — оральная толерантность, ↓атаку на коллаген сустава', category: 'amino' },
    { substanceId: 'silicon',      reason: 'Сшивка коллагена и эластина, стабилизация ГАГ', category: 'mineral' },
    { substanceId: 'manganese',    reason: 'Кофактор гликозилтрансфераз → синтез ГАГ', category: 'mineral' },
    { substanceId: 'vitamin_d3',   reason: 'VDR-активация, Ca²⁺ гомеостаз, минерализация кости', category: 'vitamin' },
    { substanceId: 'vitamin_k2',   reason: 'Активация остеокальцина → Ca²⁺ в кости', category: 'vitamin' },
    { substanceId: 'calcium',      reason: 'Минерализация костной ткани', category: 'mineral' },
    { substanceId: 'boron',        reason: '↑ t½ вит. D и E₂, ↓боль в суставах', category: 'mineral' },
    { substanceId: 'havinson_a4',  reason: 'Пептидный биорегулятор хряща, ↑хондроцитов (Суставы.txt)', category: 'pharma' },
    { substanceId: 'ligamentide',  reason: 'Пептид для связок/сухожилий, ↑регенерации (Суставы.txt: 6-нед курс)', category: 'pharma' },
    { substanceId: 'voltaren_gel', reason: 'Диклофенак местно, ↓COX-2 локально (Суставы.txt: 2-3р/день)', category: 'pharma' },
  ],
  // ── LV3 (пептиды) — 6-недельный протокол восстановления (Суставы.txt) ──
  // Протокол щелчка локтя: BPC-157 + TB-500 + GHK-Cu
  subsLv3: [
    { substanceId: 'bpc157',  reason: 'Пептид регенерации (ангио+фибробласт), ↓воспаления (Суставы.txt: 250-400 мкг/день)', category: 'pharma' },
    { substanceId: 'tb500',   reason: 'Thymosin β4 — полимеризация G-актина, ↑миграцию клеток (Суставы.txt: 2.5-10 мг/нед)', category: 'pharma' },
    { substanceId: 'ghk_cu',  reason: 'GHK-Cu — медь-пептид, ↑коллаген/эластин, анти-воспаление (Суставы.txt: 1-2 мг)', category: 'pharma' },
  ],
  mechs: ['cns2','cv1','hem2'],   // ─ Mesenchymal mech не входит в ТЗ-28 → бустер работает через антиокиданты/витамины; формально соответствует ТЗ через перекрёстные мехи
  organs: ['cns','cardio','hematologic'], // снимает опосредованно: анти-воспалительный,vascular (эндотелий), метаболический синдром (chondroprotection: mTOR)
  rationale: 'Регенерация хряща и противовоспаление по Суставы.txt: LV1 (хондропротекторы+анти-воспаление) → LV2 (синтез коллагена+минерализация) → LV3 (пептиды: BPC-157+TB-500+GHK-Cu — 6-недельный протокол). ↑CRP/острая травма/станозолол — безусловное добавление.',
};

// ════════════════════════════════════════════════════════════════════════════
//  3. HEMATO BOOSTER — эритроцитоз на курсе ААС (HIF-1α → Hct↑ → тромбоз)
//  Триггер: AAS в стеке (болденон/тест/оксиметолон/нандролон/трен), Hct>48%, HGB>175
//
//  Эритроцитоз → гипервязкость → тромбоз. Это ОДИН каскад риска.
//  Снижение идёт по 3 направлениям:
//    1. ↓RBC масса: эритроцитаферез (первая линия при Hct>52%), флеботомия (fallback)
//    2. ↑Плазма (разведение): гидратация 40+ мл/кг, телмисартан (↑PV + ↓EPO)
//    3. ↓Тромбоз-риск (основная опасность эритроцитоза):
//       фибринолитики (натто/сера/бромелайн), антиагреганты (аспирин, омега, чеснок),
//       реология (пентоксифиллин, цитруллин)
// ════════════════════════════════════════════════════════════════════════════
export const HEMATO_BOOST: BoosterDef = {
  key: 'hemato',
  label: '🩸 Гемато-бустер',
  description: 'Эритроцитоз на курсе ААС: ↓Hct + ↓тромбоз-риск + ↑плазма.',
  trigger: 'AAS в стеке (болденон/тест/оксиметолон/нандролон/трен), Hct>48%, HGB>175.',
  // ── LV1 (профилактика, Hct<48%) — ↑плазма + ↓тромбоз ──
  // Гидратация 40-45 мл/кг → ↑PV на 5-10% → Hct -3-5% (Fellmann 1992)
  // Кардио 30-45 мин 5×/нед → PV+5-20% за 4-6 нед (Convertino 1980)
  // Электролиты Na/K/Mg — удержание воды в сосудистом русле (без них вода уходит в ткани)
  // Натто+сера+бромелайн = 3 pathway фибринолиза (↓тромбоз — конец каскада эритроцитоза)
  // Телмисартан — ARB: ↑PV + ↓EPO (Vlahakos 2003)
  subs: [
    { substanceId: 'hydration',        reason: '★ 40-45 мл/кг/день → ↑PV на 5-10% → Hct -3-5% (Fellmann 1992). Без электролитов вода уходит в ткани', category: 'lifestyle' },
    { substanceId: 'cardio_aerobic',   reason: '★ 30-45 мин 5×/нед → PV+5-20% за 4-6 нед (Convertino 1980). «Спортивная псевдоанемия»', category: 'lifestyle' },
    { substanceId: 'electrolyte_balance', reason: '★ Na 3-5 г + K 3.5-4.7 г + Mg 400 мг — удержание воды в сосудистом русле. Без них гидратация неэффективна', category: 'mineral' },
    { substanceId: 'nattokinase',      reason: '★ Фибринолитик: плазминоген→плазмин, ↓PAI-1. ↓тромбоз-риск (конец каскада эритроцитоза)', category: 'enzyme' },
    { substanceId: 'serrapeptase',     reason: '★ ↓α2-макроглобулин, ↓фибрин, ↓вязкости на фоне эритроцитоза', category: 'enzyme' },
    { substanceId: 'bromelain',        reason: '★ ↓PAI-1, ↓COX-2/TXA2 (антиагрегант). ↓тромбоз при ↑Hct', category: 'enzyme' },
    { substanceId: 'telmisartan',      reason: '★ ARB: ↑PV + ↓EPO (Vlahakos 2003). Двойной эффект — ↓Hct через разведение + ↓стимул эритропоэза', category: 'pharma' },
  ],
  // ── LV2 (ранняя коррекция, Hct 48-52%) — +антиагрегант + реология + ↑плазма ──
  subsLv2: [
    { substanceId: 'omega3',        reason: '↓агрегации (cv4), ↓вязкости (hem1), ↓фибриногена. Кардио+гемато защита', category: 'omega' },
    { substanceId: 'garlic',        reason: 'Аллицин — ↓агрегации, ↓фибриногена (Bordia 1998)', category: 'cardioprotector' },
    { substanceId: 'citrulline',    reason: 'NO-донор → ↑деформируемость RBC, ↓вязкости, ↑микроциркуляция', category: 'amino' },
    { substanceId: 'nac',           reason: '↑GSH в эритроцитах → ↑текучесть мембраны RBC', category: 'antioxidant' },
    { substanceId: 'aspirin',       reason: 'COX-1 ингибитор → ↓TXA2. Антиагрегант при эритроцитозе. Только ≥2 фактора тромбориска + ИПП', category: 'pharma' },
  ],
  // ── LV3 (терапия, Hct 52-54%) — +усиленный фибринолиз + рецептурные ──
  subsLv3: [
    { substanceId: 'lumbrokinase',  reason: 'Сильнейший прямой активатор плазминогена, ↓фибриноген. Усиленный фибринолиз', category: 'enzyme' },
    { substanceId: 'pentoxifylline',reason: 'Реологический: ↓вязкости, ↑деформируемость RBC, ↓TNF-α. При Hct 48-52%', category: 'pharma' },
    { substanceId: 'dipyridamole',  reason: 'Антиагрегант (PDE-ингиб → ↑cAMP), вазодилататор, ↑микроциркуляция', category: 'pharma' },
    { substanceId: 'pycnogenol',    reason: 'Эндотелий (NO), антиагрегант, ↓АД — защита сосудов при эритроцитозе', category: 'antioxidant' },
    { substanceId: 'ginkgo',       reason: 'PAF-антагонист (антиагрегант), микроциркуляция мозга (защита от TIA)', category: 'nootropic' },
  ],
  mechs: ['cv4', 'hem1'],
  organs: ['hematologic', 'cardio'],
  rationale: 'Эритроцитоз на курсе ААС (HIF-1α → Hct↑ → гипервязкость → тромбоз) — ОДИН каскад риска. LV1: ↑плазма (гидратация 40-45 мл/кг + электролиты Na/K/Mg для удержания воды в сосудах + кардио 30-45 мин 5×/нед → PV+5-20%) + ↓тромбоз (натто+сера+бромелайн = 3 pathway фибринолиза) + телмисартан (↑PV+↓EPO). LV2: +омега/чеснок/цитруллин/NAC/аспирин. LV3: +лумброкиназа/пентоксифиллин/дипиридамол/пикногенол/гинкго. Hct>52% → эритроцитаферез (первая линия), флеботомия fallback. 2 меха ТЗ: эритроцитоз (hem1) + протромботический (cv4).',
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
  // 1. Legacy TZ-bridе stacks (25)
  const entry = STACK_DB[stackId];
  if (entry && entry.substances && entry.substances.length) {
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
  // 2. Fallback: newer B-format stacks (ALL_STACKS, full 55) — resolve by id
  const st = (ALL_STACKS || []).find(s => s.id === stackId);
  if (st && st.substances && st.substances.length) {
    const mechs = new Set<TzMechId>();
    for (const m of (st.anatomicalMapping?.mechanismCodes || [])) mechs.add(m as TzMechId);
    const organs = new Set<TzOrganId>();
    for (const o of (st.anatomicalMapping?.organSystems || [])) organs.add(o as TzOrganId);
    return {
      key: 'stack',
      label: `📦 ${st.name}`,
      description: `Стек: ${substanceId_join(st.substances.map((s:any) => s.id))}`,
      trigger: STACK_BOOSTER_TRIGGERS.find(t => t.stackId === stackId)?.indicator || 'Готовый стек',
      subs: st.substances.map((s:any) => ({
        substanceId: s.id,
        reason: `${s.dose || ''} ${s.timing || ''}`.trim() || s.id,
        category: 'other',
      })),
      mechs: Array.from(mechs),
      organs: Array.from(organs),
      rationale: `Готовый стек «${st.name}». Покрытие механизмов ТЗ: ${(st.anatomicalMapping?.mechanismCodes || []).length}.`,
    };
  }
  return null;
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
  // hemato
  hematocrit?: number;             // %
  hemoglobin?: number;             // г/л
  plt?: number;                    // тромбоциты 10⁹/L
  fibrinogen?: number;             // г/л
  dDimer?: number;                 // мг/L
  // stack — активированные стеки (id из STACK_DB)
  triggeredStackIds?: string[];
  // ── Tier-based triggering (Фаза 1: PED-risk + symptom + force) ──
  symptomNeuro?: boolean;          // insomnia/anxiety/mood_swings из pill-кнопок
  symptomJoints?: boolean;         // joint_pain из pill-кнопки
  symptomHemato?: boolean;         // гипервязкость: головная боль, плетора, тиннитус
  forceNeuro?: boolean;            // принудительно на level='max'
  forceJoints?: boolean;           // принудительно на level='max'
  forceHemato?: boolean;           // принудительно на level='max'
  pedNeuroTier?: 0 | 1 | 2 | 3;   // tier из assessPedRisk (приоритет над level)
  pedJointsTier?: 0 | 1 | 2 | 3;  // tier из assessPedRisk
  pedHematoTier?: 0 | 1 | 2 | 3;  // tier из assessPedRisk
  pedRiskReasons?: string[];       // причины для UI-баннера
}

export interface AppliedBooster {
  key: BoosterKey;
  label: string;
  subs: BoosterSubstance[];
  mechs: TzMechId[];
  organs: TzOrganId[];
  rationale: string;
  triggered: boolean;
  tier?: 0 | 1 | 2 | 3;   // активированный tier
  reasons?: string[];      // причины активации (для UI)
}

// ════════════════════════════════════════════════════════════════════════════
//  Оценка триггеров
// ════════════════════════════════════════════════════════════════════════════
export function shouldActivateNeuro(ctx: BoosterTriggerCtx): boolean {
  // PED-risk tier (приоритет — даже на «База» активирует бустер)
  if ((ctx.pedNeuroTier ?? 0) > 0) return true;
  // Принудительно на «Максимум»
  if (ctx.forceNeuro) return true;
  // Симптом-кнопки (insomnia/anxiety/mood_swings)
  if (ctx.symptomNeuro) return true;
  // Детальные state-оценки (существующая логика)
  if (ctx.anxietyScore != null && ctx.anxietyScore > 6) return true;
  if (ctx.sleepHours != null && ctx.sleepHours < 6) return true;
  if (ctx.cortisolHigh) return true;
  if (ctx.stressScore != null && ctx.stressScore > 7) return true;
  if (ctx.irritability) return true;
  return false;
}

export function shouldActivateJoints(ctx: BoosterTriggerCtx): boolean {
  // PED-risk tier (приоритет)
  if ((ctx.pedJointsTier ?? 0) > 0) return true;
  // Принудительно на «Максимум»
  if (ctx.forceJoints) return true;
  // Симптом-кнопка (joint_pain)
  if (ctx.symptomJoints) return true;
  // Детальные state-оценки (существующая логика)
  if (ctx.jointPainScore != null && ctx.jointPainScore > 4) return true;
  if (ctx.acuteInjuryWeeks != null && ctx.acuteInjuryWeeks < 4) return true;
  if (ctx.crpLevel != null && ctx.crpLevel > 3) return true;
  return false;
}

export function shouldActivateHemato(ctx: BoosterTriggerCtx): boolean {
  // PED-risk tier (приоритет — AAS в стеке → проактивная защита до повышения Hct)
  if ((ctx.pedHematoTier ?? 0) > 0) return true;
  // Принудительно на «Максимум»
  if (ctx.forceHemato) return true;
  // Симптом-кнопка (гипервязкость: головная боль, плетора, тиннитус)
  if (ctx.symptomHemato) return true;
  // Лабораторные показатели
  if (ctx.hematocrit != null && ctx.hematocrit > 48) return true;
  if (ctx.hemoglobin != null && ctx.hemoglobin > 175) return true;
  if (ctx.plt != null && ctx.plt > 400) return true;
  if (ctx.fibrinogen != null && ctx.fibrinogen > 4) return true;
  if (ctx.dDimer != null && ctx.dDimer > 0.5) return true;
  return false;
}

export function getTriggeredStacks(ctx: BoosterTriggerCtx): string[] {
  return ctx.triggeredStackIds || [];
}

// ────────────────────────────────────────────────────────────────────────────
//  Tier computation (Фаза 1: PED-risk + symptom + force + state-estimate)
// ────────────────────────────────────────────────────────────────────────────

function computeNeuroTier(ctx: BoosterTriggerCtx): 0 | 1 | 2 | 3 {
  const pedTier = ctx.pedNeuroTier ?? 0;
  const symptomTier = ctx.symptomNeuro ? 2 : 0;
  // state-estimate trigger → tier 2 (тревога/сон/стресс/кортизол/раздражительность)
  const stateTier = (
    (ctx.anxietyScore != null && ctx.anxietyScore > 6) ||
    (ctx.sleepHours != null && ctx.sleepHours < 6) ||
    ctx.cortisolHigh ||
    (ctx.stressScore != null && ctx.stressScore > 7) ||
    ctx.irritability
  ) ? 2 : 0;
  const forceTier = ctx.forceNeuro ? 1 : 0;
  return Math.max(pedTier, symptomTier, stateTier, forceTier) as 0 | 1 | 2 | 3;
}

function computeJointsTier(ctx: BoosterTriggerCtx): 0 | 1 | 2 | 3 {
  const pedTier = ctx.pedJointsTier ?? 0;
  const symptomTier = ctx.symptomJoints ? 2 : 0;
  // state-estimate trigger → tier 2 (боль/травма/CRP)
  const stateTier = (
    (ctx.jointPainScore != null && ctx.jointPainScore > 4) ||
    (ctx.acuteInjuryWeeks != null && ctx.acuteInjuryWeeks < 4) ||
    (ctx.crpLevel != null && ctx.crpLevel > 3)
  ) ? 2 : 0;
  const forceTier = ctx.forceJoints ? 1 : 0;
  return Math.max(pedTier, symptomTier, stateTier, forceTier) as 0 | 1 | 2 | 3;
}

function computeHematoTier(ctx: BoosterTriggerCtx): 0 | 1 | 2 | 3 {
  const pedTier = ctx.pedHematoTier ?? 0;
  const symptomTier = ctx.symptomHemato ? 2 : 0;
  // state-estimate trigger — по лабам (Hct/HGB/PLT/фибриноген/D-димер)
  let stateTier: 0 | 1 | 2 | 3 = 0;
  if (ctx.hematocrit != null) {
    if (ctx.hematocrit >= 57) stateTier = 3;       // ургентный
    else if (ctx.hematocrit >= 52) stateTier = 3;  // терапия
    else if (ctx.hematocrit >= 48) stateTier = 2;  // ранняя коррекция
  }
  if (ctx.hemoglobin != null) {
    if (ctx.hemoglobin >= 185) stateTier = Math.max(stateTier, 3) as 0 | 1 | 2 | 3;
    else if (ctx.hemoglobin >= 175) stateTier = Math.max(stateTier, 2) as 0 | 1 | 2 | 3;
  }
  if (ctx.plt != null && ctx.plt > 450) stateTier = Math.max(stateTier, 2) as 0 | 1 | 2 | 3;
  if (ctx.fibrinogen != null && ctx.fibrinogen > 4) stateTier = Math.max(stateTier, 2) as 0 | 1 | 2 | 3;
  if (ctx.dDimer != null) {
    if (ctx.dDimer > 2.5) stateTier = Math.max(stateTier, 3) as 0 | 1 | 2 | 3;
    else if (ctx.dDimer > 0.5) stateTier = Math.max(stateTier, 2) as 0 | 1 | 2 | 3;
  }
  const forceTier = ctx.forceHemato ? 1 : 0;
  return Math.max(pedTier, symptomTier, stateTier, forceTier) as 0 | 1 | 2 | 3;
}

/**
 * Select booster substances by tier.
 * tier 1 → LV1 only
 * tier 2 → LV1 + LV2
 * tier 3 → LV1 + LV2 + LV3 (incl. one from each alternate group)
 */
function selectBoosterSubsByTier(
  booster: BoosterDef,
  tier: 0 | 1 | 2 | 3,
  existing: Set<string>
): BoosterSubstance[] {
  if (tier === 0) return [];
  let selected: BoosterSubstance[] = [...booster.subs]; // LV1
  if (tier >= 2 && booster.subsLv2) selected = [...selected, ...booster.subsLv2];
  if (tier >= 3) {
    if (booster.subsLv3) selected = [...selected, ...booster.subsLv3];
    // Alternates: pick ONE from each group (memantine ИЛИ lamotrigine — не стекать)
    if (booster.subsLv3Alternates) {
      for (const group of booster.subsLv3Alternates) {
        const pick = group.options[0]; // первый вариант (по умолчанию)
        if (pick) selected.push(pick);
      }
    }
  }
  // Dedup against existing plan
  return selected.filter(s => !existing.has(s.substanceId.toLowerCase()));
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
    const tier = computeNeuroTier(ctx);
    const subs = selectBoosterSubsByTier(NEURO_BOOST, tier, existing);
    if (subs.length) {
      result.push({
        key: 'neuro', label: NEURO_BOOST.label, subs,
        mechs: NEURO_BOOST.mechs, organs: NEURO_BOOST.organs,
        rationale: NEURO_BOOST.rationale, triggered: true,
        tier,
        reasons: ctx.pedRiskReasons,
      });
      subs.forEach(s => existing.add(s.substanceId.toLowerCase()));
    }
  }

  // JOINTS
  if (shouldActivateJoints(ctx)) {
    const tier = computeJointsTier(ctx);
    const subs = selectBoosterSubsByTier(JOINTS_BOOST, tier, existing);
    if (subs.length) {
      result.push({
        key: 'joints', label: JOINTS_BOOST.label, subs,
        mechs: JOINTS_BOOST.mechs, organs: JOINTS_BOOST.organs,
        rationale: JOINTS_BOOST.rationale, triggered: true,
        tier,
        reasons: ctx.pedRiskReasons,
      });
      subs.forEach(s => existing.add(s.substanceId.toLowerCase()));
    }
  }

  // HEMATO
  if (shouldActivateHemato(ctx)) {
    const tier = computeHematoTier(ctx);
    const subs = selectBoosterSubsByTier(HEMATO_BOOST, tier, existing);
    if (subs.length) {
      result.push({
        key: 'hemato', label: HEMATO_BOOST.label, subs,
        mechs: HEMATO_BOOST.mechs, organs: HEMATO_BOOST.organs,
        rationale: HEMATO_BOOST.rationale, triggered: true,
        tier,
        reasons: ctx.pedRiskReasons,
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
        tier: 0,
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
  return [NEURO_BOOST, JOINTS_BOOST, HEMATO_BOOST];
}

// PEER-EFFECT: индикация, если бустер доступен (для пресета manual)
export function isBoosterAvailable(phaseKey: string): boolean {
  // фертильность — строгая фаза, бустеры ограничены
  return phaseKey !== 'fertility';
}

// ════════════════════════════════════════════════════════════════════════════
//  MEGA-ENHANCE — умное усиление плана поддержки
//
//  Вместо добавления целого стека (35 веществ наобум) — анализирует:
//    1. Непокрытые ТЗ-механизмы (gaps из rec.gaps)
//    2. Синергии с уже назначенными препаратами (SYNERGY_PAIRS)
//  Подбирает индивидуальные вещества, которые:
//    - покрывают максимальное число gaps (breadth)
//    - имеют синергию с текущими препаратами
//    - не дублируют уже назначенные
// ════════════════════════════════════════════════════════════════════════════

export interface MegaEnhanceSuggestion {
  substanceId: string;
  reason: string;
  mechsCovered: TzMechId[];
  synergyWith: string[];
  breadth: number;
  totalK: number;
}

export function megaEnhance(
  gaps: { mechId: TzMechId; mechLabel: string; organLabel: string; suggestions: string[] }[],
  currentSubs: string[],
): MegaEnhanceSuggestion[] {
  if (!gaps || gaps.length === 0) return [];

  const existingSet = new Set(currentSubs.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const gapMechIds = new Set(gaps.map(g => g.mechId));

  // 1. Собрать всех кандидатов из gaps (substances, покрывающие непокрытые мехи)
  const candidates = new Map<string, { mechsCovered: TzMechId[]; totalK: number; reasons: string[] }>();

  for (const g of gaps) {
    // suggestions уже содержит топ-3 вещества для этого мех-ма
    for (const sid of g.suggestions) {
      const canon = sid.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (existingSet.has(canon)) continue;
      if (!candidates.has(canon)) {
        candidates.set(canon, { mechsCovered: [], totalK: 0, reasons: [] });
      }
      const cand = candidates.get(canon)!;
      if (!cand.mechsCovered.includes(g.mechId)) {
        cand.mechsCovered.push(g.mechId);
        cand.reasons.push(`${g.organLabel}: ${g.mechLabel}`);
      }
    }
  }

  if (candidates.size === 0) return [];

  // 2. Вычислить breadth (сколько gaps покрывает) и totalK
  const scored: MegaEnhanceSuggestion[] = [];

  for (const [substanceId, cand] of candidates) {
    // Найти синергии с текущими препаратами
    const synergyWith: string[] = [];
    for (const pair of SYNERGY_PAIRS) {
      const pairPrimaryCanon = pair.primary.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pairSecondaryCanon = pair.secondary.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Если кандидат — secondary, а primary уже в плане
      if (pairSecondaryCanon === substanceId && currentSubs.some(s => s.toLowerCase().replace(/[^a-z0-9]/g, '') === pairPrimaryCanon)) {
        synergyWith.push(pair.primary);
      }
      // Если кандидат — primary, а secondary уже в плане
      if (pairPrimaryCanon === substanceId && currentSubs.some(s => s.toLowerCase().replace(/[^a-z0-9]/g, '') === pairSecondaryCanon)) {
        synergyWith.push(pair.secondary);
      }
    }

    // Также проверяем синергии из SUPPORT_CATALOG_DATA (synergies[])
    for (const curSub of currentSubs) {
      const curCanon = curSub.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Проверяем каталог на наличие явных синергий
      const catEntry = (SUPPORT_CATALOG_DATA as any)[curSub] || (SUPPORT_CATALOG_DATA as any)[curSub.toUpperCase()];
      if (catEntry && Array.isArray(catEntry.synergies)) {
        for (const syn of catEntry.synergies) {
          if (typeof syn === 'string' && syn.toLowerCase().replace(/[^a-z0-9]/g, '') === substanceId) {
            if (!synergyWith.includes(curSub)) synergyWith.push(curSub);
          }
          if (syn && typeof syn === 'object' && syn.id && syn.id.toLowerCase().replace(/[^a-z0-9]/g, '') === substanceId) {
            if (!synergyWith.includes(curSub)) synergyWith.push(curSub);
          }
        }
      }
    }

    const breadth = cand.mechsCovered.length;
    scored.push({
      substanceId,
      reason: cand.reasons.join('; '),
      mechsCovered: cand.mechsCovered,
      synergyWith,
      breadth,
      totalK: cand.totalK,
    });
  }

  // 3. Сортировка: breadth × 10 + synergyCount × 5 (широкий спектр + синергии в приоритете)
  scored.sort((a, b) =>
    (b.breadth * 10 + b.synergyWith.length * 5) -
    (a.breadth * 10 + a.synergyWith.length * 5)
  );

  // 4. Отобрать топ-20 (не больше — это усиление, а не замена плана)
  return scored.slice(0, 20);
}

// ════════════════════════════════════════════════════════════════════════════
//  Helper для UI: получить список веществ по tier (для авто-выбора в попапах)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Возвращает список ID веществ NEURO_BOOST для данного tier.
 * tier 1 → LV1, tier 2 → LV1+LV2, tier 3 → LV1+LV2+LV3+alternates
 */
export function getNeuroBoosterSubstanceIds(tier: 0 | 1 | 2 | 3): string[] {
  if (tier === 0) return [];
  const ids: string[] = NEURO_BOOST.subs.map(s => s.substanceId);
  if (tier >= 2 && NEURO_BOOST.subsLv2) {
    ids.push(...NEURO_BOOST.subsLv2.map(s => s.substanceId));
  }
  if (tier >= 3) {
    if (NEURO_BOOST.subsLv3) ids.push(...NEURO_BOOST.subsLv3.map(s => s.substanceId));
    if (NEURO_BOOST.subsLv3Alternates) {
      for (const group of NEURO_BOOST.subsLv3Alternates) {
        if (group.options[0]) ids.push(group.options[0].substanceId);
      }
    }
  }
  return Array.from(new Set(ids));
}

/**
 * Возвращает список ID веществ JOINTS_BOOST для данного tier.
 */
export function getJointsBoosterSubstanceIds(tier: 0 | 1 | 2 | 3): string[] {
  if (tier === 0) return [];
  const ids: string[] = JOINTS_BOOST.subs.map(s => s.substanceId);
  if (tier >= 2 && JOINTS_BOOST.subsLv2) {
    ids.push(...JOINTS_BOOST.subsLv2.map(s => s.substanceId));
  }
  if (tier >= 3 && JOINTS_BOOST.subsLv3) {
    ids.push(...JOINTS_BOOST.subsLv3.map(s => s.substanceId));
  }
  return Array.from(new Set(ids));
}

/**
 * Возвращает список ID веществ HEMATO_BOOST для данного tier.
 * tier 1 → LV1 (натто+сера+бромелайн), tier 2 → +LV2 (+омега/чеснок/цитруллин/NAC/аспирин),
 * tier 3 → +LV3 (+лумброкиназа/пентоксифиллин/дипиридамол/пикногенол/гинкго)
 */
export function getHematoBoosterSubstanceIds(tier: 0 | 1 | 2 | 3): string[] {
  if (tier === 0) return [];
  const ids: string[] = HEMATO_BOOST.subs.map(s => s.substanceId);
  if (tier >= 2 && HEMATO_BOOST.subsLv2) {
    ids.push(...HEMATO_BOOST.subsLv2.map(s => s.substanceId));
  }
  if (tier >= 3 && HEMATO_BOOST.subsLv3) {
    ids.push(...HEMATO_BOOST.subsLv3.map(s => s.substanceId));
  }
  return Array.from(new Set(ids));
}
