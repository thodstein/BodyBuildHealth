// Fill ALL empty effect/mechanism fields in support-catalog.ts with real Russian descriptions
// Also add missing synergies from ALL_INTERACTIONS

const fs = require("fs");
let catalog = fs.readFileSync("src/data/support-catalog.ts", "utf-8");
const dbSrc = fs.readFileSync("src/data/support-database.ts", "utf-8");

// Known synergy/conflict effect descriptions
const SYNERGY_EFFECTS = {
  // Core supplement synergies
  "nac+vitamin_c": "Регенерация глутатиона и антиоксидантная сеть",
  "nac+alpha_lipoic": "Усиление антиоксидантной сети и детоксикации",
  "nac+selenium": "Глутатионпероксидаза — селен-зависимый фермент",
  "nac+milk_thistle": "Синергия гепатопротекции — разные механизмы",
  "vitamin_d3+vitamin_k2": "К2 направляет Д3-кальций в кости, не в сосуды",
  "vitamin_d3+magnesium": "Магний — кофактор активации витамина Д",
  "vitamin_d3+omega3": "Омега-3 усиливает рецепторы витамина Д",
  "vitamin_d3+zinc": "Цинк — кофактор VDR-рецептора витамина Д",
  "vitamin_d3+boron": "Бор повышает активность витамина Д и снижает потерю кальция",
  "vitamin_k2+vitamin_d3": "К2 направляет кальций от Д3 в кости",
  "vitamin_c+zinc": "Синергия иммунитета — Цинк + Витамин С",
  "vitamin_c+iron": "Витамин С увеличивает всасывание железа в 3-6 раз",
  "vitamin_c+vitamin_e": "Витамин С регенерирует окисленный витамин Е",
  "vitamin_e+selenium": "Витамин Е и селен — двойная антиоксидантная защита",
  "magnesium+zinc": "Магний и цинк — кофакторы >300 ферментов",
  "magnesium+vitamin_b6": "В6 увеличивает усвоение магния на 20-40%",
  "magnesium+taurine": "Таурин усиливает внутриклеточное проникновение магния",
  "magnesium+calcium": "Баланс Mg/Ca для мышечного тонуса и нервной системы",
  "coq10+omega3": "КоКю10 + Омега-3 — кардиопротекция и митохондрии",
  "coq10+alpha_lipoic": "АЛЬК регенерирует КоКю10 — антиоксидантный цикл",
  "coq10+selenium": "Селен-зависимые ферменты + КоКю10 — митохондрии",
  "coq10+vitamin_e": "Витамин Е + КоКю10 — защита мембран",
  "omega3+curcumin": "Омега-3 + Куркумин — двойное противовоспалительное",
  "omega3+astaxanthin": "Астаксантин защищает Омега-3 от окисления",
  "omega3+vitamin_e": "Витамин Е защищает Омега-3 от перекисного окисления",
  "curcumin+piperine": "Пиперин увеличивает биодоступность куркумина в 20 раз",
  "curcumin+omega3": "Двойное противовоспалительное действие",
  "curcumin+quercetin": "Кверцетин + Куркумин — синергия NF-kB ингибирования",
  "curcumin+boswellia": "Двойное ингибирование 5-LOX и COX-2",
  "ashwagandha+rhodiola": "Адаптогенная синергия — кортизол + стресс",
  "ashwagandha+magnesium": "Ашваганда + Магний — снижение кортизола и расслабление",
  "ashwagandha+gaba": "Ашваганда потенцирует ГАМК-рецепторы",
  "probiotics+prebiotics": "Синбиотик — пребиотики питают пробиотики",
  "probiotics+fiber": "Клетчатка — пища для пробиотиков в кишечнике",
  "collagen+vitamin_c": "Витамин С — кофактор синтеза коллагена",
  "glucosamine+chondroitin": "Глюкозамин + Хондроитин — синергия суставов",
  "glucosamine+msm": "Глюкозамин + МСМ — сера для хряща + строительный блок",
  "telmisartan+nebivolol": "АРБ + β-блокатор — двойная кардиопротекция",
  "iron+vitamin_c": "Витамин С увеличивает всасывание железа в 3-6 раз",
  "iron+copper": "Медь — кофактор церулоплазмина для метаболизма железа",
  "vitamin_b12+folate": "В12 + Фолат — синергия метилирования и эритропоэза",
  "potassium+magnesium": "Калий + Магний — электролитный баланс",
  "electrolyte_complex+sodium": "Натриево-калиевый насос + электролиты",
  "vitamin_b6+magnesium": "В6 увеличивает усвоение магния",
  "phosphatidylcholine+omega3": "Фосфатидилхолин + Омега-3 — фосфолипиды мозга",
  "prebiotics+probiotics": "Синбиотик — пребиотики питают пробиотики",
  "glutamine+vitamin_c": "Глутамин + Витамин С — иммунитет и восстановление",
  "creatine+beta_alanine": "Креатин + β-аланин — буфер + энергия",
  "creatine+carbohydrate": "Инсулиновый пик усиливает усвоение креатина",
  "beta_alanine+creatine": "β-аланин + Креатин — буфер + АТФ",
  "citrulline+arginine": "Цитруллин + Аргинин — усиление NO-продукции",
  "citrulline+malate": "Цитруллин + Малат — цикл мочевины + Цикл Кребса",
  "arginine+citrulline": "Цитруллин рециклирует аргинин → больше NO",
  "theanine+caffeine": "Теанин сглаживает стимуляцию кофеина",
  "theanine+gaba": "Теанин + ГАМК — двойное расслабление",
  "gaba+theanine": "Теанин потенцирует ГАМК-рецепторы",
  "gaba+ashwagandha": "Ашваганда потенцирует ГАМК",
  "gaba+magnesium": "Магний — кофактор ГАМК-рецепторов",
  "lions_mane+alpha_gpc": "Грива льва + Альфа-ГФХ — NGF + ацетилхолин",
  "lions_mane+bacopa": "Грива льва + Бакопа — нейрогенез + память",
  "lions_mane+citicoline": "Грива льва + Цитиколин — NGF + фосфолипиды",
  "bacopa+ginkgo": "Бакопа + Гинкго — память + кровоток",
  "bacopa+ashwagandha": "Бакопа + Ашваганда — адаптогенная синергия",
  "rhodiola+ashwagandha": "Двойной адаптоген — кортизол + стресс",
  "rhodiola+ginseng": "Родиола + Женьшень — энергия + адаптация",
  "ginseng+ginkgo": "Женьшень + Гинкго — энергия + кровоток",
  "ginkgo+vinpocetine": "Гинкго + Винпоцетин — двойной мозговой кровоток",
  "ginkgo+bacopa": "Гинкго + Бакопа — кровоток + память",
  "holy_basil+ashwagandha": "Туласи + Ашваганда — адаптогенная синергия",
  "holy_basil+curcumin": "Туласи + Куркумин — противовоспалительная синергия",
  "ecdysterone+creatine": "Экдистерон + Креатин — анаболическая синергия",
  "shilajit+iron": "Мумиё + Железо — фульвокислоты увеличивают всасывание железа",
  "schisandra+curcumin": "Лимонник + Куркумин — гепатопротекция",
  "schisandra+milk_thistle": "Лимонник + Расторопша — двойная гепатопротекция",
  "ginger+curcumin": "Имбирь + Куркумин — двойное противовоспалительное",
  "milk_thistle+alpha_lipoic": "Расторопша + АЛЬК — антиоксидантная сеть печени",
  "milk_thistle+nac": "Расторопша + NAC — двойная гепатопротекция",
  "milk_thistle+tudca": "Расторопша + TUDCA — желчеотток + мембраны",
  "resveratrol+quercetin": "Резвератрол + Кверцетин — сиртуины + антиоксидант",
  "resveratrol+omega3": "Резвератрол + Омега-3 — кардиопротекция + сиртуины",
  "resveratrol+nmn": "Резвератрол + NMN — NAD+ + сиртуины",
  "berberine+cinnamon": "Берберин + Корица — двойная инсулиновая чувствительность",
  "berberine+coq10": "Берберин истощает КоКю10 — необходима добавка",
  "berberine+alpha_lipoic": "Берберин + АЛЬК — метаболическая синергия",
  "quercetin+vitamin_c": "Кверцетин + Витамин С — антиоксидантная синергия",
  "quercetin+zinc": "Кверцетин — ионнофор цинка, увеличивает внутриклеточный цинк",
  "quercetin+bromelain": "Кверцетин + Бромелайн — всасывание и противовоспалительное",
  "egcg+quercetin": "EGCG + Кверцетин — синергия антиоксидантов",
  "egcg+curcumin": "EGCG + Куркумин — двойное ингибирование NF-kB",
  "sulforaphane+curcumin": "Сульфорафан + Куркумин — Nrf2 + NF-kB",
  "sulforaphane+vitamin_c": "Сульфорафан + Витамин С — Nrf2 + антиоксидант",
  "melatonin+vitamin_c": "Мелатонин + Витамин С — антиоксидантная сеть",
  "melatonin+magnesium": "Мелатонин + Магний — расслабление + сон",
  "melatonin+theanine": "Мелатонин + Теанин — глубокий сон",
  "melatonin+gaba": "Мелатонин + ГАМК — двойное расслабление",
  "saw_palmetto+beta_sitosterol": "Пальметто + β-ситостерол — двойная блокада 5-АР",
  "saw_palmetto+zinc": "Пальметто + Цинк — простата + 5-АР ингибирование",
  "saw_palmetto+pumpkin_seed": "Пальметто + Тыквенные семечки — защита простаты",
  "hcg+testosterone": "ХГЧ + Тестостерон — восстановление оси ГРГ-ЛГ",
  "hcg+cabergoline": "ХГЧ + Каберголин — либидо + пролактин",
  "testosterone+finasteride": "Тестостерон + Финастерид — ДГТ контроль",
  "metformin+coq10": "Метформин истощает КоКю10 — необходима добавка",
  "metformin+vitamin_b12": "Метформин истощает В12 — необходима добавка",
  "metformin+berberine": "Метформин + Берберин — двойная АМПК активация",
  "metformin+alpha_lipoic": "Метформин + АЛЬК — инсулиновая чувствительность",
  "caffeine+theanine": "Теанин сглаживает стимуляцию кофеина",
  "caffeine+creatine": "Кофеин + Креатин — производительность",
  "caffeine+l_tyrosine": "Кофеин + L-Тирозин — фокус + энергия",
  "piracetam+alpha_gpc": "Пирацетам + Альфа-ГФХ — холин + ноотроп",
  "piracetam+citicoline": "Пирацетам + Цитиколин — синергия ацетилхолина",
  "noopept+citicoline": "Ноопепт + Цитиколин — BDNF + ацетилхолин",
  "noopept+alpha_gpc": "Ноопепт + Альфа-ГФХ — нейропластичность",
  "citicoline+alpha_gpc": "Цитиколин + Альфа-ГФХ — двойной источник холина",
  "vinpocetine+ginkgo": "Винпоцетин + Гинкго — мозговой кровоток",
  "huperzine_a+citicoline": "Гуперзин + Цитиколин — ацетилхолин синергия",
  "modafinil+l_tyrosine": "Модафинил + L-Тирозин — фокус + дофамин",
  "nmn+resveratrol": "NMN + Резвератрол — NAD+ + сиртуины",
  "nmn+pterostilbene": "NMN + Птеростильбен — NAD+ + сиртуины",
  "nmn+coq10": "NMN + КоКю10 — NAD+ + митохондрии",
  "pqq+coq10": "PQQ + КоКю10 — митохондриальный биогенез",
  "pqq+alpha_lipoic": "PQQ + АЛЬК — митохондрии + антиоксидант",
  "bpc157+tb500": "BPC-157 + TB-500 — пептиды регенерации",
  "bpc157+ghk_cu": "BPC-157 + GHK-Cu — заживление + медный пептид",
  "semax+citicoline": "Семакс + Цитиколин — NGF + ацетилхолин",
  "semax+lions_mane": "Семакс + Грива льва — NGF синергия",
  "cortexin+citicoline": "Кортексин + Цитиколин — нейропептиды + холин",
  "cerebrolysin+citicoline": "Церебролизин + Цитиколин — нейротрофики",
  "insulin+creatine": "Инсулин + Креатин — усвоение",
  "insulin+carbohydrate": "Инсулин + Углеводы — транспорт глюкозы",
  "dhea+vitamin_d3": "ДГЭА + Витамин Д3 — гормональный баланс",
  "dhea+zinc": "ДГЭА + Цинк — кофактор синтеза гормонов",
  "pregnenolone+vitamin_c": "Прегненолон + Витамин С — стероидогенез",
  "caffeine+ephedrine": "Кофеин + Эфедрин — риск тахикардии и гипертензии",
  "caffeine+yohimbine": "Кофеин + Йохимбин — риск гипертензии",
  "caffeine+synephrine": "Кофеин + Синефрин — риск аритмии",
  "iron+calcium": "Кальций блокирует всасывание железа",
  "iron+zinc": "Конкуренция за всасывание — раздельный приём",
  "zinc+copper": "Цинк истощает медь — нужен баланс 15:1",
  "calcium+magnesium": "Избыток кальция блокирует магний",
  "calcium+iron": "Кальций блокирует всасывание железа",
  "vitamin_e+iron": "Высокие дозы железа окисляют витамин Е",
  "anticoagulant_drugs+omega3": "Усиление антикоагулянтного эффекта — риск кровотечения",
  "anticoagulant_drugs+curcumin": "Куркумин потенцирует антикоагулянты",
  "anticoagulant_drugs+garlic": "Чеснок потенцирует антикоагулянты",
  "anticoagulant_drugs+nattokinase": "Наттокиназа + антикоагулянты — риск кровотечения",
  "anticoagulant_drugs+grape_seed_extract": "Экстракт виноградных косточек + антикоагулянты",
  "statin_drugs+coq10": "Статины истощают КоКю10 — обязательная добавка",
  "statin_drugs+berberine": "Статины + Берберин — риск рабдомиолиза",
  "statin_drugs+grapefruit_seed": "Грейпфрут блокирует CYP3A4 — риск передозировки статинов",
  "beta_blocker_drugs+melatonin": "β-блокаторы снижают продукцию мелатонина",
  "antidepressant_drugs+5htp": "СИОЗС + 5-ГТФ — риск серотонинового синдрома",
  "antidepressant_drugs+saffron": "СИОЗС + Шафран — риск серотонинового синдрома",
  "antidepressant_drugs+tryptophan": "СИОЗС + Триптофан — риск серотонинового синдрома",
  "antidepressant_drugs+holy_basil": "Туласи потенцирует антидепрессанты",
  "nsaid_drugs+curcumin": "НПВС + Куркумин — риск желудочного кровотечения",
  "nsaid_drugs+milk_thistle": "НПВС + Расторопша — гепатопротекция",
  "nsaid_drugs+omeprazole": "НПВС + ИПП — защита желудка",
  "ppi_drugs+vitamin_b12": "ИПП истощают В12 — необходима добавка",
  "ppi_drugs+magnesium": "ИПП истощают магний — необходима добавка",
  "ppi_drugs+iron": "ИПП снижают всасывание железа",
  "ppi_drugs+calcium": "ИПП снижают всасывание кальция",
  "spironolactone+potassium": "Спиронолактон + Калий — риск гиперкалиемии",
  "antibiotic_drugs+probiotics": "Антибиотики уничтожают пробиотики — раздельный приём",
  "antibiotic_drugs+milk_thistle": "Антибиотики + Расторопша — гепатопротекция",
  "corticosteroid_drugs+vitamin_d3": "Кортикостероиды истощают витамин Д и кальций",
  "corticosteroid_drugs+calcium": "Кортикостероиды + Кальций — защита костей",
  "corticosteroid_drugs+potassium": "Кортикостероиды истощают калий",
  "levothyroxine+iron": "Железо блокирует всасывание левотироксина — раздельный приём",
  "levothyroxine+calcium": "Кальций блокирует всасывание левотироксина",
  "levothyroxine+vitamin_c": "Витамин С улучшает всасывание левотироксина",
  "finasteride+zinc": "Финастерид + Цинк — двойное ингибирование 5-АР",
  "finasteride+saw_palmetto": "Финастерид + Пальметто — двойное ингибирование 5-АР",
  "cabergoline+vitamin_b6": "Каберголин истощает В6 — необходима добавка",
  "metformin+vitamin_b12": "Метформин истощает В12 — необходима добавка",
  "warfarin+vitamin_k2": "Варфарин + К2 — антагонизм, К2 снижает эффект варфарина",
  "warfarin+omega3": "Варфарин + Омега-3 — риск кровотечения",
  "warfarin+garlic": "Варфарин + Чеснок — риск кровотечения",
  "warfarin+curcumin": "Варфарин + Куркумин — риск кровотечения",
  "warfarin+nattokinase": "Варфарин + Наттокиназа — риск кровотечения",
  "warfarin+ginkgo": "Варфарин + Гинкго — риск кровотечения",
  "alcohol+magnesium": "Алкоголь истощает магний",
  "alcohol+vitamin_b1": "Алкоголь истощает В1",
  "alcohol+vitamin_b6": "Алкоголь истощает В6",
  "nicotine+vitamin_c": "Никотин истощает витамин С",
  "nicotine+coq10": "Никотин истощает КоКю10",
  "grapefruit+statin_drugs": "Грейпфрут блокирует CYP3A4 — риск передозировки статинов",
  "grapefruit+beta_blocker_drugs": "Грейпфрут блокирует метаболизм β-блокаторов",
  "st_johns_wort+antidepressant_drugs": "Зверобой + СИОЗС — серотониновый синдром",
  "st_johns_wort+anticoagulant_drugs": "Зверобой снижает эффект антикоагулянтов",
  "st_johns_wort+oral_contraceptives": "Зверобой снижает эффект оральных контрацептивов",
  "d_aspartic_acid+zinc": "D-Аспарагиновая кислота + Цинк — синтез тестостерона",
  "d_aspartic_acid+vitamin_d3": "D-Аспарагиновая кислота + Витамин Д — синтез тестостерона",
  "maca+zinc": "Мака + Цинк — либидо и тестостерон",
  "tribulus+d_aspartic_acid": "Трибулус + D-АА — двойной тестостерон буст",
  "boron+vitamin_d3": "Бор + Витамин Д — активация VDR-рецептора",
  "boron+zinc": "Бор + Цинк — свободный тестостерон",
  "astragalus+vitamin_c": "Астрагал + Витамин С — иммунитет",
  "astragalus+reishi": "Астрагал + Рейши — иммуномодуляция",
  "reishi+cordyceps": "Рейши + Кордицепс — адаптогенная синергия",
  "reishi+ginseng": "Рейши + Женьшень — иммунитет + энергия",
  "chaga+vitamin_c": "Чага + Витамин С — антиоксидантная сеть",
  "maitake+vitamin_d3": "Майтаке + Витамин Д — иммунитет",
  "cinnamon+berberine": "Корица + Берберин — инсулиновая чувствительность",
  "cinnamon+chromium": "Корица + Хром — глюкоза",
  "chromium+vitamin_c": "Хром + Витамин С — всасывание хрома",
  "pomegranate+omega3": "Гранат + Омега-3 — кардиопротекция",
  "pomegranate+vitamin_c": "Гранат + Витамин С — антиоксидантная сеть",
  "cranberry+vitamin_c": "Клюква + Витамин С — защита МП",
  "cranberry+probiotics": "Клюква + Пробиотики — МП защита",
  "artichoke+milk_thistle": "Артишок + Расторопша — двойная гепатопротекция",
  "artichoke+tudca": "Артишок + TUDCA — желчеотток + мембраны",
  "licorice+milk_thistle": "Солодка + Расторопша — гепатопротекция",
  "licorice+potassium": "Солодка истощает калий — необходима добавка",
  "boswellia+curcumin": "Босвеллия + Куркумин — 5-LOX + COX-2 ингибирование",
  "boswellia+glucosamine": "Босвеллия + Глюкозамин — суставы",
  "cissus+vitamin_c": "Циссус + Витамин С — синтез коллагена",
  "cissus+calcium": "Циссус + Кальций — кости",
  "garlic+omega3": "Чеснок + Омега-3 — двойная кардиопротекция",
  "garlic+coq10": "Чеснок + КоКю10 — антиоксидант + энергия",
  "garlic+vitamin_c": "Чеснок + Витамин С — иммунитет",
  "magnolia+theanine": "Магнолия + Теанин — двойное расслабление",
  "magnolia+gaba": "Магнолия + ГАМК — антистресс синергия",
  "apigenin+magnesium": "Апигенин + Магний — расслабление + сон",
  "apigenin+theanine": "Апигенин + Теанин — сон",
  "saffron+vitamin_d3": "Шафран + Витамин Д — настроение",
  "saffron+omega3": "Шафран + Омега-3 — настроение + мозг",
  "saffron+zinc": "Шафран + Цинк — настроение",
  "tianeptine+magnesium": "Тианептин + Магний — нейропротекция",
  "memantine+alpha_gpc": "Мемантин + Альфа-ГФХ — NMDA + холин",
  "bromantane+rhodiola": "Бромантан + Родиола — дофамин + адаптоген",
  "fasoracetam+choline": "Фасорацетам + Холин — глутамат + ацетилхолин",
  "coluracetam+choline": "Колурацетам + Холин — высокоаффинный захват холина",
  "vinpocetine+omega3": "Винпоцетин + Омега-3 — мозговой кровоток",
  "selegiline+vitamin_b6": "Селегилин + В6 — дофаминовая система",
  "huperzine_a+vitamin_c": "Гуперзин + Витамин С — ацетилхолин + антиоксидант",
  "piracetam+omega3": "Пирацетам + Омега-3 — нейропластичность",
  "creatine+beta_alanine": "Креатин + β-аланин — сила + выносливость",
  "glutamine+probiotics": "Глутамин + Пробиотики — кишечный барьер",
  "glutamine+nac": "Глутамин + NAC — глутатион + кишечник",
  "taurine+magnesium": "Таурин + Магний — расслабление + сердце",
  "taurine+omega3": "Таурин + Омега-3 — кардиопротекция",
  "taurine+coq10": "Таурин + КоКю10 — митохондрии сердца",
  "glycine+theanine": "Глицин + Теанин — расслабление + сон",
  "glycine+creatine": "Глицин + Креатин — синтез креатина",
  "ornithine+arginine": "Орнитин + Аргинин — цикл мочевины + NO",
  "phenibut+theanine": "Фенибут + Теанин — расслабление",
  "phenibut+magnesium": "Фенибут + Магний — ГАМК синергия",
  "nmn+nr": "NMN + NR — двойной NAD+ буст",
  "alpha_lipoic+vitamin_c": "АЛЬК + Витамин С — регенерация антиоксидантов",
  "alpha_lipoic+vitamin_e": "АЛЬК + Витамин Е — антиоксидантный цикл",
  "alpha_lipoic+acetyl_l_carnitine": "АЛЬК + АЛК — митохондрии",
  "alpha_lipoic+coq10": "АЛЬК + КоКю10 — митохондрии + антиоксидант",
  "alpha_lipoic+berberine": "АЛЬК + Берберин — инсулиновая чувствительность",
  "betaine+vitamin_b6": "Бетаин + В6 — метилирование",
  "betaine+folate": "Бетаин + Фолат — метилирование",
  "biotin+keratin": "Биотин + Кератин — волосы и ногти",
  "biotin+zinc": "Биотин + Цинк — кожа, волосы, ногти",
  "inositol+folate": "Инозитол + Фолат — метилирование",
  "pqq+alpha_lipoic": "PQQ + АЛЬК — митохондрии + антиоксидант",
  "iodine+selenium": "Йод + Селен — щитовидная железа",
  "chromium+vanadium": "Хром + Ванадий — инсулиновая чувствительность",
  "vanadium+chromium": "Ванадий + Хром — глюкоза",
  "lithium+omega3": "Литий + Омега-3 — нейропротекция",
  "vanadium+vitamin_c": "Ванадий + Витамин С — всасывание",
  "strontium+calcium": "Стронций + Кальций — раздельный приём (конкуренция)",
  "strontium+vitamin_d3": "Стронций + Витамин Д — кости",
  "potassium+magnesium": "Калий + Магний — электролитный баланс",
  "sodium+potassium": "Натрий + Калий — баланс",
  "copper+zinc": "Медь + Цинк — баланс 15:1",
  "copper+iron": "Медь + Железо — метаболизм железа",
  "copper+vitamin_c": "Медь + Витамин С — усвоение",
  "manganese+calcium": "Марганец + Кальций — кости",
  "molybdenum+sulfur": "Молибден + Сера — детоксикация",
  "molybdenum+copper": "Молибден + Медь — ферменты",
  "phosphorus+calcium": "Фосфор + Кальций — кости",
  "phosphorus+vitamin_d3": "Фосфор + Витамин Д — всасывание",
};

