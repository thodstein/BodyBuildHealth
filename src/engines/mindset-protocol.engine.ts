/**
 * Mindset Protocol Engine — «Психология» дневника тренировок.
 *
 * Пользователь собирает личный ментальный протокол из атомарных ритуалов
 * (библиотека RITUAL_LIBRARY, источник — mindset-методики training-methodology.engine:
 * визуализация, цели, активация/возбуждение, mental toughness, дневник-рефлексия).
 *
 * Протокол привязывается к типам дня (тяжёлый/памп/соревновательный/делод/любой)
 * и направлениям (ПЛ/ББ/универсал). В сессии (SessionPlayer) показываются шаги
 * «до/во время/после»; чек-ины (уверенность/активация/фокус) копятся в he_mindset_checks,
 * тренды и связь с e1RM — в аналитике вкладки «Психология».
 *
 * Отображение-онли: движок НЕ влияет на планирование/авторегуляцию.
 *
 * @module mindset-protocol-engine
 */

import { epley1RM } from './e1rm';
import { identifyPhase } from './coaching-psychology.engine';
import { getProfile } from '../core/profile-manager';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type MindsetDirection = 'pl' | 'bb' | 'both';
export type MindsetDayType = 'all' | 'heavy' | 'pump' | 'competition' | 'deload';
export type ProtocolItemKind = 'pre' | 'approach' | 'post';

export interface ProtocolItem {
  id: string;
  kind: ProtocolItemKind;
  title: string;
  script: string;
  durationMin: number;
  /** Типы дня, для которых актуален шаг ('all' = любой). */
  targetDays: MindsetDayType[];
  /** Имя методики-источника из training-methodology.engine (для кастомных — пусто). */
  sourceMethod?: string;
}

export interface MindsetRitual extends ProtocolItem {
  /** Для фильтра пресетов: кому подходит ритуал. */
  direction: MindsetDirection;
  /** Короткое пояснение для карточки библиотеки. */
  description: string;
}

