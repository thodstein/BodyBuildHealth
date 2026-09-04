import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../../data/support-database';
import { buildConflicts, buildCautions, buildSpecialInstructions } from '../../../engines/support-plan/display';
import { calcStackSynergyScore, suggestSynergyAdditions } from '../../../engines/support-plan/display';
import { SynergyEngine } from '../../../engines/synergy-score.engine';
import type { SubstanceEntry, MasterDB } from '../../../core/types';
import { INTERACTION_ENRICHMENT } from '../../../data/support-interaction-enrichment';


/* ──────────────── DEPLETION DB ──────────────── */
const DEPLETION_DB: Array<{ depleter: string; depleted: string; mechanism: string; severity: string; recommendation: string }> = [
  { depleter: 'ZINC', depleted: 'COPPER', mechanism: 'Индукция металлотионеина → связывание Cu в энтероцитах → ↓ всасывания Cu', severity: 'HIGH', recommendation: 'Соотношение Zn:Cu = 10:1. При 50 мг Zn + 5 мг Cu. Контроль Cu в крови каждые 3 мес.' },
  { depleter: 'IRON', depleted: 'ZINC', mechanism: 'Конкуренция за DMT1-транспортёр в дуоденальных энтероцитах', severity: 'MEDIUM', recommendation: 'Интервал приёма ≥2 ч. Fe утром, Zn вечером.' },
  { depleter: 'ZINC', depleted: 'IRON', mechanism: 'Конкуренция за DMT1-транспортёр', severity: 'MEDIUM', recommendation: 'Интервал приёма ≥2 ч. Zn вечером, Fe утром.' },
  { depleter: 'CALCIUM', depleted: 'IRON', mechanism: 'Ca блокирует DMT1-транспортёр Fe → ↓ всасывания Fe на 40-60%', severity: 'MEDIUM', recommendation: 'Интервал ≥2 ч. Ca вечером, Fe утром.' },
  { depleter: 'CALCIUM', depleted: 'MAGNESIUM', mechanism: 'Конкуренция за TRPV6/TRPM6 каналы в толстом кишечнике', severity: 'LOW', recommendation: 'Ca <500 мг + Mg <300 мг вместе, или раздельно Ca утром/Mg вечером.' },
  { depleter: 'MAGNESIUM', depleted: 'CALCIUM', mechanism: 'Конкуренция за парацеллюлярный транспорт', severity: 'LOW', recommendation: 'Раздельный приём ≥1 ч.' },
  { depleter: 'METFORMIN', depleted: 'VITAMIN_B12', mechanism: 'Метформин ингибирует IF-B12 рецептор в подвздошной кишке → ↓ всасывания B12', severity: 'MEDIUM', recommendation: 'B12 500-1000 мкг/сут. Контроль B12 каждые 6 мес.' },
  { depleter: 'OMEGA3', depleted: 'VITAMIN_E', mechanism: 'Полиненасыщенные ЖК увеличивают потребность в вит.E для защиты от перекисного окисления', severity: 'LOW', recommendation: 'Добавить вит.E 100-200 МЕ/сут при Омега-3 >3 г/сут.' },
  { depleter: 'CAFFEINE', depleted: 'MAGNESIUM', mechanism: 'Кофеин ↑ экскрецию Mg через почки на 30-40%', severity: 'LOW', recommendation: 'Mg 200-400 мг/сут дополнительно при регулярном приёме кофеина.' },
  { depleter: 'CAFFEINE', depleted: 'POTASSIUM', mechanism: 'Кофеин ↑ экскрецию K+ через почки (диуретический эффект)', severity: 'LOW', recommendation: 'Контроль K+ при высоких дозах кофеина (>400 мг/сут).' },
  { depleter: 'ASHWAGANDHA', depleted: 'IODINE', mechanism: 'Ашваганда может ↓ конверсию T4→T3, ↑ потребность щитовидной железы', severity: 'LOW', recommendation: 'Контроль ТТГ/T4 при длительном приёме >3 мес.' },
  { depleter: 'BERBERINE', depleted: 'VITAMIN_B12', mechanism: 'Берберин ↓ перистальтику → ↓ время контакта B12 со слизистой', severity: 'LOW', recommendation: 'Контроль B12 при длительном (>6 мес) приёме берберина.' },
  { depleter: 'BETA_ALANINE', depleted: 'TAURINE', mechanism: 'Конкуренция за TauT-транспортёр в кишечнике', severity: 'LOW', recommendation: 'Интервал ≥2 ч между β-аланином и таурином.' },
  { depleter: 'CURCUMIN', depleted: 'IRON', mechanism: 'Хелация Fe³⁺ куркумином → ↓ всасывания негемового Fe', severity: 'MEDIUM', recommendation: 'Интервал ≥2 ч. При анемии — раздельный приём.' },
  { depleter: 'VITAMIN_D', depleted: 'MAGNESIUM', mechanism: 'Активация D (гидроксилирование) потребляет Mg → ↓ запасов Mg', severity: 'LOW', recommendation: 'D3:Mg = 1:100 (2000 МЕ D3 + 200 мг Mg).' },
  { depleter: 'VITAMIN_A', depleted: 'VITAMIN_D', mechanism: 'Конкуренция за RXR → ↓ VDR-опосредованной транскрипции', severity: 'MEDIUM', recommendation: 'A <3000 МЕ/сут. Соотношение A:D = 1:1.' },
  { depleter: 'PROBIOTICS', depleted: 'VITAMIN_K2', mechanism: 'Пробиотики (Bifidobacterium, Lactobacillus) синтезируют K2 → ↑ потребности', severity: 'LOW', recommendation: 'Добавить K2 (MK-7) 90-180 мкг/сут.' },
  { depleter: 'COLOSTRUM', depleted: 'CALCIUM', mechanism: 'Высокое содержание Ca в колоструме → конкуренция с Mg/Zn за всасывание', severity: 'LOW', recommendation: 'Интервал ≥1 ч с Mg/Zn.' },
  { depleter: 'CURCUMIN', depleted: 'IRON', mechanism: 'Хелация Fe³⁺ куркумином → ↓ всасывания негемового железа', severity: 'MEDIUM', recommendation: 'Интервал ≥2 ч. Куркумин с едой, Fe отдельно.' },
  { depleter: 'EGCG', depleted: 'FOLATE', mechanism: 'EGCG ингибирует DHFR → ↓ синтеза активного фолата', severity: 'MEDIUM', recommendation: 'EGCG >500 мг/сут → добавить 5-МТГФ 400 мкг. Интервал ≥2 ч.' },
  { depleter: 'GREEN_TEA_EGCG', depleted: 'IRON', mechanism: 'Танины EGCG связывают Fe³⁺ → ↓ всасывания на 60-70%', severity: 'HIGH', recommendation: 'Зелёный чай за 1 ч до или через 2 ч после еды с Fe.' },
  { depleter: 'OMEGA3', depleted: 'VITAMIN_E', mechanism: 'ПНЖК омега-3 ↑ потребность в вит.E для защиты от перекисного окисления', severity: 'LOW', recommendation: 'Вит.E 100-200 МЕ/сут при омега-3 >3 г/сут.' },
  { depleter: 'GARLIC', depleted: 'IODINE', mechanism: 'Чеснок ↓ захват йода щитовидной железой', severity: 'LOW', recommendation: 'Контроль ТТГ при длительном приёме чеснока >500 мг/сут.' },
  { depleter: 'CAFFEINE', depleted: 'VITAMIN_C', mechanism: 'Кофеин ↑ экскрецию C (осмотический диурез)', severity: 'LOW', recommendation: 'Интервал ≥1 ч между кофеином и вит.C.' },
  { depleter: 'CAFFEINE', depleted: 'B_VITAMINS', mechanism: 'Кофеин ↓ всасывание B1 и B6 в кишечнике', severity: 'LOW', recommendation: 'B-комплекс утром, кофеин через 30 мин.' },
  { depleter: 'GINSENG', depleted: 'POTASSIUM', mechanism: 'Женьшень ↑ калийурез через ↑ Na/K-АТФазы в почках', severity: 'LOW', recommendation: 'Контроль K+ при длительном приёме (>3 мес).' },
  { depleter: 'LICORICE', depleted: 'POTASSIUM', mechanism: 'Глицирризиновая кислота ↓ 11β-HSD2 → ↓ K+ (псевдоальдостеронизм)', severity: 'HIGH', recommendation: 'Солодка >3 г/сут → гипокалиемия. Контроль K+, STOP за 2 нед до соревнований.' },
  { depleter: 'ALPHA_LIPOIC', depleted: 'BIOTIN', mechanism: 'АЛЬК конкурирует с биотином за SMVT-транспортёр', severity: 'MEDIUM', recommendation: 'Интервал ≥2 ч. При дозе АЛЬК >600 мг → биотин 500 мкг.' },
  { depleter: 'NAC', depleted: 'COPPER', mechanism: 'NAC хелатирует Cu²⁺ → ↓ всасывания при дозе >1200 мг/сут', severity: 'LOW', recommendation: 'Интервал ≥2 ч. Длительно NAC >1200 мг → контроль Cu.' },
  { depleter: 'TUDCA', depleted: 'FAT_SOLUBLE_VITAMINS', mechanism: 'TUDCA ↑ объём желчи → ↓ абсорбции жирорастворимых витаминов', severity: 'LOW', recommendation: 'При TUDCA >1000 мг/сут → добавить K2+доп.D3.' },
  { depleter: 'PSYLLIUM', depleted: 'CALCIUM', mechanism: 'Клетчатка связывает Ca в кишечнике → ↓ всасывания', severity: 'MEDIUM', recommendation: 'Интервал ≥1 ч между клетчаткой и Ca/Mg/Zn.' },
  { depleter: 'BETAINE', depleted: 'B_VITAMINS', mechanism: 'Высокие дозы бетаина (TMG) ↑ потребность в B12+фолат для реметилирования Hcy', severity: 'LOW', recommendation: 'Бетаин + B12 + фолат + B6 — полный цикл метилирования.' },
  { depleter: 'RESVERATROL', depleted: 'IRON', mechanism: 'Ресвератрол хелатирует Fe²⁺ → ↓ всасывания', severity: 'LOW', recommendation: 'Интервал ≥2 ч. При анемии — не совмещать.' },
  { depleter: 'NARINGIN', depleted: 'IRON', mechanism: 'Грейпфрут ↓ всасывание Fe через ингибицию DMT1', severity: 'MEDIUM', recommendation: 'Не пить грейпфрутовый сок с едой, содержащей Fe.' },
  { depleter: 'CHITOSAN', depleted: 'CALCIUM', mechanism: 'Хитозан связывает Ca, Mg, Zn в кишечнике', severity: 'MEDIUM', recommendation: 'Интервал ≥3 ч. Хитозан вечером, минералы утром.' },
  { depleter: 'CHITOSAN', depleted: 'VITAMIN_E', mechanism: 'Хитозан ↓ всасывание жирорастворимых витаминов', severity: 'MEDIUM', recommendation: 'Вит.E в другое время дня.' },
];
const UL_DB: Record<string, number> = {
  ZINC: 40, SELENIUM: 400, COPPER: 10, IRON: 45, CALCIUM: 2500, MAGNESIUM: 350,
  VITAMIN_A: 3000, VITAMIN_D: 4000, VITAMIN_E: 1000, VITAMIN_C: 2000, IODINE: 1100,
  CHROMIUM: 1000, MANGANESE: 11, BORON: 20, POTASSIUM: 3500,
};