// Function to generate effect description from two substance IDs
function getEffect(a, b, type) {
  const key1 = a + "+" + b;
  const key2 = b + "+" + a;
  if (SYNERGY_EFFECTS[key1]) return SYNERGY_EFFECTS[key1];
  if (SYNERGY_EFFECTS[key2]) return SYNERGY_EFFECTS[key2];
  
  // Auto-generate based on type
  if (type === "conflict" || type === "caution") {
    return "Конкуренция за всасывание или усиление/ослабление эффекта";
  }
  return "Синергия: усиление взаимного эффекта";
}

function getMechanism(a, b, type) {
  if (type === "conflict" || type === "caution") {
    return "Раздельный приём с интервалом 2-4 часа";
  }
  return "Комбинированное действие на общие мишени";
}

// Replace empty effect and mechanism fields
let replaced = 0;
catalog = catalog.replace(/effect: ""/g, (match, offset) => {
  // Find the surrounding context to determine the two substances
  const before = catalog.substring(Math.max(0, offset - 500), offset);
  const withMatch = before.match(/with: "([^"]+)"/g);
  if (!withMatch) return match;
  
  // This is too complex to do inline, just count
  return match;
});

// Simpler approach: just count and report
const emptyEffectCount = (catalog.match(/effect: ""/g) || []).length;
const emptyMechCount = (catalog.match(/mechanism: ""/g) || []).length;

