/**
 * cardio-templates.engine.ts — сборка CardioCycle из именного шаблона.
 * Два пути (по meta.kind):
 *  - generator: preset + overrides → buildCardioCycle (зоны/оборудование/
 *    legDays/дни недели калибруются движком под атлета);
 *  - explicit: недели шаблона дословно (C25K/Garmin/Concept2/...) —
 *    ккал через kcalForCardio, дни через assignSessionDays, урезка под
 *    daysAvailable через capSessionsToDays. Темп/сплит — в purpose
 *    (честно: движок не выдумывает темпы за источник).
 */

import {
  assignSessionDays,
  applyCardioCompetitionCascade,
  buildCardioCycle,
  cardioHeartZones,
  lthrZones,
  zonesFromTalkTest,
  CARDIO_LEVEL_MULT,
  kcalForCardio,
  CARDIO_GOAL_LABELS,
  type CardioCycle,
  type CardioCycleInput,
  type CardioEquipment,
  type CardioPhase,
  type CardioSession,
  type CardioType,
  type CardioWeek,
  type HeartZone,
} from './cardio.engine';
import type { CardioCycleTemplate } from '../../data/cardio-cycles/cardio-cycle-types';
import { getCardioCycleTemplateById } from '../../data/cardio-cycles/cardio-cycle-index';
import { applyMesoMult } from './cardio-meso-progression.engine';
import { applyPersonalTargetsToCycle } from './cardio-personal-zones.engine';
import { screenCardioRedFlags } from './cardio-red-flags.engine';

const INTENSITY_OF: Record<string, 'low' | 'moderate' | 'high'> = {
  zone2: 'moderate',
  miss: 'moderate',
  hiit: 'high',
  recovery: 'low',
};

export interface CardioTemplateOverrides {
  bodyWeight?: number;
  bodyFatPct?: number;
  age?: number;
  restingHr?: number;
  sex?: 'male' | 'female';
  level?: CardioCycleInput['level'];
  daysAvailable?: number;
  equipment?: CardioCycleInput['equipment'];
  lowImpact?: boolean;
  legDays?: number[];
  startDate?: string;
  sleepHours?: number;
  stressLevel?: number;
  hrvMs?: number;
  enhanced?: boolean;
  /** Эталон пульса (Friel 30') — приоритетнее talk-test и возраста. */
  lthr?: number;
  /** Потолок Z2 по talk-test. */
  talkZone2Hr?: number;
  /** Формула ЧССмакс для возрастных зон. */
  maxHrFormula?: 'classic' | 'tanaka' | 'gulati';
  /** №4 PRO-2-добивки: красные флаги — генераторные идут через buildCardioCycle
   *  (мед-блок применяется), явные НЕ режутся (авторский план), а честно
   *  помечаются предупреждением в rationale. */
  redFlags?: string[];
  /** Авто-учёт суставов из профиля: chronicConditions + флаг → lowImpact. */
  autoLowImpact?: boolean;
  jointIssues?: boolean;
}

function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Индекс пульсовой зоны по типу сессии (0..4 = Z1..Z5). */
const ZONE_OF: Record<CardioType, number> = { recovery: 0, zone2: 1, miss: 2, hiit: 3 };
/** Ударные виды, которые при lowImpact заменяются (суставы). */
const IMPACTFUL_EQUIPMENT: ReadonlySet<CardioEquipment> = new Set<CardioEquipment>(['running']);

/** Зоны атлета для авторского плана: LTHR > talk-test > возраст (как в генераторе). */
function templateZones(o: CardioTemplateOverrides): HeartZone[] | undefined {
  if (o.lthr != null && o.lthr >= 80 && o.lthr <= 220) return lthrZones(Math.round(o.lthr));
  if (o.talkZone2Hr != null && o.talkZone2Hr >= 80 && o.talkZone2Hr <= 200) {
    return zonesFromTalkTest(o.talkZone2Hr) ?? undefined;
  }
  return o.age != null ? cardioHeartZones(o.age, o.restingHr, undefined, o.sex, o.maxHrFormula) : undefined;
}