export interface MindsetProtocol {
  id: string;
  name: string;
  direction: MindsetDirection;
  items: ProtocolItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MindsetCheckin {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** id WorkoutLog сессии (опционально). */
  sessionId?: string;
  /** Уверенность в себе/плане, 1-5. */
  confidence: number;
  /** Уровень активации (возбуждения), 1-5. */
  arousal: number;
  /** Фокус/концентрация, 1-5. */
  focus: number;
  /** Протокол дня выполнен (null = не отмечено). */
  protocolFollowed: boolean | null;
  note?: string;
}

export interface MindsetTrends {
  series: { date: string; confidence: number; arousal: number; focus: number }[];
  averages: { confidence: number; arousal: number; focus: number };
  /** Дельта средних текущего окна vs предыдущего окна той же длины. */
  deltas: { confidence: number; arousal: number; focus: number };
  count: number;
}

export interface ConfidencePerformanceLink {
  /** Коэффициент корреляции Пирсона (уверенность ↔ e1RM сессии). */
  pearson: number | null;
  /** Средний e1RM (кг) по корзинам уверенности. */
  buckets: { level: 'low' | 'mid' | 'high'; range: string; avgE1RM: number; n: number }[];
  n: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage keys
// ═══════════════════════════════════════════════════════════════════════════

export const MINDSET_PROTOCOLS_KEY = 'he_mindset_protocols';
export const MINDSET_ACTIVE_KEY = 'he_mindset_active_protocol_id';
export const MINDSET_CHECKS_KEY = 'he_mindset_checks';
export const MINDSET_DAY_PROGRESS_KEY = 'he_mindset_day_progress';

export const KIND_ORDER: ProtocolItemKind[] = ['pre', 'approach', 'post'];

export const KIND_LABELS: Record<ProtocolItemKind, string> = {
  pre: 'До тренировки',
  approach: 'Перед подходом / во время',
  post: 'После тренировки',
};

export const DAYTYPE_LABELS: Record<MindsetDayType, string> = {
  all: 'Любой день',
  heavy: 'Тяжёлый день',
  pump: 'Памповый день',
  competition: 'Соревнование / проходка',
  deload: 'Делод / восстановление',
};

export const DIRECTION_LABELS: Record<MindsetDirection, string> = {
  pl: 'ПЛ (пауэрлифтинг)',
  bb: 'ББ (бодибилдинг)',
  both: 'Универсал',
};

// ═══════════════════════════════════════════════════════════════════════════
// Ritual library (атомарные шаги из mindset-методик)
// ═══════════════════════════════════════════════════════════════════════════

export const RITUAL_LIBRARY: MindsetRitual[] = [
  // ── До тренировки (pre) ──
  {
    id: 'goal_today', kind: 'pre', title: 'Цель на сегодня',
    script: 'Сформулируй ОДНУ процессуальную цель на сессию (контролируемую тобой): «идеальная техника в рабочих подходах», «не пропустить ни одного подхода», «RPE в целевом диапазоне». Не результативная («пожму 100») — процессуальная.',
    durationMin: 1, targetDays: ['all'], direction: 'both',
    sourceMethod: 'Постановка целей (Goal Setting)',
    description: 'Процессуальная цель сессии — управляемый фокус вместо давления результата.',
  },
  {
    id: 'mental_warmup', kind: 'pre', title: 'Ментальный вход в тренировку',
    script: 'Перед первым подходом: 2-3 минуты «отключения» от внешнего мира — телефон в авиарежим, музыка 140-160 bpm (для силовых) или спокойный плейлист (для техники). 3-5 медленных глубоких вдохов. Ты здесь для тренировки.',
    durationMin: 3, targetDays: ['all'], direction: 'both',
    sourceMethod: 'Активация и управление возбуждением (Arousal Control)',
    description: 'Вход в тренировочное состояние: внешний шум выключен, фокус включён.',
  },
  {
    id: 'visualize_session', kind: 'pre', title: 'Визуализация сессии',
    script: 'Закрой глаза на 2-3 минуты. Пройди мысленно ключевые подходы сегодняшней тренировки: от подхода к снаряду до успешного подъёма — хват, стойка, траектория, напряжение мышц. Проиграй каждый 2-3 раза. Детальность образа = сила эффекта (Slimani 2016: +8-15% к 1RM за 6-8 недель).',
    durationMin: 3, targetDays: ['heavy', 'competition'], direction: 'pl',
    sourceMethod: 'Визуализация и ментальная репетиция (Visualization)',
    description: 'Ментальная репетиция ключевых подходов до выхода в зал.',
  },
  {
    id: 'dark_training_set', kind: 'pre', title: 'Установка: выполнить план',
    script: 'Если сегодня устал / нет настроения / плохой сон — тренировка всё равно выполняется по плану (с корректировкой интенсивности, но без отмены). Это «тёмная тренировка»: дисциплина крепнет именно в такие дни. Скажи себе: «План есть план» — и начни с разминки.',
    durationMin: 1, targetDays: ['all'], direction: 'both',
    sourceMethod: 'Психологическая устойчивость (Mental Toughness)',
    description: 'Дисциплина вместо настроения: тренировка выполняется независимо от состояния.',
  },
  {
    id: 'comp_sim', kind: 'pre', title: 'Соревновательная симуляция',
    script: 'Прогони подходы как на соревнованиях: команды судьи, таймер, полный ритуал перед каждым подходом, никакой музыки из чужих наушников в голове — только свой ритуал. Цель: кортизоловый ответ на «платформу» снижается при регулярной практике (Rimmele 2009).',
    durationMin: 5, targetDays: ['competition'], direction: 'pl',
    sourceMethod: 'Психологическая устойчивость (Mental Toughness)',
    description: 'Репетиция соревновательного дня с командами и ритуалами.',
  },
  {
    id: 'mmc_intent', kind: 'pre', title: 'Интент: связь мозг-мышцы',
    script: 'Перед началом: пройдись по группам сегодняшнего дня и мысленно «включи» каждую (напряги/расслабь целевые мышцы 2-3 раза). Цель сессии — ощущать работу целевой мышцы в каждом подходе, а не просто перемещать вес.',
    durationMin: 2, targetDays: ['pump'], direction: 'bb',
    description: 'Ментальная активация целевых мышц до первого подхода.',
  },
  {
    id: 'discipline_note', kind: 'pre', title: 'Дисциплина диеты/режима',
    script: '30 секунд на осознанный выбор: сегодняшняя тренировка — часть системы (питание, сон, план). Напомни себе, зачем ты здесь (образ цели: сцена/зеркало/цифра на штанге). Мотивация приходит и уходит — система остаётся.',
    durationMin: 1, targetDays: ['all'], direction: 'bb',
    description: 'Якорь на долгосрочную систему вместо сиюминутной мотивации.',
  },
  // ── Перед подходом / во время (approach) ──
  {
    id: 'viz_approach', kind: 'approach', title: 'Визуализация подхода (90 сек)',
    script: 'Перед тяжёлым подходом: закрой глаза на 60-90 секунд. Увидь: подход к снаряду, хват, съём, шаги, вдох, движение по идеальной траектории, фиксацию. Почувствуй напряжение в рабочих мышцах. Повтори образ 3 раза. Открой глаза → подход с полной уверенностью.',
    durationMin: 2, targetDays: ['heavy', 'competition'], direction: 'pl',
    sourceMethod: 'Визуализация и ментальная репетиция (Visualization)',
    description: 'Детальный образ успешного подхода непосредственно перед ним.',
  },
  {
    id: 'arousal_up', kind: 'approach', title: 'Активация перед тяжёлым весом',
    script: 'Силовые движения требуют высокой активации (80-90%): 3-5 коротких резких вдохов-выдохов + хлопок по бёдрам + агрессивный self-talk («я сильнее этого веса», «вес лёгкий»). Взрывная концентрика в намерении. НЕ гипервентилировать — короткий резкий цикл.',
    durationMin: 1, targetDays: ['heavy', 'competition'], direction: 'pl',
    sourceMethod: 'Активация и управление возбуждением (Arousal Control)',
    description: 'Подъём активации дыханием и self-talk перед рабочим весом.',
  },
  {
    id: 'calm_breath', kind: 'approach', title: 'Диафрагмальное дыхание 4-7-8',
    script: 'Для технических подходов и контроля перевозбуждения: вдох носом 4 сек → задержка 7 сек → медленный выдох ртом 8 сек. 2-3 цикла. Снижает тремор и спешку, возвращает траекторию под контроль.',
    durationMin: 1, targetDays: ['pump', 'deload'], direction: 'both',
    sourceMethod: 'Активация и управление возбуждением (Arousal Control)',
    description: 'Снижение активации: дыхание 4-7-8 перед точными/лёгкими подходами.',
  },
  {
    id: 'self_talk', kind: 'approach', title: 'Позитивный self-talk',
    script: 'Короткая конкретная фраза перед подходом (не «я не уроню», а «встать» / «техника идеальна» / «моя траектория»). Формулировка позитивная и про действие. Одна фраза — один подход.',
    durationMin: 1, targetDays: ['heavy', 'competition'], direction: 'both',
    sourceMethod: 'Активация и управление возбуждением (Arousal Control)',
    description: 'Одна позитивная команда себе перед подходом.',
  },
  {
    id: 'mmc_set', kind: 'approach', title: 'MMC-установка перед рабочим сетом',
    script: 'Перед рабочим сетом: 1 лёгкий повтор с паузой в пике сокращения целевой мышцы (2-3 сек). В подходе: замедли негатив, почувствуй растяжение и сокращение. Если мышцу не чувствуешь — снизь вес на 10-15%, не жертвуй связью.',
    durationMin: 1, targetDays: ['pump'], direction: 'bb',
    description: 'Активационный повтор + фокус на целевой мышце в подходе.',
  },
  {
    id: 'ritual_anchor', kind: 'approach', title: 'Личный ритуал-якорь',
    script: 'Одинаковая последовательность перед КАЖДЫМ подходом: отойти на 2 м → 1 глубокий вдох → подход к снаряду → съём → движение. Ритуал — якорь для ЦНС: одинаковая процедура = одинаковое оптимальное состояние. Не копируй чужой — собери свой.',
    durationMin: 1, targetDays: ['heavy', 'competition'], direction: 'pl',
    sourceMethod: 'Активация и управление возбуждением (Arousal Control)',
    description: 'Личная повторяемая процедура перед каждым подходом.',
  },
  {
    id: 'breath_recover', kind: 'approach', title: 'Дыхание восстановления',
    script: 'Сразу после подхода: 60 секунд диафрагмального дыхания (медленный вдох носом, длинный выдох ртом). Быстрее возвращает пульс и спокойствие для следующего подхода, чем телефон.',
    durationMin: 1, targetDays: ['heavy', 'competition'], direction: 'both',
    sourceMethod: 'Активация и управление возбуждением (Arousal Control)',
    description: 'Активное успокоение после подхода вместо пассивного скролла.',
  },
  // ── После тренировки (post) ──
  {
    id: 'journal_note', kind: 'post', title: 'Запись сразу после подхода',
    script: 'Фиксируй факт сразу (не по памяти): вес × повторения, RPE/RIR, ощущение техники. Дневник — обратная связь, а не бюрократия: тренды за 4-8 недель показывают, работает ли программа (Burke 2011: +15-25% к прогрессу).',
    durationMin: 2, targetDays: ['all'], direction: 'both',
    sourceMethod: 'Дневник тренировок и рефлексия (Training Journal)',
    description: 'Фактическая запись подходов до конца сессии.',
  },
  {
    id: 'reflection_3q', kind: 'post', title: 'Рефлексия: 3 вопроса',
    script: 'В конце сессии ответь письменно на 3 вопроса: (1) Что получилось лучше всего сегодня? (2) Где сдался раньше тела (психика vs мышцы)? (3) Что изменишь в следующий раз? Одна строка на вопрос достаточно.',
    durationMin: 3, targetDays: ['all'], direction: 'both',
    sourceMethod: 'Дневник тренировок и рефлексия (Training Journal)',
    description: 'Короткая письменная рефлексия сессии.',
  },
  {
    id: 'weekly_review', kind: 'post', title: 'Еженедельный обзор',
    script: 'Раз в неделю (воскресенье): посмотри тренды недели — какие упражнения растут, где плато, связь сна/питания с результатом. Скорректируй процессуальные цели на следующую неделю. Анализ — еженедельно, не ежедневно.',
    durationMin: 10, targetDays: ['all'], direction: 'both',
    sourceMethod: 'Постановка целей (Goal Setting)',
    description: 'Недельный разбор трендов и пересмотр целей.',
  },
  {
    id: 'toughness_log', kind: 'post', title: 'Разбор контролируемого дискомфорта',
    script: 'После тяжёлой/отказной работы: запиши, что почувствовал — где сдался раньше тела, что удержало, что забрать в следующий раз. Это тренировка психики (controlled adversity), а не наказание: разбор превращает дискомфорт в адаптацию.',
    durationMin: 3, targetDays: ['heavy', 'competition'], direction: 'both',
    sourceMethod: 'Психологическая устойчивость (Mental Toughness)',
    description: 'Письменный разбор тяжёлой работы как тренировки психики.',
  },
  {
    id: 'pose_image', kind: 'post', title: 'Позирование / ментальный образ',
    script: 'После памповой сессии: 2-3 минуты позирования или визуализации целевого образа (сцена, зеркало). Мысль: сегодняшний объём — шаг к образу. Это закрепляет мотивацию и связь «работа → результат».',
    durationMin: 3, targetDays: ['pump'], direction: 'bb',
    description: 'Закрепление образа цели после пампа.',
  },
  {
    id: 'gratitude_wrap', kind: 'post', title: 'Фиксация победы',
    script: 'Заверши сессию одной фразой-фиксацией: «Сегодня сделано: [главный факт]». Это закрывает цикл дофаминовой петли (достижение → закрепление → мотивация на следующую сессию) даже в средний день.',
    durationMin: 1, targetDays: ['all'], direction: 'both',
    sourceMethod: 'Постановка целей (Goal Setting)',
    description: 'Одна строка о главном результате сессии.',
  },
];

export function getRitualById(id: string): MindsetRitual | null {
  return RITUAL_LIBRARY.find(r => r.id === id) || null;
}

/** Создать шаг протокола из ритуала библиотеки (копия). */
export function ritualToItem(ritual: MindsetRitual): ProtocolItem {
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind: ritual.kind,
    title: ritual.title,
    script: ritual.script,
    durationMin: ritual.durationMin,
    targetDays: [...ritual.targetDays],
    sourceMethod: ritual.sourceMethod,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Presets (ПЛ / ББ / универсал)
// ═══════════════════════════════════════════════════════════════════════════

const PRESET_RECIPES: Record<Exclude<MindsetDirection, 'both'>, string[]> = {
  pl: [
    'goal_today', 'mental_warmup', 'visualize_session', 'viz_approach',
    'arousal_up', 'ritual_anchor', 'self_talk', 'breath_recover',
    'journal_note', 'toughness_log', 'reflection_3q', 'weekly_review',
  ],
  bb: [
    'goal_today', 'discipline_note', 'mmc_intent', 'mmc_set',
    'calm_breath', 'journal_note', 'pose_image', 'reflection_3q', 'weekly_review',
  ],
};

const UNIVERSAL_RECIPE: string[] = [
  'goal_today', 'mental_warmup', 'self_talk', 'calm_breath',
  'journal_note', 'reflection_3q', 'gratitude_wrap', 'weekly_review',
];

export const PRESET_LABELS: Record<MindsetDirection, string> = {
  pl: 'ПЛ: соревновательный (активация, визуализация, ритуалы)',
  bb: 'ББ: памп и фокус (MMC, образ, дисциплина)',
  both: 'Универсал: цели, дыхание, рефлексия',
};

export function buildPresetProtocol(direction: MindsetDirection): MindsetProtocol {
  const recipe = direction === 'both' ? UNIVERSAL_RECIPE
    : direction === 'pl' ? PRESET_RECIPES.pl : PRESET_RECIPES.bb;
  const items: ProtocolItem[] = recipe
    .map(id => getRitualById(id))
    .filter((r): r is MindsetRitual => !!r)
    .map(ritualToItem);
  const now = new Date().toISOString();
  return {
    id: `proto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Протокол: ${DIRECTION_LABELS[direction]}`,
    direction,
    items,
    createdAt: now,
    updatedAt: now,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Day-type detection
// ═══════════════════════════════════════════════════════════════════════════

export function detectDayType(focus: string, track?: string): MindsetDayType {
  const f = (focus || '').toLowerCase();
  if (/соревн|compet|проходк|прикид|пик/.test(f)) return 'competition';
  if (/делод|разгруз|deload|восстанов|transition|recovery/.test(f)) return 'deload';
  if (/памп|гипертроф|объём|pump|hypertrophy|изоляц/.test(f)) return 'pump';
  if (track === 'bb') return 'pump';
  if (/тяж|сил|strength|heavy|присед|тяга|жим|powerlift/.test(f)) return 'heavy';
  if (track === 'pl') return 'heavy';
  return 'all';
}

/** Шаги протокола, актуальные для типа дня, в порядке pre → approach → post. */
export function itemsForDay(protocol: MindsetProtocol | null, dayType: MindsetDayType): ProtocolItem[] {
  if (!protocol || !Array.isArray(protocol.items)) return [];
  const active = protocol.items.filter(it =>
    it && Array.isArray(it.targetDays) &&
    (dayType === 'all' || it.targetDays.includes('all') || it.targetDays.includes(dayType)),
  );
  return active.sort((a, b) => {
    const ka = KIND_ORDER.indexOf(a.kind);
    const kb = KIND_ORDER.indexOf(b.kind);
    return ka - kb;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Sanitizers
// ═══════════════════════════════════════════════════════════════════════════

const VALID_KINDS: ProtocolItemKind[] = ['pre', 'approach', 'post'];
const VALID_DAYS: MindsetDayType[] = ['all', 'heavy', 'pump', 'competition', 'deload'];
const VALID_DIRECTIONS: MindsetDirection[] = ['pl', 'bb', 'both'];

function clamp1to5(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  if (n <= 0) return 0;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function sanitizeItem(raw: any): ProtocolItem | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.title !== 'string' || raw.title.trim() === '') return null;
  const kind: ProtocolItemKind = VALID_KINDS.includes(raw.kind) ? raw.kind : 'pre';
  const targetDays: MindsetDayType[] = Array.isArray(raw.targetDays)
    ? raw.targetDays.filter((d: unknown): d is MindsetDayType => VALID_DAYS.includes(d as MindsetDayType))
    : [];
  if (targetDays.length === 0) targetDays.push('all');
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title: raw.title,
    script: typeof raw.script === 'string' ? raw.script : '',
    durationMin: typeof raw.durationMin === 'number' && Number.isFinite(raw.durationMin) && raw.durationMin >= 0 ? Math.round(raw.durationMin) : 1,
    targetDays,
    sourceMethod: typeof raw.sourceMethod === 'string' ? raw.sourceMethod : undefined,
  };
}

export function sanitizeProtocol(raw: any): MindsetProtocol | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;
  const items = Array.isArray(raw.items)
    ? (raw.items as any[]).map(r => sanitizeItem(r)).filter((x): x is ProtocolItem => !!x)
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `proto_${Date.now()}`,
    name: raw.name,
    direction: VALID_DIRECTIONS.includes(raw.direction) ? raw.direction : 'both',
    items,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export function sanitizeCheckin(raw: any): MindsetCheckin | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: raw.date.slice(0, 10),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    confidence: clamp1to5(raw.confidence),
    arousal: clamp1to5(raw.arousal),
    focus: clamp1to5(raw.focus),
    protocolFollowed: typeof raw.protocolFollowed === 'boolean' ? raw.protocolFollowed : null,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

function readJSON(key: string): any[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — игнор */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Protocol CRUD
// ═══════════════════════════════════════════════════════════════════════════

export function loadProtocols(): MindsetProtocol[] {
  return readJSON(MINDSET_PROTOCOLS_KEY).map(sanitizeProtocol).filter((p): p is MindsetProtocol => !!p);
}

export function saveProtocols(list: MindsetProtocol[]): void {
  writeJSON(MINDSET_PROTOCOLS_KEY, Array.isArray(list) ? list : []);
}

export function createProtocol(name: string, direction: MindsetDirection, items: ProtocolItem[] = []): MindsetProtocol {
  const now = new Date().toISOString();
  return {
    id: `proto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Мой протокол',
    direction,
    items: items.map(sanitizeItem).filter((x): x is ProtocolItem => !!x),
    createdAt: now,
    updatedAt: now,
  };
}

/** Upsert протокола. Возвращает обновлённый список. */
export function upsertProtocol(protocol: MindsetProtocol): MindsetProtocol[] {
  const list = loadProtocols();
  const clean = sanitizeProtocol(protocol);
  if (!clean) return list;
  const idx = list.findIndex(p => p.id === clean.id);
  const updated: MindsetProtocol = { ...clean, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = updated;
  else list.push(updated);
  saveProtocols(list);
  return list;
}

export function deleteProtocol(id: string): MindsetProtocol[] {
  let list = loadProtocols().filter(p => p.id !== id);
  saveProtocols(list);
  try {
    if (localStorage.getItem(MINDSET_ACTIVE_KEY) === id) localStorage.removeItem(MINDSET_ACTIVE_KEY);
  } catch { /* ignore */ }
  return list;
}

export function duplicateProtocol(id: string): MindsetProtocol[] {
  const list = loadProtocols();
  const src = list.find(p => p.id === id);
  if (!src) return list;
  const now = new Date().toISOString();
  const copy: MindsetProtocol = {
    ...src,
    id: `proto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `${src.name} (копия)`,
    items: src.items.map(it => ({ ...it, id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` })),
    createdAt: now,
    updatedAt: now,
  };
  list.push(copy);
  saveProtocols(list);
  return list;
}

export function loadActiveProtocol(): MindsetProtocol | null {
  const list = loadProtocols();
  try {
    const id = localStorage.getItem(MINDSET_ACTIVE_KEY);
    if (id) {
      const found = list.find(p => p.id === id);
      if (found) return found;
    }
  } catch { /* ignore */ }
  return list[0] || null;
}

export function setActiveProtocol(id: string | null): void {
  try {
    if (id) localStorage.setItem(MINDSET_ACTIVE_KEY, id);
    else localStorage.removeItem(MINDSET_ACTIVE_KEY);
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Check-ins
// ═══════════════════════════════════════════════════════════════════════════

export function loadCheckins(): MindsetCheckin[] {
  return readJSON(MINDSET_CHECKS_KEY)
    .map(sanitizeCheckin)
    .filter((c): c is MindsetCheckin => !!c)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Upsert чек-ина: заменяет существующую запись с тем же date+sessionId
 * (или просто date, если sessionId не указан). Возвращает полный список.
 */
export function upsertCheckin(input: Omit<MindsetCheckin, 'id'>): MindsetCheckin[] {
  const list = loadCheckins();
  const key = (c: MindsetCheckin) => `${c.date}|${c.sessionId || ''}`;
  const target = key({ ...input, id: '' } as MindsetCheckin);
  const idx = list.findIndex(c => key(c) === target);
  const entry: MindsetCheckin = {
    id: idx >= 0 ? list[idx].id : `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    confidence: clamp1to5(input.confidence),
    arousal: clamp1to5(input.arousal),
    focus: clamp1to5(input.focus),
  };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveCheckins(list);
  return list;
}

function saveCheckins(list: MindsetCheckin[]): void {
  writeJSON(MINDSET_CHECKS_KEY, list);
}

export function latestCheckin(): MindsetCheckin | null {
  const list = loadCheckins();
  return list.length > 0 ? list[list.length - 1] : null;
}

/** Чек-ин для конкретной сессии (sessionId) или null. */
export function checkinForSession(sessionId: string): MindsetCheckin | null {
  return loadCheckins().find(c => c.sessionId === sessionId) || null;
}

export function mindsetTrends(days = 14): MindsetTrends {
  const list = loadCheckins().slice(-days * 2);
  const current = list.slice(-days);
  const previous = list.slice(0, Math.max(0, list.length - days)).slice(-days);
  const avg = (arr: MindsetCheckin[], field: 'confidence' | 'arousal' | 'focus') =>
    arr.length > 0 ? Math.round(arr.reduce((s, c) => s + (c[field] || 0), 0) / arr.length * 10) / 10 : 0;
  const aC = avg(current, 'confidence');
  const aA = avg(current, 'arousal');
  const aF = avg(current, 'focus');
  return {
    series: current.map(c => ({ date: c.date, confidence: c.confidence, arousal: c.arousal, focus: c.focus })),
    averages: { confidence: aC, arousal: aA, focus: aF },
    deltas: {
      confidence: Math.round((aC - avg(previous, 'confidence')) * 10) / 10,
      arousal: Math.round((aA - avg(previous, 'arousal')) * 10) / 10,
      focus: Math.round((aF - avg(previous, 'focus')) * 10) / 10,
    },
    count: current.length,
  };
}

export function protocolAdherence(days = 30): { followed: number; total: number; pct: number } {
  const list = loadCheckins();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const floor = since.toISOString().slice(0, 10);
  const marked = list.filter(c => c.date >= floor && typeof c.protocolFollowed === 'boolean');
  const followed = marked.filter(c => c.protocolFollowed === true).length;
  return {
    followed,
    total: marked.length,
    pct: marked.length > 0 ? Math.round(followed / marked.length * 100) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Correlation with performance
// ═══════════════════════════════════════════════════════════════════════════

export interface PerfSession { date: string; e1rm: number }

/** Извлечь лучший e1RM (Epley) каждой сессии из записей дневника. */
export function sessionsBestE1RM(workouts: { date: string; exercises?: any[] }[]): PerfSession[] {
  const map = new Map<string, number>();
  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w || typeof w !== 'object') continue;
    const date = typeof (w as any).date === 'string' ? (w as any).date.slice(0, 10) : '';
    if (!date) continue;
    let best = 0;
    for (const ex of Array.isArray(w.exercises) ? w.exercises : []) {
      if (!ex || typeof ex !== 'object') continue;
      for (const s of Array.isArray(ex.sets) ? ex.sets : []) {
        const e = epley1RM(s.weight || 0, s.reps || 0);
        if (e > best) best = e;
      }
    }
    if (best > 0) map.set(date, Math.max(map.get(date) || 0, best));
  }
  return Array.from(map.entries())
    .map(([date, e1rm]) => ({ date, e1rm }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return Math.round(num / Math.sqrt(dx * dy) * 100) / 100;
}

export function correlateConfidenceWithPerformance(
  checkins: MindsetCheckin[],
  sessions: PerfSession[],
): ConfidencePerformanceLink {
  const byDate = new Map(sessions.map(s => [s.date, s.e1rm]));
  const pairs: { conf: number; e1rm: number }[] = [];
  for (const c of checkins) {
    const e = byDate.get(c.date);
    if (e && c.confidence > 0) pairs.push({ conf: c.confidence, e1rm: e });
  }
  const r = pearson(pairs.map(p => p.conf), pairs.map(p => p.e1rm));
  const bucket = (level: 'low' | 'mid' | 'high', filter: (c: number) => boolean, range: string) => {
    const items = pairs.filter(p => filter(p.conf));
    const avg = items.length > 0 ? Math.round(items.reduce((s, p) => s + p.e1rm, 0) / items.length) : 0;
    return { level, range, avgE1RM: avg, n: items.length };
  };
  return {
    pearson: r,
    buckets: [
      bucket('low', c => c <= 2, 'уверенность 1-2'),
      bucket('mid', c => c === 3, 'уверенность 3'),
      bucket('high', c => c >= 4, 'уверенность 4-5'),
    ],
    n: pairs.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Insights
// ═══════════════════════════════════════════════════════════════════════════

export function buildMindsetInsights(
  protocol: MindsetProtocol | null,
  workouts: { date: string; exercises?: any[] }[],
): string[] {
  const out: string[] = [];
  const checks = loadCheckins();
  if (!protocol) {
    out.push('Протокол ещё не собран. Начните с пресета (ПЛ / ББ / универсал) — он появится в сессии перед тренировкой.');
    return out;
  }
  if (protocol.items.length === 0) {
    out.push('Протокол пуст. Добавьте шаги из библиотеки ритуалов или примените пресет.');
    return out;
  }
  const adherence = protocolAdherence(30);
  if (adherence.total >= 3) {
    if (adherence.pct >= 80) out.push(`Протокол выполняется в ${adherence.pct}% сессий — отличная приверженность. Усложняйте: добавьте визуализацию перед тяжёлыми днями.`);
    else if (adherence.pct >= 40) out.push(`Протокол выполняется в ${adherence.pct}% сессий. Сократите протокол до 2-3 самых ценных шагов — короткий ритуал выполняется чаще.`);
    else out.push(`Протокол выполняется только в ${adherence.pct}% сессий. Начните с одного шага «до тренировки» и закрепите его неделю.`);
  }
  const trends = mindsetTrends(14);
  if (trends.count >= 3) {
    if (trends.averages.focus > 0 && trends.averages.focus < 3) out.push(`Средний фокус ${trends.averages.focus}/5 за 14 дней — низкий. Добавьте «MMC-установку»/«Ментальный вход» и уберите телефон из зоны подходов.`);
    if (trends.averages.confidence > 0 && trends.averages.confidence < 3) out.push(`Средняя уверенность ${trends.averages.confidence}/5 — низкая. Визуализация подхода + позитивный self-talk перед рабочими весами дают +5-15% к проявлению силы.`);
    if (trends.averages.arousal > 0 && trends.averages.arousal > 4.5) out.push(`Средняя активация ${trends.averages.arousal}/5 — возможна гипервозбуждённость (тремор/спешка). Практикуйте «Диафрагмальное дыхание 4-7-8» между подходами.`);
  }
  const sessions = sessionsBestE1RM(workouts);
  if (checks.length >= 3 && sessions.length >= 3) {
    const link = correlateConfidenceWithPerformance(checks, sessions);
    if (link.pearson !== null && Math.abs(link.pearson) >= 0.3) {
      out.push(`Связь уверенности с e1RM сессии: r = ${link.pearson} (n=${link.n}). ${link.pearson > 0 ? 'Психика заметно влияет на рабочие веса — протокол перед тяжёлыми днями окупается.' : 'Парадоксальная обратная связь — посмотрите на сон/стресс в эти дни.'}`);
    }
  }
  const moods = moodTrends(14);
  if (moods.count >= 3) {
    if (moods.avg <= 2.5) out.push(`Среднее настроение ${moods.avg.toFixed(1)}/5 за 14 дней — низкое. Проверьте сон и восстановление; при апатии замените тяжёлую сессию на лёгкую или день отдыха.`);
    else if (moods.delta <= -0.5) out.push(`Настроение снижается (${moods.delta.toFixed(1)} за 14 дней) — добавьте день отдыха или снизьте объём на неделю.`);
  }
  const psych = psychProfileInsights();
  out.push(...psych);
  const phase = detectMotivationPhase(workouts);
  if (phase.phase !== 'grind' && phase.inputs.weeksInProgram > 0) {
    out.push(`Фаза мотивации: «${phase.label}» (${phase.inputs.weeksInProgram} нед в программе). ${phase.trainingAdjustment}`);
  }
  if (out.length === 0) {
    out.push('Пока мало данных: выполните протокол и заполните чек-ин в нескольких сессиях — появятся персональные инсайты.');
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Day progress (чекбоксы pre-session панели)
// ═══════════════════════════════════════════════════════════════════════════

export interface DayProgress {
  date: string;
  doneItems: string[];
}

export function loadDayProgress(date?: string): DayProgress {
  const key = date || new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem(MINDSET_DAY_PROGRESS_KEY) || 'null');
    if (raw && raw.date === key && Array.isArray(raw.doneItems)) {
      return { date: key, doneItems: raw.doneItems.filter((x: unknown): x is string => typeof x === 'string') };
    }
  } catch { /* ignore */ }
  return { date: key, doneItems: [] };
}

export function saveDayProgress(progress: DayProgress): void {
  try { localStorage.setItem(MINDSET_DAY_PROGRESS_KEY, JSON.stringify(progress)); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Экспорт
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CSV психо-чек-инов для экспорта из дневника (совместим с Excel/таблицами).
 * Колонки: date, session_id, confidence, arousal, focus, protocol_followed (1/0/пусто), note.
 */
export function exportMindsetCheckinsCSV(): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows: string[] = ['date,session_id,confidence,arousal,focus,protocol_followed,note'];
  for (const c of loadCheckins()) {
    rows.push([
      c.date,
      c.sessionId ? esc(c.sessionId) : '',
      c.confidence,
      c.arousal,
      c.focus,
      c.protocolFollowed === null ? '' : c.protocolFollowed ? 1 : 0,
      c.note ? esc(c.note) : '',
    ].join(','));
  }
  return rows.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Mood log (настроение дня)
// ═══════════════════════════════════════════════════════════════════════════

export const MINDSET_MOOD_KEY = 'he_mindset_mood';

export const MOOD_TAGS = ['энергия', 'спокойствие', 'мотивация', 'тревога', 'раздражение', 'апатия', 'сонливость', 'эйфория'] as const;
export type MoodTag = typeof MOOD_TAGS[number];

export interface MoodEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Настроение 1-5. */
  mood: number;
  tags?: MoodTag[];
  note?: string;
}

export const MOOD_LABELS: Record<number, { emoji: string; label: string; color: string }> = {
  1: { emoji: '😖', label: 'Отвратно', color: '#ef4444' },
  2: { emoji: '😕', label: 'Плохо', color: '#f97316' },
  3: { emoji: '😐', label: 'Нормально', color: '#facc15' },
  4: { emoji: '🙂', label: 'Хорошо', color: '#22c55e' },
  5: { emoji: '😄', label: 'Отлично', color: '#00e68a' },
};

export interface MoodTrends {
  series: { date: string; mood: number }[];
  avg: number;
  /** Дельта средних текущего окна vs предыдущего окна той же длины. */
  delta: number;
  count: number;
  /** Распределение оценок 1-5 (сколько раз). */
  distribution: Record<number, number>;
}

export function sanitizeMood(raw: any): MoodEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null;
  const mood = typeof raw.mood === 'number' && Number.isFinite(raw.mood) ? Math.round(raw.mood) : 0;
  if (mood < 1 || mood > 5) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `mood_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: raw.date.slice(0, 10),
    mood,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown): t is MoodTag => MOOD_TAGS.includes(t as MoodTag)) : undefined,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

export function loadMoods(): MoodEntry[] {
  const list = readJSON(MINDSET_MOOD_KEY)
    .map(sanitizeMood)
    .filter((m): m is MoodEntry => !!m)
    .sort((a, b) => a.date.localeCompare(b.date));
  return list.slice(-730);
}

/** Upsert настроения по дате (одна запись на день). Возвращает полный список. */
export function upsertMood(input: { date: string; mood: number; tags?: MoodTag[]; note?: string }): MoodEntry[] {
  const list = loadMoods();
  const idx = list.findIndex(m => m.date === input.date.slice(0, 10));
  const entry: MoodEntry = {
    id: idx >= 0 ? list[idx].id : `mood_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: input.date.slice(0, 10),
    mood: Math.min(5, Math.max(1, Math.round(input.mood) || 3)),
    tags: Array.isArray(input.tags) ? input.tags.filter(t => MOOD_TAGS.includes(t)) : undefined,
    note: typeof input.note === 'string' && input.note.trim() ? input.note.trim() : undefined,
  };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  writeJSON(MINDSET_MOOD_KEY, list);
  return loadMoods();
}

export function latestMood(): MoodEntry | null {
  const list = loadMoods();
  return list.length > 0 ? list[list.length - 1] : null;
}

export function moodTrends(days = 14): MoodTrends {
  const list = loadMoods().slice(-days * 2);
  const current = list.slice(-days);
  const previous = list.slice(0, Math.max(0, list.length - days)).slice(-days);
  const avgOf = (arr: MoodEntry[]) => arr.length > 0 ? Math.round(arr.reduce((s, m) => s + m.mood, 0) / arr.length * 10) / 10 : 0;
  const aC = avgOf(current);
  const dist: Record<number, number> = {};
  for (const m of current) dist[m.mood] = (dist[m.mood] || 0) + 1;
  return {
    series: current.map(m => ({ date: m.date, mood: m.mood })),
    avg: aC,
    delta: Math.round((aC - avgOf(previous)) * 10) / 10,
    count: current.length,
    distribution: dist,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Motivation phase (фаза мотивации)
// ═══════════════════════════════════════════════════════════════════════════

export interface MotivationPhaseResult {
  /** Ключ фазы: honeymoon | grind | plateau | breakthrough | burnout. */
  phase: string;
  label: string;
  icon: string;
  description: string;
  duration: string;
  signs: string[];
  interventions: string[];
  trainingAdjustment: string;
  inputs: { weeksInProgram: number; lastPRDaysAgo: number; motivationScore: number; fatigueScore: number };
}

const PHASE_META: Record<string, { label: string; icon: string }> = {
  honeymoon: { label: 'Медовый месяц', icon: '🌱' },
  grind: { label: 'Рабочая рутина', icon: '⚙️' },
  plateau: { label: 'Плато', icon: '🧱' },
  breakthrough: { label: 'Прорыв', icon: '🚀' },
  burnout: { label: 'Выгорание', icon: '🔥' },
};

/**
 * Фаза мотивации по данным дневника: недели в программе (из истории),
 * дней с последнего максимума e1RM, средняя уверенность/настроение (мотивация),
 * доля «вялых» чек-инов и низкого настроения (усталость).
 * Метод — coaching-psychology.engine.identifyPhase.
 */
export function detectMotivationPhase(workouts: { date: string }[]): MotivationPhaseResult {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dates = (Array.isArray(workouts) ? workouts : [])
    .map(w => w && typeof (w as any).date === 'string' ? (w as any).date.slice(0, 10) : '')
    .filter(Boolean)
    .sort();
  let weeksInProgram = 0;
  if (dates.length > 0) {
    const first = new Date(dates[0] + 'T00:00:00');
    weeksInProgram = Math.max(0, Math.floor((today.getTime() - first.getTime()) / (7 * 86400000)));
  }
  const perfs = sessionsBestE1RM(workouts as any[]);
  let lastPRDaysAgo = 999;
  if (perfs.length > 0) {
    const best = perfs.reduce((a, b) => (a.e1rm >= b.e1rm ? a : b));
    lastPRDaysAgo = Math.max(0, Math.round((today.getTime() - new Date(best.date + 'T00:00:00').getTime()) / 86400000));
  }
  const checks = loadCheckins().slice(-14);
  const moods = loadMoods().slice(-14);
  const confAvg = checks.length > 0 ? checks.reduce((s, c) => s + c.confidence, 0) / checks.length : 0;
  const moodAvg = moods.length > 0 ? moods.reduce((s, m) => s + m.mood, 0) / moods.length : 0;
  const motivationScore = confAvg > 0 ? Math.round(confAvg * 10) / 10 : (moodAvg > 0 ? Math.round(moodAvg * 10) / 10 : 3);
  const lowArousal = checks.filter(c => c.arousal <= 2).length;
  const lowMood = moods.filter(m => m.mood <= 2).length;
  const total = checks.length + moods.length;
  const fatigueScore = total > 0 ? Math.min(1, (lowArousal + lowMood) / total) : 0;
  const ph = identifyPhase(weeksInProgram, lastPRDaysAgo, motivationScore, fatigueScore);
  const meta = PHASE_META[ph.phase] || PHASE_META.grind;
  return {
    phase: ph.phase,
    label: meta.label,
    icon: meta.icon,
    description: ph.description,
    duration: ph.duration,
    signs: ph.signs,
    interventions: ph.interventions,
    trainingAdjustment: ph.trainingAdjustment,
    inputs: { weeksInProgram, lastPRDaysAgo, motivationScore, fatigueScore },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Psych profile insights (поля психологии профиля v2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Инсайты из профиля v2 (health.fearOfLoss / mirrorObsession / apathyOffCycle,
 * 1-5): при значениях 4-5 выдаёт конкретные психологические рекомендации.
 */
export function psychProfileInsights(): string[] {
  const out: string[] = [];
  try {
    const p = getProfile();
    const h = (p.settings as any)?.health || {};
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    if (num(h.fearOfLoss) >= 4) out.push('В профиле отмечен страх потери формы (4-5/5). Сместите фокус на процессуальные цели: «выполнить план» вместо «не потерять». Визуализация + self-talk перед подходами помогут.');
    if (num(h.mirrorObsession) >= 4) out.push('Высокая фиксация на зеркале (4-5/5): сверяйте прогресс по дневнику (веса, объёмы) и фото раз в 2-4 недели, а не ежедневно.');
    if (num(h.apathyOffCycle) >= 4) out.push('Отмечена апатия вне курса (4-5/5): снизьте планку на неделю (делод/лёгкий объём) и добавьте шаг «Фиксация победы» — он восстанавливает мотивацию.');
  } catch { /* профиль недоступен — без инсайтов */ }
  return out;
}
