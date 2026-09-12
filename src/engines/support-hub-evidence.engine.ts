/**
 * support-hub-evidence.engine.ts — честные данные хаба «Общая информация» (P1+P2+P3).
 * НЕ трогает калькулятор поддержки. Только справочные функции для хаба.
 *
 * P1: диапазоны биодоступности + источник + маркетинг-флаг (Examine/NIH/PMC-семантика).
 * P2: единое терапевтическое окно (THERAPEUTIC_WINDOWS + DOSE_RANGES) + UL + вес/пол/возраст-хинты.
 * P3: расширенные грейды доказательности в семантике Examine (A/B/C/D + исход).
 */

export type BioSource = 'RCT' | 'meta' | 'review' | 'claim';

export interface BioFormEvidence {
  /** точечная оценка из FORM_BIOAVAIL (совместимость) */
  point: number;
  /** честный диапазон */
  lo: number;
  hi: number;
  source: BioSource;
  /** true = маркетинговое «×N» без head-to-head клиники */
  marketing: boolean;
  note: string;
}

/**
 * Курируемые диапазоны ключевых форм.
 * Источники: Examine (NovaSol×185/CurcuWin×136/LongVida×100/Meriva×48/BCM-95×27/Theracurmin×16),
 * Kroon 2025 (неконъюгированный куркумин <2–38 нМ даже у «усиленных» форм; пиперин без пользы),
 * NIH ODS (Mg цитрат/аспартат/лактат/хлорид > оксид/сульфат), Kreider 2022 (креатин — только
 * моногидрат с полной триадой), PMC 2025 (8 турмерик-продуктов: релиз <40%, fasted <10%).
 * Всё остальное — claim с широким диапазоном, а не точка.
 */
