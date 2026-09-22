/**
 * lms-exercises.ts — каталог упражнений СРЦ (слияние с core/exercise-catalog, Этап B1/R).
 *
 * Merge-правило (§3.0): каждое РЕАЛЬНОЕ упражнение несёт `catalogId` — id канонической
 * записи EXERCISE_CATALOG (после keep-first дедупа имён); шум xlsm («1050-68», «ОФП»,
 * «Тяжелая», «Упражнение комплекса», «Опциональная тяга») удалён — выдуманных записей нет.
 * `groups` — классификация источника (ЖМ/ПР/ТГ/Ср...), не трогается.
 */

export interface LMSExercise {
 name: string;
 groups: string[]; // классификация источника (ЖМ/ПР/ТГ/Ср...)
 coef: number; // Коэф. тяжести (типичное)
 mnosz: number; // Множ (типичное)
 uses: number; // в скольких циклах/днях встречается
 /** id канонического упражнения в EXERCISE_CATALOG (merge §3.0; undefined — не резолвится). */
 catalogId?: string;
}

export const LMS_EXERCISES: LMSExercise[] = [
 { name: "Бицепс с гантелями", groups: ["ЖМ","ЖИМ","ОФП"], coef: 0.4, mnosz: 2, uses: 9, catalogId: 'curl_db' },
 { name: "Бицепс стоя", groups: ["ТГ","ЖМ","ЖИМ","ПР","ОФП","СФП"], coef: 0.5, mnosz: 1, uses: 19, catalogId: 'curl_bar' },
 { name: "Бицепс стоя со штангой", groups: [], coef: 1, mnosz: 1, uses: 2, catalogId: 'curl_bar' },
 { name: "Верхняя и нижняя тяги, пресс, гиперэкстензии", groups: ["Тяжелая"], coef: 0.8, mnosz: 2, uses: 1, catalogId: 'pulldown' },
 { name: "Жим без ног", groups: ["СФП"], coef: 1, mnosz: 1, uses: 3, catalogId: 'bench_bar' },
 { name: "Жим гантелей", groups: ["ПР","ЖИМ","ЖМ"], coef: 1, mnosz: 1, uses: 11, catalogId: 'bench_db' },
 { name: "Жим гантелей вниз головой", groups: ["ПР"], coef: 0.8, mnosz: 2, uses: 2, catalogId: 'bench_db' },
 { name: "Жим гантелей лежа на гор скамье", groups: ["ЖИМ"], coef: 0.8, mnosz: 2, uses: 2, catalogId: 'bench_db' },
 { name: "Жим гантелей лежа на накл скамье", groups: ["ЖИМ"], coef: 0.8, mnosz: 2, uses: 4, catalogId: 'incline_db' },
 { name: "Жим гантелей на наклонной", groups: ["ЖМ","ТЯГА"], coef: 0.5, mnosz: 1, uses: 6, catalogId: 'incline_db' },
 { name: "Жим лежа", groups: ["ЖИМ","ПР"], coef: 1, mnosz: 1, uses: 88, catalogId: 'bench_bar' },
 { name: "Жим лежа без моста", groups: ["Жим гантелей на наклонной"], coef: 0.9, mnosz: 1, uses: 1, catalogId: 'bench_bar' },
 { name: "Жим на наклонной", groups: ["ПР","ТЯГА","Жим гантелей на наклонной","Тяжелая","СФП","ЖМ"], coef: 0.4, mnosz: 1, uses: 16, catalogId: 'incline_bar' },
 { name: "Жим на наклонной скамье", groups: ["ЖИМ","ПР"], coef: 1, mnosz: 1, uses: 4, catalogId: 'incline_bar' },
 { name: "Жим средним хватом", groups: ["ПР","ЖИМ"], coef: 1, mnosz: 1, uses: 34, catalogId: 'bench_bar' },
 { name: "Жим стоя", groups: ["ТГ","ЖМ","ЖИМ","ОФП","СФП"], coef: 0.8, mnosz: 1, uses: 35, catalogId: 'ohp' },
 { name: "Кисть стоя", groups: [], coef: 1, mnosz: 2, uses: 9, catalogId: 'wrist_curl' },
 { name: "Концентрированный подъем", groups: ["Руки"], coef: 1, mnosz: 1, uses: 4, catalogId: 'preacher_curl' },
 { name: "Кроссовер для груди, трицепс на блоке, лодочка", groups: ["ПР"], coef: 0.8, mnosz: 2, uses: 1, catalogId: 'cable_fly' },
 { name: "Молотковые сгибания", groups: ["ЖМ","СФП"], coef: 0.4, mnosz: 2, uses: 8, catalogId: 'hammer_curl' },
 { name: "Наклоны", groups: ["ТГ","ПР"], coef: 0.5, mnosz: 1, uses: 2, catalogId: 'good_morning' },
 { name: "Наклоны со штангой", groups: ["ЖМ"], coef: 0.8, mnosz: 1, uses: 1, catalogId: 'good_morning' },
 { name: "Наклоны стоя", groups: ["ЖИМ","ОФП","Спина"], coef: 0.8, mnosz: 1, uses: 12, catalogId: 'good_morning' },
 { name: "Подъем обратным хватом стоя", groups: [], coef: 1, mnosz: 2, uses: 1, catalogId: 'curl_bar' },
 { name: "Пресс в тренажере (скручивания)", groups: ["ПР","ТЯГА"], coef: 1, mnosz: 2, uses: 26, catalogId: 'cable_crunch' },
 { name: "Присед", groups: ["ПР","ТЯГА","ОФП","СФП"], coef: 1.2, mnosz: 1, uses: 43, catalogId: 'squat' },
 { name: "Присед в широкой постановке", groups: ["ЖМ","ЖИМ","ОФП","ПР","Ноги"], coef: 1.2, mnosz: 1, uses: 10, catalogId: 'hack_squat' },
 { name: "Присед на груди", groups: ["ЖМ","ЖИМ","Нормальное весоростовое соотношение","Тяжелая"], coef: 1.2, mnosz: 1, uses: 6, catalogId: 'front_squat' },
 { name: "Приседания со штангой на груди", groups: ["ОФП"], coef: 1.2, mnosz: 1, uses: 2, catalogId: 'front_squat' },
 { name: "Разгиб. с гантелью из-за головы", groups: ["ЖИМ"], coef: 0.3, mnosz: 2, uses: 1, catalogId: 'db_skullcrusher' },
 { name: "Разгибания с гантелью из-за головы", groups: ["ЖМ"], coef: 0.8, mnosz: 2, uses: 2, catalogId: 'db_skullcrusher' },
 { name: "Сгибание кисти стоя", groups: [], coef: 1, mnosz: 1, uses: 1, catalogId: 'wrist_curl' },
 { name: "Сгибания кисти стоя", groups: ["Сгибания обратным хватом"], coef: 1, mnosz: 1, uses: 1, catalogId: 'wrist_curl' },
 { name: "Становая тяга", groups: ["ПР","ОФП","Тяжелая","ТЯГА"], coef: 1.4, mnosz: 1, uses: 17, catalogId: 'deadlift' },
 { name: "Тяга до колен", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 2, catalogId: 'deadlift' },
 { name: "Тяга из ямы на прямых ногах", groups: ["Тяжелая"], coef: 1.4, mnosz: 1, uses: 1, catalogId: 'rdl' },
 { name: "Тяга из ямы на прямых ногах (клас.)", groups: ["Тяжелая"], coef: 1.4, mnosz: 1, uses: 1, catalogId: 'rdl' },
 { name: "Тяга из ямы на прямых ногах (клас)", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 2, catalogId: 'rdl' },
 { name: "Тяга на прямых ногах", groups: ["Тяжелая","ОФП"], coef: 1.4, mnosz: 1, uses: 4, catalogId: 'rdl' },
 { name: "Тяга на прямых ногах (класс.)", groups: ["ТЯГА"], coef: 1, mnosz: 1, uses: 1, catalogId: 'rdl' },
 { name: "Тяга с подчеркнутым стартом", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 2, catalogId: 'row_bar' },
 { name: "Тяга сумо", groups: ["ЖИМ"], coef: 1.2, mnosz: 1, uses: 1, catalogId: 'sumo_dl' },
 { name: "Тяга уступающая", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 4, catalogId: 'row_bar' },
 { name: "Французский жим", groups: ["ТГ","ПР","ЖМ"], coef: 0.3, mnosz: 2, uses: 7, catalogId: 'tricep_push' },
 { name: "Французский жим лежа", groups: ["ЖИМ"], coef: 0.4, mnosz: 1, uses: 3, catalogId: 'tricep_push' },
 { name: "Тяга верхнего блока", groups: ["ТЯГА","Спина"], coef: 0.5, mnosz: 1, uses: 6, catalogId: 'pulldown' },
 { name: "Разгибания ног", groups: ["Ноги"], coef: 0.3, mnosz: 2, uses: 6, catalogId: 'leg_ext' },
 { name: "Трицепс на блоке", groups: ["Руки"], coef: 0.3, mnosz: 2, uses: 4, catalogId: 'tricep_cable' },
 { name: "Разгибания из-за головы", groups: ["Руки"], coef: 0.3, mnosz: 2, uses: 4, catalogId: 'tricep_cable' },
 { name: "Кроссовер", groups: ["Грудь"], coef: 0.3, mnosz: 2, uses: 4, catalogId: 'cable_fly' },
 { name: "Подъем гантели перед собой", groups: ["Плечи"], coef: 0.3, mnosz: 2, uses: 2, catalogId: 'front_raise_db' },
 { name: "Подъем гантелей в стороны", groups: ["Плечи"], coef: 0.3, mnosz: 2, uses: 2, catalogId: 'lateral_raise' },
 { name: "Тяга гантели в наклоне", groups: ["ТЯГА","Спина"], coef: 1.0, mnosz: 1, uses: 6, catalogId: 'row_db' },
 { name: "Дожим с 3 см", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 3, catalogId: 'bench_bar' },
 { name: "Дожим с 5 см", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 3, catalogId: 'bench_bar' },
 { name: "Дожим с 8 см", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 3, catalogId: 'bench_bar' },
 { name: "Дожим с 10 см", groups: ["ЖИМ"], coef: 0.5, mnosz: 1, uses: 2, catalogId: 'bench_bar' },
 { name: "Жим в раме (дожим)", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 3, catalogId: 'bench_bar' },
 { name: "Жим в раме (старт)", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 3, catalogId: 'bench_bar' },
 { name: "Жим ногами", groups: ["Ноги"], coef: 0.6, mnosz: 1, uses: 8, catalogId: 'leg_press' },
 { name: "Приседание", groups: ["Ноги","ПР"], coef: 1.0, mnosz: 1, uses: 10, catalogId: 'squat' },
 { name: "Становая тяга с плинтов", groups: ["ТЯГА"], coef: 1.4, mnosz: 1, uses: 3, catalogId: 'deadlift' },
 { name: "Армейский жим", groups: ["Плечи","ЖИМ"], coef: 0.7, mnosz: 1, uses: 8, catalogId: 'ohp' },
 { name: "Гиперэкстензия", groups: ["Спина"], coef: 0.4, mnosz: 1, uses: 6, catalogId: 'back_extension' },
 { name: "Жим с остановками", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 4, catalogId: 'bench_bar' },
 { name: "Жим с паузой 2 секунды", groups: ["ЖИМ","ПР"], coef: 0.7, mnosz: 1, uses: 5, catalogId: 'bench_bar' },
 { name: "Махи гантелями в стороны", groups: ["Плечи"], coef: 0.3, mnosz: 2, uses: 6, catalogId: 'lateral_raise' },
 { name: "Подтягивания", groups: ["Спина","ТЯГА"], coef: 0.8, mnosz: 1, uses: 10, catalogId: 'pullup' },
 { name: "Приседание до параллели", groups: ["Ноги","ПР"], coef: 0.9, mnosz: 1, uses: 5, catalogId: 'squat' },
 { name: "Скоростной жим", groups: ["ЖИМ"], coef: 0.6, mnosz: 1, uses: 4, catalogId: 'bench_bar' },
 { name: "Становая тяга из ямы", groups: ["ТЯГА"], coef: 1.5, mnosz: 1, uses: 4, catalogId: 'deadlift' },
 { name: "Становая тяга с остановками", groups: ["ТЯГА"], coef: 1.3, mnosz: 1, uses: 3, catalogId: 'deadlift' },
 { name: "Тяга штанги в наклоне", groups: ["Спина","ТЯГА"], coef: 1.0, mnosz: 1, uses: 8, catalogId: 'row_bar' },
];

export function getLMSExercise(name: string): LMSExercise | undefined {
 return LMS_EXERCISES.find(e => e.name.toLowerCase() === name.toLowerCase());
}

export const LMS_EXERCISE_NAMES: string[] = LMS_EXERCISES.map(e => e.name);
