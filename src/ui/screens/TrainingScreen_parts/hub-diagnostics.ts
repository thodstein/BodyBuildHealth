/**
 * hub-diagnostics.ts — живые входы «Мастера движений» (Диагностика → коррекция мезоцикла).
 *
 * Раньше расчёт жил прямо в useMemo внутри TrainingScreen, и в хаб уходили константы
 * (missedSessions=0, currentVolume=18, currentRir=2), а ACWR/монотонность не передавались
 * вовсе — коррекция считалась «из воздуха». Здесь тот же расчёт чистой функцией: его
 * можно покрыть тестом, не поднимая экран.
 */
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../../engines/pro/training-load.engine';
import { epley1RM } from '../../../engines/e1rm';
import { localIsoDate } from '../../../core/local-date';
import { measuredSetRir } from '../../../core/rir-honesty';

export interface HubDiagnostics {
  acwr?: number;
  monotony?: number;
  exercises: Array<{ name: string; e1rmBefore: number; e1rmAfter: number }>;
  currentVolume: number;
  currentRir: number | null;
  missedSessions: number;
}

export function computeHubDiagnostics(historyWorkouts: unknown[], plannedWeekly: number): HubDiagnostics {
  let acwr: number | undefined;
  let monotony: number | undefined;
  try {
    const srpe = loadSRPESessions();
    if (srpe.length >= 3) {
      const daily = toDailyLoads(srpe);
      const r = acuteChronicRatio(daily);
      const m = weeklyMonotony(daily).monotony;
      // Тонкая база (вся нагрузка внутри острой недели, chronic = 0) — ACWR не считается:
      // прежний порог «2 записи» выдавал ratio 2.0 из одной недели.
      if (r.chronic > 0 && Number.isFinite(r.ratio) && r.ratio > 0) acwr = Math.round(r.ratio * 100) / 100;
      if (Number.isFinite(m) && m > 0) monotony = Math.round(m * 100) / 100;
    }
  } catch {
    /* нет sRPE-логов — оставляем undefined, карточка честно скажет */
  }

  // Проход 173: окно «7 дней» — календарь пользователя, а не UTC-день.
  // Объём, RIR и пропуски считаются по ОДНОМУ окну: раньше RIR тянулся и из 7–14 дней,
  // и средняя смешивала две недели с разным смыслом.
  const iso = (d: number) => localIsoDate(new Date(d));
  // Ровно 7 календарных дней включая сегодня: сравнение `date >= (сегодня − 7)`
  // захватывало 8 дат и могло недосчитать пропуск.
  const cutoff7 = iso(Date.now() - 7 * 86400000);
  let sets7 = 0;
  let rirSum = 0;
  let rirN = 0;
  const dayKeys7 = new Set<string>();
  const e1rmRows: Array<{ name: string; date: string; e1rm: number }> = [];

  for (const w of historyWorkouts as any[]) {
    const date = String(w?.date || '');
    for (const e of w?.exercises || []) {
      const name = String(e?.exerciseName || e?.exerciseId || '');
      for (const s of e?.sets || []) {
        const weight = Number(s?.weightKg ?? s?.weight ?? 0);
        const reps = Number(s?.reps ?? 0);
        if (weight > 0 && reps > 0 && name)
          e1rmRows.push({ name, date, e1rm: Math.round(epley1RM(weight, reps) * 10) / 10 });
        if (date > cutoff7) {
          // Пустая дата в окно не попадает (сравнение строк) — заглушка не нужна.
          dayKeys7.add(date);
          sets7++;
          // Единое правило чтения RIR (measuredSetRir): легаси-ноль при введённом RPE —
          // заполнитель, а не «до отказа».
          const rir = measuredSetRir(s as any);
          if (rir != null && Number.isFinite(rir)) {
            rirSum += rir;
            rirN++;
          }
        }
      }
    }
  }

  // Динамика e1RM по упражнениям: лучший сет до/после середины окна истории.
  // Граница — по РАЗНЫМ датам: при двух тренировках в день медианная дата совпадала
  // с обеими, вторая половина оставалась пустой и динамика «терялась».
  const uniqueDates = [...new Set(e1rmRows.map((r) => r.date).filter(Boolean))].sort();
  const midDate = uniqueDates.length >= 2 ? uniqueDates[Math.floor(uniqueDates.length / 2) - 1] : '';
  const acc = new Map<string, { before: number; after: number }>();
  for (const r of e1rmRows) {
    const cur = acc.get(r.name) ?? { before: 0, after: 0 };
    if (midDate && r.date > midDate) cur.after = Math.max(cur.after, r.e1rm);
    else cur.before = Math.max(cur.before, r.e1rm);
    acc.set(r.name, cur);
  }
  const exercises = [...acc.entries()]
    .filter(([, v]) => v.before > 0 && v.after > 0)
    .map(([name, v]) => ({ name, e1rmBefore: v.before, e1rmAfter: v.after }))
    .slice(0, 8);

  const missedSessions = plannedWeekly > 0 ? Math.max(0, plannedWeekly - dayKeys7.size) : 0;

  return {
    acwr,
    monotony,
    exercises,
    currentVolume: sets7,
    currentRir: rirN > 0 ? Math.round((rirSum / rirN) * 10) / 10 : null,
    missedSessions,
  };
}