/* ──────────────── LAB MONITOR DB ──────────────── */
interface LabMon {
  markerRu: string; markerEn: string; system: string;
  when: string; target: string;
  condition: string;  // e.g. "↑ ALT → цитолиз гепатоцитов"
  note: string;       // Что отслеживать / на что обращать внимание
  tier1?: string;     // что делать при borderline
  tier2?: string;     // что делать при treatment
  tier3?: string;     // экстренно
}
const LAB_MONITOR_DB: Record<string, LabMon[]> = {
  // ── AAS & гормональные препараты ── (маркеры общие для всех AAS)
  '': [
    { markerRu:'ЛПВП (HDL)', markerEn:'HDL', system:'cardio', when:'Каждые 4 нед', target:'>1.2 ммоль/л', condition:'↓ HDL → ↑ атерогенности', note:'Особенно под оральными (окси, станозолол). Если HDL <0.5 — риск острого атеротромбоза.', tier1:'0.9-1.2 — ниацин 500-1000 мг', tier2:'<0.9 — ниацин+омега-3+бергамот', tier3:'<0.3 ммоль/л — STOP оральные AAS, добавить эзетимиб' },
    { markerRu:'Гематокрит (HCT)', markerEn:'HCT', system:'hematologic', when:'Каждые 4 нед', target:'<0.50 L/L', condition:'↑ HCT → ↑ вязкость → ↑ тромбоз', note:'Особенно под болденоном. HCT >0.54 — забор крови (500 мл). >0.60 — STOP AAS.', tier1:'0.48-0.52 — серрапептаза+наттокиназа, контроль', tier2:'0.52-0.58 — кровопускание 500 мл, аспирин 100 мг', tier3:'>0.60 — STOP AAS, срочная консультация гематолога' },
    { markerRu:'Гемоглобин (HGB)', markerEn:'HEMOGLOBIN', system:'hematologic', when:'Каждые 4 нед', target:'<170 г/л', condition:'↑ HGB → риск тромбоза', note:'Коррелирует с HCT. HGB >180 — STOP AAS.', tier1:'160-170 — контроль', tier2:'170-185 — кровопускание', tier3:'>200 — STOP AAS' },
    { markerRu:'ЛПНП (LDL)', markerEn:'LDL', system:'cardio', when:'Каждые 4 нед', target:'<3.0 ммоль/л', condition:'↑ LDL → атеросклероз', note:'Оральные AAS ↓ HDL + ↑ LDL — атерогенная дислипидемия.', tier1:'3.0-4.0 — бергамот 500-1000 мг', tier2:'4.0-5.5 — бергамот+чеснок+омега-3', tier3:'>5.5 — добавить розувастатин 5-10 мг' },
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Каждые 4 нед', target:'<40 Ед/л', condition:'↑ АЛТ → цитолиз гепатоцитов', note:'Оральные 17α-алкилированные (метандростенолон, оксиметолон, станозолол) → ↑ нагрузки.', tier1:'40-80 — NAC 1200 мг, силимарин', tier2:'80-200 — TUDCA 500-1000 мг, NAC, силимарин', tier3:'>200 — STOP оральные AAS' },
    { markerRu:'АСТ', markerEn:'AST', system:'hepatic', when:'Каждые 4 нед', target:'<40 Ед/л', condition:'↑ АСТ → поражение гепатоцитов + миокарда', note:'Соотношение АЛТ/АСТ: если АСТ > АЛТ — возможна миопатия (CK ↑) или алкоголь.', tier1:'40-80 — наблюдение, NAC', tier2:'80-200 — TUDCA+NAC+силимарин', tier3:'>200 — STOP AAS' },
    { markerRu:'ГГТ', markerEn:'GGT', system:'hepatic', when:'Каждые 4 нед', target:'<55 Ед/л', condition:'↑ ГГТ → холестаз, алкоголь, микросомальная индукция', note:'Растёт от 17α-алкилированных. Если ↑ ГГТ + ↑ ЩФ — холестатическое поражение.', tier1:'55-100 — TUDCA 500 мг', tier2:'100-200 — TUDCA 1000 мг, NAC, силимарин', tier3:'>200 — STOP оральные AAS, УЗИ печени' },
    { markerRu:'Эстрадиол (E2)', markerEn:'ESTRADIOL', system:'hormonal', when:'Каждые 4 нед (через 48 ч после инъекции)', target:'100-200 пмоль/л (на курсе)', condition:'↑ E2 → гинекомастия, отёки, гипертензия, ↓ E2 → суставы, либидо', note:'Измерять в середине недели между инъекциями. Не подавлять E2 до 0 — это опасно для липидов и костей.', tier1:'>250 — анастрозол 0.25-0.5 мг/день', tier2:'>400 — анастрозол 0.5-1 мг/день', tier3:'E2 <50 — отменить AI, E2 >600 — STOP препарат с ароматизацией' },
    { markerRu:'Пролактин (PRL)', markerEn:'PRL', system:'hormonal', when:'Каждые 4 нед', target:'<400 мМЕ/л', condition:'↑ PRL → ↓ либидо, галакторея, импульсивность', note:'Нужен при нандролоне, тренболоне. ↑ более 700 → каберголин.', tier1:'400-700 — каберголин 0.25 мг/нед', tier2:'700-1000 — каберголин 0.5 мг/нед', tier3:'>1000 — STOP нандролон/трен, МРТ гипофиза' },
  ],
  // ── Гепатопротекторы ──
  nac: [
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Каждые 4 нед', target:'<40 Ед/л', condition:'↓ АЛТ → защита гепатоцитов', note:'NAC 1200-1800 мг/сут снижает АЛТ на 30-50% при токсическом поражении. При дозе >2400 мг — тошнота.' },
    { markerRu:'ГГТ', markerEn:'GGT', system:'hepatic', when:'Каждые 4 нед', target:'<55 Ед/л', condition:'↓ ГГТ → улучшение детоксикации', note:'NAC улучшает конъюгацию токсинов, снижая ГГТ на 20-40%.' },
  ],
  tudca: [
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Каждые 4 нед', target:'<40 Ед/л', condition:'↓ АЛТ → снижение ER-стресса', note:'TUDCA 500-1000 мг снижает АЛТ за счёт уменьшения ER-стресса и апоптоза гепатоцитов.' },
    { markerRu:'ГГТ', markerEn:'GGT', system:'hepatic', when:'Каждые 4 нед', target:'<55 Ед/л', condition:'↓ ГГТ → улучшение желчеоттока', note:'TUDCA стимулирует BSEP, снижая холестатический компонент. Эффект через 2-4 нед.' },
    { markerRu:'Билирубин', markerEn:'BILIRUBIN', system:'hepatic', when:'Каждые 4 нед', target:'<21 мкмоль/л', condition:'↓ билирубин → улучшение конъюгации/экскреции', note:'Особенно эффективен при ↑ прямого билирубина (холестатический тип).', tier2:'>50 — TUDCA 1000 мг, STOP гепатотоксичные', tier3:'>100 — STOP AAS, УЗИ' },
  ],
  milk_thistle: [
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Каждые 4 нед', target:'<40 Ед/л', condition:'↓ АЛТ → стабилизация мембран', note:'Силимарин стабилизирует мембраны гепатоцитов. Эффект менее выражен, чем у TUDCA.' },
  ],
  alpha_lipoic: [
    { markerRu:'Глюкоза', markerEn:'GLUCOSE', system:'metabolic', when:'Каждые 4 нед', target:'<6.1 ммоль/л', condition:'↓ глюкоза ↑ инсулиночувствительность', note:'АЛЬК 300-600 мг улучшает утилизацию глюкозы мышцами через GLUT4.' },
  ],
  // ── ССС препараты ──
  telmisartan: [
    { markerRu:'Калий (K+)', markerEn:'POTASSIUM', system:'renal', when:'Через 2 нед, затем каждые 4 нед', target:'3.5-5.1 ммоль/л', condition:'↑ K+ при нарушении функции почек + ARB', note:'Телмисартан (как ARB) ↓ секрецию альдостерона → ↑ K+. Не сочетать с калийсберегающими диуретиками.', tier1:'5.2-5.5 — контроль калия диеты, отмена K+ добавок', tier2:'5.6-6.0 — снизить дозу телмисартана, повторить через 3 дня', tier3:'>6.0 — STOP телмисартан, ЭКГ, госпитализация' },
    { markerRu:'Креатинин', markerEn:'CREATININE', system:'renal', when:'Через 2 нед, затем каждые 4 нед', target:'прирост <30% от базы', condition:'↑ креатинин → ↓ СКФ при гипоперфузии почек', note:'ARB могут ↑ креатинин на 15-20% — это ожидаемо. Прирост >30% — ↓ дозу или отмена.', tier1:'прирост 15-30% — допустим', tier2:'прирост 30-50% — ↓ дозу, контроль через 2 нед', tier3:'прирост >50% — STOP, искать причину' },
    { markerRu:'Давление (АД)', markerEn:'BP_SYSTOLIC', system:'cardio', when:'Ежедневно первые 2 нед', target:'<130/80', condition:'↓ АД → контроль гипертензии', note:'Целевое <130/80 для всех на AAS. Телмисартан 40-80 мг снижает АД на 10-15/6-8 мм.' },
  ],
  nebivolol: [
    { markerRu:'ЧСС', markerEn:'HR', system:'cardio', when:'Ежедневно первые 2 нед', target:'55-65 уд/мин', condition:'↓ ЧСС → контроль β1-блокада', note:'Небиволол 2.5-5 мг снижает ЧСС на 8-15 уд/мин. Не допускать <50 в покое.', tier1:'ЧСС 50-55 — возможно снизить дозу', tier3:'ЧСС <45 — STOP, обратиться к врачу' },
    { markerRu:'Давление (АД)', markerEn:'BP_SYSTOLIC', system:'cardio', when:'Ежедневно первые 2 нед', target:'<130/80', condition:'↓ АД → вазодилатация через NO', note:'Небиволол ↑ NO → дополнительное снижение АД. Эффект синергии с телмисартаном.' },
  ],
  // ── Фибринолитики / кровь ──
  serrapeptase: [
    { markerRu:'Гематокрит (HCT)', markerEn:'HCT', system:'hematologic', when:'Каждые 4 нед', target:'<0.50 L/L', condition:'↓ HCT и вязкость', note:'Серрапептаза расщепляет α2-макроглобулин и фибрин → ↓ вязкости крови.' },
    { markerRu:'Время кровотечения (INR)', markerEn:'INR', system:'coagulation', when:'Через 2 нед после старта', target:'0.8-1.2', condition:'↑ INR → риск кровотечения', note:'При комбинации с антикоагулянтами (варфарин, НПВС) ↑ риск геморрагий.', tier2:'INR >1.5 — снизить дозу или отменить', tier3:'INR >3.0 — STOP, вит.K' },
  ],
  nattokinase: [
    { markerRu:'Гематокрит (HCT)', markerEn:'HCT', system:'hematologic', when:'Каждые 4 нед', target:'<0.50 L/L', condition:'↓ HCT, фибринолиз', note:'Наттокиназа активирует плазминоген → прямое растворение фибрина. Контроль HCT и INR.', tier2:'HCT <0.38 — отменить, контроль HGB' },
    { markerRu:'Фибриноген', markerEn:'FIBRINOGEN', system:'coagulation', when:'Каждые 4 нед', target:'<4.0 г/л', condition:'↓ фибриноген → ↓ риска тромбоза', note:'Наттокиназа снижает фибриноген на 20-30% за 2 мес.' },
  ],
  lumbrokinase: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Еженедельно первый месяц', target:'0.8-1.2', condition:'↑ INR → риск кровотечения', note:'Люмброкиназа — сильный прямой фибринолитик. При комбинации с НПВС/клопидогрелем ↑ риск геморрагии.', tier2:'INR >1.5 — отменить', tier3:'INR >2.5 — STOP, вит.K, врача' },
    { markerRu:'Гематокрит (HCT)', markerEn:'HCT', system:'hematologic', when:'Каждые 4 нед', target:'<0.50 L/L', condition:'↓ HCT', note:'Сильный фибринолитик > серрапептазы > наттокиназы.' },
  ],
  omega3: [
    { markerRu:'Триглицериды (TG)', markerEn:'TRIGLYCERIDES', system:'cardio', when:'Каждые 4-8 нед', target:'<1.7 ммоль/л', condition:'↓ TG → ↓ риска панкреатита и атеросклероза', note:'Омега-3 2-4 г/сут снижает TG на 15-30%. Доза <2 г неэффективна.', tier1:'1.7-2.3 — омега-3 2 г/сут', tier2:'2.3-5.7 — омега-3 4 г/сут + бергамот', tier3:'>5.7 — STOP оральные AAS, добавить фибраты (фенофибрат)' },
    { markerRu:'ЛПВП (HDL)', markerEn:'HDL', system:'cardio', when:'Каждые 4-8 нед', target:'>1.0 ммоль/л', condition:'↑ HDL → антиатерогенный эффект', note:'Высокие дозы омега-3 ↑ HDL на 5-10%. Эффект мал, но стабилен.' },
  ],
  niacin: [
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Через 2 нед, затем каждые 4 нед', target:'<40 Ед/л', condition:'↑ АЛТ → гепатотоксичность ниацина', note:'Ниацин SR >500 мг/сут может ↑ АЛТ. Использовать только IR-форму.', tier1:'40-80 — ↓ дозу или ниацин IR, NAC', tier3:'>80 — STOP ниацин' },
    { markerRu:'Глюкоза', markerEn:'GLUCOSE', system:'metabolic', when:'Каждые 4 нед', target:'<6.1 ммоль/л', condition:'↑ глюкоза → инсулинорезистентность от ниацина', note:'Ниацин ↑ глюкозу на 5-10%. При диабете — с осторожностью.', tier1:'6.1-7.0 — контроль, снизить дозу', tier2:'>7.0 — STOP ниацин, добавить берберин' },
    { markerRu:'Мочевая кислота', markerEn:'URIC_ACID', system:'metabolic', when:'Каждые 4 нед', target:'<420 мкмоль/л', condition:'↑ мочевая кислота → риск подагры', note:'Ниацин ↑ реабсорбцию уратов в почках. При подагре — не применять.', tier1:'420-500 — диета', tier2:'>500 — STOP ниацин, аллопуринол?' },
  ],
  berberine: [
    { markerRu:'Глюкоза', markerEn:'GLUCOSE', system:'metabolic', when:'Каждые 4 нед', target:'<5.6 ммоль/л', condition:'↓ глюкоза → ↑ AMPK', note:'Берберин 1000-2000 мг/сут = метформин 2000 мг по эффективности ↓ глюкозы. Действует медленно (2-4 нед).' },
    { markerRu:'HbA1c', markerEn:'HBA1C', system:'metabolic', when:'Каждые 12 нед', target:'<5.7%', condition:'↓ HbA1c → долгосрочный контроль глюкозы', note:'Берберин снижает HbA1c на 0.5-1% за 3 мес.' },
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Каждые 4 нед', target:'<40 Ед/л', condition:'↓ АЛТ → улучшение стеатоза печени', note:'Берберин ↓ жировую дистрофию печени через AMPK-активацию.' },
  ],
  // ── Минералы ──
  zinc: [
    { markerRu:'Медь (Cu)', markerEn:'COPPER', system:'mineral', when:'Каждые 3 мес', target:'10-25 мкмоль/л', condition:'↓ Cu при Zn >50 мг/сут → анемия, нейропатия', note:'Zn индуцирует металлотионеин, связывающий Cu. При дозе >50 мг/сут Zn — обязательно добавлять Cu 2-5 мг. Соотношение Zn:Cu = 10:1.', tier1:'Cu 5-10 — добавить Cu 2 мг/сут', tier3:'Cu <5 — STOP Zn, Cu 5 мг/сут, невролог' },
    { markerRu:'Цинк (Zn)', markerEn:'ZINC', system:'mineral', when:'Каждые 3 мес', target:'11-18 мкмоль/л', condition:'↑ Zn → тошнота, ↓ иммунитет, ↓ Cu', note:'Дофаминовые эффекты Zn: при дефиците ↓ дофамин, при избытке — ↑ тревога. Не превышать 50 мг/сут.', tier1:'Zn >20 — снизить дозу' },
  ],
  iron: [
    { markerRu:'Ферритин', markerEn:'FERRITIN', system:'hematologic', when:'Каждые 4-8 нед', target:'30-150 мкг/л', condition:'↑ ферритин → перегрузка Fe → органы-мишени', note:'Гемохроматоз — нельзя Fe. На AAS ферритин может ↑ из-за воспаления. Не путать перегрузку с воспалительным ↑.', tier1:'150-300 — контроль, ↓ дозы Fe', tier2:'300-500 — STOP Fe, кровопускание?', tier3:'>500 — STOP Fe, ферритин + трансферрин, гематолог' },
    { markerRu:'Гемоглобин', markerEn:'HEMOGLOBIN', system:'hematologic', when:'Каждые 4 нед', target:'<170 г/л', condition:'↑ HGB с Fe на AAS → полицитемия', note:'Fe на курсе AAS может ускорять рост HGB. Не давать Fe без дефицита.' },
  ],
  calcium: [
    { markerRu:'Кальций (Ca)', markerEn:'CALCIUM', system:'mineral', when:'Каждые 4-8 нед', target:'2.2-2.6 ммоль/л', condition:'↑ Ca → гиперкальциемия → аритмии', note:'Избыток Ca (>2500 мг/сут) с D3 → гиперкальциемия. Контроль Ca и КФК.', tier1:'2.6-2.7 — убрать доп.Ca, контроль через 2 нед', tier2:'2.7-3.0 — STOP Ca, гидратация', tier3:'>3.0 — STOP D3+Ca, в/в гидратация, врача' },
  ],
  magnesium: [
    { markerRu:'Магний (Mg)', markerEn:'MAGNESIUM', system:'mineral', when:'Каждые 4-8 нед', target:'0.85-1.1 ммоль/л', condition:'↓ Mg → аритмии, судороги, ↑ ЧСС', note:'Mg вымывается кофеином, алкоголем, диуретиками. На курсе с кленбутеролом — критически важен.', tier1:'0.7-0.85 — Mg 300-400 мг, контроль', tier3:'<0.5 — STOP кленбутерол, в/в Mg' },
  ],
  potassium: [
    { markerRu:'Калий (K+)', markerEn:'POTASSIUM', system:'mineral', when:'Каждые 4 нед', target:'3.5-5.1 ммоль/л', condition:'↓ K+ → аритмии, слабость (кленбутерол, диуретики)', note:'Кленбутерол + диуретики + β2-агонисты → ↓ K+ на 0.5-1.0 ммоль/л. Инсулин тоже ↓ K+.', tier1:'3.0-3.5 — K+ 1000-2000 мг/сут', tier2:'2.5-3.0 — STOP кленбутерол, K+ в/в?', tier3:'<2.5 — ЭКГ, STOP кленбутерол/инсулин, срочная врачебная помощь' },
  ],
  // ── Витамины ──
  vitamin_d3: [
    { markerRu:'25(OH)D', markerEn:'VITAMIN_D', system:'mineral', when:'Каждые 3 мес', target:'75-150 нмоль/л', condition:'↑ D с Ca → гиперкальциемия', note:'Цель — 75-150 нмоль/л. >200 — риск токсичности (с Ca). >400 — STOP D3.', tier1:'150-200 — снизить дозу', tier2:'200-400 — STOP D3, контроль Ca' },
  ],
  vitamin_e: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Через 4 нед при дозе >400 МЕ/сут', target:'0.8-1.2', condition:'↑ INR → риск кровотечения (токоферол)', note:'Вит.E >400 МЕ/сут ↓ вит.K-зависимые факторы свёртывания → ↑ INR.', tier2:'INR >1.5 — снизить/отменить вит.E' },
  ],
  biotin: [
    { markerRu:'ТТГ', markerEn:'TSH', system:'hormonal', when:'Только при оценке щитовидной железы', target:'—', condition:'Ложное ↓ ТТГ и ↑ FT4/FT3', note:'Биотин >10 мг/сут искажает результаты иммуноанализов щитовидной железы (ложно низкий ТТГ, ложно высокие T3/T4). STOP биотин за 72 ч до сдачи.' },
    { markerRu:'Тропонин', markerEn:'TROPONIN_I', system:'cardio', when:'Только при подозрении на ИМ', target:'—', condition:'Ложно ↓ тропонин', note:'Биотин >10 мг/сут может ложно занизить тропонин → пропустить инфаркт.' },
  ],
  // ── Адаптогены / щитовидная железа ──
  ashwagandha: [
    { markerRu:'ТТГ', markerEn:'TSH', system:'hormonal', when:'Каждые 4-8 нед', target:'0.4-4.0 мМЕ/л', condition:'↓ ТТГ → ↑ T4 (ашваганда стимулирует щитовидную железу)', note:'Ашваганда может ↑ T3/T4 на 15-20% и ↓ ТТГ. При гипертиреозе — не применять.', tier1:'ТТГ <0.3 — контроль FT4, снизить дозу', tier3:'ТТГ <0.01 — STOP ашваганда, тиреостатики?' },
    { markerRu:'Кортизол', markerEn:'CORTISOL', system:'hormonal', when:'Каждые 4-8 нед', target:'115-690 нмоль/л (утром)', condition:'↓ кортизол → адаптогенный эффект', note:'Основной механизм — снижение кортизола на 15-30% через регуляцию HPA-оси.' },
  ],
  // ── Гормональные модуляторы ──
  anastro: [
    { markerRu:'Эстрадиол (E2)', markerEn:'ESTRADIOL', system:'hormonal', when:'Через 2 нед после старта, затем каждые 4 нед', target:'100-200 пмоль/л (на курсе)', condition:'↓ E2 → риск остеопении, ↓ HDL, суставные боли', note:'Переподавление E2 (<50 пмоль/л) → ↓ HDL, ↑ риск сердечно-сосудистых событий, боли в суставах. Не подавлять до нуля.', tier1:'E2 50-100 — ↓ анастрозол', tier3:'E2 <50 — STOP AI, контроль через 2 нед' },
  ],
  cabergoline: [
    { markerRu:'Пролактин (PRL)', markerEn:'PRL', system:'hormonal', when:'Через 2 нед после старта, затем каждые 4 нед', target:'<400 мМЕ/л', condition:'↓ PRL → риск ↓ дофамина (депрессия, импульсивность)', note:'Каберголин — мощный D2-агонист. Переподавление PRL (<50) → ↓ дофамина → депрессия, импульсивность, игровая зависимость.', tier1:'PRL <50 — ↓ дозу', tier3:'PRL <5 — STOP каберголин' },
    { markerRu:'ЭхоКГ', markerEn:'—', system:'cardio', when:'Каждые 12 мес при дозе >1 мг/нед', target:'—', condition:'Фиброз клапанов сердца (кумулятивная доза >3 г)', note:'Каберголин в высоких кумулятивных дозах может вызывать фиброз трёхстворчатого клапана. Контроль ЭхоКГ раз в год.' },
  ],
  tamoxifen: [
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Каждые 4 нед', target:'<40 Ед/л', condition:'↑ АЛТ → гепатотоксичность тамоксифена', note:'Тамоксифен может ↑ АЛТ на фоне стеатоза печени (жировая инфильтрация от эстрогенной стимуляции).', tier2:'ALT >80 — ↓ дозу, добавить NAC/TUDCA', tier3:'ALT >200 — STOP тамоксифен' },
    { markerRu:'Эстрадиол (E2)', markerEn:'ESTRADIOL', system:'hormonal', when:'Каждые 4 нед', target:'100-200 пмоль/л', condition:'↑ E2 → тамоксифен блокирует рецептор, но E2 циркулирует выше', note:'Тамоксифен — блокатор ER, а не ↓ E2. E2 может ↑ на 50-100% при сохранении продукции. Это нормально.' },
  ],
  spironolactone: [
    { markerRu:'Калий (K+)', markerEn:'POTASSIUM', system:'renal', when:'Через 2 нед, затем каждые 4 нед', target:'3.5-5.1 ммоль/л', condition:'↑ K+ → антагонист альдостерона', note:'Верошпирон — калийсберегающий диуретик. Не сочетать с ARB/ACEi + K+ препараты.', tier1:'5.2-5.5 — ↓ дозу', tier2:'5.6-6.0 — STOP', tier3:'>6.0 — ЭКГ, госпитализация' },
    { markerRu:'Натрий (Na+)', markerEn:'SODIUM', system:'renal', when:'Каждые 4 нед', target:'135-155 ммоль/л', condition:'↓ Na+ → диуретический эффект', note:'Мочегонное — может ↓ Na+. Контроль при длительном приёме.', tier3:'Na+ <125 — STOP, госпитализация' },
    { markerRu:'Креатинин', markerEn:'CREATININE', system:'renal', when:'Каждые 4 нед', target:'<110 мкмоль/л', condition:'↑ креатинин → ↓ функции почек', note:'Контроль функции почек на фоне диуретика.', tier2:'креатинин ↑ >30% — STOP' },
  ],
  saw_palmetto: [
    { markerRu:'ПСА (PSA)', markerEn:'—', system:'hormonal', when:'Каждые 3-6 мес', target:'<4.0 нг/мл', condition:'↓ DHT → ↓ ПСА', note:'Пальметто ингибирует 5α-редуктазу → ↓ DHT и ↓ ПСА на 30-40%. Может маскировать рак простаты. Контроль ПСА + пальцевое ректальное исследование раз в год.' },
  ],
  metformin: [
    { markerRu:'Глюкоза', markerEn:'GLUCOSE', system:'metabolic', when:'Каждые 4 нед', target:'<5.6 ммоль/л', condition:'↓ глюкоза → активация AMPK', note:'Метформин 500-2000 мг = берберин по AMPK-эффекту. Контроль глюкозы и HbA1c.', tier1:'>6.1 — ↑ дозу', tier3:'<3.5 — STOP, глюкоза в/в' },
    { markerRu:'B12', markerEn:'B12', system:'hematologic', when:'Каждые 6-12 мес', target:'200-900 пг/мл', condition:'↓ B12 → метформин ингибирует IF-B12 рецептор', note:'Метформин ↓ B12 на 10-20% за 6 мес. При длительном приёме — добавка B12 500-1000 мкг/сут.', tier1:'150-200 — добавить B12 500 мкг/сут', tier3:'<150 — STOP метформин? B12 в/м' },
    { markerRu:'HbA1c', markerEn:'HBA1C', system:'metabolic', when:'Каждые 12 нед', target:'<5.7%', condition:'↓ HbA1c', note:'Снижает на 0.5-1% за 3 мес.' },
  ],
  // ── Другие ──
  garlic: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Через 2-4 нед при дозе >300 мг', target:'0.8-1.2', condition:'↑ INR → риск кровотечения', note:'Чеснок ингибирует агрегацию тромбоцитов. Осторожно с НПВС, варфарином, НОАК.', tier2:'INR >1.5 — контроль' },
  ],
  curcumin: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Через 2-4 нед при дозе >1 г/сут', target:'0.8-1.2', condition:'↑ INR → куркумин ингибирует тромбоксан', note:'Куркумин с пиперином (биодоступность +2000%) → антиагрегантный эффект. Осторожно с антикоагулянтами.' },
  ],
  ginger: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Через 2-4 нед', target:'0.8-1.2', condition:'↑ INR → имбирь ингибирует COX', note:'Сухой имбирь >2 г/сут = ингибиция циклооксигеназы. Контроль INR при комбинации с НПВС/антикоагулянтами.' },
  ],
  ginkgo: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Через 2-4 нед', target:'0.8-1.2', condition:'↑ INR → гинкголиды ингибируют PAF', note:'Гинкго блокирует PAF-рецептор тромбоцитов. Не сочетать с НПВС, НОАК, антикоагулянтами.', tier2:'INR >1.5 — STOP гинкго' },
  ],
  coq10: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Через 4 нед при комбинации с варфарином', target:'0.8-1.2', condition:'↓ INR → CoQ10 структурно схож с вит.K', note:'CoQ10 может ↓ эффективность варфарина (структурное сходство с вит.K). Контроль INR.' },
  ],
  l_carnitine: [
    { markerRu:'ТМАО', markerEn:'—', system:'cardio', when:'При дозе >3 г/сут', target:'—', condition:'↑ ТМАО → ↑ риск тромбоза и атеросклероза', note:'L-карнитин → TMA → TMAO (печенью). Высокие дозы (>3 г/сут) ↑ TMAO на 200-400%. Контроль ТМАО или добавить чеснок/бромелайн (↓ TMAO).', tier1:'доза <3 г — OK', tier2:'>3 г — добавить чеснок/бромелайн' },
  ],
  betaine: [
    { markerRu:'Гомоцистеин (Hcy)', markerEn:'HOMOCYSTEINE', system:'metabolic', when:'Каждые 4-8 нед', target:'<10 мкмоль/л', condition:'↓ Hcy → метилирование через BHMT', note:'Бетаин + B6+B12+Folate => полная поддержка метилирования и ↓ Hcy.', tier1:'10-15 — добавить B6+B12+фолат', tier2:'15-30 — добавить TMG, триметилглицин' },
  ],
  same: [
    { markerRu:'Гомоцистеин (Hcy)', markerEn:'HOMOCYSTEINE', system:'metabolic', when:'Каждые 4-8 нед', target:'<10 мкмоль/л', condition:'↓ Hcy → донор метильной группы', note:'SAMe может ↑ Hcy при дефиците B12/фолата. Обязательно с B12+B6+фолат.', tier1:'Hcy >10 — добавить B12+фолат' },
  ],
  // ── Дополнительно ──
  egcg: [
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Через 4 нед при дозе >500 мг/сут', target:'<40 Ед/л', condition:'↑ АЛТ → гепатотоксичность EGCG (натощак!)', note:'EGCG >500 мг натощак → ↑ риск токсического гепатита. Принимать с едой. Не превышать 800 мг/сут.', tier2:'ALT 80-200 — STOP EGCG, NAC', tier3:'ALT >200 — STOP, врача' },
  ],
  diosmin: [
    { markerRu:'Давление (АД)', markerEn:'BP_SYSTOLIC', system:'cardio', when:'Через 4 нед', target:'<130/80', condition:'↓ АД → венотоник, ↓ периферическое сопротивление', note:'Диосмин/гесперидин улучшают тонус вен. При гипотонии — контролировать АД.' },
  ],
  dandelion: [
    { markerRu:'Калий (K+)', markerEn:'POTASSIUM', system:'mineral', when:'Каждые 4 нед', target:'3.5-5.1 ммоль/л', condition:'↓ K+ → мочегонный эффект (одуванчик)', note:'Корень одуванчика — мягкий диуретик. Контроль K+ при длительном приёме (>4 нед).' },
  ],
  inositol: [
    { markerRu:'Триглицериды (TG)', markerEn:'TRIGLYCERIDES', system:'cardio', when:'Каждые 8 нед', target:'<1.7 ммоль/л', condition:'↓ TG → ↑ чувствительность к инсулину', note:'Мио-инозитол 4 г/сут ↓ TG на 15-20% за 3 мес. Эффект медленный.' },
  ],
  red_yeast: [
    { markerRu:'АЛТ', markerEn:'ALT', system:'hepatic', when:'Через 4 нед, затем каждые 8 нед', target:'<40 Ед/л', condition:'↑ АЛТ → статины в составе', note:'Красный рис — природный статин (монаколин K). Контроль АЛТ. При ↑ >80 — отменить.', tier2:'ALT 80-200 — STOP, добавить бергамот', tier3:'ALT >200 — STOP, врача' },
    { markerRu:'КФК (CK)', markerEn:'CK', system:'metabolic', when:'Через 4 нед, затем каждые 8 нед', target:'<200 Ед/л', condition:'↑ CK → мышечная токсичность (редко для монаколина)', note:'Миопатия от красного риса реже, чем от синтетических статинов, но возможна. При болях в мышцах — контроль CK.', tier2:'CK >1000 — STOP, добавить CoQ10' },
  ],
  metformin_er: [  // alias for metformin
    { markerRu:'Глюкоза', markerEn:'GLUCOSE', system:'metabolic', when:'Каждые 4 нед', target:'<5.6', condition:'↓ глюкоза', note:'Метформин ER — контроль глюкозы.' },
  ],
  aspirin_v2: [
    { markerRu:'INR', markerEn:'INR', system:'coagulation', when:'Через 2 нед', target:'0.8-1.2', condition:'↑ INR → риск ЖКТ-кровотечения', note:'Аспирин 100 мг необратимо ингибирует COX-1 → тромбоксан. Риск ЖКТ-кровотечения при язве. Контроль гемоглобина раз в 3 мес.' },
  ],
};
const SYSTEM_ORDER = ['hepatic','renal','cardio','hematologic','coagulation','metabolic','hormonal','mineral'];
const SYSTEM_LABELS: Record<string,string> = {
  hepatic:'Печень', renal:'Почки', cardio:'ССС', hematologic:'Кровь',
  coagulation:'Гемостаз', metabolic:'Метаболизм', hormonal:'Гормоны', mineral:'Минералы/Витамины'
};
const SYSTEM_ICONS: Record<string,string> = {
  hepatic:'\uD83C\uDF4E', renal:'\uD83D\uDCA7', cardio:'\u2764\uFE0F', hematologic:'\uD83D\uDD0C',
  coagulation:'\uD83E\uDE78', metabolic:'\u2697\uFE0F', hormonal:'\uD83C\uDF1F', mineral:'\uD83D\uDC8A'
};

