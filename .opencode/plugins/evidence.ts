/**
 * Evidence tools for BodyBuildHealth (OpenCode V2 plugin).
 *
 * Namespaces:
 *   evidence — external, keyless sources an agent can actually reach from this machine:
 *                literature  PubMed (E-utilities) + Europe PMC in one call
 *                trials      ClinicalTrials.gov registry (API v2)
 *                drug_label  DailyMed SPL label: indications, dosage, warnings, interactions
 *                substance   PubChem identity: formula, mass, SMILES, synonyms, CAS
 *                citation    verify a DOI/title: Crossref metadata + OpenAlex retraction/citation state
 *   web      — web_search over DuckDuckGo HTML (the built-in provider answers 403 on this network).
 *
 * It also registers a DuckDuckGo websearch *provider*, so the built-in `websearch` tool works again.
 *
 * Deliberately keyless and read-only: no account, no API key, nothing to configure. Every source below was
 * probed live from this machine; openFDA (api.fda.gov), NIH ODS (ods.od.nih.gov), USDA FDC and DSLD answer 403
 * here and are therefore not wrapped — use `webfetch`/`browse` for those.
 *
 * Loaded automatically from `.opencode/plugins/`.
 */
import { Plugin } from '@opencode/plugin';

const UA = 'BodyBuildHealth-agent/1.0 (evidence; +https://github.com/)';
const TIMEOUT_MS = 20_000;
const ACCEPT = 'application/json, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5';

interface Abortable {
  signal?: AbortSignal;
}

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  engine: string;
}

/* ------------------------------------------------------------------ http */

function withTimeout(parent: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const relay = () => controller.abort();
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', relay, { once: true });
  }
  return {
    signal: controller.signal,
    done() {
      clearTimeout(timer);
      parent?.removeEventListener('abort', relay);
    },
  };
}

async function requestText(url: string, context: Abortable, accept = ACCEPT): Promise<string> {
  const scope = withTimeout(context.signal, TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: scope.signal, headers: { 'user-agent': UA, accept } });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} для ${hostOf(url)}${body ? `: ${body.slice(0, 120)}` : ''}`);
    }
    return body;
  } finally {
    scope.done();
  }
}

async function requestJson<T = any>(url: string, context: Abortable, accept = ACCEPT): Promise<T> {
  const body = await requestText(url, context, accept);
  return JSON.parse(body) as T;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function failure(label: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${label}: источник недоступен (${message}). Скажи об этом в отчёте, не выдумывай данные.`;
}

