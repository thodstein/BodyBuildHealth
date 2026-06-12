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

function renderMarkdown(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Tables (simple)
    .replace(/^\|(.+)\|$/gm, (line) => {
      const cells = line.split('|').filter(c => c.trim());
      if (cells.every(c => /^[-: ]+$/.test(c))) return '';
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    })
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
    // Line breaks
    .replace(/\n\n/g, '<br/><br/>')
    // Checkboxes
    .replace(/- \[ \] (.+)/g, '☐ $1')
    .replace(/- \[x\] (.+)/g, '☑ $1');

  return `<div style="line-height:1.7;font-size:13px">${html}</div>`;
}

export const ArticlesScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<string | null>(null);

  const articles = useMemo(() => {
    let list = getSortedArticles();
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
  }, [category, search]);

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);

  const openPDF = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(window.location.origin + url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="screen">
      <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(15,4vw,18)' }}>📚 Статьи</h2>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder=""
          style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
        />
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

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>📄 PDF Документ</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => openPDF(pdfViewer)} style={{
                padding: '5px 14px', borderRadius: 6, background: 'var(--accent)', color: '#000', border: 'none', fontWeight: 600, fontSize: 11, cursor: 'pointer',
              }}>Открыть</button>
              <button onClick={() => setPdfViewer(null)} style={{
                padding: '5px 14px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-dim)', border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer',
              }}>✕ Закрыть</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>📄</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>PDF документ доступен для скачивания</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Нажмите «Открыть» для просмотра в браузере или скачивания</div>
          </div>
        </div>
      )}

      {/* Articles list */}
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
              if (article.content_type === 'pdf') {
                setPdfViewer(article.file_url || '');
              } else {
                toggle(article.id);
              }
            }} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {article.content_type === 'pdf' ? '' : ''}
                    {article.title}
                  </span>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    {article.description}
                  </div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 9, whiteSpace: 'nowrap',
                  background: article.content_type === 'pdf' ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,138,0.08)',
                  color: article.content_type === 'pdf' ? '#ef4444' : 'var(--accent)',
                }}>
                  {article.content_type === 'pdf' ? 'PDF' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
                <span>{article.date}</span>
                <span>{article.authorName}</span>
                <span>{CATEGORIES.find(c => c.value === article.category)?.label || article.category}</span>
              </div>
            </div>

            {/* Expanded MD content */}
            {isExpanded && article.content && (
              <div style={{
                marginTop: 10, padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
              }}>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }} />
                {article.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                    {article.tags.map(t => (
                      <span key={t} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', fontSize: 9 }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Stats */}
      <div className="card" style={{ marginTop: 8, padding: '8px 12px', textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>
        {ARTICLES_MANIFEST.length} статей в библиотеке · {ARTICLES_MANIFEST.filter(a => a.content_type === 'pdf').length} PDF · {ARTICLES_MANIFEST.filter(a => a.content_type === 'markdown').length} Markdown
      </div>
    </div>
  );
};
