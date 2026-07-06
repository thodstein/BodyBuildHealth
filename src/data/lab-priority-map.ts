// ══════════════════════════════════════════════════════════════════════════════
//  LAB PRIORITY MAP — система приоритетов БАД/препаратов по анализам
//  Для каждого маркёра: упорядоченный список веществ (1-й/2-й/3-й выбор)
//  с порогом назначения (mild/moderate/severe) и бренд-неймом.
//
//  Интеграция:
//   - recommendation-engine.ts → getPrioritySubstances(marker, severity)
//   - engine.ts (calculateSupportTZ) → отбор по приоритету при наличии labs
//   - UI: бейдж приоритета рядом с названием вещества
// ══════════════════════════════════════════════════════════════════════════════

export type SeverityLevel = 'mild' | 'moderate' | 'severe';

export interface LabPriorityEntry {
  substanceId: string;        // id из SUPPORT_CATALOG_DATA
  priority: 1 | 2 | 3 | 4;    // 1-й/2-й/3-й/4-й выбор
  brandName?: string;         // коммерческое название (Легалон, Урсосан, и т.д.)
  reason: string;             // клиническое обоснование (почему это вещество для этого маркёра)
  minSeverity: SeverityLevel; // при какой степени отклонения назначать
}

export interface LabPriorityMap {
  marker: string;
  entries: LabPriorityEntry[];
}

// ══════════════════════════════════════════════════════════════════════════════
//  КАРТА ПРИОРИТЕТОВ
// ══════════════════════════════════════════════════════════════════════════════

