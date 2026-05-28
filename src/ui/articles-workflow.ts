import type { Article, UserRole } from '../core/types';

export function renderArticlesWorkflow(container: HTMLElement, role: UserRole, authorId: string) {
  container.innerHTML = `
    <div class="card"><h3>📚 Articles</h3>
      <input id="art-title" placeholder="Title" style="width:100%;margin:4px 0">
      <textarea id="art-content" placeholder="Content" style="width:100%;margin:4px 0"></textarea>
      <button id="btn-publish" class="btn">📤 Publish</button>
    </div>
  `;

  document.getElementById('btn-publish')!.onclick = () => {
    const title = (document.getElementById('art-title') as HTMLInputElement).value.trim();
    const content = (document.getElementById('art-content') as HTMLTextAreaElement).value.trim();
    if (!title || !content) return alert('Fill all fields');

    const article: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'likes' | 'views' | 'isPinned'> = {
      title, category: 'general', teaser: title.slice(0, 50), content, tags: [],
      authorId, authorName: 'Current User', slug: title.toLowerCase().replace(/\s+/g, '-'),
      coverImageUrl: '', status: 'draft'
    };
    console.log('📤 Article queued:', article);
    alert('Article saved!');
  };
}
