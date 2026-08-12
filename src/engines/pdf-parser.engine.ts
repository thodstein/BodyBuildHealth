export interface ParsedLabValue {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  isAbnormal?: boolean;
  raw?: string;
  confidence?: number;
}

export interface ParsedLabResult {
  values: ParsedLabValue[];
  rawText: string;
  originalText?: string;
  source: 'pdf' | 'image' | 'text';
  date?: string;
  warnings?: string[];
}

const LAB_PATTERNS: { code: string; names: string[]; unitPatterns: string[]; refPattern?: RegExp }[] = [
  { code: 'ALT', names: ['АЛТ', 'ALT', 'аланин', 'аланинаминотрансфераза', 'Alanine aminotransferase'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л', 'ЕД/л'] },
  { code: 'AST', names: ['АСТ', 'AST', 'аспартат', 'аспартатаминотрансфераза', 'Aspartate aminotransferase'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л', 'ЕД/л'] },
  { code: 'GGT', names: ['ГГТ', 'GGT', 'гамма-глутамилтранспептидаза', 'Gamma-GT', 'гамма-ГТ'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л'] },
  { code: 'ALP', names: ['щелочная фосфатаза', 'ЩФ', 'ALP', 'Alkaline Phosphatase', 'щелоч'], unitPatterns: ['Е/л', 'U/L', 'U/l', 'ед/л'] },
  { code: 'BIL', names: ['билирубин', 'Bilirubin', 'BIL', 'билирубин общий', 'общий билирубин', 'Bilirubin total'], unitPatterns: ['мкмоль/л', 'umol/L', 'мкм/л'] },
  { code: 'BILD', names: ['билирубин прямой', 'прямой билирубин', 'Bilirubin direct', 'BIL-D'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'GLU', names: ['глюкоза', 'Glucose', 'GLU', 'сахар крови'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'CREAT', names: ['креатинин', 'Creatinine', 'CREAT', 'CREA', 'креат'], unitPatterns: ['мкмоль/л', 'umol/L', 'мг/дл', 'mg/dL', 'мкМ/л'] },
  { code: 'UREA', names: ['мочевина', 'Urea', 'BUN', 'азот мочевины'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'URIC', names: ['мочевая кислота', 'Uric acid', 'UA', 'моч.кислота'], unitPatterns: ['мкмоль/л', 'umol/L', 'мг/дл', 'mg/dL'] },
  { code: 'TP', names: ['общий белок', 'Total Protein', 'TP', 'белок общий', 'общ белок', 'общ.белок'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'ALB', names: ['альбумин', 'Albumin', 'ALB', 'альб.'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'HGB', names: ['гемоглобин', 'Hemoglobin', 'HGB', 'Hb'], unitPatterns: ['г/л', 'g/L', 'g/dL'] },
  { code: 'WBC', names: ['лейкоциты', 'WBC', 'лейкоцит', 'White blood cells'], unitPatterns: ['10^9/л', '10\\^9/L', '×10⁹/л', '/л', 'тыс/мкл'] },
  { code: 'RBC', names: ['эритроциты', 'RBC', 'эритроцит', 'Red blood cells'], unitPatterns: ['10^12/л', '10\\^12/L', '×10¹²/л', '/л', 'млн/мкл'] },
  { code: 'PLT', names: ['тромбоциты', 'PLT', 'Platelet', 'тромбоцит'], unitPatterns: ['10^9/л', '10\\^9/L', '×10⁹/л', '/л', 'тыс/мкл'] },
  { code: 'HCT', names: ['гематокрит', 'Hematocrit', 'HCT', 'Ht'], unitPatterns: ['%', '%'] },
  { code: 'MCV', names: ['MCV', 'средний объем эритроцита'], unitPatterns: ['фл', 'fl', 'мкм³'] },
  { code: 'MCH', names: ['MCH', 'среднее содержание Hb в эр'], unitPatterns: ['пг', 'pg'] },
  { code: 'MCHC', names: ['MCHC', 'средняя конц. Hb в эр', 'средняя концентрация Hb', 'средняя концентрация гемоглобина', 'ср. конц. Hb'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'NEUT', names: ['нейтрофилы', 'NEUT', 'Neutrophils'], unitPatterns: ['%', '10^9/л'] },
  { code: 'LYMPH', names: ['лимфоциты', 'LYMPH', 'Lymphocytes'], unitPatterns: ['%', '10^9/л'] },
  { code: 'MONO', names: ['моноциты', 'MONO', 'Monocytes'], unitPatterns: ['%', '10^9/л'] },
  { code: 'EO', names: ['эозинофилы', 'EO', 'Eosinophils'], unitPatterns: ['%', '10^9/л'] },
  { code: 'BASO', names: ['базофилы', 'BASO', 'Basophils'], unitPatterns: ['%', '10^9/л'] },
  { code: 'CHOL', names: ['холестерин', 'холестерол', 'Cholesterol', 'CHOL', 'ХС общий', 'холестерин общий'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'HDL', names: ['ЛПВП', 'HDL', 'ЛПВП-ХС', 'холестерин ЛПВП', 'HDL-C'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'LDL', names: ['ЛПНП', 'LDL', 'ЛПНП-ХС', 'холестерин ЛПНП', 'LDL-C'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'VLDL', names: ['ЛПОНП', 'VLDL', 'ЛПОНП-ХС'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'TG', names: ['триглицериды', 'Triglycerides', 'TG', 'ТГ'], unitPatterns: ['ммоль/л', 'mmol/L', 'mg/dL', 'mM'] },
  { code: 'CRP', names: ['С-реактивный белок', 'СРБ', 'CRP', 'C-Reactive', 'hsCRP', 'hs-СРБ'], unitPatterns: ['мг/л', 'mg/L'] },
  { code: 'ESR', names: ['СОЭ', 'ESR', 'скорость оседания', 'РОЭ'], unitPatterns: ['мм/ч', 'mm/h'] },
  { code: 'FER', names: ['ферритин', 'Ferritin', 'FER'], unitPatterns: ['мкг/л', 'ug/L', 'нг/мл', 'ng/mL', 'мк/л'] },
  { code: 'TSH', names: ['ТТГ', 'TSH', 'тиреотропный', 'тиротропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/л', 'мЕд/мл'] },
  { code: 'FT4', names: ['Т4 свободный', 'Т4 св', 'FT4', 'Free T4', 'тироксин свободный'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'FT3', names: ['Т3 свободный', 'Т3 св', 'FT3', 'Free T3', 'трийодтиронин свободный'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'T4', names: ['Т4 общий', 'тироксин общий', 'Total T4'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'T3', names: ['Т3 общий', 'трийодтиронин общий', 'Total T3'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'TESTO', names: ['тестостерон', 'Testosterone', 'тестостерон общий', 'общий тестостерон'], unitPatterns: ['нмоль/л', 'nmol/L', 'нг/мл', 'ng/mL', 'нг/дл', 'ng/dL'] },
  { code: 'FTESTO', names: ['тестостерон свободный', 'свободный тестостерон', 'Free Testosterone', 'Free T'], unitPatterns: ['пмоль/л', 'pmol/L', 'пг/мл', 'pg/mL'] },
  { code: 'SHBG', names: ['SHBG', 'ГСПГ', 'глобулин связывающий половые'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'DHEA', names: ['DHEA', 'ДГЭА', 'DHEA-S', 'ДГЭА-С', 'дегидроэпиандростерон'], unitPatterns: ['мкг/дл', 'ug/dL', 'мкмоль/л', 'umol/L', 'нг/мл'] },
  { code: 'ANDRO', names: ['андростендион', 'Androstenedione'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л'] },
  { code: 'ESTR', names: ['эстрадиол', 'Estradiol', 'E2', 'EII'], unitPatterns: ['пмоль/л', 'pmol/L', 'pg/mL'] },
  { code: 'OH17P', names: ['17-он-прогестерон', '17-гидроксипрогестерон', 'OH17P'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'PROG', names: ['прогестерон', 'Progesterone', 'PROG'], unitPatterns: ['нмоль/л', 'nmol/L', 'нг/мл'] },
  { code: 'PROL', names: ['пролактин', 'Prolactin', 'PRL'], unitPatterns: ['мЕд/л', 'mIU/L', 'нг/мл', 'ng/mL', 'мМЕ/л'] },
  { code: 'LH', names: ['ЛГ', 'LH', 'лютеинизирующий', 'лютропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/мл'] },
  { code: 'FSH', names: ['ФСГ', 'FSH', 'фолликулостимулирующий', 'фоллитропин'], unitPatterns: ['мЕд/л', 'mIU/L', 'мМЕ/мл'] },
  { code: 'CORT', names: ['кортизол', 'Cortisol', 'CORT'], unitPatterns: ['нмоль/л', 'nmol/L', 'мкг/дл', 'ug/dL'] },
  { code: 'PROINSULIN', names: ['проинсулин', 'Proinsulin', 'PROINSULIN'], unitPatterns: ['пмоль/л', 'pmol/L'] },
  { code: 'INSULIN', names: ['инсулин', 'Insulin', 'INS', 'IMMUNOREACTIVE INSULIN'], unitPatterns: ['мкЕд/мл', 'uIU/mL', 'пмоль/л', 'pmol/L'] },
  { code: 'FRUCTOSAMINE', names: ['фруктозамин', 'Fructosamine', 'фруктоз.'], unitPatterns: ['мкмоль/л', 'mcmol/L'] },
  { code: 'HOMOCYSTEINE', names: ['гомоцистеин', 'Homocysteine', 'Hcy'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'HBA1C', names: ['HbA1c', 'гликированный гемоглобин', 'HBA1C', 'гликогемоглобин', 'HbA1'], unitPatterns: ['%', '%', 'ммоль/моль'] },
  { code: 'PSA', names: ['PSA', 'ПСА', 'простатический антиген', 'PSA общий'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'PSAF', names: ['PSA свободный', 'ПСА свободный', 'Free PSA'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'CA125', names: ['CA-125', 'СА-125', 'CA125'], unitPatterns: ['Е/мл', 'U/mL'] },
  { code: 'AFP', names: ['AFP', 'АФП', 'альфа-фетопротеин'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'CEA', names: ['CEA', 'РЭА', 'раково-эмбриональный антиген'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'VITD', names: ['витамин D', '25-OH витамин D', 'Vitamin D', '25(OH)D', '25-гидроксивитамин D', 'кальциферол'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л', 'nmol/L'] },
  { code: 'B12', names: ['витамин B12', 'B12', 'Cobalamin', 'кобаламин', 'цианокобаламин'], unitPatterns: ['пг/мл', 'pg/mL', 'пмоль/л', 'pmol/L'] },
  { code: 'VITAMIN_B6', names: ['витамин B6', 'Vitamin B6', 'B6', 'пиридоксалин'], unitPatterns: ['нмоль/л', 'nmol/L'] },
  { code: 'VITAMIN_E', names: ['витамин E', 'Vitamin E', 'токоферол'], unitPatterns: ['мкмоль/л', 'mcmol/L'] },
  { code: 'VITAMIN_A', names: ['витамин A', 'Vitamin A', 'ретинол'], unitPatterns: ['мкмоль/л', 'mcmol/L'] },
  { code: 'FOLATE', names: ['фолиевая кислота', 'фолат', 'Folate', 'витамин B9', 'B9'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л'] },
  { code: 'IRON', names: ['железо', 'Iron', 'Fe', 'сывороточное железо'], unitPatterns: ['мкмоль/л', 'umol/L', 'мкг/дл', 'ug/dL'] },
  { code: 'TRANSF', names: ['трансферрин', 'Transferrin', 'TRF'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'TIBC', names: ['ОЖСС', 'TIBC', 'железосвязывающая способность'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'K', names: ['калий', 'Potassium', 'K\\+', 'K', 'Kalium'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'NA', names: ['натрий', 'Sodium', 'Na\\+', 'Na', 'Natrium'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'CL', names: ['хлор', 'Chloride', 'Cl\\-', 'Cl'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'CA', names: ['кальций', 'Calcium', 'Ca', 'кальций общий'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM', 'мг/дл'] },
  { code: 'MG', names: ['магний', 'Magnesium', 'Mg'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'PHOS', names: ['фосфор', 'Phosphorus', 'P', 'фосфат'], unitPatterns: ['ммоль/л', 'mmol/L', 'mM'] },
  { code: 'LDH', names: ['ЛДГ', 'LDH', 'лактатдегидрогеназа'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'CK', names: ['КФК', 'CK', 'креатинкиназа', 'CPK'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'CKMB', names: ['КФК-МВ', 'CK-MB', 'креатинкиназа MB'], unitPatterns: ['Е/л', 'U/L', 'нг/мл'] },
  { code: 'TROP', names: ['тропонин', 'Troponin', 'TnI', 'TnT'], unitPatterns: ['нг/мл', 'ng/mL', 'пг/мл'] },
  { code: 'MYOG', names: ['миоглобин', 'Myoglobin', 'MYO'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'FIB', names: ['фибриноген', 'Fibrinogen', 'FIB'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'DIMER', names: ['D-димер', 'D-dimer', 'DDIMER'], unitPatterns: ['нг/мл', 'ng/mL', 'мкг/л'] },
  { code: 'PT', names: ['протромбиновое время', 'PT', 'Prothrombin time'], unitPatterns: ['сек', 's'] },
  { code: 'INR', names: ['МНО', 'INR', 'международное нормализованное'], unitPatterns: [''] },
  { code: 'APTT', names: ['АЧТВ', 'APTT', 'aPTT', 'Activated partial thromboplastin time'], unitPatterns: ['сек', 's'] },
  { code: 'IGA', names: ['IgA', 'иммуноглобулин A', 'Ig A'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'IGG', names: ['IgG', 'иммуноглобулин G', 'Ig G'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'IGM', names: ['IgM', 'иммуноглобулин M', 'Ig M'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'IGE', names: ['IgE', 'иммуноглобулин E', 'Ig E', 'общий IgE'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'HIV', names: ['ВИЧ', 'HIV', 'антитела к ВИЧ'], unitPatterns: [''] },
  { code: 'HBSAG', names: ['HBsAg', 'австралийский антиген', 'гепатит B'], unitPatterns: [''] },
  { code: 'HCV', names: ['антитела к гепатиту C', 'Anti-HCV', 'HCV'], unitPatterns: [''] },
  { code: 'ABO', names: ['группа крови', 'ABO', 'Blood type'], unitPatterns: [''] },
  { code: 'RH', names: ['резус-фактор', 'Rh', 'RH factor'], unitPatterns: [''] },
  { code: 'SOD', names: ['СОД', 'супероксиддисмутаза', 'SOD'], unitPatterns: ['Е/мл'] },
  { code: 'GLUT', names: ['глутатион', 'Glutathione', 'GSH'], unitPatterns: ['мкмоль/л'] },
  { code: 'GPX', names: ['глутатионпероксидаза', 'GPX', 'Glutathione peroxidase'], unitPatterns: ['Е/г Hb'] },
  { code: 'IGF1', names: ['ИФР-1', 'IGF-1', 'IGF1', 'соматомедин C', 'инсулиноподобный фактор роста'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л'] },
  { code: 'GH', names: ['ГР', 'GH', 'соматотропный', 'гормон роста'], unitPatterns: ['нг/мл', 'ng/mL', 'мЕд/л'] },
  { code: 'PTH', names: ['ПТГ', 'PTH', 'паратгормон', 'паратиреоидный'], unitPatterns: ['пг/мл', 'pg/mL', 'пмоль/л'] },
  { code: 'CT', names: ['кальцитонин', 'Calcitonin', 'CT'], unitPatterns: ['пг/мл', 'pg/mL'] },
  { code: 'RENIN', names: ['ренин', 'Renin', 'RENIN'], unitPatterns: ['мкМЕ/мл', 'pg/mL'] },
  { code: 'ALD', names: ['альдостерон', 'Aldosterone', 'ALD'], unitPatterns: ['пг/мл', 'pg/mL', 'нмоль/л'] },
  { code: 'METAN', names: ['метанефрин', 'Metanephrine', 'MN'], unitPatterns: ['мкг/сут'] },
  { code: 'NMETAN', names: ['норметанефрин', 'Normetanephrine', 'NMN'], unitPatterns: ['мкг/сут'] },
  { code: 'AMY', names: ['амилаза', 'Amylase', 'AMY', 'альфа-амилаза'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'LIP', names: ['липаза', 'Lipase', 'LIP', 'LPS'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'ACTH', names: ['АКТГ', 'ACTH', 'адренокортикотропный гормон'], unitPatterns: ['пг/мл', 'pg/mL'] },
  { code: 'TPO_AB', names: ['АТ к ТПО', 'anti-TPO', 'антитела к тиреопероксидазе'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'TG_AB', names: ['АТ к ТГ', 'АТ к тиреоглобулину', 'anti-TG', 'антитела к тиреоглобулину'], unitPatterns: ['МЕ/мл', 'IU/mL'] },
  { code: 'MPV', names: ['МПВ', 'MPV', 'средний объем тромбоцита'], unitPatterns: ['фл', 'fL'] },
  { code: 'UIBC', names: ['лат. жсс', 'uibc', 'unsaturated iron', 'unsat iron binding', 'лат жсс'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  { code: 'GLOB', names: ['глобулины', 'globulin', 'глобулин общий'], unitPatterns: ['г/л', 'g/L'] },
  { code: 'C_PEPTIDE', names: ['с-пептид', 'c-peptide', 'c peptide', 'с пептид'], unitPatterns: ['пмоль/л', 'pmol/L', 'нг/мл'] },
  { code: 'AG_RATIO', names: ['а/г', 'a/g', 'альбумин/глобулин', 'альбумино-глобулиновый'], unitPatterns: ['', ''] },
  { code: 'BILIR', names: ['билирубин непрямой', 'непрямой билирубин', 'indirect bilirubin', 'BIL-IR'], unitPatterns: ['мкмоль/л', 'umol/L'] },
  // ── 24 маркёра из UCUM_MAP, не распознававшиеся парсером ──
  { code: 'AMH', names: ['антимюллеров гормон', 'АМГ', 'AMH', 'Anti-Müllerian hormone'], unitPatterns: ['нг/мл', 'ng/mL'] },
  { code: 'BNP', names: ['BNP', 'натрийуретический пептид', 'B-type natriuretic', 'brain natriuretic'], unitPatterns: ['пг/мл', 'pg/mL'] },
  { code: 'PROTEIN_URINE', names: ['протеинурия', 'белок в моче', 'protein urine', 'общий белок мочи'], unitPatterns: ['мг/л', 'mg/L', 'г/л'] },
  { code: 'ENDOTHELIN1', names: ['эндотелин-1', 'эндотелин 1', 'Endothelin-1', 'ET-1'], unitPatterns: ['пг/мл', 'pg/mL', 'фмоль/л'] },
  { code: 'NO_MARKER', names: ['оксид азота', 'нитраты и нитриты', 'NO', 'nitric oxide', 'нитрит'], unitPatterns: ['мкмоль/л', 'umol/L', 'моль/л'] },
  { code: 'ESTRADIOL_SENS', names: ['эстрадиол чувствительный', 'чувствительный эстрадиол', 'E2 чувств', 'estradiol sensitive'], unitPatterns: ['пмоль/л', 'pmol/L', 'пг/мл', 'pg/mL'] },
  { code: 'PREALBUMIN', names: ['преальбумин', 'транстиретин', 'Prealbumin', 'Transthyretin', 'TBPA'], unitPatterns: ['мг/л', 'mg/L', 'г/л'] },
  { code: 'RETICULOCYTES', names: ['ретикулоциты', 'Retikulocytes', 'ретик', 'Retics'], unitPatterns: ['%', '10^9/л', 'промилле'] },
  { code: 'HAPTOGLOBIN', names: ['гаптоглобин', 'Haptoglobin', 'гаптогл'], unitPatterns: ['г/л', 'g/L', 'мг/дл'] },
  { code: 'NGAL', names: ['NGAL', 'липокалин', 'Lipocalin-2', 'нейтрофильный липокалин'], unitPatterns: ['нг/мл', 'ng/mL', 'мкг/л'] },
  { code: 'TNF_ALPHA', names: ['ФНО-альфа', 'ФНО-a', 'TNF-alpha', 'TNF-α', 'фактор некроза опухоли'], unitPatterns: ['пг/мл', 'pg/mL', 'нг/л'] },
  { code: 'IL6', names: ['ИЛ-6', 'IL-6', 'интерлейкин 6', 'Interleukin-6', 'ИЛ6'], unitPatterns: ['пг/мл', 'pg/mL', 'нг/л'] },
  { code: 'IL1B', names: ['ИЛ-1бета', 'ИЛ-1β', 'IL-1beta', 'IL-1β', 'интерлейкин 1', 'Interleukin-1'], unitPatterns: ['пг/мл', 'pg/mL', 'нг/л'] },
  { code: 'LACTATE', names: ['лактат', 'молочная кислота', 'Lactate', 'Lactic acid'], unitPatterns: ['ммоль/л', 'mmol/L', 'мг/дл'] },
  { code: 'AMMONIA', names: ['аммиак', 'Ammonia', 'NH3', 'азот аммонийный'], unitPatterns: ['мкмоль/л', 'umol/L', 'мг/дл'] },
  { code: 'IGFBP3', names: ['ИФР-СБ3', 'IGFBP-3', 'IGFBP3', 'инсулиноподобный фактор связывающий 3'], unitPatterns: ['мг/л', 'mg/L', 'нг/мл'] },
  { code: 'CHOLINESTERASE', names: ['холинэстераза', 'Cholinesterase', 'ХЭ', 'псевдохолинэстераза'], unitPatterns: ['Е/л', 'U/L', 'МЕ/л'] },
  { code: 'OSMOLALITY', names: ['осмоляльность', 'Osmolality', 'осмолярность'], unitPatterns: ['мОсм/кг', 'mOsm/kg', 'мОсм/л'] },
  { code: 'ANION_GAP', names: ['анионный провал', 'анионная разница', 'Anion gap', 'AnionGap'], unitPatterns: ['ммоль/л', 'mmol/L'] },
  { code: 'URINE_PH', names: ['pH мочи', 'урин pH', 'моча pH', 'urine pH'], unitPatterns: [''] },
  { code: 'URINE_OSM', names: ['осмоляльность мочи', 'моча осмоляльность', 'urine osmolality', 'моча osm'], unitPatterns: ['мОсм/кг', 'mOsm/kg'] },
  { code: 'MAR_TEST', names: ['MAR-тест', 'MAR тест', 'MAR test', 'антиспермальные антитела'], unitPatterns: ['%'] },
  { code: 'DFI', names: ['фрагментация ДНК', 'DFI', 'DNA fragmentation index', 'фрагмент. ДНК'], unitPatterns: ['%'] },
  { code: 'HDS', names: ['HDS', 'незрелый хроматин', 'high DNA stainability'], unitPatterns: ['%'] },
  // ── 12 маркёров из BIOMARKER_DICTIONARY, не распознававшихся PDF-парсером ──
  { code: 'CK_18', names: ['цитокератин-18', 'ЦК-18', 'CK-18', 'CK18', 'Cytokeratin 18', 'KRT18'], unitPatterns: ['Е/л', 'U/L', 'нг/мл'] },
  { code: 'GLDH', names: ['глутаматдегидрогеназа', 'ГЛДГ', 'GLDH', 'Glutamate dehydrogenase'], unitPatterns: ['Е/л', 'U/L'] },
  { code: 'ADMA', names: ['АДМА', 'асимметричный диметиларгинин', 'ADMA', 'Asymmetric dimethylarginine'], unitPatterns: ['мкмоль/л', 'umol/L', 'нмоль/л'] },
  { code: 'OXLDL', names: ['окисленные ЛПНП', 'окс. ЛПНП', 'oxLDL', 'oxidized LDL', 'ОЛПНП'], unitPatterns: ['Е/л', 'U/L', 'мг/дл'] },
  { code: 'CORTISOL_NIGHT', names: ['кортизол ночной', 'кортизол вечер', 'ночной кортизол', 'cortisol night', 'cortisol evening'], unitPatterns: ['нмоль/л', 'nmol/L', 'мкг/дл'] },
  { code: 'HVA', names: ['гомованилиновая кислота', 'ГВК', 'HVA', 'Homovanillic acid'], unitPatterns: ['мг/сут', 'mg/24h', 'ммоль/сут'] },
  { code: 'MANGANESE', names: ['марганец', 'Mn', 'Manganese'], unitPatterns: ['мкмоль/л', 'umol/L', 'мкг/л', 'нмоль/л'] },
  { code: 'IODINE', names: ['йод', 'Iodine', 'I2'], unitPatterns: ['мкг/л', 'ug/L', 'мкг/дл', 'нмоль/л'] },
  { code: 'CHROMIUM', names: ['хром', 'Cr', 'Chromium'], unitPatterns: ['нмоль/л', 'nmol/L', 'мкг/л', 'ug/L'] },
  { code: 'CTX', names: ['C-телопептид', 'CTX', 'CrossLaps', 'b-CrossLaps', 'с-телопептид'], unitPatterns: ['нг/мл', 'ng/mL', 'нмоль/л'] },
  { code: 'COMP', names: ['COMP', 'олигомерный матриксный белок', 'Cartilage oligomeric matrix protein', 'хрящевой матриксный белок'], unitPatterns: ['Е/л', 'U/L', 'нг/мл'] },
  { code: 'P1NP', names: ['P1NP', 'пропептид проколлагена', 'N-терминальный пропептид', 'Procollagen type 1 N-peptide'], unitPatterns: ['нг/мл', 'ng/mL', 'мкг/л'] },
  // ══════════════════════════════════════════════════════════════════════
  //  ОБЩИЙ АНАЛИЗ МОЧИ (ОАМ) — количественные маркёры
  // ══════════════════════════════════════════════════════════════════════
  { code: 'URINE_SG', names: ['относительная плотность мочи', 'удельная плотность мочи', 'SG мочи', 'отн. плотность мочи', 'уд. вес мочи', 'specific gravity', 'отн плотность'], unitPatterns: ['г/см3', 'г/мл', 'кг/л', ''] },
  { code: 'URINE_LEU', names: ['лейкоциты мочи', 'лейкоциты в моче', 'Leu urine', 'urine leukocytes', 'лейк мочи'], unitPatterns: ['кл/мкл', 'cells/uL', 'в п/з', 'клеток/мкл', '10^6/л'] },
  { code: 'URINE_ERY', names: ['эритроциты мочи', 'эритроциты в моче', 'Ery urine', 'urine erythrocytes', 'эритр мочи'], unitPatterns: ['кл/мкл', 'cells/uL', 'в п/з', 'клеток/мкл', '10^6/л'] },
  { code: 'URINE_EPITHELIAL', names: ['эпителий мочи', 'эпителиальные клетки мочи', 'эпителий в моче', 'urine epithelial', 'epithelial cells urine'], unitPatterns: ['кл/мкл', 'cells/uL', 'в п/з', 'клеток/мкл'] },
  { code: 'URINE_CYLINDERS', names: ['цилиндры мочи', 'цилиндры в моче', 'гиалиновые цилиндры', 'urine casts', 'cylinders urine'], unitPatterns: ['кл/мкл', 'cells/uL', 'в п/з'] },
  { code: 'URINE_GLUCOSE_Q', names: ['глюкоза мочи колич', 'глюкоза в моче колич', 'urine glucose quant', 'сахар мочи колич'], unitPatterns: ['ммоль/л', 'mmol/L', 'г/л', 'мг/дл'] },
  { code: 'URINE_KETONES_Q', names: ['кетоны мочи колич', 'кетоновые тела в моче колич', 'urine ketones quant', 'ketone bodies urine'], unitPatterns: ['ммоль/л', 'mmol/L', 'мг/л', 'мг/дл'] },
  { code: 'PROTEIN_24H', names: ['суточная протеинурия', 'белок суточный', 'protein 24h', 'белок за сутки', 'суточный белок мочи'], unitPatterns: ['мг/сут', 'mg/24h', 'г/сут', 'мг/24ч'] },
  { code: 'CREATININE_URINE', names: ['креатинин мочи', 'креатинин в моче', 'urine creatinine', 'креатинин суточный', 'креатинин суточная моча'], unitPatterns: ['ммоль/л', 'mmol/L', 'ммоль/сут', 'мг/дл'] },
  { code: 'URINE_VOLUME_24H', names: ['суточный диурез', 'объём мочи за сутки', 'объем мочи суточный', 'urine volume 24h', 'диурез суточный'], unitPatterns: ['мл/сут', 'mL/24h', 'мл', 'л/сут'] },
  { code: 'UROBILINOGEN', names: ['уробилиноген', 'urobilinogen', 'уробилин', 'уробилиноген мочи'], unitPatterns: ['мг/л', 'mg/L', 'мкмоль/л', 'umol/L', 'Ед/л'] },
  { code: 'URINE_NITRITE_Q', names: ['нитриты мочи колич', 'нитриты в моче колич', 'urine nitrite quant', 'nitrite urine'], unitPatterns: ['мг/л', 'mg/L', 'ммоль/л', 'мкмоль/л'] },
  { code: 'URINE_BILIRUBIN_Q', names: ['билирубин мочи колич', 'билирубин в моче колич', 'urine bilirubin quant'], unitPatterns: ['мкмоль/л', 'umol/L', 'мг/л'] },
  { code: 'NECHIP_LEU', names: ['лейкоциты нечипоренко', 'нечипоренко лейкоциты', 'nechiporenko leukocytes', 'лейк по Нечипоренко', 'Нечипоренко Leu'], unitPatterns: ['кл/мл', 'cells/mL', 'клеток/мл', '10^6/л'] },
  { code: 'NECHIP_ERY', names: ['эритроциты нечипоренко', 'нечипоренко эритроциты', 'nechiporenko erythrocytes', 'эритр по Нечипоренко', 'Нечипоренко Ery'], unitPatterns: ['кл/мл', 'cells/mL', 'клеток/мл', '10^6/л'] },
  { code: 'NECHIP_CYL', names: ['цилиндры нечипоренко', 'нечипоренко цилиндры', 'nechiporenko casts', 'цил по Нечипоренко', 'Нечипоренко Cyl'], unitPatterns: ['кл/мл', 'cells/mL', 'клеток/мл'] },
  { code: 'URINE_CALCIUM', names: ['кальций мочи', 'кальций в моче суточный', 'urine calcium', 'суточный кальций мочи', 'Ca мочи'], unitPatterns: ['ммоль/сут', 'mmol/24h', 'мг/сут', 'ммоль/л'] },
  { code: 'URINE_OXALATE', names: ['оксалаты мочи', 'оксалаты в моче', 'urine oxalate', 'щавелевая кислота мочи', 'оксалат-ионы'], unitPatterns: ['ммоль/сут', 'mmol/24h', 'мг/сут', 'мкмоль/сут'] },
  { code: 'URINE_URATE', names: ['ураты мочи', 'ураты в моче суточные', 'urine urate', 'мочевая кислота мочи', 'урат-ионы мочи'], unitPatterns: ['ммоль/сут', 'mmol/24h', 'мг/сут', 'ммоль/л'] },
  // ══════════════════════════════════════════════════════════════════════
  //  ПОЛУКОЛИЧЕСТВЕННЫЕ МАРКЁРЫ ОАМ (распознаются через качественные знаки)
  // ══════════════════════════════════════════════════════════════════════
  { code: 'URINE_PROTEIN_QR', names: ['белок мочи (кач)', 'белок в моче (кач)', 'белок мочи кач', 'protein urine qual', 'белок мочи тест-полоска'], unitPatterns: ['', 'score'] },
  { code: 'URINE_GLUCOSE_QR', names: ['глюкоза мочи (кач)', 'сахар мочи (кач)', 'глюкоза мочи кач', 'glucose urine qual', 'тест-полоска глюкоза'], unitPatterns: ['', 'score'] },
  { code: 'URINE_KETONES_QR', names: ['кетоны мочи (кач)', 'кетоновые тела мочи (кач)', 'кетоны мочи кач', 'ketones urine qual'], unitPatterns: ['', 'score'] },
  { code: 'URINE_BILIRUBIN_QR', names: ['билирубин мочи (кач)', 'bilirubin urine qual', 'билирубин мочи кач'], unitPatterns: ['', 'score'] },
  { code: 'UROBILINOGEN_QR', names: ['уробилиноген (кач)', 'urobilinogen qual', 'уробилиноген кач'], unitPatterns: ['', 'score'] },
  { code: 'URINE_NITRITE_QR', names: ['нитриты мочи (кач)', 'nitrite urine qual', 'нитриты мочи кач'], unitPatterns: ['', 'score'] },
  { code: 'URINE_LEU_QR', names: ['лейкоциты мочи (кач)', 'leu urine qual', 'лейкоциты мочи кач', 'тест-полоска лейкоциты'], unitPatterns: ['', 'score'] },
  { code: 'URINE_BLOOD_QR', names: ['кровь мочи (кач)', 'blood urine qual', 'кровь в моче (кач)', 'эритроциты кач мочи', 'скрытая кровь мочи'], unitPatterns: ['', 'score'] },
];

function containsLabName(text: string, name: string): boolean {
  const needle = name.toLowerCase();
  if (needle.length > 3) return text.toLowerCase().includes(needle);
  return new RegExp(`(^|[^a-zа-яё0-9])${needle.replace(/[+]/g, '\\$&')}(?=$|[^a-zа-яё0-9])`, 'i').test(text);
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    // Remove strikethrough artifacts: word ending with ~ or - (Tesseract reads struck text as "word~" or "word-")
    // Only match when the strike character is followed by whitespace, punctuation, or end of string.
    // This avoids removing parts of reference ranges like "62-106".
    .replace(/\b\w+[~-]+(?=\s|[.,;!?]|$)/g, '')
    .replace(/(\d)[,](\d)/g, '$1.$2')
    // Tesseract occasionally reads zero as Cyrillic O inside numeric cells.
    .replace(/(?<=\d)[ОO](?=\d|[.,])/g, '0')
    .replace(/(?<=\d)[ОO](?=\s|$)/g, '0')
    .replace(/\b(мкмоль|ммоль|мг|нг|пг|мкг)\s*\/\s*(л|мл|дл)\b/gi, '$1/$2')
    // Keep tabs: PDF text extraction uses them as reliable column separators.
    .replace(/ {2,}/g, ' ')
    .trim();
}

function extractNumber(text: string): number | null {
  // Try to find the first standalone number that looks like a lab value (not part of a range)
  const allNums = text.match(/[\d]+[.,]?[\d]*/g);
  if (!allNums) return null;
  // Filter: skip numbers that appear in ANY reference range (not just the first).
  // OCR often duplicates ranges, and treating range bounds as values is the
  // main source of misidentified markers.
  const rangeNums = new Set<string>();
  const rangeMatches = text.matchAll(/(\d+[.,]?\d*)\s*[-–]\s*(\d+[.,]?\d*)/g);
  for (const m of rangeMatches) {
    rangeNums.add(m[1]);
    rangeNums.add(m[2]);
  }
  for (const n of allNums) {
    if (rangeNums.has(n)) continue;
    // Skip if it looks like a year, phone number, etc.
    const clean = n.replace(',', '.');
    const val = parseFloat(clean);
    if (isNaN(val) || val <= 0) continue;
    return val;
  }
  // All numbers are part of a range — not a value column
  return null;
}

/**
 * Вариант extractNumber, разрешающий 0 как валидное значение.
 * Используется для urine-маркёров, где 0 = норма (отсутствие клеток/вещества):
 * URINE_LEU, URINE_ERY, URINE_EPITHELIAL, URINE_CYLINDERS, URINE_NITRITE_Q, и т.д.
 *
 * В отличие от extractNumber, distinguifies "0" как значение от "0" как part of range:
 * "0   0-2" → первый "0" это значение, второй "0" — начало диапазона.
 */
function extractNumberAllowZero(text: string): number | null {
  // Standalone number: не preceded by "-" и не followed by "-" (не part of range).
  // JS поддерживает variable-length lookbehind в современных движках (Node 16+).
  const standalone = text.match(/(?<![-–]\s?)\b\d+(?:[.,]\d+)?\b(?!\s*[-–])/g);
  if (!standalone) return null;
  for (const n of standalone) {
    const clean = n.replace(',', '.');
    const val = parseFloat(clean);
    if (isNaN(val) || val < 0) continue;
    return val;
  }
  return null;
}

/**
 * Полуколичественный парсинг для качественных тестов мочи (ОАМ).
 * Возвращает числовое значение по шкале 0-4, если распознаёт
 * качественные знаки/слова в строке:
 *   neg / отрицательно / нет / "не обн."  → 0
 *   следы / след / trace / traces        → 0.5
 *   +                                     → 1
 *   ++                                    → 2
 *   +++                                   → 3
 *   ++++ / 4+                              → 4
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

function extractResultNumber(text: string): number | null {
  const cleaned = text.replace(/\b(?:от|до|референс|норма|ref)\b/gi, ' ');
  const numbers = cleaned.match(/\d+[.,]?\d*/g) || [];
  // Exclude ALL numbers that appear in ANY reference range, not just the first.
  const rangeNumbers = new Set<string>();
  const rangeMatches = cleaned.matchAll(/(\d+[.,]?\d*)\s*[-–]\s*(\d+[.,]?\d*)/g);
  for (const m of rangeMatches) {
    rangeNumbers.add(m[1]);
    rangeNumbers.add(m[2]);
  }
  for (const token of numbers) {
    if (rangeNumbers.has(token)) continue;
    const value = Number(token.replace(',', '.'));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function extractRefRange(text: string): { low?: number; high?: number } {
  // Handle "<N" and ">N" reference bounds common in Invitro/Gemotest formats
  const ltMatch = text.match(/<\s*(\d+[\.,]?\d*)/);
  const gtMatch = text.match(/>\s*(\d+[\.,]?\d*)/);
  if (ltMatch) {
    const high = parseFloat(ltMatch[1].replace(',', '.'));
    if (Number.isFinite(high) && high > 0 && high < 100000) return { high };
  }
  if (gtMatch) {
    const low = parseFloat(gtMatch[1].replace(',', '.'));
    if (Number.isFinite(low) && low >= 0 && low < 100000) return { low };
  }
  const patterns = [
    /(?:ref|референс|норма|от|до)\s*[:\-]?\s*(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/i,
    /(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s*(?:единиц|ед\.?|unit|u\/l|mmol|umol|mg|ng|pg|g|мг\/дл|мкмоль|ммоль|нг\/мл|пг\/мл|г\/л|%|сек)/i,
    /(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)(?=[^0-9.,]|$)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (p === patterns[2]) {
        const rangeMatch = text.match(/(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/);
        if (rangeMatch && rangeMatch[0] === m[0]) {
          const low = parseFloat(m[1].replace(',', '.'));
          const high = parseFloat(m[2].replace(',', '.'));
          if (!isNaN(low) && !isNaN(high) && low < high && low > 0 && high < 100000) {
            return { low, high };
          }
        }
        continue;
      }
      const low = parseFloat(m[1].replace(',', '.'));
      const high = parseFloat(m[2].replace(',', '.'));
      if (!isNaN(low) && !isNaN(high) && low < high && low > 0 && high < 100000) {
        return { low, high };
      }
    }
  }
  return {};
}

function extractUnit(text: string): string {
  // Match lab units in both Russian and English forms. Include common OCR
  // variants: spaces inside units (мк моль/л), missing slash (ммоль л),
  // and abbreviated prefixes (мЕд, мМЕ).
  const match = text.match(/(?:мк\s*моль|ммоль|моль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|МЕ|ЕД|Е|ед|г|мл|л)\s*\/\s*(?:дл|мл|л)|(?:umol|mmol|nmol|pmol|mg|ng|pg|ug|mIU|MIU|IU|U|g)\s*\/\s*(?:dL|mL|L)|%|сек|s\b|\/сут|\/24\s*ч|meq\/l|ммоль\/моль/i);
  return match?.[0].replace(/\s+/g, '') || '';
}

function isUnitCell(text: string): boolean {
  return /^(?:%|сек|s|(?:мк\s*моль|ммоль|моль|мг|нг|пг|мкг|м\s*[ЕEеe]д|мМЕ|Е|ед|г|мл|л)\s*\/\s*(?:дл|мл|л)|(?:umol|mmol|nmol|pmol|mg|ng|pg|ug|mIU|IU|U|g)\s*\/\s*(?:dL|mL|L))$/i.test(text.trim());
}

function candidateScore(value: ParsedLabValue): number {
  let score = 0;
  if (value.unit) score += 2;
  if (value.refLow !== undefined || value.refHigh !== undefined) score += 4;
  if (value.raw && /[А-Яа-яA-Za-z]/.test(value.raw)) score += 1;
  if (value.raw && /\d/.test(value.raw)) score += 1;
  return Math.max(0, Math.min(1, score / 8));
}

const PROVIDER_HEADERS: Record<string, string[]> = {
  invitro: ['наименование', 'результат', 'референс', 'единицы'],
  gemotest: ['наименование', 'результат', 'референс', 'ед'],
  kdl: ['наименование', 'результат', 'референс', 'единицы'],
  helix: ['показатель', 'результат', 'референс', 'единицы'],
};

function detectProviderFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('gemotest')) return 'gemotest';
  if (lower.includes('инвитро') || lower.includes('invitro')) return 'invitro';
  if (lower.includes('helix') || lower.includes('хеликс')) return 'helix';
  if (lower.includes('kdl') || lower.includes('кдл')) return 'kdl';
  return null;
}

interface TextItem { str: string; x: number; y: number; width: number; height: number; }

async function openPdfDocument(pdfjsLib: any, data: ArrayBuffer): Promise<any> {
  try {
    return await pdfjsLib.getDocument({ data }).promise;
  } catch (workerError) {
    // Some WebViews and Telegram Mini App environments cannot load the CDN
    // worker. PDF.js can still extract/render pages in its main thread.
    console.warn('PDF.js worker failed, retrying without worker:', workerError);
    return pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  }
}

function enhanceOcrCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  // Convert to grayscale with strong contrast boost for faint lab text.
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
    const val = gray < 160 ? Math.max(0, contrast - 20) : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function detectWatermarkText(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const watermarks: string[] = [];
  for (const line of lines) {
    const ratio = (line.match(/[a-zA-Zа-яА-ЯёЁ]/g) || []).length / Math.max(1, line.length);
    if (line.length < 15 && ratio > 0.8 && /[a-zA-Zа-яА-ЯёЁ]{3,}/.test(line)) {
      watermarks.push(line);
    }
  }
  return watermarks;
}

async function recognizeOcrCanvas(Tesseract: any, canvas: HTMLCanvasElement): Promise<string> {
  const enhanced = enhanceOcrCanvas(canvas);
  const { resolveTesseractOptions } = await import('./ocr-assets');
  const opts = await resolveTesseractOptions();
  try {
    const worker = await Tesseract.createWorker('rus+eng', 1, {
      workerPath: opts.workerPath,
      corePath: opts.corePath,
      langPath: opts.langPath,
    });
    try {
      const { data } = await worker.recognize(enhanced);
      return data.text || '';
    } finally {
      await worker.terminate();
    }
  } catch (firstError: any) {
    console.warn('Russian OCR failed (local assets), retrying in English:', firstError);
    try {
      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath: opts.workerPath,
        corePath: opts.corePath,
        langPath: opts.langPath,
      });
      try {
        const { data } = await worker.recognize(enhanced);
        return data.text || '';
      } finally {
        await worker.terminate();
      }
    } catch (secondError: any) {
      console.warn('English OCR also failed, returning empty text:', secondError);
      return '';
    }
  }
}

function groupByRows(items: TextItem[], yTolerance = 5): TextItem[][] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > yTolerance) return dy;
    return a.x - b.x;
  });
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (Math.abs(curr.y - prev.y) <= yTolerance) {
      currentRow.push(curr);
    } else {
      rows.push(currentRow);
      currentRow = [curr];
    }
  }
  if (currentRow.length) rows.push(currentRow);
  return rows;
}

function rowToString(items: TextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let result = '';
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (i === 0) {
      result += item.str;
    } else {
      const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
      if (Math.abs(item.x - (sorted[i - 1].x + sorted[i - 1].width)) < 3) {
        result += item.str;
      } else if (gap > 5) {
        result += '\t' + item.str;
      } else {
        result += ' ' + item.str;
      }
    }
  }
  return result;
}

function tryParseTableRows(lines: string[], provider: string | null): ParsedLabValue[] {
  const values: ParsedLabValue[] = [];

  // Try tab → 3+ spaces → single space as fallback
  const hasTab = lines.some(l => l.includes('\t'));
  const hasTripleSpace = lines.some(l => /\s{3,}/.test(l));

  const colDelim: string | RegExp = hasTab ? '\t' : (hasTripleSpace ? /\s{3,}/ : /\s+/);

  for (const line of lines) {
    let cols = typeof colDelim === 'string'
      ? line.split(colDelim).map(c => c.trim()).filter(Boolean)
      : line.split(colDelim).map(c => c.trim()).filter(Boolean);

    // Single-space fallback: if we have 4+ words and at least 2 look numeric, use them
    if (!hasTab && !hasTripleSpace && cols.length < 3) {
      const spaceSplit = line.split(/\s+/).map(c => c.trim()).filter(Boolean);
      const numCount = spaceSplit.filter(s => /^[\d,.]+$/.test(s)).length;
      if (spaceSplit.length >= 3 && numCount >= 1) cols = spaceSplit;
    }

    if (cols.length < 2) continue;

    const combined = cols.join(' | ').toLowerCase();

    // Longest-name match: выбираем наиболее специфичный паттерн (длиннейший
    // matching name), чтобы "креатинин мочи" попадал в CREATININE_URINE, а не CREAT.
    let bestLabDef: typeof LAB_PATTERNS[number] | null = null;
    let bestNameLen = 0;
    for (const labDef of LAB_PATTERNS) {
      for (const n of labDef.names) {
        if (containsLabName(combined, n) && n.length > bestNameLen) {
          bestNameLen = n.length;
          bestLabDef = labDef;
        }
      }
    }
    if (!bestLabDef) continue;
    const labDef = bestLabDef;

    {
      let val: number | null = null;
      let unit = '';
      let refLow: number | undefined;
      let refHigh: number | undefined;

      for (let ci = 0; ci < cols.length; ci++) {
        const cell = cols[ci];
        const isNameCell = labDef.names.some(name => containsLabName(cell, name));
        // Extract reference range from any cell that has a range pattern
        const ref = extractRefRange(cell);
        if (ref.low !== undefined || ref.high !== undefined) {
          refLow = ref.low;
          refHigh = ref.high;
        }
        // Names such as 25(OH)D, T3, T4 and HbA1c contain digits which are
        // not the measured result. Never use the marker/name cell as value.
        const num = isNameCell ? null : extractResultNumber(cell);
        if (num !== null && num > 0 && cell.length < 80) {
          if (val === null) {
            val = num;
          }
        }
        // Полуколичественный fallback для качественных тестов ОАМ
        if (val === null && !isNameCell && labDef.code.endsWith('_QR')) {
          const q = extractQualitativeScore(cell);
          if (q !== null) val = q;
        }
        const cellUnit = extractUnit(cell) || (isUnitCell(cell) ? cell : '');
        if (cellUnit && !unit) unit = cellUnit;
      }

      // Полуколичественный fallback из всей строки, если ячейки не дали значение
      if (val === null && labDef.code.endsWith('_QR')) {
        const q = extractQualitativeScore(line);
        if (q !== null) val = q;
      }
      // Для urine-маркёров где 0 — норма, разрешаем 0
      if (val === null && /^URINE_(LEU|ERY|EPITHELIAL|CYLINDERS|NITRITE_Q|BILIRUBIN_Q|KETONES_Q|GLUCOSE_Q|OSM)/.test(labDef.code)) {
        const q = extractNumberAllowZero(line);
        if (q !== null) val = q;
      }

      if (val === null) continue;
      if (val > 100000) continue;

      values.push({
        code: labDef.code,
        name: labDef.names[0],
        value: val,
        unit: unit || labDef.unitPatterns[0],
        refLow,
        refHigh,
        isAbnormal: refHigh !== undefined ? val > refHigh : refLow !== undefined ? val < refLow : undefined,
        raw: line,
        confidence: candidateScore({ code: labDef.code, name: labDef.names[0], value: val, unit: unit || labDef.unitPatterns[0], refLow, refHigh, raw: line }),
      });
    }
  }

  return values;
}

function providerSpecificParse(lines: string[], provider: string): ParsedLabValue[] {
  const headers = PROVIDER_HEADERS[provider];
  if (!headers) return [];

  const headerLineIdx = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return headers.every(h => lower.includes(h));
  });

  const dataLines = headerLineIdx >= 0
    ? lines.slice(headerLineIdx + 1).filter(l => l.trim().length > 0)
    : lines;

  return tryParseTableRows(dataLines, provider);
}

function parseLabLineGeneric(line: string, val: number): { unit: string; refLow?: number; refHigh?: number } {
  // Try to extract unit from the line
  let unit = '';
  unit = extractUnit(line);
  
  const ref = extractRefRange(line);

  // If no explicit ref range, try to match typical reference pattern from UCUM_MAP
  if (ref.low === undefined || ref.high === undefined) {
    // The ref range might be on the same line after the value
    const refMatch = line.match(/(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)/);
    if (refMatch) {
      const rl = parseFloat(refMatch[1].replace(',', '.'));
      const rh = parseFloat(refMatch[2].replace(',', '.'));
      if (!isNaN(rl) && !isNaN(rh)) {
        if (ref.low === undefined) ref.low = rl;
        if (ref.high === undefined) ref.high = rh;
      }
    }
  }

  return { unit, refLow: ref.low, refHigh: ref.high };
}

function tryParseLabFromLine(line: string): { code: string; name: string; value: number; unit: string; refLow?: number; refHigh?: number; raw?: string; confidence?: number } | null {
  const lowerLine = line.toLowerCase();

  // Выбираем наиболее специфичный паттерн (с самым длинным matching name),
  // чтобы "креатинин мочи" попадал в CREATININE_URINE, а не в общий CREAT.
  let best: { labDef: typeof LAB_PATTERNS[number]; nameMatchText: string; nameLen: number } | null = null;
  for (const labDef of LAB_PATTERNS) {
    for (const n of labDef.names) {
      if (containsLabName(lowerLine, n)) {
        if (!best || n.length > best.nameLen) {
          best = { labDef, nameMatchText: n, nameLen: n.length };
        }
      }
    }
  }
  if (!best) return null;
  const labDef = best.labDef;
  const nameMatchText = best.nameMatchText;

  const valueText = nameMatchText
    ? line.replace(new RegExp(nameMatchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ')
    : line;
    // Try extractNumber first (filters out ALL range numbers). If it fails
    // (all numbers were in ranges), try extractResultNumber as fallback —
    // it has the same logic but can catch edge cases where the value is
    // adjacent to a range without a clear separator.
    let val = extractNumber(valueText.replace(/[^\d.,\s\-–]/g, ' '));
    if (val === null) {
      val = extractResultNumber(valueText);
    }
    // When the marker name contains digits (e.g. "Витамин D 25-OH"), the
    // generic sanitize→extractNumber path may pick the name-suffix number
    // instead of the actual result column. For tab-separated lines, scan
    // individual cells to find the first non-name numeric value.
    // Also runs when val is null because all numbers were filtered as range
    // bounds (e.g. value == upper bound of reference range).
    if (line.includes('\t')) {
      const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
      let cellVal: number | null = null;
      for (const cell of cols) {
        if (labDef.names.some(n => containsLabName(cell, n))) continue;
        const cellNum = extractResultNumber(cell);
        if (cellNum !== null && cellNum > 0) { cellVal = cellNum; break; }
      }
      // Prefer cell-based value when the generic path picked a name-suffix number
      if (val === null) { val = cellVal; }
      else if (cellVal !== null && val !== cellVal) { val = cellVal; }
    }
    // Для urine-маркёров где 0 — норма (отсутствие клеток/вещества),
    // разрешаем 0 как валидное значение.
    if (val === null && /^URINE_(LEU|ERY|EPITHELIAL|CYLINDERS|NITRITE_Q|BILIRUBIN_Q|KETONES_Q|GLUCOSE_Q|OSM)/.test(labDef.code)) {
      val = extractNumberAllowZero(valueText.replace(/[^\d.,\s\-–]/g, ' '));
    }
    // Полуколичественный fallback для качественных тестов мочи (ОАМ).
    // Если число не найдено, но маркер в списке QR-кодов и строка содержит
    // качественные знаки (neg/отрицательно/следы/+/++/+++/++++), парсим их.
    if (val === null && labDef.code.endsWith('_QR')) {
      const q = extractQualitativeScore(line);
      if (q !== null) val = q;
    }
    if (val === null || val > 100000) return null;

  const parsed = parseLabLineGeneric(line, val);
  return {
    code: labDef.code,
    name: labDef.names[0],
    value: val,
    unit: parsed.unit || labDef.unitPatterns[0],
    refLow: parsed.refLow,
    refHigh: parsed.refHigh,
    raw: line,
    confidence: candidateScore({ code: labDef.code, name: labDef.names[0], value: val, unit: parsed.unit || labDef.unitPatterns[0], refLow: parsed.refLow, refHigh: parsed.refHigh, raw: line }),
  };
}

export function parseLabText(rawText: string): ParsedLabResult {
  const originalText = rawText;
  const normalizedText = normalizeOcrText(rawText);
  const provider = detectProviderFromText(normalizedText);

  const lines = normalizedText.split(/\n/).map(l => l.trim()).filter(Boolean);

  let values: ParsedLabValue[] = [];

  // Watermark detection: filter out short all-alpha lines (common Tesseract watermark artifacts)
  const watermarkLines = detectWatermarkText(normalizedText);

  if (provider && values.length === 0) {
    values = providerSpecificParse(lines, provider);
  }

  // Always run the generic parser as a second pass. Provider PDFs often
  // contain mixed rows where only part of the table was split correctly.
  for (const line of lines) {
    const result = tryParseLabFromLine(line);
    if (!result || values.some(v => v.code === result.code)) continue;
    values.push({
      ...result,
      isAbnormal: result.refHigh !== undefined ? result.value > result.refHigh : result.refLow !== undefined ? result.value < result.refLow : undefined,
      confidence: candidateScore(result),
    });
  }

  if (values.length > 0 || lines.length > 1) {
    // Try combined adjacent lines for codes not yet matched.
    // Use a sliding window of 2, then 3 lines to catch markers whose name,
    // value, and unit were split across multiple lines by OCR or PDF column
    // extraction.
    for (let windowSize = 2; windowSize <= 3; windowSize++) {
      for (let i = 0; i <= lines.length - windowSize; i++) {
        const combined = lines.slice(i, i + windowSize).join(' ');
        const result = tryParseLabFromLine(combined);
        if (!result) continue;
        if (values.some(v => v.code === result.code)) continue;
        values.push({
          ...result,
          isAbnormal: result.refHigh !== undefined ? result.value > result.refHigh : result.refLow !== undefined ? result.value < result.refLow : undefined,
          confidence: candidateScore(result),
        });
      }
    }
  }

  const dateMatch = normalizedText.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  let date: string | undefined;
  if (dateMatch) {
    const d = dateMatch[1].padStart(2, '0');
    const m = dateMatch[2].padStart(2, '0');
    const y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
    date = `${y}-${m}-${d}`;
  }

  const warnings: string[] = [];
  if (watermarkLines.length > 0) {
    warnings.push(`Обнаружены возможные водяные знаки (${watermarkLines.length} строк). Они исключены из результатов.`);
  }

  return { values, rawText: normalizedText, originalText, source: 'text', date, warnings };
}

export async function parsePDF(fileOrBuffer: File | ArrayBuffer): Promise<ParsedLabResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    const { resolvePdfjsWorkerSrc } = await import('./ocr-assets');
    pdfjsLib.GlobalWorkerOptions.workerSrc = (await resolvePdfjsWorkerSrc()).workerSrc;
    const arrayBuffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const pdf = await openPdfDocument(pdfjsLib, arrayBuffer);
    let fullText = '';
    let allItems: TextItem[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items: TextItem[] = content.items.map((item: any) => ({
        str: item.str || '',
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
        width: item.width ?? 0,
        height: item.height ?? 0,
      })).filter((it: TextItem) => it.str.trim().length > 0);
      allItems.push(...items);

      const rows = groupByRows(items);
      for (const row of rows) {
        fullText += rowToString(row) + '\n';
      }
    }
    const result = parseLabText(fullText);
    // Row grouping may lose columns in PDFs with unusual coordinate layouts.
    // Always parse the raw item stream and use it only to fill missing markers.
    const rawText = allItems.map(it => it.str).join(' ');
    const rawResult = rawText.length > 20 ? parseLabText(rawText) : null;
    if (rawResult) {
      const valuesByCode = new Map<string, ParsedLabValue>();
      for (const value of [...result.values, ...rawResult.values]) {
        const current = valuesByCode.get(value.code);
        if (!current || candidateScore(value) > candidateScore(current)) {
          valuesByCode.set(value.code, value);
        }
      }
      result.values = [...valuesByCode.values()];
    }
    if (result.values.length === 0 && fullText.length > 50) {
      if (rawResult?.values.length) {
        rawResult.warnings = ['Предупреждение: PDF распознан в сыром режиме (таблица не разобрана).'];
        return rawResult;
      }
      result.warnings = ['Предупреждение: PDF распознан, но показатели не найдены. Попробуйте ввести данные вручную.'];
    }
    return result;
  } catch (err: any) {
    return { values: [], rawText: err?.message || String(err), source: 'pdf', warnings: ['Ошибка PDF parsing. Используйте вручную.'] };
  }
}

/** OCR pages of a scanned PDF that has no usable text layer. */
export async function ocrScannedPdf(fileOrBuffer: File | ArrayBuffer): Promise<string> {
  let pdfjsLib: any;
  let Tesseract: any;
  try {
    pdfjsLib = await import('pdfjs-dist');
    Tesseract = await import('tesseract.js') as any;
  } catch (initError: any) {
    console.error('ocrScannedPdf init failed:', initError);
    return '';
  }
  try {
    const { resolvePdfjsWorkerSrc } = await import('./ocr-assets');
    const workerSrc = (await resolvePdfjsWorkerSrc()).workerSrc;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    const arrayBuffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const pdf = await openPdfDocument(pdfjsLib, arrayBuffer);
    const MAX_PAGE_PX = 8000000;
    const texts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const vp = page.getViewport({ scale: 1 });
      const srcPx = vp.width * vp.height * 4; // 2x scale → 4x pixels
      const effectiveScale = srcPx > MAX_PAGE_PX ? Math.sqrt(MAX_PAGE_PX / (vp.width * vp.height)) : 2;
      const viewport = page.getViewport({ scale: effectiveScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) continue;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const text = await recognizeOcrCanvas(Tesseract, canvas);
      if (text) texts.push(text);
    }
    return texts.join('\n');
  } catch (err: any) {
    console.warn('ocrScannedPdf failed:', err);
    return '';
  }
}

export async function parseLabFile(file: File, arrayBuffer?: ArrayBuffer): Promise<ParsedLabResult> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return parsePDF(arrayBuffer ?? file);
  }
  if (file.type.startsWith('image/') || file.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
    const text = await extractTextFromImage(file);
    return parseLabText(text);
  }
  const text = await file.text();
  return parseLabText(text);
}

async function extractTextFromImage(file: File): Promise<string> {
  let Tesseract: any;
  let workerOptions: { workerPath: string; corePath: string; langPath: string };
  try {
    Tesseract = await import('tesseract.js') as any;
    const { resolveTesseractOptions } = await import('./ocr-assets');
    const opts = await resolveTesseractOptions();
    workerOptions = {
      workerPath: opts.workerPath,
      corePath: opts.corePath,
      langPath: opts.langPath,
    };
  } catch (initError: any) {
    console.error('Tesseract.js init failed:', initError);
    throw new Error(`OCR engine unavailable: ${initError?.message || String(initError)}`);
  }
  try {
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap is unavailable');
    const bitmap = await createImageBitmap(file);
    const MAX_CANVAS_PX = 8000000; // ~8MP, safe upper bound for browser memory
    const srcPx = bitmap.width * bitmap.height;
    const scale = Math.min(3, Math.sqrt(MAX_CANVAS_PX / Math.max(1, srcPx)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(bitmap.width * scale);
    canvas.height = Math.ceil(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return ''; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const enhanced = enhanceOcrCanvas(canvas);
    try {
      const worker = await Tesseract.createWorker('rus+eng', 1, workerOptions);
      try {
        const { data } = await worker.recognize(enhanced);
        return data.text || '';
      } finally {
        await worker.terminate();
      }
    } catch (ocrError: any) {
      console.warn('Image OCR (rus+eng) failed, retrying in English only:', ocrError);
      const worker = await Tesseract.createWorker('eng', 1, workerOptions);
      try {
        const { data } = await worker.recognize(enhanced);
        return data.text || '';
      } finally {
        await worker.terminate();
      }
    }
  } catch (imageProcessingError) {
    console.warn('Enhanced image preprocessing failed, using direct OCR:', imageProcessingError);
    try {
      const worker = await Tesseract.createWorker('rus+eng', 1, workerOptions);
      try {
        const { data } = await worker.recognize(file);
        return data.text || '';
      } finally {
        await worker.terminate();
      }
    } catch (directOcrError: any) {
      console.warn('Direct rus+eng OCR failed, retrying in English:', directOcrError);
      try {
        const worker = await Tesseract.createWorker('eng', 1, workerOptions);
        try {
          const { data } = await worker.recognize(file);
          return data.text || '';
        } finally {
          await worker.terminate();
        }
      } catch {
        return '';
      }
    }
  }
}
