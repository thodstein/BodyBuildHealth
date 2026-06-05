import React, { useEffect, useState } from 'react';
import { createArticle, updateArticle, submitForReview, processReview, publishArticle, filterArticles } from '../../engines/articles.engine';
import { db } from '../../core/db';
import { getCurrentProfile, type LocalUserProfile } from '../../core/auth-manager';
import type { Article, ArticleStatus } from '../../core/types';

const CATEGORIES = [
  { value: 'nutrition', label: 'Питание' },
  { value: 'pharma', label: 'Фармакология' },
  { value: 'labs', label: 'Лаборатория' },
  { value: 'training', label: 'Тренировки' },
  { value: 'support', label: 'Поддержка' },
];

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Черновик',
  review: 'На ревью',
  published: 'Опубликована',
  archived: 'Архив',
};

const STATUS_COLORS: Record<ArticleStatus, string> = {
  draft: '#9e9e9e',
  review: '#2196f3',
  published: '#4caf50',
  archived: '#757575',
};

const SEED_ARTICLES: Article[] = [
  {
    id: 'seed-1', title: 'Основы нутрициологии для спортсменов',
    content: 'Подробное руководство по питанию для достижения спортивных целей. Белок: 1.6-2.2 г/кг массы тела для гипертрофии, углеводы: 4-7 г/кг в зависимости от объёма тренировок, жиры: 0.8-1.2 г/кг. Микронутриенты: витамин D 2000-5000 МЕ/день, омега-3 2-3 г EPA+DHA, цинк 25-50 мг, магний 400 мг бисглицинат. Хронология питания: белково-углеводное окно 30-60 мин после тренировки, казеин перед сном для ночного анаболизма.',
    category: 'nutrition', authorId: 'team', authorName: 'Health Engine Team',
    createdAt: '2026-05-01', updatedAt: '2026-05-01', version: 1, likes: 42, views: 1280, isPinned: true,
    status: 'published', teaser: 'Руководство по БЖУ, микронутриентам и хронологии питания для гипертрофии', tags: ['питание', 'спорт', 'добавки'], publishedAt: '2026-05-01',
  },
  {
    id: 'seed-2', title: 'Понимание фармакокинетики стероидов',
    content: 'Как ААС работают в организме: абсорбция, распределение, метаболизм, выведение. Период полувыведения определяет частоту инъекций и стабильность уровня. Эфиры тестостерона: пропионат (2-3 дня), энантат (4-5 дней), ципионат (5-7 дней), ундеканоат (16-20 недель). Накопление (стационарный уровень) достигается через 4-5 периодов полувыведения. Токсичность: 17-α алкилированные оральные вызывают холестаз и повышение АЛТ/АСТ, инъекционные — минимальная гепатотоксичность.',
    category: 'pharma', authorId: 'dr-pharm', authorName: 'Dr. Pharm',
    createdAt: '2026-05-15', updatedAt: '2026-05-15', version: 1, likes: 28, views: 890, isPinned: false,
    status: 'published', teaser: 'Эфиры, T½, стационарный уровень, гепатотоксичность и пути метаболизма', tags: ['фармакология', 'ААС', 'PK/PD'], publishedAt: '2026-05-15',
  },
  {
    id: 'seed-3', title: 'Анализ крови: что показывают ключевые biomarkers',
    content: 'Расшифровка результатов лабораторных анализов для оптимизации здоровья. Ключевые панели: гематология (HGB, HCT, RBC), гепатология (ALT, AST, GGT, билирубин), липиды (ОХС, ЛПНП, ЛПВП, ТГ), эндокринология (TT, FT, E2, PRL, LH, FSH, TSH), почки (креатинин, eGFR, мочевина). Референсные диапазоны зависят от фазы (базовая линия, курс, ПКТ). Индекс HOMA-IR для оценки инсулинорезистентности.',
    category: 'labs', authorId: 'lab-spec', authorName: 'Lab Specialist',
    createdAt: '2026-05-10', updatedAt: '2026-05-10', version: 1, likes: 35, views: 1050, isPinned: false,
    status: 'published', teaser: 'Расшифровка гематологии, гепатологии, липидов и эндокринологии', tags: ['анализы', 'biomarkers', 'здоровье'], publishedAt: '2026-05-10',
  },
];

