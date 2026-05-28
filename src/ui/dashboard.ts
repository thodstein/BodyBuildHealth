import { MASTER_DB } from '../core/master-db';
import { selectBestStack } from '../engines/stack-builder.engine';
import { assessRisk } from '../engines/risk-assessor.engine';
import { renderStackCard } from './stack-viewer';

// Типы для пропсов (если используется React/Vue) или просто интерфейс функции
interface DashboardProps {
  userId: string;
  goalId: string;
  labs: any[]; // LabPoint[]
}

/**
 * Главная функция рендера Дашборда.
 * Вызывается при загрузке страницы или смене данных.
 */
export function renderDashboard(props: DashboardProps): string {
  // 1. Подбор стека
  const { stack, score, reason } = selectBestStack(props.goalId);
  
  // 2. Оценка рисков (если стек найден)
  let riskHTML = '<p>Select a goal to analyze risks.</p>';
  let stackHTML = '<p>No stack selected.</p>';
  
  if (stack) {
    // Считаем риски для веществ стека + лабы пользователя
    const riskAssessment = assessRisk(stack.substances, props.labs);
    
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
  return `
    <div class="dashboard-container">
      <header>
        <h1>Health Engine Dashboard</h1>
        <div class="user-info">User: ${props.userId} | Goal: ${props.goalId}</div>
      </header>
      
      <main>
        <section class="stack-section">
          <h2>Your Protocol</h2>
          <div class="stack-list">
            ${stackHTML}
          </div>
        </section>

        <section class="risk-section">
          ${riskHTML}
        </section>
      </main>
    </div>
  `;
}