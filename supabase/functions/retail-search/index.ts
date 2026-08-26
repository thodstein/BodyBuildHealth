const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RetailItem {
  id: string;
  source: string;
  name: string;
  brand?: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  weight?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function clampMacros(m: { kcal: number; protein: number; fat: number; carbs: number }): boolean {
  const { kcal, protein, fat, carbs } = m;
  if (!Number.isFinite(kcal) || !Number.isFinite(protein) || !Number.isFinite(fat) || !Number.isFinite(carbs)) return false;
  if (kcal <= 0 || kcal > 950) return false;
  if (protein < 0 || protein > 100 || fat < 0 || fat > 100 || carbs < 0 || carbs > 100) return false;
  return true;
}

function cleanName(raw: unknown): string {
  return String(raw ?? '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

type JsonRpcResult = { ok: boolean; sessionId?: string; data?: any };

let rpcId = 0;

async function mcpPost(endpoint: string, sessionId: string, method: string, params?: Record<string, unknown>, diag?: string[]): Promise<JsonRpcResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const rpcBody: Record<string, unknown> = { jsonrpc: '2.0', method };
  if (method !== 'notifications/initialized') {
    rpcBody.id = ++rpcId;
    if (params) rpcBody.params = params;
  }
  let res: Response;
  try {
    res = await fetchWithTimeout(endpoint, { method: 'POST', headers, body: JSON.stringify(rpcBody) }, 9000);
  } catch (e) {
    diag?.push(`fetch-fail ${endpoint}: ${String(e)?.slice(0, 120)}`);
    return { ok: false };
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    diag?.push(`HTTP ${res.status} ${endpoint} ${bodyText.slice(0, 150)}`);
    return { ok: false };
  }
  const newSession = res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id') || sessionId || undefined;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  let data: any = null;
  if (ct.includes('text/event-stream')) {
    const raw = await res.text();
    const lines = raw.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line.startsWith('data:')) continue;
      try {
        const parsed = JSON.parse(line.slice(5).trim());
        if (parsed && (parsed.result || parsed.error)) {
          data = parsed;
          break;
        }
      } catch {}
    }
    if (!data) return { ok: false, sessionId: newSession };
  } else {
    try {
      data = await res.json();
    } catch {
      return { ok: false, sessionId: newSession };
    }
  }
  if (data?.error) return { ok: false, sessionId: newSession };
  return { ok: Boolean(data), sessionId: newSession, data };
}

function mcpTextOf(rpcData: any): string {
  const content = rpcData?.result?.content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const c of content) {
    if (c?.type === 'text' && typeof c.text === 'string') out += c.text + '\n';
  }
  return out.trim();
}

function safeJsonParse(text: string): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  const start = text.search(/[[{]/);
  const endBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start >= 0 && endBrace > start) {
    try {
      return JSON.parse(text.slice(start, endBrace + 1));
    } catch {}
  }
  return null;
}

function grabNum(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(String(m[1]).replace(',', '.'));
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

function kbjuFromValueText(text: string): { kcal: number; protein: number; fat: number; carbs: number } | null {
  const protein = grabNum(text, [/белк[а-яё]*\s*([\d.,]+)/i]) ?? 0;
  const fatRaw = grabNum(text, [/[жж]ир[а-яё]*(?!ност)\s*([\d.,]+)/i]) ?? 0;
  const carbs = grabNum(text, [/углевод[а-яё]*\s*([\d.,]+)/i]) ?? 0;
  let kcal = grabNum(text, [/([\d.,]+)\s*ккал/i]) ?? 0;
  if (kcal <= 0 && protein <= 0 && fatRaw <= 0 && carbs <= 0) return null;
  if (kcal <= 0) kcal = protein * 4 + fatRaw * 9 + carbs * 4;
  const m = { kcal: Math.round(kcal), protein: round1(protein), fat: round1(fatRaw), carbs: round1(carbs) };
  return clampMacros(m) ? m : null;
}

function kbjuFromDetailText(text: string): { kcal: number; protein: number; fat: number; carbs: number } | null {
  const kcal =
    grabNum(text, [
      /калорийност[а-яё]*[^0-9]{0,40}?(\d+(?:[.,]\d+)?)/i,
      /энергетическ[а-яё]*\s*ценност[а-яё]*[^0-9]{0,40}?(\d+(?:[.,]\d+)?)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:ккал|kcal)/i,
    ]) ?? 0;
  const protein = grabNum(text, [/белк[а-яё]*[^0-9]{0,30}?(?:около\s*)?(\d+(?:[.,]\d+)?)/i]) ?? 0;
  const fatRaw =
    grabNum(text, [
      /жиры[^0-9]{0,30}?(?:около\s*)?(\d+(?:[.,]\d+)?)/i,
      /[жж]ир(?!ность)[^0-9]{0,30}?(?:около\s*)?(\d+(?:[.,]\d+)?)/i,
    ]) ?? 0;
  const carbs = grabNum(text, [/углевод[а-яё]*[^0-9]{0,30}?(?:около\s*)?(\d+(?:[.,]\d+)?)/i]) ?? 0;
  if (kcal <= 0 && protein <= 0 && fatRaw <= 0 && carbs <= 0) return null;
  const finalKcal = kcal > 0 ? kcal : protein * 4 + fatRaw * 9 + carbs * 4;
  const m = { kcal: Math.round(finalKcal), protein: round1(protein), fat: round1(fatRaw), carbs: round1(carbs) };
  return clampMacros(m) ? m : null;
}