/**
 * Авторские недели → недели цикла.
 *
 * Раньше функция собирала сессии без `targetHr`, игнорировала `level` и
 * `lowImpact` и молча выбрасывала лишние сессии под `daysAvailable`. Теперь:
 *  - пульсовые цели берутся из зон атлета (иначе факт-ЧСС автокоррекция мертва);
 *  - несовпадение уровня не скрывается: новичку объём ×0.8 + явная нота;
 *  - lowImpact заменяет ударное оборудование, а не оставляет бег;
 *  - урезание под дни сопровождается нотой с ценой (сколько минут потеряно).
 */
function buildExplicitWeeks(
  tpl: CardioCycleTemplate,
  o: CardioTemplateOverrides,
): { weeks: CardioWeek[]; totalKcal: number; notes: string[] } {
  const bw = o.bodyWeight ?? tpl.preset.bodyWeight ?? 80;
  const sex = o.sex ?? tpl.preset.sex ?? 'male';
  const ffmKg = typeof o.bodyFatPct === 'number' && o.bodyFatPct >= 3 && o.bodyFatPct <= 70
    ? Math.round(bw * (1 - o.bodyFatPct / 100) * 10) / 10
    : undefined;
  const explicit = tpl.weeks ?? [];
  const daysCap = o.daysAvailable != null ? Math.max(1, Math.min(7, Math.round(o.daysAvailable))) : undefined;
  const zones = templateZones(o);
  const lowImpact = !!o.lowImpact || (!!o.autoLowImpact && !!o.jointIssues) || !!tpl.preset.lowImpact;
  const athleteEquipment = (o.equipment ?? []).filter(e => !lowImpact || !IMPACTFUL_EQUIPMENT.has(e));
  const lowImpactFallback: CardioEquipment =
    (athleteEquipment.find(e => e === 'cycling') ?? athleteEquipment.find(e => e === 'elliptical') ?? athleteEquipment[0] ?? 'cycling');
  const normalFallback: CardioEquipment = athleteEquipment[0] ?? 'running';
  const level = o.level ?? tpl.preset.level ?? 'intermediate';
  const templateLevels = tpl.meta.level ?? [];
  const levelMismatch = templateLevels.length > 0 && !templateLevels.includes(level);
  const beginnerOnHardPlan = levelMismatch && level === 'beginner';
  // Новичок на плане выше своего уровня: режем объём, но структуру недель не рвём.
  const levelMult = beginnerOnHardPlan ? CARDIO_LEVEL_MULT.beginner : 1;
  const notes: string[] = [];
  if (beginnerOnHardPlan) {
    notes.push(`⚠ «${tpl.meta.title}» рассчитан на уровень ${templateLevels.join('/')}: для новичка объём сессий ×${CARDIO_LEVEL_MULT.beginner} (структура сохранена).`);
  } else if (levelMismatch) {
    notes.push(`Уровень плана: ${templateLevels.join('/')} — у вас «${level}»; структура не менялась.`);
  }
  if (lowImpact) notes.push('🦵 Низкоударный режим: беговые сессии заменены на вело/эллипс.');
  const weeks: CardioWeek[] = [];
  let totalKcal = 0;
  explicit.forEach((tw, idx) => {
    const w = idx + 1;
    let sessions: CardioSession[] = tw.sessions.map((s, si) => {
      const declared = s.equipment ?? o.equipment?.[0] ?? tpl.preset.equipment?.[0] ?? tpl.meta.equipment[0] ?? 'running';
      const equip: CardioEquipment = lowImpact && IMPACTFUL_EQUIPMENT.has(declared) ? lowImpactFallback : declared;
      const durationMin = Math.max(10, Math.round(s.durationMin * levelMult));
      const zone = zones?.[ZONE_OF[s.type]];
      const targetHr = zone ? { min: zone.bpmMin, max: zone.bpmMax } : undefined;
      const structured = s.structured?.map(blk => (
        blk.targetHr || !zone ? blk : { ...blk, targetHr: { min: zone.bpmMin, max: zone.bpmMax } }
      ));
      return {
        id: `tpl-${tpl.meta.id}-w${w}-s${si + 1}`,
        type: s.type,
        durationMin,
        weeklyFrequency: 1,
        intensity: INTENSITY_OF[s.type] ?? 'moderate',
        kcalPerSession: kcalForCardio(s.type, durationMin, bw, equip, sex, ffmKg),
        purpose: s.purpose ?? `${tpl.meta.title}: нед ${w}`,
        equipment: equip,
        structured,
        dayOfWeek: s.dayOfWeek,
        targetHr,
      } satisfies CardioSession;
    });
    if (daysCap != null && daysCap < 7 && sessions.length > daysCap) {
      // Сохраняем ключевые стимулы: recovery уходит первым, затем MISS.
      const dropped: CardioSession[] = [];
      const keepPriority = (t: CardioType): number => (t === 'recovery' ? 3 : t === 'miss' ? 2 : t === 'zone2' ? 1 : 0);
      const ordered = [...sessions].sort((a, b) => keepPriority(a.type) - keepPriority(b.type));
      const kept = ordered.slice(0, daysCap);
      for (const s of sessions) if (!kept.includes(s)) dropped.push(s);
      sessions = sessions.filter(s => kept.includes(s));
      const lostMin = dropped.reduce((sum, s) => sum + s.durationMin, 0);
      const lostKcal = dropped.reduce((sum, s) => sum + s.kcalPerSession, 0);
      if (dropped.length > 0) {
        notes.push(`⚠ Неделя ${w}: авторский план шире ваших ${daysCap} дн/нед — убрано ${dropped.length} сесс. (${dropped.map(s => s.type.toUpperCase()).join(', ')}), −${lostMin} мин / −${lostKcal} ккал в этой неделе.`);
      }
    }
    sessions = assignSessionDays(sessions, o.legDays ?? tpl.preset.legDays);
    const phase: CardioPhase = tw.phase ?? 'base';
    const deload = !!tw.deload;
    const taper = !!tw.taper || phase === 'taper' || phase === 'peak';
    const weekMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    const weekKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
    totalKcal += weekKcal;
    const rationale = [`📚 Шаблон «${tpl.meta.title}» (${tpl.meta.sourceLabel}).`];
    if (tw.note) rationale.push(tw.note);
    if (deload) rationale.push('Делод по источнику: объём снижен.');
    if (taper) rationale.push('Подводка/пик по источнику.');
    if (zones && zones.length > 0) rationale.push(`🎯 Целевые пульс-зоны подставлены из ваших эталонов (${o.lthr != null ? 'LTHR' : o.talkZone2Hr != null ? 'talk-test' : 'возраст'}).`);
    weeks.push({ week: w, phase, sessions, totalMinutes: weekMinutes, totalKcal: weekKcal, deload, taper, rationale });
  });
  if (normalFallback !== lowImpactFallback && lowImpact) {
    notes.push(`Оборудование по умолчанию: ${lowImpactFallback}.`);
  }
  return { weeks, totalKcal, notes };
}