const CURATED: Record<string, { lo: number; hi: number; source: BioSource; marketing: boolean; note: string }> = {
  curcumin_std: { lo: 0.005, hi: 0.02, source: 'meta', marketing: false, note: 'Стандартный куркумин: системная биодоступность минимальна (глюкуронидация first-pass).' },
  curcumin_piperine: { lo: 0.02, hi: 0.08, source: 'RCT', marketing: true, note: 'Пиперин: маркетинговые «×20». Kroon 2025 (кросс-over): добавления пиперина к 2400 мг не повысили ни общую, ни свободную экспозицию.' },
  curcumin_meriva: { lo: 0.3, hi: 0.65, source: 'RCT', marketing: false, note: 'Meriva (фитосома): заявлено ×48 к стандарту по конъюгатам; сравнение по свободному куркумину head-to-head почти отсутствует.' },
  curcumin_theracurmin: { lo: 0.3, hi: 0.65, source: 'RCT', marketing: false, note: 'Theracurmin (нано): заявлено ×16–27; свободный куркумин всё равно наномолярный (в 100–1000× ниже in-vitro порогов).' },
  curcumin_liposomal: { lo: 0.3, hi: 0.7, source: 'review', marketing: true, note: 'Липосомальные/мицеллярные (NovaSol ×185, CurcuWin ×136, LongVida ×100): цифры — по конъюгатам. Свободный куркумин остаётся минимальным. Принимать с жирной едой (fed-state релиз выше).' },
  creatine_monohydrate: { lo: 0.95, hi: 1.0, source: 'meta', marketing: false, note: 'Золотой стандарт (Kreider 2022): единственная форма с полной триадой био/эффект/безопасность. % креатина по MW 87.9%.' },
  creatine_hcl: { lo: 0.7, hi: 0.85, source: 'claim', marketing: true, note: 'HCl: растворимость ×40, но преимуществ по ретенции/силе в head-to-head нет. % креатина по MW ниже (78.2%).' },
  creatine_ethyl: { lo: 0.15, hi: 0.35, source: 'review', marketing: true, note: 'Этиловый эфир: в ЖКТ быстро деградирует до креатинина; как источник креатина не подтверждён.' },
  mg_oxide: { lo: 0.03, hi: 0.08, source: 'meta', marketing: false, note: 'NIH ODS: оксид/сульфат — низкая абсорбция (плохая растворимость).' },
  mg_citrate: { lo: 0.4, hi: 0.65, source: 'meta', marketing: false, note: 'NIH ODS: цитрат/аспартат/лактат/хлорид абсорбируются полнее оксида.' },
  mg_glycinate: { lo: 0.6, hi: 0.85, source: 'review', marketing: false, note: 'Бисглицинат: хорошая переносимость; дозы — в мг ЭЛЕМЕНТА, не соли.' },
  mg_bisglycinate: { lo: 0.6, hi: 0.85, source: 'review', marketing: false, note: 'Бисглицинат: хорошая переносимость; дозы — в мг ЭЛЕМЕНТА, не соли.' },
  mg_threonate: { lo: 0.5, hi: 0.7, source: 'RCT', marketing: false, note: 'Треонат: ЦНС-фокус в маркетинге; системная абсорбция — как у растворимых солей.' },
  zn_oxide: { lo: 0.1, hi: 0.25, source: 'review', marketing: false, note: 'Оксид цинка: низкая абсорбция; для коррекции дефицита — пиколинат/бисглицинат.' },
  zn_picolinate: { lo: 0.7, hi: 0.9, source: 'review', marketing: false, note: 'Пиколинат: высокая абсорбция в обзорах; при дозе >40 мг/сут — баланс Cu (Zn:Cu 10:1).' },
  fe_sulfate: { lo: 0.1, hi: 0.25, source: 'meta', marketing: false, note: 'Сульфат: дёшево, но ЖКТ-побочки; бисглицинат переносится лучше.' },
  fe_bisglycinate: { lo: 0.35, hi: 0.55, source: 'RCT', marketing: false, note: 'Бисглицинат Fe: выше абсорбция и переносимость; принимать утром + C, врозь с Ca/кофе.' },
  d3_regular: { lo: 0.5, hi: 0.7, source: 'RCT', marketing: false, note: 'D3: с жирной едой (≥10 г жира) уровень выше до ~50%; без жира падает.' },
  d3_oil: { lo: 0.7, hi: 0.9, source: 'RCT', marketing: false, note: 'D3 в масле: стандарт; контроль 25(OH)D каждые 3–6 мес.' },
  d3_liposomal: { lo: 0.8, hi: 0.95, source: 'claim', marketing: true, note: 'Липосомальный D3: преимущество над масляным в head-to-head не доказано.' },
  b12_cyano: { lo: 0.01, hi: 0.03, source: 'meta', marketing: false, note: 'Цианокобаламин: пассивная абсорбция ~1–2%; при дефиците — сублингвально/в/м по врачу.' },
  b12_methyl: { lo: 0.4, hi: 0.6, source: 'review', marketing: false, note: 'Метилкобаламин: активные формы предпочтительны при 60+ и на ИПП/метформине.' },
  omega3_ee: { lo: 0.4, hi: 0.55, source: 'RCT', marketing: false, note: 'Этиловые эфиры: базовая форма; с главным приёмом пищи.' },
  omega3_tg: { lo: 0.6, hi: 0.75, source: 'RCT', marketing: false, note: 'Триглицеридная/rTG: абсорбция выше EE.' },
  omega3_rTG: { lo: 0.6, hi: 0.75, source: 'RCT', marketing: false, note: 'rTG: абсорбция выше EE; head-to-head TG vs rTG ограничены.' },
  omega3_pl: { lo: 0.65, hi: 0.8, source: 'review', marketing: false, note: 'Фосфолипидная (криль): хорошая абсорбция, но доза EPA+DHA на капсулу ниже.' },
};

export function bioEvidenceFor(formKey: string, point: number): BioFormEvidence {
  const c = CURATED[formKey];
  if (c) return { point, ...c };
  // Дефолт: честный широкий диапазон вокруг точки, источник — заявление производителя.
  const lo = Math.max(0, +(point * 0.6).toFixed(2));
  const hi = Math.min(1, +(point * 1.25).toFixed(2));
  return {
    point,
    lo,
    hi,
    source: 'claim',
    marketing: point >= 0.8 && /lipo|nano|phyto|meriva|thera|novasol|curcuwin|longvida/i.test(formKey),
    note: 'Прямых head-to-head РКИ этой формы нет — значение ориентировочное.',
  };
}

export function bioEvidenceLabel(e: BioFormEvidence): string {
  const src = e.source === 'meta' ? 'мета-анализ' : e.source === 'RCT' ? 'РКИ' : e.source === 'review' ? 'обзор' : 'заявление производителя';
  return `${Math.round(e.lo * 100)}–${Math.round(e.hi * 100)}% · ${src}${e.marketing ? ' · ⚠ маркетинг' : ''}`;
}

// ─── P3: грейды в семантике Examine ───

export type EvidenceGradeEx = 'A' | 'B' | 'C' | 'D';
export const EVIDENCE_GRADE_RU: Record<EvidenceGradeEx, string> = {
  A: 'A — высокий (много консистентных РКИ, умеренный эффект)',
  B: 'B — умеренный (мало/противоречиво/малый эффект)',
  C: 'C — низкий (механизмы/традиция, без убедительных РКИ)',
  D: 'D — данных почти нет / эффект нулевой',
};

