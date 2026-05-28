import { resolveSubstancesForStack } from '../engines/stack-builder.engine';
import { checkInteractions, formatInteractions } from '../engines/interaction-checker.engine';
import type { StackEntry } from '../core/types';

/**
 * Рендерит HTML карточки стека.
 */
export function renderStackCard(stack: StackEntry): string {
  const substances = resolveSubstancesForStack(stack);
  const interactionAnalysis = checkInteractions(stack.substances);
  const interactionHTML = formatInteractions(interactionAnalysis);

  return `
    <div class="card stack-card" id="stack-card">
      <div class="card-header">
        <h3>Stack: ${stack.id}</h3>
        <span class="badge score">Synergy: ${stack.synergy_score}</span>
      </div>
      <div class="card-body">
        <h4>Substances (${substances.length}):</h4>
        <ul class="substance-list">
          ${substances.map(s => `
            <li class="substance-item ${s.category}">
              <span class="name">${s.name}</span>
              <span class="cat">${s.category}</span>
              <span class="route">${s.route.join('/')}</span>
            </li>
          `).join('')}
        </ul>
        
        <div class="interactions-section">
          ${interactionHTML}
        </div>
      </div>
    </div>
  `;
}