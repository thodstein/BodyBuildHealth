/**
 * bb-ortho-prehab.engine.ts — BB-D-19 (хвост): орто-скрининг J1–J7 → ББ-диагностика.
 *
 * ПОЧЕМУ ЗДЕСЬ НЕТ «СЛАБЫХ ЗОН». Аудит предлагал добавить в орто-payload канонические
 * группы мышц. Но в ББ-авто `groups`/`weakPoints` = слабые зоны → спец-блок
 * (`setSpecBlocks`, плюс объём на эти мышцы). Орто-флаг означает «сустав болит /
 * нестабилен / не готов», и специализация на нём увеличила бы нагрузку ровно на
 * проблемную область. Поэтому каналы разделены:
 *   1) ОГРАНИЧЕНИЯ — прежний `orthoGuards` (pauseOverhead, blockedPatterns, closedChain…),
 *      приёмник ББ-авто их уже исполняет;
 *   2) ПРЕХАБ — строки ниже: щадящее упражнение + доза из библиотеки коррекций ББ.
 *      Зона подписана `сустав: …`, чтобы её нельзя было принять за слабую мышцу
 *      и чтобы она не попала в спец-блок.
 *
 * Библиотека не дублируется: упражнение/доза/кью/прогрессия берутся из
 * `bb-corrective.engine.ts` по стабильному id записи (каталог проверен lock-тестом
 * библиотеки). Неизвестный сустав/флаг — тихо, без выдуманной коррекции.
 *
 * Честность уровней:
 *  - `urgent` (любой) → прехаба НЕТ: тренировка на паузе до врача, строка
 *    «делай face pull» здесь была бы ложью;
 *  - `doctor` → строка есть, но помечена `doctorFirst` («после допуска врача»);
 *  - `watch` → обычная прехаб-строка;
 *  - `general` (Beighton / жёлтые флаги / teen) → прехаба нет: это режимные
 *    ограничения, а не зона, и они уже едут гардами.
 */

import { correctiveById, type BBCorrective, type BBCorrPhase } from './bb-corrective.engine';

export type BbOrthoJoint = 'shoulder' | 'hip' | 'knee' | 'spine' | 'ankle' | 'elbow' | 'hand';

/** Структурный срез `OrthoFlag` (без импорта из pro: движок ББ не должен зависеть от UI-слоя). */
export interface BbOrthoFlagLike {
  id: string;
  joint: string;
  level: string;
  label?: string;
}

export interface BbOrthoPrehabRow {
  /** Стабильный id строки: `ortho-<сустав>-<id записи библиотеки>`. */
  id: string;
  joint: BbOrthoJoint;
  /** Не мышца: `сустав: плечо (прехаб)` — чтобы не спутать со слабой зоной. */
  zone: string;
  title: string;
  exerciseId: string;
  protocol: string;
  cues: string[];
  why: string;
  source: string;
  /** Флаг уровня `doctor`: строку выполняем только после допуска врача. */
  doctorFirst: boolean;
  phase: BBCorrPhase;
}

export const BB_ORTHO_JOINT_RU: Record<BbOrthoJoint, string> = {
  shoulder: 'плечо',
  hip: 'тазобедренный',
  knee: 'колено',
  spine: 'позвоночник',
  ankle: 'голеностоп',
  elbow: 'локоть',
  hand: 'кисть',
};

/**
 * Сустав → записи библиотеки ББ-коррекций (порядок = приоритет показа).
 * Только щадящие записи: никакой специализации и никаких «добей зону».
 */
const JOINT_TO_CORR: Record<BbOrthoJoint, string[]> = {
  shoulder: ['sh-pm-facepull', 'sh-wall-slide'],
  hip: ['g-clam-complex'],
  knee: ['g-clam-complex', 'g-single-bridge'],
  ankle: ['cv-ktw-ankle-calf'],
  spine: ['core-deadbug'],
  elbow: ['fa-wrist-curl'],
  // Кисть (de Quervain / канал / Tinel) — щадить, а не нагружать: только врач.
  hand: [],
};

