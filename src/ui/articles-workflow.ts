import { db } from '../core/db';
import { createArticle, submitForReview, processReview, publishArticle, archiveArticle, canEdit, canReview, filterArticles } from '../engines/articles.engine';
import type { Article, UserRole, ArticleStatus } from '../core/types';

export async function renderArticlesWorkflow(container: HTMLElement, role: UserRole, userId: string = 'user_default') {
  // Clear container
  container.replaceChildren();

  let allArticles = (await db.getAll('articles') || []) as Article[];
  let published = filterArticles(allArticles, { status: 'published' });
  let mine = filterArticles(allArticles, { authorId: userId });
  let reviewQueue = canReview(role) ? filterArticles(allArticles, { status: 'review' }) : [];

  // Main card
  const mainCard = document.createElement('div');
  mainCard.className = 'card';
  container.appendChild(mainCard);

  const header = document.createElement('div');
  header.innerHTML = `
    <h3>📚 Управление статьями</h3>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <button class="btn" style="width:auto;margin:0;" id="tab-lib">📖 Библиотека</button>
      <button class="btn" style="width:auto;margin:0;background:var(--warning);color:#000;" id="tab-mine">✏️ Мои черновики</button>
      ${canReview(role) ? `<button class="btn" style="width:auto;margin:0;background:var(--danger);color:#fff;" id="tab-review">👨‍⚕️ На ревью (${reviewQueue.length})</button>` : ''}
      <button class="btn" style="width:auto;margin:0;" id="btn-create">➕ Создать</button>
    </div>
  `;
  mainCard.appendChild(header);

  // Tabs container (we'll use the buttons as tabs)
  // We'll create a container for the tab content
  const tabContent = document.createElement('div');
  tabContent.style.marginTop = '12px';
  mainCard.appendChild(tabContent);

  // Article list containers
  const libContainer = document.createElement('div');
  libContainer.id = 'art-lib';
  libContainer.className = 'art-page';
  libContainer.style.display = 'block';
  const mineContainer = document.createElement('div');
  mineContainer.id = 'art-mine';
  mineContainer.className = 'art-page';
  mineContainer.style.display = 'none';
  const reviewContainer = document.createElement('div');
  reviewContainer.id = 'art-review';
  reviewContainer.className = 'art-page';
  reviewContainer.style.display = canReview(role) ? 'block' : 'none';

  tabContent.appendChild(libContainer);
  tabContent.appendChild(mineContainer);
  if (canReview(role)) {
    tabContent.appendChild(reviewContainer);
  }

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'article-create-modal';
  modal.style.display = 'none';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.background = 'rgba(0,0,0,0.85)';
  modal.style.zIndex = '100';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  container.appendChild(modal);

  const modalCard = document.createElement('div');
  modalCard.className = 'card';
  modalCard.style.maxWidth = '95%';
  modalCard.style.width = '400px';
  modalCard.style.maxHeight = '90vh';
  modalCard.style.overflowY = 'auto';
  modal.appendChild(modalCard);

  const modalHeader = document.createElement('h3');
  modalHeader.textContent = '➕ Новая статья';
  modalCard.appendChild(modalHeader);

  const titleInput = document.createElement('input');
  titleInput.id = 'art-title';
  titleInput.type = 'text';
  titleInput.placeholder = 'Заголовок';
  titleInput.style.margin = '8px 0';
  modalCard.appendChild(titleInput);

  const categorySelect = document.createElement('select');
  categorySelect.id = 'art-category';
  categorySelect.style.margin = '4px 0';
  const categories = ['training', 'nutrition', 'pharma', 'support', 'labs', 'pct', 'general'];
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat === 'training' ? 'Тренинг' :
                     cat === 'nutrition' ? 'Питание' :
                     cat === 'pharma' ? 'Фарма' :
                     cat === 'support' ? 'Поддержка' :
                     cat === 'labs' ? 'Лабы' :
                     cat === 'pct' ? 'ПКТ' :
                     'Общее';
    categorySelect.appendChild(option);
  });
  modalCard.appendChild(categorySelect);

  const teaserInput = document.createElement('input');
  teaserInput.id = 'art-teaser';
  teaserInput.type = 'text';
  teaserInput.placeholder = 'Краткое описание (для превью)';
  teaserInput.style.margin = '4px 0';
  modalCard.appendChild(teaserInput);

  const contentInput = document.createElement('textarea');
  contentInput.id = 'art-content';
  contentInput.rows = 6;
  contentInput.placeholder = 'Текст статьи (поддержка HTML)';
  contentInput.style.width = '100%';
  contentInput.style.padding = '8px';
  contentInput.style.background = '#252527';
  contentInput.style.color = '#fff';
  contentInput.style.border = '1px solid #3a3a3c';
  contentInput.style.borderRadius = '8px';
  contentInput.style.margin = '4px 0';
  modalCard.appendChild(contentInput);

  const tagsInput = document.createElement('input');
  tagsInput.id = 'art-tags';
  tagsInput.type = 'text';
  tagsInput.placeholder = 'Теги через запятую (pct, labs, aas...)';
  tagsInput.style.margin = '4px 0';
  modalCard.appendChild(tagsInput);

  const saveBtn = document.createElement('button');
  saveBtn.id = 'art-save-btn';
  saveBtn.className = 'btn';
  saveBtn.textContent = '💾 Сохранить черновик';
  modalCard.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.style.background = '#8e8e93';
  cancelBtn.textContent = 'Отмена';
  modalCard.appendChild(cancelBtn);

  // Render initial article lists
  const updateArticleLists = () => {
    libContainer.replaceChildren();
    libContainer.appendChild(renderArticleList(published, 'published'));
    mineContainer.replaceChildren();
    mineContainer.appendChild(renderArticleList(mine, 'mine'));
    if (canReview(role)) {
      reviewContainer.replaceChildren();
      reviewContainer.appendChild(renderReviewQueue(reviewQueue));
    }
  };
  updateArticleLists();

  // Tab switching
  const setActiveTab = (activeId: string) => {
    container.querySelectorAll('#tab-lib, #tab-mine, #tab-review').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = container.querySelector(`#${activeId}`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
    libContainer.style.display = activeId === 'tab-lib' ? 'block' : 'none';
    mineContainer.style.display = activeId === 'tab-mine' ? 'block' : 'none';
    reviewContainer.style.display = (activeId === 'tab-review' && canReview(role)) ? 'block' : 'none';
  };

  // Set initial tab
  setActiveTab('tab-lib');

  // Tab click listeners
  const tabLibBtn = container.querySelector('#tab-lib');
  if (tabLibBtn) {
    tabLibBtn.addEventListener('click', () => setActiveTab('tab-lib'));
  }
  const tabMineBtn = container.querySelector('#tab-mine');
  if (tabMineBtn) {
    tabMineBtn.addEventListener('click', () => setActiveTab('tab-mine'));
  }
  if (canReview(role)) {
    const tabReviewBtn = container.querySelector('#tab-review');
    if (tabReviewBtn) {
      tabReviewBtn.addEventListener('click', () => setActiveTab('tab-review'));
    }
  }

  // Create article modal listeners
  const openModal = () => {
    modal.style.display = 'flex';
  };
  const closeModal = () => {
    modal.style.display = 'none';
    // Reset form
    titleInput.value = '';
    categorySelect.value = 'training';
    teaserInput.value = '';
    contentInput.value = '';
    tagsInput.value = '';
  };
  const btnCreate = container.querySelector('#btn-create');
  if (btnCreate) {
    btnCreate.addEventListener('click', openModal);
  }
  cancelBtn.addEventListener('click', closeModal);

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const category = categorySelect.value as 'training' | 'nutrition' | 'pharma' | 'support' | 'labs' | 'pct' | 'general';
    const teaser = teaserInput.value.trim();
    const content = contentInput.value.trim();
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    if (!title || !content) {
      return alert('⚠️ Заголовок и текст обязательны');
    }

    const newArt = createArticle({ title, category, teaser, content, tags, authorId: userId, authorName: role === 'doctor' ? 'Dr. User' : 'User', status: 'draft' });
    await db.put('articles', newArt);
    closeModal();
    // Update lists
    allArticles = (await db.getAll('articles') || []) as Article[];
    published = filterArticles(allArticles, { status: 'published' });
    mine = filterArticles(allArticles, { authorId: userId });
    reviewQueue = canReview(role) ? filterArticles(allArticles, { status: 'review' }) : [];
    updateArticleLists();
  });

  // Article list actions (using event delegation)
  tabContent.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (action === 'submit' && id) {
      const art = allArticles.find(a => a.id === id);
      if (!art) return;
      const updated = submitForReview(art, userId);
      await db.put('articles', updated);
      allArticles = (await db.getAll('articles') || []) as Article[];
      published = filterArticles(allArticles, { status: 'published' });
      mine = filterArticles(allArticles, { authorId: userId });
      reviewQueue = canReview(role) ? filterArticles(allArticles, { status: 'review' }) : [];
      updateArticleLists();
    }
    if (action === 'approve' && id) {
      const art = allArticles.find(a => a.id === id);
      if (!art) return;
      const updated = processReview(art, role, 'approve', 'Одобрено');
      await db.put('articles', updated);
      allArticles = (await db.getAll('articles') || []) as Article[];
      published = filterArticles(allArticles, { status: 'published' });
      mine = filterArticles(allArticles, { authorId: userId });
      reviewQueue = canReview(role) ? filterArticles(allArticles, { status: 'review' }) : [];
      updateArticleLists();
    }
    if (action === 'reject' && id) {
      const art = allArticles.find(a => a.id === id);
      if (!art) return;
      const comment = prompt('Причина отклонения:') || '';
      const updated = processReview(art, role, 'reject', comment);
      await db.put('articles', updated);
      allArticles = (await db.getAll('articles') || []) as Article[];
      published = filterArticles(allArticles, { status: 'published' });
      mine = filterArticles(allArticles, { authorId: userId });
      reviewQueue = canReview(role) ? filterArticles(allArticles, { status: 'review' }) : [];
      updateArticleLists();
    }
    if (action === 'delete' && id) {
      if (!confirm('Удалить статью?')) return;
      const filtered = allArticles.filter(a => a.id !== id);
      await db.put('articles', filtered);
      allArticles = (await db.getAll('articles') || []) as Article[];
      published = filterArticles(allArticles, { status: 'published' });
      mine = filterArticles(allArticles, { authorId: userId });
      reviewQueue = canReview(role) ? filterArticles(allArticles, { status: 'review' }) : [];
      updateArticleLists();
    }
  });
}

