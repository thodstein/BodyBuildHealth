import React, { useState, useMemo } from 'react';
import { type BioStackProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { GlassCard, PillBtn, showToast, estCost } from './BioStackAIConstants';

/* ─── Clinical known interactions (drug-supplement) — расширенная база 65+ пар ─── */
const KNOWN_DRUG_SUP_INTERACTIONS: Array<{ drug: string; substance: string; effect: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; mechanism: string }> = [
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
];

const CYP450_LABELS: Record<string, string> = {
  unknown: '❓ Неизвестен',
  normal: '🟢 Нормальный (EM)',
  poor: '🔴 Медленный (PM)',
  intermediate: '🟡 Промежуточный (IM)',
  rapid: '🔵 Быстрый (RM)',
};

const CYP_DETAILS: Record<string, string> = {
  unknown: 'Стандартные дозировки. Для точной настройки — фармакогенетическое тестирование.',
  normal: 'Стандартный метаболизм через CYP450.',
  poor: 'Риск токсичности: дозы субстратов CYP снизить в 2-4 раза. Особое внимание — CYP2D6, CYP2C19, CYP3A4.',
  intermediate: 'Умеренное снижение метаболизма. Начинать с 50% дозы, титровать.',
  rapid: 'Ускоренный метаболизм: возможны более высокие дозы. Пролекарства → риск токсичных метаболитов.',
};

/* ─── Drug Check Tab ─── */
export function DrugCheckTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [medInput, setMedInput] = useState(profile.currentMeds.join(', '));
  const [allergyInput, setAllergyInput] = useState(profile.drugAllergies.join(', '));
  const [cypState, setCypState] = useState(profile.cyp450Status);
  const [results, setResults] = useState<Array<{
    drug: string; substance: string; effect: string; severity: string; mechanism: string;
  }> | null>(null);
  const [checkMode, setCheckMode] = useState<'stack' | 'catalog'>('stack');

  const catalogSearch = useMemo(() => {
    if (checkMode !== 'catalog') return null;
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) return null;
    const found: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string }> = [];
    for (const drug of drugs) {
      for (const [id, cat] of Object.entries(SUPPORT_CATALOG_DATA)) {
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          (drug.includes(k.drug) || k.drug.includes(drug)) &&
          (subName.includes(k.substance) || id.includes(k.substance))
        );
        direct.forEach(d => found.push({ ...d, substance: cat.nameRu || cat.name || id }));
      }
    }
    return found;
  }, [medInput, checkMode]);

  const runCheck = () => {
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const allergies = allergyInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) { showToast('Введите хотя бы одно лекарство', 'error'); return; }

    saveBioStackProfile({ ...profile, currentMeds: drugs, drugAllergies: allergies, cyp450Status: cypState });

    const res: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string }> = [];
    const targetIds = checkMode === 'stack' ? stackIds : Object.keys(SUPPORT_CATALOG_DATA).slice(0, 50);

    for (const drug of drugs) {
      for (const id of targetIds) {
        const cat = SUPPORT_CATALOG_DATA[id];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          (drug.includes(k.drug) || k.drug.includes(drug)) &&
          (subName.includes(k.substance) || id.includes(k.substance))
        );
        direct.forEach(d => res.push({ ...d, substance: cat.nameRu || cat.name || id }));
      }
    }

    for (const allergy of allergies) {
      for (const id of (checkMode === 'stack' ? stackIds : Object.keys(SUPPORT_CATALOG_DATA).slice(0, 50))) {
        const cat = SUPPORT_CATALOG_DATA[id];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        if (subName.includes(allergy) || allergy.includes(id)) {
          res.push({
            drug: allergy, substance: cat.nameRu || cat.name || id,
            effect: '⚠ ВОЗМОЖНА АЛЛЕРГИЧЕСКАЯ РЕАКЦИЯ', severity: 'HIGH',
            mechanism: 'Перекрёстная аллергия',
          });
        }
      }
    }

    if (res.length === 0) {
      res.push({
        drug: drugs.join(', '), substance: checkMode === 'stack' ? 'Ваш стек' : 'Каталог',
        effect: '✅ Клинически значимых взаимодействий не найдено',
        severity: 'LOW', mechanism: 'Нет данных о взаимодействии',
      });
    }
    setResults(res);
  };

  const maxSev = results ? Math.max(...results.map(r => r.severity === 'HIGH' ? 2 : r.severity === 'MEDIUM' ? 1 : 0)) : 0;
  const overallColor = maxSev === 2 ? '#ef4444' : maxSev === 1 ? '#f59e0b' : '#22c55e';
  const overallText = maxSev === 2 ? '🔴 Обнаружены КРИТИЧЕСКИЕ взаимодействия' : maxSev === 1 ? '🟡 Обнаружены умеренные взаимодействия' : '🟢 Безопасно';

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="💊 Детальная проверка лекарственных взаимодействий" icon="💊" color="#ef4444">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.3 }}>
          🔬 Введите названия принимаемых вами лекарств (МНН). Система проверит пересечения — со стеком БАДов или со всем каталогом.
        </div>

        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>
            💊 Лекарства (через запятую, МНН):
          </label>
          <textarea value={medInput} onChange={e => setMedInput(e.target.value)}
            placeholder="варфарин, метформин, аторвастатин, рамиприл, эсциталопрам, омепразол..."
            rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, boxSizing: 'border-box', resize: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>⚠ Аллергии:</label>
            <input value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
              placeholder="пенициллин, сульфаниламиды..."
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>🧬 CYP450:</label>
            <select value={cypState} onChange={e => setCypState(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, appearance: 'none' }}>
              {Object.entries(CYP450_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <PillBtn active={checkMode === 'stack'} onClick={() => setCheckMode('stack')} color="#60a5fa">
            📋 По моему стеку ({stackIds.length})
          </PillBtn>
          <PillBtn active={checkMode === 'catalog'} onClick={() => setCheckMode('catalog')} color="#8b5cf6">
            📚 По всему каталогу
          </PillBtn>
        </div>

        <button onClick={runCheck} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11,
          background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', marginBottom: 6,
        }}>🔍 Проверить взаимодействия</button>

        {checkMode === 'catalog' && !results && catalogSearch && catalogSearch.length > 0 && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', marginBottom: 6, fontSize: 8, color: '#f59e0b' }}>
            ⚡ Найдено {catalogSearch.length} пересечений с каталогом. Нажмите «Проверить» для деталей.
          </div>
        )}
      </GlassCard>

      {results && (
        <GlassCard title="📊 Результаты проверки" color={overallColor}>
          <div style={{
            padding: '8px 10px', borderRadius: 8, marginBottom: 8,
            background: `${overallColor}10`, border: `1px solid ${overallColor}25`,
            fontSize: 10, fontWeight: 700, color: overallColor, textAlign: 'center',
          }}>{overallText} ({results.length} находок)</div>

          {cypState !== 'unknown' && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa' }}>🧬 CYP450: {CYP450_LABELS[cypState]}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{CYP_DETAILS[cypState]}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                padding: '7px 9px', borderRadius: 8,
                background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${r.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.15)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                      color: r.severity === 'HIGH' ? '#ef4444' : r.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e',
                    }}>{r.severity === 'HIGH' ? '🔴 ВЫСОКИЙ' : r.severity === 'MEDIUM' ? '🟡 СРЕДНИЙ' : '🟢 НИЗКИЙ'}</span>
                  </div>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{r.drug} + {r.substance}</span>
                </div>
                <div style={{ fontSize: 8, color: '#fff', lineHeight: 1.3 }}>{r.effect}</div>
                <div style={{ fontSize: 7, color: '#a78bfa', lineHeight: 1.2, marginTop: 1 }}>🧬 {r.mechanism}</div>
              </div>
            ))}
          </div>

          {maxSev === 2 && (
            <div style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              fontSize: 9, color: '#fca5a5', lineHeight: 1.4,
            }}>
              ⚠ КЛИНИЧЕСКАЯ РЕКОМЕНДАЦИЯ: Выявлены высокорисковые взаимодействия.
              Пожалуйста, проконсультируйтесь с лечащим врачом перед приёмом БАДов.
              Не отменяйте и не меняйте дозировку назначенных лекарств самостоятельно.
            </div>
          )}

          <button onClick={() => {
            const txt = results.map(r => `${r.severity === 'HIGH' ? '🔴' : r.severity === 'MEDIUM' ? '🟡' : '🟢'} ${r.drug} + ${r.substance}: ${r.effect}`).join('\n');
            navigator.clipboard.writeText(txt);
            showToast('Скопировано', 'success');
          }} style={{
            width: '100%', padding: '8px 0', borderRadius: 8, marginTop: 6, cursor: 'pointer', fontSize: 9, fontWeight: 600,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
          }}>📋 Копировать результат</button>
        </GlassCard>
      )}
    </div>
  );
}
