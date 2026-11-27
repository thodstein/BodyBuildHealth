/**
 * Production quality gates for BodyBuildHealth.
 *
 * The gates report evidence and missing safeguards. They never edit code,
 * invent medical facts, or turn a static scan into a clinical conclusion.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Plugin } from '@opencode/plugin';

type Severity = 'P0' | 'P1' | 'P2' | 'P3';
type Finding = { severity: Severity; file?: string; line?: number; message: string; fix?: string };
type Step = { label: string; command: string; ok: boolean; seconds: number; output: string };

const SKIP = new Set(['.git', 'node_modules', 'dist', 'coverage', 'android/build', 'android/app/build']);
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.sql',
  '.csv',
  '.txt',
]);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.sql']);

function extension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot < 0 ? '' : path.slice(dot).toLowerCase();
}

function repoPath(cwd: string, path: string): string {
  return relative(cwd, path).replaceAll(sep, '/');
}

function skipped(path: string): boolean {
  const p = path.replaceAll('\\', '/');
  return [...SKIP].some((part) => p === part || p.startsWith(`${part}/`));
}

function text(path: string): string | null {
  try {
    const value = readFileSync(path, 'utf8');
    return value.includes('\0') ? null : value;
  } catch {
    return null;
  }
}

function files(cwd: string, roots: string[], extensions = TEXT_EXT): string[] {
  const result: string[] = [];
  const visit = (path: string) => {
    if (!existsSync(path)) return;
    let info;
    try {
      info = lstatSync(path);
    } catch {
      return;
    }
    if (skipped(repoPath(cwd, path))) return;
    if (info.isFile()) {
      const dot = path.lastIndexOf('.');
      if (dot < 0 || extensions.has(path.slice(dot).toLowerCase())) result.push(path);
      return;
    }
    if (!info.isDirectory()) return;
    for (const entry of readdirSync(path)) visit(join(path, entry));
  };
  roots.forEach((root) => visit(join(cwd, root)));
  return [...new Set(result)];
}

function resolve(cwd: string, requested: string[] | undefined, defaults: string[]): string[] {
  const result: string[] = [];
  for (const root of requested?.length ? requested : defaults) {
    const absolute = join(cwd, root);
    if (!existsSync(absolute)) continue;
    if (statSync(absolute).isFile()) result.push(absolute);
    else result.push(...files(cwd, [root]));
  }
  return [...new Set(result)];
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function match(
  findings: Finding[],
  cwd: string,
  path: string,
  source: string,
  pattern: RegExp,
  create: (line: number, found: RegExpExecArray) => Omit<Finding, 'file' | 'line'> | null,
  limit = 40,
) {
  pattern.lastIndex = 0;
  let found: RegExpExecArray | null;
  while (findings.length < limit && (found = pattern.exec(source))) {
    const line = lineAt(source, found.index);
    const finding = create(line, found);
    if (finding) findings.push({ file: repoPath(cwd, path), line, ...finding });
    if (!found[0].length) pattern.lastIndex += 1;
  }
}

function step(cwd: string, label: string, command: string, timeout = 900_000): Step {
  const started = Date.now();
  const result = spawnSync(command, { cwd, shell: true, encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return {
    label,
    command,
    ok: result.status === 0,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    output: output.length > 2200 ? `…\n${output.slice(-2200)}` : output,
  };
}

function status(findings: Finding[]): 'PASS' | 'FAIL' | 'PARTIAL' {
  if (findings.some((f) => f.severity === 'P0' || f.severity === 'P1')) return 'FAIL';
  return findings.length ? 'PARTIAL' : 'PASS';
}

function report(title: string, findings: Finding[], steps: Step[] = [], notes: string[] = []): string {
  const counts = (['P0', 'P1', 'P2', 'P3'] as Severity[])
    .map((s) => `${s}=${findings.filter((f) => f.severity === s).length}`)
    .join(' ');
  const out = [`${status(findings)} — ${title} — ${counts}`];
  for (const f of findings.slice(0, 80)) {
    const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : 'project';
    out.push(`[${f.severity}] ${where} — ${f.message}${f.fix ? ` Fix: ${f.fix}` : ''}`);
  }
  if (findings.length > 80) out.push(`… ещё ${findings.length - 80} findings скрыты`);
  for (const s of steps) {
    out.push(`\n[${s.ok ? 'OK' : 'FAIL'}] ${s.label} — ${s.command} (${s.seconds}s)`);
    if (s.output) out.push(s.output);
  }
  for (const note of notes) out.push(`\nNOTE: ${note}`);
  return out.join('\n');
}

function changed(cwd: string): string[] {
  const result = spawnSync('git status --porcelain --untracked-files=all', { cwd, shell: true, encoding: 'utf8' });
  if (result.status !== 0) return [];
  return `${result.stdout ?? ''}`
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 3)
    .map((line) => (line.slice(3).trim().replace(/^"|"$/g, '').split(' -> ').pop() ?? '').replaceAll('\\', '/'))
    .filter(Boolean);
}

function domainGuards(cwd: string, requested?: string[]): string {
  const findings: Finding[] = [];
  const paths = resolve(cwd, requested, [
    'src/engines/bb',
    'src/engines/strength-sport',
    'src/engines/arm',
    'src/core/pharma-db',
    'src/core',
    'src/data',
  ]);
  for (const path of paths) {
    const source = text(path);
    if (source === null) continue;
    const file = repoPath(cwd, path);
    if (/src\/engines\/(bb|strength-sport|arm|pro)\//.test(file)) {
      match(
        findings,
        cwd,
        path,
        source,
        /(?:Math\.random\s*\(|Date\.now\s*\(|new Date\(\s*['"]\d{4}-\d{2}-\d{2})/g,
        () => ({
          severity: 'P1',
          message: 'Недетерминированное значение в тренировочном build path.',
          fix: 'передать date/seed явно или использовать проектный ISO helper',
        }),
      );
    }
    if (/pharma|dosage|pharmac|pct|female-aas/i.test(file)) {
      match(
        findings,
        cwd,
        path,
        source,
        /(?:dose|dosage|tHalf|halfLife|мг|мкг|мл|МЕ|mg|mcg|ml|IU)\s*[:=]\s*\d+/gi,
        (_line, found) => {
          const context = source.slice(Math.max(0, found.index - 700), found.index + 700);
          return {
            severity: /references?|source|doi|pmid|evidence/i.test(context) ? 'P3' : 'P1',
            message: 'Медицинское числовое поле требует проверяемого source/references рядом.',
            fix: 'добавить provenance или оставить значение неизвестным',
          };
        },
      );
    }
    if (/nutrition-database|exercise-catalog/.test(file)) {
      match(
        findings,
        cwd,
        path,
        source,
        /\{\s*id\s*:/g,
        (_line, found) => {
          const record = source.slice(
            found.index,
            source.indexOf('\n', found.index) > 0 ? source.indexOf('\n', found.index) : found.index + 1000,
          );
          const missingExercise = /exercise-catalog/.test(file) && !/targetMuscle\s*:/.test(record);
          const missingFood = /nutrition-database/.test(file) && !/foodState\s*:/.test(record);
          return {
            severity: missingExercise || missingFood ? 'P2' : 'P3',
            message: missingExercise
              ? 'Упражнение без targetMuscle.'
              : missingFood
                ? 'FOOD_DB запись без явного foodState.'
                : 'Каталожная запись просмотрена.',
            fix: missingExercise || missingFood ? 'добавить поле или покрыть исключение тестом' : undefined,
          };
        },
        30,
      );
    }
  }
  return report('domain guards', findings, [], ['Статический audit не заменяет целевые Vitest и review источников.']);
}

function medicalSafety(cwd: string, requested?: string[]): string {
  const findings: Finding[] = [];
  const paths = resolve(cwd, requested, ['src/core/pharma-db', 'src/core', 'src/engines', 'src/ui', 'docs']);
  const number =
    /(?:\b\d+(?:[.,]\d+)?\s*(?:мг|мкг|мл|МЕ|mg|mcg|ml|IU)\b|\b(?:dose|dosage|доза|дозиров|курс|инъекц|приним))/i;
  const safety =
    /не является медицин|обратитесь к врачу|консультац.*врач|medical advice|off-label|harm.?reduction|красн.*флаг/i;
  const source = /references?|source|doi|pmid|pubmed|evidence|источник/i;
  const direct = /(?:вводить|колоть|инъекц\w*\s+(?:сам|самостоятельно)|принимай|начни курс)\W{0,100}\d+/i;
  for (const path of paths) {
    const sourceText = text(path);
    if (sourceText === null) continue;
    const file = repoPath(cwd, path);
    match(
      findings,
      cwd,
      path,
      sourceText,
      new RegExp(direct.source, 'gi'),
      () => ({
        severity: 'P0',
        message: 'Похоже на прямую инструкцию по самолечению/инъекции с числовой схемой.',
        fix: 'удалить инструкцию, оставить harm-reduction и referral к врачу',
      }),
      20,
    );
    if (number.test(sourceText) && /src\/ui|pharma|dosage|support/i.test(file) && !safety.test(sourceText))
      findings.push({
        severity: 'P1',
        file,
        message: 'Медицинские числа без видимого disclaimer/red-flag текста.',
        fix: 'добавить безопасную оговорку и escalation flow',
      });
    if (
      number.test(sourceText) &&
      /pharma|dosage|lab-norm|support-dos|female-aas/i.test(file) &&
      !source.test(sourceText)
    )
      findings.push({
        severity: 'P1',
        file,
        message: 'Медицинские числовые утверждения без видимого references/source/PMID/DOI.',
        fix: 'добавить provenance или не добавлять число',
      });
  }
  return report(
    'medical safety',
    findings,
    [],
    ['Это safety scan, а не клиническое заключение. Эффективность и дозы проверяются evidence-инструментами.'],
  );
}

function ocrBenchmark(cwd: string, domain: string, runTests: boolean): string {
  const findings: Finding[] = [];
  const steps: Step[] = [];
  const d = domain.toLowerCase();
  const nutrition = d === 'nutrition' || d === 'food' || d === 'all';
  const labs = d === 'labs' || d === 'lab' || d === 'all';
  if (!nutrition && !labs)
    findings.push({ severity: 'P1', message: `Unknown OCR domain: ${domain}. Use nutrition, labs or all.` });
  if (runTests && nutrition)
    steps.push(
      step(
        cwd,
        'nutrition OCR fixtures',
        'npx vitest run src/engines/__tests__/nutrition-ocr-parser.test.ts src/engines/__tests__/nutrition-label-parser.test.ts src/engines/__tests__/nutrition-ocr-apk-fatsecret.test.ts src/core/__tests__/offline-plate-ocr.test.ts',
      ),
    );
  if (runTests && labs)
    steps.push(
      step(
        cwd,
        'lab OCR fixtures',
        'npx vitest run src/core/__tests__/ocr-full-cycle.test.ts src/core/__tests__/lab-provider-e2e.test.ts src/core/__tests__/lab-unit-normalization.test.ts src/core/__tests__/lab-apk-offline.test.ts',
      ),
    );
  if (steps.some((s) => !s.ok))
    findings.push({
      severity: 'P1',
      message: 'OCR benchmark suite failed.',
      fix: 'разобрать первую ошибку и проверить web/API + offline pipeline',
    });
  const fixtureCount = files(cwd, ['src/core/__tests__', 'src/engines/__tests__'], new Set(['.ts', '.tsx'])).filter(
    (f) => /ocr|lab-provider|nutrition/i.test(f),
  ).length;
  return report(`OCR benchmark (${domain})`, findings, steps, [
    `Связанных fixture/test files: ${fixtureCount}`,
    'Recall/precision реальных фото нельзя честно посчитать без размеченного набора изображений.',
  ]);
}

function securityPrivacy(cwd: string, requested?: string[]): string {
  const findings: Finding[] = [];
  // Prose may document a public CORS contract; only executable/configuration
  // files can leak secrets or configure an endpoint.
  for (const path of resolve(cwd, requested, ['src', 'api', 'server', 'supabase/functions', 'scripts']).filter((file) =>
    CODE_EXT.has(extension(file)),
  )) {
    const source = text(path);
    if (source === null) continue;
    const file = repoPath(cwd, path);
    match(
      findings,
      cwd,
      path,
      source,
      /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|ghp|github_pat|xox[baprs])-[-_A-Za-z0-9]{16,}|\bservice_role\s*[:=]\s*['"][^'"]+)/g,
      () => ({
        severity: 'P0',
        message: 'Похоже на hardcoded secret/private key/service-role token.',
        fix: 'удалить, ротировать и использовать env/secret manager',
      }),
      20,
    );
    match(
      findings,
      cwd,
      path,
      source,
      /console\.(?:log|info|debug)\s*\([^\n]*(?:token|password|secret|medical|lab|telegram|userData)/gi,
      () => ({
        severity: 'P1',
        message: 'Лог может раскрывать secret или medical/PII данные.',
        fix: 'удалить лог или санитизировать поля',
      }),
      30,
    );
    if (/api\/|supabase\/functions/.test(file) && /Access-Control-Allow-Origin['"\s:]+\*/i.test(source))
      findings.push({
        severity: 'P1',
        file,
        message: 'Endpoint разрешает wildcard CORS.',
        fix: 'ограничить origin или явно подтвердить public/no-user-data контракт',
      });
    if (/VITE_(?:SUPABASE_SERVICE|PRIVATE|SECRET|BOT_TOKEN)/i.test(source))
      findings.push({
        severity: 'P0',
        file,
        message: 'Potential secret in VITE_* enters client bundle.',
        fix: 'перенести секрет в server/edge runtime',
      });
  }
  for (const file of changed(cwd))
    if (/^\.env(?:\.|$)/i.test(file) && !/\.env\.example$/i.test(file))
      findings.push({ severity: 'P0', file, message: 'Секретный env-файл изменён или попал в diff.' });
  return report('security and privacy', findings, [], ['Не заменяет dependency scan, secret rotation и threat model.']);
}

