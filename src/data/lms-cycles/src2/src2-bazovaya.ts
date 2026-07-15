import type { SRCycleTemplate, SRDaySpec, SRSetSpec, SRExerciseSpec } from '../lms-types';

// Базовая программа по пауэрлифтингу (А.Е. Суровецкий).
// Sheet «присед_тяга»: 8 МЦ × 6 сессий = 48 тренировок = 16 нед × 3/нед.
// Чередование: МЦ = 2 нед × 3 дня. Паттерн каждого МЦ:
//   Нед A: SQ_mid(3×3) / DL_easy(3×5) / SQ_heavy(3×1)
//   Нед B: DL_mid(3×3) / SQ_easy(3×5) / DL_big(3×1)
// Progression: 74→88% (mid), 52→66% (easy), 88→MAX (heavy).
// MC4 и MC8 — проходки на ПМ (100% 1×1 с разгонкой).
// Каждый день: основное движение + поддерживающий жим + спина + пресс.

const s = (pct: number, reps: number, sets = 1): SRSetSpec => ({ pct, reps, sets });
const ex = (name: string, group: string, coef: number, sets: SRSetSpec[]): SRExerciseSpec => ({ name, group, coef, mnosz: 1, sets });
const day = (...exercises: SRExerciseSpec[]): SRDaySpec => ({ exercises });

const SQ = (sets: SRSetSpec[]) => ex('Приседания', 'Приседания', 1.0, sets);
const DL = (sets: SRSetSpec[]) => ex('Становая тяга', 'Тяга', 1.0, sets);
const BP = (sets: SRSetSpec[]) => ex('Жим лёжа', 'Жим', 1.0, sets);

// Стандартные вспомогательные упражнения на каждый день ПЛ-программы
const bpM = BP([s(.35,8), s(.50,6), s(.60,5), s(.65,5,3)]);
const row = ex('Тяга штанги в наклоне', 'Спина', 0.5, [s(.50,8,3)]);
const hyp = ex('Гиперэкстензия', 'Спина', 0.3, [s(.20,8,3)]);
const abs = ex('Пресс', 'Пресс', 0, [s(.15,15,3)]);

// Один МЦ = 2 нед × 3 сессии. На каждый день: основное движение + жим + спина + пресс
function mc(a: number, b: number, c: number | 'MAX', d: number, e: number, f: number | 'MAX'): SRDaySpec[][] {
 const hSq = c === 'MAX'
  ? day(SQ([s(.35,8), s(.50,5), s(.65,3), s(.75,2), s(.85,1), s(.95,1), s(1,1)]), bpM, row, abs)
  : day(SQ([s(.35,8), s(.50,5), s(.65,3), s(.75,2), s(c,1,3)]), bpM, row, abs);
 const hDl = f === 'MAX'
  ? day(DL([s(.35,5), s(.50,4), s(.65,2), s(.75,1), s(.85,1), s(.95,1), s(1,1)]), bpM, hyp, abs)
  : day(DL([s(.35,5), s(.50,4), s(.65,2), s(.75,1), s(f,1,3)]), bpM, hyp, abs);
 return [
  [ // Нед A: SQ_mid, DL_easy, SQ_heavy
   day(SQ([s(.35,8), s(.50,5), s(.65,3), s(a,3,3)]), bpM, row, abs),
   day(DL([s(.35,5), s(.50,4), s(.65,2), s(b,5,3)]), bpM, hyp, abs),
   hSq,
  ],
  [ // Нед B: DL_mid, SQ_easy, DL_big
   day(DL([s(.35,5), s(.50,4), s(.65,2), s(d,3,3)]), bpM, hyp, abs),
   day(SQ([s(.35,8), s(.50,5), s(.65,3), s(e,5,3)]), bpM, row, abs),
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
  description: 'Полноценная программа троеборья А.Е. Суровецкого. 8 микроциклов по 2 недели (16 недель): чередование средних (3×3), лёгких (3×5) и тяжёлых (3×1) сессий в приседаниях и становой тяге. Каждый день: основное движение + поддерживающий жим (3×5@65%) + спина (тяга/гиперэкстензия) + пресс. Прогрессия SQ 74→88%, DL 52→66%, SQ/DL_heavy 88→102% и MAX. Проходки на ПМ в МЦ4 и МЦ8.',
  howItWorks: 'Базовая (Суровецкий). 8 МЦ × 2 нед × 3 сессии = 48 тренировок. Каждый МЦ: нед A = SQ_mid → DL_easy → SQ_heavy, нед B = DL_mid → SQ_easy → DL_big. На каждом дне 4 упражнения: основное + поддерживающий жим + спина + пресс. Жим 3×5@65% на всех днях для поддержания объёма. Спина: тяга в наклоне (дни приседа) / гиперэкстензия (дни тяги). Прогрессия: МЦ1 74/88% → МЦ8 88/MAX. Проходки МЦ4 и МЦ8. МЦ6 — переброска 102%. За 100% берётся ПМ пользователя.',
  conditions: ['III-II разряд', '3 тренировки/нед', '16 недель (8 МЦ)', 'Чередование SQ/DL', 'Поддерживающий жим', 'Проходки в МЦ4 и МЦ8'],
  tags: ['surovetsky'],
 },
 week1: weeks[0],
 weeks,
};
