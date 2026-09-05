// sync-hero-webp.mjs — WebP-дериваты hero-картинок для APK (и TG заодно:
// тот же файл, тот же вид, только быстрее).
//
// Источник: public/*.png|*.jpg (hero-*, bg-profile.*). Выход: рядом лежит
// <name>.webp (q80, effort 4). Перегенерация — только когда исходник новее.
// Без новых npm-зависимостей: используется уже имеющийся @napi-rs/canvas.
// Если энкодер WebP недоступен в сборке canvas — скрипт честно падает с
// понятной ошибкой (а не молча пропускает).
//
// Запуск: `npm run sync-hero-webp` (вручную при смене артов).
// Использование: <picture><source srcSet="/hero-main.webp" type="image/webp"/>
// <img src="/hero-main.png" …/></picture> — старые WebView видят PNG.

import { existsSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pub = join(root, 'public');

// ТОЛЬКО файлы, реально используемые в коде (проверено grep по src/).
// Близнецы сознательно исключены: support-hero.png и support-hero.jpg дали бы
// один support-hero.webp (используется .jpg), calc/fertility/main/hulk/hero-image
// в src не referenced — webp для них не генерируем.
const SOURCES = [
  'hero-main.png', // DashboardScreen TG + DashboardScreen.native
  'training-hero.jpg', // TrainingScreen hero
  'pharma-hero.png', // PharmaScreen_parts hero
  'risk-hero.png', // RiskScreen hero
  'articles-hero.png', // ArticlesScreen hero
  'profile-hero.png', // ProfileHero
  'support-hero.jpg', // SupportHomeView hero
  'nutrition-hero.jpg', // NutritionScreen hero
  'lab-hero.png', // LabsScreen hero
  'bg-profile.png', // App.tsx фоновая подложка
];

const QUALITY = 80;

let made = 0;
let fresh = 0;
let missing = 0;

const { createCanvas, loadImage } = await import('@napi-rs/canvas');

// Проверка энкодера до цикла — чтобы не получить 17 молчаливых пропусков.
{
  const probe = createCanvas(8, 8);
  try {
    probe.toBuffer('image/webp');
  } catch (e) {
    console.error(`[sync-hero-webp] FATAL: canvas-сборка без WebP (${String(e).slice(0, 160)})`);
    process.exit(1);
  }
}

for (const name of SOURCES) {
  const src = join(pub, name);
  const dot = name.lastIndexOf('.');
  const dest = join(pub, `${name.slice(0, dot)}.webp`);
  if (!existsSync(src)) {
    console.warn(`[sync-hero-webp] SKIP (нет исходника): ${name}`);
    missing++;
    continue;
  }
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) {
    fresh++;
    continue;
  }
  const img = await loadImage(src);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  const buf = canvas.toBuffer('image/webp');
  // Кап качества: WebP обязан быть меньше оригинала, иначе дериват вреден.
  const origSize = statSync(src).size;
  if (buf.length >= origSize) {
    console.warn(
      `[sync-hero-webp] SKIP (webp ${buf.length} >= orig ${origSize}): ${name}`,
    );
    missing++;
    continue;
  }
  writeFileSync(dest, buf);
  console.log(
    `[sync-hero-webp] ${name} ${origSize} -> webp ${buf.length} (${Math.round((buf.length / origSize) * 100)}%)`,
  );
  made++;
}

console.log(`[sync-hero-webp] done: ${made} encoded, ${fresh} fresh, ${missing} skipped.`);
