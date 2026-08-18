import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createCanvas } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 8;
const MAX_PAGE_PIXELS = 4_000_000;

async function recognizePdf(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // PDF.js v6 still starts its fake worker in Node unless a real worker file
  // is provided. Keep the worker as a static dependency in the serverless
  // function instead of relying on the browser public asset.
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerPath;
  const { createWorker } = await import('tesseract.js');
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useWorker: false,
  } as any).promise;
  if (pdf.numPages > MAX_PAGES) throw new Error(`PDF содержит ${pdf.numPages} страниц, максимум ${MAX_PAGES}`);

  const worker = await createWorker('rus+eng');
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '3' as any,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, Math.sqrt(MAX_PAGE_PIXELS / Math.max(1, base.width * base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvas: canvas as any, canvasContext: context as any, viewport }).promise;
      const result = await worker.recognize(canvas as any);
      if (result.data.text?.trim()) pages.push(result.data.text);
      page.cleanup?.();
    }
    return pages.join('\n');
  } finally {
    await worker.terminate();
    await pdf.cleanup?.();
    await (pdf as any).destroy?.();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const encoded = typeof req.body?.data === 'string' ? req.body.data : '';
    if (!encoded) return res.status(400).json({ ok: false, error: 'PDF data is required' });
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: 'PDF must be between 1 byte and 12 MB' });
    }
    const text = await recognizePdf(buffer);
    return res.status(200).json({ ok: true, text });
  } catch (error: any) {
    console.error('[ocr-scanned-pdf]', error);
    return res.status(422).json({ ok: false, error: error?.message || 'Server OCR failed' });
  }
}
