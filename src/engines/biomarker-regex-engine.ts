/**
 * Biomarker Regex Parsing Engine — Enhanced Heuristics
 *
 * Parses raw text (PDF extraction or Tesseract OCR) into structured biomarker results.
 * Pure TypeScript — works in browser (Telegram Mini App) and Node.js.
 *
 * Key enhancements over legacy parser:
 *  1. BIOMARKER_DICTIONARY — multi-synonym matching (Russian + English + abbreviations)
 *  2. Smart number extraction — first number = value, last = EC50/ULN
 *  3. `<` sign handling — "< 41" → ec50 = 41
 *  4. Reference range parsing — "62 - 106" → ec50 = 106
 *  5. Decimal comma → dot conversion
 *  6. Unit parsing from line context
 *  7. Confidence scoring per extraction
 *
 * @module biomarker-regex-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// BIOMARKER DICTIONARY — Canonical code → all known synonyms
// ═══════════════════════════════════════════════════════════════════════════

export const BIOMARKER_DICTIONARY: Record<string, string[]> = {
  // ── Kidney / Renal ──
  'KIM-1': ['kim-1', 'kim 1', 'kim1', 'молекула повреждения почек', 'kidney injury molecule'],
  'Cystatin_C': ['цистатин с', 'цистатин c', 'cystatin c', 'cystatin-c', 'цистатин-с', 'цистатин'],
  'Creatinine': ['креатинин', 'creatinine', 'креат.', 'creat'],
  'Urea': ['мочевина', 'urea', 'bun', 'азот мочевины'],
  'Uric_Acid': ['мочевая кислота', 'uric acid', 'мочевая к-та', 'урат'],
  'UACR': ['uacr', 'альбумин/креатини', 'microalbumin', 'мау', 'микроальбумин'],
  'eGFR': ['egfr', 'рскф', 'скф', 'gfr', 'скорость клубочковой фильтрации', 'клубочковая фильтрация'],
  'Nephrin': ['nephrin', 'нефрин'],
  'Microalbumin': ['microalbumin', 'микроальбумин', 'мау'],

  // ── Liver / Hepatic ──
  'ALT': ['алт', 'аланинаминотрансфераза', 'alt', 'алат', 'аланин-аминотрансфераза', 'alanine aminotransferase'],
  'AST': ['аст', 'аспартатаминотрансфераза', 'ast', 'асат', 'аспартат-аминотрансфераза', 'aspartate aminotransferase'],
  'GGT': ['ггт', 'гамма-глутамилтрансфераза', 'ggt', 'гамма-гт', 'gamma-glutamyl', 'гамма-глутамил'],
  'ALP': ['щелочная фосфатаза', 'alp', 'щф', 'alkaline phosphatase', 'щел. фосф.', 'щелоч. фосф.'],
  'Bilirubin_Total': ['билирубин общий', 'total bilirubin', 'общий билирубин', 'билирубин', 'bilirubin total'],
  'Bilirubin_Direct': ['билирубин прямой', 'direct bilirubin', 'прямой билирубин', 'bilirubin direct', 'конъюгированный'],
  'CK-18': ['ck-18', 'ck18', 'цитокератин-18', 'cytokeratin 18', 'цитокератин 18', 'ck 18'],
  'GLDH': ['gldh', 'глутаматдегидрогеназа', 'глдг', 'glutamate dehydrogenase'],
  'Bile_Acids': ['желчные кислоты', 'bile acids', 'жк', 'желч. к-ты'],
  'Albumin': ['альбумин', 'albumin', 'альб.'],
  'Total_Protein': ['общий белок', 'total protein', 'белок общий', 'общ. белок'],

  // ── Cardiac / Cardiovascular ──
  'NT-proBNP': ['nt-probnp', 'nt probnp', 'ntprobnp', 'nt-pro bnp', 'мозговой натрийуретический пептид', 'probnp'],
  'Galectin-3': ['galectin-3', 'galectin 3', 'галектин-3', 'галектин 3', 'gal3'],
  'Troponin_I': ['тропонин i', 'troponin i', 'тропонин-i', 'тропонин', 'troponin'],
  'Troponin_T': ['тропонин t', 'troponin t', 'тропонин-t'],
  'ADMA': ['adma', 'асимметричный диметиларгинин', 'адима', 'asymmetric dimethylarginine'],
  'CK_MB': ['кфк-мв', 'ck-mb', 'креатинкиназа-мв', 'кфк мв', 'ck mb'],

  // ── Lipids / Atherosclerosis ──
  'Cholesterol_Total': ['холестерин общий', 'total cholesterol', 'общий холестерин', 'холестерин', 'хс общ', 'chol total'],
  'HDL': ['лпвп', 'hdl', 'холестерин лпвп', 'липопротеины высокой плотности', 'хс-лпвп', 'hdl cholesterol'],
  'LDL': ['лпнп', 'ldl', 'холестерин лпнп', 'липопротеины низкой плотности', 'хс-лпнп', 'ldl cholesterol'],
  'Triglycerides': ['триглицериды', 'triglycerides', 'триглиц.', 'тг', 'tg'],
  'VLDL': ['лпонп', 'vldl', 'липопротеины очень низкой плотности', 'лп-очень низкой плотности', 'vldl cholesterol'],
  'ApoB': ['апов', 'apo b', 'аполипопротеин b', 'apob', 'апо-в', 'apolipoprotein b'],
  'ApoA1': ['апоа1', 'apo a1', 'аполипопротеин a1', 'apoa1', 'апо-а1', 'apolipoprotein a1'],
  'oxLDL': ['окисленные лпнп', 'oxidized ldl', 'окисл. лпнп', 'ox-ldl'],
  'Lp_a': ['lp(a)', 'липопротеин (а)', 'лп(а)', 'lipoprotein a', 'lp a'],

  // ── HPTA / Hormones ──
  'LH': ['лг', 'lh', 'лютеинизирующий гормон', 'лютеин. гормон', 'luteinizing hormone'],
  'FSH': ['фсг', 'fsh', 'фолликулостимулирующий гормон', 'фолликулостим. гормон', 'follicle stimulating'],
  'Testosterone_Total': ['тестостерон общий', 'testosterone total', 'тестостерон', 'testosterone', 'тест. общ', 'общий тестостерон'],
  'Testosterone_Free': ['тестостерон свободный', 'free testosterone', 'своб. тестостерон', 'свободный тестостерон', 'test free'],
  'SHBG': ['shbg', 'гспг', 'глобулин связывающий половые гормоны', 'sex hormone binding globulin', 'гсп', 'секс-связывающий глобулин'],
  'DHT': ['дгт', 'dht', 'дигидротестостерон', 'dihydrotestosterone', 'дигидро-тестостерон'],
  'E2': ['эстрадиол', 'estradiol', 'e2', '17-beta estradiol', '17-бета эстрадиол', 'эстрад.'],
  'Prolactin': ['пролактин', 'prolactin', 'prl', 'прл', 'маммотропин'],
  'Progesterone': ['прогестерон', 'progesterone', 'прог.', 'p4'],
  'Cortisol': ['кортизол', 'cortisol', 'кортиз.', 'кортизол общий'],
  'Cortisol_night': ['кортизол ночной', 'night cortisol', 'кортизол вечер', 'cortisol pm'],
  'DHEA_S': ['дгэа-с', 'dhea-s', 'дегидроэпиандростерон-сульфат', 'дгэа сульфат', 'dheas'],
  'IGF-1': ['ифр-1', 'igf-1', 'igf 1', 'инсулиноподобный фактор роста', 'соматомедин с', 'igf1'],
  'ACTH': ['актг', 'acth', 'адренокортикотропный гормон', 'адренокортикотропин'],
  'OH17_Progesterone': ['17-он-прогестерон', '17-гидроксипрогестерон', '17-oh progesterone', '17ohp'],
  'Aldosterone': ['альдостерон', 'aldosterone', 'альдост.'],
  'Inhibin_B': ['ингибин b', 'inhibin b', 'ингибин-b', 'inhibin-b'],
  'HVA': ['hva', 'гомованилиновая кислота', 'гвк', 'homovanillic acid'],
  'TPO_AB': ['антитела к тпо', 'anti-tpo', 'антитпо', 'tpo antibodies', 'тиреопероксидаза аб'],
  'TG_AB': ['антитела к тг', 'anti-tg', 'антитг', 'thyroglobulin antibodies', 'антитела к тиреоглобулину'],
  'MPV': ['мпв', 'mpv', 'средний объем тромбоцита', 'mean platelet volume'],

  // ── Glucose / Insulin ──
  'Glucose': ['глюкоза', 'glucose', 'глюк.', 'сахар крови', 'glu'],
  'HbA1c': ['hba1c', 'гликированный гемоглобин', 'гликогемоглобин', 'гликир. гемоглобин', 'hba1', 'a1c'],
  'Insulin': ['инсулин', 'insulin', 'инс.', 'иммунореактивный инсулин'],
  'C-Peptide': ['с-пептид', 'c-peptide', 'c peptide', 'с пептид', 'connecting peptide'],
  'HOMA-IR': ['homa-ir', 'homa ir', 'индекс homa', 'homa', 'инсулинорезистентность'],

  // ── Hematology / Blood ──
  'Hematocrit': ['гематокрит', 'hematocrit', 'hct', 'гтк', 'гем-крит'],
  'Hemoglobin': ['гемоглобин', 'hemoglobin', 'hgb', 'гемогл.', 'hb'],
  'Ferritin': ['ферритин', 'ferritin', 'ферр.', 'ферритин сыворотки'],
  'EPO': ['эритропоэтин', 'epo', 'erythropoietin', 'эпо'],
  'RBC': ['эритроциты', 'rbc', 'red blood cells', 'эритр.', 'количество эритроцитов'],
  'WBC': ['лейкоциты', 'wbc', 'white blood cells', 'лейк.', 'кол-во лейкоцитов'],
  'Platelets': ['тромбоциты', 'platelets', 'plt', 'тромб.', 'количество тромбоцитов'],
  'ESR': ['соэ', 'esr', 'скорость оседания эритроцитов', 'роэ'],

  // ── Thyroid ──
  'TSH': ['ттг', 'tsh', 'тиреотропный гормон', 'тиреотропин', 'thyroid stimulating hormone'],
  'T3_Free': ['т3 свободный', 'free t3', 'св. т3', 'трийодтиронин свободный', 'ft3'],
  'T4_Free': ['т4 свободный', 'free t4', 'св. т4', 'тироксин свободный', 'ft4'],

  // ── Inflammation / Other ──
  'hs-CRP': ['hs-crp', 'срб высокочувствительный', 'вч-срб', 'hs crp', 'с-реактивный белок', 'crp hs', 'срб'],
  'CRP': ['crp', 'срб', 'c-reactive protein', 'с-реактивный белок'],
  'Homocysteine': ['гомоцистеин', 'homocysteine', 'гомоцист.', 'hcy'],
  'Vitamin_D': ['витамин d', 'vitamin d', '25-oh d', '25(oh)d', '25-oh витамин d', 'вит d', 'кальциферол'],
  'Vitamin_B12': ['витамин b12', 'vitamin b12', 'цианокобаламин', 'b12', 'кобаламин'],
  'Folate': ['фолиевая кислота', 'folate', 'фолат', 'витамин b9', 'фолиев. к-та'],
  'Iron': ['железо', 'iron', 'fe', 'сывороточное железо', 'железо сыворотки'],
  'TIBC': ['ожсс', 'tibc', 'общая железосвязывающая способность', 'железосвяз. спос.'],
  'Transferrin': ['трансферрин', 'transferrin', 'трансф.'],
  'PSA': ['пса', 'psa', 'простат-специфический антиген', 'простатический специфический антиген', 'пса общий'],
  'PSA_Free': ['пса свободный', 'free psa', 'свободный пса'],
  'CK': ['кфк', 'ck', 'креатинкиназа', 'креатинфосфокиназа', 'cpk'],
  'LDH': ['лдг', 'ldh', 'лактатдегидрогеназа', 'lactate dehydrogenase'],
  'Magnesium': ['магний', 'magnesium', 'mg'],
  'Calcium': ['кальций', 'calcium', 'ca', 'кальций общий'],
  'Potassium': ['калий', 'potassium', 'k+', 'калий сыворотки'],
  'Sodium': ['натрий', 'sodium', 'na+', 'натрий сыворотки'],
  'Phosphorus': ['фосфор', 'phosphorus', 'p', 'фосфор неорганический'],
  'Zinc': ['цинк', 'zinc', 'zn'],
  'Selenium': ['селен', 'selenium', 'se'],

  // ── Joint / Bone / CTX ──
  'CTX': ['ctx', 'c-телопептид', 'c-терминальный телопептид', 'crosslaps', 'с-телопептид', 'ctx-1'],
  'COMP': ['comp', 'олигомерный матриксный белок хряща', 'cartilage oligomeric matrix protein'],
  'P1NP': ['p1np', 'пропептид проколлагена 1 типа', 'n-терминальный пропептид'],
  'Osteocalcin': ['остеокальцин', 'osteocalcin', 'ок', 'gla-белок кости'],
  'PTH': ['птг', 'pth', 'паратгормон', 'паратиреоидный гормон', 'parathyroid hormone'],

  // ── Coagulation ──
  'Fibrinogen': ['фибриноген', 'fibrinogen', 'фибр.'],
  'D_Dimer': ['d-димер', 'd-dimer', 'd dimer', 'д-димер', 'димер'],
  'APTT': ['ачтв', 'aptt', 'активированное частичное тромбопластиновое время'],
  'PT': ['пв', 'pt', 'протромбиновое время', 'prothrombin time'],
  'INR': ['мно', 'inr', 'international normalized ratio'],

  // ── Electrolytes trace ──
  'Copper': ['медь', 'copper', 'cu'],
  'Manganese': ['марганец', 'manganese', 'mn'],
  'Iodine': ['йод', 'iodine', 'i2'],
  'Chromium': ['хром', 'chromium', 'cr trace'],

  // ═══════════════════════════════════════════════════════════════════════
  // ДОБАВЛЕНО: 24 маркёра из UCUM_MAP, не распознававшиеся BIOMARKER_DICTIONARY
  // ═══════════════════════════════════════════════════════════════════════
  'AMH': ['антимюллеров гормон', 'амг', 'amh', 'anti-müllerian hormone', 'антимюллерова'],
  'BNP': ['bnp', 'b-type natriuretic peptide', 'brain natriuretic peptide', 'натрийуретический пептид b'],
  'PROTEIN_URINE': ['протеинурия', 'белок в моче', 'protein urine', 'общий белок мочи', 'белок мочи'],
  'ENDOTHELIN1': ['эндотелин-1', 'эндотелин 1', 'endothelin-1', 'et-1', 'эндотелин'],
  'NO_MARKER': ['оксид азота', 'нитраты и нитриты', 'nitric oxide', 'no marker', 'нитрит'],
  'ESTRADIOL_SENS': ['эстрадиол чувствительный', 'чувствительный эстрадиол', 'estradiol sensitive', 'e2 чувств'],
  'PREALBUMIN': ['преальбумин', 'транстиретин', 'prealbumin', 'transthyretin', 'tbpa'],
  'RETICULOCYTES': ['ретикулоциты', 'reticulocytes', 'ретик', 'retics'],
  'HAPTOGLOBIN': ['гаптоглобин', 'haptoglobin', 'гаптогл'],
  'NGAL': ['ngal', 'липокалин-2', 'lipocalin-2', 'нейтрофильный липокалин'],
  'TNF_ALPHA': ['фно-альфа', 'фно-a', 'фно-α', 'tnf-alpha', 'tnf-α', 'фактор некроза опухоли', 'tnf alpha'],
  'IL6': ['ил-6', 'il-6', 'il6', 'интерлейкин 6', 'interleukin-6', 'ил6'],
  'IL1B': ['ил-1бета', 'ил-1β', 'il-1beta', 'il-1β', 'интерлейкин 1', 'interleukin-1', 'il1b'],
  'LACTATE': ['лактат', 'молочная кислота', 'lactate', 'lactic acid'],
  'AMMONIA': ['аммиак', 'ammonia', 'nh3', 'азот аммонийный'],
  'IGFBP3': ['ифр-сб3', 'igfbp-3', 'igfbp3', 'инсулиноподобный фактор связывающий 3', 'igf binding protein 3'],
  'CHOLINESTERASE': ['холинэстераза', 'cholinesterase', 'хэ', 'псевдохолинэстераза'],
  'OSMOLALITY': ['осмоляльность', 'osmolality', 'осмолярность'],
  'ANION_GAP': ['анионный провал', 'анионная разница', 'anion gap', 'aniongap', 'ag'],
  'URINE_PH': ['ph мочи', 'урин ph', 'моча ph', 'urine ph', 'ph urine'],
  'URINE_OSM': ['осмоляльность мочи', 'моча осмоляльность', 'urine osmolality', 'моча osm'],
  'MAR_TEST': ['mar-тест', 'mar тест', 'mar test', 'антиспермальные антитела', 'mar test iga'],
  'DFI': ['фрагментация днк', 'dfi', 'dna fragmentation index', 'фрагмент. днк'],
  'HDS': ['hds', 'незрелый хроматин', 'high dna stainability'],

  // ═══════════════════════════════════════════════════════════════════════
  // ДОБАВЛЕНО: 23 маркёра из LAB_PATTERNS, не распознававшиеся BIOMARKER_DICTIONARY
  // ═══════════════════════════════════════════════════════════════════════
  'MCV': ['mcv', 'средний объем эритроцита', 'mean corpuscular volume', 'ср. объём эритроцита'],
  'MCH': ['mch', 'среднее содержание hb', 'mean corpuscular hemoglobin', 'ср. содержание hb'],
  'MCHC': ['mchc', 'средняя конц hb', 'mean corpuscular hemoglobin concentration', 'ср. конц. hb'],
  'NEUT': ['нейтрофилы', 'neut', 'neutrophils', 'нейтрофил'],
  'LYMPH': ['лимфоциты', 'lymph', 'lymphocytes', 'лимфоцит'],
  'MONO': ['моноциты', 'mono', 'monocytes', 'моноцит'],
  'EO': ['эозинофилы', 'eo', 'eosinophils', 'эозинофил'],
  'BASO': ['базофилы', 'baso', 'basophils', 'базофил'],
  'T4': ['т4 общий', 'тироксин общий', 'total t4', 'т4 общ'],
  'T3': ['т3 общий', 'трийодтиронин общий', 'total t3', 'т3 общ'],
  'CA125': ['ca-125', 'са-125', 'ca125', 'cancer antigen 125'],
  'AFP': ['афп', 'альфа-фетопротеин', 'afp', 'alpha-fetoprotein'],
  'CEA': ['рэа', 'раково-эмбриональный антиген', 'cea', 'carcinoembryonic antigen'],
  'MYOG': ['миоглобин', 'myoglobin', 'myo', 'миогл'],
  'IGA': ['iga', 'иммуноглобулин a', 'ig a'],
  'IGG': ['igg', 'иммуноглобулин g', 'ig g'],
  'IGM': ['igm', 'иммуноглобулин m', 'ig m'],
  'IGE': ['ige', 'иммуноглобулин e', 'ig e', 'общий ige'],
  'SOD': ['сод', 'супероксиддисмутаза', 'sod', 'superoxide dismutase'],
  'GLUT': ['глутатион', 'glutathione', 'gsh'],
  'GPX': ['глутатионпероксидаза', 'gpx', 'glutathione peroxidase'],
  'METAN': ['метанефрин', 'metanephrine', 'mn'],
  'NMETAN': ['норметанефрин', 'normetanephrine', 'nmn'],

  // ═══════════════════════════════════════════════════════════════════════
  // ОБЩИЙ АНАЛИЗ МОЧИ (ОАМ) — количественные маркёры
  // ═══════════════════════════════════════════════════════════════════════
  'URINE_SG': ['относительная плотность мочи', 'удельная плотность мочи', 'отн. плотность мочи', 'уд. вес мочи', 'specific gravity', 'urine sg', 'sg мочи', 'отн плотность'],
  'URINE_LEU': ['лейкоциты мочи', 'лейкоциты в моче', 'urine leukocytes', 'лейк мочи', 'leu urine'],
  'URINE_ERY': ['эритроциты мочи', 'эритроциты в моче', 'urine erythrocytes', 'эритр мочи', 'ery urine'],
  'URINE_EPITHELIAL': ['эпителий мочи', 'эпителиальные клетки мочи', 'эпителий в моче', 'urine epithelial', 'epithelial cells urine'],
  'URINE_CYLINDERS': ['цилиндры мочи', 'цилиндры в моче', 'гиалиновые цилиндры', 'urine casts', 'cylinders urine'],
  'URINE_GLUCOSE_Q': ['глюкоза мочи колич', 'глюкоза в моче колич', 'urine glucose quant', 'сахар мочи колич'],
  'URINE_KETONES_Q': ['кетоны мочи колич', 'кетоновые тела в моче колич', 'urine ketones quant', 'ketone bodies urine'],
  'PROTEIN_24H': ['суточная протеинурия', 'белок суточный', 'protein 24h', 'белок за сутки', 'суточный белок мочи'],
  'CREATININE_URINE': ['креатинин мочи', 'креатинин в моче', 'urine creatinine', 'креатинин суточный', 'креатинин суточная моча'],
  'URINE_VOLUME_24H': ['суточный диурез', 'объём мочи за сутки', 'объем мочи суточный', 'urine volume 24h', 'диурез суточный'],
  'UROBILINOGEN': ['уробилиноген', 'urobilinogen', 'уробилин', 'уробилиноген мочи'],
  'URINE_NITRITE_Q': ['нитриты мочи колич', 'нитриты в моче колич', 'urine nitrite quant', 'nitrite urine'],
  'URINE_BILIRUBIN_Q': ['билирубин мочи колич', 'билирубин в моче колич', 'urine bilirubin quant'],
  'NECHIP_LEU': ['лейкоциты нечипоренко', 'нечипоренко лейкоциты', 'nechiporenko leukocytes', 'лейк по нечипоренко', 'нечипоренко leu'],
  'NECHIP_ERY': ['эритроциты нечипоренко', 'нечипоренко эритроциты', 'nechiporenko erythrocytes', 'эритр по нечипоренко', 'нечипоренко ery'],
  'NECHIP_CYL': ['цилиндры нечипоренко', 'нечипоренко цилиндры', 'nechiporenko casts', 'цил по нечипоренко', 'нечипоренко cyl'],
  'URINE_CALCIUM': ['кальций мочи', 'кальций в моче суточный', 'urine calcium', 'суточный кальций мочи', 'ca мочи'],
  'URINE_OXALATE': ['оксалаты мочи', 'оксалаты в моче', 'urine oxalate', 'щавелевая кислота мочи', 'оксалат-ионы'],
  'URINE_URATE': ['ураты мочи', 'ураты в моче суточные', 'urine urate', 'мочевая кислота мочи', 'урат-ионы мочи'],
  // ── Полуколичественные (качественные знаки: neg/следы/+/++/+++/++++) ──
  'URINE_PROTEIN_QR': ['белок мочи (кач)', 'белок в моче (кач)', 'белок мочи кач', 'protein urine qual', 'белок мочи тест-полоска'],
  'URINE_GLUCOSE_QR': ['глюкоза мочи (кач)', 'сахар мочи (кач)', 'глюкоза мочи кач', 'glucose urine qual', 'тест-полоска глюкоза'],
  'URINE_KETONES_QR': ['кетоны мочи (кач)', 'кетоновые тела мочи (кач)', 'кетоны мочи кач', 'ketones urine qual'],
  'URINE_BILIRUBIN_QR': ['билирубин мочи (кач)', 'bilirubin urine qual', 'билирубин мочи кач'],
  'UROBILINOGEN_QR': ['уробилиноген (кач)', 'urobilinogen qual', 'уробилиноген кач'],
  'URINE_NITRITE_QR': ['нитриты мочи (кач)', 'nitrite urine qual', 'нитриты мочи кач'],
  'URINE_LEU_QR': ['лейкоциты мочи (кач)', 'leu urine qual', 'лейкоциты мочи кач', 'тест-полоска лейкоциты'],
  'URINE_BLOOD_QR': ['кровь мочи (кач)', 'blood urine qual', 'кровь в моче (кач)', 'эритроциты кач мочи', 'скрытая кровь мочи'],
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIT MAP — canonical units for each biomarker
// ═══════════════════════════════════════════════════════════════════════════

export const UNIT_MAP: Record<string, string> = {
  'ALT': 'U/L', 'AST': 'U/L', 'GGT': 'U/L', 'ALP': 'U/L', 'CK': 'U/L',
  'CK_MB': 'U/L', 'LDH': 'U/L',
  'Creatinine': 'mcmol/L', 'Urea': 'mmol/L', 'Uric_Acid': 'mcmol/L',
  'Bilirubin_Total': 'mcmol/L', 'Bilirubin_Direct': 'mcmol/L',
  'Glucose': 'mmol/L', 'HbA1c': '%',
  'Cholesterol_Total': 'mmol/L', 'HDL': 'mmol/L', 'LDL': 'mmol/L',
  'Triglycerides': 'mmol/L',
  'Testosterone_Total': 'nmol/L', 'Testosterone_Free': 'pmol/L',
  'E2': 'pmol/L', 'Prolactin': 'mIU/L', 'LH': 'IU/L', 'FSH': 'IU/L',
  'Progesterone': 'nmol/L', 'Cortisol': 'nmol/L', 'DHEA_S': 'mcmol/L',
  'TSH': 'mIU/L', 'T3_Free': 'pmol/L', 'T4_Free': 'pmol/L',
  'SHBG': 'nmol/L', 'DHT': 'nmol/L', 'IGF-1': 'ng/mL',
  'PSA': 'ng/mL', 'PSA_Free': 'ng/mL',
  'Hematocrit': '%', 'Hemoglobin': 'g/L', 'Ferritin': 'ng/mL',
  'WBC': '10^9/L', 'RBC': '10^12/L', 'Platelets': '10^9/L',
  'Vitamin_D': 'ng/mL', 'Vitamin_B12': 'pg/mL', 'Folate': 'ng/mL',
  'Iron': 'mcmol/L', 'TIBC': 'mcmol/L', 'Transferrin': 'g/L',
  'hs-CRP': 'mg/L', 'CRP': 'mg/L', 'Homocysteine': 'mcmol/L',
  'Cystatin_C': 'mg/L', 'UACR': 'mg/g', 'eGFR': 'mL/min/1.73m2',
  'Magnesium': 'mmol/L', 'Calcium': 'mmol/L', 'Potassium': 'mmol/L',
  'Sodium': 'mmol/L', 'Phosphorus': 'mmol/L', 'Zinc': 'mcmol/L',
  'Albumin': 'g/L', 'Total_Protein': 'g/L',
  'Fibrinogen': 'g/L', 'D_Dimer': 'ng/mL', 'INR': '',
  'NT-proBNP': 'pg/mL', 'Galectin-3': 'ng/mL', 'Troponin_I': 'ng/mL',
  'ADMA': 'mcmol/L', 'ApoB': 'g/L', 'ApoA1': 'g/L', 'Lp_a': 'mg/dL',
  'EPO': 'mIU/mL', 'Inhibin_B': 'pg/mL', 'HVA': 'mg/24h',
  'CTX': 'ng/mL', 'COMP': 'U/L', 'P1NP': 'ng/mL', 'Osteocalcin': 'ng/mL',
  'PTH': 'pg/mL', 'Insulin': 'mIU/L', 'C-Peptide': 'ng/mL',
  'CK-18': 'U/L', 'GLDH': 'U/L', 'Bile_Acids': 'mcmol/L',
  'KIM-1': 'ng/mL', 'Nephrin': 'ng/mL', 'Microalbumin': 'mg/L',
  'Selenium': 'mcg/L', 'Copper': 'mcmol/L',
  'ACTH': 'pg/mL', 'OH17_Progesterone': 'nmol/L', 'Aldosterone': 'pg/mL',
  'TPO_AB': 'IU/mL', 'TG_AB': 'IU/mL', 'MPV': 'fL',
  'Amylase': 'U/L', 'Lipase': 'U/L', 'Proinsulin': 'pmol/L', 'Fructosamine': 'mcmol/L',
  // ── Новые маркёры: UCUM_MAP canonical units ──
  'AMH': 'ng/mL', 'BNP': 'pg/mL', 'PROTEIN_URINE': 'mg/L', 'ENDOTHELIN1': 'pg/mL',
  'NO_MARKER': 'umol/L', 'ESTRADIOL_SENS': 'pmol/L', 'PREALBUMIN': 'mg/L',
  'RETICULOCYTES': '%', 'HAPTOGLOBIN': 'g/L', 'NGAL': 'ng/mL',
  'TNF_ALPHA': 'pg/mL', 'IL6': 'pg/mL', 'IL1B': 'pg/mL',
  'LACTATE': 'mmol/L', 'AMMONIA': 'umol/L', 'IGFBP3': 'mg/L',
  'CHOLINESTERASE': 'U/L', 'OSMOLALITY': 'mOsm/kg', 'ANION_GAP': 'mmol/L',
  'URINE_PH': '', 'URINE_OSM': 'mOsm/kg',
  'MAR_TEST': '%', 'DFI': '%', 'HDS': '%',
  'MCV': 'fL', 'MCH': 'pg', 'MCHC': 'g/L',
  'NEUT': '%', 'LYMPH': '%', 'MONO': '%', 'EO': '%', 'BASO': '%',
  'T4': 'nmol/L', 'T3': 'nmol/L',
  'CA125': 'U/mL', 'AFP': 'IU/mL', 'CEA': 'ng/mL', 'MYOG': 'ng/mL',
  'IGA': 'g/L', 'IGG': 'g/L', 'IGM': 'g/L', 'IGE': 'IU/mL',
  'SOD': 'U/mL', 'GLUT': 'umol/L', 'GPX': 'U/g Hb',
  'METAN': 'mcg/24h', 'NMETAN': 'mcg/24h',
  // ── ОАМ количественные ──
  'URINE_SG': '', 'URINE_LEU': 'cells/uL', 'URINE_ERY': 'cells/uL',
  'URINE_EPITHELIAL': 'cells/uL', 'URINE_CYLINDERS': 'cells/uL',
  'URINE_GLUCOSE_Q': 'mmol/L', 'URINE_KETONES_Q': 'mmol/L',
  'PROTEIN_24H': 'mg/24h', 'CREATININE_URINE': 'mmol/L',
  'URINE_VOLUME_24H': 'mL/24h', 'UROBILINOGEN': 'mg/L',
  'URINE_NITRITE_Q': 'mg/L', 'URINE_BILIRUBIN_Q': 'umol/L',
  'NECHIP_LEU': 'cells/mL', 'NECHIP_ERY': 'cells/mL', 'NECHIP_CYL': 'cells/mL',
  'URINE_CALCIUM': 'mmol/24h', 'URINE_OXALATE': 'mmol/24h', 'URINE_URATE': 'mmol/24h',
  // ── Полуколичественные ──
  'URINE_PROTEIN_QR': 'score', 'URINE_GLUCOSE_QR': 'score',
  'URINE_KETONES_QR': 'score', 'URINE_BILIRUBIN_QR': 'score',
  'UROBILINOGEN_QR': 'score', 'URINE_NITRITE_QR': 'score',
  'URINE_LEU_QR': 'score', 'URINE_BLOOD_QR': 'score',
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE ENGINE — Regex Parsing
// ═══════════════════════════════════════════════════════════════════════════

/** Single extracted biomarker */
export interface ExtractedMarker {
  code: string;
  name: string;
  value: number;
  ec50: number;
  unit: string;
  sourceLine: string;
  confidence: number;  // 0-1
  refRangeText: string;
}