/* ──────────────── HELPERS ──────────────── */
const ORGANS_H: Record<string, { label: string; systems: string[]; kw: string[] }> = {
  hepatic: { label: 'Печень', systems: ['hepatic'], kw: ['hepatotox', 'liver', 'печень', 'ALT', 'AST', 'ГГТ', 'трансаминазы', 'желчеотток'] },
  renal: { label: 'Почки', systems: ['renal'], kw: ['nephrotox', 'kidney', 'почк', 'creatinine', 'креатинин', 'мочев'] },
  cardio: { label: 'ССС', systems: ['cardio'], kw: ['cardiotox', 'blood pressure', 'heart', 'pressure', 'давление', 'ЧСС', 'тромб', 'аритм'] },
  cns: { label: 'ЦНС', systems: ['cns'], kw: ['neuro', 'nervous', 'мозг', 'голов', 'cns', 'седат', 'стимул'] },
  gi: { label: 'ЖКТ', systems: ['gi'], kw: ['gastric', 'stomach', 'желуд', 'кишеч', 'гит', 'гастр', 'язв'] },
};
function calcOrganLoad(ids: string[]) {
  const r: Record<string, { score: number; items: string[] }> = {};
  Object.entries(ORGANS_H).forEach(([k, o]) => {
    const items: string[] = [];
    ids.forEach(id => {
      const e = SUPPORT_CATALOG_DATA[id]; if (!e) return;
      const txt = [e.description||'', ...(e.specialInstructions||[]), ...(e.contraindications||[]), ...(e.sideEffects||[])].join(' ').toLowerCase();
      if (o.kw.some(w => txt.includes(w))) items.push(e.nameRu||e.name||id);
    });
    r[k] = { score: Math.min(items.length, 5), items };
  });
  return r;
}