export const ArticlesScreen: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [currentUser, setCurrentUser] = useState<LocalUserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('nutrition');
  const [newTags, setNewTags] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await db.init();
        const stored: Article[] = await db.getAll('articles') ?? [];
        if (stored.length === 0) {
          for (const a of SEED_ARTICLES) await db.put('articles', a);
          setArticles(SEED_ARTICLES);
        } else {
          setArticles(stored);
        }
      } catch {
        setArticles(SEED_ARTICLES);
      }
      try {
        const profile = await getCurrentProfile();
        setCurrentUser(profile);
        setIsAdmin(profile?.role === 'admin' || profile?.role === 'editor');
      } catch {}
      setLoading(false);
    })();
  }, []);

  const saveArticles = async (updated: Article[]) => {
    setArticles(updated);
    try { for (const a of updated) await db.put('articles', a); } catch {}
  };

  const published = filterArticles(articles, { status: 'published', category: category === 'all' ? undefined : category, search: search || undefined });
  const adminArticles = isAdmin ? filterArticles(articles, { status: statusFilter === 'all' ? undefined : statusFilter, category: category === 'all' ? undefined : category, search: search || undefined }) : [];

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const article = createArticle({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      authorId: currentUser?.id ?? 'anonymous',
      authorName: currentUser?.name ?? 'Аноним',
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      teaser: newContent.trim().substring(0, 150),
      status: 'draft',
    });
    saveArticles([...articles, article]);
    setNewTitle(''); setNewContent(''); setNewCategory('nutrition'); setNewTags(''); setShowCreate(false);
  };

  const handleSubmitReview = (article: Article) => {
    const updated = submitForReview(article, currentUser?.id ?? 'anonymous');
    saveArticles(articles.map(a => a.id === updated.id ? updated : a));
  };

  const handleApprove = (article: Article) => {
    const updated = processReview(article, currentUser?.id ?? 'admin', 'approve');
    saveArticles(articles.map(a => a.id === updated.id ? updated : a));
  };

  const handleReject = (article: Article) => {
    const updated = processReview(article, currentUser?.id ?? 'admin', 'reject');
    saveArticles(articles.map(a => a.id === updated.id ? updated : a));
  };

  if (loading) return <div className="screen articles"><div className="loading-spinner" /></div>;

  return (
    <div className="screen articles">
      <div className="articles-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>База знаний</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Поиск статей..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13 }} />
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13 }}>
            <option value="all">Все категории</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {isAdmin && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13 }}>
              <option value="all">Все статусы</option>
              <option value="draft">Черновики</option>
              <option value="review">На ревью</option>
              <option value="published">Опубликованные</option>
              <option value="archived">Архив</option>
            </select>
          )}
          {isAdmin && (
            <button onClick={() => setShowCreate(true)} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Создать</button>
          )}
        </div>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Новая статья</h3>
          <input type="text" placeholder="Заголовок" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }} />
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, marginBottom: 8 }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea placeholder="Содержание..." value={newContent} onChange={e => setNewContent(e.target.value)} rows={6} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box', resize: 'vertical' }} />
          <input type="text" placeholder="Теги (через запятую)" value={newTags} onChange={e => setNewTags(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Сохранить черновик</button>
            <button onClick={() => setShowCreate(false)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Отмена</button>
          </div>
        </div>
      )}

      {isAdmin && statusFilter !== 'all' && adminArticles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8, fontSize: 14, color: 'var(--text-dim)' }}>Модерация ({STATUS_LABELS[statusFilter as ArticleStatus] ?? statusFilter})</h3>
          {adminArticles.map(a => (
            <div key={a.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
                  <span style={{ fontSize: 11, marginLeft: 8, padding: '2px 6px', borderRadius: 4, background: STATUS_COLORS[a.status] + '22', color: STATUS_COLORS[a.status] }}>{STATUS_LABELS[a.status]}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a.authorName ?? a.authorId} · {new Date(a.updatedAt).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{a.teaser}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {a.status === 'draft' && <button onClick={() => handleSubmitReview(a)} style={{ background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>На ревью</button>}
                {a.status === 'review' && <button onClick={() => handleApprove(a)} style={{ background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>Одобрить</button>}
                {a.status === 'review' && <button onClick={() => handleReject(a)} style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>Отклонить</button>}
                <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>{expandedId === a.id ? 'Свернуть' : 'Читать'}</button>
              </div>
              {expandedId === a.id && <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{a.content}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="articles-grid" style={{ display: 'grid', gap: 12 }}>
        {published.map(article => (
          <div key={article.id} className="article-card" style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16 }}>
            {article.isPinned && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.15)', color: 'var(--accent)', fontWeight: 700, marginBottom: 4, display: 'inline-block' }}>Закреплено</span>}
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{article.title}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px' }}>
              <span>{article.authorName ?? article.authorId}</span> · <span>{new Date(article.publishedAt ?? article.createdAt).toLocaleDateString()}</span> · <span>{CATEGORIES.find(c => c.value === article.category)?.label ?? article.category}</span>
            </p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {article.tags.map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-dim)' }}>{tag}</span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, margin: '0 0 8px' }}>
              {expandedId === article.id ? article.content : article.teaser || article.content.substring(0, 200) + '...'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setExpandedId(expandedId === article.id ? null : article.id)} style={{ background: 'none', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--accent)', padding: '4px 14px', fontSize: 12, cursor: 'pointer' }}>
                {expandedId === article.id ? 'Свернуть' : 'Читать далее →'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{article.views} просмотров · {article.likes} лайков</span>
            </div>
          </div>
        ))}
        {published.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}><p>Статей не найдено. Попробуйте изменить фильтры.</p></div>
        )}
      </div>
    </div>
  );
};