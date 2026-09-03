/**
 * DashboardScreen.native.tsx — PRO-домашний экран ТОЛЬКО для APK.
 * Telegram Mini App продолжает рендерить классический DashboardScreen без изменений.
 *
 * Hero-картинка та же (hero-main.png) — на весь экран, поверх неё спортивный
 * контент: приветствие, статистика недели, последняя тренировка, быстрые действия.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { getProfile } from '../../core/profile-manager';
import { getWeightLog } from '../../engines/profile-store';
import {
  getWorkoutStats,
  getLastSession,
  getSessionsByWeek,
  getISOWeekNumber,
} from '../../engines/workout-logger.engine';
import { getSymptomDiaryStats } from '../../engines/symptom-diary.engine';
import { getAdherenceStats } from '../../engines/symptom-adherence.engine';
import { consumeWidgetLaunchTarget } from '../../core/widget-bridge';
import { syncAllWidgets } from '../native/widget-sync';
import { WidgetsSetupCard } from '../native/WidgetsSetupCard';
import { BiometrySetupCard } from '../native/BiometrySetupCard';
import { NativeFeaturesCard } from '../native/NativeFeaturesCard';

export type DashboardNativeNavId =
  | 'training' | 'nutrition' | 'labs' | 'risks' | 'pharma' | 'support'
  | 'profile' | 'articles' | 'marketplace';

interface Props {
  onNavigate?: (screen: DashboardNativeNavId) => void;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

function localISO(d: Date = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

function dateLine(): string {
  try {
    const s = new Date().toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return '';
  }
}

function fmtDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function fmtVolume(kg: number): string {
  if (!kg || kg <= 0) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} т`;
  return `${Math.round(kg)} кг`;
}

const ACTIONS: { id: DashboardNativeNavId; icon: string; label: string; hint: string }[] = [
  { id: 'training', icon: '🏋️', label: 'Тренинг', hint: 'План и дневник' },
  { id: 'nutrition', icon: '🍽️', label: 'Питание', hint: 'Рацион и КБЖУ' },
  { id: 'labs', icon: '🧪', label: 'Анализы', hint: 'Маркеры и тренды' },
  { id: 'risks', icon: '⚠️', label: 'Риски', hint: 'Оценка и контроль' },
  { id: 'pharma', icon: '💊', label: 'Фарма', hint: 'Курс и препараты' },
  { id: 'support', icon: '🛡️', label: 'БАДы', hint: 'Поддержка' },
  { id: 'profile', icon: '👤', label: 'Профиль', hint: 'Данные и дневники' },
  { id: 'articles', icon: '📚', label: 'Статьи', hint: 'База знаний' },
  { id: 'marketplace', icon: '🛍️', label: 'Магазин', hint: 'Маркет' },
];

export const DashboardNative: React.FC<Props> = ({ onNavigate }) => {
  const [widgetMsg, setWidgetMsg] = useState<string | null>(null);

  // Виджеты: при входе на Главную — отдать очередь в дневники, запушить
  // свежие снапшоты и отработать тап по виджету (one-shot deep link).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await syncAllWidgets();
        if (!alive) return;
        const parts: string[] = [];
        if (r.drainedWaterMl > 0) parts.push(`💧 +${r.drainedWaterMl} мл из виджета`);
        if (r.drainedFoods > 0) parts.push(`🍽️ блюд из виджета: ${r.drainedFoods}`);
        if (parts.length > 0) setWidgetMsg(parts.join(' · '));
      } catch {
        /* виджеты недоступны — тихий no-op */
      }
      try {
        const target = await consumeWidgetLaunchTarget();
        if (!alive || !target || target === 'home') return;
        if (target === 'training' || target === 'nutrition' || target === 'support') {
          onNavigate?.(target);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [onNavigate]);

  const data = useMemo(() => {
    const profile = safe(() => getProfile(), null as never);
    const settings = (profile as unknown as { settings?: never } | null)?.settings as
      | Record<string, Record<string, unknown>>
      | undefined;
    const personal = (settings?.personal ?? {}) as Record<string, unknown>;
    const name =
      ((profile as unknown as { name?: unknown } | null)?.name as string) ||
      (personal.name as string) ||
      '';
    const stats = safe(() => getWorkoutStats(), null as never);
    const last = safe(() => getLastSession(), null);
    const today = localISO();
    const weekSessions = safe(
      () => getSessionsByWeek(getISOWeekNumber(today)).length,
      0,
    );
    const weights = safe(() => getWeightLog(), []);
    const lastW = weights.length > 0 ? weights[weights.length - 1] : null;
    let weightDelta: number | null = null;
    if (lastW && weights.length > 1) {
      const target = Date.parse(lastW.date) - 7 * 86400000;
      let ref = weights[0];
      for (const w of weights) {
        if (Date.parse(w.date) <= target) ref = w;
        else break;
      }
      if (ref && ref !== lastW) weightDelta = lastW.weight - ref.weight;
    }
    const sleepArr = safe(() => {
      const raw = JSON.parse(localStorage.getItem('he_sleep_diary') || '[]');
      return Array.isArray(raw) ? raw : [];
    }, [] as { date?: string; hours?: number }[]);
    const lastSleep =
      sleepArr.length > 0
        ? [...sleepArr].sort((a, b) => String(a.date).localeCompare(String(b.date))).pop()
        : null;
    const symptoms = safe(() => getSymptomDiaryStats(), null as never);
    const adherence = safe(() => getAdherenceStats(), null as never);
    const drugWarnings = safe(() => {
      const d = localStorage.getItem('he_drug_warnings');
      return d ? (JSON.parse(d) as { count: number; highCount: number; warnings: string[] }) : null;
    }, null);
    return {
      name,
      totalSessions: stats?.totalSessions ?? 0,
      streak: stats?.streak ?? 0,
      weekSessions,
      last,
      lastW,
      weightDelta,
      lastSleepHours:
        lastSleep && typeof lastSleep.hours === 'number' ? lastSleep.hours : null,
      symptoms,
      adherence,
      drugWarnings,
    };
  }, []);

  return (
    <div className="native-home">
      <div className="native-home-bg" aria-hidden="true">
        <img src="/hero-main.png?v=20250827k" alt="" draggable={false} />
        <div className="native-home-shade" />
      </div>

      <div className="native-home-content">
        <div className="native-home-kicker">Health Engine · Pro</div>
        <h1 className="native-home-title">
          {greeting()}
          {data.name ? `, ${data.name}` : ''}
        </h1>
        <div className="native-home-date">
          {dateLine()}
          {data.streak > 0 && (
            <span className="native-home-streak">🔥 {data.streak} дн. подряд</span>
          )}
        </div>

        <div className="native-home-rail">
          <div className="native-home-stat">
            <div className="native-home-stat-v">{data.weekSessions}</div>
            <div className="native-home-stat-l">тренировок на неделе</div>
            <div className="native-home-stat-s">всего {data.totalSessions}</div>
          </div>
          <div className="native-home-stat">
            <div className="native-home-stat-v">
              {data.lastW ? data.lastW.weight.toFixed(1) : '—'}
            </div>
            <div className="native-home-stat-l">вес, кг</div>
            <div className="native-home-stat-s">
              {data.weightDelta === null
                ? data.lastW
                  ? fmtDate(data.lastW.date)
                  : 'нет данных'
                : `${data.weightDelta > 0 ? '+' : ''}${data.weightDelta.toFixed(1)} за 7 дн`}
            </div>
          </div>
          <div className="native-home-stat">
            <div className="native-home-stat-v">
              {data.lastSleepHours === null ? '—' : data.lastSleepHours.toFixed(1)}
            </div>
            <div className="native-home-stat-l">сон, ч</div>
            <div className="native-home-stat-s">прошлая ночь</div>
          </div>
          <div className="native-home-stat">
            <div className="native-home-stat-v">{data.symptoms ? data.symptoms.activeSymptoms : '—'}</div>
            <div className="native-home-stat-l">активных симптомов</div>
            <div className="native-home-stat-s">
              {data.symptoms ? `ср. балл ${data.symptoms.todayScore}/10` : 'дневник симптомов'}
            </div>
          </div>
        </div>

        {data.last && (
          <button
            className="native-home-last"
            onClick={() => onNavigate?.('training')}
            aria-label="Открыть тренинг"
          >
            <div className="native-home-last-top">Последняя тренировка</div>
            <div className="native-home-last-title">{data.last.focus || 'Тренировка'}</div>
            <div className="native-home-last-sub">
              {fmtDate(data.last.date)} · {fmtVolume(data.last.totalVolume)} · {data.last.totalSets} подходов
            </div>
          </button>
        )}

        <div className="native-home-section">Разделы</div>
        <div className="native-home-grid">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              className="native-home-tile"
              onClick={() => onNavigate?.(a.id)}
            >
              <span className="native-home-tile-icon">{a.icon}</span>
              <span className="native-home-tile-label">{a.label}</span>
              <span className="native-home-tile-hint">{a.hint}</span>
            </button>
          ))}
        </div>

        {data.drugWarnings && data.drugWarnings.highCount > 0 && (
          <div className="native-home-warn">
            <div className="native-home-warn-t">
              ⚠ Взаимодействия: {data.drugWarnings.count}
            </div>
            <div className="native-home-warn-s">
              🔴 {data.drugWarnings.highCount} критических.{' '}
              {data.drugWarnings.warnings.slice(0, 3).join(' · ')}
            </div>
          </div>
        )}

        {data.symptoms && data.symptoms.activeSymptoms > 0 && (
          <div className="native-home-warn native-home-warn--ok">
            <div className="native-home-warn-t">
              🩺 Симптомы: {data.symptoms.activeSymptoms} активных
            </div>
            <div className="native-home-warn-s">
              📉 {data.symptoms.improving} · ➡️ {data.symptoms.stable} · 📈{' '}
              {data.symptoms.worsening} · ✅ {data.symptoms.resolved}
              {data.adherence.activeCount > 0 &&
                ` · 💊 приверженность ${data.adherence.adherence7d}%`}
            </div>
          </div>
        )}

        {widgetMsg && (
          <div className="native-home-warn native-home-warn--ok" role="status">
            <div className="native-home-warn-s">{widgetMsg}</div>
          </div>
        )}

        <div className="native-home-section">Телефон · APK</div>
        <WidgetsSetupCard />
        <BiometrySetupCard />
        <NativeFeaturesCard />
      </div>
    </div>
  );
};
