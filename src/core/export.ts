import { ExportData, LabPoint } from '../core/types';

export function exportToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function exportToCSV(points: LabPoint[]): string {
  if (!points.length) return '';
  const header = 'date,code,value,unit,phase,source\n';
  const rows = points.map(p => `${p.date},${p.code},${p.value},${p.unit},${p.phase},${p.source||''}`).join('\n');
  return header + rows;
}

export function downloadFile(content: string, filename: string, mime='text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function generateReportText(data: ExportData): string {
  let txt = `📊 HEALTH ENGINE REPORT\nДата: ${new Date().toISOString().slice(0,10)}\n\n`;
  if (data.readiness.length) {
    const last = data.readiness[data.readiness.length-1];
    txt += `✅ Readiness: Rec=${last.recovery}%, Nut=${last.nutrition}%, Fat=${last.fatigue}%\n`;
  }
  txt += `\n🔬 LABS (последние 5):\n`;
  data.labs.slice(-5).forEach(l => { txt += ` • ${l.code}: ${l.value} ${l.unit} (${l.phase})\n`; });
  txt += `\n⚠️ Дисклеймер: Информация справочная. Не является медицинской рекомендацией.`;
  return txt;
}