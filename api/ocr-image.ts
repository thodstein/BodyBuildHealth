import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_BYTES = 12 * 1024 * 1024;
const OCR_TIMEOUT_MS = 240_000;

export const config = {
  api: { bodyParser: { sizeLimit: '16mb' } },
};

async function recognizeImage(buffer: Buffer): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('rus+eng');
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '3' as any,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });
    const result = await Promise.race([
      worker.recognize(buffer),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`OCR timeout after ${OCR_TIMEOUT_MS} ms`)), OCR_TIMEOUT_MS)),
    ]);
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const encoded = typeof req.body?.data === 'string' ? req.body.data : '';
    if (!encoded) return res.status(400).json({ ok: false, error: 'Image data is required' });
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: 'Image must be between 1 byte and 12 MB' });
    }
    const text = await recognizeImage(buffer);
    return res.status(200).json({ ok: true, text });
  } catch (error: any) {
    console.error('[ocr-image]', error);
    return res.status(422).json({ ok: false, error: error?.message || 'Server OCR failed' });
  }
}
