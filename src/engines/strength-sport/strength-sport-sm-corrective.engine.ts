/**
 * strength-sport-sm-corrective.engine.ts — СТРУКТУРИРОВАННАЯ БИБЛИОТЕКА КОРРЕКЦИИ ДВИЖЕНИЙ СТРОНГА (SM PRO)
 *
 * Проблема: коррекция была россыпью — 3 id-строки на фазу в SM_BIOMECH без техники,
 * топ-3 только по первой фазе (smRankTop), без доз по причине, сессии и волны с именами.
 * Решение: библиотека 48 записей (16 фаз × 3 вида: technique/strength/stability),
 * каждая — target + errors + causes + level + protocol + cues + progression/regression + source.
 * Паритет с TA ta-corrective.engine (контент-слой; ранжир/инъекция/экспорт не тронуты).
 *
 * Источники синтеза (2024–2026):
 *  - Heezza/JMStrength log-press 2024–2025: SSB jerk-dip to pin 3×3, viper press,
 *    pin press (лоб), floor/close-grip/JM press, incline/Swiss, Z-press, paused log,
 *    front squat, band pull-aparts + clean EMOM, yoke holds 30–45с
 *  - Cerberus/Forge stone 2024: high-hips, tacky, lap 2с, triple extension,
 *    front squat (anterior load), sandbag pendlay rows, stone extension
 *  - GrinderGym/EliteFTS: zercher squat = симулятор камня/переноски, front squat = поза,
 *    seal rows / Wool row / front-rack holds — верх спины под йок/лог
 *  - IUSCA 2026 farmers vs zercher carry: нагрузка спереди (ZC) грузит multifidus
 *    и укорачивает шаг — suitcase/zercher-керри как стабильность
 *  - Winwood/McGill/Hindle/Legg/Harris/Heazlewood — канон движка (см. sm-biomechanics)
 *
 * Чистый движок, без UI/storage.
 */

import type { SMWeakPoint } from './strength-sport-sm-biomechanics.engine';
import type { SMWeakCause } from './strength-sport-sm-weak-cause.engine';

export type SMCorrectiveKind = 'technique' | 'strength' | 'stability';
export type SMCorrectiveLevel = 'beginner' | 'intermediate' | 'advanced';

export interface SMCorrectiveProtocol {
  sets: number;
  reps: number | string;
  pct: number;
  rir: number;
  tempo: string;
  restSeconds: number;
  distanceM?: number;
}

export interface SMCorrective {
  id: string;
  phase: SMWeakPoint;
  kind: SMCorrectiveKind;
  target: string;
  errors: string[];
  causes: SMWeakCause[];
  level: SMCorrectiveLevel;
  protocol: SMCorrectiveProtocol;
  cues: string[];
  progression: string;
  regression: string;
  source: string;
}

export interface SMCorrectiveRanked extends SMCorrective {
  score: number;
  protocolAdj: SMCorrectiveProtocol;
  doseNote: string;
}

const C = (
  id: string,
  phase: SMWeakPoint,
  kind: SMCorrectiveKind,
  target: string,
  errors: string[],
  causes: SMWeakCause[],
  level: SMCorrectiveLevel,
  protocol: SMCorrectiveProtocol,
  cues: string[],
  progression: string,
  regression: string,
  source: string,
): SMCorrective => ({ id, phase, kind, target, errors, causes, level, protocol, cues, progression, regression, source });

