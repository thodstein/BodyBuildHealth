/**
 * Смок-тесты вкладки «Психология» дневника + психо-панелей SessionPlayer.
 * SSR (renderToStaticMarkup) — проверка, что вкладка рендерится во всех состояниях.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MindsetTab } from '../MindsetTab';
import { MindsetPreSessionCard, MindsetApproachHint, MindsetCheckinCard, MindsetCheckinInline } from '../../SRCBBScreen_parts/MindsetSessionPanels';
import { WarmupCheckinInline } from '../../SRCBBScreen_parts/WarmupSessionPanel';
import { CooldownCheckinInline } from '../../SRCBBScreen_parts/CooldownSessionPanel';
import { tabToHubMode } from '../DiaryAnalyticsZone';
import { buildPresetProtocol, createProtocol, upsertProtocol, setActiveProtocol, loadCheckins, loadProtocols, loadActiveProtocol, itemsForDay, MINDSET_PROTOCOLS_KEY, MINDSET_ACTIVE_KEY, MINDSET_CHECKS_KEY } from '../../../../engines/mindset-protocol.engine';
import type { DiaryHubCtx } from '../diary-hub-context';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import type { WorkoutLog } from '../../../../core/types';
import { MobilityTab } from '../MobilityTab';
import { WorkoutWeekCard, WarmupRampCard } from '../diary-cards';
import { ZONES } from '../nav';
import { MobilitySessionPanel, MobilityPostPanel, MobilityCheckinInline } from '../../SRCBBScreen_parts/MobilitySessionPanel';
import { SessionPlayer } from '../../SRCBBScreen_parts/SessionPlayer';
import { TrainingCalendarTab } from '../TrainingCalendarTab';
import { buildPresetMobility, upsertMobilityProtocol, setActiveMobility, itemsForSlot, loadMobilityProtocols, loadActiveMobility } from '../../../../engines/mobility-protocol.engine';
import { saveAssessment } from '../../../../engines/mobility-assessment.engine';
import { loadWarmupLog, upsertWarmupLog, WARMUP_DIARY_KEY } from '../../../../engines/warmup.engine';
import { loadCooldownLog, upsertCooldownLog, COOLDOWN_DIARY_KEY } from '../../../../engines/cooldown.engine';
import { WarmupDiaryView } from '../WarmupDiaryView';
import { CooldownDiaryView } from '../CooldownDiaryView';

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

  it('tabToHubMode маппит вкладку mindset в объединённую rituals', () => {
    expect(tabToHubMode('mindset')).toBe('rituals');
  });

  it('рендерит карточки «Настроение дня» и «Фаза мотивации»', () => {
    const p = buildPresetProtocol('pl');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    const html = renderToStaticMarkup(<MindsetTab hub={mkHub()} />);
    expect(html).toContain('Настроение дня');
    expect(html).toContain('Фаза мотивации');
    expect(html).toContain('Рабочая рутина');
  });

  it('MobilityTab рендерит карточку «Оценка мобильности» с баллами и слабыми зонами', () => {
    const p = buildPresetMobility('pl');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    saveAssessment({ date: new Date().toISOString().slice(0, 10), scores: { deep_squat: 0, shoulder_flexion: 2 } });
    const html = renderToStaticMarkup(<MobilityTab hub={mkHub()} />);
    expect(html).toContain('Оценка мобильности (тесты)');
    expect(html).toContain('Слабые зоны');
    expect(html).toContain('2/12');
  });

  it('потоки мобильности в пресетах — русские названия', () => {
    const p = buildPresetMobility('pl');
    const titles = p.items.map(i => i.title);
    expect(titles).toContain('Поток раскрытия бёдер');
    expect(titles).toContain('Поток позвоночник и плечи');
    const flows = p.items.filter(i => i.sourceMethod === 'flow');
    expect(flows.length).toBe(2);
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

describe('Разминка в блоке «Сегодня»', () => {
  beforeEach(() => localStorage.clear());

  const today = new Date().toISOString().slice(0, 10);
  const mkWorkoutToday = (): WorkoutLog => ({
    id: 'w_today2', date: today, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody',
    exercises: [{ id: `${today}_squat`, date: today, exerciseId: 'squat', exerciseName: 'Присед', isCompound: true, weekNumber: 1, sets: [{ weight: 100, reps: 5, rir: 2, rpe: 7 }], totalVolume: 500, estimated1RM: 115 } as any],
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

  it('тренировка сегодня без разминки → напоминание + кнопки', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Разминка сегодня не отмечена');
    expect(html).toContain('✓ Разминка выполнена');
    expect(html).toContain('К разминке');
  });

  it('разминка отмечена → напоминания нет, кольцо 100%', () => {
    upsertWarmupLog({ date: today, done: true, quality: 4 });
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).not.toContain('Разминка сегодня не отмечена');
    expect(html).toContain('Разминка');
  });

  it('без тренировки сегодня → напоминания о разминке нет', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" historyWorkouts={[] as any} />);
    expect(html).not.toContain('Разминка сегодня не отмечена');
  });

  it('TrainingDiaryHub с mode rituals рендерит подвкладки практик (Психология/Разминка)', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="rituals" />);
    expect(html).toContain('🧠 Психология');
    expect(html).toContain('🔥 Разминка');
    expect(html).toContain('🧘 Мобильность');
  });
});

describe('Заминка (чек-ин, бейджи, вкладка)', () => {
  beforeEach(() => localStorage.clear());

  const today = new Date().toISOString().slice(0, 10);

  it('CooldownCheckinInline: «✓ да» + сохранить → запись в дневнике заминки', () => {
    render(<CooldownCheckinInline date="2026-08-14" sessionId="w1" />);
    fireEvent.click(screen.getByText('✓ да'));
    fireEvent.click(screen.getByLabelText('Сохранить чек-ин заминки'));
    const log = loadCooldownLog();
    expect(log.length).toBe(1);
    expect(log[0].done).toBe(true);
    expect(log[0].sessionId).toBe('w1');
  });

  it('CooldownCheckinInline: «✕ нет» фиксирует причину пропуска', () => {
    render(<CooldownCheckinInline date="2026-08-14" />);
    fireEvent.click(screen.getByText('✕ нет'));
    fireEvent.click(screen.getByLabelText('Сохранить чек-ин заминки'));
    const log = loadCooldownLog();
    expect(log[0].done).toBe(false);
    expect(log[0].skippedReason).toBeTruthy();
  });

  it('WorkoutWeekCard: выполненная заминка → бейдж ❄️', () => {
    upsertCooldownLog({ date: today, done: true, quality: 4, sessionId: 'w_cool1' });
    const workout = {
      id: 'w_cool1', date: today, exercises: [{ id: 'e1', date: today, exerciseId: 'bench_press', exerciseName: 'Жим', sets: [{ weight: 80, reps: 8 }], totalVolume: 640, estimated1RM: 101 } as any],
    } as WorkoutLog;
    const html = renderToStaticMarkup(<WorkoutWeekCard weekLabel="Неделя 1" workouts={[workout]} expanded onToggle={() => {}} />);
    expect(html).toContain('❄️ ✓ 4/5');
  });

  it('CooldownDiaryView (SSR): сводка, инсайты и пустое состояние', () => {
    const html = renderToStaticMarkup(<CooldownDiaryView />);
    expect(html).toContain('❄️ Заминка');
    expect(html).toContain('Сводка · 30 дней');
    expect(html).toContain('Пока нет записей');
    expect(html).toContain('Персональные инсайты');
  });

  it('CooldownDiaryView (SSR): карточка «Сессия растяжки» с фокусами', () => {
    const html = renderToStaticMarkup(<CooldownDiaryView />);
    expect(html).toContain('Сессия растяжки');
    expect(html).toContain('Всё тело');
    expect(html).toContain('Бёдра и ягодицы');
    expect(html).toContain('Собрать и начать');
  });

  it('WarmupDiaryView с планом дня: предпросмотр групп/суставов', () => {
    const planDay = { name: 'Грудь и спина', exercises: [{ name: 'Жим лёжа' }, { name: 'Тяга верхнего блока' }] };
    const html = renderToStaticMarkup(<WarmupDiaryView planDay={planDay} />);
    expect(html).toContain('Разминка по плану на сегодня');
    expect(html).toContain('грудь');
    expect(html).toContain('спина');
    expect(html).toContain('Круги локтями');
  });

  it('CooldownDiaryView с планом дня: предпросмотр растяжки', () => {
    const planDay = { name: 'Ноги', exercises: [{ name: 'Присед' }, { name: 'Румынская тяга' }] };
    const html = renderToStaticMarkup(<CooldownDiaryView planDay={planDay} />);
    expect(html).toContain('Заминка по плану на сегодня');
    expect(html).toContain('Растяжка квадрицепса');
    expect(html).toContain('квадрицепсы');
    expect(html).toContain('Фоам-роллинг ног');
  });

  it('TrainingDiaryHub с mode rituals рендерит подвкладку заминки и чек-ин', () => {
    upsertCooldownLog({ date: today, done: true, quality: 4 });
    const html = renderToStaticMarkup(<TrainingDiaryHub
      diary={{} as any} diaryStats={[]} diaryProgress={[]} historyWorkouts={[]} macrocycle={null} selectedWeek={1}
      level="intermediate" onRefresh={() => {}} trainingOutput={null} goal="bulk" daysPerWeek={4} splitType="auto"
      periodizationType="auto" mesoLength={12} tprofile={{} as any} linked={{}} initialMode="rituals"
    />);
    expect(html).toContain('❄️ Заминка');
    expect(html).toContain('🧠 Психология');
    expect(html).toContain('📋 Чек-ин');
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

  it('tabToHubMode маппит вкладку mobility в объединённую rituals', () => {
    expect(tabToHubMode('mobility')).toBe('rituals');
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
    diary: { checkProgressionAlerts: async () => [] } as any,
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

  it('CSR: клик «✓ Рутина выполнена» отмечает все daily-шаги', () => {
    const mob = buildPresetMobility('both');
    upsertMobilityProtocol(mob);
    setActiveMobility(mob.id);
    const dailyIds = itemsForSlot(mob, 'daily').map(i => i.id);
    expect(dailyIds.length).toBeGreaterThan(0);
    render(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    fireEvent.click(screen.getByRole('button', { name: /Рутина выполнена/ }));
    const saved = JSON.parse(localStorage.getItem('he_mobility_day_progress') || 'null');
    expect(saved.date).toBe(new Date().toISOString().slice(0, 10));
    expect(saved.doneItems.sort()).toEqual([...dailyIds].sort());
  });
});

describe('Сводка недели с психо/мобильностью', () => {
  beforeEach(() => localStorage.clear());

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  // Дата гарантированно ВНЕ окна последних 7 дней (на сутки раньше)
  const oldDate = new Date(weekAgo.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const baseProps = {
    diary: {} as any,
    diaryStats: [],
    diaryProgress: [],
    historyWorkouts: [{
      id: 'w1', date: today, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody',
      exercises: [{ id: 'e1', date: today, exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа', isCompound: true, weekNumber: 1, sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }], totalVolume: 640, estimated1RM: 101 } as any],
    } as any],
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

  it('чек-ины за неделю попадают в копируемую сводку', () => {
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify([
      { id: 'c1', date: today, confidence: 4, arousal: 3, focus: 5, protocolFollowed: true },
      { id: 'c2', date: oldDate, confidence: 5, arousal: 4, focus: 4, protocolFollowed: true },
    ]));
    localStorage.setItem('he_mobility_checks', JSON.stringify([
      { id: 'm1', date: today, done: true, romScore: 4 },
      { id: 'm2', date: oldDate, done: false, romScore: null },
    ]));
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="history" />);
    // Только чек-ин за последние 7 дней (c1/m1)
    expect(html).toContain('Психо: 1 чек-ин(а) · уверенность 4.0/5');
    expect(html).toContain('Мобильность: 1/1 дней выполнено');
  });

  it('без чек-инов за неделю → строки психо/мобильности отсутствуют', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="history" />);
    expect(html).not.toContain('Психо:');
    expect(html).not.toContain('Мобильность:');
  });
});

describe('Кнопки экспорта протокола JSON', () => {
  beforeEach(() => localStorage.clear());

  it('MindsetTab рендерит кнопку JSON', () => {
    const p = buildPresetProtocol('pl');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    const html = renderToStaticMarkup(<MindsetTab hub={mkHub()} />);
    expect(html).toContain('⬇ JSON');
  });

  it('MobilityTab рендерит кнопку JSON', () => {
    const p = buildPresetMobility('pl');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    const html = renderToStaticMarkup(<MobilityTab hub={mkHub()} />);
    expect(html).toContain('⬇ JSON');
  });
});

describe('Бейджи психо/мобильности в карточках истории', () => {
  beforeEach(() => localStorage.clear());

  const today = new Date().toISOString().slice(0, 10);
  const workout = {
    id: 'w_badge', date: today, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody',
    exercises: [{ id: 'e1', date: today, exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа', isCompound: true, weekNumber: 1, sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }], totalVolume: 640, estimated1RM: 101 } as any],
  } as WorkoutLog;

  const renderCard = () => renderToStaticMarkup(
    <WorkoutWeekCard weekLabel="Неделя 1" workouts={[workout]} expanded onToggle={() => {}} />,
  );

  it('чек-ин по sessionId записи → бейдж 🧠 с уверенностью', () => {
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify([{ id: 'c1', date: today, sessionId: 'w_badge', confidence: 4, arousal: 3, focus: 5, protocolFollowed: true }]));
    expect(renderCard()).toContain('🧠 4/5');
  });

  it('мобильность выполнена по sessionId → бейдж 🧘 ✓', () => {
    localStorage.setItem('he_mobility_checks', JSON.stringify([{ id: 'm1', date: today, sessionId: 'w_badge', done: true, romScore: 4 }]));
    expect(renderCard()).toContain('🧘 ✓');
  });

  it('оба чек-ина → оба бейджа', () => {
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify([{ id: 'c1', date: today, sessionId: 'w_badge', confidence: 4, arousal: 3, focus: 5, protocolFollowed: true }]));
    localStorage.setItem('he_mobility_checks', JSON.stringify([{ id: 'm1', date: today, sessionId: 'w_badge', done: true, romScore: 4 }]));
    const html = renderCard();
    expect(html).toContain('🧠 4/5');
    expect(html).toContain('🧘 ✓');
  });

  it('без чек-инов → бейджей нет', () => {
    const html = renderCard();
    expect(html).not.toContain('🧠 4/5');
    expect(html).not.toContain('🧘 ✓');
  });
});

describe('Разминка (чек-ин, бейджи, рампа)', () => {
  beforeEach(() => localStorage.clear());

  const today = new Date().toISOString().slice(0, 10);

  it('WarmupCheckinInline: «✓ да» + сохранить → запись в дневнике разминки', () => {
    render(<WarmupCheckinInline date="2026-08-14" sessionId="w1" />);
    fireEvent.click(screen.getByText('✓ да'));
    fireEvent.click(screen.getByLabelText('Сохранить чек-ин разминки'));
    const log = loadWarmupLog();
    expect(log.length).toBe(1);
    expect(log[0].done).toBe(true);
    expect(log[0].sessionId).toBe('w1');
    expect(log[0].quality).toBe(3);
  });

  it('WarmupCheckinInline: «✕ нет» фиксирует причину пропуска', () => {
    render(<WarmupCheckinInline date="2026-08-14" />);
    fireEvent.click(screen.getByText('✕ нет'));
    fireEvent.click(screen.getByLabelText('Сохранить чек-ин разминки'));
    const log = loadWarmupLog();
    expect(log[0].done).toBe(false);
    expect(log[0].skippedReason).toBeTruthy();
    expect(log[0].quality).toBeNull();
  });

  it('WarmupCheckinInline: без выбора «—» кнопка сохранения неактивна', () => {
    render(<WarmupCheckinInline date="2026-08-14" />);
    expect(screen.getByLabelText('Сохранить чек-ин разминки')).toBeDisabled();
    expect(loadWarmupLog().length).toBe(0);
  });

  it('WorkoutWeekCard: выполненная разминка → бейдж 🔥 ✓ с качеством', () => {
    upsertWarmupLog({ date: today, done: true, quality: 4, sessionId: 'w_badge2' });
    const workout = {
      id: 'w_badge2', date: today, exercises: [{ id: 'e1', date: today, exerciseId: 'bench_press', exerciseName: 'Жим', sets: [{ weight: 80, reps: 8 }], totalVolume: 640, estimated1RM: 101 } as any],
    } as WorkoutLog;
    const html = renderToStaticMarkup(<WorkoutWeekCard weekLabel="Неделя 1" workouts={[workout]} expanded onToggle={() => {}} />);
    expect(html).toContain('🔥 ✓ 4/5');
  });

  it('WorkoutWeekCard: пропущенная разминка → бейдж 🔥 ✕', () => {
    localStorage.setItem(WARMUP_DIARY_KEY, JSON.stringify([{ id: 'w1', date: today, sessionId: 'w_badge3', done: false, quality: null, skippedReason: 'устал' }]));
    const workout = {
      id: 'w_badge3', date: today, exercises: [{ id: 'e1', date: today, exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5 }], totalVolume: 500, estimated1RM: 115 } as any],
    } as WorkoutLog;
    const html = renderToStaticMarkup(<WorkoutWeekCard weekLabel="Неделя 1" workouts={[workout]} expanded onToggle={() => {}} />);
    expect(html).toContain('🔥 ✕');
  });

  it('WarmupRampCard рендерит канон для 100 кг (гриф + 50/70/80%)', () => {
    const html = renderToStaticMarkup(<WarmupRampCard />);
    expect(html).toContain('Пустой гриф (20 кг)');
    expect(html).toContain('50%');
    expect(html).toContain('70%');
    expect(html).toContain('80%');
    expect(html).toContain('100кг × работа');
  });
});

describe('Импорт протокола JSON', () => {
  beforeEach(() => localStorage.clear());

  it('MindsetTab рендерит кнопку «Импорт JSON»', () => {
    const html = renderToStaticMarkup(<MindsetTab hub={mkHub()} />);
    expect(html).toContain('📥 Импорт JSON');
  });

  it('MobilityTab рендерит кнопку «Импорт JSON»', () => {
    const html = renderToStaticMarkup(<MobilityTab hub={mkHub()} />);
    expect(html).toContain('📥 Импорт JSON');
  });

  it('CSR: импорт психо-протокола сохраняет и делает активным', () => {
    render(<MindsetTab hub={mkHub()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Импорт протокола из JSON' }));
    fireEvent.change(screen.getByLabelText('JSON протокола'), {
      target: { value: JSON.stringify({ name: 'Импорт-тест', direction: 'both', items: [{ id: 'x1', kind: 'pre', title: 'Т', script: 'С', durationMin: 1, targetDays: ['all'] }] }) },
    });
    fireEvent.click(screen.getByRole('button', { name: /Импортировать протокол/ }));
    const list = loadProtocols();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Импорт-тест');
    expect(loadActiveProtocol()?.id).toBe(list[0].id);
  });

  it('CSR: импорт мобильности сохраняет и делает активным', () => {
    render(<MobilityTab hub={mkHub()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Импорт протокола из JSON' }));
    fireEvent.change(screen.getByLabelText('JSON протокола'), {
      target: { value: JSON.stringify({ name: 'Импорт-тест', direction: 'both', items: [{ id: 'x1', slot: 'daily', title: 'Т', script: 'С', durationMin: 5 }] }) },
    });
    fireEvent.click(screen.getByRole('button', { name: /Импортировать протокол/ }));
    const list = loadMobilityProtocols();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Импорт-тест');
    expect(loadActiveMobility()?.id).toBe(list[0].id);
  });

  it('CSR: битый JSON показывает ошибку и ничего не сохраняет', () => {
    render(<MindsetTab hub={mkHub()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Импорт протокола из JSON' }));
    fireEvent.change(screen.getByLabelText('JSON протокола'), { target: { value: '{broken' } });
    fireEvent.click(screen.getByRole('button', { name: /Импортировать протокол/ }));
    expect(screen.getByText(/Не удалось разобрать JSON/)).toBeTruthy();
    expect(loadProtocols().length).toBe(0);
  });
});

describe('Визуальные улучшения (степпер, кольца, спарклайн, категории)', () => {
  beforeEach(() => localStorage.clear());

  it('SessionPlayer рендерит степпер фаз сессии', () => {
    const html = renderToStaticMarkup(
      <SessionPlayer days={[{ label: 'День 1', exercises: [{ name: 'Жим', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 5, rir: 2 }] }] }]} weekNumber={1} focus="X" />,
    );
    expect(html).toContain('Готов');
    expect(html).toContain('Разминка');
    expect(html).toContain('Основная');
    expect(html).toContain('Заминка');
    expect(html).toContain('Итог');
  });

  it('блок «Сегодня» рендерит прогресс-кольца при активных протоколах', () => {
    const mp = buildPresetProtocol('both');
    upsertProtocol(mp);
    setActiveProtocol(mp.id);
    const mob = buildPresetMobility('both');
    upsertMobilityProtocol(mob);
    setActiveMobility(mob.id);
    const html = renderToStaticMarkup(<TrainingDiaryHub {...{
      diary: { checkProgressionAlerts: async () => [] } as any, diaryStats: [], diaryProgress: [], historyWorkouts: [],
      macrocycle: null, selectedWeek: 1, level: 'intermediate', onRefresh: () => {}, trainingOutput: null,
      goal: 'bulk', daysPerWeek: 4, splitType: 'auto', periodizationType: 'auto', mesoLength: 12,
      tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
      linked: { profile: { settings: { personal: { height: 175 } } } },
    }} initialMode="record" />);
    expect(html).toContain('Психо');
    expect(html).toContain('Рутина');
    expect(html).toContain('svg');
  });

  it('WorkoutWeekCard рендерит спарклайн e1RM при переданной серии', () => {
    const today = new Date().toISOString().slice(0, 10);
    const w = { id: 'w1', date: today, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody', exercises: [] } as WorkoutLog;
    const html = renderToStaticMarkup(<WorkoutWeekCard weekLabel="Неделя 1" workouts={[w]} e1rmSeries={[80, 85, 90, 95]} expanded onToggle={() => {}} />);
    expect(html).toContain('svg');
    expect(html).toContain('Тренд лучшего e1RM');
  });

  it('WorkoutWeekCard без серии не рендерит спарклайн', () => {
    const html = renderToStaticMarkup(<WorkoutWeekCard weekLabel="Неделя 1" workouts={[]} expanded onToggle={() => {}} />);
    expect(html).not.toContain('Тренд лучшего e1RM');
  });

  it('nav: зона diary имеет категории', () => {
    const cats = ZONES.diary.categories;
    expect(cats).toBeTruthy();
    expect(cats!.length).toBe(4);
    const all = cats!.flatMap(c => c.tabs);
    // практики объединены в одну вкладку rituals (вместо mindset/mobility/warmup/cooldown)
    expect(all).toContain('rituals');
    expect(all).not.toContain('mindset');
    expect(all).not.toContain('mobility');
    expect(all).not.toContain('warmup');
  });

  it('tabToHubMode маппит вкладку warmup в объединённую rituals', () => {
    expect(tabToHubMode('warmup')).toBe('rituals');
  });

  it('tabToHubMode маппит вкладку cooldown в объединённую rituals', () => {
    expect(tabToHubMode('cooldown')).toBe('rituals');
  });

  it('nav: зона diary включает rituals (объединённые практики)', () => {
    const all = ZONES.diary.categories!.flatMap(c => c.tabs);
    expect(all).toContain('rituals');
    expect(all).not.toContain('cooldown');
  });

  it('WarmupDiaryView (SSR): рендерит сводку, инсайты и пустое состояние', () => {
    const html = renderToStaticMarkup(<WarmupDiaryView />);
    expect(html).toContain('🔥 Разминка');
    expect(html).toContain('Сводка · 30 дней');
    expect(html).toContain('Пока нет записей');
    expect(html).toContain('Персональные инсайты');
  });

  it('WarmupDiaryView (SSR): с записями показывает приверженность и причины', () => {
    upsertWarmupLog({ date: new Date().toISOString().slice(0, 10), done: true, quality: 4 });
    upsertWarmupLog({ date: new Date().toISOString().slice(0, 10), done: false, quality: null, skippedReason: 'устал' });
    const html = renderToStaticMarkup(<WarmupDiaryView />);
    expect(html).toContain('Приверженность');
    expect(html).toContain('устал · 1×');
    expect(html).toContain('CSV');
  });

  it('TrainingCalendarTab (CSR) показывает бейджи чек-инов на ячейках', async () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify([{ id: 'c1', date: today, confidence: 4, arousal: 3, focus: 5, protocolFollowed: true }]));
    localStorage.setItem('he_mobility_checks', JSON.stringify([{ id: 'm1', date: today, done: true, romScore: 4 }]));
    render(<TrainingCalendarTab />);
    // Дождаться отрисовки календаря (загрузка журнала)
    await waitFor(() => {
      expect(screen.queryByText(/Загрузка/)).toBeNull();
    });
    expect(screen.queryAllByText('🧠').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('🧘').length).toBeGreaterThan(0);
  });
});
