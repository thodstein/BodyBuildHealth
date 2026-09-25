/**
 * arm-annotations.engine.ts — PRO-7 P2: заметки и видео к упражнениям плана.
 *
 * Чистые функции + тонкий слой хранилища (he_arm_annotations_v1). Заметка
 * привязана к конкретному упражнению (неделя + индекс сессии + имя упражнения),
 * поэтому в печати/экспорте видно, к чему она относится. Видео — только
 * ссылка/идентификатор: загрузки файлов в этом слое нет.
 */
export type ArmAnnotationKind = 'note' | 'video';

export interface ArmAnnotation {
  id: string;
  week: number;
  sessionIndex: number;
  exerciseName: string;
  kind: ArmAnnotationKind;
  text: string;
  videoRef?: string;
  createdAt: string;
}

export const ARM_ANNOTATIONS_KEY = 'he_arm_annotations_v1';
export const ARM_ANNOTATIONS_CAP = 60;
const MAX_TEXT = 600;
const MAX_VIDEO_REF = 300;

function trimmed(value: unknown, cap: number): string {
  return String(value ?? '').trim().slice(0, cap);
}

function annotationId(week: number, sessionIndex: number, exerciseName: string, kind: ArmAnnotationKind): string {
  return `ann_${week}_${sessionIndex}_${kind}_${exerciseName}`.replace(/\s+/g, '_').slice(0, 120);
}

export function isArmAnnotation(value: unknown): value is ArmAnnotation {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<ArmAnnotation>;
  return Number.isFinite(a.week) && Number.isFinite(a.sessionIndex) && typeof a.exerciseName === 'string'
    && (a.kind === 'note' || a.kind === 'video') && typeof a.text === 'string';
}

export function addArmAnnotation(
  list: readonly ArmAnnotation[] | null | undefined,
  input: { week: number; sessionIndex: number; exerciseName: string; kind: ArmAnnotationKind; text?: string; videoRef?: string; createdAt?: string },
): ArmAnnotation[] {
  const week = Math.max(1, Math.round(Number(input.week) || 1));
  const sessionIndex = Math.max(0, Math.round(Number(input.sessionIndex) || 0));
  const exerciseName = trimmed(input.exerciseName, 120);
  const text = trimmed(input.text, MAX_TEXT);
  const videoRef = trimmed(input.videoRef, MAX_VIDEO_REF);
  if (!exerciseName) return Array.isArray(list) ? [...list] : [];
  if (input.kind === 'note' && !text) return Array.isArray(list) ? [...list] : [];
  if (input.kind === 'video' && !videoRef) return Array.isArray(list) ? [...list] : [];
  const next: ArmAnnotation = {
    id: annotationId(week, sessionIndex, exerciseName, input.kind),
    week,
    sessionIndex,
    exerciseName,
    kind: input.kind,
    text,
    ...(videoRef ? { videoRef } : {}),
    createdAt: trimmed(input.createdAt, 40) || new Date().toISOString(),
  };
  const base = (Array.isArray(list) ? list.filter(isArmAnnotation) : []).filter(a => a.id !== next.id);
  return [...base, next].slice(-ARM_ANNOTATIONS_CAP);
}

export function removeArmAnnotation(
  list: readonly ArmAnnotation[] | null | undefined,
  id: string,
): ArmAnnotation[] {
  return (Array.isArray(list) ? list.filter(isArmAnnotation) : []).filter(a => a.id !== id);
}

export function clearArmAnnotations(): void {
  try { localStorage.removeItem(ARM_ANNOTATIONS_KEY); } catch { /* ignore */ }
}

export function loadArmAnnotations(): ArmAnnotation[] {
  try {
    const raw = localStorage.getItem(ARM_ANNOTATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isArmAnnotation).slice(-ARM_ANNOTATIONS_CAP) : [];
  } catch { return []; }
}

export function saveArmAnnotations(list: readonly ArmAnnotation[]): ArmAnnotation[] {
  const clean = (Array.isArray(list) ? list.filter(isArmAnnotation) : []).slice(-ARM_ANNOTATIONS_CAP);
  try { localStorage.setItem(ARM_ANNOTATIONS_KEY, JSON.stringify(clean)); } catch { /* ignore */ }
  return clean;
}

/** Строки для печати/экспорта: «Н3 · Сессия 2 · Жим — заметка / видео». */
export function armAnnotationLines(list: readonly ArmAnnotation[] | null | undefined): string[] {
  return (Array.isArray(list) ? list.filter(isArmAnnotation) : [])
    .slice()
    .sort((a, b) => (a.week - b.week) || (a.sessionIndex - b.sessionIndex) || a.exerciseName.localeCompare(b.exerciseName))
    .map(a => `Н${a.week} · сессия ${a.sessionIndex + 1} · ${a.exerciseName} — ${a.kind === 'video' ? `видео: ${a.videoRef ?? ''}` : a.text}`);
}

export function armAnnotationFor(
  list: readonly ArmAnnotation[] | null | undefined,
  ref: { week: number; sessionIndex: number; exerciseName: string },
): ArmAnnotation[] {
  return (Array.isArray(list) ? list.filter(isArmAnnotation) : []).filter(
    a => a.week === ref.week && a.sessionIndex === ref.sessionIndex && a.exerciseName === ref.exerciseName,
  );
}
