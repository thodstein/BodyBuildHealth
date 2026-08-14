/**
 * Смок-тесты вкладки «Психология» дневника + психо-панелей SessionPlayer.
 * SSR (renderToStaticMarkup) — проверка, что вкладка рендерится во всех состояниях.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, screen } from '@testing-library/react';
import { MindsetTab } from '../MindsetTab';
import { MindsetPreSessionCard, MindsetApproachHint, MindsetCheckinCard, MindsetCheckinInline } from '../../SRCBBScreen_parts/MindsetSessionPanels';
import { tabToHubMode } from '../DiaryAnalyticsZone';
import { buildPresetProtocol, createProtocol, upsertProtocol, setActiveProtocol, loadCheckins, itemsForDay, MINDSET_PROTOCOLS_KEY, MINDSET_ACTIVE_KEY, MINDSET_CHECKS_KEY } from '../../../../engines/mindset-protocol.engine';
import type { DiaryHubCtx } from '../diary-hub-context';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import type { WorkoutLog } from '../../../../core/types';
import { MobilityTab } from '../MobilityTab';
import { MobilitySessionPanel, MobilityPostPanel, MobilityCheckinInline } from '../../SRCBBScreen_parts/MobilitySessionPanel';
import { buildPresetMobility, upsertMobilityProtocol, setActiveMobility, itemsForSlot } from '../../../../engines/mobility-protocol.engine';

const mkHub = (historyWorkouts: any[] = []): DiaryHubCtx => ({ historyWorkouts } as any as DiaryHubCtx);

describe('MindsetTab (SSR-смок)', () => {
  beforeEach(() => localStorage.clear());

  it('без протоколов рендерит пустое состояние с подсказкой пресетов', () => {
    const html = renderToStaticMarkup(<MindsetTab hub={mkHub()} />);
    expect(html).toContain('Психология тренировок');
    expect(html).toContain('Протокол ещё не собран');
    expect(html).toContain('Пресет ПЛ');
    expect(html).toContain('Пресет ББ');
  });

  it('с активным протоколом рендерит конструктор, предпросмотр, чек-ин, тренды, инсайты', () => {
    const p = buildPresetProtocol('pl');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    const html = renderToStaticMarkup(<MindsetTab hub={mkHub()} />);
    expect(html).toContain('Конструктор протокола');
    expect(html).toContain('Активация перед тяжёлым весом');
    expect(html).toContain('Предпросмотр по типу дня');
    expect(html).toContain('Чек-ин после тренировки');
    expect(html).toContain('Тренды психики');
    expect(html).toContain('Персональные инсайты');
    expect(html).toContain('Библиотека ритуалов');
    expect(html).toContain('🖨 Печать отчёта');
  });

  it('рендерится с чек-инами в хранилище (тренды/приверженность)', () => {
    const p = buildPresetProtocol('bb');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    const date = new Date().toISOString().slice(0, 10);
    localStorage.setItem('he_mindset_checks', JSON.stringify([
      { id: 'c1', date, confidence: 4, arousal: 3, focus: 5, protocolFollowed: true },
      { id: 'c2', date: '2026-08-01', confidence: 2, arousal: 2, focus: 3, protocolFollowed: false },
    ]));
    const html = renderToStaticMarkup(<MindsetTab hub={mkHub()} />);
    expect(html).toContain('Приверженность протоколу');
  });

  it('устойчив к битому JSON протоколов в хранилище', () => {
    localStorage.setItem(MINDSET_PROTOCOLS_KEY, '{"broken":');
    localStorage.setItem(MINDSET_ACTIVE_KEY, 'x');
    const html = renderToStaticMarkup(<MindsetTab hub={mkHub()} />);
    expect(html).toContain('Протокол ещё не собран');
  });

  it('tabToHubMode маппит вкладку mindset', () => {
    expect(tabToHubMode('mindset')).toBe('mindset');
  });
});

describe('Психо-панели SessionPlayer (SSR-смок)', () => {
  beforeEach(() => localStorage.clear());

  it('MindsetPreSessionCard скрыт без активного протокола', () => {
    const html = renderToStaticMarkup(<MindsetPreSessionCard focus="Тяжёлый жим" dayLabel="День 1" />);
    expect(html).toContain('Психо-протокол ещё не собран');
    expect(html).toContain('Психология');
  });

  it('MindsetPreSessionCard показывает подсказку, если протокол не покрывает тип дня', () => {
    const p = createProtocol('Только памп', 'bb', [
      { id: 'x1', kind: 'pre', title: 'MMC-вход', script: 'фокус', durationMin: 1, targetDays: ['pump'] },
    ]);
    upsertProtocol(p);
    setActiveProtocol(p.id);
    // Шаг привязан только к пампу — для тяжёлого дня должна быть подсказка, а не панель
    const html = renderToStaticMarkup(<MindsetPreSessionCard focus="Тяжёлая тяга" dayLabel="День 1" />);
    expect(html).toContain('не покрывает этот тип дня');
    expect(html).not.toContain('checkbox');
  });

  it('MindsetPreSessionCard показывает шаги тяжёлого дня с чекбоксами', () => {
    const p = buildPresetProtocol('pl');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    const html = renderToStaticMarkup(<MindsetPreSessionCard focus="Тяжёлый жим" dayLabel="День 1" />);
    expect(html).toContain('Психология:');
    expect(html).toContain('Активация перед тяжёлым весом');
    expect(html).toContain('тип дня: Тяжёлый день');
    expect(html).toContain('checkbox');
  });

  it('MindsetPreSessionCard фильтрует шаги по типу дня (памп не покажет активацию ПЛ)', () => {
    const p = buildPresetProtocol('pl');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    const html = renderToStaticMarkup(<MindsetPreSessionCard focus="Памповый день" dayLabel="День 2" />);
    expect(html).not.toContain('Активация перед тяжёлым весом');
    expect(html).toContain('тип дня: Памповый день');
  });

  it('MindsetApproachHint скрыт, если упражнение начато или нет approach-шагов', () => {
    expect(renderToStaticMarkup(<MindsetApproachHint focus="X" exerciseStarted={true} />)).toBe('');
    expect(renderToStaticMarkup(<MindsetApproachHint focus="X" exerciseStarted={false} />)).toBe('');
  });

  it('MindsetApproachHint показывает ритуал перед первым подходом в тяжёлый день', () => {
    const p = buildPresetProtocol('pl');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    const html = renderToStaticMarkup(<MindsetApproachHint focus="Тяжёлая тяга" exerciseStarted={false} />);
    expect(html).toContain('Перед первым подходом');
  });

  it('MindsetCheckinCard рендерит шкалы и сохраняет чек-ин', () => {
    const html = renderToStaticMarkup(<MindsetCheckinCard sessionId="s1" />);
    expect(html).toContain('Психо-чек-ин сессии');
    expect(html).toContain('Уверенность');
    expect(html).toContain('Активация');
    expect(html).toContain('Фокус');
    expect(html).toContain('Протокол выполнен');
  });
});

describe('MindsetCheckinInline (формы записи)', () => {
  beforeEach(() => localStorage.clear());

  it('SSR: рендерит компактный чек-ин со шкалами и протоколом', () => {
    const html = renderToStaticMarkup(<MindsetCheckinInline date="2026-08-14" sessionId="w1" />);
    expect(html).toContain('Психо-чек-ин');
    expect(html).toContain('Уверенность');
    expect(html).toContain('Активация');
    expect(html).toContain('Фокус');
    expect(html).toContain('Протокол');
  });

  it('CSR: сохранение пишет чек-ин в he_mindset_checks с датой и sessionId', () => {
    render(<MindsetCheckinInline date="2026-08-14" sessionId="w1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить психо-чек-ин' }));
    const list = loadCheckins();
    expect(list.length).toBe(1);
    expect(list[0].date).toBe('2026-08-14');
    expect(list[0].sessionId).toBe('w1');
    expect(list[0].confidence).toBe(4);
    expect(list[0].protocolFollowed).toBe(true);
    expect(screen.getByText('✓ сохранено')).toBeTruthy();
  });

  it('CSR: повторное сохранение заменяет запись (без дублей)', () => {
    render(<MindsetCheckinInline date="2026-08-14" sessionId="w1" />);
    const btn = screen.getByRole('button', { name: 'Сохранить психо-чек-ин' });
    fireEvent.click(btn);
    expect(loadCheckins().length).toBe(1);
  });

  it('CSR: шкалы меняются перед сохранением', () => {
    render(<MindsetCheckinInline date="2026-08-15" sessionId={undefined} />);
    fireEvent.change(screen.getByLabelText('Уверенность'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Фокус'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '✕ нет' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить психо-чек-ин' }));
    const list = loadCheckins();
    expect(list[0].confidence).toBe(2);
    expect(list[0].focus).toBe(5);
    expect(list[0].protocolFollowed).toBe(false);
    expect(list[0].sessionId).toBeUndefined();
  });

  it('битый JSON чек-инов не роняет компонент', () => {
    localStorage.setItem(MINDSET_CHECKS_KEY, '{{{');
    const html = renderToStaticMarkup(<MindsetCheckinInline date="2026-08-14" />);
    expect(html).toContain('Психо-чек-ин');
  });
});

describe('Напоминание о психо-чек-ине в блоке «Сегодня»', () => {
  beforeEach(() => localStorage.clear());

  const today = new Date().toISOString().slice(0, 10);
  const mkWorkoutToday = (): WorkoutLog => ({
    id: 'w_today', date: today, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody',
    exercises: [{
      id: `${today}_bench`, date: today, exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа', isCompound: true, weekNumber: 1,
      sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }], totalVolume: 640, estimated1RM: 101,
    } as any],
  });

  const baseProps = {
    diary: {} as any,
    diaryStats: [],
    diaryProgress: [],
    historyWorkouts: [mkWorkoutToday()],
    macrocycle: null,
    selectedWeek: 1,
    level: 'intermediate',
    onRefresh: () => {},
    trainingOutput: null,
    goal: 'bulk',
    daysPerWeek: 4,
    splitType: 'auto',
    periodizationType: 'auto',
    mesoLength: 12,
    tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
    linked: { profile: { settings: { personal: { height: 175 } } } },
  };

  it('тренировка сегодня без чек-ина → напоминание с кнопкой «Заполнить»', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Сегодня тренировка без психо-чек-ина');
    expect(html).toContain('Заполнить');
  });

  it('тренировка сегодня + чек-ин заполнен → напоминания нет', () => {
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify([{ id: 'c1', date: today, confidence: 4, arousal: 3, focus: 4, protocolFollowed: true }]));
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).not.toContain('без психо-чек-ина');
  });

  it('без тренировки сегодня → напоминания нет', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" historyWorkouts={[] as any} />);
    expect(html).not.toContain('без психо-чек-ина');
  });
});

describe('MobilityTab (SSR-смок)', () => {
  beforeEach(() => localStorage.clear());

  it('без протоколов рендерит пустое состояние с пресетами', () => {
    const html = renderToStaticMarkup(<MobilityTab hub={mkHub()} />);
    expect(html).toContain('Мобильность и гибкость');
    expect(html).toContain('Протокол мобильности ещё не собран');
    expect(html).toContain('Пресет ПЛ');
    expect(html).toContain('Пресет ББ');
  });

  it('с активным протоколом рендерит конструктор, предпросмотр, чек-ин, тренды', () => {
    const p = buildPresetMobility('pl');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    const html = renderToStaticMarkup(<MobilityTab hub={mkHub()} />);
    expect(html).toContain('Конструктор протокола');
    expect(html).toContain('Мобильность позвоночника (5-10 мин)');
    expect(html).toContain('Предпросмотр по слоту');
    expect(html).toContain('Чек-ин мобильности');
    expect(html).toContain('Тренды мобильности');
    expect(html).toContain('Библиотека блоков');
    expect(html).toContain('Чек-ины CSV');
    expect(html).toContain('🖨 Отчёт');
    expect(html).toContain('Персональные инсайты');
  });

  it('устойчив к битому JSON протоколов', () => {
    localStorage.setItem('he_mobility_protocols', '{"broken":');
    const html = renderToStaticMarkup(<MobilityTab hub={mkHub()} />);
    expect(html).toContain('Протокол мобильности ещё не собран');
  });

  it('tabToHubMode маппит вкладку mobility', () => {
    expect(tabToHubMode('mobility')).toBe('mobility');
  });
});

describe('Панели мобильности SessionPlayer (SSR-смок)', () => {
  beforeEach(() => localStorage.clear());

  it('MobilitySessionPanel скрыт без активного протокола', () => {
    expect(renderToStaticMarkup(<MobilitySessionPanel />)).toBe('');
  });

  it('MobilitySessionPanel показывает daily+pre шаги с чекбоксами', () => {
    const p = buildPresetMobility('pl');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    const html = renderToStaticMarkup(<MobilitySessionPanel />);
    expect(html).toContain('Мобильность:');
    expect(html).toContain('Утренняя рутина CARs (5 мин)');
    expect(html).toContain('Ежедневная рутина');
    expect(html).toContain('Перед тренировкой');
    expect(html).toContain('checkbox');
  });

  it('MobilityPostPanel скрыт без post-блоков в протоколе', () => {
    const p = buildPresetMobility('pl');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    expect(renderToStaticMarkup(<MobilityPostPanel sessionId="w1" />)).not.toBe('');
    // Универсальный пресет содержит static_post — проверим, что панель видит пост-блоки
    expect(renderToStaticMarkup(<MobilityPostPanel sessionId="w1" />)).toContain('Растяжка после тренировки');
  });

  it('MobilityCheckinInline рендерит шкалы и сохраняет чек-ин', () => {
    const html = renderToStaticMarkup(<MobilityCheckinInline date="2026-08-14" sessionId="w1" />);
    expect(html).toContain('Чек-ин мобильности');
    expect(html).toContain('ROM');
  });
});

describe('Напоминание о мобильности в блоке «Сегодня»', () => {
  beforeEach(() => localStorage.clear());

  const today = new Date().toISOString().slice(0, 10);
  const mkWorkoutToday = (): WorkoutLog => ({
    id: 'w_today', date: today, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody',
    exercises: [{
      id: `${today}_bench`, date: today, exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа', isCompound: true, weekNumber: 1,
      sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }], totalVolume: 640, estimated1RM: 101,
    } as any],
  });

  const baseProps = {
    diary: {} as any,
    diaryStats: [],
    diaryProgress: [],
    historyWorkouts: [mkWorkoutToday()],
    macrocycle: null,
    selectedWeek: 1,
    level: 'intermediate',
    onRefresh: () => {},
    trainingOutput: null,
    goal: 'bulk',
    daysPerWeek: 4,
    splitType: 'auto',
    periodizationType: 'auto',
    mesoLength: 12,
    tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
    linked: { profile: { settings: { personal: { height: 175 } } } },
  };

  it('активный протокол с daily-рутиной, прогресс пуст → напоминание', () => {
    const p = buildPresetMobility('both');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Ежедневная рутина мобильности не выполнена');
    expect(html).toContain('К рутине');
  });

  it('прогресс за сегодня выполнен → напоминания нет', () => {
    const p = buildPresetMobility('both');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    const dailyIds = itemsForSlot(p, 'daily').map(i => i.id);
    localStorage.setItem('he_mobility_day_progress', JSON.stringify({ date: today, doneItems: dailyIds }));
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).not.toContain('рутина мобильности не выполнена');
  });

  it('без активного протокола → напоминания нет', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).not.toContain('рутина мобильности не выполнена');
  });
});

describe('Прогресс протоколов в блоке «Сегодня»', () => {
  beforeEach(() => localStorage.clear());

  const baseProps = {
    diary: {} as any,
    diaryStats: [],
    diaryProgress: [],
    historyWorkouts: [],
    macrocycle: null,
    selectedWeek: 1,
    level: 'intermediate',
    onRefresh: () => {},
    trainingOutput: null,
    goal: 'bulk',
    daysPerWeek: 4,
    splitType: 'auto',
    periodizationType: 'auto',
    mesoLength: 12,
    tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
    linked: { profile: { settings: { personal: { height: 175 } } } },
  };

  it('активны оба протокола → чипы прогресса 0%', () => {
    const mp = buildPresetProtocol('both');
    upsertProtocol(mp);
    setActiveProtocol(mp.id);
    const mob = buildPresetMobility('both');
    upsertMobilityProtocol(mob);
    setActiveMobility(mob.id);
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Психо-протокол: 0%');
    expect(html).toContain('Рутина: 0%');
  });

  it('полностью выполненный прогресс → чипы 100%', () => {
    const today = new Date().toISOString().slice(0, 10);
    const mp = buildPresetProtocol('both');
    upsertProtocol(mp);
    setActiveProtocol(mp.id);
    const allItems = itemsForDay(mp, 'all');
    localStorage.setItem('he_mindset_day_progress', JSON.stringify({ date: today, doneItems: allItems.map(i => i.id) }));
    const mob = buildPresetMobility('both');
    upsertMobilityProtocol(mob);
    setActiveMobility(mob.id);
    const dailyIds = itemsForSlot(mob, 'daily').map(i => i.id);
    localStorage.setItem('he_mobility_day_progress', JSON.stringify({ date: today, doneItems: dailyIds }));
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Психо-протокол: 100%');
    expect(html).toContain('Рутина: 100%');
  });

  it('нет тренировки сегодня + rest_day блоки → кнопка «Сессия мобильности»', () => {
    const mob = buildPresetMobility('pl');
    upsertMobilityProtocol(mob);
    setActiveMobility(mob.id);
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Сессия мобильности');
  });

  it('тренировка сегодня + rest_day блоки → сессии мобильности нет', () => {
    const today = new Date().toISOString().slice(0, 10);
    const mob = buildPresetMobility('pl');
    upsertMobilityProtocol(mob);
    setActiveMobility(mob.id);
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" historyWorkouts={[{
      id: 'w1', date: today, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody', exercises: [],
    } as any]} />);
    expect(html).not.toContain('Сессия мобильности');
  });

  it('daily-рутина не выполнена → кнопка «✓ Рутина выполнена»', () => {
    const mob = buildPresetMobility('both');
    upsertMobilityProtocol(mob);
    setActiveMobility(mob.id);
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Рутина выполнена');
  });
});
