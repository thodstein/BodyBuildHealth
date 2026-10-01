/**
 * strength-sport-season-planner.engine.ts — ПРОФЕССИОНАЛЬНЫЙ ПЛАНИРОВЩИК СЕЗОНА ТА/стронга.
 *
 * Задача: собрать сезон (макроцикл) из блоков, а не «просто год из циклов».
 * Планировщик:
 *  1) выбирает пресет сезона по цели/уровню/дате старта;
 *  2) раскладывает фазы (GPP → база → наращивание → пик → тейпер → переход);
 *  3) подбирает под каждую фазу лучший цикл реестра (уровень/период/длина/снаряды/
 *     возрастные гейты), с честной пометкой фолбэков;
 *  4) собирает AnnualSS через buildAnnualFromSSCycles (кросс-мезо прогрессия ПМ);
 *  5) валидирует методику: порядок фаз, тейпер к старту, отсутствие двух пиков
 *     подряд без перехода, каденция делодов, длину сезона.
 *
 * Источники порядка фаз: классический блоковый макроцикл ТА (GPP → база →
 * интенсивность → пик → тейпер), Issurin (блоки 3-6 нед), Winwood/Sports Med
 * (тейпер 1-2 нед), Helms (делоды каждые 4-8 нед).
 *
 * Чистые функции (без localStorage) — персист/UI отдельно.
 */
import { SS_CYCLES } from '../../data/ss-cycles/ss-cycle-index';
import type { SSCycleMode, SSCycleTemplate } from '../../data/ss-cycles/ss-types';
import { buildAnnualFromSSCycles } from './strength-sport-ss-annual.engine';
import type { AnnualSS } from './strength-sport-annual';
import type { StrengthSportInput } from './strength-sport.types';
import { shiftIsoDate, localIsoDate } from '../../core/local-date';

// ——— Фазы сезона ———
export type SSSeasonPhase = 'gpp' | 'base' | 'build' | 'peak' | 'taper' | 'transition';

export const SEASON_PHASE_META: Record<SSSeasonPhase, { label: string; short: string; color: string; desc: string }> = {
  gpp: { label: 'GPP / межсезонье', short: 'GPP', color: '#30d158', desc: 'Общая подготовка: масса и работоспособность' },
  base: { label: 'База', short: 'База', color: '#0a84ff', desc: 'Техника/объём, фундамент силы' },
  build: { label: 'Наращивание', short: 'Наращ.', color: '#f59e0b', desc: 'Интенсивность и силовая работа' },
  peak: { label: 'Пик', short: 'Пик', color: '#ef4444', desc: 'Максимальные проценты, свежесть' },
  taper: { label: 'Тейпер', short: 'Тейп.', color: '#c084fc', desc: 'Сброс объёма, сохранение интенсивности' },
  transition: { label: 'Переход', short: 'Перех.', color: '#8e8e93', desc: 'Активное восстановление между блоками' },
};

export const SEASON_PHASE_ORDER: SSSeasonPhase[] = ['gpp', 'base', 'build', 'peak', 'taper', 'transition'];

// ——— Пресеты сезона ———
export type SSSeasonPresetId =
  | 'single_peak'
  | 'double_peak'
  | 'comp_prep'
  | 'beginner_year'
  | 'off_season_strength'
  | 'event_specialization';

export interface SSSeasonPresetPhase {
  phase: SSSeasonPhase;
  /** Вес недель пресета (масштабируется под горизонт пользователя). */
  weight: number;
  label: string;
}

export interface SSSeasonPreset {
  id: SSSeasonPresetId;
  label: string;
  desc: string;
  /** 'any' = подходит для ТА/стронга/гибрида. */
  modes: Array<SSCycleMode | 'any'>;
  phases: SSSeasonPresetPhase[];
  minLevel?: 'beginner' | 'intermediate' | 'advanced';
  needsCompetitionDate?: boolean;
}

export const SEASON_PRESETS: SSSeasonPreset[] = [
  {
    id: 'single_peak',
    label: '🏁 Один пик к старту',
    desc: 'GPP → база → наращивание → пик → тейпер. Классический сезон под одно соревнование (тейпер последним блоком).',
    modes: ['any'],
    phases: [
      { phase: 'gpp', weight: 3, label: 'Общая подготовка' },
      { phase: 'base', weight: 4, label: 'База' },
      { phase: 'build', weight: 4, label: 'Наращивание' },
      { phase: 'peak', weight: 3, label: 'Пик' },
      { phase: 'taper', weight: 2, label: 'Тейпер' },
    ],
  },
  {
    id: 'comp_prep',
    label: '📚 Предсоревновательный блок',
    desc: 'База → наращивание → пик → тейпер. Когда до старта 8–14 недель, без межсезонья.',
    modes: ['any'],
    needsCompetitionDate: true,
    phases: [
      { phase: 'base', weight: 4, label: 'База' },
      { phase: 'build', weight: 4, label: 'Наращивание' },
      { phase: 'peak', weight: 3, label: 'Пик' },
      { phase: 'taper', weight: 2, label: 'Тейпер' },
    ],
  },
  {
    id: 'double_peak',
    label: '🏁🏁 Два пика за сезон',
    desc: 'Два соревновательных пика с переходом между ними (отбор → главный старт).',
    modes: ['any'],
    phases: [
      { phase: 'gpp', weight: 3, label: 'Общая подготовка' },
      { phase: 'base', weight: 4, label: 'База 1' },
      { phase: 'build', weight: 3, label: 'Наращивание 1' },
      { phase: 'peak', weight: 3, label: 'Пик 1' },
      { phase: 'transition', weight: 2, label: 'Переход' },
      { phase: 'build', weight: 3, label: 'Наращивание 2' },
      { phase: 'peak', weight: 3, label: 'Пик 2' },
      { phase: 'taper', weight: 1, label: 'Тейпер' },
    ],
  },
  {
    id: 'beginner_year',
    label: '🌱 Первый год (новичок)',
    desc: 'Техника и база → GPP → наращивание → пик. Без daily-max, безопасная прогрессия.',
    modes: ['any'],
    minLevel: 'beginner',
    phases: [
      { phase: 'base', weight: 6, label: 'Техника и база' },
      { phase: 'gpp', weight: 4, label: 'GPP' },
      { phase: 'build', weight: 4, label: 'Наращивание' },
      { phase: 'peak', weight: 4, label: 'Пик' },
      { phase: 'transition', weight: 2, label: 'Переход' },
    ],
  },
  {
    id: 'off_season_strength',
    label: '🧱 Межсезонье — сила',
    desc: 'GPP → база → силовая работа → пик силы. Без старта, набор базы и массы.',
    modes: ['any'],
    phases: [
      { phase: 'gpp', weight: 4, label: 'GPP' },
      { phase: 'base', weight: 5, label: 'База' },
      { phase: 'build', weight: 5, label: 'Силовая работа' },
      { phase: 'peak', weight: 3, label: 'Пик силы' },
      { phase: 'transition', weight: 2, label: 'Переход' },
    ],
  },
  {
    id: 'event_specialization',
    label: '🎪 Специализация ивентов',
    desc: 'База → наращивание → пик ивентов → тейпер. Под слабые дисциплины стронга.',
    modes: ['strongman', 'hybrid'],
    phases: [
      { phase: 'base', weight: 4, label: 'База' },
      { phase: 'build', weight: 4, label: 'Наращивание' },
      { phase: 'peak', weight: 4, label: 'Пик ивентов' },
      { phase: 'taper', weight: 2, label: 'Тейпер' },
    ],
  },
];

