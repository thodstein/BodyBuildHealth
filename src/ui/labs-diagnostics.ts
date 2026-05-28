import { db } from '../core/db';
import { processLabFile } from '../core/ocr-engine';
import type { LabPoint, ParsedLabResult } from '../core/types';

export async function renderLabsDiagnostics(container: HTMLElement) {
  const labs: LabPoint[] = await db.getAll('labs_log') || [];
  
  container.innerHTML = `
    <div class="card"><h3>🧪 Lab Diagnostics</h3>
      <input type="file" id="ocr-input" accept="image/*" style="margin:8px 0">
      <div id="ocr-preview"></div>
      <button id="btn-add-lab" class="btn">➕ Manual Add</button>
      <div id="lab-list">${labs.map(l => `<div class="row"><span class="label">${l.code}</span><span class="value">${l.value} ${l.unit}</span></div>`).join('')}</div>
    </div>
  `;

  const fileInput = document.getElementById('ocr-input') as HTMLInputElement;
  fileInput.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const preview = document.getElementById('ocr-preview')!;
    preview.innerHTML = '⏳ Processing...';
    const { labs: parsed } = await processLabFile(file);
    preview.innerHTML = `✅ Parsed ${parsed.length} markers: ${parsed.map(p => p.marker).join(', ')}`;
  };

  document.getElementById('btn-add-lab')!.onclick = async () => {
    const code = prompt('Marker code (e.g., ALT):')?.toUpperCase();
    const val = parseFloat(prompt('Value:') || '0');
    if (code && !isNaN(val)) {
      await db.put('labs_log', { id: crypto.randomUUID(), code, name: code, value: val, unit: 'U/L', date: new Date().toISOString(), phase: 'baseline' });
      renderLabsDiagnostics(container);
    }
  };
}
