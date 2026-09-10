/**
 * apk-share.ts — единый слой выдачи для АПК.
 *
 * Проблема: classic web-приёмы не работают в Capacitor WebView:
 * - <a download> / Blob-скачивание — файл уходит в никуда;
 * - window.open(...).print() — попапы заблокированы;
 * - navigator.clipboard — может отсутствовать без фокуса/пермишена.
 *
 * Решение: на native идём через native-bridge (Filesystem Documents + Share),
 * на web/telegram — прежние приёмы 1-в-1. Все функции безопасны везде,
 * ничего не бросают наружу (возвращают 'shared' | 'copied' | 'saved' | 'failed').
 */

import { isNativeApp } from './app-platform';
import { shareText, saveTextFile } from './native-bridge';

export type ApkShareOutcome = 'shared' | 'copied' | 'saved' | 'failed';

/** dataUrl (из pickPhoto) → File для handleFileUpload/processUploadedFile. */
export function dataUrlToFile(dataUrl: string, filename = 'photo.jpg'): File | null {
  try {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) return null;
    const mime = m[1] || 'image/jpeg';
    const isB64 = !!m[2];
    const raw = m[3] || '';
    let bytes: Uint8Array;
    if (isB64) {
      const bin = atob(raw);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      const dec = decodeURIComponent(raw);
      bytes = new Uint8Array(dec.length);
      for (let i = 0; i < dec.length; i++) bytes[i] = dec.charCodeAt(i);
    }
    return new File([bytes as BlobPart], filename, { type: mime });
  } catch {
    return null;
  }
}

/** Скопировать текст: native — Share-диалог, иначе clipboard → textarea-fallback. */
export async function copyOrShareText(text: string, shareTitle = 'Health Engine'): Promise<ApkShareOutcome> {
  if (!text) return 'failed';
  if (isNativeApp()) {
    try {
      const ok = await shareText({ title: shareTitle, text });
      if (ok) return 'shared';
    } catch {
      /* fallback ниже */
    }
  }
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
      await (navigator as any).clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    /* fallback ниже */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Сохранить текстовый файл (CSV/JSON/TXT):
 * native — Documents + Share-диалог, web — классический <a download>.
 */
export async function saveTextFileApk(filename: string, text: string, mime = 'text/plain;charset=utf-8'): Promise<ApkShareOutcome> {
  if (isNativeApp()) {
    try {
      const ok = await saveTextFile(filename, text);
      return ok ? 'saved' : 'failed';
    } catch {
      return 'failed';
    }
  }
  try {
    const blob = new Blob(['\uFEFF' + text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, 1000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** CSV-обёртка: native — .csv в Documents+Share, web — как было. */
export async function saveCsvApk(filename: string, csv: string): Promise<ApkShareOutcome> {
  const name = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  return saveTextFileApk(name, csv, 'text/csv;charset=utf-8;');
}

/**
 * HTML-отчёт (печать/PDF): native — сохранить .html + Share (системная
 * печать/отправка из शेयर-диалога), web — window.open().print() как было,
 * при блокировке попапа — шаринг текста.
 */
export async function printHtmlApk(html: string, filename: string, fallbackText?: string): Promise<ApkShareOutcome> {
  if (isNativeApp()) {
    const name = filename.toLowerCase().endsWith('.html') ? filename : `${filename}.html`;
    try {
      const ok = await saveTextFile(name, html);
      return ok ? 'saved' : 'failed';
    } catch {
      return 'failed';
    }
  }
  try {
    const w = window.open('', '_blank');
    if (!w) {
      if (fallbackText) return copyOrShareText(fallbackText);
      return 'failed';
    }
    w.document.write(html);
    w.document.close();
    try {
      w.focus();
    } catch {
      /* ignore */
    }
    try {
      w.print();
    } catch {
      /* ignore */
    }
    return 'saved';
  } catch {
    if (fallbackText) return copyOrShareText(fallbackText);
    return 'failed';
  }
}

/**
 * Сохранить бинарный Blob (PNG-графики): native — base64 в Documents + Share,
 * web — классический <a download>. Ничего не бросает наружу.
 */
export async function saveBlobApk(filename: string, blob: Blob): Promise<ApkShareOutcome> {
  if (isNativeApp()) {
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('read'));
        r.readAsDataURL(blob);
      });
      const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const res = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents });
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: filename, url: res.uri });
      } catch {
        /* файл уже сохранён — диалог опционален */
      }
      return 'saved';
    } catch {
      return 'failed';
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, 500);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Маленький тост-статус для кнопок выдачи (без зависимости от UI-кита). */
export function shareOutcomeLabel(o: ApkShareOutcome): string {  if (o === 'shared') return '📤 Отправлено';
  if (o === 'saved') return '💾 Сохранено';
  if (o === 'copied') return '📋 Скопировано';
  return '⚠ Не удалось';
}