export const LAB_PRIORITY_MAP: LabPriorityMap[] = [

  // ─── ПЕЧЕНЬ / Гепатобилиарная ───
  { marker: 'ALT', entries: [
    { substanceId: 'nac', priority: 1, brandName: 'Ацетилцистеин', reason: 'Донатор SH-групп → синтез глутатиона → детоксикация гепатотоксичных метаболитов', minSeverity: 'mild' },
    { substanceId: 'tudca', priority: 2, brandName: 'Урсосан / Урсофальк', reason: 'Гидрофильная жёлчная кислота → снижение ER-стресса, защита мембран гепатоцитов', minSeverity: 'moderate' },
    { substanceId: 'milk_thistle', priority: 3, brandName: 'Легалон / Силимар', reason: 'Силимарин → стабилизация мембран, антиоксидантная защита, регенерация', minSeverity: 'mild' },
    { substanceId: 'alpha_lipoic', priority: 4, brandName: 'Берлитион / Тиоктацид', reason: 'Активатор Nrf2 → ферменты фазы II, хелатация металлов, регенерация антиоксидантов', minSeverity: 'moderate' },
  ]},
  { marker: 'AST', entries: [
    { substanceId: 'nac', priority: 1, brandName: 'Ацетилцистеин', reason: 'Синтез глутатиона, нейтрализация свободных радикалов в гепатоцитах', minSeverity: 'mild' },
    { substanceId: 'tudca', priority: 2, brandName: 'Урсосан / Урсофальк', reason: 'Снижение ER-стресса, улучшение желчеоттока', minSeverity: 'moderate' },
    { substanceId: 'milk_thistle', priority: 3, brandName: 'Легалон / Силимар', reason: 'Мембранная защита, антиоксидантный эффект', minSeverity: 'mild' },
    { substanceId: 'alpha_lipoic', priority: 4, brandName: 'Берлитион', reason: 'Nrf2-активация, ферменты фазы II детоксикации', minSeverity: 'moderate' },
  ]},
  { marker: 'GGT', entries: [
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан / Урсофальк', reason: 'Стимуляция BSEP-зависимого желчеоттока, снижение холестаза', minSeverity: 'mild' },
    { substanceId: 'milk_thistle', priority: 2, brandName: 'Легалон / Силимар', reason: 'Силимарин → защита мембран жёлчных канальцев', minSeverity: 'mild' },
    { substanceId: 'phosphatidylcholine', priority: 3, brandName: 'Лецитин / Эссенциале', reason: 'Восстановление мембран гепатоцитов, улучшение текучести', minSeverity: 'moderate' },
  ]},
  { marker: 'Bilirubin', entries: [
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан / Урсофальк', reason: 'Улучшение желчеоттока, снижение конъюгированного билирубина', minSeverity: 'mild' },
    { substanceId: 'milk_thistle', priority: 2, brandName: 'Легалон', reason: 'Защита мембран, улучшение экскреции билирубина', minSeverity: 'mild' },
    { substanceId: 'vitamin_k2', priority: 3, brandName: 'Менахинон-7 (MK-7)', reason: 'Кофактор для синтеза факторов свёртывания в печени', minSeverity: 'moderate' },
  ]},
  { marker: 'DIRECT_BIL', entries: [
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан / Урсофальк', reason: 'Стимуляция BSEP, экскреция прямого билирубина с жёлчью', minSeverity: 'mild' },
    { substanceId: 'vitamin_k2', priority: 2, brandName: 'Менахинон-7', reason: 'Поддержка печёночного синтеза факторов свёртывания', minSeverity: 'moderate' },
  ]},
  { marker: 'ALP', entries: [
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан / Урсофальк', reason: 'Снижение холестатической ЩФ через улучшение желчеоттока', minSeverity: 'moderate' },
    { substanceId: 'milk_thistle', priority: 2, brandName: 'Легалон', reason: 'Мембранная защита жёлчных канальцев', minSeverity: 'moderate' },
  ]},
  { marker: 'AMMONIA', entries: [
    { substanceId: 'nac', priority: 1, brandName: 'Ацетилцистеин', reason: 'Связывание аммиака через глутатион, детоксикация', minSeverity: 'moderate' },
    { substanceId: 'glutamine', priority: 2, brandName: 'Глутамин', reason: 'Субстрат для синтеза глутамина → связывание аммиака в печени', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 3, brandName: 'Берлитион', reason: 'Активация детоксикационных путей', minSeverity: 'severe' },
  ]},
  { marker: 'LACTATE', entries: [
    { substanceId: 'coq10', priority: 1, brandName: 'Кудесан / Коэнзим Q10', reason: 'Митохондриальный перенос электронов, снижение лактата', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Берлитион', reason: 'Митохондриальная защита, антиоксидант', minSeverity: 'moderate' },
    { substanceId: 'shilajit', priority: 3, brandName: 'Мумиё / Шиладжит', reason: 'Адаптоген, улучшение клеточного энергообмена', minSeverity: 'severe' },
  ]},

  // ─── ССС / Сердечно-сосудистая ───
  { marker: 'LDL', entries: [
    { substanceId: 'bergamot', priority: 1, brandName: 'Бергамот / Кардио-Бергамот', reason: 'Ингибиция HMG-CoA редуктазы (натуральный статин), ↓ ЛПНП на 15-25%', minSeverity: 'mild' },
    { substanceId: 'berberine', priority: 2, brandName: 'Берберин', reason: 'AMPK-активация → ↓ синтез холестерина, ↑ рецепторы ЛПНП', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 3, brandName: 'Омакор / ЭПК+ДГК', reason: 'Снижение синтеза ЛПНП в печени, ↑ ЛПВП, антиатерогенный эффект', minSeverity: 'mild' },
    { substanceId: 'red_yeast_rice', priority: 4, brandName: 'Красный дрожжевой рис', reason: 'Монаколин K → ингибиция HMG-CoA редуктазы (аналог ловастатина)', minSeverity: 'severe' },
  ]},
  { marker: 'HDL', entries: [
    { substanceId: 'omega3', priority: 1, brandName: 'Омакор / ЭПК+ДГК', reason: '↑ синтез ЛПВП через ABCA1, антиатерогенный эффект', minSeverity: 'mild' },
    { substanceId: 'niacin', priority: 2, brandName: 'Никотиновая кислота / Ниацин', reason: 'Самый мощный ↑ ЛПВП (+15-35%), ↓ ЛПНП', minSeverity: 'moderate' },
    { substanceId: 'vitamin_e', priority: 3, brandName: 'Витамин E / Токоферол', reason: 'Антиоксидантная защита ЛПВП от окисления', minSeverity: 'moderate' },
  ]},
  { marker: 'Triglycerides', entries: [
    { substanceId: 'omega3', priority: 1, brandName: 'Омакор / ЭПК+ДГК', reason: '↓ синтез ТГ в печени, ↑ липолиз (наиболее эффективен при ТГ)', minSeverity: 'mild' },
    { substanceId: 'berberine', priority: 2, brandName: 'Берберин', reason: 'AMPK-активация → ↓ синтез ТГ', minSeverity: 'moderate' },
    { substanceId: 'niacin', priority: 3, brandName: 'Никотиновая кислота', reason: '↓ липолиз в жировой ткани → ↓ СЖК → ↓ синтез ТГ', minSeverity: 'moderate' },
  ]},
  { marker: 'BP_SYSTOLIC', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис', reason: 'Блокада AT1-рецепторов → вазодилатация, ↓ АД, нефропротекция', minSeverity: 'mild' },
    { substanceId: 'nebivolol', priority: 2, brandName: 'Небилет', reason: 'β1-селективная блокада + NO-модуляция → ↓ АД + ↓ ЧСС', minSeverity: 'moderate' },
    { substanceId: 'diosmin', priority: 3, brandName: 'Диосмин / Детралекс', reason: 'Флавоноид → улучшение тонуса вен, микроциркуляции', minSeverity: 'mild' },
  ]},
  { marker: 'BP_DIASTOLIC', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис', reason: 'ARB → ↓ периферического сопротивления → ↓ диастолы', minSeverity: 'mild' },
    { substanceId: 'diosmin', priority: 2, brandName: 'Диосмин / Детралекс', reason: 'Венотоник, улучшение микроциркуляции', minSeverity: 'moderate' },
    { substanceId: 'pycnogenol', priority: 3, brandName: 'Пикногенол', reason: '↑ NO → вазодилатация, ↓ диастолического АД', minSeverity: 'moderate' },
  ]},
  { marker: 'HR', entries: [
    { substanceId: 'nebivolol', priority: 1, brandName: 'Небилет', reason: 'β1-блокада → ↓ ЧСС, ↓ работа сердца + NO-вазодилатация', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 2, brandName: 'Магний цитрат / Малат', reason: 'Блокада Ca-каналов → расслабление миокарда, ↓ ЧСС', minSeverity: 'mild' },
    { substanceId: 'l_theanine', priority: 3, brandName: 'L-Теанин', reason: '↑ α-волны → ↓ симпатического тонуса → ↓ ЧСС', minSeverity: 'mild' },
  ]},
  { marker: 'CK', entries: [
    { substanceId: 'coq10', priority: 1, brandName: 'Кудесан / Коэнзим Q10', reason: 'Митохондриальный субстрат → ↓ повреждения миоцитов → ↓ КФК', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 2, brandName: 'Магний', reason: 'Антиишемический эффект, ↓ мышечного повреждения', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 3, brandName: 'Берлитион', reason: 'Антиоксидантная защита миоцитов', minSeverity: 'severe' },
  ]},
  { marker: 'NT_PROBNP', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис', reason: '↓ преднагрузки → ↓ растяжения миокарда → ↓ NT-proBNP', minSeverity: 'moderate' },
    { substanceId: 'nebivolol', priority: 2, brandName: 'Небилет', reason: '↓ работы сердца → ↓ напряжения стенки → ↓ NT-proBNP', minSeverity: 'moderate' },
    { substanceId: 'coq10', priority: 3, brandName: 'Кудесан', reason: 'Энергетическая поддержка миокарда', minSeverity: 'severe' },
  ]},
  { marker: 'ENDOTHELIN1', entries: [
    { substanceId: 'pycnogenol', priority: 1, brandName: 'Пикногенол', reason: '↑ eNOS → ↑ NO → ↓ эндотелина-1', minSeverity: 'moderate' },
    { substanceId: 'telmisartan', priority: 2, brandName: 'Микардис', reason: 'ARB → ↓ экспрессии ET-1', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 3, brandName: 'Омакор', reason: '↓ воспаления эндотелия → ↓ ET-1', minSeverity: 'severe' },
  ]},
  { marker: 'NO_MARKER', entries: [
    { substanceId: 'pycnogenol', priority: 1, brandName: 'Пикногенол', reason: 'Активация eNOS → ↑ синтез NO', minSeverity: 'mild' },
    { substanceId: 'nebivolol', priority: 2, brandName: 'Небилет', reason: 'β3-агонизм → ↑ NO-зависимая вазодилатация', minSeverity: 'moderate' },
    { substanceId: 'telmisartan', priority: 3, brandName: 'Микардис', reason: 'ARB → улучшение функции эндотелия', minSeverity: 'moderate' },
  ]},

  // ─── ГЕМАТОЛОГИЯ / Кровь ───
  { marker: 'HCT', entries: [
    { substanceId: 'serrapeptase', priority: 1, brandName: 'Серрапептаза / Серрата', reason: 'Расщепление α2-макроглобулина → ↑ фибринолиз → улучшение текучести крови', minSeverity: 'mild' },
    { substanceId: 'nattokinase', priority: 2, brandName: 'Наттокиназа', reason: 'Прямая активация плазминогена → фибринолиз, ↓ вязкости', minSeverity: 'mild' },
    { substanceId: 'naringin', priority: 3, brandName: 'Нарингин / Грейпфрут экстракт', reason: 'Ингибиция тромбоцитарной агрегации, ↓ вязкости', minSeverity: 'moderate' },
    { substanceId: 'lumbrokinase', priority: 4, brandName: 'Лумброкиназа', reason: 'Мощный фибринолитик (дождевые черви), ↓ фибриногена', minSeverity: 'severe' },
  ]},
  { marker: 'Hemoglobin', entries: [
    { substanceId: 'serrapeptase', priority: 1, brandName: 'Серрапептаза', reason: 'Улучшение микроциркуляции, ↓ вязкости при высоком Hb', minSeverity: 'mild' },
    { substanceId: 'nattokinase', priority: 2, brandName: 'Наттокиназа', reason: 'Фибринолиз, ↓ тромбообразования при полицитемии', minSeverity: 'mild' },
    { substanceId: 'aspirin', priority: 3, brandName: 'Аспирин / Кардиомагнил', reason: 'Ингибиция COX-1 → ↓ агрегации тромбоцитов', minSeverity: 'moderate' },
  ]},
  { marker: 'HGB', entries: [
    { substanceId: 'iron_supplement', priority: 1, brandName: 'Железо / Сорбифер', reason: 'Субстрат для синтеза гемоглобина при дефиците', minSeverity: 'moderate' },
    { substanceId: 'folate', priority: 2, brandName: 'Фолат / Метилфолат', reason: 'Кофактор эритропоэза, синтеза ДНК', minSeverity: 'moderate' },
    { substanceId: 'vitamin_b12', priority: 3, brandName: 'B12 / Метилкобаламин', reason: 'Кофакорн эритропоэза, созревания эритроцитов', minSeverity: 'moderate' },
  ]},
  { marker: 'PLT', entries: [
    { substanceId: 'aspirin', priority: 1, brandName: 'Аспирин / Кардиомагнил', reason: 'Ингибиция TXA2 → ↓ агрегации тромбоцитов', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омакор', reason: 'ЭПК → простациклин → ↓ агрегации', minSeverity: 'mild' },
    { substanceId: 'nattokinase', priority: 3, brandName: 'Наттокиназа', reason: 'Фибринолитик, ↓ тромбообразования', minSeverity: 'moderate' },
  ]},
  { marker: 'D-dimer', entries: [
    { substanceId: 'serrapeptase', priority: 1, brandName: 'Серрапептаза', reason: 'Расщепление фибрина в плазме → ↓ D-димера', minSeverity: 'mild' },
    { substanceId: 'nattokinase', priority: 2, brandName: 'Наттокиназа', reason: 'Активация плазминогена → ↓ фибрина → ↓ D-димера', minSeverity: 'mild' },
    { substanceId: 'naringin', priority: 3, brandName: 'Нарингин', reason: 'Ингибиция агрегации тромбоцитов, ↓ фибриногена', minSeverity: 'moderate' },
    { substanceId: 'lumbrokinase', priority: 4, brandName: 'Лумброкиназа', reason: 'Мощный фибринолитик (применяется при D-димере > 500)', minSeverity: 'severe' },
  ]},
  { marker: 'Fibrinogen', entries: [
    { substanceId: 'serrapeptase', priority: 1, brandName: 'Серрапептаза', reason: 'Протеолиз фибриногена → ↓ уровня', minSeverity: 'moderate' },
    { substanceId: 'nattokinase', priority: 2, brandName: 'Наттокиназа', reason: 'Прямой фибринолитик, ↓ фибриногена', minSeverity: 'moderate' },
    { substanceId: 'lumbrokinase', priority: 3, brandName: 'Лумброкиназа', reason: 'Мощный фибринолитик при гипофибринолизисе', minSeverity: 'severe' },
  ]},
  { marker: 'ESR', entries: [
    { substanceId: 'omega3', priority: 1, brandName: 'Омакор', reason: '↓ воспаления → ↓ фибриногена → ↓ СОЭ', minSeverity: 'mild' },
    { substanceId: 'curcumin_sup', priority: 2, brandName: 'Куркумин / Куркуминоид', reason: 'NF-κB-ингибиция → ↓ воспалительных маркёров', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 3, brandName: 'Ашваганда / Withania somnifera', reason: 'Иммуно-модуляция, ↓ системного воспаления', minSeverity: 'moderate' },
  ]},

  // ─── ПОЧКИ / Почечная ───
  { marker: 'Creatinine', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал / Astragalus membranaceus', reason: 'Антиапоптозный эффект в клубочках, ↓ протеинурии, ↑ eGFR', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Осмопротекция, антиоксидантная защита тубулярных клеток', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 3, brandName: 'Кордицепс / Cordyceps sinensis', reason: 'Улучшение почечного кровотока, ↓ креатинина', minSeverity: 'moderate' },
  ]},
  { marker: 'Urea', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал', reason: '↓ катаболизма белков → ↓ мочевины, нефропротекция', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Осмопротекция тубулярных клеток', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 3, brandName: 'Кордицепс', reason: 'Улучшение почечной гемодинамики', minSeverity: 'moderate' },
  ]},
  { marker: 'CYSTATIN_C', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал', reason: 'Антиапоптозный эффект → ↓ повреждения клубочков → ↓ цистатина C', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 2, brandName: 'Кордицепс', reason: 'Улучшение почечного кровотока, нефропротекция', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 3, brandName: 'Таурин', reason: 'Защита тубулярных клеток', minSeverity: 'moderate' },
  ]},
  { marker: 'URIC_ACID', entries: [
    { substanceId: 'taurine', priority: 1, brandName: 'Таурин', reason: '↑ экскреция уратов почками → ↓ мочевой кислоты', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 2, brandName: 'Кордицепс', reason: '↓ синтеза уратов, ↑ экскреция', minSeverity: 'moderate' },
    { substanceId: 'astragalus', priority: 3, brandName: 'Астрагал', reason: 'Нефропротекция при гиперурикемии', minSeverity: 'severe' },
  ]},
  { marker: 'EGFR', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал', reason: '↑ клубочковой фильтрации, нефропротекция', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Защита тубулярных клеток, улучшение фильтрации', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 3, brandName: 'Кордицепс', reason: 'Улучшение почечного кровотока → ↑ eGFR', minSeverity: 'moderate' },
    { substanceId: 'd_mannose', priority: 4, brandName: 'D-Манноза', reason: 'Профилактика уроинфекций, защита МВП', minSeverity: 'mild' },
  ]},
  { marker: 'PROTEIN_URINE', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал', reason: 'Доказано ↓ протеинурии при хронической болезни почек', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Защита тубулярных клеток от протеинового повреждения', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 3, brandName: 'Кордицепс', reason: 'Улучшение почечной гемодинамики, ↓ протеинурии', minSeverity: 'moderate' },
  ]},
  { marker: 'MICROALB', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал', reason: '↓ микроальбуминурии на ранних стадиях нефропатии', minSeverity: 'mild' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Защита тубулярных клеток', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 3, brandName: 'Кордицепс', reason: 'Улучшение почечного кровотока', minSeverity: 'moderate' },
  ]},

  // ─── ЭНДОКРИННАЯ / Гормоны ───
  { marker: 'TT', entries: [
    { substanceId: 'zinc_sup', priority: 1, brandName: 'Цинк (пиколинат / бисглицинат)', reason: 'Кофактор 17β-HSD → синтез тестостерона, ↓ ароматизации', minSeverity: 'moderate' },
    { substanceId: 'boron', priority: 2, brandName: 'Бор (3 мг/день)', reason: '↓ SHBG → ↑ свободного T, ↓ экскреции T почками', minSeverity: 'moderate' },
    { substanceId: 'tongkat_ali', priority: 3, brandName: 'Тонгкат Али / Eurycoma longifolia', reason: '↑ LH → ↑ синтеза T, ↓ SHBG', minSeverity: 'moderate' },
    { substanceId: 'shilajit', priority: 4, brandName: 'Мумиё / Шиладжит', reason: '↑ синтеза T через гонадотропный эффект', minSeverity: 'severe' },
  ]},
  { marker: 'FT', entries: [
    { substanceId: 'boron', priority: 1, brandName: 'Бор (3-6 мг/день)', reason: '↓ SHBG → ↑ свободного T (доказано +28% за 7 дней)', minSeverity: 'moderate' },
    { substanceId: 'tongkat_ali', priority: 2, brandName: 'Тонгкат Али', reason: '↑ свободного T через ↓ SHBG', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 3, brandName: 'Цинк', reason: 'Кофактор синтеза T, ↓ ароматизации', minSeverity: 'moderate' },
  ]},
  { marker: 'E2', entries: [
    { substanceId: 'dim', priority: 1, brandName: 'DIM / Индол-3-карбинол', reason: 'Сдвиг метаболизма E2 в сторону 2-гидрокси (защитный)', minSeverity: 'mild' },
    { substanceId: 'indinol', priority: 2, brandName: 'Индинол / Indinol Forte', reason: 'I3C → DIM в организме, ↓ эстрогенной нагрузки', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 3, brandName: 'Цинк', reason: 'Ингибиция ароматазы (через ↓ PGE2)', minSeverity: 'moderate' },
  ]},
  { marker: 'PRL', entries: [
    { substanceId: 'vitex', priority: 1, brandName: 'Витекс / Агнукастон', reason: 'Дофаминергический эффект → ↓ пролактина (натуральный)', minSeverity: 'mild' },
    { substanceId: 'p5p', priority: 2, brandName: 'P-5-P / Пиридоксаль-5-фосфат', reason: 'Кофактор L-ДОФА → дофамин → ↓ пролактина', minSeverity: 'mild' },
    { substanceId: 'cabergoline', priority: 3, brandName: 'Достинекс / Каберголин', reason: 'D2-агонист → мощное ↓ пролактина (применяется при >40 нг/мл)', minSeverity: 'moderate' },
  ]},
  { marker: 'LH', entries: [
    { substanceId: 'enclomiphene', priority: 1, brandName: 'Энкломифен / Androxal', reason: 'Антагонист эстрогеновых рецепторов гипофиза → ↑ LH/FSH', minSeverity: 'moderate' },
    { substanceId: 'daa', priority: 2, brandName: 'D-аспарагиновая кислота (DAA)', reason: '↑ GnRH → ↑ LH (краткосрочно 7-12 дней)', minSeverity: 'moderate' },
    { substanceId: 'tamoxifen', priority: 3, brandName: 'Тамоксифен / Нолвадекс', reason: 'SERM → ↑ LH/FSH в ПКТ', minSeverity: 'moderate' },
  ]},
  { marker: 'FSH', entries: [
    { substanceId: 'enclomiphene', priority: 1, brandName: 'Энкломифен / Androxal', reason: 'Антагонист рецепторов → ↑ FSH/LH', minSeverity: 'moderate' },
    { substanceId: 'daa', priority: 2, brandName: 'DAA', reason: '↑ GnRH → ↑ FSH/LH', minSeverity: 'moderate' },
    { substanceId: 'tamoxifen', priority: 3, brandName: 'Тамоксифен', reason: 'SERM для восстановления оси HPTA', minSeverity: 'moderate' },
  ]},
  { marker: 'SHBG', entries: [
    { substanceId: 'boron', priority: 1, brandName: 'Бор (3-6 мг)', reason: 'Доказано ↓ SHBG на 20-30% → ↑ свободного T', minSeverity: 'moderate' },
    { substanceId: 'tongkat_ali', priority: 2, brandName: 'Тонгкат Али', reason: '↓ SHBG через ↓ экспрессии гена SHBG', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 3, brandName: 'Цинк', reason: '↓ SHBG при дефиците Zn', minSeverity: 'moderate' },
  ]},
  { marker: 'DHT', entries: [
    { substanceId: 'saw_palmetto', priority: 1, brandName: 'Со Пальметто / Сереноа', reason: 'Ингибиция 5α-редуктазы → ↓ DHT (мощный растительный)', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 2, brandName: 'Цинк', reason: 'Ингибиция 5α-редуктазы (особенно при дефиците Zn)', minSeverity: 'moderate' },
  ]},
  { marker: 'CORTISOL', entries: [
    { substanceId: 'ashwagandha', priority: 1, brandName: 'Ашваганда / KSM-66', reason: '↓ кортизола на 20-30% (доказано в RCT), адаптоген', minSeverity: 'mild' },
    { substanceId: 'phosphatidylserine', priority: 2, brandName: 'Фосфатидилсерин', reason: '↓ кортизола при стрессе (особенно после тренировок)', minSeverity: 'moderate' },
    { substanceId: 'magnesium_l_threonate', priority: 3, brandName: 'Mg L-треонат', reason: '↓ HPA-оси, улучшение сна → ↓ кортизола', minSeverity: 'moderate' },
    { substanceId: 'l_theanine', priority: 4, brandName: 'L-Теанин', reason: '↑ α-волны → ↓ стресс-ответа → ↓ кортизола', minSeverity: 'mild' },
  ]},
  { marker: 'DHEA_S', entries: [
    { substanceId: 'ashwagandha', priority: 1, brandName: 'Ашваганда / KSM-66', reason: '↑ DHEA-S через адаптогенный эффект', minSeverity: 'moderate' },
    { substanceId: 'shilajit', priority: 2, brandName: 'Мумиё / Шиладжит', reason: '↑ DHEA-S, ↑ T (доказано в исследованиях)', minSeverity: 'moderate' },
    { substanceId: 'pregnenolone', priority: 3, brandName: 'Прегненолон / "гормон памяти"', reason: 'Прямой предшественник DHEA-S', minSeverity: 'severe' },
  ]},
  { marker: 'TSH', entries: [
    { substanceId: 'zinc_sup', priority: 1, brandName: 'Цинк', reason: 'Кофактор TRH → TSH → T4, ↓ TSH при дефиците Zn', minSeverity: 'moderate' },
    { substanceId: 'selenium_sup', priority: 2, brandName: 'Селен (200 мкг)', reason: 'Кофактор дейодиназы D1 → T4→T3, ↓ TSH', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 3, brandName: 'Ашваганда', reason: '↓ TSH при субклиническом гипотиреозе', minSeverity: 'moderate' },
  ]},
  { marker: 'FT3', entries: [
    { substanceId: 'ashwagandha', priority: 1, brandName: 'Ашваганда', reason: '↑ T3/T4 при субклиническом гипотиреозе', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 2, brandName: 'Цинк', reason: 'Кофактор дейодиназы, ↓ конверсии T4→T3 при дефиците', minSeverity: 'moderate' },
    { substanceId: 'selenium_sup', priority: 3, brandName: 'Селен', reason: 'Кофактор дейодиназы D1/D2 → T4→T3', minSeverity: 'moderate' },
  ]},
  { marker: 'FT4', entries: [
    { substanceId: 'ashwagandha', priority: 1, brandName: 'Ашваганда', reason: '↑ синтеза T4 в щитовидной железе', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 2, brandName: 'Цинк', reason: 'Кофактор синтеза T4', minSeverity: 'moderate' },
    { substanceId: 'selenium_sup', priority: 3, brandName: 'Селен', reason: 'Защита щитовидной железы от окислительного стресса', minSeverity: 'moderate' },
  ]},

  // ─── МЕТАБОЛИЧЕСКАЯ / Глюкоза ───
  { marker: 'GLU', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин (500 мг × 3)', reason: 'AMPK-активация → ↑ чувствительности к инсулину, ↓ глюкозы (сопоставимо с метформином)', minSeverity: 'mild' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Берлитион / Тиоктацид', reason: '↑ транспорта глюкозы (GLUT4), ↓ инсулинорезистентности', minSeverity: 'moderate' },
    { substanceId: 'chromium', priority: 3, brandName: 'Хром (пиколинат)', reason: 'Кофактор инсулиновых рецепторов, ↓ глюкозы', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 4, brandName: 'Таурин', reason: '↑ чувствительности β-клеток, ↓ глюкозы', minSeverity: 'moderate' },
  ]},
  { marker: 'HbA1c', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин', reason: '↓ HbA1c на 0.7-1.0% (мета-анализ), AMPK-активация', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Берлитион', reason: '↓ инсулинорезистентности → ↓ гликирования Hb', minSeverity: 'moderate' },
    { substanceId: 'chromium', priority: 3, brandName: 'Хром', reason: 'Кофактор инсулина → ↓ глюкозы → ↓ HbA1c', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 4, brandName: 'Витамин D3', reason: '↑ чувствительности к инсулину при дефиците D', minSeverity: 'moderate' },
  ]},
  { marker: 'INS', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин', reason: 'AMPK → ↑ чувствительности к инсулину → ↓ уровня инсулина', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Берлитион', reason: 'GLUT4-транспорт → ↓ потребности в инсулине', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Магний', reason: 'Кофактор инсулиновых рецепторов (↓ Mg = ↑ IR)', minSeverity: 'moderate' },
  ]},
  { marker: 'HOMAIR', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин', reason: 'Доказано ↓ HOMA-IR на 40-50% (мета-анализ)', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Берлитион', reason: '↓ IR через GLUT4-транспорт', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Магний', reason: '↓ IR при дефиците Mg (кофактор тирозинкиназы)', minSeverity: 'moderate' },
  ]},
  { marker: 'HOMOCYSTEINE', entries: [
    { substanceId: 'methylfolate', priority: 1, brandName: 'Метилфолат (5-MTHF)', reason: 'Активная форма фолата → реметилирование гомоцистеина', minSeverity: 'moderate' },
    { substanceId: 'methylcobalamin', priority: 2, brandName: 'Метилкобаламин (B12)', reason: 'Кофактор метионинсинтазы → гомоцистеин → метионин', minSeverity: 'moderate' },
    { substanceId: 'tmg', priority: 3, brandName: 'ТМГ / Бетаин', reason: 'Донор метильных групп → ↓ гомоцистеина на 10-15%', minSeverity: 'moderate' },
    { substanceId: 'vitamin_b6', priority: 4, brandName: 'B6 / P-5-P', reason: 'Кофактор цистатионин-β-синтазы → транссульфурирование', minSeverity: 'moderate' },
  ]},

  // ─── ВОСПАЛЕНИЕ / Иммунная ───
  { marker: 'CRP', entries: [
    { substanceId: 'omega3', priority: 1, brandName: 'Омакор / ЭПК+ДГК', reason: '↓ IL-6, ↓ TNF-α → ↓ СРБ (доказано в мета-анализах)', minSeverity: 'mild' },
    { substanceId: 'curcumin_sup', priority: 2, brandName: 'Куркумин (с пиперином)', reason: 'NF-κB-ингибиция → ↓ воспалительных цитокинов → ↓ СРБ', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 3, brandName: 'Ашваганда', reason: '↓ CRP на 30% (мета-анализ), иммуномодуляция', minSeverity: 'moderate' },
    { substanceId: 'probiotic', priority: 4, brandName: 'Пробиотик (Lactobacillus+)', reason: '↓ системного воспаления через ось кишечник-иммунитет', minSeverity: 'moderate' },
  ]},
  { marker: 'TNF_ALPHA', entries: [
    { substanceId: 'omega3', priority: 1, brandName: 'Омакор', reason: 'ЭПК → резольвины → ↓ TNF-α', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 2, brandName: 'Куркумин', reason: 'NF-κB → ↓ TNF-α экспрессии', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 3, brandName: 'Ашваганда', reason: '↓ TNF-α, ↓ воспаления', minSeverity: 'severe' },
  ]},
  { marker: 'IL6', entries: [
    { substanceId: 'omega3', priority: 1, brandName: 'Омакор', reason: '↓ IL-6 через анти-воспалительные медиаторы', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 2, brandName: 'Куркумин', reason: 'NF-κB-ингибиция → ↓ IL-6', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 3, brandName: 'Витамин D3', reason: '↓ IL-6 через VDR-рецепторы (при дефиците D)', minSeverity: 'moderate' },
  ]},

  // ─── ВИТАМИНЫ И МИНЕРАЛЫ ───
  { marker: 'VITD', entries: [
    { substanceId: 'vitamin_d3', priority: 1, brandName: 'Витамин D3 / Холекальциферол', reason: 'Прямой восполнение дефицита, ↑ 25(OH)D', minSeverity: 'mild' },
    { substanceId: 'vitamin_k2', priority: 2, brandName: 'K2 / Менахинон-7 (MK-7)', reason: 'Кофактор для использования D3 (синтез остеокальцина)', minSeverity: 'mild' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Магний', reason: 'Кофактор гидроксилирования D3 в печени/почках', minSeverity: 'moderate' },
  ]},
  { marker: 'B12', entries: [
    { substanceId: 'methylcobalamin', priority: 1, brandName: 'Метилкобаламин / B12-Метил', reason: 'Активная форма B12, ↑ уровня в сыворотке, ↑ метилирование', minSeverity: 'moderate' },
    { substanceId: 'folate', priority: 2, brandName: 'Фолат / Метилфолат', reason: 'Синергия с B12 для эритропоэза, ↓ гомоцистеина', minSeverity: 'moderate' },
    { substanceId: 'tmg', priority: 3, brandName: 'ТМГ / Бетаин', reason: 'Донор метильных групп (синергия с B12)', minSeverity: 'moderate' },
  ]},
  { marker: 'FOL', entries: [
    { substanceId: 'methylfolate', priority: 1, brandName: 'Метилфолат (5-MTHF)', reason: 'Активная форма фолата, ↑ уровня фолата в сыворотке', minSeverity: 'moderate' },
    { substanceId: 'methylcobalamin', priority: 2, brandName: 'Метилкобаламин', reason: 'Синергия с фолатом для синтеза ДНК', minSeverity: 'moderate' },
    { substanceId: 'tmg', priority: 3, brandName: 'ТМГ', reason: 'Поддержка метилирования (синергия с фолатом)', minSeverity: 'moderate' },
  ]},
  { marker: 'FERRITIN', entries: [
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин', reason: 'Хелатация железа, ↓ ферритина при перегрузке', minSeverity: 'moderate' },
    { substanceId: 'aspirin', priority: 2, brandName: 'Аспирин', reason: '↓ воспаления → ↓ ферритина (acute phase reactant)', minSeverity: 'moderate' },
    { substanceId: 'vitamin_e', priority: 3, brandName: 'Витамин E', reason: 'Антиоксидантная защита при перегрузке Fe', minSeverity: 'severe' },
  ]},
  { marker: 'IRON', entries: [
    { substanceId: 'vitamin_c', priority: 1, brandName: 'Витамин C / Аскорбинка', reason: '↑ всасывания железа в кишечнике (в 3-6 раз)', minSeverity: 'moderate' },
    { substanceId: 'folate', priority: 2, brandName: 'Фолат', reason: 'Кофактор эритропоэза при дефиците железа', minSeverity: 'moderate' },
    { substanceId: 'vitamin_b12', priority: 3, brandName: 'B12', reason: 'Синергия для эритропоэза', minSeverity: 'moderate' },
  ]},
  { marker: 'MAGNESIUM', entries: [
    { substanceId: 'magnesium', priority: 1, brandName: 'Магний (цитрат/малат/глицинат)', reason: 'Прямое восполнение дефицита Mg', minSeverity: 'mild' },
    { substanceId: 'magnesium_l_threonate', priority: 2, brandName: 'Mg L-треонат (Magtein)', reason: 'Преодолевает ГЭБ, ↑ Mg в мозге, улучшение сна', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 3, brandName: 'Таурин', reason: 'Синергия с Mg для работы сердца и нервной системы', minSeverity: 'moderate' },
  ]},
  { marker: 'ZINC', entries: [
    { substanceId: 'zinc_sup', priority: 1, brandName: 'Цинк (пиколинат / бисглицинат)', reason: 'Прямое восполнение дефицита, ↑ иммунитета', minSeverity: 'mild' },
    { substanceId: 'boron', priority: 2, brandName: 'Бор', reason: 'Синергия с Zn для синтеза T, ↓ SHBG', minSeverity: 'moderate' },
  ]},
  { marker: 'SELENIUM', entries: [
    { substanceId: 'selenium_sup', priority: 1, brandName: 'Селен (200 мкг / Selenomethionine)', reason: 'Субстрат для синтеза селено-протеинов (глутатион-пероксидаза)', minSeverity: 'mild' },
    { substanceId: 'zinc_sup', priority: 2, brandName: 'Цинк', reason: 'Синергия Se+Zn для иммунитета и щитовидной железы', minSeverity: 'moderate' },
  ]},
  { marker: 'POTASSIUM', entries: [
    { substanceId: 'magnesium', priority: 1, brandName: 'Магний', reason: 'Синергия Mg+K для ритма сердца, ↓ аритмий', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Осмопротекция, баланс электролитов', minSeverity: 'moderate' },
  ]},
  { marker: 'CALCIUM', entries: [
    { substanceId: 'vitamin_d3', priority: 1, brandName: 'Витамин D3', reason: '↑ всасывания Ca в кишечнике, ↓ гиперкальциемии', minSeverity: 'moderate' },
    { substanceId: 'vitamin_k2', priority: 2, brandName: 'K2 (MK-7)', reason: 'Направляет Ca в кости, ↓ кальцификации сосудов', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Магний', reason: 'Баланс Ca:Mg 2:1, ↓ сосудистой кальцификации', minSeverity: 'moderate' },
  ]},

  // ─── ПРОСТАТА ───
  { marker: 'PSA', entries: [
    { substanceId: 'saw_palmetto', priority: 1, brandName: 'Со Пальметто / Простамол', reason: '5α-редуктаза ингибиция → ↓ DHT → ↓ PSA, ↓ гиперплазии', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 2, brandName: 'Цинк', reason: 'Антиоксидантная защита простаты, ↓ воспаления', minSeverity: 'moderate' },
  ]},

  // ─── КОСТИ ───
  { marker: 'PARATHYROID', entries: [
    { substanceId: 'vitamin_d3', priority: 1, brandName: 'Витамин D3', reason: '↑ всасывания Ca → ↓ ПТГ (feedback)', minSeverity: 'moderate' },
    { substanceId: 'vitamin_k2', priority: 2, brandName: 'K2 (MK-7)', reason: '↑ остеокальцина → ↓ ПТГ', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Магний', reason: 'Кофактор секреции ПТГ, чувствительности рецепторов', minSeverity: 'moderate' },
  ]},
  { marker: 'OSTEOCALCIN', entries: [
    { substanceId: 'vitamin_k2', priority: 1, brandName: 'K2 (MK-7)', reason: 'γ-карбоксилирование остеокальцина → активная форма', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 2, brandName: 'Витамин D3', reason: '↑ синтеза остеокальцина в остеобластах', minSeverity: 'moderate' },
  ]},
];

// ══════════════════════════════════════════════════════════════════════════════
//  ФУНКЦИИ ДОСТУПА
// ══════════════════════════════════════════════════════════════════════════════

const PRIORITY_INDEX: Record<string, LabPriorityEntry[]> = {};
for (const m of LAB_PRIORITY_MAP) PRIORITY_INDEX[m.marker] = m.entries;

const MARKER_ALIASES: Record<string, string> = {
  'Glucose': 'GLU',
  'Cortisol': 'CORTISOL',
  'Vitamin D (25-OH)': 'VITD',
  'Prolactin': 'PRL',
  'PSA total': 'PSA',
  'DHEA-S': 'DHEA_S',
  'Total T': 'TT',
  'Free T': 'FT',
  'Insulin': 'INS',
  'HOMA-IR': 'HOMAIR',
  'Homocysteine': 'HOMOCYSTEINE',
  'B12': 'B12',
  'Ferritin': 'FERRITIN',
};

function resolveMarker(marker: string): string {
  return MARKER_ALIASES[marker] || marker;
}

/**
 * Получить приоритетные вещества для маркёра с учётом степени отклонения.
 * Возвращает упорядоченный по priority список (1-й → 2-й → 3-й...).
 */
export function getPrioritySubstances(marker: string, severity: SeverityLevel): LabPriorityEntry[] {
  const key = resolveMarker(marker);
  const entries = PRIORITY_INDEX[key];
  if (!entries) return [];
  const order: SeverityLevel[] = ['mild', 'moderate', 'severe'];
  const sevIdx = order.indexOf(severity);
  return entries
    .filter(e => order.indexOf(e.minSeverity) <= sevIdx)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Получить 1-й выбор для маркёра (самый приоритетный).
 */
export function getFirstChoice(marker: string): LabPriorityEntry | undefined {
  const key = resolveMarker(marker);
  const entries = PRIORITY_INDEX[key];
  if (!entries || entries.length === 0) return undefined;
  return [...entries].sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Получить брендовое название вещества (если есть в приоритетной карте).
 */
export function getBrandName(substanceId: string): string | undefined {
  for (const entries of Object.values(PRIORITY_INDEX)) {
    for (const e of entries) {
      if (e.substanceId === substanceId) return e.brandName;
    }
  }
  return undefined;
}

/**
 * Получить причину назначения для вещества по конкретному маркёру.
 */
export function getPriorityReason(marker: string, substanceId: string): string | undefined {
  const key = resolveMarker(marker);
  const entries = PRIORITY_INDEX[key];
  if (!entries) return undefined;
  const e = entries.find(x => x.substanceId === substanceId);
  return e?.reason;
}

/**
 * Получить приоритет вещества (1/2/3/4) для конкретного маркёра.
 */
export function getSubstancePriority(marker: string, substanceId: string): number | undefined {
  const key = resolveMarker(marker);
  const entries = PRIORITY_INDEX[key];
  if (!entries) return undefined;
  const e = entries.find(x => x.substanceId === substanceId);
  return e?.priority;
}

/**
 * Ищет приоритет вещества по ВСЕМ маркёрам (возвращает минимальный = наивысший).
 */
export function getSubstancePriorityAny(substanceId: string): number | undefined {
  let best: number | undefined;
  for (const entries of Object.values(PRIORITY_INDEX)) {
    const e = entries.find(x => x.substanceId === substanceId);
    if (e && (best === undefined || e.priority < best)) best = e.priority;
  }
  return best;
}

/**
 * Все маркёры, для которых есть приоритетная карта.
 */
export function getMappedMarkers(): string[] {
  return Object.keys(PRIORITY_INDEX);
}

/**
 * Все вещества из приоритетной карты (уникальные).
 */
export function getAllPrioritySubstanceIds(): string[] {
  const ids = new Set<string>();
  for (const entries of Object.values(PRIORITY_INDEX)) {
    for (const e of entries) ids.add(e.substanceId);
  }
  return [...ids];
}

/**
 * Определить степень отклонения маркёра по значению и норме.
 */
export function deriveSeverity(value: number, defaultValue: number, higherIsWorse: boolean): SeverityLevel {
  if (higherIsWorse) {
    const ratio = value / defaultValue;
    if (ratio >= 3.0) return 'severe';
    if (ratio >= 2.0) return 'moderate';
    if (ratio >= 1.2) return 'mild';
    return 'mild';
  } else {
    const ratio = defaultValue / Math.max(value, 0.01);
    if (ratio >= 3.0) return 'severe';
    if (ratio >= 2.0) return 'moderate';
    if (ratio >= 1.2) return 'mild';
    return 'mild';
  }
}
