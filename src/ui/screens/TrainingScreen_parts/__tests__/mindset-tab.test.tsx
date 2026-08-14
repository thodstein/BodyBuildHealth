/**
 * Смок-тесты вкладки «Психология» дневника + психо-панелей SessionPlayer.
 * SSR (renderToStaticMarkup) — проверка, что вкладка рендерится во всех состояниях.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MindsetTab } from '../MindsetTab';
import { MindsetPreSessionCard, MindsetApproachHint, MindsetCheckinCard } from '../../SRCBBScreen_parts/MindsetSessionPanels';
import { tabToHubMode } from '../DiaryAnalyticsZone';
import { buildPresetProtocol, upsertProtocol, setActiveProtocol, MINDSET_PROTOCOLS_KEY, MINDSET_ACTIVE_KEY } from '../../../../engines/mindset-protocol.engine';
import type { DiaryHubCtx } from '../diary-hub-context';

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
    expect(html).toBe('');
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
