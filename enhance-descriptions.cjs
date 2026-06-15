// Generate detailed Russian descriptions for ALL support substances
// based on their type, categories, mechanisms, organs, and deficiency data
const fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// --- COMPREHENSIVE RUSSIAN MECHANISM DESCRIPTIONS ---
const MECH_RU = {
  CAROTENOID_PATHWAY: "Конвертируется в ретинол по каротиноидному пути по мере необходимости",
  OXIDATIVE_STRESS_REDUCTION: "Нейтрализует свободные радикалы и снижает оксидативный стресс в клетках",
  RETINOID_SIGNALING: "Активирует ретиноидные рецепторы RAR/RXR, регулируя экспрессию генов клеточного роста и дифференцировки",
  COLLAGEN_SUPPORT: "Стимулирует синтез коллагена I и III типов, укрепляя соединительную ткань",
  TPP_PATHWAY: "Служит коферментом ТДФ в пентозофосфатном пути и пируватдегидрогеназном комплексе",
  CARB_METABOLISM: "Обеспечивает метаболизм углеводов через ключевые ферментативные реакции",
  FLAVIN_PATHWAY: "Является предшественником ФАД и ФМН — коферментов дыхательной цепи и цикла Кребса",
  MITO_REPAIR: "Поддерживает функцию митохондрий и стимулирует митохондриальный биогенез",
  NAD_PATHWAY: "Является предшественником NAD+/NADH — центрального кофермента клеточного метаболизма",
  LIPID_BALANCE: "Модулирует липидный профиль: снижает ЛПНП и триглицериды, повышает ЛПВП",
  SIRT1_ACTIVATION: "Активирует сиртуин SIRT1, запуская антивозрастные и метаболические программы",
  ENERGY_PRODUCTION: "Участвует в продукции АТФ через окислительное фосфорилирование",
  COENZYME_A: "Является компонентом Коэнзима А — центрального метаболического кофермента",
  ACETYLCHOLINE_SYNTHESIS: "Участвует в синтезе ацетилхолина — нейромедиатора памяти и внимания",
  ADRENAL_SUPPORT: "Поддерживает функцию надпочечников и продукцию кортикостероидов",
  HEME_SYNTHESIS: "Участвует в синтезе гема — простетической группы гемоглобина и цитохромов",
  GENE_EXPRESSION: "Модулирует экспрессию генов через ядерные рецепторы и транскрипционные факторы",
  BLOOD_CLOTTING: "Является кофактором карбоксилирования факторов свёртывания крови",
  CALCIUM_REGULATION: "Регулирует кальциевый гомеостаз через рецепторы VDR и кишечную абсорбцию",
  BONE_MINERALIZATION: "Усиливает минерализацию костной ткани и поддерживает плотность костей",
  IMMUNE_MODULATION: "Модулирует иммунный ответ через T-клетки, макрофаги и цитокиновый профиль",
  NEUROTRANSMITTER_SYNTHESIS: "Участвует в синтезе серотонина, дофамина, ГАМК и норадреналина",
  METHYLATION: "Обеспечивает метилирование ДНК, гомоцистеина и нейромедиаторов через SAM",
  HOMOCYSTEINE_REDUCTION: "Снижает уровень гомоцистеина через реметилирование до метионина",
  DNA_SYNTHESIS: "Участвует в синтезе и репарации ДНК, поддерживает деление клеток",
  REDOX_BALANCE: "Поддерживает редокс-баланс клетки через систему глутатиона",
  FATTY_ACID_SYNTHESIS: "Участвует в синтезе жирных кислот через малонил-КоА путь",
  GLUCONEOGENESIS: "Участвует в глюконеогенезе — синтезе глюкозы de novo",
  INSULIN_SENSITIVITY: "Повышает чувствительность к инсулину через AMPK и PPAR-путь",
  ANTI_GLYCATION: "Блокирует неферментное гликирование белков и образование AGE",
  NERVE_PROTECTION: "Обеспечивает нейропротекцию через миелинизацию и антиоксидантную защиту",
  MITOCHONDRIAL_BIOGENESIS: "Стимулирует митохондриальный биогенез через PGC-1a и NRF-1",
  ANTIOXIDANT: "Нейтрализует свободные радикалы и реактивные формы кислорода",
  ANTIINFLAMMATION: "Подавляет провоспалительные цитокины TNF-a, IL-6 и NF-kB",
  AUTOPHAGY_UP: "Индуцирует аутофагию через AMPK/mTOR путь",
  ANTIAGING: "Замедляет клеточное старение через активацию сиртуинов и защиту теломер",
  NAD_UP: "Повышает уровень NAD+ — ключевого кофермента энергетического метаболизма",
  AMPK_UP: "Активирует AMPK — центральный сенсор энергетического статуса клетки",
  BDNF_UP: "Повышает уровень BDNF — нейротрофического фактора мозга",
  NGF_UP: "Повышает уровень NGF — фактора роста нервов",
  GLUTATHIONE_UP: "Повышает уровень глутатиона — главного внутриклеточного антиоксиданта",
  NITRIC_OXIDE_UP: "Повышает синтез оксида азота NO через eNOS и iNOS",
  VASODILATION: "Вызывает вазодилатацию через NO и простациклин",
  BLOOD_FLOW_UP: "Усиливает кровоток через вазодилатацию и улучшение реологии крови",
  HORMONE_BALANCE: "Балансирует гормональный фон через модуляцию оси HPA/HPG/HPT",
  ADRENALINE_UP: "Повышает уровень адреналина через стимуляцию мозгового слоя надпочечников",
  TESTOSTERONE_UP: "Повышает уровень тестостерона через стимуляцию клеток Лейдига",
  LIVER_PROTECT: "Обеспечивает гепатопротекцию через индукцию детоксикационных ферментов",
  HEART_PROTECT: "Обеспечивает кардиопротекцию через антиоксидантное и антиаритмическое действие",
  NEURO_PROTECT: "Обеспечивает нейропротекцию через антиоксидантное и противовоспалительное действие",
  MUSCLE_UP: "Стимулирует мышечный рост через активацию mTOR и синтез белка",
  ANTI_CATABOLIC: "Обладает антикатаболическим действием через подавление протеолиза",
  ANABOLISM: "Стимулирует анаболические процессы через mTOR/Akt путь",
  PROTEIN_SYNTHESIS: "Стимулирует синтез белка через рибосомальный путь",
  ATP_PRODUCTION: "Усиливает продукцию АТФ в митохондриях",
  CELL_PROTECT: "Защищает клетки от повреждения оксидативным и метаболическим стрессом",
  DNA_PROTECT: "Защищает ДНК от повреждений свободными радикалами и мутагенами",
  MITO_PROTECT: "Защищает митохондрии от окислительного повреждения мембран",
  ANTIMICROBIAL: "Обладает антимикробной активностью против патогенных микроорганизмов",
  ANTI_FUNGAL: "Обладает противогрибковой активностью",
  ANTI_VIRAL: "Обладает противовирусной активностью",
  GUT_HEALTH: "Поддерживает здоровье кишечника через укрепление барьера и микробиом",
  MICROBIOME_SUPPORT: "Поддерживает микробиом кишечника через пребиотическое действие",
  CALMING: "Оказывает успокаивающее действие через ГАМК-ергическую систему",
  SLEEP_UP: "Улучшает качество сна через модуляцию мелатонина и ГАМК",
  COGNITION_UP: "Улучшает когнитивные функции через нейропластичность и нейротрофические факторы",
  MEMORY_UP: "Улучшает память через синаптическую пластичность и долговременную потенциацию",
  ANXIETY_DOWN: "Снижает тревожность через ГАМК и серотониновую модуляцию",
  DEPRESSION_DOWN: "Снижает депрессивные симптомы через моноаминергическую модуляцию",
  BONE_UP: "Увеличивает костную массу через остеобластную стимуляцию",
  CARTILAGE_SUPPORT: "Поддерживает хрящевую ткань через синтез протеогликанов и хондроитинсульфата",
  SKIN_PROTECT: "Защищает кожу от УФ-повреждений и оксидативного стресса",
  EYE_PROTECT: "Защищает зрение через макулярную пигментацию и антиоксидантную защиту сетчатки",
  IRON_ABSORPTION: "Усиливает всасывание железа в кишечнике через восстановление Fe3+ до Fe2+",
  BIFIDO_UP: "Стимулирует рост бифидобактерий в кишечнике",
  LACTO_UP: "Стимулирует рост лактобацилл в кишечнике",
  SCFA_PRODUCTION: "Стимулирует продукцию короткоцепочечных жирных кислот (бутират, пропионат, ацетат)",
  PREBIOTIC_FERMENT: "Ферментируется кишечной микрофлорой с образованием SCFA",
  BUTYRATE_PRODUCTION: "Стимулирует продукцию бутирата — основного энергоносителя колонодоцитов",
  GI_BARRIER_UP: "Укрепляет кишечный барьер через tight junctions и продукцию муцина",
  ADENOSINE_BLOCK: "Блокирует аденозиновые рецепторы A1/A2A, повышая бодрость и концентрацию",
  MELATONIN_SYNTHESIS: "Является предшественником мелатонина через серотониновый путь",
  CIRCADIAN_MOD: "Модулирует циркадные ритмы через шишковидное тело и супрахиазматическое ядро",
  DETOXIFICATION: "Усиливает детоксикацию через конъюгацию и выведение ксенобиотиков",
  CHOLESTEROL_DOWN: "Снижает уровень холестерина через ингибирование ГМГ-КоА-редуктазы",
  GLUCOSE_DOWN: "Снижает уровень глюкозы через усиление инсулиновой сигнализации",
  FAT_OXIDATION: "Усиливает окисление жиров через CPT-1 и бета-окисление в митохондриях",
  IMMUNE_SUPPORT: "Укрепляет иммунную защиту через модуляцию T-клеток и NK-клеток",
  GABA_MOD: "Модулирует ГАМК-ергическую передачу, снижая возбудимость нейронов",
  GABA_UP: "Повышает уровень ГАМК — тормозного нейромедиатора",
  SEROTONIN_SYNTHESIS: "Является предшественником серотонина через триптофангидроксилазный путь",
  DOPAMINE_SYNTHESIS: "Является предшественником дофамина через тирозингидроксилазный путь",
  NO_UP: "Повышает синтез оксида азота (NO) через eNOS/iNOS",
  COMPETE_ABSORB: "Конкурирует за всасывание в кишечнике с другими минералами",
  CALCIUM_UP: "Повышает уровень кальция в крови и костной ткани",
  IRON_UP: "Повышает уровень железа и улучшает эритропоэз",
  ZINC_UP: "Повышает уровень цинка, необходимого для иммунитета и синтеза ДНК",
  MAGNESIUM_UP: "Повышает уровень магния, необходимого для 300+ ферментативных реакций",
  CALCIUM_ABSORPTION: "Усиливает всасывание кальция в кишечнике через кальбиндин",
  BLOOD_PRESSURE: "Регулирует артериальное давление через NO и ренин-ангиотензиновую систему",
  CORTISOL_DOWN: "Снижает уровень кортизола через модуляцию оси HPA",
  ANABOLIC_SIGNALING: "Усиливает анаболическую сигнализацию через mTOR/Akt путь",
  CELL_SIGNALING: "Модулирует клеточную сигнализацию (MAPK, PI3K/Akt, NF-kB)",
  APOPTOSIS_REGULATION: "Модулирует апоптоз через Bcl-2/Bax каскад",
  HYDROXYLATION: "Является кофактором гидроксилирования пролина и лизина в коллагене",
  BILE_FLOW_UP: "Усиливает желчеотток и улучшает пищеварение жиров",
  MITO_ENERGY: "Увеличивает продукцию энергии в митохондриях через оптимизацию дыхательной цепи",
  MITO_MEMBRANE: "Стабилизирует митохондриальные мембраны и предотвращает утечку цитохрома c",
  MITO_BIOGENESIS: "Стимулирует биогенез митохондрий через PGC-1a/NRF-1/Tfam каскад",
  OXPHOS_UP: "Усиливает окислительное фосфорилирование в дыхательной цепи",
  ATP_SYNTHESIS: "Усиливает синтез АТФ через F1F0-АТФ-синтазу",
  ATP_UP: "Повышает уровень АТФ — универсального энергоносителя клетки",
  COQ10_UP: "Повышает уровень коэнзима Q10 — переносчика электронов в дыхательной цепи",
  SOD_UP: "Повышает активность супероксиддисмутазы — фермента антиоксидантной защиты",
  CATALASE_UP: "Повышает активность каталазы — фермента разложения пероксида водорода",
  GPX_UP: "Повышает активность глутатионпероксидазы — селензависимого антиоксидантного фермента",
  MITOPHAGY_UP: "Индуцирует митофагию — селективную аутофагию повреждённых митохондрий",
  CELL_REPAIR: "Активирует механизмы репарации клеток через PARP и ATM/ATR",
  SENESCENCE_DOWN: "Замедляет клеточное старение через подавление SASP и p16INK4a",
  TELOMERE_PROTECT: "Защищает теломеры от укорочения через активацию теломеразы",
  EPO_UP: "Повышает уровень эритропоэтина, стимулируя эритропоэз",
  HEMOGLOBIN_UP: "Повышает уровень гемоглобина и улучшает транспорт кислорода",
  NEURO_PROTECT: "Обеспечивает нейропротекцию через антиоксидантное и противовоспалительное действие",
  ANTI_PATHOGEN: "Подавляет патогенные микроорганизмы через антимикробные пептиды и органические кислоты",
  UBIQUINOL_PROTECT: "Защищает убихинол (коэнзим Q10) от окисления, поддерживая антиоксидантный пул",
  NF_KB_BLOCK: "Блокирует NF-kB — ключевой провоспалительный транскрипционный фактор",
  COX2_BLOCK: "Ингибирует COX-2 — ключевой фермент синтеза провоспалительных простагландинов",
  ACH_SUPPORT: "Поддерживает холинергическую передачу через ингибирование АХЭ или синтез ацетилхолина",
  ACH_SYNTHESIS: "Участвует в синтезе ацетилхолина — нейромедиатора памяти и внимания",
  ACH_SYNTHESIS_UP: "Усиливает синтез ацетилхолина через холинацетилтрансферазу",
  ACH_UP: "Повышает уровень ацетилхолина в синаптической щели",
};

