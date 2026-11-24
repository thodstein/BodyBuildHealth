/**
 * Repo knowledge tools for BodyBuildHealth (OpenCode V2 plugin).
 *
 * namespace `repo`:
 *   pharma — что приложение само знает о веществе: запись PHARMA_DB (класс, t½, доза, риски, противопоказания),
 *            правила в pharma-interactions.engine.ts, упоминания в женском протоколе. Плюс честный ответ «нет в базе».
 *   lab    — лабораторный код: норма UCUM_MAP, женские границы, пороги-константы, где используется.
 *   doc    — поиск по docs/, src/, scripts/ (все слова запроса в одной строке) → file:line + строка.
 *
 * Both read the TypeScript sources as text (no imports: the plugin server cannot resolve the app's TS modules).
 * The point is one call instead of five greps across files whose entries are 2 000-character one-liners.
 *
 * Loaded automatically from `.opencode/plugins/`.
 */
import { Plugin } from '@opencode/plugin';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_HITS = 3;
const MAX_LIST = 8;

interface SourceLine {
  file: string;
  line: number;
  text: string;
}

function readSafe(path: string): string {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
  } catch {
    return '';
  }
}

function lines(file: string): string[] {
  return readSafe(file).split(/\r?\n/);
}

function files(dir: string, pattern: RegExp): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => pattern.test(name))
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

