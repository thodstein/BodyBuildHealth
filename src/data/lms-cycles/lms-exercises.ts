/**
 * lms-exercises.ts — каталог упражнений СРЦ, извлечённый из 30 xlsm (Этап B1).
 * Обезличено. Подлежит merge с core/exercise-catalog.ts (Этап R, единый реестр).
 */

export interface LMSExercise {
 name: string;
 groups: string[]; // классификация источника (ЖМ/ПР/ТГ/Ср...)
 coef: number; // Коэф. тяжести (типичное)
 mnosz: number; // Множ (типичное)
 uses: number; // в скольких циклах/днях встречается
}

export const LMS_EXERCISES: LMSExercise[] = [
 { name: "1050-68", groups: ["Тяжелая"], coef: 1.4, mnosz: 1, uses: 1 },
 { name: "Бицепс с гантелями", groups: ["ЖМ","ЖИМ","ОФП"], coef: 0.4, mnosz: 2, uses: 9 },
 { name: "Бицепс стоя", groups: ["ТГ","ЖМ","ЖИМ","ПР","ОФП","СФП"], coef: 0.5, mnosz: 1, uses: 19 },
 { name: "Бицепс стоя со штангой", groups: [], coef: 1, mnosz: 1, uses: 2 },
 { name: "Верхняя и нижняя тяги, пресс, гиперэкстензии", groups: ["Тяжелая"], coef: 0.8, mnosz: 2, uses: 1 },
 { name: "Жим без ног", groups: ["СФП"], coef: 1, mnosz: 1, uses: 3 },
 { name: "Жим гантелей", groups: ["ПР","ЖИМ","ЖМ"], coef: 1, mnosz: 1, uses: 11 },
 { name: "Жим гантелей вниз головой", groups: ["ПР"], coef: 0.8, mnosz: 2, uses: 2 },
 { name: "Жим гантелей лежа на гор скамье", groups: ["ЖИМ"], coef: 0.8, mnosz: 2, uses: 2 },
 { name: "Жим гантелей лежа на накл скамье", groups: ["ЖИМ"], coef: 0.8, mnosz: 2, uses: 4 },
 { name: "Жим гантелей на наклонной", groups: ["ЖМ","ТЯГА"], coef: 0.5, mnosz: 1, uses: 6 },
 { name: "Жим лежа", groups: ["ЖИМ","ПР"], coef: 1, mnosz: 1, uses: 88 },
 { name: "Жим лежа без моста", groups: ["Жим гантелей на наклонной"], coef: 0.9, mnosz: 1, uses: 1 },
 { name: "Жим на наклонной", groups: ["ПР","ТЯГА","Жим гантелей на наклонной","Тяжелая","СФП","ЖМ"], coef: 0.4, mnosz: 1, uses: 16 },
 { name: "Жим на наклонной скамье", groups: ["ЖИМ","ПР"], coef: 1, mnosz: 1, uses: 4 },
 { name: "Жим средним хватом", groups: ["ПР","ЖИМ"], coef: 1, mnosz: 1, uses: 34 },
 { name: "Жим стоя", groups: ["ТГ","ЖМ","ЖИМ","ОФП","СФП"], coef: 0.8, mnosz: 1, uses: 35 },
 { name: "Кисть стоя", groups: [], coef: 1, mnosz: 2, uses: 9 },
  { name: "Концентрированный подъем", groups: ["Руки"], coef: 1, mnosz: 1, uses: 4 },
 { name: "Кроссовер для груди, трицепс на блоке, лодочка", groups: ["ПР"], coef: 0.8, mnosz: 2, uses: 1 },
 { name: "Молотковые сгибания", groups: ["ЖМ","СФП"], coef: 0.4, mnosz: 2, uses: 8 },
 { name: "Наклоны", groups: ["ТГ","ПР"], coef: 0.5, mnosz: 1, uses: 2 },
 { name: "Наклоны со штангой", groups: ["ЖМ"], coef: 0.8, mnosz: 1, uses: 1 },
  { name: "Наклоны стоя", groups: ["ЖИМ","ОФП","Спина"], coef: 0.8, mnosz: 1, uses: 12 },

 { name: "Опциональная тяга", groups: ["ОФП"], coef: 1.4, mnosz: 1, uses: 1 },
 { name: "ОФП", groups: ["Тяжелая","ПР"], coef: 1.4, mnosz: 1, uses: 2 },
 { name: "Подъем обратным хватом стоя", groups: [], coef: 1, mnosz: 2, uses: 1 },
 { name: "Пресс в тренажере (скручивания)", groups: ["ПР","ТЯГА"], coef: 1, mnosz: 2, uses: 26 },
 { name: "Присед", groups: ["ПР","ТЯГА","ОФП","СФП"], coef: 1.2, mnosz: 1, uses: 43 },
  { name: "Присед в широкой постановке", groups: ["ЖМ","ЖИМ","ОФП","ПР","Ноги"], coef: 1.2, mnosz: 1, uses: 10 },
 { name: "Присед на груди", groups: ["ЖМ","ЖИМ","Нормальное весоростовое соотношение","Тяжелая"], coef: 1.2, mnosz: 1, uses: 6 },
 { name: "Приседания со штангой на груди", groups: ["ОФП"], coef: 1.2, mnosz: 1, uses: 2 },
 { name: "Разгиб. с гантелью из-за головы", groups: ["ЖИМ"], coef: 0.3, mnosz: 2, uses: 1 },
 { name: "Разгибания с гантелью из-за головы", groups: ["ЖМ"], coef: 0.8, mnosz: 2, uses: 2 },
 { name: "Сгибание кисти стоя", groups: [], coef: 1, mnosz: 1, uses: 1 },
 { name: "Сгибания кисти стоя", groups: ["Сгибания обратным хватом"], coef: 1, mnosz: 1, uses: 1 },
 { name: "Становая тяга", groups: ["ПР","ОФП","Тяжелая","ТЯГА"], coef: 1.4, mnosz: 1, uses: 17 },
 { name: "Тяга до колен", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 2 },
 { name: "Тяга из ямы на прямых ногах", groups: ["Тяжелая"], coef: 1.4, mnosz: 1, uses: 1 },
 { name: "Тяга из ямы на прямых ногах (клас.)", groups: ["Тяжелая"], coef: 1.4, mnosz: 1, uses: 1 },
 { name: "Тяга из ямы на прямых ногах (клас)", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 2 },
 { name: "Тяга на прямых ногах", groups: ["Тяжелая","ОФП"], coef: 1.4, mnosz: 1, uses: 4 },
 { name: "Тяга на прямых ногах (класс.)", groups: ["ТЯГА"], coef: 1, mnosz: 1, uses: 1 },
 { name: "Тяга с подчеркнутым стартом", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 2 },
 { name: "Тяга сумо", groups: ["ЖИМ"], coef: 1.2, mnosz: 1, uses: 1 },
 { name: "Тяга уступающая", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 4 },
 { name: "Тяжелая", groups: ["Жим гантелей на наклонной"], coef: 0.8, mnosz: 2, uses: 1 },
 { name: "Упражнение комплекса", groups: [], coef: 1, mnosz: 2, uses: 3 },
 { name: "Французский жим", groups: ["ТГ","ПР","ЖМ"], coef: 0.3, mnosz: 2, uses: 7 },
  { name: "Французский жим лежа", groups: ["ЖИМ"], coef: 0.4, mnosz: 1, uses: 3 },
  { name: "Тяга верхнего блока", groups: ["ТЯГА","Спина"], coef: 0.5, mnosz: 1, uses: 6 },
  { name: "Разгибания ног", groups: ["Ноги"], coef: 0.3, mnosz: 2, uses: 6 },
  { name: "Трицепс на блоке", groups: ["Руки"], coef: 0.3, mnosz: 2, uses: 4 },
  { name: "Разгибания из-за головы", groups: ["Руки"], coef: 0.3, mnosz: 2, uses: 4 },
  { name: "Кроссовер", groups: ["Грудь"], coef: 0.3, mnosz: 2, uses: 4 },
  { name: "Подъем гантели перед собой", groups: ["Плечи"], coef: 0.3, mnosz: 2, uses: 2 },
  { name: "Подъем гантелей в стороны", groups: ["Плечи"], coef: 0.3, mnosz: 2, uses: 2 },
  { name: "Тяга гантели в наклоне", groups: ["ТЯГА","Спина"], coef: 1.0, mnosz: 1, uses: 6 },
  { name: "Дожим с 3 см", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 3 },
  { name: "Дожим с 5 см", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 3 },
  { name: "Дожим с 8 см", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 3 },
  { name: "Дожим с 10 см", groups: ["ЖИМ"], coef: 0.5, mnosz: 1, uses: 2 },
  { name: "Жим в раме (дожим)", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 3 },
  { name: "Жим в раме (старт)", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 3 },
  { name: "Жим ногами", groups: ["Ноги"], coef: 0.6, mnosz: 1, uses: 8 },
  { name: "Приседание", groups: ["Ноги","ПР"], coef: 1.0, mnosz: 1, uses: 10 },
  { name: "Становая тяга с плинтов", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 3 },
  { name: "Армейский жим", groups: ["Плечи","ЖИМ"], coef: 0.7, mnosz: 1, uses: 8 },
  { name: "Гиперэкстензия", groups: ["Спина"], coef: 0.4, mnosz: 1, uses: 6 },
  { name: "Жим с остановками", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 4 },
  { name: "Жим с паузой 2 секунды", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 5 },
  { name: "Махи гантелями в стороны", groups: ["Плечи"], coef: 0.3, mnosz: 2, uses: 6 },
  { name: "Подтягивания", groups: ["Спина","ТЯГА"], coef: 0.8, mnosz: 1, uses: 10 },
  { name: "Приседание до параллели", groups: ["Ноги","ПР"], coef: 0.9, mnosz: 1, uses: 5 },
  { name: "Скоростной жим", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 4 },
  { name: "Становая тяга из ямы", groups: ["ТЯГА"], coef: 1.5, mnosz: 1, uses: 4 },
  { name: "Становая тяга с остановками", groups: ["ТЯГА"], coef: 1.3, mnosz: 1, uses: 3 },
  { name: "Тяга штанги в наклоне", groups: ["Спина","ТЯГА"], coef: 1.0, mnosz: 1, uses: 8 },
];

export function getLMSExercise(name: string): LMSExercise | undefined {
 return LMS_EXERCISES.find(e => e.name.toLowerCase() === name.toLowerCase());
}

export const LMS_EXERCISE_NAMES: string[] = LMS_EXERCISES.map(e => e.name);