const VKUSVILL_ENDPOINTS = ['https://mcp.vkusvill.ru/mcp', 'https://mcp001.vkusvill.ru/mcp'];

function vkusvillKbjuFromProperties(props: any[]): { kcal: number; protein: number; fat: number; carbs: number } | null {
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    const pname = String(p?.name ?? '');
    if (!/(100\s*г|ценност)/i.test(pname)) continue;
    const macros = kbjuFromValueText(String(p?.value ?? ''));
    if (macros) return macros;
  }
  return null;
}

async function vkusvillSearch(query: string, limit: number, diag?: string[]): Promise<RetailItem[]> {
  for (const endpoint of VKUSVILL_ENDPOINTS) {
    try {
      const init = await mcpPost(endpoint, '', 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'biostack-app', version: '1.0' },
      }, diag);
      if (!init.ok) continue;
      const sessionId = init.sessionId || '';
      await mcpPost(endpoint, sessionId, 'notifications/initialized').catch(() => ({ ok: false }));
      const search = await mcpPost(endpoint, sessionId, 'tools/call', {
        name: 'vkusvill_products_search',
        arguments: { q: query, page: 1, sort: 'popularity' },
      }, diag);
      if (!search.ok) {
        diag?.push('tools/call search failed');
        continue;
      }
      const payload = safeJsonParse(mcpTextOf(search.data));
      const list: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data?.items)
          ? payload.data.items
          : Array.isArray(payload?.products)
            ? payload.products
            : Array.isArray(payload?.items)
              ? payload.items
              : [];
      if (list.length === 0) {
        diag?.push(`search ok but list empty; raw=${mcpTextOf(search.data).slice(0, 200)}`);
        return [];
      }
      const top = list.slice(0, limit);
      const mapped: RetailItem[] = [];
      const needDetails: Array<{ base: RetailItem; pid: string }> = [];
      for (const p of top) {
        const pid = String(p?.id ?? p?.xml_id ?? '').trim();
        const name = cleanName(p?.name);
        if (!pid || !name) continue;
        const macros = vkusvillKbjuFromProperties(p?.properties);
        const weightParts = [p?.weight, p?.unit].filter((x: unknown) => x !== undefined && x !== null && String(x).trim() !== '');
        const base: RetailItem = {
          id: pid,
          source: 'vkusvill',
          name,
          brand: 'ВкусВилл',
          weight: weightParts.length ? weightParts.join(' ') : undefined,
          ...(macros ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 }),
        };
        if (macros) mapped.push(base);
        else needDetails.push({ base, pid });
      }
      if (mapped.length < Math.min(top.length, 3)) {
        const detailResults = await Promise.all(
          needDetails.slice(0, limit).map(async ({ base, pid }) => {
            try {
              const det = await mcpPost(endpoint, sessionId, 'tools/call', {
                name: 'vkusvill_product_details',
                arguments: { id: pid },
              });
              if (!det.ok) return null;
              const text = mcpTextOf(det.data);
              const parsedDetail = safeJsonParse(text);
              const macros = kbjuFromDetailText(parsedDetail?.data ? JSON.stringify(parsedDetail.data) : text);
              if (macros) return { ...base, ...macros } as RetailItem;
            } catch {}
            return null;
          }),
        );
        for (const it of detailResults) if (it) mapped.push(it);
      }
      if (mapped.length > 0) return mapped.slice(0, limit);
      const sample = JSON.stringify(top[0])?.slice(0, 400);
      diag?.push(`kbju-parsed 0/${top.length}; sample=${sample}`);
      return [];
    } catch (e) {
      diag?.push(`exception ${endpoint}: ${String(e)?.slice(0, 200)}`);
    }
  }
  return [];
}

