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
    ['early_pull', 'bar_forward'], ['technique'], 'novice', 'technique',
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
    ['slow_turnover', 'high_catch', 'feet_error'], ['technique'], 'novice', 'technique',
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
  P('overhead_hold', 'Удержание оверхеда 5–8 с', ['snatch_overhead'],
    ['unstable_overhead'], ['mobility', 'strength'], 'novice', 'stability',
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
    ['pressout', 'slow_turnover', 'bar_crash'], ['technique'], 'novice', 'technique',
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
    ['soft_catch', 'chest_collapse'], ['strength'], 'all', 'strength',
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
    ['bar_forward', 'knee_touch', 'early_pull'], ['technique'], 'intermediate', 'technique',
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
}

/** Доза под причину-лимитер (паритет с ta-correction-rank: volume 4×5, strength 4×4+5%, mobility/fatigue −5%). */
export function adjustProtocolForCause(
  base: TACorrectiveProtocol, cause?: TAWeakCause | null,
): TACorrectiveProtocol {
  if (cause === 'volume') return { ...base, sets: 4, reps: 5 };
  if (cause === 'strength') return { ...base, sets: 4, reps: 4, pct: Math.min(110, base.pct + 5) };
  if (cause === 'mobility' || cause === 'fatigue') return { ...base, pct: Math.max(40, base.pct - 5), rir: Math.max(base.rir, 2) };
  return { ...base };
}

function levelRank(level: TACorrectiveLevel): number {
  if (level === 'all') return 0;
  if (level === 'novice') return 1;
  if (level === 'intermediate') return 2;
  return 3;
}

/**
 * Коррективы фазы, отранжированные под причину и уровень (дешёвый скоринг, честный):
 *  +20 совпадение причины, +10 техника-фазе при technique, −15 уровень выше атлета.
 */
export function correctivesForWeakPoint(wp: WLWeakPoint, opts: CorrectiveRankOpts = {}): TACorrectivePick[] {
  const list = CORRECTIVES_BY_PHASE[wp] || [];
  const cause = opts.cause ?? null;
  const lv = String(opts.level || 'intermediate').toLowerCase();
  const athleteRank = lv.includes('begin') || lv.includes('novice') ? 1 : lv.includes('adv') || lv.includes('enh') || lv.includes('elite') ? 3 : 2;
  const scored = list.map((ex) => {
    let score = 50;
    if (cause && (ex.causes as string[]).includes(cause)) { score += 20; }
    if (!cause && ex.phase === 'technique') score += 10;
    if (levelRank(ex.level) > athleteRank) score -= 15;
    if (levelRank(ex.level) <= athleteRank) score += 5;
    const protocolAdj = adjustProtocolForCause(ex.protocol, cause);
    const matchReason = cause && (ex.causes as string[]).includes(cause)
      ? `причина ${cause} — прямое попадание`
      : ex.phase === 'technique' ? 'база техники фазы' : ex.phase === 'strength' ? 'сила фазы' : 'стабильность приёма';
    return { ...ex, protocolAdj, matchReason, __s: score } as TACorrectivePick & { __s: number };
  });
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
): TACorrectiveSessionStep[] {
  const uniq = [...new Set(weakPoints)].slice(0, 3);
  const picks: Array<{ ex: TACorrectivePick; wp: WLWeakPoint }> = [];
  for (const wp of uniq) {
    const cause = causeByWeak[wp] ?? null;
    const list = correctivesForWeakPoint(wp, { cause, limit: 3 });
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

export interface BarTagsResult {
  tags: TACorrectiveErrorTag[];
  text: string | null;
}

/**
 * Замер → теги ошибок (пороги SRD хаба: turnover >4 см, catch >6 см).
 * Пусто/норма (≤4) — молчит (не диагноз по шуму).
 */
export function tagsForBarMetrics(xLoopCm: number | null | undefined, lift: string): BarTagsResult {
  const x = typeof xLoopCm === 'number' ? xLoopCm : NaN;
  if (!Number.isFinite(x) || x <= 4) return { tags: [], text: null };
  const isJerk = String(lift || '').toLowerCase().includes('jerk');
  if (isJerk) {
    const tags: TACorrectiveErrorTag[] = x > 6 ? ['drive_forward', 'split_short'] : ['drive_forward'];
    return { tags, text: `Горизонталь ${x} см — драйв уходит вперёд` };
  }
  const tags: TACorrectiveErrorTag[] = x > 6 ? ['bar_forward', 'bar_crash'] : ['bar_forward'];
  return { tags, text: `Петля ${x} см (>SRD) — гриф уходит вперёд` };
}

/** Обогащённые строки экспорта фазы: имя + доза + кью + источник. */
export function correctiveExportLines(
  wp: WLWeakPoint, cause?: TAWeakCause | null, level?: string | null,
): string[] {
  try {
    return correctivesForWeakPoint(wp, { cause: cause ?? null, level: level ?? null, limit: 3 })
      .map((c) => `${c.nameRu} — ${c.protocolAdj.sets}×${c.protocolAdj.reps} @${c.protocolAdj.pct}% · ${c.cues[0] || ''} · ${c.source}`);
  } catch { return []; }
}

/** Волна corrective-блока 4–8 нед (паритет ta-spec-block: 3,3,4,4,4,4,3,3). */
export function correctiveBlockFor(weakPoints: WLWeakPoint[], weeks = 6): TACorrectiveWeek[] {
  const uniq = [...new Set(weakPoints)].slice(0, 3) as WLWeakPoint[];
  const total = Math.max(4, Math.min(8, Math.round(weeks) || 6));
  const setsFor = (wi: number) => (wi <= 1 ? 3 : wi <= 5 ? 4 : 3);
  const focusFor = (wi: number) => wi <= 1 ? 'Техника — чистота фазы' : wi <= 3 ? 'Объём — накопление' : wi <= 5 ? 'Интенсивность — перенос' : 'Подводка — свежесть';
  const out: TACorrectiveWeek[] = [];
  for (let wi = 0; wi < total; wi++) {
    const sets = setsFor(wi);
    const items = uniq.flatMap((wp) => {
      const list = correctivesForWeakPoint(wp, { limit: 2 });
      return list.map((c) => ({ exerciseId: c.id, sets, reps: wi <= 1 ? 5 : wi <= 5 ? (c.phase === 'strength' ? 4 : 5) : 3, pct: c.protocol.pct + (wi >= 2 && wi <= 5 ? 5 : 0) }));
    }).slice(0, 6);
    out.push({ week: wi + 1, focus: focusFor(wi), items });
  }
  return out;
}
