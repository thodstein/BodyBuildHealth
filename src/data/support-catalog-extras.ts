// ════════════════════════════════════════════════════════════════════
//  support-catalog-extras.ts — ПОЛНОЕ дополнение SUPPORT_CATALOG_DATA:
//  1) CATALOG_EXTRAS — 28 ручных богатых записей для ключевых препаратов;
//  2) автогенератор — для КАЖДОГО мех-вещества без каталог-записи
//     создаёт структурную запись (русское имя, описание по механизмам
//     из мех-баз, категория, органы, мониторинг). Ничего не остаётся
//     без описания.
// ════════════════════════════════════════════════════════════════════

import { SUPPLEMENTS_DB } from './support-db/supplements';
import { PHARMACY_DB } from './support-db/pharmacy-db';
import { TZ_MECH_TO_SUBS } from '../engines/tz-bridge-mechanism';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from './support-db';
import { ADMINISTRATION_RULES_DB } from './administration-rules-db';

const ADMIN_RULES_BY_ID: Record<string, { timing: string; reason: string }> = {};
for (const r of ADMINISTRATION_RULES_DB) ADMIN_RULES_BY_ID[r.substanceId] = r;

export interface CatalogExtra {
  id: string;
  name: string;
  nameRu: string;
  tier: string;
  category: string[];
  description: string;
  monitoring?: Array<{ what: string; when: string; targetRange?: string }>;
  contraindications?: string[];
  sideEffects?: string[];
  dosage?: { mg: number; timing: string };
}

