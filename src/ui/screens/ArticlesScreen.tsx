import React, { useMemo, useState } from 'react';
import { getSortedArticles, type ArticleManifestEntry, ARTICLES_MANIFEST } from '../../data/articles-manifest';

const CATEGORIES = [
  { value: 'all', label: 'Все', color: '#8b5cf6' },
  { value: 'pharma', label: 'Фарма', color: '#f97316' },
  { value: 'labs', label: 'Анализы', color: '#3b82f6' },
  { value: 'training', label: 'Тренировки', color: '#00e68a' },
  { value: 'nutrition', label: 'Питание', color: '#eab308' },
  { value: 'support', label: 'Поддержка', color: '#a855f7' },
];

const ARTICLE_SECTIONS = [
  { id: 'new', icon: '🆕', title: 'Новые статьи', desc: 'Последние добавленные', color: 'var(--accent)' },
  { id: 'recommended', icon: '⭐', title: 'Рекомендуемое', desc: 'Популярные и рекомендованные', color: '#3b82f6' },
  { id: 'all', icon: '📚', title: 'Все статьи', desc: 'Полная библиотека', color: '#8b5cf6' },
] as const;

const CAT_GRADIENT: Record<string, string> = {
  pharma: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
  labs: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  training: 'linear-gradient(135deg, #00e68a 0%, #059669 100%)',
  nutrition: 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)',
  support: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
  other: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
};

const CAT_ICON: Record<string, string> = {
  pharma: '💊',
  labs: '🔬',
  training: '🏋️',
  nutrition: '🥗',
  support: '🛡️',
};

function estimateReadTime(md: string): number {
  const words = md.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, (_, h) =>
      `<h4 style="font-size:13px;font-weight:700;color:var(--accent);margin:18px 0 8px;letter-spacing:-0.01em;border-left:3px solid var(--accent);padding-left:10px">${h}</h4>`)
    .replace(/^## (.+)$/gm, (_, h) =>
      `<h3 style="font-size:16px;font-weight:700;color:#fff;margin:24px 0 10px;letter-spacing:-0.02em">${h}</h3>`)
    .replace(/^# (.+)$/gm, (_, h) =>
      `<h2 style="font-size:19px;font-weight:800;color:#fff;margin:28px 0 12px;letter-spacing:-0.03em;background:linear-gradient(135deg,var(--accent),#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${h}</h2>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:rgba(255,255,255,0.85);font-style:italic">$1</em>');

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
          `<th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.04em;background:rgba(0,230,138,0.08);border-bottom:1px solid rgba(0,230,138,0.15)">${c.trim()}</th>`
        ).join('') + '</tr>';
        return `<table style="width:100%;border-collapse:collapse;margin:12px 0;border-radius:10px;overflow:hidden;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"><thead>${headerRow}</thead><tbody>`;
      }
      return '<tr>' + cells.map((c, i) =>
        `<td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;${i === 0 ? 'font-weight:600;color:#fff' : 'color:rgba(255,255,255,0.8)'}">${c.trim()}</td>`
      ).join('') + '</tr>';
    } else {
      if (inTable) {
        inTable = false;
        return '</tbody></table>\n' + line;
      }
      return line;
    }
  }).join('\n');
  if (inTable) html += '</tbody></table>';

  html = html
    .replace(/^- (.+)$/gm, (_, item) =>
      `<li style="margin:4px 0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.85);position:relative;padding-left:4px">— ${item}</li>`)
    .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:8px 0;padding:0;list-style:none">${m}</ul>`)
    .replace(/^---$/gm, '<hr style="border:none;height:1px;background:linear-gradient(90deg,transparent,rgba(0,230,138,0.2),transparent);margin:20px 0"/>')
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/- \[ \] (.+)/g, (_, t) =>
      `<span style="display:inline-flex;align-items:center;gap:6px;margin:3px 0;font-size:11px;color:rgba(255,255,255,0.7)"><span style="width:14px;height:14px;border-radius:3px;border:1.5px solid rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0"></span>${t}</span><br/>`)
    .replace(/- \[x\] (.+)/g, (_, t) =>
      `<span style="display:inline-flex;align-items:center;gap:6px;margin:3px 0;font-size:11px;color:var(--accent)"><span style="width:14px;height:14px;border-radius:3px;background:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0">✓</span>${t}</span><br/>`);

  html = html
    .replace(/^> (.+)$/gm, (_, q) =>
      `<blockquote style="margin:14px 0;padding:10px 14px;background:rgba(0,230,138,0.06);border-left:3px solid var(--accent);border-radius:6px;font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5">${q}</blockquote>`);

  return `<div style="line-height:1.7;font-size:13px;color:rgba(255,255,255,0.82)">${html}</div>`;
}

