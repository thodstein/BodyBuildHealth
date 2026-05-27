import { db } from '../core/db';
import { createArticle, submitForReview, processReview, publishArticle, archiveArticle, canEdit, canReview, filterArticles } from '../engines/articles.engine';
import type { Article, UserRole, ArticleStatus } from '../core/types';

export async function renderArticlesWorkflow(container: HTMLElement, role: UserRole, userId: string = 'user_default') {
  const allArticles: Article[] = await db.getAll('articles') || [];
  const published = filterArticles(allArticles, { status: 'published' });
  const mine = filterArticles(allArticles, { authorId: userId });
  const reviewQueue = canReview(role) ? filterArticles(allArticles, { status: 'review' }) : [];

  container.innerHTML = `
    <div class="card">
      <h3>📚 Управление статьями</h3>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button class="btn" style="width:auto;margin:0;" onclick="document.getElementById('articles-tab-lib').click()">📖 Библиотека</button>
        <button class="btn" style="width:auto;margin:0;background:var(--warning);color:#000;" onclick="document.getElementById('articles-tab-mine').click()">✏️ Мои черновики</button>
        ${canReview(role) ? `<button class="btn" style="width:auto;margin:0;background:var(--danger);color:#fff;" onclick="document.getElementById('articles-tab-review').click()">👨‍⚕️ На ревью (${reviewQueue.length})</button>` : ''}
        <button class="btn" style="width:auto;margin:0;" onclick="document.getElementById('article-create-modal').style.display='flex'">➕ Создать</button>
      </div>
    </div>

    <div class="tabs" id="articles-tabs" style="margin-top:12px;">
      <div class="tab active" id="articles-tab-lib" data-art="lib">📖 Библиотека</div>
      <div class="tab" id="articles-tab-mine" data-art="mine">✏️ Мои черновики</div>
      ${canReview(role) ? `<div class="tab" id="articles-tab-review" data-art="review">👨‍⚕️ На ревью</div>` : ''}
    </div>

    <div id="art-lib" class="art-page active">${renderArticleList(published, 'published')}</div>
    <div id="art-mine" class="art-page" style="display:none;">${renderArticleList(mine, 'mine')}</div>
    ${canReview(role) ? `<div id="art-review" class="art-page" style="display:none;">${renderReviewQueue(reviewQueue)}</div>` : ''}

    <!-- Модалка создания -->
    <div id="article-create-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:100;align-items:center;justify-content:center;">
      <div class="card" style="max-width:95%;width:400px;max-height:90vh;overflow-y:auto;">
        <h3>➕ Новая статья</h3>
        <input id="art-title" type="text" placeholder="Заголовок" style="margin:8px 0;">
        <select id="art-category" style="margin:4px 0;">
          <option value="training">Тренинг</option><option value="nutrition">Питание</option><option value="pharma">Фарма</option>
          <option value="support">Поддержка</option><option value="labs">Лабы</option><option value="pct">ПКТ</option><option value="general">Общее</option>
        </select>
        <input id="art-teaser" type="text" placeholder="Краткое описание (для превью)" style="margin:4px 0;">
        <textarea id="art-content" rows="6" placeholder="Текст статьи (поддержка HTML)" style="width:100%;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;margin:4px 0;"></textarea>
        <input id="art-tags" type="text" placeholder="Теги через запятую (pct, labs, aas...)" style="margin:4px 0;">
        <button class="btn" id="art-save-btn">💾 Сохранить черновик</button>
        <button class="btn" style="background:#8e8e93" onclick="document.getElementById('article-create-modal').style.display='none'">Отмена</button>
      </div>
    </div>
  `;

  // Табы
  container.querySelectorAll('#articles-tabs .tab').forEach(tab => {
    (tab as HTMLElement).onclick = () => {
      container.querySelectorAll('#articles-tabs .tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.art-page').forEach(p => (p as HTMLElement).style.display = 'none');
      tab.classList.add('active');
      (container as any).querySelector(`#art-${(tab as HTMLElement).dataset.art}`)!.style.display = 'block';
    };
  });

  // Создание
  container.getElementById('art-save-btn')!.onclick = async () => {
    const title = (container.getElementById('art-title') as HTMLInputElement).value.trim();
    const category = (container.getElementById('art-category') as HTMLSelectElement).value as any;
    const teaser = (container.getElementById('art-teaser') as HTMLInputElement).value.trim();
    const content = (container.getElementById('art-content') as HTMLTextAreaElement).value.trim();
    const tags = (container.getElementById('art-tags') as HTMLInputElement).value.split(',').map(t=>t.trim()).filter(Boolean);
    if (!title || !content) return alert('⚠️ Заголовок и текст обязательны');

    const newArt = createArticle({ title, category, teaser, content, tags, authorId: userId, authorName: role === 'doctor' ? 'Dr. User' : 'User' });
    await db.put('articles', newArt);
    container.getElementById('article-create-modal')!.style.display = 'none';
    renderArticlesWorkflow(container, role, userId);
  };

  // Действия (делегирование событий)
  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === 'submit') {
      const art = allArticles.find(a => a.id === target.dataset.id)!;
      const updated = submitForReview(art, userId);
      await db.put('articles', updated);
      renderArticlesWorkflow(container, role, userId);
    }
    if (target.dataset.action === 'approve') {
      const art = allArticles.find(a => a.id === target.dataset.id)!;
      const updated = processReview(art, role, 'approve', 'Одобрено');
      await db.put('articles', updated);
      renderArticlesWorkflow(container, role, userId);
    }
    if (target.dataset.action === 'reject') {
      const art = allArticles.find(a => a.id === target.dataset.id)!;
      const comment = prompt('Причина отклонения:') || '';
      const updated = processReview(art, role, 'reject', comment);
      await db.put('articles', updated);
      renderArticlesWorkflow(container, role, userId);
    }
    if (target.dataset.action === 'delete') {
      if (!confirm('Удалить статью?')) return;
      const arts = await db.getAll('articles') as Article[];
      const filtered = arts.filter(a => a.id !== target.dataset.id);
      await db.put('articles', filtered); // В реальном проекте лучше удалить по ID
      renderArticlesWorkflow(container, role, userId);
    }
  });
}

