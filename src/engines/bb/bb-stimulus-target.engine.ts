/**
 * bb-stimulus-target.engine.ts — «стимул в цель», а не «вес поднят» (MAX PRO пилот: руки + дельты).
 *
 * Отвечает на вопрос: насколько нагрузка упражнения доходит до целевой мышцы/головки.
 * Канон функции мышцы — TARGET_MUSCLE_DB (анатомия/mmc), канон упражнения — EXERCISE_CATALOG.
 * Здесь только связка: головки, сетап-чеклист, линия сопротивления, читинг-карта, RIR-норма, ROM-норма.
 * Чистые функции, без мутаций. ESM-safe (статические импорты).
 */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export type StimulusFlag =
  | 'wrongHead'
  | 'setupRisk'
  | 'resistanceLineGap'
  | 'romShort'
  | 'stabilityGap'
  | 'rirMismatch'
  | 'synergistTakeover';

export interface HeadFunction {
  head: string; // 'triceps_long'
  muscle: string; // 'triceps'
  label: string; // 'Длинная головка трицепса'
  stretchCondition: string; // когда головка растянута
  loadedBy: string[]; // имена-ориентиры упражнений
}

/** Функции головок пилота (сверено с TARGET_MUSCLE_DB + bb-labels). */
export const HEAD_FUNCTIONS: Record<string, HeadFunction> = {
  triceps_long: {
    head: 'triceps_long', muscle: 'triceps', label: 'Длинная головка трицепса (масса)',
    stretchCondition: 'Плечо согнуто — руки над головой / за головой',
    loadedBy: ['Французский жим', 'Разгибания из-за головы', 'Overhead'],
  },
  triceps_lateral: {
    head: 'triceps_lateral', muscle: 'triceps', label: 'Латеральная головка трицепса',
    stretchCondition: 'Нагружается в любом разгибании локтя; пик — в сокращённой',
    loadedBy: ['Разгибание на блоке', 'Кикбэк', 'Жим узким'],
  },
  biceps_long: {
    head: 'biceps_long', muscle: 'biceps', label: 'Длинная головка бицепса (пик)',
    stretchCondition: 'Плечо сзади корпуса — руки висят (наклонная скамья) + супинация',
    loadedBy: ['Наклонная скамья', 'Байесовское сгибание', 'Драг-сгибание'],
  },
  biceps_short: {
    head: 'biceps_short', muscle: 'biceps', label: 'Короткая головка бицепса',
    stretchCondition: 'Локоть впереди корпуса — Скамья Скотта, паучьи, концентрированные',
    loadedBy: ['Скамья Скотта', 'Паучьи', 'Концентрированные'],
  },
  brachialis: {
    head: 'brachialis', muscle: 'biceps', label: 'Брахиалис (толщина руки)',
    stretchCondition: 'Нейтральный/пронированный хват — молот',
    loadedBy: ['Молот', 'Hammer'],
  },
  delt_mid: {
    head: 'delt_mid', muscle: 'shoulders', label: 'Средняя дельта (ширина)',
    stretchCondition: 'Отведение в плоскости лопатки, наклон ~15°',
    loadedBy: ['Махи в стороны', 'Lateral raise', 'Тяга к подбородку до сосков'],
  },
  delt_rear: {
    head: 'delt_rear', muscle: 'shoulders', label: 'Задняя дельта',
    stretchCondition: 'Наклон 60-70°, локти вверх',
    loadedBy: ['Махи в наклоне', 'Face pull', 'Тяга к лицу'],
  },
  delt_front: {
    head: 'delt_front', muscle: 'shoulders', label: 'Передняя дельта',
    stretchCondition: 'Жим вверх перед собой, локти под грифом',
    loadedBy: ['Армейский жим', 'Жим гантелей сидя'],
  },
};

export function headsForMuscle(muscle: string): string[] {
  const m = String(muscle || '').toLowerCase();
  return Object.values(HEAD_FUNCTIONS)
    .filter((h) => h.muscle === m || (m === 'arms' && (h.muscle === 'biceps' || h.muscle === 'triceps')))
    .map((h) => h.head);
}

export interface CheatingEntry {
  deviation: string; // что делает пользователь (ключевые слова)
  steals: string; // кто забирает нагрузку
}

