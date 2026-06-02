import type { UserContext, LabPoint, CourseEntry } from '../core/types';

export interface WeeklyReportData {
  ctx: UserContext;
  labs: LabPoint[];
  course: CourseEntry[];
  weightCurrent: number; weightPrev: number;
  measurements: Record<string, number>;
  goal: string; macros: { p: number; f: number; c: number };
  stepsAvg: number; bpAvg: { sys: number; dia: number }; bpNotes: string;
  trainingFeel: string; generalFeel: string;
  meds: string; supplements: string; lastLabDate: string; nextLabDate: string;
  notes: string;
}

export function generateWeeklyReportHTML(data: WeeklyReportData): string {
  const date = new Date().toISOString().slice(0, 10);
  const weekNum = Math.ceil((new Date().getTime() - new Date(data.ctx.courseStartDate || 0).getTime()) / (7 * 24 * 60 * 60 * 1000));

  const courseSummary = data.course.map(c => `${c.substanceId} ${c.doseValue}${c.doseUnit} | ${c.frequency} | Старт: ${c.startWeek}`).join('<br>');
  const labsSummary = data.labs.slice(-5).map(l => `${l.code}: ${l.value} ${l.unit} (${l.date})`).join('<br>');

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:850px;margin:0 auto;padding:24px;color:#111;line-height:1.4;">
      <div style="border-bottom:2px solid #007aff;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;">
        <h1 style="margin:0;font-size:20px;">📅 НЕДЕЛЬНЫЙ ОТЧЁТ | Неделя ${weekNum}</h1>
        <span style="font-size:13px;color:#666;align-self:end;">Дата: ${date}</span>
      </div>

      <h2 style="font-size:15px;border-left:3px solid #30d158;padding-left:8px;margin:16px 0 8px;">1. Вес & Замеры</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:36px;">
        Текущий вес: <b>${data.weightCurrent} кг</b> (изм: ${data.weightCurrent - data.weightPrev > 0 ? '+' : ''}${(data.weightCurrent - data.weightPrev).toFixed(1)} кг).
        Замеры: ${Object.entries(data.measurements).map(([k,v])=>`${k}:${v}см`).join(', ') || 'Не указаны.'}
      </p>

      <h2 style="font-size:15px;border-left:3px solid #007aff;padding-left:8px;margin:16px 0 8px;">2. Цель & БЖУ</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:36px;">
        Вектор: <b>${data.goal}</b>. БЖУ: Б:${data.macros.p} Ж:${data.macros.f} У:${data.macros.c} г.
        [Место для скриншота из FatSecret/MFP]
      </p>

      <h2 style="font-size:15px;border-left:3px solid #ff9f0a;padding-left:8px;margin:16px 0 8px;">3. Бытовая активность</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;">Среднее шагов/день: <b>${data.stepsAvg || '___'}</b></p>

      <h2 style="font-size:15px;border-left:3px solid #ef4444;padding-left:8px;margin:16px 0 8px;">4. Артериальное давление</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;">Среднее АД: <b>${data.bpAvg.sys}/${data.bpAvg.dia} мм рт.ст.</b></p>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:24px;">Симптомы: ${data.bpNotes || 'Нет'}</p>

      <h2 style="font-size:15px;border-left:3px solid #8b5cf6;padding-left:8px;margin:16px 0 8px;">5. Самочувствие на тренировках</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:48px;">${data.trainingFeel || 'Введите данные...'}</p>

      <h2 style="font-size:15px;border-left:3px solid #ec4899;padding-left:8px;margin:16px 0 8px;">6. Общее самочувствие в быту</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:48px;">${data.generalFeel || 'Введите данные...'}</p>

      <h2 style="font-size:15px;border-left:3px solid #f59e0b;padding-left:8px;margin:16px 0 8px;">7. Актуальный курс</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;">Старт: ${data.ctx.courseStartDate || '—'} (${weekNum} нед).<br>Схема: ${courseSummary || 'Курс не активен.'}</p>

      <h2 style="font-size:15px;border-left:3px solid #64748b;padding-left:8px;margin:16px 0 8px;">8. Аптечные препараты</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:36px;">${data.meds || 'Нет'}</p>

      <h2 style="font-size:15px;border-left:3px solid #10b981;padding-left:8px;margin:16px 0 8px;">9. Добавки & БАДы</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:36px;">${data.supplements || 'Нет'}</p>

      <h2 style="font-size:15px;border-left:3px solid #0ea5e9;padding-left:8px;margin:16px 0 8px;">10. Контроль анализов</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;">Последний: ${data.lastLabDate || '___'} | Планируемый: ${data.nextLabDate || '___'}</p>
      <p style="font-size:12px;color:#666;">${labsSummary}</p>

      <h2 style="font-size:15px;border-left:3px solid #d946ef;padding-left:8px;margin:16px 0 8px;">11. Дополнительные заметки</h2>
      <p contenteditable="true" style="border:1px dashed #ccc;padding:8px;min-height:48px;">${data.notes || ''}</p>

      <div style="margin-top:32px;padding-top:12px;border-top:1px solid #000;font-size:12px;color:#666;text-align:center;">
        Отчёт сформирован автоматически в Health Engine TZ v2.5. Поля редактируемы перед печатью.
      </div>
      <style>@media print{body{margin:0;padding:0;}[contenteditable]{border:1px solid #999!important;}}</style>
    </div>
  `;
}

export function triggerPrintReport(html: string, filename: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open(); doc.write(`<html><head><title>${filename}</title></head><body>${html}</body></html>`); doc.close();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 1000); }, 250);
  }
}