function releaseGate(cwd: string, target: string, full: boolean): string {
  const findings: Finding[] = [];
  const steps: Step[] = [
    step(cwd, 'git diff check', 'git diff --check', 120_000),
    step(cwd, 'type-check', 'npm run type-check'),
  ];
  const t = target.toLowerCase();
  if (full && (t === 'web' || t === 'all')) steps.push(step(cwd, 'production build', 'npm run build'));
  if (t === 'apk' || t === 'all') {
    steps.push(step(cwd, 'APK markers', 'npm run verify:apk-design'));
    steps.push(step(cwd, 'APK CI guard', 'npm run verify:apk-ci'));
  }
  if (steps.some((s) => !s.ok))
    findings.push({ severity: 'P1', message: 'Release gate failed; release is not ready.' });
  const packageText = text(join(cwd, 'package.json'));
  const gradle = text(join(cwd, 'android/app/build.gradle')) ?? '';
  try {
    const version = packageText ? JSON.parse(packageText).version : undefined;
    const nativeVersion = /versionName\s+["']([^"']+)["']/.exec(gradle)?.[1];
    if (version && nativeVersion && version !== nativeVersion)
      findings.push({
        severity: 'P1',
        file: 'android/app/build.gradle',
        message: `versionName ${nativeVersion} не совпадает с package.json ${version}.`,
        fix: 'синхронизировать версии',
      });
  } catch {
    findings.push({ severity: 'P1', file: 'package.json', message: 'Не удалось прочитать package.json version.' });
  }
  return report(`release gate (${target})`, findings, steps, [
    'APK buildability определяется отдельным project.apk_preflight; локальный Gradle не предполагается.',
  ]);
}