export interface ExerciseStimulus {
  key: string;
  ids: string[]; // id каталога
  nameRe: RegExp[]; // fallback по русскому имени
  headsHit: string[]; // головки, получающие стимул
  headsPartial?: string[]; // частичный стимул
  alternativesForMissed?: Record<string, string[]>; // слабая головка -> чем закрыть
  setup: string[]; // чек-лист положения корпуса/суставов
  resistanceLine: string; // линия сопротивления + где пик
  peakPoint: 'lengthened' | 'mid' | 'short';
  needsPause: boolean; // пауза в пике обязательна
  stability: 'low' | 'med' | 'high'; // требования к стабильности
  cheating: CheatingEntry[]; // отклонение -> кто забирает
  rirTarget: [number, number]; // норма RIR: изоляция 1-2, база 2-3
  rom: string; // норма полной амплитуды
}

/** Пилот: руки + дельты. Остальные мышцы — neutral (записей нет = диагноз молчит). */
export const EXERCISE_STIMULUS_DB: ExerciseStimulus[] = [
  {
    key: 'pushdown',
    ids: ['tricep_pushdown_rope', 'tricep_pushdown_bar', 'tricep_pushdown_single'],
    nameRe: [/разгибание.*блок/i, /блок.*(канат|вер[её]вк)/i, /pushdown/i],
    headsHit: ['triceps_lateral'],
    headsPartial: [],
    alternativesForMissed: { triceps_long: ['Французский жим лёжа', 'Разгибания из-за головы в блоке'] },
    setup: ['Локти прижаты к корпусу и неподвижны', 'Корпус вертикально, без наклона вперёд', 'Хват сверху, кисти жёсткие'],
    resistanceLine: 'Трос тянет строго вверх — пик момента внизу, в сокращённой. Пауза 1с внизу обязательна, иначе пик теряется',
    peakPoint: 'short',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти вперёд/вверх', steals: 'передняя дельта' },
      { deviation: 'раскачка корпусом', steals: 'грудь и широчайшие (моментум вместо трицепса)' },
      { deviation: 'неполное выпрямление', steals: 'теряется пиковое сокращение латеральной' },
    ],
    rirTarget: [1, 2],
    rom: 'Полное выпрямление рук ↔ сгибание локтя ~90° и выше',
  },
  {
    key: 'overhead_ext',
    ids: ['overhead_tricep_ext', 'overhead_tricep_db_both', 'tricep_overhead_rope', 'bb_triceps_long'],
    nameRe: [/из-за голов/i, /над голов/i, /overhead/i],
    headsHit: ['triceps_long'],
    alternativesForMissed: { triceps_lateral: ['Разгибание на блоке с канатом'] },
    setup: ['Плечи согнуты — локти у головы/за головой', 'Локти зафиксированы, не разъезжаются', 'Корпус вертикально, поясница нейтраль'],
    resistanceLine: 'Нагрузка максимальна внизу, в растянутой длинной головке. Опускай за голову, не ко лбу',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти разъезжаются в стороны', steals: 'грудь и передняя дельта' },
      { deviation: 'неполное опускание (до лба)', steals: 'теряется растяжение длинной головки' },
    ],
    rirTarget: [1, 2],
    rom: 'Глубокое опускание за голову ↔ полное выпрямление',
  },
  {
    key: 'french_press',
    ids: ['tricep_push', 'french_press_bar', 'french_press_db', 'db_skullcrusher'],
    nameRe: [/француз/i, /skullcrusher/i, /череп/i],
    headsHit: ['triceps_long'],
    alternativesForMissed: { triceps_lateral: ['Разгибание на блоке с канатом'] },
    setup: ['Локти зафиксированы над плечами', 'Опускание за голову (не ко лбу) = растяжение', 'Не разводить локти'],
    resistanceLine: 'Пик в растянутой длинной головке внизу. Пауза 1с внизу',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти в стороны', steals: 'передняя дельта' },
      { deviation: 'дожим грудью (мостик)', steals: 'грудь вместо трицепса' },
    ],
    rirTarget: [1, 2],
    rom: 'За голову ↔ выпрямление, локти неподвижны',
  },
  {
    key: 'kickback',
    ids: ['kickback', 'kickback_v2', 'kickback_cable', 'cable_tricep_kickback', 'tricep_kickback_cable'],
    nameRe: [/кикб[еэ]к/i, /kickback/i, /разгибание.*наклон/i],
    headsHit: ['triceps_lateral'],
    alternativesForMissed: { triceps_long: ['Французский жим лёжа'] },
    setup: ['Корпус в наклоне ~45°, локоть выше корпуса и зафиксирован', 'Разгибание до прямой руки с паузой 1с'],
    resistanceLine: 'Пик в сокращённой вверху. Лёгкий вес + идеальная форма, не гонись за весом',
    peakPoint: 'short',
    needsPause: true,
    stability: 'high',
    cheating: [
      { deviation: 'локоть падает вниз', steals: 'задняя дельта' },
      { deviation: 'рывок корпусом', steals: 'моментум вместо пикового сокращения' },
    ],
    rirTarget: [1, 2],
    rom: 'Согнутая рука ↔ полное выпрямление с паузой',
  },
  {
    key: 'incline_curl',
    ids: ['incline_db_curl', 'curl_db_incline_45', 'bb_biceps_long', 'bayesian_curl', 'drag_curl'],
    nameRe: [/наклон.*скам/i, /incline.*curl/i, /байес/i, /bayesian/i, /драг/i, /drag.*curl/i],
    headsHit: ['biceps_long'],
    alternativesForMissed: { biceps_short: ['Скамья Скотта', 'Паучьи сгибания'], brachialis: ['Молот'] },
    setup: ['Скамья 30-45° назад, руки висят сзади корпуса = растяжение', 'Локти прижаты, не уходят вперёд', 'Супинация (разворот мизинца наружу) вверху'],
    resistanceLine: 'Пик в растянутой внизу. Пауза 1с внизу + пик 1с вверху',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти вперёд', steals: 'короткая головка и передняя дельта' },
      { deviation: 'раскачка корпусом', steals: 'поясница и дельты вместо бицепса' },
    ],
    rirTarget: [1, 2],
    rom: 'Полный вис внизу ↔ полное сгибание с супинацией',
  },
  {
    key: 'preacher_curl',
    ids: ['preacher_curl', 'preacher_hammer'],
    nameRe: [/скотт/i, /скамь.*скотта/i, /preacher/i, /пауч/i, /spider/i, /концентр/i, /concentration/i],
    headsHit: ['biceps_short'],
    headsPartial: ['biceps_long'],
    alternativesForMissed: { biceps_long: ['Подъём на наклонной скамье', 'Байесовское сгибание'], brachialis: ['Молот'] },
    setup: ['Подмышки на скамье, плечо зафиксировано', 'Полное растяжение внизу, без отбива'],
    resistanceLine: 'Натяжение по всей дуге, акцент — середина/пик. Пауза 1с в пике',
    peakPoint: 'mid',
    needsPause: true,
    stability: 'low',
    cheating: [
      { deviation: 'отрыв плеча от скамьи', steals: 'передняя дельта' },
      { deviation: 'укороченная амплитуда сверху', steals: 'теряется пиковое сокращение' },
    ],
    rirTarget: [1, 2],
    rom: 'Полное растяжение внизу ↔ полный пик вверху',
  },
  {
    key: 'hammer_curl',
    ids: ['hammer_curl'],
    nameRe: [/молот/i, /hammer/i],
    headsHit: ['brachialis'],
    headsPartial: ['biceps_long'],
    alternativesForMissed: { biceps_long: ['Подъём на наклонной скамье'], biceps_short: ['Скамья Скотта'] },
    setup: ['Нейтральный хват (ладони друг к другу)', 'Локти прижаты, без раскачки'],
    resistanceLine: 'Равномерное натяжение, акцент — брахиалис под бицепсом (толщина руки)',
    peakPoint: 'mid',
    needsPause: false,
    stability: 'low',
    cheating: [{ deviation: 'раскачка', steals: 'дельты и поясница' }],
    rirTarget: [1, 2],
    rom: 'Полное разгибание ↔ полное сгибание',
  },
  {
    key: 'lateral_raise',
    ids: ['lateral_raise', 'lateral_raise_cable', 'lateral_raise_machine', 'lateral_raise_single', 'lateral_raise_v2'],
    nameRe: [/махи.*сторон/i, /развед.*сторон/i, /lateral.*raise/i, /дельт.*махи/i],
    headsHit: ['delt_mid'],
    alternativesForMissed: { delt_rear: ['Махи в наклоне', 'Face pull'], delt_front: ['Армейский жим'] },
    setup: ['Наклон вперёд ~15°, лопатки опущены', 'Веди локтями, мизинец выше большого', 'До уровня плеч — не выше'],
    resistanceLine: 'Гантель тянет вниз всю дугу; трос снизу даёт равномерное натяжение. Пауза 1с вверху',
    peakPoint: 'mid',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'выше плеч', steals: 'трапеция' },
      { deviation: 'раскачка корпусом', steals: 'моментум вместо дельты' },
      { deviation: 'кисти ведут, локти прямые', steals: 'трапеция и предплечья' },
    ],
    rirTarget: [1, 2],
    rom: 'Руки вдоль тела ↔ уровень плеч с паузой',
  },
  {
    key: 'rear_delt',
    ids: ['rear_delt_fly', 'rear_delt_machine'],
    nameRe: [/задн.*дельт/i, /rear.*delt/i, /махи.*наклон/i, /face.?pull/i, /тяга к лицу/i],
    headsHit: ['delt_rear'],
    alternativesForMissed: { delt_mid: ['Махи в стороны с опорой'] },
    setup: ['Наклон 60-70°', 'Локти вверх (не назад), мизинец ведёт', 'Своди лопатки, не кругли спину'],
    resistanceLine: 'Пик в сведении лопаток. Пауза 1с в пике',
    peakPoint: 'short',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти назад вдоль тела', steals: 'широчайшие' },
      { deviation: 'кругление спины', steals: 'нагрузка уходит с дельты, риск поясницы' },
    ],
    rirTarget: [1, 2],
    rom: 'Руки внизу/сведены ↔ разведение с паузой',
  },
  {
    key: 'ohp',
    ids: ['ohp', 'ohp_seated', 'ohp_seated_bar', 'ohp_seated_db', 'ohp_db', 'db_press', 'smith_shoulder_press'],
    nameRe: [/армейский/i, /жим.*сидя/i, /жим.*стоя/i, /overhead.*press/i, /ohp/i],
    headsHit: ['delt_front'],
    headsPartial: ['delt_mid'],
    alternativesForMissed: { delt_mid: ['Махи в стороны'], delt_rear: ['Махи в наклоне'] },
    setup: ['Локти под грифом', 'Таз напряжён, без прогиба поясницы', 'Жим до выпрямления без щелчка локтей'],
    resistanceLine: 'База: грузит переднюю дельту + трицепс. Для средней — это компромисс, не изоляция',
    peakPoint: 'mid',
    needsPause: false,
    stability: 'high',
    cheating: [
      { deviation: 'прогиб поясницы', steals: 'верх груди вместо дельты' },
      { deviation: 'неполная амплитуда', steals: 'теряется верхняя доля движения' },
    ],
    rirTarget: [2, 3],
    rom: 'Гриф к ключице ↔ выпрямление рук',
  },
];

