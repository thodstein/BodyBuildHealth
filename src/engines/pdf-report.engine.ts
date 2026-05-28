import type { PCTSchedule, LabPoint } from '../core/types';

export interface ReportData {
  userName: string;
  courseWeeks: number;
  labs: LabPoint[];
  pctPlan?: PCTSchedule;
}

export function generatePDFReport(data: ReportData): Blob {
  // Заглушка - в реальности здесь была бы генерация PDF
  const content = `
    REPORT FOR: ${data.userName}
    COURSE DURATION: ${data.courseWeeks} weeks
    LAB RESULTS: ${data.labs.length} markers
  `;
  return new Blob([content], { type: 'text/plain' });
}

export function downloadReport(data: ReportData, filename: string) {
  const blob = generatePDFReport(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
