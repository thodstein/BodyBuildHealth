/**
 * arm-design-system.tsx — презентационные примитивы арм-планировщика.
 *
 * Тонкие обёртки над классами arm-design.css (импорт стилей — здесь же,
 * статически, как SupportVisualUpgrade.css в своём экране; shared-файлы
 * и main.tsx не тронуты). Логики ноль: все пропсы уходят в DOM 1-в-1,
 * строки/aria/роли задаёт вызывающий (контракты тестов не меняются).
 */
import React from 'react';
import './arm-design.css';
import { isNativeApp } from '../../../core/app-platform';
import { ensureArmApkStyles } from './arm-apk-loader';

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** Корень поверхности: держит train-* класс + arm-apk только в native. */
export function AdRoot({
  rootClass,
  maxWidth,
  children,
}: {
  rootClass: string;
  maxWidth?: number;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    ensureArmApkStyles();
  }, []);
  return (
    <div
      className={isNativeApp() ? `${rootClass} arm-apk ad-wrap` : `${rootClass} ad-wrap`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {children}
    </div>
  );
}

/** Шапка поверхности: иконка + заголовок + подзаголовок + правый слот. */
export function AdHead({
  icon,
  title,
  sub,
  side,
}: {
  icon: string;
  title: string;
  sub?: string;
  side?: React.ReactNode;
}) {
  return (
    <div className="ad-head">
      <div className="ad-head-ic" aria-hidden>
        {icon}
      </div>
      <div className="ad-head-tx">
        <h2 className="ad-head-title">{title}</h2>
        {sub ? <p className="ad-head-sub">{sub}</p> : null}
      </div>
      {side ? <div className="ad-head-side">{side}</div> : null}
    </div>
  );
}

export type AdStepDef = { id: string; label: string };

/**
 * Липкая лента шагов. Нумерация — визуальная (aria-hidden), доступное имя
 * кнопки = label 1-в-1 (контракт getByRole exact).
 */
export function AdSteps({
  steps,
  active,
  onSelect,
  hook,
}: {
  steps: AdStepDef[];
  active: string;
  onSelect: (id: string) => void;
  hook: string;
}) {
  return (
    <div className="ad-steps" data-arm={hook} aria-label="Шаги">
      {steps.map((s, i) => (
        <button
          key={s.id}
          aria-label={s.label}
          data-active={active === s.id}
          className="ad-step"
          onClick={() => onSelect(s.id)}
        >
          <span className="ad-step-n" aria-hidden>
            {i + 1}
          </span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

export function AdCard({ className, children, ...rest }: DivProps) {
  return (
    <div className={className ? `ad-card ${className}` : 'ad-card'} {...rest}>
      {children}
    </div>
  );
}

export function AdSec({
  title,
  hint,
  children,
  hook,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  hook?: string;
}) {
  return (
    <div className="ad-sec" {...(hook ? { 'data-arm': hook } : {})}>
      <div className="ad-sec-h">
        <div className="ad-sec-t">{title}</div>
      </div>
      {hint ? <div className="ad-sec-hint">{hint}</div> : null}
      {children}
    </div>
  );
}

export function AdGrid({
  cols,
  children,
}: {
  cols: '2' | '3' | 'auto' | 'auto-sm';
  children: React.ReactNode;
}) {
  return (
    <div className="ad-grid" data-cols={cols}>
      {children}
    </div>
  );
}

export function AdField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="ad-field">
      <span className="ad-fl">{label}</span>
      {children}
    </label>
  );
}

export function AdCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="ad-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function AdChip({
  active,
  tone,
  dim,
  children,
  ...rest
}: BtnProps & { active?: boolean; tone?: 'red' | 'green'; dim?: boolean }) {
  return (
    <button
      className="ad-chip"
      data-active={!!active}
      aria-pressed={!!active}
      {...(tone ? { 'data-tone': tone } : {})}
      {...(dim ? { 'data-dim': 'true' } : {})}
      {...rest}
    >
      {children}
    </button>
  );
}

export function AdBtn({
  variant = 'primary',
  block,
  hero,
  children,
  ...rest
}: BtnProps & { variant?: 'primary' | 'ghost' | 'amber' | 'danger' | 'dark'; block?: boolean; hero?: boolean }) {
  const cls = `ad-btn${block ? ' ad-btn-block' : ''}${hero ? ' ad-btn-hero' : ''}`;
  return (
    <button className={cls} data-variant={variant} {...rest}>
      {children}
    </button>
  );
}

export function AdBanner({
  tone = 'info',
  children,
  hook,
}: {
  tone?: 'info' | 'ok' | 'warn' | 'bad';
  children: React.ReactNode;
  hook?: string;
}) {
  return (
    <div className="ad-banner" data-tone={tone} {...(hook ? { 'data-arm': hook } : {})}>
      {children}
    </div>
  );
}

export function AdStat({ value, label, sub }: { value: React.ReactNode; label: string; sub?: React.ReactNode }) {
  return (
    <div className="ad-stat">
      <div className="ad-stat-v">{value}</div>
      <div className="ad-stat-l">{label}</div>
      {sub ? <div className="ad-stat-s">{sub}</div> : null}
    </div>
  );
}
