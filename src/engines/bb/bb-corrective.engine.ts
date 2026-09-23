/**
 * bb-corrective.engine.ts — библиотека корректирующих упражнений ББ-диагностики (PRO).
 * Закрывает G1–G4 аудита: скрининг D1–D5 / жим / NHE / YBT / ER:IR → конкретное
 * упражнение из EXERCISE_CATALOG + доза + кью + прогрессия + ре-тест + источник.
 * Чистые функции, без UI/storage. Сборку не меняет — дозу отдаёт инъекции/мосту.
 *
 * Канон: NASM OHSA/Brookbush (компенсации), Noteboom 2024 (жим BAW ≤1.5),
 * PoinT GO 35–38° (голеностоп), CCEP 8 нед (ТБС-комплекс), Franke 2025/van Dyk 2019 (NHE),
 * Quintana-Cepedal 2025 (Copenhagen сила↑), Intelangelo 2025 (ER:IR<0.75),
 * Silbernagel PMM ≤5/<5 (боль), Wolf/Strey/Maeo/Kassiano (момент в длине).
 */

import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { equipmentAllows } from './bb-correction-rank.engine';

export type BBCorrPhase = 'technique' | 'strength' | 'stability';
export type BBWeakCause = 'volume' | 'activation' | 'recovery' | 'technique' | 'genetics';

export interface BBCorrProtocol {
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number;
  tempo: string;
  restSec: number;
  freqPerWeek: number;
}

export interface BBCorrective {
  id: string;
  title: string;
  exerciseId: string;
  /** Ключи匹配: гранулярные зоны (chest_upper…), драйверы (driver:ankle…), сигналы (bench-fix, nhe-weak, add-weak, erir-low, ybt-asym, ktw-asym, hinge-fail, shoulder-fail, bench-watch). */
  targets: string[];
  causes: BBWeakCause[];
  phase: BBCorrPhase;
  level: 'any' | 'beginner' | 'intermediate' | 'advanced';
  protocol: BBCorrProtocol;
  cues: [string, string, string];
  progression: string;
  regression: string;
  retest: string;
  source: string;
  equipmentAlt: string[];
  /** Токены-противопоказания: pm-red (красная боль), shoulder-pain, teen-loaded. */
  contraindicated: string[];
}

function c(
  id: string, title: string, exerciseId: string, targets: string[], causes: BBWeakCause[],
  phase: BBCorrPhase, level: BBCorrective['level'], protocol: BBCorrProtocol,
  cues: [string, string, string], progression: string, regression: string, retest: string,
  source: string, equipmentAlt: string[] = [], contraindicated: string[] = [],
): BBCorrective {
  return { id, title, exerciseId, targets, causes, phase, level, protocol, cues, progression, regression, retest, source, equipmentAlt, contraindicated };
}

/** Библиотека: каждая зона × причина/фаза + каждый скрининг-сигнал. Число записей — источник истины
 *  BB_CORRECTIVE_COUNT (шапка цифру не дублирует — раньше дрейфовала при росте библиотеки).
 *  Упражнения — только реальные id EXERCISE_CATALOG (lock-тест). */