/* -------------------------------------------------------------- text utils */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  micro: 'µ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return safeChar(parseInt(code.slice(2), 16), match);
    if (code.startsWith('#')) return safeChar(parseInt(code.slice(1), 10), match);
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function safeChar(code: number, fallback: string): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<\/(p|paragraph|li|tr|div|h[1-6]|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function plain(html: string): string {
  return stripTags(decodeEntities(html)).replace(/\s+/g, ' ').trim();
}

function clip(text: string, limit: number): string {
  const clean = text.trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

function list(values: unknown, sep = ', '): string {
  return Array.isArray(values) ? values.filter(Boolean).join(sep) : '';
}

function q(value: string): string {
  return encodeURIComponent(value);
}

function quoteTerms(value: string): string {
  const terms = value
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => (/["()[\]{}:^~]/.test(term) ? term : `"${term.replace(/"/g, '')}"`));
  return terms.join(' ');
}

/* --------------------------------------------------------------- PubMed */

interface PubmedHit {
  uid: string;
  title: string;
  source: string;
  pubdate: string;
  authors: { name: string }[];
  pubtype: string[];
  articleids: { idtype: string; value: string }[];
}

async function pubmedSearch(
  query: string,
  limit: number,
  sort: 'relevance' | 'date',
  yearFrom: number | undefined,
  yearTo: number | undefined,
  openAccessOnly: boolean,
  context: Abortable,
): Promise<{ count: number; hits: PubmedHit[] }> {
  let term = query.trim();
  if (yearFrom || yearTo) term += ` AND ${yearFrom ?? 1900}:${yearTo ?? 3000}[dp]`;
  if (openAccessOnly) term += ' AND free full text[sb]';

  const search = await requestJson<any>(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&sort=${
      sort === 'date' ? 'pub_date' : 'relevance'
    }&term=${q(term)}`,
    context,
  );
  const result = search?.esearchresult ?? {};
  const ids: string[] = result.idlist ?? [];
  const count = Number(result.count ?? 0);
  if (ids.length === 0) return { count, hits: [] };

  const summary = await requestJson<any>(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`,
    context,
  );
  const hits = ids.map((id) => summary?.result?.[id]).filter(Boolean) as PubmedHit[];
  return { count, hits };
}

function formatPubmed(hit: PubmedHit, index: number): string[] {
  const doi = (hit.articleids ?? []).find((entry) => entry.idtype === 'doi')?.value;
  const pmc = (hit.articleids ?? []).find((entry) => entry.idtype === 'pmc')?.value;
  const authors = (hit.authors ?? []).map((author) => author.name).filter(Boolean);
  const who = (authors.length > 2 ? `${authors[0]} et al.` : authors.join(', ') || 'автор не указан').replace(
    /\.$/,
    '',
  );
  const year = (hit.pubdate ?? '').slice(0, 4);
  const kinds = list(hit.pubtype);
  const lines = [
    `${index}. ${plain(hit.title ?? '').replace(/\.$/, '')} — ${who}. ${hit.source ?? '?'} ${year}.` +
      ` PMID ${hit.uid}${doi ? ` · doi:${doi}` : ''}${pmc ? ` · ${pmc}` : ''}${kinds ? ` [${kinds}]` : ''}`,
  ];
  if (pmc) lines.push(`   полный текст: https://www.ncbi.nlm.nih.gov/pmc/articles/${pmc}/`);
  return lines;
}

/* ---------------------------------------------------------- Europe PMC */

interface EpmcHit {
  id: string;
  source: string;
  pmid?: string;
  doi?: string;
  title: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
  isOpenAccess?: string;
  citedByCount?: number;
  abstractText?: string;
  pubTypeList?: { pubType?: string[] };
}

async function europePmcSearch(
  query: string,
  limit: number,
  yearFrom: number | undefined,
  yearTo: number | undefined,
  openAccessOnly: boolean,
  context: Abortable,
): Promise<{ count: number; hits: EpmcHit[] }> {
  // Europe PMC does not understand PubMed field tags (`[tiab]`, `[mh]`, …): search the bare terms there.
  let text = query
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (yearFrom || yearTo) text += ` AND (FIRST_PDATE:[${yearFrom ?? 1900}-01-01 TO ${yearTo ?? 3000}-12-31])`;
  if (openAccessOnly) text += ' AND (OPEN_ACCESS:y)';

  const data = await requestJson<any>(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q(text)}&format=json&resultType=core&pageSize=${limit}`,
    context,
  );
  const hits = (data?.resultList?.result ?? []) as EpmcHit[];
  return { count: Number(data?.hitCount ?? 0), hits };
}

function formatEpmc(hit: EpmcHit, index: number): string[] {
  const authors = (hit.authorString ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const who = (authors.length > 2 ? `${authors[0]} et al.` : authors.join(', ') || 'автор не указан').replace(
    /\.$/,
    '',
  );
  const types = list(hit.pubTypeList?.pubType);
  const ids = [
    hit.pmid ? `PMID ${hit.pmid}` : '',
    hit.doi ? `doi:${hit.doi}` : '',
    hit.source === 'PPR' ? 'препринт' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const lines = [
    `${index}. ${plain(hit.title ?? '').replace(/\.$/, '')} — ${who}. ${hit.journalTitle ?? hit.source} ${
      hit.pubYear ?? '?'
    }. ${ids}${hit.isOpenAccess === 'Y' ? ' · OA' : ''}${hit.citedByCount ? ` · цитат ${hit.citedByCount}` : ''}${
      types ? ` [${types}]` : ''
    }`,
  ];
  if (hit.abstractText) lines.push(`   абстракт: ${clip(plain(hit.abstractText), 420)}`);
  return lines;
}

/* ------------------------------------------------------ ClinicalTrials.gov */

const TRIAL_FIELDS = [
  'NCTId',
  'BriefTitle',
  'OverallStatus',
  'Phase',
  'EnrollmentCount',
  'StartDate',
  'CompletionDate',
  'LeadSponsorName',
  'Condition',
  'InterventionName',
].join(',');

const STATUS_MAP: Record<string, string> = {
  recruiting: 'RECRUITING',
  active: 'ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION',
  'not-recruiting': 'ACTIVE_NOT_RECRUITING',
  completed: 'COMPLETED',
  terminated: 'TERMINATED',
  withdrawn: 'WITHDRAWN',
  suspended: 'SUSPENDED',
  unknown: 'UNKNOWN',
};

function formatTrial(study: any, index: number): string[] {
  const p = study?.protocolSection ?? {};
  const id = p.identificationModule?.nctId ?? '?';
  const status = p.statusModule?.overallStatus ?? '?';
  const phase = list(p.designModule?.phases);
  const enrollment = p.designModule?.enrollmentInfo?.count;
  const start = p.statusModule?.startDateStruct?.date ?? '?';
  const completion = p.statusModule?.primaryCompletionDateStruct?.date ?? '';
  const sponsor = p.sponsorCollaboratorsModule?.leadSponsor?.name ?? '?';
  const conditions = list(p.conditionsModule?.conditions);
  const interventions = (p.armsInterventionsModule?.interventions ?? [])
    .map((entry: any) => entry?.name)
    .filter(Boolean);

  return [
    `${index}. ${id} — ${plain(p.identificationModule?.briefTitle ?? '')}`,
    `   ${status}${phase ? ` · ${phase}` : ''}${enrollment ? ` · n=${enrollment}` : ''} · старт ${start}${
      completion ? ` · завершение ${completion}` : ''
    }`,
    `   ${conditions ? `условия: ${conditions}; ` : ''}спонсор: ${sponsor}`,
    `   ${interventions.length ? `вмешательства: ${interventions.slice(0, 5).join(', ')}` : ''}`.trimEnd(),
    `   https://clinicaltrials.gov/study/${id}`,
  ].filter((line) => line.trim().length > 0);
}

/* ------------------------------------------------------------ web search */

function unwrapDuckUrl(href: string): string {
  const absolute = href.startsWith('//') ? `https:${href}` : href;
  try {
    const url = new URL(absolute);
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : absolute;
  } catch {
    return absolute;
  }
}

async function duckHtml(query: string, limit: number, context: Abortable): Promise<SearchHit[]> {
  const html = await requestText(
    `https://html.duckduckgo.com/html/?q=${q(query)}&kl=us-en`,
    context,
    'text/html,application/xhtml+xml',
  );
  const hits: SearchHit[] = [];
  const anchor = /<a[^>]*class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) && hits.length < limit) {
    const url = unwrapDuckUrl(match[1]);
    const title = plain(match[2]);
    if (!url || !title || url.includes('duckduckgo.com/y.js')) continue;
    const rest = html.slice(anchor.lastIndex, anchor.lastIndex + 2500);
    const snippet = /class=["']result__snippet["'][^>]*>([\s\S]*?)<\/(?:a|div|td)>/i.exec(rest);
    hits.push({ url, title, snippet: snippet ? clip(plain(snippet[1]), 300) : '', engine: 'duckduckgo' });
  }
  return hits;
}

async function duckLite(query: string, limit: number, context: Abortable): Promise<SearchHit[]> {
  const html = await requestText(
    `https://lite.duckduckgo.com/lite/?q=${q(query)}`,
    context,
    'text/html,application/xhtml+xml',
  );
  const hits: SearchHit[] = [];
  const anchor = /<a[^>]*class=['"]result-link['"][^>]*href=['"]([^"']+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) && hits.length < limit) {
    const url = unwrapDuckUrl(match[1]);
    const title = plain(match[2]);
    if (!url || !title) continue;
    const rest = html.slice(anchor.lastIndex, anchor.lastIndex + 2500);
    const snippet = /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i.exec(rest);
    hits.push({ url, title, snippet: snippet ? clip(plain(snippet[1]), 300) : '', engine: 'duckduckgo-lite' });
  }
  return hits;
}

async function searchWeb(query: string, limit: number, context: Abortable): Promise<SearchHit[]> {
  const attempts: Array<(input: string, size: number, ctx: Abortable) => Promise<SearchHit[]>> = [duckHtml, duckLite];
  const problems: string[] = [];
  for (const attempt of attempts) {
    try {
      const hits = await attempt(query, limit, context);
      if (hits.length > 0) return hits;
      problems.push('пустая выдача');
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`поиск не дал результатов (${problems.join('; ')})`);
}

function formatHits(hits: SearchHit[], query: string): string {
  const lines = [`web: «${query}» — ${hits.length} результат(ов), движок ${hits[0]?.engine ?? '?'}`];
  hits.forEach((hit, index) => {
    lines.push(`${index + 1}. ${hit.title}`);
    lines.push(`   ${hit.url}`);
    if (hit.snippet) lines.push(`   ${hit.snippet}`);
  });
  lines.push(
    '',
    'Дальше: открой нужную страницу `webfetch` (или `browse` для JS-страниц и логинов).',
    'Для медицины/БАДов первичный источник — не блог, а PubMed/Europe PMC: проверь утверждение через evidence_literature.',
  );
  return lines.join('\n');
}

/* --------------------------------------------------------------- DailyMed */

const SECTION_ALIASES: Record<string, string[]> = {
  boxed: ['BOXED WARNING'],
  indications: ['INDICATIONS'],
  dosage: ['DOSAGE'],
  contraindications: ['CONTRAINDICATIONS'],
  warnings: ['WARNINGS'],
  precautions: ['PRECAUTIONS'],
  interactions: ['DRUG INTERACTIONS'],
  adverse: ['ADVERSE REACTIONS'],
  populations: ['USE IN SPECIFIC POPULATIONS'],
  overdose: ['OVERDOSAGE'],
  pharmacology: ['CLINICAL PHARMACOLOGY'],
  description: ['DESCRIPTION'],
  counseling: ['PATIENT COUNSELING'],
};

const DEFAULT_SECTIONS = [
  'boxed',
  'indications',
  'dosage',
  'contraindications',
  'warnings',
  'interactions',
  'populations',
];

/** The `<section>` element that encloses a byte offset, found by brace-style tag counting. */
function enclosingSection(xml: string, offset: number): string {
  const open = xml.lastIndexOf('<section', offset);
  if (open < 0) return '';
  const tags = /<\/?section\b[^>]*>/gi;
  tags.lastIndex = open;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(xml))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return xml.slice(open, match.index + match[0].length);
    } else {
      depth += 1;
    }
  }
  return xml.slice(open);
}

function cleanSectionName(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+SECTION$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * DailyMed section names are LOINC display names. `includes` is not enough: "CONTRAINDICATIONS"
 * contains "INDICATIONS", so compare whole words instead.
 */
function sectionMatches(name: string, patterns: string[]): boolean {
  const clean = cleanSectionName(name);
  return patterns.some((pattern) => {
    const wanted = cleanSectionName(pattern);
    return clean === wanted || clean.startsWith(`${wanted} `) || clean.startsWith(`${wanted}&`);
  });
}

function labelSections(xml: string, wanted: string[]): { name: string; title: string; text: string }[] {
  const found: { name: string; title: string; text: string; at: number }[] = [];
  const codes = /<code[^>]*displayName="([^"]+)"[^>]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = codes.exec(xml))) {
    const name = decodeEntities(match[1]).toUpperCase();
    if (!sectionMatches(name, wanted)) continue;
    const section = enclosingSection(xml, match.index);
    if (!section) continue;
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(section);
    const body = section.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '');
    const text = stripTags(decodeEntities(body));
    if (text.length < 30) continue;
    found.push({ name, title: title ? plain(title[1]) : name, text, at: match.index });
  }
  return found.sort((a, b) => a.at - b.at);
}