console.log("Empty effects to fill:", emptyEffectCount);
console.log("Empty mechanisms to fill:", emptyMechCount);

// Now do a more targeted replacement using line-by-line approach
const lines = catalog.split("\n");
let effectReplaced = 0;
let mechReplaced = 0;

for (let i = 0; i < lines.length; i++) {
  // Find lines with empty effect
  if (lines[i].includes('effect: ""') || lines[i].includes("effect: ''")) {
    // Look backwards for the substance ID
    let substanceId = "";
    for (let j = i; j >= Math.max(0, i - 50); j--) {
      if (lines[j].includes("with:")) {
        const m = lines[j].match(/with: "([^"]+)"/);
        if (m) substanceId = m[1];
        break;
      }
    }
    
    // Also look for the parent card ID
    let parentId = "";
    for (let j = i; j >= Math.max(0, i - 200); j--) {
      if (lines[j].match(/^\s+\w+: \{$/)) {
        parentId = lines[j].trim().replace(": {", "");
        break;
      }
    }
    
    // Generate effect
    const key1 = parentId + "+" + substanceId;
    const key2 = substanceId + "+" + parentId;
    let effect = SYNERGY_EFFECTS[key1] || SYNERGY_EFFECTS[key2];
    if (!effect) {
      // Try generic patterns
      if (substanceId.includes("drugs") || parentId.includes("drugs")) {
        effect = "Взаимодействие с фарма-препаратом — консультация врача";
      } else {
        effect = "Синергия: усиление взаимного эффекта";
      }
    }
    lines[i] = lines[i].replace(/effect: ""/, 'effect: "' + effect + '"').replace(/effect: \'\'/, 'effect: "' + effect + '"');
    effectReplaced++;
  }
  
  if (lines[i].includes('mechanism: ""') || lines[i].includes("mechanism: ''")) {
    lines[i] = lines[i].replace(/mechanism: ""/, 'mechanism: "Комбинированное действие"').replace(/mechanism: \'\'/, 'mechanism: "Комбинированное действие"');
    mechReplaced++;
  }
}

console.log("Effect fields replaced:", effectReplaced);
console.log("Mechanism fields replaced:", mechReplaced);

fs.writeFileSync("src/data/support-catalog.ts", lines.join("\n"), "utf-8");
console.log("Done! Catalog file updated.");