export const BB_ORTHO_PREHAB_NOTE =
  'Орто-скрининг не делает мышцу «слабой»: ограничения едут гардами ББ-авто (пауза жима над головой, глубина приседа, закрытая цепь), а прехаб ниже — щадящие упражнения, не спец-блок.';

const LEVEL_RANK: Record<string, number> = { ok: 0, watch: 1, doctor: 2, urgent: 3 };

function isJoint(v: string): v is BbOrthoJoint {
  return Object.prototype.hasOwnProperty.call(JOINT_TO_CORR, v);
}

function protocolOf(c: BBCorrective): string {
  const p = c.protocol;
  return `${p.sets}×${p.repsMin}–${p.repsMax} RIR${p.rir} ${p.tempo}`;
}

/**
 * Строки прехаба по сохранённым орто-флагам. Идемпотентно, вход не мутирует.
 * `cap` — сколько строк максимум (хаб показывает 3, экспорт печатает те же).
 */
export function bbOrthoPrehabRows(flags: unknown, opts: { cap?: number } = {}): BbOrthoPrehabRow[] {
  const list = Array.isArray(flags) ? (flags as BbOrthoFlagLike[]).filter((f) => f && typeof f === 'object') : [];
  if (!list.length) return [];
  // 🔴 Любой urgent → тренировки нет. Прехаб-строка подала бы ложный сигнал «можно работать».
  if (list.some((f) => String(f.level) === 'urgent')) return [];

  const cap = Math.max(0, Math.min(6, Number.isFinite(Number(opts.cap)) ? Number(opts.cap) : 3));
  const out: BbOrthoPrehabRow[] = [];
  const used = new Set<string>();

  for (const f of list) {
    const joint = String(f.joint || '');
    if (!isJoint(joint)) continue; // general / мусор — гарды, не прехаб
    const level = String(f.level || '');
    if (!(LEVEL_RANK[level] >= LEVEL_RANK.watch)) continue; // ok → нет флага
    for (const corrId of JOINT_TO_CORR[joint]) {
      if (out.length >= cap) return out;
      const corr = correctiveById(corrId);
      if (!corr) continue; // библиотека урезана — тихо, без выдуманного id
      if (used.has(corr.exerciseId)) continue; // один и тот же exerciseId не дублируем
      used.add(corr.exerciseId);
      const doctorFirst = level === 'doctor';
      out.push({
        id: `ortho-${joint}-${corr.id}`,
        joint,
        zone: `сустав: ${BB_ORTHO_JOINT_RU[joint]} (прехаб)`,
        title: corr.title,
        exerciseId: corr.exerciseId,
        protocol: protocolOf(corr),
        cues: corr.cues.slice(),
        why: doctorFirst
          ? `после допуска врача · ${String(f.label || f.id || joint)}`
          : String(f.label || f.id || joint),
        source: `орто J7: ${String(f.id || joint)}`,
        doctorFirst,
        phase: corr.phase,
      });
    }
  }
  return out;
}

export interface BbOrthoSummary {
  total: number;
  urgent: number;
  doctor: number;
  watch: number;
  text: string;
}

/** Сводка флагов для карточки/отчёта: считает уровни, не прячет urgent. */
export function bbOrthoFlagsSummary(flags: unknown): BbOrthoSummary {
  const list = Array.isArray(flags) ? (flags as BbOrthoFlagLike[]).filter((f) => f && typeof f === 'object') : [];
  let urgent = 0;
  let doctor = 0;
  let watch = 0;
  for (const f of list) {
    const lv = String(f.level || '');
    if (lv === 'urgent') urgent++;
    else if (lv === 'doctor') doctor++;
    else if (lv === 'watch') watch++;
  }
  const parts = [
    urgent ? `🔴 ${urgent}` : '',
    doctor ? `🟡 ${doctor}` : '',
    watch ? `⚪ ${watch}` : '',
  ].filter(Boolean).join(' · ');
  const text = list.length ? `флагов ${list.length}${parts ? ` (${parts})` : ''}` : 'флагов нет';
  return { total: list.length, urgent, doctor, watch, text };
}