/* ------------------------------------------------------------ input types */

interface LiteratureInput {
  query?: string;
  source?: 'pubmed' | 'europepmc' | 'both';
  limit?: number;
  sort?: 'relevance' | 'date';
  yearFrom?: number;
  yearTo?: number;
  openAccessOnly?: boolean;
}

interface TrialsInput {
  query?: string;
  intervention?: string;
  status?: string[];
  phase?: string[];
  nctId?: string;
  limit?: number;
}

interface LabelInput {
  name?: string;
  setId?: string;
  sections?: string[];
  fetchFirst?: boolean;
}

interface SubstanceInput {
  name?: string;
}

interface CitationInput {
  doi?: string;
  pmid?: string;
  title?: string;
}

interface WebInput {
  query?: string;
  limit?: number;
  site?: string;
}

/* ------------------------------------------------------------------ plugin */

export default Plugin.define({
  id: 'evidence',
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: 'evidence',
        description:
          'External evidence sources (keyless): PubMed/Europe PMC literature, ClinicalTrials.gov trials, DailyMed drug ' +
          'labels, PubChem substances, Crossref/OpenAlex citation checks. Use before stating any medical, dosing, ' +
          'pharmacology or supplement fact.',
      });

      editor.add({
        name: 'literature',
        description:
          'Поиск научной литературы одним вызовом: PubMed (E-utilities) + Europe PMC (включая препринты). ' +
          'Используй для любого медицинского утверждения: эффективность, дозы, ПКТ, побочки, БАДы, тренировочные ' +
          'протоколы. Возвращает PMID/DOI/OA-статус/абстракт. Работает без MCP и без ключей — запасной маршрут, ' +
          'если `pubmed` MCP недоступен.',
        options: { namespace: 'evidence', codemode: true },
        input: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Запрос. Поддерживает синтаксис PubMed: `creatine[tiab] AND hypertrophy[tiab]`, `"Resistance Training"[mh]`.',
            },
            source: { type: 'string', enum: ['pubmed', 'europepmc', 'both'], description: 'По умолчанию both.' },
            limit: { type: 'number', description: 'Сколько записей на источник (1–25, по умолчанию 6).' },
            sort: {
              type: 'string',
              enum: ['relevance', 'date'],
              description: 'Сортировка PubMed; по умолчанию relevance.',
            },
            yearFrom: { type: 'number', description: 'Нижняя граница года публикации (включительно).' },
            yearTo: { type: 'number', description: 'Верхняя граница года публикации (включительно).' },
            openAccessOnly: { type: 'boolean', description: 'Только записи со свободным полным текстом.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        execute: async (input, context) => {
          const args = (input ?? {}) as LiteratureInput;
          const query = (args.query ?? '').trim();
          if (query.length < 2) return { content: 'literature: нужен осмысленный query.' };
          const limit = Math.min(Math.max(Math.round(args.limit ?? 6), 1), 25);
          const source = args.source ?? 'both';
          const sort = args.sort ?? 'relevance';
          const blocks: string[] = [];

          if (source !== 'europepmc') {
            try {
              const { count, hits } = await pubmedSearch(
                query,
                limit,
                sort,
                args.yearFrom,
                args.yearTo,
                args.openAccessOnly === true,
                context,
              );
              blocks.push(
                [
                  `## PubMed — ${count} совпадений (показано ${hits.length})`,
                  ...hits.flatMap((hit, i) => formatPubmed(hit, i + 1)),
                ].join('\n'),
              );
            } catch (error) {
              blocks.push(failure('PubMed', error));
            }
          }

          if (source !== 'pubmed') {
            try {
              const { count, hits } = await europePmcSearch(
                query,
                limit,
                args.yearFrom,
                args.yearTo,
                args.openAccessOnly === true,
                context,
              );
              blocks.push(
                [
                  `## Europe PMC — ${count} совпадений (показано ${hits.length})`,
                  ...hits.flatMap((hit, i) => formatEpmc(hit, i + 1)),
                ].join('\n'),
              );
            } catch (error) {
              blocks.push(failure('Europe PMC', error));
            }
          }

          blocks.push(
            'Уровень доказательности и правила цитирования — скилл `research`. Не выдавай абстракт за полный текст.',
          );
          return { content: blocks.join('\n\n') };
        },
      });

      editor.add({
        name: 'trials',
        description:
          'Поиск в реестре клинических исследований ClinicalTrials.gov (API v2): статус, фаза, набор, спонсор, ' +
          'вмешательства, NCT-ссылка. Для вопросов «есть ли исследования по X», «что сейчас набирают», ' +
          '«какие фазы у препарата». По NCT-номеру отдаёт одну запись.',
        options: { namespace: 'evidence', codemode: true },
        input: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Свободный поиск по регистру (состояние, препарат, популяция).' },
            intervention: { type: 'string', description: 'Ограничить конкретным вмешательством/препаратом.' },
            status: {
              type: 'array',
              items: { type: 'string' },
              description: 'recruiting | active | not-recruiting | completed | terminated | withdrawn | suspended.',
            },
            phase: {
              type: 'array',
              items: { type: 'string' },
              description: 'PHASE1 | PHASE2 | PHASE3 | PHASE4 | EARLY_PHASE1 | NA.',
            },
            nctId: { type: 'string', description: 'Точный NCT-номер для одной записи.' },
            limit: { type: 'number', description: '1–20, по умолчанию 5.' },
          },
          additionalProperties: false,
        },
        execute: async (input, context) => {
          const args = (input ?? {}) as TrialsInput;

          try {
            if (args.nctId) {
              const study = await requestJson<any>(
                `https://clinicaltrials.gov/api/v2/studies/${q(args.nctId.trim())}?fields=${q(TRIAL_FIELDS)}`,
                context,
              );
              return { content: formatTrial(study, 1).join('\n') };
            }

            const query = (args.query ?? '').trim();
            const intervention = (args.intervention ?? '').trim();
            if (!query && !intervention) return { content: 'trials: нужен query, intervention или nctId.' };

            const limit = Math.min(Math.max(Math.round(args.limit ?? 5), 1), 20);
            const params: string[] = [`pageSize=${limit}`, `fields=${q(TRIAL_FIELDS)}`];
            if (query) params.push(`query.term=${q(query)}`);
            if (intervention) params.push(`query.intr=${q(intervention)}`);
            const statuses = (args.status ?? [])
              .map((value) => STATUS_MAP[value.toLowerCase().replace(/\s+/g, '-')] ?? value.toUpperCase())
              .filter(Boolean);
            if (statuses.length > 0) params.push(`filter.overallStatus=${q(statuses.join(','))}`);
            if (args.phase && args.phase.length > 0) params.push(`filter.phase=${q(args.phase.join(','))}`);
            params.push('countTotal=true');

            const data = await requestJson<any>(
              `https://clinicaltrials.gov/api/v2/studies?${params.join('&')}`,
              context,
            );
            const studies: any[] = data?.studies ?? [];
            if (studies.length === 0) {
              return {
                content: 'trials: по этому запросу регистр ничего не вернул. Расширь формулировку или убери фильтры.',
              };
            }
            const lines = [`ClinicalTrials.gov: показано ${studies.length} из ${data?.totalCount ?? '?'}`];
            studies.forEach((study, index) => lines.push(...formatTrial(study, index + 1)));
            return { content: lines.join('\n') };
          } catch (error) {
            return { content: failure('ClinicalTrials.gov', error) };
          }
        },
      });

      editor.add({
        name: 'drug_label',
        description:
          'Официальная инструкция препарата из DailyMed (NLM, SPL): показания, дозировка, противопоказания, ' +
          'предупреждения, лекарственные взаимодействия, особые популяции. Аргумент `name` — поиск по названию ' +
          '(МНН на английском: tamoxifen, anastrozole, metformin); без `sections` вернёт ключевые разделы первого ' +
          'совпадения. Это первоисточник для доз и противопоказаний, а не блог.',
        options: { namespace: 'evidence', codemode: true },
        input: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Название препарата (английское МНН или бренд).' },
            setId: { type: 'string', description: 'SPL setid из предыдущего ответа — точечная загрузка.' },
            sections: {
              type: 'array',
              items: { type: 'string' },
              description:
                'boxed | indications | dosage | contraindications | warnings | precautions | interactions | adverse | ' +
                'populations | overdose | pharmacology | description | counseling.',
            },
            fetchFirst: {
              type: 'boolean',
              description: 'Без setId: сразу загрузить первый найденный лейбл (по умолчанию true).',
            },
          },
          additionalProperties: false,
        },
        execute: async (input, context) => {
          const args = (input ?? {}) as LabelInput;
          const wantedKeys = (args.sections && args.sections.length > 0 ? args.sections : DEFAULT_SECTIONS).map(
            (value) => value.toLowerCase().replace(/\s+/g, '-'),
          );
          const patternByKey = wantedKeys.map((key) => SECTION_ALIASES[key] ?? [key.toUpperCase()]);
          const wanted = patternByKey.flat();

          let setId = args.setId?.trim();
          let header = '';

          try {
            if (!setId) {
              const name = (args.name ?? '').trim();
              if (name.length < 2) return { content: 'drug_label: нужен name или setId.' };
              const search = await requestJson<any>(
                `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${q(name)}&pagesize=5`,
                context,
                'application/json',
              );
              const candidates: { title: string; setid: string; published_date?: string }[] = search?.data ?? [];
              if (candidates.length === 0) {
                return {
                  content:
                    `drug_label: DailyMed не нашёл «${name}». Проверь английское МНН (например metformin, not «Метформин») ` +
                    'или это БАД без рецептурного лейбла — тогда источник PubMed/состав продукта.',
                };
              }
              const listing = candidates
                .map(
                  (item, index) => `${index + 1}. ${item.title} · setid ${item.setid} · ${item.published_date ?? ''}`,
                )
                .join('\n');
              if (args.fetchFirst === false) {
                return {
                  content: `DailyMed, кандидаты:\n${listing}\n\nПовтори вызов с setId=<нужный>, чтобы получить текст разделов.`,
                };
              }
              setId = candidates[0].setid;
              header = `DailyMed: найденные лейблы\n${listing}\n\nЗагружен первый: ${candidates[0].title}\n`;
            }

            const xml = await requestText(
              `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${q(setId)}.xml`,
              context,
              '*/*',
            );
            const effective = /<effectiveTime value="(\d{8})"/.exec(xml)?.[1];
            const sections = labelSections(xml, wanted);
            const missing = wantedKeys.filter(
              (key, index) => !sections.some((section) => sectionMatches(section.name, patternByKey[index])),
            );

            if (sections.length === 0) {
              const names = [...xml.matchAll(/<code[^>]*displayName="([^"]+)"/g)]
                .map((match) => decodeEntities(match[1]))
                .filter((name) => !/UNCLASSIFIED/i.test(name));
              return {
                content:
                  `${header}Drug label setid ${setId}: нужные разделы не найдены.\n` +
                  `Доступные разделы: ${[...new Set(names)].join(', ') || 'нет'}\n` +
                  'Повтори вызов с подходящими значениями в `sections`.',
              };
            }

            const body = sections
              .map((section) => {
                const clipped = section.text.length > 1500;
                return `### ${section.title}${clipped ? ' (обрезано)' : ''}\n${clip(section.text, 1500)}`;
              })
              .join('\n\n');
            const missingNote =
              missing.length > 0
                ? `Не нашлось разделов: ${missing.join(', ')} — у этого лейбла они не выделены отдельно; ` +
                  'попробуй соседние (`precautions`, `warnings`, `adverse`) или `sections: []` для списка доступных.'
                : '';
            return {
              content: [
                `${header}Drug label (DailyMed SPL) · setid ${setId}${effective ? ` · версия ${effective}` : ''}`,
                `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`,
                '',
                body,
                ...(missingNote ? ['', missingNote] : []),
                '',
                'Это текст официальной инструкции, а не назначение. Дозу для конкретного человека сверяй с врачом; ' +
                  'для ААС/ПКТ официальных лейблов часто нет — тогда PubMed + локальный PHARMA_DB (`repo_pharma`).',
              ].join('\n'),
            };
          } catch (error) {
            return { content: failure('DailyMed', error) };
          }
        },
      });

      editor.add({
        name: 'substance',
        description:
          'Идентификация вещества в PubChem: CID, молекулярная формула, масса, SMILES, IUPAC, синонимы и CAS. ' +
          'Нужен, чтобы не путать вещества (тестостерон vs эфиры, тамоксифен vs торемифен, «пептид X») и чтобы ' +
          'найти каноническое имя для PubMed. Не даёт доз и ПКТ — за ними иди в `drug_label`/`literature`.',
        options: { namespace: 'evidence', codemode: true },
        input: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Название вещества на английском (МНН, тривиальное, бренд).' },
          },
          required: ['name'],
          additionalProperties: false,
        },
        execute: async (input, context) => {
          const name = (((input ?? {}) as SubstanceInput).name ?? '').trim();
          if (name.length < 2) return { content: 'substance: нужен name.' };
          try {
            const cids = await requestJson<any>(
              `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${q(name)}/cids/JSON`,
              context,
            );
            const cid = cids?.IdentifierList?.CID?.[0];
            if (!cid) {
              return {
                content:
                  `substance: PubChem не знает «${name}». Попробуй синоним/МНН/латинское имя или это смесь/БАД — ` +
                  'тогда смотри состав в `web_search` + PubMed.',
              };
            }
            const [props, synonyms] = await Promise.all([
              requestJson<any>(
                `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,XLogP/JSON`,
                context,
              ),
              requestJson<any>(
                `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`,
                context,
              ).catch(() => null),
            ]);
            const property = props?.PropertyTable?.Properties?.[0] ?? {};
            const names: string[] = synonyms?.InformationList?.Information?.[0]?.Synonym ?? [];
            const cas = names.filter((value) => /^\d{2,7}-\d{2}-\d$/.test(value)).slice(0, 3);
            return {
              content: [
                `PubChem: ${name} → CID ${cid}`,
                `формула: ${property.MolecularFormula ?? '?'} · масса: ${property.MolecularWeight ?? '?'} · XLogP: ${
                  property.XLogP ?? '?'
                }`,
                `IUPAC: ${property.IUPACName ?? '?'}`,
                `SMILES: ${property.CanonicalSMILES ?? property.ConnectivitySMILES ?? '?'}`,
                `синонимы: ${names.slice(0, 12).join('; ') || '—'}`,
                cas.length > 0 ? `CAS: ${cas.join(', ')}` : '',
                `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
              ]
                .filter(Boolean)
                .join('\n'),
            };
          } catch (error) {
            return { content: failure('PubChem', error) };
          }
        },
      });

      editor.add({
        name: 'citation',
        description:
          'Проверка ссылки перед тем, как поставить её в отчёт: DOI/PMID/название → Crossref (журнал, год, авторы, ' +
          'том/страницы) + OpenAlex (цитируемость, тип, ФЛАГ ОТОЗЫВА is_retracted). Обязательный шаг, если ' +
          'утверждение опирается на конкретную статью: не цитируй PMID/DOI по памяти.',
        options: { namespace: 'evidence', codemode: true },
        input: {
          type: 'object',
          properties: {
            doi: { type: 'string', description: 'DOI (можно с префиксом https://doi.org/).' },
            pmid: { type: 'string', description: 'PMID — DOI будет найден через PubMed.' },
            title: { type: 'string', description: 'Название статьи, если DOI неизвестен.' },
          },
          additionalProperties: false,
        },
        execute: async (input, context) => {
          const args = (input ?? {}) as CitationInput;
          let doi = args.doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') ?? '';

          try {
            if (!doi && args.pmid) {
              const summary = await requestJson<any>(
                `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${q(args.pmid.trim())}`,
                context,
              );
              const record = summary?.result?.[args.pmid.trim()];
              doi = (record?.articleids ?? []).find((entry: any) => entry.idtype === 'doi')?.value ?? '';
              if (!record) return { content: `citation: PubMed не знает PMID ${args.pmid}.` };
              if (!doi) {
                return {
                  content: `citation: у PMID ${args.pmid} нет DOI. Запись: ${plain(record.title)} — ${
                    record.source
                  } ${record.pubdate}.`,
                };
              }
            }

            if (!doi && args.title) {
              const found = await requestJson<any>(
                `https://api.crossref.org/works?rows=3&select=DOI,title,container-title,issued,author,type&query.bibliographic=${q(
                  args.title,
                )}`,
                context,
              );
              const items: any[] = found?.message?.items ?? [];
              if (items.length === 0) return { content: `citation: Crossref не нашёл «${args.title}».` };
              const listing = items
                .map(
                  (item, index) =>
                    `${index + 1}. ${plain(item.title?.[0] ?? '')} — ${item['container-title']?.[0] ?? '?'} ${
                      item.issued?.['date-parts']?.[0]?.[0] ?? '?'
                    } · doi:${item.DOI}`,
                )
                .join('\n');
              return {
                content: `citation: кандидаты Crossref\n${listing}\n\nПовтори вызов с doi=<выбранный>, чтобы проверить отзыв и цитируемость.`,
              };
            }

            if (!doi) return { content: 'citation: нужен doi, pmid или title.' };

            const [crossref, openalex] = await Promise.all([
              requestJson<any>(`https://api.crossref.org/works/${q(doi)}`, context),
              requestJson<any>(
                `https://api.openalex.org/works/https://doi.org/${doi}?select=id,doi,title,publication_year,cited_by_count,type,is_retracted,is_paratext`,
                context,
              ).catch(() => null),
            ]);
            const m = crossref?.message ?? {};
            const authors = (m.author ?? []).map((author: any) => author.family ?? author.name).filter(Boolean);
            const year = m.issued?.['date-parts']?.[0]?.[0] ?? openalex?.publication_year ?? '?';
            const updates = (m['update-to'] ?? []).map((entry: any) => `${entry.type}: doi:${entry.DOI}`);
            const retracted = openalex?.is_retracted === true;
            const lines = [
              `Crossref: ${plain((m.title ?? [])[0] ?? '')}`,
              `  ${m['container-title']?.[0] ?? '?'} · ${year} · том ${m.volume ?? '?'} (${m.issue ?? '?'}) · стр. ${
                m.page ?? '?'
              } · тип ${m.type ?? '?'}`,
              `  авторы: ${authors.slice(0, 6).join(', ') || '—'}${authors.length > 6 ? ' и др.' : ''}`,
              `  doi:${m.DOI ?? doi} · процитировано (Crossref): ${m['is-referenced-by-count'] ?? '?'}`,
            ];
            if (openalex) {
              lines.push(
                `OpenAlex: ${openalex.id} · цитат ${openalex.cited_by_count ?? '?'} · тип ${openalex.type ?? '?'}`,
              );
            }
            if (retracted) lines.push('⚠️ СТАТЬЯ ОТОЗВАНА (OpenAlex is_retracted=true) — цитировать нельзя.');
            if (openalex?.is_paratext)
              lines.push('⚠️ OpenAlex помечает запись как paratext — проверь, что это сама статья.');
            if (updates.length > 0) lines.push(`Crossref update-to: ${updates.join('; ')}`);
            lines.push(
              '',
              `Цитата: ${authors.slice(0, 3).join(', ')}${authors.length > 3 ? ', et al' : ''}. ${plain(
                (m.title ?? [])[0] ?? '',
              )}. ${m['container-title']?.[0] ?? ''}. ${year};${m.volume ?? ''}(${m.issue ?? ''}):${m.page ?? ''}. doi:${
                m.DOI ?? doi
              }`,
            );
            return { content: lines.join('\n') };
          } catch (error) {
            return { content: failure('Crossref/OpenAlex', error) };
          }
        },
      });

      editor.namespace({
        name: 'web',
        description: 'Web search that actually works on this network (DuckDuckGo HTML)',
      });

      editor.add({
        name: 'search',
        description:
          'Веб-поиск (DuckDuckGo HTML, без ключа): заголовок + URL + сниппет. Используй для цен, вендоров, форумов, ' +
          'новостей, документации и когда встроенный `websearch` вернул пусто/403. Для медицинских фактов после ' +
          'поиска проверяй первоисточник через `evidence_literature`.',
        options: { namespace: 'web', codemode: true },
        input: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Поисковый запрос (можно site:example.com внутри).' },
            limit: { type: 'number', description: '1–15, по умолчанию 8.' },
            site: { type: 'string', description: 'Ограничить доменом, например examine.com.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        execute: async (input, context) => {
          const args = (input ?? {}) as WebInput;
          const query = (args.query ?? '').trim();
          if (query.length < 2) return { content: 'web_search: нужен query.' };
          const limit = Math.min(Math.max(Math.round(args.limit ?? 8), 1), 15);
          const full = args.site && !/site:/i.test(query) ? `${query} site:${args.site}` : query;
          try {
            const hits = await searchWeb(full, limit, context);
            return { content: formatHits(hits, full) };
          } catch (error) {
            return { content: failure('web_search', error) };
          }
        },
      });
    });

    // The built-in websearch provider answers 403 on this network, so register DuckDuckGo as the default one.
    try {
      await ctx.websearch.transform((editor) => {
        editor.add({
          id: 'duckduckgo',
          name: 'DuckDuckGo HTML',
          execute: async ({ query }, hookContext) => {
            const hits = await searchWeb(query, 10, hookContext);
            return hits.map((hit) => ({ url: hit.url, title: hit.title, content: hit.snippet, time: {} }));
          },
        });
        editor.default.set('duckduckgo');
      });
    } catch (error) {
      console.error('[evidence] websearch provider not registered:', error);
    }
  },
});
