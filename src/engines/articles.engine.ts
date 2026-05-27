import { Article, ArticleStatus, UserRole } from '../core/types';

export function createArticle(data: { title: string; category: ArticleCategory; teaser: string; content: string; tags: string[]; authorId: string; authorName: string; slug?: string; coverImageUrl?: string }): Article {
  const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: crypto.randomUUID(),
    title: data.title,
    slug,
    teaser: data.teaser,
    content: data.content,
    coverImageUrl: data.coverImageUrl || '',
    tags: data.tags,
    category: data.category,
    authorId: data.authorId,
    authorName: data.authorName,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    likes: 0,
    views: 0,
    isPinned: false
  };
}

export function updateArticle(article: Article, updates: Partial<Article>): Article {
  return {
    ...article,
    ...updates,
    updatedAt: new Date().toISOString(),
    version: article.version + 1
  };
}

export function submitForReview(article: Article, authorId: string): Article {
  if (article.authorId !== authorId) throw new Error('Недостаточно прав для отправки');
  if (article.status !== 'draft') throw new Error('Можно отправить только черновик');
  return { ...article, status: 'review', updatedAt: new Date().toISOString() };
}

export function processReview(article: Article, reviewerId: string, action: 'approve' | 'reject', comment?: string): Article {
  if (!['doctor', 'editor', 'admin'].includes(reviewerId as string)) throw new Error('Недостаточно прав для ревью');
  if (article.status !== 'review') throw new Error('Статья не на ревью');

  const notes = article.content.includes('<!--review:') ? article.content : '';
  const newContent = comment ? `${notes}\n<!--review:${reviewerId}:${action}:${comment}-->` : article.content;

  if (action === 'approve') {
    return { ...article, status: 'published', publishedAt: new Date().toISOString(), content: newContent, updatedAt: new Date().toISOString() };
  }
  return { ...article, status: 'draft', content: newContent, updatedAt: new Date().toISOString() };
}

export function publishArticle(article: Article, editorId: string): Article {
  if (!['editor', 'admin'].includes(editorId as string)) throw new Error('Недостаточно прав для публикации');
  if (article.status !== 'review' && article.status !== 'draft') throw new Error('Можно публиковать только после ревью');
  return { ...article, status: 'published', publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function archiveArticle(article: Article, adminId: string): Article {
  if (adminId !== 'admin') throw new Error('Архивировать может только Admin');
  return { ...article, status: 'archived', updatedAt: new Date().toISOString() };
}

export function canEdit(article: Article, userRole: UserRole, userId: string): boolean {
  if (userRole === 'admin') return true;
  if (userRole === 'editor' && article.status === 'review') return true;
  if (article.authorId === userId && article.status !== 'archived') return true;
  return false;
}

export function canReview(userRole: UserRole): boolean {
  return ['doctor', 'editor', 'admin'].includes(userRole);
}

export function filterArticles(articles: Article[], filter?: { status?: ArticleStatus; category?: string; search?: string; authorId?: string }): Article[] {
  let res = [...articles];
  if (filter?.status) res = res.filter(a => a.status === filter.status);
  if (filter?.category) res = res.filter(a => a.category === filter.category);
  if (filter?.authorId) res = res.filter(a => a.authorId === filter.authorId);
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    res = res.filter(a => a.title.toLowerCase().includes(q) || a.teaser.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q)));
  }
  return res.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
    return new Date(b.publishedAt || b.updatedAt).getTime() - new Date(a.publishedAt || a.updatedAt).getTime();
  });
}