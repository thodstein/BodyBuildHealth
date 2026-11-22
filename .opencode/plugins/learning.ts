/**
 * Self-learning for BodyBuildHealth (OpenCode V2 plugin).
 *
 * Tools (namespace `project`):
 *   learn        — append a durable, de-duplicated lesson to `docs/AGENTS-MEMORY.md`
 *   learn_skill  — create or update `.opencode/skills/<id>/SKILL.md` (a skill the agent writes for itself)
 *   learn_config — turn automatic post-task distillation on or off
 *
 * Runtime:
 *   • `context` hook injects the newest memory entries into every request, so a lesson is applied on the next
 *     turn without the agent having to remember to re-read the file.
 *   • With auto mode on, a top-level session that finished successfully gets one short distillation turn
 *     (guards: one per session, never for subagent sessions).
 *
 * Loaded automatically from `.opencode/plugins/`.
 */
import { Plugin } from '@opencode/plugin';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MEMORY_FILE = join('docs', 'AGENTS-MEMORY.md');
const AUTO_KEY = 'autoLearn';
const INJECT_LIMIT = 2600;
const MAX_ENTRIES_INJECTED = 40;

const DISTILL_PROMPT = [
  'Автообучение: разбери только что завершённую работу и сохрани выученное.',
  '',
  '1. Найди 0–3 факта, которые пригодятся в следующий раз: неочевидное поведение кода, ловушка сборки/тестов,',
  '   ограничение платформы, договорённость проекта, ссылка на правильный источник.',
  '2. Каждый факт запиши инструментом `project_learn` (area — раздел репозитория: bb-engine, ui, data-import,',
  '   backend, apk, research, tests, process; source — `path:line` или URL доказательства).',
  '3. Если выученное — процедура, а не факт, обнови или создай навык через `project_learn_skill`.',
  '4. Если сохранять нечего — ответь одной строкой «учиться нечему» и ничего не записывай.',
  '',
  'Не дублируй то, что уже есть в памяти, в AGENTS.md или в навыках. Не коммить.',
].join('\n');

interface LearnInput {
  area?: string;
  text?: string;
  source?: string;
}

interface SkillInput {
  id?: string;
  name?: string;
  description?: string;
  body?: string;
  overwrite?: boolean;
}

