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
    public static final String KEY_CALENDAR = "calendar_json";
    public static final String KEY_NOTES = "notes_json";
    /** Снапшот «проведения тренировки»: упражнения дня и прогресс. */
    public static final String KEY_WORKOUT = "workout_json";
    public static final String KEY_QUEUE = "nutrition_queue";
    public static final String KEY_TIMER = "timer_json";
    public static final String KEY_LAUNCH_TARGET = "launch_target";
    /** Прозрачность фона виджетов в процентах: 100 / 85 / 70 / 50. */
    public static final String KEY_OPACITY = "widget_opacity";

    /** Per-widget состояние календаря: режим день/неделя/месяц и опорная дата. */
    public static final String KEY_CAL_MODE_PREFIX = "calendar_mode_";
    public static final String KEY_CAL_ANCHOR_PREFIX = "calendar_anchor_";
    /** Per-widget фильтр типов событий: all / task / training / supp / pharma. */
    public static final String KEY_CAL_FILTER_PREFIX = "calendar_filter_";

    /** Per-widget период аналитики питания: day / week / month. */
    public static final String KEY_NUT_PERIOD_PREFIX = "nutrition_period_";
    /** Двойной виджет аналитики: метрика и период каждой половины (part = 1|2). */
    public static final String KEY_NP_METRIC_PREFIX = "nutrition_panel_metric_";
    public static final String KEY_NP_PERIOD_PREFIX = "nutrition_panel_period_";

    /** Intent action: открыть приложение из виджета. */
    public static final String ACTION_OPEN = "com.healthengine.app.action.WIDGET_OPEN";
    public static final String EXTRA_TARGET = "target";

    /** Targets for JS router (DashboardNative). */
    public static final String TARGET_TRAINING = "training";
    /** Сразу вкладка «Проведение тренировки» (runtime) зоны тренировок. */
    public static final String TARGET_TRAINING_RUN = "training_run";
    /** Открыть проведение и записать следующий подход (быстрый сет с рабочего стола). */
    public static final String TARGET_TRAINING_QUICK = "training_quick";
    public static final String TARGET_NUTRITION = "nutrition";
    /** Питание + сразу открыть сканер штрихкода. */
    public static final String TARGET_NUTRITION_SCAN = "nutrition_scan";
    /** Питание + сразу открыть камеру для распознавания этикетки/блюда. */
    public static final String TARGET_NUTRITION_PHOTO = "nutrition_photo";
    public static final String TARGET_SUPPORT = "support";
    public static final String TARGET_CALENDAR = "calendar";
    public static final String TARGET_NOTES = "notes";
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

    // ---- Calendar widget view state ----

    public static String getCalendarMode(Context ctx, int widgetId) {
        String v = prefs(ctx).getString(KEY_CAL_MODE_PREFIX + widgetId, "day");
        if ("week".equals(v) || "month".equals(v)) return v;
        return "day";
    }

    public static void setCalendarMode(Context ctx, int widgetId, String mode) {
        if (mode == null) mode = "day";
        if (!"day".equals(mode) && !"week".equals(mode) && !"month".equals(mode)) mode = "day";
        prefs(ctx).edit().putString(KEY_CAL_MODE_PREFIX + widgetId, mode).apply();
    }

    public static String getCalendarAnchor(Context ctx, int widgetId) {
        return prefs(ctx).getString(KEY_CAL_ANCHOR_PREFIX + widgetId, "");
    }

    public static void setCalendarAnchor(Context ctx, int widgetId, String isoDate) {
        if (isoDate == null || isoDate.isEmpty()) return;
        prefs(ctx).edit().putString(KEY_CAL_ANCHOR_PREFIX + widgetId, isoDate).apply();
    }

    /** Фильтр событий календаря: all показывает всё, остальное — один тип. */
    public static String getCalendarFilter(Context ctx, int widgetId) {
        return normalizeFilter(prefs(ctx).getString(KEY_CAL_FILTER_PREFIX + widgetId, "all"));
    }

    public static void setCalendarFilter(Context ctx, int widgetId, String filter) {
        prefs(ctx).edit().putString(KEY_CAL_FILTER_PREFIX + widgetId, normalizeFilter(filter)).apply();
    }

    public static String normalizeFilter(String value) {
        if ("task".equals(value) || "training".equals(value)
                || "supp".equals(value) || "pharma".equals(value)) {
            return value;
        }
        return "all";
    }

    public static void clearCalendarState(Context ctx, int widgetId) {
        prefs(ctx).edit()
                .remove(KEY_CAL_MODE_PREFIX + widgetId)
                .remove(KEY_CAL_ANCHOR_PREFIX + widgetId)
                .remove(KEY_CAL_FILTER_PREFIX + widgetId)
                .apply();
    }

    // ---- Питание: период дня/недели/месяца и половины двойного виджета ----

    public static String getNutritionPeriod(Context ctx, int widgetId) {
        return normalizePeriod(prefs(ctx).getString(KEY_NUT_PERIOD_PREFIX + widgetId, "day"));
    }

    public static void setNutritionPeriod(Context ctx, int widgetId, String period) {
        prefs(ctx).edit().putString(KEY_NUT_PERIOD_PREFIX + widgetId, normalizePeriod(period)).apply();
    }

    /** Метрика половины двойного виджета: kcal / protein / fat / carbs / water. */
    public static String getPanelMetric(Context ctx, int widgetId, int part) {
        String def = part == 2 ? "protein" : "kcal";
        return normalizeMetric(prefs(ctx).getString(KEY_NP_METRIC_PREFIX + widgetId + "_" + part, def));
    }

    public static void setPanelMetric(Context ctx, int widgetId, int part, String metric) {
        prefs(ctx).edit()
                .putString(KEY_NP_METRIC_PREFIX + widgetId + "_" + part, normalizeMetric(metric))
                .apply();
    }

    public static String getPanelPeriod(Context ctx, int widgetId, int part) {
        String def = part == 2 ? "week" : "day";
        return normalizePeriod(prefs(ctx).getString(KEY_NP_PERIOD_PREFIX + widgetId + "_" + part, def));
    }

    public static void setPanelPeriod(Context ctx, int widgetId, int part, String period) {
        prefs(ctx).edit()
                .putString(KEY_NP_PERIOD_PREFIX + widgetId + "_" + part, normalizePeriod(period))
                .apply();
    }

    public static String normalizePeriod(String value) {
        if ("week".equals(value) || "month".equals(value)) return value;
        return "day";
    }

    public static String normalizeMetric(String value) {
        if ("protein".equals(value) || "fat".equals(value) || "carbs".equals(value)
                || "water".equals(value)) {
            return value;
        }
        return "kcal";
    }

    public static void clearNutritionState(Context ctx, int widgetId) {
        SharedPreferences.Editor e = prefs(ctx).edit()
                .remove(KEY_NUT_PERIOD_PREFIX + widgetId);
        for (int part = 1; part <= 2; part++) {
            e.remove(KEY_NP_METRIC_PREFIX + widgetId + "_" + part);
            e.remove(KEY_NP_PERIOD_PREFIX + widgetId + "_" + part);
        }
        e.apply();
    }

    // ---- Прозрачность фона виджетов ----

    /** Текущая прозрачность в процентах (100 — плотный фон). */
    public static int getWidgetOpacity(Context ctx) {
        int v = prefs(ctx).getInt(KEY_OPACITY, 100);
        return normalizeOpacity(v);
    }

    public static void setWidgetOpacity(Context ctx, int value) {
        prefs(ctx).edit().putInt(KEY_OPACITY, normalizeOpacity(value)).apply();
    }

    /** Разрешены четыре ступени: 100 / 85 / 70 / 50. */
    public static int normalizeOpacity(int value) {
        if (value >= 100) return 100;
        if (value >= 85) return 85;
        if (value >= 70) return 70;
        if (value >= 50) return 50;
        return 50;
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
