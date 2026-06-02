import { analyzeInteractions } from '../engines/interaction-checker.engine';

export function renderStackCard(stack: any): string {
  const substances = stack.substances;
  const substanceIds: string[] = substances.map((s: any) => s.id);
  const interactionResult = analyzeInteractions(substanceIds);
  const interactionHTML = interactionResult.conflicts.length > 0
    ? interactionResult.conflicts.map((c: any) => `<div class="interaction conflict">${c.substanceA} + ${c.substanceB}: ${c.type || 'conflict'} (${c.severity})</div>`).join('')
    : interactionResult.synergies.length > 0
      ? interactionResult.synergies.map((s: any) => `<div class="interaction synergy">${s.substanceA} + ${s.substanceB}: synergy</div>`).join('')
      : '<div style="color:var(--success);">✅ No interactions</div>';

  return `
    <div class="card stack-card" id="stack-card">
      <div class="card-header">
        <h3>Stack: ${stack.id}</h3>
        <span class="badge score">Synergy: ${stack.synergy_score}</span>
      </div>
      <div class="card-body">
        <h4>Substances (${substances.length}):</h4>
        <ul class="substance-list">
          ${substances.map((s: any) => `
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