/** Complete extraction result */
export interface ExtractionResult {
  extractedMarkers: ExtractedMarker[];
  unrecognizedLines: number;
  totalLines: number;
  extractionMethod: string;
  warnings: string[];
}

/**
 * Preprocess a raw text line:
 *  - Lowercase
 *  - Comma → dot (decimal)
 *  - Strip extra whitespace
 */
function preprocessLine(line: string): string {
  // Если строка содержит качественные знаки ОАМ (+, ++, +++, neg, следы, отрицательно),
  // мы НЕ удаляем watermark-токены — иначе имена маркеров ("белок мочи", "следы")
  // исчезнут, и matchBiomarker не найдёт полуколичественные маркеры.
  // ВНИМАНИЕ: \b в JS regex не работает для Cyrillic — используем Cyrillic-aware boundary.
  const hasQualSigns = /\+{1,4}|(?<![а-яё])(neg|negative|следы|след|trace|отрицательно|отр|нет|ne обн)(?![а-яё])/i.test(line);
  let result = line.trim().toLowerCase()
    .replace(/(?<=\d)[оo](?=\d|[.,])/g, '0')
    .replace(/(?<=\d)[оo](?=\s|$)/g, '0')
    .replace(/мк\s*моль\s*\/\s*л/g, 'мкмоль/л')
    .replace(/м\s*[еe]д\s*\/\s*л/g, 'мЕд/л')
    .replace(/мг\s*\/\s*дл/g, 'мг/дл')
    .replace(/ммоль\s*\/\s*л/g, 'ммоль/л')
    .replace(/,/g, '.')
    // Remove strikethrough artifacts from OCR (only trailing ~ or - before whitespace/punctuation/end)
    .replace(/\b\w+[~-]+(?=\s|[.,;!?]|$)/g, '');
  // Remove watermark-like short all-alpha tokens (3-12 chars, no digits)
  // SKIP for lines with qualitative signs (ОАМ) — preserves marker names like "белок мочи"
  if (!hasQualSigns) {
    result = result.replace(/\b[a-zа-яё]{3,12}\b(?!.*\d)/gi, '');
  }
  return result.replace(/\s+/g, ' ');
}

