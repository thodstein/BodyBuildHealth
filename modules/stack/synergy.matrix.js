// Единый каталог БАДов: механизмы, теги, риски-акценты

export const SUPPLEMENTS = [
  {
    code: "VITAMIN_C",
    name: "Витамин C",
    mechanisms: ["OXSTRESS", "IMMUNE", "BARRIER"],
    tags: ["antioxidant", "water_soluble"],
    notes: "Базовый антиоксидант, поддержка иммунитета и коллагена."
  },
  {
    code: "VITAMIN_E",
    name: "Витамин E",
    mechanisms: ["OXSTRESS", "CELL"],
    tags: ["antioxidant", "fat_soluble"],
    notes: "Липидный антиоксидант, защита мембран."
  },
  {
    code: "NAC",
    name: "N-ацетилцистеин",
    mechanisms: ["OXSTRESS", "DET", "IMMUNE"],
    tags: ["glutathione_precursor"],
    notes: "Предшественник глутатиона, детокс, лёгкие."
  },
  {
    code: "ALA",
    name: "Альфа-липоевая кислота",
    mechanisms: ["OXSTRESS", "MITO", "GLUCOSE"],
    tags: ["antioxidant", "insulin_sensitizer"],
    notes: "Митохондрии, глюкоза, регенерация других антиоксидантов."
  },
  {
    code: "COQ10",
    name: "Коэнзим Q10",
    mechanisms: ["MITO", "CVS", "OXSTRESS"],
    tags: ["mitochondria", "heart"],
    notes: "Дыхательная цепь, сердце, энергия."
  },
  {
    code: "PQQ",
    name: "PQQ",
    mechanisms: ["MITO"],
    tags: ["mitochondria", "biogenesis"],
    notes: "Митохондриальный биогенез."
  },
  {
    code: "L_CARNITINE",
    name: "L-карнитин",
    mechanisms: ["MITO", "GLUCOSE"],
    tags: ["fat_oxidation"],
    notes: "Транспорт жирных кислот в митохондрии."
  },
  {
    code: "OMEGA3",
    name: "Омега‑3 (EPA/DHA)",
    mechanisms: ["INFLAMM", "CVS", "BRAIN"],
    tags: ["antiinflammatory", "lipids"],
    notes: "Системное противовоспалительное, сердце, мозг."
  },
  {
    code: "CURCUMIN",
    name: "Куркумин",
    mechanisms: ["INFLAMM", "OXSTRESS"],
    tags: ["antiinflammatory"],
    notes: "NF-κB, цитокины, антиоксидант."
  },
  {
    code: "BERBERINE",
    name: "Берберин",
    mechanisms: ["GLUCOSE", "MICROBIOME"],
    tags: ["insulin_sensitizer"],
    notes: "Глюкоза, микробиом, метаболизм."
  },
  {
    code: "B_COMPLEX",
    name: "B-комплекс",
    mechanisms: ["METHYL", "MITO", "BRAIN"],
    tags: ["cofactors"],
    notes: "Метилирование, энергия, нервная система."
  },
  {
    code: "VITAMIN_D",
    name: "Витамин D",
    mechanisms: ["IMMUNE", "ENDO", "BONE"],
    tags: ["hormone_like"],
    notes: "Иммунитет, гормональный фон, кости."
  },
  {
    code: "ZINC",
    name: "Цинк",
    mechanisms: ["IMMUNE", "CELL", "BARRIER"],
    tags: ["trace_element"],
    notes: "Иммунитет, кожа, барьеры."
  },
  {
    code: "MAGNESIUM",
    name: "Магний",
    mechanisms: ["CVS", "MITO", "ENDO"],
    tags: ["electrolyte"],
    notes: "Сердце, энергия, нервная система."
  },
  {
    code: "PROBIOTICS",
    name: "Пробиотики",
    mechanisms: ["MICROBIOME", "GI", "IMMUNE"],
    tags: ["microbiome"],
    notes: "Микробиом, иммунитет, кишечник."
  },
  {
    code: "PREBIOTICS",
    name: "Пребиотики",
    mechanisms: ["MICROBIOME", "GI"],
    tags: ["fiber"],
    notes: "Питание микробиоты, SCFA."
  },
  {
    code: "L_GLUTAMINE",
    name: "L-глутамин",
    mechanisms: ["GI", "BARRIER"],
    tags: ["gut_fuel"],
    notes: "Эпителий кишечника, барьер."
  }
];
