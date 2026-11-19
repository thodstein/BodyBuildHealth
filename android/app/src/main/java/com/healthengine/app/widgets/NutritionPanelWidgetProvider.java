package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import com.healthengine.app.R;

import org.json.JSONObject;

/**
 * Двойной виджет «Аналитика питания»: две независимые половины.
 *
 * В каждой половине своя метрика и свой период — их можно менять прямо на
 * рабочем столе, без открытия приложения и без экрана настроек:
 *  · тап по названию метрики листает ккал → белки → жиры → углеводы → вода;
 *  · чипы «Д · Н · М» переключают день / неделю / месяц.
 *
 * Настройки хранятся per-widget (WidgetStore: nutrition_panel_metric_<id>_<part>,
 * nutrition_panel_period_<id>_<part>), поэтому две половины одного виджета и
 * разные экземпляры на столе не влияют друг на друга.
 *
 * Для недели и месяца показывается СРЕДНЕЕ в день против дневной цели
 * (сумма за 30 дней с дневной целью несравнима), а в подписи — сумма за период
 * и число дней с записями. Агрегаты приходят готовыми в снапшоте `periods`,
 * который пишет JS-мост (widget-bridge → syncNutrition).
 */
public class NutritionPanelWidgetProvider extends AppWidgetProvider {

    /** Переключение периода половины: day / week / month. */
    public static final String ACTION_PERIOD = "com.healthengine.app.action.WIDGET_NUT_PANEL_PERIOD";
    /** Следующая метрика половины. */
    public static final String ACTION_METRIC = "com.healthengine.app.action.WIDGET_NUT_PANEL_METRIC";
    public static final String EXTRA_WIDGET_ID = "widget_id";
    /** Половина виджета: 1 или 2. */
    public static final String EXTRA_PART = "part";
    public static final String EXTRA_PERIOD = "period";

    /** Порядок листания метрик — совпадает с WidgetStore.normalizeMetric. */
    private static final String[] METRICS = {"kcal", "protein", "fat", "carbs", "water"};
    private static final String[] NAMES = {"Ккал ▸", "Белки ▸", "Жиры ▸", "Углеводы ▸", "Вода ▸"};
    private static final String[] UNITS = {"ккал", "г", "г", "г", "мл"};
    private static final int[] COLORS = {0xFFC9F73A, 0xFF60A5FA, 0xFFF59E0B, 0xFFF97316, 0xFF38BDF8};

