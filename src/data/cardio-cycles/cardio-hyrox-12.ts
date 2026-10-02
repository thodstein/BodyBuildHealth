/**
 * cardio-hyrox-12.ts — ГОТОВЫЙ ЦИКЛ: HYROX Open, 12 недель (5 тренировок/нед).
 * HYROX = 8×1 км бег + 8 станций (SkiErg 1000 м, Sled Push 50 м×4,
 * Sled Pull 50 м×4, Burpee Broad Jump 80 м, RowErg 1000 м,
 * Farmers Carry 200 м, Sandbag Lunges 100 м, Wall Balls 100).
 * Структура по канону подготовки (HYROX official training plans,
 * Roxzone/«compromised running»: база → силовая выносливость станций →
 * компромиссный бег (бег на уставших ногах) → симуляции дистанции →
 * taper 1-2 нед). Бег всегда после/вперемешку со станциями — специфика.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const ST = 'Станции: техника и вес подконтрольны, отдых между станциями фиксированный (как на трассе).';
const run = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Бег Z2: ${desc} Ровно, разговорно.`,
});
const stations = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'rowing', dayOfWeek: dow, purpose: `Станции: ${desc} ${ST}`,
});
const comp = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Компромисс: ${desc} Бег сразу со станций — этому и учимся.`,
});
const long = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Длинный бег: ${desc}`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'cycling', dayOfWeek: dow, purpose: 'Recovery: вело/ходьба, ноги разгрузить.',
});
const sim = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: desc,
});
const race = (): CardioTemplateSession => ({
  type: 'hiit', durationMin: 90, equipment: 'running', dayOfWeek: 6,
  purpose: 'СТАРТ HYROX: 8×1 км + 8 станций! Раскладка: бег ровно, станции по плану, wall balls — терпеть.',
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [run(40, 'первый аэробный.', 1), stations(40, 'все станции по 1 подходу, лёгкий вес — техника.', 2), run(30, 'спокойно.', 3), stations(40, 'техника sled/burpee/BBJ.', 5), long(50, 'базовый.', 6)], phase: 'base', note: 'База: техника станций и аэробный бег.' },
  { sessions: [run(40, 'ровно.', 1), stations(45, 'станции с целевым весом, 2 подхода.', 2), run(32, 'чуть быстрее Z2.', 3), stations(45, 'раскладка сил по станциям.', 5), long(55, 'спокойно.', 6)], phase: 'base' },
  { sessions: [run(45, 'уверенно.', 1), stations(45, 'целевые веса.', 2), run(35, 'темпо-бег.', 3), stations(45, 'отработка переходов.', 5), long(60, 'полтора часа с лишним.', 6)], phase: 'base', note: 'Пик базы — дальше делод.' },
  { sessions: [rec(25, 1), stations(30, 'лёгкий вес, техника.', 2), rec(25, 3), stations(30, 'легко.', 5), run(35, 'совсем спокойно.', 6)], phase: 'base', deload: true, note: 'Делод −35%: объём срезан, вес снижен.' },
  { sessions: [run(45, 'аэробный.', 1), stations(50, '3 силовые станции с целевым весом.', 2), comp(35, '4×1 км бег + SkiErg 250 м между.', 3), stations(50, 'sled push/pull + carries.', 5), long(65, 'бег Z2.', 6)], phase: 'build', note: 'Специфика: начинаем связки станция→бег.' },
  { sessions: [run(45, 'аэробный.', 1), stations(50, 'целевые веса, без остановок.', 2), comp(40, '5×1 км + 5 станций (короткие).', 3), stations(50, 'полный круг станций.', 5), long(70, 'бег Z2.', 6)], phase: 'build', note: 'Компромиссный бег — ключевой навык HYROX.' },
  { sessions: [run(50, 'аэробный.', 1), stations(55, 'весь круг станций с целевым весом.', 2), comp(40, '6×1 км с ускорением последнего.', 3), stations(55, 'круг станций на время.', 5), long(75, 'последний длинный.', 6)], phase: 'build', note: 'Пик специфики.' },
  { sessions: [rec(30, 1), stations(30, 'лёгкий круг.', 2), rec(25, 3), stations(30, 'легко.', 5), run(40, 'спокойно.', 6)], phase: 'base', deload: true, note: 'Делод: впитываем билд.' },
  { sessions: [run(50, 'ровно.', 1), stations(55, 'полный круг целевых весов.', 2), comp(45, '8×1 км по раскладке гонки.', 3), stations(60, 'полный круг на время.', 5), sim(80, 'ПОЛОВИНА HYROX: 4×1 км + 4 станции — на время, репетиция раскладки.', 6)], phase: 'build', note: 'Полусимуляция: проверьте раскладку.' },
  { sessions: [run(45, 'восстановительно.', 1), stations(55, 'круг станций, целевые веса.', 2), comp(40, 'бег 6×1 км с репетицией раскладки.', 3), stations(60, 'полный круг.', 5), sim(100, 'ПОЛНАЯ СИМУЛЯЦИЯ HYROX: 8×1 км + 8 станций на время!', 6)], phase: 'peak', taper: true, note: 'Главная репетиция за 2 недели до старта.' },
  { sessions: [run(30, 'легко.', 1), stations(35, 'круг станций, 80% веса.', 2), rec(30, 3), stations(40, 'лёгкая техника.', 5), run(50, 'ровно, свежесть.', 6)], phase: 'taper', taper: true, note: 'Taper: объём −45%, вес 80%, скорость свежая.' },
  { sessions: [rec(25, 1), stations(25, '2-3 станции по технике.', 2), rec(20, 3), rec(25, 5), race()], phase: 'peak', taper: true, note: 'Неделя старта: отдохнуть и выложиться.' },
];

export const CARDIO_HYROX_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-hyrox-12',
    title: 'HYROX — 12 недель (8×1 км + 8 станций)',
    goal: 'health',
    goalFit: ['health', 'recomp', 'maintenance'],
    weeks: 12,
    sessionsPerWeek: 5,
    level: ['intermediate', 'advanced'],
    sport: 'mixed',
    period: 'mixed',
    equipment: ['running', 'rowing', 'walking'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Подготовка к HYROX Open: аэробный бег, силовая выносливость станций, компромиссный бег и две симуляции дистанции.',
    howItWorks: 'Бег Z2 + станции (sled/ski/row/carry/BBJ/wall balls) + компромиссные связки; делоды на 4/8; нед.9-10 — симуляции, taper и старт.',
    conditions: ['Доступ к sled/sled pull или замена (мешок, покрышки)', 'Бегаете 40+ мин непрерывно', '5 д/нед'],
    tags: ['hyrox', 'functional', 'compromised-running', 'sled', 'pro'],
    deloadWeeks: [4, 8],
    taperWeeks: [11, 12],
    sourceLabel: 'HYROX official training guidance + compromised-running канон (Roxzone)',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 5, level: 'intermediate', equipment: ['running', 'rowing'] },
  weeks: WEEKS,
};