/** 48 записей: 16 фаз × (technique/strength/stability). Дозы в коридорах: sets 1–6, pct 50–90, rir 0–4, отдых 60–300. */
export const SM_CORRECTIVES: SMCorrective[] = [
  // ── 1. log_dip: дип 8–12 см ──
  C('sm_log_dip_tech', 'log_dip', 'technique', 'Вертикальный дип 8–12 см без завала вперёд',
    ['дип вперёд (лог уходит от груди)', 'слишком глубокий/медленный дип (теряется пружина)', 'колени внутрь'],
    ['technique', 'mobility'], 'beginner',
    { sets: 4, reps: 3, pct: 60, rir: 3, tempo: '2-2-1-0', restSeconds: 120 },
    ['Ребра вниз, локти вперёд', 'Brace до дипа, не во время', 'Глубина — ладонь (10 см), не бедро'],
    'SSB jerk-dip to pin 3×3 → пауза-дип 2с с логом → полный цикл',
    'Дип без веса у стойки → пустой лог', 'SSB jerk-dip to pin (Heezza 2024); Zhang dip 0.20с'),
  C('sm_log_dip_strength', 'log_dip', 'strength', 'Ноги под дип: квадрицепс + ягодицы',
    ['недожим из дипа (слабые ноги)', 'потеря скорости на выходе'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 5, pct: 75, rir: 2, tempo: '3-1-1-0', restSeconds: 150 },
    ['Фронтальный присед: торс вертикально', 'Взрыв из паузы, без отбива'],
    'Фронт-присед 4×5 → +2.5% при всех чистых → пуш-пресс связкой',
    'Гоблет-присед 3×8', 'Front squat → log drive (JMStrength 2025)'),
  C('sm_log_dip_stab', 'log_dip', 'stability', 'Жёсткий кор на дипе (анти-сгиб)',
    ['поясница гнётся на дипе', 'дыхание теряется'], ['mobility', 'fatigue', 'technique'], 'beginner',
    { sets: 3, reps: 8, pct: 50, rir: 3, tempo: 'brace 2с — dip', restSeconds: 90 },
    ['Вдох в живот до дипа, выдох после драйва', 'Пояс нейтраль — зеркало сбоку'],
    'Планка 3×30с → фронт-rack hold 3×20с → дип под нагрузкой',
    'Дыхательные дриллы лёжа', 'McGill brace; Heezza «brace before dip»'),

  // ── 2. log_drive: драйв ──
  C('sm_log_drive_tech', 'log_drive', 'technique', 'Ноги первыми, руки вторыми (60–70% импульса)',
    ['жим руками без ног', 'отклон назад вместо вертикали'], ['technique', 'fatigue'], 'beginner',
    { sets: 4, reps: 3, pct: 65, rir: 2, tempo: '1-0-1-0', restSeconds: 120 },
    ['«Ноги в пол — лог в потолок»', 'Голова назад до локаута'],
    'Пуш-пресс 4×3 → viper press (без перепостановки) → лог на скорость',
    'Пуш-пресс с пустым грифом', 'Heezza viper press; JMStrength head-back'),
  C('sm_log_drive_strength', 'log_drive', 'strength', 'Плечи + трицепс под драйв',
    ['лог встаёт, но не дожимается (слабый верх)'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 5, pct: 75, rir: 2, tempo: '2-0-1-0', restSeconds: 150 },
    ['Строгий лог/аксель сидя — без ног', 'Локти вперёд, не врозь'],
    'Строгий жим 4×5 → +2.5% → пуш-пресс тяжёлый 3×3',
    'Жим гантелей нейтральным хватом 3×8', 'Felix/Reece: incline + нейтральный жим (BarBend 2025)'),
  C('sm_log_drive_stab', 'log_drive', 'stability', 'Верх спины держит rack (лог не сползает)',
    ['лог сползает с груди', 'плечи круглые в rack'], ['technique', 'mobility'], 'beginner',
    { sets: 3, reps: 10, pct: 50, rir: 3, tempo: '2-1-1-0', restSeconds: 90 },
    ['Грудь вверх, лопатки сведены', 'Тяжёлый фронт-rack hold 20с'],
    'Тяга блока 3×10 → seal row → фронт-rack hold с логом',
    'Band pull-aparts 3×15', 'Heezza: rows > band pull-aparts для лога'),

  // ── 3. log_lockout: локаут ──
  C('sm_log_lockout_tech', 'log_lockout', 'technique', 'Фиксация над макушкой, голова проходит в конце',
    ['лог перед головой (не локаут)', 'ранний проход головой (лог вперёд)', 'неравномерный жим'],
    ['technique'], 'beginner',
    { sets: 4, reps: 3, pct: 65, rir: 2, tempo: '2-1-1-0', restSeconds: 120 },
    ['Голова назад, пока лог не встал', 'Шраг вверху + пауза 1с'],
    'Пин-пресс со лба 4×3 → полный лог с паузой вверху',
    'Жим сидя с паузой вверху', 'JMStrength: head-back до локаута'),
  C('sm_log_lockout_strength', 'log_lockout', 'strength', 'Трицепс локаута',
    ['середина идёт, верх стоит'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 6, pct: 75, rir: 2, tempo: '2-0-1-0', restSeconds: 150 },
    ['Узкий хват, локти к корпусу', 'JM-press: штанга ко лбу, не к груди'],
    'Close-grip/Floor/JM 4×6 → +2.5% → пин-пресс тяжёлый',
    'Отжимания на брусьях 3×8', 'Heezza: rolling extensions + JM press'),
  C('sm_log_lockout_stab', 'log_lockout', 'stability', 'Оверхед-стабильность (плечо + торакальный)',
    ['шат вверху', 'не держит 1с'], ['mobility', 'fatigue'], 'beginner',
    { sets: 3, reps: 5, pct: 55, rir: 3, tempo: '3-2-1-0', restSeconds: 120 },
    ['Z-press: сидя на полу, без читинга ногами', 'Грудной отдел открыт'],
    'Z-press 3×5 → yoke hold 30с → лог с паузой 3с',
    'Жим гантелей сидя 3×8', 'Z-press (Heezza accessory)'),

  // ── 4. log_clean: заброс ──
  C('sm_log_clean_tech', 'log_clean', 'technique', 'Перекат по животу + подрыв (continental)',
    ['тяга руками (бицепс)', 'низкий таз на старте', 'лог бьёт по груди'], ['technique', 'grip'], 'intermediate',
    { sets: 4, reps: 3, pct: 60, rir: 3, tempo: '1-0-1-0', restSeconds: 150 },
    ['Руки-канаты, трицепс напряжён', 'Таз высоко, как на камне', 'Локти под лог до подрыва'],
    'Лог-clean отдельно EMOM → связка clean+press → viper',
    'Тяга с плинтов + перекат пустого лога', 'JTS log clean; Heezza log-clean EMOM'),
  C('sm_log_clean_strength', 'log_clean', 'strength', 'Задняя цепь заброса',
    ['не отрывает / не дотягивает до груди'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 5, pct: 75, rir: 2, tempo: '2-0-1-0', restSeconds: 150 },
    ['RDL: таз назад, спина нейтраль', 'Взрыв бедрами, не спиной'],
    'RDL 4×5 → становая с паузой → лог-clean тяжёлый',
    'Гиперэкстензия 3×12', 'Heezza: deadlift with bands под clean'),
  C('sm_log_clean_stab', 'log_clean', 'stability', 'Прямые руки под нагрузкой (профилактика бицепса)',
    ['сгибание рук на забросе (риск дистального разрыва)'], ['technique', 'fatigue'], 'beginner',
    { sets: 3, reps: 20, pct: 50, rir: 4, tempo: 'walk 20м', restSeconds: 120, distanceM: 20 },
    ['«Крюки, не руки»', 'Лямки на тяжёлых забросах — честно'],
    'Фермер-hold 3×20с → лог-hold → clean с контролем рук',
    'Вис на турнике 3×15с', 'Heazlewood 2025 biceps prevention'),

  // ── 5. yoke_pickup: съём ──
  C('sm_yoke_pickup_tech', 'yoke_pickup', 'technique', 'Brace 2с + вертикальный съём',
    ['съём без brace (поясница)', 'рывок вместо выдавливания'], ['technique', 'mobility'], 'beginner',
    { sets: 4, reps: 2, pct: 70, rir: 3, tempo: 'brace 2с — stand', restSeconds: 180 },
    ['Воздух в живот, пояс в ремень', 'Дави ногами в пол, не дёргай'],
    'Пикап + 5м 4×2 → полный йок 20м → +5% при чистом',
    'Пикап пустой рамы', 'McGill yoke max load; Heezza yoke pickups'),
  C('sm_yoke_pickup_strength', 'yoke_pickup', 'strength', 'Ноги под 3–4×BW',
    ['не встаёт / встаёт криво'], ['strength', 'volume'], 'advanced',
    { sets: 4, reps: 4, pct: 80, rir: 2, tempo: '3-1-1-0', restSeconds: 180 },
    ['Пауза-присед 2с внизу', 'Коленям — наружу, торс вертикально'],
    'Пауза-присед 4×4 → фронт-присед → пикап тяжелее',
    'Гоблет-присед 3×8', 'SSB box squat (Conjugate strongman)'),
  C('sm_yoke_pickup_stab', 'yoke_pickup', 'stability', 'Кор-жёсткость под осевой',
    ['вальгус под йоком', 'наклон в сторону'], ['mobility', 'fatigue'], 'beginner',
    { sets: 3, reps: 30, pct: 50, rir: 3, tempo: 'hold 30с', restSeconds: 90 },
    ['Suitcase carry 20м — таз ровно', 'Стопы 40–60 см, взгляд вперёд'],
    'Side plank 3×30с → suitcase 3×20м → yoke hold 30с',
    'Планка 3×20с', 'McGill QL / suitcase carry'),

  // ── 6. yoke_walk: ходьба ──
  C('sm_yoke_walk_tech', 'yoke_walk', 'technique', 'Короткий шаг 40–60 см + каденс',
    ['длинный шаг (качание)', 'взгляд вниз', 'торможение на середине'], ['technique'], 'beginner',
    { sets: 3, reps: '15м', pct: 60, rir: 3, tempo: 'walk 15м', restSeconds: 180, distanceM: 15 },
    ['Малые быстрые шаги', 'Грудь вверх, глаза вперёд'],
    'Техника 50% ×50ft → 70% 20м на скорость → тяжёлый 20м',
    'Ходьба с пустой рамой', 'Heezza: скорость на 60% отдельно (Legg)'),
  C('sm_yoke_walk_strength', 'yoke_walk', 'strength', 'Ноги + трапеции под ходьбу',
    ['садится на дистанции', 'не держит темп'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 5, pct: 75, rir: 2, tempo: '2-0-1-0', restSeconds: 180 },
    ['Фронт-присед — поза йока', 'Шраги с паузой 2с'],
    'Фронт-присед 4×5 → шраги → йок тяжелее на 5%',
    'Выпады 3×8/нога', 'Front squat → yoke (GrinderGym)'),
  C('sm_yoke_walk_stab', 'yoke_walk', 'stability', 'Анти-lateral flex (не качаться)',
    ['sway >5 см', 'корпус складывается'], ['mobility', 'fatigue', 'technique'], 'beginner',
    { sets: 3, reps: '20м', pct: 55, rir: 3, tempo: 'brace 2с — walk', restSeconds: 180, distanceM: 20 },
    ['Чемоданная переноска — не наклоняться', 'Дыхание — короткие доборы на ходу'],
    'Suitcase 3×20м → zercher carry 3×20м → йок на стабильность',
    'Прогулка с гантелью в одной руке 2×20м', 'IUSCA 2026 ZC vs FC; McGill'),

  // ── 7. yoke_turn: разворот ──
  C('sm_yoke_turn_tech', 'yoke_turn', 'technique', 'Малые шаги на 180°, brace не отпускать',
    ['широкий шаг на развороте', 'потеря brace (поясница)', 'спешка'], ['technique'], 'intermediate',
    { sets: 3, reps: 3, pct: 70, rir: 3, tempo: 'turn 180°', restSeconds: 180 },
    ['Топчись мелко, не шагай широко', 'Держи воздух весь разворот'],
    'Дрилл 3×180° @70% → с таймером → в медли',
    'Разворот с пустой рамой', 'EliteFTS yoke turn'),
  C('sm_yoke_turn_strength', 'yoke_turn', 'strength', 'Ноги ротации под нагрузкой',
    ['не доворачивает / застревает'], ['strength'], 'intermediate',
    { sets: 3, reps: 6, pct: 70, rir: 2, tempo: '2-0-1-0', restSeconds: 150 },
    ['Тяга саней боком/спиной', 'Ягодицы — разворот, не поясница'],
    'Sled drag 3×20м → yoke turn тяжелее',
    'Боковые выпады 3×8', 'Conjugate: sled после DE-lower'),
  C('sm_yoke_turn_stab', 'yoke_turn', 'stability', 'Косые + приводящие (держат таз на развороте)',
    ['таз уходит / колено внутрь'], ['mobility', 'fatigue'], 'beginner',
    { sets: 3, reps: 30, pct: 50, rir: 3, tempo: 'hold 30с', restSeconds: 90 },
    ['Копенгаген-планка 20–30с/сторона', 'Стопы под тазом'],
    'Side plank → Copenhagen → turn под нагрузкой',
    'Ягодичный мост 3×12', 'EliteFTS turn drill'),

  // ── 8. farmers_pickup: съём фермера ──
  C('sm_farmers_pickup_tech', 'farmers_pickup', 'technique', 'Двойная становая без рывка',
    ['рывок спиной', 'кругление', 'пауза внизу (теряет натяг)'], ['technique', 'grip'], 'beginner',
    { sets: 4, reps: 3, pct: 70, rir: 2, tempo: '2-1-1-0', restSeconds: 180 },
    ['Грудь вверх, руки-канаты', 'Натяг → выдавливание, не дёрг'],
    'Становая с паузой <колена → фермер-пикап + hold 10с → ходьба',
    'Становая с гирей 3×5', 'FitnessVolt farmers pickup'),
  C('sm_farmers_pickup_strength', 'farmers_pickup', 'strength', 'Тяга + трапеции под съём',
    ['не отрывает / отрывает криво'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 4, pct: 80, rir: 2, tempo: '2-0-1-0', restSeconds: 180 },
    ['Тяга с плинтов — верхняя половина', 'Плечи назад вверху'],
    'Плинты 4×4 → становая → фермер тяжелее',
    'Тяга гантелей 3×8', 'Conjugate ME-lower ротация'),
  C('sm_farmers_pickup_stab', 'farmers_pickup', 'stability', 'Хват держит съём (без лямок)',
    ['ручки выскальзывают', 'асимметрия сторон'], ['grip', 'fatigue'], 'beginner',
    { sets: 3, reps: 20, pct: 55, rir: 3, tempo: 'hold 20с', restSeconds: 120 },
    ['Меряй L/R отдельно', 'Fat Gripz на разминке'],
    'Вис 3×15с → фермер-hold 20с → пикап без лямок',
    'Кистевой эспандер 3×12', 'AthleteProfile grip tri-modal'),

  // ── 9. farmers_carry: переноска ──
  C('sm_farmers_carry_tech', 'farmers_carry', 'technique', 'Вертикаль + шаг 60 см + каденс',
    ['наклон вперёд/вбок', 'семенящий шаг', 'остановки'], ['technique'], 'beginner',
    { sets: 3, reps: '20м', pct: 70, rir: 2, tempo: 'walk 20м', restSeconds: 180, distanceM: 20 },
    ['Грудь вверх — смотри вперёд', 'Скорость тренируй на 70%, силу — тяжелее'],
    '40м @70% на скорость → 20м тяжелее → 40м зачёт',
    'Переноска гантелей 3×20м', 'Holmstrup каденс; EliteFTS speed/strength split'),
  C('sm_farmers_carry_strength', 'farmers_carry', 'strength', 'Трапеции + предплечья под 40м',
    ['плечи ползут к ушам книзу', 'хват умирает к 30м'], ['strength', 'volume', 'grip'], 'intermediate',
    { sets: 4, reps: 8, pct: 70, rir: 2, tempo: '2-0-1-0', restSeconds: 150 },
    ['Шраги с паузой 2с вверху', 'Вис после шрагов — добивка хвата'],
    'Шраги 4×8 → фермер-heavy 20м → 40м',
    'Прогулка с гирями 3×20м', 'EliteFTS farmers grip work'),
  C('sm_farmers_carry_stab', 'farmers_carry', 'stability', 'Кор-вертикаль под боковой нагрузкой',
    ['lateral bend', 'таз качается'], ['mobility', 'fatigue'], 'beginner',
    { sets: 3, reps: '20м', pct: 55, rir: 3, tempo: 'brace — walk', restSeconds: 180, distanceM: 20 },
    ['Suitcase carry — таз ровно', 'Короткий выдох каждые 5 шагов'],
    'Suitcase 3×20м → zercher carry → фермер на стабильность',
    'Односторонняя переноска 2×20м', 'IUSCA 2026; McGill QL'),

  // ── 10. farmers_grip: хват-лимитер ──
  C('sm_farmers_grip_tech', 'farmers_grip', 'technique', 'Support-хват: кисть ровно, без переразгиба',
    ['кисть ломается назад', 'перехват на ходу'], ['grip', 'technique'], 'beginner',
    { sets: 3, reps: 15, pct: 50, rir: 3, tempo: 'hold 15с', restSeconds: 120 },
    ['Кисть — продолжение предплечья', 'Мел/лямки — только зачёт, не база'],
    'Pinch 2×15с → фермер-hold → зачёт без лямок',
    'Сжатие мяча 3×15', 'SBS grip 2024; AthleteProfile'),
  C('sm_farmers_grip_strength', 'farmers_grip', 'strength', 'Флексоры + разгибатели (сила сжатия)',
    ['не держит вес старта'], ['grip', 'strength', 'volume'], 'intermediate',
    { sets: 4, reps: 12, pct: 60, rir: 2, tempo: '2-0-1-0', restSeconds: 120 },
    ['Молоток 3×12 — брахиалис', 'CoC — лесенка, не отказ каждый раз'],
    'Hammer 3×12 → CoC лесенка → axle hold тяжелее',
    'Эспандер лёгкий 3×15', 'GripStrength CoC-периодизация'),
  C('sm_farmers_grip_stab', 'farmers_grip', 'stability', 'Симметрия L/R (предиктор разрыва бицепса)',
    ['разница >12% (стоп-сигнал)', 'одна рука всегда первая'], ['grip', 'fatigue'], 'beginner',
    { sets: 3, reps: 20, pct: 50, rir: 3, tempo: 'hold 20с', restSeconds: 120 },
    ['Замеряй каждую сторону отдельно', 'Слабая +1 сет (добивка 15–25%)'],
    'Односторонний hold → паритет → двусторонний зачёт',
    'Вис на одной руке 3×10с (со страховкой)', 'Heazlewood 2025 asymmetry'),

  // ── 11. stone_off_floor: отрыв ──
  C('sm_stone_off_floor_tech', 'stone_off_floor', 'technique', 'High-hips + руки-крюки + tacky',
    ['низкий таз (присед вместо тяги)', 'сгибание рук (риск бицепса)', 'нет tacky'], ['technique', 'grip'], 'intermediate',
    { sets: 4, reps: 3, pct: 65, rir: 3, tempo: '2-1-1-0', restSeconds: 180 },
    ['Пальцы под камень, таз высоко', 'Tacky на предплечья + грудь', 'Руки прямые весь отрыв'],
    'Дефицит-камень → камень с паузой <колена → полный цикл',
    'Становая с гирей + обхват медбола', 'JTS high-hips; Harris 2018'),
  C('sm_stone_off_floor_strength', 'stone_off_floor', 'strength', 'Ягодицы + бицепс бедра + разгибатели',
    ['не отрывает тяжёлый'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 4, pct: 80, rir: 2, tempo: '2-0-1-0', restSeconds: 180 },
    ['Дефицитная становая — низ старта', 'Спина нейтраль, грудь вверх'],
    'Дефицит 4×4 → становая → камень тяжелее',
    'RDL 3×8', 'Harris hip extensor moment > deadlift'),
  C('sm_stone_off_floor_stab', 'stone_off_floor', 'stability', 'Спина нейтраль под anterior-нагрузкой',
    ['кругление на отрыве', 'поясница после камней'], ['mobility', 'fatigue'], 'beginner',
    { sets: 3, reps: 10, pct: 55, rir: 3, tempo: '3-1-1-0', restSeconds: 150 },
    ['Сэндбэг-pendlay row 4×10 — объём низа', 'Живот в ремень до отрыва'],
    'Sandbag row 4×10 → zercher squat → камень с контролем',
    'Лодочка/гиперэкстензия 3×12', 'Cerberus: sandbag pendlay rows'),

  // ── 12. stone_lap: lap ──
  C('sm_stone_lap_tech', 'stone_lap', 'technique', 'Lap 2с на коленях + перехват',
    ['пропуск lap (рывок вверх)', 'камень на пальцах, не на коленях'], ['technique'], 'intermediate',
    { sets: 4, reps: 3, pct: 65, rir: 2, tempo: 'lap 2с', restSeconds: 150 },
    ['2 секунды на коленях — считай вслух', 'Обхват снизу, камень высоко на грудь'],
    'Lap-пауза → lap + вставание → полный цикл с загрузкой',
    'Сэндбэг-lap 3×3', 'Harris lap; Forge stone'),
  C('sm_stone_lap_strength', 'stone_lap', 'strength', 'Квадрицепс + ягодицы из lap-позы',
    ['не встаёт с колен'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 4, pct: 75, rir: 2, tempo: '3-1-1-0', restSeconds: 150 },
    ['Фронт-присед с паузой — поза lap', 'Взрыв из паузы'],
    'Фронт-присед 4×4 → zercher → lap тяжелее',
    'Присед с гирей 3×8', 'Front squat → stone (Cerberus)'),
  C('sm_stone_lap_stab', 'stone_lap', 'stability', 'Эксцентрика приёма (не ронять на колени)',
    ['падение камня на колени', 'потеря brace на приёме'], ['mobility', 'fatigue'], 'beginner',
    { sets: 3, reps: 5, pct: 55, rir: 3, tempo: '4-1-1-0', restSeconds: 150 },
    ['Принимай медленно, 4с вниз', 'Камень в грудь до вставания'],
    'Медленный приём → пауза → вставание',
    'Сэндбэг-приём 3×5 лёгкий', 'Cerberus stone extension drill'),

  // ── 13. stone_load: загрузка ──
  C('sm_stone_load_tech', 'stone_load', 'technique', 'Triple extension + грудь к камню',
    ['тяга руками вместо бёдер', 'камень далеко от тела'], ['technique', 'strength'], 'intermediate',
    { sets: 4, reps: 2, pct: 70, rir: 2, tempo: '1-0-1-0', restSeconds: 180 },
    ['Бёдра → носки → руки вверх (волна)', 'Грудь к камню, подбородок вверх'],
    'Extension без платформы → через низкую планку → зачётная высота',
    'Медбол через планку 3×5', 'Cerberus triple extension drill'),
  C('sm_stone_load_strength', 'stone_load', 'strength', 'Ягодицы + трапеции + трицепс загрузки',
    ['не дотягивает до края платформы'], ['strength', 'volume'], 'intermediate',
    { sets: 4, reps: 4, pct: 75, rir: 2, tempo: '2-0-1-0', restSeconds: 180 },
    ['Hip thrust — добор разгибания', 'Толчковый жим — верх загрузки'],
    'Hip thrust + push press → сэндбэг через планку → камень',
    'Ягодичный мост 3×10', 'Forge platform height'),
  C('sm_stone_load_stab', 'stone_load', 'stability', 'Платформа-адаптация (рост/высота)',
    ['высоким — низко, низким — высоко (не та тактика)'], ['technique', 'mobility'], 'beginner',
    { sets: 3, reps: 3, pct: 60, rir: 3, tempo: '2-1-1-0', restSeconds: 150 },
    ['Низким — взрыв раньше; высоким — дотяг грудью', 'Меряй высоту платформы до старта'],
    'Низкая планка → средняя → зачётная',
    'Запрыгивания на тумбу 3×5', 'AthleteProfile tall premium'),

  // ── 14. grip_support: tri-modal ──
  C('sm_grip_support_tech', 'grip_support', 'technique', 'Три паттерна раздельно: support/pinch/crush',
    ['один тест на всё', 'crush вместо support на фермере'], ['grip', 'technique'], 'beginner',
    { sets: 3, reps: 15, pct: 50, rir: 3, tempo: 'hold 15с', restSeconds: 120 },
    ['Support — фермер-hold; pinch — блины; crush — axle/CoC', 'Тестируй каждый месяц'],
    'Pinch block → axle hold → CoC лесенка (по слабейшему)',
    'Вис 3×10с', 'AthleteProfile tri-modal'),
  C('sm_grip_support_strength', 'grip_support', 'strength', 'Сдавливание + щипок под нагрузкой',
    ['axle выскальзывает', 'не держит pinch-ширину'], ['grip', 'strength'], 'intermediate',
    { sets: 4, reps: 10, pct: 60, rir: 2, tempo: '2-0-1-0', restSeconds: 120 },
    ['Axle hold до отказа-контроль (не до срыва)', 'Pinch — прогрессия шириной/весом'],
    'Axle hold 4×15с → pinch тяжелее → фермер без лямок',
    'Фермер-hold лёгкий 3×20с', 'IronMind axle/CoC'),
  C('sm_grip_support_stab', 'grip_support', 'stability', 'Разгибатели + prehab (локоть/запястье)',
    ['боль в локте (медиальный)', 'запястье нестабильно'], ['grip', 'fatigue'], 'beginner',
    { sets: 3, reps: 12, pct: 50, rir: 3, tempo: '2-1-1-0', restSeconds: 90 },
    ['Разгибание кисти с резинкой 3×15', 'Молоток лёгкий — кровоток'],
    'Резинка → молоток → полный tri-modal зачёт',
    'Вращения кисти 2×15', 'SBS grip prehab'),

  // ── 15. core_brace: brace + QL ──
  C('sm_core_brace_tech', 'core_brace', 'technique', 'Brace как перед ударом (360°)',
    ['втягивание живота вместо распирания', 'дыхание на пикапе'], ['technique', 'mobility'], 'beginner',
    { sets: 3, reps: 5, pct: 50, rir: 4, tempo: 'brace 5с', restSeconds: 90 },
    ['Воздух в живот + бока + поясницу', 'Пояс — обратная связь, не костыль'],
    'Лёжа-дыхание → планка с brace → пикап с brace',
    'Дыхание 5-5 3×5', 'McGill brace'),
  C('sm_core_brace_strength', 'core_brace', 'strength', 'QL + косые под переноску',
    ['складывается на 2-й половине дистанции'], ['strength', 'volume'], 'intermediate',
    { sets: 3, reps: '20м', pct: 60, rir: 2, tempo: 'walk 20м', restSeconds: 150, distanceM: 20 },
    ['Suitcase carry — вес растёт, поза та же', 'Pallof — анти-ротация'],
    'Suitcase 3×20м → zercher carry → yoke на стабильность',
    'Боковая планка с колен 3×20с', 'McGill QL; IUSCA ZC'),
  C('sm_core_brace_stab', 'core_brace', 'stability', 'Анти-ротация + анти-lateral (медли)',
    ['разворот корпуса на развороте йока', 'поясница после медли'], ['fatigue', 'technique'], 'beginner',
    { sets: 3, reps: 10, pct: 50, rir: 3, tempo: '3-2-1-0', restSeconds: 90 },
    ['Pallof press 3×10/сторона', 'Мёртвый жук — поясница в полу'],
    'Dead bug → Pallof → suitcase в медли-темпе',
    'Планка 3×20с', 'Hindle carry bracing'),

  // ── 16. conditioning: медли ──
  C('sm_conditioning_tech', 'conditioning', 'technique', 'Темп медли: быстро, без лишних перехватов',
    ['долгие переходы (съедают время)', 'рваный темп (закисление к 3-му)'], ['technique', 'fatigue'], 'beginner',
    { sets: 3, reps: '30с', pct: 60, rir: 3, tempo: 'EMOM 30с', restSeconds: 120 },
    ['Переходы — репетируй без веса', 'Дыхание — ритм шагов'],
    'Переходы вхолостую → лёгкое медли → зачётный вес',
    'Челнок 3×20м', 'EliteFTS medley transitions'),
  C('sm_conditioning_strength', 'conditioning', 'strength', 'Лактатная ёмкость 30–60с',
    ['умирает к 3-му ивенту'], ['fatigue', 'volume', 'strength'], 'intermediate',
    { sets: 5, reps: '60с', pct: 65, rir: 2, tempo: '60с/90с', restSeconds: 90 },
    ['5×60с/90с — лактат', 'Шина/провер — скорость, не вес'],
    'Alactic 8×10с/50с → lactic 5×60с/90с → медли',
    'Prowler лёгкий 5×20м', 'AthleteProfile lactate >14'),
  C('sm_conditioning_stab', 'conditioning', 'stability', 'Аэробная база (восстановление между ивентами)',
    ['не восстанавливается за 90с', 'пульс не падает'], ['fatigue', 'volume'], 'beginner',
    { sets: 3, reps: '25м', pct: 55, rir: 3, tempo: 'sprint 25м', restSeconds: 60 },
    ['Sled push sprint 25м — скорость', 'Zone 2 — 2×30мин/нед базой'],
    'Sled sprint → Zone 2 база → медли на фоне',
    'Ходьба в горку 20мин', 'EliteFTS prowler; Zone 2'),
];