export const ArticlesScreen: React.FC = () => {
  const [page, setPage] = useState<'hero' | 'list'>('hero');
  const [listSection, setListSection] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [readingArticle, setReadingArticle] = useState<ArticleManifestEntry | null>(null);
  const [pdfViewer, setPdfViewer] = useState<string | null>(null);

  const articles = useMemo(() => {
    let list = getSortedArticles();
    if (listSection === 'new') list = list.slice(0, 3);
    if (category !== 'all') list = list.filter(a => a.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.includes(q))
      );
    }
    return list;
  }, [category, search, listSection]);

  const openPDF = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(window.location.origin + url);
    } else {
      window.open(url, '_blank');
    }
  };

  const goToList = (section: string) => {
    setListSection(section);
    setPage('list');
  };

  if (page === 'hero') {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
        <img src="/articles-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.92) 70%, #0a0a0f 100%)' }} />
        <div style={{ position:'absolute', inset:0, background:'rgba(10,10,15,0.4)' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'20px 16px 70px' }}>
          <div style={{ marginBottom:6 }}>
            <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:12, background:'rgba(0,230,138,0.15)', color:'var(--accent)', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>База знаний</span>
          </div>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#fff', margin:'0 0 4px', textShadow:'0 4px 20px rgba(0,0,0,0.9)', letterSpacing:'-0.03em', lineHeight:1.1 }}>Статьи</h1>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.75)', margin:'0 0 20px', lineHeight:1.4, textShadow:'0 1px 8px rgba(0,0,0,0.8)', maxWidth:'80%' }}>
            Фармакология, анализы, тренировки, питание и поддержка
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ARTICLE_SECTIONS.map(s => (
              <button key={s.id} onClick={() => goToList(s.id)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'13px 15px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.5)', border:'1px solid rgba(255,255,255,0.06)', color:'var(--text)',
                backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
                transition:'all 0.25s', boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,22,30,0.5)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:s.color+'20', fontSize:18 }}>{s.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:2, color:s.color, letterSpacing:'-0.01em' }}>{s.title}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', lineHeight:1.3 }}>{s.desc}</div>
                </div>
                <div style={{ color:s.color, fontSize:14, opacity:0.5, transition:'all 0.2s' }}>→</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      {/* Header toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 0px 8px', flexShrink:0 }}>
        <button onClick={() => setPage('hero')} style={{
          padding:'6px 8px', cursor:'pointer', fontSize:13,
          color:'var(--text-dim)', border:'none', background:'transparent',
          display:'flex', alignItems:'center', gap:4, fontWeight:600,
          transition:'color 0.2s',
        }}>← Категории</button>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>{articles.length} ст.</span>
      </div>

      {/* Search bar */}
      <div style={{ position:'relative', marginBottom:10 }}>
        <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', width:14, height:14, color:'rgba(255,255,255,0.25)', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round' }} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск статей..." style={{
            width:'100%', padding:'9px 10px 9px 30px', borderRadius:10,
            background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)',
            color:'var(--text)', fontSize:12, outline:'none',
            transition:'border-color 0.2s',
            boxSizing:'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,230,138,0.3)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
        />
      </div>

      {/* Category chips */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
        {CATEGORIES.map(c => {
          const isActive = category === c.value;
          return (
            <button key={c.value} onClick={() => setCategory(c.value)} style={{
              padding:'5px 11px', borderRadius:14, fontSize:10, cursor:'pointer',
              background: isActive ? c.color + '1a' : 'rgba(255,255,255,0.04)',
              color: isActive ? c.color : 'rgba(255,255,255,0.5)',
              border: `1px solid ${isActive ? c.color + '44' : 'rgba(255,255,255,0.06)'}`,
              fontWeight: isActive ? 600 : 400,
              transition:'all 0.2s',
              display:'flex', alignItems:'center', gap:4,
            }}>
              {CAT_ICON[c.value] && <span style={{ fontSize:10 }}>{CAT_ICON[c.value]}</span>}
              {c.label}
            </button>
          );
        })}
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.92)', display:'flex', flexDirection:'column', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'#ef4444' }}>📄</span> PDF
            </span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => openPDF(pdfViewer)} style={{ padding:'6px 16px', borderRadius:8, background:'var(--accent)', color:'#000', border:'none', fontWeight:700, fontSize:11, cursor:'pointer' }}>Открыть</button>
              <button onClick={() => setPdfViewer(null)} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.08)', fontSize:11, cursor:'pointer' }}>✕</button>
            </div>
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:24 }}>
            <div style={{ width:64, height:64, borderRadius:16, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>📄</div>
            <div style={{ fontSize:15, color:'var(--text)', fontWeight:600, textAlign:'center' }}>PDF-документ</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', textAlign:'center' }}>Для просмотра откройте в браузере</div>
          </div>
        </div>
      )}

      {/* Full-screen article reader */}
      {readingArticle && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'#0a0a0f', display:'flex', flexDirection:'column' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            <button onClick={() => setReadingArticle(null)} style={{
              width:32, height:32, borderRadius:10, cursor:'pointer',
              background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)',
              color:'rgba(255,255,255,0.6)', fontSize:14, fontWeight:600,
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.2s', flexShrink:0,
            }}>←</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{readingArticle.title}</div>
              <div style={{ fontSize:9.5, color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', gap:6, marginTop:1 }}>
                <span style={{ color: CATEGORIES.find(c => c.value === readingArticle.category)?.color || '#6b7280' }}>
                  {CAT_ICON[readingArticle.category] || '📄'} {CATEGORIES.find(c => c.value === readingArticle.category)?.label || readingArticle.category}
                </span>
                <span>·</span>
                <span>{estimateReadTime(readingArticle.content || '')} мин чтения</span>
                <span>·</span>
                <span>{readingArticle.date}</span>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex:1, overflow:'auto', padding:'16px 14px 40px' }}>
            {/* Title at top of content */}
            <h1 style={{ fontSize:22, fontWeight:900, color:'#fff', margin:'0 0 8px', lineHeight:1.2, letterSpacing:'-0.03em' }}>
              {readingArticle.title}
            </h1>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:20, paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
              <span>{readingArticle.authorName}</span>
              <span>·</span>
              <span>{readingArticle.date}</span>
            </div>

            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(readingArticle.content || '') }} />

            {/* Tags */}
            {readingArticle.tags.length > 0 && (
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:24, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                {readingArticle.tags.map(t => (
                  <span key={t} style={{
                    padding:'3px 10px', borderRadius:12, fontSize:9,
                    background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.4)',
                  }}>#{t}</span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop:24, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)', textAlign:'center', fontSize:9.5, color:'rgba(255,255,255,0.15)' }}>
              Health Engine · {readingArticle.date}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {articles.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', gap:10 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📭</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', fontWeight:500 }}>Статьи не найдены</div>
          <button onClick={() => { setSearch(''); setCategory('all'); }} style={{ padding:'5px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:10, cursor:'pointer' }}>Сбросить фильтры</button>
        </div>
      )}

      {/* Article cards — magazine grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        {articles.map(article => {
          const catColor = CATEGORIES.find(c => c.value === article.category)?.color || '#6b7280';
          const catIcon = CAT_ICON[article.category] || '📄';
          const readTime = article.content ? estimateReadTime(article.content) : 0;
          const isPDF = article.content_type === 'pdf';

          return (
              <div key={article.id} onClick={() => {
                if (isPDF) { setPdfViewer(article.file_url || ''); }
                else { setReadingArticle(article); }
              }} style={{
              borderRadius:12, overflow:'hidden',
              background:'rgba(255,255,255,0.03)',
              border:'1px solid rgba(255,255,255,0.06)',
              transition:'all 0.25s',
              position:'relative', cursor:'pointer',
            }}>
              {/* Color bar top */}
              <div style={{ height:3, background:catColor, width:'100%' }} />

              <div style={{ padding:'10px 10px 8px' }}>
                {/* Category badge + type */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:9, color:catColor, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', gap:3 }}>
                    {catIcon} {CATEGORIES.find(c => c.value === article.category)?.label || article.category}
                  </span>
                  {isPDF ? (
                    <span style={{ fontSize:8, padding:'1px 6px', borderRadius:4, background:'rgba(239,68,68,0.12)', color:'#ef4444', fontWeight:600 }}>PDF</span>
                  ) : (
                    <span style={{ fontSize:8, padding:'1px 6px', borderRadius:4, background:'rgba(0,230,138,0.08)', color:'var(--accent)', fontWeight:600 }}>{readTime} мин</span>
                  )}
                </div>

                {/* Title */}
                <div style={{ fontWeight:700, fontSize:11.5, color:'#fff', marginBottom:3, lineHeight:1.3, letterSpacing:'-0.01em' }}>
                  {article.title}
                </div>

                {/* Description */}
                <div style={{ fontSize:9.5, color:'rgba(255,255,255,0.45)', lineHeight:1.3, marginBottom:4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {article.description}
                </div>

                {/* Date + author */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:2 }}>
                  <span style={{ fontSize:8.5, color:'rgba(255,255,255,0.25)' }}>{article.date}</span>
                  <span style={{ fontSize:8.5, color:'rgba(255,255,255,0.2)' }}>{article.authorName.replace('Health Engine Team', 'HE Team')}</span>
                </div>
              </div>

              {/* PDF click hint */}
              {isPDF && (
                <div style={{ padding:'2px 10px 8px', display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:8.5, color:'rgba(239,68,68,0.5)' }}>📂 Нажмите, чтобы открыть</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div style={{ marginTop:4, marginBottom:10, padding:'8px 0', textAlign:'center', fontSize:9.5, color:'rgba(255,255,255,0.2)', display:'flex', justifyContent:'center', gap:12 }}>
        <span>📚 {ARTICLES_MANIFEST.length} статей</span>
        <span>📄 {ARTICLES_MANIFEST.filter(a => a.content_type === 'pdf').length} PDF</span>
        <span>📝 {ARTICLES_MANIFEST.filter(a => a.content_type === 'markdown').length} статей</span>
      </div>
    </div>
  );
};
