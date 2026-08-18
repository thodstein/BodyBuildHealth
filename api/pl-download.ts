/**
 * api/pl-download.ts — временная выдача файла для скачивания на телефоне.
 * Telegram WebView блокирует прямые скачивания, поэтому на мобильном клиент
 * передаёт файл (base64) сюда, а этот эндпоинт отдаёт его браузеру телефона
 * с заголовком Content-Disposition: attachment.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const MIME_BY_EXT: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const { name, b64 } = req.query || {};
  const rawName = Array.isArray(name) ? name[0] : (name as string | undefined);
  const rawB64 = Array.isArray(b64) ? b64[0] : (b64 as string | undefined);
  if (!rawName || !rawB64) {
    return res.status(400).json({ ok: false, error: 'name and b64 required' });
  }
  const safeName = decodeURIComponent(rawName).replace(/[\\/:*?"<>|\r\n]/g, '_') || 'plan.xlsx';
  const buf = Buffer.from(rawB64, 'base64');
  if (buf.length === 0) {
    return res.status(400).json({ ok: false, error: 'empty file' });
  }
  const ext = safeName.split('.').pop()?.toLowerCase() || 'bin';
  res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buf);
}
