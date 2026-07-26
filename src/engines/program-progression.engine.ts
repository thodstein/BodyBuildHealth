/**
 * program-progression.engine.ts — авто-генерация недель 2+ для программ из библиотеки.
 *
 * 95% программ в programs-data.ts имеют ТОЛЬКО неделю 1.
 * Этот движок разворачивает текстовый progressionModel в структурированные ProgramWeek[].
 *
 * Поддерживаемые паттерны:
 *  - linear_weight: "+2.5 кг/нед", "+5 кг/нед"
 *  - double_progression: "работайте в диапазоне повторений..."
 *  - wave_531: "Неделя 1 (3×5), Неделя 2 (3×3)..."
 *  - texas_method: "объём в пн → пик в пт"
 *  - madcow: "волна внутри недели"
 *  - nsuns_531: "5/3/1 + FSL, ежемесячный +ТМ"
 *  - gvt_10x10: "Когда все 10×10 выполнены — +2.5 кг"
 *  - fst7: "Базовые +2.5, FST-7 когда 7×12 чисто"
 *  - rest_pause: "Прогрессия веса/повторений в rest-pause"
 *  - cluster: "5 кластеров × (3×2)"
 *  - conjugate: "ME/DE ротация"
 *  - bulgarian: "Daily Max"
 *  - rpe_autoreg: "RPE-авторегуляция"
 *  - generic: фоллбэк — копирует неделю 1 без изменений
 */

import type { FullProgram, ProgramWeek, ProgramDay } from './complete-program-library.engine';

/** Весовая инкрементация */
interface LinearWeight {
  kind: 'linear_weight';
  incrementKg: number;        // +N кг на базовые упражнения
  isoIncrementKg: number;     // +N кг на изоляцию
  deloadEveryWeeks: number;   // разгрузка каждые N недель
  deloadVolumePct: number;    // % объёма на разгрузке
}

/** Двойная прогрессия (диапазон повторений + вес) */
interface DoubleProgression {
  kind: 'double_progression';
  repTarget: number;          // целевое верхнее значение повторений
  weightIncrement: number;    // +N кг при достижении верха
  isoIncrement: number;
  deloadEveryWeeks: number;
}

/** 5/3/1 волновая */
interface Wave531 {
  kind: 'wave_531';
  tmIncrement: number;        // +N кг к ТМ каждый цикл
  cycleWeeks: number;         // длина цикла (обычно 4)
}

/** Texas Method */
interface TexasMethod {
  kind: 'texas_method';
  weeklyIncrement: number;    // +N кг/нед в интенсивный день
  deloadEveryWeeks: number;
}

/** Madcow 5x5 */
interface Madcow55 {
  kind: 'madcow_5x5';
  weeklyPct: number;          // +N% в неделю
  rampTopSet: boolean;        // рамп до топ-сета
}

/** nSuns 5/3/1 */
interface Nsuns531 {
  kind: 'nsuns_531';
  tmMonthly: number;          // +N кг/мес
  deloadWeek: number;         // неделя разгрузки
}

/** GVT 10×10 */
interface Gvt1010 {
  kind: 'gvt_10x10';
  weightIncrement: number;    // +N кг когда все 10×10 выполнены
  deloadEveryWeeks: number;
}

/** FST-7 */
interface Fst7 {
  kind: 'fst7';
  baseIncrement: number;      // базовые +N кг/нед
  fst7Increment: number;      // FST-7 +N кг когда чисто
  deloadWeek: number;
}

/** Rest-pause (DC) */
interface RestPause {
  kind: 'rest_pause';
  targetReps: number;         // целевое окно (11-15)
  deloadEveryWeeks: number;
}

/** RPE-авторегуляция */
interface RpeAutoreg {
  kind: 'rpe_autoreg';
  loadDrop: number;           // % сброса после основного движения
  deloadWeek: number;
}

/** Westside Conjugate */
interface Conjugate {
  kind: 'conjugate';
  deIncrement: number;        // +N% к DE весам
  deloadEveryWeeks: number;
}

/** Кластерные сеты */
interface ClusterSets {
  kind: 'cluster_sets';
  weightIncrement: number;
  deloadEveryWeeks: number;
}

/** Болгарский метод */
interface Bulgarian {
  kind: 'bulgarian';
  backoffPct: number;         // % для back-off сетов
}

