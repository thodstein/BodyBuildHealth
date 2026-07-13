export type DrugSupInteraction = { drug: string; substance: string; effect: string; severity: string; mechanism: string };

export const KNOWN_DRUG_SUP_INTERACTIONS: Array<{ drug: string; substance: string; effect: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; mechanism: string }> = [
  // ── АНТИКОАГУЛЯНТЫ / АНТИАГРЕГАНТЫ ──
  { drug: 'варфарин', substance: 'natto', effect: 'Усиление антикоагуляции, риск кровотечений', severity: 'HIGH', mechanism: 'Синергизм фибринолиза' },
  { drug: 'варфарин', substance: 'vitamin_k2', effect: 'Снижение антикоагуляции, риск тромбозов', severity: 'HIGH', mechanism: 'Антагонизм витамин К-зависимых факторов' },
  { drug: 'варфарин', substance: 'vitamin_e', effect: 'Усиление антикоагуляции', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект токоферола' },
  { drug: 'варфарин', substance: 'omega3', effect: 'Умеренное усиление антикоагуляции', severity: 'MEDIUM', mechanism: 'Снижение агрегации тромбоцитов через TXA2' },
  { drug: 'клопидогрель', substance: 'omega3', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Синергизм подавления агрегации' },
  { drug: 'клопидогрель', substance: 'curcumin', effect: 'Риск кровотечений, снижение активации пролекарства', severity: 'MEDIUM', mechanism: 'Антиагрегантный + ингибирование CYP2C19' },
  { drug: 'аспирин', substance: 'omega3', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Синергизм циклооксигеназного пути' },
  { drug: 'аспирин', substance: 'natto', effect: 'Риск кровотечений', severity: 'HIGH', mechanism: 'Двойная антиагрегантная терапия' },
  { drug: 'аспирин', substance: 'curcumin', effect: 'Усиление антиагрегантного и гастропротективного эффекта', severity: 'MEDIUM', mechanism: 'Антиагрегантный (COX + TXA2)' },
  { drug: 'апиксабан', substance: 'natto', effect: 'Риск кровотечений', severity: 'HIGH', mechanism: 'Синергизм антикоагуляции (Xa фактор)' },
  { drug: 'апиксабан', substance: 'curcumin', effect: 'Риск кровотечений (высокие дозы >1 г/сут)', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект куркумина' },
  { drug: 'дабигатран', substance: 'omega3', effect: 'Потенцирование антикоагуляции', severity: 'MEDIUM', mechanism: 'Снижение агрегации тромбоцитов' },

  // Протеолитические ферменты (серрапептаза/бромелайн) + антикоагулянты/антиагреганты
  { drug: 'варфарин', substance: 'serrapeptase', effect: 'Риск кровотечений (усиление фибринолиза)', severity: 'HIGH', mechanism: 'Серрапептаза расщепляет фибрин → аддитивно к варфарину' },
  { drug: 'варфарин', substance: 'bromelain', effect: 'Риск кровотечений (ингибирование агрегации)', severity: 'HIGH', mechanism: 'Бромелайн разрушает фибриноген и агрегацию тромбоцитов' },
  { drug: 'аспирин', substance: 'serrapeptase', effect: 'Двойной антиагрегантный эффект, риск кровотечений', severity: 'HIGH', mechanism: 'Серрапептаза + аспирин → суммация антитромботического' },
  { drug: 'аспирин', substance: 'bromelain', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Бромелайн потенцирует ингибирование агрегации' },
  { drug: 'клопидогрель', substance: 'serrapeptase', effect: 'Риск кровотечений (суммация фибринолиза)', severity: 'MEDIUM', mechanism: 'Серрапептаза + P2Y12-блокада' },
  { drug: 'клопидогрель', substance: 'bromelain', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Бромелайн + блокада P2Y12' },
  { drug: 'апиксабан', substance: 'serrapeptase', effect: 'Риск кровотечений', severity: 'HIGH', mechanism: 'Серрапептаза + ингибитор Xa фактора' },
  { drug: 'апиксабан', substance: 'bromelain', effect: 'Риск кровотечений', severity: 'MEDIUM', mechanism: 'Бромелайн + ингибитор Xa фактора' },

  // ── СТАТИНЫ ──
  { drug: 'аторвастатин', substance: 'coq10', effect: 'Снижение миалгий и миопатии от статинов', severity: 'LOW', mechanism: 'Восполнение CoQ10, подавляемого статинами' },
  { drug: 'аторвастатин', substance: 'берберин', effect: 'Дополнительное снижение ЛПНП (аддитивный эффект)', severity: 'MEDIUM', mechanism: 'AMPK + снижение синтеза холестерина (SREBP)' },
  { drug: 'аторвастатин', substance: 'red_yeast', effect: 'СУММАЦИЯ ТОКСИЧНОСТИ: гепатотоксичность, рабдомиолиз', severity: 'HIGH', mechanism: 'Дублирование ингибирования HMG-CoA редуктазы' },
  { drug: 'аторвастатин', substance: 'naringin', effect: 'Повышение концентрации статинов (риск миопатии)', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4 метаболизма статинов' },
  { drug: 'розувастатин', substance: 'vitamin_d3', effect: 'Улучшение липидного профиля (аддитивный эффект)', severity: 'LOW', mechanism: 'VDR-опосредованная регуляция липидов' },

  // ── МЕТФОРМИН И САХАРОСНИЖАЮЩИЕ ──
  { drug: 'метформин', substance: 'берберин', effect: 'Гипогликемия, суммация эффекта', severity: 'MEDIUM', mechanism: 'AMPK-активация + снижение глюконеогенеза' },
  { drug: 'метформин', substance: 'alpha_lipoic', effect: 'Синергизм чувствительности к инсулину', severity: 'LOW', mechanism: 'Активация AMPK + Nrf2 + снижение окислительного стресса' },
  { drug: 'метформин', substance: 'b12', effect: 'Метформин снижает всасывание B12 — требуется добавка', severity: 'MEDIUM', mechanism: 'Конкурентное ингибирование IF-зависимого всасывания' },
  { drug: 'метформин', substance: 'folate', effect: 'Метформин снижает фолат — требуется мониторинг', severity: 'MEDIUM', mechanism: 'Нарушение фолатного цикла' },
  { drug: 'инсулин', substance: 'alpha_lipoic', effect: 'Улучшение чувствительности к инсулину, риск гипогликемии', severity: 'MEDIUM', mechanism: 'Активация AMPK + GLUT4 транслокация' },
  { drug: 'инсулин', substance: 'хром', effect: 'Потенцирование действия инсулина, риск гипогликемии', severity: 'MEDIUM', mechanism: 'Хром — кофактор инсулинового рецептора' },
  { drug: 'SGLT2 (глифлозины)', substance: 'берберин', effect: 'Суммация сахароснижающего эффекта', severity: 'MEDIUM', mechanism: 'AMPK + глюкозурия' },
  { drug: 'GLP-1 (агонисты)', substance: 'берберин', effect: 'Суммация снижения глюкозы, риск гипогликемии', severity: 'MEDIUM', mechanism: 'AMPK + инкретиновый эффект' },
  { drug: 'GLP-1 (агонисты)', substance: 'хром', effect: 'Улучшение гликемического контроля', severity: 'LOW', mechanism: 'Повышение чувствительности к инкретинам' },

  // ── ЛЕВОТИРОКСИН ──
  { drug: 'левтироксин', substance: 'calcium', effect: 'Снижение всасывания левотироксина (интервал >4 ч)', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'magnesium', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'zinc', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'selenium', effect: 'Улучшение конверсии T4→T3', severity: 'LOW', mechanism: 'Селеносодержащие дейодиназы' },
  { drug: 'левтироксин', substance: 'железо', effect: 'Снижение всасывания левотироксина (интервал >4 ч)', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },

  // ── АНТИДЕПРЕССАНТЫ (СИОЗС, СИОЗСиН, ИМАО) ──
  { drug: 'эсциталопрам (СИОЗС)', substance: '5htp', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ (жизнеугрожающее состояние)', severity: 'HIGH', mechanism: 'Суммация серотонинергического эффекта (5-HT)' },
  { drug: 'эсциталопрам (СИОЗС)', substance: 'l_tryptophan', effect: 'Серотониновый синдром', severity: 'HIGH', mechanism: 'Избыточный синтез 5-HT через триптофан' },
  { drug: 'эсциталопрам (СИОЗС)', substance: 'saint_johns_wort', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ + снижение концентрации СИОЗС', severity: 'HIGH', mechanism: 'Серотонинергическая суммация + индукция CYP3A4/2C9' },
  { drug: 'эсциталопрам (СИОЗС)', substance: 'theanine', effect: 'Потенцирование седативного эффекта', severity: 'LOW', mechanism: 'GABA-ергический синергизм' },
  { drug: 'эсциталопрам (СИОЗС)', substance: 'gaba', effect: 'Усиление седации', severity: 'LOW', mechanism: 'GABA-ергический синергизм' },
  { drug: 'СИОЗСиН (венлафаксин)', substance: '5htp', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ (высокий риск)', severity: 'HIGH', mechanism: 'Суммация 5-HT + NA' },
  { drug: 'СИОЗСиН (дулоксетин)', substance: '5htp', effect: 'Серотониновый синдром', severity: 'HIGH', mechanism: 'Суммация 5-HT и NA' },
  { drug: 'ИМАО', substance: '5htp', effect: 'ГИПЕРТОНИЧЕСКИЙ КРИЗ + СЕРОТОНИНОВЫЙ СИНДРОМ (летально)', severity: 'HIGH', mechanism: 'Ингибирование MAO + избыток 5-HT' },
  { drug: 'ИМАО', substance: 'tyramine', effect: 'Гипертонический криз (тираминовая реакция)', severity: 'HIGH', mechanism: 'Накопление тирамина при ингибировании MAO-A' },

  // ── АНТИГИПЕРТЕНЗИВНЫЕ (иАПФ, АРА, БКК, β-блокаторы) ──
  { drug: 'иАПФ (рамиприл)', substance: 'potassium', effect: 'Риск гиперкалиемии', severity: 'MEDIUM', mechanism: 'Снижение экскреции K+ (альдостерон ↓)' },
  { drug: 'иАПФ (рамиприл)', substance: 'magnesium', effect: 'Дополнительное снижение АД', severity: 'LOW', mechanism: 'Вазодилатация + блокада Ca-каналов' },
  { drug: 'АРА (лозартан)', substance: 'potassium', effect: 'Риск гиперкалиемии', severity: 'MEDIUM', mechanism: 'Блокада AT1-рецепторов → альдостерон ↓' },
  { drug: 'АРА (лозартан)', substance: 'magnesium', effect: 'Умеренное снижение АД', severity: 'LOW', mechanism: 'Вазодилатация' },
  { drug: 'β-блокаторы (бисопролол)', substance: 'coq10', effect: 'Уменьшение утомляемости и слабости', severity: 'LOW', mechanism: 'Восполнение митохондриального CoQ10' },
  { drug: 'β-блокаторы (бисопролол)', substance: 'magnesium', effect: 'Усиление брадикардии', severity: 'MEDIUM', mechanism: 'Синергизм снижения ЧСС' },
  { drug: 'БКК (амлодипин)', substance: 'magnesium', effect: 'Избыточное снижение АД, брадикардия', severity: 'MEDIUM', mechanism: 'Синергизм блокады Ca-каналов' },
  { drug: 'БКК (амлодипин)', substance: 'potassium', effect: 'Умеренная брадикардия (аддитивный эффект)', severity: 'LOW', mechanism: 'Калий — мембранный стабилизатор' },
  { drug: 'БКК (верапамил)', substance: 'magnesium', effect: 'ВЫРАЖЕННАЯ БРАДИКАРДИЯ, риск блокады', severity: 'HIGH', mechanism: 'Синергизм блокады Ca-каналов и AV-проводимости' },

  // ── ДИУРЕТИКИ ──
  { drug: 'тиазидные (гидрохлоротиазид)', substance: 'potassium', effect: 'Восполнение калия, профилактика гипокалиемии', severity: 'LOW', mechanism: 'Возмещение потерь K+' },
  { drug: 'тиазидные (гидрохлоротиазид)', substance: 'magnesium', effect: 'Восполнение магния, профилактика аритмий', severity: 'LOW', mechanism: 'Возмещение потерь Mg' },
  { drug: 'петлевые (фуросемид)', substance: 'potassium', effect: 'Восполнение калия при потере с мочой', severity: 'LOW', mechanism: 'Возмещение потерь K+' },
  { drug: 'петлевые (фуросемид)', substance: 'magnesium', effect: 'Восполнение магния, профилактика аритмий', severity: 'LOW', mechanism: 'Возмещение потерь Mg' },
  { drug: 'калийсберегающие (спиронолактон)', substance: 'potassium', effect: 'ГИПЕРКАЛИЕМИЯ', severity: 'HIGH', mechanism: 'Блокада альдостерона + суммация K+' },
  { drug: 'калийсберегающие (спиронолактон)', substance: 'zinc', effect: 'Снижение цинка (антиандрогенный эффект)', severity: 'LOW', mechanism: 'Антагонизм андрогеновых рецепторов' },

  // ── ДРУГИЕ СЕРДЕЧНО-СОСУДИСТЫЕ ──
  { drug: 'амиодарон', substance: 'coq10', effect: 'Защита митохондрий и щитовидной железы', severity: 'LOW', mechanism: 'Восполнение CoQ10, снижаемого амиодароном' },
  { drug: 'амиодарон', substance: 'magnesium', effect: 'Снижение риска пируэтной тахикардии (TdP)', severity: 'LOW', mechanism: 'Стабилизация мембран кардиомиоцитов' },
  { drug: 'дигоксин', substance: 'magnesium', effect: 'Снижение риска дигиталисной интоксикации', severity: 'LOW', mechanism: 'Mg — кофактор Na/K-АТФазы' },
  { drug: 'дигоксин', substance: 'potassium', effect: 'Гипокалиемия усиливает токсичность дигоксина', severity: 'HIGH', mechanism: 'K+ конкурентно снижает связывание дигоксина' },
  { drug: 'дигоксин', substance: 'calcium', effect: 'ГИПЕРКАЛЬЦИЕМИЯ УСИЛИВАЕТ ТОКСИЧНОСТЬ ДИГОКСИНА', severity: 'HIGH', mechanism: 'Ca потенцирует инотропный эффект → аритмии' },

  // ── НПВС ──
  { drug: 'НПВС (ибупрофен)', substance: 'curcumin', effect: 'Дополнительное противовоспалительное, защита ЖКТ', severity: 'LOW', mechanism: 'Ингибирование NF-kB + COX-2 (селективное)' },
  { drug: 'НПВС (диклофенак)', substance: 'curcumin', effect: 'Усиление антикоагуляции (высокие дозы >1 г)', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект куркумина' },
  { drug: 'НПВС (ибупрофен)', substance: 'omega3', effect: 'Аддитивное противовоспалительное действие', severity: 'LOW', mechanism: 'Снижение синтеза PGE2 и лейкотриенов' },

  // ── ИММУНОСУПРЕССОРЫ ──
  { drug: 'циклоспорин', substance: 'curcumin', effect: 'Повышение концентрации циклоспорина', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4 и P-гликопротеина' },
  { drug: 'циклоспорин', substance: 'берберин', effect: 'Повышение концентрации циклоспорина', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4' },
  { drug: 'циклоспорин', substance: 'magnesium', effect: 'Восполнение Mg, снижаемого циклоспорином', severity: 'LOW', mechanism: 'Ренальные потери Mg' },
  { drug: 'такролимус', substance: 'curcumin', effect: 'Повышение концентрации такролимуса', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4 и P-gp' },
  { drug: 'такролимус', substance: 'берберин', effect: 'Повышение концентрации такролимуса', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4' },
  { drug: 'метотрексат', substance: 'folate', effect: 'Снижение токсичности метотрексата (гепато-, гемато-)', severity: 'LOW', mechanism: 'Обход блокады DHFR (фолиевая кислота)' },

  // ── ПРОТИВОЭПИЛЕПТИЧЕСКИЕ ──
  { drug: 'вальпроат', substance: 'l_carnitine', effect: 'Профилактика вальпроат-индуцированной гепатотоксичности', severity: 'LOW', mechanism: 'Коррекция вторичного дефицита карнитина' },
  { drug: 'вальпроат', substance: 'folate', effect: 'Снижение риска дефектов нервной трубки (для планирующих)', severity: 'MEDIUM', mechanism: 'Антагонизм фолатного цикла вальпроатом' },
  { drug: 'вальпроат', substance: 'biotin', effect: 'Дефицит биотина на фоне вальпроата', severity: 'LOW', mechanism: 'Ингибирование биотинидазы' },
  { drug: 'карбамазепин', substance: 'biotin', effect: 'Дефицит биотина', severity: 'LOW', mechanism: 'Ускорение катаболизма биотина' },
  { drug: 'карбамазепин', substance: 'vitamin_d3', effect: 'Дефицит D3 на фоне карбамазепина', severity: 'MEDIUM', mechanism: 'Индукция CYP450 → ускорение метаболизма D3' },
  { drug: 'карбамазепин', substance: 'folate', effect: 'Дефицит фолата на фоне приёма (требуется добавка)', severity: 'MEDIUM', mechanism: 'Индукция ферментов фолатного цикла' },
  { drug: 'топирамат', substance: 'potassium', effect: 'Риск гипокалиемии и метаболического ацидоза', severity: 'MEDIUM', mechanism: 'Ингибирование карбоангидразы → потери K+' },
  { drug: 'топирамат', substance: 'bicarbonate', effect: 'Метаболический ацидоз на фоне топирамата', severity: 'MEDIUM', mechanism: 'Ингибирование карбоангидразы → ↓ HCO3' },

  // ── ПСИХОТРОПНЫЕ (АНТИПСИХОТИКИ, БЕНЗОДИАЗЕПИНЫ) ──
  { drug: 'оланзапин', substance: 'melatonin', effect: 'Частичная коррекция метаболических нарушений', severity: 'LOW', mechanism: 'Антиоксидантный эффект мелатонина' },
  { drug: 'оланзапин', substance: 'coq10', effect: 'Уменьшение висцерального жира (предв. данные)', severity: 'LOW', mechanism: 'Митохондриальная поддержка' },
  { drug: 'бензодиазепины', substance: 'theanine', effect: 'Чрезмерная седация, потенцирование', severity: 'MEDIUM', mechanism: 'GABA-ергический синергизм (↑ Cl⁻ ток)' },
  { drug: 'бензодиазепины', substance: 'gaba', effect: 'Чрезмерная седация', severity: 'MEDIUM', mechanism: 'Суммация GABA-ергического торможения' },
  { drug: 'бензодиазепины', substance: 'melatonin', effect: 'Избыточная седация (аддитивный эффект)', severity: 'MEDIUM', mechanism: 'Разные пути торможения ЦНС' },
  { drug: 'Z-гипнотики (золпидем)', substance: 'melatonin', effect: 'Избыточная седация', severity: 'MEDIUM', mechanism: 'Агонисты разных рецепторов сна' },

  // ── ПРОТИВОПАРКИНСОНИЧЕСКИЕ ──
  { drug: 'леводопа', substance: 'magnesium', effect: 'Уменьшение дискинезий, снижение всасывания леводопы', severity: 'MEDIUM', mechanism: 'Mg хелатирует леводопу в ЖКТ' },
  { drug: 'леводопа', substance: 'b6', effect: 'Ускорение периферического метаболизма леводопы', severity: 'MEDIUM', mechanism: 'B6 — кофактор DOPA-декарбоксилазы' },

  // ── БРОНХОЛИТИКИ ──
  { drug: 'сальбутамол', substance: 'magnesium', effect: 'Синергизм бронходилатации', severity: 'LOW', mechanism: 'Mg — блокатор Ca-каналов гладкой мускулатуры' },
  { drug: 'сальбутамол', substance: 'potassium', effect: 'Риск гипокалиемии при высоких дозах', severity: 'MEDIUM', mechanism: 'β2-агонист → Na/K-АТФаза → K+ в клетки' },

  // ── АНТИБИОТИКИ ──
  { drug: 'фторхинолоны (ципрофлоксацин)', substance: 'magnesium', effect: 'Снижение всасывания антибиотика (хелатирование)', severity: 'MEDIUM', mechanism: 'Образование нерастворимых хелатов Mg-фторхинолон' },
  { drug: 'фторхинолоны (ципрофлоксацин)', substance: 'calcium', effect: 'Снижение всасывания антибиотика', severity: 'MEDIUM', mechanism: 'Хелатирование Ca' },
  { drug: 'фторхинолоны (ципрофлоксацин)', substance: 'zinc', effect: 'Снижение всасывания антибиотика', severity: 'MEDIUM', mechanism: 'Хелатирование Zn' },
  { drug: 'тетрациклины (доксициклин)', substance: 'magnesium', effect: 'Снижение всасывания антибиотика', severity: 'MEDIUM', mechanism: 'Хелатирование Mg' },
  { drug: 'тетрациклины (доксициклин)', substance: 'calcium', effect: 'Снижение всасывания антибиотика', severity: 'MEDIUM', mechanism: 'Хелатирование Ca' },
  { drug: 'тетрациклины (доксициклин)', substance: 'zinc', effect: 'Снижение всасывания антибиотика', severity: 'MEDIUM', mechanism: 'Хелатирование Zn' },

  // ── БИСФОСФОНАТЫ ──
  { drug: 'алендронат', substance: 'calcium', effect: 'Снижение всасывания бисфосфоната (интервал >1 ч)', severity: 'MEDIUM', mechanism: 'Конкуренция за всасывание в ЖКТ' },
  { drug: 'алендронат', substance: 'magnesium', effect: 'Снижение всасывания бисфосфоната', severity: 'MEDIUM', mechanism: 'Конкуренция за всасывание' },

  // ── ГОРМОНАЛЬНЫЕ (КОНТРАЦЕПТИВЫ, ГКС, АНТИТИРЕОИДНЫЕ) ──
  { drug: 'пероральные контрацептивы', substance: 'magnesium', effect: 'Снижение магния на фоне ОК — требуется коррекция', severity: 'LOW', mechanism: 'Эстроген-индуцированная экскреция Mg' },
  { drug: 'пероральные контрацептивы', substance: 'b6', effect: 'Дефицит B6 на фоне ОК (снижение настроения)', severity: 'LOW', mechanism: 'Ускорение метаболизма пиридоксина' },
  { drug: 'пероральные контрацептивы', substance: 'folate', effect: 'Снижение фолата — требуется добавка', severity: 'LOW', mechanism: 'Нарушение фолатного цикла' },
  { drug: 'глюкокортикоиды (преднизолон)', substance: 'calcium', effect: 'Профилактика стероидного остеопороза', severity: 'LOW', mechanism: 'Снижение резорбции кости' },
  { drug: 'глюкокортикоиды (преднизолон)', substance: 'vitamin_d3', effect: 'Профилактика стероидного остеопороза', severity: 'LOW', mechanism: 'Абсорбция Ca + минерализация' },
  { drug: 'глюкокортикоиды (преднизолон)', substance: 'potassium', effect: 'Восполнение K+ (ГКС усиливают экскрецию)', severity: 'LOW', mechanism: 'Минералокортикоидная активность' },
  { drug: 'мерказолил (тиреостатики)', substance: 'selenium', effect: 'Синергизм в контроле антитиреоидных АТ', severity: 'LOW', mechanism: 'Селен — кофактор дейодиназ и антиоксидант ЩЖ' },
  { drug: 'бигуаниды', substance: 'selenium', effect: 'Защита щитовидной железы на фоне приёма', severity: 'LOW', mechanism: 'Антиоксидантная защита тиреоцитов' },

  // ── РЕСПИРАТОРНЫЕ ──
  { drug: 'теофиллин', substance: 'magnesium', effect: 'Синергизм бронходилатации', severity: 'LOW', mechanism: 'Mg — блокатор Ca-каналов гладкой мускулатуры' },
  { drug: 'теофиллин', substance: 'curcumin', effect: 'Повышение концентрации теофиллина', severity: 'MEDIUM', mechanism: 'Ингибирование CYP1A2' },

  // ── ПРОЧИЕ ──
  { drug: 'ингибиторы протонной помпы', substance: 'magnesium', effect: 'Гипомагниемия на фоне ИПП (длительный приём >1 года)', severity: 'MEDIUM', mechanism: 'Снижение всасывания Mg (↓ кислотность)' },
  { drug: 'ингибиторы протонной помпы', substance: 'b12', effect: 'Дефицит B12 на фоне ИПП (риск нейропатии)', severity: 'MEDIUM', mechanism: 'Снижение высвобождения B12 из белков пищи' },
  { drug: 'ингибиторы протонной помпы', substance: 'folate', effect: 'Снижение всасывания фолатов', severity: 'LOW', mechanism: 'Нарушение конверсии фолатов в кислой среде' },
  { drug: 'трамадол', substance: '5htp', effect: 'Серотониновый синдром (риск судорог)', severity: 'HIGH', mechanism: 'Суммация серотонинергического эффекта' },
  { drug: 'трамадол', substance: 'saint_johns_wort', effect: 'Серотониновый синдром, снижение концентрации трамадола', severity: 'HIGH', mechanism: 'Суммация 5-HT + индукция CYP3A4' },
  { drug: 'прегабалин', substance: 'theanine', effect: 'Чрезмерная седация', severity: 'MEDIUM', mechanism: 'GABA-ергический синергизм' },
  { drug: 'прегабалин', substance: 'gaba', effect: 'Усиление седации и головокружения', severity: 'MEDIUM', mechanism: 'Суммация GABA-ергического эффекта' },
  { drug: 'клозапин', substance: 'curcumin', effect: 'Повышение концентрации клозапина (риск токсичности)', severity: 'MEDIUM', mechanism: 'Ингибирование CYP1A2 и CYP3A4' },
  { drug: 'литий', substance: 'sodium', effect: 'Снижение лития при высоком Na, повышение при низком Na', severity: 'MEDIUM', mechanism: 'Конкуренция за реабсорбцию в почечных канальцах' },
  { drug: 'литий', substance: 'coq10', effect: 'Защита митохондрий почечного эпителия', severity: 'LOW', mechanism: 'Антиоксидантный эффект CoQ10' },
  { drug: 'метадон', substance: 'curcumin', effect: 'Повышение концентрации метадона (риск угнетения дыхания)', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4' },
  { drug: 'бупренорфин', substance: 'curcumin', effect: 'Повышение концентрации бупренорфина', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4' },
  { drug: 'триптаны (суматриптан)', substance: '5htp', effect: 'Серотониновый синдром (риск вазоспазма)', severity: 'HIGH', mechanism: 'Агонисты 5-HT1B/1D + избыток 5-HT' },
  { drug: 'дифенгидрамин', substance: 'melatonin', effect: 'Чрезмерная седация днём', severity: 'LOW', mechanism: 'Антигистаминный + мелатониновый эффект' },
  { drug: 'бетаметазон (топический)', substance: 'vitamin_d3', effect: 'Снижение местного воспаления (аддитивный)', severity: 'LOW', mechanism: 'VDR-опосредованная регуляция иммунитета' },

  // ── ПРОТИВОТУБЕРКУЛЁЗНЫЕ ──
  { drug: 'изониазид', substance: 'b6', effect: 'Профилактика периферической нейропатии (изониазид ↓ B6)', severity: 'MEDIUM', mechanism: 'Конкурентное ингибирование пиридоксалькиназы' },
  { drug: 'изониазид', substance: 'niacin', effect: 'Риск гепатотоксичности (аддитивный)', severity: 'MEDIUM', mechanism: 'Суммация метаболической нагрузки на печень' },
  { drug: 'рифампицин', substance: 'vitamin_d3', effect: 'Дефицит D3 (CYP индукция → ускорение катаболизма)', severity: 'MEDIUM', mechanism: 'Индукция CYP3A4 — ускорение метаболизма D3' },
  { drug: 'рифампицин', substance: 'curcumin', effect: 'Снижение концентрации куркумина (индукция P-gp/CYP)', severity: 'LOW', mechanism: 'Индукция P-гликопротеина и CYP3A4' },

  // ── ОРЛИСТАТ (МАЛЬАБСОРБЦИЯ ЖИРОРАСТВОРИМЫХ) ──
  { drug: 'орлистат', substance: 'vitamin_d3', effect: 'Снижение всасывания D3 (блокада панкреатической липазы)', severity: 'MEDIUM', mechanism: 'Орлистат блокирует гидролиз жиров → ↓ D3' },
  { drug: 'орлистат', substance: 'vitamin_k2', effect: 'Снижение всасывания витамина K2', severity: 'MEDIUM', mechanism: 'Мальабсорбция жирорастворимых витаминов' },
  { drug: 'орлистат', substance: 'omega3', effect: 'Снижение всасывания Омега-3 (длительный приём)', severity: 'MEDIUM', mechanism: 'Блокада панкреатической липазы орлистатом' },
  { drug: 'орлистат', substance: 'vitamin_e', effect: 'Снижение всасывания витамина E', severity: 'MEDIUM', mechanism: 'Мальабсорбция жирорастворимых витаминов' },

  // ── ИНГИБИТОРЫ ФОСФОДИЭСТЕРАЗЫ 5 (ПДЭ-5) ──
  { drug: 'ПДЭ-5 (силденафил)', substance: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ (жизнеугрожающее состояние)', severity: 'HIGH', mechanism: 'Суммация NO/цГМФ пути — абсолютное противопоказание' },
  { drug: 'ПДЭ-5 (тадалафил)', substance: 'нитраты', effect: 'ВЫРАЖЕННАЯ ГИПОТОНИЯ', severity: 'HIGH', mechanism: 'NO-доноры + PDE5 = абсолютное противопоказание' },
  { drug: 'силденафил', substance: 'citrulline', effect: 'Избыточное снижение АД (суммация NO-эффекта)', severity: 'MEDIUM', mechanism: 'Донация NO (цитруллин→аргинин) + PDE5 ингибитор' },
  { drug: 'тадалафил', substance: 'citrulline', effect: 'Гипотония, ортостатический коллапс (риск)', severity: 'MEDIUM', mechanism: 'Синергизм донации NO и ингибирования PDE5' },
  { drug: 'силденафил', substance: 'arginine', effect: 'Избыточное снижение АД (суммация NO-пути)', severity: 'MEDIUM', mechanism: 'NO-донор + PDE5 ингибитор → ↑ цГМФ' },

  // ── 5α-РЕДУКТАЗЫ (ФИНАСТЕРИД, ДУТАСТЕРИД) ──
  { drug: 'финастерид', substance: 'saw_palmetto', effect: 'Суммация ингибирования 5α-редуктазы (дублирование)', severity: 'LOW', mechanism: 'Дублирование блокады 5AR II типа' },
  { drug: 'дутастерид', substance: 'saw_palmetto', effect: 'Избыточное снижение ДГТ (риск побочных)', severity: 'LOW', mechanism: 'Дублирование ингибирования 5AR I и II типа' },
  { drug: 'финастерид', substance: 'zinc', effect: 'Дополнительное снижение ДГТ (аддитивно)', severity: 'LOW', mechanism: 'Цинк — ингибитор 5α-редуктазы in vitro' },

  // ── КОЛХИЦИН (ПРОТИВОПОДАГРИЧЕСКОЕ) ──
  { drug: 'колхицин', substance: 'curcumin', effect: 'Повышение концентрации колхицина (риск токсичности)', severity: 'HIGH', mechanism: 'Ингибирование CYP3A4 и P-гликопротеина куркумином' },
  { drug: 'колхицин', substance: 'b12', effect: 'Мальабсорбция B12 на фоне колхицина', severity: 'MEDIUM', mechanism: 'Повреждение ворсинок тонкого кишечника' },

  // ── АЛЛОПУРИНОЛ ──
  { drug: 'аллопуринол', substance: 'vitamin_c', effect: 'Усиление экскреции мочевой кислоты (аддитивно)', severity: 'LOW', mechanism: 'Уратурический эффект витамина C' },

  // ── АНТИЭМЕТИКИ (5-HT3 АНТАГОНИСТЫ) ──
  { drug: 'ондансетрон', substance: '5htp', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ (риск)', severity: 'HIGH', mechanism: '5-HT3 антагонизм + избыток 5-HT (суммация)' },

  // ── ПРОКИНЕТИКИ ──
  { drug: 'домперидон', substance: 'naringin', effect: 'Повышение концентрации домперидона (риск аритмии)', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4 грейпфрутом → ↑ домперидон' },
  { drug: 'метоклопрамид', substance: 'b6', effect: 'Снижение экстрапирамидных побочных эффектов', severity: 'LOW', mechanism: 'B6 — кофактор синтеза дофамина, профилактика дискинезий' },

  // ── ОТКАЗ ОТ КУРЕНИЯ ──
  { drug: 'варениклин', substance: 'theanine', effect: 'Снижение тревожности, синергизм отказа от курения', severity: 'LOW', mechanism: 'GABA-ергическая модуляция дофаминовой отдачи' },
  { drug: 'бупропион', substance: '5htp', effect: 'Серотониновый синдром, риск судорог', severity: 'HIGH', mechanism: 'NDRI + серотонинергик — суммация ЦНС-стимуляции' },

  // ── ПРОТИВОВИРУСНЫЕ ──
  { drug: 'тенофовир', substance: 'astragalus', effect: 'Нефропротекция, снижение тубулярной токсичности', severity: 'LOW', mechanism: 'Антиоксидантная защита канальцев почек' },
  { drug: 'ацикловир', substance: 'taurine', effect: 'Нефропротекция (снижение кристаллурии)', severity: 'LOW', mechanism: 'Осмотическая + антиоксидантная защита нефрона' },

  // ── МИОРЕЛАКСАНТЫ (α2-АГОНИСТЫ, GABA-Б) ──
  { drug: 'тизанидин', substance: 'caffeine', effect: 'Снижение концентрации и эффекта тизанидина', severity: 'MEDIUM', mechanism: 'Тизанидин ингибирует CYP1A2 → кофеин ↓ эффект' },
  { drug: 'клонидин', substance: 'magnesium', effect: 'Избыточное снижение АД и брадикардия', severity: 'MEDIUM', mechanism: 'Синергизм симпатолитического α2-агониста + Mg' },
  { drug: 'баклофен', substance: 'theanine', effect: 'Чрезмерная седация, миорелаксация', severity: 'MEDIUM', mechanism: 'GABA-B агонизм + GABA-ергический синергизм' },
  { drug: 'баклофен', substance: 'gaba', effect: 'Избыточная седация, слабость, атаксия', severity: 'MEDIUM', mechanism: 'Суммация GABA-ергического торможения' },

  // ── ПРОТИВОГРИБКОВЫЕ (АЗОЛЫ) ──
  { drug: 'кетоконазол', substance: 'curcumin', effect: 'Повышение концентрации кетоконазола (гепатотоксичность)', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4 (обоюдное)' },
  { drug: 'кетоконазол', substance: 'calcium', effect: 'Снижение всасывания кетоконазола (при ахлоргидрии)', severity: 'MEDIUM', mechanism: 'Кетоконазол требует кислой среды для растворения' },

  // ── ИНГИБИТОРЫ КАРБОАНГИДРАЗЫ ──
  { drug: 'ацетазоламид', substance: 'potassium', effect: 'Гипокалиемия на фоне ацетазоламида', severity: 'MEDIUM', mechanism: 'Ингибирование карбоангидразы → ↑ потери K+' },
  { drug: 'ацетазоламид', substance: 'bicarbonate', effect: 'Метаболический ацидоз на фоне ацетазоламида', severity: 'MEDIUM', mechanism: 'Потери HCO3⁻ через почки' },

  // ── ЛИТИЙ + ДОБАВКИ ──
  { drug: 'литий', substance: 'caffeine', effect: 'Колебания уровня лития при изменении потребления кофеина', severity: 'MEDIUM', mechanism: 'Кофеин ↑ почечный клиренс лития — отмена резко ↑ концентрацию' },
  { drug: 'литий', substance: 'fiber', effect: 'Снижение всасывания лития', severity: 'MEDIUM', mechanism: 'Пищевые волокна связывают литий в ЖКТ' },
  { drug: 'литий', substance: 'creatine', effect: 'Дополнительная задержка жидкости, влияние на почечную экскрецию Li+', severity: 'LOW', mechanism: 'Осмотическая нагрузка + конкуренция за реабсорбцию' },

  // ── ГИНКГО / ЧЕСНОК + АНТИКОАГУЛЯНТЫ / АНТИАГРЕГАНТЫ ──
  { drug: 'варфарин', substance: 'ginkgo', effect: 'Риск кровотечений (усиление антикоагуляции)', severity: 'HIGH', mechanism: 'Гинкголиды ингибируют фактор активации тромбоцитов (PAF)' },
  { drug: 'аспирин', substance: 'ginkgo', effect: 'Риск кровотечений (спонтанные гифемы, ВЧК)', severity: 'HIGH', mechanism: 'Антиагрегантный эффект гинкголидов + ингибирование COX аспирином' },
  { drug: 'клопидогрель', substance: 'ginkgo', effect: 'Усиление антиагрегантного эффекта, риск кровотечений', severity: 'HIGH', mechanism: 'Ингибирование PAF + блокада P2Y12' },
  { drug: 'апиксабан', substance: 'ginkgo', effect: 'Риск кровотечений', severity: 'MEDIUM', mechanism: 'Аддитивный антитромботический эффект' },
  { drug: 'варфарин', substance: 'garlic', effect: 'Усиление антикоагуляции, риск кровотечений', severity: 'HIGH', mechanism: 'Аджоен/аллицин ингибируют агрегацию тромбоцитов' },
  { drug: 'варфарин', substance: 'garlic_extract', effect: 'Усиление антикоагуляции, риск кровотечений', severity: 'HIGH', mechanism: 'Аджоен/аллицин ингибируют агрегацию тромбоцитов' },
  { drug: 'аспирин', substance: 'garlic', effect: 'Риск кровотечений (двойной антиагрегантный эффект)', severity: 'MEDIUM', mechanism: 'Ингибирование агрегации тромбоцитов аллицином' },
  { drug: 'клопидогрель', substance: 'garlic_extract', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Аддитивное подавление агрегации тромбоцитов' },

  // ── ТАДАЛАФИЛ + NO-ДОНОРЫ (добавки) ──
  { drug: 'тадалафил', substance: 'arginine', effect: 'Гипотония, ортостатический коллапс (суммация NO-пути)', severity: 'MEDIUM', mechanism: 'NO-донор (аргинин) + ингибирование PDE5 → ↑ цГМФ' },
  { drug: 'тадалафил', substance: 'agmatine', effect: 'Усиление вазодилатации, снижение АД', severity: 'MEDIUM', mechanism: 'Модуляция NOS + ингибирование PDE5' },
];
