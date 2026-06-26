interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Trove MCP.
 *
 * Trove (National Library of Australia) — 6B+ items: digitised newspapers, books, images, maps, archives & more. Free API key required. Get a free key at trove.nla.gov.au (account -> Create an API key); the platform injects it, or pass _apiKey (BYOK).
 */


const BASE = 'https://api.trove.nla.gov.au';
const UA = 'pipeworx-mcp-trove/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search',
    description: 'Search the Trove collection by keyword. Returns matching items with ids (pass an id to work), titles, creators/sources, dates and links.',
    inputSchema: { type: 'object', properties: {
      query: { type: 'string', description: 'Keyword(s).' },
      limit: { type: 'number', description: 'Max results (1-100, default 20).' },
      page: { type: 'number', description: 'Page (1-based, default 1).' },
      _apiKey: { type: 'string', description: 'Trove API key (auto-injected by the platform).' },
    }, required: ['query'] },
  },
  {
    name: 'work',
    description: 'Fetch full details for one Trove item by id — a Trove work id (from search).',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'e.g. "12345".' },
      _apiKey: { type: 'string', description: 'Trove API key.' },
    }, required: ['id'] },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const key = typeof args._apiKey === 'string' ? args._apiKey : '';
  delete args._apiKey;
  if (!key) throw new Error('Trove API key required. Get one free at trove.nla.gov.au (account -> Create an API key) and pass via _apiKey (platform key may not be set yet).');
  switch (name) {
    case 'search': {
      const limit = clamp(numArg(args.limit, 20), 1, 100);
      const p = new URLSearchParams();
      p.set('q', String(args.query ?? ''));
      p.set('n', String(limit));
      const page = Math.max(1, numArg(args.page, 1));
      if (page > 1) p.set('page', String(page));
      p.set('category', 'all'); p.set('encoding', 'json');
      if (key) p.set('key', key);
      return get(`${BASE}/v3/result?${p}`, key);
    }
    case 'work': {
      const id = reqStr(args, 'id', '"12345"');
      const dp = new URLSearchParams(); dp.set('encoding','json'); if(key) dp.set('key', key); const dq = '?' + dp.toString();
      return get(`${BASE}/v3/work/${encodeURIComponent(id)}${dq}`, key);
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function get(url: string, key: string): Promise<unknown> {
  const headers = { Accept: 'application/json', 'User-Agent': UA };
  const res = await fetch(url, { headers });
  if (res.status === 401 || res.status === 403) throw new Error('Trove: key rejected/missing. Get a free key at trove.nla.gov.au (account -> Create an API key).');
  if (!res.ok) throw new Error(`Trove: ${res.status} ${await res.text().then((t) => t.slice(0, 160))}`);
  return res.json();
}
function reqStr(args: Record<string, unknown>, k: string, ex: string): string { const v = args[k]; if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${k}" is missing. Pass a string like ${ex}.`); return v; }
function numArg(v: unknown, d: number): number { const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN; return Number.isFinite(n) ? n : d; }
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, Math.trunc(n))); }

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
