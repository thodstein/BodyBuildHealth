/**
 * strength-sport-ta-corrective.engine.ts — СТРУКТУРИРОВАННАЯ БИБЛИОТЕКА КОРРЕКЦИИ ДВИЖЕНИЙ ТА
 *
 * Проблема: коррекция жила россыпью — 3 id-строки на фазу в WL_WEAKPOINT_CORRECTION,
 * короткие corrections-строки в TA_BIOMECH, топ-3 ранжир без техники/доз/прогрессий.
 * Атлет видел «что чинить», но не видел «КАК чинить»: какое упражнение, зачем,
 * какая ошибка гасится, дозировка, кью, чем усложнить/облегчить.
 *
 * Решение: единый структурированный каталог corrective-упражнений ТА:
 *  каждая запись = фаза(ы) + тег ошибки + причина (Everett-лимитер:
 *  strength/technique/mobility) + уровень + протокол + кью + прогрессия/регрессия
 *  + источник (Catalyst/QWA/PoinT GO/Torokhtiy/Big Bend/Burgener).
 *
 * Источники (сверено Sep 2026):
 *  - Everett, Catalyst Athletics: лимитеры strength/technique/mobility; segment/
 *    halting/slow-pull/high-pull/muscle/tall/balances как точечные инструменты;
 *    «прыжок вперёд» чинится стартовой позицией + lift-off/segment/halting.
 *  - Queensland Weightlifting (QWA): матрица faults→causes→corrections взятия
 *    и толчка (ягодицы раньше грифа, бар вперёд, слабый финал, нефиксированный
 *    приём, касание коленей; слабый толчок/подсед на носках/глубокий медленный dip).
 *  - PoinT GO 2026 (IMU 800 Гц): 5-фазная прогрессия рывка; пороги ошибок —
 *    ранняя тяга >1.2 м/с, горизонталь >±10 см, уход >0.45 с, асимметрия гиро ≥5°;
 *    аксессуары по лимитеру (overhead-стабильность, hip-hinge первой тяги,
 *    взрыв второй, скорость ухода, стабильность приёма).
 *  - Torokhtiy 2025 (snatch vs clean): 8 типовых ошибок рывка + 7 взятия
 *    (ранний старт/сгиб рук/дуга/поздний взрыв/медленный turnover/краш/
 *    мобильность оверхеда/ранний подъём; тяга спиной/контакт/фронт-стойка).
 *  - Big Bend 2024 (lockout): вертикальный drive ногами (dip snatch, no-feet),
 *    локти вверх + «брить грудь», тело вокруг грифа; толчок — «ноги, потом панч»
 *    (tall jerk), behind-neck jerk, double-pause jerk.
 *  - Burgener/CrossFit 2025: ~80% ошибок — стопы (tall clean/snatch, drop snatch,
 *    snatch balance, push jerk на точность перехода pull→catch).
 *
 * Чистый движок, без UI/storage. Совместим с WLWeakPoint / TAWeakCause /
 * ta-correction-rank (ранжир остаётся скоринговой обёрткой; этот файл — контент).
 */

import type { WLWeakPoint } from './strength-sport-weakpoint';
import type { TAWeakCause } from './strength-sport-ta-weak-cause.engine';

export type TACorrectiveLevel = 'all' | 'novice' | 'intermediate' | 'advanced';
export type TACorrectivePhase = 'technique' | 'strength' | 'stability';

/** Теги ошибок движения (единый словарь хаба: видео/углы/bar-path → коррекция). */
export type TACorrectiveErrorTag =
  | 'early_pull' | 'hips_rise' | 'bar_forward' | 'jump_forward'
  | 'weak_extension' | 'slow_turnover' | 'high_catch' | 'soft_catch'
  | 'pressout' | 'bar_crash' | 'unstable_overhead' | 'early_arm_bend'
  | 'dip_forward' | 'dip_deep' | 'slow_dip' | 'drive_forward'
  | 'split_short' | 'split_asym' | 'elbows_slow' | 'chest_collapse'
  | 'feet_error' | 'knee_touch';

export interface TACorrectiveProtocol {
  sets: number;
  reps: number;
  pct: number; // % ПМ движения
  rir: number;
  tempo: string;
  restSeconds: number;
}

export interface TACorrectiveExercise {
  id: string;
  nameRu: string;
  /** Фазы, которые чинит (≥1). */
  targets: WLWeakPoint[];
  /** Теги ошибок, которые гасит. */
  errors: TACorrectiveErrorTag[];
  /** Причины-лимитеры Everett, при которых показано. */
  causes: TAWeakCause[];
  level: TACorrectiveLevel;
  phase: TACorrectivePhase;
  protocol: TACorrectiveProtocol;
  cues: string[];
  progression: string;
  regression: string;
  source: string;
}

export interface TACorrectivePick extends TACorrectiveExercise {
  protocolAdj: TACorrectiveProtocol;
  matchReason: string;
}

const P = (
  id: string, nameRu: string, targets: WLWeakPoint[], errors: TACorrectiveErrorTag[],
  causes: TAWeakCause[], level: TACorrectiveLevel, phase: TACorrectivePhase,
  protocol: TACorrectiveProtocol, cues: string[], progression: string,
  regression: string, source: string,
): TACorrectiveExercise => ({ id, nameRu, targets, errors, causes, level, phase, protocol, cues, progression, regression, source });