/**
 * Extract all floating-point numbers from a string.
 * Handles: "15.4", "0.5", "106", "15,4" (already normalized to dot).
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number).filter(n => !isNaN(n));
}

/**
 * Полуколичественный парсинг для качественных тестов ОАМ (шкала 0-4):
 *   neg / отрицательно / нет / "не обн."  → 0
 *   следы / trace                         → 0.5
 *   + → 1, ++ → 2, +++ → 3, ++++ → 4
 * Возвращает null, если качественных знаков нет.
 */
function extractQualitativeScore(text: string): number | null {
  const lower = text.toLowerCase();
  // ВНИМАНИЕ: \b в JS regex не работает для Cyrillic (только ASCII \w).
  // Используем lookbehind/lookahead для Cyrillic-aware word boundary.
  if (/(?<![а-яё])(neg|negative|отрицательно|отр\.?|не обн|необн|не обнаружено|нет|n\/a)(?![а-яё])/i.test(lower)) return 0;
  if (/(?<![а-яё])(следы|след|trace|traces|сл\.?)(?![а-яё])/i.test(lower)) return 0.5;
  const plusMatch = lower.match(/\+{1,4}/g);
  if (plusMatch) {
    const max = Math.max(...plusMatch.map(p => p.length));
    return Math.min(4, max);
  }
  return null;
}

