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
  buildCardioCycle,
  capSessionsToDays,
  kcalForCardio,
  CARDIO_GOAL_LABELS,
  type CardioCycle,
  type CardioCycleInput,
  type CardioPhase,
  type CardioSession,
  type CardioWeek,
} from './cardio.engine';
import type { CardioCycleTemplate } from '../../data/cardio-cycles/cardio-cycle-types';
import { getCardioCycleTemplateById } from '../../data/cardio-cycles/cardio-cycle-index';

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
}

function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function buildExplicitWeeks(
  tpl: CardioCycleTemplate,
  o: CardioTemplateOverrides,
): { weeks: CardioWeek[]; totalKcal: number } {
  const bw = o.bodyWeight ?? tpl.preset.bodyWeight ?? 80;
  const ffmKg = typeof o.bodyFatPct === 'number' && o.bodyFatPct >= 3 && o.bodyFatPct <= 70
    ? Math.round(bw * (1 - o.bodyFatPct / 100) * 10) / 10
    : undefined;
  const explicit = tpl.weeks ?? [];
  const daysCap = o.daysAvailable != null ? Math.max(1, Math.min(7, Math.round(o.daysAvailable))) : undefined;
  const weeks: CardioWeek[] = [];
  let totalKcal = 0;
  explicit.forEach((tw, idx) => {
    const w = idx + 1;
    let sessions: CardioSession[] = tw.sessions.map((s, si) => {
      const equip = s.equipment ?? o.equipment?.[0] ?? tpl.preset.equipment?.[0] ?? tpl.meta.equipment[0] ?? 'running';
      return {
        id: `tpl-${tpl.meta.id}-w${w}-s${si + 1}`,
        type: s.type,
        durationMin: s.durationMin,
        weeklyFrequency: 1,
        intensity: INTENSITY_OF[s.type] ?? 'moderate',
        kcalPerSession: kcalForCardio(s.type, s.durationMin, bw, equip, o.sex, ffmKg),
        purpose: s.purpose ?? `${tpl.meta.title}: нед ${w}`,
        equipment: equip,
        structured: s.structured,
        dayOfWeek: s.dayOfWeek,
      } satisfies CardioSession;
    });
    if (daysCap != null && daysCap < 7 && sessions.length > daysCap) {
      sessions = capSessionsToDays(sessions, daysCap);
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
    weeks.push({ week: w, phase, sessions, totalMinutes: weekMinutes, totalKcal: weekKcal, deload, taper, rationale });
  });
  return { weeks, totalKcal };
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
  const { weeks, totalKcal } = buildExplicitWeeks(tpl, overrides);
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
  ];
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