function norm(s: string): string {
  return String(s || '').toLowerCase().trim();
}

function findCatalogId(ex: { id?: string; name?: string }): string | null {
  const wantId = ex.id ? norm(ex.id) : '';
  if (wantId) {
    const hit = (EXERCISE_CATALOG as any[]).find((c) => norm(c.id) === wantId);
    if (hit) return String(hit.id);
  }
  if (ex.name) {
    const low = norm(ex.name);
    const hit = (EXERCISE_CATALOG as any[]).find((c) => norm(c.name) === low || norm(c.id) === low);
    if (hit) return String(hit.id);
  }
  return ex.id ? String(ex.id) : null;
}

/** Резолв записи стимула: по id каталога, иначе по имени (рус/eng fallback). */
export function resolveStimulus(ex: { id?: string; name?: string }): ExerciseStimulus | null {
  const catId = findCatalogId(ex);
  if (catId) {
    const byId = EXERCISE_STIMULUS_DB.find((r) => r.ids.map(norm).includes(norm(catId)));
    if (byId) return byId;
  }
  const nm = norm(ex.name || ex.id || '');
  if (!nm) return null;
  return EXERCISE_STIMULUS_DB.find((r) => r.nameRe.some((re) => re.test(nm))) || null;
}

/** Какие головки грузит упражнение напрямую (строго headsHit, без partial). */
export function headsHitOf(ex: { id?: string; name?: string }): string[] {
  const rec = resolveStimulus(ex);
  if (!rec) return [];
  return [...rec.headsHit];
}

