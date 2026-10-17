import { parseNutritionText, parseFatSecretText, parseMyFitnessPalText } from '../nutrition-ocr-parser';

describe('manual ru screenshot', () => {
  it('fs', () => {
    const fsText = `FatSecret
Сегодня
Завтрак
Куриная грудка 200 г 330 ккал
Б:40 Ж:10 У:0
Рис 150 г 180 ккал
Б:4 Ж:1 У:38`;
    console.log('FS', JSON.stringify(parseFatSecretText(fsText)));
    console.log('NUTRITION FS', JSON.stringify(parseNutritionText(fsText)));
  });
  it('mfp', () => {
    const mfpText = `MyFitnessPal
Дневник питания
Сегодня
Завтрак
Куриная грудка 200 г 330 ккал
Обед
Рис 150 г 180 ккал
Калорий осталось 500`;
    console.log('MFP', JSON.stringify(parseMyFitnessPalText(mfpText)));
    console.log('NUTRITION MFP', JSON.stringify(parseNutritionText(mfpText)));
  });
});
