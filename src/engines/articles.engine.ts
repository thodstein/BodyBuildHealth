import { Article, ArticleStatus, UserRole } from '../core/types';

const ARTICLES_DB: Article[] = [
  { id:'art1', title:'ПКТ: пошаговый протокол', slug:'pct-protocol', teaser:'Как безопасно восстановить ГГЯ', content:'<p>Полный текст статьи...</p>', coverImageUrl:'', tags:['pct','pharma'], category:'pct', authorId:'u1', authorName:'Dr. Ivanov', status:'published', createdAt:'2024-01-01', updatedAt:'2024-01-05', publishedAt:'2024-01-05', version:1, likes:42, views:315, isPinned:true }
];

export function getArticles(filter?: {status?:ArticleStatus; category?:string; search?:string}): Article[] {
  let res = [...ARTICLES_DB];
  if(filter?.status) res = res.filter(a=>a.status===filter.status);
  if(filter?.category) res = res.filter(a=>a.category===filter.category);
  if(filter?.search) {
    const q = filter.search.toLowerCase();
    res = res.filter(a=>a.title.toLowerCase().includes(q) || a.teaser.toLowerCase().includes(q) || a.tags.some(t=>t.toLowerCase().includes(q)));
  }
  return res.sort((a,b)=> (b.isPinned?1:0) - (a.isPinned?1:0) || new Date(b.publishedAt||b.createdAt).getTime() - new Date(a.publishedAt||a.createdAt).getTime());
}

export function canEdit(article: Article, userRole: UserRole, userId: string): boolean {
  if(userRole==='admin' || userRole==='editor') return true;
  if(userRole==='author' && article.authorId===userId) return true;
  return false;
}

export function canPublish(userRole: UserRole): boolean {
  return ['editor','admin'].includes(userRole);
}

export function shareToTelegram(slug: string, title: string): string {
  return `https://t.me/share/url?url=https://your-mini.app/article/${slug}&text=${encodeURIComponent(title)}`;
}