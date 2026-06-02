import { db } from '../core/db';
import { analyzeLabDrugCorrelation, LabDrugAlert } from '../engines/lab-pharma-correlation.engine';
import type { LabPoint, CourseEntry } from '../core/types';

export async function renderLabsCorrelation(container: HTMLElement, labs: LabPoint[], course: CourseEntry[], phase: string) {
  const alerts = analyzeLabDrugCorrelation(labs, course, phase);
  const markers = ['HCT', 'ALT', 'E2', 'LDL', 'PRL', 'TT'];
  const sorted = [...labs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  container.innerHTML = `
    <div class="card"><h3>рџ”¬ РљРѕСЂСЂРµР»СЏС†РёСЏ РљСѓСЂСЃ в†” РђРЅР°Р»РёР·С‹</h3>
      ${alerts.length ? alerts.map(a => `
        <div style="margin:8px 0;padding:8px;background:#252527;border-radius:8px;border-left:3px solid ${a.severity==='critical'?'var(--danger)':a.severity==='high'?'var(--warning)':'var(--success)'};">
          <div class="row"><span class="label"><b>${a.marker}</b></span><span class="value" style="color:${a.actualStatus==='high'?'var(--danger)':a.actualStatus==='low'?'var(--warning)':'var(--success)'}">${a.value} ${a.unit}</span></div>
          <div style="font-size:11px;color:#8e8e93;">РќРѕСЂРјР°: ${a.expectedRange[0]}вЂ“${a.expectedRange[1]} | РџСЂРёС‡РёРЅР°: ${a.drugCause.join(', ')}</div>
          <div style="font-size:12px;color:var(--button);margin-top:4px;">рџ’Ў ${a.recommendation}</div>
        </div>
      `).join('') : '<div class="label" style="padding:12px;">вњ… Р—РЅР°С‡РёРјС‹С… РєРѕСЂСЂРµР»СЏС†РёР№ РЅРµ РІС‹СЏРІР»РµРЅРѕ. РљСѓСЂСЃ СЃРѕРІРјРµСЃС‚РёРј СЃ С‚РµРєСѓС‰РёРјРё РјР°СЂРєРµСЂР°РјРё.</div>'}
    </div>
    <div class="card"><h3>рџ“њ РСЃС‚РѕСЂРёСЏ РјР°СЂРєРµСЂРѕРІ</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        ${markers.map(m => `<span class="badge" style="background:var(--tab-active);color:#fff;cursor:pointer;" data-marker="${m}">${m}</span>`).join('')}
      </div>
      <div id="marker-timeline" style="max-height:200px;overflow-y:auto;">
        ${sorted.slice(0, 20).map(l => `<div class="row" style="padding:4px 0;border-bottom:1px solid #3a3a3c;"><span class="label">${l.date} | <b>${l.code}</b></span><span class="value">${l.value} ${l.unit}</span></div>`).join('') || '<div class="label">РќРµС‚ РґР°РЅРЅС‹С…</div>'}
      </div>
    </div>
    <div class="card"><h3>рџ“ќ РљРѕРјРјРµРЅС‚Р°СЂРёР№ РІСЂР°С‡Р°</h3>
      <textarea id="doctor-note" rows="3" placeholder="Р’РІРµРґРёС‚Рµ РєР»РёРЅРёС‡РµСЃРєРѕРµ Р·Р°РєР»СЋС‡РµРЅРёРµ..." style="width:100%;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;"></textarea>
      <button class="btn" style="margin-top:8px;" id="save-note">рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ</button>
    </div>
  `;

  // Attach event listeners safely
  const badgeElements = container.querySelectorAll('.badge[data-marker]');
  badgeElements.forEach(badge => {
    badge.addEventListener('click', () => {
      const markerAttr = badge.getAttribute('data-marker');
      if (!markerAttr) return;
      const m = markerAttr.toUpperCase();
      const timelineElement = container.querySelector('#marker-timeline') as HTMLElement | null;
      if (!timelineElement) return;
      const filtered = sorted.filter(l => l.code.toUpperCase() === m);
      timelineElement.innerHTML = filtered.map(l => `<div class="row" style="padding:4px 0;border-bottom:1px solid #3a3a3c;"><span class="label">${l.date} | <b>${l.code}</b></span><span class="value">${l.value} ${l.unit}</span></div>`).join('') || '<div class="label">РќРµС‚ Р·Р°РїРёСЃРµР№ РїРѕ РјР°СЂРєРµСЂСѓ</div>';
    });
  });

  const saveNoteBtn = container.querySelector('#save-note') as HTMLButtonElement | null;
  const doctorNoteEl = container.querySelector('#doctor-note') as HTMLTextAreaElement | null;
  if (saveNoteBtn && doctorNoteEl) {
    saveNoteBtn.addEventListener('click', async () => {
      const note = doctorNoteEl.value;
      await db.put('doctor_notes', { id: 'correlation_' + phase, note, date: new Date().toISOString() });
      alert('вњ… РљРѕРјРјРµРЅС‚Р°СЂРёР№ СЃРѕС…СЂР°РЅС‘РЅ');
    });
  }
}
