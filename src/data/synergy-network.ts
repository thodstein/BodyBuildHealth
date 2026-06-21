// ===========================================================================
// SYNERGY NETWORK — полная база синергий, конфликтов и комбинаций
// Каждая запись:
// - pair: [id1, id2] — пара препаратов (порядок не важен)
// - type: 'synergy' | 'conflict'
// - effect: краткий эффект
// - mechanism: механизм взаимодействия
// - severity: LOW | MEDIUM | HIGH
// - score: 0-10 (сила эффекта)
// ===========================================================================

export interface SynergyNetworkEntry {
  a: string;
  b: string;
  type: 'synergy' | 'conflict';
  effect: string;
  mechanism: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
}

export const SYNERGY_NETWORK: SynergyNetworkEntry[] = [
  // ═══════════════════════════════════════════════════════════════════
  // АНТИОКСИДАНТНАЯ СЕТЬ (8 препаратов — полный граф)
  // ═══════════════════════════════════════════════════════════════════
  {a:'nac',b:'alpha_lipoic',type:'synergy',effect:'Усиление антиоксидантной сети',mechanism:'АЛЬК регенерирует глутатион и вит.C. NAC — предшественник глутатиона. Вместе — полный цикл: синтез + регенерация + утилизация',severity:'HIGH',score:9},
  {a:'nac',b:'vitamin_c',type:'synergy',effect:'Регенерация глутатиона',mechanism:'Вит.C восстанавливает окисленный глутатион (GSSG→GSH), NAC — субстрат для синтеза нового глутатиона',severity:'HIGH',score:8},
  {a:'nac',b:'selenium',type:'synergy',effect:'Глутатионпероксидаза',mechanism:'NAC даёт субстрат (глутатион), Se — кофактор GPx (фермента, утилизирующего глутатион для нейтрализации перекисей)',severity:'MEDIUM',score:7},
  {a:'nac',b:'vitamin_e',type:'synergy',effect:'Мембранная защита',mechanism:'NAC поддерживает внутриклеточный глутатион, вит.E защищает мембраны от липопероксидации. Разные компартменты',severity:'MEDIUM',score:6},
  {a:'nac',b:'coq10',type:'synergy',effect:'Митохондриальная защита',mechanism:'NAC повышает глутатион в митохондриях, CoQ10 поддерживает электрон-транспортную цепь. Синергия в митохондриях',severity:'MEDIUM',score:7},
  {a:'alpha_lipoic',b:'vitamin_c',type:'synergy',effect:'Цикл регенерации',mechanism:'АЛЬК восстанавливает дегидроаскорбат→аскорбат (вит.C), вит.C регенерирует вит.E. Тройной антиоксидантный цикл',severity:'HIGH',score:9},
  {a:'alpha_lipoic',b:'vitamin_e',type:'synergy',effect:'Регенерация вит.E',mechanism:'АЛЬК → вит.C → вит.E. АЛЬК восстанавливает окисленный вит.E через cascade-механизм',severity:'HIGH',score:8},
  {a:'alpha_lipoic',b:'coq10',type:'synergy',effect:'Регенерация CoQ10',mechanism:'АЛЬК восстанавливает окисленный убихинон (CoQ10) в убихинол — активную антиоксидантную форму',severity:'MEDIUM',score:7},
  {a:'alpha_lipoic',b:'selenium',type:'synergy',effect:'Антиоксидантная сеть',mechanism:'АЛЬК хелатирует переходные металлы (Fe, Cu), Se — кофактор GPx. Разные механизмы антиоксидантной защиты',severity:'MEDIUM',score:6},
  {a:'vitamin_c',b:'vitamin_e',type:'synergy',effect:'Синергия антиоксидантов',mechanism:'Вит.C регенерирует окисленный вит.E в мембранах, позволяя ему продолжать защиту липидов от пероксидации',severity:'HIGH',score:8},
  {a:'vitamin_c',b:'selenium',type:'synergy',effect:'Усвоение Se',mechanism:'Вит.C улучшает усвоение селена и предотвращает его окисление в кишечнике',severity:'LOW',score:4},
  {a:'vitamin_c',b:'coq10',type:'synergy',effect:'Митохондриальная защита',mechanism:'Вит.C защищает митохондрии от ROS, CoQ10 поддерживает АТФ-синтез. Синергия в дыхательной цепи',severity:'MEDIUM',score:6},
  {a:'vitamin_e',b:'selenium',type:'synergy',effect:'Мембранная защита',mechanism:'Вит.E (токоферол) в липидном слое мембраны, Se (GPx) в цитозоле и митохондриях — полная антиоксидантная защита',severity:'HIGH',score:8},
  {a:'vitamin_e',b:'coq10',type:'synergy',effect:'Мембраны + митохондрии',mechanism:'Вит.E защищает мембраны, CoQ10 защищает митохондриальную мембрану. Синергия на уровне клеточных мембран',severity:'MEDIUM',score:6},
  {a:'coq10',b:'selenium',type:'synergy',effect:'Митохондриальный тандем',mechanism:'Se (GPx) защищает митохондрии от перекисей, CoQ10 — ключевой переносчик электронов в дыхательной цепи',severity:'MEDIUM',score:6},

  // Комбинации 3+
  {a:'nac',b:'alpha_lipoic',type:'synergy',effect:'NAC + АЛЬК + С = антиоксидантный щит',mechanism:'Тройная защита: NAC→GSH, АЛЬК→регенерация, вит.C→GSH+E рециклинг. Полный антиоксидантный каскад',severity:'HIGH',score:9},
  {a:'alpha_lipoic',b:'vitamin_c',type:'synergy',effect:'АЛЬК + вит.C + вит.E = антиоксидантный каскад',mechanism:'Три фазы: АЛЬК→вит.C→вит.E. Каждый регенерирует следующий, создавая цикл утилизации ROS',severity:'HIGH',score:8},
  {a:'nac',b:'selenium',type:'synergy',effect:'NAC + Se = глутатионовая система',mechanism:'NAC для синтеза GSH, Se для GPx. Полный цикл синтеза и регенерации глутатиона',severity:'HIGH',score:8},

  // ═══════════════════════════════════════════════════════════════════
  // ГЕПАТОПРОТЕКЦИЯ (5 препаратов)
  // ═══════════════════════════════════════════════════════════════════
  {a:'nac',b:'tudca',type:'synergy',effect:'Комплексная защита печени',mechanism:'NAC ↔ глутатион + детоксикация. TUDCA ↓ ER-стресс, защита митохондрий, ↑ желчеотток. Разные механизмы — полный охват',severity:'HIGH',score:9},
  {a:'nac',b:'milk_thistle',type:'synergy',effect:'Гепатопротекция NAC + силимарин',mechanism:'NAC — повышение глутатиона, силимарин (расторопша) — стабилизация мембран гепатоцитов, антифибротическое действие',severity:'HIGH',score:8},
  {a:'nac',b:'phosphatidylcholine',type:'synergy',effect:'Защита мембран гепатоцитов',mechanism:'NAC → детоксикация + антиоксидант. ФХ → восстановление фосфолипидного слоя мембран гепатоцитов',severity:'MEDIUM',score:7},
  {a:'tudca',b:'milk_thistle',type:'synergy',effect:'Максимальная гепатопротекция',mechanism:'TUDCA стимулирует желчеотток и снижает ER-стресс. Силимарин стабилизирует мембраны. Комплементарные механизмы',severity:'HIGH',score:9},
  {a:'tudca',b:'phosphatidylcholine',type:'synergy',effect:'Желчеотток + регенерация',mechanism:'TUDCA разжижает желчь, ФХ восстанавливает мембраны гепатоцитов, повреждённые токсинами',severity:'MEDIUM',score:7},
  {a:'tudca',b:'alpha_lipoic',type:'synergy',effect:'ER-стресс + антиоксидант',mechanism:'TUDCA ↓ ER-стресс (unfolded protein response), АЛЬК — мощный антиоксидант с хелатирующими свойствами',severity:'MEDIUM',score:7},
  {a:'milk_thistle',b:'phosphatidylcholine',type:'synergy',effect:'Мембраны + стабилизация',mechanism:'Силимарин стабилизирует клеточные мембраны, ФХ поставляет субстрат для их восстановления',severity:'MEDIUM',score:6},
  {a:'milk_thistle',b:'alpha_lipoic',type:'synergy',effect:'Гепатопротекция + антиоксидант',mechanism:'Силимарин + АЛЬК = два механизма защиты гепатоцитов от токсинов',severity:'MEDIUM',score:6},
  {a:'milk_thistle',b:'berberine',type:'synergy',effect:'NAFLD + защита',mechanism:'Силимарин защищает гепатоциты, берберин улучшает липидный профиль и ↓ стеатоз печени',severity:'MEDIUM',score:7},
  {a:'alpha_lipoic',b:'berberine',type:'synergy',effect:'Метаболическая + антиоксидант',mechanism:'АЛЬК улучшает инсулиновую чувствительность, берберин — АМФК-активатор. Синергия метаболизма',severity:'MEDIUM',score:7},
  // NAC + TUDCA + Milk Thistle = триада печени
  {a:'nac',b:'tudca',type:'synergy',effect:'Триада печени: NAC + TUDCA + Milk Thistle',mechanism:'NAC → глутатион. TUDCA → ER-стресс + желчь. Силимарин → мембраны. Три разных механизма — максимальная гепатопротекция',severity:'HIGH',score:9},

  // ═══════════════════════════════════════════════════════════════════
  // КАРДИОПРОТЕКЦИЯ (6 препаратов)
  // ═══════════════════════════════════════════════════════════════════
  {a:'omega3',b:'coq10',type:'synergy',effect:'Кардиопротекция',mechanism:'Омега-3 ↓ TG и воспаление. CoQ10 защищает миокард и ↑ АТФ. Разные механизмы защиты сердца',severity:'MEDIUM',score:7},
  {a:'omega3',b:'magnesium',type:'synergy',effect:'Сердечно-сосудистая защита',mechanism:'Омега-3 ↓ триглицериды и ↓ воспаление. Mg ↓ АД и ↓ риск аритмий. Комплементарные кардиопротекторы',severity:'MEDIUM',score:7},
  {a:'omega3',b:'taurine',type:'synergy',effect:'Защита миокарда',mechanism:'Таурин ↑ сократимость миокарда и ↓ АД. Омега-3 ↑ мембранную текучесть кардиомиоцитов и ↓ воспаление',severity:'MEDIUM',score:7},
  {a:'omega3',b:'telmisartan',type:'synergy',effect:'Давление + липиды',mechanism:'Омега-3 ↓ триглицериды на 20-40%. Телмисартан (PPAR-γ) ↓ АД и ↑ чувствительность к инсулину',severity:'MEDIUM',score:7},
  {a:'omega3',b:'berberine',type:'synergy',effect:'Липидный профиль',mechanism:'Омега-3 ↓ TG, берберин ↓ ЛПНП и ↑ ЛПВП. Полный контроль липидного профиля',severity:'MEDIUM',score:7},
  {a:'coq10',b:'magnesium',type:'synergy',effect:'Митохондрии сердца',mechanism:'CoQ10 даёт энергию для АТФ, Mg стабилизирует мембраны кардиомиоцитов. Критическая пара для миокарда',severity:'MEDIUM',score:7},
  {a:'coq10',b:'taurine',type:'synergy',effect:'Сократимость',mechanism:'Таурин регулирует Ca2+ в кардиомиоцитах, CoQ10 даёт энергию (АТФ) для сокращения. Оба ↑ сердечный выброс',severity:'MEDIUM',score:7},
  {a:'magnesium',b:'taurine',type:'synergy',effect:'Расслабление + кардио',mechanism:'Mg и таурин синергично ↓ АД, ЧСС и тонус сосудов. Оба — естественные антагонисты кальция',severity:'MEDIUM',score:7},
  {a:'magnesium',b:'telmisartan',type:'synergy',effect:'Контроль АД',mechanism:'Mg расслабляет гладкую мускулатуру сосудов. Телмисартан блокирует AT1-рецепторы ангиотензина II',severity:'MEDIUM',score:7},
  {a:'magnesium',b:'nebivolol',type:'synergy',effect:'ЧСС + тонус',mechanism:'Mg ↓ тонус сосудов. Небиволол (β1-блокатор + NO) ↓ ЧСС и ↑ NO, расширяя сосуды',severity:'MEDIUM',score:7},
  {a:'taurine',b:'telmisartan',type:'synergy',effect:'Снижение АД',mechanism:'Таурин действует как слабый диуретик и ↓ тонус симпатики. Телмисартан — блокатор AT1. Аддитивный эффект',severity:'MEDIUM',score:6},
  {a:'telmisartan',b:'nebivolol',type:'synergy',effect:'Максимальный ССС-контроль',mechanism:'Сартан + β1-блокатор с NO-модуляцией = аддитивное снижение АД, ЧСС и пост-нагрузки на сердце',severity:'MEDIUM',score:8},
  // Кардио-триада
  {a:'omega3',b:'coq10',type:'synergy',effect:'Кардиотриада: Омега-3 + CoQ10 + Mg',mechanism:'Омега-3 ↓ воспаление и TG. CoQ10 ↑ АТФ миокарда. Mg ↓ аритмии и АД. Три точки воздействия на ССС',severity:'MEDIUM',score:8},

  // ═══════════════════════════════════════════════════════════════════
  // ГОРМОНАЛЬНАЯ ОСЬ (6 препаратов)
  // ═══════════════════════════════════════════════════════════════════
  {a:'zinc',b:'magnesium',type:'synergy',effect:'Синтез T + качество сна',mechanism:'Zn — кофактор 17β-HSD и AR, Mg ↓ связанный T через SHBG. Вместе ↑ свободный T',severity:'MEDIUM',score:7},
  {a:'zinc',b:'vitamin_d3',type:'synergy',effect:'Иммунитет + T',mechanism:'Zn — кофактор синтеза T и пролиферации T-клеток. D3 — VDR-активация, ↔ синтез T в клетках Лейдига',severity:'MEDIUM',score:7},
  {a:'zinc',b:'boron',type:'synergy',effect:'Свободный тестостерон',mechanism:'Бор ↓ SHBG на 15-30%, освобождая T. Zn — кофактор синтеза T. Вместе ↑ и синтез, и доступность T',severity:'MEDIUM',score:7},
  {a:'zinc',b:'ashwagandha',type:'synergy',effect:'Тестостерон + кортизол',mechanism:'Zn для синтеза T (17β-HSD). Ашваганда ↓ кортизол на 20-30%. ↑ T через ↓ кортизол и ↑ синтез',severity:'MEDIUM',score:7},
  {a:'zinc',b:'selenium',type:'synergy',effect:'Простата + репродукция',mechanism:'Zn — антиоксидант в ткани простаты. Se — GPx для защиты сперматозоидов от окисления',severity:'MEDIUM',score:6},
  {a:'vitamin_d3',b:'magnesium',type:'synergy',effect:'Активация D3',mechanism:'Mg необходим для 3 этапов: 25-гидроксилазы (D3→25-OH) и 1α-гидроксилазы (25-OH→кальцитриол)',severity:'HIGH',score:8},
  {a:'vitamin_d3',b:'vitamin_k2',type:'synergy',effect:'Кальциевый обмен',mechanism:'D3 ↑ всасывание Ca в кишечнике. K2 активирует остеокальцин (кости) и MGP (сосуды), направляя Ca в кости',severity:'HIGH',score:9},
  {a:'vitamin_d3',b:'boron',type:'synergy',effect:'Метаболизм D3 + T',mechanism:'Бор улучшает метаболизм D3 и поддерживает уровень свободного T через ↓ SHBG',severity:'LOW',score:5},
  {a:'vitamin_d3',b:'calcium',type:'synergy',effect:'Костная плотность',mechanism:'D3 ↑ всасывание Ca в 2-4 раза через кальций-связывающий белок. Без D3 Ca не усваивается',severity:'HIGH',score:9},
  {a:'vitamin_k2',b:'calcium',type:'synergy',effect:'Направление Ca в кости',mechanism:'K2 активирует остеокальцин, который связывает Ca в кристаллы гидроксиапатита костной ткани',severity:'HIGH',score:8},
  {a:'boron',b:'ashwagandha',type:'synergy',effect:'↑ T через 2 пути',mechanism:'Бор ↓ SHBG (↑ своб.T). Ашваганда ↓ кортизол (↑ T). Два независимых пути повышения андрогенов',severity:'MEDIUM',score:7},
  // Гормональная триада
  {a:'zinc',b:'magnesium',type:'synergy',effect:'Триада T: Zn + Mg + D3',mechanism:'Zn → синтез T. Mg → ↓ SHBG. D3 → VDR → Leydig. Три точки для максимального эндогенного T',severity:'MEDIUM',score:8},
  {a:'zinc',b:'ashwagandha',type:'synergy',effect:'Тотальный контроль гормонов',mechanism:'Zn + Mg + D3 + Ashwagandha. ↑ T, ↓ кортизол, ↑ свободный T, ↑ чувствительность рецепторов',severity:'MEDIUM',score:8},

  // ═══════════════════════════════════════════════════════════════════
  // НЕРВНАЯ СИСТЕМА (6 препаратов)
  // ═══════════════════════════════════════════════════════════════════
  {a:'magnesium',b:'vitamin_b6',type:'synergy',effect:'Усвоение Mg и ГАМК',mechanism:'B6 усиливает транспорт Mg внутрь клеток (особенно нейронов). Mg и B6 — кофакторы синтеза ГАМК. Дуэт для сна и нервов',severity:'MEDIUM',score:7},
  {a:'magnesium',b:'glycine',type:'synergy',effect:'Сон и расслабление',mechanism:'Mg ↓ возбудимость NMDA + ↑ GABA. Глицин — тормозной нейромедиатор через GlyR. Синергия тормозной системы',severity:'MEDIUM',score:7},
  {a:'magnesium',b:'taurine',type:'synergy',effect:'GABA-ергическая синергия',mechanism:'Mg — кофактор GAD (синтез ГАМК). Таурин — прямой агонист GABA-A рецепторов. Оба ↓ тревожность',severity:'MEDIUM',score:7},
  {a:'vitamin_b6',b:'vitamin_b12',type:'synergy',effect:'Нейромедиаторы + миелин',mechanism:'B6 — кофактор AADC и GAD (синтез дофамина, серотонина, ГАМК). B12 — синтез миелина. Полная нейро-поддержка',severity:'HIGH',score:8},
  {a:'vitamin_b6',b:'folate',type:'synergy',effect:'Метилирование + нейро',mechanism:'B6 и фолат — кофакторы цикла метилирования (SAM). SAM → синтез креатина, карнитина, нейромедиаторов',severity:'HIGH',score:8},
  {a:'vitamin_b12',b:'folate',type:'synergy',effect:'Метилирование',mechanism:'B12 и фолат — кофакторы метионинсинтазы (гомоцистеин→метионин). Снижают гомоцистеин, ↑ SAM',severity:'HIGH',score:9},
  {a:'vitamin_b12',b:'vitamin_b6',type:'synergy',effect:'Снижение гомоцистеина',mechanism:'Триада B12 + B6 + фолат — клинический стандарт снижения гомоцистеина, фактора риска ССЗ и когнитивных нарушений',severity:'HIGH',score:8},
  // Нейро-триада
  {a:'magnesium',b:'vitamin_b6',type:'synergy',effect:'Нейро-триада: Mg + B6 + B12',mechanism:'Mg → GABA. B6 → дофамин/серотонин. B12 → миелин. Полная поддержка нервной системы',severity:'MEDIUM',score:8},

  // ═══════════════════════════════════════════════════════════════════
  // КОСТИ + СУСТАВЫ (6 препаратов)
  // ═══════════════════════════════════════════════════════════════════
  {a:'vitamin_c',b:'collagen',type:'synergy',effect:'Синтез коллагена',mechanism:'Вит.C (аскорбат) — кофактор пролилгидроксилазы и лизилгидроксилазы. Без вит.C коллаген не синтезируется (цинга)',severity:'HIGH',score:9},
  {a:'vitamin_c',b:'glucosamine',type:'synergy',effect:'Суставная защита',mechanism:'Вит.C стимулирует синтез коллагена хряща. Глюкозамин — субстрат для синтеза протеогликанов',severity:'MEDIUM',score:7},
  {a:'collagen',b:'glucosamine',type:'synergy',effect:'Матрикс хряща',mechanism:'Коллаген (тип II) — структурный каркас. Глюкозамин — стимуляция синтеза протеогликанов и коллагена хондроцитами',severity:'MEDIUM',score:7},
  {a:'collagen',b:'msm',type:'synergy',effect:'Структура соединительной ткани',mechanism:'Коллаген даёт аминокислоты (глицин, пролин, гидроксипролин). MSM — сера для дисульфидных связей коллагена',severity:'MEDIUM',score:7},
  {a:'collagen',b:'vitamin_c',type:'synergy',effect:'Синтез коллагена (полный)',mechanism:'Вит.C — кофактор. Коллаген — субстрат. Без них: ломкость сосудов, слабость связок, плохое заживление',severity:'HIGH',score:9},
  {a:'glucosamine',b:'chondroitin',type:'synergy',effect:'Суставная пара №1',mechanism:'Глюкозамин стимулирует синтез протеогликанов. Хондроитин ↓ деградацию хряща и ↑ смазку суставов. Клинически подтверждено',severity:'HIGH',score:9},
  {a:'glucosamine',b:'msm',type:'synergy',effect:'Противовоспалительная пара',mechanism:'Глюкозамин + MSM = снижение боли и воспаления в суставах. MSM ↓ NF-kB и ↑ глутатион',severity:'MEDIUM',score:7},
  // Суставная триада
  {a:'collagen',b:'glucosamine',type:'synergy',effect:'Суставная триада',mechanism:'Коллаген (каркас) + глюкозамин (синтез) + вит.C (кофактор) + MSM (сера) = полный суставной комплекс',severity:'HIGH',score:9},

  // ═══════════════════════════════════════════════════════════════════
  // ИММУНИТЕТ (5 препаратов)
  // ═══════════════════════════════════════════════════════════════════
  {a:'vitamin_c',b:'zinc',type:'synergy',effect:'Иммунный дуэт',mechanism:'Вит.C ↑ хемотаксис нейтрофилов и апоптоз. Zn ↑ пролиферацию T-клеток и активность NK. Критическая пара',severity:'MEDIUM',score:7},
  {a:'vitamin_d3',b:'zinc',type:'synergy',effect:'Иммунитет + T',mechanism:'D3 модулирует Th1/Th2 баланс и ↓ воспаление. Zn — кофактор тимулина и T-клеток. Оба ↑ T',severity:'MEDIUM',score:7},
  {a:'probiotics',b:'vitamin_d3',type:'synergy',effect:'Иммунитет кишечника',mechanism:'Пробиотики → бактериальный барьер + IgA. D3 → кателицидин + β-дефенсин. Комплексная защита слизистых',severity:'MEDIUM',score:7},
  {a:'probiotics',b:'prebiotics',type:'synergy',effect:'Синбиотик',mechanism:'Пребиотики (клетчатка, инулин) — питание для пробиотиков. Вместе эффективность выше на 50-100%',severity:'HIGH',score:9},
  {a:'probiotics',b:'glutamine',type:'synergy',effect:'Кишечный барьер',mechanism:'Глютамин — питание энтероцитов (↑ ворсинки). Пробиотики — микробиом (↑ барьер + IgA). Вместе ↓ проницаемость',severity:'MEDIUM',score:7},

  // ═══════════════════════════════════════════════════════════════════
  // КРОВЬ (5 препаратов)
  // ═══════════════════════════════════════════════════════════════════
  {a:'iron',b:'vitamin_c',type:'synergy',effect:'Всасывание Fe',mechanism:'Вит.C восстанавливает Fe3+→Fe2+ в кишечнике. Увеличивает абсорбцию в 3-6 раз. Клинический стандарт при анемии',severity:'HIGH',score:9},
  {a:'iron',b:'copper',type:'synergy',effect:'Транспорт Fe',mechanism:'Cu — кофактор церулоплазмина, который окисляет Fe2+→Fe3+ для включения в трансферрин. Без Cu Fe не транспортируется',severity:'MEDIUM',score:7},
  {a:'iron',b:'folate',type:'synergy',effect:'Эритропоэз',mechanism:'Fe — гемоглобин. Фолат — синтез ДНК в эритробластах. Оба кофакторы продукции эритроцитов',severity:'MEDIUM',score:7},
  {a:'iron',b:'vitamin_b12',type:'synergy',effect:'Эритропоэз',mechanism:'Fe — гем. B12 — синтез ДНК в эритробластах. Дефицит B12 → мегалобластная анемия',severity:'MEDIUM',score:7},
  {a:'folate',b:'vitamin_b12',type:'synergy',effect:'Гемопоэз',mechanism:'Фолат и B12 — кофакторы синтеза тимидилата и ДНК. Критическая пара для деления клеток костного мозга',severity:'HIGH',score:9},

  // ═══════════════════════════════════════════════════════════════════
  // STRESS / SLEEP (3 препарата)
  // ═══════════════════════════════════════════════════════════════════
  {a:'ashwagandha',b:'magnesium',type:'synergy',effect:'Стресс + сон',mechanism:'Ашваганда ↓ кортизол на 20-30% через HPA-ось. Mg ↓ возбудимость NMDA+↑ GABA. Полный контроль стресса',severity:'HIGH',score:8},
  {a:'ashwagandha',b:'glycine',type:'synergy',effect:'Расслабление ЦНС',mechanism:'Ашваганда ↓ кортизол и ↑ GABA. Глицин — тормозной нейромедиатор. Синергия седативного эффекта',severity:'MEDIUM',score:6},
  {a:'glycine',b:'magnesium',type:'synergy',effect:'Сон',mechanism:'Глицин ↓ температуру тела и ↑ качество сна. Mg ↓ кортизол и ↑ GABA. Вместе — мощная пара для сна',severity:'MEDIUM',score:7},

  // ═══════════════════════════════════════════════════════════════════
  // КОНФЛИКТЫ
  // ═══════════════════════════════════════════════════════════════════
  {a:'zinc',b:'copper',type:'conflict',effect:'Антагонизм Zn/Cu',mechanism:'Высокие дозы Zn (50+ мг) индуцируют металлотионеин, связывающий Cu. → дефицит Cu при длит.приёме. Соотношение Zn:Cu = 10:1',severity:'HIGH',score:8},
  {a:'zinc',b:'iron',type:'conflict',effect:'Конкуренция за DMT1',mechanism:'Zn и Fe конкурируют за общий транспортёр DMT1 в энтероцитах. Интервал приёма ≥ 2ч',severity:'MEDIUM',score:6},
  {a:'iron',b:'calcium',type:'conflict',effect:'Блокада Fe Ca',mechanism:'Ca блокирует DMT1-транспортёр Fe в кишечнике. Не принимать вместе. Интервал ≥ 2ч',severity:'MEDIUM',score:7},
  {a:'iron',b:'magnesium',type:'conflict',effect:'Конкуренция',mechanism:'Fe и Mg конкурируют за всасывание в тонком кишечнике. Интервал 1-2ч',severity:'MEDIUM',score:5},
  {a:'magnesium',b:'calcium',type:'conflict',effect:'Конкуренция за транспорт',mechanism:'Mg и Ca конкурируют за общие транспортёры. Принимать раздельно с интервалом 1-2ч',severity:'LOW',score:4},
  {a:'vitamin_k2',b:'anticoagulants',type:'conflict',effect:'Антагонизм с варфарином',mechanism:'K2 активирует факторы свёртывания (II,VII,IX,X). Варфарин их блокирует. K2 ↓ эффективность варфарина',severity:'HIGH',score:9},
  {a:'curcumin',b:'anticoagulants',type:'conflict',effect:'Усиление антикоагуляции',mechanism:'Куркумин ↓ агрегацию тромбоцитов через ингибирование тромбоксана. Усиливает эффект антикоагулянтов',severity:'MEDIUM',score:7},
  {a:'curcumin',b:'iron',type:'conflict',effect:'Хелация железа',mechanism:'Куркумин хелатирует Fe3+, снижая его всасывание. Полезно при гемохроматозе, вредно при анемии',severity:'MEDIUM',score:6},
  {a:'coq10',b:'warfarin',type:'conflict',effect:'↓ антикоагуляции',mechanism:'CoQ10 структурно похож на вит.K, может снижать антикоагулянтный эффект варфарина',severity:'MEDIUM',score:6},
  {a:'vitamin_e',b:'anticoagulants',type:'conflict',effect:'↑ риск кровотечений',mechanism:'Высокие дозы вит.E (>600 МЕ) ↓ агрегацию тромбоцитов через протеинкиназу C',severity:'MEDIUM',score:6},
  {a:'aspirin',b:'anticoagulants',type:'conflict',effect:'Риск ЖК-кровотечения',mechanism:'Аспирин (необратимая блокада COX-1) + антикоагулянты = высокий риск желудочно-кишечных кровотечений',severity:'HIGH',score:9},
  {a:'aspirin',b:'ibuprofen',type:'conflict',effect:'ЖКТ-токсичность',mechanism:'НПВС + аспирин = синергия ульцерогенного эффекта → язва желудка',severity:'HIGH',score:8},
  {a:'probiotics',b:'antibiotics',type:'conflict',effect:'Уничтожение пробиотиков',mechanism:'Антибиотики широкого спектра убивают живые штаммы пробиотиков. Интервал приёма ≥ 3ч',severity:'HIGH',score:8},
  {a:'berberine',b:'cyp3a4_substrates',type:'conflict',effect:'Ингибитор CYP3A4',mechanism:'Берберин подавляет CYP3A4 → ↑ концентрация многих ЛС (статины, бензодиазепины, антидепрессанты). Осторожно!',severity:'HIGH',score:8},
  {a:'berberine',b:'antidiabetic_drugs',type:'conflict',effect:'Гипогликемия',mechanism:'Берберин (AMPK) + гипогликемические → риск гипогликемии. Контроль сахара',severity:'MEDIUM',score:7},
  {a:'ashwagandha',b:'thyroid_drugs',type:'conflict',effect:'↑ T3/T4',mechanism:'Ашваганда ↑ конверсию T4→T3, усиливая эффект тиреоидных гормонов',severity:'MEDIUM',score:6},
  {a:'telmisartan',b:'potassium_supplements',type:'conflict',effect:'Гиперкалиемия',mechanism:'Телмисартан ↓ экскрецию K+ почками → риск гиперкалиемии с K-добавками',severity:'MEDIUM',score:7},
  {a:'telmisartan',b:'nsaid_drugs',type:'conflict',effect:'↓ гипотензивного эффекта',mechanism:'НПВС блокируют синтез простагландинов, снижая гипотензивный эффект сартанов',severity:'MEDIUM',score:6},
  {a:'nebivolol',b:'verapamil',type:'conflict',effect:'Брадикардия',mechanism:'β1-блокатор + верапамил (Ca-блокатор) → риск тяжёлой брадикардии и AV-блокады',severity:'HIGH',score:9},
  {a:'omega3',b:'anticoagulants',type:'conflict',effect:'↑ риска кровотечений',mechanism:'Высокие дозы Омега-3 (>4г/д) ↓ агрегацию тромбоцитов → ↑ риск с антикоагулянтами',severity:'MEDIUM',score:6},
];
