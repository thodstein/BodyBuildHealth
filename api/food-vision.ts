/**
 * food-vision.ts — один серверный эндпоинт для всех трёх vision-задач:
 *   POST { imageBase64, mimeType?, purpose?: 'food' | 'label' | 'lab', locale? }
 *   GET  → { ok, configured, provider?, model?, purposes }
 *
 * Ключ AI живёт только в переменных окружения Vercel и никогда не уходит
 * клиенту: GET отдаёт лишь имя провайдера и модели. Подробности — docs/FOOD-VISION.md.
 *
 * CORS открыт намеренно: APK (Capacitor) грузит приложение с origin
 * `https://localhost` и обращается к этому эндпоинту по абсолютному URL из
 * `VITE_FOOD_VISION_URL`. Без этого заголовка WebView отрезал бы ответ.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
// Расширение .js обязательно: package.json объявлен как "type": "module", и
// Node ESM не резолвит относительный импорт без расширения (функция падала
// с ERR_MODULE_NOT_FOUND на /var/task/api/_vision-core).
import { runVision, visionStatus, VisionError } from './_vision-core.js';

export const config = {
  // Vercel режет тело запроса на 4.5 МБ до вызова функции; держим лимит явно,
  // чтобы ответ оставался нашим JSON с CORS, а не платформенным 413.
  api: { bodyParser: { sizeLimit: '4.5mb' } },
};

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function statusForCode(code: string): number {
  switch (code) {
    case 'no_provider':
      return 503;
    case 'image_too_large':
      return 413;
    case 'no_image':
    case 'bad_request':
      return 400;
    case 'timeout':
      return 504;
    case 'invalid_json':
    case 'empty_payload':
    case 'invalid_payload':
      return 422;
    default:
      return 502;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const status = visionStatus();
    return res.status(200).json({ ok: true, ...status });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, code: 'method_not_allowed', error: 'Method not allowed' });
  }

  try {
    let body: any = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        throw new VisionError('bad_request', 'Тело запроса не JSON');
      }
    }
    body = body && typeof body === 'object' ? body : {};
    const imageBase64 =
      typeof body.imageBase64 === 'string' ? body.imageBase64 : typeof body.image === 'string' ? body.image : '';
    if (!imageBase64) throw new VisionError('no_image', 'Поле imageBase64 обязательно');

    const result = await runVision({
      imageBase64,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
      purpose: body.purpose,
      locale: typeof body.locale === 'string' ? body.locale : undefined,
      // OCR-подсказка: ограничиваем длину, чтобы тело запроса к модели не
      // раздувалось и промпт не перевесил само изображение.
      hint: typeof body.hint === 'string' ? body.hint.slice(0, 1600) : undefined,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const code = error instanceof VisionError ? error.code : 'server_error';
    // В лог — только код и сообщение: картинка и ключ сюда не попадают.
    console.error('[food-vision]', code, error?.message || String(error));
    return res.status(statusForCode(code)).json({
      ok: false,
      code,
      error: error?.message || 'Vision failed',
    });
  }
}
