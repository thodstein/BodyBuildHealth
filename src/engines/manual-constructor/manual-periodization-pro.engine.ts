/**
 * manual-periodization-pro.engine.ts — PRO-периодизация для ручного конструктора.
 *
 * Фаза 5: DUP внутри недели, block inheritance, specialization/tradeoff, taper/peak, cycleLength 5-9.
 * Переиспользует bb-dup, bb-specialization, bb-tradeoff, bb-peak логику адаптированную для UserProgram.
 */

import type { UserProgram, UserWeek, UserBlock, Phase } from '../user-program/user-program.types';
import { getVolumeLandmarks } from '../volume-landmarks.engine';

// ── DUP ───────────────────────────────────────────────────────────────
export type DupPreset = 'heavy_light' | 'strength_hypertrophy' | 'full_dup' | 'none';

export const DUP_PRESETS: Record<DupPreset, { label: string; description: string; characters: Array<'тяж'|'памп'|'лёг'> }> = {
  heavy_light: { label: 'Тяж/Лёг', description: 'Чётные дни тяж (RIR1), нечётные лёг (RIR3) — для начинающих-средних', characters: ['тяж','лёг'] },
  strength_hypertrophy: { label: 'Сила/Гипертрофия', description: 'День 1-2 тяж 3-5×RIR1, день 3-4 памп 10-15×RIR3', characters: ['тяж','тяж','памп','памп'] },
  full_dup: { label: 'Full DUP', description: 'Тяж/Средний/Лёг ротация (RIR 1/2/3) — для продвинутых', characters: ['тяж','памп','лёг','тяж','памп'] },
  none: { label: 'Без DUP', description: 'Все сессии по фазе недели', characters: [] },
};

/** Применить DUP к программе: проставить session.character + phaseOverride + RIR по preset. */
export function applyDUPToProgram(
  program: UserProgram,
  preset: DupPreset,
  fromWeek: number,
  toWeek: number,
): UserProgram {
  if (preset === 'none') return program;
  const cfg = DUP_PRESETS[preset];
  if (!cfg || cfg.characters.length === 0) return program;
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined));
  if (!weeks) return program;
  const cloned = JSON.parse(JSON.stringify(weeks)) as UserWeek[];
  for (const w of cloned) {
    if (w.week < fromWeek || w.week > toWeek) continue;
    if (w.deload || w.phase === 'deload') continue; // deload не трогаем
    w.sessions.forEach((s, si) => {
      const ch = cfg.characters[si % cfg.characters.length];
      (s as any).character = ch;
      // phaseOverride для RIR/tempo в manual-phase
      if (ch === 'тяж') (s as any).phaseOverride = 'intensification';
      else if (ch === 'лёг') (s as any).phaseOverride = 'deload';
      else (s as any).phaseOverride = 'accumulation';
      // Корректируем RIR в блоках
      for (const b of s.blocks) {
        for (const st of b.sets) {
          if (ch === 'тяж') st.rir = Math.max(0, Math.min(2, st.rir ?? 1));
          else if (ch === 'памп') st.rir = 2;
          else if (ch === 'лёг') st.rir = Math.max(3, st.rir ?? 3);
        }
        b.character = ch;
      }
    });
  }
  const newProg: UserProgram = JSON.parse(JSON.stringify(program));
  if (newProg.bb) newProg.bb.weeks = cloned as UserWeek[];
  else if (newProg.hybrid) (newProg.hybrid as any).bbWeeks = cloned;
  return newProg;
}

// ── Specialization / Tradeoff ───────────────────────────────────────
export interface SpecializationConfig {
  targets: string[]; // 1-2 целевые мышцы
  donorMuscles?: string[]; // мышцы-доноры (если не указаны — автоматически)
  mode?: 'reduce_direct_to_floor' | 'remove_direct_when_indirect_covers_floor';
  floorMult?: number; // MEV × floorMult (по умолчанию 1.0)
}

/** Рекомендуемые доноры по цели (из bb-specialization-registry). Упрощённый мап. */
const DONOR_MAP: Record<string, string[]> = {
  chest: ['triceps','shoulders'],
  chest_upper: ['triceps','shoulders'],
  back: ['biceps','rear_delt'],
  back_width: ['biceps'],
  quads: ['hamstrings','glutes'],
  hamstrings: ['quads'],
  glutes: ['quads'],
  shoulders: ['chest','back'],
  delt_mid: ['chest','shoulders'],
  delt_rear: ['back'],
  biceps: ['back'],
  triceps: ['chest'],
};