export function getSeasonPreset(id: string): SSSeasonPreset | undefined {
  return SEASON_PRESETS.find((p) => p.id === id);
}

export function seasonPresetsFor(mode: string): SSSeasonPreset[] {
  return SEASON_PRESETS.filter((p) => p.modes.includes('any') || p.modes.includes(mode as SSCycleMode));
}

// ——— Фаза цикла → фаза сезона ———
export function cycleSeasonPhase(t: SSCycleTemplate): SSSeasonPhase {
  const m = t.meta;
  const tags = (m.tags || []).map((s) => s.toLowerCase());
  // Явные теги — приоритетнее эвристик по длине/периоду.
  // «taper» тег означает тейпер-цикл ТОЛЬКО если он короткий (≤3 нед):
  // у пиковых 4-нед/12-нед блоков тег taper = «внутри есть тейпер-неделя».
  if (tags.includes('taper') && m.weeks <= 3) return 'taper';
  if (tags.includes('transition') || /transit/i.test(m.id)) return 'transition';
  if (tags.includes('gpp') || tags.includes('off-season')) return 'gpp';
  if (m.weeks <= 2) return 'transition';
  if (m.period === 'base') return 'base';
  if (m.period === 'build') return 'build';
  if (m.period === 'peak') return 'peak';
  return 'build'; // mixed
}

/** Режим цикла для сезона: гибридные — только для hybrid; transition-циклы нейтральны (работают в любом режиме). */
function modeOk(t: SSCycleTemplate, mode: SSCycleMode, phase?: SSSeasonPhase): boolean {
  if (mode === 'hybrid') return true;
  if (t.meta.mode === mode) return true;
  // Короткие переходные циклы — режим-нейтральные (активное восстановление)
  if (phase === 'transition' && cycleSeasonPhase(t) === 'transition') return true;
  return false;
}

// ——— Вход планировщика ———
export interface SSSeasonInput {
  mode: SSCycleMode;
  level: string;
  /** Желаемый горизонт сезона (нед). Итог может отличаться — берётся сумма длин циклов. */
  weeks?: number;
  daysPerWeek: number;
  goal?: string;
  competitionDate?: string;
  /** Есть ли спец-снаряды (лог/йок/камни). Пусто/undefined = есть всё. */
  equipment?: string[];
  age?: number;
  /** Явный пресет (иначе подбирается по цели/уровню). */
  presetId?: SSSeasonPresetId | string;
  cycleConsent?: boolean;
  weakPoints?: string[];
  /**
   * Начало плана (календарная дата). Вместе с `competitionDate` включает
   * планирование ОТ ДАТЫ СТАРТА: горизонт = недель до старта, а короткое окно
   * (4-16 нед) переключает сезон на соревновательный блок `comp_prep`.
   */
  startDate?: string;
}

export interface SSSeasonBlockPlan {
  phase: SSSeasonPhase;
  cycleId: string;
  weeks: number;
  title: string;
  /** Сколько недель хотелось по пресету (для честной пометки расхождения). */
  targetWeeks: number;
  note: string;
}

export interface SSSeasonPlan {
  presetId: SSSeasonPresetId;
  presetLabel: string;
  mode: SSCycleMode;
  totalWeeks: number;
  requestedWeeks: number;
  blocks: SSSeasonBlockPlan[];
  rationale: string[];
  warnings: string[];
  /** Сигнатура входов, из которых собран сезон — UI ловит «настройки изменились». */
  inputSig?: string;
}

/** Детерминированная сигнатура входов планировщика (для stale-детекта в UI). */
export function seasonInputSignature(input: SSSeasonInput): string {
  return JSON.stringify({
    mode: input.mode,
    level: input.level,
    weeks: input.weeks ?? null,
    days: input.daysPerWeek,
    goal: input.goal || '',
    comp: input.competitionDate || '',
    start: input.startDate || '',
    eq: [...(input.equipment || [])].map((s) => String(s).toLowerCase()).sort(),
    age: input.age ?? null,
    preset: input.presetId || '',
    wp: [...(input.weakPoints || [])].map(String).sort(),
  });
}

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, enhanced: 3 };

function hasSpecialty(equipment?: string[]): boolean {
  if (!equipment || equipment.length === 0) return true;
  const eq = equipment.map((s) => String(s).toLowerCase());
  return eq.includes('other') || eq.includes('specialty');
}