function renderArticleList(articles: Article[], context: 'published' | 'mine'): string {
  if (!articles.length) return `<div class="card"><div class="label">${context==='published'?'Нет опубликованных статей':'У вас нет черновиков'}</div></div>`;
  return articles.map(a => `
    <div class="card" style="margin:8px 0;">
      <div class="row">
        <span class="label"><b>${a.title}</b></span>
        <span class="badge ${a.status==='published'?'s':a.status==='review'?'w':'d'}">${a.status.toUpperCase()}</span>
      </div>
      <div style="font-size:12px;color:#8e8e93;margin:4px 0;">${a.teaser || 'Без описания'}</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">Автор: ${a.authorName} | ${a.category} | ❤️ ${a.likes} | 👁️ ${a.views}</div>
      ${context==='mine' && a.status==='draft' ? `<button class="btn" style="width:auto;margin-top:8px;padding:6px 10px;font-size:12px;" data-action="submit" data-id="${a.id}">📤 Отправить на ревью</button>` : ''}
    </div>
  `).join('');
}

function renderReviewQueue(queue: Article[]): string {
  if (!queue.length) return '<div class="card"><div class="label">Нет статей на ревью</div></div>';
  return queue.map(a => `
    <div class="card" style="margin:8px 0;border-left:3px solid var(--warning);">
      <div class="row"><span class="label"><b>${a.title}</b></span><span class="badge w">REVIEW</span></div>
      <div style="font-size:12px;color:#8e8e93;margin:4px 0;">${a.teaser}</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">Автор: ${a.authorName} | Версия: ${a.version}</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn" style="flex:1;margin:0;padding:8px;font-size:12px;background:var(--success);color:#000;" data-action="approve" data-id="${a.id}">✅ Одобрить</button>
        <button class="btn" style="flex:1;margin:0;padding:8px;font-size:12px;background:var(--danger);" data-action="reject" data-id="${a.id}">❌ Отклонить</button>
      </div>
    </div>
  `).join('');
}