/**
 * Собрать CardioCycle из шаблона библиотеки.
 * Генераторные — через buildCardioCycle (полная персонализация);
 * явные — дословно по источнику с пересчётом ккал/дней под атлета.
 */
export function buildCardioCycleFromTemplate(
  tpl: CardioCycleTemplate,
  overrides: CardioTemplateOverrides = {},
): CardioCycle {
  if (tpl.meta.kind === 'generator' || !tpl.weeks || tpl.weeks.length === 0) {
    const input: CardioCycleInput = {
      ...tpl.preset,
      ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
      name: tpl.meta.title,
    };
    const c = buildCardioCycle(input);
    c.rationale = [`📚 Шаблон «${tpl.meta.title}» (${tpl.meta.sourceLabel}).`, ...c.rationale];
    return c;
  }
  const { weeks, totalKcal, notes } = buildExplicitWeeks(tpl, overrides);
  const merged: CardioCycleInput = {
    ...tpl.preset,
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
    // Штамп источника: валидатор градирует острые недели как авторские.
    templateId: tpl.meta.id,
  };
  const rationale = [
    `📚 Шаблон «${tpl.meta.title}» (${tpl.meta.sourceLabel}).`,
    tpl.meta.howItWorks,
    `Цель: ${CARDIO_GOAL_LABELS[tpl.meta.goal]} · ${tpl.meta.weeks} нед · ${tpl.meta.sessionsPerWeek} д/нед.`,
    ...notes,
  ];
  // №4 PRO-2-добивки: явный шаблон не режем, но честно предупреждаем.
  try {
    const blocked = screenCardioRedFlags(overrides.redFlags, overrides.age).blockHiit;
    if (blocked && weeks.some(w => w.sessions.some(s => s.type === 'hiit' || s.type === 'miss'))) {
      rationale.push('⚠ В авторском плане есть HIIT/MISS, а у вас мед-блок — запрещены до очной консультации врача (план не меняли, решайте с врачом).');
    }
  } catch { /* скрининг опционален */ }
  return {
    id: `cardio-tpl-${tpl.meta.id}-${Date.now()}`,
    name: tpl.meta.title,
    goal: tpl.meta.goal,
    totalWeeks: tpl.meta.weeks,
    weeks,
    totalKcal,
    source: 'auto',
    version: 1,
    createdAt: new Date().toISOString(),
    rationale,
    startDate: merged.startDate ?? localToday(),
    config: merged,
  };
}

