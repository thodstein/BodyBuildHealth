// ════════════════════════════════════════════════════════════════════════════
//  SUBSTANCE-FORMS — оптимальные формы, замены, биодоступность, время приёма
//  Только аптечные бренды (для БАД — без брендов, только форма)
// ════════════════════════════════════════════════════════════════════════════

export interface SubstanceForm {
  id: string;
  optimalForm: string;        // «Бисглицинат», «MK-7», «Убихинол»
  pharmacyBrands?: string[];  // только аптечные (Урсосан, Аримидекс, Небилет…)
  altForm?: string;           // «Оксид (4% всасывание!)» — НИЗКАя биодоступность
  altSubstance?: string;      // канон-ID для замены
  bioavailability?: string;   // «40% (бисглицинат) vs 4% (оксид)»
  note?: string;
  bestTime: string;           // «с жирной едой» / «натощак»
  cycleBreaks?: string;       // «8 нед on → 2 нед off»
  qualityMark?: string;       // «NSF/USP» — без брендов
}

export const SUBSTANCE_FORMS: Record<string, SubstanceForm> = {

  // ─── ПЕЧЕНЬ ───
  tudca: {
    id: 'tudca', optimalForm: 'TUDCA (тауроурсодезоксихолевая)',
    pharmacyBrands: ['Урсосан 250', 'Ursofalk 500'],
    altSubstance: 'udca', altForm: 'УДХК (урсодезоксихолевая) — 90% биодоступность vs TUDCA 50%',
    bioavailability: '50% per os (TUDCA) vs 90% (UDCA)',
    note: 'TUDCA уникальный против-ER-stress гепатоцитов. UDCA — для холестаза.',
    bestTime: 'натощак за 30 мин до еды',
  },
  milk_thistle: {
    id: 'milk_thistle', optimalForm: 'Силимарин 80% стандартизированный',
    pharmacyBrands: ['Легалон 140 мг', 'Карсил', 'Силимар'],
    altForm: 'Silybin-фосфатидилхолин комплекс (Meriva) — 29× биодоступность',
    bioavailability: '10% (силимарин) → 80% (Meriva комплекс с лецитином)',
    note: 'Принимать с lecithin/фосфатидилхолином для ↑ всасывания в 8×',
    bestTime: 'с едой',
  },

  // ─── АНТИОКСИДАНТЫ ───
  nac: {
    id: 'nac', optimalForm: 'N-ацетилцистеин',
    pharmacyBrands: ['Ацетилцистеин Hexal', 'Fluimucil'],
    altForm: 'Глутатион липосомальный (GSH liposomal)',
    bioavailability: 'NAC 4-10% per os; липосомальный GSH — выше',
    note: 'NAC — предшественник глутатиона. Прямой GSH плохо всасывается.',
    bestTime: 'натощак',
  },
  alpha_lipoic: {
    id: 'alpha_lipoic', optimalForm: 'R-липоевая кислота (NOT S-форма!)',
    pharmacyBrands: ['Берлитион 600', 'Тиоктацид 600'],
    altForm: 'Racemic (R+S) — дешевле, но R-форма в 2× эффективнее',
    bioavailability: 'R-форма: 30-40%, S-форма: 20%',
    note: 'R-форма — натуральная. S-форма — синтетическая, менее активна.',
    bestTime: 'натощак за 30 мин до еды',
  },
  coq10: {
    id: 'coq10', optimalForm: 'Убихинол (восстановленная форма, ≥40 лет)',
    pharmacyBrands: [],
    altForm: 'Убихинон (окисленная форма, для моложе 40)',
    bioavailability: 'Убихинол в 8× лучше всасывается у взрослых >40',
    note: 'С возрастом способность восстанавливать убихинон → убихинол ↓. ≥40 — убихинол.',
    bestTime: 'с жирной едой (липорастворимый)',
  },
  astaxanthin: {
    id: 'astaxanthin', optimalForm: 'Astaxanthin 4 мг (Haematococcus pluvialis)',
    bioavailability: '40% с жирной едой, 10% без',
    note: 'Липофильный — ОБЯЗАТЕЛЬНО с жирной едой. ≈100× сильнее витамина E.',
    bestTime: 'с жирной едой',
  },
  vitamin_c: {
    id: 'vitamin_c', optimalForm: 'Аскорбиновая кислота (buffered для ЖКТ)',
    pharmacyBrands: [],
    altForm: 'Ester-C (для чувствительного ЖКТ)',
    bioavailability: '80-90%, plateau ~500 мг (выше — ↓%)',
    note: 'Дозы >1000 мг ↓ всасывание.',
    bestTime: 'натощак',
  },

  // ─── ССС / ЛИПИДЫ ───
  omega3: {
    id: 'omega3', optimalForm: 'Триглицерид форма (TG), EPA+DHA 60%+',
    altForm: 'Krill oil (фосфолипидная форма, EPA+DHA 24%)',
    bioavailability: 'TG > EE (ethyl ester); Krill = фосфолипид ~ выше насыщения',
    note: 'Важно! EPA ≥ 1000 мг + DHA ≥ 500 мг (общая ≥ 2 г EPA+DHA/день). '
        + 'При запущенной дислипидемии — EPA 2-3 г + DHA 1 г (total 3-4 г). '
        + 'Krill oil 2 г = ~500 мг EPA+DHA.',
    bestTime: 'с жирной едой',
  },
  bergamot: {
    id: 'bergamot', optimalForm: 'Bergamot polyphenolic fraction (BPF) 500-1000 мг',
    bioavailability: 'Стандартизированный экстракт 25-38% брутель',
    note: 'HMG-CoA редуктаза (натуральный «статин»). Увеличивать дозу при LDL >3.5.',
    bestTime: 'с едой 2×/день',
  },
  niacin: {
    id: 'niacin', optimalForm: 'Никотиновая кислота (NOT ниацинамид!)',
    pharmacyBrands: ['Эндурацин', 'Slo-Niacin'],
    altForm: 'Niacinamide — нет флаша, но ↓ 50% липидный эффект (бесполезен для HDL)',
    bioavailability: '60-80%',
    note: '↑HDL 15-35%, ↓LDL 5-25%, ↓TG 20-50%. '
        + 'Флаш — нормальный, проходит за 2-4 нед. Целевая доза 1000-2000 мг.',
    bestTime: 'на ночь, с едой',
    cycleBreaks: '↑ постепенно 100→250→500→1000→1500 мг за 2-4 нед',
  },
  garlic: {
    id: 'garlic', optimalForm: 'Аллицин 1.8% стандартизированный (5-6 мг аллицина/таб)',
    altForm: 'Экстракт выдержанного чеснока (Kyolic) — без запаха, мягче для ЖКТ',
    bioavailability: 'Аллицин нестабилен — станд. экстракт > сырой чеснок',
    note: '↓LDL 5-15%, ↓SBP 5-8 mmHg, ↓ aggregation. 1200 мг/день.',
    bestTime: 'с едой',
  },
  pycnogenol: {
    id: 'pycnogenol', optimalForm: 'Pycnogenol 150 мг (Pinus pinaster extract)',
    bioavailability: '30-40% per os',
    note: 'eNOS-стимулятор + антиоксидант эндотелия + ↓CRP. 100-150 мг/день.',
    bestTime: 'с едой',
  },

  // ─── NO-ПУТЬ ───
  agmatine: {
    id: 'agmatine', optimalForm: 'Agmatine sulfate',
    altForm: 'Agmatine HCL (менее распространён)',
    bioavailability: '60-75% per os',
    note: 'eNOS + имидазолин-рецепторы. 1 г 2×/день, натощак.',
    bestTime: 'натощак, pre-workout',
  },
  citrulline: {
    id: 'citrulline', optimalForm: 'L-Цитруллин (NOT аргинин!)',
    bioavailability: 'Цитруллин 80% (минует печень) → аргинин → NO; '
                   + 'аргинин 20% (эффект «первого прохода») — поэтому цитруллин в 2× эффективнее',
    note: '6 г/день = эквивалент аргинина 30+ г (пампинг). Malate форма (+ energy).',
    bestTime: 'pre-workout, натощак',
  },

  // ─── МЕТАБОЛИЗМ / ИНСУЛИН ───
  berberine: {
    id: 'berberine', optimalForm: 'Berberine HCL 97% стандартизированный',
    bioavailability: '5% per os (плохая!), с пиперином или Phytosome ~ 10×',
    note: 'AMPK-активатор. С пиперином ↑ биодоступность. '
        + 'Курсами 8 нед ON → 2 нед OFF (microbiome tolerance). '
        + 'Эффект на HbA1c ≈ Metformin.',
    bestTime: 'с едой 2×/день',
    cycleBreaks: '8 нед ON → 2 нед OFF',
  },
  metformin: {
    id: 'metformin', optimalForm: 'Метформин ER (пролонгированная форма)',
    pharmacyBrands: ['Глюкофаж XR', 'Метформин-Тева'],
    altForm: 'Метформин IR (немедленное высвобождение) — ↑ GI побочки',
    bioavailability: 'ER 50-60%, IR 30-50%',
    note: ' ⚠ через врача. ER форма лучше переносится (↓ GI побочек). '
        + 'contra: eGFR<30 (лактоацидоз), контраст → STOP 48ч.',
    bestTime: 'после еды',
  },
  chromium: {
    id: 'chromium', optimalForm: 'Chromium picolinate 200 мкг',
    altForm: 'Chromium polynicotinate',
    bioavailability: 'Picolinate 25%, Polynicotinate 10%',
    note: '⚠ ТОЛЬКО при инсулине! Кофактор инсулинового рецептора. '
        + 'Без инсулина — избыточно.',
    bestTime: 'с едой',
  },

  // ─── ГОНАДНАЯ ОСЬ ───
  anastrozole: {
    id: 'anastrozole', optimalForm: 'Анастрозол 1 мг таб',
    pharmacyBrands: ['Аримидекс'],
    altSubstance: 'letrozole', altForm: 'Летрозол — более мощный (2.5-5 мг, в крайних случаях)',
    bioavailability: '80-90% per os',
    note: '⚠ ТОЛЬКО ПОД КОНТРОЛЕМ АНАЛИЗОВ. E2 цель: 20-40 pg/mL. '
        + 'Tитрация: 0.25→0.5→1 мг/д. На курсе судоверна — риск ↓HDL, ↓bone.',
    bestTime: 'утро',
  },
  cabergoline: {
    id: 'cabergoline', optimalForm: 'Каберголин 0.25 мг таб',
    pharmacyBrands: ['Dostinex', 'Каберголин-Тева'],
    altForm: 'Бромокриптин (2nd line, ↑побочки)',
    bioavailability: '60% per os; max 4.5 мг/нед',
    note: '⚠ ТОЛЬКО ПОД КОНТРОЛЕМ АНАЛИЗОВ. Пролактин цель <15. '
        + 'Tитрация: 0.125→0.25→0.5 мг 2×/нед.',
    bestTime: 'на ночь с едой',
  },
  hcg: {
    id: 'hcg', optimalForm: 'hCG 5000 IU (лиофилизированный)',
    pharmacyBrands: ['Pregnyl', 'Ovidac', 'Профази', 'Хорагон'],
    altForm: 'r-hCG (Ovidrel 250 мкг = ~6500 IU)',
    bioavailability: 'IM 100%, SC 80-90% (SC preferred, simpler)',
    note: '500 МЕ 2×/нед. Схема 3/1 (3 нед приём, 1 отдых). SC injection preferred.',
    bestTime: 'утро, в день инъекции',
  },

  // ─── БЛОКАТОРЫ / ФАРМА ───
  telmisartan: {
    id: 'telmisartan', optimalForm: 'Telmisartan 20-80 мг',
    pharmacyBrands: ['Микардис', 'Тельмисартан-Тева'],
    altSubstance: 'losartan', altForm: 'Лозартан (2nd line ARB, меньше PPAR-γ)',
    bioavailability: '42-58%',
    note: 'Лучший ARB на курсе: PPAR-γ-активация (инсулин-чувствительность), '
        + 'НЕ снижает VO₂max. Цель АД <130/85.',
    bestTime: 'утро',
  },
  nebivolol: {
    id: 'nebivolol', optimalForm: 'Nebivolol 2.5-5 мг',
    pharmacyBrands: ['Небилет'],
    altForm: 'Бисопролол (без NO-вазодилатации)',
    bioavailability: '80%',
    note: '⚠ Под контролем ЧСС и АД. β1-селективный + NO-опосредованная вазодилатация. '
        + 'Цель ЧСС 60-80. НЕ при AV-блокаде 2-3 ст., ЧСС<50.',
    bestTime: 'утро',
  },
  tadalafil: {
    id: 'tadalafil', optimalForm: 'Tadalafil 5 мг daily',
    pharmacyBrands: ['Сиалис 5 мг'],
    altForm: '10 мг on-demand (для ED)',
    bioavailability: '80%, max 36 ч T½',
    note: '5 мг/день — простата, BP, NO. ⛔ НЕ комбинировать с нитратами или α-блокерами!',
    bestTime: 'утро, фиксированное время',
  },
  tamoxifen: {
    id: 'tamoxifen', optimalForm: 'Тамоксифен 20 мг',
    pharmacyBrands: ['Тамоксифен-Тева', 'Nolvadex'],
    bioavailability: '100%',
    note: 'SERM. Используется при гино/ПКТ. ⚠ риск тромбоза — serra+natto. '
        + 'AI не работает с Anadrol — только SERM.',
    bestTime: 'утро',
  },
  spironolactone: {
    id: 'spironolactone', optimalForm: 'Спиронолактон 25-50 мг',
    pharmacyBrands: ['Верошпирон'],
    bioavailability: '70-90%',
    note: '⚠ через врача. Антагонист альдостерона. Только для отёков Anadrol. '
        + 'Противопоказан: гиперкалиемия, eGFR<30, болезнь Аддисона.',
    bestTime: 'утро',
  },

  // ─── ВИТАМИНЫ / МИНЕРАЛЫ (точечные уточнения) ───
  vitamin_d3: {
    id: 'vitamin_d3', optimalForm: 'Холекальциферол (D3) в масле',
    pharmacyBrands: ['Вигантол', 'Аквадетрим'],
    bioavailability: '10000 МЕ → 50 ng/mL за 12 нед; с жирной едой ↑',
    note: 'Цель 25-OH-D3: 40-60 ng/mL. С K2 ОБЯЗАТЕЛЬНО. Сдать через 12 нед.',
    bestTime: 'с жирной едой',
  },
  vitamin_k2: {
    id: 'vitamin_k2', optimalForm: 'MK-7 (NOT MK-4!)',
    bioavailability: 'MK-7: T½ 3 дня, 100 мкг = достаточно. MK-4: T½ часы, → высокие дозы.',
    note: '⚠ ОБЯЗАТЕЛЕН с D3! Направляет Ca²⁺ в кости, ↓ кальцификация сосудов. '
        + 'Только MK-7. Спрей или капли.',
    bestTime: 'с жирной едой',
  },
  vitamin_e: {
    id: 'vitamin_e', optimalForm: 'Mixed tocopherols (γ + α.+ β, δ)',
    bioavailability: '50-80%, tocopherol > tocotrienol в дозе',
    note: 'Липофильный антиоксидант. С Astaxanthin + VitC — синнергия.',
    bestTime: 'с жирной едой',
  },
  magnesium: {
    id: 'magnesium', optimalForm: 'Бисглицинат (sleep/спокойствие) или треонат (мозг)',
    altForm: 'Цитрат (слабительный!), Оксид (4% всасывание!) — НЕ рекомендуются',
    bioavailability: 'Бисглицинат 40%, Треонат ≈ (тауреплирует через гематоэнцефалический барьер) с, Цитрат 30%, Оксид 4%',
    note: 'Бисглицинат — для курсак, сна. Треонат — для когнитивный функции. '
        + 'Цитрат — только при запоре (laxative). Оксид — ровно бесполезен.',
    bestTime: 'на ночь (бисглицинат); утро (треонат)',
  },
  b_complex: {
    id: 'b_complex', optimalForm: 'B6 P5P + B12 метилкобаламин + Folate 5-MTHF',
    altForm: 'Фолиевая кислота (синтетическая) — ОПАСНО при MTHFR мутации! Только 5-MTHF.',
    bioavailability: 'Активные формы 90%+; фолиевая кислота при MTHFR homo → 30%',
    note: 'Только АКТИВНЫЕ формы: P5P (не pyridoxine HCl), метил-B12 (не цианкобаламин), 5-MTHF (не фолиевая).',
    bestTime: 'с едой',
  },
  zinc: {
    id: 'zinc', optimalForm: 'Пиколинат или бисглицинат',
    pharmacyBrands: [],
    altForm: 'Оксид (низкое всасывание)',
    bioavailability: 'Пиколинат 60%, Бисглицинат 50%, Оксид 20%',
    note: '30 мг/день — иммунитет, тестостерон (кофактор). Не с медью (конкурируют).',
    bestTime: 'на ночь, отдельно от Ca/Mg',
  },
  selenium: {
    id: 'selenium', optimalForm: 'Селенометионин (NOT селенит!)',
    pharmacyBrands: [],
    altForm: 'Selenate',
    bioavailability: 'Селенометионин 90%, Selenite 50%',
    note: 'Кофактор дейодиназы T4→T3. 200 мкг/день. Опасен в избытке (>400).',
    bestTime: 'с едой',
  },
  calcium: {
    id: 'calcium', optimalForm: 'Гидроксиапатит или цитрат (NOT карбонат!)',
    bioavailability: 'Гидроксиапатит 70%, Цитрат 40%, Карбонат 20% (с HCl желудка)',
    note: 'Не >500 мг за 1 приём. С D3+K2 ОБЯЗАТЕЛЬНО. Развести с тироксином на 4ч.',
    bestTime: 'с едой',
  },
  iron_bisglycinate: {
    id: 'iron_bisglycinate', optimalForm: 'Iron bisglycinate (хелатная форма)',
    altForm: 'Сульфат железа (GI побочки, окисление)',
    bioavailability: 'Бисглицинат 27%, сульфат 10-15% (↑GI побочки)',
    note: 'С VitC 500 мг ↑ всасывание ×3. НЕ с чаем/кофе (танины ↓). '
        + 'Контроль ферритина через 8 нед.',
    bestTime: 'натощак, с VitC',
  },
  taurine: {
    id: 'taurine', optimalForm: 'Free-form taurine (amino acid)',
    pharmacyBrands: [],
    bioavailability: '100%',
    note: 'Осмолит, кардиопротектор, нейропротекция. 1000-5000 мг (трен/clen).',
    bestTime: 'натощак',
  },
  glycine: {
    id: 'glycine', optimalForm: 'Glycine amino acid',
    bioavailability: '100%',
    note: 'Сон, глутатион (Cys+Gly), mTOR. 3 г перед сном.',
    bestTime: 'перед сном',
  },

  // ─── ДИУРЕТИКИ / ВЕНОТОНИКИ ───
  dandelion: {
    id: 'dandelion', optimalForm: 'Экстракт корня одуванчика (4:1)',
    bioavailability: '30-50% (растительный экстракт)',
    note: 'K⁺-сберегающий диуретик (не сечёт калий, как фуросемид). 500 мг 2×/д.',
    bestTime: 'утро и день (не вечер! — diuretic)',
  },
  hesperidin: {
    id: 'hesperidin', optimalForm: 'Hesperidin 500 + Diosmin 450 (комплекс 1 таб)',
    bioavailability: 'Hesperidin 20%, ↑ с витамином C',
    note: 'Венотоник. ↓ проницаемость капилляров, ↓ отёки. 1 таб/день.',
    bestTime: 'с едой',
  },

  // ─── ФИБРИНОЛИТИКИ ───
  serrapeptase: {
    id: 'serrapeptase', optimalForm: 'Serrapeptase (10 мг = 20,000 SPU)',
    bioavailability: '10-15% per os (enteric-coated ОБЯЗАТЕЛЕН)',
    note: 'Расщепление α2-макроглобулина и фибрина. 10-20 мг 2×/д. '
        + 'Натощак (30 мин до еды). Enteric-coated таб!',
    bestTime: 'натощак',
  },
  nattokinase: {
    id: 'nattokinase', optimalForm: 'Nattokinase NSK-SD (2000 FU/100 мг)',
    bioavailability: '80% (энтеральное покрытие, NSK-SD® стандартизированный)',
    note: 'Активация плазминогена → плазмин. 100-200 мг. Натощак. '
        + '⚠ Антикоагулянты — риск.',
    bestTime: 'натощак',
  },

  // ─── НЕЙРО / СОН ───
  theanine: {
    id: 'theanine', optimalForm: 'L-Теанин (Suntheanine® станд.)',
    bioavailability: '70-80%',
    note: 'α-волны мозга, ↓ тревога, без седации. 200 мг — спокойный фокус. 1-2 ч до сна.',
    bestTime: 'вечер или на ночь',
  },
  melatonin: {
    id: 'melatonin', optimalForm: 'Melatonin 0.3-3 мг (микродозы эффективнее)',
    pharmacyBrands: ['Мелаксен'],
    altForm: 'Quick-release (не SR для сна)',
    bioavailability: '15% (first-pass), 0.3-1 мг = часто достаточно',
    note: '⚠ Большие дозы (5-10+ мг) могут панα-α-сенд → ↓ phản. Цель: 0.3-1 мг, '
        + 'прологалгированная форма — нарушения сна. SR — для второго цикла сна.',
    bestTime: '30 мин до сна',
    cycleBreaks: '2 нед on → 2 нед off (не каждый день)',
  },
  phosphatidylserine: {
    id: 'phosphatidylserine', optimalForm: 'Phosphatidylserine 300 мг (soy-derived)',
    bioavailability: '60%',
    note: '↓ACTH (cortisol suppression). Для беспокойства + спорт. 300-600 мг. '
        + 'С опаской — ↓ кортизол может блоировать хрон адаптацию.',
    bestTime: 'с едой',
  },

  // ─── НЕДОСТАЮЩИЕ ВЕЩЕСТВА ───
  astragalus: {
    id: 'astragalus', optimalForm: 'Экстракт корня астрагала (80% сапонины)',
    bioavailability: '~40% (сапонины B-I)',
    note: 'Защита клубочков почек: ↓ протеинурия, ↑ GFR. Адаптоген для иммунитета.',
    bestTime: 'с едой',
    cycleBreaks: '8 нед on → 2 нед off',
  },
  cordyceps: {
    id: 'cordyceps', optimalForm: 'Cordyceps sinensis CS-4 (мицелий, не плодовое тело)',
    bioavailability: '~60% (аденозин, кордицепин)',
    note: '↓ BUN/креатинин, ↑ ATP, дыхательная выносливость. Остерегаться подделок (Cs-4 vs C. militaris).',
    bestTime: 'утро, с едой',
    cycleBreaks: '8 нед on → 2 нед off',
  },
  saw_palmetto: {
    id: 'saw_palmetto', optimalForm: 'Экстракт ягод Serenoa repens (320 мг, 85-95% липостеролов)',
    pharmacyBrands: ['Простамол Уно 320 мг'],
    bioavailability: '~60% (липостеролы, с жирной едой ↑)',
    note: '5α-редуктаза (снижение DHT → простата и волосяные фолликулы). Не применять с финастеридом одновременно.',
    bestTime: 'с жирной едой',
  },
  d_mannose: {
    id: 'd_mannose', optimalForm: 'D-манноза (простой сахар, ≥99% чистоты)',
    bioavailability: '~90% — выводится с мочой, не метаболизируется',
    note: 'Профилактика ИМП: предотвращает прикрепление E. coli к уротелию. Не антибиотик. Можно длительно.',
    bestTime: 'натощак, запить водой',
    cycleBreaks: '3 нед приём (1 г 2р/день) → 1 нед off',
  },
  tmg: {
    id: 'tmg', optimalForm: 'TMG (триметилглицин, безводный)',
    bioavailability: '~100%',
    note: 'Донатор CH₃ — ↓ гомоцистеин (AAS ↑ Hcy). Сильнее SAMe, дешевле. 1000 мг = 750 мг SAMe по эквиваленту.',
    bestTime: 'с едой',
  },
  potassium: {
    id: 'potassium', optimalForm: 'Калия хлорид (ретард, НЕ простая форма)',
    pharmacyBrands: ['Панангин', 'Калия хлорид ретард'],
    bioavailability: '~100%',
    note: '⚠ Рекомендация ⚠ Контроль K⁺ с анализами. Опасно при >5 моль/л (с п/к). НЕ на голодный желудок.',
    bestTime: 'с едой',
  },
};

// Утилита для UI
export function getSubstanceForm(id: string): SubstanceForm | null {
  return SUBSTANCE_FORMS[id] || SUBSTANCE_FORMS[id.toLowerCase()] || null;
}

export function formField(id: string, field: keyof SubstanceForm): string {
  const f = getSubstanceForm(id);
  if (!f) return '';
  return f[field] as string || '';
}

export function hasForm(id: string): boolean {
  return !!getSubstanceForm(id);
}