// Helper function to render article list as DOM element
function renderArticleList(articles: Article[], context: 'published' | 'mine'): HTMLElement {
  if (!articles.length) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="label">${context==='published'?'Нет опубликованных статей':'У вас нет черновиков'}</div>`;
    return div;
  }
  const container = document.createElement('div');
  articles.forEach(a => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.margin = '8px 0';

    const row = document.createElement('div');
    row.className = 'row';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'label';
    titleSpan.innerHTML = `<b>${a.title}</b>`;
    const badgeSpan = document.createElement('span');
    badgeSpan.className = `badge ${a.status==='published'?'s':a.status==='review'?'w':'d'}`;
    badgeSpan.textContent = a.status.toUpperCase();
    row.appendChild(titleSpan);
    row.appendChild(badgeSpan);
    card.appendChild(row);

    const teaserDiv = document.createElement('div');
    teaserDiv.style.fontSize = '12px';
    teaserDiv.style.color = '#8e8e93';
    teaserDiv.style.margin = '4px 0';
    teaserDiv.textContent = a.teaser || 'Без описания';
    card.appendChild(teaserDiv);

    const metaDiv = document.createElement('div');
    metaDiv.style.fontSize = '11px';
    metaDiv.style.color = '#666';
    metaDiv.style.marginTop = '4px';
    metaDiv.textContent = `Автор: ${a.authorName} | ${a.category} | ❤️ ${a.likes} | 👁️ ${a.views}`;
    card.appendChild(metaDiv);

    if (context==='mine' && a.status==='draft') {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.width = 'auto';
      btn.style.marginTop = '8px';
      btn.style.padding = '6px 10px';
      btn.style.fontSize = '12px';
      btn.setAttribute('data-action', 'submit');
      btn.setAttribute('data-id', a.id);
      btn.textContent = '📤 Отправить на ревью';
      card.appendChild(btn);
    }

    container.appendChild(card);
  });
  return container;
}

// Helper function to render review queue as DOM element
function renderReviewQueue(queue: Article[]): HTMLElement {
  if (!queue.length) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = '<div class="label">Нет статей на ревью</div>';
    return div;
  }
  const container = document.createElement('div');
  queue.forEach(a => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.margin = '8px 0';
    card.style.borderLeft = '3px solid var(--warning)';

    const row = document.createElement('div');
    row.className = 'row';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'label';
    titleSpan.innerHTML = `<b>${a.title}</b>`;
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'badge w';
    badgeSpan.textContent = 'REVIEW';
    row.appendChild(titleSpan);
    row.appendChild(badgeSpan);
    card.appendChild(row);

    const teaserDiv = document.createElement('div');
    teaserDiv.style.fontSize = '12px';
    teaserDiv.style.color = '#8e8e93';
    teaserDiv.style.margin = '4px 0';
    teaserDiv.textContent = a.teaser;
    card.appendChild(teaserDiv);

    const metaDiv = document.createElement('div');
    metaDiv.style.fontSize = '11px';
    metaDiv.style.color = '#666';
    metaDiv.style.marginTop = '4px';
    metaDiv.textContent = `Автор: ${a.authorName} | Версия: ${a.version}`;
    card.appendChild(metaDiv);

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginTop = '8px';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'btn';
    approveBtn.style.flex = '1';
    approveBtn.style.margin = '0';
    approveBtn.style.padding = '8px';
    approveBtn.style.fontSize = '12px';
    approveBtn.style.background = 'var(--success)';
    approveBtn.style.color = '#000';
    approveBtn.setAttribute('data-action', 'approve');
    approveBtn.setAttribute('data-id', a.id);
    approveBtn.textContent = '✅ Одобрить';
    btnContainer.appendChild(approveBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn';
    rejectBtn.style.flex = '1';
    rejectBtn.style.margin = '0';
    rejectBtn.style.padding = '8px';
    rejectBtn.style.fontSize = '12px';
    rejectBtn.style.background = 'var(--danger)';
    rejectBtn.setAttribute('data-action', 'reject');
    rejectBtn.setAttribute('data-id', a.id);
    rejectBtn.textContent = '❌ Отклонить';
    btnContainer.appendChild(rejectBtn);

    card.appendChild(btnContainer);
    container.appendChild(card);
  });
  return container;
}
