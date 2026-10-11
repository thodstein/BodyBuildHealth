/** Небольший читатель исходников для source-guard тестов (без fs-путей в тестах). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export class SourceFileReader {
  readonly text: string;
  constructor(relPath: string) {
    this.text = readFileSync(resolve(process.cwd(), relPath), 'utf8');
  }
  /** Фрагмент между маркерами (маркеры не включительно). */
  blockBetween(startMarker: string, endMarker: string): string {
    const a = this.text.indexOf(startMarker);
    if (a < 0) return '';
    const b = this.text.indexOf(endMarker, a + startMarker.length);
    return this.text.slice(a + startMarker.length, b < 0 ? this.text.length : b);
  }
}
