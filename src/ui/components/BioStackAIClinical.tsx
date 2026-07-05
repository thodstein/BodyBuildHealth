import React, { useState, useMemo } from 'react';
import { type BioStackProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { LAB_MARKER_MAP } from '../../data/lab-marker-map';
import { GlassCard, PillBtn, showToast, estCost } from './BioStackAIConstants';
import type { LinkedData } from '../../core/data-link';

const CYP450_LABELS: Record<string, string> = {
  unknown: '❓ Неизвестен',
  normal: '🟢 Нормальный (EM)',
  poor: '🔴 Медленный (PM)',
  intermediate: '🟡 Промежуточный (IM)',
  rapid: '🔵 Быстрый (RM)',
};

const CYP_DETAILS: Record<string, string> = {
  unknown: 'Рекомендуется стандартная дозировка. Для точной настройки — фармакогенетическое тестирование.',
  normal: 'Стандартный метаболизм через CYP450. Обычные дозировки.',
  poor: 'Повышен риск токсичности: требуется снижение доз в 2-4 раза для субстратов CYP. Особое внимание — CYP2D6, CYP2C19, CYP3A4.',
  intermediate: 'Умеренное снижение метаболизма. Начинайте с 50% дозы, титруйте под контролем.',
  rapid: 'Ускоренный метаболизм: могут потребоваться более высокие дозы для достижения эффекта. Пролекарства (кодеин, трамадол) → токсичные метаболиты.',
};

// Типовые взаимодействия БАД-лекарство (клинически значимые) — расширенная база 65+ пар
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
  { drug: 'апиксабан', substance: 'curcumin', effect: 'Риск кровотечений (высокие дозы >1г/сут)', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект куркумина' },
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
  { drug: 'левтироксин', substance: 'calcium', effect: 'Снижение всасывания левотироксина (интервал >4ч)', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'magnesium', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'zinc', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'selenium', effect: 'Улучшение конверсии T4→T3', severity: 'LOW', mechanism: 'Селеносодержащие дейодиназы' },
  { drug: 'левтироксин', substance: 'железо', effect: 'Снижение всасывания левотироксина (интервал >4ч)', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },

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
  { drug: 'НПВС (диклофенак)', substance: 'curcumin', effect: 'Усиление антикоагуляции (высокие дозы >1г)', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект куркумина' },
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
  { drug: 'бензодиазепины', substance: 'theanine', effect: 'Чрезмерная седация, потенцирование', severity: 'MEDIUM', mechanism: 'GABA-ергический синергизм (↑Cl⁻ ток)' },
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
  { drug: 'алендронат', substance: 'calcium', effect: 'Снижение всасывания бисфосфоната (интервал >1ч)', severity: 'MEDIUM', mechanism: 'Конкуренция за всасывание в ЖКТ' },
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
];

// ─── Drug synonym/class map: конкретные МНН → каноническое имя в KNOWN_DRUG_SUP_INTERACTIONS ───
const DRUG_SYNONYM_MAP: Record<string, string[]> = {
  'иАПФ': ['иАПФ (рамиприл)', 'лизиноприл', 'эналаприл', 'каптоприл', 'периндоприл', 'квинаприл', 'фозиноприл', 'трандолаприл', 'беназеприл', 'моэксиприл', 'рамиприл'],
  'АРА': ['АРА (лозартан)', 'лозартан', 'валсартан', 'ирбесартан', 'кандесартан', 'телмисартан', 'эпросартан', 'олмесартан', 'азилсартан'],
  'β-блокаторы': ['β-блокаторы (бисопролол)', 'бисопролол', 'метопролол', 'атенолол', 'пропранолол', 'небиволол', 'карведилол', 'лабеталол', 'бетаксолол','эсмолол'],
  'БКК': ['БКК (амлодипин)', 'амлодипин', 'нифедипин', 'фелодипин', 'верапамил', 'дилтиазем', 'лацидипин', 'лерканидипин'],
  'СИОЗС': ['эсциталопрам (СИОЗС)', 'эсциталопрам', 'циталопрам', 'флуоксетин', 'пароксетин', 'сертралин', 'флувоксамин'],
  'СИОЗСиН': ['СИОЗСиН (венлафаксин)', 'венлафаксин', 'дулоксетин', 'левомилнаципран'],
  'ИПП': ['ингибиторы протонной помпы', 'омепразол', 'эзомепразол', 'лансопразол', 'пантопразол', 'рабепразол'],
  'статины': ['аторвастатин', 'розувастатин', 'симвастатин', 'ловастатин', 'правастатин', 'питавастатин', 'флувастатин'],
  'НПВС': ['НПВС (ибупрофен)', 'НПВС (диклофенак)', 'ибупрофен', 'диклофенак', 'напроксен', 'кетопрофен', 'индометацин', 'мелоксикам', 'целекоксиб', 'эторикоксиб'],
  'ГКС': ['глюкокортикоиды (преднизолон)', 'преднизолон', 'метилпреднизолон', 'дексаметазон', 'гидрокортизон', 'триамцинолон'],
  'диуретики': ['тиазидные (гидрохлоротиазид)', 'петлевые (фуросемид)', 'калийсберегающие (спиронолактон)', 'гидрохлоротиазид', 'фуросемид', 'торасемид', 'индапамид', 'хлорталидон'],
  'антикоагулянты': ['варфарин', 'апиксабан', 'дабигатран', 'ривароксабан', 'эдоксабан'],
  'противоэпилептические': ['вальпроат', 'карбамазепин', 'топирамат', 'ламотриджин', 'окскарбазепин', 'леветирацетам'],
  'бензодиазепины': ['бензодиазепины', 'диазепам', 'алпразолам', 'лоразепам', 'клоназепам', 'феназепам', 'бромазепам'],
  'антипсихотики': ['оланзапин', 'клозапин', 'рисперидон', 'кетоконазол', 'галоперидол', 'кветиапин'],
  'метформин': ['метформин', 'сиофор', 'глюкофаж'],
  'ПДЭ-5': ['ПДЭ-5 (силденафил)', 'ПДЭ-5 (тадалафил)', 'силденафил', 'тадалафил', 'варденафил'],
};

// Вспомогательная: расширяет название лекарства до всех возможных совпадений (синонимы + класс)
function expandDrugMatches(input: string): string[] {
  const lowered = input.toLowerCase().trim();
  const results = new Set<string>();
  results.add(lowered);
  // Ищем класс, к которому относится этот препарат, и добавляем все его синонимы
  for (const [className, synonyms] of Object.entries(DRUG_SYNONYM_MAP)) {
    const loweredClass = className.toLowerCase();
    // Если ввод содержит название класса ИЛИ класс содержит ввод → добавляем все синонимы
    if (lowered.includes(loweredClass) || loweredClass.includes(lowered)) {
      synonyms.forEach(s => results.add(s.toLowerCase()));
    }
    // Если ввод совпадает с любым синонимом → добавляем класс и все синонимы класса
    for (const syn of synonyms) {
      const loweredSyn = syn.toLowerCase();
      if (lowered.includes(loweredSyn) || loweredSyn.includes(lowered)) {
        results.add(loweredClass);
        synonyms.forEach(s => results.add(s.toLowerCase()));
      }
    }
  }
  return [...results];
}

// ─── Маппинг классов лекарств → системы риска ТЗ ───
const DRUG_CLASS_RISK_IMPACT: Record<string, { system: string; direction: 'up'|'down'|'both'; note: string }[]> = {
  'иАПФ': [{ system:'ren', direction:'up', note:'Гемодинамика/фильтрация (креатинин ↑) при стенозе почечной артерии' }],
  'АРА': [{ system:'ren', direction:'down', note:'Нефропротекция (защита клубочков)' }, { system:'hem', direction:'down', note:'MetS/ИР — нейтрально-положительно' }],
  'β-блокаторы': [{ system:'cv', direction:'both', note:'ЧСС ↓ — защита, но блокада β₂ → периферический сосудистый тонус ↑' }, { system:'hem', direction:'up', note:'Маскировка гипогликемии, ↑ ТГ' }],
  'БКК': [{ system:'cv', direction:'down', note:'Снижение АД, антиангинальный' }, { system:'hem', direction:'down', note:'Нейтрально к липидам/глюкозе' }],
  'диуретики': [{ system:'ren', direction:'up', note:'Водно-электролитные сдвиги (K⁺, Na⁺, объём)' }, { system:'hem', direction:'up', note:'Гипокалиемия ↑ глюкозу, ↑ мочевую кислоту' }],
  'СИОЗС': [{ system:'cns', direction:'both', note:'↑ серотонин — коррекция нейромедиаторной, но риск серотонинового синдрома с MAO-БАД' }, { system:'rep', direction:'up', note:'Снижение либидо, задержка эякуляции (↓ репродуктивной)' }],
  'СИОЗСиН': [{ system:'cv', direction:'up', note:'↑ ЧСС, ↑ АД (норадреналиновый компонент)' }, { system:'cns', direction:'both', note:'Облегчение боли/нейропатии, но ↑ тревоги старт' }],
  'ИПП': [{ system:'liv', direction:'up', note:'Риск холестаза при длительном приёме (↓ Mg → ↑ печёночные ферменты)' }, { system:'hem', direction:'up', note:'↓ B₁₂, ↑ Mg — гипомагниемия → ↑ риск аритмий' }],
  'статины': [{ system:'liv', direction:'up', note:'↑ трансаминаз (дозозависимо, обычно транзиторно)' }, { system:'cns', direction:'up', note:'Редко — когнитивные жалобы, ↑ риск полинейропатии' }],
  'НПВС': [{ system:'ren', direction:'up', note:'↓ простагландины → ↓ почечный кровоток, задержка Na/H₂O, ↑ креатинина' }, { system:'liv', direction:'up', note:'Гепатотоксичность (редко, идиосинкразическая)' }, { system:'cv', direction:'up', note:'↑ АД (Na/H₂O задержка + сосудистый тонус), ↑ тромботический риск' }],
  'ГКС': [{ system:'hem', direction:'up', note:'Инсулинорезистентность, ↑ глюкоза, ↑ ТГ, ↑ аппетит' }, { system:'cv', direction:'up', note:'Задержка Na/H₂O, ↑ АД' }, { system:'ren', direction:'up', note:'Водно-электролитный сдвиг (гипокалиемия)' }, { system:'liv', direction:'up', note:'Гепатоцеллюлярная нагрузка, жировой гепатоз' }],
  'антикоагулянты': [{ system:'hem', direction:'up', note:'Геморрагический риск, контроль INR/MHO' }],
  'бензодиазепины': [{ system:'cns', direction:'up', note:'Снижение GABA-реактивности, толерантность, когнитивное снижение при длительном приёме' }],
  'антипсихотики': [{ system:'hem', direction:'up', note:'↑ Пролактин → ИР, ↑ ТГ, ↑ глюкоза' }, { system:'cv', direction:'up', note:'Удлинение QT, ↑ риск аритмий' }],
  'метформин': [{ system:'hem', direction:'down', note:'↓ Инсулинорезистентность, ↓ глюкоза — метаболический профиль' }, { system:'liv', direction:'down', note:'↓ Отложения жира в печени (NAFLD)' }],
  'ПДЭ-5': [{ system:'cv', direction:'down', note:'Вазодилатация, ↓ АД (осторожно с нитратами)' }, { system:'rep', direction:'down', note:'Улучшение эректильной функции' }],
};

// Возвращает summary-строку по системе риска для заданного набора лекарств
function getDrugRiskSummary(drugs: string[]): { system: string; icon: string; note: string; color: string }[] {
  const impacted = new Map<string, { note: string; direction: 'up'|'down'|'both' }>();
  for (const drug of drugs) {
    const expanded = expandDrugMatches(drug);
    for (const match of expanded) {
      for (const [className, impacts] of Object.entries(DRUG_CLASS_RISK_IMPACT)) {
        if (className.toLowerCase() === match || match.includes(className.toLowerCase()) || className.toLowerCase().includes(match)) {
          impacts.forEach(imp => {
            const existing = impacted.get(imp.system);
            if (!existing) impacted.set(imp.system, { note: imp.note, direction: imp.direction });
            else if (imp.direction !== existing.direction && imp.direction !== 'both') {
              impacted.set(imp.system, { note: existing.note + '; ' + imp.note, direction: 'both' });
            }
          });
        }
      }
    }
  }
  const icons: Record<string, string> = { cv:'❤️', liv:'🟢', ren:'🔵', cns:'🧠', rep:'🔴', hem:'💉' };
  const colors: Record<string, string> = { up:'#ef4444', down:'#4caf50', both:'#f59e0b' };
  return [...impacted.entries()].map(([system, val]) => ({
    system, icon: icons[system] || '⚪',
    note: val.note, color: colors[val.direction] || '#94a3b8',
  }));
}

/* ─── DrugCheck card ─── */
export function DrugCheckCard({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [medsInput, setMedsInput] = useState(profile.currentMeds.join(', '));
  const [alergiesInput, setAlergiesInput] = useState(profile.drugAllergies.join(', '));
  const [checkResult, setCheckResult] = useState<Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string; inStack: boolean }> | null>(null);
  const [cypState, setCypState] = useState(profile.cyp450Status);

  const check = () => {
    const drugs = medsInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const allergies = alergiesInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) { showToast('Введите хотя бы одно лекарство', 'error'); return; }

    // Save to profile
    saveBioStackProfile({ ...profile, currentMeds: drugs, drugAllergies: allergies, cyp450Status: cypState });

    // Check interactions
    const results: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string; inStack: boolean }> = [];
    for (const drug of drugs) {
      const expandedDrugs = expandDrugMatches(drug);
      for (const sub of stackIds) {
        const cat = SUPPORT_CATALOG_DATA[sub];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || sub).toLowerCase();
        // Direct match in known interactions (with synonym expansion)
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          expandedDrugs.some(d => d.includes(k.drug) || k.drug.includes(d)) &&
          (subName.includes(k.substance) || k.substance.includes(sub))
        );
        if (direct.length > 0) {
          direct.forEach(d => results.push({ ...d, inStack: true }));
        }
        // Check ALL_INTERACTIONS for drug-like substances
        const fromAll = ALL_INTERACTIONS.filter((i: any) =>
          (i.substanceA?.toLowerCase?.() === sub || i.substanceB?.toLowerCase?.() === sub) &&
          expandedDrugs.some(d => i.substanceA?.toLowerCase?.().includes(d) || i.substanceB?.toLowerCase?.().includes(d))
        );
        if (fromAll.length > 0) {
          fromAll.forEach(i => results.push({
            drug, substance: subName,
            effect: i.effect || 'Взаимодействие', severity: i.severity || 'MEDIUM',
            mechanism: (i as any).mechanism || i.mechanisms?.join(', ') || '',
            inStack: true,
          }));
        }
      }
    }

    // Allergy check
    for (const allergy of allergies) {
      for (const sub of stackIds) {
        const cat = SUPPORT_CATALOG_DATA[sub];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || sub).toLowerCase();
        if (subName.includes(allergy) || allergy.includes(sub)) {
          results.push({
            drug: allergy, substance: subName,
            effect: '⚠ ВОЗМОЖНА АЛЛЕРГИЧЕСКАЯ РЕАКЦИЯ', severity: 'HIGH',
            mechanism: 'Перекрёстная аллергия / известная гиперчувствительность', inStack: true,
          });
        }
      }
    }

    if (results.length === 0) {
      results.push({
        drug: drugs[0], substance: stackIds.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || id).join(', '),
        effect: '✅ В известной базе взаимодействий не найдено. Рекомендуется контроль врача.',
        severity: 'LOW', mechanism: 'Нет известных данных о клинически значимых взаимодействиях', inStack: true,
      });
    }
    setCheckResult(results);
    // Persist HIGH interactions to localStorage for Dashboard warning
    const high = results.filter(r => r.severity === 'HIGH');
    try { localStorage.setItem('he_drug_warnings', JSON.stringify({ date: new Date().toISOString(), count: results.length, highCount: high.length, warnings: high.map(r => `${r.drug} + ${r.substance}`) })); } catch {}
  };

  const maxSev = checkResult ? Math.max(...checkResult.map(r => r.severity === 'HIGH' ? 2 : r.severity === 'MEDIUM' ? 1 : 0)) : 0;
  const overallColor = maxSev === 2 ? '#ef4444' : maxSev === 1 ? '#f59e0b' : '#22c55e';
  const overallText = maxSev === 2 ? '🔴 Критические взаимодействия' : maxSev === 1 ? '🟡 Умеренные взаимодействия' : '🟢 Безопасно';

  return (
    <GlassCard title="💊 Проверка лекарственных взаимодействий" icon="💊" color="#ef4444">
      {profile.currentMeds.length === 0 && (
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 6, lineHeight: 1.3 }}>
          🔬 Введите названия принимаемых лекарств (МНН через запятую). Система проверит пересечения с вашим стеком БАДов.
        </div>
      )}
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>💊 Рецептурные лекарства (МНН, через запятую):</label>
        <textarea value={medsInput} onChange={e => setMedsInput(e.target.value)}
          placeholder="варфарин, метформин, рамиприл, аторвастатин, эсциталопрам..."
          rows={2}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, boxSizing: 'border-box', resize: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>⚠ Лекарственные аллергии:</label>
          <input value={alergiesInput} onChange={e => setAlergiesInput(e.target.value)} placeholder="пенициллин, сульфаниламиды..."
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, boxSizing: 'border-box' }} />
        </div>
        <select value={cypState} onChange={e => { setCypState(e.target.value); saveBioStackProfile({ ...profile, cyp450Status: e.target.value }); }}
          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, appearance: 'none' }}>
          {Object.entries(CYP450_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <button onClick={check} style={{
        width: '100%', padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11,
        background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', marginBottom: 8,
      }}>🔍 Проверить взаимодействия</button>

      {checkResult && (
        <div>
          <div style={{
            padding: '8px 10px', borderRadius: 8, marginBottom: 8,
            background: `${overallColor}08`, border: `1px solid ${overallColor}20`,
            fontSize: 9, fontWeight: 700, color: overallColor, textAlign: 'center',
          }}>{overallText} ({checkResult.length} находок)</div>

          {cypState !== 'unknown' && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>🧬 CYP450: {CYP450_LABELS[cypState]}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{CYP_DETAILS[cypState]}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {checkResult.map((r, i) => (
              <div key={i} style={{
                padding: '7px 9px', borderRadius: 8,
                background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${r.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
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
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              fontSize: 9, color: '#fca5a5', lineHeight: 1.4,
            }}>
              ⚠ КЛИНИЧЕСКАЯ РЕКОМЕНДАЦИЯ: Обнаружены высокорисковые взаимодействия лекарств с БАДами.
              Рекомендуется консультация врача для коррекции терапии. Не отменяйте назначенные лекарства самостоятельно.
            </div>
          )}
          {cypState !== 'unknown' && cypState !== 'normal' && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)',
              fontSize: 9, color: '#fcd34d', lineHeight: 1.4,
            }}>
              ⚠ ФАРМАКОГЕНЕТИКА: Ваш CYP450 статус ({cypState}) требует индивидуального подбора доз.
              Учитывайте это при назначении новых препаратов.
            </div>
          )}

          {/* Влияние лекарств на системы риска */}
          {(() => {
            const drugs = medsInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
            if (drugs.length === 0) return null;
            const riskSummary = getDrugRiskSummary(drugs);
            if (riskSummary.length === 0) return null;
            return (
              <div style={{ marginTop: 8, padding: '7px 9px', borderRadius: 8, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚠ Влияние лекарств на системы риска</div>
                {riskSummary.map((r, i) => (
                  <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom: i < riskSummary.length - 1 ? 3 : 0 }}>
                    <span>{r.icon}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize: 8, color: r.color, fontWeight: 600 }}>{r.icon} {r.system.toUpperCase()}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>{r.note}</span>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 3, lineHeight: 1.2 }}>
                  Учитывается при расчёте рисков и подборе поддержки
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </GlassCard>
  );
}

/* ─── Lab short link card (переход в полную лабораторию) ─── */
export function LabShortcutCard({ linked, onNavigate }: { linked?: LinkedData | null; onNavigate?: () => void }) {
  const labs = linked?.labAnalysis;
  const devCount = labs?.interpretations?.filter((i: any) => i.status === 'high' || i.status === 'critical_high' || i.status === 'low')?.length || 0;

  return (
    <GlassCard title="🧪 Анализы → БАДы" icon="🧪" color="#a78bfa" onClick={onNavigate} style={{ cursor: 'pointer' }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '4px 0', lineHeight: 1.4 }}>
        {!labs ? '🔬 Нет данных. Заполните Лабораторию.' :
         devCount === 0 ? '✅ Все показатели в норме' :
         `⚠ ${devCount} отклонений — нажмите для детального анализа`}
      </div>
      <div style={{ fontSize: 7, color: 'rgba(167,139,250,0.5)', textAlign: 'center', marginTop: 4 }}>
        🧪 Открыть глубинный анализ лаборатории →
      </div>
    </GlassCard>
  );
}

/* ─── ClinicalNote card (Patient Summary) ─── */
export function ClinicalNoteCard({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [mode, setMode] = useState<'summary' | 'doctor' | 'schedule'>('summary');

  const note = useMemo(() => {
    if (mode === 'summary') {
      const lines: string[] = [];
      const goalLabel = (g: string) => {
        const map: Record<string, string> = {
          muscle_gain:'рост мышечной массы', fat_loss:'снижение жировой массы',
          endurance:'выносливость', sleep:'качество сна', recovery:'восстановление',
          energy:'энергия', libido:'либидо', concentration:'фокус', brain:'когнитивные функции',
          mood:'настроение', stress:'стресс', cardio_health:'здоровье ССС',
          immunity:'иммунитет', hormones:'гормональный баланс', joints:'суставы',
          digestion:'пищеварение', detox:'детоксикация', longevity:'долголетие',
          liver_health:'здоровье печени', kidney:'здоровье почек', skin:'кожа', hair:'волосы',
        };
        return map[g] || g;
      };
      lines.push(`📋 **Клиническая сводка**`);
      lines.push(`Пациент: ${profile.sex === 'male' ? '♂' : '♀'} ${profile.age} лет, ${profile.weight} кг, ${profile.height} см`);
      lines.push(`Уровень: ${profile.experience === 'beginner' ? 'Начинающий' : profile.experience === 'intermediate' ? 'Средний' : 'Продвинутый'}`);
      if (profile.healthConditions.length > 0) {
        const condMap: Record<string, string> = { liver:'заболевания печени', kidney:'заболевания почек', heart:'заболевания ССС', thyroid:'заболевания ЩЖ', stomach:'заболевания ЖКТ', pressure_high:'гипертония', pressure_low:'гипотония', diabetes:'сахарный диабет', autoimmune:'аутоиммунные заболевания' };
        lines.push(`Состояния: ${profile.healthConditions.map(h => condMap[h] || h).join(', ')}`);
      }
      if (profile.goals.length > 0) lines.push(`Цели: ${profile.goals.map(g => goalLabel(g)).join(', ')}`);
      if (profile.currentMeds.length > 0) lines.push(`Лекарства: ${profile.currentMeds.join(', ')}`);
      if (profile.drugAllergies.length > 0) lines.push(`Аллергии: ${profile.drugAllergies.join(', ')}`);
      if (profile.familyHistory.length > 0) lines.push(`Сем. анамнез: ${profile.familyHistory.join(', ')}`);
      lines.push(`ААС: ${profile.aasStatus === 'none' ? 'Нет' : profile.aasStatus}`);
      lines.push(`Образ жизни: ${profile.dietType === 'mixed' ? 'Смешанное питание' : profile.dietType}, ${profile.smoke ? 'курит' : 'не курит'}, алкоголь: ${profile.alcoholLevel === 'none' ? 'не употребляет' : profile.alcoholLevel === 'rare' ? 'редко' : profile.alcoholLevel === 'moderate' ? 'умеренно' : 'часто'}`);
      lines.push(`CYP450 статус: ${CYP450_LABELS[profile.cyp450Status] || 'Неизвестен'}`);
      lines.push(`---`);
      lines.push(`**Текущий стек БАДов (${stackIds.length} веществ):**`);
      stackIds.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id} (${c.tier || 'standard'})`);
      });
      if (stackIds.length === 0) lines.push('(стек не собран)');
      lines.push(`---`);
      lines.push(`**Ориентировочная стоимость/мес:** ${stackIds.reduce((s, id) => s + estCost(id), 0).toLocaleString()} ₽`);
      lines.push(`**Рекомендация:** Перед началом приёма БАДов проконсультируйтесь с врачом. При появлении побочных эффектов — отмените приём.`);
      return lines.join('\n');
    }

    if (mode === 'doctor') {
      const lines: string[] = [];
      lines.push(`**ВРАЧЕБНОЕ ЗАКЛЮЧЕНИЕ ПО СТЕКУ БАД**`);
      lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
      lines.push(`Пациент: ${profile.sex === 'male' ? 'Мужчина' : 'Женщина'}, ${profile.age} лет`);
      lines.push(`---`);
      lines.push(`**Анамнез:** ${profile.healthConditions.length > 0 ? profile.healthConditions.join(', ') : 'без особенностей'}`);
      if (profile.familyHistory.length > 0) lines.push(`Семейный анамнез: ${profile.familyHistory.join(', ')}`);
      lines.push(`**Текущая терапия:** ${profile.currentMeds.length > 0 ? profile.currentMeds.join(', ') : 'не принимает'}`);
      lines.push(`**Аллергоанамнез:** ${profile.drugAllergies.length > 0 ? profile.drugAllergies.join(', ') : 'не отягощён'}`);
      lines.push(`---`);
      lines.push(`**Состав стека (${stackIds.length} веществ):**`);
      stackIds.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) {
          lines.push(`- **${c.nameRu || c.name || id}**`);
          if (c.description) lines.push(`  Описание: ${c.description.slice(0, 100)}`);
          if (c.forms && c.forms.length > 0) {
            const best = c.forms.find(d => d.best) || c.forms[0];
            lines.push(`  Форма: ${best.nameRu || best.name || ''} ${best.dose || ''}`);
          }
          if (c.contraindications && c.contraindications.length > 0) {
            lines.push(`  Противопоказания: ${c.contraindications.slice(0, 2).join('; ')}`);
          }
        }
      });
      lines.push(`---`);
      lines.push(`**Заключение:**`);
      if (profile.currentMeds.length > 0) {
        lines.push(`⚠ Пациент принимает рецептурные препараты. Требуется оценка лекарственных взаимодействий.`);
      }
      if (profile.healthConditions.length > 0) {
        lines.push(`⚠ Имеются хронические заболевания. Необходим контроль профильных маркеров.`);
      }
      lines.push(`Рекомендован контроль лабораторных показателей (АЛТ, АСТ, ГГТ, креатинин, липидограмма) через 4 недели после начала приёма.`);
      lines.push(`При появлении нежелательных явлений — отмена БАДов и консультация врача.`);
      return lines.join('\n');
    }

    if (mode === 'schedule') {
      const lines: string[] = [];
      lines.push(`**📅 РАСПИСАНИЕ ПРИЁМА БАД**`);
      lines.push(`Сгенерировано: ${new Date().toLocaleDateString('ru-RU')}`);
      lines.push(`Пациент: ${profile.age} лет, ${profile.sex === 'male' ? '♂' : '♀'}`);
      lines.push(`Хронотип: ${profile.chronotype === 'lark' ? '🌅 Жаворонок' : profile.chronotype === 'owl' ? '🦉 Сова' : '🐦 Смешанный'}`);
      lines.push(`Питание: ${profile.dietType === 'mixed' ? 'Смешанное' : profile.dietType}`);
      lines.push(`---`);
      lines.push(`**🌅 УТРО (с завтраком):**`);
      const morning = ['omega3', 'coq10', 'vitamin_d3', 'zinc', 'selenium', 'curcumin', 'berberine', 'alpha_lipoic'];
      const morningItems = stackIds.filter(id => morning.includes(id) || !['tudca', 'magnesium', 'theanine', 'gaba', 'glycine', 'melatonin', 'ashwagandha', '5htp', 'l_tryptophan'].includes(id)).slice(0, 6);
      morningItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**🌇 ДЕНЬ (обед/полдник):**`);
      const afternoon = ['magnesium', 'vitamin_c', 'b_complex', 'probiotics', 'ashwagandha', 'rhodiola', 'adaptogens'];
      const afternoonItems = stackIds.filter(id => afternoon.includes(id)).slice(0, 4);
      afternoonItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**🌙 ВЕЧЕР (за 1-2ч до сна):**`);
      const evening = ['magnesium', 'theanine', 'gaba', 'glycine', 'melatonin', 'zinc', 'ashwagandha', '5htp', 'l_tryptophan', 'tudca', 'nac'];
      const eveningItems = stackIds.filter(id => evening.includes(id) || id.includes('sleep') || id.includes('relax') || id.includes('ashwa') || id.includes('gaba') || id.includes('glycine') || id.includes('melaton') || id.includes('5htp')).slice(0, 5);
      eveningItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**💧 Режим воды:** 30 мл/кг веса (${(profile.weight * 0.03).toFixed(1)} л/сут)`);
      lines.push(`**⚠ Важно:** БАДы не заменяют полноценное питание и лекарства. Интервал между приёмом лекарств и БАДов — минимум 2 часа.`);
      return lines.join('\n');
    }
    return '';
  }, [profile, stackIds, mode]);

  return (
    <GlassCard title={`📄 Клиническая справка`} icon="📄" color="#60a5fa">
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['summary', 'doctor', 'schedule'] as const).map(m => (
          <PillBtn key={m} active={mode === m} onClick={() => setMode(m)} color="#60a5fa">
            {m === 'summary' ? '📋 Сводка' : m === 'doctor' ? '👨‍⚕️ Врачу' : '📅 Расписание'}
          </PillBtn>
        ))}
      </div>
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
        fontFamily: 'monospace', maxHeight: 300, overflowY: 'auto',
      }}>
        {note}
      </div>
      <button onClick={() => { navigator.clipboard.writeText(note); showToast('Скопировано', 'success'); }} style={{
        width: '100%', padding: '8px 0', borderRadius: 8, marginTop: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
        background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
      }}>📋 Копировать текст</button>
    </GlassCard>
  );
}

/* ─── Main ClinicalTab (объединяет DrugCheck + LabShortcut + ClinicalNote) ─── */
export function ClinicalTab({ profile, setProfile, stackIds, linked, onNavigateLab }: {
  profile: BioStackProfile; setProfile: (p: BioStackProfile) => void; stackIds: string[]; linked?: LinkedData; onNavigateLab?: () => void;
}) {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 8, lineHeight: 1.3, textAlign: 'center' }}>
        🏥 Клинический блок — лекарственные взаимодействия, анализы → БАДы, заключение врача
      </div>
      <DrugCheckCard profile={profile} stackIds={stackIds} />
      <LabShortcutCard linked={linked} onNavigate={onNavigateLab} />
      <ClinicalNoteCard profile={profile} stackIds={stackIds} />
    </div>
  );
}
