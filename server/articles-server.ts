/**
 * Articles Content Server — File-System Based Hybrid Content Engine
 *
 * Scans /content/articles/ for .md + .pdf files, builds a unified
 * date-sorted feed, serves PDFs statically, and renders Markdown to HTML.
 *
 * Endpoints:
 *   GET  /api/v1/articles          — unified article feed (sorted by date desc)
 *   GET  /api/v1/articles/:slug    — single article (MD→HTML or PDF→file_url)
 *   GET  /static/articles/*.pdf    — static PDF serving
 *
 * Usage:
 *   npx tsx articles-server.ts
 */

import express, { type Request, type Response } from 'express';
import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const ARTICLES_DIR = resolve(__dirname, '..', 'content', 'articles');
const STATIC_MOUNT = '/static/articles';

// ═══════════════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════════════

interface IArticleMeta {
  title: string;
  date: string;
  description?: string;
  cover_image?: string;
}

interface IArticleItem {
  slug: string;
  title: string;
  date: string;
  description?: string;
  cover_image?: string;
  content_type: 'markdown' | 'pdf';
  /** Present only for PDFs — direct URL to the static file */
  file_url?: string;
}

interface IArticleDetail extends IArticleItem {
  /** Present only for Markdown — rendered HTML content */
  html_content?: string;
  /** Present only for Markdown — raw Markdown body */
  raw_body?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a filename stem into a human-readable title.
 * "Gid-po-analizam" → "Gid po analizam"
 */
function stemToTitle(stem: string): string {
  return stem
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core — File scanning
// ═══════════════════════════════════════════════════════════════════════════

async function scanArticles(): Promise<IArticleItem[]> {
  if (!existsSync(ARTICLES_DIR)) {
    console.warn(`Articles directory not found: ${ARTICLES_DIR}`);
    return [];
  }

  const entries = await readdir(ARTICLES_DIR, { withFileTypes: true });
  const items: IArticleItem[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = extname(entry.name).toLowerCase();
    const stem = basename(entry.name, ext);
    const filePath = join(ARTICLES_DIR, entry.name);

    if (ext === '.md') {
      // ── Markdown: parse YAML frontmatter via gray-matter ──
      try {
        const raw = await readFile(filePath, 'utf-8');
        const { data } = matter(raw);
        const meta = data as IArticleMeta;

        items.push({
          slug: stem,
          title: meta.title || stemToTitle(stem),
          date: meta.date || '',
          description: meta.description,
          cover_image: meta.cover_image,
          content_type: 'markdown',
        });
      } catch (err) {
        console.error(`Failed to parse Markdown ${entry.name}:`, err);
      }
    } else if (ext === '.pdf') {
      // ── PDF: generate metadata from filename + fs stats ──
      try {
        const stats = await stat(filePath);
        items.push({
          slug: stem,
          title: stemToTitle(stem),
          date: fmtDate(stats.mtime),
          description: 'PDF Документ / Руководство',
          content_type: 'pdf',
          file_url: `${STATIC_MOUNT}/${entry.name}`,
        });
      } catch (err) {
        console.error(`Failed to stat PDF ${entry.name}:`, err);
      }
    }
  }

  // Sort by date descending (newest first); items without dates go last
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return items;
}

/**
 * Find a single article by slug, checking both .md and .pdf.
 */
async function findArticle(slug: string): Promise<{
  item: IArticleItem;
  filePath: string;
} | null> {
  for (const ext of ['.md', '.pdf']) {
    const filePath = join(ARTICLES_DIR, `${slug}${ext}`);
    if (existsSync(filePath)) {
      const items = await scanArticles();
      const found = items.find(i => i.slug === slug);
      if (found) return { item: found, filePath };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Express Application
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());

// ── Static file serving for PDFs ──
app.use(STATIC_MOUNT, express.static(ARTICLES_DIR));

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/articles — Unified feed
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v1/articles', async (_req: Request, res: Response) => {
  try {
    const articles = await scanArticles();
    res.json({
      status: 'success',
      total: articles.length,
      articles,
    });
  } catch (err: any) {
    console.error('Error scanning articles:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to scan articles directory.',
      detail: err?.message || String(err),
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/v1/articles/:slug — Single article
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v1/articles/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug?.trim();
    if (!slug) {
      return res.status(400).json({ status: 'error', message: 'Slug is required.' });
    }

    const found = await findArticle(slug);
    if (!found) {
      return res.status(404).json({
        status: 'error',
        message: `Article not found: "${slug}"`,
      });
    }

    const { item, filePath } = found;

    if (item.content_type === 'pdf') {
      // PDF — return metadata with file_url (frontend can open the static URL)
      return res.json({
        status: 'success',
        article: {
          ...item,
          message: 'This is a PDF document. Open the file_url to view/download.',
        },
      });
    }

    // Markdown — read, parse frontmatter, render to HTML
    const raw = await readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);
    const html = await marked.parse(content);

    const detail: IArticleDetail = {
      ...item,
      title: (data as IArticleMeta).title || item.title,
      date: (data as IArticleMeta).date || item.date,
      description: (data as IArticleMeta).description,
      cover_image: (data as IArticleMeta).cover_image,
      html_content: html,
      raw_body: content,
    };

    res.json({ status: 'success', article: detail });
  } catch (err: any) {
    console.error(`Error reading article "${req.params.slug}":`, err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to read article.',
      detail: err?.message || String(err),
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Health + Root
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'Articles Content Server v1.0.0' });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Articles Content Server API',
    endpoints: {
      feed: '/api/v1/articles',
      article: '/api/v1/articles/:slug',
      static: '/static/articles/*.pdf',
    },
    health: '/health',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Startup
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`📚 Articles Content Server running on http://localhost:${PORT}`);
  console.log(`   Feed:   http://localhost:${PORT}/api/v1/articles`);
  console.log(`   Static: http://localhost:${PORT}/static/articles/`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