function diffScope(cwd: string, expected: string[]): string {
  const findings: Finding[] = [];
  const paths = expected.map((p) => p.replaceAll('\\', '/').replace(/^\.\//, ''));
  for (const file of changed(cwd)) {
    if (!paths.some((p) => file === p || file.startsWith(`${p}/`)))
      findings.push({
        severity: 'P1',
        file,
        message: 'Файл изменён вне заявленного workstream scope.',
        fix: `разрешённые пути: ${paths.join(', ')}`,
      });
    if (/^\.env(?:\.|$)/i.test(file) && !/\.env\.example$/i.test(file))
      findings.push({ severity: 'P0', file, message: 'Secret env file в diff.' });
    if (/^(?:dist|android\/.*\/build)\//.test(file))
      findings.push({ severity: 'P1', file, message: 'Generated/build output в diff.' });
  }
  return report(
    'diff scope',
    findings,
    [],
    [`Changed files: ${changed(cwd).length}`, `Expected scope: ${paths.join(', ')}`],
  );
}

function trainingQuality(cwd: string, runTests: boolean): string {
  const findings: Finding[] = [];
  const steps: Step[] = [];
  for (const path of files(
    cwd,
    [
      'src/engines/bb',
      'src/engines/strength-sport',
      'src/engines/arm',
      'src/engines/pro',
      'src/ui/screens/strength-sport',
    ],
    new Set(['.ts', '.tsx']),
  )) {
    const source = text(path);
    if (source === null) continue;
    match(
      findings,
      cwd,
      path,
      source,
      /(?:Math\.random\s*\(|Date\.now\s*\(|new Date\(\s*['"]\d{4}-\d{2}-\d{2})/g,
      () => ({
        severity: 'P1',
        message: 'Nondeterminism or implicit UTC date parsing in training area.',
        fix: 'explicit date/seed and local ISO helper',
      }),
      30,
    );
    match(
      findings,
      cwd,
      path,
      source,
      /(?:RIR|rir|RPE|rpe)\s*[:=]\s*(?:10|0)\b/g,
      () => ({
        severity: 'P3',
        message: 'Граничное RIR/RPE: проверьте missing versus explicit value.',
        fix: 'тест на явный ноль и отсутствие поля',
      }),
      30,
    );
  }
  if (runTests)
    steps.push(
      step(
        cwd,
        'strength-sport tests',
        'npx vitest run src/engines/strength-sport src/engines/arm src/engines/pro/__tests__ src/ui/screens/strength-sport/__tests__ --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1',
      ),
    );
  if (steps.some((s) => !s.ok)) findings.push({ severity: 'P1', message: 'Strength-sport test gate failed.' });
  return report('training quality', findings, steps, [
    'Статический audit не доказывает спортивную эффективность программы без валидированных данных и методического источника.',
  ]);
}

function performance(cwd: string, runBuild: boolean): string {
  const findings: Finding[] = [];
  const steps = [step(cwd, 'type-check timing', 'npm run type-check')];
  if (runBuild) steps.push(step(cwd, 'build timing', 'npm run build'));
  if (steps[0].seconds > 120)
    findings.push({
      severity: 'P2',
      message: `type-check занимает ${steps[0].seconds}s.`,
      fix: 'проверить tsconfig include, project references, barrel imports и generated JSON; не ослаблять strict вслепую',
    });
  let bytes = 0;
  for (const file of files(cwd, ['dist'], new Set(['.js', '.css', '.html', '.map', '.webp']))) {
    try {
      bytes += statSync(file).size;
    } catch {
      /* build race */
    }
  }
  return report('performance profiler', findings, steps, [
    `dist size: ${Math.round(bytes / 1024)} KiB`,
    'React render/OCR heap требуют browser/DevTools trace; этот gate только сигнализирует.',
  ]);
}

function dataImport(cwd: string, domain: string, runTests: boolean): string {
  const findings: Finding[] = [];
  const steps: Step[] = [];
  const roots =
    domain === 'labs'
      ? ['src/core', 'src/engines']
      : domain === 'nutrition'
        ? ['src/core', 'src/data', 'src/engines']
        : ['src/core', 'src/data', 'src/engines', 'scripts'];
  for (const path of files(cwd, roots)) {
    const source = text(path);
    if (source === null) continue;
    match(
      findings,
      cwd,
      path,
      source,
      /\uFFFD/g,
      (line) => {
        const lineText = source.split(/\r?\n/)[line - 1] ?? '';
        // A parser may intentionally test for the replacement marker (for
        // example, PDF/OCR retry logic). Report literal mojibake in fixtures,
        // comments and imported data, but not an explicit sentinel check.
        return /\\uFFFD/.test(lineText)
          ? null
          : {
              severity: 'P1',
              message: 'U+FFFD: possible mojibake/corrupt import.',
              fix: 'штатный encoding script + fixture',
            };
      },
      20,
    );
    if (
      /nutrition|food|lab|biomarker|parser/i.test(repoPath(cwd, path)) &&
      /parse|import|extract/i.test(repoPath(cwd, path)) &&
      /catch\s*\{\s*\}/.test(source)
    )
      findings.push({
        severity: 'P2',
        file: repoPath(cwd, path),
        message: 'Empty catch may hide partial import.',
        fix: 'вернуть warning/provenance или санитизированную диагностику',
      });
  }
  if (runTests && (domain === 'nutrition' || domain === 'all'))
    steps.push(
      step(
        cwd,
        'nutrition import tests',
        'npx vitest run src/engines/__tests__/nutrition-ocr-parser.test.ts src/engines/__tests__/nutrition-label-parser.test.ts src/core/__tests__/ocr-full-cycle.test.ts',
      ),
    );
  if (runTests && (domain === 'labs' || domain === 'all'))
    steps.push(
      step(
        cwd,
        'lab import tests',
        'npx vitest run src/core/__tests__/lab-provider-e2e.test.ts src/core/__tests__/lab-unit-normalization.test.ts src/core/__tests__/ocr-full-cycle.test.ts',
      ),
    );
  if (steps.some((s) => !s.ok)) findings.push({ severity: 'P1', message: 'Data-import test gate failed.' });
  return report(`data import audit (${domain})`, findings, steps, [
    'Полнота OCR требует размеченного набора реальных изображений.',
  ]);
}

function visual(cwd: string, runMarkers: boolean): string {
  const findings: Finding[] = [];
  const steps: Step[] = [];
  for (const path of files(cwd, ['src'], new Set(['.css']))) {
    const source = text(path);
    if (source === null || !/styles-native/.test(repoPath(cwd, path))) continue;
    const cssForScan = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, ' '));
    match(
      findings,
      cwd,
      path,
      cssForScan,
      /(?:^|\n)\s*([^{}\n]+)\{/g,
      (_line, found) => {
        const selector = found[1]?.trim() ?? '';
        if (!selector || /^(?:html\.app-native|@|from\b|to\b|\d+%\b)/.test(selector)) return null;
        return {
          severity: 'P1',
          message: 'Native CSS selector may be unscoped.',
          fix: 'добавить html.app-native scope и проверить markers',
        };
      },
      40,
    );
    match(
      findings,
      cwd,
      path,
      source,
      /#(?:c9f73a|00e68a)\b/gi,
      (line) => {
        const lineText = source.split(/\r?\n/)[line - 1] ?? '';
        return /var\(--accent[^)]*,\s*#(?:c9f73a|00e68a)\b/i.test(lineText) ||
          /--accent[^:]*:\s*#(?:c9f73a|00e68a)\b/i.test(lineText)
          ? null
          : {
              severity: 'P1',
              message: 'Raw accent hex outside token declaration.',
              fix: 'использовать var(--accent...)',
            };
      },
      20,
    );
  }
  for (const path of files(cwd, ['src/ui'], new Set(['.ts', '.tsx']))) {
    const source = text(path);
    if (source === null) continue;
    if (/\/__tests__\//.test(repoPath(cwd, path))) continue;
    match(
      findings,
      cwd,
      path,
      source,
      /(?:window\.confirm|window\.open|a\.download|navigator\.clipboard\.writeText)/g,
      () => ({
        severity: 'P2',
        message: 'Web/platform-specific UI API требует APK fallback или explicit web-only gate.',
        fix: 'проверить isNative fallback; для web-only export оставить явную ветку',
      }),
      50,
    );
  }
  if (runMarkers) steps.push(step(cwd, 'APK design markers', 'npm run verify:apk-design'));
  if (steps.some((s) => !s.ok)) findings.push({ severity: 'P1', message: 'APK design marker gate failed.' });
  return report('visual regression and APK design', findings, steps, [
    'Pixel-level screenshot regression требует browser/DevTools; этот gate проверяет tokens, hostile APIs и markers.',
  ]);
}

export default Plugin.define({
  id: 'quality-gates',
  setup(ctx) {
    return ctx.tool.transform((editor) => {
      editor.namespace({ name: 'quality', description: 'BodyBuildHealth production quality gates and domain audits' });
      editor.add({
        name: 'domain_guards',
        description: 'Аудит pharma/lab/FOOD_DB/exercise/training invariants.',
        options: { namespace: 'quality', codemode: true },
        input: {
          type: 'object',
          properties: { paths: { type: 'array', items: { type: 'string' } } },
          additionalProperties: false,
        },
        execute: async (input) => ({
          content: domainGuards(ctx.location.directory, (input as { paths?: string[] } | undefined)?.paths),
        }),
      });
      editor.add({
        name: 'medical_safety',
        description: 'Аудит источников, disclaimer, red flags и опасных medical/AAS инструкций.',
        options: { namespace: 'quality', codemode: true },
        input: {
          type: 'object',
          properties: { paths: { type: 'array', items: { type: 'string' } } },
          additionalProperties: false,
        },
        execute: async (input) => ({
          content: medicalSafety(ctx.location.directory, (input as { paths?: string[] } | undefined)?.paths),
        }),
      });
      editor.add({
        name: 'ocr_benchmark',
        description: 'Запускает nutrition/lab OCR fixture suites.',
        options: { namespace: 'quality', codemode: true },
        input: {
          type: 'object',
          properties: { domain: { type: 'string' }, runTests: { type: 'boolean' } },
          additionalProperties: false,
        },
        execute: async (input) => {
          const a = (input ?? {}) as { domain?: string; runTests?: boolean };
          return { content: ocrBenchmark(ctx.location.directory, a.domain ?? 'all', a.runTests !== false) };
        },
      });
      editor.add({
        name: 'security_privacy',
        description: 'Сканирует secrets, PII/medical logs, CORS и client credentials.',
        options: { namespace: 'quality', codemode: true },
        input: {
          type: 'object',
          properties: { paths: { type: 'array', items: { type: 'string' } } },
          additionalProperties: false,
        },
        execute: async (input) => ({
          content: securityPrivacy(ctx.location.directory, (input as { paths?: string[] } | undefined)?.paths),
        }),
      });
      editor.add({
        name: 'release_gate',
        description: 'Web/APK release checks, versions и diff check.',
        options: { namespace: 'quality', codemode: true },
        input: {
          type: 'object',
          properties: { target: { type: 'string' }, full: { type: 'boolean' } },
          additionalProperties: false,
        },
        execute: async (input) => {
          const a = (input ?? {}) as { target?: string; full?: boolean };
          return { content: releaseGate(ctx.location.directory, a.target ?? 'web', a.full === true) };
        },
      });
      editor.add({
        name: 'diff_scope',
        description: 'Проверяет git diff против заявленного workstream scope.',
        options: { namespace: 'quality', codemode: true },
        input: {
          type: 'object',
          properties: { paths: { type: 'array', items: { type: 'string' } } },
          required: ['paths'],
          additionalProperties: false,
        },
        execute: async (input) => ({
          content: diffScope(ctx.location.directory, (input as { paths: string[] }).paths),
        }),
      });
      editor.add({
        name: 'training_quality',
        description: 'Аудит детерминизма, дат, RIR/RPE и запуск strength tests.',
        options: { namespace: 'quality', codemode: true },
        input: { type: 'object', properties: { runTests: { type: 'boolean' } }, additionalProperties: false },
        execute: async (input) => ({
          content: trainingQuality(
            ctx.location.directory,
            (input as { runTests?: boolean } | undefined)?.runTests !== false,
          ),
        }),
      });
      editor.add({
        name: 'performance_profiler',
        description: 'Измеряет type-check/build и performance signals.',
        options: { namespace: 'quality', codemode: true },
        input: { type: 'object', properties: { runBuild: { type: 'boolean' } }, additionalProperties: false },
        execute: async (input) => ({
          content: performance(
            ctx.location.directory,
            (input as { runBuild?: boolean } | undefined)?.runBuild === true,
          ),
        }),
      });
      editor.add({
        name: 'data_import_audit',
        description: 'Проверяет encoding, silent catches и import fixtures.',
        options: { namespace: 'quality', codemode: true },
        input: {
          type: 'object',
          properties: { domain: { type: 'string' }, runTests: { type: 'boolean' } },
          additionalProperties: false,
        },
        execute: async (input) => {
          const a = (input ?? {}) as { domain?: string; runTests?: boolean };
          return { content: dataImport(ctx.location.directory, a.domain ?? 'all', a.runTests !== false) };
        },
      });
      editor.add({
        name: 'visual_regression',
        description: 'Проверяет APK markers, CSS scope/tokens и native-hostile APIs.',
        options: { namespace: 'quality', codemode: true },
        input: { type: 'object', properties: { runMarkers: { type: 'boolean' } }, additionalProperties: false },
        execute: async (input) => ({
          content: visual(
            ctx.location.directory,
            (input as { runMarkers?: boolean } | undefined)?.runMarkers !== false,
          ),
        }),
      });
    });
  },
});
