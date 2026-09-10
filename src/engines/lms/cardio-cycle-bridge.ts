/**
 * cardio-cycle-bridge.ts — мост «Каталог шаблонов → Кардио-конструктор».
 * Своя зона (не planner-bridge — тот shared/чужой, не трогаем):
 * localStorage + CustomEvent, паттерн как cardio-bridge.ts.
 */
const KEY = 'he_cardio_template_pending';
type Listener = (templateId: string | null) => void;

export function requestCardioTemplateBuild(templateId: string): void {
  try { localStorage.setItem(KEY, JSON.stringify({ templateId, at: new Date().toISOString() })); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('cardio-template-pending', { detail: templateId }));
}

/** Прочитать и очистить заявку (consume-once — повторный маунт не дублирует). */
export function consumeCardioTemplatePending(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.templateId === 'string' ? v.templateId : null;
  } catch { return null; }
}

export function subscribeCardioTemplatePending(cb: Listener): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail ?? null);
  window.addEventListener('cardio-template-pending', handler);
  return () => window.removeEventListener('cardio-template-pending', handler);
}
