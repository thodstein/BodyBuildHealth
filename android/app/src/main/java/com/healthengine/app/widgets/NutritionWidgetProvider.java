package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.widget.RemoteViews;

import com.healthengine.app.MainActivity;
import com.healthengine.app.R;

import org.json.JSONObject;

/**
 * Homescreen-виджет «Питание»: ккал дня + очередь + быстрые действия.
 * Кнопка воды работает БЕЗ открытия приложения (пишет в очередь,
 * приложение забирает её при старте). Еда — через открытие дневника.
 */
public class NutritionWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WATER = "com.healthengine.app.action.WIDGET_WATER";
    public static final String EXTRA_ML = "ml";

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
                updateAll(context);
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

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_nutrition);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
        int kcal = d.optInt("kcal", 0);
        int target = d.optInt("targetKcal", 0);
        int protein = d.optInt("protein", 0);
        int water = d.optInt("waterMl", 0);
        int queue = WidgetStore.queueSize(context);
        boolean has = d.has("kcal") || d.has("targetKcal");

        String kcalLine = has
                ? (target > 0 ? kcal + " / " + target + " ккал" : kcal + " ккал")
                : "Дневник питания";
        v.setTextViewText(R.id.w_nut_kcal, kcalLine);
        String sub = has
                ? ("белок " + protein + " г · вода " + water + " мл")
                : "Ккал, белок и вода за сегодня";
        v.setTextViewText(R.id.w_nut_sub, sub);
        v.setTextViewText(R.id.w_nut_queue, queue > 0 ? "В очереди: " + queue : " ");

        v.setOnClickPendingIntent(R.id.w_nut_water,
                waterAction(context, 250, 41));
        v.setOnClickPendingIntent(R.id.w_nut_water500,
                waterAction(context, 500, 42));
        v.setOnClickPendingIntent(R.id.w_nut_open,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION, 43));
        v.setOnClickPendingIntent(R.id.w_nut_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION, 44));
        return v;
    }

    static PendingIntent waterAction(Context context, int ml, int code) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_WATER);
        i.putExtra(EXTRA_ML, ml);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
