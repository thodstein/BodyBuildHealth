/**
 * support-plan/lab-slice.ts — какой бланк считается текущим.
 *
 * Проход 136: контуры отвечали на этот вопрос по-разному. Риск-модель
 * (`extractLabValues`), баннеры формы (единицы, границы) и подсказки читают
 * `fullPanel || midCourse || preCourse`, а план поддержки (`labSliceToValues`)
 * смотрел только `fullPanel`. Человек, заполнивший «середину курса», получал риск
 * и находки по анализам, но ступени, мост механизмов и противопоказания — по
 * пустой карте: советов по анализам не появлялось вовсе, и это не было видно.
 *
 * Теперь правило одно на все контуры: полный бланк, иначе середина курса, иначе
 * до курса. «Нет записи» по-прежнему не значит «в норме» — пустой бланк даёт пустую
 * карту, а не нули.
 */
import type { LabPanelData, LabSlice } from './types';

export function currentLabSlice(labs?: LabPanelData | null): LabSlice | null {
  if (!labs) return null;
  return labs.fullPanel || labs.midCourse || labs.preCourse || null;
}