export const CATALOG_EXTRAS: CatalogExtra[] = [
  {
    id: 'aspirin', name: 'Aspirin (low dose)', nameRu: 'Аспирин (кардио-доза)', tier: 'standard', category: ['pharma', 'anticoagulant'],
    description: 'Ацетилсалициловая кислота 100 мг/сут: необратимая инактивация COX-1 → ↓ тромбоксана A2 и агрегации тромбоцитов. Профилактика тромбозов при эритроцитозе/гемоконцентрации на курсе. Повышает риск кровотечения — особенно с фибринолитиками и омега-3.',
    monitoring: [{ what: 'агрегация тромбоцитов, МНО/АЧТВ', when: 'каждые 4 нед', targetRange: 'без кровоточивости' }],
    contraindications: ['язвенная болезнь', 'коагулопатии', 'АСК-астма'],
    sideEffects: ['ЖКТ-раздражение', 'кровоточивость'],
    dosage: { mg: 100, timing: 'утром с едой' },
  },
  {
    id: 'anastrozole', name: 'Anastrozole', nameRu: 'Анастрозол', tier: 'specialty', category: ['pharma', 'hormonal'],
    description: 'Ингибитор ароматазы III поколения: блокирует конверсию тестостерона в эстрадиол. Применяется при E2 >60 пг/мл или симптомах эстрогенизации. Старт 0.5 мг 2×/нед, титрация по E2 (цель 20-40 пг/мл).',
    monitoring: [{ what: 'E2 (чувствительный), липиды', when: 'каждые 4 нед', targetRange: 'E2 20-40 пг/мл' }],
    contraindications: ['беременность'],
    sideEffects: ['↓E2 → сухость суставов', 'LDL ↑', 'головная боль'],
    dosage: { mg: 1, timing: 'стабильное время' },
  },
  {
    id: 'tamoxifen', name: 'Tamoxifen', nameRu: 'Тамоксифен', tier: 'specialty', category: ['pharma', 'hormonal'],
    description: 'СЭРМ: блокирует E2-рецепторы в грудной железе — при гинекомастии и в ПКТ для стимуляции HPTA. Не снижает эстрадиол в крови — работает на уровне рецепторов.',
    monitoring: [{ what: 'E2, TT, LH/FSH, липиды', when: 'каждые 4 нед', targetRange: 'без тромбозов' }],
    contraindications: ['тромбофилия', 'тромбозы в анамнезе'],
    sideEffects: ['риск тромбозов', 'приливы', '↓либидо'],
    dosage: { mg: 20, timing: 'стабильное время' },
  },
  {
    id: 'letrozole', name: 'Letrozole', nameRu: 'Летрозол', tier: 'specialty', category: ['pharma', 'hormonal'],
    description: 'Ингибитор ароматазы (супрессия E2 до 98%). При высоком E2 (>100 пг/мл) или неэффективности анастрозола. Высокий риск чрезмерного ↓E2 — осторожная титрация.',
    monitoring: [{ what: 'E2 (чувствительный)', when: 'каждые 4 нед', targetRange: 'E2 20-40 пг/мл' }],
    contraindications: ['беременность'],
    sideEffects: ['суставы', 'головная боль', '↓либидо'],
    dosage: { mg: 2.5, timing: 'стабильное время' },
  },
  {
    id: 'atorvastatin', name: 'Atorvastatin', nameRu: 'Аторвастатин', tier: 'specialty', category: ['pharma', 'lipid'],
    description: 'Статин: ↓ЛПНП до 50%. Применяется при ЛПНП >3.0-4.0 на курсе. Контроль АЛТ/КФК (гепатотоксичность и миопатия).',
    monitoring: [{ what: 'АЛТ, КФК, липиды', when: 'каждые 4 нед', targetRange: 'АЛТ<40, КФК<300, ЛПНП<2.6' }],
    contraindications: ['активное заболевание печени', 'беременность'],
    sideEffects: ['миалгия', '↑КФК', 'диспепсия'],
    dosage: { mg: 20, timing: 'вечером' },
  },
  {
    id: 'rosuvastatin', name: 'Rosuvastatin', nameRu: 'Розувастатин', tier: 'specialty', category: ['pharma', 'lipid'],
    description: 'Статин с максимальным ↓ЛПНП: 10-20 мг сопоставимы с 40-80 мг аторвастатина.',
    monitoring: [{ what: 'АЛТ, КФК, липиды', when: 'каждые 4 нед', targetRange: 'АЛТ<40, КФК<300' }],
    contraindications: ['активное заболевание печени'],
    sideEffects: ['миалгия', '↑КФК'],
    dosage: { mg: 10, timing: 'вечером' },
  },
  {
    id: 'simvastatin', name: 'Simvastatin', nameRu: 'Симвастатин', tier: 'specialty', category: ['pharma', 'lipid'],
    description: 'Статин: ↓ЛПНП ~30-40%. CYP3A4-чувствителен — не с грейпфрутом, макролидами, берберином/силимарином.',
    monitoring: [{ what: 'АЛТ, КФК, липиды', when: 'каждые 4 нед', targetRange: 'КФК<300' }],
    contraindications: ['активное заболевание печени'],
    sideEffects: ['миалгия', '↑КФК'],
    dosage: { mg: 20, timing: 'вечером' },
  },
  {
    id: 'pravastatin', name: 'Pravastatin', nameRu: 'Правастатин', tier: 'specialty', category: ['pharma', 'lipid'],
    description: 'Статин с минимальным CYP-взаимодействием — безопаснее в комбинациях с БАД.',
    monitoring: [{ what: 'АЛТ, КФК, липиды', when: 'каждые 4 нед', targetRange: 'КФК<300' }],
    contraindications: ['активное заболевание печени'],
    sideEffects: ['миалгия (реже)'],
    dosage: { mg: 20, timing: 'вечером' },
  },
  {
    id: 'udca', name: 'UDCA (Ursodeoxycholic acid)', nameRu: 'УДХК (урсодезоксихолевая)', tier: 'advanced', category: ['hepatoprotector', 'choleretic'],
    description: 'Урсодезоксихолевая кислота: ↓ холестатического компонента поражения печени (ГГТ/ЩФ), защита гепатоцитов при холестазе.',
    monitoring: [{ what: 'ГГТ, ЩФ, билирубин', when: 'каждые 4 нед', targetRange: 'ГГТ<55, ЩФ<120' }],
    contraindications: ['непроходимость желчевыводящих путей'],
    sideEffects: ['жидкий стул'],
    dosage: { mg: 500, timing: 'с едой 2 раза в день' },
  },
  {
    id: 'dandelion', name: 'Dandelion extract', nameRu: 'Одуванчик (экстракт)', tier: 'standard', category: ['herb', 'diuretic'],
    description: 'Мягкий K⁺-сберегающий диуретик: уменьшает задержку воды на курсе. Не вымывает K⁺ (в отличие от тиазидов).',
    monitoring: [{ what: 'K⁺, Na⁺, АД, вес', when: 'каждые 4 нед', targetRange: 'K 3.5-5.0' }],
    contraindications: ['гиперкалиемия', 'закупорка желчных путей'],
    sideEffects: ['учащённое мочеиспускание'],
    dosage: { mg: 500, timing: 'утром' },
  },
  {
    id: 'chondroitin', name: 'Chondroitin sulfate', nameRu: 'Хондроитин сульфат', tier: 'standard', category: ['joint'],
    description: 'Сульфатированный гликозаминогликан — субстрат хряща, ↓ IL-1β и MMP-13. С глюкозамином — стандарт поддержки суставов на курсе.',
    monitoring: [{ what: 'CRP', when: 'каждые 8 нед', targetRange: 'CRP<3' }],
    contraindications: ['аллергия на морепродукты'],
    sideEffects: ['диспепсия (редко)'],
    dosage: { mg: 800, timing: 'с едой' },
  },
  {
    id: 'chondroitin_sulfate', name: 'Chondroitin sulfate', nameRu: 'Хондроитин сульфат', tier: 'standard', category: ['joint'],
    description: 'Сульфатированный гликозаминогликан — субстрат хряща, ↓ IL-1β и MMP-13. С глюкозамином — стандарт поддержки суставов на курсе.',
    monitoring: [{ what: 'CRP', when: 'каждые 8 нед', targetRange: 'CRP<3' }],
    contraindications: ['аллергия на морепродукты'],
    sideEffects: ['диспепсия'],
    dosage: { mg: 800, timing: 'с едой' },
  },
  {
    id: 'hyaluronic_acid', name: 'Hyaluronic acid', nameRu: 'Гиалуроновая кислота', tier: 'standard', category: ['joint'],
    description: 'Основной компонент синовиальной жидкости: вязкоэластичность сустава, питание хряща. Поддержка суставов при высокообъёмных тренировках.',
    monitoring: [{ what: 'болевой синдром (дневник)', when: 'еженедельно' }],
    contraindications: ['нет'],
    sideEffects: ['нет'],
    dosage: { mg: 200, timing: 'с едой' },
  },
  {
    id: 'hyaluronic', name: 'Hyaluronic acid', nameRu: 'Гиалуроновая кислота', tier: 'standard', category: ['joint'],
    description: 'Основной компонент синовиальной жидкости: вязкоэластичность сустава, питание хряща.',
    monitoring: [{ what: 'болевой синдром (дневник)', when: 'еженедельно' }],
    contraindications: ['нет'],
    sideEffects: ['нет'],
    dosage: { mg: 200, timing: 'с едой' },
  },
  {
    id: 'beetroot', name: 'Beetroot extract', nameRu: 'Свёкла (экстракт нитратов)', tier: 'standard', category: ['cardioprotector'],
    description: 'Нитраты → NO: улучшение эндотелиальной функции, ↓ АД на 4-8 мм рт.ст., ↑ выносливости. Хорошее дополнение к PDE5i.',
    monitoring: [{ what: 'АД', when: 'каждые 4 нед', targetRange: 'АД<130/85' }],
    contraindications: ['гипотония', 'оксалатные камни'],
    sideEffects: ['красная моча (безопасно)'],
    dosage: { mg: 500, timing: 'утром' },
  },
  {
    id: 'celery_extract', name: 'Celery seed extract', nameRu: 'Экстракт сельдерея', tier: 'standard', category: ['herb', 'cardioprotector'],
    description: '3-n-бутилфталид: мягкое ↓ АД и ↓ мочевой кислоты, диуретическое действие. Поддержка почек и АД на курсе.',
    monitoring: [{ what: 'АД, мочевая кислота', when: 'каждые 4 нед', targetRange: 'мочевая <420' }],
    contraindications: ['беременность', 'воспаление почек'],
    sideEffects: ['аллергия (редко)'],
    dosage: { mg: 500, timing: 'утром' },
  },
  {
    id: 'red_yeast', name: 'Red yeast rice', nameRu: 'Красный ферментированный рис', tier: 'advanced', category: ['pharma', 'lipid'],
    description: 'Монаколин K (природный ингибитор ГМГ-КоА-редуктазы): ↓ЛПНП ~20-25%. Контроль АЛТ/КФК как у статинов.',
    monitoring: [{ what: 'АЛТ, КФК, липиды', when: 'каждые 4 нед', targetRange: 'ЛПНП<2.6' }],
    contraindications: ['заболевания печени', 'беременность'],
    sideEffects: ['миалгия', 'диспепсия'],
    dosage: { mg: 600, timing: 'вечером с едой' },
  },
  {
    id: 'furosemide', name: 'Furosemide', nameRu: 'Фуросемид', tier: 'specialty', category: ['pharma', 'diuretic'],
    description: 'Петлевой диуретик: быстрая эвакуация жидкости. Вымывает K⁺/Na⁺/Mg — обязателен контроль электролитов. Кратковременно, под контролем врача.',
    monitoring: [{ what: 'K⁺, Na⁺, Mg, вес, АД', when: 'каждые 2 нед', targetRange: 'K 3.5-5.0' }],
    contraindications: ['анурия', 'гиповолемия', 'гипокалиемия'],
    sideEffects: ['гипокалиемия', 'дегидратация'],
    dosage: { mg: 40, timing: 'утром' },
  },
  {
    id: 'hydrochlorothiazide', name: 'Hydrochlorothiazide', nameRu: 'Гидрохлоротиазид', tier: 'specialty', category: ['pharma', 'diuretic'],
    description: 'Тиазидный диуретик: ↓ объёма, ↓ АД. Вымывает K⁺, повышает глюкозу и мочевую кислоту.',
    monitoring: [{ what: 'K⁺, Na⁺, глюкоза, мочевая кислота', when: 'каждые 4 нед', targetRange: 'K 3.5-5.0' }],
    contraindications: ['подагра', 'гипокалиемия'],
    sideEffects: ['гипокалиемия', 'гипергликемия'],
    dosage: { mg: 25, timing: 'утром' },
  },
  {
    id: 'chlorthalidone', name: 'Chlorthalidone', nameRu: 'Хлорталидон', tier: 'specialty', category: ['pharma', 'diuretic'],
    description: 'Тиазидоподобный диуретик длительного действия (24-48 ч). Вымывает K⁺.',
    monitoring: [{ what: 'K⁺, Na⁺, глюкоза', when: 'каждые 4 нед', targetRange: 'K 3.5-5.0' }],
    contraindications: ['подагра', 'гипокалиемия'],
    sideEffects: ['гипокалиемия', 'гипергликемия'],
    dosage: { mg: 12.5, timing: 'утром' },
  },
  {
    id: 'losartan', name: 'Losartan', nameRu: 'Лозартан', tier: 'specialty', category: ['pharma', 'cardioprotector'],
    description: 'АРБ: ↓ АД, ренопротекция. K⁺-сберегающий — контроль K⁺/eGFR. Альтернатива телмисартану.',
    monitoring: [{ what: 'K⁺, креатинин, eGFR, АД', when: 'каждые 4 нед', targetRange: 'K 3.5-5.0, eGFR>60' }],
    contraindications: ['стеноз почечной артерии', 'беременность'],
    sideEffects: ['гиперкалиемия'],
    dosage: { mg: 50, timing: 'утром' },
  },
  {
    id: 'valsartan', name: 'Valsartan', nameRu: 'Валсартан', tier: 'specialty', category: ['pharma', 'cardioprotector'],
    description: 'АРБ: ↓ АД, кардио- и ренопротекция. K⁺-сберегающий.',
    monitoring: [{ what: 'K⁺, креатинин, eGFR, АД', when: 'каждые 4 нед', targetRange: 'K 3.5-5.0' }],
    contraindications: ['стеноз почечной артерии', 'беременность'],
    sideEffects: ['гиперкалиемия'],
    dosage: { mg: 80, timing: 'утром' },
  },
  {
    id: 'bisoprolol', name: 'Bisoprolol', nameRu: 'Бисопролол', tier: 'specialty', category: ['pharma', 'cardioprotector'],
    description: 'β1-селективный блокатор: ↓ ЧСС, ↓ АД. При тахикардии на курсе. Не с кленбутеролом (антагонизм).',
    monitoring: [{ what: 'ЧСС, АД, ЭКГ', when: 'каждые 4 нед', targetRange: 'ЧСС 55-85' }],
    contraindications: ['брадикардия', 'астма', 'декомпенсированная ХСН'],
    sideEffects: ['брадикардия', 'утомляемость'],
    dosage: { mg: 2.5, timing: 'утром' },
  },
  {
    id: 'metoprolol', name: 'Metoprolol', nameRu: 'Метопролол', tier: 'specialty', category: ['pharma', 'cardioprotector'],
    description: 'β1-селективный блокатор: ↓ ЧСС/АД. Антагонизм с кленбутеролом.',
    monitoring: [{ what: 'ЧСС, АД', when: 'каждые 4 нед', targetRange: 'ЧСС 55-85' }],
    contraindications: ['брадикардия', 'астма'],
    sideEffects: ['брадикардия', 'утомляемость'],
    dosage: { mg: 25, timing: 'утром' },
  },
  {
    id: 'carvedilol', name: 'Carvedilol', nameRu: 'Карведилол', tier: 'specialty', category: ['pharma', 'cardioprotector'],
    description: 'Неселективный β+α1-блокатор: ↓ АД и ЧСС, кардиопротекция при гипертрофии.',
    monitoring: [{ what: 'ЧСС, АД', when: 'каждые 4 нед', targetRange: 'ЧСС 55-85' }],
    contraindications: ['брадикардия', 'астма', 'ХОБЛ'],
    sideEffects: ['головокружение', 'брадикардия'],
    dosage: { mg: 6.25, timing: 'утром' },
  },
  {
    id: 'acetyl_l_carnitine', name: 'Acetyl-L-carnitine', nameRu: 'Ацетил-L-карнитин', tier: 'standard', category: ['amino', 'antioxidant'],
    description: 'Ацетил-L-карнитин: доставка жирных кислот в митохондрии, ↓ оксидативного стресса, ацетил-кофактор нейромедиаторов. Поддержка ЦНС и энергетики.',
    monitoring: [{ what: 'нет специфических', when: '—' }],
    contraindications: ['судорожный синдром'],
    sideEffects: ['диспепсия', 'рыбный запах'],
    dosage: { mg: 1000, timing: 'утром' },
  },
  {
    id: 'carnitine', name: 'L-Carnitine', nameRu: 'L-Карнитин', tier: 'standard', category: ['amino'],
    description: 'Транспорт жирных кислот в митохондрии, ↓ утомляемости. При дозах >2 г — метаболит TMAO (контроль липидов).',
    monitoring: [{ what: 'липиды (при дозах >2 г)', when: 'каждые 8 нед' }],
    contraindications: ['судорожный синдром'],
    sideEffects: ['диспепсия', 'рыбный запах'],
    dosage: { mg: 1000, timing: 'с едой' },
  },
  {
    id: 'tongkat_ali', name: 'Tongkat Ali (Eurycoma)', nameRu: 'Тонгкат али', tier: 'advanced', category: ['herb', 'hormonal'],
    description: 'Адаптоген: ↑ свободного тестостерона (↓ SHBG), ↓ кортизола, ↑ либидо. Не применять на курсе ААС — только PCT/офф-цикл.',
    monitoring: [{ what: 'TT/FT, SHBG, кортизол', when: 'в PCT' }],
    contraindications: ['на курсе ААС', 'гипертония'],
    sideEffects: ['бессонница', 'раздражительность'],
    dosage: { mg: 300, timing: 'утром' },
  },
  {
    id: 'tribulus', name: 'Tribulus terrestris', nameRu: 'Трибулус', tier: 'advanced', category: ['herb', 'hormonal'],
    description: 'Растительный стимулятор: ↑ЛГ (данные противоречивы), ↑ либидо. Доказательная база слабая — не заменяет hCG/SERM.',
    monitoring: [{ what: 'нет', when: '—' }],
    contraindications: ['на курсе ААС'],
    sideEffects: ['бессонница'],
    dosage: { mg: 750, timing: 'утром' },
  },
  {
    id: 'echinacea', name: 'Echinacea', nameRu: 'Эхинацея', tier: 'standard', category: ['herb', 'immune'],
    description: 'Иммуномодулятор: активация макрофагов и NK-клеток, профилактика ОРВИ. Не при аутоиммунных заболеваниях.',
    monitoring: [{ what: 'нет', when: '—' }],
    contraindications: ['аутоиммунные заболевания', 'аллергия на сложноцветные'],
    sideEffects: ['аллергия'],
    dosage: { mg: 300, timing: 'утром' },
  },
  {
    id: 'telmi', name: 'Telmisartan', nameRu: 'Тельмисартан', tier: 'specialty', category: ['pharma', 'cardioprotector'],
    description: 'АРБ + PPAR-γ: ↓ АД, ↓ инсулинорезистентности. K⁺-сберегающий — контроль K⁺/eGFR.',
    monitoring: [{ what: 'K⁺, креатинин, eGFR, АД', when: 'каждые 4 нед', targetRange: 'K 3.5-5.0, eGFR>60' }],
    contraindications: ['стеноз почечной артерии', 'беременность'],
    sideEffects: ['гиперкалиемия', 'головокружение'],
    dosage: { mg: 40, timing: 'утром' },
  },
  {
    id: 'clomi', name: 'Clomiphene', nameRu: 'Кломифен', tier: 'specialty', category: ['pharma', 'hormonal'],
    description: 'СЭРМ (смесь эндо- и зукломифена): стимуляция ЛГ/ФСГ через антиэстрогенный эффект на гипофиз. Применяется в ПКТ.',
    monitoring: [{ what: 'LH/FSH/TT/E2', when: 'нед 2 и 6 ПКТ', targetRange: 'LH>1.0' }],
    contraindications: ['заболевания печени', 'тромбозы'],
    sideEffects: ['нарушение зрения (редко)', 'приливы'],
    dosage: { mg: 50, timing: 'стабильное время' },
  },
];

