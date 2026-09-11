/**
 * cardio-personal-zones.engine.ts — field-test → план (P1-1).
 * Движок сборки уже ставит targetHr из LTHR/talk/age; здесь —
 * темпы (VDOT Daniels: E/T/I задаёт пользователь из калькулятора)
 * и ватты (FTP: % от порога) дописываются в сессии честным текстом
 * и structured-note. Никаких выдуманных таблиц темпов внутри.
 * Чистые функции, план не мутируется (возвращается копия).
 */
import type { CardioCycle } from './cardio.engine';

export interface PersonalZoneTargets {
  /** Темпы Daniels с/км: E (easy), T (threshold), I (interval). */
  easyPaceSec?: number;
  tempoPaceSec?: number;
  intervalPaceSec?: number;
  /** FTP вело/гребли, Вт. */
  ftpWatts?: number;
}

export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/км`;
}

/**
 * Разобрать темп из поля ввода: «5:20», «5.5» (мин/км десятичные),
 * «320» (секунды). null — пусто/мусор (честно, без угадывания).
 */
export function parsePaceText(v: string | undefined | null): number | null {
  if (v == null) return null;
  const t = String(v).trim().replace(',', '.');
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (m) {
    const sec = Number(m[1]) * 60 + Number(m[2]);
    return sec >= 120 && sec <= 900 ? sec : null;
  }
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n >= 120 && n <= 900) return Math.round(n); // секунды
    if (n >= 2 && n < 15) return Math.round(n * 60); // мин/км десятичные
  }
  return null;
}

function validPace(v: unknown): v is number {
  return typeof v === 'number' && v >= 120 && v <= 900;
}

function hiitWatts(ftp: number): number {
  return Math.round(ftp * 1.1);
}

function tempoWatts(ftp: number): number {
  return Math.round(ftp * 0.9);
}

/**
 * Обогатить цикл персональными целями. Возвращает новый цикл;
 * без targets — тот же объект (no-op, байт-в-байт потребитель).
 */
export function applyPersonalTargetsToCycle(cycle: CardioCycle, t: PersonalZoneTargets): CardioCycle {
  const hasPace = validPace(t.easyPaceSec) || validPace(t.tempoPaceSec) || validPace(t.intervalPaceSec);
  const hasFtp = typeof t.ftpWatts === 'number' && t.ftpWatts >= 30 && t.ftpWatts <= 800;
  if (!hasPace && !hasFtp) return cycle;
  const weeks = cycle.weeks.map(w => ({
    ...w,
    sessions: w.sessions.map(s => {
      const equip = s.equipment ?? 'running';
      const isBikeRow = equip === 'cycling' || equip === 'rowing';
      let add = '';
      if (s.type === 'zone2' && validPace(t.easyPaceSec)) add = `Темп E ~${formatPace(t.easyPaceSec)}.`;
      else if (s.type === 'miss' && validPace(t.tempoPaceSec)) add = `Темп T ~${formatPace(t.tempoPaceSec)}.`;
      else if (s.type === 'hiit' && !isBikeRow && validPace(t.intervalPaceSec)) add = `Темп I ~${formatPace(t.intervalPaceSec)}.`;
      else if (s.type === 'hiit' && isBikeRow && hasFtp) add = `Мощность ~${hiitWatts(t.ftpWatts!)} Вт (110% FTP).`;
      else if (s.type === 'miss' && isBikeRow && hasFtp) add = `Мощность ~${tempoWatts(t.ftpWatts!)} Вт (90% FTP).`;
      if (!add) return s;
      return {
        ...s,
        purpose: s.purpose ? `${s.purpose} ${add}` : add,
        structured: s.structured?.map(b => ({ ...b, note: b.note ? `${b.note} · ${add}` : add })),
      };
    }),
  }));
  return {
    ...cycle,
    weeks,
    rationale: [...cycle.rationale, '🎯 Персональные цели: темпы VDOT / ватты FTP применены к сессиям.'],
  };
}