/** `key: 'value'` or `key: "value"` from a one-line object literal. */
function quoted(source: string, key: string): string | undefined {
  const pattern = new RegExp(`${key}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'i');
  return pattern.exec(source)?.[1];
}

function numeric(source: string, key: string): string | undefined {
  return new RegExp(`${key}\\s*:\\s*(-?[\\d.]+)`, 'i').exec(source)?.[1];
}

/** Split a TS array literal body on top-level commas (quotes respected). */
function splitItems(body: string): string[] {
  const items: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const char of body) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ',') {
      items.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) items.push(current);
  return items.map((item) => item.trim()).filter(Boolean);
}

/** String items of `key: ['a','b']` with the quotes removed. */
function strings(source: string, key: string): string[] {
  const match = new RegExp(`\\b${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i').exec(source);
  if (!match) return [];
  return splitItems(match[1])
    .map((item) => /^['"](.*)['"]$/s.exec(item)?.[1] ?? '')
    .filter(Boolean);
}

/** `[{effect:'X',strength:0.9},...]` → `X 0.9` items. */
function effectList(source: string, key: string): string[] {
  const match = new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\](?=\\s*,\\s*\\w+\\s*:)`, 'i').exec(source);
  if (!match) return [];
  const body = match[1];
  const entries: string[] = [];
  for (const object of body.matchAll(/\{([^{}]*)\}/g)) {
    const label = quoted(object[1], 'effect') ?? quoted(object[1], 'name') ?? quoted(object[1], 'text');
    const strength = numeric(object[1], 'strength') ?? quoted(object[1], 'frequency');
    if (label) entries.push(strength ? `${label} (${strength})` : label);
  }
  if (entries.length === 0) return strings(source, key);
  return entries;
}

function clip(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-‑–]+/g, '')
    .replace(/\s+/g, '');
}

interface SubstanceRecord {
  id: string;
  name: string;
  line: SourceLine;
  raw: string;
}

function loadSubstances(cwd: string): SubstanceRecord[] {
  const dir = join(cwd, 'src', 'core', 'pharma-db');
  const sources = [join(cwd, 'src', 'core', 'pharma-database.ts'), ...files(dir, /\.ts$/)].filter(
    (file) => !/class-defaults/.test(file),
  );
  const records: SubstanceRecord[] = [];
  for (const file of sources) {
    const relative = file.slice(cwd.length + 1).replace(/\\/g, '/');
    lines(file).forEach((text, index) => {
      const id = /(?:^|[{,\s])['"]?([a-z0-9_]{3,})['"]?\s*:\s*\{\s*id\s*:\s*'/.exec(text)?.[1];
      const inner = /id\s*:\s*'([a-z0-9_]{3,})'/.exec(text)?.[1];
      const key = inner ?? id;
      if (!key) return;
      if (!/name\s*:\s*'/.test(text)) return;
      records.push({
        id: key,
        name: quoted(text, 'name') ?? key,
        line: { file: relative, line: index + 1, text },
        raw: text,
      });
    });
  }
  return records;
}

function loadClassDefaults(cwd: string): Map<string, string> {
  const file = join(cwd, 'src', 'core', 'pharma-db', 'class-defaults.ts');
  const out = new Map<string, string>();
  lines(file).forEach((text) => {
    const match = /^\s*([a-z0-9_]+)\s*:\s*\{/.exec(text);
    if (match) out.set(match[1], text);
  });
  return out;
}

function growths(source: string): string[] {
  const range = /dosageRange\s*:\s*\{([^}]*)\}/i.exec(source)?.[1];
  if (!range) return [];
  const min = numeric(range, 'min');
  const max = numeric(range, 'max');
  const unit = quoted(range, 'unit');
  const frequency = quoted(range, 'frequency');
  if (!min && !max) return [];
  return [`${min ?? '?'}–${max ?? '?'}${unit ? ` ${unit}` : ''}${frequency ? ` · ${frequency}` : ''}`];
}

function formatSubstance(cwd: string, record: SubstanceRecord, index: number): string[] {
  const defaults = loadClassDefaults(cwd).get(quoted(record.raw, 'class') ?? '') ?? '';
  const merged = `${record.raw} ${defaults}`;
  const classId = quoted(record.raw, 'class') ?? '?';
  const halfLife = numeric(record.raw, 'halfLifeHours') ?? numeric(record.raw, 'tHalfHours');
  const bioavailability = numeric(record.raw, 'bioavailability');
  const dose = growths(record.raw)[0] ?? growths(defaults)[0] ?? 'не задана в базе';
  const effects = effectList(record.raw, 'effects');
  const risks = strings(record.raw, 'risks');
  const contraindications = strings(record.raw, 'contraindications');
  const instructions = strings(record.raw, 'specialInstructions');
  const sideEffects = effectList(record.raw, 'sideEffects');

  const result = [
    `${index}. ${record.name} · id \`${record.id}\` · класс \`${classId}\` — ${record.line.file}:${record.line.line}`,
    `   PK: t½ ${halfLife ? `${halfLife} ч` : '—'} · биодоступность ${bioavailability ?? '—'} · доза: ${dose}`,
  ];
  if (effects.length) result.push(`   эффекты: ${clip(effects.join('; '), 220)}`);
  if (risks.length) result.push(`   риски: ${clip(risks.join('; '), 260)}`);
  if (contraindications.length) result.push(`   противопоказания: ${clip(contraindications.join('; '), 260)}`);
  if (instructions.length) result.push(`   инструкции: ${clip(instructions.join('; '), 240)}`);
  if (sideEffects.length) result.push(`   побочки: ${clip(sideEffects.join('; '), 200)}`);
  if (merged.length > 0 && !quoted(defaults, 'description')) {
    result.push('   (у класса нет defaults — часть полей могла остаться пустой)');
  }
  result.push(`   полная запись: ${record.line.file}:${record.line.line}`);
  return result;
}

function interactionHits(
  cwd: string,
  needles: string[],
): { file: string; total: number; lines: number[]; samples: string[] } {
  const file = 'src/engines/pharma-interactions.engine.ts';
  const source = lines(join(cwd, file));
  const numbers: number[] = [];
  const samples: string[] = [];
  source.forEach((text, index) => {
    const lower = text.toLowerCase();
    if (!needles.some((needle) => needle && lower.includes(needle))) return;
    if (/^\s*(import|\/\/|\*|\/\*)/.test(text)) return;
    numbers.push(index + 1);
    if (samples.length < 4) samples.push(clip(text.replace(/^\s+/, ''), 170));
  });
  return { file, total: numbers.length, lines: numbers, samples };
}

function protocolHits(cwd: string, needles: string[]): { file: string; total: number; lines: number[] } {
  const file = 'docs/FEMALE_AAS_PROTOCOLS.md';
  const numbers: number[] = [];
  lines(join(cwd, file)).forEach((text, index) => {
    const lower = text.toLowerCase();
    if (!needles.some((needle) => needle && lower.includes(needle))) return;
    numbers.push(index + 1);
  });
  return { file, total: numbers.length, lines: numbers };
}

function listClasses(cwd: string): string[] {
  const source = readSafe(join(cwd, 'src', 'core', 'pharma-database.ts'));
  const block = /PHARMA_CLASSES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source)?.[1] ?? '';
  return splitItems(block)
    .map((item) => (item.match(/['"]([a-z0-9_]+)['"]/)?.[1] ?? '').trim())
    .filter(Boolean);
}

interface UcumEntry {
  code: string;
  name: string;
  lln: string;
  uln: string;
  unit: string;
  line: number;
}

function loadUcum(cwd: string): { file: string; entries: UcumEntry[] } {
  const file = 'src/core/constants.ts';
  const source = lines(join(cwd, file));
  const start = source.findIndex((text) => /export const UCUM_MAP/.test(text));
  const entries: UcumEntry[] = [];
  if (start < 0) return { file, entries };

  for (let index = start + 1; index < source.length; index += 1) {
    const text = source[index];
    if (/^\};/.test(text.trim())) break;
    const match = /^\s*['"]?([A-Za-z0-9_]+)['"]?\s*:\s*\{([\s\S]*?)\},?\s*$/.exec(text);
    if (!match) continue;
    const body = match[2];
    const uln = numeric(body, 'uln');
    const lln = numeric(body, 'lln');
    if (!uln && !lln) continue;
    entries.push({
      code: match[1],
      name: quoted(body, 'name') ?? match[1],
      lln: lln ?? '0',
      uln: uln ?? '?',
      unit: quoted(body, 'prefUnit') ?? quoted(body, 'unit') ?? '',
      line: index + 1,
    });
  }
  return { file, entries };
}

/** `{ CODE: 'Key' }` from FEMALE_SOURCE_CODES in lab-norms.engine.ts. */
function femaleSourceCodes(cwd: string): Map<string, string> {
  const source = readSafe(join(cwd, 'src', 'engines', 'lab-norms.engine.ts'));
  const block = /FEMALE_SOURCE_CODES[^=]*=\s*\{([\s\S]*?)\};/.exec(source)?.[1] ?? '';
  const out = new Map<string, string>();
  for (const match of block.matchAll(/([A-Za-z0-9_]+)\s*:\s*'([A-Za-z0-9_]+)'/g)) {
    out.set(match[1], match[2]);
  }
  return out;
}

/** Entries of LAB_REFERENCES_FEMALE in risk-engine-v7-matrix.ts, with line numbers. */
function femaleMatrix(cwd: string): Map<string, { lln: string; uln: string; line: number }> {
  const file = 'src/engines/risk-engine-v7-matrix.ts';
  const source = lines(join(cwd, file));
  const start = source.findIndex((text) => /LAB_REFERENCES_FEMALE/.test(text) && /=/.test(text));
  const out = new Map<string, { lln: string; uln: string; line: number }>();
  if (start < 0) return out;
  for (let index = start + 1; index < source.length; index += 1) {
    const text = source[index];
    if (/^\};/.test(text.trim())) break;
    const match = /^\s*([A-Za-z0-9_]+)\s*:\s*\{([^}]*)\}/.exec(text);
    if (!match) continue;
    const lln = numeric(match[2], 'lln');
    const uln = numeric(match[2], 'uln');
    if (!lln || !uln) continue;
    out.set(match[1], { lln, uln, line: index + 1 });
  }
  return out;
}

function femaleBounds(cwd: string, code: string): { text: string; where: string } | null {
  const file = 'src/engines/lab-norms.engine.ts';
  const source = lines(join(cwd, file));

  // Explicit override, e.g. `FEMALE_LAB_BOUNDS.UA = { lln: 150, uln: 350 };`
  const assigned = new RegExp(
    `FEMALE_LAB_BOUNDS\\.${code}\\s*=\\s*\\{\\s*lln:\\s*(-?[\\d.]+)\\s*,\\s*uln:\\s*(-?[\\d.]+)`,
    'i',
  );
  for (let index = 0; index < source.length; index += 1) {
    const match = assigned.exec(source[index]);
    if (match) return { text: `${match[1]}–${match[2]}`, where: `${file}:${index + 1} (явное переопределение)` };
  }

  // Otherwise the numbers come from LAB_REFERENCES_FEMALE (×100 only for Hct).
  const key = femaleSourceCodes(cwd).get(code.toUpperCase());
  if (!key) return null;
  const entry = femaleMatrix(cwd).get(key);
  if (!entry) return null;
  const scale = code.toUpperCase() === 'HCT' ? 100 : 1;
  const round = (value: string) => Math.round(Number(value) * scale * 100) / 100;
  return {
    text: `${round(entry.lln)}–${round(entry.uln)}`,
    where: `risk-engine-v7-matrix.ts:${entry.line} (LAB_REFERENCES_FEMALE.${key}${scale === 100 ? ', ×100' : ''})`,
  };
}

const SUPPORT_SOURCES = [
  { file: 'src/data/evidence-dosage-db.ts', label: 'дозировки с источниками' },
  { file: 'src/data/support-dosing.ts', label: 'протоколы поддержки/ПКТ' },
  { file: 'src/data/support-substances.ts', label: 'описание вещества' },
];

/** Keys that look like map entries but are fields of an entry. */
const FIELD_KEYS = new Set([
  'id',
  'name',
  'nameRu',
  'category',
  'class',
  'unit',
  'min',
  'max',
  'opt',
  'minMg',
  'optMg',
  'maxMg',
  'timing',
  'duration',
  'notes',
  'references',
  'contraindications',
  'indications',
  'mechanisms',
  'warnings',
  'evidenceLevel',
  'protocolRefs',
  'riskThresholdKey',
  'doseRange',
  'titration',
  'lastUpdated',
]);

function entryKey(text: string): string | null {
  const match = /^ {0,2}(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*/.exec(text);
  const key = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!key || FIELD_KEYS.has(key)) return null;
  return key;
}

/** The whole entry starting at `index`: one line, or the `{ … }` block up to its closing brace. */
function entryBlock(source: string[], index: number): string[] {
  const first = source[index];
  const open = first.indexOf('{');
  if (open < 0 || first.slice(open).includes('}')) return [first];
  const indent = /^\s*/.exec(first)?.[0] ?? '';
  const out = [first];
  for (let cursor = index + 1; cursor < source.length && out.length < 60; cursor += 1) {
    out.push(source[cursor]);
    if (new RegExp(`^${indent}\\},?\\s*$`).test(source[cursor])) break;
  }
  return out;
}

function quotedInline(source: string): string | undefined {
  return /^\s*[A-Za-z_$][\w$]*\s*:\s*'((?:[^'\\]|\\.)*)'/.exec(source)?.[1];
}

