import React, { useEffect, useState } from 'react';
import { filterArticles } from '../../engines/articles.engine';
import type { Article } from '../../core/types';

export const ArticlesScreen: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    setLoading(false);
    setArticles([
      {
        id: '1',
        title: 'Основы нутрициологии для спортсменов',
        content: 'Подробное руководство по питанию для достижения спортивных целей...',
        category: 'nutrition',
        authorId: 'team',
        createdAt: '2026-05-01',
        updatedAt: '2026-05-01',
        version: 1,
        likes: 0,
        views: 0,
        isPinned: false,
        status: 'published' as const,
        teaser: '',
        tags: ['питание', 'спорт', 'добавки'],
        publishedAt: '2026-05-01'
      },
      {
        id: '2',
        title: 'Понимание фармакокинетики стероидов',
        content: 'Как ААС работают в организме: абсорбция, распределение, метаболизм, выведение...',
        category: 'pharma',
        authorId: 'dr-pharm',
        createdAt: '2026-05-15',
        updatedAt: '2026-05-15',
        version: 1,
        likes: 0,
        views: 0,
        isPinned: false,
        status: 'published' as const,
        teaser: '',
        tags: ['фармакология', 'ААС', 'PK/PD'],
        publishedAt: '2026-05-15'
      },
      {
        id: '3',
        title: 'Анализ крови: что показывают ключевые biomarkery',
        content: 'Расшифровка результатов лабораторных анализов для оптимизации здоровья...',
        category: 'labs',
        authorId: 'lab-spec',
        createdAt: '2026-05-10',
        updatedAt: '2026-05-10',
        version: 1,
        likes: 0,
        views: 0,
        isPinned: false,
        status: 'published' as const,
        teaser: '',
        tags: ['анализы', 'biomarkers', 'здоровье'],
        publishedAt: '2026-05-10'
      }
    ]);
  }, []);

  const filteredArticles = articles.filter(article => 
    (category === 'all' || article.category === category) &&
    article.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="screen articles">Р—Р°РіСЂСѓР·РєР° Статьи...</div>;
  }

  return (
    <div className="screen articles">
      <div className="articles-header">
        <h2>База знаний</h2>
        <div className="articles-filters">
          <input 
            type="text" 
            placeholder="Поиск статей..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="search-input"
          />
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            className="category-select"
          >
            <option value="all">Все категории</option>
            <option value="nutrition">Питание</option>
            <option value="pharma">Фармакология</option>
            <option value="labs">Лаборатория</option>
            <option value="training">Тренировки</option>
            <option value="support">Поддержка</option>
          </select>
        </div>
      </div>
      
      <div className="articles-grid">
        {filteredArticles.map(article => (
          <div key={article.id} className="article-card">
            {article.isPinned && <span className="premium-badge">PREMIUM</span>}
            <h3>{article.title}</h3>
            <p className="article-meta">
              <span>{article.authorId}</span> ·
              <span>{new Date(article.publishedAt ?? article.createdAt).toLocaleDateString()}</span> ·
              <span>{article.category}</span>
            </p>
            <div className="article-tags">
              {article.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <p className="article-preview">{article.content.substring(0, 200)}...</p>
            <button className="btn-read-more">Читать далее →</button>
          </div>
        ))}
        
        {filteredArticles.length === 0 && (
          <div className="empty-state">
            <p>Статей не найдено. Попробуйте изменить фильтры поиска.</p>
          </div>
        )}
      </div>
    </div>
  );
};
