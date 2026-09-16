/**
 * bb-pain-monitor.engine.ts — правило прогрессии нагрузки по боли (чистые функции, без стора).
 *
 * Канон: Silbernagel pain-monitoring model (AJSM 2007; JOSPT 2015; PMC9528703):
 * боль ≤5/10 во время допустима, но на следующее утро должна быть <5;
 * рост недельной боли — снижать нагрузку. Патellar-ветка (BJSM 2021): провокация
 * «одиночный присед», прогрессия при VAS ≤3.
 *
 * Это правило нагрузки, НЕ диагноз и не лечение: стойкая боль 2–3 нед — маршрут к врачу.
 */

export type PainLocation = 'patellar' | 'achilles' | 'elbow' | 'shoulder' | 'lower_back' | 'other';

export interface PainLocationDef {
  id: PainLocation;
  label: string;
  provocation: string;
}

export const PAIN_LOCATIONS: PainLocationDef[] = [
  { id: 'patellar', label: 'Колено (связка надколенника)', provocation: 'Одиночный присед на возвышении 25° — 5 медленных повторов, или изометрия 30 с' },
  { id: 'achilles', label: 'Ахилл', provocation: 'Подъёмы на носок одной ногой 10–15 повторов, или изометрия 30 с' },
  { id: 'elbow', label: 'Локоть (тендинопатия)', provocation: 'Изометрия хвата/разгибания 30 с, или лёгкая тяга 10 повторов' },
  { id: 'shoulder', label: 'Плечо', provocation: 'Лёгкий жим 10 повторов, или изометрия отведения 30 с' },
  { id: 'lower_back', label: 'Поясница', provocation: 'Шарнир без веса / лёгкая RDL 10 повторов — связь с движением, а не «просто болит»' },
  { id: 'other', label: 'Другое', provocation: 'Проба, которая воспроизводит боль в зале — 5–10 повторов' },
];

export function painLocationLabel(loc: PainLocation | '' | null | undefined): string {
  return PAIN_LOCATIONS.find((p) => p.id === loc)?.label || 'Боль';
}

export function provocationFor(loc: PainLocation | '' | null | undefined): string {
  return (PAIN_LOCATIONS.find((p) => p.id === loc) || PAIN_LOCATIONS[PAIN_LOCATIONS.length - 1]).provocation;
}

export interface PainMonitorInput {
  location?: PainLocation | '' | null;
  /** Боль во время/сразу после нагрузки, 0–10. */
  during010?: number | null;
  /** Боль на следующее утро, 0–10. */
  nextMorning010?: number | null;
  /** Боль растёт от недели к неделе (тренд). */
  weeksRising?: boolean;
  nightPain?: boolean;
  sharp?: boolean;
}

export type PainMonitorLevel = 'green' | 'yellow' | 'red' | 'not_tested';

export interface PainMonitorVerdict {
  tested: boolean;
  level: PainMonitorLevel;
  text: string;
  advice: string;
}

export const PAIN_MONITOR_DISCLAIMER =
  'Правило прогрессии нагрузки (Silbernagel): ≤5/10 во время и <5 на следующее утро; это не диагноз и не лечение — при стойкой боли 2–3 нед к врачу';

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : null;
};

export function painMonitorVerdict(s: PainMonitorInput): PainMonitorVerdict {
  const d = num(s.during010);
  const m = num(s.nextMorning010);
  const tested = d != null || m != null || !!s.nightPain || !!s.sharp;
  if (!tested) return { tested: false, level: 'not_tested', text: 'Боль-мониторинг: не заполнен', advice: '' };

  const loc = painLocationLabel(s.location);
  if (s.nightPain || s.sharp) {
    return {
      tested: true,
      level: 'red',
      text: `${loc}: ночная/резкая боль — красный (стоп-нагрузка, не «терпеть»)`,
      advice: 'Убрать провоцирующее движение, оставить безболевые варианты; стойкая боль — к врачу, это не диагноз',
    };
  }
  if (d != null && d > 5) {
    return {
      tested: true,
      level: 'red',
      text: `${loc}: боль ${d}/10 во время (>5) — красный`,
      advice: 'Снизить объём до боли ≤3/10: меньше подходов/амплитуда/темп, без отказа; при >2 нед — врач',
    };
  }
  if (m != null && m > 6) {
    return {
      tested: true,
      level: 'red',
      text: `${loc}: боль ${m}/10 на утро (>6) — красный`,
      advice: 'Утро не восстанавливается — резать объём и вес, сон/питание; перепроверка 3–7 дней',
    };
  }
  if (s.weeksRising) {
    return {
      tested: true,
      level: 'yellow',
      text: `${loc}: боль растёт от недели к неделе — жёлтый`,
      advice: 'Удержать объём и вес 3–7 дней (не повышать), затем перепроверка по правилу',
    };
  }
  if (m != null && m >= 5) {
    return {
      tested: true,
      level: 'yellow',
      text: `${loc}: утром ${m}/10 (≥5) — жёлтый`,
      advice: 'Удержать объём 3–7 дней, без повышения веса; к зелёному — утро <5',
    };
  }
  if (d == null) {
    return {
      tested: true,
      level: 'yellow',
      text: `${loc}: «во время» не замерено — правило неполное`,
      advice: 'Замерь боль во время и на утро (0–10) — без этого прогрессия вслепую',
    };
  }
  return {
    tested: true,
    level: 'green',
    text: `${loc}: зелёный (${d}/10 днём, ${m ?? '—'}/10 утром) — нагрузку можно`,
    advice: 'Прогрессия +1 подход или +2.5% при спокойном утре; боль >5 днём или ≥5 утром — стоп-повышение',
  };
}

/** Компактная строка для экспорта/моста ('' — не заполнено). */
export function painMonitorLine(s: PainMonitorInput): string {
  const v = painMonitorVerdict(s);
  if (!v.tested) return '';
  const loc = painLocationLabel(s.location);
  const d = num(s.during010);
  const m = num(s.nextMorning010);
  return `Боль [${loc}]: ${v.level === 'red' ? 'красный' : v.level === 'yellow' ? 'жёлтый' : 'зелёный'} — ${d ?? '—'}/10 днём, ${m ?? '—'}/10 утром (порог ≤5/<5)`;
}