function memoryPath(cwd: string): string {
  return join(cwd, MEMORY_FILE);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function oneLine(text: string): string {
  return normalize(text);
}

/** Local calendar date — a UTC date is a day behind for most of the Moscow working day. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function readMemory(cwd: string): string {
  const path = memoryPath(cwd);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** Newest entries first, capped so the injected block stays cheap. */
function injectionBlock(cwd: string): string {
  const raw = readMemory(cwd);
  if (!raw) return '';

  const entries = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '))
    .slice(-MAX_ENTRIES_INJECTED)
    .reverse();

  if (entries.length === 0) return '';

  const body: string[] = [];
  let size = 0;
  for (const entry of entries) {
    if (size + entry.length > INJECT_LIMIT) break;
    body.push(entry);
    size += entry.length + 1;
  }

  return [
    '<context key="agents-memory">',
    `Выученное ранее в этом репозитории (полный файл: ${MEMORY_FILE.replace(/\\/g, '/')}). Соблюдай это, не переоткрывай заново:`,
    ...body,
    '</context>',
  ].join('\n');
}

function appendEntry(cwd: string, entry: LearnInput): { ok: boolean; message: string } {
  const text = oneLine(entry.text ?? '');
  if (text.length < 8) return { ok: false, message: 'learn: слишком короткий факт — нужно хотя бы одно предложение.' };

  const area = oneLine(entry.area ?? 'process') || 'process';
  const source = entry.source ? oneLine(entry.source) : '';
  const line = `- ${today()} · **${area}** — ${text}${source ? ` (${source})` : ''}`;

  const path = memoryPath(cwd);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const already = normalize(current).toLowerCase().includes(normalize(text).toLowerCase());
  if (already) {
    return { ok: true, message: `learn: этот факт уже записан — пропущено.\n${line}` };
  }

  const heading = `## ${area}`;
  if (!current) {
    writeFileSync(path, `# AGENTS memory\n\n${heading}\n\n${line}\n`, 'utf8');
    return { ok: true, message: `learn: создан ${MEMORY_FILE} и записан факт.\n${line}` };
  }

  if (current.includes(`${heading}\n`)) {
    // Insert at the end of that area's own block.
    const start = current.indexOf(`${heading}\n`);
    const rest = current.slice(start + heading.length + 1);
    const nextHeadingIndex = rest.search(/\n## /);
    const insertAt = nextHeadingIndex === -1 ? current.length : start + heading.length + 1 + nextHeadingIndex;
    const before = current.slice(0, insertAt).replace(/\s+$/, '');
    const after = current.slice(insertAt);
    writeFileSync(path, `${before}\n${line}\n${after}`, 'utf8');
  } else {
    appendFileSync(path, `\n${heading}\n\n${line}\n`, 'utf8');
  }

  return { ok: true, message: `learn: записано в ${MEMORY_FILE} → ${area}.\n${line}` };
}

function writeSkill(cwd: string, input: SkillInput): { ok: boolean; message: string } {
  const id = oneLine(input.id ?? '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) {
    return { ok: false, message: 'learn_skill: id должен быть kebab-case (a-z, 0-9, дефис), 2–41 символ.' };
  }
  const name = oneLine(input.name ?? '');
  const description = oneLine(input.description ?? '');
  const body = (input.body ?? '').trim();
  if (!name || !description || body.length < 20) {
    return { ok: false, message: 'learn_skill: нужны name, description и body (осмысленный текст навыка).' };
  }

  const dir = join(cwd, '.opencode', 'skills', id);
  const path = join(dir, 'SKILL.md');
  const exists = existsSync(path);
  if (exists && input.overwrite !== true) {
    return {
      ok: false,
      message: `learn_skill: ${'.opencode/skills/' + id + '/SKILL.md'} уже существует — передай overwrite: true, если правка осознанная.`,
    };
  }

  mkdirSync(dirname(path), { recursive: true });
  const content = `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
  writeFileSync(path, content, 'utf8');

  return {
    ok: true,
    message: `${exists ? 'обновлён' : 'создан'} навык \`.opencode/skills/${id}/SKILL.md\``,
  };
}

export default Plugin.define({
  id: 'learning',
  async setup(ctx) {
    const cwd = ctx.location.directory;
    const abort = new AbortController();

    const registration = await ctx.tool.transform((editor) => {
      editor.namespace({
        name: 'project',
        description: 'BodyBuildHealth project checks and self-learning (memory, skills, checks)',
      });

      editor.add({
        name: 'learn',
        description:
          'Сохранить выученный факт в docs/AGENTS-MEMORY.md (дедупликация по тексту, группировка по area). ' +
          'Память автоматически попадает в каждый следующий запрос через context-хук, поэтому записанное реально применяется. ' +
          'Пиши факты, которые нельзя вывести из кода за один взгляд: ловушки, договорённости, внешние источники.',
        options: { namespace: 'project', codemode: true },
        input: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Факт одним-двумя предложениями, самодостаточно.' },
            area: {
              type: 'string',
              description: 'Раздел: bb-engine, ui, data-import, backend, apk, research, tests, process.',
            },
            source: { type: 'string', description: 'Доказательство: `path:line`, команда или URL.' },
          },
          required: ['text'],
          additionalProperties: false,
        },
        execute: async (input) => {
          const result = appendEntry(cwd, (input ?? {}) as LearnInput);
          return { content: result.message };
        },
      });

      editor.add({
        name: 'learn_skill',
        description:
          'Создать или обновить навык `.opencode/skills/<id>/SKILL.md` — процедурное знание, которое агент будет ' +
          'загружать сам. Существующий навык не перезаписывается без overwrite: true. Навык подхватывается сразу (reload).',
        options: { namespace: 'project', codemode: true },
        input: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'kebab-case идентификатор каталога навыка.' },
            name: { type: 'string', description: 'Человеческое имя для frontmatter.' },
            description: { type: 'string', description: 'Когда навык применять — коротко, в одну строку.' },
            body: { type: 'string', description: 'Тело SKILL.md в Markdown, без frontmatter.' },
            overwrite: { type: 'boolean', description: 'Перезаписать существующий навык.' },
          },
          required: ['id', 'name', 'description', 'body'],
          additionalProperties: false,
        },
        execute: async (input) => {
          const args = (input ?? {}) as SkillInput;
          const result = writeSkill(cwd, args);
          if (result.ok) await ctx.skill.reload();
          return { content: result.message };
        },
      });

      editor.add({
        name: 'learn_config',
        description:
          'Включить или выключить автообучение: после успешно завершённой сессии верхнего уровня добавляется один ' +
          'короткий шаг дистилляции (0–3 факта в память). Хранится в storage плагина.',
        options: { namespace: 'project', codemode: true },
        input: {
          type: 'object',
          properties: { auto: { type: 'boolean', description: 'true — включить автообучение, false — выключить.' } },
          required: ['auto'],
          additionalProperties: false,
        },
        execute: async (input) => {
          const auto = Boolean((input ?? {}).auto);
          await ctx.storage.set(AUTO_KEY, auto);
          return { content: `learn: автообучение ${auto ? 'включено' : 'выключено'}.` };
        },
      });
    });

    // Apply memory to every request so lessons are used, not just stored.
    await ctx.session.hook('context', (event) => {
      const block = injectionBlock(cwd);
      if (!block) return;
      event.system.push({ type: 'text', text: block });
    });

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          types: ['session.execution.succeeded'],
          signal: abort.signal,
        })) {
          const sessionID = event.data?.sessionID;
          if (!sessionID) continue;
          if ((await ctx.storage.get(AUTO_KEY)) !== true) continue;
          if (await ctx.storage.get(`learned/${sessionID}`)) continue;

          const session = await ctx.session.get({ sessionID });
          if (session.parentID) continue; // subagent sessions are not worth a distillation turn

          const messages = await ctx.session.context({ sessionID });
          if (messages.length < 8) continue;

          await ctx.storage.set(`learned/${sessionID}`, true);
          await ctx.session.prompt({ sessionID, text: DISTILL_PROMPT, delivery: 'queue' });
        }
      } catch (error) {
        if (!abort.signal.aborted) console.error('[learning] event loop stopped:', error);
      }
    })();

    return async () => {
      abort.abort();
      await registration.dispose();
    };
  },
});