/** Исход-зависимые грейды ключевых пар (Examine-стиль: грейд = вещество→исход). */
const OUTCOME_GRADES: Record<string, EvidenceGradeEx> = {
  'creatine|muscle': 'A', 'creatine|strength': 'A', 'creatine|power': 'A',
  'vitamin_d3|deficiency': 'A', 'iron|deficiency': 'A', 'magnesium|deficiency': 'A',
  'zinc|immunity': 'A', 'nac|liver': 'A', 'omega3|triglycerides': 'A',
  'melatonin|sleep': 'A', 'caffeine|performance': 'A', 'nitrate|performance': 'B',
  'ashwagandha|stress': 'B', 'rhodiola|fatigue': 'B', 'curcumin|joint': 'B',
  'berberine|glucose': 'B', 'coq10|statin': 'B', 'probiotics|gut': 'B',
  'collagen|joint': 'C', 'glutathione|oral': 'D', 'resveratrol|longevity': 'C',
  'melatonin|jetlag': 'A',
  'magnesium|sleep': 'B', 'zinc|cold': 'B', 'vitamin_d|immunity': 'B',
  'vitamin_d3|immunity': 'B', 'vitamin_c|cold': 'B', 'omega3|depression': 'B',
  'berberine|cholesterol': 'B', 'ashwagandha|sleep': 'B', 'rhodiola|stress': 'B',
  'probiotics|antibiotic': 'B', 'collagen|skin': 'B', 'beta_alanine|endurance': 'B',
  'citrulline|performance': 'B', 'theanine|stress': 'B',
};

const BASE_GRADES: Record<string, EvidenceGradeEx> = {
  creatine: 'A', vitamin_d3: 'A', vitamin_c: 'A', vitamin_b12: 'A', folate: 'A',
  iron: 'A', magnesium: 'A', zinc: 'A', nac: 'A', omega3: 'A', coq10: 'A',
  vitamin_k2: 'A', calcium: 'A', selenium: 'A', iodine: 'A', milk_thistle: 'A',
  tudca: 'A', berberine: 'A', curcumin: 'B', ashwagandha: 'B', melatonin: 'A',
  rhodiola: 'B', resveratrol: 'C', glutathione_reduced: 'D', collagen: 'C',
  caffeine: 'A', beta_alanine: 'B', citrulline: 'B', theanine: 'B', probiotics: 'B',
};

export function evidenceGradeExFor(id: string, outcome?: string): EvidenceGradeEx {
  const key = id.toLowerCase();
  if (outcome) {
    const hit = OUTCOME_GRADES[`${key}|${outcome.toLowerCase()}`];
    if (hit) return hit;
  }
  if (BASE_GRADES[key]) return BASE_GRADES[key];
  // Префикс-матчинг: magnesium_glycinate -> magnesium и т.п.
  for (const [base, g] of Object.entries(BASE_GRADES)) {
    if (key.startsWith(base) || key.includes(base)) return g;
  }
  return 'C';
}

/** Размеченные исходы вещества (из OUTCOME_GRADES). Пусто = только базовый грейд. */
export function evidenceOutcomesFor(id: string): Array<{ outcome: string; grade: EvidenceGradeEx }> {
  const key = id.toLowerCase();
  const out: Array<{ outcome: string; grade: EvidenceGradeEx }> = [];
  for (const [k, g] of Object.entries(OUTCOME_GRADES)) {
    const sep = k.indexOf('|');
    if (sep < 0) continue;
    if (k.slice(0, sep) === key) out.push({ outcome: k.slice(sep + 1), grade: g });
  }
  return out;
}

const GRADE_ORDER: Record<EvidenceGradeEx, number> = { A: 3, B: 2, C: 1, D: 0 };

/**
 * Агрегатный грейд стека = минимум участников ( weakest link, честная подпись в UI).
 * Пустой стек = D (оценивать нечего).
 */
export function stackEvidenceGrade(substanceIds: string[]): EvidenceGradeEx {
  if (!Array.isArray(substanceIds) || substanceIds.length === 0) return 'D';
  let min: EvidenceGradeEx = 'A';
  for (const id of substanceIds) {
    const g = evidenceGradeExFor(id || '');
    if (GRADE_ORDER[g] < GRADE_ORDER[min]) min = g;
    if (min === 'D') break;
  }
  return min;
}

// ─── P2: единое окно дозы ───

export interface DoseWindow {
  min: number; opt: number; max: number; ul: number;
  unit: string; note: string; hasData: boolean;
}

