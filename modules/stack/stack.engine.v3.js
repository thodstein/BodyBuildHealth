// Конфликты: вещества, которые ослабляют друг друга,
// конкурируют за транспорт, рецепторы, ферменты или создают риски.

export const CONFLICT_MATRIX = [
  {
    pair: ["ZINC", "COPPER"],
    type: "absorption",
    severity: 3,
    comment: "Цинк подавляет всасывание меди. Длительный приём без меди → дефицит."
  },
  {
    pair: ["CALCIUM", "IRON"],
    type: "absorption",
    severity: 3,
    comment: "Кальций блокирует всасывание железа. Принимать раздельно."
  },
  {
    pair: ["MAGNESIUM", "CALCIUM"],
    type: "competition",
    severity: 2,
    comment: "Конкурируют за транспорт. Большие дозы вместе → снижение усвоения."
  },
  {
    pair: ["OMEGA3", "CURCUMIN"],
    type: "bleeding_risk",
    severity: 2,
    comment: "Оба снижают агрегацию тромбоцитов. В больших дозах → риск кровотечений."
  },
  {
    pair: ["NAC", "COPPER"],
    type: "chelation",
    severity: 2,
    comment: "NAC связывает медь. Возможен дефицит при длительном приёме."
  },
  {
    pair: ["IRON", "GREEN_TEA"],
    type: "absorption",
    severity: 2,
    comment: "Катехины чая снижают всасывание железа."
  },
  {
    pair: ["BERBERINE", "METFORMIN"],
    type: "glucose_drop",
    severity: 3,
    comment: "Сильное снижение глюкозы. Риск гипогликемии."
  },
  {
    pair: ["VITAMIN_K", "OMEGA3"],
    type: "coagulation",
    severity: 2,
    comment: "Омега‑3 снижает свёртываемость, витамин K повышает. Противонаправленные эффекты."
  },
  {
    pair: ["CURCUMIN", "BLACK_PEPPER"],
    type: "bioavailability_spike",
    severity: 1,
    comment: "Пиперин резко повышает биодоступность куркумина. Может усилить побочные эффекты."
  },
  {
    pair: ["MAGNESIUM", "ZINC"],
    type: "competition",
    severity: 1,
    comment: "Конкурируют за транспорт. Лучше разнести по времени."
  },
  {
    pair: ["PROBIOTICS", "ANTIBIOTICS"],
    type: "antagonism",
    severity: 3,
    comment: "Антибиотики убивают пробиотические штаммы. Принимать раздельно."
  },
  {
    pair: ["VITAMIN_D", "MAGNESIUM"],
    type: "dependency",
    severity: 1,
    comment: "Не конфликт, но зависимость: без магния витамин D работает хуже."
  }
];
