// Synchronizes Tesseract.js worker/core/lang data and pdfjs worker from node_modules
// into public/ so the lab recognition pipeline works offline (no CDN dependency).
// Invoked via `npm run sync-ocr-assets`, `postinstall`, and `prebuild`.
import { cpSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const targets = [
  // Tesseract.js worker (loads the OCR engine inside a Web Worker)
  {
    src: 'node_modules/tesseract.js/dist/worker.min.js',
    dest: 'public/tesseract/worker.min.js',
    label: 'tesseract worker',
  },
  // Tesseract.js core (WASM). We ship both SIMD and non-SIMD variants so the
  // runtime can pick the right one for the device; SIMD is ~2x faster.
  {
    src: 'node_modules/tesseract.js-core/tesseract-core-simd.wasm.js',
    dest: 'public/tesseract/core/tesseract-core-simd.wasm.js',
    label: 'tesseract core (simd.wasm.js)',
  },
  {
    src: 'node_modules/tesseract.js-core/tesseract-core-simd.wasm',
    dest: 'public/tesseract/core/tesseract-core-simd.wasm',
    label: 'tesseract core (simd.wasm)',
  },
  {
    src: 'node_modules/tesseract.js-core/tesseract-core.wasm.js',
    dest: 'public/tesseract/core/tesseract-core.wasm.js',
    label: 'tesseract core (wasm.js)',
  },
  {
    src: 'node_modules/tesseract.js-core/tesseract-core.wasm',
    dest: 'public/tesseract/core/tesseract-core.wasm',
    label: 'tesseract core (wasm)',
  },
  // Russian + English trained data ("best_int" = smaller, fast load, enough for lab reports)
  {
    src: 'node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz',
    dest: 'public/tesseract/lang/rus.traineddata.gz',
    label: 'tesseract lang rus',
  },
  {
    src: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    dest: 'public/tesseract/lang/eng.traineddata.gz',
    label: 'tesseract lang eng',
  },
  // pdfjs worker (extracts text layer from native PDFs)
  {
    src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
    dest: 'public/pdfjs/pdf.worker.min.mjs',
    label: 'pdfjs worker',
  },
];

let copied = 0;
let skipped = 0;
let missing = 0;

for (const t of targets) {
  const srcPath = join(root, t.src);
  const destPath = join(root, t.dest);
  if (!existsSync(srcPath)) {
    console.warn(`[sync-ocr-assets] SKIP (source missing): ${t.src}`);
    missing++;
    continue;
  }
  // Recreate if missing or stale (size mismatch covers the common case).
  let needCopy = !existsSync(destPath);
  if (!needCopy) {
    const srcSize = statSync(srcPath).size;
    const destSize = statSync(destPath).size;
    if (srcSize !== destSize) needCopy = true;
  }
  if (!needCopy) {
    skipped++;
    continue;
  }
  mkdirSync(dirname(destPath), { recursive: true });
  cpSync(srcPath, destPath);
  console.log(`[sync-ocr-assets] copied ${t.label} -> ${t.dest}`);
  copied++;
}

console.log(`[sync-ocr-assets] done: ${copied} copied, ${skipped} up-to-date, ${missing} missing.`);
