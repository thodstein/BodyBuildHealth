import type { Article, UserRole } from '../core/types';

export function canEditArticle(role: UserRole): boolean {
  return role === 'admin' || role === 'editor';
}

export function canPublishArticle(role: UserRole): boolean {
  return role === 'admin';
}

export function filterArticlesByRole(articles: Article[], role: UserRole): Article[] {
  if (role === 'admin') return articles;
  if (role === 'editor') return articles.filter(a => a.status !== 'archived');
  return articles.filter(a => a.status === 'published');
}