type ProgressionStrategy =
  | LinearWeight | DoubleProgression | Wave531 | TexasMethod
  | Madcow55 | Nsuns531 | Gvt1010 | Fst7 | RestPause
  | RpeAutoreg | Conjugate | ClusterSets | Bulgarian;

// ═══════════════════════════════════════════════════════════
// Парсинг progressionModel → ProgressionStrategy
// ═══════════════════════════════════════════════════════════

function parseProgression(p: FullProgram): ProgressionStrategy {
  const id = p.id.toLowerCase();
  const model = p.progressionModel.toLowerCase();
  const deloadEvery = parseDeloadEvery(p.deloadProtocol);
  const deloadPct = parseDeloadPct(p.deloadProtocol);

  // 5/3/1 волна
  if (id.includes('531') || id.includes('531') || model.includes('5/3/1') || model.includes('волнов')) {
    return {
      kind: 'wave_531',
      tmIncrement: model.includes('2.5') ? 2.5 : 5,
      cycleWeeks: 4,
    };
  }

  // nSuns
  if (id.includes('nsuns')) {
    return { kind: 'nsuns_531', tmMonthly: id.includes('nsuns') ? 1.25 : 2.5, deloadWeek: 7 };
  }

  // Texas Method
  if (id.includes('texas')) {
    return { kind: 'texas_method', weeklyIncrement: 2.5, deloadEveryWeeks: deloadEvery };
  }

  // Madcow
  if (id.includes('madcow')) {
    return { kind: 'madcow_5x5', weeklyPct: 2.5, rampTopSet: true };
  }

  // GVT 10x10
  if (id.includes('gvt') || id.includes('объёмный тре') || id.includes('объемный тре')) {
    return { kind: 'gvt_10x10', weightIncrement: 2.5, deloadEveryWeeks: 4 };
  }

  // FST-7
  if (id.includes('fst7') || id.includes('fst-7')) {
    return { kind: 'fst7', baseIncrement: 2.5, fst7Increment: 2.5, deloadWeek: 5 };
  }

  // Doggcrapp
  if (id.includes('dog') || id.includes('dc')) {
    return { kind: 'rest_pause', targetReps: 15, deloadEveryWeeks: 6 };
  }

  // RTS / RPE-авторегуляция
  if (id.includes('rts') || model.includes('rpe-авто') || model.includes('авторегуля')) {
    return { kind: 'rpe_autoreg', loadDrop: 5, deloadWeek: 4 };
  }

  // Westside Conjugate
  if (id.includes('westside') || id.includes('conjugate')) {
    return { kind: 'conjugate', deIncrement: 2.5, deloadEveryWeeks: 5 };
  }

  // Кластерные сеты
  if (id.includes('cluster')) {
    return { kind: 'cluster_sets', weightIncrement: 2.5, deloadEveryWeeks: deloadEvery };
  }

  // Болгарский
  if (id.includes('bulgarian') || id.includes('daily_max')) {
    return { kind: 'bulgarian', backoffPct: 85 };
  }

  // Rest-pause
  if (model.includes('rest-pause') || model.includes('до отказа')) {
    return { kind: 'rest_pause', targetReps: 15, deloadEveryWeeks: deloadEvery };
  }

  // Двойная прогрессия
  if (model.includes('двойная') || model.includes('double progression') || model.includes('диапазон')) {
    return {
      kind: 'double_progression',
      repTarget: 12,
      weightIncrement: parseWeightIncrement(model) || 2.5,
      isoIncrement: 1,
      deloadEveryWeeks: deloadEvery,
    };
  }

  // Линейная (фоллбэк)
  return {
    kind: 'linear_weight',
    incrementKg: parseWeightIncrement(model) || 2.5,
    isoIncrementKg: 1,
    deloadEveryWeeks: deloadEvery,
    deloadVolumePct: deloadPct,
  };
}

function parseDeloadEvery(deloadProtocol: string): number {
  const match = deloadProtocol.match(/каждые\s*(\d+)\s*нед/i) || deloadProtocol.match(/every\s*(\d+)\s*week/i);
  return match ? parseInt(match[1], 10) : 4;
}

