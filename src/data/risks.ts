export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Risk {
  id: string;
  name: string;
  system: string;
  organs: string[];
  symptoms: string[];
  levels: RiskLevel[];
  description: string;
}

// Маппинг старых систем на стандартные RISK_SYSTEMS
export const RISK_SYSTEM_MAP: Record<string, string> = {
  metabolic: 'metabolic',
  structural: 'hepatic',
  bile: 'hepatic',
  lab: 'hepatic',
  toxic: 'hepatic',
  infectious: 'hepatic',
  autoimmune: 'hematologic',
  functional: 'renal',
  vascular: 'cardio',
  degenerative: 'musculoskeletal',
  inflammatory: 'musculoskeletal',
  skin: 'hematologic',
  vision: 'neuro',
  hormonal: 'endocrine',
  psychological: 'neuro',
  endo: 'endocrine',
  repro: 'reproductive',
  hem: 'hematologic',
  ms: 'musculoskeletal',
  renal_system: 'renal',
  nervous: 'neuro',
  blood_system: 'blood',
  vessels_system: 'vessels',
};

export const RISKS_DB: Risk[] = [
  // === ПЕЧЕНЬ (hepatic) ===
  { id: "LIVER_FATTY", name: "Жировой гепатоз", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Тяжесть в правом подреберье", "Вздутие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Накопление жира в гепатоцитах" },
  { id: "LIVER_NASH", name: "НАСГ", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Боль в правом подреберье", "Инсулинорезистентность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Неалкогольный стеатогепатит — воспаление на фоне жировой инфильтрации" },
  { id: "LIVER_CIRRHOSIS", name: "Цирроз печени", system: "hepatic", organs: ["Печень"], symptoms: ["Асцит", "Сосудистые звёздочки", "Потеря веса"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Фиброзное замещение паренхимы печени" },
  { id: "LIVER_CHOLESTASIS", name: "Холестаз", system: "hepatic", organs: ["Печень", "Жёлчные протоки"], symptoms: ["Зуд", "Желтуха", "Тёмная моча"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение оттока жёлчи" },
  { id: "LIVER_ENZYMES_HIGH", name: "Повышенные АЛТ/АСТ", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Тошнота", "Дискомфорт в правом подреберье"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Цитолиз гепатоцитов — индикатор гепатотоксичности" },
  { id: "LIVER_DRUG_TOXICITY", name: "Лекарственная гепатотоксичность", system: "hepatic", organs: ["Печень"], symptoms: ["Тошнота", "Рвота", "Желтуха"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение печени препаратами (17α-алкилированные ААС, НПВС)" },
  { id: "LIVER_ALCOHOLIC", name: "Алкогольное поражение печени", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Боль в правом подреберье", "Похмелье"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Сочетание ААС и алкоголя синергично повреждает печень" },
  { id: "LIVER_DETOX_OVERLOAD", name: "Перегрузка детокс-систем", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Головная боль", "Чувствительность к запахам"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение фазы I/II детоксикации печени" },
  { id: "LIVER_BILE_SLUDGE", name: "Застой жёлчи (сладж)", system: "hepatic", organs: ["Печень", "Жёлчный пузырь"], symptoms: ["Тошнота", "Горечь во рту", "Вздутие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Сгущение жёлчи и образование осадка" },
  { id: "LIVER_GALLSTONES", name: "Жёлчнокаменная болезнь", system: "hepatic", organs: ["Жёлчный пузырь"], symptoms: ["Боль в правом подреберье", "Тошнота", "Рвота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Камни в жёлчном пузыре" },
  { id: "LIVER_FIBROSIS", name: "Фиброз печени", system: "hepatic", organs: ["Печень"], symptoms: ["Утомляемость", "Боль в правом подреберье", "Слабость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Фиброзное перерождение печёночной ткани" },

  // === ПОЧКИ (renal) ===
  { id: "KIDNEY_CKD", name: "Хроническая болезнь почек", system: "renal", organs: ["Почки"], symptoms: ["Отёки", "Утомляемость", "Пенистая моча"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Прогрессирующее снижение функции почек" },
  { id: "KIDNEY_STONES", name: "Мочекаменная болезнь", system: "renal", organs: ["Почки"], symptoms: ["Боль в пояснице", "Кровь в моче", "Тошнота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Образование камней в почках" },
  { id: "KIDNEY_INFECTION", name: "Пиелонефрит", system: "renal", organs: ["Почки"], symptoms: ["Лихорадка", "Боль в спине", "Озноб"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Инфекционное воспаление почечной лоханки" },
  { id: "KIDNEY_PROTEINURIA", name: "Протеинурия", system: "renal", organs: ["Почки"], symptoms: ["Пенистая моча", "Отёки", "Утомляемость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Потеря белка с мочой — маркер клубочкового повреждения" },
  { id: "KIDNEY_HYPERTENSION", name: "Почечная гипертензия", system: "renal", organs: ["Почки"], symptoms: ["Высокое АД", "Головная боль", "Никтурия"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение АД вследствие поражения почек" },
  { id: "KIDNEY_DRUG_TOXICITY", name: "Лекарственная нефротоксичность", system: "renal", organs: ["Почки"], symptoms: ["Снижение диуреза", "Отёки", "Тошнота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение почек препаратами" },
  { id: "KIDNEY_DEHYDRATION", name: "Дегидратация", system: "renal", organs: ["Почки"], symptoms: ["Жажда", "Тёмная моча", "Судороги"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Обезвоживание — фактор острого повреждения почек" },
  { id: "KIDNEY_UTI", name: "ИМП (инфекция мочевых путей)", system: "renal", organs: ["Мочевые пути"], symptoms: ["Боль при мочеиспускании", "Частые позывы", "Мутная моча"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Инфекция мочевыводящих путей" },

  // === СЕРДЦЕ И СОСУДЫ (cardio) ===
  { id: "HEART_HYPERTENSION", name: "Артериальная гипертензия", system: "cardio", organs: ["Сердце", "Сосуды"], symptoms: ["Высокое АД", "Головная боль", "Мелькание мушек"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение артериального давления" },
  { id: "HEART_LVH", name: "Гипертрофия левого желудочка", system: "cardio", organs: ["Сердце"], symptoms: ["Одышка", "Боль в груди", "Утомляемость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Утолщение стенок ЛЖ на фоне ААС и гипертензии" },
  { id: "HEART_ATHEROSCLEROSIS", name: "Атеросклероз", system: "cardio", organs: ["Артерии"], symptoms: ["Стенокардия", "Перемежающаяся хромота", "ИБС"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Поражение артерий холестериновыми бляшками" },
  { id: "HEART_ARRHYTHMIA", name: "Аритмия", system: "cardio", organs: ["Сердце"], symptoms: ["Учащённое сердцебиение", "Перебои", "Головокружение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение ритма сердца" },
  { id: "HEART_THROMBOSIS", name: "Тромбоз", system: "cardio", organs: ["Сосуды"], symptoms: ["Боль в конечности", "Отёк", "Одышка (ТЭЛА)"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Образование тромбов вследствие полицитемии" },
  { id: "HEART_EMBOLISM", name: "Лёгочная эмболия", system: "cardio", organs: ["Лёгкие", "Сосуды"], symptoms: ["Одышка", "Боль в груди", "Кашель с кровью"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Тромбоэмболия лёгочной артерии — жизнеугрожающее состояние" },
  { id: "VESSELS_STIFF", name: "Сосудистая ригидность", system: "cardio", organs: ["Сосуды"], symptoms: ["Повышенное АД", "Холодные конечности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Снижение эластичности сосудистой стенки" },

  // === НЕРВНАЯ СИСТЕМА (neuro) ===
  { id: "NEURO_INSOMNIA", name: "Бессонница", system: "neuro", organs: ["ЦНС"], symptoms: ["Нарушение засыпания", "Частые пробуждения", "Утренняя слабость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение сна — частый эффект тренболона и высоких доз тестостерона" },
  { id: "NEURO_AGRESSION", name: "Повышенная агрессия", system: "neuro", organs: ["ЦНС"], symptoms: ["Раздражительность", "Агрессия", "Импульсивность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Дофаминовая дисрегуляция на фоне ААС" },
  { id: "NEURO_ANXIETY", name: "Тревожность", system: "neuro", organs: ["ЦНС"], symptoms: ["Тревога", "Панические атаки", "Внутреннее напряжение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение ГАМК-ергической передачи" },
  { id: "NEURO_DEPRESSION", name: "Депрессия (ПКТ)", system: "neuro", organs: ["ЦНС"], symptoms: ["Подавленность", "Апатия", "Потеря мотивации"], levels: ["LOW", "MEDIUM", "HIGH"], description: "«Гормональная яма» после отмены ААС — низкий дофамин и серотонин" },
  { id: "NEURO_NEUROPATHY", name: "Периферическая нейропатия", system: "neuro", organs: ["Периферические нервы"], symptoms: ["Парестезии", "Онемение", "Жжение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение периферических нервов" },
  { id: "NEURO_BRAIN_FOG", name: "Туман в голове", system: "neuro", organs: ["ЦНС"], symptoms: ["Снижение концентрации", "Ухудшение памяти", "Рассеянность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Когнитивные нарушения на фоне нейротоксичности" },

  // === ЭНДОКРИННАЯ СИСТЕМА (endocrine) ===
  { id: "ENDO_HPG_SUPPRESSION", name: "Подавление ГГГ оси", system: "endocrine", organs: ["Гипоталамус", "Гипофиз", "Яички"], symptoms: ["Низкий тестостерон", "Атрофия яичек", "Бесплодие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "ААС подавляют ЛГ/ФСГ → остановка эндогенного тестостерона" },
  { id: "ENDO_GYNECOMASTIA", name: "Гинекомастия", system: "endocrine", organs: ["Молочные железы"], symptoms: ["Увеличение грудных желёз", "Болезненность", "Выделения"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Ароматизация тестостерона → эстрадиол → рост грудных желёз" },
  { id: "ENDO_PROLACTIN", name: "Гиперпролактинемия", system: "endocrine", organs: ["Гипофиз"], symptoms: ["Галакторея", "Снижение либидо", "Аменорея (у женщин)"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение пролактина (прогестагенные ААС, тренболон)" },
  { id: "ENDO_THYROID", name: "Нарушение щитовидной железы", system: "endocrine", organs: ["Щитовидная железа"], symptoms: ["Утомляемость", "Изменение веса", "Тремор"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Влияние ААС на ТТГ, Т3, Т4" },
  { id: "ENDO_CORTISOL", name: "Дисбаланс кортизола", system: "endocrine", organs: ["Надпочечники"], symptoms: ["Утомляемость", "Мышечная слабость", "Отёки"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение или подавление кортизола на фоне ААС" },

  // === КРОВЕТВОРНАЯ СИСТЕМА (hematologic) ===
  { id: "HEMA_POLYCYTHEMIA", name: "Полицитемия", system: "hematologic", organs: ["Костный мозг"], symptoms: ["Покраснение лица", "Головная боль", "Затуманивание зрения"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение гематокрита >54% на фоне ААС" },
  { id: "HEMA_THROMBOSIS_RISK", name: "Риск тромбоза", system: "hematologic", organs: ["Сосуды"], symptoms: ["Боль в ноге", "Отёк", "Одышка"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Гиперкоагуляция и полицитемия → тромбоз глубоких вен, ТЭЛА" },
  { id: "HEMA_ANEMIA", name: "Анемия", system: "hematologic", organs: ["Костный мозг"], symptoms: ["Бледность", "Утомляемость", "Одышка при нагрузке"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Снижение гемоглобина и эритроцитов" },
  { id: "HEMA_HIGH_LDL", name: "Дислипидемия", system: "hematologic", organs: ["Печень", "Сосуды"], symptoms: ["Бессимптомно", "Атеросклероз (длительно)"], levels: ["LOW", "MEDIUM", "HIGH"], description: "ЛПНП ↑ ЛПВП ↓ на фоне ААС — основной фактор атеросклероза" },

  // === РЕПРОДУКТИВНАЯ СИСТЕМА (reproductive) ===
  { id: "REPRO_TESTICULAR_ATROPHY", name: "Атрофия яичек", system: "reproductive", organs: ["Яички"], symptoms: ["Уменьшение яичек", "Снижение сперматогенеза", "Бесплодие"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Подавление ЛГ/ФСГ → остановка эндогенного тестостерона" },
  { id: "REPRO_INFERTILITY", name: "Мужское бесплодие", system: "reproductive", organs: ["Яички", "Эпидидимис"], symptoms: ["Олигоспермия", "Астеноспермия", "Низкий объём спермы"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение сперматогенеза на фоне ААС" },
  { id: "REPRO_PROSTATE", name: "Гиперплазия простаты", system: "reproductive", organs: ["Предстательная железа"], symptoms: ["Частое мочеиспускание", "Слабая струя", "Ночные позывы"], levels: ["LOW", "MEDIUM", "HIGH"], description: "DHT-опосредованная гиперплазия предстательной железы" },
  { id: "REPRO_ERECTILE", name: "Эректильная дисфункция", system: "reproductive", organs: ["Половой член"], symptoms: ["Снижение либидо", "Эректильная дисфункция", "Снижение утренних эрекций"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение эректильной функции на фоне подавления ГГГ" },

  // === ОПОРНО-ДВИГАТЕЛЬНАЯ СИСТЕМА (musculoskeletal) ===
  { id: "JOINT_TENDON_RISK", name: "Риск разрыва сухожилий", system: "musculoskeletal", organs: ["Сухожилия", "Связки"], symptoms: ["Боль в сухожилиях", "Слабость связок", "Ограничение подвижности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Мышечная сила ↑ быстрее, чем адаптируются сухожилия" },
  { id: "JOINT_ARTHRITIS", name: "Артрит", system: "musculoskeletal", organs: ["Суставы"], symptoms: ["Боль", "Отечность", "Покраснение"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Воспаление суставов" },
  { id: "JOINT_ARTHROSIS", name: "Артроз", system: "musculoskeletal", organs: ["Суставы"], symptoms: ["Боль", "Хруст", "Ограничение подвижности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Дегенеративное поражение суставного хряща" },
  { id: "JOINT_GOUT", name: "Подагра", system: "metabolic", organs: ["Суставы"], symptoms: ["Острая боль", "Покраснение", "Отечность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Отложение мочевой кислоты в суставах" },
  { id: "JOINT_TENDONITIS", name: "Тендинит", system: "musculoskeletal", organs: ["Сухожилия"], symptoms: ["Боль", "Отечность", "Ограничение подвижности"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Воспаление сухожилий" },

  // === МЕТАБОЛИЗМ (metabolic) ===
  { id: "METABOLIC_SYNDROME", name: "Метаболический синдром", system: "metabolic", organs: ["Печень", "Поджелудочная", "Жировая ткань"], symptoms: ["Инсулинорезистентность", "Абдоминальное ожирение", "Дислипидемия"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Комплекс метаболических нарушений на фоне ААС" },
  { id: "METABOLIC_INSULIN_RESISTANCE", name: "Инсулинорезистентность", system: "metabolic", organs: ["Мышцы", "Печень", "Жировая ткань"], symptoms: ["Повышенный сахар", "Увеличение жировой массы", "Усталость после еды"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Снижение чувствительности тканей к инсулину" },
  { id: "METABOLIC_HYPERURICEMIA", name: "Гиперурикемия", system: "metabolic", organs: ["Почки", "Суставы"], symptoms: ["Подагрические атаки", "Боль в суставах", "Мочевые камни"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение мочевой кислоты в крови" },

  // === GH/IGF (ghigf) ===
  { id: "GH_ACROMEGALY_RISK", name: "Риск акромегалии", system: "ghigf", organs: ["Гипофиз", "Кости", "Мягкие ткани"], symptoms: ["Увеличение кистей/стоп", "Грубые черты лица", "Головная боль"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Хронический избыток GH/IGF-1 → акромегалия" },
  { id: "GH_INSULIN_RESISTANCE", name: "Инсулинорезистентность (GH)", system: "ghigf", organs: ["Печень", "Мышцы"], symptoms: ["Повышенный сахар", "Отёки", "Суставные боли"], levels: ["LOW", "MEDIUM", "HIGH"], description: "GH antagonizes insulin → гипергликемия" },
  { id: "GH_CARPAL_TUNNEL", name: "Синдром запястного канала", system: "ghigf", organs: ["Запястье", "Срединный нерв"], symptoms: ["Онемение пальцев", "Боль в запястье", "Слабость кисти"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Отёк и компрессия срединного нерва на фоне GH" },

  // === ИНСУЛИНОВАЯ ОСЬ (ins_axis) ===
  { id: "INS_DIABETES_RISK", name: "Риск сахарного диабета", system: "ins_axis", organs: ["Поджелудочная железа", "Мышцы", "Печень"], symptoms: ["Жажда", "Частое мочеиспускание", "Утомляемость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Хроническая инсулинорезистентность → диабет 2 типа" },

  // === НЕЙРОТОКСИЧНОСТЬ (neuro_toxicity) ===
  { id: "NEUROTOX_DOPAMINE", name: "Дофаминовая дисрегуляция", system: "neuro_toxicity", organs: ["Дофаминовые нейроны"], symptoms: ["Агрессия", "Мания", "Зависимость", "ПКТ-депрессия"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение дофаминовой передачи — тренболон, высокие дозы тестостерона" },
  { id: "NEUROTOX_SEROTONIN", name: "Серотониновый дисбаланс", system: "neuro_toxicity", organs: ["Серотониновые нейроны"], symptoms: ["Тревога", "Депрессия", "Бессонница", "Раздражительность"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Нарушение серотониновой передачи — риск серотонинового синдрома при комбинациях" },
  { id: "NEUROTOX_GABA", name: "ГАМК-дисфункция", system: "neuro_toxicity", organs: ["ГАМК-рецепторы"], symptoms: ["Бессонница", "Тревожность", "Судороги", "Тремор"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Подавление ГАМК-ергической передачи — снижение торможения в ЦНС" },
  { id: "NEUROTOX_PERIPHERAL", name: "Периферическая нейропатия", system: "neuro_toxicity", organs: ["Периферические нервы"], symptoms: ["Парестезии", "Онемение", "Боль", "Мышечная слабость"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение периферических нервов токсичными метаболитами" },

  // === КРОВЬ (blood) ===
  { id: "BLOOD_POLYCYTHEMIA", name: "Эритроцитоз", system: "blood", organs: ["Костный мозг"], symptoms: ["Покраснение кожи", "Головная боль", "Затуманивание зрения"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Стимуляция эритропоэза ААС → HCT >54%" },
  { id: "BLOOD_COAGULATION", name: "Гиперкоагуляция", system: "blood", organs: ["Плазма"], symptoms: ["Тромбоз", "ТЭЛА (редко)", "D-димер ↑"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повышение свёртываемости крови на фоне ААС" },

  // === СОСУДЫ (vessels) ===
  { id: "VESSELS_ENDOTHELIUM", name: "Эндотелиальная дисфункция", system: "vessels", organs: ["Эндотелий"], symptoms: ["Повышенное АД", "Холодные конечности", "Варикоз"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Повреждение эндотелия сосудов — ранний маркер атеросклероза" },
  { id: "VESSELS_ATHEROSCLEROSIS", name: "Атеросклероз сосудов", system: "vessels", organs: ["Артерии"], symptoms: ["ИБС", "Стенокардия", "Перемежающаяся хромота"], levels: ["LOW", "MEDIUM", "HIGH"], description: "ЛПНП ↑ + эндотелиальная дисфункция → атеросклероз" },
  { id: "VESSELS_VASOSPASM", name: "Вазоспазм", system: "vessels", organs: ["Артерии"], symptoms: ["Головная боль", "Холодные конечности", "Мышечные судороги"], levels: ["LOW", "MEDIUM", "HIGH"], description: "Спазм сосудов на фоне ААС (тренболон, высокие дозы)" },
];


