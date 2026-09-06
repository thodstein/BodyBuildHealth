/**
 * arm-for.engine.ts — Functional Overreaching 7-day для хвата + rebound.
 *
 * Источник: Grinder Gym FOR grip (7 дней, 11 сессий AM/PM по доменам crush /
 * support / pinch / open-hand / wrist; сон/магний/массаж/контраст; затем
 * 7–10 дней rebound на базу/ниже с 1–2 хватами в неделю; ретест на 10–14
 * день; специализация — один домен, остальное maintenance).
 *
 * Только план/предписания + гейты. Чистый модуль без импортов.
 */

export type ForDomain = 'crush' | 'support' | 'pinch' | 'open' | 'wrist';

export interface ForDay {
  day: number;
  am: string;
  pm: string;
  domains: ForDomain[];
}

export interface ForPlan {
  days: ForDay[];
  rebound: string;
  retest: string;
  note: string;
}

const AM: Record<number, string> = {
  1: 'Crush объём: CoC work 4×5–7 RPE8 + expanders',
  2: 'Support: RT/Axle 5×3 тяж + farmer 3×40ft',
  3: 'Pinch: Saxon/block 4×5 + hub holds',
  4: 'Open-hand: thick-bar holds 4×20–30с + towel hangs',
  5: 'Wrist: pron/sup + ulnar/radial 3×12–15',
  6: 'Crush повтор: overcrush holds + negatives',
  7: 'Medley-день: по одному топ-подходу на домен RPE9',
};

const PM: Record<number, string> = {
  1: 'Pinch + восстановление: plate carries 3×40ft + rice bucket 5 мин',
  2: 'Support объём + isometric crush: fat-grip holds 4×30с + RT hold 3×10–15с',
  3: 'Pinch + wrist ext: timed holds 4×15–20с + reverse curls 3×15',
  4: 'Wrist + массаж: rotations 3 круга + contrast/massage',
  5: 'Support лёгко + expanders 3×25',
  6: 'Rest PM: только массаж/сон (пред-пик)',
  7: 'Rest PM: полный отдых перед rebound',
};

export function buildForWeek(specialization: ForDomain = 'support'): ForPlan {
  const days: ForDay[] = [];
  for (let d = 1; d <= 7; d++) {
    const domains: ForDomain[] = d <= 2 ? ['crush', 'support'] : d <= 4 ? ['pinch', 'open', 'wrist'] : d === 5 ? ['wrist', 'support'] : d === 6 ? ['crush'] : [specialization];
    days.push({ day: d, am: AM[d], pm: PM[d], domains });
  }
  return {
    days,
    rebound: 'Rebound 7–10 дней: хват 1–2×/нед на базу/ниже, без частоты и негативов; сон/магний/массаж.',
    retest: 'Ретест тех же метрик (closes/hold/carry) на 10–14 день — фиксирует, какой домен откликнулся.',
    note: `FOR-7 (${specialization} — специализация, остальное maintenance): 11 сессий AM/PM, затем rebound. Только advanced/enhanced с чистыми CNS/tendon.`,
  };
}

export interface ForGate {
  allowed: boolean;
  warnings: string[];
}

/** Гейт FOR: уровень + CNS/tendon должны быть чистыми (вход — из дневника/гардов строкой). */
export function forGate(input: { level?: string; cnsHeavyDays?: number; tendonOver?: boolean }): ForGate {
  const warnings: string[] = [];
  const lvl = String(input.level || 'intermediate').toLowerCase();
  if (lvl !== 'advanced' && lvl !== 'enhanced') warnings.push('FOR только advanced/enhanced (нагрузка 11 сессий/нед).');
  if (Number(input.cnsHeavyDays || 0) >= 2) warnings.push('CNS: 2+ тяжёлых за 7 дней — сначала rebound, потом FOR.');
  if (input.tendonOver) warnings.push('Tendon: перегруз (tendon >18/нед) — FOR запрещён до нормализации.');
  return { allowed: warnings.length === 0, warnings };
}