function parseDeloadPct(deloadProtocol: string): number {
  const match = deloadProtocol.match(/снижени[ея]\s*.*?(\d+)\s*%/i) ||
    deloadProtocol.match(/reduce.*?(\d+)\s*%/i) ||
    deloadProtocol.match(/объём.*?(\d+)\s*%/i);
  return match ? parseInt(match[1], 10) / 100 : 0.4;
}

function parseWeightIncrement(model: string): number | null {
  const m = model.match(/\+(\d+(?:\.\d+)?)\s*кг/i);
  return m ? parseFloat(m[1]) : null;
}

// ═══════════════════════════════════════════════════════════
// Генератор недель
// ═══════════════════════════════════════════════════════════

function isBaseExercise(name: string): boolean {
  const bases = ['squat', 'bench', 'deadlift', 'press', 'row', 'pull-up', 'pullup', 'dip',
    'leg press', 'жим', 'присед', 'тяг', 'станова', 'толчок', 'рывок',
    'hip thrust', 'lunge', 'split squat', 'rdl', 'romanian', 'front squat',
    'incline', 'decline', 'overhead', 'military', 'clean', 'snatch', 'jerk',
    'good morning', 'paused', 'deficit', 'box squat', 'hack squat',
    'жим ногами', 'выпад', 'болгар', 'гудморнинг', 'протяжка'];
  const lower = name.toLowerCase();
  return bases.some(b => lower.includes(b));
}

function isIsolationExercise(name: string): boolean {
  const iso = ['curl', 'pushdown', 'extension', 'raise', 'fly', 'flye', 'kickback',
    'face pull', 'plank', 'crunch', 'ab wheel', 'leg raise', 'calf',
    'разгиб', 'сгиб', 'махи', 'подъём', 'подъем', 'кроссовер',
    'бабочка', 'пек-дек', 'сведен', 'разведен', 'икры', 'пресс'];
  const lower = name.toLowerCase();
  return iso.some(i => lower.includes(i));
}

/** Применить линейную прогрессию веса к описанию упражнения */
function applyWeightProgression(note: string, reps: string, increment: number, week: number): string {
  const baseWeight = 60 + (week - 1) * increment;
  if (note && note.includes('+')) return note;
  if (note) return note + ` (≈${baseWeight} кг, +${increment} кг/нед)`;
  return `≈${baseWeight} кг, +${increment} кг/нед`;
}

/** Поднять RPE на 0.5 для линейной прогрессии */
function rpeForWeek(baseRpe: number, week: number, totalWeeks: number, deload: boolean): number {
  if (deload) return Math.max(5, baseRpe - 3);
  const ramp = Math.min(week / totalWeeks, 0.5);
  return Math.min(10, baseRpe + ramp);
}

/** Поднять RIR на делоде */
function rirForWeek(baseRir: number, deload: boolean): number {
  return deload ? Math.max(3, baseRir + 2) : baseRir;
}

function isDeloadWeek(week: number, deloadEvery: number): boolean {
  if (deloadEvery <= 0) return false;
  return week % deloadEvery === 0;
}

function phaseForWeek(week: number, totalWeeks: number, deload: boolean): string {
  if (deload) return 'deload';
  const ratio = week / totalWeeks;
  if (ratio <= 0.25) return 'accumulation';
  if (ratio <= 0.6) return 'intensification';
  if (ratio <= 0.85) return 'peaking';
  return 'peaking';
}

function volMultForWeek(week: number, totalWeeks: number, deload: boolean, deloadPct: number): number {
  if (deload) return deloadPct;
  const ratio = week / totalWeeks;
  if (ratio <= 0.25) return 1.0;
  if (ratio <= 0.6) return 1.05;
  if (ratio <= 0.85) return 0.85;
  return 0.7;
}

function intMultForWeek(week: number, totalWeeks: number, deload: boolean): number {
  if (deload) return 0.6;
  const ratio = week / totalWeeks;
  if (ratio <= 0.25) return 0.85;
  if (ratio <= 0.6) return 0.95;
  if (ratio <= 0.85) return 1.0;
  return 1.05;
}

/** Глубокое клонирование ProgramWeek */
function cloneWeek(w: ProgramWeek): ProgramWeek {
  return {
    ...w,
    days: w.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) })),
  };
}

/** Глубокое клонирование ProgramDay */
function cloneDay(d: ProgramDay): ProgramDay {
  return { ...d, exercises: d.exercises.map(e => ({ ...e })) };
}

