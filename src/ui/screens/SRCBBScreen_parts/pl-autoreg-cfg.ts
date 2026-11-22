/**
 * pl-autoreg-cfg.ts — авторегуляция ПЛ-плана «по кнопке» (аудит 2026-11, P0-4).
 *
 * Контракт:
 *  1. Режим «Авто» показывает ПРЕДПРОСМОТР множителей (готовность/ACWR), но план не меняет.
 *  2. Пользователь нажимает «Применить» — множители фиксируются в конфиге сессии
 *     (`plAutoRegCfg` в `he_pl_session`) и применяются к плану РОВНО ОДИН РАЗ (билдер/тапер).
 *  3. Слой правок (`applyPLEffectiveOverlay`) авторегуляцию больше не применяет —
 *     иначе −10 % удваивались до −19 %.
 */

export interface PLAutoRegCfg {
  topSetPctMultiplier: number;
  volumeMultiplier: number;
  rirShift: number;
  /** Делод-режим авторегуляции (объём ×0.6). */
  deload: boolean;
  /** Когда пользователь нажал «Применить» (ISO) — для честной подписи в UI. */
  appliedAt: string;
}

/** Поля, которые читает движок (`LMSBuildInput['autoReg']`), без служебного `appliedAt`. */
export function plAutoRegPayload(
  cfg: PLAutoRegCfg | null | undefined,
): { topSetPctMultiplier: number; volumeMultiplier: number; rirShift: number; deload: boolean } | undefined {
  return cfg
    ? {
        topSetPctMultiplier: cfg.topSetPctMultiplier,
        volumeMultiplier: cfg.volumeMultiplier,
        rirShift: cfg.rirShift,
        deload: cfg.deload,
      }
    : undefined;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Разбор сохранённого значения: битые/чужие данные → null (конфиг не применяется). */
export function parsePLAutoRegCfg(raw: unknown): PLAutoRegCfg | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const top = Number(o.topSetPctMultiplier);
  const vol = Number(o.volumeMultiplier);
  const rir = Number(o.rirShift);
  if (!Number.isFinite(top) || !Number.isFinite(vol) || !Number.isFinite(rir)) return null;
  if (top <= 0 || vol <= 0) return null;
  return {
    topSetPctMultiplier: clamp(top, 0.5, 1.2),
    volumeMultiplier: clamp(vol, 0.2, 1.2),
    rirShift: Math.round(clamp(rir, 0, 6)),
    deload: o.deload === true,
    appliedAt: typeof o.appliedAt === 'string' ? o.appliedAt : '',
  };
}

type AutoRegMult = { topSetPctMultiplier: number; volumeMultiplier: number; rirShift: number; deload?: boolean };

/**
 * Совпадают ли множители (конфиг vs предпросмотр «Авто»).
 * Нужно, чтобы UI честно писал «применено», а не предлагал применить то же самое повторно.
 */
export function samePLAutoReg(a: AutoRegMult | null | undefined, b: AutoRegMult | null | undefined): boolean {
  if (!a || !b) return false;
  const eq = (x: number, y: number) => Math.abs(x - y) < 0.005;
  return (
    eq(a.topSetPctMultiplier, b.topSetPctMultiplier) &&
    eq(a.volumeMultiplier, b.volumeMultiplier) &&
    Math.round(a.rirShift) === Math.round(b.rirShift) &&
    !!a.deload === !!b.deload
  );
}