/** Compact human summary of a support-database entry (whatever fields that file uses). */
function supportDigest(block: string): string[] {
  const out: string[] = [];

  const range = /doseRange\s*:\s*\{([^}]*)\}/.exec(block)?.[1];
  if (range) {
    const min = numeric(range, 'min');
    const max = numeric(range, 'max');
    const unit = quoted(range, 'unit');
    const frequency = quoted(range, 'frequency');
    out.push(`доза ${min ?? '?'}–${max ?? '?'}${unit ? ` ${unit}` : ''}${frequency ? ` · ${frequency}` : ''}`);
  }

  const minMg = numeric(block, 'minMg');
  const optMg = numeric(block, 'optMg');
  const maxMg = numeric(block, 'maxMg');
  if (minMg || maxMg) {
    const unit = quoted(block, 'unit') ?? '';
    const opt = optMg ? ` (опт. ${optMg})` : '';
    out.push(`доза ${minMg ?? '?'}–${maxMg ?? '?'}${opt}${unit ? ` ${unit}` : ''}`);
  }

  const timing = quoted(block, 'timing');
  const duration = quoted(block, 'duration');
  if (timing || duration) out.push(`приём: ${[timing, duration && `курс ${duration}`].filter(Boolean).join(' · ')}`);

  const level = quoted(block, 'evidenceLevel');
  if (level) out.push(`уровень доказательности в базе: ${level}`);

  const lists: [string, string][] = [
    ['indications', 'показания'],
    ['mechanisms', 'механизмы'],
    ['warnings', 'предупреждения'],
    ['contraindications', 'противопоказания'],
  ];
  for (const [key, label] of lists) {
    const values = strings(block, key);
    if (values.length > 0) out.push(`${label}: ${clip(values.slice(0, 4).join('; '), 200)}`);
  }

  const notes = quoted(block, 'notes');
  if (notes) out.push(`заметки: ${clip(notes, 240)}`);

  const references = strings(block, 'references');
  if (references.length > 0) out.push(`источники в базе: ${clip(references.slice(0, 3).join('; '), 260)}`);

  if (out.length === 0) {
    const text = quotedInline(block);
    if (text) out.push(`описание: ${clip(text, 300)}`);
  }
  return out;
}