// --- ORGAN RUSSIAN NAMES ---
const ORGAN_RU = {
  BRAIN: "мозг", HEART: "сердце", LIVER: "печень", KIDNEYS: "почек",
  LUNGS: "лёгкие", SKIN: "кожа", EYES: "глаза", BONES: "кости",
  MUSCLES: "мышцы", NERVES: "нервы", VESSELS: "сосуды",
  IMMUNE_SYSTEM: "иммунная система", GI: "ЖКТ", BLOOD: "кровь",
  BONE_MARROW: "костный мозг", JOINTS: "суставы", TENDONS: "сухожилия",
  LIGAMENTS: "связки", THYROID: "щитовидная железа", ADRENALS: "надпочечники",
  PANCREAS: "поджелудочная железа", PITUITARY: "гипофиз",
  HYPOTHALAMUS: "гипоталамус", GONADS: "гонады", TESTES: "яички",
  OVARIES: "яичники", PROSTATE: "простата", UTERUS: "матка",
  BLADDER: "мочевой пузырь", GALLBLADDER: "желчный пузырь",
  FAT: "жировая ткань", HAIR: "волосы", NAILS: "ногти", TEETH: "зубы",
  CELLS: "клетки", MITOCHONDRIA: "митохондрии", MICROBIOME: "микробиом",
  LYMPH: "лимфа", HORMONES: "гормоны", SPINE: "позвоночник",
  NERVOUS_SYSTEM: "нервная система", METABOLISM: "метаболизм",
  INFANT: "младенец", FAT_TISSUE: "жировая ткань",
  PLACENTA: "плацента", FETUS: "плод", LYMPHATIC: "лимфатическая система",
  SCALP: "кожа головы", PLATELETS: "тромбоциты", TISSUES: "ткани",
  URINARY: "мочевыводящие пути", ORGANS: "органы",
};