/** Все фазы библиотеки (16). */
export const SM_CORRECTIVE_PHASES: SMWeakPoint[] = Array.from(
  new Set(SM_CORRECTIVES.map((c) => c.phase)),
);

/** Записи фазы (ровно 3: technique/strength/stability). */
export function correctivesForPhase(phase: SMWeakPoint): SMCorrective[] {
  return SM_CORRECTIVES.filter((c) => c.phase === phase);
}

export interface SMCorrectiveOpts {
  cause?: SMWeakCause | null;
  level?: string;
  equipment?: string[];
  mobilityRestrictions?: string[];
}

const KIND_BY_CAUSE: Record<SMWeakCause, SMCorrectiveKind> = {
  volume: 'strength',
  technique: 'technique',
  mobility: 'stability',
  fatigue: 'stability',
  strength: 'strength',
  grip: 'strength',
};

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function levelOf(s?: string): number {
  const v = String(s || 'intermediate').toLowerCase();
  if (v.includes('begin')) return 0;
  if (v.includes('adv') || v.includes('элит') || v.includes('продвинут')) return 2;
  return 1;
}

/**
 * Топ коррекции фазы под причину + уровень (ранг; доза: volume 4×5 / strength 4×4+5% / mobility-fatigue −5%).
 * Без причины — канонический порядок technique → strength → stability.
 */
