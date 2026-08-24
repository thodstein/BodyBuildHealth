/**
 * ManualExport.ts — экспорт ручной программы (ICS календарь + helpers).
 */
import type { UserProgram } from '../../../engines/user-program/user-program.types';

function pad(n: number): string { return String(n).padStart(2, '0'); }

function formatIcsDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day); // Monday = 1
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Генерирует ICS-календарь для ручной программы.
 * Каждая сессия — отдельное событие VEVENT.
 * startDate — ISO дата начала недели 1 (по умолчанию следующий понедельник 09:00 UTC).
 */
export function buildProgramIcs(program: UserProgram, startDateIso?: string): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//BodyBuildHealth//ManualProgram//RU');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escapeIcs(program.meta.title || 'Программа')}`);
  const startRef = startDateIso ? new Date(startDateIso) : mondayOfWeek(new Date());
  // normalize to 09:00 UTC
  startRef.setUTCHours(9, 0, 0, 0);
  const uidBase = (program.meta.id || 'manual').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'manual';

  const addWeek = (weekNum: number, sessions: Array<{ name: string; dayOfWeek?: number; focus?: string; blocks: Array<{ exerciseName: string; sets: Array<{ reps: string | number; rir: number; weight?: number }> }> }>, phase: string) => {
    sessions.forEach((s, si) => {
      const dow = typeof s.dayOfWeek === 'number' ? s.dayOfWeek : si % 7; // 0 Mon
      const sessionDate = new Date(startRef);
      sessionDate.setDate(startRef.getDate() + (weekNum - 1) * 7 + dow);
      const endDate = new Date(sessionDate);
      endDate.setHours(sessionDate.getHours() + 1, 15);
      const exList = s.blocks.filter(b => b.exerciseName).slice(0, 5).map(b => b.exerciseName).join(', ');
      const summary = `Нед ${weekNum} · ${s.name || 'Тренировка ' + (si + 1)}${s.focus ? ' (' + s.focus + ')' : ''}`;
      const desc = `Фаза: ${phase}${exList ? '\\nУпражнения: ' + exList : ''}${s.blocks.length ? '\\nСетов: ' + s.blocks.reduce((sum, b) => sum + (b.sets?.length ?? 0), 0) : ''}`;
      const uid = `${uidBase}-w${weekNum}-d${si}-${Date.now().toString(36)}@bodybuildhealth.local`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
      lines.push(`DTSTART:${formatIcsDate(sessionDate)}`);
      lines.push(`DTEND:${formatIcsDate(endDate)}`);
      lines.push(`SUMMARY:${escapeIcs(summary)}`);
      lines.push(`DESCRIPTION:${escapeIcs(desc)}`);
      lines.push('END:VEVENT');
    });
  };

  if (program.bb?.weeks?.length) {
    for (const w of program.bb.weeks) {
      addWeek(w.week, w.sessions as any, w.phase);
    }
  } else if (program.pl?.customWeeks?.length) {
    for (const w of program.pl.customWeeks) {
      const sess = w.days.map((d, di) => ({
        name: d.name, dayOfWeek: (d as any).dayOfWeek ?? di, focus: '', blocks: d.exercises.map(e => ({ exerciseName: e.name, sets: e.sets.map(s => ({ reps: s.reps, rir: s.rir ?? 2, weight: undefined })) })),
      }));
      addWeek(w.week, sess as any, w.phase);
    }
  } else if (program.hybrid?.bbWeeks?.length) {
    for (const w of program.hybrid.bbWeeks) {
      addWeek(w.week, w.sessions as any, w.phase);
    }
  } else {
    // fallback: meta.weeks as empty
    for (let wi = 1; wi <= (program.meta.weeks || 4); wi++) {
      addWeek(wi, [{ name: 'Тренировка', dayOfWeek: 0, focus: '', blocks: [] }], 'accumulation');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : filename + '.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
