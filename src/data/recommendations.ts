export interface Recommendation {
  recId: string;
  type: string;
  riskId: string;
  level: string;
  title: string;
  text: string;
}

export const RECOMMENDATIONS_DB: Recommendation[] = [
  // === ПЕЧЕНЬ ===
  { recId: "REC_LIVER_FATTY_LOW", type: "RISK", riskId: "LIVER_FATTY", level: "LOW", title: "Лёгкий стеатоз", text: "Уменьши сахар и фастфуд, добавь 20–30 минут ходьбы." },
  { recId: "REC_LIVER_FATTY_MED", type: "RISK", riskId: "LIVER_FATTY", level: "MEDIUM", title: "Стеатоз средней степени", text: "Убери сахар, добавь омега-3 и NAC, контролируй вес." },
  { recId: "REC_LIVER_FATTY_HIGH", type: "RISK", riskId: "LIVER_FATTY", level: "HIGH", title: "Выраженный стеатоз", text: "Срочно снижать углеводы, добавить силовые, омега-3, УДХК." },
  { recId: "REC_LIVER_NASH_LOW", type: "RISK", riskId: "LIVER_NASH", level: "LOW", title: "Начало воспаления печени", text: "Убери алкоголь, добавь куркумин и омега-3." },
  { recId: "REC_LIVER_NASH_MED", type: "RISK", riskId: "LIVER_NASH", level: "MEDIUM", title: "НАСГ средней тяжести", text: "Добавь NAC, витамин E, контроль веса." },
  { recId: "REC_LIVER_NASH_HIGH", type: "RISK", riskId: "LIVER_NASH", level: "HIGH", title: "Выраженный НАСГ", text: "Требуется агрессивное снижение веса и антиоксиданты." },
  { recId: "REC_LIVER_CHOLESTASIS_LOW", type: "RISK", riskId: "LIVER_CHOLESTASIS", level: "LOW", title: "Лёгкий холестаз", text: "Добавь таурин и артишок." },
  { recId: "REC_LIVER_CHOLESTASIS_MED", type: "RISK", riskId: "LIVER_CHOLESTASIS", level: "MEDIUM", title: "Холестаз", text: "Убери жирное, добавь УДХК (урсосан)." },
  { recId: "REC_LIVER_CHOLESTASIS_HIGH", type: "RISK", riskId: "LIVER_CHOLESTASIS", level: "HIGH", title: "Выраженный холестаз", text: "Нужна медикаментозная терапия и контроль ферментов." },
  { recId: "REC_LIVER_ENZYMES_LOW", type: "RISK", riskId: "LIVER_ENZYMES_HIGH", level: "LOW", title: "Повышенные АЛТ/АСТ", text: "Контроль ферментов через 2 недели, добавить NAC." },
  { recId: "REC_LIVER_ENZYMES_MED", type: "RISK", riskId: "LIVER_ENZYMES_HIGH", level: "MEDIUM", title: "Умеренный цитолиз", text: "Снизить дозу ААС, добавить гепатопротекторы, контроль через 1 неделю." },
  { recId: "REC_LIVER_ENZYMES_HIGH", type: "RISK", riskId: "LIVER_ENZYMES_HIGH", level: "HIGH", title: "Выраженный цитолиз", text: "Немедленно снизить дозу или отменить гепатотоксичный препарат." },

  // === ПОЧКИ ===
  { recId: "REC_KIDNEY_CKD_LOW", type: "RISK", riskId: "KIDNEY_CKD", level: "LOW", title: "Снижение функции почек", text: "Пей воду, убери НПВС." },
  { recId: "REC_KIDNEY_CKD_MED", type: "RISK", riskId: "KIDNEY_CKD", level: "MEDIUM", title: "ХБП средней степени", text: "Контроль давления, ограничение соли." },
  { recId: "REC_KIDNEY_CKD_HIGH", type: "RISK", riskId: "KIDNEY_CKD", level: "HIGH", title: "Выраженная ХБП", text: "Срочно к нефрологу, контроль калия." },
  { recId: "REC_KIDNEY_STONES_LOW", type: "RISK", riskId: "KIDNEY_STONES", level: "LOW", title: "Риск камней", text: "Пей воду, добавь магний." },
  { recId: "REC_KIDNEY_STONES_MED", type: "RISK", riskId: "KIDNEY_STONES", level: "MEDIUM", title: "Камни", text: "Убери оксалаты, добавь цитрат калия." },
  { recId: "REC_KIDNEY_STONES_HIGH", type: "RISK", riskId: "KIDNEY_STONES", level: "HIGH", title: "Крупные камни", text: "Требуется УЗИ и терапия." },
  { recId: "REC_KIDNEY_PROTEINURIA_LOW", type: "RISK", riskId: "KIDNEY_PROTEINURIA", level: "LOW", title: "Следы белка", text: "Увеличь потребление воды, снизь белок до 2г/кг." },
  { recId: "REC_KIDNEY_PROTEINURIA_MED", type: "RISK", riskId: "KIDNEY_PROTEINURIA", level: "MEDIUM", title: "Протеинурия", text: "Обязательно УЗИ почек, контроль креатинина." },
  { recId: "REC_KIDNEY_PROTEINURIA_HIGH", type: "RISK", riskId: "KIDNEY_PROTEINURIA", level: "HIGH", title: "Выраженная протеинурия", text: "Срочно к нефрологу, возможна биопсия." },

  // === СЕРДЦЕ ===
  { recId: "REC_HEART_HYPERTENSION_LOW", type: "RISK", riskId: "HEART_HYPERTENSION", level: "LOW", title: "Повышенное давление", text: "Уменьши соль, добавь магний." },
  { recId: "REC_HEART_HYPERTENSION_MED", type: "RISK", riskId: "HEART_HYPERTENSION", level: "MEDIUM", title: "Гипертензия", text: "Добавь калий, омега-3, контроль веса." },
  { recId: "REC_HEART_HYPERTENSION_HIGH", type: "RISK", riskId: "HEART_HYPERTENSION", level: "HIGH", title: "Высокое давление", text: "Требуется медикаментозная терапия." },
  { recId: "REC_HEART_ATHEROSCLEROSIS_LOW", type: "RISK", riskId: "HEART_ATHEROSCLEROSIS", level: "LOW", title: "Риск атеросклероза", text: "Добавь омега-3 и витамин K2." },
  { recId: "REC_HEART_ATHEROSCLEROSIS_MED", type: "RISK", riskId: "HEART_ATHEROSCLEROSIS", level: "MEDIUM", title: "Атеросклероз", text: "Контроль липидов, добавить CoQ10." },
  { recId: "REC_HEART_ATHEROSCLEROSIS_HIGH", type: "RISK", riskId: "HEART_ATHEROSCLEROSIS", level: "HIGH", title: "Выраженный атеросклероз", text: "Требуется терапия статинами." },
  { recId: "REC_HEART_THROMBOSIS_LOW", type: "RISK", riskId: "HEART_THROMBOSIS", level: "LOW", title: "Риск тромбоза", text: "Аспирин 100 мг/день, обильное питьё." },
  { recId: "REC_HEART_THROMBOSIS_MED", type: "RISK", riskId: "HEART_THROMBOSIS", level: "MEDIUM", title: "Умеренный риск тромбоза", text: "Сдача крови, контроль HCT, омега-3." },
  { recId: "REC_HEART_THROMBOSIS_HIGH", type: "RISK", riskId: "HEART_THROMBOSIS", level: "HIGH", title: "Высокий риск тромбоза", text: "HCT >54% — кровопускание, антикоагулянты." },

  // === НЕРВНАЯ СИСТЕМА ===
  { recId: "REC_NEURO_INSOMNIA_LOW", type: "RISK", riskId: "NEURO_INSOMNIA", level: "LOW", title: "Лёгкая бессонница", text: "Магний L-треонат, мелатонин 0.5 мг." },
  { recId: "REC_NEURO_INSOMNIA_MED", type: "RISK", riskId: "NEURO_INSOMNIA", level: "MEDIUM", title: "Бессонница", text: "Глицин, 5-HTP, гигиена сна." },
  { recId: "REC_NEURO_INSOMNIA_HIGH", type: "RISK", riskId: "NEURO_INSOMNIA", level: "HIGH", title: "Тяжёлая бессонница", text: "Консультация сомнолога, возможна фармакотерапия." },
  { recId: "REC_NEURO_AGRESSION_LOW", type: "RISK", riskId: "NEURO_AGRESSION", level: "LOW", title: "Раздражительность", text: "Медитация, L-теанин." },
  { recId: "REC_NEURO_AGRESSION_MED", type: "RISK", riskId: "NEURO_AGRESSION", level: "MEDIUM", title: "Агрессия", text: "Снизить дозу, добавить антиоксиданты, проверить эстрадиол." },
  { recId: "REC_NEURO_AGRESSION_HIGH", type: "RISK", riskId: "NEURO_AGRESSION", level: "HIGH", title: "Выраженная агрессия", text: "Немедленно снизить дозу, консультация психиатра." },
  { recId: "REC_NEURO_ANXIETY_LOW", type: "RISK", riskId: "NEURO_ANXIETY", level: "LOW", title: "Лёгкая тревожность", text: "Магний, L-теанин, дыхательные практики." },
  { recId: "REC_NEURO_ANXIETY_MED", type: "RISK", riskId: "NEURO_ANXIETY", level: "MEDIUM", title: "Тревожность", text: "Ашваганда, Родинола розовая." },
  { recId: "REC_NEURO_ANXIETY_HIGH", type: "RISK", riskId: "NEURO_ANXIETY", level: "HIGH", title: "Выраженная тревога", text: "Консультация психиатра, возможна фармакотерапия." },
  { recId: "REC_NEURO_DEPRESSION_LOW", type: "RISK", riskId: "NEURO_DEPRESSION", level: "LOW", title: "Лёгкая депрессия на ПКТ", text: "Семгу, витамин D, физическая активность." },
  { recId: "REC_NEURO_DEPRESSION_MED", type: "RISK", riskId: "NEURO_DEPRESSION", level: "MEDIUM", title: "Депрессия на ПКТ", text: "5-HTP, дофаминовые предшественники, контроль гормонов." },
  { recId: "REC_NEURO_DEPRESSION_HIGH", type: "RISK", riskId: "NEURO_DEPRESSION", level: "HIGH", title: "Тяжёлая депрессия", text: "Консультация психиатра, антидепрессанты." },

  // === ЭНДОКРИННАЯ СИСТЕМА ===
  { recId: "REC_ENDO_HPG_LOW", type: "RISK", riskId: "ENDO_HPG_SUPPRESSION", level: "LOW", title: "Лёгкое подавление ГГГ", text: "ХГЧ 500 МЕ 2р/нед (схема 3/1), контроль ЛГ/ФСГ." },
  { recId: "REC_ENDO_HPG_MED", type: "RISK", riskId: "ENDO_HPG_SUPPRESSION", level: "MEDIUM", title: "Умеренное подавление ГГГ", text: "ХГЧ (500 МЕ 2р/нед, 3/1) + Кломид, контроль тестостерона и эстрадиола." },
  { recId: "REC_ENDO_HPG_HIGH", type: "RISK", riskId: "ENDO_HPG_SUPPRESSION", level: "HIGH", title: "Выраженное подавление ГГГ", text: "Длительная ПКТ (Кломид + Тамоксифен), эндокринолог." },
  { recId: "REC_ENDO_GYNECO_LOW", type: "RISK", riskId: "ENDO_GYNECOMASTIA", level: "LOW", title: "Риск гинекомастии", text: "Контроль эстрадиола, при ↑ — АИ." },
  { recId: "REC_ENDO_GYNECO_MED", type: "RISK", riskId: "ENDO_GYNECOMASTIA", level: "MEDIUM", title: "Гинекомастия", text: "Анастрозол 0.25-0.5 мг, контроль E2." },
  { recId: "REC_ENDO_GYNECO_HIGH", type: "RISK", riskId: "ENDO_GYNECOMASTIA", level: "HIGH", title: "Выраженная гинекомастия", text: "Хирургическая консультация, тамоксифен." },

  // === КРОВЕТВОРНАЯ СИСТЕМА ===
  { recId: "REC_HEMA_POLYCYTHEMIA_LOW", type: "RISK", riskId: "HEMA_POLYCYTHEMIA", level: "LOW", title: "Лёгкий эритроцитоз", text: "Обильное питьё, контроль HCT." },
  { recId: "REC_HEMA_POLYCYTHEMIA_MED", type: "RISK", riskId: "HEMA_POLYCYTHEMIA", level: "MEDIUM", title: "Эритроцитоз", text: "Кровопускание 450 мл, аспирин." },
  { recId: "REC_HEMA_POLYCYTHEMIA_HIGH", type: "RISK", riskId: "HEMA_POLYCYTHEMIA", level: "HIGH", title: "Опасный эритроцитоз", text: "HCT >54% — немедленное кровопускание, антикоагулянты." },
  { recId: "REC_HEMA_THROMBOSIS_LOW", type: "RISK", riskId: "HEMA_THROMBOSIS_RISK", level: "LOW", title: "Риск тромбоза", text: "Аспирин 100 мг, омега-3." },
  { recId: "REC_HEMA_THROMBOSIS_MED", type: "RISK", riskId: "HEMA_THROMBOSIS_RISK", level: "MEDIUM", title: "Умеренный риск", text: "Аспирин, контроль D-димера." },
  { recId: "REC_HEMA_THROMBOSIS_HIGH", type: "RISK", riskId: "HEMA_THROMBOSIS_RISK", level: "HIGH", title: "Высокий риск тромбоза", text: "Антикоагулянты, снижение дозы ААС." },

  // === РЕПРОДУКТИВНАЯ СИСТЕМА ===
  { recId: "REC_REPO_ATROPHY_LOW", type: "RISK", riskId: "REPRO_TESTICULAR_ATROPHY", level: "LOW", title: "Лёгкая атрофия яичек", text: "ХГЧ 500 МЕ 2×/нед, 3 нед через 1." },
  { recId: "REC_REPO_ATROPHY_MED", type: "RISK", riskId: "REPRO_TESTICULAR_ATROPHY", level: "MEDIUM", title: "Атрофия яичек", text: "ХГЧ 500 МЕ 2×/нед, 3 нед через 1, контроль объёма." },
  { recId: "REC_REPO_ATROPHY_HIGH", type: "RISK", riskId: "REPRO_TESTICULAR_ATROPHY", level: "HIGH", title: "Выраженная атрофия", text: "Экстренная ПКТ, консультация андролога." },
  { recId: "REC_REPO_PROSTATE_LOW", type: "RISK", riskId: "REPRO_PROSTATE", level: "LOW", title: "Риск гиперплазии простаты", text: "Контроль ПСА, пальцевое исследование." },
  { recId: "REC_REPO_PROSTATE_MED", type: "RISK", riskId: "REPRO_PROSTATE", level: "MEDIUM", title: "Гиперплазия простаты", text: "Финастерид, контроль ПСА каждые 3 месяца." },
  { recId: "REC_REPO_PROSTATE_HIGH", type: "RISK", riskId: "REPRO_PROSTATE", level: "HIGH", title: "Выраженная гиперплазия", text: "Уролог, биопсия при ПСА >4." },

  // === ОПОРНО-ДВИГАТЕЛЬНАЯ ===
  { recId: "REC_JOINT_TENDON_LOW", type: "RISK", riskId: "JOINT_TENDON_RISK", level: "LOW", title: "Риск сухожилий", text: "Ограничь рабочий вес, добавь коллаген." },
  { recId: "REC_JOINT_TENDON_MED", type: "RISK", riskId: "JOINT_TENDON_RISK", level: "MEDIUM", title: "Боль в сухожилиях", text: "Снизь объём, добавить BPC-157, MSM." },
  { recId: "REC_JOINT_TENDON_HIGH", type: "RISK", riskId: "JOINT_TENDON_RISK", level: "HIGH", title: "Высокий риск разрыва", text: "Полный отдых, МРТ, BPC-157, консультация ортопеда." },

  // === МЕТАБОЛИЗМ ===
  { recId: "REC_METABOLIC_SYNDROME_LOW", type: "RISK", riskId: "METABOLIC_SYNDROME", level: "LOW", title: "Риск метаболического синдрома", text: "Контроль сахара, добавить клетчатку." },
  { recId: "REC_METABOLIC_SYNDROME_MED", type: "RISK", riskId: "METABOLIC_SYNDROME", level: "MEDIUM", title: "Метаболический синдром", text: "Низкоуглеводная диета, омега-3, контроль HOMA-IR." },
  { recId: "REC_METABOLIC_SYNDROME_HIGH", type: "RISK", riskId: "METABOLIC_SYNDROME", level: "HIGH", title: "Выраженный метаболический синдром", text: "Эндокринолог, метформин, строгая диета." },
  { recId: "REC_METABOLIC_INSULIN_LOW", type: "RISK", riskId: "METABOLIC_INSULIN_RESISTANCE", level: "LOW", title: "Лёгкая инсулинорезистентность", text: "Добавь клетчатку, снизь быстрые углеводы." },
  { recId: "REC_METABOLIC_INSULIN_MED", type: "RISK", riskId: "METABOLIC_INSULIN_RESISTANCE", level: "MEDIUM", title: "Инсулинорезистентность", text: "Низкий ГИ, хром, контроль HOMA-IR." },
  { recId: "REC_METABOLIC_INSULIN_HIGH", type: "RISK", riskId: "METABOLIC_INSULIN_RESISTANCE", level: "HIGH", title: "Выраженная инсулинорезистентность", text: "Эндокринолог, метформин." },

  // === НЕЙРОТОКСИЧНОСТЬ ===
  { recId: "REC_NEUROTOX_DOPAMINE_LOW", type: "RISK", riskId: "NEUROTOX_DOPAMINE", level: "LOW", title: "Дофаминовый дисбаланс", text: "L-тирозин, витамин B6." },
  { recId: "REC_NEUROTOX_DOPAMINE_MED", type: "RISK", riskId: "NEUROTOX_DOPAMINE", level: "MEDIUM", title: "Дофаминовая дисрегуляция", text: "Снизить дозу тренболона, добавить антиоксиданты." },
  { recId: "REC_NEUROTOX_DOPAMINE_HIGH", type: "RISK", riskId: "NEUROTOX_DOPAMINE", level: "HIGH", title: "Выраженная дофаминовая токсичность", text: "Немедленно отменить тренболон, консультация психиатра." },
  { recId: "REC_NEUROTOX_GABA_LOW", type: "RISK", riskId: "NEUROTOX_GABA", level: "LOW", title: "Лёгкая ГАМК-дисфункция", text: "Магний, L-теанин, глицин." },
  { recId: "REC_NEUROTOX_GABA_MED", type: "RISK", riskId: "NEUROTOX_GABA", level: "MEDIUM", title: "ГАМК-дисфункция", text: "Магний L-треонат, фенибут (не более 2 недель)." },
  { recId: "REC_NEUROTOX_GABA_HIGH", type: "RISK", riskId: "NEUROTOX_GABA", level: "HIGH", title: "Тяжёлая ГАМК-дисфункция", text: "Консультация невролога, возможна фармакотерапия." },

  // === СОСУДЫ ===
  { recId: "REC_VESSELS_ENDOTHELIUM_LOW", type: "RISK", riskId: "VESSELS_ENDOTHELIUM", level: "LOW", title: "Лёгкая эндотелиальная дисфункция", text: "Омега-3, L-аргинин, витамин C." },
  { recId: "REC_VESSELS_ENDOTHELIUM_MED", type: "RISK", riskId: "VESSELS_ENDOTHELIUM", level: "MEDIUM", title: "Эндотелиальная дисфункция", text: "Омега-3 3г/день, CoQ10, контроль ЛПНП/ЛПВП." },
  { recId: "REC_VESSELS_ENDOTHELIUM_HIGH", type: "RISK", riskId: "VESSELS_ENDOTHELIUM", level: "HIGH", title: "Выраженная эндотелиальная дисфункция", text: "Статины, кардиолог, ЭХО-КГ." },

  // === МЕХАНИЗМЫ (общие) ===
  { recId: "REC_MECH_INFLAMMATION_UP", type: "MECHANISM", riskId: "INFLAMMATION_UP", level: "MEDIUM", title: "Повышено воспаление", text: "Добавь омега-3, куркумин, убери сахар." },
  { recId: "REC_MECH_CORTISOL_UP", type: "MECHANISM", riskId: "CORTISOL_UP", level: "MEDIUM", title: "Кортизол повышен", text: "Добавь магний и адаптогены." },
  { recId: "REC_MECH_T3_T4_DOWN", type: "MECHANISM", riskId: "T3_T4_DOWN", level: "MEDIUM", title: "Щитовидка снижена", text: "Добавь йод, селен." },
  { recId: "REC_MECH_GABA_DOWN", type: "MECHANISM", riskId: "GABA_DOWN", level: "MEDIUM", title: "Снижение GABA", text: "Добавь магний и теанин." },

  // === ОРГАНЫ (общие) ===
  { recId: "REC_ORGAN_LIVER", type: "ORGAN", riskId: "LIVER", level: "MEDIUM", title: "Печень нагружена", text: "Убери алкоголь, добавь NAC." },
  { recId: "REC_ORGAN_KIDNEYS", type: "ORGAN", riskId: "KIDNEYS", level: "MEDIUM", title: "Почки нагружены", text: "Пей воду, убери НПВС." },
  { recId: "REC_ORGAN_HEART", type: "ORGAN", riskId: "HEART", level: "MEDIUM", title: "Сердце нагружено", text: "Контроль АД, омега-3, CoQ10." },
  { recId: "REC_ORGAN_BRAIN", type: "ORGAN", riskId: "BRAIN", level: "MEDIUM", title: "ЦНС нагружена", text: "Магний, глицин, контроль сна." },
];
