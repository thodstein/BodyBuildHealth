import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from '../lms-types';

// Базовая программа по пауэрлифтингу (А.Е. Суровецкий).
// Sheet «присед_тяга»: 8 МЦ × 6 сессий = 48 тренировок = 16 нед × 3/нед.
// Чередование: МЦ = 2 нед × 3 дня. Паттерн каждого МЦ:
//   Нед A: SQ_mid(3×3) / DL_easy(3×5) / SQ_heavy(3×1)
//   Нед B: DL_mid(3×3) / SQ_easy(3×5) / DL_big(3×1)
// Progression: 74→88% (mid), 52→66% (easy), 88→MAX (heavy).
// MC4 и MC8 — проходки на ПМ (100% 1×1 с разгонкой).
// Жим: применять отдельную систему (напр. «Системы 1 и 2», цикл src2-sistemy-1i2).

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

const SQ = (sets: SRSetSpec[]) => ex('Приседания', 'Приседания', 1.0, sets);
const DL = (sets: SRSetSpec[]) => ex('Становая тяга', 'Тяга', 1.0, sets);

// Один МЦ = 2 нед × 3 сессии. Параметры: SQ_mid%, DL_easy%, SQ_heavy%(или 'MAX'), DL_mid%, SQ_easy%, DL_big%(или 'MAX')
function mc(a: number, b: number, c: number | 'MAX', d: number, e: number, f: number | 'MAX'): SRDaySpec[][] {
 const hSq = c === 'MAX'
  ? day(SQ([s(.35,8), s(.50,5), s(.65,3), s(.75,2), s(.85,1), s(.95,1), s(1,1)]))
  : day(SQ([s(.35,8), s(.50,5), s(.65,3), s(.75,2), s(c,1,3)]));
 const hDl = f === 'MAX'
  ? day(DL([s(.35,5), s(.50,4), s(.65,2), s(.75,1), s(.85,1), s(.95,1), s(1,1)]))
  : day(DL([s(.35,5), s(.50,4), s(.65,2), s(.75,1), s(f,1,3)]));
 return [
  [
   day(SQ([s(.35,8), s(.50,5), s(.65,3), s(a,3,3)])),
   day(DL([s(.35,5), s(.50,4), s(.65,2), s(b,5,3)])),
   hSq,
  ],
  [
   day(DL([s(.35,5), s(.50,4), s(.65,2), s(d,3,3)])),
   day(SQ([s(.35,8), s(.50,5), s(.65,3), s(e,5,3)])),
   hDl,
  ],
 ];
}

const weeks: SRDaySpec[][] = [
 ...mc(.74,.52,.88, .74,.52,.88),   // МЦ1 (нед 1-2)
 ...mc(.76,.54,1.0, .76,.54,1.0),   // МЦ2 (нед 3-4)
 ...mc(.78,.56,.90, .78,.56,.90),   // МЦ3 (нед 5-6)
 ...mc(.80,.58,'MAX', .80,.58,'MAX'), // МЦ4 (нед 7-8) — проходки
 ...mc(.82,.60,.92, .82,.60,.92),   // МЦ5 (нед 9-10)
 ...mc(.84,.62,1.02, .84,.62,1.02), // МЦ6 (нед 11-12)
 ...mc(.86,.64,.94, .86,.64,.94),   // МЦ7 (нед 13-14)
 ...mc(.88,.66,'MAX', .88,.66,'MAX'), // МЦ8 (нед 15-16) — проходки
];

export const SRC2_BAZOVAYA: SRCycleTemplate = {
 meta: {
  id: 'src2-bazovaya',
  title: 'Базовая программа по пауэрлифтингу (Суровецкий)',
  direction: 'powerlifting',
  level: 'intermediate',
  period: 'strength',
  minBodyWeight: 67.5,
  sessionsPerWeek: 3,
  weeks: 16,
  correctionPct: 0,
  description: 'Базовая программа троеборья А.Е. Суровецкого. 8 микроциклов по 2 недели (16 недель): чередование средних (3×3), лёгких (3×5) и тяжёлых (3×1) сессий в приседаниях и становой тяге. Прогрессия SQ 74→88%, DL 52→66%, SQ_heavy 88→102% и MAX. Проходки на ПМ в МЦ4 и МЦ8. По жиму — отдельная система (напр. «Системы 1 и 2», цикл src2-sistemy-1i2). Таблица указывает вес только основных подходов.',
  howItWorks: 'Базовая (Суровецкий). 8 МЦ × 2 нед × 3 сессии = 48 тренировок. Каждый МЦ: нед A = SQ_mid → DL_easy → SQ_heavy, нед B = DL_mid → SQ_easy → DL_big. Рабочие подходы: mid 3×3, easy 3×5, heavy 3×1. Прогрессия: МЦ1 74/88% → МЦ8 88/MAX. МЦ4 и МЦ8 — проходки на 100% с разгонкой 35→95%. МЦ6 — переброска 102% (после проходки МЦ4 вес не пересчитывается). За 100% берётся опорный ПМ источника; реальные веса пересчитываются от ПМ пользователя.',
  conditions: ['III-II разряд', '3 тренировки/нед', '16 недель (8 МЦ)', 'Чередование SQ/DL', 'Проходки в МЦ4 и МЦ8'],
  tags: ['surovetsky'],
 },
 week1: weeks[0],
 weeks,
};