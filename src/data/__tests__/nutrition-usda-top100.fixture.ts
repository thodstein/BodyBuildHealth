/**
 * Stable USDA reference anchors for the high-frequency planner foods.
 * Values are per 100 g and intentionally use ranges: preparation and edible
 * part differ between USDA entries, so a point assertion would be misleading.
 */
export const USDA_TOP100_FIXTURE: Record<string, { kcal: [number, number]; protein: [number, number]; fat: [number, number]; carbs: [number, number] }> = {
  chicken_breast: { kcal: [145, 180], protein: [27, 34], fat: [2, 8], carbs: [0, 2] },
  turkey_breast: { kcal: [110, 160], protein: [24, 32], fat: [1, 8], carbs: [0, 2] },
  beef_lean: { kcal: [170, 250], protein: [22, 30], fat: [5, 18], carbs: [0, 2] },
  salmon: { kcal: [170, 240], protein: [18, 25], fat: [8, 17], carbs: [0, 2] },
  tuna_canned: { kcal: [100, 160], protein: [22, 30], fat: [0, 6], carbs: [0, 2] },
  egg_whole: { kcal: [130, 170], protein: [11, 15], fat: [8, 13], carbs: [0, 3] },
  egg_white: { kcal: [40, 65], protein: [9, 14], fat: [0, 2], carbs: [0, 3] },
  rice_white: { kcal: [120, 145], protein: [2, 4], fat: [0, 1], carbs: [25, 32] },
  rice_brown: { kcal: [105, 130], protein: [2, 4], fat: [0, 2], carbs: [20, 28] },
  oats_dry: { kcal: [350, 410], protein: [11, 18], fat: [5, 10], carbs: [55, 72] },
  buckwheat: { kcal: [85, 125], protein: [3, 6], fat: [0, 3], carbs: [17, 25] },
  pasta_durum: { kcal: [120, 160], protein: [4, 7], fat: [0, 2], carbs: [24, 32] },
  potato_boiled: { kcal: [70, 100], protein: [1, 3], fat: [0, 1], carbs: [15, 22] },
  sweet_potato: { kcal: [75, 105], protein: [1, 3], fat: [0, 1], carbs: [17, 25] },
  banana: { kcal: [80, 105], protein: [0, 2], fat: [0, 1], carbs: [20, 27] },
  apple: { kcal: [45, 65], protein: [0, 1], fat: [0, 1], carbs: [11, 17] },
  berries: { kcal: [25, 70], protein: [0, 2], fat: [0, 1], carbs: [5, 15] },
  broccoli: { kcal: [25, 45], protein: [2, 5], fat: [0, 1], carbs: [4, 10] },
  spinach: { kcal: [15, 35], protein: [2, 4], fat: [0, 1], carbs: [2, 6] },
  cucumber: { kcal: [10, 20], protein: [0, 2], fat: [0, 1], carbs: [2, 5] },
  tomato: { kcal: [15, 30], protein: [0, 2], fat: [0, 1], carbs: [3, 7] },
  pepper: { kcal: [20, 40], protein: [0, 2], fat: [0, 1], carbs: [4, 10] },
  olive_oil: { kcal: [850, 910], protein: [0, 1], fat: [95, 101], carbs: [0, 1] },
  avocado: { kcal: [140, 180], protein: [1, 3], fat: [12, 18], carbs: [5, 12] },
  almonds: { kcal: [550, 620], protein: [18, 24], fat: [45, 55], carbs: [15, 28] },
  walnuts: { kcal: [600, 700], protein: [12, 20], fat: [55, 70], carbs: [8, 20] },
  peanut_butter: { kcal: [560, 630], protein: [20, 30], fat: [45, 55], carbs: [12, 25] },
  cottage_cheese_5: { kcal: [100, 145], protein: [15, 21], fat: [3, 8], carbs: [1, 5] },
  yogurt_greek: { kcal: [55, 100], protein: [8, 12], fat: [1, 5], carbs: [2, 7] },
  milk: { kcal: [40, 70], protein: [2, 4], fat: [1, 4], carbs: [3, 6] },
};