/**
 * Smart value/EC50 detection per the specified heuristic:
 *  1. Get all numbers from the line.
 *  2. If line contains `<`, ec50 = the number after `<` (or 41 in "< 41").
 *  3. First number = value (result).
 *  4. Last number = EC50 / upper bound.
 *  5. If only 1 number: value = that number, ec50 = value * 1.5 (fallback).
 */
function extractValueAndEc50(
  line: string,
  numbers: number[],
): { value: number; ec50: number; refText: string } {
  if (numbers.length === 0) {
    return { value: 0, ec50: 0, refText: '' };
  }

  // Check for "<" pattern: "< 41" → ec50 = 41
  const ltMatch = line.match(/<\s*(\d+(?:\.\d+)?)/);
  if (ltMatch) {
    const ec50 = parseFloat(ltMatch[1]);
    // Value is the first number NOT matching the < pattern
    const ltVal = parseFloat(ltMatch[0].replace(/[<\s]/g, ''));
    const val = numbers.length >= 2
      ? numbers.find(n => n !== ltVal && n !== ec50) || numbers[0]
      : numbers[0];
    return { value: val, ec50, refText: `< ${ec50}` };
  }

  // Check for ">" pattern: "> 100" → ec50 = 100
  const gtMatch = line.match(/>\s*(\d+(?:\.\d+)?)/);
  if (gtMatch) {
    const ec50 = parseFloat(gtMatch[1]);
    const gtVal = parseFloat(gtMatch[0].replace(/[>\s]/g, ''));
    const val = numbers.length >= 2
      ? numbers.find(n => n !== gtVal && n !== ec50) || numbers[0]
      : numbers[0];
    return { value: val, ec50, refText: `> ${ec50}` };
  }

  // Check for reference range: "62 - 106" or "62–106" or "62..106"
  const refMatch = line.match(/(\d+(?:\.\d+)?)\s*[-–…]+\s*(\d+(?:\.\d+)?)/);
  if (numbers.length >= 2) {
    // First = value (usually); last = ec50 (ULN)
    // But reference ranges have 2+ numbers. Skip the ones that look like range bounds
    let value = numbers[0];
    let ec50 = numbers[numbers.length - 1];

    // If there's a reference range, prefer the upper bound as ec50
    if (refMatch) {
      ec50 = parseFloat(refMatch[2]);
      // Remove ref range numbers from consideration for value
      const ref1 = parseFloat(refMatch[1]);
      const ref2 = parseFloat(refMatch[2]);
      const nonRef = numbers.filter(n => n !== ref1 && n !== ref2);
      if (nonRef.length > 0) value = nonRef[0];
    }

    return {
      value,
      ec50,
      refText: refMatch ? refMatch[0] : '',
    };
  }

  // Single number: value = that, ec50 = value * 1.5
  return { value: numbers[0], ec50: numbers[0] * 1.5, refText: '' };
}

