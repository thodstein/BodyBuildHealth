/**
 * bb-ped-profile.ts — одно дозо-зависимое правило «реальный PED-профиль».
 *
 * Аудит 2026-11, P3-2. Раньше «высокий объём/на курсе» определялся в трёх местах по
 * трём разным правилам: решения о сплите — дозо-зависимо, кап сессии и MRV-множитель —
 * по самому факту непустого списка `peds`. Креатин (и любой витамин из списка) делал
 * атлета «курсовым»: недельный бюджет восстановления ×2, MRV ×1.9–2.15, кап сессии
 * 60/16 — то есть план строился на объёме, которого у атлета нет.
 *
 * Модуль вынесен отдельно, чтобы его могли читать и `bb-selector` (правило сплита), и
 * `bb-volume` (бюджет/MRV/капы сессии): `bb-volume` не может импортировать
 * `bb-selector` (тот уже импортирует `bb-volume` — был бы цикл).
 */

import { normLevel } from '../volume-landmarks.engine';

/** Мини-вход: списки и дозы PED. Форма совместима с `BBSelectorInput`. */
export interface PedProfileInput {
  peds?: string[];
  pedDoses?: Record<string, number>;
}

/**
 * Профиль фармподдержки: AAS / GH / инсулин.
 *
 * AAS — имя содержит `aas`/`тест` ИЛИ доза `AAS` ≥ 500 мг; GH и инсулин — по имени
 * (`GH`/`insulin`) или по ненулевой дозе.
 */
export function pedProfileOf(
  input: PedProfileInput,
): { hasAAS: boolean; hasGH: boolean; hasIns: boolean } {
  const peds = input.peds || [];
  const doses = (input.pedDoses || {}) as Record<string, number>;
  const hasAAS = peds.some((x) => {
    const s = String(x).toLowerCase();
    return s.includes('aas') || s.includes('тест');
  }) || Number(doses['AAS'] || 0) >= 500;
  const hasGH = peds.some((x) => String(x) === 'GH') || Number(doses['GH'] || 0) > 0;
  const hasIns = peds.some((x) => String(x) === 'insulin') || Number(doses['insulin'] || 0) > 0;
  return { hasAAS, hasGH, hasIns };
}

/** «Высокий объём» для решения о сплите: enhanced или реальный PED-профиль. */
export function highVolumeDemandOf(
  input: PedProfileInput & { level?: string },
): boolean {
  if (normLevel(String(input.level || '')) === 'enhanced') return true;
  const { hasAAS, hasGH, hasIns } = pedProfileOf(input);
  return hasAAS || hasGH || hasIns;
}

/**
 * «На курсе» для объёма (бюджет/MRV/капы сессии): явный режим или реальный PED-профиль.
 * Креатин и прочие добавки курсом не считаются — именно это и чинит P3-2.
 *
 * Приоритет: явный флаг сильнее профиля. Пользователь с PED-профилем может быть ВНЕ
 * курса (фаза «off», пауза), и тогда план должен считаться натуральным; профиль
 * включается только когда флаг вообще не задан (прежнее `peds.length > 0`).
 */
export function onCourseOf(input: PedProfileInput & { onCourse?: boolean }): boolean {
  if (input.onCourse != null) return input.onCourse === true;
  const { hasAAS, hasGH, hasIns } = pedProfileOf(input);
  return hasAAS || hasGH || hasIns;
}