/** Канон библиотеки (~40 записей; покрывает все 16 WLWeakPoint ≥3 шт). */
export const TA_CORRECTIVES: TACorrectiveExercise[] = [
  // ── РЫВОК: отрыв / середина ──
  P('deficit_snatch', 'Рывок с дефицита 3–5 см', ['snatch_off_floor', 'pull_start'],
    ['early_pull', 'hips_rise', 'bar_forward'], ['technique', 'strength'], 'intermediate', 'strength',
    { sets: 4, reps: 3, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Спина — один угол до колен', 'Толкай пол, не рви гриф', 'Гриф на голенях'],
    'Дефицит 5 см → пауза 2 с у пола', 'Убрать дефицит → рывок с паузой у пола', 'Gourgoulis 2000; Everett segment'),
  P('pause_snatch', 'Рывок с паузой (пол/колено) 2 с', ['snatch_off_floor', 'snatch_mid', 'clean_mid'],
    ['early_pull', 'hips_rise', 'bar_forward'], ['technique', 'mobility'], 'all', 'technique',
    { sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-2-X-0', restSeconds: 120 },
    ['Пауза — замри, не качай', 'После паузы — взрыв, не дожимай'],
    'Пауза у пола → пауза на колене → segment', 'Вис на колене без паузы', 'Everett halting; QWA'),
  P('segment_snatch', 'Сегментный рывок (пол–колено–взрыв)', ['snatch_off_floor', 'snatch_mid'],
    ['early_pull', 'hips_rise', 'jump_forward'], ['technique'], 'intermediate', 'technique',
    { sets: 3, reps: 2, pct: 65, rir: 2, tempo: 'X-1-X-0', restSeconds: 120 },
    ['Каждый сегмент — стоп 1 с', 'Следи за смещением назад после срыва'],
    'Добавить вес → slow-pull рывок', 'Lift-off (отрыв до колена + возврат)', 'Everett segment'),
  P('slow_pull_snatch', 'Медленный рывок (тяга 3 с до колена)', ['snatch_off_floor', 'snatch_mid'],
    ['early_pull', 'bar_forward'], ['technique', 'volume'], 'novice', 'technique',
    { sets: 3, reps: 3, pct: 60, rir: 3, tempo: '3-0-X-0', restSeconds: 120 },
    ['3 секунды до колена — терпи', 'Взрыв только после колена'],
    'Segment → классика с тем же кью', 'Тяга рывковая медленно без подседа', 'Everett slow-pull'),
  P('snatch_liftoff', 'Отрыв рывковый до колена + возврат', ['snatch_off_floor', 'pull_start'],
    ['early_pull', 'hips_rise'], ['technique', 'strength'], 'novice', 'technique',
    { sets: 4, reps: 4, pct: 80, rir: 3, tempo: 'X-1-X-0', restSeconds: 90 },
    ['Сдвиг корпуса назад после срыва', 'Колени под гриф, не гриф вокруг колен'],
    'Halting deadlift → segment', 'Пустой гриф на технику старта', 'Everett lift-off'),
  P('snatch_pull', 'Рывковая тяга 100–110%', ['snatch_off_floor', 'snatch_mid', 'pull_lockout'],
    ['weak_extension', 'hips_rise', 'bar_forward'], ['strength'], 'intermediate', 'strength',
    { sets: 4, reps: 4, pct: 100, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Финиш вертикально — без опрокидывания', 'Плечи + трапеции дотягивают, руки прямые'],
    'Тяга с паузой на колене → +5%', 'RDL рывковым хватом 90–100%', 'PoinT GO; Torokhtiy'),
  P('snatch_high_pull', 'Рывковый high-pull (локти вверх)', ['snatch_mid', 'snatch_pull_under'],
    ['weak_extension', 'slow_turnover', 'early_arm_bend'], ['technique', 'strength'], 'intermediate', 'technique',
    { sets: 3, reps: 4, pct: 75, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Локти вверх и в стороны до взрыва', 'Гриф близко — «брей грудь»'],
    'Muscle snatch → tall snatch', 'Високий вис high-pull лёгким весом', 'Everett high-pull'),
  P('block_snatch', 'Рывок с блоков (подрыв)', ['snatch_mid', 'snatch_pull_under'],
    ['weak_extension', 'slow_turnover'], ['technique', 'strength'], 'advanced', 'strength',
    { sets: 4, reps: 2, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['С блоков — только взрыв, без тяги снизу', 'Ноги вертикально, не вперёд'],
    'Ниже блоки → классика', 'Высокий вис вместо блоков', 'QWA; Everett'),
  // ── РЫВОК: уход / сед / оверхед ──
  P('high_hang_snatch', 'Рывок с высокого виса', ['snatch_pull_under', 'snatch_mid'],
    ['slow_turnover', 'weak_extension', 'bar_forward'], ['technique'], 'novice', 'technique',
    { sets: 5, reps: 3, pct: 60, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Из виса — сразу под себя', 'Скорость вниз важнее высоты'],
    'Hang с колена → классика', 'Tall snatch с палкой', 'PoinT GO turnover'),
  P('tall_snatch', 'Высокий рывок (tall, без подрыва)', ['snatch_pull_under'],
    ['slow_turnover', 'high_catch', 'feet_error'], ['technique', 'fatigue'], 'novice', 'technique',
    { sets: 5, reps: 3, pct: 40, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Никакой тяги — только вниз', 'Пятки вниз, стопы точно в сед'],
    'Drop snatch → high-hang', 'Палка / пустой гриф', 'Everett tall; Burgener'),
  P('muscle_snatch', 'Масл-рывок (без подседа)', ['snatch_pull_under', 'snatch_mid'],
    ['slow_turnover', 'early_arm_bend', 'weak_extension'], ['technique', 'strength'], 'intermediate', 'technique',
    { sets: 3, reps: 4, pct: 55, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Тяни руками после полного выпрямления', 'Дожим — строго над головой'],
    'Power snatch → классика', 'High-pull вместо дожима', 'Everett muscle'),
  P('power_snatch', 'Рывок в стойку (power) + сед', ['snatch_pull_under', 'snatch_catch'],
    ['high_catch', 'soft_catch', 'slow_turnover'], ['technique'], 'intermediate', 'technique',
    { sets: 4, reps: 3, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Встреть в полуседе, затем дожми в сед', 'Не лови жёстко — встречай напряжением'],
    'Классика с паузой в седе', 'High-hang power', 'Torokhtiy turnover'),
  P('drop_snatch', 'Drop-рывок (бросок вниз без тяги)', ['snatch_pull_under', 'snatch_catch'],
    ['slow_turnover', 'feet_error', 'soft_catch'], ['technique'], 'novice', 'technique',
    { sets: 5, reps: 3, pct: 50, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Из-за головы — вниз, не вверх', 'Стопы — сразу в сед, без прыжка вперёд'],
    'Snatch balance → классика', 'Палка над головой в сед', 'Burgener; PoinT GO'),
  P('snatch_balance', 'Рывковый баланс', ['snatch_catch', 'snatch_overhead', 'snatch_pull_under'],
    ['soft_catch', 'unstable_overhead', 'slow_turnover'], ['technique', 'mobility'], 'intermediate', 'stability',
    { sets: 4, reps: 3, pct: 60, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Резко вниз под гриф', 'Приём — активный, руки пробивают вверх'],
    'Heaving balance → классика', 'Drop snatch лёгкий', 'Everett; QWA приём'),
  P('overhead_squat_v2', 'Оверхед-присед с паузой 3 с', ['snatch_catch', 'snatch_overhead'],
    ['soft_catch', 'unstable_overhead'], ['mobility', 'strength'], 'all', 'stability',
    { sets: 4, reps: 5, pct: 55, rir: 2, tempo: 'X-3-X-0', restSeconds: 120 },
    ['Пауза 3 с внизу — уверенность', 'Гриф над серединой стопы'],
    'Snatch balance → удержания 5 с', 'Присед с палкой над головой', 'PoinT GO overhead'),
  P('sots_press', 'Жим Сотса из седа', ['snatch_overhead', 'snatch_catch'],
    ['unstable_overhead', 'pressout'], ['mobility', 'technique'], 'advanced', 'stability',
    { sets: 3, reps: 5, pct: 30, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Из глубокого седа — строго вверх', 'Корпус вертикально'],
    '+вес → snatch push press из седа', 'Палка / пустой гриф', 'Torokhtiy mobility'),
  P('overhead_hold', 'Удержание оверхеда 5–8 с', ['snatch_overhead', 'snatch_catch'],
    ['unstable_overhead'], ['mobility', 'strength', 'volume'], 'novice', 'stability',
    { sets: 3, reps: 1, pct: 80, rir: 3, tempo: 'X-5-X-0', restSeconds: 90 },
    ['8 секунд — изометрия плеча', 'Лопатки вместе, рёбра вниз'],
    'Ходьба с грифом над головой', 'Палка над головой в седе', 'PoinT GO catch'),
  P('nofeet_snatch', 'Рывок без движения стоп', ['snatch_mid', 'snatch_pull_under'],
    ['jump_forward', 'bar_forward', 'feet_error'], ['technique'], 'intermediate', 'technique',
    { sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Стопы приклеены — вверх и вниз вертикально', 'Баланс на середине стопы'],
    'Dip snatch → классика', 'High-hang без стоп', 'Big Bend vertical drive'),
  P('dip_snatch', 'Рывок из подседа (dip)', ['snatch_mid', 'snatch_pull_under'],
    ['weak_extension', 'bar_forward'], ['technique'], 'novice', 'technique',
    { sets: 3, reps: 3, pct: 60, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Плечи над грифом — толкай ногами вертикально', 'Без удара бёдрами'],
    'Классика с кью «толкай пол»', 'High-pull из dip', 'Big Bend leg drive'),
  // ── ВЗЯТИЕ ──
  P('deficit_clean', 'Взятие с дефицита', ['clean_off_floor', 'pull_start'],
    ['early_pull', 'hips_rise'], ['technique', 'strength'], 'intermediate', 'strength',
    { sets: 4, reps: 3, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Грудь выше, чем в рывке', 'Ногами в пол'],
    'Пауза у пола → классика', 'Lift-off взятия', 'QWA отрыв'),
  P('pause_clean', 'Взятие с паузой на колене', ['clean_off_floor', 'clean_mid'],
    ['early_pull', 'bar_forward', 'knee_touch'], ['technique'], 'all', 'technique',
    { sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-2-X-0', restSeconds: 120 },
    ['Пауза — колени под грифом', 'Скучный (scoop) — тазом, не руками'],
    'Segment → классика', 'Вис на колене', 'QWA scoop ±5 см'),
  P('block_clean', 'Взятие с блоков', ['clean_mid', 'snatch_pull_under'],
    ['weak_extension', 'slow_turnover'], ['strength', 'technique'], 'advanced', 'strength',
    { sets: 4, reps: 2, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Взрыв из блоков без разгона', 'Локти разворачивай сразу'],
    'Ниже блоки → классика', 'High-hang clean', 'Everett blocks'),
  P('high_hang_clean', 'Взятие с высокого виса', ['clean_mid'],
    ['slow_turnover', 'elbows_slow', 'bar_crash'], ['technique'], 'novice', 'technique',
    { sets: 5, reps: 3, pct: 60, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Локти — выстрел вверх и вокруг', 'Встречай на плечах, не лови запястьями'],
    'Hang с колена → классика', 'Tall clean', 'Torokhtiy turnover'),
  P('tall_clean', 'Высокий подъём (tall clean)', ['clean_mid', 'clean_catch'],
    ['slow_turnover', 'elbows_slow', 'feet_error'], ['technique'], 'novice', 'technique',
    { sets: 5, reps: 3, pct: 40, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Без тяги — только локти и вниз', 'Стопы под себя, не вперёд'],
    'Dip clean → high-hang', 'Палка во фронт-сед', 'Everett tall; Burgener'),
  P('muscle_clean', 'Масл-взятие', ['clean_mid'],
    ['slow_turnover', 'elbows_slow'], ['technique', 'strength'], 'intermediate', 'technique',
    { sets: 3, reps: 4, pct: 55, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Дотяни руками после выпрямления', 'Фронт-стойка — локти выше'],
    'Power clean → классика', 'High-pull взятия', 'Everett muscle'),
  P('clean_pull', 'Толчковая тяга 100–110%', ['clean_off_floor', 'clean_mid', 'pull_lockout'],
    ['weak_extension', 'hips_rise'], ['strength'], 'intermediate', 'strength',
    { sets: 4, reps: 4, pct: 100, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Полное выпрямление ног/таза/корпуса', 'Шраги — после ног, не вместо'],
    'Тяга с колен + шраги → +5%', 'RDL 90–100%', 'QWA pulls'),
  P('front_squat', 'Фронтальный присед', ['clean_catch', 'squat_bottom', 'squat_mid', 'jerk_dip'],
    ['soft_catch', 'chest_collapse', 'dip_forward'], ['strength', 'mobility'], 'all', 'strength',
    { sets: 4, reps: 4, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Локти выше всю дорогу', 'Таз между пяток, грудь вверх'],
    'Пауза 3 с внизу → +5%', 'Гоблет-присед', 'QWA приём; Torokhtiy'),
  P('front_squat_clean_grip', 'Фронт-присед толчковым хватом', ['clean_catch'],
    ['chest_collapse', 'soft_catch'], ['mobility', 'strength'], 'intermediate', 'strength',
    { sets: 3, reps: 5, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Хват как во взятии — держи локти', 'Не давай грифу скатиться на запястья'],
    'Классический фронт → +5%', 'Фронт скрестно', 'Torokhtiy rack'),
  // ── ТОЛЧОК ──
  P('jerk_dip', 'Подсед толчковый (dip 8–12 см)', ['jerk_dip'],
    ['dip_forward', 'dip_deep', 'slow_dip'], ['technique'], 'novice', 'technique',
    { sets: 4, reps: 4, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Dip на всей стопе, не на носках', 'Корпус вертикально, стоп резко'],
    'Double-pause jerk → классика', 'Dip с палкой у стены', 'QWA dip'),
  P('double_pause_jerk', 'Толчок с двойной паузой (dip + ножницы)', ['jerk_dip', 'jerk_drive', 'jerk_lockout'],
    ['dip_forward', 'drive_forward', 'split_short'], ['technique'], 'intermediate', 'technique',
    { sets: 3, reps: 2, pct: 65, rir: 2, tempo: 'X-2-X-0', restSeconds: 150 },
    ['Пауза внизу dip — поправь крен', 'Пауза в ножницах — проверь базу'],
    'Классика с тем же кью', 'Dip-паузы без ножниц', 'Big Bend primer'),
  P('pause_jerk', 'Толчок с паузой в dip', ['jerk_dip', 'jerk_drive'],
    ['dip_forward', 'slow_dip'], ['technique'], 'all', 'technique',
    { sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-2-X-0', restSeconds: 120 },
    ['Мёртвая пауза — затем резкий драйв', 'Используй упругость грифа'],
    'Double-pause → классика', 'Dip без веса', 'QWA dip-drive'),
  P('jerk_balance', 'Толчковый баланс (ножницы без dip)', ['jerk_drive', 'jerk_lockout'],
    ['drive_forward', 'split_short', 'split_asym'], ['technique'], 'intermediate', 'technique',
    { sets: 4, reps: 3, pct: 60, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Ноги — поровну вперёд/назад, ширина плеч', 'Таз и плечи строго под грифом'],
    'Классика с замером базы мелом', 'Выпады со штангой над головой', 'QWA split'),
  P('behind_neck_jerk', 'Толчок из-за головы', ['jerk_drive', 'jerk_lockout'],
    ['drive_forward', 'pressout', 'unstable_overhead'], ['technique', 'strength'], 'intermediate', 'strength',
    { sets: 4, reps: 3, pct: 75, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Гриф уже за головой — только вверх', 'Перегруз: можно тяжелее классики'],
    'Классика после перегруза', 'Push press из-за головы', 'Big Bend overload'),
  P('tall_jerk', 'Высокий толчок (только панч)', ['jerk_drive', 'jerk_lockout'],
    ['pressout', 'slow_turnover', 'bar_crash'], ['technique', 'fatigue'], 'novice', 'technique',
    { sets: 5, reps: 3, pct: 45, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Ноги дали пик — руки пробивают вниз', 'Панч сильнее драйва'],
    'Push jerk → split', 'Палка в ножницах', 'Big Bend «ноги, потом панч»'),
  P('push_press', 'Швунг жимовой', ['jerk_drive', 'press_start'],
    ['weak_extension', 'pressout'], ['strength'], 'all', 'strength',
    { sets: 4, reps: 5, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Dip мелкий — драйв резкий', 'Дожим без ножниц'],
    'Push jerk → split jerk', 'Строгий жим', 'QWA drive'),
  P('push_jerk', 'Швунг толчковый (ножницы мелкие)', ['jerk_drive', 'jerk_lockout'],
    ['pressout', 'split_short'], ['technique', 'strength'], 'intermediate', 'technique',
    { sets: 4, reps: 3, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Полудвижение ножниц — лови ниже', 'Голова — под гриф, не гриф за голову'],
    'Split jerk → классика', 'Tall jerk', 'QWA; Big Bend'),
  P('split_jerk', 'Толчок в ножницы (классика)', ['jerk_lockout', 'jerk_drive'],
    ['split_short', 'split_asym', 'pressout'], ['technique'], 'intermediate', 'technique',
    { sets: 4, reps: 2, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Ножницы — поровну вперёд/назад, таз под грифом', 'Фиксация сразу, без дожима'],
    'Ножницы с паузой → +вес', 'Push jerk / tall jerk', 'QWA split; Big Bend'),
  P('jerk_recovery', 'Восстановление из ножниц (вес над головой)', ['jerk_lockout', 'snatch_overhead'],
    ['unstable_overhead', 'split_asym'], ['strength', 'mobility'], 'advanced', 'stability',
    { sets: 3, reps: 2, pct: 85, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Шаги короткие — гриф неподвижен', 'Передняя нога назад первой'],
    '+вес → перегруз уверенности', 'Ножницы с палкой', 'Overload stability'),
  // ── БАЗА: присед / тяга / жим ──
  P('pause_squat', 'Присед с паузой 3 с', ['squat_bottom', 'squat_mid', 'snatch_catch', 'clean_catch'],
    ['soft_catch', 'chest_collapse'], ['strength', 'mobility'], 'all', 'strength',
    { sets: 4, reps: 4, pct: 70, rir: 2, tempo: 'X-3-X-0', restSeconds: 150 },
    ['Пауза внизу без расслабления', 'Вверх — без завала коленей'],
    'Tempo 3-0-1 → +5%', 'Гоблет с паузой', 'Schoenfeld eccentric'),
  P('back_squat', 'Присед со штангой', ['squat_mid', 'squat_bottom'],
    ['soft_catch', 'chest_collapse'], ['strength', 'volume'], 'all', 'strength',
    { sets: 4, reps: 5, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 180 },
    ['Таз ниже параллели', 'Колени по носкам, грудь вверх'],
    'Пауза 3 с внизу → +5%', 'Гоблет-присед / ящик', 'Base strength'),
  P('hack_squat', 'Гакк-присед', ['squat_mid'],
    ['soft_catch'], ['strength'], 'intermediate', 'strength',
    { sets: 3, reps: 8, pct: 60, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Спина прижата, колени вперёд', 'Без отбива внизу'],
    '+вес → +5%', 'Жим ногами', 'QWA strength'),
  P('tempo_squat', 'Темповый присед 3-0-1', ['squat_bottom', 'squat_mid'],
    ['soft_catch', 'hips_rise'], ['technique', 'strength'], 'intermediate', 'strength',
    { sets: 3, reps: 5, pct: 65, rir: 2, tempo: '3-0-1-0', restSeconds: 150 },
    ['3 секунды вниз — контроль', 'Колени — по носкам'],
    'Пауза-присед → классика', 'Присед к ящику', 'QWA strength'),
  P('deficit_pull', 'Тяга с дефицита', ['pull_start', 'clean_off_floor'],
    ['early_pull', 'hips_rise'], ['strength'], 'advanced', 'strength',
    { sets: 4, reps: 4, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Старт ниже — спина держит угол', 'Ноги длинные, таз не стреляет'],
    '+дефицит → классика легче', 'RDL', 'QWA start'),
  P('deadlift', 'Становая тяга (классика)', ['pull_start', 'pull_lockout'],
    ['hips_rise', 'weak_extension'], ['strength'], 'intermediate', 'strength',
    { sets: 4, reps: 4, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 180 },
    ['Спина — один угол до колен', 'Ногами в пол, не спиной'],
    'Дефицит → +5%', 'RDL / тяга с плинтов', 'QWA start; base strength'),
  P('pause_pull', 'Тяга с паузой на колене', ['pull_start', 'snatch_mid', 'clean_mid'],
    ['bar_forward', 'knee_touch', 'early_pull'], ['technique', 'volume'], 'intermediate', 'technique',
    { sets: 3, reps: 4, pct: 75, rir: 2, tempo: 'X-2-X-0', restSeconds: 120 },
    ['Шраги после паузы, не вместо ног', 'Гриф скользит по бёдрам'],
    'Segment pull → классика', 'Тяга до колена', 'QWA pulls'),
  P('rdl', 'Румынская тяга (hinge)', ['snatch_mid', 'clean_mid', 'pull_lockout'],
    ['hips_rise', 'weak_extension'], ['strength', 'mobility'], 'all', 'strength',
    { sets: 3, reps: 6, pct: 60, rir: 2, tempo: '3-1-1-0', restSeconds: 120 },
    ['Таз назад, гриф по бёдрам', 'Эксцентрика 3 с — hamstring под нагрузкой'],
    'Snatch-grip RDL 90–100% рывка', 'Гудморнинг с палкой', 'PoinT GO hinge'),
  P('pin_press', 'Жим с упоров (мёртвая точка)', ['press_start', 'jerk_lockout'],
    ['pressout', 'weak_extension'], ['strength'], 'intermediate', 'strength',
    { sets: 4, reps: 3, pct: 75, rir: 2, tempo: 'X-1-X-0', restSeconds: 150 },
    ['С упоров — без инерции', 'Локти под грифом'],
    '+вес → push press', 'Жим гантелей', 'QWA press'),
  P('ohp', 'Жим стоя строгий', ['press_start'],
    ['pressout', 'weak_extension'], ['strength'], 'all', 'strength',
    { sets: 3, reps: 6, pct: 60, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Рёбра вниз, ягодицы в тонусе', 'Гриф — через лоб, голова под него'],
    'Push press → +вес', 'Жим гантелей сидя', 'Base press'),
  // ── E4: точечное расширение (split_asym / press / overhead / T-spine) ──
  P('jerk_split_measure', 'Замер базы ножниц мелом', ['jerk_drive', 'jerk_lockout'],
    ['split_short', 'split_asym'], ['technique'], 'novice', 'technique',
    { sets: 3, reps: 3, pct: 50, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Мелом отметь базу — поровну вперёд/назад', 'Таз и плечи строго под грифом'],
    'Ножницы с паузой → классика', 'Выпады со штангой над головой', 'QWA split'),
  P('oh_lunge', 'Выпады со штангой над головой', ['jerk_lockout', 'snatch_overhead'],
    ['split_asym', 'unstable_overhead'], ['technique', 'mobility'], 'intermediate', 'stability',
    { sets: 3, reps: 5, pct: 40, rir: 3, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Шаг поровну — гриф неподвижен', 'Передняя нога назад первой'],
    'Ножницы с паузой → +вес', 'Выпады с палкой над головой', 'QWA split'),
  P('split_pause', 'Ножницы с паузой 2 с', ['jerk_lockout'],
    ['split_short', 'split_asym'], ['technique'], 'intermediate', 'technique',
    { sets: 3, reps: 3, pct: 60, rir: 2, tempo: 'X-2-X-0', restSeconds: 120 },
    ['Пауза внизу — проверь базу мелом', 'Фиксация сразу, без дожима'],
    'Классика с замером базы', 'Push jerk / tall jerk', 'QWA split; Big Bend'),
  P('pin_press_high', 'Жим с высоких упоров', ['press_start', 'jerk_lockout'],
    ['pressout', 'weak_extension'], ['strength'], 'advanced', 'strength',
    { sets: 4, reps: 3, pct: 80, rir: 2, tempo: 'X-1-X-0', restSeconds: 150 },
    ['С упоров — без инерции, локти под грифом', 'Дожим до жёсткого локаута'],
    '+вес → перегруз уверенности', 'Жим гантелей', 'QWA press'),
  P('z_press', 'Z-жим сидя с пола', ['press_start'],
    ['pressout'], ['strength', 'mobility'], 'intermediate', 'strength',
    { sets: 3, reps: 6, pct: 50, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Ноги прямые — только корпус и руки', 'Рёбра вниз, без переразгибания'],
    'Строгий жим стоя → +вес', 'Жим гантелей сидя', 'Base press'),
  P('single_arm_press', 'Жим гантели одной рукой стоя', ['press_start', 'jerk_lockout'],
    ['pressout', 'drive_forward'], ['technique', 'strength'], 'intermediate', 'strength',
    { sets: 3, reps: 6, pct: 50, rir: 2, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Корпус квадрат — вторая рука в сторону', 'Дожим строго вверх, без крена'],
    'Швунг одной → двусторонний жим', 'Жим гантелей сидя', 'Unilateral press'),
  P('klokov_press', 'Жим Клокова широким хватом', ['press_start', 'snatch_overhead'],
    ['pressout', 'unstable_overhead'], ['strength'], 'advanced', 'strength',
    { sets: 3, reps: 5, pct: 55, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Широкий хват — за головой, не перед', 'Лопатки вместе всю дорогу'],
    'Швунг-жим рывковым → +вес', 'Жим стоя строгий', 'Overhead strength'),
  P('heaving_balance', 'Баланс с дожиманием (heaving)', ['snatch_catch', 'snatch_overhead'],
    ['soft_catch', 'unstable_overhead'], ['technique', 'mobility'], 'intermediate', 'stability',
    { sets: 3, reps: 3, pct: 55, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Ноги дожимают из седа — руки пробивают вверх', 'Приём активный, не падение'],
    'Snatch balance → классика', 'Drop-рывок лёгкий', 'Burgener skill transfer'),
  P('snatch_push_press', 'Швунг-жим рывковым хватом', ['snatch_overhead', 'jerk_drive'],
    ['pressout', 'weak_extension'], ['strength', 'fatigue'], 'intermediate', 'strength',
    { sets: 4, reps: 5, pct: 65, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Dip мелкий — драйв резкий, дожим без ножниц', 'Гриф над шеей'],
    'Push press → behind-neck jerk', 'Строгий жим рывковым', 'QWA drive'),
  P('jerk_support', 'Удержание толчка в ножницах 5 с', ['jerk_lockout'],
    ['unstable_overhead', 'pressout'], ['strength', 'mobility'], 'intermediate', 'stability',
    { sets: 3, reps: 1, pct: 85, rir: 3, tempo: 'X-5-X-0', restSeconds: 150 },
    ['5 секунд — изометрия, гриф неподвижен', 'Шаги короткие при сходе'],
    'Jerk recovery с шагами → +вес', 'Ножницы с палкой', 'Overload stability'),
  P('tspine_ext', 'Разгибание грудного на валике + палка', ['snatch_overhead', 'clean_catch'],
    ['unstable_overhead', 'chest_collapse'], ['mobility', 'fatigue'], 'all', 'stability',
    { sets: 3, reps: 8, pct: 20, rir: 3, tempo: 'X-2-X-0', restSeconds: 60 },
    ['Валик под лопатками — руки над головой', 'Рёбра вниз, поясница не участвует'],
    'Оверхед-присед с палкой → со штангой', 'Кошка-верблюд', 'T-spine mobility'),
  P('dead_bug_oh', 'Dead bug с палкой над головой', ['snatch_overhead', 'jerk_lockout'],
    ['unstable_overhead'], ['mobility', 'fatigue'], 'all', 'stability',
    { sets: 3, reps: 8, pct: 20, rir: 3, tempo: 'X-2-X-0', restSeconds: 60 },
    ['Поясница прижата — палка неподвижна', 'Выдох на опускании ноги'],
    'Паллоф-удержание → оверхед-присед', 'Дыхание 90/90', 'Core stability'),
  P('pallof_hold', 'Паллоф-удержание 20 с/сторона', ['jerk_lockout', 'snatch_mid'],
    ['drive_forward', 'bar_forward'], ['mobility', 'volume'], 'all', 'stability',
    { sets: 3, reps: 2, pct: 20, rir: 3, tempo: 'X-5-X-0', restSeconds: 60 },
    ['Трос тянет вбок — корпус квадрат', 'Таз под грифом, не уведён'],
    'Антиротация в сплите → классика', 'Dead bug', 'Core anti-rotation'),
  P('clean_shrug', 'Шраги толчковые 110%', ['clean_mid', 'pull_lockout'],
    ['weak_extension'], ['strength'], 'intermediate', 'strength',
    { sets: 4, reps: 4, pct: 105, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['После полного выпрямления — плечи к ушам', 'Руки прямые, не сгибать'],
    'Толчковая тяга → +5%', 'Шраги со штангой', 'QWA pulls'),
  P('hang_clean_knee', 'Взятие с виса от колена', ['clean_mid'],
    ['slow_turnover', 'knee_touch', 'bar_forward'], ['technique'], 'novice', 'technique',
    { sets: 5, reps: 3, pct: 60, rir: 3, tempo: 'X-0-X-0', restSeconds: 90 },
    ['Скучный тазом — гриф скользит по бёдрам', 'Локти — выстрел вверх и вокруг'],
    'Hang с бедра → классика', 'Tall clean', 'QWA scoop ±5 см'),
  P('snatch_deadlift', 'Рывковая становая до колен 105%', ['snatch_off_floor'],
    ['hips_rise', 'early_pull'], ['strength'], 'advanced', 'strength',
    { sets: 4, reps: 4, pct: 100, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Спина — один угол до колен, ноги жмут', 'Гриф на голенях, не вокруг'],
    'Дефицит → классика легче', 'RDL рывковым хватом', 'QWA start'),
  P('hip_snatch', 'Рывок от бедра (без замаха)', ['snatch_mid'],
    ['bar_forward', 'weak_extension'], ['technique'], 'intermediate', 'technique',
    { sets: 4, reps: 3, pct: 65, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    ['Старт с бедра — только вертикальный финиш', 'Локти вверх сразу'],
    'High-hang → классика', 'Dip-рывок', 'Torokhtiy contact'),
  P('clean_segment', 'Сегментное взятие (пол–колено–взрыв)', ['clean_off_floor'],
    ['early_pull', 'bar_forward'], ['technique'], 'intermediate', 'technique',
    { sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-1-X-0', restSeconds: 120 },
    ['Каждый сегмент — стоп 1 с', 'Колени под грифом после срыва'],
    'Тяга с паузой → классика', 'Lift-off взятия', 'Everett segment'),
  P('push_jerk_pause', 'Швунг толчковый с паузой в полуседе', ['jerk_drive'],
    ['pressout', 'split_short'], ['technique'], 'intermediate', 'technique',
    { sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-2-X-0', restSeconds: 120 },
    ['Пауза в полуседе — затем резкий панч вниз', 'Голова под гриф'],
    'Split jerk → классика', 'Tall jerk', 'QWA; Big Bend'),
  P('front_rack_hold', 'Удержание фронта 8 с 110%', ['clean_catch'],
    ['chest_collapse', 'soft_catch'], ['strength', 'mobility'], 'intermediate', 'strength',
    { sets: 3, reps: 1, pct: 90, rir: 3, tempo: 'X-5-X-0', restSeconds: 120 },
    ['Локти выше — грудь вверх 8 секунд', 'Гриф на плечах, не на запястьях'],
    'Фронт-присед с паузой → +5%', 'Гоблет-присед', 'Torokhtiy rack'),
  // ── ROUND-9: добивка тонких фаз (подъём/провал/замок/разножка) ──
  P('power_clean', 'Взятие в стойку без подседа (power clean)', ['clean_off_floor', 'clean_mid'],
    ['early_pull', 'bar_forward', 'weak_extension'], ['technique', 'strength'], 'intermediate', 'strength',
    { sets: 4, reps: 3, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Разгон до колена — терпи', 'Взрыв выше колена, лови в стойке', 'Локти не раньше разгона'],
    'С дефицита 3 см → power с виса', 'Взятие с паузой у пола', 'Everett; QWA'),
  P('hang_clean', 'Взятие с виса (выше колена)', ['clean_off_floor', 'clean_mid'],
    ['early_pull', 'slow_turnover'], ['technique'], 'novice', 'technique',
    { sets: 3, reps: 3, pct: 65, rir: 3, tempo: 'X-1-X-0', restSeconds: 120 },
    ['Вис — старт без отрыва от пола', 'Колени под гриф, спина угол держит'],
    'Вис выше колена → классика', 'Тяга взятийная медленно', 'Everett hang'),
  P('push_press_v2', 'Швунг жировой (push press) на дожим', ['jerk_dip', 'jerk_drive'],
    ['dip_forward', 'slow_dip', 'pressout'], ['strength', 'technique', 'fatigue'], 'novice', 'strength',
    { sets: 4, reps: 5, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Дип строго вертикальный', 'Дожим ногами, не плечами', 'Голова сквозь руки'],
    'Швунг толчком → толчок в разножку', 'Жим стоя без ног', 'Big Bend; QWA'),
  P('squat_split', 'Сплит-присед (опора-разножка)', ['squat_bottom', 'squat_mid'],
    ['split_short', 'chest_collapse'], ['technique', 'mobility'], 'novice', 'technique',
    { sets: 3, reps: 6, pct: 60, rir: 3, tempo: '2-1-X-0', restSeconds: 120 },
    ['Разножка ровная, таз между стоп', 'Грудь вверх, колено над стопой'],
    'Присед с паузой → сплит с паузой', 'Выпады в разножке без веса', 'Everett squat split'),
  P('good_morning_v2', 'Наклоны со штангой (good morning)', ['squat_mid'],
    ['chest_collapse', 'hips_rise'], ['strength'], 'intermediate', 'strength',
    { sets: 3, reps: 6, pct: 55, rir: 2, tempo: '3-1-X-0', restSeconds: 150 },
    ['Спина — один угол', 'Таз назад, колени мягкие', 'Без округления поясницы'],
    '+2.5%/нед → RDL с паузой', 'Гиперэкстензия без веса', 'NSCA posterior chain'),
  P('rack_pull', 'Тяга со стоек (rack pull, выше колена)', ['pull_lockout'],
    ['chest_collapse', 'weak_extension'], ['strength', 'volume'], 'intermediate', 'strength',
    { sets: 4, reps: 4, pct: 90, rir: 2, tempo: 'X-1-X-0', restSeconds: 180 },
    ['Старт со стоек выше колена', 'Довести до полного выпрямления', 'Плечи над грифом'],
    '+5% → становая с пола', 'Тяга с дефицита 3 см', 'NSCA rack pull'),
  P('push_press_jerk', 'Швунг толчковый (дип → выталкивание)', ['jerk_dip', 'jerk_drive'],
    ['dip_forward', 'slow_dip', 'drive_forward'], ['technique', 'strength'], 'intermediate', 'strength',
    { sets: 4, reps: 4, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    ['Дип вертикальный, 8–12 см', 'Выталкивание — ноги, не плечи', 'Локти выстрелом вверх'],
    '+5% → толчок в разножку', 'Швунг жировой 4×5', 'QWA; Big Bend (dip/drive)'),
  P('front_squat_v2', 'Фронтальный присед (вертикальный торс)', ['squat_bottom', 'clean_catch'],
    ['chest_collapse', 'elbows_slow'], ['strength', 'technique'], 'intermediate', 'strength',
    { sets: 4, reps: 4, pct: 75, rir: 2, tempo: '3-1-1-0', restSeconds: 180 },
    ['Локти высоко, гриф на плечах', 'Спина вертикально весь сет', 'Пауза 1с внизу'],
    '+5% при чистом фронте', 'Фронт-присед с паузой 3с', 'NSCA front squat'),
];

/** Индекс фаза → упражнения (производный, стабильный порядок каталога). */
export const CORRECTIVES_BY_PHASE: Record<WLWeakPoint, TACorrectiveExercise[]> = (() => {
  const out = {} as Record<WLWeakPoint, TACorrectiveExercise[]>;
  for (const ex of TA_CORRECTIVES) for (const t of ex.targets) (out[t] ??= []).push(ex);
  return out;
})();

/** Индекс тег ошибки → упражнения. */
export function correctivesByError(tag: TACorrectiveErrorTag): TACorrectiveExercise[] {
  return TA_CORRECTIVES.filter((e) => e.errors.includes(tag));
}

export interface CorrectiveRankOpts {
  cause?: TAWeakCause | null;
  level?: string | null;
  limit?: number;
  /** Ограничения подвижности (ankle/shoulder/hip/lower_back): спросовые упражнения деприоритизируются. */
  mobilityRestrictions?: string[];
  /** E1: оборудование зала (barbell/dumbbell/machine/cable/bodyweight/blocks/band/grip_tool);
   *  пусто = весь каталог (байт-в-байт со старым поведением). */
  equipment?: string[];
  /** E1: чувствительность к усталости (причина fatigue или ACWR danger) — дорогие топятся. */
  fatigueSensitive?: boolean;
  /** E5: фаза сезона (prep/comp); comp — силовые пики топятся, доза −5%. */
  seasonPhase?: 'prep' | 'comp' | null;
}

/**
 * Спрос упражнений на подвижность (паритет ta-correction-rank ANKLE/OVERHEAD-DEMAND):
 * при ограничении сустава такие упражнения не запрещаются (доза и так щадится
 * при mobility-причине), но уходят вниз ранжира — честно, без скрытия выбора.
 */
/** Спрос на подвижность по суставам (тест-шов для spot-lock; семантика — паритет ранжира). */
export const MOBILITY_DEMAND: Record<'ankle' | 'overhead' | 'hip', readonly string[]> = {
  ankle: [
    'deficit_snatch', 'deficit_clean', 'deficit_pull',
    'pause_snatch', 'pause_clean', 'pause_pull', 'pause_jerk', 'pause_squat',
    'front_squat', 'front_squat_clean_grip', 'overhead_squat_v2', 'tempo_squat',
    'back_squat', 'hack_squat', 'tall_snatch', 'tall_clean', 'drop_snatch',
    'snatch_balance', 'jerk_dip', 'double_pause_jerk',
    'snatch_deadlift', 'push_jerk_pause',
  ],
  overhead: [
    'overhead_squat_v2', 'snatch_balance', 'behind_neck_jerk', 'push_press', 'push_jerk',
    'muscle_snatch', 'jerk_recovery', 'tall_snatch', 'tall_jerk', 'drop_snatch',
    'power_snatch', 'sots_press', 'overhead_hold', 'split_jerk',
    // Д1: новые оверхед-фиксации — тот же спрос, иначе плечо их не топит
    'oh_lunge', 'heaving_balance', 'snatch_push_press', 'jerk_support',
  ],
  hip: ['deficit_snatch', 'deficit_clean', 'deficit_pull', 'deadlift', 'snatch_deadlift'],
};

function mobilityPenalty(id: string, mob: Set<string>): number {
  let p = 0;
  if (mob.has('ankle') && (MOBILITY_DEMAND.ankle as readonly string[]).includes(id)) p -= 15;
  if (mob.has('shoulder') && (MOBILITY_DEMAND.overhead as readonly string[]).includes(id)) p -= 15;
  if ((mob.has('hip') || mob.has('lower_back')) && (MOBILITY_DEMAND.hip as readonly string[]).includes(id)) p -= 10;
  return p;
}

/**
 * E1: мета оборудования/цены усталости (паритет ta-correction-rank: fatigueCost + equipment).
 * Отдельная таблица (не поля записей) — 47 существующих P()-строк не тронуты.
 * needsBlocks: нужны стойки/плинты (штраф −12 без 'blocks', не исключение — честно);
 * nonBarbell: не штанга (гантель/свой вес — не лезет в штанговую инъекцию как штанга).
 */
export interface CorrectiveMeta {
  equipment: string;
  fatigueCost: number;
  needsBlocks?: boolean;
  nonBarbell?: boolean;
}

const CORRECTIVE_META: Record<string, CorrectiveMeta> = {
  deficit_snatch: { equipment: 'barbell', fatigueCost: 7 },
  pause_snatch: { equipment: 'barbell', fatigueCost: 7 },
  segment_snatch: { equipment: 'barbell', fatigueCost: 6 },
  slow_pull_snatch: { equipment: 'barbell', fatigueCost: 5 },
  snatch_liftoff: { equipment: 'barbell', fatigueCost: 5 },
  snatch_pull: { equipment: 'barbell', fatigueCost: 8 },
  snatch_high_pull: { equipment: 'barbell', fatigueCost: 6 },
  block_snatch: { equipment: 'barbell', fatigueCost: 6, needsBlocks: true },
  high_hang_snatch: { equipment: 'barbell', fatigueCost: 5 },
  tall_snatch: { equipment: 'barbell', fatigueCost: 4 },
  muscle_snatch: { equipment: 'barbell', fatigueCost: 5 },
  power_snatch: { equipment: 'barbell', fatigueCost: 6 },
  drop_snatch: { equipment: 'barbell', fatigueCost: 4 },
  snatch_balance: { equipment: 'barbell', fatigueCost: 6 },
  overhead_squat_v2: { equipment: 'barbell', fatigueCost: 6 },
  sots_press: { equipment: 'barbell', fatigueCost: 5 },
  overhead_hold: { equipment: 'barbell', fatigueCost: 3 },
  nofeet_snatch: { equipment: 'barbell', fatigueCost: 5 },
  dip_snatch: { equipment: 'barbell', fatigueCost: 5 },
  deficit_clean: { equipment: 'barbell', fatigueCost: 7 },
  pause_clean: { equipment: 'barbell', fatigueCost: 7 },
  block_clean: { equipment: 'barbell', fatigueCost: 6, needsBlocks: true },
  high_hang_clean: { equipment: 'barbell', fatigueCost: 5 },
  tall_clean: { equipment: 'barbell', fatigueCost: 4 },
  muscle_clean: { equipment: 'barbell', fatigueCost: 5 },
  clean_pull: { equipment: 'barbell', fatigueCost: 8 },
  front_squat: { equipment: 'barbell', fatigueCost: 7 },
  front_squat_clean_grip: { equipment: 'barbell', fatigueCost: 6 },
  jerk_dip: { equipment: 'barbell', fatigueCost: 5 },
  double_pause_jerk: { equipment: 'barbell', fatigueCost: 6 },
  pause_jerk: { equipment: 'barbell', fatigueCost: 6 },
  jerk_balance: { equipment: 'barbell', fatigueCost: 5 },
  behind_neck_jerk: { equipment: 'barbell', fatigueCost: 7 },
  tall_jerk: { equipment: 'barbell', fatigueCost: 4 },
  push_press: { equipment: 'barbell', fatigueCost: 6 },
  push_jerk: { equipment: 'barbell', fatigueCost: 6 },
  split_jerk: { equipment: 'barbell', fatigueCost: 6 },
  jerk_recovery: { equipment: 'barbell', fatigueCost: 5 },
  pause_squat: { equipment: 'barbell', fatigueCost: 7 },
  back_squat: { equipment: 'barbell', fatigueCost: 8 },
  hack_squat: { equipment: 'machine', fatigueCost: 6 },
  tempo_squat: { equipment: 'barbell', fatigueCost: 6 },
  deficit_pull: { equipment: 'barbell', fatigueCost: 8 },
  deadlift: { equipment: 'barbell', fatigueCost: 8 },
  pause_pull: { equipment: 'barbell', fatigueCost: 7 },
  rdl: { equipment: 'barbell', fatigueCost: 5 },
  pin_press: { equipment: 'barbell', fatigueCost: 6 },
  ohp: { equipment: 'barbell', fatigueCost: 5 },
  // E4: новые (гантель/свой вес помечены честно для E1-фильтра)
  jerk_split_measure: { equipment: 'bodyweight', fatigueCost: 2 },
  oh_lunge: { equipment: 'barbell', fatigueCost: 5 },
  split_pause: { equipment: 'barbell', fatigueCost: 5 },
  pin_press_high: { equipment: 'barbell', fatigueCost: 6 },
  z_press: { equipment: 'barbell', fatigueCost: 5 },
  single_arm_press: { equipment: 'dumbbell', fatigueCost: 4, nonBarbell: true },
  klokov_press: { equipment: 'barbell', fatigueCost: 6 },
  heaving_balance: { equipment: 'barbell', fatigueCost: 5 },
  snatch_push_press: { equipment: 'barbell', fatigueCost: 6 },
  jerk_support: { equipment: 'barbell', fatigueCost: 4 },
  tspine_ext: { equipment: 'bodyweight', fatigueCost: 2, nonBarbell: true },
  dead_bug_oh: { equipment: 'bodyweight', fatigueCost: 2, nonBarbell: true },
  pallof_hold: { equipment: 'bodyweight', fatigueCost: 2, nonBarbell: true },
  clean_shrug: { equipment: 'barbell', fatigueCost: 6 },
  hang_clean_knee: { equipment: 'barbell', fatigueCost: 5 },
  snatch_deadlift: { equipment: 'barbell', fatigueCost: 7 },
  hip_snatch: { equipment: 'barbell', fatigueCost: 5 },
  clean_segment: { equipment: 'barbell', fatigueCost: 6 },
  push_jerk_pause: { equipment: 'barbell', fatigueCost: 5 },
  front_rack_hold: { equipment: 'barbell', fatigueCost: 4 },
  power_clean: { equipment: 'barbell', fatigueCost: 7 },
  hang_clean: { equipment: 'barbell', fatigueCost: 6 },
  push_press_v2: { equipment: 'barbell', fatigueCost: 5 },
  squat_split: { equipment: 'barbell', fatigueCost: 4 },
  good_morning_v2: { equipment: 'barbell', fatigueCost: 5 },
  rack_pull: { equipment: 'barbell', fatigueCost: 7 },
  push_press_jerk: { equipment: 'barbell', fatigueCost: 6 },
  front_squat_v2: { equipment: 'barbell', fatigueCost: 8 },
};

/** Мета упражнения (дефолт barbell/6 — как у ранжира при отсутствии каталога). */
export function correctiveMetaOf(id: string): CorrectiveMeta {
  try {
    return CORRECTIVE_META[String(id || '').toLowerCase()] || { equipment: 'barbell', fatigueCost: 6 };
  } catch { return { equipment: 'barbell', fatigueCost: 6 }; }
}

/**
 * E5: «как НЕ делать» (Everett: плохо выполненное упражнение закрепляет ошибку).
 * 1 строка на ключевое упражнение; отсутствие = общий принцип «легче, но правильно».
 */
const CORRECTIVE_HOW_NOT: Record<string, string> = {
  tall_snatch: 'Не сгибать колени на старте — иначе это dip-рывок, а не tall',
  muscle_snatch: 'Не ронять локти вниз в финале — иначе жим широким, а не протяж',
  nofeet_snatch: 'Не отрывать стопы — иначе теряется смысл вертикального драйва',
  segment_snatch: 'Не проскакивать сегменты без стопа — иначе обычная тяга',
  slow_pull_snatch: 'Не взрывать до колена — иначе чинишь не то',
  snatch_balance: 'Не ловить мягко — приём активный, руки пробивают',
  drop_snatch: 'Не дожимать ногами вверх — только скорость вниз',
  jerk_dip: 'Не на носках и не глубоко — вся стопа, 8–12 см, резкий стоп',
  split_jerk: 'Не короткие ножницы — таз под грифом, база мелом',
  tall_jerk: 'Не толкать ногами слабо — панч сильнее драйва',
  pause_snatch: 'Не качать на паузе — замри, затем взрыв',
  snatch_pull: 'Не опрокидываться назад — финиш вертикально',
  deficit_snatch: 'Не круглить спину на дефиците — угол держит всё',
  overhead_squat_v2: 'Не вставать раньше стабилизации — сначала уверенность внизу',
  front_squat: 'Не ронять локти — иначе штанга на запястьях',
  power_snatch: 'Не ловить жёстко сверху — встречай напряжением в полуседе',
  clean_segment: 'Не тянуть руками на сегментах — ноги и паузы',
  hip_snatch: 'Не замахиваться с пола — старт строго с бедра',
  jerk_split_measure: 'Не шагать наугад — сначала мел, потом вес',
  // П5: покрытие 67/67 — по строке на каждое упражнение библиотеки
  snatch_liftoff: 'Не гнуть руки на отрыве — только ноги и спина под одним углом',
  snatch_high_pull: 'Не дожимать кистями вверх — локти ведут, гриф близко',
  block_snatch: 'Не тянуть снизу с блоков — только взрыв из старта',
  high_hang_snatch: 'Не прыгать вперёд из виса — вертикально вверх и вниз',
  muscle_clean: 'Не ловить на запястья — дотяни и встреть на плечах',
  high_hang_clean: 'Не встречать грудью вниз — локти выстрелом вверх',
  tall_clean: 'Не подседать перед стартом — стой прямо, затем вниз',
  deficit_clean: 'Не поднимать таз раньше груди — ноги жмут вместе',
  pause_clean: 'Не терять скучный на паузе — таз под грифом',
  block_clean: 'Не раскачиваться на блоках — мёртвый старт, резкий взрыв',
  clean_pull: 'Не шраги вместо ног — сначала выпрямление, шраги после',
  front_squat_clean_grip: 'Не давать грифу скатиться — хват как во взятии',
  double_pause_jerk: 'Не проваливать паузы — dip и ножницы держат форму',
  pause_jerk: 'Не использовать паузу как отдых — мёртвая точка, затем взрыв',
  jerk_balance: 'Не шагать разной длины — поровну вперёд/назад, таз под грифом',
  behind_neck_jerk: 'Не выводить гриф вперёд — уже за головой, только вверх',
  push_press: 'Не садиться глубоко — мелкий dip, резкий драйв',
  push_jerk: 'Не оставаться высоко — полусед ловит ниже',
  jerk_recovery: 'Не делать длинные шаги — гриф стоит, ноги короткие',
  pause_squat: 'Не расслабляться на паузе — натяжение всё время',
  back_squat: 'Не сводить колени — по носкам, грудь вверх',
  hack_squat: 'Не отрывать спину от спинки — таз и спина прижаты',
  tempo_squat: 'Не падать вниз — 3 секунды это контроль, а не падение',
  deficit_pull: 'Не рвать с пола — длинный старт требует жёсткой спины',
  deadlift: 'Не тянуть спиной — ногами в пол, угол до колен',
  pause_pull: 'Не обводить колени — гриф скользит по бёдрам',
  rdl: 'Не круглить низ — таз назад, гриф по бёдрам, 3 с вниз',
  pin_press: 'Не отбивать с упоров — мёртвая точка, чистый старт',
  ohp: 'Не переразгибать поясницу — рёбра вниз, ягодицы в тонусе',
  oh_lunge: 'Не качать гриф при шаге — над головой неподвижно',
  split_pause: 'Не выезжать из ножниц — пауза держит базу',
  pin_press_high: 'Не пружинить на упорах — без инерции, жёсткий верх',
  z_press: 'Не откидываться назад — корпус вертикально, ноги мёртвые',
  single_arm_press: 'Не крениться вбок — корпус квадрат, дожим строго вверх',
  klokov_press: 'Не выводить вперёд — за головой, лопатки вместе',
  heaving_balance: 'Не падать под гриф — ноги дожимают, руки пробивают',
  snatch_push_press: 'Не жать медленно — dip и драйв резкие',
  jerk_support: 'Не ходить с грифом — стойка неподвижна 5 секунд',
  tspine_ext: 'Не гнуть поясницу — работает только грудной отдел',
  dead_bug_oh: 'Не отрывать поясницу — прижата, палка стоит',
  pallof_hold: 'Не разворачиваться за тросом — квадрат 20 секунд',
  clean_shrug: 'Не сгибать руки на шрагах — прямые, плечи к ушам',
  hang_clean_knee: 'Не стучать по бёдрам — скучный, гриф скользит',
  snatch_deadlift: 'Не вставать раньше времени — до колен один угол',
  push_jerk_pause: 'Не сидеть в полуседе — пауза, затем панч вниз',
  front_rack_hold: 'Не висеть на запястьях — гриф на плечах, локти выше',
  overhead_hold: 'Не гулять грифом — лопатки вместе, рёбра вниз, 8 секунд камень',
  sots_press: 'Не заваливаться вперёд из седа — корпус вертикально, строго вверх',
  dip_snatch: 'Не бить бёдрами — плечи над грифом, толкай ногами вертикально',
  // ROUND-9: новые записи библиотеки
  power_clean: 'Не ловить глубоко — это power: финал выше параллели',
  hang_clean: 'Не расслаблять спину в виса — тот же угол, что с пола',
  push_press_v2: 'Не проваливать дип вперёд — вертикально, дожим ногами',
  squat_split: 'Не ставить стопы в одну линию — база шире плеч',
  good_morning_v2: 'Не округлять поясницу — таз назад, спина одним углом',
  rack_pull: 'Не рвать со стоек — мёртвый старт, полное выпрямление',
  push_press_jerk: 'Не заваливать дип вперёд — вертикально, выталкивание ногами',
  front_squat_v2: 'Не ронять локти — гриф скатится на запястья',
};

/** Строка «как НЕ делать» (null — нет специфики, действует общий принцип). */
export function correctiveHowNot(id: string): string | null {
  try {
    return CORRECTIVE_HOW_NOT[String(id || '').toLowerCase()] || null;
  } catch { return null; }
}

/**
 * E5: якорь дозы в кг (оценка рабочего веса через токен движения × pct;
 * токен-карта — паритет estimateCorrBasePm симулятора, без импорта — без цикла).
 */
export function estimateCorrectiveKg(
  corrId: string, pct: number, wm: { snatch?: number; cleanJerk?: number; clean?: number; backSquat?: number; deadlift?: number } | null | undefined,
): number | null {
  try {
    if (!wm) return null;
    const low = String(corrId || '').toLowerCase();
    let base = 0;
    if (low.includes('snatch')) base = wm.snatch || 60;
    else if (low.includes('clean') || low.includes('jerk') || low.includes('press')) base = (wm as any).cleanJerk || wm.clean || 80;
    else if (low.includes('squat') || low.includes('overhead')) base = wm.backSquat || 100;
    else if (low.includes('pull') || low.includes('deficit') || low.includes('deadlift') || low.includes('rdl')) base = wm.deadlift || 120;
    else base = wm.backSquat || 80;
    const p = Number(pct);
    if (!Number.isFinite(p) || p <= 0) return null;
    return Math.round(((base * p) / 100) / 2.5) * 2.5;
  } catch { return null; }
}

/** E5: лесенка регрессии шагами (разбивка строки по '→'; всегда ≥1 шаг). */
export function regressionSteps(id: string): string[] {
  try {
    const ex = TA_CORRECTIVES.find((e) => e.id.toLowerCase() === String(id || '').toLowerCase());
    const raw = ex?.regression || '';
    return raw.split('→').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

/**
 * П2: фаза сезона из даты старта (единственный честный источник в плане):
 * старт через 0–21 день → 'comp' (пик/подводка: только техника+праймеры),
 * иначе null (обычная подготовка, доза без сезонной скидки).
 */
export function seasonPhaseForCompetition(compDateISO: string | null | undefined, nowISO?: string): 'comp' | null {
  try {
    if (!compDateISO) return null;
    const comp = new Date(String(compDateISO)).getTime();
    const now = nowISO ? new Date(nowISO).getTime() : Date.now();
    if (!Number.isFinite(comp) || !Number.isFinite(now)) return null;
    const days = Math.round((comp - now) / 86400000);
    return days >= 0 && days <= 21 ? 'comp' : null;
  } catch { return null; }
}

/** Доза под причину-лимитер (паритет с ta-correction-rank: volume 4×5, strength 4×4+5%, mobility/fatigue −5%). */
export function adjustProtocolForCause(
  base: TACorrectiveProtocol, cause?: TAWeakCause | null, seasonPhase?: 'prep' | 'comp' | null,
): TACorrectiveProtocol {
  let out: TACorrectiveProtocol;
  if (cause === 'volume') out = { ...base, sets: 4, reps: 5 };
  else if (cause === 'strength') out = { ...base, sets: 4, reps: 4, pct: Math.min(110, base.pct + 5) };
  else if (cause === 'mobility' || cause === 'fatigue') out = { ...base, pct: Math.max(40, base.pct - 5), rir: Math.max(base.rir, 2) };
  else out = { ...base };
  // E5: comp-фаза — силовые пики щадятся (−5% поверх причины, пол 40%).
  if (seasonPhase === 'comp') out = { ...out, pct: Math.max(40, out.pct - 5) };
  return out;
}

function levelRank(level: TACorrectiveLevel): number {
  if (level === 'all') return 0;
  if (level === 'novice') return 1;
  if (level === 'intermediate') return 2;
  return 3;
}

/**
 * Коррективы фазы, отранжированные под причину и уровень (дешёвый скоринг, честный):
 *  +20 совпадение причины, +10 техника-фазе при technique, −15 уровень выше атлета,
 *  −15/−10 спрос на ограниченный сустав (паритет ta-correction-rank).
 */
export function correctivesForWeakPoint(wp: WLWeakPoint, opts: CorrectiveRankOpts = {}): TACorrectivePick[] {
  const list = CORRECTIVES_BY_PHASE[wp] || [];
  const cause = opts.cause ?? null;
  const lv = String(opts.level || 'intermediate').toLowerCase();
  const athleteRank = lv.includes('begin') || lv.includes('novice') ? 1 : lv.includes('adv') || lv.includes('enh') || lv.includes('elite') ? 3 : 2;
  const mob = new Set((opts.mobilityRestrictions || []).map((s) => String(s).toLowerCase()));
  const eqFilter = (opts.equipment || []).map((s) => String(s).toLowerCase()).filter(Boolean);
  const fatigueOn = opts.fatigueSensitive || cause === 'fatigue';
  const season = opts.seasonPhase ?? null;
  const scored = list.map((ex) => {
    let score = 50;
    if (cause && (ex.causes as string[]).includes(cause)) { score += 20; }
    if (!cause && ex.phase === 'technique') score += 10;
    if (levelRank(ex.level) > athleteRank) score -= 15;
    if (levelRank(ex.level) <= athleteRank) score += 5;
    score += mobilityPenalty(ex.id, mob);
    // E1: оборудование (паритет ta-correction-rank: mismatch → исключение, bodyweight/universal — всегда).
    const meta = correctiveMetaOf(ex.id);
    if (eqFilter.length > 0) {
      const need = String(meta.equipment || 'barbell').toLowerCase();
      if (need !== 'bodyweight' && need !== 'universal' && !eqFilter.includes(need)) {
        return null;
      }
      if (meta.needsBlocks && !eqFilter.includes('blocks')) score -= 12;
    }
    // E1: цена усталости (fatigue-причина или явная чувствительность).
    if (fatigueOn) {
      if (meta.fatigueCost >= 7) score -= 10;
      else if (meta.fatigueCost <= 5) score += 5;
    }
    // E5: comp-фаза — силовые пики топятся (техника/праймеры первыми).
    if (season === 'comp' && ex.phase === 'strength') score -= 10;
    const protocolAdj = adjustProtocolForCause(ex.protocol, cause, season);
    const matchReason = cause && (ex.causes as string[]).includes(cause)
      ? `причина ${cause} — прямое попадание`
      : ex.phase === 'technique' ? 'база техники фазы' : ex.phase === 'strength' ? 'сила фазы' : 'стабильность приёма';
    return { ...ex, protocolAdj, matchReason, __s: score } as TACorrectivePick & { __s: number };
  }).filter((s): s is TACorrectivePick & { __s: number } => s !== null);
  scored.sort((a, b) => (b as any).__s - (a as any).__s);
  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, scored.length) : Math.min(5, scored.length);
  return scored.slice(0, limit).map((s) => { const { __s: _drop, ...rest } = s as any; return rest as TACorrectivePick; });
}

export interface TACorrectiveSessionStep {
  order: number;
  stage: TACorrectivePhase;
  exerciseId: string;
  nameRu: string;
  protocol: TACorrectiveProtocol;
  cue: string;
  why: string;
}

/**
 * Коррекционная сессия 20–30 мин: сначала техника (скорость/точность),
 * затем сила фазы, в конце стабильность приёма. Порядок фиксирован.
 */
export function correctiveSessionFor(
  weakPoints: WLWeakPoint[], causeByWeak: Record<string, TAWeakCause | null> = {},
  opts: { level?: string | null; mobilityRestrictions?: string[]; equipment?: string[]; fatigueSensitive?: boolean; seasonPhase?: 'prep' | 'comp' | null } = {},
): TACorrectiveSessionStep[] {
  const uniq = [...new Set(weakPoints)].slice(0, 3);
  const picks: Array<{ ex: TACorrectivePick; wp: WLWeakPoint }> = [];
  for (const wp of uniq) {
    const cause = causeByWeak[wp] ?? null;
    const list = correctivesForWeakPoint(wp, { cause, level: opts.level ?? null, mobilityRestrictions: opts.mobilityRestrictions, equipment: opts.equipment, fatigueSensitive: opts.fatigueSensitive, seasonPhase: opts.seasonPhase ?? null, limit: 3 });
    // 1 техника + 1 сила/стабильность на фазу (не дублируем id внутри сессии)
    const tech = list.find((c) => c.phase === 'technique') || list[0];
    const second = list.find((c) => c.id !== tech?.id && c.phase !== 'technique') || list[1];
    if (tech) picks.push({ ex: tech, wp });
    if (second) picks.push({ ex: second, wp });
  }
  const stageOrder: Record<TACorrectivePhase, number> = { technique: 0, strength: 1, stability: 2 };
  picks.sort((a, b) => stageOrder[a.ex.phase] - stageOrder[b.ex.phase]);
  const seen = new Set<string>();
  const steps: TACorrectiveSessionStep[] = [];
  for (const p of picks) {
    if (seen.has(p.ex.id)) continue;
    seen.add(p.ex.id);
    steps.push({
      order: steps.length + 1, stage: p.ex.phase, exerciseId: p.ex.id, nameRu: p.ex.nameRu,
      protocol: p.ex.protocolAdj, cue: p.ex.cues[0] || '', why: `${p.wp}: ${p.ex.matchReason}`,
    });
    if (steps.length >= 6) break;
  }
  return steps;
}

export interface TACorrectiveWeek {
  week: number;
  focus: string;
  items: Array<{ exerciseId: string; sets: number; reps: number; pct: number }>;
}

/** RU-подписи тегов ошибок (единый словарь хаба: замер → слова). */
export const TA_ERROR_TAG_RU: Record<TACorrectiveErrorTag, string> = {
  early_pull: 'Ранняя тяга',
  hips_rise: 'Таз стреляет вверх',
  bar_forward: 'Гриф уходит вперёд (дуга)',
  jump_forward: 'Прыжок вперёд',
  weak_extension: 'Слабый финал (нет выпрямления)',
  slow_turnover: 'Медленный уход под штангу',
  high_catch: 'Высокий приём',
  soft_catch: 'Мягкий/неуверенный приём',
  pressout: 'Дожим (press-out)',
  bar_crash: 'Штанга падает на атлета',
  unstable_overhead: 'Нестабильный оверхед',
  early_arm_bend: 'Ранний сгиб рук',
  dip_forward: 'Подсед вперёд',
  dip_deep: 'Слишком глубокий dip',
  slow_dip: 'Медленный dip',
  drive_forward: 'Драйв вперёд, не вверх',
  split_short: 'Короткие ножницы',
  split_asym: 'Асимметричные ножницы',
  elbows_slow: 'Медленные локти',
  chest_collapse: 'Грудь складывается',
  feet_error: 'Ошибка стоп',
  knee_touch: 'Касание коленей грифом',
};

/** Поиск записи библиотеки по id (для экспорта/моста; null если нет). */
export function correctiveById(id: string): TACorrectiveExercise | null {
  try {
    const low = String(id || '').toLowerCase();
    return TA_CORRECTIVES.find((e) => e.id.toLowerCase() === low) || null;
  } catch { return null; }
}

export type BarSeverity = 'warn' | 'critical';

export interface BarTagsResult {
  tags: TACorrectiveErrorTag[];
  text: string | null;
  /** E2: тяжесть отклонения (warn 4–6 см / critical >6 см). */
  severity?: BarSeverity | null;
}

/**
 * Замер → теги ошибок (пороги SRD хаба: turnover >4 см, catch >6 см).
 * Пусто/норма (≤4) — молчит (не диагноз по шуму).
 * E2: тиры тяжести — 4–6 warn (только bar_forward/drive_forward),
 * >6 critical (+bar_crash/split_short), >10 — ещё и нестабильность приёма.
 * Д4: extra.vMaxMs < 1.3 м/с (Wood 2026 — все absolute >1.3) → +weak_extension.
 */
export function tagsForBarMetrics(xLoopCm: number | null | undefined, lift: string, extra?: { vMaxMs?: number | null }): BarTagsResult {
  const x = typeof xLoopCm === 'number' ? xLoopCm : NaN;
  if (!Number.isFinite(x) || x <= 4) return { tags: [], text: null, severity: null };
  const severity: BarSeverity = x > 6 ? 'critical' : 'warn';
  const isJerk = String(lift || '').toLowerCase().includes('jerk');
  let text: string;
  let tags: TACorrectiveErrorTag[];
  if (isJerk) {
    tags = x > 6 ? ['drive_forward', 'split_short'] : ['drive_forward'];
    text = `Горизонталь ${x} см — драйв уходит вперёд`;
  } else {
    tags = x > 6 ? ['bar_forward', 'bar_crash'] : ['bar_forward'];
    text = `Петля ${x} см (>SRD) — гриф уходит вперёд`;
  }
  if (x > 10) tags.push('unstable_overhead');
  try {
    const v = typeof extra?.vMaxMs === 'number' ? extra.vMaxMs : NaN;
    if (Number.isFinite(v) && (v as number) < 1.3 && !tags.includes('weak_extension')) {
      tags.push('weak_extension');
      text += ` · пик ${v} м/с <1.3 — слабый финал`;
    }
  } catch { /* noop */ }
  return { tags, text, severity };
}

/**
 * E2: VBT-просадка → теги (пороги ТА 10/20 из ta-weak-cause):
 * ≥20% critical (медленный уход + слабый финал), 10–20% warn (медленный уход).
 */
export function tagsForVelocityLoss(lossPct: number | null | undefined, lift?: string): BarTagsResult {
  const x = typeof lossPct === 'number' ? lossPct : NaN;
  if (!Number.isFinite(x) || x < 10) return { tags: [], text: null, severity: null };
  const isJerk = String(lift || '').toLowerCase().includes('jerk');
  if (x >= 20) {
    const tags: TACorrectiveErrorTag[] = isJerk ? ['slow_turnover', 'drive_forward'] : ['slow_turnover', 'weak_extension'];
    return { tags, text: `VBT −${x}% — скорость упала критично`, severity: 'critical' };
  }
  return { tags: ['slow_turnover'], text: `VBT −${x}% — уход замедляется`, severity: 'warn' };
}

/**
 * E2: мобильность → теги. OHS-провалы ≥2 на чувствительной фазе или
 * knee-to-wall <9 см (отрыв/тяга) дают точечные теги вместо общего «мобильность».
 */
export function tagsForMobility(
  ohsFailed: number | null | undefined, kneeToWallCm: number | null | undefined, lift: string,
): BarTagsResult {
  const l = String(lift || '').toLowerCase();
  const ohs = typeof ohsFailed === 'number' ? ohsFailed : 0;
  const ktw = typeof kneeToWallCm === 'number' ? kneeToWallCm : NaN;
  const isOverhead = /snatch|clean.*catch|overhead|catch/.test(l);
  const isDip = /jerk|dip/.test(l);
  const isPull = /pull|floor|deadlift|start|snatch|clean/.test(l);
  if (ohs >= 2 && (isOverhead || isDip)) {
    const tags: TACorrectiveErrorTag[] = isDip ? ['dip_forward', 'soft_catch'] : ['soft_catch', 'unstable_overhead'];
    return { tags, text: `OHS ${ohs}/6 — приём/подсед нестабильны`, severity: ohs >= 4 ? 'critical' : 'warn' };
  }
  if (Number.isFinite(ktw) && ktw < 9 && isPull) {
    return { tags: ['hips_rise', 'early_pull'], text: `Knee-to-wall ${ktw} см — голеностоп тянет таз вверх`, severity: 'warn' };
  }
  return { tags: [], text: null, severity: null };
}

/**
 * E2: порядок коррекции (Everett first-and-worst: самое раннее и грубое — первым).
 * Ранг фазы: отрыв 0 → середина 1 → уход 2 → приём 3 → оверхед/замок 4 → база 5.
 * severityByWeak: 0–3 (0 — нет данных; critical/bar_crash/VBT≥20 — 3).
 */
export const WEAK_PHASE_ORDER: Record<string, number> = {
  snatch_off_floor: 0, clean_off_floor: 0, pull_start: 0,
  snatch_mid: 1, clean_mid: 1,
  snatch_pull_under: 2,
  snatch_catch: 3, clean_catch: 3, jerk_dip: 3, squat_bottom: 3,
  snatch_overhead: 4, jerk_drive: 4, jerk_lockout: 4,
  squat_mid: 5, pull_lockout: 5, press_start: 5,
};

export function correctionOrderFor(
  weakPoints: WLWeakPoint[], severityByWeak: Record<string, number> = {},
): WLWeakPoint[] {
  const uniq = [...new Set(weakPoints)];
  return uniq.sort((a, b) => {
    const oa = WEAK_PHASE_ORDER[a] ?? 9;
    const ob = WEAK_PHASE_ORDER[b] ?? 9;
    if (oa !== ob) return oa - ob;
    const sa = severityByWeak[a] ?? 0;
    const sb = severityByWeak[b] ?? 0;
    return sb - sa;
  });
}

/**
 * Доза предпочитаемой коррекции (C8: доза вставки = доза карточки).
 * Возвращает protocolAdj библиотечного пика или null (тогда — доза ранжира).
 */
export function protocolForPreferred(
  wp: WLWeakPoint, prefId: string | null | undefined,
  cause?: TAWeakCause | null, level?: string | null, mobilityRestrictions?: string[],
  extra?: { equipment?: string[]; fatigueSensitive?: boolean; seasonPhase?: 'prep' | 'comp' | null },
): TACorrectiveProtocol | null {
  try {
    if (!prefId) return null;
    const pick = correctivesForWeakPoint(wp, { cause: cause ?? null, level: level ?? null, mobilityRestrictions, equipment: extra?.equipment, fatigueSensitive: extra?.fatigueSensitive, seasonPhase: extra?.seasonPhase ?? null, limit: 5 })
      .find((c) => c.id === prefId);
    return pick ? { ...pick.protocolAdj } : null;
  } catch { return null; }
}

/** Обогащённые строки экспорта фазы: имя + доза + кью + источник. */
export function correctiveExportLines(
  wp: WLWeakPoint, cause?: TAWeakCause | null, level?: string | null, mobilityRestrictions?: string[],
  extra?: { equipment?: string[]; fatigueSensitive?: boolean; seasonPhase?: 'prep' | 'comp' | null },
): string[] {
  try {
    return correctivesForWeakPoint(wp, { cause: cause ?? null, level: level ?? null, mobilityRestrictions, equipment: extra?.equipment, fatigueSensitive: extra?.fatigueSensitive, seasonPhase: extra?.seasonPhase ?? null, limit: 3 })
      .map((c) => `${c.nameRu} — ${c.protocolAdj.sets}×${c.protocolAdj.reps} @${c.protocolAdj.pct}% · ${c.cues[0] || ''} · ${c.source}`);
  } catch { return []; }
}

/** Волна corrective-блока 4–8 нед (паритет ta-spec-block: 3,3,4,4,4,4,3,3). */
export function correctiveBlockFor(
  weakPoints: WLWeakPoint[], weeks = 6,
  opts: { causeByWeak?: Record<string, TAWeakCause | null>; level?: string | null; mobilityRestrictions?: string[]; equipment?: string[]; fatigueSensitive?: boolean; seasonPhase?: 'prep' | 'comp' | null } = {},
): TACorrectiveWeek[] {
  const uniq = [...new Set(weakPoints)].slice(0, 3) as WLWeakPoint[];
  const total = Math.max(4, Math.min(8, Math.round(weeks) || 6));
  const setsFor = (wi: number) => (wi <= 1 ? 3 : wi <= 5 ? 4 : 3);
  const focusFor = (wi: number) => wi <= 1 ? 'Техника — чистота фазы' : wi <= 3 ? 'Объём — накопление' : wi <= 5 ? 'Интенсивность — перенос' : 'Подводка — свежесть';
  const out: TACorrectiveWeek[] = [];
  for (let wi = 0; wi < total; wi++) {
    const sets = setsFor(wi);
    const items = uniq.flatMap((wp) => {
      const list = correctivesForWeakPoint(wp, {
        cause: opts.causeByWeak?.[wp] ?? null,
        level: opts.level ?? null,
        mobilityRestrictions: opts.mobilityRestrictions,
        equipment: opts.equipment,
        fatigueSensitive: opts.fatigueSensitive,
        seasonPhase: opts.seasonPhase ?? null,
        limit: 2,
      });
      // C12: pct — от скорректированного протокола (причина уже учтена),
      // как в карточке/сессии/экспорте/вставке; волна даёт только +5% к пику.
      return list.map((c) => ({ exerciseId: c.id, sets, reps: wi <= 1 ? 5 : wi <= 5 ? (c.phase === 'strength' ? 4 : 5) : 3, pct: c.protocolAdj.pct + (wi >= 2 && wi <= 5 ? 5 : 0) }));
    }).slice(0, 6);
    out.push({ week: wi + 1, focus: focusFor(wi), items });
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════
 * E3: КОМПЛЕКСЫ + ПРАЙМЕРЫ (метод Everett: чинить комплексами и разминкой,
 * а не раздуванием объёма; Burgener warm-up + skill transfer).
 * Комплекс = связка «упражнение-носитель + классика» одной строкой плана:
 * в инъекцию идёт injectId (реальный id библиотеки), объём не растёт.
 * ════════════════════════════════════════════════════════════════ */

export interface TACorrectiveComplex {
  id: string;
  nameRu: string;
  /** Связка (читается слева направо: носитель + классика). */
  parts: string[];
  /** Реальный id библиотеки для инъекции/веса. */
  injectId: string;
  targets: WLWeakPoint[];
  errors: TACorrectiveErrorTag[];
  causes: TAWeakCause[];
  level: TACorrectiveLevel;
  protocol: TACorrectiveProtocol;
  cue: string;
  source: string;
}

const CX = (
  id: string, nameRu: string, parts: string[], injectId: string,
  targets: WLWeakPoint[], errors: TACorrectiveErrorTag[], causes: TAWeakCause[],
  level: TACorrectiveLevel, protocol: TACorrectiveProtocol, cue: string, source: string,
): TACorrectiveComplex => ({ id, nameRu, parts, injectId, targets, errors, causes, level, protocol, cue, source });

/** 12 комплексов: носитель чинит кусок, классика переносит (Everett complexes). */
export const TA_CORRECTIVE_COMPLEXES: TACorrectiveComplex[] = [
  CX('cx_snatch_pull_plus_snatch', 'Рывковая тяга + рывок', ['Рывковая тяга 110%', 'Рывок 85%'], 'snatch_pull',
    ['snatch_off_floor', 'snatch_mid'], ['early_pull', 'hips_rise'], ['technique', 'strength'], 'intermediate',
    { sets: 3, reps: 3, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    'Тяга задаёт позицию — рывок её повторяет', 'Everett complexes'),
  CX('cx_halting_deadlift_plus_snatch', 'Halting-тяга + рывок', ['Halting deadlift до колена', 'Рывок'], 'snatch_liftoff',
    ['snatch_off_floor'], ['early_pull', 'bar_forward'], ['technique'], 'intermediate',
    { sets: 3, reps: 3, pct: 75, rir: 2, tempo: 'X-1-X-0', restSeconds: 150 },
    'Пауза у колена — затем тот же старт в рывке', 'Everett halting + lift'),
  CX('cx_segment_snatch_top_down', 'Сегментный рывок сверху вниз', ['С колена', 'С пола + колено', 'Классика'], 'segment_snatch',
    ['snatch_mid'], ['early_pull', 'bar_forward'], ['technique'], 'intermediate',
    { sets: 3, reps: 3, pct: 70, rir: 2, tempo: 'X-1-X-0', restSeconds: 150 },
    'Сверху вниз: позиция чище с каждым шагом', 'Everett segment'),
  CX('cx_highpull_plus_snatch', 'High-pull + рывок', ['Рывковый high-pull', 'Рывок'], 'snatch_high_pull',
    ['snatch_mid', 'snatch_pull_under'], ['bar_forward', 'slow_turnover'], ['technique'], 'intermediate',
    { sets: 3, reps: 3, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    'High-pull учит близости — рывок её держит', 'Everett high-pull'),
  CX('cx_power_snatch_plus_ohs', 'Power-рывок + оверхед-присед', ['Power-рывок', 'Оверхед-присед 3 с'], 'power_snatch',
    ['snatch_pull_under', 'snatch_catch'], ['high_catch', 'soft_catch'], ['technique'], 'intermediate',
    { sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    'Встретил высоко — сел и встретил низко', 'Torokhtiy turnover'),
  CX('cx_snatch_balance_plus_ohs', 'Баланс + оверхед-присед', ['Рывковый баланс', 'Оверхед-присед с паузой'], 'snatch_balance',
    ['snatch_catch', 'snatch_overhead'], ['soft_catch', 'unstable_overhead'], ['technique', 'mobility'], 'intermediate',
    { sets: 3, reps: 3, pct: 60, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 },
    'Резко вниз — затем уверенно внизу', 'Everett; QWA приём'),
  CX('cx_clean_pull_plus_clean', 'Толчковая тяга + взятие', ['Толчковая тяга 105%', 'Взятие'], 'clean_pull',
    ['clean_off_floor', 'clean_mid'], ['early_pull', 'weak_extension'], ['technique', 'strength'], 'intermediate',
    { sets: 3, reps: 3, pct: 80, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    'Тяга строит финиш — взятие его использует', 'QWA pulls'),
  CX('cx_power_clean_plus_front_squat', 'Power-взятие + фронт-присед', ['Power-взятие', 'Фронт-присед'], 'front_squat',
    ['clean_mid', 'clean_catch'], ['slow_turnover', 'soft_catch'], ['technique'], 'intermediate',
    { sets: 3, reps: 4, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    'Быстрые локти — затем глубокий сед', 'Everett complexes'),
  CX('cx_push_press_plus_jerk', 'Швунг-жим + толчок', ['Швунг жимовой', 'Толчок в ножницы'], 'push_press',
    ['jerk_dip', 'jerk_drive'], ['dip_forward', 'pressout'], ['technique'], 'intermediate',
    { sets: 3, reps: 4, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    'Вертикальный драйв — затем те же ноги в ножницы', 'Big Bend; QWA'),
  CX('cx_pause_jerk_plus_split', 'Толчок с паузой + ножницы', ['Dip с паузой 2 с', 'Ножницы с паузой'], 'double_pause_jerk',
    ['jerk_dip', 'jerk_lockout'], ['dip_forward', 'split_short'], ['technique'], 'intermediate',
    { sets: 3, reps: 2, pct: 65, rir: 2, tempo: 'X-2-X-0', restSeconds: 150 },
    'Пауза лечит крен — ножницы его проверяют', 'Big Bend primer'),
  CX('cx_front_squat_plus_jerk', 'Фронт-присед + толчок', ['Фронт-присед 3 с паузой', 'Толчок'], 'front_squat',
    ['clean_catch', 'jerk_dip'], ['chest_collapse', 'dip_forward'], ['strength', 'technique'], 'intermediate',
    { sets: 3, reps: 3, pct: 75, rir: 2, tempo: 'X-0-X-0', restSeconds: 150 },
    'Жёсткий фронт держит dip вертикально', 'QWA drive'),
  CX('cx_rdl_plus_snatch_pull', 'RDL + рывковая тяга', ['Румынская 3 с вниз', 'Рывковая тяга'], 'rdl',
    ['pull_start', 'pull_lockout'], ['hips_rise', 'weak_extension'], ['strength'], 'intermediate',
    { sets: 3, reps: 5, pct: 70, rir: 2, tempo: '3-1-1-0', restSeconds: 150 },
    'Хиндж держит спину — тяга держит финиш', 'PoinT GO hinge'),
];

/** Комплексы фазы (фильтр по причине опционален; без причины — все). */
export function complexesForWeakPoint(wp: WLWeakPoint, opts: { cause?: TAWeakCause | null; level?: string | null } = {}): TACorrectiveComplex[] {
  try {
    const cause = opts.cause ?? null;
    return TA_CORRECTIVE_COMPLEXES.filter((c) => (c.targets as string[]).includes(wp) && (!cause || (c.causes as string[]).includes(cause)));
  } catch { return []; }
}

export function complexById(id: string): TACorrectiveComplex | null {
  try {
    const low = String(id || '').toLowerCase();
    return TA_CORRECTIVE_COMPLEXES.find((c) => c.id.toLowerCase() === low) || null;
  } catch { return null; }
}

export function complexExportLines(wp: WLWeakPoint, cause?: TAWeakCause | null): string[] {
  try {
    return complexesForWeakPoint(wp, { cause: cause ?? null })
      .map((c) => `${c.nameRu} (${c.parts.join(' + ')}) — ${c.protocol.sets}×${c.protocol.reps} @${c.protocol.pct}% · ${c.cue} [${c.source}]`);
  } catch { return []; }
}

export interface TAPrimer {
  id: string;
  nameRu: string;
  dose: string;
  targets: WLWeakPoint[];
  cue: string;
  source: string;
}

/** 12 праймеров разминки: палка/гриф, 3×3, до основной работы (Burgener + skill transfer). */
export const TA_WARMUP_PRIMERS: TAPrimer[] = [
  { id: 'wp_down_up', nameRu: 'Down-up (тройное разгибание)', dose: 'палка · 3×5', targets: ['snatch_mid', 'clean_mid', 'jerk_drive'], cue: 'Пятки в пол как можно дольше — шраги в конце', source: 'Burgener warm-up' },
  { id: 'wp_elbows_high_out', nameRu: 'Локти вверх-наружу', dose: 'палка · 3×5', targets: ['snatch_pull_under', 'clean_mid'], cue: 'Пугало: локти высоко — гриф близко', source: 'Burgener warm-up' },
  { id: 'wp_muscle_snatch_stick', nameRu: 'Масл-рывок с палкой', dose: 'палка · 3×5', targets: ['snatch_pull_under'], cue: 'Агрессивный протяж вниз, не жим', source: 'Burgener warm-up' },
  { id: 'wp_snatch_land', nameRu: 'Уход в полусед (land)', dose: 'палка · 3×3', targets: ['snatch_pull_under', 'snatch_catch'], cue: 'Подрыв вверх — тело резко вниз в четверть', source: 'Burgener warm-up' },
  { id: 'wp_snatch_drop', nameRu: 'Бросок вниз (drop)', dose: 'палка · 3×3', targets: ['snatch_pull_under', 'snatch_catch'], cue: 'Без подрыва — только скорость вниз, стопы в сед', source: 'Burgener warm-up' },
  { id: 'wp_hang_power_snatch', nameRu: 'Hang power-рывок с палкой', dose: 'палка · 3×3', targets: ['snatch_mid', 'snatch_pull_under'], cue: 'Собрать всё вместе: прыжок + посадка', source: 'Burgener warm-up' },
  { id: 'wp_snatch_push_press', nameRu: 'Швунг-жим рывковым хватом', dose: 'гриф · 3×5', targets: ['snatch_overhead', 'jerk_drive'], cue: 'Лопатки вместе — гриф над шеей, не перед', source: 'Burgener skill transfer' },
  { id: 'wp_overhead_squat_stick', nameRu: 'Оверхед-присед с палкой 3 с', dose: 'палка · 3×5', targets: ['snatch_catch', 'snatch_overhead'], cue: 'Пауза внизу — уверенность позиции', source: 'Burgener skill transfer' },
  { id: 'wp_heaving_balance', nameRu: 'Heaving-баланс', dose: 'гриф · 3×3', targets: ['snatch_catch'], cue: 'Дожим ногами из седа — руки пробивают', source: 'Burgener skill transfer' },
  { id: 'wp_drop_snatch_stick', nameRu: 'Drop-рывок с палкой', dose: 'палка · 3×3', targets: ['snatch_pull_under'], cue: 'Из-за головы — вниз без тяги', source: 'Burgener skill transfer' },
  { id: 'wp_snatch_balance_stick', nameRu: 'Рывковый баланс с палкой', dose: 'палка · 3×3', targets: ['snatch_catch', 'snatch_overhead'], cue: 'Резко вниз под гриф — активный приём', source: 'Burgener skill transfer' },
  { id: 'wp_tall_clean_stick', nameRu: 'Tall-взятие с палкой', dose: 'палка · 3×3', targets: ['clean_mid', 'clean_catch'], cue: 'Без тяги — только локти и вниз', source: 'Burgener clean warm-up' },
];

/** Праймеры фазы (разминка перед сессией; не идут в инъекцию штанги). */
export function primersForWeakPoint(wp: WLWeakPoint): TAPrimer[] {
  try {
    return TA_WARMUP_PRIMERS.filter((p) => (p.targets as string[]).includes(wp));
  } catch { return []; }
}
