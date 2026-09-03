package com.healthengine.app.widgets;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * WidgetStore — SharedPreferences-хранилище данных для homescreen-виджетов APK.
 *
 * Почему не localStorage WebView: виджеты (AppWidgetProvider) живут вне WebView
 * и не видят его localStorage. JS-мост (WidgetBridgePlugin) пишет сюда снапшоты,
 * провайдеры виджетов только читают. Максимум 50 записей в очереди питания.
 */
public final class WidgetStore {

    public static final String PREFS = "he_widgets";

    public static final String KEY_TRAINING = "training_json";
    public static final String KEY_COMPLIANCE = "compliance_json";
    public static final String KEY_NUTRITION = "nutrition_json";
    public static final String KEY_QUEUE = "nutrition_queue";
    public static final String KEY_TIMER = "timer_json";
    public static final String KEY_LAUNCH_TARGET = "launch_target";

    /** Intent action: открыть приложение из виджета. */
    public static final String ACTION_OPEN = "com.healthengine.app.action.WIDGET_OPEN";
    public static final String EXTRA_TARGET = "target";

    /** Targets for JS router (DashboardNative). */
    public static final String TARGET_TRAINING = "training";
    public static final String TARGET_NUTRITION = "nutrition";
    public static final String TARGET_SUPPORT = "support";
    public static final String TARGET_HOME = "home";

    private WidgetStore() {}

    public static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void putJson(Context ctx, String key, JSONObject obj) {
        prefs(ctx).edit().putString(key, obj.toString()).apply();
    }

    public static JSONObject getJson(Context ctx, String key) {
        String raw = prefs(ctx).getString(key, null);
        if (raw == null) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** Очередь быстрого добавления (вода/еда из виджета без открытия приложения). */
    public static JSONArray getQueue(Context ctx) {
        String raw = prefs(ctx).getString(KEY_QUEUE, null);
        if (raw == null) return new JSONArray();
        try {
            JSONArray arr = new JSONArray(raw);
            return arr;
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static int enqueue(Context ctx, JSONObject item) {
        JSONArray arr = getQueue(ctx);
        arr.put(item);
        while (arr.length() > 50) arr.remove(0);
        prefs(ctx).edit().putString(KEY_QUEUE, arr.toString()).apply();
        return arr.length();
    }

    /** Забрать очередь и очистить (вызывает JS при старте приложения). */
    public static JSONArray drainQueue(Context ctx) {
        JSONArray arr = getQueue(ctx);
        prefs(ctx).edit().remove(KEY_QUEUE).apply();
        return arr;
    }

    public static int queueSize(Context ctx) {
        return getQueue(ctx).length();
    }

    public static void setLaunchTarget(Context ctx, String target) {
        if (target == null) return;
        prefs(ctx).edit().putString(KEY_LAUNCH_TARGET, target).apply();
    }

    /** Прочитать и сразу очистить (one-shot deep link из виджета). */
    public static String consumeLaunchTarget(Context ctx) {
        String t = prefs(ctx).getString(KEY_LAUNCH_TARGET, null);
        if (t != null) prefs(ctx).edit().remove(KEY_LAUNCH_TARGET).apply();
        return t;
    }

    // ---- Timer state ----

    public static JSONObject getTimer(Context ctx) {
        JSONObject t = getJson(ctx, KEY_TIMER);
        if (!t.has("durationSec")) {
            try {
                t.put("durationSec", 90);
                t.put("remainingSec", 90);
                t.put("running", false);
                t.put("endAt", 0L);
            } catch (Exception ignored) {}
        }
        return t;
    }

    public static void putTimer(Context ctx, JSONObject t) {
        putJson(ctx, KEY_TIMER, t);
    }
}
