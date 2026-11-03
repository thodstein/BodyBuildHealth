/**
 * bb-pose-capture.engine.ts — BB-G-05: кадры видео → лендмарки BlazePose → сводка метрик.
 *
 * Один загрузчик модели на приложение (`getPoseLandmarker` из cv/pose-engine): модель
 * ~5.5 МБ + WASM грузятся один раз, второй экземпляр не создаётся.
 *
 * Разбор идёт по кадрам видеоэлемента (не по live-потоку): в АПК видео снимается
 * системной камерой через `<input capture="environment">`, затем открывается на весь
 * экран и разбирается уже готовый файл — так работает и в WebView, где getUserMedia
 * часто недоступен. Детектор можно подменить (тесты/офлайн-повтор), поэтому вся
 * геометрия проверяется без реальной модели.
 */
import { getPoseLandmarker } from '../cv/pose-engine';
import {
  summarizeBbPose,
  type BbPoseLandmark,
  type BbPoseSummary,
  type BbPoseView,
} from './bb-pose-metrics.engine';

/** Детектор: элемент + метка времени (мс, монотонно растёт) → 33 лендмарка или null. */
export type BbPoseDetector = (el: HTMLVideoElement | HTMLCanvasElement, tsMs: number) => BbPoseLandmark[] | null;

/** Загружает модель. `null` — модель/ассеты недоступны (офлайн, нет WASM) — это не ошибка разбора. */
export async function createBbPoseDetector(): Promise<BbPoseDetector | null> {
  try {
    const lm = await getPoseLandmarker();
    if (!lm) return null;
    return (el, tsMs) => {
      try {
        const res = lm.detectForVideo(el as any, tsMs);
        const p = res?.landmarks?.[0];
        return Array.isArray(p) && p.length >= 33 ? (p as BbPoseLandmark[]) : null;
      } catch {
        return null;
      }
    };
  } catch {
    return null;
  }
}

export interface BbPoseAnalyzeOptions {
  /** Подмена детектора (тесты). */
  detect?: BbPoseDetector;
  /** Уже собранные кадры — пропускаем DOM целиком (live-режим, повторный расчёт). */
  frames?: BbPoseLandmark[][];
  /** Максимум кадров на разбор (по умолчанию 32 — хватает на 5 повторов). */
  maxFrames?: number;
  onProgress?: (pct: number) => void;
}

/**
 * Разбор видеоэлемента: семплирует кадры (≈3/с, 8–32 кадра) и считает сводку.
 * `null` — модель недоступна или видео без длительности; `summary.quality='none'` —
 * модель отработала, но позы в кадре нет (это разные сообщения для пользователя).
 */
export async function analyzeBbPoseVideo(
  video: HTMLVideoElement,
  view: BbPoseView,
  opts: BbPoseAnalyzeOptions = {},
): Promise<BbPoseSummary | null> {
  if (opts.frames?.length) {
    opts.onProgress?.(100);
    return summarizeBbPose(opts.frames, view);
  }
  const detect = opts.detect ?? (await createBbPoseDetector());
  if (!detect) return null;

  const duration = Number(video.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;

  const maxFrames = opts.maxFrames ?? 32;
  const sampleCount = Math.min(maxFrames, Math.max(8, Math.round(duration * 3)));
  const frames: BbPoseLandmark[][] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = (duration * (i + 0.5)) / sampleCount;
    try {
      video.currentTime = t;
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((res) => {
        const onSeek = () => { video.removeEventListener('seeked', onSeek); res(); };
        video.addEventListener('seeked', onSeek);
        setTimeout(res, 350);
      });
      const lm = detect(video, Math.round(t * 1000) + 1);
      if (lm) frames.push(lm);
    } catch {
      // Битой кадр не должен ронять весь разбор — просто меньше кадров.
    }
    opts.onProgress?.(Math.round(((i + 1) / sampleCount) * 100));
  }

  // Кадров нет вовсе — отдаём сводку с quality:'none' и честной причиной,
  // а не null: null зарезервирован за «модель не загрузилась».
  return summarizeBbPose(frames.length ? frames : [[]], view);
}

/** Полный разбор по уже собранным кадрам (live-камера: кадры копятся в UI). */
export function analyzeBbPoseFrames(frames: BbPoseLandmark[][], view: BbPoseView): BbPoseSummary {
  return summarizeBbPose(frames, view);
}

/** Гиды съёмки — те же требования, что в VIDEO_GUIDE, но по ракурсам и с «почему». */
export const BB_POSE_VIDEO_GUIDE: Record<BbPoseView, {
  title: string; cam: string; dist: string; height: string; markers: string[]; bad: string[];
}> = {
  front: {
    title: 'Присед с руками вверх — строго спереди',
    cam: 'Фронтально на уровне таза, телефон ровно (без наклона)',
    dist: '2.5–3.5 м, весь силуэт от кистей до стоп',
    height: 'Уровень таза (≈0.8–0.9 м), штатив',
    markers: ['Колени и стопы видны одновременно', 'Стойка шире плеч, носки чуть наружу', 'Кисти над головой в кадре'],
    bad: ['Диагональ >15° — вальгус считается по проекции', 'Съёмка сверху/снизу — искажает ширину стойки', 'Стопы вне кадра — стойка не измеряется'],
  },
  side: {
    title: 'Присед с руками вверх — строго сбоку',
    cam: 'Строго сбоку, перпендикулярно направлению взгляда',
    dist: '2.5–3.5 м, весь силуэт + стопа целиком',
    height: 'Уровень таза (≈0.8–0.9 м)',
    markers: ['Стопа целиком (пятка и носок) в кадре', 'Колено и таз видны', 'Кисти над головой в кадре'],
    bad: ['Поворот 3/4 — глубина завышается', 'Стопа обрезана — подъём пятки не считается', 'Тёмный зал/засветка — модель теряет точки'],
  },
};

/** Сообщения состояний — одна формулировка для карточки и тоста. */
export const BB_POSE_STATUS_RU = {
  noModel:
    'Модель позы не загрузилась (нет ассетов / офлайн). Разбор недоступен — работает ручной OHS-скрининг и гониометр.',
  badVideo: 'Не удалось прочитать видео (нет длительности). Попробуйте другой файл или переснимите.',
  noPose:
    'Поза не распознана: нужен весь силуэт от кистей до стоп, ровный свет и чистый ракурс. Переснимите по инструкции выше.',
  lowQuality: 'Мало кадров с позой — результат черновой. Переснимите 5 повторов в полный рост.',
  busy: 'Разбор видео…',
} as const;
