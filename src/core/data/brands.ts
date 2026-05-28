export interface Brand {
  id: string;
  name: string;
  type: string;
  country: string;
  description: string;
}

export const BRANDS_DB: Brand[] = [
  { id: "BRAND_HEALTH_FACTOR", name: "Health Factor", type: "brand", country: "Россия", description: "Производитель БАДов и нутра" },
  { id: "BRAND_DR_BADY", name: "DR.BADY", type: "brand", country: "Россия", description: "Российский бренд нутра" },
  { id: "BRAND_EASY_MAGIC", name: "Easy Magic", type: "brand", country: "Россия", description: "Российский бренд функциональных комплексов" },
  { id: "BRAND_MENTOR_MIND", name: "Mentor Mind", type: "brand", country: "Россия", description: "Нейро‑нутра и когнитивные комплексы" },
  { id: "BRAND_ASMD", name: "ASMD", type: "brand", country: "Россия", description: "Российский бренд спортивной и функциональной нутра" },
  { id: "BRAND_LIFE_EXTENSION", name: "Life Extension", type: "brand", country: "США", description: "Премиальная нутра и научные формулы" },
  { id: "BRAND_THORNE", name: "Thorne Research", type: "brand", country: "США", description: "Профессиональная нутра высокого уровня" },
  { id: "BRAND_PURE_ENCAPS", name: "Pure Encapsulations", type: "brand", country: "США", description: "Гипоаллергенные премиальные комплексы" },
  { id: "BRAND_NOW_FOODS", name: "Now Foods", type: "brand", country: "США", description: "Один из крупнейших мировых производителей БАДов" },
  { id: "BRAND_JARROW", name: "Jarrow Formulas", type: "brand", country: "США", description: "Научно ориентированный бренд нутра" },
  { id: "BRAND_SOLGAR", name: "Solgar", type: "brand", country: "США", description: "Один из старейших брендов витаминов и минералов" },
  { id: "BRAND_CALIFORNIA_GOLD", name: "California Gold Nutrition", type: "brand", country: "США", description: "Популярный бренд iHerb" },
  { id: "BRAND_NUTRICOST", name: "Nutricost", type: "brand", country: "USA", description: "Один из крупнейших производителей монокомпонентной нутры" },
  { id: "BRAND_KAGED", name: "Kaged", type: "brand", country: "USA", description: "Премиальная спортивная нутра" },
  { id: "BRAND_OPTIMUM", name: "Optimum Nutrition", type: "brand", country: "USA", description: "Мировой лидер спортивного питания" },
  { id: "BRAND_BULK", name: "Bulk Supplements", type: "brand", country: "USA", description: "Чистые порошковые ингредиенты" },
  { id: "BRAND_GARDEN_OF_LIFE", name: "Garden of Life", type: "brand", country: "USA", description: "Органическая нутра" },
  { id: "BRAND_SPORTS_RESEARCH", name: "Sports Research", type: "brand", country: "USA", description: "Популярный бренд витаминов и омега‑3" },
  { id: "BRAND_MUSCLETECH", name: "MuscleTech", type: "brand", country: "USA", description: "Спортивная нутра" },
  { id: "BRAND_MYPROTEIN", name: "MyProtein", type: "brand", country: "UK", description: "Европейский гигант спортивного питания" },
  { id: "BRAND_SWANSON", name: "Swanson", type: "brand", country: "USA", description: "Бюджетная нутра" },
  { id: "BRAND_BLUEBONNET", name: "Bluebonnet Nutrition", type: "brand", country: "USA", description: "Премиальная нутра" },
  { id: "BRAND_DOCTORS_BEST", name: "Doctor's Best", type: "brand", country: "USA", description: "Научно ориентированные формулы" }
];