export function suggestDonorsForTargets(targets: string[]): string[] {
  const set = new Set<string>();
  for (const t of targets) {
    const donors = DONOR_MAP[t] || [];
    donors.forEach(d => set.add(d));
  }
  // Убираем сами таргеты из доноров
  targets.forEach(t => set.delete(t));
  return Array.from(set).slice(0, 2);
}

/** Применить специализацию: увеличить объём целей, срезать доноров до floor. */
export function applySpecializationToProgram(
  program: UserProgram,
  spec: SpecializationConfig,
  fromWeek: number,
  toWeek: number,
  level: string,
): UserProgram {
  const targets = (spec.targets || []).map(s => s.toLowerCase());
  if (targets.length === 0) return program;
  const donors = spec.donorMuscles ?? suggestDonorsForTargets(targets);
  const floorMult = spec.floorMult ?? 1.0;
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined));
  if (!weeks) return program;
  const cloned = JSON.parse(JSON.stringify(weeks)) as UserWeek[];
  for (const w of cloned) {
    if (w.week < fromWeek || w.week > toWeek) continue;
    if (w.deload) continue;
    // Для каждой сессии корректируем блоки
    for (const s of w.sessions) {
      // Сначала доноры: срезать direct до floor (MEV)
      for (const b of s.blocks) {
        const m = (b.muscle || '').toLowerCase();
        if (donors.includes(m)) {
          const lm = getVolumeLandmarks(level, m);
          if (!lm) continue;
          const floor = Math.round(lm.mev * floorMult);
          // Если в сессии есть несколько блоков одной мышце — оцениваем суммарно per muscle per week примерно
          // Упростим: если у блока > floor — режем до floor (но минимум 1 сет оставляем)
          if (b.sets.length > floor) {
            b.sets = b.sets.slice(0, Math.max(1, floor));
            b.comment = b.comment ? `${b.comment} · 🔻 Спец-донор` : '🔻 Спец-донор';
          }
        }
      }
      // Затем цели: добавить объём если ниже MAV
      for (const target of targets) {
        const hasTarget = s.blocks.some(b => (b.muscle || '').toLowerCase() === target);
        // Если мышца-цель уже в сессии — добавим 1 сет к каждому её блоку (до +2 per session)
        if (hasTarget) {
          for (const b of s.blocks) {
            if ((b.muscle || '').toLowerCase() !== target) continue;
            const lm = getVolumeLandmarks(level, target);
            if (!lm) continue;
            // Не добавлять если уже на MRV
            if (b.sets.length >= 5) continue; // per-exercise cap 5 (натурал)
            if (b.sets.length < lm.mav) {
              const tmpl = b.sets[b.sets.length - 1] ?? { reps: 10, rir: 1, weight: 0 } as any;
              b.sets.push({ ...tmpl });
              b.comment = b.comment ? `${b.comment} · 🔥 Спец-объём` : '🔥 Спец-объём';
            }
          }
        }
      }
    }
  }
  const newProg: UserProgram = JSON.parse(JSON.stringify(program));
  newProg.meta.specialization = targets;
  if (newProg.bb) newProg.bb.weeks = cloned as UserWeek[];
  else if (newProg.hybrid) (newProg.hybrid as any).bbWeeks = cloned;
  return newProg;
}

// ── Taper / Peak ───────────────────────────────────────────────────
export interface TaperOpts {
  weeks: number; // 1-2 обычно, 3 для пика
  mode: 'classic' | 'linear' | 'step';
  volumeMultLast?: number; // по умолчанию 0.45 финал, 0.65 предфинал
  rirAddLast?: number; // +2 финал
}