interface SupportEntry {
  file: string;
  label: string;
  key: string;
  line: number;
  names: string;
  digest: string[];
}

function loadSupport(cwd: string): SupportEntry[] {
  const entries: SupportEntry[] = [];
  for (const source of SUPPORT_SOURCES) {
    const file = join(cwd, source.file);
    const text = lines(file);
    for (let index = 0; index < text.length; index += 1) {
      const key = entryKey(text[index]);
      if (!key) continue;
      const block = entryBlock(text, index);
      if (block.length > 1) index += block.length - 1;
      const body = block.join('\n');
      entries.push({
        file: source.file,
        label: source.label,
        key,
        line: index - block.length + 2,
        names: [quoted(body, 'nameRu'), quoted(body, 'name')].filter(Boolean).join(' '),
        digest: supportDigest(body),
      });
    }
  }
  return entries;
}

function supportMatches(entries: SupportEntry[], query: string): SupportEntry[] {
  const needle = normalize(query);
  const scored = entries
    .map((entry) => {
      const key = normalize(entry.key);
      const names = normalize(entry.names);
      const score = key === needle || names.includes(needle) ? 3 : key.startsWith(needle) ? 2 : 0;
      return { entry, score };
    })
    .filter((candidate) => candidate.score > 0 && candidate.entry.digest.length > 0)
    .sort((a, b) => b.score - a.score || a.entry.key.localeCompare(b.entry.key));

  const seen = new Set<string>();
  const picked: SupportEntry[] = [];
  for (const candidate of scored) {
    const id = `${candidate.entry.file}#${candidate.entry.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    picked.push(candidate.entry);
    if (picked.length >= MAX_HITS) break;
  }

  // Same substance in another support file (e.g. Russian query matches nameRu in support-dosing, while the sourced
  // dosing lives in evidence-dosage-db): add it so the answer carries both the protocol and its references.
  const keys = new Set(picked.map((entry) => entry.key));
  const extras = entries
    .filter((entry) => keys.has(entry.key) && !seen.has(`${entry.file}#${entry.key}`))
    .sort((a, b) => b.digest.length - a.digest.length);
  for (const entry of extras) {
    if (picked.length >= MAX_HITS) break;
    seen.add(`${entry.file}#${entry.key}`);
    picked.push(entry);
  }
  return picked;
}

const DOC_ROOTS = ['docs', 'src', 'scripts'];

function docHits(
  cwd: string,
  query: string,
  scope: string,
  limit: number,
): { file: string; line: number; text: string }[] {
  const terms = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((term) => term.length >= 2)
    .slice(0, 6);
  if (terms.length === 0) return [];
  const roots = scope === 'all' ? DOC_ROOTS : [scope];
  const hits: { file: string; line: number; text: string }[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 4 || hits.length >= limit) return;
    let entries: { name: string; isDir: boolean }[] = [];
    try {
      entries = readdirSync(join(cwd, dir), { withFileTypes: true }).map((item) => ({
        name: item.name,
        isDir: item.isDirectory(),
      }));
    } catch {
      return;
    }
    for (const item of entries) {
      if (hits.length >= limit) return;
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      const path = `${dir}/${item.name}`;
      if (item.isDir) {
        walk(path, depth + 1);
        continue;
      }
      if (!/\.(md|ts|tsx|json|sql)$/.test(item.name)) continue;
      const file = join(cwd, path);
      let text = '';
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const rows = text.split(/\r?\n/);
      rows.forEach((row, index) => {
        if (hits.length >= limit) return;
        const lower = row.toLowerCase();
        if (!terms.every((term) => lower.includes(term))) return;
        hits.push({ file: path, line: index + 1, text: clip(row.replace(/^\s+/, ''), 200) });
      });
    }
  };
  for (const root of roots) walk(root, 0);
  return hits;
}

