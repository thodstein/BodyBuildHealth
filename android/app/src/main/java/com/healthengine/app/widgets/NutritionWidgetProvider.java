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

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Homescreen-виджет «Питание» — аналитика КБЖУ кругами за день / неделю / месяц.
 *
 * Слева крупный круг калорий, справа Б/Ж/У; ниже сводка, вода и кнопки.
 * Период хранится per-widget (чипы «Д · Н · М»): неделя и месяц показывают
 * среднее в день против дневной цели, в сводке — сумма за период и число дней
 * с записями. Агрегаты приходят готовыми в снапшоте (`periods`), поэтому
 * переключение периода не требует WebView.
 *
 * «＋ Еда» открывает компактный нативный редактор (WidgetQuickAddActivity)
 * без запуска приложения и сразу пишет запись в очередь `type=food`.
 * «Скан» и «Фото» уводят в приложение прямо в нужный сценарий: распознавание
 * штрихкода / этикетки требует WebView-движков, нативно их не продублировать.
 */
public class NutritionWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WATER = "com.healthengine.app.action.WIDGET_WATER";
    public static final String ACTION_FOOD = "com.healthengine.app.action.WIDGET_NUT_FOOD";
    /** Переключение периода аналитики: day / week / month (per-widget). */
    public static final String ACTION_PERIOD = "com.healthengine.app.action.WIDGET_NUT_PERIOD";
    public static final String EXTRA_ML = "ml";
    public static final String EXTRA_WIDGET_ID = "widget_id";
    public static final String EXTRA_PERIOD = "period";

    private static final int C_TEXT = 0xFFE2ECFF;
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
            if (ACTION_PERIOD.equals(action)) {
                int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
                if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
                WidgetStore.setNutritionPeriod(context, widgetId, intent.getStringExtra(EXTRA_PERIOD));
                updateWidget(context, widgetId);
                return;
            }
            if (ACTION_WATER.equals(action)) {
                int ml = intent.getIntExtra(EXTRA_ML, 250);
                if (ml <= 0) ml = 250;
                if (ml > 2000) ml = 2000;
                JSONObject item = new JSONObject();
                item.put("type", "water");
                item.put("ml", ml);
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                optimisticWater(context, ml);
                updateAll(context);
                try {
                    WaterQuickWidgetProvider.updateAll(context);
                } catch (Exception ignored) {}
                return;
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        try {
            for (int id : appWidgetIds) WidgetStore.clearNutritionState(context, id);
        } catch (Exception ignored) {}
        super.onDeleted(context, appWidgetIds);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, NutritionWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context, id));
            }
        } catch (Exception ignored) {}
        // Двойной виджет аналитики читает тот же снапшот питания.
        try {
            NutritionPanelWidgetProvider.updateAll(context);
        } catch (Exception ignored) {}
    }

    static void updateWidget(Context context, int widgetId) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            mgr.updateAppWidget(widgetId, build(context, widgetId));
        } catch (Exception ignored) {}
    }

    /**
     * Вода из виджета должна быть видна сразу, не дожидаясь синка из WebView.
     * Снапшот пополняется оптимистично (включая агрегаты периода); при
     * следующем syncAllWidgets JS пересчитает воду из he_water_log.
     */
    static void optimisticWater(Context context, int ml) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            d.put("waterMl", Math.max(0, d.optInt("waterMl", 0)) + Math.max(0, ml));
            JSONObject periods = d.optJSONObject("periods");
            if (periods != null) {
                for (String key : new String[]{"day", "week", "month"}) {
                    JSONObject p = periods.optJSONObject(key);
                    if (p == null) continue;
                    p.put("waterMl", Math.max(0, p.optInt("waterMl", 0)) + Math.max(0, ml));
                    if ("day".equals(key)) {
                        p.put("waterDays", Math.max(1, p.optInt("waterDays", 0)));
                    }
                    periods.put(key, p);
                }
                d.put("periods", periods);
            }
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
        } catch (Exception ignored) {}
    }

    /** Еда из нативного редактора: круги обновляются сразу, без входа в приложение. */
    static void optimisticFood(Context context, int kcal, int p, int f, int c) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            d.put("kcal", Math.max(0, d.optInt("kcal", 0)) + Math.max(0, kcal));
            d.put("protein", Math.max(0, d.optInt("protein", 0)) + Math.max(0, p));
            d.put("fat", Math.max(0, d.optInt("fat", 0)) + Math.max(0, f));
            d.put("carbs", Math.max(0, d.optInt("carbs", 0)) + Math.max(0, c));
            JSONObject periods = d.optJSONObject("periods");
            if (periods != null) {
                for (String key : new String[]{"day", "week", "month"}) {
                    JSONObject period = periods.optJSONObject(key);
                    if (period == null) continue;
                    period.put("kcal", Math.max(0, period.optInt("kcal", 0)) + Math.max(0, kcal));
                    period.put("protein", Math.max(0, period.optInt("protein", 0)) + Math.max(0, p));
                    period.put("fat", Math.max(0, period.optInt("fat", 0)) + Math.max(0, f));
                    period.put("carbs", Math.max(0, period.optInt("carbs", 0)) + Math.max(0, c));
                    if (period.optInt("days", 0) <= 0) period.put("days", 1);
                    periods.put(key, period);
                }
                d.put("periods", periods);
            }
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context, int widgetId) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_nutrition);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
        String period = WidgetStore.getNutritionPeriod(context, widgetId);
        boolean sum = !"day".equals(period);

        JSONObject periods = d.optJSONObject("periods");
        JSONObject pd = periods != null ? periods.optJSONObject(period) : null;

        int target = Math.max(0, d.optInt("targetKcal", 0));
        int tProtein = Math.max(0, d.optInt("targetProtein", 0));
        int tFat = Math.max(0, d.optInt("targetFat", 0));
        int tCarbs = Math.max(0, d.optInt("targetCarbs", 0));
        int tWater = Math.max(0, d.optInt("waterTargetMl", 0));

        int totalKcal;
        int totalProtein;
        int totalFat;
        int totalCarbs;
        int totalWater;
        int days;
        int waterDays;
        if (pd != null) {
            totalKcal = Math.max(0, pd.optInt("kcal", 0));
            totalProtein = Math.max(0, pd.optInt("protein", 0));
            totalFat = Math.max(0, pd.optInt("fat", 0));
            totalCarbs = Math.max(0, pd.optInt("carbs", 0));
            totalWater = Math.max(0, pd.optInt("waterMl", 0));
            days = Math.max(0, pd.optInt("days", 0));
            waterDays = Math.max(0, pd.optInt("waterDays", 0));
        } else {
            totalKcal = Math.max(0, d.optInt("kcal", 0));
            totalProtein = Math.max(0, d.optInt("protein", 0));
            totalFat = Math.max(0, d.optInt("fat", 0));
            totalCarbs = Math.max(0, d.optInt("carbs", 0));
            totalWater = Math.max(0, d.optInt("waterMl", 0));
            boolean hasDay = d.has("kcal") || d.has("targetKcal");
            days = hasDay ? 1 : 0;
            waterDays = totalWater > 0 ? 1 : 0;
        }

        // Неделя/месяц: кольца и «факт» показывают среднее в ДЕНЬ (сравнивать
        // сумму за 30 дней с дневной целью было бы бессмысленно), сводка — сумму.
        int dayDiv = Math.max(1, days);
        int kcal = Math.round(totalKcal / (float) dayDiv);
        int protein = Math.round(totalProtein / (float) dayDiv);
        int fat = Math.round(totalFat / (float) dayDiv);
        int carbs = Math.round(totalCarbs / (float) dayDiv);
        int waterDiv = Math.max(1, waterDays);
        int waterAvg = Math.round(totalWater / (float) waterDiv);
        int water = sum ? waterAvg : totalWater;
        boolean has = days > 0 || (!sum && (d.has("kcal") || d.has("targetKcal")));

        int queue = WidgetStore.queueSize(context);

        v.setTextViewText(R.id.w_nut_date, dateLabel(period));
        stylePeriodChip(v, R.id.w_nut_p_day, "day".equals(period));
        stylePeriodChip(v, R.id.w_nut_p_week, "week".equals(period));
        stylePeriodChip(v, R.id.w_nut_p_month, "month".equals(period));
        v.setOnClickPendingIntent(R.id.w_nut_p_day, periodAction(context, widgetId, "day"));
        v.setOnClickPendingIntent(R.id.w_nut_p_week, periodAction(context, widgetId, "week"));
        v.setOnClickPendingIntent(R.id.w_nut_p_month, periodAction(context, widgetId, "month"));

        // Очередь быстрых записей (вода/еда, ещё не разобранные приложением).
        if (queue > 0) {
            v.setTextViewText(R.id.w_nut_queue, "⏳ " + queue);
            v.setViewVisibility(R.id.w_nut_queue, View.VISIBLE);
            v.setContentDescription(R.id.w_nut_queue, "В очереди: " + queue);
        } else {
            v.setViewVisibility(R.id.w_nut_queue, View.GONE);
        }

        // ---- Круги КБЖУ ----
        int kcalPct = target > 0 ? Math.min(100, Math.round(kcal * 100f / target)) : 0;
        v.setProgressBar(R.id.w_nut_kcal_ring, 100, kcalPct, false);
        v.setTextViewText(R.id.w_nut_kcal_pct, target > 0 ? (kcalPct + "%") : "—");
        v.setTextColor(R.id.w_nut_kcal_pct,
                target > 0 && kcal > target ? C_DANGER : (kcalPct >= 100 ? C_ACCENT : 0xFFFFFFFF));
        v.setTextViewText(R.id.w_nut_kcal_value, formatNum(kcal));
        v.setTextViewText(R.id.w_nut_kcal_target,
                target > 0 ? ("из " + formatNum(target) + " ккал") : "цель не задана");
        v.setTextColor(R.id.w_nut_kcal_target, target > 0 && kcal > target ? C_DANGER : C_MUTED);

        setRing(v, R.id.w_nut_p_ring, R.id.w_nut_p_pct, R.id.w_nut_p_value, protein, tProtein);
        setRing(v, R.id.w_nut_f_ring, R.id.w_nut_f_pct, R.id.w_nut_f_value, fat, tFat);
        setRing(v, R.id.w_nut_c_ring, R.id.w_nut_c_pct, R.id.w_nut_c_value, carbs, tCarbs);

        // ---- Сводка ----
        String summary;
        if (!has) {
            summary = sum ? ("За " + periodWord(period) + " записей нет — добавьте еду")
                    : "Данных за сегодня пока нет — добавьте еду";
        } else if (sum) {
            summary = "Σ " + formatNum(totalKcal) + " ккал " + periodWord(period)
                    + " · " + days + " " + plural(days, "день", "дня", "дней") + " с записями";
        } else if (target > 0) {
            int left = target - kcal;
            if (left > 0) {
                summary = "Осталось " + formatNum(left) + " ккал из " + formatNum(target);
            } else if (left == 0) {
                summary = "Цель дня закрыта: " + formatNum(target) + " ккал";
            } else {
                summary = "Перебор " + formatNum(-left) + " ккал из " + formatNum(target);
            }
        } else {
            summary = "Съедено " + formatNum(kcal) + " ккал · цель не задана";
        }
        v.setTextViewText(R.id.w_nut_summary, summary);
        v.setTextColor(R.id.w_nut_summary, target > 0 && kcal > target ? C_DANGER : C_MUTED);

        // ---- Вода ----
        int waterPct = tWater > 0 && !sum ? Math.min(100, Math.round(water * 100f / tWater))
                : (tWater > 0 && waterDays > 0 ? Math.min(100, Math.round(water * 100f / tWater)) : 0);
        boolean waterDone = tWater > 0 && water >= tWater;
        String waterLine;
        if (sum) {
            waterLine = waterDays == 0
                    ? ("Вода за " + periodWord(period) + " не записана")
                    : ("Вода " + formatNum(totalWater) + " мл " + periodWord(period)
                            + " · ср " + formatNum(waterAvg));
        } else {
            waterLine = tWater > 0
                    ? ((waterDone ? "✓ " : "") + "Вода " + formatNum(water) + " / " + formatNum(tWater) + " мл")
                    : (water > 0 ? ("Вода " + formatNum(water) + " мл") : "Вода не записана");
        }
        v.setTextViewText(R.id.w_nut_water_label, waterLine);
        v.setTextViewText(R.id.w_nut_water_pct,
                tWater > 0 ? (waterDone ? "цель" : (waterPct + "%")) : " ");
        v.setTextColor(R.id.w_nut_water_pct, waterDone ? C_ACCENT : C_MUTED);
        v.setProgressBar(R.id.w_nut_water_bar, 100, waterPct, false);

        // ---- Действия ----
        v.setOnClickPendingIntent(R.id.w_nut_water, waterAction(context, 250, 41));
        v.setOnClickPendingIntent(R.id.w_nut_water500, waterAction(context, 500, 42));
        v.setOnClickPendingIntent(R.id.w_nut_food, foodAction(context, mealForNow(), 45));
        v.setOnClickPendingIntent(R.id.w_nut_scan,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION_SCAN, 46));
        v.setOnClickPendingIntent(R.id.w_nut_photo,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION_PHOTO, 47));
        v.setOnClickPendingIntent(R.id.w_nut_open,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION, 43));
        v.setOnClickPendingIntent(R.id.w_nut_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION, 44));

        // TalkBack: весь виджет читается одной фразой, а не набором цифр без подписей.
        String scope = periodWord(period);
        String a11y = has
                ? ("Питание " + scope + ": " + formatNum(kcal) + " из " + (target > 0 ? formatNum(target) : "—")
                        + " ккал в день, белки " + protein + " из " + tProtein
                        + ", жиры " + fat + " из " + tFat
                        + ", углеводы " + carbs + " из " + tCarbs + " грамм"
                        + (sum ? (", дней с записями " + days) : ""))
                : ("Питание " + scope + ": записей пока нет");
        v.setContentDescription(R.id.w_nut_root, a11y);
        return WidgetStyle.apply(context, v, R.id.w_nut_root);
    }

    /** Круг макроса: процент внутри, «факт / цель» под ним. */
    private static void setRing(RemoteViews v, int ringId, int pctId, int valueId, int value, int target) {
        int pct = target > 0 ? Math.min(100, Math.round(value * 100f / target)) : 0;
        v.setProgressBar(ringId, 100, pct, false);
        v.setTextViewText(pctId, target > 0 ? (pct + "%") : "—");
        v.setTextColor(pctId, target > 0 && value > target ? C_DANGER : 0xFFFFFFFF);
        // Тесно в 3 колонки: «98/150» без пробелов вокруг слэша.
        v.setTextViewText(valueId,
                target > 0 ? (value + "/" + target) : String.valueOf(value));
        v.setTextColor(valueId, target > 0 && value >= target ? C_ACCENT : C_TEXT);
    }

    static void stylePeriodChip(RemoteViews v, int id, boolean on) {
        v.setInt(id, "setBackgroundResource", on ? R.drawable.widget_chip_on : R.drawable.widget_chip);
        v.setTextColor(id, on ? 0xFF07111F : C_TEXT);
    }

    /** 1380 -> «1 380»: тысячи читаются как в дневнике. */
    static String formatNum(int n) {
        try {
            return String.format(Locale.US, "%,d", n).replace(',', ' ');
        } catch (Exception e) {
            return String.valueOf(n);
        }
    }

    /** «день» / «неделя» / «месяц» — подписи в сводке и TalkBack. */
    static String periodNoun(String period) {
        if ("week".equals(period)) return "неделя";
        if ("month".equals(period)) return "месяц";
        return "день";
    }

    /** «за день» / «за неделю» / «за месяц». */
    static String periodWord(String period) {
        if ("week".equals(period)) return "за неделю";
        if ("month".equals(period)) return "за месяц";
        return "за день";
    }

    /** Подпись периода в шапке: дата дня, диапазон недели или месяц. */
    static String dateLabel(String period) {
        try {
            Locale ru = Locale.forLanguageTag("ru");
            Calendar c = Calendar.getInstance();
            if ("month".equals(period)) {
                return new SimpleDateFormat("LLLL yyyy", ru).format(c.getTime());
            }
            if ("week".equals(period)) {
                int back = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7; // Пн=0 … Вс=6
                Calendar start = (Calendar) c.clone();
                start.add(Calendar.DAY_OF_MONTH, -back);
                Calendar end = (Calendar) start.clone();
                end.add(Calendar.DAY_OF_MONTH, 6);
                String from = new SimpleDateFormat("d", ru).format(start.getTime());
                String to = new SimpleDateFormat("d MMM", ru).format(end.getTime());
                return "нед. " + from + "–" + to;
            }
            return new SimpleDateFormat("EEE, d MMM", ru).format(new Date());
        } catch (Exception e) {
            return "";
        }
    }

    static String plural(int n, String one, String few, String many) {
        int mod10 = Math.abs(n) % 10;
        int mod100 = Math.abs(n) % 100;
        if (mod10 == 1 && mod100 != 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    /** Подсказка приёма пищи по времени суток — как в дневнике. */
    static String mealForNow() {
        try {
            int h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
            if (h < 11) return "Завтрак";
            if (h < 15) return "Обед";
            if (h < 18) return "Перекус";
            if (h < 23) return "Ужин";
            return "Перекус";
        } catch (Exception e) {
            return "Перекус";
        }
    }

    static PendingIntent waterAction(Context context, int ml, int code) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_WATER);
        i.putExtra(EXTRA_ML, ml);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent periodAction(Context context, int widgetId, String period) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_PERIOD);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_PERIOD, period);
        int code = 100000 + (Math.abs(widgetId) % 1000) * 4 + ("week".equals(period) ? 1 : "month".equals(period) ? 2 : 0);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** «＋ Еда»: компактный нативный редактор еды поверх лаунчера. */
    static PendingIntent foodAction(Context context, String meal, int code) {
        Intent i = new Intent(context, WidgetQuickAddActivity.class);
        i.setAction(ACTION_FOOD);
        i.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_FOOD);
        i.putExtra(WidgetQuickAddActivity.EXTRA_MEAL, meal);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