// ═══════════════════════════════════════════════════════════
// Основные генераторы по стратегиям
// ═══════════════════════════════════════════════════════════

function generateLinearWeight(program: FullProgram, s: LinearWeight): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = isDeloadWeek(w, s.deloadEveryWeeks);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = phaseForWeek(w, program.durationWeeks, deload);
    cloned.volumeMultiplier = volMultForWeek(w, program.durationWeeks, deload, s.deloadVolumePct);
    cloned.intensityMultiplier = intMultForWeek(w, program.durationWeeks, deload);
    cloned.deload = deload;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        const inc = isIsolationExercise(ex.name) ? s.isoIncrementKg : s.incrementKg;
        ex.notes = applyWeightProgression(ex.notes, ex.reps, inc, w);
        ex.rpe = rpeForWeek(ex.rpe, w, program.durationWeeks, deload);
        ex.rir = rirForWeek(ex.rir, deload);
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateDoubleProgression(program: FullProgram, s: DoubleProgression): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = isDeloadWeek(w, s.deloadEveryWeeks);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = phaseForWeek(w, program.durationWeeks, deload);
    cloned.volumeMultiplier = volMultForWeek(w, program.durationWeeks, deload, 0.4);
    cloned.intensityMultiplier = intMultForWeek(w, program.durationWeeks, deload);
    cloned.deload = deload;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        const inc = isIsolationExercise(ex.name) ? s.isoIncrement : s.weightIncrement;
        ex.notes = `Неделя ${w}: +${inc} кг при достижении ${s.repTarget} повт с RPE≤8`;
        ex.rpe = rpeForWeek(ex.rpe, w, program.durationWeeks, deload);
        ex.rir = rirForWeek(ex.rir, deload);
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateWave531(program: FullProgram, s: Wave531): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const cycleWeek = ((w - 1) % s.cycleWeeks) + 1;
    const deload = cycleWeek === s.cycleWeeks;
    const cycle = Math.floor((w - 1) / s.cycleWeeks);

    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : cycleWeek <= 2 ? 'accumulation' : 'peaking';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.5 : 1.0;
    cloned.intensityMultiplier = deload ? 0.6 : 0.8 + cycleWeek * 0.05;

    const tmAdd = cycle * s.tmIncrement;
    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        if (isBaseExercise(ex.name)) {
          ex.notes = deload
            ? `Deload: 40-60% TM (TM=${90 + tmAdd} кг)`
            : `Цикл ${cycle + 1}, нед ${cycleWeek}: TM +${tmAdd} кг`;
        }
        ex.rpe = deload ? 5 : 7 + cycleWeek * 0.3;
        ex.rir = deload ? 5 : Math.max(1, 3 - cycleWeek);
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateTexasMethod(program: FullProgram, s: TexasMethod): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = isDeloadWeek(w, s.deloadEveryWeeks);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : 'accumulation';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.5 : 1.0;
    cloned.intensityMultiplier = deload ? 0.6 : 1.0;

    for (const day of cloned.days) {
      const isIntensity = day.name.toLowerCase().includes('интен') || day.name.toLowerCase().includes('пт');
      for (const ex of day.exercises) {
        if (isIntensity && isBaseExercise(ex.name)) {
          ex.notes = `Неделя ${w}: +${s.weeklyIncrement * (w - 1)} кг от нед 1 (новый 5ПМ)`;
          ex.rpe = Math.min(10, 9 + (w - 1) * 0.1);
          ex.rir = Math.max(0, 1 - (w - 1) * 0.1);
        } else {
          ex.rpe = deload ? 5 : ex.rpe;
          ex.rir = deload ? 5 : ex.rir;
        }
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateMadcow(program: FullProgram, s: Madcow55): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = w % 6 === 0;
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : 'accumulation';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.5 : 1.0;
    cloned.intensityMultiplier = deload ? 0.6 : 1.0;

    const pct = 1 + (s.weeklyPct / 100) * (w - 1);
    for (const day of cloned.days) {
      const isHeavy = day.name.toLowerCase().includes('пт') || day.name.toLowerCase().includes('тяж');
      for (const ex of day.exercises) {
        if (isHeavy && isBaseExercise(ex.name)) {
          ex.notes = `Неделя ${w}: +${s.weeklyPct}% (≈ ×${pct.toFixed(2)} от нед 1)`;
          ex.rpe = deload ? 5 : Math.min(10, 9 + (w - 1) * 0.08);
          ex.rir = deload ? 5 : Math.max(1, 2 - (w - 1) * 0.1);
        } else {
          ex.rpe = deload ? 5 : ex.rpe;
          ex.rir = deload ? 5 : ex.rir;
        }
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateNsuns(program: FullProgram, _s: Nsuns531): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = w === 7;
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : w <= 4 ? 'accumulation' : 'peaking';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.6 : 1.0;
    cloned.intensityMultiplier = deload ? 0.6 : 1.0;

    const month = Math.floor((w - 1) / 4);
    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        if (isBaseExercise(ex.name)) {
          ex.notes = deload
            ? 'Разгрузка: −40% объёма, RPE ≤7'
            : `Месяц ${month + 1}: ТМ +${(month * 5).toFixed(1)} кг`;
        }
        ex.rpe = deload ? 6 : ex.rpe;
        ex.rir = deload ? 4 : ex.rir;
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateGvt(program: FullProgram, s: Gvt1010): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = isDeloadWeek(w, s.deloadEveryWeeks);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : 'accumulation';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.6 : 1.0;
    cloned.intensityMultiplier = deload ? 0.5 : 1.0;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        if (ex.sets >= 10) {
          ex.notes = `Неделя ${w}: 10×10 @60% (${s.weightIncrement * (w - 1)} кг сверху при чистом выполнении)`;
        }
        ex.rpe = deload ? 5 : ex.rpe;
        ex.rir = deload ? 5 : ex.rir;
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateFst7(program: FullProgram, s: Fst7): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = w === s.deloadWeek;
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : 'accumulation';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.6 : 1.0;
    cloned.intensityMultiplier = deload ? 0.6 : 1.0;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        if (ex.restSec <= 30 && ex.sets >= 7) {
          ex.notes = `FST-7 нед ${w}: +${s.fst7Increment} кг при 7×12 чисто`;
        } else if (isBaseExercise(ex.name)) {
          ex.notes = `Нед ${w}: +${s.baseIncrement * (w - 1)} кг`;
        }
        ex.rpe = deload ? 5 : ex.rpe;
        ex.rir = deload ? 5 : ex.rir;
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateRestPause(program: FullProgram, s: RestPause): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = isDeloadWeek(w, s.deloadEveryWeeks);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : 'intensification';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.5 : 0.6;
    cloned.intensityMultiplier = deload ? 0.5 : 1.2;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        ex.notes = `Нед ${w}: цель ${s.targetReps - 4}-${s.targetReps} повт rest-pause`;
        ex.rpe = deload ? 5 : 10;
        ex.rir = deload ? 5 : 0;
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateRpeAutoreg(program: FullProgram, s: RpeAutoreg): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = w === s.deloadWeek || (w % 4 === 0);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : w <= 3 ? 'accumulation' : 'intensification';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.6 : 1.0;
    cloned.intensityMultiplier = deload ? 0.6 : 1.0;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        ex.notes = `Нед ${w}: авторегуляция RPE, ${deload ? 'разгрузка' : `load drop ${s.loadDrop}%`}`;
        ex.rpe = deload ? 6 : Math.min(10, (ex.rpe || 8) + (w - 1) * 0.1);
        ex.rir = deload ? 4 : Math.max(1, (ex.rir || 2) - (w - 1) * 0.05);
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateConjugate(program: FullProgram, s: Conjugate): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = isDeloadWeek(w, s.deloadEveryWeeks);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : w <= 2 ? 'intensification' : 'peaking';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.5 : 1.0;
    cloned.intensityMultiplier = deload ? 0.5 : 1.0;

    for (const day of cloned.days) {
      const isDE = day.name.toLowerCase().includes('de') || day.name.toLowerCase().includes('динам');
      for (const ex of day.exercises) {
        if (isDE && isBaseExercise(ex.name)) {
          ex.notes = `DE нед ${w}: +${s.deIncrement * (w - 1)}% к весу штанги`;
        }
        if (!isDE && ex.sets === 0) {
          ex.notes = `ME нед ${w}: новая вариация до 1-3ПМ`;
        }
        ex.rpe = deload ? 5 : ex.rpe;
        ex.rir = deload ? 5 : ex.rir;
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateBulgarian(program: FullProgram, s: Bulgarian): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = 'peaking';
    cloned.deload = false;
    cloned.volumeMultiplier = 1.0;
    cloned.intensityMultiplier = 1.0;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        ex.notes = `Нед ${w}: Daily max + back-off ${s.backoffPct}% ×2-3`;
        ex.rpe = 9.5;
        ex.rir = 0.5;
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

function generateClusterSets(program: FullProgram, s: ClusterSets): ProgramWeek[] {
  const template = program.weeks[0];
  if (!template) return [template].filter(Boolean);

  const weeks: ProgramWeek[] = [template];
  for (let w = 2; w <= program.durationWeeks; w++) {
    const deload = isDeloadWeek(w, s.deloadEveryWeeks);
    const cloned = cloneWeek(template);
    cloned.week = w;
    cloned.phase = deload ? 'deload' : 'accumulation';
    cloned.deload = deload;
    cloned.volumeMultiplier = deload ? 0.6 : 1.0;
    cloned.intensityMultiplier = deload ? 0.6 : 1.0;

    for (const day of cloned.days) {
      for (const ex of day.exercises) {
        ex.notes = `Нед ${w}: кластеры ${ex.reps}, +${s.weightIncrement * (w - 1)} кг`;
        ex.rpe = deload ? 5 : Math.min(9.5, 8.5 + (w - 1) * 0.2);
        ex.rir = deload ? 5 : Math.max(1, 2.5 - (w - 1) * 0.2);
      }
    }
    weeks.push(cloned);
  }
  return weeks;
}

// ═══════════════════════════════════════════════════════════
// Публичный API
// ═══════════════════════════════════════════════════════════

/**
 * Развернуть программу — сгенерировать недели 2+ на основе progressionModel.
 * Если программа уже имеет все недели — возвращает как есть.
 */
export function expandProgramWeeks(program: FullProgram): FullProgram {
  // Уже полная (все недели заданы)
  if (program.weeks.length >= program.durationWeeks) return program;

  const strategy = parseProgression(program);
  let weeks: ProgramWeek[];

  try {
    switch (strategy.kind) {
      case 'linear_weight':     weeks = generateLinearWeight(program, strategy); break;
      case 'double_progression': weeks = generateDoubleProgression(program, strategy); break;
      case 'wave_531':          weeks = generateWave531(program, strategy); break;
      case 'texas_method':      weeks = generateTexasMethod(program, strategy); break;
      case 'madcow_5x5':        weeks = generateMadcow(program, strategy); break;
      case 'nsuns_531':         weeks = generateNsuns(program, strategy); break;
      case 'gvt_10x10':         weeks = generateGvt(program, strategy); break;
      case 'fst7':              weeks = generateFst7(program, strategy); break;
      case 'rest_pause':        weeks = generateRestPause(program, strategy); break;
      case 'rpe_autoreg':       weeks = generateRpeAutoreg(program, strategy); break;
      case 'conjugate':         weeks = generateConjugate(program, strategy); break;
      case 'cluster_sets':      weeks = generateClusterSets(program, strategy); break;
      case 'bulgarian':         weeks = generateBulgarian(program, strategy); break;
      default:                  weeks = program.weeks; break;
    }
  } catch (_e) {
    // Фоллбэк: копируем неделю 1 на все недели
    const template = program.weeks[0];
    weeks = [template];
    for (let w = 2; w <= program.durationWeeks; w++) {
      const cloned = cloneWeek(template);
      cloned.week = w;
      cloned.phase = phaseForWeek(w, program.durationWeeks, false);
      weeks.push(cloned);
    }
  }

  return { ...program, weeks };
}

/**
 * Получить развёрнутую программу по ID.
 * Ищет в FULL_PROGRAM_LIBRARY + WOMENS_PROGRAMS + CUSTOM_PROGRAMS.
 */
export function getExpandedProgram(id: string, allPrograms: FullProgram[]): FullProgram | undefined {
  const program = allPrograms.find(p => p.id === id);
  if (!program) return undefined;
  return expandProgramWeeks(program);
}

/**
 * Развернуть все программы в массиве.
 */
export function expandAllPrograms(programs: FullProgram[]): FullProgram[] {
  return programs.map(p => expandProgramWeeks(p));
}