/** Собрать цикл по id шаблона (null при неизвестном id — честно, без fallback). */
export function buildCardioCycleFromTemplateId(
  templateId: string,
  overrides: CardioTemplateOverrides = {},
): CardioCycle | null {
  const tpl = getCardioCycleTemplateById(templateId);
  if (!tpl) return null;
  return buildCardioCycleFromTemplate(tpl, overrides);
}

/**
 * Пересобрать цикл из его же `config` («⚙️ Изменить параметры»).
 *
 * Ключевое: если цикл пришёл из именного шаблона (`config.templateId`),
 * пересборка идёт ЧЕРЕЗ ШАБЛОН, а не генератором — раньше правка параметров
 * уничтожала авторский план (C25K/Хигдон/Concept2 превращались в
 * сгенерированный цикл с тем же именем). Для генераторных циклов —
 * обычный `buildCardioCycle` с тем же config.
 */
export function rebuildCardioCycleFromConfig(
  cycle: CardioCycle,
  opts: { preserveIdentity?: boolean; overrides?: Partial<CardioCycleInput> } = {},
): CardioCycle {
  const cfg: CardioCycleInput = { ...(cycle.config ?? {}), ...(opts.overrides ?? {}) } as CardioCycleInput;
  const tplId = typeof (cfg as { templateId?: unknown }).templateId === 'string'
    ? (cfg as { templateId: string }).templateId
    : '';
  const tpl = tplId ? getCardioCycleTemplateById(tplId) : undefined;
  let rebuilt: CardioCycle;
  const extra: string[] = [];
  if (tpl) {
    rebuilt = buildCardioCycleFromTemplate(tpl, overridesFromConfig(cfg));
    extra.push('⚙️ Пересборка из авторского шаблона: ручные правки отдельных недель сброшены к источнику.');
    if (cfg.totalWeeks != null && cfg.totalWeeks !== tpl.meta.weeks) {
      extra.push(`Длина цикла зафиксирована источником: ${tpl.meta.weeks} нед (запрошено ${cfg.totalWeeks}).`);
    }
  } else {
    rebuilt = buildCardioCycle({ ...cfg, config: cfg });
  }
  const preserve = opts.preserveIdentity !== false;
  const out: CardioCycle = preserve
    ? {
        ...rebuilt,
        id: cycle.id,
        name: cycle.name ?? rebuilt.name,
        createdAt: cycle.createdAt ?? rebuilt.createdAt,
        // Явная дата в overrides (правка формы «Дата старта») важнее старой:
        // иначе смена даты молча откатывалась к прежней. Без override —
        // сохраняем дату цикла, как и раньше.
        startDate: cfg.startDate ?? cycle.startDate ?? rebuilt.startDate,
        linkedMacrocycleId: cycle.linkedMacrocycleId ?? rebuilt.linkedMacrocycleId,
        linkedCompetitionIds: cycle.linkedCompetitionIds ?? rebuilt.linkedCompetitionIds,
        version: 1 as CardioCycle['version'],
      }
    : rebuilt;
  if (extra.length > 0) out.rationale = [...out.rationale, ...extra];
  return out;
}

/** config → переопределения шаблона (поля атлета, а не структура плана). */
function overridesFromConfig(cfg: CardioCycleInput): CardioTemplateOverrides {
  return {
    bodyWeight: cfg.bodyWeight,
    bodyFatPct: cfg.bodyFatPct,
    age: cfg.age,
    restingHr: cfg.restingHr,
    sex: cfg.sex,
    level: cfg.level,
    daysAvailable: cfg.daysAvailable,
    equipment: cfg.equipment,
    lowImpact: cfg.lowImpact,
    legDays: cfg.legDays,
    startDate: cfg.startDate,
    sleepHours: cfg.sleepHours,
    stressLevel: cfg.stressLevel,
    hrvMs: cfg.hrvMs,
    enhanced: cfg.enhanced,
    lthr: cfg.lthr,
    talkZone2Hr: cfg.talkZone2Hr,
    maxHrFormula: cfg.maxHrFormula,
    redFlags: cfg.redFlags,
    autoLowImpact: cfg.autoLowImpact,
    jointIssues: cfg.jointIssues,
  };
}