function resolveSubName(id: string): string {
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  return e?.nameRu || e?.name || id;
}
function shortN(id: string, maxLen: number = 8): string {
  const n = resolveSubName(id);
  return n.length > maxLen ? n.substring(0, maxLen - 1) + '...' : n;
}

/* ──────────────── PAIR DB ──────────────── */
function buildGlobalPairDB() {
  const subs: SubstanceEntry[] = [];
  const idList: { id: string; name: string }[] = [];
  for (const k of Object.keys(SUPPORT_CATALOG_DATA)) {
    const e: any = (SUPPORT_CATALOG_DATA as any)[k];
    if (!e||!e.id) continue;
    subs.push({ id: e.id, name: e.nameRu||e.name||e.id, category: Array.isArray(e.category) ? e.category.join('/') : (e.category||''), mechanisms: e.mechanisms||[], risks: [] });
    idList.push({ id: e.id, name: e.nameRu||e.name||e.id });
  }
  const db: MasterDB = { effects: [], substances: subs, interactions: [], goals: [], stackTemplates: [], stacks: [], analyses: [], organs: [], systems: [], mechanisms: [], axes: [], risks: [], recommendations: [], tags: [], bands: [], brands: [], aliases: {}, substanceGroups: {}, effectGroups: {}, synergyMatrix: {}, conflictMatrix: {} };
  return { db, substances: subs, idList: idList.sort((a,b)=>a.name.localeCompare(b.name)) };
}
const GLOBAL_PAIR_DB = buildGlobalPairDB();
const pairSubById: Record<string, SubstanceEntry> = {};
GLOBAL_PAIR_DB.substances.forEach(s => { pairSubById[s.id] = s; });
const PAIR_LEVEL_RU: Record<string,string> = { STRONG_SYNERGY:'Сильная синергия', GOOD_SYNERGY:'Хорошая синергия', NEUTRAL:'Нейтрально', WEAK_CONFLICT:'Слабый конфликт', DANGEROUS_CONFLICT:'Опасный конфликт' };
const LEVEL_COLORS: Record<string,string> = { excellent:'#22c55e', good:'#4ade80', moderate:'#f59e0b', poor:'#ef4444', risky:'#dc2626' };
const LEVEL_LABELS: Record<string,string> = { excellent:'Отлично', good:'Хорошо', moderate:'Умеренно', poor:'Плохо', risky:'Опасно' };
const CELL_COLOR = (t:string) => t==='synergy'?'#22c55e':t==='conflict'?'#ef4444':t==='caution'?'#f59e0b':'rgba(255,255,255,0.15)';
const CELL_EMOJI = (t:string) => t==='synergy'?'\u2295':t==='conflict'?'\u2296':t==='caution'?'\u26a0':'\u00b7';
const sevW: Record<string,number> = { HIGH:3, MEDIUM:2, LOW:1 };

