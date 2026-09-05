package com.healthengine.app;

import android.content.res.Resources;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * DynamicColorPlugin — системный акцент Material You (Android 12+) в WebView.
 *
 * Палитра monet (system_accent1_* и accent2_*) — публичные ресурсы ОС, но их
 * точный набор зависит от версии SDK. Поэтому БЕЗ прямых ссылок на R:
 * цвета резолвятся через getIdentifier() — отсутствующий тон просто
 * пропускается, JS-сторона выбирает из того, что пришло.
 * На Android ниже 12 — available false, JS молча остаётся на ручном акценте.
 * ВНИМАНИЕ: внутри javadoc нельзя писать звездочка-слэш (закрывает комментарий).
 */
@CapacitorPlugin(name = "DynamicColor")
public class DynamicColorPlugin extends Plugin {

    private static final String[] WANTED = {
        "system_accent1_200",
        "system_accent1_400",
        "system_accent1_500",
        "system_accent1_600",
        "system_accent2_400",
        "system_accent2_500",
        "system_accent3_500",
        "system_neutral1_900"
    };

    @PluginMethod
    public void getDynamicColors(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            Resources res = getContext().getResources();
            boolean any = false;
            for (String name : WANTED) {
                String hex = resolveHex(res, name);
                if (hex == null) continue;
                // system_accent1_600 -> accent1_600
                String key = name.startsWith("system_") ? name.substring(7) : name;
                ret.put(key, hex);
                any = true;
            }
            ret.put("available", any);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("dynamic-color unavailable");
        }
    }

    private static String resolveHex(Resources res, String name) {
        try {
            int id = res.getIdentifier(name, "color", "android");
            if (id == 0) return null;
            int color = res.getColor(id, null);
            return String.format("#%06X", (0xFFFFFF & color));
        } catch (Exception ignored) {
            return null;
        }
    }
}
