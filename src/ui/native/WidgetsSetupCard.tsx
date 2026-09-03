/**
 * WidgetsSetupCard.tsx — виджеты APK на рабочий стол. ТОЛЬКО native.
 * Telegram/web этот компонент не импортируют.
 */

import React, { useState } from 'react';
import {
  requestPinWidget,
  type WidgetKind,
} from '../../core/widget-bridge';
import { syncAllWidgets } from './widget-sync';

const WIDGETS: { kind: WidgetKind; icon: string; name: string; desc: string }[] = [
  { kind: 'training', icon: '🏋️', name: 'Тренировка', desc: 'Последняя сессия и переход в план в один тап' },
  { kind: 'timer', icon: '⏱️', name: 'Таймер отдыха', desc: 'Пресеты 0:30–3:00, старт/пауза без открытия приложения' },
  { kind: 'compliance', icon: '📊', name: 'Комплаенс', desc: 'Процент выполнения плана за неделю' },
  { kind: 'nutrition', icon: '🍽️', name: 'Питание', desc: 'Ккал дня, вода +250/+500 в один тап, переход в дневник' },
];

const PIN_REASON_RU: Record<string, string> = {
  'not-native': 'Доступно только в APK-версии',
  'not-supported': 'Лаунчер не поддерживает закрепление — добавьте вручную (инструкция ниже)',
  'api<26': 'Нужен Android 8.0+ — добавьте вручную (инструкция ниже)',
  'unknown-kind': 'Неизвестный виджет',
  error: 'Не получилось открыть диалог — добавьте вручную',
};

export const WidgetsSetupCard: React.FC = () => {
  const [busy, setBusy] = useState<WidgetKind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const pin = async (kind: WidgetKind) => {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await requestPinWidget(kind);
      if (r.requested) setMsg('📌 Системный диалог открыт — подтвердите добавление на рабочий стол');
      else setMsg(PIN_REASON_RU[r.reason ?? 'error'] ?? PIN_REASON_RU.error);
    } catch {
      setMsg(PIN_REASON_RU.error);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await syncAllWidgets();
      const parts: string[] = ['✅ Данные отправлены на виджеты'];
      if (r.drainedWaterMl > 0) parts.push(`вода из виджета: +${r.drainedWaterMl} мл`);
      if (r.drainedFoods > 0) parts.push(`блюд из виджета: ${r.drainedFoods}`);
      setMsg(parts.join(' · '));
    } catch {
      setMsg('Не удалось обновить виджеты');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="native-feature-card" aria-label="Виджеты рабочего стола">
      <div className="native-feature-head">
        <span className="native-feature-icon">🧩</span>
        <div>
          <div className="native-feature-title">Виджеты на рабочий стол</div>
          <div className="native-feature-sub">Только APK · 4 виджета · работают без открытия приложения</div>
        </div>
      </div>
      <div className="native-feature-list">
        {WIDGETS.map((w) => (
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
              aria-label={`Закрепить виджет ${w.name}`}
            >
              {busy === w.kind ? '…' : '📌 На стол'}
            </button>
          </div>
        ))}
      </div>
      <button className="native-feature-wide" disabled={syncing} onClick={refresh}>
        {syncing ? 'Обновление…' : '🔄 Обновить данные виджетов'}
      </button>
      {msg && (
        <div className="native-feature-msg" role="status">
          {msg}
        </div>
      )}
      <details className="native-feature-details">
        <summary>Как добавить вручную</summary>
        <div className="native-feature-how">
          1. Задержите палец на пустом месте рабочего стола
          <br />
          2. Выберите «Виджеты»
          <br />
          3. Найдите «Health Engine» (HE · Тренировка / Таймер / Комплаенс / Питание)
          <br />
          4. Перетащите виджет на стол
          <br />
          Данные подтягиваются из приложения при каждом открытии Главной.
        </div>
      </details>
    </div>
  );
};