export const BB_CORRECTIVES: BBCorrective[] = [
  // ── Грудь верх (chest_upper) ──
  c('cu-incline-length', 'Жим гантелей 30° с паузой (длина)', 'incline_db', ['chest_upper', 'chest', 'bench-fix'], ['activation', 'technique', 'volume'], 'technique', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 1, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Лопатки сведены весь сет', 'Пауза 1с внизу в растянутой', 'Сведение гантелей вверху'], 'Вес +2.5% при RIR≥2 дважды', 'Сведение в кроссовере снизу', 'Верх груди: +повторы на том же весе за 3 нед', 'Kassiano 2024 (длина); Noteboom 2024 (угол 30°)', ['incline_bar', 'cable_fly_incline']),
  c('cu-cable-low', 'Сведение снизу вверх (пик)', 'cable_fly_low', ['chest_upper', 'chest'], ['activation', 'genetics'], 'technique', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 1, tempo: '3-2-1-0', restSec: 60, freqPerWeek: 2 },
    ['Руки внизу — тяни вверх', 'Задержка 1–2с в сведении', 'Рёбра вниз, без моста'], 'Вес +1 шаг при 15 повт чисто', 'Отжимания с колен в узкой постановке', 'Пиковое удержание 2с × 12 без потери формы', 'Schoenfeld MMC (изоляция ≤65%)', ['pec_deck']),
  c('cu-bench-neutral', 'Жим: сузь хват + сведи лопатки', 'bench_bar', ['bench-fix', 'bench-watch', 'chest'], ['technique'], 'technique', 'any',
    { sets: 3, repsMin: 6, repsMax: 10, rir: 2, tempo: '3-1-1-0', restSec: 120, freqPerWeek: 2 },
    ['Хват 1.2–1.5 ширины плеч', 'Лопатки сведены и опущены', 'Касание — линия сосков'], 'Та же техника +5% веса', 'Жим гантелей сидя с опорой', 'Хват ≤1.5 BAW + лопатки держат весь сет', 'Noteboom 2024 (BAW/ретракция)', ['incline_bar']),
  // ── Грудь общая ──
  c('ch-fly-stretch', 'Разводка с растяжением 2с', 'fly_db', ['chest', 'chest_mid'], ['activation', 'volume'], 'strength', 'any',
    { sets: 2, repsMin: 10, repsMax: 14, rir: 2, tempo: '3-2-1-0', restSec: 75, freqPerWeek: 2 },
    ['Полукруг до растяжения', 'Пауза 2с внизу', 'Сведение как объятие'], 'Вес +1 кг при верхней границе', 'Сведение в тренажёре', 'Амплитуда + RIR стабилен', 'Maeo lengthened (растянутая)', ['pec_deck', 'cable_fly_mid'], ['pm-red']),
  c('ch-decline-lower', 'Жим на наклонной вниз (низ груди)', 'decline_db', ['chest_lower', 'chest'], ['volume', 'technique'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 2, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 1 },
    ['Локти в стороны, без разведения в стороны', 'Касание — низ груди', 'Разгибание без замка локтей'], 'Вес +2 кг при форме', 'Отжимания от пола с широкой постановкой', 'Низ груди: +повторы/вес за 3 нед', 'NSCA (регионарная нагрузка)', ['decline_bar', 'machine_decline_press'], ['pm-red']),
  c('ch-dips-tech', 'Брусья грудным стилем (контро́ль)', 'dips_chest', ['chest_lower', 'chest'], ['volume', 'technique'], 'strength', 'intermediate',
    { sets: 3, repsMin: 6, repsMax: 10, rir: 2, tempo: '3-0-1-0', restSec: 120, freqPerWeek: 1 },
    ['Наклон 30–40° вперёд', 'Локти в стороны', 'Вниз — растяжение, вверх — сведение'], 'Доп. вес +2.5 кг', 'Отжимания от пола с широкой постановкой', 'Глубина без боли плеча 3 нед', 'Calatayud (наклон=грудь)', [], ['pm-red', 'shoulder-pain', 'teen-loaded']),
  // ── Спина ширина ──
  c('bw-pulldown-pause', 'Тяга блока с паузой в растянутой', 'pulldown', ['back_width', 'back', 'thoracic', 'driver:thoracic'], ['activation', 'technique', 'volume'], 'technique', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 1, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Тяга локтями вниз', 'Пауза 1с внизу', 'Возврат 2–3с'], 'Вес +2.5 кг при RIR≥2', 'Тяга одной рукой', 'Пауза держится все сеты', 'Schoenfeld lengthened', ['pullup_neutral', 'pulldown_rev']),
  c('bw-neutral-safe', 'Нейтральный хват (плечо-сейф)', 'pullup_neutral', ['back_width', 'back', 'shoulder-fail', 'driver:shoulder'], ['technique', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 5, repsMax: 10, rir: 2, tempo: '3-1-1-0', restSec: 120, freqPerWeek: 2 },
    ['Ладони друг к другу', 'Локти вниз, грудь вверх', 'Без раскачки'], 'Строгие +2 повтора', 'Тяга блока нейтральным', 'Боль плеча 0 + строгие повторы растут', 'GRSM 2025 (нейтраль)', ['pulldown_vbar'], ['pm-red', 'shoulder-pain']),
  c('bw-straight-pull', 'Пуловер в блоке (длина широчайших)', 'straight_pull', ['back_width', 'back', 'shoulder-fail'], ['activation', 'genetics'], 'technique', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 1, tempo: '3-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Руки прямые', 'Тяга до бёдер', 'Лопатки вниз в конце'], 'Вес +1 шаг', 'Пуловер с гантелью лёжа', 'Растяжение без потери контроля', 'Wolf long-length', ['pullover_bar', 'cable_pullover_rope']),
  // ── Спина толщина ──
  c('bt-row-pause', 'Тяга штанги с паузой у живота', 'row_tbar', ['back_thickness', 'back'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 1, tempo: '2-1-1-0', restSec: 120, freqPerWeek: 2 },
    ['Грудь упёрта/корпус стабилен', 'Тяга к животу, локти в стороны', 'Сведение лопаток 1с'], 'Вес +2.5 кг', 'Тяга горизонтального блока', 'Сведение держится на рабочих весах', 'NSCA Hodge (толщина)', ['seated_row']),
  c('bt-seated-squeeze', 'Горизонтальный блок со сведением', 'seated_row', ['back_thickness', 'back'], ['technique', 'recovery'], 'technique', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 2, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Грудь вперёд на растяжении', 'Сведение лопаток', 'Без округления спины'], 'Вес +2.5 кг при технике', 'Тяга одной рукой', 'Лопатки сходятся каждый повтор', 'Brookbush (ретракция)', ['pulldown_single']),
  // ── Дельты средняя ──
  c('dm-lateral-pause', 'Махи с паузой (без трапеции)', 'lateral_raise', ['delt_mid', 'shoulders'], ['activation', 'volume', 'technique'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 3 },
    ['Не выше плеч', 'Мизинец ведёт вверх', 'Пауза 1с наверху'], 'Вес +1 кг при 15 чисто', 'Отведение в кроссовере', '15 повт без читинга корпусом', 'Schoenfeld (пик-напряжение)', ['cable_lateral', 'lateral_raise_machine']),
  c('dm-cable-const', 'Отведение в кроссовере (натяжение)', 'cable_lateral', ['delt_mid', 'shoulders'], ['activation', 'genetics'], 'strength', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-1-2-0', restSec: 60, freqPerWeek: 2 },
    ['Одной рукой, трос снизу', 'До уровня плеч', 'Медленный возврат'], 'Вес +1 плитка', 'Махи с опорой одной рукой', 'Постоянное натяжение весь сет', 'MMC (изоляция)', ['lateral_raise_single']),
  // ── Дельты задняя ──
  c('dr-facepull', 'Тяга к лицу с разворотом', 'face_pull', ['delt_rear', 'shoulders', 'erir-low', 'shoulder-fail', 'driver:shoulder'], ['activation', 'technique'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 2, tempo: '2-1-2-0', restSec: 60, freqPerWeek: 3 },
    ['Трос на уровне глаз', 'Разворот кистей наружу', 'Возврат 3с'], 'Вес +1 плитка при форме', 'Тяга к лицу с верёвкой легко', 'Наружная ротация без боли + объём растёт', 'Intelangelo 2025 (ER)', ['cable_facepull_rope', 'face_pull_sh']),
  c('dr-rear-fly', 'Махи в наклоне (локти вверх)', 'rear_delt_fly', ['delt_rear', 'shoulders'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Наклон 60–70°', 'Локти вверх, не назад', 'Спина прямая'], 'Вес +1 кг', 'Обратные сведения в тренажёре', 'Локти держат высоту все повторы', 'NSCA (задняя)', ['rear_delt_machine_v2']),
  c('dr-erir-rotation', 'Наружная ротация легко ×15', 'cable_external_rotation', ['erir-low', 'delt_rear', 'shoulders'], ['technique', 'activation'], 'stability', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 3, tempo: '2-1-2-0', restSec: 45, freqPerWeek: 3 },
    ['Локоть прижат к корпусу', 'Только ротация, без рывка', 'Боль 0'], 'ER:IR ≥0.75 на перетесте', 'Scaption без веса', 'ER:IR вырос + боль 0', 'Intelangelo 2025 (<0.75)', ['scaption']),
  // ── Дельты передняя ──
  c('df-db-press', 'Жим гантелей сидя с опорой', 'db_press', ['delt_front', 'shoulders', 'thoracic', 'driver:thoracic'], ['volume', 'technique'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 2, tempo: '2-0-1-0', restSec: 120, freqPerWeek: 2 },
    ['Скамья 85°, спина прижата', 'Гантели на уровне ушей внизу', 'Сведение вверху'], 'Вес +2 кг', 'Лэндмайн-жим одной рукой', 'Жим без прогиба поясницы', 'NASM (опора при грудном кифозе)', ['ohp_seated', 'landmine_press_shoulder'], ['pm-red']),
  c('df-landmine', 'Лэндмайн-жим с колена (плечо-сейф)', 'half_kneeling_landmine_press', ['delt_front', 'shoulders', 'shoulder-fail', 'driver:shoulder'], ['technique', 'recovery'], 'stability', 'any',
    { sets: 2, repsMin: 8, repsMax: 12, rir: 2, tempo: '2-1-1-0', restSec: 75, freqPerWeek: 2 },
    ['На одном колене, кор напряжён', 'Жим вперёд-вверх по дуге', 'Без боли в плече'], 'Полный жим гантелей без боли', 'Scaption', 'Амплитуда без боли 3 нед', 'GRSM 2025 (щадящий вектор)', ['landmine_press_shoulder'], ['pm-red']),
  // ── Квадрицепс / голеностоп ──
  c('q-goblet-heel', 'Гоблет с пяткой 2.5 см (глубина)', 'goblet_squat', ['quads', 'driver:ankle', 'ktw-asym'], ['technique', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 2, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Пятка 2.5 см / блины', 'Локти между колен', 'Колени вперёд над носками'], 'Глубина без отрыва пяток', 'Жим ногами', 'KTM +2 см / глубина без компенсации', 'PoinT GO 35–38° (Tourillon 2025)', ['leg_press']),
  c('q-legpress-moment', 'Жим ногами (момент в длине)', 'leg_press', ['quads', 'driver:ankle', 'driver:hip'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 1, tempo: '3-1-1-0', restSec: 120, freqPerWeek: 2 },
    ['Поясница прижата', 'Полная амплитуда без отрыва', 'Не блокируй колени'], 'Вес +5 кг при глубине', 'Гоблет с пяткой', 'Глубина + вес растут вместе', 'Wolf (длина+момент)', ['leg_press_v2', 'hack_squat']),
  c('q-split-unilateral', 'Болгарский сплит (слабая первой)', 'bulgarian_split', ['quads', 'driver:hip', 'ybt-asym', 'asym'], ['technique', 'genetics', 'volume'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 2, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Слабая нога первой', 'Корпус вертикально', 'Колено над стопой'], 'Вес +2 кг / нога', 'Сплит без веса', 'Разрыв L/R ≤10%', 'Bishop 7/12 (асимметрия)', ['bulgarian_split_db', 'leg_press_single']),
  c('q-leg-ext-finish', 'Разгибания с удержанием (добивка)', 'leg_ext', ['quads'], ['activation', 'volume'], 'technique', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-2-1-0', restSec: 60, freqPerWeek: 2 },
    ['Удержание 1–2с вверху', 'Возврат 3с', 'Без читинга тазом'], 'Вес +1 шаг', 'Присед без веса медленно', 'Пик-удержание все повторы', 'Schoenfeld (пик)', [], ['pm-red']),
  // ── Хамстринги / NHE ──
  c('h-rdl-length', 'Румынская с паузой (длина+момент)', 'rdl', ['hamstrings', 'hinge-fail', 'driver:hip'], ['activation', 'technique', 'volume'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 1, tempo: '3-1-1-0', restSec: 120, freqPerWeek: 2 },
    ['Таз назад, гриф по ногам', 'Растяжение бицепса бедра', 'Мощное сокращение ягодицами'], 'Вес +2.5 кг', 'Тяга троса между ног', 'Глубина + вес без округления', 'Kassiano 2024 (SLDL+leg press)', ['rdl_db', 'cable_pull_through'], ['pm-red']),
  c('h-nordic-ecc', 'Нордик: эксцентрика 5с', 'nordic_curl', ['hamstrings', 'nhe-weak'], ['technique', 'activation', 'volume'], 'strength', 'intermediate',
    { sets: 3, repsMin: 3, repsMax: 6, rir: 2, tempo: '5-0-1-0', restSec: 150, freqPerWeek: 2 },
    ['Пятки закреплены', 'Опускание 5+с', 'Отталкивание руками'], '3×(3→10) к ~50 повт/нед', 'Сгибания лёжа', 'NHE ≥5 повт + угол срыва ≥30°', 'Franke 2025 / van Dyk 2019', ['leg_curl_lying'], ['pm-red', 'teen-loaded']),
  c('h-seated-curl', 'Сгибания сидя (длинная длина)', 'leg_curl_seated', ['hamstrings', 'nhe-weak'], ['activation', 'volume'], 'technique', 'any',
    { sets: 2, repsMin: 10, repsMax: 12, rir: 1, tempo: '2-1-2-0', restSec: 75, freqPerWeek: 2 },
    ['Полное сгибание', 'Удержание наверху', 'Таз не отрывать'], 'Вес +1 шаг', 'Сгибания стоя одной ногой', 'Полная амплитуда без рывка', 'Maeo (сидя>лёжа)', ['leg_curl_single']),
  // ── Ягодицы / ТБС ──
  c('g-hip-thrust', 'Хип-траст с паузой 2с', 'hip_thrust_barbell', ['glutes', 'driver:hip'], ['activation', 'volume'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 1, tempo: '2-2-1-0', restSec: 120, freqPerWeek: 2 },
    ['Лопатки на скамье', 'Сжатие ягодиц 2с вверху', 'Без гиперэкстензии'], 'Вес +2.5 кг', 'Ягодичный мост на полу', 'Пауза держится на рабочем весе', 'Plotkin 2023 (траст у тренированных)', ['glute_bridge_v2', 'cable_pull_through'], ['pm-red']),
  c('g-clam-complex', 'Комплекс ТБС: кламшелл + боковая планка', 'clamshell', ['glutes', 'driver:hip', 'ybt-asym'], ['technique', 'activation'], 'stability', 'any',
    { sets: 2, repsMin: 15, repsMax: 20, rir: 3, tempo: '2-1-2-0', restSec: 45, freqPerWeek: 3 },
    ['Резина на бёдрах', '«Раздвинь пол стопами»', 'Таз стабилен'], 'Резина жёстче / боковая планка с ногой', 'Ходьба с резиной', 'FPPA −5° / колени не валятся', 'CCEP BMC-2022 (комплекс, не изоляция)', ['band_walks', 'plank_side_leg_lift']),
  c('g-single-bridge', 'Мост на одной ноге (асимметрия)', 'hip_thrust_single', ['glutes', 'asym', 'ybt-asym'], ['genetics', 'technique'], 'stability', 'any',
    { sets: 2, repsMin: 10, repsMax: 12, rir: 2, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Слабая сторона первой', 'Таз ровно', 'Сжатие 1с'], 'Разрыв L/R ≤10%', 'Мост на двух ногах', 'Симметрия повторов L/R', 'Bishop (односторонняя)', ['glute_bridge_v2']),
  c('g-cable-kickback', 'Кикбэк в блоке (верх ягодиц)', 'cable_kickback', ['glutes'], ['activation', 'volume'], 'technique', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Корпус слегка вперёд', 'Прямая нога назад', 'Пик 1с'], 'Вес +1 шаг', 'Отведение стоя без веса', 'Пик каждый повтор', 'Kassiano-комбо (abduction+thrust)', []),
  // ── Приводящие ──
  c('ad-copenhagen', 'Копенгаген L0–L3 (прогрессия)', 'copenhagen_plank', ['adductor', 'add-weak', 'driver:hip'], ['technique', 'volume', 'activation'], 'strength', 'intermediate',
    { sets: 3, repsMin: 5, repsMax: 8, rir: 2, tempo: '3-0-1-0', restSec: 90, freqPerWeek: 2 },
    ['Верхняя нога на скамье', 'Тело линией', 'Без провисания'], 'L0→L3 по готовности', 'Боковая планка', 'Уровень + время без просадки', 'Quintana-Cepedal 2025 (сила↑)', ['plank_side'], ['pm-red']),
  c('ad-hip-adduction', 'Приведение бедра (аддукторы, гипертрофия)', 'adductor', ['adductor', 'add-weak'], ['volume', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 2, tempo: '2-1-2-0', restSec: 60, freqPerWeek: 2 },
    ['Корпус стабилен', 'Полная амплитуда', 'Без рывка в конце'], 'Вес +1 шаг при 15 чисто', 'Изометрия между коленей', 'Сила L/R без разрыва', 'Quintana-Cepedal 2025 (аддукторы)', ['cable_hip_adduction', 'plank_side'], ['pm-red']),
  // ── Икры / голеностоп ──
  c('c-stand-full', 'Подъёмы стоя: полная амплитуда', 'calf_raise_standing', ['calves', 'driver:ankle', 'ktw-asym'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-2-1-0', restSec: 60, freqPerWeek: 3 },
    ['Ниже платформы', 'Растяжение 2с внизу', 'Сжатие 1с вверху'], 'Вес +2.5 кг', 'Подъёмы без веса медленно', 'Амплитуда + KTM растёт', 'Schoenfeld (полная)', ['calf_raise_v2']),
  c('c-single-asym', 'Подъём на одной ноге (L/R)', 'calf_raise_single', ['calves', 'asym', 'ktw-asym', 'ybt-asym'], ['genetics', 'technique'], 'stability', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 2, tempo: '2-1-1-0', restSec: 45, freqPerWeek: 3 },
    ['На краю ступеньки', 'Слабая первой', 'Можно с гантелью'], 'Разрыв L/R ≤10%', 'Двумя ногами', 'Симметрия + баланс 30с', 'Tourillon (асимметрия ≥2см)', []),
  // ── Трапеции ──
  c('tr-shrug-db', 'Шраги с гантелями (верх трапеций)', 'shrug_db', ['traps'], ['volume', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 10, repsMax: 15, rir: 1, tempo: '2-1-2-0', restSec: 60, freqPerWeek: 2 },
    ['Плечи строго вверх, не вперёд', 'Пауза 1с вверху', 'Без раскачки корпусом'], 'Вес +2 кг при 15 чисто', 'Шраги с резиной', 'Верх трапеций: +повторы/вес за 3 нед', 'NSCA (верх трапеций)', ['shrug_bar']),
  c('tr-shrug-bar', 'Шраги со штангой (силовой акцент)', 'shrug_bar', ['traps'], ['volume', 'technique'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 2, tempo: '2-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Гриф у бёдер, руки прямые', 'Тяга только плечами', 'Подбородок не выводим вперёд'], 'Вес +2.5 кг при форме', 'Шраги с гантелями', 'Подъём плеч без боли 3 нед', 'NSCA (трапеции)', ['shrug_db']),
  // ── Предплечья ──
  c('fa-wrist-curl', 'Сгибания запястий (предплечья)', 'wrist_curl_db', ['forearms'], ['volume', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-1-2-0', restSec: 45, freqPerWeek: 3 },
    ['Предплечье на бедре/скамье', 'Полная амплитуда', 'Плечо не помогает'], 'Вес +1 кг при 15 чисто', 'Сжатие эспандера', 'Хват/кисть: +повторы за 3 нед', 'NSCA (хват)', ['hammer_curl']),
  c('fa-reverse-curl', 'Обратное сгибание (брахиорадиалис)', 'reverse_curl_cable', ['forearms', 'biceps'], ['volume', 'technique'], 'strength', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 2, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Хват сверху', 'Локти прижаты к корпусу', 'Без маха корпусом'], 'Вес +1 плитка при форме', 'Обратное сгибание с гантелями', 'Разгибатели запястья без боли', 'NSCA (предплечья)', ['hammer_curl']),
  // ── Руки ──
  c('bi-incline-length', 'Сгибания на наклонной (длина)', 'incline_db_curl', ['biceps'], ['activation', 'volume'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 1, tempo: '3-0-1-0', restSec: 75, freqPerWeek: 2 },
    ['Скамья 30–45° назад', 'Руки висят = растяжение', 'Супинация наверху'], 'Вес +1 кг', 'Сгибания со штангой', 'Растяжение без читинга', 'Wolf (длина)', ['curl_bar_v2']),
  c('bi-hammer-brach', 'Молотки (брахиалис/толщина руки)', 'hammer_curl', ['biceps'], ['activation', 'volume'], 'technique', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 1, tempo: '3-0-1-0', restSec: 60, freqPerWeek: 2 },
    ['Нейтральный хват', 'Локти прижаты к корпусу', 'Без супинации'], 'Вес +1 кг при форме', 'Сгибания с гантелями', 'Брахиалис: сила растёт, локоть не болит', 'NSCA (brachialis)', ['curl_db']),
  c('tri-overhead-length', 'Французский из-за головы (длина)', 'bb_triceps_long', ['triceps'], ['activation', 'volume'], 'technique', 'any',
    { sets: 2, repsMin: 10, repsMax: 12, rir: 1, tempo: '3-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Локоть фиксирован', 'Полное разгибание', 'Удержание 1с'], 'Вес +1 кг при форме', 'Разгибания на блоке', 'Локоть не гуляет', 'Maeo (overhead)', ['dips_tricep_v2'], ['pm-red']),
  c('tri-pushdown-peak', 'Разгибания на блоке (пик)', 'tricep_pushdown_rope', ['triceps'], ['volume', 'technique'], 'technique', 'any',
    { sets: 2, repsMin: 10, repsMax: 12, rir: 2, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Корпус вертикально', 'Локти назад', 'Без наклона вперёд'], 'Вес +1 шаг', 'Кикбэк лёгкий', 'Локти держат линию', 'Schoenfeld (пик)', ['tricep_pushdown_bar'], ['pm-red']),
  // ── Кор / шарнир ──
  c('core-deadbug', 'Мёртвый жук с дыханием', 'dead_bug', ['core', 'driver:core', 'hinge-fail'], ['technique', 'activation'], 'stability', 'any',
    { sets: 2, repsMin: 8, repsMax: 10, rir: 3, tempo: '3-1-3-0', restSec: 45, freqPerWeek: 3 },
    ['Поясница прижата', 'Рука + противоположная нога', 'Выдох на усилии'], 'Мёртвый жук v2 / паллоф', 'Планка на коленях', 'Поясница не отрывается весь сет', 'McGill (антиэкстензия)', ['dead_bug_v2', 'pallof_press']),
  c('core-pallof', 'Паллоф-пресс 3–5с', 'pallof_press', ['core', 'driver:core'], ['technique', 'activation'], 'stability', 'any',
    { sets: 2, repsMin: 8, repsMax: 10, rir: 3, tempo: '3-3-1-0', restSec: 45, freqPerWeek: 3 },
    ['Трос сбоку', 'Выжал — держи 3–5с', 'Таз стабилен'], 'Трос тяжелее / дальше от опоры', 'Боковая планка', 'Удержание без ротации', 'McGill (антиротация)', ['plank_side']),
  c('ab-cable-crunch', 'Скручивания в блоке (прогрессия веса)', 'cable_crunch', ['abs'], ['volume', 'technique'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 15, rir: 1, tempo: '3-1-2-0', restSec: 60, freqPerWeek: 2 },
    ['Таз фиксирован', 'Скрутка рёбер к тазу', 'Выдох на усилии'], 'Вес +2.5 кг при 15 чисто', 'Скручивания на полу', 'Пресс: +повторы при том же весе', 'McGill (антиэкстензия)', ['crunch', 'leg_raise']),
  c('ab-leg-raise', 'Подъём ног (нижний блок пресса)', 'leg_raise', ['abs', 'driver:core'], ['technique', 'activation'], 'stability', 'any',
    { sets: 2, repsMin: 10, repsMax: 15, rir: 2, tempo: '3-1-3-0', restSec: 45, freqPerWeek: 3 },
    ['Поясница прижата', 'Ноги по дуге, без рывка', 'Без раскачки корпусом'], 'Подъём коленей в висе', 'Скручивания с согнутыми ногами', 'Поясница не отрывается весь сет', 'McGill (антиэкстензия)', ['knee_raise', 'plank']),
  c('core-hinge-rdl', 'Румынская выше колен (шарнир-учеба)', 'rdl_db', ['hinge-fail', 'hamstrings', 'driver:hip'], ['technique'], 'technique', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 3, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Палка: 3 точки касания', 'Таз назад, колени мягкие', 'Выше колен — стоп'], 'Полная RDL с палкой чисто', 'Тяга троса между ног', 'Палка не отрывается весь сет', 'NASM (hinge-паттерн)', ['cable_pull_through']),
  // ── Плечо у стены / грудной ──
  c('sh-wall-slide', 'Скольжение по стене (лопатки)', 'wall_slide', ['shoulder-fail', 'driver:shoulder', 'thoracic', 'driver:thoracic', 'rot-gap'], ['technique', 'activation'], 'stability', 'any',
    { sets: 2, repsMin: 10, repsMax: 12, rir: 3, tempo: '2-1-2-0', restSec: 45, freqPerWeek: 3 },
    ['Спина к стене', 'Руки скользят вверх', 'Поясница не отрывается'], 'Жим гантелей нейтральным без боли', 'Scaption без веса', 'Стена-тест: чисто + ротация ≥50°', 'NASM (scap-контроль)', ['scaption']),
  c('sh-neutral-press', 'Тяга нейтральным хватом (плечо-сейф)', 'pulldown_rev', ['shoulder-fail', 'driver:shoulder', 'back_width'], ['technique', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 2, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Нейтральный хват', 'Локти вниз', 'Пауза в растянутой'], 'Подтягивания нейтральным', 'Тяга блока легко', 'Тяга без боли + амплитуда', 'GRSM 2025', ['pullup_neutral']),
  // ── Шарнир под весом ──
  c('lh-trap-swap', 'Трап-гриф вместо штанги (шарнир плывёт)', 'deadlift_trapbar', ['hinge-fail', 'loaded-fail', 'hamstrings', 'driver:hip'], ['technique'], 'technique', 'intermediate',
    { sets: 3, repsMin: 6, repsMax: 8, rir: 2, tempo: '2-1-1-0', restSec: 120, freqPerWeek: 1 },
    ['Стопы в центр трапа', 'Грудь вверх, спина нейтральна', 'Тяга ногами и тазом, без рывка'], 'RDL с пола чисто', 'Гакк на бицепс бедра (стопы высоко)', 'Пол не плывёт на рабочем весе', 'IJSPT-2024 (стабильны под весом)', ['hack_squat_ham', 'cable_pull_through'], ['pm-red']),
  c('lh-tempo-split', 'Сплит с темпом 3-1-1 (контроль)', 'bulgarian_split_db', ['hinge-fail', 'loaded-fail', 'quads', 'driver:hip'], ['technique', 'activation'], 'technique', 'any',
    { sets: 2, repsMin: 8, repsMax: 10, rir: 2, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Темп держишь вслух', 'Переднее колено над стопой', 'Корпус вертикально'], 'Вес +2 кг', 'Сплит без веса', 'Темп не разваливается под весом', 'Pareja-Blanco (контроль)', ['bulgarian_split']),
  // ── YBT / баланс ──
  c('ybt-split-reach', 'Сплит + баланс anterior', 'bulgarian_split_db', ['ybt-asym', 'asym', 'quads', 'glutes'], ['technique', 'genetics'], 'stability', 'any',
    { sets: 2, repsMin: 8, repsMax: 10, rir: 2, tempo: '3-0-1-0', restSec: 60, freqPerWeek: 2 },
    ['Слабая первой', 'Взгляд вперёд', 'Стопы — «раздвинь пол»'], 'YBT-разрыв ≤4 см', 'Стойка на одной ноге 30с', 'YBT anterior симметричен', 'Garrison (YBT>4 — риск)', ['leg_press_single']),
  // ── Боль жёлтая: щадящие дубли ──
  c('pm-deload-technique', 'Техника без объёма (жёлтая боль)', 'dead_bug', ['pm-yellow'], ['recovery'], 'technique', 'any',
    { sets: 2, repsMin: 8, repsMax: 10, rir: 3, tempo: '3-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Боль ≤5 днём', 'Утром <5 — иначе стоп', 'Дыхание ровное'], 'Возврат к базе при green 7 дн', 'Ходьба + сон', 'Утро <5 семь дней подряд', 'Silbernagel PMM', ['plank'], ['pm-red']),
  // ── ROUND-10: добивка тонких ячеек (зона/сигнал ≥3, причина × фаза ≥2) ──
  // Жим: watch-контур (пауза/Слото/пол) + fix-контур (доски)
  c('bw-bench-watch-floor', 'Жим с пола (пауза на полу)', 'bench_floor', ['bench-watch', 'chest', 'chest_mid'], ['technique', 'recovery'], 'technique', 'any',
    { sets: 3, repsMin: 6, repsMax: 8, rir: 2, tempo: '3-2-1-0', restSec: 120, freqPerWeek: 2 },
    ['Пауза 2с на полу', 'Лопатки сведены', 'Без отбива'], 'Та же техника +5%', 'Жим гантелей с опорой', 'Пауза стабильна весь сет', 'Noteboom 2024 (пауза/ретракция)', ['bench_db']),
  c('bw-bench-watch-spoto', 'Жим Слото (пауза на груди)', 'bench_spoto', ['bench-watch', 'chest_upper', 'bench-fix'], ['technique'], 'technique', 'intermediate',
    { sets: 3, repsMin: 5, repsMax: 6, rir: 2, tempo: '3-3-1-0', restSec: 150, freqPerWeek: 1 },
    ['Пауза 3с — замри на груди', 'Лопатки сведены весь сет', 'Отрыв без дожима'], 'Пауза короче → вес выше', 'Жим с паузой 2с', 'Пауза держится на 90% веса', 'Noteboom 2024 (стабильность)', ['bench_floor']),
  c('cu-bench-fix-board', 'Жим с досок (сильная точка)', 'bench_board', ['bench-fix', 'chest', 'chest_mid'], ['technique', 'activation'], 'strength', 'intermediate',
    { sets: 3, repsMin: 4, repsMax: 6, rir: 2, tempo: '2-1-1-0', restSec: 150, freqPerWeek: 1 },
    ['Доска — 5-8 см над грудью', 'Локти под 45-60°', 'Стоп вверху без замка'], 'Доска ниже → полный жим', 'Жим с паузой на груди', 'Боль плеча 0 + вес растёт', 'Noteboom 2024 (партиалы)', ['bench_smith']),
  // Задняя цепь: NHE-контур и аддукторы
  c('ham-nhe-ecc', 'Нордик-сгибание (эксцентрик)', 'nordic_curl',     ['nhe-weak', 'hamstrings', 'loaded-fail'], ['recovery', 'activation'], 'strength', 'intermediate',
    { sets: 3, repsMin: 3, repsMax: 6, rir: 2, tempo: '4-0-1-0', restSec: 150, freqPerWeek: 2 },
    ['Держи корпус одной линией', 'Опускание 4с — не падай', 'Руками не отталкивайся'], 'Повторы +1 за неделю', 'Нордик с помощью (руки)', 'Повторы растут, срывов нет', 'Franke 2025; van Dyk 2019', ['back_ext_glute'], ['pm-red']),
  c('add-copenhagen-str', 'Копенгаген-планка (сила аддукторов)', 'copenhagen_plank',     ['add-weak', 'adductor', 'loaded-fail'], ['recovery', 'activation'], 'strength', 'intermediate',
    { sets: 3, repsMin: 3, repsMax: 5, rir: 3, tempo: 'hold 10с', restSec: 120, freqPerWeek: 2 },
    ['Верхняя нога на опоре', 'Таз не провисает', 'Стоп до боли в паху'], 'Уровень: колено → стопа', 'Копенгаген короткой ногой', 'Асимметрия ≤15% и боль 0', 'Quintana-Cepedal 2025', ['adductor'], ['pm-red']),
  // Плечо: ER:IR и щадящий контур
  c('sh-erir-band', 'Наружная ротация (ER:IR<0.75)', 'cable_external_rotation', ['erir-low', 'shoulders', 'delt_rear'], ['activation', 'recovery'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 2, tempo: '3-1-1-0', restSec: 60, freqPerWeek: 3 },
    ['Локоть прижат к корпусу', 'Ротация только в плече', 'Без разворота корпуса'], 'Вес +1 шаг при 15', 'Ротация с резиной', 'ER:IR ≥0.75', 'Intelangelo 2025 (ER:IR)', ['face_pull']),
  c('sh-pm-facepull', 'Face pull (щадящее плечо)', 'face_pull', ['pm-yellow', 'shoulder-fail', 'shoulders', 'delt_rear'], ['recovery', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 3, tempo: '2-2-1-0', restSec: 60, freqPerWeek: 2 },
    ['Тяга к лицу, локти высоко', 'Пауза 2с в сведении', 'Боль ≤5 днём — иначе стоп'], 'Вес +1 шаг при 15', 'Тяга с резиной', 'Боль 0 + лопатки держат', 'Silbernagel PMM', ['band_pullapart'], ['pm-red']),
  c('sh-pm-pullapart', 'Разведения резины (щадящее плечо)', 'band_pullapart', ['pm-yellow', 'shoulders', 'rot-gap'], ['recovery'], 'stability', 'any',
    { sets: 2, repsMin: 15, repsMax: 20, rir: 3, tempo: '2-2-1-0', restSec: 45, freqPerWeek: 3 },
    ['Руки прямые, лопатки сводятся', 'Медленный возврат 2с', 'Дыхание ровное'], 'Резина туже', 'Разведения без резины', 'Лопатки сводятся без боли', 'Brookbush (ретракция)', ['face_pull'], ['pm-red']),
  // Грудной отдел: rot-gap
  c('th-rot-gap-drill', 'Ротация грудного отдела (замер лёжа)', 'thoracic_rotation', ['rot-gap', 'thoracic', 'driver:thoracic', 'back_thickness'], ['activation', 'recovery'], 'technique', 'any',
    { sets: 2, repsMin: 8, repsMax: 10, rir: 3, tempo: 'hold 3с', restSec: 45, freqPerWeek: 3 },
    ['Таз не отрывается', 'Ротация с выдохом', 'Задержка 3с в конце'], 'Амплитуда до 50-55° симметрично', 'Ротация с короткой амплитудой', 'Разрыв L/R ≤10°', 'NASM OHSA (T-spine)', ['pallof_press']),
  c('th-rot-gap-loaded', 'Паллоф с ротацией (под нагрузкой)', 'pallof_press_v2', ['rot-gap', 'core', 'abs', 'driver:core'], ['technique'], 'stability', 'intermediate',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 2, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Квадрат корпуса до конца', 'Ротация только по заданию', 'Выдох в конце'], '+1 шаг веса', 'Паллоф без ротации', 'Ротация под контролем без завала', 'McGill core', ['pallof_press']),
  // Зоны без третьей опции
  c('ch-lower-decline-bar', 'Жим на наклонной вниз штангой (низ груди)', 'decline_bar', ['chest_lower', 'chest'], ['volume', 'technique'], 'strength', 'intermediate',
    { sets: 3, repsMin: 6, repsMax: 8, rir: 2, tempo: '3-1-1-0', restSec: 120, freqPerWeek: 1 },
    ['Наклон 15-30° вниз', 'Касание — низ груди', 'Локти под углом, без отбива'], 'Вес +2.5 кг при форме', 'Жим гантелей на наклонной вниз', 'Низ груди: +повторы/вес за 3 нед', 'NSCA (регионарная нагрузка)', ['decline_db', 'machine_decline_press'], ['pm-red']),
  c('ch-mid-fly-cable', 'Сведение в кроссовере на уровне плеч', 'cable_fly_mid', ['chest_mid', 'chest'], ['activation', 'volume'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '3-2-1-0', restSec: 60, freqPerWeek: 2 },
    ['Линия тяги на уровне плеч', 'Пауза 2с в сведении', 'Рёбра вниз, без моста'], 'Вес +1 шаг при 15', 'Сведение в бабочке', 'Пиковое сведение держится', 'Schoenfeld MMC (изоляция)', ['pec_deck']),
  c('ch-mid-smith-pause', 'Жим Смита с паузой (середина груди)', 'bench_smith', ['chest_mid', 'chest'], ['volume'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 2, tempo: '3-2-1-0', restSec: 90, freqPerWeek: 2 },
    ['Пауза 2с на груди', 'Лопатки сведены', 'Траектория фиксирована'], 'Вес +2.5 кг при RIR≥2', 'Жим в бабочке с паузой', 'Середина: +повторы за 3 нед', 'NSCA (объём)', ['bench_db']),
  c('bt-row-db-single', 'Тяга гантели одной рукой (толщина)', 'row_db', ['back_thickness', 'back', 'asym'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 1, tempo: '2-1-2-0', restSec: 90, freqPerWeek: 2 },
    ['Слабая сторона первой', 'Локоть вдоль корпуса', 'Сведение лопатки 1с'], 'Вес +2.5 кг при форме', 'Тяга с упором в скамью', 'Толщина: +вес за 3 нед, симметрия', 'NSCA Hodge (толщина)', ['row_chest_supported']),
  c('dm-lateral-cable', 'Махи в кроссовере (средняя дельта)', 'lateral_raise_cable', ['delt_mid', 'shoulders'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '3-1-2-0', restSec: 60, freqPerWeek: 2 },
    ['Ведёшь локтем, не кистью', 'Без раскачки корпусом', 'Опускание 2с'], 'Вес +1 шаг при 15', 'Махи с резиной', 'Махи чистые на верхней границе', 'Schoenfeld (постоянное натяжение)', ['lateral_raise', 'cable_lateral']),
  c('df-front-cable', 'Подъём перед собой в кроссовере (передняя дельта)', 'front_raise_cable', ['delt_front', 'shoulders'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '3-1-2-0', restSec: 60, freqPerWeek: 2 },
    ['До уровня плеча, не выше', 'Без рывка корпусом', 'Опускание 2с'], 'Вес +1 шаг при 15', 'Подъём с резиной', 'Передняя дельта без боли', 'NASM (изоляция)', ['front_raise_db']),
  c('add-machine-str', 'Приведение бедра в тренажёре (сила)', 'adductor',     ['adductor', 'quads'], ['activation'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 2, tempo: '2-2-1-0', restSec: 90, freqPerWeek: 2 },
    ['Пауза 2с в приведении', 'Корпус прижат', 'Без рывка'], 'Вес +1 шаг при форме', 'Копенгаген короткой ногой', 'Приведение без боли, вес растёт', 'CCEP (аддукторы)', ['copenhagen_plank'], ['pm-red']),
  c('cv-calf-press', 'Подъём на носки в жиме ногами (объём)', 'calf_press_leg', ['calves'], ['volume'], 'stability', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-2-1-0', restSec: 60, freqPerWeek: 3 },
    ['Полная амплитуда', 'Пауза 2с внизу', 'Без пружины'], 'Вес +1 шаг при 15', 'Подъём на носки стоя', 'Амплитуда и +повторы за 3 нед', 'Schoenfeld (икры часто)', ['calf_raise_standing']),
  c('tr-kelso-shrug', 'Шраги Келсо (верх трапеций)', 'kelso_shrug', ['traps', 'back'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 2, tempo: '2-2-1-0', restSec: 75, freqPerWeek: 2 },
    ['Плечи к ушам, без вращения', 'Пауза 2с вверху', 'Без рывка корпусом'], 'Вес +2.5 кг при форме', 'Шраги в наклоне', 'Верх трапеций: +вес за 3 нед', 'NSCA (шраги)', ['shrug_db']),
  c('fa-wrist-rev', 'Разгибание кисти (предплечья)', 'wrist_curl_reverse', ['forearms'], ['volume'], 'stability', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 2, tempo: '2-1-2-0', restSec: 45, freqPerWeek: 3 },
    ['Предплечье на опоре', 'Полная амплитуда', 'Без раскачки'], 'Вес +1 шаг при 15', 'Разгибание с резиной', 'Баланс сгибателей/разгибателей', 'CTD extensors-first', ['curl_wrist_db']),
  c('tri-overhead-rope-vol', 'Разгибание из-за головы (длина трицепса)', 'tricep_overhead_rope', ['triceps'], ['volume'], 'stability', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '3-1-2-0', restSec: 60, freqPerWeek: 2 },
    ['Локти смотрят вперёд', 'Пауза 1с в растянутой', 'Без разведения локтей'], 'Вес +1 шаг при 15', 'Разгибание с гантелью одной рукой', 'Длинная головка: +повторы за 3 нед', 'Maeo lengthened', ['overhead_tricep_ext']),
  c('core-bird-dog-stab', 'Bird dog (стабильность корпуса)', 'bird_dog', ['core', 'abs'], ['recovery', 'activation'], 'stability', 'beginner',
    { sets: 2, repsMin: 8, repsMax: 10, rir: 3, tempo: 'hold 5с', restSec: 45, freqPerWeek: 3 },
    ['Поясница нейтральна', 'Задержка 5с', 'Не разворачивай таз'], 'Дольше задержка', 'Bird dog на коленях', 'Корпус держит без провала', 'McGill core', ['plank_side']),
  c('ab-cable-crunch-vol', 'Скручивания в блоке (объём)', 'cable_crunch', ['abs', 'core'], ['volume'], 'stability', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '2-2-1-0', restSec: 60, freqPerWeek: 2 },
    ['Скручивание за счёт живота', 'Без тяги руками', 'Пауза в конце'], 'Вес +1 шаг при 15', 'Скручивания на полу', 'Амплитуда и +повторы за 3 нед', 'NSCA (пресс часто)', ['crunch']),
  c('hg-loaded-backext', 'Гиперэкстензия под весом (шарнир)', 'back_extension',     ['loaded-fail', 'hinge-fail', 'hamstrings', 'back'], ['activation'], 'strength', 'any',
    { sets: 3, repsMin: 8, repsMax: 12, rir: 2, tempo: '3-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Таз назад, спина одним углом', 'Без переразгибания вверху', 'Стоп при «плывущей» нейтрали'], 'Доп. вес +2.5 кг', 'Гиперэкстензия без веса', 'Нейтраль держится под весом', 'IJSPT-2024 (стабильность под нагрузкой)', ['good_morning_seated'], ['pm-red']),
  // ── ROUND-10 (≥4): вторая волна добора зон/сигналов/драйверов ──
  c('cu-bench-watch-incline-bar', 'Жим на наклонной штангой (30°, watch-контур)', 'incline_bar', ['chest_upper', 'chest', 'bench-watch', 'driver:shoulder'], ['technique', 'activation'], 'technique', 'any',
    { sets: 3, repsMin: 8, repsMax: 10, rir: 2, tempo: '3-1-1-0', restSec: 120, freqPerWeek: 2 },
    ['Наклон 30°, не 45°', 'Лопатки сведены весь сет', 'Касание — верх груди'], 'Вес +2.5% при RIR≥2', 'Жим гантелей на наклонной', 'Верх груди: +повторы за 3 нед', 'Noteboom 2024 (угол/reтракция)', ['incline_db', 'bench_smith']),
  c('ch-lower-decline-machine', 'Жим на наклонной вниз в тренажёре (низ груди)', 'machine_decline_press', ['chest_lower', 'chest'], ['volume'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 2, tempo: '2-1-1-0', restSec: 90, freqPerWeek: 2 },
    ['Траектория задана — дави ровно', 'Локти под 45°', 'Без отбива'], 'Вес +1 шаг при 12', 'Отжимания с наклоном', 'Низ груди: +вес за 3 нед', 'NSCA (регионарная нагрузка)', ['decline_db'], ['pm-red']),
  c('dm-erir-side-lying', 'Наружная ротация лёжа на боку (ER:IR + средняя дельта)', 'cable_external_rotation', ['delt_mid', 'shoulders', 'erir-low'], ['activation', 'recovery'], 'technique', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 2, tempo: '3-1-1-0', restSec: 60, freqPerWeek: 3 },
    ['Локоть прижат к корпусу', 'Ротация только в плече', 'Без разворота корпуса'], 'Вес +1 шаг при 15', 'Ротация с резиной', 'ER:IR ≥0.75', 'Intelangelo 2025 (ER:IR)', ['band_pullapart']),
  c('df-pm-front-light', 'Подъём перед собой лёгким весом (щадящее плечо)', 'front_raise_db', ['delt_front', 'shoulders', 'pm-yellow'], ['recovery', 'activation'], 'technique', 'any',
    { sets: 2, repsMin: 12, repsMax: 15, rir: 3, tempo: '2-2-1-0', restSec: 60, freqPerWeek: 2 },
    ['До уровня плеча, не выше', 'Боль ≤5 днём — иначе стоп', 'Без рывка корпусом'], 'Вес +1 шаг при 15', 'Подъём с резиной', 'Передняя дельта без боли', 'Silbernagel PMM', ['front_raise_cable'], ['pm-red']),
  c('cv-ktw-ankle-calf', 'Подъём на носки сидя + колено-к-стене (голеностоп)', 'calf_raise_seated', ['calves', 'ktw-asym', 'driver:ankle'], ['activation', 'volume'], 'stability', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 1, tempo: '3-2-1-0', restSec: 60, freqPerWeek: 3 },
    ['Полная амплитуда внизу', 'Пятка-носок без пружины', 'Колено-к-стене после сета'], 'Вес +1 шаг при 15', 'Подъём на носки стоя', 'КТС ≥9 см с двух сторон', 'PoinT GO 35–38° (ankle)', ['calf_raise', 'calf_press_leg']),
  c('tri-overhead-db', 'Разгибание из-за головы гантелью (локти фиксированы)', 'overhead_tricep_ext', ['triceps'], ['activation', 'volume'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 1, tempo: '3-1-2-0', restSec: 75, freqPerWeek: 2 },
    ['Локти смотрят вперёд', 'Пауза 1с в растянутой', 'Без разведения локтей'], 'Вес +1 шаг при 12', 'Разгибание с резиной', 'Длинная головка: +повторы за 3 нед', 'Maeo lengthened', ['tricep_overhead_rope']),
  c('tr-kelso-hold', 'Шраги Келсо с холдом 2с (верх трапеций)', 'kelso_shrug', ['traps', 'back'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 2, tempo: '2-2-1-0', restSec: 75, freqPerWeek: 2 },
    ['Плечи к ушам, без вращения', 'Холд 2с вверху', 'Без рывка корпусом'], 'Вес +2.5 кг при форме', 'Шраги в наклоне', 'Верх трапеций: +вес за 3 нед', 'NSCA (шраги)', ['shrug_db', 'shrug_bar']),
  c('fa-wrist-ext-rope', 'Разгибание кисти (предплечья — экстензоры)', 'wrist_curl_reverse', ['forearms'], ['volume'], 'stability', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 2, tempo: '2-1-2-0', restSec: 45, freqPerWeek: 3 },
    ['Предплечье на опоре', 'Полная амплитуда', 'Без раскачки'], 'Вес +1 шаг при 15', 'Разгибание с резиной', 'Баланс сгибателей/разгибателей', 'CTD extensors-first', ['reverse_curl_cable']),
  c('bi-hammer-brachialis', 'Молотковые сгибания (брахиалис)', 'hammer_curl', ['biceps', 'arms'], ['volume', 'activation'], 'strength', 'any',
    { sets: 3, repsMin: 10, repsMax: 12, rir: 1, tempo: '2-1-2-0', restSec: 75, freqPerWeek: 2 },
    ['Ладони друг к другу', 'Локоть зафиксирован', 'Опускание 2с'], 'Вес +1 кг при 12', 'Молотки с резиной', 'Толщина руки растёт без боли локтя', 'NSCA (брахиалис)', ['curl_db', 'curl_bar']),
  c('ham-nhe-hold-ecc', 'Нордик-сгибание с холдом 2с (эксцентрик)', 'leg_curl_seated', ['nhe-weak', 'hamstrings'], ['recovery', 'activation'], 'strength', 'intermediate',
    { sets: 3, repsMin: 3, repsMax: 5, rir: 3, tempo: '4-2-1-0', restSec: 150, freqPerWeek: 2 },
    ['Держи корпус одной линией', 'Опускание 4с + холд 2с', 'Руками не отталкивайся'], 'Повторы +1 за неделю', 'Нордик с помощью рук', 'Повторы растут, срывов нет', 'Franke 2025; van Dyk 2019', ['nordic_curl'], ['pm-red']),
  c('add-cable-adduction', 'Приведение бедра в кроссовере (аддукторы)', 'cable_hip_adduction', ['add-weak', 'adductor'], ['volume', 'activation'], 'stability', 'any',
    { sets: 3, repsMin: 12, repsMax: 15, rir: 2, tempo: '2-1-1-0', restSec: 60, freqPerWeek: 2 },
    ['Корпус стабилен, тянет бедро', 'Без разворота таза', 'Пауза 1с в конце'], 'Вес +1 шаг при 15', 'Копенгаген короткой ногой', 'Асимметрия ≤15%', 'CCEP (аддукторы)', ['copenhagen_plank'], ['pm-red']),
];

export const BB_CORRECTIVE_COUNT = BB_CORRECTIVES.length;

export function correctiveById(id: string): BBCorrective | null {
  const low = String(id || '').toLowerCase().trim();
  if (!low) return null;
  return BB_CORRECTIVES.find((x) => x.id.toLowerCase() === low || x.exerciseId.toLowerCase() === low) || null;
}

export interface BBScreenSignals {
  zones?: string[];
  driver?: string | null;
  benchLevel?: string | null;
  nheWeak?: boolean;
  addWeak?: boolean;
  erirLow?: boolean;
  painLevel?: 'green' | 'yellow' | 'red' | null;
  hingeFail?: boolean;
  shoulderFail?: boolean;
  ybtAsym?: boolean;
  ktwAsym?: boolean;
  asym?: boolean;
  /** K6: легаси-дубль benchWatch удалён — тег ставится из `benchLevel === 'watch'` (хаб).
   *  PRO-CORR-FIX: подросток 14–15 (нагруженные пробы запрещены) — режет teen-loaded. */
  teenBlocked?: boolean;
  /** PRO-CORR-FIX: боль плеча (жёлтая/красная) — режет shoulder-pain. */
  shoulderPain?: boolean;
  /** PRO-CORR-FIX: разрыв ротации грудного ≥10° — тег rot-gap. */
  rotGap?: boolean;
  /** H2: нагруженный шарнир плывёт (нейтраль не держится под весом) — тег loaded-fail. */
  loadedFail?: boolean;
  cause?: BBWeakCause | null;
  level?: string | null;
  equipment?: string[];
  /** K5: id упражнений, уже стоящих в плане — дубль-кандидат уступает альтернативе
   *  (раньше топ-1 «уже в плане» давал skippedDup и зона оставалась без коррекции). */
  inPlanIds?: string[];
}

/** Маппинг сырых скринингов → сигнальные теги (честно: неизвестное — тихо). */
export function tagsForMovementScreens(s: BBScreenSignals): string[] {
  const out = new Set<string>();
  const push = (t: string | null | undefined) => { const v = String(t || '').toLowerCase().trim(); if (v) out.add(v); };
  for (const z of s.zones || []) push(z);
  if (s.driver && s.driver !== 'none') push(`driver:${s.driver}`);
  if (s.benchLevel === 'fix') push('bench-fix');
  else if (s.benchLevel === 'watch') push('bench-watch');
  if (s.nheWeak) push('nhe-weak');
  if (s.addWeak) push('add-weak');
  if (s.erirLow) push('erir-low');
  if (s.hingeFail) push('hinge-fail');
  if (s.shoulderFail) push('shoulder-fail');
  if (s.ybtAsym) push('ybt-asym');
  if (s.ktwAsym) push('ktw-asym');
  if (s.asym) push('asym');
  if (s.painLevel === 'yellow') push('pm-yellow');
  if (s.rotGap) push('rot-gap');
  if (s.loadedFail) push('loaded-fail');
  return Array.from(out);
}

function levelOk(c: BBCorrective, level: string | null | undefined): boolean {
  const lv = String(level || 'intermediate').toLowerCase();
  const cl: string = c.level;
  if (cl === 'any') return true;
  if (lv === 'beginner') return cl === 'beginner';
  return true;
}

let catEquipCache: Map<string, string[]> | null = null;
/** Оборудование упражнения по каталогу (словарь профиля: barbell/dumbbell/machine/cable/bodyweight/band/kettlebell). */
function catalogEquipmentOf(exerciseId: string): string[] | null {
  try {
    if (!catEquipCache) {
      catEquipCache = new Map();
      for (const c of EXERCISE_CATALOG as any[]) {
        const id = String(c?.id || '').toLowerCase().trim();
        if (!id || catEquipCache.has(id)) continue;
        const raw: unknown[] = Array.isArray((c as any).equipment) ? (c as any).equipment : [(c as any).equipment];
        catEquipCache.set(id, raw.map((e: unknown) => String(e || '').toLowerCase().trim()).filter(Boolean));
      }
    }
    return catEquipCache.get(String(exerciseId || '').toLowerCase().trim()) ?? null;
  } catch { return null; }
}

/** Честный фильтр зала: единый helper с ранжиром (K5), но со строгой machine-политикой —
 *  домашнему залу без тренажёров тренажёрная коррекция бесполезна (каталожный rank
 *  сохраняет machine-доступность — calibrated-лок max-pro). */
function equipOk(c: BBCorrective, wanted: string[] | undefined): boolean {
  if (!wanted || !wanted.length) return true;
  return equipmentAllows(catalogEquipmentOf(c.exerciseId), wanted, { machineAlways: false });
}

/** Ранг библиотеки: зона +5, драйвер/сигнал +4, причина +3, unilateral-при-асимметрии +2. Противопоказания: красная боль (pm-red), подросток (teen-loaded), боль плеча (shoulder-pain). K5: упражнение из плана — исключается (альтернатива важнее дубля). Возвращает запас 6: хаб спрашивает до 3, K4-кандидаты — больше. */
export function rankCorrectives(s: BBScreenSignals): Array<{ corr: BBCorrective; score: number; why: string[] }> {
  const tags = new Set(tagsForMovementScreens(s));
  const inPlan = new Set((s.inPlanIds || []).map((x) => String(x || '').toLowerCase().trim()).filter(Boolean));
  const out: Array<{ corr: BBCorrective; score: number; why: string[] }> = [];
  for (const c of BB_CORRECTIVES) {
    if (inPlan.has(String(c.exerciseId || '').toLowerCase())) continue;
    if (!levelOk(c, s.level)) continue;
    if (s.painLevel === 'red' && c.contraindicated.includes('pm-red')) continue;
    if (s.teenBlocked && c.contraindicated.includes('teen-loaded')) continue;
    if (s.shoulderPain && c.contraindicated.includes('shoulder-pain')) continue;
    if (!equipOk(c, s.equipment)) continue;
    let score = 0;
    const why: string[] = [];
    const zoneHit = (s.zones || []).some((z) => c.targets.includes(String(z || '').toLowerCase()));
    if (zoneHit) { score += 5; why.push('в зону'); }
    let sigHit = 0;
    for (const t of c.targets) {
      if (t.includes(':') || t.startsWith('bench') || t.endsWith('-weak') || t.endsWith('-low') || t.endsWith('-fail') || t.endsWith('-asym') || t.endsWith('-gap') || t === 'asym' || t === 'pm-yellow') {
        if (tags.has(t)) sigHit++;
      }
    }
    if (sigHit) { score += 4 * sigHit; why.push('под сигнал'); }
    if (s.cause && c.causes.includes(s.cause)) { score += 3; why.push(`причина ${s.cause}`); }
    if (s.asym && /single|одной|слабая/i.test(`${c.title} ${c.cues.join(' ')}`)) { score += 2; why.push('unilateral'); }
    if (!zoneHit && !sigHit) continue;
    score += c.phase === 'technique' ? 1 : 0;
    out.push({ corr: c, score, why });
  }
  out.sort((a, b) => b.score - a.score || a.corr.id.localeCompare(b.corr.id));
  return out.slice(0, 6);
}

/** Доза под причину + готовность/боль: recovery и любая красная/жёлтая боль режут объём, техника — объём не растит. */
export function correctiveDose(
  corr: BBCorrective,
  cause: BBWeakCause | null | undefined,
  opts: { readinessRed?: boolean; painYellow?: boolean; painRed?: boolean } = {},
): { sets: number; repsMin: number; repsMax: number; rir: number; tempo: string; note: string } {
  let sets = corr.protocol.sets;
  let rir = corr.protocol.rir;
  const notes: string[] = [];
  if (cause === 'recovery') {
    notes.push('восстановление первично — объём не растим');
    if (sets > 2) { sets = 2; notes.push('срезано до 2 сетов'); }
    rir = Math.min(3, rir + 1);
  }
  if (cause === 'technique' || cause === 'activation') {
    notes.push(cause === 'technique' ? 'смена углов/темпа, без +объёма' : 'lengthened первым + MMC');
  }
  if (cause === 'genetics') notes.push('малыми дозами 4–5×, меряем 12 нед');
  if (opts.readinessRed || opts.painYellow || opts.painRed) {
    sets = Math.max(1, Math.round(sets * 0.75));
    rir = Math.min(3, rir + 1);
    notes.push('готовность/боль: −25% объёма, RIR+1');
  }
  return { sets, repsMin: corr.protocol.repsMin, repsMax: corr.protocol.repsMax, rir, tempo: corr.protocol.tempo, note: notes.join(' · ') || 'база' };
}

/** Строки для моста/печати/CSV (всё через esc на стороне рендера). */
export function correctiveExportLines(
  corr: BBCorrective,
  dose?: { sets: number; repsMin: number; repsMax: number; rir: number; tempo: string } | null,
): string[] {
  const d = dose || corr.protocol;
  return [
    `${corr.title}: ${d.sets}×${d.repsMin}–${d.repsMax} RIR${d.rir} ${d.tempo}`,
    `Кью: ${corr.cues.join(' · ')}`,
    `Прогрессия: ${corr.progression} · Ре-тест: ${corr.retest} (${corr.source})`,
  ];
}

/** K3: множитель веса коррекции по фазе записи (техника/стабильность — ниже, сила — выше).
 *  Единый источник: карточка хаба и инъекция обязаны считать одно и то же («показано = вставится»). */
export function correctiveLoadFactor(phase: BBCorrPhase): number {
  return phase === 'strength' ? 0.7 : 0.6;
}

/** RU-имя причины для UI. */
export const BB_CAUSE_RU: Record<BBWeakCause, string> = {
  volume: 'объём',
  activation: 'включение',
  recovery: 'восстановление',
  technique: 'техника',
  genetics: 'рычаги',
};
