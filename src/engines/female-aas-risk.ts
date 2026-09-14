/**
 * female-aas-risk.ts — женский слой PED-риска для assessPedRisk (этап «женский слой»).
 *
 * Активируется ТОЛЬКО при sex === 'female' (см. ped-risk-matrix.assessPedRisk).
 * Мужской путь не затрагивается: без явного sex вывод прежний (байт-в-байт).
 *
 * Пороги — harm-reduction ориентиры (мг/нед), нормализация как в ped-risk-matrix:
 * оральные AAS при вводе < 100 мг/нед трактуются как дневная доза (×7).
 * Источник: docs/FEMALE_AAS_PROTOCOLS.md (Endocrine Society, WADA/IOC, практика).
 */
import type { PEDDose } from '../data/ped-potency-table';
import { resolvePedAlias } from '../data/ped-alias-map';

export interface FemaleAasProfile {
  patterns: string[];
  name: string;
  /** Жёлтый порог, мг/нед (после нормализации) */
  yellow: number;
  /** Красный порог, мг/нед */
  red: number;
  /** Андрогенный индекс: тестостерон = 1.0 */
  androgenIndex: number;
  /** Абсолютное противопоказание для женщин (любая доза) */
  contraindicated?: boolean;
}

/**
 * Порядок важен: специфичные паттерны (methyltest/testolone/rad140) — раньше общего 'test'.
 * Совпадает по стилю с AAS_RULES (ped-risk-matrix).
 */
export const FEMALE_AAS_PROFILES: FemaleAasProfile[] = [
  { patterns: ['tren_', 'trenbolone', 'parabolan', 'trenace'], name: 'Тренболон', yellow: 0, red: 0, androgenIndex: 1.5, contraindicated: true },
  { patterns: ['trest', 'ment'], name: 'Трестостерон', yellow: 0, red: 0, androgenIndex: 1.5, contraindicated: true },
  { patterns: ['halo', 'halotestin', 'fluoxymesterone'], name: 'Флуоксиместерон', yellow: 0, red: 0, androgenIndex: 1.5, contraindicated: true },
  { patterns: ['anadrol', 'oxymeth', 'oxymetholone'], name: 'Оксиметолон', yellow: 0, red: 0, androgenIndex: 0.6, contraindicated: true },
  { patterns: ['superdrol', 'methyldrostanolone'], name: 'Супердрол', yellow: 0, red: 0, androgenIndex: 1.0, contraindicated: true },
  { patterns: ['methyltrienolone', 'metribolone'], name: 'Метилтриенолон', yellow: 0, red: 0, androgenIndex: 1.5, contraindicated: true },
  { patterns: ['s23'], name: 'S23', yellow: 0, red: 0, androgenIndex: 1.2, contraindicated: true },
  { patterns: ['yk11'], name: 'YK-11', yellow: 0, red: 0, androgenIndex: 1.2, contraindicated: true },
  { patterns: ['methyltest'], name: 'Метилтестостерон', yellow: 5, red: 10, androgenIndex: 1.2 },
  { patterns: ['rad140', 'testolone'], name: 'RAD-140', yellow: 70, red: 140, androgenIndex: 0.5 },
  { patterns: ['lgd', 'ligandrol'], name: 'Лигандрол', yellow: 35, red: 70, androgenIndex: 0.4 },
  { patterns: ['ostarine', 'mk2866', 'enobosarm'], name: 'Остарин', yellow: 70, red: 140, androgenIndex: 0.2 },
  // 'test' ДО 'stan': иначе 'sustanon' матчится на станозолол ('stan' ⊆ 'sustanon') и наоборот.
  { patterns: ['test', 'testosterone', 'sustanon', 'sust', 'omnadren'], name: 'Тестостерон', yellow: 10, red: 20, androgenIndex: 1.0 },
  { patterns: ['nandrolone', 'deca', 'npp'], name: 'Нандролон', yellow: 50, red: 75, androgenIndex: 0.35 },
  { patterns: ['stan', 'winstrol', 'winny', 'stanozolol'], name: 'Станозолол', yellow: 70, red: 140, androgenIndex: 0.3 },
  { patterns: ['dhb', 'dihydroboldenone'], name: 'Дигидроболденон (DHB)', yellow: 50, red: 75, androgenIndex: 0.4 },
  { patterns: ['masteron', 'drostanolone'], name: 'Дростанолон (мастерон)', yellow: 75, red: 100, androgenIndex: 0.3 },
  { patterns: ['primobolan', 'methenolone', 'primo', 'prim_'], name: 'Примоболан', yellow: 50, red: 75, androgenIndex: 0.2 },
  { patterns: ['bold', 'equipoise', 'eq'], name: 'Болденон', yellow: 50, red: 100, androgenIndex: 0.3 },
  { patterns: ['dbol', 'dianabol', 'methand', 'methandrostenolone'], name: 'Метандиенон', yellow: 35, red: 70, androgenIndex: 0.5 },
  { patterns: ['tbol', 'turinabol', 'chlorodehydro', 'trena'], name: 'Туринбол', yellow: 70, red: 140, androgenIndex: 0.25 },
  { patterns: ['oxan', 'anavar', 'oxandrolone'], name: 'Оксандролон', yellow: 70, red: 140, androgenIndex: 0.24 },
];