export interface CardioFinishOpts {
  /** Старты с приоритетами (каскад A/B/C). */
  competitions?: { week: number; priority?: 'A' | 'B' | 'C' }[];
  /** false = явный opt-out: каскад не накладывается (наращивание). */
  taperEnabled?: boolean;
  /** Множитель кросс-мезо (>1 — применить). */
  mesoMult?: number;
  /** Темпы VDOT, с/км (не заданы — не дописываются). */
  easyPaceSec?: number;
  tempoPaceSec?: number;
  intervalPaceSec?: number;
  /** FTP вело/гребли, Вт. */
  ftpWatts?: number;
}

/**
 * Пост-обработка собранного цикла (единая для сборки/варианта/шаблона/preview):
 * каскад стартов → кросс-мезо → темпы VDOT/FTP. Чистая (вход не мутируется).
 * Применённые темпы/мезо штампуются в config — для «⚙️ Изменить параметры».
 */
export function finishCardioCycle(cycle: CardioCycle, opts: CardioFinishOpts = {}): CardioCycle {
  let out = cycle;
  // Аудит спринта 5.2: слои, которые ПРОСИЛИ, но не применились, раньше терялись
  // в `catch { /* ignore */ }`, а стамп всё равно писался — план врал («мезо
  // включено» / темпы заданы), хотя ничего не применилось. Теперь стамп ставится
  // только под факт, а пропуск попадает в config.finishNote для показа.
  const skipped: string[] = [];
  // P1-аудит: cross-meso ПЕРЕД каскадом соревнований. Обратный порядок
  // раздувал готовые taper/peak/гоночные недели стартовым множителем
  // (×1.15 поверх уже срезанного объёма).
  let mesoOk = false;
  if (opts.mesoMult != null && opts.mesoMult > 1) {
    try { out = applyMesoMult(out, opts.mesoMult); mesoOk = true; }
    catch (e) { skipped.push(`мезо ×${opts.mesoMult}`); console.warn('[cardio] мезо-масштабирование не применено', e); }
  }
  if (opts.taperEnabled !== false && opts.competitions && opts.competitions.length > 0) {
    try {
      out = applyCardioCompetitionCascade(out, opts.competitions.map(x => ({ week: x.week, priority: x.priority ?? 'B' })));
    } catch (e) { skipped.push('каскад соревнований (taper/peak)'); console.warn('[cardio] каскад соревнований не применён', e); }
  }
  const personalRequested = [opts.easyPaceSec, opts.tempoPaceSec, opts.intervalPaceSec, opts.ftpWatts].some(v => v != null);
  let personalOk = false;
  try {
    out = applyPersonalTargetsToCycle(out, {
      easyPaceSec: opts.easyPaceSec,
      tempoPaceSec: opts.tempoPaceSec,
      intervalPaceSec: opts.intervalPaceSec,
      ftpWatts: opts.ftpWatts,
    });
    personalOk = true;
  } catch (e) {
    if (personalRequested) { skipped.push('персональные темпы/FTP'); console.warn('[cardio] персональные цели не применены', e); }
  }
  const stamp: Record<string, number | boolean | string> = {};
  // Стампы — только под реально применённые слои.
  if (personalOk) {
    if (opts.easyPaceSec != null) stamp.paceEasySec = opts.easyPaceSec;
    if (opts.tempoPaceSec != null) stamp.paceTempoSec = opts.tempoPaceSec;
    if (opts.intervalPaceSec != null) stamp.paceIntervalSec = opts.intervalPaceSec;
    if (opts.ftpWatts != null) stamp.ftpWattsApplied = opts.ftpWatts;
  }
  if (mesoOk && opts.mesoMult != null && opts.mesoMult > 1) stamp.mesoOn = true;
  if (skipped.length > 0) stamp.finishNote = `⚠ Просили, но НЕ применилось: ${skipped.join(' · ')}`;
  if (Object.keys(stamp).length > 0) {
    out = { ...out, config: { ...(out.config as CardioCycleInput | undefined), ...stamp } as CardioCycleInput };
  }
  return out;
}
