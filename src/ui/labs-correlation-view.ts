import { analyzeCorrelations } from '../engines/correlation.engine';
import type { LabPoint } from '../core/types';

export function renderLabsCorrelationView(container: HTMLElement, labs: LabPoint[]) {
  const insights = analyzeCorrelations(labs);
  
  container.innerHTML = `
    <div class="card"><h3>🔗 Lab Correlations</h3>
      <div id="correlation-list">
        ${insights.map(i => `
          <div class="correlation-item" data-id="${i.id}">
            <h4>${i.title}</h4>
            <p>Impact: ${i.impact} | Effort: ${i.effort}</p>
            <p>${i.reason}</p>
          </div>
        `).join('')}
      </div>
      <button id="btn-refresh-corr" class="btn">🔄 Refresh</button>
    </div>
  `;

  document.getElementById('btn-refresh-corr')!.onclick = () => {
    renderLabsCorrelationView(container, labs);
  };

  document.querySelectorAll('.correlation-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = (item as HTMLElement).dataset.id;
      console.log('Selected correlation:', id);
    });
  });
}