export interface FemaleAasFinding {
  id: string;
  name: string;
  doseMgWeek: number;
  ratio: number;
  level: 'ok' | 'yellow' | 'red' | 'contraindicated';
  oral: boolean;
  androgenIndex: number;
}

export interface FemaleAasRisk {
  findings: FemaleAasFinding[];
  /** Максимум доза/красный-порог среди находок (у противопоказаний = Infinity) */
  maxRatio: number;
  /** Максимум дозо/порог только по оральным (для печёночной эскалации) */
  oralMaxRatio: number;
  hasRed: boolean;
  hasYellow: boolean;
  contraindicated: string[];
  flags: string[];
  /** Дозо-только индекс вирилизации 0–100 (без длительности: Σ min(ratio,2)×AI×10) */
  virilizationDoseIndex: number;
}

/** Нормализация дозы как в ped-risk-matrix: oral < 100 мг/нед → дневная ×7. */
function femaleDoseMgWeek(ped: PEDDose): number {
  const mg = Number(ped.mgPerWeek) || 0;
  if (ped.form === 'oral' && mg > 0 && mg < 100) return mg * 7;
  return mg;
}

/**
 * Женская оценка стека: пороги вирилизации/печёночные и флаги.
 * Пустой/не-AAS стек → пустые находки (не влияет ни на что).
 */
export function assessFemaleAas(pedDoses: PEDDose[]): FemaleAasRisk {
  const findings: FemaleAasFinding[] = [];
  const flags: string[] = [];

  for (const ped of pedDoses || []) {
    const id = resolvePedAlias(ped.id || '');
    const profile = FEMALE_AAS_PROFILES.find((p) => p.patterns.some((pat) => id.includes(pat)));
    if (!profile) continue;

    const dose = femaleDoseMgWeek(ped);
    const oral = ped.form === 'oral';

    if (profile.contraindicated) {
      findings.push({ id, name: profile.name, doseMgWeek: dose, ratio: Infinity, level: 'contraindicated', oral, androgenIndex: profile.androgenIndex });
      flags.push(`♀ АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ: ${profile.name} — женщинам нельзя`);
      continue;
    }
    if (dose <= 0) continue;

    const ratio = dose / profile.red;
    const level: FemaleAasFinding['level'] = ratio > 1 ? 'red' : ratio > 0.66 ? 'yellow' : 'ok';
    findings.push({ id, name: profile.name, doseMgWeek: dose, ratio, level, oral, androgenIndex: profile.androgenIndex });

    if (level === 'red') {
      flags.push(`♀ ${profile.name} ${Math.round(dose)} мг/нед — выше красного женского порога (${profile.red} мг/нед): необратимая вирилизация`);
      if (oral) flags.push(`♀ ${profile.name} (оральный): женский печёночный порог ниже — АЛТ/АСТ каждые 2 нед`);
    } else if (level === 'yellow') {
      flags.push(`♀ ${profile.name} ${Math.round(dose)} мг/нед — верхняя женская граница (≈${Math.round((ratio) * 100)}% красного порога)`);
    }
  }

  const finite = findings.filter((f) => Number.isFinite(f.ratio));
  const maxRatio = finite.length > 0 ? Math.max(...finite.map((f) => f.ratio)) : 0;
  const oralFinite = finite.filter((f) => f.oral);
  const oralMaxRatio = oralFinite.length > 0 ? Math.max(...oralFinite.map((f) => f.ratio)) : 0;
  const contraindicated = findings.filter((f) => f.level === 'contraindicated').map((f) => f.name);

  let idx = 0;
  for (const f of findings) {
    const r = Number.isFinite(f.ratio) ? Math.min(f.ratio, 2) : 2;
    idx += r * f.androgenIndex * 10;
  }

  return {
    findings,
    maxRatio,
    oralMaxRatio,
    hasRed: findings.some((f) => f.level === 'red' || f.level === 'contraindicated'),
    hasYellow: findings.some((f) => f.level === 'yellow'),
    contraindicated,
    flags,
    virilizationDoseIndex: Math.min(100, Math.round(idx)),
  };
}