/**
 * Find which biomarker (if any) this line matches.
 * Scans BIOMARKER_DICTIONARY for synonyms in the line.
 */
function matchBiomarker(line: string): { code: string; synonym: string } | null {
  let best: { code: string; synonym: string; len: number } | null = null;
  for (const [code, synonyms] of Object.entries(BIOMARKER_DICTIONARY)) {
    for (const syn of synonyms) {
      if (line.includes(syn)) {
        const len = syn.length;
        if (!best || len > best.len) {
          best = { code, synonym: syn, len };
        }
      }
    }
  }
  return best ? { code: best.code, synonym: best.synonym } : null;
}

/**
 * Main parsing function.
 *
 * Algorithm:
 *  1. Split raw text into lines.
 *  2. For each line: preprocess, check against BIOMARKER_DICTIONARY.
 *  3. If matched, extract numbers and apply heuristics.
 *  4. Return structured result.
 *
 * @param rawText - Raw text from PDF extraction or Tesseract OCR.
 * @param extractionMethod - 'pdf-parse' | 'tesseract.js' | 'text'
 */
export function parseLabResults(
  rawText: string,
  extractionMethod: string = 'text',
): ExtractionResult {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const markers: ExtractedMarker[] = [];
  const seenCodes = new Set<string>();
  const warnings: string[] = [];
  let linesWithNumbers = 0;

  for (const rawLine of lines) {
    const line = preprocessLine(rawLine);

    // Skip empty lines and header lines
    if (line.length < 3) continue;
    if (/^(наименование|показатель|аналит|test|parameter|исследование|маркер)/i.test(line)) continue;
    if (/^(результат|референс|единицы|норма|реф\.?|ref\.?\s*знач)/i.test(line)) continue;

    // Check if this line contains any numbers (for stats)
    const hasNumbers = /\d+(?:\.\d+)?/.test(line);
    if (hasNumbers) linesWithNumbers++;

    // Try to match a biomarker
    const match = matchBiomarker(line);
    if (!match) continue;

    // Already seen this code? Skip duplicates
    if (seenCodes.has(match.code)) continue;

    // Extract numbers
    const numbers = extractNumbers(line);

    // Полуколичественный fallback для качественных тестов ОАМ.
    // Если BIOMARKER_DICTIONARY маркер оканчивается на _QR и число не найдено,
    // пробуем распознать качественные знаки (neg/следы/+/++/+++/++++).
    if (numbers.length === 0 && match.code.endsWith('_QR')) {
      const q = extractQualitativeScore(rawLine);
      if (q !== null) {
        seenCodes.add(match.code);
        markers.push({
          code: match.code,
          name: match.code.replace(/_/g, ' '),
          value: q,
          ec50: 0.5,
          unit: UNIT_MAP[match.code] || 'score',
          sourceLine: rawLine,
          confidence: 0.75,
          refRangeText: '',
        });
      }
      continue;
    }

    if (numbers.length === 0) continue;

    // Heuristics
    const { value, ec50, refText } = extractValueAndEc50(line, numbers);

    if (value <= 0) continue;

    const unit = UNIT_MAP[match.code] || '';

    // Confidence: higher for multi-number lines with ref ranges
    let confidence = 0.6;
    if (refText) confidence = 0.85;
    if (numbers.length >= 2 && value > 0 && ec50 > 0) confidence = 0.9;
    if (refText && numbers.length >= 2) confidence = 0.95;
    // Penalize very short source lines (likely OCR artifacts)
    if (rawLine.trim().length < 10) confidence *= 0.7;
    // Boost for known provider-specific patterns
    if (/результат|референс|единицы/i.test(rawLine)) confidence = Math.min(1, confidence + 0.05);

    seenCodes.add(match.code);

    markers.push({
      code: match.code,
      name: match.code.replace(/_/g, ' '),
      value,
      ec50,
      unit,
      sourceLine: rawLine,
      confidence,
      refRangeText: refText,
    });
  }

  const unrecognizedLines = linesWithNumbers - markers.length;

  if (markers.length === 0) {
    warnings.push('Не найдено ни одного маркера. Проверьте качество текста или попробуйте другой формат файла.');
  }

  if (unrecognizedLines > linesWithNumbers * 0.5) {
    warnings.push(`Большинство строк с числами (${unrecognizedLines}/${linesWithNumbers}) не распознаны. Возможно, нужен другой формат.`);
  }

  return {
    extractedMarkers: markers,
    unrecognizedLines: Math.max(0, unrecognizedLines),
    totalLines: lines.length,
    extractionMethod,
    warnings,
  };
}

/**
 * Quick parse — extract just the most confident markers.
 * For use in inline/paste scenarios.
 */
export function quickParse(rawText: string): Pick<ExtractionResult, 'extractedMarkers' | 'warnings'> {
  const result = parseLabResults(rawText, 'quick');
  return { extractedMarkers: result.extractedMarkers, warnings: result.warnings };
}
