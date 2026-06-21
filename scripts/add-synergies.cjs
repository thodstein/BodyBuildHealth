const fs = require('fs');
const path = require('path');
const catPath = path.join(__dirname, '..', 'src', 'data', 'support-catalog.ts');
let content = fs.readFileSync(catPath, 'utf8');

const SYNERGIES = [
  ['nac', 'alpha_lipoic', 'Усиление антиоксидантной сети', 'АЛЬК регенерирует глутатион и витамин C, NAC — предшественник глутатиона. Вместе — полный цикл антиоксидантной защиты', 'HIGH'],
  ['nac', 'vitamin_c', 'Регенерация глутатиона', 'Витамин C восстанавливает окисленный глутатион, NAC — субстрат для синтеза нового', 'HIGH'],
  ['nac', 'selenium', 'Глутатионпероксидаза', 'NAC даёт субстрат (глутатион), Se — кофактор GPx', 'MEDIUM'],
  ['nac', 'coq10', 'Митохондриальная защита', 'NAC повышает глутатион в митохондриях, CoQ10 поддерживает электрон-транспортную цепь', 'MEDIUM'],
  ['nac', 'vitamin_e', 'Мембранная защита', 'NAC поддерживает глутатион, вит. E защищает мембраны от липопероксидации', 'MEDIUM'],
  ['nac', 'tudca', 'Комплексная защита печени', 'NAC повышает глутатион, TUDCA защищает митохондрии и снижает ER-стресс', 'HIGH'],
  ['nac', 'milk_thistle', 'Гепатопротекция', 'NAC — глутатион, силимарин — стабилизация мембран гепатоцитов', 'HIGH'],
  ['nac', 'phosphatidylcholine', 'Мембраны гепатоцитов', 'NAC + ФХ = восстановление фосфолипидного слоя печени', 'MEDIUM'],
  ['nac', 'berberine', 'Метаболическая защита', 'NAC — антиоксидант для печени, берберин — улучшение липидного профиля', 'MEDIUM'],
  ['nac', 'vitamin_c', 'Регенерация глутатиона', 'Вит. C восстанавливает окисленный глутатион', 'HIGH'],
  ['alpha_lipoic', 'vitamin_c', 'Цикл регенерации', 'АЛЬК восстанавливает вит. C, вит. C регенерирует вит. E', 'HIGH'],
  ['alpha_lipoic', 'vitamin_e', 'Регенерация вит. E', 'АЛЬК регенерирует окисленный вит. E через вит. C', 'HIGH'],
  ['alpha_lipoic', 'coq10', 'Регенерация CoQ10', 'АЛЬК восстанавливает окисленный убихинон в убихинол', 'MEDIUM'],
  ['alpha_lipoic', 'tudca', 'Гепатопротекция', 'АЛЬК — антиоксидант, TUDCA снижает ER-стресс', 'MEDIUM'],
  ['alpha_lipoic', 'milk_thistle', 'Гепатопротекция', 'АЛЬК + силимарин = защита от токсинов печени', 'MEDIUM'],
  ['alpha_lipoic', 'berberine', 'Метаболическая', 'АЛЬК + берберин = инсулиновая чувствительность + антиоксидант', 'MEDIUM'],
  ['vitamin_c', 'vitamin_e', 'Синергия', 'Вит. C регенерирует окисленный вит. E в мембранах', 'HIGH'],
  ['vitamin_c', 'selenium', 'Усвоение Se', 'Вит. C улучшает усвоение Se', 'LOW'],
  ['vitamin_c', 'coq10', 'Митохондрии', 'Вит. C + CoQ10 = защита митохондрий', 'MEDIUM'],
  ['vitamin_c', 'iron', 'Усвоение Fe', 'Вит. C восстанавливает Fe3+ → Fe2+, ↑ всасывание в 3-6x', 'HIGH'],
  ['vitamin_c', 'collagen', 'Синтез коллагена', 'Вит. C — кофактор гидроксилазы пролина, критичен для синтеза коллагена', 'HIGH'],
  ['vitamin_e', 'selenium', 'Мембранная защита', 'Вит. E в мембране, Se (GPx) в цитозоле — полная защита клетки', 'HIGH'],
  ['coq10', 'selenium', 'Митохондрии', 'Se — GPx, CoQ10 — дыхательная цепь митохондрий', 'MEDIUM'],
  ['coq10', 'omega3', 'Кардиопротекция', 'CoQ10 + Омега-3 = защита миокарда через разные механизмы', 'MEDIUM'],
  ['coq10', 'magnesium', 'Митохондрии сердца', 'CoQ10 — энергия, Mg — стабилизация мембран кардиомиоцитов', 'MEDIUM'],
  ['coq10', 'taurine', 'Сократимость', 'Таурин регулирует Ca2+, CoQ10 даёт энергию для сокращения', 'MEDIUM'],
  ['omega3', 'magnesium', 'Кардио + электролиты', 'Омега-3 + Mg = снижение давления и аритмий', 'MEDIUM'],
  ['omega3', 'taurine', 'Миокард', 'Таурин улучшает сократимость, Омега-3 — мембранную текучесть', 'MEDIUM'],
  ['omega3', 'telmisartan', 'Давление + липиды', 'Омега-3 ↓ TG, телмисартан ↓ АД', 'MEDIUM'],
  ['omega3', 'berberine', 'Липидный профиль', 'Омега-3 ↓ TG, берберин ↓ ЛПНП', 'MEDIUM'],
  ['omega3', 'vitamin_d3', 'Сердечно-сосудистая', 'Омега-3 противовоспалительное, D3 — кардиопротективное', 'MEDIUM'],
  ['magnesium', 'taurine', 'Расслабление', 'Mg и таурин синергично снижают АД и расслабляют гладкую мускулатуру', 'MEDIUM'],
  ['magnesium', 'telmisartan', 'АД', 'Mg расслабляет сосуды, телмисартан блокирует ангиотензин II', 'MEDIUM'],
  ['magnesium', 'nebivolol', 'ЧСС', 'Mg снижает тонус, небиволол ↓ ЧСС', 'MEDIUM'],
  ['magnesium', 'vitamin_b6', 'Усвоение Mg', 'B6 усиливает транспорт Mg в клетки', 'MEDIUM'],
  ['magnesium', 'glycine', 'Сон', 'Mg + глицин = синергия сна через GABA', 'MEDIUM'],
  ['magnesium', 'ashwagandha', 'Стресс + сон', 'Mg расслабляет, ашваганда ↓ кортизол', 'HIGH'],
  ['taurine', 'telmisartan', 'АД', 'Таурин — слабый диуретик, телмисартан — сартан', 'MEDIUM'],
  ['taurine', 'nebivolol', 'ЧСС', 'Таурин улучшает диастолическую функцию, небиволол ↓ ЧСС', 'LOW'],
  ['telmisartan', 'nebivolol', 'Максимальный контроль', 'Сартан + бета-блокатор = аддитивное снижение АД и ЧСС', 'MEDIUM'],
  ['zinc', 'magnesium', 'Баланс', 'Zn и Mg — кофакторы синтеза T и ЦНС', 'MEDIUM'],
  ['zinc', 'vitamin_d3', 'Иммунитет + гормоны', 'Zn + D3 = синергия иммунитета и синтеза T', 'MEDIUM'],
  ['zinc', 'boron', 'Свободный T', 'Бор ↓ SHBG, Zn — субстрат для синтеза T', 'MEDIUM'],
  ['zinc', 'ashwagandha', 'Тестостерон', 'Zn для синтеза T, ашваганда ↓ кортизол', 'MEDIUM'],
  ['zinc', 'selenium', 'Простата', 'Zn + Se — защита простаты от оксидативного стресса', 'MEDIUM'],
  ['zinc', 'vitamin_b6', 'Нейромедиаторы', 'B6 и Zn — кофакторы синтеза дофамина и серотонина', 'MEDIUM'],
  ['zinc', 'copper', 'Баланс', 'Zn/Cu — конкуренты, важно соотношение 1:10', 'LOW'],
  ['vitamin_d3', 'magnesium', 'Активация D3', 'Mg для 3 этапов конвертации D3 в активную форму', 'HIGH'],
  ['vitamin_d3', 'vitamin_k2', 'Кальциевый обмен', 'D3 ↑ всасывание Ca, K2 направляет его в кости', 'HIGH'],
  ['vitamin_d3', 'boron', 'Метаболизм D3', 'Бор улучшает метаболизм D3 и поддерживает T', 'LOW'],
  ['vitamin_d3', 'ashwagandha', 'Гормоны', 'D3 для синтеза T, ашваганда ↓ кортизол', 'MEDIUM'],
  ['vitamin_d3', 'calcium', 'Кости', 'D3 ↑ Ca, вместе для костной ткани', 'HIGH'],
  ['vitamin_k2', 'calcium', 'Кости', 'K2 активирует остеокальцин, связывающий Ca', 'HIGH'],
  ['boron', 'ashwagandha', 'Гормоны', 'Бор ↓ SHBG, ашваганда ↓ кортизол — дуэт для T', 'MEDIUM'],
  ['ashwagandha', 'taurine', 'Расслабление', 'GABA-ергическая синергия', 'MEDIUM'],
  ['ashwagandha', 'vitamin_b6', 'Нейромедиаторы', 'B6 → серотонин, ашваганда ↓ кортизол', 'LOW'],
  ['vitamin_b6', 'vitamin_b12', 'Нейромедиаторы', 'B6 + B12 — синтез серотонина, дофамина, ГАМК', 'HIGH'],
  ['vitamin_b6', 'folate', 'Метилирование', 'B6 + фолат — кофакторы метилирования', 'HIGH'],
  ['vitamin_b12', 'folate', 'Метилирование', 'B12 + фолат — метионинсинтаза, снижение гомоцистеина', 'HIGH'],
  ['vitamin_b12', 'vitamin_b6', 'Гомоцистеин', 'Триада B12+B6+фолат — снижение гомоцистеина', 'HIGH'],
  ['folate', 'vitamin_b6', 'Метилирование', 'Кофакторы цикла метилирования', 'HIGH'],
  ['vitamin_c', 'glucosamine', 'Суставы', 'Вит. C для коллагена, глюкозамин для хряща', 'MEDIUM'],
  ['collagen', 'glucosamine', 'Суставы', 'Коллаген — матрикс, глюкозамин — протеогликаны', 'MEDIUM'],
  ['collagen', 'msm', 'Соединительная ткань', 'Коллаген — аминокислоты, MSM — сера для связей', 'MEDIUM'],
  ['glucosamine', 'chondroitin', 'Суставы', 'Глюкозамин строит хрящ, хондроитин удерживает воду', 'HIGH'],
  ['glucosamine', 'msm', 'Противовоспалительное', 'Глюкозамин + MSM = снижение боли в суставах', 'MEDIUM'],
  ['vitamin_c', 'zinc', 'Иммунитет', 'Вит. C + Zn = фагоцитоз и пролиферация иммунных клеток', 'MEDIUM'],
  ['vitamin_d3', 'zinc', 'Иммунитет', 'D3 и Zn — T-клетки и тестостерон', 'MEDIUM'],
  ['probiotics', 'vitamin_d3', 'Иммунитет', 'Пробиотики + D3 = модуляция кишечного иммунитета', 'MEDIUM'],
  ['probiotics', 'zinc', 'Кишечный барьер', 'Zn — tight junctions, пробиотики — микробиом', 'MEDIUM'],
  ['probiotics', 'prebiotics', 'Синбиотик', 'Пребиотики — питание для пробиотиков', 'HIGH'],
  ['probiotics', 'glutamine', 'Кишечник', 'Глютамин — энтероциты, пробиотики — микробиом', 'MEDIUM'],
  ['iron', 'vitamin_c', 'Всасывание Fe', 'Вит. C ↑ абсорбцию Fe в 3-6x', 'HIGH'],
  ['iron', 'copper', 'Транспорт Fe', 'Медь — церулоплазмин, транспорт Fe', 'MEDIUM'],
  ['iron', 'folate', 'Эритропоэз', 'Fe + фолат — синтез гема и деление клеток', 'MEDIUM'],
  ['iron', 'vitamin_b12', 'Эритропоэз', 'Fe + B12 — продукция эритроцитов', 'MEDIUM'],
  ['folate', 'vitamin_b12', 'Гемопоэз', 'Фолат + B12 — синтез ДНК и эритропоэз', 'HIGH'],
  ['aspirin', 'omega3', 'Антитромботическая', 'Аспирин (COX-1) + Омега-3 = снижение агрегации', 'MEDIUM'],
  ['milk_thistle', 'berberine', 'NAFLD', 'Силимарин + берберин = метаболизм печени', 'MEDIUM'],
  ['milk_thistle', 'alpha_lipoic', 'Гепатопротекция', 'Силимарин + АЛЬК = защита от токсинов', 'MEDIUM'],
  ['tudca', 'phosphatidylcholine', 'Желчеотток', 'TUDCA разжижает желчь, ФХ восстанавливает мембраны', 'MEDIUM'],
  ['curcumin', 'omega3', 'Противовоспалительная', 'COX-2 + резольвины — полный путь воспаления', 'MEDIUM'],
  ['curcumin', 'boswellia', 'Суставы', '5-LOX + COX-2 = полный противовоспалительный', 'MEDIUM'],
  ['curcumin', 'vitamin_c', 'Коллаген', 'Куркумин ↓ MMP, вит. C ↑ коллаген', 'LOW'],
  ['ashwagandha', 'magnesium', 'Стресс', 'Ашваганда ↓ кортизол, Mg расслабляет ЦНС', 'HIGH'],
  ['probiotics', 'vitamin_c', 'Иммунитет', 'Пробиотики ↓ проницаемость, вит. C ↑ нейтрофилы', 'LOW'],
  ['glutamine', 'zinc', 'ЖКТ', 'Глютамин + Zn = заживление слизистой', 'MEDIUM'],
  ['berberine', 'probiotics', 'Микробиом', 'Берберин модулирует, пробиотики восстанавливают', 'LOW'],
];