export function correctivesForSMWeakPoint(phase: SMWeakPoint, opts: SMCorrectiveOpts = {}): SMCorrectiveRanked[] {
  const list = correctivesForPhase(phase);
  if (!list.length) return [];
  const cause = opts.cause ?? null;
  const wantKind = cause ? KIND_BY_CAUSE[cause] : null;
  const athLevel = levelOf(opts.level);
  const mob = new Set((opts.mobilityRestrictions || []).map((s) => String(s).toLowerCase()));
  const ranked = list.map((c) => {
    let score = 50;
    if (wantKind && c.kind === wantKind) score += 15;
    if (!cause && c.kind === 'technique') score += 10;
    // Уровень: запись не выше атлета +5, точнее — ближе
    const lr = LEVEL_RANK[c.level] ?? 1;
    score -= Math.abs(lr - athLevel) * 5;
    if (lr <= athLevel) score += 5;
    // Мобильность: stability без осевой/оверхеда — плюс; чужая зона — честно без штрафа (доза −5% ниже)
    if ((cause === 'mobility' || cause === 'fatigue') && c.kind === 'stability') score += 5;
    if (mob.has('shoulder') && /overhead|press|lockout|z-press/i.test(c.target)) score -= 5;
    const p = { ...c.protocol };
    let doseNote = `канон ${p.sets}×${p.reps} @${p.pct}%`;
    if (cause === 'volume') {
      p.sets = 4;
      if (typeof p.reps === 'number') p.reps = 5;
      doseNote = 'объём: 4×5 (добивка фазы до минимума)';
    } else if (cause === 'strength') {
      p.sets = 4;
      if (typeof p.reps === 'number') p.reps = 4;
      p.pct = Math.min(90, p.pct + 5);
      doseNote = `сила: 4×4 @${p.pct}% (+5% к канону)`;
    } else if (cause === 'mobility' || cause === 'fatigue') {
      p.pct = Math.max(50, p.pct - 5);
      doseNote = `щадящая: @${p.pct}% (−5%, мобильность/усталость)`;
    }
    return { ...c, score, protocolAdj: p, doseNote };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/** Сессия коррекции: техника → сила → стабильность, ≤6 (по 1–2 на фазу, слабейшая первая). */
export function correctiveSessionForSM(phases: SMWeakPoint[], causeByPhase: Record<string, SMWeakCause | null> = {}, level = 'intermediate'): SMCorrectiveRanked[] {
  const out: SMCorrectiveRanked[] = [];
  for (const ph of phases.slice(0, 4)) {
    const top = correctivesForSMWeakPoint(ph, { cause: causeByPhase[ph] ?? null, level });
    const first = top[0];
    if (first) out.push(first);
    if (out.length < 6 && phases.length <= 2 && top[1]) out.push(top[1]);
    if (out.length >= 6) break;
  }
  const kindRank: Record<SMCorrectiveKind, number> = { technique: 0, strength: 1, stability: 2 };
  return out.slice(0, 6).sort((a, b) => kindRank[a.kind] - kindRank[b.kind]);
}

const SM_WAVE_NAMES = ['Втягивание', 'База', 'Объём', 'Интенсив', 'Пик', 'Реализация', 'Тейпер', 'Старт'];
const SM_WAVE_SETS = [3, 3, 4, 4, 4, 4, 3, 3];

/** Волна коррекции 8 нед с именами (сеты 3-3-4-4-4-4-3-3; пик — сила, тейпер — техника). */
export function correctiveBlockForSM(phases: SMWeakPoint[], weeks = 8): Array<{ week: number; name: string; sets: number; focus: SMCorrectiveKind; lines: string[] }> {
  const w = Math.max(1, Math.min(8, Math.round(weeks) || 8));
  const out: Array<{ week: number; name: string; sets: number; focus: SMCorrectiveKind; lines: string[] }> = [];
  for (let i = 0; i < w; i++) {
    const focus: SMCorrectiveKind = i >= w - 2 ? 'technique' : i >= w - 4 ? 'strength' : 'technique';
    const lines = phases.slice(0, 4).map((ph) => {
      const top = correctivesForSMWeakPoint(ph, { cause: null });
      const pick = top.find((t) => t.kind === focus) || top[0];
      return pick ? `${ph} → ${pick.id} ${SM_WAVE_SETS[i]}×${pick.protocol.reps}` : `${ph} → техника`;
    });
    out.push({ week: i + 1, name: SM_WAVE_NAMES[i] || `Нед ${i + 1}`, sets: SM_WAVE_SETS[i], focus, lines });
  }
  return out;
}

/**
 * Замер → теги → фазы: sway (качание), VBT-просадка, асимметрия L/R, OHS-провалы
 * + movement P1–P8 (опционально, backward-compat): lap/разворот/хват-заступ/
 * дип-окно/тайр/чемодан/YBT. Пороги: sway warn 3 / crit 5 (McGill); VBT carry 15 /
 * press 10; асимметрия 7/12 (Bezkorovainyi); OHS ≥2; lap >2.0 (Hindle); разворот >3с;
 * тайр 2-я >1.0с (HP/LP); чемодан ≥7%; YBT anterior >4см (Plisky).
 */
export function smTagsForMetrics(input: {
  swayCm?: number | null; vbtLossPct?: number | null; asymmetryPct?: number | null; ohsFailed?: number | null;
  stoneLapS?: number | null; stoneZeroLap?: boolean | null;
  carryTurnS?: number | null; turnDrop?: boolean | null;
  gripLimitsCarry?: boolean | null;
  logDipOutOfWindow?: boolean | null;
  tyreSecondPullS?: number | null;
  suitcaseAsymPct?: number | null;
  ybtAntAsymCm?: number | null;
}): SMWeakPoint[] {
  const tags: SMWeakPoint[] = [];
  if (input.swayCm != null && input.swayCm > 3) tags.push('yoke_walk', 'farmers_carry');
  if (input.vbtLossPct != null && input.vbtLossPct >= 15) tags.push('yoke_walk', 'farmers_carry');
  else if (input.vbtLossPct != null && input.vbtLossPct >= 10) tags.push('log_drive', 'stone_load');
  if (input.asymmetryPct != null && input.asymmetryPct >= 7) tags.push('farmers_grip', 'grip_support');
  if (input.ohsFailed != null && input.ohsFailed >= 2) tags.push('yoke_pickup', 'stone_lap', 'log_clean');
  // movement P1–P8
  if (!input.stoneZeroLap && input.stoneLapS != null && input.stoneLapS > 2.0) tags.push('stone_lap');
  if ((input.carryTurnS != null && input.carryTurnS > 3) || input.turnDrop === true) tags.push('yoke_turn');
  if (input.gripLimitsCarry === true) tags.push('farmers_grip');
  if (input.logDipOutOfWindow === true) tags.push('log_dip');
  if (input.tyreSecondPullS != null && input.tyreSecondPullS > 1.0) tags.push('conditioning');
  if (input.suitcaseAsymPct != null && input.suitcaseAsymPct >= 7) tags.push('farmers_carry');
  if (input.ybtAntAsymCm != null && input.ybtAntAsymCm > 4) tags.push('yoke_pickup', 'stone_lap', 'log_clean');
  return Array.from(new Set(tags));
}

/** Строки экспорта коррекции (HTML/CSV/мост): фаза → топ-1 + cue + source. */
export function smCorrectiveExportLines(phases: SMWeakPoint[], causeByPhase: Record<string, SMWeakCause | null> = {}): string[] {
  return phases.slice(0, 4).map((ph) => {
    const top = correctivesForSMWeakPoint(ph, { cause: causeByPhase[ph] ?? null });
    const c = top[0];
    if (!c) return `${ph}: —`;
    return `${ph} → ${c.target} (${c.protocolAdj.sets}×${c.protocolAdj.reps} @${c.protocolAdj.pct}%): ${c.cues[0]} [${c.source}]`;
  });
}

/** Инжектабельность записи: база для моста (pct>0, sets>0). Для lock-тестов. */
export function smCorrectiveBasePct(id: string): number {
  const c = SM_CORRECTIVES.find((x) => x.id === id);
  return c && c.protocol.sets > 0 && c.protocol.pct > 0 ? c.protocol.pct : 0;
}

/**
 * Реальное id упражнения каталога за записью библиотеки (проверено по EXERCISE_CATALOG:
 * все 48 — существующие id; синтетические sm_* id в план не вшиваются никогда).
 */
export const SM_CORR_EXID: Record<SMWeakPoint, Record<SMCorrectiveKind, string>> = {
  log_dip: { technique: 'jerk_dip', strength: 'front_squat', stability: 'suitcase_carry' },
  log_drive: { technique: 'push_press', strength: 'axle_press', stability: 'ohp' },
  log_lockout: { technique: 'ohp', strength: 'push_press', stability: 'axle_press' },
  log_clean: { technique: 'deadlift', strength: 'rdl', stability: 'dead_hang' },
  yoke_pickup: { technique: 'yoke_walk', strength: 'squat', stability: 'suitcase_carry' },
  yoke_walk: { technique: 'yoke_walk', strength: 'front_squat', stability: 'suitcase_carry' },
  yoke_turn: { technique: 'yoke_walk', strength: 'sled_push_sprint', stability: 'pallof_press' },
  farmers_pickup: { technique: 'farmers_walk', strength: 'deadlift', stability: 'dead_hang' },
  farmers_carry: { technique: 'farmers_walk', strength: 'deadlift', stability: 'suitcase_carry' },
  farmers_grip: { technique: 'plate_pinch', strength: 'hammer_curl', stability: 'tow_hang' },
  stone_off_floor: { technique: 'deadlift', strength: 'good_morning', stability: 'sandbag_carry' },
  stone_lap: { technique: 'sandbag_carry', strength: 'front_squat', stability: 'squat' },
  stone_load: { technique: 'hip_thrust', strength: 'push_press', stability: 'squat' },
  grip_support: { technique: 'plate_pinch', strength: 'tow_hang', stability: 'hammer_curl' },
  core_brace: { technique: 'dead_bug', strength: 'suitcase_carry', stability: 'pallof_press' },
  conditioning: { technique: 'yoke_walk', strength: 'sled_push_sprint', stability: 'farmers_walk' },
};

/** Реальное id упражнения за записью библиотеки. */
export function exIdForSMCorrective(c: SMCorrective): string {
  return SM_CORR_EXID[c.phase]?.[c.kind] ?? 'farmers_walk';
}

/** Запись библиотеки по id (null — мусор/чужой id). */
export function libraryEntryForSM(id: string): SMCorrective | null {
  return SM_CORRECTIVES.find((x) => x.id === id) ?? null;
}

export interface SMPreferredProtocol {
  exId: string;
  sets: number;
  reps: number | string;
  pct: number;
  rir: number;
  tempo: string;
  restSeconds: number;
  distanceM?: number;
}

/**
 * Доза библиотечной ⭐ (имя + доза карточки; паритет TA protocolForPreferred).
 * Чужой id (не из фазы) → null (не подменяем молча — fallback ранжира).
 */
export function protocolForSMPreferred(phase: SMWeakPoint, prefId: string | null | undefined, cause: SMWeakCause | null = null): SMPreferredProtocol | null {
  if (!prefId) return null;
  const entry = libraryEntryForSM(prefId);
  if (!entry || entry.phase !== phase) return null;
  const ranked = correctivesForSMWeakPoint(phase, { cause });
  const pick = ranked.find((r) => r.id === entry.id) ?? ranked.find((r) => r.kind === entry.kind);
  const p = pick?.protocolAdj ?? entry.protocol;
  return {
    exId: exIdForSMCorrective(entry),
    sets: p.sets,
    reps: p.reps,
    pct: p.pct,
    rir: p.rir,
    tempo: p.tempo,
    restSeconds: p.restSeconds,
    distanceM: p.distanceM,
  };
}
