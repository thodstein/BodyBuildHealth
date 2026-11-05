/**
 * coach-inbox.engine.ts — «кто требует внимания» одним списком.
 *
 * ЗАЧЕМ. Карточки в ростере отвечают на вопрос «что с этим атлетом», но тренер,
 * открывая вкладку на 20 человек, сначала спрашивает «к кому идти сейчас». Инбокс
 * собирает только те поводы, которые видны ИЗ ДАННЫХ, и не дублирует один и тот
 * же повод дважды (ключ = атлет + вид повода).
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ:
 *  • никаких «мало/много», «плохо/хорошо» — только «нет программы», «нет
 *    тренировок в дневнике», «план прошлой недели не выполнен: X из Y»;
 *  • архивных атлетов в инбокс не берём: работа с ними закончена;
 *  • если у атлета нет данных вообще, это не повод для тревоги, а «смотреть
 *    нечего» — такой повод уже покрыт «нет программы»/«нет тренировок».
 *
 * Инбокс НЕ пишет данные и не ходит в базу: ему передают уже посчитанные
 * снапшот и выполнение недели. Один и тот же атлет может дать два пункта; это
 * не дубль, а два разных повода.
 */
import type { AthleteSnapshot } from './coach-athlete-snapshot.engine';
import type { AdherenceResult } from './coach-adherence.engine';
import type { CoachAthlete } from './coach-mode.engine';

export type CoachInboxKind = 'week-plan-missed' | 'no-plan' | 'no-training';

export interface CoachInboxItem {
  /** Уникальный ключ: `athleteId:kind`. Гарантирует отсутствие дублей. */
  key: string;
  athleteId: string;
  athleteName: string;
  kind: CoachInboxKind;
  /** Что случилось — коротко и с цифрами, если они есть. */
  text: string;
}

export interface CoachInboxRow {
  athlete: Pick<CoachAthlete, 'id' | 'name' | 'status'>;
  snapshot?: AthleteSnapshot;
  adherence?: AdherenceResult;
}

/** Порядок в списке: сначала то, что случилось на закончившейся неделе. */
const KIND_ORDER: Record<CoachInboxKind, number> = {
  'week-plan-missed': 0,
  'no-plan': 1,
  'no-training': 2,
};

export function buildCoachInbox(rows: readonly CoachInboxRow[]): CoachInboxItem[] {
  const seen = new Set<string>();
  const items: CoachInboxItem[] = [];

  const push = (row: CoachInboxRow, kind: CoachInboxKind, text: string) => {
    const key = `${row.athlete.id}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ key, athleteId: row.athlete.id, athleteName: row.athlete.name, kind, text });
  };

  for (const row of rows) {
    if (row.athlete.status === 'archived') continue;

    // Прошлая неделя закончилась — это факт, а не оценка.
    if (row.adherence?.previous.state === 'behind') {
      push(
        row,
        'week-plan-missed',
        `прошлая неделя: ${row.adherence.previous.done} из ${row.adherence.previous.planned}`,
      );
    }

    if (row.snapshot && !row.snapshot.hasPlan) {
      push(row, 'no-plan', 'нет сохранённой программы');
    }
    // «Нет тренировок» говорим только если данных нет совсем: иначе это уже
    // видно в строке сводки и не повод для отдельного пункта.
    if (row.snapshot && !row.snapshot.hasAnyData) {
      push(row, 'no-training', 'нет данных в приложении');
    }
  }

  return items.sort((a, b) => {
    const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (byKind !== 0) return byKind;
    return a.athleteName.localeCompare(b.athleteName, 'ru');
  });
}

/** Короткая подпись для заголовка инбокса. */
export function inboxSummary(items: readonly CoachInboxItem[]): string {
  if (!items.length) return 'Всё под контролем — поводов нет.';
  const people = new Set(items.map(i => i.athleteId)).size;
  return `${people} ${people === 1 ? 'атлет' : people < 5 ? 'атлета' : 'атлетов'}, ${items.length} ${items.length === 1 ? 'повод' : items.length < 5 ? 'повода' : 'поводов'}`;
}
