import { MASTER_DB } from '../core/master-db';
import { selectBestStack } from '../engines/stack-builder.engine';
import { assessRisk } from '../engines/risk-assessor.engine';
import { renderStackCard } from './stack-viewer';

export interface DashboardProps {
  userId: string;
  goalId: string;
  labs: any[]; // LabPoint[]
}

/**
 * Главная функІия рендера Дашборда.
 * Вызывается при загрузке страницы или смене данных.
 */
export function renderDashboard(container: HTMLElement, props: DashboardProps): void {
  container.replaceChildren();

  // 1. Подбор стека
  const { stack, score, reason } = selectBestStack(props.goalId);
  
  // 2. Оценка рисков (если стек найден)
  let riskHTML = '<p>Select a goal to analyze risks.</p>';
  let stackHTML = '<p>No stack selected.</p>';
  
  if (stack) {
    // Считаем риски для веществ стека + лабы пользовотеля
    const riskAssessment = assessRisk(stack.substances.map(s => s.id), props.labs);
    
    riskHTML = `
      <div class="risk-panel ${riskAssessment.totalScore > 30 ? 'high' : 'low'}">
        <h3>Risk Assessment</h3>
        <div class="risk-score">Score: ${riskAssessment.totalScore}/100</div>
        <ul>
          ${riskAssessment.activeRisks.map(r => `<li>⚠️ ${r.title || r.id} (${r.level || 'Medium'})</li>`).join('')}
        </ul>
        <h4>Recommendations:</h4>
        <ul>
          ${riskAssessment.recommendations.map(r => `<li>💡 ${r.text}</li>`).join('')}
        </ul>
      </div>
    `;

    stackHTML = renderStackCard(stack);
  }

  // 3. Сборка HTML
  const dashboardContainer = document.createElement('div');
  dashboardContainer.className = 'dashboard-container';

  const header = document.createElement('header');
  header.innerHTML = `
    <h1>Health Engine Dashboard</h1>
    <div class="user-info">User: ${props.userId} | Goal: ${props.goalId}</div>
  `;
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.textContent = 'Logout';
  logoutBtn.style.marginLeft = '16px';
  logoutBtn.style.padding = '8px';
  logoutBtn.style.background = 'var(--danger)';
  logoutBtn.style.color = '#fff';
  logoutBtn.style.border = 'none';
  logoutBtn.style.borderRadius = '4px';
  logoutBtn.style.cursor = 'pointer';
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('he_session_v2');
    window.location.reload();
  });
  header.appendChild(logoutBtn);
  dashboardContainer.appendChild(header);

  const main = document.createElement('main');

  const stackSection = document.createElement('section');
  stackSection.className = 'stack-section';
  const stackHeader = document.createElement('h2');
  stackHeader.textContent = 'Your Protocol';
  stackSection.appendChild(stackHeader);
  const stackList = document.createElement('div');
  stackList.className = 'stack-list';
  stackList.innerHTML = stackHTML;
  stackSection.appendChild(stackList);
  main.appendChild(stackSection);

  const riskSection = document.createElement('section');
  riskSection.className = 'risk-section';
  riskSection.innerHTML = riskHTML;
  main.appendChild(riskSection);

  dashboardContainer.appendChild(main);
  container.appendChild(dashboardContainer);
}
