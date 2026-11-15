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
import java.util.Date;
import java.util.Locale;

/**
 * Homescreen-виджет «Питание» — аналитика КБЖУ кругами.
 *
 * Слева крупный круг калорий, справа Б/Ж/У; ниже сводка дня, вода и кнопки.
 * «＋ Еда» открывает компактный нативный редактор (WidgetQuickAddActivity)
 * без запуска приложения и сразу пишет запись в очередь `type=food`.
 * «Скан» и «Фото» уводят в приложение прямо в нужный сценарий: распознавание
 * штрихкода / этикетки требует WebView-движков, нативно их не продублировать.
 */
public class NutritionWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WATER = "com.healthengine.app.action.WIDGET_WATER";
    public static final String ACTION_FOOD = "com.healthengine.app.action.WIDGET_NUT_FOOD";
    public static final String EXTRA_ML = "ml";

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
            if (intent != null && ACTION_WATER.equals(intent.getAction())) {
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

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, NutritionWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    /**
     * Вода из виджета должна быть видна сразу, не дожидаясь синка из WebView.
     * Снапшот пополняется оптимистично; при следующем syncAllWidgets JS
     * пересчитает воду из he_water_log и перезапишет снапшот фактом.
     */
    static void optimisticWater(Context context, int ml) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            d.put("waterMl", Math.max(0, d.optInt("waterMl", 0)) + Math.max(0, ml));
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
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_nutrition);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);

        int kcal = Math.max(0, d.optInt("kcal", 0));
        int target = Math.max(0, d.optInt("targetKcal", 0));
        int protein = Math.max(0, d.optInt("protein", 0));
        int fat = Math.max(0, d.optInt("fat", 0));
        int carbs = Math.max(0, d.optInt("carbs", 0));
        int tProtein = Math.max(0, d.optInt("targetProtein", 0));
        int tFat = Math.max(0, d.optInt("targetFat", 0));
        int tCarbs = Math.max(0, d.optInt("targetCarbs", 0));
        int water = Math.max(0, d.optInt("waterMl", 0));
        int tWater = Math.max(0, d.optInt("waterTargetMl", 0));
        int queue = WidgetStore.queueSize(context);
        boolean has = d.has("kcal") || d.has("targetKcal");

        // Дата дня, как в дневнике: «сб, 7 нояб.» — контекст «это сегодня».
        try {
            Locale ru = Locale.forLanguageTag("ru");
            String date = new SimpleDateFormat("EEE, d MMM", ru).format(new Date());
            v.setTextViewText(R.id.w_nut_date, date);
        } catch (Exception ignored) {
            v.setTextViewText(R.id.w_nut_date, "");
        }

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
        v.setTextViewText(R.id.w_nut_kcal_value,
                target > 0 ? (formatNum(kcal) + " / " + formatNum(target)) : formatNum(kcal));

        setRing(v, R.id.w_nut_p_ring, R.id.w_nut_p_pct, R.id.w_nut_p_value, protein, tProtein);
        setRing(v, R.id.w_nut_f_ring, R.id.w_nut_f_pct, R.id.w_nut_f_value, fat, tFat);
        setRing(v, R.id.w_nut_c_ring, R.id.w_nut_c_pct, R.id.w_nut_c_value, carbs, tCarbs);

        // ---- Сводка ----
        String summary;
        if (!has) {
            summary = "Данных за сегодня пока нет — добавьте еду";
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
        int waterPct = tWater > 0 ? Math.min(100, Math.round(water * 100f / tWater)) : 0;
        boolean waterDone = tWater > 0 && water >= tWater;
        String waterLine = tWater > 0
                ? ((waterDone ? "✓ " : "") + "Вода " + formatNum(water) + " / " + formatNum(tWater) + " мл")
                : (water > 0 ? ("Вода " + formatNum(water) + " мл") : "Вода не записана");
        v.setTextViewText(R.id.w_nut_water_label, waterLine);
        v.setTextViewText(R.id.w_nut_water_pct, tWater > 0 ? (waterDone ? "цель" : (waterPct + "%")) : " ");
        v.setTextColor(R.id.w_nut_water_pct, waterDone ? C_ACCENT : C_MUTED);
        v.setProgressBar(R.id.w_nut_water_bar, 100, waterPct, false);

        // ---- Действия ----
        v.setOnClickPendingIntent(R.id.w_nut_water,
                waterAction(context, 250, 41));
        v.setOnClickPendingIntent(R.id.w_nut_water500,
                waterAction(context, 500, 42));
        v.setOnClickPendingIntent(R.id.w_nut_food,
                foodAction(context, mealForNow()));
        v.setOnClickPendingIntent(R.id.w_nut_scan,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION_SCAN, 46));
        v.setOnClickPendingIntent(R.id.w_nut_photo,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION_PHOTO, 47));
        v.setOnClickPendingIntent(R.id.w_nut_open,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION, 43));
        v.setOnClickPendingIntent(R.id.w_nut_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION, 44));

        // TalkBack: весь виджет читается одной фразой, а не набором цифр без подписей.
        String a11y = has
                ? ("Питание: " + formatNum(kcal) + " из " + (target > 0 ? formatNum(target) : "—")
                        + " ккал, белки " + protein + " из " + tProtein
                        + ", жиры " + fat + " из " + tFat
                        + ", углеводы " + carbs + " из " + tCarbs + " грамм")
                : "Питание: данных за сегодня пока нет";
        v.setContentDescription(R.id.w_nut_root, a11y);
        return WidgetStyle.apply(context, v, R.id.w_nut_root);
    }

    /** Круг макроса: процент внутри, «факт / цель» под ним. */
    private static void setRing(RemoteViews v, int ringId, int pctId, int valueId, int value, int target) {
        int pct = target > 0 ? Math.min(100, Math.round(value * 100f / target)) : 0;
        v.setProgressBar(ringId, 100, pct, false);
        v.setTextViewText(pctId, target > 0 ? (pct + "%") : "—");
        v.setTextColor(pctId, target > 0 && value > target ? C_DANGER : 0xFFFFFFFF);
        v.setTextViewText(valueId,
                target > 0 ? (value + " / " + target) : String.valueOf(value));
        v.setTextColor(valueId, target > 0 && value >= target ? C_ACCENT : C_TEXT);
    }

    /** 1380 -> «1 380»: тысячи читаются как в дневнике. */
    static String formatNum(int n) {
        try {
            return String.format(Locale.US, "%,d", n).replace(',', ' ');
        } catch (Exception e) {
            return String.valueOf(n);
        }
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

    /** «＋ Еда»: компактный нативный редактор еды поверх лаунчера. */
    static PendingIntent foodAction(Context context, String meal) {
        Intent i = new Intent(context, WidgetQuickAddActivity.class);
        i.setAction(ACTION_FOOD);
        i.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_FOOD);
        i.putExtra(WidgetQuickAddActivity.EXTRA_MEAL, meal);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 45, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
