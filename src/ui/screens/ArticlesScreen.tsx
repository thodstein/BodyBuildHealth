import React, { useMemo, useState } from 'react';
import { HeroImg } from '../HeroImg';
import { getSortedArticles, type ArticleManifestEntry, ARTICLES_MANIFEST } from '../../data/articles-manifest';
import { isNativeApp } from '../../core/app-platform';
import { NativeIcon, type NativeIconName } from '../native/NativeIcons';
import { makeFill } from '../native/accent';

/** Читалка/хром за акцентом темы; категории — свои семантические цвета. */
const ART_ACC = 'var(--article-accent, #00e68a)';
const ART_RGB = 'var(--article-accent-rgb, 0,230,138)';
// Лениво: прямой вызов на топ-левеле ронял прод-билд (TDZ — makeFill живёт
// в main-чанке; порядок evaluation чанков не гарантирован).
let artACache: ((alpha: number) => string) | null = null;
const artA = (alpha: number): string => {
  if (!artACache) artACache = makeFill(ART_RGB);
  return artACache(alpha);
};

const SAVED_KEY = 'he_articles_saved_v1';
const LAST_KEY = 'he_articles_last_v1';

const RECENT_KEY = 'he_articles_recent_v1';
const RECENT_CAP = 5;

export function loadRecentArticleIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v.filter(x => typeof x === 'string').slice(0, RECENT_CAP);
    }
    // миграция со старого одиночного ключа
    const legacy = localStorage.getItem(LAST_KEY) || '';
    if (legacy) {
      const seeded = [legacy];
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(seeded));
      } catch {
        /* quota — только сессия */
      }
      return seeded;
    }
  } catch {
    /* битый стор → пусто */
  }
  return [];
}

export function pushRecentArticleId(id: string, prev: string[] = loadRecentArticleIds()): string[] {
  const next = [id, ...prev.filter(x => x !== id)].slice(0, RECENT_CAP);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota — только сессия */
  }
  return next;
}

export function loadLastArticleId(): string {
  return loadRecentArticleIds()[0] || '';
}

export function lastArticleEntry(): ArticleManifestEntry | null {
  const id = loadLastArticleId();
  if (!id) return null;
  return ARTICLES_MANIFEST.find(a => a.id === id) || null;
}

export function loadSavedArticles(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function toggleSavedArticle(id: string): string[] {
  const cur = loadSavedArticles();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next.slice(0, 200)));
  } catch {
    /* quota — состояние останется в памяти */
  }
  return next;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";

const CATEGORIES = [
  { value: 'all', label: 'Все', color: '#8b5cf6' },
  { value: 'pharma', label: 'Фарма', color: '#f97316' },
  { value: 'labs', label: 'Анализы', color: '#3b82f6' },
  { value: 'training', label: 'Тренировки', color: '#00e68a' },
  { value: 'nutrition', label: 'Питание', color: '#eab308' },
  { value: 'support', label: 'Поддержка', color: '#a855f7' },
] as const;

const ARTICLE_SECTIONS: { id: string; icon: NativeIconName; title: string; desc: string; color: string }[] = [
  { id: 'new', icon: 'zap', title: 'Новые статьи', desc: 'Последние добавленные', color: '#00e68a' },
  { id: 'recommended', icon: 'star', title: 'Рекомендуемое', desc: 'Подборка под ваши темы', color: '#3b82f6' },
  { id: 'all', icon: 'bookOpen', title: 'Все статьи', desc: 'Полная библиотека', color: '#8b5cf6' },
];

const CAT_GRADIENT: Record<string, string> = {
  pharma: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
  labs: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  training: 'linear-gradient(135deg, #00e68a 0%, #059669 100%)',
  nutrition: 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)',
  support: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
  other: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
};

const CAT_ICON: Record<string, NativeIconName> = {
  pharma: 'pill',
  labs: 'flask',
  training: 'dumbbell',
  nutrition: 'leaf',
  support: 'shield',
};

function estimateReadTime(md: string): number {
  const words = md.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

const READER_FONT_KEY = 'he_articles_font_v1';
const READER_FONT_STEPS = [14, 16, 18];
function loadReaderFont(): number {
  try {
    const v = parseInt(localStorage.getItem(READER_FONT_KEY) || '', 10);
    return READER_FONT_STEPS.includes(v) ? v : 14;
  } catch {
    return 14;
  }
}

export function slugifyHeading(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9ё]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'sec';
}

export function extractArticleToc(md: string): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  const re = /^## (.+)$/gm;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(md || '')) && out.length < 12) {
    const title = m[1].trim();
    out.push({ id: `art-sec-${i}-${slugifyHeading(title)}`, title });
    i += 1;
  }
  return out;
}

/**
 * Честное «Рекомендуемое»: без бэкенда популярности не выдумываем —
 * ранжируем по недавнему чтению (та же категория +2, непрочитанное +1),
 * ties держат исходный порядок (свежие сверху). Без истории — как было.
 */
export function rankRecommended(list: ArticleManifestEntry[], recentIds: string[]): ArticleManifestEntry[] {
  if (recentIds.length === 0) return list;
  const cats = new Set(
    recentIds
      .map(id => ARTICLES_MANIFEST.find(a => a.id === id)?.category)
      .filter((c): c is ArticleManifestEntry['category'] => Boolean(c)),
  );
  const read = new Set(recentIds);
  return [...list].sort((a, b) => {
    const sa = (cats.has(a.category) ? 2 : 0) + (read.has(a.id) ? 0 : 1);
    const sb = (cats.has(b.category) ? 2 : 0) + (read.has(b.id) ? 0 : 1);
    return sb - sa;
  });
}

/**
 * Дубль заголовка: тело markdown часто начинается с `# <тот же титул>`,
 * а обложка читалки титул уже показывает. Срезаем только точное
 * совпадение (нормализованное) — похожие, но другие заголовки живут.
 */