const CONFLICTS = [
  ['zinc', 'copper', 'Дисбаланс Zn/Cu', 'Высокий Zn истощает Cu через металлотионеин', 'HIGH'],
  ['zinc', 'iron', 'Конкуренция', 'Zn и Fe за DMT1, интервал 2ч', 'MEDIUM'],
  ['zinc', 'calcium', 'Конкуренция', 'Ca снижает всасывание Zn', 'LOW'],
  ['iron', 'calcium', 'Блокада Fe', 'Ca блокирует DMT1, интервал 2ч', 'MEDIUM'],
  ['iron', 'magnesium', 'Конкуренция', 'Fe и Mg за всасывание', 'MEDIUM'],
  ['magnesium', 'calcium', 'Конкуренция', 'Mg и Ca за транспортёры, интервал 1-2ч', 'LOW'],
  ['vitamin_k2', 'warfarin', 'Антагонизм', 'K2 ↑ свёртывание, варфарин ↓', 'HIGH'],
  ['curcumin', 'anticoagulants', 'Усиление', 'Куркумин ↓ агрегацию тромбоцитов', 'MEDIUM'],
  ['curcumin', 'iron', 'Хелация', 'Куркумин хелатирует Fe', 'MEDIUM'],
  ['coq10', 'warfarin', 'Снижение', 'CoQ10 структурно похож на вит. K', 'MEDIUM'],
  ['vitamin_d3', 'calcium_high', 'Гиперкальциемия', 'D3 ↑ Ca, риск при высоких дозах', 'MEDIUM'],
  ['vitamin_e', 'anticoagulants', 'Усиление', 'Высокие дозы вит. E ↑ риск кровотечений', 'MEDIUM'],
  ['folate', 'methotrexate', 'Антагонизм', 'Метотрексат — антагонист фолата', 'HIGH'],
  ['aspirin', 'anticoagulants', 'Кровотечение', 'Риск ЖК-кровотечений', 'HIGH'],
  ['probiotics', 'antibiotics', 'Уничтожение', 'Антибиотики убивают пробиотики, интервал 3ч', 'HIGH'],
  ['berberine', 'cyp3a4_substrates', 'CYP3A4', 'Берберин подавляет CYP3A4', 'HIGH'],
  ['berberine', 'antidiabetic_drugs', 'Гипогликемия', 'Риск гипогликемии', 'MEDIUM'],
  ['ashwagandha', 'thyroid_drugs', 'T3/T4', 'Ашваганда ↑ T3/T4', 'MEDIUM'],
  ['telmisartan', 'potassium_supplements', 'K+', 'Риск гиперкалиемии', 'MEDIUM'],
  ['telmisartan', 'ace_inhibitors', 'РААС', 'Двойная блокада → гипотония + K+', 'HIGH'],
  ['nebivolol', 'verapamil', 'Брадикардия', 'Риск тяжёлой брадикардии', 'HIGH'],
  ['selenium', 'vitamin_c_high', 'Окисление', 'Высокие дозы C окисляют Se', 'LOW'],
  ['omega3', 'anticoagulants', 'Усиление', 'Высокие дозы Омега-3 >4г ↑ риск', 'MEDIUM'],
  ['taurine', 'antihypertensives', 'Гипотония', 'Риск избыточного снижения АД', 'LOW'],
  ['glutamine', 'chemotherapy', 'Защита клеток', 'Глютамин может защищать раковые клетки', 'MEDIUM'],
  ['glycine', 'antipsychotics', 'Седация', 'Усиление седативного эффекта', 'LOW'],
];