export default Plugin.define({
  id: 'repo-knowledge',
  async setup(ctx) {
    const cwd = ctx.location.directory;
    const cache = { substances: null as SubstanceRecord[] | null, support: null as SupportEntry[] | null };
    const substances = () => (cache.substances ??= loadSubstances(cwd));
    const support = () => (cache.support ??= loadSupport(cwd));
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: 'repo',
        description:
          'Local BodyBuildHealth knowledge: what the app itself knows about a substance (PHARMA_DB, interaction ' +
          'rules, female protocols) and about a lab code (norms, thresholds). Use before adding or changing pharma ' +
          'data, and to answer "does the app know X?".',
      });

      editor.add({
        name: 'pharma',
        description:
          'Что уже есть в приложении по веществу: запись `PHARMA_DB` (класс, t½, доза, эффекты, риски, ' +
          'противопоказания), поддерживающие базы ПКТ/БАД (`evidence-dosage-db.ts` — дозы с references, ' +
          '`support-dosing.ts` — протоколы и уровень доказательности, `support-substances.ts` — описание; там ' +
          'тамоксифен, кломифен, ХГЧ, каберголин, витамины), ' +
          'сколько правил в `pharma-interactions.engine.ts` его упоминают, упоминания в ' +
          '`docs/FEMALE_AAS_PROTOCOLS.md`. Русское или английское имя, id, класс или бренд. Если вещества нет — ' +
          'скажет об этом прямо (это пробел, а не «нет данных»).',
        options: { namespace: 'repo', codemode: true },
        input: {
          type: 'object',
          properties: {
            substance: { type: 'string', description: 'Название/id/класс: `trenbolone`, `Тренболон`, `oral_17aa`.' },
          },
          required: ['substance'],
          additionalProperties: false,
        },
        execute: async (input) => {
          const query = (((input ?? {}) as { substance?: string }).substance ?? '').trim();
          if (query.length < 2) return { content: 'repo_pharma: нужен substance (минимум 2 символа).' };

          const all = substances();
          if (all.length === 0) {
            return { content: 'repo_pharma: не удалось прочитать src/core/pharma-db/*.ts — проверь пути.' };
          }

          const needle = normalize(query);
          const scored = all
            .map((record) => {
              const id = normalize(record.id);
              const name = normalize(record.name);
              let score = 0;
              if (id === needle || name === needle) score = 3;
              else if (id.includes(needle) || needle.includes(id)) score = 2;
              else if (name.includes(needle) || needle.includes(name)) score = 1;
              return { record, score };
            })
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));

          const classes = listClasses(cwd);
          const classMatch = classes.find(
            (classId) => normalize(classId) === needle || normalize(classId).includes(needle),
          );
          const supportHits = supportMatches(support(), query);
          const blocks: string[] = [];

          if (scored.length > 0) {
            blocks.push(`Наш PHARMA_DB — совпадения по «${query}»: ${scored.length}`);
            scored
              .slice(0, MAX_HITS)
              .forEach((entry, index) => blocks.push(...formatSubstance(cwd, entry.record, index + 1)));
          } else if (classMatch) {
            const inClass = all.filter((record) => quoted(record.raw, 'class') === classMatch);
            blocks.push(
              `Класс \`${classMatch}\` есть в PHARMA_CLASSES; веществ в нём: ${inClass.length}.`,
              inClass.map((record) => `${record.id} — ${record.name}`).join('\n'),
            );
          } else {
            const close = all
              .map((record) => ({ record, distance: Math.abs(normalize(record.id).length - needle.length) }))
              .filter((entry) => normalize(entry.record.id).slice(0, 4) === needle.slice(0, 4))
              .slice(0, 5)
              .map((entry) => entry.record.id);
            blocks.push(
              supportHits.length > 0
                ? `В PHARMA_DB (каталог ААС) нет «${query}», но вещество есть в поддерживающих базах — данные ниже.`
                : `В PHARMA_DB нет «${query}». Это пробел каталога, а не «нет информации»: не выдумывай PK/дозу.`,
              close.length > 0
                ? `Похожие id: ${close.join(', ')}`
                : `Классы, которые можно добавить: ${classes.join(', ')}`,
            );
          }

          if (supportHits.length > 0) {
            blocks.push(`Поддерживающие базы (ПКТ/БАД) — ${supportHits.length} запись(и):`);
            for (const hit of supportHits) {
              blocks.push(`${hit.key} · ${hit.label} (${hit.file}:${hit.line})`);
              for (const line of hit.digest) blocks.push(`   ${line}`);
            }
          }

          const needles = [
            ...scored.slice(0, MAX_HITS).map((entry) => entry.record.id),
            ...new Set(scored.slice(0, MAX_HITS).map((entry) => quoted(entry.record.raw, 'class') ?? '')),
            ...supportHits.map((hit) => hit.key),
            classMatch ?? '',
            ...(needle.length > 4 ? [query] : []),
          ].filter(Boolean);

          const interactions = interactionHits(cwd, needles);
          blocks.push(
            interactions.total > 0
              ? `Взаимодействия (${interactions.file}): ${interactions.total} строк(и) — ${interactions.lines
                  .slice(0, 12)
                  .join(', ')}\n${interactions.samples.map((sample) => `  · ${sample}`).join('\n')}`
              : `Взаимодействия (${interactions.file}): упоминаний нет — правило для этого вещества/класса не написано.`,
          );

          const protocols = protocolHits(cwd, needles);
          blocks.push(
            protocols.total > 0
              ? `Женский протокол (${protocols.file}): ${protocols.total} упоминание(й), строки ${protocols.lines
                  .slice(0, 10)
                  .join(', ')}.`
              : `Женский протокол (${protocols.file}): упоминаний нет.`,
          );

          blocks.push(
            'Дальше: механизм/дозы сверяй с `evidence_drug_label` (если есть официальный лейбл) и `evidence_literature`; ' +
              'правки каталога — по скиллу `bb-engine` (типы `PharmaSubstance`, тесты).',
          );
          return { content: blocks.join('\n') };
        },
      });

      editor.add({
        name: 'lab',
        description:
          'Лабораторный код в приложении: норма `UCUM_MAP` (lln–uln, единица, коэффициент), женские границы ' +
          '(`FEMALE_LAB_BOUNDS` / `LAB_REFERENCES_FEMALE`), константы-пороги в `lab-norms.engine.ts` и где они ' +
          'используются. Коды: ALT, AST, GGT, HCT, HGB, RBC, CREATININE, FERRITIN, TT, E2, PRL, PROG, TSH, IGF1, ' +
          'LDL, HDL, CRP, UACR.',
        options: { namespace: 'repo', codemode: true },
        input: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Код показателя или его фрагмент (ALT, HCT, testosterone).' },
          },
          required: ['code'],
          additionalProperties: false,
        },
        execute: async (input) => {
          const query = (((input ?? {}) as { code?: string }).code ?? '').trim();
          if (query.length < 1) return { content: 'repo_lab: нужен code.' };

          const { file, entries } = loadUcum(cwd);
          if (entries.length === 0) {
            return { content: 'repo_lab: UCUM_MAP не найден в src/core/constants.ts — структура файла изменилась.' };
          }

          const needle = normalize(query);
          const matches = entries
            .map((entry) => {
              const code = normalize(entry.code);
              const name = normalize(entry.name);
              const score =
                code === needle
                  ? 4
                  : code.startsWith(needle)
                    ? 3
                    : name.includes(needle)
                      ? 2
                      : code.includes(needle)
                        ? 1
                        : 0;
              return { entry, score };
            })
            .filter((candidate) => candidate.score > 0)
            .sort((a, b) => b.score - a.score || a.entry.code.localeCompare(b.entry.code))
            .slice(0, 5)
            .map((candidate) => candidate.entry);

          if (matches.length === 0) {
            const codes = entries.slice(0, 25).map((entry) => entry.code);
            return {
              content: `repo_lab: в UCUM_MAP нет «${query}». Доступные коды (первые): ${codes.join(', ')}.`,
            };
          }

          const blocks: string[] = [];
          matches.slice(0, 5).forEach((entry, index) => {
            const female = femaleBounds(cwd, entry.code);
            const thresholdLines: string[] = [];
            lines(join(cwd, 'src/engines/lab-norms.engine.ts')).forEach((text, lineIndex) => {
              if (thresholdLines.length >= 6) return;
              if (!new RegExp(`\\b${entry.code}\\b`).test(text)) return;
              if (/^\s*(import|\/\/|\*|\/\*)/.test(text)) return;
              thresholdLines.push(`  · lab-norms.engine.ts:${lineIndex + 1} ${clip(text, 150)}`);
            });

            blocks.push(
              `${index + 1}. ${entry.code} — ${entry.name}: ${entry.lln}–${entry.uln}${entry.unit ? ` ${entry.unit}` : ''}` +
                ` (${file}:${entry.line})`,
              female ? `   ♀ ${female.text} (${female.where})` : '   ♀ отдельных границ в lab-norms нет',
              thresholdLines.length
                ? `   пороги/использование:\n${thresholdLines.join('\n')}`
                : '   порогов в lab-norms.engine.ts нет',
            );
          });

          blocks.push(
            'Правило проекта: числа норм не дублировать по экранам — только `getLabNorm`/`LAB_TIERS` (скилл `aas-medicine`).',
          );
          return { content: blocks.join('\n') };
        },
      });

      editor.add({
        name: 'doc',
        description:
          'Поиск по самому репозиторию (docs/, src/, scripts/): все слова запроса в одной строке, результат — ' +
          '`file:line` + строка. Для вопросов «что у нас в доках/коде про X»: аудиты, планы, протоколы, константы, ' +
          'названия функций. Это не интернет — внешние факты бери через `evidence_*`.',
        options: { namespace: 'repo', codemode: true },
        input: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Слова через пробел; ищутся все одновременно (регистр не важен).' },
            scope: {
              type: 'string',
              enum: ['docs', 'src', 'scripts', 'all'],
              description: 'Где искать; по умолчанию docs.',
            },
            limit: { type: 'number', description: '1–25, по умолчанию 8.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        execute: async (input) => {
          const args = (input ?? {}) as { query?: string; scope?: string; limit?: number };
          const query = (args.query ?? '').trim();
          if (query.length < 2) return { content: 'repo_doc: нужен query.' };
          const scope = args.scope && ['docs', 'src', 'scripts', 'all'].includes(args.scope) ? args.scope : 'docs';
          const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 25);
          const hits = docHits(cwd, query, scope, limit);
          if (hits.length === 0) {
            return {
              content:
                `repo_doc: в ${scope} нет строки со всеми словами «${query}». Попробуй меньше слов, другой синоним ` +
                'или scope all — и не выдумывай содержимое вместо поиска.',
            };
          }
          return {
            content: [
              `repo_doc: ${hits.length} находка(и) в ${scope} по «${query}»`,
              ...hits.map((hit) => `${hit.file}:${hit.line} — ${hit.text}`),
            ].join('\n'),
          };
        },
      });
    });
  },
});
