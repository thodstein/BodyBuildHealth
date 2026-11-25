/**
 * workout-honesty-contract.test.ts — контракт «честных» путей проведения и аналитики.
 *
 * Проверяем свойства, которые нельзя выразить чистой функцией: где именно пишется
 * подход, откуда берётся план дня и какие значения не подставляются по умолчанию.
 * Это регрессия на конкретные дефекты, найденные в ревью 2026-11-24.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const player = read('../../SRCBBScreen_parts/SessionPlayer.tsx');
const widgetSync = read('../../../../ui/native/widget-sync.ts');
const logger = read('../../../../engines/workout-logger.engine.ts');
const analyticsView = read('../DiaryAnalyticsView.tsx');
const analyticsTab = read('../AnalyticsTab.tsx');
const progressTab = read('../ProgressTab.tsx');
const executionZone = read('../ExecutionZone.tsx');
const hub = read('../TrainingDiaryHub.tsx');
const progression = read('../../../../engines/log-analytics-progression.engine.ts');

describe('SessionPlayer: быстрый ввод и пульт', () => {
  it('«Быстро» пишет текущие значения, а не state прошлого рендера', () => {
    // setTimeout(() => logOne(...)) читал устаревший `vals` и записывал план.
    expect(player).not.toContain('setTimeout(() => logOne');
    expect(player).toContain('logOne(ei, si, {');
    expect(player).toContain('const quickWeight = t.weight > 0 ? t.weight : weightFor(ex)');
  });

  it('быстрый ввод не выдаёт план (RIR) за измеренный RPE', () => {
    expect(player).not.toContain('rpe: Math.max(1, 10 - t.rir)');
  });

  it('подход с пульта: план ДНЯ в знаменателе и отражение в редакторе', () => {
    expect(player).toContain('saveActiveSession(res.session, dayPlanned, { plannedTotalMax: true })');
    expect(player).toContain('const dayPlanned = (day?.exercises ?? []).reduce(');
    // после записи значения подхода видны в полях (иначе повторный тап отправит план)
    expect(player).toMatch(/setActual\(\(prev\) => \(\{\s*\.\.\.prev,\s*\[keyFor\(ei, nextNum - 1\)\]/);
  });

  it('пропуск упражнения не подставляет RPE из плана', () => {
    expect(player).not.toContain('rpe: entered?.rpe || Math.max(1, 10 - t.rir)');
  });

  it('завершение гасит все таймеры', () => {
    const i = player.indexOf('const finish = (): boolean => {');
    expect(i).toBeGreaterThan(0);
    const body = player.slice(i, i + 1400);
    expect(body).toContain('setSessionTimerRunning(false)');
    expect(body).toContain('setTimerRunning(false)');
    expect(body).toContain('setInterExTimerRunning(false)');
    expect(body).toContain('window.clearTimeout(sessionTimerRef.current)');
  });

  it('старт из виджета при открытом плеере идёт реле, а не записью', () => {
    expect(player).toContain("window.addEventListener('he-workout-widget-start'");
    // handled=true только если плеер реально стартовал — иначе виджет поднимет сессию сам.
    // Форма в две строки (result → handled) появилась ради возврата карточки после сброса,
    // поэтому проверяем обе половины контракта, а не одну строку целиком.
    expect(player).toMatch(/const started = startMainRef\.current\(\) === true;[\s\S]{0,600}?d\.handled = started;/);
    expect(player).toContain('const startMain = (): boolean => {');
    // Плеер не размонтируется после итога: старт из «заминки»/итога тоже обрабатываем.
    expect(player).toContain("if (phase === 'cooldown' || phase === 'done') {");
  });

  it('подход с пульта берёт живую сессию, а не замыкание рендера', () => {
    // Два set_add в одном дренаже очереди шли с одной и той же `session` и второй
    // затирал первый (дубль номера подхода, потерянный сет).
    expect(player).toContain('const live = liveSessionRef.current ?? session;');
    expect(player).toContain('const res = logSet(live, ei, {');
  });

  it('автосейв не уменьшает план дня (plannedTotalMax)', () => {
    expect(player).toContain('saveActiveSession(session, plannedSets, { plannedTotalMax: true });');
  });

  it('RIR-подсказка (прошлая сессия/план) не становится измеренным RPE', () => {
    // За ввод считаем только `actual`/override, а не `vals` с подсказкой.
    expect(player).toContain('const enteredRaw = ov ? { rpe: ov.rpe ?? 0, rir: ov.rir } : actual[keyFor(ei, si)];');
    // «Быстро» не кладёт плановый RIR в actual (иначе правка сета сочтёт его вводом).
    expect(player).not.toMatch(/\[k\]: \{[^}]*rir: t\.rir/);
  });
});

describe('widget-sync: план дня не уменьшается из виджета', () => {
  it('оба пути (старт и подход) сохраняют план с plannedTotalMax', () => {
    const hits = widgetSync.split('plannedTotalMax: true').length - 1;
    expect(hits).toBe(2);
    expect(widgetSync).toContain('saveActiveSession(res.session, plan?.plannedSets, { plannedTotalMax: true })');
  });

  it('push после дрена: применённые подходы сразу видны на пульте', () => {
    expect(widgetSync).toContain('if (setsAdded > 0) void pushTrainingWidget();');
  });

  it('syncAllWidgets сериализован (нет параллельного дрена одной очереди)', () => {
    expect(widgetSync).toContain('let draining = false;');
    expect(widgetSync).toContain('pendingReasons');
  });
});

describe('workout-logger: отмена подхода и план', () => {
  it('removeLastSet экспортируется и не мутирует вход', () => {
    expect(logger).toContain('export function removeLastSet(');
    expect(logger).toContain(
      'const exercises = (session.exercises || []).map((e) => ({ ...e, sets: [...(e.sets || [])] }));',
    );
  });

  it('saveActiveSession понимает plannedTotalMax и allowEmpty', () => {
    // `plannedTotalMax` — знаменатель прогресса не уменьшается виджетом;
    // `allowEmpty` — явный старт (тап «Начать») переживает запись без подходов.
    expect(logger).toMatch(/opts\?: \{ plannedTotalMax\?: boolean; allowEmpty\?: boolean \}/);
    expect(logger).toContain('if (opts?.plannedTotalMax) planned = Math.max(planned, prevPlanned);');
    expect(logger).toContain('if (!worth && opts?.allowEmpty !== true) return false;');
  });

  it('PR по e1RM строго выше текущего максимума (повтор не рекорд)', () => {
    expect(logger).toContain('const e1rmPrOk = sessionBestE1RM === 0 ? false : estimated1RM > sessionBestE1RM;');
  });

  it('завершение переживает битую startTime, а не падает', () => {
    expect(logger).toContain("String(session.startTime || '')");
    expect(logger).toContain('const validStart =');
  });

  it('пустая тренировка не пишется в журнал, а вызывающий получает empty', () => {
    // 0 подходов — не тренировка: раньше такая запись попадала в дневник и статистику.
    expect(logger).toContain(
      'if (!isActiveSessionWorthSaving(finished)) return { session: finished, saved: false, empty: true };',
    );
  });

  it('clearActiveSession удаляет только свою запись', () => {
    // Между чтением и очисткой в ключ мог лечь черновик другой сессии (вкладка/виджет).
    expect(logger).toContain('export function clearActiveSession(sessionId?: string): void {');
    expect(logger).toContain('stored.sessionId !== sessionId');
  });
});

describe('аналитика: без выдуманных длительностей, RPE и дат', () => {
  it('нет duration || 60 и подставного RPE 7', () => {
    expect(analyticsView).not.toContain('w.duration || 60');
    expect(hub).not.toContain('w.duration || 60');
    expect(hub).not.toContain('durationMin: 60');
    expect(hub).not.toContain('rpe: 7');
  });

  it('даты дневника парсятся локально, а не как UTC', () => {
    expect(analyticsView).toContain('const localDay = (value: string | Date): Date =>');
    expect(analyticsView).not.toContain('new Date(w.date)');
    expect(analyticsView).not.toContain('new Date(wo.date)');
  });

  it('TUT не считает отдых временем под нагрузкой', () => {
    expect(analyticsView).not.toContain('totalTUT += timePerSet');
  });

  it('средняя интенсивность недели — только по сетам с RPE', () => {
    expect(progression).toContain('const ratedLogs = weekLogs.filter(l => Number(l.rpe) > 0);');
  });
});

describe('аналитика: подписи не выдают оценку за измерение', () => {
  it('тренд объёма без предыдущего окна не показывается как «↑0%»', () => {
    expect(analyticsView).toContain('analytics.volume.hasPreviousPeriod ?');
    expect(analyticsView).toContain('нет базы для сравнения');
    expect(analyticsTab).toContain('volume.hasPreviousPeriod ?');
    expect(analyticsTab).toContain('нет базы для сравнения');
  });

  it('интенсивность подписана как RPE, а без оценок — прочерк', () => {
    expect(analyticsView).toContain('Интенсивность (RPE)');
    expect(analyticsView).toContain("'RPE не оценён'");
    expect(analyticsTab).toContain("'RPE не оценён'");
  });

  it('зоны названы зонами по повторам, а не процентами 1RM', () => {
    expect(analyticsView).toContain('зоны по числу повторов, не по %1RM');
    expect(analyticsView).toContain('1–6 повт.');
    expect(analyticsTab).toContain('зоны по числу повторов, не по %1RM');
  });

  it('TUT подписан как оценка, а «всего» называет фактическое окно, а не «8 недель»', () => {
    expect(analyticsView).toContain('const nSessions = lastWorkouts.length;');
    expect(analyticsView).toContain('Всего за ${nSessions} ${sessionsWord}');
    expect(analyticsView).not.toContain('Всего (8 нед)');
    expect(analyticsView).not.toContain('Всего за 8 тренировок');
    expect(analyticsView).toContain('≈3 с/повтор — оценка');
  });
});

describe('ProgressTab: реальные поля вместо подставных RPE 7 и 60 минут', () => {
  it('RPE, вес и длительность берутся из записи', () => {
    expect(progressTab).not.toContain('rpe: 7');
    expect(progressTab).not.toContain('durationMin: 60');
    expect(progressTab).toContain('weightKg: Number(s.weight) || 0');
    expect(progressTab).toContain('rpe: Number(s.rpe) || 0');
    expect(progressTab).toContain('durationMin: Number(w.duration) || 0');
  });
});

describe('Android-виджет: честный ввод подхода', () => {
  const quickAdd = read(
    '../../../../../android/app/src/main/java/com/healthengine/app/widgets/WidgetQuickAddActivity.java',
  );
  const provider = read(
    '../../../../../android/app/src/main/java/com/healthengine/app/widgets/WorkoutWidgetProvider.java',
  );

  it('план RIR не подставляется как RPE и не считается введённым', () => {
    // RPE-поле больше не заполняем из планового RIR (при RIR 0 это давало RPE 10).
    expect(quickAdd).not.toContain('rpeEt.setText(String.valueOf(Math.max(0, 10 - rir0)))');
    expect(quickAdd).toContain('boolean rirEntered = rirTouched && !rirTxt.isEmpty();');
    expect(quickAdd).toContain('item.put("rir", rirEntered ? rir : 0);');
  });

  it('«завершено» не обещает сохранение до синка', () => {
    expect(provider).not.toContain('"Тренировка сохранена"');
    expect(provider).toContain('Ждём синк с плеера');
  });
});