async function vkusvillProductByBarcode(barcode: string, diag?: string[]): Promise<RetailItem[]> {
  const bc = (barcode || '').replace(/\D/g, '');
  if (!/^\d{13}$/.test(bc)) {
    diag?.push('barcode must be 13 digits');
    return [];
  }
  for (const endpoint of VKUSVILL_ENDPOINTS) {
    try {
      const init = await mcpPost(endpoint, '', 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'biostack-app', version: '1.0' },
      }, diag);
      if (!init.ok) continue;
      const sessionId = init.sessionId || '';
      await mcpPost(endpoint, sessionId, 'notifications/initialized').catch(() => ({ ok: false }));
      const res = await mcpPost(endpoint, sessionId, 'tools/call', {
        name: 'vkusvill_product_barcode',
        arguments: { barcode: bc },
      }, diag);
      if (!res.ok) continue;
      const text = mcpTextOf(res.data);
      const payload = safeJsonParse(text);
      if (!payload || payload.ok === false) return [];
      const item = payload?.data?.item ?? payload?.data?.product ?? payload?.data ?? payload;
      const name = cleanName(item?.name);
      if (!name) {
        diag?.push(`barcode ok but no name; raw=${text.slice(0, 200)}`);
        return [];
      }
      const macros = vkusvillKbjuFromProperties(item?.properties) ?? kbjuFromDetailText(payload?.data ? JSON.stringify(payload.data) : text);
      if (!macros) {
        diag?.push(`barcode ok but no kbju; raw=${text.slice(0, 200)}`);
        return [];
      }
      const weightParts = [item?.weight, item?.unit].filter((x: unknown) => x !== undefined && x !== null && String(x).trim() !== '');
      return [{
        id: String(item?.id ?? bc),
        source: 'vkusvill',
        name,
        brand: 'ВкусВилл',
        ...macros,
        weight: weightParts.length ? weightParts.join(' ') : undefined,
      }];
    } catch (e) {
      diag?.push(`barcode exception ${endpoint}: ${String(e)?.slice(0, 150)}`);
    }
  }
  return [];
}

const PYATEROCHKA_URLS = [
  (enc: string, limit: number) => `https://5ka.ru/api/v2/products/search/?search=${enc}&records=${limit}&page=1`,
  (enc: string, limit: number) => `https://5ka.ru/api/v4/catalog/product/search/?search=${enc}&records=${limit}&page=1`,
];

function pickNumber(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function pyaterochkaSearch(query: string, limit: number, diag?: string[]): Promise<RetailItem[]> {
  const enc = encodeURIComponent(query);
  for (const build of PYATEROCHKA_URLS) {
    try {
      const res = await fetchWithTimeout(build(enc, limit), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
          Referer: 'https://5ka.ru/',
        },
      }, 8000);
      if (!res.ok) {
        diag?.push(`pyaterochka HTTP ${res.status}`);
        continue;
      }
      const data = await res.json().catch(() => null);
      const arr: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data?.products) ? data.products : [];
      const items: RetailItem[] = [];
      for (const it of arr.slice(0, limit)) {
        const name = cleanName(it?.name);
        if (!name) continue;
        const nv = it?.nutritional_value ?? it?.nutrition ?? {};
        const macros = {
          kcal: Math.round(pickNumber(nv.calories, nv.kcal, nv['калорийность'], nv.energy)),
          protein: round1(pickNumber(nv.proteins, nv.protein, nv['белки'])),
          fat: round1(pickNumber(nv.fats, nv.fat, nv['жиры'])),
          carbs: round1(pickNumber(nv.carbohydrates, nv.carbs, nv['углеводы'])),
        };
        if (!clampMacros(macros)) continue;
        const w = Number(it?.weight);
        items.push({
          id: String(it?.id ?? name),
          source: 'pyaterochka',
          name,
          brand: it?.brand?.name ? String(it.brand.name) : undefined,
          ...macros,
          weight: Number.isFinite(w) && w > 0 ? `${w} ${String(it?.weight_unit ?? 'г')}` : undefined,
        });
      }
      if (items.length > 0) return items;
    } catch {}
  }
  return [];
}