// Apply to each entry
let synCount = 0;
let confCount = 0;

for (const [a, b, effect, mech, sev] of SYNERGIES) {
  for (const [entryId, targetId] of [[a, b], [b, a]]) {
    // Find the entry: `entryId:{id:'entryId'`
    const idx = content.indexOf(`${entryId}:{id:'${entryId}'`);
    if (idx < 0) continue;
    
    // Find the synergies array within this entry
    const synStart = content.indexOf(`synergies:[`, idx);
    if (synStart < 0) continue;
    const synEnd = content.indexOf(`]`, synStart);
    if (synEnd < 0) continue;
    
    // Check if this synergy already exists
    const synBlock = content.substring(synStart, synEnd);
    if (synBlock.includes(`with:'${targetId}'`)) continue;
    
    // Add the new synergy
    const isArrayEmpty = synBlock === 'synergies:[';
    const sep = isArrayEmpty ? '' : ',';
    const newEntry = `{with:'${targetId}',effect:'${effect.replace(/'/g, "\\'")}',mechanism:'${mech.replace(/'/g, "\\'")}',severity:'${sev}'}`;
    content = content.substring(0, synEnd) + sep + newEntry + content.substring(synEnd);
    synCount++;
  }
}

for (const [a, b, effect, mech, sev] of CONFLICTS) {
  for (const [entryId, targetId] of [[a, b], [b, a]]) {
    const idx = content.indexOf(`${entryId}:{id:'${entryId}'`);
    if (idx < 0) continue;
    const confStart = content.indexOf(`conflicts:[`, idx);
    if (confStart < 0) continue;
    const confEnd = content.indexOf(`]`, confStart);
    if (confEnd < 0) continue;
    const confBlock = content.substring(confStart, confEnd);
    if (confBlock.includes(`with:'${targetId}'`)) continue;
    const isArrayEmpty = confBlock === 'conflicts:[';
    const sep = isArrayEmpty ? '' : ',';
    const newEntry = `{with:'${targetId}',effect:'${effect.replace(/'/g, "\\'")}',mechanism:'${mech.replace(/'/g, "\\'")}',severity:'${sev}'}`;
    content = content.substring(0, confEnd) + sep + newEntry + content.substring(confEnd);
    confCount++;
  }
}

fs.writeFileSync(catPath, content, 'utf8');
console.log(`Added ${synCount} synergies and ${confCount} conflicts.`);
