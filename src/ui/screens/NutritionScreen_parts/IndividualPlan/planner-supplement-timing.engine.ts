/**
 * planner-supplement-timing.engine.ts — ПРО-схема приёма добавок, привязанная к рациону.
 *
 * Профессиональный планировщик обязан не только дать КБЖУ, но и показать, КОГДА принимать
 * добавки относительно приёмов/тренировки (ISSN 2017/2018, Kreider 2022, Maughan BHI):
 * креатин — пост-трен/завтрак, кофеин — за 30–60 мин до старта, омега-3/D3 — с жирным приёмом,
 * магний/цинк — на ночь, железо (женщинам) — утром вдали от кальция/кофе, β-аланин — дробно.
 *
 * Чистая функция: на вход — выбранные добавки (id/name/dosage/timing из каталога поддержки)
 * и план дня (приёмы с временем/составом + окно тренировки); на выход — слоты по времени.
 */

export type SuppSlotKey = 'preWO' | 'intra' | 'postWO' | 'breakfast' | 'lunch' | 'dinner' | 'presleep' | 'anytime';

export interface SuppTimingItem {
  id: string;
  name: string;
  dose: string;
  reason: string;
}

export interface SuppTimingSlot {
  time: string;
  label: string;
  slot: SuppSlotKey;
  items: SuppTimingItem[];
}

export interface SuppTimingMeal {
  type: string;
  label: string;
  time: string;
  items?: { id: string; name: string; f?: number }[];
}

export interface SuppTimingInput {
  supplements: { id: string; name?: string; nameRu?: string; dosage?: string; timing?: string }[];
  meals: SuppTimingMeal[];
  trainStartMin?: number;
  trainDurationMin?: number;
  isTrainingDay: boolean;
  weightKg: number;
  sex: 'male' | 'female';
  goal?: string;
}

export interface SupplementTiming {
  slots: SuppTimingSlot[];
  notes: string[];
}

const SLOT_LABEL: Record<SuppSlotKey, string> = {
  preWO: '🏋 Перед тренировкой',
  intra: '🥤 Во время тренировки',
  postWO: '🍽 После тренировки',
  breakfast: '☀️ Завтрак',
  lunch: '🍽 Обед',
  dinner: '🌆 Ужин',
  presleep: '🌙 Перед сном',
  anytime: '🕐 В любой приём',
};

/** Классификация добавки в слот приёма по id/имени (подстроки устойчивы к дрейфу id). */
export function suppSlotFor(id: string, name = ''): SuppSlotKey {
  const s = `${id} ${name}`.toLowerCase();
  if (/caffein|pre.?workout|stimulant|гуарана|guarana/.test(s)) return 'preWO';
  if (/creatin|креатин/.test(s)) return 'postWO';
  if (/beta.?alanin|бета.?аланин/.test(s)) return 'anytime';
  if (/electrolyt|isotonic|изотоник|электролит/.test(s)) return 'intra';
  if (/whey|protein.?powder|сыворот|протеин/.test(s)) return 'postWO';
  if (/omega|fish.?oil|epa|dha|омега|рыб.*жир/.test(s)) return 'lunch';
  if (/vitamin.?d|cholecalciferol|d3|витамин.?d/.test(s)) return 'lunch';
  if (/coq10|ubiquinol|коэнзим/.test(s)) return 'lunch';
  if (/tudca|удхк|урсодез/.test(s)) return 'lunch';
  if (/magnesium|магний|(^|\W)mag(\W|$)/.test(s)) return 'presleep';
  if (/zinc|цинк/.test(s)) return 'presleep';
  if (/iron|ferro|железо|бисглицинат/.test(s)) return 'breakfast';
  if (/vitamin.?c|ascorb|витамин.?c/.test(s)) return 'breakfast';
  if (/multivitamin|vitamin.?complex|витамин.*комплекс|поливитамин/.test(s)) return 'breakfast';
  if (/nac|acetylcystein|ацетилцистеин/.test(s)) return 'dinner';
  return 'anytime';
}

const SLOT_REASON: Record<SuppSlotKey, string> = {
  preWO: 'За 30–60 мин до старта (кофеин 3–6 мг/кг; не позднее 8 ч до сна)',
  intra: 'Во время длительной (>60 мин) сессии — регидрация/электролиты',
  postWO: 'Пост-тренировочное окно (максимальная утилизация/гликоген)',
  breakfast: 'Утром натощак/с завтраком; вдали от кальция и кофе (железо)',
  lunch: 'С жирным приёмом (омега-3/D3/CoQ10 — жирорастворимые)',
  dinner: 'С едой (лучше переносимость/печёночный контур)',
  presleep: 'На ночь (магний/цинк — сон, восстановление)',
  anytime: 'С любым приёмом (режим/доза по этикетке)',
};