/** Чем закрыть слабую головку. */
export function alternativesForHead(head: string): string[] {
  const out: string[] = [];
  for (const rec of EXERCISE_STIMULUS_DB) {
    if (rec.headsHit.includes(head)) {
      const label = rec.setup[0] ? `${rec.key}` : rec.key;
      void label;
      // человеческие имена берём из headsHit-записей через loadedBy канона головки
      out.push(rec.key);
    }
    const alt = rec.alternativesForMissed?.[head];
    if (alt) for (const a of alt) if (!out.includes(a)) out.push(a);
  }
  const canon = HEAD_FUNCTIONS[head]?.loadedBy || [];
  for (const c of canon) if (!out.includes(c)) out.push(c);
  return out.slice(0, 6);
}

/** Сетап-гид для PROF-карточки: чек-лист + куда уйдёт нагрузка. */
export function setupGuideFor(headOrMuscle: string): { checklist: string[]; leaks: string[] } {
  const key = norm(headOrMuscle);
  const recs = EXERCISE_STIMULUS_DB.filter(
    (r) => r.headsHit.includes(key) || r.headsHit.some((h) => HEAD_FUNCTIONS[h]?.muscle === key),
  );
  const checklist: string[] = [];
  const leaks: string[] = [];
  for (const r of recs.slice(0, 3)) {
    for (const s of r.setup.slice(0, 2)) if (!checklist.includes(s)) checklist.push(s);
    for (const c of r.cheating.slice(0, 2)) {
      const leak = `${c.deviation} → ${c.steals}`;
      if (!leaks.includes(leak)) leaks.push(leak);
    }
  }
  return { checklist: checklist.slice(0, 5), leaks: leaks.slice(0, 4) };
}

