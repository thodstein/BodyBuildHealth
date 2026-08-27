import React, { useMemo, useState } from 'react';
import { getSortedArticles, type ArticleManifestEntry, ARTICLES_MANIFEST } from '../../data/articles-manifest';

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";

const CATEGORIES = [
  { value: 'all', label: 'Все', color: '#8b5cf6' },
  { value: 'pharma', label: 'Фарма', color: '#f97316' },
  { value: 'labs', label: 'Анализы', color: '#3b82f6' },
  { value: 'training', label: 'Тренировки', color: '#00e68a' },
  { value: 'nutrition', label: 'Питание', color: '#eab308' },
  { value: 'support', label: 'Поддержка', color: '#a855f7' },
] as const;

const ARTICLE_SECTIONS = [
  { id: 'new', icon: '🆕', title: 'Новые статьи', desc: 'Последние добавленные', color: '#00e68a' },
  { id: 'recommended', icon: '⭐', title: 'Рекомендуемое', desc: 'Популярные и избранные', color: '#3b82f6' },
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
      `<h4 style="font-size:13px;font-weight:800;color:#a78bfa;margin:22px 0 8px;letter-spacing:-0.01em;border-left:3px solid #00e68a;padding-left:10px">${h}</h4>`)
    .replace(/^## (.+)$/gm, (_, h) =>
      `<h3 style="font-size:16px;font-weight:800;color:#fff;margin:26px 0 10px;letter-spacing:-0.02em">${h}</h3>`)
    .replace(/^# (.+)$/gm, (_, h) =>
      `<h2 style="font-size:20px;font-weight:900;color:#fff;margin:28px 0 12px;letter-spacing:-0.03em;background:linear-gradient(135deg,#00e68a,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${h}</h2>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#fff;font-style:italic">$1</em>');

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
          `<th style="padding:8px 11px;text-align:left;font-size:10px;font-weight:800;color:#00e68a;text-transform:uppercase;letter-spacing:0.06em;background:rgba(0,230,138,0.09);border-bottom:1px solid rgba(0,230,138,0.16)">${c.trim()}</th>`
        ).join('') + '</tr>';
        return `<table style="width:100%;border-collapse:collapse;margin:14px 0;border-radius:12px;overflow:hidden;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"><thead>${headerRow}</thead><tbody>`;
      }
      return '<tr>' + cells.map((c, i) =>
        `<td style="padding:7px 11px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;${i === 0 ? 'font-weight:700;color:#fff' : 'color:#fff'}">${c.trim()}</td>`
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
      `<li style="margin:5px 0;font-size:12px;line-height:1.55;color:#fff;position:relative;padding-left:4px">— ${item}</li>`)
    .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:10px 0;padding:0;list-style:none">${m}</ul>`)
    .replace(/^---$/gm, '<hr style="border:none;height:1px;background:linear-gradient(90deg,transparent,rgba(0,230,138,0.22),transparent);margin:22px 0"/>')
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/- \[ \] (.+)/g, (_, t) =>
      `<span style="display:inline-flex;align-items:center;gap:7px;margin:4px 0;font-size:11px;color:#fff"><span style="width:14px;height:14px;border-radius:4px;border:1.5px solid rgba(255,255,255,0.22);display:inline-flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0"></span>${t}</span><br/>`)
    .replace(/- \[x\] (.+)/g, (_, t) =>
      `<span style="display:inline-flex;align-items:center;gap:7px;margin:4px 0;font-size:11px;color:#00e68a"><span style="width:14px;height:14px;border-radius:4px;background:#00e68a;display:inline-flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;color:#000;font-weight:900">✓</span>${t}</span><br/>`);

  html = html
    .replace(/^> (.+)$/gm, (_, q) =>
      `<blockquote style="margin:16px 0;padding:12px 14px;background:rgba(0,230,138,0.07);border-left:3px solid #00e68a;border-radius:8px;font-size:12px;color:#fff;line-height:1.55;backdrop-filter:blur(8px)">${q}</blockquote>`);

  return `<div style="line-height:1.75;font-size:13px;color:#fff">${html}</div>`;
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
      <div style={{ position:'fixed', inset:0, width:'100%', height:'100dvh', minHeight:'100dvh', zIndex:100, display:'flex', flexDirection:'column', fontFamily: FONT, overflow:'hidden', background:'#07070a' }}>
        <img src="/articles-hero.png?v=20250827d" alt="" onError={e=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} className="hero-fullscreen-img" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center center', background:'#07070a' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 62%, rgba(0,0,0,0.18) 76%, rgba(0,0,0,0.58) 88%, rgba(0,0,0,0.78) 100%)' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'12px 12px calc(64px + env(safe-area-inset-bottom,0px))', gap:10, overflowY:'auto' }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.22)', color:'#00e68a', fontSize:9, fontWeight:800, letterSpacing:'0.4px' }}>
              <span style={{ width:5, height:5, borderRadius:5, background:'#00e68a', boxShadow:'0 0 8px rgba(0,230,138,0.6)', display:'inline-block' }} /> БАЗА ЗНАНИЙ
            </div>
            <h1 style={{ fontSize:22, fontWeight:900, color:'#fff', margin:'8px 0 4px', textShadow:'0 2px 12px rgba(0,0,0,0.9)', letterSpacing:'-0.6px', lineHeight:1 }}>Статьи</h1>
            <p style={{ fontSize:11, color:'#fff', margin:0, lineHeight:1.4, textShadow:'0 1px 6px rgba(0,0,0,0.8)', maxWidth:480 }}>Фармакология · Анализы · Тренировки · Питание · Поддержка — концентрат практики и науки</p>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>{ARTICLES_MANIFEST.length} материалов</span>
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>5 категорий</span>
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(0,230,138,0.16)', color:'#00e68a' }}>Еженедельно</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ARTICLE_SECTIONS.map(s => (
              <div key={s.id} role="button" tabIndex={0} onClick={() => goToList(s.id)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); goToList(s.id); }}} onMouseEnter={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.borderColor=`${s.color}40`; (e.currentTarget as HTMLDivElement).style.boxShadow=`0 6px 18px rgba(0,0,0,0.32), 0 0 0 1px ${s.color}18 inset`; }} onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.12)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 3px 12px rgba(0,0,0,0.30)'; }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 3px 12px rgba(0,0,0,0.30)', background:'rgba(18,18,20,0.62)', transition:'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease' }}>
                <div style={{ width:38, height:38, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`linear-gradient(135deg, ${s.color}22, ${s.color}10)`, border:`1px solid ${s.color}28`, fontSize:18, boxShadow:`0 3px 10px ${s.color}20`, position:'relative' }}>{s.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:800, marginBottom:2, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.2 }}>{s.title}</div>
                  <div style={{ fontSize:10.5, color:'#fff', lineHeight:1.3 }}>{s.desc}</div>
                </div>
                <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${s.color}12`, border:`1px solid ${s.color}18`, color:s.color, fontSize:13, flexShrink:0, fontWeight:700 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ fontFamily: FONT, paddingBottom: 'calc(20px + 72px + env(safe-area-inset-bottom,0px))', background:'transparent' }}>
      {/* premium toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 10px', flexShrink:0, position:'sticky', top:0, zIndex:2, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', background:'rgba(10,10,15,0.62)', margin:'-6px -6px 0', paddingLeft:6, paddingRight:6, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setPage('hero')} style={{
          padding:'8px 12px', cursor:'pointer', fontSize:12, fontWeight:700,
          color:'#fff', border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.05)',
          borderRadius:999, display:'flex', alignItems:'center', gap:6,
          backdropFilter:'blur(10px)', transition:'all 0.18s',
        }}
        onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.14)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; }}
        >← Категории</button>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:11, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', padding:'5px 10px', borderRadius:999 }}>{articles.length} ст.</span>
      </div>

      {/* Search bar — glass */}
      <div style={{ position:'relative', marginBottom:10, marginTop:10 }}>
        <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:15, height:15, color:'#fff', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round' }} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск статей — заголовок, тег, категория..." style={{
            width:'100%', padding:'11px 36px 11px 36px', borderRadius:12,
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)',
            color:'#fff', fontSize:13, outline:'none', fontFamily: FONT,
            backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
            boxShadow:'0 6px 22px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
            transition:'border-color 0.2s, box-shadow 0.2s',
            boxSizing:'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,230,138,0.38)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.22), 0 0 0 3px rgba(0,230,138,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)'; }}
        />
        {search && (
          <button onClick={()=>setSearch('')} aria-label="Очистить" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:26, height:26, borderRadius:999, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>✕</button>
        )}
      </div>

      {/* Category chips — glass pills */}
      <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:12 }}>
        {CATEGORIES.map(c => {
          const isActive = category === c.value;
          return (
            <button key={c.value} onClick={() => setCategory(c.value)} style={{
              padding:'7px 13px', borderRadius:999, fontSize:11, cursor:'pointer', fontFamily: FONT,
              background: isActive ? `linear-gradient(135deg, ${c.color}1f, ${c.color}12)` : 'rgba(255,255,255,0.05)',
              color: isActive ? c.color : '#fff',
              border: `1px solid ${isActive ? c.color+'44' : 'rgba(255,255,255,0.08)'}`,
              fontWeight: isActive ? 800 : 600,
              backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
              boxShadow: isActive ? `0 4px 16px ${c.color}22, inset 0 1px 0 rgba(255,255,255,0.08)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
              transition:'all 0.18s', letterSpacing:'-0.01em',
              display:'flex', alignItems:'center', gap:6,
            }}>
              {CAT_ICON[c.value] && <span style={{ fontSize:11 }}>{CAT_ICON[c.value]}</span>}
              {c.label}
            </button>
          );
        })}
      </div>

      {/* PDF Viewer Modal — premium */}
      {pdfViewer && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(6,6,10,0.88)', display:'flex', flexDirection:'column', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
            <span style={{ fontWeight:800, fontSize:13, display:'flex', alignItems:'center', gap:7, letterSpacing:'-0.02em' }}>
              <span style={{ width:26, height:26, borderRadius:8, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.22)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>📄</span> PDF
            </span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => openPDF(pdfViewer)} style={{ padding:'7px 16px', borderRadius:999, background:'#00e68a', color:'#000', border:'none', fontWeight:800, fontSize:11, cursor:'pointer', boxShadow:'0 4px 14px rgba(0,230,138,0.28)' }}>Открыть</button>
              <button onClick={() => setPdfViewer(null)} style={{ padding:'7px 12px', borderRadius:999, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', fontSize:11, cursor:'pointer' }}>✕</button>
            </div>
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:24 }}>
            <div style={{ width:72, height:72, borderRadius:18, background:'radial-gradient(120% 120% at 30% 20%, rgba(239,68,68,0.18), rgba(239,68,68,0.06) 55%, transparent 75%)', border:'1px solid rgba(239,68,68,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, boxShadow:'0 12px 32px rgba(239,68,68,0.18)' }}>📄</div>
            <div style={{ fontSize:16, color:'#fff', fontWeight:800, letterSpacing:'-0.02em' }}>PDF-документ</div>
            <div style={{ fontSize:12, color:'#fff', textAlign:'center', maxWidth:320, lineHeight:1.5 }}>Для просмотра откроется новая вкладка — браузер покажет файл в встроенном просмотрщике.</div>
            <button onClick={()=>openPDF(pdfViewer)} style={{ marginTop:8, padding:'10px 18px', borderRadius:999, background:'#fff', color:'#000', border:'none', fontWeight:800, fontSize:12, cursor:'pointer' }}>Открыть в браузере →</button>
          </div>
        </div>
      )}

      {/* Full-screen article reader — premium */}
      {readingArticle && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'#07070a', display:'flex', flexDirection:'column', fontFamily: FONT }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0, background:'rgba(255,255,255,0.02)', backdropFilter:'blur(14px)' }}>
            <button onClick={() => setReadingArticle(null)} style={{
              width:34, height:34, borderRadius:999, cursor:'pointer',
              background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
              color:'#fff', fontSize:14, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>←</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:'-0.02em' }}>{readingArticle.title}</div>
              <div style={{ fontSize:10, color:'#fff', display:'flex', alignItems:'center', gap:6, marginTop:2, fontWeight:600 }}>
                <span style={{ color: CATEGORIES.find(c => c.value === readingArticle.category)?.color || '#6b7280' }}>
                  {CAT_ICON[readingArticle.category] || '📄'} {CATEGORIES.find(c => c.value === readingArticle.category)?.label || readingArticle.category}
                </span>
                <span style={{ opacity:0.35 }}>·</span>
                <span>{estimateReadTime(readingArticle.content || '')} мин</span>
                <span style={{ opacity:0.35 }}>·</span>
                <span>{readingArticle.date}</span>
              </div>
            </div>
            <span style={{ padding:'5px 10px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', fontSize:10, fontWeight:700, color:'#fff' }}>{estimateReadTime(readingArticle.content||'')}′</span>
          </div>

          <div style={{ flex:1, overflow:'auto', padding:'18px 16px 40px', maxWidth: 720, width:'100%', margin:'0 auto' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:999, background:`${CATEGORIES.find(c=>c.value===readingArticle.category)?.color || '#6b7280'}14`, border:`1px solid ${CATEGORIES.find(c=>c.value===readingArticle.category)?.color || '#6b7280'}22`, color: CATEGORIES.find(c=>c.value===readingArticle.category)?.color || '#6b7280', fontSize:11, fontWeight:800, marginBottom:10 }}>
              {CAT_ICON[readingArticle.category] || '📄'} {CATEGORIES.find(c=>c.value===readingArticle.category)?.label || readingArticle.category}
            </div>
            <h1 style={{ fontSize:26, fontWeight:900, color:'#fff', margin:'0 0 8px', lineHeight:1.12, letterSpacing:'-0.04em' }}>
              {readingArticle.title}
            </h1>
            <div style={{ fontSize:12, color:'#fff', marginBottom:18, paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontWeight:700, color:'#fff' }}>{readingArticle.authorName}</span>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.22)' }} />
              <span>{readingArticle.date}</span>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.22)' }} />
              <span style={{ padding:'3px 8px', borderRadius:999, background:'rgba(0,230,138,0.10)', border:'1px solid rgba(0,230,138,0.18)', color:'#00e68a', fontWeight:700, fontSize:10 }}>{estimateReadTime(readingArticle.content||'')} мин чтения</span>
            </div>

            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(readingArticle.content || '') }} />

            {readingArticle.tags.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:26, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                {readingArticle.tags.map(t => (
                  <span key={t} style={{
                    padding:'5px 11px', borderRadius:999, fontSize:11, fontWeight:600,
                    background:'rgba(255,255,255,0.05)', color:'#fff', border:'1px solid rgba(255,255,255,0.06)',
                    backdropFilter:'blur(8px)',
                  }}>#{t}</span>
                ))}
              </div>
            )}

            <div style={{ marginTop:22, padding:'12px 14px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:28, height:28, borderRadius:999, background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✓</span>
              <span style={{ fontSize:11, color:'#fff', lineHeight:1.4 }}>Материал подготовлен командой Health Engine. Не является медицинской рекомендацией — проконсультируйтесь с врачом.</span>
            </div>
            <div style={{ marginTop:18, textAlign:'center', fontSize:10, color:'#fff' }}>
              Health Engine · {readingArticle.date}
            </div>
          </div>
        </div>
      )}

      {/* Empty state — premium */}
      {articles.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'44px 20px', gap:12, marginTop:10, borderRadius:16, background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)' }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'radial-gradient(120% 120% at 30% 20%, rgba(139,92,246,0.18), transparent 65%)', border:'1px solid rgba(139,92,246,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, boxShadow:'0 10px 28px rgba(139,92,246,0.14)' }}>📭</div>
          <div style={{ fontSize:14, color:'#fff', fontWeight:800, letterSpacing:'-0.02em' }}>Статьи не найдены</div>
          <div style={{ fontSize:12, color:'#fff', textAlign:'center', maxWidth:300 }}>Попробуйте изменить запрос или сбросить фильтры — покажем всё снова.</div>
          <button onClick={() => { setSearch(''); setCategory('all'); }} style={{ marginTop:6, padding:'8px 16px', borderRadius:999, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', backdropFilter:'blur(10px)' }}>Сбросить фильтры</button>
        </div>
      )}

      {/* Article cards — premium magazine grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10, marginBottom:8 }}>
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
              <div style={{ height:3, background: isPDF ? 'linear-gradient(90deg, #ef4444, #f97316)' : catColor, width:'100%', opacity:0.95 }} />
              <div style={{ padding:'11px 11px 10px', position:'relative' }}>
                <div aria-hidden="true" style={{ position:'absolute', inset:0, background:`radial-gradient(520px 100px at 14% 0%, ${catColor}10, transparent 62%)`, pointerEvents:'none' }} />
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7, position:'relative' }}>
                  <span style={{ fontSize:10, color:catColor, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:5, background:`${catColor}12`, border:`1px solid ${catColor}22`, padding:'3px 8px', borderRadius:999 }}>
                    <span style={{ fontSize:11 }}>{catIcon}</span> {CATEGORIES.find(c => c.value === article.category)?.label || article.category}
                  </span>
                  {isPDF ? (
                    <span style={{ fontSize:9, padding:'3px 7px', borderRadius:999, background:'rgba(239,68,68,0.12)', color:'#f87171', fontWeight:800, border:'1px solid rgba(239,68,68,0.18)' }}>PDF</span>
                  ) : (
                    <span style={{ fontSize:9, padding:'3px 7px', borderRadius:999, background:'rgba(0,230,138,0.10)', color:'#00e68a', fontWeight:800, border:'1px solid rgba(0,230,138,0.16)' }}>{readTime}′</span>
                  )}
                </div>

                <div style={{ fontWeight:800, fontSize:12, color:'#fff', marginBottom:4, lineHeight:1.32, letterSpacing:'-0.015em', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight: 38, position:'relative' }}>
                  {article.title}
                </div>

                <div style={{ fontSize:11, color:'#fff', lineHeight:1.42, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight: 31, position:'relative' }}>
                  {article.description}
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative' }}>
                  <span style={{ fontSize:10, color:'#fff', fontWeight:600, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:999 }}>{article.date}</span>
                  <span style={{ fontSize:10, color:'#fff', fontWeight:600 }}>{article.authorName.replace('Health Engine Team', 'HE Team')}</span>
                </div>
              </div>

              {isPDF && (
                <div style={{ padding:'0 11px 10px', display:'flex', alignItems:'center', gap:6, position:'relative' }}>
                  <span style={{ fontSize:10, color:'rgba(239,68,68,0.72)', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>📂 Открыть PDF <span style={{ opacity:0.6 }}>→</span></span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats — pill */}
      <div style={{ marginTop:8, marginBottom:14, display:'flex', justifyContent:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'7px 12px', borderRadius:999, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', backdropFilter:'blur(10px)', fontSize:10, color:'#fff', fontWeight:700 }}>
          <span>📚 {ARTICLES_MANIFEST.length}</span>
          <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.18)' }} />
          <span style={{ color:'#f87171' }}>📄 {ARTICLES_MANIFEST.filter(a => a.content_type === 'pdf').length} PDF</span>
          <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.18)' }} />
          <span style={{ color:'#00e68a' }}>📝 {ARTICLES_MANIFEST.filter(a => a.content_type === 'markdown').length}</span>
        </div>
      </div>
    </div>
  );
};
