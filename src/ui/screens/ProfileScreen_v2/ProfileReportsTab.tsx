/**
 * ProfileReportsTab — вкладка «📊 Отчёты» Профиля (открывается из hero-карточки «Отчёты»).
 * Подвкладки:
 *  - «Комплексный отчёт» — сводный отчёт для врача/тренера (ReportsScreen).
 *  - «Отчёты по блокам» — быстрые переходы к страницам отчётов модулей приложения
 *    (открывают ИМЕННО страницы отчётов с кнопками генерации, а не главные страницы блоков).
 *  - «Архив отчётов» — сохранённые отчёты всех блоков из localStorage.
 */
import React, { useState, useEffect } from 'react';
import { colors } from './ui';
import { ReportsScreen } from '../ReportsScreen';

/* ── Источники отчётов блоков (единый список для подвкладок) ── */

export interface ReportSource {
  current: string;
  label: string;
  target: string;
  archiveKeys: string[];
  color: string;
  desc: string;
}

export const REPORT_SOURCES: ReportSource[] = [
  {
    current: 'he_training_report_current',
    label: '🏋️ Тренер-отчёт',
    target: 'training-analytics',
    archiveKeys: ['he_training_reports'],
    color: colors.blue,
    desc: 'Анализ силы, прогрессии, объёма, восстановления',
  },
  {
    current: 'he_nutrition_report_current',
    label: '🍽 Отчёт по питанию',
    target: 'nutrition-reports',
    archiveKeys: ['he_nutrition_report_archive'],
    color: colors.green,
    desc: 'КБЖУ за день/неделю/месяц, микронутриенты',
  },
  {
    current: 'he_labs_report_current',
    label: '🩺 Врач-отчёт',
    target: 'labs-reports',
    archiveKeys: ['he_lab_reports'],
    color: colors.danger,
    desc: 'Анализы: отклонения, динамика по фазам',
  },
  {
    current: 'he_support_reports',
    label: '🛡 Отчёт поддержки',
    target: 'support-reports',
    archiveKeys: ['he_support_reports_archive', 'he_support_reports'],
    color: colors.purple,
    desc: 'Стек, фазы, перекрёстные риски, совместимость',
  },
  {
    current: 'he_pharma_report_current',
    label: '💊 Фарма-отчёт',
    target: 'pharma-reports',
    archiveKeys: ['he_pharma_reports'],
    color: colors.warning,
    desc: 'Оценка курса: баланс, безопасность, длительность',
  },
  {
    current: 'he_risk_report_current',
    label: '⚠️ Отчёт по рискам',
    target: 'risk-reports',
    archiveKeys: ['he_risk_reports'],
    color: '#f97316',
    desc: 'Риск по системам органов, динамика',
  },
  {
    current: 'he_profile_reports',
    label: '📊 Комплексный отчёт',
    target: 'custom-report',
    archiveKeys: ['he_profile_reports'],
    color: colors.orange,
    desc: 'Сводный отчёт по разделам профиля',
  },
];

export interface StoredReport {
  date?: string;
  generatedAt?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/** Собрать ВСЕ сохранённые отчёты источника (текущий + архив). */
export function readReportEntries(src: ReportSource): StoredReport[] {
  const list: StoredReport[] = [];
  const push = (raw: string | null) => {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) list.push(...parsed);
      else if (parsed) list.push(parsed);
    } catch {}
  };
  push(localStorage.getItem(src.current));
  for (const key of src.archiveKeys) push(localStorage.getItem(key));
  return list;
}

export type ReportsView = 'comprehensive' | 'blocks' | 'archive';

const VIEW_TABS: { id: ReportsView; label: string; color: string }[] = [
  { id: 'comprehensive', label: '📊 Комплексный отчёт', color: colors.blue },
  { id: 'blocks', label: '📦 Отчёты по блокам', color: colors.teal },
  { id: 'archive', label: '🗄 Архив отчётов', color: colors.orange },
];

export const ProfileReportsTab: React.FC<{
  onNavigate?: (screen: string) => void;
  initialView?: ReportsView;
}> = ({ onNavigate, initialView }) => {
  const [view, setView] = useState<ReportsView>(initialView || 'comprehensive');

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  return (
    <div className="profile-reports" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="profile-reports-tabs" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="Разделы отчётов">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            role="tab"
            aria-selected={view === t.id}
            className="profile-reports-tab"
            data-active={view === t.id}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              border: `1px solid ${view === t.id ? colors.primary : colors.border}`,
              background: view === t.id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.03)',
              color: view === t.id ? colors.primary : colors.textMuted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'comprehensive' && (
        <div style={{ padding: '0 0 12px' }}>
          <ReportsScreen />
        </div>
      )}

      {view === 'blocks' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.text, marginBottom: 2 }}>📦 Отчёты по блокам</div>
          <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 10, lineHeight: 1.3 }}>
            Переход к страницам отчётов модулей: откроется именно отчёт с кнопкой генерации, а не главная страница блока.
          </div>
          <div role="list" className="profile-reports-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REPORT_SOURCES.map((src) => {
              const list = readReportEntries(src);
              const last = list[0];
              return (
                <button
                  key={src.target}
                  onClick={() => onNavigate?.(src.target)}
                  className="profile-reports-item"
                  role="listitem"
                  aria-label={`Открыть ${src.label}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    minHeight: 60,
                    background: `${src.color}10`,
                    border: `1px solid ${src.color}44`,
                    color: colors.text,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      background: `${src.color}26`,
                      fontSize: 20,
                    }}
                  >
                    {src.label.split(' ')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: src.color }}>
                      {src.label.replace(/^[^\s]+\s/, '')}
                    </div>
                    <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{src.desc}</div>
                    <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 3, opacity: 0.8 }}>
                      {list.length === 0
                        ? 'Нет отчётов'
                        : `${list.length} ${list.length === 1 ? 'отчёт' : list.length < 5 ? 'отчёта' : 'отчётов'}${last?.date ? ` · последний ${new Date(last.date).toLocaleDateString('ru-RU')}` : ''}`}
                    </div>
                  </div>
                  <span style={{ color: src.color, fontSize: 18, opacity: 0.7 }}>→</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'archive' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.text, marginBottom: 2 }}>🗄 Архив отчётов</div>
          <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 10, lineHeight: 1.3 }}>
            Сохранённые отчёты всех блоков. Каждый пункт ведёт к странице отчёта своего модуля.
          </div>
          {REPORT_SOURCES.every((src) => readReportEntries(src).length === 0) ? (
            <div style={{ color: colors.textMuted, fontSize: 12, padding: 12 }}>Архив отчётов пуст.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REPORT_SOURCES.flatMap((src) =>
                readReportEntries(src).map((rep, i) => ({ src, rep, key: `${src.target}-${i}` })),
              ).map(({ src, rep, key }) => (
                <button
                  key={key}
                  onClick={() => onNavigate?.(src.target)}
                  aria-label={`Открыть архив: ${src.label}`}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                  }}
                >
                  <div style={{ color: src.color, fontWeight: 700, fontSize: 12 }}>{src.label}</div>
                  <div style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>
                    {rep.date ? new Date(rep.date).toLocaleString('ru-RU') : 'Архивный отчёт'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};