export function stripDuplicateTitle(md: string, title: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const lines = (md || '').split('\n');
  const idx = lines.findIndex(l => l.trim().length > 0);
  if (idx >= 0) {
    const m = lines[idx].match(/^#\s+(.+)$/);
    if (m && norm(m[1]) === norm(title)) return [...lines.slice(0, idx), ...lines.slice(idx + 1)].join('\n');
  }
  return md;
}

export function highlightMatch(text: string, q: string): React.ReactNode {
  const query = (q || '').trim();
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (<>
    {text.slice(0, idx)}
    <mark style={{ background:artA(0.35), color:'#fff', borderRadius:4, padding:'0 2px' }}>{text.slice(idx, idx + query.length)}</mark>
    {text.slice(idx + query.length)}
  </>);
}

export function renderMarkdown(md: string, bodyPx = 14): string {
  // Вся мелкая типографика масштабируется от кегля читалки (A−/A+):
  // при дефолте 14 все значения совпадают с прежними.
  const liPx = bodyPx - 1;
  const smPx = bodyPx - 2;
  const h3Px = bodyPx + 3;
  let h2Seen = false;
  let h3Idx = 0;
  let html = md
    .replace(/^### (.+)$/gm, (_, h) =>
      `<h4 style="font-size:${liPx}px;font-weight:800;color:#a78bfa;margin:22px 0 8px;letter-spacing:-0.01em;border-left:3px solid ${ART_ACC};padding-left:10px">${h}</h4>`)
    .replace(/^## (.+)$/gm, (_, h) => {
      const id = `art-sec-${h3Idx}-${slugifyHeading(h)}`;
      h3Idx += 1;
      return `<h3 id="${id}" style="font-size:${h3Px}px;font-weight:800;color:#fff;margin:26px 0 4px;letter-spacing:-0.02em;display:flex;align-items:center;gap:8px"><span style="width:22px;height:22px;border-radius:7px;background:${artA(0.12)};border:1px solid ${artA(0.22)};display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:${ART_ACC};flex-shrink:0">§</span>${h}</h3>`;
    })
    .replace(/^# (.+)$/gm, (_, h) => {
      h2Seen = false;
      void h2Seen;
      return `<h2 style="font-size:22px;font-weight:900;color:#fff;margin:6px 0 12px;letter-spacing:-0.03em;line-height:1.15">${h}</h2>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:700">$1</strong>')
    .replace(/`([^`]+?)`/g, '<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.86em;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.10);padding:1px 6px;border-radius:6px;color:#fff">$1</code>')
    .replace(/\[([^\]]+?)\]\((https?:[^)]+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:' + ART_ACC + ';font-weight:700;text-decoration:underline;text-underline-offset:3px">$1</a>')
    .replace(/(^|\s)\*(.+?)\*/g, '$1<em style="color:#fff;font-style:italic">$2</em>');

  const tables: string[] = [];
  let inTable = false;
  html = html.split('\n').map(line => {
    if (/^\|(.+)\|$/.test(line.trim())) {
      const cells = line.split('|').filter(c => c.trim());
      if (cells.every(c => /^[-: ]+$/.test(c))) return '';
      if (!inTable) {
        inTable = true;
        const headerCells = line.split('|').filter(c => c.trim());
        const headerRow = '<tr>' + headerCells.map(c =>
          `<th style="padding:9px 12px;text-align:left;font-size:${smPx}px;font-weight:800;color:${ART_ACC};text-transform:uppercase;letter-spacing:0.06em;background:${artA(0.09)};border-bottom:1px solid ${artA(0.16)};white-space:nowrap">${c.trim()}</th>`
        ).join('') + '</tr>';
        return `<div style="overflow-x:auto;margin:14px -4px 0;padding:0 4px;-webkit-overflow-scrolling:touch"><table style="width:100%;min-width:480px;border-collapse:collapse;border-radius:12px;overflow:hidden;font-size:${smPx}px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"><thead>${headerRow}</thead><tbody>`;
      }
      return '<tr>' + cells.map((c, i) =>
        `<td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:${smPx}px;line-height:1.5;${i === 0 ? 'font-weight:700;color:#fff' : 'color:#fff'}">${c.trim()}</td>`
      ).join('') + '</tr>';
    } else {
      if (inTable) {
        inTable = false;
        return '</tbody></table></div>\n' + line;
      }
      return line;
    }
  }).join('\n');
  if (inTable) html += '</tbody></table></div>';

  // NOTE: чеклисты ДО списков — иначе `^- ` заворачивает `- [ ]` в <li>
  // с тире-префиксом и чекбокс-паттерны (дефис) больше не матчатся.
  html = html
    .replace(/^- \[ \] (.+)$/gm, (_, t) =>
      `<span style="display:inline-flex;align-items:center;gap:8px;margin:5px 0;font-size:${smPx}px;line-height:1.5;color:#fff"><span style="width:16px;height:16px;border-radius:5px;border:1.5px solid rgba(255,255,255,0.25);display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0"></span>${t}</span><br/>`)
    .replace(/^- \[x\] (.+)$/gm, (_, t) =>
      `<span style="display:inline-flex;align-items:center;gap:8px;margin:5px 0;font-size:${smPx}px;line-height:1.5;color:${ART_ACC}"><span style="width:16px;height:16px;border-radius:5px;background:${ART_ACC};display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;color:#000;font-weight:900">✓</span>${t}</span><br/>`)
    .replace(/^- (.+)$/gm, (_, item) =>
      `<li style="margin:6px 0;font-size:${liPx}px;line-height:1.6;color:#fff;position:relative;padding-left:4px">— ${item}</li>`)
    .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:12px 0;padding:0;list-style:none">${m}</ul>`)
    .replace(/^---$/gm, `<hr style="border:none;height:1px;background:linear-gradient(90deg,transparent,${artA(0.22)},transparent);margin:22px 0"/>`);
  // NOTE: `\n\n` в спейсеры — ПОСЛЕ оборачивания абзацев в <p> (иначе строки
  // склеиваются в одну и лид-абзац не выделяется).

  html = html
    .replace(/^\d+\. (.+)$/gm, (_, item) =>
      `<li data-num="1" style="margin:7px 0;font-size:${liPx + 0.5}px;line-height:1.65;color:#fff;padding-left:4px">◆ ${item}</li>`)
    .replace(/^> ⚠(.+)$/gm, (_, q) =>
      `<blockquote style="margin:16px 0;padding:12px 14px;background:rgba(239,68,68,0.08);border-left:3px solid #f87171;border-radius:10px;font-size:${liPx}px;color:#fff;line-height:1.6">⚠${q}</blockquote>`)
    .replace(/^> 💡(.+)$/gm, (_, q) =>
      `<blockquote style="margin:16px 0;padding:12px 14px;background:rgba(234,179,8,0.08);border-left:3px solid #eab308;border-radius:10px;font-size:${liPx}px;color:#fff;line-height:1.6">💡${q}</blockquote>`)
    .replace(/^> (.+)$/gm, (_, q) =>
      `<blockquote style="margin:16px 0;padding:12px 14px;background:${artA(0.07)};border-left:3px solid ${ART_ACC};border-radius:10px;font-size:${liPx}px;color:#fff;line-height:1.6;backdrop-filter:blur(8px)">${q}</blockquote>`);

  // Обычные текстовые строки → <p>; первый абзац после заголовка — лид (крупнее, акцентная полоса).
  let leadDone = false;
  html = html.split('\n').map(line => {
    const t = line.trim();
    if (!t || t.startsWith('<') || t.startsWith('</') || t.startsWith('◆') || t.startsWith('—')) return line;
    if (/^(#{1,4}\s|[-*>|]|\d+\.)/.test(t)) return line;
    if (t.length < 2) return line;
    if (!leadDone && t.length > 40) {
      leadDone = true;
      return `<p style="font-size:${bodyPx + 2}px;line-height:1.7;color:#fff;font-weight:500;margin:10px 0 14px;padding-left:12px;border-left:3px solid ${ART_ACC}">${t}</p>`;
    }
    return `<p style="font-size:${bodyPx}px;line-height:1.8;color:#fff;margin:9px 0">${t}</p>`;
  }).join('\n');
  html = html.replace(/\n\n/g, '<div style="height:8px"></div>');

  return `<div className="articles-md" style="line-height:1.8;font-size:${bodyPx}px;color:#fff">${html}</div>`;
}

export const ArticlesScreen: React.FC = () => {
  const [page, setPage] = useState<'hero' | 'list'>('hero');
  const [listSection, setListSection] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [readingArticle, setReadingArticle] = useState<ArticleManifestEntry | null>(null);
  const [pdfViewer, setPdfViewer] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState<string>('PDF-документ');
  const [saved, setSaved] = useState<string[]>(() => loadSavedArticles());
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentArticleIds());

  const rememberLast = (id: string) => {
    if (!id) return;
    setRecent(pushRecentArticleId(id));
    try {
      localStorage.setItem(LAST_KEY, id);
    } catch {
      /* quota — только сессия */
    }
  };

  React.useEffect(() => {
    if (readingArticle?.id) rememberLast(readingArticle.id);
  }, [readingArticle?.id]);
  const [readerFont, setReaderFont] = useState<number>(() => loadReaderFont());
  const [readProgress, setReadProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const readerBodyRef = React.useRef<HTMLDivElement | null>(null);
  const changeReaderFont = (delta: number) => {
    setReaderFont(prev => {
      const i = Math.max(0, Math.min(READER_FONT_STEPS.length - 1, READER_FONT_STEPS.indexOf(prev) + delta));
      const next = READER_FONT_STEPS[i];
      try { localStorage.setItem(READER_FONT_KEY, String(next)); } catch { /* quota — только сессия */ }
      return next;
    });
  };
  const onReaderScroll = () => {
    const el = readerBodyRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setReadProgress(max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0);
    setShowTop(el.scrollTop > 400);
  };

  const scrollReaderTop = () => {
    const el = readerBodyRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') {
      try {
        el.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      } catch {
        /* fallthrough — старый WebView */
      }
    }
    el.scrollTop = 0;
  };
  const [offline, setOffline] = useState(() => {
    try {
      return typeof navigator !== 'undefined' && navigator.onLine === false;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    setReadProgress(0);
    setShowTop(false);
    readerBodyRef.current?.scrollTo?.(0, 0);
  }, [readingArticle?.id]);

  React.useEffect(() => {
    if (!isNativeApp()) return;
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const articles = useMemo(() => {
    let list = getSortedArticles();
    if (listSection === 'new') list = list.slice(0, 3);
    else if (listSection === 'recommended') list = rankRecommended(list, recent);
    if (category === 'saved') list = list.filter(a => saved.includes(a.id));
    else if (category !== 'all') list = list.filter(a => a.category === category);
    if (search.trim()) {
      const q = search.toLowerCase().replace(/^#+/, '');
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.includes(q)) ||
        (a.content || '').toLowerCase().includes(q)
      );
    }
    // Сортировка: в «Новых» всегда свежие сверху по определению, иначе — по переключателю.
    if (sortDir === 'asc' && listSection !== 'new') list = [...list].reverse();
    return list;
  }, [category, search, listSection, saved, sortDir, recent]);

  const openPDFExternal = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(window.location.origin + url);
    } else {
      window.open(url, '_blank');
    }
  };

  const openPDF = (url: string, title?: string, id?: string) => {
    setPdfTitle(title || 'PDF-документ');
    setPdfViewer(url);
    if (id) rememberLast(id);
  };

  const resumeEntry = (a: ArticleManifestEntry) => {
    setPage('list');
    if (a.content_type === 'pdf') openPDF(a.file_url || '', a.title, a.id);
    else setReadingArticle(a);
  };

  /** Единая точка открытия: PDF — в inline-просмотр, markdown — в читалку. */
  const activateArticle = (a: ArticleManifestEntry) => {
    if (a.content_type === 'pdf') {
      setReadingArticle(null);
      openPDF(a.file_url || '', a.title, a.id);
    } else {
      setReadingArticle(a);
    }
  };

  const activateKeyDown = (a: ArticleManifestEntry) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateArticle(a);
    }
  };

  const copyArticleLink = async (a: ArticleManifestEntry) => {
    const text = `${a.title} — Health Engine · Статьи`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const scrollToToc = (id: string) => {
    const root = readerBodyRef.current;
    if (!root) return;
    const el = root.querySelector(`#${CSS.escape(id)}`);
    if (el && (el as HTMLElement).scrollIntoView) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToList = (section: string) => {
    setListSection(section);
    setPage('list');
  };

  if (page === 'hero') {
    return (
      <div className="articles-hero" style={{ position:'fixed', inset:0, width:'100%', height:'100dvh', minHeight:'100dvh', zIndex:100, display:'flex', flexDirection:'column', fontFamily: FONT, overflow:'hidden', background:'#07070a' }}>
        <HeroImg webp="/articles-hero.webp?v=20250827h" src="/articles-hero.png?v=20250827h" alt="" onError={e=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} className="hero-fullscreen-img" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center center', background:'#07070a' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 62%, rgba(0,0,0,0.18) 76%, rgba(0,0,0,0.58) 88%, rgba(0,0,0,0.78) 100%)' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'12px 12px calc(64px + env(safe-area-inset-bottom,0px))', gap:10, overflowY:'auto' }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:20, background:`${artA(0.14)}`, border:`1px solid ${artA(0.22)}`, color:ART_ACC, fontSize:9, fontWeight:800, letterSpacing:'0.4px' }}>
              <span style={{ width:5, height:5, borderRadius:5, background:ART_ACC, boxShadow:`0 0 8px ${artA(0.6)}`, display:'inline-block' }} /> БАЗА ЗНАНИЙ
            </div>
            <h1 className="articles-hero-title" style={{ fontSize:22, fontWeight:900, color:'#fff', margin:'8px 0 4px', textShadow:'0 2px 12px rgba(0,0,0,0.9)', letterSpacing:'-0.6px', lineHeight:1 }}>Статьи</h1>
            <p className="articles-hero-sub" style={{ fontSize:11, color:'#fff', margin:0, lineHeight:1.4, textShadow:'0 1px 6px rgba(0,0,0,0.8)', maxWidth:480 }}>Фармакология · Анализы · Тренировки · Питание · Поддержка — концентрат практики и науки</p>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>{ARTICLES_MANIFEST.length} материалов</span>
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>{CATEGORIES.length - 1} категорий</span>
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:`1px solid ${artA(0.16)}`, color:ART_ACC }}>Еженедельно</span>
            </div>
          </div>
          <div className="articles-hero-cards" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ARTICLE_SECTIONS.map(s => (
              <div key={s.id} role="button" tabIndex={0} onClick={() => goToList(s.id)} className="articles-hero-card" data-id={s.id} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); goToList(s.id); }}} onMouseEnter={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.borderColor=`${s.color}40`; (e.currentTarget as HTMLDivElement).style.boxShadow=`0 6px 18px rgba(0,0,0,0.32), 0 0 0 1px ${s.color}18 inset`; }} onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.12)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 3px 12px rgba(0,0,0,0.30)'; }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 3px 12px rgba(0,0,0,0.30)', background:'rgba(18,18,20,0.62)', transition:'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease' }}>
                <div style={{ width:38, height:38, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`linear-gradient(135deg, ${s.color}22, ${s.color}10)`, border:`1px solid ${s.color}28`, color:s.color, boxShadow:`0 3px 10px ${s.color}20`, position:'relative' }}><NativeIcon name={s.icon} size={19} /></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:800, marginBottom:2, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.2 }}>{s.title}</div>
                  <div style={{ fontSize:10.5, color:'#fff', lineHeight:1.3 }}>{s.desc} · {s.id === 'new' ? Math.min(3, ARTICLES_MANIFEST.length) : ARTICLES_MANIFEST.length} ст.</div>
                </div>
                <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${s.color}12`, border:`1px solid ${s.color}18`, color:s.color, fontSize:13, flexShrink:0, fontWeight:700 }}>→</span>
              </div>
            ))}
            {(() => {
              const entries = recent
                .map(id => ARTICLES_MANIFEST.find(a => a.id === id))
                .filter((a): a is ArticleManifestEntry => Boolean(a));
              const last = entries[0];
              const tail = entries.slice(1, 3);
              if (!last) return null;
              const catColor = CATEGORIES.find(c => c.value === last.category)?.color || '#6b7280';
              return (<>
                <div key="continue" role="button" tabIndex={0} onClick={() => resumeEntry(last)}
                  className="articles-hero-continue" data-id="continue"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resumeEntry(last); } }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%', border:`1px solid ${artA(0.30)}`, boxShadow:`0 3px 12px rgba(0,0,0,0.30), 0 0 16px ${artA(0.12)}`, background:'rgba(18,18,20,0.72)' }}>
                  <div style={{ width:38, height:38, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`linear-gradient(135deg, ${artA(0.22)}, ${artA(0.08)})`, border:`1px solid ${artA(0.30)}`, color:ART_ACC, fontSize:16, fontWeight:900 }}>▶</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:ART_ACC, textTransform:'uppercase', letterSpacing:'0.08em' }}>Продолжить чтение</div>
                    <div style={{ fontSize:13, fontWeight:800, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.25, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{last.title}</div>
                  </div>
                  <span style={{ minHeight:44, display:'inline-flex', alignItems:'center', padding:'10px 16px', borderRadius:999, background:ART_ACC, color:'#000', fontSize:12, fontWeight:800, flexShrink:0 }}>Читать</span>
                </div>
                {tail.length > 0 && (
                  <div className="articles-hero-recent" style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#fff', opacity:0.6, textTransform:'uppercase', letterSpacing:'0.08em', paddingLeft:4 }}>Недавно</div>
                    {tail.map(a => (
                      <div key={`recent-${a.id}`} role="button" tabIndex={0} onClick={() => resumeEntry(a)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resumeEntry(a); } }}
                        className="articles-hero-recent-item"
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:12, cursor:'pointer', background:'rgba(18,18,20,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
                        <span style={{ color:ART_ACC, fontSize:12, fontWeight:800, flexShrink:0 }}>↺</span>
                        <span style={{ flex:1, minWidth:0, fontSize:12, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</span>
                        <span style={{ color:'#fff', opacity:0.6, fontSize:12, fontWeight:800, flexShrink:0 }}>→</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen articles-list" style={{ fontFamily: FONT, paddingBottom: 'calc(20px + 72px + env(safe-area-inset-bottom,0px))', background:'transparent' }}>
      {/* premium toolbar — APK PRO: 56px, тач 44px */}
      <div className="articles-toolbar" style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 10px', flexShrink:0, minHeight:56, position:'sticky', top:0, zIndex:20, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', background:'rgba(10,10,15,0.86)', margin:'-6px -6px 0', paddingLeft:6, paddingRight:6, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => setPage('hero')} aria-label="Назад к категориям" style={{
          minHeight:44, padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:800,
          color:'#fff', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.07)',
          borderRadius:999, display:'flex', alignItems:'center', gap:6,
          backdropFilter:'blur(10px)', transition:'all 0.18s',
        }}
        onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.14)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; }}
        >← Категории</button>
        <div style={{ flex:1 }} />
        {isNativeApp() && offline && (
          <span className="articles-offline" style={{ fontSize:12, fontWeight:800, color:'#fff', background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.26)', padding:'7px 12px', borderRadius:999 }}>Офлайн · читалка доступна</span>
        )}
        <span style={{ fontSize:12, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', padding:'7px 12px', borderRadius:999 }}>{articles.length} ст.</span>
      </div>

      {/* Фильтры — липкая панель: поиск + категории всегда под рукой */}
      <div className="articles-filterbar" style={{ position:'sticky', top:64, zIndex:15, margin:'0 -6px 12px', padding:'10px 6px 8px', background:'rgba(10,10,15,0.88)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      {/* Search bar — glass */}
      <div style={{ position:'relative', marginBottom:8 }}>
        <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:15, height:15, color:'#fff', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round' }} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск — заголовок, тег или слово из текста..." className="articles-search" style={{
            width:'100%', minHeight:48, padding:'12px 44px 12px 38px', borderRadius:14,
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)',
            color:'#fff', fontSize:16, outline:'none', fontFamily: FONT,
            backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
            boxShadow:'0 6px 22px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
            transition:'border-color 0.2s, box-shadow 0.2s',
            boxSizing:'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,230,138,0.38)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.22), 0 0 0 3px rgba(0,230,138,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)'; }}
        />
        {search && (
          <button onClick={()=>setSearch('')} aria-label="Очистить поиск" style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', minWidth:36, height:36, borderRadius:999, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800 }}>✕</button>
        )}
      </div>

      {/* Category chips — APK PRO: тач 44px, скролл-лента */}
      <div className="articles-chips" style={{ display:'flex', gap:8, flexWrap:'nowrap', overflowX:'auto', paddingBottom:2, scrollbarWidth:'none' }}>
        {/* «Сохранённые» — только native: контракт волны D (офлайн-фича АПК), тест home-profile-shop-native */}
        {isNativeApp() && (
          <button key="saved" onClick={() => setCategory('saved')} className="article-chip" data-active={category === 'saved'} aria-label="Сохранённые статьи" style={{
            minHeight:44, padding:'10px 16px', borderRadius:999, fontSize:13, cursor:'pointer', fontFamily: FONT, flexShrink:0, whiteSpace:'nowrap',
            background: category === 'saved' ? 'linear-gradient(135deg, rgba(var(--accent-rgb, 0,230,138),0.18), rgba(var(--accent-rgb, 0,230,138),0.08))' : 'rgba(255,255,255,0.06)',
            color: '#fff',
            border: `1px solid ${category === 'saved' ? 'rgba(var(--accent-rgb, 0,230,138),0.40)' : 'rgba(255,255,255,0.10)'}`,
            boxShadow: category === 'saved' ? '0 0 14px rgba(0,230,138,0.25)' : 'none',
            fontWeight: 800,
            transition:'all 0.18s', letterSpacing:'-0.01em',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{ display:'inline-flex', color:ART_ACC }}><NativeIcon name="bookmark" size={13} /></span>
            Сохранённые{saved.length > 0 ? ` · ${saved.length}` : ''}
          </button>
        )}
        {CATEGORIES.map(c => {
          const isActive = category === c.value;
          const catCount = c.value === 'all' ? ARTICLES_MANIFEST.length : ARTICLES_MANIFEST.filter(x => x.category === c.value).length;
          return (
            <button key={c.value} onClick={() => setCategory(c.value)} className="article-chip" data-active={isActive} style={{
              minHeight:44, padding:'10px 16px', borderRadius:999, fontSize:13, cursor:'pointer', fontFamily: FONT, flexShrink:0, whiteSpace:'nowrap',
              background: isActive ? `linear-gradient(135deg, ${c.color}26, ${c.color}12)` : 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: `1px solid ${isActive ? c.color+'55' : 'rgba(255,255,255,0.10)'}`,
              fontWeight: 800,
              backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
              boxShadow: isActive ? `0 0 14px ${c.color}30, inset 0 1px 0 rgba(255,255,255,0.08)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
              transition:'all 0.18s', letterSpacing:'-0.01em',
              display:'flex', alignItems:'center', gap:6,
            }}>
              {CAT_ICON[c.value] && <span style={{ display:'inline-flex', color: isActive ? c.color : '#fff' }}><NativeIcon name={CAT_ICON[c.value]} size={13} /></span>}
              {c.label} · {catCount}
            </button>
          );
        })}
      </div>
      </div>{/* /articles-filterbar */}

      {/* PDF Viewer — INLINE внутри приложения (iframe + фолбэк наружу) */}
      {pdfViewer && (
        <div className="articles-pdf" style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(6,6,10,0.94)', display:'flex', flexDirection:'column', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)', flexShrink:0 }}>
            <span style={{ fontWeight:800, fontSize:13, display:'flex', alignItems:'center', gap:7, letterSpacing:'-0.02em', color:'#fff', minWidth:0, flex:1, overflow:'hidden' }}>
              <span style={{ width:30, height:30, borderRadius:9, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.22)', display:'flex', alignItems:'center', justifyContent:'center', color:'#f87171', flexShrink:0 }}><NativeIcon name="file" size={14} /></span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pdfTitle}</span>
              <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.24)', color:'#fca5a5', flexShrink:0 }}>PDF · внутри</span>
            </span>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <a href={pdfViewer} download aria-label="Скачать PDF" className="articles-pdf-download"
                style={{ minHeight:44, padding:'10px 18px', borderRadius:999, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', fontWeight:800, fontSize:13, cursor:'pointer', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>⤓</a>
              <button onClick={() => openPDFExternal(pdfViewer)} aria-label="Открыть PDF в браузере" style={{ minHeight:44, padding:'10px 18px', borderRadius:999, background:ART_ACC, color:'#000', border:'none', fontWeight:800, fontSize:13, cursor:'pointer', boxShadow:`0 4px 14px ${artA(0.28)}` }}>↗ Браузер</button>
              <button onClick={() => setPdfViewer(null)} aria-label="Закрыть PDF" style={{ minWidth:44, minHeight:44, padding:'10px 14px', borderRadius:999, background:'rgba(255,255,255,0.07)', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', fontSize:14, fontWeight:800, cursor:'pointer' }}>✕</button>
            </div>
          </div>
          <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'#101014' }}>
            <iframe className="articles-pdf-frame" src={pdfViewer} title={pdfTitle} style={{ flex:1, width:'100%', minHeight:0, border:'none', background:'#fff' }} allowFullScreen />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 12px calc(10px + env(safe-area-inset-bottom,0px))', background:'rgba(10,10,15,0.92)', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
              <span style={{ fontSize:11, color:'#fff', fontWeight:600 }}>Не видно документ?</span>
              <button onClick={() => openPDFExternal(pdfViewer)} style={{ minHeight:44, padding:'10px 18px', borderRadius:999, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', fontWeight:800, fontSize:12, cursor:'pointer' }}>Открыть снаружи →</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen article reader — APK PRO */}
      {readingArticle && (
        <div className="articles-reader" style={{ position:'fixed', inset:0, zIndex:200, background:'#07070a', display:'flex', flexDirection:'column', fontFamily: FONT }}>
          <div className="articles-reader-bar" style={{ display:'flex', alignItems:'center', gap:10, minHeight:56, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0, background:'rgba(10,10,15,0.86)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)' }}>
            <button onClick={() => setReadingArticle(null)} aria-label="Назад к списку статей" style={{
              minWidth:44, height:44, borderRadius:999, cursor:'pointer',
              background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
              color:'#fff', fontSize:16, fontWeight:800,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>←</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:'-0.02em' }}>{readingArticle.title}</div>
              <div style={{ fontSize:12, color:'#fff', display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, marginTop:2, fontWeight:600 }}>
                <span style={{ color: CATEGORIES.find(c => c.value === readingArticle.category)?.color || '#6b7280', display:'inline-flex', verticalAlign:'-2px' }}>
                  <NativeIcon name={CAT_ICON[readingArticle.category] || 'file'} size={11} />
                </span>
                <span>{CATEGORIES.find(c => c.value === readingArticle.category)?.label || readingArticle.category}</span>
                <span style={{ opacity:0.35 }}>·</span>
                <span>{estimateReadTime(readingArticle.content || '')} мин</span>
                <span style={{ opacity:0.35 }}>·</span>
                <span>{readingArticle.date}</span>
              </div>
            </div>
            <span style={{ padding:'5px 10px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>{estimateReadTime(readingArticle.content||'')}′</span>
            <span className="articles-progress-label" style={{ padding:'5px 10px', borderRadius:999, background:`${artA(0.10)}`, border:`1px solid ${artA(0.22)}`, fontSize:11, fontWeight:800, color:ART_ACC, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{Math.round(readProgress)}%</span>
            <button
              onClick={() => copyArticleLink(readingArticle)}
              aria-label="Скопировать название статьи"
              title={copied ? 'Скопировано!' : 'Скопировать название'}
              style={{
                minWidth:44, height:44, borderRadius:999, cursor:'pointer', flexShrink:0,
                background: copied ? artA(0.18) : 'rgba(255,255,255,0.07)',
                border: copied ? `1px solid ${artA(0.40)}` : '1px solid rgba(255,255,255,0.12)',
                color: copied ? ART_ACC : '#fff',
                fontSize:14, display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >{copied ? '✓' : '⧉'}</button>
            {/* Закладка — только native: контракт волны D (см. чип выше) */}
            {isNativeApp() && (
            <button
              onClick={() => setSaved(toggleSavedArticle(readingArticle.id))}
              aria-label={saved.includes(readingArticle.id) ? 'Убрать из сохранённых' : 'Сохранить статью'}
              className="article-bookmark"
              data-active={saved.includes(readingArticle.id)}
              style={{
                minWidth:44, height:44, borderRadius:999, cursor:'pointer', flexShrink:0,
                background: saved.includes(readingArticle.id) ? 'rgba(var(--accent-rgb, 0,230,138),0.18)' : 'rgba(255,255,255,0.07)',
                border: saved.includes(readingArticle.id) ? '1px solid rgba(var(--accent-rgb, 0,230,138),0.40)' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: saved.includes(readingArticle.id) ? '0 0 14px rgba(0,230,138,0.30)' : 'none',
                color: saved.includes(readingArticle.id) ? 'var(--accent, #00e68a)' : '#fff',
                fontSize:14, display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >{saved.includes(readingArticle.id) ? <NativeIcon name="bookmark" size={17} filled /> : <NativeIcon name="bookmark" size={17} />}</button>
            )}
          </div>

          <div className="articles-progress" aria-hidden="true" style={{ height:3, background:'rgba(255,255,255,0.07)', flexShrink:0 }}>
            <div style={{ width:`${readProgress}%`, height:'100%', background:ART_ACC, borderRadius:999, boxShadow:`0 0 8px ${artA(0.5)}`, transition:'width 0.12s linear' }} />
          </div>

          <div ref={readerBodyRef} onScroll={onReaderScroll} className="articles-reader-body" style={{ flex:1, overflow:'auto', padding:'0 0 120px', maxWidth: 720, width:'100%', margin:'0 auto' }}>
            {(() => {
              const catColor = CATEGORIES.find(c=>c.value===readingArticle.category)?.color || '#6b7280';
              const catLabel = CATEGORIES.find(c=>c.value===readingArticle.category)?.label || readingArticle.category;
              const toc = extractArticleToc(readingArticle.content || '');
              const mins = estimateReadTime(readingArticle.content || '');
              const initial = (readingArticle.authorName || 'H').trim().charAt(0).toUpperCase();
              return (<>
            {/* Обложка статьи — журнальная шапка */}
            <div style={{ margin:'12px 12px 0', borderRadius:20, overflow:'hidden', border:'1px solid rgba(255,255,255,0.09)', background:`linear-gradient(135deg, ${catColor}2e 0%, rgba(16,16,22,0.9) 55%, rgba(10,10,15,0.95) 100%)`, boxShadow:'0 14px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)', position:'relative' }}>
              <div aria-hidden="true" style={{ position:'absolute', inset:0, background:`radial-gradient(420px 130px at 12% 0%, ${catColor}30, transparent 65%), radial-gradient(300px 120px at 95% 100%, ${catColor}18, transparent 60%)`, pointerEvents:'none' }} />
              <div style={{ position:'relative', padding:'16px 16px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                  <button onClick={() => { setReadingArticle(null); setSearch(''); setCategory(readingArticle.category); }}
                    aria-label={`Все статьи категории ${catLabel}`} className="articles-cover-cat"
                    style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:999, background:`${catColor}1c`, border:`1px solid ${catColor}33`, color:catColor, fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', cursor:'pointer', fontFamily:FONT, minHeight:44 }}>
                    <NativeIcon name={CAT_ICON[readingArticle.category] || 'file'} size={12} /> {catLabel} →
                  </button>
                  <span style={{ padding:'5px 11px', borderRadius:999, background:artA(0.10), border:`1px solid ${artA(0.22)}`, color:ART_ACC, fontWeight:800, fontSize:11 }}>⏱ {mins} мин</span>
                  <span style={{ padding:'5px 11px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', color:'#fff', fontWeight:700, fontSize:11 }}>📅 {readingArticle.date}</span>
                </div>
                <h1 style={{ fontSize:24, fontWeight:900, color:'#fff', margin:'0 0 8px', lineHeight:1.14, letterSpacing:'-0.03em' }}>
                  {readingArticle.title}
                </h1>
                <p style={{ fontSize:13, color:'#fff', margin:'0 0 12px', lineHeight:1.55, opacity:0.92 }}>{readingArticle.description}</p>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <span style={{ width:34, height:34, borderRadius:999, background:`linear-gradient(135deg, ${catColor}, ${catColor}88)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:900, fontSize:15, flexShrink:0 }}>{initial}</span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{readingArticle.authorName}</div>
                    <div style={{ fontSize:11, color:'#fff', opacity:0.75 }}>Проверено редакцией · Health Engine</div>
                  </div>
                </div>
              </div>
              <div style={{ height:3, background:`linear-gradient(90deg, ${catColor}, transparent)` }} />
            </div>
            {/* Содержание — якоря по разделам */}
            {toc.length > 0 && (
              <div className="articles-toc" style={{ margin:'12px 12px 0', padding:'12px', borderRadius:16, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#fff', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, opacity:0.85 }}>§ Содержание</div>
                <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2, scrollbarWidth:'none' }}>
                  {toc.map(t => (
                    <button key={t.id} onClick={() => scrollToToc(t.id)} style={{ flexShrink:0, minHeight:44, padding:'10px 14px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>{t.title}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ padding:'16px 16px 0' }}>
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(stripDuplicateTitle(readingArticle.content || '', readingArticle.title), readerFont) }} />
            </div>
              </>);
            })()}

            {readingArticle.tags.length > 0 && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:26, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                {readingArticle.tags.map(t => (
                  <span key={t} style={{
                    padding:'7px 13px', borderRadius:999, fontSize:12, fontWeight:700,
                    background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.08)',
                    backdropFilter:'blur(8px)',
                  }}>#{t}</span>
                ))}
              </div>
            )}

            {(() => {
              const order = articles.length > 0 ? articles : getSortedArticles();
              const idx = order.findIndex(a => a.id === readingArticle.id);
              const prev = idx > 0 ? order[idx - 1] : null;
              const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
              if (!prev && !next) return null;
              const openEntry = activateArticle;
              const btn = (a: ArticleManifestEntry | null, dir: 'prev' | 'next') => (
                <button key={dir} onClick={() => a && openEntry(a)} disabled={!a}
                  aria-label={dir === 'prev' ? 'Предыдущая статья' : 'Следующая статья'}
                  className={`articles-nav-${dir}`}
                  style={{ flex:1, minHeight:48, padding:'12px 14px', borderRadius:14, cursor: a ? 'pointer' : 'default',
                    background: a ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                    border:'1px solid rgba(255,255,255,0.09)', color:'#fff', fontSize:12, fontWeight:800,
                    opacity: a ? 1 : 0.35, textAlign: dir === 'prev' ? 'left' : 'right',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {dir === 'prev' ? `← ${a ? a.title.slice(0, 26) : 'Начало'}` : `${a ? a.title.slice(0, 26) : 'Конец'} →`}
                </button>
              );
              return (
                <div className="articles-nav" style={{ display:'flex', gap:8, marginTop:24 }}>
                  {btn(prev, 'prev')}
                  {btn(next, 'next')}
                </div>
              );
            })()}

            {(() => {
              const related = ARTICLES_MANIFEST.filter(a => a.id !== readingArticle.id && a.category === readingArticle.category).slice(0, 3);
              if (related.length === 0) return null;
              return (
                <div className="articles-related" style={{ marginTop:16, padding:'14px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#fff', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, opacity:0.85 }}>Читайте также</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {related.map(r => (
                      <div key={r.id} role="button" tabIndex={0} aria-label={r.title}
                        onClick={() => activateArticle(r)}
                        onKeyDown={activateKeyDown(r)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, cursor:'pointer', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`${CATEGORIES.find(c => c.value === r.category)?.color || '#6b7280'}1c`, border:`1px solid ${CATEGORIES.find(c => c.value === r.category)?.color || '#6b7280'}30`, color: CATEGORIES.find(c => c.value === r.category)?.color || '#6b7280' }}>
                          <NativeIcon name={CAT_ICON[r.category] || 'file'} size={14} />
                        </span>
                        <span style={{ flex:1, minWidth:0 }}>
                          <span style={{ display:'block', fontSize:12, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                          <span style={{ display:'block', fontSize:11, color:'#fff', opacity:0.7 }}>{r.content_type === 'pdf' ? 'PDF · внутри' : `${estimateReadTime(r.content || '')} мин`} · {r.date}</span>
                        </span>
                        <span style={{ color:'#fff', fontWeight:800, flexShrink:0 }}>→</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop:22, padding:'12px 14px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:32, height:32, borderRadius:999, background:`${artA(0.14)}`, border:`1px solid ${artA(0.20)}`, display:'flex', alignItems:'center', justifyContent:'center', color:ART_ACC, flexShrink:0, fontWeight:800 }}>✓</span>
              <span style={{ fontSize:12, color:'#fff', lineHeight:1.5 }}>Материал подготовлен командой Health Engine. Не является медицинской рекомендацией — проконсультируйтесь с врачом.</span>
            </div>
            <div style={{ marginTop:18, textAlign:'center', fontSize:11, color:'#fff' }}>
              Health Engine · {readingArticle.date}
            </div>
          </div>

          {/* Кнопка «Наверх» — видна после прокрутки */}
          {showTop && (
            <button onClick={scrollReaderTop} aria-label="Наверх к началу статьи" className="articles-top"
              style={{ position:'absolute', right:12, bottom:'calc(78px + env(safe-area-inset-bottom,0px))', zIndex:5, width:44, height:44, borderRadius:999, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(14,14,18,0.85)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:'0 10px 30px rgba(0,0,0,0.45)' }}>↑</button>
          )}

          {/* Плавающая панель размера шрифта — читабельность на телефоне */}
          <div className="articles-fontbar" style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:'calc(18px + env(safe-area-inset-bottom,0px))', zIndex:5, display:'flex', alignItems:'center', gap:4, padding:'5px', borderRadius:999, background:'rgba(14,14,18,0.82)', border:'1px solid rgba(255,255,255,0.10)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', boxShadow:'0 10px 30px rgba(0,0,0,0.45)' }}>
            <button onClick={() => changeReaderFont(-1)} disabled={readerFont <= READER_FONT_STEPS[0]} aria-label="Уменьшить шрифт" style={{ minWidth:44, height:44, borderRadius:999, border:'none', cursor:'pointer', background: readerFont <= READER_FONT_STEPS[0] ? 'transparent' : 'rgba(255,255,255,0.07)', color:'#fff', fontSize:15, fontWeight:800, opacity: readerFont <= READER_FONT_STEPS[0] ? 0.35 : 1 }}>A−</button>
            <span style={{ fontSize:12, fontWeight:800, color:'#fff', minWidth:44, textAlign:'center', fontVariantNumeric:'tabular-nums' }}>{readerFont}</span>
            <button onClick={() => changeReaderFont(1)} disabled={readerFont >= READER_FONT_STEPS[READER_FONT_STEPS.length - 1]} aria-label="Увеличить шрифт" style={{ minWidth:44, height:44, borderRadius:999, border:'none', cursor:'pointer', background: readerFont >= READER_FONT_STEPS[READER_FONT_STEPS.length - 1] ? 'transparent' : 'rgba(255,255,255,0.07)', color:'#fff', fontSize:15, fontWeight:800, opacity: readerFont >= READER_FONT_STEPS[READER_FONT_STEPS.length - 1] ? 0.35 : 1 }}>A+</button>
          </div>
        </div>
      )}

      {/* Empty state — premium */}
      {articles.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'44px 20px', gap:12, marginTop:10, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px dashed rgba(255,255,255,0.12)' }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'radial-gradient(120% 120% at 30% 20%, rgba(139,92,246,0.18), transparent 65%)', border:'1px solid rgba(139,92,246,0.18)', display:'flex', alignItems:'center', justifyContent:'center', color:'#a78bfa', boxShadow:'0 10px 28px rgba(139,92,246,0.14)' }}><NativeIcon name="inbox" size={26} /></div>
          <div style={{ fontSize:15, color:'#fff', fontWeight:800, letterSpacing:'-0.02em' }}>{category === 'saved' ? 'Пока пусто' : 'Статьи не найдены'}</div>
          <div style={{ fontSize:13, color:'#fff', textAlign:'center', maxWidth:300, lineHeight:1.5 }}>{category === 'saved' ? 'Откройте любую статью и нажмите ★ — она сохранится для офлайн-чтения.' : 'Попробуйте изменить запрос или сбросить фильтры — покажем всё снова.'}</div>
          <button onClick={() => { setSearch(''); setCategory('all'); }} style={{ marginTop:6, minHeight:44, padding:'10px 22px', borderRadius:999, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.07)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', backdropFilter:'blur(10px)' }}>Сбросить фильтры</button>
        </div>
      )}

      {/* Заголовок раздела — контекст выдачи */}
      {(() => {
        const title = category === 'saved' ? 'Сохранённые' : listSection === 'new' ? 'Новые статьи' : listSection === 'recommended' ? 'Рекомендуемое' : 'Все статьи';
        const catLabel = category !== 'all' && category !== 'saved' ? CATEGORIES.find(c => c.value === category)?.label : null;
        return (
          <div className="articles-list-title" style={{ margin:'2px 0 10px', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:17, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', lineHeight:1.2 }}>{title}</div>
            <div style={{ fontSize:12, color:'#fff', opacity:0.75, marginTop:2 }}>
              {catLabel ? `${catLabel} · ` : ''}{articles.length} ст.{listSection === 'new' && category === 'all' ? ' · свежие сверху' : ''}{listSection === 'recommended' && recent.length > 0 ? ' · под ваши темы' : ''}
            </div>
            </div>
            {listSection !== 'new' && (
              <button onClick={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
                aria-label="Порядок сортировки" className="articles-sort"
                style={{ minHeight:44, padding:'10px 16px', borderRadius:999, cursor:'pointer', flexShrink:0,
                  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)',
                  color:'#fff', fontSize:12, fontWeight:800, fontFamily:FONT }}>
                {sortDir === 'desc' ? '⇅ Новые' : '⇅ Старые'}
              </button>
            )}
          </div>
        );
      })()}

      {/* Featured — материал номера (без фильтров) */}
      {category === 'all' && !search.trim() && articles.length > 1 && (() => {
        const f = articles[0];
        const catColor = CATEGORIES.find(c => c.value === f.category)?.color || '#6b7280';
        const isPDF = f.content_type === 'pdf';
        return (
          <div key={`featured-${f.id}`} data-featured="true" role="button" tabIndex={0} aria-label={f.title}
            onClick={() => activateArticle(f)} onKeyDown={activateKeyDown(f)}
            className="articles-featured" style={{ borderRadius:20, overflow:'hidden', marginBottom:10, cursor:'pointer', position:'relative',
              background:`linear-gradient(135deg, ${catColor}30 0%, rgba(16,16,24,0.95) 55%, rgba(10,10,15,0.98) 100%)`,
              border:'1px solid rgba(255,255,255,0.10)', boxShadow:'0 16px 44px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)' }}>
            <div aria-hidden="true" style={{ position:'absolute', inset:0, background:`radial-gradient(480px 150px at 10% 0%, ${catColor}38, transparent 65%)`, pointerEvents:'none' }} />
            <div style={{ position:'relative', padding:'16px 16px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:10, fontWeight:900, letterSpacing:'0.1em', color:'#000', background:catColor, padding:'4px 10px', borderRadius:999 }}>★ МАТЕРИАЛ НОМЕРА</span>
                <span style={{ fontSize:11, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.10)', padding:'4px 10px', borderRadius:999 }}>{isPDF ? 'PDF · внутри' : `${estimateReadTime(f.content || '')}′ чтения`}</span>
              </div>
              <div style={{ fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.25, letterSpacing:'-0.02em', marginBottom:6 }}>{f.title}</div>
              <div style={{ fontSize:13, color:'#fff', lineHeight:1.55, marginBottom:12, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', opacity:0.92 }}>{f.description}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>{f.authorName.replace('Health Engine Team', 'HE Team')} · {f.date}</span>
                <span style={{ minHeight:44, display:'inline-flex', alignItems:'center', padding:'10px 18px', borderRadius:999, background:'#fff', color:'#000', fontSize:13, fontWeight:800 }}>{isPDF ? 'Открыть PDF внутри →' : 'Читать →'}</span>
              </div>
            </div>
            <div style={{ height:3, background:`linear-gradient(90deg, ${catColor}, transparent)` }} />
          </div>
        );
      })()}
      {/* Article cards — premium magazine grid (мобайл: 2 в ряд на 360, 1 на 320) */}
      <div className="articles-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10, marginBottom:8 }}>
        {(category === 'all' && !search.trim() && articles.length > 1 ? articles.slice(1) : articles).map(article => {
          const catColor = CATEGORIES.find(c => c.value === article.category)?.color || '#6b7280';
          const catIcon: NativeIconName = CAT_ICON[article.category] || 'file';
          const readTime = article.content ? estimateReadTime(article.content) : 0;
          const isPDF = article.content_type === 'pdf';

          return (
              <div key={article.id} role="button" tabIndex={0} aria-label={article.title}
                onClick={() => activateArticle(article)} onKeyDown={activateKeyDown(article)}
                className="articles-card" style={{
              borderRadius:16, overflow:'hidden',
              background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.07)',
              backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
              boxShadow:'0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
              transition:'all 0.22s cubic-bezier(0.2,0.9,0.4,1)',
              position:'relative', cursor:'pointer',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 36px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = catColor+'2a'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; }}
            >
              <div style={{ height:4, background: isPDF ? 'linear-gradient(90deg, #ef4444, #f97316)' : catColor, width:'100%', opacity:0.95 }} />
              {/* Быстрое ★ — только native (контракт волны D: сохранённые = офлайн-фича АПК) */}
              {isNativeApp() && (
                <button
                  onClick={e => { e.stopPropagation(); setSaved(toggleSavedArticle(article.id)); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                  aria-label={saved.includes(article.id) ? 'Убрать из сохранённых' : 'Сохранить статью'}
                  className="article-card-save"
                  data-active={saved.includes(article.id)}
                  style={{
                    position:'absolute', top:10, right:10, zIndex:2, width:44, height:44, borderRadius:999, cursor:'pointer',
                    background: saved.includes(article.id) ? 'rgba(var(--accent-rgb, 0,230,138),0.20)' : 'rgba(10,10,15,0.55)',
                    border: saved.includes(article.id) ? '1px solid rgba(var(--accent-rgb, 0,230,138),0.45)' : '1px solid rgba(255,255,255,0.14)',
                    backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
                    boxShadow: saved.includes(article.id) ? '0 0 14px rgba(0,230,138,0.30)' : '0 4px 14px rgba(0,0,0,0.35)',
                    color: saved.includes(article.id) ? 'var(--accent, #00e68a)' : '#fff',
                    fontSize:15, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                >{saved.includes(article.id) ? '★' : '☆'}</button>
              )}
              <div style={{ padding:'12px 12px 11px', position:'relative' }}>
                <div aria-hidden="true" style={{ position:'absolute', inset:0, background:`radial-gradient(520px 100px at 14% 0%, ${catColor}10, transparent 62%)`, pointerEvents:'none' }} />
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:8, position:'relative' }}>
                  <span style={{ fontSize:11, color:'#fff', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:5, background:`${catColor}14`, border:`1px solid ${catColor}26`, padding:'4px 9px', borderRadius:999, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    <NativeIcon name={catIcon} size={12} /> {CATEGORIES.find(c => c.value === article.category)?.label || article.category}
                  </span>
                  {isPDF ? (
                    <span style={{ fontSize:11, padding:'4px 9px', borderRadius:999, background:'rgba(239,68,68,0.14)', color:'#fff', fontWeight:800, border:'1px solid rgba(239,68,68,0.24)', flexShrink:0 }}>PDF</span>
                  ) : (
                    <span style={{ fontSize:11, padding:'4px 9px', borderRadius:999, background:`${artA(0.12)}`, color:'#fff', fontWeight:800, border:`1px solid ${artA(0.20)}`, flexShrink:0 }}>{readTime}′</span>
                  )}
                </div>

                <div style={{ fontWeight:800, fontSize:13, color:'#fff', marginBottom:5, lineHeight:1.32, letterSpacing:'-0.015em', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight: 41, position:'relative' }}>
                  {highlightMatch(article.title, search)}
                </div>

                <div style={{ fontSize:12, color:'#fff', lineHeight:1.45, marginBottom:9, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight: 35, position:'relative' }}>
                  {highlightMatch(article.description, search)}
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, position:'relative' }}>
                  <span style={{ fontSize:11, color:'#fff', fontWeight:700, flexShrink:0, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', padding:'4px 9px', borderRadius:999 }}>{article.date}</span>
                  <span style={{ fontSize:11, color:'#fff', fontWeight:700, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'right' }}>{article.authorName.replace('Health Engine Team', 'HE Team')}</span>
                </div>
              </div>

              {isPDF ? (
                <div style={{ padding:'0 12px 11px', display:'flex', alignItems:'center', gap:6, position:'relative' }}>
                  <span style={{ fontSize:11, color:'#fff', fontWeight:800, display:'flex', alignItems:'center', gap:5 }}><NativeIcon name="file" size={12} /> Читать внутри <span>→</span></span>
                  {saved.includes(article.id) && <span aria-label="Сохранена" style={{ marginLeft:'auto', color:ART_ACC, fontSize:12 }}>★</span>}
                </div>
              ) : (
                <div style={{ padding:'0 12px 11px', display:'flex', alignItems:'center', gap:6, position:'relative' }}>
                  <span style={{ fontSize:11, color:'#fff', fontWeight:800, opacity:0.85 }}>Читать →</span>
                  {saved.includes(article.id) && <span aria-label="Сохранена" style={{ marginLeft:'auto', color:ART_ACC, fontSize:12 }}>★</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats — pill */}
      <div style={{ marginTop:8, marginBottom:14, display:'flex', justifyContent:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', flexWrap:'wrap', justifyContent:'center', gap:10, padding:'9px 16px', borderRadius:999, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(10px)', fontSize:12, color:'#fff', fontWeight:800 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><NativeIcon name="bookOpen" size={13} /> {ARTICLES_MANIFEST.length}</span>
          <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.22)' }} />
          <span style={{ color:'#fff', display:'inline-flex', alignItems:'center', gap:5 }}><NativeIcon name="file" size={13} /> {ARTICLES_MANIFEST.filter(a => a.content_type === 'pdf').length} PDF</span>
          <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.22)' }} />
          <span style={{ color:'#fff', display:'inline-flex', alignItems:'center', gap:5 }}><NativeIcon name="notebook" size={13} /> {ARTICLES_MANIFEST.filter(a => a.content_type === 'markdown').length}</span>
        </div>
      </div>
    </div>
  );
};
