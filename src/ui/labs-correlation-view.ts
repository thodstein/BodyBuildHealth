import { db } from '../core/db';
import { analyzeLabDrugCorrelation, LabDrugAlert } from '../engines/lab-pharma-correlation.engine';
import type { LabPoint, CourseEntry } from '../core/types';

export async function renderLabsCorrelation(container: HTMLElement, labs: LabPoint[], course: CourseEntry[], phase: string) {
  const alerts = analyzeLabDrugCorrelation(labs, course, phase);
  const markers = ['HCT', 'ALT', 'E2', 'LDL', 'PRL', 'TT'];
  const sorted = [...labs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  container.innerHTML = `
    <div class="card"><h3>🔬 Корреляция Курс ↔ Анализы</h3>
      ${alerts.length ? alerts.map(a => `
        <div style="margin:8px 0;padding:8px;background:#252527;border-radius:8px;border-left:3px solid ${a.severity==='critical'?'var(--danger)':a.severity==='high'?'var(--warning)':'var(--success)'};">
          <div class="row"><span class="label"><b>${a.marker}</b></span><span class="value" style="color:${a.actualStatus==='high'?'var(--danger)':a.actualStatus==='low'?'var(--warning)':'var(--success)'}">${a.value} ${a.unit}</span></div>
          <div style="font-size:11px;color:#8e8e93;">Норма: ${a.expectedRange[0]}–${a.expectedRange[1]} | Причина: ${a.drugCause.join(', ')}</div>
          <div style="font-size:12px;color:var(--button);margin-top:4px;">💡 ${a.recommendation}</div>
        </div>
      `).join('') : '<div class="label" style="padding:12px;">✅ Значимых корреляций не выявлено. Курс совместим с текущими маркерами.</div>'}
    </div>
    <div class="card"><h3>📜 История маркеров</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        ${markers.map(m => `<span class="badge" style="background:var(--tab-active);color:#fff;cursor:pointer;" data-marker="${m}">${m}</span>`).join('')}
      </div>
      <div id="marker-timeline" style="max-height:200px;overflow-y:auto;">
        ${sorted.slice(0, 20).map(l => `<div class="row" style="padding:4px 0;border-bottom:1px solid #3a3a3c;"><span class="label">${l.date} | <b>${l.code}</b></span><span class="value">${l.value} ${l.unit}</span></div>`).join('') || '<div class="label">Нет данных</div>'}
      </div>
    </div>
    <div class="card"><h3>📝 Комментарий врача</h3>
      <textarea id="doctor-note" rows="3" placeholder="Введите клиническое заключение..." style="width:100%;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;"></textarea>
      <button class="btn" style="margin-top:8px;" id="save-note">💾 Сохранить</button>
    </div>
  `;

  container.querySelectorAll('.badge[data-marker]').forEach(badge => {
    (badge as HTMLElement).addEventListener('click', () => {
      const m = (badge as HTMLElement).dataset.marker!;
      const timeline = container.querySelector('#marker-timeline') as HTMLElement;
      if (!timeline) return;
      const filtered = sorted.filter(l => l.code.toUpperCase() === m);
      timeline.innerHTML = filtered.map(l => `<div class="row" style="padding:4px 0;border-bottom:1px solid #3a3a3c;"><span class="label">${l.date} | <b>${l.code}</b></span><span class="value">${l.value} ${l.unit}</span></div>`).join('') || '<div class="label">Нет записей по маркеру</div>';
    });
  });

  const saveNoteBtn = container.querySelector('#save-note') as HTMLButtonElement;
  const doctorNote = container.querySelector('#doctor-note') as HTMLTextAreaElement;
  if (saveNoteBtn && doctorNote) {
    saveNoteBtn.addEventListener('click', async () => {
      const note = doctorNote.value;
      await db.put('doctor_notes', { id: 'correlation_' + phase, note, date: new Date().toISOString() });
      alert('✅ Комментарий сохранён');
    });
  }
}