export function doseWindowFor(
  id: string,
  therapeutic: Record<string, { minMg: number; optMg: number; maxMg: number; ul: number; note: string; unit?: string }>,
  ranges: Record<string, { therMin: number; therMax: number; label: string }>,
): DoseWindow {
  const key = id.toLowerCase();
  // Алиасы нутриентов: therapeutic-ключи короткие (mg/zn/fe/ca/se), id — длинные (magnesium_glycinate)
  const ALIAS: Record<string, string[]> = {
    mg: ['magnesium', 'магн'], zn: ['zinc', 'цинк'], fe: ['iron', 'желез', 'феррум'],
    ca: ['calcium', 'кальц'], se: ['selenium', 'селен'], d3: ['vitamin_d', 'd3', 'холекальц'],
    b12: ['b12', 'кобаламин', 'cobalamin'], vitc: ['vitamin_c', 'аскорб'], ala: ['alpha_lipo', 'липо'],
    nac: ['nac', 'ацетилцистеин'], coq10: ['coq10', 'убих'], omega3: ['omega', 'омега'],
    cr: ['chromium', 'хром'], iodine: ['iodine', 'йод', 'иод'], magnesium: ['magnesium', 'магн'],
    calcium: ['calcium', 'кальц'], zinc: ['zinc', 'цинк'], iron: ['iron', 'желез'],
  };
  const matchKey = (k: string): boolean => {
    const kl = k.toLowerCase();
    if (key.includes(kl) || kl.includes(key)) return true;
    const aliases = ALIAS[kl] || [];
    if (aliases.some(a => key.includes(a))) return true;
    const rev = Object.entries(ALIAS).find(([, v]) => v.some(a => kl.includes(a) || key.includes(a)));
    void rev;
    // Обратное: therapeutic-ключ длинный, id короткий
    for (const [short, words] of Object.entries(ALIAS)) {
      if (kl === short) continue;
      if (words.some(w => kl.includes(w)) && words.some(w => key.includes(w))) return true;
    }
    return false;
  };
  const directKey = Object.keys(therapeutic).find(matchKey);
  if (directKey) {
    const t = therapeutic[directKey];
    return { min: t.minMg, opt: t.optMg, max: t.maxMg, ul: t.ul, unit: t.unit || 'мг', note: t.note, hasData: true };
  }
  const rangeKey = Object.keys(ranges).find(k => key.includes(k) || k.includes(key));
  if (rangeKey) {
    const r = ranges[rangeKey];
    return { min: r.therMin, opt: (r.therMin + r.therMax) / 2, max: r.therMax, ul: 9999, unit: 'мг', note: `Диапазон: ${r.label}. UL для этого вещества в базе не задан — см. NIH UL.`, hasData: true };
  }
  return { min: 0, opt: 0, max: 0, ul: 9999, unit: 'мг', note: 'Данных о терапевтическом окне в базе нет — доза не оценивается.', hasData: false };
}

export interface PersonCtx { weightKg?: number; sex?: 'male' | 'female'; age?: number }

export interface PersonDefaults { wKg: number; sex: 'male' | 'female'; age: number }

/**
 * Дефолты вес/пол/возраст: ручное сохранение > профиль > константы.
 * Чистая функция — компонент только читает/пишет стор.
 */
export function resolvePersonDefaults(
  stored: { wKg?: unknown; sex?: unknown; age?: unknown } | null | undefined,
  prof: PersonCtx | null | undefined,
): PersonDefaults {
  const sW = stored && typeof stored.wKg !== 'undefined' ? Number(stored.wKg) : NaN;
  const sA = stored && typeof stored.age !== 'undefined' ? Number(stored.age) : NaN;
  const sS = stored && (stored.sex === 'female' || stored.sex === 'male') ? stored.sex : null;
  return {
    wKg: Number.isFinite(sW) && (sW as number) > 0 ? (sW as number) : (prof && prof.weightKg && prof.weightKg > 0 ? prof.weightKg : 80),
    sex: sS || (prof && prof.sex === 'female' ? 'female' : 'male'),
    age: Number.isFinite(sA) && (sA as number) > 0 ? (sA as number) : (prof && prof.age && prof.age > 0 ? prof.age : 30),
  };
}

export interface MiniKV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Миграция ключа стора: читаем новый, иначе legacy (переносим и чистим старый).
 * Не бросает исключений (private/quota → null).
 */
