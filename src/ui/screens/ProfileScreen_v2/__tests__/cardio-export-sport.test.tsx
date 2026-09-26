/**
 * cardio-export-sport.test.tsx — спринт 5.2: дисциплина не теряется на экспорте.
 *
 * Дефект: CSV и печать дневника не содержали колонки дисциплины — данные, которые
 * теперь пишутся во всех 4 входах, УХОДИЛИ из приложения, а круговой импорт
 * (выгрузил → загрузил) терял дисциплину без возможности восстановления.
 *
 * Контракт: колонка «Дисциплина» в экспорте (канонической подписью) И чтение её
 * обратно импортёром.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const csv: { name: string; text: string }[] = [];
const html: { name: string; text: string }[] = [];

vi.mock('../../../../core/apk-share', () => ({
  saveCsvApk: (name: string, text: string) => { csv.push({ name, text }); return Promise.resolve(true); },
  printHtmlApk: (text: string, name: string) => { html.push({ name, text }); return Promise.resolve(true); },
  shareOrCopyText: () => Promise.resolve(true),
  downloadCoachFile: () => Promise.resolve(true),
}));

import { CardioDiary } from '../diaries/CardioDiary/CardioDiary';
import { saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';
import { detectCardioFormat, parseCardioImport } from '../../../../engines/cardio-import.engine';

/** Экспорт живёт в меню шапки: открыть → пункт. */
function openExportMenu(): void {
  fireEvent.click(screen.getByRole('button', { expanded: false }));
}

beforeEach(() => { localStorage.clear(); csv.length = 0; html.length = 0; });

describe('Экспорт кардио-дневника везёт дисциплину', () => {
  it('CSV: колонка «Дисциплина» и каноническая подпись', () => {
    saveCardioLogEntry({
      id: 'b1', date: '2026-09-19', type: 'zone2', durationMin: 45,
      completed: true, avgHr: 130, sport: 'bike', source: 'manual',
    });
    render(<CardioDiary />);
    openExportMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /CSV/i }));
    expect(csv).toHaveLength(1);
    expect(csv[0].text).toContain('Дисциплина');
    expect(csv[0].text).toContain('велосипед');   // подпись из канона, не сырой id
  });

  it('печать: та же колонка', () => {
    saveCardioLogEntry({
      id: 'r1', date: '2026-09-19', type: 'zone2', durationMin: 30,
      completed: true, avgHr: 150, sport: 'run', source: 'manual',
    });
    render(<CardioDiary />);
    openExportMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Печать/i }));
    expect(html).toHaveLength(1);
    expect(html[0].text).toContain('Дисциплина');
    expect(html[0].text).toContain('бег');
  });

  it('круг «выгрузили → загрузили»: дисциплина сохраняется', () => {
    // Ровно то, что делает пользователь: экспорт своей выгрузки обратно в импорт.
    const name = 'cardio-2026-09-20.csv';
    const text = [
      'Дата,Тип,Дисциплина,Минуты,Км,Темп,Ккал,ЧСС ср.,RPE,День ног,Заметка,Завершено',
      '2026-09-19,Zone 2,велосипед,45,18.0,,420,130,5,,,да',
    ].join('\n');
    expect(detectCardioFormat(name, text)).toBe('csv');
    const res = parseCardioImport(name, text);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].sport).toBe('bike');
    expect(res.entries[0].type).toBe('zone2');   // тип не пострадал
  });

  it('файл без колонки дисциплины читается как раньше (регресс)', () => {
    const text = ['Дата,Тип,Минуты,Км,Заметка', '2026-09-19,Zone 2,30,5.0,ok'].join('\n');
    const res = parseCardioImport('x.csv', text);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].type).toBe('zone2');
  });
});