/** Скоринг цикла под фазу сезона: период/уровень/длина/снаряды/возраст. */
export function rankCyclesForSeasonPhase(
  mode: SSCycleMode,
  phase: SSSeasonPhase,
  opts: { level: string; targetWeeks: number; equipment?: string[]; age?: number; cycleConsent?: boolean; daysPerWeek?: number; weakPoints?: string[]; goal?: string },
): Array<{ cycle: SSCycleTemplate; score: number; reasons: string[]; blocked?: string }> {
  const specialty = hasSpecialty(opts.equipment);
  const lvl = LEVEL_RANK[opts.level] ?? 1;
  const out: Array<{ cycle: SSCycleTemplate; score: number; reasons: string[]; blocked?: string }> = [];
  for (const t of SS_CYCLES) {
    if (!modeOk(t, mode, phase)) continue;
    const m = t.meta;
    const reasons: string[] = [];
    let score = 50;
    // Свой режим приоритетнее: ТА-сезон берёт ТА-циклы, стронг — стронговые,
    // а гибридный сезон — гибридные (штанга + ивенты в одном блоке).
    if (t.meta.mode === mode) { score += 10; reasons.push('свой режим +10'); }
    else if (mode === 'hybrid' && t.meta.mode === 'hybrid') { score += 8; reasons.push('гибридный цикл +8'); }
    // Фаза
    const cp = cycleSeasonPhase(t);
    if (cp === phase) { score += 30; reasons.push(`фаза ${phase} совпала +30`); }
    // Профессиональные ограничения длительности фаз-обёрток:
    // тейпер — только тейпер-цикл (≤4 нед, интенсивность сохранена),
    // переход — только короткий режим-нейтральный цикл (≤3 нед).
    if (phase === 'taper') {
      const isTaper = cp === 'taper' && m.weeks <= 4;
      if (isTaper) { score += 50; reasons.push('тейпер-цикл +50'); }
      else { score -= 70; reasons.push('не тейпер-цикл −70'); }
    }
    if (phase === 'transition') {
      const isTransit = cp === 'transition' && m.weeks <= 3;
      if (isTransit) { score += 50; reasons.push('переходный цикл +50'); }
      else { score -= 70; reasons.push('не переходный цикл −70'); }
    }
    if (phase === 'peak') {
      // Пик — именно пиковый блок; тейпер-цикл здесь недопустим,
      // пиковый с тейпером/mock внутри — идеален.
      if (cp === 'peak') score += 20;
      if (cp === 'taper') { score -= 40; reasons.push('тейпер-цикл не «пик» −40'); }
      if (m.taperWeeks?.length || m.mockWeeks?.length) { score += 10; reasons.push('пик с тейпером/mock +10'); }
    }
    if (cp !== phase) {
      // Соседние фазы допустимы (base↔build↔peak), переход — только короткие
      const ci = SEASON_PHASE_ORDER.indexOf(cp);
      const pi = SEASON_PHASE_ORDER.indexOf(phase);
      const dist = Math.abs(ci - pi);
      score -= dist * 18;
      reasons.push(`фаза ${cp} vs ${phase} −${dist * 18}`);
    }
    // Уровень. Цикл, который СЛОЖНЕЕ пользователя, штрафуется жёстко
    // (новичку не ставим intermediate-only спец-блоки); проще — мягкий штраф.
    if (m.level.includes(opts.level as any)) { score += 25; reasons.push('уровень совпал +25'); }
    else {
      const minCycle = Math.min(...m.level.map((l) => LEVEL_RANK[l] ?? 1));
      if (minCycle > lvl) { score -= 35; reasons.push(`цикл сложнее (${m.level.join('/')}) −35`); }
      else { score -= 6; reasons.push(`цикл проще (${m.level.join('/')}) −6`); }
    }
    // Длина блока
    const dLen = Math.abs(m.weeks - opts.targetWeeks);
    score -= dLen * 4;
    if (dLen === 0) reasons.push('длина 1-в-1 +0/-0');
    // Дни/нед (вилка)
    if (opts.daysPerWeek) {
      const lo = m.sessionsPerWeek;
      const hi = m.sessionsPerWeekMax ?? m.sessionsPerWeek;
      if (opts.daysPerWeek < lo || opts.daysPerWeek > hi) {
        const dd = Math.min(Math.abs(lo - opts.daysPerWeek), Math.abs(hi - opts.daysPerWeek));
        score -= Math.min(20, dd * 8);
        reasons.push(`дни ${lo}${hi !== lo ? `→${hi}` : ''} vs ${opts.daysPerWeek} −${Math.min(20, dd * 8)}`);
      }
    }
    // Снаряды
    if (m.needsSpecialty && !specialty) { score -= 12; reasons.push('без снарядов −12 (фолбэк)'); }
    // Возраст
    if ((opts.age ?? 0) >= 50 && m.bulgarian) { out.push({ cycle: t, score: -1000, reasons, blocked: 'daily-max запрещён 50+' }); continue; }
    if ((opts.age ?? 0) >= 40 && m.sessionsPerWeek >= 6) { score -= 14; reasons.push('40+: 6д/нед −14'); }
    // Болгарский гейт
    if (m.bulgarian) {
      if (lvl < 2) { out.push({ cycle: t, score: -1000, reasons, blocked: 'daily-max только advanced+' }); continue; }
      if (!opts.cycleConsent) { out.push({ cycle: t, score: -1000, reasons, blocked: 'daily-max — нужно согласие' }); continue; }
    }
    // Цель
    if (opts.goal === 'technique' && (m.tags || []).includes('technique')) { score += 12; reasons.push('техника: техничный цикл +12'); }
    if (opts.goal === 'hypertrophy' && (m.tags || []).some((x) => ['gpp', 'hypertrophy', 'mass'].includes(x))) { score += 12; reasons.push('масса: GPP/гипертрофия +12'); }
    if (opts.goal === 'peaking' && phase === 'peak' && (m.taperWeeks?.length || m.mockWeeks?.length)) { score += 10; reasons.push('пик: тейпер/mock +10'); }
    // Слабые точки (токены) — как в селекторе
    if (opts.weakPoints?.length) {
      const ids: string[] = [];
      try { for (const wk of t.weeks) for (const d of wk) for (const e of d.exercises) ids.push(String(e.id).toLowerCase()); } catch { /* пусто */ }
      const toks = opts.weakPoints.flatMap((w) => String(w).toLowerCase().split(/[^a-zа-яё]+/)).filter((x) => x.length > 2);
      const hit = toks.filter((tk) => ids.some((id) => id.includes(tk) || tk.includes(id))).length;
      if (hit > 0) { score += Math.min(14, hit * 7); reasons.push(`слабые покрыты ${hit} +${Math.min(14, hit * 7)}`); }
    }
    out.push({ cycle: t, score, reasons });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export function pickCycleForSeasonPhase(
  mode: SSCycleMode,
  phase: SSSeasonPhase,
  opts: Parameters<typeof rankCyclesForSeasonPhase>[2] & { exclude?: string[] },
): SSCycleTemplate | null {
  const ranked = rankCyclesForSeasonPhase(mode, phase, opts).filter((r) => !r.blocked);
  const exclude = opts.exclude || [];
  const fresh = (list: typeof ranked) => list.filter((r) => !exclude.includes(r.cycle.meta.id));
  // Приоритет: уровень-совпал+свежий → уровень-совпал → свежий → любой
  const levelExact = ranked.filter((r) => r.cycle.meta.level.includes(opts.level as any));
  const pick = fresh(levelExact)[0] || levelExact[0] || fresh(ranked)[0] || ranked[0];
  return pick?.cycle || null;
}

// ——— Подбор пресета ———
export function recommendSeasonPresetId(input: SSSeasonInput): SSSeasonPresetId {
  if (input.presetId && getSeasonPreset(String(input.presetId))) return input.presetId as SSSeasonPresetId;
  const goal = String(input.goal || '');
  const lvl = LEVEL_RANK[input.level] ?? 1;
  // Новичок — всегда «первый год»: пики/тейперы не ставим даже при дате старта
  if (lvl === 0) return 'beginner_year';
  // Дата старта → сезон «к дате» (тейпер последним блоком)
  if (input.competitionDate) return 'single_peak';
  if (goal === 'peaking') return 'comp_prep';
  if (goal === 'technique') return 'off_season_strength';
  if (goal === 'maintenance') return 'off_season_strength';
  if (goal === 'hypertrophy') return input.mode === 'strongman' ? 'event_specialization' : 'off_season_strength';
  if (input.mode === 'strongman') return 'event_specialization';
  return 'off_season_strength';
}

/** Масштабирование весов пресета под горизонт (мин 1 нед/фаза, тейпер/переход ≥1). */
export function scalePresetPhases(preset: SSSeasonPreset, weeks?: number): Array<SSSeasonPresetPhase & { targetWeeks: number }> {
  const totalW = preset.phases.reduce((a, p) => a + p.weight, 0);
  const target = weeks && weeks > 0 ? Math.round(weeks) : totalW;
  const out: Array<SSSeasonPresetPhase & { targetWeeks: number }> = [];
  for (const p of preset.phases) {
    const raw = (p.weight / totalW) * target;
    let w = Math.max(1, Math.round(raw));
    if (p.phase === 'taper') w = Math.min(2, Math.max(1, Math.round(raw)));
    out.push({ ...p, targetWeeks: w });
  }
  return out;
}

// ——— Главная: рекомендация сезона ———
export function recommendSeasonPlan(input: SSSeasonInput): SSSeasonPlan {
  // Планирование ОТ ДАТЫ: если заданы и дата старта, и дата соревнования —
  // горизонт берётся из календаря (сколько недель реально осталось).
  const dateWeeks = input.competitionDate && input.startDate
    ? weeksUntilDate(input.competitionDate, input.startDate)
    : null;
  const useDateHorizon = dateWeeks != null;
  let presetId = recommendSeasonPresetId(input);
  const lvl = LEVEL_RANK[input.level] ?? 1;
  // Короткое окно (4-16 нед) — это не «год», а соревновательный блок
  if (useDateHorizon && (dateWeeks as number) <= 16 && (dateWeeks as number) >= 1 && lvl > 0 && presetId !== 'comp_prep') {
    presetId = 'comp_prep';
  }
  const preset = getSeasonPreset(presetId) || SEASON_PRESETS[0];
  const presetTotal = preset.phases.reduce((a, p) => a + p.weight, 0);
  let horizon = input.weeks && input.weeks > 0 ? input.weeks : presetTotal;
  const rationale: string[] = [];
  const warnings: string[] = [];
  if (useDateHorizon) {
    const dw = dateWeeks as number;
    horizon = Math.min(52, Math.max(4, dw));
    rationale.push(`📅 Горизонт от даты старта: ${dw} нед (старт ${input.startDate})${dw !== input.weeks ? ' — приоритет у календаря, не у горизонта мастера' : ''}`);
    if (dw <= 0) warnings.push('Дата старта уже прошла — сезон к этой дате не строится, соберите новый блок');
    else if (dw < 8) warnings.push(`До старта ${dw} нед — очень короткое окно: реальный пик требует 8+ нед подготовки (сезон собран best-effort)`);
  }
  const scaled = scalePresetPhases(preset, horizon);
  rationale.push(`🧭 Сезон: ${preset.label} · горизонт ${horizon} нед`);
  if (horizon > 52) warnings.push(`Горизонт ${horizon} нед > 52 — типичный сезон ≤52; рассмотрите два сезона или двухпиковый пресет`);
  if (input.competitionDate) rationale.push(`⚓ Дата старта: ${input.competitionDate} — тейпер ставится в хвост сезона`);
  if (input.competitionDate && lvl === 0) {
    warnings.push('Новичку пик к дате не строится: сезон базовый, дата старта — ориентир, не повод для пикового блока');
  }
  if (!hasSpecialty(input.equipment)) warnings.push('Нет спец-снарядов: циклы с ивентами соберутся с фолбэком (коэффы STRONG_FALLBACK_COEFF, бейдж в плане)');

  const blocks: SSSeasonBlockPlan[] = [];
  const used: string[] = [];
  const pickOpts = (targetWeeks: number) => ({
    level: input.level,
    targetWeeks,
    equipment: input.equipment,
    age: input.age,
    cycleConsent: input.cycleConsent,
    daysPerWeek: input.daysPerWeek,
    weakPoints: input.weakPoints,
    goal: input.goal,
    exclude: used.slice(-1),
  });
  const pushBlock = (phase: SSSeasonPhase, cycle: SSCycleTemplate, targetWeeks: number, label: string) => {
    used.push(cycle.meta.id);
    const dW = cycle.meta.weeks - targetWeeks;
    const note = dW === 0
      ? 'длина 1-в-1'
      : dW > 0
        ? `цикл длиннее плана на ${dW} нед (возьмутся все ${cycle.meta.weeks} нед)`
        : `цикл короче плана на ${Math.abs(dW)} нед (фаза ${cycle.meta.weeks} нед)`;
    if (Math.abs(dW) >= 3) warnings.push(`Фаза «${label}»: ${note}`);
    if (!cycle.meta.level.includes(input.level as any)) {
      warnings.push(`Фаза «${label}»: цикл уровня ${cycle.meta.level.join('/')} при вашем ${input.level} — следите за нагрузкой`);
    }
    blocks.push({ phase, cycleId: cycle.meta.id, weeks: cycle.meta.weeks, title: cycle.meta.title, targetWeeks, note });
  };
  for (const ph of scaled) {
    // Новичку пик/тейпер не ставим: если нет БЕЗОПАСНОГО beginner-цикла именно
    // этой фазы — пропускаем честно (тест-неделя живёт внутри базового блока).
    const strictBeginner = (LEVEL_RANK[input.level] ?? 1) === 0 && (ph.phase === 'peak' || ph.phase === 'taper');
    let cycle: SSCycleTemplate | null;
    if (strictBeginner) {
      const cand = rankCyclesForSeasonPhase(input.mode, ph.phase, pickOpts(ph.targetWeeks))
        .filter((r) => !r.blocked && r.cycle.meta.level.includes('beginner') && cycleSeasonPhase(r.cycle) === ph.phase);
      cycle = cand[0]?.cycle || null;
      if (!cycle) {
        warnings.push(`Фаза «${ph.label}»: новичку пик/тейпер не ставится (нет beginner-цикла фазы) — пропущена, тест-неделя внутри базы`);
        continue;
      }
    } else {
      cycle = pickCycleForSeasonPhase(input.mode, ph.phase, pickOpts(ph.targetWeeks));
    }
    if (!cycle) {
      warnings.push(`Фаза «${ph.label}»: нет подходящего цикла для режима/уровня — пропущена`);
      continue;
    }
    pushBlock(ph.phase, cycle, ph.targetWeeks, ph.label);
  }
  // Мульти-пик: длинный горизонт БЕЗ даты старта добирается повторными
  // build→peak (с переходом) — профессиональный год = 2-3 пика, а не «обрыв».
  let totalWeeks = blocks.reduce((a, b) => a + b.weeks, 0);
  const beginner = (LEVEL_RANK[input.level] ?? 1) === 0;
  const allowFill = !input.competitionDate;
  let peaks = blocks.filter((b) => b.phase === 'peak').length;
  let guard = 0;
  // Добор подбирает цикл, который ФАКТИЧЕСКИ влезает в остаток (≤52 и ≈горизонт)
  const pickFitting = (phase: SSSeasonPhase, targetWeeks: number, maxWeeks: number): SSCycleTemplate | null => {
    const cap = Math.min(maxWeeks, 52 - totalWeeks);
    const cand = rankCyclesForSeasonPhase(input.mode, phase, pickOpts(targetWeeks))
      .filter((r) => !r.blocked && r.cycle.meta.weeks <= cap && !used.slice(-1).includes(r.cycle.meta.id));
    return cand[0]?.cycle || null;
  };
  while (allowFill && horizon - totalWeeks >= 4 && (beginner || peaks < 3) && guard++ < 8) {
    const lastPhase = blocks.length ? blocks[blocks.length - 1].phase : null;
    // Новичок: горизонт добирается базой/GPP + переход (без пиков — тест-недели
    // живут внутри базовых блоков). Профессионально: первый год — объём и техника.
    if (beginner) {
      if (lastPhase !== 'transition') {
        const tr = pickFitting('transition', 2, 3);
        if (tr) { pushBlock('transition', tr, 2, 'Переход (добор)'); totalWeeks += tr.meta.weeks; continue; }
      }
      const ph2: SSSeasonPhase = lastPhase === 'base' ? 'gpp' : 'base';
      const c = pickFitting(ph2, 8, 10);
      if (!c) break;
      pushBlock(ph2, c, 8, ph2 === 'gpp' ? 'GPP (добор)' : 'База (добор)');
      totalWeeks += c.meta.weeks;
      continue;
    }
    if (lastPhase !== 'transition') {
      const tr = pickFitting('transition', 2, 3);
      if (tr) { pushBlock('transition', tr, 2, 'Переход (добор)'); totalWeeks += tr.meta.weeks; }
    }
    const pk = pickFitting('peak', 8, 12) || pickFitting('peak', 4, 6) || pickFitting('peak', 2, 3);
    if (!pk) break;
    if (horizon - totalWeeks - pk.meta.weeks >= 4) {
      const bld = pickFitting('build', 8, 12) || pickFitting('build', 6, 8);
      if (bld) { pushBlock('build', bld, 8, 'Наращивание (добор)'); totalWeeks += bld.meta.weeks; }
    }
    pushBlock('peak', pk, 8, 'Пик (добор)');
    totalWeeks += pk.meta.weeks;
    peaks++;
    rationale.push(`🔁 Мульти-пик: добавлен пиковый блок (${pk.meta.title}) под горизонт`);
  }
  if (!blocks.length) warnings.push('Сезон не собран: ни один блок не подобран — проверьте режим/уровень');
  if (totalWeeks > 52) warnings.push(`Сезон ${totalWeeks} нед > 52 — урежьте горизонт или разбейте на два сезона`);
  if (blocks.length && horizon - totalWeeks >= 4) {
    warnings.push(`Горизонт ${horizon} нед, сезон ${totalWeeks} нед: не хватило валидных циклов — добавьте блок вручную или выберите пресет «Два пика»`);
  }
  if (blocks.length && totalWeeks - horizon >= 4) {
    warnings.push(`Сезон ${totalWeeks} нед длиннее окна ${horizon} нед на ${totalWeeks - horizon}: старт не помещается — уберите блок или возьмите короткие циклы (тейпер-2/пик-4)`);
  }
  if (totalWeeks !== horizon && blocks.length) rationale.push(`Итог ${totalWeeks} нед (сумма длин циклов; расхождение с горизонтом — честное)`);

  // Возрастные/уровневые заметки
  if ((input.age ?? 0) >= 40) rationale.push('Masters 40+: 6-дневные циклы штрафуются при подборе, daily-max исключён');
  if ((LEVEL_RANK[input.level] ?? 1) === 0) rationale.push('Новичок: daily-max-циклы исключены подбором');

  return { presetId, presetLabel: preset.label, mode: input.mode, totalWeeks, requestedWeeks: horizon, blocks, rationale, warnings, inputSig: seasonInputSignature(input) };
}

// ——— Сборка сезона ———
export function buildSeasonPlan(
  plan: SSSeasonPlan,
  baseInput: StrengthSportInput,
  opts?: { cycleMode?: 'faithful' | 'adapt'; competitionDate?: string; taperWeeks?: number; progressBetweenBlocks?: boolean },
): AnnualSS {
  if (!plan.blocks.length) throw new Error('Сезон пуст — нет блоков для сборки');
  const annual = buildAnnualFromSSCycles(
    plan.blocks.map((b) => b.cycleId),
    { ...baseInput, mode: baseInput.mode || plan.mode } as StrengthSportInput,
    {
      cycleMode: opts?.cycleMode || 'faithful',
      competitionDate: opts?.competitionDate || baseInput.competitionDate || undefined,
      taperWeeks: opts?.taperWeeks ?? 1,
      progressBetweenBlocks: opts?.progressBetweenBlocks ?? true,
    },
  );
  annual.rationale = [...plan.rationale];
  return annual;
}

// ——— Валидация методики сезона (по плану блоков) ———
export function validateSeasonPeriodization(plan: SSSeasonPlan): { ok: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const phases = plan.blocks.map((b) => b.phase);
  if (!phases.length) return { ok: false, warnings, errors: ['Сезон без блоков'] };
  const firstPeak = phases.indexOf('peak');
  // 1) Пик должен иметь наращивание до него
  if (firstPeak >= 0 && !phases.slice(0, firstPeak).includes('build') && !phases.slice(0, firstPeak).includes('base')) {
    warnings.push('Пик без базы/наращивания перед ним — риск недоподготовки');
  }
  // 2) Два пика подряд без перехода
  for (let i = 1; i < phases.length; i++) {
    if (phases[i] === 'peak' && phases[i - 1] === 'peak') warnings.push(`Блоки ${i} и ${i + 1}: два пика подряд без перехода`);
  }
  // 3) Тейпер в хвосте (последний или предпоследний с переходом)
  if (phases.includes('taper')) {
    const lastTaper = phases.lastIndexOf('taper');
    const after = phases.slice(lastTaper + 1);
    if (after.length > 1 && !(after.length === 1 && after[0] === 'transition')) {
      warnings.push('Тейпер не в хвосте сезона — пик может смазаться');
    }
  }
  // 3a) Длительности фаз-обёрток: тейпер 1-2 нед, переход до 4 нед
  for (const b of plan.blocks) {
    if (b.phase === 'taper' && b.weeks > 2) warnings.push(`Тейпер ${b.weeks} нед (${b.title}) — должен быть 1-2 нед (объём ↓, интенсивность сохранена)`);
    if (b.phase === 'transition' && b.weeks > 4) warnings.push(`Переход ${b.weeks} нед (${b.title}) — должен быть коротким (≤4 нед)`);
  }
  // 3b) Мульти-пик не более 3 (иначе «вечный пик»)
  const peakCount = phases.filter((p) => p === 'peak').length;
  if (peakCount > 3) warnings.push(`${peakCount} пиковых блоков — не более 3 на сезон (перетренированность)`);
  // 4) Каденция делодов: в длинных фазах >8 нед без делод-недели
  //    (мета-циклы уже несут свои делоды; здесь проверяем фазу целиком)
  let longRun: string[] = [];
  for (let i = 0; i < plan.blocks.length; i++) {
    const b = plan.blocks[i];
    longRun.push(b.cycleId);
    if (b.weeks >= 4 || i === plan.blocks.length - 1) {
      if (longRun.length >= 3) {
        warnings.push(`3+ блока подряд без короткого перехода (${longRun.join(' → ')}) — добавьте переход`);
      }
      longRun = [];
    }
  }
  // 5) Общая длина
  if (plan.totalWeeks > 52) warnings.push(`Сезон ${plan.totalWeeks} нед > 52 — урежьте горизонт`);
  if (plan.totalWeeks < 4) warnings.push('Сезон короче 4 нед — это не макроцикл, соберите блок отдельно');
  return { ok: errors.length === 0, warnings, errors };
}

// ——— Таймлайн ———
export interface SSSeasonTimelineRow {
  index: number;
  phase: SSSeasonPhase;
  phaseLabel: string;
  color: string;
  title: string;
  cycleId: string;
  mode: string;
  startWeek: number;
  weeks: number;
  status: string;
  competitionDate?: string;
  taperWeeks?: number;
  mockWeeks?: number[];
}

export function seasonTimeline(annual: AnnualSS): SSSeasonTimelineRow[] {
  const rows: SSSeasonTimelineRow[] = [];
  const blocks = Array.isArray(annual?.blocks) ? annual.blocks : [];
  blocks.forEach((b, i) => {
    const plan = b.plan;
    const cycle = plan?.inputSnapshot?.cycleId as string | undefined;
    const t = cycle ? SS_CYCLES.find((c) => c.meta.id === cycle) : undefined;
    const phase: SSSeasonPhase = t ? cycleSeasonPhase(t) : (b.weeks <= 2 ? 'transition' : 'build');
    const meta = SEASON_PHASE_META[phase];
    rows.push({
      index: i + 1,
      phase,
      phaseLabel: meta.label,
      color: meta.color,
      title: t?.meta.title || `Блок ${i + 1}`,
      cycleId: cycle || b.mode,
      mode: b.mode,
      startWeek: b.startWeek,
      weeks: b.weeks,
      status: b.status,
      competitionDate: b.competitionDate,
      taperWeeks: b.taperWeeks,
      mockWeeks: t?.meta.mockWeeks,
    });
  });
  return rows;
}

/** Итоговая сводка сезона для UI/печати (фазы/недели/циклы). */
export function seasonSummaryLines(plan: SSSeasonPlan): string[] {
  const lines: string[] = [];
  let start = 1;
  for (const b of plan.blocks) {
    const end = start + b.weeks - 1;
    lines.push(`Нед ${start}–${end} · ${SEASON_PHASE_META[b.phase].label} · ${b.title}`);
    start = end + 1;
  }
  return lines;
}

/** ISO-день → UTC-полночь (для арифметики дней без сдвига часового пояса). */
function isoDayToUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

/** Целые дни между двумя календарными датами (UTC-безопасно). */
export function dayDiffIso(fromIso: string, toIso: string): number | null {
  const a = isoDayToUtc(fromIso);
  const b = isoDayToUtc(toIso);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86400000);
}

/** Сколько недель до даты старта (локально, без UTC-сдвига дня). */
export function weeksUntilDate(competitionDate: string, fromDate?: string): number | null {
  const diff = dayDiffIso(fromDate || localIsoDate(), competitionDate);
  return diff == null ? null : Math.round(diff / 7);
}

// ——— «Где я в сезоне» ———
export interface SSActiveSeasonBlock {
  blockIndex: number; // 0-based
  week: number; // сквозная неделя сезона (1-based)
  weekInBlock: number;
  totalWeeks: number;
  phase: SSSeasonPhase;
  phaseLabel: string;
  color: string;
  title: string;
  cycleId: string;
  isDeloadWeek: boolean;
  isTaperWeek: boolean;
  isMockWeek: boolean;
}

/**
 * Активный блок сезона на дату (или «сегодня»). Дата старта — из аргумента,
 * из первого блока (inputSnapshot.startDate) или сегодня. Вне сезона — null.
 */
export function activeSeasonBlockForDate(
  annual: AnnualSS,
  dateISO?: string,
  opts?: { startDate?: string },
): SSActiveSeasonBlock | null {
  try {
    if (!annual || !Array.isArray(annual.blocks) || !annual.blocks.length) return null;
    const snap = (annual.blocks[0] as any)?.plan?.inputSnapshot?.startDate as string | undefined;
    const start = String(opts?.startDate || snap || '').slice(0, 10);
    if (!isoDayToUtc(start)) return null;
    const target = String(dateISO || localIsoDate()).slice(0, 10);
    const days = dayDiffIso(start, target);
    if (days == null || days < 0) return null;
    const week = Math.floor(days / 7) + 1;
    if (week > annual.totalWeeks) return null;
    let w = 1;
    for (let i = 0; i < annual.blocks.length; i++) {
      const b = annual.blocks[i];
      if (week < w + b.weeks) {
        const weekInBlock = week - w + 1;
        const cid = b.plan?.inputSnapshot?.cycleId as string | undefined;
        const t = cid ? SS_CYCLES.find((c) => c.meta.id === cid) : undefined;
        const phase: SSSeasonPhase = t ? cycleSeasonPhase(t) : (b.weeks <= 2 ? 'transition' : 'build');
        const meta = SEASON_PHASE_META[phase];
        const wd: any = b.plan?.weeksData?.[weekInBlock - 1];
        return {
          blockIndex: i,
          week,
          weekInBlock,
          totalWeeks: annual.totalWeeks,
          phase,
          phaseLabel: meta.label,
          color: meta.color,
          title: t?.meta.title || `Блок ${i + 1}`,
          cycleId: cid || b.mode,
          isDeloadWeek: !!wd?.deload,
          isTaperWeek: !!wd?.taper,
          isMockWeek: !!(t?.meta.mockWeeks || []).includes(weekInBlock),
        };
      }
      w += b.weeks;
    }
    return null;
  } catch { return null; }
}

// ——— Визуальный таймлайн (по плану сезона, без AnnualSS) ———
export interface SSSeasonWeekCell {
  week: number; // сквозная 1..totalWeeks
  blockIndex: number;
  phase: SSSeasonPhase;
  phaseLabel: string;
  color: string;
  short: string;
  title: string;
  cycleId: string;
  /** Первая неделя блока (для подписи/тултипа). */
  blockStart: boolean;
}

/** Ячейка на каждую неделю сезона — фаза-цвет, для Gantt/полосы. */
export function seasonPlanWeekCells(plan: SSSeasonPlan): SSSeasonWeekCell[] {
  const out: SSSeasonWeekCell[] = [];
  let week = 1;
  plan.blocks.forEach((b, bi) => {
    const meta = SEASON_PHASE_META[b.phase];
    for (let i = 0; i < b.weeks; i++) {
      out.push({
        week,
        blockIndex: bi,
        phase: b.phase,
        phaseLabel: meta.label,
        color: meta.color,
        short: meta.short,
        title: b.title,
        cycleId: b.cycleId,
        blockStart: i === 0,
      });
      week++;
    }
  });
  return out;
}

/** Текстовая сводка сезона (для буфера/тренера/тоста). */
export function buildSeasonSummaryText(plan: SSSeasonPlan, opts?: { modeLabel?: string; competitionDate?: string }): string {
  const lines: string[] = [];
  lines.push(`СЕЗОН · ${plan.presetLabel}${opts?.modeLabel ? ` · ${opts.modeLabel}` : ''}`);
  lines.push(`Горизонт ${plan.requestedWeeks} нед · собрано ${plan.totalWeeks} нед · блоков ${plan.blocks.length}`);
  if (opts?.competitionDate) lines.push(`Старт: ${opts.competitionDate}`);
  lines.push('');
  lines.push('БЛОКИ:');
  lines.push(...seasonSummaryLines(plan).map((l) => `  ${l}`));
  if (plan.rationale.length) {
    lines.push('');
    lines.push('ОБОСНОВАНИЕ:');
    lines.push(...plan.rationale.map((r) => `  ${r}`));
  }
  if (plan.warnings.length) {
    lines.push('');
    lines.push('ПРЕДУПРЕЖДЕНИЯ:');
    lines.push(...plan.warnings.map((w) => `  ⚠ ${w}`));
  }
  const v = validateSeasonPeriodization(plan);
  if (v.warnings.length) {
    lines.push('');
    lines.push('МЕТОДИЧЕСКАЯ ПРОВЕРКА:');
    lines.push(...v.warnings.map((w) => `  • ${w}`));
  }
  return lines.join('\n');
}

const escH = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Печатная HTML-сводка сезона (все пользовательские строки — escaped). */
export function buildSeasonPrintHtml(plan: SSSeasonPlan, opts?: { modeLabel?: string; competitionDate?: string; startDate?: string }): string {
  const v = validateSeasonPeriodization(plan);
  const rows = seasonPlanWeekCells(plan).map((c) =>
    `<span style="display:inline-block;width:16px;height:22px;margin:1px;border-radius:4px;background:${escH(c.color)}33;border:1px solid ${escH(c.color)}88" title="Нед ${c.week}: ${escH(c.phaseLabel)} — ${escH(c.title)}"></span>`,
  ).join('');
  const blockRows = plan.blocks.map((b, i) => {
    const meta = SEASON_PHASE_META[b.phase];
    return `<tr><td>${i + 1}</td><td style="color:${escH(meta.color)};font-weight:700">${escH(meta.label)}</td><td>${escH(b.title)}</td><td>${b.weeks}</td><td>${escH(b.note)}</td></tr>`;
  }).join('');
  const list = (title: string, items: string[], prefix = '') => items.length
    ? `<h3>${escH(title)}</h3><ul>${items.map((x) => `<li>${prefix}${escH(x)}</li>`).join('')}</ul>`
    : '';
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Сезон ТА/стронг</title>
<style>body{font-family:-apple-system,system-ui,Segoe UI,sans-serif;padding:24px;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:18px}h3{font-size:13px;margin:12px 0 4px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#f0f0f0}.meta{font-size:12px;color:#444}ul{font-size:12px;margin:4px 0 0 18px}</style></head><body>
<h1>🧭 Профессиональный сезон — ${escH(plan.presetLabel)}</h1>
<p class="meta">${escH(opts?.modeLabel || plan.mode)} · горизонт ${plan.requestedWeeks} нед · собрано ${plan.totalWeeks} нед · блоков ${plan.blocks.length}${opts?.startDate ? ` · старт ${escH(opts.startDate)}` : ''}${opts?.competitionDate ? ` · соревнование ${escH(opts.competitionDate)}` : ''}</p>
<h2>Таймлайн</h2><div>${rows}</div>
<h2>Блоки</h2><table><thead><tr><th>№</th><th>Фаза</th><th>Цикл</th><th>Нед</th><th>Примечание</th></tr></thead><tbody>${blockRows}</tbody></table>
${list('Обоснование', plan.rationale)}
${list('Предупреждения', plan.warnings, '⚠ ')}
${list('Методическая проверка', v.warnings, '• ')}
<p class="meta">Дефицит/питание, тейпер и попытки — в карточках блоков. Печать: Ctrl+P.</p>
</body></html>`;
}

// ——— Календарь сезона (.ics) ———
export interface SSSeasonIcsOpts {
  /** Начало плана (обязательно) — неделя 1 сезона. */
  startDate: string;
  competitionDate?: string;
  modeLabel?: string;
  title?: string;
}

const icsEsc = (s: unknown): string => String(s ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (iso: string): string => String(iso).replace(/-/g, '');
const isIsoDay = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

/**
 * Сезонные блоки + соревнование как календарь .ics (all-day события).
 * `null`, если нет валидной даты старта или блоков. Даты — локальный канон.
 */
export function buildSeasonIcs(plan: SSSeasonPlan, opts: SSSeasonIcsOpts): string | null {
  const start = String(opts?.startDate || '').slice(0, 10);
  if (!isIsoDay(start)) return null;
  if (!plan || !Array.isArray(plan.blocks) || !plan.blocks.length) return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = opts.title || `Сезон ТА/стронг: ${plan.presetLabel}${opts.modeLabel ? ` (${opts.modeLabel})` : ''}`;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BioStack//SS-Season//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  let week = 1;
  plan.blocks.forEach((b, i) => {
    const bStart = shiftIsoDate(start, (week - 1) * 7);
    const bEnd = shiftIsoDate(start, (week - 1 + b.weeks) * 7); // DTEND эксклюзивный
    const meta = SEASON_PHASE_META[b.phase];
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:ss-season-${i}-${icsDate(bStart)}@biostack`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(bStart)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(bEnd)}`);
    lines.push(`SUMMARY:${icsEsc(`${meta.short} · ${b.title}`)}`);
    lines.push(`DESCRIPTION:${icsEsc(`${title}. Нед ${week}–${week + b.weeks - 1}. ${b.note}`)}`);
    lines.push('END:VEVENT');
    week += b.weeks;
  });
  const comp = String(opts.competitionDate || '').slice(0, 10);
  if (isIsoDay(comp)) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:ss-season-comp-${icsDate(comp)}@biostack`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(comp)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(shiftIsoDate(comp, 1))}`);
    lines.push('SUMMARY:🏁 Соревнование');
    lines.push(`DESCRIPTION:${icsEsc(title)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ——— Персист сезона ———
export const SS_SEASON_PLAN_KEY = 'he_ss_season_plan_v1';

function isSeasonPlanShape(x: unknown): x is SSSeasonPlan {
  if (!x || typeof x !== 'object') return false;
  const p = x as SSSeasonPlan;
  if (typeof p.presetId !== 'string' || typeof p.mode !== 'string') return false;
  if (!Array.isArray(p.blocks) || !p.blocks.length) return false;
  for (const b of p.blocks) {
    if (!b || typeof b !== 'object') return false;
    if (typeof b.cycleId !== 'string' || typeof b.phase !== 'string') return false;
    if (!Number.isFinite(b.weeks) || b.weeks < 1) return false;
    if (!SEASON_PHASE_META[b.phase as SSSeasonPhase]) return false;
  }
  return Number.isFinite(p.totalWeeks) && p.totalWeeks > 0;
}

export function saveSeasonPlan(plan: SSSeasonPlan): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (!isSeasonPlanShape(plan)) return false;
    localStorage.setItem(SS_SEASON_PLAN_KEY, JSON.stringify(plan));
    return true;
  } catch { return false; }
}

export function loadSeasonPlan(): SSSeasonPlan | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SS_SEASON_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSeasonPlanShape(parsed) ? parsed : null;
  } catch { return null; }
}

export function clearSeasonPlan(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(SS_SEASON_PLAN_KEY); } catch { /* quota/ssr */ }
}
