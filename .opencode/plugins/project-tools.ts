/**
 * Project tools for BodyBuildHealth (OpenCode V2 plugin).
 *
 * Tools:
 *   project_verify        — runs the checks this repo requires for the files that changed
 *                           (type-check / targeted vitest suites / APK design markers).
 *   project_apk_preflight — APK release preflight: versions, APK markers, CI workflow guard,
 *                           and whether a local build is even possible.
 *
 * Loaded automatically from `.opencode/plugins/`.
 */
import { Plugin } from '@opencode/plugin';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT_TAIL = 3500;
const SUCCESS_TAIL = 700;

interface StepResult {
  label: string;
  command: string;
  ok: boolean;
  code: number | null;
  seconds: number;
  output: string;
}

function tail(text: string, limit: number): string {
  if (!text) return '';
  return text.length > limit ? `…\n${text.slice(-limit)}` : text;
}

function run(command: string, cwd: string, timeout = 900_000): StepResult {
  const started = Date.now();
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return {
    label: '',
    command,
    ok: result.status === 0,
    code: result.status,
    seconds: Math.round((Date.now() - started) / 1000),
    output,
  };
}

function changedFiles(cwd: string): string[] {
  const result = spawnSync('git status --porcelain --untracked-files=all', {
    cwd,
    shell: true,
    encoding: 'utf8',
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 3)
    .map((line) => {
      const raw = line.slice(3).trim().replace(/^"|"$/g, '');
      const renamed = raw.split(' -> ');
      return (renamed[renamed.length - 1] ?? raw).replace(/\\/g, '/');
    })
    .filter((path) => path && !path.endsWith('/'));
}

function isHarnessChange(file: string): boolean {
  return file.startsWith('.opencode/') || file === 'AGENTS.md' || file === 'opencode.json';
}

function format(results: StepResult[]): string {
  const failed = results.filter((r) => !r.ok);
  const head = `verify: ${results.length - failed.length}/${results.length} OK`;
  const lines = results.map((r) => {
    const mark = r.ok ? 'OK  ' : 'FAIL';
    const body = r.ok ? tail(r.output, SUCCESS_TAIL) : tail(r.output, OUTPUT_TAIL);
    return [`[${mark}] ${r.label} — ${r.command} (${r.seconds}s)`, body].filter(Boolean).join('\n');
  });
  return [head, ...lines].join('\n\n');
}

export default Plugin.define({
  id: 'project-tools',
  setup(ctx) {
    const cwd = ctx.location.directory;

    return ctx.tool.transform((editor) => {
      editor.namespace({
        name: 'project',
        description: 'BodyBuildHealth project checks (type-check, targeted vitest, APK markers)',
      });

      editor.add({
        name: 'verify',
        description:
          "Run the repository's required checks for the files that changed: `npm run type-check` (TypeScript changes), " +
          'the matching vitest suite (src/engines/bb → test:bb, src/ui → test:ui, src/core → test:core) and ' +
          '`npm run verify:apk-design` (APK-facing UI/markup changes). Returns a per-step pass/fail report with output tails.',
        options: { namespace: 'project', codemode: true },
        input: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Repository-relative paths to check. Defaults to the current git working-tree changes.',
            },
            full: {
              type: 'boolean',
              description: 'Run the full type-check (default true). Set false for a fast Markdown/CSS-only pass.',
            },
          },
          additionalProperties: false,
        },
        execute: async (input) => {
          const args = (input ?? {}) as { paths?: string[]; full?: boolean };
          const files =
            Array.isArray(args.paths) && args.paths.length > 0
              ? args.paths.map((p) => p.replace(/\\/g, '/'))
              : changedFiles(cwd);

          if (files.length === 0) {
            return { content: 'verify: изменений не найдено (git status пуст). Передай paths явно, если нужно.' };
          }

          const steps: string[] = [];
          const hasTs = files.some((f) => /\.(ts|tsx|mts|cts)$/.test(f));
          const hasTests = files.some((f) => /\.(test|spec)\.(ts|tsx)$/.test(f));

          if (args.full !== false && (hasTs || hasTests)) steps.push('npm run type-check');
          if (files.some((f) => f.startsWith('src/engines/bb/'))) steps.push('npm run test:bb');
          if (files.some((f) => f.startsWith('src/ui/'))) steps.push('npm run test:ui');
          if (files.some((f) => f.startsWith('src/core/'))) steps.push('npm run test:core');
          if (
            files.some(
              (f) =>
                f.startsWith('src/') ||
                f.startsWith('android/') ||
                f === 'index.html' ||
                f === 'capacitor.config.ts' ||
                f.startsWith('public/'),
            )
          ) {
            steps.push('npm run verify:apk-design');
          }

          if (files.some(isHarnessChange)) {
            steps.push('node .opencode/plugin-syntax-check.cjs .opencode/plugins/*.ts');
            steps.push('npx prettier --check ".opencode/**" AGENTS.md opencode.json');
          }

          if (steps.length === 0) {
            const preview = files.slice(0, 20).join('\n');
            return {
              content: `verify: для изменённых файлов проверок не требуется.\n\n${preview}`,
            };
          }

          const labels: Record<string, string> = {
            'npm run type-check': 'type-check',
            'npm run test:bb': 'vitest (bb)',
            'npm run test:ui': 'vitest (ui)',
            'npm run test:core': 'vitest (core)',
            'npm run verify:apk-design': 'apk-design markers',
            'node .opencode/plugin-syntax-check.cjs .opencode/plugins/*.ts': 'plugin syntax',
            'npx prettier --check ".opencode/**" AGENTS.md opencode.json': 'harness formatting',
          };

          const results: StepResult[] = [];
          for (const command of steps) {
            const result = run(command, cwd);
            result.label = labels[command] ?? command;
            results.push(result);
            if (!result.ok) break; // stop the chain on the first failure
          }

          const skipped = steps.slice(results.length);
          const suffix = skipped.length
            ? `\n\nПропущено после падения: ${skipped.map((c) => labels[c] ?? c).join(', ')}`
            : '';

          return { content: `${format(results)}${suffix}` };
        },
      });

      editor.add({
        name: 'apk_preflight',
        description:
          'APK release preflight: reads app version from package.json and android/app/build.gradle, runs ' +
          '`verify:apk-design` and `verify:apk-ci`, and reports whether a local Android build is possible ' +
          '(java/gradle/ANDROID_HOME) or the release must go through the android-apk GitHub workflow.',
        options: { namespace: 'project', codemode: true },
        input: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const lines: string[] = [];

          let pkgVersion = 'unknown';
          try {
            pkgVersion = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version ?? 'unknown';
          } catch {
            lines.push('! не удалось прочитать package.json');
          }

          let gradleName = 'unknown';
          let gradleCode = 'unknown';
          try {
            const gradle = readFileSync(join(cwd, 'android', 'app', 'build.gradle'), 'utf8');
            gradleName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? 'unknown';
            gradleCode = /versionCode\s+(\d+)/.exec(gradle)?.[1] ?? 'unknown';
          } catch {
            lines.push('! не удалось прочитать android/app/build.gradle');
          }

          lines.push(`package.json version: ${pkgVersion}`);
          lines.push(`android versionName: ${gradleName} (versionCode ${gradleCode})`);
          if (pkgVersion !== gradleName) {
            lines.push('! versionName в build.gradle не совпадает с package.json — выровняй перед релизом');
          }

          const results = [run('npm run verify:apk-design', cwd), run('npm run verify:apk-ci', cwd)];
          results[0].label = 'apk-design markers';
          results[1].label = 'apk workflow guard';
          lines.push('', format(results));

          const java = spawnSync('java -version', { shell: true, encoding: 'utf8' });
          const gradle = spawnSync('gradle -v', { shell: true, encoding: 'utf8' });
          const androidHome = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
          const localBuild = java.status === 0 && gradle.status === 0 && Boolean(androidHome);

          lines.push(
            '',
            `локальный Android toolchain: java=${java.status === 0 ? 'ok' : 'нет'}, ` +
              `gradle=${gradle.status === 0 ? 'ok' : 'нет'}, ANDROID_HOME=${androidHome ? 'ok' : 'нет'}`,
          );
          lines.push(
            localBuild
              ? 'Локальная сборка возможна: `npm run build:native`.'
              : 'Локально APK не собрать. Релиз только через CI:\n' +
                  '`gh workflow run android-apk.yml --ref main -f version=<x.y.z> -f publish=true`\n' +
                  'или пушем тега `v<x.y.z>`.',
          );

          return { content: lines.join('\n') };
        },
      });
    });
  },
});
