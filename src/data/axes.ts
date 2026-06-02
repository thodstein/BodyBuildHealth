export interface Axis {
  id: string;
  name: string;
  organs: string[];
  description: string;
  mechanismUp: string[];
  mechanismDown: string[];
  riskUp: string[];
  riskDown: string[];
}

export const AXES_DB: Axis[] = [
  { id: "AXIS_LIVER_THYROID", name: "Liver → Thyroid Axis", organs: ["LIVER", "THYROID"], description: "Печень активирует T4→T3", mechanismUp: ["DETOX_UP", "T3_T4_UP"], mechanismDown: ["TOXIC_LOAD", "INFLAMMATION"], riskUp: ["LIVER_FATTY", "LIVER_NASH", "LIVER_CHOLESTASIS"], riskDown: ["HORMONE_HYPO"] },
  { id: "AXIS_THYROID_LIVER", name: "Thyroid → Liver Axis", organs: ["THYROID", "LIVER"], description: "Тиреоидные гормоны регулируют липиды и желчь", mechanismUp: ["T3_T4_UP"], mechanismDown: ["LIPID_DISORDER", "BILE_STASIS"], riskUp: ["HORMONE_HYPO", "HORMONE_HYPER"], riskDown: ["LIVER_FATTY"] },
  { id: "AXIS_GUT_BRAIN", name: "Gut → Brain Axis", organs: ["GI", "BRAIN"], description: "Микробиота управляет серотонином и воспалением", mechanismUp: ["SCFA_UP", "SEROTONIN_UP"], mechanismDown: ["DYSBIOSIS", "INFLAMMATION"], riskUp: ["GI_DYSBIOSIS", "GI_IBS"], riskDown: ["BRAIN_ANXIETY", "BRAIN_DEPRESSION"] },
  { id: "AXIS_BRAIN_GUT", name: "Brain → Gut Axis", organs: ["BRAIN", "GI"], description: "Стресс влияет на моторику и кислотность", mechanismUp: ["CORTISOL_UP", "NE_UP"], mechanismDown: ["MOTILITY_DOWN", "ACID_DOWN"], riskUp: ["BRAIN_ANXIETY", "BRAIN_BURNOUT"], riskDown: ["GI_IBS", "GI_REFLUX"] },
  { id: "AXIS_ADRENAL_GONAD", name: "Adrenals → Gonads Axis", organs: ["ADRENALS", "TESTES", "OVARIES"], description: "Кортизол подавляет половые гормоны", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["TESTOSTERONE_DOWN", "ESTROGEN_DOWN"], riskUp: ["HORMONE_HIGH_CORTISOL"], riskDown: ["HORMONE_LOW_T", "HORMONE_LOW_E2"] },
  { id: "AXIS_GONAD_ADRENAL", name: "Gonads → Adrenals Axis", organs: ["TESTES", "OVARIES", "ADRENALS"], description: "Половые гормоны регулируют стресс‑ответ", mechanismUp: ["TESTOSTERONE_UP", "ESTROGEN_UP"], mechanismDown: ["CORTISOL_UP"], riskUp: ["HORMONE_LOW_T", "HORMONE_LOW_E2"], riskDown: ["HORMONE_HIGH_CORTISOL"] },
  { id: "AXIS_LIVER_GUT", name: "Liver → Gut Axis", organs: ["LIVER", "GI"], description: "Желчь регулирует микробиоту и переваривание", mechanismUp: ["BILE_FLOW_UP"], mechanismDown: ["STASIS", "DYSBIOSIS"], riskUp: ["LIVER_CHOLESTASIS", "LIVER_BILE_SLUDGE"], riskDown: ["GI_DYSBIOSIS"] },
  { id: "AXIS_GUT_LIVER", name: "Gut → Liver Axis", organs: ["GI", "LIVER"], description: "Эндотоксины → воспаление печени", mechanismUp: ["LPS_DOWN", "SCFA_UP"], mechanismDown: ["INFLAMMATION_UP"], riskUp: ["GI_DYSBIOSIS"], riskDown: ["LIVER_NASH", "LIVER_FATTY"] },
  { id: "AXIS_HEART_KIDNEY", name: "Heart → Kidney Axis", organs: ["HEART", "KIDNEYS"], description: "Сердечный выброс регулирует фильтрацию", mechanismUp: ["GFR_UP"], mechanismDown: ["GFR_DOWN", "EDEMA"], riskUp: ["HEART_FAILURE"], riskDown: ["KIDNEY_CKD"] },
  { id: "AXIS_KIDNEY_HEART", name: "Kidney → Heart Axis", organs: ["KIDNEYS", "HEART"], description: "Электролиты управляют ритмом сердца", mechanismUp: ["ELECTROLYTES_UP"], mechanismDown: ["ELECTROLYTES_DOWN"], riskUp: ["KIDNEY_CKD", "KIDNEY_ELECTROLYTE_IMBALANCE"], riskDown: ["HEART_ARRHYTHMIA"] },
  { id: "AXIS_LIVER_HORMONES", name: "Liver → Hormones Axis", organs: ["LIVER", "HORMONES"], description: "Печень очищает эстрогены и гормоны", mechanismUp: ["DETOX_UP"], mechanismDown: ["CLEARANCE_DOWN"], riskUp: ["LIVER_FATTY", "LIVER_CHOLESTASIS"], riskDown: ["HORMONE_HIGH_E2"] },
  { id: "AXIS_HORMONES_LIVER", name: "Hormones → Liver Axis", organs: ["HORMONES", "LIVER"], description: "Эстрогены влияют на желчь и липиды", mechanismUp: ["ESTROGEN_UP"], mechanismDown: ["BILE_STASIS"], riskUp: ["HORMONE_HIGH_E2"], riskDown: ["LIVER_CHOLESTASIS"] },
  { id: "AXIS_IMMUNE_GUT", name: "Immune → Gut Axis", organs: ["IMMUNE_SYSTEM", "GI"], description: "Иммунитет управляет барьером кишечника", mechanismUp: ["IMMUNE_UP"], mechanismDown: ["INFLAMMATION_UP"], riskUp: ["IMMUNE_AUTOIMMUNE"], riskDown: ["GI_IBD"] },
  { id: "AXIS_GUT_IMMUNE", name: "Gut → Immune Axis", organs: ["GI", "IMMUNE_SYSTEM"], description: "Микробиота регулирует иммунитет", mechanismUp: ["SCFA_UP"], mechanismDown: ["DYSBIOSIS"], riskUp: ["GI_DYSBIOSIS"], riskDown: ["IMMUNE_LOW", "IMMUNE_ALLERGY"] },
  { id: "AXIS_BRAIN_ADRENAL", name: "Brain → Adrenal Axis", organs: ["BRAIN", "ADRENALS"], description: "Стресс → кортизол", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["HPA_DYSREGULATION"], riskUp: ["BRAIN_ANXIETY", "BRAIN_BURNOUT"], riskDown: ["HORMONE_HIGH_CORTISOL"] },
  { id: "AXIS_ADRENAL_BRAIN", name: "Adrenal → Brain Axis", organs: ["ADRENALS", "BRAIN"], description: "Кортизол влияет на настроение", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["SEROTONIN_DOWN"], riskUp: ["HORMONE_HIGH_CORTISOL"], riskDown: ["BRAIN_DEPRESSION", "BRAIN_BRAIN_FOG"] },
  { id: "AXIS_HEART_LIVER", name: "Heart → Liver Axis", organs: ["HEART", "LIVER"], description: "Кровоток влияет на детокс", mechanismUp: ["CO_UP"], mechanismDown: ["DETOX_DOWN"], riskUp: ["HEART_FAILURE"], riskDown: ["LIVER_CONGESTION"] },
  { id: "AXIS_LIVER_HEART", name: "Liver → Heart Axis", organs: ["LIVER", "HEART"], description: "Липиды → сосуды", mechanismUp: ["LIPIDS_UP"], mechanismDown: ["INFLAMMATION_UP"], riskUp: ["LIVER_FATTY", "LIVER_NASH"], riskDown: ["HEART_ATHEROSCLEROSIS"] },
  { id: "AXIS_KIDNEY_ELECTROLYTES", name: "Kidney → Electrolytes Axis", organs: ["KIDNEYS", "CELLS"], description: "Почки регулируют натрий/калий", mechanismUp: ["ELECTROLYTES_UP"], mechanismDown: ["ELECTROLYTES_DOWN"], riskUp: ["KIDNEY_CKD"], riskDown: ["HEART_ARRHYTHMIA"] },
  { id: "AXIS_ELECTROLYTES_HEART", name: "Electrolytes → Heart Axis", organs: ["CELLS", "HEART"], description: "Электролиты управляют ритмом сердца", mechanismUp: ["K_UP", "MG_UP"], mechanismDown: ["K_DOWN", "MG_DOWN"], riskUp: ["KIDNEY_ELECTROLYTE_IMBALANCE"], riskDown: ["HEART_ARRHYTHMIA"] },
  { id: "AXIS_LIVER_SKIN", name: "Liver → Skin Axis", organs: ["LIVER", "SKIN"], description: "Токсины → кожа", mechanismUp: ["DETOX_UP"], mechanismDown: ["TOXIC_LOAD_UP"], riskUp: ["LIVER_DETOX_OVERLOAD"], riskDown: ["SKIN_ACNE", "SKIN_ECZEMA"] },
  { id: "AXIS_SKIN_IMMUNE", name: "Skin → Immune Axis", organs: ["SKIN", "IMMUNE_SYSTEM"], description: "Кожа отражает иммунный статус", mechanismUp: ["INFLAMMATION_UP"], mechanismDown: ["BARRIER_DOWN"], riskUp: ["SKIN_ECZEMA", "SKIN_PSORIASIS"], riskDown: ["IMMUNE_AUTOIMMUNE"] },
  { id: "AXIS_EYES_BRAIN", name: "Eyes → Brain Axis", organs: ["EYES", "BRAIN"], description: "Зрение связано с когнитивной нагрузкой", mechanismUp: ["RETINA_UP"], mechanismDown: ["NEUROFATIGUE_UP"], riskUp: ["VISION_AGE"], riskDown: ["BRAIN_BRAIN_FOG"] },
  { id: "AXIS_BRAIN_EYES", name: "Brain → Eyes Axis", organs: ["BRAIN", "EYES"], description: "Стресс влияет на аккомодацию", mechanismUp: ["CORTISOL_UP"], mechanismDown: ["ACCOMMODATION_DOWN"], riskUp: ["BRAIN_ANXIETY"], riskDown: ["VISION_MYOPIA"] }
];