export function exportToJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function exportToCSV(points: any[]): string {
  if (!points.length) return '';
  const headers = Object.keys(points[0]).join(',');
  const rows = points.map(p => Object.values(p).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [headers, ...rows].join('\n');
}

export function generateReportText(data: any): string {
  const d = new Date().toISOString().slice(0, 10);
  let txt = `📊 HEALTH ENGINE REPORT | Дата формирования: ${d}\n\n`;
  
  if (data.readiness?.length) {
    const last = data.readiness[data.readiness.length - 1];
    txt += `✅ Readiness:\n • Recovery: ${last.recovery}%\n • Nutrition: ${last.nutrition}%\n • Fatigue: ${last.fatigue}%\n\n`;
  }
  if (data.risks) {
    txt += `⚖️ Risks:\n • Overall Raw: ${data.risks.overallRaw?.toFixed(1) || 0}%\n • Overall Net: ${data.risks.overallNet?.toFixed(1) || 0}%\n\n`;
  }
  if (data.labs?.length) {
    txt += `🔬 Последние анализы (5):\n`;
    data.labs.slice(-5).forEach((l: any) => {
      txt += ` • ${l.code}: ${l.value} ${l.unit} (${l.phase}) [${l.date}]\n`;
    });
    txt += '\n';
  }
  if (data.training) {
    txt += `🏋️ Тренинг:\n • Сплит: ${data.training.splitName}\n • RIR: ${data.training.rir}\n • Делод: ${data.training.isDeload ? 'Да' : 'Нет'}\n\n`;
  }
  txt += `⚠️ Дисклеймер: Информация носит справочный характер. Не является медицинской рекомендацией. Проконсультируйтесь с врачом перед применением.`;
  return txt;
}

export function downloadFile(content: string, filename: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}