export function applyTaperToProgram(
  program: UserProgram,
  opts: TaperOpts,
): UserProgram {
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined));
  if (!weeks || weeks.length < 4) return program;
  const total = weeks.length;
  const taperWeeks = Math.max(1, Math.min(opts.weeks, 3));
  const cloned = JSON.parse(JSON.stringify(weeks)) as UserWeek[];
  // Последние taperWeeks недель — тейпер
  for (let i = 0; i < cloned.length; i++) {
    const w = cloned[i];
    const isLast = i === cloned.length - 1;
    const isPreLast = i === cloned.length - 2;
    if (i < total - taperWeeks) continue;
    const volMult = isLast ? (opts.volumeMultLast ?? 0.45) : isPreLast ? 0.65 : 0.85;
    const rirAdd = isLast ? (opts.rirAddLast ?? 2) : isPreLast ? 1 : 0;
    for (const s of w.sessions) {
      for (const b of s.blocks) {
        const newLen = Math.max(1, Math.round(b.sets.length * volMult));
        b.sets = b.sets.slice(0, newLen);
        while (b.sets.length < newLen) b.sets.push({ ...b.sets[0] });
        for (const st of b.sets) {
          if (typeof st.rir === 'number') st.rir = Math.min(5, st.rir + rirAdd);
        }
        b.comment = b.comment ? `${b.comment} · 📉 Taper` : '📉 Taper';
      }
    }
    if (isLast) { w.phase = 'peaking'; w.note = (w.note ? w.note + ' · ' : '') + 'Пик-неделя'; }
    else { w.note = (w.note ? w.note + ' · ' : '') + 'Taper'; }
  }
  const newProg: UserProgram = JSON.parse(JSON.stringify(program));
  if (newProg.bb) newProg.bb.weeks = cloned as UserWeek[];
  else if (newProg.hybrid) (newProg.hybrid as any).bbWeeks = cloned;
  return newProg;
}

// ── Block inheritance (base → custom) ──────────────────────────────
/** Клонировать неделю с переиспользованием base движений, кроме переопределённых. */
export function inheritWeekBlocks(
  baseWeek: UserWeek,
  customWeek: Partial<UserWeek> & { week: number },
): UserWeek {
  // Если customWeek.sessions заданы — используем их, иначе base
  if (customWeek.sessions && customWeek.sessions.length > 0) {
    // Мержим блоки: для каждой сессии base — если custom имеет сессию с тем же dayOfWeek — берём custom.blocks, иначе base.blocks
    const baseByDow = new Map<number, typeof baseWeek.sessions[0]>();
    baseWeek.sessions.forEach(s => { if (s.dayOfWeek != null) baseByDow.set(s.dayOfWeek, s); });
    const mergedSessions = customWeek.sessions.map(cs => {
      if (cs.dayOfWeek != null && baseByDow.has(cs.dayOfWeek) && (!cs.blocks || cs.blocks.length === 0)) {
        // Пустая custom сессия — наследуем base
        const base = baseByDow.get(cs.dayOfWeek)!;
        return { ...base, id: cs.id, name: cs.name || base.name, dayOfWeek: cs.dayOfWeek, note: cs.note ?? base.note };
      }
      return cs as UserWeek['sessions'][0];
    });
    return { ...baseWeek, ...customWeek, sessions: mergedSessions } as UserWeek;
  }
  return { ...baseWeek, ...customWeek } as UserWeek;
}

/** Cycle length 5-9: пересчитать dayOfWeek для недели по календарю (неделя 1 = понедельник). */
export function recalcDayOfWeekForCycleLength(
  program: UserProgram,
  cycleLength: 5|6|7|8|9,
  startDay: number = 0, // 0=Пн
): UserProgram {
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined));
  if (!weeks) return program;
  const cloned = JSON.parse(JSON.stringify(weeks)) as UserWeek[];
  let globalDay = 0;
  for (const w of cloned) {
    for (const s of w.sessions) {
      s.dayOfWeek = (startDay + globalDay) % 7;
      globalDay++;
      if (globalDay % cycleLength === 0) {
        // конец микроцикла — сброс? Для cycleLength≠7 календарь идёт непрерывно, без сброса недели
        // globalDay продолжает расти, dayOfWeek циклично 0-6
      }
    }
    // Если сессий меньше чем cycleLength — остальные дни отдых (не меняем)
  }
  const newProg: UserProgram = JSON.parse(JSON.stringify(program));
  newProg.meta.cycleLength = cycleLength;
  if (newProg.bb) newProg.bb.weeks = cloned as UserWeek[];
  else if (newProg.hybrid) (newProg.hybrid as any).bbWeeks = cloned;
  return newProg;
}
