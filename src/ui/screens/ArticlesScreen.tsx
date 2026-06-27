import React, { useMemo, useState } from 'react';
import { getSortedArticles, type ArticleManifestEntry, ARTICLES_MANIFEST } from '../../data/articles-manifest';

const CATEGORIES = [
  { value: 'all', label: 'Все' },
  { value: 'pharma', label: 'Фарма' },
  { value: 'labs', label: 'Анализы' },
  { value: 'training', label: 'Тренировки' },
  { value: 'nutrition', label: 'Питание' },
  { value: 'support', label: 'Поддержка' },
];

const ARTICLE_SECTIONS = [
  { id: 'new', icon: '🆕', title: 'Новые статьи', desc: 'Последние добавленные статьи', color: 'var(--accent)' },
  { id: 'recommended', icon: '⭐', title: 'Рекомендуемое', desc: 'Популярные и рекомендованные статьи', color: '#3b82f6' },
  { id: 'all', icon: '📚', title: 'Все статьи', desc: 'Полная библиотека статей', color: '#8b5cf6' },
] as const;

function renderMarkdown(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^\|(.+)\|$/gm, (line) => {
      const cells = line.split('|').filter(c => c.trim());
      if (cells.every(c => /^[-: ]+$/.test(c))) return '';
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    })
    .replace(/^---$/gm, '<hr/>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/- \[ \] (.+)/g, '☐ $1')
    .replace(/- \[x\] (.+)/g, '☑ $1');
  return `<div style="line-height:1.7;font-size:13px">${html}</div>`;
}

export const ArticlesScreen: React.FC = () => {
  const [page, setPage] = useState<'hero' | 'list'>('hero');
  const [listSection, setListSection] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);

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
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Статьи</h1>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
            База знаний: фармакология, анализы, тренировки, питание
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ARTICLE_SECTIONS.map(s => (
              <button key={s.id} onClick={() => goToList(s.id)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s',
              }}>
                <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:s.color+'18', fontSize:20 }}>{s.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color:s.color }}>{s.title}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{s.desc}</div>
                </div>
                <span style={{ color:s.color, fontSize:16, opacity:0.6 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 0px', flexShrink:0, marginBottom:8 }}>
        <button onClick={() => setPage('hero')} style={{
          padding:'6px 8px', cursor:'pointer', fontSize:14,
          color:'var(--text-dim)', border:'none', background:'transparent',
          display:'flex', alignItems:'center', gap:4, fontWeight:600,
        }}>← На главную</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="" style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCategory(c.value)} style={{
            padding: '5px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
            background: category === c.value ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
            color: category === c.value ? 'var(--accent)' : 'var(--text-dim)',
            border: `1px solid ${category === c.value ? 'var(--accent)' : 'var(--border)'}`,
            fontWeight: category === c.value ? 600 : 400,
          }}>{c.label}</button>
        ))}
      </div>

      {pdfViewer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>📄 PDF Документ</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => openPDF(pdfViewer)} style={{ padding: '5px 14px', borderRadius: 6, background: 'var(--accent)', color: '#000', border: 'none', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>Открыть</button>
              <button onClick={() => setPdfViewer(null)} style={{ padding: '5px 14px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-dim)', border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer' }}>✕ Закрыть</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>📄</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>PDF документ доступен для просмотра</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Нажмите «Открыть» для просмотра в браузере</div>
          </div>
        </div>
      )}

      {articles.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Статьи не найдены</div>
        </div>
      )}

      {articles.map(article => {
        const isExpanded = expandedId === article.id;
        return (
          <div key={article.id} className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
            <div onClick={() => {
              if (article.content_type === 'pdf') { setPdfViewer(article.file_url || ''); }
              else { toggle(article.id); }
            }} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{article.title}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{article.description}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, whiteSpace: 'nowrap',
                  background: article.content_type === 'pdf' ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,138,0.08)',
                  color: article.content_type === 'pdf' ? '#ef4444' : 'var(--accent)',
                }}>{article.content_type === 'pdf' ? 'PDF' : (article.content_type === 'html' ? 'HTML' : 'MD')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
                <span>{article.date}</span>
                <span>{article.authorName}</span>
                <span>{CATEGORIES.find(c => c.value === article.category)?.label || article.category}</span>
              </div>
            </div>
            {isExpanded && article.content && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }} />
                {article.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                    {article.tags.map(t => (
                      <span key={t} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', fontSize: 9 }}>#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="card" style={{ marginTop: 8, padding: '8px 12px', textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>
        {ARTICLES_MANIFEST.length} статей · {ARTICLES_MANIFEST.filter(a => a.content_type === 'pdf').length} PDF · {ARTICLES_MANIFEST.filter(a => a.content_type === 'markdown').length} MD
      </div>
    </div>
  );
};