// ── Полный словарь русских имён (все мех-вещества без каталог-записи) ──
const RU_NAMES: Record<string, string> = {
  acarbose: 'Акарбоза', adrenaline: 'Адреналин', alprazolam: 'Алпразолам', amlodipine: 'Амлодипин',
  apixaban: 'Апиксабан', aripiprazole: 'Арипипразол', atenolol: 'Атенолол', azathioprine: 'Азатиоприн',
  bromocriptine: 'Бромокриптин', buchu: 'Бучу', buspirone: 'Буспирон', candesartan: 'Кандесартан',
  captopril: 'Каптоприл', carbamazepine: 'Карбамазепин', celecoxib: 'Целекоксиб', citalopram: 'Циталопрам',
  clonazepam: 'Клоназепам', clopidogrel: 'Клопидогрел', cortisol: 'Кортизол', cyclosporine: 'Циклоспорин',
  dabigatran: 'Дабигатран', dexamethasone: 'Дексаметазон', diazepam: 'Диазепам', diltiazem: 'Дилтиазем',
  duloxetine: 'Дулоксетин', eleuthero: 'Элеутерококк', enalapril: 'Эналаприл', escitalopram: 'Эсциталопрам',
  estradiol: 'Эстрадиол', fluoxetine: 'Флуоксетин', glucagon: 'Глюкагон', goldenrod: 'Золотарник',
  haloperidol: 'Галоперидол', horsetail: 'Хвощ полевой', hydrocortisone: 'Гидрокортизон', ibuprofen: 'Ибупрофен',
  irbesartan: 'Ирбесартан', levothyroxine_dup: 'Левотироксин', liothyronine: 'Лиотиронин', liothyronine_dup: 'Лиотиронин',
  lisinopril: 'Лизиноприл', lorazepam: 'Лоразепам', metformin_dup: 'Метформин', methimazole: 'Метимазол',
  methylprednisolone: 'Метилпреднизолон', mycophenolate: 'Микофенолат', naproxen: 'Напроксен', nettle: 'Крапива',
  nifedipine: 'Нифедипин', olanzapine: 'Оланзапин', olmesartan: 'Олмесартан', parsley: 'Петрушка',
  perindopril: 'Периндоприл', phenytoin: 'Фенитоин', pioglitazone: 'Пиоглитазон', pitavastatin: 'Питавастатин',
  prednisone: 'Преднизон', progesterone: 'Прогестерон', propolis: 'Прополис', propranolol: 'Пропранолол',
  propylthiouracil: 'Пропилтиоурацил', pygeum: 'Пигеум африканский', quetiapine: 'Кветиапин', ramipril: 'Рамиприл',
  risperidone: 'Рисперидон', rivaroxaban: 'Ривароксабан', sertraline: 'Сертралин', tacrolimus: 'Такролимус',
  ticagrelor: 'Тикагрелор', uva_ursi: 'Толокнянка', valproate: 'Вальпроат', venlafaxine: 'Венлафаксин',
  verapamil: 'Верапамил', pharma: 'Фармпрепарат', telmi: 'Тельмисартан',
};