    private static final int C_TEXT = 0xFFFFFFFF;
    private static final int C_MUTED = 0xFF8FA3C4;
    private static final int C_ACCENT = 0xFFC9F73A;
    private static final int C_DANGER = 0xFFFF6B6B;

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        try {
            if (intent == null) return;
            String action = intent.getAction();
            if (!ACTION_PERIOD.equals(action) && !ACTION_METRIC.equals(action)) return;
            int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            int part = intent.getIntExtra(EXTRA_PART, 1) == 2 ? 2 : 1;
            if (ACTION_PERIOD.equals(action)) {
                WidgetStore.setPanelPeriod(context, widgetId, part, intent.getStringExtra(EXTRA_PERIOD));
            } else {
                WidgetStore.setPanelMetric(context, widgetId, part,
                        nextMetric(WidgetStore.getPanelMetric(context, widgetId, part)));
            }
            updateWidget(context, widgetId);
        } catch (Exception ignored) {}
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        try {
            for (int id : appWidgetIds) WidgetStore.clearNutritionState(context, id);
        } catch (Exception ignored) {}
        super.onDeleted(context, appWidgetIds);
    }

    static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, NutritionPanelWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) mgr.updateAppWidget(id, build(context, id));
        } catch (Exception ignored) {}
    }

    static void updateWidget(Context context, int widgetId) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            mgr.updateAppWidget(widgetId, build(context, widgetId));
        } catch (Exception ignored) {}
    }

    private static String nextMetric(String current) {
        for (int i = 0; i < METRICS.length; i++) {
            if (METRICS[i].equals(current)) return METRICS[(i + 1) % METRICS.length];
        }
        return METRICS[0];
    }

    static RemoteViews build(Context context, int widgetId) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_nutrition_panel);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
        JSONObject periods = d.optJSONObject("periods");
        buildPart(v, context, widgetId, 1, d, periods);
        buildPart(v, context, widgetId, 2, d, periods);
        return WidgetStyle.apply(context, v, R.id.wp_root);
    }

    /** Идентификаторы одной половины: у RemoteViews нет «поиска по префиксу». */
    private static final class PartIds {
        final int root;
        final int metric;
        final int pDay;
        final int pWeek;
        final int pMonth;
        final int value;
        final int pct;
        final int sub;
        final int[] bars;

        PartIds(int root, int metric, int pDay, int pWeek, int pMonth,
                int value, int pct, int sub, int[] bars) {
            this.root = root;
            this.metric = metric;
            this.pDay = pDay;
            this.pWeek = pWeek;
            this.pMonth = pMonth;
            this.value = value;
            this.pct = pct;
            this.sub = sub;
            this.bars = bars;
        }
    }

    private static PartIds ids(int part) {
        if (part == 2) {
            return new PartIds(R.id.wp2_root, R.id.wp2_metric, R.id.wp2_p_day, R.id.wp2_p_week,
                    R.id.wp2_p_month, R.id.wp2_value, R.id.wp2_pct, R.id.wp2_sub,
                    new int[]{R.id.wp2_bar_kcal, R.id.wp2_bar_protein, R.id.wp2_bar_fat,
                            R.id.wp2_bar_carbs, R.id.wp2_bar_water});
        }
        return new PartIds(R.id.wp1_root, R.id.wp1_metric, R.id.wp1_p_day, R.id.wp1_p_week,
                R.id.wp1_p_month, R.id.wp1_value, R.id.wp1_pct, R.id.wp1_sub,
                new int[]{R.id.wp1_bar_kcal, R.id.wp1_bar_protein, R.id.wp1_bar_fat,
                        R.id.wp1_bar_carbs, R.id.wp1_bar_water});
    }

    private static void buildPart(RemoteViews v, Context ctx, int widgetId, int part,
                                  JSONObject d, JSONObject periods) {
        PartIds ids = ids(part);
        String metric = WidgetStore.getPanelMetric(ctx, widgetId, part);
        String period = WidgetStore.getPanelPeriod(ctx, widgetId, part);

        // Период берём из снапшота; если его нет (старый снапшот до синка) —
        // падаем на верхний уровень, где лежат цифры за сегодня.
        JSONObject src = periods == null ? null : periods.optJSONObject(period);
        if (src == null) src = d;

        int idx = 0;
        for (int i = 0; i < METRICS.length; i++) {
            if (METRICS[i].equals(metric)) idx = i;
        }

        int total = valueOf(src, metric);
        int target = targetOf(d, metric);
        int days = Math.max(0, src.optInt("water".equals(metric) ? "waterDays" : "days", 0));
        // Старый снапшот без periods: дни не пришли — считаем день с данными одним.
        if (!src.has("days") && !src.has("waterDays")
                && (src.has("kcal") || src.has("targetKcal"))) {
            days = 1;
        }

        boolean sum = !"day".equals(period);
        int shown = sum ? (days > 0 ? Math.round(total / (float) days) : 0) : total;
        int pct = target > 0 ? Math.min(100, Math.round(shown * 100f / target)) : 0;
        boolean has = sum ? days > 0 : (total > 0 || target > 0);
        String unit = UNITS[idx];

        // ---- шапка: метрика и период ----
        v.setTextViewText(ids.metric, NAMES[idx]);
        v.setTextColor(ids.metric, has ? COLORS[idx] : C_MUTED);
        NutritionWidgetProvider.stylePeriodChip(v, ids.pDay, "day".equals(period));
        NutritionWidgetProvider.stylePeriodChip(v, ids.pWeek, "week".equals(period));
        NutritionWidgetProvider.stylePeriodChip(v, ids.pMonth, "month".equals(period));

        // ---- значение и процент цели ----
        v.setTextViewText(ids.value,
                has ? ((sum ? "ср " : "") + NutritionWidgetProvider.formatNum(shown) + " " + unit) : "—");
        v.setTextColor(ids.value, has ? C_TEXT : C_MUTED);
        v.setTextViewText(ids.pct, target > 0 && has ? (pct + "%") : "—");
        v.setTextColor(ids.pct,
                has && target > 0 && shown > target ? C_DANGER : (has && pct >= 100 ? C_ACCENT : C_MUTED));

        // ---- подпись: остаток дня или сумма и дни за период ----
        String sub;
        if (!has) {
            sub = "За " + NutritionWidgetProvider.periodWord(period) + " записей нет";
        } else if (sum) {
            sub = "Σ " + NutritionWidgetProvider.formatNum(total) + " " + unit + " · " + days + " "
                    + NutritionWidgetProvider.plural(days, "день", "дня", "дней")
                    + (days > 1 ? " · ср/день" : "");
        } else if (target > 0) {
            int left = target - shown;
            sub = left > 0
                    ? ("Осталось " + NutritionWidgetProvider.formatNum(left) + " " + unit + " из "
                            + NutritionWidgetProvider.formatNum(target))
                    : (left == 0 ? ("Цель закрыта: " + NutritionWidgetProvider.formatNum(target) + " " + unit)
                            : ("Перебор " + NutritionWidgetProvider.formatNum(-left) + " " + unit + " из "
                                    + NutritionWidgetProvider.formatNum(target)));
        } else {
            sub = "Цель не задана";
        }
        v.setTextViewText(ids.sub, sub);
        v.setTextColor(ids.sub, has && target > 0 && shown > target ? C_DANGER : C_MUTED);

        // ---- полоска цвета метрики (одна из пяти, остальные скрыты) ----
        for (int i = 0; i < METRICS.length; i++) {
            boolean on = METRICS[i].equals(metric);
            v.setViewVisibility(ids.bars[i], on ? View.VISIBLE : View.GONE);
            if (on) v.setProgressBar(ids.bars[i], 100, pct, false);
        }

        // ---- действия ----
        v.setOnClickPendingIntent(ids.metric, metricAction(ctx, widgetId, part));
        v.setOnClickPendingIntent(ids.pDay, periodAction(ctx, widgetId, part, "day"));
        v.setOnClickPendingIntent(ids.pWeek, periodAction(ctx, widgetId, part, "week"));
        v.setOnClickPendingIntent(ids.pMonth, periodAction(ctx, widgetId, part, "month"));
        v.setOnClickPendingIntent(ids.root,
                TrainingWidgetProvider.openApp(ctx, WidgetStore.TARGET_NUTRITION,
                        220000 + Math.abs(widgetId) % 500 * 2 + part));

        // TalkBack: половина читается одной фразой с названием метрики и периода.
        String a11y = NAMES[idx].replace(" ▸", "")
                + ", " + NutritionWidgetProvider.periodWord(period) + ": "
                + (has ? (NutritionWidgetProvider.formatNum(shown) + " " + unit
                        + (target > 0 ? (" из " + NutritionWidgetProvider.formatNum(target)) : "")
                        + (sum ? (", дней с записями " + days) : "")) : "записей нет")
                + ". Нажмите, чтобы сменить метрику; чипы дня, недели и месяца — период.";
        v.setContentDescription(ids.root, a11y);
    }

    private static int valueOf(JSONObject src, String metric) {
        if (src == null) return 0;
        if ("water".equals(metric)) return Math.max(0, src.optInt("waterMl", 0));
        return Math.max(0, src.optInt(metric, 0));
    }

    private static int targetOf(JSONObject d, String metric) {
        if (d == null) return 0;
        if ("protein".equals(metric)) return Math.max(0, d.optInt("targetProtein", 0));
        if ("fat".equals(metric)) return Math.max(0, d.optInt("targetFat", 0));
        if ("carbs".equals(metric)) return Math.max(0, d.optInt("targetCarbs", 0));
        if ("water".equals(metric)) return Math.max(0, d.optInt("waterTargetMl", 0));
        return Math.max(0, d.optInt("targetKcal", 0));
    }

    private static int slot(String period) {
        if ("week".equals(period)) return 2;
        if ("month".equals(period)) return 3;
        return 1;
    }

    /** Код запроса растёт с widgetId: у каждого экземпляра свои PendingIntent. */
    private static int requestCode(int widgetId, int part, int slot) {
        return 210000 + Math.abs(widgetId) % 500 * 16 + (part - 1) * 8 + slot;
    }

    private static PendingIntent periodAction(Context ctx, int widgetId, int part, String period) {
        Intent i = new Intent(ctx, NutritionPanelWidgetProvider.class);
        i.setAction(ACTION_PERIOD);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_PART, part);
        i.putExtra(EXTRA_PERIOD, period);
        return PendingIntent.getBroadcast(ctx, requestCode(widgetId, part, slot(period)), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent metricAction(Context ctx, int widgetId, int part) {
        Intent i = new Intent(ctx, NutritionPanelWidgetProvider.class);
        i.setAction(ACTION_METRIC);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_PART, part);
        return PendingIntent.getBroadcast(ctx, requestCode(widgetId, part, 0), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
