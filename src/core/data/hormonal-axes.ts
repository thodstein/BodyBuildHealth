export interface HormonalAxis {
  id: string;
  name: string;
  type: 'hormonal_axis' | 'hormonal_dysfunction' | 'hormonal_intervention';
  pathway: string;
  organs: string;
  target: string;
  description: string;
}

export const HORMONAL_AXES_DB: HormonalAxis[] = [
  { id: "AXIS_HPA", name: "HPA Axis", type: "hormonal_axis", pathway: "CRH>ACTH>CORTISOL", organs: "HYPOTHALAMUS>PITUITARY>ADRENALS", target: "STRESS_RESPONSE", description: "Ось стресс-реакции" },
  { id: "AXIS_HPT", name: "HPT Axis", type: "hormonal_axis", pathway: "TRH>TSH>T4/T3", organs: "HYPOTHALAMUS>PITUITARY>THYROID", target: "METABOLISM", description: "Ось щитовидки" },
  { id: "AXIS_HPG", name: "HPG Axis", type: "hormonal_axis", pathway: "GnRH>LH/FSH>SEX_HORMONES", organs: "HYPOTHALAMUS>PITUITARY>GONADS", target: "REPRODUCTION", description: "Ось половых гормонов" },
  { id: "AXIS_HPTA", name: "HPTA Axis", type: "hormonal_axis", pathway: "GHRH>GH>IGF1", organs: "HYPOTHALAMUS>PITUITARY>LIVER", target: "GROWTH_REPAIR", description: "Ось роста" },
  { id: "AXIS_METABOLIC", name: "Metabolic Axis", type: "hormonal_axis", pathway: "INSULIN>LEPTIN>ADIPONECTIN", organs: "PANCREAS>FAT_TISSUE", target: "ENERGY_BALANCE", description: "Метаболическая ось" },
  { id: "AXIS_GI", name: "GI Endocrine Axis", type: "hormonal_axis", pathway: "GLP1>GIP>PYY>CCK", organs: "GI_TRACT", target: "APPETITE_DIGESTION", description: "Кишечная эндокринная ось" },
  { id: "AXIS_BONE", name: "Bone Endocrine Axis", type: "hormonal_axis", pathway: "PTH>CALCITONIN>FGF23", organs: "BONE>THYROID>KIDNEY", target: "CALCIUM_BALANCE", description: "Костная эндокринная ось" },
  { id: "AXIS_HPA_DYS", name: "HPA Dysfunction", type: "hormonal_dysfunction", pathway: "CORTISOL_HIGH/DHEA_LOW", organs: "STRESS_BURNOUT", target: "", description: "Хронический стресс" },
  { id: "AXIS_HPT_DYS", name: "HPT Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_T3/HIGH_rT3", organs: "HYPOTHYROIDISM", target: "", description: "Гипотиреоз" },
  { id: "AXIS_HPG_DYS", name: "HPG Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_TESTOSTERONE/HIGH_PROLACTIN", organs: "SEX_DYSFUNCTION", target: "", description: "Гипогонадизм" },
  { id: "AXIS_HPTA_DYS", name: "HPTA Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_GH/LOW_IGF1", organs: "GROWTH_DEFICIT", target: "", description: "Дефицит гормона роста" },
  { id: "AXIS_METABOLIC_DYS", name: "Metabolic Dysfunction", type: "hormonal_dysfunction", pathway: "INSULIN_RESISTANCE/LEPTIN_RESISTANCE", organs: "OBESITY", target: "", description: "Метаболический синдром" },
  { id: "AXIS_GI_DYS", name: "GI Endocrine Dysfunction", type: "hormonal_dysfunction", pathway: "LOW_GLP1/HIGH_GHRELIN", organs: "APPETITE_DYSREGULATION", target: "", description: "Нарушение аппетита" },
  { id: "AXIS_BONE_DYS", name: "Bone Endocrine Dysfunction", type: "hormonal_dysfunction", pathway: "HIGH_PTH/LOW_CALCITONIN", organs: "OSTEOPOROSIS", target: "", description: "Остеопороз" },
  { id: "AXIS_HPA_INTERVENTION", name: "HPA Intervention", type: "hormonal_intervention", pathway: "LOWER_CRH/LOWER_ACTH/RAISE_DHEA", organs: "STRESS_DOWN", target: "", description: "Коррекция стресса" },
  { id: "AXIS_HPT_INTERVENTION", name: "HPT Intervention", type: "hormonal_intervention", pathway: "IMPROVE_T4_TO_T3/LOWER_rT3", organs: "METABOLISM_UP", target: "", description: "Коррекция щитовидки" },
  { id: "AXIS_HPG_INTERVENTION", name: "HPG Intervention", type: "hormonal_intervention", pathway: "LOWER_PROLACTIN/RAISE_LH/FSH", organs: "SEX_HORMONES_UP", target: "", description: "Коррекция половых гормонов" },
  { id: "AXIS_HPTA_INTERVENTION", name: "HPTA Intervention", type: "hormonal_intervention", pathway: "RAISE_GHRH/LOWER_SOMATOSTATIN", organs: "GH_IGF1_UP", target: "", description: "Коррекция роста" },
  { id: "AXIS_METABOLIC_INTERVENTION", name: "Metabolic Intervention", type: "hormonal_intervention", pathway: "IMPROVE_INSULIN/IMPROVE_LEPTIN", organs: "ENERGY_BALANCE_UP", target: "", description: "Коррекция метаболизма" },
  { id: "AXIS_GI_INTERVENTION", name: "GI Endocrine Intervention", type: "hormonal_intervention", pathway: "RAISE_GLP1/LOWER_GHRELIN", organs: "APPETITE_CONTROL", target: "", description: "Коррекция аппетита" },
  { id: "AXIS_BONE_INTERVENTION", name: "Bone Endocrine Intervention", type: "hormonal_intervention", pathway: "LOWER_PTH/RAISE_CALCITONIN", organs: "BONE_STRENGTH_UP", target: "", description: "Коррекция костей" }
];