/**
 * Domain router for BodyBuildHealth.
 * Gives the lead a deterministic first-pass map: skills, sources, files and checks.
 * It does not edit code and does not replace evidence verification.
 */
import { Plugin } from '@opencode/plugin';

type Route = {
  id: string;
  label: string;
  skills: string[];
  keywords: string[];
  sources: string[];
  paths: string[];
  checks: string[];
  gates: string[];
};

const ROUTES: Route[] = [
  {
    id: 'nutrition-ocr',
    label: 'Питание и OCR еды',
    skills: ['nutrition-ocr', 'data-import', 'testing-workflow'],
    keywords: ['питан', 'еда', 'кбжу', 'калори', 'этикет', 'штрихкод', 'nutrition', 'food', 'ocr'],
    sources: [
      'код: src/core/ocr-engine.ts + src/engines/nutrition-ocr-parser.ts',
      'данные: FOOD_DB/USDA/OpenFoodFacts',
    ],
    paths: [
      'src/core/ocr-engine.ts',
      'src/engines/nutrition-ocr-parser.ts',
      'src/engines/nutrition-label-parser.ts',
      'src/core/nutrition-database.ts',
    ],
    checks: ['targeted nutrition OCR/parser Vitest', 'npm run type-check', 'npm run verify:apk-design при UI/APK'],
    gates: ['не обещать vision по фото блюда', 'offline Tesseract для APK', 'макросы canonical per 100 g'],
  },
  {
    id: 'lab-ocr',
    label: 'Лабораторные анализы и OCR',
    skills: ['lab-ocr', 'data-import', 'research', 'testing-workflow'],
    keywords: ['анализ', 'лаборатор', 'биомаркер', 'гормон', 'кров', 'лаборатори', 'lab', 'biomarker'],
    sources: [
      'код: repo_lab + labs-mapping/lab-norms',
      'внешние нормы/медицина: evidence_literature или drug label по вопросу',
    ],
    paths: [
      'src/core/ocr-engine.ts',
      'src/core/lab-auto-parser.ts',
      'src/core/labs-mapping.ts',
      'src/engines/biomarker-regex-engine.ts',
      'src/engines/lab-norms.engine.ts',
    ],
    checks: ['lab OCR/provider/unit Vitest', 'npm run type-check', 'npm run verify:apk-design при UI/APK'],
    gates: [
      'canonical UCUM code/unit',
      'OCR ref range не превращать в универсальную норму',
      'unknown/warning при низкой уверенности',
    ],
  },
  {
    id: 'medical-evidence',
    label: 'Медицина, фарма и ААС',
    skills: ['aas-medicine', 'research', 'professional-quality'],
    keywords: [
      'медицин',
      'фарма',
      'препарат',
      'доза',
      'побоч',
      'анабол',
      'стероид',
      'пкт',
      'aas',
      'ped',
      'лекарств',
      'safety',
      'privacy',
      'security',
    ],
    sources: ['сначала repo_pharma/repo_lab', 'затем evidence_literature/drug_label/substance/citation'],
    paths: [
      'src/core/pharma-database.ts',
      'src/core/pharma-db',
      'src/engines/pharmacology.engine.ts',
      'src/engines/lab-norms.engine.ts',
    ],
    checks: ['targeted core/engine Vitest', 'npm run type-check', 'disclaimer/red-flag review'],
    gates: [
      'нет источника — нет числа',
      'off-label явно помечать',
      'не выдавать самоназначение/инъекцию за рекомендацию',
      'женский safety layer отдельно',
    ],
  },
  {
    id: 'strength-sports',
    label: 'Силовые виды спорта',
    skills: ['strength-sports', 'bb-engine', 'research', 'testing-workflow'],
    keywords: [
      'бодибилдинг',
      'гипертроф',
      'пауэрлифт',
      'армрестл',
      'стронгмен',
      'силов',
      'трениров',
      '1rm',
      'rpe',
      'rir',
      'peaking',
      'training',
    ],
    sources: ['код: соответствующий engine + diary/tests', 'методические/медицинские факты: research/PubMed'],
    paths: ['src/engines/bb', 'src/engines/strength-sport', 'src/engines/arm', 'src/ui/screens/strength-sport'],
    checks: ['npm run test:bb или точечный strength-sport/arm Vitest', 'npm run type-check', 'npm run test:ui при UI'],
    gates: [
      'детерминированный plan build',
      'не выдумывать RIR/RPE',
      'локальные ISO dates',
      'делoad/injury/equipment edge cases',
    ],
  },
  {
    id: 'ui-apk',
    label: 'Оформление, UI и APK',
    skills: ['ui-design', 'professional-quality', 'testing-workflow'],
    keywords: [
      'дизайн',
      'оформлен',
      'интерфейс',
      'экран',
      'ui',
      'ux',
      'apk',
      'android',
      'css',
      'тема',
      'цвет',
      'visual',
      'release',
      'performance',
      'quality',
    ],
    sources: ['код: src/ui + src/styles*.css + APK marker script', 'библиотечный API: context7'],
    paths: ['src/ui', 'src/styles.css', 'src/styles-native.css', 'scripts/check-apk-markers.mjs', 'public'],
    checks: ['npm run test:ui', 'npm run type-check', 'npm run verify:apk-design'],
    gates: ['CSS tokens вместо raw accent hex', 'safe-area/44px targets', 'native-safe controls и offline UX'],
  },
  {
    id: 'general-code',
    label: 'Общий код/архитектура',
    skills: ['professional-quality', 'testing-workflow'],
    keywords: [],
    sources: ['код: read/grep и существующие tests', 'API/SDK: context7'],
    paths: ['изменённые файлы'],
    checks: ['npm run type-check', 'подходящий targeted Vitest', 'diff review'],
    gates: ['не менять чужой WIP', 'один canonical source', 'тест отказа и повторного запуска'],
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

function routeTask(task: string, paths: string[]): string {
  const text = normalize(`${task} ${paths.join(' ')}`);
  const scored = ROUTES.map((route) => ({
    route,
    score: route.keywords.length === 0 ? 0 : route.keywords.filter((word) => text.includes(normalize(word))).length,
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.route.id.localeCompare(b.route.id));

  // Broad requests (for example: OCR + medicine + training + UI) must retain
  // every explicitly matched domain. Keep a cap only as protection against a
  // noisy prompt, rather than silently dropping low-frequency but important
  // domains such as medical evidence or nutrition.
  const selected = scored.length > 0 ? scored.slice(0, 5).map((item) => item.route) : [ROUTES[ROUTES.length - 1]];
  const skills = [...new Set(selected.flatMap((route) => route.skills))];
  const sources = [...new Set(selected.flatMap((route) => route.sources))];
  const checks = [...new Set(selected.flatMap((route) => route.checks))];
  const gates = [...new Set(selected.flatMap((route) => route.gates))];
  const pathsToInspect = [...new Set(selected.flatMap((route) => route.paths))];

  return [
    '## BodyBuildHealth task route',
    `Задача: ${task.trim() || '(не указана)'}`,
    '',
    `Домены: ${selected.map((route) => `${route.label} (${route.id})`).join('; ')}`,
    `Навыки: ${skills.join(', ')}`,
    `Сначала проверить: ${sources.join('; ')}`,
    `Карта файлов: ${pathsToInspect.join('; ')}`,
    `Проверки: ${checks.join('; ')}`,
    `Safety/quality gates: ${gates.join('; ')}`,
    '',
    'Правило: медицинское число/доза/порог/эффект не добавлять без проверяемого источника; при отсутствии данных писать «нет данных».',
  ].join('\n');
}

export default Plugin.define({
  id: 'task-router',
  setup(ctx) {
    return ctx.tool.transform((editor) => {
      editor.namespace({
        name: 'project',
        description: 'BodyBuildHealth task routing: domains, skills, sources, files and checks',
      });

      editor.add({
        name: 'route',
        description:
          'Разложить задачу BodyBuildHealth по доменам (nutrition OCR, labs OCR, медицина/ААС, силовые виды спорта, UI/APK), ' +
          'подобрать навыки, источники истины, файлы, проверки и safety gates. Только анализ, без изменений.',
        options: { namespace: 'project', codemode: true },
        input: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Полное описание задачи пользователя.' },
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Известные пути, если задача уже привязана к файлам.',
            },
          },
          required: ['task'],
          additionalProperties: false,
        },
        execute: async (input) => {
          const args = (input ?? {}) as { task?: string; paths?: string[] };
          return { content: routeTask(args.task ?? '', Array.isArray(args.paths) ? args.paths : []) };
        },
      });
    });
  },
});
