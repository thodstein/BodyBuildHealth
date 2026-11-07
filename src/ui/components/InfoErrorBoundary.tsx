import React from 'react';

/**
 * Локальный предохранитель: падение вложенного блока не роняет экран целиком —
 * показывает красную плашку с текстом ошибки и стеком.
 *
 * Вынесен из `SupportScreen_parts/SupportScreenData.tsx`: этот файл тянет за
 * собой весь каталог БАДов (3+ МБ) и справочники, а нужен он был только ради
 * этого маленького компонента — из-за него все экраны и старт приложения
 * грузили каталог БАДов.
 */
export class InfoErrorBoundary extends React.Component<
  { children?: React.ReactNode; label: string },
  { hasError: boolean; err: string; stack: string }
> {
  constructor(p: { children?: React.ReactNode; label: string }) {
    super(p);
    this.state = { hasError: false, err: '', stack: '' };
  }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, err: String(e?.message || e), stack: e?.stack || '' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 16,
            textAlign: 'left',
            color: '#ef4444',
            fontSize: 10,
            background: 'rgba(239,68,68,0.06)',
            borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            ⚠ {this.props.label}: {this.state.err}
          </div>
          <pre style={{ fontSize: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all', opacity: 0.8 }}>
            {this.state.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
