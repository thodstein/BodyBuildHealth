export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  abstract: string;
  doi?: string;
  url: string;
}

export interface PubMedSearchResult {
  query: string;
  totalResults: number;
  articles: PubMedArticle[];
}

const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

const RATE_LIMIT_MS = 340;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url);
}

export function formatPubMedDate(dateParts: any[]): string {
  if (!Array.isArray(dateParts) || dateParts.length === 0) return '';
  const part = dateParts[0];
  if (!part) return '';
  const y = part.Year || '';
  const m = part.Month || '';
  const d = part.Day || '';
  if (y && m && d) return `${y} ${m} ${d}`;
  if (y && m) return `${y} ${m}`;
  if (y) return String(y);
  return '';
}

export async function searchPubMed(
  query: string,
  maxResults: number = 15
): Promise<PubMedSearchResult> {
  const empty: PubMedSearchResult = { query, totalResults: 0, articles: [] };

  try {
    const enrichedQuery = `${query} AND humans[MeSH Terms]`;

    const searchUrl =
      `${ESEARCH_URL}?db=pubmed&term=${encodeURIComponent(enrichedQuery)}` +
      `&retmax=${maxResults}&retmode=json&sort=relevance`;

    const searchResp = await rateLimitedFetch(searchUrl);
    if (!searchResp.ok) return empty;
    const searchData = await searchResp.json();

    const idList: string[] = searchData?.esearchresult?.idlist;
    const totalResults = parseInt(searchData?.esearchresult?.count || '0', 10);

    if (!idList || idList.length === 0) {
      return { query, totalResults, articles: [] };
    }

    const summaryUrl =
      `${ESUMMARY_URL}?db=pubmed&id=${idList.join(',')}&retmode=json`;

    const summaryResp = await rateLimitedFetch(summaryUrl);
    if (!summaryResp.ok) return { query, totalResults, articles: [] };
    const summaryData = await summaryResp.json();

    const fetchUrl =
      `${EFETCH_URL}?db=pubmed&id=${idList.join(',')}&retmode=xml`;

    const fetchResp = await rateLimitedFetch(fetchUrl);
    let abstractMap: Record<string, string> = {};
    if (fetchResp.ok) {
      const xmlText = await fetchResp.text();
      abstractMap = parseAbstractsFromXml(xmlText);
    }

    const articles: PubMedArticle[] = [];

    for (const pmid of idList) {
      try {
        const entry = summaryData?.result?.[pmid];
        if (!entry) continue;

        const authors: string[] = (entry.authors || []).map(
          (a: any) => a.name || ''
        ).filter(Boolean);

        const pubDate = formatPubMedDate(entry.pubdate ? [{ Year: entry.pubdate }] : entry.sortpubdate ? [{ Year: entry.sortpubdate }] : []);

        let formattedDate = '';
        if (entry.sortpubdate) {
          formattedDate = entry.sortpubdate.replace(/-/g, ' ');
        } else if (entry.pubdate) {
          formattedDate = entry.pubdate;
        }

        const doi = entry.elocationid?.startsWith('doi:')
          ? entry.elocationid.replace('doi:', '').trim()
          : undefined;

        articles.push({
          pmid,
          title: entry.title || '',
          authors,
          journal: entry.fulljournalname || entry.source || '',
          pubDate: formattedDate,
          abstract: abstractMap[pmid] || '',
          doi,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        });
      } catch {
        continue;
      }
    }

    return { query, totalResults, articles };
  } catch {
    return empty;
  }
}

function parseAbstractsFromXml(xml: string): Record<string, string> {
  const map: Record<string, string> = {};

  const articles = xml.split(/<PubmedArticle>/).slice(1);

  for (const chunk of articles) {
    try {
      const pmidMatch = chunk.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      if (!pmidMatch) continue;
      const pmid = pmidMatch[1];

      const abstractSection = chunk.match(/<Abstract>([\s\S]*?)<\/Abstract>/);
      if (!abstractSection) continue;

      const textParts: string[] = [];
      const textMatches = abstractSection[1].matchAll(
        /<AbstractText[^>]*Label="([^"]*)"[^>]*>([\s\S]*?)<\/AbstractText>/g
      );
      for (const m of textMatches) {
        const label = m[1];
        const text = m[2].replace(/<[^>]+>/g, '').trim();
        if (label && text) {
          textParts.push(`${label}: ${text}`);
        } else if (text) {
          textParts.push(text);
        }
      }

      if (textParts.length === 0) {
        const simpleMatches = abstractSection[1].matchAll(
          /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g
        );
        for (const m of simpleMatches) {
          const text = m[1].replace(/<[^>]+>/g, '').trim();
          if (text) textParts.push(text);
        }
      }

      if (textParts.length > 0) {
        map[pmid] = textParts.join('\n\n');
      }
    } catch {
      continue;
    }
  }

  return map;
}
