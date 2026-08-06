import type { FullProgram, ProgramDay, ProgramWeek } from './complete-program-library.engine';

export type OriginalSource = {
  id: string;
  name: string;
  file: string;
  textFile: string;
  format: 'MD' | 'DOCX';
  daysPerWeek: number;
};

export async function loadOriginalPrograms(sources: readonly OriginalSource[], baseUrl = '/original-programs/'): Promise<FullProgram[]> {
  const loaded = await Promise.all(sources.map(async source => {
    const response = await fetch(baseUrl + source.textFile);
    if (!response.ok) throw new Error(`Не удалось загрузить ${source.name}`);
    return parseOriginalProgram(source, await response.text());
  }));
  return loaded;
}

const DAY_RE = /^(?:#{1,4}\s*)?(?:Д\s*\d+|Д\d+|ПН|ВТ|СР|ЧТ|ПТ|СБ|ВС)\s*[—–-]/i;
const EXERCISE_ROW_RE = /^\|?\s*([^|]+?)\s*\|\s*(\d+(?:-\d+)?)\s*\|\s*([^|]+?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|(?:\s*([^|]+?)\s*\|)?/;
const SETS_RE = /^(\d+)\s*[×x*]\s*([^,]+?)(?:,\s*RIR\s*([\d.]+))?(?:,\s*(.*))?$/i;

function clean(value: string): string {
  return value.replace(/\*+/g, '').replace(/^\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim();
}

function parseExercise(name: string, sets: string, reps: string, rir: string, note: string): ProgramDay['exercises'][number] {
  const parsed = SETS_RE.exec(sets.trim());
  const setCount = parsed ? Number(parsed[1]) : Number(sets.match(/\d+/)?.[0] || 1);
  const parsedReps = parsed?.[2] || reps.trim();
  const parsedRir = Number(parsed?.[3] || rir || (Number(parsedRirFallback(parsedReps)) <= 6 ? parsedRirFallback(parsedReps) : 2));
  const restMatch = `${parsed?.[4] || ''} ${note}`.match(/(\d{2,4})\s*(?:сек|с|sec)/i);
  return {
    name: clean(name), sets: Math.max(1, setCount), reps: clean(parsedReps), rpe: Math.max(1, 10 - parsedRir), rir: parsedRir,
    restSec: restMatch ? Number(restMatch[1]) : 90, notes: clean(note), progression: '',
  };
}

function parsedRirFallback(reps: string): string {
  const match = reps.match(/RIR\s*([\d.]+)/i);
  return match?.[1] || '2';
}

function parseDay(lines: string[], index: number, header: string, source: OriginalSource): ProgramDay {
  const exercises: ProgramDay['exercises'] = [];
  for (let i = index + 1; i < lines.length && !DAY_RE.test(lines[i]); i++) {
    const line = lines[i].trim();
    if (!line || /^[-|#]+$/.test(line) || /^(Упражнение|Подходы|Комментарий|Примечание|RIR|Отдых)/i.test(line)) continue;
    const row = EXERCISE_ROW_RE.exec(line);
    if (row) { exercises.push(parseExercise(row[1], row[2], row[3], row[4], row[5] || '')); continue; }
    const plain = /^(?:\d+\s+)?(.+?)\s+(\d+)\s*[×x*]\s*([^,]+?)(?:,\s*RIR\s*([\d.]+))?(?:\s+(.+))?$/i.exec(line);
    if (plain && !/^(День|Отдых|Кардио|Сон|Ходьба|Мобилити|Растяжка)/i.test(plain[1])) {
      exercises.push(parseExercise(plain[1], plain[2], plain[3], plain[4] || '2', plain[5] || ''));
      continue;
    }
    // DOCX text extraction stores the table cells on separate lines.
    const next = lines.slice(i + 1, i + 6).map(value => value.trim());
    const inlineSets = /^(\d+)\s*[×x*]\s*([^,]+?)(?:,\s*RIR\s*([\d.]+))?$/i.exec(next[0] || '');
    if (inlineSets) {
      exercises.push(parseExercise(line, inlineSets[1], inlineSets[2], inlineSets[3] || '2', next[1] || ''));
      i += 1;
      continue;
    }
    if (/^\d+$/.test(next[0] || '') && /^[\d\-–—]+(?:\s*на\s*ногу)?$/i.test(next[1] || '') && /^\d+(?:\.\d+)?$/.test(next[2] || '')) {
      const rest = next[3] || '';
      const note = next[4] || '';
      exercises.push(parseExercise(line, next[0], next[1], next[2], `${rest} ${note}`.trim()));
      i += 4;
    }
  }
  return { day: source.daysPerWeek === 9 ? exercises.length + 1 : Math.min(source.daysPerWeek, exercises.length ? 99 : 1), name: clean(header), focus: clean(header), warmup: '', exercises, cooldown: '' };
}

export function originalSourceToFullProgram(source: OriginalSource, text: string): FullProgram {
  return parseOriginalProgram(source, text);
}

export function parseOriginalProgram(source: OriginalSource, text: string): FullProgram {
  const lines = text.replace(/\r/g, '').split('\n');
  const headings = lines.map((line, index) => ({ line: line.trim(), index })).filter(x => DAY_RE.test(x.line));
  const days = headings.map((heading, i) => parseDay(lines, heading.index, heading.line, source)).filter(day => day.exercises.length > 0);
  days.forEach((day, i) => { day.day = i + 1; });
  const week: ProgramWeek = { week: 1, phase: 'original', volumeMultiplier: 1, intensityMultiplier: 1, deload: false, days };
  return {
    id: source.id, name: source.name, author: 'Мои оригиналы', type: `Оригинальная программа ${source.format}`, kind: 'original',
    file: source.file, textFile: source.textFile, format: source.format,
    goal: 'hypertrophy', direction: 'bodybuilding', level: 'advanced', durationWeeks: 1, daysPerWeek: days.length || source.daysPerWeek,
    sessionTimeMin: 'По оригиналу', description: 'Оригинальная программа, структурированная из исходного документа без автопрогрессии.',
    targetAudience: 'Пользовательская программа', equipmentNeeded: [], weeks: [week], progressionModel: 'По оригиналу', deloadProtocol: 'По оригиналу', customization: [], warnings: [], expectedResults: 'По оригиналу',
  } as FullProgram & OriginalSource & { kind: 'original' };
}
