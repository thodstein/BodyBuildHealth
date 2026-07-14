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
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин / Куркуминоид', reason: 'NF-κB-ингибиция → ↓ воспалительных маркёров → ↓ СОЭ (сильнее Омега-3)', minSeverity: 'mild' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омакор / очищенный ЭПК', reason: '↓ воспаления → ↓ фибриногена → ↓ СОЭ (только очищенный ЭПК ≥2 г)', minSeverity: 'mild' },
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
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин (с пиперином)', reason: 'NF-κB-ингибиция → ↓ воспалительных цитокинов → ↓ СРБ (сильнее Омега-3 при системном воспалении)', minSeverity: 'mild' },
    { substanceId: 'berberine', priority: 2, brandName: 'Берберин', reason: 'AMPK + ↓ провоспалительных цитокинов → ↓ СРБ (мета-анализ)', minSeverity: 'moderate' },
    { substanceId: 'bergamot', priority: 3, brandName: 'Бергамот / Кардио-Бергамот', reason: 'Полифенолы → ↓ СРБ и провоспалительного статуса', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 4, brandName: 'Омакор / очищенный ЭПК', reason: '↓ IL-6, TNF-α → ↓ СРБ (доказано, но только очищенный ЭПК ≥2 г; дешёвый рыбий жир слаб)', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 4, brandName: 'Ашваганда', reason: '↓ CRP на 30% (мета-анализ), иммуномодуляция', minSeverity: 'moderate' },
    { substanceId: 'probiotic', priority: 4, brandName: 'Пробиотик (Lactobacillus+)', reason: '↓ системного воспаления через ось кишечник-иммунитет', minSeverity: 'moderate' },
  ]},
  { marker: 'TNF_ALPHA', entries: [
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин (с пиперином)', reason: 'NF-κB-ингибиция → ↓ экспрессии TNF-α (сильнее Омега-3)', minSeverity: 'moderate' },
    { substanceId: 'berberine', priority: 2, brandName: 'Берберин', reason: 'AMPK + снижение провоспалительных цитокинов → ↓ TNF-α', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 3, brandName: 'Омакор / очищенный ЭПК', reason: 'ЭПК → резольвины → ↓ TNF-α (только очищенный ЭПК ≥2 г)', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 4, brandName: 'Ашваганда', reason: '↓ TNF-α, ↓ воспаления', minSeverity: 'severe' },
  ]},
  { marker: 'IL6', entries: [
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин (с пиперином)', reason: 'NF-κB-ингибиция → ↓ IL-6 (сильнее Омега-3)', minSeverity: 'moderate' },
    { substanceId: 'berberine', priority: 2, brandName: 'Берберин', reason: 'AMPK + ↓ провоспалительных цитокинов → ↓ IL-6', minSeverity: 'moderate' },
    { substanceId: 'bergamot', priority: 3, brandName: 'Бергамот', reason: 'Полифенолы → ↓ IL-6 и системного воспаления', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 4, brandName: 'Омакор / очищенный ЭПК', reason: '↓ IL-6 через резольвины (только очищенный ЭПК ≥2 г)', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 4, brandName: 'Витамин D3', reason: '↓ IL-6 через VDR-рецепторы (при дефиците D)', minSeverity: 'moderate' },
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

  // ─── НОВЫЕ: проблемно-ориентированные маркеры ───
  { marker: 'NT_PROBNP', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис', reason: 'ARB → ↓ постнагрузки → ↓ растяжения миокарда → ↓ NT-proBNP', minSeverity: 'mild' },
    { substanceId: 'nebivolol', priority: 2, brandName: 'Небилет', reason: 'β1-блокада + NO → ↓ ЧСС + ↓ АД → ↓ NT-proBNP', minSeverity: 'moderate' },
    { substanceId: 'coq10', priority: 3, brandName: 'Коэнзим Q10', reason: 'Митохондриальная поддержка миокарда → ↓ NT-proBNP', minSeverity: 'moderate' },
  ]},
  { marker: 'GGT', entries: [
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан / Урсофальк', reason: 'Стимуляция BSEP-зависимого желчеоттока, снижение холестаза', minSeverity: 'mild' },
    { substanceId: 'milk_thistle', priority: 2, brandName: 'Легалон / Силимар', reason: 'Силимарин → защита мембран жёлчных канальцев', minSeverity: 'mild' },
    { substanceId: 'phosphatidylcholine', priority: 3, brandName: 'Лецитин / Эссенциале', reason: 'Восстановление мембран гепатоцитов', minSeverity: 'moderate' },
  ]},
  { marker: 'BILE_ACIDS', entries: [
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан / Урсофальк', reason: 'Гидрофильная жёлчная кислота → конкуренция с токсичными жёлчными к-тами', minSeverity: 'mild' },
    { substanceId: 'milk_thistle', priority: 2, brandName: 'Легалон', reason: 'Защита гепатоцитов от детергентного действия жёлчных кислот', minSeverity: 'moderate' },
  ]},
  { marker: 'ALDOSTERONE', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис', reason: 'ARB → ↓ секреции альдостерона → ↓ задержка Na+/H₂O', minSeverity: 'mild' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Осморегулятор → ↓ альдостерон через нормализацию Na+/K+', minSeverity: 'moderate' },
  ]},
  { marker: 'RENIN', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис', reason: 'ARB → ↑ ренина по обратной связи (компенсаторно), ↓ эффект ATII', minSeverity: 'moderate' },
  ]},
  { marker: 'VITAMIN_B6', entries: [
    { substanceId: 'p5p', priority: 1, brandName: 'Пиридоксаль-5-фосфат / B6', reason: 'Активная форма B6 → ↓ пролактина (дофаминергический кофактор)', minSeverity: 'mild' },
    { substanceId: 'methylfolate', priority: 2, brandName: 'Метилфолат', reason: 'Метилирование + гомоцистеин (синергия с B6)', minSeverity: 'mild' },
  ]},
  { marker: 'COPPER', entries: [
    { substanceId: 'zinc_sup', priority: 1, brandName: 'Цинк', reason: 'Антагонист меди — конкурентное всасывание, восстановление Zn:Cu', minSeverity: 'moderate' },
  ]},
  { marker: 'ZINC', entries: [
    { substanceId: 'zinc_sup', priority: 1, brandName: 'Цинк (пиколинат 30-50 мг)', reason: 'Кофактор ароматазы, 5α-редуктазы, >300 ферментов', minSeverity: 'mild' },
    { substanceId: 'boron', priority: 2, brandName: 'Бор', reason: 'Синергия с цинком — ↑ тестостерон + ↓ SHBG', minSeverity: 'mild' },
  ]},
  { marker: 'SELENIUM', entries: [
    { substanceId: 'selenium_sup', priority: 1, brandName: 'Селен 200 мкг', reason: 'Кофактор глутатионпероксидазы → антиоксидантная защита', minSeverity: 'mild' },
    { substanceId: 'zinc_sup', priority: 2, brandName: 'Цинк', reason: 'Синергия: Zn + Se → тиреоидная функция', minSeverity: 'mild' },
  ]},
  { marker: 'VITAMIN_E', entries: [
    { substanceId: 'vitamin_e', priority: 1, brandName: 'Витамин E (токоферол)', reason: 'Антиоксидант ЛПНП → защита от окисления → ↓ атеросклероз', minSeverity: 'mild' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3', reason: 'Синергия: E защищает омега-3 от перекисного окисления', minSeverity: 'mild' },
  ]},
  { marker: 'DFI', entries: [
    { substanceId: 'nac', priority: 1, brandName: 'Ацетилцистеин', reason: 'Донатор SH-групп → восстановление глутатиона → ↓ оксидативного повреждения ДНК', minSeverity: 'moderate' },
    { substanceId: 'coq10', priority: 2, brandName: 'Коэнзим Q10 300 мг', reason: 'Митохондриальная защита сперматозоидов → ↓ DFI', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 3, brandName: 'Цинк 50 мг', reason: 'Стабилизация хроматина сперматозоидов → ↓ фрагментации', minSeverity: 'moderate' },
    { substanceId: 'selenium_sup', priority: 4, brandName: 'Селен 200 мкг', reason: 'GPx-4 → защита ДНК сперматозоидов от перекисного окисления', minSeverity: 'severe' },
  ]},
  { marker: 'TPO_AB', entries: [
    { substanceId: 'selenium_sup', priority: 1, brandName: 'Селен 200 мкг', reason: '↓ аутоантител к ТПО на 20-40% за 3-6 мес', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 2, brandName: 'Витамин D3 5000 МЕ', reason: 'Иммуномодуляция → ↓ аутоиммунного воспаления', minSeverity: 'moderate' },
  ]},
  { marker: 'MPV', entries: [
    { substanceId: 'aspirin', priority: 1, brandName: 'Аспирин 100 мг', reason: 'Антиагрегант → ↓ активации тромбоцитов (MPV — маркёр активации)', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3', reason: 'Антиагрегант → мембранная текучесть тромбоцитов', minSeverity: 'mild' },
    { substanceId: 'garlic_extract', priority: 3, brandName: 'Чеснок (аллицин)', reason: 'Антиагрегант через ↓ TXA2 → ↓ активации тромбоцитов', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 4, brandName: 'Куркумин', reason: '↓ COX-2 → ↓ тромбоксана → мягкая антиагрегация', minSeverity: 'moderate' },
  ]},

  // ═══════════════════════════════════════════════════════════════
  //  ДОБАВЛЕНО: НОВЫЙ БЛОК — РАСШИРЕНИЕ ПРИОРИТЕТОВ (49.markers.edu)
  //  Клинически валидированные вещества для ранее непокрытых маркёров
  // ═══════════════════════════════════════════════════════════════

  // ─── ГЕПАТОБИЛИАРНАЯ: синтетическая функция ───
  { marker: 'TOTAL_PROTEIN', entries: [
    { substanceId: 'whey_protein', priority: 1, brandName: 'Сывороточный протеин 30-40 г', reason: '↑ синтез альбумина и глобулинов — субстрат аминокислот', minSeverity: 'mild' },
    { substanceId: 'leucine', priority: 2, brandName: 'Лейцин 5-10 г', reason: ' ↑ mTOR → синтез белка в печени', minSeverity: 'mild' },
    { substanceId: 'glutamine', priority: 3, brandName: 'Глутамин 10 г', reason: 'Глутаминовый пул для синтеза белка, иммунитета', minSeverity: 'moderate' },
    { substanceId: 'col_ii', priority: 4, brandName: 'Колострум 1-2 г', reason: '↑ фактор роста + аминокислоты', minSeverity: 'moderate' },
  ]},
  { marker: 'ALB', entries: [
    { substanceId: 'whey_protein', priority: 1, brandName: 'Сывороточный протеин 30-40 г', reason: 'Главный субстрат альбумина в печени', minSeverity: 'moderate' },
    { substanceId: 'leucine', priority: 2, brandName: 'Лейцин', reason: ' ↑ синтез белка через mTOR', minSeverity: 'moderate' },
    { substanceId: 'glutamine', priority: 3, brandName: 'Глутамин 10 г', reason: 'Аминокислота для синтеза белка, кишечный барьер', minSeverity: 'moderate' },
    { substanceId: 'bcaa', priority: 4, brandName: 'BCAA 5-10 г', reason: 'Валин+лейцин+изолейцин — ↓ распада альбумина', minSeverity: 'moderate' },
  ]},
  { marker: 'CHOLINESTERASE', entries: [
    { substanceId: 'phosphatidylcholine', priority: 1, brandName: 'Эссенциале / Фосфоглив', reason: 'Холин-донатор → ↑ синтеза холинэстеразы в печени', minSeverity: 'moderate' },
    { substanceId: 'alpha_gpc', priority: 2, brandName: 'Alpha-GPC 300 мг', reason: '40% холина в мозг + синергия с печенью', minSeverity: 'moderate' },
    { substanceId: 'citicoline', priority: 3, brandName: 'Цитиколин 250-500 мг', reason: 'CDP-холин → донатор холина', minSeverity: 'moderate' },
    { substanceId: 'milk_thistle', priority: 4, brandName: 'Легалон', reason: 'Регенерация гепатоцитов → ↑ синтеза белка', minSeverity: 'severe' },
  ]},

  // ─── СЕРДЦЕ: миокард ───
  { marker: 'TROPONIN_I', entries: [
    { substanceId: 'coq10', priority: 1, brandName: 'Коэнзим Q10 300 мг', reason: 'Митохондриальная защита кардиомиоцитов — перенос электронов', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омакор 4 г ЭПК+ДГК', reason: 'Антиаритмогенный + анти-воспалительный + ↑ мембраны', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Mg-глицинат 400 мг', reason: '↑ расслабление миокарда, ↓ ЧСС, ↓ экстрасистолий', minSeverity: 'mild' },
    { substanceId: 'l_carnitine', priority: 4, brandName: 'L-Карнитин 2-3 г', reason: 'Транспорт СЖК в митохондрии → ↓ цитотоксичности ацил-CoA', minSeverity: 'moderate' },
  ]},
  { marker: 'CK_MB', entries: [
    { substanceId: 'coq10', priority: 1, brandName: 'Кудесан 300 мг', reason: 'Митохондрии миокарда', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: 'Анти-воспалительный', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Mg 400 мг', reason: 'Спазмы миокарда ↓', minSeverity: 'moderate' },
    { substanceId: 'l_carnitine', priority: 4, brandName: 'L-Карнитин 2 г', reason: '↑ митохондриальная энергия', minSeverity: 'severe' },
  ]},
  { marker: 'BNP', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис 40-80 мг', reason: 'ARB → ↓ постнагрузки BNP-натрийурез', minSeverity: 'mild' },
    { substanceId: 'nebivolol', priority: 2, brandName: 'Небилет 2.5-5 мг', reason: ' ↓ ЧСС → ↓ потребность миокарда', minSeverity: 'moderate' },
    { substanceId: 'coq10', priority: 3, brandName: 'Коэнзим Q10 300 мг', reason: 'Митохондрии миокарда', minSeverity: 'moderate' },
    { substanceId: 'd_ribose', priority: 4, brandName: 'D-рибоза 5 г', reason: '↑ АТФ при сердечной недостаточности', minSeverity: 'severe' },
  ]},
  { marker: 'INR', entries: [
    { substanceId: 'vitamin_k2', priority: 1, brandName: 'Менахинон-7 100-200 мкг', reason: 'Активация факторов свёртывания II/VII/IX/X — γ-карбоксилирование', minSeverity: 'moderate' },
    { substanceId: 'vitamin_k1', priority: 2, brandName: 'Филлохинон 1-5 мг', reason: 'Быстрый кофактор при остром дефиците', minSeverity: 'severe' },
    { substanceId: 'vitamin_c', priority: 3, brandName: 'Витамин C 500 мг', reason: 'Антиоксидантный протектор для печени при приёме ВК', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 4, brandName: 'Омега-3 3 г', reason: 'Антиагрегант синергичный с ВК-терапией', minSeverity: 'moderate' },
  ]},
  { marker: 'APTT', entries: [
    { substanceId: 'aspirin', priority: 1, brandName: 'Аспирин 100 мг (кардио)', reason: 'Антиагрегант при удлинённом АЧТВ', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 3-4 г', reason: 'Антиагрегант, мембрана тромбоцитов', minSeverity: 'moderate' },
    { substanceId: 'garlic_extract', priority: 3, brandName: 'Чеснок (аллицин) 600 мг', reason: 'Антиагрегант через ↓ TXA2', minSeverity: 'moderate' },
    { substanceId: 'nattokinase', priority: 4, brandName: 'Наттокиназа 2000 FU', reason: 'Фибринолитик, мягкая антикоагуляция', minSeverity: 'severe' },
  ]},

  // ─── РЕНТНЫЕ: ранние маркёры ───
  { marker: 'NGAL', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал 1000 мг', reason: 'Тубулярный протектор при ↑ NGAL', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 2, brandName: 'Кордицепс 1.5 г', reason: ' ↑ почечный кровоток, антифиброз', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 3, brandName: 'Таурин 2 г', reason: 'Осморегулятор, осмопротектор канальцев', minSeverity: 'moderate' },
    { substanceId: 'resveratrol', priority: 4, brandName: 'Резвератрол 200 мг', reason: 'Анти-воспалительный + антиоксидант канальцев', minSeverity: 'severe' },
  ]},
  { marker: 'KIM1', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал 1000 мг', reason: 'Тубулярный протектор, маркёр KIM-1 ↓', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 2, brandName: 'Кордицепс 1.5 г', reason: 'Анти-воспалительный, проксимальный каналец', minSeverity: 'moderate' },
    { substanceId: 'resveratrol', priority: 3, brandName: 'Резвератрол', reason: 'Антифиброзный при тубулярном стрессе', minSeverity: 'severe' },
    { substanceId: 'nac', priority: 4, brandName: 'NAC 1200 мг', reason: 'Глутатион тубулярных клеток', minSeverity: 'severe' },
  ]},
  { marker: 'UACR', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис 40-80 мг', reason: 'ARB → ↓ внутриклубочкового давления → ↓ микроальбуминурии', minSeverity: 'moderate' },
    { substanceId: 'astragalus', priority: 2, brandName: 'Астрагал 1000 мг', reason: ' ↓ протеинурии (исследование 2016)', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 3, brandName: 'Витамин D3 5000 МЕ', reason: '↓ RAS через VDR → ↓ внутриклубочковая гипертензия', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 4, brandName: 'Таурин 2 г', reason: '↑ осмопротекция клубочка', minSeverity: 'severe' },
  ]},

  // ─── ГЕМАТОЛОГИЯ: эритроциты/ретикулоциты ───
  { marker: 'RBC', entries: [
    { substanceId: 'aspirin', priority: 1, brandName: 'Аспирин 100 мг', reason: 'Антиагрегант при эритроцитозе (HCT>50%)', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 3-4 г', reason: 'Мембранная текучесть эритроцитов', minSeverity: 'moderate' },
    { substanceId: 'naringin', priority: 3, brandName: 'Нарингин 500 мг', reason: ' ↓ гематокрита (↑ фибринолиз)', minSeverity: 'moderate' },
    { substanceId: 'quercetin', priority: 4, brandName: 'Кверцетин 500 мг', reason: ' ↓ вязкости крови через ↑ эластичность RBC', minSeverity: 'severe' },
  ]},
  { marker: 'RETICULOCYTES', entries: [
    { substanceId: 'iron_lipofer', priority: 1, brandName: 'Липосомальное железо 30 мг', reason: 'Субстрат эритропоэза при ретикуло ↓', minSeverity: 'moderate' },
    { substanceId: 'methylfolate', priority: 2, brandName: '5-MTHF 800 мкг', reason: 'Кофактор синтеза ДНК эритроидных предшественников', minSeverity: 'moderate' },
    { substanceId: 'methylcobalamin', priority: 3, brandName: 'Метилкобаламин 1000 мкг', reason: 'B12 → миелинизация + эритропоэз', minSeverity: 'moderate' },
    { substanceId: 'copper_supp', priority: 4, brandName: 'Хелат меди 2 мг', reason: 'Кофактор церулоплазмина → Fe²⁺→Fe³⁺', minSeverity: 'severe' },
  ]},
  { marker: 'HAPTOGLOBIN', entries: [
    { substanceId: 'vitamin_e', priority: 1, brandName: 'Витамин E 400 МЕ', reason: 'Антиоксидант мембран RBC → ↓ гемолиза', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 2, brandName: 'Куркумин', reason: ' ↓ воспалительного гемолиза', minSeverity: 'moderate' },
    { substanceId: 'quercetin', priority: 3, brandName: 'Кверцетин', reason: ' ↓ пероксидации мембран RBC', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 4, brandName: 'Альфа-липоевая 600 мг', reason: 'Регенерация GSH мембран RBC', minSeverity: 'severe' },
  ]},
  { marker: 'ERYTHROPOIETIN', entries: [
    { substanceId: 'iron_lipofer', priority: 1, brandName: 'Липосомальное железо 30 мг', reason: 'Субстрат при ↑ эритропоэтина (реактивный ответ)', minSeverity: 'moderate' },
    { substanceId: 'methylfolate', priority: 2, brandName: 'Метилфолат', reason: 'Восстановление эритропоэза', minSeverity: 'moderate' },
    { substanceId: 'vitamin_c', priority: 3, brandName: 'Витамин C 500 мг', reason: ' ↑ Fe²⁺→↑ абсорбции', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 4, brandName: 'Омега-3 3 г', reason: 'Мембраны RBC при ↑ эритропоэзе', minSeverity: 'moderate' },
  ]},
  { marker: 'WBC', entries: [
    { substanceId: 'vitamin_d3', priority: 1, brandName: 'Витамин D3 5000-10000 МЕ', reason: 'Иммуномодулятор при лейкоцитозе', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 2, brandName: 'Куркумин 500 мг', reason: 'НПВС-нерезистентный COX-2 ингибитор', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 3, brandName: 'Омега-3 4 г', reason: ' ↓ воспаления через резолвины', minSeverity: 'moderate' },
    { substanceId: 'andrographis', priority: 4, brandName: 'Андрографис 400 мг', reason: 'Иммуномодуляция, ↓ гипер-ответа', minSeverity: 'severe' },
  ]},
  { marker: 'Neutrophils', entries: [
    { substanceId: 'vitamin_d3', priority: 1, brandName: 'Витамин D3', reason: ' ↓ нейтрофильного воспаления', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 2, brandName: 'Куркумин', reason: ' ↓ NF-κB в нейтрофилах', minSeverity: 'moderate' },
    { substanceId: 'berberine', priority: 3, brandName: 'Берберин 500 мг', reason: 'AMPK-активация → ↓ воспаления', minSeverity: 'moderate' },
    { substanceId: 'probiotic', priority: 4, brandName: 'Пробиотик LGG+BB12', reason: 'Регуляция нейтрофилов через кишечник', minSeverity: 'moderate' },
  ]},
  { marker: 'Lymphocytes', entries: [
    { substanceId: 'andrographis', priority: 1, brandName: 'Андрографис', reason: ' ↑ CD4+ лимфоциты (исследования)', minSeverity: 'moderate' },
    { substanceId: 'beta_glucan', priority: 2, brandName: 'Бета-глюкан ячменя 250 мг', reason: ' ↑ NK и лимфоцитов через дектин-1', minSeverity: 'moderate' },
    { substanceId: 'colostrum', priority: 3, brandName: 'Колострум 1-2 г', reason: ' ↓ факторов ↓-лимфоцитов', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 4, brandName: 'Витамин D3', reason: 'Субстрат для Th-клеток', minSeverity: 'moderate' },
  ]},

  // ─── КОАГУЛЯЦИЯ: Δ-димер/Фибриноген ─── (расширения)
  // (D_DIMER и FIBRINOGEN уже есть выше)
  { marker: 'OSTEOCALCIN', entries: [ // Было, расширяем ключевыми субстратами
    { substanceId: 'vitamin_k2', priority: 1, brandName: 'K2 (MK-7) 100-200 мкг', reason: 'γ-Carboxylation остеокальцина → активная форма', minSeverity: 'mild' },
    { substanceId: 'vitamin_d3', priority: 2, brandName: 'Витамин D3 5000 МЕ', reason: ' ↑ синтез остеокальцина в остеобластах', minSeverity: 'mild' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Mg 300-400 мг', reason: 'Кофактор остеобластов', minSeverity: 'moderate' },
    { substanceId: 'boron', priority: 4, brandName: 'Бор 3-6 мг', reason: ' ↑ остеокальцина через ↑ витамина D', minSeverity: 'moderate' },
  ]},

  // ─── ЭНДОКРИННАЯ: адренал/гипофиз ───
  { marker: 'PROG', entries: [
    { substanceId: 'cabergoline', priority: 1, brandName: 'Каберголин 0.25-0.5 мг', reason: ' ↓ прогестероновой гиперсекре GnRH-завис', minSeverity: 'severe' },
    { substanceId: 'vitex', priority: 2, brandName: 'Vitex agnus-castus 160-225 мг', reason: 'D2-агонист → ↓ гиперпролактинемии/↑ прогеста', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 3, brandName: 'KSM-66 600 мг', reason: ' ↓ кортизола через HPA влияния на прогестерон', minSeverity: 'moderate' },
    { substanceId: 'p5p', priority: 4, brandName: 'Пиридоксаль-5-фосфат 50 мг', reason: 'B6 → ↓ эстрогенного компонента, нормализация', minSeverity: 'moderate' },
  ]},
  { marker: 'ANDROSTENEDIONE', entries: [
    { substanceId: 'dim', priority: 1, brandName: 'DIM 100-200 мг', reason: 'Индол-3-карбинол → ↓ ароматизация андростен., ↓ E2', minSeverity: 'mild' },
    { substanceId: 'indinol', priority: 2, brandName: 'Индол-3-карбинол 400 мг', reason: ' ↓ CYP19 (ароматаза) → ↓ E2 из андростендиона', minSeverity: 'moderate' },
    { substanceId: 'chrysin', priority: 3, brandName: 'Хризин 500-1000 мг', reason: 'Флавоноид-ингибитор ароматазы', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 4, brandName: 'Цинк', reason: 'Ароматаза-ингибитор (кофактор)', minSeverity: 'moderate' },
  ]},
  { marker: 'ACTH', entries: [
    { substanceId: 'ashwagandha', priority: 1, brandName: 'KSM-66 600 мг', reason: ' ↓ АКТГ и кортизола через HPA-ос', minSeverity: 'moderate' },
    { substanceId: 'phosphatidylserine', priority: 2, brandName: 'ФС 400-600 мг', reason: ' ↓ АКТГ → ↓ кортизола', minSeverity: 'moderate' },
    { substanceId: 'magnesium_l_threonate', priority: 3, brandName: 'Mg-L-треонат 144 мг', reason: 'Снижение возбудимости гипоталамуса', minSeverity: 'moderate' },
    { substanceId: 'l_theanine', priority: 4, brandName: 'L-теанин 200-400 мг', reason: 'Анксиолитик, ↓ HPA-активации', minSeverity: 'mild' },
  ]},
  { marker: 'OH17_PROGESTERONE', entries: [
    { substanceId: 'dim', priority: 1, brandName: 'DIM 200 мг', reason: 'Индолы модулируют CYP → ↓ 17-OHP', minSeverity: 'moderate' },
    { substanceId: 'indinol', priority: 2, brandName: 'Индол-3-карбинол', reason: 'Индукция CYP1A1, ароматаза-модуляция', minSeverity: 'moderate' },
    { substanceId: 'p5p', priority: 3, brandName: 'B6 (P-5-P) 100 мг', reason: ' ↓ транскортизола, модуляция надпочечников', minSeverity: 'moderate' },
    { substanceId: 'vitamin_b6', priority: 4, brandName: 'B6 (пиридоксин)', reason: 'Дофаминергический кофактор → ↓ACT→17OHP', minSeverity: 'moderate' },
  ]},

  // ─── ГАСТРО/ПАНКРЕАС ───
  { marker: 'AMYLASE', entries: [
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин 500 мг', reason: 'Анти-воспалительный при панкреатите', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: ' ↓ воспаления через резолвины', minSeverity: 'moderate' },
    { substanceId: 'nac', priority: 3, brandName: 'NAC 1200 мг', reason: ' ↓ оксидативного стресса в pancreas', minSeverity: 'severe' },
    { substanceId: 'probiotic', priority: 4, brandName: 'Пробиотик', reason: ' ↓ кишечной воспалительной трансформации', minSeverity: 'moderate' },
  ]},
  { marker: 'LIPASE', entries: [
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин', reason: ' ↓ воспаления поджелудочной', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: 'Анти-воспалительный + protect.', minSeverity: 'moderate' },
    { substanceId: 'nac', priority: 3, brandName: 'NAC 1200 мг', reason: 'Антиоксидант', minSeverity: 'severe' },
    { substanceId: 'papain', priority: 4, brandName: 'Папаин 500 мг', reason: ' ↓ нагрузки на поджелудочную (фермент)', minSeverity: 'moderate' },
  ]},

  // ─── ЛИПИДЫ: валидируемые ───
  { marker: 'APO_B', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин 500 мг ×2-3р', reason: 'AMPK → ↓ синтез холестерина, ↑ ЛПНП-рецепторов', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: ' ↓ VLDL → ↓ APOB', minSeverity: 'mild' },
    { substanceId: 'red_yeast_rice', priority: 3, brandName: 'Красный дрожжевой рис', reason: 'Монаколин K = ловастatin', minSeverity: 'severe' },
    { substanceId: 'ezetimibe', priority: 4, brandName: 'Эзетимиб 10 мг', reason: ' ↓ кишечной абсорбции холестерина', minSeverity: 'severe' },
  ]},
  { marker: 'APO_A1', entries: [
    { substanceId: 'niacin', priority: 1, brandName: 'Ниацин ER 500-1000 мг', reason: ' ↑ APO-A1 (HDL) +15-35%', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: ' ↑ ABCA1 → синтез APOA1', minSeverity: 'mild' },
    { substanceId: 'pantethine', priority: 3, brandName: 'Пантетин 450 мг', reason: ' ↑ APOA1 мягко', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 4, brandName: 'Куркумин 500 мг', reason: ' ↑ PPARα → ↑ APOA1', minSeverity: 'moderate' },
  ]},
  { marker: 'LP_A', entries: [
    { substanceId: 'niacin', priority: 1, brandName: 'Ниацин ER 1000-2000 мг', reason: 'Единственный БАД ↓ Lp(a) на 20-30%', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: 'Мягкое ↓ Lp(a)', minSeverity: 'moderate' },
    { substanceId: 'l_carnitine', priority: 3, brandName: 'L-Карнитин 2 г', reason: ' ↑ окисления жиров → ↓ Lp(a)', minSeverity: 'severe' },
    { substanceId: 'vitamin_c', priority: 4, brandName: 'Витамин C 1000 мг', reason: ' ↓ окисления Lp(a) → ↓ атерогенности', minSeverity: 'moderate' },
  ]},

  // ─── ЭНДОКРИННАЯ: IGF / GH/ IGFBP3 ───
  { marker: 'IGF1', entries: [
    { substanceId: 'mk677', priority: 1, brandName: 'IBUTAMOREN 12.5-25 мг', reason: 'Пероральный GHSR-агонист → ↑ пульс GH → ↑ IGF-1', minSeverity: 'moderate' },
    { substanceId: 'cjc1295', priority: 2, brandName: 'CJC-1295 300 мкг', reason: 'GHRH-аналог → ↑GH → ↑IGF-1', minSeverity: 'moderate' },
    { substanceId: 'ghrp6', priority: 3, brandName: 'GHRP-6 100 мкг', reason: 'Грелин-агонист → ↑ пульс GH', minSeverity: 'moderate' },
    { substanceId: 'ipamorelin', priority: 4, brandName: 'Ipamorelin 300 мкг', reason: 'GHSR-агонист мягкий, ↑ GH', minSeverity: 'moderate' },
  ]},
  { marker: 'GH', entries: [
    { substanceId: 'cjc1295', priority: 1, brandName: 'CJC-1295', reason: 'GHRH → ↑GH', minSeverity: 'moderate' },
    { substanceId: 'ipamorelin', priority: 2, brandName: 'Ipamorelin', reason: ' ↑ GH без ↑ PRL', minSeverity: 'moderate' },
    { substanceId: 'mk677', priority: 3, brandName: 'MK-677', reason: 'Пероральный GHSR-агонист', minSeverity: 'moderate' },
    { substanceId: 'sermorelin', priority: 4, brandName: 'Серморелин', reason: 'GHRH (1-29)', minSeverity: 'severe' },
  ]},
  { marker: 'IGFBP3', entries: [
    { substanceId: 'mk677', priority: 1, brandName: 'MK-677', reason: ' ↑ GH → ↑ IGFBP-3', minSeverity: 'moderate' },
    { substanceId: 'cjc1295', priority: 2, brandName: 'CJC-1295', reason: ' ↑ GH', minSeverity: 'moderate' },
    { substanceId: 'arginine', priority: 3, brandName: 'L-Аргинин 5-10 г', reason: ' ↑ GH-пульс, синергист', minSeverity: 'moderate' },
    { substanceId: 'glycine', priority: 4, brandName: 'Глицин 3 г', reason: ' ↑ GH перед сном', minSeverity: 'mild' },
  ]},

  // ─── МЕТАБОЛИЧЕСКАЯ: Глюкоза/инсулин ───
  { marker: 'C_PEPTIDE', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин 500 мг', reason: ' AMPK → ↓ глюконеогенеза → ↓ C-пептида', minSeverity: 'moderate' },
    { substanceId: 'metformin_mr', priority: 2, brandName: 'Метформин MR 500-1000 мг', reason: ' ↓ глюконеогенеза → ↓ C-пептида при IR', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 3, brandName: 'Альфа-липоевая 600 мг', reason: ' ↑ GLUT4 → ↓ IR', minSeverity: 'moderate' },
    { substanceId: 'chromium', priority: 4, brandName: 'Хром 1000 мкг', reason: ' ↑ GTF → ↑ чувствительности инсулина', minSeverity: 'mild' },
  ]},
  { marker: 'FRUCTOSAMINE', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин', reason: ' ↓ средне 2-3 нед глюкозы → ↓ фруктозамина', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Альфа-липоевая', reason: ' ↑ IR', minSeverity: 'moderate' },
    { substanceId: 'chromium', priority: 3, brandName: 'Хром', reason: ' ↑ чувствительности инсулина', minSeverity: 'moderate' },
    { substanceId: 'inositol', priority: 4, brandName: 'Инозитол 2000 мг', reason: ' ↓ IR → ↓ фруктозамина', minSeverity: 'moderate' },
  ]},
  { marker: 'PROINSULIN', entries: [
    { substanceId: 'berberine', priority: 1, brandName: 'Берберин', reason: ' ↓ IR → ↓ проинсулина', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Альфа-липоевая', reason: ' ↑ GLUT4', minSeverity: 'moderate' },
    { substanceId: 'chromium', priority: 3, brandName: 'Хром', reason: ' Инсулин/IR', minSeverity: 'moderate' },
    { substanceId: 'inositol', priority: 4, brandName: 'Инозит', reason: ' ↓ инозита в β клетках → ↓ проинс', minSeverity: 'severe' },
  ]},

  // ─── ИММУНОГЕННЫЕ: цитокины ───
  { marker: 'IL1B', entries: [
    { substanceId: 'curcumin_sup', priority: 1, brandName: 'Куркумин + пиперин', reason: ' ↓ NLRP3 inflammasome → ↓ IL-1β', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: ' ↓ IL-1β через резолвины', minSeverity: 'moderate' },
    { substanceId: 'bromelain', priority: 3, brandName: 'Бромелайн 500 мг', reason: ' ↓ COX-2 + ↓ IL-1β', minSeverity: 'moderate' },
    { substanceId: 'sulforaphane', priority: 4, brandName: 'Сульфорафан (брокколи)', reason: 'Nrf2 → ↓ IL-1β', minSeverity: 'severe' },
  ]},
  { marker: 'LDH', entries: [
    { substanceId: 'coq10', priority: 1, brandName: 'CoQ10', reason: 'Митохондрии, ↓ анаэробного LDH', minSeverity: 'moderate' },
    { substanceId: 'alpha_lipoic', priority: 2, brandName: 'Альфа-липоевая', reason: 'Антиоксидант', minSeverity: 'moderate' },
    { substanceId: 'nac', priority: 3, brandName: 'NAC', reason: 'Глутатион-предшественник', minSeverity: 'moderate' },
    { substanceId: 'pqq', priority: 4, brandName: 'PQQ 20 мг', reason: 'Митохондриальный биогенез', minSeverity: 'severe' },
  ]},

  // ─── АУТОИММУННАЯ: щитовидная ───
  { marker: 'TG_AB', entries: [
    { substanceId: 'selenium_sup', priority: 1, brandName: 'Селен 200 мкг', reason: ' ↓ аутоантител к ТГ (исследования)', minSeverity: 'moderate' },
    { substanceId: 'vitamin_d3', priority: 2, brandName: 'Витамин D3', reason: ' ↓ аутоиммунитета', minSeverity: 'moderate' },
    { substanceId: 'inositol', priority: 3, brandName: 'Мио-инозитол 600 мг', reason: ' ↓ ТПО-АТ, синергично с Se', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 4, brandName: 'Цинк', reason: ' ↓ аутоиммунитета', minSeverity: 'moderate' },
  ]},

  // ─── ЭЛЕКТРОЛИТЫ ───
  { marker: 'SODIUM', entries: [
    { substanceId: 'taurine', priority: 1, brandName: 'Таурин 2-3 г', reason: 'Осморегулятор, ↑ Na+/K+-баланс', minSeverity: 'mild' },
    { substanceId: 'd_mannose', priority: 2, brandName: 'D-манноза', reason: 'Синергист осморегуляции', minSeverity: 'mild' },
    { substanceId: 'potassium_citrate', priority: 3, brandName: 'Калия цитрат', reason: ' ↑ K+ для баланса с Na+', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 4, brandName: 'Mg', reason: 'Кофактор Na+/K+-АТФ-азы', minSeverity: 'moderate' },
  ]},
  { marker: 'PHOSPHORUS', entries: [
    { substanceId: 'vitamin_d3', priority: 1, brandName: 'Витамин D3', reason: ' ↑ СТР кишечника, всасывание фосфора', minSeverity: 'moderate' },
    { substanceId: 'vitamin_k2', priority: 2, brandName: 'K2', reason: 'Регуляция Ca/P', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Mg', reason: 'Кофактор, ↑ фосфора в костях', minSeverity: 'moderate' },
    { substanceId: 'calcitriol', priority: 4, brandName: 'Кальцитриол (рецепт.)', reason: 'Активированная форма D3 if no ↑ при D deficit', minSeverity: 'severe' },
  ]},
  { marker: 'CHLORIDE', entries: [
    { substanceId: 'taurine', priority: 1, brandName: 'Таурин 2 г', reason: 'Осмо-баланс Cl- с Na+/K+', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 2, brandName: 'Mg', reason: 'Кофактор для Cl-каналов', minSeverity: 'moderate' },
    { substanceId: 'potassium_citrate', priority: 3, brandName: 'Калия цитрат', reason: 'Мягкий Cl-баланс через K+', minSeverity: 'moderate' },
    { substanceId: 'betaine', priority: 4, brandName: 'Бетаин TMG 1000 мг', reason: 'Осмолит', minSeverity: 'moderate' },
  ]},
  { marker: 'OSMOLALITY', entries: [
    { substanceId: 'taurine', priority: 1, brandName: 'Таурин 3 г', reason: 'Главный осмолит, ↑ клеточной защиты', minSeverity: 'moderate' },
    { substanceId: 'd_mannose', priority: 2, brandName: 'D-манноза 1-2 г', reason: 'Синергист осмолит', minSeverity: 'moderate' },
    { substanceId: 'betaine', priority: 3, brandName: 'Бетаин 1000 мг', reason: 'Осмолит почек', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 4, brandName: 'Mg', reason: 'Кофактор Na+/K+ → осмоляльность', minSeverity: 'moderate' },
  ]},
  { marker: 'ANION_GAP', entries: [
    { substanceId: 'thiamine', priority: 1, brandName: 'B1 (тиамин) 100-300 мг', reason: ' ↑ пируватдегидрогеназы → ↓ лактата', minSeverity: 'severe' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: ' ↓ почечной нагрузки', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Mg', reason: 'Кофактор лактатдеген', minSeverity: 'moderate' },
    { substanceId: 'betaine', priority: 4, brandName: 'Бетаин', reason: ' ↓ метилмалоновая ацидемия', minSeverity: 'severe' },
  ]},
  { marker: 'URINE_PH', entries: [
    { substanceId: 'taurine', priority: 1, brandName: 'Таурин', reason: ' ↑ щёлочности мочи', minSeverity: 'moderate' },
    { substanceId: 'potassium_citrate', priority: 2, brandName: 'Калия цитрат', reason: '↑ щёлочи', minSeverity: 'moderate' },
    { substanceId: 'betaine', priority: 3, brandName: 'Бетаин', reason: 'Метаболит осмолит', minSeverity: 'moderate' },
    { substanceId: 'cranberry', priority: 4, brandName: 'Клюква (hippuric acid)', reason: 'Кислая моча при UTI', minSeverity: 'moderate' },
  ]},
  { marker: 'URINE_OSM', entries: [
    { substanceId: 'taurine', priority: 1, brandName: 'Таурин', reason: 'Регулятор почечной осмоляльности', minSeverity: 'moderate' },
    { substanceId: 'astragalus', priority: 2, brandName: 'Астрагал', reason: ' ↑ концентрационной способности почек', minSeverity: 'moderate' },
    { substanceId: 'd_mannose', priority: 3, brandName: 'D-манноза', reason: 'Анти-адгезия + осмолит', minSeverity: 'moderate' },
    { substanceId: 'betaine', priority: 4, brandName: 'Бетаин', reason: 'Осмолит', minSeverity: 'moderate' },
  ]},

  // ─── ПЕЧЁНОЧНЫЕ: субстраты ───
  { marker: 'VITAMIN_A', entries: [
    { substanceId: 'vitamin_a', priority: 1, brandName: 'Ретинил пальмитат 5000-10000 МЕ', reason: 'Прямой источник ретинола', minSeverity: 'moderate' },
    { substanceId: 'cod_liver_oil', priority: 2, brandName: 'Рыбий жир печени трески', reason: 'Источники A + D', minSeverity: 'mild' },
    { substanceId: 'beta_carotene', priority: 3, brandName: 'β-каротин 10-25 мг', reason: 'Провитамин A>, безопасный', minSeverity: 'mild' },
    { substanceId: 'zinc_sup', priority: 4, brandName: 'Цинк 30 мг', reason: 'Кофактор ретинол-дегидрогеназы', minSeverity: 'moderate' },
  ]},
  { marker: 'TIBC', entries: [
    { substanceId: 'iron_lipofer', priority: 1, brandName: 'Липосомальное железо 30 мг', reason: ' ↑ железа → ↓ ОЖСС', minSeverity: 'moderate' },
    { substanceId: 'vitamin_c', priority: 2, brandName: 'Витамин C 500 мг', reason: '6× ↑ абсорбции железа', minSeverity: 'mild' },
    { substanceId: 'methylfolate', priority: 3, brandName: 'Метилфолат', reason: 'Эритропоэз + Fe', minSeverity: 'moderate' },
    { substanceId: 'lactoferrin', priority: 4, brandName: 'Лактоферрин', reason: ' ↑ абсорбции железа кишечником', minSeverity: 'moderate' },
  ]},
  { marker: 'TRANSFERRIN', entries: [
    { substanceId: 'iron_lipofer', priority: 1, brandName: 'Липосомальное железо', reason: ' ↑ Fe → ↓ трансферрина (sat ↑)', minSeverity: 'moderate' },
    { substanceId: 'vitamin_c', priority: 2, brandName: 'Витамин C', reason: 'Усвоение', minSeverity: 'moderate' },
    { substanceId: 'vitamin_b6', priority: 3, brandName: 'B6', reason: 'Кофактор синтеза', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 4, brandName: 'Цинк', reason: 'Антагонист Fe — ↓ трансферрина', minSeverity: 'moderate' },
  ]},
  { marker: 'UIBC', entries: [
    { substanceId: 'iron_lipofer', priority: 1, brandName: 'Липосомальное железо', reason: ' ↑ Fe → ↓ UIBC', minSeverity: 'moderate' },
    { substanceId: 'vitamin_c', priority: 2, brandName: 'Витамин C', reason: '↑ всасывания', minSeverity: 'mild' },
    { substanceId: 'methylfolate', priority: 3, brandName: 'Метилфолат', reason: 'Эритропоэз', minSeverity: 'moderate' },
    { substanceId: 'copper_supp', priority: 4, brandName: 'Медь', reason: 'Кофактор церулоплазмина для Fe', minSeverity: 'severe' },
  ]},

  // ─── КОСТЬ: субстраты ───
  { marker: 'CALCITONIN', entries: [
    { substanceId: 'vitamin_d3', priority: 1, brandName: 'Витамин D3', reason: ' ↑ Ca-чувств. → ↑ кальцитонина', minSeverity: 'moderate' },
    { substanceId: 'vitamin_k2', priority: 2, brandName: 'K2', reason: 'γ-Carboxylation', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Mg', reason: 'Кофактор для D3', minSeverity: 'moderate' },
    { substanceId: 'boron', priority: 4, brandName: 'Бор', reason: ' ↑ кальцитонина через эстрогены', minSeverity: 'moderate' },
  ]},
  { marker: 'GLOBULIN', entries: [
    { substanceId: 'colostrum', priority: 1, brandName: 'Колострум 1-2 г', reason: 'Иммуноглобулины', minSeverity: 'moderate' },
    { substanceId: 'whey_protein', priority: 2, brandName: 'Сывороточный протеин', reason: '↑ субстрата глобулинов', minSeverity: 'moderate' },
    { substanceId: 'probiotic', priority: 3, brandName: 'Пробиотик', reason: 'IgA-синтез', minSeverity: 'moderate' },
    { substanceId: 'glutamine', priority: 4, brandName: 'Глутамин', reason: 'Субстрат иммунных клеток', minSeverity: 'moderate' },
  ]},

  // ─── UCUM-СИРОТЫ: критические ───
  { marker: 'CREATININE', entries: [ // был алиас Creatinine, теперь канонический
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал 1000 мг', reason: ' ↓ протеинурии, ↑ СКФ', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин 2 г', reason: 'Осмопротектор канальцев', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 3, brandName: 'Кордицепс 1.5 г', reason: ' ↑ почечного кровотока', minSeverity: 'moderate' },
    { substanceId: 'd_mannose', priority: 4, brandName: 'D-манноза', reason: 'Анти-адгезия бактерий', minSeverity: 'mild' },
  ]},
  { marker: 'UREA', entries: [
    { substanceId: 'astragalus', priority: 1, brandName: 'Астрагал', reason: ' ↓ азотемии', minSeverity: 'moderate' },
    { substanceId: 'taurine', priority: 2, brandName: 'Таурин', reason: 'Осмо-протектор', minSeverity: 'moderate' },
    { substanceId: 'cordyceps', priority: 3, brandName: 'Кордицепс', reason: ' ↓ мочевины', minSeverity: 'moderate' },
    { substanceId: 'd_mannose', priority: 4, brandName: 'D-манноза', reason: 'Уротелий', minSeverity: 'moderate' },
  ]},
  { marker: 'BIL', entries: [
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан', reason: 'Желчеотток, ↓ билирубина', minSeverity: 'moderate' },
    { substanceId: 'milk_thistle', priority: 2, brandName: 'Легалон', reason: 'Мембраны гепатоцитов', minSeverity: 'moderate' },
    { substanceId: 'vitamin_k2', priority: 3, brandName: 'K2', reason: 'Синтез факторов свёртывания', minSeverity: 'moderate' },
    { substanceId: 'phosphatidylcholine', priority: 4, brandName: 'Эссенциале', reason: 'Мембраны', minSeverity: 'severe' },
  ]},
  { marker: 'DIRECT_BIL', entries: [ // DBIL (алиас DIRECT_BIL уже есть в lab-marker-map) — дубль в lab-marker-map нужно убрать
    { substanceId: 'tudca', priority: 1, brandName: 'Урсосан', reason: 'Экскреция прямого билирубина', minSeverity: 'moderate' },
    { substanceId: 'vitamin_k2', priority: 2, brandName: 'K2', reason: 'Синтез факторов свёртывания', minSeverity: 'moderate' },
    { substanceId: 'milk_thistle', priority: 3, brandName: 'Легалон', reason: 'Мембраны', minSeverity: 'moderate' },
    { substanceId: 'phosphatidylcholine', priority: 4, brandName: 'Эссенциале', reason: 'Гепатоцит. защита', minSeverity: 'severe' },
  ]},
  { marker: 'TG', entries: [
    { substanceId: 'omega3', priority: 1, brandName: 'Омега-3 4 г', reason: ' ↓ синтеза ТГ в печени, ↑ липолиза', minSeverity: 'mild' },
    { substanceId: 'berberine', priority: 2, brandName: 'Берберин', reason: ' AMPK → ↓ ТГ', minSeverity: 'moderate' },
    { substanceId: 'niacin', priority: 3, brandName: 'Ниацин', reason: ' ↓ липолиза в жировой', minSeverity: 'moderate' },
    { substanceId: 'amla', priority: 4, brandName: 'Amla (Emblica) 500 мг', reason: 'Гиполипидемический', minSeverity: 'severe' },
  ]},
  { marker: 'D_DIMER', entries: [
    { substanceId: 'nattokinase', priority: 1, brandName: 'Наттокиназа 2000 FU', reason: 'Прямой фибринолитик', minSeverity: 'moderate' },
    { substanceId: 'serrapeptase', priority: 2, brandName: 'Серрапептаза 20-30 мг', reason: 'Растворение фибрина', minSeverity: 'moderate' },
    { substanceId: 'lumbrokinase', priority: 3, brandName: 'Lumbrokinase', reason: 'Фибринолитик', minSeverity: 'severe' },
    { substanceId: 'omega3', priority: 4, brandName: 'Омега-3 4 г', reason: ' ↓ вязкости, антиагрегант', minSeverity: 'mild' },
  ]},
  { marker: 'FIBRINOGEN', entries: [
    { substanceId: 'nattokinase', priority: 1, brandName: 'Наттокиназа', reason: ' ↓ фибриногена', minSeverity: 'moderate' },
    { substanceId: 'serrapeptase', priority: 2, brandName: 'Серрапептаза', reason: ' ↓ фибриногена', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 3, brandName: 'Омега-3 4 г', reason: ' ↓ фибриногена', minSeverity: 'moderate' },
    { substanceId: 'garlic_extract', priority: 4, brandName: 'Чеснок (аллицин)', reason: ' ↓ фибриногена', minSeverity: 'severe' },
  ]},
  { marker: 'TROPONIN', entries: [
    { substanceId: 'coq10', priority: 1, brandName: 'CoQ10 300 мг', reason: 'Митохондрии миокарда', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 2, brandName: 'Омега-3 4 г', reason: 'Анти-воспалительный', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 3, brandName: 'Mg', reason: 'Анти-аритмия', minSeverity: 'moderate' },
    { substanceId: 'l_carnitine', priority: 4, brandName: 'L-Карнитин', reason: 'Митохондрии', minSeverity: 'severe' },
  ]},
  { marker: 'ECHO_LV_MASS', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис 40-80 мг', reason: 'Регрессия ГЛЖ (исследования)', minSeverity: 'moderate' },
    { substanceId: 'nebivolol', priority: 2, brandName: 'Небилет', reason: ' ↓ работы сердца → ↓ ГЛЖ', minSeverity: 'moderate' },
    { substanceId: 'spironolactone', priority: 3, brandName: 'Спиронолактон 25-50 мг', reason: ' ↓ фиброза миокарда', minSeverity: 'severe' },
    { substanceId: 'omega3', priority: 4, brandName: 'Омега-3 4 г', reason: ' ↓ ремоделирования', minSeverity: 'severe' },
  ]},
  { marker: 'ECHO_EF', entries: [
    { substanceId: 'carvedilol', priority: 1, brandName: 'Карведилол 12.5-25 мг', reason: ' ↓ смертности при HFrEF', minSeverity: 'severe' },
    { substanceId: 'ramipril', priority: 2, brandName: 'Рамиприл 5-10 мг', reason: ' ↓ ремоделирования', minSeverity: 'severe' },
    { substanceId: 'spironolactone', priority: 3, brandName: 'Спиронолактон', reason: ' ↓ фиброза', minSeverity: 'severe' },
    { substanceId: 'coq10', priority: 4, brandName: 'CoQ10 300 мг', reason: 'Митохондрии миокарда', minSeverity: 'moderate' },
  ]},
  { marker: 'ECHO_LA', entries: [
    { substanceId: 'telmisartan', priority: 1, brandName: 'Микардис', reason: ' ↓ ЛП через ↓ постнагрузки', minSeverity: 'moderate' },
    { substanceId: 'nebivolol', priority: 2, brandName: 'Небилет', reason: ' ↓ ЧСС → ↓ ЛП', minSeverity: 'moderate' },
    { substanceId: 'omega3', priority: 3, brandName: 'Омега-3 4 г', reason: ' ↓ фибрилляции предсердий', minSeverity: 'moderate' },
    { substanceId: 'magnesium', priority: 4, brandName: 'Mg 400 мг', reason: ' ↓ аритмии предсердий', minSeverity: 'moderate' },
  ]},

  // ─── ИЗОФОРМЫ, ФЕРТИЛЬНОСТЬ ───
  { marker: 'INHIBIN_B', entries: [ // был алиас INHB → INHIBIN_B; теперь канонический
    { substanceId: 'nac', priority: 1, brandName: 'NAC 1200 мг', reason: ' ↓ оксидативного стресса клеток Сертоли', minSeverity: 'moderate' },
    { substanceId: 'coq10', priority: 2, brandName: 'CoQ10', reason: 'Митохондрии Сертоли', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 3, brandName: 'Цинк 50 мг', reason: ' ↑ клетки Сертоли', minSeverity: 'moderate' },
    { substanceId: 'selenium_sup', priority: 4, brandName: 'Селен 200 мкг', reason: 'GSH-пероксидаза Сертоли', minSeverity: 'moderate' },
  ]},
  { marker: 'AMH', entries: [
    { substanceId: 'nac', priority: 1, brandName: 'NAC', reason: ' ↓ оксидативного стресса, ↑ AMH', minSeverity: 'moderate' },
    { substanceId: 'coq10', priority: 2, brandName: 'CoQ10', reason: 'Митохондрии', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 3, brandName: 'Ашваганда', reason: 'Антиоксидант', minSeverity: 'moderate' },
    { substanceId: 'shilajit', priority: 4, brandName: 'Шиладжит (мумиё)', reason: 'Адаптоген и омоложение клеток', minSeverity: 'moderate' },
  ]},
  { marker: 'ESTRADIOL_SENS', entries: [ // особо важен при гиперэстрогении
    { substanceId: 'anastrozole', priority: 1, brandName: 'Анастрозол 0.25-0.5 мг', reason: ' ↑ ингибиции CYP19 (aromatase)', minSeverity: 'moderate' },
    { substanceId: 'dim', priority: 2, brandName: 'DIM 100-200 мг', reason: 'Индол-3-карбинол → ↓ CYP19', minSeverity: 'moderate' },
    { substanceId: 'exemestane', priority: 3, brandName: 'Экземестан 12.5 мг', reason: 'Стероидный ИА ( irreversible)', minSeverity: 'severe' },
    { substanceId: 'indinol', priority: 4, brandName: 'Индол-3-карбинол 400 мг', reason: 'Аналог DIM', minSeverity: 'moderate' },
  ]},
  { marker: 'PROGESTERONE', entries: [ // = PROG
    { substanceId: 'cabergoline', priority: 1, brandName: 'Каберголин', reason: ' ↓ прогестиновой гинекомастии', minSeverity: 'severe' },
    { substanceId: 'vitex', priority: 2, brandName: 'Vitex', reason: 'D2-агонист', minSeverity: 'moderate' },
    { substanceId: 'ashwagandha', priority: 3, brandName: 'Ашваганда', reason: ' ↓ HPA', minSeverity: 'moderate' },
    { substanceId: 'p5p', priority: 4, brandName: 'P5P', reason: 'Модулятор', minSeverity: 'moderate' },
  ]},
  { marker: 'PREALBUMIN', entries: [
    { substanceId: 'whey_protein', priority: 1, brandName: 'Сывороточный', reason: 'Субстрат синтеза', minSeverity: 'moderate' },
    { substanceId: 'bcaa', priority: 2, brandName: 'BCAA', reason: 'Синтез белка', minSeverity: 'moderate' },
    { substanceId: 'leucine', priority: 3, brandName: 'Лейцин', reason: ' mTOR', minSeverity: 'moderate' },
    { substanceId: 'glutamine', priority: 4, brandName: 'Глутамин', reason: 'Субстрат', minSeverity: 'severe' },
  ]},
  { marker: 'MAR_TEST', entries: [
    { substanceId: 'serrapeptase', priority: 1, brandName: 'Серрапептаза', reason: ' ↓ иммунных комплексов', minSeverity: 'moderate' },
    { substanceId: 'bromelain', priority: 2, brandName: 'Бромелайн 500 мг', reason: ' ↓ иммунных комплексов', minSeverity: 'moderate' },
    { substanceId: 'nac', priority: 3, brandName: 'NAC', reason: ' ↓ оксидативного', minSeverity: 'moderate' },
    { substanceId: 'curcumin_sup', priority: 4, brandName: 'Куркумин', reason: ' ↓ аутоиммунитета', minSeverity: 'moderate' },
  ]},
  { marker: 'HDS', entries: [
    { substanceId: 'nac', priority: 1, brandName: 'NAC 1200-2400 мг', reason: 'Глутатион', minSeverity: 'moderate' },
    { substanceId: 'coq10', priority: 2, brandName: 'CoQ10 300 мг', reason: 'Митохондрии', minSeverity: 'moderate' },
    { substanceId: 'zinc_sup', priority: 3, brandName: 'Цинк 50 мг', reason: 'Стабилизация хроматина', minSeverity: 'moderate' },
    { substanceId: 'astaxanthin', priority: 4, brandName: 'Астаксантин 8-12 мг', reason: 'Антиоксидант сперматозоидов', minSeverity: 'severe' },
  ]},

  // ─── ЭХО СЕРДЦА (фиктивные ids — используются в ECHO_*) ───
  // (ECHO_LV_MASS, ECHO_EF, ECHO_LA выше)
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
  // Унификация с UCUM_MAP — алиасы для консистентности калькулятора
  'Creatinine': 'CREATININE',
  'Urea': 'UREA',
  'D-dimer': 'D_DIMER',
  'Fibrinogen': 'FIBRINOGEN',
  'Bilirubin': 'BIL',
  'Bilirubin total': 'BIL',
  'Hemoglobin': 'HGB',
  'Triglycerides': 'TG',
  'TriG': 'TG',
  'TP': 'TOTAL_PROTEIN',
  'NA': 'SODIUM',
  'K': 'POTASSIUM',
  'CA': 'CALCIUM',
  'P': 'PHOSPHORUS',
  'MG': 'MAGNESIUM',
  'INHB': 'INHIBIN_B',
  'AMH_conf': 'AMH',
  'Progesterone': 'PROGESTERONE',
  'Estradiol sens': 'ESTRADIOL_SENS',
  'Troponin': 'TROPONIN',
  'BIL': 'BIL',
  'DBIL': 'DIRECT_BIL',
  'HOMA': 'HOMAIR',
  'A/G ratio': 'A_G_RATIO',
  'URIC_ACID': 'URIC_ACID',
  'UA': 'URIC_ACID',
  'eGFR': 'EGFR',
  'Sodium': 'SODIUM',
  'Potassium': 'POTASSIUM',
  'Calcium': 'CALCIUM',
  'Phosphorus': 'PHOSPHORUS',
  'Magnesium': 'MAGNESIUM',
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
