// ══════════════════════════════════════════════════════════════════════
//  LAB MARKER → ORGAN → SYSTEM → MECHANISM → CORRECTION SUBSTANCE(S)
//  Every marker from UCUM_MAP + all LabSlice panels mapped.
//  Adding a substance to SUPPORT_CATALOG_DATA with matching mechanisms
//  automatically makes it appear in recommendations for these markers.
// ══════════════════════════════════════════════════════════════════════

export interface LabMarkerMap {
  marker: string;
  name: string;
  organ: string;       // LIVER, KIDNEYS, HEART, BRAIN, etc.
  system: string;      // hepatic, cardio, renal, neuro, etc.
  mechanisms: string[]; // mechanism codes matching SUPPORT_CATALOG_DATA
  higherIsWorse: boolean;
  defaultValue: number; // threshold
  unit: string;
  correctionIds: string[]; // default support substance IDs
}

export const LAB_MARKER_MAP: LabMarkerMap[] = [
  // ─── LIVER / Hepatobiliary ───
  { marker:'ALT', name:'АЛТ', organ:'LIVER', system:'hepatic', mechanisms:['GLUTATHIONE_SYNTHESIS','ANTIOXIDANT','LIVER_REGENERATION'], higherIsWorse:true, defaultValue:40, unit:'U/L', correctionIds:['nac','tudca','milk_thistle','alpha_lipoic'] },
  { marker:'AST', name:'АСТ', organ:'LIVER', system:'hepatic', mechanisms:['GLUTATHIONE_SYNTHESIS','ANTIOXIDANT','LIVER_REGENERATION'], higherIsWorse:true, defaultValue:40, unit:'U/L', correctionIds:['nac','tudca','milk_thistle','alpha_lipoic'] },
  { marker:'GGT', name:'ГГТ', organ:'LIVER', system:'hepatic', mechanisms:['BILE_ACID_MOD','ANTIOXIDANT','LIVER_REGENERATION'], higherIsWorse:true, defaultValue:55, unit:'U/L', correctionIds:['tudca','milk_thistle','phosphatidylcholine'] },
  { marker:'Bilirubin', name:'Билирубин общий', organ:'LIVER', system:'hepatic', mechanisms:['BILE_ACID_MOD','BILE_FLOW_STIMULATION'], higherIsWorse:true, defaultValue:21, unit:'мкмоль/л', correctionIds:['tudca','vitamin_k2','milk_thistle'] },
  { marker:'DIRECT_BIL', name:'Билирубин прямой', organ:'LIVER', system:'hepatic', mechanisms:['BILE_ACID_MOD','BILE_FLOW_STIMULATION'], higherIsWorse:true, defaultValue:5, unit:'мкмоль/л', correctionIds:['tudca','vitamin_k2'] },
  { marker:'ALP', name:'Щелочная фосфатаза', organ:'LIVER', system:'hepatic', mechanisms:['BILE_ACID_MOD','BILE_FLOW_STIMULATION'], higherIsWorse:true, defaultValue:130, unit:'U/L', correctionIds:['tudca','milk_thistle'] },
  { marker:'TOTAL_PROTEIN', name:'Общий белок', organ:'LIVER', system:'hepatic', mechanisms:['PROTEIN_SYNTHESIS','AMINO_ACID_METABOLISM'], higherIsWorse:false, defaultValue:65, unit:'г/л', correctionIds:['collagen_ii','glutamine','vitamin_b6'] },
  { marker:'ALB', name:'Альбумин', organ:'LIVER', system:'hepatic', mechanisms:['PROTEIN_SYNTHESIS','ANTIOXIDANT'], higherIsWorse:false, defaultValue:35, unit:'г/л', correctionIds:['glutamine','vitamin_b6'] },
  { marker:'CHOLINESTERASE', name:'Холинэстераза', organ:'LIVER', system:'hepatic', mechanisms:['LIVER_REGENERATION','MEMBRANE_PHOSPHOLIPID'], higherIsWorse:false, defaultValue:5000, unit:'U/L', correctionIds:['phosphatidylcholine','milk_thistle'] },
  { marker:'BILE_ACIDS', name:'Желчные кислоты', organ:'LIVER', system:'hepatic', mechanisms:['BILE_ACID_MOD','BILE_FLOW_STIMULATION'], higherIsWorse:true, defaultValue:10, unit:'мкмоль/л', correctionIds:['tudca','milk_thistle'] },
  { marker:'AMMONIA', name:'Аммиак', organ:'LIVER', system:'hepatic', mechanisms:['DETOXIFICATION','GLUTATHIONE_SYNTHESIS'], higherIsWorse:true, defaultValue:50, unit:'мкмоль/л', correctionIds:['nac','glutamine','alpha_lipoic'] },
  { marker:'LACTATE', name:'Лактат', organ:'LIVER', system:'hepatic', mechanisms:['MITOCHONDRIAL_ENERGY','ATP_PRODUCTION'], higherIsWorse:true, defaultValue:2.2, unit:'ммоль/л', correctionIds:['coq10','alpha_lipoic','shilajit'] },

  // ─── CARDIO / Heart & Vessels ───
  { marker:'LDL', name:'ЛПНП', organ:'HEART', system:'cardio', mechanisms:['CHOLESTEROL_REDUCTION','AMPK_ACTIVATION','LIPID_LOWERING'], higherIsWorse:true, defaultValue:3.0, unit:'ммоль/л', correctionIds:['omega3','bergamot','vitamin_e','berberine','red_yeast_rice'] },
  { marker:'HDL', name:'ЛПВП', organ:'HEART', system:'cardio', mechanisms:['EPA_DHA_UP','FATTY_ACID_TRANSPORT','ANTIATHEROGENIC'], higherIsWorse:false, defaultValue:0.9, unit:'ммоль/л', correctionIds:['omega3','niacin','vitamin_e'] },
  { marker:'Triglycerides', name:'Триглицериды', organ:'HEART', system:'cardio', mechanisms:['AMPK_ACTIVATION','FATTY_ACID_TRANSPORT','LIPID_LOWERING'], higherIsWorse:true, defaultValue:1.7, unit:'ммоль/л', correctionIds:['omega3','berberine','niacin'] },
  { marker:'APO_B', name:'АпоB', organ:'HEART', system:'cardio', mechanisms:['CHOLESTEROL_REDUCTION','LIPID_LOWERING'], higherIsWorse:true, defaultValue:1.2, unit:'г/л', correctionIds:['berberine','omega3','vitamin_e'] },
  { marker:'APO_A1', name:'АпоA1', organ:'HEART', system:'cardio', mechanisms:['EPA_DHA_UP','ANTIATHEROGENIC'], higherIsWorse:false, defaultValue:1.0, unit:'г/л', correctionIds:['omega3','niacin'] },
  { marker:'LP_A', name:'Липопротеин(a)', organ:'HEART', system:'cardio', mechanisms:['CHOLESTEROL_REDUCTION','LIPID_LOWERING'], higherIsWorse:true, defaultValue:30, unit:'мг/дл', correctionIds:['niacin','omega3','vitamin_e'] },
  { marker:'CK', name:'КФК', organ:'HEART', system:'cardio', mechanisms:['MITOCHONDRIAL_ENERGY','COENZYME_ELECTRON_TRANSPORT'], higherIsWorse:true, defaultValue:200, unit:'U/L', correctionIds:['coq10','magnesium','alpha_lipoic'] },
  { marker:'CK_MB', name:'КФК-МВ', organ:'HEART', system:'cardio', mechanisms:['COENZYME_ELECTRON_TRANSPORT','MITOCHONDRIAL_ENERGY'], higherIsWorse:true, defaultValue:5, unit:'нг/мл', correctionIds:['coq10','magnesium'] },
  { marker:'TROPONIN_I', name:'Тропонин I', organ:'HEART', system:'cardio', mechanisms:['COENZYME_ELECTRON_TRANSPORT'], higherIsWorse:true, defaultValue:0.04, unit:'нг/мл', correctionIds:['coq10','omega3','magnesium'] },
  { marker:'NT_PROBNP', name:'NT-proBNP', organ:'HEART', system:'cardio', mechanisms:['BP_REDUCTION','NO_RELEASE','COENZYME_ELECTRON_TRANSPORT'], higherIsWorse:true, defaultValue:125, unit:'пг/мл', correctionIds:['telmisartan','nebivolol','coq10'] },
  { marker:'BNP', name:'BNP', organ:'HEART', system:'cardio', mechanisms:['BP_REDUCTION','NO_RELEASE'], higherIsWorse:true, defaultValue:100, unit:'пг/мл', correctionIds:['telmisartan','coq10'] },
  { marker:'BP_SYSTOLIC', name:'АД систолическое', organ:'HEART', system:'cardio', mechanisms:['BP_REDUCTION','NO_RELEASE','BETA1_BLOCKADE'], higherIsWorse:true, defaultValue:130, unit:'мм рт.ст.', correctionIds:['telmisartan','nebivolol','diosmin'] },
  { marker:'BP_DIASTOLIC', name:'АД диастолическое', organ:'HEART', system:'cardio', mechanisms:['BP_REDUCTION','NO_RELEASE'], higherIsWorse:true, defaultValue:85, unit:'мм рт.ст.', correctionIds:['telmisartan','diosmin','pycnogenol'] },
  { marker:'HR', name:'ЧСС', organ:'HEART', system:'cardio', mechanisms:['BETA1_BLOCKADE','NO_RELEASE','GABA_MODULATION'], higherIsWorse:true, defaultValue:90, unit:'уд/мин', correctionIds:['nebivolol','magnesium','l_theanine'] },
  { marker:'ENDOTHELIN1', name:'Эндотелин-1', organ:'HEART', system:'cardio', mechanisms:['NO_RELEASE','BP_REDUCTION'], higherIsWorse:true, defaultValue:3.0, unit:'пг/мл', correctionIds:['pycnogenol','telmisartan','omega3'] },
  { marker:'NO_MARKER', name:'Оксид азота', organ:'HEART', system:'cardio', mechanisms:['NO_RELEASE','BP_REDUCTION'], higherIsWorse:false, defaultValue:10, unit:'мкмоль/л', correctionIds:['pycnogenol','nebivolol','telmisartan'] },

  // ─── HEMATOLOGY / Blood ───
  { marker:'HCT', name:'Гематокрит', organ:'BLOOD', system:'hematologic', mechanisms:['PLATELET_AGGREGATION_INHIBITION','FIBRINOLYSIS','ERYTHROPOIESIS'], higherIsWorse:true, defaultValue:48, unit:'%', correctionIds:['serrapeptase','nattokinase','naringin','lumbrokinase'] },
  { marker:'Hemoglobin', name:'Гемоглобин', organ:'BLOOD', system:'hematologic', mechanisms:['PLATELET_AGGREGATION_INHIBITION','HEMOGLOBIN_SYNTHESIS'], higherIsWorse:true, defaultValue:170, unit:'г/л', correctionIds:['serrapeptase','nattokinase','aspirin'] },
  { marker:'HGB', name:'Гемоглобин (UCUM)', organ:'BLOOD', system:'hematologic', mechanisms:['HEMOGLOBIN_SYNTHESIS','IRON_METABOLISM'], higherIsWorse:false, defaultValue:130, unit:'г/л', correctionIds:['iron_supplement','folate','vitamin_b12'] },
  { marker:'RBC', name:'Эритроциты', organ:'BLOOD', system:'hematologic', mechanisms:['HEMOGLOBIN_SYNTHESIS','ERYTHROPOIESIS'], higherIsWorse:true, defaultValue:5.5, unit:'10^12/л', correctionIds:['serrapeptase','nattokinase','aspirin'] },
  { marker:'PLT', name:'Тромбоциты', organ:'BLOOD', system:'hematologic', mechanisms:['PLATELET_AGGREGATION_INHIBITION','ANTICOAGULANT'], higherIsWorse:true, defaultValue:400, unit:'10^9/л', correctionIds:['aspirin','omega3','nattokinase'] },
  { marker:'WBC', name:'Лейкоциты', organ:'BLOOD', system:'hematologic', mechanisms:['IMMUNE_MODULATION','ANTIINFLAMMATORY'], higherIsWorse:true, defaultValue:9.0, unit:'10^9/л', correctionIds:['vitamin_d3','zinc_sup','probiotic'] },
  { marker:'Neutrophils', name:'Нейтрофилы', organ:'BLOOD', system:'hematologic', mechanisms:['IMMUNE_MODULATION','ANTIINFLAMMATORY'], higherIsWorse:true, defaultValue:6.5, unit:'10^9/л', correctionIds:['vitamin_d3','zinc_sup','probiotic'] },
  { marker:'Lymphocytes', name:'Лимфоциты', organ:'BLOOD', system:'hematologic', mechanisms:['IMMUNE_MODULATION','ANXIOLYTIC'], higherIsWorse:false, defaultValue:1.5, unit:'10^9/л', correctionIds:['vitamin_d3','zinc_sup','ashwagandha'] },
  { marker:'RETICULOCYTES', name:'Ретикулоциты', organ:'BLOOD', system:'hematologic', mechanisms:['ERYTHROPOIESIS','HEMOGLOBIN_SYNTHESIS'], higherIsWorse:true, defaultValue:2.5, unit:'%', correctionIds:['iron_supplement','folate','vitamin_b12'] },
  { marker:'ERYTHROPOIETIN', name:'Эритропоэтин', organ:'BLOOD', system:'hematologic', mechanisms:['ERYTHROPOIESIS','IRON_METABOLISM'], higherIsWorse:true, defaultValue:25, unit:'мМЕ/мл', correctionIds:['serrapeptase','nattokinase'] },
  { marker:'HAPTOGLOBIN', name:'Гаптоглобин', organ:'BLOOD', system:'hematologic', mechanisms:['ANTIOXIDANT','HEMOGLOBIN_SYNTHESIS'], higherIsWorse:false, defaultValue:0.5, unit:'г/л', correctionIds:['vitamin_e','curcumin_sup','alpha_lipoic'] },
  { marker:'ESR', name:'СОЭ', organ:'BLOOD', system:'hematologic', mechanisms:['ANTIINFLAMMATORY','NF_KB_INHIBITION','COX2_INHIBITION'], higherIsWorse:true, defaultValue:20, unit:'мм/ч', correctionIds:['omega3','curcumin_sup','ashwagandha'] },

  // ─── COAGULATION ───
  { marker:'D-dimer', name:'D-димер', organ:'BLOOD', system:'hematologic', mechanisms:['PLATELET_AGGREGATION_INHIBITION','FIBRINOLYSIS','ANTICOAGULANT'], higherIsWorse:true, defaultValue:0.5, unit:'мкг/мл', correctionIds:['serrapeptase','nattokinase','naringin','lumbrokinase','aspirin'] },
  { marker:'Fibrinogen', name:'Фибриноген', organ:'BLOOD', system:'hematologic', mechanisms:['FIBRINOLYSIS','PLATELET_AGGREGATION_INHIBITION'], higherIsWorse:true, defaultValue:4.0, unit:'г/л', correctionIds:['serrapeptase','nattokinase','lumbrokinase'] },
  { marker:'INR', name:'МНО', organ:'BLOOD', system:'hematologic', mechanisms:['ANTICOAGULANT','PLATELET_AGGREGATION_INHIBITION'], higherIsWorse:true, defaultValue:1.2, unit:'', correctionIds:['aspirin','nattokinase','omega3'] },
  { marker:'APTT', name:'АЧТВ', organ:'BLOOD', system:'hematologic', mechanisms:['ANTICOAGULANT'], higherIsWorse:true, defaultValue:40, unit:'сек', correctionIds:['aspirin','nattokinase'] },

  // ─── RENAL / Kidneys ───
  { marker:'Creatinine', name:'Креатинин', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','OSMOREGULATION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:105, unit:'мкмоль/л', correctionIds:['astragalus','taurine','cordyceps'] },
  { marker:'Urea', name:'Мочевина', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','OSMOREGULATION'], higherIsWorse:true, defaultValue:8, unit:'ммоль/л', correctionIds:['astragalus','taurine','cordyceps'] },
  { marker:'CYSTATIN_C', name:'Цистатин C', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:1.0, unit:'мг/л', correctionIds:['astragalus','cordyceps','taurine'] },
  { marker:'NGAL', name:'NGAL', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:150, unit:'нг/мл', correctionIds:['astragalus','cordyceps'] },
  { marker:'KIM1', name:'KIM-1', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:2.0, unit:'нг/мл', correctionIds:['astragalus','cordyceps'] },
  { marker:'EGFR', name:'СКФ', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','OSMOREGULATION'], higherIsWorse:false, defaultValue:60, unit:'мл/мин', correctionIds:['astragalus','taurine','cordyceps','d_mannose'] },
  { marker:'PROTEIN_URINE', name:'Протеинурия', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:150, unit:'мг/л', correctionIds:['astragalus','taurine','cordyceps'] },
  { marker:'MICROALB', name:'Микроальбуминурия', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','OSMOREGULATION'], higherIsWorse:true, defaultValue:30, unit:'мг/л', correctionIds:['astragalus','taurine','cordyceps'] },
  { marker:'URIC_ACID', name:'Мочевая кислота', organ:'KIDNEYS', system:'renal', mechanisms:['ANTIOXIDANT','RENOPROTECTION'], higherIsWorse:true, defaultValue:420, unit:'мкмоль/л', correctionIds:['taurine','cordyceps','astragalus'] },

  // ─── ENDOCRINE / Hormones ───
  { marker:'TT', name:'Тестостерон общий', organ:'TESTES', system:'endocrine', mechanisms:['TESTOSTERONE_SYNTHESIS','TESTOSTERONE_SUPPORT'], higherIsWorse:false, defaultValue:300, unit:'нг/дл', correctionIds:['zinc_sup','boron','tongkat_ali','fadogia','shilajit'] },
  { marker:'FT', name:'Тестостерон свободный', organ:'TESTES', system:'endocrine', mechanisms:['TESTOSTERONE_SUPPORT','SHBG_REGULATION'], higherIsWorse:false, defaultValue:8, unit:'пг/мл', correctionIds:['boron','tongkat_ali','zinc_sup','mesterolone'] },
  { marker:'E2', name:'Эстрадиол', organ:'BREAST', system:'endocrine', mechanisms:['AROMATASE_INHIBITION','ESTROGEN_MODULATION'], higherIsWorse:true, defaultValue:150, unit:'пг/мл', correctionIds:['dim','indinol','anastrozole','zinc_sup'] },
  { marker:'PRL', name:'Пролактин', organ:'PITUITARY', system:'endocrine', mechanisms:['PROLACTIN_SUPPRESSION','DOPAMINE_PRECURSOR'], higherIsWorse:true, defaultValue:15, unit:'нг/мл', correctionIds:['vitex','p5p','cabergoline'] },
  { marker:'LH', name:'ЛГ', organ:'PITUITARY', system:'endocrine', mechanisms:['LH_UP','GNRH_UP'], higherIsWorse:false, defaultValue:1, unit:'мМЕ/мл', correctionIds:['enclomiphene','daa','tamoxifen'] },
  { marker:'FSH', name:'ФСГ', organ:'PITUITARY', system:'endocrine', mechanisms:['FSH_UP','GNRH_UP'], higherIsWorse:false, defaultValue:1, unit:'мМЕ/мл', correctionIds:['enclomiphene','daa','tamoxifen'] },
  { marker:'SHBG', name:'ГСПГ', organ:'LIVER', system:'endocrine', mechanisms:['SHBG_REGULATION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:60, unit:'нмоль/л', correctionIds:['boron','tongkat_ali','mesterolone'] },
  { marker:'DHT', name:'ДГТ', organ:'PROSTATE', system:'endocrine', mechanisms:['5AR_INHIBITION','DHT_REDUCTION'], higherIsWorse:true, defaultValue:870, unit:'пг/мл', correctionIds:['saw_palmetto','zinc_sup','mesterolone'] },
  { marker:'PROG', name:'Прогестерон', organ:'ADRENALS', system:'endocrine', mechanisms:['HORMONE_BALANCE'], higherIsWorse:false, defaultValue:0.3, unit:'нг/мл', correctionIds:['vitex','ashwagandha','p5p'] },
  { marker:'CORTISOL', name:'Кортизол', organ:'ADRENALS', system:'endocrine', mechanisms:['CORTISOL_REDUCTION','ADAPTOGENIC','GABA_MODULATION'], higherIsWorse:true, defaultValue:550, unit:'нмоль/л', correctionIds:['ashwagandha','phosphatidylserine','magnesium_l_threonate','l_theanine'] },
  { marker:'DHEA_S', name:'ДГЭА-С', organ:'ADRENALS', system:'endocrine', mechanisms:['HORMONE_BALANCE','ADAPTOGENIC'], higherIsWorse:false, defaultValue:80, unit:'мкг/дл', correctionIds:['ashwagandha','shilajit','pregnenolone'] },
  { marker:'ANDROSTENEDIONE', name:'Андростендион', organ:'ADRENALS', system:'endocrine', mechanisms:['HORMONE_BALANCE','AROMATASE_INHIBITION'], higherIsWorse:true, defaultValue:6, unit:'нмоль/л', correctionIds:['dim','indinol','zinc_sup'] },
  { marker:'GH', name:'Гормон роста', organ:'PITUITARY', system:'endocrine', mechanisms:['GH_RELEASE','IGF1_UP'], higherIsWorse:false, defaultValue:0.5, unit:'нг/мл', correctionIds:['cjc1295','ghrp2','ipamorelin','mk677'] },
  { marker:'IGF1', name:'ИФР-1', organ:'LIVER', system:'endocrine', mechanisms:['IGF1_UP','GH_RELEASE'], higherIsWorse:false, defaultValue:100, unit:'нг/мл', correctionIds:['mk677','cjc1295','ghrp6','ipamorelin'] },
  { marker:'IGFBP3', name:'ИФР-СБ3', organ:'LIVER', system:'endocrine', mechanisms:['IGF1_UP'], higherIsWorse:false, defaultValue:2, unit:'мг/л', correctionIds:['mk677','cjc1295'] },

  // ─── THYROID ───
  { marker:'TSH', name:'ТТГ', organ:'THYROID', system:'endocrine', mechanisms:['THYROID_HORMONE_SYNTHESIS','THYROID_HORMONE_METABOLISM'], higherIsWorse:true, defaultValue:4.0, unit:'мМЕ/л', correctionIds:['zinc_sup','selenium_sup','ashwagandha'] },
  { marker:'FT3', name:'Т3 свободный', organ:'THYROID', system:'endocrine', mechanisms:['THYROID_HORMONE_METABOLISM','THYROID_HORMONE_SYNTHESIS'], higherIsWorse:false, defaultValue:3.1, unit:'пмоль/л', correctionIds:['ashwagandha','zinc_sup','selenium_sup'] },
  { marker:'FT4', name:'Т4 свободный', organ:'THYROID', system:'endocrine', mechanisms:['THYROID_HORMONE_SYNTHESIS'], higherIsWorse:false, defaultValue:10, unit:'пмоль/л', correctionIds:['ashwagandha','zinc_sup','selenium_sup'] },

  // ─── PANCREATIC / Glucose ───
  { marker:'GLU', name:'Глюкоза', organ:'PANCREAS', system:'metabolic', mechanisms:['AMPK_ACTIVATION','INSULIN_SENSITIVITY','GLUCOSE_METABOLISM'], higherIsWorse:true, defaultValue:5.6, unit:'ммоль/л', correctionIds:['berberine','alpha_lipoic','chromium','taurine'] },
  { marker:'HbA1c', name:'Гликированный Hb', organ:'PANCREAS', system:'metabolic', mechanisms:['AMPK_ACTIVATION','INSULIN_SENSITIVITY','GLUCOSE_METABOLISM'], higherIsWorse:true, defaultValue:5.7, unit:'%', correctionIds:['berberine','alpha_lipoic','chromium','vitamin_d3'] },
  { marker:'INS', name:'Инсулин', organ:'PANCREAS', system:'metabolic', mechanisms:['INSULIN_SENSITIVITY','AMPK_ACTIVATION'], higherIsWorse:true, defaultValue:17, unit:'мМЕ/л', correctionIds:['berberine','alpha_lipoic','magnesium'] },
  { marker:'HOMAIR', name:'HOMA-IR', organ:'PANCREAS', system:'metabolic', mechanisms:['INSULIN_SENSITIVITY','AMPK_ACTIVATION'], higherIsWorse:true, defaultValue:2.7, unit:'', correctionIds:['berberine','alpha_lipoic','magnesium'] },
  { marker:'C_PEPTIDE', name:'C-пептид', organ:'PANCREAS', system:'metabolic', mechanisms:['INSULIN_SENSITIVITY'], higherIsWorse:true, defaultValue:1200, unit:'пмоль/л', correctionIds:['berberine','alpha_lipoic'] },
  { marker:'AMYLASE', name:'Амилаза', organ:'PANCREAS', system:'metabolic', mechanisms:['ANTIINFLAMMATORY'], higherIsWorse:true, defaultValue:100, unit:'U/L', correctionIds:['curcumin_sup','omega3','probiotic'] },
  { marker:'LIPASE', name:'Липаза', organ:'PANCREAS', system:'metabolic', mechanisms:['ANTIINFLAMMATORY'], higherIsWorse:true, defaultValue:60, unit:'U/L', correctionIds:['curcumin_sup','omega3'] },

  // ─── INFLAMMATION / Immune ───
  { marker:'CRP', name:'СРБ', organ:'LIVER', system:'hematologic', mechanisms:['ANTIINFLAMMATORY','NF_KB_INHIBITION','COX2_INHIBITION'], higherIsWorse:true, defaultValue:5, unit:'мг/л', correctionIds:['omega3','curcumin_sup','ashwagandha','probiotic'] },
  { marker:'TNF_ALPHA', name:'ФНО-α', organ:'IMMUNE_SYSTEM', system:'immune', mechanisms:['NF_KB_INHIBITION','ANTIINFLAMMATORY'], higherIsWorse:true, defaultValue:8, unit:'пг/мл', correctionIds:['omega3','curcumin_sup','ashwagandha'] },
  { marker:'IL6', name:'ИЛ-6', organ:'IMMUNE_SYSTEM', system:'immune', mechanisms:['NF_KB_INHIBITION','ANTIINFLAMMATORY'], higherIsWorse:true, defaultValue:7, unit:'пг/мл', correctionIds:['omega3','curcumin_sup','vitamin_d3'] },
  { marker:'IL1B', name:'ИЛ-1β', organ:'IMMUNE_SYSTEM', system:'immune', mechanisms:['NF_KB_INHIBITION','ANTIINFLAMMATORY'], higherIsWorse:true, defaultValue:5, unit:'пг/мл', correctionIds:['omega3','curcumin_sup'] },

  // ─── METABOLIC / General ───
  { marker:'HOMOCYSTEINE', name:'Гомоцистеин', organ:'LIVER', system:'hepatic', mechanisms:['METHYLATION','HOMOCYSTEINE_LOWERING','METHYL_DONATION'], higherIsWorse:true, defaultValue:15, unit:'мкмоль/л', correctionIds:['methylfolate','methylcobalamin','tmg','vitamin_b6','taurine'] },
  { marker:'FRUCTOSAMINE', name:'Фруктозамин', organ:'PANCREAS', system:'metabolic', mechanisms:['AMPK_ACTIVATION','INSULIN_SENSITIVITY'], higherIsWorse:true, defaultValue:285, unit:'мкмоль/л', correctionIds:['berberine','alpha_lipoic'] },
  { marker:'LDH', name:'ЛДГ', organ:'LIVER', system:'hepatic', mechanisms:['ANTIOXIDANT','MITOCHONDRIAL_ENERGY'], higherIsWorse:true, defaultValue:250, unit:'U/L', correctionIds:['coq10','alpha_lipoic','nac'] },

  // ─── VITAMINS & MINERALS ───
  { marker:'VITD', name:'Витамин D 25-OH', organ:'BONES', system:'endocrine', mechanisms:['VDR_AGONISM','CALCIUM_ABSORPTION','BONE_MINERALIZATION'], higherIsWorse:false, defaultValue:30, unit:'нг/мл', correctionIds:['vitamin_d3','vitamin_k2','magnesium'] },
  { marker:'B12', name:'Витамин B12', organ:'BLOOD', system:'hematologic', mechanisms:['METHYLATION','MYELIN_SYNTHESIS','HOMOCYSTEINE_LOWERING'], higherIsWorse:false, defaultValue:200, unit:'пг/мл', correctionIds:['methylcobalamin','folate','tmg'] },
  { marker:'FOL', name:'Фолат', organ:'BLOOD', system:'hematologic', mechanisms:['METHYLATION','DNA_SYNTHESIS','HOMOCYSTEINE_LOWERING'], higherIsWorse:false, defaultValue:3, unit:'нг/мл', correctionIds:['methylfolate','methylcobalamin','tmg'] },
  { marker:'VITAMIN_E', name:'Витамин E', organ:'BLOOD', system:'cardio', mechanisms:['LIPID_PEROXIDATION_INHIBITION','MEMBRANE_STABILIZATION','ANTIOXIDANT'], higherIsWorse:false, defaultValue:12, unit:'мкмоль/л', correctionIds:['vitamin_e','omega3','coq10'] },
  { marker:'VITAMIN_A', name:'Витамин A', organ:'LIVER', system:'hepatic', mechanisms:['RETINOID_RECEPTOR','IMMUNE_MODULATION'], higherIsWorse:false, defaultValue:1.0, unit:'мкмоль/л', correctionIds:['vitamin_d3','zinc_sup'] },
  { marker:'FERRITIN', name:'Ферритин', organ:'LIVER', system:'hematologic', mechanisms:['IRON_METABOLISM','HEMOGLOBIN_SYNTHESIS','ANTIOXIDANT'], higherIsWorse:true, defaultValue:300, unit:'мкг/л', correctionIds:['curcumin_sup','aspirin','vitamin_e'] },
  { marker:'IRON', name:'Железо', organ:'BLOOD', system:'hematologic', mechanisms:['IRON_METABOLISM','HEMOGLOBIN_SYNTHESIS','COLLAGEN_SYNTHESIS'], higherIsWorse:false, defaultValue:10, unit:'мкмоль/л', correctionIds:['vitamin_c','folate','vitamin_b12'] },
  { marker:'TIBC', name:'ОЖСС', organ:'BLOOD', system:'hematologic', mechanisms:['IRON_METABOLISM','TRANSFERRIN'], higherIsWorse:true, defaultValue:70, unit:'мкмоль/л', correctionIds:['vitamin_c','vitamin_b6','copper_supplement'] },
  { marker:'TRANSFERRIN', name:'Трансферрин', organ:'BLOOD', system:'hematologic', mechanisms:['IRON_METABOLISM','HEMOGLOBIN_SYNTHESIS'], higherIsWorse:false, defaultValue:2.0, unit:'г/л', correctionIds:['vitamin_c','vitamin_b6','zinc_sup'] },
  { marker:'UIBC', name:'Лат. ЖСС', organ:'BLOOD', system:'hematologic', mechanisms:['IRON_METABOLISM','TRANSFERRIN'], higherIsWorse:false, defaultValue:45, unit:'мкмоль/л', correctionIds:['vitamin_c','iron_supplement'] },
  { marker:'SODIUM', name:'Натрий', organ:'KIDNEYS', system:'renal', mechanisms:['OSMOREGULATION','ELECTROLYTE_BALANCE'], higherIsWorse:true, defaultValue:145, unit:'ммоль/л', correctionIds:['taurine','d_mannose'] },
  { marker:'POTASSIUM', name:'Калий', organ:'HEART', system:'cardio', mechanisms:['ELECTROLYTE_BALANCE','HEART_RHYTHM','BLOOD_PRESSURE'], higherIsWorse:true, defaultValue:5.1, unit:'ммоль/л', correctionIds:['magnesium','taurine'] },
  { marker:'CALCIUM', name:'Кальций', organ:'BONES', system:'musculoskeletal', mechanisms:['CALCIUM_REGULATION','BONE_MINERALIZATION','VDR_AGONISM'], higherIsWorse:true, defaultValue:2.6, unit:'ммоль/л', correctionIds:['vitamin_d3','vitamin_k2','magnesium'] },
  { marker:'PHOSPHORUS', name:'Фосфор', organ:'BONES', system:'musculoskeletal', mechanisms:['BONE_MINERALIZATION','ENERGY_PRODUCTION'], higherIsWorse:true, defaultValue:1.45, unit:'ммоль/л', correctionIds:['vitamin_d3','vitamin_k2'] },
  { marker:'MAGNESIUM', name:'Магний', organ:'HEART', system:'cardio', mechanisms:['GABA_MODULATION','NMDA_BLOCK','HEART_RHYTHM','ELECTROLYTE_BALANCE'], higherIsWorse:false, defaultValue:0.7, unit:'ммоль/л', correctionIds:['magnesium','magnesium_l_threonate','taurine'] },
  { marker:'ZINC', name:'Цинк', organ:'PROSTATE', system:'endocrine', mechanisms:['ZINC_COFACTOR','ANTIOXIDANT','AROMATASE_INHIBITION','TESTOSTERONE_SYNTHESIS'], higherIsWorse:false, defaultValue:11, unit:'мкмоль/л', correctionIds:['zinc_sup','boron'] },
  { marker:'SELENIUM', name:'Селен', organ:'THYROID', system:'endocrine', mechanisms:['SELENOPROTEIN_SYNTHESIS','THYROID_HORMONE_METABOLISM','ANTIOXIDANT'], higherIsWorse:false, defaultValue:70, unit:'мкг/л', correctionIds:['selenium_sup','zinc_sup'] },
  { marker:'COPPER', name:'Медь', organ:'LIVER', system:'hematologic', mechanisms:['IRON_METABOLISM','CERULOPLASMIN','COLLAGEN_CROSS_LINKING'], higherIsWorse:false, defaultValue:10, unit:'мкмоль/л', correctionIds:['zinc_sup','vitamin_c'] },

  // ─── ONCOLOGY / Prostate ───
  { marker:'PSA', name:'ПСА общий', organ:'PROSTATE', system:'reproductive', mechanisms:['5AR_INHIBITION','DHT_REDUCTION','ANTIANDROGEN'], higherIsWorse:true, defaultValue:4, unit:'нг/мл', correctionIds:['saw_palmetto','zinc_sup','mesterolone'] },

  // ─── BONE ───
  { marker:'PARATHYROID', name:'Паратгормон', organ:'BONES', system:'musculoskeletal', mechanisms:['CALCIUM_REGULATION','BONE_MINERALIZATION'], higherIsWorse:true, defaultValue:65, unit:'пг/мл', correctionIds:['vitamin_d3','vitamin_k2','magnesium'] },
  { marker:'CALCITONIN', name:'Кальцитонин', organ:'BONES', system:'musculoskeletal', mechanisms:['BONE_MINERALIZATION','CALCIUM_REGULATION'], higherIsWorse:false, defaultValue:0, unit:'пг/мл', correctionIds:['vitamin_d3','vitamin_k2'] },
  { marker:'OSTEOCALCIN', name:'Остеокальцин', organ:'BONES', system:'musculoskeletal', mechanisms:['BONE_MINERALIZATION','GLA_PROTEIN_ACTIVATION'], higherIsWorse:false, defaultValue:5, unit:'нг/мл', correctionIds:['vitamin_k2','vitamin_d3'] },

  // ─── NEURO ───
  { marker:'CHLORIDE', name:'Хлор', organ:'BRAIN', system:'neuro', mechanisms:['ELECTROLYTE_BALANCE','OSMOREGULATION'], higherIsWorse:true, defaultValue:108, unit:'ммоль/л', correctionIds:['taurine','magnesium'] },
  { marker:'OSMOLALITY', name:'Осмоляльность', organ:'KIDNEYS', system:'neuro', mechanisms:['OSMOREGULATION','ELECTROLYTE_BALANCE'], higherIsWorse:true, defaultValue:295, unit:'мОсм/кг', correctionIds:['taurine','d_mannose'] },
  { marker:'ANION_GAP', name:'Анионный провал', organ:'KIDNEYS', system:'renal', mechanisms:['ELECTROLYTE_BALANCE','OSMOREGULATION'], higherIsWorse:true, defaultValue:16, unit:'ммоль/л', correctionIds:['taurine','magnesium'] },
  { marker:'LACTATE', name:'Лактат (нейро)', organ:'BRAIN', system:'neuro', mechanisms:['MITOCHONDRIAL_ENERGY','COENZYME_ELECTRON_TRANSPORT'], higherIsWorse:true, defaultValue:2.2, unit:'ммоль/л', correctionIds:['coq10','alpha_lipoic','shilajit'] },
  { marker:'GLOBULIN', name:'Глобулин', organ:'LIVER', system:'immune', mechanisms:['IMMUNE_MODULATION','PROTEIN_SYNTHESIS'], higherIsWorse:false, defaultValue:20, unit:'г/л', correctionIds:['collagen_ii','glutamine','vitamin_b6'] },

  // ─── PROBLEM-ORIENTED: новые маркеры ───
  { marker:'ALDOSTERONE', name:'Альдостерон', organ:'ADRENALS', system:'cardio', mechanisms:['BP_REDUCTION','ELECTROLYTE_BALANCE','OSMOREGULATION'], higherIsWorse:true, defaultValue:200, unit:'пг/мл', correctionIds:['telmisartan','nebivolol','taurine'] },
  { marker:'RENIN', name:'Ренин прямой', organ:'KIDNEYS', system:'cardio', mechanisms:['BP_REDUCTION','OSMOREGULATION'], higherIsWorse:true, defaultValue:30, unit:'пг/мл', correctionIds:['telmisartan','nebivolol'] },
  { marker:'ACTH', name:'АКТГ', organ:'PITUITARY', system:'endocrine', mechanisms:['HORMONE_BALANCE','CORTISOL_REDUCTION'], higherIsWorse:true, defaultValue:35, unit:'пг/мл', correctionIds:['ashwagandha','phosphatidylserine'] },
  { marker:'OH17_PROGESTERONE', name:'17-ОН-прогестерон', organ:'ADRENALS', system:'endocrine', mechanisms:['HORMONE_BALANCE','AROMATASE_INHIBITION'], higherIsWorse:true, defaultValue:4.0, unit:'нмоль/л', correctionIds:['dim','indinol'] },
  { marker:'TPO_AB', name:'Антитела к ТПО', organ:'THYROID', system:'endocrine', mechanisms:['IMMUNE_MODULATION','THYROID_HORMONE_SYNTHESIS'], higherIsWorse:true, defaultValue:34, unit:'МЕ/мл', correctionIds:['selenium_sup','zinc_sup','vitamin_d3'] },
  { marker:'TG_AB', name:'Антитела к ТГ', organ:'THYROID', system:'endocrine', mechanisms:['IMMUNE_MODULATION','THYROID_HORMONE_SYNTHESIS'], higherIsWorse:true, defaultValue:115, unit:'МЕ/мл', correctionIds:['selenium_sup','vitamin_d3'] },
  { marker:'MPV', name:'Средний объём тромбоцита', organ:'BLOOD', system:'hematologic', mechanisms:['PLATELET_AGGREGATION_INHIBITION','ANTICOAGULANT'], higherIsWorse:true, defaultValue:11, unit:'fL', correctionIds:['aspirin','omega3'] },
  { marker:'URINE_PH', name:'pH мочи', organ:'KIDNEYS', system:'renal', mechanisms:['OSMOREGULATION','ELECTROLYTE_BALANCE'], higherIsWorse:true, defaultValue:7.5, unit:'', correctionIds:['taurine','d_mannose'] },
  { marker:'URINE_OSM', name:'Осмоляльность мочи', organ:'KIDNEYS', system:'renal', mechanisms:['OSMOREGULATION','RENOPROTECTION'], higherIsWorse:true, defaultValue:800, unit:'мОсм/кг', correctionIds:['taurine','astragalus'] },
  { marker:'VITAMIN_B6', name:'Витамин B6 (PLP)', organ:'BLOOD', system:'metabolic', mechanisms:['DOPAMINE_PRECURSOR','PROLACTIN_SUPPRESSION','METHYLATION'], higherIsWorse:false, defaultValue:35, unit:'нмоль/л', correctionIds:['p5p','methylfolate'] },
  { marker:'MAR_TEST', name:'MAR-тест (IgG)', organ:'TESTES', system:'reproductive', mechanisms:['IMMUNE_MODULATION'], higherIsWorse:true, defaultValue:10, unit:'%', correctionIds:['zinc_sup','omega3','vitamin_d3'] },
  { marker:'DFI', name:'Фрагментация ДНК', organ:'TESTES', system:'reproductive', mechanisms:['ANTIOXIDANT','GLUTATHIONE_SYNTHESIS'], higherIsWorse:true, defaultValue:15, unit:'%', correctionIds:['nac','coq10','zinc_sup','selenium_sup'] },
  { marker:'HDS', name:'HDS (незрелый хроматин)', organ:'TESTES', system:'reproductive', mechanisms:['ANTIOXIDANT','DNA_SYNTHESIS'], higherIsWorse:true, defaultValue:15, unit:'%', correctionIds:['nac','coq10','zinc_sup'] },

  // ══════════════════════════════════════════════════════════════════════
  //  UCUM CANONICAL ALIASES — для совместимости с UCUM_MAP (constants.ts)
  //  Канонические имена UCUM_MAP, отсутствующие в LAB_MARKER_MAP выше.
  //  Резолвятся через LAB_MARKER_MAP_BY_NAME (без resolveMarker).
  // ══════════════════════════════════════════════════════════════════════
  { marker:'CREATININE', name:'Креатинин (UCUM)', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','OSMOREGULATION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:110, unit:'мкмоль/л', correctionIds:['astragalus','taurine','cordyceps'] },
  { marker:'UREA', name:'Мочевина (UCUM)', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','OSMOREGULATION'], higherIsWorse:true, defaultValue:7.1, unit:'ммоль/л', correctionIds:['astragalus','taurine','cordyceps'] },
  { marker:'BIL', name:'Билирубин общий (UCUM)', organ:'LIVER', system:'hepatic', mechanisms:['BILE_ACID_MOD','BILE_FLOW_STIMULATION'], higherIsWorse:true, defaultValue:17.1, unit:'мкмоль/л', correctionIds:['tudca','milk_thistle','vitamin_k2'] },
  { marker:'DBIL', name:'Билирубин прямой (UCUM)', organ:'LIVER', system:'hepatic', mechanisms:['BILE_ACID_MOD','BILE_FLOW_STIMULATION'], higherIsWorse:true, defaultValue:5, unit:'мкмоль/л', correctionIds:['tudca','vitamin_k2','milk_thistle'] },
  { marker:'TG', name:'Триглицериды (UCUM)', organ:'HEART', system:'cardio', mechanisms:['AMPK_ACTIVATION','FATTY_ACID_TRANSPORT','LIPID_LOWERING'], higherIsWorse:true, defaultValue:1.7, unit:'ммоль/л', correctionIds:['omega3','berberine','niacin'] },
  { marker:'D_DIMER', name:'D-димер (UCUM)', organ:'BLOOD', system:'hematologic', mechanisms:['PLATELET_AGGREGATION_INHIBITION','FIBRINOLYSIS','ANTICOAGULANT'], higherIsWorse:true, defaultValue:0.5, unit:'мкг/мл', correctionIds:['serrapeptase','nattokinase','naringin','lumbrokinase','aspirin'] },
  { marker:'FIBRINOGEN', name:'Фибриноген (UCUM)', organ:'BLOOD', system:'hematologic', mechanisms:['FIBRINOLYSIS','PLATELET_AGGREGATION_INHIBITION'], higherIsWorse:true, defaultValue:4.0, unit:'г/л', correctionIds:['serrapeptase','nattokinase','lumbrokinase','omega3'] },
  { marker:'TROPONIN', name:'Тропонин (UCUM)', organ:'HEART', system:'cardio', mechanisms:['COENZYME_ELECTRON_TRANSPORT','MITOCHONDRIAL_ENERGY'], higherIsWorse:true, defaultValue:0.04, unit:'нг/мл', correctionIds:['coq10','omega3','magnesium','l_carnitine'] },
  { marker:'HOMA', name:'HOMA-IR (UCUM)', organ:'PANCREAS', system:'metabolic', mechanisms:['INSULIN_SENSITIVITY','AMPK_ACTIVATION'], higherIsWorse:true, defaultValue:2.7, unit:'', correctionIds:['berberine','alpha_lipoic','magnesium'] },
  { marker:'UA', name:'Мочевая кислота (UCUM)', organ:'KIDNEYS', system:'renal', mechanisms:['ANTIOXIDANT','RENOPROTECTION'], higherIsWorse:true, defaultValue:420, unit:'мкмоль/л', correctionIds:['taurine','cordyceps','astragalus'] },
  { marker:'TP', name:'Общий белок (UCUM)', organ:'LIVER', system:'hepatic', mechanisms:['PROTEIN_SYNTHESIS','AMINO_ACID_METABOLISM'], higherIsWorse:false, defaultValue:60, unit:'г/л', correctionIds:['whey_protein','glutamine','vitamin_b6','leucine'] },
  { marker:'K', name:'Калий (UCUM)', organ:'HEART', system:'cardio', mechanisms:['ELECTROLYTE_BALANCE','HEART_RHYTHM','BLOOD_PRESSURE'], higherIsWorse:true, defaultValue:5.1, unit:'ммоль/л', correctionIds:['magnesium','taurine','potassium_citrate'] },
  { marker:'NA', name:'Натрий (UCUM)', organ:'KIDNEYS', system:'renal', mechanisms:['OSMOREGULATION','ELECTROLYTE_BALANCE'], higherIsWorse:true, defaultValue:145, unit:'ммоль/л', correctionIds:['taurine','d_mannose','potassium_citrate'] },
  { marker:'CA', name:'Кальций (UCUM)', organ:'BONES', system:'musculoskeletal', mechanisms:['CALCIUM_REGULATION','BONE_MINERALIZATION','VDR_AGONISM'], higherIsWorse:true, defaultValue:2.6, unit:'ммоль/л', correctionIds:['vitamin_d3','vitamin_k2','magnesium'] },
  { marker:'P', name:'Фосфор (UCUM)', organ:'BONES', system:'musculoskeletal', mechanisms:['BONE_MINERALIZATION','ENERGY_PRODUCTION'], higherIsWorse:true, defaultValue:1.5, unit:'ммоль/л', correctionIds:['vitamin_d3','vitamin_k2','magnesium'] },
  { marker:'MG', name:'Магний (UCUM)', organ:'HEART', system:'cardio', mechanisms:['GABA_MODULATION','NMDA_BLOCK','HEART_RHYTHM','ELECTROLYTE_BALANCE'], higherIsWorse:false, defaultValue:1.0, unit:'ммоль/л', correctionIds:['magnesium','magnesium_l_threonate','taurine'] },
  { marker:'INHB', name:'Ингибин B (UCUM алиас)', organ:'TESTES', system:'reproductive', mechanisms:['ANTIOXIDANT','GLUTATHIONE_SYNTHESIS'], higherIsWorse:false, defaultValue:80, unit:'пг/мл', correctionIds:['nac','coq10','zinc_sup','selenium_sup'] },
  { marker:'INHIBIN_B', name:'Ингибин B', organ:'TESTES', system:'reproductive', mechanisms:['ANTIOXIDANT','GLUTATHIONE_SYNTHESIS'], higherIsWorse:false, defaultValue:80, unit:'пг/мл', correctionIds:['nac','coq10','zinc_sup','selenium_sup'] },
  { marker:'AMH', name:'Антимюллеров гормон', organ:'TESTES', system:'reproductive', mechanisms:['ANTIOXIDANT','HORMONE_BALANCE'], higherIsWorse:false, defaultValue:1.0, unit:'нг/мл', correctionIds:['nac','coq10','ashwagandha','shilajit'] },
  { marker:'ESTRADIOL_SENS', name:'Эстрадиол чувствительный', organ:'BREAST', system:'endocrine', mechanisms:['AROMATASE_INHIBITION','ESTROGEN_MODULATION'], higherIsWorse:true, defaultValue:150, unit:'пмоль/л', correctionIds:['anastrozole','dim','exemestane','indinol'] },
  { marker:'PROGESTERONE', name:'Прогестерон (UCUM)', organ:'ADRENALS', system:'endocrine', mechanisms:['HORMONE_BALANCE'], higherIsWorse:false, defaultValue:0.3, unit:'нг/мл', correctionIds:['cabergoline','vitex','ashwagandha','p5p'] },
  { marker:'PREALBUMIN', name:'Преальбумин', organ:'LIVER', system:'hepatic', mechanisms:['PROTEIN_SYNTHESIS','AMINO_ACID_METABOLISM'], higherIsWorse:false, defaultValue:200, unit:'мг/л', correctionIds:['whey_protein','bcaa','leucine','glutamine'] },
  { marker:'UACR', name:'Альбумин/креатинин мочи', organ:'KIDNEYS', system:'renal', mechanisms:['RENOPROTECTION','ANTIOXIDANT'], higherIsWorse:true, defaultValue:30, unit:'мг/г', correctionIds:['telmisartan','astragalus','vitamin_d3','taurine'] },
  { marker:'ECHO_LV_MASS', name:'Масса ЛЖ (эхо)', organ:'HEART', system:'cardio', mechanisms:['BP_REDUCTION','BETA1_BLOCKADE','COENZYME_ELECTRON_TRANSPORT'], higherIsWorse:true, defaultValue:200, unit:'г', correctionIds:['telmisartan','nebivolol','spironolactone','omega3'] },
  { marker:'ECHO_EF', name:'Фракция выброса ЛЖ', organ:'HEART', system:'cardio', mechanisms:['COENZYME_ELECTRON_TRANSPORT','BP_REDUCTION'], higherIsWorse:false, defaultValue:50, unit:'%', correctionIds:['carvedilol','ramipril','spironolactone','coq10'] },
  { marker:'ECHO_LA', name:'Левое предсердие (размер)', organ:'HEART', system:'cardio', mechanisms:['BP_REDUCTION','BETA1_BLOCKADE'], higherIsWorse:true, defaultValue:40, unit:'мм', correctionIds:['telmisartan','nebivolol','omega3','magnesium'] },
  { marker:'PROINSULIN', name:'Проинсулин', organ:'PANCREAS', system:'metabolic', mechanisms:['INSULIN_SENSITIVITY','AMPK_ACTIVATION'], higherIsWorse:true, defaultValue:10, unit:'пмоль/л', correctionIds:['berberine','alpha_lipoic','chromium','inositol'] },
  { marker:'A_G_RATIO', name:'Альбумин/глобулин коэффициент', organ:'LIVER', system:'hepatic', mechanisms:['PROTEIN_SYNTHESIS','AMINO_ACID_METABOLISM'], higherIsWorse:false, defaultValue:1.1, unit:'', correctionIds:['whey_protein','glutamine','vitamin_b6'] },
];

// ─── Quick lookup functions ───
export const LAB_MARKER_MAP_BY_NAME: Record<string, LabMarkerMap> = {};
for (const m of LAB_MARKER_MAP) LAB_MARKER_MAP_BY_NAME[m.marker] = m;

export function getMarkerMap(marker: string): LabMarkerMap | undefined {
  return LAB_MARKER_MAP_BY_NAME[marker];
}

export function getCorrectionIds(marker: string): string[] {
  return LAB_MARKER_MAP_BY_NAME[marker]?.correctionIds || [];
}

export function getMarkerOrgan(marker: string): string {
  return LAB_MARKER_MAP_BY_NAME[marker]?.organ || '';
}