const MAGNIT_URLS = [
  (enc: string, limit: number) => `https://magnit.ru/api/pl/catalog/search/?q=${enc}&limit=${limit}`,
  (enc: string, limit: number) => `https://magnit.ru/api/v1/catalog/search?q=${enc}&limit=${limit}`,
];

async function magnitSearch(query: string, limit: number, diag?: string[]): Promise<RetailItem[]> {
  const enc = encodeURIComponent(query);
  for (const build of MAGNIT_URLS) {
    try {
      const res = await fetchWithTimeout(build(enc, limit), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
          Referer: 'https://magnit.ru/',
        },
      }, 8000);
      if (!res.ok) {
        diag?.push(`magnit HTTP ${res.status}`);
        continue;
      }
      const data = await res.json().catch(() => null);
      const candidates: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.data?.products)
            ? data.data.products
            : Array.isArray(data?.products)
              ? data.products
              : [];
      const items: RetailItem[] = [];
      for (const it of candidates.slice(0, limit)) {
        const name = cleanName(it?.name ?? it?.title);
        if (!name) continue;
        const n = it?.nutrition ?? it?.nutritional_value ?? it?.kbju ?? {};
        const macros = {
          kcal: Math.round(pickNumber(n.calories, n.kcal, n['калорийность'])),
          protein: round1(pickNumber(n.proteins, n.protein, n['белки'])),
          fat: round1(pickNumber(n.fats, n.fat, n['жиры'])),
          carbs: round1(pickNumber(n.carbohydrates, n.carbs, n['углеводы'])),
        };
        if (!clampMacros(macros)) continue;
        items.push({
          id: String(it?.id ?? it?.plu ?? name),
          source: 'magnit',
          name,
          brand: it?.brand ? String(it.brand) : undefined,
          ...macros,
        });
      }
      if (items.length > 0) return items;
    } catch {}
  }
  return [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const query = String(body?.query ?? '').trim();
  const barcode = String(body?.barcode ?? '').replace(/\D/g, '');
  const limit = Math.min(Math.max(Number(body?.limit) || 8, 1), 20);

  if (barcode.length >= 8) {
    const bcDiag: string[] = [];
    const items = await vkusvillProductByBarcode(barcode, bcDiag);
    return json({ items, sources: items.length ? ['vkusvill'] : [], debug: bcDiag.slice(0, 4) });
  }

  if (query.length < 2) return json({ items: [], sources: [], debug: ['short'] });

  const vkDiag: string[] = [];
  const results = await Promise.allSettled([
    vkusvillSearch(query, limit, vkDiag),
    pyaterochkaSearch(query, limit),
    magnitSearch(query, limit),
  ]);

  const debug: string[] = [...vkDiag.slice(0, 4)];
  results.forEach((r, i) => {
    const name = ['vkusvill', 'pyaterochka', 'magnit'][i];
    if (r.status === 'rejected') debug.push(`${name}: ${String((r as PromiseRejectedResult).reason)?.slice(0, 200)}`);
    else if ((r as PromiseFulfilledResult<RetailItem[]>).value.length === 0 && !debug.some(d => d.startsWith(name))) debug.push(`${name}: empty`);
  });

  const sources: string[] = [];
  const seen = new Set<string>();
  const items: RetailItem[] = [];
  const chains: RetailItem[][] = ['vkusvill', 'pyaterochka', 'magnit'].map((_, i) =>
    results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<RetailItem[]>).value : [],
  );
  for (let round = 0; round < limit; round++) {
    for (const list of chains) {
      const it = list[round];
      if (!it) continue;
      const key = `${it.source}:${it.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!sources.includes(it.source)) sources.push(it.source);
      items.push(it);
    }
  }

  return json({ items, sources, debug });
});