function humanName(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function categoryOf(id: string): string[] {
  const s = id.toLowerCase();
  const pharmaKeys = ['statin', 'sartan', 'pril', 'olol', 'dipine', 'prazole', 'pine', 'pidem', 'pam', 'bamate', 'etine', 'lam', 'idone', 'azine', 'pril', 'epam', 'mide', 'phen', 'lone', 'pirin', 'profen', 'coxib', 'fibrate', 'mab', 'tinib', 'mide', 'statin', 'gliflozin', 'gliptin', 'glitazone', 'formin', 'hormone', 'cortisol', 'estradiol', 'progesterone', 'testosterone', 'tamoxifen', 'clomi', 'anastrozole', 'letrozole', 'cabergoline', 'finasteride', 'hcg', 'aspirin', 'clopidogrel', 'warfarin', 'enoxaparin', 'apixaban', 'rivaroxaban', 'dabigatran', 'furosemide', 'thiazide', 'spironolactone', 'eplerenone', 'metformin', 'acarbose', 'pioglitazone', 'levothyroxine', 'liothyronine', 'methimazole', 'propylthiouracil', 'phenytoin', 'carbamazepine', 'valproate', 'lamotrigine', 'memantine', 'amantadine', 'guanfacine', 'tizanidine', 'fluoxetine', 'sertraline', 'citalopram', 'escitalopram', 'duloxetine', 'venlafaxine', 'buspirone', 'alprazolam', 'diazepam', 'lorazepam', 'clonazepam', 'haloperidol', 'risperidone', 'olanzapine', 'quetiapine', 'aripiprazole', 'cyclosporine', 'tacrolimus', 'mycophenolate', 'azathioprine', 'methylprednisolone', 'prednisone', 'dexamethasone', 'hydrocortisone', 'celecoxib', 'ibuprofen', 'naproxen', 'tadalafil', 'sildenafil', 'nitrates', 'digoxin', 'amiodarone', 'beta_blocker', 'diuretic'];
  if (pharmaKeys.some(k => s.includes(k))) return ['pharma'];
  if (/vitamin_/.test(s)) return ['vitamin'];
  if (/magnesium|zinc|selenium|boron|copper|iron|chromium|potassium|calcium|manganese|molybdenum|phosphorus|iodine/.test(s)) return ['mineral'];
  if (/ashwagandha|rhodiola|ginseng|cordyceps|astragalus|eleuthero|tongkat|tribulus|echinacea|buchu|nettle|parsley|goldenrod|horsetail|uva_ursi|pygeum|propolis|dandelion/.test(s)) return ['herb', 'adaptogen'];
  if (/nac|glutathione|alpha_lipoic|coq10|curcumin|egcg|resveratrol/.test(s)) return ['antioxidant'];
  if (/boswellia|bromelain|nattokinase|msm|serrapeptase|curcumin/.test(s)) return ['antiinflam'];
  return ['other'];
}

function organOf(organId: string): string {
  return (TZ_SYSTEM_LABELS as any)[organId] || organId;
}

/** Полное дополнение каталога: 28 ручных + автогенерация для ВСЕХ мех-веществ. */
export function registerCatalogExtras(cat: Record<string, any>): void {
  // 1) ручные богатые записи
  for (const e of CATALOG_EXTRAS) {
    if (!cat[e.id]) {
      cat[e.id] = {
        id: e.id, name: e.name, nameRu: e.nameRu, tier: e.tier, category: e.category,
        forms: [{ id: e.id, name: e.name, nameRu: e.nameRu, dose: e.dosage?.timing || '', best: true }],
        organs: [], systems: [], mechanisms: [],
        description: e.description,
        synergies: [], conflicts: [], monitoring: e.monitoring || [],
        contraindications: e.contraindications || [], sideEffects: e.sideEffects || [],
        dosage: { mg: e.dosage?.mg || 0, timing: e.dosage?.timing || '', form: '' },
        bestForCourse: true,
      };
    }
  }
  // 2) автогенерация для ВСЕХ недостающих мех-веществ
  const mechIds = new Set<string>([
    ...Object.keys(SUPPLEMENTS_DB).map(s => s.toLowerCase()),
    ...Object.keys(PHARMACY_DB).map(s => s.toLowerCase()),
    ...Object.values(TZ_MECH_TO_SUBS).flatMap((m: any) => m.substances.map((s: any) => s.substanceId.toLowerCase())),
  ]);
  for (const id of mechIds) {
    const key = id.toLowerCase();
    if (cat[key] || cat[id]) continue;
    const entries: Array<{ organId: string; mechId: string; k: number; q: string; source: string }> = [
      ...((SUPPLEMENTS_DB as any)[key] || []),
      ...((PHARMACY_DB as any)[key] || []),
    ];
    const mechParts = entries.map(e => `${(TZ_MECH_LABELS as any)[e.mechId] || e.mechId} (k=${e.k}, док. ${e.q}): ${e.source}`).filter(Boolean);
    const organs = Array.from(new Set(entries.map(e => organOf(e.organId))));
    const systems = Array.from(new Set(entries.map(e => e.organId)));
    const cat_ = categoryOf(id);
    const nameRu = RU_NAMES[key] || humanName(id);
    const catDesc: Record<string, string> = {
      pharma: 'Рецептурный препарат — принимать только по назначению и под контролем врача.',
      vitamin: 'Витамин: применяется для профилактики/коррекции дефицитов, влияет на энергетику и метаболизм.',
      mineral: 'Минерал: кофактор ферментов, электролитный и костный обмен; разнесение приёма — по правилам минералов.',
      antioxidant: 'Антиоксидант: снижает окислительный стресс и защищает органы-мишени курса.',
      antiinflam: 'Противовоспалительное/протеолитическое: снижает системное воспаление, фибринолитический/противовоспалительный эффект.',
      herb: 'Растительное средство: адаптогенные/тонизирующие эффекты; взаимодействия с рецептурными — по протоколу.',
    };
    const catLine = catDesc[cat_[0]] || 'Средство поддержки: влияет на механизмы риска курса.';
    const mechList = mechParts.length > 0
      ? `Механизмы влияния: ${mechParts.join('; ')}.`
      : 'Включено в механизм-модель риска; точное влияние описано в протоколе.';
    const adminRule = ADMIN_RULES_BY_ID[key];
    const adminLine = adminRule ? `Схема приёма: ${adminRule.timing}. ${adminRule.reason}` : '';
    const contraLine = cat_[0] === 'pharma' ? 'Противопоказания: рецептурный — только по назначению врача.' : '';
    const monitoringLine = organs.length > 0 ? `Контроль: ${organs.join(', ')} (анализы каждые 4-8 нед).` : '';
    const description = `${catLine} ${mechList} ${adminLine} ${monitoringLine} ${contraLine}`.replace(/\s+/g, ' ').trim();
    cat[key] = {
      id, name: id, nameRu, tier: cat_[0] === 'pharma' ? 'specialty' : 'standard', category: cat_,
      forms: [{ id, name: id, nameRu, dose: '', best: true }],
      organs, systems, mechanisms: entries.map(e => e.mechId),
      description,
      synergies: [], conflicts: [],
      monitoring: organs.length > 0 ? [{ what: `контроль систем: ${organs.join(', ')}`, when: 'каждые 4-8 нед' }] : [],
      contraindications: cat_[0] === 'pharma' ? ['рецептурный — только по назначению врача'] : [],
      sideEffects: [],
      dosage: { mg: 0, timing: '', form: '' },
      bestForCourse: false,
    };
  }
}
