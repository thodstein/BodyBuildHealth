import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcWasm = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dstRoot = path.join(root, 'public', 'mediapipe');
const dstWasm = path.join(dstRoot, 'wasm');
const modelPath = path.join(dstRoot, 'pose_landmarker_lite.task');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
  return true;
}

let copied = 0;
if (copyDir(srcWasm, dstWasm)) copied++;

let modelStatus = 'skipped';
if (!fs.existsSync(modelPath)) {
  try {
    const res = await fetch(modelUrl);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(dstRoot, { recursive: true });
      fs.writeFileSync(modelPath, buf);
      modelStatus = 'downloaded';
    } else {
      modelStatus = 'http ' + res.status;
    }
  } catch (e) {
    modelStatus = 'failed: ' + (e?.message || e);
  }
} else {
  modelStatus = 'up-to-date';
}

console.log(`[sync-mediapipe] wasm copied=${copied}, model=${modelStatus}`);