const cardStyle: React.CSSProperties = { background:'rgba(24,24,27,0.6)', borderRadius:12, padding:14, border:'1px solid rgba(255,255,255,0.06)', marginBottom:8 };
const pillStyle = (a:boolean,c?:string): React.CSSProperties => ({ padding:'5px 12px',borderRadius:16,fontSize:9,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,background:a?(c||'var(--accent)'):'var(--bg-secondary)',color:a?'#000':'var(--text-dim)',border:'1px solid '+(a?(c||'var(--accent)'):'var(--border)'),transition:'all 0.15s' });
const inputBase: React.CSSProperties = { width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box' };

/* ──────────────── LAB MARKER MAPPING ──────────────── */
// Russian name tokens → English marker code (for catalog fallback resolution)
const RU_MARKER_TO_EN: Record<string, string> = {
  'алт':'ALT','аст':'AST','ггт':'GGT','билирубин':'BILIRUBIN','щелочная':'ALP',
  'креатинин':'CREATININE','мочевин':'UREA','мочевая кислота':'URIC_ACID','кфк':'CK',
  'глюкоз':'GLUCOSE','инсулин':'INSULIN','гомоцистеин':'HOMOCYSTEINE','нba1c':'HBA1C','гликирован': 'HBA1C',
  'триглицерид':'TRIGLYCERIDES','ldl':'LDL','hdl':'HDL','холестерин':'CHOLESTEROL_TOTAL','общий холестерин':'CHOLESTEROL_TOTAL',
  'давление':'BP_SYSTOLIC','чсс':'HR','артериальн':'BP_SYSTOLIC',
  'гематокр':'HEMATOCRIT','гемоглобин':'HEMOGLOBIN','ферритин':'FERRITIN','тромбоцит':'THROMBOCYTES','эритроцит':'ERYTHROCYTES',
  'калий':'POTASSIUM','натрий':'SODIUM','кальций':'CALCIUM','магний':'MAGNESIUM','витамин d':'VITAMIN_D','витамин b12':'B12','железо':'IRON',
  'эстрадиол':'ESTRADIOL','пролактин':'PROLACTIN','ттг':'TSH','т3 свободный':'T3','т4 свободный':'T4','кортизол':'CORTISOL','тестостерон':'TESTOSTERONE_TOTAL',
  'лг':'LH','фсг':'FSH','прогестерон':'PROGESTERONE','дгт':'DHT','срб':'CRP','hs-срб':'CRP',
  'инр':'INR','фибриноген':'FIBRINOGEN','d-димер':'D_DIMER','тм:':'TM','протеин':'PROTEIN',
};
// Canonical marker code → system (mirrors LAB_MECHANISM_MAP from lab-analysis.engine.ts)
const MARKER_SYSTEM: Record<string, string> = {
  TESTOSTERONE_TOTAL:'hormonal',TESTOSTERONE_FREE:'hormonal',ESTRADIOL:'hormonal',PROLACTIN:'hormonal',
  LH:'hormonal',FSH:'hormonal',PROGESTERONE:'hormonal',DHT:'hormonal',
  TSH:'hormonal',T3:'hormonal',T4:'hormonal',CORTISOL:'hormonal',
  ALT:'hepatic',AST:'hepatic',GGT:'hepatic',BILIRUBIN:'hepatic',ALP:'hepatic',
  CREATININE:'renal',UREA:'renal',URIC_ACID:'renal',
  GLUCOSE:'metabolic',INSULIN:'metabolic',HOMOCYSTEINE:'metabolic',HBA1C:'metabolic',
  LDL:'cardio',HDL:'cardio',TRIGLYCERIDES:'cardio',CHOLESTEROL_TOTAL:'cardio',
  BP_SYSTOLIC:'cardio',BP_DIASTOLIC:'cardio',HR:'cardio',CRP:'cardio',APOB:'cardio',
  HEMATOCRIT:'hematologic',HEMOGLOBIN:'hematologic',FERRITIN:'hematologic',
  ERYTHROCYTES:'hematologic',THROMBOCYTES:'hematologic',LEUKOCYTES:'hematologic',
  INR:'coagulation',FIBRINOGEN:'coagulation',D_DIMER:'coagulation',
  POTASSIUM:'mineral',SODIUM:'mineral',CALCIUM:'mineral',MAGNESIUM:'mineral',
  IRON:'mineral',VITAMIN_D:'mineral',B12:'mineral',ZINC:'mineral',COPPER:'mineral',
};

const CYP_ENZYMES: Record<string, string[]> = {
  CYP3A4: ['BERBERINE','QUERCETIN','ST_JOHNS_WORT','GREEN_TEA_EGCG','GINSENG','ASHWAGANDHA','GINKGO','RESVERATROL','SILYMARIN','NARINGIN','CURCUMIN','TUDCA','GLYCYRRHIZINIC','PIROXICAM','TELMISARTAN','NEBIVOLOL','NADOLOL'],
  CYP2D6: ['BERBERINE','ST_JOHNS_WORT','RESVERATROL','GREEN_TEA_EGCG','GINKGO','CURCUMIN','BETA_ALANINE','ASHWAGANDHA','GINSENG','NEBIVOLOL','METOPROLOL','CARVEDILOL'],
  CYP2C9: ['BERBERINE','RESVERATROL','GINKGO','ST_JOHNS_WORT','ASHWAGANDHA','CURCUMIN','TELMISARTAN','IBUPROFEN','PIROXICAM','VITAMIN_E','OMEGA3','NATTOKINASE'],
  CYP2C19: ['BERBERINE','ST_JOHNS_WORT','CURCUMIN','RESVERATROL','GREEN_TEA_EGCG','GINKGO','ASHWAGANDHA','OMEGA3','MELATONIN'],
  CYP1A2: ['CURCUMIN','CAFFEINE','QUERCETIN','GREEN_TEA_EGCG','GINKGO','ST_JOHNS_WORT','NARINGIN','MELATONIN','BETA_ALANINE','GRAPE_SEED','GINSENG'],
  CYP2E1: ['NAC','RESVERATROL','QUERCETIN','CURCUMIN','GREEN_TEA_EGCG','GINGER','GARLIC','OMEGA3','GINSENG'],
  CYP3A5: ['BERBERINE','CURCUMIN','ASHWAGANDHA','TELMISARTAN','NEBIVOLOL','GREEN_TEA_EGCG'],
};

function findCYPForSubstance(id: string): string[] {
  const upper = id.toUpperCase();
  const found: string[] = [];
  for (const [enz, subs] of Object.entries(CYP_ENZYMES)) {
    if (subs.some(s => upper.includes(s) || s.includes(upper))) found.push(enz);
  }
  return found;
}

/* ──────────────── MAIN COMPONENT ──────────────── */
export const UnifiedSynergyCalculator: React.FC<{ s?: Record<string,any> }> = ({ s }) => {
  const [interactIds, setInteractIds] = useState<string[]>(() => { try { const p = JSON.parse(localStorage.getItem('he_unified_ids')||'null'); return Array.isArray(p)&&p.length>0 ? p : ['','','']; } catch { return ['','','']; } });
  const [interactSearch, setInteractSearch] = useState('');
  const [interactSearchIdx, setInteractSearchIdx] = useState(-1);
  useEffect(() => { localStorage.setItem('he_unified_ids', JSON.stringify(interactIds)); }, [interactIds]);

  // Deep-dive pair state
  const [deepPair, setDeepPair] = useState<{ a: string; b: string } | null>(null);

  const allSubstances = useMemo(() =>
    Object.entries(SUPPORT_CATALOG_DATA).map(([id,e])=>({ id, name: e.nameRu||e.name||id })).sort((a,b)=>a.name.localeCompare(b.name)), []);

  const addSlot = () => { if (interactIds.length<10) setInteractIds([...interactIds,'']); };
  const updateSlot = (idx:number, v:string) => { const n=[...interactIds]; n[idx]=v; setInteractIds(n); setInteractSearch(''); setInteractSearchIdx(-1); };
  const validIds = interactIds.filter(Boolean);

  // ── Stack analysis ──
  const stackScore = useMemo(() => validIds.length>=2 ? calcStackSynergyScore(validIds) : null, [validIds]);

  // Extra catalog pairs (for enrichment beyond ALL_INTERACTIONS)
  const catalogPairs = useMemo(() => {
    if (validIds.length<2) return [];
    const pairs: Array<{ a:string;b:string;aName:string;bName:string;type:string;severity:string;effect:string;mechanism?:string }> = [];
    const seen = new Set<string>();
    for (const id of validIds) {
      const entry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
      if (!entry) continue;
      const aName = entry.nameRu || entry.name || id;
      const checkPairs = (arr: Array<{ with:string; effect?:string; severity?:string; mechanism?:string }> | undefined, pType: string) => {
        for (const p of (arr||[])) {
          const wId = (p.with||'').toLowerCase();
          if (!wId) continue;
          const mId = validIds.find(sid => sid.toLowerCase()===wId || sid.toLowerCase().replace(/_/g,'')===wId.replace(/_/g,''));
          if (!mId) continue;
          const pk = [aName, mId].sort().join('||');
          if (seen.has(pk)) continue; seen.add(pk);
          const bEntry = SUPPORT_CATALOG_DATA[mId] || SUPPORT_CATALOG_DATA[mId.toUpperCase()];
          pairs.push({ a:id, b:mId, aName, bName: bEntry?.nameRu||bEntry?.name||mId, type:pType, severity:(p as any).severity||'MEDIUM', effect:(p as any).effect||'', mechanism:(p as any).mechanism||'' });
        }
      };
      checkPairs(entry.synergies||[], 'synergy');
      checkPairs(entry.conflicts||[], 'conflict');
      if ((entry as any).cautions) checkPairs((entry as any).cautions, 'caution');
    }
    return pairs;
  }, [validIds]);

  // Enrich stack matrix with catalog pairs + fallback shared mechanisms
  const enrichedMatrix = useMemo(() => {
    if (!stackScore) return [];
    const existingKeys = new Set(stackScore.matrix.map((m:any)=>[m.a.toLowerCase(),m.b.toLowerCase()].sort().join('||')));
    const merged = [...stackScore.matrix];
    for (const cp of catalogPairs) {
      const key = [cp.a.toLowerCase(), cp.b.toLowerCase()].sort().join('||');
      if (!existingKeys.has(key)) { existingKeys.add(key); merged.push(cp); }
    }
    // Fallback: fill missing pairs with shared mechanisms
    for (let i = 0; i < validIds.length; i++) {
      for (let j = i + 1; j < validIds.length; j++) {
        const key = [validIds[i].toLowerCase(), validIds[j].toLowerCase()].sort().join('||');
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const aEntry = SUPPORT_CATALOG_DATA[validIds[i]] || SUPPORT_CATALOG_DATA[validIds[i].toUpperCase()];
        const bEntry = SUPPORT_CATALOG_DATA[validIds[j]] || SUPPORT_CATALOG_DATA[validIds[j].toUpperCase()];
        if (!aEntry || !bEntry) continue;
        const shared = (aEntry.mechanisms||[]).filter((m:string)=>(bEntry.mechanisms||[]).includes(m));
        if (shared.length === 0) {
          merged.push({ a: validIds[i], b: validIds[j], aName: aEntry.nameRu||aEntry.name||validIds[i], bName: bEntry.nameRu||bEntry.name||validIds[j], type: 'caution', severity: 'LOW', effect: 'Нет известных взаимодействий. Общих механизмов не обнаружено — комбинируйте с осторожностью.', mechanism: '' } as any);
        } else {
          merged.push({ a: validIds[i], b: validIds[j], aName: aEntry.nameRu||aEntry.name||validIds[i], bName: bEntry.nameRu||bEntry.name||validIds[j], type: 'synergy', severity: 'LOW', effect: `Общие механизмы: ${shared.join(', ')}. Потенциальная синергия через эти пути.`, mechanism: shared.join('; ') } as any);
        }
      }
    }
    return merged.sort((x:any,y:any) => (sevW[y.severity]||1) - (sevW[x.severity]||1));
  }, [stackScore, catalogPairs, validIds]);

  // ── Clinical data from display.ts ──
  const conflictData = useMemo(() => validIds.length>=2 ? buildConflicts(validIds) : [], [validIds]);
  const cautionData = useMemo(() => validIds.length>=2 ? buildCautions(validIds) : [], [validIds]);
  const specialInstr = useMemo(() => validIds.length>=2 ? buildSpecialInstructions(validIds) : [], [validIds]);

  // ── Depletion warnings ──
  const depletionData = useMemo(() => {
    if (validIds.length<2) return [];
    const idSet = new Set(validIds.map(id=>id.toUpperCase()));
    const out: typeof DEPLETION_DB = [];
    for (const d of DEPLETION_DB) {
      if (idSet.has(d.depleter) && idSet.has(d.depleted) ||
          idSet.has(d.depleted) && idSet.has(d.depleter)) {
        if (!out.some(x=>x.depleter===d.depleter && x.depleted===d.depleted)) out.push(d);
      }
    }
    return out;
  }, [validIds]);

  // ── Cumulative load ──
  const cumulativeLoad = useMemo(() => {
    const loads: Record<string, { total: number; ul: number; sources: string[] }> = {};
    for (const id of validIds) {
      const entry = SUPPORT_CATALOG_DATA[id]; if (!entry) continue;
      const ru = entry.nameRu||entry.name||id;
      // Estimate mineral/vitamin content from dosage forms or description
      const txt = (entry.description||'').toLowerCase() + ' ' + (entry.nameRu||entry.name||'').toLowerCase();
      for (const [nutr, ul] of Object.entries(UL_DB)) {
        const nutrLower = nutr.toLowerCase();
        const synonyms: Record<string,string[]> = {
          zinc:['цинк','zinc','zn'], selenium:['селен','selenium','se'], copper:['медь','copper','cu'],
          iron:['железо','iron','fe'], calcium:['кальций','calcium','ca'], magnesium:['магний','magnesium','mg'],
          vitamin_a:['витамин а','вит.а','vitamin a','ретинол'], vitamin_d:['витамин d','вит.d','vitamin d','d3','холекальциферол'],
          vitamin_e:['витамин e','вит.e','vitamin e','токоферол'], vitamin_c:['витамин c','вит.c','vitamin c','аскорб'],
          iodine:['йод','иод','iodine'], chromium:['хром','chromium'], manganese:['марганец','manganese'], boron:['бор','boron'],
          potassium:['калий','potassium','k+'],
        };
        const keywords = synonyms[nutrLower] || [nutrLower];
        if (keywords.some(kw=>txt.includes(kw))) {
          if (!loads[nutrLower]) loads[nutrLower] = { total:0, ul, sources:[] };
          loads[nutrLower].sources.push(ru);
          loads[nutrLower].total += 1; // qualitative marker
        }
      }
    }
    return Object.entries(loads).map(([k,v]) => ({ nutrient:k, ...v, isOverUL:v.total>v.ul })).sort((a,b)=>b.total-a.total);
  }, [validIds]);

  // ── Pill burden ──
  const pillBurden = useMemo(() => {
    const n = validIds.length;
    if (n===0) return null;
    let f: 'optimal'|'acceptable'|'high'|'excessive' = 'optimal';
    let msg = '';
    if (n<=6) { f='optimal'; msg='Компактный план. Высокая приверженность.'; }
    else if (n<=12) { f='acceptable'; msg='Средняя нагрузка. Рекомендуется разделить на 3-4 временных блока.'; }
    else if (n<=20) { f='high'; msg='Высокая нагрузка. Рассмотрите приоритезацию ключевых веществ.'; }
    else { f='excessive'; msg='Чрезмерная нагрузка (>20 веществ). Сократите до 10-12 ключевых.'; }
    return { total:n, feasibility:f, message:msg };
  }, [validIds]);

  // ── Lab monitoring ──
  const labMonitor: LabMon[] = useMemo(() => {
    if (validIds.length===0) return [];
    const collected: LabMon[] = [];
    const seen = new Set<string>();
    for (const id of validIds) {
      // Explicit DB entries
      const dbEntry = LAB_MONITOR_DB[id] || [];
      for (const item of dbEntry) {
        const key = item.markerEn + '|' + (item.condition || '');
        if (!seen.has(key)) { seen.add(key); collected.push(item); }
      }
      // Fallback to catalog monitoring
      const cat = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
      if (cat?.monitoring?.length > 0) {
        for (const m of cat.monitoring) {
          const what = (m.what||'').toLowerCase().trim();
          if (!what) continue;
          const key = 'cat|'+what;
          if (seen.has(key)) continue;
          seen.add(key);
          // Determine system from marker name (via RU_MARKER_TO_EN + MARKER_SYSTEM)
          let resolvedEn = '';
          for (const [ruToken, enCode] of Object.entries(RU_MARKER_TO_EN)) {
            if (what.includes(ruToken)) { resolvedEn = enCode; break; }
          }
          const sys = MARKER_SYSTEM[resolvedEn] || 'metabolic';
          const organNote = resolvedEn ? `Маркер: ${resolvedEn}. ` : '';
          collected.push({ markerRu: m.what||'', markerEn: resolvedEn, system: sys, when: m.when||'', target: m.targetRange||'',
            condition: organNote ? `Контроль по каталогу (${resolvedEn})` : 'По каталогу',
            note: organNote + 'Контроль '+(m.what||'')+'. '+(m.targetRange?'Цель: '+m.targetRange+'. ':'')+'Регулярность: '+(m.when||'') });
        }
      }
    }
    return collected;
  }, [validIds]);

  // ── CYP450 map ──
  const cypMap = useMemo(() => {
    if (validIds.length===0) return [];
    const map: Record<string, string[]> = {};
    for (const id of validIds) {
      const enz = findCYPForSubstance(id);
      if (enz.length>0) map[id] = enz;
    }
    return Object.entries(map).map(([id,enz]) => ({ id, name: resolveSubName(id), enzymes: enz }));
  }, [validIds]);

  // ── Pair deep analysis helper ──
  const getPairDetail = useCallback((aId: string, bId: string) => {
    const a = pairSubById[aId]; const b = pairSubById[bId];
    if (!a||!b) return null;

    // Try to find interaction in ALL_INTERACTIONS / enrich
    const norm = (s:string)=>s.toLowerCase().replace(/[_\-\s]/g,'');
    const aNorm = norm(aId); const bNorm = norm(bId);
    let interId = '';
    for (const inter of ALL_INTERACTIONS) {
      const iA = norm(inter.substanceA); const iB = norm(inter.substanceB);
      if ((iA===aNorm && iB===bNorm) || (iA===bNorm && iB===aNorm)) {
        interId = inter.interactionId || '';
        break;
      }
    }

    const pairRes = SynergyEngine.calculatePair(a, b, GLOBAL_PAIR_DB.db);
    const sharedMechs = (a.mechanisms||[]).filter(m=>(b.mechanisms||[]).includes(m));
    const enrich = interId ? (INTERACTION_ENRICHMENT as any)[interId] : null;

    // Find conflict data from display
    const confData = conflictData.find(c =>
      (norm(c.a)===aNorm && norm(c.b)===bNorm) || (norm(c.a)===bNorm && norm(c.b)===aNorm)
    );
    const cautData = cautionData.find(c =>
      (norm(c.a)===aNorm && norm(c.b)===bNorm) || (norm(c.a)===bNorm && norm(c.b)===aNorm)
    );

    // Find pair in matrix
    const matrixEntry = enrichedMatrix.find((m:any) =>
      (norm(m.a)===aNorm && norm(m.b)===bNorm) || (norm(m.a)===bNorm && norm(m.b)===aNorm)
    );

    // Collect catalog data from entries
    const aEntry = SUPPORT_CATALOG_DATA[aId] || SUPPORT_CATALOG_DATA[aId.toUpperCase()];
    const bEntry = SUPPORT_CATALOG_DATA[bId] || SUPPORT_CATALOG_DATA[bId.toUpperCase()];
    const aSyn = (aEntry?.synergies||[]).filter((x:any)=> {
      const wn = norm(x.with||'');
      return wn===bNorm || wn===aNorm;
    });
    const bSyn = (bEntry?.synergies||[]).filter((x:any)=> {
      const wn = norm(x.with||'');
      return wn===aNorm || wn===bNorm;
    });
    const allPairSyn = [...aSyn, ...bSyn];
    const aConf = (aEntry?.conflicts||[]).filter((x:any)=> {
      const wn = norm(x.with||'');
      return wn===bNorm || wn===aNorm;
    });
    const bConf = (bEntry?.conflicts||[]).filter((x:any)=> {
      const wn = norm(x.with||'');
      return wn===aNorm || wn===bNorm;
    });
    const allPairConf = [...aConf, ...bConf];

    return { interId, pairRes, sharedMechs, enrich, confData, cautData, matrixEntry, allPairSyn, allPairConf };
  }, [conflictData, cautionData, enrichedMatrix]);

  const suggestions = useMemo(() => validIds.length>=2 ? suggestSynergyAdditions(validIds, 5) : [], [validIds]);

  const pairCell = useCallback((a:string,b:string) => {
    if (a===b||!stackScore) return null;
    return enrichedMatrix.find((m:any) =>
      (m.a===a&&m.b===b)||(m.a===b&&m.b===a)||
      (m.a.toLowerCase()===a.toLowerCase()&&m.b.toLowerCase()===b.toLowerCase())||
      (m.a.toLowerCase()===b.toLowerCase()&&m.b.toLowerCase()===a.toLowerCase())
    ) || null;
  }, [enrichedMatrix, stackScore]);

  // Total enriched score
  const enrichedScore = useMemo(() => {
    if (!stackScore) return null;
    const synW = enrichedMatrix.filter((m:any)=>m.type==='synergy').length;
    const confW = enrichedMatrix.filter((m:any)=>m.type==='conflict').length;
    const cautW = enrichedMatrix.filter((m:any)=>m.type==='caution').length;
    const n = validIds.length;
    const total = n*(n-1)/2;
    const known = enrichedMatrix.length;
    let score = 50 + (synW * 10) - (confW * 12) - (cautW * 4);
    score = Math.max(0, Math.min(100, Math.round(score)));
    let level = 'moderate';
    if (confW >= synW && confW > 0) level = 'risky';
    else if (score >= 80) level = 'excellent';
    else if (score >= 65) level = 'good';
    else if (score >= 45) level = 'moderate';
    else if (score >= 30) level = 'poor';
    else level = 'risky';
    return { score, level, synergies:synW, conflicts:confW, cautions:cautW, totalPairs:total, knownPairs:known };
  }, [enrichedMatrix, validIds, stackScore]);

  // ── Drug check state ──
  // ── Interactions browser ──
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseSeverity, setBrowseSeverity] = useState('all');
  const mergedInteractions: any[] = s?.mergedInteractions || [];
  const browseFiltered = useMemo(() => {
    let list = mergedInteractions;
    if (browseSeverity!=='all') list = list.filter((i:any)=>i.severity===browseSeverity);
    if (browseSearch) {
      const q = browseSearch.toLowerCase();
      list = list.filter((i:any) =>
        (i.effect||'').toLowerCase().includes(q)||
        (i.substanceA||'').toLowerCase().includes(q)||
        (i.substanceB||'').toLowerCase().includes(q)||
        (i.notes||'').toLowerCase().includes(q)||
        (resolveSubName(i.substanceA||'')||'').toLowerCase().includes(q)||
        (resolveSubName(i.substanceB||'')||'').toLowerCase().includes(q));
    }
    if (validIds.length>0) {
      const idSet = new Set(validIds.map(id=>id.toLowerCase()));
      list = list.filter((i:any)=> idSet.has((i.substanceA||'').toLowerCase()) || idSet.has((i.substanceB||'').toLowerCase()));
    }
    return list;
  }, [mergedInteractions, browseSearch, browseSeverity, validIds]);
  const enrichmentData = useMemo(() => { try { return INTERACTION_ENRICHMENT; } catch { return {} as Record<string,any>; } }, []);

  /* ──────────────── RENDER ──────────────── */
  return (
    <div className="sup-synergy" style={{ padding:'4px 0 100px', display:'flex', flexDirection:'column', gap:10 }}>
      {/* Header */}
      <div style={{ marginBottom:2 }}>
        <div style={{ fontSize:14, fontWeight:800, color:'#00e68a', letterSpacing:'-0.3px' }}>Калькулятор синергии и взаимодействий</div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:2, lineHeight:1.3 }}>
          Полный клинический анализ: совместимость, механизмы взаимодействий, органная нагрузка, истощения, CYP450, лекарственные риски
        </div>
      </div>

      {/* ─── SECTION 1: SUBSTANCE SELECTOR ─── */}
      <div style={cardStyle}>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:4 }}>Выберите вещества (до 10)</div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
          Выберите БАДы/препараты из каталога. При выборе 2+ появляется полный анализ стека: совместимость, конфликты, истощения, нагрузка.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {interactIds.map((id, idx) => {
            const entry = id?(SUPPORT_CATALOG_DATA[id]||SUPPORT_CATALOG_DATA[id.toUpperCase()]):null;
            const selectedName = entry?.nameRu||entry?.name||id||'';
            return (
              <div key={idx} style={{ background:'rgba(12,12,14,0.6)', borderRadius:10, padding:'8px 10px', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', fontWeight:600, background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>#{idx+1}</span>
                  <span style={{ flex:1, fontSize:9, color:'rgba(255,255,255,0.4)' }}>{id?selectedName:'Вещество'}</span>
                  {id&&<button onClick={()=>updateSlot(idx,'')} style={{ padding:'2px 6px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>x</button>}
                </div>
                <div style={{ position:'relative' }}>
                  {id ? (
                    <div style={{ padding:'7px 8px', borderRadius:6, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', fontSize:10, fontWeight:600 }}>{selectedName}</div>
                  ) : (
                    <>
                      <input value={interactSearchIdx===idx?interactSearch:''} placeholder="Поиск по названию..."
                        onFocus={()=>{setInteractSearchIdx(idx);setInteractSearch('');}}
                        onChange={e=>{setInteractSearchIdx(idx);setInteractSearch(e.target.value);}}
                        style={{...inputBase, padding:'7px 8px'}} />
                      {interactSearch&&interactSearchIdx===idx&&(
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, maxHeight:160, overflowY:'auto', marginTop:1 }}>
                          {allSubstances.filter(s=>s.name.toLowerCase().includes(interactSearch.toLowerCase())).slice(0,12).map(s=>(
                            <div key={s.id} onClick={()=>updateSlot(idx,s.id)} style={{ padding:'8px 10px', cursor:'pointer', fontSize:10, borderBottom:'1px solid rgba(255,255,255,0.05)', color:'#fff' }}>
                              <span style={{ fontWeight:600 }}>{s.name}</span>
                              <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', marginLeft:6 }}>{s.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <button onClick={addSlot} disabled={interactIds.length>=10}
              style={{ flex:1, padding:'9px', borderRadius:8, fontSize:10, fontWeight:600, cursor:interactIds.length>=10?'not-allowed':'pointer',
                background:'rgba(0,230,138,0.06)', border:'1px dashed rgba(0,230,138,0.3)', color:interactIds.length>=10?'#666':'#00e68a', opacity:interactIds.length>=10?0.5:1 }}>
              + Добавить вещество
            </button>
            <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>{interactIds.length}/10</span>
          </div>
        </div>
      </div>

      {/* ─── NO SELECTION ─── */}
      {validIds.length<2&&interactIds.length>0&&(
        <div style={{ textAlign:'center', padding:'24px 12px', background:'rgba(24,24,27,0.6)', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:24, marginBottom:6 }}>+</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>Выберите минимум 2 вещества для анализа</div>
        </div>
      )}
      {validIds.length<2&&interactIds.length===0&&(
        <div style={{ textAlign:'center', padding:'24px 12px', background:'rgba(24,24,27,0.6)', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:24, marginBottom:6 }}>+</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>Добавьте вещества для начала анализа</div>
        </div>
      )}

      {/* ════════════════ STACK ANALYSIS ════════════════ */}
      {enrichedScore&&validIds.length>=2&&(
        <>
          {/* ─── Score + Quick stats ─── */}
          <div style={{ background:'rgba(24,24,27,0.8)', borderRadius:12, padding:14, border:`2px solid ${LEVEL_COLORS[enrichedScore.level]}44`, marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:800, color:LEVEL_COLORS[enrichedScore.level] }}>Совместимость стека</div>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:22, fontWeight:800, color:LEVEL_COLORS[enrichedScore.level] }}>{enrichedScore.score}</span>
                <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)' }}>/ 100</span>
                <span style={{ fontSize:8, padding:'2px 10px', borderRadius:6, background:LEVEL_COLORS[enrichedScore.level]+'22', color:LEVEL_COLORS[enrichedScore.level], fontWeight:700 }}>{LEVEL_LABELS[enrichedScore.level]}</span>
              </div>
            </div>
            <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:8 }}>
              <div style={{ width:enrichedScore.score+'%', height:'100%', background:LEVEL_COLORS[enrichedScore.level], borderRadius:3, transition:'width 0.3s' }} />
            </div>
            <div style={{ display:'flex', gap:10, fontSize:8, color:'rgba(255,255,255,0.4)', flexWrap:'wrap' }}>
              <span style={{ color:'#22c55e' }}>{enrichedScore.synergies} синергий</span>
              <span style={{ color:'#ef4444' }}>{enrichedScore.conflicts} конфликтов</span>
              <span style={{ color:'#f59e0b' }}>{enrichedScore.cautions} осторожностей</span>
              <span style={{ color:'rgba(255,255,255,0.3)' }}>{enrichedScore.knownPairs}/{enrichedScore.totalPairs} пар известны</span>
            </div>
          </div>

          {/* ─── Interaction matrix (clickable for deep-dive) ─── */}
          {validIds.length<=8&&(
            <div style={{...cardStyle, overflowX:'auto'}}>
              <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:4 }}>Матрица совместимости (кликните ячейку для деталей)</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginBottom:6, lineHeight:1.3 }}>Нажмите на ячейку, чтобы увидеть клинический механизм, дозировки, предупреждения и рекомендации по разделению.</div>
              <div style={{ display:'inline-block' }}>
                <div style={{ display:'grid', gridTemplateColumns:`40px repeat(${validIds.length}, 36px)`, gap:0 }}>
                  <div style={{ padding:'2px', background:'rgba(0,0,0,0.2)' }} />
                  {validIds.map((id,ci)=>(<div key={ci} style={{ padding:'2px', background:'rgba(0,0,0,0.2)', fontSize:5, color:'rgba(255,255,255,0.35)', textAlign:'center', writingMode:validIds.length>5?'vertical-rl':'horizontal-tb', transform:validIds.length>5?'rotate(180deg)':'none', lineHeight:1.1, overflow:'hidden' }}>{shortN(id)}</div>))}
                  {validIds.map((rowId,ri)=>(
                    <React.Fragment key={ri}>
                      <div style={{ padding:'2px 4px', background:'rgba(0,0,0,0.2)', fontSize:5, color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', justifyContent:'flex-end', overflow:'hidden' }}>
                        {shortN(rowId)}
                      </div>
                      {validIds.map((colId,ci)=>{
                        const cell = pairCell(rowId,colId);
                        const isDeep = deepPair && ((deepPair.a===rowId&&deepPair.b===colId)||(deepPair.a===colId&&deepPair.b===rowId));
                        return (
                          <div key={ci} style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
                            background:cell?CELL_COLOR(cell.type)+'15':'rgba(255,255,255,0.02)',
                            border:isDeep?`2px solid ${CELL_COLOR(cell?.type||'')||'#a855f7'}`:'1px solid rgba(255,255,255,0.04)',
                            fontSize:8, color:cell?CELL_COLOR(cell.type):'rgba(255,255,255,0.15)', fontWeight:700,
                            cursor:rowId!==colId?'pointer':'default',
                            boxShadow:isDeep?`0 0 8px ${CELL_COLOR(cell?.type||'')||'#a855f7'}44`:'none' }}
                            onClick={()=>{if(rowId!==colId){setDeepPair(isDeep?null:{a:rowId,b:colId})}}}
                            title={cell?`${cell.aName}+${cell.bName}: ${cell.effect||''}`:''}>
                            {cell?CELL_EMOJI(cell.type):'\u00b7'}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4, fontSize:6, color:'rgba(255,255,255,0.3)' }}>
                <span><span style={{ color:'#22c55e', fontWeight:700 }}>{CELL_EMOJI('synergy')}</span> синергия</span>
                <span><span style={{ color:'#ef4444', fontWeight:700 }}>{CELL_EMOJI('conflict')}</span> конфликт</span>
                <span><span style={{ color:'#f59e0b', fontWeight:700 }}>{CELL_EMOJI('caution')}</span> осторожность</span>
                <span><span style={{ color:'rgba(255,255,255,0.2)' }}>{'\u00b7'}</span> неизвестно</span>
              </div>
            </div>
          )}

          {/* ─── DEEP-DIVE PAIR PANEL ─── */}
          {deepPair&&(()=>{
            const detail = getPairDetail(deepPair.a, deepPair.b);
            if (!detail) return null;
            const { interId, pairRes, sharedMechs, enrich, confData, cautData, matrixEntry, allPairSyn, allPairConf } = detail;
            const aName = resolveSubName(deepPair.a);
            const bName = resolveSubName(deepPair.b);
            const isSyn = pairRes?.level?.includes('SYNERGY');
            const isConf = pairRes?.level?.includes('CONFLICT');
            const typeColor = isSyn?'#22c55e':isConf?'#ef4444':'#94a3b8';
            return (
              <div style={{ background:typeColor+'08', borderRadius:12, padding:14, border:`1px solid ${typeColor}25`, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:typeColor }}>{aName} + {bName}</div>
                  <button onClick={()=>setDeepPair(null)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', borderRadius:4, padding:'2px 10px', fontSize:8, cursor:'pointer' }}>Закрыть</button>
                </div>

                {/* Score + level */}
                <div style={{ display:'flex', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, fontWeight:700, color:typeColor }}>{PAIR_LEVEL_RU[pairRes?.level||'']||pairRes?.level||'—'}</span>
                  {pairRes&&<span style={{ fontSize:10, color:typeColor }}>Оценка: {pairRes.score}</span>}
                  {interId&&<span style={{ fontSize:7, color:'rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.04)', padding:'1px 5px', borderRadius:3 }}>ID: {interId}</span>}
                </div>

                {/* Enrichment data (clinical) */}
                {enrich&&(
                  <div style={{ marginBottom:6 }}>
                    {enrich.riskDescription&&<div style={{ fontSize:8, color:isConf?'#ef4444':'rgba(255,255,255,0.6)', lineHeight:1.4, marginBottom:4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>{enrich.riskDescription}</div>}
                    {enrich.parameters&&<div style={{ fontSize:8, color:'#60a5fa', lineHeight:1.4, marginBottom:4, padding:'6px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.08)' }}>{enrich.parameters}</div>}
                    {enrich.mechanismRu?.length>0&&<div style={{ fontSize:7, color:'#a78bfa', lineHeight:1.3, marginBottom:4, padding:'6px 8px', borderRadius:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                      <div style={{ fontWeight:600, marginBottom:2, fontSize:7 }}>Клинические механизмы:</div>
                      {enrich.mechanismRu.map((m:string,i:number)=><div key={i} style={{ marginBottom:i<enrich.mechanismRu.length-1?2:0 }}>{i+1}. {m}</div>)}
                    </div>}
                  </div>
                )}

                {/* Shared mechanisms */}
                {sharedMechs.length>0&&!enrich&&(
                  <div style={{ marginBottom:6 }}><span style={{ fontSize:7, color:'#a78bfa', fontWeight:600 }}>Общие механизмы: </span><span style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>{sharedMechs.join(', ')}</span></div>
                )}

                {/* Conflict-specific data from display.ts */}
                {confData&&(
                  <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)' }}>
                    <div style={{ fontSize:7, fontWeight:600, color:'#ef4444', marginBottom:2 }}>Клинический механизм конфликта:</div>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>{confData.mechanism}</div>
                    {confData.separationAdvice&&<div style={{ fontSize:7, color:'#fbbf24', marginTop:2, lineHeight:1.3 }}>{confData.separationAdvice}</div>}
                  </div>
                )}
                {cautData&&(
                  <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)' }}>
                    <div style={{ fontSize:7, fontWeight:600, color:'#f59e0b', marginBottom:2 }}>Осторожность при комбинации:</div>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>{cautData.effect}</div>
                  </div>
                )}

                {/* Catalog-sourced synergy/conflict detail */}
                {allPairSyn.length>0&&!enrich&&allPairSyn.map((s:any,i:number)=>(
                  <div key={i} style={{ fontSize:7, color:'#22c55e', padding:'4px 6px', background:'rgba(34,197,94,0.04)', borderRadius:4, marginBottom:4 }}>
                    <b>Синергия:</b> {s.effect||''}{s.mechanism?` — ${s.mechanism}`:''}
                  </div>
                ))}
                {allPairConf.length>0&&!confData&&allPairConf.map((c:any,i:number)=>(
                  <div key={i} style={{ fontSize:7, color:'#ef4444', padding:'4px 6px', background:'rgba(239,68,68,0.04)', borderRadius:4, marginBottom:4 }}>
                    <b>Конфликт:</b> {c.effect||''}{c.mechanism?` — ${c.mechanism}`:''}
                  </div>
                ))}

                {/* Effect from matrix */}
                {matrixEntry?.effect&&!enrich&&!confData&&(
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', lineHeight:1.3, marginBottom:4, padding:'4px 6px', background:'rgba(255,255,255,0.02)', borderRadius:4 }}>{matrixEntry.effect}</div>
                )}

                {/* All Interactions data as fallback */}
                {!enrich&&!confData&&!cautData&&allPairSyn.length===0&&allPairConf.length===0&&(
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.25)', lineHeight:1.3 }}>Подробных клинических данных по этой паре в каталоге нет. Используйте общую матрицу совместимости выше.</div>
                )}
              </div>
            );
          })()}

          {/* ─── Conflicts & Cautions summary chip (inline, not duplicate of matrix) ─── */}
          {(conflictData.length>0||cautionData.length>0)&&(
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:0 }}>
              {conflictData.length>0&&<span style={{ fontSize:7, padding:'2px 8px', borderRadius:4, background:'rgba(239,68,68,0.12)', color:'#ef4444', fontWeight:600 }}>
                {conflictData.length} конфликтов — см. матрицу выше
              </span>}
              {cautionData.length>0&&<span style={{ fontSize:7, padding:'2px 8px', borderRadius:4, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontWeight:600 }}>
                {cautionData.length} осторожностей — см. матрицу выше
              </span>}
            </div>
          )}

          {/* ─── Depletion warnings ─── */}
          <div style={{ ...cardStyle, borderColor:'rgba(168,85,247,0.15)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:6 }}>Истощения и антагонизмы {depletionData.length>0?`(${depletionData.length})`:''}</div>
            {depletionData.length>0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {depletionData.map((d,i)=>(
                  <div key={i} style={{ padding:'6px 8px', borderRadius:8, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.1)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:8, fontWeight:600, color:'#fff' }}>{resolveSubName(d.depleter)} → {resolveSubName(d.depleted)}</span>
                      <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:d.severity==='HIGH'?'rgba(239,68,68,0.2)':'rgba(245,158,11,0.2)', color:d.severity==='HIGH'?'#ef4444':'#f59e0b', fontWeight:600 }}>{d.severity}</span>
                    </div>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', lineHeight:1.3 }}>{d.mechanism}</div>
                    <div style={{ fontSize:7, color:'#60a5fa', lineHeight:1.3, marginTop:2 }}>{d.recommendation}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', lineHeight:1.3 }}>Истощений и антагонизмов между выбранными веществами не выявлено. Комбинация безопасна по этому параметру.</div>
            )}
          </div>

          {/* ─── Cumulative load ─── */}
          <div style={{ ...cardStyle, borderColor:'rgba(96,165,250,0.15)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>Совокупная суточная нагрузка по нутриентам</div>
            {cumulativeLoad.length>0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {cumulativeLoad.map((l,i)=>{
                  const pct = l.ul>0 ? Math.round((l.total/l.ul)*100) : 0;
                  const over = l.isOverUL;
                  return (
                    <div key={i} style={{ padding:'5px 8px', borderRadius:6, background:over?'rgba(239,68,68,0.04)':'rgba(96,165,250,0.02)', border:`1px solid ${over?'rgba(239,68,68,0.1)':'rgba(96,165,250,0.06)'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:8, fontWeight:600, color:over?'#ef4444':'#60a5fa' }}>{l.nutrient.toUpperCase()}</span>
                        {over&&<span style={{ fontSize:7, color:'#ef4444', fontWeight:600 }}>⚠ Превышение UL</span>}
                      </div>
                      {l.ul>0&&<div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.04)', marginTop:3 }}>
                        <div style={{ width:Math.min(pct,100)+'%', height:'100%', borderRadius:2, background:over?'#ef4444':'#60a5fa' }} />
                      </div>}
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Источники: {l.sources.join(', ')}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', lineHeight:1.3 }}>Нутриенты в выбранных веществах не превышают верхних допустимых уровней потребления.</div>
            )}
          </div>

          {/* ─── CYP450 interactions ─── */}
          <div style={{ ...cardStyle, borderColor:'rgba(139,92,246,0.15)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>CYP450: карта ферментов</div>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', marginBottom:6, lineHeight:1.3 }}>Какие вещества влияют на ферменты цитохрома P450 — изменение метаболизма лекарств и других БАДов.</div>
            {cypMap.length>0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {cypMap.map((c,i)=>(
                  <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.08)' }}>
                    <span style={{ fontSize:8, fontWeight:600, color:'#fff' }}>{c.name}</span>
                    <div style={{ display:'flex', gap:3, marginTop:2, flexWrap:'wrap' }}>
                      {c.enzymes.map(enz=>(
                        <span key={enz} style={{ fontSize:6, padding:'1px 6px', borderRadius:3, background:'rgba(139,92,246,0.15)', color:'#a78bfa', fontWeight:600 }}>{enz}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', lineHeight:1.3 }}>Выбранные вещества не имеют известного влияния на ферменты CYP450. Стандартный метаболизм.</div>
            )}
          </div>

          {/* ─── Pill burden ─── */}
          {pillBurden&&(
            <div style={cardStyle}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:4 }}>Таблеточная нагрузка (pill burden)</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                <span style={{ fontSize:9, color:'#fff' }}>{pillBurden.total} веществ</span>
                <span style={{ fontSize:8, padding:'2px 8px', borderRadius:4, background:pillBurden.feasibility==='optimal'?'rgba(34,197,94,0.15)':pillBurden.feasibility==='acceptable'?'rgba(96,165,250,0.15)':pillBurden.feasibility==='high'?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',
                  color:pillBurden.feasibility==='optimal'?'#22c55e':pillBurden.feasibility==='acceptable'?'#60a5fa':pillBurden.feasibility==='high'?'#f59e0b':'#ef4444', fontWeight:600 }}>{pillBurden.feasibility==='optimal'?'Оптимально':pillBurden.feasibility==='acceptable'?'Приемлемо':pillBurden.feasibility==='high'?'Высокая':'Чрезмерная'}</span>
              </div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', lineHeight:1.3 }}>{pillBurden.message}</div>
            </div>
          )}

          {/* ─── Organ load ─── */}
          <div style={cardStyle}>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>Органная нагрузка</div>
            {(()=>{
              const ol = calcOrganLoad(validIds);
              return (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {(['hepatic','renal','cardio','cns','gi'] as const).map(k=>{
                    const o = ol[k]; if (!o) return null;
                    const c = o.score>=3?'#ef4444':o.score>=2?'#f59e0b':'#22c55e';
                    return (
                      <div key={k} style={{ padding:'8px 4px', borderRadius:10, background:c+'08', border:`1px solid ${c}18`, textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginBottom:2 }}>{ORGANS_H[k].label}</div>
                        <div style={{ fontSize:14, fontWeight:800, color:c }}>{o.score}/5</div>
                        <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.04)', marginTop:4 }}>
                          <div style={{ width:(o.score/5)*100+'%', height:'100%', borderRadius:2, background:c }} />
                        </div>
                        {o.items.length>0&&<div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:4, lineHeight:1.2 }}>{o.items.join(', ')}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* ─── Timing recommendations (from display.ts) ─── */}
          {specialInstr.length>0 ? (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.1)', marginBottom:8 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>Режим приёма</div>
              {specialInstr.map((t,i)=><div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:2 }}>{t}</div>)}
            </div>
          ) : (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(96,165,250,0.02)', border:'1px solid rgba(96,165,250,0.04)', marginBottom:8 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>Режим приёма</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', lineHeight:1.4 }}>Специальных инструкций по режиму приёма для выбранной комбинации не требуется. Соблюдайте стандартные правила: с едой, запивая водой.</div>
            </div>
          )}

          {/* ─── Synergy suggestions ─── */}
          {suggestions.length>0 ? (
            <div style={cardStyle}>
              <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:6 }}>Рекомендации для усиления синергии</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {suggestions.map((sug:any, si:number) => (
                  <div key={si} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 8px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
                    <button onClick={()=>{if(!interactIds.includes(sug.id)&&interactIds.length<10){const ei=interactIds.findIndex(x=>!x);if(ei>=0)updateSlot(ei,sug.id);else setInteractIds([...interactIds,sug.id])}}}
                      style={{ padding:'2px 8px', borderRadius:4, fontSize:8, cursor:'pointer', background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.3)', color:'#a855f7', fontWeight:700 }}>+ Добавить</button>
                    <span style={{ fontSize:8, fontWeight:600, color:'#fff', minWidth:50 }}>{sug.name}</span>
                    <span style={{ fontSize:7, color:'rgba(255,255,255,0.35)', flex:1 }}>{sug.synergiesWith.length} синергий: {sug.synergiesWith.slice(0,3).map((x:string)=>resolveSubName(x)).join(', ')}</span>
                    <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:'rgba(168,85,247,0.15)', color:'#a855f7', fontWeight:700 }}>{sug.score}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ ...cardStyle, borderColor:'rgba(168,85,247,0.06)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#a855f7', marginBottom:6 }}>Рекомендации для усиления синергии</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', lineHeight:1.3 }}>Для выбранной комбинации не найдено дополнительных веществ, существенно усиливающих синергию. Текущий набор сбалансирован.</div>
            </div>
          )}

          {/* ─── Conclusion (summary only, refer to sections above) ─── */}
          {(()=>{
            const criticalCount = enrichedMatrix.filter((m:any)=>m.type==='conflict'&&m.severity==='HIGH').length;
            const isScore = enrichedScore.score>=60;
            const lines: string[] = [enrichedScore.score>=80?'Совместимость высокая':enrichedScore.score>=60?'Совместимость умеренная':enrichedScore.score>=45?'Совместимость низкая — пересмотр':'Рискованная комбинация — замена компонентов'];
            if (criticalCount>0) lines.push(`⛔ ${criticalCount} критических конфликтов — разделить приём ≥4 ч или заменить`);
            if (depletionData.length>0) lines.push(`${depletionData.length} истощений — см. карточку выше`);
            if (cypMap.length>0) lines.push(`${cypMap.length} веществ влияют на CYP450 — см. карточку выше`);
            if (labMonitor.length>0) lines.push(`${labMonitor.length} маркеров к мониторингу — см. карточку ниже`);
            if (lines.length<2) lines.push('Дополнительных мер не требуется');
            return (
              <div style={{ padding:'8px 12px', borderRadius:8, background:isScore?'rgba(34,197,94,0.03)':'rgba(239,68,68,0.03)', border:`1px solid ${isScore?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)'}`, marginBottom:8 }}>
                <div style={{ fontSize:9, fontWeight:700, color:isScore?'#22c55e':'#ef4444', marginBottom:2 }}>Заключение</div>
                {lines.map((l,i)=><div key={i} style={{ fontSize:7.5, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>{l}</div>)}
              </div>
            );
          })()}

          {/* ─── Lab Monitoring ─── */}
          <div style={{...cardStyle, borderColor:labMonitor.length>0?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.03)'}}>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:8 }}>Мониторинг анализов</div>
            {labMonitor.length>0 ? (
              <>
              <div style={{ marginBottom:6, fontSize:7, color:'rgba(255,255,255,0.3)', lineHeight:1.3 }}>
                На основе выбранных веществ определены следующие маркеры для лабораторного контроля.
                При отклонениях — смотреть тиер-рекомендации и раздел конфликтов выше.
              </div>
              {(()=>{
                const groups: Record<string, LabMon[]> = {};
                for (const item of labMonitor) {
                  const sys = item.system || 'metabolic';
                  if (!groups[sys]) groups[sys] = [];
                  groups[sys].push(item);
                }
                return SYSTEM_ORDER.filter(sys=>groups[sys]).map(sys=>{
                  const items = groups[sys];
                  const critical = items.filter(i=>i.tier3).length;
                  const hasTiers = items.some(i=>i.tier1||i.tier2||i.tier3);
                  return (
                    <div key={sys} style={{ marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                        <span style={{ fontSize:12 }}>{SYSTEM_ICONS[sys]||''}</span>
                        <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>{SYSTEM_LABELS[sys]||sys}</span>
                        <span style={{ fontSize:7, color:'rgba(255,255,255,0.25)', marginLeft:4 }}>{items.length} маркеров</span>
                        {critical>0&&<span style={{ fontSize:7, padding:'1px 5px', borderRadius:4, background:'rgba(239,68,68,0.2)', color:'#ef4444' }}>⛔ {critical}</span>}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {items.map((item,ii)=>(
                          <div key={ii} style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:1 }}>
                              <span style={{ fontSize:8, fontWeight:600, color:'#fff' }}>{item.markerRu}</span>
                              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                <span style={{ fontSize:6, color:'rgba(255,255,255,0.35)', whiteSpace:'nowrap' }}>{item.when}</span>
                                {item.target&&<span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(34,197,94,0.12)', color:'#4ade80' }}>{item.target}</span>}
                              </div>
                            </div>
                            <div style={{ fontSize:7, color:item.condition.includes('↑')?'#f59e0b':item.condition.includes('↓')?'#22c55e':'rgba(255,255,255,0.5)', lineHeight:1.3 }}>
                              {item.condition}
                            </div>
                            <div style={{ fontSize:6.5, color:'rgba(255,255,255,0.45)', lineHeight:1.3, marginTop:1 }}>
                              {item.note}
                            </div>
                            {hasTiers&&(item.tier1||item.tier2||item.tier3)&&(
                              <div style={{ display:'flex', gap:3, marginTop:2, flexWrap:'wrap' }}>
                                {item.tier1&&<span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(251,191,36,0.1)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.15)' }}>&#9650; {item.tier1}</span>}
                                {item.tier2&&<span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.15)' }}>&#9650;&#9650; {item.tier2}</span>}
                                {item.tier3&&<span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(239,68,68,0.2)', color:'#fff', border:'1px solid #ef4444' }}>⛔ {item.tier3}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
              </>
            ) : (
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', lineHeight:1.3 }}>Для выбранных веществ нет специализированных маркеров мониторинга. Рекомендуется стандартный контроль: АЛТ, АСТ, ГГТ, креатинин, липидограмма, HCT — каждые 4-8 нед.</div>
            )}
          </div>

          {/* ─── Monographs ─── */}
          <div style={cardStyle}>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:8 }}>Монографии веществ</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {validIds.map(id=><MonographCard key={id} id={id} />)}
            </div>
          </div>
        </>
      )}

      {/* ════════════════ INTERACTIONS BROWSER ════════════════ */}
      {mergedInteractions.length>0&&(
        <div style={cardStyle}>
          <button onClick={()=>setBrowseOpen(!browseOpen)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:0, background:'transparent', border:'none', cursor:'pointer', color:'#fff', textAlign:'left' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#f59e0b' }}>Справочник взаимодействий</span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:4 }}>
                {validIds.length>0?`${browseFiltered.length} из ${mergedInteractions.length}`:mergedInteractions.length}
              </span>
            </div>
            <span style={{ fontSize:10, color:'#f59e0b', transition:'transform 0.2s', transform:browseOpen?'rotate(180deg)':'none' }}>v</span>
          </button>
          {browseOpen&&(
            <div style={{ marginTop:10 }}>
              <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                <div style={{ flex:1 }}><input value={browseSearch} onChange={e=>setBrowseSearch(e.target.value)} placeholder="Поиск по веществу или эффекту..." style={{...inputBase, padding:'6px 8px', fontSize:9}} /></div>
                <select value={browseSeverity} onChange={e=>setBrowseSeverity(e.target.value)} style={{...inputBase, width:100, padding:'6px 8px', fontSize:9, appearance:'none'}}>
                  <option value="all">Все</option>
                  <option value="HIGH">Высокая</option>
                  <option value="MEDIUM">Средняя</option>
                  <option value="LOW">Низкая</option>
                </select>
              </div>
              <div style={{ maxHeight:400, overflowY:'auto', paddingRight:2 }}>
                {browseFiltered.length===0?(
                  <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,0.3)', fontSize:9 }}>Ничего не найдено</div>
                ):(
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {browseFiltered.slice(0,100).map((item:any,idx:number)=>{
                      const aName = resolveSubName(item.substanceA)||item.substanceA||'?';
                      const bName = resolveSubName(item.substanceB)||item.substanceB||'?';
                      const typeColor = item.type==='synergy'?'#22c55e':item.type==='conflict'?'#ef4444':'#f59e0b';
                      const sevColor = item.severity==='HIGH'?'#ef4444':item.severity==='MEDIUM'?'#f59e0b':'#22c55e';
                      const enrich = enrichmentData[item.interactionId];
                      return (
                        <div key={item.interactionId||idx} style={{ padding:'6px 8px', borderRadius:8, background:typeColor+'08', border:'1px solid '+typeColor+'15' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                            <span style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{aName} + {bName}</span>
                            <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, background:sevColor+'22', color:sevColor, fontWeight:600 }}>{item.severity}</span>
                          </div>
                          {item.effect&&<div style={{ fontSize:8, color:typeColor, lineHeight:1.3, marginBottom:2 }}>{item.effect}</div>}
                          {enrich?.mechanismRu?.length>0&&<div style={{ fontSize:7, color:'#a78bfa', lineHeight:1.2 }}>{enrich.mechanismRu.slice(0,2).join('; ')}</div>}
                          {enrich?.riskDescription&&<div style={{ fontSize:7, color:'#ef4444', lineHeight:1.2, marginTop:2, background:'rgba(239,68,68,0.06)', padding:'3px 6px', borderRadius:4 }}>{enrich.riskDescription}</div>}
                        </div>
                      );
                    })}
                    {browseFiltered.length>100&&<div style={{ textAlign:'center', padding:8, color:'rgba(255,255,255,0.3)', fontSize:8 }}>Показано первые 100 из {browseFiltered.length}. Уточните поиск.</div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ──────────────── MONOGRAPH CARD ──────────────── */
const MonographCard: React.FC<{ id: string }> = ({ id }) => {
  const [open, setOpen] = useState(false);
  const entry = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  if (!entry) return null;
  const name = entry.nameRu || entry.name || id;
  const tierColor: Record<string,string> = { core:'#00e68a', standard:'#60a5fa', advanced:'#a78bfa', specialty:'#f59e0b' };
  return (
    <div style={{ borderRadius:8, background:'rgba(255,255,255,0.012)', border:'1px solid rgba(255,255,255,0.04)', overflow:'hidden' }}>
      <div onClick={()=>setOpen(!open)} style={{ padding:'6px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
        <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>{name}</span>
        {entry.tier&&<span style={{ fontSize:6, padding:'1px 5px', borderRadius:3, background:(tierColor[entry.tier]||'rgba(255,255,255,0.4)')+'22', color:tierColor[entry.tier]||'rgba(255,255,255,0.4)', fontWeight:600 }}>{entry.tier}</span>}
        <span style={{ marginLeft:'auto', fontSize:7, color:'rgba(255,255,255,0.2)' }}>{open?'\u25b2':'\u25bc'}</span>
      </div>
      {open&&(
        <div style={{ padding:'0 8px 8px', fontSize:7, color:'rgba(255,255,255,0.55)', lineHeight:1.4 }}>
          {entry.description&&<div style={{ marginBottom:3 }}>{entry.description}</div>}
          {entry.mechanisms?.length>0&&<div style={{ marginBottom:2 }}><span style={{ color:'#a78bfa', fontWeight:600 }}>Механизмы: </span>{entry.mechanisms.join(', ')}</div>}
          {entry.contraindications?.length>0&&<div style={{ marginBottom:2 }}><span style={{ color:'#ef4444', fontWeight:600 }}>Противопоказания: </span>{entry.contraindications.join('; ')}</div>}
          {entry.sideEffects?.length>0&&<div style={{ marginBottom:2 }}><span style={{ color:'#f59e0b', fontWeight:600 }}>Побочные: </span>{entry.sideEffects.join(', ')}</div>}
          {(entry.specialInstructions?.length??0)>0&&<div style={{ marginBottom:2 }}><span style={{ color:'#60a5fa', fontWeight:600 }}>Указания: </span>{(entry.specialInstructions||[]).join(' - ')}</div>}
          {entry.monitoring?.length>0&&<div><span style={{ color:'#22c55e', fontWeight:600 }}>Мониторинг: </span>{(entry.monitoring||[]).map((m:any)=>typeof m==='string'?m:`${m.what||''} (${m.when||''})`).join('; ')}</div>}
        </div>
      )}
    </div>
  );
};