const _fmt = (min: number): string => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(Math.round(min) % 60).padStart(2, '0');

function mealTime(meals: SuppTimingMeal[], type: string, fallback: string): string {
  const m = meals.find(x => String(x.type) === type);
  return m?.time || fallback;
}

/**
 * Собрать схему приёма добавок, привязанную к приёмам/тренировке дня.
 * Детерминированная; пустой вход → пустые слоты.
 */
export function buildSupplementTiming(input: SuppTimingInput): SupplementTiming {
  const supps = Array.isArray(input.supplements) ? input.supplements.filter(s => s && s.id) : [];
  const notes: string[] = [];
  if (supps.length === 0) return { slots: [], notes: ['Добавки не выбраны — схема пуста (выберите их в настройках).'] };

  const meals = Array.isArray(input.meals) ? input.meals : [];
  const w = Number.isFinite(input.weightKg) && input.weightKg > 0 ? input.weightKg : 80;
  const trainStart = input.trainStartMin;
  const hasTrain = input.isTrainingDay && Number.isFinite(trainStart as number);

  // Время слотов (из плана дня; peri — из окна тренировки).
  const slotTime: Record<SuppSlotKey, string> = {
    preWO: hasTrain ? _fmt((trainStart as number) - 45) : mealTime(meals, 'breakfast', '08:00'),
    intra: hasTrain ? _fmt((trainStart as number) + 30) : mealTime(meals, 'snack', '15:00'),
    postWO: mealTime(meals, 'postworkout', hasTrain ? _fmt((trainStart as number) + (input.trainDurationMin || 60) + 30) : '08:00'),
    breakfast: mealTime(meals, 'breakfast', '08:00'),
    lunch: mealTime(meals, 'lunch', '13:00'),
    dinner: mealTime(meals, 'dinner', '19:00'),
    presleep: mealTime(meals, 'presleep', '22:00'),
    anytime: mealTime(meals, 'breakfast', '08:00'),
  };

  const bySlot = new Map<SuppSlotKey, SuppTimingItem[]>();
  for (const s of supps) {
    let slot = suppSlotFor(s.id, s.nameRu || s.name || '');
    // Креатин без тренировки — к завтраку; кофеин без тренировки — «в любой приём».
    if (slot === 'postWO' && !hasTrain && /creatin|креатин/i.test(s.id + (s.name || ''))) slot = 'breakfast';
    if (slot === 'preWO' && !hasTrain) slot = 'anytime';
    if (slot === 'intra' && !hasTrain) slot = 'anytime';
    const name = s.nameRu || s.name || s.id;
    const dose = (s.dosage && s.dosage.trim()) || (slot === 'preWO' && /caffein|кофеин/i.test(s.id + name) ? `${Math.round(w * 3)}–${Math.round(w * 6)} мг` : 'по инструкции');
    const arr = bySlot.get(slot) || [];
    arr.push({ id: s.id, name, dose, reason: (s.timing && s.timing.trim()) || SLOT_REASON[slot] });
    bySlot.set(slot, arr);
  }

  const order: SuppSlotKey[] = ['breakfast', 'lunch', 'dinner', 'preWO', 'intra', 'postWO', 'presleep', 'anytime'];
  const slots: SuppTimingSlot[] = [];
  for (const k of order) {
    const items = bySlot.get(k);
    if (!items || items.length === 0) continue;
    slots.push({ slot: k, time: slotTime[k], label: SLOT_LABEL[k], items });
  }
  // Хронологическая сортировка по времени.
  slots.sort((a, b) => a.time.localeCompare(b.time));

  if (input.sex === 'female' && supps.some(s => /iron|ferro|железо|бисглицинат/i.test(s.id + (s.name || '')))) {
    notes.push('♀ Железо: утром вдали от кальция/кофе, с витамином C; при HCT ≥48 — не принимать без врача.');
  }
  if (hasTrain && supps.some(s => /caffein|кофеин/i.test(s.id + (s.name || '')))) {
    notes.push('☕ Кофеин: не позднее 8 ч до сна; при чувствительности — снизить дозу.');
  }
  notes.push('Схема — по данным каталога поддержки (доза/тайминг) и ISSN 2017/2018; при препаратах — сверяйтесь с врачом.');
  return { slots, notes };
}
