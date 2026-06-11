import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join, basename, extname } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const ARTICLES_DIR = resolve('D:/BodyBuildHealth', 'content', 'articles');

function stemToTitle(stem: string): string {
  return stem.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}
function fmtDate(d: Date): string { return d.toISOString().slice(0, 10); }

async function scan() {
  const entries = await readdir(ARTICLES_DIR, { withFileTypes: true });
  const items: any[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    const stem = basename(entry.name, ext);
    const filePath = join(ARTICLES_DIR, entry.name);
    if (ext === '.md') {
      const raw = await readFile(filePath, 'utf-8');
      const { data } = matter(raw);
      items.push({
        slug: stem, title: data.title || stemToTitle(stem),
        date: data.date || '', description: data.description,
        content_type: 'markdown',
      });
    } else if (ext === '.pdf') {
      const st = await stat(filePath);
      items.push({
        slug: stem, title: stemToTitle(stem),
        date: fmtDate(st.mtime), description: 'PDF Документ / Руководство',
        content_type: 'pdf', file_url: `/static/articles/${entry.name}`,
      });
    }
  }
  items.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
  return items;
}

async function main() {
  console.log('Articles dir:', ARTICLES_DIR);
  const articles = await scan();
  console.log('Total:', articles.length);
  for (const a of articles) {
    console.log(`  [${a.content_type}] ${a.slug} | ${a.date} | ${a.title}`);
  }

  // Test markdown rendering
  const raw = await readFile(join(ARTICLES_DIR, 'trenbolone-kidneys.md'), 'utf-8');
  const { data, content } = matter(raw);
  const html = await marked.parse(content.slice(0, 200));
  console.log('\nMarkdown rendered (first 100 chars):', html.slice(0, 100));
}

main().catch(console.error);