// --- CATEGORY RUSSIAN LABELS ---
const CAT_RU = {
  vitamin: "витамин", minerals: "минерал", mineral: "минерал",
  aminoacid: "аминокислота", amino: "аминокислота",
  antioxidant: "антиоксидант", adaptogen: "адаптоген",
  fatty_acid: "жирная кислота", fungi: "грибной экстракт",
  peptide: "пептид", pharma: "фарм. препарат",
  hormone: "гормон", prebiotic: "пребиотик",
  probiotic: "пробиотик", postbiotic: "постбиотик",
  metabiotic: "метабиотик", paraprobiotic: "парапробиотик",
  symbiotic: "синбиотик", polyphenol: "полифенол",
  complex: "комплексный препарат",
};

// Parse all substance entries
var substanceRegex = /\{\s*id:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)',\s*\n\s*categories:\s*\[([^\]]+)\],\s*\n\s*mechanisms:\s*\[([^\]]+)\],\s*\n\s*organs:\s*\[([^\]]+)\],\s*\n\s*deficiency:\s*'([^']*)',\s*\n\s*description:\s*'([^']*)',\s*\n\s*type:\s*'([^']+)'\s*\n\s*\}/g;
var match;
var substances = [];
var count = 0;

while ((match = substanceRegex.exec(d)) !== null) {
  var sub = {
    id: match[1],
    name: match[2],
    categories: match[3].replace(/'/g, "").split(",").map(function(s) { return s.trim(); }).filter(Boolean),
    mechanisms: match[4].replace(/'/g, "").split(",").map(function(s) { return s.trim(); }).filter(Boolean),
    organs: match[5].replace(/'/g, "").split(",").map(function(s) { return s.trim(); }).filter(Boolean),
    deficiency: match[6],
    description: match[7],
    type: match[8],
  };
  substances.push(sub);
  count++;
}

console.log("Parsed substances:", count);

// Generate new descriptions for short and template ones
var replaced = 0;
var generated = 0;

for (var i = 0; i < substances.length; i++) {
  var sub = substances[i];
  var oldDesc = sub.description;
  
  // Check if description needs enhancement
  var needsEnhance = oldDesc.length < 30 || 
    oldDesc.indexOf(", необходимый для") >= 0 || 
    oldDesc.indexOf(", участвующий в") >= 0;
  
  if (!needsEnhance) continue;
  
  // Generate new description
  var typeRu = CAT_RU[sub.type] || sub.type;
  var mechRuList = [];
  for (var j = 0; j < Math.min(3, sub.mechanisms.length); j++) {
    var mechKey = sub.mechanisms[j];
    var mechRu = MECH_RU[mechKey];
    if (mechRu) mechRuList.push(mechRu);
  }
  
  var organRuList = [];
  for (var j = 0; j < Math.min(3, sub.organs.length); j++) {
    var organKey = sub.organs[j];
    var organRu = ORGAN_RU[organKey];
    if (organRu) organRuList.push(organRu);
  }
  
  var newDesc = sub.name + " — " + typeRu;
  if (mechRuList.length > 0) {
    newDesc += ". " + mechRuList[0].charAt(0).toUpperCase() + mechRuList[0].slice(1);
    if (mechRuList.length > 1) newDesc += "; " + mechRuList[1];
    if (mechRuList.length > 2) newDesc += "; " + mechRuList[2];
  }
  newDesc += ".";
  if (organRuList.length > 0) {
    newDesc += " Мишени: " + organRuList.join(", ") + ".";
  }
  if (sub.deficiency && sub.deficiency !== "NONE" && sub.deficiency.length > 2) {
    newDesc += " Дефицит: " + sub.deficiency.replace(/_/g, " ").toLowerCase() + ".";
  }
  
  // Replace in the file
  // Find: description: 'oldDesc' after the specific substance id
  var searchStr = "id: '" + sub.id + "'";
  var idIdx = d.indexOf(searchStr);
  if (idIdx < 0) continue;
  
  // Find description field after this id
  var descIdx = d.indexOf("description: '", idIdx);
  if (descIdx < 0) continue;
  
  var descStart = descIdx + "description: '".length;
  var descEnd = d.indexOf("'", descStart);
  if (descEnd < 0) continue;
  
  var actualOldDesc = d.substring(descStart, descEnd);
  if (actualOldDesc !== oldDesc) {
    // Description doesn't match what we parsed, skip
    continue;
  }
  
  // Escape single quotes in new description
  var escapedNew = newDesc.replace(/'/g, "\\'");
  
  d = d.substring(0, descStart) + escapedNew + d.substring(descEnd);
  replaced++;
}

console.log("Descriptions replaced:", replaced);

// Verify
var subStart = d.indexOf("ALL_SUBSTANCES");
var subEnd = d.indexOf("ALL_INTERACTIONS");
var subSection = d.substring(subStart, subEnd);
var descRegex2 = /description:\s*'([^']*)'/g;
descRegex2.lastIndex = 0;
var total = 0, short2 = 0, template2 = 0, detailed2 = 0;
while ((m = descRegex2.exec(subSection)) !== null) {
  total++;
  var desc = m[1];
  if (desc.length < 30) short2++;
  else if (desc.indexOf(", необходимый для") >= 0 || desc.indexOf(", участвующий в") >= 0) template2++;
  else detailed2++;
}
console.log("\nAfter enhancement:");
console.log("  Total:", total);
console.log("  Short:", short2);
console.log("  Template:", template2);
console.log("  Detailed:", detailed2);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("\nFile saved! Size:", d.length);