export function migratedGet(storage: MiniKV, newKey: string, oldKey: string): string | null {
  try {
    const cur = storage.getItem(newKey);
    if (cur !== null) return cur;
    const legacy = storage.getItem(oldKey);
    if (legacy !== null) {
      try { storage.setItem(newKey, legacy); } catch { /* quota */ }
      try { storage.removeItem(oldKey); } catch { /* noop */ }
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function migratedSet(storage: MiniKV, newKey: string, value: string | null): void {
  try {
    if (value === null) storage.removeItem(newKey);
    else storage.setItem(newKey, value);
  } catch { /* quota/private */ }
}

// ─── P3-добавка: фильтр каталога по грейду (локальный, без SupportScreen) ───

export type GradeFilter = 'all' | 'AB';

export function passesGradeFilter(id: string, f: GradeFilter): boolean {
  if (f === 'all') return true;
  const g = evidenceGradeExFor(id || '');
  return g === 'A' || g === 'B';
}

interface GradeGroup {
  id?: string;
  items?: GradeItem[];
  classItems?: Record<string, GradeItem[]>;
  classBadges?: Array<{ clsKey: string; count?: number; [k: string]: unknown }>;
  count?: number;
}

interface GradeItem {
  id?: string;
}

/**
 * Фильтрует сгруппированные списки каталога (формы групп type/organ/tier разные —
 * обрабатываются обе: items[] и classItems{}). Пустые группы дропаются, count пересчитывается.
 */
export function filterCatalogGroups(groups: GradeGroup[], f: GradeFilter): GradeGroup[] {
  if (f === 'all' || !Array.isArray(groups)) return groups;
  const out: GradeGroup[] = [];
  for (const g of groups) {
    if (Array.isArray(g.items)) {
      const items = g.items.filter(s => passesGradeFilter(s && s.id ? s.id : '', f));
      if (items.length > 0) out.push({ ...g, items, count: items.length });
    } else if (g.classItems && typeof g.classItems === 'object') {
      const classItems: Record<string, GradeItem[]> = {};
      let n = 0;
      const keys = Object.keys(g.classItems);
      for (const k of keys) {
        const arr = g.classItems[k] || [];
        const kept = arr.filter(s => passesGradeFilter(s && s.id ? s.id : '', f));
        if (kept.length > 0) { classItems[k] = kept; n += kept.length; }
      }
      if (n > 0) {
        const g2: GradeGroup = { ...g, classItems, count: n };
        // Бейджи классов тоже пересчитываем, иначе показывают дофильтровые counts
        if (Array.isArray(g.classBadges)) {
          g2.classBadges = g.classBadges
            .filter(b => classItems[b.clsKey] && classItems[b.clsKey].length > 0)
            .map(b => ({ ...b, count: classItems[b.clsKey].length }));
        }
        out.push(g2);
      }
    } else {
      out.push(g);
    }
  }
  return out;
}

/** Вес/пол/возраст-хинты (информация, не назначение). */
export function personDoseHints(id: string, person: PersonCtx): string[] {
  const hints: string[] = [];
  const key = id.toLowerCase();
  const w = person.weightKg;
  if (w && w > 0) {
    if (/creatine|креатин/.test(key)) hints.push(`Креатин: поддержка обычно 0.03–0.06 г/кг (~${Math.round(w * 0.03)}–${Math.round(w * 0.06)} г при ${w} кг); загрузка — только по протоколу.`);
    if (/magnesium|магн/.test(key)) hints.push(`Магний: дозы — в мг ЭЛЕМЕНТА; при массе ${w} кг ориентир тот же 200–400 мг элемента, UL 350 мг из добавок.`);
    if (/iron|желез/.test(key)) hints.push(`Железо: UL 45 мг элемента/сут; приём утром + C, врозь с Ca/кофе.`);
    if (/zinc|цинк/.test(key)) hints.push(`Цинк: UL 40 мг/сут; при длительном приёме держать Zn:Cu ≈ 10:1.`);
  }
  if (person.sex === 'female') {
    if (/iron|желез/.test(key)) hints.push('Женщинам: ферритин <30 нг/мл = истощение запасов; контроль ферритина каждые 3 мес.');
    if (/calcium|кальц/.test(key)) hints.push('Женщинам 50+: контроль Ca + D3 + ПТГ (риск остеопороза).');
    if (/creatine|креатин/.test(key)) hints.push('Женщинам: эффективная поддержка обычно ниже по массе тела (см. расчёт выше).');
  }
  if (person.age && person.age >= 60) {
    if (/b12|кобаламин|cobalamin/.test(key)) hints.push('60+: атрофический гастрит у ~30% — предпочтительны сублингвальные/активные формы B12, контроль ММК/гомоцистеина.');
    if (/calcium|vitamin_d|d3/.test(key)) hints.push('60+: контроль 25(OH)D + Ca²⁺ + ПТГ.');
  }
  return hints;
}
