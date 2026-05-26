// Противопоказания: какие вещества нельзя при определённых рисках или состояниях

export const CONTRA_RULES = [
  {
    risk: "BLEEDING_RISK",
    supplements: ["OMEGA3", "CURCUMIN", "GARLIC_EXTRACT"],
    severity: 3,
    comment: "Повышают риск кровотечений."
  },
  {
    risk: "LIVER_STRESS",
    supplements: ["VITAMIN_A", "NIACIN_HIGH", "BERBERINE"],
    severity: 2,
    comment: "Дополнительная нагрузка на печень."
  },
  {
    risk: "KIDNEY_STRESS",
    supplements: ["MAGNESIUM_HIGH", "CREATINE", "VITAMIN_C_HIGH"],
    severity: 2,
    comment: "Могут ухудшить фильтрацию."
  },
  {
    risk: "HYPERTENSION",
    supplements: ["LICORICE", "YOHIMBINE"],
    severity: 3,
    comment: "Повышают давление."
  },
  {
    risk: "ANXIETY",
    supplements: ["CAFFEINE", "YOHIMBINE"],
    severity: 2,
    comment: "Стимуляторы усиливают тревожность."
  },
  {
    risk: "INSULIN_RESISTANCE",
    supplements: ["MALTODEXTRIN", "HIGH_GLUCOSE_CARBS"],
    severity: 3,
    comment: "Ухудшают чувствительность к инсулину."
  },
  {
    risk: "LOW_BLOOD_PRESSURE",
    supplements: ["OMEGA3", "GARLIC_EXTRACT", "CITRULLINE"],
    severity: 2,
    comment: "Могут дополнительно снижать давление."
  },
  {
    risk: "THYROID_ISSUES",
    supplements: ["IODINE_HIGH", "ASHWAGANDHA"],
    severity: 2,
    comment: "Могут нарушать гормональный баланс."
  },
  {
    risk: "GI_IRRITATION",
    supplements: ["CURCUMIN", "MAGNESIUM_OXIDE", "IRON"],
    severity: 2,
    comment: "Раздражают ЖКТ."
  }
];
