/**
 * WidgetsSetupCard.tsx — виджеты APK на рабочий стол. ТОЛЬКО native.
 * Telegram/web этот компонент не импортируют.
 */

import React, { useState } from 'react';
import { NativeIcon } from './NativeIcons';
import {
  requestPinWidget,
  type WidgetKind,
} from '../../core/widget-bridge';
import { getLocale } from '../../data/interactions-labels';
import { syncAllWidgets } from './widget-sync';

const WIDGETS_RU: { kind: WidgetKind; icon: string; name: string; desc: string }[] = [
  { kind: 'training', icon: '🏋️', name: 'Тренировка', desc: 'Последняя сессия и переход в план в один тап' },
  { kind: 'timer', icon: '⏱️', name: 'Таймер отдыха', desc: 'Пресеты 0:30–3:00, старт/пауза без открытия приложения' },
  { kind: 'compliance', icon: '📊', name: 'Комплаенс', desc: 'Процент выполнения плана за неделю' },
  { kind: 'nutrition', icon: '🍽️', name: 'Питание', desc: 'Ккал дня, вода +250/+500 в один тап, переход в дневник' },
];

const WIDGETS_EN: { kind: WidgetKind; icon: string; name: string; desc: string }[] = [
  { kind: 'training', icon: '🏋️', name: 'Workout', desc: 'Last session and one-tap jump to the plan' },
  { kind: 'timer', icon: '⏱️', name: 'Rest timer', desc: 'Presets 0:30–3:00, start/pause without opening the app' },
  { kind: 'compliance', icon: '📊', name: 'Compliance', desc: 'Weekly plan completion percent' },
  { kind: 'nutrition', icon: '🍽️', name: 'Nutrition', desc: 'Day kcal, water +250/+500 in one tap, jump to diary' },
];

const PIN_REASON_RU: Record<string, string> = {
  'not-native': 'Доступно только в APK-версии',
  'not-supported': 'Лаунчер не поддерживает закрепление — добавьте вручную (инструкция ниже)',
  'api<26': 'Нужен Android 8.0+ — добавьте вручную (инструкция ниже)',
  'unknown-kind': 'Неизвестный виджет',
  error: 'Не получилось открыть диалог — добавьте вручную',
};

const PIN_REASON_EN: Record<string, string> = {
  'not-native': 'Available in the APK version only',
  'not-supported': 'Launcher does not support pinning — add manually (guide below)',
  'api<26': 'Android 8.0+ required — add manually (guide below)',
  'unknown-kind': 'Unknown widget',
  error: 'Could not open the dialog — add manually',
};

function strings() {
  if (getLocale() === 'en') {
    return {
      widgets: WIDGETS_EN,
      reasons: PIN_REASON_EN,
      cardLabel: 'Home screen widgets',
      title: 'Home screen widgets',
      sub: 'APK only · 4 widgets · work without opening the app',
      pin: (name: string) => `Pin the ${name} widget`,
      pinCta: '📌 To home',
      refreshBusy: 'Updating…',
      refreshCta: '🔄 Refresh widget data',
      refreshed: '✅ Data sent to widgets',
      refreshWater: (ml: number) => `widget water: +${ml} ml`,
      refreshFoods: (n: number) => `widget dishes: ${n}`,
      refreshFail: 'Could not refresh widgets',
      manualTitle: 'How to add manually',
      manual: (
        <>
          1. Long-press an empty spot on the home screen
          <br />
          2. Choose “Widgets”
          <br />
          3. Find “Health Engine” (HE · Workout / Timer / Compliance / Nutrition)
          <br />
          4. Drag the widget onto the screen
          <br />
          Data is pulled from the app every time you open Home.
        </>
      ),
      dialogOpened: '📌 System dialog opened — confirm adding to the home screen',
    };
  }
  return {
    widgets: WIDGETS_RU,
    reasons: PIN_REASON_RU,
    cardLabel: 'Виджеты рабочего стола',
    title: 'Виджеты на рабочий стол',
    sub: 'Только APK · 4 виджета · работают без открытия приложения',
    pin: (name: string) => `Закрепить виджет ${name}`,
    pinCta: '📌 На стол',
    refreshBusy: 'Обновление…',
    refreshCta: '🔄 Обновить данные виджетов',
    refreshed: '✅ Данные отправлены на виджеты',
    refreshWater: (ml: number) => `вода из виджета: +${ml} мл`,
    refreshFoods: (n: number) => `блюд из виджета: ${n}`,
    refreshFail: 'Не удалось обновить виджеты',
    manualTitle: 'Как добавить вручную',
    manual: (
      <>
        1. Задержите палец на пустом месте рабочего стола
        <br />
        2. Выберите «Виджеты»
        <br />
        3. Найдите «Health Engine» (HE · Тренировка / Таймер / Комплаенс / Питание)
        <br />
        4. Перетащите виджет на стол
        <br />
        Данные подтягиваются из приложения при каждом открытии Главной.
      </>
    ),
    dialogOpened: '📌 Системный диалог открыт — подтвердите добавление на рабочий стол',
  };
}

export const WidgetsSetupCard: React.FC = () => {
  const [busy, setBusy] = useState<WidgetKind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const T = strings();
  const reasons = T.reasons;

  const pin = async (kind: WidgetKind) => {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await requestPinWidget(kind);
      if (r.requested) setMsg(T.dialogOpened);
      else setMsg(reasons[r.reason ?? 'error'] ?? reasons.error);
    } catch {
      setMsg(reasons.error);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await syncAllWidgets();
      const parts: string[] = [T.refreshed];
      if (r.drainedWaterMl > 0) parts.push(T.refreshWater(r.drainedWaterMl));
      if (r.drainedFoods > 0) parts.push(T.refreshFoods(r.drainedFoods));
      setMsg(parts.join(' · '));
    } catch {
      setMsg(T.refreshFail);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="native-feature-card" aria-label={T.cardLabel}>
      <div className="native-feature-head">
        <span className="native-feature-icon" style={{ color: 'var(--accent-contrast)' }}><NativeIcon name="grid" size={20} /></span>
        <div>
          <div className="native-feature-title">{T.title}</div>
          <div className="native-feature-sub">{T.sub}</div>
        </div>
      </div>
      <div className="native-feature-list">
        {T.widgets.map((w) => (
          <div key={w.kind} className="native-feature-row">
            <span className="native-feature-row-icon">{w.icon}</span>
            <div className="native-feature-row-body">
              <div className="native-feature-row-name">{w.name}</div>
              <div className="native-feature-row-desc">{w.desc}</div>
            </div>
            <button
              className="native-feature-btn"
              disabled={busy === w.kind}
              onClick={() => pin(w.kind)}
              aria-label={T.pin(w.name)}
            >
              {busy === w.kind ? '…' : T.pinCta}
            </button>
          </div>
        ))}
      </div>
      <button className="native-feature-wide" disabled={syncing} onClick={refresh}>
        {syncing ? T.refreshBusy : T.refreshCta}
      </button>
      {msg && (
        <div className="native-feature-msg" role="status">
          {msg}
        </div>
      )}
      <details className="native-feature-details">
        <summary>{T.manualTitle}</summary>
        <div className="native-feature-how">{T.manual}</div>
      </details>
    </div>
  );
};