export interface StimulusCtx {
  weakHead?: string | null;
  setupIssues?: string[]; // свободные метки отклонений, напр. ['локти вперёд']
  cheating?: boolean | null;
  rirActual?: number | null;
  rangeFull?: boolean | null; // false = укороченная амплитуда
  tempoHasPause?: boolean | null;
}

export interface StimulusBreakdown {
  setup: number;
  profile: number;
  line: number;
  rom: number;
  stability: number;
  effort: number;
}

export interface StimulusDiagnosis {
  record: ExerciseStimulus | null;
  headsHit: string[];
  headsMissed: string[]; // головки мышцы, не получающие стимул
  flags: StimulusFlag[];
  issues: string[];
  score: number | null; // 0-100 «доля в цель», null = нет данных (не пилот)
  breakdown: StimulusBreakdown | null;
}

const HEADS_BY_MUSCLE: Record<string, string[]> = {
  triceps: ['triceps_long', 'triceps_lateral'],
  biceps: ['biceps_long', 'biceps_short', 'brachialis'],
  shoulders: ['delt_mid', 'delt_rear', 'delt_front'],
};

function muscleOfHead(head: string): string {
  return HEAD_FUNCTIONS[head]?.muscle || '';
}

export function diagnoseStimulusTarget(
  ex: { id?: string; name?: string; muscle?: string },
  ctx: StimulusCtx = {},
): StimulusDiagnosis {
  const rec = resolveStimulus(ex);
  if (!rec) {
    return { record: null, headsHit: [], headsMissed: [], flags: [], issues: [], score: null, breakdown: null };
  }
  const flags: StimulusFlag[] = [];
  const issues: string[] = [];
  const bd: StimulusBreakdown = { setup: 100, profile: 100, line: 100, rom: 100, stability: 100, effort: 100 };
  const hit = [...rec.headsHit];

  // 1 wrongHead — упражнение мимо слабой головки (выводится из плана, тапы не нужны)
  // Строго: partial-стимул не считается попаданием (молот ≠ тренировка длинной головки)
  let missed: string[] = [];
  if (ctx.weakHead && HEAD_FUNCTIONS[ctx.weakHead]) {
    const wh = ctx.weakHead;
    const musc = muscleOfHead(wh);
    const family = HEADS_BY_MUSCLE[musc] || [];
    const recMuscles = new Set([...rec.headsHit, ...(rec.headsPartial || [])].map(muscleOfHead));
    if (recMuscles.has(musc) && !rec.headsHit.includes(wh)) {
      missed = family.filter((h) => h !== wh && hit.includes(h));
      flags.push('wrongHead');
      const alts = (rec.alternativesForMissed?.[wh] || HEAD_FUNCTIONS[wh]?.loadedBy || []).slice(0, 2).join(', ');
      issues.push(
        `Мимо головки: ${HEAD_FUNCTIONS[wh].label} почти не грузится — ${HEAD_FUNCTIONS[wh].stretchCondition.toLowerCase()}${alts ? `; закрой: ${alts}` : ''}`,
      );
      bd.profile = 45;
    } else if (!recMuscles.has(musc)) {
      missed = [];
    } else {
      missed = family.filter((h) => !hit.includes(h));
    }
  } else {
    const musc = muscleOfHead(rec.headsHit[0]);
    const family = HEADS_BY_MUSCLE[musc] || [];
    missed = family.filter((h) => !hit.includes(h));
  }

  // 2 setupRisk + 9 synergistTakeover — по тапам отклонений
  const taps = (ctx.setupIssues || []).map(norm).filter(Boolean);
  if (taps.length > 0) {
    let matched = 0;
    for (const tap of taps) {
      const words = tap.split(/[\s,;]+/).filter((w) => w.length > 2);
      const entry = rec.cheating.find((c) => {
        const cn = norm(c.deviation);
        return words.some((w) => cn.includes(w)) || cn.split(/[\s,;]+/).some((w) => w.length > 2 && tap.includes(w));
      });
      if (entry) {
        matched++;
        if (!flags.includes('synergistTakeover')) flags.push('synergistTakeover');
        issues.push(`Утечка: ${entry.deviation} → забирает ${entry.steals}`);
      }
    }
    if (matched > 0) {
      flags.push('setupRisk');
      issues.push(`Сетап: ${matched} отклонение(я) — проверь: ${rec.setup.slice(0, 2).join('; ')}`);
      bd.setup = Math.max(30, 100 - matched * 25);
      bd.line = Math.max(40, bd.line - matched * 15);
    } else {
      flags.push('setupRisk');
      issues.push(`Сетап под вопросом (${taps.slice(0, 2).join(', ')}) — эталон: ${rec.setup[0]}`);
      bd.setup = 70;
    }
  }

  // 3 resistanceLineGap — пик в сокращённой без паузы (выводится из плана)
  if (rec.needsPause && ctx.tempoHasPause === false) {
    flags.push('resistanceLineGap');
    issues.push(`Линия: пик нагрузки ${rec.peakPoint === 'short' ? 'в сокращённой' : 'в растянутой'}, а паузы нет — ${rec.resistanceLine.split('.')[0]}`);
    bd.line = Math.min(bd.line, 55);
  }

  // 4 romShort — укороченная амплитуда
  if (ctx.rangeFull === false) {
    flags.push('romShort');
    issues.push(`Амплитуда укорочена — норма: ${rec.rom}`);
    bd.rom = 55;
  }

  // 6 stabilityGap — читинг
  if (ctx.cheating === true) {
    flags.push('stabilityGap');
    const first = rec.cheating[0];
    issues.push(`Стабильность: читинг — momentum вместо мышцы${first ? ` (${first.deviation} → ${first.steals})` : ''}; требование стабильности: ${rec.stability}`);
    bd.stability = 45;
  }

  // 8 rirMismatch — недожим изоляции / пережим базы
  if (ctx.rirActual != null && Number.isFinite(ctx.rirActual)) {
    const [lo, hi] = rec.rirTarget;
    if (ctx.rirActual > hi + 1) {
      flags.push('rirMismatch');
      issues.push(`Недожим: RIR ${ctx.rirActual} при норме ${lo}-${hi} — последние 2 повтора дают основной стимул`);
      bd.effort = 55;
    } else if (ctx.rirActual < lo - 1) {
      flags.push('rirMismatch');
      issues.push(`Пережим: RIR ${ctx.rirActual} при норме ${lo}-${hi} — техника плывёт, нагрузку забирают синергисты`);
      bd.effort = 65;
    }
  }

  const WEIGHTS: Record<StimulusFlag, number> = {
    wrongHead: 25,
    synergistTakeover: 15,
    setupRisk: 10,
    resistanceLineGap: 10,
    romShort: 10,
    stabilityGap: 12,
    rirMismatch: 8,
  };
  let score = 100;
  for (const f of new Set(flags)) score -= WEIGHTS[f] ?? 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    record: rec,
    headsHit: hit,
    headsMissed: missed,
    flags: [...new Set(flags)],
    issues: [...new Set(issues)].slice(0, 6),
    score,
    breakdown: bd,
  };
}
